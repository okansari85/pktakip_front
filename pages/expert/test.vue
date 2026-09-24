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
        <button class="primary-button" type="button" :disabled="running || (!file && !legacyId)" @click="runAnalysis">
          <i :class="running ? 'pi pi-spin pi-spinner' : 'pi pi-play'" />
          {{ running ? `Analiz ediliyor... ${elapsed} sn` : 'Analiz Et' }}
        </button>
        <p v-if="running" class="hint">Gemini çağrısı 1-3 dakika sürebilir. Sayfadan ayrılmayın.</p>
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
                <td class="file-cell" :title="item.original_file_name">{{ item.original_file_name }}</td>
                <td>{{ item.report_category || '—' }}</td>
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

    <template v-else-if="selected">
      <section class="card">
        <div class="card-head">
          <h2>{{ selected.original_file_name }}</h2>
          <div class="head-actions">
            <span class="muted">Gemini {{ selected.duration_s }} sn<template v-if="selected.tables"> · Tablo {{ selected.tables.duration_s }} sn</template> · {{ selected.page_count }} sayfa</span>
            <button class="secondary-button" type="button" :disabled="rereading" @click="rereadTables"><i :class="rereading ? 'pi pi-spin pi-spinner' : 'pi pi-table'" /> {{ rereading ? 'Okunuyor...' : 'Tabloları yeniden oku' }}</button>
          </div>
        </div>
        <div class="chips">
          <span class="chip">Tip: <strong>{{ data.report_category || '—' }}</strong></span>
          <span class="chip">Okuma: <strong>{{ data.extraction_mode || '—' }}</strong></span>
          <span class="chip">Genel sonuç: <span class="status-badge" :class="statusKey(data.overall_result?.status)">{{ statusLabel(data.overall_result?.status) }}</span></span>
        </div>
        <p v-if="data.overall_result?.text" class="overall-text">{{ data.overall_result.text }}</p>

        <div class="info-grid">
          <div>
            <h3>Rapor bilgileri</h3>
            <dl>
              <template v-for="field in data.report_information || []" :key="field.key">
                <dt>{{ reportLabels[field.key] || field.key }}</dt><dd>{{ field.value || '—' }}</dd>
              </template>
            </dl>
          </div>
          <div v-if="data.facility_information?.length">
            <h3>Tesisat / proje bilgileri</h3>
            <dl>
              <template v-for="field in data.facility_information" :key="field.key">
                <dt>{{ field.key }}</dt><dd>{{ field.value || '—' }}</dd>
              </template>
            </dl>
          </div>
        </div>
        <div v-if="data.result_legend?.length" class="legend">
          <span v-for="item in data.result_legend" :key="item.code"><strong>{{ item.code }}</strong> {{ item.meaning }}</span>
        </div>
      </section>

      <section class="card">
        <h2>Sistemler <span class="count">{{ systems.length }}</span></h2>
        <div v-if="systems.length === 0" class="empty">Sistem bulunamadı.</div>
        <div v-for="system in systems" :key="system.system_name" class="system">
          <div class="system-head">
            <strong>{{ system.system_name }}</strong>
            <VerdictBadge :verdict="system.verdict" />
          </div>
          <p v-if="system.verdict?.evidence" class="evidence"><i class="pi pi-info-circle" /> {{ system.verdict.evidence }}</p>

          <div v-for="(definition, index) in system.equipment_definitions || []" :key="index" class="equipment">
            <div class="equipment-head">
              <span><i class="pi pi-box" /> {{ definition.equipment_name }}</span>
              <span class="axis">{{ axisLabel(definition.instance_structure) }}</span>
              <VerdictBadge v-if="definition.instance_structure?.equipment_axis === 'none'" :verdict="definition.verdict" />
            </div>
            <dl v-if="definition.instance_structure?.equipment_axis === 'none'" class="attributes">
              <dt>{{ definition.instance_structure.identity_field }}</dt><dd>{{ definition.instance_structure.identity_value || '—' }}</dd>
              <template v-for="attribute in definition.attributes || []" :key="attribute.field">
                <dt>{{ attribute.field }}</dt><dd>{{ attribute.value || '—' }}</dd>
              </template>
            </dl>
            <p v-else class="muted small">
              Kimlik alanı: <strong>{{ definition.instance_structure?.identity_field }}</strong>
              · Özellikler: {{ (definition.attributes || []).map((a: any) => a.field).join(', ') || '—' }}
              <template v-if="definition.instance_structure?.ambiguous"> · <span class="error-text">Belirsiz: {{ definition.instance_structure.ambiguous_reason }}</span></template>
            </p>
          </div>
        </div>
      </section>

      <section class="card">
        <h2>Ekipmanlar <span class="count">{{ equipment.length }}</span></h2>
        <p v-if="!selected.tables" class="muted">Bu analizde tablo adımı çalışmamış. "Tabloları yeniden oku" ile çalıştırabilirsiniz.</p>
        <p v-else-if="selected.tables.error" class="muted">Tablo adımı: <span class="error-text">{{ selected.tables.error }}</span></p>
        <div v-if="equipmentSummary.length" class="summary-chips">
          <span v-for="group in equipmentSummary" :key="group.system_name + group.equipment_name" class="summary-chip" :class="summaryKey(group)">
            <strong>{{ summaryText(group) }}</strong>
            <small v-if="group.uygun_degil">{{ group.uygun_degil }} uygun değil</small>
            <small v-if="group.unknown && group.unknown !== group.total">{{ group.unknown }} sonuçsuz</small>
          </span>
        </div>
        <div v-if="equipment.length" class="table-wrap">
          <table>
            <thead><tr><th>Sistem</th><th>Ekipman</th><th>Kod</th><th>Özellikler</th><th>Uygunluk</th><th>Bulgu</th></tr></thead>
            <tbody>
              <tr v-for="(item, index) in equipment" :key="index">
                <td class="muted">{{ item.system_name }}</td>
                <td>{{ item.equipment_name }}</td>
                <td><strong>{{ item.code || '—' }}</strong></td>
                <td class="props-cell">
                  <span v-for="(value, name) in item.properties" :key="name" class="prop"><small>{{ name }}</small> {{ value }}</span>
                  <span v-if="!Object.keys(item.properties || {}).length" class="muted">—</span>
                </td>
                <td>
                  <span class="status-badge" :class="statusKey(item.status)">{{ item.status ? statusLabel(item.status) : 'Sonuç yok' }}</span>
                  <small v-if="item.status_source" class="source">{{ item.status_source === 'gemini' ? 'Gemini' : 'tablo' }}</small>
                </td>
                <td>{{ findingCountByCode[equipmentKey(item)] || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <h2>Bulgular <span class="count">{{ findings.length }}</span></h2>
        <div v-if="findings.length === 0" class="empty">Bulgu yok.</div>
        <div v-else class="table-wrap">
          <table>
            <thead><tr><th>Sistem</th><th>Açıklama</th><th>Ekipman</th><th>Sayfa</th><th>Önem</th></tr></thead>
            <tbody>
              <tr v-for="finding in findings" :key="finding.id">
                <td>{{ finding.system_name || '—' }}<span v-if="finding.ambiguous" class="error-text"> (belirsiz)</span></td>
                <td class="finding-text">{{ finding.description }}</td>
                <td class="codes-cell">{{ (finding.affected_equipment || []).join(', ') || '—' }}</td>
                <td>{{ (finding.source_pages || []).join(', ') || '—' }}</td>
                <td>{{ finding.severity || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <details>
          <summary>Ham JSON <button class="link-button" type="button" @click.prevent="copyJson">{{ copied ? 'Kopyalandı' : 'Kopyala' }}</button></summary>
          <pre>{{ rawJson }}</pre>
        </details>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'expert', middleware: 'expert' })

interface EquipmentGroup { system_name: string; equipment_name: string; total: number; uygun: number; uygun_degil: number; unknown: number }
interface FixtureSummary { fixture_id: string; original_file_name: string; report_category?: string | null; overall_status?: string | null; system_count?: number; finding_count?: number; equipment_summary?: EquipmentGroup[] | null; duration_s?: number | null; created_at?: string }

const { get, post, postForm, errorMessage } = useExpertApi()

const reportLabels: Record<string, string> = {
  report_no: 'Rapor No', company_title: 'Firma Unvanı', address: 'Adres',
  report_date: 'Rapor Tarihi', control_date: 'Kontrol Tarihi', validity_date: 'Geçerlilik Tarihi'
}

const fixtures = ref<FixtureSummary[]>([])
const legacyFixtures = ref<FixtureSummary[]>([])
const listLoading = ref(true)
const listError = ref('')
const selected = ref<any>(null)
const detailLoading = ref(false)

const fileInput = ref<HTMLInputElement | null>(null)
const file = ref<File | null>(null)
const legacyId = ref('')
const running = ref(false)
const runError = ref('')
const elapsed = ref(0)
const copied = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

const data = computed(() => selected.value?.semantic?.extracted_data || {})
const systems = computed(() => selected.value?.semantic?.template?.fire_systems?.systems || [])
// Tablo adımı çalıştıysa bulgular ekipman kodlarıyla bağlanmış haliyle gelir.
const findings = computed(() => selected.value?.tables?.findings || data.value.findings || [])
const equipment = computed<any[]>(() => selected.value?.tables?.equipment || [])
const equipmentSummary = computed<EquipmentGroup[]>(() => selected.value?.tables?.equipment_summary || [])
const equipmentKey = (item: any) => `${item.system_name}|${item.code}`
const findingCountByCode = computed(() => {
  const counts: Record<string, number> = {}
  for (const finding of findings.value) for (const code of finding.affected_equipment || []) {
    const key = `${finding.system_name}|${code}`
    counts[key] = (counts[key] || 0) + 1
  }
  return counts
})
const rereading = ref(false)
const rawJson = computed(() => selected.value ? JSON.stringify(selected.value.semantic, null, 2) : '')

// "2/3 Yangın Pompası uygun"; tabloda sonuç yoksa "4 Yangın Pompası · sonuç yok".
const summaryText = (group: EquipmentGroup) => group.unknown === group.total
  ? `${group.total} ${group.equipment_name} · sonuç yok`
  : `${group.uygun}/${group.total} ${group.equipment_name} uygun`
const summaryKey = (group: EquipmentGroup) => group.unknown === group.total ? 'none' : group.uygun_degil > 0 ? 'bad' : 'ok'

const statusLabel = (status?: string | null) => ({ uygun: 'Uygun', uygun_degil: 'Uygun değil', uygulanamiyor: 'Uygulanamıyor' } as Record<string, string>)[status || ''] || 'Belirtilmemiş'
const statusKey = (status?: string | null) => status === 'uygun' ? 'ok' : status === 'uygun_degil' ? 'bad' : status === 'uygulanamiyor' ? 'na' : 'none'
const axisLabel = (structure: any) => {
  const axis = structure?.equipment_axis
  if (axis === 'none') return 'Tek ekipman (Gemini okur)'
  if (axis === 'rows') return 'Tablo · satır başına ekipman (Camelot okur)'
  if (axis === 'columns') return `Tablo · sütun başına ekipman${structure?.group_width ? `, ${structure.group_width}'lu blok` : ''} (Camelot okur)`
  return axis || '—'
}

// Uygunluk rozeti: durum + dayanağı (açık / türetilmiş / belirtilmemiş).
const VerdictBadge = defineComponent({
  props: { verdict: { type: Object, default: null } },
  setup(props) {
    const basisLabel: Record<string, string> = { explicit: 'raporda açık', derived: 'türetildi', not_stated: 'belirtilmemiş' }
    return () => h('span', { class: 'verdict' }, [
      h('span', { class: ['status-badge', statusKey(props.verdict?.status)] }, statusLabel(props.verdict?.status)),
      props.verdict?.basis ? h('small', basisLabel[props.verdict.basis] || props.verdict.basis) : null
    ])
  }
})

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
  copied.value = false
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
  try {
    const fixture = await postForm('/pk-report-analyses', form)
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

const copyJson = async () => {
  try { await navigator.clipboard.writeText(rawJson.value); copied.value = true; setTimeout(() => { copied.value = false }, 1500) } catch { /* pano erişimi yoksa sessiz geç */ }
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
h2{margin:0 0 14px;color:var(--admin-heading);font-size:15px}h3{margin:0 0 8px;color:var(--admin-heading);font-size:13px}
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
.muted{color:var(--admin-muted);font-size:12px}.small{font-size:11px}.empty{padding:26px 10px;text-align:center;color:var(--admin-muted);font-size:12px}
.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}th,td{padding:10px 12px;text-align:left;border-bottom:1px solid var(--admin-row-border);font-size:12px;color:var(--admin-text);vertical-align:top}th{font-size:11px;color:var(--admin-muted);background:var(--admin-soft);white-space:nowrap}
tbody tr{cursor:pointer}tbody tr:hover{background:var(--admin-hover)}tbody tr.selected{background:var(--admin-accent-soft)}
.file-cell{max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--admin-heading);font-weight:600}
.status-badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
.status-badge.ok{background:var(--admin-success-bg);color:var(--admin-success-text)}.status-badge.bad{background:var(--admin-danger-bg);color:var(--admin-danger-text)}.status-badge.na{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.status-badge.none{background:var(--admin-chip);color:var(--admin-muted)}
.chips{display:flex;flex-wrap:wrap;gap:8px}.chip{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:8px;background:var(--admin-soft);border:1px solid var(--admin-border);font-size:12px;color:var(--admin-muted)}.chip strong{color:var(--admin-heading)}
.overall-text{margin:12px 0 0;padding:10px 12px;border-left:3px solid var(--pk-yellow);background:var(--admin-soft);color:var(--admin-text);font-size:12px;line-height:1.5}
.info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px;margin-top:16px}
dl{display:grid;grid-template-columns:max-content 1fr;gap:6px 14px;margin:0;font-size:12px}dt{color:var(--admin-muted)}dd{margin:0;color:var(--admin-heading);word-break:break-word}
.legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:14px;padding-top:12px;border-top:1px solid var(--admin-border);font-size:11px;color:var(--admin-muted)}.legend strong{color:var(--admin-heading)}
.count{margin-left:6px;padding:1px 7px;border-radius:999px;background:var(--admin-chip);color:var(--admin-muted);font-size:11px}
.system{padding:12px 14px;border:1px solid var(--admin-border);border-radius:10px}.system+.system{margin-top:10px}
.system-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.system-head strong{color:var(--admin-heading);font-size:13px}
.evidence{margin:6px 0 0;color:var(--admin-muted);font-size:11px}
.equipment{margin-top:10px;padding:10px 12px;border-radius:8px;background:var(--admin-soft)}
.equipment-head{display:flex;flex-wrap:wrap;align-items:center;gap:10px;font-size:12px;color:var(--admin-heading);font-weight:600}.equipment-head .axis{color:var(--admin-muted);font-weight:400;font-size:11px}
.attributes{margin-top:8px}
:deep(.verdict){display:inline-flex;align-items:center;gap:6px}:deep(.verdict small){color:var(--admin-muted);font-size:10px}
.finding-text{min-width:320px;line-height:1.45}
details summary{cursor:pointer;color:var(--admin-heading);font-size:13px;font-weight:700}
.link-button{margin-left:10px;border:0;background:none;color:var(--admin-link);font:inherit;font-size:12px;cursor:pointer}
pre{max-height:520px;overflow:auto;margin:12px 0 0;padding:12px;border-radius:8px;background:var(--admin-soft);color:var(--admin-text);font-size:11px;line-height:1.45}
.head-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.secondary-button{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 12px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}.secondary-button:disabled{opacity:.6;cursor:not-allowed}
.equipment-cell{min-width:180px}.summary-line{display:block;font-size:11px;font-weight:600;white-space:nowrap}.summary-line.ok{color:var(--admin-success-text)}.summary-line.bad{color:var(--admin-danger-text)}.summary-line.none{color:var(--admin-muted)}
.summary-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.summary-chip{display:inline-flex;flex-direction:column;gap:2px;padding:8px 12px;border-radius:9px;border:1px solid var(--admin-border);font-size:12px}
.summary-chip.ok{background:var(--admin-success-bg);color:var(--admin-success-text)}.summary-chip.bad{background:var(--admin-danger-bg);color:var(--admin-danger-text)}.summary-chip.none{background:var(--admin-chip);color:var(--admin-muted)}.summary-chip small{font-size:10px;opacity:.9}
.props-cell{min-width:280px}.prop{display:inline-block;margin:0 10px 3px 0}.prop small{color:var(--admin-muted)}
.source{display:block;margin-top:3px;color:var(--admin-muted);font-size:10px}
.codes-cell{max-width:220px;font-size:11px;color:var(--admin-muted)}
@media(max-width:1000px){.top-grid{grid-template-columns:1fr}}
</style>
