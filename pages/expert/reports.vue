<template>
  <div class="report-page">
    <div class="page-head">
      <div>
        <div class="breadcrumb no-print"><span>Uzman Paneli</span><i class="pi pi-angle-right" /><span>Periyodik Kontroller</span><i class="pi pi-angle-right" /><strong>Durum Raporu</strong></div>
        <h1>Periyodik Kontrol Durum Raporu</h1>
        <p>{{ scopeLabel }} · {{ today }}</p>
      </div>
      <div class="head-actions no-print">
        <ExpertDashboardFilters />
        <button class="primary-button" type="button" :disabled="!data" @click="print"><i class="pi pi-print" /> Yazdır / PDF</button>
      </div>
    </div>

    <div class="tabs no-print">
      <button type="button" :class="{ active: tab === 'equipment' }" @click="tab = 'equipment'"><i class="pi pi-wrench" /> Ekipman bazında</button>
      <button type="button" :class="{ active: tab === 'installations' }" @click="tab = 'installations'"><i class="pi pi-sitemap" /> Tesisat bazında <span v-if="data" class="count">{{ data.installations.length }}</span></button>
    </div>

    <div v-if="loading && !data" class="card state"><i class="pi pi-spin pi-spinner" /> Rapor hazırlanıyor...</div>
    <div v-else-if="error" class="card state error-text">{{ error }}</div>

    <template v-else-if="data">
      <div class="kpis">
        <div class="kpi"><span>Aktif ekipman</span><strong>{{ data.totals.equipment }}</strong><small v-if="data.totals.passive">{{ data.totals.passive }} pasif ayrıca</small></div>
        <div class="kpi ok"><span>Uygun</span><strong>{{ data.status.uygun }}</strong><small>{{ percent(data.status.uygun) }}</small></div>
        <div class="kpi bad"><span>Uygun değil</span><strong>{{ data.status.uygun_degil }}</strong><small>{{ percent(data.status.uygun_degil) }}</small></div>
        <div class="kpi bad"><span>Süresi geçmiş</span><strong>{{ data.totals.overdue }}</strong><small>{{ percent(data.totals.overdue) }}</small></div>
        <div class="kpi warn"><span>60 gün içinde</span><strong>{{ data.totals.upcoming }}</strong><small>{{ percent(data.totals.upcoming) }}</small></div>
      </div>

      <!-- Ekipman bazında -->
      <template v-if="tab === 'equipment'">
        <section class="card block">
          <header><h3>Kategorilere göre durum</h3><small>Son kontrol sonucu</small></header>
          <p v-if="!data.categories.length" class="muted">Ekipman yok.</p>
          <div class="category-grid">
            <div v-for="category in data.categories" :key="category.slug" class="category">
              <strong>{{ category.name }}</strong>
              <small>{{ category.total }} ekipman · {{ category.overdue }} gecikmiş · {{ category.upcoming }} yaklaşan</small>
              <Chart type="doughnut" :data="statusDoughnut(category.status)" :options="smallDoughnut" class="chart small-doughnut" />
            </div>
          </div>
        </section>

        <section class="card block">
          <header><h3>Ekipman türleri</h3><small>Tür başına durum ve kontrol zamanı</small></header>
          <Chart type="bar" :data="typeChart" :options="typeOptions" class="chart" :style="{ height: `${Math.max(220, data.types.length * 34 + 70)}px` }" />
          <div class="table-wrap">
            <table>
              <thead><tr><th>Tür</th><th>Kategori</th><th>Toplam</th><th>Uygun</th><th>Uygun değil</th><th>Belirtilmemiş</th><th>Rapor bekleniyor</th><th>Rapor yok</th><th>Süresi geçmiş</th><th>60 gün içinde</th><th class="bar-col">Uygun oranı</th></tr></thead>
              <tbody>
                <tr v-for="type in data.types" :key="type.type_id">
                  <td><strong>{{ type.name }}</strong></td>
                  <td class="muted">{{ type.category }}</td>
                  <td><strong>{{ type.total }}</strong></td>
                  <td class="ok-text">{{ type.status.uygun || '—' }}</td>
                  <td class="bad-text">{{ type.status.uygun_degil || '—' }}</td>
                  <td>{{ type.status.belirtilmemis || '—' }}</td>
                  <td>{{ type.status.rapor_bekleniyor || '—' }}</td>
                  <td>{{ type.status.rapor_yok || '—' }}</td>
                  <td class="bad-text">{{ type.overdue || '—' }}</td>
                  <td class="warn-text">{{ type.upcoming || '—' }}</td>
                  <!-- Yüzde kaçı uygun: ilerleme çubuğu ve oran (%90+ yeşil, %70+ turuncu, altı kırmızı) -->
                  <td class="bar-col">
                    <div class="ratio">
                      <div class="ratio-bar"><i :class="levelOf(shareOf(type.status.uygun, type.total))" :style="{ width: `${shareOf(type.status.uygun, type.total)}%` }" /></div>
                      <strong :class="levelOf(shareOf(type.status.uygun, type.total))">%{{ percentText(shareOf(type.status.uygun, type.total)) }}</strong>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="card block">
          <header><h3>Lokasyonlar</h3><small>En sorunlu üstte</small></header>
          <ExpertLocationStatusTable :locations="data.locations" />
        </section>

        <section class="card block">
          <header><h3>Sorunlu ekipmanlar <span class="count">{{ data.problems.length }}</span></h3><small>Kontrol süresi geçmiş ya da son kontrolü uygun olmayan</small></header>
          <p v-if="!data.problems.length" class="muted">Sorunlu ekipman yok.</p>
          <ExpertEquipmentDueTable v-else :items="data.problems" :limit="printing ? 0 : 100" />
        </section>
      </template>

      <!-- Tesisat bazında -->
      <template v-else>
        <div v-if="!data.installations.length" class="card state">Bu kapsamda tesisat yok.</div>
        <section v-for="installation in data.installations" :key="installation.id" class="card block installation">
          <header class="installation-head">
            <div>
              <h3>{{ installation.name }}</h3>
              <small>{{ locationLabel(installation.location?.id, installation.location?.name) }}<template v-if="installation.workplace"> · {{ installation.workplace.company_name }}</template></small>
            </div>
            <span class="status-pill" :class="installation.status">{{ INSTALLATION_STATUS[installation.status] || installation.status }}</span>
          </header>
          <div class="info-strip">
            <div><small>Son kontrol</small><strong>{{ formatDate(installation.last_control_date) }}</strong></div>
            <div><small>Geçerlilik</small><strong>{{ formatDate(installation.next_control_date) }}</strong></div>
            <div><small>Kalan gün</small><strong :class="daysKey(installation.days_left)">{{ daysText(installation.days_left) }}</strong></div>
            <div><small>Rapor no</small><strong>{{ installation.report_no || '—' }}</strong></div>
            <div><small>Kontrolü yapan</small><strong>{{ installation.inspection_body || '—' }}</strong></div>
          </div>
          <div class="installation-grid">
            <div>
              <h4>Sistemlerin durumu</h4>
              <Chart type="doughnut" :data="systemsDoughnut(installation)" :options="smallDoughnut" class="chart small-doughnut" />
            </div>
            <div>
              <h4>Sistemlerdeki ekipmanlar</h4>
              <Chart type="bar" :data="systemEquipmentChart(installation)" :options="typeOptions" class="chart" :style="{ height: `${Math.max(180, equipmentSystems(installation).length * 34 + 70)}px` }" />
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Sistem</th><th>Durum</th><th>Ekipman</th><th>Uygun</th><th>Uygun değil</th><th>Belirtilmemiş</th><th>Bulgu</th></tr></thead>
              <tbody>
                <template v-for="system in installation.systems" :key="system.name">
                  <tr>
                    <td><strong>{{ system.name }}</strong></td>
                    <td><span class="status-badge" :class="system.status">{{ INSTALLATION_STATUS[system.status] || statusText[system.status] || system.status }}</span></td>
                    <td>{{ system.equipment_total || '—' }}</td>
                    <td class="ok-text">{{ system.equipment_status.uygun || '—' }}</td>
                    <td class="bad-text">{{ system.equipment_status.uygun_degil || '—' }}</td>
                    <td>{{ system.equipment_status.belirtilmemis || '—' }}</td>
                    <td>{{ system.findings.length || '—' }}</td>
                  </tr>
                  <tr v-if="system.findings.length" class="findings-row">
                    <td colspan="7"><ol><li v-for="(finding, index) in system.findings" :key="index">{{ finding }}</li></ol></td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
          <template v-if="installation.general_findings?.length">
            <h4>Genel bulgular</h4>
            <ol class="general-findings"><li v-for="(finding, index) in installation.general_findings" :key="index">{{ finding }}</li></ol>
          </template>
        </section>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
// Durum Raporu: ekipman bazında (kategori, tür, lokasyon, sorunlu ekipmanlar) ve tesisat bazında (sistemler, ekipmanları,
// bulgular); kapsam Genel Bakış ile aynı filtre (tüm lokasyonlar → müşteri → lokasyon → işyeri). Yazdırılabilir.
definePageMeta({ layout: 'expert', middleware: 'expert' })

const INSTALLATION_STATUS: Record<string, string> = { uygun: 'Uygun', uygun_degil: 'Uygun değil', rapor_bekleniyor: 'Rapor bekleniyor', rapor_yok: 'Kontrol yok', belirtilmemis: 'Belirtilmemiş' }
const statusText = STATUS_TEXT

const { get, errorMessage } = useExpertApi()
const { groups, load, query, scopeLabel, locationLabel } = useDashboardScope()

const tab = ref<'equipment' | 'installations'>('equipment')
const data = ref<any>(null)
const loading = ref(false)
const error = ref('')
const printing = ref(false)
const today = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long' }).format(new Date())

const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('tr-TR').format(new Date(value)) : '—'
const daysText = (days: number | null) => days === null || days === undefined ? '—' : days < 0 ? `${-days} gün geçti` : days === 0 ? 'Bugün' : `${days} gün`
const daysKey = (days: number | null) => days === null || days === undefined ? '' : days < 0 ? 'bad-text' : days <= 60 ? 'warn-text' : ''
// Yüzde kaçı uygun (Genel Bakış'taki gibi): tek haneli, aşağı yuvarlanmış; renk eşikleri %90 / %70.
const shareOf = (value: number, total: number) => total ? Math.floor((value / total) * 1000) / 10 : 0
const percentText = (value: number) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(value)
const levelOf = (value: number) => value >= 90 ? 'ok' : value >= 70 ? 'warn' : 'bad'
const percent = (value: number) => data.value?.totals.equipment ? `%${Math.round((value / data.value.totals.equipment) * 100)}` : '—'

// Grafik ayarları temaya bağlı: açık / koyu değişince renkler yeniden okunur.
const themeKey = useChartThemeKey()
const smallDoughnut = computed(() => {
  void themeKey.value
  const options: any = doughnutOptions()
  options.plugins.legend.position = 'bottom'
  options.plugins.legend.labels.padding = 8
  options.plugins.legend.labels.font = { size: 11 }
  return options
})
const statusDoughnut = (status: Record<string, number>) => ({
  labels: STATUS_KEYS.map(key => STATUS_TEXT[key]),
  datasets: [{ data: STATUS_KEYS.map(key => status[key] || 0), backgroundColor: STATUS_KEYS.map(key => STATUS_COLORS[key]), borderWidth: 0 }]
})
const typeChart = computed(() => ({
  labels: (data.value?.types || []).map((item: any) => item.name),
  datasets: STATUS_KEYS.map(key => ({ label: STATUS_TEXT[key], data: data.value.types.map((item: any) => item.status[key]), backgroundColor: STATUS_COLORS[key], borderRadius: 3 }))
}))
const typeOptions = computed(() => { void themeKey.value; return barOptions({ horizontal: true }) })

// Tesisat: sistemlerin durum dağılımı ve ekipmanı olan sistemlerde ekipmanların durumu.
const systemsDoughnut = (installation: any) => {
  const keys = ['uygun', 'uygun_degil', 'belirtilmemis', 'rapor_yok']
  return {
    labels: keys.map(key => key === 'rapor_yok' ? 'Kontrol yok' : STATUS_TEXT[key]),
    datasets: [{ data: keys.map(key => installation.systems.filter((system: any) => system.status === key).length), backgroundColor: keys.map(key => STATUS_COLORS[key]), borderWidth: 0 }]
  }
}
const equipmentSystems = (installation: any) => installation.systems.filter((system: any) => system.equipment_total)
const systemEquipmentChart = (installation: any) => ({
  labels: equipmentSystems(installation).map((system: any) => system.name),
  datasets: STATUS_KEYS.map(key => ({ label: STATUS_TEXT[key], data: equipmentSystems(installation).map((system: any) => system.equipment_status[key]), backgroundColor: STATUS_COLORS[key], borderRadius: 3 }))
})

// Yazdırma: sorunlu ekipman listesinin tamamı basılır.
const print = async () => {
  printing.value = true
  await nextTick()
  window.print()
  printing.value = false
}

// Aynı kapsam için ikinci istek atılmaz (açılışta işyerleri yüklenince filtre de değişir).
let lastKey = ''
const loadData = async () => {
  if (!groups.value.length) { data.value = null; return }
  const key = JSON.stringify(query.value)
  if (key === lastKey) return
  lastKey = key
  loading.value = true
  error.value = ''
  try { data.value = await get('/pk-dashboard/report', query.value) }
  catch (e: any) { lastKey = ''; error.value = errorMessage(e, 'Rapor alınamadı.') }
  finally { loading.value = false }
}

watch(query, loadData, { deep: true })
onMounted(async () => {
  await load()
  loadData()
})
</script>

<style scoped>
.report-page{max-width:1500px;margin:0 auto;display:grid;gap:16px}
.page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap}
.breadcrumb{display:flex;align-items:center;gap:8px;margin-bottom:10px;color:var(--admin-muted);font-size:12px}.breadcrumb strong{color:var(--admin-heading)}
h1{margin:0;color:var(--admin-heading);font-size:28px;letter-spacing:-.6px}.page-head p{margin:7px 0 0;color:var(--admin-muted);font-size:13px}
.head-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.primary-button{display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 15px;border:0;border-radius:8px;background:var(--pk-yellow);color:#111827;font-size:13px;font-weight:800;cursor:pointer}.primary-button:disabled{opacity:.55}
.tabs{display:flex;gap:4px;border-bottom:1px solid var(--admin-border)}
.tabs button{display:inline-flex;align-items:center;gap:7px;padding:10px 13px;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;background:none;color:var(--admin-muted);font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.tabs button:hover{color:var(--admin-heading)}.tabs button.active{color:var(--admin-heading);border-bottom-color:var(--pk-yellow)}
.count{padding:1px 7px;border-radius:999px;background:var(--admin-chip);color:var(--admin-muted);font-size:11px}
.card{background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px;min-width:0}
.state{display:flex;align-items:center;justify-content:center;gap:8px;padding:60px 20px;color:var(--admin-muted);font-size:13px}
.kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
.kpi{display:flex;flex-direction:column;gap:6px;padding:16px;background:var(--admin-card);border:1px solid var(--admin-border);border-left:4px solid var(--admin-border);border-radius:12px}
.kpi span{color:var(--admin-muted);font-size:12px;font-weight:700}.kpi strong{color:var(--admin-heading);font-size:26px;line-height:1}.kpi small{color:var(--admin-muted);font-size:11px}
.kpi.ok{border-left-color:#16a34a}.kpi.warn{border-left-color:#facc15}.kpi.bad{border-left-color:var(--admin-danger-text)}
.block{padding:16px 18px}
.block header{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px}
h3{margin:0;color:var(--admin-heading);font-size:15px}header small{color:var(--admin-muted);font-size:12px}
h4{margin:14px 0 8px;color:var(--admin-heading);font-size:12px}
.chart{position:relative;width:100%}.small-doughnut{height:230px}
.category-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
.category{display:flex;flex-direction:column;gap:4px;padding:12px;border:1px solid var(--admin-border);border-radius:10px}.category strong{color:var(--admin-heading);font-size:13px}.category small{color:var(--admin-muted);font-size:11px}
.table-wrap{overflow:auto;margin-top:12px}
table{width:100%;border-collapse:collapse}th,td{padding:9px 12px;text-align:left;border-bottom:1px solid var(--admin-row-border);font-size:12px;color:var(--admin-text);vertical-align:top}
th{font-size:11px;font-weight:700;color:var(--admin-muted);background:var(--admin-soft);white-space:nowrap}
td strong{color:var(--admin-heading)}
tr.clickable{cursor:pointer}tr.clickable:hover{background:var(--admin-hover)}
.ok-text{color:var(--admin-success-text);font-weight:700}.bad-text{color:var(--admin-danger-text);font-weight:700}.warn-text{color:var(--admin-warning-text);font-weight:700}.muted{margin:0;color:var(--admin-muted);font-size:12px}
.bar-col{width:180px}
.ratio{display:flex;align-items:center;gap:8px}
.ratio-bar{flex:1;height:8px;border-radius:999px;overflow:hidden;background:var(--admin-chip)}.ratio-bar i{display:block;height:100%;border-radius:999px}
.ratio-bar i.ok{background:#16a34a}.ratio-bar i.warn{background:#d97706}.ratio-bar i.bad{background:#dc2626}
.ratio strong{min-width:44px;text-align:right;font-size:12px}.ratio strong.ok{color:#16a34a}.ratio strong.warn{color:#d97706}.ratio strong.bad{color:#dc2626}
.installation-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.installation-head small{display:block;margin-top:4px}
.status-pill,.status-badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:800;white-space:nowrap;background:var(--admin-chip);color:var(--admin-muted)}.status-badge{padding:3px 10px;font-size:11px}
.status-pill.uygun,.status-badge.uygun{background:var(--admin-success-bg);color:var(--admin-success-text)}.status-pill.uygun_degil,.status-badge.uygun_degil{background:var(--admin-danger-bg);color:var(--admin-danger-text)}.status-pill.rapor_bekleniyor{background:var(--admin-warning-bg);color:var(--admin-warning-text)}
.info-strip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;margin-bottom:6px;border:1px solid var(--admin-border);border-radius:10px;overflow:hidden;background:var(--admin-border)}
.info-strip > div{display:flex;flex-direction:column;gap:4px;padding:10px 12px;background:var(--admin-card)}.info-strip small{color:var(--admin-muted);font-size:11px}.info-strip strong{color:var(--admin-heading);font-size:13px;overflow-wrap:anywhere}
.installation-grid{display:grid;grid-template-columns:minmax(240px,1fr) 2fr;gap:16px}
.findings-row td{background:var(--admin-soft)}.findings-row ol,.general-findings{display:grid;gap:4px;margin:0;padding-left:20px;color:var(--admin-text);font-size:12px;line-height:1.45}
.error-text{color:var(--admin-danger-text)}
@media(max-width:1100px){.kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.installation-grid{grid-template-columns:1fr}.info-strip{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>

<!-- Yazdırma: menü, üst çubuk, filtreler ve sekmeler basılmaz; kartlar sayfa ortasında bölünmez. -->
<style>
@media print {
  .expert-sidebar, .expert-topbar, .no-print { display: none !important; }
  .page-content { padding: 0 !important; }
  .report-page .card { break-inside: avoid; box-shadow: none; }
  .report-page .table-wrap { overflow: visible; }
  body { background: #fff; }
}
</style>
