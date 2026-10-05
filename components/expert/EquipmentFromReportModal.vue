<template>
  <div class="modal-backdrop">
    <section class="modal-card">
      <div class="modal-head">
        <div><h2><i class="pi pi-sparkles" /> Rapordan Ekipman Tanımla</h2><p>{{ context?.location_name }}<template v-if="context?.type === 'workplace' && context.company_name"> · {{ context.company_name }}</template></p></div>
        <button class="close-button" type="button" @click="close"><i class="pi pi-times" /></button>
      </div>

      <!-- 1) Rapor dosyası + analiz -->
      <input ref="fileInput" type="file" accept="application/pdf" hidden @change="onFile" />
      <button class="file-box" :class="{ filled: file }" type="button" :disabled="busy" @click="fileInput?.click()">
        <i :class="file ? 'pi pi-file-pdf' : 'pi pi-cloud-upload'" />
        <span v-if="file"><strong>{{ file.name }}</strong><small>değiştirmek için tıklayın</small></span>
        <span v-else><strong>Periyodik kontrol raporunu seçin</strong><small>PDF · tek ekipmanlı rapor (forklift, transpalet, kompresör...) ya da tüp kontrol formu</small></span>
      </button>

      <template v-if="!result">
        <div class="ai-box">
          <template v-if="analyzing">
            <i class="pi pi-spin pi-spinner" />
            <span><strong>Rapor okunuyor...</strong><small>Ekipman türü, bilgileri ve teknik özellikleri çıkarılıyor. 1-3 dakika sürebilir.</small></span>
          </template>
          <template v-else>
            <i class="pi pi-sparkles" />
            <span><strong>Yapay zeka raporu okuyacak</strong><small>Rapor mevcut bir ekipmanla eşleşirse ona eklenir, eşleşmezse yeni ekipman tanımlanır.</small></span>
            <button class="ai-button" type="button" :disabled="!file || analyzing" @click="analyze">Analiz et</button>
          </template>
        </div>
        <label v-if="showFixtures && !analyzing && fixtures.length" class="fixture-select">
          <span><i class="pi pi-database" /> Test verisi</span>
          <select v-model="fixtureId">
            <option value="">Kullanma — raporu yapay zeka ile oku</option>
            <option v-for="fixture in fixtures" :key="fixture.fixture_id" :value="fixture.fixture_id">{{ fixtureLabel(fixture) }}</option>
          </select>
        </label>
      </template>

      <!-- 2) Sonuç: engel / eşleşen ekipman / yeni ekipman -->
      <template v-else>
        <p v-if="result.fixture" class="hint"><i class="pi pi-database" /> Test verisi kullanıldı: {{ result.fixture.original_file_name }} (yapay zeka çağrılmadı)</p>
        <p v-if="result.input === 'image'" class="hint warn"><i class="pi pi-image" /> Rapor görüntü olarak kaydedilmiş; yapay zeka sayfa görüntülerinden okudu. Kaydetmeden önce değerleri dikkatle kontrol edin.</p>
        <p v-if="result.input === 'ocr'" class="hint warn"><i class="pi pi-image" /> Rapor taranmış; metin OCR ile okundu. Kaşe ya da imza altında kalan değerler eksik olabilir, kaydetmeden önce kontrol edin.</p>

        <div v-if="result.duplicate" class="duplicate">
          <i class="pi pi-ban" />
          <span>{{ result.duplicate.message }} <NuxtLink :to="`/expert/equipment/${result.duplicate.equipment_id}`" @click="emit('close')">Ekipmana git</NuxtLink></span>
        </div>

        <template v-else>
          <div class="summary">
            <div><small>Rapor no</small><strong>{{ result.report_no || '—' }}</strong></div>
            <div><small>Kontrol tarihi</small><strong>{{ formatDate(result.control_date) }}</strong></div>
            <div><small>Yapay zekaya göre tür</small><strong>{{ result.detected_type?.name || 'Bulunamadı' }}</strong></div>
          </div>
          <p v-if="result.type_evidence" class="hint">Dayanak: “{{ result.type_evidence }}”</p>

          <h4>Bu rapor hangi ekipmanın?</h4>
          <div class="choices">
            <label v-for="candidate in result.candidates" :key="candidate.id" class="choice" :class="{ active: choice === String(candidate.id) }">
              <input v-model="choice" type="radio" :value="String(candidate.id)" />
              <span>
                <strong>Mevcut ekipmana ekle: {{ candidate.name }}<template v-if="candidate.code"> · no {{ candidate.code }}</template></strong>
                <small>{{ [candidate.type, candidate.variant, [candidate.brand, candidate.model].filter(Boolean).join(' '), candidate.serial_no && `SN ${candidate.serial_no}`, candidate.workplace || candidate.location].filter(Boolean).join(' · ') }}</small>
                <em :class="{ strong: candidate.strong }">{{ candidate.reason }}</em>
              </span>
            </label>
            <!-- Rapordaki no / konum kayıtlı ekipmandan farklı yazılmışsa (ör. kontrol firması değişti): ekipman listeden seçilir. -->
            <label v-if="otherOptions.length" class="choice" :class="{ active: choice === 'other' }">
              <input v-model="choice" type="radio" value="other" />
              <span>
                <strong>Başka bir mevcut ekipmana ekle</strong>
                <small>Rapordaki no ya da konum kayıtlı ekipmandan farklı yazılmışsa (ör. kontrol firması değişti) ekipmanı listeden seçin.</small>
              </span>
            </label>
            <select v-if="choice === 'other'" v-model="otherId" class="other-select">
              <option value="" disabled>Ekipman seçin</option>
              <option v-for="item in otherOptions" :key="item.id" :value="String(item.id)">{{ otherText(item) }}</option>
            </select>
            <label class="choice" :class="{ active: choice === 'new' }">
              <input v-model="choice" type="radio" value="new" />
              <span>
                <strong>Yeni ekipman tanımla</strong>
                <small v-if="result.candidates.length">Eşleşen ekipman bu değilse yeni ekipman oluşturulur.</small>
                <small v-else>Rapor mevcut bir ekipmanla eşleşmedi.</small>
              </span>
            </label>
          </div>

          <!-- Yeni ekipman: rapordan dolu, düzeltilebilir -->
          <div v-if="choice === 'new'" class="form-grid">
            <label>Ekipman türü <span>*</span>
              <select v-model="form.equipment_type_id" @change="onType">
                <option :value="null" disabled>Seçin</option>
                <optgroup v-for="category in catalog" :key="category.slug" :label="category.name">
                  <option v-for="type in category.types" :key="type.id" :value="type.id">{{ type.name }}</option>
                </optgroup>
              </select>
            </label>
            <label v-if="selectedType?.variants?.length">{{ selectedType.variant_label || 'Etiket' }}
              <select v-model="form.variant">
                <option value="">Seçilmedi</option>
                <option v-for="variant in selectedType.variants" :key="variant" :value="variant">{{ variant }}</option>
              </select>
            </label>
            <label>Ekipman adı <small>(Opsiyonel)</small><input v-model="form.name" type="text" :placeholder="selectedType ? `Örn. ${selectedType.name}` : ''" /></label>
            <label>Ekipman no<input v-model="form.code" type="text" /></label>
            <label>Marka<input v-model="form.brand" type="text" /></label>
            <label>Model<input v-model="form.model" type="text" /></label>
            <label>Seri no<input v-model="form.serial_no" type="text" /></label>
            <label>Ait olduğu yer
              <select v-model="form.location_business_entity_id" @change="onWorkplace">
                <option :value="null">Lokasyon geneli</option>
                <option v-for="workplace in workplaces" :key="workplace.id" :value="workplace.id">{{ workplaceLabel(workplace.id, workplace.company_name) }}</option>
              </select>
            </label>
            <!-- Seçili işyerinin operasyonel birimi varsa -->
            <label v-if="units.length">Birim <small>(Opsiyonel)</small>
              <select v-model="form.pk_operational_unit_id">
                <option :value="null">Birim yok</option>
                <option v-for="unit in units" :key="unit.id" :value="unit.id">{{ unit.name }}</option>
              </select>
            </label>
            <!-- Lokasyonda alan tanımlıysa: ekipmanın bulunduğu fiziksel yer -->
            <label v-if="areas.length">Alan <small>(Opsiyonel)</small>
              <select v-model="form.pk_area_id">
                <option :value="null">Alan yok</option>
                <option v-for="area in areas" :key="area.id" :value="area.id">{{ areaText(area) }}</option>
              </select>
            </label>
            <label class="wide">Bulunduğu yer<input v-model="form.place" type="text" /></label>
          </div>
        </template>
      </template>

      <p v-if="error" class="error-text">{{ error }}</p>
      <div class="modal-actions">
        <button class="secondary-button" type="button" :disabled="busy" @click="close">İptal</button>
        <button v-if="result && !result.duplicate" class="primary-button" type="button" :disabled="busy || !canContinue" @click="proceed">
          Devam — raporu kaydet <i class="pi pi-arrow-right" />
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// Test verisi seçeneği yalnızca süper admine (müşteri hesabına girmiş olsa da).
const { superAdmin: showFixtures } = useAuth()
// Rapordan ekipman tanımlama: rapor okunur (tür dahil), mevcut ekipmanla eşleşirse ona eklenir, eşleşmezse yeni ekipman
// oluşturulur; ardından aynı analizle (Gemini tekrar çağrılmadan) rapor penceresi açılır.
const props = defineProps<{
  context: any
  catalog: { slug: string; name: string; types: { id: number; name: string; default_scope?: string; variants?: string[]; variant_label?: string | null }[] }[]
  workplaces: { id: number; company_name: string }[]
  // Sayfadaki ekipman listesi (çalışma alanının): "Başka bir mevcut ekipmana ekle" seçenekleri.
  equipment?: any[]
}>()
const emit = defineEmits<{
  close: []
  // areaId: yeni ekipman için seçilen alan (lokasyonda alan varsa); rapor kaydedilince ekipmana yazılır.
  continue: [payload: { equipmentId?: number; draft?: Record<string, any>; type?: any; analysisId: string; file: File; areaId?: number | null; unitId?: number | null }]
  // Rapor toplu tüp kontrol formu: okunmuş haliyle tüp kontrol formu penceresine geçilir.
  bulk: [payload: { analysis: any; file: File }]
}>()

const { postForm, errorMessage } = useExpertApi()

const fileInput = ref<HTMLInputElement | null>(null)
const file = ref<File | null>(null)
const { fixtures, fixtureLabel, loadFixtures } = useReportFixtures()
const fixtureId = ref('')
const analyzing = ref(false)
const error = ref('')
const result = ref<any>(null)
const choice = ref('new')
const form = reactive({
  equipment_type_id: null as number | null, variant: '', name: '', code: '', brand: '', model: '', serial_no: '',
  location_business_entity_id: null as number | null, place: '', pk_area_id: null as number | null, pk_operational_unit_id: null as number | null
})
// İşyeri adı, operasyonel birim ve alan (isteğe bağlı): tanımlı değilse kutular görünmez. Birim seçili işyerinin birimlerinden,
// alan (fiziksel yer) lokasyonun alanlarından; ikisi de ekipmanın firmasını değiştirmez.
const { load: loadNames, workplaceLabel } = useWorkplaceNames()
const { options: areaOptions, load: loadAreas } = useLocationAreas()
const { load: loadUnits, unitsOf } = useOperationalUnits()
const areas = computed(() => areaOptions.value.filter(area => area.active))
const units = computed(() => unitsOf(form.location_business_entity_id))
const onWorkplace = () => { if (!units.value.some(unit => unit.id === form.pk_operational_unit_id)) form.pk_operational_unit_id = null }

const busy = computed(() => analyzing.value)
const types = computed(() => props.catalog.flatMap(category => category.types))
const selectedType = computed(() => types.value.find(type => type.id === form.equipment_type_id) || null)

// Başka bir mevcut ekipman: yapay zekanın bulduğu türdeki (tür bulunamadıysa tümü) aktif ekipmanlar; önerilenler, tesisata
// bağlı olanlar (kontrolü tesisat raporundan gelir) hariç; no'ya göre sıralı.
const otherId = ref('')
const otherOptions = computed(() => {
  const typeId = result.value?.detected_type?.id
  const suggested = new Set((result.value?.candidates || []).map((candidate: any) => candidate.id))
  return (props.equipment || [])
    .filter(item => (!typeId || item.type?.id === typeId) && item.is_active !== false && !item.installation && !suggested.has(item.id))
    .sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''), 'tr', { numeric: true }) || String(a.place || '').localeCompare(String(b.place || ''), 'tr'))
})
const otherText = (item: any) => [
  item.code ? `no ${item.code}` : 'no yok', item.place, item.workplace && workplaceLabel(item.workplace.id, item.workplace.company_name),
  !result.value?.detected_type && item.type?.name, item.name
].filter(Boolean).join(' · ')

const canContinue = computed(() => choice.value === 'other' ? !!otherId.value : choice.value !== 'new' || !!form.equipment_type_id)
const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('tr-TR').format(new Date(value)) : '—'
const defaultWorkplace = () => props.context?.type === 'workplace' && selectedType.value?.default_scope !== 'location' ? props.context.workplace_id ?? null : null

const close = () => { if (!busy.value) emit('close') }
const onFile = (event: Event) => {
  const selected = (event.target as HTMLInputElement).files?.[0]
  if (fileInput.value) fileInput.value.value = ''
  if (!selected) return
  file.value = selected
  result.value = null
  error.value = ''
}
const onType = () => {
  if (!selectedType.value?.variants?.includes(form.variant)) form.variant = ''
  if (!form.pk_operational_unit_id) { form.location_business_entity_id = defaultWorkplace(); onWorkplace() }
}

const analyze = async () => {
  if (!file.value) return
  analyzing.value = true
  error.value = ''
  const body = new FormData()
  if (fixtureId.value) body.append('fixture_id', fixtureId.value)
  else body.append('report', file.value)
  // Seri no yokken aynı lokasyondaki aday ekipman seçili gelir.
  if (props.context?.location_id) body.append('location_id', String(props.context.location_id))
  try {
    const data = await postForm('/pk-equipment/report-analysis', body)
    if (data.bulk) {
      emit('bulk', { analysis: data, file: file.value })
      return
    }
    result.value = data
    const strong = data.candidates.find((candidate: any) => candidate.strong)
    choice.value = strong ? String(strong.id) : 'new'
    otherId.value = ''
    Object.assign(form, {
      equipment_type_id: data.detected_type?.id ?? null,
      variant: data.fields?.variant || '',
      name: '',
      code: data.fields?.code || '',
      brand: data.fields?.brand || '',
      model: data.fields?.model || '',
      serial_no: data.fields?.serial_no || '',
      place: data.fields?.place || '',
      pk_area_id: null,
      pk_operational_unit_id: null
    })
    form.location_business_entity_id = defaultWorkplace()
    if (!selectedType.value?.variants?.includes(form.variant)) form.variant = ''
  } catch (e: any) {
    error.value = errorMessage(e, 'Rapor analiz edilemedi.')
  } finally { analyzing.value = false }
}

// Mevcut ekipman: rapor ona eklenir. Yeni ekipman: burada oluşturulmaz; rapor kaydedilince ekipmanla birlikte oluşturulur.
const proceed = () => {
  if (!result.value || !file.value) return
  if (choice.value !== 'new') {
    const equipmentId = Number(choice.value === 'other' ? otherId.value : choice.value)
    emit('continue', { equipmentId, analysisId: result.value.analysis_id, file: file.value })
    return
  }
  const clean = (value: string) => value.trim() || null
  emit('continue', {
    analysisId: result.value.analysis_id,
    file: file.value,
    type: selectedType.value,
    areaId: form.pk_area_id,
    unitId: form.pk_operational_unit_id,
    draft: {
      location_id: props.context.location_id,
      location_business_entity_id: form.location_business_entity_id,
      equipment_type_id: form.equipment_type_id,
      variant: form.variant || null,
      name: clean(form.name), code: clean(form.code), brand: clean(form.brand), model: clean(form.model),
      serial_no: clean(form.serial_no), place: clean(form.place)
    }
  })
}

onMounted(loadFixtures)
onMounted(() => Promise.all([loadAreas(props.context?.location_id), loadUnits(props.context?.location_id), loadNames()]))
</script>

<style scoped>
.modal-backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:var(--admin-overlay)}
.modal-card{width:min(680px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:22px;background:var(--admin-card);border-radius:12px;box-shadow:0 20px 60px var(--admin-shadow)}
.modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:18px}
h2{display:flex;align-items:center;gap:8px;margin:0;color:var(--admin-heading);font-size:18px}h2 i{color:#6d28d9}.modal-head p{margin:5px 0 0;color:var(--admin-muted);font-size:12px}
h4{margin:16px 0 8px;color:var(--admin-heading);font-size:13px}
.close-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:var(--admin-muted);cursor:pointer;border-radius:7px}.close-button:hover{background:var(--admin-hover);color:var(--admin-heading)}
.file-box{width:100%;display:flex;align-items:center;gap:14px;padding:16px;border:1.5px dashed var(--admin-border);border-radius:10px;background:var(--admin-soft);color:var(--admin-muted);text-align:left;cursor:pointer;font:inherit}
.file-box:hover{border-color:#6d28d9}.file-box.filled{border-style:solid}.file-box i{font-size:24px}.file-box.filled i{color:var(--admin-danger-text)}
.file-box span,.ai-box span{display:flex;flex-direction:column;gap:3px;min-width:0}.file-box strong,.ai-box strong{color:var(--admin-heading);font-size:13px;overflow-wrap:anywhere}.file-box small,.ai-box small{font-size:11px;color:var(--admin-muted)}
.ai-box{display:flex;align-items:center;gap:14px;margin-top:14px;padding:16px;border:1px solid var(--admin-border);border-radius:10px}.ai-box > i{font-size:22px;color:#6d28d9}.ai-box .ai-button{margin-left:auto;flex-shrink:0}
.fixture-select{display:flex;align-items:center;gap:10px;margin-top:10px;padding:8px 12px;border:1px dashed var(--admin-border);border-radius:9px;font-size:12px;color:var(--admin-muted)}
.fixture-select span{display:inline-flex;align-items:center;gap:6px;font-weight:700;white-space:nowrap}
.fixture-select select{flex:1;min-width:0;height:34px;padding:0 8px;border:1px solid var(--admin-border);border-radius:7px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:12px}
.hint{display:flex;align-items:center;gap:6px;margin:12px 0 0;color:var(--admin-muted);font-size:12px}
.hint.warn{color:var(--admin-warning-text)}
.duplicate{display:flex;align-items:flex-start;gap:10px;margin-top:14px;padding:12px 14px;border:1px solid var(--admin-danger-text);border-radius:10px;background:var(--admin-danger-bg);color:var(--admin-danger-text);font-size:13px;font-weight:700}.duplicate a{margin-left:6px;color:inherit;text-decoration:underline}
.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}
.summary div{display:flex;flex-direction:column;gap:3px;padding:10px 12px;border:1px solid var(--admin-border);border-radius:9px;background:var(--admin-soft)}.summary small{color:var(--admin-muted);font-size:11px}.summary strong{color:var(--admin-heading);font-size:13px}
.choices{display:grid;gap:6px}
.choice{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid var(--admin-border);border-radius:9px;cursor:pointer}.choice.active{border-color:#6d28d9;background:var(--admin-soft)}
.choice input{margin-top:3px;accent-color:#6d28d9}.choice span{display:flex;flex-direction:column;gap:3px;min-width:0}.choice strong{color:var(--admin-heading);font-size:13px}.choice small{color:var(--admin-muted);font-size:11px}
.other-select{width:100%;height:40px;padding:0 10px;border:1px solid #6d28d9;border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:13px;outline:0}
.choice em{width:max-content;padding:1px 8px;border-radius:999px;background:var(--admin-chip);color:var(--admin-muted);font-size:10px;font-style:normal;font-weight:700}.choice em.strong{background:var(--admin-success-bg);color:var(--admin-success-text)}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px;margin-top:12px}
.form-grid label{display:block;color:var(--admin-heading);font-size:12px;font-weight:700}.form-grid label small{font-weight:400;color:var(--admin-muted)}.form-grid label > span{color:var(--admin-danger-text)}.wide{grid-column:1 / -1}
.form-grid input,.form-grid select{display:block;width:100%;height:40px;margin-top:6px;padding:0 10px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:13px;outline:0}
.form-grid input:focus,.form-grid select:focus{border-color:#6d28d9;box-shadow:0 0 0 3px rgba(109,40,217,.12)}
.error-text{margin:12px 0 0;color:var(--admin-danger-text);font-size:12px}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
.primary-button,.ai-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 17px;border:0;border-radius:8px;font-size:13px;font-weight:800;cursor:pointer}
.primary-button{background:var(--pk-yellow);color:#111827}.ai-button{background:#6d28d9;color:#fff}.primary-button:disabled,.ai-button:disabled{opacity:.55;cursor:not-allowed}
.secondary-button{min-height:40px;padding:0 18px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-hover);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}
@media(max-width:640px){.form-grid,.summary{grid-template-columns:1fr}}
</style>
