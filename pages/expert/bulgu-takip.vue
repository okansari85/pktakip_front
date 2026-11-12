<template>
  <div class="findings-page" :class="{ reloading: loading && !!result }">
    <div class="page-head">
      <div>
        <h1>Bulgu Takip</h1>
        <p>Periyodik kontrol raporlarındaki bulguların düzeltilmesini takip edin. {{ scopeLabel }}</p>
      </div>
    </div>

    <div v-if="!groups.length && loaded" class="card state">{{ multiUser ? 'Henüz size atanmış bir işyeri yok.' : 'Henüz işyeriniz yok.' }}</div>
    <template v-else>
      <!-- Sayılar: tıklayınca liste o duruma göre süzülür, tekrar tıklayınca kalkar -->
      <div class="kpis">
        <button v-for="kpi in KPIS" :key="kpi.key" type="button" class="kpi" :class="[kpi.tone, { active: filters.status === kpi.key }]" @click="toggleStatus(kpi.key)">
          <span class="kpi-icon"><i :class="kpi.icon" /></span>
          <span class="kpi-text"><small>{{ kpi.label }}</small><strong>{{ result?.counts?.[kpi.key] ?? '—' }}</strong></span>
        </button>
      </div>

      <div class="card filters">
        <label>Durum
          <select v-model="filters.status">
            <option value="">Tümü</option>
            <option v-for="(item, key) in FINDING_STATUS" :key="key" :value="key">{{ item.label }}</option>
            <option value="suresi_gecen">Süresi geçen</option>
            <option value="yaklasan">Yaklaşan (10 gün)</option>
          </select>
        </label>
        <label>Sorumlu
          <select v-model="filters.responsible_user_id">
            <option :value="null">Tümü</option>
            <option v-for="person in responsibles" :key="person.id" :value="person.id">{{ person.name }}</option>
          </select>
        </label>
        <label>Rapor tarihi (başlangıç)<input v-model="filters.date_from" type="date" /></label>
        <label>Rapor tarihi (bitiş)<input v-model="filters.date_to" type="date" /></label>
        <button class="secondary-button" type="button" :disabled="!filtered" @click="clearFilters"><i class="pi pi-filter-slash" /> Temizle</button>
      </div>

      <div class="card table-card">
        <div v-if="loading && !result" class="state"><i class="pi pi-spin pi-spinner" /> Bulgular yükleniyor...</div>
        <div v-else-if="error" class="state error-text">{{ error }}</div>
        <div v-else-if="!result?.data?.length" class="state">{{ filtered ? 'Seçimlere uyan bulgu yok.' : 'Bu kapsamda bulgu yok. Rapor kaydedildikçe bulgular burada listelenir.' }}</div>
        <div v-else class="table-wrap">
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
        <div v-if="result?.total" class="table-foot">
          <span>Toplam {{ result.total }} bulgu</span>
          <Paginator :rows="filters.per_page" :total-records="result.total" :first="(filters.page - 1) * filters.per_page" :rows-per-page-options="[10, 25, 50]" @page="onPage" />
        </div>
      </div>
    </template>

    <ExpertFindingPanel v-if="openId" :finding-id="openId" :responsibles="responsibles" :can-invite="isManager" @close="openId = null" @changed="onChanged" @responsibles-changed="loadResponsibles" />
  </div>
</template>

<script setup lang="ts">
// Bulgu Takip (2026-11-12): raporlardaki bulgular. Kapsam üstteki lokasyon / firma menüsünden ("Tüm lokasyonlar" da seçilebilir,
// dashboardScope); sayfada durum, sorumlu ve rapor tarihi filtreleri. Satıra tıklayınca sağda detay paneli.
definePageMeta({ layout: 'expert', middleware: 'expert', dashboardScope: true })

const { get, errorMessage } = useExpertApi()
const { groups, load, query, scopeLabel, locationLabel } = useDashboardScope()
const { loaded } = useMyWorkplaces()
const { multiUser, isManager } = useAccount()
const { refresh: refreshCount } = useFindingCount()

const KPIS = [
  { key: 'acik', label: 'Açık', icon: 'pi pi-times-circle', tone: 'bad' },
  { key: 'tekrar_kontrol', label: 'Tekrar kontrol bekliyor', icon: 'pi pi-replay', tone: 'warn' },
  { key: 'kapandi', label: 'Kapandı', icon: 'pi pi-check-circle', tone: 'ok' },
  { key: 'suresi_gecen', label: 'Süresi geçen', icon: 'pi pi-exclamation-triangle', tone: 'bad' },
  { key: 'yaklasan', label: 'Yaklaşan (10 gün)', icon: 'pi pi-calendar', tone: 'warn' }
]

const filters = reactive<{ status: string; responsible_user_id: number | null; date_from: string; date_to: string; page: number; per_page: number }>({
  status: '', responsible_user_id: null, date_from: '', date_to: '', page: 1, per_page: 10
})
const filtered = computed(() => !!(filters.status || filters.responsible_user_id || filters.date_from || filters.date_to))
const clearFilters = () => Object.assign(filters, { status: '', responsible_user_id: null, date_from: '', date_to: '', page: 1 })
const toggleStatus = (key: string) => { filters.status = filters.status === key ? '' : key }
const onPage = (event: { page: number; rows: number }) => { filters.page = event.page + 1; filters.per_page = event.rows }
// Filtre değişince ilk sayfa.
watch(() => [filters.status, filters.responsible_user_id, filters.date_from, filters.date_to], () => { filters.page = 1 })

const result = ref<any>(null)
const loading = ref(false)
const error = ref('')
const openId = ref<number | null>(null)
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

watch(query, loadData, { deep: true })
watch(() => [filters.status, filters.responsible_user_id, filters.date_from, filters.date_to, filters.page, filters.per_page], loadData)
onMounted(async () => {
  await load()
  loadData()
  loadResponsibles()
})
</script>

<style scoped>
.findings-page{margin:0 auto;display:grid;gap:16px}
.page-head h1{margin:0;color:var(--admin-heading);font-size:30px;line-height:1.15;letter-spacing:-.7px}.page-head p{margin:7px 0 0;color:var(--admin-muted);font-size:13px}
.card{background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px;min-width:0}
.state{display:flex;align-items:center;justify-content:center;gap:8px;padding:50px 20px;color:var(--admin-muted);font-size:13px;text-align:center}
.error-text{color:var(--admin-danger-text)}
.reloading .table-card{opacity:.6;transition:opacity .15s}
.kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
.kpi{display:flex;align-items:center;gap:12px;padding:16px;border:1px solid var(--admin-border);border-radius:12px;background:var(--admin-card);cursor:pointer;text-align:left;font:inherit;transition:border-color .15s,box-shadow .15s}
.kpi:hover{border-color:var(--admin-muted)}
.kpi.active{border-color:var(--pk-yellow);box-shadow:0 0 0 3px rgba(255,193,7,.18)}
.kpi-icon{flex:none;display:grid;place-items:center;width:40px;height:40px;border-radius:10px;font-size:18px}
.kpi.bad .kpi-icon{background:var(--admin-danger-bg);color:var(--admin-danger-text)}.kpi.warn .kpi-icon{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.kpi.ok .kpi-icon{background:var(--admin-success-bg);color:var(--admin-success-text)}
.kpi-text{display:grid;gap:2px;min-width:0}.kpi-text small{color:var(--admin-muted);font-size:12px}.kpi-text strong{color:var(--admin-heading);font-size:24px;line-height:1.1}
.filters{display:grid;grid-template-columns:repeat(4,minmax(0,1fr)) auto;gap:12px;align-items:end;padding:14px 16px}
.filters label{display:grid;gap:6px;color:var(--admin-heading);font-size:12px;font-weight:700}
.filters select,.filters input{width:100%;height:40px;padding:0 11px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:13px;font-weight:400;outline:0}
.filters select:focus,.filters input:focus{border-color:#d7a900;box-shadow:0 0 0 3px rgba(255,193,7,.12)}
.secondary-button{display:inline-flex;align-items:center;gap:7px;height:40px;padding:0 16px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-hover);color:var(--admin-heading);font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.secondary-button:disabled{opacity:.55;cursor:not-allowed}
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13px}
th{padding:12px 14px;border-bottom:1px solid var(--admin-border);color:var(--admin-muted);font-size:11.5px;font-weight:700;text-align:left;white-space:nowrap}
td{padding:12px 14px;border-bottom:1px solid var(--admin-row-border);color:var(--admin-text);vertical-align:top}
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
.status-chip{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:800;white-space:nowrap}
.status-chip.bad{background:var(--admin-danger-bg);color:var(--admin-danger-text)}.status-chip.warn{background:var(--admin-warning-bg);color:var(--admin-warning-text)}
.status-chip.ok{background:var(--admin-success-bg);color:var(--admin-success-text)}.status-chip.info{background:var(--admin-accent-soft);color:var(--admin-link)}
.detail-button{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-card);color:var(--admin-link);font:inherit;font-size:12px;font-weight:700;white-space:nowrap;cursor:pointer}
.table-foot{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding:8px 14px;color:var(--admin-muted);font-size:12px}
.table-foot :deep(.p-paginator){padding:0;background:transparent}
@media (max-width:1200px){.kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.filters{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:640px){.kpis{grid-template-columns:1fr 1fr}.filters{grid-template-columns:1fr}}
</style>
