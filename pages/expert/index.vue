<template>
  <!-- Lokasyon / il değişince her kart kendi içinde yükleniyor gösterir (eski değer soluk, ortada dönen gösterge) -->
  <div class="expert-dashboard" :class="{ reloading: (loading || cityLoading) && !!data, fit: showSummary }">
    <div class="page-head">
      <div>
        <!-- Ana Sayfa yalnız bireysel uzmanda var; diğer hesaplarda sayfa yolu Genel Bakış'ta başlar -->
        <nav class="crumb" aria-label="Sayfa yolu">
          <i class="pi pi-home" aria-hidden="true" />
          <template v-if="individual"><NuxtLink to="/expert/anasayfa">Ana Sayfa</NuxtLink><i class="pi pi-angle-right" aria-hidden="true" /></template>
          <strong>Genel Bakış</strong>
        </nav>
        <h1>Genel bakış</h1>
        <p>Kontrol portföyünüzün güncel durumu</p>
      </div>
      <span v-if="data && groups.length" class="scope-pill"><i class="pi pi-building" /> {{ scopePill }}</span>
      <div v-if="SHOW_DETAIL_TABLES && individual" class="view-switch" role="group" aria-label="Görünüm">
        <button type="button" :class="{ on: view === 'ozet' }" :aria-pressed="view === 'ozet'" @click="view = 'ozet'"><i class="pi pi-th-large" /> Özet</button>
        <button type="button" :class="{ on: view === 'detay' }" :aria-pressed="view === 'detay'" @click="view = 'detay'"><i class="pi pi-table" /> Detaylı Tablolar</button>
      </div>
    </div>

    <!-- Bireysel uzmanın eski Özet'i (katalogda yok, SHOW_LEGACY_SUMMARY ile gizli): sayılar, harita, kontrol durumu ve tarih kartları. -->
    <template v-if="showSummary">
      <div class="top-kpis">
        <div v-for="kpi in topKpis" :key="kpi.label" class="top-kpi">
          <span class="top-kpi-icon" :class="kpi.tone"><i :class="kpi.icon" /></span>
          <div><small>{{ kpi.label }}</small><strong>{{ kpi.value }}</strong><span>{{ kpi.text }}</span></div>
        </div>
      </div>
      <div class="map-grid">
        <section class="card chart-card map-card">
          <template v-if="districtMode">
            <header><h3>{{ districtMode.name }} ilçe haritası</h3><small>İlçeye tıklayınca sayfa o ilçeye göre güncellenir; tekrar tıklayınca tüm ilçeler.</small></header>
            <div class="map-slot"><ExpertDistrictMap :city-code="districtMode.code" :stats="mapDistricts" :selected="selectedDistrict" @select="selectedDistrict = $event" /></div>
          </template>
          <template v-else>
            <header><h3>Türkiye haritası</h3><small>İle tıklayınca sayfa o ile göre güncellenir; tekrar tıklayınca tüm iller.</small></header>
            <div class="map-slot"><ExpertTurkeyMap :cities="mapCities" :selected="selectedCity" @select="selectedCity = $event" /></div>
          </template>
          <div class="map-legend">
            <span><i class="bad" /> Gecikmiş ya da uygun değil var</span>
            <span><i class="warn" /> 60 gün içinde kontrol</span>
            <span><i class="ok" /> Sorunsuz</span>
            <span><i class="empty" /> Ekipman yok</span>
          </div>
        </section>
        <ExpertOverviewStatus :timing="data.timing" :installations="data.installations" :scope="districtMode ? selectedDistrict || `${districtMode.name} · tüm ilçeler` : selectedCityName || 'Tüm firmalar'" />
      </div>
      <ExpertOverviewControls :agenda="data.agenda || []" :groups="groups" :query="viewQuery" />
    </template>

    <!-- Sekmeler: önce hizmet verilen lokasyonlar, sonra genel durum, tesisat ve formlar (takvim sol menüde: Kontrol Takvimi) -->
    <div v-if="detailTables" class="tabs">
      <button v-for="item in tabs" :key="item.key" type="button" :class="{ active: tab === item.key }" @click="tab = item.key"><i :class="item.icon" /> {{ item.label }}</button>
    </div>
    <!-- Haritada il seçiliyken sayfanın tamamı o ile göre -->
    <div v-if="selectedCity && detailTables" class="city-bar">
      <i :class="cityLoading ? 'pi pi-spin pi-spinner' : 'pi pi-map-marker'" />
      <span>Sayfa <strong>{{ selectedCityName }}</strong> iline göre gösteriliyor.</span>
      <button class="link-button" type="button" @click="selectedCity = null">Tüm iller</button>
    </div>

    <div v-if="loading && !data" class="card state"><i class="pi pi-spin pi-spinner" /> Özet hazırlanıyor...</div>
    <div v-else-if="error" class="card state error-text">{{ error }}</div>
    <div v-else-if="!groups.length" class="card state">{{ multiUser ? 'Henüz size atanmış bir işyeri yok.' : 'Henüz işyeriniz yok.' }} {{ kamu ? 'Lokasyonlar' : 'Firmalarım' }}'dan {{ multiUser ? 'işyeri' : 'firma' }} ekleyin.</div>

    <!-- Tasarım kataloğu 02 (bütün hesaplar): solda sayılar, ortada örnek yerleşim, sağda kontrol durumu çubukları;
         altta öncelikli kontroller ve en yakın kontrol günü. Kapsam üstteki lokasyon / firma seçicisinden. -->
    <template v-else-if="data && !detailTables">
      <div class="gb-top">
        <div class="gb-kpis">
          <NuxtLink v-for="kpi in sideKpis" :key="kpi.to" :to="kpi.to" class="card gb-kpi">
            <span class="gb-kpi-icon" :class="kpi.tone"><i :class="kpi.icon" /></span>
            <span class="gb-kpi-text"><strong>{{ kpi.value }}</strong><small>{{ kpi.label }}</small></span>
            <i class="pi pi-chevron-right" aria-hidden="true" />
          </NuxtLink>
        </div>
        <figure class="gb-hero">
          <img src="/katalog/yerlesim.svg" alt="" />
          <figcaption><i class="pi pi-map-marker" /> Örnek yerleşim</figcaption>
        </figure>
        <div class="gb-side">
          <NuxtLink v-for="box in statusBars" :key="box.to" :to="box.to" class="card gb-status">
            <span class="gb-status-head"><i :class="box.icon" /><strong>{{ box.title }}</strong><i class="pi pi-chevron-right" aria-hidden="true" /></span>
            <strong class="gb-status-total">{{ trNumber(box.total) }}</strong>
            <span class="gb-bar" role="img" :aria-label="box.parts.map(part => `${part.count} ${part.label}`).join(', ') || 'Kayıt yok'">
              <span v-for="part in box.parts" :key="part.key" :class="part.key" :style="{ width: `${part.share}%` }">{{ part.share >= 8 ? trNumber(part.count) : '' }}</span>
            </span>
            <span class="gb-legend"><span v-for="part in box.parts" :key="part.key"><i :class="part.key" /> {{ trNumber(part.count) }} {{ part.label }}</span></span>
          </NuxtLink>
        </div>
      </div>

      <div class="gb-bottom">
        <section class="card gb-panel">
          <header class="gb-panel-head"><span class="gb-head-icon"><i class="pi pi-list" /></span><h3>Öncelikli kontroller</h3></header>
          <div class="gb-inner">
            <p v-if="!priorityRows.length" class="muted gb-empty">Gecikmiş ya da 30 gün içinde dolan kontrol yok.</p>
            <div v-for="row in priorityRows" :key="row.key" class="gb-row">
              <span class="gb-row-icon"><i :class="row.kind === 'installation' ? 'pi pi-sitemap' : 'pi pi-box'" /></span>
              <span class="gb-row-name"><strong>{{ row.name }}</strong><small v-if="row.meta"> · {{ row.meta }}</small></span>
              <span class="gb-pill" :class="row.days_left < 0 ? 'bad' : 'warn'">{{ row.when }}</span>
              <button type="button" class="gb-inspect" @click="priorityDate = row.date">İncele <i class="pi pi-chevron-right" /></button>
            </div>
          </div>
        </section>
        <section class="card gb-panel">
          <header class="gb-panel-head"><span class="gb-head-icon"><i class="pi pi-calendar" /></span><h3>Kontrol takvimi</h3></header>
          <div class="gb-inner gb-next">
            <template v-if="nextDay">
              <span class="gb-date"><strong>{{ nextDate.day }}</strong><span>{{ nextDate.month }}</span></span>
              <span class="gb-next-text"><strong>{{ agendaGroupsText(nextDay.entries) }}</strong><small>{{ nextDate.long }}</small></span>
            </template>
            <p v-else class="muted gb-empty">Yaklaşan kontrol yok.</p>
          </div>
          <NuxtLink to="/expert/calendar" class="gb-go"><i class="pi pi-calendar" /> Takvime git <i class="pi pi-chevron-right" /></NuxtLink>
        </section>
      </div>
      <ExpertControlDayModal v-if="priorityDate" :date="priorityDate" :entries="entriesOnDate(priorityDate)" :query="viewQuery" @close="priorityDate = null" />
    </template>

    <template v-else-if="data && detailTables">
      <!-- 1) Hizmet verilen lokasyonlar: başta sayılar (KPI), Türkiye haritası ve sağında genel skor, altta lokasyon
           bazında PK durumu (% tamam) -->
      <template v-if="tab === 'locations'">
        <div v-if="!individual" class="kpis" :class="team ? 'four' : 'three'">
          <div class="kpi"><span>Aktif lokasyon</span><strong>{{ data.locations.length }}</strong><small>{{ districtMode ? `${districtCount} ilçede` : `${cityCount} ilde` }}<template v-if="!corporate"> · {{ scopeCounts.customers }} müşteri</template></small></div>
          <div class="kpi"><span>Takip edilen ekipman</span><strong>{{ data.totals.equipment }}</strong><small>{{ scopeCounts.workplaces }} işyeri</small></div>
          <div class="kpi"><span>Tesisat</span><strong>{{ data.installations.length }}</strong><small>{{ installationKpiText }}</small></div>
          <!-- OSGB / kurumsal: yönetici ve operasyon yöneticisi -->
          <div v-if="team" class="kpi" :class="{ warn: team.counts.unassigned, loading: teamLoading }"><span>Uzman</span><strong>{{ team.counts.experts }}</strong><small>{{ team.counts.unassigned ? `${team.counts.unassigned} firmanın uzmanı yok` : 'bütün firmaların uzmanı var' }}</small></div>
        </div>
        <div v-if="!individual" class="map-grid">
          <section class="card chart-card map-card">
            <!-- Kamu hesabında bütün lokasyonlar tek ildeyse o ilin ilçe haritası (kullanıcı 18 Ekim 2026) -->
            <template v-if="districtMode">
              <header><h3>{{ districtMode.name }} ilçe haritası</h3><small>İlçeye tıklayınca sayfa o ilçeye göre güncellenir; tekrar tıklayınca tüm ilçeler.</small></header>
              <ExpertDistrictMap :city-code="districtMode.code" :stats="mapDistricts" :selected="selectedDistrict" @select="selectedDistrict = $event" />
            </template>
            <template v-else>
              <header><h3>Türkiye haritası</h3><small>İle tıklayınca sayfa o ile göre güncellenir; tekrar tıklayınca tüm iller.</small></header>
              <ExpertTurkeyMap :cities="mapCities" :selected="selectedCity" @select="selectedCity = $event" />
            </template>
            <div class="map-legend">
              <span><i class="bad" /> Gecikmiş ya da uygun değil var</span>
              <span><i class="warn" /> 60 gün içinde kontrol</span>
              <span><i class="ok" /> Sorunsuz</span>
              <span><i class="empty" /> Ekipman yok</span>
            </div>
          </section>
          <section class="card chart-card gauge-card">
            <header><h3>Genel durum</h3><small>{{ districtMode ? selectedDistrict || `${districtMode.name} · tüm ilçeler` : selectedCityName || 'Tüm iller' }}</small></header>
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
        <!-- OSGB / kurumsal / kamu: yalnız boşluk mesajı taşıyacak kartlar gösterilmez (veri gelince görünür). -->
        <section v-if="!multiUser || summaryLocations.length" class="card list-card">
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
        <section v-if="!multiUser || data.category_scores.length" class="card list-card">
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
        <section v-if="!multiUser || typesLoading || typesError || typeRows.length" class="card list-card" :class="{ loading: typesLoading && typeRows.length }">
          <header><div><h3>Ekipman türleri</h3><small>{{ selectedCityName ? `${selectedCityName} · ` : '' }}Tür başına durum ve kontrol zamanı</small></div></header>
          <p v-if="typesLoading && !typeRows.length" class="muted pad"><i class="pi pi-spin pi-spinner" /> Yükleniyor...</p>
          <p v-else-if="typesError" class="muted pad error-text">{{ typesError }}</p>
          <p v-else-if="!typeRows.length" class="muted pad">Ekipman yok.</p>
          <ExpertTypeStatusTable v-else :types="typeRows" />
        </section>
        <!-- Tesisat özeti: kapsamdaki her tesisat kaydı (filtre + seçili il); en sorunlu üstte -->
        <section v-if="!multiUser || data.installations.length" class="card list-card">
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
      <section v-if="!multiUser || upcomingEntries.length" class="card list-card">
        <header><h3>Yaklaşan kontroller</h3><small>60 gün içinde dolan, en yakın önce. Satıra tıklayınca o günün kontrolleri açılır.</small></header>
        <p v-if="!upcomingEntries.length" class="muted pad">60 gün içinde dolan kontrol yok.</p>
        <ExpertAgendaTable v-else :entries="upcomingEntries" :limit="12" @select="upcomingDate = $event" />
      </section>
      <ExpertControlDayModal v-if="upcomingDate" :date="upcomingDate" :entries="entriesOnDate(upcomingDate)" :query="viewQuery" @close="upcomingDate = null" />

      <!-- Ana kategoriler ve yangın ekipmanları ayrı (yangın ekipmanları sayıca çok, diğerlerini bastırmasın) -->
      <div class="grid two">
        <section v-for="box in progressBoxes.filter(item => !multiUser || item.rows.length)" :key="box.key" class="card chart-card">
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
        <section v-if="!multiUser || data.installations.length" class="card list-card">
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
        <section v-if="!multiUser || data.bulk_reports.length" class="card list-card">
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
import { agendaDate, agendaGroupsText, agendaNextDay, agendaShortName } from '~/composables/controlAgenda'

// Genel Bakış: uzmanın tüm lokasyonlarındaki (ya da filtrelenen müşteri / lokasyon / işyerindeki) ekipman ve tesisat
// özeti; hangi lokasyonun sorunlu olduğu tek bakışta. Lokasyon çubuğuna tıklayınca o lokasyona iner.
// Kapsam üstteki lokasyon / firma menüsünden; bu sayfada menüde "Tüm lokasyonlar" da seçilebilir (dashboardScope).
definePageMeta({ layout: 'expert', middleware: 'expert', dashboardScope: true })

// Tasarım kataloğu (15 Kas 2026): sayfa bütün hesaplarda katalogdaki yerleşimde. Aşağıdaki bölümler katalogda yok, gizli;
// kodları ve istekleri yerinde, bayrak açılınca geri gelir.
// Bireysel uzmanın eski Özet'i: dört sayı kartı, Türkiye / ilçe haritası, Periyodik Kontrol Durumu halkaları, kontrol
// kartları (Bugün / 7 gün / 8-30 gün / Süresi geçen) ve iki tablo (Son Eklenen Kayıtlar, Dikkat Gerektiren Kontroller).
const SHOW_LEGACY_SUMMARY = false
// Özet / Detaylı Tablolar düğmesi ve sekmeler (Lokasyonlar, Genel durum, Tesisatlar ve formlar, Uzmanlar, Ceza):
// OSGB / kurumsal / kamuda sayfanın eski hâli; bireysel uzmanda Detaylı Tablolar.
const SHOW_DETAIL_TABLES = false

const INSTALLATION_STATUS: Record<string, string> = { uygun: 'Uygun', uygun_degil: 'Uygun değil', rapor_bekleniyor: 'Rapor bekleniyor', rapor_yok: 'Kontrol yok' }

// Sekmeler (önce hizmet verilen lokasyonlar); seçili sekme adres satırında (?sekme=).
const TABS = [
  { key: 'locations', label: 'Lokasyonlar', icon: 'pi pi-map' },
  { key: 'status', label: 'Genel durum', icon: 'pi pi-chart-pie' },
  { key: 'installations', label: 'Tesisatlar ve formlar', icon: 'pi pi-sitemap' }
] as const
const route = useRoute()
const router = useRouter()
const tab = ref<string>([...TABS.map(item => item.key), 'team', 'fines'].includes(String(route.query.sekme)) ? String(route.query.sekme) : 'locations')
watch(tab, value => router.replace({ query: value === 'locations' ? {} : { sekme: value } }))
// Özet (tek ekran) ve Detaylı Tablolar (eski sekmeler aynen); ?sekme= ile gelindiyse tablolar açılır.
const view = ref<'ozet' | 'detay'>(route.query.sekme ? 'detay' : 'ozet')

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
// İlçe haritası: bütün lokasyonlar tek ildeyse o ilin ilçeleri (kullanıcı 18 / 20 Ekim, 12 Kas 2026: bütün hesaplarda).
// Lokasyonların ilçeleri müşterilerin lokasyon listesinden.
const { kamu: kamuAccount, account: pkAccount } = useAccount()
// Karar filtreye göre değil, uzmanın hizmet verdiği bütün lokasyonlara (işyeri olan lokasyonlar) göre: hepsi tek ildeyse il haritası,
// değilse Türkiye haritası (kullanıcı 20 Ekim 2026: "sadece tek ilde bakıyorsa il haritası").
// OSGB ve kurumsalda da (kullanıcı 12 Kas 2026); orada müşteri listesi uzun olabilir, lokasyonlar tek ilde görünmeden çekilmez.
const districtEnabled = computed(() => kamuAccount.value || pkAccount.value?.type === 'expert'
  || new Set((fullData.value?.locations || []).map((location: any) => location.city_id).filter(Boolean)).size === 1)
// Müşterilerin lokasyonları: lokasyon → il ve ilçe adı (bir kez alınır).
const locationPlaces = ref<Record<number, { city: string; district: string }> | null>(null)
watch(districtEnabled, async (enabled) => {
  // Harita yalnız gizli bölümlerde: gizliyken müşteri / lokasyon listesi çekilmez.
  if (!enabled || locationPlaces.value || !(SHOW_LEGACY_SUMMARY || SHOW_DETAIL_TABLES)) return
  try {
    const customers = await get<any>('/customers')
    const list = Array.isArray(customers) ? customers : customers?.items || customers?.data || []
    const result: Record<number, { city: string; district: string }> = {}
    for (const customer of list) {
      const locations = await get<any[]>(`/customers/${customer.id}/locations`)
      for (const location of locations || []) result[location.id] = { city: location.city || '', district: location.district || '' }
    }
    locationPlaces.value = result
  } catch { locationPlaces.value = {} }
}, { immediate: true })
// Uzmanın hizmet verdiği iller (bütün işyerlerinin lokasyonları; seçili filtreden bağımsız).
const serviceCities = computed(() => new Set(groups.value.map(group => locationPlaces.value?.[group.location_id]?.city).filter(Boolean)))
const districtMode = computed(() => {
  if (!districtEnabled.value || !locationPlaces.value || serviceCities.value.size !== 1) return null
  const located = (fullData.value?.locations || []).find((location: any) => location.city_id)
  return located ? { code: located.city_id as number, name: located.city_name as string } : null
})
const districtOf = computed<Record<number, string>>(() => Object.fromEntries(Object.entries(locationPlaces.value || {}).map(([id, place]) => [id, place.district])))
const selectedDistrict = ref<string | null>(null)
const mapDistricts = computed(() => {
  const map = new Map<string, { name: string; count: number; equipment: number; overdue: number; nonconforming: number; upcoming: number }>()
  for (const location of fullData.value?.locations || []) {
    const name = districtOf.value[location.location_id]
    if (!name) continue
    const item = map.get(name) || { name, count: 0, equipment: 0, overdue: 0, nonconforming: 0, upcoming: 0 }
    item.count++
    item.equipment += location.total
    item.overdue += location.overdue
    item.nonconforming += location.nonconforming
    item.upcoming += location.upcoming
    map.set(name, item)
  }
  return [...map.values()]
})
const districtCount = computed(() => new Set((data.value?.locations || []).map((location: any) => districtOf.value[location.location_id]).filter(Boolean)).size)
// Seçili ilin (ilçe haritasında ilçenin) lokasyonları: sayfanın kapsamı (takvim listesi de dahil) bunlar.
const cityLocationIds = computed(() => selectedDistrict.value
  ? (fullData.value?.locations || []).filter((location: any) => districtOf.value[location.location_id] === selectedDistrict.value).map((location: any) => location.location_id)
  : selectedCity.value
    ? (fullData.value?.locations || []).filter((location: any) => location.city_id === selectedCity.value).map((location: any) => location.location_id)
    : null)
const viewQuery = computed(() => cityLocationIds.value ? { ...query.value, 'location_ids[]': cityLocationIds.value } : query.value)
watch([selectedCity, selectedDistrict], async () => {
  if (!cityLocationIds.value) { cityData.value = null; return }
  cityLoading.value = true
  try { cityData.value = await get('/pk-dashboard', viewQuery.value) }
  catch (e: any) { selectedCity.value = null; selectedDistrict.value = null; error.value = errorMessage(e, 'İl özeti alınamadı.') }
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
  // Bireysel uzmanın Özet görünümünde tablo yok; gereksiz istek atılmaz.
  if (!SHOW_DETAIL_TABLES || tab.value !== 'locations' || !groups.value.length || (pkAccount.value && !multiUser.value && view.value === 'ozet')) return
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
watch([tab, viewQuery, () => view.value], loadTypes, { deep: true })

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
const { multiUser, corporate, kamu, isManager, isOperation, load: loadAccount } = useAccount()
const teamView = computed(() => multiUser.value && (isManager.value || isOperation.value))
// Bireysel uzmanın üst bölümü: gerçek sayılar; hesap bilgisi gelmeden gösterilmez.
const individual = computed(() => !!pkAccount.value && !multiUser.value)
const showSummary = computed(() => SHOW_LEGACY_SUMMARY && individual.value && view.value === 'ozet' && !!data.value && groups.value.length > 0)
const detailTables = computed(() => SHOW_DETAIL_TABLES && (!individual.value || view.value === 'detay'))
const trNumber = (value: number) => new Intl.NumberFormat('tr-TR').format(value)

// --- Katalog yerleşimi (bütün hesaplar) ---
// Sağ üstteki kapsam: firma (kurumsal / kamuda yok) ve lokasyon sayısı.
const scopePill = computed(() => [!corporate.value && `${trNumber(scopeCounts.value.customers)} firma`, `${trNumber(data.value?.locations?.length || 0)} lokasyon`].filter(Boolean).join(' · '))
// Açık bulgu: menü rozetiyle aynı sayım (kapanmamış), sayfanın kapsamındaki lokasyonlarda.
const openFindings = ref<number | null>(null)
let findingsRequest = 0
watch(() => JSON.stringify(viewQuery.value['location_ids[]'] || []), async (key) => {
  const ids: number[] = JSON.parse(key)
  const no = ++findingsRequest
  if (!ids.length) { openFindings.value = null; return }
  try {
    const result = await get<{ open: number }>('/pk-findings/count', { 'location_ids[]': ids })
    if (no === findingsRequest) openFindings.value = result.open
  } catch { if (no === findingsRequest) openFindings.value = null }
}, { immediate: true })
const sideKpis = computed(() => [
  { to: '/expert/equipment', label: 'Ekipman', value: trNumber(data.value?.totals?.equipment || 0), icon: 'pi pi-box', tone: 'equipment' },
  { to: '/expert/installations', label: 'Tesisat', value: trNumber(data.value?.installations?.length || 0), icon: 'pi pi-sitemap', tone: 'installation' },
  { to: '/expert/bulgu-takip', label: 'Açık bulgu', value: openFindings.value === null ? '—' : trNumber(openFindings.value), icon: 'pi pi-exclamation-triangle', tone: 'finding' }
])
// Ekipman ve tesisat kontrol durumu çubuğu (Periyodik Kontrol Durumu halkalarıyla aynı hesap); yalnız sıfır olmayan dilimler.
const BAR_PARTS = [
  { key: 'ok', label: 'tamamlanan' },
  { key: 'soon', label: 'yaklaşan' },
  { key: 'overdue', label: 'süresi geçen' },
  { key: 'none', label: 'tarihi girilmemiş' }
] as const
const barOf = (title: string, to: string, icon: string, total: number, counts: Record<(typeof BAR_PARTS)[number]['key'], number>) => {
  const sum = BAR_PARTS.reduce((acc, part) => acc + counts[part.key], 0)
  return { title, to, icon, total, parts: BAR_PARTS.filter(part => counts[part.key]).map(part => ({ ...part, count: counts[part.key], share: (counts[part.key] / sum) * 100 })) }
}
const statusBars = computed(() => {
  const t = data.value?.timing || {}
  const installation = { ok: 0, soon: 0, overdue: 0, none: 0 }
  for (const item of data.value?.installations || []) {
    const days = item.days_left
    if (days === null || days === undefined) installation.none++
    else if (days < 0) installation.overdue++
    else if (days <= 60) installation.soon++
    else installation.ok++
  }
  return [
    barOf('Ekipmanlar', '/expert/equipment', 'pi pi-box', data.value?.totals?.equipment || 0, { ok: t.later || 0, soon: (t.d30 || 0) + (t.d60 || 0), overdue: t.overdue || 0, none: t.none || 0 }),
    barOf('Tesisatlar', '/expert/installations', 'pi pi-sitemap', data.value?.installations?.length || 0, installation)
  ]
})
// Öncelikli kontroller: süresi geçenler (en eski önce), sonra 30 gün içinde dolanlar (en yakın önce); ilk üç kalem.
// "İncele" o günün penceresini açar (takvimdeki gibi).
const priorityDate = ref<string | null>(null)
const priorityRows = computed(() => {
  const many = (data.value?.locations?.length || 0) > 1
  return (data.value?.agenda || []).filter((entry: any) => entry.days_left <= 30)
    .flatMap((entry: any) => (entry.groups || []).map((group: any) => ({ entry, group })))
    .sort((a: any, b: any) => a.entry.days_left - b.entry.days_left)
    .slice(0, 3)
    .map(({ entry, group }: any) => ({
      key: `${entry.date}|${entry.location_id}|${group.key}`,
      date: entry.date,
      days_left: entry.days_left,
      kind: group.kind,
      name: group.kind === 'installation' ? group.name : agendaShortName(group.name),
      meta: [group.count > 1 ? `${trNumber(group.count)} ekipman` : '', many ? locationLabel(entry.location_id, entry.location_name) : ''].filter(Boolean).join(' · '),
      when: entry.days_left < 0 ? `${trNumber(-entry.days_left)} gün gecikti` : entry.days_left === 0 ? 'Bugün' : `${entry.days_left} gün kaldı`
    }))
})
// Kontrol takvimi kartı: en yakın kontrol günü.
const nextDay = computed(() => agendaNextDay(data.value?.agenda))
const nextDate = computed(() => {
  const date = nextDay.value ? agendaDate(nextDay.value.date) : new Date()
  return {
    day: date.getDate(),
    month: new Intl.DateTimeFormat('tr-TR', { month: 'short' }).format(date).toLocaleUpperCase('tr-TR'),
    long: new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
  }
})
const topKpis = computed(() => [
  { label: 'Firmalar', value: trNumber(scopeCounts.value.customers), text: 'Takip edilen firmalar', icon: 'pi pi-building', tone: 'blue' },
  { label: 'Lokasyonlar', value: trNumber(data.value?.locations?.length || 0), text: `${trNumber(scopeCounts.value.workplaces)} işyeri`, icon: 'pi pi-map-marker', tone: 'amber' },
  { label: 'Ekipmanlar', value: trNumber(data.value?.totals?.equipment || 0), text: 'Takip edilen ekipman', icon: 'pi pi-wrench', tone: 'green' },
  { label: 'Tesisatlar', value: trNumber(data.value?.installations?.length || 0), text: installationKpiText.value, icon: 'pi pi-sitemap', tone: 'purple' }
])
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
  // Uzman özeti yalnız gizli sekmelerde (Uzman sayısı, Müşteri özeti, Uzmanlar).
  if (!teamView.value || !SHOW_DETAIL_TABLES) { team.value = null; teamKey = ''; return }
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
.view-switch { flex: none; display: inline-flex; gap: 4px; padding: 4px; border: 1px solid var(--admin-border); border-radius: 10px; background: var(--admin-card); }
.view-switch button { min-height: 38px; display: inline-flex; align-items: center; gap: 7px; padding: 0 14px; border: 0; border-radius: 7px; background: none; color: var(--admin-muted); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.view-switch button.on { background: var(--pk-yellow); color: #111827; }
.page-head p.summary-sub { color: var(--admin-heading); font-size: 15px; font-weight: 600; }
/* Tasarım kataloğu 02: başlık, kapsam, sayılar, örnek yerleşim, durum çubukları, öncelikli kontroller, takvim kartı */
.crumb { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: var(--admin-muted); font-size: 13px; }
.crumb a { color: var(--admin-muted); } .crumb a:hover { color: var(--admin-heading); }
.crumb strong { color: var(--admin-heading); font-weight: 600; } .crumb .pi-angle-right { font-size: 11px; }
.expert-dashboard .page-head h1 { font-size: 40px; font-weight: 800; letter-spacing: -1px; }
.expert-dashboard .page-head p { font-size: 15px; }
.scope-pill { display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border: 1px solid var(--admin-border); border-radius: 999px; background: var(--admin-card); color: var(--admin-heading); font-size: 14px; font-weight: 600; box-shadow: 0 6px 18px rgba(120, 90, 0, .06); }
.scope-pill i { color: var(--pk-yellow-dark); }
.gb-top { display: grid; grid-template-columns: 236px minmax(0, 1fr) 320px; gap: 16px; align-items: stretch; }
.gb-kpis, .gb-side { min-width: 0; display: flex; flex-direction: column; gap: 14px; }
.card.gb-kpi, .card.gb-status { flex: 1; border-radius: 16px; color: inherit; box-shadow: 0 10px 28px rgba(120, 90, 0, .06); transition: border-color .15s ease; }
.gb-kpi:hover, .gb-kpi:focus-visible, .gb-status:hover, .gb-status:focus-visible { border-color: var(--pk-yellow); }
.gb-kpi { display: flex; align-items: center; gap: 14px; padding: 16px 18px; }
.gb-kpi-icon { flex: none; width: 52px; height: 52px; display: grid; place-items: center; border-radius: 50%; font-size: 22px; }
.gb-kpi-icon.equipment { background: var(--admin-accent-soft); color: var(--pk-yellow-dark); }
.gb-kpi-icon.installation { background: #ebe9fe; color: #5925dc; }
.gb-kpi-icon.finding { background: var(--admin-danger-bg); color: var(--admin-danger-text); }
.gb-kpi-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.gb-kpi-text strong { color: var(--admin-heading); font-size: 30px; line-height: 1.1; }
.gb-kpi-text small { color: var(--admin-muted); font-size: 15px; }
.gb-kpi > .pi, .gb-status-head > .pi-chevron-right { color: var(--admin-heading); font-size: 13px; }
.gb-hero { position: relative; min-width: 0; margin: 0; display: flex; align-items: center; justify-content: center; }
.gb-hero img { width: 100%; max-height: 400px; object-fit: contain; }
.gb-hero figcaption { position: absolute; right: 12px; bottom: 6px; display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border: 1px solid var(--admin-border); border-radius: 999px; background: var(--admin-card); color: var(--admin-heading); font-size: 13px; font-weight: 600; }
.gb-status { display: flex; flex-direction: column; gap: 8px; padding: 16px 18px; }
.gb-status-head { display: flex; align-items: center; gap: 10px; }
.gb-status-head > i:first-child { color: var(--pk-yellow-dark); font-size: 18px; }
.gb-status-head strong { flex: 1; color: var(--admin-heading); font-size: 16px; }
.gb-status-total { color: var(--admin-heading); font-size: 30px; line-height: 1.1; }
.gb-bar { display: flex; gap: 2px; height: 26px; border-radius: 8px; background: var(--admin-chip); overflow: hidden; }
.gb-bar span { display: grid; place-items: center; color: #fff; font-size: 13px; font-weight: 800; }
.gb-bar .ok, .gb-legend i.ok { background: #12805c; }
.gb-bar .soon, .gb-legend i.soon { background: #f5b800; }
.gb-bar .overdue, .gb-legend i.overdue { background: #d92d20; }
.gb-bar .none, .gb-legend i.none { background: #a8b3c2; }
.gb-bar .soon { color: #111827; }
.gb-legend { display: flex; flex-wrap: wrap; gap: 6px 16px; color: var(--admin-muted); font-size: 13px; }
.gb-legend span { display: inline-flex; align-items: center; gap: 6px; }
.gb-legend i { width: 10px; height: 10px; border-radius: 50%; }
.gb-bottom { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr); gap: 16px; }
.card.gb-panel { display: flex; flex-direction: column; gap: 14px; padding: 18px 20px; border-radius: 18px; }
.gb-panel-head { display: flex; align-items: center; gap: 12px; }
.gb-panel-head h3 { font-size: 20px; font-weight: 800; }
.gb-head-icon { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 10px; background: var(--admin-accent-soft); color: var(--pk-yellow-dark); font-size: 16px; }
.gb-inner { border: 1px solid var(--admin-border); border-radius: 14px; background: var(--admin-surface); }
.gb-empty { padding: 18px 16px; }
.gb-row { display: grid; grid-template-columns: 48px minmax(0, 1fr) auto auto; align-items: center; gap: 16px; padding: 12px 16px; }
.gb-row + .gb-row { border-top: 1px solid var(--admin-row-border); }
.gb-row-icon { width: 48px; height: 48px; display: grid; place-items: center; border-radius: 12px; background: var(--admin-chip); color: var(--admin-heading); font-size: 20px; }
.gb-row-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gb-row-name strong { color: var(--admin-heading); font-size: 16px; }
.gb-row-name small { color: var(--admin-muted); font-size: 15px; }
.gb-pill { padding: 7px 18px; border-radius: 999px; font-size: 14px; font-weight: 700; white-space: nowrap; }
.gb-pill.bad { background: var(--admin-danger-bg); color: var(--admin-danger-text); }
.gb-pill.warn { background: var(--admin-warning-bg); color: var(--admin-warning-text); }
.gb-inspect { display: inline-flex; align-items: center; gap: 10px; padding: 9px 16px; border: 0; border-radius: 10px; background: var(--admin-accent-soft); color: var(--admin-accent-text); font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
.gb-inspect:hover, .gb-inspect:focus-visible { background: var(--pk-yellow); color: #111827; }
.gb-inspect .pi { font-size: 11px; }
.gb-next { flex: 1; display: flex; align-items: center; gap: 28px; padding: 20px 28px; }
.gb-date { flex: none; width: 106px; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--admin-border); border-radius: 14px; text-align: center; box-shadow: 0 6px 18px rgba(120, 90, 0, .08); }
.gb-date strong { padding: 10px 0 6px; background: var(--pk-yellow); color: #111827; font-size: 36px; line-height: 1.1; }
.gb-date span { padding: 6px 0 8px; background: var(--admin-surface); color: var(--admin-heading); font-size: 20px; font-weight: 800; }
.gb-next-text { min-width: 0; display: flex; flex-direction: column; gap: 6px; padding-left: 28px; border-left: 1px solid var(--admin-border); }
.gb-next-text strong { color: var(--admin-heading); font-size: 26px; font-weight: 800; line-height: 1.2; }
.gb-next-text small { color: var(--admin-muted); font-size: 17px; }
.gb-go { position: relative; display: flex; align-items: center; justify-content: center; gap: 12px; min-height: 54px; padding: 0 22px; border-radius: 12px; background: var(--pk-yellow); color: #111827; font-size: 17px; font-weight: 700; }
.gb-go:hover, .gb-go:focus-visible { background: var(--pk-yellow-dark); }
.gb-go .pi-chevron-right { position: absolute; right: 22px; font-size: 13px; }
@media (max-width: 1250px) {
  .gb-top { grid-template-columns: 220px minmax(0, 1fr); }
  .gb-side { grid-column: 1 / -1; flex-direction: row; }
  .gb-side > * { min-width: 0; }
}
@media (max-width: 1000px) { .gb-bottom { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 800px) {
  .expert-dashboard .page-head h1 { font-size: 32px; }
  .gb-top { grid-template-columns: minmax(0, 1fr); }
  .gb-hero { display: none; }
  .gb-side { flex-direction: column; }
  .gb-row { grid-template-columns: 40px minmax(0, 1fr) auto; gap: 10px; }
  .gb-row-icon { width: 40px; height: 40px; }
  .gb-inspect { grid-column: 2 / -1; justify-self: start; }
  .gb-next { gap: 16px; padding: 16px; }
  .gb-next-text { padding-left: 16px; }
}
.map-slot { flex: 1; min-height: 0; display: flex; }
.map-slot > * { flex: 1; min-width: 0; }
/* Özet tek ekrana sığar: harita ve halkalar kalan yüksekliği paylaşır; küçük ekranda normal kaydırma. */
@media (min-width: 1100px) and (min-height: 820px) {
  .expert-dashboard.fit { height: calc(100vh - 72px - 30px - 12px); margin-bottom: -28px; display: flex; flex-direction: column; gap: 8px; }
  .fit > * { flex: none; }
  .fit > .page-head { margin-bottom: 0; }
  .fit > .map-grid { flex: 1; min-height: 0; grid-template-rows: minmax(0, 1fr); }
  .fit .map-card { min-height: 0; overflow: hidden; padding-top: 12px; padding-bottom: 10px; }
  .fit .map-slot :deep(.district-map), .fit .map-slot :deep(.turkey-map) { height: 100%; }
  .fit .map-slot :deep(svg) { width: 100%; height: 100%; max-height: none; }
  .fit .map-legend { padding-top: 4px; }
  .fit .top-kpi { padding: 7px 14px; }
  .fit .top-kpi-icon { width: 42px; height: 42px; font-size: 19px; }
  .fit .top-kpi strong { font-size: 21px; }
}
.top-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
.top-kpi { min-width: 0; display: flex; align-items: center; gap: 14px; padding: 16px; border: 1px solid var(--admin-border); border-radius: 12px; background: var(--admin-card); }
.top-kpi-icon { flex: none; width: 50px; height: 50px; display: grid; place-items: center; border-radius: 12px; font-size: 22px; }
.top-kpi-icon.blue { background: #d1e9ff; color: #175cd3; } .top-kpi-icon.amber { background: #fef0c7; color: #b54708; } .top-kpi-icon.green { background: #dcfae6; color: #067647; } .top-kpi-icon.purple { background: #ebe9fe; color: #5925dc; }
.top-kpi > div { min-width: 0; display: grid; gap: 1px; }
.top-kpi small { color: var(--admin-heading); font-size: 13px; font-weight: 700; }
.top-kpi strong { color: var(--admin-heading); font-size: 26px; line-height: 1.15; }
.top-kpi span { color: var(--admin-muted); font-size: 12px; }
@media (max-width: 1100px) { .top-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 520px) { .top-kpis { grid-template-columns: minmax(0, 1fr); } }
.expert-dashboard{margin:0 auto;display:grid;gap:16px}
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
