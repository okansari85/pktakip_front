<template>
  <div class="analysis-view">
    <section class="card">
      <slot name="head" />
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

    <!-- Tablo adımı: tesisat raporunda (ve test sayfasında her okumada) çalışır; tek ekipmanlı raporda bilgiler Sistemler'de -->
    <section v-if="testMode || analysis.tables" class="card">
      <h2>Ekipmanlar <span class="count">{{ equipment.length }}</span></h2>
      <p v-if="analysis.input === 'ocr'" class="muted">Taranmış PDF: metin ve tablolar OCR ile üretilen dijital kopyadan okundu.</p>
      <p v-if="analysis.input === 'image'" class="muted">Görüntü PDF: rapor sayfa görüntülerinden okundu, tablo adımı yok.</p>
      <p v-else-if="!analysis.tables" class="muted">Bu analizde tablo adımı çalışmamış. "Tabloları yeniden oku" ile çalıştırabilirsiniz.</p>
      <p v-else-if="analysis.tables.error" class="muted">Tablo adımı: <span class="error-text">{{ analysis.tables.error }}</span></p>
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
                <small v-if="item.status_source" class="source">{{ item.status_source === 'gemini' ? 'yapay zeka' : 'tablo' }}</small>
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
            <tr v-for="(finding, index) in findings" :key="finding.id || index">
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
  </div>
</template>

<script setup lang="ts">
// Yapay zeka rapor okumasının detayı (kriterler hariç): rapor bilgileri, genel sonuç, sistemler, ekipmanlar, bulgular.
// Test sayfası ve Ayarlar → Analiz geçmişi ortak kullanır. analysis: { semantic, tables, input }.
interface EquipmentGroup { system_name: string; equipment_name: string; total: number; uygun: number; uygun_degil: number; unknown: number }

const props = defineProps<{ analysis: any; testMode?: boolean }>()

const reportLabels: Record<string, string> = {
  report_no: 'Rapor No', company_title: 'Firma Unvanı', address: 'Adres',
  report_date: 'Rapor Tarihi', control_date: 'Kontrol Tarihi', validity_date: 'Geçerlilik Tarihi'
}

const copied = ref(false)
const data = computed(() => props.analysis?.semantic?.extracted_data || {})
const systems = computed(() => props.analysis?.semantic?.template?.fire_systems?.systems || [])
// Tablo adımı çalıştıysa bulgular ekipman kodlarıyla bağlanmış haliyle gelir.
const findings = computed(() => props.analysis?.tables?.findings || data.value.findings || [])
const equipment = computed<any[]>(() => props.analysis?.tables?.equipment || [])
const equipmentSummary = computed<EquipmentGroup[]>(() => props.analysis?.tables?.equipment_summary || [])
const equipmentKey = (item: any) => `${item.system_name}|${item.code}`
const findingCountByCode = computed(() => {
  const counts: Record<string, number> = {}
  for (const finding of findings.value) for (const code of finding.affected_equipment || []) {
    const key = `${finding.system_name}|${code}`
    counts[key] = (counts[key] || 0) + 1
  }
  return counts
})
const rawJson = computed(() => props.analysis ? JSON.stringify(props.analysis.semantic, null, 2) : '')
watch(() => props.analysis, () => { copied.value = false })

// "2/3 Yangın Pompası uygun"; tabloda sonuç yoksa "4 Yangın Pompası · sonuç yok".
const summaryText = (group: EquipmentGroup) => group.unknown === group.total
  ? `${group.total} ${group.equipment_name} · sonuç yok`
  : `${group.uygun}/${group.total} ${group.equipment_name} uygun`
const summaryKey = (group: EquipmentGroup) => group.unknown === group.total ? 'none' : group.uygun_degil > 0 ? 'bad' : 'ok'

const statusLabel = (status?: string | null) => ({ uygun: 'Uygun', uygun_degil: 'Uygun değil', uygulanamiyor: 'Uygulanamıyor' } as Record<string, string>)[status || ''] || 'Belirtilmemiş'
const statusKey = (status?: string | null) => status === 'uygun' ? 'ok' : status === 'uygun_degil' ? 'bad' : status === 'uygulanamiyor' ? 'na' : 'none'
const axisLabel = (structure: any) => {
  const axis = structure?.equipment_axis
  if (axis === 'none') return 'Tek ekipman (yapay zeka okur)'
  if (axis === 'rows') return 'Tablo · satır başına ekipman (Camelot okur)'
  if (axis === 'columns') return `Tablo · sütun başına ekipman${structure?.group_width ? `, ${structure.group_width}'lu blok` : ''} (Camelot okur)`
  return axis || '—'
}

// Uygunluk rozeti: durum + dayanağı (açık / türetilmiş / belirtilmemiş).
const VerdictBadge = defineComponent({
  props: { verdict: { type: Object, default: null } },
  setup(badgeProps) {
    const basisLabel: Record<string, string> = { explicit: 'raporda açık', derived: 'türetildi', not_stated: 'belirtilmemiş' }
    return () => h('span', { class: 'verdict' }, [
      h('span', { class: ['status-badge', statusKey(badgeProps.verdict?.status)] }, statusLabel(badgeProps.verdict?.status)),
      badgeProps.verdict?.basis ? h('small', basisLabel[badgeProps.verdict.basis] || badgeProps.verdict.basis) : null
    ])
  }
})

const copyJson = async () => {
  try { await navigator.clipboard.writeText(rawJson.value); copied.value = true; setTimeout(() => { copied.value = false }, 1500) } catch { /* pano erişimi yoksa sessiz geç */ }
}
</script>

<style scoped>
.analysis-view{display:grid;gap:16px}
h2{margin:0 0 14px;color:var(--admin-heading);font-size:15px}h3{margin:0 0 8px;color:var(--admin-heading);font-size:13px}
.card{padding:18px;background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px;min-width:0}
.muted{color:var(--admin-muted);font-size:12px}.small{font-size:11px}.empty{padding:26px 10px;text-align:center;color:var(--admin-muted);font-size:12px}.error-text{color:var(--admin-danger-text)}
.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}th,td{padding:10px 12px;text-align:left;border-bottom:1px solid var(--admin-row-border);font-size:12px;color:var(--admin-text);vertical-align:top}th{font-size:11px;color:var(--admin-muted);background:var(--admin-soft);white-space:nowrap}
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
.summary-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.summary-chip{display:inline-flex;flex-direction:column;gap:2px;padding:8px 12px;border-radius:9px;border:1px solid var(--admin-border);font-size:12px}
.summary-chip.ok{background:var(--admin-success-bg);color:var(--admin-success-text)}.summary-chip.bad{background:var(--admin-danger-bg);color:var(--admin-danger-text)}.summary-chip.none{background:var(--admin-chip);color:var(--admin-muted)}.summary-chip small{font-size:10px;opacity:.9}
.props-cell{min-width:280px}.prop{display:inline-block;margin:0 10px 3px 0}.prop small{color:var(--admin-muted)}
.source{display:block;margin-top:3px;color:var(--admin-muted);font-size:10px}
.codes-cell{max-width:220px;font-size:11px;color:var(--admin-muted)}
</style>
