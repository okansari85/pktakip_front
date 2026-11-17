<template>
  <!-- Şemanın küçük hâli: her dal bir nokta; bulunulan dal yanıp söner (konum göstergesi). -->
  <svg class="mini-tree" :viewBox="`0 0 ${box.width} ${box.height}`" role="img" :aria-label="`Şemadaki yeri: ${activeName}`">
    <path v-for="line in lines" :key="line.key" :d="line.d" class="mini-line" />
    <g v-for="dot in dots" :key="dot.id">
      <circle v-if="dot.active" :cx="dot.x" :cy="dot.y" r="7" class="mini-pulse" />
      <circle :cx="dot.x" :cy="dot.y" :r="dot.active ? 4.5 : dot.root ? 4 : 3" class="mini-dot" :class="{ active: dot.active, root: dot.root }" />
    </g>
  </svg>
</template>

<script setup lang="ts">
import type { FirmNode } from '~/composables/useFirmSetup'

const props = defineProps<{ nodes: FirmNode[]; activeId: number | string | null; positions?: Record<string, { x: number; y: number }> }>()

// Basit katmanlı yerleşim: yapraklar soldan sağa sırayla, üst düğüm çocuklarının ortasında; derinlik = satır.
const STEP_X = 16
const STEP_Y = 18
const M = 8
const W = 140
const H = 64
// Büyük şemanın yerleşimi (OrgChart'tan): noktalar aynı yerde, kutuya sığacak biçimde ölçeklenir.
const fromChart = computed(() => {
  const pos = props.positions
  if (!pos || !Object.keys(pos).length) return null
  const all = Object.values(pos)
  const minX = Math.min(...all.map(p => p.x)); const maxX = Math.max(...all.map(p => p.x))
  const minY = Math.min(...all.map(p => p.y)); const maxY = Math.max(...all.map(p => p.y))
  const scale = Math.min((W - 2 * M) / ((maxX - minX) || 1), (H - 2 * M) / ((maxY - minY) || 1))
  const ox = (W - (maxX - minX) * scale) / 2
  const oy = (H - (maxY - minY) * scale) / 2
  const at = (id: string | number) => { const p = pos[String(id)]; return p ? { x: ox + (p.x - minX) * scale, y: oy + (p.y - minY) * scale } : null }
  const dots: { id: string; x: number; y: number; active: boolean; root: boolean; name: string }[] = []
  const lines: { key: string; d: string }[] = []
  const walk = (node: FirmNode, depth: number) => {
    const a = at(node.id)
    if (!a) return
    dots.push({ id: String(node.id), ...a, active: String(node.id) === String(props.activeId), root: depth === 0, name: node.name })
    for (const child of node.children || []) {
      const b = at(child.id)
      if (b) { const mid = (a.y + b.y) / 2; lines.push({ key: `${node.id}-${child.id}`, d: `M${a.x},${a.y} V${mid} H${b.x} V${b.y}` }) }
      walk(child, depth + 1)
    }
  }
  props.nodes.forEach(node => walk(node, 0))
  return { dots, lines, box: { width: W, height: H } }
})
const layout = computed(() => fromChart.value || simple.value)
const simple = computed(() => {
  const dots: { id: string; x: number; y: number; active: boolean; root: boolean; name: string }[] = []
  const lines: { key: string; d: string }[] = []
  let leaf = 0
  const place = (node: FirmNode, depth: number): number => {
    const kids = node.children || []
    const xs = kids.map(child => place(child, depth + 1))
    const x = xs.length ? (xs[0] + xs[xs.length - 1]) / 2 : M + leaf++ * STEP_X
    const y = M + depth * STEP_Y
    dots.push({ id: String(node.id), x, y, active: String(node.id) === String(props.activeId), root: depth === 0, name: node.name })
    kids.forEach((child, i) => lines.push({ key: `${node.id}-${child.id}`, d: `M${x},${y} V${y + STEP_Y / 2} H${xs[i]} V${y + STEP_Y}` }))
    return x
  }
  props.nodes.forEach(node => place(node, 0))
  const width = Math.max(...dots.map(d => d.x), 0) + M
  const height = Math.max(...dots.map(d => d.y), 0) + M
  return { dots, lines, box: { width: Math.max(width, 2 * M), height: Math.max(height, 2 * M) } }
})
const dots = computed(() => layout.value.dots)
const lines = computed(() => layout.value.lines)
const box = computed(() => layout.value.box)
const activeName = computed(() => dots.value.find(d => d.active)?.name || '')
</script>

<style scoped>
.mini-tree { width: 140px; height: 64px; flex: none; }
.mini-line { fill: none; stroke: rgba(145, 158, 171, .7); stroke-width: 1.2; }
.mini-dot { fill: var(--admin-card); stroke: rgba(99, 115, 129, .7); stroke-width: 1.4; }
.mini-dot.root { fill: rgba(0, 71, 255, .35); stroke: rgba(0, 71, 255, .6); }
.mini-dot.active { fill: var(--pk-violet); stroke: var(--admin-card); stroke-width: 1.5; }
.mini-pulse { fill: var(--pk-violet); opacity: .35; transform-box: fill-box; transform-origin: center; animation: mini-pulse 1.4s ease-out infinite; }
@keyframes mini-pulse { 0% { transform: scale(.6); opacity: .5; } 100% { transform: scale(1.8); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .mini-pulse { animation: none; opacity: .25; } }
</style>
