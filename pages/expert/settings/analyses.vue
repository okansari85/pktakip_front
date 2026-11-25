<template>
  <div class="analyses-page">
    <div class="page-head">
      <!-- Ana Sayfa yalnız bireysel uzmanda var; diğer hesaplarda sayfa yolu Genel Bakış'ta başlar -->
      <nav class="crumb" aria-label="Sayfa yolu">
        <PkIcon class="pi pi-home" aria-hidden="true" />
        <NuxtLink :to="individual ? '/expert/anasayfa' : '/expert'">{{ individual ? 'Ana Sayfa' : 'Genel Bakış' }}</NuxtLink>
        <PkIcon class="pi pi-angle-right" aria-hidden="true" />
        <strong>Analiz geçmişi</strong>
      </nav>
      <h1>Analiz geçmişi</h1>
      <p>Rapor okumaları ve kredi hareketleri</p>
    </div>

    <!-- Üst sıra: listedeki en yeni okuma, kalan kredi -->
    <div class="top">
      <section class="card last">
        <header class="card-title"><PkIcon class="pi pi-file" /><h3>Son rapor</h3></header>
        <template v-if="last">
          <strong class="last-name">{{ [last.detected_type, last.target?.label].filter(Boolean).join(' · ') || last.file_name || 'Rapor' }}</strong>
          <span v-if="last.status === 'failed'" class="status-badge bad"><PkIcon class="pi pi-times-circle" /> Okunamadı</span>
          <span v-else class="status-badge" :class="statusKey(last.overall_status)"><PkIcon :class="STATUS_ICON[statusKey(last.overall_status)]" /> {{ statusLabel(last.overall_status) }}</span>
          <span class="last-findings"><PkIcon class="pi pi-search" /> {{ last.status === 'failed' ? '—' : `${last.summary?.finding_count ?? 0} bulgu` }}</span>
          <button class="primary-button wide" type="button" :disabled="!last.target && last.status === 'failed'" @click="openLast">Kaydı aç <PkIcon class="pi pi-arrow-right" /></button>
        </template>
        <p v-else class="muted">{{ loading ? 'Yükleniyor...' : 'Henüz okuma yok.' }}</p>
      </section>
      <section class="card credit">
        <header class="card-title"><PkIcon class="pi pi-database" /><h3>Kalan kredi</h3></header>
        <strong class="credit-number" :class="{ empty: !billing?.unlimited && (billing?.credits ?? 0) <= 0 }">{{ billing ? billing.unlimited ? 'Sınırsız' : billing.credits ?? 0 : '—' }}</strong>
        <span class="credit-package">{{ billing?.package?.name ? `${billing.package.name} paket` : MODE_LABELS[billing?.mode || ''] || '' }}</span>
        <button class="text-link" type="button" @click="setTab('credits')">Kredi hareketleri <PkIcon class="pi pi-angle-right" /></button>
      </section>
    </div>

    <section class="card list">
      <!-- Okumalar | Kredi hareketleri (paketin kredisi yalnızca rapor okumada düşer) -->
      <div class="tabs-row">
        <div class="tabs">
          <button type="button" :class="{ active: tab === 'reads' }" @click="setTab('reads')"><PkIcon class="pi pi-file" /> Okumalar</button>
          <button type="button" :class="{ active: tab === 'credits' }" @click="setTab('credits')"><PkIcon class="pi pi-database" /> Kredi hareketleri</button>
        </div>
        <!-- Kredi özeti: katalogda yok, gizli; ileride açılabilir (kalan kredi üstteki kartta) -->
        <ExpertCreditSummary v-if="SHOW_TAB_SUMMARY && tab === 'credits'" class="tab-summary" />
      </div>

    <template v-if="tab === 'credits'">
      <p class="credit-hint">Kredi yalnızca rapor okumada düşer: metin / taranmış rapor 1, görüntü PDF 3, tesisat raporu ve tüp kontrol formu 5 kredi. Elle doldurma ve okunamayan rapor kredi düşürmez.</p>
      <ExpertCreditEntries />
    </template>

    <template v-else>
    <div class="filters">
      <span class="pill-select">
        <select v-model="filters.location_id" aria-label="Lokasyon" @change="reload">
          <option value="">Lokasyon</option>
          <option v-for="location in locationOptions" :key="location.id" :value="String(location.id)">{{ location.name }}</option>
        </select>
        <PkIcon class="pi pi-chevron-down" aria-hidden="true" />
      </span>
      <span v-if="!ownOnly" class="pill-select">
        <select v-model="filters.user_id" aria-label="Uzman" @change="reload">
          <option value="">Tüm uzmanlar</option>
          <option v-for="user in users" :key="user.id" :value="String(user.id)">{{ user.name }}</option>
        </select>
        <PkIcon class="pi pi-chevron-down" aria-hidden="true" />
      </span>
      <span class="pill-select">
        <select v-model="filters.kind" aria-label="Rapor türü" @change="reload">
          <option value="">Rapor türü</option>
          <option v-for="(label, key) in KIND_LABELS" :key="key" :value="key">{{ label }}</option>
        </select>
        <PkIcon class="pi pi-chevron-down" aria-hidden="true" />
      </span>
      <span class="pill-select">
        <select v-model="filters.status" aria-label="Durum" @change="reload">
          <option value="">Durum</option>
          <option v-for="(label, key) in STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
        </select>
        <PkIcon class="pi pi-chevron-down" aria-hidden="true" />
      </span>
      <!-- Tarih aralığı ve Yenile: katalogda yok, gizli; ileride açılabilir -->
      <template v-if="SHOW_EXTRA_FILTERS">
        <label class="date"><span>Başlangıç</span><input v-model="filters.from" type="date" @change="reload" /></label>
        <label class="date"><span>Bitiş</span><input v-model="filters.to" type="date" @change="reload" /></label>
        <button class="icon-button" type="button" title="Yenile" aria-label="Yenile" @click="reload"><PkIcon class="pi pi-refresh" /></button>
      </template>
    </div>

    <div v-if="loading && !rows.length" class="state">Yükleniyor...</div>
    <div v-else-if="error" class="state error-text">{{ error }}</div>
    <div v-else-if="!rows.length" class="state">Bu filtrelere uyan okuma yok.</div>
    <template v-else>
      <div class="table-wrap">
        <PkTable>
          <thead>
            <tr>
              <th>Tarih</th><th>Dosya</th><th>Tespit edilen</th><th>İlgili kayıt</th>
              <template v-if="SHOW_EXTRA_COLUMNS"><th>Lokasyon</th><th>Rapor no</th><th>Ekipman</th><th>Durum</th><th>Uzman</th><th>Süre</th></template>
              <th>Genel sonuç</th><th class="center">Bulgu</th><th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in rows" :key="item.id" :class="{ selected: selectedId === item.id, disabled: item.status === 'failed' }" @click="open(item)">
              <td class="nowrap" :title="formatDateTime(item.created_at)">{{ formatDay(item.created_at) }}</td>
              <td>
                <span class="file-cell" :title="item.file_name">
                  <PkIcon class="pi pi-file file-icon" />
                  <span class="file-text"><strong>{{ item.file_name || '—' }}</strong><small class="origin">{{ [KIND_LABELS[item.kind], item.input === 'image' && 'görüntüden okundu', item.input === 'ocr' && 'OCR ile okundu', item.model].filter(Boolean).join(' · ') }}</small></span>
                </span>
              </td>
              <td>{{ item.detected_type || '—' }}</td>
              <td class="state-cell" @click.stop>
                <NuxtLink v-if="item.target" class="target" :to="targetLink(item.target)">{{ item.target.label }}</NuxtLink>
                <small v-else-if="item.target_missing" class="muted">Kayıt sonradan silinmiş</small>
                <small v-else-if="item.status === 'failed'" class="error-text" :title="item.error">{{ item.error }}</small>
                <span v-else class="muted">{{ STATUS_LABELS[item.status] }}</span>
              </td>
              <template v-if="SHOW_EXTRA_COLUMNS">
                <td>{{ item.location?.name || '—' }}</td>
                <td>{{ item.report_no || '—' }}</td>
                <td class="equipment-cell">
                  <template v-if="item.summary?.equipment_summary?.length">
                    <span v-for="group in item.summary.equipment_summary" :key="group.system_name + group.equipment_name" class="summary-line" :class="summaryKey(group)">{{ summaryText(group) }}</span>
                  </template>
                  <span v-else class="muted">—</span>
                </td>
                <td><span class="read-status" :class="item.status">{{ STATUS_LABELS[item.status] }}</span></td>
                <td>{{ item.user || '—' }}</td>
                <td class="nowrap">{{ item.duration_s ? `${formatNumber(item.duration_s)} sn` : '—' }}</td>
              </template>
              <td>
                <span v-if="item.status === 'failed'" class="status-badge bad"><PkIcon class="pi pi-times-circle" /> Okunamadı</span>
                <span v-else class="status-badge" :class="statusKey(item.overall_status)"><PkIcon :class="STATUS_ICON[statusKey(item.overall_status)]" /> {{ statusLabel(item.overall_status) }}</span>
              </td>
              <td class="center">{{ item.status === 'failed' ? '—' : item.summary?.finding_count || '—' }}</td>
              <td class="more-cell" @click.stop>
                <button class="more-button" type="button" aria-label="Diğer işlemler" aria-haspopup="true" @click="openRowMenu($event, item)"><PkIcon class="pi pi-ellipsis-h" /></button>
              </td>
            </tr>
          </tbody>
        </PkTable>
      </div>
      <div class="table-footer">
        <span v-if="soleUser" class="by"><PkIcon class="pi pi-user" /> <strong>{{ soleUser }}</strong> tarafından işlendi.</span>
        <span class="shown">{{ rows.length }} / {{ total }} okuma</span>
        <button v-if="page < lastPage" class="secondary-button" type="button" :disabled="loading" @click="loadMore">{{ loading ? 'Yükleniyor...' : 'Daha fazla göster' }}</button>
      </div>
    </template>
    <Menu ref="rowMenu" :model="rowMenuItems" popup :pt="{ root: { style: MENU_VARS } }"><template #itemicon="{ item }"><PkIcon :class="item.icon" class="p-menu-item-icon" /></template></Menu>
    </template>
    </section>

    <template v-if="tab === 'reads'">
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
            <NuxtLink v-if="detail.target" class="secondary-button" :to="targetLink(detail.target)">{{ detail.target.label }} <PkIcon class="pi pi-arrow-right" /></NuxtLink>
            <button v-if="detail.has_file" class="secondary-button" type="button" @click="openPdf(detail)"><PkIcon class="pi pi-file-pdf" /> PDF</button>
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
const STATUS_ICON: Record<string, string> = { ok: 'pi pi-check-circle', bad: 'pi pi-exclamation-triangle', na: 'pi pi-minus-circle', none: 'pi pi-question-circle' }
// Katalogda yok, gizli; ileride açılabilir: Lokasyon, Rapor no, Ekipman özeti, Durum, Uzman, Süre sütunları; tarih aralığı ve
// Yenile; Kredi hareketleri sekmesindeki kredi özeti (kalan kredi üstteki kartta).
const SHOW_EXTRA_COLUMNS = false
const SHOW_EXTRA_FILTERS = false
const SHOW_TAB_SUMMARY = false
const MENU_VARS = '--p-menu-background:var(--admin-surface);--p-menu-border-color:var(--admin-border);--p-menu-color:var(--admin-text);--p-menu-item-color:var(--admin-text);--p-menu-item-icon-color:var(--admin-muted);--p-menu-item-focus-background:var(--admin-hover);--p-menu-item-focus-color:var(--admin-heading);--p-menu-item-icon-focus-color:var(--admin-heading)'

const { get, getBlob, errorMessage } = useExpertApi()
const { status: billing, load: loadBilling } = useBilling()
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
const { multiUser, isManager, isOperation, account, load: loadAccount } = useAccount()
const { groups, load: loadWorkplaces } = useMyWorkplaces()
const ownOnly = computed(() => multiUser.value && !isManager.value && !isOperation.value)
const individual = computed(() => !!account.value && !multiUser.value)

// Son rapor: listedeki en yeni okuma (seçili süzgeçlerle). Kaydı aç: kaydedildiği yer; kayıt yoksa okumanın detayı.
const last = computed(() => rows.value[0] || null)
const openLast = () => last.value?.target ? navigateTo(targetLink(last.value.target)) : last.value && open(last.value)
// Listedeki okumaların hepsini aynı uzman işlediyse altta adı.
const soleUser = computed(() => {
  const names = new Set(rows.value.map(item => item.user).filter(Boolean))
  return names.size === 1 ? [...names][0] : null
})
// Satır sonundaki "…": Detay ve kaydedildiği yer (PDF detayın başında).
const rowMenu = ref<any>(null)
const rowMenuItems = ref<any[]>([])
const openRowMenu = (event: Event, item: any) => {
  rowMenuItems.value = [
    ...(item.status !== 'failed' ? [{ label: 'Detay', icon: 'pi pi-eye', command: () => open(item) }] : []),
    ...(item.target ? [{ label: 'Kaydı aç', icon: 'pi pi-arrow-right', command: () => navigateTo(targetLink(item.target)) }] : [])
  ]
  if (!rowMenuItems.value.length) rowMenuItems.value = [{ label: 'İşlem yok', icon: 'pi pi-info-circle', disabled: true }]
  rowMenu.value?.toggle(event)
}
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
  loadBilling()
  await Promise.all([loadAccount(), loadWorkplaces()])
  load()
})
</script>

<style scoped>
.analyses-page{margin:0 auto;display:grid;gap:24px}
.page-head h1{margin:0;color:var(--admin-heading);font-size: 24px;font-weight: 700;line-height:1.15;letter-spacing: 0}.page-head p{margin:7px 0 0;color:var(--admin-muted);font-size:15px}
.crumb{display:flex;align-items:center;gap:8px;margin-bottom:8px;color:var(--admin-muted);font-size:13px}
.crumb a{color:var(--admin-muted)}.crumb a:hover{color:var(--admin-heading)}
.crumb strong{color:var(--admin-heading);font-weight:600}.crumb .pi-angle-right{font-size:11px}
h2{margin:0;color:var(--admin-heading);font-size:15px}
.card{background:var(--admin-card);border:0;border-radius:var(--pk-radius);min-width:0;box-shadow:var(--pk-card-shadow)}
.state{padding:50px 20px;text-align:center;color:var(--admin-muted);font-size:13px}
/* Üst sıra: son rapor, kalan kredi */
.top{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;align-items:stretch}
.card-title{display:flex;align-items:center;gap:12px}
.card-title i{color:var(--admin-link);font-size:20px}
.card-title h3{margin:0;color:var(--admin-heading);font-size:17px;font-weight:700}
.card.last{display:flex;flex-direction:column;align-items:flex-start;gap:12px;padding:24px}
.last-name{color:var(--admin-heading);font-size:22px;font-weight:700;line-height:1.25;overflow-wrap:anywhere}
.last-findings{display:inline-flex;align-items:center;gap:10px;color:var(--admin-heading);font-size:16px;font-weight:700}
.last-findings i{color:var(--admin-muted)}
.card.credit{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:24px}
.credit-number{margin-top:8px;color:var(--admin-heading);font-size:48px;font-weight:700;line-height:1}
.credit-number.empty{color:var(--admin-danger-text)}
.credit-package{color:var(--admin-text);font-size:17px}
.text-link{display:inline-flex;align-items:center;gap:8px;align-self:stretch;margin-top:auto;padding:14px 0 0;border:0;border-top:1px dashed rgba(145,158,171,.24);background:none;color:var(--admin-link);font:inherit;font-size:16px;font-weight:700;text-align:left;cursor:pointer}
/* Liste kartı */
.card.list{display:grid;gap:16px;padding:8px 24px 24px}
.tabs-row{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;border-bottom:1px solid rgba(145,158,171,.2)}
.tabs{display:flex;gap:26px}
.tabs button{display:inline-flex;align-items:center;gap:10px;padding:16px 4px;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;background:none;color:var(--admin-muted);font:inherit;font-size:14px;font-weight:600;cursor:pointer}
.tabs button i{font-size:17px;color:var(--admin-muted)}
.tabs button.active{color:var(--admin-heading);border-bottom-color:var(--pk-accent);font-weight:700}.tabs button.active i{color:var(--admin-link)}
.tab-summary{min-width:240px}
.credit-hint{margin:0;color:var(--admin-muted);font-size:12.5px;line-height:1.5}
.filters{display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px}
.pill-select{position:relative;display:inline-flex;align-items:center}
.pill-select select{min-width:150px;height:44px;padding:0 42px 0 16px;border:1px solid rgba(145,158,171,.32);border-radius:8px;background:var(--admin-card);color:var(--admin-heading);font:inherit;font-size:14px;font-weight:600;appearance:none;cursor:pointer;outline:0}
.pill-select select:focus{border-color:var(--pk-accent);box-shadow:0 0 0 3px var(--pk-focus-ring)}
.pill-select > .pi{position:absolute;right:16px;color:var(--admin-heading);font-size:12px;pointer-events:none}
.filters input{height:38px;padding:0 10px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:12px;outline:0}
.date{display:flex;flex-direction:column;gap:3px}.date span{color:var(--admin-muted);font-size:10px;font-weight:700}
.icon-button{width:38px;height:38px;display:grid;place-items:center;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-muted);cursor:pointer}
.table-wrap{overflow:auto;border-radius:8px}
table{width:100%;border-collapse:collapse}th,td{padding:14px 16px;text-align:left;border-bottom:1px solid rgba(145,158,171,.2);font-size:14px;color:var(--admin-text);vertical-align:middle}
th{font-size:13px;font-weight:600;color:var(--admin-muted);background:rgba(145,158,171,.08);border-bottom:0;white-space:nowrap}
tbody tr{cursor:pointer}tbody tr:hover{background:var(--admin-hover)}tbody tr.selected{background:var(--admin-accent-soft)}tbody tr.disabled{cursor:default}
.nowrap{white-space:nowrap}.center{text-align:center}
.file-cell{display:flex;align-items:center;gap:12px;max-width:300px}
.file-icon{flex:none;color:var(--admin-link);font-size:22px}
.file-text{display:grid;min-width:0}
.file-text strong{overflow:hidden;color:var(--admin-heading);font-size:15px;font-weight:700;white-space:nowrap;text-overflow:ellipsis}
.file-text .origin{overflow:hidden;color:var(--admin-muted);font-size:12.5px;white-space:nowrap;text-overflow:ellipsis}
.status-badge{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700;white-space:nowrap}
.status-badge.ok{background:var(--admin-success-bg);color:var(--admin-success-text)}.status-badge.bad{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.status-badge.na{background:var(--admin-chip);color:var(--admin-muted)}.status-badge.none{background:var(--admin-chip);color:var(--admin-muted)}
.equipment-cell{min-width:180px}.summary-line{display:block;font-size:11px;font-weight:600;white-space:nowrap}.summary-line.ok{color:var(--admin-success-text)}.summary-line.bad{color:var(--admin-danger-text)}.summary-line.none{color:var(--admin-muted)}
.state-cell{max-width:220px;cursor:default}
.read-status{display:inline-block;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700;white-space:nowrap}
.read-status.saved{background:var(--admin-success-bg);color:var(--admin-success-text)}.read-status.read{background:var(--admin-chip);color:var(--admin-muted)}.read-status.failed{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.target{color:var(--admin-heading);font-weight:600;text-decoration:none}.target:hover{color:var(--admin-link);text-decoration:underline}
.error-text{color:var(--admin-danger-text)}
.state-cell .error-text{font-size:12px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.muted{color:var(--admin-muted);font-size:13px}
.more-cell{width:48px;text-align:right;cursor:default}
.more-button{width:34px;height:34px;display:grid;place-items:center;border:0;border-radius:8px;background:none;color:var(--admin-link);font-size:18px;cursor:pointer}
.more-button:hover{background:var(--admin-accent-soft)}
.table-footer{display:flex;align-items:center;gap:16px;padding:2px 6px;color:var(--admin-muted);font-size:13px}
.table-footer .by{display:inline-flex;align-items:center;gap:6px;color:var(--admin-text)}.table-footer .by strong{color:var(--admin-heading)}
.table-footer .shown{margin-left:auto}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:10px;height:48px;padding:0 22px;border:0;border-radius:8px;background:var(--pk-accent);color:var(--pk-on-accent);font:inherit;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 8px 16px rgba(var(--pk-accent-rgb),.24)}
.primary-button:hover{background:var(--pk-accent-hover)}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.primary-button.wide{align-self:stretch;margin-top:auto}
.secondary-button{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 12px;border:1px solid rgba(145,158,171,.32);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer;text-decoration:none}.secondary-button:disabled{opacity:.6;cursor:not-allowed}
.detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.detail-head small{display:block;margin-top:4px;color:var(--admin-muted);font-size:11px}
.detail-actions{display:flex;gap:8px;flex-wrap:wrap}
@media (max-width:800px){.top{grid-template-columns:1fr}.page-head h1{font-size: 22px}.pill-select{flex:1 1 45%}.pill-select select{width:100%;min-width:0}}
</style>
