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

const props = defineProps<{ nodes: FirmNode[]; activeId: number | string | null }>()

// Basit katmanlı yerleşim: yapraklar soldan sağa sırayla, üst düğüm çocuklarının ortasında; derinlik = satır.
const STEP_X = 16
const STEP_Y = 18
const M = 8
const layout = computed(() => {
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
.mini-line { fill: none; stroke: rgba(106, 31, 184, .3); stroke-width: 1.2; }
.mini-dot { fill: var(--admin-card); stroke: rgba(106, 31, 184, .55); stroke-width: 1.4; }
.mini-dot.root { fill: rgba(106, 31, 184, .35); }
.mini-dot.active { fill: var(--pk-violet); stroke: var(--admin-card); stroke-width: 1.5; }
.mini-pulse { fill: var(--pk-violet); opacity: .35; transform-box: fill-box; transform-origin: center; animation: mini-pulse 1.4s ease-out infinite; }
@keyframes mini-pulse { 0% { transform: scale(.6); opacity: .5; } 100% { transform: scale(1.8); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .mini-pulse { animation: none; opacity: .25; } }
</style>
