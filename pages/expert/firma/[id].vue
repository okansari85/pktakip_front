<template>
  <div class="firm-detail">
    <NuxtLink to="/expert/workplaces" class="back"><i class="pi pi-arrow-left" /> Firmalarım</NuxtLink>

    <div v-if="loading" class="state">Yükleniyor...</div>
    <div v-else-if="error && !firm" class="state error">{{ error }}<button class="secondary-button" type="button" @click="load">Tekrar Dene</button></div>

    <template v-else-if="firm">
      <div class="page-head">
        <div>
          <h1>{{ firm.name }}</h1>
          <p><span v-if="firm.type" class="chip">{{ customerTypeLabel(firm.type) }}</span> {{ headerStats }}</p>
        </div>
      </div>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>

      <!-- Tek pencere: bütün yapı ağaçta; ekleme, düzenleme ve silme ilgili satırın altında açılır. -->
      <section v-if="nodes.length" class="card tree-card">
        <div v-if="canBranch" class="tree-head">
          <h2>Organizasyon</h2>
          <div class="view-toggle" role="group" aria-label="Görünüm">
            <button type="button" :class="{ on: treeView === 'yer' }" :aria-pressed="treeView === 'yer'" @click="treeView = 'yer'">Yere göre</button>
            <button type="button" :class="{ on: treeView === 'firma' }" :aria-pressed="treeView === 'firma'" @click="treeView = 'firma'">Firmaya göre</button>
          </div>
        </div>

        <ul v-if="treeView === 'yer'" class="tree">
          <template v-for="item in treeRows" :key="item.key">
            <li class="tree-row" :class="`r-${item.kind}`" :style="{ '--depth': item.depth }" :data-key="item.key">
              <!-- Organizasyon -->
              <template v-if="item.kind === 'node'">
                <form v-if="renaming && String(selected?.id) === String(item.node.id)" class="rename-row" @submit.prevent="saveRename">
                  <label class="sr-only" for="rename-input">Yeni ad</label>
                  <input id="rename-input" v-model="renameText" type="text" @keydown.esc="renaming = false" />
                  <button class="primary-button" type="submit" :disabled="!renameText.trim() || renameSaving">{{ renameSaving ? 'Kaydediliyor...' : 'Kaydet' }}</button>
                  <button class="secondary-button" type="button" :disabled="renameSaving" @click="renaming = false">Vazgeç</button>
                  <p v-if="renameError" class="form-error" role="alert">{{ renameError }}</p>
                </form>
                <template v-else>
                  <button class="row-main" type="button" :aria-expanded="hasContent(item.node) ? !closed.has(item.key) : undefined" @click="toggleNode(item.key)">
                    <i class="chevron" :class="!hasContent(item.node) ? '' : closed.has(item.key) ? 'pi pi-chevron-right' : 'pi pi-chevron-down'" />
                    <i :class="item.depth ? 'pi pi-sitemap k-org' : 'pi pi-building k-root'" />
                    <span class="row-text"><strong>{{ item.node.name }}</strong><small>{{ nodeSummary(item.node) }}</small></span>
                  </button>
                  <div class="row-actions">
                    <button v-if="canBranch" class="row-button" type="button" @click="startOrg(item.node)"><i class="pi pi-plus" /> {{ firm.type === 'public' ? 'Alt birim ekle' : 'Alt organizasyon ekle' }}</button>
                    <button class="row-button" type="button" @click="startLocation(item.node)"><i class="pi pi-map-marker" /> Lokasyon ekle</button>
                    <button
                      class="row-button icon" type="button" :disabled="isLocked(item.node)"
                      :title="isLocked(item.node) ? 'Bu kayıt önceki bir sürümde şirket türüyle açıldı; adı değiştirilemiyor. Silip aynı adla yeniden ekleyebilirsiniz.' : 'Adı düzenle'"
                      :aria-label="`${item.node.name} adını düzenle`" @click="startRename(item.node)"
                    ><i class="pi pi-pencil" /></button>
                    <button class="row-button icon remove" type="button" title="Sil" :aria-label="`${item.node.name} kaydını sil`" @click="item.depth ? openRemove({ name: item.node.name, node: item.node }) : openDelete()"><i class="pi pi-trash" /></button>
                  </div>
                </template>
              </template>

              <!-- Lokasyon -->
              <template v-else-if="item.kind === 'location'">
                <button class="row-main" type="button" :aria-expanded="workplacesOf(item.location).length ? openLocations.has(item.key) : undefined" @click="toggleLocation(item.location)">
                  <i class="chevron" :class="!workplacesOf(item.location).length ? '' : openLocations.has(item.key) ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" />
                  <i class="pi pi-map-marker k-location" />
                  <span class="row-text">
                    <strong>{{ item.location.name }}</strong>
                    <small><template v-if="item.location.city">{{ item.location.city }}<template v-if="item.location.district"> / {{ item.location.district }}</template> · </template><span :class="{ 'no-firm': !workplacesOf(item.location).length }">{{ workplacesOf(item.location).length ? `${workplacesOf(item.location).length} işyeri` : 'Henüz işyeri yok' }}</span></small>
                  </span>
                </button>
                <div class="row-actions">
                  <button class="row-button" type="button" @click="startWorkplace(item.location)"><i class="pi pi-briefcase" /> İşyeri ekle</button>
                  <button v-if="workplacesOf(item.location).length" class="row-button" type="button" @click="goEquipment(item.location)"><i class="pi pi-wrench" /> Ekipmanlar</button>
                  <button class="row-button icon remove" type="button" title="Sil" :aria-label="`${item.location.name} lokasyonunu sil`" @click="openRemove({ name: item.location.name, location: item.location })"><i class="pi pi-trash" /></button>
                </div>
              </template>

              <!-- İşyeri -->
              <template v-else>
                <div class="row-main static" :class="{ fresh: freshIds.includes(item.workplace.id) }">
                  <i class="chevron" />
                  <i class="pi pi-briefcase k-workplace" />
                  <span class="row-text">
                    <strong>{{ nameOf(item.workplace.id) || item.workplace.company_name }}</strong>
                    <small>SGK: {{ item.workplace.sgk_workplace_number || 'Girilmedi' }}</small>
                  </span>
                  <span v-if="showCompanyColumn" class="company-chip">{{ item.workplace.company_name }}</span>
                  <span class="hazard-badge" :class="hazardClassKey(item.workplace.hazard_class)">{{ item.workplace.hazard_class }}</span>
                </div>
                <div class="row-actions">
                  <button class="row-button remove" type="button" :aria-label="`${nameOf(item.workplace.id) || item.workplace.company_name} işyerini bu lokasyondan çıkar`" @click="openRemove({ name: nameOf(item.workplace.id) || item.workplace.company_name, workplace: item.workplace, location: item.location })"><i class="pi pi-times" /> Çıkar</button>
                </div>
              </template>
            </li>

            <!-- Alt organizasyon formu -->
            <li v-if="item.kind === 'node' && adding === 'org' && String(selected?.id) === String(item.node.id)" class="tree-form" :style="{ '--depth': item.depth + 1 }">
              <form class="add-row" @submit.prevent="saveChild">
                <div class="inline-form">
                  <label class="field grow">{{ item.node.name }} altına {{ firm.type === 'public' ? 'birim' : 'organizasyon' }} adı
                    <input v-model="groupName" type="text" :placeholder="firm.type === 'public' ? 'Örn. Fen İşleri Müdürlüğü' : 'Örn. Dayanıklı Tüketim Grubu, Burger King'" />
                  </label>
                  <button class="primary-button" type="submit" :disabled="!groupName.trim() || saving"><i class="pi pi-plus" /> Ekle</button>
                  <button class="secondary-button" type="button" :disabled="saving" @click="closeForm">Vazgeç</button>
                </div>
                <p v-if="childError" class="form-error" role="alert">{{ childError }}</p>
              </form>
            </li>

            <!-- Lokasyon formu -->
            <li v-if="item.kind === 'node' && adding === 'location' && String(selected?.id) === String(item.node.id)" class="tree-form" :style="{ '--depth': item.depth + 1 }">
              <form class="add-row" @submit.prevent="saveLocation">
                <h3>{{ item.node.name }} altına lokasyon ekle</h3>
                <ExpertFirmLocationFields :key="locationFormKey" :draft="draft" location-only autofocus />
                <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
                <div class="add-actions">
                  <button class="primary-button" type="submit" :disabled="!canSaveLocation || saving">{{ saving ? 'Ekleniyor...' : 'Lokasyonu ekle' }}</button>
                  <button class="secondary-button" type="button" :disabled="saving" @click="closeForm">Vazgeç</button>
                  <small>Eklenince işyeri ekleme formu açılır.</small>
                </div>
              </form>
            </li>

            <!-- İşyeri formu: firma ↔ lokasyon eşleştirmesi eklerken yapılır. -->
            <li v-if="item.kind === 'location' && adding === 'workplace' && String(selectedLocation?.id) === String(item.location.id)" class="tree-form" :style="{ '--depth': item.depth + 1 }">
              <p v-if="rowNotice" class="row-notice" role="status"><i class="pi pi-check-circle" /> {{ rowNotice }}</p>
              <form class="add-row" @submit.prevent="saveRow">
                <div class="add-row-head">
                  <h3>{{ item.location.name }} içine işyeri ekle</h3>
                  <button class="link-button" type="button" @click="toggleBulk">{{ bulk ? 'Tek tek ekle' : 'Toplu ekle (her satıra bir işyeri)' }}</button>
                </div>
                <div class="add-grid">
                  <label v-if="!bulk" class="field">İşyeri adı <small v-if="!nameRequired">(isteğe bağlı)</small><span v-else class="req">*</span>
                    <input v-model="row.name" type="text" :placeholder="nameRequired ? 'Örn. Antrepo' : 'Örn. Antrepo · boşsa firma adı görünür'" />
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
                    <li v-for="nace in naceResults" :key="nace.id"><button type="button" @click="selectNace(nace)"><strong>{{ nace.nace_code }}</strong> {{ nace.activity_name }} <em>{{ nace.hazard_class }}</em></button></li>
                  </ul>
                </div>
                <label v-if="bulk" class="field">Her satıra bir işyeri adı yazın (Excel'den yapıştırabilirsiniz)
                  <textarea v-model="bulkText" rows="4" placeholder="Beyaz Eşya Depo&#10;Antrepo&#10;Yedek Parça Deposu" />
                </label>
                <p v-if="rowError" class="form-error" role="alert">{{ rowError }}</p>
                <div class="add-actions">
                  <button class="primary-button" type="submit" :disabled="rowSaving || limitFull"><i class="pi pi-plus" /> {{ rowSaving ? 'Ekleniyor...' : bulk ? 'Hepsini ekle' : 'Ekle' }}</button>
                  <button class="secondary-button" type="button" :disabled="rowSaving" @click="closeForm">Kapat</button>
                  <small>{{ firm.type === 'corporate' ? 'Firma seçimi bir sonraki kayıt için hatırlanır.' : 'Eklenen işyeri listeye hemen düşer.' }}</small>
                </div>
              </form>
            </li>
          </template>
        </ul>

        <!-- Firmaya göre: aynı firmanın işyerleri; satır, ağaçta o lokasyonu açar. -->
        <template v-else>
          <p v-if="!byCompany.length" class="empty">Henüz işyeri yok.</p>
          <div v-for="group in byCompany" :key="group.company" class="company-group">
            <div class="company-head"><strong>{{ group.company }}</strong><small>{{ group.items.length }} işyeri</small></div>
            <button v-for="entry in group.items" :key="entry.id" class="company-item" type="button" @click="revealLocation(entry.location)">
              <span>{{ entry.title }}</span><small>{{ entry.location.name }}</small>
            </button>
          </div>
        </template>
      </section>
      <section v-else class="card"><div class="state">Bu firmanın yapısı boş. <button class="link-button" type="button" @click="repairRoot">Düzelt</button></div></section>

      <section class="other">
        <details>
          <summary>Diğer işlemler</summary>
          <div class="other-body">
            <NuxtLink to="/expert/settings/locations" class="other-link"><i class="pi pi-cog" /> Lokasyonları ayrıntılı düzenle</NuxtLink>
            <NuxtLink to="/expert/settings/customers" class="other-link"><i class="pi pi-pencil" /> Firma adını ya da yapısını düzenle</NuxtLink>
          </div>
        </details>
      </section>
    </template>

    <!-- Grup, şirket ya da lokasyonu sil -->
    <div v-if="removing" class="modal-backdrop">
      <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="remove-title">
        <div class="modal-head">
          <span class="head-icon danger"><i class="pi pi-trash" /></span>
          <div><h2 id="remove-title">{{ removing.workplace ? 'Firmayı Lokasyondan Çıkar' : removing.location ? 'Lokasyonu Sil' : 'Sil' }}</h2><p>"{{ removing.name }}"<template v-if="removing.workplace"> · {{ removing.location?.name }}</template></p></div>
          <button class="close-button" type="button" aria-label="Kapat" :disabled="deleting" @click="removing = null"><i class="pi pi-times" /></button>
        </div>
        <p v-if="removeChecking" class="muted">Kayıtlar kontrol ediliyor...</p>
        <template v-else-if="removeWarn">
          <p class="delete-warn"><i class="pi pi-exclamation-triangle" /> {{ removeWarn }}</p>
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
// Bireysel uzmanın firma sayfası: tek pencere, bütün yapı ağaçta; işlemler satırda, formlar satırın altında. Lokasyon herhangi bir düğüme bağlanan boş bir yerdir; firmalar lokasyonda faaliyet gösterir.
import { customerTypeLabel } from '~/composables/useCustomerTypes'
import { HAZARD_CLASSES, hazardClassKey, normalizeCompanyName, type NaceItem } from '~/composables/useExpertApi'
import type { Firm, FirmLocation, FirmNode, LocationDraft, WorkplaceProgress, WorkplaceRowDraft } from '~/composables/useFirmSetup'
import type { Workplace } from '~/composables/useWorkplaceContext'

definePageMeta({ layout: 'expert', middleware: 'expert' })

const route = useRoute()
const { get, patch, del, errorMessage } = useExpertApi()
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
const workplacesOf = (location: FirmLocation) => workplaces.value.filter(w => String(w.location_id) === String(location.id))
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
  renaming.value = false
  renameError.value = ''
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
// İşyeri yoksa açılacak bir şey de yok: doğrudan ekleme formu açılır.
function toggleLocation(location: FirmLocation) {
  const key = `l${location.id}`
  if (!workplacesOf(location).length) return startWorkplace(location)
  if (openLocations.value.has(key)) openLocations.value.delete(key)
  else openLocations.value.add(key)
}
const focusForm = () => nextTick(() => document.querySelector<HTMLInputElement>('.tree-form input')?.focus())
// Aynı anda tek form açık olur.
const adding = ref<'org' | 'location' | 'workplace' | null>(null)
function openNodeForm(node: FirmNode, kind: 'org' | 'location') {
  selectNode(node)
  renaming.value = false
  adding.value = kind
  closed.value.delete(`n${node.id}`)
}
function startOrg(node: FirmNode) {
  openNodeForm(node, 'org')
  focusForm()
}
function startLocation(node: FirmNode) {
  openNodeForm(node, 'location')
}
function startWorkplace(location: FirmLocation) {
  selectLocation(location)
  renaming.value = false
  adding.value = 'workplace'
  openLocations.value.add(`l${location.id}`)
  focusForm()
}
function closeForm() {
  adding.value = null
  selectedLocationId.value = null
}
// "Firmaya göre"den gelince: üstleri açılır, lokasyon görünür hâle gelir.
function revealLocation(location: FirmLocation) {
  treeView.value = 'yer'
  pathTo(nodes.value, location.organization_id).forEach(node => closed.value.delete(`n${node.id}`))
  openLocations.value.add(`l${location.id}`)
  nextTick(() => document.querySelector(`[data-key="l${location.id}"]`)?.scrollIntoView({ block: 'center' }))
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

// --- Lokasyon: düğümün altında açılan form ---
const newDraft = (): LocationDraft => ({ name: '', cityId: null, districtId: null, address: '', hazard: '', company: '', naceCode: null, activity: null })
const draft = reactive<LocationDraft>(newDraft())
const progress = ref<WorkplaceProgress>({})
const saving = ref(false)
const formError = ref('')
const locationFormKey = ref(0)
const canSaveLocation = computed(() => !!draft.name.trim() && !!draft.cityId)
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
    // Kayıt sonrası yenileme başarısız olup tekrar denenirse ikinci lokasyon açılmaz.
    if (!progress.value.locationId) progress.value.locationId = await addLocation(firm.value.id, node.id, draft)
    const id = progress.value.locationId
    await load()
    resetLocationForm()
    // Yeni lokasyonun işyeri formu açılır.
    const created = locations.value.find(l => String(l.id) === String(id))
    if (created) {
      startWorkplace(created)
      rowNotice.value = `${created.name} eklendi. Şimdi içine işyerlerini ekleyin.`
    }
    else closeForm()
  } catch (e: any) {
    formError.value = errorMessage(e, e?.message || 'Lokasyon eklenemedi. Tekrar deneyin.')
  } finally { saving.value = false }
}

// --- Lokasyona işyeri: satır içi form (tek ya da toplu) ---
// Firma (tüzel kişi) listeden seçilir ya da yazılır; bağ kayıtla birlikte kurulur. Şahıs işletmesinde firma kendisidir,
// kamuda kart lokasyonun adıyla açılır (mevcut kural). Tehlike sınıfı için varsayılan verilmez: her kayıtta seçilir.
const flatten = (list: FirmNode[]): FirmNode[] => list.flatMap(n => [n, ...flatten(n.children || [])])
const nodeNames = computed(() => flatten(nodes.value).map(n => n.name))
const showCompanyColumn = computed(() => firm.value?.type === 'corporate')
// Seçenekler: önce lokasyonun bağlı olduğu grubun şirketleri, sonra bu lokasyondaki ve müşterideki diğer firmalar,
// sonra başka gruplardaki şirketler (aynı ad bir kez). Tek şirketlik yapıda firmanın kendisi.
const companyOptions = computed(() => {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (name?: string | null) => {
    const key = name ? normalizeCompanyName(name) : ''
    if (key && !seen.has(key)) { seen.add(key); out.push(name!.trim()) }
  }
  if (!hasBranches.value && firm.value) push(firm.value.name)
  const location = selectedLocation.value
  if (location) {
    workplacesOf(location).forEach(w => push(w.company_name))
    // Aynı organizasyondaki diğer lokasyonlarda kullanılan firmalar (ör. Burger King restoranlarında TAB Gıda A.Ş.).
    const siblings = locations.value.filter(l => String(l.organization_id) === String(location.organization_id) && String(l.id) !== String(location.id))
    siblings.forEach(l => workplacesOf(l).forEach(w => push(w.company_name)))
    const owner = flatten(nodes.value).find(n => String(n.id) === String(location.organization_id))
    if (owner) {
      ;[...pathTo(nodes.value, owner.id)].reverse().filter(n => kindOf(n) !== 'root').forEach(n => push(n.name))
      flatten(owner.children || []).forEach(n => push(n.name))
    }
  }
  firmWorkplaces.value.forEach(w => push(w.company_name))
  flatten(nodes.value).filter(n => kindOf(n) !== 'root').forEach(n => push(n.name))
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
// "2 alt organizasyon · 2 lokasyon · 5 işyeri"
const nodeSummary = (node: FirmNode) => {
  const locs = locationsUnder(node)
  const count = locs.reduce((sum, l) => sum + workplacesOf(l).length, 0)
  const parts: string[] = []
  if (node.children?.length) parts.push(`${node.children.length} alt ${firm.value?.type === 'public' ? 'birim' : 'organizasyon'}`)
  parts.push(`${locs.length} lokasyon`, `${count} işyeri`)
  return parts.join(' · ')
}
const headerStats = computed(() => {
  const orgs = flatten(nodes.value).length - nodes.value.length
  const parts: string[] = []
  if (orgs) parts.push(`${orgs} ${firm.value?.type === 'public' ? 'birim' : 'organizasyon'}`)
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

// Ad düzeltme: satırdaki kalem. Kökte firmanın (müşteri) adı da birlikte değişir.
const renaming = ref(false)
const renameText = ref('')
const renameSaving = ref(false)
const renameError = ref('')
function startRename(node: FirmNode) {
  selectNode(node)
  closeForm()
  renameText.value = node.name
  renameError.value = ''
  renaming.value = true
  nextTick(() => document.querySelector<HTMLInputElement>('#rename-input')?.select())
}
async function saveRename() {
  const node = selected.value
  const name = renameText.value.trim()
  if (!node || !firm.value || !name || renameSaving.value) return
  if (name === node.name) { renaming.value = false; return }
  renameSaving.value = true
  renameError.value = ''
  try {
    await patch(`/customers/${firm.value.id}/organizations/${node.id}`, { name })
    if (kindOf(node) === 'root') {
      await patch(`/customers/${firm.value.id}`, { name })
      firm.value = { ...firm.value, name }
    }
    renaming.value = false
    await load()
  } catch (e: any) {
    renameError.value = errorMessage(e, 'Ad değiştirilemedi. Tekrar deneyin.')
  } finally { renameSaving.value = false }
}
// Eski kayıtta kök düğüm yoksa (yarım kalmış kurulum) aynı adla açılır.
async function repairRoot() {
  if (!firm.value) return
  try { await addNode(firm.value.id, firm.value.name, null); await load() }
  catch (e: any) { error.value = errorMessage(e, 'Düzeltilemedi.') }
}

const goEquipment = (location: FirmLocation) => goToEquipment(location.id)

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
    await navigateTo('/expert/workplaces')
  } catch (e: any) {
    formError.value = errorMessage(e, 'Firma silinemedi.')
  } finally { deleting.value = false }
}

onMounted(async () => {
  await load()
  // "Başka Lokasyon Ekle" ile gelindiyse form hemen açılır.
  if (route.query.lokasyon && nodes.value[0]) startLocation(nodes.value[0])
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
.card { padding: 14px; border: 1px solid var(--admin-border); border-radius: 12px; background: var(--admin-card, var(--admin-input)); }
.tree-card { min-height: calc(100vh - 230px); padding: 18px; }
.tree-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.tree-head h2 { margin: 0; color: var(--admin-heading); font-size: 16px; }
.view-toggle { display: inline-flex; gap: 3px; padding: 3px; border-radius: 9px; background: var(--admin-soft); }
.view-toggle button { min-height: 30px; padding: 0 10px; border: 0; border-radius: 7px; background: none; color: var(--admin-muted); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
.view-toggle button.on { background: var(--admin-input); color: var(--admin-heading); box-shadow: 0 1px 2px var(--admin-shadow); }

/* Ağaç: girinti ve kılavuz çizgileri derinlikten */
.tree { --step: 26px; display: grid; gap: 2px; margin: 0; padding: 0; list-style: none; }
.tree-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 12px; min-height: 52px; padding: 5px 8px 5px calc(var(--depth) * var(--step) + 6px); border-radius: 9px; background-image: repeating-linear-gradient(90deg, var(--admin-border) 0 1px, transparent 1px var(--step)); background-position: 15px 0; background-size: calc(var(--depth) * var(--step)) 100%; background-repeat: no-repeat; }
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
.row-button:hover:not(:disabled) { border-color: #d7a900; }
.row-button:disabled { opacity: .45; cursor: not-allowed; }
.row-button.icon { width: 36px; justify-content: center; padding: 0; color: var(--admin-muted); }
.row-button.remove { color: #b42318; }
.row-button.remove:hover:not(:disabled) { border-color: #d92d20; }
.company-chip { display: inline-block; padding: 3px 9px; border-radius: 999px; background: #eef4ff; color: #3538cd; font-size: 12px; font-weight: 600; }
.hazard-badge { display: inline-block; padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
.hazard-badge.low { background: var(--admin-success-bg); color: var(--admin-success-text); }
.hazard-badge.high { background: var(--admin-warning-bg); color: var(--admin-warning-text); }
.hazard-badge.very-high { background: var(--admin-danger-bg); color: var(--admin-danger-text); }
.rename-row { flex: 1; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.rename-row input { flex: 1 1 260px; min-height: 44px; padding: 0 12px; border: 1px solid #d7a900; border-radius: 9px; outline: 0; background: var(--admin-input); color: var(--admin-heading); font: inherit; font-size: 15px; font-weight: 700; }
.rename-row .form-error { flex-basis: 100%; margin: 0; }

/* Satırın altında açılan form */
.tree-form { display: grid; gap: 8px; padding: 2px 8px 10px calc(var(--depth) * var(--step) + 6px); }
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
.field small { color: var(--admin-muted); font-weight: 400; }
.field input { width: 100%; min-height: 44px; margin-top: 6px; padding: 0 12px; border: 1px solid var(--admin-border); border-radius: 9px; outline: 0; background: var(--admin-input); color: var(--admin-heading); font: inherit; font-size: 14px; font-weight: 400; }
.field select, .field textarea { width: 100%; margin-top: 6px; border: 1px solid var(--admin-border); border-radius: 9px; outline: 0; background: var(--admin-input); color: var(--admin-heading); font: inherit; font-size: 14px; font-weight: 400; }
.field select { min-height: 44px; padding: 0 10px; }
.field textarea { padding: 10px 12px; resize: vertical; }
.field input:focus, .field select:focus, .field textarea:focus { border-color: #d7a900; }
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
@media (max-width: 700px) { .tree { --step: 14px; } .row-actions { padding-left: 23px; box-sizing: border-box; } .row-main { flex-basis: 100%; } }
</style>
