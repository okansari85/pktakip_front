<template>
  <div class="modal-backdrop" @click.self="close">
    <section class="modal-card">
      <div class="modal-head">
        <div>
          <h2><i class="pi pi-file-check" /> Tüp Kontrol Formu Yükle</h2>
          <p>{{ context?.location_name }}<template v-if="context?.type === 'workplace' && context.company_name"> · {{ context.company_name }}</template></p>
        </div>
        <button class="close-button" type="button" @click="close"><i class="pi pi-times" /></button>
      </div>

      <!-- 1) Rapor dosyası + okuma ("Rapordan Ekipman Tanımla"dan gelindiyse okunmuş olarak açılır) -->
      <input ref="fileInput" type="file" accept="application/pdf" hidden @change="onFile" />
      <button class="file-box" :class="{ filled: file }" type="button" :disabled="busy" @click="fileInput?.click()">
        <i :class="file ? 'pi pi-file-pdf' : 'pi pi-cloud-upload'" />
        <span v-if="file"><strong>{{ file.name }}</strong><small>değiştirmek için tıklayın</small></span>
        <span v-else><strong>Tüp kontrol formunu seçin</strong><small>PDF · tüplerin toplu periyodik kontrol raporu</small></span>
      </button>

      <template v-if="!analysis">
        <div class="ai-box">
          <template v-if="analyzing">
            <i class="pi pi-spin pi-spinner" />
            <span><strong>Form okunuyor...</strong><small>Rapor bilgileri, bölümler ve tüp listesi çıkarılıyor. 1-3 dakika sürebilir.</small></span>
          </template>
          <template v-else>
            <i class="pi pi-sparkles" />
            <span><strong>Yapay zeka formu okuyacak</strong><small>Tüpler Ekipmanlar'daki kayıtlarla eşleşir, olmayanlar eklenir; her tüpe kendi sonucuyla kontrol kaydı açılır.</small></span>
            <button class="ai-button" type="button" :disabled="!file || analyzing" @click="analyze">Oku</button>
          </template>
        </div>
        <label v-if="!analyzing && fixtures.length" class="fixture-select">
          <span><i class="pi pi-database" /> Test verisi</span>
          <select v-model="fixtureId">
            <option value="">Kullanma — formu yapay zeka ile oku</option>
            <option v-for="fixture in fixtures" :key="fixture.fixture_id" :value="fixture.fixture_id">{{ fixtureLabel(fixture) }}</option>
          </select>
        </label>
      </template>

      <!-- 2) Okunan form: rapor bilgileri, bölümler, tüpler -->
      <template v-else>
        <p v-if="analysis.fixture" class="hint"><i class="pi pi-database" /> Test verisi kullanıldı: {{ analysis.fixture.original_file_name }} (yapay zeka çağrılmadı)</p>
        <p v-if="analysis.input === 'ocr'" class="hint warn"><i class="pi pi-image" /> Form taranmış; metin OCR ile okundu. Kaydetmeden önce değerleri kontrol edin.</p>
        <div v-if="analysis.bulk_duplicate" class="duplicate"><i class="pi pi-ban" /><span>{{ analysis.bulk_duplicate.message }}</span></div>

        <template v-else>
          <div class="form-grid">
            <label>Kontrol tarihi <span>*</span><input v-model="form.control_date" type="date" /></label>
            <label>Geçerlilik (gelecek kontrol)<input v-model="form.next_control_date" type="date" /></label>
            <label>Rapor no<input v-model="form.report_no" type="text" /></label>
            <label>Genel sonuç
              <select v-model="form.status">
                <option value="">Belirtilmemiş</option>
                <option value="uygun">Uygun</option>
                <option value="uygun_degil">Uygun değil</option>
              </select>
            </label>
            <label class="wide">Kontrolü yapan kuruluş<input v-model="form.inspection_body" type="text" /></label>
          </div>

          <h4>Bölümler <small>(raporda yazdığı gibi)</small></h4>
          <div class="sections">
            <div v-for="system in systems" :key="system.name" class="section">
              <div class="section-line">
                <strong>{{ system.name }}</strong>
                <small v-if="system.equipment_count">{{ system.equipment_count }} tüp</small>
                <select v-model="system.status">
                  <option :value="null">Belirtilmemiş</option>
                  <option value="uygun">Uygun</option>
                  <option value="uygun_degil">Uygun değil</option>
                </select>
              </div>
              <ol v-if="system.findings.length" class="findings"><li v-for="(finding, index) in system.findings" :key="index">{{ finding }}</li></ol>
            </div>
            <p v-if="!systems.length" class="muted">Raporda bölüm bulunamadı.</p>
          </div>
          <template v-if="generalFindings.length">
            <h4>Genel bulgular</h4>
            <ol class="findings padded"><li v-for="(finding, index) in generalFindings" :key="index">{{ finding }}</li></ol>
          </template>

          <!-- Tüpler lokasyonun tamamına kayıtlıdır: yeni tüpler lokasyon geneli eklenir -->
          <div class="rows-head">
            <h4>Tüpler <small>{{ rows.length }} satır · {{ counts.new }} yeni · {{ counts.existing }} mevcut · {{ counts.skip }} eklenmeyecek · yeni tüpler lokasyon geneline eklenir</small></h4>
          </div>
          <p v-if="bulk?.table_error" class="hint warn"><i class="pi pi-exclamation-triangle" /> Tüp tablosu: {{ bulk.table_error }}</p>
          <p v-if="!rows.length" class="muted">Formda tüp satırı okunamadı.</p>
          <div v-else class="table-wrap">
            <table>
              <thead><tr><th>Bulunduğu yer</th><th>No</th><th>{{ bulk?.type?.variant_label || 'Tip' }}</th><th>Kapasite</th><th>Son dolum</th><th>Durum</th><th>Ekipmanlar'daki karşılığı</th></tr></thead>
              <tbody>
                <tr v-for="row in rows" :key="row.key" :class="{ skipped: row.choice === 'skip' }">
                  <td><input v-model="row.place" type="text" class="cell-input" @change="resuggest(row)" /></td>
                  <td><input v-model="row.code" type="text" class="cell-input narrow" placeholder="—" @change="resuggest(row)" /></td>
                  <td>
                    <select v-model="row.variant" class="cell-input" @change="resuggest(row)">
                      <option value="">—</option>
                      <option v-for="variant in bulk?.type?.variants || []" :key="variant" :value="variant">{{ variant }}</option>
                    </select>
                    <small v-if="row.type_text" class="raw">{{ row.type_text }}</small>
                  </td>
                  <td>{{ row.capacity ? `${row.capacity} kg` : '—' }}</td>
                  <td>{{ row.fill_date || '—' }}</td>
                  <td>
                    <select v-model="row.status" class="cell-input" :class="row.status || 'none'">
                      <option value="">Belirtilmemiş</option>
                      <option value="uygun">Uygun</option>
                      <option value="uygun_degil">Uygun değil</option>
                    </select>
                  </td>
                  <td>
                    <select v-model="row.choice" class="cell-input wide-select" @change="row.reason = ''">
                      <option value="new">Yeni tüp olarak ekle</option>
                      <option v-for="item in existing" :key="item.id" :value="`e${item.id}`">Mevcut: {{ existingLabel(item) }}</option>
                      <option value="skip">Ekleme</option>
                    </select>
                    <small v-if="row.reason" class="raw">{{ row.reason }}</small>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="duplicateChoice" class="error-text">{{ duplicateChoice }}</p>
        </template>
      </template>

      <p v-if="error" class="error-text">{{ error }}</p>
      <div class="modal-actions">
        <button class="secondary-button" type="button" :disabled="busy" @click="close">İptal</button>
        <button v-if="analysis && !analysis.bulk_duplicate" class="primary-button" type="button" :disabled="!canSave" @click="save">
          <i :class="saving ? 'pi pi-spin pi-spinner' : 'pi pi-check'" /> {{ saving ? 'Kaydediliyor...' : `Kaydet (${counts.new + counts.existing} tüp)` }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// Tüp kontrol formu (toplu rapor): okunur ("Rapordan Ekipman Tanımla"dan gelindiyse okunmuş gelir), tüpler Ekipmanlar'daki
// kayıtlarla eşleştirilir (yer + no + tip) ya da yeni eklenir; kayıtta her tüpe kendi sonucuyla kontrol kaydı açılır.
interface TubeRow {
  key: string; place: string; code: string; variant: string; type_text: string | null; capacity: string | null; fill_date: string | null
  serial_no: string | null; brand: string | null; model: string | null; properties: Record<string, string>
  status: string; choice: string; reason: string
}

const props = defineProps<{
  context: any
  preload?: { analysis: any; file: File } | null
}>()
const emit = defineEmits<{ close: []; saved: [report: any] }>()

const { postForm, errorMessage } = useExpertApi()
const { fixtures, fixtureLabel, loadFixtures } = useReportFixtures()

const fileInput = ref<HTMLInputElement | null>(null)
const file = ref<File | null>(props.preload?.file || null)
const fixtureId = ref('')
const analysis = ref<any>(null)
const analyzing = ref(false)
const saving = ref(false)
const error = ref('')
const form = reactive({ control_date: '', next_control_date: '', report_no: '', status: '', inspection_body: '', conclusion: '' })
const systems = ref<{ name: string; status: string | null; findings: string[]; equipment_count: number }[]>([])
const generalFindings = ref<string[]>([])
const rows = ref<TubeRow[]>([])

const bulk = computed(() => analysis.value?.bulk || null)
const existing = computed<any[]>(() => analysis.value?.location_equipment || [])
const busy = computed(() => analyzing.value || saving.value)
const counts = computed(() => ({
  new: rows.value.filter(row => row.choice === 'new').length,
  existing: rows.value.filter(row => row.choice.startsWith('e')).length,
  skip: rows.value.filter(row => row.choice === 'skip').length
}))
// Aynı mevcut tüp iki satırda seçilemez.
const duplicateChoice = computed(() => {
  const seen = new Set<string>()
  for (const row of rows.value) {
    if (!row.choice.startsWith('e')) continue
    if (seen.has(row.choice)) return 'Aynı mevcut tüp iki satırda seçilmiş; birini değiştirin.'
    seen.add(row.choice)
  }
  return ''
})
const canSave = computed(() => !busy.value && !!form.control_date && counts.value.new + counts.value.existing > 0 && !duplicateChoice.value)

const close = () => { if (!busy.value) emit('close') }
const onFile = (event: Event) => {
  const selected = (event.target as HTMLInputElement).files?.[0]
  if (fileInput.value) fileInput.value.value = ''
  if (!selected) return
  file.value = selected
  analysis.value = null
  error.value = ''
}

// Karşılaştırma: küçük harf, boşluksuz.
const compact = (value?: string | null) => (value || '').toLocaleLowerCase('tr-TR').split(' ').join('')
const existingLabel = (item: any) => [item.place, item.code && `no ${item.code}`, item.variant, item.workplace].filter(Boolean).join(' · ')
// Tüpün kimliği: bulunduğu yer + no + tip (numarasız tüpte yer + tip). Lokasyonda tek eşleşen varsa önerilir.
const suggest = (row: TubeRow, used: Set<number>) => {
  if (!compact(row.place)) return null
  const matches = existing.value.filter(item => !used.has(item.id)
    && compact(item.place) === compact(row.place) && compact(item.code) === compact(row.code) && compact(item.variant) === compact(row.variant))
  return matches.length === 1 ? matches[0] : null
}
const applySuggestions = () => {
  const used = new Set<number>()
  for (const row of rows.value) {
    const match = suggest(row, used)
    row.choice = match ? `e${match.id}` : 'new'
    row.reason = match ? 'Yer, no ve tip aynı' : ''
    if (match) used.add(match.id)
  }
}
const resuggest = (row: TubeRow) => {
  const used = new Set(rows.value.filter(other => other !== row && other.choice.startsWith('e')).map(other => Number(other.choice.slice(1))))
  const match = suggest(row, used)
  row.choice = match ? `e${match.id}` : 'new'
  row.reason = match ? 'Yer, no ve tip aynı' : ''
}

const load = (data: any) => {
  analysis.value = data
  Object.assign(form, {
    control_date: data.control_date || '',
    next_control_date: data.next_control_date || '',
    report_no: data.report_no || '',
    status: data.status || '',
    inspection_body: data.inspection_body?.name || '',
    conclusion: data.bulk?.conclusion || ''
  })
  systems.value = (data.bulk?.systems || []).map((system: any) => ({ ...system, findings: [...(system.findings || [])] }))
  generalFindings.value = [...(data.bulk?.general_findings || [])]
  rows.value = (data.bulk?.rows || []).map((row: any) => ({
    key: row.key, place: row.place || '', code: row.code || '', variant: row.variant || '', type_text: row.type_text, capacity: row.capacity,
    fill_date: row.fill_date, serial_no: row.serial_no, brand: row.brand, model: row.model, properties: row.properties || {},
    status: row.status || '', choice: 'new', reason: ''
  }))
  applySuggestions()
}

const analyze = async () => {
  if (!file.value) return
  analyzing.value = true
  error.value = ''
  const body = new FormData()
  if (fixtureId.value) body.append('fixture_id', fixtureId.value)
  else body.append('report', file.value)
  if (props.context?.location_id) body.append('location_id', String(props.context.location_id))
  try {
    const data = await postForm('/pk-equipment/report-analysis', body)
    if (!data.bulk) {
      error.value = 'Bu rapor tüp kontrol formu olarak tanınmadı. Tek ekipmanın raporuysa "Rapordan Ekipman Tanımla" ile yükleyin.'
      return
    }
    load(data)
  } catch (e: any) {
    error.value = errorMessage(e, 'Form okunamadı.')
  } finally { analyzing.value = false }
}

const save = async () => {
  if (!file.value || !analysis.value) return
  saving.value = true
  error.value = ''
  const body = new FormData()
  body.append('report', file.value)
  if (analysis.value.analysis_id) body.append('analysis_id', analysis.value.analysis_id)
  body.append('location_id', String(props.context.location_id))
  body.append('control_date', form.control_date)
  if (form.next_control_date) body.append('next_control_date', form.next_control_date)
  if (form.status) body.append('status', form.status)
  for (const key of ['report_no', 'inspection_body', 'conclusion'] as const) {
    if (form[key].trim()) body.append(key, form[key].trim())
  }
  // Listeler JSON metni olarak: yüzlerce tüplü formda PHP'nin alan sınırına (max_input_vars) takılmaz.
  body.append('systems', JSON.stringify(systems.value))
  body.append('findings', JSON.stringify(generalFindings.value))
  body.append('rows', JSON.stringify(rows.value.filter(row => row.choice !== 'skip').map(row => ({
    equipment_id: row.choice.startsWith('e') ? Number(row.choice.slice(1)) : null,
    status: row.status || null,
    place: row.place.trim() || null,
    code: row.code.trim() || null,
    variant: row.variant || null,
    brand: row.brand, model: row.model, serial_no: row.serial_no,
    properties: row.properties
  }))))
  try {
    emit('saved', await postForm('/pk-bulk-reports', body))
  } catch (e: any) {
    error.value = errorMessage(e, 'Form kaydedilemedi.')
  } finally { saving.value = false }
}

onMounted(() => {
  if (props.preload?.analysis) load(props.preload.analysis)
  else loadFixtures()
})
</script>

<style scoped>
.modal-backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:var(--admin-overlay)}
.modal-card{width:min(1080px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:22px;background:var(--admin-card);border-radius:12px;box-shadow:0 20px 60px var(--admin-shadow)}
.modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:18px}
h2{display:flex;align-items:center;gap:8px;margin:0;color:var(--admin-heading);font-size:18px}h2 i{color:#6d28d9}.modal-head p{margin:5px 0 0;color:var(--admin-muted);font-size:12px}
h4{margin:18px 0 8px;color:var(--admin-heading);font-size:13px}h4 small{margin-left:6px;color:var(--admin-muted);font-weight:400;font-size:11px}
.close-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:var(--admin-muted);cursor:pointer;border-radius:7px}.close-button:hover{background:var(--admin-hover);color:var(--admin-heading)}
.file-box{width:100%;display:flex;align-items:center;gap:14px;padding:16px;border:1.5px dashed var(--admin-border);border-radius:10px;background:var(--admin-soft);color:var(--admin-muted);text-align:left;cursor:pointer;font:inherit}
.file-box:hover{border-color:#6d28d9}.file-box.filled{border-style:solid}.file-box i{font-size:24px}.file-box.filled i{color:var(--admin-danger-text)}
.file-box span,.ai-box span{display:flex;flex-direction:column;gap:3px;min-width:0}.file-box strong,.ai-box strong{color:var(--admin-heading);font-size:13px;overflow-wrap:anywhere}.file-box small,.ai-box small{font-size:11px;color:var(--admin-muted)}
.ai-box{display:flex;align-items:center;gap:14px;margin-top:14px;padding:16px;border:1px solid var(--admin-border);border-radius:10px}.ai-box > i{font-size:22px;color:#6d28d9}.ai-box .ai-button{margin-left:auto;flex-shrink:0}
.fixture-select{display:flex;align-items:center;gap:10px;margin-top:10px;padding:8px 12px;border:1px dashed var(--admin-border);border-radius:9px;font-size:12px;color:var(--admin-muted)}
.fixture-select span{display:inline-flex;align-items:center;gap:6px;font-weight:700;white-space:nowrap}
.fixture-select select{flex:1;min-width:0;height:34px;padding:0 8px;border:1px solid var(--admin-border);border-radius:7px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:12px}
.hint{display:flex;align-items:center;gap:6px;margin:12px 0 0;color:var(--admin-muted);font-size:12px}.hint.warn{color:var(--admin-warning-text)}
.duplicate{display:flex;align-items:flex-start;gap:10px;margin-top:14px;padding:12px 14px;border:1px solid var(--admin-danger-text);border-radius:10px;background:var(--admin-danger-bg);color:var(--admin-danger-text);font-size:13px;font-weight:700}
.form-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px 12px;margin-top:14px}.wide{grid-column:span 2}
.form-grid label{display:block;color:var(--admin-heading);font-size:12px;font-weight:700}.form-grid label > span{color:var(--admin-danger-text)}
.form-grid input,.form-grid select{display:block;width:100%;height:38px;margin-top:6px;padding:0 10px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:13px;outline:0}
.sections{display:grid;gap:8px}
.section{padding:10px 12px;border:1px solid var(--admin-border);border-radius:9px}
.section-line{display:flex;align-items:center;gap:10px}.section-line strong{flex:1;color:var(--admin-heading);font-size:13px}.section-line small{color:var(--admin-muted);font-size:11px}
.section-line select{height:32px;padding:0 8px;border:1px solid var(--admin-border);border-radius:7px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:12px}
.findings{display:grid;gap:4px;margin:8px 0 0;padding-left:20px;color:var(--admin-text);font-size:12px;line-height:1.45}.findings.padded{margin:0}
.rows-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap}.rows-head h4{margin-bottom:0}
.table-wrap{max-height:420px;overflow:auto;margin-top:10px;border:1px solid var(--admin-border);border-radius:9px}
table{width:100%;border-collapse:collapse}th,td{padding:7px 9px;text-align:left;border-bottom:1px solid var(--admin-row-border);font-size:12px;color:var(--admin-text);vertical-align:top}
th{position:sticky;top:0;z-index:1;font-size:11px;font-weight:700;color:var(--admin-muted);background:var(--admin-soft);white-space:nowrap}
tr.skipped td{opacity:.5}
.cell-input{width:100%;min-width:90px;height:32px;padding:0 8px;border:1px solid var(--admin-border);border-radius:7px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:12px;outline:0}
.cell-input.narrow{min-width:56px;width:64px}.cell-input.wide-select{min-width:230px}
.cell-input.uygun{color:var(--admin-success-text)}.cell-input.uygun_degil{color:var(--admin-danger-text)}.cell-input.none{color:var(--admin-muted)}
.raw{display:block;margin-top:3px;color:var(--admin-muted);font-size:10px}
.muted{margin:6px 0 0;color:var(--admin-muted);font-size:12px}
.error-text{margin:12px 0 0;color:var(--admin-danger-text);font-size:12px}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
.primary-button,.ai-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 17px;border:0;border-radius:8px;font-size:13px;font-weight:800;cursor:pointer}
.primary-button{background:var(--pk-yellow);color:#111827}.ai-button{background:#6d28d9;color:#fff}.primary-button:disabled,.ai-button:disabled{opacity:.55;cursor:not-allowed}
.secondary-button{min-height:40px;padding:0 18px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-hover);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}
@media(max-width:800px){.form-grid{grid-template-columns:1fr 1fr}}
</style>
