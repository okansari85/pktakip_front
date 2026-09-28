<template>
  <div class="installations-page">
    <div class="page-head">
      <div>
        <div class="breadcrumb"><span>Uzman Paneli</span><i class="pi pi-angle-right" /><span>Periyodik Kontroller</span><i class="pi pi-angle-right" /><strong>Tesisatlar</strong></div>
        <h1>Tesisatlar</h1>
        <p v-if="context">{{ contextLabel }}</p>
        <p v-else>Üstten lokasyon ve firma seçin.</p>
      </div>
    </div>

    <div v-if="!context" class="card empty-state">
      <i class="pi pi-map-marker" />
      <strong>Lokasyon seçilmedi</strong>
      <span>Tesisatları görmek için üstteki Lokasyon kutusundan seçim yapın.</span>
    </div>

    <template v-else>
      <!-- Tesisat türleri: diğer tesisatlar geldikçe sekme eklenir -->
      <div class="tabs">
        <button v-for="type in tabs" :key="type.slug" type="button" :class="{ active: activeSlug === type.slug }" @click="selectTab(type.slug)">{{ type.name }}</button>
      </div>

      <div v-if="loading" class="card state">Tesisat yükleniyor...</div>
      <div v-else-if="error" class="card state error-text">{{ error }}</div>

      <!-- Bu lokasyonda tesisat yok -->
      <div v-else-if="!ofType.length" class="card empty-state">
        <i class="pi pi-sitemap" />
        <strong>Bu lokasyonda {{ activeType?.name || 'tesisat' }} tanımlı değil</strong>
        <span>Tesisatı ve içindeki sistemleri ekleyin. Periyodik kontrol raporları sonradan eklenir.</span>
        <button class="primary-button" type="button" :disabled="!activeType" @click="openCreate"><i class="pi pi-plus" /> Tesisat Ekle</button>
      </div>

      <template v-else>
        <!-- Aynı türden birden fazla tesisat varsa (ör. işyerine ait) seçim -->
        <div v-if="ofType.length > 1" class="picker">
          <button v-for="item in ofType" :key="item.id" type="button" class="chip" :class="{ active: selectedId === item.id }" @click="selectInstallation(item.id)">
            {{ item.name }} <span>{{ item.workplace?.company_name || 'Lokasyon geneli' }}</span>
          </button>
        </div>

        <div v-if="detailLoading && !detail" class="card state">Tesisat yükleniyor...</div>
        <template v-else-if="detail">
          <!-- Genel bilgiler -->
          <section class="card overview" :class="detail.status">
            <div class="overview-main">
              <div class="overview-icon"><i class="pi pi-shield" /></div>
              <div class="overview-title">
                <h2>{{ detail.name }}</h2>
                <p>{{ detail.workplace?.company_name || 'Lokasyon geneli' }} · {{ detail.location?.name }}</p>
              </div>
              <div class="overview-status">
                <span class="status-pill" :class="detail.status"><i :class="STATUS_ICONS[detail.status]" /> {{ STATUS_LABELS[detail.status] }}</span>
                <small v-if="dueText" class="due" :class="daysKey(detail.days_left)">{{ dueText }}</small>
              </div>
              <div class="overview-actions">
                <button class="secondary-button" type="button" @click="editOpen = true"><i class="pi pi-pencil" /> Düzenle</button>
                <!-- Tesisata bağlı ekipmanlar için de tek kayıt: ekipman bazında rapor bekleniyor yapılmaz -->
                <button class="secondary-button" type="button" @click="pendingOpen = true"><i class="pi pi-hourglass" /> Rapor bekleniyor</button>
                <button class="primary-button" type="button" @click="reportOpen = true"><i class="pi pi-file-arrow-up" /> Kontrol Ekle</button>
              </div>
            </div>

            <p v-if="detail.status === 'rapor_bekleniyor'" class="notice warn">
              <i class="pi pi-hourglass" /> {{ formatDate(detail.last_control_date) }} kontrolünün raporu bekleniyor. Sistemlerin ve ekipmanların durumu önceki kontrolden; rapor gelince “Kontrol Ekle” ile yükleyin.
            </p>
            <p v-if="detail.status === 'rapor_yok'" class="notice">
              <i class="pi pi-info-circle" /> Bu tesisat için henüz kontrol eklenmedi. Periyodik kontrol raporunu “Kontrol Ekle” ile yükleyin; genel durum ve kalan gün son kontrolden gelir.
            </p>
            <div v-else class="info-strip">
              <div><small>Kontrolü yapan</small><strong>{{ detail.inspection_body || '—' }}</strong></div>
              <div><small>Rapor no</small><strong>{{ detail.report_no || '—' }}</strong></div>
              <div><small>Son kontrol</small><strong>{{ formatDate(detail.last_control_date) }}</strong></div>
              <div><small>Geçerlilik tarihi</small><strong>{{ formatDate(detail.next_control_date) }}</strong></div>
              <div><small>Kalan gün</small><strong class="days" :class="daysKey(detail.days_left)">{{ daysText(detail.days_left) }}</strong></div>
            </div>

            <div class="stats">
              <div><strong>{{ detail.systems.length }}</strong><small>Sistem</small></div>
              <div class="ok"><strong>{{ countStatus('uygun') }}</strong><small>Uygun sistem</small></div>
              <div class="bad"><strong>{{ countStatus('uygun_degil') }}</strong><small>Uygun olmayan sistem</small></div>
              <div class="warn"><strong>{{ totalFindings }}</strong><small>Bulgu</small></div>
            </div>
          </section>

          <!-- Belge ve kayıt / proje bilgileri: tesisatta varsa kart olarak -->
          <div v-if="cardSystems.length" class="info-cards">
            <article v-for="system in cardSystems" :key="system.id" class="card info-card">
              <header>
                <div><strong>{{ system.name }}</strong><small>{{ cardHint(system) }}</small></div>
                <span class="status-badge" :class="system.status">{{ STATUS_LABELS[system.status] }}</span>
              </header>
              <ol v-if="system.findings.length" class="findings">
                <li v-for="(finding, index) in shownFindings(system)" :key="index">{{ finding }}</li>
              </ol>
              <p v-else class="muted">{{ system.status === 'rapor_yok' ? 'Henüz kontrol yok.' : 'Bulgu yok.' }}</p>
              <button v-if="system.findings.length > 3" class="link-button" type="button" @click="toggle(system.id)">
                {{ isOpen(system.id) ? 'Daha az göster' : `Tüm bulgular (${system.findings.length})` }}
              </button>
            </article>
          </div>

          <!-- Sistemler -->
          <section class="card section">
            <div class="section-head">
              <div><h3>Sistemler</h3><small>Satıra tıklayınca ekipmanları ve son kontrol bulguları açılır.</small></div>
              <button class="link-button" type="button" @click="editOpen = true"><i class="pi pi-plus" /> Sistem ekle</button>
            </div>
            <p v-if="detail.pending_systems?.length" class="pending-note">
              <i class="pi pi-hourglass" />
              <span>
                Katalog onayı bekliyor:
                <template v-for="(item, index) in detail.pending_systems" :key="item.id"><strong>{{ item.name }}</strong> ({{ formatDate(item.control_date) }} kontrolü){{ index < detail.pending_systems.length - 1 ? ', ' : '' }}</template>.
                Onaylanınca bu sistemler kontroldeki sonuçlarıyla eklenir.
              </span>
            </p>
            <div v-if="!listSystems.length" class="empty-inline">
              <i class="pi pi-th-large" /> Henüz sistem yok. “Sistem ekle” ile katalogdan seçin.
            </div>
            <div v-else class="system-list">
              <div v-for="system in listSystems" :key="system.id" class="system-item" :class="{ open: isOpen(system.id) }">
                <button class="system-line" type="button" @click="toggle(system.id)">
                  <span class="dot" :class="system.status" />
                  <span class="system-name">
                    <strong>{{ system.name }}</strong>
                    <small>{{ system.last_control_date ? `Son kontrol ${formatDate(system.last_control_date)}` : 'Henüz kontrol yok' }}</small>
                  </span>
                  <span class="meta">{{ system.has_equipment ? `${system.equipment.length} ekipman` : '' }}</span>
                  <span class="meta" :class="{ strong: system.findings.length }">{{ system.findings.length }} bulgu</span>
                  <span class="status-badge" :class="system.status">{{ STATUS_LABELS[system.status] }}</span>
                  <i :class="isOpen(system.id) ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" />
                </button>
                <div v-if="isOpen(system.id)" class="system-body">
                  <template v-if="system.has_equipment">
                    <div class="body-head">
                      <h4>Ekipmanlar</h4>
                      <button class="secondary-button small" type="button" @click="equipmentSystemId = system.id"><i class="pi pi-plus" /> Ekipman ekle</button>
                    </div>
                    <div v-if="system.equipment.length" class="table-wrap">
                      <table class="equipment-table">
                        <thead><tr><th>Ekipman no</th><th>Tür / Etiket</th><th>Konum</th><th>Son kontrol</th><th>Gelecek kontrol</th><th>Kalan gün</th><th>Durum</th></tr></thead>
                        <tbody>
                          <tr v-for="item in system.equipment" :key="item.id" @click="navigateTo(`/expert/equipment/${item.id}`)">
                            <td><strong v-if="item.code">{{ item.code }}</strong><span v-else class="muted">—</span></td>
                            <td>{{ item.type?.name }}<span v-if="item.variant" class="tag">{{ item.variant }}</span></td>
                            <td>{{ item.place || item.workplace?.company_name || 'Lokasyon geneli' }}</td>
                            <td>{{ formatDate(item.last_control_date) }}</td>
                            <td>{{ formatDate(item.next_control_date) }}</td>
                            <td><span class="days" :class="daysKey(item.days_left)">{{ daysText(item.days_left) }}</span></td>
                            <td><span class="status-badge" :class="item.status">{{ EQUIPMENT_STATUS_LABELS[item.status] || item.status }}</span></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p v-else class="muted">Henüz ekipman yok. “Ekipman ekle” ile ekleyin; eklenenler Ekipmanlar menüsünde de görünür.</p>
                  </template>
                  <h4>Son kontrol bulguları</h4>
                  <ol v-if="system.findings.length" class="findings">
                    <li v-for="(finding, index) in system.findings" :key="index">{{ finding }}</li>
                  </ol>
                  <p v-else class="muted">{{ system.status === 'rapor_yok' ? 'Bu sistem henüz bir kontrolde geçmedi.' : 'Bulgu yok.' }}</p>
                </div>
              </div>
            </div>
          </section>

          <!-- Hiçbir sisteme bağlı olmayan bulgular -->
          <section v-if="detail.general_findings.length" class="card section">
            <div class="section-head"><div><h3>Genel bulgular</h3><small>Son raporlu kontrolde herhangi bir sisteme bağlı olmayan bulgular.</small></div></div>
            <ol class="findings padded">
              <li v-for="(finding, index) in detail.general_findings" :key="index">{{ finding }}</li>
            </ol>
          </section>

          <!-- Kontrol geçmişi -->
          <section class="card section">
            <div class="section-head">
              <div><h3>Kontrol geçmişi</h3><small>Tesisatın periyodik kontrol raporları.</small></div>
              <button class="link-button" type="button" @click="reportOpen = true"><i class="pi pi-plus" /> Kontrol ekle</button>
            </div>
            <div v-if="!detail.reports.length" class="empty-inline"><i class="pi pi-history" /> Henüz kontrol yok.</div>
            <div v-else class="table-wrap">
              <table>
                <thead><tr><th>Kontrol tarihi</th><th>Geçerlilik</th><th>Rapor</th><th>Kontrolü yapan</th><th>Genel sonuç</th><th>Uygun olmayan sistem</th><th>Bulgu</th><th>Ekipman</th><th>Ekleyen</th><th /></tr></thead>
                <tbody>
                  <tr v-for="report in detail.reports" :key="report.id" class="static">
                    <td><strong>{{ formatDate(report.control_date) }}</strong></td>
                    <td>{{ formatDate(report.next_control_date) }}</td>
                    <td>
                      <button v-if="report.has_report" class="link-button" type="button" :title="report.report_file_name" @click="openReport(report)"><i class="pi pi-file-pdf" /> {{ report.report_no || 'Görüntüle' }}</button>
                      <span v-else class="muted" :title="report.notes || ''">{{ report.report_no || '—' }}</span>
                    </td>
                    <td>{{ report.inspection_body || '—' }}</td>
                    <td><span class="status-badge" :class="report.status" :title="report.notes || ''">{{ STATUS_LABELS[report.status] }}</span></td>
                    <template v-if="report.status === 'rapor_bekleniyor'"><td>—</td><td>—</td></template>
                    <template v-else>
                      <td>{{ nonconforming(report) }} / {{ report.systems.length }}</td>
                      <td>{{ report.findings.length }}</td>
                    </template>
                    <td>{{ report.equipment_count || '—' }}</td>
                    <td>{{ report.created_by || '—' }}<small class="muted block">{{ SOURCE_LABELS[report.source] || '' }}</small></td>
                    <td class="actions-col">
                      <button class="icon-button" type="button" title="Kontrolü sil" aria-label="Kontrolü sil" @click="deleteReport(report)"><i class="pi pi-trash" /></button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>
      </template>
    </template>

    <ExpertInstallationFormModal
      v-if="createOpen && activeType"
      :type="activeType" :context="context" :workplaces="locationWorkplaces"
      @close="createOpen = false" @saved="onCreated"
    />
    <ExpertInstallationFormModal
      v-if="editOpen && detail && activeType"
      :type="activeType" :context="context" :workplaces="locationWorkplaces" :installation="detail"
      @close="editOpen = false" @saved="onEdited" @deleted="onDeleted"
    />
    <ExpertInstallationReportModal v-if="reportOpen && detail" :installation="detail" @close="reportOpen = false" @saved="onReportSaved" />
    <ExpertInstallationPendingModal v-if="pendingOpen && detail" :installation="detail" @close="pendingOpen = false" @saved="onPendingSaved" />
    <ExpertInstallationEquipmentModal
      v-if="equipmentSystem && detail"
      :installation="detail" :system="equipmentSystem" :types="equipmentTypesOf(equipmentSystem)"
      @close="equipmentSystemId = null" @saved="onEquipmentSaved" @changed="loadDetail"
    />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'expert', middleware: 'expert' })

// Sekmeler: tesisat türleri (sırasıyla). Diğer tesisatlar geldikçe buraya eklenir.
const TAB_SLUGS = ['yangin-tesisati']
const STATUS_LABELS: Record<string, string> = { uygun: 'Uygun', uygun_degil: 'Uygun değil', rapor_bekleniyor: 'Rapor bekleniyor', rapor_yok: 'Kontrol yok', belirtilmemis: 'Belirtilmemiş' }
const STATUS_ICONS: Record<string, string> = { uygun: 'pi pi-check-circle', uygun_degil: 'pi pi-times-circle', rapor_bekleniyor: 'pi pi-hourglass', rapor_yok: 'pi pi-clock', belirtilmemis: 'pi pi-question-circle' }
const EQUIPMENT_STATUS_LABELS: Record<string, string> = { uygun: 'Uygun', uygun_degil: 'Uygun değil', rapor_bekleniyor: 'Rapor bekleniyor', belirtilmemis: 'Belirtilmemiş', rapor_yok: 'Rapor yok' }
const SOURCE_LABELS: Record<string, string> = { manual: 'Elle girildi', ai: 'Yapay zeka ile okundu' }

const { get, del, getBlob, errorMessage } = useExpertApi()
const { context, label: contextLabel } = useWorkplaceContext()
const { groups, load: loadWorkplaces } = useMyWorkplaces()

const catalog = ref<any[]>([])
const installations = ref<any[]>([])
const detail = ref<any>(null)
const loading = ref(false)
const detailLoading = ref(false)
const error = ref('')
const activeSlug = ref(TAB_SLUGS[0])
const selectedId = ref<number | null>(null)
const openIds = ref<number[]>([])
const createOpen = ref(false)
const editOpen = ref(false)
const reportOpen = ref(false)
const pendingOpen = ref(false)

const tabs = computed(() => TAB_SLUGS.map(slug => catalog.value.find(type => type.slug === slug)).filter(Boolean))
const activeType = computed(() => catalog.value.find(type => type.slug === activeSlug.value) || null)
const ofType = computed(() => installations.value.filter(item => item.type?.slug === activeSlug.value))
// Seçili lokasyondaki işyerleri (firmalar).
const locationWorkplaces = computed(() => (groups.value.find(g => g.location_id === context.value?.location_id)?.items || [])
  .map(item => ({ id: item.id, company_name: item.company_name })))

const cardSystems = computed(() => (detail.value?.systems || []).filter((system: any) => system.card))
const listSystems = computed(() => (detail.value?.systems || []).filter((system: any) => !system.card))
const countStatus = (status: string) => (detail.value?.systems || []).filter((system: any) => system.status === status).length
const totalFindings = computed(() => (detail.value?.systems || []).reduce((sum: number, system: any) => sum + system.findings.length, 0) + (detail.value?.general_findings?.length || 0))
const dueText = computed(() => {
  const days = detail.value?.days_left
  if (days === null || days === undefined) return ''
  return days < 0 ? `Kontrol süresi ${-days} gün geçti` : days === 0 ? 'Kontrol süresi bugün doluyor' : `Sonraki kontrole ${days} gün`
})

const isOpen = (id: number) => openIds.value.includes(id)
const toggle = (id: number) => { openIds.value = isOpen(id) ? openIds.value.filter(item => item !== id) : [...openIds.value, id] }
const shownFindings = (system: any) => isOpen(system.id) ? system.findings : system.findings.slice(0, 3)
const cardHint = (system: any) => system.slug?.endsWith('proje-bilgileri') ? 'Tesisatın projeye uygunluğu' : 'Belge ve kayıtların kontrolü'
const nonconforming = (report: any) => report.systems.filter((system: any) => system.status === 'uygun_degil').length

// Sistemin içinden ekipman ekleme: türler sistemin katalogundaki ekipman türleri.
const equipmentSystemId = ref<number | null>(null)
const equipmentSystem = computed(() => (detail.value?.systems || []).find((system: any) => system.id === equipmentSystemId.value) || null)
const equipmentTypesOf = (system: any) => activeType.value?.systems.find((option: any) => option.id === system.system_id)?.equipment_types || []
const onEquipmentSaved = () => {
  equipmentSystemId.value = null
  loadDetail()
}

const daysText = (days: number | null) => days === null || days === undefined ? '—' : days < 0 ? `${-days} gün geçti` : days === 0 ? 'Bugün' : `${days} gün`
const daysKey = (days: number | null) => days === null || days === undefined ? '' : days < 0 ? 'overdue' : days <= 30 ? 'soon' : 'ok'
const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('tr-TR').format(new Date(value)) : '—'

const loadDetail = async () => {
  if (!selectedId.value) { detail.value = null; return }
  detailLoading.value = true
  try {
    detail.value = await get(`/pk-installations/${selectedId.value}`)
  } catch (e: any) {
    error.value = errorMessage(e, 'Tesisat alınamadı.')
  } finally { detailLoading.value = false }
}

const loadInstallations = async () => {
  if (!context.value) { installations.value = []; detail.value = null; return }
  loading.value = true
  error.value = ''
  try {
    installations.value = await get('/pk-installations', {
      location_id: context.value.location_id,
      ...(context.value.type === 'workplace' ? { workplace_id: context.value.workplace_id } : {})
    })
    if (!ofType.value.some(item => item.id === selectedId.value)) selectedId.value = ofType.value[0]?.id ?? null
    await loadDetail()
  } catch (e: any) {
    error.value = errorMessage(e, 'Tesisatlar alınamadı.')
  } finally { loading.value = false }
}

const selectTab = (slug: string) => {
  activeSlug.value = slug
  selectedId.value = ofType.value[0]?.id ?? null
  openIds.value = []
  loadDetail()
}
const selectInstallation = (id: number) => { selectedId.value = id; openIds.value = []; loadDetail() }
const openCreate = () => { createOpen.value = true }

const onCreated = (installation: any) => {
  createOpen.value = false
  selectedId.value = installation.id
  loadInstallations()
}
const onEdited = (installation: any) => {
  editOpen.value = false
  detail.value = installation
  loadInstallations()
}
const onDeleted = () => {
  editOpen.value = false
  selectedId.value = null
  loadInstallations()
}
const onReportSaved = (installation: any) => {
  reportOpen.value = false
  detail.value = installation
  loadInstallations()
}
const onPendingSaved = (installation: any) => {
  pendingOpen.value = false
  detail.value = installation
  loadInstallations()
}

const openReport = async (report: any) => {
  const tab = window.open('', '_blank')
  try {
    const blob = await getBlob(`/pk-installations/${detail.value.id}/reports/${report.id}/file`)
    const blobUrl = URL.createObjectURL(blob)
    if (tab) tab.location.href = blobUrl
    else window.location.href = blobUrl
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
  } catch (e: any) {
    tab?.close()
    alert(errorMessage(e, 'Rapor açılamadı.'))
  }
}

const deleteReport = async (report: any) => {
  const equipmentNote = report.equipment_count ? ` Bu rapordan ${report.equipment_count} ekipmana yazılan kontrol kayıtları da silinir (ekipmanlar kalır).` : ''
  const question = report.status === 'rapor_bekleniyor'
    ? `${formatDate(report.control_date)} tarihli "rapor bekleniyor" kaydı silinsin mi?`
    : `${formatDate(report.control_date)} tarihli kontrol ve raporu silinsin mi?${equipmentNote}`
  if (!confirm(question)) return
  try {
    detail.value = await del(`/pk-installations/${detail.value.id}/reports/${report.id}`)
    loadInstallations()
  } catch (e: any) {
    alert(errorMessage(e, 'Kontrol silinemedi.'))
  }
}

watch(() => context.value && `${context.value.location_id}-${context.value.workplace_id ?? ''}`, () => {
  selectedId.value = null
  openIds.value = []
  loadInstallations()
})

onMounted(async () => {
  loadWorkplaces()
  try { catalog.value = (await get('/pk-installation-catalog')).types } catch { catalog.value = [] }
  loadInstallations()
})
</script>

<style scoped>
.installations-page { max-width: 1500px; margin: 0 auto; }
.page-head { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; margin-bottom:20px; }
.breadcrumb { display:flex; align-items:center; gap:8px; margin-bottom:10px; color:var(--admin-muted); font-size:12px; }.breadcrumb strong{color:var(--admin-heading)}
h1{margin:0;color:var(--admin-heading);font-size:30px;letter-spacing:-.7px}.page-head p{margin:7px 0 0;color:var(--admin-muted);font-size:13px}
h2{margin:0;color:var(--admin-heading);font-size:20px}h3{margin:0;color:var(--admin-heading);font-size:15px}h4{margin:14px 0 8px;color:var(--admin-heading);font-size:12px}
.card{background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px}
.empty-state{display:flex;flex-direction:column;align-items:center;gap:7px;padding:70px 20px;text-align:center;color:var(--admin-muted)}.empty-state i{font-size:28px}.empty-state strong{color:var(--admin-heading)}.empty-state .primary-button{margin-top:10px}
.state{padding:60px 20px;text-align:center;color:var(--admin-muted)}
.tabs{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:14px;border-bottom:1px solid var(--admin-border)}
.tabs button{display:inline-flex;align-items:center;gap:7px;padding:10px 13px;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;background:none;color:var(--admin-muted);font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.tabs button:hover{color:var(--admin-heading)}.tabs button.active{color:var(--admin-heading);border-bottom-color:var(--pk-yellow)}
.picker{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
.chip{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border:1px solid var(--admin-border);border-radius:999px;background:var(--admin-input);color:var(--admin-text);font:inherit;font-size:12px;font-weight:600;cursor:pointer}
.chip span{color:var(--admin-muted);font-size:11px}.chip.active{border-color:#d7a900;background:var(--admin-accent-soft);color:var(--admin-heading)}

/* Genel bilgiler */
.overview{padding:20px;border-left:4px solid var(--admin-border)}
.overview.uygun{border-left-color:var(--admin-success-text)}.overview.uygun_degil{border-left-color:var(--admin-danger-text)}.overview.rapor_yok{border-left-color:var(--admin-muted)}.overview.rapor_bekleniyor{border-left-color:var(--admin-warning-text)}
.overview-main{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.overview-icon{width:48px;height:48px;display:grid;place-items:center;border-radius:12px;background:var(--admin-accent-soft);color:#b45309;flex-shrink:0}.overview-icon i{font-size:22px}
.overview-title{flex:1;min-width:200px}.overview-title p{margin:4px 0 0;color:var(--admin-muted);font-size:12px}
.overview-status{display:flex;flex-direction:column;align-items:flex-end;gap:5px}
.status-pill{display:inline-flex;align-items:center;gap:7px;padding:7px 14px;border-radius:999px;font-size:14px;font-weight:800;white-space:nowrap}
.status-pill.uygun{background:var(--admin-success-bg);color:var(--admin-success-text)}.status-pill.uygun_degil{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.status-pill.rapor_yok,.status-pill.belirtilmemis{background:var(--admin-chip);color:var(--admin-muted)}.status-pill.rapor_bekleniyor{background:var(--admin-warning-bg);color:var(--admin-warning-text)}
.due{font-size:12px;font-weight:700;color:var(--admin-text)}.due.overdue{color:var(--admin-danger-text)}.due.soon{color:var(--admin-warning-text)}
.overview-actions{display:flex;gap:8px}
.notice{display:flex;align-items:flex-start;gap:8px;margin:16px 0 0;padding:12px 14px;border-radius:10px;background:var(--admin-soft);color:var(--admin-text);font-size:12px;line-height:1.5}.notice i{margin-top:2px;color:var(--admin-muted)}
.notice.warn{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.notice.warn i{color:inherit}
.info-strip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;margin-top:16px;border:1px solid var(--admin-border);border-radius:10px;overflow:hidden;background:var(--admin-border)}
.info-strip > div{display:flex;flex-direction:column;gap:4px;padding:11px 14px;background:var(--admin-card);min-width:0}
.info-strip small{color:var(--admin-muted);font-size:11px}.info-strip strong{color:var(--admin-heading);font-size:13px;overflow-wrap:anywhere}
.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}
.stats > div{display:flex;align-items:baseline;gap:8px;padding:12px 14px;border-radius:10px;background:var(--admin-soft)}
.stats strong{color:var(--admin-heading);font-size:22px;line-height:1}.stats small{color:var(--admin-muted);font-size:12px}
.stats .ok strong{color:var(--admin-success-text)}.stats .bad strong{color:var(--admin-danger-text)}.stats .warn strong{color:var(--admin-warning-text)}

/* Belge ve kayıt / proje kartları */
.info-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:14px}
.info-card{padding:16px}
.info-card header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}
.info-card header div{display:flex;flex-direction:column;gap:3px}.info-card header strong{color:var(--admin-heading);font-size:14px}.info-card header small{color:var(--admin-muted);font-size:12px}

/* Bölümler */
.section{margin-top:14px;overflow:hidden}
.section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid var(--admin-border)}
.section-head small{display:block;margin-top:4px;color:var(--admin-muted);font-size:12px}
.empty-inline{display:flex;align-items:center;gap:8px;padding:22px 18px;color:var(--admin-muted);font-size:13px}
.pending-note{display:flex;align-items:flex-start;gap:8px;margin:0;padding:10px 18px;border-bottom:1px solid var(--admin-border);background:var(--admin-warning-bg);color:var(--admin-warning-text);font-size:12px;line-height:1.5}.pending-note i{margin-top:3px}.pending-note strong{color:inherit}
.system-item + .system-item{border-top:1px solid var(--admin-row-border)}
.system-line{width:100%;display:grid;grid-template-columns:12px minmax(0,1fr) 100px 80px 120px 20px;align-items:center;gap:14px;padding:13px 18px;border:0;background:none;color:var(--admin-text);font:inherit;text-align:left;cursor:pointer}
.system-line:hover,.system-item.open .system-line{background:var(--admin-hover)}
.system-line i{color:var(--admin-muted);font-size:12px}
.dot{width:10px;height:10px;border-radius:50%;background:var(--admin-muted)}.dot.uygun{background:var(--admin-success-text)}.dot.uygun_degil{background:var(--admin-danger-text)}
.system-name{display:flex;flex-direction:column;gap:3px;min-width:0}.system-name strong{color:var(--admin-heading);font-size:13px}.system-name small{color:var(--admin-muted);font-size:11px}
.meta{color:var(--admin-muted);font-size:12px;white-space:nowrap}.meta.strong{color:var(--admin-warning-text);font-weight:700}
.system-body{padding:4px 18px 18px 44px;background:var(--admin-hover)}
.body-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:10px 0 8px}.body-head h4{margin:0}
.secondary-button.small{min-height:32px;padding:0 12px;background:var(--admin-card)}
.findings{display:grid;gap:6px;margin:0;padding-left:20px;color:var(--admin-text);font-size:12px;line-height:1.5}.findings.padded{padding:16px 18px 16px 38px}
.link-button{display:inline-flex;align-items:center;gap:6px;margin-top:8px;border:0;background:none;color:var(--admin-link);font:inherit;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}
.section-head .link-button{margin-top:0}td .link-button{margin-top:0}
.muted{margin:0;color:var(--admin-muted);font-size:12px}.block{display:block;margin-top:2px}
.table-wrap{overflow:auto}
table{width:100%;border-collapse:collapse}th,td{padding:12px 16px;text-align:left;border-bottom:1px solid var(--admin-row-border);font-size:12px;color:var(--admin-text);vertical-align:middle}
th{font-size:11px;font-weight:700;color:var(--admin-muted);background:var(--admin-soft);white-space:nowrap}
td strong{color:var(--admin-heading)}
.equipment-table{border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-card)}
.equipment-table tbody tr{cursor:pointer}.equipment-table tbody tr:hover{background:var(--admin-hover)}
.tag{display:inline-block;margin-left:8px;padding:1px 8px;border-radius:999px;border:1px solid var(--admin-border);background:var(--admin-soft);color:var(--admin-text);font-size:10px;font-weight:700}
.days{font-weight:700;white-space:nowrap}.days.overdue{color:var(--admin-danger-text)}.days.soon{color:var(--admin-warning-text)}.days.ok{color:var(--admin-text)}
.status-badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap;justify-self:start}
.status-badge.uygun{background:var(--admin-success-bg);color:var(--admin-success-text)}.status-badge.uygun_degil{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.status-badge.rapor_bekleniyor{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.status-badge.rapor_yok,.status-badge.belirtilmemis{background:var(--admin-chip);color:var(--admin-muted)}
.actions-col{width:1%}
.icon-button{width:32px;height:32px;display:grid;place-items:center;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--admin-muted);cursor:pointer}.icon-button:hover{border-color:var(--admin-border);background:var(--admin-card);color:var(--admin-danger-text)}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 17px;border:0;border-radius:8px;background:var(--pk-yellow);color:#111827;font-size:13px;font-weight:800;cursor:pointer}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.secondary-button{display:inline-flex;align-items:center;gap:7px;min-height:40px;padding:0 16px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-hover);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}
.error-text{color:var(--admin-danger-text);font-size:12px}
@media(max-width:1000px){.info-strip{grid-template-columns:repeat(2,minmax(0,1fr))}.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.info-cards{grid-template-columns:1fr}}
@media(max-width:700px){
  .page-head{align-items:flex-start;flex-direction:column}
  .overview-status{align-items:flex-start}.overview-actions{width:100%}.overview-actions button{flex:1;justify-content:center}
  .system-line{grid-template-columns:12px minmax(0,1fr) auto 20px}.system-line .meta{display:none}
  .system-body{padding-left:18px}
}
</style>
