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
          <div class="chart-node" :class="{ root: data.root, on: selectedKey === id }" :style="{ '--c': data.color.main, '--c-soft': data.color.soft }">
            <span class="chart-node-top">
              <span class="chart-node-icon"><component :is="data.root ? Building2 : Network" :size="18" :stroke-width="1.8" aria-hidden="true" /></span>
              <span class="chart-node-text"><strong>{{ data.name }}</strong><small>{{ data.subtitle }}</small></span>
            </span>
            <!-- İşlemler kutunun altında (mockup, Lucide ikonları): lokasyon ekle, düzenle, lokasyon listesi, diğer. Alt birim ekleme alttaki "+" ile. -->
            <span class="chart-node-actions nodrag">
              <button v-if="canEdit" v-tooltip.bottom="'Lokasyon ekle'" type="button" :aria-label="`${data.name} altına lokasyon ekle`" @click.stop="emit('add-location', data.nodeId)"><MapPinPlus :size="16" :stroke-width="1.8" /></button>
              <button v-if="canEdit" v-tooltip.bottom="'Düzenle'" type="button" :aria-label="`${data.name} düzenle`" @click.stop="emit('edit', data.nodeId)"><PencilLine :size="16" :stroke-width="1.8" /></button>
              <button v-if="data.count" v-tooltip.bottom="'Lokasyon listesi'" type="button" :aria-label="`${data.name} lokasyon listesi`" @click.stop="emit('open-list', data.nodeId)"><List :size="16" :stroke-width="1.8" /></button>
              <button v-tooltip.bottom="'Diğer işlemler'" type="button" :aria-label="`${data.name} diğer işlemler`" @click.stop="emit('select', id)"><EllipsisVertical :size="16" :stroke-width="1.8" /></button>
            </span>
            <button v-if="canEdit && canBranch" v-tooltip.bottom="`${branchLabel} ekle`" class="chart-plus nodrag" type="button" :aria-label="`${data.name} altına ${branchLabel.toLocaleLowerCase('tr-TR')} ekle`" @click.stop="emit('add-branch', data.nodeId)"><Plus :size="14" :stroke-width="2.4" /></button>
          </div>
          <span v-if="data.hasLocations" class="chart-area" aria-hidden="true" />
          <!-- Çok lokasyonlu dal: lokasyonlar tek tek çizilmez, özet kutu; tıklayınca liste sağ panelde açılır -->
          <button v-if="data.summary" type="button" class="chart-summary nodrag" :class="{ on: selectedKey === `s${data.nodeId}` }" :aria-label="`${data.name}: ${data.summary} lokasyonun listesini aç`" @click.stop="emit('open-list', data.nodeId)">
            <i class="pi pi-map-marker" aria-hidden="true" /><strong>{{ data.summary }} lokasyon</strong><span>Listeyi aç</span><i class="pi pi-angle-right" aria-hidden="true" />
          </button>
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
import { Building2, EllipsisVertical, List, MapPinPlus, Network, PencilLine, Plus } from 'lucide-vue-next'
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
  'open-list': [nodeId: number | string]
  edit: [nodeId: number | string]
  layout: [positions: Record<string, { x: number; y: number }>]
}>()

// Birden çok şema aynı sayfada olabilir: her biri kendi Vue Flow örneği.
const branchLabel = computed(() => props.branchLabel)
const flowId = `org-chart-${Math.random().toString(36).slice(2, 8)}`
const { getNodes, fitView } = useVueFlow(flowId)
// Kutular ölçüldükten sonra (ilk açılış ve her yeniden yerleşim) şema alana sığdırılır; çok büyütülmez.
const fit = () => nextTick(() => setTimeout(() => fitView({ padding: 0.08, maxZoom: 1, duration: 150 }), 60))

const ORG = { width: 300, height: 108 }
const LOC = { width: 230, height: 54 }
const COLS = 4
// Bu sayıdan fazla lokasyonu olan dalda lokasyonlar şemada özet kutu olur (liste sağ panelde).
const INLINE_MAX = 4
const SUMMARY = { width: 300, height: 48 }
const GAP = 12
const PAD = 14 // alanın iç boşluğu
// Her alt birimin kendi rengi (paletten sırayla); ona giden çizgi ve uç noktası da o renk. Kök: birincil mavi.
const COLORS = [
  { main: '#a43df5', soft: '#f3e0ff' }, { main: '#1890ff', soft: '#d0f2ff' }, { main: '#00ab55', soft: '#c8f2d8' },
  { main: '#ff8f00', soft: '#fff2d6' }, { main: '#ff4842', soft: '#ffe7d9' }, { main: '#0047ff', soft: '#d6e2ff' }
]
const ROOT_COLOR = { main: '#0047ff', soft: '#d6e2ff' }
// Bağlantı çizgisi: yuvarlak köşeli basamak (organizasyon şeması görünümü), yumuşak mavi.
// İnce, kavisli köşeli düz çizgi (mockup); rengi gittiği alt birimin rengi.
const EDGE = { type: 'smoothstep', pathOptions: { borderRadius: 22 } } as const
const flowNodes = ref<Node[]>([])
const flowEdges = ref<Edge[]>([])
// Düğüm → üst düğüm (döngü kontrolü için).
const parentOf = new Map<string, string | null>()
const depthOf = (id: string) => { let d = 0; for (let p = parentOf.get(id); p; p = parentOf.get(p)) d++; return d }

function layout() {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 64, marginx: 16, marginy: 16 })
  g.setDefaultEdgeLabel(() => ({}))
  const groups: { id: string; node: FirmNode; parent: FirmNode | null; locs: FirmLocation[]; width: number; height: number; blockWidth: number; summary: number; count: number; color: { main: string; soft: string } }[] = []
  let colorIndex = 0
  const edges: Edge[] = []
  parentOf.clear()
  const walk = (node: FirmNode, parent: FirmNode | null) => {
    const id = `n${node.id}`
    parentOf.set(id, parent ? `n${parent.id}` : null)
    const all = props.locations.filter(l => String(l.organization_id) === String(node.id))
    const summary = all.length > INLINE_MAX ? all.length : 0
    const locs = summary ? [] : all
    const cols = Math.min(COLS, locs.length)
    const rows = Math.ceil(locs.length / COLS)
    const blockWidth = cols ? cols * LOC.width + (cols - 1) * GAP : 0
    const width = Math.max(ORG.width, blockWidth + 2 * PAD)
    const height = ORG.height + (rows ? 22 + PAD + rows * LOC.height + (rows - 1) * GAP + PAD : summary ? 22 + SUMMARY.height : 0)
    // dagre konumu bu nesneye yazar: her kutuya ayrı nesne
    g.setNode(id, { width, height })
    const color = parent ? COLORS[colorIndex++ % COLORS.length] : ROOT_COLOR
    groups.push({ id, node, parent, locs, width, height, blockWidth, summary, count: all.length, color })
    if (parent) { g.setEdge(`n${parent.id}`, id); edges.push({ id: `e${parent.id}-${node.id}`, source: `n${parent.id}`, target: id, ...EDGE, style: { stroke: color.main, strokeWidth: 1.6, opacity: 0.75 } }) }
    for (const child of node.children || []) walk(child, node)
  }
  props.nodes.forEach(node => walk(node, null))
  dagre.layout(g)
  // Aynı seviyedeki dallar üstten hizalı (dagre farklı boydaki kutuları ortalar; lokasyon bloğu olan dal yukarı kayıyordu).
  const rankTop = new Map<number, number>()
  for (const group of groups) {
    const box = g.node(group.id)
    const d = depthOf(group.id)
    rankTop.set(d, Math.min(rankTop.get(d) ?? Infinity, box.y - group.height / 2))
  }
  const nodes: Node[] = []
  for (const group of groups) {
    const box = g.node(group.id)
    const top = rankTop.get(depthOf(group.id))!
    // Dal alanı (üst düğüm) önce, lokasyonları (alt düğüm, konumları alana göre) sonra.
    nodes.push({
      id: group.id, type: 'org', position: { x: box.x - group.width / 2, y: top },
      style: { width: `${group.width}px`, height: `${group.height}px` },
      draggable: props.canEdit && !!group.parent,
      data: { nodeId: group.node.id, name: group.node.name, label: props.labels[String(group.node.id)] || '', root: !group.parent, hasLocations: group.locs.length > 0, summary: group.summary, count: group.count, color: group.color,
        subtitle: [group.parent ? branchLabel.value : 'Ana yapı', group.count ? `${group.count} lokasyon` : '', props.labels[String(group.node.id)] || ''].filter(Boolean).join(' · ') }
    })
    group.locs.forEach((location, i) => {
      nodes.push({
        id: `l${location.id}`, type: 'loc', parentNode: group.id,
        position: { x: (group.width - group.blockWidth) / 2 + (i % COLS) * (LOC.width + GAP), y: ORG.height + 22 + PAD + Math.floor(i / COLS) * (LOC.height + GAP) },
        data: { locationId: location.id, nodeId: group.node.id, name: location.name, city: location.city, count: props.counts[String(location.id)] || 0 }
      })
    })
  }
  flowNodes.value = nodes
  flowEdges.value = edges
  // Dal kutusunun (üst kutu) merkezleri: küçük şema bu yerleşimi kullanır.
  emit('layout', Object.fromEntries(groups.map(group => { const box = g.node(group.id); return [String(group.node.id), { x: box.x, y: (rankTop.get(depthOf(group.id)) ?? 0) + ORG.height / 2 }] })))
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
.org-chart :deep(.vue-flow__edge.animated path) { stroke-dasharray: 6 5; animation-duration: 1.2s; }
@media (prefers-reduced-motion: reduce) { .org-chart :deep(.vue-flow__edge.animated path) { animation: none; } }
.org-chart :deep(.vue-flow__node.draggable) { cursor: grab; }
.org-chart.dragging :deep(.vue-flow__node.dragging) { cursor: grabbing; z-index: 1000 !important; }
.org-chart :deep(.vue-flow__controls) { box-shadow: var(--pk-card-shadow); border-radius: 8px; overflow: hidden; }
.org-chart :deep(.vue-flow__controls-button) { width: 28px; height: 28px; border-bottom: 1px solid rgba(145, 158, 171, .2); background: var(--admin-card); color: var(--admin-heading); }
.handle { opacity: 0; pointer-events: none; }
/* Dal alanı: üstte dal kutusu, altında lokasyonların durduğu kesik çizgili alan */
.chart-group { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; }
.chart-area { position: absolute; left: 0; right: 0; top: 122px; bottom: 0; border: 1.5px dashed rgba(145, 158, 171, .45); border-radius: 14px; background: rgba(145, 158, 171, .05); }
.chart-group.target .chart-area { border-color: var(--pk-success-main); background: rgba(0, 171, 85, .08); }
.chart-group.target .chart-node { box-shadow: 0 0 0 3px var(--pk-success-main), 0 8px 16px rgba(0, 171, 85, .25); }
/* Dal kutusu (mockup): üstte simge + ad + alt yazı, çizginin altında işlem simgeleri, kutunun altında koyu "+" */
.chart-node { --c: #0047ff; --c-soft: #d6e2ff; position: relative; z-index: 1; width: 300px; height: 108px; display: grid; grid-template-rows: 1fr auto; padding: 10px 12px 0; border-radius: 14px; background: var(--admin-card); box-shadow: 0 0 0 1px rgba(145, 158, 171, .22), 0 8px 20px -6px rgba(145, 158, 171, .35); transition: box-shadow .15s ease; }
.chart-node::before { content: ""; position: absolute; top: -5px; left: 50%; width: 8px; height: 8px; margin-left: -4px; border: 2px solid var(--c); border-radius: 50%; background: var(--admin-card); }
.chart-node.root::before { display: none; }
.chart-node.on { box-shadow: 0 0 0 2px var(--c), 0 10px 22px -6px rgba(145, 158, 171, .45); }
.chart-node-top { display: flex; align-items: center; gap: 10px; min-height: 0; }
.chart-node-icon { flex: none; width: 38px; height: 38px; display: grid; place-items: center; border-radius: 50%; background: var(--c-soft); color: var(--c); }
.chart-node-text { flex: 1; min-width: 0; display: grid; gap: 1px; }
.chart-node-text strong { display: -webkit-box; overflow: hidden; color: var(--admin-heading); font-size: 13.5px; font-weight: 700; line-height: 1.25; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.chart-node-text small { overflow: hidden; color: var(--admin-muted); font-size: 10.5px; font-weight: 600; letter-spacing: .04em; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }
/* İşlem çubuğu: eşit aralıklı ince ikonlar; alttaki boşluk "+" düğmesine (simgelerin üstüne binmesin) */
.chart-node-actions { display: flex; justify-content: space-evenly; align-items: center; padding: 5px 4px 15px; border-top: 1px solid rgba(145, 158, 171, .18); }
.chart-node-actions button { width: 32px; height: 28px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 8px; background: transparent; color: #637381; cursor: pointer; transition: background .15s ease, color .15s ease; }
.chart-node-actions button:hover, .chart-node-actions button:focus-visible { background: var(--c-soft); color: var(--c); }
.chart-plus { position: absolute; bottom: -13px; left: 50%; z-index: 2; width: 26px; height: 26px; margin-left: -13px; display: grid; place-items: center; padding: 0; border: 2px solid var(--admin-card); border-radius: 50%; background: #212b36; color: #fff; cursor: pointer; box-shadow: 0 4px 10px rgba(33, 43, 54, .3); transition: background .15s ease, transform .15s ease; }
.chart-plus:hover, .chart-plus:focus-visible { transform: scale(1.08); }
.chart-plus:hover, .chart-plus:focus-visible { background: var(--c); }
:global(.dark-theme) .chart-node-actions button { color: #919eab; }
.chart-group.target .chart-node { box-shadow: 0 0 0 3px var(--pk-success-main), 0 8px 16px rgba(0, 171, 85, .25); }
.chart-location { width: 230px; min-height: 54px; display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 12px; background: var(--pk-success-lighter); color: var(--pk-success-darker); }
.chart-location > i { color: var(--pk-success-dark); }
.chart-location span { min-width: 0; display: grid; }
.chart-location strong { display: -webkit-box; overflow: hidden; font-size: 12.5px; font-weight: 700; line-height: 1.3; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.chart-location small { color: var(--pk-success-dark); font-size: 11px; }
.chart-location:hover { box-shadow: 0 0 0 2px rgba(0, 171, 85, .35); }
.chart-location.on { background: var(--pk-accent); color: var(--pk-on-accent); box-shadow: 0 8px 16px rgba(var(--pk-accent-rgb), .24); }
.chart-location.on > i, .chart-location.on small { color: var(--pk-on-accent); }
:global(.dark-theme) .chart-location:not(.on) { background: rgba(0, 171, 85, .14); color: var(--admin-heading); }
.chart-summary { position: relative; z-index: 1; width: 300px; height: 48px; margin-top: 22px; display: flex; align-items: center; gap: 10px; padding: 0 14px; border: 0; border-radius: 12px; background: var(--pk-success-lighter); color: var(--pk-success-darker); font: inherit; cursor: pointer; }
.chart-summary strong { font-size: 13px; font-weight: 700; }
.chart-summary span { margin-left: auto; color: var(--pk-success-dark); font-size: 12px; font-weight: 600; }
.chart-summary .pi-angle-right { color: var(--pk-success-dark); }
.chart-summary:hover { box-shadow: 0 0 0 2px rgba(0, 171, 85, .35); }
.chart-summary.on { background: var(--pk-accent); color: var(--pk-on-accent); box-shadow: 0 8px 16px rgba(var(--pk-accent-rgb), .24); }
.chart-summary.on span, .chart-summary.on .pi { color: var(--pk-on-accent); }
.chart-hint { position: absolute; right: 12px; bottom: 10px; margin: 0; padding: 5px 10px; border-radius: 8px; background: var(--admin-card); box-shadow: var(--pk-card-shadow); color: var(--admin-muted); font-size: 12px; }
@media (max-width: 800px) { .org-chart { height: 440px; } .chart-hint { display: none; } }
</style>
