<template>
  <div class="profile-page">
    <a href="/expert/equipment" class="back-link" @click.prevent="goBack"><i class="pi pi-arrow-left" /> {{ backLabel }}</a>

    <div v-if="loading" class="card state">Ekipman yükleniyor...</div>
    <div v-else-if="loadError" class="card state error-text">{{ loadError }}</div>

    <template v-else-if="equipment">
      <div class="page-head">
        <div>
          <h1>{{ equipment.name || equipment.type?.name }}<span v-if="equipment.variant" class="tag" :title="equipment.type?.variant_label || 'Etiket'">{{ equipment.variant }}</span></h1>
          <p>{{ equipment.location?.name }}<template v-if="currentArea"> · {{ currentArea.label }}</template> · {{ workplaceText }}<template v-if="currentUnit"> · {{ currentUnit.name }}</template><template v-if="equipment.place"> · {{ equipment.place }}</template></p>
        </div>
        <div class="head-side">
          <span class="status-badge big" :class="equipment.status">{{ STATUS_LABELS[equipment.status] }}</span>
          <button v-if="equipment.is_active" class="secondary-button" type="button" @click="deactivateOpen = true"><i class="pi pi-ban" /> Pasife al</button>
          <button v-else class="secondary-button" type="button" :disabled="activating" @click="activate"><i class="pi pi-check-circle" /> Aktife al</button>
        </div>
      </div>

      <!-- Pasif ekipman: geçmişi kalır, kontrol eklenmez -->
      <p v-if="!equipment.is_active" class="passive-note">
        <i class="pi pi-ban" />
        <span>
          <strong>Pasif</strong> · {{ formatDate(equipment.deactivated_at) }} tarihinde pasife alındı<template v-if="equipment.deactivation_reason">: {{ reasons[equipment.deactivation_reason] || equipment.deactivation_reason }}</template>.
          <template v-if="equipment.deactivation_note"> {{ equipment.deactivation_note }}</template>
          Kontrol eklenmez, kalan gün hesabına ve tesisat listesine girmez.
        </span>
      </p>

      <div class="top-grid">
        <!-- Fotoğraf -->
        <section class="card photo-card">
          <div class="photo" :class="{ empty: !equipment.photo_url }">
            <img v-if="equipment.photo_url" :src="equipment.photo_url" :alt="equipment.type?.name" />
            <div v-else class="photo-placeholder"><i class="pi pi-image" /><span>Fotoğraf yok</span></div>
          </div>
          <input ref="photoInput" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="uploadPhoto" />
          <div class="photo-actions">
            <button class="secondary-button" type="button" :disabled="photoBusy" @click="photoInput?.click()">
              <i :class="photoBusy ? 'pi pi-spin pi-spinner' : 'pi pi-upload'" /> {{ equipment.photo_url ? 'Değiştir' : 'Fotoğraf yükle' }}
            </button>
            <button v-if="equipment.photo_url" class="link-button danger" type="button" :disabled="photoBusy" @click="removePhoto">Kaldır</button>
          </div>
          <p v-if="photoError" class="error-text">{{ photoError }}</p>
        </section>

        <!-- Özet + bilgiler -->
        <section class="card">
          <div class="dates">
            <div><small>Son kontrol</small><strong>{{ formatDate(equipment.last_control_date) }}</strong></div>
            <div><small>Gelecek kontrol</small><strong>{{ formatDate(equipment.next_control_date) }}</strong></div>
            <div><small>Kalan gün</small><strong class="days" :class="daysKey(equipment.days_left)">{{ equipment.is_active ? daysText(equipment.days_left) : 'Pasif' }}</strong></div>
          </div>

          <!-- Ürün sayfası gibi: Bilgiler | Teknik özellikler -->
          <div class="tabs">
            <button type="button" :class="{ active: tab === 'info' }" @click="tab = 'info'">Bilgiler</button>
            <button type="button" :class="{ active: tab === 'specs' }" @click="tab = 'specs'; editing = false">Teknik özellikler <span class="count">{{ equipment.properties?.length || 0 }}</span></button>
            <button v-if="tab === 'info' && !editing" class="link-button tab-action" type="button" @click="startEdit"><i class="pi pi-pencil" /> Düzenle</button>
          </div>

          <ExpertEquipmentProperties v-if="tab === 'specs'" :equipment-id="equipment.id" :properties="equipment.properties || []" :pending-specs="equipment.pending_specs || []" @updated="equipment = $event" />

          <dl v-else-if="!editing" class="info">
            <dt>Ekipman no</dt><dd>{{ equipment.code || '—' }}</dd>
            <template v-if="equipment.type?.variants?.length"><dt>{{ equipment.type.variant_label || 'Etiket' }}</dt><dd>{{ equipment.variant || '—' }}</dd></template>
            <dt>Ekipman adı</dt><dd>{{ equipment.name || '—' }}</dd>
            <dt>Marka / Model</dt><dd>{{ [equipment.brand, equipment.model].filter(Boolean).join(' / ') || '—' }}</dd>
            <dt>Seri no</dt><dd>{{ equipment.serial_no || '—' }}</dd>
            <dt>Ait olduğu yer</dt><dd>{{ workplaceText }}</dd>
            <!-- İşyerinde birim / lokasyonda alan tanımlıysa -->
            <template v-if="currentUnit || unitsOf(equipment.workplace?.id).length"><dt>Birim</dt><dd>{{ currentUnit?.name || '—' }}</dd></template>
            <template v-if="areaOptions.length"><dt>Alan</dt><dd>{{ currentArea ? areaText(currentArea) : '—' }}</dd></template>
            <dt>Bulunduğu yer</dt><dd>{{ equipment.place || '—' }}</dd>
            <dt>Not</dt><dd>{{ equipment.notes || '—' }}</dd>
          </dl>

          <div v-else>
            <div class="form-grid">
              <label>Ekipman no<input v-model="editForm.code" type="text" /></label>
              <label v-if="equipment.type?.variants?.length">{{ equipment.type.variant_label || 'Etiket' }}
                <select v-model="editForm.variant">
                  <option value="">Seçilmedi</option>
                  <option v-for="variant in equipment.type.variants" :key="variant" :value="variant">{{ variant }}</option>
                </select>
              </label>
              <label>Ekipman adı<input v-model="editForm.name" type="text" :placeholder="equipment.type?.name" /></label>
              <label>Marka<input v-model="editForm.brand" type="text" /></label>
              <label>Model<input v-model="editForm.model" type="text" /></label>
              <label>Seri no<input v-model="editForm.serial_no" type="text" /></label>
              <label>Ait olduğu yer
                <select v-model="editForm.location_business_entity_id" @change="onEditWorkplace">
                  <option :value="null">Lokasyon geneli</option>
                  <option v-for="workplace in locationWorkplaces" :key="workplace.id" :value="workplace.id">{{ workplaceLabel(workplace.id, workplace.company_name) }}</option>
                </select>
              </label>
              <!-- Birim yalnızca seçilen işyerinin birimleri; işyerinde birim yoksa görünmez. Alan fiziksel yer, firmadan bağımsız. -->
              <label v-if="editUnits.length">Birim
                <select v-model="editForm.pk_operational_unit_id">
                  <option :value="null">Birim yok</option>
                  <option v-for="unit in editUnits" :key="unit.id" :value="unit.id">{{ unit.name }}</option>
                </select>
              </label>
              <label v-if="selectableAreas.length">Alan
                <select v-model="editForm.pk_area_id">
                  <option :value="null">Alan yok</option>
                  <option v-for="area in selectableAreas" :key="area.id" :value="area.id">{{ areaText(area) }}</option>
                </select>
              </label>
              <label>Bulunduğu yer<input v-model="editForm.place" type="text" /></label>
              <label class="wide">Not<textarea v-model="editForm.notes" rows="2" /></label>
            </div>
            <p v-if="editError" class="error-text">{{ editError }}</p>
            <div class="actions">
              <button class="secondary-button" type="button" @click="editing = false">İptal</button>
              <button class="primary-button" type="button" :disabled="savingEdit" @click="saveEdit">{{ savingEdit ? 'Kaydediliyor...' : 'Kaydet' }}</button>
            </div>
          </div>
        </section>
      </div>

      <!-- Kontrol geçmişi -->
      <section class="card table-card">
        <div class="history-head">
          <h2>Kontrol geçmişi <span class="count">{{ equipment.inspections?.length || 0 }}</span></h2>
          <div v-if="!equipment.is_active" class="history-actions">
            <span class="bound-note"><i class="pi pi-info-circle" /> Pasif ekipmana kontrol eklenmez; önce aktife alın.</span>
          </div>
          <!-- Tesisata bağlı ekipman: kontrolü tesisat raporundan gelir, rapor ve rapor bekleniyor tesisatta girilir -->
          <div v-else-if="equipment.installation" class="history-actions">
            <span class="bound-note"><i class="pi pi-info-circle" /> Kontrolü {{ equipment.installation.name }} raporundan gelir.</span>
            <NuxtLink class="secondary-button" to="/expert/installations">{{ equipment.installation.name }} <i class="pi pi-arrow-right" /></NuxtLink>
          </div>
          <div v-else class="history-actions">
            <button class="secondary-button" type="button" @click="pendingOpen = true"><i class="pi pi-hourglass" /> Rapor bekleniyor</button>
            <button class="primary-button" type="button" @click="reportOpen = true"><i class="pi pi-file-arrow-up" /> Yeni Periyodik Kontrol Raporu Yükle</button>
          </div>
        </div>
        <div v-if="!equipment.inspections?.length" class="state">Henüz kontrol kaydı yok.</div>
        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Kontrol tarihi</th>
                <th>Gelecek kontrol</th>
                <th>Durum</th>
                <th>Kontrolü yapan</th>
                <th>Sonuç ve kanaat</th>
                <th>Bulgular</th>
                <th>Rapor</th>
                <th>Kaynak</th>
                <th>Kaydeden</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <template v-for="(inspection, index) in equipment.inspections" :key="inspection.id">
              <tr>
                <td><strong>{{ formatDate(inspection.control_date) }}</strong><small v-if="index === 0" class="current-tag">Geçerli</small></td>
                <td>{{ formatDate(inspection.next_control_date) }}</td>
                <td><span class="status-badge" :class="inspection.status">{{ STATUS_LABELS[inspection.status] }}</span></td>
                <td class="body-cell"><span v-if="inspection.inspection_body" class="clamp" :title="inspection.inspection_body">{{ inspection.inspection_body }}</span><span v-else class="muted">—</span></td>
                <td class="note-cell">
                  <span v-if="inspection.conclusion" class="clamp">{{ inspection.conclusion }}</span>
                  <span v-else-if="inspection.note" class="muted">{{ inspection.note }}</span>
                  <span v-else class="muted">—</span>
                </td>
                <td>
                  <button v-if="inspection.findings?.length" class="link-button" type="button" @click="toggleAnalysis(inspection.id)">
                    {{ inspection.findings.length }} bulgu <i :class="openAnalysis === inspection.id ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" />
                  </button>
                  <span v-else class="muted">Yok</span>
                </td>
                <td>
                  <button v-if="inspection.has_report" class="link-button" type="button" :title="inspection.report_file_name" @click="openReport(inspection)"><i class="pi pi-file-pdf" /> {{ inspection.report_no || 'Görüntüle' }}</button>
                  <span v-else class="muted">—</span>
                </td>
                <td>
                  <button v-if="inspection.analysis" class="link-button" type="button" @click="toggleAnalysis(inspection.id)">
                    <i class="pi pi-sparkles" /> {{ SOURCE_LABELS[inspection.source] }} <i :class="openAnalysis === inspection.id ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" />
                  </button>
                  <template v-else>{{ SOURCE_LABELS[inspection.source] }}</template>
                </td>
                <td>{{ inspection.created_by || '—' }}<small class="muted-cell block">{{ formatDateTime(inspection.created_at) }}</small></td>
                <td class="row-delete">
                  <div class="row-actions">
                    <button class="icon-button edit" type="button" title="Kontrol kaydını düzenle" aria-label="Kontrol kaydını düzenle" @click="editingInspection = inspection"><i class="pi pi-pencil" /></button>
                    <span v-if="inspection.from_installation" class="icon-button locked" title="Tesisat raporundan geldi; Tesisatlar'da o kontrol silinince silinir."><i class="pi pi-lock" /></span>
                    <span v-else-if="inspection.from_bulk" class="icon-button locked" title="Tüp kontrol formundan geldi; Kontrol Formları'nda o form silinince silinir."><i class="pi pi-lock" /></span>
                    <button v-else class="icon-button" type="button" title="Kontrol kaydını sil" aria-label="Kontrol kaydını sil" @click="removeInspection(inspection)"><i class="pi pi-trash" /></button>
                  </div>
                </td>
              </tr>
              <tr v-if="openAnalysis === inspection.id" class="analysis-row">
                <td colspan="10">
                  <div v-if="inspection.conclusion || inspection.findings?.length" class="inspection-detail">
                    <div v-if="inspection.conclusion"><h4>Sonuç ve kanaat</h4><p>{{ inspection.conclusion }}</p></div>
                    <div>
                      <h4>Bulgular</h4>
                      <ol v-if="inspection.findings?.length"><li v-for="(finding, findingIndex) in inspection.findings" :key="findingIndex">{{ finding }}</li></ol>
                      <p v-else class="muted">Bulgu yok.</p>
                    </div>
                  </div>
                  <template v-if="inspection.analysis">
                    <h4 class="analysis-title"><i class="pi pi-sparkles" /> Yapay zeka analizi</h4>
                    <ExpertEquipmentAnalysisDetail :analysis="inspection.analysis" :equipment-id="equipment.id" :inspection-id="inspection.id" @updated="equipment = $event" />
                  </template>
                </td>
              </tr>
              </template>
            </tbody>
          </table>
        </div>
      </section>

      <button class="link-button danger delete" type="button" @click="removeEquipment"><i class="pi pi-trash" /> Ekipmanı sil</button>
    </template>

    <ExpertEquipmentReportModal v-if="reportOpen && equipment" :equipment="equipment" @close="reportOpen = false" @saved="onInspectionSaved" />
    <ExpertEquipmentPendingModal v-if="pendingOpen && equipment" :equipment="equipment" @close="pendingOpen = false" @saved="onInspectionSaved" />
    <ExpertEquipmentInspectionEditModal v-if="editingInspection && equipment" :equipment="equipment" :inspection="editingInspection" @close="editingInspection = null" @saved="onInspectionSaved" />
    <ExpertEquipmentDeactivateModal
      v-if="deactivateOpen && equipment"
      :ids="[equipment.id]" :title="[equipment.name || equipment.type?.name, equipment.code && `no ${equipment.code}`].filter(Boolean).join(' · ')"
      @close="deactivateOpen = false" @saved="onDeactivated"
    />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'expert', middleware: 'expert' })

const STATUS_LABELS: Record<string, string> = { uygun: 'Uygun', uygun_degil: 'Uygun değil', rapor_bekleniyor: 'Rapor bekleniyor', belirtilmemis: 'Belirtilmemiş', rapor_yok: 'Rapor yok' }
const SOURCE_LABELS: Record<string, string> = { manual: 'Elle', ai: 'Yapay zeka' }

const route = useRoute()
const router = useRouter()
const { get, post, patch, postForm, del, getBlob, errorMessage } = useExpertApi()

// Geri: geldiği sayfaya (Ekipmanlar listesi seçili kategori / tür / sekmesiyle, Tesisatlar, Analiz geçmişi...) döner;
// sayfa doğrudan açıldıysa Ekipmanlar.
const backPath = ref<string | null>(null)
const backLabel = computed(() => backPath.value?.startsWith('/expert/installations') ? 'Tesisatlar'
  : backPath.value?.startsWith('/expert/settings/analyses') ? 'Analiz geçmişi' : 'Ekipmanlar')
const goBack = () => { if (backPath.value) router.back(); else navigateTo('/expert/equipment') }
const { groups, load: loadWorkplaces } = useMyWorkplaces()

const id = computed(() => String(route.params.id))
const equipment = ref<any>(null)
const loading = ref(true)
const loadError = ref('')

const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('tr-TR').format(new Date(value)) : '—'
const formatDateTime = (value?: string | null) => value ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'
const daysText = (days: number | null) => days === null || days === undefined ? '—' : days < 0 ? `${-days} gün geçti` : days === 0 ? 'Bugün' : `${days} gün`
const daysKey = (days: number | null) => days === null || days === undefined ? '' : days < 0 ? 'overdue' : days <= 30 ? 'soon' : 'ok'

const load = async () => {
  loading.value = true
  loadError.value = ''
  try {
    equipment.value = await get(`/pk-equipment/${id.value}`)
    const locationId = equipment.value?.location?.id
    await Promise.all([loadAreas(locationId, true), loadUnits(locationId, true)])
  }
  catch (e: any) { loadError.value = errorMessage(e, 'Ekipman bulunamadı.') }
  finally { loading.value = false }
}

// --- Alan (isteğe bağlı): lokasyonda alan tanımlıysa gösterilir ve düzenlenir; yoksa hiç görünmez ---
const { options: areaOptions, assignments: areaAssignments, byId: areaById, load: loadAreas, setEquipmentArea } = useLocationAreas()
const currentAreaId = computed<number | null>(() => areaAssignments.value.equipment[String(id.value)] ?? null)
const currentArea = computed(() => currentAreaId.value ? areaById.value.get(currentAreaId.value) || null : null)
const selectableAreas = computed(() => areaOptions.value.filter(area => area.active || area.id === currentAreaId.value))

// --- Birim (isteğe bağlı): işyerinde birim tanımlıysa gösterilir; ekipmanın firmasını değiştirmez ---
const { assignments: unitAssignments, byId: unitById, load: loadUnits, unitsOf, setEquipmentUnit } = useOperationalUnits()
const currentUnitId = computed<number | null>(() => unitAssignments.value[String(id.value)] ?? null)
const currentUnit = computed(() => currentUnitId.value ? unitById.value.get(currentUnitId.value) || null : null)

// --- İşyeri adı: "Ad · Firma" ---
const { load: loadNames, workplaceLabel } = useWorkplaceNames()
const workplaceText = computed(() => equipment.value?.workplace ? workplaceLabel(equipment.value.workplace.id, equipment.value.workplace.company_name) : 'Lokasyon geneli')

// --- Fotoğraf ---
const photoInput = ref<HTMLInputElement | null>(null)
const photoBusy = ref(false)
const photoError = ref('')
const uploadPhoto = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  photoBusy.value = true
  photoError.value = ''
  const form = new FormData()
  form.append('photo', file)
  try { equipment.value = await postForm(`/pk-equipment/${id.value}/photo`, form) }
  catch (e: any) { photoError.value = errorMessage(e, 'Fotoğraf yüklenemedi.') }
  finally {
    photoBusy.value = false
    if (photoInput.value) photoInput.value.value = ''
  }
}
const removePhoto = async () => {
  if (!confirm('Fotoğraf kaldırılsın mı?')) return
  photoBusy.value = true
  try { equipment.value = await del(`/pk-equipment/${id.value}/photo`) }
  catch (e: any) { photoError.value = errorMessage(e, 'Fotoğraf kaldırılamadı.') }
  finally { photoBusy.value = false }
}

// --- Bilgileri düzenle ---
const tab = ref<'info' | 'specs'>('info')
const editing = ref(false)
const savingEdit = ref(false)
const editError = ref('')
const editForm = reactive({ code: '', variant: '', name: '', brand: '', model: '', serial_no: '', place: '', notes: '', location_business_entity_id: null as number | null, pk_area_id: null as number | null, pk_operational_unit_id: null as number | null })
const locationWorkplaces = computed(() => (groups.value.find(g => g.location_id === equipment.value?.location?.id)?.items || [])
  .map(item => ({ id: item.id, company_name: item.company_name })))
const editUnits = computed(() => unitsOf(editForm.location_business_entity_id, currentUnitId.value))
// İşyeri değişince başka işyerinin birimi kalamaz.
const onEditWorkplace = () => {
  if (editForm.pk_operational_unit_id && !editUnits.value.some(unit => unit.id === editForm.pk_operational_unit_id)) editForm.pk_operational_unit_id = null
}
const startEdit = () => {
  const e = equipment.value
  Object.assign(editForm, {
    code: e.code || '', variant: e.variant || '', name: e.name || '', brand: e.brand || '', model: e.model || '', serial_no: e.serial_no || '',
    place: e.place || '', notes: e.notes || '', location_business_entity_id: e.workplace?.id ?? null, pk_area_id: currentAreaId.value, pk_operational_unit_id: currentUnitId.value
  })
  editError.value = ''
  editing.value = true
}
const saveEdit = async () => {
  savingEdit.value = true
  editError.value = ''
  const clean = (v: string) => v.trim() || null
  try {
    equipment.value = await patch(`/pk-equipment/${id.value}`, {
      code: clean(editForm.code), name: clean(editForm.name), brand: clean(editForm.brand), model: clean(editForm.model),
      serial_no: clean(editForm.serial_no), place: clean(editForm.place), notes: clean(editForm.notes),
      location_business_entity_id: editForm.location_business_entity_id,
      ...(equipment.value.type?.variants?.length ? { variant: editForm.variant || null } : {})
    })
    // Birim ve alan değiştiyse ayrıca yazılır (firma yukarıda kaydedildi, bunlar firmayı değiştirmez); bilgiler yeniden alınır.
    const unitChanged = editForm.pk_operational_unit_id !== currentUnitId.value
    const areaChanged = areaOptions.value.length > 0 && editForm.pk_area_id !== currentAreaId.value
    if (unitChanged) await setEquipmentUnit(Number(id.value), editForm.pk_operational_unit_id)
    if (areaChanged) await setEquipmentArea(Number(id.value), editForm.pk_area_id)
    if (unitChanged || areaChanged) await load()
    editing.value = false
  } catch (e: any) { editError.value = errorMessage(e, 'Bilgiler kaydedilemedi.') }
  finally { savingEdit.value = false }
}

// --- Periyodik kontrol raporu yükleme / rapor bekleniyor ---
const reportOpen = ref(false)
const pendingOpen = ref(false)
const editingInspection = ref<any>(null)
const onInspectionSaved = (data: any) => { equipment.value = data; reportOpen.value = false; pendingOpen.value = false; editingInspection.value = null }

// Yapay zeka ile okunan raporun kaydedilmiş analizi satırın altında açılır.
const openAnalysis = ref<number | null>(null)
const toggleAnalysis = (inspectionId: number) => { openAnalysis.value = openAnalysis.value === inspectionId ? null : inspectionId }

// Rapor dosyası yetkili istekle alınır ve yeni sekmede açılır (sekme, açılır pencere engeline takılmamak için önce açılır).
// Kontrol kaydını siler: rapor dosyası ve o rapordan gelen teknik özellik değerleri de silinir (özellikler önceki duruma döner).
const removeInspection = async (inspection: any) => {
  const label = [inspection.report_no && `rapor no ${inspection.report_no}`, `kontrol tarihi ${formatDate(inspection.control_date)}`].filter(Boolean).join(', ')
  if (!confirm(`Bu kontrol kaydı silinsin mi? (${label})\n\nRapor dosyası ve bu rapordan gelen teknik özellik değerleri de silinir; özellikler bir önceki duruma döner.`)) return
  try { equipment.value = await del(`/pk-equipment/${id.value}/inspections/${inspection.id}`) }
  catch (e: any) { alert(errorMessage(e, 'Kontrol kaydı silinemedi.')) }
}

const openReport = async (inspection: any) => {
  const tab = window.open('', '_blank')
  try {
    const blob = await getBlob(`/pk-equipment/${id.value}/inspections/${inspection.id}/report`)
    const blobUrl = URL.createObjectURL(blob)
    if (tab) tab.location.href = blobUrl
    else window.location.href = blobUrl
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
  } catch (e: any) {
    tab?.close()
    alert(errorMessage(e, 'Rapor açılamadı.'))
  }
}

// --- Pasife alma / aktife alma: geçmiş kalır ---
const reasons = DEACTIVATION_REASONS
const deactivateOpen = ref(false)
// Sayfa "yükleniyor"a düşmeden yenilenir.
const refresh = async () => { equipment.value = await get(`/pk-equipment/${id.value}`) }
const onDeactivated = async () => {
  deactivateOpen.value = false
  try { await refresh() } catch (e: any) { alert(errorMessage(e, 'Ekipman yenilenemedi.')) }
}
const activating = ref(false)
const activate = async () => {
  if (!confirm('Ekipman aktife alınsın mı?')) return
  activating.value = true
  try {
    await post('/pk-equipment/bulk-activate', { ids: [equipment.value.id] })
    await refresh()
  } catch (e: any) { alert(errorMessage(e, 'Aktife alınamadı.')) }
  finally { activating.value = false }
}

const removeEquipment = async () => {
  if (!confirm('Bu ekipman, fotoğrafı ve tüm kontrol kayıtları silinsin mi?')) return
  try {
    await del(`/pk-equipment/${id.value}`)
    await navigateTo('/expert/equipment')
  } catch (e: any) { loadError.value = errorMessage(e, 'Ekipman silinemedi.') }
}

onMounted(() => {
  // Uygulama içinden gelindiyse önceki sayfanın adresi (vue-router geçmiş kaydı).
  const back = window.history.state?.back
  backPath.value = typeof back === 'string' && back.startsWith('/expert') ? back : null
  load()
  loadWorkplaces()
  loadNames()
})
</script>

<style scoped>
.profile-page { max-width: 1500px; margin: 0 auto; display: grid; gap: 16px; }
.back-link{display:inline-flex;align-items:center;gap:7px;width:max-content;color:var(--admin-muted);font-size:12px;font-weight:700}.back-link:hover{color:var(--admin-heading)}
.page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}
.head-side{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.passive-note{display:flex;align-items:flex-start;gap:8px;margin:0;padding:12px 14px;border-radius:10px;background:var(--admin-chip);color:var(--admin-text);font-size:12px;line-height:1.5}.passive-note i{margin-top:2px;color:var(--admin-muted)}.passive-note strong{color:var(--admin-heading)}
.tag{display:inline-block;margin-left:10px;padding:3px 10px;border-radius:999px;border:1px solid var(--admin-border);background:var(--admin-soft);color:var(--admin-text);font-size:12px;font-weight:700;letter-spacing:0;vertical-align:middle}
h1{margin:4px 0 0;color:var(--admin-heading);font-size:28px;letter-spacing:-.6px}.page-head p{margin:6px 0 0;color:var(--admin-muted);font-size:13px}
h2{margin:0 0 14px;color:var(--admin-heading);font-size:15px}
.card{padding:18px;background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px;min-width:0}
.state{padding:60px 20px;text-align:center;color:var(--admin-muted)}
.top-grid{display:grid;grid-template-columns:minmax(260px,340px) 1fr;gap:16px;align-items:start}
.photo{aspect-ratio:4/3;border-radius:10px;overflow:hidden;background:var(--admin-soft);border:1px solid var(--admin-border)}
.photo img{width:100%;height:100%;object-fit:cover;display:block}
.photo-placeholder{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--admin-muted);font-size:12px}.photo-placeholder i{font-size:34px}
.photo-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px}
.dates{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.dates div{display:flex;flex-direction:column;gap:4px;padding:12px;border-radius:10px;background:var(--admin-soft);border:1px solid var(--admin-border)}
.dates small{color:var(--admin-muted);font-size:11px}.dates strong{color:var(--admin-heading);font-size:15px}
.days.overdue{color:var(--admin-danger-text)}.days.soon{color:var(--admin-warning-text)}
.info{display:grid;grid-template-columns:max-content 1fr;gap:8px 18px;margin:0;font-size:13px}.info dt{color:var(--admin-muted)}.info dd{margin:0;color:var(--admin-heading)}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px}
.form-grid label{display:block;color:var(--admin-heading);font-size:12px;font-weight:700}.form-grid label small{font-weight:400;color:var(--admin-muted)}.wide{grid-column:1 / -1}
.form-grid input,.form-grid select,.form-grid textarea{display:block;width:100%;margin-top:6px;padding:0 10px;height:40px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:13px;outline:0}
.form-grid textarea{height:auto;padding:9px 10px;resize:vertical}
.form-grid input:focus,.form-grid select:focus,.form-grid textarea:focus{border-color:#d7a900;box-shadow:0 0 0 3px rgba(255,193,7,.12)}
.actions{display:flex;justify-content:flex-end;gap:10px;margin-top:14px}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 17px;border:0;border-radius:8px;background:var(--pk-yellow);color:#111827;font-size:13px;font-weight:800;cursor:pointer}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.secondary-button{display:inline-flex;align-items:center;gap:7px;min-height:36px;padding:0 13px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}.secondary-button:disabled{opacity:.6}
.link-button{display:inline-flex;align-items:center;gap:6px;border:0;background:none;color:var(--admin-link);font:inherit;font-size:12px;font-weight:700;cursor:pointer}.link-button.danger{color:var(--admin-danger-text)}
.delete{width:max-content}
.status-badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}.status-badge.big{padding:7px 14px;font-size:13px}
.status-badge.uygun{background:var(--admin-success-bg);color:var(--admin-success-text)}.status-badge.uygun_degil{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.status-badge.rapor_bekleniyor{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.status-badge.rapor_yok,.status-badge.belirtilmemis{background:var(--admin-chip);color:var(--admin-muted)}
.count{margin-left:6px;padding:1px 7px;border-radius:999px;background:var(--admin-chip);color:var(--admin-muted);font-size:11px}
.table-card{padding:0;overflow:hidden}
.history-head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;padding:14px 18px}.history-head h2{margin:0}.history-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.bound-note{display:inline-flex;align-items:center;gap:6px;color:var(--admin-muted);font-size:12px}
a.secondary-button{text-decoration:none}
.row-delete .icon-button.locked{cursor:default}.row-delete .icon-button.locked:hover{background:transparent;color:var(--admin-muted)}
.table-wrap{overflow:auto}
table{width:100%;border-collapse:collapse}th,td{padding:12px 18px;text-align:left;border-bottom:1px solid var(--admin-row-border);font-size:12px;color:var(--admin-text);vertical-align:middle}
th{font-size:11px;font-weight:700;color:var(--admin-muted);background:var(--admin-soft);white-space:nowrap}
tbody tr:last-child td{border-bottom:0}.tabs{display:flex;align-items:center;gap:2px;margin:16px 0 12px;border-bottom:1px solid var(--admin-border)}
.tabs button{display:inline-flex;align-items:center;gap:6px;padding:9px 12px;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;background:none;color:var(--admin-muted);font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.tabs button:hover{color:var(--admin-heading)}.tabs button.active{color:var(--admin-heading);border-bottom-color:var(--pk-yellow)}
.tabs .tab-action{margin-left:auto;border-bottom:0;font-size:12px;color:var(--admin-link)}
.row-delete{width:1%}.row-delete .icon-button{width:28px;height:28px;display:grid;place-items:center;border:0;border-radius:7px;background:transparent;color:var(--admin-muted);cursor:pointer;opacity:.45}
tr:hover .row-delete .icon-button{opacity:1}.row-delete .icon-button:hover{background:var(--admin-hover);color:var(--admin-danger-text)}
.row-actions{display:flex;gap:2px}.row-delete .icon-button.edit:hover{color:var(--admin-link)}
.body-cell{min-width:160px;max-width:240px}.block{display:block;margin-top:2px}
.analysis-row td{background:var(--admin-soft);padding:16px 18px}
.clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.inspection-detail{display:grid;gap:12px;margin-bottom:14px}.inspection-detail h4,.analysis-title{display:flex;align-items:center;gap:6px;margin:0 0 6px;color:var(--admin-heading);font-size:12px}
.inspection-detail p{margin:0;color:var(--admin-text);font-size:12px;line-height:1.5;white-space:pre-line}
.inspection-detail ol{margin:0;padding-left:20px;display:grid;gap:4px;color:var(--admin-text);font-size:12px;line-height:1.45}
.analysis-title{padding-top:12px;border-top:1px solid var(--admin-border)}td strong{color:var(--admin-heading)}
.current-tag{margin-left:8px;padding:1px 7px;border-radius:999px;background:var(--admin-chip);color:var(--admin-muted);font-size:10px;font-weight:700}
.note-cell{min-width:200px;max-width:420px;white-space:pre-line}.muted-cell{color:var(--admin-muted);white-space:nowrap}
.hint{margin:8px 0 0;color:var(--admin-muted);font-size:12px}.muted{color:var(--admin-muted);font-size:12px}.error-text{margin:8px 0 0;color:var(--admin-danger-text);font-size:12px}
@media(max-width:1000px){.top-grid{grid-template-columns:1fr}.dates{grid-template-columns:1fr 1fr 1fr}}
@media(max-width:640px){.form-grid{grid-template-columns:1fr}.dates{grid-template-columns:1fr}.page-head{flex-direction:column;align-items:flex-start}}
</style>
