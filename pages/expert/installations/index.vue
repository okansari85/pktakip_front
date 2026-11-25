<template>
  <div class="installations-page">
    <!-- Tesisatlar (tasarım kataloğu 07): başlık ve tür hapları. Detay görünümünde (08, ?tesisat=ID) sayfa yolu Tesisatlar > tesisat. -->
    <div class="page-head">
      <div class="head-title">
        <nav class="crumb" aria-label="Sayfa yolu">
          <PkIcon class="pi pi-home" aria-hidden="true" />
          <template v-if="detailView && detail">
            <a href="/expert/installations" @click.prevent="closeDetail">Tesisatlar</a>
            <PkIcon class="pi pi-angle-right" aria-hidden="true" />
            <strong>{{ detail.name }}</strong>
          </template>
          <template v-else>
            <!-- Ana Sayfa yalnız bireysel uzmanda var; diğer hesaplarda sayfa yolu Genel Bakış'ta başlar -->
            <NuxtLink :to="individual ? '/expert/anasayfa' : '/expert'">{{ individual ? 'Ana Sayfa' : 'Genel Bakış' }}</NuxtLink>
            <PkIcon class="pi pi-angle-right" aria-hidden="true" />
            <strong>Tesisatlar</strong>
          </template>
        </nav>
        <h1>{{ detailView && detail ? detail.name : 'Tesisatlar' }}</h1>
        <p class="lead">{{ context ? contextLabel : 'Üstten lokasyon ve firma seçin.' }}</p>
      </div>
      <!-- Tesisat türleri: yalnız bu lokasyonda tanımlı olanlar (ve eklenmek üzere seçilen); başka tür sondaki kutudan seçilir -->
      <div v-if="context && !detailView && shownTabs.length" class="type-pills">
        <button v-for="type in shownTabs" :key="type.slug" type="button" class="type-pill" :class="{ active: activeSlug === type.slug }" :aria-pressed="activeSlug === type.slug" @click="selectTab(type.slug)"><PkIcon :class="typeIcon(type.slug)" aria-hidden="true" /> {{ type.name }}</button>
        <Select v-if="addableTabs.length" :model-value="null" :options="addableTabs" option-label="name" option-value="slug" placeholder="Tesisat türü ekle" class="type-add" @update:model-value="selectTab" />
      </div>
    </div>

    <div v-if="!context" class="card empty-state">
      <PkIcon class="pi pi-map-marker" />
      <strong>Lokasyon seçilmedi</strong>
      <span>Tesisatları görmek için üstteki Lokasyon kutusundan seçim yapın.</span>
    </div>

    <template v-else>
      <div v-if="loading" class="card state">Tesisat yükleniyor...</div>
      <div v-else-if="error" class="card state error-text">{{ error }}</div>

      <!-- Bu lokasyonda tesisat yok -->
      <div v-else-if="!ofType.length" class="card empty-state">
        <PkIcon class="pi pi-sitemap" />
        <strong>Bu lokasyonda {{ activeType?.name || 'tesisat' }} tanımlı değil</strong>
        <span>Tesisatı ve içindeki sistemleri ekleyin. Periyodik kontrol raporları sonradan eklenir.</span>
        <button v-if="activeType" class="primary-button" type="button" @click="openCreate"><PkIcon class="pi pi-plus" /> Tesisat Ekle</button>
        <!-- Lokasyonda hiç tesisat yoksa önce tür seçilir; seçilen tür sekme olur, Tesisat Ekle açılır -->
        <Select v-else :model-value="null" :options="tabs" option-label="name" option-value="slug" placeholder="Tesisat türü seçin" @update:model-value="selectTab" />
      </div>

      <template v-else>
        <!-- Aynı türden birden fazla tesisat varsa (ör. işyerine ait) seçim. Elektrik ailesinde her zaman: bina bazında rapor
             gelirse her bina ayrı kayıt ("Tesisat ekle"); birden çok kayıtta üstte özet, her kaydın durumu noktada -->
        <template v-if="!detailView && (ofType.length > 1 || isElectricalTab)">
          <p v-if="isElectricalTab && ofType.length > 1" class="picker-summary">
            {{ ofType.length }} {{ activeType?.name || 'tesisat' }} kaydı<template v-if="ofTypeCount('uygun_degil')"> · <strong class="bad">{{ ofTypeCount('uygun_degil') }} uygun değil</strong></template><template v-if="ofTypeCount('rapor_yok')"> · {{ ofTypeCount('rapor_yok') }} kontrol yok</template>
          </p>
          <div class="picker">
            <button v-for="item in ofType" :key="item.id" type="button" class="chip" :class="{ active: selectedId === item.id }" :title="STATUS_LABELS[item.status] || ''" @click="selectInstallation(item.id)">
              <span v-if="isElectricalTab" class="dot" :class="item.status" /> {{ item.name }} <span>{{ installationArea(item.id) || placeOf(item) }}</span>
            </button>
            <button v-if="isElectricalTab" type="button" class="chip add" title="Bina bazında rapor geliyorsa her bina için ayrı kayıt" @click="openCreate">
              <PkIcon class="pi pi-plus" /> Tesisat ekle
            </button>
          </div>
        </template>

        <div v-if="detailLoading && !detail" class="card state">Tesisat yükleniyor...</div>
        <template v-else-if="detail && !detailView">
          <!-- Genel bakış: seçili tesisatın durumu, sayılar, rapor; altta sistemler -->
          <div class="top">
            <section class="card status-card">
              <header>
                <PkIcon :class="typeIcon(detail.type?.slug)" class="type-icon" aria-hidden="true" />
                <h2>{{ detail.name }}</h2>
                <span class="status-pill" :class="detail.status"><PkIcon :class="STATUS_ICONS[detail.status]" /> {{ STATUS_LABELS[detail.status] }}</span>
              </header>
              <p v-if="ofType.length > 1 || installationArea(detail.id) || detail.workplace" class="place-line"><template v-if="installationArea(detail.id)">{{ installationArea(detail.id) }} · </template>{{ placeOf(detail) }}</p>
              <dl class="facts">
                <div><dt><PkIcon class="pi pi-calendar" /> Son kontrol</dt><dd>{{ formatDate(detail.last_control_date) }}</dd></div>
                <div><dt><PkIcon class="pi pi-calendar" /> Geçerlilik</dt><dd>{{ formatDate(detail.next_control_date) }}</dd></div>
              </dl>
              <!-- Kalan gün / süresi geçti; kontrol yoksa ya da rapor bekleniyorsa kısa not -->
              <p v-if="detail.status === 'rapor_bekleniyor'" class="due-strip soon"><PkIcon class="pi pi-hourglass" /> {{ formatDate(detail.last_control_date) }} kontrolünün raporu bekleniyor</p>
              <p v-else-if="detail.status === 'rapor_yok'" class="due-strip"><PkIcon class="pi pi-info-circle" /> {{ detail.reports.length ? 'Henüz tesisat raporu yok' : 'Henüz kontrol eklenmedi' }}</p>
              <p v-else-if="dueText" class="due-strip" :class="daysKey(detail.days_left)"><PkIcon :class="detail.days_left < 0 ? 'pi pi-exclamation-triangle' : 'pi pi-clock'" /> {{ dueShort }}</p>
              <button class="primary-button" type="button" @click="openControl()"><PkIcon class="pi pi-plus" /> Kontrol ekle</button>
              <button class="outline-button" type="button" @click="openDetail()"><PkIcon class="pi pi-file" /> Detayları aç <PkIcon class="pi pi-angle-right push" /></button>
            </section>
            <div class="top-right">
              <div class="kpis">
                <button type="button" class="kpi blue" @click="openDetail()">
                  <span class="kpi-icon"><PkIcon class="pi pi-sitemap" /></span>
                  <span class="kpi-text"><strong>{{ ofType.length }}</strong><small>Tesisat</small></span>
                  <PkIcon class="pi pi-angle-right kpi-arrow" aria-hidden="true" />
                </button>
                <button type="button" class="kpi ok" @click="openDetail()">
                  <span class="kpi-icon"><PkIcon class="pi pi-shield" /></span>
                  <span class="kpi-text"><strong>{{ listSystems.length }}</strong><small>Fiziksel sistem</small></span>
                  <PkIcon class="pi pi-angle-right kpi-arrow" aria-hidden="true" />
                </button>
                <button type="button" class="kpi warn wide" @click="navigateTo('/expert/bulgu-takip')">
                  <span class="kpi-icon"><PkIcon class="pi pi-exclamation-triangle" /></span>
                  <span class="kpi-text"><strong>{{ totalFindings }}</strong><small>Açık bulgu</small></span>
                  <PkIcon class="pi pi-angle-right kpi-arrow" aria-hidden="true" />
                </button>
              </div>
              <!-- Son tesisat raporu: kuruluş, rapor no, raporu aç -->
              <section class="card report-card">
                <header><PkIcon class="pi pi-file" /><h3>Rapor</h3></header>
                <dl class="facts">
                  <div><dt>Kuruluş</dt><dd>{{ detail.inspection_body || '—' }}</dd></div>
                  <div><dt>Rapor No</dt><dd>{{ detail.report_no || '—' }}</dd></div>
                </dl>
                <button v-if="generalReport?.has_report" class="primary-button" type="button" @click="openReport(generalReport)"><PkIcon class="pi pi-external-link" /> Raporu aç</button>
                <p v-else class="muted">{{ detail.reports.length ? 'Rapor dosyası yok.' : 'Henüz tesisat raporu yok.' }}</p>
              </section>
            </div>
          </div>

          <!-- Sistemler: satırın oku detayı o sistem açık olarak açar -->
          <section class="card systems-card">
            <header class="systems-head">
              <h2>Sistemler</h2>
              <small v-if="cardSystems.length">Belge ve proje kontrolleri ayrıca izlenir</small>
              <button class="primary-button" type="button" @click="editOpen = true"><PkIcon class="pi pi-plus" /> Sistem ekle</button>
            </header>
            <div v-if="!listSystems.length" class="empty-inline"><PkIcon class="pi pi-th-large" /> Henüz sistem yok. “Sistem ekle” ile katalogdan seçin.</div>
            <div v-else class="table-wrap">
              <PkTable class="systems-table">
                <thead><tr><th>Sistem</th><th>Ekipman</th><th>Son kontrol</th><th>Durum</th><th>Bulgular</th><th class="actions-col"><span class="sr-only">Aç</span></th></tr></thead>
                <tbody>
                  <tr v-for="system in listSystems" :key="system.id" @click="openDetail(system.id)">
                    <td><span class="system-cell"><PkIcon class="pi pi-th-large" aria-hidden="true" /> <strong>{{ system.name }}</strong></span></td>
                    <td>{{ system.has_equipment ? system.equipment.length : (systemMeta(system) || '—') }}</td>
                    <td>{{ formatDate(system.last_control_date) }}</td>
                    <td><span class="status-badge" :class="system.status"><PkIcon :class="STATUS_ICONS[system.status]" /> {{ STATUS_LABELS[system.status] }}</span></td>
                    <td>{{ system.findings.length }}</td>
                    <td class="actions-col"><button class="icon-button" type="button" :aria-label="`${system.name} ayrıntıları`" @click.stop="openDetail(system.id)"><PkIcon class="pi pi-angle-right" /></button></td>
                  </tr>
                </tbody>
              </PkTable>
            </div>
          </section>
        </template>

        <template v-else-if="detail">
          <!-- Genel bilgiler: katalogda yok, gizli (SHOW_LEGACY_OVERVIEW); Düzenle ve Rapor bekleniyor burada (Sistem ekle aynı düzenleme penceresini açar) -->
          <section v-if="SHOW_LEGACY_OVERVIEW" class="card overview" :class="detail.status">
            <div class="overview-main">
              <div class="overview-icon"><PkIcon class="pi pi-shield" /></div>
              <div class="overview-title">
                <h2>{{ detail.name }}</h2>
                <p><template v-if="installationArea(detail.id)">{{ installationArea(detail.id) }} · </template>{{ placeOf(detail) }} · {{ detail.location?.name }}</p>
              </div>
              <div class="overview-status">
                <div class="pills">
                  <span class="status-pill" :class="detail.status"><PkIcon :class="STATUS_ICONS[detail.status]" /> {{ STATUS_LABELS[detail.status] }}</span>
                  <!-- Kontrol süresi geçti: ayrı rozet -->
                  <span v-if="overdueDays" class="status-pill overdue"><PkIcon class="pi pi-clock" /> Süresi geçti · {{ overdueDays }} gün</span>
                </div>
                <small v-if="dueText && !overdueDays" class="due" :class="daysKey(detail.days_left)">{{ dueText }}</small>
              </div>
              <div class="overview-actions">
                <button class="secondary-button" type="button" @click="editOpen = true"><PkIcon class="pi pi-pencil" /> Düzenle</button>
                <!-- Tesisata bağlı ekipmanlar için de tek kayıt: ekipman bazında rapor bekleniyor yapılmaz -->
                <button class="secondary-button" type="button" @click="pendingOpen = true"><PkIcon class="pi pi-hourglass" /> Rapor bekleniyor</button>
                <button class="primary-button" type="button" @click="openControl()"><PkIcon class="pi pi-file-arrow-up" /> Kontrol Ekle</button>
              </div>
            </div>

            <p v-if="detail.status === 'rapor_bekleniyor'" class="notice warn">
              <PkIcon class="pi pi-hourglass" /> {{ formatDate(detail.last_control_date) }} kontrolünün raporu bekleniyor. Sistemlerin ve ekipmanların durumu önceki kontrolden; rapor gelince “Kontrol Ekle” ile yükleyin.
            </p>
            <p v-if="detail.status === 'rapor_yok' && detail.reports.length" class="notice">
              <PkIcon class="pi pi-info-circle" /> Henüz tesisat raporu yok; yalnızca sistem raporları yüklendi. Genel durum ve kalan gün tesisat raporundan gelir; tesisat raporunu “Kontrol Ekle” ile yükleyin.
            </p>
            <p v-else-if="detail.status === 'rapor_yok'" class="notice">
              <PkIcon class="pi pi-info-circle" /> Bu tesisat için henüz kontrol eklenmedi. Periyodik kontrol raporunu “Kontrol Ekle” ile yükleyin; genel durum ve kalan gün tesisat raporundan gelir.
            </p>
            <div v-else class="info-strip">
              <div><small>Kontrolü yapan</small><strong>{{ detail.inspection_body || '—' }}</strong></div>
              <div><small>Rapor no</small><strong>{{ detail.report_no || '—' }}</strong></div>
              <div><small>Son kontrol</small><strong>{{ formatDate(detail.last_control_date) }}</strong></div>
              <div><small>Geçerlilik tarihi</small><strong>{{ formatDate(detail.next_control_date) }}</strong></div>
              <div><small>Kalan gün</small><strong class="days" :class="daysKey(detail.days_left)">{{ daysText(detail.days_left) }}</strong></div>
            </div>

            <div class="stats">
              <div><strong>{{ detail.systems.length }}</strong><small>Sistem</small></div>
              <div class="ok"><strong>{{ countStatus('uygun') }}</strong><small>Uygun sistem</small></div>
              <div class="bad"><strong>{{ countStatus('uygun_degil') }}</strong><small>Uygun olmayan sistem</small></div>
              <div class="warn"><strong>{{ totalFindings }}</strong><small>Bulgu</small></div>
            </div>
          </section>

          <!-- Tesisat detayı: kontrol bilgileri ve durum, açık bulgular, belge kontrolleri -->
          <div class="top detail-top">
            <section class="card status-card">
              <header><PkIcon class="pi pi-clipboard accent-icon" aria-hidden="true" /><h2>Kontrol bilgileri</h2></header>
              <div class="status-row">
                <span class="status-pill" :class="detail.status"><PkIcon :class="STATUS_ICONS[detail.status]" /> {{ STATUS_LABELS[detail.status] }}</span>
                <span v-if="dueShort && detail.status !== 'rapor_yok'" class="due-chip" :class="daysKey(detail.days_left)"><PkIcon :class="detail.days_left < 0 ? 'pi pi-exclamation-triangle' : 'pi pi-clock'" /> {{ dueShort }}</span>
              </div>
              <dl class="facts">
                <div><dt><PkIcon class="pi pi-building" /> Kontrol kuruluşu</dt><dd>{{ detail.inspection_body || '—' }}</dd></div>
                <div><dt><PkIcon class="pi pi-calendar" /> Son kontrol</dt><dd>{{ formatDate(detail.last_control_date) }}</dd></div>
                <div><dt><PkIcon class="pi pi-calendar" /> Geçerlilik</dt><dd>{{ formatDate(detail.next_control_date) }}</dd></div>
                <div><dt><PkIcon class="pi pi-file" /> Rapor no</dt><dd>{{ detail.report_no || '—' }}</dd></div>
              </dl>
              <p v-if="detail.status === 'rapor_bekleniyor'" class="notice warn">
                <PkIcon class="pi pi-hourglass" /> {{ formatDate(detail.last_control_date) }} kontrolünün raporu bekleniyor. Sistemlerin ve ekipmanların durumu önceki kontrolden; rapor gelince “Yeni kontrol ekle” ile yükleyin.
              </p>
              <p v-else-if="detail.status === 'rapor_yok' && detail.reports.length" class="notice">
                <PkIcon class="pi pi-info-circle" /> Henüz tesisat raporu yok; yalnızca sistem raporları yüklendi. Genel durum ve kalan gün tesisat raporundan gelir.
              </p>
              <p v-else-if="detail.status === 'rapor_yok'" class="notice">
                <PkIcon class="pi pi-info-circle" /> Bu tesisat için henüz kontrol eklenmedi. Genel durum ve kalan gün tesisat raporundan gelir.
              </p>
              <button class="primary-button" type="button" @click="openControl()"><PkIcon class="pi pi-plus" /> Yeni kontrol ekle</button>
            </section>
            <div class="top-right">
              <!-- Son kontrolün bulguları (sistemler, belge kontrolleri ve genel); işler Bulgu takibinde -->
              <section class="card side-card">
                <header>
                  <PkIcon class="pi pi-exclamation-triangle bad-icon" aria-hidden="true" />
                  <h3>Açık bulgular</h3>
                  <span class="count-badge" :class="{ none: !openFindings.length }">{{ openFindings.length }}</span>
                </header>
                <ul v-if="openFindings.length" class="side-list">
                  <li v-for="(item, index) in openFindings.slice(0, 3)" :key="index">
                    <NuxtLink to="/expert/bulgu-takip" class="side-row" :title="item.system ? `${item.system}: ${item.text}` : item.text">
                      <PkIcon class="pi pi-file" aria-hidden="true" /><span class="clamp">{{ item.text }}</span><PkIcon class="pi pi-angle-right" aria-hidden="true" />
                    </NuxtLink>
                  </li>
                </ul>
                <p v-else class="muted">Son kontrolde bulgu yok.</p>
                <NuxtLink v-if="openFindings.length" to="/expert/bulgu-takip" class="soft-link">Bulguları aç <PkIcon class="pi pi-arrow-right" /></NuxtLink>
              </section>
              <!-- Belge ve kayıt / proje bilgileri: durum; satıra tıklayınca bulguları -->
              <section class="card side-card">
                <header><PkIcon class="pi pi-file accent-icon" aria-hidden="true" /><h3>Belge kontrolleri</h3></header>
                <ul v-if="docChecks.length" class="side-list">
                  <li v-for="system in docChecks" :key="system.id">
                    <button type="button" class="side-row doc-row" :aria-expanded="isOpen(system.id)" @click="toggle(system.id)">
                      <PkIcon :class="system.status === 'uygun' ? 'pi pi-check ok-icon' : system.status === 'uygun_degil' ? 'pi pi-times bad-icon' : 'pi pi-minus'" aria-hidden="true" />
                      <span>{{ system.name }}</span>
                      <span class="status-badge" :class="system.status">{{ STATUS_LABELS[system.status] }}</span>
                    </button>
                    <ol v-if="isOpen(system.id)" class="findings doc-findings">
                      <li v-for="(finding, index) in system.findings" :key="index">{{ finding }}</li>
                      <li v-if="!system.findings.length" class="muted">{{ system.status === 'rapor_yok' ? 'Henüz kontrol yok.' : 'Bulgu yok.' }}</li>
                    </ol>
                  </li>
                </ul>
                <p v-else class="muted">Bu tesisatta belge kontrolü yok.</p>
              </section>
            </div>
          </div>

          <!-- Belge ve kayıt / proje bilgileri / tesis özellikleri kartları: katalogda yok, gizli (SHOW_INFO_CARDS); belge kontrolleri sağdaki
               kartta, tesis özellikleri ve notlar Belgeler sekmesinde -->
          <div v-if="SHOW_INFO_CARDS && (cardSystems.length || generalNotes)" class="info-cards">
            <article v-for="system in cardSystems" :key="system.id" class="card info-card">
              <header>
                <div><strong>{{ system.name }}</strong><small>{{ cardHint(system) }}</small></div>
                <span v-if="!isFacilityCard(system)" class="status-badge" :class="system.status">{{ STATUS_LABELS[system.status] }}</span>
              </header>
              <!-- Tesis Özellikleri: tesisat raporundaki tesis bilgileri, raporun etiketleriyle -->
              <template v-if="isFacilityCard(system)">
                <dl v-if="facilityCells(system).length" class="facility-list">
                  <template v-for="cell in facilityCells(system)" :key="cell.label"><dt>{{ cell.label }}</dt><dd>{{ cell.value }}</dd></template>
                </dl>
                <p v-else class="muted">Tesisat raporunda tesis bilgisi yok.</p>
              </template>
              <ol v-else-if="system.findings.length" class="findings">
                <li v-for="(finding, index) in shownFindings(system)" :key="index">{{ finding }}</li>
              </ol>
              <p v-else class="muted">{{ system.status === 'rapor_yok' ? 'Henüz kontrol yok.' : 'Bulgu yok.' }}</p>
              <button v-if="system.findings.length > 3" class="link-button" type="button" @click="toggle(system.id)">
                {{ isOpen(system.id) ? 'Daha az göster' : `Tüm bulgular (${system.findings.length})` }}
              </button>
            </article>
            <!-- Elektrik ailesi: tesisat raporunun notlar bölümü -->
            <article v-if="generalNotes" class="card info-card">
              <header>
                <div><strong>Notlar</strong><small>{{ formatDate(generalReport?.control_date) }} tesisat raporundan</small></div>
              </header>
              <p class="notes-text">{{ generalNotes }}</p>
            </article>
          </div>

          <!-- Sistemler / Kontrol geçmişi / Belgeler -->
          <section class="card tabs-card">
            <div class="tabs-row">
              <div class="tabs" role="tablist">
                <button type="button" role="tab" :aria-selected="detailTab === 'systems'" :class="{ active: detailTab === 'systems' }" @click="detailTab = 'systems'"><PkIcon class="pi pi-th-large" /> Sistemler</button>
                <button type="button" role="tab" :aria-selected="detailTab === 'history'" :class="{ active: detailTab === 'history' }" @click="detailTab = 'history'"><PkIcon class="pi pi-history" /> Kontrol geçmişi</button>
                <button type="button" role="tab" :aria-selected="detailTab === 'docs'" :class="{ active: detailTab === 'docs' }" @click="detailTab = 'docs'"><PkIcon class="pi pi-file" /> Belgeler</button>
              </div>
              <button v-if="detailTab === 'systems'" class="primary-button" type="button" @click="editOpen = true"><PkIcon class="pi pi-plus" /> Sistem ekle</button>
            </div>

            <!-- Sistemler: satıra tıklayınca ekipmanları ve son kontrol bulguları açılır -->
            <template v-if="detailTab === 'systems'">
            <p v-if="detail.pending_systems?.length" class="pending-note">
              <PkIcon class="pi pi-hourglass" />
              <span>
                Katalog onayı bekliyor:
                <template v-for="(item, index) in detail.pending_systems" :key="item.id"><strong>{{ item.name }}</strong> ({{ formatDate(item.control_date) }} kontrolü){{ index < detail.pending_systems.length - 1 ? ', ' : '' }}</template>.
                Onaylanınca bu sistemler kontroldeki sonuçlarıyla eklenir.
              </span>
            </p>
            <div v-if="!listSystems.length" class="empty-inline">
              <PkIcon class="pi pi-th-large" /> Henüz sistem yok. “Sistem ekle” ile katalogdan seçin.
            </div>
            <div v-else class="system-list">
              <div v-for="system in listSystems" :key="system.id" class="system-item" :class="{ open: isOpen(system.id) }">
                <div class="system-head">
                  <button class="system-line" type="button" @click="toggle(system.id)">
                    <span class="dot" :class="system.status" />
                    <span class="system-name">
                      <strong>{{ system.name }}</strong>
                      <small>{{ system.last_control_date ? `Son kontrol ${formatDate(system.last_control_date)}` : 'Henüz kontrol yok' }}</small>
                    </span>
                    <span class="meta">{{ system.has_equipment ? `${system.equipment.length} ekipman` : systemMeta(system) }}</span>
                    <span class="meta" :class="{ strong: system.findings.length }">{{ system.findings.length }} bulgu</span>
                    <span class="status-badge" :class="system.status">{{ STATUS_LABELS[system.status] }}</span>
                    <PkIcon :class="isOpen(system.id) ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" />
                  </button>
                  <!-- Sistemin raporu (dolap, pano…): yalnızca bu sistemi günceller; tesisatın genel durumu tesisat raporundan -->
                  <button v-if="system.system_id" class="icon-button upload" type="button" title="Rapor yükle" aria-label="Rapor yükle" @click="openControl(system)"><PkIcon class="pi pi-file-arrow-up" /></button>
                </div>
                <div v-if="isOpen(system.id)" class="system-body">
                  <template v-if="system.has_equipment">
                    <div class="body-head">
                      <h4>Ekipmanlar</h4>
                      <button class="secondary-button small" type="button" @click="equipmentSystemId = system.id"><PkIcon class="pi pi-plus" /> Ekipman ekle</button>
                    </div>
                    <div v-if="system.equipment.length" class="table-wrap">
                      <PkTable class="equipment-table">
                        <thead><tr><th>Ekipman no</th><th>Tür / Etiket</th><th>Konum</th><th>Son kontrol</th><th>Gelecek kontrol</th><th>Kalan gün</th><th>Durum</th></tr></thead>
                        <tbody>
                          <tr v-for="item in system.equipment" :key="item.id" @click="navigateTo(`/expert/equipment/${item.id}`)">
                            <td><strong v-if="item.code">{{ item.code }}</strong><span v-else class="muted">—</span></td>
                            <td>{{ item.type?.name }}<span v-if="item.variant" class="tag">{{ item.variant }}</span></td>
                            <td>{{ item.place || placeOf(item) }}</td>
                            <td>{{ formatDate(item.last_control_date) }}</td>
                            <td>{{ formatDate(item.next_control_date) }}</td>
                            <td><span class="days" :class="daysKey(item.days_left)">{{ daysText(item.days_left) }}</span></td>
                            <td><span class="status-badge" :class="item.status">{{ EQUIPMENT_STATUS_LABELS[item.status] || item.status }}</span></td>
                          </tr>
                        </tbody>
                      </PkTable>
                    </div>
                    <p v-else class="muted">Henüz ekipman yok. “Ekipman ekle” ile ekleyin; eklenenler Ekipmanlar menüsünde de görünür.</p>
                  </template>
                  <!-- Elektrik ailesi: sistemin raporları (pano başına ayrı rapor olabilir). Satır açılınca raporun bulguları ve ölçüm
                       sonuçları, rapordaki tablolar raporda nasılsa öyle (sütunlar raporun başlıkları ve sırasıyla); Ekipmanlar'a
                       eklenmez. 11 aydan eski ya da aynı pano için yenisi gelen raporlar "Önceki raporlar"da. -->
                  <template v-if="currentOf(system).length || previousOf(system).length">
                    <div class="body-head">
                      <h4>Raporlar</h4>
                      <small class="muted">Sistemin durumu son kontroldeki raporların en kötüsü</small>
                    </div>
                    <div class="table-wrap">
                      <PkTable class="equipment-table static entry-table">
                        <thead><tr><th>Kontrol tarihi</th><th>Rapor</th><th>Raporda</th><th>Sonuç</th><th>Bulgu</th><th /></tr></thead>
                        <tbody>
                          <template v-for="(entry, entryIndex) in [...currentOf(system), ...(openPrevious.includes(system.id) ? previousOf(system) : [])]" :key="entry.report_id">
                            <tr :class="{ previous: entryIndex >= currentOf(system).length }">
                              <td>{{ formatDate(entry.control_date) }}</td>
                              <td class="report-cell">
                                <button v-if="entry.has_report" class="link-button" type="button" :title="entry.report_no || ''" @click="openReport({ id: entry.report_id })"><PkIcon class="pi pi-file-pdf" /> <span class="truncate">{{ entry.report_no || 'Görüntüle' }}</span></button>
                                <span v-else class="muted truncate" :title="entry.report_no || ''">{{ entry.report_no || '—' }}</span>
                              </td>
                              <td class="subject-cell">
                                <span v-if="!entry.scope" class="tag first">Tesisat raporu</span>
                                <span v-if="entrySubject(entry)" class="clamp" :title="entrySubject(entry)">{{ entrySubject(entry) }}</span>
                              </td>
                              <td><span class="status-badge" :class="entry.status || 'belirtilmemis'">{{ STATUS_LABELS[entry.status || 'belirtilmemis'] }}</span></td>
                              <td>{{ entry.findings.length || '—' }}</td>
                              <td class="actions-col">
                                <button v-if="entryHasDetail(entry)" class="icon-button" type="button" :title="isEntryOpen(system, entry) ? 'Kapat' : `Bulgular ve ${resultsLabel.title.toLocaleLowerCase('tr-TR')}`" @click="toggleEntry(system, entry)">
                                  <PkIcon :class="isEntryOpen(system, entry) ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" />
                                </button>
                              </td>
                            </tr>
                            <tr v-if="isEntryOpen(system, entry)" class="entry-detail">
                              <td colspan="6">
                                <template v-if="entry.findings.length">
                                  <strong class="measure-title">Bulgular</strong>
                                  <ol class="findings entry-findings"><li v-for="(finding, index) in entry.findings" :key="index">{{ finding }}</li></ol>
                                </template>
                                <template v-if="entry.components.length">
                                  <strong class="measure-title">{{ resultsLabel.title }}</strong>
                                  <div v-for="table in measurementTables(entry.components)" :key="table.key" class="measure-block">
                                    <small v-if="table.name" class="measure-name">{{ table.name }}</small>
                                    <div class="table-wrap">
                                      <PkTable class="equipment-table static measure-table">
                                        <thead>
                                          <tr>
                                            <th>{{ table.codeLabel }}</th>
                                            <th v-if="table.showPlace">Konum</th>
                                            <th v-for="column in table.columns" :key="column">{{ column }}</th>
                                            <th>Sonuç</th>
                                            <th v-if="table.hasFindings">Bulgu</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          <tr v-for="(item, index) in table.rows" :key="index">
                                            <td><strong v-if="item.code">{{ item.code }}</strong><span v-else class="muted">—</span></td>
                                            <td v-if="table.showPlace">{{ item.place || '—' }}</td>
                                            <td v-for="column in table.columns" :key="column">{{ cellOf(item, column) }}</td>
                                            <td><span class="status-badge" :class="item.status || 'belirtilmemis'">{{ EQUIPMENT_STATUS_LABELS[item.status || 'belirtilmemis'] }}</span></td>
                                            <td v-if="table.hasFindings" :title="(item.findings || []).join('\n')">{{ item.findings?.length || '—' }}</td>
                                          </tr>
                                        </tbody>
                                      </PkTable>
                                    </div>
                                  </div>
                                </template>
                              </td>
                            </tr>
                          </template>
                        </tbody>
                      </PkTable>
                    </div>
                    <button v-if="previousOf(system).length" class="link-button" type="button" @click="togglePrevious(system)">
                      <PkIcon :class="openPrevious.includes(system.id) ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" />
                      {{ openPrevious.includes(system.id) ? 'Önceki raporları gizle' : `Önceki raporlar (${previousOf(system).length})` }}
                    </button>
                  </template>
                  <h4>Son kontrol bulguları</h4>
                  <ol v-if="system.findings.length" class="findings">
                    <li v-for="(finding, index) in system.findings" :key="index">{{ finding }}</li>
                  </ol>
                  <p v-else class="muted">{{ system.status === 'rapor_yok' ? 'Bu sistem henüz bir kontrolde geçmedi.' : 'Bulgu yok.' }}</p>
                </div>
              </div>
            </div>
              <button v-if="generalReport" class="view-link" type="button" @click="showReport(generalReport)">
                <PkIcon class="pi pi-file" /> {{ formatDate(generalReport.control_date) }} kontrolünü görüntüle <PkIcon class="pi pi-arrow-right" />
              </button>
            </template>

            <!-- Kontrol geçmişi: tesisatın periyodik kontrol raporları -->
            <template v-else-if="detailTab === 'history'">
            <div v-if="!detail.reports.length" class="empty-inline"><PkIcon class="pi pi-history" /> Henüz kontrol yok.</div>
            <div v-else class="table-wrap">
              <PkTable class="history-table">
                <thead>
                  <tr>
                    <th>Kontrol tarihi</th><th>Geçerlilik</th><th>Rapor</th><th>Kontrolü yapan</th><th>Genel sonuç</th><th>Sonuç ve kanaat</th>
                    <th>Uygun olmayan sistem</th><th>Bulgu</th><th v-if="!isElectricalDetail">Ekipman</th><th>Ekleyen</th><th />
                  </tr>
                </thead>
                <tbody>
                  <template v-for="report in detail.reports" :key="report.id">
                    <tr class="static">
                      <td>
                        <strong>{{ formatDate(report.control_date) }}</strong>
                        <!-- Sistem raporu: tesisatın genel durumunu değiştirmez, yalnızca kendi sistemlerini -->
                        <small v-if="report.scope === 'system'" class="scope-tag">Sistem raporu · {{ report.systems.map((system: any) => system.name).join(', ') }}</small>
                      </td>
                      <td>{{ formatDate(report.next_control_date) }}</td>
                      <!-- Uzun rapor no / kuruluş adı kısaltılır (tablo yana taşmasın); tamamı üzerine gelince -->
                      <td class="report-cell">
                        <button v-if="report.has_report" class="link-button" type="button" :title="[report.report_no, report.report_file_name].filter(Boolean).join('\n')" @click="openReport(report)"><PkIcon class="pi pi-file-pdf" /> <span class="truncate">{{ report.report_no || 'Görüntüle' }}</span></button>
                        <span v-else class="muted truncate" :title="[report.report_no, report.notes].filter(Boolean).join('\n')">{{ report.report_no || '—' }}</span>
                      </td>
                      <td class="body-cell"><span v-if="report.inspection_body" class="clamp" :title="report.inspection_body">{{ report.inspection_body }}</span><span v-else class="muted">—</span></td>
                      <td><span class="status-badge" :class="report.status" :title="report.notes || ''">{{ STATUS_LABELS[report.status] }}</span></td>
                      <!-- Ekipmanlardaki gibi: kısaltılmış; tamamı satır açılınca -->
                      <td class="note-cell"><span v-if="report.conclusion" class="clamp" :title="report.conclusion">{{ report.conclusion }}</span><span v-else class="muted">—</span></td>
                      <template v-if="report.status === 'rapor_bekleniyor'"><td>—</td><td>—</td></template>
                      <template v-else>
                        <td>{{ nonconforming(report) }} / {{ report.systems.length }}</td>
                        <td>
                          <button v-if="hasReportDetail(report)" class="link-button" type="button" @click="toggleReport(report)">
                            {{ report.findings.length ? `${report.findings.length} bulgu` : 'Ayrıntı' }} <PkIcon :class="openReportId === report.id ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" />
                          </button>
                          <span v-else class="muted">Yok</span>
                        </td>
                      </template>
                      <td v-if="!isElectricalDetail">{{ report.equipment_count || '—' }}</td>
                      <td>
                        {{ report.created_by || '—' }}
                        <button v-if="report.analysis" class="link-button source-link" type="button" :title="SOURCE_LABELS[report.source] || ''" @click="toggleReport(report)">
                          <PkIcon class="pi pi-sparkles" /> Yapay zeka <PkIcon :class="openReportId === report.id ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" />
                        </button>
                        <small v-else class="muted block">{{ SOURCE_LABELS[report.source] || '' }}</small>
                      </td>
                      <td class="actions-col">
                        <button class="icon-button" type="button" title="Kontrolü sil" aria-label="Kontrolü sil" @click="deleteReport(report)"><PkIcon class="pi pi-trash" /></button>
                      </td>
                    </tr>
                    <!-- Ekipmanlardaki gibi: sonuç ve kanaat, notlar, sistemler, bulgular ve yapay zekanın rapordan okudukları -->
                    <tr v-if="openReportId === report.id" class="analysis-row">
                      <td :colspan="isElectricalDetail ? 10 : 11">
                        <div class="inspection-detail">
                          <div v-if="report.conclusion"><h4>Sonuç ve kanaat</h4><p>{{ report.conclusion }}</p></div>
                          <div v-if="report.notes"><h4>Notlar</h4><p>{{ report.notes }}</p></div>
                          <div v-if="report.systems.length">
                            <h4>Sistemler</h4>
                            <div class="chips"><span v-for="system in report.systems" :key="system.name" class="status-chip" :class="system.status">{{ system.name }} · {{ STATUS_LABELS[system.status || 'belirtilmemis'] }}</span></div>
                          </div>
                          <div>
                            <h4>Bulgular</h4>
                            <ol v-if="report.findings.length"><li v-for="(finding, index) in report.findings" :key="index">{{ finding }}</li></ol>
                            <p v-else class="muted">Bulgu yok.</p>
                          </div>
                        </div>
                        <template v-if="report.analysis">
                          <h4 class="analysis-title"><PkIcon class="pi pi-sparkles" /> Yapay zeka analizi</h4>
                          <p v-if="analysisState[report.id] === 'loading'" class="muted">Yükleniyor...</p>
                          <p v-else-if="analysisState[report.id] === 'error'" class="error-text">Yapay zeka analizi yüklenemedi.</p>
                          <ExpertEquipmentAnalysisDetail v-else-if="reportAnalyses[report.id]" :analysis="reportAnalyses[report.id]" />
                        </template>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </PkTable>
            </div>
            </template>

            <!-- Belgeler: kontrollerin rapor dosyaları; tesis özellikleri ve tesisat raporunun notları -->
            <div v-else class="tab-body">
              <ul v-if="reportFiles.length" class="doc-list">
                <li v-for="report in reportFiles" :key="report.id">
                  <button class="pdf-button" type="button" aria-label="Raporu aç" @click="openReport(report)"><PkIcon class="pi pi-file-pdf" /></button>
                  <span class="doc-text"><strong>{{ report.report_no || report.report_file_name || 'Periyodik kontrol raporu' }}</strong><small>{{ formatDate(report.control_date) }} kontrolü<template v-if="report.scope === 'system'"> · Sistem raporu</template><template v-if="report.inspection_body"> · {{ report.inspection_body }}</template></small></span>
                  <button class="link-button" type="button" @click="openReport(report)">Aç <PkIcon class="pi pi-external-link" /></button>
                </li>
              </ul>
              <p v-else class="empty-inline"><PkIcon class="pi pi-file" /> Henüz rapor dosyası yok. Kontrol eklenince burada listelenir.</p>
              <div v-if="facilitySystems.length || generalNotes" class="info-cards">
                <article v-for="system in facilitySystems" :key="system.id" class="card info-card">
                  <header><div><strong>{{ system.name }}</strong><small>{{ cardHint(system) }}</small></div></header>
                  <dl v-if="facilityCells(system).length" class="facility-list">
                    <template v-for="cell in facilityCells(system)" :key="cell.label"><dt>{{ cell.label }}</dt><dd>{{ cell.value }}</dd></template>
                  </dl>
                  <p v-else class="muted">Tesisat raporunda tesis bilgisi yok.</p>
                </article>
                <article v-if="generalNotes" class="card info-card">
                  <header><div><strong>Notlar</strong><small>{{ formatDate(generalReport?.control_date) }} tesisat raporundan</small></div></header>
                  <p class="notes-text">{{ generalNotes }}</p>
                </article>
              </div>
            </div>
          </section>

          <!-- Hiçbir sisteme bağlı olmayan bulgular: katalogda yok, gizli (SHOW_GENERAL_FINDINGS); Açık bulgular kartında -->
          <section v-if="SHOW_GENERAL_FINDINGS && detail.general_findings.length" class="card section">
            <div class="section-head"><div><h3>Genel bulgular</h3><small>Son tesisat raporunda herhangi bir sisteme bağlı olmayan bulgular.</small></div></div>
            <ol class="findings padded">
              <li v-for="(finding, index) in detail.general_findings" :key="index">{{ finding }}</li>
            </ol>
          </section>
        </template>
      </template>
    </template>

    <ExpertInstallationFormModal
      v-if="createOpen && activeType"
      :type="activeType" :context="context" :workplaces="locationWorkplaces"
      @close="createOpen = false" @saved="onCreated"
    />
    <ExpertInstallationFormModal
      v-if="editOpen && detail && activeType"
      :type="activeType" :context="context" :workplaces="locationWorkplaces" :installation="detail"
      @close="editOpen = false" @saved="onEdited" @deleted="onDeleted"
    />
    <ExpertInstallationReportModal v-if="reportOpen && detail" :installation="detail" :system="reportSystem" :menus="tabs" :siblings="ofType" @close="reportOpen = false" @saved="onReportSaved" />
    <ExpertInstallationPendingModal v-if="pendingOpen && detail" :installation="detail" @close="pendingOpen = false" @saved="onPendingSaved" />
    <ExpertInstallationEquipmentModal
      v-if="equipmentSystem && detail"
      :installation="detail" :system="equipmentSystem" :types="equipmentTypesOf(equipmentSystem)"
      @close="equipmentSystemId = null" @saved="onEquipmentSaved" @changed="loadDetail"
    />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'expert', middleware: 'expert' })
// Sayfa yolu: bireysel uzmanda Ana Sayfa, diğer hesaplarda Genel Bakış.
const { account, multiUser } = useAccount()
const individual = computed(() => !!account.value && !multiUser.value)

// Tasarım kataloğu 07 / 08'de olmayan öğeler: katalogda yok, gizli; ileride açılabilir (kod yerinde).
const SHOW_LEGACY_OVERVIEW = false // Eski genel bilgiler kartı (Düzenle, Rapor bekleniyor, bilgi şeridi, sayılar); Sistem ekle aynı düzenleme penceresini açar
const SHOW_INFO_CARDS = false // Belge ve kayıt / proje bilgileri / tesis özellikleri / notlar kartları (detayda Belge kontrolleri kartı ve Belgeler sekmesi)
const SHOW_GENERAL_FINDINGS = false // Genel bulgular bölümü (detayda Açık bulgular kartında)

// Tür haplarındaki simgeler (PrimeIcons'ta yangın / batarya yok; en yakınları)
const TYPE_ICONS: Record<string, string> = {
  'yangin-tesisati': 'pi pi-shield', 'yangin-algilama': 'pi pi-wifi', 'elektrik-ic-tesisati': 'pi pi-bolt', topraklama: 'pi pi-arrow-down',
  'havalandirma-klima': 'pi pi-asterisk', paratoner: 'pi pi-bolt', akumulator: 'pi pi-server', trafo: 'pi pi-microchip'
}
const typeIcon = (slug?: string) => TYPE_ICONS[slug || ''] || 'pi pi-sitemap'

// Detay görünümü (tasarım kataloğu 08): adres satırında ?tesisat=ID; geri tuşu ve sayfa yolundaki "Tesisatlar" genel bakışa döner.
const route = useRoute()
const router = useRouter()
const detailView = computed(() => typeof route.query.tesisat === 'string' && !!route.query.tesisat)
const detailTab = ref<'systems' | 'history' | 'docs'>('systems')
const openDetail = (systemId?: number) => {
  if (!detail.value) return
  detailTab.value = 'systems'
  if (systemId) openIds.value = [systemId]
  router.push({ query: { tesisat: String(detail.value.id) } })
  window.scrollTo({ top: 0 })
}
const closeDetail = () => { router.push({ query: {} }); window.scrollTo({ top: 0 }) }

// Sekmeler: tesisat türleri (sırasıyla). Diğer tesisatlar geldikçe buraya eklenir.
const TAB_SLUGS = ['yangin-tesisati', 'yangin-algilama', 'elektrik-ic-tesisati', 'topraklama', 'havalandirma-klima', 'paratoner', 'akumulator', 'trafo']
const STATUS_LABELS: Record<string, string> = { uygun: 'Uygun', uygun_degil: 'Uygun değil', rapor_bekleniyor: 'Rapor bekleniyor', rapor_yok: 'Kontrol yok', belirtilmemis: 'Belirtilmemiş' }
const STATUS_ICONS: Record<string, string> = { uygun: 'pi pi-check-circle', uygun_degil: 'pi pi-times-circle', rapor_bekleniyor: 'pi pi-hourglass', rapor_yok: 'pi pi-clock', belirtilmemis: 'pi pi-question-circle' }
const EQUIPMENT_STATUS_LABELS: Record<string, string> = { uygun: 'Uygun', uygun_degil: 'Uygun değil', rapor_bekleniyor: 'Rapor bekleniyor', belirtilmemis: 'Belirtilmemiş', rapor_yok: 'Rapor yok' }
const SOURCE_LABELS: Record<string, string> = { manual: 'Elle girildi', ai: 'Yapay zeka ile okundu' }

const { get, del, getBlob, errorMessage } = useExpertApi()
const { context, label: contextLabel } = useWorkplaceContext()
const { groups, load: loadWorkplaces } = useMyWorkplaces()

const catalog = ref<any[]>([])
const installations = ref<any[]>([])
const detail = ref<any>(null)
const loading = ref(false)
const detailLoading = ref(false)
const error = ref('')
// Seçili tür; lokasyonda hiç tesisat yoksa boş (tür seçilene kadar sekme yok).
const activeSlug = ref('')
const selectedId = ref<number | null>(null)
const openIds = ref<number[]>([])
const createOpen = ref(false)
const editOpen = ref(false)
const reportOpen = ref(false)
// Kontrol Ekle: tesisat raporu (system yok) ya da sistem satırındaki "Rapor yükle": o sistemin raporu.
const reportSystem = ref<any>(null)
const pendingOpen = ref(false)

const tabs = computed(() => TAB_SLUGS.map(slug => catalog.value.find(type => type.slug === slug)).filter(Boolean))
// Sekmeler: lokasyonda tanımlı türler ve eklenmek üzere seçilen tür; diğerleri "Tesisat türü ekle" kutusunda.
const definedSlugs = computed(() => new Set(installations.value.map(item => item.type?.slug)))
const shownTabs = computed(() => tabs.value.filter(type => definedSlugs.value.has(type.slug) || type.slug === activeSlug.value))
const addableTabs = computed(() => tabs.value.filter(type => !shownTabs.value.includes(type)))
const activeType = computed(() => catalog.value.find(type => type.slug === activeSlug.value) || null)
const ofType = computed(() => installations.value.filter(item => item.type?.slug === activeSlug.value))
const ofTypeCount = (status: string) => ofType.value.filter(item => item.status === status).length
// Elektrik ailesi sekmesi (Elektrik İç Tesisatı, Topraklama): bina bazında birden çok kayıt eklenebilir.
const isElectricalTab = computed(() => ELECTRICAL_SLUGS.includes(activeSlug.value))
// Seçili lokasyondaki işyerleri (firmalar); işyeri adı varsa "Ad · Firma".
const { load: loadNames, workplaceLabel } = useWorkplaceNames()
const locationWorkplaces = computed(() => (groups.value.find(g => g.location_id === context.value?.location_id)?.items || [])
  .map(item => ({ id: item.id, company_name: workplaceLabel(item.id, item.company_name) })))
const placeOf = (item: any) => item?.workplace ? workplaceLabel(item.workplace.id, item.workplace.company_name) : 'Lokasyon geneli'

const cardSystems = computed(() => (detail.value?.systems || []).filter((system: any) => system.card))
// Detay (08): belge kontrolleri (Belge ve kayıtlar, Proje bilgileri) sağdaki kartta, tesis özellikleri Belgeler sekmesinde.
const docChecks = computed(() => cardSystems.value.filter((system: any) => !isFacilityCard(system)))
const facilitySystems = computed(() => cardSystems.value.filter((system: any) => isFacilityCard(system)))
// Açık bulgular kartı: son kontrolün bütün bulguları (sistemler, belge kontrolleri, genel); sayısı totalFindings ile aynı.
const openFindings = computed(() => [
  ...(detail.value?.systems || []).flatMap((system: any) => system.findings.map((text: string) => ({ text, system: system.name }))),
  ...(detail.value?.general_findings || []).map((text: string) => ({ text, system: '' }))
])
// Belgeler sekmesi: dosyası olan kontroller
const reportFiles = computed(() => (detail.value?.reports || []).filter((report: any) => report.has_report))
// "… kontrolünü görüntüle": Kontrol geçmişi sekmesinde o kontrolün satırı açılır.
const showReport = (report: any) => {
  detailTab.value = 'history'
  if (openReportId.value !== report.id) toggleReport(report)
}
const listSystems = computed(() => (detail.value?.systems || []).filter((system: any) => !system.card))
const countStatus = (status: string) => (detail.value?.systems || []).filter((system: any) => system.status === status).length
const totalFindings = computed(() => (detail.value?.systems || []).reduce((sum: number, system: any) => sum + system.findings.length, 0) + (detail.value?.general_findings?.length || 0))
// Kontrol süresi geçen gün (geçmediyse 0): genel kartta ayrı rozet.
const overdueDays = computed(() => (detail.value?.days_left ?? 0) < 0 ? -detail.value.days_left : 0)
const dueText = computed(() => {
  const days = detail.value?.days_left
  if (days === null || days === undefined) return ''
  return days < 0 ? `Kontrol süresi ${-days} gün geçti` : days === 0 ? 'Kontrol süresi bugün doluyor' : `Sonraki kontrole ${days} gün`
})
// Durum kartındaki kısa yazı (katalogdaki "126 gün geçti")
const dueShort = computed(() => {
  const days = detail.value?.days_left
  return days === null || days === undefined ? '' : days < 0 ? `${-days} gün geçti` : days === 0 ? 'Bugün doluyor' : `${days} gün kaldı`
})

const isOpen = (id: number) => openIds.value.includes(id)
const toggle = (id: number) => { openIds.value = isOpen(id) ? openIds.value.filter(item => item !== id) : [...openIds.value, id] }
const shownFindings = (system: any) => isOpen(system.id) ? system.findings : system.findings.slice(0, 3)
const cardHint = (system: any) => system.slug?.endsWith('tesis-ozellikleri')
  ? (facilityEntry(system) ? `${formatDate(facilityEntry(system).control_date)} tesisat raporundan` : 'Tesisat raporundaki tesis bilgileri')
  : system.slug?.endsWith('proje-bilgileri') ? 'Tesisatın projeye uygunluğu' : 'Belge ve kayıtların kontrolü'
const nonconforming = (report: any) => report.systems.filter((system: any) => system.status === 'uygun_degil').length

// Elektrik ailesi (Elektrik İç Tesisatı, Topraklama Tesisatı): her sistemin raporları — son kontroldekiler (current) ve önceki
// raporlar (previous); her raporun sonucu, bulguları ve ölçüm sonuçları (panolar, röleler, ölçüm noktaları; Ekipmanlar'a
// eklenmez). Sistemin durumu son kontroldeki raporların en kötüsü (sunucu hesaplar). Yangında boş.
const ELECTRICAL_SLUGS = ['elektrik-ic-tesisati', 'topraklama', 'yangin-algilama', 'havalandirma-klima', 'paratoner', 'akumulator', 'trafo']
// Rapordaki tabloların adı: elektrikte ve topraklamada ölçüm sonuçları, yangın algılamada test sonuçları (dedektör, buton, siren).
const resultsLabel = computed(() => detail.value?.type?.slug === 'yangin-algilama' ? { title: 'Test sonuçları', unit: 'test' } : { title: 'Ölçüm sonuçları', unit: 'ölçüm' })
const reportsBySystem = ref<Record<number, { current: any[]; previous: any[] }>>({})
const currentOf = (system: any): any[] => reportsBySystem.value[system.id]?.current || []
const previousOf = (system: any): any[] => reportsBySystem.value[system.id]?.previous || []
// Açık rapor satırları ("<sistem>:<rapor>") ve açılan önceki raporlar. Son kontrolde ölçüm tablosu olan tek rapor açık gelir.
const openEntries = ref<string[]>([])
const openPrevious = ref<number[]>([])
const entryKey = (system: any, entry: any) => `${system.id}:${entry.report_id}`
const isEntryOpen = (system: any, entry: any) => openEntries.value.includes(entryKey(system, entry))
const toggleEntry = (system: any, entry: any) => {
  const key = entryKey(system, entry)
  openEntries.value = openEntries.value.includes(key) ? openEntries.value.filter(item => item !== key) : [...openEntries.value, key]
}
const togglePrevious = (system: any) => {
  openPrevious.value = openPrevious.value.includes(system.id) ? openPrevious.value.filter(id => id !== system.id) : [...openPrevious.value, system.id]
}
const loadSystemReports = async () => {
  const installation = detail.value
  if (!ELECTRICAL_SLUGS.includes(installation?.type?.slug)) { reportsBySystem.value = {}; return }
  try {
    const list = await get<any[]>(`/pk-installations/${installation.id}/electrical-systems`)
    if (detail.value?.id !== installation.id) return
    reportsBySystem.value = Object.fromEntries(list.map(item => [item.id, item]))
    openEntries.value = list.flatMap(item => {
      const withTables = item.current.filter((entry: any) => entry.components.length)
      return withTables.length === 1 ? [`${item.id}:${withTables[0].report_id}`] : []
    })
  } catch { reportsBySystem.value = {} }
}
// Kontrol eklenince / silinince (detay yenilenir) liste de yenilenir.
watch(() => detail.value && `${detail.value.id}:${detail.value.reports?.map((report: any) => report.id).join(',')}`, loadSystemReports)
// Satırın "Raporda" sütunu: tek panonun raporuysa panonun adı, çok satırlı tabloysa ölçüm sayısı.
const entrySubject = (entry: any) => {
  if (entry.components.length === 1) {
    const item = entry.components[0]
    return item.code || item.place || item.properties?.find((cell: any) => cell.value)?.value || `1 ${resultsLabel.value.unit}`
  }
  return entry.components.length ? `${entry.components.length} ${resultsLabel.value.unit}` : ''
}
const entryHasDetail = (entry: any) => entry.components.length > 0 || entry.findings.length > 0
// Sistem satırındaki özet: son kontrolde birden çok rapor varsa rapor sayısı, yoksa ölçüm sayısı.
const systemMeta = (system: any) => {
  const current = currentOf(system)
  if (current.length > 1) return `${current.length} rapor`
  const count = current[0]?.components.length || 0
  return count ? `${count} ${resultsLabel.value.unit}` : ''
}
// Ölçüm sonuçları raporda nasılsa öyle: tablo başına (rapordaki tablo adı) sütunlar raporun başlıkları ve sırasıyla. Değerler
// [{label, value}] listesi.
const measurementTables = (components: any[]) => {
  const tables = new Map<string, { key: string; name: string; codeLabel: string; columns: string[]; rows: any[]; showPlace: boolean; hasFindings: boolean }>()
  for (const item of components) {
    const key = item.equipment_name || ''
    const table = tables.get(key) || { key, name: item.equipment_name || '', codeLabel: item.code_label || 'No', columns: [], rows: [], showPlace: false, hasFindings: false }
    for (const cell of item.properties || []) if (!table.columns.includes(cell.label)) table.columns.push(cell.label)
    table.rows.push(item)
    table.showPlace ||= !!item.place
    table.hasFindings ||= !!item.findings?.length
    tables.set(key, table)
  }
  return [...tables.values()]
}
const cellOf = (item: any, column: string) => (item.properties || []).find((cell: any) => cell.label === column)?.value || '—'
// Tesis Özellikleri bilgi kartı: en son tesisat raporundaki tesis bilgileri (etiket → değer).
const isFacilityCard = (system: any) => !!system.slug?.endsWith('tesis-ozellikleri')
const facilityEntry = (system: any) => [...currentOf(system), ...previousOf(system)].find((entry: any) => entry.components.length) || null
const facilityCells = (system: any) => (facilityEntry(system)?.components[0]?.properties || []).filter((cell: any) => cell.value)
// Elektrik ailesi: son tesisat raporunun (genel durumu veren rapor) notları.
const generalReport = computed(() => [...(detail.value?.reports || [])].filter((report: any) => !report.scope)
  .sort((a: any, b: any) => (b.control_date || '').localeCompare(a.control_date || '') || b.id - a.id)[0] || null)
const generalNotes = computed(() => ELECTRICAL_SLUGS.includes(detail.value?.type?.slug) ? (generalReport.value?.notes || '').trim() : '')
// Elektrik ailesinde Ekipmanlar'a kayıt açılmaz: Kontrol geçmişinde "Ekipman" sütunu yok.
const isElectricalDetail = computed(() => ELECTRICAL_SLUGS.includes(detail.value?.type?.slug))

// Kontrol geçmişi (bütün tesisatlar), ekipmanlardaki gibi: satır açılınca sonuç ve kanaat, notlar, sistemler, bulgular ve
// yapay zekanın rapordan okudukları (satır ilk açıldığında yüklenir).
const openReportId = ref<number | null>(null)
const reportAnalyses = reactive<Record<number, any>>({})
const analysisState = reactive<Record<number, 'loading' | 'error' | 'done'>>({})
const hasReportDetail = (report: any) => !!(report.findings.length || report.conclusion || report.notes || report.analysis)
const toggleReport = async (report: any) => {
  openReportId.value = openReportId.value === report.id ? null : report.id
  if (openReportId.value !== report.id || !report.analysis || analysisState[report.id] === 'loading' || analysisState[report.id] === 'done') return
  analysisState[report.id] = 'loading'
  try {
    const data = await get<any>(`/pk-installations/${detail.value.id}/reports/${report.id}/analysis`)
    reportAnalyses[report.id] = data.analysis
    analysisState[report.id] = 'done'
  } catch { analysisState[report.id] = 'error' }
}

// Sistemin içinden ekipman ekleme: türler sistemin katalogundaki ekipman türleri.
const equipmentSystemId = ref<number | null>(null)
const equipmentSystem = computed(() => (detail.value?.systems || []).find((system: any) => system.id === equipmentSystemId.value) || null)
const equipmentTypesOf = (system: any) => activeType.value?.systems.find((option: any) => option.id === system.system_id)?.equipment_types || []
const onEquipmentSaved = () => {
  equipmentSystemId.value = null
  loadDetail()
}

const daysText = (days: number | null) => days === null || days === undefined ? '—' : days < 0 ? `${-days} gün geçti` : days === 0 ? 'Bugün' : `${days} gün`
const daysKey = (days: number | null) => days === null || days === undefined ? '' : days < 0 ? 'overdue' : days <= 30 ? 'soon' : 'ok'
const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('tr-TR').format(new Date(value)) : '—'

const loadDetail = async () => {
  if (!selectedId.value) { detail.value = null; return }
  detailLoading.value = true
  try {
    detail.value = await get(`/pk-installations/${selectedId.value}`)
  } catch (e: any) {
    error.value = errorMessage(e, 'Tesisat alınamadı.')
  } finally { detailLoading.value = false }
}

// Alanlar (isteğe bağlı): tesisat kaydının alanı / binası (lokasyonda alan tanımlıysa); yoksa hiçbir şey gösterilmez.
const { assignments: areaAssignments, byId: areaById, load: loadAreas } = useLocationAreas()
const installationArea = (id: number) => {
  const areaId = areaAssignments.value.installations[String(id)]
  return areaId ? areaById.value.get(areaId)?.label || '' : ''
}

const loadInstallations = async () => {
  if (!context.value) { installations.value = []; detail.value = null; return }
  loading.value = true
  error.value = ''
  try {
    const [list] = await Promise.all([
      get('/pk-installations', {
        location_id: context.value.location_id,
        ...(context.value.type === 'workplace' ? { workplace_id: context.value.workplace_id } : {})
      }),
      loadAreas(context.value.location_id, true)
    ])
    installations.value = list
    // Adresteki detay (?tesisat=ID): o tesisatın türü ve kendisi seçilir; tesisat yoksa (silinmiş, başka lokasyon) genel bakış.
    if (detailView.value) {
      const wanted = list.find((item: any) => String(item.id) === route.query.tesisat)
      if (wanted) { activeSlug.value = wanted.type?.slug || activeSlug.value; selectedId.value = wanted.id }
      else router.replace({ query: {} })
    }
    // Seçili tür bu lokasyonda tanımlı değilse ilk tanımlı türe geçilir; hiç tesisat yoksa tür seçilmez.
    if (!definedSlugs.value.has(activeSlug.value)) activeSlug.value = TAB_SLUGS.find(slug => definedSlugs.value.has(slug)) || ''
    if (!ofType.value.some(item => item.id === selectedId.value)) selectedId.value = ofType.value[0]?.id ?? null
    await loadDetail()
  } catch (e: any) {
    error.value = errorMessage(e, 'Tesisatlar alınamadı.')
  } finally { loading.value = false }
}

const selectTab = (slug: string) => {
  activeSlug.value = slug
  selectedId.value = ofType.value[0]?.id ?? null
  openIds.value = []
  loadDetail()
}
const selectInstallation = (id: number) => { selectedId.value = id; openIds.value = []; loadDetail() }
const openCreate = () => { createOpen.value = true }
const openControl = (system: any = null) => { reportSystem.value = system; reportOpen.value = true }

const onCreated = (installation: any) => {
  createOpen.value = false
  selectedId.value = installation.id
  loadInstallations()
}
const onEdited = (installation: any) => {
  editOpen.value = false
  detail.value = installation
  loadInstallations()
}
const onDeleted = () => {
  editOpen.value = false
  selectedId.value = null
  loadInstallations()
}
const onReportSaved = (installation: any) => {
  reportOpen.value = false
  // Rapor başka bir kayda (bina sorusu: binanın / tesis genelinin kaydı ya da yeni açılan kayıt) gitmiş olabilir: o kayıt açılır.
  selectedId.value = installation.id
  detail.value = installation
  loadInstallations()
}
const onPendingSaved = (installation: any) => {
  pendingOpen.value = false
  detail.value = installation
  loadInstallations()
}

const openReport = async (report: any) => {
  const tab = window.open('', '_blank')
  try {
    const blob = await getBlob(`/pk-installations/${detail.value.id}/reports/${report.id}/file`)
    const blobUrl = URL.createObjectURL(blob)
    if (tab) tab.location.href = blobUrl
    else window.location.href = blobUrl
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
  } catch (e: any) {
    tab?.close()
    alert(errorMessage(e, 'Rapor açılamadı.'))
  }
}

const deleteReport = async (report: any) => {
  const equipmentNote = report.equipment_count ? ` Bu rapordan ${report.equipment_count} ekipmana yazılan kontrol kayıtları da silinir (ekipmanlar kalır).` : ''
  const question = report.status === 'rapor_bekleniyor'
    ? `${formatDate(report.control_date)} tarihli "rapor bekleniyor" kaydı silinsin mi?`
    : `${formatDate(report.control_date)} tarihli kontrol ve raporu silinsin mi?${equipmentNote}`
  if (!confirm(question)) return
  try {
    detail.value = await del(`/pk-installations/${detail.value.id}/reports/${report.id}`)
    loadInstallations()
  } catch (e: any) {
    alert(errorMessage(e, 'Kontrol silinemedi.'))
  }
}

// Detay açıkken seçili tesisat değişirse (rapor başka kayda gitti, silindi) adres de değişir.
watch(selectedId, id => {
  if (!detailView.value || String(id) === route.query.tesisat) return
  router.replace({ query: id ? { tesisat: String(id) } : {} })
})

watch(() => context.value && `${context.value.location_id}-${context.value.workplace_id ?? ''}`, () => {
  selectedId.value = null
  openIds.value = []
  loadInstallations()
})

onMounted(async () => {
  loadWorkplaces()
  loadNames()
  try { catalog.value = (await get('/pk-installation-catalog')).types } catch { catalog.value = [] }
  loadInstallations()
})
</script>

<style scoped>
.installations-page { margin: 0 auto; }
/* Başlık ve tür hapları (tasarım kataloğu 07) */
.page-head{display:flex;align-items:flex-start;gap:24px;margin-bottom:18px}
.head-title{flex:none;max-width:420px}
.crumb{display:flex;align-items:center;gap:8px;margin-bottom:8px;color:var(--admin-muted);font-size:13px}
.crumb a{color:var(--admin-muted)}.crumb a:hover{color:var(--admin-heading)}
.crumb strong{color:var(--admin-heading);font-weight:600}.crumb .pi-angle-right{font-size:11px}
h1{margin:0;color:var(--admin-heading);font-size: 24px;font-weight: 700;line-height:1.15;letter-spacing: 0}.lead{margin:7px 0 0;color:var(--admin-muted);font-size:15px}
h2{margin:0;color:var(--admin-heading);font-size:20px}h3{margin:0;color:var(--admin-heading);font-size:15px}h4{margin:14px 0 8px;color:var(--admin-heading);font-size:12px}
.type-pills{flex:1;display:flex;flex-wrap:wrap;justify-content:flex-end;align-items:center;gap:10px;padding-top:30px}
.type-pill{display:inline-flex;align-items:center;gap:8px;height:42px;padding:0 16px;border:1px solid rgba(145,158,171,.32);border-radius:8px;background:var(--admin-card);color:var(--admin-heading);font:inherit;font-size:14px;font-weight:600;cursor:pointer}
.type-pill i{color:var(--admin-heading);font-size:14px}
.type-pill:hover{background:rgba(145,158,171,.08)}
.type-pill.active{border-color:var(--pk-accent);background:var(--pk-accent);color:var(--pk-on-accent);box-shadow:0 8px 16px rgba(var(--pk-accent-rgb),.24)}.type-pill.active i{color:var(--pk-on-accent)}
.type-pills .type-add{height:42px;border-radius:8px}
.card{background:var(--admin-card);border:0;border-radius:var(--pk-radius);box-shadow:var(--pk-card-shadow)}
.empty-state{display:flex;flex-direction:column;align-items:center;gap:7px;padding:70px 20px;text-align:center;color:var(--admin-muted)}.empty-state i{font-size:28px}.empty-state strong{color:var(--admin-heading)}.empty-state .primary-button{margin-top:10px}
.state{padding:60px 20px;text-align:center;color:var(--admin-muted)}
/* Üst sıra: durum kartı, sayılar + rapor (detayda yan kartlar) */
.top{display:grid;grid-template-columns:minmax(290px,380px) minmax(0,1fr);gap:24px;align-items:start;margin-bottom:24px}
.status-card,.report-card{display:flex;flex-direction:column;gap:12px;padding:24px}
.status-card header{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.status-card header h2{font-size:17px;font-weight:700}
.type-icon{color:var(--pk-error);font-size:20px}
.status-card header .status-pill{margin-left:auto}
.place-line{margin:-4px 0 0;color:var(--admin-muted);font-size:13px}
.facts{display:grid;margin:0;border-top:1px dashed rgba(145,158,171,.24)}
.facts > div{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px dashed rgba(145,158,171,.24)}
.facts dt{display:flex;align-items:center;gap:12px;color:var(--admin-text);font-size:14px}.facts dt i{color:var(--admin-muted)}
.facts dd{margin:0;color:var(--admin-heading);font-size:15px;font-weight:700;text-align:right;overflow-wrap:anywhere}
.due-strip{display:flex;align-items:center;gap:10px;margin:0;padding:10px 14px;border-radius:8px;background:var(--admin-chip);color:var(--admin-text);font-size:16px;font-weight:700}
.due-strip.overdue{background:var(--admin-warning-bg);color:var(--admin-warning-text)}
.due-strip.soon{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.due-strip.ok{background:var(--admin-success-bg);color:var(--admin-success-text)}
.status-card .primary-button,.report-card .primary-button{width:100%;min-height:46px;font-size:15px}
.outline-button{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:46px;padding:0 16px;border:1px solid rgba(145,158,171,.32);border-radius:8px;background:transparent;color:var(--admin-heading);font:inherit;font-size:15px;font-weight:600;cursor:pointer}
.outline-button:hover{background:rgba(145,158,171,.08)}.outline-button .push{margin-left:auto}.outline-button .pi-file{margin-left:auto}
/* Sağ taraf: genel bakışta sayılar üstte, rapor altta; detayda açık bulgular | belge kontrolleri yan yana */
.top-right{display:grid;gap:24px;align-items:start}.detail-top .top-right{grid-template-columns:repeat(2,minmax(0,1fr))}
/* Sayı kartları: pastel kutular (Genel bakıştaki .gb-tile gibi) */
.kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
.kpi{display:flex;align-items:center;gap:12px;min-height:88px;padding:16px 18px;border:0;border-radius:var(--pk-radius);font:inherit;text-align:left;cursor:pointer;transition:transform .15s}
.kpi:hover{transform:translateY(-2px)}
.kpi-icon{flex:none;width:44px;height:44px;display:grid;place-items:center;border-radius:50%;background:rgba(255,255,255,.55);font-size:18px}
.kpi.blue{background:var(--pk-info-lighter);color:var(--pk-info-dark)}.kpi.ok{background:var(--pk-success-lighter);color:var(--pk-success-dark)}.kpi.warn{background:var(--pk-warning-lighter);color:var(--pk-warning-dark)}
:global(.dark-theme) .kpi{background:var(--admin-card)}
.kpi-text{display:grid;gap:2px;min-width:0}.kpi-text strong{font-size:28px;font-weight:700;line-height:1.1}.kpi-text small{font-size:14px;font-weight:700}
.kpi-arrow{margin-left:auto;font-size:14px}
.report-card header{display:flex;align-items:center;gap:10px}.report-card header i{color:var(--admin-accent-text);font-size:18px}.report-card h3{font-size:17px;font-weight:700}
.report-card .facts dt{color:var(--admin-muted)}
/* Sistemler tablosu */
.systems-card{overflow:hidden}
.systems-head{display:flex;align-items:center;flex-wrap:wrap;gap:14px;padding:20px 24px}
.systems-head h2{font-size:17px;font-weight:700}
.systems-head small{padding-left:14px;border-left:1px solid rgba(145,158,171,.24);color:var(--admin-muted);font-size:13px}
.systems-head .primary-button{margin-left:auto}
.systems-card .table-wrap{padding:0 0 8px}
.systems-table th{border-bottom:0}.systems-table th:first-child,.systems-table td:first-child{padding-left:24px}.systems-table th:last-child,.systems-table td:last-child{padding-right:24px}
.systems-table td{font-size:14px;padding:14px 16px}.systems-table tbody tr{cursor:pointer}.systems-table tbody tr:hover{background:var(--admin-hover)}.systems-table tbody tr:last-child td{border-bottom:0}
.system-cell{display:inline-flex;align-items:center;gap:12px}.system-cell i{color:var(--admin-accent-text);font-size:18px}.system-cell strong{font-weight:600}
.systems-table .status-badge{display:inline-flex;align-items:center;gap:6px}
.go-button,.systems-table .icon-button{width:34px;height:34px;color:var(--admin-accent-text)}.systems-table .icon-button:hover{color:var(--admin-accent-text);background:var(--admin-accent-soft)}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
/* Tesisat detayı */
.status-card header{display:flex;align-items:center;gap:10px}
.accent-icon{color:var(--admin-accent-text);font-size:19px}.bad-icon{color:var(--admin-danger-text)}.ok-icon{color:var(--admin-success-text)}
.detail-top .facts dt{font-size:13.5px}
.detail-top .notice{margin:0}
/* Durum ve kalan gün (kontrol bilgileri kartında) */
.status-row{display:flex;flex-wrap:wrap;gap:8px}
.due-chip{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:6px;background:var(--admin-chip);color:var(--admin-text);font-size:12px;font-weight:700;white-space:nowrap}
.due-chip.overdue,.due-chip.soon{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.due-chip.ok{background:var(--admin-success-bg);color:var(--admin-success-text)}
.side-card{display:grid;gap:12px;padding:24px}
.side-card header{display:flex;align-items:center;gap:12px}.side-card header i{font-size:20px}.side-card h3{font-size:17px;font-weight:700}
.count-badge{margin-left:auto;min-width:28px;padding:2px 8px;border-radius:6px;background:var(--admin-danger-bg);color:var(--admin-danger-text);font-size:12px;font-weight:700;text-align:center}
.count-badge.none{background:var(--admin-chip);color:var(--admin-muted)}
.side-list{display:grid;gap:8px;margin:0;padding:0;list-style:none}
.side-row{width:100%;display:flex;align-items:center;gap:12px;padding:10px 14px;border:1px solid rgba(145,158,171,.2);border-radius:8px;background:var(--admin-card);color:var(--admin-heading);font:inherit;font-size:14.5px;text-align:left;text-decoration:none;cursor:pointer}
.side-row:hover{border-color:var(--admin-border);background:var(--admin-hover)}
.side-row > .pi-file{color:var(--admin-muted)}.side-row > .pi-angle-right{margin-left:auto;color:var(--admin-heading)}
.doc-row{border-color:transparent;padding:8px 6px}.doc-row .status-badge{margin-left:auto}
.doc-findings{margin:4px 0 6px 34px}
.soft-link{display:flex;align-items:center;justify-content:center;gap:8px;min-height:40px;border-radius:8px;background:var(--admin-accent-soft);color:var(--admin-accent-text);font-size:14px;font-weight:700;text-decoration:none}
.soft-link:hover{box-shadow:inset 0 0 0 1px var(--pk-accent)}
.tabs-card{overflow:hidden}
.tabs-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:6px 24px 0;border-bottom:1px solid rgba(145,158,171,.2)}
.tabs-row .tabs{margin:0;border-bottom:0;gap:6px}
.tabs-row .tabs button{gap:9px;padding:14px;border-bottom-width:3px;color:var(--admin-heading);font-size:16px;font-weight:600}
.tabs-row .tabs button i{color:var(--admin-muted)}
.tabs-row .tabs button.active,.tabs-row .tabs button.active i{color:var(--admin-accent-text)}.tabs-row .tabs button.active{font-weight:700}
.tabs-row .primary-button{margin:6px 0}
.tabs-card .system-list{display:grid;gap:10px;padding:20px 24px 6px}
.tabs-card .system-item{border:1px solid rgba(145,158,171,.2);border-radius:var(--pk-radius);overflow:hidden}
.tabs-card .system-item + .system-item{border-top:1px solid rgba(145,158,171,.2)}
.tabs-card .system-item.open{border-color:rgba(145,158,171,.32)}
.tabs-card .system-item.open .system-head{background:var(--admin-accent-soft)}
.tabs-card .system-name strong{font-size:15px}
.tabs-card .empty-inline,.tabs-card .pending-note{margin:12px 24px 0;border-radius:8px}
.tabs-card .table-wrap{padding:12px 24px 6px}
.view-link{display:inline-flex;align-items:center;gap:10px;margin:8px 24px 16px;padding:6px 4px;border:0;background:none;color:var(--admin-link);font:inherit;font-size:15px;font-weight:700;cursor:pointer}
.view-link .pi-file{color:var(--admin-accent-text);font-size:17px}
.tab-body{padding:20px 24px 24px}
.doc-list{display:grid;margin:0;padding:0;list-style:none}
.doc-list li{display:flex;align-items:center;gap:14px;padding:10px 0}.doc-list li + li{border-top:1px solid rgba(145,158,171,.2)}
.doc-list .link-button{margin-top:0}
.pdf-button{flex:none;width:40px;height:40px;display:grid;place-items:center;border:1px solid rgba(145,158,171,.32);border-radius:8px;background:var(--admin-card);color:var(--admin-accent-text);cursor:pointer}.pdf-button i{font-size:18px}.pdf-button:hover{border-color:var(--pk-accent)}
.doc-text{flex:1;display:grid;gap:2px;min-width:0}.doc-text strong{color:var(--admin-heading);font-size:15px;overflow-wrap:anywhere}.doc-text small{color:var(--admin-muted);font-size:12px}
.tab-body .info-cards{margin-top:14px}.tab-body .empty-inline{padding:12px 0}
.tabs{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:14px;border-bottom:1px solid var(--admin-border)}
.tabs button{display:inline-flex;align-items:center;gap:7px;padding:10px 13px;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;background:none;color:var(--admin-muted);font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.tabs .type-add{align-self:center;margin-left:6px}
.tabs button:hover{color:var(--admin-heading)}.tabs button.active{color:var(--admin-accent-text);border-bottom-color:var(--pk-yellow)}
.picker{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
.chip{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border:1px solid rgba(145,158,171,.32);border-radius:8px;background:var(--admin-input);color:var(--admin-text);font:inherit;font-size:12px;font-weight:600;cursor:pointer}
.chip span{color:var(--admin-muted);font-size:11px}.chip.active{border-color:var(--pk-accent);background:var(--admin-accent-soft);color:var(--admin-heading)}
.chip .dot{flex-shrink:0;width:8px;height:8px}
.chip.add{border-style:dashed;background:transparent;color:var(--admin-link)}.chip.add i{font-size:11px}
.picker-summary{margin:0 0 8px;color:var(--admin-muted);font-size:12px}.picker-summary .bad{color:var(--admin-danger-text)}

/* Genel bilgiler */
.overview{padding:20px;border-left:4px solid var(--admin-border)}
.overview.uygun{border-left-color:var(--admin-success-text)}.overview.uygun_degil{border-left-color:var(--admin-danger-text)}.overview.rapor_yok{border-left-color:var(--admin-muted)}.overview.rapor_bekleniyor{border-left-color:var(--admin-warning-text)}
.overview-main{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.overview-icon{width:48px;height:48px;display:grid;place-items:center;border-radius:12px;background:var(--admin-accent-soft);color:var(--admin-accent-text);flex-shrink:0}.overview-icon i{font-size:22px}
.overview-title{flex:1;min-width:200px}.overview-title p{margin:4px 0 0;color:var(--admin-muted);font-size:12px}
.overview-status{display:flex;flex-direction:column;align-items:flex-end;gap:5px}
.status-pill{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700;white-space:nowrap}
.status-pill.uygun{background:var(--admin-success-bg);color:var(--admin-success-text)}.status-pill.uygun_degil{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.status-pill.rapor_yok,.status-pill.belirtilmemis{background:var(--admin-chip);color:var(--admin-muted)}.status-pill.rapor_bekleniyor{background:var(--admin-warning-bg);color:var(--admin-warning-text)}
.pills{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px}.status-pill.overdue{background:#b42318;color:#fff}
.due{font-size:12px;font-weight:700;color:var(--admin-text)}.due.overdue{color:var(--admin-danger-text)}.due.soon{color:var(--admin-warning-text)}
.overview-actions{display:flex;gap:8px}
.notice{display:flex;align-items:flex-start;gap:8px;margin:16px 0 0;padding:12px 14px;border-radius:10px;background:var(--admin-soft);color:var(--admin-text);font-size:12px;line-height:1.5}.notice i{margin-top:2px;color:var(--admin-muted)}
.notice.warn{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.notice.warn i{color:inherit}
.info-strip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;margin-top:16px;border:1px solid var(--admin-border);border-radius:10px;overflow:hidden;background:var(--admin-border)}
.info-strip > div{display:flex;flex-direction:column;gap:4px;padding:11px 14px;background:var(--admin-card);min-width:0}
.info-strip small{color:var(--admin-muted);font-size:11px}.info-strip strong{color:var(--admin-heading);font-size:13px;overflow-wrap:anywhere}
.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}
.stats > div{display:flex;align-items:baseline;gap:8px;padding:12px 14px;border-radius:10px;background:var(--admin-soft)}
.stats strong{color:var(--admin-heading);font-size:22px;line-height:1}.stats small{color:var(--admin-muted);font-size:12px}
.stats .ok strong{color:var(--admin-success-text)}.stats .bad strong{color:var(--admin-danger-text)}.stats .warn strong{color:var(--admin-warning-text)}

/* Belge ve kayıt / proje kartları */
.info-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:14px}
.info-card{padding:16px}
.info-card header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}
.info-card header div{display:flex;flex-direction:column;gap:3px}.info-card header strong{color:var(--admin-heading);font-size:14px}.info-card header small{color:var(--admin-muted);font-size:12px}
.facility-list{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:6px 16px;margin:0;font-size:12px}
.facility-list dt{color:var(--admin-muted)}.facility-list dd{margin:0;color:var(--admin-heading);font-weight:600;overflow-wrap:anywhere}
.notes-text{margin:0;color:var(--admin-text);font-size:12px;line-height:1.6;white-space:pre-line}

/* Bölümler */
.section{margin-top:14px;overflow:hidden}
.section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid var(--admin-border)}
.section-head small{display:block;margin-top:4px;color:var(--admin-muted);font-size:12px}
.empty-inline{display:flex;align-items:center;gap:8px;padding:22px 18px;color:var(--admin-muted);font-size:13px}
.pending-note{display:flex;align-items:flex-start;gap:8px;margin:0;padding:10px 18px;border-bottom:1px solid var(--admin-border);background:var(--admin-warning-bg);color:var(--admin-warning-text);font-size:12px;line-height:1.5}.pending-note i{margin-top:3px}.pending-note strong{color:inherit}
.system-item + .system-item{border-top:1px solid var(--admin-row-border)}
.system-head{display:flex;align-items:center;padding-right:10px}
.system-head:hover,.system-item.open .system-head{background:var(--admin-hover)}
.system-line{flex:1;min-width:0;display:grid;grid-template-columns:12px minmax(0,1fr) 100px 80px 120px 20px;align-items:center;gap:14px;padding:13px 18px;border:0;background:none;color:var(--admin-text);font:inherit;text-align:left;cursor:pointer}
.icon-button.upload{flex-shrink:0}.icon-button.upload:hover{color:var(--admin-link)}
.system-line i{color:var(--admin-muted);font-size:12px}
.dot{width:10px;height:10px;border-radius:50%;background:var(--admin-muted)}.dot.uygun{background:var(--admin-success-text)}.dot.uygun_degil{background:var(--admin-danger-text)}
.system-name{display:flex;flex-direction:column;gap:3px;min-width:0}.system-name strong{color:var(--admin-heading);font-size:13px}.system-name small{color:var(--admin-muted);font-size:11px}
.meta{color:var(--admin-muted);font-size:12px;white-space:nowrap}.meta.strong{color:var(--admin-warning-text);font-weight:700}
.system-body{padding:4px 18px 18px 44px;background:var(--admin-hover)}
.body-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:10px 0 8px}.body-head h4{margin:0}
.secondary-button.small{min-height:32px;padding:0 12px;background:var(--admin-card)}
.findings{display:grid;gap:6px;margin:0;padding-left:20px;color:var(--admin-text);font-size:12px;line-height:1.5}.findings.padded{padding:16px 18px 16px 38px}
.link-button{display:inline-flex;align-items:center;gap:6px;margin-top:8px;border:0;background:none;color:var(--admin-link);font:inherit;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}
.section-head .link-button{margin-top:0}td .link-button{margin-top:0}
.muted{margin:0;color:var(--admin-muted);font-size:12px}.block{display:block;margin-top:2px}
.scope-tag{display:block;margin-top:3px;color:var(--admin-muted);font-size:11px;font-weight:700}
.table-wrap{overflow:auto}
table{width:100%;border-collapse:collapse}th,td{padding:12px 16px;text-align:left;border-bottom:1px solid rgba(145,158,171,.2);font-size:13px;color:var(--admin-text);vertical-align:middle}
th{font-size:13px;font-weight:600;color:var(--admin-muted);background:rgba(145,158,171,.08);white-space:nowrap}
td strong{color:var(--admin-heading)}
.equipment-table{background:var(--admin-card)}
.equipment-table tbody tr{cursor:pointer}.equipment-table tbody tr:hover{background:var(--admin-hover)}
.equipment-table.static tbody tr{cursor:default}.equipment-table.static tbody tr:hover{background:none}
/* Kontrol geçmişi: ekipmanlardaki gibi sonuç ve kanaat ve açılan ayrıntı satırı; uzun metinler kısaltılır */
.note-cell{min-width:180px;max-width:280px;white-space:pre-line}
.body-cell{min-width:120px;max-width:180px}
.report-cell{max-width:170px}.report-cell .link-button{max-width:100%;margin-top:0}
.truncate{display:inline-block;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom}
.scope-tag{max-width:190px}
.history-table th,.history-table td{padding:10px 12px}.history-table th{white-space:normal;min-width:64px}
.clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.source-link{display:flex;margin-top:3px;font-size:11px}
.analysis-row td{background:var(--admin-soft);padding:16px 18px}
.inspection-detail{display:grid;gap:12px;margin-bottom:14px;max-width:900px}
.inspection-detail h4,.analysis-title{display:flex;align-items:center;gap:6px;margin:0 0 6px;color:var(--admin-heading);font-size:12px}
.inspection-detail p{margin:0;color:var(--admin-text);font-size:12px;line-height:1.5;white-space:pre-line}.inspection-detail p.muted{color:var(--admin-muted)}
.inspection-detail ol{margin:0;padding-left:20px;display:grid;gap:4px;color:var(--admin-text);font-size:12px;line-height:1.45}
.analysis-title{padding-top:12px;border-top:1px solid var(--admin-border)}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.status-chip{padding:2px 8px;border-radius:6px;background:var(--admin-chip);color:var(--admin-muted);font-size:11px;font-weight:700}
.status-chip.uygun{background:var(--admin-success-bg);color:var(--admin-success-text)}.status-chip.uygun_degil{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
/* Elektrik ailesi: sistemin raporları; açılan satırda bulgular ve ölçüm sonuçları */
.entry-table tr.previous td{color:var(--admin-muted)}
.entry-table .tag.first{margin-left:0;margin-right:6px}
.subject-cell{min-width:160px;max-width:320px}
.entry-detail td{background:var(--admin-hover);padding:12px 14px}
.entry-findings{margin-bottom:10px}
.measure-name{display:block;margin:0 0 4px;color:var(--admin-muted);font-size:11px;font-weight:700}
/* Ölçüm sonuçları: rapordaki tablo; geniş tablolar yana kayar */
.measure-block + .measure-block{margin-top:12px}
.measure-title{display:block;margin:0 0 6px;color:var(--admin-heading);font-size:12px}
.measure-table th,.measure-table td{padding:9px 12px;white-space:nowrap}
.body-head small{font-size:11px}
.tag{display:inline-block;margin-left:8px;padding:1px 8px;border-radius:999px;border:1px solid var(--admin-border);background:var(--admin-soft);color:var(--admin-text);font-size:10px;font-weight:700}
.days{font-weight:700;white-space:nowrap}.days.overdue{color:var(--admin-danger-text)}.days.soon{color:var(--admin-warning-text)}.days.ok{color:var(--admin-text)}
.status-badge{display:inline-block;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700;white-space:nowrap;justify-self:start}
.status-badge.uygun{background:var(--admin-success-bg);color:var(--admin-success-text)}.status-badge.uygun_degil{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.status-badge.rapor_bekleniyor{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.status-badge.rapor_yok,.status-badge.belirtilmemis{background:var(--admin-chip);color:var(--admin-muted)}
.actions-col{width:1%}
.icon-button{width:32px;height:32px;display:grid;place-items:center;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--admin-muted);cursor:pointer}.icon-button:hover{border-color:var(--admin-border);background:var(--admin-card);color:var(--admin-danger-text)}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 17px;border:0;border-radius:8px;background:var(--pk-accent);color:var(--pk-on-accent);font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 8px 16px rgba(var(--pk-accent-rgb),.24)}.primary-button:hover{background:var(--pk-accent-hover)}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.secondary-button{display:inline-flex;align-items:center;gap:7px;min-height:40px;padding:0 16px;border:1px solid rgba(145,158,171,.32);border-radius:8px;background:var(--admin-hover);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}
.error-text{color:var(--admin-danger-text);font-size:12px}
@media(max-width:1300px){
  .page-head{flex-direction:column;gap:8px}.head-title{max-width:none}.type-pills{justify-content:flex-start;padding-top:0}
  .detail-top .top-right{grid-template-columns:minmax(0,1fr)}.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.kpi.wide{grid-column:1 / -1}
}
@media(max-width:1000px){.info-strip{grid-template-columns:repeat(2,minmax(0,1fr))}.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.info-cards{grid-template-columns:1fr}.top{grid-template-columns:minmax(0,1fr)}.detail-top .top-right{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:800px){.detail-top .top-right{grid-template-columns:minmax(0,1fr)}h1{font-size: 22px}.systems-head small{border-left:0;padding-left:0}}
@media(max-width:700px){
  .page-head{align-items:flex-start;flex-direction:column}
  .overview-status{align-items:flex-start}.pills{justify-content:flex-start}.overview-actions{width:100%}.overview-actions button{flex:1;justify-content:center}
  .system-line{grid-template-columns:12px minmax(0,1fr) auto 20px}.system-line .meta{display:none}
  .system-body{padding-left:18px}
}
</style>
