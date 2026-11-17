<template>
  <!-- Ana firma şeması (Vue Flow + dagre). Her dal bir ALANDIR (KSY-SIS'teki gibi): üstte dal kutusu, altında o dalın lokasyonları
       satırlar hâlinde. Dallar yukarıdan aşağı otomatik dizilir; yakınlaştır / kaydır. Düzenleme yetkisi varsa lokasyon başka bir
       dalın alanına, dal başka bir dalın alanına sürüklenip bırakılınca taşınır. -->
  <div class="org-chart" :class="{ dragging: !!dragId }">
    <VueFlow
      :id="flowId"
      :nodes="flowNodes"
      :edges="flowEdges"
      :nodes-draggable="canEdit"
      :nodes-connectable="false"
      :elements-selectable="false"
      :zoom-on-double-click="false"
      :min-zoom="0.15"
      :max-zoom="1.6"
      @nodes-initialized="fit"
      @node-click="onNodeClick"
      @node-drag-start="onDragStart"
      @node-drag="onDrag"
      @node-drag-stop="onDragStop"
    >
      <Background pattern-color="rgba(145, 158, 171, .35)" :gap="16" />
      <Controls :show-interactive="false" position="bottom-left" />

      <template #node-org="{ id, data }">
        <div class="chart-group" :class="{ 'has-area': data.hasLocations, target: dropId === id }">
          <Handle type="target" :position="Position.Top" class="handle" />
          <div class="chart-node" :class="{ root: data.root, on: selectedKey === id }">
            <span class="chart-node-icon"><i :class="data.root ? 'pi pi-building' : 'pi pi-sitemap'" aria-hidden="true" /></span>
            <span class="chart-node-text"><strong>{{ data.name }}</strong><small v-if="data.label">{{ data.label }}</small></span>
            <span v-if="canEdit" class="chart-node-actions nodrag">
              <button v-if="canBranch" type="button" class="chart-add" :aria-label="`${data.name} altına ${branchLabel.toLocaleLowerCase('tr-TR')} ekle`" @click.stop="emit('add-branch', data.nodeId)"><i class="pi pi-plus" /> {{ branchLabel }}</button>
              <button type="button" class="chart-add" :aria-label="`${data.name} altına lokasyon ekle`" @click.stop="emit('add-location', data.nodeId)"><i class="pi pi-plus" /> Lokasyon</button>
            </span>
          </div>
          <span v-if="data.hasLocations" class="chart-area" aria-hidden="true" />
          <Handle type="source" :position="Position.Bottom" class="handle" />
        </div>
      </template>

      <template #node-loc="{ id, data }">
        <div class="chart-location" :class="{ on: selectedKey === id }">
          <i class="pi pi-map-marker" aria-hidden="true" />
          <span><strong>{{ data.name }}</strong><small>{{ data.count ? `${data.count} işyeri` : 'İşyeri yok' }}<template v-if="data.city"> · {{ data.city }}</template></small></span>
        </div>
      </template>
    </VueFlow>
    <p v-if="canEdit" class="chart-hint"><i class="pi pi-arrows-alt" aria-hidden="true" /> Lokasyonu ya da {{ branchLabel.toLocaleLowerCase('tr-TR') }}ı tutup taşıyabilirsiniz: lokasyon başka bir {{ branchLabel.toLocaleLowerCase('tr-TR') }}ın alanına, {{ branchLabel.toLocaleLowerCase('tr-TR') }} başka bir {{ branchLabel.toLocaleLowerCase('tr-TR') }}ın kutusunun üstüne.</p>
  </div>
</template>

<script setup lang="ts">
import { VueFlow, Handle, Position, useVueFlow, type Node, type Edge, type NodeMouseEvent, type NodeDragEvent } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import dagre from '@dagrejs/dagre'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/controls/dist/style.css'
import type { FirmLocation, FirmNode } from '~/composables/useFirmSetup'

const props = defineProps<{
  nodes: FirmNode[]
  locations: FirmLocation[]
  counts: Record<string, number>
  labels: Record<string, string>
  selectedKey: string | null
  canEdit: boolean
  canBranch: boolean
  branchLabel: string
}>()
const emit = defineEmits<{
  select: [key: string]
  'add-branch': [nodeId: number | string]
  'add-location': [nodeId: number | string]
  'move-location': [locationId: number | string, nodeId: number | string]
  'move-node': [nodeId: number | string, parentId: number | string]
}>()

// Birden çok şema aynı sayfada olabilir: her biri kendi Vue Flow örneği.
const flowId = `org-chart-${Math.random().toString(36).slice(2, 8)}`
const { getNodes, fitView } = useVueFlow(flowId)
// Kutular ölçüldükten sonra (ilk açılış ve her yeniden yerleşim) şema alana sığdırılır; çok büyütülmez.
const fit = () => nextTick(() => setTimeout(() => fitView({ padding: 0.08, maxZoom: 1, duration: 150 }), 60))

const ORG = { width: 300, height: 58 }
const LOC = { width: 230, height: 54 }
const COLS = 4
const GAP = 12
const PAD = 14 // alanın iç boşluğu
// Bağlantı çizgisi: yuvarlak köşeli basamak (organizasyon şeması görünümü), yumuşak mavi.
const EDGE = { type: 'smoothstep', pathOptions: { borderRadius: 18, offset: 20 }, style: { stroke: 'rgba(107, 151, 255, .75)', strokeWidth: 2 } } as const
const flowNodes = ref<Node[]>([])
const flowEdges = ref<Edge[]>([])
// Düğüm → üst düğüm (döngü kontrolü için).
const parentOf = new Map<string, string | null>()

function layout() {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 64, marginx: 16, marginy: 16 })
  g.setDefaultEdgeLabel(() => ({}))
  const groups: { id: string; node: FirmNode; parent: FirmNode | null; locs: FirmLocation[]; width: number; height: number; blockWidth: number }[] = []
  const edges: Edge[] = []
  parentOf.clear()
  const walk = (node: FirmNode, parent: FirmNode | null) => {
    const id = `n${node.id}`
    parentOf.set(id, parent ? `n${parent.id}` : null)
    const locs = props.locations.filter(l => String(l.organization_id) === String(node.id))
    const cols = Math.min(COLS, locs.length)
    const rows = Math.ceil(locs.length / COLS)
    const blockWidth = cols ? cols * LOC.width + (cols - 1) * GAP : 0
    const width = Math.max(ORG.width, blockWidth + 2 * PAD)
    const height = ORG.height + (rows ? 12 + PAD + rows * LOC.height + (rows - 1) * GAP + PAD : 0)
    // dagre konumu bu nesneye yazar: her kutuya ayrı nesne
    g.setNode(id, { width, height })
    groups.push({ id, node, parent, locs, width, height, blockWidth })
    if (parent) { g.setEdge(`n${parent.id}`, id); edges.push({ id: `e${parent.id}-${node.id}`, source: `n${parent.id}`, target: id, ...EDGE }) }
    for (const child of node.children || []) walk(child, node)
  }
  props.nodes.forEach(node => walk(node, null))
  dagre.layout(g)
  const nodes: Node[] = []
  for (const group of groups) {
    const box = g.node(group.id)
    // Dal alanı (üst düğüm) önce, lokasyonları (alt düğüm, konumları alana göre) sonra.
    nodes.push({
      id: group.id, type: 'org', position: { x: box.x - group.width / 2, y: box.y - group.height / 2 },
      style: { width: `${group.width}px`, height: `${group.height}px` },
      draggable: props.canEdit && !!group.parent,
      data: { nodeId: group.node.id, name: group.node.name, label: props.labels[String(group.node.id)] || '', root: !group.parent, hasLocations: group.locs.length > 0 }
    })
    group.locs.forEach((location, i) => {
      nodes.push({
        id: `l${location.id}`, type: 'loc', parentNode: group.id,
        position: { x: (group.width - group.blockWidth) / 2 + (i % COLS) * (LOC.width + GAP), y: ORG.height + 12 + PAD + Math.floor(i / COLS) * (LOC.height + GAP) },
        data: { locationId: location.id, nodeId: group.node.id, name: location.name, city: location.city, count: props.counts[String(location.id)] || 0 }
      })
    })
  }
  flowNodes.value = nodes
  flowEdges.value = edges
}
watch(() => [props.nodes, props.locations, props.counts, props.labels, props.canEdit], () => { layout(); fit() }, { immediate: true, deep: true })

const onNodeClick = ({ node }: NodeMouseEvent) => emit('select', node.id)

// --- Sürükle bırak: bırakılan alanın dalı hedeftir; geçersizse kutu yerine döner. ---
const dragId = ref<string | null>(null)
const dropId = ref<string | null>(null)
const isDescendant = (candidate: string, ancestor: string) => {
  for (let id: string | null | undefined = candidate; id; id = parentOf.get(id)) if (id === ancestor) return true
  return false
}
// En içteki (en derin) uygun dal: iç içe alanlarda bırakılan yerin en yakın dalı.
const depth = (id: string) => { let d = 0; for (let p = parentOf.get(id); p; p = parentOf.get(p)) d++; return d }
type Rect = { x: number; y: number; w: number; h: number }
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const abs = (node: Node) => (node as any).computedPosition ?? node.position
// Dalın üst kutusu (alanın ortasında, en üstte) ve alanın tamamı.
const headerRect = (node: Node): Rect => { const p = abs(node); const w = node.dimensions?.width ?? ORG.width; return { x: p.x + (w - ORG.width) / 2, y: p.y, w: ORG.width, h: ORG.height } }
const areaRect = (node: Node): Rect => { const p = abs(node); return { x: p.x, y: p.y, w: node.dimensions?.width ?? ORG.width, h: node.dimensions?.height ?? ORG.height } }
// Lokasyon: kutusu başka bir dalın alanına girerse o dal. Dal: yalnız üst kutusu başka bir dalın üst kutusuna değerse o dal
// (alanın tamamı sayılmaz; büyük dal sürüklenirken yanlış dala girmesin).
const targetFor = (node: Node) => {
  const own: Rect = node.type === 'loc' ? { ...abs(node), w: LOC.width, h: LOC.height } : headerRect(node)
  return getNodes.value
    .filter(other => other.type === 'org' && other.id !== node.id && (node.type === 'loc'
      ? `n${node.data.nodeId}` !== other.id
      : !isDescendant(other.id, node.id) && parentOf.get(node.id) !== other.id))
    .filter(other => overlap(own, node.type === 'loc' ? areaRect(other) : headerRect(other)))
    .sort((a, b) => depth(b.id) - depth(a.id))[0] ?? null
}
const onDragStart = ({ node }: NodeDragEvent) => { dragId.value = node.id }
const onDrag = ({ node }: NodeDragEvent) => { dropId.value = targetFor(node)?.id ?? null }
const onDragStop = ({ node }: NodeDragEvent) => {
  const target = targetFor(node)
  dragId.value = null
  dropId.value = null
  if (!target) { layout(); return }
  if (node.type === 'loc') emit('move-location', node.data.locationId, target.data.nodeId)
  else emit('move-node', node.data.nodeId, target.data.nodeId)
}
</script>

<style scoped>
.org-chart { position: relative; height: 560px; border-radius: 12px; background: rgba(145, 158, 171, .04); overflow: hidden; }
.org-chart :deep(.vue-flow__node) { cursor: pointer; }
.org-chart :deep(.vue-flow__node.draggable) { cursor: grab; }
.org-chart.dragging :deep(.vue-flow__node.dragging) { cursor: grabbing; z-index: 1000 !important; }
.org-chart :deep(.vue-flow__controls) { box-shadow: var(--pk-card-shadow); border-radius: 8px; overflow: hidden; }
.org-chart :deep(.vue-flow__controls-button) { width: 28px; height: 28px; border-bottom: 1px solid rgba(145, 158, 171, .2); background: var(--admin-card); color: var(--admin-heading); }
.handle { opacity: 0; pointer-events: none; }
/* Dal alanı: üstte dal kutusu, altında lokasyonların durduğu kesik çizgili alan */
.chart-group { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; }
.chart-area { position: absolute; left: 0; right: 0; top: 70px; bottom: 0; border: 1.5px dashed rgba(145, 158, 171, .45); border-radius: 14px; background: rgba(145, 158, 171, .05); }
.chart-group.target .chart-area { border-color: var(--pk-success-main); background: rgba(0, 171, 85, .08); }
.chart-group.target .chart-node { box-shadow: 0 0 0 3px var(--pk-success-main), 0 8px 16px rgba(0, 171, 85, .25); }
.chart-node { position: relative; z-index: 1; width: 300px; min-height: 58px; display: flex; align-items: center; gap: 10px; padding: 8px 10px 8px 8px; border-radius: 12px; background: var(--admin-card); box-shadow: 0 0 0 1px rgba(145, 158, 171, .28), 0 4px 10px -4px rgba(145, 158, 171, .3); transition: box-shadow .15s ease; }
.chart-node.root { box-shadow: 0 0 0 2px rgba(var(--pk-accent-rgb), .35), 0 4px 10px -4px rgba(145, 158, 171, .3); }
.chart-node.on { box-shadow: 0 0 0 2px var(--pk-accent), 0 8px 16px rgba(var(--pk-accent-rgb), .2); }
.chart-node-icon { flex: none; width: 36px; height: 36px; display: grid; place-items: center; border-radius: 10px; background: var(--pk-violet-lighter); color: var(--pk-violet-dark); }
.chart-node.root .chart-node-icon { background: var(--pk-primary-lighter); color: var(--pk-primary-dark); }
.chart-node-text { flex: 1; min-width: 0; display: grid; }
.chart-node-text strong { display: -webkit-box; overflow: hidden; color: var(--admin-heading); font-size: 13px; font-weight: 700; line-height: 1.3; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.chart-node-text small { color: var(--admin-muted); font-size: 11px; }
/* Ekleme düğmeleri yalnız fare üstündeyken ya da kutu seçiliyken: uzun birim adları kesilmesin. */
.chart-node-actions { flex: none; display: none; gap: 4px; }
.chart-node:hover .chart-node-actions, .chart-node.on .chart-node-actions, .chart-node:focus-within .chart-node-actions { display: flex; }
.chart-add { height: 26px; display: inline-flex; align-items: center; gap: 3px; padding: 0 7px; border: 1px dashed rgba(145, 158, 171, .55); border-radius: 7px; background: transparent; color: var(--admin-muted); font: inherit; font-size: 11px; font-weight: 700; white-space: nowrap; cursor: pointer; }
.chart-add .pi { font-size: 9px; }
.chart-add:hover, .chart-add:focus-visible { border-style: solid; border-color: var(--pk-accent); background: var(--admin-accent-soft); color: var(--pk-accent); }
.chart-location { width: 230px; min-height: 54px; display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 12px; background: var(--pk-success-lighter); color: var(--pk-success-darker); }
.chart-location > i { color: var(--pk-success-dark); }
.chart-location span { min-width: 0; display: grid; }
.chart-location strong { display: -webkit-box; overflow: hidden; font-size: 12.5px; font-weight: 700; line-height: 1.3; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.chart-location small { color: var(--pk-success-dark); font-size: 11px; }
.chart-location:hover { box-shadow: 0 0 0 2px rgba(0, 171, 85, .35); }
.chart-location.on { background: var(--pk-accent); color: var(--pk-on-accent); box-shadow: 0 8px 16px rgba(var(--pk-accent-rgb), .24); }
.chart-location.on > i, .chart-location.on small { color: var(--pk-on-accent); }
:global(.dark-theme) .chart-location:not(.on) { background: rgba(0, 171, 85, .14); color: var(--admin-heading); }
.chart-hint { position: absolute; right: 12px; bottom: 10px; margin: 0; padding: 5px 10px; border-radius: 8px; background: var(--admin-card); box-shadow: var(--pk-card-shadow); color: var(--admin-muted); font-size: 12px; }
@media (max-width: 800px) { .org-chart { height: 440px; } .chart-hint { display: none; } }
</style>
