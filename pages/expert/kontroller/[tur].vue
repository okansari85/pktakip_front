<template>
  <div class="control-page">
    <nav class="crumbs" aria-label="Sayfa yolu">
      <NuxtLink to="/expert"><i class="pi pi-home" /> Genel Bakış</NuxtLink><i class="pi pi-angle-right" /><span>{{ bucket.title }}</span>
    </nav>
    <h1>{{ bucket.title }} <template v-if="!loading">({{ filtered.length }})</template></h1>

    <div v-if="rows.length" class="notice" :class="bucket.tone"><i :class="bucket.icon" /><span>{{ bucket.message }}</span></div>

    <div class="filters">
      <label>Firma
        <select v-model="firm"><option value="">Tüm Firmalar</option><option v-for="name in firms" :key="name" :value="name">{{ name }}</option></select>
      </label>
      <label>Tür
        <select v-model="kind"><option value="">Tümü</option><option value="Ekipman">Ekipman</option><option value="Tesisat">Tesisat</option></select>
      </label>
      <label class="search"><span class="sr-only">Ara</span><i class="pi pi-search" /><input v-model="search" type="text" placeholder="Ekipman veya tesisat adı ile ara..." /></label>
    </div>

    <section class="card">
      <div v-if="loading" class="state"><i class="pi pi-spin pi-spinner" /> Yükleniyor...</div>
      <div v-else-if="error" class="state error">{{ error }}<button class="retry" type="button" @click="loadData">Tekrar Dene</button></div>
      <template v-else>
        <ExpertControlRowsTable :rows="paged" :empty="rows.length ? 'Seçiminizle eşleşen kontrol yok.' : 'Bu aralıkta kontrol yok.'" @select="date = $event" />
        <footer v-if="filtered.length">
          <span>Toplam {{ filtered.length }} kayıt</span>
          <div v-if="pageCount > 1" class="pager">
            <button type="button" aria-label="Önceki sayfa" :disabled="page <= 1" @click="page--"><i class="pi pi-angle-left" /></button>
            <span>{{ page }} / {{ pageCount }}</span>
            <button type="button" aria-label="Sonraki sayfa" :disabled="page >= pageCount" @click="page++"><i class="pi pi-angle-right" /></button>
          </div>
        </footer>
      </template>
    </section>
    <ExpertControlDayModal v-if="date" :date="date" :entries="entriesOn(date)" :query="query" @close="date = null" />
  </div>
</template>

<script setup lang="ts">
// Genel Bakış kartlarının detayı: Bugün, 7 gün, 8-30 gün, süresi geçen. Kapsam üstteki firma / lokasyon seçicisinden.
import { CONTROL_BUCKETS, controlRows, rowsOf, type ControlBucket } from '~/composables/useControlBuckets'

definePageMeta({ layout: 'expert', middleware: 'expert', dashboardScope: true })

const route = useRoute()
const key = computed(() => (String(route.params.tur) in CONTROL_BUCKETS ? String(route.params.tur) : 'bugun') as ControlBucket)
const bucket = computed(() => CONTROL_BUCKETS[key.value])
const { get, errorMessage } = useExpertApi()
const { groups, load, query } = useDashboardScope()

const agenda = ref<any[]>([])
const loading = ref(true)
const error = ref('')
const firm = ref('')
const kind = ref('')
const search = ref('')
const page = ref(1)
const date = ref<string | null>(null)
const PAGE_SIZE = 10

const rows = computed(() => rowsOf(controlRows(agenda.value, groups.value), key.value))
const firms = computed(() => [...new Set(rows.value.map(r => r.firm).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')))
const filtered = computed(() => {
  const q = search.value.trim().toLocaleLowerCase('tr-TR')
  return rows.value.filter(r => (!firm.value || r.firm === firm.value) && (!kind.value || r.kind === kind.value) && (!q || r.item.toLocaleLowerCase('tr-TR').includes(q)))
})
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const paged = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
watch([firm, kind, search], () => { page.value = 1 })
watch(pageCount, (count) => { if (page.value > count) page.value = count })
const entriesOn = (value: string) => agenda.value.filter(entry => entry.date === value)

let requestNo = 0
async function loadData() {
  const no = ++requestNo
  error.value = ''
  loading.value = true
  try {
    if (!groups.value.length) { agenda.value = []; return }
    const data = await get<any>('/pk-dashboard', query.value)
    if (no === requestNo) agenda.value = data?.agenda || []
  } catch (e: any) {
    if (no === requestNo) error.value = errorMessage(e, 'Kontroller alınamadı.')
  } finally { if (no === requestNo) loading.value = false }
}
watch(query, loadData, { deep: true })
onMounted(async () => { await load(); loadData() })
</script>

<style scoped>
.control-page { max-width: 1200px; margin: 0 auto; }
.crumbs { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; color: var(--admin-muted); font-size: 12.5px; }
.crumbs a:hover { color: var(--admin-heading); }
h1 { margin: 0 0 14px; color: var(--admin-heading); font-size: 28px; letter-spacing: -.6px; }
.notice { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding: 12px 14px; border: 1px solid; border-radius: 10px; font-size: 13.5px; }
.notice > i { font-size: 18px; }
.notice.blue, .notice.red { background: #fef3f2; border-color: #fecdca; color: #b42318; }
.notice.amber { background: #fef3f2; border-color: #fecdca; color: #b42318; }
.notice.slate { background: #fffaeb; border-color: #fedf89; color: #93370d; }
.filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; margin-bottom: 14px; }
.filters label { display: block; color: var(--admin-heading); font-size: 12.5px; font-weight: 700; }
select, input { display: block; min-height: 42px; margin-top: 5px; padding: 0 12px; border: 1px solid var(--admin-border); border-radius: 9px; outline: 0; background: var(--admin-input); color: var(--admin-heading); font: inherit; font-size: 13.5px; font-weight: 400; }
select { min-width: 190px; }
select:focus, input:focus { border-color: #d7a900; }
.search { position: relative; flex: 1; min-width: 220px; max-width: 420px; margin-left: auto; }
.search input { width: 100%; margin-top: 0; padding-left: 36px; }
.search i { position: absolute; left: 13px; top: 14px; color: var(--admin-muted); z-index: 1; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.card { padding: 12px; border: 1px solid var(--admin-border); border-radius: 12px; background: var(--admin-card); }
.state { padding: 34px 16px; color: var(--admin-muted); text-align: center; font-size: 14px; }
.state.error { display: grid; justify-items: center; gap: 10px; color: #b42318; }
.retry { min-height: 38px; padding: 0 14px; border: 1px solid var(--admin-border); border-radius: 8px; background: var(--admin-input); color: var(--admin-heading); font: inherit; font-weight: 700; cursor: pointer; }
footer { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; padding: 12px 4px 2px; color: var(--admin-muted); font-size: 13px; }
.pager { display: flex; align-items: center; gap: 10px; }
.pager button { width: 36px; height: 36px; border: 1px solid var(--admin-border); border-radius: 8px; background: var(--admin-input); color: var(--admin-heading); cursor: pointer; }
.pager button:disabled { opacity: .45; cursor: default; }
@media (max-width: 560px) { select { width: 100%; } .filters label { flex: 1 1 100%; } .search { margin-left: 0; max-width: none; } h1 { font-size: 23px; } }
</style>
