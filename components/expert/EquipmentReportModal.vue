<template>
  <div class="modal-backdrop">
    <section class="modal-card">
      <div class="modal-head">
        <div><h2>Yeni Periyodik Kontrol Raporu Yükle</h2><p>{{ equipment.name || equipment.type?.name }}<template v-if="equipment.code"> · Ekipman no {{ equipment.code }}</template></p></div>
        <button class="close-button" type="button" @click="close"><i class="pi pi-times" /></button>
      </div>

      <!-- Rapor dosyası (her iki yolda da zorunlu: dijital arşiv) -->
      <input ref="fileInput" type="file" accept="application/pdf,image/jpeg,image/png" hidden @change="onFile" />
      <button class="file-box" :class="{ filled: file }" type="button" :disabled="busy" @click="fileInput?.click()">
        <i :class="file ? 'pi pi-file-pdf' : 'pi pi-cloud-upload'" />
        <span v-if="file"><strong>{{ file.name }}</strong><small>{{ fileSize }} · değiştirmek için tıklayın</small></span>
        <span v-else><strong>Rapor dosyasını seçin</strong><small>PDF, JPG ya da PNG · en fazla 50 MB</small></span>
      </button>

      <div class="mode">
        <button type="button" :class="{ active: mode === 'manual' }" :disabled="busy" @click="setMode('manual')"><i class="pi pi-pencil" /> Elle doldur</button>
        <button type="button" :class="{ active: mode === 'ai' }" :disabled="busy" @click="setMode('ai')"><i class="pi pi-sparkles" /> Yapay zeka ile analiz et</button>
      </div>

      <!-- Yapay zeka: önce analiz, sonra öneri formda gözden geçirilir -->
      <template v-if="mode === 'ai'">
        <!-- Analizden önce: başlat + test verisi seçimi -->
        <template v-if="!analysis">
          <p v-if="file && !isPdf && !fixtureId" class="hint warn">Yapay zeka analizi yalnızca PDF raporlarda çalışır. Görsel raporu "Elle doldur" ile yükleyin.</p>
          <div v-else class="ai-box">
            <template v-if="analyzing">
              <i class="pi pi-spin pi-spinner" />
              <span><strong>Rapor okunuyor...</strong><small>Bu işlem 1-3 dakika sürebilir, pencereyi kapatmayın.</small></span>
            </template>
            <template v-else>
              <i class="pi pi-sparkles" />
              <span><strong>Rapor yapay zeka ile okunacak</strong><small>Sonuç, kontrol tarihi ve geçerlilik tarihi doldurulur; kaydetmeden önce kontrol edersiniz.</small></span>
              <button class="primary-button" type="button" :disabled="!file && !fixtureId" @click="analyze">Analiz et</button>
            </template>
          </div>
          <!-- Test: yapay zeka yerine test sayfasında kaydedilmiş analiz -->
          <label v-if="!analyzing && fixtures.length" class="fixture-select">
            <span><i class="pi pi-database" /> Test verisi</span>
            <select v-model="fixtureId">
              <option value="">Kullanma — raporu yapay zeka ile oku</option>
              <option v-for="fixture in fixtures" :key="fixture.fixture_id" :value="fixture.fixture_id">{{ fixtureLabel(fixture) }}</option>
            </select>
          </label>
        </template>

        <!-- Analizden sonra: eşleşme + öneri -->
        <template v-else>
          <p v-if="analysis.fixture" class="hint test-note"><i class="pi pi-database" /> Test verisi kullanıldı: {{ analysis.fixture.original_file_name }} (yapay zeka çağrılmadı)</p>
          <p v-if="analysis.input === 'image'" class="hint warn test-note"><i class="pi pi-image" /> Rapor görüntü olarak kaydedilmiş; yapay zeka sayfa görüntülerinden okudu. Kaydetmeden önce değerleri dikkatle kontrol edin.</p>
          <p v-if="analysis.input === 'ocr'" class="hint warn test-note"><i class="pi pi-image" /> Rapor taranmış; metin OCR ile okundu. Kaşe ya da imza altında kalan değerler eksik olabilir, kaydetmeden önce kontrol edin.</p>

          <!-- Aynı rapor daha önce yüklendiyse kaydedilemez -->
          <div v-if="analysis.duplicate" class="duplicate">
            <i class="pi pi-ban" />
            <span>{{ analysis.duplicate.message }} <NuxtLink v-if="analysis.duplicate.equipment_id !== equipment.id" :to="`/expert/equipment/${analysis.duplicate.equipment_id}`" @click="emit('close')">Ekipmana git</NuxtLink></span>
          </div>

          <!-- Rapor bu ekipmana ait mi: seri no, marka, model, ekipman no, tür -->
          <div v-if="analysis.match && !analysis.duplicate" class="match" :class="matchStatus">
            <div class="match-head"><i :class="MATCH_ICONS[matchStatus]" /> {{ matchText }}</div>
            <!-- Eşleşince tablo gerekmez; farkı göstermek için yalnızca eşleşmeyince -->
            <table v-if="matchStatus !== 'match' && analysis.match.checks?.length">
              <thead><tr><th /><th>Kayıtlı</th><th>Raporda</th><th /></tr></thead>
              <tbody>
                <tr v-for="check in analysis.match.checks" :key="check.field" :class="check.result">
                  <td>{{ check.label }}</td><td>{{ check.equipment }}</td><td>{{ check.report || '—' }}</td><td><i :class="CHECK_ICONS[check.result]" /></td>
                </tr>
              </tbody>
            </table>
            <div v-if="blocked && !mismatchConfirmed" class="match-actions">
              <button class="secondary-button" type="button" @click="fileInput?.click()">Başka rapor seç</button>
              <button class="danger-button" type="button" @click="mismatchConfirmed = true">Yine de devam et</button>
            </div>
          </div>

          <template v-if="formVisible">
            <p v-if="!analysis.status" class="hint warn form-hint">Raporun genel sonucu net okunamadı, durumu siz seçin.</p>
            <p v-if="analysis.next_control_source === 'period'" class="hint form-hint">Raporda geçerlilik tarihi bulunamadı; gelecek kontrol, türün {{ equipment.type?.default_period_months }} aylık periyoduna göre hesaplandı.</p>
          </template>
        </template>
      </template>

      <!-- Kontrol bilgileri: elle ya da yapay zeka önerisiyle dolu -->
      <div v-if="formVisible" class="form-grid">
        <label>Durum <span>*</span>
          <select v-model="form.status">
            <option value="" disabled>Seçin</option>
            <option value="uygun">Uygun</option>
            <option value="uygun_degil">Uygun değil</option>
          </select>
        </label>
        <label>Kontrol tarihi <span>*</span><input v-model="form.control_date" type="date" @change="onControlDate" /></label>
        <label>Gelecek kontrol<input v-model="form.next_control_date" type="date" @input="nextTouched = true" /></label>
        <label>Rapor no<input v-model="form.report_no" type="text" placeholder="Raporda yazan numara" /></label>
        <label>Kontrolü yapan kuruluş<input v-model="form.inspection_body" type="text" placeholder="Periyodik kontrolü yapan firma" /></label>
        <label class="wide">Sonuç ve kanaat<textarea v-model="form.conclusion" rows="3" placeholder="Raporun sonuç ve kanaat bölümü" /></label>
        <div class="wide findings-edit">
          <div class="findings-head">
            <span>Bulgular <small>(varsa, madde madde)</small></span>
            <button class="link-button" type="button" @click="addFinding"><i class="pi pi-plus" /> Bulgu ekle</button>
          </div>
          <p v-if="!form.findings.length" class="muted">Bulgu yok.</p>
          <ol v-else>
            <li v-for="(_, index) in form.findings" :key="index">
              <textarea v-model="form.findings[index]" rows="2" placeholder="Bulgu / kusur açıklaması" />
              <button class="icon-button" type="button" title="Bulguyu sil" aria-label="Bulguyu sil" @click="form.findings.splice(index, 1)"><i class="pi pi-times" /></button>
            </li>
          </ol>
        </div>
      </div>

      <!-- Yapay zeka önerisi (formun altında, açılır): rapor bilgileri, ekipmana yazılacaklar, teknik özellikler -->
      <div v-if="formVisible && mode === 'ai' && analysis" class="ai-result" :class="{ open: aiOpen }">
        <button class="ai-result-head" type="button" :aria-expanded="aiOpen" @click="aiOpen = !aiOpen">
          <i class="pi pi-sparkles" />
          <span>Yapay zeka önerisi — kontrol edip kaydedin<small v-if="aiSummary">{{ aiSummary }}</small></span>
          <i class="pi pi-chevron-down chevron" />
        </button>
        <div v-if="aiOpen" class="ai-body">
          <dl>
            <template v-if="analysis.report_no"><dt>Rapor no</dt><dd>{{ analysis.report_no }}</dd></template>
            <template v-if="analysis.company_title"><dt>Firma</dt><dd>{{ analysis.company_title }}</dd></template>
            <template v-if="analysis.report_date"><dt>Rapor tarihi</dt><dd>{{ analysis.report_date }}</dd></template>
            <template v-if="analysis.inspection_body?.name"><dt>Kontrolü yapan</dt><dd>{{ analysis.inspection_body.name }}</dd></template>
            <template v-for="(person, index) in analysis.inspection_body?.personnel || []" :key="index">
              <dt>{{ ROLE_LABELS[person.role] || person.role || 'Uzman' }}</dt>
              <dd>{{ [person.name, person.profession].filter(Boolean).join(' · ') }}<small v-if="person.chamber_registry_no || person.authorization_no"> ({{ [person.chamber_registry_no && `Sicil ${person.chamber_registry_no}`, person.authorization_no && `Yetki ${person.authorization_no}`].filter(Boolean).join(', ') }})</small></dd>
            </template>
          </dl>
          <label v-if="codeFromReport" class="check-line"><input v-model="applyCode" type="checkbox" /> <span>Rapora göre ekipman no <strong>{{ codeFromReport }}</strong> — ekipmana yaz</span></label>
          <label v-if="variantFromReport" class="check-line"><input v-model="applyVariant" type="checkbox" /> <span>Rapora göre {{ (equipment.type?.variant_label || 'etiket').toLocaleLowerCase('tr-TR') }} <strong>{{ variantFromReport }}</strong> — ekipmana ekle<small v-if="analysis.match?.variant_evidence" class="evidence"> (raporda: “{{ analysis.match.variant_evidence }}”)</small></span></label>
          <div v-if="hasPropertyQuestions || analysis.properties?.same || propertyUnmapped.length" class="tech">
            <h4>Teknik özellikler <small>— yalnızca onayladıkların kaydedilir; boş değerler (NU, -) mevcutları değiştirmez</small></h4>
            <!-- Mevcut değerden farklı olanlar: hangisinin doğru olduğunu kullanıcı seçer (otomatik ezme yok) -->
            <div v-if="propertyChanges.length" class="prop-changes">
              <p class="prop-changes-title"><i class="pi pi-exclamation-triangle" /> Değişen özellikler ({{ propertyChanges.length }}) — hangisi doğru?</p>
              <div v-for="change in propertyChanges" :key="change.key" class="prop-change">
                <div class="prop-values">
                  <strong>{{ change.field }}</strong>
                  <span>{{ withUnit(change.current_value, change.unit) }}<small v-if="change.current_source === 'manual'"> (elle düzeltildi)</small></span>
                  <i class="pi pi-arrow-right" />
                  <span class="report-value">{{ withUnit(change.report_value, change.unit) }}</span>
                </div>
                <small v-if="change.raw_field" class="raw">Raporda: {{ change.raw_field }}: {{ change.raw_value }}</small>
                <div class="choice">
                  <label><input v-model="propertyDecisions[change.key]" type="radio" value="report" /> Rapordakini kullan</label>
                  <label><input v-model="propertyDecisions[change.key]" type="radio" value="keep" /> Mevcut kalsın</label>
                </div>
              </div>
            </div>
            <div v-if="propertyNew.length" class="prop-group">
              <div class="prop-group-head">
                <span>Yeni özellikler ({{ propertyNew.length }})</span>
                <span><button class="link-button" type="button" @click="setAll(propertyNew, 'add')">Tümü</button> · <button class="link-button" type="button" @click="setAll(propertyNew, 'skip')">Hiçbiri</button></span>
              </div>
              <label v-for="item in propertyNew" :key="item.key" class="prop-check" :title="item.raw_field ? `Raporda: ${item.raw_field}: ${item.raw_value}` : undefined">
                <input type="checkbox" :checked="propertyDecisions[item.key] === 'add'" @change="propertyDecisions[item.key] = ($event.target as HTMLInputElement).checked ? 'add' : 'skip'" />
                <span class="prop-field">{{ item.field }}</span><span class="prop-value">{{ withUnit(item.value, item.unit) }}</span>
              </label>
            </div>
            <div v-if="propertyRestore.length" class="prop-group restore">
              <div class="prop-group-head"><span>Daha önce silinmiş, raporda tekrar var ({{ propertyRestore.length }}) — eklensin mi?</span></div>
              <label v-for="item in propertyRestore" :key="item.key" class="prop-check" :title="item.raw_field ? `Raporda: ${item.raw_field}: ${item.raw_value}` : undefined">
                <input type="checkbox" :checked="propertyDecisions[item.key] === 'add'" @change="propertyDecisions[item.key] = ($event.target as HTMLInputElement).checked ? 'add' : 'skip'" />
                <span class="prop-field">{{ item.field }}</span><span class="prop-value">{{ withUnit(item.value, item.unit) }}</span>
              </label>
            </div>
            <!-- Katalogda karşılığı olmayanlar: burada karar yok; talep, kayıttan sonra yapay zeka özetinden -->
            <div v-if="propertyUnmapped.length" class="prop-group unmapped">
              <div class="prop-group-head"><span>Katalogda olmayan özellikler ({{ propertyUnmapped.length }})</span></div>
              <p class="unmapped-note"><i class="pi pi-info-circle" /> Bu özellikler katalogda yok, ekipmana kaydedilmez. Raporu kaydettikten sonra kontrol geçmişindeki yapay zeka özetinden kataloğa eklenmesini talep edebilirsiniz.</p>
              <div v-for="row in propertyUnmapped" :key="row.id" class="prop-row">
                <span class="prop-field">{{ row.label }}</span><span class="prop-value">{{ row.value }}</span>
              </div>
            </div>
            <p v-if="analysis.properties?.same" class="hint">{{ analysis.properties.same }} özellik kayıtlı değerle aynı.</p>
          </div>
        </div>
      </div>

      <p v-if="undecidedChanges" class="hint warn">Değişen {{ undecidedChanges }} özellik için "Rapordakini kullan" ya da "Mevcut kalsın" seçin.<button v-if="!aiOpen" class="link-button" type="button" @click="aiOpen = true">Göster</button></p>
      <p v-if="error" class="error-text">{{ error }}</p>
      <div class="modal-actions">
        <button class="secondary-button" type="button" :disabled="busy" @click="close">İptal</button>
        <button v-if="formVisible" class="primary-button" type="button" :disabled="busy || !canSave" @click="save">{{ saving ? 'Kaydediliyor...' : 'Kaydet' }}</button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// Periyodik kontrol raporu yükleme: rapor dosyası zorunlu (dijital arşiv); bilgiler elle ya da yapay zeka ile doldurulur.
const props = defineProps<{
  equipment: { id: number | null; name?: string | null; code?: string | null; variant?: string | null; type?: { name: string; default_period_months?: number | null; variants?: string[]; variant_label?: string | null } | null }
  // Rapordan ekipman tanımlama: rapor zaten analiz edildi; aynı analiz bu ekipmana bağlanır (Gemini tekrar çağrılmaz).
  preload?: { analysisId: string; file: File } | null
  // Rapordan yeni ekipman: ekipman henüz yok; "Kaydet"te ekipman ve rapor birlikte oluşturulur.
  draft?: Record<string, any> | null
}>()
const emit = defineEmits<{ close: []; saved: [equipment: any] }>()

const { post, postForm, errorMessage } = useExpertApi()

const fileInput = ref<HTMLInputElement | null>(null)
const file = ref<File | null>(null)
const mode = ref<'manual' | 'ai'>('manual')
const analysis = ref<any>(null)
const analyzing = ref(false)
const saving = ref(false)
const error = ref('')
const emptyForm = () => ({ status: '', control_date: '', next_control_date: '', report_no: '', inspection_body: '', conclusion: '', findings: [] as string[] })
const form = reactive(emptyForm())
const addFinding = () => { form.findings.push('') }
const nextTouched = ref(false)
// Test verisi (fikstür): seçilirse yapay zeka çağrılmaz.
const { fixtures, fixtureLabel, loadFixtures } = useReportFixtures()
const fixtureId = ref('')
// Rapor bu ekipmana ait görünmüyorsa form, kullanıcı "Yine de devam et" diyene kadar açılmaz.
const mismatchConfirmed = ref(false)

const MATCH_TEXT: Record<string, string> = {
  match: 'Eşleşti',
  close: 'Rapor bu ekipmanla eşleşmedi: yazım farkı var',
  mismatch: 'Bu rapor bu ekipmana ait görünmüyor',
  unknown: 'Seri no karşılaştırılamadı (raporda ya da kayıtta yok); bu raporun bu ekipmana ait olduğundan emin olun'
}
const MATCH_ICONS: Record<string, string> = { match: 'pi pi-check-circle', close: 'pi pi-exclamation-circle', mismatch: 'pi pi-times-circle', unknown: 'pi pi-question-circle' }
const CHECK_ICONS: Record<string, string> = { ok: 'pi pi-check', close: 'pi pi-exclamation-triangle', diff: 'pi pi-times', unknown: 'pi pi-minus' }
const matchStatus = computed(() => analysis.value?.match?.status || 'unknown')
// Yazım farkı (close) da eşleşme sayılmaz: "ait değil" gibi onay ister.
const blocked = computed(() => ['mismatch', 'close'].includes(matchStatus.value))
const matchText = computed(() => {
  // Kararın dayanağı (sunucu: basis): seri no; seri no yoksa ekipman no; yangın tüpünde yer + no + tip.
  const basis = analysis.value?.match?.basis
  const BASIS_TEXT: Record<string, string> = { serial_no: 'seri no aynı', code: 'ekipman no aynı', place_code: 'bulunduğu yer ve ekipman no aynı', place_code_variant: 'bulunduğu yer, ekipman no ve tip aynı' }
  if (matchStatus.value === 'match' && BASIS_TEXT[basis]) return `Eşleşti — ${BASIS_TEXT[basis]}`
  if (basis === 'serial_no' && matchStatus.value === 'mismatch') return 'Bu rapor bu ekipmana ait görünmüyor: seri no farklı'
  if (matchStatus.value !== 'close') return MATCH_TEXT[matchStatus.value]
  const fields = (analysis.value?.match?.checks || []).filter((check: any) => check.result === 'close').map((check: any) => check.label.toLocaleLowerCase('tr-TR'))
  return `Rapor bu ekipmanla eşleşmedi: ${fields.join(', ') || 'bilgilerde'} yazım farkı var`
})
const ROLE_LABELS: Record<string, string> = { kontrol_eden: 'Kontrolü yapan uzman', onaylayan: 'Onaylayan uzman' }
// Ekipmanda etiket yoksa ve yapay zeka rapordan anladıysa (örn. transpalet Elektrikli): kullanıcı onaylarsa eklenir.
const applyVariant = ref(true)
// Ekipmanda no yoksa ve rapor bir ekipman no veriyorsa: kullanıcı onaylarsa yazılır.
const applyCode = ref(true)
const codeFromReport = computed(() => !props.equipment.code && analysis.value?.match?.fields?.code ? analysis.value.match.fields.code : null)
const variantFromReport = computed(() => {
  const variant = analysis.value?.match?.variant
  return variant && !props.equipment.variant && props.equipment.type?.variants?.includes(variant) ? variant : null
})
// Teknik özellikler: rapordaki değerlerin mevcut değerlere göre durumu (sunucu hesaplar). Otomatik hiçbir şey yok:
// değişenler (report | keep), yeniler ve silinmişken tekrar gelenler (add | skip) açıkça seçilir, sunucu yalnızca onaylananları uygular.
const propertyChanges = computed<any[]>(() => analysis.value?.properties?.changes || [])
const propertyNew = computed<any[]>(() => analysis.value?.properties?.new || [])
const propertyRestore = computed<any[]>(() => analysis.value?.properties?.restore || [])
const propertyUnmapped = computed<any[]>(() => analysis.value?.properties?.unmapped || [])
const withUnit = (value: any, unit?: string | null) => value === null || value === undefined || value === '' ? '—' : (unit && /^[\d.,]+$/.test(String(value)) ? `${value} ${unit}` : String(value))
const hasPropertyQuestions = computed(() => propertyChanges.value.length + propertyNew.value.length + propertyRestore.value.length > 0)
const propertyDecisions = reactive<Record<string, string>>({})
const resetDecisions = () => {
  Object.keys(propertyDecisions).forEach(key => delete propertyDecisions[key])
  // Değişen değerlerde varsayılan yok: kullanıcı açıkça seçmeli (otomatik hiçbir şey olmaz).
  propertyChanges.value.forEach(item => { propertyDecisions[item.key] = '' })
  ;[...propertyNew.value, ...propertyRestore.value].forEach(item => { propertyDecisions[item.key] = item.default })
  applyVariant.value = true
  applyCode.value = true
}
const setAll = (items: any[], decision: 'add' | 'skip') => items.forEach(item => { propertyDecisions[item.key] = decision })
// Öneri kutusu kapalı başlar; değişen özellik varsa (seçim zorunlu) açık gelir.
const aiOpen = ref(false)
const aiSummary = computed(() => {
  const count = (items: any[], text: string) => items.length ? `${items.length} ${text}` : ''
  const added = propertyNew.value.filter(item => propertyDecisions[item.key] === 'add').length
  return [
    undecidedChanges.value ? `${undecidedChanges.value} değişen özellik için seçim gerekli` : count(propertyChanges.value, 'değişen özellik'),
    propertyNew.value.length ? `${added}/${propertyNew.value.length} yeni özellik eklenecek` : '',
    count(propertyRestore.value, 'silinmiş özellik tekrar geldi'),
    count(propertyUnmapped.value, 'özellik katalogda yok'),
    codeFromReport.value && applyCode.value ? `ekipman no ${codeFromReport.value} yazılacak` : '',
    variantFromReport.value && applyVariant.value ? `${variantFromReport.value} etiketi eklenecek` : ''
  ].filter(Boolean).join(' · ')
})
const formVisible = computed(() => mode.value === 'manual' || (!!analysis.value && !analysis.value.duplicate && (!blocked.value || mismatchConfirmed.value)))
const undecidedChanges = computed(() => mode.value === 'ai' && analysis.value ? propertyChanges.value.filter(item => !['report', 'keep'].includes(propertyDecisions[item.key])).length : 0)

const busy = computed(() => analyzing.value || saving.value)
const isPdf = computed(() => !!file.value && (file.value.type === 'application/pdf' || file.value.name.toLowerCase().endsWith('.pdf')))
const fileSize = computed(() => file.value ? `${(file.value.size / 1024 / 1024).toFixed(1)} MB` : '')
const canSave = computed(() => !!file.value && !!form.status && !!form.control_date && !undecidedChanges.value)

const close = () => { if (!busy.value) emit('close') }

const onFile = (event: Event) => {
  const selected = (event.target as HTMLInputElement).files?.[0]
  if (fileInput.value) fileInput.value.value = ''
  if (!selected) return
  file.value = selected
  error.value = ''
  // Yeni dosya: eski yapay zeka önerisi geçersiz.
  if (analysis.value) { analysis.value = null; mismatchConfirmed.value = false; Object.assign(form, emptyForm()) }
}

const setMode = (value: 'manual' | 'ai') => {
  mode.value = value
  error.value = ''
  if (value === 'ai') loadFixtures()
}

// Gelecek kontrol elle girilmediyse kontrol tarihi + türün periyodu önerilir.
const onControlDate = () => {
  const months = props.equipment.type?.default_period_months
  if (nextTouched.value || !form.control_date || !months) return
  const date = new Date(`${form.control_date}T00:00:00`)
  date.setMonth(date.getMonth() + months)
  form.next_control_date = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const analyze = async () => {
  if (!file.value && !fixtureId.value) return
  analyzing.value = true
  error.value = ''
  const body = new FormData()
  if (fixtureId.value) body.append('fixture_id', fixtureId.value)
  else if (file.value) body.append('report', file.value)
  try {
    applyAnalysis(await postForm(`/pk-equipment/${props.equipment.id}/report-analysis`, body))
  } catch (e: any) {
    error.value = errorMessage(e, 'Rapor analiz edilemedi. "Elle doldur" ile devam edebilirsiniz.')
  } finally { analyzing.value = false }
}

// Analiz sonucu: öneriler forma, teknik özellik kararları sıfırdan.
const applyAnalysis = (result: any) => {
    mismatchConfirmed.value = false
    analysis.value = result
    resetDecisions()
    Object.assign(form, {
      status: result.status || '',
      control_date: result.control_date || '',
      next_control_date: result.next_control_date || '',
      report_no: result.report_no || '',
      inspection_body: result.inspection_body?.name || '',
      conclusion: result.overall_text || '',
      findings: [...(result.findings || [])]
    })
    nextTouched.value = !!result.next_control_date
    aiOpen.value = propertyChanges.value.length > 0
}

onMounted(async () => {
  if (!props.preload) return
  file.value = props.preload.file
  mode.value = 'ai'
  analyzing.value = true
  try {
    applyAnalysis(props.draft
      ? await post(`/pk-equipment/report-analysis/${props.preload.analysisId}/draft`, props.draft)
      : await post(`/pk-equipment/${props.equipment.id}/report-analysis/${props.preload.analysisId}`, {}))
  }
  catch (e: any) { error.value = errorMessage(e, 'Rapor analizi bu ekipmana bağlanamadı.') }
  finally { analyzing.value = false }
})

const save = async () => {
  if (!file.value || !canSave.value) return
  saving.value = true
  error.value = ''
  const body = new FormData()
  body.append('report', file.value)
  body.append('status', form.status)
  body.append('control_date', form.control_date)
  if (form.next_control_date) body.append('next_control_date', form.next_control_date)
  if (form.report_no.trim()) body.append('report_no', form.report_no.trim())
  if (form.inspection_body.trim()) body.append('inspection_body', form.inspection_body.trim())
  if (form.conclusion.trim()) body.append('conclusion', form.conclusion.trim())
  form.findings.map(finding => finding.trim()).filter(Boolean).forEach(finding => body.append('findings[]', finding))
  const fromAi = mode.value === 'ai' && !!analysis.value
  body.append('source', fromAi ? 'ai' : 'manual')
  // Sunucu, okuduğu analizin tamamını (kriterler hariç) bu kimlikle kontrol kaydına yazar.
  if (fromAi && analysis.value.analysis_id) body.append('analysis_id', analysis.value.analysis_id)
  if (fromAi && mismatchConfirmed.value) body.append('mismatch_confirmed', '1')
  if (fromAi) Object.entries(propertyDecisions).forEach(([key, decision]) => body.append(`property_decisions[${key}]`, decision))
  if (fromAi && variantFromReport.value && applyVariant.value) body.append('apply_variant', '1')
  if (fromAi && codeFromReport.value && applyCode.value) body.append('apply_code', '1')
  try {
    if (props.draft) {
      // Yeni ekipman: ekipman bilgileri + rapor tek istekte (sunucu ikisini birlikte oluşturur).
      Object.entries(props.draft).forEach(([key, value]) => { if (value !== null && value !== undefined && value !== '') body.append(key, String(value)) })
      emit('saved', await postForm('/pk-equipment/from-report', body))
    } else {
      emit('saved', await postForm(`/pk-equipment/${props.equipment.id}/inspections`, body))
    }
  } catch (e: any) {
    error.value = errorMessage(e, 'Rapor kaydedilemedi.')
  } finally { saving.value = false }
}
</script>

<style scoped>
.modal-backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:var(--admin-overlay)}
.modal-card{width:min(640px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:22px;background:var(--admin-card);border-radius:12px;box-shadow:0 20px 60px var(--admin-shadow)}
.modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:18px}
h2{margin:0;color:var(--admin-heading);font-size:18px}.modal-head p{margin:5px 0 0;color:var(--admin-muted);font-size:12px}
.close-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:var(--admin-muted);cursor:pointer;border-radius:7px}.close-button:hover{background:var(--admin-hover);color:var(--admin-heading)}
.file-box{width:100%;display:flex;align-items:center;gap:14px;padding:16px;border:1.5px dashed var(--admin-border);border-radius:10px;background:var(--admin-soft);color:var(--admin-muted);text-align:left;cursor:pointer;font:inherit}
.file-box:hover{border-color:#d7a900}.file-box.filled{border-style:solid}.file-box i{font-size:24px}.file-box.filled i{color:var(--admin-danger-text)}
.file-box span,.ai-box span{display:flex;flex-direction:column;gap:3px;min-width:0}.file-box strong,.ai-box strong{color:var(--admin-heading);font-size:13px;overflow-wrap:anywhere}.file-box small,.ai-box small{font-size:11px;color:var(--admin-muted)}
.mode{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:14px 0;padding:4px;border:1px solid var(--admin-border);border-radius:10px;background:var(--admin-soft)}
.mode button{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:36px;border:0;border-radius:7px;background:transparent;color:var(--admin-muted);font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.mode button.active{background:var(--admin-card);color:var(--admin-heading);box-shadow:0 1px 3px var(--admin-shadow)}.mode button:disabled{cursor:not-allowed}
.ai-box{display:flex;align-items:center;gap:14px;padding:16px;border:1px solid var(--admin-border);border-radius:10px;margin-bottom:14px}.ai-box > i{font-size:22px;color:#d7a900}.ai-box .primary-button{margin-left:auto;flex-shrink:0}
.ai-result{margin-top:16px;border:1px solid var(--admin-border);border-radius:10px;background:var(--admin-soft)}
.ai-result-head{width:100%;display:flex;align-items:center;gap:9px;padding:12px 14px;border:0;background:transparent;color:var(--admin-heading);font:inherit;font-size:12px;font-weight:800;text-align:left;cursor:pointer;border-radius:10px}
.ai-result-head:hover{background:var(--admin-hover)}.ai-result-head > i:first-child{color:var(--admin-success-text)}
.ai-result-head span{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}.ai-result-head small{font-weight:400;color:var(--admin-muted);font-size:11px}
.ai-result-head .chevron{font-size:11px;color:var(--admin-muted);transition:transform .15s}.ai-result.open .chevron{transform:rotate(180deg)}
.ai-body{padding:4px 14px 14px}
.form-hint{margin:0 0 10px}
.tech{margin-top:12px;padding-top:10px;border-top:1px solid var(--admin-border)}
.tech h4{margin:0 0 8px;color:var(--admin-heading);font-size:12px}.tech h4 small{font-weight:400;color:var(--admin-muted)}
.tech dl{grid-template-columns:max-content 1fr}
.ai-result dd small{color:var(--admin-muted)}
.check-line .evidence{color:var(--admin-muted)}
.check-line{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:12px;color:var(--admin-heading);cursor:pointer}
.prop-group{display:grid;gap:2px;margin-bottom:10px}
.prop-group-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;color:var(--admin-heading);font-size:12px;font-weight:700}.prop-group-head .link-button{font-size:11px}
.prop-group.restore .prop-group-head{color:var(--admin-warning-text)}
.prop-check{display:grid;grid-template-columns:auto minmax(110px,45%) 1fr;align-items:center;gap:8px;padding:4px 6px;border-radius:6px;font-size:12px;cursor:pointer}
.prop-check:hover{background:var(--admin-card)}
.prop-change .raw{color:var(--admin-muted);font-size:11px}
.prop-group.unmapped .prop-group-head{color:var(--admin-muted)}
.unmapped-note{display:flex;align-items:flex-start;gap:6px;margin:0 0 6px;padding:8px 10px;border-radius:7px;background:var(--admin-card);color:var(--admin-muted);font-size:11px;line-height:1.45}.unmapped-note i{margin-top:2px}
.prop-row{display:grid;grid-template-columns:minmax(110px,45%) 1fr;gap:8px;padding:4px 6px;font-size:12px}
.prop-field{color:var(--admin-muted)}.prop-value{color:var(--admin-heading);font-weight:700;overflow-wrap:anywhere}
.prop-changes{display:grid;gap:8px;margin-bottom:12px;padding:10px 12px;border:1px solid var(--admin-warning-text);border-radius:9px;background:var(--admin-warning-bg)}
.prop-changes-title{display:flex;align-items:center;gap:6px;margin:0;color:var(--admin-warning-text);font-size:12px;font-weight:800}
.prop-change{display:grid;gap:5px;padding-top:8px;border-top:1px solid rgba(127,127,127,.25)}
.prop-values{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;font-size:12px;color:var(--admin-heading)}.prop-values strong{margin-right:4px}.prop-values small{color:var(--admin-muted)}.prop-values i{font-size:10px;color:var(--admin-muted)}
.report-value{font-weight:800}
.choice{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:12px;color:var(--admin-heading)}.choice label{display:inline-flex;align-items:center;gap:5px;cursor:pointer}
.ai-result dl{display:grid;grid-template-columns:max-content 1fr;gap:6px 14px;margin:0;font-size:12px}.ai-result dt{color:var(--admin-muted)}.ai-result dd{margin:0;color:var(--admin-heading)}
.fixture-select{display:flex;align-items:center;gap:10px;margin:-6px 0 14px;padding:8px 12px;border:1px dashed var(--admin-border);border-radius:9px;font-size:12px;color:var(--admin-muted)}
.fixture-select span{display:inline-flex;align-items:center;gap:6px;font-weight:700;white-space:nowrap}
.fixture-select select{flex:1;min-width:0;height:34px;padding:0 8px;border:1px solid var(--admin-border);border-radius:7px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:12px}
.test-note{display:flex;align-items:center;gap:6px;margin:-6px 0 12px}
.duplicate{display:flex;align-items:flex-start;gap:10px;margin-bottom:14px;padding:12px 14px;border:1px solid var(--admin-danger-text);border-radius:10px;background:var(--admin-danger-bg);color:var(--admin-danger-text);font-size:13px;font-weight:700}
.duplicate a{margin-left:6px;color:inherit;text-decoration:underline}
.match{padding:12px 14px;border-radius:10px;margin-bottom:14px;border:1px solid transparent}
.match.match{background:var(--admin-success-bg);color:var(--admin-success-text)}.match.close,.match.unknown{background:var(--admin-warning-bg);color:var(--admin-warning-text)}
.match.mismatch{background:var(--admin-danger-bg);color:var(--admin-danger-text);border-color:var(--admin-danger-text)}
.match-head{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800}
.match table{width:100%;margin-top:10px;border-collapse:collapse;font-size:12px}
.match th{padding:4px 8px;text-align:left;font-size:10px;font-weight:700;opacity:.8}.match td{padding:5px 8px;border-top:1px solid currentColor;border-top-color:rgba(127,127,127,.25);color:var(--admin-heading);overflow-wrap:anywhere}
.match td:first-child{color:inherit;font-weight:700;white-space:nowrap}.match td:last-child{width:1%}
.match tr.ok td:last-child{color:var(--admin-success-text)}.match tr.close td:last-child{color:var(--admin-warning-text)}.match tr.diff td{color:var(--admin-danger-text);font-weight:700}
.match-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}
.danger-button{min-height:36px;padding:0 14px;border:1px solid var(--admin-danger-text);border-radius:8px;background:var(--admin-card);color:var(--admin-danger-text);font-size:12px;font-weight:800;cursor:pointer}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px}
.form-grid label{display:block;color:var(--admin-heading);font-size:12px;font-weight:700}.form-grid label small{font-weight:400;color:var(--admin-muted)}.form-grid label > span{color:var(--admin-danger-text)}.wide{grid-column:1 / -1}
.form-grid input,.form-grid select,.form-grid textarea{display:block;width:100%;margin-top:6px;padding:0 10px;height:40px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:13px;outline:0}
.form-grid textarea{height:auto;padding:9px 10px;resize:vertical}
.form-grid input:focus,.form-grid select:focus,.form-grid textarea:focus{border-color:#d7a900;box-shadow:0 0 0 3px rgba(255,193,7,.12)}
.findings-edit{display:grid;gap:8px}
.findings-head{display:flex;align-items:center;justify-content:space-between;color:var(--admin-heading);font-size:12px;font-weight:700}.findings-head small{font-weight:400;color:var(--admin-muted)}
.findings-edit ol{display:grid;gap:6px;margin:0;padding-left:22px;color:var(--admin-muted);font-size:12px}
.findings-edit li{padding-left:2px}.findings-edit li > *{vertical-align:top}
.findings-edit li textarea{display:inline-block;width:calc(100% - 40px);margin:0;padding:8px 10px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:13px;resize:vertical;outline:0}
.findings-edit li textarea:focus{border-color:#d7a900;box-shadow:0 0 0 3px rgba(255,193,7,.12)}
.link-button{display:inline-flex;align-items:center;gap:6px;border:0;background:none;color:var(--admin-link);font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.icon-button{width:32px;height:32px;margin-left:6px;display:inline-grid;place-items:center;border:0;border-radius:7px;background:transparent;color:var(--admin-muted);cursor:pointer}.icon-button:hover{background:var(--admin-hover);color:var(--admin-danger-text)}
.muted{margin:0;color:var(--admin-muted);font-size:12px}
.hint{margin:8px 0 0;color:var(--admin-muted);font-size:12px}.hint.warn{color:var(--admin-warning-text)}.hint .link-button{margin-left:6px}.error-text{margin:10px 0 0;color:var(--admin-danger-text);font-size:12px}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 17px;border:0;border-radius:8px;background:var(--pk-yellow);color:#111827;font-size:13px;font-weight:800;cursor:pointer}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.secondary-button{min-height:40px;padding:0 18px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-hover);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}.secondary-button:disabled{opacity:.55}
@media(max-width:640px){.form-grid,.mode{grid-template-columns:1fr}.ai-box{flex-wrap:wrap}}
</style>
