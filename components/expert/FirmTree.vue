<template>
  <div ref="rootEl" class="firm-detail" :class="{ embedded }">
    <!-- Kurumsal / kamu hesabında Firmalarım bu sayfanın kendisidir: geri bağlantısı yok. -->
    <NuxtLink v-if="!corporate && !embedded" to="/expert/workplaces" class="back"><ArrowLeft :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /> Firmalarım</NuxtLink>

    <!-- OSGB Firmalarım (tek ağaç): müşteri kapalı satır olarak gelir; tıklanınca yapısı yüklenir ve ağaç bu satırın yerine açılır. -->
    <ul v-if="embedded && !firm" class="tree">
      <li class="tree-row r-node" style="--depth: 0">
        <button class="row-main" type="button" :aria-expanded="false" :disabled="loading" @click="load">
          <PkIcon class="chevron" :class="loading ? 'pi pi-spin pi-spinner' : 'pi pi-chevron-right'" />
          <PkIcon class="pi pi-building k-root" />
          <span class="row-text"><strong>{{ preview?.name }}</strong><small>{{ preview?.locations_count ?? 0 }} lokasyon · {{ preview?.workplaces_count ?? 0 }} işyeri</small></span>
        </button>
      </li>
    </ul>

    <div v-if="loading && !embedded" class="state">Yükleniyor...</div>
    <div v-else-if="error && !firm" class="state error">{{ error }}<button class="secondary-button" type="button" @click="load">Tekrar Dene</button></div>

    <template v-else-if="firm">
      <div class="page-head">
        <div>
          <h1>{{ firm.name }}</h1>
          <!-- Tasarım kataloğu 12: "Kamu kurumu · Firma detayları"; sayılar Organizasyon yapısı kartında -->
          <p class="lead"><template v-if="firm.type">{{ customerTypeLabel(firm.type) }} · </template>Firma detayları</p>
          <p v-if="SHOW_HEADER_STATS"><span v-if="firm.type" class="chip">{{ customerTypeLabel(firm.type) }}</span> {{ headerStats }}</p>
        </div>
      </div>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>

      <!-- KSY-SIS müşteri kartı gibi sekmeler (kullanıcı 19 Kas 2026); kamuda firma yok, sekme de yok -->
      <div v-if="firm.type !== 'public'" class="segment" role="tablist" aria-label="Ana firma bölümleri">
        <button type="button" role="tab" :aria-selected="tab === 'org'" :class="{ active: tab === 'org' }" @click="tab = 'org'">Organizasyon ve lokasyonlar <span class="seg-count">{{ locations.length }}</span></button>
        <button type="button" role="tab" :aria-selected="tab === 'firmalar'" :class="{ active: tab === 'firmalar' }" @click="tab = 'firmalar'">Firmalar <span class="seg-count">{{ firms.length }}</span></button>
      </div>

      <template v-if="tab === 'org'">
      <!-- Ana firma şeması (Vue Flow): solda şema, sağda seçilen kutunun paneli. Ekleme / düzenleme / silme / işyeri açma
           paneldedir (eski alt ağaç kalktı, kullanıcı 17 Kas 2026). Lokasyon ya da dal sürüklenip başka dala bırakılınca taşınır. -->
      <!-- Liste açıkken: hangi dalın içinde olunduğunu gösteren başlık, iki sütunun üstünde tam genişlik (ad tek satıra sığsın) -->
      <section v-if="nodes.length && listNode" class="card list-banner" :style="{ '--dal': chartPositions[String(listNode.id)]?.color || '#a43df5' }">
        <!-- Şemanın küçük hâli: bulunulan dal yanıp söner; tıklayınca şemaya dönülür -->
        <button class="mini-tree-button" type="button" title="Şemaya dön" @click="closeList"><ExpertMiniTree :nodes="nodes" :active-id="listNode.id" :positions="chartPositions" /></button>
        <nav class="list-crumb" aria-label="Konum"><button class="link-button" type="button" @click="closeList">{{ topLabel }} şeması</button><!-- Tam hiyerarşi: üst dallar sırayla, en sonda bulunulan dal (kullanıcı 25 Kas 2026) -->
          <template v-for="node in pathTo(nodes, listNode.id).slice(0, -1)" :key="node.id"><ChevronRight :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /><span class="crumb-parent">{{ node.name }}</span></template>
          <ChevronRight :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /><h2>{{ listNode.name }}</h2></nav>
        <span class="banner-pills">
          <span class="count-pill none">{{ listLocations.length }} lokasyon</span>
          <span class="count-pill">{{ listLocations.reduce((sum, l) => sum + workplacesOf(l).length, 0) }} işyeri</span>
          <span v-if="listEmptyCount" class="count-pill warn">{{ listEmptyCount }} lokasyonda işyeri yok</span>
        </span>
      </section>
      <div v-if="nodes.length" class="overview" :class="{ 'list-open': listNode, 'no-side': !sideOpen }">
        <div class="main-col">
        <!-- Dal lokasyonları: süzgeç ayrı kart, lokasyonlar kart liste -->
        <section v-if="listNode" class="card loc-cards-card">
          <div class="list-tools">
            <input v-model="listQuery" class="list-search" type="search" placeholder="Lokasyon, ilçe ya da adres ara" aria-label="Lokasyon ara" />
            <button v-if="canEdit" class="primary-button" type="button" aria-label="Lokasyon ekle" @click="startLocation(listNode)"><Plus :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /> Ekle</button>
          </div>
          <ul class="loc-rows">
            <li v-for="location in pagedList" :key="location.id" class="loc-row" :class="{ selected: String(focusLocation?.id) === String(location.id) }" tabindex="0" @click="openFromList(location)" @keydown.enter.self="openFromList(location)">
              <span class="loc-row-main">
                <!-- KSY-SIS gibi dar liste: ad, ilçe; durum etiketi işyeri açılmamış lokasyonu gösterir. Adres ve işlemler sağdaki kartta -->
                <span class="loc-row-text"><strong>{{ location.name }}</strong><small>{{ location.district || location.city || 'İl girilmemiş' }}</small></span>
                <span class="count-pill" :class="{ warn: !workplacesOf(location).length }">{{ workplacesOf(location).length ? `${workplacesOf(location).length} işyeri` : 'İşyeri yok' }}</span>
              </span>
            </li>
            <li v-if="!filteredList.length" class="muted location-empty">Aramayla eşleşen lokasyon yok.</li>
          </ul>
          <!-- Sayfalama: sayfa başına 5 lokasyon -->
          <nav v-if="pageCount > 1" class="loc-pager" aria-label="Lokasyon sayfaları">
            <span class="loc-pager-info">{{ (listPage - 1) * PAGE_SIZE + 1 }}–{{ Math.min(listPage * PAGE_SIZE, filteredList.length) }} / {{ filteredList.length }}</span>
            <span class="loc-pager-pages">
              <button type="button" :disabled="listPage === 1" aria-label="Önceki sayfa" @click="listPage--"><ChevronLeft :size="16" :stroke-width="1.9" /></button>
              <template v-for="n in pageButtons" :key="String(n)">
                <span v-if="n === '…'" class="loc-pager-gap">…</span>
                <button v-else type="button" :class="{ on: n === listPage }" :aria-current="n === listPage ? 'page' : undefined" @click="listPage = n as number">{{ n }}</button>
              </template>
              <button type="button" :disabled="listPage === pageCount" aria-label="Sonraki sayfa" @click="listPage++"><ChevronRight :size="16" :stroke-width="1.9" /></button>
            </span>
          </nav>
        </section>
        <section v-else class="card schema-card">
          <header class="schema-head">
            <div><h2>{{ topLabel }} şeması</h2><small><template v-if="firm.type !== 'public'">{{ firms.length }} firma · </template>{{ locations.length }} lokasyon · {{ firmWorkplaces.length }} işyeri</small></div>
          </header>
          <ExpertOrgChart
            :nodes="nodes" :locations="locations" :counts="locationWorkplaceCounts" :labels="nodeLabels"
            :selected-key="chartKey" :can-edit="canEdit" :can-branch="canBranch && !singleCompany"
            :branch-label="firm.type === 'public' ? 'Birim' : 'Dal'"
            @select="selectChart" @add-branch="id => startOrg(nodeById(id))" @add-location="id => startLocation(nodeById(id))"
            @move-location="moveLocation" @move-node="moveNode" @open-list="openList" @edit="id => startEdit(nodeById(id))" @remove="removeFromChart" @layout="positions => chartPositions = positions"
          />
        </section>
        </div>

        <aside v-if="sideOpen" class="side">

          <!-- Seçili lokasyon: yalnız dal listesi açıkken (şemanın yanındaki kart kalktı, kullanıcı 18 Kas 2026). Kimlik + yazılı işlemler,
               işyeri yoksa tek ana düğmeli uyarı, ekipman / tesisat; işyerleri altta ayrı kartta (kullanıcı 20 Kas 2026). -->
          <template v-if="listNode && focusLocation">
          <section class="card loc-panel">
            <header class="loc-panel-head">
              <div class="loc-panel-id">
                <h2>{{ focusLocation.name }} <span class="count-pill" :class="{ none: !workplacesOf(focusLocation).length }">{{ workplacesOf(focusLocation).length ? `${workplacesOf(focusLocation).length} işyeri` : 'İşyeri tanımlı değil' }}</span></h2>
                <small><strong>{{ [focusLocation.district, focusLocation.city].filter(Boolean).join(', ') || 'İl girilmemiş' }}</strong><template v-if="ownerOf(focusLocation)"> <span class="dot" aria-hidden="true">•</span> {{ firm.type === 'public' ? 'Birim' : 'Firma' }}: <strong>{{ ownerOf(focusLocation) }}</strong></template></small>
                <small v-if="focusLocation.address" class="loc-panel-addr"><MapPin :size="14" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /> {{ focusLocation.address }}</small>
              </div>
              <!-- İşlemler sağ üstte: ana düğme İşyeri aç, yanında grup, taşı / sil ⋯ menüsünde; hepsi sağdaki panelde açılır -->
              <div class="loc-panel-actions">
                <button v-if="canEdit" class="primary-button" type="button" @click="startWorkplace(focusLocation)"><BriefcaseBusiness :size="16" :stroke-width="1.8" aria-hidden="true" /> İşyeri aç</button>
                <button v-if="locMenuItems.length" class="more-button" type="button" aria-label="Diğer işlemler" aria-haspopup="true" @click="locMenu?.toggle($event)"><Ellipsis :size="18" :stroke-width="1.8" aria-hidden="true" /></button>
                <Menu ref="locMenu" :model="locMenuItems" popup :pt="{ root: { style: MENU_VARS } }" />
              </div>
            </header>
            <!-- Ekipman / tesisat sayfası: üstteki seçim bu lokasyon olur (işyeri olmayan lokasyon seçilemez) -->
            <div class="location-links">
              <button type="button" class="count-row" :disabled="!workplacesOf(focusLocation).length" @click="goEquipment(focusLocation)">
                <span class="count-icon violet"><Package :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /></span>
                <span class="count-text"><strong>{{ focusCounts ? focusCounts.equipment : '—' }}</strong><small>Ekipman</small></span>
                <ChevronRight :size="16" :stroke-width="1.8" class="lucide-i count-go" aria-hidden="true" />
              </button>
              <button type="button" class="count-row" :disabled="!workplacesOf(focusLocation).length" @click="openLocationPage(focusLocation, '/expert/installations')">
                <span class="count-icon info"><Network :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /></span>
                <span class="count-text"><strong>{{ focusCounts ? focusCounts.installations : '—' }}</strong><small>Tesisat</small></span>
                <ChevronRight :size="16" :stroke-width="1.8" class="lucide-i count-go" aria-hidden="true" />
              </button>
            </div>
          </section>
            <!-- İşyerleri / Alt tesisler / Alanlar: KSY-SIS lokasyon kartındaki lacivert şerit gibi ayrı kartta sekme; içerik alttaki kartta
                 (kullanıcı 21 Kas 2026). Alt tesisler penceresi ve Alanlar yan paneli bu sekmelere taşındı. -->
            <nav class="lok-serit" aria-label="Lokasyon bölümleri">
              <button type="button" :class="{ on: shownLocTab === 'wp' }" :aria-current="shownLocTab === 'wp' ? 'true' : undefined" @click="locTab = 'wp'"><BriefcaseBusiness :size="16" :stroke-width="1.8" aria-hidden="true" /> İşyerleri <em class="sayac">{{ workplacesOf(focusLocation).length }}</em></button>
              <button v-if="canEdit" type="button" :class="{ on: shownLocTab === 'sub' }" :aria-current="shownLocTab === 'sub' ? 'true' : undefined" @click="locTab = 'sub'"><Layers :size="16" :stroke-width="1.8" aria-hidden="true" /> Alt tesisler <em class="sayac">{{ subsOf(focusLocation).length }}</em></button>
              <button v-if="multiUser" type="button" :class="{ on: shownLocTab === 'area' }" :aria-current="shownLocTab === 'area' ? 'true' : undefined" @click="locTab = 'area'"><LayoutGrid :size="16" :stroke-width="1.8" aria-hidden="true" /> Alanlar <em v-if="areaCount != null" class="sayac">{{ areaCount }}</em></button>
            </nav>
            <section class="card loc-panel-wp loc-wp-card">
              <template v-if="shownLocTab === 'wp'">
                <div v-if="!workplacesOf(focusLocation).length" class="wp-empty">
                  <span class="wp-empty-icon"><Building2 :size="20" :stroke-width="1.8" aria-hidden="true" /></span>
                  <strong>Bu lokasyonda henüz işyeri bulunmuyor</strong>
                  <p>SGK sicil / işyeri kaydı ekleyerek çalışan ve tehlike sınıfı takibini başlatabilirsiniz.</p>
                  <button v-if="canEdit" class="soft-button" type="button" @click="startWorkplace(focusLocation)"><Plus :size="16" :stroke-width="1.8" aria-hidden="true" /> Bu lokasyonda işyeri aç</button>
                </div>
                <div v-else class="wp-table-wrap">
                  <PkTable class="wp-table">
                    <thead><tr><th>{{ firm.type === 'public' ? 'SGK no' : 'Firma' }}</th><th>Alt tesis</th><th>Tehlike sınıfı</th><th><span class="sr-only">İşlem</span></th></tr></thead>
                    <tbody>
                      <tr v-for="workplace in workplacesOf(focusLocation)" :key="workplace.id">
                        <td v-if="firm.type === 'public'" :class="{ muted: !workplace.sgk_workplace_number }"><strong>{{ workplace.sgk_workplace_number || '—' }}</strong></td>
                        <td v-else><strong>{{ workplace.company_name }}</strong><small v-if="nameOf(workplace.id)">{{ nameOf(workplace.id) }}</small><small v-if="workplace.sgk_workplace_number">SGK {{ workplace.sgk_workplace_number }}</small></td>
                        <td :class="{ muted: !workplace.sub_facility_name }">{{ workplace.sub_facility_name || '—' }}</td>
                        <td><span class="hazard-badge" :class="hazardClassKey(workplace.hazard_class)">{{ workplace.hazard_class }}</span></td>
                        <td class="end">
                          <span class="wp-actions">
                            <button v-if="multiUser" v-tooltip.top="'Birimler'" class="row-button icon" type="button" :aria-label="`${workplace.company_name} birimleri`" @click="unitTarget = { location: focusLocation, workplace: { id: workplace.id, name: workplaceLabel(workplace.id, workplace.company_name) } }"><Network :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /></button>
                            <button v-if="multiUser" v-tooltip.top="'Uzman ata'" class="row-button icon" type="button" :aria-label="`${workplace.company_name} işyerine uzman ata`" @click="assignId = workplace.id"><UserCog :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /></button>
                            <button v-if="canEdit" v-tooltip.top="'Lokasyondan çıkar'" class="row-button icon remove" type="button" :aria-label="`${workplace.company_name} işyerini lokasyondan çıkar`" @click="openRemove({ name: nameOf(workplace.id) || workplace.company_name, workplace, location: focusLocation })"><X :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /></button>
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </PkTable>
                </div>
              </template>
              <!-- Alt tesisler: tablo; ekle / düzenle / sil pencerede (kullanıcı 21 Kas 2026) -->
              <template v-else-if="shownLocTab === 'sub'">
                <div class="tab-tools">
                  <small>Lokasyonun bölümleri (bina, hangar, kat…); aynı firmanın bu lokasyondaki ikinci işyeri ayrı alt tesiste açılır.</small>
                  <button class="primary-button" type="button" @click="openSubForm(null)"><Plus :size="16" :stroke-width="1.8" aria-hidden="true" /> Alt tesis ekle</button>
                </div>
                <p v-if="subError && !subForm.open && !subDelete" class="form-error" role="alert">{{ subError }}</p>
                <div v-if="!subsOf(focusLocation).length" class="wp-empty">
                  <span class="wp-empty-icon"><Layers :size="20" :stroke-width="1.8" aria-hidden="true" /></span>
                  <strong>Bu lokasyonda alt tesis yok</strong>
                  <p>Alt tesis isteğe bağlıdır; lokasyonda birden fazla bina ya da bölüm varsa ekleyin.</p>
                </div>
                <div v-else class="wp-table-wrap">
                  <PkTable class="wp-table">
                    <thead><tr><th>Alt tesis</th><th>İşyeri</th><th><span class="sr-only">İşlem</span></th></tr></thead>
                    <tbody>
                      <tr v-for="sub in subsOf(focusLocation)" :key="sub.id">
                        <td><strong>{{ sub.name }}</strong></td>
                        <td :class="{ muted: !sub.workplaces_count }">{{ sub.workplaces_count ? `${sub.workplaces_count} işyeri` : 'İşyeri yok' }}</td>
                        <td class="end">
                          <span class="wp-actions">
                            <button v-tooltip.top="'Düzenle'" class="row-button icon" type="button" :aria-label="`${sub.name} alt tesisini düzenle`" @click="openSubForm(sub)"><PencilLine :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /></button>
                            <button v-tooltip.top="sub.workplaces_count ? 'İşyeri olan alt tesis silinemez' : 'Sil'" class="row-button icon remove" type="button" :disabled="!!sub.workplaces_count" :aria-label="`${sub.name} alt tesisini sil`" @click="subError = ''; subDelete = sub"><Trash2 :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /></button>
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </PkTable>
                </div>
              </template>
              <!-- Alanlar (eski yan panelin içeriği): sekme açık değilken de yüklü kalır, şeritteki sayı için -->
              <ExpertLocationAreasDrawer v-if="multiUser" v-show="shownLocTab === 'area'" :key="focusLocation.id" embedded :location="focusLocation" :customer-name="firm?.name" @count="n => areaCount = n" />
            </section>
          </template>
        </aside>
      </div>
      <section v-else class="card"><div class="state">Bu firmanın yapısı boş. <button v-if="canEdit" class="link-button" type="button" @click="repairRoot">Düzelt</button></div></section>

      <!-- İşyerleri (KSY-SIS'teki müşteri işyerleri listesi): firma, lokasyon, alt tesis, tehlike sınıfı; satır şemada o lokasyonu seçer. -->
      <section v-if="nodes.length && !listNode" class="card wp-card">
        <header class="schema-head"><div><h2>İşyerleri</h2><small>{{ workplaceRows.length }} işyeri</small></div></header>
        <div class="wp-table-wrap">
          <PkTable class="wp-table">
            <!-- Kamuda firma sütunu yok: her satırda kurumun adı yazıyordu (kullanıcı 19 Kas 2026); işyeri adı ve SGK lokasyonun altında -->
            <thead><tr><th v-if="firm.type !== 'public'">Firma</th><th>Lokasyon</th><th>Alt tesis</th><th>Tehlike sınıfı</th><th><span class="sr-only">İşlem</span></th></tr></thead>
            <tbody>
              <tr v-for="entry in workplaceRows" :key="entry.workplace.id" tabindex="0" @click="revealLocation(entry.location)" @keydown.enter="revealLocation(entry.location)">
                <td v-if="firm.type !== 'public'"><span class="wp-firm"><span class="firm-avatar"><Building2 :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /></span><span><strong>{{ entry.workplace.company_name }}</strong><small v-if="nameOf(entry.workplace.id)">{{ nameOf(entry.workplace.id) }}</small><small v-if="entry.workplace.sgk_workplace_number">SGK {{ entry.workplace.sgk_workplace_number }}</small></span></span></td>
                <td><strong>{{ entry.location.name }}</strong><small>{{ entry.location.city || '—' }} / {{ entry.location.district || '—' }}</small><template v-if="firm.type === 'public'"><small v-if="nameOf(entry.workplace.id)">{{ nameOf(entry.workplace.id) }}</small><small v-if="entry.workplace.sgk_workplace_number">SGK {{ entry.workplace.sgk_workplace_number }}</small></template></td>
                <td :class="{ muted: !entry.workplace.sub_facility_name }">{{ entry.workplace.sub_facility_name || '—' }}</td>
                <td><span class="hazard-badge" :class="hazardClassKey(entry.workplace.hazard_class)">{{ entry.workplace.hazard_class }}</span></td>
                <td class="end" @click.stop>
                  <span class="wp-actions">
                    <!-- OSGB / kurumsal / kamu: işyerinin birimleri ve uzmanı -->
                    <button v-if="multiUser" v-tooltip.top="'Birimler'" class="row-button icon" type="button" :aria-label="`${entry.workplace.company_name} birimleri`" @click="unitTarget = { location: entry.location, workplace: { id: entry.workplace.id, name: workplaceLabel(entry.workplace.id, entry.workplace.company_name) } }"><Network :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /></button>
                    <button v-if="multiUser" v-tooltip.top="'Uzman ata'" class="row-button icon" type="button" :aria-label="`${entry.workplace.company_name} işyerine uzman ata`" @click="assignId = entry.workplace.id"><UserCog :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /></button>
                    <button v-if="canEdit" v-tooltip.top="'Lokasyondan çıkar'" class="row-button icon remove" type="button" :aria-label="`${entry.workplace.company_name} işyerini lokasyondan çıkar`" @click="openRemove({ name: nameOf(entry.workplace.id) || entry.workplace.company_name, workplace: entry.workplace, location: entry.location })"><X :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /></button>
                  </span>
                </td>
              </tr>
              <tr v-if="!workplaceRows.length"><td :colspan="firm.type === 'public' ? 4 : 5" class="empty">Henüz işyeri yok.</td></tr>
            </tbody>
          </PkTable>
        </div>
      </section>
      </template>

      <!-- Firmalar sekmesi (KSY-SIS): ana firmanın ticari unvanları; işyeri yalnız bunlarla açılır. Kamuda firma kurumun kendisi. -->
      <section v-else id="firmalar" class="card firms-card">
        <header class="schema-head">
          <div><h2>Firmalar</h2><small>İşyeri açarken firma bu listeden seçilir</small></div>
          <button v-if="canEdit" class="primary-button" type="button" @click="firmError = ''; firmFormOpen = true"><Plus :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /> Ekle</button>
        </header>
        <p v-if="firmError && !firmFormOpen" class="form-error" role="alert">{{ firmError }}</p>
        <p v-if="!firms.length" class="muted location-empty">Henüz firma yok. Ekle ile ticari unvanı ekleyin.</p>
        <div v-for="f in firms" :key="f.business_entity_id" class="firm-row">
          <span class="firm-avatar"><Building2 :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /></span>
          <span class="firm-text"><strong>{{ f.name }}</strong><small>{{ f.workplaces_count ? `${f.workplaces_count} işyeri` : 'İşyeri yok' }}</small></span>
          <button v-if="canEdit && !f.workplaces_count" v-tooltip.top="'Ana firmadan çıkar'" class="row-button icon remove" type="button" :aria-label="`${f.name} firmasını çıkar`" @click="unlinkFirm(f)"><X :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /></button>
        </div>
      </section>

      <!-- OSGB / kurumsal / kamu: Ayarlar'daki yapı sayfaları menüde yok, bağlantılar gösterilmez. -->
      <section v-if="!multiUser && !embedded" class="other">
        <details>
          <summary>Diğer işlemler</summary>
          <div class="other-body">
            <NuxtLink to="/expert/settings/locations" class="other-link"><Settings :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /> Lokasyonları ayrıntılı düzenle</NuxtLink>
            <NuxtLink to="/expert/settings/customers" class="other-link"><PencilLine :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /> Firma adını ya da yapısını düzenle</NuxtLink>
          </div>
        </details>
      </section>
    </template>

    <ExpertWorkplaceAssignments v-if="assignId" :only="assignId" @close="assignId = null" />
    <ExpertWorkplaceUnitsModal v-if="unitTarget" :location="unitTarget.location" :workplace="unitTarget.workplace" @close="unitTarget = null" />

    <!-- Alt tesis ekle / düzenle: ortada açılan pencere, yalnız X kapatır -->
    <div v-if="subForm.open && focusLocation" class="modal-backdrop">
      <section class="modal-card panel-card" role="dialog" aria-modal="true" :aria-label="subForm.editing ? 'Alt tesisi düzenle' : 'Alt tesis ekle'">
        <form class="float-card" @submit.prevent="saveSubForm(focusLocation)">
          <div class="add-row-head">
            <h3>{{ subForm.editing ? 'Alt tesisi düzenle' : `${focusLocation.name} · alt tesis ekle` }}</h3>
            <button class="close-button" type="button" aria-label="Kapat" :disabled="subSaving" @click="subForm.open = false"><X :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /></button>
          </div>
          <label class="field">Alt tesis adı <span class="req">*</span>
            <input v-model="subForm.name" type="text" placeholder="Örn. Hangar 2, İdari Bina" autofocus />
          </label>
          <p v-if="subError" class="form-error" role="alert">{{ subError }}</p>
          <button class="primary-button wide" type="submit" :disabled="!subForm.name.trim() || subSaving">{{ subSaving ? 'Kaydediliyor...' : subForm.editing ? 'Kaydet' : 'Ekle' }}</button>
        </form>
      </section>
    </div>
    <!-- Alt tesisi sil -->
    <div v-if="subDelete && focusLocation" class="modal-backdrop">
      <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="sub-delete-title">
        <div class="modal-head">
          <span class="head-icon danger"><Trash2 :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /></span>
          <div><h2 id="sub-delete-title">Alt Tesisi Sil</h2><p>"{{ subDelete.name }}" · {{ focusLocation.name }}</p></div>
          <button class="close-button" type="button" aria-label="Kapat" :disabled="subSaving" @click="subDelete = null"><X :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /></button>
        </div>
        <p class="muted">Silinince geri alınamaz.</p>
        <p v-if="subError" class="form-error" role="alert">{{ subError }}</p>
        <div class="modal-actions">
          <button class="secondary-button" type="button" :disabled="subSaving" @click="subDelete = null">Vazgeç</button>
          <button class="danger-button" type="button" :disabled="subSaving" @click="confirmSubDelete(focusLocation)">{{ subSaving ? 'Siliniyor...' : 'Sil' }}</button>
        </div>
      </section>
    </div>

    <!-- Firma ekle (Firmalar sekmesi): ortada açılan pencere, yalnız X kapatır -->
    <div v-if="firmFormOpen" class="modal-backdrop">
      <section class="modal-card panel-card" role="dialog" aria-modal="true" aria-label="Firma ekle">
        <form class="float-card" @submit.prevent="addFirm">
          <div class="add-row-head">
            <h3>Firma ekle</h3>
            <button class="close-button" type="button" aria-label="Kapat" :disabled="firmSaving" @click="firmFormOpen = false"><X :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /></button>
          </div>
          <label class="field">Ticari unvan <span class="req">*</span>
            <input v-model="newFirmName" type="text" placeholder="Ticari unvan (ör. ABC Gıda A.Ş.)" autofocus />
          </label>
          <p v-if="firmError" class="form-error" role="alert">{{ firmError }}</p>
          <button class="primary-button wide" type="submit" :disabled="!newFirmName.trim() || firmSaving"><Plus :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /> {{ firmSaving ? 'Ekleniyor...' : 'Ekle' }}</button>
        </form>
      </section>
    </div>

    <!-- Dal / birim ekle, düzenle, lokasyon ekle: ortada açılan pencerede; yalnız X kapatır (kullanıcı 20 Kas 2026) -->
    <div v-if="(adding === 'edit' || adding === 'org' || adding === 'location') && selected" class="modal-backdrop">
      <section class="modal-card panel-card" role="dialog" aria-modal="true" :aria-label="`${selected.name} işlemi`">
          <template v-if="adding === 'edit'">
            <form class="float-card" @submit.prevent="saveEdit">
              <div class="add-row-head">
                <h3>{{ selected.name }} düzenle</h3>
                <button class="close-button" type="button" aria-label="Kapat" :disabled="editSaving" @click="closeForm"><X :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /></button>
              </div>
              <label class="field">Ad <span class="req">*</span>
                <input id="edit-name" v-model="editName" type="text" :disabled="isLocked(selected)" />
              </label>
              <!-- Tür etiketi yalnız bireysel uzman hesabında var (backend OSGB / kurumsalda kapalı). -->
              <label v-if="!multiUser" class="field">Tür <small>(isteğe bağlı)</small>
                <select v-model="editLabel">
                  <option value="">Yok</option>
                  <option v-for="label in NODE_LABELS" :key="label" :value="label">{{ label }}</option>
                </select>
              </label>
              <small v-if="isLocked(selected)" class="field-note">Bu kayıt önceki bir sürümde şirket türüyle açıldı; adı değiştirilemiyor. Silip aynı adla yeniden ekleyebilirsiniz.</small>
              <p v-if="editError" class="form-error" role="alert">{{ editError }}</p>
              <button class="primary-button wide" type="submit" :disabled="!editName.trim() || editSaving">{{ editSaving ? 'Kaydediliyor...' : 'Kaydet' }}</button>
            </form>
          </template>

          <template v-else-if="adding === 'org'">
            <form class="float-card" @submit.prevent="saveChild">
              <div class="add-row-head">
                <h3>{{ selected.name }} altına {{ firm.type === 'public' ? 'birim' : 'dal' }} ekle</h3>
                <button class="close-button" type="button" aria-label="Kapat" :disabled="saving" @click="closeForm"><X :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /></button>
              </div>
              <label class="field">{{ firm.type === 'public' ? 'Birimin adı' : 'Dalın adı' }}
                <input v-model="groupName" type="text" :placeholder="firm.type === 'public' ? 'Örn. Fen İşleri Müdürlüğü' : 'Örn. Gıda Grubu, Marmara Bölgesi'" />
              </label>
              <p v-if="childError" class="form-error" role="alert">{{ childError }}</p>
              <button class="primary-button wide" type="submit" :disabled="!groupName.trim() || saving"><Plus :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /> Ekle</button>
            </form>
          </template>

          <template v-else-if="adding === 'location'">
            <form class="float-card" @submit.prevent="saveLocation">
              <div class="add-row-head">
                <h3>{{ selected.name }} altına lokasyon ekle</h3>
                <button class="close-button" type="button" aria-label="Kapat" :disabled="saving" @click="closeForm"><X :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /></button>
              </div>
              <ExpertFirmLocationFields :key="locationFormKey" :draft="draft" :location-only="!autoWorkplace" autofocus />
              <!-- Lokasyon hesabın kaydıdır (KSY-SIS'teki gibi): yazılan ada benzeyen kayıtlı lokasyonlar burada çıkar, "Bağla" ile bu dala bağlanır. -->
              <div v-if="candidates.length" class="candidates" role="group" aria-label="Kayıtlı lokasyonlar">
                <p><Info :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /> Bu lokasyon zaten kayıtlı olabilir. Yenisini açmak yerine bağlayabilirsiniz:</p>
                <div v-for="c in candidates" :key="c.id" class="candidate">
                  <span><strong>{{ c.name }}</strong><small>{{ [c.city, c.district].filter(Boolean).join(' / ') || 'İl girilmemiş' }}{{ c.links ? ' · başka ana firmada da kullanılıyor' : ' · hiçbir ana firmaya bağlı değil' }}</small></span>
                  <button class="secondary-button" type="button" :disabled="saving" @click="linkCandidate(c)"><Link :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /> Bağla</button>
                </div>
              </div>
              <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
              <button class="primary-button wide" type="submit" :disabled="!canSaveLocation || saving">{{ saving ? 'Ekleniyor...' : 'Lokasyonu ekle' }}</button>
            </form>
          </template>
      </section>
    </div>
    <!-- Lokasyon işlemleri (İşyeri aç, Alt tesisler, Başka dala taşı): ortada açılan pencerede; yalnız X kapatır (kullanıcı 20 Kas 2026) -->
    <div v-if="drawerForm && selectedLocation" class="modal-backdrop">
      <section class="modal-card panel-card" role="dialog" aria-modal="true" :aria-label="`${selectedLocation.name} işlemi`">
              <template v-if="adding === 'workplace'">
                <form class="float-card" @submit.prevent="saveRow">
                  <div class="add-row-head">
                    <h3>{{ selectedLocation.name }} içine işyeri aç</h3>
                    <button class="close-button" type="button" aria-label="Kapat" :disabled="rowSaving" @click="closeForm"><X :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /></button>
                  </div>
                  <button class="link-button" type="button" @click="toggleBulk">{{ bulk ? 'Tek tek ekle' : 'Toplu ekle (her satıra bir alt tesis)' }}</button>
                  <p v-if="rowNotice" class="row-notice" role="status"><CircleCheck :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /> {{ rowNotice }}</p>
                  <label v-if="firm.type !== 'individual' && firm.type !== 'public'" class="field">Firma <span class="req">*</span>
                    <select v-model="companyChoice" :disabled="!companyOptions.length">
                      <option v-for="name in companyOptions" :key="name" :value="name">{{ name }}</option>
                    </select>
                    <small v-if="!companyOptions.length" class="field-note">Bu ana firmanın firması yok. <button class="link-button" type="button" @click="closeForm(); tab = 'firmalar'">Firmalar sekmesinden ekleyin</button></small>
                  </label>
                  <label v-if="!bulk" class="field">Alt tesis <small>(isteğe bağlı)</small>
                    <select v-model="row.subFacilityId" @change="row.subFacilityId === -1 && (newSubOpen = true)">
                      <option :value="null">Lokasyonun geneli</option>
                      <option v-for="sub in subsOf(selectedLocation)" :key="sub.id" :value="sub.id">{{ sub.name }}</option>
                      <option v-if="canEdit" :value="-1">+ Yeni alt tesis…</option>
                    </select>
                    <span v-if="newSubOpen" class="sub-add">
                      <input v-model="newSubName" type="text" placeholder="Alt tesis adı (ör. Hangar 2)" aria-label="Yeni alt tesis adı" @keydown.enter.prevent="addSubToRow(selectedLocation)" />
                      <button class="secondary-button" type="button" :disabled="!newSubName.trim() || subSaving" @click="addSubToRow(selectedLocation)">Ekle</button>
                    </span>
                  </label>
                  <label v-if="!bulk" class="field">İşyeri adı <small>(isteğe bağlı)</small>
                    <input v-model="row.name" type="text" placeholder="Boşsa firma adı görünür" />
                  </label>
                  <label v-if="!bulk" class="field">SGK sicil no <small>(isteğe bağlı)</small>
                    <input v-model="row.sgk" type="text" inputmode="numeric" placeholder="İşyeri sicil numarası" />
                  </label>
                  <label class="field">Tehlike sınıfı <span class="req">*</span>
                    <select v-model="row.hazard">
                      <option value="" disabled>Seçin</option>
                      <option v-for="h in HAZARD_CLASSES" :key="h" :value="h">{{ h }}</option>
                    </select>
                  </label>
                  <div class="nace-line">
                    <button class="link-button" type="button" @click="naceOpen = !naceOpen">{{ naceOpen ? 'NACE aramasını kapat' : 'Tehlike sınıfını NACE\'den bul' }}</button>
                    <span v-if="row.naceCode" class="nace-picked"><CircleCheck :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /> {{ row.naceCode }} {{ row.activity }}</span>
                  </div>
                  <div v-if="naceOpen" class="nace-box">
                    <input v-model="naceQuery" type="text" aria-label="NACE kodu ya da faaliyet ara" placeholder="Faaliyeti ya da NACE kodunu yazın: depolama, 52.10" autocomplete="off" @input="searchNace" />
                    <ul v-if="naceResults.length" class="nace-results" aria-label="NACE sonuçları">
                      <li v-for="nace in naceResults" :key="nace.id"><button type="button" @click="selectNace(nace)"><strong>{{ nace.nace_code }}</strong> {{ nace.activity_name }} <em>{{ nace.hazard_class }}</em></button></li>
                    </ul>
                  </div>
                  <label v-if="bulk" class="field">Her satıra bir alt tesis yazın; seçili firma her birinde ayrı işyeri açar
                    <textarea v-model="bulkText" rows="4" placeholder="Beyaz Eşya Depo&#10;Antrepo&#10;Yedek Parça Deposu" />
                  </label>
                  <p v-if="rowError" class="form-error" role="alert">{{ rowError }}</p>
                  <button class="primary-button wide" type="submit" :disabled="rowSaving || limitFull || !row.hazard || !companyFor(selectedLocation)"><Plus :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /> {{ rowSaving ? 'Ekleniyor...' : bulk ? 'Hepsini aç' : 'İşyeri aç' }}</button>
                  <small class="field-note">Aynı firmanın bu lokasyondaki ikinci işyeri ayrı bir alt tesiste açılır.</small>
                </form>
              </template>

              <!-- Başka dala taşı -->
              <template v-else-if="adding === 'move'">
                <form class="float-card" @submit.prevent="confirmMove">
                  <div class="add-row-head">
                    <h3>{{ selectedLocation.name }} · {{ firm.type === 'public' ? 'başka birime taşı' : 'başka dala taşı' }}</h3>
                    <button class="close-button" type="button" aria-label="Kapat" @click="closeForm"><X :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /></button>
                  </div>
                  <label class="field">{{ firm.type === 'public' ? 'Taşınacak birim' : 'Taşınacak dal' }}
                    <select v-model="moveTarget">
                      <option value="" disabled>Seçin</option>
                      <option v-for="n in flatten(nodes).filter(n => String(n.id) !== String(selectedLocation!.organization_id))" :key="n.id" :value="String(n.id)">{{ n.name }}</option>
                    </select>
                  </label>
                  <button class="primary-button wide" type="submit" :disabled="!moveTarget || saving">{{ saving ? 'Taşınıyor...' : 'Taşı' }}</button>
                </form>
              </template>
      </section>
    </div>

    <!-- Grup, şirket ya da lokasyonu sil -->
    <div v-if="removing" class="modal-backdrop">
      <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="remove-title">
        <div class="modal-head">
          <span class="head-icon danger"><Trash2 :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /></span>
          <div><h2 id="remove-title">{{ removing.workplace ? 'Firmayı Lokasyondan Çıkar' : removing.location ? 'Lokasyonu Sil' : 'Sil' }}</h2><p>"{{ removing.name }}"<template v-if="removing.workplace"> · {{ removing.location?.name }}</template></p></div>
          <button class="close-button" type="button" aria-label="Kapat" :disabled="deleting" @click="removing = null"><X :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /></button>
        </div>
        <p v-if="removeChecking" class="muted">Kayıtlar kontrol ediliyor...</p>
        <template v-else-if="removeWarn">
          <p class="delete-warn"><PkIcon class="pi pi-exclamation-triangle" /> {{ removeWarn }}</p>
          <label v-if="!removing.workplace" class="field">Onaylamak için adını yazın<input v-model="removeConfirm" type="text" :placeholder="removing.name" /></label>
        </template>
        <p v-else-if="!formError" class="muted">{{ removing.workplace ? 'Yalnız firma çıkarılır, lokasyon yerinde kalır.' : 'Bu kayıtta ekipman, tesisat ya da rapor yok. Silinince geri alınamaz.' }}</p>
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
        <div class="modal-actions">
          <button class="secondary-button" type="button" :disabled="deleting" @click="removing = null">Vazgeç</button>
          <button class="danger-button" type="button" :disabled="!canRemove || deleting" @click="confirmRemove">{{ deleting ? 'İşleniyor...' : removing.workplace ? 'Firmayı Çıkar' : 'Sil' }}</button>
        </div>
      </section>
    </div>

    <!-- Firmayı sil -->
    <div v-if="deleteOpen" class="modal-backdrop">
      <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="delete-title">
        <div class="modal-head">
          <span class="head-icon danger"><Trash2 :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /></span>
          <div><h2 id="delete-title">Firmayı Sil</h2><p>"{{ firm?.name }}" kalıcı olarak silinir.</p></div>
          <button class="close-button" type="button" aria-label="Kapat" :disabled="deleting" @click="deleteOpen = false"><X :size="16" :stroke-width="1.8" class="lucide-i" aria-hidden="true" /></button>
        </div>
        <p class="delete-warn"><PkIcon class="pi pi-exclamation-triangle" /> Bu işlem <strong>geri alınamaz</strong>. Altındaki lokasyonlar, işyerleri, ekipmanlar ve kontrol raporları da silinir.</p>
        <p v-if="!summary && !formError" class="muted">Kayıtlar hesaplanıyor...</p>
        <template v-if="summary">
          <ul v-if="summaryRows.length" class="delete-list"><li v-for="row in summaryRows" :key="row.label"><strong>{{ row.count }}</strong> {{ row.label }}</li></ul>
          <p v-if="summary.blockers.length" class="form-error">Silinemez: {{ summary.blockers.join(', ') }}.</p>
          <label v-else-if="summaryRows.length" class="field">Onaylamak için firma adını yazın<input v-model="deleteConfirm" type="text" :placeholder="firm?.name" /></label>
        </template>
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
        <div class="modal-actions">
          <button class="secondary-button" type="button" :disabled="deleting" @click="deleteOpen = false">İptal</button>
          <button class="danger-button" type="button" :disabled="!canDelete || deleting" @click="removeFirm">{{ deleting ? 'Siliniyor...' : 'Kalıcı Olarak Sil' }}</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
// Bireysel uzmanın firma sayfası: tek pencere, bütün yapı ağaçta; işlemler satırda, formlar satırın altında. Lokasyon herhangi bir düğüme bağlanan boş bir yerdir; firmalar lokasyonda faaliyet gösterir.
import { customerTypeLabel } from '~/composables/useCustomerTypes'
import { ArrowLeft, BriefcaseBusiness, Building2, ChevronLeft, ChevronRight, CircleCheck, Ellipsis, FolderInput, Info, Layers, LayoutGrid, Link, MapPin, Network, Package, PencilLine, Plus, Settings, Trash2, UserCog, X } from 'lucide-vue-next'
import { HAZARD_CLASSES, hazardClassKey, normalizeCompanyName, type NaceItem } from '~/composables/useExpertApi'
import type { Firm, FirmLocation, FirmNode, LocationDraft, WorkplaceProgress, WorkplaceRowDraft } from '~/composables/useFirmSetup'
import type { Workplace } from '~/composables/useWorkplaceContext'

// Sayfa (pages/expert/firma/[id].vue) ya da OSGB Firmalarım'daki tek ağacın bir müşterisi (embedded: sayfa başlığı, geri bağlantısı,
// görünüm seçimi ve Diğer işlemler yok; yapı satıra tıklanınca yüklenir).
const props = defineProps<{ customerId: string | number; embedded?: boolean; preview?: Firm | null }>()
const emit = defineEmits<{ changed: [] }>()
const route = useRoute()
// Birden çok ağaç aynı sayfada olabilir: form ve satır aramaları bu ağacın içinde yapılır.
const rootEl = ref<HTMLElement | null>(null)
const inTree = <T extends Element = Element>(selector: string) => rootEl.value?.querySelector<T>(selector) ?? null
const { get, post, patch, del, errorMessage } = useExpertApi()
const { listFirms, loadStructure, addNode, addLocation, addWorkplace, addWorkplaceRow, workplaceLimitMessage } = useFirmSetup()
const { workplaces, load: loadWorkplaces } = useMyWorkplaces()
const { load: loadNames, nameOf, workplaceLabel } = useWorkplaceNames()
const { load: loadOrganizationScope } = useOrganizationScope()
const { multiUser, corporate, isManager, isOperation, topLabel, load: loadAccount } = useAccount()
const goToEquipment = useGoToEquipment()
// OSGB / kurumsal / kamu: yapıyı yönetici değiştirir, operasyon yöneticisi görür (Ayarlar → Lokasyonlar'daki kural).
const canEdit = computed(() => !multiUser.value || isManager.value)

const firm = ref<Firm | null>(null)
const nodes = ref<FirmNode[]>([])
const locations = ref<FirmLocation[]>([])
const loading = ref(!props.embedded)
const error = ref('')

// Formu açık olan düğüm (alt organizasyon, lokasyon ya da ad düzeltme buraya yapılır).
const selectedId = ref<number | string | null>(null)
const selected = computed<FirmNode | null>(() => flatten(nodes.value).find(n => String(n.id) === String(selectedId.value)) ?? nodes.value[0] ?? null)
const pathTo = (list: FirmNode[], id: number | string): FirmNode[] => {
  for (const node of list) {
    if (String(node.id) === String(id)) return [node]
    const below = pathTo(node.children || [], id)
    if (below.length) return [node, ...below]
  }
  return []
}
const canBranch = computed(() => firm.value?.type === 'corporate' || firm.value?.type === 'public')
const hasBranches = computed(() => nodes.value.some(n => n.children?.length))
// KSY-SIS: ortak lokasyonda yalnız bu ana firmanın işyerleri (sahibi boş eski kayıtlar da görünür).
const workplacesOf = (location: FirmLocation) => workplaces.value.filter(w => String(w.location_id) === String(location.id) && (w.customer_id == null || String(w.customer_id) === String(props.customerId)))
// Lokasyon kartındaki "Firma: …" / kamuda "Birim: …" (lokasyonun bağlı olduğu düğüm)
const ownerOf = (location: FirmLocation) => firm.value?.type === 'public'
  ? flatten(nodes.value).find(n => String(n.id) === String(location.organization_id))?.name || ''
  : [...new Set(workplacesOf(location).map(w => w.company_name))].join(', ')
const firmsOf = (location: FirmLocation) => workplacesOf(location).map(w => w.company_name)

// İşyeri formu açık olan lokasyon; düğüm seçilince kapanır. Lokasyon silinirse bulunamaz, form da kapanmış olur.
const selectedLocationId = ref<number | string | null>(null)
const selectedLocation = computed(() => selectedLocationId.value == null ? null : locations.value.find(l => String(l.id) === String(selectedLocationId.value)) ?? null)
function selectNode(node: FirmNode) {
  if (selectedLocationId.value == null && String(selectedId.value) === String(node.id)) return
  selectedId.value = node.id
  selectedLocationId.value = null
  resetLocationForm()
  groupName.value = ''
  childError.value = ''
}
function selectLocation(location: FirmLocation) {
  if (location.organization_id != null) selectedId.value = location.organization_id
  if (String(selectedLocationId.value) === String(location.id)) return
  selectedLocationId.value = location.id
  resetRow(true)
  rowNotice.value = ''
  freshIds.value = []
}

// --- Ağaç: satırlar düz liste olarak üretilir, girinti derinlikten gelir; formlar da böylece satırın hemen altına girer ---
// Organizasyonlar açık, lokasyonlar kapalı başlar (işyerleri lokasyona tıklayınca görünür).
type TreeRow =
  | { kind: 'node'; key: string; depth: number; node: FirmNode }
  | { kind: 'location'; key: string; depth: number; location: FirmLocation }
  | { kind: 'workplace'; key: string; depth: number; workplace: Workplace; location: FirmLocation }
const closed = ref(new Set<string>())
const openLocations = ref(new Set<string>())
const locationsOf = (node: FirmNode) => locations.value.filter(l => String(l.organization_id) === String(node.id))
const hasContent = (node: FirmNode) => !!node.children?.length || !!locationsOf(node).length
const treeRows = computed(() => {
  const out: TreeRow[] = []
  const walk = (node: FirmNode, depth: number) => {
    const key = `n${node.id}`
    out.push({ kind: 'node', key, depth, node })
    if (closed.value.has(key)) return
    for (const location of locationsOf(node)) {
      const locationKey = `l${location.id}`
      out.push({ kind: 'location', key: locationKey, depth: depth + 1, location })
      if (openLocations.value.has(locationKey)) {
        for (const workplace of workplacesOf(location)) out.push({ kind: 'workplace', key: `w${workplace.id}`, depth: depth + 2, workplace, location })
      }
    }
    for (const child of node.children || []) walk(child, depth + 1)
  }
  nodes.value.forEach(node => walk(node, 0))
  return out
})
function toggleNode(key: string) {
  if (closed.value.has(key)) closed.value.delete(key)
  else closed.value.add(key)
}
function toggleLocation(location: FirmLocation) {
  const key = `l${location.id}`
  if (!workplacesOf(location).length) return
  if (openLocations.value.has(key)) openLocations.value.delete(key)
  else openLocations.value.add(key)
}
// Kart ağacı itmez, üstünde durur: ekranın altında kalırsa görünene kadar kaydırılır.
const focusForm = () => nextTick(() => {
  inTree('.float-card')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  inTree<HTMLElement>('.float-card select, .float-card input')?.focus({ preventScroll: true })
})
// Aynı anda tek kart açık olur; aynı simgeye yeniden basmak kapatır.
const adding = ref<'org' | 'location' | 'workplace' | 'edit' | 'sub' | 'move' | null>(null)
function openNodeForm(node: FirmNode, kind: 'org' | 'location') {
  if (adding.value === kind && String(selected.value?.id) === String(node.id)) return closeForm()
  selectNode(node)
  childError.value = ''
  formError.value = ''
  adding.value = kind
  closed.value.delete(`n${node.id}`)
  focusForm()
}
const startOrg = (node: FirmNode) => openNodeForm(node, 'org')
function startLocation(node: FirmNode) {
  openNodeForm(node, 'location')
  locationLimitFull.value = false
  // Hak doluysa uyarı verilir; lokasyon yine eklenir, işyeri açılmaz (tehlike sınıfı da sorulmaz).
  if (adding.value === 'location' && autoWorkplace.value) {
    workplaceLimitMessage().then((message) => { locationLimitFull.value = !!message; if (message) formError.value = `${message} Lokasyon işyerisiz eklenir.` }).catch(() => {})
  }
}
function startWorkplace(location: FirmLocation) {
  if (adding.value === 'workplace' && String(selectedLocationId.value) === String(location.id)) return closeForm()
  selectLocation(location)
  adding.value = 'workplace'
  openLocations.value.add(`l${location.id}`)
  focusForm()
}
function closeForm() {
  adding.value = null
  selectedLocationId.value = null
}
// Formlar pencerede: dışarı tıklama kapatmaz (yalnız X); Esc boş formu kapatır.
const formDirty = computed(() => adding.value === 'edit' ? (!!selected.value && (editName.value.trim() !== selected.value.name || editLabel.value !== labelOf(selected.value)))
  : adding.value === 'org' ? !!groupName.value.trim()
  : adding.value === 'location' ? !!(draft.name.trim() || draft.cityId || draft.districtId || draft.hazard)
  : !!(row.name.trim() || row.sgk.trim() || row.hazard || row.naceCode || bulkText.value.trim() || naceQuery.value.trim()))
const dialogOpen = () => !!removing.value || deleteOpen.value
const drawerForm = computed(() => adding.value === 'workplace' || adding.value === 'move')
function onPageKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && adding.value && !dialogOpen() && !formDirty.value) closeForm()
}
onMounted(() => {
  document.addEventListener('keydown', onPageKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onPageKey)
})
// İşyerleri tablosundan: lokasyon şemada seçilir, sayfa şemaya kayar.
function revealLocation(location: FirmLocation) {
  showLocation(location)
  nextTick(() => rootEl.value?.querySelector('.overview')?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
}

// "Firmaya göre": aynı firmanın bu müşterideki bütün işyerleri, lokasyonlarıyla.
const treeView = ref<'yer' | 'firma'>('yer')
const byCompany = computed(() => {
  const map = new Map<string, { company: string; items: { id: number; title: string; location: FirmLocation }[] }>()
  for (const location of locations.value) {
    for (const w of workplacesOf(location)) {
      if (!map.has(w.company_name)) map.set(w.company_name, { company: w.company_name, items: [] })
      map.get(w.company_name)!.items.push({ id: w.id, title: nameOf(w.id) || w.company_name, location })
    }
  }
  return [...map.values()].sort((a, b) => a.company.localeCompare(b.company, 'tr'))
})
// İşyerleri tablosu: bu ana firmanın bütün işyerleri, firma adına göre (KSY-SIS müşteri işyerleri).
const workplaceRows = computed(() => locations.value
  .flatMap(location => workplacesOf(location).map(workplace => ({ workplace, location })))
  .sort((a, b) => a.workplace.company_name.localeCompare(b.workplace.company_name, 'tr') || a.location.name.localeCompare(b.location.name, 'tr')))

async function load() {
  error.value = ''
  // Yalnız ilk yüklemede (OSGB tek ağacında satır açılırken); kayıttan sonraki yenilemede ağaç yerinde kalır.
  if (!firm.value) loading.value = true
  try {
    await loadAccount()
    // Bireysel uzman ile OSGB / kurumsal / kamu hesabının yöneticisi ve operasyon yöneticisi; uzman kendi işyerleri tablosuna döner.
    if (multiUser.value && !isManager.value && !isOperation.value) return navigateTo('/expert/workplaces', { replace: true })
    const [firms, structure, labels] = await Promise.all([listFirms(), loadStructure(String(props.customerId)), multiUser.value ? {} : get<Record<string, string>>(`/customers/${props.customerId}/pk-organization-labels`).catch(() => ({} as Record<string, string>)), loadWorkplaces(true), loadNames()])
    const found = firms.find(f => String(f.id) === String(props.customerId)) || null
    // Kurumsal hesabın tek müşterisi firmanın kendisi: türü boş gelir, kurumsal firma gibi davranır (Lokasyona Firma Ata sihirbazındaki gibi).
    firm.value = found && !found.type && corporate.value ? { ...found, type: 'corporate' } : found
    if (!firm.value) { error.value = 'Firma bulunamadı.'; return }
    nodes.value = structure.nodes
    locations.value = structure.locations
    loadFirms()
    nodeLabels.value = labels || {}
    // Üstteki Organizasyon kutusu da güncel kalsın; hatasını kendi yutar.
    loadOrganizationScope(true)
  } catch (e: any) {
    error.value = errorMessage(e, 'Firma bilgileri alınamadı.')
  } finally { loading.value = false }
}

// --- Lokasyon: düğümün altında açılan form ---
const newDraft = (): LocationDraft => ({ name: '', cityId: null, districtId: null, address: '', hazard: '', company: '', naceCode: null, activity: null })
const draft = reactive<LocationDraft>(newDraft())
const progress = ref<WorkplaceProgress>({})
const saving = ref(false)
const formError = ref('')
const locationFormKey = ref(0)
// Tek firmalı yapıda (Ltd. / A.Ş., şahıs) lokasyondaki işyeri firmanın kendisidir: lokasyonla birlikte açılır, tehlike sınıfı her lokasyonda sorulur (kullanıcı 1 Kas 2026).
const locationLimitFull = ref(false)
const autoWorkplace = computed(() => (singleCompany.value || firm.value?.type === 'individual') && !locationLimitFull.value)
const canSaveLocation = computed(() => !!draft.name.trim() && !!draft.cityId && (!autoWorkplace.value || !!draft.hazard))
const limitFull = ref(false)
function resetLocationForm() {
  Object.assign(draft, newDraft())
  progress.value = {}
  formError.value = ''
  locationFormKey.value++
}
async function saveLocation() {
  const node = selected.value
  if (!canSaveLocation.value || !firm.value || !node || saving.value) return
  saving.value = true
  formError.value = ''
  try {
    // Kayıt sonrası yenileme başarısız olup tekrar denenirse ikinci lokasyon ya da işyeri açılmaz.
    if (autoWorkplace.value) {
      // Yardım amaçlı: başka işyeri "İşyeri ekle" ile eklenir, satırdan silinir.
      if (!progress.value.workplaceDone) await addWorkplace(firm.value.id, node.id, { ...draft, company: firm.value.name }, firm.value.type, progress.value)
    }
    else if (!progress.value.locationId) progress.value.locationId = await addLocation(firm.value.id, node.id, draft)
    const id = progress.value.locationId
    const withWorkplace = autoWorkplace.value
    await load()
    resetLocationForm()
    closeForm()
    // Yeni lokasyon sağdaki kartta seçilir; işyeri birlikte açılmadıysa işyeri formu hemen açılır (en az tıklama).
    focusNodeId.value = null
    focusId.value = id ?? null
    const created = locations.value.find(l => String(l.id) === String(id))
    if (created && !withWorkplace) startWorkplace(created)
    else nextTick(() => inTree(`[data-key="l${id}"]`)?.scrollIntoView({ block: 'nearest' }))
  } catch (e: any) {
    formError.value = errorMessage(e, e?.message || 'Lokasyon eklenemedi. Tekrar deneyin.')
  } finally { saving.value = false }
}

// --- Şema (OrgChart): seçim, taşıma ---
const nodeById = (id: number | string) => flatten(nodes.value).find(n => String(n.id) === String(id))!
// Şemadaki Sil: paneldeki Sil ile aynı (kurumsal / kamuda kök de yalnız düğümdür; bireyselde kök = ana firmayı sil)
function removeFromChart(id: number | string) {
  const node = nodeById(id)
  if (node.id !== nodes.value[0]?.id || corporate.value) openRemove({ name: node.name, node })
  else openDelete()
}
const focusNodeId = ref<number | string | null>(null)
const focusNode = computed(() => focusNodeId.value == null ? null : flatten(nodes.value).find(n => String(n.id) === String(focusNodeId.value)) ?? null)
const chartKey = computed(() => adding.value === 'workplace' && selectedLocation.value ? `l${selectedLocation.value.id}`
  : adding.value && selected.value ? `n${selected.value.id}`
  : focusNode.value ? `n${focusNode.value.id}` : focusLocation.value ? `l${focusLocation.value.id}` : null)
const locationWorkplaceCounts = computed(() => Object.fromEntries(locations.value.map(l => [String(l.id), workplacesOf(l).length])))
function selectChart(key: string) {
  const location = key.startsWith('l') ? locations.value.find(l => String(l.id) === key.slice(1)) : null
  if (location) return showLocation(location)
  closeForm()
  listNodeId.value = null
  focusNodeId.value = key.slice(1)
}
// Lokasyonun işlemleri dal listesindeki kartta: listeyi açar, lokasyon seçili gelir.
function showLocation(location: FirmLocation) {
  focusId.value = location.id
  if (location.organization_id != null) return openList(location.organization_id)
  closeForm()
  focusNodeId.value = null
}
// Sağ sütun yalnız içinde bir şey varken: açık form, dal listesindeki lokasyon ya da Firmalar kartı (kamuda yok).
// Formlar pencerede, Firmalar kendi sekmesinde: sağ sütun yalnız dal listesi açıkken
const sideOpen = computed(() => !!listNodeId.value)
const tab = ref<'org' | 'firmalar'>('org')
async function moveLocation(locationId: number | string, nodeId: number | string) {
  error.value = ''
  try { await patch(`/customers/${props.customerId}/pk-location-links/${locationId}`, { organization_id: nodeId }); await load() }
  catch (e: any) { error.value = errorMessage(e, 'Lokasyon taşınamadı.') }
}
async function moveNode(nodeId: number | string, parentId: number | string) {
  error.value = ''
  try { await patch(`/customers/${props.customerId}/pk-organizations/${nodeId}/parent`, { parent_id: parentId }); await load() }
  catch (e: any) { error.value = errorMessage(e, 'Taşınamadı.') }
}

// --- Çok lokasyonlu dalın listesi (sağ panel) ---
const listNodeId = ref<number | string | null>(null)
const listQuery = ref('')
// Büyük şemanın dal konumları (OrgChart yerleşimi): küçük şema aynı yerleşimi çizer.
const chartPositions = ref<Record<string, { x: number; y: number }>>({})
const listNode = computed(() => listNodeId.value == null ? null : flatten(nodes.value).find(n => String(n.id) === String(listNodeId.value)) ?? null)
const listLocations = computed(() => listNode.value ? locationsOf(listNode.value).slice().sort((a, b) => a.name.localeCompare(b.name, 'tr')) : [])
const listEmptyCount = computed(() => listLocations.value.filter(l => !workplacesOf(l).length).length)
// Lokasyon kartındaki ⋯ menüsü: taşı / sil (sağdaki panelde açılır)
const locMenu = ref<any>(null)
const MENU_VARS = '--p-menu-background:var(--admin-surface);--p-menu-border-color:var(--admin-border);--p-menu-color:var(--admin-text);--p-menu-item-color:var(--admin-text);--p-menu-item-focus-background:var(--admin-hover);--p-menu-item-focus-color:var(--admin-heading)'
const locMenuItems = computed(() => {
  const location = focusLocation.value
  if (!location || !canEdit.value) return []
  return [
    ...(flatten(nodes.value).length > 1 ? [{ label: firm.value?.type === 'public' ? 'Başka birime taşı' : 'Başka dala taşı', command: () => openMove(location) }] : []),
    { label: 'Sil', command: () => openRemove({ name: location.name, location }) }
  ]
})
const filteredList = computed(() => {
  const q = listQuery.value.trim().toLocaleLowerCase('tr-TR')
  return q ? listLocations.value.filter(l => [l.name, l.city, l.district, l.address].some(v => v?.toLocaleLowerCase('tr-TR').includes(q))) : listLocations.value
})
function openList(nodeId: number | string) {
  closeForm()
  focusNodeId.value = null
  listQuery.value = ''
  listNodeId.value = nodeId
  const first = listLocations.value[0]
  if (first && !listLocations.value.some(l => String(l.id) === String(focusId.value))) focusId.value = first.id
}
function openFromList(location: FirmLocation) {
  closeForm()
  focusNodeId.value = null
  focusId.value = location.id
}
function closeList() {
  listNodeId.value = null
  listQuery.value = ''
}
// Sayfalama (sayfa başına 5); arama ya da başka dalın listesi açılınca ilk sayfa
const PAGE_SIZE = 5
const listPage = ref(1)
const pageCount = computed(() => Math.max(1, Math.ceil(filteredList.value.length / PAGE_SIZE)))
const pagedList = computed(() => filteredList.value.slice((listPage.value - 1) * PAGE_SIZE, listPage.value * PAGE_SIZE))
const pageButtons = computed<(number | '…')[]>(() => {
  const n = pageCount.value, p = listPage.value
  if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1)
  const set = [1, p - 1, p, p + 1, n].filter(x => x >= 1 && x <= n)
  const out: (number | '…')[] = []
  ;[...new Set(set)].sort((a, b) => a - b).forEach((x, i, arr) => { if (i && x - arr[i - 1] > 1) out.push('…'); out.push(x) })
  return out
})
watch([listQuery, listNodeId], () => { listPage.value = 1 })
watch(pageCount, (n) => { if (listPage.value > n) listPage.value = n })
const moveTargets = computed(() => focusLocation.value ? flatten(nodes.value).filter(n => String(n.id) !== String(focusLocation.value!.organization_id)) : [])
async function onMoveSelect(location: FirmLocation, nodeId: string) {
  const target = nodeId ? nodeById(nodeId) : null
  if (!target || !window.confirm(`"${location.name}" lokasyonu "${target.name}" altına taşınsın mı?`)) return
  await moveLocation(location.id, nodeId)
}

// --- Satırdaki işlemler: alt tesisler, başka dala taşı (formlar sağ panelde) ---
const moveTarget = ref('')
function openMove(location: FirmLocation) {
  selectLocation(location)
  focusId.value = location.id
  moveTarget.value = ''
  adding.value = 'move'
}
async function confirmMove() {
  const location = selectedLocation.value
  if (!location || !moveTarget.value || saving.value) return
  saving.value = true
  try { await moveLocation(location.id, moveTarget.value); closeForm() }
  finally { saving.value = false }
}
// Lokasyon avatarı: baş harfler, adına göre sabit pastel renk.
const AVATAR_TONES = [['#d6e2ff', '#0030b8'], ['#f3e0ff', '#6a1fb8'], ['#d0f2ff', '#0c53b7'], ['#c8f2d8', '#007b55'], ['#fff2d6', '#b75a00'], ['#ffe7d9', '#b72136']]
const initialsOf = (name: string) => name.replace(/[()]/g, '').split(/\s+/).filter(w => w && !/^(ve|ile)$/i.test(w)).slice(0, 2).map(w => w[0]).join('').toLocaleUpperCase('tr-TR')
const avatarStyle = (name: string) => { const [bg, fg] = AVATAR_TONES[[...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % AVATAR_TONES.length]; return { background: bg, color: fg } }

// --- Kayıtlı lokasyonu bağla: lokasyon formunda yazılan ada göre (ara → bağla → işyeri formu) ---
const candidates = ref<{ id: number; name: string; city: string | null; district: string | null; links: number }[]>([])
let candidateTimer: ReturnType<typeof setTimeout> | undefined
let candidateRequest = 0
watch(() => adding.value === 'location' ? draft.name.trim() : '', (q) => {
  clearTimeout(candidateTimer)
  if (q.length < 2 || !firm.value) { candidates.value = []; return }
  const no = ++candidateRequest
  candidateTimer = setTimeout(async () => {
    try {
      const list = await get<typeof candidates.value>(`/customers/${firm.value!.id}/pk-location-candidates`, { q })
      if (no === candidateRequest) candidates.value = list.slice(0, 5)
    } catch { if (no === candidateRequest) candidates.value = [] }
  }, 300)
})
async function linkCandidate(candidate: { id: number }) {
  const node = selected.value
  if (!firm.value || !node || saving.value) return
  saving.value = true
  formError.value = ''
  try {
    await post(`/customers/${firm.value.id}/organizations/${node.id}/pk-location-links`, { location_id: candidate.id })
    await load()
    resetLocationForm()
    closeForm()
    candidates.value = []
    focusNodeId.value = null
    focusId.value = candidate.id
    const linked = locations.value.find(l => String(l.id) === String(candidate.id))
    if (linked && canEdit.value) startWorkplace(linked)
  } catch (e: any) {
    formError.value = errorMessage(e, 'Lokasyon bağlanamadı. Tekrar deneyin.')
  } finally { saving.value = false }
}

// --- Ana firmanın firmaları (KSY-SIS): Firmalar sekmesi ve işyeri formundaki seçenekler ---
type CustomerFirm = { business_entity_id: number; name: string; company_type: string | null; workplaces_count: number }
const firms = ref<CustomerFirm[]>([])
const newFirmName = ref('')
const firmSaving = ref(false)
const firmError = ref('')
const firmFormOpen = ref(false)
const loadFirms = async () => { firms.value = await get<CustomerFirm[]>(`/customers/${props.customerId}/firms`).catch(() => firms.value) }
async function addFirm() {
  if (!newFirmName.value.trim() || firmSaving.value) return
  firmSaving.value = true
  firmError.value = ''
  try {
    await post(`/customers/${props.customerId}/firms`, { name: newFirmName.value.trim(), company_type: firm.value?.type === 'individual' ? 'individual' : 'corporate' })
    newFirmName.value = ''
    firmFormOpen.value = false
    await loadFirms()
  } catch (e: any) { firmError.value = errorMessage(e, 'Firma eklenemedi.') }
  finally { firmSaving.value = false }
}
async function unlinkFirm(item: CustomerFirm) {
  firmError.value = ''
  try { await del(`/customers/${props.customerId}/firms/${item.business_entity_id}`); await loadFirms() }
  catch (e: any) { firmError.value = errorMessage(e, 'Firma çıkarılamadı.') }
}

// --- Alt tesisler (KSY-SIS): lokasyonun bölümleri; lokasyon başına bir kez yüklenir ---
type SubFacility = { id: number; name: string; workplaces_count: number }
const subFacilities = ref<Record<string, SubFacility[]>>({})
const newSubName = ref('')
const subSaving = ref(false)
const subError = ref('')
const subsOf = (location: FirmLocation) => subFacilities.value[String(location.id)] || []
const loadSubs = async (locationId: number | string) => {
  try { subFacilities.value = { ...subFacilities.value, [String(locationId)]: await get<SubFacility[]>(`/locations/${locationId}/sub-facilities`) } }
  catch { /* alt tesis listesi alınamazsa boş görünür */ }
}
async function ensureSub(location: FirmLocation, name: string) {
  const found = subsOf(location).find(sub => sub.name.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'))
  if (found) return found.id
  const created = await post<SubFacility>(`/locations/${location.id}/sub-facilities`, { name })
  subFacilities.value = { ...subFacilities.value, [String(location.id)]: [...subsOf(location), created] }
  return created.id
}
// İşyeri formundaki "+ Yeni alt tesis": açılır, formda seçili gelir.
const newSubOpen = ref(false)
async function addSubToRow(location: FirmLocation) {
  if (!newSubName.value.trim() || subSaving.value) return
  subSaving.value = true
  rowError.value = ''
  try { row.subFacilityId = await ensureSub(location, newSubName.value.trim()); newSubName.value = ''; newSubOpen.value = false }
  catch (e: any) { rowError.value = errorMessage(e, 'Alt tesis eklenemedi.') }
  finally { subSaving.value = false }
}
// Alt tesisler sekmesi: ekle / düzenle penceresi ve silme onayı
const subForm = reactive({ open: false, editing: null as SubFacility | null, name: '' })
const subDelete = ref<SubFacility | null>(null)
function openSubForm(sub: SubFacility | null) {
  Object.assign(subForm, { open: true, editing: sub, name: sub?.name || '' })
  subError.value = ''
}
async function saveSubForm(location: FirmLocation) {
  const name = subForm.name.trim()
  if (!name || subSaving.value) return
  subSaving.value = true
  subError.value = ''
  try {
    if (subForm.editing) await patch(`/locations/${location.id}/sub-facilities/${subForm.editing.id}`, { name })
    else await post(`/locations/${location.id}/sub-facilities`, { name })
    await loadSubs(location.id)
    subForm.open = false
    // İşyeri tablosundaki alt tesis adı da güncellensin
    if (subForm.editing) await load()
  } catch (e: any) { subError.value = errorMessage(e, subForm.editing ? 'Alt tesis kaydedilemedi.' : 'Alt tesis eklenemedi.') }
  finally { subSaving.value = false }
}
async function confirmSubDelete(location: FirmLocation) {
  if (!subDelete.value || subSaving.value) return
  subSaving.value = true
  subError.value = ''
  try { await del(`/locations/${location.id}/sub-facilities/${subDelete.value.id}`); await loadSubs(location.id); subDelete.value = null }
  catch (e: any) { subError.value = errorMessage(e, 'Alt tesis silinemedi.') }
  finally { subSaving.value = false }
}

// --- Lokasyona işyeri: satır içi form (tek ya da toplu) ---
// Firma (tüzel kişi) listeden seçilir ya da yazılır; bağ kayıtla birlikte kurulur. Şahıs işletmesinde firma kendisidir,
// kamuda kart lokasyonun adıyla açılır (mevcut kural). Tehlike sınıfı için varsayılan verilmez: her kayıtta seçilir.
const flatten = (list: FirmNode[]): FirmNode[] => list.flatMap(n => [n, ...flatten(n.children || [])])
const nodeNames = computed(() => flatten(nodes.value).map(n => n.name))
const showCompanyColumn = computed(() => firm.value?.type === 'corporate')
// Seçenekler yalnız gerçek firmalar: bu lokasyondakiler ve üstteki ilk organizasyonla onun alt dallarındaki lokasyonlardakiler (aynı ad bir kez).
// Yukarı doğru gidilmez: alttaki lokasyonda üst grubun firması görünmez. Firma, işyeri açıldığı lokasyon üzerinden o organizasyona bağlanır. Tek şirketlik yapıda firmanın kendisi.
// Firma seçenekleri: ana firmanın Firmalar listesi (KSY-SIS). Liste boş ve tek şirketlik yapıysa firmanın kendisi.
const companyOptions = computed(() => {
  const names = firms.value.map(f => f.name)
  if (!names.length && !hasBranches.value && firm.value) names.push(firm.value.name)
  return names
})
const row = reactive<WorkplaceRowDraft>({ name: '', company: '', sgk: '', hazard: '', naceCode: null, activity: null, subFacilityId: null })
const companyChoice = ref('')
const newCompany = ref('')
const lastCompany = ref('')
const bulk = ref(false)
const bulkText = ref('')
const rowSaving = ref(false)
const rowError = ref('')
const rowNotice = ref('')
const freshIds = ref<number[]>([])
const companyFor = (location: FirmLocation) => {
  const type = firm.value?.type
  // Şahıs işletmesi ve kamu kurumu: işyerinin firması ana firmanın kendisi (kamu: kullanıcı 17 Kas 2026).
  if (type === 'individual' || type === 'public') return firm.value!.name
  return companyChoice.value
}
function resetRow(keepNothing = false) {
  Object.assign(row, { name: '', sgk: '', hazard: '', naceCode: null, activity: null, subFacilityId: null })
  newSubOpen.value = false
  newCompany.value = ''
  bulkText.value = ''
  rowError.value = ''
  naceOpen.value = false
  naceQuery.value = ''
  naceResults.value = []
  if (keepNothing || !companyOptions.value.includes(companyChoice.value)) {
    // Son seçilen firma öne gelir; yoksa listenin ilki.
    const options = companyOptions.value
    companyChoice.value = options.includes(lastCompany.value) ? lastCompany.value : options[0] ?? ''
  }
  limitFull.value = false
  workplaceLimitMessage().then((message) => { limitFull.value = !!message; if (message) rowError.value = message }).catch(() => {})
}
function toggleBulk() { bulk.value = !bulk.value; rowError.value = '' }

async function saveRow() {
  const location = selectedLocation.value
  if (!firm.value || !location || rowSaving.value) return
  const company = companyFor(location)
  const names = bulk.value ? bulkText.value.split('\n').map(s => s.trim()).filter(Boolean) : [row.name.trim()]
  rowError.value = ''
  if (!company) { rowError.value = 'Firma seçin (yukarıdaki Firmalar kartından ekleyebilirsiniz).'; return }
  if (bulk.value && !names.length) { rowError.value = 'En az bir alt tesis yazın.'; return }
  if (!row.hazard) { rowError.value = 'Tehlike sınıfını seçin.'; return }
  rowSaving.value = true
  const before = new Set(workplacesOf(location).map(w => w.id))
  let done = 0
  try {
    const limit = await workplaceLimitMessage()
    if (limit) { rowError.value = limit; limitFull.value = true; return }
    // Toplu: her satır bir alt tesis (yoksa açılır), seçili firma her birinde ayrı işyeri açar.
    for (const name of names) {
      const subFacilityId = bulk.value ? await ensureSub(location, name) : row.subFacilityId === -1 ? null : row.subFacilityId
      await addWorkplaceRow(firm.value.id, location.id, { ...row, name: bulk.value ? '' : name, company, sgk: bulk.value ? '' : row.sgk, subFacilityId }, firm.value.type)
      done++
    }
  } catch (e: any) {
    rowError.value = errorMessage(e, e?.message || 'İşyeri eklenemedi. Tekrar deneyin.')
  } finally {
    if (done) {
      await loadWorkplaces(true).catch(() => {})
      freshIds.value = workplacesOf(location).map(w => w.id).filter(id => !before.has(id))
      const label = names.length === 1 ? (names[0] || company) : `${done} işyeri`
      rowNotice.value = firm.value!.type !== 'individual' ? `${label} eklendi · ${company} adına` : `${label} eklendi`
      if (firm.value!.type !== 'individual') { lastCompany.value = company; companyChoice.value = company }
      loadFirms()
      loadSubs(location.id)
      if (!rowError.value) { resetRow(); focusForm() }
      else bulkText.value = names.slice(done).join('\n')
    }
    rowSaving.value = false
  }
}

// NACE isteğe bağlı: seçilirse tehlike sınıfı kendiliğinden gelir, değiştirilebilir.
const naceOpen = ref(false)
const naceQuery = ref('')
const naceResults = ref<NaceItem[]>([])
let naceTimer: ReturnType<typeof setTimeout> | undefined
function searchNace() {
  clearTimeout(naceTimer)
  const q = naceQuery.value.trim()
  if (q.length < 2) { naceResults.value = []; return }
  naceTimer = setTimeout(async () => {
    try { naceResults.value = await get<NaceItem[]>('/nace-hazard-classes', { search: q }) } catch { naceResults.value = [] }
  }, 250)
}
function selectNace(item: NaceItem) {
  Object.assign(row, { naceCode: item.nace_code, activity: item.activity_name, hazard: item.hazard_class })
  naceQuery.value = ''
  naceResults.value = []
  naceOpen.value = false
}

// --- Düğüm türleri: kök (holding / firma / kurum) ve organizasyon (grup, şirket, marka… hepsi aynı; kamuda birim) ---
type NodeKind = 'root' | 'org'
const depthOf = (node: FirmNode) => pathTo(nodes.value, node.id).length - 1
const kindOf = (node: FirmNode): NodeKind => depthOf(node) <= 0 ? 'root' : 'org'
// Önceki sürümde "şirket"/"marka" türüyle açılan düğümlerin adını backend değiştirtmez (silme yeni PK ucuyla yapılır).
const isLocked = (node: FirmNode) => node.type === 'company' || node.type === 'brand'
const firmWorkplaces = computed(() => locations.value.flatMap(l => workplacesOf(l)))
const headerStats = computed(() => {
  const orgs = flatten(nodes.value).length - nodes.value.length
  const parts: string[] = []
  if (orgs) parts.push(`${orgs} ${firm.value?.type === 'public' ? 'birim' : 'dal'}`)
  parts.push(`${locations.value.length} lokasyon`, `${firmWorkplaces.value.length} işyeri`)
  return parts.join(' · ')
})

// Satır içi alt organizasyon ekleme (backend varsayılanı "group" türüyle; silinebilir ve adı düzenlenebilir).
const groupName = ref('')
const childError = ref('')
async function saveChild() {
  const parent = selected.value
  const name = groupName.value.trim()
  if (!name || !firm.value || !parent || saving.value) return
  saving.value = true
  childError.value = ''
  try {
    await addNode(firm.value.id, name, parent.id)
    groupName.value = ''
    await load()
    closed.value.delete(`n${parent.id}`)
    closeForm()
  } catch (e: any) {
    childError.value = errorMessage(e, 'Eklenemedi. Tekrar deneyin.')
  } finally { saving.value = false }
}

// Düzeltme kartı (satırdaki kalem): ad ve tür. Kökte firmanın (müşteri) adı da birlikte değişir. Tür yalnız gösterim etiketidir;
// backend'in organizations.type alanı değildir (o alan düğümü kilitler).
const NODE_LABELS = ['Holding', 'Grup', 'Şirket', 'Marka', 'Bölge']
const nodeLabels = ref<Record<string, string>>({})
const labelOf = (node: FirmNode) => nodeLabels.value[String(node.id)] || ''
// Ltd. / A.Ş.: şube lokasyondur, alt organizasyon gerekmez. Tür Holding / Grup yapılırsa ya da altında düğüm varsa simge görünür; türü boş eski kayıtlar değişmez.
const singleCompany = computed(() => firm.value?.type === 'corporate' && !hasBranches.value && nodes.value.some(node => labelOf(node) === 'Şirket'))
const editName = ref('')
const editLabel = ref('')
const editSaving = ref(false)
const editError = ref('')
function startEdit(node: FirmNode) {
  if (adding.value === 'edit' && String(selected.value?.id) === String(node.id)) return closeForm()
  selectNode(node)
  editName.value = node.name
  editLabel.value = labelOf(node)
  editError.value = ''
  adding.value = 'edit'
  nextTick(() => {
    inTree('.float-card')?.scrollIntoView({ block: 'nearest' })
    inTree<HTMLInputElement>('#edit-name')?.select()
  })
}
async function saveEdit() {
  const node = selected.value
  const name = editName.value.trim()
  if (!node || !firm.value || !name || editSaving.value) return
  editSaving.value = true
  editError.value = ''
  try {
    if (name !== node.name && !isLocked(node)) {
      await patch(`/customers/${firm.value.id}/organizations/${node.id}`, { name })
      // Kurumsal / kamu hesabında müşteri hesabın kendisidir: kökün adı müşteriyi değiştirmez (Ayarlar → Organizasyon'daki gibi).
      if (kindOf(node) === 'root' && !corporate.value) {
        await patch(`/customers/${firm.value.id}`, { name })
        firm.value = { ...firm.value, name }
      }
    }
    if (!multiUser.value && editLabel.value !== labelOf(node)) await patch(`/customers/${firm.value.id}/pk-organizations/${node.id}/label`, { label: editLabel.value || null })
    closeForm()
    await load()
  } catch (e: any) {
    editError.value = errorMessage(e, 'Kaydedilemedi. Tekrar deneyin.')
  } finally { editSaving.value = false }
}
// Eski kayıtta kök düğüm yoksa (yarım kalmış kurulum) aynı adla açılır.
async function repairRoot() {
  if (!firm.value) return
  try { await addNode(firm.value.id, firm.value.name, null); await load() }
  catch (e: any) { error.value = errorMessage(e, 'Düzeltilemedi.') }
}

const goEquipment = (location: FirmLocation) => goToEquipment(location.id)

// --- Firma sayfasının üst sırası (tasarım kataloğu 12; gömülü ağaçta yok) ---
// Katalogda yok, gizli; ileride açılabilir: başlıktaki tür + sayılar satırı (sayılar Organizasyon yapısı kartında) ve
// eski Yere göre / Firmaya göre seçimi (aynı iş Lokasyonlar / İşyeri sekmelerinde).
const SHOW_HEADER_STATS = false
const SHOW_VIEW_TOGGLE = false
// Organizasyon şeması: her düğüm bir satır (girintili), doğrudan bağlı lokasyonları yanında kutu olarak.
const schemaRows = computed(() => {
  const out: { key: string; depth: number; node: FirmNode; locations: FirmLocation[] }[] = []
  const walk = (node: FirmNode, depth: number) => {
    out.push({ key: `n${node.id}`, depth, node, locations: locationsOf(node) })
    for (const child of node.children || []) walk(child, depth + 1)
  }
  nodes.value.forEach(node => walk(node, 0))
  return out
})
const orgCount = computed(() => flatten(nodes.value).length - nodes.value.length)
// Seçili lokasyon: tıklanan, yoksa üstte seçili lokasyon (bu firmanınsa), yoksa ilk lokasyon.
const { context: workContext } = useWorkplaceContext()
const focusId = ref<number | string | null>(null)
const focusLocation = computed(() => locations.value.find(l => String(l.id) === String(focusId.value))
  || locations.value.find(l => String(l.id) === String(workContext.value?.location_id))
  || locations.value[0] || null)
// Lokasyonun ekipman (aktif) ve tesisat sayısı: Durum raporu ucundan, lokasyon başına bir kez.
const locationCounts = ref<Record<string, { equipment: number; installations: number }>>({})
const focusCounts = computed(() => focusLocation.value ? locationCounts.value[String(focusLocation.value.id)] || null : null)
// Seçili lokasyonun (kart) ve işyeri formu açık lokasyonun alt tesisleri
watch(() => [focusLocation.value?.id, selectedLocationId.value], ([a, b]) => { for (const id of [a, b]) if (id != null && !subFacilities.value[String(id)]) loadSubs(id) })
watch(() => props.embedded ? null : focusLocation.value?.id, async (id) => {
  if (id == null || locationCounts.value[String(id)]) return
  try {
    const report = await get<any>('/pk-dashboard/report', { 'location_ids[]': [id] })
    locationCounts.value = { ...locationCounts.value, [String(id)]: { equipment: report.locations?.[0]?.total ?? report.totals?.equipment ?? 0, installations: report.installations?.length ?? 0 } }
  } catch { /* sayı alınamazsa kartta "—" */ }
})
// Tesisat sayfası ve Lokasyona git (Genel Bakış): üstteki seçim bu lokasyon olur (ekipmandaki gibi).
const { groups: workplaceGroups, selectLocation: chooseLocation } = useMyWorkplaces()
async function openLocationPage(location: FirmLocation, path: string) {
  const group = workplaceGroups.value.find(g => String(g.location_id) === String(location.id))
  if (group) chooseLocation(group)
  await navigateTo(path)
}
// Sekmedeki Lokasyon ekle: seçili lokasyonun organizasyonuna (yoksa köke) lokasyon formu ağaçta açılır.
function addLocationFromTab() {
  treeView.value = 'yer'
  const owner = flatten(nodes.value).find(n => String(n.id) === String(focusLocation.value?.organization_id)) || nodes.value[0]
  if (owner) startLocation(owner)
}
// Uzman ata penceresi açık olan işyeri (OSGB / kurumsal / kamu; yönetici ve operasyon yöneticisi).
const assignId = ref<number | null>(null)
// Lokasyon kartının sekmesi (İşyerleri / Alt tesisler / Alanlar); yetkisi olmayan sekme seçili kaldıysa İşyerleri görünür.
const locTab = ref<'wp' | 'sub' | 'area'>('wp')
const shownLocTab = computed(() => (locTab.value === 'sub' && !canEdit.value) || (locTab.value === 'area' && !multiUser.value) ? 'wp' : locTab.value)
const areaCount = ref<number | null>(null)
watch(() => focusLocation.value?.id, () => { areaCount.value = null; subError.value = '' })
// Birimler penceresi açık olan işyeri (OSGB / kurumsal / kamu).
const unitTarget = ref<{ location: FirmLocation; workplace: { id: number; name: string } } | null>(null)

// --- Ağaçtan silme ---
// Backend lokasyonu silince ekipman, tesisat ve toplu raporlar da silinir; firmayı çıkarınca bu kayıtlar lokasyonda firmasız kalır.
// Pencere neyin gideceğini sayısıyla yazar;
// kayıt varsa Firmayı Sil'deki gibi ad yazılarak onaylanır. Sayım yapılamazsa uyarı gösterilemeyeceği için Sil açılmaz.
interface RemoveTarget { name: string; node?: FirmNode; location?: FirmLocation; workplace?: Workplace }
const removing = ref<RemoveTarget | null>(null)
const removeChecking = ref(false)
const removeWarn = ref('')
const removeConfirm = ref('')
const canRemove = computed(() => !!removing.value && !removeChecking.value && !formError.value
  && (!removeWarn.value || !!removing.value.workplace || removeConfirm.value.trim().toLocaleLowerCase('tr-TR') === removing.value.name.trim().toLocaleLowerCase('tr-TR')))
type RecordRow = { workplace?: { id: number } | null; location_business_entity_id?: number | null }
const recordsOf = async (locationId: number | string, path: string) => {
  const response = await get<any>(path, { location_id: locationId })
  const list = Array.isArray(response) ? response : response?.data
  if (!Array.isArray(list)) throw new Error('Kayıtlar sayılamadı.')
  return list as RecordRow[]
}
const subtreeOf = (node: FirmNode) => flatten([node])
const locationsUnder = (node: FirmNode) => {
  const ids = subtreeOf(node).map(n => String(n.id))
  return locations.value.filter(l => ids.includes(String(l.organization_id)))
}
async function removalWarning(target: RemoveTarget) {
  const targets = target.node ? locationsUnder(target.node) : [target.location!]
  const lists = await Promise.all(['/pk-equipment', '/pk-installations', '/pk-bulk-reports'].map(async path => (await Promise.all(targets.map(l => recordsOf(l.id, path)))).flat()))
  const totals = lists.map(list => list.length)
  if (target.workplace) {
    const own = lists.map(list => list.filter(item => (item.workplace?.id ?? item.location_business_entity_id) === target.workplace!.id).length)
    const parts = [[own[0], 'ekipman'], [own[1], 'tesisat'], [own[2], 'toplu rapor']].filter(([count]) => count).map(([count, label]) => `${count} ${label}`)
    // Firmasız lokasyon çalışma alanında görünmez: son firma çıkınca kayıtlar silinmez ama ulaşılamaz.
    const hidden = workplacesOf(target.location!).length === 1 && totals.some(Boolean)
    return [
      parts.length ? `Bu firmaya bağlı ${parts.join(', ')} silinmez; lokasyonda firmasız kalır.` : '',
      hidden ? 'Lokasyonda başka firma kalmadığı için yeni firma ekleyene kadar buradaki kayıtlara ulaşamazsınız.' : ''
    ].filter(Boolean).join(' ')
  }
  const inner = target.node ? [[subtreeOf(target.node).length - 1, 'grup/şirket'], [targets.length, 'lokasyon']] as [number, string][] : []
  const parts = [...inner, [totals[0], 'ekipman'], [totals[1], 'tesisat'], [totals[2], 'toplu rapor']].filter(([count]) => count).map(([count, label]) => `${count} ${label}`)
  return parts.length ? `Buradaki ${parts.join(', ')} birlikte kalıcı olarak silinir. Bu işlem geri alınamaz.` : ''
}
async function openRemove(target: RemoveTarget) {
  removing.value = target
  removeWarn.value = ''
  removeConfirm.value = ''
  formError.value = ''
  removeChecking.value = true
  try { removeWarn.value = await removalWarning(target) }
  catch (e: any) { formError.value = errorMessage(e, 'Kayıtlar sayılamadı, silme yapılmadı.') }
  finally { removeChecking.value = false }
}
// Önce firma bağları kaldırılır: backend eski saha kayıtları olan firmayı burada reddeder, lokasyon silinmez.
// Başka ana firmaya da bağlı (ortak) lokasyon silinmez, yalnız bu ana firmadan ayrılır: işyerleri ve kayıtları öbüründe kalır.
async function removeLocation(location: FirmLocation) {
  try { await del(`/customers/${firm.value!.id}/pk-location-links/${location.id}`); return }
  catch (e: any) { if (e?.data?.code !== 'tek_bag') throw e }
  for (const link of workplacesOf(location)) await del(`/customers/${firm.value!.id}/locations/${location.id}/companies/${link.id}`)
  await del(`/locations/${location.id}`)
}
async function confirmRemove() {
  const target = removing.value
  if (!target || !firm.value || !canRemove.value || deleting.value) return
  deleting.value = true
  formError.value = ''
  try {
    // Pencere açıkken kayıt değiştiyse kullanıcı yeni sayıyı görmeden silinmez.
    const fresh = await removalWarning(target)
    if (fresh !== removeWarn.value) { removeWarn.value = fresh; return }
    if (target.workplace) await del(`/customers/${firm.value.id}/locations/${target.location!.id}/companies/${target.workplace.id}`)
    else if (target.location) await removeLocation(target.location)
    else if (target.node) {
      for (const location of locationsUnder(target.node)) await removeLocation(location)
      // Backend dolu düğümü silmez: önce en alttakiler.
      // Yeni PK ucu: türden bağımsız siler, engelleri okunur mesajla (422) bildirir.
      for (const node of subtreeOf(target.node).reverse()) await del(`/customers/${firm.value.id}/pk-organizations/${node.id}`)
    }
    // Pencere liste yenilendikten sonra kapanır; çıkarılan firma bir an görünmeye devam etmez.
    await load()
    removing.value = null
  } catch (e: any) {
    formError.value = errorMessage(e, 'Silinemedi.')
    await load()
  } finally { deleting.value = false }
}

// --- Silme: mevcut uçlar; kayıt varsa onay için ad yazılır ---
interface Summary { organizations: number; locations: number; workplaces: number; equipment: number; inspections: number; blockers: string[] }
const deleteOpen = ref(false)
const summary = ref<Summary | null>(null)
const deleteConfirm = ref('')
const deleting = ref(false)
const summaryRows = computed(() => summary.value ? [
  { label: 'lokasyon', count: summary.value.locations },
  { label: 'işyeri', count: summary.value.workplaces },
  { label: 'ekipman', count: summary.value.equipment },
  { label: 'kontrol raporu (dosyalarıyla)', count: summary.value.inspections }
].filter(r => r.count > 0) : [])
const canDelete = computed(() => !!summary.value && !summary.value.blockers.length
  && (!summaryRows.value.length || deleteConfirm.value.trim().toLocaleLowerCase('tr-TR') === firm.value?.name.trim().toLocaleLowerCase('tr-TR')))
async function openDelete() {
  deleteOpen.value = true
  summary.value = null
  deleteConfirm.value = ''
  formError.value = ''
  try { summary.value = await get<Summary>(`/customers/${firm.value?.id}/purge-summary`) }
  catch (e: any) { formError.value = errorMessage(e, 'Firmanın kayıtları alınamadı.') }
}
async function removeFirm() {
  if (!canDelete.value) return
  deleting.value = true
  formError.value = ''
  try {
    await del(`/customers/${firm.value?.id}/purge`)
    await loadWorkplaces(true)
    // OSGB tek ağacında liste yenilenir (silinen müşteri listeden düşer).
    if (props.embedded) { deleteOpen.value = false; emit('changed') }
    else await navigateTo('/expert/workplaces')
  } catch (e: any) {
    formError.value = errorMessage(e, 'Firma silinemedi.')
  } finally { deleting.value = false }
}

onMounted(async () => {
  if (props.embedded) return
  await load()
  // "Başka Lokasyon Ekle" ile gelindiyse form hemen açılır.
  if (route.query.lokasyon && nodes.value[0]) startLocation(nodes.value[0])
  // Firmalarım tablosundaki "Düzenle" ile gelindiyse firmanın (kök) düzenleme kartı açılır.
  else if (route.query.duzenle && canEdit.value && nodes.value[0]) startEdit(nodes.value[0])
})
</script>

<style scoped>
.firm-detail { margin: 0 auto; }
.back { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 14px; color: var(--admin-muted); font-size: 13.5px; font-weight: 600; }
.back:hover { color: var(--admin-heading); }
.page-head { margin-bottom: 16px; }
h1 { margin: 0; color: var(--admin-heading); font-size: 22px; letter-spacing: 0; overflow-wrap: anywhere; }
.page-head p { display: flex; align-items: center; gap: 10px; margin: 8px 0 0; color: var(--admin-muted); font-size: 13.5px; }
.chip { padding: 3px 9px; border-radius: 7px; background: var(--admin-soft); color: var(--admin-heading); font-size: 12px; font-weight: 600; }
.card { padding: 14px; border: 1px solid var(--admin-border); border-radius: 12px; background: var(--admin-card, var(--admin-input)); }
.tree-card { min-height: 260px; padding: 0 24px 24px; border: 0; border-radius: var(--pk-radius); box-shadow: var(--pk-card-shadow); overflow: visible; }
/* Firma ve lokasyon detayı üst sırası (tasarım kataloğu 12) */
.page-head h1 { font-size: 24px; font-weight: 700; line-height: 1.15; letter-spacing: 0; }
.page-head .lead { margin: 6px 0 0; color: var(--admin-muted); font-size: 15px; }
.lucide-i { flex: none; vertical-align: -3px; }
/* Organizasyon şeması (KSY-SIS'teki gibi) + sağda seçili lokasyon kartı; Behance kart görünümü */
.overview { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 24px; align-items: start; margin-bottom: 24px; }
.overview.no-side { grid-template-columns: minmax(0, 1fr); }
.side { position: sticky; top: 90px; display: grid; gap: 24px; align-content: start; min-width: 0; max-height: calc(100vh - 110px); overflow-y: auto; }
@media (max-width: 1180px) { .side { position: static; max-height: none; overflow: visible; } }
.panel-card { padding: 24px; border: 0; border-radius: var(--pk-radius); box-shadow: var(--pk-card-shadow); }
.panel-card .float-card { position: static; width: auto; max-height: none; overflow: visible; box-shadow: none; display: grid; gap: 14px; }
.panel-card .add-row-head { display: flex; flex-wrap: nowrap; align-items: flex-start; justify-content: space-between; gap: 8px; }
.panel-card .add-row-head h3 { margin: 0; color: var(--admin-heading); font-size: 16px; font-weight: 700; line-height: 1.3; }
.panel-card .field { color: var(--admin-heading); font-size: 13px; font-weight: 600; }
.panel-card .field input, .panel-card .field select, .panel-card .field textarea { width: 100%; min-height: 40px; padding: 0 12px; border: 1px solid rgba(145, 158, 171, .32); border-radius: 8px; background: var(--admin-input); color: var(--admin-heading); font: inherit; font-size: 14px; font-weight: 400; }
.panel-card .field textarea { padding: 10px 12px; }
.panel-card .field input:focus, .panel-card .field select:focus, .panel-card .field textarea:focus { outline: 0; border-color: var(--pk-accent); box-shadow: 0 0 0 3px var(--pk-focus-ring); }
.panel-card .close-button { flex: none; width: 30px; height: 30px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--admin-muted); cursor: pointer; }
.panel-card .close-button:hover { background: rgba(145, 158, 171, .12); color: var(--admin-heading); }
.panel-card .primary-button.wide { min-height: 40px; display: inline-flex; align-items: center; gap: 6px; border: 0; border-radius: 8px; background: var(--pk-accent); color: var(--pk-on-accent); font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 8px 16px rgba(var(--pk-accent-rgb), .24); }
.panel-card .primary-button.wide:disabled { opacity: .5; box-shadow: none; cursor: default; }
.panel-card .field { display: grid; gap: 6px; }
.primary-button.wide { width: 100%; justify-content: center; }
.location-workplaces li.fresh { background: var(--pk-success-lighter); border-radius: 6px; }
.wp-card { padding: 24px 0 8px; border: 0; border-radius: var(--pk-radius); box-shadow: var(--pk-card-shadow); }
.wp-card .schema-head { padding: 0 24px 16px; }
.wp-actions { display: inline-flex; gap: 6px; }
/* Sekmeler: Raporlar sayfasındaki .segment ile aynı görünüm */
.segment { display: inline-flex; gap: 4px; margin-bottom: 16px; padding: 4px; border-radius: 10px; background: var(--admin-card); box-shadow: var(--pk-card-shadow); max-width: 100%; }
.segment button { display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 20px; border: 0; border-radius: 8px; background: none; color: var(--admin-heading); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
.segment button.active { background: var(--pk-accent); color: var(--pk-on-accent); font-weight: 700; }
.seg-count { padding: 1px 8px; border-radius: 999px; background: rgba(145, 158, 171, .16); font-size: 12px; }
@media (max-width: 760px) { .segment button { padding: 0 12px; font-size: 13px; } }
.firms-card .schema-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.firms-card { display: grid; gap: 10px; padding: 24px; border: 0; border-radius: var(--pk-radius); box-shadow: var(--pk-card-shadow); }
.schema-card, .location-card { display: grid; gap: 16px; padding: 24px; border: 0; border-radius: var(--pk-radius); box-shadow: var(--pk-card-shadow); }
.schema-head h2, .location-card h2 { margin: 0; color: var(--admin-heading); font-size: 17px; font-weight: 700; overflow-wrap: anywhere; }
.schema-head small { display: block; margin-top: 4px; color: var(--admin-muted); font-size: 13px; }
/* Satırlar girintili; dalın solunda üst düğümden gelen dirsek çizgisi */
.schema { --step: 32px; max-height: 520px; overflow: auto; display: grid; gap: 12px; padding: 4px 2px 4px 0; background-image: radial-gradient(rgba(145, 158, 171, .28) 1px, transparent 1px); background-size: 16px 16px; border-radius: 12px; }
.schema-row { position: relative; display: flex; flex-wrap: wrap; align-items: flex-start; gap: 10px 14px; padding-left: calc(var(--depth) * var(--step) + 8px); padding-top: 4px; }
.schema-row.child::before { content: ""; position: absolute; left: calc((var(--depth) - 1) * var(--step) + 22px); top: -12px; width: 18px; height: 40px; border-left: 2px solid rgba(145, 158, 171, .4); border-bottom: 2px solid rgba(145, 158, 171, .4); border-bottom-left-radius: 8px; }
.schema-node { position: relative; display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 8px 10px 8px 8px; border-radius: 12px; background: var(--admin-card); box-shadow: 0 0 0 1px rgba(145, 158, 171, .24); }
.schema-node.root { box-shadow: 0 0 0 2px rgba(var(--pk-accent-rgb), .35); }
.schema-node-icon { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 10px; background: var(--pk-violet-lighter); color: var(--pk-violet-dark); }
.schema-node.root .schema-node-icon { background: var(--pk-primary-lighter); color: var(--pk-primary-dark); }
.schema-node-text { display: grid; }
.schema-node-text strong { color: var(--admin-heading); font-size: 14px; font-weight: 700; }
.schema-node-text small { color: var(--admin-muted); font-size: 12px; }
.schema-node-actions { display: flex; gap: 4px; margin-left: 6px; }
.schema-add { position: relative; height: 30px; display: inline-flex; align-items: center; gap: 4px; padding: 0 9px; font: inherit; font-size: 12px; font-weight: 700; white-space: nowrap; border: 1px dashed rgba(145, 158, 171, .55); border-radius: 8px; background: transparent; color: var(--admin-muted); cursor: pointer; }
.schema-add:hover, .schema-add:focus-visible { border-style: solid; border-color: var(--pk-accent); background: var(--admin-accent-soft); color: var(--pk-accent); }
.schema-add .pi { font-size: 10px; }
.schema-locations { display: flex; flex-wrap: wrap; gap: 8px; }
.schema-location { display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 8px 14px 8px 10px; border: 0; border-radius: 12px; background: var(--pk-success-lighter); color: var(--pk-success-darker); font: inherit; text-align: left; cursor: pointer; }
.schema-location > i { color: var(--pk-success-dark); }
.schema-location span { display: grid; }
.schema-location strong { font-size: 13px; font-weight: 700; }
.schema-location small { color: var(--pk-success-dark); font-size: 12px; }
.schema-location:hover { box-shadow: 0 0 0 2px rgba(0, 171, 85, .35); }
.schema-location.on { background: var(--pk-accent); color: var(--pk-on-accent); box-shadow: 0 8px 16px rgba(var(--pk-accent-rgb), .24); }
.schema-location.on > i, .schema-location.on small { color: var(--pk-on-accent); }
:global(.dark-theme) .schema-location:not(.on) { background: rgba(0, 171, 85, .14); color: var(--admin-heading); }
.location-card { align-self: start; }
.location-card header { display: flex; align-items: flex-start; gap: 12px; }
.location-card header small { display: block; margin-top: 4px; color: var(--admin-muted); font-size: 13px; }
.location-workplaces { display: grid; margin: 0; padding: 0; list-style: none; }
.location-workplaces li { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 0; color: var(--admin-heading); font-size: 14px; }
.location-workplaces li + li { border-top: 1px dashed rgba(145, 158, 171, .24); }
.location-empty { margin: 0; font-size: 13px; }
.go-button { width: 100%; justify-content: center; min-height: 44px; }
.location-links { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.count-row { display: flex; align-items: center; gap: 10px; padding: 12px; border: 0; border-radius: 12px; background: rgba(145, 158, 171, .08); color: var(--admin-heading); font: inherit; text-align: left; cursor: pointer; }
.count-row:hover:not(:disabled) { background: rgba(145, 158, 171, .16); }
.count-row:disabled { opacity: .55; cursor: default; }
.count-icon { flex: none; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; }
.count-icon.violet { background: var(--pk-violet-lighter); color: var(--pk-violet-dark); }
.count-icon.info { background: var(--pk-info-lighter); color: var(--pk-info-dark); }
.count-text { display: grid; }
.count-text strong { font-size: 18px; font-weight: 700; line-height: 1.1; }
.count-text small { color: var(--admin-muted); font-size: 12px; }
/* Dalın lokasyon listesi (şemanın yerinde) + üstte ayrı başlık kartı */
.main-col { display: grid; gap: 16px; min-width: 0; }
/* Başlık kartı: beyaz (kullanıcı 19 Kas 2026; eskiden dalın renginde geçiş) */
.list-banner { display: flex; align-items: center; gap: 14px; padding: 16px 20px; border: 0; border-radius: var(--pk-radius); background: var(--admin-card); box-shadow: var(--pk-card-shadow); }
.list-banner-icon { flex: none; width: 46px; height: 46px; display: grid; place-items: center; border-radius: 12px; background: var(--admin-card); color: var(--pk-violet-dark); font-size: 18px; }
.list-banner > div { flex: 1; min-width: 0; display: grid; gap: 2px; }
.list-banner h2 { margin: 0; color: var(--admin-heading); font-size: 19px; font-weight: 700; }
.list-banner small { color: var(--admin-muted); font-size: 13px; font-weight: 600; }
/* Yol satırı sade gri, yalnız son dal koyu (kullanıcı 25 Kas 2026) */
.list-crumb { display: flex; align-items: center; gap: 6px; color: var(--admin-muted); font-size: 13px; }
.list-crumb .link-button { padding: 0; color: inherit; font: inherit; font-weight: 500; text-decoration: none; }
.list-crumb .link-button:hover { color: var(--admin-heading); text-decoration: underline; }
.list-crumb .pi-angle-right { font-size: 10px; }
/* Küçük şema: beyaz zemin, büyük şemanın renkleri */
.mini-tree-button { flex: none; display: grid; place-items: center; padding: 4px 8px; border: 0; border-radius: 10px; background: var(--admin-card); box-shadow: none; cursor: pointer; }
.mini-tree-button:hover { box-shadow: 0 0 0 2px color-mix(in srgb, var(--dal) 35%, transparent); }
@media (max-width: 700px) { .mini-tree-button { padding: 2px 4px; } }
.loc-cards-card { padding: 16px; border: 0; border-radius: var(--pk-radius); box-shadow: var(--pk-card-shadow); }
.loc-cards { max-height: 600px; overflow-y: auto; display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; padding: 2px; }
.loc-card { display: grid; grid-template-columns: minmax(200px, 1.1fr) minmax(110px, .6fr) minmax(0, 1.6fr) auto; align-items: center; gap: 4px 16px; padding: 12px 16px; border: 1px solid rgba(145, 158, 171, .24); border-radius: 12px; background: var(--admin-card); color: inherit; font: inherit; text-align: left; cursor: pointer; transition: border-color .15s ease, box-shadow .15s ease; }
.loc-card:hover { border-color: rgba(0, 171, 85, .45); }
.loc-card.selected { border-color: var(--pk-accent); box-shadow: 0 0 0 2px rgba(var(--pk-accent-rgb), .25); }
.loc-card-head { display: flex; align-items: center; gap: 10px; }
.loc-card-head strong { color: var(--admin-heading); font-size: 14px; font-weight: 700; line-height: 1.3; }
.loc-card-district { color: var(--admin-heading); font-size: 12.5px; font-weight: 600; }
.loc-card-address { display: -webkit-box; overflow: hidden; color: var(--admin-muted); font-size: 12px; line-height: 1.4; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.loc-card .count-pill { justify-self: end; }
@media (max-width: 900px) { .loc-card { grid-template-columns: minmax(0, 1fr) auto; } .loc-card-address, .loc-card-district { grid-column: 1; } }
.schema-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.crumb-back { padding: 0; font: inherit; font-size: 17px; font-weight: 700; color: var(--pk-accent); }
.schema-head h2 .pi-angle-right { margin: 0 4px; color: var(--admin-muted); font-size: 12px; }
.chart-list { height: 560px; display: flex; flex-direction: column; gap: 12px; }
.chart-list-tools { display: flex; gap: 10px; }
.chart-list-tools .list-search { flex: 1; }
.chart-list .wp-table-wrap { flex: 1; overflow: auto; border-radius: 12px; box-shadow: 0 0 0 1px rgba(145, 158, 171, .2); }
.chart-list .wp-table thead th { position: sticky; top: 0; z-index: 1; background: var(--admin-card); box-shadow: inset 0 -1px 0 rgba(145, 158, 171, .2); }
.chart-list .wp-table tr.selected td { background: var(--admin-accent-soft); }
.chart-list td.addr { max-width: 320px; color: var(--admin-muted); font-size: 13px; }
.loc-dot { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 8px; background: var(--pk-success-lighter); color: var(--pk-success-dark); font-size: 13px; }
.count-pill { padding: 2px 8px; border-radius: 6px; background: var(--admin-success-bg); color: var(--admin-success-text); font-size: 12px; font-weight: 700; white-space: nowrap; }
.count-pill.none { background: rgba(145, 158, 171, .12); color: var(--admin-muted); }
/* Sade lokasyon listesi (mockup): avatar, ad, alt yazı, işyeri, işlemler; iç kaydırma yok, sayfa uzar */
/* Lokasyon listesi: tek beyaz kart (tepede boşluk yok); her lokasyon: üstte avatar + ad + adres, çizgi, altta rozetler + işlem çubuğu */
.loc-cards-card { padding: 0; overflow: hidden; border: 0; border-radius: 20px; box-shadow: 0 0 2px rgba(145, 158, 171, .2), 0 20px 40px -12px rgba(145, 158, 171, .28); }
.loc-rows { display: grid; margin: 0; padding: 0; list-style: none; }
.loc-row { display: grid; gap: 10px; padding: 14px 22px 10px; cursor: pointer; transition: background .15s ease; }
.loc-row + .loc-row { border-top: 1px solid rgba(145, 158, 171, .2); }
.loc-row:hover, .loc-row:focus-visible { outline: 0; background: rgba(145, 158, 171, .05); }
.loc-row.selected { background: var(--admin-accent-soft); }
.loc-rows > .location-empty { padding: 24px; text-align: center; }
.loc-pager { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 22px; border-top: 1px solid rgba(145, 158, 171, .2); }
.loc-pager-info { color: var(--admin-muted); font-size: 13px; }
.loc-pager-pages { display: flex; align-items: center; gap: 4px; }
.loc-pager-pages button { min-width: 32px; height: 32px; display: grid; place-items: center; padding: 0 8px; border: 0; border-radius: 8px; background: transparent; color: var(--admin-heading); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.loc-pager-pages button:hover:not(:disabled) { background: rgba(145, 158, 171, .12); }
.loc-pager-pages button.on { background: var(--pk-accent); color: var(--pk-on-accent); }
.loc-pager-pages button:disabled { opacity: .35; cursor: default; }
.loc-pager-gap { padding: 0 4px; color: var(--admin-muted); }
.loc-row-main { display: flex; align-items: center; gap: 14px; min-width: 0; }
.loc-avatar { flex: none; width: 50px; height: 50px; display: grid; place-items: center; border-radius: 50%; font-size: 15px; font-weight: 700; letter-spacing: .02em; }
.loc-avatar.big { width: 72px; height: 72px; font-size: 22px; }
.loc-row-text { flex: 1; min-width: 0; display: grid; gap: 2px; }
.loc-row-text strong { overflow: hidden; color: var(--admin-heading); font-size: 15px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.loc-row-text small { overflow: hidden; color: #919eab; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.loc-actions { flex: none; display: flex; gap: 2px; }
.loc-actions button { width: 32px; height: 32px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 8px; background: transparent; color: #637381; cursor: pointer; }
.loc-actions button:hover:not(:disabled), .loc-actions button:focus-visible { background: rgba(145, 158, 171, .12); color: var(--admin-heading); }
.loc-actions button.danger:hover { background: var(--admin-danger-bg); color: var(--admin-danger-text); }
.loc-actions button:disabled { opacity: .35; cursor: default; }
/* Sağdaki lokasyon kartı: ortalı avatar, ad, adres, ekipman / tesisat */
/* Şema penceresi: modal gibi karartma + ortada geniş kutu (modal-backdrop 100'ün altında, silme pencereleri üstte açılır) */
/* Liste açıkken (KSY-SIS): solda dar liste, sağda geniş lokasyon kartı; avatar solda, bilgiler yanında */
@media (min-width: 1181px) { .overview.list-open { grid-template-columns: 400px minmax(0, 1fr); } }
/* Liste görünümü (19 Kas 2026): tam genişlik başlık, arama listenin içinde, sağda tek lokasyon kartı */
.list-banner { margin-bottom: 24px; }
.list-tools { display: flex; gap: 10px; padding: 16px; border-bottom: 1px solid rgba(145, 158, 171, .2); }
.list-tools .list-search { flex: 1; min-width: 0; }
.loc-row-main > .count-pill { flex: none; }
.count-pill.warn { background: var(--pk-warning-lighter); color: var(--pk-warning-dark); }
.loc-panel { display: grid; gap: 20px; padding: 0 24px 24px; border: 0; border-radius: var(--pk-radius); box-shadow: var(--pk-card-shadow); }
.loc-panel-head { margin: 0 -24px; padding: 22px 24px; border-bottom: 1px solid rgba(145, 158, 171, .2); }
.loc-panel-id h2 { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.loc-panel-id h2 .count-pill { font-size: 12px; }
.loc-panel-id small strong { font-weight: 700; }
.loc-panel-id .dot { margin: 0 4px; color: var(--admin-muted); }
.loc-panel-id .loc-panel-addr { display: flex; align-items: center; gap: 6px; }
.loc-panel-actions { flex: none; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.loc-panel-actions .primary-button { min-height: 38px; padding: 0 14px; font-size: 13px; }
.action-group { display: inline-flex; border: 1px solid var(--admin-border); border-radius: 9px; background: var(--admin-input); overflow: hidden; }
.action-group button { min-height: 36px; display: inline-flex; align-items: center; gap: 6px; padding: 0 12px; border: 0; background: transparent; color: var(--admin-heading); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.action-group button + button { border-left: 1px solid var(--admin-border); }
.action-group button:hover:not(:disabled) { background: rgba(145, 158, 171, .1); }
.action-group button:disabled { opacity: .45; cursor: default; }
.more-button { width: 38px; height: 38px; display: grid; place-items: center; padding: 0; border: 1px solid var(--admin-border); border-radius: 9px; background: var(--admin-input); color: var(--admin-heading); cursor: pointer; }
.more-button:hover { background: rgba(145, 158, 171, .1); }
/* Ekipman / Tesisat: tek satır "simge  0 Ekipman", okunur boy (kullanıcı 25 Kas 2026) */
.location-links .count-row { padding: 12px 16px; border: 1px solid rgba(145, 158, 171, .2); background: transparent; }
.location-links .count-icon { width: 36px; height: 36px; border-radius: 10px; }
.location-links .count-text { display: flex; align-items: baseline; gap: 6px; }
.location-links .count-text strong { font-size: 18px; }
.location-links .count-text small { color: var(--admin-heading); font-size: 15px; font-weight: 600; }
.wp-empty { display: grid; justify-items: center; gap: 8px; padding: 36px 20px; border: 1px dashed rgba(145, 158, 171, .45); border-radius: 12px; text-align: center; }
.wp-empty-icon { width: 44px; height: 44px; display: grid; place-items: center; border: 1px solid rgba(145, 158, 171, .3); border-radius: 50%; color: var(--admin-muted); }
.wp-empty strong { color: var(--admin-heading); font-size: 15px; }
.wp-empty p { max-width: 420px; margin: 0; color: var(--admin-muted); font-size: 13px; line-height: 1.5; }
.soft-button { min-height: 34px; display: inline-flex; align-items: center; gap: 6px; margin-top: 6px; padding: 0 14px; border: 0; border-radius: 8px; background: var(--admin-accent-soft); color: var(--pk-accent); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.loc-panel-wp .wp-table td strong { display: block; }
.list-banner { flex-wrap: wrap; padding: 16px 20px; }
.list-banner .list-crumb { flex: none; flex-wrap: wrap; font-size: 13px; }
.list-crumb .crumb-parent { font-weight: 500; white-space: nowrap; }
.list-banner .list-crumb h2 { margin: 0; font-size: 15px; white-space: nowrap; }
.banner-pills { flex: 1; display: flex; flex-wrap: wrap; gap: 6px; padding-left: 12px; border-left: 1px solid rgba(145, 158, 171, .3); }
.loc-row.selected { box-shadow: inset 3px 0 0 var(--pk-accent); }
.loc-panel-head { display: flex; align-items: flex-start; gap: 16px; }
.loc-panel-id { flex: 1; min-width: 0; display: grid; gap: 4px; }
.loc-panel-id h2 { margin: 0; color: var(--admin-heading); font-size: 18px; font-weight: 700; overflow-wrap: anywhere; }
.loc-panel-id small { color: var(--admin-heading); font-size: 13px; font-weight: 600; }
.loc-panel-id .loc-panel-addr { color: var(--admin-muted); font-weight: 400; line-height: 1.45; }
.loc-panel-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.count-row .count-go { margin-left: auto; color: var(--admin-muted); }
.count-row:disabled .count-go { display: none; }
.loc-panel-wp { display: grid; gap: 10px; }
.loc-wp-card { padding: 24px; border: 0; border-radius: var(--pk-radius); box-shadow: var(--pk-card-shadow); }
.loc-panel-wp h3 { display: flex; align-items: baseline; gap: 8px; margin: 0; color: var(--admin-heading); font-size: 15px; font-weight: 700; }
.loc-panel-wp .wp-table { min-width: 560px; }
.tab-tools { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
.tab-tools small { flex: 1; min-width: 220px; color: var(--admin-muted); font-size: 13px; line-height: 1.45; }
/* Lokasyon sekmeleri: KSY-SIS LokasyonKarti .lok-serit */
/* Şerit beyaz kart (kullanıcı 25 Kas 2026; eskiden lacivert) */
.lok-serit { display: flex; gap: 4px; padding: 8px; background: var(--admin-card); border-radius: var(--pk-radius); box-shadow: var(--pk-card-shadow); overflow-x: auto; }
.lok-serit button { display: inline-flex; align-items: center; gap: 7px; padding: 9px 14px; border: 0; border-radius: 10px; background: transparent; color: var(--admin-muted); font: inherit; font-size: 13px; font-weight: 700; white-space: nowrap; cursor: pointer; }
.lok-serit button:hover { color: var(--admin-heading); background: rgba(145, 158, 171, .08); }
.lok-serit button.on { color: var(--pk-accent); background: var(--admin-accent-soft); }
.lok-serit .sayac { min-width: 20px; padding: 1px 7px; border-radius: 999px; background: rgba(145, 158, 171, .16); color: inherit; font-style: normal; font-size: 12px; text-align: center; }
.lok-serit button.on .sayac { background: rgba(var(--pk-accent-rgb), .14); color: var(--pk-accent); }
/* Liste açıkken soldaki liste ile sağdaki kartların alt kenarı aynı hizada (kullanıcı 25 Kas 2026) */
@media (min-width: 1181px) {
  .overview.list-open { align-items: stretch; }
  .overview.list-open .side { position: static; max-height: none; overflow: visible; display: flex; flex-direction: column; }
  .overview.list-open .side > :last-child { flex: 1; }
  .overview.list-open .loc-cards-card { height: 100%; display: flex; flex-direction: column; }
  .overview.list-open .loc-rows { flex: 1; align-content: start; }
}
@media (max-width: 900px) { .loc-panel-head { flex-wrap: wrap; } .loc-panel-actions { justify-content: flex-start; } }
/* (eski) sağ panel listesi stilleri */
.list-search { min-height: 38px; padding: 0 12px; border: 1px solid rgba(145, 158, 171, .32); border-radius: 8px; background: var(--admin-input); color: var(--admin-heading); font: inherit; font-size: 13px; }
.loc-list { max-height: 460px; overflow-y: auto; display: grid; margin: 0; padding: 0; list-style: none; }
.loc-list li + li { border-top: 1px dashed rgba(145, 158, 171, .24); }
.loc-list button { width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px 4px; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.loc-list button:hover { background: rgba(145, 158, 171, .06); }
.loc-list button > span { flex: 1; min-width: 0; display: grid; }
.loc-list strong { color: var(--admin-heading); font-size: 13.5px; font-weight: 600; }
.loc-list small { color: var(--admin-muted); font-size: 12px; }
.loc-list em { flex: none; padding: 2px 8px; border-radius: 6px; background: var(--admin-success-bg); color: var(--admin-success-text); font-size: 11.5px; font-style: normal; font-weight: 700; }
.loc-list em.none { background: rgba(145, 158, 171, .12); color: var(--admin-muted); }
.loc-list .pi-angle-right { color: var(--admin-muted); font-size: 12px; }
.wide-outline { width: 100%; min-height: 38px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 1px dashed rgba(145, 158, 171, .55); border-radius: 8px; background: transparent; color: var(--admin-heading); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.back-to-list { justify-self: start; display: inline-flex; align-items: center; gap: 4px; padding: 0; font-size: 12.5px; }
.move-field { display: grid; gap: 6px; color: var(--admin-muted); font-size: 12.5px; font-weight: 600; }
.move-field select { min-height: 38px; padding: 0 10px; border: 1px solid rgba(145, 158, 171, .32); border-radius: 8px; background: var(--admin-input); color: var(--admin-heading); font: inherit; font-size: 13.5px; }
/* Alt tesisler (lokasyon kartı) */
.subs { display: grid; gap: 8px; padding-top: 12px; border-top: 1px dashed rgba(145, 158, 171, .24); }
.subs > strong { color: var(--admin-heading); font-size: 13px; }
.sub-chips { display: flex; flex-wrap: wrap; gap: 6px; font-size: 13px; }
.sub-chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px; border-radius: 6px; background: var(--pk-violet-lighter); color: var(--pk-violet-dark); font-weight: 600; }
.sub-chip button { border: 0; background: none; color: inherit; cursor: pointer; padding: 0; font-size: 10px; }
.sub-add { display: flex; gap: 8px; }
.sub-add input { flex: 1; min-width: 0; min-height: 38px; padding: 0 12px; border: 1px solid rgba(145, 158, 171, .32); border-radius: 8px; background: var(--admin-input); color: var(--admin-heading); font: inherit; font-size: 14px; }
/* Firmalar sekmesi */
.sub-add .secondary-button { flex: none; }
.firm-row { display: flex; align-items: center; gap: 12px; padding: 10px 4px; border-top: 1px dashed rgba(145, 158, 171, .24); }
.firm-avatar { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 10px; background: var(--pk-primary-lighter); color: var(--pk-primary-dark); }
.firm-text { flex: 1; display: grid; min-width: 0; }
.firm-text strong { color: var(--admin-heading); font-size: 14px; }
.firm-text small { color: var(--admin-muted); font-size: 12px; }
/* İşyerleri tablosu (KSY-SIS düzeni) */
.wp-table-wrap { overflow-x: auto; }
.wp-table { width: 100%; min-width: 760px; border-collapse: collapse; }
.wp-table th { padding: 12px 16px; background: rgba(145, 158, 171, .08); color: var(--admin-muted); font-size: 13px; font-weight: 600; text-align: left; }
.wp-table td { padding: 12px 16px; border-top: 1px solid rgba(145, 158, 171, .2); color: var(--admin-heading); font-size: 14px; vertical-align: middle; }
.wp-table td small { display: block; margin-top: 2px; color: var(--admin-muted); font-size: 12px; }
.wp-table td.muted { color: var(--admin-muted); }
.wp-table td.end { text-align: right; }
.wp-table tbody tr[tabindex] { cursor: pointer; }
.wp-table tbody tr[tabindex]:hover, .wp-table tbody tr[tabindex]:focus-visible { outline: 0; background: rgba(145, 158, 171, .06); }
.wp-firm { display: flex; align-items: center; gap: 12px; }
.wp-firm > span:last-child { display: grid; min-width: 0; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
/* Lokasyon formunda kayıtlı lokasyonlar */
.candidates { display: grid; gap: 8px; margin-top: 12px; padding: 12px 14px; border-radius: 12px; background: var(--pk-info-lighter); color: var(--pk-info-darker); }
.candidates p { margin: 0; font-size: 13px; font-weight: 600; }
.candidate { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 10px; border-radius: 8px; background: var(--admin-card); }
.candidate span { display: grid; min-width: 0; }
.candidate strong { color: var(--admin-heading); font-size: 14px; }
.candidate small { color: var(--admin-muted); font-size: 12px; }
:global(.dark-theme) .candidates { background: rgba(24, 144, 255, .12); color: var(--admin-text); }
/* Sekmeler: Lokasyonlar / İşyerleri ve Lokasyon ekle */
.tabs-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin: 0 -24px 16px; padding: 6px 24px 0; border-bottom: 1px solid rgba(145, 158, 171, .2); }
.tabs { display: flex; gap: 6px; }
.tabs button { display: inline-flex; align-items: center; gap: 9px; margin-bottom: -1px; padding: 14px; border: 0; border-bottom: 3px solid transparent; background: none; color: var(--admin-heading); font: inherit; font-size: 16px; font-weight: 600; cursor: pointer; }
.tabs button i { color: var(--admin-muted); }
.tabs button.active { color: var(--pk-accent); border-bottom-color: var(--pk-accent); font-weight: 700; }
.tabs button.active i { color: var(--admin-accent-text); }
.tabs-row .primary-button { margin: 6px 0; }
@media (max-width: 1180px) { .overview { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 760px) { .overview { grid-template-columns: 1fr; } .page-head h1 { font-size: 22px; } }
.tree-head { display: flex; justify-content: flex-end; margin-bottom: 12px; }
.view-toggle { display: inline-flex; gap: 3px; padding: 3px; border-radius: 9px; background: var(--admin-soft); }
.view-toggle button { min-height: 30px; padding: 0 10px; border: 0; border-radius: 7px; background: none; color: var(--admin-muted); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
.view-toggle button.on { background: var(--admin-input); color: var(--admin-heading); box-shadow: 0 1px 2px var(--admin-shadow); }

/* Ağaç: girinti ve kılavuz çizgileri derinlikten */
.tree { --step: 26px; margin: 0; padding: 0; list-style: none; }
.tree-row { margin-bottom: 2px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 12px; min-height: 52px; padding: 5px 8px 5px calc(var(--depth) * var(--step) + 6px); border-radius: 9px; background-image: repeating-linear-gradient(90deg, var(--admin-border) 0 1px, transparent 1px var(--step)); background-position: 15px 0; background-size: calc(var(--depth) * var(--step)) 100%; background-repeat: no-repeat; }
.tree-row:hover { background-color: var(--admin-soft); }
.row-main { flex: 1 1 280px; min-width: 0; min-height: 40px; display: flex; align-items: center; gap: 9px; padding: 0; border: 0; background: none; color: var(--admin-heading); font: inherit; text-align: left; cursor: pointer; }
.row-main.static { cursor: default; flex-wrap: wrap; }
.row-main.fresh { padding: 4px 8px; border-radius: 8px; background: #ecfdf3; }
.chevron { flex: none; width: 14px; color: var(--admin-muted); font-size: 11px; text-align: center; }
.row-text { flex: 1 1 160px; min-width: 0; display: grid; gap: 1px; overflow-wrap: anywhere; }
.row-text strong { font-size: 14px; }
.row-text small { color: var(--admin-muted); font-size: 12px; font-weight: 500; }
.r-node .row-text strong { font-size: 14.5px; font-weight: 700; }
.r-location .row-text strong, .r-workplace .row-text strong { font-weight: 600; }
.k-root { color: #5925dc; }
.k-org { color: #175cd3; }
.k-location { color: #b54708; }
.k-workplace { color: #667085; }
.no-firm { color: #b54708; }
.row-actions { flex: 0 1 auto; max-width: 100%; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.row-button { min-height: 36px; display: inline-flex; align-items: center; gap: 7px; padding: 0 11px; border: 1px solid var(--admin-border); border-radius: 8px; background: var(--admin-input); color: var(--admin-heading); font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.row-button:hover:not(:disabled) { border-color: var(--pk-accent); }
.row-button:disabled { opacity: .45; cursor: not-allowed; }
.row-button.icon { position: relative; width: 36px; justify-content: center; padding: 0; color: var(--admin-muted); }
.row-button.icon.add { color: var(--admin-heading); }
.row-button .mini { position: absolute; right: 3px; bottom: 3px; padding: 1px; border-radius: 50%; background: var(--pk-yellow); color: var(--pk-on-accent); font-size: 7px; }
.row-button.remove { color: #b42318; }
.row-button.remove:hover:not(:disabled) { border-color: #d92d20; }
.company-chip { display: inline-block; padding: 3px 9px; border-radius: 999px; background: #eef4ff; color: #3538cd; font-size: 12px; font-weight: 600; }
.hazard-badge { display: inline-block; padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
.hazard-badge.low { background: var(--admin-success-bg); color: var(--admin-success-text); }
.hazard-badge.high { background: var(--admin-warning-bg); color: var(--admin-warning-text); }
.hazard-badge.very-high { background: var(--admin-danger-bg); color: var(--admin-danger-text); }
.name-line { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; }
.type-badge { padding: 1px 7px; border-radius: 999px; background: var(--admin-soft); color: var(--admin-muted); font-size: 10.5px; font-weight: 700; }
.field-note { color: var(--admin-muted); font-size: 12px; }
.add-row .field input:disabled { opacity: .6; cursor: not-allowed; }

/* Satırın altında açılan form */
/* Yüksekliksiz satır: kart ağacı itmez, sonraki satırların üstünde durur. */
.tree-form { position: relative; z-index: 20; height: 0; }
.float-card { position: absolute; top: 2px; right: 8px; width: min(900px, calc(100% - 16px)); max-height: calc(100vh - 110px); overflow: auto; box-shadow: 0 16px 40px var(--admin-shadow); }
.head-end { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.add-row { display: grid; gap: 12px; padding: 14px; border: 2px solid var(--pk-yellow); border-radius: 12px; background: var(--admin-input); }
.add-row h3 { margin: 0; color: var(--admin-heading); font-size: 14.5px; }
.add-row-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.add-row .link-button { color: #b54708; font-size: 13px; font-weight: 600; }
.add-row .form-error { margin: 0; }
.add-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
.inline-form { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; }
.inline-form .grow { flex: 1 1 240px; }
.add-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.add-actions small { color: var(--admin-muted); font-size: 12px; }
.row-notice { display: flex; align-items: center; gap: 8px; margin: 0; padding: 10px 12px; border-radius: 9px; background: #ecfdf3; color: #027a48; font-size: 13px; font-weight: 600; }
.nace-line { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.nace-picked { display: inline-flex; align-items: center; gap: 6px; color: #027a48; font-size: 12.5px; font-weight: 600; }
.nace-box input { width: 100%; min-height: 42px; padding: 0 12px; border: 1px solid var(--admin-border); border-radius: 9px; outline: 0; background: var(--admin-input); color: var(--admin-heading); font: inherit; font-size: 14px; }
.nace-results { max-height: 190px; overflow: auto; margin: 6px 0 0; padding: 4px; list-style: none; border: 1px solid var(--admin-border); border-radius: 9px; background: var(--admin-input); }
.nace-results button { width: 100%; min-height: 40px; padding: 7px 9px; border: 0; border-radius: 7px; background: none; color: var(--admin-heading); font: inherit; font-size: 13px; text-align: left; cursor: pointer; }
.nace-results button:hover { background: var(--admin-accent-soft); }
.nace-results em { margin-left: 4px; color: var(--admin-muted); font-size: 12px; font-style: normal; font-weight: 600; }

/* Firmaya göre */
.company-group { display: grid; gap: 2px; margin-bottom: 10px; }
.company-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 6px 8px; color: var(--admin-heading); font-size: 13.5px; }
.company-head small { color: var(--admin-muted); font-size: 12px; }
.company-item { display: grid; gap: 1px; width: 100%; min-height: 40px; padding: 7px 10px 7px 20px; border: 0; border-radius: 8px; background: none; color: var(--admin-heading); font: inherit; font-size: 13px; font-weight: 600; text-align: left; cursor: pointer; }
.company-item small { color: var(--admin-muted); font-size: 11.5px; font-weight: 500; }
.company-item:hover { background: var(--admin-soft); }
.empty { margin: 0; padding: 14px; border: 1px dashed var(--admin-border); border-radius: 9px; color: var(--admin-muted); font-size: 13.5px; text-align: center; }

.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.state { padding: 34px 16px; color: var(--admin-muted); text-align: center; font-size: 14px; }
.state.error { display: grid; justify-items: center; gap: 12px; color: #b42318; }
.link-button { border: 0; background: none; color: inherit; font: inherit; font-weight: 700; text-decoration: underline; cursor: pointer; }
.other { margin-top: 16px; color: var(--admin-muted); font-size: 13.5px; }
.other summary { padding: 8px 2px; cursor: pointer; font-weight: 600; }
.other-body { display: grid; justify-items: start; gap: 6px; padding: 6px 2px; }
.other-link { display: inline-flex; align-items: center; gap: 8px; min-height: 36px; border: 0; background: none; color: var(--admin-heading); font: inherit; font-size: 13.5px; cursor: pointer; }
.other-link:hover { text-decoration: underline; }
.modal-backdrop { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 16px; background: var(--admin-overlay); }
.modal-card.panel-card .float-card { gap: 16px; }
.modal-card { width: min(540px, 100%); max-height: calc(100vh - 32px); overflow: auto; padding: 22px; border-radius: 14px; background: var(--admin-input); box-shadow: 0 20px 60px var(--admin-shadow); }
.modal-head { display: flex; align-items: center; gap: 13px; margin-bottom: 18px; }
.modal-head > div { flex: 1; min-width: 0; }
.modal-head h2 { margin: 0; color: var(--admin-heading); font-size: 19px; }
.modal-head p { margin: 3px 0 0; color: var(--admin-muted); font-size: 13px; overflow-wrap: anywhere; }
.head-icon { flex: none; width: 44px; height: 44px; display: grid; place-items: center; border-radius: 11px; background: var(--pk-yellow); color: var(--pk-on-accent); font-size: 19px; }
.head-icon.danger { background: #fee4e2; color: #b42318; }
.close-button { flex: none; width: 36px; height: 36px; border: 0; border-radius: 8px; background: transparent; color: var(--admin-muted); cursor: pointer; }
.close-button:hover { background: var(--admin-hover); color: var(--admin-heading); }
.field { display: block; color: var(--admin-heading); font-size: 13px; font-weight: 600; }
.field small { color: var(--admin-muted); font-weight: 400; }
.field input { width: 100%; min-height: 44px; margin-top: 6px; padding: 0 12px; border: 1px solid var(--admin-border); border-radius: 9px; outline: 0; background: var(--admin-input); color: var(--admin-heading); font: inherit; font-size: 14px; font-weight: 400; }
.field select, .field textarea { width: 100%; margin-top: 6px; border: 1px solid var(--admin-border); border-radius: 9px; outline: 0; background: var(--admin-input); color: var(--admin-heading); font: inherit; font-size: 14px; font-weight: 400; }
.field select { min-height: 44px; padding: 0 10px; }
.field textarea { padding: 10px 12px; resize: vertical; }
.field input:focus, .field select:focus, .field textarea:focus { border-color: var(--pk-accent); }
.req { color: #d92d20; }
.form-error { margin: 14px 0 0; padding: 10px 12px; border-radius: 9px; background: #fef3f2; color: #b42318; font-size: 13px; }
.muted { color: var(--admin-muted); font-size: 13px; }
.delete-warn { display: flex; gap: 8px; margin: 0 0 12px; padding: 10px 12px; border-radius: 9px; background: #fef3f2; color: #b42318; font-size: 13px; line-height: 1.45; }
.delete-list { margin: 0 0 12px; padding-left: 18px; color: var(--admin-heading); font-size: 13.5px; }
.modal-actions { display: flex; justify-content: space-between; gap: 10px; margin-top: 18px; }
.primary-button, .secondary-button, .danger-button { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 16px; border-radius: 9px; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
.primary-button { border: 1px solid var(--pk-yellow); background: var(--pk-yellow); color: var(--pk-on-accent); }
.primary-button:hover:not(:disabled) { background: var(--pk-yellow-dark); }
.secondary-button { border: 1px solid var(--admin-border); background: var(--admin-input); color: var(--admin-heading); }
.danger-button { border: 1px solid #d92d20; background: #d92d20; color: #fff; }
.primary-button:disabled, .danger-button:disabled { opacity: .5; cursor: default; }
@media (max-width: 700px) { .tree { --step: 14px; } .row-actions { padding-left: 23px; box-sizing: border-box; } .row-main { flex-basis: 100%; } }
</style>
