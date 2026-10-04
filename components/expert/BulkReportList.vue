<template>
  <section class="card forms-card">
    <div class="forms-head">
      <div><h3>Kontrol formları <span class="count">{{ reports.length }}</span></h3><small>Tüplerin toplu periyodik kontrol formları. Satıra tıklayınca bölümler ve tüplerin sonuçları açılır.</small></div>
      <button class="primary-button" type="button" @click="emit('upload')"><i class="pi pi-file-arrow-up" /> Tüp Kontrol Formu Yükle</button>
    </div>

    <div v-if="loading && !reports.length" class="state">Formlar yükleniyor...</div>
    <div v-else-if="error" class="state error-text">{{ error }}</div>
    <div v-else-if="!reports.length" class="state empty">
      <i class="pi pi-file-check" />
      <strong>Henüz tüp kontrol formu yok</strong>
      <span>“Tüp Kontrol Formu Yükle” ile yükleyin; tüpler Ekipmanlar'daki kayıtlarla eşleşir, her tüpe kendi sonucuyla kontrol kaydı açılır.</span>
    </div>
    <div v-else class="table-wrap">
      <table>
        <thead><tr><th>Kontrol tarihi</th><th>Geçerlilik</th><th>Rapor</th><th>Kontrolü yapan</th><th>Genel sonuç</th><th>Bölümler</th><th>Tüp</th><th>Bulgu</th><th>Ekleyen</th><th /></tr></thead>
        <tbody>
          <template v-for="report in reports" :key="report.id">
            <tr :class="{ open: openId === report.id }" @click="toggle(report)">
              <td>
                <strong>{{ formatDate(report.control_date) }}</strong>
                <!-- Formun türü: eşleştirme ekranı son tüm envanter formuna göre çalışır -->
                <select class="scope-select" :class="scopes[report.id] || 'full'" :value="scopes[report.id] || 'full'" title="Formun türü" @click.stop @change="changeScope(report, ($event.target as HTMLSelectElement).value)">
                  <option value="full">Tüm envanter</option>
                  <option value="partial">Ek form</option>
                </select>
              </td>
              <td>{{ formatDate(report.next_control_date) }}</td>
              <td @click.stop>
                <button v-if="report.has_report" class="link-button" type="button" :title="report.report_file_name" @click="openPdf(report)"><i class="pi pi-file-pdf" /> {{ report.report_no || 'Görüntüle' }}</button>
                <span v-else class="muted">{{ report.report_no || '—' }}</span>
              </td>
              <td class="body-cell">{{ report.inspection_body || '—' }}</td>
              <td><span class="status-badge" :class="report.status || 'none'">{{ STATUS_LABELS[report.status] || 'Belirtilmemiş' }}</span></td>
              <td class="sections-cell">
                <span v-for="system in report.systems" :key="system.name" class="section-line" :class="system.status || 'none'">{{ system.name }}: {{ STATUS_LABELS[system.status] || 'Belirtilmemiş' }}</span>
                <span v-if="!report.systems.length" class="muted">—</span>
              </td>
              <td>
                {{ report.equipment_count }}
                <!-- Eşleştirme bekleyenler "Eşleştirme bekliyor" sekmesinde -->
                <button v-if="pendingCounts[report.id]" class="pending-badge" type="button" @click.stop="emit('matching')">{{ pendingCounts[report.id] }} eşleştirme bekliyor</button>
              </td>
              <td>{{ report.findings_count || '—' }}</td>
              <td>{{ report.created_by || '—' }}<small class="muted block">{{ report.source === 'ai' ? 'Yapay zeka ile okundu' : 'Elle girildi' }}</small></td>
              <td class="actions-col" @click.stop>
                <button class="icon-button" type="button" title="Formu sil" aria-label="Formu sil" @click="remove(report)"><i class="pi pi-trash" /></button>
              </td>
            </tr>
            <tr v-if="openId === report.id" class="detail-row">
              <td colspan="10">
                <div v-if="detailLoading" class="muted">Yükleniyor...</div>
                <div v-else-if="detail" class="detail">
                  <div class="detail-grid">
                    <div v-for="system in detail.systems" :key="system.name" class="detail-card">
                      <header><strong>{{ system.name }}</strong><span class="status-badge" :class="system.status || 'none'">{{ STATUS_LABELS[system.status] || 'Belirtilmemiş' }}</span></header>
                      <ol v-if="system.findings?.length" class="findings"><li v-for="(finding, index) in system.findings" :key="index">{{ finding }}</li></ol>
                      <p v-else class="muted">{{ system.equipment_count ? `${system.equipment_count} tüp · bulgu yok` : 'Bulgu yok.' }}</p>
                    </div>
                    <div v-if="detail.findings.length" class="detail-card">
                      <header><strong>Genel bulgular</strong></header>
                      <ol class="findings"><li v-for="(finding, index) in detail.findings" :key="index">{{ finding }}</li></ol>
                    </div>
                  </div>
                  <p v-if="detail.conclusion" class="conclusion">{{ detail.conclusion }}</p>
                  <h4>Tüpler <span class="count">{{ detail.equipment.length }}</span></h4>
                  <div class="tubes">
                    <!-- Tüp silinirse kontrol kaydı da silinir: listede her zaman tüpü olan kayıtlar -->
                    <NuxtLink v-for="row in detail.equipment.filter((item: any) => item.equipment)" :key="row.inspection_id" class="tube" :to="`/expert/equipment/${row.equipment.id}`">
                      <span class="dot" :class="row.status" />
                      <span class="tube-name">{{ [row.equipment.place, row.equipment.code && `no ${row.equipment.code}`, row.equipment.variant].filter(Boolean).join(' · ') }}</span>
                      <span class="tube-status" :class="row.status">{{ EQUIPMENT_STATUS_LABELS[row.status] || row.status }}</span>
                    </NuxtLink>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
// Ekipmanlar → Yangın Söndürme Cihazı → Kontrol Formları: lokasyondaki tüp kontrol formları, form detayı (bölümler,
// bulgular, tüplerin o formdaki sonucu), PDF ve silme. Yükleme penceresini üst sayfa açar ("upload"); eşleştirme bekleyenler
// "Eşleştirme bekliyor" sekmesinde ("matching").
const props = defineProps<{ context: any; refreshKey?: number }>()
const emit = defineEmits<{ upload: []; changed: []; matching: [] }>()

const STATUS_LABELS: Record<string, string> = { uygun: 'Uygun', uygun_degil: 'Uygun değil' }
const EQUIPMENT_STATUS_LABELS: Record<string, string> = { uygun: 'Uygun', uygun_degil: 'Uygun değil', belirtilmemis: 'Belirtilmemiş', rapor_bekleniyor: 'Rapor bekleniyor' }

const { get, post, del, getBlob, errorMessage } = useExpertApi()
const reports = ref<any[]>([])
const loading = ref(false)
const error = ref('')
const openId = ref<number | null>(null)
const detail = ref<any>(null)
const detailLoading = ref(false)
// Form id → eşleştirme bekleyen sayısı; form id → tür (full: tüm envanter, partial: ek form).
const pendingCounts = ref<Record<number, number>>({})
const scopes = ref<Record<number, string>>({})

const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('tr-TR').format(new Date(value)) : '—'

const load = async () => {
  if (!props.context) { reports.value = []; return }
  loading.value = true
  error.value = ''
  try {
    const [list, counts, types] = await Promise.all([
      get('/pk-bulk-reports', {
        location_id: props.context.location_id,
        ...(props.context.type === 'workplace' ? { workplace_id: props.context.workplace_id } : {})
      }),
      get('/pk-bulk-report-matches/pending-counts', { location_id: props.context.location_id }).catch(() => ({})),
      get('/pk-bulk-report-matches/scopes', { location_id: props.context.location_id }).catch(() => ({}))
    ])
    reports.value = list
    pendingCounts.value = counts || {}
    scopes.value = types || {}
  } catch (e: any) {
    error.value = errorMessage(e, 'Kontrol formları alınamadı.')
  } finally { loading.value = false }
}

const toggle = async (report: any) => {
  if (openId.value === report.id) { openId.value = null; return }
  openId.value = report.id
  detail.value = null
  detailLoading.value = true
  try { detail.value = await get(`/pk-bulk-reports/${report.id}`) }
  catch (e: any) { error.value = errorMessage(e, 'Form açılamadı.') }
  finally { detailLoading.value = false }
}

// Türü değişince eşleştirme ekranının sayısı da değişir (üst sayfa yeniler).
const changeScope = async (report: any, scope: string) => {
  const previous = scopes.value[report.id] || 'full'
  scopes.value = { ...scopes.value, [report.id]: scope }
  try {
    await post(`/pk-bulk-report-matches/${report.id}/scope`, { scope })
    emit('changed')
  } catch (e: any) {
    scopes.value = { ...scopes.value, [report.id]: previous }
    alert(errorMessage(e, 'Formun türü değiştirilemedi.'))
  }
}

const openPdf = async (report: any) => {
  const tab = window.open('', '_blank')
  try {
    const blob = await getBlob(`/pk-bulk-reports/${report.id}/file`)
    const blobUrl = URL.createObjectURL(blob)
    if (tab) tab.location.href = blobUrl
    else window.location.href = blobUrl
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
  } catch (e: any) {
    tab?.close()
    alert(errorMessage(e, 'Rapor açılamadı.'))
  }
}

const remove = async (report: any) => {
  const note = report.equipment_count ? ` Bu formla ${report.equipment_count} tüpe açılan kontrol kayıtları da silinir (tüpler kalır).` : ''
  if (!confirm(`${formatDate(report.control_date)} tarihli tüp kontrol formu silinsin mi?${note}`)) return
  try {
    await del(`/pk-bulk-reports/${report.id}`)
    if (openId.value === report.id) openId.value = null
    await load()
    emit('changed')
  } catch (e: any) {
    alert(errorMessage(e, 'Form silinemedi.'))
  }
}

watch(() => [props.refreshKey, props.context && `${props.context.location_id}-${props.context.workplace_id ?? ''}`], () => load())
onMounted(load)
</script>

<style scoped>
.card{background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px}
.forms-card{overflow:hidden}
.forms-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid var(--admin-border)}
h3{margin:0;color:var(--admin-heading);font-size:15px}.forms-head small{display:block;margin-top:4px;color:var(--admin-muted);font-size:12px}
h4{margin:14px 0 8px;color:var(--admin-heading);font-size:12px}
.count{min-width:20px;padding:1px 7px;border-radius:999px;background:var(--admin-chip);color:var(--admin-muted);font-size:11px;font-weight:700}
.state{padding:50px 20px;text-align:center;color:var(--admin-muted);font-size:13px}
.empty{display:flex;flex-direction:column;align-items:center;gap:7px}.empty i{font-size:26px}.empty strong{color:var(--admin-heading)}
.table-wrap{overflow:auto}
table{width:100%;border-collapse:collapse}th,td{padding:12px 16px;text-align:left;border-bottom:1px solid var(--admin-row-border);font-size:12px;color:var(--admin-text);vertical-align:top}
th{font-size:11px;font-weight:700;color:var(--admin-muted);background:var(--admin-soft);white-space:nowrap}
tbody tr{cursor:pointer}tbody tr:hover,tbody tr.open{background:var(--admin-hover)}tbody tr.detail-row{cursor:default}tbody tr.detail-row:hover{background:none}
td strong{color:var(--admin-heading)}
.body-cell{max-width:220px}
.sections-cell{min-width:220px}.section-line{display:block;font-size:11px;font-weight:600}.section-line.uygun{color:var(--admin-success-text)}.section-line.uygun_degil{color:var(--admin-danger-text)}.section-line.none{color:var(--admin-muted)}
.status-badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
.status-badge.uygun{background:var(--admin-success-bg);color:var(--admin-success-text)}.status-badge.uygun_degil{background:var(--admin-danger-bg);color:var(--admin-danger-text)}.status-badge.none{background:var(--admin-chip);color:var(--admin-muted)}
.scope-select{display:block;margin-top:5px;height:24px;padding:0 6px;border:1px solid var(--admin-border);border-radius:999px;background:var(--admin-chip);color:var(--admin-heading);font:inherit;font-size:11px;font-weight:700;cursor:pointer}
.scope-select.partial{background:var(--admin-accent-soft)}
.pending-badge{display:block;width:max-content;margin-top:4px;padding:2px 8px;border:0;border-radius:999px;background:var(--admin-warning-bg);color:var(--admin-warning-text);font:inherit;font-size:11px;font-weight:700;cursor:pointer}
.link-button{display:inline-flex;align-items:center;gap:6px;border:0;background:none;color:var(--admin-link);font:inherit;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}
.muted{margin:0;color:var(--admin-muted);font-size:12px}.block{display:block;margin-top:2px;font-size:11px}
.actions-col{width:1%;cursor:default}
.icon-button{width:32px;height:32px;display:grid;place-items:center;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--admin-muted);cursor:pointer}.icon-button:hover{border-color:var(--admin-border);background:var(--admin-card);color:var(--admin-danger-text)}
.detail{padding:4px 0 8px}
.detail-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px}
.detail-card{padding:12px 14px;border:1px solid var(--admin-border);border-radius:10px;background:var(--admin-card)}
.detail-card header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.detail-card header strong{color:var(--admin-heading);font-size:13px}
.detail-card .muted{margin-top:8px}
.findings{display:grid;gap:4px;margin:8px 0 0;padding-left:20px;color:var(--admin-text);font-size:12px;line-height:1.45}
.conclusion{margin:12px 0 0;padding:10px 12px;border-left:3px solid var(--pk-yellow);background:var(--admin-soft);color:var(--admin-text);font-size:12px;line-height:1.5}
.tubes{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:6px}
.tube{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-card);color:var(--admin-text);font-size:12px;text-decoration:none}.tube:hover{border-color:#d7a900}
.tube-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--admin-heading)}
.tube-status{font-size:11px;font-weight:700;color:var(--admin-muted)}.tube-status.uygun{color:var(--admin-success-text)}.tube-status.uygun_degil{color:var(--admin-danger-text)}
.dot{width:8px;height:8px;border-radius:50%;background:var(--admin-muted);flex-shrink:0}.dot.uygun{background:var(--admin-success-text)}.dot.uygun_degil{background:var(--admin-danger-text)}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:38px;padding:0 15px;border:0;border-radius:8px;background:var(--pk-yellow);color:#111827;font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap}
.error-text{color:var(--admin-danger-text)}
@media(max-width:700px){.forms-head{flex-direction:column}}
</style>
