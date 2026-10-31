<template>
  <div class="controls">
    <!-- Kartın üzerine gelince önizleme alttaki tabloların üstünde süzülür; sayfa kaymaz. Dokunmatikte kart doğrudan detaya gider. -->
    <div class="cards-wrap" @mouseleave="closeLater" @mouseenter="cancelClose" @focusout="onFocusOut" @keydown.esc="active = null">
      <div class="cards">
        <NuxtLink
          v-for="key in CONTROL_BUCKET_KEYS" :key="key" :to="`/expert/kontroller/${key}`" class="bucket" :class="[CONTROL_BUCKETS[key].tone, { active: active === key }]"
          :aria-expanded="active === key" @mouseenter="open(key)" @focus="open(key)"
        >
          <span class="bucket-icon"><i :class="CONTROL_BUCKETS[key].icon" /></span>
          <span class="bucket-text"><small>{{ CONTROL_BUCKETS[key].label }}</small><strong>{{ counts[key] }} <em>kontrol</em></strong></span>
          <i class="pi pi-angle-right" />
        </NuxtLink>
      </div>

      <section v-if="active" class="popover" :class="popoverSide" role="group" :aria-label="CONTROL_BUCKETS[active].title">
        <header><h3>{{ CONTROL_BUCKETS[active].title }} ({{ counts[active] }})</h3><NuxtLink :to="`/expert/kontroller/${active}`">Tümünü Gör <i class="pi pi-arrow-right" /></NuxtLink></header>
        <ExpertControlRowsTable :rows="previewRows" empty="Bu aralıkta kontrol yok." @select="date = $event" />
        <p v-if="counts[active] > previewRows.length" class="popover-note"><i class="pi pi-info-circle" /> Bu listede en fazla 3 kayıt gösterilir. Tüm kayıtlar için "Tümünü Gör"e tıklayın.</p>
      </section>
    </div>

    <div class="tables">
      <section class="card">
        <header><h3>Son Eklenen Kayıtlar</h3><NuxtLink to="/expert/equipment">Tümünü Gör</NuxtLink></header>
        <div class="table-wrap">
          <table>
            <thead><tr><th v-if="hasDates">Tarih</th><th>Firma / Lokasyon</th><th>Kayıt</th><th>İşlem</th><th><span class="sr-only">Aç</span></th></tr></thead>
            <tbody>
              <tr v-for="row in recentRows" :key="row.id" tabindex="0" @click="navigateTo(`/expert/equipment/${row.id}`)" @keydown.enter="navigateTo(`/expert/equipment/${row.id}`)">
                <td v-if="hasDates" class="nowrap">{{ row.date ? formatControlDate(row.date) : '—' }}</td>
                <td>{{ row.place }}</td>
                <td>{{ row.name }}</td>
                <td><span class="tag new">Yeni kayıt</span></td>
                <td class="go"><i class="pi pi-angle-right" /></td>
              </tr>
              <tr v-if="!recentRows.length"><td :colspan="hasDates ? 5 : 4" class="empty">{{ recentLoading ? 'Yükleniyor...' : 'Henüz kayıt yok.' }}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <header><h3>Dikkat Gerektiren Kontroller</h3><NuxtLink to="/expert/kontroller/suresi-gecen">Tümünü Gör</NuxtLink></header>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Firma / Lokasyon</th><th>Kayıt</th><th>Öncelik</th><th class="end"><span class="sr-only">Gün</span></th></tr></thead>
            <tbody>
              <tr v-for="row in attentionRows" :key="row.key" tabindex="0" @click="date = row.date" @keydown.enter="date = row.date">
                <td>{{ [row.firm, row.location].filter(Boolean).join(' / ') }}</td>
                <td>{{ row.item }}</td>
                <td><span class="tag" :class="priorityOf(row.days_left)?.tone">{{ priorityOf(row.days_left)?.priority }}</span></td>
                <td class="end days nowrap">{{ row.days_left === 0 ? 'Bugün' : `${Math.abs(row.days_left)} gün` }}</td>
              </tr>
              <tr v-if="!attentionRows.length"><td colspan="4" class="empty">Dikkat gerektiren kontrol yok.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
    <ExpertControlDayModal v-if="date" :date="date" :entries="entriesOn(date)" :query="query" @close="date = null" />
  </div>
</template>

<script setup lang="ts">
import { CONTROL_BUCKETS, CONTROL_BUCKET_KEYS, controlRows, formatControlDate, priorityOf, rowsOf, type ControlBucket } from '~/composables/useControlBuckets'
import type { WorkplaceGroup } from '~/composables/useWorkplaceContext'

const props = defineProps<{ agenda: any[]; groups: WorkplaceGroup[]; query: Record<string, any> }>()
const { get } = useExpertApi()
const active = ref<ControlBucket | null>(null)
const date = ref<string | null>(null)
const rows = computed(() => controlRows(props.agenda, props.groups))
const byBucket = computed(() => Object.fromEntries(CONTROL_BUCKET_KEYS.map(key => [key, rowsOf(rows.value, key)])) as Record<ControlBucket, ReturnType<typeof rowsOf>>)
const counts = computed(() => Object.fromEntries(CONTROL_BUCKET_KEYS.map(key => [key, byBucket.value[key].length])) as Record<ControlBucket, number>)
const previewRows = computed(() => active.value ? byBucket.value[active.value].slice(0, 3) : [])
// Sağdaki iki kartın penceresi sağa, soldakilerin sola yaslanır; ekrandan taşmaz.
const popoverSide = computed(() => active.value && CONTROL_BUCKET_KEYS.indexOf(active.value) > 1 ? 'right' : 'left')
// Dikkat gerektiren: süresi geçenler (en eski önce), sonra yaklaşanlar (en yakın önce).
const attentionRows = computed(() => [...byBucket.value['suresi-gecen'], ...byBucket.value.bugun, ...byBucket.value['7-gun'], ...byBucket.value['8-30-gun']].slice(0, 3))
const entriesOn = (value: string) => props.agenda.filter(entry => entry.date === value)

let closeTimer: ReturnType<typeof setTimeout> | undefined
function open(key: ControlBucket) { cancelClose(); active.value = key }
function cancelClose() { clearTimeout(closeTimer) }
// Küçük gecikme: fare karttan pencereye geçerken kapanmasın.
function closeLater() { cancelClose(); closeTimer = setTimeout(() => { active.value = null }, 180) }
function onFocusOut(event: FocusEvent) {
  if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) active.value = null
}
onBeforeUnmount(cancelClose)

// shortcut: tarih ve tesisat için backend'de "eklenme tarihi" yok; yeni kayıt ekipman numarasından bulunur ve en çok 15 lokasyon okunur. Backend aşamasında tek uca alınacak.
interface RecentRow { id: number; date: string | null; place: string; name: string }
const recentRows = ref<RecentRow[]>([])
const recentLoading = ref(true)
const hasDates = computed(() => recentRows.value.some(row => row.date))
const locationIds = computed<number[]>(() => props.query['location_ids[]'] || [])
let recentRequest = 0
async function loadRecent() {
  const no = ++recentRequest
  recentLoading.value = true
  try {
    const lists = await Promise.all(locationIds.value.slice(0, 15).map(id => get<any[]>('/pk-equipment', { location_id: id }).catch(() => [])))
    if (no !== recentRequest) return
    const firmOf = new Map(props.groups.map(g => [g.location_id, g.customer_name || '']))
    recentRows.value = lists.flat().filter(item => item.is_active !== false).sort((a, b) => b.id - a.id).slice(0, 3).map(item => ({
      id: item.id,
      date: item.created_at || null,
      place: [firmOf.get(item.location?.id), item.location?.name].filter(Boolean).join(' / '),
      name: [item.type?.name, item.variant].filter(Boolean).join(' - ')
    }))
  } finally { if (no === recentRequest) recentLoading.value = false }
}
watch(locationIds, loadRecent, { immediate: true })
</script>

<style scoped>
.controls { display: grid; gap: 12px; }
.cards-wrap { position: relative; }
.cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.bucket { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border: 1px solid transparent; border-radius: 12px; color: #111827; transition: box-shadow .15s ease, border-color .15s ease; }
.bucket > .pi { margin-left: auto; }
.bucket.active, .bucket:focus-visible { outline: 0; box-shadow: 0 8px 20px var(--admin-shadow); }
.bucket-icon { flex: none; width: 42px; height: 42px; display: grid; place-items: center; border-radius: 10px; font-size: 19px; background: rgba(255, 255, 255, .7); }
.bucket-text { display: grid; gap: 1px; min-width: 0; }
.bucket-text small { font-size: 12.5px; font-weight: 700; }
.bucket-text strong { font-size: 24px; line-height: 1.1; }
.bucket-text em { color: #475467; font-size: 12.5px; font-style: normal; font-weight: 500; }
.blue { background: #eaf3ff; border-color: #b2ddff; } .blue .bucket-text small, .blue .bucket-icon { color: #175cd3; } .blue.active { border-color: #2e90fa; }
.amber { background: #fff8e6; border-color: #fedf89; } .amber .bucket-text small, .amber .bucket-icon { color: #b54708; } .amber.active { border-color: #f79009; }
.slate { background: #eef2f6; border-color: #cdd5df; } .slate .bucket-text small, .slate .bucket-icon { color: #364152; } .slate.active { border-color: #697586; }
.red { background: #fef3f2; border-color: #fecdca; } .red .bucket-text small, .red .bucket-icon { color: #b42318; } .red.active { border-color: #d92d20; }
.popover { position: absolute; top: calc(100% + 8px); z-index: 30; width: min(760px, 100%); padding: 10px 12px; border: 1px solid var(--admin-border); border-radius: 12px; background: var(--admin-card); box-shadow: 0 18px 44px var(--admin-shadow); }
.popover.left { left: 0; } .popover.right { right: 0; }
.popover :deep(th), .popover :deep(td) { padding-top: 4px; padding-bottom: 4px; font-size: 12.5px; }
.popover header { margin-bottom: 6px; }
.popover-note { display: flex; align-items: center; gap: 8px; margin: 6px 0 0; padding: 4px 8px; border-radius: 8px; background: var(--admin-soft); color: var(--admin-muted); font-size: 12px; }
.tables { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.card { min-width: 0; padding: 11px 14px; border: 1px solid var(--admin-border); border-radius: 12px; background: var(--admin-card); }
header { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 8px; }
h3 { margin: 0; color: var(--admin-heading); font-size: 14.5px; }
header a { flex: none; color: #175cd3; font-size: 12.5px; font-weight: 700; }
.table-wrap { position: relative; overflow-x: auto; }
table { width: 100%; min-width: 430px; border-collapse: collapse; }
th { padding: 6px 8px; background: var(--admin-soft); color: var(--admin-muted); font-size: 12px; font-weight: 700; text-align: left; white-space: nowrap; }
td { padding: 6px 8px; border-top: 1px solid var(--admin-border); color: var(--admin-heading); font-size: 12.5px; }
tbody tr[tabindex] { cursor: pointer; }
tbody tr[tabindex]:hover, tbody tr[tabindex]:focus-visible { outline: 0; background: var(--admin-accent-soft); }
.nowrap { white-space: nowrap; } .end { text-align: right; } .go { width: 24px; color: var(--admin-muted); }
.days { color: #d92d20; font-weight: 600; }
.empty { padding: 18px 8px; color: var(--admin-muted); text-align: center; }
.tag { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.tag.new { background: #dcfae6; color: #067647; } .tag.blue, .tag.amber { background: #fda29b; color: #7a271a; } .tag.slate { background: #fedf89; color: #7a2e0e; } .tag.red { background: #7a271a; color: #fff; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@media (max-width: 1150px) { .tables { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 900px) { .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 480px) { .cards { grid-template-columns: minmax(0, 1fr); } }
</style>
