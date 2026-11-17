<template>
  <div class="test-page">
    <div class="head-row">
      <div class="page-head">
        <!-- Ana Sayfa yalnız bireysel uzmanda var; diğer hesaplarda sayfa yolu Genel Bakış'ta başlar -->
        <nav class="crumb" aria-label="Sayfa yolu">
          <PkIcon class="pi pi-home" aria-hidden="true" />
          <NuxtLink :to="individual ? '/expert/anasayfa' : '/expert'">{{ individual ? 'Ana Sayfa' : 'Genel Bakış' }}</NuxtLink>
          <PkIcon class="pi pi-angle-right" aria-hidden="true" />
          <strong>Rapor algılama testi</strong>
        </nav>
        <h1>Rapor algılama testi</h1>
        <p>Raporu yükleyin, çıkarılan alanları doğrulayın</p>
      </div>
      <span v-if="running" class="hero-pill run"><PkIcon class="pi pi-spin pi-spinner" /> Analiz ediliyor · {{ elapsed }} sn</span>
      <span v-else-if="selected" class="hero-pill ok"><PkIcon class="pi pi-check" /> Analiz tamamlandı</span>
    </div>

    <!-- Adımlar: rapor seçilmediyse 1, seçildi / analiz sürüyorsa 2, sonuç açıksa 3 -->
    <ol class="stepper" aria-label="Adımlar">
      <li v-for="(label, index) in ['Rapor seç', 'Analiz et', 'Sonucu incele']" :key="label" :class="{ active: step === index + 1, done: step > index + 1 }" :aria-current="step === index + 1 ? 'step' : undefined"><span>{{ index + 1 }}</span>{{ label }}</li>
    </ol>

    <div class="work">
      <section class="card source">
        <h2><PkIcon class="pi pi-file" /> Kaynak rapor</h2>
        <div class="file-box">
          <span class="pdf-icon">PDF</span>
          <span class="file-meta">
            <strong>{{ sourceName || 'PDF seçilmedi' }}</strong>
            <small>{{ file ? `${formatSize(file.size)} • PDF` : legacyId ? 'Eski test PDF\'i' : selected ? `${selected.page_count || '—'} sayfa • PDF` : 'Bilgisayarınızdan bir PDF seçin' }}</small>
          </span>
          <button class="outline-button" type="button" :disabled="running" @click="fileInput?.click()"><PkIcon class="pi pi-refresh" /> {{ sourceName ? 'Dosya değiştir' : 'Dosya seç' }}</button>
          <input ref="fileInput" type="file" accept="application/pdf" hidden :disabled="running" @change="onFileChange" />
        </div>
        <label class="row-field">
          <span>Rapor türü</span>
          <select v-model="kind" :disabled="running">
            <option value="equipment">Ekipman raporu — tür, etiket ve teknik özellikler katalogla</option>
            <option value="short">Tek ekipman raporu — kısa talimat (deneme, yerel model için; tür seçilir)</option>
            <option value="installation">Tesisat raporu</option>
            <option value="electrical">Elektrik iç tesisatı raporu — elektriğin kendi talimatıyla</option>
            <option value="grounding">Topraklama tesisatı raporu — topraklamanın kendi talimatıyla</option>
            <option value="detection">Yangın algılama raporu — algılamanın kendi talimatıyla</option>
            <option value="ventilation">Havalandırma ve klima raporu — havalandırmanın kendi talimatıyla</option>
            <option value="lightning">Paratoner (yıldırımdan korunma) raporu — paratonerin kendi talimatıyla</option>
            <option value="battery">Akümülatör / UPS raporu — akümülatörün kendi talimatıyla</option>
            <option value="transformer">Trafo merkezi raporu — trafonun kendi talimatıyla</option>
          </select>
        </label>
        <label v-if="kind === 'short'" class="row-field">
          <span>Ekipman türü</span>
          <select v-model="shortType" :disabled="running">
            <option value="">Seçiniz</option>
            <optgroup v-for="category in equipmentCategories" :key="category.name" :label="category.name">
              <option v-for="type in category.types" :key="type.slug" :value="type.slug">{{ type.name }}</option>
            </optgroup>
          </select>
        </label>
        <!-- Seçilen PDF'in önizlemesi (tarayıcıda, sunucuya gitmez) -->
        <iframe v-if="previewUrl" :src="previewUrl" class="preview" title="Rapor önizleme" />
        <div class="source-foot">
          <label class="sample" title="Eski test PDF'lerinden seç">
            <span>Örnek rapor <PkIcon class="pi pi-info-circle" /></span>
            <select v-model="legacyId" :disabled="running || !!file" @change="file = null">
              <option value="">Seçiniz</option>
              <option v-for="item in legacyFixtures" :key="item.fixture_id" :value="item.fixture_id">{{ item.original_file_name }}{{ item.report_category ? ` (${item.report_category})` : '' }}</option>
            </select>
          </label>
          <button class="primary-button" type="button" :disabled="running || (!file && !legacyId) || (kind === 'short' && !shortType)" @click="runAnalysis">
            <PkIcon :class="running ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'" />
            {{ running ? `Analiz ediliyor... ${elapsed} sn` : 'Analiz et' }}
          </button>
        </div>
        <p v-if="running" class="hint">Yapay zeka çağrısı 1-3 dakika sürebilir. Sayfadan ayrılmayın.</p>
        <p v-if="runError" class="error-text">{{ runError }}</p>
      </section>

      <!-- Algılanan alanlar: açık analizin özeti; tamamı aşağıdaki ayrıntıda -->
      <section class="card detected">
        <header class="detected-head">
          <h2><PkIcon class="pi pi-bullseye" /> Algılanan alanlar</h2>
          <span v-if="selected" class="done-chip"><PkIcon class="pi pi-check-circle" /> Tamamlandı</span>
        </header>
        <div v-if="!selected" class="empty">Rapor seçip analiz edin ya da aşağıdan kayıtlı bir analizi açın; algılanan alanlar burada görünür.</div>
        <template v-else>
          <div class="tiles">
            <div v-for="tile in tiles" :key="tile.label" class="tile">
              <PkIcon :class="tile.icon" />
              <span><small>{{ tile.label }}</small><strong v-if="!tile.status" :title="tile.value">{{ tile.value }}</strong><span v-else class="status-badge" :class="statusKey(tile.status)">{{ statusLabel(tile.status) }}</span></span>
            </div>
          </div>
          <h3><PkIcon class="pi pi-list" /> Bulgular</h3>
          <div v-if="!detectedFindings.length" class="empty">Bulgu yok.</div>
          <ul v-else class="finding-list">
            <li v-for="(finding, index) in detectedFindings.slice(0, FINDING_LIMIT)" :key="finding.id || index"><PkIcon class="pi pi-exclamation-triangle" /> {{ finding.description }}</li>
          </ul>
          <p v-if="detectedFindings.length > FINDING_LIMIT" class="muted">+{{ detectedFindings.length - FINDING_LIMIT }} bulgu daha; tamamı aşağıdaki ayrıntıda.</p>
        </template>
      </section>
    </div>

    <div class="list-grid">
      <section class="card">
        <div class="card-head">
          <h2>Kayıtlı analizler</h2>
          <button class="icon-button" type="button" title="Yenile" @click="loadList"><PkIcon class="pi pi-refresh" /></button>
        </div>
        <div v-if="listLoading" class="empty">Yükleniyor...</div>
        <div v-else-if="listError" class="empty error-text">{{ listError }}</div>
        <div v-else-if="fixtures.length === 0" class="empty">Henüz analiz yok.</div>
        <div v-else class="table-wrap">
          <table>
            <thead><tr><th>Dosya</th><th>Tip</th><th>Genel</th><th>Sistem</th><th>Ekipman</th><th>Bulgu</th><th>Süre</th><th>Tarih</th></tr></thead>
            <tbody>
              <tr v-for="item in fixtures" :key="item.fixture_id" :class="{ selected: selected?.fixture_id === item.fixture_id }" @click="openFixture(item.fixture_id)">
                <td class="file-cell" :title="item.original_file_name">{{ item.original_file_name }}<small class="origin">{{ [fixtureOrigin(item), item.input === 'image' && 'görüntüden okundu', item.input === 'ocr' && 'OCR ile okundu', item.model].filter(Boolean).join(' · ') }}</small></td>
                <td>{{ item.context?.mode === 'electrical' ? ({ topraklama: 'topraklama', 'yangin-algilama': 'yangin_algilama', 'havalandirma-klima': 'havalandirma_klima', paratoner: 'paratoner', akumulator: 'akumulator', trafo: 'trafo' } as Record<string, string>)[item.context?.type] || 'elektrik_ic_tesisati' : item.report_category || '—' }}</td>
                <td><span class="status-badge" :class="statusKey(item.overall_status)">{{ statusLabel(item.overall_status) }}</span></td>
                <td>{{ item.system_count }}</td>
                <td class="equipment-cell">
                  <template v-if="item.equipment_summary?.length">
                    <span v-for="group in item.equipment_summary" :key="group.system_name + group.equipment_name" class="summary-line" :class="summaryKey(group)">{{ summaryText(group) }}</span>
                  </template>
                  <span v-else class="muted">{{ item.equipment_summary ? 'Tablo yok' : '—' }}</span>
                </td>
                <td>{{ item.finding_count }}</td>
                <td>{{ item.duration_s ? `${item.duration_s} sn` : '—' }}</td>
                <td>{{ formatDate(item.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <div v-if="detailLoading" class="card empty">Analiz yükleniyor...</div>

    <ExpertReportAnalysisView v-else-if="selected" :analysis="selected" test-mode>
      <template #head>
        <div class="card-head">
          <h2>{{ selected.original_file_name }}</h2>
          <div class="head-actions">
            <span class="muted">{{ selected.model || 'Yapay zeka' }} {{ selected.duration_s }} sn<template v-if="selected.tables"> · Tablo {{ selected.tables.duration_s }} sn</template> · {{ selected.page_count }} sayfa</span>
            <button v-if="selected.input !== 'image'" class="secondary-button" type="button" :disabled="rereading" @click="rereadTables"><PkIcon :class="rereading ? 'pi pi-spin pi-spinner' : 'pi pi-table'" /> {{ rereading ? 'Okunuyor...' : 'Tabloları yeniden oku' }}</button>
          </div>
        </div>
      </template>
    </ExpertReportAnalysisView>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'expert-settings', middleware: ['expert', 'expert-super-admin'] })

interface EquipmentGroup { system_name: string; equipment_name: string; total: number; uygun: number; uygun_degil: number; unknown: number }
interface FixtureSummary { fixture_id: string; original_file_name: string; report_category?: string | null; overall_status?: string | null; system_count?: number; finding_count?: number; equipment_summary?: EquipmentGroup[] | null; duration_s?: number | null; created_at?: string; context?: { mode?: string } | null; provider?: string | null; model?: string | null; input?: string }

const { get, post, postForm, errorMessage } = useExpertApi()
const { multiUser, account, load: loadAccount } = useAccount()
const individual = computed(() => !!account.value && !multiUser.value)

const fixtures = ref<FixtureSummary[]>([])
const legacyFixtures = ref<FixtureSummary[]>([])
const listLoading = ref(true)
const listError = ref('')
const selected = ref<any>(null)
const detailLoading = ref(false)

const fileInput = ref<HTMLInputElement | null>(null)
const file = ref<File | null>(null)
const legacyId = ref('')
// Ekipman raporu: yapay zekaya tüm katalog verilir (tür, etiket, teknik özellikler); rapor pencerelerinde test verisi olarak kullanılır.
// Elektrik iç tesisatı / topraklama tesisatı / yangın algılama raporu: tesisatın kendi talimatıyla okunur; o tesisatın Kontrol Ekle
// penceresinde kullanılır.
const kind = ref<'equipment' | 'short' | 'installation' | 'electrical' | 'grounding' | 'detection' | 'ventilation' | 'lightning' | 'battery' | 'transformer'>('equipment')
// Kısa talimat denemesi: tür önceden seçilir (yalnız o türün kataloğu gider), metin pdfium ile alınır.
const shortType = ref('')
const catalog = ref<{ kind: string; name: string; types: { slug?: string; name: string }[] }[]>([])
// Kategoriye göre gruplu, alfabetik (75 tür tek listede bulunmuyordu).
const equipmentCategories = computed(() => catalog.value
  .filter(c => c.kind === 'equipment')
  .map(c => ({ name: c.name, types: c.types.filter(t => t.slug).sort((a, b) => a.name.localeCompare(b.name, 'tr')) }))
  .filter(c => c.types.length)
  .sort((a, b) => a.name.localeCompare(b.name, 'tr')))
const FAMILY_TYPES: Record<string, string> = { electrical: 'elektrik-ic-tesisati', grounding: 'topraklama', detection: 'yangin-algilama', ventilation: 'havalandirma-klima', lightning: 'paratoner', battery: 'akumulator', transformer: 'trafo' }
const running = ref(false)
const runError = ref('')
const elapsed = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

const rereading = ref(false)

// "2/3 Yangın Pompası uygun"; tabloda sonuç yoksa "4 Yangın Pompası · sonuç yok".
const summaryText = (group: EquipmentGroup) => group.unknown === group.total
  ? `${group.total} ${group.equipment_name} · sonuç yok`
  : `${group.uygun}/${group.total} ${group.equipment_name} uygun`
const summaryKey = (group: EquipmentGroup) => group.unknown === group.total ? 'none' : group.uygun_degil > 0 ? 'bad' : 'ok'

const statusLabel = (status?: string | null) => ({ uygun: 'Uygun', uygun_degil: 'Uygun değil', uygulanamiyor: 'Uygulanamıyor' } as Record<string, string>)[status || ''] || 'Belirtilmemiş'
const statusKey = (status?: string | null) => status === 'uygun' ? 'ok' : status === 'uygun_degil' ? 'bad' : status === 'uygulanamiyor' ? 'na' : 'none'

const loadList = async () => {
  listLoading.value = true
  listError.value = ''
  try {
    const response = await get<{ fixtures: FixtureSummary[]; legacy_fixtures: FixtureSummary[] }>('/pk-report-analyses')
    fixtures.value = response.fixtures || []
    legacyFixtures.value = response.legacy_fixtures || []
  } catch (e: any) {
    listError.value = errorMessage(e, 'Analizler alınamadı.')
  } finally { listLoading.value = false }
}

const openFixture = async (fixtureId: string) => {
  detailLoading.value = true
  try { selected.value = await get(`/pk-report-analyses/${fixtureId}`) }
  catch (e: any) { runError.value = errorMessage(e, 'Analiz açılamadı.') }
  finally { detailLoading.value = false }
}

const onFileChange = (event: Event) => {
  file.value = (event.target as HTMLInputElement).files?.[0] || null
  if (file.value) legacyId.value = ''
}

const runAnalysis = async () => {
  if (!file.value && !legacyId.value) return
  running.value = true
  runError.value = ''
  elapsed.value = 0
  timer = setInterval(() => { elapsed.value++ }, 1000)
  const form = new FormData()
  if (file.value) form.append('file', file.value)
  else form.append('legacy_fixture_id', legacyId.value)
  form.append('kind', kind.value)
  // Elektrik ailesi: tesisat türü (talimat bundan).
  const family = !!FAMILY_TYPES[kind.value]
  if (family) form.append('type', FAMILY_TYPES[kind.value])
  if (kind.value === 'short') form.append('type', shortType.value)
  try {
    const fixture = await postForm(kind.value === 'short' ? '/pk-report-analyses/short' : family ? '/pk-report-analyses/electrical' : '/pk-report-analyses', form)
    selected.value = fixture
    file.value = null
    legacyId.value = ''
    if (fileInput.value) fileInput.value.value = ''
    await loadList()
  } catch (e: any) {
    runError.value = errorMessage(e, 'Analiz başarısız oldu.')
  } finally {
    running.value = false
    clearInterval(timer)
  }
}

const rereadTables = async () => {
  if (!selected.value) return
  rereading.value = true
  runError.value = ''
  try {
    selected.value = await post(`/pk-report-analyses/${selected.value.fixture_id}/tables`, {})
    await loadList()
  } catch (e: any) {
    runError.value = errorMessage(e, 'Tablolar okunamadı.')
  } finally { rereading.value = false }
}

const formatDate = (value?: string) => value ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'

// Tasarım kataloğu 16: adımlar, kaynak rapor ve algılanan alanlar özeti (yalnız gösterim; okuma akışı aynen).
const step = computed(() => running.value || file.value || legacyId.value ? 2 : selected.value ? 3 : 1)
const sourceName = computed(() => file.value?.name || legacyFixtures.value.find(item => item.fixture_id === legacyId.value)?.original_file_name || selected.value?.original_file_name || '')
const formatSize = (bytes: number) => bytes >= 1048576 ? `${(bytes / 1048576).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
const previewUrl = ref('')
watch(file, (value) => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = value ? URL.createObjectURL(value) : ''
})
const FINDING_LIMIT = 6
const detectedFindings = computed<any[]>(() => selected.value?.tables?.findings || selected.value?.semantic?.extracted_data?.findings || [])
const tiles = computed(() => {
  const data = selected.value?.semantic?.extracted_data || {}
  const systems: any[] = selected.value?.semantic?.template?.fire_systems?.systems || []
  const info = (key: string) => (data.report_information || []).find((field: any) => field.key === key)?.value || '—'
  return [
    { label: 'Ekipman', icon: 'pi pi-box', value: systems.map(system => system.system_name).filter(Boolean).join(', ') || data.report_category || '—' },
    { label: 'Ekipman no', icon: 'pi pi-tag', value: systems[0]?.equipment_definitions?.[0]?.instance_structure?.identity_value || '—' },
    { label: 'Son kontrol', icon: 'pi pi-calendar', value: info('control_date') },
    { label: 'Gelecek kontrol', icon: 'pi pi-calendar-plus', value: info('validity_date') },
    { label: 'Genel sonuç', icon: 'pi pi-exclamation-circle', value: '', status: data.overall_result?.status || 'none' },
    { label: 'Bulgu', icon: 'pi pi-clone', value: String(detectedFindings.value.length) }
  ]
})

onMounted(async () => {
  loadAccount()
  loadList()
  try { catalog.value = await get('/equipment-catalog') } catch { catalog.value = [] }
})
onBeforeUnmount(() => {
  clearInterval(timer)
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<style scoped>
.test-page{margin:0 auto;display:grid;gap:24px}
.page-head h1{margin:0;color:var(--admin-heading);font-size: 24px;font-weight: 700;line-height:1.15;letter-spacing: 0}.page-head p{margin:7px 0 0;color:var(--admin-muted);font-size:15px}
.crumb{display:flex;align-items:center;gap:8px;margin-bottom:8px;color:var(--admin-muted);font-size:13px}
.crumb a{color:var(--admin-muted)}.crumb a:hover{color:var(--admin-heading)}
.crumb strong{color:var(--admin-heading);font-weight:600}.crumb .pi-angle-right{font-size:11px}
h2{display:flex;align-items:center;gap:10px;margin:0 0 16px;color:var(--admin-heading);font-size:17px;font-weight:700}
/* Başlık ve durum hapı */
.head-row{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}
.hero-pill{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700;white-space:nowrap}
.hero-pill.ok{background:var(--admin-success-bg);color:var(--admin-success-text)}
.hero-pill.run{background:var(--admin-accent-soft);color:var(--admin-accent-text)}
/* Adımlar: açık olan birincil, geçilen yeşil */
.stepper{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0;padding:8px;list-style:none;border-radius:var(--pk-radius);background:var(--admin-card);box-shadow:var(--pk-card-shadow)}
.stepper li{display:flex;align-items:center;justify-content:center;gap:12px;min-height:48px;padding:0 16px;border-radius:8px;color:var(--admin-muted);font-size:15px;font-weight:600}
.stepper li span{width:28px;height:28px;display:grid;place-items:center;border-radius:50%;background:rgba(145,158,171,.16);color:var(--admin-muted);font-size:13px;font-weight:700}
.stepper li.active{background:var(--admin-accent-soft);color:var(--admin-heading);font-weight:700}
.stepper li.active span{background:var(--pk-accent);color:var(--pk-on-accent)}
.stepper li.done{color:var(--admin-heading)}
.stepper li.done span{background:var(--admin-success-bg);color:var(--admin-success-text)}
/* Kaynak rapor ve algılanan alanlar */
.work{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);gap:24px;align-items:start}
.card{padding:24px;background:var(--admin-card);border:0;border-radius:var(--pk-radius);min-width:0;box-shadow:var(--pk-card-shadow)}
.card.source h2,.card.detected h2{margin:0;font-size:17px;font-weight:700}.card.source h2 i,.card.detected h2 i{color:var(--admin-link);font-size:20px}
.card.source{display:grid;gap:16px}
.file-box{display:flex;align-items:center;gap:14px;padding:12px 14px;border:1px dashed rgba(145,158,171,.32);border-radius:12px;background:rgba(145,158,171,.04)}
.pdf-icon{flex:none;width:38px;height:44px;display:grid;place-items:end center;padding-bottom:4px;border:1px solid var(--admin-border);border-radius:6px;background:var(--admin-soft);color:var(--pk-on-accent);font-size:10px;font-weight:800;box-shadow:inset 0 -14px 0 var(--admin-danger-text)}
.file-meta{flex:1;display:grid;gap:3px;min-width:0}
.file-meta strong{overflow:hidden;color:var(--admin-heading);font-size:16px;white-space:nowrap;text-overflow:ellipsis}
.file-meta small{color:var(--admin-muted);font-size:13px}
.outline-button{flex:none;display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 14px;border:1px solid rgba(145,158,171,.32);border-radius:8px;background:var(--admin-card);color:var(--admin-heading);font:inherit;font-size:14px;font-weight:700;cursor:pointer}
.outline-button:hover{background:rgba(145,158,171,.08)}.outline-button:disabled{opacity:.55;cursor:not-allowed}
.row-field{display:grid;grid-template-columns:110px minmax(0,1fr);align-items:center;gap:12px;color:var(--admin-text);font-size:15px}
.row-field select,.sample select{width:100%;height:44px;padding:0 12px;border:1px solid rgba(145,158,171,.32);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:14px}
.preview{width:100%;height:420px;border:1px solid rgba(145,158,171,.2);border-radius:8px;background:var(--admin-soft)}
.source-foot{display:flex;align-items:flex-end;gap:12px}
.sample{flex:1;display:grid;gap:6px;min-width:0;color:var(--admin-text);font-size:14px}
.sample span{display:inline-flex;align-items:center;gap:6px}.sample i{color:var(--admin-muted)}
.primary-button{flex:none;display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:46px;padding:0 22px;border:0;border-radius:8px;background:var(--pk-accent);color:var(--pk-on-accent);font:inherit;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 8px 16px rgba(var(--pk-accent-rgb),.24)}
.primary-button:hover{background:var(--pk-accent-hover)}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.card.detected{display:grid;gap:16px}
.detected-head{display:flex;align-items:center;gap:14px}
.done-chip{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:6px;background:var(--admin-success-bg);color:var(--admin-success-text);font-size:12px;font-weight:700}
.tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.tile{display:flex;align-items:flex-start;gap:14px;min-width:0;padding:14px 16px;border-radius:12px;background:var(--pk-primary-lighter)}
:global(.dark-theme) .tile{background:var(--admin-accent-soft)}
.tile > i{margin-top:6px;color:var(--pk-primary-dark);font-size:20px}
:global(.dark-theme) .tile > i{color:var(--admin-accent-text)}
.tile > span{display:grid;gap:4px;min-width:0}
.tile small{color:var(--admin-text);font-size:13.5px}
.tile strong{overflow:hidden;color:var(--admin-heading);font-size:18px;font-weight:700;white-space:nowrap;text-overflow:ellipsis}
.detected h3{display:flex;align-items:center;gap:10px;margin:4px 0 0;color:var(--admin-heading);font-size:15px;font-weight:700}
.finding-list{display:grid;gap:8px;margin:0;padding:0;list-style:none}
.finding-list li{display:flex;align-items:center;gap:14px;padding:11px 16px;border:1px solid rgba(145,158,171,.2);border-radius:8px;color:var(--admin-heading);font-size:14px}
.finding-list i{flex:none;color:var(--admin-warning-text);font-size:17px}
/* Kayıtlı analizler ve ayrıntı (eski görünüm) */
.card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.card-head h2{margin:0}
.icon-button{width:32px;height:32px;display:grid;place-items:center;border:1px solid rgba(145,158,171,.32);border-radius:8px;background:var(--admin-input);color:var(--admin-muted);cursor:pointer}
.hint{margin:0;color:var(--admin-muted);font-size:12px}.error-text{color:var(--admin-danger-text)}.card>.error-text{margin:0;font-size:12px}
.muted{margin:0;color:var(--admin-muted);font-size:12px}.empty{padding:26px 10px;text-align:center;color:var(--admin-muted);font-size:12px}
.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}th,td{padding:12px 16px;text-align:left;border-bottom:1px solid rgba(145,158,171,.2);font-size:13px;color:var(--admin-text);vertical-align:top}th{font-size:13px;font-weight:600;color:var(--admin-muted);background:rgba(145,158,171,.08);border-bottom:0;white-space:nowrap}
tbody tr{cursor:pointer}tbody tr:hover{background:var(--admin-hover)}tbody tr.selected{background:var(--admin-accent-soft)}
.file-cell{max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--admin-heading);font-weight:600}.file-cell .origin{display:block;color:var(--admin-muted);font-size:10px;font-weight:400}
.status-badge{display:inline-block;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700;white-space:nowrap}
.tile .status-badge{justify-self:start;font-size:13px}
.status-badge.ok{background:var(--admin-success-bg);color:var(--admin-success-text)}.status-badge.bad{background:var(--admin-danger-bg);color:var(--admin-danger-text)}.status-badge.na{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.status-badge.none{background:var(--admin-chip);color:var(--admin-muted)}
.head-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.secondary-button{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 12px;border:1px solid rgba(145,158,171,.32);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}.secondary-button:disabled{opacity:.6;cursor:not-allowed}
.equipment-cell{min-width:180px}.summary-line{display:block;font-size:11px;font-weight:600;white-space:nowrap}.summary-line.ok{color:var(--admin-success-text)}.summary-line.bad{color:var(--admin-danger-text)}.summary-line.none{color:var(--admin-muted)}
@media(max-width:1200px){.work{grid-template-columns:1fr}.tiles{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:900px){.stepper li{font-size:14px;padding:0 10px}}
@media(max-width:600px){.page-head h1{font-size: 22px}.tiles{grid-template-columns:1fr}.source-foot{flex-direction:column;align-items:stretch}.row-field{grid-template-columns:1fr}}
</style>
