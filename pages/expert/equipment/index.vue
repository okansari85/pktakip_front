<template>
  <div class="equipment-page">
    <!-- Üst sıra (tasarım kataloğu 05): başlık ve kontrolü en yakın ekipman, izometrik çizim, sayı kartları ve kontrol kapsamı -->
    <div class="top">
      <div class="top-left">
        <!-- Ana Sayfa yalnız bireysel uzmanda var; diğer hesaplarda sayfa yolu Genel Bakış'ta başlar -->
        <nav class="crumb" aria-label="Sayfa yolu">
          <i class="pi pi-home" aria-hidden="true" />
          <NuxtLink :to="individual ? '/expert/anasayfa' : '/expert'">{{ individual ? 'Ana Sayfa' : 'Genel Bakış' }}</NuxtLink>
          <i class="pi pi-angle-right" aria-hidden="true" />
          <strong>Ekipmanlar</strong>
        </nav>
        <h1>Ekipmanlar</h1>
        <p class="lead">{{ context ? contextLabel : 'Üstten lokasyon ve firma seçin.' }}</p>
        <!-- Kontrolü en yakın aktif ekipman (yaklaşan yoksa süresi en çok geçen); fotoğrafı yoksa çizim -->
        <section v-if="context && featured" class="card featured">
          <div class="featured-head">
            <h2>{{ featuredTitle }}</h2>
            <span class="due-pill" :class="daysKey(featured.days_left)"><i class="pi pi-clock" /> {{ dueText(featured.days_left) }}</span>
          </div>
          <strong v-if="featuredModel" class="featured-model">{{ featuredModel }}</strong>
          <div class="featured-row"><i class="pi pi-calendar" /><span>Sonraki kontrol</span><strong>{{ formatDate(featured.next_control_date) }}</strong></div>
          <img class="featured-img" :src="featured.photo_url || '/katalog/forklift-katalog.webp'" alt="" />
          <NuxtLink class="primary-button featured-link" :to="`/expert/equipment/${featured.id}`"><i class="pi pi-file" /> Profili aç <i class="pi pi-arrow-right" /></NuxtLink>
        </section>
      </div>
      <figure class="hero">
        <!-- Katalogdaki görsel (tasarım kataloğu 05'ten kırpıldı, marka yazıları silindi) -->
        <img src="/katalog/forklift-katalog.webp" alt="" />
      </figure>
      <div v-if="context" class="top-right">
        <!-- Sayılar lokasyondaki aktif ekipmanlardan; tıklayınca liste süzülür (Açık bulgu: Bulgu takibi) -->
        <div class="kpis">
          <button v-for="kpi in kpis" :key="kpi.key" type="button" class="kpi" :class="[kpi.tone, { active: kpi.key === 'total' ? false : statusFilter === kpi.key }]" @click="onKpi(kpi.key)">
            <span class="kpi-icon"><i :class="kpi.icon" /></span>
            <span class="kpi-text"><strong>{{ kpi.value }}</strong><small>{{ kpi.label }}</small></span>
            <i class="pi pi-angle-right kpi-arrow" aria-hidden="true" />
          </button>
        </div>
        <section class="card coverage">
          <header><i class="pi pi-clone" /><h3>Kontrol kapsamı</h3></header>
          <div class="coverage-row">
            <span>Süresi geçen</span>
            <ProgressBar :value="share(counts.overdue)" :show-value="false" class="bar overdue" />
            <strong>{{ counts.overdue }}</strong>
          </div>
          <div class="coverage-row">
            <span>Kontrolü yaklaşan</span>
            <ProgressBar :value="share(counts.soon)" :show-value="false" class="bar soon" />
            <strong>{{ counts.soon }}</strong>
          </div>
        </section>
      </div>
    </div>

    <div v-if="!context" class="card empty-state">
      <i class="pi pi-map-marker" />
      <strong>Lokasyon seçilmedi</strong>
      <span>Ekipmanları görmek için üstteki Lokasyon kutusundan seçim yapın.</span>
    </div>

    <!-- Sekmeler, süzgeçler, düğmeler ve tablo tek kartta -->
    <section v-else class="card list-card">
      <div v-if="visibleCategories.length" class="tabs">
        <button v-for="category in visibleCategories" :key="category.slug" type="button" :class="{ active: categoryFilter === category.slug }" @click="selectCategory(category.slug)">
          <i :class="['pi', category.icon || 'pi-box']" aria-hidden="true" /> {{ category.name }} <span class="count">{{ countByCategory[category.slug] || 0 }}</span>
        </button>
      </div>

      <div class="toolbar">
        <template v-if="equipment.length">
          <span class="pill-select">
            <select v-model="typeFilter" aria-label="Ekipman türü">
              <option :value="null">Ekipman türü</option>
              <option v-for="type in visibleTypes" :key="type.id" :value="type.id">{{ type.name }} ({{ type.count }})</option>
            </select>
            <i class="pi pi-chevron-down" aria-hidden="true" />
          </span>
          <template v-if="!showForms">
            <span class="pill-select">
              <select v-model="statusFilter" aria-label="Durum">
                <option value="">Durum</option>
                <option v-for="(label, key) in STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
                <option value="overdue">Süresi geçmiş</option>
                <option value="soon">Kontrolü yaklaşan</option>
              </select>
              <i class="pi pi-chevron-down" aria-hidden="true" />
            </span>
            <!-- Pasife alınan ekipmanlar varsayılan olarak gizli -->
            <span class="pill-select">
              <select v-model="activeFilter" aria-label="Aktiflik">
                <option value="active">Aktif olanlar</option>
                <option value="passive">Pasif olanlar</option>
                <option value="all">Tümü</option>
              </select>
              <i class="pi pi-chevron-down" aria-hidden="true" />
            </span>
            <div class="search-box"><i class="pi pi-search" /><input v-model="search" type="text" placeholder="Kod, marka veya seri no ara" aria-label="Ara" /></div>
          </template>
        </template>
        <span class="toolbar-spacer" />
        <!-- Toplu rapor yükleme (tek ekipmanlı raporlar, yangın ekipmanları hariç): raporlar sırayla okunur, satır satır eşleştirilip kaydedilir -->
        <button v-tooltip.bottom="'Birden fazla tek ekipmanlı raporu birlikte yükleyin; sırayla okunur, ekipmanlarla eşleştirilip kaydedilir (yangın ekipmanları hariç).'" class="outline-button" type="button" :disabled="bulkAnalysisOpen" @click="bulkAnalysisOpen = true"><i class="pi pi-copy" /> Toplu rapor yükle</button>
        <!-- Rapordan ekipman tanımla: eşleşen ekipmana ekler ya da yeni ekipman tanımlar -->
        <button v-tooltip.bottom="'Periyodik kontrol raporunu yükleyin; eşleşen ekipmana eklenir ya da rapordaki ekipman yeni tanımlanır.'" class="outline-button" type="button" @click="fromReportOpen = true"><i class="pi pi-upload" /> Rapor yükle</button>
        <button v-tooltip.bottom="'Ekipmanı rapor olmadan, elle tanımlayın.'" class="primary-button" type="button" @click="openCreate"><i class="pi pi-plus" /> Yeni ekipman</button>
      </div>

      <!-- Yangın söndürme cihazı (tüp) seçiliyken: tüp listesi, toplu kontrol formları ve formlarda eşleştirme bekleyenler -->
      <div v-if="isTubeType" class="sub-tabs">
        <button type="button" :class="{ active: tubeTab === 'list' }" @click="tubeTab = 'list'"><i class="pi pi-list" /> Tüpler <span class="count">{{ filtered.length }}</span></button>
        <button type="button" :class="{ active: showForms }" @click="tubeTab = 'forms'"><i class="pi pi-file-check" /> Kontrol Formları</button>
        <button type="button" :class="{ active: showMatching }" @click="tubeTab = 'matching'"><i class="pi pi-link" /> Eşleştirme bekliyor <span class="count" :class="{ warn: matchingCount }">{{ matchingCount }}</span></button>
      </div>
      <div v-if="showForms || showMatching" class="inner">
        <ExpertBulkReportList v-if="showForms" :context="context" :refresh-key="formsKey" @upload="openBulk(null)" @changed="onTubesChanged" @matching="tubeTab = 'matching'" />
        <ExpertTubeMatching v-else :context="context" :refresh-key="formsKey" @changed="loadEquipment" @count="matchingCount = $event" />
      </div>

      <template v-else>
        <div v-if="loading" class="state">Ekipmanlar yükleniyor...</div>
        <div v-else-if="error" class="state error-text">{{ error }}</div>
        <div v-else-if="filtered.length === 0" class="state empty-state">
          <i class="pi pi-wrench" />
          <strong>{{ equipment.length ? 'Filtreye uyan ekipman yok' : 'Henüz ekipman yok' }}</strong>
          <span v-if="!equipment.length">"Yeni ekipman" ile ilk ekipmanınızı ekleyin.</span>
        </div>
        <div v-else class="table-wrap">
          <!-- Tür seçiliyken o türün bütün bulguları (son raporlardan), satırı ekipmana götürür. Katalogda yok, gizli (SHOW_TYPE_FINDINGS). -->
          <div v-if="SHOW_TYPE_FINDINGS && typeFindings.length" class="type-findings">
            <div class="type-findings-head">
              <strong>{{ selectedTypeName }}: {{ typeFindings.length }} bulgu, {{ typeFindingEquipment }} ekipmanda</strong>
              <button v-if="typeFindings.length > 10" class="link-button" type="button" @click="showAllFindings = !showAllFindings">{{ showAllFindings ? 'Daha az göster' : 'Tümünü göster' }}</button>
            </div>
            <ul>
              <li v-for="(row, index) in (showAllFindings ? typeFindings : typeFindings.slice(0, 10))" :key="index">
                <NuxtLink :to="`/expert/equipment/${row.id}`"><strong>{{ row.label }}</strong></NuxtLink>
                <span>{{ row.text }}</span>
              </li>
            </ul>
          </div>
          <div v-if="selected.length" class="bulk-bar">
            <strong>{{ selected.length }} ekipman seçildi</strong>
            <button class="link-button" type="button" @click="selected = []">Seçimi temizle</button>
            <span class="bulk-spacer" />
            <button v-if="selectedActive.length" class="secondary-button small" type="button" @click="deactivateIds = selectedActive"><i class="pi pi-ban" /> Pasife al ({{ selectedActive.length }})</button>
            <button v-if="selectedPassive.length" class="secondary-button small" type="button" :disabled="activating" @click="activate(selectedPassive)"><i class="pi pi-check-circle" /> Aktife al ({{ selectedPassive.length }})</button>
            <button class="danger-button" type="button" :disabled="bulkDeleting" @click="bulkDelete">
              <i :class="bulkDeleting ? 'pi pi-spin pi-spinner' : 'pi pi-trash'" /> Seçilenleri sil
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th class="check-col"><input type="checkbox" :checked="allSelected" :indeterminate="selected.length > 0 && !allSelected" title="Tümünü seç" @change="toggleAll" /></th>
                <th class="no-col">Ekipman no</th><th v-if="SHOW_TYPE_COLUMN">Tür / Etiket</th><th>Ekipman</th><th>Konum</th><th>Son kontrol</th><th>Gelecek kontrol</th><th v-if="SHOW_DAYS_COLUMN">Kalan gün</th><th>Durum</th><th class="actions-col">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in pagedItems" :key="item.id" :class="{ selected: selected.includes(item.id), passive: !item.is_active }" @click="navigateTo(`/expert/equipment/${item.id}`)">
                <td class="check-col" @click.stop><input v-model="selected" type="checkbox" :value="item.id" :aria-label="`${item.code || item.name || item.type?.name || 'Ekipman'} seç`" /></td>
                <td class="no-col"><strong v-if="item.code">{{ item.code }}</strong><span v-else class="muted">—</span></td>
                <td v-if="SHOW_TYPE_COLUMN">
                  <div class="type-cell">
                    <span>{{ item.type?.name }}</span>
                    <span v-if="item.variant" class="tag" :title="item.type?.variant_label || 'Etiket'">{{ item.variant }}</span>
                  </div>
                </td>
                <td>
                  <div class="name-cell">
                    <strong>{{ item.name || [item.brand, item.model].filter(Boolean).join(' ') || item.type?.name }}</strong>
                    <small v-if="item.brand || item.model || item.serial_no">{{ [item.brand, item.model, item.serial_no && `SN ${item.serial_no}`].filter(Boolean).join(' · ') }}</small>
                  </div>
                </td>
                <td>
                  <!-- Firma (işyeri adı varsa "Ad · Firma"); altında varsa birim, alan ve bulunduğu yer -->
                  <div class="name-cell">
                    <span>{{ item.workplace ? workplaceLabel(item.workplace.id, item.workplace.company_name) : 'Lokasyon geneli' }}</span>
                    <small v-if="unitOfEquipment(item.id) || areaOf(item) || item.place">{{ [unitOfEquipment(item.id)?.name, areaOf(item)?.label, item.place].filter(Boolean).join(' · ') }}</small>
                  </div>
                </td>
                <td>{{ formatDate(item.last_control_date) }}</td>
                <td>{{ formatDate(item.next_control_date) }}</td>
                <td v-if="SHOW_DAYS_COLUMN">
                  <span v-if="!item.is_active" class="passive-tag" :title="passiveTitle(item)">Pasif</span>
                  <span v-else class="days" :class="daysKey(item.days_left)">{{ daysText(item.days_left) }}</span>
                </td>
                <td>
                  <span class="status-badge" :class="item.status">{{ STATUS_LABELS[item.status] }}</span>
                  <!-- Kalan gün sütunu gizliyken pasif bilgisi durumun yanında -->
                  <span v-if="!SHOW_DAYS_COLUMN && !item.is_active" class="passive-tag" :title="passiveTitle(item)">Pasif</span>
                  <!-- Son raporun bulguları: sayı + üstüne gelince / odaklanınca liste. Katalogda yok, gizli (SHOW_FINDINGS_INFO). -->
                  <span v-if="SHOW_FINDINGS_INFO && item.findings_count" class="findings-info" tabindex="0" :aria-label="`${item.findings_count} bulgu: ${item.findings.join('; ')}`"
                    @click.stop @mouseenter="showFindings(item, $event)" @focus="showFindings(item, $event)" @mouseleave="hoverFindings = null" @blur="hoverFindings = null">
                    {{ item.findings_count }} bulgu <i class="pi pi-info-circle" />
                  </span>
                </td>
                <td class="actions-col" @click.stop>
                  <div class="row-actions">
                    <button v-tooltip.top="'Önizle'" class="icon-button" type="button" aria-label="Önizle" @click="previewItem = item"><i class="pi pi-eye" /></button>
                    <!-- Pasif ekipmana kontrol eklenmez. Tesisata bağlı ekipman: kontrolü tesisat raporundan gelir (rapor / rapor bekleniyor tesisatta) -->
                    <template v-if="!item.is_active" />
                    <NuxtLink v-else-if="item.installation" v-tooltip.top="`Kontrolü ${item.installation.name} raporundan gelir`" class="icon-button" to="/expert/installations" :aria-label="`Kontrolü ${item.installation.name} raporundan gelir`"><i class="pi pi-sitemap" /></NuxtLink>
                    <template v-else>
                      <button v-tooltip.top="'Yeni Periyodik Kontrol Raporu Yükle'" class="icon-button" type="button" aria-label="Yeni Periyodik Kontrol Raporu Yükle" @click="reportItem = item"><i class="pi pi-file-arrow-up" /></button>
                      <!-- Diğer işlemler: rapor bekleniyor -->
                      <button v-tooltip.top="'Diğer işlemler'" class="icon-button more" type="button" aria-label="Diğer işlemler" aria-haspopup="true" @click="openRowMenu($event, item)"><i class="pi pi-ellipsis-h" /></button>
                    </template>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="table-footer">
            <span>{{ pageStart + 1 }}–{{ Math.min(pageStart + PAGE_SIZE, filtered.length) }} / toplam {{ filtered.length }} ekipman · sayfada {{ PAGE_SIZE }}</span>
            <div v-if="pageCount > 1" class="pager">
              <button type="button" :disabled="page === 1" @click="page--"><i class="pi pi-angle-left" /> Önceki</button>
              <span>Sayfa {{ page }} / {{ pageCount }}</span>
              <button type="button" :disabled="page === pageCount" @click="page++">Sonraki <i class="pi pi-angle-right" /></button>
            </div>
          </div>
        </div>
      </template>
    </section>
    <Menu ref="rowMenu" :model="rowMenuItems" popup :pt="{ root: { style: MENU_VARS } }" />

    <!-- Bulgu kutusu tablonun dışında (tablo kaydırmalı; içeride kesilirdi), sayının hizasında ekrana sabit -->
    <Teleport to="body">
      <div v-if="hoverFindings" class="findings-pop" role="tooltip" :style="{ top: `${hoverFindings.top}px`, left: `${hoverFindings.left}px` }">
        <strong>Son raporun bulguları</strong>
        <span v-for="(finding, index) in hoverFindings.findings" :key="index">{{ finding }}</span>
      </div>
    </Teleport>
    <ExpertEquipmentPreviewModal v-if="previewItem" :summary="previewItem" @close="previewItem = null" @upload="fromPreview('report', $event)" @pending="fromPreview('pending', $event)" />
    <ExpertEquipmentFromReportModal v-if="fromReportOpen" :context="context" :catalog="equipmentCategories" :workplaces="locationWorkplaces" :equipment="equipment" @close="fromReportOpen = false" @continue="onFromReportContinue" @bulk="onFromReportBulk" />
    <ExpertBulkReportModal v-if="bulkOpen" :context="context" :preload="bulkPreload" @close="closeBulk" @saved="onBulkSaved" />
    <ExpertBulkAnalysisModal v-if="bulkAnalysisOpen" :context="context" :catalog="equipmentCategories" :workplaces="locationWorkplaces" :equipment="equipment" @close="bulkAnalysisOpen = false" @changed="loadEquipment" />
    <ExpertEquipmentReportModal v-if="reportItem" :equipment="reportItem" :preload="reportPreload" :draft="reportDraft" @close="onReportClosed" @saved="onInspectionSaved" />
    <ExpertEquipmentPendingModal v-if="pendingItem" :equipment="pendingItem" @close="pendingItem = null" @saved="onInspectionSaved" />
    <ExpertEquipmentDeactivateModal v-if="deactivateIds.length" :ids="deactivateIds" :title="deactivateTitle" @close="deactivateIds = []" @saved="onDeactivated" />

    <!-- Yeni ekipman -->
    <div v-if="createOpen" class="modal-backdrop">
      <section class="modal-card">
        <div class="modal-head">
          <div><h2>Yeni Ekipman</h2><p>{{ context?.location_name }}</p></div>
          <button class="close-button" type="button" @click="closeCreate"><i class="pi pi-times" /></button>
        </div>
        <div class="form-grid">
          <label>Kategori <span>*</span>
            <select v-model="form.category" @change="onFormCategory">
              <option value="" disabled>Seçin</option>
              <option v-for="category in equipmentCategories" :key="category.slug" :value="category.slug">{{ category.name }}</option>
            </select>
          </label>
          <label>Tür <span>*</span>
            <select v-model="form.equipment_type_id" :disabled="!form.category" @change="onFormType">
              <option :value="null" disabled>Seçin</option>
              <option v-for="type in formTypes" :key="type.id" :value="type.id">{{ type.name }}</option>
            </select>
          </label>
          <label v-if="selectedType?.variants?.length">{{ selectedType.variant_label || 'Etiket' }} <small>(Opsiyonel)</small>
            <select v-model="form.variant">
              <option value="">Seçilmedi</option>
              <option v-for="variant in selectedType.variants" :key="variant" :value="variant">{{ variant }}</option>
            </select>
          </label>
          <label>Kod / No<input v-model="form.code" type="text" placeholder="Örn. FL-01" /></label>
          <label>Ekipman adı <small>(Opsiyonel)</small><input v-model="form.name" type="text" :placeholder="selectedType ? `Örn. ${selectedType.name}` : 'Örn. Elektrikli transpalet'" /></label>
          <label>Marka<input v-model="form.brand" type="text" /></label>
          <label>Model <small>(Opsiyonel)</small><input v-model="form.model" type="text" /></label>
          <label>Seri no<input v-model="form.serial_no" type="text" /></label>
          <label>Ait olduğu yer <span>*</span>
            <select v-model="form.location_business_entity_id" @change="onFormWorkplace">
              <option :value="null">Lokasyon geneli</option>
              <option v-for="workplace in locationWorkplaces" :key="workplace.id" :value="workplace.id">{{ workplaceLabel(workplace.id, workplace.company_name) }}</option>
            </select>
          </label>
          <!-- Seçili işyerinin operasyonel birimi varsa (ör. Müşteri Hizmetleri) -->
          <label v-if="formUnits.length">Birim <small>(Opsiyonel)</small>
            <select v-model="form.pk_operational_unit_id">
              <option :value="null">Birim yok</option>
              <option v-for="unit in formUnits" :key="unit.id" :value="unit.id">{{ unit.name }}</option>
            </select>
          </label>
          <!-- Lokasyonda alan tanımlıysa: ekipmanın bulunduğu fiziksel yer (bina, kat, depo…) -->
          <label v-if="selectableAreas.length">Alan <small>(Opsiyonel)</small>
            <select v-model="form.pk_area_id">
              <option :value="null">Alan yok</option>
              <option v-for="area in selectableAreas" :key="area.id" :value="area.id">{{ areaText(area) }}</option>
            </select>
          </label>
          <label>Bulunduğu yer <small>(Opsiyonel)</small><input v-model="form.place" type="text" placeholder="Örn. B Blok depo" /></label>
        </div>

        <p v-if="selectedType?.default_period_months" class="hint">Yönetmelikteki azami kontrol süresi: {{ selectedType.default_period_months }} ay</p>
        <p class="hint">Periyodik kontrol raporu, ekipman eklendikten sonra listedeki <i class="pi pi-file-arrow-up" /> ikonundan ya da profil sayfasından yüklenir.</p>

        <p v-if="formError" class="error-text">{{ formError }}</p>
        <div class="modal-actions">
          <button class="secondary-button" type="button" @click="closeCreate">İptal</button>
          <button class="primary-button" type="button" :disabled="saving || !form.equipment_type_id" @click="saveEquipment">{{ saving ? 'Kaydediliyor...' : 'Kaydet' }}</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
// keepalive: detaydan geri dönünce liste, filtreler ve kaydırma konumu olduğu gibi; liste arkada tazelenir (onActivated).
definePageMeta({ layout: 'expert', middleware: 'expert', keepalive: true })
// Sayfa yolu: bireysel uzmanda Ana Sayfa, diğer hesaplarda Genel Bakış.
const { account, multiUser } = useAccount()
const individual = computed(() => !!account.value && !multiUser.value)

// Tasarım kataloğu 05'te olmayan öğeler: katalogda yok, gizli; ileride açılabilir (kod yerinde).
const SHOW_TYPE_COLUMN = false // Tür / Etiket sütunu
const SHOW_DAYS_COLUMN = false // Kalan gün sütunu (pasif etiketi bu sırada Durum'da)
const SHOW_FINDINGS_INFO = false // Durum sütunundaki "N bulgu" ve üstüne gelince liste
const SHOW_TYPE_FINDINGS = false // Tür seçiliyken o türün bulguları kutusu

interface CatalogType { id: number; slug?: string; name: string; default_period_months: number | null; default_scope: 'location' | 'workplace'; variants?: string[]; variant_label?: string | null }
interface CatalogCategory { slug: string; name: string; kind: 'equipment' | 'installation'; icon?: string | null; types: CatalogType[] }

const STATUS_LABELS: Record<string, string> = { uygun: 'Uygun', uygun_degil: 'Uygun değil', rapor_bekleniyor: 'Rapor bekleniyor', belirtilmemis: 'Belirtilmemiş', rapor_yok: 'Rapor yok' }

const { get, post, errorMessage } = useExpertApi()
const { context, label: contextLabel } = useWorkplaceContext()
const { groups, load: loadWorkplaces } = useMyWorkplaces()

// Liste durumu (kategori, tür, sekme, filtreler) adres satırında: ekipman detayından geri dönünce (geri tuşu ya da
// "← Ekipmanlar") aynı liste açılır.
const route = useRoute()
const router = useRouter()
const queryText = (key: string) => typeof route.query[key] === 'string' ? route.query[key] as string : ''

const catalog = ref<CatalogCategory[]>([])
const equipment = ref<any[]>([])
const loading = ref(false)
const error = ref('')
const categoryFilter = ref<string | null>(queryText('category') || null)
const typeFilter = ref<number | null>(Number(queryText('type')) || null)
const statusFilter = ref(queryText('status'))
const search = ref(queryText('q'))
// Pasife alınan ekipmanlar varsayılan olarak gizli.
const activeFilter = ref<'active' | 'passive' | 'all'>(queryText('active') === 'passive' || queryText('active') === 'all' ? queryText('active') as 'passive' | 'all' : 'active')

// Ekipmanlar ekranı yalnızca "ekipman" kategorilerini gösterir (tesisatlar ayrı menüde).
const equipmentCategories = computed(() => catalog.value.filter(c => c.kind === 'equipment'))
// Aktif / pasif seçimine uyan ekipmanlar: sekme ve tür sayıları ile tablo bunlardan.
const scoped = computed(() => activeFilter.value === 'all' ? equipment.value : equipment.value.filter(item => item.is_active === (activeFilter.value === 'active')))
const countBy = (items: any[]) => items.reduce((acc: Record<string, number>, item) => {
  const slug = item.category?.slug
  if (slug) acc[slug] = (acc[slug] || 0) + 1
  return acc
}, {})
const countByCategory = computed(() => countBy(scoped.value))
// Sekmelerde ekipmanı olan kategoriler görünür (aktif / pasif seçimi sekmeleri değiştirmez).
const visibleCategories = computed(() => {
  const all = countBy(equipment.value)
  return equipmentCategories.value.filter(c => all[c.slug])
})
const inCategory = computed(() => scoped.value.filter(item => item.category?.slug === categoryFilter.value))
const visibleTypes = computed(() => {
  const map = new Map<number, { id: number; name: string; count: number }>()
  for (const item of inCategory.value) {
    if (!item.type) continue
    const entry = map.get(item.type.id) || { id: item.type.id, name: item.type.name, count: 0 }
    entry.count++
    map.set(item.type.id, entry)
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'tr'))
})
const trLower = (value?: string | null) => (value || '').toLocaleLowerCase('tr-TR')
// Raflar ekipman no'suna göre (01, 02 … 10 … 39; no'suz olanlar sonda); diğer türler eklenme sırasında kalır.
const RACK_SLUG = 'depolama-rafi'
const rackTypeId = computed(() => equipmentCategories.value.flatMap(category => category.types).find(type => type.slug === RACK_SLUG)?.id ?? null)
const sortRacks = (items: any[]) => {
  const racks = items.filter(item => item.type?.id === rackTypeId.value)
    .sort((a, b) => Number(!a.code) - Number(!b.code) || String(a.code || '').localeCompare(String(b.code || ''), 'tr', { numeric: true }) || a.id - b.id)
  let next = 0
  return racks.length ? items.map(item => item.type?.id === rackTypeId.value ? racks[next++] : item) : items
}
const filtered = computed(() => {
  const q = trLower(search.value.trim())
  return sortRacks(inCategory.value.filter(item =>
    (!typeFilter.value || item.type?.id === typeFilter.value) &&
    (!statusFilter.value || (statusFilter.value === 'overdue' ? item.days_left !== null && item.days_left < 0 : statusFilter.value === 'soon' ? isSoon(item) : item.status === statusFilter.value)) &&
    (!q || [item.code, item.name, item.brand, item.model, item.serial_no, item.place, item.type?.name, item.variant].some(v => trLower(v).includes(q)))
  ))
})

// Sayfalama (kullanıcı 28 Ekim 2026): yüzlerce satır birden çizilince sayfa geç açılıyordu; filtre / arama / lokasyon değişince ilk sayfa.
const PAGE_SIZE = 50
const page = ref(1)
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const pageStart = computed(() => (page.value - 1) * PAGE_SIZE)
const pagedItems = computed(() => filtered.value.slice(pageStart.value, pageStart.value + PAGE_SIZE))
watch([search, statusFilter, categoryFilter, typeFilter, activeFilter, context], () => { page.value = 1 })
watch(pageCount, count => { if (page.value > count) page.value = count })

const selectCategory = (slug: string) => { categoryFilter.value = slug; typeFilter.value = null }

// --- Üst sıra: sayı kartları, kontrol kapsamı ve kontrolü en yakın ekipman (lokasyondaki aktif ekipmanlardan) ---
// Kontrolü yaklaşan: kalan gün 0–30 (listedeki "yaklaşan" rengiyle aynı eşik).
const isSoon = (item: any) => item.days_left !== null && item.days_left !== undefined && item.days_left >= 0 && item.days_left <= 30
const activeItems = computed(() => equipment.value.filter(item => item.is_active))
const counts = computed(() => ({
  total: activeItems.value.length,
  overdue: activeItems.value.filter(item => item.days_left !== null && item.days_left < 0).length,
  soon: activeItems.value.filter(isSoon).length,
  // Son raporların bulguları (listedeki "N bulgu" ile aynı sayı)
  findings: activeItems.value.reduce((sum, item) => sum + (item.findings_count || 0), 0)
}))
const kpis = computed(() => [
  { key: 'total', label: 'Toplam ekipman', value: counts.value.total, icon: 'pi pi-box', tone: 'blue' },
  { key: 'overdue', label: 'Süresi geçen', value: counts.value.overdue, icon: 'pi pi-exclamation-triangle', tone: 'bad' },
  { key: 'soon', label: 'Kontrolü yaklaşan', value: counts.value.soon, icon: 'pi pi-calendar', tone: 'warn' },
  { key: 'findings', label: 'Açık bulgu', value: counts.value.findings, icon: 'pi pi-list-check', tone: 'purple' }
])
// Toplam: durum süzgeci kalkar, aktifler görünür; süresi geçen / yaklaşan: liste o duruma süzülür (tekrar tıklayınca kalkar).
const onKpi = (key: string) => {
  if (key === 'findings') { navigateTo('/expert/bulgu-takip'); return }
  if (key === 'total') { statusFilter.value = ''; activeFilter.value = 'active'; return }
  statusFilter.value = statusFilter.value === key ? '' : key
  if (statusFilter.value) activeFilter.value = 'active'
}
const share = (count: number) => counts.value.total ? Math.round(count / counts.value.total * 100) : 0
const featured = computed(() => {
  const dated = activeItems.value.filter(item => item.days_left !== null && item.days_left !== undefined).sort((a, b) => a.days_left - b.days_left)
  return dated.find(item => item.days_left >= 0) || dated[0] || null
})
const featuredTitle = computed(() => [featured.value?.name || featured.value?.type?.name, featured.value?.code].filter(Boolean).join(' '))
const featuredModel = computed(() => [featured.value?.brand, featured.value?.model].filter(Boolean).join(' '))
const dueText = (days: number) => days < 0 ? `${-days} gün geçti` : days === 0 ? 'Bugün' : `${days} gün kaldı`

// Satırdaki "Diğer işlemler" menüsü (rapor bekleniyor). PrimeVue menüsü uygulamanın açık / koyu temasıyla.
const MENU_VARS = '--p-menu-background:var(--admin-surface);--p-menu-border-color:var(--admin-border);--p-menu-color:var(--admin-text);--p-menu-item-color:var(--admin-text);--p-menu-item-icon-color:var(--admin-muted);--p-menu-item-focus-background:var(--admin-hover);--p-menu-item-focus-color:var(--admin-heading);--p-menu-item-icon-focus-color:var(--admin-heading)'
const rowMenu = ref<any>(null)
const rowMenuItems = ref<any[]>([])
const openRowMenu = (event: Event, item: any) => {
  rowMenuItems.value = [{ label: 'Rapor bekleniyor olarak işaretle', icon: 'pi pi-hourglass', command: () => { pendingItem.value = item } }]
  rowMenu.value?.toggle(event)
}

// Durum sütunundaki "3 bulgu": kutu sayının altında, ekranın sağından taşmayacak şekilde.
const hoverFindings = ref<{ findings: string[]; top: number; left: number } | null>(null)
const showFindings = (item: any, event: Event) => {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  hoverFindings.value = { findings: item.findings, top: rect.bottom + 6, left: Math.max(8, Math.min(rect.right - 340, window.innerWidth - 348)) }
}

// Seçili türün bulguları (filtredeki aktif ekipmanların son raporlarından); ilk 10, istenirse tümü.
const showAllFindings = ref(false)
const selectedTypeName = computed(() => filtered.value.find(item => item.type?.id === typeFilter.value)?.type?.name || '')
const typeFindings = computed(() => !typeFilter.value ? [] : filtered.value
  .filter(item => item.is_active && item.findings_count)
  .flatMap(item => (item.findings as string[]).map(text => ({ id: item.id, label: item.code || item.name || item.type?.name, text }))))
const typeFindingEquipment = computed(() => new Set(typeFindings.value.map(row => row.id)).size)
watch(typeFilter, () => { showAllFindings.value = false })

// --- Seçim ve toplu silme ---
const selected = ref<number[]>([])
const allSelected = computed(() => filtered.value.length > 0 && filtered.value.every(item => selected.value.includes(item.id)))
const toggleAll = () => { selected.value = allSelected.value ? [] : filtered.value.map(item => item.id) }
// Filtre / sekme değişince görünmeyen ekipmanlar seçimden düşer (görmeden silinmesin).
watch(filtered, items => {
  const visible = new Set(items.map(item => item.id))
  if (selected.value.some(id => !visible.has(id))) selected.value = selected.value.filter(id => visible.has(id))
})
const bulkDeleting = ref(false)
const bulkDelete = async () => {
  if (!confirm(`${selected.value.length} ekipman, fotoğrafları ve tüm kontrol kayıtlarıyla birlikte silinsin mi?`)) return
  bulkDeleting.value = true
  try {
    await post('/pk-equipment/bulk-delete', { ids: selected.value })
    selected.value = []
    await loadEquipment()
  } catch (e: any) {
    alert(errorMessage(e, 'Ekipmanlar silinemedi.'))
  } finally { bulkDeleting.value = false }
}

// --- Pasife alma / aktife alma (seçilenler) ---
const selectedItems = computed(() => equipment.value.filter(item => selected.value.includes(item.id)))
const selectedActive = computed(() => selectedItems.value.filter(item => item.is_active).map(item => item.id))
const selectedPassive = computed(() => selectedItems.value.filter(item => !item.is_active).map(item => item.id))
const deactivateIds = ref<number[]>([])
const deactivateTitle = computed(() => {
  const only = deactivateIds.value.length === 1 ? equipment.value.find(item => item.id === deactivateIds.value[0]) : null
  return only ? [only.name || only.type?.name, only.code && `no ${only.code}`].filter(Boolean).join(' · ') : `${deactivateIds.value.length} ekipman`
})
const onDeactivated = () => {
  deactivateIds.value = []
  selected.value = []
  loadEquipment()
}
const activating = ref(false)
const activate = async (ids: number[]) => {
  if (!confirm(`${ids.length} ekipman aktife alınsın mı?`)) return
  activating.value = true
  try {
    await post('/pk-equipment/bulk-activate', { ids })
    selected.value = []
    await loadEquipment()
  } catch (e: any) {
    alert(errorMessage(e, 'Aktife alınamadı.'))
  } finally { activating.value = false }
}
const passiveTitle = (item: any) => [
  item.deactivated_at && `${formatDate(item.deactivated_at)} tarihinde pasife alındı`,
  DEACTIVATION_REASONS[item.deactivation_reason],
  item.deactivation_note
].filter(Boolean).join(' · ')

// --- Satır aksiyonları: önizleme, rapor yükleme, rapor bekleniyor ---
const previewItem = ref<any>(null)
const reportItem = ref<any>(null)
const pendingItem = ref<any>(null)
const fromPreview = (action: 'report' | 'pending', equipment: any) => {
  previewItem.value = null
  if (action === 'report') reportItem.value = equipment
  else pendingItem.value = equipment
}
const onInspectionSaved = async (equipment?: any) => {
  // Rapordan yeni ekipman kaydedildiyse o ekipmanın kategorisi seçilir.
  if (reportDraft.value && equipment?.category?.slug) categoryFilter.value = equipment.category.slug
  // Rapordan yeni ekipmanda alan seçildiyse ekipmana yazılır (ekipman raporla birlikte oluştu).
  if (reportDraft.value && equipment?.id && (reportAreaId.value || reportUnitId.value)) {
    try {
      if (reportUnitId.value) await setEquipmentUnit(equipment.id, reportUnitId.value)
      if (reportAreaId.value) await setEquipmentArea(equipment.id, reportAreaId.value)
    } catch (e: any) { alert(errorMessage(e, 'Ekipman kaydedildi ama birimi / alanı yazılamadı; ekipman sayfasından seçebilirsiniz.')) }
  }
  reportItem.value = null; reportPreload.value = null; reportDraft.value = null; pendingItem.value = null; reportAreaId.value = null; reportUnitId.value = null
  loadEquipment()
}

// --- Rapordan ekipman tanımlama: rapor okunur, eşleşen ekipmana ya da yeni ekipmana aynı analizle rapor penceresi açılır ---
const fromReportOpen = ref(false)
// Toplu rapor yükleme penceresi (küçültülünce sayfanın altında ilerleme olarak kalır).
const bulkAnalysisOpen = ref(false)
const reportPreload = ref<{ analysisId: string; file: File } | null>(null)
const reportDraft = ref<Record<string, any> | null>(null)
// Rapordan yeni ekipmanda seçilen alan (lokasyonda alan varsa); kayıttan sonra ekipmana yazılır.
const reportAreaId = ref<number | null>(null)
const reportUnitId = ref<number | null>(null)
const onFromReportContinue = async (payload: { equipmentId?: number; draft?: Record<string, any>; type?: any; analysisId: string; file: File; areaId?: number | null; unitId?: number | null }) => {
  reportAreaId.value = payload.draft ? payload.areaId ?? null : null
  reportUnitId.value = payload.draft ? payload.unitId ?? null : null
  try {
    // Yeni ekipman henüz oluşturulmadı: rapor penceresi taslakla açılır, "Kaydet"te ekipman + rapor birlikte kaydedilir.
    const equipment = payload.draft
      ? { id: null, name: payload.draft.name, code: payload.draft.code, variant: payload.draft.variant, type: payload.type }
      : await get(`/pk-equipment/${payload.equipmentId}`)
    fromReportOpen.value = false
    reportPreload.value = { analysisId: payload.analysisId, file: payload.file }
    reportDraft.value = payload.draft || null
    reportItem.value = equipment
  } catch (e: any) {
    alert(errorMessage(e, 'Ekipman açılamadı.'))
  }
}
const onReportClosed = () => { reportItem.value = null; reportPreload.value = null; reportDraft.value = null; reportAreaId.value = null; reportUnitId.value = null }

// --- Tüp kontrol formları: tüp türü seçiliyken "Tüpler | Kontrol Formları" sekmeleri. Form "Tüp Kontrol Formu Yükle" ile ya da
// "Rapordan Ekipman Tanımla" toplu tüp raporunu tanıyınca (okunmuş olarak) aynı pencereden kaydedilir. ---
const TUBE_SLUG = 'yangin-sondurme-cihazi'
const tubeType = computed(() => {
  for (const category of equipmentCategories.value) {
    const type = category.types.find(item => item.slug === TUBE_SLUG)
    if (type) return { id: type.id, category: category.slug }
  }
  return null
})
const isTubeType = computed(() => !!tubeType.value && typeFilter.value === tubeType.value.id)
const tubeTab = ref<'list' | 'forms' | 'matching'>(queryText('tab') === 'forms' ? 'forms' : queryText('tab') === 'matching' ? 'matching' : 'list')
const showForms = computed(() => isTubeType.value && tubeTab.value === 'forms')
const showMatching = computed(() => isTubeType.value && tubeTab.value === 'matching')
// Envanter ile son kontrol formu arasındaki fark (sekmedeki sayı): envanterden çıkarılacaklar + yeni eklenecekler.
const matchingCount = ref(0)
const loadMatchingCount = async () => {
  if (!context.value || !tubeType.value) { matchingCount.value = 0; return }
  try {
    const board = await get<{ left: any[]; right: any[] }>('/pk-bulk-report-matches/board', { location_id: context.value.location_id })
    matchingCount.value = (board.left?.length || 0) + (board.right?.length || 0)
  } catch { matchingCount.value = 0 }
}
const onTubesChanged = async () => { await loadEquipment(); loadMatchingCount() }
const formsKey = ref(0)
const bulkOpen = ref(false)
const bulkPreload = ref<{ analysis: any; file: File } | null>(null)
const openBulk = (preload: { analysis: any; file: File } | null) => { bulkPreload.value = preload; bulkOpen.value = true }
const closeBulk = () => { bulkOpen.value = false; bulkPreload.value = null }
const onFromReportBulk = (payload: { analysis: any; file: File }) => { fromReportOpen.value = false; openBulk(payload) }
// Kayıttan sonra tüp listesi yenilenir; eşleştirme bekleyen varsa o sekme, yoksa Kontrol Formları açılır.
const onBulkSaved = async () => {
  closeBulk()
  await Promise.all([loadEquipment(), loadMatchingCount()])
  if (tubeType.value) {
    categoryFilter.value = tubeType.value.category
    typeFilter.value = tubeType.value.id
  }
  tubeTab.value = matchingCount.value ? 'matching' : 'forms'
  formsKey.value++
}

const daysText = (days: number | null) => days === null || days === undefined ? '—' : days < 0 ? `${-days} gün geçti` : days === 0 ? 'Bugün' : `${days} gün`
const daysKey = (days: number | null) => days === null || days === undefined ? '' : days < 0 ? 'overdue' : days <= 30 ? 'soon' : 'ok'
const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('tr-TR').format(new Date(value)) : '—'

const loadEquipment = async () => {
  if (!context.value) { equipment.value = []; return }
  // Liste zaten varsa (detaydan dönüş) eski liste görünür kalır, arkada tazelenir.
  loading.value = !equipment.value.length
  error.value = ''
  try {
    const [list] = await Promise.all([
      get('/pk-equipment', {
        location_id: context.value.location_id,
        ...(context.value.type === 'workplace' ? { workplace_id: context.value.workplace_id } : {})
      }),
      loadAreas(context.value.location_id, true),
      loadUnits(context.value.location_id, true),
      loadNames()
    ])
    equipment.value = list
  } catch (e: any) {
    error.value = errorMessage(e, 'Ekipmanlar alınamadı.')
  } finally { loading.value = false }
}

// --- Yeni ekipman ---
const createOpen = ref(false)
const saving = ref(false)
const formError = ref('')
const emptyForm = () => ({
  category: '', equipment_type_id: null as number | null, variant: '', code: '', name: '', brand: '', model: '', serial_no: '', place: '',
  location_business_entity_id: null as number | null, pk_area_id: null as number | null, pk_operational_unit_id: null as number | null
})
const form = reactive(emptyForm())

// --- İşyeri adı, operasyonel birim ve alan (isteğe bağlı): tanımlı değilse hiçbiri görünmez, her şey bugünkü gibi. Ekipman
// firmaya (işyerine) aittir; birimi o işyerinin birimlerinden, alanı (fiziksel yer) lokasyonun alanlarından seçilir. ---
const { load: loadNames, workplaceLabel } = useWorkplaceNames()
const { options: areaOptions, assignments: areaAssignments, byId: areaById, load: loadAreas, setEquipmentArea } = useLocationAreas()
const { load: loadUnits, unitsOf, unitOfEquipment, setEquipmentUnit } = useOperationalUnits()
const areaOf = (item: any) => {
  const id = areaAssignments.value.equipment[String(item.id)]
  return id ? areaById.value.get(id) || null : null
}
const selectableAreas = computed(() => areaOptions.value.filter(area => area.active))
const formUnits = computed(() => unitsOf(form.location_business_entity_id))
// Firma değişince başka işyerinin birimi seçili kalmaz.
const onFormWorkplace = () => { if (!formUnits.value.some(unit => unit.id === form.pk_operational_unit_id)) form.pk_operational_unit_id = null }

const formTypes = computed(() => equipmentCategories.value.find(c => c.slug === form.category)?.types || [])
const selectedType = computed(() => formTypes.value.find(t => t.id === form.equipment_type_id) || null)
// Seçili lokasyondaki işyerleri (firmalar).
const locationWorkplaces = computed(() => (groups.value.find(g => g.location_id === context.value?.location_id)?.items || [])
  .map(item => ({ id: item.id, company_name: item.company_name })))
// İşyeri context'indeyse varsayılan o işyeri, türün varsayılan kapsamı lokasyon genelse boş.
const defaultWorkplace = () => context.value?.type === 'workplace' && selectedType.value?.default_scope !== 'location' ? context.value.workplace_id ?? null : null

const openCreate = () => {
  Object.assign(form, emptyForm())
  if (categoryFilter.value) form.category = categoryFilter.value
  form.location_business_entity_id = defaultWorkplace()
  formError.value = ''
  createOpen.value = true
}
const closeCreate = () => { if (!saving.value) createOpen.value = false }
const onFormCategory = () => { form.equipment_type_id = null }
// Tür değişince varsayılan yer (birim seçiliyse firması korunur).
const onFormType = () => { if (!form.pk_operational_unit_id) { form.location_business_entity_id = defaultWorkplace(); onFormWorkplace() } form.variant = '' }

const saveEquipment = async () => {
  if (!context.value || !form.equipment_type_id) return
  saving.value = true
  formError.value = ''
  try {
    const created = await post('/pk-equipment', {
      location_id: context.value.location_id,
      location_business_entity_id: form.location_business_entity_id,
      equipment_type_id: form.equipment_type_id,
      variant: form.variant || null,
      code: form.code.trim() || null,
      name: form.name.trim() || null,
      brand: form.brand.trim() || null,
      model: form.model.trim() || null,
      serial_no: form.serial_no.trim() || null,
      place: form.place.trim() || null
    })
    // Birim ve alan seçildiyse ekipmana yazılır (ayrı istekler; ekipman zaten oluştu).
    if (form.pk_operational_unit_id && created?.id) await setEquipmentUnit(created.id, form.pk_operational_unit_id)
    if (form.pk_area_id && created?.id) await setEquipmentArea(created.id, form.pk_area_id)
    createOpen.value = false
    categoryFilter.value = form.category
    typeFilter.value = null
    await loadEquipment()
  } catch (e: any) {
    formError.value = errorMessage(e, 'Ekipman kaydedilemedi.')
  } finally { saving.value = false }
}

// Seçili kategori boşaldıysa (ilk açılış, context değişimi) ekipmanı olan ilk kategori seçilir.
// Liste yüklenirken (kategori yok) seçim korunur: adres satırından gelen kategori ve tür kaybolmasın.
watch(visibleCategories, categories => {
  if (!categories.length) return
  if (!categories.some(c => c.slug === categoryFilter.value)) {
    categoryFilter.value = categories[0]?.slug || null
    typeFilter.value = null
  }
})

// Seçimler adres satırına yazılır (geçmişe yeni kayıt eklemeden).
watch([categoryFilter, typeFilter, tubeTab, activeFilter, statusFilter, search], () => {
  const query: Record<string, string> = {}
  if (categoryFilter.value) query.category = categoryFilter.value
  if (typeFilter.value) query.type = String(typeFilter.value)
  if (tubeTab.value !== 'list') query.tab = tubeTab.value
  if (activeFilter.value !== 'active') query.active = activeFilter.value
  if (statusFilter.value) query.status = statusFilter.value
  if (search.value.trim()) query.q = search.value.trim()
  router.replace({ query })
})

watch(() => context.value && `${context.value.location_id}-${context.value.workplace_id ?? ''}`, (current, previous) => {
  // Tür seçimi yalnız lokasyon / işyeri değişince sıfırlanır; sayfa açılırken (bağlam ilk kez gelince) adresteki tür korunur.
  if (previous) typeFilter.value = null
  loadEquipment()
  loadMatchingCount()
})
// Tüp türü seçilince (katalog yüklenince de) sekmedeki eşleştirme sayısı.
watch(isTubeType, value => { if (value) loadMatchingCount() })

onMounted(async () => {
  loadWorkplaces()
  try { catalog.value = await get('/equipment-catalog') } catch { catalog.value = [] }
  loadEquipment()
})
// Sayfaya geri dönüş (keepalive): ilk açılış onMounted'da; sonrakilerde liste sessizce tazelenir.
let activatedOnce = false
onActivated(() => {
  if (activatedOnce) loadEquipment()
  activatedOnce = true
})
</script>

<style scoped>
.equipment-page { margin: 0 auto; display: grid; gap: 18px; }
/* Üst sıra: başlık + öne çıkan ekipman, çizim, sayı kartları + kontrol kapsamı */
.top{display:grid;grid-template-columns:minmax(300px,370px) minmax(0,1fr) minmax(360px,500px);gap:16px;align-items:start}
.crumb{display:flex;align-items:center;gap:8px;margin-bottom:8px;color:var(--admin-muted);font-size:13px}
.crumb a{color:var(--admin-muted)}.crumb a:hover{color:var(--admin-heading)}
.crumb strong{color:var(--admin-heading);font-weight:600}.crumb .pi-angle-right{font-size:11px}
h1{margin:0;color:var(--admin-heading);font-size:40px;font-weight:800;line-height:1.15;letter-spacing:-1px}.lead{margin:7px 0 0;color:var(--admin-muted);font-size:15px}
h2{margin:0;color:var(--admin-heading);font-size:18px}h3{margin:22px 0 10px;color:var(--admin-heading);font-size:13px}h3 small{font-weight:400;color:var(--admin-muted)}
.card{background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px;min-width:0}
.featured{display:flex;flex-direction:column;gap:12px;margin-top:20px;padding:20px;border-radius:16px;box-shadow:0 10px 28px rgba(var(--pk-shadow-rgb),.06)}
.featured-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.featured-head h2{font-size:26px;font-weight:800;letter-spacing:-.4px;overflow-wrap:anywhere}
.featured-model{margin-top:-6px;color:var(--admin-heading);font-size:17px;font-weight:700}
.due-pill{flex:none;display:inline-flex;align-items:center;gap:7px;padding:5px 12px;border-radius:999px;background:var(--admin-chip);color:var(--admin-text);font-size:13px;font-weight:700;white-space:nowrap}
.due-pill.soon,.due-pill.ok{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.due-pill.overdue{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.featured-row{display:flex;align-items:center;gap:10px;padding-top:12px;border-top:1px solid var(--admin-border);color:var(--admin-text);font-size:14px}
.featured-row i{color:var(--admin-muted)}.featured-row strong{margin-left:auto;color:var(--admin-heading);font-size:16px}
.featured-img{display:block;width:100%;height:150px;object-fit:contain}
.featured-link{width:100%;text-decoration:none}.featured-link .pi-file{margin-left:auto}.featured-link .pi-arrow-right{margin-left:auto}
.hero{min-width:0;margin:-30px 0 0;display:flex;justify-content:center}
.hero img{display:block;width:min(100%,560px)}
.top-right{display:grid;gap:14px}
.kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.kpi{display:flex;align-items:center;gap:14px;min-height:96px;padding:16px;border:1px solid var(--admin-border);border-radius:16px;background:var(--admin-card);box-shadow:0 10px 28px rgba(var(--pk-shadow-rgb),.05);font:inherit;text-align:left;cursor:pointer;transition:border-color .15s,box-shadow .15s}
.kpi:hover{border-color:var(--admin-muted)}.kpi.active{border-color:var(--pk-accent);box-shadow:0 0 0 3px var(--pk-focus-ring)}
.kpi-icon{flex:none;width:48px;height:48px;display:grid;place-items:center;border-radius:50%;font-size:20px}
.kpi.blue .kpi-icon{background:var(--admin-accent-soft);color:var(--admin-accent-text)}
.kpi.bad .kpi-icon{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.kpi.warn .kpi-icon{background:var(--admin-warning-bg);color:var(--admin-warning-text)}
/* Mor: Genel bakış (katalog 02) sayı kartındaki tonla aynı; tokenlarda mor yok */
.kpi.purple .kpi-icon{background:#ebe9fe;color:#5925dc}
.kpi-text{display:grid;gap:2px;min-width:0}.kpi-text strong{color:var(--admin-heading);font-size:26px;font-weight:800;line-height:1.1}.kpi-text small{color:var(--admin-text);font-size:14px}
.kpi-arrow{margin-left:auto;color:var(--admin-heading);font-size:14px}
.coverage{display:grid;gap:12px;padding:18px 20px;border-radius:16px;box-shadow:0 10px 28px rgba(var(--pk-shadow-rgb),.05)}
.coverage header{display:flex;align-items:center;gap:10px}.coverage header i{color:var(--admin-accent-text);font-size:18px}.coverage h3{margin:0;font-size:17px;font-weight:800}
.coverage-row{display:grid;grid-template-columns:140px minmax(0,1fr) 36px;align-items:center;gap:14px;color:var(--admin-text);font-size:14px}
.coverage-row strong{color:var(--admin-heading);font-size:15px;text-align:right}
.bar{height:10px;--p-progressbar-background:var(--admin-chip);--p-progressbar-border-radius:999px}
.bar.overdue :deep(.p-progressbar-value){background:var(--pk-danger)}.bar.soon :deep(.p-progressbar-value){background:var(--admin-upcoming-text)}
/* Düğmeler */
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:0 18px;border:0;border-radius:10px;background:var(--pk-yellow);color:var(--pk-on-accent);font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 8px 20px rgba(var(--pk-accent-rgb),.22)}.primary-button:hover{background:var(--pk-yellow-dark)}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.outline-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:0 16px;border:1px solid var(--admin-border);border-radius:10px;background:var(--admin-card);color:var(--admin-heading);font:inherit;font-size:14px;font-weight:700;cursor:pointer}
.outline-button i{color:var(--admin-accent-text)}.outline-button:hover{border-color:var(--admin-muted)}.outline-button:disabled{opacity:.55;cursor:not-allowed}
.secondary-button{min-height:40px;padding:0 18px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-hover);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}
.empty-state{display:flex;flex-direction:column;align-items:center;gap:7px;padding:70px 20px;text-align:center;color:var(--admin-muted)}.empty-state i{font-size:28px}.empty-state strong{color:var(--admin-heading)}
/* Liste kartı: sekmeler, süzgeçler, tablo */
.list-card{overflow:hidden;border-radius:16px;box-shadow:0 10px 28px rgba(var(--pk-shadow-rgb),.05)}
.tabs{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:4px 18px 0;border-bottom:1px solid var(--admin-border)}
.tabs button{display:inline-flex;align-items:center;gap:9px;padding:14px;border:0;border-bottom:3px solid transparent;margin-bottom:-1px;background:none;color:var(--admin-heading);font:inherit;font-size:15px;font-weight:600;cursor:pointer}
.tabs button i{color:var(--admin-muted);font-size:16px}
.tabs button:hover{color:var(--admin-accent-text)}.tabs button.active{color:var(--admin-accent-text);border-bottom-color:var(--pk-yellow);font-weight:700}.tabs button.active i{color:var(--admin-accent-text)}
.tabs button.active .count{background:var(--admin-accent-soft);color:var(--admin-accent-text)}
.count{min-width:20px;padding:1px 8px;border-radius:999px;background:var(--admin-chip);color:var(--admin-muted);font-size:12px;font-weight:700}
.toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:14px 18px}
.toolbar-spacer{flex:1}
.pill-select{position:relative;display:inline-flex;align-items:center}
.pill-select select{max-width:220px;height:42px;padding:0 40px 0 16px;border:1px solid var(--admin-border);border-radius:12px;background:var(--admin-card);color:var(--admin-heading);font:inherit;font-size:14px;font-weight:700;appearance:none;cursor:pointer;outline:0;text-overflow:ellipsis}
.pill-select select:focus{border-color:var(--pk-accent);box-shadow:0 0 0 3px var(--pk-focus-ring)}
.pill-select > .pi{position:absolute;right:15px;color:var(--admin-heading);font-size:12px;pointer-events:none}
.search-box{height:42px;width:300px;display:flex;align-items:center;gap:10px;padding:0 14px;border:1px solid var(--admin-border);border-radius:12px;background:var(--admin-card);color:var(--admin-muted)}.search-box input{width:100%;border:0;outline:0;background:transparent;color:var(--admin-heading);font:inherit;font-size:14px}
.search-box:focus-within{border-color:var(--pk-accent);box-shadow:0 0 0 3px var(--pk-focus-ring)}
.inner{padding:0 18px 18px}
.table-wrap{overflow:auto;padding:0 18px}
table{width:100%;border-collapse:collapse}th,td{padding:13px 16px;text-align:left;border-bottom:1px solid var(--admin-row-border);font-size:14px;color:var(--admin-text);vertical-align:middle}
th{font-size:14px;font-weight:700;color:var(--admin-heading);background:var(--admin-soft);white-space:nowrap}
thead th:first-child{border-radius:12px 0 0 12px}thead th:last-child{border-radius:0 12px 12px 0}thead th{border-bottom:0}
tbody tr{cursor:pointer}tbody tr:hover{background:var(--admin-hover)}tbody tr.selected{background:var(--admin-accent-soft)}
.no-col{width:1%;white-space:nowrap;color:var(--admin-heading);font-size:15px}
.check-col{width:44px;padding-right:0;cursor:default}.check-col input{width:17px;height:17px;accent-color:var(--pk-accent);cursor:pointer;vertical-align:middle}
.actions-col{width:1%;cursor:default;text-align:center}.row-actions{display:flex;justify-content:flex-end;gap:8px}
.icon-button{width:36px;height:36px;display:grid;place-items:center;border:1px solid transparent;border-radius:10px;background:var(--admin-accent-soft);color:var(--admin-accent-text);cursor:pointer;text-decoration:none}.icon-button:hover{border-color:var(--pk-accent)}.icon-button i{font-size:15px}
.icon-button.more{background:transparent}.icon-button.more:hover{background:var(--admin-accent-soft)}
.bulk-bar{display:flex;align-items:center;gap:14px;padding:10px 16px;background:var(--admin-soft);border-bottom:1px solid var(--admin-border);font-size:12px}.bulk-bar strong{color:var(--admin-heading)}
.link-button{border:0;background:none;color:var(--admin-link);font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.sub-tabs{display:flex;gap:4px;margin:0 18px 12px}
.sub-tabs button{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 13px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-muted);font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.sub-tabs button:hover{color:var(--admin-heading)}.sub-tabs button.active{border-color:var(--pk-accent);background:var(--admin-accent-soft);color:var(--admin-heading)}
.sub-tabs .count.warn{background:var(--admin-warning-bg);color:var(--admin-warning-text)}
.bulk-spacer{flex:1}
.secondary-button.small{display:inline-flex;align-items:center;gap:7px;min-height:34px;padding:0 13px;background:var(--admin-card)}.secondary-button.small:disabled{opacity:.6}
tbody tr.passive td:not(.check-col):not(.actions-col){opacity:.6}
.passive-tag{display:inline-block;margin-left:6px;padding:2px 9px;border-radius:999px;background:var(--admin-chip);color:var(--admin-muted);font-size:11px;font-weight:700;cursor:help}
.danger-button{display:inline-flex;align-items:center;gap:7px;margin-left:auto;min-height:34px;padding:0 13px;border:1px solid var(--admin-danger-text);border-radius:8px;background:var(--admin-danger-bg);color:var(--admin-danger-text);font-size:12px;font-weight:700;cursor:pointer}.danger-button:disabled{opacity:.6}
.tag{display:inline-block;margin-left:8px;padding:1px 8px;border-radius:999px;border:1px solid var(--admin-border);background:var(--admin-soft);color:var(--admin-text);font-size:10px;font-weight:700;vertical-align:middle}
.type-cell{display:flex;flex-direction:column;align-items:flex-start;gap:4px;white-space:nowrap}.type-cell > span:first-child{color:var(--admin-heading);font-weight:600}
.type-cell .tag{margin-left:0}
.name-cell{display:flex;flex-direction:column;gap:3px}.name-cell strong{color:var(--admin-heading);font-size:13px}.name-cell small{color:var(--admin-muted);font-size:11px}
.days{font-weight:700;white-space:nowrap}.days.overdue{color:var(--admin-danger-text)}.days.soon{color:var(--admin-warning-text)}.days.ok{color:var(--admin-text)}
.status-badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
.findings-info{position:relative;display:inline-flex;align-items:center;gap:4px;margin-left:6px;color:var(--admin-danger-text);font-size:11px;font-weight:700;white-space:nowrap;cursor:help;outline:none}
.findings-info .pi{font-size:12px}
.type-findings{margin:0 0 14px;padding:12px 14px;border:1px solid var(--admin-border);border-left:3px solid var(--admin-danger-text);border-radius:10px}
.type-findings-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;color:var(--admin-heading);font-size:13px}
.type-findings ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:5px}
.type-findings li{display:flex;gap:10px;font-size:12px;line-height:1.45}.type-findings li a{min-width:70px;color:var(--admin-heading);text-decoration:none}.type-findings li a:hover{text-decoration:underline}
.status-badge.uygun{background:var(--admin-success-bg);color:var(--admin-success-text)}.status-badge.uygun_degil{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.status-badge.rapor_bekleniyor{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.status-badge.rapor_yok,.status-badge.belirtilmemis{background:var(--admin-chip);color:var(--admin-muted)}
.state{padding:60px 20px;text-align:center;color:var(--admin-muted)}.table-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 16px;color:var(--admin-muted);font-size:12px}
.pager{display:flex;align-items:center;gap:10px}.pager span{color:var(--admin-muted);font-size:12px;font-weight:700}
.pager button{display:inline-flex;align-items:center;gap:5px;height:32px;padding:0 12px;border:1px solid var(--admin-border);border-radius:7px;background:var(--admin-card);color:var(--admin-heading);font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.pager button:disabled{opacity:.45;cursor:not-allowed}
.error-text{color:var(--admin-danger-text);font-size:12px}.muted{color:var(--admin-muted);font-size:12px}.hint{margin:6px 0 10px;color:var(--admin-muted);font-size:12px}
.modal-backdrop{position:fixed;inset:0;z-index:100;background:var(--admin-overlay)}
.close-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:var(--admin-muted);cursor:pointer;border-radius:7px}.close-button:hover{background:var(--admin-hover);color:var(--admin-heading)}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px}
.form-grid label{display:block;color:var(--admin-heading);font-size:12px;font-weight:700}.wide{grid-column:1 / -1}
label > span{color:var(--admin-danger-text)}label small{font-weight:400;color:var(--admin-muted)}
.form-grid input,.form-grid select{display:block;width:100%;height:40px;margin-top:6px;padding:0 10px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:13px;outline:0}
.form-grid input:focus,.form-grid select:focus{border-color:var(--pk-accent);box-shadow:0 0 0 3px var(--pk-focus-ring)}
.modal-backdrop{display:grid;place-items:center;padding:20px}
.modal-card{width:min(620px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:22px;background:var(--admin-card);border-radius:12px;box-shadow:0 20px 60px var(--admin-shadow)}
.modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:18px}.modal-head p{margin:5px 0 0;color:var(--admin-muted);font-size:12px}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
/* Dar ekranda sayı kartları çizimin altına iner; telefonda çizim gizli, kartlar alt alta */
@media(max-width:1300px){.top{grid-template-columns:minmax(280px,360px) minmax(0,1fr)}.top-right{grid-column:1 / -1;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr)}}
@media(max-width:1000px){.top-right{grid-template-columns:minmax(0,1fr)}}
@media(max-width:800px){.top{grid-template-columns:minmax(0,1fr)}.hero{display:none}.featured{margin-top:6px}h1{font-size:32px}.form-grid{grid-template-columns:1fr}.search-box{width:100%}.toolbar-spacer{display:none}.coverage-row{grid-template-columns:110px minmax(0,1fr) 30px}}
</style>

<style>
/* Teleport ile body'de (scoped stil ulaşmaz) */
.findings-pop{position:fixed;z-index:1000;width:340px;padding:10px 12px;border:1px solid var(--admin-border);border-radius:10px;background:var(--admin-card,#fff);box-shadow:0 10px 30px rgba(0,0,0,.14);color:var(--admin-text);display:flex;flex-direction:column;gap:6px;pointer-events:none}
.findings-pop strong{color:var(--admin-heading);font-size:12px}.findings-pop span{font-size:12px;line-height:1.45;padding-left:10px;border-left:2px solid var(--admin-danger-text)}
</style>
