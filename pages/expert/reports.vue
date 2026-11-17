<template>
  <div class="report-page">
    <!-- Durum raporu (tasarım kataloğu 09 / 10): sayfa yolu, başlık, PDF indir ve Yazdır -->
    <div class="page-head">
      <div>
        <nav class="crumb no-print" aria-label="Sayfa yolu"><PkIcon class="pi pi-home" aria-hidden="true" /><span>Raporlar</span><span class="sep">/</span><strong>Durum raporu</strong></nav>
        <h1>Durum raporu</h1>
        <p>{{ scopeLabel }} · {{ today }}</p>
      </div>
      <!-- İkisi de tarayıcının yazdırma penceresini açar; PDF, pencerede "PDF olarak kaydet" ile alınır (ayrı PDF ucu yok) -->
      <div class="head-actions no-print">
        <button class="primary-button" type="button" :disabled="!data" @click="print"><PkIcon class="pi pi-download" /> PDF indir</button>
        <button class="outline-button" type="button" :disabled="!data" @click="print"><PkIcon class="pi pi-print" /> Yazdır</button>
      </div>
    </div>

    <div class="segment no-print" role="tablist">
      <button type="button" role="tab" :aria-selected="tab === 'equipment'" :class="{ active: tab === 'equipment' }" @click="tab = 'equipment'">Ekipman bazında</button>
      <button type="button" role="tab" :aria-selected="tab === 'installations'" :class="{ active: tab === 'installations' }" @click="tab = 'installations'">Tesisat bazında</button>
    </div>

    <div v-if="loading && !data" class="card state"><PkIcon class="pi pi-spin pi-spinner" /> Rapor hazırlanıyor...</div>
    <div v-else-if="error" class="card state error-text">{{ error }}</div>

    <template v-else-if="data">
      <div v-if="SHOW_LEGACY_KPIS" class="kpis">
        <div class="kpi"><span>Aktif ekipman</span><strong>{{ data.totals.equipment }}</strong><small v-if="data.totals.passive">{{ data.totals.passive }} pasif ayrıca</small></div>
        <div class="kpi ok"><span>Uygun</span><strong>{{ data.status.uygun }}</strong><small>{{ percent(data.status.uygun) }}</small></div>
        <div class="kpi bad"><span>Uygun değil</span><strong>{{ data.status.uygun_degil }}</strong><small>{{ percent(data.status.uygun_degil) }}</small></div>
        <div class="kpi bad"><span>Süresi geçmiş</span><strong>{{ data.totals.overdue }}</strong><small>{{ percent(data.totals.overdue) }}</small></div>
        <div class="kpi warn"><span>60 gün içinde</span><strong>{{ data.totals.upcoming }}</strong><small>{{ percent(data.totals.upcoming) }}</small></div>
      </div>

      <!-- Ekipman bazında: kapsam, kontrol sonucu ve süre durumu; altta kategoriler -->
      <template v-if="tab === 'equipment'">
        <div class="top">
          <section class="card scope-card">
            <h2>Kapsam</h2>
            <dl class="facts">
              <div><dt><PkIcon class="pi pi-building" aria-hidden="true" /> {{ topLabel }}</dt><dd>{{ organizationName }}</dd></div>
              <div><dt><PkIcon class="pi pi-map-marker" aria-hidden="true" /> Lokasyon</dt><dd>{{ locationName }}</dd></div>
              <div><dt><PkIcon class="pi pi-calendar" aria-hidden="true" /> Rapor tarihi</dt><dd>{{ formatDate(reportDate) }}</dd></div>
            </dl>
            <span class="scope-chip"><PkIcon class="pi pi-box" aria-hidden="true" /> {{ data.totals.equipment }} ekipman</span>
          </section>
          <div class="top-right">
            <section class="card bar-card">
              <header><PkIcon class="pi pi-verified" aria-hidden="true" /><h3>Kontrol sonucu</h3></header>
              <div class="stack" role="img" :aria-label="segmentsText(resultSegments)">
                <span v-for="segment in resultSegments.filter(item => item.value)" :key="segment.key" :class="segment.key" :style="{ flexGrow: segment.value }">{{ segment.value }}</span>
              </div>
              <ul class="legend">
                <li v-for="segment in resultSegments" :key="segment.key"><i :class="segment.key" aria-hidden="true" /> {{ segment.label }} <strong>{{ segment.value }}</strong></li>
              </ul>
            </section>
            <section class="card bar-card">
              <header><PkIcon class="pi pi-clock" aria-hidden="true" /><h3>Süre durumu</h3></header>
              <div class="stack" role="img" :aria-label="segmentsText(timeSegments)">
                <span v-for="segment in timeSegments.filter(item => item.value)" :key="segment.key" :class="segment.key" :style="{ flexGrow: segment.value }">{{ segment.value }}</span>
              </div>
              <ul class="legend">
                <li v-for="segment in timeSegments" :key="segment.key"><i :class="segment.key" aria-hidden="true" /> {{ segment.label }} <strong>{{ segment.value }}</strong></li>
              </ul>
              <p class="note"><PkIcon class="pi pi-info-circle" aria-hidden="true" /> Kontrol sonucu ve süre ayrı değerlendirilir.</p>
            </section>
          </div>
        </div>

        <section class="card table-card">
          <header class="table-head"><PkIcon class="pi pi-clone" aria-hidden="true" /><h3>Kategorilere göre durum</h3></header>
          <p v-if="!data.categories.length" class="muted pad">Ekipman yok.</p>
          <div v-else class="table-wrap">
            <table class="pill-table">
              <thead><tr><th>Kategori</th><th>Toplam</th><th>Uygun</th><th>Uygun değil</th><th>Belirtilmemiş</th><th v-for="[key, label] in categoryExtraStatus" :key="key">{{ label }}</th><th>Süresi geçen</th><th>Yaklaşan</th></tr></thead>
              <tbody>
                <tr v-for="category in data.categories" :key="category.slug">
                  <td><span class="category-cell"><PkIcon :class="['pi', categoryIcons[category.slug] || 'pi-box']" aria-hidden="true" /> {{ category.name }}</span></td>
                  <td><span class="num total">{{ category.total }}</span></td>
                  <td><span class="num uygun">{{ category.status.uygun || 0 }}</span></td>
                  <td><span class="num uygun_degil">{{ category.status.uygun_degil || 0 }}</span></td>
                  <td><span class="num belirtilmemis">{{ category.status.belirtilmemis || 0 }}</span></td>
                  <td v-for="[key] in categoryExtraStatus" :key="key"><span class="num" :class="key">{{ category.status[key] || 0 }}</span></td>
                  <td><span class="num overdue">{{ category.overdue }}</span></td>
                  <td><span class="num upcoming">{{ category.upcoming }}</span></td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td>Toplam</td>
                  <td><span class="num total">{{ data.totals.equipment }}</span></td>
                  <td><span class="num uygun">{{ data.status.uygun || 0 }}</span></td>
                  <td><span class="num uygun_degil">{{ data.status.uygun_degil || 0 }}</span></td>
                  <td><span class="num belirtilmemis">{{ data.status.belirtilmemis || 0 }}</span></td>
                  <td v-for="[key] in categoryExtraStatus" :key="key"><span class="num" :class="key">{{ data.status[key] || 0 }}</span></td>
                  <td><span class="num overdue">{{ data.totals.overdue }}</span></td>
                  <td><span class="num upcoming">{{ data.totals.upcoming }}</span></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p class="scope-note"><PkIcon class="pi pi-info-circle" aria-hidden="true" /> Rapor kapsamı: Ekipmanlar</p>
        </section>

        <template v-if="SHOW_LEGACY_EQUIPMENT">
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
              <thead><tr><th>Tür</th><th>Kategori</th><th>Toplam</th><th>Uygun</th><th>Uygun değil</th><th v-for="[key, label] in optionalStatus" :key="key">{{ label }}</th><th>Süresi geçmiş</th><th>60 gün içinde</th><th class="bar-col">Uygun oranı</th></tr></thead>
              <tbody>
                <tr v-for="type in data.types" :key="type.type_id">
                  <td><strong>{{ type.name }}</strong></td>
                  <td class="muted">{{ type.category }}</td>
                  <td><strong>{{ type.total }}</strong></td>
                  <td class="ok-text">{{ type.status.uygun || '—' }}</td>
                  <td class="bad-text">{{ type.status.uygun_degil || '—' }}</td>
                  <td v-for="[key] in optionalStatus" :key="key">{{ type.status[key] || '—' }}</td>
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
      </template>

      <!-- Tesisat bazında (tasarım kataloğu 10): sayılar, her tesisat için durum kartı ve sistemler, altta kontrol raporu tablosu -->
      <template v-else>
        <div class="inst-kpis">
          <NuxtLink to="/expert/installations" class="kpi-card blue">
            <span class="kpi-icon"><PkIcon class="pi pi-clone" /></span>
            <span class="kpi-text"><strong>{{ data.installations.length }}</strong><small>Toplam tesisat</small></span>
            <PkIcon class="pi pi-angle-right kpi-arrow" aria-hidden="true" />
          </NuxtLink>
          <NuxtLink to="/expert/installations" class="kpi-card bad">
            <span class="kpi-icon"><PkIcon class="pi pi-exclamation-triangle" /></span>
            <span class="kpi-text"><strong>{{ installationCount('uygun_degil') }}</strong><small>Uygun değil</small></span>
            <PkIcon class="pi pi-angle-right kpi-arrow" aria-hidden="true" />
          </NuxtLink>
          <NuxtLink to="/expert/installations" class="kpi-card warn">
            <span class="kpi-icon"><PkIcon class="pi pi-calendar" /></span>
            <span class="kpi-text"><strong>{{ overdueInstallations }}</strong><small>Süresi geçen</small></span>
            <PkIcon class="pi pi-angle-right kpi-arrow" aria-hidden="true" />
          </NuxtLink>
          <NuxtLink to="/expert/bulgu-takip" class="kpi-card blue">
            <span class="kpi-icon"><PkIcon class="pi pi-file" /></span>
            <span class="kpi-text"><strong>{{ openFindings }}</strong><small>Açık bulgu</small></span>
            <PkIcon class="pi pi-angle-right kpi-arrow" aria-hidden="true" />
          </NuxtLink>
        </div>

        <div v-if="!data.installations.length" class="card state">Bu kapsamda tesisat yok.</div>
        <div v-for="installation in data.installations" :key="installation.id" class="inst-row">
          <section class="card inst-card">
            <header>
              <h2>{{ installation.type?.name || installation.name }}</h2>
              <span class="status-pill" :class="installation.status"><PkIcon :class="STATUS_ICONS[installation.status]" aria-hidden="true" /> {{ INSTALLATION_STATUS[installation.status] || installation.status }}</span>
              <span v-if="installation.status !== 'rapor_yok' && dueShort(installation.days_left)" class="due-chip" :class="dueKey(installation.days_left)"><PkIcon class="pi pi-calendar" aria-hidden="true" /> {{ dueShort(installation.days_left) }}</span>
            </header>
            <!-- Kaydın adı (bina) türden farklıysa, lokasyon ve işyeri: birden çok tesisatta hangisi olduğu belli olsun -->
            <p class="place-line"><template v-if="installation.type?.name && installation.name !== installation.type.name">{{ installation.name }} · </template>{{ locationLabel(installation.location?.id, installation.location?.name) }}<template v-if="installation.workplace"> · {{ workplaceLabel(installation.workplace.id, installation.workplace.company_name) }}</template></p>
            <div class="date-strip">
              <span><PkIcon class="pi pi-calendar" aria-hidden="true" /> Son kontrol <strong>{{ formatDate(installation.last_control_date) }}</strong></span>
              <span><PkIcon class="pi pi-calendar" aria-hidden="true" /> Geçerlilik <strong>{{ formatDate(installation.next_control_date) }}</strong></span>
            </div>
          </section>
          <section class="card systems-side">
            <h3>Sistemlerin durumu</h3>
            <ul v-if="physicalSystems(installation).length" class="row-list">
              <li v-for="system in physicalSystems(installation)" :key="system.name">
                <NuxtLink :to="`/expert/installations?tesisat=${installation.id}`" class="list-row">
                  <PkIcon class="pi pi-th-large row-icon" aria-hidden="true" /><span class="row-name">{{ system.name }}</span>
                  <span class="status-badge" :class="system.status"><PkIcon :class="STATUS_ICONS[system.status]" aria-hidden="true" /> {{ INSTALLATION_STATUS[system.status] || system.status }}</span>
                  <PkIcon class="pi pi-angle-right" aria-hidden="true" />
                </NuxtLink>
              </li>
            </ul>
            <p v-else class="muted">Henüz sistem yok.</p>
            <template v-if="documentChecks(installation).length">
              <h3>Belge ve proje kontrolleri</h3>
              <ul class="row-list">
                <li v-for="system in documentChecks(installation)" :key="system.name">
                  <NuxtLink :to="`/expert/installations?tesisat=${installation.id}`" class="list-row">
                    <PkIcon class="pi pi-file row-icon" aria-hidden="true" /><span class="row-name">{{ system.name }}</span>
                    <span class="status-badge" :class="system.status"><PkIcon :class="STATUS_ICONS[system.status]" aria-hidden="true" /> {{ INSTALLATION_STATUS[system.status] || system.status }}</span>
                    <PkIcon class="pi pi-angle-right" aria-hidden="true" />
                  </NuxtLink>
                </li>
              </ul>
            </template>
            <NuxtLink to="/expert/bulgu-takip" class="primary-button wide no-print">İlgili bulguları aç <PkIcon class="pi pi-arrow-right" aria-hidden="true" /></NuxtLink>
          </section>
        </div>

        <section v-if="data.installations.length" class="card table-card">
          <header class="table-head"><h3>Kontrol raporu</h3></header>
          <div class="table-wrap">
            <table class="report-table">
              <thead><tr><th>Tesisat</th><th>Kontrol kuruluşu</th><th>Rapor no</th><th>Son kontrol</th><th>Geçerlilik</th><th>Sonuç</th></tr></thead>
              <tbody>
                <tr v-for="installation in data.installations" :key="installation.id">
                  <td><strong>{{ installation.type?.name || installation.name }}</strong><small v-if="installation.type?.name && installation.name !== installation.type.name"> · {{ installation.name }}</small></td>
                  <td>{{ installation.inspection_body || '—' }}</td>
                  <td>{{ installation.report_no || '—' }}</td>
                  <td>{{ formatDate(installation.last_control_date) }}</td>
                  <td>{{ formatDate(installation.next_control_date) }}</td>
                  <td><span class="status-badge" :class="installation.status"><PkIcon :class="STATUS_ICONS[installation.status]" aria-hidden="true" /> {{ INSTALLATION_STATUS[installation.status] || installation.status }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <p class="scope-foot">Rapor kapsamı: Tesisatlar</p>

        <template v-if="SHOW_LEGACY_INSTALLATIONS">
        <section v-for="installation in data.installations" :key="installation.id" class="card block installation">
          <header class="installation-head">
            <div>
              <!-- Başlık tesisatın türü; kaydın adı (bina) türden farklıysa altta -->
              <h3>{{ installation.type?.name || installation.name }}</h3>
              <small><template v-if="installation.type?.name && installation.name !== installation.type.name">{{ installation.name }} · </template>{{ locationLabel(installation.location?.id, installation.location?.name) }}<template v-if="installation.workplace"> · {{ workplaceLabel(installation.workplace.id, installation.workplace.company_name) }}</template></small>
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
    </template>
  </div>
</template>

<script setup lang="ts">
// Durum Raporu: ekipman bazında (kategori, tür, lokasyon, sorunlu ekipmanlar) ve tesisat bazında (sistemler, ekipmanları,
// bulgular); kapsam Genel Bakış ile aynı filtre (tüm lokasyonlar → müşteri → lokasyon → işyeri). Yazdırılabilir.
// Kapsam üstteki lokasyon / firma menüsünden; bu sayfada menüde "Tüm lokasyonlar" da seçilebilir (dashboardScope).
definePageMeta({ layout: 'expert', middleware: 'expert', dashboardScope: true })

// Tasarım kataloğu 09 / 10'da olmayan öğeler: katalogda yok, gizli; ileride açılabilir (kod ve veri yerinde).
const SHOW_LEGACY_KPIS = false // Üstteki beş sayı kartı (Aktif ekipman, Uygun, Uygun değil, Süresi geçmiş, 60 gün içinde)
const SHOW_LEGACY_EQUIPMENT = false // Ekipman bazında: kategori halkaları, Ekipman türleri grafiği ve tablosu, Lokasyonlar, Sorunlu ekipmanlar
const SHOW_LEGACY_INSTALLATIONS = false // Tesisat bazında: bilgi şeridi, sistem halkası ve ekipman grafiği, sistemler tablosu ve bulguları, genel bulgular

// Ekipman türleri tablosu: Belirtilmemiş / Rapor bekleniyor / Rapor yok sütunu hiçbir satırda değeri yoksa gösterilmez (veri gelince görünür).
const OPTIONAL_STATUS = [['belirtilmemis', 'Belirtilmemiş'], ['rapor_bekleniyor', 'Rapor bekleniyor'], ['rapor_yok', 'Rapor yok']] as const
const optionalStatus = computed(() => OPTIONAL_STATUS.filter(([key]) => (data.value?.types || []).some((type: any) => type.status?.[key])))
// Kategoriler tablosu ve Kontrol sonucu: katalogdaki Uygun / Uygun değil / Belirtilmemiş; Rapor bekleniyor ve Rapor yok değeri varsa ayrıca.
const EXTRA_STATUS = [['rapor_bekleniyor', 'Rapor bekleniyor'], ['rapor_yok', 'Rapor yok']] as const
const categoryExtraStatus = computed(() => EXTRA_STATUS.filter(([key]) => data.value?.status?.[key]))

const INSTALLATION_STATUS: Record<string, string> = { uygun: 'Uygun', uygun_degil: 'Uygun değil', rapor_bekleniyor: 'Rapor bekleniyor', rapor_yok: 'Kontrol yok', belirtilmemis: 'Belirtilmemiş' }
const STATUS_ICONS: Record<string, string> = { uygun: 'pi pi-check', uygun_degil: 'pi pi-exclamation-triangle', rapor_bekleniyor: 'pi pi-hourglass', rapor_yok: 'pi pi-clock', belirtilmemis: 'pi pi-question-circle' }
const statusText = STATUS_TEXT

// Tesisat bazında sayılar: tesisat, uygun değil, süresi geçen, açık bulgu (son kontrollerin sistem ve genel bulguları).
const installationCount = (status: string) => (data.value?.installations || []).filter((item: any) => item.status === status).length
const overdueInstallations = computed(() => (data.value?.installations || []).filter((item: any) => item.days_left !== null && item.days_left < 0).length)
const openFindings = computed(() => (data.value?.installations || []).reduce((sum: number, item: any) =>
  sum + item.systems.reduce((count: number, system: any) => count + system.findings.length, 0) + (item.general_findings?.length || 0), 0))
// Sistemler ve belge / proje kontrolleri (Tesisat detayındaki gibi); Tesis Özellikleri durumu olmayan bilgi kartı, listede yok.
const FACILITY_SYSTEM_NAME = 'Tesis Özellikleri'
const physicalSystems = (installation: any) => installation.systems.filter((system: any) => !system.card)
const documentChecks = (installation: any) => installation.systems.filter((system: any) => system.card && system.name !== FACILITY_SYSTEM_NAME)
// Durum kartındaki kısa yazı (katalogdaki "126 gün geçti") ve rengi
const dueShort = (days: number | null) => days === null || days === undefined ? '' : days < 0 ? `${-days} gün geçti` : days === 0 ? 'Bugün doluyor' : `${days} gün kaldı`
const dueKey = (days: number) => days < 0 ? 'overdue' : days <= 60 ? 'soon' : 'ok'

const { get, errorMessage } = useExpertApi()
const { groups, load, query, scopeLabel, locationLabel, locationId, locations } = useDashboardScope()
const { load: loadNames, workplaceLabel } = useWorkplaceNames()
const { label: organizationLabel } = useOrganizationScope()

const tab = ref<'equipment' | 'installations'>('equipment')
const data = ref<any>(null)
const loading = ref(false)
const error = ref('')
const printing = ref(false)
const reportDate = new Date().toISOString()
const today = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long' }).format(new Date())

// Kapsam kartı: üstteki Organizasyon seçimi (yoksa lokasyonun müşterisi) ve lokasyon.
const { topLabel } = useAccount()
const topAll = computed(() => ({ Müşteri: 'Tüm müşteriler', Kurum: 'Tüm kurumlar' } as Record<string, string>)[topLabel.value] || 'Tüm ana firmalar')
const organizationName = computed(() => organizationLabel.value
  || (locationId.value ? groups.value.find(group => group.location_id === locationId.value)?.customer_name : '')
  || (locationId.value ? '—' : topAll.value))
const locationName = computed(() => locationId.value ? locationLabel(locationId.value) : `Tüm lokasyonlar (${locations.value.length})`)
// Kategori simgeleri Ekipmanlar'daki sekmelerle aynı (ekipman kataloğundan).
const categoryIcons = ref<Record<string, string>>({})

// Kontrol sonucu ve Süre durumu çubukları (sayı sıfırsa çubukta parça yok, açıklamada 0).
const resultSegments = computed(() => [
  ...(['uygun', 'uygun_degil', 'belirtilmemis'] as const).map(key => ({ key, label: STATUS_TEXT[key], value: data.value?.status?.[key] || 0 })),
  ...categoryExtraStatus.value.map(([key, label]) => ({ key, label, value: data.value.status[key] }))
])
const timeSegments = computed(() => [
  { key: 'overdue', label: 'Geçmiş', value: data.value?.totals.overdue || 0 },
  { key: 'upcoming', label: 'Yaklaşan', value: data.value?.totals.upcoming || 0 }
])
const segmentsText = (segments: { label: string; value: number }[]) => segments.map(item => `${item.label} ${item.value}`).join(', ')

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
  loadNames()
  get<any[]>('/equipment-catalog').then(list => {
    categoryIcons.value = Object.fromEntries(list.filter(item => item.icon).map(item => [item.slug, item.icon]))
  }).catch(() => {})
  await load()
  loadData()
})
</script>

<style scoped>
.report-page{margin:0 auto;display:grid;gap:24px}
/* Başlık (tasarım kataloğu 09 / 10) */
.page-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap}
.crumb{display:flex;align-items:center;gap:8px;margin-bottom:8px;color:var(--admin-muted);font-size:13px}.crumb strong{color:var(--admin-heading);font-weight:600}.crumb .sep{color:var(--admin-muted)}
h1{margin:0;color:var(--admin-heading);font-size: 24px;font-weight: 700;line-height:1.15;letter-spacing: 0}.page-head p{margin:7px 0 0;color:var(--admin-muted);font-size:15px}
h2{margin:0;color:var(--admin-heading);font-size:17px;font-weight:700}
.head-actions{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding-top:28px}
.primary-button,.outline-button{display:inline-flex;align-items:center;justify-content:center;gap:9px;height:44px;padding:0 20px;border-radius:8px;font:inherit;font-size:14px;font-weight:700;cursor:pointer;text-decoration:none}
.primary-button{border:0;background:var(--pk-accent);color:var(--pk-on-accent);box-shadow:0 8px 16px rgba(var(--pk-accent-rgb),.24)}.primary-button:hover{background:var(--pk-accent-hover)}
.outline-button{border:1px solid rgba(145,158,171,.32);background:var(--admin-card);color:var(--admin-heading)}.outline-button:hover{background:rgba(145,158,171,.08)}
.primary-button:disabled,.outline-button:disabled{opacity:.55;cursor:default}
.segment{display:inline-flex;justify-self:start;gap:4px;padding:4px;border:0;border-radius:10px;background:var(--admin-card);box-shadow:var(--pk-card-shadow)}
.segment button{min-width:200px;height:38px;padding:0 20px;border:0;border-radius:8px;background:none;color:var(--admin-heading);font:inherit;font-size:14px;font-weight:600;cursor:pointer}
.segment button.active{background:var(--pk-accent);color:var(--pk-on-accent);font-weight:700}
/* Ekipman bazında üst sıra: kapsam, iki çubuk kartı yan yana */
.top{display:grid;grid-template-columns:minmax(260px,360px) minmax(0,1fr);gap:24px;align-items:stretch}
.scope-card,.bar-card{display:flex;flex-direction:column;gap:12px;padding:24px}
.facts{display:grid;margin:0}
.facts > div{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px dashed rgba(145,158,171,.24)}
.facts dt{display:flex;align-items:center;gap:12px;color:var(--admin-text);font-size:14px}.facts dt i{color:var(--admin-muted)}
.facts dd{margin:0;color:var(--admin-heading);font-size:14.5px;font-weight:700;text-align:right;overflow-wrap:anywhere}
.scope-chip{display:inline-flex;align-self:flex-start;align-items:center;gap:8px;margin-top:6px;padding:6px 12px;border-radius:8px;background:var(--pk-primary-lighter);color:var(--pk-primary-dark);font-size:14px;font-weight:700}
:global(.dark-theme) .scope-chip{background:var(--admin-accent-soft);color:var(--admin-accent-text)}
.top-right{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;align-items:stretch}
.bar-card header,.table-head{display:flex;align-items:center;gap:10px}.bar-card header i,.table-head i{color:var(--admin-accent-text);font-size:19px}
.bar-card h3,.table-head h3{font-size:17px;font-weight:700}
.stack{display:flex;gap:0;height:30px;border-radius:8px;overflow:hidden;background:var(--admin-chip)}
.stack span{flex:1 1 0;min-width:34px;display:grid;place-items:center;color:var(--admin-heading);font-size:15px;font-weight:800}
.legend{display:flex;flex-wrap:wrap;gap:6px 22px;margin:0;padding:0;list-style:none;color:var(--admin-text);font-size:14px}
.legend li{display:flex;align-items:center;gap:7px}.legend strong{color:var(--admin-heading)}
.legend i{width:10px;height:10px;border-radius:50%}
.note{display:flex;align-items:center;gap:8px;margin:0;color:var(--admin-text);font-size:13.5px}.note i{color:var(--admin-muted)}
/* Çubuk parçaları, açıklama noktaları ve tablodaki sayı hapları: durum renkleri (koyu temada kart zeminiyle karışır) */
.stack .uygun{background:color-mix(in srgb,var(--pk-success) 34%,var(--admin-surface))}
.stack .uygun_degil,.stack .overdue{background:color-mix(in srgb,var(--pk-danger) 34%,var(--admin-surface))}
.stack .belirtilmemis,.stack .rapor_yok{background:color-mix(in srgb,var(--admin-muted) 30%,var(--admin-surface))}
.stack .rapor_bekleniyor,.stack .upcoming{background:color-mix(in srgb,var(--admin-upcoming-text) 42%,var(--admin-surface))}
.legend .uygun{background:var(--pk-success)}.legend .uygun_degil,.legend .overdue{background:var(--pk-danger)}
.legend .belirtilmemis,.legend .rapor_yok{background:var(--admin-muted)}.legend .rapor_bekleniyor,.legend .upcoming{background:var(--admin-upcoming-text)}
/* Kategorilere göre durum */
.table-card{padding:20px 0 16px;overflow:hidden}
.table-card .table-head{padding:0 24px}.table-card .pad{padding:8px 24px}
.pill-table th{padding:12px 14px;border-bottom:0;text-align:center}
.pill-table thead th:first-child{text-align:left;padding-left:66px}
.pill-table td{padding:10px 14px;color:var(--admin-heading);font-size:14px;text-align:center;vertical-align:middle}
.pill-table td:first-child{text-align:left;padding-left:24px}.pill-table th:last-child,.pill-table td:last-child{padding-right:24px}
.pill-table tfoot td{border-bottom:0;background:rgba(145,158,171,.08);font-size:15px;font-weight:700}
.category-cell{display:inline-flex;align-items:center;gap:14px;font-weight:600}.category-cell i{width:28px;color:var(--admin-heading);font-size:20px;text-align:center}
.num{display:inline-block;min-width:52px;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700;background:var(--admin-chip);color:var(--admin-heading)}
tfoot .num{min-width:56px;padding:4px 8px;font-size:13px}
.num.total{background:var(--admin-accent-soft);color:var(--admin-accent-text)}
.num.uygun{background:color-mix(in srgb,var(--pk-success) 18%,var(--admin-surface));color:var(--admin-success-text)}
.num.uygun_degil,.num.overdue{background:color-mix(in srgb,var(--pk-danger) 18%,var(--admin-surface));color:var(--admin-danger-text)}
.num.belirtilmemis,.num.rapor_yok{background:color-mix(in srgb,var(--admin-muted) 18%,var(--admin-surface))}
.num.rapor_bekleniyor,.num.upcoming{background:color-mix(in srgb,var(--admin-upcoming-text) 22%,var(--admin-surface));color:var(--admin-warning-text)}
tfoot .num.total{background:color-mix(in srgb,var(--pk-accent) 16%,var(--admin-surface))}
.scope-note{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin:12px 24px 0;color:var(--admin-text);font-size:14px}.scope-note i{color:var(--admin-muted)}
.pad{padding:8px 0}
/* Tesisat bazında: pastel sayı kutuları (Genel bakıştaki .gb-tile gibi) */
.inst-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px}
.kpi-card{display:flex;align-items:center;gap:16px;min-height:96px;padding:18px 22px;border:0;border-radius:var(--pk-radius);color:inherit;text-decoration:none;transition:transform .15s}
.kpi-card:hover{transform:translateY(-2px)}
.kpi-icon{flex:none;width:48px;height:48px;display:grid;place-items:center;border-radius:50%;background:rgba(255,255,255,.55);font-size:20px}
.kpi-card.blue{background:var(--pk-info-lighter);color:var(--pk-info-dark)}
.kpi-card.bad{background:var(--pk-error-lighter);color:var(--pk-error-dark)}
.kpi-card.warn{background:var(--pk-warning-lighter);color:var(--pk-warning-dark)}
:global(.dark-theme) .kpi-card{background:var(--admin-card)}
.kpi-text{display:grid;gap:2px;min-width:0}.kpi-text strong{font-size:28px;font-weight:700;line-height:1.1}.kpi-text small{font-size:14px;font-weight:700}
.kpi-arrow{margin-left:auto;font-size:15px}
.inst-row{display:grid;grid-template-columns:minmax(300px,1fr) minmax(0,1.6fr);gap:24px;align-items:start}
.inst-card{display:flex;flex-direction:column;padding:24px}
.inst-card header{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px}
.inst-card h2{width:100%}
.inst-card .status-pill,.due-chip{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700}
.due-chip{background:var(--admin-chip);color:var(--admin-text)}
.due-chip.overdue,.due-chip.soon{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.due-chip.ok{background:var(--admin-success-bg);color:var(--admin-success-text)}
.place-line{margin:6px 0 0;color:var(--admin-muted);font-size:13px}
.date-strip{display:grid;gap:0;margin-top:16px;color:var(--admin-text);font-size:14px}
.date-strip span{display:flex;align-items:center;gap:9px;padding:11px 0;border-top:1px dashed rgba(145,158,171,.24)}
.date-strip i{color:var(--admin-muted)}.date-strip strong{margin-left:auto;color:var(--admin-heading);font-weight:700}
.systems-side{display:flex;flex-direction:column;gap:12px;padding:24px}
.systems-side h3{font-size:17px;font-weight:700}.systems-side h3 + .row-list + h3{margin-top:6px}
.row-list{display:grid;margin:0;padding:0;list-style:none}
.row-list li + li{border-top:1px solid rgba(145,158,171,.2)}
.list-row{display:flex;align-items:center;gap:14px;padding:11px 4px;color:var(--admin-heading);font-size:14px;text-decoration:none}
.list-row:hover{background:var(--admin-hover)}
.row-icon{color:var(--admin-accent-text);font-size:18px}.row-name{flex:1;min-width:0}
.list-row .status-badge,.report-table .status-badge{display:inline-flex;align-items:center;gap:6px}
.list-row > .pi-angle-right{color:var(--admin-heading)}
.primary-button.wide{width:100%;margin-top:auto}
.report-table th{padding:12px 16px;border-bottom:0}
.report-table th:first-child,.report-table td:first-child{padding-left:24px}.report-table th:last-child,.report-table td:last-child{padding-right:24px}
.report-table td{padding:14px 16px;color:var(--admin-heading);font-size:14px;vertical-align:middle}.report-table td small{color:var(--admin-muted);font-size:13px}
.report-table tbody tr:last-child td{border-bottom:0}
.status-badge.belirtilmemis,.status-badge.rapor_yok,.status-pill.belirtilmemis,.status-pill.rapor_yok{background:var(--admin-chip);color:var(--admin-text)}
.status-badge.rapor_bekleniyor{background:var(--admin-warning-bg);color:var(--admin-warning-text)}
.scope-foot{margin:-4px 0 0;color:var(--admin-text);font-size:14px}
@media(max-width:1180px){.inst-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.inst-row{grid-template-columns:1fr}}
@media(max-width:1180px){.top{grid-template-columns:minmax(0,1fr)}}
@media(max-width:760px){.top-right{grid-template-columns:1fr}.segment button{min-width:0}h1{font-size: 22px}}
.count{padding:1px 7px;border-radius:999px;background:var(--admin-chip);color:var(--admin-muted);font-size:11px}
.card{background:var(--admin-card);border:0;border-radius:var(--pk-radius);box-shadow:var(--pk-card-shadow);min-width:0}
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
.table-wrap{overflow:auto;margin-top:16px}
table{width:100%;border-collapse:collapse}th,td{padding:9px 12px;text-align:left;border-bottom:1px solid rgba(145,158,171,.2);font-size:12px;color:var(--admin-text);vertical-align:top}
th{font-size:13px;font-weight:600;color:var(--admin-muted);background:rgba(145,158,171,.08);white-space:nowrap}
td strong{color:var(--admin-heading)}
tr.clickable{cursor:pointer}tr.clickable:hover{background:var(--admin-hover)}
.ok-text{color:var(--admin-success-text);font-weight:700}.bad-text{color:var(--admin-danger-text);font-weight:700}.warn-text{color:var(--admin-warning-text);font-weight:700}.muted{margin:0;color:var(--admin-muted);font-size:12px}
.bar-col{width:180px}
.ratio{display:flex;align-items:center;gap:8px}
.ratio-bar{flex:1;height:8px;border-radius:999px;overflow:hidden;background:var(--admin-chip)}.ratio-bar i{display:block;height:100%;border-radius:999px}
.ratio-bar i.ok{background:#16a34a}.ratio-bar i.warn{background:#d97706}.ratio-bar i.bad{background:#dc2626}
.ratio strong{min-width:44px;text-align:right;font-size:12px}.ratio strong.ok{color:#16a34a}.ratio strong.warn{color:#d97706}.ratio strong.bad{color:#dc2626}
.installation-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.installation-head small{display:block;margin-top:4px}
.status-pill,.status-badge{display:inline-block;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700;white-space:nowrap;background:var(--admin-chip);color:var(--admin-muted)}
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
  /* Gölge basılmaz; kartın sınırı ince çizgiyle */
  .report-page .card { break-inside: avoid; box-shadow: none; border: 1px solid rgba(145, 158, 171, .32); }
  .report-page .table-wrap { overflow: visible; }
  /* Kapsam ve çubuklar yan yana. Çubuk ve hap renkleri basılsın. */
  .report-page .top { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important; }
  .report-page { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .report-page .inst-row { break-inside: avoid; }
  body { background: #fff; }
}
</style>
