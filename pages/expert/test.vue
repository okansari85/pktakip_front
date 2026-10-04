<template>
  <div class="test-page">
    <div class="page-head">
      <div>
        <div class="breadcrumb"><span>Uzman Paneli</span><i class="pi pi-angle-right" /><strong>Test</strong></div>
        <h1>Rapor Algılama Testi</h1>
        <p>Yeni algılama (kriterler hariç): rapor bilgileri, genel sonuç, sistemler ve uygunlukları, ekipmanlar, bulgular.</p>
      </div>
    </div>

    <div class="top-grid">
      <section class="card">
        <h2>Yeni analiz</h2>
        <label class="field">
          <span>PDF yükle</span>
          <input ref="fileInput" type="file" accept="application/pdf" :disabled="running" @change="onFileChange" />
        </label>
        <div class="or"><span>ya da</span></div>
        <label class="field">
          <span>Eski test PDF'lerinden seç</span>
          <select v-model="legacyId" :disabled="running || !!file" @change="file = null">
            <option value="">Seçiniz</option>
            <option v-for="item in legacyFixtures" :key="item.fixture_id" :value="item.fixture_id">{{ item.original_file_name }}{{ item.report_category ? ` (${item.report_category})` : '' }}</option>
          </select>
        </label>
        <label class="field">
          <span>Rapor türü</span>
          <select v-model="kind" :disabled="running">
            <option value="equipment">Ekipman raporu — tür, etiket ve teknik özellikler katalogla</option>
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
        <button class="primary-button" type="button" :disabled="running || (!file && !legacyId)" @click="runAnalysis">
          <i :class="running ? 'pi pi-spin pi-spinner' : 'pi pi-play'" />
          {{ running ? `Analiz ediliyor... ${elapsed} sn` : 'Analiz Et' }}
        </button>
        <p v-if="running" class="hint">Yapay zeka çağrısı 1-3 dakika sürebilir. Sayfadan ayrılmayın.</p>
        <p v-if="runError" class="error-text">{{ runError }}</p>
      </section>

      <section class="card">
        <div class="card-head">
          <h2>Kayıtlı analizler</h2>
          <button class="icon-button" type="button" title="Yenile" @click="loadList"><i class="pi pi-refresh" /></button>
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
            <button v-if="selected.input !== 'image'" class="secondary-button" type="button" :disabled="rereading" @click="rereadTables"><i :class="rereading ? 'pi pi-spin pi-spinner' : 'pi pi-table'" /> {{ rereading ? 'Okunuyor...' : 'Tabloları yeniden oku' }}</button>
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
const kind = ref<'equipment' | 'installation' | 'electrical' | 'grounding' | 'detection' | 'ventilation' | 'lightning' | 'battery' | 'transformer'>('equipment')
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
  try {
    const fixture = await postForm(family ? '/pk-report-analyses/electrical' : '/pk-report-analyses', form)
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

onMounted(loadList)
onBeforeUnmount(() => clearInterval(timer))
</script>

<style scoped>
.test-page { max-width: 1500px; margin: 0 auto; display: grid; gap: 16px; }
.page-head { margin-bottom: 8px; }
.breadcrumb { display:flex; align-items:center; gap:8px; margin-bottom:10px; color:var(--admin-muted); font-size:12px; }.breadcrumb strong{color:var(--admin-heading)}
h1{margin:0;color:var(--admin-heading);font-size:30px;letter-spacing:-.7px}.page-head p{margin:7px 0 0;color:var(--admin-muted);font-size:13px}
h2{margin:0 0 14px;color:var(--admin-heading);font-size:15px}
.top-grid{display:grid;grid-template-columns:minmax(280px,380px) 1fr;gap:16px;align-items:start}
.card{padding:18px;background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px;min-width:0}
.card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.card-head h2{margin:0}
.field{display:flex;flex-direction:column;gap:6px;margin-bottom:12px;font-size:11px;font-weight:700;color:var(--admin-muted)}
.field input,.field select{height:40px;padding:0 10px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:12px}
.field input[type=file]{padding:8px 10px;height:auto}
.or{display:flex;align-items:center;gap:10px;margin:2px 0 12px;color:var(--admin-muted);font-size:11px}.or::before,.or::after{content:'';flex:1;height:1px;background:var(--admin-border)}
.primary-button{width:100%;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;border:0;border-radius:8px;background:var(--pk-yellow);color:#111827;font-size:13px;font-weight:800;cursor:pointer}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.icon-button{width:32px;height:32px;display:grid;place-items:center;border:1px solid var(--admin-border);border-radius:7px;background:var(--admin-input);color:var(--admin-muted);cursor:pointer}
.hint{margin:10px 0 0;color:var(--admin-muted);font-size:12px}.error-text{color:var(--admin-danger-text)}.card>.error-text{margin:10px 0 0;font-size:12px}
.muted{color:var(--admin-muted);font-size:12px}.empty{padding:26px 10px;text-align:center;color:var(--admin-muted);font-size:12px}
.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}th,td{padding:10px 12px;text-align:left;border-bottom:1px solid var(--admin-row-border);font-size:12px;color:var(--admin-text);vertical-align:top}th{font-size:11px;color:var(--admin-muted);background:var(--admin-soft);white-space:nowrap}
tbody tr{cursor:pointer}tbody tr:hover{background:var(--admin-hover)}tbody tr.selected{background:var(--admin-accent-soft)}
.file-cell{max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--admin-heading);font-weight:600}.file-cell .origin{display:block;color:var(--admin-muted);font-size:10px;font-weight:400}
.status-badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
.status-badge.ok{background:var(--admin-success-bg);color:var(--admin-success-text)}.status-badge.bad{background:var(--admin-danger-bg);color:var(--admin-danger-text)}.status-badge.na{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.status-badge.none{background:var(--admin-chip);color:var(--admin-muted)}
.head-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.secondary-button{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 12px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}.secondary-button:disabled{opacity:.6;cursor:not-allowed}
.equipment-cell{min-width:180px}.summary-line{display:block;font-size:11px;font-weight:600;white-space:nowrap}.summary-line.ok{color:var(--admin-success-text)}.summary-line.bad{color:var(--admin-danger-text)}.summary-line.none{color:var(--admin-muted)}
@media(max-width:1000px){.top-grid{grid-template-columns:1fr}}
</style>
