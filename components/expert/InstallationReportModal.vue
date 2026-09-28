<template>
  <div class="modal-backdrop" @click.self="close">
    <section class="modal-card">
      <div class="modal-head">
        <div>
          <h2>{{ installation ? 'Kontrol Ekle' : 'Yeni Tesisat Raporu Yükle' }}</h2>
          <p>{{ installation ? `${installation.name} · ${installation.location?.name || ''}` : placeLabel }}</p>
        </div>
        <button class="close-button" type="button" @click="close"><i class="pi pi-times" /></button>
      </div>

      <!-- Rapor dosyası (her iki yolda da zorunlu: dijital arşiv) -->
      <input ref="fileInput" type="file" accept="application/pdf,image/jpeg,image/png" hidden @change="onFile" />
      <button class="file-box" :class="{ filled: file }" type="button" :disabled="busy" @click="fileInput?.click()">
        <i :class="file ? 'pi pi-file-pdf' : 'pi pi-cloud-upload'" />
        <span v-if="file"><strong>{{ file.name }}</strong><small>değiştirmek için tıklayın</small></span>
        <span v-else><strong>Tesisat periyodik kontrol raporunu seçin</strong><small>PDF, JPG ya da PNG · en fazla 50 MB</small></span>
      </button>

      <div class="mode">
        <button type="button" :class="{ active: mode === 'manual' }" :disabled="busy" @click="setMode('manual')"><i class="pi pi-pencil" /> Elle doldur</button>
        <button type="button" :class="{ active: mode === 'ai' }" :disabled="busy" @click="setMode('ai')"><i class="pi pi-sparkles" /> Yapay zeka ile analiz et</button>
      </div>

      <!-- Yapay zeka: önce analiz -->
      <template v-if="mode === 'ai' && !analysis">
        <p v-if="file && !isPdf && !fixtureId" class="hint warn">Yapay zeka analizi yalnızca PDF raporlarda çalışır. Görsel raporu "Elle doldur" ile yükleyin.</p>
        <div v-else class="ai-box">
          <template v-if="analyzing">
            <i class="pi pi-spin pi-spinner" />
            <span><strong>Rapor okunuyor...</strong><small>Tesisat türü, sistemler, sonuçlar ve bulgular çıkarılıyor. 1-3 dakika sürebilir, pencereyi kapatmayın.</small></span>
          </template>
          <template v-else>
            <i class="pi pi-sparkles" />
            <span><strong>Rapor yapay zeka ile okunacak</strong><small>Tesisat türü ve sistemlerin sonuçları doldurulur; kaydetmeden önce kontrol edersiniz.</small></span>
            <button class="ai-button" type="button" :disabled="!file && !fixtureId" @click="analyze">Analiz et</button>
          </template>
        </div>
        <label v-if="!analyzing && fixtures.length" class="fixture-select">
          <span><i class="pi pi-database" /> Test verisi</span>
          <select v-model="fixtureId">
            <option value="">Kullanma — raporu yapay zeka ile oku</option>
            <option v-for="fixture in fixtures" :key="fixture.fixture_id" :value="fixture.fixture_id">{{ fixtureLabel(fixture) }}</option>
          </select>
        </label>
      </template>

      <template v-if="analysis">
        <p v-if="analysis.fixture" class="hint"><i class="pi pi-database" /> Test verisi kullanıldı: {{ analysis.fixture.original_file_name }} (yapay zeka çağrılmadı)</p>
        <p v-if="typeWarning" class="hint warn"><i class="pi pi-exclamation-triangle" /> {{ typeWarning }}</p>
        <p v-if="analysis.input === 'ocr'" class="hint warn"><i class="pi pi-image" /> Rapor taranmış; metin OCR ile okundu. Kaşe ya da imza altında kalan değerler eksik olabilir, kaydetmeden önce kontrol edin.</p>
        <div v-if="analysis.duplicate" class="duplicate">
          <i class="pi pi-ban" />
          <span>{{ analysis.duplicate.message }}</span>
        </div>
      </template>

      <!-- Kontrol bilgileri: elle ya da yapay zeka önerisiyle dolu -->
      <template v-if="formVisible">
        <div class="form-grid">
          <label v-if="!installation" class="wide">Tesisat türü <span>*</span>
            <select v-model="form.installation_type_id" @change="onTypeChange">
              <option :value="null" disabled>Seçin</option>
              <option v-for="type in catalog" :key="type.id" :value="type.id">{{ type.name }}</option>
            </select>
          </label>
        </div>
        <p v-if="analysis?.type_evidence && !installation" class="hint">Yapay zekanın dayanağı: “{{ analysis.type_evidence }}”</p>
        <p v-if="!installation && selectedType" class="target" :class="{ new: !target }">
          <i :class="target ? 'pi pi-link' : 'pi pi-plus-circle'" />
          <template v-if="target">Rapor bu lokasyondaki <strong>{{ target.name }}</strong> kaydına eklenecek.</template>
          <template v-else>Bu lokasyonda {{ selectedType.name }} kaydı yok; rapor kaydedilince oluşturulacak.</template>
        </p>

        <div class="form-grid">
          <label>Genel sonuç <span>*</span>
            <select v-model="form.status">
              <option value="" disabled>Seçin</option>
              <option value="uygun">Uygun</option>
              <option value="uygun_degil">Uygun değil</option>
            </select>
          </label>
          <label>Kontrol tarihi <span>*</span><input v-model="form.control_date" type="date" /></label>
          <label>Geçerlilik tarihi (sonraki kontrol)<input v-model="form.next_control_date" type="date" /></label>
          <label>Rapor no<input v-model="form.report_no" type="text" placeholder="Raporda yazan numara" /></label>
          <label class="wide">Kontrolü yapan kuruluş<input v-model="form.inspection_body" type="text" placeholder="Periyodik kontrolü yapan firma" /></label>
          <label class="wide">Sonuç ve kanaat<textarea v-model="form.conclusion" rows="2" placeholder="Raporun sonuç ve kanaat bölümü" /></label>
        </div>
        <p v-if="analysis && !analysis.status" class="hint warn">Raporun genel sonucu net okunamadı, siz seçin.</p>
        <p v-if="analysis?.next_control_source === 'period'" class="hint">Raporda geçerlilik tarihi bulunamadı; gelecek kontrol 12 aylık periyoda göre hesaplandı.</p>

        <!-- Sistemler: katalogdan (ön tanımlı); sonuç, bulgular, rapordaki ekipman özeti -->
        <div class="systems">
          <div class="systems-head">
            <strong>Kontrol edilen sistemler</strong>
            <button class="link-button" type="button" :disabled="!selectedType" @click="addSystem"><i class="pi pi-plus" /> Sistem ekle</button>
          </div>
          <p v-if="installation && !analysis" class="muted">Tesisatın sistemleri listelendi; kontrolde olmayanları çıkarın. Raporda olup tesisatta olmayan sistem, kayıtta tesisata eklenir.</p>
          <p v-if="unmatchedCount" class="hint warn">
            <i class="pi pi-link" /> {{ unmatchedCount }} sistem katalogla eşleşmedi. Karşılığını listeden seçin; seçmezseniz tesisata eklenmez, isterseniz kataloğa eklenmesi için talep gönderilir.
          </p>
          <p v-if="!selectedType" class="muted">Önce tesisat türünü seçin.</p>
          <p v-else-if="!systems.length" class="muted">Rapordaki sistemleri ekleyin.</p>
          <div v-for="(system, index) in systems" :key="system.uid" class="system-row" :class="{ open: system.open, unmatched: isUnmatched(system), missing: !system.system_id && !system.source_names.length }">
            <div v-if="system.source_names.length" class="report-name"><small>Raporda:</small> <strong>{{ system.source_names.join(' / ') }}</strong></div>
            <div class="system-line">
              <!-- Katalogdaki karşılığı: yapay zeka tanıdıysa seçili; tanımadıysa kullanıcı seçer ya da boş bırakır -->
              <select v-model="system.system_id" :title="system.source_names.length ? 'Katalogdaki karşılığı' : 'Sistem'">
                <option :value="null">{{ system.source_names.length ? 'Katalogda karşılığı yok' : 'Listeden sistem seçin' }}</option>
                <option v-for="option in selectedType?.systems || []" :key="option.id" :value="option.id">{{ option.name }}</option>
              </select>
              <select v-model="system.status" class="status-select" :class="system.status">
                <option :value="null">Belirtilmemiş</option>
                <option value="uygun">Uygun</option>
                <option value="uygun_degil">Uygun değil</option>
              </select>
              <button class="link-button" type="button" @click="system.open = !system.open">
                {{ system.findings.length }} bulgu <i :class="system.open ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" />
              </button>
              <button class="icon-button" type="button" title="Sistemi çıkar" aria-label="Sistemi çıkar" @click="systems.splice(index, 1)"><i class="pi pi-times" /></button>
            </div>
            <label v-if="isUnmatched(system)" class="request-check"><input v-model="system.request" type="checkbox" /> Kataloğa eklenmesi için talep gönder</label>
            <small v-if="!system.system_id && !system.source_names.length" class="source warn">Listeden sistem seçin ya da satırı çıkarın.</small>
            <div v-if="system.equipment_summary.length" class="equipment-chips">
              <span v-for="(group, groupIndex) in system.equipment_summary" :key="groupIndex">
                {{ group.equipment_name }} {{ group.total }}<template v-if="group.uygun_degil"> · {{ group.uygun_degil }} uygun değil</template>
              </span>
            </div>
            <div v-if="system.open" class="findings-edit">
              <ol v-if="system.findings.length">
                <li v-for="(_, findingIndex) in system.findings" :key="findingIndex">
                  <textarea v-model="system.findings[findingIndex]" rows="2" placeholder="Bulgu / kusur açıklaması" />
                  <button class="icon-button" type="button" title="Bulguyu sil" aria-label="Bulguyu sil" @click="system.findings.splice(findingIndex, 1)"><i class="pi pi-times" /></button>
                </li>
              </ol>
              <p v-else class="muted">Bulgu yok.</p>
              <button class="link-button" type="button" @click="system.findings.push('')"><i class="pi pi-plus" /> Bulgu ekle</button>
            </div>
          </div>
        </div>

        <!-- Rapordaki ekipmanlar: Ekipmanlar'daki karşılığı (mevcut / yeni / ekleme); her birine bu raporla kontrol kaydı -->
        <div v-if="equipmentRows.length" class="systems">
          <div class="systems-head">
            <strong>Rapordaki ekipmanlar <small class="muted">({{ equipmentRows.length }})</small></strong>
            <span v-if="missingStatus" class="bulk-status">
              Belirtilmemiş {{ missingStatus }} ekipmanı:
              <button type="button" class="chip-button ok" @click="fillStatus('uygun')">Uygun yap</button>
              <button type="button" class="chip-button bad" @click="fillStatus('uygun_degil')">Uygun değil yap</button>
            </span>
          </div>
          <p class="muted">
            Kaydedince <strong>{{ equipmentCounts.new }}</strong> yeni ekipman Ekipmanlar'a eklenir, <strong>{{ equipmentCounts.matched }}</strong> ekipman mevcut kaydıyla eşleşir; hepsine bu raporla kontrol kaydı yazılır.
            <template v-if="equipmentCounts.skip"> {{ equipmentCounts.skip }} satır eklenmez.</template>
            Durum: bulguda geçen ekipman uygun değil; bulgusu yoksa kriterlerinden, o da yoksa belirtilmemiş.
          </p>
          <div v-for="group in equipmentGroups" :key="group.name" class="equipment-group">
            <div class="group-head">
              <strong>{{ group.label }}</strong><small>{{ group.rows.length }}</small>
              <small v-if="!group.systemId" class="warn">Bu sistem kontrolde yok ya da eşleşmedi; ekipmanları eklenmez.</small>
            </div>
            <div class="eq-row eq-head" :class="{ 'with-variant': group.showVariant }"><span>No</span><span>Konum</span><span>Tür</span><span v-if="group.showVariant">Tip / Etiket</span><span>Durum</span><span>Ekipmanlar'daki karşılığı</span><span /></div>
            <template v-for="row in group.rows" :key="row.key">
              <div class="eq-row" :class="{ 'with-variant': group.showVariant, skipped: !group.systemId || row.choice === 'skip', invalid: group.systemId && rowProblem(row) }">
                <input v-model="row.code" type="text" placeholder="No" :disabled="!group.systemId || row.choice !== 'new'" />
                <input v-model="row.place" type="text" placeholder="Konum" :disabled="!group.systemId || row.choice !== 'new'" />
                <select v-if="typesOf(group.systemId).length > 1" v-model="row.type_id" :disabled="!group.systemId" @change="onRowType(row)">
                  <option :value="null" disabled>Tür seçin</option>
                  <option v-for="type in typesOf(group.systemId)" :key="type.id" :value="type.id">{{ type.name }}</option>
                </select>
                <span v-else class="type-text">{{ typesOf(group.systemId)[0]?.name || row.equipment_name || '—' }}</span>
                <!-- Etiket (ör. pompa: Elektrikli / Dizel / Jokey): yalnızca rapordan etiket gelen grupta; katalogdaki etiketlerle -->
                <template v-if="group.showVariant">
                  <select v-if="variantsOf(row).length" v-model="row.variant" :disabled="!group.systemId || row.choice !== 'new'" @change="row.touched = true">
                    <option value="">—</option>
                    <option v-for="variant in variantsOf(row)" :key="variant" :value="variant">{{ variant }}</option>
                  </select>
                  <span v-else class="type-text">—</span>
                </template>
                <select v-model="row.status" class="status-select" :class="row.status" :disabled="!group.systemId || row.choice === 'skip'" @change="row.touched = true">
                  <option :value="null">Belirtilmemiş</option>
                  <option value="uygun">Uygun</option>
                  <option value="uygun_degil">Uygun değil</option>
                </select>
                <select v-model="row.choice" :disabled="!group.systemId" :title="row.reason" @change="row.touched = true">
                  <option value="new">+ Yeni ekipman olarak ekle</option>
                  <option v-for="item in candidatesOf(row)" :key="item.id" :value="`e${item.id}`">Mevcut: {{ item.code || '—' }} · {{ item.place || 'konum yok' }}</option>
                  <option value="skip">Ekleme</option>
                </select>
                <button v-if="row.findings.length" class="link-button" type="button" @click="row.open = !row.open">{{ row.findings.length }} bulgu</button>
                <span v-else />
              </div>
              <ol v-if="row.open" class="row-findings"><li v-for="(finding, index) in row.findings" :key="index">{{ finding }}</li></ol>
            </template>
          </div>
          <p v-if="equipmentProblem" class="hint warn"><i class="pi pi-exclamation-triangle" /> {{ equipmentProblem }}</p>
        </div>

        <!-- Hiçbir sisteme bağlı olmayan bulgular -->
        <div class="systems">
          <div class="systems-head">
            <strong>Genel bulgular <small class="muted">(sisteme bağlı olmayan)</small></strong>
          </div>
          <div class="findings-edit">
            <ol v-if="generalFindings.length">
              <li v-for="(_, findingIndex) in generalFindings" :key="findingIndex">
                <textarea v-model="generalFindings[findingIndex]" rows="2" placeholder="Bulgu / kusur açıklaması" />
                <button class="icon-button" type="button" title="Bulguyu sil" aria-label="Bulguyu sil" @click="generalFindings.splice(findingIndex, 1)"><i class="pi pi-times" /></button>
              </li>
            </ol>
            <button class="link-button" type="button" @click="generalFindings.push('')"><i class="pi pi-plus" /> Bulgu ekle</button>
          </div>
        </div>
      </template>

      <p v-if="error" class="error-text">{{ error }}</p>
      <div class="modal-actions">
        <button class="secondary-button" type="button" :disabled="busy" @click="close">İptal</button>
        <button v-if="formVisible && !analysis?.duplicate" class="primary-button" type="button" :disabled="busy || !canSave" @click="save">
          {{ saving ? 'Kaydediliyor...' : 'Kaydet' }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// Tesisat kontrolü (rapor) ekleme: elle giriş ya da yapay zeka ile okuma (tür, sistemler, sonuçlar, bulgular); kullanıcı kontrol edip kaydeder.
// Tesisatın içinden açılınca sistemler tesisatın sistemleriyle dolu gelir. Sistemler katalogdan (ön tanımlı); raporda olup
// tesisatta olmayan sistem kayıtta tesisata eklenir.
// Yapay zekanın tanımadığı (katalogla eşleşmeyen) rapor sistemini kullanıcı listeden eşleştirir; eşleştirmezse tesisata
// eklenmez, isterse kataloğa ekleme talebi gider. Kendiliğinden hiçbir sisteme bağlanmaz.
const props = defineProps<{ context?: any; installation?: any }>()
const emit = defineEmits<{ close: []; saved: [installation: any] }>()

// identity: türün kimlik kuralı (ekipman tarafındaki kayıt): dolap = konum + no, diğerleri no.
interface CatalogSystem { id: number; slug: string; name: string; equipment_types: { id: number; name: string; identity: string[]; variants: string[] }[] }
interface CatalogType { id: number; slug: string; name: string; systems: CatalogSystem[] }
// Rapordaki ekipman satırı: choice = 'new' (yeni ekipman) | 'skip' (eklenmez) | 'e<id>' (mevcut ekipman). touched: kullanıcı
// değiştirdi (sistem eşleştirmesi değişince önerisi yeniden hesaplanmaz).
interface EquipmentRow {
  key: string; system_name: string; equipment_name: string; code: string; place: string; brand: string | null; model: string | null; serial_no: string | null
  status: string | null; findings: string[]; type_id: number | null; choice: string; reason: string; touched: boolean; open: boolean
  // Rapordaki teknik özellikler (başlık → değer); kayıtta katalogdakilerle eşleşenler ekipmana yazılır.
  properties: Record<string, string>
  // Etiket (türün katalogdaki etiketlerinden, ör. pompa: Elektrikli / Dizel / Jokey); yeni ekipmana yazılır.
  variant: string
}
// request: eşleşmeyen rapor sistemi için kataloğa ekleme talebi.
interface SystemRow { uid: number; system_id: number | null; status: string | null; source_names: string[]; findings: string[]; equipment_summary: any[]; open: boolean; request: boolean }

const { get, postForm, errorMessage } = useExpertApi()
const { fixtures: allFixtures, fixtureLabel, loadFixtures } = useReportFixtures()
// Test verisi: yalnızca tesisat raporları (ekipman kataloğuyla okunmuş fikstürler hariç).
const fixtures = computed(() => allFixtures.value.filter((fixture: any) => fixture.context?.mode !== 'catalog'))

const catalog = ref<CatalogType[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const file = ref<File | null>(null)
const mode = ref<'manual' | 'ai'>('ai')
const fixtureId = ref('')
const analyzing = ref(false)
const saving = ref(false)
const error = ref('')
const analysis = ref<any>(null)
const installations = ref<any[]>([])
const systems = ref<SystemRow[]>([])
const generalFindings = ref<string[]>([])
const equipmentRows = ref<EquipmentRow[]>([])
let uid = 0
const emptyForm = () => ({ installation_type_id: (props.installation?.type?.id ?? null) as number | null, status: '', control_date: '', next_control_date: '', report_no: '', inspection_body: '', conclusion: '' })
const form = reactive(emptyForm())

const busy = computed(() => analyzing.value || saving.value)
// Tesisatın içinden yüklenen rapor başka türde okunduysa (ör. algılama raporu yangın tesisatına) uyarı.
const typeWarning = computed(() => {
  if (!props.installation || !analysis.value) return ''
  const read = analysis.value.installation_type
  if (!read) return 'Raporun tesisat türü belirlenemedi; bu tesisatın raporu olduğundan emin olun.'
  return read.id !== props.installation.type?.id
    ? `Rapor “${read.name}” raporu olarak okundu; bu tesisat ${props.installation.type?.name}. Doğru raporu yüklediğinizden emin olun.`
    : ''
})
const isPdf = computed(() => !!file.value && (file.value.type === 'application/pdf' || file.value.name.toLowerCase().endsWith('.pdf')))
const formVisible = computed(() => mode.value === 'manual' || !!analysis.value)
const selectedType = computed(() => catalog.value.find(type => type.id === form.installation_type_id) || null)
const placeLabel = computed(() => [props.context?.location_name, props.context?.type === 'workplace' ? props.context?.company_name : null].filter(Boolean).join(' · '))
// Raporun ekleneceği tesisat: lokasyondaki aynı türde tesisat (yoksa oluşturulur).
const target = computed(() => installations.value.find(item => item.type?.id === form.installation_type_id) || null)
// Rapordan gelip katalogda karşılığı seçilmemiş sistem (tesisata eklenmez; talep isteğe bağlı).
const isUnmatched = (system: SystemRow) => !system.system_id && system.source_names.length > 0
const unmatchedCount = computed(() => systems.value.filter(isUnmatched).length)
// En az bir katalog sistemi; elle eklenen satırda sistem seçilmiş olmalı (eşleşmeyen rapor sistemi kaydı engellemez).
const canSave = computed(() => !!file.value && !!form.installation_type_id && !!form.status && !!form.control_date
  && systems.value.some(system => system.system_id) && systems.value.every(system => system.system_id || system.source_names.length)
  && !equipmentProblem.value)

// --- Rapordaki ekipmanlar ---
// Satırın sistemi: rapordaki sistem adı formdaki (eşleştirilmiş) sistem satırında; sistem çıkarıldıysa ya da eşleşmediyse yok.
const systemOf = (row: EquipmentRow) => systems.value.find(system => system.source_names.includes(row.system_name))?.system_id ?? null
const typesOf = (systemId: number | null) => selectedType.value?.systems.find(system => system.id === systemId)?.equipment_types || []
const locationEquipment = computed<any[]>(() => analysis.value?.location_equipment || [])
const candidatesOf = (row: EquipmentRow) => locationEquipment.value.filter(item => item.type_id === row.type_id)
const included = (row: EquipmentRow) => !!systemOf(row) && row.choice !== 'skip'
const rowProblem = (row: EquipmentRow) => included(row) && !row.type_id
const equipmentGroups = computed(() => {
  const groups = new Map<string, { name: string; label: string; systemId: number | null; rows: EquipmentRow[]; showVariant: boolean }>()
  for (const row of equipmentRows.value) {
    const systemId = systemOf(row)
    const group = groups.get(row.system_name) || { name: row.system_name, label: selectedType.value?.systems.find(system => system.id === systemId)?.name || row.system_name, systemId, rows: [], showVariant: false }
    group.rows.push(row)
    // Tip / Etiket sütunu yalnızca rapordan etiket gelen grupta (ör. pompalar); dolap listesinde gerek yok.
    group.showVariant ||= !!guessVariant(row)
    groups.set(row.system_name, group)
  }
  return [...groups.values()]
})
const equipmentCounts = computed(() => {
  const rows = equipmentRows.value.filter(included)
  return { new: rows.filter(row => row.choice === 'new').length, matched: rows.filter(row => row.choice.startsWith('e')).length, skip: equipmentRows.value.length - rows.length }
})
const missingStatus = computed(() => equipmentRows.value.filter(row => included(row) && !row.status).length)
const equipmentProblem = computed(() => {
  const rows = equipmentRows.value.filter(included)
  if (rows.some(row => !row.type_id)) return 'Türü seçilmemiş ekipman var.'
  const chosen = rows.filter(row => row.choice.startsWith('e')).map(row => row.choice)
  if (new Set(chosen).size !== chosen.length) return 'Aynı mevcut ekipman iki satırda seçilmiş.'
  return ''
})
const fillStatus = (status: string) => { for (const row of equipmentRows.value) if (included(row) && !row.status) { row.status = status; row.touched = true } }
// Etiket önerisi: rapordaki değerlerden katalogdaki etiketle aynı olan; yoksa biri diğeriyle başlayan ("ELEKTRİK" →
// Elektrikli). Tam eşleşme önce: jokey pompada hem "ELEKTRİK" hem "JOKEY" yazar, "Jokey" seçilir.
const variantsOf = (row: EquipmentRow) => typesOf(systemOf(row)).find(type => type.id === row.type_id)?.variants || []
const guessVariant = (row: EquipmentRow) => {
  const variants = variantsOf(row)
  const values = Object.values(row.properties).map(value => normalize(String(value))).filter(value => value.length >= 3)
  return variants.find(variant => values.includes(normalize(variant)))
    || variants.find(variant => values.some(value => normalize(variant).startsWith(value) || value.startsWith(normalize(variant))))
    || ''
}

// Tür seçilince karşılık yeniden önerilir (türü belirlenemediği için "Ekleme" gelen satır da böylece eklenir).
const onRowType = (row: EquipmentRow) => {
  row.touched = true
  row.variant = guessVariant(row)
  const used = new Set(equipmentRows.value.filter(other => other !== row && other.choice.startsWith('e')).map(other => Number(other.choice.slice(1))))
  const match = suggest(row, used)
  row.choice = match ? `e${match.item.id}` : 'new'
  row.reason = match?.reason || ''
}

// Karşılık önerisi: seri no, yoksa türün kimlik kuralı (dolap = no + konum; diğerleri no) — lokasyonda aynı türde tek kayıt
// varsa. Kuraldaki alanlardan biri satırda boşsa öneri yok. Aynı mevcut ekipman iki satıra önerilmez; kullanıcı değiştirebilir.
const IDENTITY_LABELS: Record<string, string> = { code: 'no', place: 'konum', variant: 'tip' }
const compact = (value?: string | null) => (value || '').toLocaleLowerCase('tr-TR').split(' ').join('')
const identityOf = (row: EquipmentRow) => typesOf(systemOf(row)).find(type => type.id === row.type_id)?.identity || ['code']
const suggest = (row: EquipmentRow, used: Set<number>) => {
  const pool = candidatesOf(row).filter(item => !used.has(item.id))
  const only = (items: any[]) => items.length === 1 ? items[0] : null
  const serial = compact(row.serial_no)
  const bySerial = serial.length > 3 ? only(pool.filter(item => compact(item.serial_no) === serial)) : null
  if (bySerial) return { item: bySerial, reason: 'Seri no aynı' }
  const fields = identityOf(row).filter(field => field !== 'variant') as ('code' | 'place')[]
  if (!fields.length || fields.some(field => !compact(row[field]))) return null
  const match = only(pool.filter(item => fields.every(field => compact(item[field]) === compact(row[field]))))
  return match ? { item: match, reason: `${fields.map(field => IDENTITY_LABELS[field]).join(' ve ')} aynı` } : null
}
// Kullanıcının değiştirmediği satırlarda tür ve karşılık: sistemin tek türü ya da rapordaki adla aynı tür.
const applyEquipmentDefaults = () => {
  const used = new Set(equipmentRows.value.filter(row => row.touched && row.choice.startsWith('e')).map(row => Number(row.choice.slice(1))))
  for (const row of equipmentRows.value) {
    if (row.touched) continue
    const types = typesOf(systemOf(row))
    row.type_id = types.length === 1 ? types[0].id : types.find(type => normalize(type.name) === normalize(row.equipment_name))?.id ?? null
    // Türü belirlenemeyen satır (ör. "Dizel Pompa Yakıt Bilgileri", "Sprinkler Sistemi"): kaydı engellemez, "Ekleme" gelir;
    // kullanıcı tür seçerse eklenir.
    if (!row.type_id) {
      row.choice = 'skip'
      row.reason = 'Tür belirlenemedi; tür seçerseniz eklenir.'
      continue
    }
    row.variant = guessVariant(row)
    const match = suggest(row, used)
    row.choice = match ? `e${match.item.id}` : 'new'
    row.reason = match?.reason || ''
    if (match) used.add(match.item.id)
  }
}
watch(() => systems.value.map(system => `${system.system_id}:${system.source_names.join('/')}`).join('|'), applyEquipmentDefaults)

const normalize = (value: string) => value.replace(/İ/g, 'i').replace(/I/g, 'ı').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/\s+/g, ' ').trim()

const close = () => { if (!busy.value) emit('close') }
const setMode = (value: 'manual' | 'ai') => { mode.value = value; error.value = '' }
const onFile = (event: Event) => {
  const selected = (event.target as HTMLInputElement).files?.[0]
  if (fileInput.value) fileInput.value.value = ''
  if (!selected) return
  file.value = selected
  error.value = ''
}
const addSystem = () => { systems.value.push({ uid: ++uid, system_id: null, status: null, source_names: [], findings: [], equipment_summary: [], open: false, request: false }) }

// Tür değişince sistemler yeni türün listesinde aynı adla aranır; karşılığı yoksa seçim boşalır.
const onTypeChange = () => {
  for (const system of systems.value) {
    const names = [...system.source_names]
    const match = selectedType.value?.systems.find(option => names.some(name => normalize(name) === normalize(option.name)))
    system.system_id = match?.id ?? null
  }
}

const analyze = async () => {
  if (!file.value && !fixtureId.value) return
  analyzing.value = true
  error.value = ''
  const body = new FormData()
  if (fixtureId.value) body.append('fixture_id', fixtureId.value)
  else if (file.value) body.append('report', file.value)
  const locationId = props.installation?.location?.id ?? props.context?.location_id
  body.append('location_id', String(locationId))
  if (!props.installation && props.context?.type === 'workplace' && props.context.workplace_id) body.append('workplace_id', String(props.context.workplace_id))
  try {
    const data = await postForm('/pk-installations/report-analysis', body)
    analysis.value = data
    installations.value = data.installations || []
    Object.assign(form, {
      installation_type_id: props.installation?.type?.id ?? data.installation_type?.id ?? null,
      status: data.status || '',
      control_date: data.control_date || '',
      next_control_date: data.next_control_date || '',
      report_no: data.report_no || '',
      inspection_body: data.inspection_body?.name || '',
      conclusion: data.overall_text || ''
    })
    systems.value = (data.systems || []).map((system: any) => ({
      uid: ++uid,
      system_id: system.system_id ?? null,
      status: system.status ?? null,
      source_names: system.source_names || [],
      findings: [...(system.findings || [])],
      equipment_summary: system.equipment_summary || [],
      open: false,
      request: false
    }))
    generalFindings.value = [...(data.general_findings || [])]
    // Tesisat sayfasından açıldıysa tür sabit: sistemler o türün listesinde aynı adla aranır.
    const mismatch = !!props.installation && data.installation_type?.id !== props.installation.type?.id
    if (mismatch) onTypeChange()
    // Eşleşmeyenler en üstte (kullanıcı görüp eşleştirsin). Talep kutusu işaretli gelir; rapor başka türde okunduysa boş.
    const otherType = mismatch && !!data.installation_type
    for (const system of systems.value) system.request = isUnmatched(system) && !otherType
    systems.value.sort((a, b) => Number(!isUnmatched(a)) - Number(!isUnmatched(b)))
    // Rapordaki ekipman satırları (tablo adımı); tür ve karşılık önerisi sistem eşleştirmesine göre.
    equipmentRows.value = (data.equipment_rows || []).map((row: any) => ({
      key: row.key,
      system_name: row.system_name,
      equipment_name: row.equipment_name,
      code: row.code || '',
      place: row.place || '',
      brand: row.brand,
      model: row.model,
      serial_no: row.serial_no,
      status: row.status ?? null,
      findings: row.findings || [],
      properties: row.properties || {},
      variant: '',
      type_id: null,
      choice: 'new',
      reason: '',
      touched: false,
      open: false
    }))
    applyEquipmentDefaults()
  } catch (e: any) {
    error.value = errorMessage(e, 'Rapor analiz edilemedi.')
  } finally { analyzing.value = false }
}

const save = async () => {
  if (!file.value) { error.value = 'Rapor dosyasını seçin.'; return }
  saving.value = true
  error.value = ''
  const body = new FormData()
  body.append('report', file.value)
  if (mode.value === 'ai' && analysis.value?.analysis_id) body.append('analysis_id', analysis.value.analysis_id)
  if (props.installation) body.append('installation_id', String(props.installation.id))
  else {
    body.append('installation_type_id', String(form.installation_type_id))
    body.append('location_id', String(props.context.location_id))
  }
  body.append('status', form.status)
  body.append('control_date', form.control_date)
  if (form.next_control_date) body.append('next_control_date', form.next_control_date)
  for (const key of ['report_no', 'inspection_body', 'conclusion'] as const) {
    if (form[key].trim()) body.append(key, form[key].trim())
  }
  // Listeler JSON metni olarak: yüzlerce ekipmanlı raporda PHP'nin alan sınırına (max_input_vars) takılmaz.
  const clean = (items: string[]) => items.map(item => item.trim()).filter(Boolean)
  const text = (value?: string | null) => String(value ?? '').trim() || null
  // Eşleştirilen (katalogdaki) sistemler tesisata; eşleşmeyenler eklenmez, işaretliyse kataloğa ekleme talebi.
  body.append('systems', JSON.stringify(systems.value.filter(system => system.system_id).map(system => ({
    system_id: system.system_id, status: system.status, source_names: system.source_names, findings: clean(system.findings)
  }))))
  body.append('system_requests', JSON.stringify(systems.value.filter(system => isUnmatched(system) && system.request).map(system => ({
    name: system.source_names.join(' / '), status: system.status, findings: clean(system.findings)
  }))))
  body.append('findings', JSON.stringify(clean(generalFindings.value)))
  // Rapordaki ekipmanlar: mevcut ekipman ya da yeni ekipman; "Ekleme" ve sistemi olmayan satırlar gönderilmez.
  body.append('equipment', JSON.stringify(equipmentRows.value.filter(included).map(row => ({
    system_id: systemOf(row),
    equipment_type_id: row.type_id,
    equipment_id: row.choice.startsWith('e') ? Number(row.choice.slice(1)) : null,
    status: row.status,
    code: text(row.code),
    place: text(row.place),
    brand: text(row.brand),
    model: text(row.model),
    serial_no: text(row.serial_no),
    variant: text(row.variant),
    properties: row.properties,
    findings: row.findings
  }))))
  try {
    emit('saved', await postForm('/pk-installations/reports', body))
  } catch (e: any) {
    error.value = errorMessage(e, 'Rapor kaydedilemedi.')
  } finally { saving.value = false }
}

onMounted(async () => {
  // Tesisatın içinden: elle girişte satırlar tesisatın sistemleri (sonuç ve bulgular boş).
  if (props.installation?.systems) {
    systems.value = props.installation.systems.filter((system: any) => system.system_id).map((system: any) => ({
      uid: ++uid, system_id: system.system_id, status: null, source_names: [], findings: [], equipment_summary: [], open: false, request: false
    }))
  }
  loadFixtures()
  try {
    catalog.value = (await get('/pk-installation-catalog')).types
    // Elle girişte hedef tesisatı göstermek için lokasyondaki tesisatlar.
    if (!props.installation && props.context?.location_id) {
      installations.value = await get('/pk-installations', { location_id: props.context.location_id, ...(props.context.type === 'workplace' ? { workplace_id: props.context.workplace_id } : {}) })
    }
  } catch (e: any) {
    error.value = errorMessage(e, 'Tesisat kataloğu alınamadı.')
  }
})
</script>

<style scoped>
.modal-backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:var(--admin-overlay)}
.modal-card{width:min(1000px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:22px;background:var(--admin-card);border-radius:12px;box-shadow:0 20px 60px var(--admin-shadow)}
.modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:18px}
h2{margin:0;color:var(--admin-heading);font-size:18px}.modal-head p{margin:5px 0 0;color:var(--admin-muted);font-size:12px}
.close-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:var(--admin-muted);cursor:pointer;border-radius:7px}.close-button:hover{background:var(--admin-hover);color:var(--admin-heading)}
.file-box{width:100%;display:flex;align-items:center;gap:14px;padding:16px;border:1.5px dashed var(--admin-border);border-radius:10px;background:var(--admin-soft);color:var(--admin-muted);text-align:left;cursor:pointer;font:inherit}
.file-box:hover{border-color:#d7a900}.file-box.filled{border-style:solid}.file-box i{font-size:24px}.file-box.filled i{color:var(--admin-danger-text)}
.file-box span,.ai-box span{display:flex;flex-direction:column;gap:3px;min-width:0}.file-box strong,.ai-box strong{color:var(--admin-heading);font-size:13px;overflow-wrap:anywhere}.file-box small,.ai-box small{font-size:11px;color:var(--admin-muted)}
.mode{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0}
.mode button{display:flex;align-items:center;justify-content:center;gap:8px;min-height:40px;border:1px solid var(--admin-border);border-radius:9px;background:var(--admin-card);color:var(--admin-text);font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.mode button.active{border-color:#d7a900;background:var(--admin-accent-soft);color:var(--admin-heading)}
.ai-box{display:flex;align-items:center;gap:14px;padding:16px;border:1px solid var(--admin-border);border-radius:10px}.ai-box > i{font-size:22px;color:#6d28d9}.ai-box .ai-button{margin-left:auto;flex-shrink:0}
.fixture-select{display:flex;align-items:center;gap:10px;margin-top:10px;padding:8px 12px;border:1px dashed var(--admin-border);border-radius:9px;font-size:12px;color:var(--admin-muted)}
.fixture-select span{display:inline-flex;align-items:center;gap:6px;font-weight:700;white-space:nowrap}
.fixture-select select{flex:1;min-width:0;height:34px;padding:0 8px;border:1px solid var(--admin-border);border-radius:7px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:12px}
.hint{display:flex;align-items:center;gap:6px;margin:10px 0 0;color:var(--admin-muted);font-size:12px}.hint.warn{color:var(--admin-warning-text)}
.duplicate{display:flex;align-items:flex-start;gap:10px;margin-top:14px;padding:12px 14px;border:1px solid var(--admin-danger-text);border-radius:10px;background:var(--admin-danger-bg);color:var(--admin-danger-text);font-size:13px;font-weight:700}.duplicate a{margin-left:6px;color:inherit;text-decoration:underline}
.target{display:flex;align-items:center;gap:8px;margin:10px 0 0;padding:9px 12px;border-radius:9px;background:var(--admin-success-bg);color:var(--admin-success-text);font-size:12px}.target.new{background:var(--admin-soft);color:var(--admin-text)}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px;margin-top:14px}
.form-grid label{display:block;color:var(--admin-heading);font-size:12px;font-weight:700}.form-grid label > span{color:var(--admin-danger-text)}.wide{grid-column:1 / -1}
.form-grid input,.form-grid select,.form-grid textarea{display:block;width:100%;margin-top:6px;padding:0 10px;height:40px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:13px;outline:0}
.form-grid textarea{height:auto;padding:9px 10px;resize:vertical}
.form-grid input:focus,.form-grid select:focus,.form-grid textarea:focus{border-color:#d7a900;box-shadow:0 0 0 3px rgba(255,193,7,.12)}
.systems{display:grid;gap:8px;margin-top:18px}
.systems-head{display:flex;align-items:center;justify-content:space-between;color:var(--admin-heading);font-size:13px}
.system-row{display:grid;gap:6px;padding:10px 12px;border:1px solid var(--admin-border);border-radius:10px}.system-row.missing{border-color:var(--admin-warning-text)}
.system-line{display:flex;align-items:center;gap:8px}
.system-line select{height:36px;padding:0 8px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:12px}
.system-line select:first-child{flex:1;min-width:0}
.status-select{width:140px}.status-select.uygun{color:var(--admin-success-text)}.status-select.uygun_degil{color:var(--admin-danger-text)}
.source{color:var(--admin-muted);font-size:11px}.source.warn{color:var(--admin-warning-text)}
.bulk-status{display:inline-flex;align-items:center;gap:6px;color:var(--admin-muted);font-size:11px;font-weight:600}
.chip-button{height:26px;padding:0 10px;border:1px solid var(--admin-border);border-radius:999px;background:var(--admin-card);font:inherit;font-size:11px;font-weight:700;cursor:pointer}
.chip-button.ok{color:var(--admin-success-text)}.chip-button.bad{color:var(--admin-danger-text)}
.equipment-group{border:1px solid var(--admin-border);border-radius:10px;overflow:hidden}
.group-head{display:flex;align-items:baseline;gap:8px;padding:9px 12px;background:var(--admin-soft);color:var(--admin-heading);font-size:12px}.group-head small{color:var(--admin-muted)}.group-head small.warn{color:var(--admin-warning-text)}
.eq-row{display:grid;grid-template-columns:70px minmax(90px,1fr) minmax(110px,1fr) 125px minmax(160px,1.3fr) 60px;gap:6px;align-items:center;padding:6px 12px;border-top:1px solid var(--admin-row-border)}
.eq-row.with-variant{grid-template-columns:70px minmax(90px,1fr) minmax(110px,1fr) minmax(100px,.8fr) 125px minmax(160px,1.3fr) 60px}
.eq-row.eq-head{padding-top:7px;padding-bottom:7px;color:var(--admin-muted);font-size:11px;font-weight:700}
.eq-row input,.eq-row select{width:100%;min-width:0;height:32px;padding:0 8px;border:1px solid var(--admin-border);border-radius:7px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:12px}
.eq-row input:disabled{background:transparent;border-color:transparent;color:var(--admin-text)}
.eq-row .status-select{width:100%}
.eq-row.skipped{opacity:.55}.eq-row.invalid{background:var(--admin-warning-bg)}
.type-text{color:var(--admin-text);font-size:12px}
.row-findings{display:grid;gap:3px;margin:0;padding:4px 12px 8px 34px;color:var(--admin-text);font-size:11px;background:var(--admin-hover)}
.equipment-chips{display:flex;flex-wrap:wrap;gap:6px}.equipment-chips span{padding:2px 9px;border-radius:999px;background:var(--admin-chip);color:var(--admin-text);font-size:11px;font-weight:600}
.system-row.unmatched{border:1.5px dashed var(--admin-warning-text);background:var(--admin-warning-bg)}
.report-name{color:var(--admin-muted);font-size:11px;overflow-wrap:anywhere}.report-name strong{color:var(--admin-heading);font-size:12px}
.request-check{display:flex;align-items:center;gap:8px;color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}.request-check input{width:15px;height:15px;accent-color:#d7a900}
.findings-edit{display:grid;gap:6px}
.findings-edit ol{display:grid;gap:6px;margin:0;padding-left:22px;color:var(--admin-muted);font-size:12px}
.findings-edit li > *{vertical-align:top}
.findings-edit li textarea{display:inline-block;width:calc(100% - 40px);padding:8px 10px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:12px;resize:vertical;outline:0}
.link-button{display:inline-flex;align-items:center;gap:6px;border:0;background:none;color:var(--admin-link);font:inherit;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}.link-button:disabled{opacity:.5;cursor:not-allowed}
.icon-button{width:32px;height:32px;display:inline-grid;place-items:center;border:0;border-radius:7px;background:transparent;color:var(--admin-muted);cursor:pointer}.icon-button:hover{background:var(--admin-hover);color:var(--admin-danger-text)}
.muted{margin:0;color:var(--admin-muted);font-size:12px}
.error-text{margin:12px 0 0;color:var(--admin-danger-text);font-size:12px}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
.primary-button,.ai-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 17px;border:0;border-radius:8px;font-size:13px;font-weight:800;cursor:pointer}
.primary-button{background:var(--pk-yellow);color:#111827}.ai-button{background:#6d28d9;color:#fff}.primary-button:disabled,.ai-button:disabled{opacity:.55;cursor:not-allowed}
.secondary-button{min-height:40px;padding:0 18px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-hover);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}
@media(max-width:640px){.form-grid{grid-template-columns:1fr}.system-line{flex-wrap:wrap}.eq-row,.eq-row.with-variant{grid-template-columns:1fr 1fr}.eq-row.eq-head{display:none}}
</style>
