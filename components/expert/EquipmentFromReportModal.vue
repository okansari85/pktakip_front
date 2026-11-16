<template>
  <div class="modal-backdrop">
    <section class="modal-card">
      <div class="modal-head">
        <div class="title"><h2>P.K. Raporu Yükle</h2><p>{{ context?.location_name }}<template v-if="context?.type === 'workplace' && context.company_name"> · {{ context.company_name }}</template></p></div>
        <ExpertReportSteps :step="result ? 2 : 1" />
        <button class="close-button" type="button" @click="close"><i class="pi pi-times" /></button>
      </div>

      <input ref="fileInput" type="file" accept="application/pdf" hidden @change="onFile" />
      <div class="rd-grid">
        <div class="rd-left">
          <!-- Katalogdaki görsel (tasarım kataloğu 22'den kırpıldı; marka yazıları silindi); haplarda rapordan okunan no ve model -->
          <figure class="hero">
            <img src="/katalog/rapor-yukle-katalog.webp" alt="" />
            <span class="tag no">Ekipman no: {{ result?.fields?.code || '—' }}</span>
            <span class="tag model">Model: {{ [result?.fields?.brand, result?.fields?.model].filter(Boolean).join(' ') || '—' }}</span>
          </figure>
          <!-- 1) Rapor dosyası -->
          <ExpertReportSource :file="file" :disabled="busy" @pick="fileInput?.click()">
            <strong>Periyodik kontrol raporunu seçin</strong><small>PDF · tek ekipmanlı rapor (forklift, transpalet, kompresör...) ya da tüp kontrol formu</small>
          </ExpertReportSource>
        </div>

        <div class="rd-right">
          <!-- Analiz -->
          <section v-if="!result" class="rd-card">
            <div class="ai-box">
              <template v-if="analyzing">
                <i class="pi pi-spin pi-spinner" />
                <span><strong>Rapor okunuyor...</strong><small>Ekipman türü, bilgileri ve teknik özellikleri çıkarılıyor. 1-3 dakika sürebilir.</small></span>
              </template>
              <template v-else>
                <i class="pi pi-sparkles" />
                <span><strong>Analiz et</strong><small>Rapor mevcut bir ekipmanla eşleşirse ona eklenir, eşleşmezse yeni ekipman tanımlanır.</small></span>
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
          </section>

          <!-- 2) Sonuç: engel / eşleşen ekipman / yeni ekipman -->
          <section v-else class="rd-card">
            <div class="card-head">
              <h3>Okunan bilgileri doğrulayın</h3>
              <span class="done-chip"><i class="pi pi-check-circle" /> Okuma tamamlandı</span>
            </div>
            <p v-if="result.fixture" class="hint"><i class="pi pi-database" /> Test verisi kullanıldı: {{ result.fixture.original_file_name }} (yapay zeka çağrılmadı)</p>
            <p v-if="result.input === 'image'" class="hint warn"><i class="pi pi-image" /> Rapor görüntü olarak kaydedilmiş; yapay zeka sayfa görüntülerinden okudu. Kaydetmeden önce değerleri dikkatle kontrol edin.</p>
            <p v-if="result.input === 'ocr'" class="hint warn"><i class="pi pi-image" /> Rapor taranmış; metin OCR ile okundu. Kaşe ya da imza altında kalan değerler eksik olabilir, kaydetmeden önce kontrol edin.</p>

            <div v-if="result.duplicate" class="duplicate">
              <i class="pi pi-ban" />
              <span>{{ result.duplicate.message }} <NuxtLink :to="`/expert/equipment/${result.duplicate.equipment_id}`" @click="emit('close')">Ekipmana git</NuxtLink></span>
            </div>

            <template v-else>
              <div class="rows">
                <div class="row"><span>Rapor no</span><span class="value">{{ result.report_no || '—' }}</span></div>
                <div class="row"><span>Kontrol tarihi</span><span class="value">{{ formatDate(result.control_date) }}</span></div>
                <div class="row"><span>Yapay zekaya göre tür</span><span class="value">{{ result.detected_type?.name || 'Bulunamadı' }}</span></div>
              </div>
              <p v-if="result.type_evidence" class="hint">Dayanak: “{{ result.type_evidence }}”</p>

              <h4>Bu rapor hangi ekipmanın?</h4>
              <div class="choices">
                <label v-for="candidate in result.candidates" :key="candidate.id" class="choice" :class="{ active: choice === String(candidate.id), strong: candidate.strong }">
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
              <div v-if="choice === 'new'" class="rows new-form">
                <label class="row"><span>Ekipman türü <b class="req">*</b></span>
                  <select v-model="form.equipment_type_id" @change="onType">
                    <option :value="null" disabled>Seçin</option>
                    <optgroup v-for="category in catalog" :key="category.slug" :label="category.name">
                      <option v-for="type in category.types" :key="type.id" :value="type.id">{{ type.name }}</option>
                    </optgroup>
                  </select>
                </label>
                <label v-if="selectedType?.variants?.length" class="row"><span>{{ selectedType.variant_label || 'Etiket' }}</span>
                  <select v-model="form.variant">
                    <option value="">Seçilmedi</option>
                    <option v-for="variant in selectedType.variants" :key="variant" :value="variant">{{ variant }}</option>
                  </select>
                </label>
                <label class="row"><span>Ekipman adı <small>(Opsiyonel)</small></span><input v-model="form.name" type="text" :placeholder="selectedType ? `Örn. ${selectedType.name}` : ''" /></label>
                <label class="row"><span>Ekipman no</span><input v-model="form.code" type="text" /></label>
                <label class="row"><span>Marka</span><input v-model="form.brand" type="text" /></label>
                <label class="row"><span>Model</span><input v-model="form.model" type="text" /></label>
                <label class="row"><span>Seri no</span><input v-model="form.serial_no" type="text" /></label>
                <label class="row"><span>Ait olduğu yer</span>
                  <select v-model="form.location_business_entity_id" @change="onWorkplace">
                    <option :value="null">Lokasyon geneli</option>
                    <option v-for="workplace in workplaces" :key="workplace.id" :value="workplace.id">{{ workplaceLabel(workplace.id, workplace.company_name) }}</option>
                  </select>
                </label>
                <!-- Seçili işyerinin operasyonel birimi varsa -->
                <label v-if="units.length" class="row"><span>Birim <small>(Opsiyonel)</small></span>
                  <select v-model="form.pk_operational_unit_id">
                    <option :value="null">Birim yok</option>
                    <option v-for="unit in units" :key="unit.id" :value="unit.id">{{ unit.name }}</option>
                  </select>
                </label>
                <!-- Lokasyonda alan tanımlıysa: ekipmanın bulunduğu fiziksel yer -->
                <label v-if="areas.length" class="row"><span>Alan <small>(Opsiyonel)</small></span>
                  <select v-model="form.pk_area_id">
                    <option :value="null">Alan yok</option>
                    <option v-for="area in areas" :key="area.id" :value="area.id">{{ areaText(area) }}</option>
                  </select>
                </label>
                <label class="row"><span>Bulunduğu yer</span><input v-model="form.place" type="text" /></label>
              </div>
            </template>
          </section>
          <p v-if="error" class="error-text">{{ error }}</p>
        </div>
      </div>

      <div class="rd-foot">
        <p class="note-bar"><i class="pi pi-info-circle" /> Kaydetmeden önce rapor bilgilerini kontrol edin.</p>
        <div class="modal-actions">
          <button class="secondary-button" type="button" :disabled="busy" @click="close">İptal</button>
          <button v-if="result && !result.duplicate" class="primary-button" type="button" :disabled="busy || !canContinue" @click="proceed">
            Devam — raporu kaydet <i class="pi pi-arrow-right" />
          </button>
        </div>
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

<style scoped src="~/assets/css/rapor-yukleme.css"></style>
<style scoped>
h4{margin:18px 0 10px;color:var(--admin-heading);font-size:15px;font-weight:800}
.choices{display:grid;gap:8px}
.choice{display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border:1px solid var(--admin-border);border-radius:12px;background:var(--admin-card);cursor:pointer}
.choice.active{border-color:var(--pk-accent);background:var(--admin-accent-soft)}
/* Kesin eşleşen ekipman seçiliyken katalogdaki "Mevcut kayıtla eşleşti" kartı */
.choice.active.strong{border-color:var(--admin-success-text);background:var(--admin-success-bg)}
.choice input{margin-top:3px;accent-color:var(--pk-accent)}.choice span{display:flex;flex-direction:column;gap:4px;min-width:0}
.choice strong{color:var(--admin-heading);font-size:14px}.choice small{color:var(--admin-muted);font-size:12px}
.choice em{width:max-content;padding:2px 9px;border-radius:999px;background:var(--admin-chip);color:var(--admin-muted);font-size:11px;font-style:normal;font-weight:700}
.choice em.strong{background:var(--admin-success-text);color:var(--pk-on-accent)}
.other-select{width:100%;height:44px;padding:0 12px;border:1px solid var(--pk-accent);border-radius:10px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:14px;outline:0}
.new-form{margin-top:14px;padding-top:14px;border-top:1px solid var(--admin-border)}
</style>
