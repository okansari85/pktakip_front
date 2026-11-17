<template>
  <div class="findings-page" :class="{ reloading: loading && !!result }">
    <!-- Bulgu detayı (tasarım kataloğu 21) liste yerine açılır; süzgeçler, sayfa ve açık gruplar korunur -->
    <ExpertFindingPanel v-if="openId" :finding-id="openId" :responsibles="responsibles" :can-invite="isManager" @close="openId = null" @changed="onChanged" @responsibles-changed="loadResponsibles" />
    <template v-else>
    <div class="page-head">
      <!-- Ana Sayfa yalnız bireysel uzmanda var; diğer hesaplarda sayfa yolu Genel Bakış'ta başlar -->
      <nav class="crumb" aria-label="Sayfa yolu">
        <i class="pi pi-home" aria-hidden="true" />
        <NuxtLink :to="individual ? '/expert/anasayfa' : '/expert'">{{ individual ? 'Ana Sayfa' : 'Genel Bakış' }}</NuxtLink>
        <i class="pi pi-angle-right" aria-hidden="true" />
        <strong>Bulgu Takibi</strong>
      </nav>
      <h1>Bulgu takibi</h1>
      <p>Periyodik kontrol raporlarındaki düzeltici işler<template v-if="SHOW_SCOPE_LABEL"> {{ scopeLabel }}</template></p>
    </div>

    <div v-if="!groups.length && loaded" class="card state">{{ multiUser ? 'Henüz size atanmış bir işyeri yok.' : 'Henüz işyeriniz yok.' }}</div>
    <template v-else>
      <!-- Üst sıra: bulgu özeti, en çok açık bulgusu olan ekipman -->
      <div class="top">
        <section class="card summary">
          <header class="summary-head"><i class="pi pi-clone" /><h3>Bulgu özeti</h3></header>
          <!-- Sayılar: tıklayınca liste o duruma göre süzülür, tekrar tıklayınca kalkar -->
          <div class="summary-counts">
            <button v-for="kpi in SUMMARY" :key="kpi.key" type="button" class="summary-count" :class="{ active: filters.status === kpi.key }" :aria-pressed="filters.status === kpi.key" @click="toggleStatus(kpi.key)">
              <strong>{{ result?.counts?.[kpi.key] ?? '—' }}</strong><small>{{ kpi.label }}</small>
            </button>
          </div>
        </section>
        <div v-if="topSubject" class="card hero-tag">
          <span class="hero-tag-icon"><i :class="subjectIcon(topSubject.kind)" /></span>
          <span class="hero-tag-text"><strong>{{ topSubject.name }}</strong><small>{{ topSubject.open }} açık bulgu</small></span>
        </div>
      </div>

      <!-- Süresi geçen / yaklaşan sayı kartları: katalogda yok, gizli; ileride açılabilir (durum süzgecinde seçilebilir) -->
      <div v-if="SHOW_DUE_KPIS" class="kpis">
        <button v-for="kpi in KPIS" :key="kpi.key" type="button" class="kpi" :class="[kpi.tone, { active: filters.status === kpi.key }]" @click="toggleStatus(kpi.key)">
          <span class="kpi-icon"><i :class="kpi.icon" /></span>
          <span class="kpi-text"><small>{{ kpi.label }}</small><strong>{{ result?.counts?.[kpi.key] ?? '—' }}</strong></span>
        </button>
      </div>

      <div class="filters">
        <span class="pill-select">
          <select v-model="filters.status" aria-label="Durum">
            <option value="">Durum</option>
            <option v-for="(item, key) in FINDING_STATUS" :key="key" :value="key">{{ item.label }}</option>
            <option value="suresi_gecen">Süresi geçen</option>
            <option value="yaklasan">Yaklaşan (10 gün)</option>
          </select>
          <i class="pi pi-chevron-down" aria-hidden="true" />
        </span>
        <span class="pill-select">
          <select v-model="filters.responsible_user_id" aria-label="Sorumlu">
            <option :value="null">Sorumlu</option>
            <option v-for="person in responsibles" :key="person.id" :value="person.id">{{ person.name }}</option>
          </select>
          <i class="pi pi-chevron-down" aria-hidden="true" />
        </span>
        <span class="pill-date">
          <DatePicker v-model="reportRange" selection-mode="range" date-format="dd.mm.y" placeholder="Rapor tarihi" show-icon icon-display="input" :manual-input="false" show-button-bar aria-label="Rapor tarihi" />
          <i class="pi pi-chevron-down" aria-hidden="true" />
        </span>
        <button v-if="SHOW_CLEAR_FILTERS" class="secondary-button" type="button" :disabled="!filtered" @click="clearFilters"><i class="pi pi-filter-slash" /> Temizle</button>
      </div>

      <div v-if="loading && !result" class="card state"><i class="pi pi-spin pi-spinner" /> Bulgular yükleniyor...</div>
      <div v-else-if="error" class="card state error-text">{{ error }}</div>
      <div v-else-if="!result?.data?.length" class="card state">{{ filtered ? 'Seçimlere uyan bulgu yok.' : 'Bu kapsamda bulgu yok. Rapor kaydedildikçe bulgular burada listelenir.' }}</div>
      <template v-else>
        <!-- Ekipman / tesisat başına grup: açık grup tam genişlik, kapalılar iki sütun. Satıra tıklayınca iş atama, başlığa tıklayınca bulgu detayı. -->
        <div class="subject-groups">
          <section v-for="group in subjectGroups" :key="group.key" class="card subject" :class="{ open: openGroups.includes(group.key) }">
            <button type="button" class="subject-head" :aria-expanded="openGroups.includes(group.key)" @click="toggleGroup(group.key)">
              <i class="pi chevron" :class="openGroups.includes(group.key) ? 'pi-chevron-down' : 'pi-chevron-right'" aria-hidden="true" />
              <i :class="subjectIcon(group.kind)" class="subject-icon" aria-hidden="true" />
              <strong>{{ group.name }}</strong><span>· {{ group.rows.length }} bulgu</span>
            </button>
            <template v-if="openGroups.includes(group.key)">
              <div class="finding-rows">
                <div v-for="row in shownRows(group)" :key="row.id" class="finding-row" :class="[FINDING_STATUS[row.status]?.tone, { active: activeId === row.id }]">
                  <div class="finding-line" role="button" tabindex="0" :aria-expanded="activeId === row.id" @click="pickRow(row)" @keydown.enter.self="pickRow(row)">
                    <span class="bar" aria-hidden="true" />
                    <button type="button" class="finding-title" title="Bulgu detayı" @click.stop="openId = row.id">{{ row.text }}</button>
                    <span class="finding-desc">{{ rowDesc(row) }}</span>
                    <span class="status-chip" :class="FINDING_STATUS[row.status]?.tone">{{ FINDING_STATUS[row.status]?.label }}</span>
                  </div>
                  <div v-if="activeId === row.id" class="assign">
                    <label>Yapılacak iş<input v-model="assign.work" type="text" placeholder="Yapılacak işi yazın" /></label>
                    <label>Sorumlu
                      <span class="field-select">
                        <select v-model="assign.responsible_user_id">
                          <option :value="null">Sorumlu seç</option>
                          <option v-for="person in responsibles" :key="person.id" :value="person.id">{{ person.name }}</option>
                        </select>
                        <i class="pi pi-chevron-down" aria-hidden="true" />
                      </span>
                    </label>
                    <label>Termin<span class="field-date"><i class="pi pi-calendar" aria-hidden="true" /><input v-model="assign.due_date" type="date" /></span></label>
                    <button class="assign-button" type="button" :disabled="assigning" @click="saveAssign(row)"><i class="pi pi-send" /> {{ assigning ? 'Atanıyor...' : 'İşi ata' }}</button>
                    <p v-if="assignError" class="assign-error error-text">{{ assignError }}</p>
                  </div>
                </div>
              </div>
              <button v-if="group.rows.length > ROW_LIMIT && !allRows.includes(group.key)" type="button" class="more-link" @click="allRows.push(group.key)">Tüm {{ group.rows.length }} bulguyu gör <i class="pi pi-chevron-down" /></button>
            </template>
          </section>
        </div>
        <div class="list-foot">
          <span>Gösterilen: {{ result.data.length }}/{{ result.total }} bulgu</span>
          <!-- Sayfalar: katalogda yok; bulgu bir sayfaya sığmazsa görünür (yoksa kalanlar açılamazdı) -->
          <Paginator v-if="result.last_page > 1" :rows="filters.per_page" :total-records="result.total" :first="(filters.page - 1) * filters.per_page" :rows-per-page-options="[25, 50, 100]" @page="onPage" />
        </div>
      </template>

      <!-- Eski tablo (firma / lokasyon, termin kalan gün, kapatma önerisi işareti, Detay): katalogda yok, gizli; ileride açılabilir -->
      <div v-if="SHOW_TABLE && result?.data?.length" class="card table-card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Firma / Lokasyon</th><th>Ekipman / Tesisat</th><th>Bulgu</th><th>Yapılacak iş</th><th>Sorumlu</th><th>Termin</th><th>Durum</th><th /></tr>
            </thead>
            <tbody>
              <tr v-for="row in result.data" :key="row.id" :class="[FINDING_STATUS[row.status]?.tone, { selected: openId === row.id }]" @click="openId = row.id">
                <td><strong>{{ row.workplace?.company_name || 'Lokasyon geneli' }}</strong><small><i class="pi pi-map-marker" /> {{ locationLabel(row.location?.id, row.location?.name) }}</small></td>
                <td><strong>{{ row.subject.name || '—' }}</strong><small>{{ [row.subject.code, row.subject.detail, row.component].filter(Boolean).join(' · ') }}</small></td>
                <td class="text">{{ row.text }}<small v-if="row.close_suggestion && row.status !== 'kapandi'" class="suggested"><i class="pi pi-check-circle" /> Kapatma önerisi</small></td>
                <td class="text">{{ row.work || '—' }}</td>
                <td>{{ row.responsible?.name || '—' }}</td>
                <td class="due" :class="dueTone(row)">
                  {{ findingDay(row.due_date) }}
                  <small v-if="dueText(row)">{{ dueText(row) }}</small>
                </td>
                <td><span class="status-chip" :class="FINDING_STATUS[row.status]?.tone">{{ FINDING_STATUS[row.status]?.label }}</span></td>
                <td><button class="detail-button" type="button" @click.stop="openId = row.id"><i class="pi pi-eye" /> Detay</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { agendaDateKey } from '~/composables/controlAgenda'

// Bulgu Takip (2026-11-12; tasarım kataloğu 04): raporlardaki bulgular ekipman / tesisat başına gruplu. Kapsam üstteki lokasyon /
// firma menüsünden ("Tüm lokasyonlar" da seçilebilir, dashboardScope); sayfada durum, sorumlu ve rapor tarihi süzgeçleri.
// Satıra tıklayınca satır içinde iş atama (yapılacak iş, sorumlu, termin), başlığa tıklayınca bulgu detayı.
definePageMeta({ layout: 'expert', middleware: 'expert', dashboardScope: true })

const { get, patch, errorMessage } = useExpertApi()
const { groups, load, query, scopeLabel, locationLabel } = useDashboardScope()
const { loaded } = useMyWorkplaces()
const { multiUser, isManager, account, load: loadAccount } = useAccount()
const { refresh: refreshCount } = useFindingCount()
// Ana Sayfa yalnız bireysel uzmanda (sayfa yolu).
const individual = computed(() => !!account.value && !multiUser.value)

// Katalogda yok, gizli; ileride açılabilir.
const SHOW_SCOPE_LABEL = false // başlık altındaki kapsam yazısı
const SHOW_DUE_KPIS = false // Süresi geçen / Yaklaşan sayı kartları
const SHOW_CLEAR_FILTERS = false // Temizle düğmesi (süzgeçler kendi içinde temizlenir)
const SHOW_TABLE = false // eski bulgu tablosu

const SUMMARY = [
  { key: 'acik', label: 'Açık' },
  { key: 'tekrar_kontrol', label: 'Tekrar kontrol' },
  { key: 'kapandi', label: 'Kapandı' }
]
const KPIS = [
  { key: 'acik', label: 'Açık', icon: 'pi pi-times-circle', tone: 'bad' },
  { key: 'tekrar_kontrol', label: 'Tekrar kontrol bekliyor', icon: 'pi pi-replay', tone: 'warn' },
  { key: 'kapandi', label: 'Kapandı', icon: 'pi pi-check-circle', tone: 'ok' },
  { key: 'suresi_gecen', label: 'Süresi geçen', icon: 'pi pi-exclamation-triangle', tone: 'bad' },
  { key: 'yaklasan', label: 'Yaklaşan (10 gün)', icon: 'pi pi-calendar', tone: 'warn' }
]
const ROW_LIMIT = 3

// Gruplu listede ekipmanın bulguları sayfalara bölünmesin diye sayfa başına 50 bulgu.
const filters = reactive<{ status: string; responsible_user_id: number | null; date_from: string; date_to: string; page: number; per_page: number }>({
  status: '', responsible_user_id: null, date_from: '', date_to: '', page: 1, per_page: 50
})
const filtered = computed(() => !!(filters.status || filters.responsible_user_id || filters.date_from || filters.date_to))
const clearFilters = () => { Object.assign(filters, { status: '', responsible_user_id: null, date_from: '', date_to: '', page: 1 }); reportRange.value = null }
const toggleStatus = (key: string) => { filters.status = filters.status === key ? '' : key }
const onPage = (event: { page: number; rows: number }) => { filters.page = event.page + 1; filters.per_page = event.rows }
// Rapor tarihi: aralığın iki ucu seçilince (ya da temizlenince) süzülür.
const reportRange = ref<(Date | null)[] | null>(null)
watch(reportRange, (range) => {
  if (!range?.[0]) Object.assign(filters, { date_from: '', date_to: '' })
  else if (range[1]) Object.assign(filters, { date_from: agendaDateKey(range[0]), date_to: agendaDateKey(range[1]) })
})
// Süzgeç değişince ilk sayfa.
watch(() => [filters.status, filters.responsible_user_id, filters.date_from, filters.date_to], () => { filters.page = 1 })

const result = ref<any>(null)
const loading = ref(false)
const error = ref('')
const openId = ref<number | null>(null)
// Bildirim zilinden ?bulgu=ID ile gelinirse o bulgunun detay paneli açılır; adres temizlenir (aynı bildirim yeniden açılabilsin).
const route = useRoute()
const router = useRouter()
watch(() => route.query.bulgu, (value) => {
  if (!Number(value)) return
  openId.value = Number(value)
  router.replace({ query: { ...route.query, bulgu: undefined } })
}, { immediate: true })
const responsibles = ref<{ id: number; name: string }[]>([])

// Bekleyen istek varken yenisi gelirse eskisinin sonucu yazılmaz.
let requestNo = 0
const loadData = async () => {
  if (!groups.value.length) { result.value = null; return }
  const no = ++requestNo
  loading.value = true
  error.value = ''
  try {
    const params: Record<string, any> = { ...query.value, page: filters.page, per_page: filters.per_page }
    if (filters.status) params.status = filters.status
    if (filters.responsible_user_id) params.responsible_user_id = filters.responsible_user_id
    if (filters.date_from) params.date_from = filters.date_from
    if (filters.date_to) params.date_to = filters.date_to
    const data = await get('/pk-findings', params)
    if (no === requestNo) result.value = data
  } catch (e: any) {
    if (no === requestNo) error.value = errorMessage(e, 'Bulgular alınamadı.')
  } finally { if (no === requestNo) loading.value = false }
}
const loadResponsibles = async () => {
  try {
    const list = await get<{ id: number; name: string; email?: string }[]>('/pk-findings/responsibles')
    // Aynı adlı iki kişi varsa e-postasıyla ayırt edilir.
    responsibles.value = list.map(person => ({ id: person.id, name: list.filter(other => other.name === person.name).length > 1 && person.email ? `${person.name} (${person.email})` : person.name }))
  } catch { responsibles.value = [] }
}
const onChanged = () => { loadData(); refreshCount() }

const dueTone = (row: any) => row.status === 'kapandi' || row.days_left === null ? '' : row.days_left < 0 ? 'overdue' : row.days_left <= 10 ? 'soon' : ''
const dueText = (row: any) => row.status === 'kapandi' || row.days_left === null ? '' : row.days_left < 0 ? `${-row.days_left} gün geçti` : row.days_left === 0 ? 'bugün' : row.days_left <= 10 ? `${row.days_left} gün kaldı` : ''

// --- Ekipman / tesisat grupları (sunucunun sırasıyla: önce termini yakın olanlar) ---
const subjectIcon = (kind: string) => kind === 'installation' ? 'pi pi-sitemap' : 'pi pi-box'
const rowDesc = (row: any) => [row.subject?.detail, row.component].filter(Boolean).join(' · ')
const subjectGroups = computed(() => {
  const map = new Map<string, { key: string; kind: string; name: string; rows: any[] }>()
  for (const row of result.value?.data || []) {
    const key = `${row.subject?.kind}-${row.subject?.id}`
    if (!map.has(key)) map.set(key, { key, kind: row.subject?.kind, name: row.subject?.name || '—', rows: [] })
    map.get(key)!.rows.push(row)
  }
  return [...map.values()]
})
// Sağ üstteki etiket: listede en çok açık bulgusu olan ekipman / tesisat.
const topSubject = computed(() => subjectGroups.value
  .map(group => ({ ...group, open: group.rows.filter(row => row.status !== 'kapandi').length }))
  .filter(group => group.open)
  .sort((a, b) => b.open - a.open)[0])

const openGroups = ref<string[]>([])
const allRows = ref<string[]>([])
const toggleGroup = (key: string) => { openGroups.value = openGroups.value.includes(key) ? openGroups.value.filter(item => item !== key) : [...openGroups.value, key] }
const shownRows = (group: { key: string; rows: any[] }) => allRows.value.includes(group.key) ? group.rows : group.rows.slice(0, ROW_LIMIT)

// Satır içi iş atama: yapılacak iş, sorumlu, termin (Bulgu detayı ile aynı kayıt).
const activeId = ref<number | null>(null)
const assign = reactive<{ work: string; responsible_user_id: number | null; due_date: string }>({ work: '', responsible_user_id: null, due_date: '' })
const assigning = ref(false)
const assignError = ref('')
const selectRow = (row: any) => {
  activeId.value = row.id
  Object.assign(assign, { work: row.work || '', responsible_user_id: row.responsible?.id ?? null, due_date: row.due_date || '' })
  assignError.value = ''
}
// Kapanmış bulguda atama yok; satır detayı açar.
const pickRow = (row: any) => {
  if (row.status === 'kapandi') openId.value = row.id
  else if (activeId.value === row.id) activeId.value = null
  else selectRow(row)
}
const saveAssign = async (row: any) => {
  assigning.value = true
  assignError.value = ''
  try {
    await patch(`/pk-findings/${row.id}`, { work: assign.work.trim() || null, responsible_user_id: assign.responsible_user_id, due_date: assign.due_date || null })
    activeId.value = null
    onChanged()
  } catch (e: any) { assignError.value = errorMessage(e, 'İş atanamadı.') }
  finally { assigning.value = false }
}

// Liste yenilenince açık gruplar korunur; hiçbiri kalmadıysa (ilk açılış, süzgeç) ilk grup açılır ve ilk açık bulgusu seçilir.
watch(subjectGroups, (list) => {
  const keys = list.map(group => group.key)
  openGroups.value = openGroups.value.filter(key => keys.includes(key))
  allRows.value = allRows.value.filter(key => keys.includes(key))
  if (!list.some(group => group.rows.some(row => row.id === activeId.value))) activeId.value = null
  if (!openGroups.value.length && list[0]) {
    openGroups.value = [list[0].key]
    const first = list[0].rows.find(row => row.status !== 'kapandi')
    if (first) selectRow(first)
  }
})

watch(query, loadData, { deep: true })
watch(() => [filters.status, filters.responsible_user_id, filters.date_from, filters.date_to, filters.page, filters.per_page], loadData)
onMounted(async () => {
  loadAccount()
  await load()
  loadData()
  loadResponsibles()
})
</script>

<style scoped>
.findings-page{margin:0 auto;display:grid;gap:24px}
.page-head h1{margin:0;color:var(--admin-heading);font-size: 24px;font-weight: 700;line-height:1.15;letter-spacing: 0}.page-head p{margin:7px 0 0;color:var(--admin-muted);font-size:15px}
.crumb{display:flex;align-items:center;gap:8px;margin-bottom:8px;color:var(--admin-muted);font-size:13px}
.crumb a{color:var(--admin-muted)}.crumb a:hover{color:var(--admin-heading)}
.crumb strong{color:var(--admin-heading);font-weight:600}.crumb .pi-angle-right{font-size:11px}
.card{background:var(--admin-card);border:0;border-radius:var(--pk-radius);box-shadow:var(--pk-card-shadow);min-width:0}
.state{display:flex;align-items:center;justify-content:center;gap:8px;padding:50px 20px;color:var(--admin-muted);font-size:13px;text-align:center}
.error-text{color:var(--admin-danger-text)}
.reloading .subject-groups,.reloading .table-card{opacity:.6;transition:opacity .15s}
/* Üst sıra: bulgu özeti, etiket */
.top{display:flex;flex-wrap:wrap;gap:24px;align-items:stretch}
.card.summary{flex:1 1 400px;display:flex;flex-direction:column;gap:14px;padding:24px}
.summary-head{display:flex;align-items:center;gap:12px}
.summary-head i{color:var(--admin-heading);font-size:18px}
.summary-head h3{margin:0;color:var(--admin-heading);font-size:17px;font-weight:700}
.summary-counts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
.summary-count{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:6px 14px;border:0;border-radius:10px;background:none;font:inherit;text-align:left;cursor:pointer}
.summary-count + .summary-count{border-left:1px dashed rgba(145,158,171,.24);border-radius:0}
.summary-count strong{color:var(--admin-heading);font-size:28px;font-weight:700;line-height:1.15}
.summary-count small{color:var(--admin-text);font-size:15px}
.summary-count:hover small{color:var(--admin-heading)}
.summary-count.active{background:var(--admin-accent-soft);border-radius:10px}
.summary-count.active strong,.summary-count.active small{color:var(--admin-accent-text)}
.hero-tag{flex:0 1 auto;display:flex;align-items:center;gap:16px;padding:24px}
.hero-tag-icon{flex:none;width:56px;height:56px;display:grid;place-items:center;border-radius:14px;background:var(--pk-error-lighter);color:var(--pk-error-dark);font-size:22px}
.hero-tag-text{display:flex;flex-direction:column;align-items:flex-start;gap:6px;min-width:0}
.hero-tag-text strong{color:var(--admin-heading);font-size:17px;font-weight:700}
.hero-tag-text small{padding:2px 8px;border-radius:6px;background:var(--admin-danger-bg);color:var(--admin-danger-text);font-size:12px;font-weight:700}
.kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
.kpi{display:flex;align-items:center;gap:12px;padding:16px;border:0;border-radius:var(--pk-radius);background:var(--admin-card);box-shadow:var(--pk-card-shadow);cursor:pointer;text-align:left;font:inherit;transition:border-color .15s,box-shadow .15s}
.kpi.active{box-shadow:var(--pk-card-shadow),0 0 0 3px var(--pk-focus-ring)}
.kpi-icon{flex:none;display:grid;place-items:center;width:40px;height:40px;border-radius:10px;font-size:18px}
.kpi.bad .kpi-icon{background:var(--admin-danger-bg);color:var(--admin-danger-text)}.kpi.warn .kpi-icon{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.kpi.ok .kpi-icon{background:var(--admin-success-bg);color:var(--admin-success-text)}
.kpi-text{display:grid;gap:2px;min-width:0}.kpi-text small{color:var(--admin-muted);font-size:12px}.kpi-text strong{color:var(--admin-heading);font-size:24px;line-height:1.1}
/* Süzgeçler: hap görünümlü seçimler ve rapor tarihi aralığı */
.filters{display:flex;flex-wrap:wrap;align-items:center;gap:14px}
.pill-select{position:relative;display:inline-flex;align-items:center}
.pill-select select{min-width:140px;height:44px;padding:0 42px 0 16px;border:1px solid rgba(145,158,171,.32);border-radius:8px;background:var(--admin-card);color:var(--admin-heading);font:inherit;font-size:14px;font-weight:600;appearance:none;cursor:pointer;outline:0}
.pill-select select:focus{border-color:var(--pk-accent);box-shadow:0 0 0 3px var(--pk-focus-ring)}
.pill-select > .pi{position:absolute;right:18px;color:var(--admin-heading);font-size:12px;pointer-events:none}
.pill-date{position:relative;display:inline-flex;align-items:center}
.pill-date > .pi{position:absolute;right:18px;color:var(--admin-heading);font-size:12px;pointer-events:none}
.pill-date :deep(.p-datepicker-input){width:250px;height:44px;padding:0 40px 0 46px;border:1px solid rgba(145,158,171,.32);border-radius:8px;background:var(--admin-card);color:var(--admin-heading);font:inherit;font-size:14px;font-weight:600;box-shadow:none;cursor:pointer}
.pill-date :deep(.p-datepicker-input::placeholder){color:var(--admin-heading);opacity:1}
.pill-date :deep(.p-datepicker-input:focus){border-color:var(--pk-accent);box-shadow:0 0 0 3px var(--pk-focus-ring)}
.pill-date :deep(.p-datepicker-input-icon-container){inset-inline-start:18px;inset-inline-end:auto;color:var(--admin-heading)}
.secondary-button{display:inline-flex;align-items:center;gap:7px;height:40px;padding:0 16px;border:1px solid rgba(145,158,171,.32);border-radius:8px;background:transparent;color:var(--admin-heading);font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.secondary-button:disabled{opacity:.55;cursor:not-allowed}
/* Gruplar */
.subject-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}
.card.subject.open{grid-column:1 / -1;padding-bottom:12px}
.subject-head{width:100%;display:flex;align-items:center;gap:14px;padding:20px 24px;border:0;background:none;font:inherit;text-align:left;cursor:pointer}
.subject-head .chevron{color:var(--pk-accent);font-size:14px}
.subject-head .subject-icon{color:var(--admin-heading);font-size:18px}
.subject-head strong{color:var(--admin-heading);font-size:17px;font-weight:700}
.subject-head span{color:var(--admin-muted);font-size:14px}
.finding-rows{border-top:1px solid rgba(145,158,171,.2)}
.finding-row + .finding-row{border-top:1px solid rgba(145,158,171,.2)}
.finding-line{display:grid;grid-template-columns:4px minmax(0,1.1fr) minmax(0,1.6fr) auto;align-items:center;gap:20px;padding:12px 24px;cursor:pointer}
.finding-line:hover{background:var(--admin-hover)}
.bar{width:4px;height:20px;border-radius:4px;background:var(--admin-muted)}
.finding-row.bad .bar{background:var(--admin-danger-text)}.finding-row.warn .bar{background:var(--admin-warning-text)}
.finding-row.ok .bar{background:var(--admin-success-text)}.finding-row.info .bar{background:var(--admin-link)}
.finding-title{padding:0;border:0;background:none;color:var(--admin-heading);font:inherit;font-size:14px;font-weight:600;text-align:left;cursor:pointer}
.finding-title:hover,.finding-title:focus-visible{color:var(--admin-link);text-decoration:underline}
.finding-desc{color:var(--admin-muted);font-size:13px;line-height:1.45}
.status-chip{display:inline-block;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700;white-space:nowrap}
.status-chip.bad{background:var(--admin-danger-bg);color:var(--admin-danger-text)}.status-chip.warn{background:var(--admin-warning-bg);color:var(--admin-warning-text)}
.status-chip.ok{background:var(--admin-success-bg);color:var(--admin-success-text)}.status-chip.info{background:var(--admin-accent-soft);color:var(--admin-link)}
.assign{display:grid;grid-template-columns:minmax(0,2.4fr) minmax(0,1fr) minmax(0,1.1fr) auto;align-items:end;gap:14px;margin:0 24px 12px 48px;padding:12px 16px;border-radius:12px;background:rgba(145,158,171,.08)}
.assign label{display:grid;gap:6px;color:var(--admin-heading);font-size:13.5px;font-weight:500}
.assign input,.assign select{width:100%;height:42px;padding:0 14px;border:1px solid rgba(145,158,171,.32);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:14.5px;outline:0}
.assign input:focus,.assign select:focus{border-color:var(--pk-accent);box-shadow:0 0 0 3px var(--pk-focus-ring)}
.field-select,.field-date{position:relative;display:flex;align-items:center}
.field-select select{padding-right:38px;appearance:none;cursor:pointer}
.field-select > .pi{position:absolute;right:14px;color:var(--admin-heading);font-size:12px;pointer-events:none}
.field-date > .pi{position:absolute;left:14px;color:var(--admin-heading);font-size:15px;pointer-events:none}
.field-date input{padding-left:42px}
.assign-button{display:inline-flex;align-items:center;justify-content:center;gap:10px;height:42px;padding:0 20px;border:0;border-radius:8px;background:var(--pk-accent);color:var(--pk-on-accent);font:inherit;font-size:14px;font-weight:700;white-space:nowrap;cursor:pointer;box-shadow:0 8px 16px rgba(var(--pk-accent-rgb),.24)}
.assign-button:hover,.assign-button:focus-visible{background:var(--pk-accent-hover)}
.assign-button:disabled{opacity:.6;cursor:not-allowed}
.assign-error{grid-column:1 / -1;margin:0;font-size:13px}
.more-link{display:inline-flex;align-items:center;gap:10px;margin:12px 0 0 48px;padding:0;border:0;background:none;color:var(--admin-link);font:inherit;font-size:14px;font-weight:700;cursor:pointer}
.more-link .pi{font-size:12px}
.list-foot{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding:0 8px;color:var(--admin-muted);font-size:14px}
.list-foot :deep(.p-paginator){padding:0;background:transparent}
/* Eski tablo (gizli) */
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13px}
th{padding:14px 16px;border:0;background:rgba(145,158,171,.08);color:var(--admin-muted);font-size:13px;font-weight:600;text-align:left;white-space:nowrap}
td{padding:14px 16px;border-bottom:1px solid rgba(145,158,171,.2);color:var(--admin-text);vertical-align:top}
tbody tr:last-child td{border-bottom:0}
td strong{display:block;color:var(--admin-heading);font-weight:700}
td small{display:block;margin-top:3px;color:var(--admin-muted);font-size:11.5px}
td.text{min-width:200px;max-width:320px;line-height:1.5}
tbody tr{cursor:pointer}
tbody tr:hover{background:var(--admin-hover)}
tbody tr.selected{background:var(--admin-accent-soft)}
tbody tr td:first-child{border-left:4px solid transparent}
tbody tr.bad td:first-child{border-left-color:var(--admin-danger-text)}tbody tr.warn td:first-child{border-left-color:var(--admin-warning-text)}
tbody tr.ok td:first-child{border-left-color:var(--admin-success-text)}tbody tr.info td:first-child{border-left-color:var(--admin-link)}
.suggested{color:var(--admin-success-text)!important;font-weight:700}
.due{white-space:nowrap}.due.overdue{color:var(--admin-danger-text);font-weight:700}.due.overdue small{color:var(--admin-danger-text)}.due.soon{color:var(--admin-warning-text);font-weight:700}.due.soon small{color:var(--admin-warning-text)}
.detail-button{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border:1px solid rgba(145,158,171,.32);border-radius:8px;background:transparent;color:var(--admin-link);font:inherit;font-size:12px;font-weight:700;white-space:nowrap;cursor:pointer}
@media (max-width:1100px){
  .assign{grid-template-columns:minmax(0,1fr) minmax(0,1fr);margin-left:14px}
  .finding-line{grid-template-columns:4px minmax(0,1fr) auto}
  .finding-desc{grid-column:2 / -1;grid-row:2}
}
@media (max-width:800px){
  .page-head h1{font-size: 22px}
  .card.summary,.hero-tag{flex-basis:100%}
  .subject-groups{grid-template-columns:minmax(0,1fr)}
  .kpis{grid-template-columns:1fr 1fr}
}
@media (max-width:560px){
  .assign{grid-template-columns:minmax(0,1fr)}
  .finding-line{padding:12px 14px;gap:12px}
  .pill-select,.pill-date{flex:1 1 100%}.pill-select select,.pill-date :deep(.p-datepicker-input){width:100%}
}
</style>
