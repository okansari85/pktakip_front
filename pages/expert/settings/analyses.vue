<template>
  <div class="analyses-page">
    <div class="page-head">
      <div>
        <div class="breadcrumb"><span>Ayarlar</span><i class="pi pi-angle-right" /><strong>Analiz geçmişi</strong></div>
        <h1>Analiz geçmişi</h1>
        <p>{{ ownOnly ? 'Yapay zeka ile yaptığınız rapor okumaları.' : 'Yapay zeka ile yapılan tüm rapor okumaları (hesaptaki tüm uzmanlar).' }} Kaydedilmeyen ve okunamayan okumalar da burada kalır. Test verisiyle yapılan denemeler ve elle girişler yer almaz.</p>
      </div>
    </div>

    <!-- Okumalar | Kredi hareketleri (paketin kredisi yalnızca rapor okumada düşer) -->
    <div class="tabs-row">
      <div class="tabs">
        <button type="button" :class="{ active: tab === 'reads' }" @click="setTab('reads')">Okumalar</button>
        <button type="button" :class="{ active: tab === 'credits' }" @click="setTab('credits')">Kredi hareketleri</button>
      </div>
      <ExpertCreditSummary v-if="tab === 'credits'" class="tab-summary" />
    </div>

    <template v-if="tab === 'credits'">
      <p class="credit-hint">Kredi yalnızca rapor okumada düşer: metin / taranmış rapor 1, görüntü PDF 3, tesisat raporu ve tüp kontrol formu 5 kredi. Elle doldurma ve okunamayan rapor kredi düşürmez.</p>
      <ExpertCreditEntries />
    </template>

    <template v-else>
    <div class="filters">
      <select v-model="filters.location_id" @change="reload">
        <option value="">Tüm lokasyonlar</option>
        <option v-for="location in locationOptions" :key="location.id" :value="String(location.id)">{{ location.name }}</option>
      </select>
      <select v-if="!ownOnly" v-model="filters.user_id" @change="reload">
        <option value="">Tüm uzmanlar</option>
        <option v-for="user in users" :key="user.id" :value="String(user.id)">{{ user.name }}</option>
      </select>
      <select v-model="filters.kind" @change="reload">
        <option value="">Tüm rapor türleri</option>
        <option v-for="(label, key) in KIND_LABELS" :key="key" :value="key">{{ label }}</option>
      </select>
      <select v-model="filters.status" @change="reload">
        <option value="">Tüm durumlar</option>
        <option v-for="(label, key) in STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
      </select>
      <label class="date"><span>Başlangıç</span><input v-model="filters.from" type="date" @change="reload" /></label>
      <label class="date"><span>Bitiş</span><input v-model="filters.to" type="date" @change="reload" /></label>
      <button class="icon-button" type="button" title="Yenile" aria-label="Yenile" @click="reload"><i class="pi pi-refresh" /></button>
    </div>

    <section class="card">
      <div v-if="loading && !rows.length" class="state">Yükleniyor...</div>
      <div v-else-if="error" class="state error-text">{{ error }}</div>
      <div v-else-if="!rows.length" class="state">Bu filtrelere uyan okuma yok.</div>
      <div v-else class="table-wrap">
        <table>
          <thead><tr><th>Tarih</th><th>Dosya</th><th>Tespit edilen</th><th>Lokasyon</th><th>Rapor no</th><th>Genel</th><th>Ekipman</th><th>Bulgu</th><th>Durum</th><th>Uzman</th><th>Süre</th></tr></thead>
          <tbody>
            <tr v-for="item in rows" :key="item.id" :class="{ selected: selectedId === item.id, disabled: item.status === 'failed' }" @click="open(item)">
              <td class="nowrap">{{ formatDateTime(item.created_at) }}</td>
              <td class="file-cell" :title="item.file_name">{{ item.file_name || '—' }}<small class="origin">{{ [KIND_LABELS[item.kind], item.input === 'image' && 'görüntüden okundu', item.input === 'ocr' && 'OCR ile okundu', item.model].filter(Boolean).join(' · ') }}</small></td>
              <td>{{ item.detected_type || '—' }}</td>
              <td>{{ item.location?.name || '—' }}</td>
              <td>{{ item.report_no || '—' }}</td>
              <td><span v-if="item.status !== 'failed'" class="status-badge" :class="statusKey(item.overall_status)">{{ statusLabel(item.overall_status) }}</span><span v-else class="muted">—</span></td>
              <td class="equipment-cell">
                <template v-if="item.summary?.equipment_summary?.length">
                  <span v-for="group in item.summary.equipment_summary" :key="group.system_name + group.equipment_name" class="summary-line" :class="summaryKey(group)">{{ summaryText(group) }}</span>
                </template>
                <span v-else class="muted">—</span>
              </td>
              <td>{{ item.status === 'failed' ? '—' : item.summary?.finding_count ?? '—' }}</td>
              <td class="state-cell" @click.stop>
                <span class="read-status" :class="item.status">{{ STATUS_LABELS[item.status] }}</span>
                <NuxtLink v-if="item.target" class="target" :to="targetLink(item.target)">{{ item.target.label }} <i class="pi pi-arrow-right" /></NuxtLink>
                <small v-else-if="item.target_missing" class="muted block">Kayıt sonradan silinmiş</small>
                <small v-else-if="item.status === 'failed'" class="error-text block" :title="item.error">{{ item.error }}</small>
              </td>
              <td>{{ item.user || '—' }}</td>
              <td class="nowrap">{{ item.duration_s ? `${formatNumber(item.duration_s)} sn` : '—' }}</td>
            </tr>
          </tbody>
        </table>
        <div class="table-footer">
          <span>{{ rows.length }} / {{ total }} okuma</span>
          <button v-if="page < lastPage" class="secondary-button" type="button" :disabled="loading" @click="loadMore">{{ loading ? 'Yükleniyor...' : 'Daha fazla göster' }}</button>
        </div>
      </div>
    </section>

    <div ref="detailAnchor" />
    <div v-if="detailLoading" class="card state">Analiz yükleniyor...</div>
    <p v-else-if="detailError" class="card state error-text">{{ detailError }}</p>
    <ExpertReportAnalysisView v-else-if="detail" :analysis="detail">
      <template #head>
        <div class="detail-head">
          <div>
            <h2>{{ detail.file_name || 'Rapor' }}</h2>
            <small>
              {{ [KIND_LABELS[detail.kind], detail.detected_type, detail.location?.name, detail.user, formatDateTime(detail.created_at)].filter(Boolean).join(' · ') }}
            </small>
            <small>
              {{ [detail.model, detail.duration_s && `${formatNumber(detail.duration_s)} sn`, tokenText(detail)].filter(Boolean).join(' · ') }}
            </small>
          </div>
          <div class="detail-actions">
            <NuxtLink v-if="detail.target" class="secondary-button" :to="targetLink(detail.target)">{{ detail.target.label }} <i class="pi pi-arrow-right" /></NuxtLink>
            <button v-if="detail.has_file" class="secondary-button" type="button" @click="openPdf(detail)"><i class="pi pi-file-pdf" /> PDF</button>
          </div>
        </div>
      </template>
    </ExpertReportAnalysisView>
    </template>
  </div>
</template>

<script setup lang="ts">
// Ayarlar → Analiz geçmişi: yapay zeka ile yapılan her rapor okuması (hesaptaki tüm uzmanlar). Satırlar silinmez;
// ileride kontür bu satırlardan düşülür.
definePageMeta({ layout: 'expert-settings', middleware: 'expert' })

interface EquipmentGroup { system_name: string; equipment_name: string; total: number; uygun: number; uygun_degil: number; unknown: number }

const KIND_LABELS: Record<string, string> = { equipment: 'Ekipman raporu', equipment_new: 'Rapordan ekipman tanımlama', bulk: 'Tüp kontrol formu', installation: 'Tesisat raporu' }
// Kaydedildiği yer: ekipman profili, tesisatlar ya da (tüp kontrol formu) Ekipmanlar.
const targetLink = (target: any) => target.type === 'equipment' ? `/expert/equipment/${target.id}` : target.type === 'installation' ? '/expert/installations' : '/expert/equipment'
const STATUS_LABELS: Record<string, string> = { saved: 'Kaydedildi', read: 'Kaydedilmedi', failed: 'Okunamadı' }

const { get, getBlob, errorMessage } = useExpertApi()
// Sekme adreste (?tab=credits): menüdeki Paketim kutusu doğrudan Kredi hareketlerini açar.
const route = useRoute()
const router = useRouter()
const tab = computed<'reads' | 'credits'>(() => route.query.tab === 'credits' ? 'credits' : 'reads')
const setTab = (value: 'reads' | 'credits') => router.replace({ query: { ...route.query, tab: value === 'credits' ? 'credits' : undefined } })
const { context } = useWorkplaceContext()

const rows = ref<any[]>([])
const locations = ref<{ id: number; name: string }[]>([])
const users = ref<{ id: number; name: string }[]>([])
const total = ref(0)
const page = ref(1)
const lastPage = ref(1)
const loading = ref(false)
const error = ref('')
// Varsayılan: seçili çalışma alanının lokasyonu (geçmişinde okuma yoksa tüm lokasyonlar).
const filters = reactive({ location_id: context.value?.location_id ? String(context.value.location_id) : '', user_id: '', kind: '', status: '', from: '', to: '' })

const selectedId = ref<string | null>(null)
const detail = ref<any>(null)
const detailLoading = ref(false)
const detailError = ref('')
const detailAnchor = ref<HTMLElement | null>(null)

// OSGB / kurumsal hesapta uzman yalnızca kendi okumalarını görür (yönetici ve operasyon yöneticisi hepsini); bireysel uzmanda
// bugünkü gibi.
const { user } = useAuth()
const { multiUser, isManager, isOperation, load: loadAccount } = useAccount()
const { groups, load: loadWorkplaces } = useMyWorkplaces()
const ownOnly = computed(() => multiUser.value && !isManager.value && !isOperation.value)
const locationOptions = computed(() => ownOnly.value ? locations.value.filter(location => groups.value.some(group => group.location_id === location.id)) : locations.value)

const query = () => Object.fromEntries(Object.entries({ ...filters, ...(ownOnly.value && user.value ? { user_id: String(user.value.id) } : {}), page: page.value })
  .filter(([, value]) => value !== '' && value !== null))

const load = async (append = false) => {
  loading.value = true
  error.value = ''
  try {
    const response = await get('/pk-analysis-history', query())
    rows.value = append ? [...rows.value, ...response.data] : response.data
    total.value = response.total
    lastPage.value = response.last_page
    locations.value = response.locations
    users.value = response.users
    // Seçili lokasyonda hiç okuma yoksa (filtre listesinde yok) tüm lokasyonlar.
    if (filters.location_id && !response.locations.some((location: any) => String(location.id) === filters.location_id)) {
      filters.location_id = ''
      return reload()
    }
  } catch (e: any) {
    error.value = errorMessage(e, 'Analiz geçmişi alınamadı.')
  } finally { loading.value = false }
}
const reload = () => { page.value = 1; return load() }
const loadMore = () => { page.value++; return load(true) }

const open = async (item: any) => {
  if (item.status === 'failed') return
  selectedId.value = item.id
  detailLoading.value = true
  detailError.value = ''
  try {
    detail.value = await get(`/pk-analysis-history/${item.id}`)
    await nextTick()
    detailAnchor.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch (e: any) {
    detailError.value = errorMessage(e, 'Analiz açılamadı.')
  } finally { detailLoading.value = false }
}

const openPdf = async (item: any) => {
  const tab = window.open('', '_blank')
  try {
    const blob = await getBlob(`/pk-analysis-history/${item.id}/file`)
    const blobUrl = URL.createObjectURL(blob)
    if (tab) tab.location.href = blobUrl
    else window.location.href = blobUrl
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
  } catch (e: any) {
    tab?.close()
    alert(errorMessage(e, 'PDF açılamadı.'))
  }
}

// "2/3 Yangın Pompası uygun"; tabloda sonuç yoksa "4 Yangın Pompası · sonuç yok".
const summaryText = (group: EquipmentGroup) => group.unknown === group.total
  ? `${group.total} ${group.equipment_name} · sonuç yok`
  : `${group.uygun}/${group.total} ${group.equipment_name} uygun`
const summaryKey = (group: EquipmentGroup) => group.unknown === group.total ? 'none' : group.uygun_degil > 0 ? 'bad' : 'ok'
const statusLabel = (status?: string | null) => ({ uygun: 'Uygun', uygun_degil: 'Uygun değil', uygulanamiyor: 'Uygulanamıyor' } as Record<string, string>)[status || ''] || 'Belirtilmemiş'
const statusKey = (status?: string | null) => status === 'uygun' ? 'ok' : status === 'uygun_degil' ? 'bad' : status === 'uygulanamiyor' ? 'na' : 'none'

const formatNumber = (value: number) => new Intl.NumberFormat('tr-TR').format(value)
const tokenText = (item: any) => item.input_tokens || item.output_tokens ? `${formatNumber(item.input_tokens || 0)} + ${formatNumber(item.output_tokens || 0)} token` : ''
const formatDateTime = (value?: string | null) => value ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'

onMounted(async () => {
  await Promise.all([loadAccount(), loadWorkplaces()])
  load()
})
</script>

<style scoped>
.analyses-page { max-width: 1500px; margin: 0 auto; display: grid; gap: 14px; }
.page-head { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; margin-bottom:6px; }
.breadcrumb { display:flex; align-items:center; gap:8px; margin-bottom:10px; color:var(--admin-muted); font-size:12px; }.breadcrumb strong{color:var(--admin-heading)}
h1{margin:0;color:var(--admin-heading);font-size:30px;letter-spacing:-.7px}.page-head p{margin:7px 0 0;max-width:820px;color:var(--admin-muted);font-size:13px}
h2{margin:0;color:var(--admin-heading);font-size:15px}
.tabs-row{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap}
.tabs{display:flex;gap:4px;padding:4px;border:1px solid var(--admin-border);border-radius:10px;background:var(--admin-card)}
.tabs button{min-height:34px;padding:0 14px;border:0;border-radius:7px;background:transparent;color:var(--admin-muted);font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.tabs button.active{background:var(--admin-accent-soft);color:var(--admin-heading)}
.tab-summary{min-width:240px}
.credit-hint{margin:0;color:var(--admin-muted);font-size:12px;line-height:1.5}
.filters{display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px}
.filters select,.filters input{height:38px;padding:0 10px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:12px;outline:0}
.filters select{min-width:170px}
.date{display:flex;flex-direction:column;gap:3px}.date span{color:var(--admin-muted);font-size:10px;font-weight:700}
.icon-button{width:38px;height:38px;display:grid;place-items:center;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-muted);cursor:pointer}
.card{background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px;overflow:hidden}
.state{padding:50px 20px;text-align:center;color:var(--admin-muted);font-size:13px}
.table-wrap{overflow:auto}
table{width:100%;border-collapse:collapse}th,td{padding:10px 12px;text-align:left;border-bottom:1px solid var(--admin-row-border);font-size:12px;color:var(--admin-text);vertical-align:top}
th{font-size:11px;font-weight:700;color:var(--admin-muted);background:var(--admin-soft);white-space:nowrap}
tbody tr{cursor:pointer}tbody tr:hover{background:var(--admin-hover)}tbody tr.selected{background:var(--admin-accent-soft)}tbody tr.disabled{cursor:default}
.nowrap{white-space:nowrap}
.file-cell{max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--admin-heading);font-weight:600}.file-cell .origin{display:block;color:var(--admin-muted);font-size:10px;font-weight:400}
.status-badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
.status-badge.ok{background:var(--admin-success-bg);color:var(--admin-success-text)}.status-badge.bad{background:var(--admin-danger-bg);color:var(--admin-danger-text)}.status-badge.na{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.status-badge.none{background:var(--admin-chip);color:var(--admin-muted)}
.equipment-cell{min-width:180px}.summary-line{display:block;font-size:11px;font-weight:600;white-space:nowrap}.summary-line.ok{color:var(--admin-success-text)}.summary-line.bad{color:var(--admin-danger-text)}.summary-line.none{color:var(--admin-muted)}
.state-cell{min-width:170px;max-width:260px;cursor:default}
.read-status{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
.read-status.saved{background:var(--admin-success-bg);color:var(--admin-success-text)}.read-status.read{background:var(--admin-chip);color:var(--admin-muted)}.read-status.failed{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.target{display:flex;align-items:center;gap:5px;margin-top:5px;color:var(--admin-link);font-size:11px;font-weight:700;text-decoration:none}.target i{font-size:10px}
.block{display:block;margin-top:5px}.error-text{color:var(--admin-danger-text)}
.state-cell .error-text{font-size:11px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.muted{color:var(--admin-muted);font-size:12px}
.table-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;color:var(--admin-muted);font-size:12px}
.secondary-button{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 12px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer;text-decoration:none}.secondary-button:disabled{opacity:.6;cursor:not-allowed}
.detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.detail-head small{display:block;margin-top:4px;color:var(--admin-muted);font-size:11px}
.detail-actions{display:flex;gap:8px;flex-wrap:wrap}
@media(max-width:700px){.filters select{min-width:0;flex:1 1 45%}}
</style>
