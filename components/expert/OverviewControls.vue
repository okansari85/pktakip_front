<template>
  <div class="controls">
    <div class="cards">
      <NuxtLink
        v-for="key in CONTROL_BUCKET_KEYS" :key="key" :to="`/expert/kontroller/${key}`" class="bucket" :class="[CONTROL_BUCKETS[key].tone, { active: active === key }]"
        @mouseenter="active = key" @focus="active = key"
      >
        <span class="bucket-icon"><i :class="CONTROL_BUCKETS[key].icon" /></span>
        <span class="bucket-text"><small>{{ CONTROL_BUCKETS[key].label }}</small><strong>{{ counts[key] }} <em>kontrol</em></strong></span>
        <i class="pi pi-angle-right" />
      </NuxtLink>
    </div>

    <div class="tables">
      <section class="card">
        <header><h3>{{ CONTROL_BUCKETS[active].title }} ({{ counts[active] }})</h3><NuxtLink :to="`/expert/kontroller/${active}`">Tümünü Gör <i class="pi pi-arrow-right" /></NuxtLink></header>
        <ExpertControlRowsTable :rows="previewRows" empty="Bu aralıkta kontrol yok." compact @select="date = $event" />
      </section>
      <section class="card">
        <header><h3>Dikkat Gerektiren Kontroller</h3><NuxtLink to="/expert/kontroller/suresi-gecen">Tümünü Gör <i class="pi pi-arrow-right" /></NuxtLink></header>
        <ExpertControlRowsTable :rows="attentionRows" empty="Dikkat gerektiren kontrol yok." compact @select="date = $event" />
      </section>
    </div>
    <ExpertControlDayModal v-if="date" :date="date" :entries="entriesOn(date)" :query="query" @close="date = null" />
  </div>
</template>

<script setup lang="ts">
import { CONTROL_BUCKETS, CONTROL_BUCKET_KEYS, controlRows, rowsOf, type ControlBucket } from '~/composables/useControlBuckets'
import type { WorkplaceGroup } from '~/composables/useWorkplaceContext'

const props = defineProps<{ agenda: any[]; groups: WorkplaceGroup[]; query: Record<string, any> }>()
const active = ref<ControlBucket>('bugun')
const date = ref<string | null>(null)
const rows = computed(() => controlRows(props.agenda, props.groups))
const byBucket = computed(() => Object.fromEntries(CONTROL_BUCKET_KEYS.map(key => [key, rowsOf(rows.value, key)])) as Record<ControlBucket, ReturnType<typeof rowsOf>>)
const counts = computed(() => Object.fromEntries(CONTROL_BUCKET_KEYS.map(key => [key, byBucket.value[key].length])) as Record<ControlBucket, number>)
const previewRows = computed(() => byBucket.value[active.value].slice(0, 3))
// Önce süresi geçenler, sonra bugün ve 7 gün içi.
const attentionRows = computed(() => [...byBucket.value['suresi-gecen'], ...byBucket.value.bugun, ...byBucket.value['7-gun']].slice(0, 3))
const entriesOn = (value: string) => props.agenda.filter(entry => entry.date === value)
</script>

<style scoped>
.controls { display: grid; gap: 16px; margin-bottom: 18px; }
.cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.bucket { display: flex; align-items: center; gap: 12px; padding: 14px; border: 1px solid transparent; border-radius: 12px; color: var(--admin-heading); transition: .15s ease; }
.bucket > .pi { margin-left: auto; }
.bucket.active, .bucket:hover, .bucket:focus-visible { outline: 0; box-shadow: 0 8px 20px var(--admin-shadow); }
.bucket-icon { flex: none; width: 42px; height: 42px; display: grid; place-items: center; border-radius: 10px; font-size: 19px; background: rgba(255, 255, 255, .7); }
.bucket-text { display: grid; gap: 1px; min-width: 0; }
.bucket-text small { font-size: 12.5px; font-weight: 700; }
.bucket-text strong { font-size: 25px; line-height: 1.1; }
.bucket-text em { color: var(--admin-muted); font-size: 12.5px; font-style: normal; font-weight: 500; }
.blue { background: #eaf3ff; border-color: #b2ddff; } .blue .bucket-text small, .blue .bucket-icon { color: #175cd3; }
.amber { background: #fff8e6; border-color: #fedf89; } .amber .bucket-text small, .amber .bucket-icon { color: #b54708; }
.slate { background: #eef2f6; border-color: #cdd5df; } .slate .bucket-text small, .slate .bucket-icon { color: #364152; }
.red { background: #fef3f2; border-color: #fecdca; } .red .bucket-text small, .red .bucket-icon { color: #b42318; }
:global(html.dark) .bucket { color: #111827; }
.tables { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.card { min-width: 0; padding: 14px; border: 1px solid var(--admin-border); border-radius: 12px; background: var(--admin-card); }
header { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 10px; }
h3 { margin: 0; color: var(--admin-heading); font-size: 14.5px; }
header a { flex: none; color: #175cd3; font-size: 12.5px; font-weight: 700; }
@media (max-width: 1150px) { .tables { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 900px) { .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 480px) { .cards { grid-template-columns: minmax(0, 1fr); } }
</style>
