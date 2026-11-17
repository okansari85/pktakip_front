<template>
  <!-- Ana firma şeması (Vue Flow + dagre): kök → dallar / birimler → lokasyonlar, yukarıdan aşağı otomatik yerleşim.
       Yakınlaştır / kaydır; düzenleme yetkisi varsa lokasyon ya da dal tutulup başka bir dalın üstüne bırakılınca taşınır. -->
  <div class="org-chart" :class="{ dragging: !!dragId }">
    <VueFlow
      :id="flowId"
      :nodes="flowNodes"
      :edges="flowEdges"
      :nodes-draggable="canEdit"
      :nodes-connectable="false"
      :elements-selectable="false"
      :zoom-on-double-click="false"
      :min-zoom="0.3"
      :max-zoom="1.6"
      :default-edge-options="{ type: 'smoothstep' }"
      @nodes-initialized="fit"
      @node-click="onNodeClick"
      @node-drag-start="onDragStart"
      @node-drag="onDrag"
      @node-drag-stop="onDragStop"
    >
      <Background pattern-color="rgba(145, 158, 171, .35)" :gap="16" />
      <Controls :show-interactive="false" position="bottom-left" />

      <template #node-org="{ id, data }">
        <div class="chart-node" :class="{ root: data.root, on: selectedKey === id, target: dropId === id }">
          <Handle type="target" :position="Position.Top" class="handle" />
          <span class="chart-node-icon"><i :class="data.root ? 'pi pi-building' : 'pi pi-sitemap'" aria-hidden="true" /></span>
          <span class="chart-node-text"><strong>{{ data.name }}</strong><small v-if="data.label">{{ data.label }}</small></span>
          <span v-if="canEdit" class="chart-node-actions nodrag">
            <button v-if="canBranch" type="button" class="chart-add" :aria-label="`${data.name} altına ${branchLabel.toLocaleLowerCase('tr-TR')} ekle`" @click.stop="emit('add-branch', data.nodeId)"><i class="pi pi-plus" /> {{ branchLabel }}</button>
            <button type="button" class="chart-add" :aria-label="`${data.name} altına lokasyon ekle`" @click.stop="emit('add-location', data.nodeId)"><i class="pi pi-plus" /> Lokasyon</button>
          </span>
          <Handle type="source" :position="Position.Bottom" class="handle" />
        </div>
      </template>

      <template #node-loc="{ id, data }">
        <div class="chart-location" :class="{ on: selectedKey === id, target: dragId !== id && inDropArea(data) }">
          <Handle type="target" :position="Position.Top" class="handle" />
          <i class="pi pi-map-marker" aria-hidden="true" />
          <span><strong>{{ data.name }}</strong><small>{{ data.count ? `${data.count} işyeri` : 'İşyeri yok' }}<template v-if="data.city"> · {{ data.city }}</template></small></span>
        </div>
      </template>
    </VueFlow>
    <p v-if="canEdit" class="chart-hint"><i class="pi pi-arrows-alt" aria-hidden="true" /> Lokasyonu ya da {{ branchLabel.toLocaleLowerCase('tr-TR') }}ı tutup başka bir {{ branchLabel.toLocaleLowerCase('tr-TR') }}ın üstüne bırakarak taşıyabilirsiniz.</p>
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
const { getIntersectingNodes, fitView } = useVueFlow(flowId)
// Kutular ölçüldükten sonra (ilk açılış ve her yeniden yerleşim) şema alana sığdırılır; çok büyütülmez.
const fit = () => nextTick(() => setTimeout(() => fitView({ padding: 0.12, maxZoom: 1, duration: 150 }), 60))

const SIZE = { org: { width: 300, height: 58 }, loc: { width: 230, height: 54 } }
const flowNodes = ref<Node[]>([])
const flowEdges = ref<Edge[]>([])
// Düğüm → üst düğüm (döngü kontrolü için) ve lokasyon → bağlı düğüm.
const parentOf = new Map<string, string | null>()

function layout() {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 28, ranksep: 64, marginx: 16, marginy: 16 })
  g.setDefaultEdgeLabel(() => ({}))
  const nodes: Node[] = []
  const edges: Edge[] = []
  parentOf.clear()
  const walk = (node: FirmNode, parent: FirmNode | null) => {
    const id = `n${node.id}`
    parentOf.set(id, parent ? `n${parent.id}` : null)
    g.setNode(id, { ...SIZE.org }) // dagre konumu bu nesneye yazar: her kutuya ayrı kopya
    nodes.push({ id, type: 'org', position: { x: 0, y: 0 }, draggable: props.canEdit && !!parent, data: { nodeId: node.id, name: node.name, label: props.labels[String(node.id)] || '', root: !parent } })
    if (parent) { g.setEdge(`n${parent.id}`, id); edges.push({ id: `e${parent.id}-${node.id}`, source: `n${parent.id}`, target: id }) }
    for (const location of props.locations.filter(l => String(l.organization_id) === String(node.id))) {
      const lid = `l${location.id}`
      g.setNode(lid, { ...SIZE.loc })
      g.setEdge(id, lid)
      nodes.push({ id: lid, type: 'loc', position: { x: 0, y: 0 }, data: { locationId: location.id, nodeId: node.id, name: location.name, city: location.city, count: props.counts[String(location.id)] || 0 } })
      edges.push({ id: `e${node.id}-l${location.id}`, source: id, target: lid, class: 'loc-edge' })
    }
    for (const child of node.children || []) walk(child, node)
  }
  props.nodes.forEach(node => walk(node, null))
  dagre.layout(g)
  flowNodes.value = nodes.map((node) => {
    const p = g.node(node.id)
    const size = SIZE[node.type as 'org' | 'loc']
    return { ...node, position: { x: p.x - size.width / 2, y: p.y - size.height / 2 } }
  })
  flowEdges.value = edges
}
watch(() => [props.nodes, props.locations, props.counts, props.labels, props.canEdit], () => { layout(); fit() }, { immediate: true, deep: true })

const onNodeClick = ({ node }: NodeMouseEvent) => emit('select', node.id)

// --- Sürükle bırak: bırakılan yerin altındaki dal hedeftir; geçersizse kutu yerine döner. ---
const dragId = ref<string | null>(null)
const dropId = ref<string | null>(null)
const isDescendant = (candidate: string, ancestor: string) => {
  for (let id: string | null | undefined = candidate; id; id = parentOf.get(id)) if (id === ancestor) return true
  return false
}
// Bırakma alanı (KSY-SIS'teki gibi): dalın kutusu ya da o dalın lokasyonlarından biri; hedef her zaman dal.
const orgOf = (other: Node) => other.type === 'org' ? other : flowNodes.value.find(n => n.id === `n${other.data.nodeId}`)
const targetFor = (node: Node) => getIntersectingNodes(node)
  .filter(other => other.id !== node.id)
  .sort((a, b) => (a.type === 'org' ? 0 : 1) - (b.type === 'org' ? 0 : 1))
  .map(orgOf)
  .find((other): other is Node => !!other && (node.type === 'loc'
    ? `n${node.data.nodeId}` !== other.id
    : other.id !== node.id && !isDescendant(other.id, node.id) && parentOf.get(node.id) !== other.id))
const onDragStart = ({ node }: NodeDragEvent) => { dragId.value = node.id }
const onDrag = ({ node }: NodeDragEvent) => { dropId.value = targetFor(node)?.id ?? null }
// Hedef dalın lokasyonları da yeşil yanar (alanın tamamı).
const inDropArea = (data: { nodeId: number | string }) => !!dropId.value && dropId.value === `n${data.nodeId}`
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
.org-chart { position: relative; height: 520px; border-radius: 12px; background: rgba(145, 158, 171, .04); overflow: hidden; }
.org-chart :deep(.vue-flow__edge-path) { stroke: rgba(145, 158, 171, .55); stroke-width: 2; }
.org-chart :deep(.vue-flow__node) { cursor: pointer; }
.org-chart :deep(.vue-flow__node.draggable) { cursor: grab; }
.org-chart.dragging :deep(.vue-flow__node.dragging) { cursor: grabbing; z-index: 10 !important; }
.org-chart :deep(.vue-flow__controls) { box-shadow: var(--pk-card-shadow); border-radius: 8px; overflow: hidden; }
.org-chart :deep(.vue-flow__controls-button) { width: 28px; height: 28px; border-bottom: 1px solid rgba(145, 158, 171, .2); background: var(--admin-card); color: var(--admin-heading); }
.handle { opacity: 0; pointer-events: none; }
.chart-node { width: 300px; min-height: 58px; display: flex; align-items: center; gap: 10px; padding: 8px 10px 8px 8px; border-radius: 12px; background: var(--admin-card); box-shadow: 0 0 0 1px rgba(145, 158, 171, .28), 0 4px 10px -4px rgba(145, 158, 171, .3); transition: box-shadow .15s ease; }
.chart-node.root { box-shadow: 0 0 0 2px rgba(var(--pk-accent-rgb), .35), 0 4px 10px -4px rgba(145, 158, 171, .3); }
.chart-node.on { box-shadow: 0 0 0 2px var(--pk-accent), 0 8px 16px rgba(var(--pk-accent-rgb), .2); }
.chart-node.target { box-shadow: 0 0 0 3px var(--pk-success-main), 0 8px 16px rgba(0, 171, 85, .25); background: var(--pk-success-lighter); }
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
.chart-location.target { box-shadow: 0 0 0 3px var(--pk-success-main); }
.chart-location.on { background: var(--pk-accent); color: var(--pk-on-accent); box-shadow: 0 8px 16px rgba(var(--pk-accent-rgb), .24); }
.chart-location.on > i, .chart-location.on small { color: var(--pk-on-accent); }
:global(.dark-theme) .chart-location:not(.on) { background: rgba(0, 171, 85, .14); color: var(--admin-heading); }
.chart-hint { position: absolute; right: 12px; bottom: 10px; margin: 0; padding: 5px 10px; border-radius: 8px; background: var(--admin-card); box-shadow: var(--pk-card-shadow); color: var(--admin-muted); font-size: 12px; }
@media (max-width: 800px) { .org-chart { height: 420px; } .chart-hint { display: none; } }
</style>
