<template>
  <div class="equipment-page">
    <div class="page-head">
      <div>
        <div class="breadcrumb"><span>Uzman Paneli</span><i class="pi pi-angle-right" /><span>Periyodik Kontroller</span><i class="pi pi-angle-right" /><strong>Ekipmanlar</strong></div>
        <h1>Ekipmanlar</h1>
        <p v-if="context">{{ contextLabel }}</p>
        <p v-else>Üstten lokasyon ve firma seçin.</p>
      </div>
      <div class="head-actions">
        <!-- Rapordan ekipman tanımla: eşleşen ekipmana ekler ya da yeni ekipman tanımlar -->
        <button class="ai-button" type="button" :disabled="!context" @click="fromReportOpen = true"><i class="pi pi-sparkles" /> Rapordan Ekipman Tanımla</button>
        <button class="primary-button" type="button" :disabled="!context" @click="openCreate"><i class="pi pi-plus" /> Yeni Ekipman</button>
      </div>
    </div>

    <div v-if="!context" class="card empty-state">
      <i class="pi pi-map-marker" />
      <strong>Lokasyon seçilmedi</strong>
      <span>Ekipmanları görmek için üstteki Lokasyon kutusundan seçim yapın.</span>
    </div>

    <template v-else>
      <div v-if="visibleCategories.length" class="tabs">
        <button v-for="category in visibleCategories" :key="category.slug" type="button" :class="{ active: categoryFilter === category.slug }" @click="selectCategory(category.slug)">
          {{ category.name }} <span class="count">{{ countByCategory[category.slug] || 0 }}</span>
        </button>
      </div>

      <div v-if="equipment.length" class="filters">
        <div class="type-chips">
          <button v-for="type in visibleTypes" :key="type.id" type="button" class="chip" :class="{ active: typeFilter === type.id }" @click="typeFilter = typeFilter === type.id ? null : type.id">
            {{ type.name }} <span>{{ type.count }}</span>
          </button>
        </div>
        <div v-if="!showForms" class="filter-right">
          <!-- Pasife alınan ekipmanlar varsayılan olarak gizli -->
          <select v-model="activeFilter">
            <option value="active">Aktif olanlar</option>
            <option value="passive">Pasif olanlar</option>
            <option value="all">Tümü</option>
          </select>
          <select v-model="statusFilter">
            <option value="">Tüm durumlar</option>
            <option v-for="(label, key) in STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
            <option value="overdue">Süresi geçmiş</option>
          </select>
          <div class="search-box"><i class="pi pi-search" /><input v-model="search" type="text" placeholder="Kod, marka, seri no ara" /></div>
        </div>
      </div>

      <!-- Yangın söndürme cihazı (tüp) seçiliyken: tüp listesi ve toplu kontrol formları -->
      <div v-if="isTubeType" class="sub-tabs">
        <button type="button" :class="{ active: !showForms }" @click="tubeTab = 'list'"><i class="pi pi-list" /> Tüpler <span class="count">{{ filtered.length }}</span></button>
        <button type="button" :class="{ active: showForms }" @click="tubeTab = 'forms'"><i class="pi pi-file-check" /> Kontrol Formları</button>
      </div>
      <ExpertBulkReportList v-if="showForms" :context="context" :refresh-key="formsKey" @upload="openBulk(null)" @changed="loadEquipment" />

      <section v-else class="card table-card">
        <div v-if="loading" class="state">Ekipmanlar yükleniyor...</div>
        <div v-else-if="error" class="state error-text">{{ error }}</div>
        <div v-else-if="filtered.length === 0" class="state empty-state">
          <i class="pi pi-wrench" />
          <strong>{{ equipment.length ? 'Filtreye uyan ekipman yok' : 'Henüz ekipman yok' }}</strong>
          <span v-if="!equipment.length">"Yeni Ekipman" ile ilk ekipmanınızı ekleyin.</span>
        </div>
        <div v-else class="table-wrap">
          <div v-if="selected.length" class="bulk-bar">
            <strong>{{ selected.length }} ekipman seçildi</strong>
            <button class="link-button" type="button" @click="selected = []">Seçimi temizle</button>
            <span class="bulk-spacer" />
            <button v-if="selectedActive.length" class="secondary-button small" type="button" @click="deactivateIds = selectedActive"><i class="pi pi-ban" /> Pasife al ({{ selectedActive.length }})</button>
            <button v-if="selectedPassive.length" class="secondary-button small" type="button" :disabled="activating" @click="activate(selectedPassive)"><i class="pi pi-check-circle" /> Aktife al ({{ selectedPassive.length }})</button>
            <button class="danger-button" type="button" :disabled="bulkDeleting" @click="bulkDelete">
              <i :class="bulkDeleting ? 'pi pi-spin pi-spinner' : 'pi pi-trash'" /> Seçilenleri sil
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th class="check-col"><input type="checkbox" :checked="allSelected" :indeterminate="selected.length > 0 && !allSelected" title="Tümünü seç" @change="toggleAll" /></th>
                <th class="no-col">Ekipman no</th><th>Tür / Etiket</th><th>Ekipman</th><th>Konum</th><th>Son kontrol</th><th>Gelecek kontrol</th><th>Kalan gün</th><th>Durum</th><th class="actions-col" />
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in filtered" :key="item.id" :class="{ selected: selected.includes(item.id), passive: !item.is_active }" @click="navigateTo(`/expert/equipment/${item.id}`)">
                <td class="check-col" @click.stop><input v-model="selected" type="checkbox" :value="item.id" /></td>
                <td class="no-col"><strong v-if="item.code">{{ item.code }}</strong><span v-else class="muted">—</span></td>
                <td>
                  <div class="type-cell">
                    <span>{{ item.type?.name }}</span>
                    <span v-if="item.variant" class="tag" :title="item.type?.variant_label || 'Etiket'">{{ item.variant }}</span>
                  </div>
                </td>
                <td>
                  <div class="name-cell">
                    <strong>{{ item.name || [item.brand, item.model].filter(Boolean).join(' ') || item.type?.name }}</strong>
                    <small v-if="item.brand || item.model || item.serial_no">{{ [item.brand, item.model, item.serial_no && `SN ${item.serial_no}`].filter(Boolean).join(' · ') }}</small>
                  </div>
                </td>
                <td>
                  <div class="name-cell">
                    <span>{{ item.workplace?.company_name || 'Lokasyon geneli' }}</span>
                    <small v-if="item.place">{{ item.place }}</small>
                  </div>
                </td>
                <td>{{ formatDate(item.last_control_date) }}</td>
                <td>{{ formatDate(item.next_control_date) }}</td>
                <td>
                  <span v-if="!item.is_active" class="passive-tag" :title="passiveTitle(item)">Pasif</span>
                  <span v-else class="days" :class="daysKey(item.days_left)">{{ daysText(item.days_left) }}</span>
                </td>
                <td><span class="status-badge" :class="item.status">{{ STATUS_LABELS[item.status] }}</span></td>
                <td class="actions-col" @click.stop>
                  <div class="row-actions">
                    <button class="icon-button" type="button" title="Önizle" aria-label="Önizle" @click="previewItem = item"><i class="pi pi-eye" /></button>
                    <!-- Pasif ekipmana kontrol eklenmez. Tesisata bağlı ekipman: kontrolü tesisat raporundan gelir (rapor / rapor bekleniyor tesisatta) -->
                    <template v-if="!item.is_active" />
                    <NuxtLink v-else-if="item.installation" class="icon-button" to="/expert/installations" :title="`Kontrolü ${item.installation.name} raporundan gelir`" :aria-label="`Kontrolü ${item.installation.name} raporundan gelir`"><i class="pi pi-sitemap" /></NuxtLink>
                    <template v-else>
                      <button class="icon-button" type="button" title="Yeni Periyodik Kontrol Raporu Yükle" aria-label="Yeni Periyodik Kontrol Raporu Yükle" @click="reportItem = item"><i class="pi pi-file-arrow-up" /></button>
                      <button class="icon-button" type="button" title="Rapor bekleniyor olarak işaretle" aria-label="Rapor bekleniyor olarak işaretle" @click="pendingItem = item"><i class="pi pi-hourglass" /></button>
                    </template>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="table-footer">Toplam {{ filtered.length }} ekipman</div>
        </div>
      </section>
    </template>

    <ExpertEquipmentPreviewModal v-if="previewItem" :summary="previewItem" @close="previewItem = null" @upload="fromPreview('report', $event)" @pending="fromPreview('pending', $event)" />
    <ExpertEquipmentFromReportModal v-if="fromReportOpen" :context="context" :catalog="equipmentCategories" :workplaces="locationWorkplaces" @close="fromReportOpen = false" @continue="onFromReportContinue" @bulk="onFromReportBulk" />
    <ExpertBulkReportModal v-if="bulkOpen" :context="context" :preload="bulkPreload" @close="closeBulk" @saved="onBulkSaved" />
    <ExpertEquipmentReportModal v-if="reportItem" :equipment="reportItem" :preload="reportPreload" :draft="reportDraft" @close="onReportClosed" @saved="onInspectionSaved" />
    <ExpertEquipmentPendingModal v-if="pendingItem" :equipment="pendingItem" @close="pendingItem = null" @saved="onInspectionSaved" />
    <ExpertEquipmentDeactivateModal v-if="deactivateIds.length" :ids="deactivateIds" :title="deactivateTitle" @close="deactivateIds = []" @saved="onDeactivated" />

    <!-- Yeni ekipman -->
    <div v-if="createOpen" class="modal-backdrop" @click.self="closeCreate">
      <section class="modal-card">
        <div class="modal-head">
          <div><h2>Yeni Ekipman</h2><p>{{ context?.location_name }}</p></div>
          <button class="close-button" type="button" @click="closeCreate"><i class="pi pi-times" /></button>
        </div>
        <div class="form-grid">
          <label>Kategori <span>*</span>
            <select v-model="form.category" @change="onFormCategory">
              <option value="" disabled>Seçin</option>
              <option v-for="category in equipmentCategories" :key="category.slug" :value="category.slug">{{ category.name }}</option>
            </select>
          </label>
          <label>Tür <span>*</span>
            <select v-model="form.equipment_type_id" :disabled="!form.category" @change="onFormType">
              <option :value="null" disabled>Seçin</option>
              <option v-for="type in formTypes" :key="type.id" :value="type.id">{{ type.name }}</option>
            </select>
          </label>
          <label v-if="selectedType?.variants?.length">{{ selectedType.variant_label || 'Etiket' }} <small>(Opsiyonel)</small>
            <select v-model="form.variant">
              <option value="">Seçilmedi</option>
              <option v-for="variant in selectedType.variants" :key="variant" :value="variant">{{ variant }}</option>
            </select>
          </label>
          <label>Kod / No<input v-model="form.code" type="text" placeholder="Örn. FL-01" /></label>
          <label>Ekipman adı <small>(Opsiyonel)</small><input v-model="form.name" type="text" :placeholder="selectedType ? `Örn. ${selectedType.name}` : 'Örn. Elektrikli transpalet'" /></label>
          <label>Marka<input v-model="form.brand" type="text" /></label>
          <label>Model <small>(Opsiyonel)</small><input v-model="form.model" type="text" /></label>
          <label>Seri no<input v-model="form.serial_no" type="text" /></label>
          <label>Ait olduğu yer <span>*</span>
            <select v-model="form.location_business_entity_id">
              <option :value="null">Lokasyon geneli</option>
              <option v-for="workplace in locationWorkplaces" :key="workplace.id" :value="workplace.id">{{ workplace.company_name }}</option>
            </select>
          </label>
          <label>Bulunduğu yer <small>(Opsiyonel)</small><input v-model="form.place" type="text" placeholder="Örn. B Blok depo" /></label>
        </div>

        <p v-if="selectedType?.default_period_months" class="hint">Yönetmelikteki azami kontrol süresi: {{ selectedType.default_period_months }} ay</p>
        <p class="hint">Periyodik kontrol raporu, ekipman eklendikten sonra listedeki <i class="pi pi-file-arrow-up" /> ikonundan ya da profil sayfasından yüklenir.</p>

        <p v-if="formError" class="error-text">{{ formError }}</p>
        <div class="modal-actions">
          <button class="secondary-button" type="button" @click="closeCreate">İptal</button>
          <button class="primary-button" type="button" :disabled="saving || !form.equipment_type_id" @click="saveEquipment">{{ saving ? 'Kaydediliyor...' : 'Kaydet' }}</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'expert', middleware: 'expert' })

interface CatalogType { id: number; slug?: string; name: string; default_period_months: number | null; default_scope: 'location' | 'workplace'; variants?: string[]; variant_label?: string | null }
interface CatalogCategory { slug: string; name: string; kind: 'equipment' | 'installation'; types: CatalogType[] }

const STATUS_LABELS: Record<string, string> = { uygun: 'Uygun', uygun_degil: 'Uygun değil', rapor_bekleniyor: 'Rapor bekleniyor', belirtilmemis: 'Belirtilmemiş', rapor_yok: 'Rapor yok' }

const { get, post, errorMessage } = useExpertApi()
const { context, label: contextLabel } = useWorkplaceContext()
const { groups, load: loadWorkplaces } = useMyWorkplaces()

// Liste durumu (kategori, tür, sekme, filtreler) adres satırında: ekipman detayından geri dönünce (geri tuşu ya da
// "← Ekipmanlar") aynı liste açılır.
const route = useRoute()
const router = useRouter()
const queryText = (key: string) => typeof route.query[key] === 'string' ? route.query[key] as string : ''

const catalog = ref<CatalogCategory[]>([])
const equipment = ref<any[]>([])
const loading = ref(false)
const error = ref('')
const categoryFilter = ref<string | null>(queryText('category') || null)
const typeFilter = ref<number | null>(Number(queryText('type')) || null)
const statusFilter = ref(queryText('status'))
const search = ref(queryText('q'))
// Pasife alınan ekipmanlar varsayılan olarak gizli.
const activeFilter = ref<'active' | 'passive' | 'all'>(queryText('active') === 'passive' || queryText('active') === 'all' ? queryText('active') as 'passive' | 'all' : 'active')

// Ekipmanlar ekranı yalnızca "ekipman" kategorilerini gösterir (tesisatlar ayrı menüde).
const equipmentCategories = computed(() => catalog.value.filter(c => c.kind === 'equipment'))
// Aktif / pasif seçimine uyan ekipmanlar: sekme ve tür sayıları ile tablo bunlardan.
const scoped = computed(() => activeFilter.value === 'all' ? equipment.value : equipment.value.filter(item => item.is_active === (activeFilter.value === 'active')))
const countBy = (items: any[]) => items.reduce((acc: Record<string, number>, item) => {
  const slug = item.category?.slug
  if (slug) acc[slug] = (acc[slug] || 0) + 1
  return acc
}, {})
const countByCategory = computed(() => countBy(scoped.value))
// Sekmelerde ekipmanı olan kategoriler görünür (aktif / pasif seçimi sekmeleri değiştirmez).
const visibleCategories = computed(() => {
  const all = countBy(equipment.value)
  return equipmentCategories.value.filter(c => all[c.slug])
})
const inCategory = computed(() => scoped.value.filter(item => item.category?.slug === categoryFilter.value))
const visibleTypes = computed(() => {
  const map = new Map<number, { id: number; name: string; count: number }>()
  for (const item of inCategory.value) {
    if (!item.type) continue
    const entry = map.get(item.type.id) || { id: item.type.id, name: item.type.name, count: 0 }
    entry.count++
    map.set(item.type.id, entry)
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'tr'))
})
const trLower = (value?: string | null) => (value || '').toLocaleLowerCase('tr-TR')
const filtered = computed(() => {
  const q = trLower(search.value.trim())
  return inCategory.value.filter(item =>
    (!typeFilter.value || item.type?.id === typeFilter.value) &&
    (!statusFilter.value || (statusFilter.value === 'overdue' ? item.days_left !== null && item.days_left < 0 : item.status === statusFilter.value)) &&
    (!q || [item.code, item.name, item.brand, item.model, item.serial_no, item.place, item.type?.name, item.variant].some(v => trLower(v).includes(q)))
  )
})

const selectCategory = (slug: string) => { categoryFilter.value = slug; typeFilter.value = null }

// --- Seçim ve toplu silme ---
const selected = ref<number[]>([])
const allSelected = computed(() => filtered.value.length > 0 && filtered.value.every(item => selected.value.includes(item.id)))
const toggleAll = () => { selected.value = allSelected.value ? [] : filtered.value.map(item => item.id) }
// Filtre / sekme değişince görünmeyen ekipmanlar seçimden düşer (görmeden silinmesin).
watch(filtered, items => {
  const visible = new Set(items.map(item => item.id))
  if (selected.value.some(id => !visible.has(id))) selected.value = selected.value.filter(id => visible.has(id))
})
const bulkDeleting = ref(false)
const bulkDelete = async () => {
  if (!confirm(`${selected.value.length} ekipman, fotoğrafları ve tüm kontrol kayıtlarıyla birlikte silinsin mi?`)) return
  bulkDeleting.value = true
  try {
    await post('/pk-equipment/bulk-delete', { ids: selected.value })
    selected.value = []
    await loadEquipment()
  } catch (e: any) {
    alert(errorMessage(e, 'Ekipmanlar silinemedi.'))
  } finally { bulkDeleting.value = false }
}

// --- Pasife alma / aktife alma (seçilenler) ---
const selectedItems = computed(() => equipment.value.filter(item => selected.value.includes(item.id)))
const selectedActive = computed(() => selectedItems.value.filter(item => item.is_active).map(item => item.id))
const selectedPassive = computed(() => selectedItems.value.filter(item => !item.is_active).map(item => item.id))
const deactivateIds = ref<number[]>([])
const deactivateTitle = computed(() => {
  const only = deactivateIds.value.length === 1 ? equipment.value.find(item => item.id === deactivateIds.value[0]) : null
  return only ? [only.name || only.type?.name, only.code && `no ${only.code}`].filter(Boolean).join(' · ') : `${deactivateIds.value.length} ekipman`
})
const onDeactivated = () => {
  deactivateIds.value = []
  selected.value = []
  loadEquipment()
}
const activating = ref(false)
const activate = async (ids: number[]) => {
  if (!confirm(`${ids.length} ekipman aktife alınsın mı?`)) return
  activating.value = true
  try {
    await post('/pk-equipment/bulk-activate', { ids })
    selected.value = []
    await loadEquipment()
  } catch (e: any) {
    alert(errorMessage(e, 'Aktife alınamadı.'))
  } finally { activating.value = false }
}
const passiveTitle = (item: any) => [
  item.deactivated_at && `${formatDate(item.deactivated_at)} tarihinde pasife alındı`,
  DEACTIVATION_REASONS[item.deactivation_reason],
  item.deactivation_note
].filter(Boolean).join(' · ')

// --- Satır aksiyonları: önizleme, rapor yükleme, rapor bekleniyor ---
const previewItem = ref<any>(null)
const reportItem = ref<any>(null)
const pendingItem = ref<any>(null)
const fromPreview = (action: 'report' | 'pending', equipment: any) => {
  previewItem.value = null
  if (action === 'report') reportItem.value = equipment
  else pendingItem.value = equipment
}
const onInspectionSaved = (equipment?: any) => {
  // Rapordan yeni ekipman kaydedildiyse o ekipmanın kategorisi seçilir.
  if (reportDraft.value && equipment?.category?.slug) categoryFilter.value = equipment.category.slug
  reportItem.value = null; reportPreload.value = null; reportDraft.value = null; pendingItem.value = null
  loadEquipment()
}

// --- Rapordan ekipman tanımlama: rapor okunur, eşleşen ekipmana ya da yeni ekipmana aynı analizle rapor penceresi açılır ---
const fromReportOpen = ref(false)
const reportPreload = ref<{ analysisId: string; file: File } | null>(null)
const reportDraft = ref<Record<string, any> | null>(null)
const onFromReportContinue = async (payload: { equipmentId?: number; draft?: Record<string, any>; type?: any; analysisId: string; file: File }) => {
  try {
    // Yeni ekipman henüz oluşturulmadı: rapor penceresi taslakla açılır, "Kaydet"te ekipman + rapor birlikte kaydedilir.
    const equipment = payload.draft
      ? { id: null, name: payload.draft.name, code: payload.draft.code, variant: payload.draft.variant, type: payload.type }
      : await get(`/pk-equipment/${payload.equipmentId}`)
    fromReportOpen.value = false
    reportPreload.value = { analysisId: payload.analysisId, file: payload.file }
    reportDraft.value = payload.draft || null
    reportItem.value = equipment
  } catch (e: any) {
    alert(errorMessage(e, 'Ekipman açılamadı.'))
  }
}
const onReportClosed = () => { reportItem.value = null; reportPreload.value = null; reportDraft.value = null }

// --- Tüp kontrol formları: tüp türü seçiliyken "Tüpler | Kontrol Formları" sekmeleri. Form "Tüp Kontrol Formu Yükle" ile ya da
// "Rapordan Ekipman Tanımla" toplu tüp raporunu tanıyınca (okunmuş olarak) aynı pencereden kaydedilir. ---
const TUBE_SLUG = 'yangin-sondurme-cihazi'
const tubeType = computed(() => {
  for (const category of equipmentCategories.value) {
    const type = category.types.find(item => item.slug === TUBE_SLUG)
    if (type) return { id: type.id, category: category.slug }
  }
  return null
})
const isTubeType = computed(() => !!tubeType.value && typeFilter.value === tubeType.value.id)
const tubeTab = ref<'list' | 'forms'>(queryText('tab') === 'forms' ? 'forms' : 'list')
const showForms = computed(() => isTubeType.value && tubeTab.value === 'forms')
const formsKey = ref(0)
const bulkOpen = ref(false)
const bulkPreload = ref<{ analysis: any; file: File } | null>(null)
const openBulk = (preload: { analysis: any; file: File } | null) => { bulkPreload.value = preload; bulkOpen.value = true }
const closeBulk = () => { bulkOpen.value = false; bulkPreload.value = null }
const onFromReportBulk = (payload: { analysis: any; file: File }) => { fromReportOpen.value = false; openBulk(payload) }
// Kayıttan sonra tüp listesi yenilenir ve Kontrol Formları sekmesi açılır.
const onBulkSaved = async () => {
  closeBulk()
  await loadEquipment()
  if (tubeType.value) {
    categoryFilter.value = tubeType.value.category
    typeFilter.value = tubeType.value.id
  }
  tubeTab.value = 'forms'
  formsKey.value++
}

const daysText = (days: number | null) => days === null || days === undefined ? '—' : days < 0 ? `${-days} gün geçti` : days === 0 ? 'Bugün' : `${days} gün`
const daysKey = (days: number | null) => days === null || days === undefined ? '' : days < 0 ? 'overdue' : days <= 30 ? 'soon' : 'ok'
const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('tr-TR').format(new Date(value)) : '—'

const loadEquipment = async () => {
  if (!context.value) { equipment.value = []; return }
  loading.value = true
  error.value = ''
  try {
    equipment.value = await get('/pk-equipment', {
      location_id: context.value.location_id,
      ...(context.value.type === 'workplace' ? { workplace_id: context.value.workplace_id } : {})
    })
  } catch (e: any) {
    error.value = errorMessage(e, 'Ekipmanlar alınamadı.')
  } finally { loading.value = false }
}

// --- Yeni ekipman ---
const createOpen = ref(false)
const saving = ref(false)
const formError = ref('')
const emptyForm = () => ({
  category: '', equipment_type_id: null as number | null, variant: '', code: '', name: '', brand: '', model: '', serial_no: '', place: '',
  location_business_entity_id: null as number | null
})
const form = reactive(emptyForm())

const formTypes = computed(() => equipmentCategories.value.find(c => c.slug === form.category)?.types || [])
const selectedType = computed(() => formTypes.value.find(t => t.id === form.equipment_type_id) || null)
// Seçili lokasyondaki işyerleri (firmalar).
const locationWorkplaces = computed(() => (groups.value.find(g => g.location_id === context.value?.location_id)?.items || [])
  .map(item => ({ id: item.id, company_name: item.company_name })))
// İşyeri context'indeyse varsayılan o işyeri, türün varsayılan kapsamı lokasyon genelse boş.
const defaultWorkplace = () => context.value?.type === 'workplace' && selectedType.value?.default_scope !== 'location' ? context.value.workplace_id ?? null : null

const openCreate = () => {
  Object.assign(form, emptyForm())
  if (categoryFilter.value) form.category = categoryFilter.value
  form.location_business_entity_id = defaultWorkplace()
  formError.value = ''
  createOpen.value = true
}
const closeCreate = () => { if (!saving.value) createOpen.value = false }
const onFormCategory = () => { form.equipment_type_id = null }
const onFormType = () => { form.location_business_entity_id = defaultWorkplace(); form.variant = '' }

const saveEquipment = async () => {
  if (!context.value || !form.equipment_type_id) return
  saving.value = true
  formError.value = ''
  try {
    await post('/pk-equipment', {
      location_id: context.value.location_id,
      location_business_entity_id: form.location_business_entity_id,
      equipment_type_id: form.equipment_type_id,
      variant: form.variant || null,
      code: form.code.trim() || null,
      name: form.name.trim() || null,
      brand: form.brand.trim() || null,
      model: form.model.trim() || null,
      serial_no: form.serial_no.trim() || null,
      place: form.place.trim() || null
    })
    createOpen.value = false
    categoryFilter.value = form.category
    typeFilter.value = null
    await loadEquipment()
  } catch (e: any) {
    formError.value = errorMessage(e, 'Ekipman kaydedilemedi.')
  } finally { saving.value = false }
}

// Seçili kategori boşaldıysa (ilk açılış, context değişimi) ekipmanı olan ilk kategori seçilir.
// Liste yüklenirken (kategori yok) seçim korunur: adres satırından gelen kategori ve tür kaybolmasın.
watch(visibleCategories, categories => {
  if (!categories.length) return
  if (!categories.some(c => c.slug === categoryFilter.value)) {
    categoryFilter.value = categories[0]?.slug || null
    typeFilter.value = null
  }
})

// Seçimler adres satırına yazılır (geçmişe yeni kayıt eklemeden).
watch([categoryFilter, typeFilter, tubeTab, activeFilter, statusFilter, search], () => {
  const query: Record<string, string> = {}
  if (categoryFilter.value) query.category = categoryFilter.value
  if (typeFilter.value) query.type = String(typeFilter.value)
  if (tubeTab.value === 'forms') query.tab = 'forms'
  if (activeFilter.value !== 'active') query.active = activeFilter.value
  if (statusFilter.value) query.status = statusFilter.value
  if (search.value.trim()) query.q = search.value.trim()
  router.replace({ query })
})

watch(() => context.value && `${context.value.location_id}-${context.value.workplace_id ?? ''}`, () => {
  typeFilter.value = null
  loadEquipment()
})

onMounted(async () => {
  loadWorkplaces()
  try { catalog.value = await get('/equipment-catalog') } catch { catalog.value = [] }
  loadEquipment()
})
</script>

<style scoped>
.equipment-page { max-width: 1500px; margin: 0 auto; }
.page-head { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; margin-bottom:20px; }
.breadcrumb { display:flex; align-items:center; gap:8px; margin-bottom:10px; color:var(--admin-muted); font-size:12px; }.breadcrumb strong{color:var(--admin-heading)}
h1{margin:0;color:var(--admin-heading);font-size:30px;letter-spacing:-.7px}.page-head p{margin:7px 0 0;color:var(--admin-muted);font-size:13px}
h2{margin:0;color:var(--admin-heading);font-size:18px}h3{margin:22px 0 10px;color:var(--admin-heading);font-size:13px}h3 small{font-weight:400;color:var(--admin-muted)}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:0 17px;border:0;border-radius:8px;background:var(--pk-yellow);color:#111827;font-size:13px;font-weight:800;cursor:pointer}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.head-actions{display:flex;flex-wrap:wrap;gap:10px}
.ai-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:0 17px;border:0;border-radius:8px;background:#6d28d9;color:#fff;font-size:13px;font-weight:800;cursor:pointer}.ai-button:hover{background:#5b21b6}.ai-button:disabled{opacity:.55;cursor:not-allowed}
.secondary-button{min-height:40px;padding:0 18px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-hover);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}
.card{background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px}
.empty-state{display:flex;flex-direction:column;align-items:center;gap:7px;padding:70px 20px;text-align:center;color:var(--admin-muted)}.empty-state i{font-size:28px}.empty-state strong{color:var(--admin-heading)}
.tabs{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:14px;border-bottom:1px solid var(--admin-border)}
.tabs button{display:inline-flex;align-items:center;gap:7px;padding:10px 13px;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;background:none;color:var(--admin-muted);font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.tabs button:hover{color:var(--admin-heading)}.tabs button.active{color:var(--admin-heading);border-bottom-color:var(--pk-yellow)}
.count{min-width:20px;padding:1px 7px;border-radius:999px;background:var(--admin-chip);color:var(--admin-muted);font-size:11px;font-weight:700}
.filters{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.type-chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border:1px solid var(--admin-border);border-radius:999px;background:var(--admin-input);color:var(--admin-text);font:inherit;font-size:12px;font-weight:600;cursor:pointer}
.chip span{color:var(--admin-muted);font-size:11px}.chip.active{border-color:#d7a900;background:var(--admin-accent-soft);color:var(--admin-heading)}
.filter-right{display:flex;gap:8px}
.filter-right select{height:38px;padding:0 10px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:12px}
.search-box{height:38px;width:240px;display:flex;align-items:center;gap:8px;padding:0 11px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-muted)}.search-box input{width:100%;border:0;outline:0;background:transparent;color:var(--admin-heading);font-size:12px}
.table-card{overflow:hidden}.table-wrap{overflow:auto}
table{width:100%;border-collapse:collapse}th,td{padding:13px 16px;text-align:left;border-bottom:1px solid var(--admin-row-border);font-size:12px;color:var(--admin-text);vertical-align:middle}
th{font-size:11px;font-weight:700;color:var(--admin-muted);background:var(--admin-soft);white-space:nowrap}
tbody tr{cursor:pointer}tbody tr:hover{background:var(--admin-hover)}tbody tr.selected{background:var(--admin-accent-soft)}
.no-col{width:1%;white-space:nowrap;color:var(--admin-heading);font-size:13px}
.check-col{width:44px;padding-right:0;cursor:default}.check-col input{width:16px;height:16px;accent-color:#d7a900;cursor:pointer;vertical-align:middle}
.actions-col{width:1%;cursor:default}.row-actions{display:flex;justify-content:flex-end;gap:4px}
.icon-button{width:32px;height:32px;display:grid;place-items:center;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--admin-muted);cursor:pointer}.icon-button:hover{border-color:var(--admin-border);background:var(--admin-card);color:var(--admin-heading)}.icon-button i{font-size:15px}
.bulk-bar{display:flex;align-items:center;gap:14px;padding:10px 16px;background:var(--admin-soft);border-bottom:1px solid var(--admin-border);font-size:12px}.bulk-bar strong{color:var(--admin-heading)}
.link-button{border:0;background:none;color:var(--admin-link);font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.sub-tabs{display:flex;gap:4px;margin-bottom:10px}
.sub-tabs button{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 13px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-muted);font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.sub-tabs button:hover{color:var(--admin-heading)}.sub-tabs button.active{border-color:#d7a900;background:var(--admin-accent-soft);color:var(--admin-heading)}
.bulk-spacer{flex:1}
.secondary-button.small{display:inline-flex;align-items:center;gap:7px;min-height:34px;padding:0 13px;background:var(--admin-card)}.secondary-button.small:disabled{opacity:.6}
tbody tr.passive td:not(.check-col):not(.actions-col){opacity:.6}
.passive-tag{display:inline-block;padding:2px 9px;border-radius:999px;background:var(--admin-chip);color:var(--admin-muted);font-size:11px;font-weight:700;cursor:help}
.danger-button{display:inline-flex;align-items:center;gap:7px;margin-left:auto;min-height:34px;padding:0 13px;border:1px solid var(--admin-danger-text);border-radius:8px;background:var(--admin-danger-bg);color:var(--admin-danger-text);font-size:12px;font-weight:700;cursor:pointer}.danger-button:disabled{opacity:.6}
.tag{display:inline-block;margin-left:8px;padding:1px 8px;border-radius:999px;border:1px solid var(--admin-border);background:var(--admin-soft);color:var(--admin-text);font-size:10px;font-weight:700;vertical-align:middle}
.type-cell{display:flex;flex-direction:column;align-items:flex-start;gap:4px;white-space:nowrap}.type-cell > span:first-child{color:var(--admin-heading);font-weight:600}
.type-cell .tag{margin-left:0}
.name-cell{display:flex;flex-direction:column;gap:3px}.name-cell strong{color:var(--admin-heading);font-size:13px}.name-cell small{color:var(--admin-muted);font-size:11px}
.days{font-weight:700;white-space:nowrap}.days.overdue{color:var(--admin-danger-text)}.days.soon{color:var(--admin-warning-text)}.days.ok{color:var(--admin-text)}
.status-badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
.status-badge.uygun{background:var(--admin-success-bg);color:var(--admin-success-text)}.status-badge.uygun_degil{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.status-badge.rapor_bekleniyor{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.status-badge.rapor_yok,.status-badge.belirtilmemis{background:var(--admin-chip);color:var(--admin-muted)}
.state{padding:60px 20px;text-align:center;color:var(--admin-muted)}.table-footer{padding:12px 16px;color:var(--admin-muted);font-size:12px}
.error-text{color:var(--admin-danger-text);font-size:12px}.muted{color:var(--admin-muted);font-size:12px}.hint{margin:6px 0 10px;color:var(--admin-muted);font-size:12px}
.modal-backdrop{position:fixed;inset:0;z-index:100;background:var(--admin-overlay)}
.close-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:var(--admin-muted);cursor:pointer;border-radius:7px}.close-button:hover{background:var(--admin-hover);color:var(--admin-heading)}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px}
.form-grid label{display:block;color:var(--admin-heading);font-size:12px;font-weight:700}.wide{grid-column:1 / -1}
label > span{color:var(--admin-danger-text)}label small{font-weight:400;color:var(--admin-muted)}
.form-grid input,.form-grid select{display:block;width:100%;height:40px;margin-top:6px;padding:0 10px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:13px;outline:0}
.form-grid input:focus,.form-grid select:focus{border-color:#d7a900;box-shadow:0 0 0 3px rgba(255,193,7,.12)}
.modal-backdrop{display:grid;place-items:center;padding:20px}
.modal-card{width:min(620px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:22px;background:var(--admin-card);border-radius:12px;box-shadow:0 20px 60px var(--admin-shadow)}
.modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:18px}.modal-head p{margin:5px 0 0;color:var(--admin-muted);font-size:12px}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
@media(max-width:800px){.page-head{align-items:flex-start;flex-direction:column}.form-grid{grid-template-columns:1fr}.search-box{width:100%}.filter-right{width:100%;flex-direction:column}}
</style>
