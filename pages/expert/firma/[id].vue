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

      <ol v-if="!setupDone" class="steps" aria-label="Kurulum adımları">
        <li v-for="(step, index) in setupSteps" :key="step.title" :class="{ done: step.done, now: index === currentStep }">
          <span class="step-no"><i v-if="step.done" class="pi pi-check" /><template v-else>{{ index + 1 }}</template></span>
          <div><strong>{{ step.title }}</strong><small>{{ step.text }}</small></div>
        </li>
      </ol>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>

      <div class="firm-layout" :class="{ 'has-tree': canBranch }">
        <aside v-if="canBranch && nodes.length" class="card tree-card">
          <h2>Organizasyon Ağacı</h2>
          <p>Bir satıra tıklayın, ayrıntısı yanda açılır. Altına bir şey eklemek için <strong>+ Ekle</strong>'ye basın.</p>
          <ul class="tree">
            <ExpertFirmNode v-for="node in nodes" :key="node.id" :node="node" :depth="0" :locations="locations" :firms-of="firmsOf" :selected-id="selected?.id ?? null" @select="selectedId = $event.id" @add="startAdd" />
          </ul>
        </aside>

        <section v-if="selected" class="card detail">
          <nav v-if="path.length > 1" class="crumbs" aria-label="Bulunduğunuz yer">
            <template v-for="(item, index) in path" :key="item.id">
              <i v-if="index" class="pi pi-angle-right" />
              <button type="button" :disabled="index === path.length - 1" @click="selectedId = item.id">{{ item.name }}</button>
            </template>
          </nav>
          <div class="detail-head">
            <h2>{{ selected.name }}</h2>
            <button v-if="path.length > 1" class="detail-delete" type="button" @click="openRemove({ name: selected.name, node: selected })"><i class="pi pi-trash" /> Sil</button>
          </div>

          <div class="actions">
            <button class="action main" type="button" @click="openLocation(selected)">
              <i class="pi pi-map-marker" /><span><strong>Lokasyon Ekle</strong><small>Bina, fabrika ya da şube. Boş açılır, firmayı sonra eklersiniz.</small></span>
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
                <small v-if="!workplacesOf(location).length" class="no-firm">Henüz firma yok. Burada çalışan firmayı ekleyin.</small>
                <div v-else-if="firm.type === 'corporate'" class="firms">
                  <span v-for="workplace in workplacesOf(location)" :key="workplace.id" class="firm">{{ workplace.company_name }}</span>
                </div>
              </div>
              <button v-if="!workplacesOf(location).length" class="row-button warn" type="button" @click="openFirm(location)"><i class="pi pi-plus" /> Firma Ekle</button>
              <button v-else-if="firm.type === 'corporate'" class="row-button" type="button" @click="openFirm(location)"><i class="pi pi-plus" /> Firma Ekle</button>
              <button v-if="workplacesOf(location).length" class="row-button" type="button" @click="goEquipment(location)"><i class="pi pi-wrench" /> Ekipmanlar</button>
              <button class="row-button icon" type="button" :aria-label="`${location.name} lokasyonunu sil`" title="Sil" @click="openRemove({ name: location.name, location })"><i class="pi pi-trash" /></button>
            </li>
          </ul>
          <p v-else class="empty">Burada henüz lokasyon yok. Yukarıdaki "Lokasyon Ekle" ile ekleyebilirsiniz.</p>

          <template v-if="selected.children?.length">
            <h3>{{ firm.type === 'public' ? 'Altındaki birimler' : 'Altındaki gruplar ve şirketler' }}</h3>
            <ul class="rows">
              <li v-for="child in selected.children" :key="child.id">
                <button class="child-row" type="button" @click="selectedId = child.id"><i class="pi pi-sitemap" /><strong>{{ child.name }}</strong><i class="pi pi-angle-right" /></button>
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
          <div><h2 id="location-title">Lokasyon Ekle</h2><p>{{ locationNode.name }} altına bağlanacak. Önce yeri ekliyoruz, firmayı sonraki adımda soracağız.</p></div>
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

    <!-- Lokasyona firma: yeni lokasyondan sonra kendiliğinden açılır, atlanabilir -->
    <div v-if="firmLocation" class="modal-backdrop">
      <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="firm-title">
        <div class="modal-head">
          <span class="head-icon"><i class="pi pi-briefcase" /></span>
          <div><h2 id="firm-title">{{ firmAfterLocation ? 'Lokasyon eklendi. Şimdi firmayı ekleyin' : 'Firma Ekle' }}</h2><p>"{{ firmLocation.name }}" lokasyonunda çalışan firma. Sonra başka firma da ekleyebilirsiniz.</p></div>
          <button class="close-button" type="button" aria-label="Kapat" :disabled="saving" @click="firmLocation = null"><i class="pi pi-times" /></button>
        </div>
        <ExpertFirmLocationFields :draft="draft" company-only :show-company="firm?.type === 'corporate'" :suggestions="nodeNames" :excluded="firmsOf(firmLocation)" autofocus />
        <p v-if="firmDuplicate" class="form-error" role="alert">Bu firma bu lokasyonda zaten kayıtlı.</p>
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
        <div class="modal-actions">
          <button class="secondary-button" type="button" :disabled="saving" @click="firmLocation = null">{{ firmAfterLocation ? 'Şimdilik Atla' : 'İptal' }}</button>
          <button class="primary-button" type="button" :disabled="!canSaveFirm || saving || limitFull" @click="saveFirm">{{ saving ? 'Ekleniyor...' : 'Firmayı Ekle' }}</button>
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
import { normalizeCompanyName } from '~/composables/useExpertApi'
import type { Firm, FirmLocation, FirmNode, LocationDraft, WorkplaceProgress } from '~/composables/useFirmSetup'

definePageMeta({ layout: 'expert', middleware: 'expert' })

const route = useRoute()
const { get, del, errorMessage } = useExpertApi()
const { listFirms, loadStructure, addNode, addLocation, addWorkplace, workplaceLimitMessage } = useFirmSetup()
const { workplaces, load: loadWorkplaces } = useMyWorkplaces()
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

// İlk firma eklenene kadar yol gösterir. Adım 1 isteğe bağlı olduğu için lokasyon eklenince de tamamlanmış sayılır.
const hasFirm = computed(() => locations.value.some(l => workplacesOf(l).length > 0))
const setupDone = computed(() => hasFirm.value)
const setupSteps = computed(() => [
  ...(canBranch.value ? [{ title: firm.value?.type === 'public' ? 'Birimleri ekleyin' : 'Grup ve şirketleri ekleyin', text: 'Varsa ağaca ekleyin. Yoksa bu adımı geçin.', done: hasBranches.value || locations.value.length > 0 }] : []),
  { title: 'Lokasyon ekleyin', text: 'Bina, fabrika ya da şube. Ağaçta istediğiniz yere bağlayabilirsiniz.', done: locations.value.length > 0 },
  { title: 'Firmayı ekleyin', text: 'Lokasyonda çalışan firma. Bir lokasyonda birden çok firma olabilir.', done: hasFirm.value },
  { title: 'Ekipmanları girin', text: 'Firma eklenince lokasyonun yanında "Ekipmanlar" düğmesi çıkar.', done: false }
])
const currentStep = computed(() => setupSteps.value.findIndex(step => !step.done))

async function load() {
  error.value = ''
  try {
    await loadAccount()
    // Bu ekran yalnız bireysel uzman içindir; diğer hesaplar kendi sayfalarına döner.
    if (multiUser.value) return navigateTo('/expert/workplaces', { replace: true })
    const [firms, structure] = await Promise.all([listFirms(), loadStructure(String(route.params.id)), loadWorkplaces(true)])
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
    const created = locations.value.find(l => String(l.id) === String(id))
    if (created) openFirm(created, true)
  } catch (e: any) {
    formError.value = errorMessage(e, e?.message || 'Lokasyon eklenemedi. Tekrar deneyin.')
  } finally { saving.value = false }
}

// --- Lokasyona firma: lokasyon hazır olduğundan addWorkplace yalnız firmayı bağlar ---
const firmLocation = ref<FirmLocation | null>(null)
const firmAfterLocation = ref(false)
const flatten = (list: FirmNode[]): FirmNode[] => list.flatMap(n => [n, ...flatten(n.children || [])])
const nodeNames = computed(() => flatten(nodes.value).map(n => n.name))
const firmDuplicate = computed(() => firm.value?.type === 'corporate' && !!firmLocation.value && firmsOf(firmLocation.value).some(name => normalizeCompanyName(name) === normalizeCompanyName(draft.company.trim())))
const canSaveFirm = computed(() => !!draft.hazard && !firmDuplicate.value && (firm.value?.type !== 'corporate' || !!draft.company.trim()))
function openFirm(location: FirmLocation, afterLocation = false) {
  // Şahıs işletmesinde firma kendisidir; kamuda kart lokasyon adıyla açılır. Tek şirkette ilk firma varsayılan gelir.
  const type = firm.value?.type
  const company = type === 'individual' || (type === 'corporate' && !hasBranches.value && !workplacesOf(location).length) ? firm.value!.name : ''
  Object.assign(draft, newDraft(), { name: location.name, company })
  firmAfterLocation.value = afterLocation
  progress.value = { locationId: location.id }
  formError.value = ''
  limitFull.value = false
  firmLocation.value = location
  workplaceLimitMessage().then((message) => { limitFull.value = !!message; formError.value = message }).catch(() => {})
}
async function saveFirm() {
  if (!firm.value || !firmLocation.value || !canSaveFirm.value || saving.value) return
  saving.value = true
  formError.value = ''
  try {
    const limit = await workplaceLimitMessage()
    if (limit) { formError.value = limit; return }
    await addWorkplace(firm.value.id, firmLocation.value.organization_id ?? '', draft, firm.value.type, progress.value)
    // Pencere liste yenilendikten sonra kapanır; satır bir an firmasız görünmez.
    await load()
    firmLocation.value = null
  } catch (e: any) {
    formError.value = errorMessage(e, e?.message || 'Firma eklenemedi. Tekrar deneyin.')
  } finally { saving.value = false }
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
.steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; margin: 0 0 14px; padding: 0; list-style: none; }
.steps li { display: flex; gap: 10px; padding: 11px 12px; border: 1px solid var(--admin-border); border-radius: 10px; background: var(--admin-card, var(--admin-input)); }
.steps li.now { border-color: var(--pk-yellow); box-shadow: 0 0 0 2px var(--admin-accent-soft); }
.steps div { display: grid; gap: 2px; min-width: 0; }
.steps strong { color: var(--admin-heading); font-size: 13.5px; }
.steps small { color: var(--admin-muted); font-size: 12px; line-height: 1.4; }
.step-no { flex: none; width: 26px; height: 26px; display: grid; place-items: center; border-radius: 50%; background: var(--admin-soft); color: var(--admin-heading); font-size: 12.5px; font-weight: 700; }
.steps li.now .step-no { background: var(--pk-yellow); color: #111827; }
.steps li.done .step-no { background: #ecfdf3; color: #027a48; }
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
