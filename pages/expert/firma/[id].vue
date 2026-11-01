<template>
  <div class="firm-detail">
    <NuxtLink to="/expert/workplaces" class="back"><i class="pi pi-arrow-left" /> Firmalarım</NuxtLink>

    <div v-if="loading" class="state">Yükleniyor...</div>
    <div v-else-if="error && !firm" class="state error">{{ error }}<button class="secondary-button" type="button" @click="load">Tekrar Dene</button></div>

    <template v-else-if="firm">
      <div class="page-head">
        <div>
          <h1>{{ firm.name }}</h1>
          <p><span v-if="firm.type" class="chip">{{ customerTypeLabel(firm.type) }}</span> {{ locations.length }} lokasyon</p>
        </div>
      </div>

      <p v-if="error" class="form-error" role="alert">{{ error }}</p>

      <div class="firm-layout" :class="{ 'has-tree': canBranch }">
        <aside v-if="canBranch && nodes.length" class="card tree-card">
          <div class="tree-head">
            <h2>Organizasyon</h2>
            <div class="view-toggle" role="group" aria-label="Görünüm">
              <button type="button" :class="{ on: treeView === 'yer' }" :aria-pressed="treeView === 'yer'" @click="treeView = 'yer'">Yere göre</button>
              <button type="button" :class="{ on: treeView === 'firma' }" :aria-pressed="treeView === 'firma'" @click="treeView = 'firma'">Firmaya göre</button>
            </div>
          </div>
          <template v-if="treeView === 'yer'">
            <p>Lokasyona tıklayın: içindeki işyerleri yanda açılır, hemen ekleyebilirsiniz. Yeni grup ya da lokasyon için <strong>+ Ekle</strong>.</p>
            <ul class="tree">
              <ExpertFirmNode
                v-for="node in nodes" :key="node.id" :node="node" :depth="0" :locations="locations" :firms-of="firmsOf"
                :selected-id="selected?.id ?? null" :selected-location-id="selectedLocation?.id ?? null"
                @select="selectNode($event)" @add="startAdd" @select-location="selectLocation($event)"
              />
            </ul>
          </template>
          <template v-else>
            <p>Aynı firmanın hangi lokasyonlarda işyeri olduğunu gösterir. Satıra tıklayınca o lokasyon açılır.</p>
            <p v-if="!byCompany.length" class="empty">Henüz işyeri yok.</p>
            <div v-for="group in byCompany" :key="group.company" class="company-group">
              <div class="company-head"><strong>{{ group.company }}</strong><small>{{ group.items.length }} işyeri</small></div>
              <button v-for="item in group.items" :key="item.id" class="company-item" :class="{ on: String(selectedLocation?.id) === String(item.location.id) }" type="button" @click="selectLocation(item.location)">
                <span>{{ item.title }}</span><small>{{ item.location.name }}</small>
              </button>
            </div>
          </template>
        </aside>

        <!-- Lokasyon seçili: işyerleri tablosu ve satır içi ekleme. Eşleştirme (firma ↔ lokasyon) eklerken yapılır. -->
        <section v-if="selectedLocation" class="card detail">
          <nav class="crumbs" aria-label="Bulunduğunuz yer">
            <template v-for="item in path" :key="item.id">
              <button type="button" @click="selectNode(item)">{{ item.name }}</button>
              <i class="pi pi-angle-right" />
            </template>
            <span>{{ selectedLocation.name }}</span>
          </nav>
          <div class="detail-head">
            <div class="location-title">
              <h2>{{ selectedLocation.name }}</h2>
              <small><template v-if="selectedLocation.city">{{ selectedLocation.city }}<template v-if="selectedLocation.district"> / {{ selectedLocation.district }}</template> · </template>{{ locationWorkplaces.length }} işyeri</small>
            </div>
            <div class="head-buttons">
              <button v-if="locationWorkplaces.length" class="row-button" type="button" @click="goEquipment(selectedLocation)"><i class="pi pi-wrench" /> Ekipmanlar</button>
              <button class="detail-delete" type="button" @click="openRemove({ name: selectedLocation.name, location: selectedLocation })"><i class="pi pi-trash" /> Sil</button>
            </div>
          </div>

          <div class="wp-wrap">
            <table class="wp-table">
              <thead><tr><th scope="col">İşyeri</th><th v-if="showCompanyColumn" scope="col">{{ companyWord }}</th><th scope="col">SGK sicil no</th><th scope="col">Tehlike sınıfı</th></tr></thead>
              <tbody>
                <tr v-for="workplace in locationWorkplaces" :key="workplace.id" :class="{ fresh: freshIds.includes(workplace.id) }">
                  <td><strong>{{ nameOf(workplace.id) || workplace.company_name }}</strong></td>
                  <td v-if="showCompanyColumn"><span class="company-chip">{{ workplace.company_name }}</span></td>
                  <td :class="{ muted: !workplace.sgk_workplace_number }">{{ workplace.sgk_workplace_number || 'Girilmedi' }}</td>
                  <td><span class="hazard-badge" :class="hazardClassKey(workplace.hazard_class)">{{ workplace.hazard_class }}</span></td>
                </tr>
                <tr v-if="!locationWorkplaces.length"><td :colspan="showCompanyColumn ? 4 : 3" class="empty-cell">Bu lokasyonda henüz işyeri yok. Hemen aşağıdan ekleyin.</td></tr>
              </tbody>
            </table>
          </div>

          <p v-if="rowNotice" class="row-notice" role="status"><i class="pi pi-check-circle" /> {{ rowNotice }}</p>

          <form class="add-row" @submit.prevent="saveRow">
            <div class="add-row-head">
              <h3>{{ selectedLocation.name }} içine işyeri ekle</h3>
              <button class="link-button" type="button" @click="toggleBulk">{{ bulk ? 'Tek tek ekle' : 'Toplu ekle (her satıra bir işyeri)' }}</button>
            </div>
            <div class="add-grid">
              <label v-if="!bulk" class="field">İşyeri adı <small v-if="!nameRequired">(isteğe bağlı)</small><span v-else class="req">*</span>
                <input ref="rowNameInput" v-model="row.name" type="text" :placeholder="nameRequired ? 'Örn. Antrepo' : 'Örn. Antrepo · boşsa firma adı görünür'" />
              </label>
              <label v-if="firm.type === 'corporate'" class="field">Hangi firma adına? <span class="req">*</span>
                <select v-model="companyChoice">
                  <option v-for="name in companyOptions" :key="name" :value="name">{{ name }}</option>
                  <option value="__new">+ Yeni firma ekle…</option>
                </select>
              </label>
              <label v-if="firm.type === 'corporate' && companyChoice === '__new'" class="field">Yeni firmanın ünvanı <span class="req">*</span>
                <input v-model="newCompany" type="text" placeholder="Örn. Arçelik Pazarlama A.Ş." />
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
            </div>
            <div class="nace-line">
              <button class="link-button" type="button" @click="naceOpen = !naceOpen">{{ naceOpen ? 'NACE aramasını kapat' : 'Tehlike sınıfını NACE\'den bul' }}</button>
              <span v-if="row.naceCode" class="nace-picked"><i class="pi pi-check-circle" /> {{ row.naceCode }} {{ row.activity }}</span>
            </div>
            <div v-if="naceOpen" class="nace-box">
              <input v-model="naceQuery" type="text" placeholder="Faaliyeti ya da NACE kodunu yazın: depolama, 52.10" autocomplete="off" @input="searchNace" />
              <ul v-if="naceResults.length" class="nace-results" aria-label="NACE sonuçları">
                <li v-for="item in naceResults" :key="item.id"><button type="button" @click="selectNace(item)"><strong>{{ item.nace_code }}</strong> {{ item.activity_name }} <em>{{ item.hazard_class }}</em></button></li>
              </ul>
            </div>
            <label v-if="bulk" class="field">Her satıra bir işyeri adı yazın (Excel'den yapıştırabilirsiniz)
              <textarea v-model="bulkText" rows="4" placeholder="Beyaz Eşya Depo&#10;Antrepo&#10;Yedek Parça Deposu" />
            </label>
            <p v-if="rowError" class="form-error" role="alert">{{ rowError }}</p>
            <div class="add-actions">
              <button class="primary-button" type="submit" :disabled="rowSaving || limitFull"><i class="pi pi-plus" /> {{ rowSaving ? 'Ekleniyor...' : bulk ? 'Hepsini ekle' : 'Ekle' }}</button>
              <small>{{ firm.type === 'corporate' ? 'Firma seçimi bir sonraki kayıt için hatırlanır.' : 'Eklenen işyeri tabloya hemen düşer.' }}</small>
            </div>
          </form>
        </section>

        <section v-else-if="selected" class="card detail">
          <nav v-if="path.length > 1" class="crumbs" aria-label="Bulunduğunuz yer">
            <template v-for="(item, index) in path" :key="item.id">
              <i v-if="index" class="pi pi-angle-right" />
              <button type="button" :disabled="index === path.length - 1" @click="selectNode(item)">{{ item.name }}</button>
            </template>
          </nav>
          <div class="detail-head">
            <h2>{{ selected.name }}</h2>
            <button v-if="path.length > 1" class="detail-delete" type="button" @click="openRemove({ name: selected.name, node: selected })"><i class="pi pi-trash" /> Sil</button>
          </div>

          <div class="actions">
            <button class="action main" type="button" @click="openLocation(selected)">
              <i class="pi pi-map-marker" /><span><strong>Lokasyon Ekle</strong><small>Bina, kampüs, fabrika ya da şube. Eklenince içine işyerlerini girersiniz.</small></span>
            </button>
            <button v-if="canBranchAt(selected)" class="action" type="button" @click="openNode(selected)">
              <i class="pi pi-sitemap" /><span><strong>{{ branchLabel(selected) }}</strong><small>{{ firm.type === 'public' ? 'Bu kurumun altındaki birim.' : path.length === 1 ? 'Bu firmanın altındaki grup ya da şirket.' : 'Bu grubun altındaki şirket.' }}</small></span>
            </button>
          </div>

          <h3>Buradaki lokasyonlar</h3>
          <ul v-if="selectedLocations.length" class="rows">
            <li v-for="location in selectedLocations" :key="location.id" class="location-row">
              <i class="pi pi-map-marker" />
              <div class="location-text">
                <strong>{{ location.name }}</strong>
                <small v-if="location.city">{{ location.city }}<template v-if="location.district"> / {{ location.district }}</template></small>
                <small v-if="!workplacesOf(location).length" class="no-firm">Henüz işyeri yok.</small>
                <div v-else-if="firm.type === 'corporate'" class="firms">
                  <span v-for="workplace in workplacesOf(location)" :key="workplace.id" class="firm">{{ nameOf(workplace.id) ? `${nameOf(workplace.id)} · ${workplace.company_name}` : workplace.company_name }}</span>
                </div>
              </div>
              <button class="row-button" :class="{ warn: !workplacesOf(location).length }" type="button" @click="selectLocation(location)">
                <i :class="workplacesOf(location).length ? 'pi pi-list' : 'pi pi-plus'" /> {{ workplacesOf(location).length ? 'İşyerleri' : 'İşyeri Ekle' }}
              </button>
              <button v-if="workplacesOf(location).length" class="row-button" type="button" @click="goEquipment(location)"><i class="pi pi-wrench" /> Ekipmanlar</button>
              <button class="row-button icon" type="button" :aria-label="`${location.name} lokasyonunu sil`" title="Sil" @click="openRemove({ name: location.name, location })"><i class="pi pi-trash" /></button>
            </li>
          </ul>
          <p v-else class="empty">Burada henüz lokasyon yok. Yukarıdaki "Lokasyon Ekle" ile ekleyebilirsiniz.</p>

          <template v-if="selected.children?.length">
            <h3>{{ firm.type === 'public' ? 'Altındaki birimler' : 'Altındaki gruplar ve şirketler' }}</h3>
            <ul class="rows">
              <li v-for="child in selected.children" :key="child.id">
                <button class="child-row" type="button" @click="selectNode(child)"><i class="pi pi-sitemap" /><strong>{{ child.name }}</strong><i class="pi pi-angle-right" /></button>
              </li>
            </ul>
          </template>
        </section>
        <section v-else class="card"><div class="state">Bu firmanın yapısı boş. <button class="link-button" type="button" @click="repairRoot">Düzelt</button></div></section>
      </div>

      <section class="other">
        <details>
          <summary>Diğer işlemler</summary>
          <div class="other-body">
            <NuxtLink to="/expert/settings/locations" class="other-link"><i class="pi pi-cog" /> Lokasyonları ayrıntılı düzenle</NuxtLink>
            <NuxtLink to="/expert/settings/customers" class="other-link"><i class="pi pi-pencil" /> Firma adını ya da yapısını düzenle</NuxtLink>
            <button class="other-link danger" type="button" @click="openDelete"><i class="pi pi-trash" /> Firmayı sil</button>
          </div>
        </details>
      </section>
    </template>

    <!-- Ağaçtaki + Ekle: ne ekleneceği açıklamasıyla seçilir -->
    <div v-if="addChoice" class="modal-backdrop">
      <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="choice-title">
        <div class="modal-head">
          <span class="head-icon"><i class="pi pi-plus" /></span>
          <div><h2 id="choice-title">Ne eklemek istiyorsunuz?</h2><p>{{ addChoice.name }} altına eklenecek.</p></div>
          <button class="close-button" type="button" aria-label="Kapat" @click="addChoice = null"><i class="pi pi-times" /></button>
        </div>
        <div class="choice-list">
          <button class="action main" type="button" @click="chooseLocation">
            <i class="pi pi-map-marker" /><span><strong>Lokasyon</strong><small>Bina, fabrika ya da şube gibi bir yer. Firmalar burada çalışır.</small></span>
          </button>
          <button class="action" type="button" @click="chooseNode">
            <i class="pi pi-sitemap" /><span><strong>{{ firm?.type === 'public' ? 'Birim' : isRoot(addChoice) ? 'Grup ya da şirket' : 'Şirket' }}</strong><small>{{ firm?.type === 'public' ? 'Kurumun bir bölümü. Örneğin itfaiye müdürlüğü.' : 'Organizasyondaki bir parça. Altına lokasyon bağlayabilirsiniz.' }}</small></span>
          </button>
        </div>
      </section>
    </div>

    <!-- Lokasyon ekle -->
    <div v-if="locationNode" class="modal-backdrop">
      <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="location-title">
        <div class="modal-head">
          <span class="head-icon"><i class="pi pi-map-marker" /></span>
          <div><h2 id="location-title">Lokasyon Ekle</h2><p>{{ locationNode.name }} altına bağlanacak. Kaydedince doğrudan içine işyeri eklemeye geçersiniz.</p></div>
          <button class="close-button" type="button" aria-label="Kapat" :disabled="saving" @click="closeLocation"><i class="pi pi-times" /></button>
        </div>
        <ExpertFirmLocationFields :draft="draft" location-only autofocus />
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
        <div class="modal-actions">
          <button class="secondary-button" type="button" :disabled="saving" @click="closeLocation">İptal</button>
          <button class="primary-button" type="button" :disabled="!canSaveLocation || saving" @click="saveLocation">{{ saving ? 'Ekleniyor...' : 'Devam Et' }}</button>
        </div>
      </section>
    </div>

    <!-- Grup / şirket / birim ekle -->
    <div v-if="nodeParent" class="modal-backdrop">
      <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="node-title">
        <div class="modal-head">
          <span class="head-icon"><i class="pi pi-sitemap" /></span>
          <div><h2 id="node-title">{{ branchLabel(nodeParent) }}</h2><p>{{ nodeParent.name }} altına eklenecek.</p></div>
          <button class="close-button" type="button" aria-label="Kapat" :disabled="saving" @click="nodeParent = null"><i class="pi pi-times" /></button>
        </div>
        <label class="field">{{ firm?.type === 'public' ? 'Birimin adı' : isRoot(nodeParent) ? 'Grubun ya da şirketin adı' : 'Şirketin adı' }} <span class="req">*</span>
          <input ref="nodeInput" v-model="nodeName" type="text" :placeholder="firm?.type === 'public' ? 'Örn. İtfaiye Müdürlüğü' : isRoot(nodeParent) ? 'Örn. Enerji Grubu ya da ABC Enerji A.Ş.' : 'Örn. ABC Enerji A.Ş.'" @keydown.enter.prevent="saveNode" />
        </label>
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
        <div class="modal-actions">
          <button class="secondary-button" type="button" :disabled="saving" @click="nodeParent = null">İptal</button>
          <button class="primary-button" type="button" :disabled="!nodeName.trim() || saving" @click="saveNode">{{ saving ? 'Ekleniyor...' : 'Ekle' }}</button>
        </div>
      </section>
    </div>

    <!-- Grup, şirket ya da lokasyonu sil -->
    <div v-if="removing" class="modal-backdrop">
      <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="remove-title">
        <div class="modal-head">
          <span class="head-icon danger"><i class="pi pi-trash" /></span>
          <div><h2 id="remove-title">{{ removing.location ? 'Lokasyonu Sil' : 'Sil' }}</h2><p>"{{ removing.name }}"</p></div>
          <button class="close-button" type="button" aria-label="Kapat" :disabled="deleting" @click="removing = null"><i class="pi pi-times" /></button>
        </div>
        <p v-if="removeChecking" class="muted">Kayıtlar kontrol ediliyor...</p>
        <template v-else-if="removeWarn">
          <p class="delete-warn"><i class="pi pi-exclamation-triangle" /> {{ removeWarn }}</p>
          <label class="field">Onaylamak için adını yazın<input v-model="removeConfirm" type="text" :placeholder="removing.name" /></label>
        </template>
        <p v-else-if="!formError" class="muted">Bu kayıtta ekipman, tesisat ya da rapor yok. Silinince geri alınamaz.</p>
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
        <div class="modal-actions">
          <button class="secondary-button" type="button" :disabled="deleting" @click="removing = null">Vazgeç</button>
          <button class="danger-button" type="button" :disabled="!canRemove || deleting" @click="confirmRemove">{{ deleting ? 'Siliniyor...' : 'Sil' }}</button>
        </div>
      </section>
    </div>

    <!-- Firmayı sil -->
    <div v-if="deleteOpen" class="modal-backdrop">
      <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="delete-title">
        <div class="modal-head">
          <span class="head-icon danger"><i class="pi pi-trash" /></span>
          <div><h2 id="delete-title">Firmayı Sil</h2><p>"{{ firm?.name }}" kalıcı olarak silinir.</p></div>
          <button class="close-button" type="button" aria-label="Kapat" :disabled="deleting" @click="deleteOpen = false"><i class="pi pi-times" /></button>
        </div>
        <p class="delete-warn"><i class="pi pi-exclamation-triangle" /> Bu işlem <strong>geri alınamaz</strong>. Altındaki lokasyonlar, işyerleri, ekipmanlar ve kontrol raporları da silinir.</p>
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
// Bireysel uzmanın firma sayfası: organizasyon ağacı solda, seçili yerin işlemleri sağda. Lokasyon herhangi bir düğüme bağlanan boş bir yerdir; firmalar lokasyonda faaliyet gösterir.
import { customerTypeLabel } from '~/composables/useCustomerTypes'
import { HAZARD_CLASSES, hazardClassKey, normalizeCompanyName, type NaceItem } from '~/composables/useExpertApi'
import type { Firm, FirmLocation, FirmNode, LocationDraft, WorkplaceProgress, WorkplaceRowDraft } from '~/composables/useFirmSetup'

definePageMeta({ layout: 'expert', middleware: 'expert' })

const route = useRoute()
const { get, del, errorMessage } = useExpertApi()
const { listFirms, loadStructure, addNode, addLocation, addWorkplaceRow, workplaceLimitMessage } = useFirmSetup()
const { workplaces, load: loadWorkplaces } = useMyWorkplaces()
const { load: loadNames, nameOf } = useWorkplaceNames()
const { multiUser, load: loadAccount } = useAccount()
const goToEquipment = useGoToEquipment()

const firm = ref<Firm | null>(null)
const nodes = ref<FirmNode[]>([])
const locations = ref<FirmLocation[]>([])
const loading = ref(true)
const error = ref('')

// Soldaki ağaçta seçili yer; sağ panel yalnız onu gösterir. Seçili yer silinirse firmaya dönülür.
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
const path = computed(() => selected.value ? pathTo(nodes.value, selected.value.id) : [])
const selectedLocations = computed(() => locations.value.filter(l => String(l.organization_id) === String(selected.value?.id)))
const canBranch = computed(() => firm.value?.type === 'corporate' || firm.value?.type === 'public')
// Firma altına grup da şirket de eklenebilir. Lokasyon herhangi bir düğüme bağlanır; firmalar lokasyonda faaliyet gösterir.
const branchLabel = (node: FirmNode) => firm.value?.type === 'public' ? 'Birim Ekle' : isRoot(node) ? 'Grup / Şirket Ekle' : 'Şirket Ekle'
const hasBranches = computed(() => nodes.value.some(n => n.children?.length))
const canBranchAt = (node: FirmNode) => canBranch.value && pathTo(nodes.value, node.id).length < 3
const workplacesOf = (location: FirmLocation) => workplaces.value.filter(w => String(w.location_id) === String(location.id))
const firmsOf = (location: FirmLocation) => workplacesOf(location).map(w => w.company_name)

// Lokasyon seçimi: seçiliyse sağ panel o lokasyonun işyerlerini ve satır içi ekleme formunu gösterir; düğüm seçilince kapanır.
// Lokasyon silinirse bulunamaz ve panel kendiliğinden düğüme döner.
const selectedLocationId = ref<number | string | null>(null)
const selectedLocation = computed(() => selectedLocationId.value == null ? null : locations.value.find(l => String(l.id) === String(selectedLocationId.value)) ?? null)
const locationWorkplaces = computed(() => selectedLocation.value ? workplacesOf(selectedLocation.value) : [])
function selectNode(node: FirmNode) {
  selectedId.value = node.id
  selectedLocationId.value = null
}
function selectLocation(location: FirmLocation) {
  if (location.organization_id != null) selectedId.value = location.organization_id
  if (String(selectedLocationId.value) === String(location.id)) return
  selectedLocationId.value = location.id
  resetRow(true)
  rowNotice.value = ''
  freshIds.value = []
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

async function load() {
  error.value = ''
  try {
    await loadAccount()
    // Bu ekran yalnız bireysel uzman içindir; diğer hesaplar kendi sayfalarına döner.
    if (multiUser.value) return navigateTo('/expert/workplaces', { replace: true })
    const [firms, structure] = await Promise.all([listFirms(), loadStructure(String(route.params.id)), loadWorkplaces(true), loadNames()])
    firm.value = firms.find(f => String(f.id) === String(route.params.id)) || null
    if (!firm.value) { error.value = 'Firma bulunamadı.'; return }
    nodes.value = structure.nodes
    locations.value = structure.locations
  } catch (e: any) {
    error.value = errorMessage(e, 'Firma bilgileri alınamadı.')
  } finally { loading.value = false }
}

// --- Lokasyon ---
const locationNode = ref<FirmNode | null>(null)
const newDraft = (): LocationDraft => ({ name: '', cityId: null, districtId: null, address: '', hazard: '', company: '', naceCode: null, activity: null })
const draft = reactive<LocationDraft>(newDraft())
const progress = ref<WorkplaceProgress>({})
const saving = ref(false)
const formError = ref('')
const isRoot = (node: FirmNode) => nodes.value.some(n => n.id === node.id)
const canSaveLocation = computed(() => !!draft.name.trim() && !!draft.cityId)

// Ağaçtaki + Ekle: dal eklenemeyen yerde doğrudan lokasyon sorulur.
const addChoice = ref<FirmNode | null>(null)
function startAdd(node: FirmNode) {
  selectedId.value = node.id
  if (canBranchAt(node)) addChoice.value = node
  else openLocation(node)
}
function chooseLocation() { const node = addChoice.value!; addChoice.value = null; openLocation(node) }
function chooseNode() { const node = addChoice.value!; addChoice.value = null; openNode(node) }

const limitFull = ref(false)
function openLocation(node: FirmNode) {
  Object.assign(draft, newDraft())
  progress.value = {}
  formError.value = ''
  locationNode.value = node
}
function closeLocation() { if (!saving.value) locationNode.value = null }

async function saveLocation() {
  if (!canSaveLocation.value || !firm.value || !locationNode.value) return
  saving.value = true
  formError.value = ''
  try {
    // Kayıt sonrası yenileme başarısız olup tekrar denenirse ikinci lokasyon açılmaz.
    if (!progress.value.locationId) progress.value.locationId = await addLocation(firm.value.id, locationNode.value.id, draft)
    const id = progress.value.locationId
    locationNode.value = null
    await load()
    // Ayrı bir "firma ekle" penceresi yerine yeni lokasyon seçilir; satır içi form hazır gelir.
    const created = locations.value.find(l => String(l.id) === String(id))
    if (created) {
      selectLocation(created)
      rowNotice.value = `${created.name} eklendi. Şimdi içine işyerlerini ekleyin.`
      nextTick(() => rowNameInput.value?.focus())
    }
  } catch (e: any) {
    formError.value = errorMessage(e, e?.message || 'Lokasyon eklenemedi. Tekrar deneyin.')
  } finally { saving.value = false }
}

// --- Lokasyona işyeri: satır içi form (tek ya da toplu) ---
// Firma (tüzel kişi) listeden seçilir ya da yazılır; bağ kayıtla birlikte kurulur. Şahıs işletmesinde firma kendisidir,
// kamuda kart lokasyonun adıyla açılır (mevcut kural). Tehlike sınıfı için varsayılan verilmez: her kayıtta seçilir.
const flatten = (list: FirmNode[]): FirmNode[] => list.flatMap(n => [n, ...flatten(n.children || [])])
const nodeNames = computed(() => flatten(nodes.value).map(n => n.name))
const companyWord = computed(() => firm.value?.type === 'public' ? 'Kart' : 'Firma')
const showCompanyColumn = computed(() => firm.value?.type === 'corporate')
// Seçenekler: bu müşterinin işyerlerindeki firmalar, sonra ağaçtaki grup/şirket adları (aynı ad bir kez).
const companyOptions = computed(() => {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (name?: string | null) => {
    const key = name ? normalizeCompanyName(name) : ''
    if (key && !seen.has(key)) { seen.add(key); out.push(name!.trim()) }
  }
  locations.value.forEach(l => workplacesOf(l).forEach(w => push(w.company_name)))
  nodeNames.value.forEach(push)
  return out
})
const row = reactive<WorkplaceRowDraft>({ name: '', company: '', sgk: '', hazard: '', naceCode: null, activity: null })
const companyChoice = ref('')
const newCompany = ref('')
const lastCompany = ref('')
const bulk = ref(false)
const bulkText = ref('')
const rowSaving = ref(false)
const rowError = ref('')
const rowNotice = ref('')
const freshIds = ref<number[]>([])
const rowNameInput = ref<HTMLInputElement | null>(null)
const companyFor = (location: FirmLocation) => {
  const type = firm.value?.type
  if (type === 'individual') return firm.value!.name
  if (type === 'public') return location.name
  return companyChoice.value === '__new' ? newCompany.value.trim() : companyChoice.value
}
// Aynı firma bu lokasyonda zaten varsa ikinci işyeri "ek işyeri" olur ve adı zorunludur.
const nameRequired = computed(() => {
  if (!selectedLocation.value || bulk.value) return false
  const key = normalizeCompanyName(companyFor(selectedLocation.value) || '')
  return !!key && firmsOf(selectedLocation.value).some(n => normalizeCompanyName(n) === key)
})
function resetRow(keepNothing = false) {
  Object.assign(row, { name: '', sgk: '', hazard: '', naceCode: null, activity: null })
  newCompany.value = ''
  bulkText.value = ''
  rowError.value = ''
  naceOpen.value = false
  naceQuery.value = ''
  naceResults.value = []
  if (keepNothing || !companyChoice.value || companyChoice.value === '__new') {
    // Son seçilen firma öne gelir; tek şirkette firmanın kendisi; hiç yoksa yeni firma yazılır.
    const options = companyOptions.value
    companyChoice.value = options.includes(lastCompany.value) ? lastCompany.value
      : !hasBranches.value && firm.value ? firm.value.name
      : options[0] ?? '__new'
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
  if (!company) { rowError.value = 'Firmanın adını yazın.'; return }
  if (bulk.value && !names.length) { rowError.value = 'En az bir işyeri adı yazın.'; return }
  if (!row.hazard) { rowError.value = 'Tehlike sınıfını seçin.'; return }
  rowSaving.value = true
  const before = new Set(workplacesOf(location).map(w => w.id))
  const here = firmsOf(location)
  let done = 0
  try {
    const limit = await workplaceLimitMessage()
    if (limit) { rowError.value = limit; limitFull.value = true; return }
    for (const name of names) {
      await addWorkplaceRow(firm.value.id, location.id, { ...row, name, company, sgk: bulk.value ? '' : row.sgk }, firm.value.type, here)
      here.push(company)
      done++
    }
  } catch (e: any) {
    rowError.value = errorMessage(e, e?.message || 'İşyeri eklenemedi. Tekrar deneyin.')
  } finally {
    if (done) {
      await loadWorkplaces(true).catch(() => {})
      freshIds.value = workplacesOf(location).map(w => w.id).filter(id => !before.has(id))
      const label = names.length === 1 ? (names[0] || company) : `${done} işyeri`
      rowNotice.value = firm.value!.type === 'corporate' ? `${label} eklendi · ${company} adına` : `${label} eklendi`
      if (firm.value!.type === 'corporate') { lastCompany.value = company; companyChoice.value = company }
      if (!rowError.value) { resetRow(); nextTick(() => rowNameInput.value?.focus()) }
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

// --- Grup / şirket / birim ---
const nodeParent = ref<FirmNode | null>(null)
const nodeName = ref('')
const nodeInput = ref<HTMLInputElement | null>(null)
function openNode(node: FirmNode) {
  nodeName.value = ''
  formError.value = ''
  nodeParent.value = node
  nextTick(() => nodeInput.value?.focus())
}
async function saveNode() {
  if (!nodeName.value.trim() || !firm.value || !nodeParent.value || saving.value) return
  saving.value = true
  formError.value = ''
  try {
    await addNode(firm.value.id, nodeName.value.trim(), nodeParent.value.id)
    nodeParent.value = null
    await load()
  } catch (e: any) {
    formError.value = errorMessage(e, 'Eklenemedi. Tekrar deneyin.')
  } finally { saving.value = false }
}
// Eski kayıtta kök düğüm yoksa (yarım kalmış kurulum) aynı adla açılır.
async function repairRoot() {
  if (!firm.value) return
  try { await addNode(firm.value.id, firm.value.name, null); await load() }
  catch (e: any) { error.value = errorMessage(e, 'Düzeltilemedi.') }
}

const goEquipment = (location: FirmLocation) => goToEquipment(location.id)

// --- Ağaçtan silme ---
// Backend lokasyonu silince ekipman, tesisat ve toplu raporlar da silinir. Pencere neyin gideceğini sayısıyla yazar;
// kayıt varsa Firmayı Sil'deki gibi ad yazılarak onaylanır. Sayım yapılamazsa uyarı gösterilemeyeceği için Sil açılmaz.
interface RemoveTarget { name: string; node?: FirmNode; location?: FirmLocation }
const removing = ref<RemoveTarget | null>(null)
const removeChecking = ref(false)
const removeWarn = ref('')
const removeConfirm = ref('')
const canRemove = computed(() => !!removing.value && !removeChecking.value && !formError.value
  && (!removeWarn.value || removeConfirm.value.trim().toLocaleLowerCase('tr-TR') === removing.value.name.trim().toLocaleLowerCase('tr-TR')))
const recordCount = async (locationId: number | string, path: string) => {
  const response = await get<any>(path, { location_id: locationId })
  const list = Array.isArray(response) ? response : response?.data
  if (!Array.isArray(list)) throw new Error('Kayıtlar sayılamadı.')
  return list.length
}
const subtreeOf = (node: FirmNode) => flatten([node])
const locationsUnder = (node: FirmNode) => {
  const ids = subtreeOf(node).map(n => String(n.id))
  return locations.value.filter(l => ids.includes(String(l.organization_id)))
}
async function removalWarning(target: RemoveTarget) {
  const targets = target.node ? locationsUnder(target.node) : [target.location!]
  const totals = await Promise.all(['/pk-equipment', '/pk-installations', '/pk-bulk-reports'].map(async path => (await Promise.all(targets.map(l => recordCount(l.id, path)))).reduce((sum, n) => sum + n, 0)))
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
async function removeLocation(location: FirmLocation) {
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
    if (target.location) await removeLocation(target.location)
    else if (target.node) {
      for (const location of locationsUnder(target.node)) await removeLocation(location)
      // Backend dolu düğümü silmez: önce en alttakiler.
      for (const node of subtreeOf(target.node).reverse()) await del(`/organizations/${node.id}`)
    }
    removing.value = null
    await load()
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
    await navigateTo('/expert/workplaces')
  } catch (e: any) {
    formError.value = errorMessage(e, 'Firma silinemedi.')
  } finally { deleting.value = false }
}

onMounted(async () => {
  await load()
  // "Başka Lokasyon Ekle" ile gelindiyse form hemen açılır.
  if (route.query.lokasyon && nodes.value[0]) openLocation(nodes.value[0])
})
</script>

<style scoped>
.firm-detail { max-width: 1500px; margin: 0 auto; }
.back { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 14px; color: var(--admin-muted); font-size: 13.5px; font-weight: 600; }
.back:hover { color: var(--admin-heading); }
.page-head { margin-bottom: 16px; }
h1 { margin: 0; color: var(--admin-heading); font-size: 28px; letter-spacing: -.6px; overflow-wrap: anywhere; }
.page-head p { display: flex; align-items: center; gap: 10px; margin: 8px 0 0; color: var(--admin-muted); font-size: 13.5px; }
.chip { padding: 3px 9px; border-radius: 7px; background: var(--admin-soft); color: var(--admin-heading); font-size: 12px; font-weight: 600; }
.tree-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.view-toggle { display: inline-flex; gap: 3px; padding: 3px; border-radius: 9px; background: var(--admin-soft); }
.view-toggle button { min-height: 30px; padding: 0 10px; border: 0; border-radius: 7px; background: none; color: var(--admin-muted); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
.view-toggle button.on { background: var(--admin-input); color: var(--admin-heading); box-shadow: 0 1px 2px var(--admin-shadow); }
.company-group { display: grid; gap: 2px; margin-bottom: 10px; }
.company-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 6px 8px; color: var(--admin-heading); font-size: 13.5px; }
.company-head small { color: var(--admin-muted); font-size: 12px; }
.company-item { display: grid; gap: 1px; width: 100%; min-height: 40px; padding: 7px 10px 7px 20px; border: 0; border-radius: 8px; background: none; color: var(--admin-heading); font: inherit; font-size: 13px; font-weight: 600; text-align: left; cursor: pointer; }
.company-item small { color: var(--admin-muted); font-size: 11.5px; font-weight: 500; }
.company-item:hover { background: var(--admin-soft); }
.company-item.on { background: var(--pk-yellow); color: #111827; }
.company-item.on small { color: #3d3a2a; }
.crumbs span { color: var(--admin-muted); font-weight: 600; }
.location-title { display: grid; gap: 3px; min-width: 0; }
.location-title small { color: var(--admin-muted); font-size: 13px; }
.head-buttons { display: flex; flex-wrap: wrap; gap: 8px; }
.wp-wrap { margin: 16px 0 0; border: 1px solid var(--admin-border); border-radius: 10px; overflow-x: auto; }
.wp-table { width: 100%; min-width: 560px; border-collapse: collapse; font-size: 13.5px; }
.wp-table th { padding: 9px 12px; background: var(--admin-soft); color: var(--admin-muted); font-size: 11.5px; font-weight: 700; letter-spacing: .04em; text-align: left; text-transform: uppercase; }
.wp-table td { padding: 11px 12px; border-top: 1px solid var(--admin-border); color: var(--admin-heading); }
.wp-table td.muted { color: var(--admin-muted); }
.wp-table tr.fresh td { background: #ecfdf3; }
.empty-cell { color: var(--admin-muted) !important; text-align: center; }
.company-chip { display: inline-block; padding: 3px 9px; border-radius: 999px; background: #eef4ff; color: #3538cd; font-size: 12px; font-weight: 600; }
.hazard-badge { display: inline-block; padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
.hazard-badge.low { background: var(--admin-success-bg); color: var(--admin-success-text); }
.hazard-badge.high { background: var(--admin-warning-bg); color: var(--admin-warning-text); }
.hazard-badge.very-high { background: var(--admin-danger-bg); color: var(--admin-danger-text); }
.row-notice { display: flex; align-items: center; gap: 8px; margin: 12px 0 0; padding: 10px 12px; border-radius: 9px; background: #ecfdf3; color: #027a48; font-size: 13px; font-weight: 600; }
.add-row { display: grid; gap: 12px; margin-top: 16px; padding: 16px; border: 2px solid var(--pk-yellow); border-radius: 12px; background: var(--admin-input); }
.add-row-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.add-row-head h3 { margin: 0; font-size: 15px; }
.add-row .link-button { color: #b54708; font-size: 13px; font-weight: 600; }
.add-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
.field small { color: var(--admin-muted); font-weight: 400; }
.field select, .field textarea { width: 100%; margin-top: 6px; border: 1px solid var(--admin-border); border-radius: 9px; outline: 0; background: var(--admin-input); color: var(--admin-heading); font: inherit; font-size: 14px; font-weight: 400; }
.field select { min-height: 44px; padding: 0 10px; }
.field textarea { padding: 10px 12px; resize: vertical; }
.field select:focus, .field textarea:focus { border-color: #d7a900; }
.nace-line { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.nace-picked { display: inline-flex; align-items: center; gap: 6px; color: #027a48; font-size: 12.5px; font-weight: 600; }
.nace-box input { width: 100%; min-height: 42px; padding: 0 12px; border: 1px solid var(--admin-border); border-radius: 9px; outline: 0; background: var(--admin-input); color: var(--admin-heading); font: inherit; font-size: 14px; }
.nace-results { max-height: 190px; overflow: auto; margin: 6px 0 0; padding: 4px; list-style: none; border: 1px solid var(--admin-border); border-radius: 9px; background: var(--admin-input); }
.nace-results button { width: 100%; min-height: 40px; padding: 7px 9px; border: 0; border-radius: 7px; background: none; color: var(--admin-heading); font: inherit; font-size: 13px; text-align: left; cursor: pointer; }
.nace-results button:hover { background: var(--admin-accent-soft); }
.nace-results em { margin-left: 4px; color: var(--admin-muted); font-size: 12px; font-style: normal; font-weight: 600; }
.add-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.add-actions small { color: var(--admin-muted); font-size: 12px; }
.add-row .form-error { margin: 0; }
.choice-list { display: grid; gap: 10px; }
.no-firm { color: #b54708; }
.card { padding: 14px; border: 1px solid var(--admin-border); border-radius: 12px; background: var(--admin-card, var(--admin-input)); }
.tree { margin: 0; padding: 0; display: grid; gap: 4px; }
.firm-layout { display: grid; gap: 14px; align-items: start; }
.firm-layout.has-tree { grid-template-columns: minmax(280px, 340px) minmax(0, 1fr); }
.tree-card { position: sticky; top: 84px; max-height: calc(100vh - 100px); overflow: auto; }
.tree-card h2 { margin: 0; color: var(--admin-heading); font-size: 15px; }
.tree-card > p { margin: 3px 0 10px; color: var(--admin-muted); font-size: 12.5px; }
.detail { min-width: 0; padding: 18px; }
.crumbs { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 6px; margin-bottom: 8px; color: var(--admin-muted); font-size: 12.5px; }
.crumbs button { min-height: 24px; padding: 0; border: 0; background: none; color: #175cd3; font: inherit; font-weight: 600; cursor: pointer; }
.crumbs button:disabled { color: var(--admin-muted); cursor: default; }
.detail-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.detail-head h2 { margin: 0; color: var(--admin-heading); font-size: 21px; overflow-wrap: anywhere; }
.detail-delete { flex: none; min-height: 36px; display: inline-flex; align-items: center; gap: 7px; padding: 0 12px; border: 1px solid var(--admin-border); border-radius: 8px; background: var(--admin-input); color: #b42318; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.detail-delete:hover { border-color: #d92d20; }
.actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; margin: 14px 0 20px; }
.action { min-height: 70px; display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--admin-border); border-radius: 11px; background: var(--admin-input); color: var(--admin-heading); font: inherit; text-align: left; cursor: pointer; }
.action:hover { border-color: #d7a900; }
.action > i { font-size: 20px; }
.action span { display: grid; gap: 2px; }
.action strong { font-size: 15px; }
.action small { color: var(--admin-muted); font-size: 12.5px; }
.action.main { border-color: var(--pk-yellow); background: var(--pk-yellow); color: #111827; }
.action.main small { color: #3d3a2a; }
.detail h3 { margin: 0 0 8px; color: var(--admin-heading); font-size: 14px; }
.rows { display: grid; gap: 8px; margin: 0 0 18px; padding: 0; list-style: none; }
.empty { margin: 0 0 18px; padding: 14px; border: 1px dashed var(--admin-border); border-radius: 9px; color: var(--admin-muted); font-size: 13.5px; text-align: center; }
.location-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 10px; padding: 10px 12px; border: 1px solid var(--admin-border); border-radius: 9px; background: var(--admin-input); color: var(--admin-muted); }
.location-text { flex: 1; min-width: 160px; display: grid; gap: 1px; }
.location-text strong { color: var(--admin-heading); font-size: 14px; }
.location-text small { font-size: 12px; }
.firms { display: flex; flex-wrap: wrap; gap: 4px 6px; margin-top: 4px; }
.firm { display: inline-flex; align-items: center; gap: 2px; min-height: 26px; padding: 2px 8px; border-radius: 6px; background: #ecfdf3; color: #027a48; font-size: 12.5px; font-weight: 600; overflow-wrap: anywhere; }
.row-button { min-height: 36px; display: inline-flex; align-items: center; gap: 7px; padding: 0 12px; border: 1px solid var(--admin-border); border-radius: 8px; background: var(--admin-input); color: var(--admin-heading); font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.row-button:hover { border-color: #d7a900; }
.row-button.warn { border-color: #f79009; color: #b54708; }
.row-button.icon { width: 36px; justify-content: center; padding: 0; color: var(--admin-muted); }
.row-button.icon:hover { border-color: #d92d20; color: #b42318; }
.child-row { width: 100%; min-height: 44px; display: flex; align-items: center; gap: 10px; padding: 8px 12px; border: 1px solid var(--admin-border); border-radius: 9px; background: var(--admin-soft); color: var(--admin-heading); font: inherit; font-size: 14px; text-align: left; cursor: pointer; }
.child-row:hover { border-color: #d7a900; }
.child-row strong { flex: 1; overflow-wrap: anywhere; }
@media (max-width: 900px) { .firm-layout.has-tree { grid-template-columns: minmax(0, 1fr); } .tree-card { position: static; max-height: none; } }
.state { padding: 34px 16px; color: var(--admin-muted); text-align: center; font-size: 14px; }
.state.error { display: grid; justify-items: center; gap: 12px; color: #b42318; }
.link-button { border: 0; background: none; color: inherit; font: inherit; font-weight: 700; text-decoration: underline; cursor: pointer; }
.other { margin-top: 16px; color: var(--admin-muted); font-size: 13.5px; }
.other summary { padding: 8px 2px; cursor: pointer; font-weight: 600; }
.other-body { display: grid; justify-items: start; gap: 6px; padding: 6px 2px; }
.other-link { display: inline-flex; align-items: center; gap: 8px; min-height: 36px; border: 0; background: none; color: var(--admin-heading); font: inherit; font-size: 13.5px; cursor: pointer; }
.other-link:hover { text-decoration: underline; }
.other-link.danger { color: #b42318; }
.modal-backdrop { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 16px; background: var(--admin-overlay); }
.modal-card { width: min(540px, 100%); max-height: calc(100vh - 32px); overflow: auto; padding: 22px; border-radius: 14px; background: var(--admin-input); box-shadow: 0 20px 60px var(--admin-shadow); }
.modal-head { display: flex; align-items: center; gap: 13px; margin-bottom: 18px; }
.modal-head > div { flex: 1; min-width: 0; }
.modal-head h2 { margin: 0; color: var(--admin-heading); font-size: 19px; }
.modal-head p { margin: 3px 0 0; color: var(--admin-muted); font-size: 13px; overflow-wrap: anywhere; }
.head-icon { flex: none; width: 44px; height: 44px; display: grid; place-items: center; border-radius: 11px; background: var(--pk-yellow); color: #111827; font-size: 19px; }
.head-icon.danger { background: #fee4e2; color: #b42318; }
.close-button { flex: none; width: 36px; height: 36px; border: 0; border-radius: 8px; background: transparent; color: var(--admin-muted); cursor: pointer; }
.close-button:hover { background: var(--admin-hover); color: var(--admin-heading); }
.field { display: block; color: var(--admin-heading); font-size: 13px; font-weight: 600; }
.field input { margin-top: 6px; }
.field input { width: 100%; min-height: 44px; padding: 0 12px; border: 1px solid var(--admin-border); border-radius: 9px; outline: 0; background: var(--admin-input); color: var(--admin-heading); font: inherit; font-size: 14px; font-weight: 400; }
.field input:focus { border-color: #d7a900; }
.req { color: #d92d20; }
.form-error { margin: 14px 0 0; padding: 10px 12px; border-radius: 9px; background: #fef3f2; color: #b42318; font-size: 13px; }
.muted { color: var(--admin-muted); font-size: 13px; }
.delete-warn { display: flex; gap: 8px; margin: 0 0 12px; padding: 10px 12px; border-radius: 9px; background: #fef3f2; color: #b42318; font-size: 13px; line-height: 1.45; }
.delete-list { margin: 0 0 12px; padding-left: 18px; color: var(--admin-heading); font-size: 13.5px; }
.modal-actions { display: flex; justify-content: space-between; gap: 10px; margin-top: 18px; }
.primary-button, .secondary-button, .danger-button { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 16px; border-radius: 9px; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
.primary-button { border: 1px solid var(--pk-yellow); background: var(--pk-yellow); color: #111827; }
.primary-button:hover:not(:disabled) { background: var(--pk-yellow-dark); }
.secondary-button { border: 1px solid var(--admin-border); background: var(--admin-input); color: var(--admin-heading); }
.danger-button { border: 1px solid #d92d20; background: #d92d20; color: #fff; }
.primary-button:disabled, .danger-button:disabled { opacity: .5; cursor: default; }
</style>
