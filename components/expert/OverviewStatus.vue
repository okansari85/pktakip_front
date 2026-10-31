<template>
  <section class="card status-card">
    <header><h3>Periyodik Kontrol Durumu</h3><small>{{ scope }}</small></header>
    <div v-for="block in blocks" :key="block.title" class="status-block">
      <div class="donut" :style="{ background: block.gradient }" role="img" :aria-label="`${block.title}: ${block.total}`">
        <div class="donut-center"><small>{{ block.title }}</small><strong>{{ number(block.total) }}</strong></div>
      </div>
      <ul>
        <li v-for="row in block.rows" :key="row.label">
          <i :style="{ background: row.color }" />
          <span>{{ row.label }}</span>
          <strong>{{ number(row.count) }}</strong>
          <em>%{{ row.percent }}</em>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
// Ekipman ve tesisatların kontrol tarihi durumu. "Güncel": kontrol zamanına 60 günden çok var. Grafik kütüphanesi gerekmez.
const props = defineProps<{ timing: Record<string, number>; installations: { days_left?: number | null }[]; scope: string }>()
const SLICES = [
  { key: 'ok', label: 'Kontrolü güncel', color: '#12805c' },
  { key: 'soon', label: 'Kontrol zamanı yaklaşan', color: '#f5b800' },
  { key: 'overdue', label: 'Kontrol süresi geçen', color: '#d92d20' },
  { key: 'none', label: 'PK tarihi girilmemiş', color: '#a8b3c2' }
] as const
const number = (value: number) => new Intl.NumberFormat('tr-TR').format(value)

function build(title: string, counts: Record<(typeof SLICES)[number]['key'], number>) {
  const total = SLICES.reduce((sum, slice) => sum + counts[slice.key], 0)
  let start = 0
  const stops = SLICES.map((slice) => {
    const end = start + (total ? (counts[slice.key] / total) * 100 : 0)
    const stop = `${slice.color} ${start}% ${end}%`
    start = end
    return stop
  })
  return {
    title, total,
    gradient: total ? `conic-gradient(${stops.join(', ')})` : 'conic-gradient(var(--admin-border) 0 100%)',
    rows: SLICES.map(slice => ({ label: slice.label, color: slice.color, count: counts[slice.key], percent: total ? Math.round((counts[slice.key] / total) * 100) : 0 }))
  }
}

const blocks = computed(() => {
  const t = props.timing || {}
  const equipment = { ok: t.later || 0, soon: (t.d30 || 0) + (t.d60 || 0), overdue: t.overdue || 0, none: t.none || 0 }
  const installation = { ok: 0, soon: 0, overdue: 0, none: 0 }
  for (const item of props.installations || []) {
    const days = item.days_left
    if (days === null || days === undefined) installation.none++
    else if (days < 0) installation.overdue++
    else if (days <= 60) installation.soon++
    else installation.ok++
  }
  return [build('Ekipmanlar', equipment), build('Tesisatlar', installation)]
})
</script>

<style scoped>
.status-card { min-width: 0; padding: 16px; border: 1px solid var(--admin-border); border-radius: 12px; background: var(--admin-card); }
header { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-bottom: 12px; }
h3 { margin: 0; color: var(--admin-heading); font-size: 15.5px; }
header small { color: var(--admin-muted); font-size: 11.5px; }
.status-block { display: flex; align-items: center; gap: 18px; padding: 12px 0; }
.status-block + .status-block { border-top: 1px solid var(--admin-border); }
.donut { flex: none; width: 118px; height: 118px; display: grid; place-items: center; border-radius: 50%; }
.donut-center { width: 76px; height: 76px; display: grid; place-content: center; border-radius: 50%; background: var(--admin-card); text-align: center; }
.donut-center small { color: var(--admin-muted); font-size: 10.5px; }
.donut-center strong { color: var(--admin-heading); font-size: 18px; }
ul { flex: 1; min-width: 0; display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
li { display: grid; grid-template-columns: 10px minmax(0, 1fr) auto 38px; align-items: center; gap: 8px; color: var(--admin-heading); font-size: 12.5px; }
li i { width: 10px; height: 10px; border-radius: 50%; }
li em { color: var(--admin-muted); font-style: normal; text-align: right; }
@media (max-width: 480px) { .status-block { flex-direction: column; align-items: stretch; } .donut { align-self: center; } }
</style>
