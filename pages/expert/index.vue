<template>
  <!-- Lokasyon / il değişince her kart kendi içinde yükleniyor gösterir (eski değer soluk, ortada dönen gösterge) -->
  <div class="expert-dashboard" :class="{ reloading: (loading || cityLoading) && !!data }">
    <div class="page-head">
      <div>
        <span class="eyebrow">Hoş geldiniz, {{ user?.name }}</span>
        <h1>Genel Bakış</h1>
        <p>{{ scopeLabel }}</p>
      </div>
    </div>

    <!-- Sekmeler: önce hizmet verilen lokasyonlar, sonra genel durum, takvim, tesisat ve formlar -->
    <div class="tabs">
      <button v-for="item in tabs" :key="item.key" type="button" :class="{ active: tab === item.key }" @click="tab = item.key"><i :class="item.icon" /> {{ item.label }}</button>
    </div>
    <!-- Haritada il seçiliyken sayfanın tamamı o ile göre -->
    <div v-if="selectedCity" class="city-bar">
      <i :class="cityLoading ? 'pi pi-spin pi-spinner' : 'pi pi-map-marker'" />
      <span>Sayfa <strong>{{ selectedCityName }}</strong> iline göre gösteriliyor.</span>
      <button class="link-button" type="button" @click="selectedCity = null">Tüm iller</button>
    </div>

    <div v-if="loading && !data" class="card state"><i class="pi pi-spin pi-spinner" /> Özet hazırlanıyor...</div>
    <div v-else-if="error" class="card state error-text">{{ error }}</div>
    <div v-else-if="!groups.length" class="card state">Henüz size atanmış bir işyeri yok. Firmalarım'dan işyeri ekleyin.</div>

    <template v-else-if="data">
      <!-- 1) Hizmet verilen lokasyonlar: başta sayılar (KPI), Türkiye haritası ve sağında genel skor, altta lokasyon
           bazında PK durumu (% tamam) -->
      <template v-if="tab === 'locations'">
        <div class="kpis" :class="team ? 'four' : 'three'">
          <div class="kpi"><span>Aktif lokasyon</span><strong>{{ data.locations.length }}</strong><small>{{ cityCount }} ilde<template v-if="!corporate"> · {{ scopeCounts.customers }} müşteri</template></small></div>
          <div class="kpi"><span>Takip edilen ekipman</span><strong>{{ data.totals.equipment }}</strong><small>{{ scopeCounts.workplaces }} işyeri</small></div>
          <div class="kpi"><span>Tesisat</span><strong>{{ data.installations.length }}</strong><small>{{ installationKpiText }}</small></div>
          <!-- OSGB / kurumsal: yönetici ve operasyon yöneticisi -->
          <div v-if="team" class="kpi" :class="{ warn: team.counts.unassigned, loading: teamLoading }"><span>Uzman</span><strong>{{ team.counts.experts }}</strong><small>{{ team.counts.unassigned ? `${team.counts.unassigned} firmanın uzmanı yok` : 'bütün firmaların uzmanı var' }}</small></div>
        </div>
        <div class="map-grid">
          <section class="card chart-card map-card">
            <header><h3>Türkiye haritası</h3><small>İle tıklayınca sayfa o ile göre güncellenir; tekrar tıklayınca tüm iller.</small></header>
            <ExpertTurkeyMap :cities="mapCities" :selected="selectedCity" @select="selectedCity = $event" />
            <div class="map-legend">
              <span><i class="bad" /> Gecikmiş ya da uygun değil var</span>
              <span><i class="warn" /> 60 gün içinde kontrol</span>
              <span><i class="ok" /> Sorunsuz</span>
              <span><i class="empty" /> Ekipman yok</span>
            </div>
          </section>
          <section class="card chart-card gauge-card">
            <header><h3>Genel durum</h3><small>{{ selectedCityName || 'Tüm iller' }}</small></header>
            <ExpertScoreGauge class="gauge-fill" :score="data.score" />
          </section>
        </div>
        <!-- Firma seçiliyken: olası idari para cezası (ayrıntı Ceza sekmesinde) -->
        <ExpertFineSummary v-if="fineScope" compact :location-id="fineScope.locationId" :workplace-id="fineScope.workplaceId" @detail="tab = 'fines'" />
        <!-- OSGB: müşteri bazında PK durumu (yönetici ve operasyon yöneticisi) -->
        <section v-if="team?.customers?.length" class="card list-card" :class="{ loading: teamLoading }">
          <header><div><h3>Müşteri özeti</h3><small>Müşteri bazında PK durumu (yüzde kaçı tamam); en çok süresi geçmiş üstte.</small></div></header>
          <div v-for="row in team.customers" :key="row.id" class="location-row static">
            <span class="location-name"><strong>{{ row.name }}</strong><small>{{ row.locations }} lokasyon · {{ row.score.total }} ekipman</small></span>
            <template v-if="row.score.total">
              <div class="progress-bar"><i :class="levelOf(row.score.percent)" :style="{ width: `${row.score.percent ?? 0}%` }" /></div>
              <strong class="location-percent" :class="levelOf(row.score.percent)">%{{ percentText(row.score.percent) }}</strong>
              <small class="location-detail">{{ row.score.ok }} / {{ row.score.total }} tamam<template v-if="row.score.overdue"> · {{ row.score.overdue }} süresi geçmiş</template><template v-if="row.score.nonconforming"> · {{ row.score.nonconforming }} uygun değil</template></small>
            </template>
            <span v-else class="location-empty">Ekipman yok</span>
          </div>
        </section>
        <section class="card list-card">
          <header>
            <div><h3>Lokasyon özeti</h3><small>{{ selectedCityName ? `${selectedCityName} · ` : '' }}Lokasyon bazında PK durumu (yüzde kaçı tamam); en sorunlu üstte, tıklayınca o lokasyona iner.</small></div>
            <button v-if="selectedCity" class="link-button" type="button" @click="selectedCity = null">Tüm iller</button>
          </header>
          <p v-if="!summaryLocations.length" class="muted pad">Lokasyon yok.</p>
          <div v-for="location in summaryLocations" :key="location.location_id" class="location-row" @click="setLocation(location.location_id)">
            <span class="location-name">
              <strong>{{ locationLabel(location.location_id, location.location_name) }}</strong>
              <small>{{ location.city_name || 'İl belirtilmemiş' }} · {{ location.total }} ekipman</small>
            </span>
            <template v-if="location.score.total">
              <div class="progress-bar"><i :class="levelOf(location.score.percent)" :style="{ width: `${location.score.percent}%` }" /></div>
              <strong class="location-percent" :class="levelOf(location.score.percent)">%{{ percentText(location.score.percent) }}</strong>
              <small class="location-detail">{{ location.score.ok }} / {{ location.score.total }} tamam<template v-if="location.score.overdue"> · {{ location.score.overdue }} süresi geçmiş</template><template v-if="location.score.nonconforming"> · {{ location.score.nonconforming }} uygun değil</template></small>
            </template>
            <span v-else class="location-empty">Ekipman yok</span>
          </div>
        </section>
        <!-- Ekipman kategorileri: kategori bazında PK durumu (yangın ekipmanları dahil; genel skorla aynı hesap) -->
        <section class="card list-card">
          <header><div><h3>Ekipman kategorileri</h3><small>Kategori bazında PK durumu (yüzde kaçı tamam)</small></div></header>
          <p v-if="!data.category_scores.length" class="muted pad">Ekipman yok.</p>
          <div v-for="row in data.category_scores" :key="row.slug" class="location-row static">
            <span class="location-name"><strong>{{ row.name }}</strong><small>{{ row.score.total }} ekipman</small></span>
            <div class="progress-bar"><i :class="levelOf(row.score.percent)" :style="{ width: `${row.score.percent ?? 0}%` }" /></div>
            <strong class="location-percent" :class="levelOf(row.score.percent)">%{{ percentText(row.score.percent) }}</strong>
            <small class="location-detail">{{ row.score.ok }} / {{ row.score.total }} tamam<template v-if="row.score.overdue"> · {{ row.score.overdue }} süresi geçmiş</template><template v-if="row.score.nonconforming"> · {{ row.score.nonconforming }} uygun değil</template></small>
          </div>
        </section>
        <!-- Ekipman türleri: Durum Raporu'ndaki tablo (yalnızca tablo); kapsam sayfayla aynı (filtre + seçili il) -->
        <section class="card list-card" :class="{ loading: typesLoading && typeRows.length }">
          <header><div><h3>Ekipman türleri</h3><small>{{ selectedCityName ? `${selectedCityName} · ` : '' }}Tür başına durum ve kontrol zamanı</small></div></header>
          <p v-if="typesLoading && !typeRows.length" class="muted pad"><i class="pi pi-spin pi-spinner" /> Yükleniyor...</p>
          <p v-else-if="typesError" class="muted pad error-text">{{ typesError }}</p>
          <p v-else-if="!typeRows.length" class="muted pad">Ekipman yok.</p>
          <ExpertTypeStatusTable v-else :types="typeRows" />
        </section>
        <!-- Tesisat özeti: kapsamdaki her tesisat kaydı (filtre + seçili il); en sorunlu üstte -->
        <section class="card list-card">
          <header>
            <div><h3>Tesisat özeti</h3><small>{{ selectedCityName ? `${selectedCityName} · ` : '' }}Her tesisat kaydının son durumu; en sorunlu üstte</small></div>
            <NuxtLink class="link-button" to="/expert/installations">Tesisatlar <i class="pi pi-arrow-right" /></NuxtLink>
          </header>
          <p v-if="!data.installations.length" class="muted pad">Tesisat yok.</p>
          <ExpertInstallationSummaryTable v-else :installations="data.installations" />
        </section>
      </template>

      <!-- 2) Genel durum: sayılar, yaklaşan kontroller, kategoriler ve yangın ekipmanları -->
      <template v-else-if="tab === 'status'">
      <div class="kpis">
        <div class="kpi"><span>Toplam ekipman</span><strong>{{ data.totals.equipment }}</strong><small>{{ data.totals.passive ? `${data.totals.passive} pasif ayrıca` : 'aktif ekipman' }}</small></div>
        <div class="kpi warn"><span>Yaklaşan kontrol</span><strong>{{ data.totals.upcoming }}</strong><small>60 gün içinde · {{ data.timing.d30 }}'i 30 günde</small></div>
        <div class="kpi bad"><span>Süresi geçmiş</span><strong>{{ data.totals.overdue }}</strong><small>kontrol tarihi geçti</small></div>
        <div class="kpi bad"><span>Uygun değil</span><strong>{{ data.totals.nonconforming }}</strong><small>son kontrolde</small></div>
        <div class="kpi"><span>Lokasyon</span><strong>{{ data.locations.length }}</strong><small>{{ problemLocations }} tanesinde sorun var</small></div>
      </div>

      <!-- Yaklaşan kontroller (60 gün içinde; süresi geçmişler hariç): gün + lokasyon başına gruplu, tüp ve tesisat tek kalem -->
      <section class="card list-card">
        <header><h3>Yaklaşan kontroller</h3><small>60 gün içinde dolan, en yakın önce. Satıra tıklayınca o günün kontrolleri açılır.</small></header>
        <p v-if="!upcomingEntries.length" class="muted pad">60 gün içinde dolan kontrol yok.</p>
        <ExpertAgendaTable v-else :entries="upcomingEntries" :limit="12" @select="upcomingDate = $event" />
      </section>
      <ExpertControlDayModal v-if="upcomingDate" :date="upcomingDate" :entries="entriesOnDate(upcomingDate)" :query="viewQuery" @close="upcomingDate = null" />

      <!-- Ana kategoriler ve yangın ekipmanları ayrı (yangın ekipmanları sayıca çok, diğerlerini bastırmasın) -->
      <div class="grid two">
        <section v-for="box in progressBoxes" :key="box.key" class="card chart-card">
          <header><h3>{{ box.title }}</h3><small>{{ box.hint }}</small></header>
          <p v-if="!box.rows.length" class="muted pad">{{ box.empty }}</p>
          <div v-else class="progress-list">
            <!-- Satıra tıklanınca ayrıntı alta açılır: kategoride türler, yangın türünde lokasyonlar; uygun olmayanlar -->
            <div v-for="row in box.rows" :key="row.name" class="progress-row" :class="{ open: isOpenRow(box.key, row.name) }">
              <button type="button" class="progress-toggle" :aria-expanded="isOpenRow(box.key, row.name)" @click="toggleRow(box.key, row.name)">
                <div class="progress-head">
                  <span><i :class="isOpenRow(box.key, row.name) ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" /> {{ row.name }}</span>
                  <strong :class="levelOf(shareOf(row.status.uygun, row.total))">%{{ percentText(shareOf(row.status.uygun, row.total)) }}</strong>
                </div>
                <div class="progress-bar"><i :class="levelOf(shareOf(row.status.uygun, row.total))" :style="{ width: `${shareOf(row.status.uygun, row.total)}%` }" /></div>
                <small>{{ row.status.uygun }} / {{ row.total }} uygun<template v-for="part in progressRest(row)" :key="part"> · {{ part }}</template></small>
              </button>
              <div v-if="isOpenRow(box.key, row.name)" class="progress-detail">
                <h5>{{ box.key === 'fire' ? 'Lokasyonlara göre' : 'Türlere göre' }}</h5>
                <div v-for="part in row.breakdown" :key="part.name + (part.location_id || '')" class="detail-line">
                  <span class="detail-name">{{ box.key === 'fire' ? locationLabel(part.location_id, part.name) : part.name }}</span>
                  <div class="progress-bar thin"><i :class="levelOf(shareOf(part.status.uygun, part.total))" :style="{ width: `${shareOf(part.status.uygun, part.total)}%` }" /></div>
                  <strong :class="levelOf(shareOf(part.status.uygun, part.total))">%{{ percentText(shareOf(part.status.uygun, part.total)) }}</strong>
                  <small>{{ part.status.uygun }} / {{ part.total }}</small>
                </div>
                <h5>Uygun olmayanlar <span class="count">{{ row.nonconforming_total }}</span></h5>
                <p v-if="!row.nonconforming_total" class="muted">Son kontrolü uygun olmayan ekipman yok.</p>
                <NuxtLink v-for="item in row.nonconforming" :key="item.id" :to="`/expert/equipment/${item.id}`" class="detail-item">
                  <span class="dot uygun_degil" />
                  <span class="detail-item-main">
                    <strong>{{ [item.type, item.code && `no ${item.code}`, item.variant].filter(Boolean).join(' · ') }}</strong>
                    <small>{{ [locationLabel(item.location_id, item.location_name), item.place].filter(Boolean).join(' · ') }}</small>
                  </span>
                  <i class="pi pi-angle-right" />
                </NuxtLink>
                <p v-if="row.nonconforming_total > row.nonconforming.length" class="muted">+{{ row.nonconforming_total - row.nonconforming.length }} ekipman daha: Ekipmanlar'da "Uygun değil" filtresiyle görebilirsiniz.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
      </template>

      <!-- 3) Kontrol takvimi: yıllık takvim; gün + lokasyon başına gruplu (tesisat ve tüpler tek kalem, diğerleri türe göre). -->
      <template v-else-if="tab === 'calendar'">
        <ExpertControlCalendar :agenda="data.agenda || []" :undated="data.undated" :query="viewQuery" />
      </template>

      <!-- OSGB / kurumsal: Uzmanlar (yönetici ve operasyon yöneticisi) -->
      <template v-else-if="tab === 'fines' && fineScope">
        <ExpertFineSummary :location-id="fineScope.locationId" :workplace-id="fineScope.workplaceId" />
      </template>
      <template v-else-if="tab === 'team'">
        <ExpertTeamOverview :data="team" :loading="teamLoading" :error="teamError" />
      </template>

      <!-- 4) Tesisatlar ve tüp kontrol formları -->
      <template v-else>
      <div class="grid two">
        <section class="card list-card">
          <header><h3>Tesisatlar</h3><NuxtLink class="link-button" to="/expert/installations">Tesisatlar <i class="pi pi-arrow-right" /></NuxtLink></header>
          <p v-if="!data.installations.length" class="muted pad">Tesisat yok.</p>
          <div v-for="item in data.installations" :key="item.id" class="line">
            <span class="dot" :class="item.status" />
            <!-- Başlık tesisatın türü (ör. Yangın Algılama ve Uyarı Sistemleri); kaydın adı (bina) türden farklıysa altta -->
            <span class="line-main"><strong>{{ item.type?.name || item.name }}</strong><small>{{ [item.type?.name && item.name !== item.type.name ? item.name : null, locationLabel(item.location?.id, item.location_name)].filter(Boolean).join(' · ') }}</small></span>
            <span class="line-meta">{{ item.nonconforming_systems }}/{{ item.systems_count }} sistem uygun değil</span>
            <span class="days" :class="daysKey(item.days_left)">{{ daysText(item.days_left) }}</span>
            <span class="status-badge" :class="item.status">{{ INSTALLATION_STATUS[item.status] || item.status }}</span>
          </div>
        </section>
        <section class="card list-card">
          <header><h3>Tüp kontrol formları</h3><small>Lokasyon başına son form</small></header>
          <p v-if="!data.bulk_reports.length" class="muted pad">Tüp kontrol formu yok.</p>
          <div v-for="item in data.bulk_reports" :key="item.id" class="line">
            <span class="dot" :class="item.status || 'none'" />
            <span class="line-main"><strong>{{ locationLabel(item.location_id, item.location_name) }}</strong><small>{{ formatDate(item.control_date) }} · {{ item.report_no || 'rapor no yok' }}</small></span>
            <span class="line-meta">{{ item.equipment_count }} tüp</span>
            <span class="days" :class="daysKey(item.days_left)">{{ daysText(item.days_left) }}</span>
          </div>
        </section>
      </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
// Genel Bakış: uzmanın tüm lokasyonlarındaki (ya da filtrelenen müşteri / lokasyon / işyerindeki) ekipman ve tesisat
// özeti; hangi lokasyonun sorunlu olduğu tek bakışta. Lokasyon çubuğuna tıklayınca o lokasyona iner.
// Kapsam üstteki lokasyon / firma menüsünden; bu sayfada menüde "Tüm lokasyonlar" da seçilebilir (dashboardScope).
definePageMeta({ layout: 'expert', middleware: 'expert', dashboardScope: true })

const INSTALLATION_STATUS: Record<string, string> = { uygun: 'Uygun', uygun_degil: 'Uygun değil', rapor_bekleniyor: 'Rapor bekleniyor', rapor_yok: 'Kontrol yok' }

// Sekmeler (önce hizmet verilen lokasyonlar); seçili sekme adres satırında (?sekme=).
const TABS = [
  { key: 'locations', label: 'Lokasyonlar', icon: 'pi pi-map' },
  { key: 'status', label: 'Genel durum', icon: 'pi pi-chart-pie' },
  { key: 'calendar', label: 'Kontrol takvimi', icon: 'pi pi-calendar' },
  { key: 'installations', label: 'Tesisatlar ve formlar', icon: 'pi pi-sitemap' }
] as const
const route = useRoute()
const router = useRouter()
const tab = ref<string>([...TABS.map(item => item.key), 'team', 'fines'].includes(String(route.query.sekme)) ? String(route.query.sekme) : 'locations')
watch(tab, value => router.replace({ query: value === 'locations' ? {} : { sekme: value } }))

const { user } = useAuth()
const { get, errorMessage } = useExpertApi()
const { groups, load, query, scopeLabel, locationLabel, setLocation } = useDashboardScope()

// fullData: filtredeki tüm kapsam (harita hep bundan). Haritada il seçilince o ilin lokasyonlarıyla ayrıca alınır (cityData);
// sayfadaki her yer (sayılar, skor, özetler, diğer sekmeler) data'dan, yani seçili ilden.
const fullData = ref<any>(null)
const cityData = ref<any>(null)
const data = computed(() => cityData.value || fullData.value)
const loading = ref(false)
const error = ref('')

const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('tr-TR').format(new Date(value)) : '—'
const daysText = (days: number | null) => days === null || days === undefined ? '—' : days < 0 ? `${-days} gün geçti` : days === 0 ? 'Bugün' : `${days} gün`
const daysKey = (days: number | null) => days === null || days === undefined ? '' : days < 0 ? 'overdue' : days <= 60 ? 'soon' : 'ok'

const problemLocations = computed(() => (data.value?.locations || []).filter((item: any) => item.overdue || item.nonconforming).length)

// Yüzde (genel skor göstergesiyle aynı): tek haneli, aşağı yuvarlanmış; renk eşikleri %90 / %70.
const levelOf = (percent?: number | null) => (percent ?? 0) >= 90 ? 'ok' : (percent ?? 0) >= 70 ? 'warn' : 'bad'
const shareOf = (value: number, total: number) => total ? Math.floor((value / total) * 1000) / 10 : 0
const percentText = (value?: number | null) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(value ?? 0)

// Genel durum: yaklaşan kontroller (60 gün içinde, süresi geçmişler hariç), gün + lokasyon başına gruplu; satıra
// tıklanınca o günün penceresi (takvimdeki gibi).
const upcomingEntries = computed(() => (data.value?.agenda || []).filter((entry: any) => entry.days_left >= 0 && entry.days_left <= 60))
const upcomingDate = ref<string | null>(null)
const entriesOnDate = (date: string) => (data.value?.agenda || []).filter((entry: any) => entry.date === date)

// --- Lokasyonlar sekmesi: il bazında harita, lokasyon özeti (sorunluluğa göre sıralı gelir) ---
const selectedCity = ref<number | null>(null)
const cityLoading = ref(false)
const mapCities = computed(() => {
  const map = new Map<number, { code: number; name: string; count: number; equipment: number; overdue: number; nonconforming: number; upcoming: number }>()
  for (const location of fullData.value?.locations || []) {
    if (!location.city_id) continue
    const city = map.get(location.city_id) || { code: location.city_id, name: location.city_name, count: 0, equipment: 0, overdue: 0, nonconforming: 0, upcoming: 0 }
    city.count++
    city.equipment += location.total
    city.overdue += location.overdue
    city.nonconforming += location.nonconforming
    city.upcoming += location.upcoming
    map.set(location.city_id, city)
  }
  return [...map.values()]
})
const selectedCityName = computed(() => mapCities.value.find(city => city.code === selectedCity.value)?.name || '')
const summaryLocations = computed(() => data.value?.locations || [])
// Tesisat kartı: kaç türde, kaçı uygun değil, kaçının süresi geçmiş.
const installationKpiText = computed(() => {
  const items: any[] = data.value?.installations || []
  if (!items.length) return 'tesisat yok'
  const types = new Set(items.map(item => item.type?.id ?? item.type?.name ?? item.name)).size
  const nonconforming = items.filter(item => item.status === 'uygun_degil').length
  const overdue = items.filter(item => item.days_left !== null && item.days_left !== undefined && item.days_left < 0).length
  return [`${types} türde`, nonconforming && `${nonconforming} uygun değil`, overdue && `${overdue} süresi geçmiş`].filter(Boolean).join(' · ')
})
const cityCount = computed(() =>new Set((data.value?.locations || []).map((location: any) => location.city_id).filter(Boolean)).size)
// Seçili ilin lokasyonları: sayfanın kapsamı (takvim listesi de dahil) bunlar.
const cityLocationIds = computed(() => selectedCity.value
  ? (fullData.value?.locations || []).filter((location: any) => location.city_id === selectedCity.value).map((location: any) => location.location_id)
  : null)
const viewQuery = computed(() => cityLocationIds.value ? { ...query.value, 'location_ids[]': cityLocationIds.value } : query.value)
watch(selectedCity, async () => {
  if (!cityLocationIds.value) { cityData.value = null; return }
  cityLoading.value = true
  try { cityData.value = await get('/pk-dashboard', viewQuery.value) }
  catch (e: any) { selectedCity.value = null; error.value = errorMessage(e, 'İl özeti alınamadı.') }
  finally { cityLoading.value = false }
})
// Kapsamdaki müşteri ve işyeri sayısı (uzmanın işyeri listesinden).
const scopeCounts = computed(() => {
  const ids = new Set((data.value?.locations || []).map((location: any) => location.location_id))
  const inScope = groups.value.filter(group => ids.has(group.location_id))
  return { customers: new Set(inScope.map(group => group.customer_name || '')).size, workplaces: inScope.reduce((sum, group) => sum + group.items.length, 0) }
})

// Lokasyonlar sekmesinin altındaki ekipman türleri tablosu: Durum Raporu'nun verisi (pk-dashboard/report), sayfanın kapsamıyla
// (filtre + seçili il). Yalnızca bu sekme açıkken ve kapsam değişince alınır.
const typeRows = ref<any[]>([])
const typesLoading = ref(false)
const typesError = ref('')
let typesKey = ''
let typesRequest = 0
const loadTypes = async () => {
  if (tab.value !== 'locations' || !groups.value.length) return
  const key = JSON.stringify(viewQuery.value)
  if (key === typesKey) return
  typesKey = key
  const request = ++typesRequest
  typesLoading.value = true
  typesError.value = ''
  try {
    // Yalnızca tür tablosu (Durum Raporu'nun tamamı değil): aynı hesap, tesisat ayrıntıları olmadan.
    const types = await get<any[]>('/pk-dashboard/types', viewQuery.value)
    if (request === typesRequest) typeRows.value = types || []
  } catch (e: any) {
    if (request === typesRequest) { typesKey = ''; typesError.value = errorMessage(e, 'Ekipman türleri alınamadı.') }
  } finally {
    if (request === typesRequest) typesLoading.value = false
  }
}
watch([tab, viewQuery], loadTypes, { deep: true })

// Genel durum: kategori (yangın hariç) ve yangın ekipmanı türü başına "yüzde kaçı uygun" ilerleme çubuğu; altında geri kalanlar.
const progressBoxes = computed(() => [
  { key: 'categories', title: 'Ekipman kategorileri', hint: 'Yangın ekipmanları hariç; yüzde kaçı uygun', empty: 'Bu kapsamda ekipman yok.', rows: data.value?.categories || [] },
  { key: 'fire', title: 'Yangın ekipmanları', hint: 'Türe göre (tüp, dolap, hidrant…); yüzde kaçı uygun', empty: 'Bu kapsamda yangın ekipmanı yok.', rows: data.value?.fire_types || [] }
])
const openRows = ref<string[]>([])
const isOpenRow = (box: string, name: string) => openRows.value.includes(`${box}|${name}`)
const toggleRow = (box: string, name: string) => {
  const key = `${box}|${name}`
  openRows.value = isOpenRow(box, name) ? openRows.value.filter(item => item !== key) : [...openRows.value, key]
}
const progressRest = (row: any) => (['uygun_degil', 'belirtilmemis', 'rapor_bekleniyor', 'rapor_yok'] as const)
  .filter(key => row.status[key])
  .map(key => `${row.status[key]} ${STATUS_TEXT[key].toLocaleLowerCase('tr-TR')}`)

// Aynı kapsam için ikinci istek atılmaz (açılışta işyerleri yüklenince filtre de değişir).
let lastKey = ''
const loadData = async () => {
  if (!groups.value.length) { fullData.value = null; return }
  const key = JSON.stringify(query.value)
  if (key === lastKey) return
  lastKey = key
  loading.value = true
  error.value = ''
  // Filtre değişince il seçimi sıfırlanır (seçili il yeni kapsamda olmayabilir).
  selectedCity.value = null
  cityData.value = null
  try { fullData.value = await get('/pk-dashboard', query.value) }
  catch (e: any) { lastKey = ''; error.value = errorMessage(e, 'Özet alınamadı.') }
  finally { loading.value = false }
}

watch(query, loadData, { deep: true })
onMounted(async () => {
  await load()
  loadData()
  loadTypes()
})

// --- OSGB / kurumsal hesabın yöneticisi ve operasyon yöneticisi: Uzmanlar sekmesi, Uzman kartı, OSGB'de müşteri özeti.
// Bireysel uzmanda (ve diğer rollerde) hiçbiri yok, sekmeler aynı. ---
const { multiUser, corporate, isManager, isOperation, load: loadAccount } = useAccount()
const teamView = computed(() => multiUser.value && (isManager.value || isOperation.value))
const tabs = computed(() => [
  ...TABS,
  ...(teamView.value ? [{ key: 'team', label: 'Uzmanlar', icon: 'pi pi-users' }] : []),
  // Ceza: yalnız üstten bir firma (işyeri) seçiliyken, en sonda
  ...(fineScope.value ? [{ key: 'fines', label: 'Ceza', icon: 'pi pi-exclamation-triangle' }] : [])
])
// Olası ceza kapsamı: seçili lokasyon + firma (lokasyon geneli ekipmanlar o firmaya dahil)
const { locationId: fineLocationId, workplaceId: fineWorkplaceId } = useDashboardScope()
const fineScope = computed(() => (fineLocationId.value && fineWorkplaceId.value ? { locationId: fineLocationId.value, workplaceId: fineWorkplaceId.value } : null))
watch(fineScope, (scope) => { if (!scope && tab.value === 'fines') tab.value = 'locations' })
const team = ref<any>(null)
const teamLoading = ref(false)
const teamError = ref('')
// Kapsam: müşteri / lokasyon filtresi ya da il seçiliyse o lokasyonlar, değilse hesabın tamamı.
const { customer: scopeCustomer, locationId: scopeLocationId } = useDashboardScope()
const teamLocationIds = computed<number[]>(() => scopeCustomer.value || scopeLocationId.value || selectedCity.value ? viewQuery.value['location_ids[]'] : [])
let teamKey = ''
const loadTeam = async () => {
  if (!teamView.value) { team.value = null; teamKey = ''; return }
  const key = JSON.stringify(teamLocationIds.value)
  if (key === teamKey) return
  teamKey = key
  teamLoading.value = true
  teamError.value = ''
  try { team.value = await get('/pk-account/overview', teamLocationIds.value.length ? { 'location_ids[]': teamLocationIds.value } : {}) }
  catch (e: any) { teamKey = ''; teamError.value = errorMessage(e, 'Uzman özeti alınamadı.') }
  finally { teamLoading.value = false }
}
watch([teamView, teamLocationIds], loadTeam, { immediate: true })
onMounted(async () => {
  await loadAccount()
  // Adres satırından Uzmanlar sekmesi gelip yetkisi yoksa ilk sekme.
  if (tab.value === 'team' && !teamView.value) tab.value = 'locations'
})
</script>

<style scoped>
.expert-dashboard{max-width:1500px;margin:0 auto;display:grid;gap:16px}
.page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:4px}
.eyebrow{display:block;margin-bottom:7px;color:var(--pk-yellow-dark);font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
.page-head h1{margin:0;color:var(--admin-heading);font-size:30px;line-height:1.15;letter-spacing:-.7px}.page-head p{margin:7px 0 0;color:var(--admin-muted);font-size:13px}
.card{background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px;min-width:0}
.state{display:flex;align-items:center;justify-content:center;gap:8px;padding:60px 20px;color:var(--admin-muted);font-size:13px}
.kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
.kpi{display:flex;flex-direction:column;gap:6px;padding:18px;background:var(--admin-card);border:1px solid var(--admin-border);border-left:4px solid var(--admin-border);border-radius:12px}
.kpi span{color:var(--admin-muted);font-size:12px;font-weight:700}.kpi strong{color:var(--admin-heading);font-size:30px;line-height:1}.kpi small{color:var(--admin-muted);font-size:11px}
.kpi.warn{border-left-color:#facc15}.kpi.bad{border-left-color:var(--admin-danger-text)}.kpi.bad strong{color:var(--admin-danger-text)}
.grid.two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.tabs{display:flex;flex-wrap:wrap;gap:4px;border-bottom:1px solid var(--admin-border)}
.city-bar{display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid #93c5fd;border-radius:10px;background:rgba(37,99,235,.08);color:var(--admin-text);font-size:12px}
.city-bar i{color:#2563eb}.city-bar strong{color:var(--admin-heading)}.city-bar .link-button{margin-left:auto}
.tabs button{display:inline-flex;align-items:center;gap:7px;padding:10px 14px;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;background:none;color:var(--admin-muted);font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.tabs button:hover{color:var(--admin-heading)}.tabs button.active{color:var(--admin-heading);border-bottom-color:var(--pk-yellow)}
/* Lokasyonlar sekmesi: başta iki KPI kartı, lokasyon özeti (alt) */
.kpis.two{grid-template-columns:repeat(2,minmax(0,1fr))}.kpis.three{grid-template-columns:repeat(3,minmax(0,1fr))}.kpis.four{grid-template-columns:repeat(4,minmax(0,1fr))}
@media(max-width:1100px){.kpis.four{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.kpis.four{grid-template-columns:1fr}}
@media(max-width:900px){.kpis.three{grid-template-columns:1fr}}
.location-row{display:grid;grid-template-columns:minmax(220px,1.3fr) minmax(120px,2fr) 64px minmax(180px,1.2fr);align-items:center;gap:14px;padding:10px 8px;border-top:1px solid var(--admin-row-border);border-radius:8px;cursor:pointer}
.location-row:hover{background:var(--admin-hover)}.location-row.static{cursor:default}.location-row.static:hover{background:none}
.location-name{display:flex;flex-direction:column;gap:2px;min-width:0}.location-name strong{color:var(--admin-heading);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.location-name small{color:var(--admin-muted);font-size:11px}
.location-percent{text-align:right;font-size:16px}.location-percent.ok{color:#16a34a}.location-percent.warn{color:#d97706}.location-percent.bad{color:#dc2626}
.location-detail{color:var(--admin-muted);font-size:11px}
.location-empty{grid-column:2 / -1;color:var(--admin-muted);font-size:12px}
.progress-list{display:grid;gap:14px}
.progress-row{display:grid;gap:5px}
.progress-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px}.progress-head span{color:var(--admin-heading);font-size:13px;font-weight:700}
.progress-head strong{font-size:16px}.progress-head strong.ok{color:#16a34a}.progress-head strong.warn{color:#d97706}.progress-head strong.bad{color:#dc2626}
.progress-bar{height:10px;border-radius:999px;background:var(--admin-chip);overflow:hidden}.progress-bar i{display:block;height:100%;border-radius:999px}
.progress-bar i.ok{background:#16a34a}.progress-bar i.warn{background:#d97706}.progress-bar i.bad{background:#dc2626}
.progress-row small{color:var(--admin-muted);font-size:11px}
.progress-toggle{display:grid;gap:5px;width:100%;padding:6px 8px;margin:-6px -8px;border:0;border-radius:8px;background:none;font:inherit;text-align:left;cursor:pointer;box-sizing:content-box}
.progress-toggle:hover,.progress-row.open .progress-toggle{background:var(--admin-hover)}
.progress-head span i{margin-right:4px;font-size:10px;color:var(--admin-muted)}
.progress-detail{margin-top:6px;padding:10px 12px;border:1px solid var(--admin-border);border-radius:10px;background:var(--admin-soft)}
.progress-detail h5{display:flex;align-items:center;gap:6px;margin:4px 0 8px;color:var(--admin-heading);font-size:12px}.progress-detail h5:not(:first-child){margin-top:14px}
.detail-line{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(60px,1fr) 52px 60px;align-items:center;gap:10px;padding:4px 0;font-size:12px}
.detail-name{color:var(--admin-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.detail-line strong{text-align:right;font-size:12px}.detail-line small{text-align:right}
.detail-line strong.ok{color:#16a34a}.detail-line strong.warn{color:#d97706}.detail-line strong.bad{color:#dc2626}
.progress-bar.thin{height:6px}
.detail-item{display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:8px;color:var(--admin-text);text-decoration:none}.detail-item:hover{background:var(--admin-card)}
.detail-item-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}.detail-item-main strong{color:var(--admin-heading);font-size:12px}.detail-item i{color:var(--admin-muted);font-size:12px}
/* Harita ve genel durum kartları aynı yükseklikte: gösterge dikeyde ortada, harita açıklaması altta */
.map-grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(320px,1fr);gap:16px;align-items:stretch}
.map-card,.gauge-card{display:flex;flex-direction:column}
.map-card .map-legend{margin-top:auto;padding-top:10px}
.gauge-fill{flex:1;display:flex;flex-direction:column;justify-content:center}
.map-legend{display:flex;flex-wrap:wrap;gap:14px;margin-top:10px;color:var(--admin-muted);font-size:11px}
.map-legend span{display:inline-flex;align-items:center;gap:6px}.map-legend i{width:12px;height:12px;border-radius:3px;border:1.5px solid}
.map-legend .bad{background:#fecaca;border-color:#dc2626}.map-legend .warn{background:#fde68a;border-color:#d97706}.map-legend .ok{background:#bbf7d0;border-color:#16a34a}.map-legend .empty{background:#bfdbfe;border-color:#2563eb}
.line.clickable{cursor:pointer;border-radius:8px;padding-left:6px;padding-right:6px}.line.clickable:hover{background:var(--admin-hover)}
.chart-card{padding:16px 18px}
.chart-card header,.list-card header{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px}
h3{margin:0;color:var(--admin-heading);font-size:15px}header small{color:var(--admin-muted);font-size:12px}
.count{margin-left:6px;padding:1px 7px;border-radius:999px;background:var(--admin-chip);color:var(--admin-muted);font-size:11px}
.list-card{padding:16px 18px}
.line{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--admin-row-border)}
.line-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.line-main strong{color:var(--admin-heading);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.line-main small{color:var(--admin-muted);font-size:11px}
.line-meta{color:var(--admin-muted);font-size:12px;white-space:nowrap}
.dot{width:10px;height:10px;border-radius:50%;background:var(--admin-muted);flex-shrink:0}.dot.uygun{background:#16a34a}.dot.uygun_degil{background:#dc2626}.dot.rapor_bekleniyor{background:#f59e0b}
.days{font-size:12px;font-weight:700;white-space:nowrap;color:var(--admin-text)}.days.overdue{color:var(--admin-danger-text)}.days.soon{color:var(--admin-warning-text)}
.status-badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap;background:var(--admin-chip);color:var(--admin-muted)}
.status-badge.uygun{background:var(--admin-success-bg);color:var(--admin-success-text)}.status-badge.uygun_degil{background:var(--admin-danger-bg);color:var(--admin-danger-text)}.status-badge.rapor_bekleniyor{background:var(--admin-warning-bg);color:var(--admin-warning-text)}
.link-button{display:inline-flex;align-items:center;gap:6px;border:0;background:none;color:var(--admin-link);font:inherit;font-size:12px;font-weight:700;cursor:pointer;text-decoration:none}
.muted{margin:0;color:var(--admin-muted);font-size:12px}.pad{padding:10px 0}.error-text{color:var(--admin-danger-text)}
@media(max-width:1200px){.kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:1100px){.map-grid{grid-template-columns:1fr}}
@media(max-width:900px){.grid.two{grid-template-columns:1fr}.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.location-row{grid-template-columns:1fr 64px}.location-row .progress-bar,.location-detail{grid-column:1 / -1}}
/* Kart içi yükleniyor: eski içerik soluk, kartın ortasında dönen gösterge */
.reloading .card:not(.state),.reloading .kpi,.card.loading,.kpi.loading{position:relative}
.reloading .card:not(.state) > *,.reloading .kpi > *,.card.loading > *,.kpi.loading > *{opacity:.35;transition:opacity .15s}
.reloading .card:not(.state)::after,.reloading .kpi::after,.card.loading::after,.kpi.loading::after{content:'';position:absolute;top:50%;left:50%;width:22px;height:22px;margin:-11px 0 0 -11px;border:3px solid var(--admin-border);border-top-color:var(--pk-yellow);border-radius:50%;animation:card-spin .8s linear infinite}
@keyframes card-spin{to{transform:rotate(360deg)}}
</style>
