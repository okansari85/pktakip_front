<template>
  <div class="controls">
    <!-- Önizleme haritadaki gibi fareyle gezer; tıklama alttaki karta geçer ve detay açılır. Klavyede kartın altında sabit durur. Dokunmatikte kart doğrudan detaya gider. -->
    <div class="cards-wrap" @focusout="onFocusOut" @keydown.esc="active = null">
      <div class="cards">
        <NuxtLink
          v-for="key in CONTROL_BUCKET_KEYS" :key="key" :to="`/expert/kontroller/${key}`" class="bucket" :class="[CONTROL_BUCKETS[key].tone, { active: active === key }]"
          :aria-expanded="active === key" @mousemove="follow($event, key)" @mouseleave="active = null" @focus="onFocus($event, key)"
        >
          <span class="bucket-icon"><PkIcon :class="CONTROL_BUCKETS[key].icon" /></span>
          <span class="bucket-text"><small>{{ CONTROL_BUCKETS[key].label }}</small><strong>{{ counts[key] }} <em>kontrol</em></strong></span>
          <PkIcon class="pi pi-angle-right" />
        </NuxtLink>
      </div>

      <section v-if="active" ref="popover" class="popover" :class="[popoverSide, { following: pos }]" :style="pos || undefined" role="group" :aria-label="CONTROL_BUCKETS[active].title">
        <header><h3>{{ CONTROL_BUCKETS[active].title }} ({{ counts[active] }})</h3><NuxtLink v-if="!pos" :to="`/expert/kontroller/${active}`">Tümünü Gör <PkIcon class="pi pi-arrow-right" /></NuxtLink></header>
        <ExpertControlRowsTable :rows="previewRows" empty="Bu aralıkta kontrol yok." @select="date = $event" />
        <p v-if="counts[active] > previewRows.length" class="popover-note"><PkIcon class="pi pi-info-circle" /> Bu listede en fazla 3 kayıt gösterilir. Tüm kayıtlar için {{ pos ? 'karta' : '"Tümünü Gör"e' }} tıklayın.</p>
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
                <td class="go"><PkIcon class="pi pi-angle-right" /></td>
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

const popover = ref<HTMLElement | null>(null)
const pos = ref<{ left: string; top: string } | null>(null)
async function follow(event: MouseEvent, key: ControlBucket) {
  const { clientX: x, clientY: y } = event
  if (active.value !== key) {
    active.value = key
    await nextTick()
  }
  const box = popover.value
  if (!box) return
  // İmlecin sağ altında durur; ekrana sığmazsa içeri çekilir ya da imlecin üstüne geçer.
  const below = y + 14 + box.offsetHeight <= window.innerHeight - 8
  pos.value = {
    left: `${Math.max(8, Math.min(x + 14, window.innerWidth - box.offsetWidth - 8))}px`,
    top: `${Math.max(8, below ? y + 14 : y - 14 - box.offsetHeight)}px`
  }
}
// Fareyle tıklamada da odak gelir; yalnız klavye odağı sabit pencereyi açar.
function onFocus(event: FocusEvent, key: ControlBucket) {
  if (!(event.target as HTMLElement).matches(':focus-visible')) return
  pos.value = null
  active.value = key
}
function onFocusOut(event: FocusEvent) {
  if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) active.value = null
}

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
.bucket { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border: 1px solid transparent; border-radius: var(--pk-radius); color: var(--admin-heading); transition: box-shadow .15s ease, border-color .15s ease; }
.bucket > .pi { margin-left: auto; }
.bucket.active, .bucket:focus-visible { outline: 0; box-shadow: 0 0 2px rgba(145, 158, 171, .2), 0 20px 40px -4px rgba(145, 158, 171, .24); }
.bucket-icon { flex: none; width: 42px; height: 42px; display: grid; place-items: center; border-radius: 50%; font-size: 17px; background: rgba(255, 255, 255, .55); }
.bucket-text { display: grid; gap: 1px; min-width: 0; }
.bucket-text small { font-size: 12.5px; font-weight: 700; }
.bucket-text strong { font-size: 24px; font-weight: 700; line-height: 1.1; }
.bucket-text em { color: var(--admin-muted); font-size: 12.5px; font-style: normal; font-weight: 500; }
.blue { background: var(--pk-info-lighter); } .blue .bucket-text small, .blue .bucket-icon { color: var(--pk-info-dark); } .blue.active { border-color: var(--pk-info); }
.amber { background: var(--pk-warning-lighter); } .amber .bucket-text small, .amber .bucket-icon { color: var(--pk-warning-dark); } .amber.active { border-color: var(--pk-warning); }
.slate { background: rgba(145, 158, 171, .16); } .slate .bucket-text small, .slate .bucket-icon { color: var(--admin-text); } .slate.active { border-color: var(--admin-muted); }
.red { background: var(--pk-error-lighter); } .red .bucket-text small, .red .bucket-icon { color: var(--pk-error-dark); } .red.active { border-color: var(--pk-error); }
:global(.dark-theme) .bucket { background: var(--admin-card); box-shadow: var(--pk-card-shadow); }
:global(.dark-theme) .bucket-icon { background: rgba(145, 158, 171, .12); }
:global(.dark-theme) .blue .bucket-text small, :global(.dark-theme) .blue .bucket-icon { color: var(--pk-info-light); }
:global(.dark-theme) .amber .bucket-text small, :global(.dark-theme) .amber .bucket-icon { color: var(--pk-warning-light); }
:global(.dark-theme) .red .bucket-text small, :global(.dark-theme) .red .bucket-icon { color: var(--pk-error-light); }
.popover { position: absolute; top: calc(100% + 8px); z-index: 30; width: min(760px, 100%); padding: 12px 16px; border: 0; border-radius: var(--pk-radius); background: var(--admin-card); box-shadow: 0 24px 48px -8px var(--admin-shadow); }
.popover.left { left: 0; } .popover.right { right: 0; }
.popover.following { position: fixed; right: auto; width: min(760px, calc(100vw - 16px)); pointer-events: none; }
.popover :deep(th), .popover :deep(td) { padding-top: 4px; padding-bottom: 4px; font-size: 12.5px; }
.popover header { margin-bottom: 6px; }
.popover-note { display: flex; align-items: center; gap: 8px; margin: 6px 0 0; padding: 4px 8px; border-radius: 8px; background: var(--admin-soft); color: var(--admin-muted); font-size: 12px; }
.tables { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.card { min-width: 0; padding: 14px 0 8px; border: 0; border-radius: var(--pk-radius); background: var(--admin-card); box-shadow: var(--pk-card-shadow); overflow: hidden; }
.card > header { padding: 0 20px; }
header { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 8px; }
h3 { margin: 0; color: var(--admin-heading); font-size: 17px; font-weight: 700; }
header a { flex: none; color: var(--admin-link); font-size: 13px; font-weight: 700; }
.table-wrap { position: relative; overflow-x: auto; }
table { width: 100%; min-width: 430px; border-collapse: collapse; }
th { padding: 8px 16px; background: rgba(145, 158, 171, .08); color: var(--admin-muted); font-size: 13px; font-weight: 600; text-align: left; white-space: nowrap; }
td { padding: 8px 16px; border-top: 1px solid rgba(145, 158, 171, .2); color: var(--admin-heading); font-size: 13px; }
tbody tr[tabindex] { cursor: pointer; }
tbody tr[tabindex]:hover, tbody tr[tabindex]:focus-visible { outline: 0; background: var(--admin-accent-soft); }
.nowrap { white-space: nowrap; } .end { text-align: right; } .go { width: 24px; color: var(--admin-muted); }
.days { color: var(--admin-danger-text); font-weight: 600; }
.empty { padding: 18px 8px; color: var(--admin-muted); text-align: center; }
.tag { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 700; white-space: nowrap; }
.tag.new { background: var(--admin-success-bg); color: var(--admin-success-text); } .tag.blue, .tag.amber { background: var(--admin-danger-bg); color: var(--admin-danger-text); } .tag.slate { background: var(--admin-warning-bg); color: var(--admin-warning-text); } .tag.red { background: var(--pk-error-dark); color: #fff; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@media (max-width: 1150px) { .tables { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 900px) { .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 480px) { .cards { grid-template-columns: minmax(0, 1fr); } }
</style>
