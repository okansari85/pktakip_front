<template>
  <div class="profile-page">
    <div v-if="loading" class="card state">Ekipman yükleniyor...</div>
    <div v-else-if="loadError" class="card state error-text">{{ loadError }}</div>

    <template v-else-if="equipment">
      <!-- Üst sıra (tasarım kataloğu 06): başlık ve ekipman kartı, izometrik çizim, açık bulgular / kontrol geçmişi / karekod -->
      <div class="top">
        <div class="top-left">
          <nav class="crumb" aria-label="Sayfa yolu">
            <i class="pi pi-home" aria-hidden="true" />
            <a href="/expert/equipment" @click.prevent="goBack">{{ backLabel }}</a>
            <i class="pi pi-angle-right" aria-hidden="true" />
            <strong>{{ title }}</strong>
          </nav>
          <h1>Ekipman detayı</h1>
          <p class="lead">Ekipman bilgilerini görüntüleyin, kontrolleri ve bulguları yönetin.</p>

          <section class="card info-card">
            <a href="/expert/equipment" class="back-link" @click.prevent="goBack"><i class="pi pi-arrow-left" /> {{ backText }}</a>
            <div class="title-row">
              <h2>{{ title }}</h2>
              <span class="active-pill" :class="{ passive: !equipment.is_active }"><span class="dot" /> {{ equipment.is_active ? 'Aktif' : 'Pasif' }}</span>
            </div>
            <p v-if="modelText || equipment.variant" class="model">{{ modelText }}<span v-if="equipment.variant" class="tag" :title="equipment.type?.variant_label || 'Etiket'">{{ equipment.variant }}</span></p>
            <dl class="facts">
              <div><dt><i class="pi pi-hashtag" /> Ekipman no</dt><dd>{{ equipment.code || '—' }}</dd></div>
              <!-- Konum: firma (işyeri adı varsa "Ad · Firma"); altında varsa birim, alan ve bulunduğu yer -->
              <div><dt><i class="pi pi-map-marker" /> Konum</dt><dd>{{ workplaceText }}<small v-if="placeText">{{ placeText }}</small></dd></div>
              <div><dt><i class="pi pi-exclamation-triangle" /> Son kontrol</dt><dd>{{ formatDate(equipment.last_control_date) }}</dd></div>
              <div><dt><i class="pi pi-calendar" /> Gelecek kontrol</dt><dd>{{ formatDate(equipment.next_control_date) }}</dd></div>
            </dl>
            <span v-if="equipment.is_active && equipment.days_left !== null && equipment.days_left !== undefined" class="due-pill" :class="daysKey(equipment.days_left)"><i class="pi pi-calendar" /> {{ dueText(equipment.days_left) }}</span>
            <button class="primary-button" type="button" @click="startEdit"><i class="pi pi-pencil" /> Bilgileri düzenle</button>
          </section>
        </div>

        <figure class="hero">
          <span class="status-float" :class="equipment.status"><i :class="STATUS_ICONS[equipment.status] || 'pi pi-info-circle'" /> {{ STATUS_LABELS[equipment.status] }}</span>
          <div class="hero-art">
            <!-- Katalogdaki görsel (tasarım kataloğu 05'ten kırpıldı, marka yazıları silindi) -->
            <img src="/katalog/forklift-katalog.webp" alt="" />
            <!-- Kaldırma ve iletme ekipmanında son raporun bulguları resimdeki parçasında (zincir, teker, lamba …); tıklayınca Bulgular sekmesi -->
            <button v-for="pin in findingPins" :key="pin.key" v-tooltip.top="pin.texts.join(' • ')" class="pin" :class="{ flip: pin.x > 75 }" type="button" :style="{ left: `${pin.x}%`, top: `${pin.y}%` }" :aria-label="`${pin.label}: ${pin.texts.join('; ')}`" @click="showTab('findings')">
              <span class="pin-dot">{{ pin.texts.length > 1 ? pin.texts.length : '' }}</span>
              <span class="pin-label">{{ pin.label }}</span>
            </button>
          </div>
        </figure>

        <div class="top-right">
          <!-- Son raporun bulguları (listedeki "N bulgu" ile aynı); tümü aşağıdaki Bulgular sekmesinde -->
          <section class="card side-card">
            <header>
              <i class="pi pi-exclamation-triangle warn-icon" />
              <h3>Açık bulgular</h3>
              <span class="count-badge" :class="{ none: !findings.length }">{{ findings.length }}</span>
            </header>
            <ul v-if="findings.length" class="finding-list">
              <li v-for="(finding, index) in findings.slice(0, 2)" :key="index"><span class="dot" /> <span class="clamp">{{ finding }}</span></li>
            </ul>
            <p v-else class="muted">Açık bulgu yok.</p>
            <button v-if="findings.length" class="link-button" type="button" @click="showTab('findings')">Tüm bulgular <i class="pi pi-angle-right" /></button>
          </section>

          <section class="card side-card">
            <header><i class="pi pi-history accent-icon" /><h3>Kontrol geçmişi</h3></header>
            <ol v-if="equipment.inspections?.length" class="timeline">
              <li v-for="inspection in equipment.inspections.slice(0, 3)" :key="inspection.id">
                <strong>{{ formatDate(inspection.control_date) }}</strong>
                <span>Periyodik kontrol</span>
                <span class="status-badge" :class="inspection.status">{{ STATUS_LABELS[inspection.status] }}</span>
              </li>
            </ol>
            <p v-else class="muted">Henüz kontrol kaydı yok.</p>
          </section>

          <!-- Karekod hep hazır (ekipman sayfasının adresi); yazdırma / PNG için etiket penceresi -->
          <section class="card side-card qr-card">
            <header><i class="pi pi-qrcode accent-icon" /><h3>Karekod</h3></header>
            <div class="qr-body">
              <button class="qr-image" type="button" title="Etiketi yazdır / indir" aria-label="Etiketi yazdır / indir" @click="qrOpen = true">
                <QrcodeVue :value="qrUrl" :size="96" level="M" render-as="svg" :margin="1" />
              </button>
              <button class="soft-button" type="button" @click="qrOpen = true"><i class="pi pi-print" /> Etiketi yazdır</button>
            </div>
          </section>
        </div>
      </div>

      <!-- Pasif ekipman: geçmişi kalır, kontrol eklenmez -->
      <p v-if="!equipment.is_active" class="passive-note">
        <i class="pi pi-ban" />
        <span>
          <strong>Pasif</strong> · {{ formatDate(equipment.deactivated_at) }} tarihinde pasife alındı<template v-if="equipment.deactivation_reason">: {{ reasons[equipment.deactivation_reason] || equipment.deactivation_reason }}</template>.
          <template v-if="equipment.deactivation_note"> {{ equipment.deactivation_note }}</template>
          Kontrol eklenmez, kalan gün hesabına ve tesisat listesine girmez.
        </span>
      </p>

      <!-- Kontroller / Bulgular / Belgeler -->
      <section ref="tabsCard" class="card tabs-card">
        <div class="tabs-row">
          <div class="tabs" role="tablist">
            <button type="button" role="tab" :aria-selected="listTab === 'checks'" :class="{ active: listTab === 'checks' }" @click="listTab = 'checks'"><i class="pi pi-clipboard" /> Kontroller</button>
            <button type="button" role="tab" :aria-selected="listTab === 'findings'" :class="{ active: listTab === 'findings' }" @click="listTab = 'findings'"><i class="pi pi-exclamation-triangle" /> Bulgular</button>
            <button type="button" role="tab" :aria-selected="listTab === 'docs'" :class="{ active: listTab === 'docs' }" @click="listTab = 'docs'"><i class="pi pi-file" /> Belgeler</button>
          </div>
          <div v-if="!equipment.is_active" class="history-actions">
            <span class="bound-note"><i class="pi pi-info-circle" /> Pasif ekipmana kontrol eklenmez; önce aktife alın.</span>
          </div>
          <!-- Tesisata bağlı ekipman: kontrolü tesisat raporundan gelir, rapor ve rapor bekleniyor tesisatta girilir -->
          <div v-else-if="equipment.installation" class="history-actions">
            <span class="bound-note"><i class="pi pi-info-circle" /> Kontrolü {{ equipment.installation.name }} raporundan gelir.</span>
            <NuxtLink class="outline-button" to="/expert/installations">{{ equipment.installation.name }} <i class="pi pi-arrow-right" /></NuxtLink>
            <button class="primary-button" type="button" @click="planOpen = true"><i class="pi pi-plus" /> Kontrol planla</button>
          </div>
          <div v-else class="history-actions">
            <!-- Rapor bekleniyor: katalogda yok, gizli (SHOW_PENDING_BUTTON); listede satırın "Diğer işlemler" menüsünde -->
            <button v-if="SHOW_PENDING_BUTTON" class="outline-button" type="button" @click="pendingOpen = true"><i class="pi pi-hourglass" /> Rapor bekleniyor</button>
            <button v-tooltip.bottom="'Yeni periyodik kontrol raporu yükleyin.'" class="outline-button" type="button" @click="reportOpen = true"><i class="pi pi-upload" /> Rapor yükle</button>
            <button class="primary-button" type="button" @click="planOpen = true"><i class="pi pi-plus" /> Kontrol planla</button>
          </div>
        </div>

        <!-- Kontroller -->
        <template v-if="listTab === 'checks'">
          <div v-if="!equipment.inspections?.length" class="state">Henüz kontrol kaydı yok.</div>
          <div v-else class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Rapor no</th>
                  <th>Sonuç</th>
                  <th>Bulgu</th>
                  <th>Geçerlilik</th>
                  <template v-if="SHOW_HISTORY_EXTRA_COLUMNS"><th>Kontrolü yapan</th><th>Sonuç ve kanaat</th><th>Kaynak</th><th>Kaydeden</th></template>
                  <th>Rapor</th>
                  <th class="actions-col"><span class="sr-only">İşlemler</span></th>
                </tr>
              </thead>
              <tbody>
                <template v-for="(inspection, index) in equipment.inspections" :key="inspection.id">
                <tr>
                  <td><strong class="date">{{ formatDate(inspection.control_date) }}</strong><small v-if="index === 0" class="current-tag">Geçerli</small></td>
                  <td>
                    <span class="report-no">{{ inspection.report_no || '—' }}</span>
                    <small v-if="inspection.source === 'ai'" class="ai-note"><i class="pi pi-sparkles" /> Yapay zekâ ile okundu</small>
                  </td>
                  <td><span class="status-badge big" :class="inspection.status"><i :class="STATUS_ICONS[inspection.status] || 'pi pi-info-circle'" /> {{ STATUS_LABELS[inspection.status] }}</span></td>
                  <td>
                    <button v-if="inspection.findings?.length" class="link-button count-link" type="button" :aria-expanded="openAnalysis === inspection.id" @click="toggleAnalysis(inspection.id)">{{ inspection.findings.length }}</button>
                    <span v-else>0</span>
                  </td>
                  <td>{{ formatDate(inspection.next_control_date) }}</td>
                  <template v-if="SHOW_HISTORY_EXTRA_COLUMNS">
                    <td class="body-cell"><span v-if="inspection.inspection_body" class="clamp" :title="inspection.inspection_body">{{ inspection.inspection_body }}</span><span v-else class="muted">—</span></td>
                    <td class="note-cell"><span v-if="inspection.conclusion" class="clamp">{{ inspection.conclusion }}</span><span v-else-if="inspection.note" class="muted">{{ inspection.note }}</span><span v-else class="muted">—</span></td>
                    <td>{{ SOURCE_LABELS[inspection.source] }}</td>
                    <td>{{ inspection.created_by || '—' }}<small class="muted-cell block">{{ formatDateTime(inspection.created_at) }}</small></td>
                  </template>
                  <td>
                    <button v-if="inspection.has_report" v-tooltip.top="inspection.report_file_name || 'Raporu aç'" class="pdf-button" type="button" aria-label="Raporu aç" @click="openReport(inspection)"><i class="pi pi-file-pdf" /></button>
                    <span v-else class="muted">—</span>
                  </td>
                  <td class="actions-col">
                    <button v-tooltip.top="'Diğer işlemler'" class="icon-button" type="button" aria-label="Diğer işlemler" aria-haspopup="true" @click="openInspectionMenu($event, inspection)"><i class="pi pi-ellipsis-h" /></button>
                  </td>
                </tr>
                <tr v-if="openAnalysis === inspection.id" class="analysis-row">
                  <td :colspan="SHOW_HISTORY_EXTRA_COLUMNS ? 11 : 7">
                    <!-- Gizli sütunların bilgisi (kontrolü yapan, kaydeden) ayrıntıda -->
                    <p class="detail-meta">
                      <span v-if="inspection.inspection_body">Kontrolü yapan: <strong>{{ inspection.inspection_body }}</strong></span>
                      <span>Kaydeden: <strong>{{ inspection.created_by || '—' }}</strong> · {{ formatDateTime(inspection.created_at) }} · {{ SOURCE_LABELS[inspection.source] }}</span>
                    </p>
                    <div class="inspection-detail">
                      <div v-if="inspection.conclusion"><h4>Sonuç ve kanaat</h4><p>{{ inspection.conclusion }}</p></div>
                      <div v-else-if="inspection.note"><h4>Not</h4><p>{{ inspection.note }}</p></div>
                      <div>
                        <h4>Bulgular</h4>
                        <ol v-if="inspection.findings?.length"><li v-for="(finding, findingIndex) in inspection.findings" :key="findingIndex">{{ finding }}</li></ol>
                        <p v-else class="muted">Bulgu yok.</p>
                      </div>
                    </div>
                    <template v-if="inspection.analysis">
                      <h4 class="analysis-title"><i class="pi pi-sparkles" /> Yapay zeka analizi</h4>
                      <ExpertEquipmentAnalysisDetail :analysis="inspection.analysis" :equipment-id="equipment.id" :inspection-id="inspection.id" @updated="equipment = $event" />
                    </template>
                  </td>
                </tr>
                </template>
              </tbody>
            </table>
          </div>
        </template>

        <!-- Bulgular: son raporun bulguları -->
        <div v-else-if="listTab === 'findings'" class="tab-body">
          <template v-if="findings.length">
            <p class="tab-hint">Son raporun bulguları</p>
            <ol class="finding-rows">
              <li v-for="(finding, index) in findings" :key="index"><span class="bar" /> {{ finding }}</li>
            </ol>
          </template>
          <p v-else class="state">Son raporda bulgu yok.</p>
        </div>

        <!-- Belgeler: kontrollerin rapor dosyaları -->
        <div v-else class="tab-body">
          <ul v-if="reportFiles.length" class="doc-list">
            <li v-for="inspection in reportFiles" :key="inspection.id">
              <button class="pdf-button" type="button" aria-label="Raporu aç" @click="openReport(inspection)"><i class="pi pi-file-pdf" /></button>
              <span class="doc-text"><strong>{{ inspection.report_no || inspection.report_file_name || 'Periyodik kontrol raporu' }}</strong><small>{{ formatDate(inspection.control_date) }} kontrolü<template v-if="inspection.report_file_name && inspection.report_no"> · {{ inspection.report_file_name }}</template></small></span>
              <button class="link-button" type="button" @click="openReport(inspection)">Aç <i class="pi pi-external-link" /></button>
            </li>
          </ul>
          <p v-else class="state">Henüz rapor dosyası yok. Rapor yüklenince burada listelenir.</p>
        </div>
      </section>
    </template>

    <!-- Bilgileri düzenle: Bilgiler (fotoğraf dahil) ve rapordan okunan teknik özellikler; pasife alma ve silme pencerenin altında.
         Yalnız X ve İptal kapatır. -->
    <div v-if="editing && equipment" class="modal-backdrop">
      <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="edit-title">
        <div class="modal-head">
          <div><h2 id="edit-title">Bilgileri düzenle</h2><p>{{ title }}</p></div>
          <button class="close-button" type="button" aria-label="Kapat" :disabled="savingEdit" @click="editing = false"><i class="pi pi-times" /></button>
        </div>
        <div class="tabs modal-tabs">
          <button type="button" :class="{ active: tab === 'info' }" @click="tab = 'info'">Bilgiler</button>
          <button type="button" :class="{ active: tab === 'specs' }" @click="tab = 'specs'">Teknik özellikler <span class="count">{{ equipment.properties?.length || 0 }}</span></button>
        </div>

        <ExpertEquipmentProperties v-if="tab === 'specs'" :equipment-id="equipment.id" :properties="equipment.properties || []" :pending-specs="equipment.pending_specs || []" @updated="equipment = $event" />

        <template v-else>
          <div class="form-grid">
            <label>Ekipman no<input v-model="editForm.code" type="text" /></label>
            <label v-if="equipment.type?.variants?.length">{{ equipment.type.variant_label || 'Etiket' }}
              <select v-model="editForm.variant">
                <option value="">Seçilmedi</option>
                <option v-for="variant in equipment.type.variants" :key="variant" :value="variant">{{ variant }}</option>
              </select>
            </label>
            <label>Ekipman adı<input v-model="editForm.name" type="text" :placeholder="equipment.type?.name" /></label>
            <label>Marka<input v-model="editForm.brand" type="text" /></label>
            <label>Model<input v-model="editForm.model" type="text" /></label>
            <label>Seri no<input v-model="editForm.serial_no" type="text" /></label>
            <!-- Lokasyon: yanlış lokasyona açılmış ekipman, kontrol kayıtları ve raporlarıyla birlikte taşınır -->
            <label v-if="editLocations.length > 1">Lokasyon
              <select v-model="editForm.location_id" @change="onEditLocation">
                <option v-for="location in editLocations" :key="location.id" :value="location.id">{{ location.name }}</option>
              </select>
            </label>
            <label>Ait olduğu yer
              <select v-model="editForm.location_business_entity_id" @change="onEditWorkplace">
                <option :value="null">Lokasyon geneli</option>
                <option v-for="workplace in locationWorkplaces" :key="workplace.id" :value="workplace.id">{{ workplaceLabel(workplace.id, workplace.company_name) }}</option>
              </select>
            </label>
            <!-- Birim yalnızca seçilen işyerinin birimleri; işyerinde birim yoksa görünmez. Alan fiziksel yer, firmadan bağımsız. -->
            <label v-if="!locationMoved && editUnits.length">Birim
              <select v-model="editForm.pk_operational_unit_id">
                <option :value="null">Birim yok</option>
                <option v-for="unit in editUnits" :key="unit.id" :value="unit.id">{{ unit.name }}</option>
              </select>
            </label>
            <label v-if="!locationMoved && selectableAreas.length">Alan
              <select v-model="editForm.pk_area_id">
                <option :value="null">Alan yok</option>
                <option v-for="area in selectableAreas" :key="area.id" :value="area.id">{{ areaText(area) }}</option>
              </select>
            </label>
            <label>Bulunduğu yer<input v-model="editForm.place" type="text" /></label>
            <label class="wide">Not<textarea v-model="editForm.notes" rows="2" /></label>
          </div>
          <p v-if="locationMoved" class="hint-text"><i class="pi pi-info-circle" /> Ekipman kontrol kayıtları ve raporlarıyla birlikte {{ editLocationName }} lokasyonuna taşınacak. Birim ve alan yeni lokasyonda yeniden seçilir.</p>

          <!-- Fotoğraf (hemen kaydedilir) -->
          <div class="photo-row">
            <div class="photo" :class="{ empty: !equipment.photo_url }">
              <img v-if="equipment.photo_url" :src="equipment.photo_url" :alt="equipment.type?.name" />
              <i v-else class="pi pi-image" />
            </div>
            <input ref="photoInput" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="uploadPhoto" />
            <div class="photo-actions">
              <strong>Fotoğraf</strong>
              <div>
                <button class="secondary-button" type="button" :disabled="photoBusy" @click="photoInput?.click()">
                  <i :class="photoBusy ? 'pi pi-spin pi-spinner' : 'pi pi-upload'" /> {{ equipment.photo_url ? 'Değiştir' : 'Fotoğraf yükle' }}
                </button>
                <button v-if="equipment.photo_url" class="link-button danger" type="button" :disabled="photoBusy" @click="removePhoto">Kaldır</button>
              </div>
              <p v-if="photoError" class="error-text">{{ photoError }}</p>
            </div>
          </div>
          <p v-if="editError" class="error-text">{{ editError }}</p>
        </template>

        <div class="modal-actions">
          <div class="modal-actions-left">
            <button v-if="equipment.is_active" class="secondary-button" type="button" @click="editing = false; deactivateOpen = true"><i class="pi pi-ban" /> Pasife al</button>
            <button v-else class="secondary-button" type="button" :disabled="activating" @click="activate"><i class="pi pi-check-circle" /> Aktife al</button>
            <button class="link-button danger" type="button" @click="removeEquipment"><i class="pi pi-trash" /> Ekipmanı sil</button>
          </div>
          <button class="secondary-button" type="button" :disabled="savingEdit" @click="editing = false">{{ tab === 'info' ? 'İptal' : 'Kapat' }}</button>
          <button v-if="tab === 'info'" class="primary-button" type="button" :disabled="savingEdit" @click="saveEdit">{{ savingEdit ? 'Kaydediliyor...' : 'Kaydet' }}</button>
        </div>
      </section>
    </div>

    <Menu ref="inspectionMenu" :model="inspectionMenuItems" popup :pt="{ root: { style: MENU_VARS } }" />
    <ExpertEquipmentReportModal v-if="reportOpen && equipment" :equipment="equipment" @close="reportOpen = false" @saved="onInspectionSaved" />
    <ExpertEquipmentPendingModal v-if="pendingOpen && equipment" :equipment="equipment" @close="pendingOpen = false" @saved="onInspectionSaved" />
    <ExpertEquipmentInspectionEditModal v-if="editingInspection && equipment" :equipment="equipment" :inspection="editingInspection" @close="editingInspection = null" @saved="onInspectionSaved" />
    <ExpertControlPlanModal v-if="planOpen && equipment" :initial="planInitial" @close="planOpen = false" @saved="planOpen = false" />
    <ExpertEquipmentDeactivateModal
      v-if="deactivateOpen && equipment"
      :ids="[equipment.id]" :title="[equipment.name || equipment.type?.name, equipment.code && `no ${equipment.code}`].filter(Boolean).join(' · ')"
      @close="deactivateOpen = false" @saved="onDeactivated"
    />
    <ExpertEquipmentQrModal
      v-if="equipment"
      :open="qrOpen"
      :equipment-id="equipment.id"
      :code="equipment.code"
      :type-name="equipment.name || equipment.type?.name"
      :place="[equipment.location?.name, equipment.place].filter(Boolean).join(' · ')"
      :next-control="equipment.next_control_date ? formatDate(equipment.next_control_date) : null"
      @close="qrOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import QrcodeVue from 'qrcode.vue'

// Karekod: sağdaki Karekod kartında hep görünür; etiket penceresi yazdırma / PNG için.
const qrOpen = ref(false)
const qrUrl = computed(() => (import.meta.client ? `${window.location.origin}/expert/equipment/${useRoute().params.id}` : ''))
definePageMeta({ layout: 'expert', middleware: 'expert' })

const STATUS_LABELS: Record<string, string> = { uygun: 'Uygun', uygun_degil: 'Uygun değil', rapor_bekleniyor: 'Rapor bekleniyor', belirtilmemis: 'Belirtilmemiş', rapor_yok: 'Rapor yok' }
const STATUS_ICONS: Record<string, string> = { uygun: 'pi pi-check-circle', uygun_degil: 'pi pi-times-circle', rapor_bekleniyor: 'pi pi-hourglass', rapor_yok: 'pi pi-clock', belirtilmemis: 'pi pi-question-circle' }
const SOURCE_LABELS: Record<string, string> = { manual: 'Elle', ai: 'Yapay zeka' }

// Tasarım kataloğu 06'da olmayan öğeler: katalogda yok, gizli; ileride açılabilir (kod yerinde).
const SHOW_PENDING_BUTTON = false // Kontroller'in yanında "Rapor bekleniyor" (listede satır menüsünde var)
const SHOW_HISTORY_EXTRA_COLUMNS = false // Kontroller tablosunda Kontrolü yapan, Sonuç ve kanaat, Kaynak, Kaydeden (bilgisi satır ayrıntısında)

const route = useRoute()
const router = useRouter()
const { get, post, patch, postForm, del, getBlob, errorMessage } = useExpertApi()

// Geri: geldiği sayfaya (Ekipmanlar listesi seçili kategori / tür / sekmesiyle, Tesisatlar, Analiz geçmişi...) döner;
// sayfa doğrudan açıldıysa Ekipmanlar.
const backPath = ref<string | null>(null)
const backLabel = computed(() => backPath.value?.startsWith('/expert/installations') ? 'Tesisatlar'
  : backPath.value?.startsWith('/expert/settings/analyses') ? 'Analiz geçmişi' : 'Ekipmanlar')
const backText = computed(() => ({ Tesisatlar: 'Tesisatlara dön', 'Analiz geçmişi': 'Analiz geçmişine dön' } as Record<string, string>)[backLabel.value] || 'Ekipmanlara dön')
const goBack = () => { if (backPath.value) router.back(); else navigateTo('/expert/equipment') }
const { groups, load: loadWorkplaces } = useMyWorkplaces()

const id = computed(() => String(route.params.id))
const equipment = ref<any>(null)
const loading = ref(true)
const loadError = ref('')

const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('tr-TR').format(new Date(value)) : '—'
const formatDateTime = (value?: string | null) => value ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'
const daysText = (days: number | null) => days === null || days === undefined ? '—' : days < 0 ? `${-days} gün geçti` : days === 0 ? 'Bugün' : `${days} gün`
const daysKey = (days: number | null) => days === null || days === undefined ? '' : days < 0 ? 'overdue' : days <= 30 ? 'soon' : 'ok'
const dueText = (days: number) => days < 0 ? `${-days} gün geçti` : days === 0 ? 'Bugün' : `${days} gün kaldı`

// --- Ekipman kartı: ad + no, marka model, konumun alt satırı (birim, alan, bulunduğu yer) ---
const title = computed(() => [equipment.value?.name || equipment.value?.type?.name, equipment.value?.code].filter(Boolean).join(' '))
const modelText = computed(() => [equipment.value?.brand, equipment.value?.model].filter(Boolean).join(' '))
const placeText = computed(() => [currentUnit.value?.name, currentArea.value?.label, equipment.value?.place].filter(Boolean).join(' · '))
// Son raporun bulguları (Açık bulgular kartı ve Bulgular sekmesi); Belgeler: kontrollerin rapor dosyaları.
const findings = computed<string[]>(() => equipment.value?.findings || [])

// --- Bulguların forklift resmindeki yeri (kaldırma ve iletme ekipmanı) ---
// shortcut: bulgunun parçası rapordan etiket olarak gelmiyor; metinde parça adının kelime başı olarak geçmesine bakılır (ilk eşleşen
// parça). Rapor okuma bulguya parça etiketi koyunca (ör. findings[].part) bu tablo yerine o kullanılmalı.
// x / y: resmin genişliği / yüksekliği içinde yüzde. Sıra önemli: özel olan önce (tepe lambası > lamba, direksiyon > direk).
const FORKLIFT_PARTS = [
  { key: 'zincir', label: 'Zincir', words: ['zincir'], x: 31.2, y: 29.6 },
  { key: 'catal', label: 'Çatal', words: ['çatal'], x: 10.5, y: 84 },
  { key: 'tepe', label: 'Tepe lambası', words: ['tepe lamba', 'tepe ışı', 'döner lamba', 'flaşör'], x: 83.3, y: 15.4 },
  { key: 'lamba', label: 'Lamba', words: ['lamba', 'ışık', 'ışığ', 'aydınlatma', 'sinyal'], x: 55.4, y: 20.4 },
  { key: 'arka-teker', label: 'Arka teker', words: ['arka teker', 'arka lastik'], x: 88.6, y: 77.2 },
  { key: 'teker', label: 'Teker', words: ['teker', 'lastik', 'jant', 'bijon'], x: 51, y: 77.2 },
  { key: 'fren', label: 'Fren', words: ['fren'], x: 47, y: 70 },
  { key: 'hidrolik', label: 'Hidrolik', words: ['hidrolik', 'silindir', 'hortum', 'kaçak', 'kaçağ', 'sızıntı'], x: 42.6, y: 55 },
  { key: 'direksiyon', label: 'Direksiyon', words: ['direksiyon', 'korna'], x: 54.5, y: 35.4 },
  { key: 'koltuk', label: 'Koltuk', words: ['koltuk', 'koltuğ', 'kemer'], x: 71.6, y: 39 },
  { key: 'tavan', label: 'Üst koruma', words: ['tavan', 'üst koruma', 'koruma çerçeve'], x: 66, y: 16 },
  { key: 'agirlik', label: 'Karşı ağırlık', words: ['karşı ağırlık'], x: 88, y: 60 },
  { key: 'direk', label: 'Direk', words: ['direk', 'direğ', 'mast', 'asansör'], x: 39.4, y: 14 }
]
// Harf olmayan karakterler boşluk; tek kelimelik anahtar kelime başında, çok kelimeli olan metnin içinde aranır.
const wordsOf = (text: string) => [...text.toLocaleLowerCase('tr-TR')].map(char => char.toLocaleUpperCase('tr-TR') !== char.toLocaleLowerCase('tr-TR') ? char : ' ').join('')
const partOf = (text: string) => {
  const plain = wordsOf(text)
  const tokens = plain.split(' ').filter(Boolean)
  return FORKLIFT_PARTS.find(part => part.words.some(word => word.includes(' ') ? plain.includes(word) : tokens.some(token => token.startsWith(word)))) || null
}
const findingPins = computed(() => {
  if (equipment.value?.category?.slug !== 'kaldirma-iletme') return []
  const pins = new Map<string, { key: string; label: string; x: number; y: number; texts: string[] }>()
  for (const text of findings.value) {
    const part = partOf(text)
    if (!part) continue
    const pin = pins.get(part.key) || { key: part.key, label: part.label, x: part.x, y: part.y, texts: [] }
    pin.texts.push(text)
    pins.set(part.key, pin)
  }
  return [...pins.values()]
})
if (import.meta.dev) {
  // Küçük kendini sınama: parça eşleşmesi (örnek bulgular)
  console.assert(partOf('Asansör orta zincir uzamış')?.key === 'zincir', 'zincir')
  console.assert(partOf('Ön mavi lamba yanmıyor')?.key === 'lamba', 'lamba')
  console.assert(partOf('Direksiyon boşluğu fazla')?.key === 'direksiyon', 'direksiyon')
  console.assert(partOf('Direği eğilmiş')?.key === 'direk', 'direk')
  console.assert(partOf('Farklı bir konu') === null, 'eşleşmeme')
}
const reportFiles = computed(() => (equipment.value?.inspections || []).filter((inspection: any) => inspection.has_report))

// --- Kontroller / Bulgular / Belgeler sekmeleri ---
const listTab = ref<'checks' | 'findings' | 'docs'>('checks')
const tabsCard = ref<HTMLElement | null>(null)
const showTab = (value: 'checks' | 'findings' | 'docs') => {
  listTab.value = value
  tabsCard.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// --- Kontrol planla: Kontrol takvimindeki plan penceresi bu ekipmanla açılır ---
const planOpen = ref(false)
const planInitial = computed(() => ({
  location_id: equipment.value?.location?.id ?? null,
  workplace_id: equipment.value?.workplace?.id ?? null,
  equipment_ids: equipment.value ? [equipment.value.id] : []
}))

// --- Kontrol satırının "Diğer işlemler" menüsü: ayrıntı, düzenle, sil. PrimeVue menüsü uygulamanın açık / koyu temasıyla. ---
const MENU_VARS = '--p-menu-background:var(--admin-surface);--p-menu-border-color:var(--admin-border);--p-menu-color:var(--admin-text);--p-menu-item-color:var(--admin-text);--p-menu-item-icon-color:var(--admin-muted);--p-menu-item-focus-background:var(--admin-hover);--p-menu-item-focus-color:var(--admin-heading);--p-menu-item-icon-focus-color:var(--admin-heading)'
const inspectionMenu = ref<any>(null)
const inspectionMenuItems = ref<any[]>([])
const openInspectionMenu = (event: Event, inspection: any) => {
  const locked = inspection.from_installation ? 'Tesisat raporundan geldi; Tesisatlar\'da o kontrol silinince silinir'
    : inspection.from_bulk ? 'Tüp kontrol formundan geldi; Kontrol Formları\'nda o form silinince silinir' : ''
  inspectionMenuItems.value = [
    { label: openAnalysis.value === inspection.id ? 'Ayrıntıları gizle' : 'Ayrıntılar', icon: 'pi pi-list', command: () => toggleAnalysis(inspection.id) },
    { label: 'Kontrol kaydını düzenle', icon: 'pi pi-pencil', command: () => { editingInspection.value = inspection } },
    locked
      ? { label: locked, icon: 'pi pi-lock', disabled: true }
      : { label: 'Kontrol kaydını sil', icon: 'pi pi-trash', command: () => removeInspection(inspection) }
  ]
  inspectionMenu.value?.toggle(event)
}

const load = async () => {
  loading.value = true
  loadError.value = ''
  try {
    equipment.value = await get(`/pk-equipment/${id.value}`)
    const locationId = equipment.value?.location?.id
    await Promise.all([loadAreas(locationId, true), loadUnits(locationId, true)])
  }
  catch (e: any) { loadError.value = errorMessage(e, 'Ekipman bulunamadı.') }
  finally { loading.value = false }
}

// --- Alan (isteğe bağlı): lokasyonda alan tanımlıysa gösterilir ve düzenlenir; yoksa hiç görünmez ---
const { options: areaOptions, assignments: areaAssignments, byId: areaById, load: loadAreas, setEquipmentArea } = useLocationAreas()
const currentAreaId = computed<number | null>(() => areaAssignments.value.equipment[String(id.value)] ?? null)
const currentArea = computed(() => currentAreaId.value ? areaById.value.get(currentAreaId.value) || null : null)
const selectableAreas = computed(() => areaOptions.value.filter(area => area.active || area.id === currentAreaId.value))

// --- Birim (isteğe bağlı): işyerinde birim tanımlıysa gösterilir; ekipmanın firmasını değiştirmez ---
const { assignments: unitAssignments, byId: unitById, load: loadUnits, unitsOf, setEquipmentUnit } = useOperationalUnits()
const currentUnitId = computed<number | null>(() => unitAssignments.value[String(id.value)] ?? null)
const currentUnit = computed(() => currentUnitId.value ? unitById.value.get(currentUnitId.value) || null : null)

// --- İşyeri adı: "Ad · Firma" ---
const { load: loadNames, workplaceLabel } = useWorkplaceNames()
const workplaceText = computed(() => equipment.value?.workplace ? workplaceLabel(equipment.value.workplace.id, equipment.value.workplace.company_name) : 'Lokasyon geneli')

// --- Fotoğraf ---
const photoInput = ref<HTMLInputElement | null>(null)
const photoBusy = ref(false)
const photoError = ref('')
const uploadPhoto = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  photoBusy.value = true
  photoError.value = ''
  const form = new FormData()
  form.append('photo', file)
  try { equipment.value = await postForm(`/pk-equipment/${id.value}/photo`, form) }
  catch (e: any) { photoError.value = errorMessage(e, 'Fotoğraf yüklenemedi.') }
  finally {
    photoBusy.value = false
    if (photoInput.value) photoInput.value.value = ''
  }
}
const removePhoto = async () => {
  if (!confirm('Fotoğraf kaldırılsın mı?')) return
  photoBusy.value = true
  try { equipment.value = await del(`/pk-equipment/${id.value}/photo`) }
  catch (e: any) { photoError.value = errorMessage(e, 'Fotoğraf kaldırılamadı.') }
  finally { photoBusy.value = false }
}

// --- Bilgileri düzenle ---
// Bilgileri düzenle penceresinin sekmeleri: Bilgiler | Teknik özellikler
const tab = ref<'info' | 'specs'>('info')
const editing = ref(false)
const savingEdit = ref(false)
const editError = ref('')
const editForm = reactive({ location_id: null as number | null, code: '', variant: '', name: '', brand: '', model: '', serial_no: '', place: '', notes: '', location_business_entity_id: null as number | null, pk_area_id: null as number | null, pk_operational_unit_id: null as number | null })
// Taşınabilecek lokasyonlar: kullanıcının lokasyonları (mevcut lokasyon listede yoksa o da eklenir).
const editLocations = computed(() => {
  const list = groups.value.map(group => ({ id: group.location_id, name: group.location_name }))
  const current = equipment.value?.location
  return current && !list.some(item => item.id === current.id) ? [{ id: current.id, name: current.name }, ...list] : list
})
const locationMoved = computed(() => editing.value && !!editForm.location_id && editForm.location_id !== equipment.value?.location?.id)
const editLocationName = computed(() => editLocations.value.find(item => item.id === editForm.location_id)?.name || '')
// Lokasyon değişince firma, birim ve alan eski lokasyona ait olduğundan boşalır.
const onEditLocation = () => {
  editForm.location_business_entity_id = null
  editForm.pk_operational_unit_id = null
  editForm.pk_area_id = null
}
const locationWorkplaces = computed(() => (groups.value.find(g => g.location_id === (editForm.location_id ?? equipment.value?.location?.id))?.items || [])
  .map(item => ({ id: item.id, company_name: item.company_name })))
const editUnits = computed(() => unitsOf(editForm.location_business_entity_id, currentUnitId.value))
// İşyeri değişince başka işyerinin birimi kalamaz.
const onEditWorkplace = () => {
  if (editForm.pk_operational_unit_id && !editUnits.value.some(unit => unit.id === editForm.pk_operational_unit_id)) editForm.pk_operational_unit_id = null
}
const startEdit = () => {
  const e = equipment.value
  Object.assign(editForm, {
    location_id: e.location?.id ?? null, code: e.code || '', variant: e.variant || '', name: e.name || '', brand: e.brand || '', model: e.model || '', serial_no: e.serial_no || '',
    place: e.place || '', notes: e.notes || '', location_business_entity_id: e.workplace?.id ?? null, pk_area_id: currentAreaId.value, pk_operational_unit_id: currentUnitId.value
  })
  editError.value = ''
  tab.value = 'info'
  editing.value = true
}
const saveEdit = async () => {
  if (locationMoved.value && !confirm(`Ekipman, kontrol kayıtları ve raporlarıyla birlikte "${editLocationName.value}" lokasyonuna taşınsın mı?`)) return
  const moved = locationMoved.value
  savingEdit.value = true
  editError.value = ''
  const clean = (v: string) => v.trim() || null
  try {
    equipment.value = await patch(`/pk-equipment/${id.value}`, {
      code: clean(editForm.code), name: clean(editForm.name), brand: clean(editForm.brand), model: clean(editForm.model),
      serial_no: clean(editForm.serial_no), place: clean(editForm.place), notes: clean(editForm.notes),
      location_business_entity_id: editForm.location_business_entity_id,
      ...(moved ? { location_id: editForm.location_id } : {}),
      ...(equipment.value.type?.variants?.length ? { variant: editForm.variant || null } : {})
    })
    // Birim ve alan değiştiyse ayrıca yazılır (firma yukarıda kaydedildi, bunlar firmayı değiştirmez); bilgiler yeniden alınır.
    const unitChanged = editForm.pk_operational_unit_id !== currentUnitId.value
    const areaChanged = areaOptions.value.length > 0 && editForm.pk_area_id !== currentAreaId.value
    if (unitChanged) await setEquipmentUnit(Number(id.value), editForm.pk_operational_unit_id)
    if (areaChanged) await setEquipmentArea(Number(id.value), editForm.pk_area_id)
    if (unitChanged || areaChanged || moved) await load()
    editing.value = false
  } catch (e: any) { editError.value = errorMessage(e, 'Bilgiler kaydedilemedi.') }
  finally { savingEdit.value = false }
}

// --- Periyodik kontrol raporu yükleme / rapor bekleniyor ---
const reportOpen = ref(false)
const pendingOpen = ref(false)
const editingInspection = ref<any>(null)
const onInspectionSaved = (data: any) => { equipment.value = data; reportOpen.value = false; pendingOpen.value = false; editingInspection.value = null }

// Yapay zeka ile okunan raporun kaydedilmiş analizi satırın altında açılır.
const openAnalysis = ref<number | null>(null)
const toggleAnalysis = (inspectionId: number) => { openAnalysis.value = openAnalysis.value === inspectionId ? null : inspectionId }

// Rapor dosyası yetkili istekle alınır ve yeni sekmede açılır (sekme, açılır pencere engeline takılmamak için önce açılır).
// Kontrol kaydını siler: rapor dosyası ve o rapordan gelen teknik özellik değerleri de silinir (özellikler önceki duruma döner).
const removeInspection = async (inspection: any) => {
  const label = [inspection.report_no && `rapor no ${inspection.report_no}`, `kontrol tarihi ${formatDate(inspection.control_date)}`].filter(Boolean).join(', ')
  if (!confirm(`Bu kontrol kaydı silinsin mi? (${label})\n\nRapor dosyası ve bu rapordan gelen teknik özellik değerleri de silinir; özellikler bir önceki duruma döner.`)) return
  try { equipment.value = await del(`/pk-equipment/${id.value}/inspections/${inspection.id}`) }
  catch (e: any) { alert(errorMessage(e, 'Kontrol kaydı silinemedi.')) }
}

const openReport = async (inspection: any) => {
  const tab = window.open('', '_blank')
  try {
    const blob = await getBlob(`/pk-equipment/${id.value}/inspections/${inspection.id}/report`)
    const blobUrl = URL.createObjectURL(blob)
    if (tab) tab.location.href = blobUrl
    else window.location.href = blobUrl
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
  } catch (e: any) {
    tab?.close()
    alert(errorMessage(e, 'Rapor açılamadı.'))
  }
}

// --- Pasife alma / aktife alma: geçmiş kalır ---
const reasons = DEACTIVATION_REASONS
const deactivateOpen = ref(false)
// Sayfa "yükleniyor"a düşmeden yenilenir.
const refresh = async () => { equipment.value = await get(`/pk-equipment/${id.value}`) }
const onDeactivated = async () => {
  deactivateOpen.value = false
  try { await refresh() } catch (e: any) { alert(errorMessage(e, 'Ekipman yenilenemedi.')) }
}
const activating = ref(false)
const activate = async () => {
  if (!confirm('Ekipman aktife alınsın mı?')) return
  activating.value = true
  try {
    await post('/pk-equipment/bulk-activate', { ids: [equipment.value.id] })
    await refresh()
  } catch (e: any) { alert(errorMessage(e, 'Aktife alınamadı.')) }
  finally { activating.value = false }
}

const removeEquipment = async () => {
  if (!confirm('Bu ekipman, fotoğrafı ve tüm kontrol kayıtları silinsin mi?')) return
  try {
    await del(`/pk-equipment/${id.value}`)
    await navigateTo('/expert/equipment')
  } catch (e: any) { loadError.value = errorMessage(e, 'Ekipman silinemedi.') }
}

onMounted(() => {
  // Uygulama içinden gelindiyse önceki sayfanın adresi (vue-router geçmiş kaydı).
  const back = window.history.state?.back
  backPath.value = typeof back === 'string' && back.startsWith('/expert') ? back : null
  load()
  loadWorkplaces()
  loadNames()
})
</script>

<style scoped>
.profile-page { margin: 0 auto; display: grid; gap: 18px; }
.card{background:var(--admin-card);border:1px solid var(--admin-border);border-radius:16px;min-width:0;box-shadow:0 10px 28px rgba(var(--pk-shadow-rgb),.05)}
.state{padding:50px 20px;text-align:center;color:var(--admin-muted);font-size:14px}
/* Üst sıra: başlık + ekipman kartı, çizim, yan kartlar */
.top{display:grid;grid-template-columns:minmax(300px,370px) minmax(0,1fr) minmax(320px,430px);gap:16px;align-items:start}
.crumb{display:flex;align-items:center;gap:8px;margin-bottom:8px;color:var(--admin-muted);font-size:13px}
.crumb a{color:var(--admin-muted)}.crumb a:hover{color:var(--admin-heading)}
.crumb strong{color:var(--admin-heading);font-weight:600}.crumb .pi-angle-right{font-size:11px}
h1{margin:0;color:var(--admin-heading);font-size:40px;font-weight:800;line-height:1.15;letter-spacing:-1px}.lead{margin:7px 0 0;color:var(--admin-muted);font-size:15px}
h2{margin:0;color:var(--admin-heading);font-size:18px}
h3{margin:0;color:var(--admin-heading);font-size:18px;font-weight:800}
.info-card{display:flex;flex-direction:column;gap:12px;margin-top:20px;padding:20px}
.back-link{display:inline-flex;align-items:center;gap:9px;width:max-content;color:var(--admin-heading);font-size:15px;font-weight:600;text-decoration:none}.back-link:hover{color:var(--admin-accent-text)}
.title-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:6px}
.title-row h2{font-size:30px;font-weight:800;letter-spacing:-.5px;overflow-wrap:anywhere}
.active-pill{flex:none;display:inline-flex;align-items:center;gap:7px;padding:5px 13px;border-radius:999px;background:var(--admin-success-bg);color:var(--admin-success-text);font-size:14px;font-weight:700}
.active-pill .dot{width:8px;height:8px;border-radius:50%;background:currentColor}
.active-pill.passive{background:var(--admin-chip);color:var(--admin-muted)}
.model{margin:-6px 0 0;color:var(--admin-heading);font-size:18px;font-weight:700}
.tag{display:inline-block;margin-left:8px;padding:2px 10px;border-radius:999px;border:1px solid var(--admin-border);background:var(--admin-soft);color:var(--admin-text);font-size:12px;font-weight:700;vertical-align:middle}
.facts{display:grid;margin:0;border-top:1px solid var(--admin-border)}
.facts > div{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:11px 0;border-bottom:1px solid var(--admin-row-border)}
.facts > div:last-child{border-bottom:0}
.facts dt{display:flex;align-items:center;gap:12px;color:var(--admin-text);font-size:14px;white-space:nowrap}
.facts dt i{width:18px;color:var(--admin-heading);font-size:16px;text-align:center}
.facts div:nth-child(3) dt i{color:var(--admin-warning-text)}
.facts dd{display:flex;flex-direction:column;align-items:flex-end;gap:2px;margin:0;color:var(--admin-heading);font-size:15px;font-weight:700;text-align:right;overflow-wrap:anywhere}
.facts dd small{color:var(--admin-muted);font-size:12px;font-weight:500}
.due-pill{align-self:center;display:inline-flex;align-items:center;gap:9px;padding:7px 18px;border-radius:12px;background:var(--admin-chip);color:var(--admin-text);font-size:16px;font-weight:700}
.due-pill.soon,.due-pill.ok{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.due-pill.overdue{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.info-card .primary-button{width:100%;min-height:46px;font-size:15px}
.hero{position:relative;min-width:0;margin:-10px 0 0;display:flex;justify-content:center}
.hero-art{position:relative;width:min(100%,600px);margin-top:40px}
.hero-art img{display:block;width:100%}
/* Bulgu işareti: parçanın üstünde nokta, yanında parça adı */
.pin{position:absolute;display:flex;align-items:center;gap:6px;padding:0;border:0;background:none;transform:translate(-11px,-11px);cursor:pointer}
.pin-dot{width:22px;height:22px;display:grid;place-items:center;border:3px solid #fff;border-radius:50%;background:var(--pk-danger);color:#fff;font-size:11px;font-weight:800;box-shadow:0 0 0 6px rgba(239,68,68,.25)}
.pin-label{padding:3px 9px;border-radius:999px;background:var(--admin-surface);color:var(--admin-heading);font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 4px 12px rgba(var(--pk-shadow-rgb),.18)}
.pin.flip{flex-direction:row-reverse;transform:translate(calc(-100% + 11px),-11px)}
.pin:hover .pin-label,.pin:focus-visible .pin-label{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.status-float{position:absolute;top:0;right:8%;z-index:1;display:inline-flex;align-items:center;gap:10px;padding:10px 20px;border-radius:999px;background:var(--admin-chip);color:var(--admin-muted);font-size:19px;font-weight:700;box-shadow:0 10px 28px rgba(var(--pk-shadow-rgb),.12)}
.status-float i{font-size:20px}
.status-float.uygun{background:var(--admin-success-bg);color:var(--admin-success-text)}.status-float.uygun_degil{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.status-float.rapor_bekleniyor{background:var(--admin-warning-bg);color:var(--admin-warning-text)}
.top-right{display:grid;gap:14px;margin-top:30px}
.side-card{display:grid;gap:12px;padding:18px 20px}
.side-card header{display:flex;align-items:center;gap:12px}
.side-card header i{font-size:20px}.warn-icon{color:var(--admin-warning-text)}.accent-icon{color:var(--admin-accent-text)}
.count-badge{margin-left:auto;min-width:34px;padding:3px 10px;border-radius:999px;background:var(--admin-danger-bg);color:var(--admin-danger-text);font-size:15px;font-weight:800;text-align:center}
.count-badge.none{background:var(--admin-chip);color:var(--admin-muted)}
.finding-list{display:grid;gap:8px;margin:0;padding:0;list-style:none}
.finding-list li{display:flex;align-items:flex-start;gap:12px;color:var(--admin-heading);font-size:15px;line-height:1.4}
.finding-list .dot{flex:none;width:8px;height:8px;margin-top:7px;border-radius:50%;background:var(--pk-danger)}
.timeline{display:grid;gap:10px;margin:0;padding:0 0 0 18px;list-style:none;border-left:2px solid var(--admin-accent-soft)}
.timeline li{position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;color:var(--admin-text);font-size:14px}
.timeline li::before{content:'';position:absolute;left:-25px;top:50%;width:10px;height:10px;margin-top:-5px;border-radius:50%;background:var(--pk-accent)}
.timeline strong{color:var(--admin-heading);font-size:15px}.timeline .status-badge{margin-left:auto}
.qr-body{display:flex;align-items:center;gap:18px}
.qr-image{flex:none;padding:6px;border:1px solid var(--admin-border);border-radius:10px;background:#fff;cursor:pointer;line-height:0}
.qr-image:hover{border-color:var(--pk-accent)}
.soft-button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:46px;padding:0 16px;border:0;border-left:1px solid var(--admin-border);border-radius:10px;background:var(--admin-accent-soft);color:var(--admin-accent-text);font:inherit;font-size:15px;font-weight:700;cursor:pointer}
.soft-button:hover{box-shadow:inset 0 0 0 1px var(--pk-accent)}
.passive-note{display:flex;align-items:flex-start;gap:8px;margin:0;padding:12px 14px;border-radius:10px;background:var(--admin-chip);color:var(--admin-text);font-size:13px;line-height:1.5}.passive-note i{margin-top:2px;color:var(--admin-muted)}.passive-note strong{color:var(--admin-heading)}
/* Kontroller / Bulgular / Belgeler */
.tabs-card{overflow:hidden;scroll-margin-top:90px}
.tabs-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:6px 18px 0;border-bottom:1px solid var(--admin-border)}
.tabs{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.tabs button{display:inline-flex;align-items:center;gap:9px;padding:14px;border:0;border-bottom:3px solid transparent;margin-bottom:-1px;background:none;color:var(--admin-heading);font:inherit;font-size:16px;font-weight:600;cursor:pointer}
.tabs button i{color:var(--admin-muted);font-size:16px}
.tabs button:hover{color:var(--admin-accent-text)}.tabs button.active{color:var(--admin-accent-text);border-bottom-color:var(--pk-yellow);font-weight:700}.tabs button.active i{color:var(--admin-accent-text)}
.history-actions{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:8px 0}
.bound-note{display:inline-flex;align-items:center;gap:6px;color:var(--admin-muted);font-size:13px}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:42px;padding:0 18px;border:0;border-radius:10px;background:var(--pk-yellow);color:var(--pk-on-accent);font:inherit;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 8px 20px rgba(var(--pk-accent-rgb),.22)}.primary-button:hover{background:var(--pk-yellow-dark)}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.outline-button{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:42px;padding:0 16px;border:1px solid var(--admin-border);border-radius:10px;background:var(--admin-card);color:var(--admin-heading);font:inherit;font-size:14px;font-weight:700;cursor:pointer;text-decoration:none}
.outline-button i{color:var(--admin-accent-text)}.outline-button:hover{border-color:var(--admin-muted)}
.secondary-button{display:inline-flex;align-items:center;gap:7px;min-height:38px;padding:0 14px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:13px;font-weight:700;cursor:pointer}.secondary-button:disabled{opacity:.6}
.link-button{display:inline-flex;align-items:center;gap:6px;width:max-content;padding:0;border:0;background:none;color:var(--admin-link);font:inherit;font-size:15px;font-weight:700;cursor:pointer}.link-button.danger{color:var(--admin-danger-text);font-size:13px}
.table-wrap{overflow:auto;padding:12px 18px 6px}
table{width:100%;border-collapse:collapse}th,td{padding:14px 16px;text-align:left;border-bottom:1px solid var(--admin-row-border);font-size:14px;color:var(--admin-text);vertical-align:middle}
th{font-size:15px;font-weight:700;color:var(--admin-heading);background:var(--admin-soft);white-space:nowrap;border-bottom:0}
thead th:first-child{border-radius:12px 0 0 12px}thead th:last-child{border-radius:0 12px 12px 0}
tbody tr:last-child td{border-bottom:0}td strong{color:var(--admin-heading)}
.date{font-size:16px}
.report-no{display:block;color:var(--admin-heading);font-size:15px;font-weight:700}
.ai-note{display:inline-flex;align-items:center;gap:6px;margin-top:3px;color:var(--admin-muted);font-size:12px;font-style:italic}.ai-note i{color:var(--admin-accent-text);font-style:normal}
.count-link{font-size:16px;color:var(--admin-heading)}.count-link:hover{color:var(--admin-link)}
.pdf-button{width:40px;height:40px;display:grid;place-items:center;border:1px solid var(--admin-border);border-radius:10px;background:var(--admin-card);color:var(--admin-accent-text);cursor:pointer}.pdf-button i{font-size:18px}.pdf-button:hover{border-color:var(--pk-accent)}
.actions-col{width:1%}
.icon-button{width:36px;height:36px;display:grid;place-items:center;border:0;border-radius:10px;background:transparent;color:var(--admin-accent-text);cursor:pointer}.icon-button:hover{background:var(--admin-accent-soft)}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.status-badge{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap}.status-badge.big{padding:6px 14px;font-size:14px}
.status-badge.uygun{background:var(--admin-success-bg);color:var(--admin-success-text)}.status-badge.uygun_degil{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.status-badge.rapor_bekleniyor{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.status-badge.rapor_yok,.status-badge.belirtilmemis{background:var(--admin-chip);color:var(--admin-muted)}
.current-tag{margin-left:8px;padding:1px 7px;border-radius:999px;background:var(--admin-chip);color:var(--admin-muted);font-size:10px;font-weight:700}
.body-cell{min-width:160px;max-width:240px}.note-cell{min-width:200px;max-width:420px;white-space:pre-line}.muted-cell{color:var(--admin-muted);white-space:nowrap}.block{display:block;margin-top:2px}
.clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.analysis-row td{background:var(--admin-soft);padding:16px 18px}
.detail-meta{display:flex;flex-wrap:wrap;gap:6px 18px;margin:0 0 12px;color:var(--admin-muted);font-size:12px}
.inspection-detail{display:grid;gap:12px;margin-bottom:14px}.inspection-detail h4,.analysis-title{display:flex;align-items:center;gap:6px;margin:0 0 6px;color:var(--admin-heading);font-size:13px}
.inspection-detail p{margin:0;color:var(--admin-text);font-size:13px;line-height:1.5;white-space:pre-line}
.inspection-detail ol{margin:0;padding-left:20px;display:grid;gap:4px;color:var(--admin-text);font-size:13px;line-height:1.45}
.analysis-title{padding-top:12px;border-top:1px solid var(--admin-border)}
.tab-body{padding:16px 18px 18px}
.tab-hint{margin:0 0 10px;color:var(--admin-muted);font-size:13px}
.finding-rows{display:grid;gap:0;margin:0;padding:0;list-style:none;border:1px solid var(--admin-row-border);border-radius:12px}
.finding-rows li{display:flex;align-items:center;gap:14px;padding:12px 16px;color:var(--admin-heading);font-size:15px;line-height:1.45}
.finding-rows li + li{border-top:1px solid var(--admin-row-border)}
.finding-rows .bar{flex:none;width:4px;height:20px;border-radius:4px;background:var(--admin-danger-text)}
.doc-list{display:grid;margin:0;padding:0;list-style:none;border:1px solid var(--admin-row-border);border-radius:12px}
.doc-list li{display:flex;align-items:center;gap:14px;padding:10px 16px}.doc-list li + li{border-top:1px solid var(--admin-row-border)}
.doc-text{flex:1;display:grid;gap:2px;min-width:0}.doc-text strong{color:var(--admin-heading);font-size:15px;overflow-wrap:anywhere}.doc-text small{color:var(--admin-muted);font-size:12px}
.muted{margin:0;color:var(--admin-muted);font-size:14px}
.error-text{margin:8px 0 0;color:var(--admin-danger-text);font-size:12px}
/* Bilgileri düzenle penceresi */
.modal-backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:var(--admin-overlay)}
.modal-card{width:min(720px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:22px;background:var(--admin-surface);border-radius:14px;box-shadow:0 20px 60px var(--admin-shadow)}
.modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:10px}.modal-head h2{font-size:20px}.modal-head p{margin:5px 0 0;color:var(--admin-muted);font-size:13px}
.close-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:var(--admin-muted);cursor:pointer;border-radius:7px}.close-button:hover{background:var(--admin-hover);color:var(--admin-heading)}
.modal-tabs{margin-bottom:14px;border-bottom:1px solid var(--admin-border)}.modal-tabs button{padding:10px 12px;font-size:14px}
.count{margin-left:2px;padding:1px 7px;border-radius:999px;background:var(--admin-chip);color:var(--admin-muted);font-size:11px}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px}
.form-grid label{display:block;color:var(--admin-heading);font-size:12px;font-weight:700}.wide{grid-column:1 / -1}
.form-grid input,.form-grid select,.form-grid textarea{display:block;width:100%;margin-top:6px;padding:0 10px;height:40px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:13px;outline:0}
.form-grid textarea{height:auto;padding:9px 10px;resize:vertical}
.form-grid input:focus,.form-grid select:focus,.form-grid textarea:focus{border-color:var(--pk-accent);box-shadow:0 0 0 3px var(--pk-focus-ring)}
.hint-text{margin:10px 0 0;color:var(--admin-muted);font-size:12px;line-height:1.5}
.photo-row{display:flex;align-items:center;gap:14px;margin-top:14px;padding-top:14px;border-top:1px solid var(--admin-border)}
.photo{flex:none;width:96px;height:72px;display:grid;place-items:center;overflow:hidden;border:1px solid var(--admin-border);border-radius:10px;background:var(--admin-soft);color:var(--admin-muted)}
.photo img{width:100%;height:100%;object-fit:cover;display:block}.photo i{font-size:24px}
.photo-actions{display:grid;gap:6px}.photo-actions strong{color:var(--admin-heading);font-size:12px}.photo-actions > div{display:flex;align-items:center;gap:12px}
.modal-actions{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:10px;margin-top:20px;padding-top:16px;border-top:1px solid var(--admin-border)}
.modal-actions-left{display:flex;align-items:center;gap:14px;margin-right:auto}
@media(max-width:1300px){.top{grid-template-columns:minmax(280px,360px) minmax(0,1fr)}.top-right{grid-column:1 / -1;grid-template-columns:repeat(3,minmax(0,1fr));margin-top:0}}
@media(max-width:1000px){.top-right{grid-template-columns:minmax(0,1fr)}}
@media(max-width:800px){.top{grid-template-columns:minmax(0,1fr)}.hero{display:none}.info-card{margin-top:6px}h1{font-size:32px}.form-grid{grid-template-columns:1fr}.tabs-row{padding-bottom:8px}}
</style>
