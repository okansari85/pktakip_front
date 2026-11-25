<template>
  <div>
    <div v-show="!minimized" class="modal-backdrop">
      <section class="modal-card">
        <div class="modal-head">
          <div class="title"><h2>Toplu Rapor Yükle</h2><p>{{ contextText }} · tek ekipmanlı raporlar (yangın ekipmanları hariç)</p></div>
          <ExpertReportSteps :step="saving ? 3 : items.length ? 2 : 1" />
          <div class="head-buttons">
            <button class="close-button" type="button" title="Küçült" aria-label="Küçült" @click="minimized = true"><PkIcon class="pi pi-window-minimize" /></button>
            <button class="close-button" type="button" title="Kapat" aria-label="Kapat" @click="close"><PkIcon class="pi pi-times" /></button>
          </div>
        </div>

        <p v-if="!sameContext" class="hint warn"><PkIcon class="pi pi-exclamation-triangle" /> Üstte seçili lokasyon değişti; bu pencere {{ contextText }} için açıldı. Yeni ekipmanlar oraya eklenir.</p>

        <!-- Dosyalar: çoklu seçim ya da sürükle bırak; aynı dosya listeye bir kez girer -->
        <input ref="fileInput" type="file" accept="application/pdf" multiple hidden @change="onPick" />
        <button class="file-box" :class="{ over: dragOver }" type="button" @click="fileInput?.click()" @dragover.prevent="dragOver = true" @dragleave.prevent="dragOver = false" @drop.prevent="onDrop">
          <PkIcon class="pi pi-file-pdf" />
          <span>
            <strong>{{ items.length ? 'Rapor ekle' : 'Periyodik kontrol raporlarını seçin ya da buraya sürükleyin' }}</strong>
            <small>PDF · her dosya tek ekipmanın raporu (raf, kapı, transpalet, forklift…; yangın ekipmanları hariç). Raporlar sırayla, birer birer okunur; daha önce yüklenmiş dosya okunmaz, son 24 saatte okunup kaydedilmemiş dosya yeniden okunmaz.</small>
          </span>
        </button>
        <label v-if="showFixtures && catalogFixtures.length" class="fixture-line">
          <input v-model="useFixtures" type="checkbox" :disabled="running" />
          <span><PkIcon class="pi pi-database" /> Test verisi kullan <small>— dosya adı aynı olan test verisi okunur, yapay zeka çağrılmaz</small></span>
        </label>

        <template v-if="items.length">
          <!-- İlerleme: okuma (öz yinelemeli, tek tek) ve kaydetme -->
          <div class="rd-card progress-box">
            <div class="progress-line">
              <span class="progress-title">
                <PkIcon v-if="running" class="pi pi-spin pi-spinner" />
                <strong>{{ progressTitle }}</strong>
                <small>{{ countsText }}<template v-if="etaText"> · {{ etaText }}</template></small>
              </span>
              <button v-if="running" class="secondary-button" type="button" :disabled="stopRequested" @click="stopRequested = true">{{ stopRequested ? 'Okunan bitince duracak' : 'Durdur' }}</button>
              <button v-else-if="queuedCount" class="ai-button" type="button" @click="start"><PkIcon class="pi pi-sparkles" /> {{ startedOnce ? 'Devam et' : 'Analizi başlat' }}</button>
            </div>
            <ProgressBar :value="readPercent" :show-value="false" class="bar" />
            <p v-if="stopMessage" class="hint warn"><PkIcon class="pi pi-pause-circle" /> {{ stopMessage }}</p>
            <template v-if="saveTotal">
              <div class="progress-line save-line">
                <span class="progress-title">
                  <PkIcon v-if="saving" class="pi pi-spin pi-spinner" />
                  <strong>{{ saving ? `Kaydediliyor: ${saveDone} / ${saveTotal}` : `Kayıt bitti: ${saveTotal - saveFailed} kaydedildi${saveFailed ? `, ${saveFailed} kaydedilemedi` : ''}` }}</strong>
                </span>
              </div>
              <ProgressBar :value="savePercent" :show-value="false" class="bar save" />
            </template>
          </div>

          <div class="rd-card list-card">
            <div class="card-head">
              <h3>Okunan bilgileri doğrulayın</h3>
              <label class="check-line"><input type="checkbox" :checked="allSelected" :disabled="!savable.length || saving" @change="toggleAll" /> Tümünü seç <small>({{ selectedRows.length }} / {{ savable.length }} kaydedilebilir)</small></label>
            </div>
            <div class="table-wrap">
              <PkTable>
                <thead><tr><th /><th>Dosya</th><th>Tür</th><th>Raporda</th><th>Sonuç</th><th>Kontrol</th><th>Gelecek</th><th>Ekipman</th><th /></tr></thead>
                <tbody>
                  <tr v-for="item in items" :key="item.key" :class="rowClass(item)">
                    <td><input v-model="item.selected" type="checkbox" :disabled="!canSave(item) || saving" /></td>
                    <td class="file-cell">
                      <strong :title="item.file.name">{{ item.file.name }}</strong>
                      <span class="state" :class="item.state"><PkIcon v-if="item.state === 'reading' || item.state === 'saving' || item.state === 'checking'" class="pi pi-spin pi-spinner" />{{ STATE_LABELS[item.state] }}<template v-if="item.result?.fixture"> · test verisi</template><template v-else-if="item.result?.reused_at"> · önceki okuma</template></span>
                      <small v-if="rowNote(item)" class="note" :class="rowNoteKind(item)">{{ rowNote(item) }}
                        <NuxtLink v-if="linkId(item)" :to="`/expert/equipment/${linkId(item)}`">Ekipmana git</NuxtLink>
                      </small>
                    </td>
                    <td>{{ item.result?.detected_type?.name || '—' }}</td>
                    <td>{{ reportIdentity(item) }}</td>
                    <td><span v-if="item.result?.status" class="status" :class="item.result.status">{{ STATUS_LABELS[item.result.status] || item.result.status }}</span><span v-else class="muted-cell">—</span></td>
                    <td class="nowrap">{{ formatDate(item.result?.control_date) }}</td>
                    <td class="nowrap">{{ formatDate(item.result?.next_control_date) }}</td>
                    <td>
                      <template v-if="item.result && !blockReason(item)">
                        <select v-model="item.choice" class="cell-input" :disabled="item.state === 'saving' || item.state === 'saved' || saving" @change="onChoice(item)">
                          <option value="new">Yeni ekipman</option>
                          <optgroup v-if="item.result.candidates?.length" label="Önerilen">
                            <option v-for="candidate in item.result.candidates" :key="candidate.id" :value="`e${candidate.id}`">{{ candidateText(candidate) }}</option>
                          </optgroup>
                          <optgroup v-if="othersFor(item).length" :label="`Diğer ${item.result.detected_type?.name || ''}`">
                            <option v-for="other in othersFor(item)" :key="other.id" :value="`e${other.id}`">{{ equipmentText(other) }}</option>
                          </optgroup>
                        </select>
                        <small v-if="choiceNote(item)" class="choice-note" :class="{ warn: choiceWarn(item) }">{{ choiceNote(item) }}</small>
                      </template>
                      <span v-else class="muted-cell">—</span>
                    </td>
                    <td class="actions">
                      <button v-if="item.state === 'error'" class="icon-button" type="button" title="Tekrar oku" aria-label="Tekrar oku" @click="retry(item)"><PkIcon class="pi pi-refresh" /></button>
                      <button v-if="removable(item)" class="icon-button" type="button" title="Listeden çıkar" aria-label="Listeden çıkar" @click="remove(item)"><PkIcon class="pi pi-times" /></button>
                    </td>
                  </tr>
                </tbody>
              </PkTable>
            </div>
            <p class="hint"><PkIcon class="pi pi-info-circle" /> Mevcut ekipmanla eşleşmeyen rapor için yeni ekipman açılır; isterseniz satırdan mevcut bir ekipman seçin. Toplu kayıtta mevcut ekipmanın teknik özellikleri değişmez, yeni özellik de eklenmez; yeni ekipman rapordaki bilgilerle açılır.</p>
          </div>
        </template>

        <p v-if="error" class="error-text">{{ error }}</p>
        <div class="modal-actions">
          <!-- Yeni ekipmanların firması; işyerinde birim / lokasyonda alan tanımlıysa birimi ve alanı (ikisi de firmayı değiştirmez) -->
          <label v-if="workplaces.length" class="place-select">Yeni ekipmanların ait olduğu yer
            <select v-model="newWorkplace" :disabled="saving">
              <option :value="null">Lokasyon geneli</option>
              <option v-for="workplace in workplaces" :key="workplace.id" :value="workplace.id">{{ workplaceLabel(workplace.id, workplace.company_name) }}</option>
            </select>
          </label>
          <label v-if="units.length" class="place-select">Birim
            <select v-model="newUnit" :disabled="saving">
              <option :value="null">Birim yok</option>
              <option v-for="unit in units" :key="unit.id" :value="unit.id">{{ unit.name }}</option>
            </select>
          </label>
          <label v-if="areas.length" class="place-select">Alan
            <select v-model="newArea" :disabled="saving">
              <option :value="null">Alan yok</option>
              <option v-for="area in areas" :key="area.id" :value="area.id">{{ areaText(area) }}</option>
            </select>
          </label>
          <button class="secondary-button" type="button" @click="minimized = true">Küçült</button>
          <button class="primary-button" type="button" :disabled="!selectedRows.length || saving" @click="saveSelected"><PkIcon :class="saving ? 'pi pi-spin pi-spinner' : 'pi pi-check'" /> {{ saving ? 'Kaydediliyor...' : `Seçilenleri kaydet (${selectedRows.length})` }}</button>
        </div>
      </section>
    </div>

    <!-- Küçültülmüş: sayfanın altında ilerleme; tıklayınca pencere açılır -->
    <button v-if="minimized" class="mini" type="button" @click="minimized = false">
      <PkIcon :class="running || saving ? 'pi pi-spin pi-spinner' : 'pi pi-copy'" />
      <span>
        <strong>Toplu analiz · {{ running ? 'okunuyor' : queuedCount ? 'durdu' : 'bitti' }} · {{ doneCount }} / {{ items.length }}</strong>
        <small>{{ saving ? `Kaydediliyor ${saveDone} / ${saveTotal}` : countsText }}</small>
        <ProgressBar :value="readPercent" :show-value="false" class="mini-bar" />
      </span>
      <PkIcon class="pi pi-window-maximize" />
    </button>
  </div>
</template>

<script setup lang="ts">
// Test verisi seçeneği yalnızca süper admine (müşteri hesabına girmiş olsa da).
const { superAdmin: showFixtures } = useAuth()
// Toplu rapor yükleme (tek ekipmanlı raporlar, yangın ekipmanları hariç): seçilen raporlar öz yinelemeli okunur — biri bitince sıradaki kendiliğinden
// gönderilir, aynı anda tek rapor, her rapor tek yapay zeka isteği, otomatik tekrar yok. Okuma "Rapordan Ekipman Tanımla" ile,
// kayıt rapor penceresinin uçlarıyla aynı. Eşleşen ekipman seçili gelir, eşleşmeyende "Yeni ekipman" seçili gelir; kullanıcı
// satırdan değiştirebilir, kayıt yalnızca "Seçilenleri kaydet" ile.
type ItemState = 'checking' | 'queued' | 'reading' | 'read' | 'error' | 'duplicate' | 'saving' | 'saved' | 'save_error'
interface Item {
  key: number
  file: File
  hash: string
  state: ItemState
  message: string
  result: any | null
  // 'new' | 'e<ekipman id>' ('' yalnızca okunmadan önce)
  choice: string
  selected: boolean
  // Seçilen mevcut ekipman için: eşleşme ve teknik özellik farkı (kaydetmez).
  preview: any | null
  seconds: number | null
  duplicateEquipmentId: number | null
  savedEquipmentId: number | null
}

const props = defineProps<{
  context: any
  catalog: { slug: string; name: string; types: { id: number; slug?: string; name: string; default_scope?: string; variants?: string[]; variant_label?: string | null; default_period_months?: number | null }[] }[]
  workplaces: { id: number; company_name: string }[]
  // Sayfadaki ekipman listesi (çalışma alanının): satırdaki "Diğer" seçenekleri.
  equipment: any[]
}>()
const emit = defineEmits<{ close: []; changed: [] }>()

const { post, postForm, errorMessage } = useExpertApi()
const { fixtures, loadFixtures } = useReportFixtures()

// Yangın ekipmanları (tüp, dolap, hidrant, pompa…) toplu yüklenmez: tüpün formu ayrı, diğerlerinin kontrolü tesisat raporundan.
const EXCLUDED_CATEGORY = 'yangin-ekipmanlari'
const RACK_SLUG = 'depolama-rafi'
const STATE_LABELS: Record<ItemState, string> = {
  checking: 'Kontrol ediliyor', queued: 'Sırada', reading: 'Okunuyor', read: 'Okundu', error: 'Okunamadı',
  duplicate: 'Zaten yüklenmiş', saving: 'Kaydediliyor', saved: 'Kaydedildi', save_error: 'Kaydedilemedi'
}
const STATUS_LABELS: Record<string, string> = { uygun: 'Uygun', uygun_degil: 'Uygun değil' }
// Yapay zeka sağlayıcısı kaynaklı hatalarda (sınır, bakiye, yoğunluk) zincir durur; dosyaya özgü hatada sıradakine geçer.
const STOP_WORDS = ['sınırı doldu', 'bakiye', 'kota', 'yoğun ya da yanıt veremiyor', 'krediniz bitti', 'kredi gerekir']

// Pencere açıldığı anki çalışma alanı: okuma ve yeni ekipman buna göre (üstte lokasyon değişse de).
const ctx = { ...props.context }
const contextText = [ctx.location_name, ctx.type === 'workplace' && ctx.company_name].filter(Boolean).join(' · ')
const sameContext = computed(() => props.context?.location_id === ctx.location_id)

const fileInput = ref<HTMLInputElement | null>(null)
const dragOver = ref(false)
const items = ref<Item[]>([])
const minimized = ref(false)
const error = ref('')
const useFixtures = ref(false)
const newWorkplace = ref<number | null>(ctx.type === 'workplace' ? ctx.workplace_id ?? null : null)
// Birim (isteğe bağlı): yalnızca seçilen işyerinin birimleri; işyerinde birim yoksa kutu görünmez.
const { load: loadUnits, unitsOf, setEquipmentUnit } = useOperationalUnits()
const units = computed(() => unitsOf(newWorkplace.value))
const newUnit = ref<number | null>(null)
watch(newWorkplace, () => { if (newUnit.value && !units.value.some(unit => unit.id === newUnit.value)) newUnit.value = null })
// Alan (isteğe bağlı): fiziksel yer, firmadan bağımsız; lokasyonda alan yoksa kutu görünmez.
const { options: areaOptions, load: loadAreas, setEquipmentArea } = useLocationAreas()
const areas = computed(() => areaOptions.value.filter(area => area.active))
const newArea = ref<number | null>(null)
const { load: loadNames, workplaceLabel } = useWorkplaceNames()
let nextKey = 1
// Pencere kapanınca zincir yeni rapor göndermez.
let alive = true

const types = computed(() => props.catalog.flatMap(category => category.types))
const typeOf = (id?: number | null) => types.value.find(type => type.id === id) || null
const catalogFixtures = computed(() => fixtures.value.filter(fixture => fixture.context?.mode === 'catalog'))
const equipmentById = computed(() => new Map(props.equipment.map(item => [item.id, item])))
const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('tr-TR').format(new Date(value)) : '—'

// --- Dosyalar ---
const sha256 = async (file: File) => {
  if (!globalThis.crypto?.subtle) return ''
  try {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
  } catch { return '' }
}
const isPdf = (file: File) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
const onPick = (event: Event) => {
  const input = event.target as HTMLInputElement
  addFiles([...(input.files || [])])
  input.value = ''
}
const onDrop = (event: DragEvent) => {
  dragOver.value = false
  addFiles([...(event.dataTransfer?.files || [])])
}
const addFiles = async (files: File[]) => {
  error.value = ''
  const skipped = files.filter(file => !isPdf(file)).map(file => file.name)
  const added: Item[] = []
  for (const file of files.filter(isPdf)) {
    const item = reactive<Item>({
      key: nextKey++, file: markRaw(file), hash: '', state: 'checking', message: '', result: null, choice: '', selected: true,
      preview: null, seconds: null, duplicateEquipmentId: null, savedEquipmentId: null
    }) as Item
    items.value.push(item)
    added.push(item)
  }
  const twins: string[] = []
  for (const item of added) {
    item.hash = await sha256(item.file)
    if (item.hash && items.value.some(other => other !== item && other.hash === item.hash)) {
      twins.push(item.file.name)
      items.value = items.value.filter(other => other !== item)
    }
  }
  const fresh = added.filter(item => items.value.includes(item))
  // Daha önce yüklenmiş dosya yapay zekaya gönderilmez (okuma hakkı harcanmaz).
  const hashes = fresh.map(item => item.hash).filter(Boolean)
  let found: Record<string, any> = {}
  if (hashes.length) {
    try { found = await post('/pk-bulk-analysis/duplicates', { hashes }) || {} } catch { found = {} }
  }
  // Son 24 saatte okunmuş ama kaydedilmemiş dosya (pencere kapandı, sayfa yenilendi): önceki okuma geri gelir, yeniden okunmaz.
  const unread = fresh.filter(item => item.hash && !found[item.hash]).map(item => item.hash)
  let reused: Record<string, any> = {}
  if (unread.length) {
    try { reused = await post('/pk-bulk-analysis/reuse', { hashes: unread, location_id: ctx.location_id }) || {} } catch { reused = {} }
  }
  for (const item of fresh) {
    const duplicate = item.hash ? found[item.hash] : null
    item.state = duplicate ? 'duplicate' : 'queued'
    item.message = duplicate?.message || ''
    item.duplicateEquipmentId = duplicate?.equipment_id ?? null
    item.selected = false
    if (!duplicate && item.hash && reused[item.hash]) applyResult(item, reused[item.hash])
  }
  error.value = [
    skipped.length && `PDF olmadığı için eklenmedi: ${skipped.join(', ')}`,
    twins.length && `Aynı dosya listede zaten var: ${twins.join(', ')}`
  ].filter(Boolean).join(' · ')
}
const removable = (item: Item) => !['checking', 'reading', 'saving', 'saved'].includes(item.state)
const remove = (item: Item) => { items.value = items.value.filter(other => other !== item) }

// --- Okuma: öz yinelemeli, aynı anda tek rapor ---
const running = ref(false)
const stopRequested = ref(false)
const stopMessage = ref('')
const startedOnce = ref(false)

const fixtureFor = (name: string) => catalogFixtures.value.find(fixture => fixture.original_file_name === name) || null

// Okunmuş rapor satıra: seri no (ya da raf için no + konum) ile eşleşen mevcut ekipman seçili gelir; eşleşmeyende "Yeni ekipman".
const applyResult = (item: Item, data: any) => {
  item.result = data
  item.state = 'read'
  item.message = ''
  const strong = (data.candidates || []).find((candidate: any) => candidate.strong)
  item.choice = blockReason(item) ? '' : strong ? `e${strong.id}` : 'new'
  item.selected = true
  if (item.choice) loadPreview(item)
}

// Tek raporu okur; zinciri durdurması gereken bir hata olursa mesajını döner.
const readItem = async (item: Item): Promise<string> => {
  item.state = 'reading'
  item.message = ''
  item.result = null
  item.preview = null
  item.choice = ''
  const fixture = useFixtures.value ? fixtureFor(item.file.name) : null
  if (useFixtures.value && !fixture) {
    item.state = 'error'
    item.message = 'Bu dosya için test verisi yok; test verisini kapatıp yapay zeka ile okuyun.'
    return ''
  }
  const body = new FormData()
  if (fixture) body.append('fixture_id', fixture.fixture_id)
  else body.append('report', item.file)
  if (ctx.location_id) body.append('location_id', String(ctx.location_id))
  const startedAt = Date.now()
  try {
    const data = await postForm('/pk-equipment/report-analysis', body)
    item.seconds = fixture ? null : (Date.now() - startedAt) / 1000
    applyResult(item, data)
    return ''
  } catch (e: any) {
    item.state = 'error'
    item.message = errorMessage(e, 'Rapor okunamadı.')
    const status = e?.status ?? e?.statusCode ?? e?.response?.status
    const lower = item.message.toLocaleLowerCase('tr-TR')
    if (!status || status >= 500 || [401, 402, 403, 419, 429].includes(status) || STOP_WORDS.some(word => lower.includes(word))) {
      return `Okuma durdu: ${item.message} Sıradaki raporlar bekliyor; uygun olduğunda "Devam et" ile sürdürün.`
    }
    return ''
  }
}

// Sıradaki raporu okur, yanıt gelince kendini tekrar çağırır; sıra bitince, "Durdur"da ya da sağlayıcı hatasında durur.
const readNext = async (): Promise<void> => {
  const item = items.value.find(entry => entry.state === 'queued')
  if (!item || stopRequested.value || !alive) {
    running.value = false
    stopRequested.value = false
    return
  }
  const stop = await readItem(item)
  if (stop) {
    stopMessage.value = stop
    running.value = false
    stopRequested.value = false
    return
  }
  return readNext()
}
const start = () => {
  if (running.value) return
  running.value = true
  stopRequested.value = false
  stopMessage.value = ''
  startedOnce.value = true
  readNext()
}
// "Tekrar oku": yalnızca o rapor (tek istek); okuma sürüyorsa sıraya girer.
const retry = async (item: Item) => {
  item.state = 'queued'
  item.message = ''
  if (running.value) return
  running.value = true
  stopMessage.value = ''
  const stop = await readItem(item)
  running.value = false
  stopRequested.value = false
  if (stop) stopMessage.value = stop
}

const count = (state: ItemState) => items.value.filter(item => item.state === state).length
const queuedCount = computed(() => count('queued'))
const doneCount = computed(() => items.value.filter(item => !['checking', 'queued', 'reading'].includes(item.state)).length)
const readPercent = computed(() => items.value.length ? Math.round(doneCount.value / items.value.length * 100) : 0)
const progressTitle = computed(() => {
  if (running.value) return `Okunuyor: ${doneCount.value} / ${items.value.length}`
  if (queuedCount.value && !startedOnce.value) return `${queuedCount.value} rapor okunmayı bekliyor`
  if (queuedCount.value) return `Durdu: ${doneCount.value} / ${items.value.length} okundu`
  return `Okuma bitti: ${items.value.length} rapor`
})
const countsText = computed(() => [
  count('read') + count('saving') + count('save_error') && `${count('read') + count('saving') + count('save_error')} okundu`,
  count('saved') && `${count('saved')} kaydedildi`,
  count('error') && `${count('error')} okunamadı`,
  count('duplicate') && `${count('duplicate')} zaten yüklenmiş`,
  queuedCount.value && `${queuedCount.value} sırada`
].filter(Boolean).join(' · '))
// Tahmini kalan süre: bu pencerede yapay zekayla okunan raporların ortalaması.
const etaText = computed(() => {
  const times = items.value.map(item => item.seconds).filter((value): value is number => !!value)
  const left = queuedCount.value + count('reading')
  if (!running.value || !times.length || !left) return ''
  const minutes = Math.max(1, Math.round(times.reduce((sum, value) => sum + value, 0) / times.length * left / 60))
  return `tahmini ~${minutes} dk`
})

// --- Satırlar ---
const blockReason = (item: Item) => {
  const data = item.result
  if (!data) return ''
  if (data.bulk) return 'Tüp kontrol formu; Kontrol Formları\'ndan yükleyin.'
  if (data.duplicate) return data.duplicate.message
  if (!data.detected_type) return 'Ekipman türü bulunamadı; tek tek "P.K. Raporu Yükle" ile yükleyin.'
  const category = props.catalog.find(entry => entry.types.some(type => type.id === data.detected_type.id))
  if (!category) return `Bu rapor ${data.detected_type.name} raporu; tek tek "P.K. Raporu Yükle" ile yükleyin.`
  if (category.slug === EXCLUDED_CATEGORY) return `Bu rapor ${data.detected_type.name} raporu; yangın ekipmanları toplu yüklenmez.`
  return ''
}
const missingReason = (item: Item) => !STATUS_LABELS[item.result?.status] || !item.result?.control_date ? 'Sonuç ya da kontrol tarihi okunamadı; bu raporu tek tek "P.K. Raporu Yükle" ile yükleyin.' : ''
const canSave = (item: Item) => ['read', 'save_error'].includes(item.state) && !blockReason(item) && !!item.choice && !missingReason(item)
const savable = computed(() => items.value.filter(canSave))
const selectedRows = computed(() => savable.value.filter(item => item.selected))
const allSelected = computed(() => !!savable.value.length && savable.value.every(item => item.selected))
const toggleAll = () => {
  const value = !allSelected.value
  savable.value.forEach(item => { item.selected = value })
}

const equipmentIdOf = (item: Item) => item.choice.startsWith('e') ? Number(item.choice.slice(1)) : null
const linkId = (item: Item) => item.savedEquipmentId || item.duplicateEquipmentId || item.result?.duplicate?.equipment_id || null
const rowNote = (item: Item) => {
  if (['error', 'duplicate', 'save_error'].includes(item.state)) return item.message
  if (item.state === 'saved') return ''
  return blockReason(item) || (item.result && missingReason(item)) || ''
}
const rowNoteKind = (item: Item) => ['error', 'duplicate', 'save_error'].includes(item.state) || blockReason(item) ? 'danger' : 'warn'
const rowClass = (item: Item) => ({
  blocked: item.state === 'duplicate' || item.state === 'error' || !!blockReason(item),
  pending: item.state === 'read' && !blockReason(item) && !!missingReason(item),
  saved: item.state === 'saved'
})

// Raporda okunan kimlik: no, konum (raf), seri no (transpalet), etiket.
const reportIdentity = (item: Item) => {
  const fields = item.result?.fields || {}
  return [fields.code && `no ${fields.code}`, fields.place, fields.serial_no && `SN ${fields.serial_no}`, fields.variant].filter(Boolean).join(' · ') || '—'
}
const equipmentText = (equipment: any) => [
  equipment.code ? `no ${equipment.code}` : 'no yok', equipment.place, equipment.serial_no && `SN ${equipment.serial_no}`,
  equipment.workplace && workplaceLabel(equipment.workplace.id, equipment.workplace.company_name)
].filter(Boolean).join(' · ')
const candidateText = (candidate: any) => [
  candidate.code ? `no ${candidate.code}` : 'no yok', equipmentById.value.get(candidate.id)?.place, candidate.serial_no && `SN ${candidate.serial_no}`, candidate.workplace || candidate.location
].filter(Boolean).join(' · ') + (candidate.strong ? '' : ' (öneri)')
// Diğer: aynı türdeki aktif, tesisata bağlı olmayan ekipmanlar (önerilenler hariç), no'ya göre.
const othersFor = (item: Item) => {
  if (!sameContext.value) return []
  const typeId = item.result?.detected_type?.id
  const suggested = new Set((item.result?.candidates || []).map((candidate: any) => candidate.id))
  return props.equipment
    .filter(equipment => equipment.type?.id === typeId && equipment.is_active !== false && !equipment.installation && !suggested.has(equipment.id))
    .sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''), 'tr', { numeric: true }) || String(a.place || '').localeCompare(String(b.place || ''), 'tr'))
}

// Aynı ekipmanın birden çok raporu yeni ekipman olarak seçildiyse tek ekipman açılır (seri no; raf: no + konum; yoksa no).
const compact = (value?: string | null) => [...String(value || '').toLocaleLowerCase('tr-TR')]
  .filter(char => (char >= '0' && char <= '9') || char.toLocaleLowerCase('tr-TR') !== char.toLocaleUpperCase('tr-TR')).join('')
const newKey = (item: Item) => {
  const fields = item.result?.fields || {}
  const type = item.result?.detected_type
  if (!type) return ''
  if (compact(fields.serial_no)) return `${type.id}|sn|${compact(fields.serial_no)}`
  if (type.slug === RACK_SLUG) return compact(fields.code) && compact(fields.place) ? `${type.id}|${compact(fields.code)}|${compact(fields.place)}` : ''
  return compact(fields.code) ? `${type.id}|${compact(fields.code)}` : ''
}
const createdByKey = new Map<string, number>()
const sameNewCount = (item: Item) => {
  const key = newKey(item)
  return key ? items.value.filter(other => other !== item && other.choice === 'new' && other.state !== 'saved' && newKey(other) === key).length : 0
}

// Seçilen mevcut ekipman: rapor bu ekipmanla eşleşiyor mu, teknik özelliklerde fark var mı (analiz ekipmana bağlanmaz).
const loadPreview = async (item: Item) => {
  const equipmentId = equipmentIdOf(item)
  if (!equipmentId || !item.result?.analysis_id) return
  const wanted = item.choice
  try {
    const data = await post(`/pk-bulk-analysis/${item.result.analysis_id}/preview`, { equipment_id: equipmentId })
    if (item.choice === wanted) item.preview = data
  } catch (e: any) {
    if (item.choice === wanted) item.preview = { error: errorMessage(e, 'Ekipmanla karşılaştırılamadı.') }
  }
}
const onChoice = (item: Item) => {
  item.preview = null
  item.selected = true
  if (item.state === 'save_error') item.message = ''
  loadPreview(item)
}
const choiceNote = (item: Item) => {
  if (item.choice === 'new') {
    if (createdByKey.has(newKey(item))) return 'Bu ekipman bu pencerede açıldı; rapor ona eklenir.'
    const same = sameNewCount(item)
    const matched = (item.result?.candidates || []).some((candidate: any) => candidate.strong)
    return [!matched && 'Mevcut ekipmanla eşleşmedi; yeni ekipman açılır', same && `aynı ekipmanın ${same + 1} raporu var, tek ekipman açılır`].filter(Boolean).join(' · ')
  }
  const preview = item.preview
  if (!preview) return ''
  if (preview.error) return preview.error
  const match = preview.match?.status
  const properties = preview.properties || {}
  return [
    match === 'mismatch' && 'Rapor bu ekipmana ait görünmüyor',
    match === 'close' && 'Bilgilerde yazım farkı var',
    properties.changes?.length && `${properties.changes.length} özellik farklı`,
    properties.new?.length && `${properties.new.length} yeni özellik`,
    (properties.changes?.length || properties.new?.length) && 'toplu kayıtta uygulanmaz'
  ].filter(Boolean).join(' · ')
}
const choiceWarn = (item: Item) => !!item.preview?.error || ['mismatch', 'close'].includes(item.preview?.match?.status)

// --- Kayıt: seçilenler sırayla, rapor penceresinin uçlarıyla ---
const saving = ref(false)
const saveDone = ref(0)
const saveTotal = ref(0)
const saveFailed = ref(0)
const savePercent = computed(() => saveTotal.value ? Math.round(saveDone.value / saveTotal.value * 100) : 0)

const draftOf = (item: Item) => {
  const fields = item.result?.fields || {}
  const type = typeOf(item.result?.detected_type?.id)
  const clean = (value: any) => String(value ?? '').trim() || null
  return {
    location_id: ctx.location_id,
    // Türün kapsamına göre: lokasyon geneli türde firma yok, diğerlerinde seçilen firma.
    location_business_entity_id: type?.default_scope === 'location' ? null : newWorkplace.value,
    equipment_type_id: type?.id ?? item.result?.detected_type?.id,
    variant: fields.variant && type?.variants?.includes(fields.variant) ? fields.variant : null,
    name: null,
    code: clean(fields.code), brand: clean(fields.brand), model: clean(fields.model), serial_no: clean(fields.serial_no), place: clean(fields.place)
  }
}
// Rapor penceresinde "Kaydet" ile aynı alanlar. Teknik özellikler: mevcut ekipmanda hiçbiri uygulanmaz (değişen: mevcut kalsın,
// yeni ve silinmişken gelen: eklenmez); yeni ekipmanda pencerenin varsayılanı (rapordaki özellikler eklenir).
const inspectionBody = (item: Item, analysis: any, isNew: boolean) => {
  const body = new FormData()
  body.append('report', item.file)
  body.append('status', analysis.status || item.result.status)
  body.append('control_date', analysis.control_date || item.result.control_date)
  const next = analysis.next_control_date || item.result.next_control_date
  if (next) body.append('next_control_date', next)
  const text = (value: any) => String(value ?? '').trim()
  if (text(analysis.report_no)) body.append('report_no', text(analysis.report_no))
  if (text(analysis.inspection_body?.name)) body.append('inspection_body', text(analysis.inspection_body.name))
  if (text(analysis.overall_text)) body.append('conclusion', text(analysis.overall_text))
  ;(analysis.findings || []).map(text).filter(Boolean).forEach((finding: string) => body.append('findings[]', finding))
  body.append('source', 'ai')
  body.append('analysis_id', analysis.analysis_id || item.result.analysis_id)
  // Ekipmanı kullanıcı satırda kendisi seçti: eşleşme uyarısı onaylanmış sayılır.
  if (['mismatch', 'close'].includes(analysis.match?.status)) body.append('mismatch_confirmed', '1')
  const properties = analysis.properties || {}
  ;(properties.changes || []).forEach((entry: any) => body.append(`property_decisions[${entry.key}]`, 'keep'))
  ;(properties.new || []).forEach((entry: any) => body.append(`property_decisions[${entry.key}]`, isNew ? entry.default : 'skip'))
  ;(properties.restore || []).forEach((entry: any) => body.append(`property_decisions[${entry.key}]`, 'skip'))
  return body
}

const saveItem = async (item: Item) => {
  item.state = 'saving'
  item.message = ''
  const analysisId = item.result.analysis_id
  const key = item.choice === 'new' ? newKey(item) : ''
  const equipmentId = equipmentIdOf(item) || (key ? createdByKey.get(key) : null) || null
  try {
    let saved: any
    if (equipmentId) {
      const analysis = await post(`/pk-equipment/${equipmentId}/report-analysis/${analysisId}`, {})
      if (analysis.duplicate) throw { own: analysis.duplicate.message }
      saved = await postForm(`/pk-equipment/${equipmentId}/inspections`, inspectionBody(item, analysis, false))
    } else {
      const draft = draftOf(item)
      const analysis = await post(`/pk-equipment/report-analysis/${analysisId}/draft`, draft)
      if (analysis.duplicate) throw { own: analysis.duplicate.message }
      const body = inspectionBody(item, analysis, true)
      Object.entries(draft).forEach(([field, value]) => { if (value !== null && value !== undefined && value !== '') body.append(field, String(value)) })
      saved = await postForm('/pk-equipment/from-report', body)
      // Birim (yalnızca ekipman o işyerine aitse) ve alan seçildiyse yeni ekipmana yazılır (ekipman raporla birlikte oluştu).
      if (newUnit.value && saved?.id && draft.location_business_entity_id === newWorkplace.value) await setEquipmentUnit(saved.id, newUnit.value)
      if (newArea.value && saved?.id) await setEquipmentArea(saved.id, newArea.value)
      if (key && saved?.id) createdByKey.set(key, saved.id)
    }
    item.state = 'saved'
    item.savedEquipmentId = saved?.id ?? equipmentId
    item.selected = false
    return true
  } catch (e: any) {
    item.state = 'save_error'
    item.message = e?.own || errorMessage(e, 'Kaydedilemedi.')
    return false
  }
}
const saveSelected = async () => {
  if (saving.value) return
  // Eski rapor önce: aynı ekipmanın raporları kontrol tarihi sırasıyla eklenir.
  const rows = [...selectedRows.value].sort((a, b) => String(a.result?.control_date || '').localeCompare(String(b.result?.control_date || '')))
  if (!rows.length) return
  saving.value = true
  saveDone.value = 0
  saveFailed.value = 0
  saveTotal.value = rows.length
  error.value = ''
  let savedAny = false
  for (const item of rows) {
    if (!alive) break
    if (await saveItem(item)) savedAny = true
    else saveFailed.value++
    saveDone.value++
  }
  saving.value = false
  if (savedAny) emit('changed')
}

// --- Çıkış: okuma ya da kayıt sürüyorsa, ya da okunmuş ama kaydedilmemiş rapor varsa sorulur ---
const unsaved = computed(() => items.value.some(item => ['read', 'save_error'].includes(item.state) && !blockReason(item)))
const busy = computed(() => running.value || saving.value || unsaved.value)
const LEAVE_TEXT = 'Toplu analiz sürüyor ya da okunmuş ama kaydedilmemiş raporlar var. Çıkarsanız okuma durur ve kaydedilmemiş okumalar kaybolur. Devam edilsin mi?'
const close = () => {
  if (busy.value && !confirm(LEAVE_TEXT)) return
  alive = false
  emit('close')
}
onBeforeRouteLeave(() => {
  if (busy.value && !confirm(LEAVE_TEXT)) return false
  alive = false
  return true
})
const onBeforeUnload = (event: BeforeUnloadEvent) => {
  if (!busy.value) return
  event.preventDefault()
  event.returnValue = ''
}
onMounted(() => {
  window.addEventListener('beforeunload', onBeforeUnload)
  loadFixtures()
  loadAreas(ctx.location_id)
  loadUnits(ctx.location_id)
  loadNames()
})
onBeforeUnmount(() => {
  alive = false
  window.removeEventListener('beforeunload', onBeforeUnload)
})
</script>

<style scoped src="~/assets/css/rapor-yukleme.css"></style>
<style scoped>
.head-buttons{display:flex;gap:6px}
/* Dosyalar: katalogdaki kesik çizgili "rapor ekle" kutusu (sürükle bırak) */
.file-box{width:100%;display:flex;align-items:center;gap:16px;padding:16px 20px;border:1px dashed rgba(145,158,171,.32);border-radius:var(--pk-radius);background:var(--admin-card);color:var(--admin-muted);font:inherit;text-align:left;cursor:pointer}
.file-box:hover,.file-box.over{border-color:var(--pk-accent);background:var(--admin-accent-soft)}
.file-box > i{flex:none;width:46px;height:46px;display:grid;place-items:center;border-radius:12px;background:var(--pk-primary-lighter);color:var(--pk-primary-dark);font-size:22px}
:global(.dark-theme) .file-box > i{background:var(--admin-accent-soft);color:var(--admin-accent-text)}
.file-box span{display:flex;flex-direction:column;gap:4px;min-width:0}.file-box strong{color:var(--admin-heading);font-size:16px}.file-box small{color:var(--admin-muted);font-size:12px;line-height:1.45}
.fixture-line{display:flex;align-items:center;gap:8px;margin-top:10px;padding:8px 12px;border:1px dashed rgba(145,158,171,.32);border-radius:8px;color:var(--admin-muted);font-size:12px;cursor:pointer}
.fixture-line span{display:inline-flex;align-items:center;gap:6px;font-weight:700}.fixture-line small{font-weight:400}
.progress-box{margin-top:24px}
.progress-line{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
.progress-title{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;min-width:0}.progress-title i{color:var(--admin-link)}
.progress-title strong{color:var(--admin-heading);font-size:17px;font-weight:700}.progress-title small{color:var(--admin-muted);font-size:13px}
.progress-line .secondary-button{min-height:42px;font-size:14px}
.save-line{margin:14px 0 8px}
.bar{height:8px}.bar.save :deep(.p-progressbar-value){background:var(--admin-success-text)}
.list-card{margin-top:24px}
.list-card .card-head{margin-bottom:12px}
.check-line{display:flex;align-items:center;gap:8px;margin-left:auto;color:var(--admin-heading);font-size:13px;font-weight:700;cursor:pointer}.check-line small{color:var(--admin-muted);font-weight:400}
.table-wrap{max-height:460px;overflow:auto;border-radius:8px}
table{width:100%;border-collapse:collapse}th,td{padding:10px 12px;text-align:left;border-bottom:1px solid rgba(145,158,171,.2);color:var(--admin-text);font-size:12px;vertical-align:top}
th{position:sticky;top:0;z-index:1;background:var(--admin-card);box-shadow:inset 0 0 0 999px rgba(145,158,171,.08);border-bottom:0;color:var(--admin-muted);font-size:13px;font-weight:600;white-space:nowrap}
tr.pending td{background:var(--admin-warning-bg)}
tr.blocked td{background:var(--admin-danger-bg)}
tr.saved td{opacity:.65}
.file-cell{max-width:260px}.file-cell strong{display:block;overflow:hidden;color:var(--admin-heading);text-overflow:ellipsis;white-space:nowrap}
.state{display:inline-flex;align-items:center;gap:5px;margin-top:3px;padding:2px 8px;border-radius:6px;background:var(--admin-chip);color:var(--admin-muted);font-size:12px;font-weight:700}
.state i{font-size:10px}.state.reading,.state.saving{background:var(--admin-accent-soft);color:var(--admin-link)}.state.read{color:var(--admin-heading)}
.state.saved{background:var(--admin-success-bg);color:var(--admin-success-text)}
.state.error,.state.save_error,.state.duplicate{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.note{display:block;margin-top:4px;font-size:11px;line-height:1.4}.note.danger{color:var(--admin-danger-text)}.note.warn{color:var(--admin-warning-text)}
.note a{margin-left:4px;color:inherit;font-weight:700;text-decoration:underline}
/* Sonuç: katalogdaki "Uygun değil" hapı */
.status{display:inline-block;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700;white-space:nowrap}
.status.uygun{background:var(--admin-success-bg);color:var(--admin-success-text)}.status.uygun_degil{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.muted-cell{color:var(--admin-muted)}.nowrap{white-space:nowrap}
.cell-input{width:100%;min-width:200px;max-width:300px;height:32px;padding:0 8px;border:1px solid rgba(145,158,171,.32);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:12px;outline:0}
.choice-note{display:block;max-width:300px;margin-top:4px;color:var(--admin-muted);font-size:11px;line-height:1.4}.choice-note.warn{color:var(--admin-danger-text)}
.actions{white-space:nowrap}
.icon-button{width:30px;height:30px}.icon-button:hover{color:var(--admin-heading)}.icon-button:disabled{opacity:.5;cursor:not-allowed}
.modal-actions{margin-top:24px}
.place-select{display:flex;align-items:center;gap:8px;margin-right:auto;color:var(--admin-heading);font-size:13px;font-weight:700}
.place-select + .place-select{margin-left:-8px}
.place-select select{height:40px;padding:0 10px;border:1px solid rgba(145,158,171,.32);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:13px}
.mini{position:fixed;right:20px;bottom:20px;z-index:90;display:flex;align-items:center;gap:12px;width:min(340px,calc(100vw - 32px));padding:12px 14px;border:0;border-radius:12px;background:var(--admin-card);box-shadow:0 24px 48px -8px var(--admin-shadow);color:var(--admin-muted);font:inherit;text-align:left;cursor:pointer}
.mini > i{color:var(--admin-link);font-size:18px}.mini span{display:flex;flex:1;flex-direction:column;gap:4px;min-width:0}
.mini strong{color:var(--admin-heading);font-size:13px}.mini small{overflow:hidden;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.mini-bar{height:6px}
@media(max-width:640px){.mini{right:16px;bottom:16px}}
</style>
