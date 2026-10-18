<template>
  <div class="customers-page">
    <div class="page-head">
      <div>
        <div class="breadcrumb"><span>Ayarlar</span><i class="pi pi-angle-right" /><strong>{{ t.page }}</strong></div>
        <h1>{{ t.page }}</h1>
        <p>{{ t.intro }}</p>
      </div>
      <button class="primary-button" type="button" @click="wizardOpen = true">
        <i class="pi pi-plus" />
        <span>{{ t.add }}</span>
      </button>
    </div>

    <section class="table-card">
      <div class="toolbar">
        <div class="search-box">
          <i class="pi pi-search" />
          <input v-model="search" type="text" :placeholder="t.search" />
        </div>
      </div>

      <div v-if="notice" class="notice-row"><i class="pi pi-exclamation-triangle" /> {{ notice }}</div>
      <div v-if="loading" class="state-row">{{ t.loading }}</div>
      <div v-else-if="error" class="state-row error-state">{{ error }}</div>
      <div v-else-if="filteredCustomers.length === 0" class="state-row empty-state">
        <i class="pi pi-building" />
        <strong>{{ t.emptyTitle }}</strong>
        <span>{{ t.emptyText }}</span>
        <button v-if="!search" class="primary-button empty-button" type="button" @click="wizardOpen = true"><i class="pi pi-plus" /> {{ orgMode ? 'İlk organizasyonunuzu ekleyin' : 'İlk müşterinizi ekleyin' }}</button>
      </div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ t.nameCol }}</th>
              <th>Tür</th>
              <th>Lokasyon</th>
              <th>Firma</th>
              <th>Oluşturma Tarihi</th>
              <th class="actions-head">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="customer in filteredCustomers" :key="customer.id">
              <td>
                <div class="customer-name"><span class="customer-icon"><i class="pi pi-building" /></span><strong>{{ customer.name }}</strong></div>
              </td>
              <td>
                <span v-if="customerTypes[String(customer.id)]" class="type-chip">{{ customerTypeLabel(customerTypes[String(customer.id)]) }}</span>
                <span v-else class="muted-dash">—</span>
              </td>
              <td>{{ customer.locations_count ?? 0 }}</td>
              <td>{{ customer.firms_count ?? 0 }}</td>
              <td>{{ formatDate(customer.created_at) }}</td>
              <td class="actions">
                <button class="icon-button tree-button" type="button" :title="orgMode ? 'Yapıyı yönet' : 'Organizasyonu yönet'" @click="openOrganization(customer)">
                  <i class="pi pi-sitemap" />
                </button>
                <button class="icon-button delete-button" type="button" :title="orgMode ? 'Organizasyonu sil' : 'Müşteriyi sil'" @click="openDelete(customer)"><i class="pi pi-trash" /></button>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="table-footer"><span>Toplam {{ filteredCustomers.length }} {{ t.unit }}</span></div>
      </div>
    </section>

    <div v-if="organizationOpen" class="drawer-backdrop">
      <aside class="organization-drawer">
        <div class="drawer-head">
          <div>
            <h2>{{ orgMode ? 'Organizasyon Yapısı' : 'Müşteri Organizasyonu' }}</h2>
            <div class="drawer-customer"><i class="pi pi-building" /><div><strong>{{ selectedCustomer?.name }}</strong><span>Organizasyon yapısını yönetin.</span></div></div>
          </div>
          <button class="close-button" type="button" @click="closeOrganization"><i class="pi pi-times" /></button>
        </div>

        <div class="drawer-toolbar">
          <button class="primary-button small" type="button" @click="openOrganizationForm(orgMode ? rootNode : null)"><i class="pi pi-plus" /> Alt Organizasyon Ekle</button>
        </div>

        <div class="drawer-search search-box"><i class="pi pi-search" /><input v-model="organizationSearch" type="text" placeholder="Organizasyon ara..." /></div>

        <div v-if="organizationLoading" class="drawer-state">Organizasyonlar yükleniyor...</div>
        <div v-else-if="organizationError" class="drawer-state error-state">{{ organizationError }}</div>
        <div v-else-if="filteredTree.length === 0" class="drawer-state">{{ orgMode ? 'Bu organizasyonun yapısı boş.' : 'Bu müşteriye bağlı organizasyon bulunmuyor.' }}</div>
        <div v-else class="tree-list">
          <ExpertOrganizationNode
            v-for="node in filteredTree"
            :key="node.id"
            :node="node"
            :depth="0"
            @add-child="openOrganizationForm"
            @edit="openEditOrganizationForm"
            @delete="deleteOrganization"
          />
        </div>
      </aside>
    </div>

    <div v-if="customerFormOpen" class="modal-backdrop">
      <section class="modal-card wide">
        <div class="modal-head">
          <div class="head-title"><span class="head-icon"><i class="pi pi-building" /></span><div><h2>Müşteri Ekle</h2><p>Hizmet verdiğiniz şirketi, işletmeyi ya da kamu kurumunu ekleyin. Müşterinin altına organizasyon yapısını, lokasyonlarını ve işyerlerini sonra eklersiniz.</p></div></div>
          <button class="close-button" type="button" @click="closeCustomerForm"><i class="pi pi-times" /></button>
        </div>
        <label>Müşteri Adı <span>*</span><input v-model="customerName" type="text" placeholder="Örn. ABC Holding" /></label>
        <p class="field-hint"><i class="pi pi-info-circle" /> Listelerde ve raporlarda bu ad görünür. Grup şirketleri varsa en üstteki adı (holding ya da ana şirket) yazın.</p>
        <!-- Müşteri türü (kullanıcı 18 Ekim 2026): işyeri tanımlarken sorular buna göre değişir -->
        <div class="type-field">
          <span class="type-label">Müşteri Türü <span>*</span></span>
          <div class="type-options">
            <button v-for="ct in CUSTOMER_TYPES" :key="ct.id" type="button" class="type-option" :class="{ on: customerTypeChoice === ct.id }" @click="customerTypeChoice = ct.id">
              <i :class="ct.icon" /><span><strong>{{ ct.label }}</strong><small>{{ ct.text }}</small></span>
            </button>
          </div>
        </div>
        <p class="field-hint"><i class="pi pi-info-circle" /> Tür, işyeri tanımlarken sorulan soruları belirler: kamu kurumunda ve şahıs işletmesinde firma sorulmaz, kurumsal firmada hangi şirkete ait olduğu sorulur.</p>
        <label>Not <small>(Opsiyonel)</small><textarea v-model="customerNotes" rows="3" placeholder="Örn. sözleşme dönemi, yetkili kişi..."></textarea></label>
        <p class="field-hint"><i class="pi pi-info-circle" /> Hesaptaki kullanıcıların göreceği iç not; raporlara yazılmaz.</p>
        <div class="modal-actions"><button class="secondary-button" type="button" @click="closeCustomerForm">İptal</button><button class="primary-button" type="button" :disabled="saving || !customerTypeChoice" @click="createCustomer">{{ saving ? 'Kaydediliyor...' : 'Kaydet' }}</button></div>
      </section>
    </div>

    <!-- Müşteri silme: altındaki organizasyon, lokasyon, işyeri, ekipman ve kontrol raporlarıyla birlikte, kalıcı -->
    <div v-if="deleteTarget" class="modal-backdrop">
      <section class="modal-card wide">
        <div class="modal-head">
          <div class="head-title"><span class="head-icon danger"><i class="pi pi-trash" /></span><div><h2>{{ orgMode ? 'Organizasyonu Sil' : 'Müşteriyi Sil' }}</h2><p>"{{ deleteTarget.name }}" ve altındaki her şey kalıcı olarak silinir.</p></div></div>
          <button class="close-button" type="button" @click="closeDelete"><i class="pi pi-times" /></button>
        </div>
        <div class="info-box danger"><i class="pi pi-exclamation-triangle" /><span>Bu işlem <strong>geri alınamaz</strong>. Alt organizasyonlar, lokasyonlar, işyerleri, periyodik kontrol ekipmanları ve kontrol raporları (dosyalarıyla) birlikte silinir. Firma kartları silinmez; gerekirse Firmalar sayfasından ayrıca silebilirsiniz.</span></div>
        <p v-if="deleteSummaryLoading" class="muted-text">{{ orgMode ? 'Organizasyonun' : 'Müşterinin' }} altındaki kayıtlar hesaplanıyor...</p>
        <template v-else-if="deleteSummary">
          <p v-if="!deleteHasData" class="muted-text">Bu {{ orgMode ? 'organizasyonun' : 'müşterinin' }} altında kayıt yok.</p>
          <template v-else>
            <p class="muted-text">Birlikte silinecekler:</p>
            <ul class="delete-list">
              <li v-for="row in deleteRows" :key="row.label"><strong>{{ row.count }}</strong> {{ row.label }}</li>
            </ul>
          </template>
          <p v-if="deleteSummary.blockers.length" class="form-error">Silinemez: {{ deleteSummary.blockers.join(', ') }}.</p>
          <label v-else-if="deleteHasData">Onaylamak için {{ orgMode ? 'organizasyon' : 'müşteri' }} adını yazın<input v-model="deleteConfirm" type="text" :placeholder="deleteTarget.name" /></label>
        </template>
        <p v-if="deleteError" class="form-error">{{ deleteError }}</p>
        <div class="modal-actions"><button class="secondary-button" type="button" :disabled="deleting" @click="closeDelete">İptal</button><button class="danger-button" type="button" :disabled="!canDelete || deleting" @click="deleteCustomer">{{ deleting ? 'Siliniyor...' : 'Kalıcı olarak sil' }}</button></div>
      </section>
    </div>

    <!-- Organizasyon / müşteri ekleme: bireysel uzman ve OSGB aynı sihirbaz (OSGB'de "müşteri" denir; kullanıcı 18 Ekim 2026) -->
    <ExpertOrganizationWizard v-if="wizardOpen" :customer-mode="!orgMode" @close="wizardOpen = false" @created="onWizardCreated" />

    <div v-if="organizationFormOpen" class="modal-backdrop">
      <section class="modal-card wide">
        <div class="modal-head">
          <div class="head-title"><span class="head-icon"><i :class="editingOrganization ? 'pi pi-pencil' : 'pi pi-sitemap'" /></span><div><h2>{{ editingOrganization ? 'Organizasyonu Düzenle' : 'Alt Organizasyon Ekle' }}</h2><p v-if="editingOrganization">"{{ editingOrganization.name }}" organizasyonunun adını değiştirin.</p><p v-else>{{ organizationParent ? `"${organizationParent.name}" altına` : orgMode ? 'En üst düzeye' : 'Müşteri köküne' }} yeni bir alt organizasyon ekleyin.</p></div></div>
          <button class="close-button" type="button" @click="closeOrganizationForm"><i class="pi pi-times" /></button>
        </div>
        <div v-if="!editingOrganization" class="info-box"><i class="pi pi-lightbulb" /><span>Alt organizasyon, büyük yapılarda birimleri gruplamak içindir: daire başkanlığı, müdürlük, fabrika, bölge müdürlüğü gibi. Lokasyonlar bu organizasyonlara bağlanır; raporlar ve listeler organizasyona göre süzülebilir.</span></div>
        <label>Organizasyon Adı <span>*</span><input v-model="organizationName" type="text" :placeholder="editingOrganization ? editingOrganization.name : 'Örn. Üretim Müdürlüğü'" /></label>
        <p class="field-hint"><i class="pi pi-info-circle" /> {{ editingOrganization ? 'Yeni ad listelerde, lokasyonlarda ve raporlarda hemen görünür.' : 'Altına sonra başka organizasyonlar da ekleyebilirsiniz (+ düğmesi).' }}</p>
        <p v-if="organizationFormError" class="form-error">{{ organizationFormError }}</p>
        <div class="modal-actions"><button class="secondary-button" type="button" @click="closeOrganizationForm">İptal</button><button class="primary-button" type="button" :disabled="savingOrganization" @click="editingOrganization ? renameOrganization() : createOrganization()">{{ savingOrganization ? 'Kaydediliyor...' : 'Kaydet' }}</button></div>
      </section>
    </div>
  </div>
</template>
<script setup lang="ts">
import { CUSTOMER_TYPES, customerTypeLabel, type CustomerType } from '~/composables/useCustomerTypes'
definePageMeta({ layout: 'expert-settings', middleware: ['expert', 'expert-settings-role'] })

interface Customer { id: number | string; name: string; locations_count?: number; firms_count?: number; created_at?: string }
interface OrganizationNode { id: number | string; name: string; children?: OrganizationNode[] }

const config = useRuntimeConfig()
const { authHeaders, user } = useAuth()

const tenantHeaders = () => ({
  ...authHeaders(),
  ...(user.value?.tenant_id
    ? { 'X-Tenant-ID': String(user.value.tenant_id) }
    : {})
})

const customers = ref<Customer[]>([])
const loading = ref(true)
const error = ref('')
const search = ref('')
const organizationOpen = ref(false)
const organizationLoading = ref(false)
const organizationError = ref('')
const selectedCustomer = ref<Customer | null>(null)
const organizationTree = ref<OrganizationNode[]>([])
const organizationSearch = ref('')
const customerFormOpen = ref(false)
const customerName = ref('')
const customerNotes = ref('')
const saving = ref(false)
const organizationFormOpen = ref(false)
const organizationName = ref('')
const organizationParent = ref<OrganizationNode | null>(null)
const editingOrganization = ref<OrganizationNode | null>(null)
const organizationFormError = ref('')
const savingOrganization = ref(false)

// Bireysel uzman: "müşteri" kelimesi görünmez; sayfa "Organizasyon Yönetimi", ekleme sihirbazla (kullanıcı 18 Ekim 2026).
// Yalnız yazılar ve ekleme akışı değişir; istekler ve veri yapısı aynı (müşteri + aynı adla kök organizasyon).
const { account, multiUser, load: loadAccount } = useAccount()
const orgMode = computed(() => !multiUser.value)
const t = computed(() => orgMode.value ? {
  page: 'Organizasyon Yönetimi', intro: 'Hizmet verdiğiniz organizasyonları ve alt organizasyonlarını yönetin.', add: 'Organizasyon Ekle',
  search: 'Organizasyon ara', loading: 'Organizasyonlar yükleniyor...', emptyTitle: 'Henüz organizasyon yok',
  emptyText: 'Hizmet verdiğiniz şirket, işletme ya da kamu kurumunu ekleyerek başlayın.', nameCol: 'Organizasyon Adı', unit: 'organizasyon'
} : {
  page: 'Müşteriler', intro: 'Müşterilerinizi yönetin. Her müşteri için organizasyon yapısını hiyerarşik olarak oluşturabilirsiniz.', add: 'Müşteri Ekle',
  search: 'Müşteri ara', loading: 'Müşteriler yükleniyor...', emptyTitle: 'Henüz müşteri bulunmuyor',
  emptyText: 'İlk müşterinizi ekleyerek başlayabilirsiniz.', nameCol: 'Müşteri Adı', unit: 'müşteri'
})
// Müşteri türleri (pk-customer-types): listede "Tür" sütunu; OSGB Müşteri Ekle'de seçilir, bireysel uzmanda sihirbaz kaydeder.
const { load: loadCustomerTypes, save: saveCustomerType } = useCustomerTypes()
const customerTypes = ref<Record<string, CustomerType | null>>({})
const customerTypeChoice = ref<CustomerType | null>(null)
const wizardOpen = ref(false)
const notice = ref('')
const onWizardCreated = async (_id: number | string, warning: string) => {
  wizardOpen.value = false
  notice.value = warning
  await loadCustomers()
}
// Organizasyonun kendisi: ağacın en üstündeki, organizasyonla (müşteriyle) aynı adı taşıyan düğüm.
const rootNode = computed(() => organizationTree.value.find(n => n.name === selectedCustomer.value?.name) || null)

const filteredCustomers = computed(() => customers.value.filter(c => c.name.toLocaleLowerCase('tr-TR').includes(search.value.toLocaleLowerCase('tr-TR'))))
const filteredTree = computed(() => {
  const q = organizationSearch.value.trim().toLocaleLowerCase('tr-TR')
  if (!q) return organizationTree.value
  const filter = (nodes: OrganizationNode[]): OrganizationNode[] => nodes.flatMap(node => {
    const children = filter(node.children || [])
    return node.name.toLocaleLowerCase('tr-TR').includes(q) || children.length ? [{ ...node, children }] : []
  })
  return filter(organizationTree.value)
})

const unwrap = (response: any) => response?.data?.data ?? response?.data ?? response ?? []

const loadCustomers = async () => {
  loading.value = true
  error.value = ''
  try {
    // "Firma" sütunu: müşterinin lokasyonlarında işyeri olan firma sayısı (ayrı uç noktadan).
    const [response, companyCounts] = await Promise.all([
      $fetch(`${config.public.apiBaseUrl}/customers`, { headers: tenantHeaders() }),
      $fetch<Record<string, number>>(`${config.public.apiBaseUrl}/customer-company-counts`, { headers: tenantHeaders() }).catch(() => ({} as Record<string, number>))
    ])
    const data = unwrap(response)
    const list: Customer[] = Array.isArray(data) ? data : (data?.items || [])
    customers.value = list.map(customer => ({ ...customer, firms_count: companyCounts[String(customer.id)] ?? 0 }))
    customerTypes.value = await loadCustomerTypes()
  } catch (e: any) {
    error.value = e?.data?.message || 'Müşteriler alınamadı.'
  } finally { loading.value = false }
}

const openOrganization = async (customer: Customer) => {
  selectedCustomer.value = customer
  organizationOpen.value = true
  organizationLoading.value = true
  organizationError.value = ''
  organizationSearch.value = ''
  try {
    const response = await $fetch(`${config.public.apiBaseUrl}/customers/${customer.id}/organizations`, { headers: tenantHeaders() })
    const data = unwrap(response)
    organizationTree.value = Array.isArray(data) ? data : (data?.organizations || data?.items || data?.tree || [])
  } catch (e: any) {
    organizationError.value = e?.data?.message || 'Organizasyon ağacı alınamadı.'
  } finally { organizationLoading.value = false }
}

const closeOrganization = () => { organizationOpen.value = false; selectedCustomer.value = null; organizationTree.value = [] }
const openCustomerForm = () => { customerName.value = ''; customerNotes.value = ''; customerTypeChoice.value = null; customerFormOpen.value = true }
const closeCustomerForm = () => { if (!saving.value) customerFormOpen.value = false }
const openOrganizationForm = (parent: OrganizationNode | null) => { editingOrganization.value = null; organizationFormError.value = ''; organizationParent.value = parent; organizationName.value = ''; organizationFormOpen.value = true }
const openEditOrganizationForm = (node: OrganizationNode) => { editingOrganization.value = node; organizationFormError.value = ''; organizationParent.value = null; organizationName.value = node.name; organizationFormOpen.value = true }
const closeOrganizationForm = () => { if (!savingOrganization.value) organizationFormOpen.value = false }

// OSGB hesabında yeni müşteriye aynı adla kök organizasyon da açılır (üstteki Organizasyon kutusu müşterinin kökünden başlar).
const createCustomer = async () => {
  const name = customerName.value.trim()
  if (!name) return
  saving.value = true
  try {
    const created = unwrap(await $fetch(`${config.public.apiBaseUrl}/customers`, { method: 'POST', headers: tenantHeaders(), body: { name, notes: customerNotes.value.trim() || null } }))
    customerFormOpen.value = false
    await loadAccount()
    let rootError = ''
    if (created?.id && customerTypeChoice.value) {
      try { await saveCustomerType(created.id, customerTypeChoice.value) } catch { rootError = 'Müşteri oluşturuldu ama türü kaydedilemedi; ilk işyeri tanımlarken yeniden sorulur.' }
    }
    if (account.value?.type === 'osgb' && created?.id) {
      try {
        await $fetch(`${config.public.apiBaseUrl}/customers/${created.id}/organizations`, { method: 'POST', headers: tenantHeaders(), body: { name, parent_id: null, color: '#465FFF' } })
      } catch (e: any) {
        rootError = `Müşteri oluşturuldu ama kök organizasyon eklenemedi (${e?.data?.message || 'bilinmeyen hata'}); müşterinin organizasyon ağacından elle ekleyebilirsiniz.`
      }
    }
    await loadCustomers()
    if (rootError) error.value = rootError
  } catch (e: any) { error.value = e?.data?.message || 'Müşteri oluşturulamadı.' }
  finally { saving.value = false }
}

const createOrganization = async () => {
  if (!organizationName.value.trim() || !selectedCustomer.value) return
  savingOrganization.value = true
  try {
    await $fetch(`${config.public.apiBaseUrl}/customers/${selectedCustomer.value.id}/organizations`, {
      method: 'POST', headers: tenantHeaders(), body: { name: organizationName.value.trim(), parent_id: organizationParent.value?.id ?? null, color: '#465FFF' }
    })
    organizationFormOpen.value = false
    await openOrganization(selectedCustomer.value)
  } catch (e: any) { organizationError.value = e?.data?.message || 'Organizasyon oluşturulamadı.' }
  finally { savingOrganization.value = false }
}

const renameOrganization = async () => {
  const node = editingOrganization.value
  const name = organizationName.value.trim()
  if (!node || !name || !selectedCustomer.value) return
  if (name === node.name) { organizationFormOpen.value = false; return }
  savingOrganization.value = true
  organizationFormError.value = ''
  try {
    const isRoot = orgMode.value && node.id === rootNode.value?.id
    await $fetch(`${config.public.apiBaseUrl}/customers/${selectedCustomer.value.id}/organizations/${node.id}`, {
      method: 'PATCH', headers: tenantHeaders(), body: { name }
    })
    if (isRoot) {
      await $fetch(`${config.public.apiBaseUrl}/customers/${selectedCustomer.value.id}`, { method: 'PATCH', headers: tenantHeaders(), body: { name } })
      selectedCustomer.value = { ...selectedCustomer.value, name }
      loadCustomers()
    }
    organizationFormOpen.value = false
    await openOrganization(selectedCustomer.value)
  } catch (e: any) {
    const errors = e?.data?.errors
    organizationFormError.value = (errors && Object.values(errors).flat()[0] as string) || e?.data?.message || 'Organizasyon güncellenemedi.'
  } finally { savingOrganization.value = false }
}

const deleteOrganization = async (node: OrganizationNode) => {
  if (!selectedCustomer.value) return
  if (node.children?.length) { alert('Alt organizasyonları bulunan bir organizasyon silinemez. Önce alt organizasyonları silin.'); return }
  if (!confirm(`"${node.name}" organizasyonu silinsin mi?`)) return
  try {
    await $fetch(`${config.public.apiBaseUrl}/organizations/${node.id}`, { method: 'DELETE', headers: tenantHeaders() })
    await openOrganization(selectedCustomer.value)
  } catch (e: any) { alert(e?.data?.message || 'Organizasyon silinemedi.') }
}

// --- Müşteri silme: önce altındakiler sayılır; kayıt varsa onay için müşteri adı yazılır ---
interface DeleteSummary { organizations: number; locations: number; workplaces: number; equipment: number; inspections: number; blockers: string[] }
const { load: reloadWorkplaces } = useMyWorkplaces()
const deleteTarget = ref<Customer | null>(null)
const deleteSummary = ref<DeleteSummary | null>(null)
const deleteSummaryLoading = ref(false)
const deleteConfirm = ref('')
const deleteError = ref('')
const deleting = ref(false)
const deleteRows = computed(() => deleteSummary.value ? [
  { label: 'organizasyon', count: deleteSummary.value.organizations },
  { label: 'lokasyon', count: deleteSummary.value.locations },
  { label: 'işyeri', count: deleteSummary.value.workplaces },
  { label: 'periyodik kontrol ekipmanı', count: deleteSummary.value.equipment },
  { label: 'kontrol raporu (dosyalarıyla)', count: deleteSummary.value.inspections }
].filter(row => row.count > 0) : [])
const deleteHasData = computed(() => deleteRows.value.length > 0)
const canDelete = computed(() => !!deleteSummary.value && !deleteSummary.value.blockers.length
  && (!deleteHasData.value || deleteConfirm.value.trim().toLocaleLowerCase('tr-TR') === deleteTarget.value?.name.trim().toLocaleLowerCase('tr-TR')))

const openDelete = async (customer: Customer) => {
  deleteTarget.value = customer
  deleteSummary.value = null
  deleteConfirm.value = ''
  deleteError.value = ''
  deleteSummaryLoading.value = true
  try {
    deleteSummary.value = await $fetch<DeleteSummary>(`${config.public.apiBaseUrl}/customers/${customer.id}/purge-summary`, { headers: tenantHeaders() })
  } catch (e: any) { deleteError.value = e?.data?.message || 'Müşterinin kayıtları alınamadı.' }
  finally { deleteSummaryLoading.value = false }
}
const closeDelete = () => { if (!deleting.value) deleteTarget.value = null }
const deleteCustomer = async () => {
  if (!deleteTarget.value || !canDelete.value) return
  deleting.value = true
  deleteError.value = ''
  try {
    await $fetch(`${config.public.apiBaseUrl}/customers/${deleteTarget.value.id}/purge`, { method: 'DELETE', headers: tenantHeaders() })
    deleteTarget.value = null
    await loadCustomers()
    // Seçili çalışma alanı silinen lokasyondaysa temizlenir.
    reloadWorkplaces(true)
  } catch (e: any) {
    const errors = e?.data?.errors
    deleteError.value = (errors && Object.values(errors).flat()[0] as string) || e?.data?.message || 'Müşteri silinemedi.'
  } finally { deleting.value = false }
}

const formatDate =(value?: string) => value ? new Intl.DateTimeFormat('tr-TR').format(new Date(value)) : '—'

onMounted(loadCustomers)
</script>

<style scoped>
.customers-page { max-width: 1500px; margin: 0 auto; }
.page-head { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; margin-bottom:24px; }
.breadcrumb { display:flex; align-items:center; gap:8px; margin-bottom:10px; color:var(--admin-muted); font-size:12px; }.breadcrumb strong{color:var(--admin-heading)}
h1{margin:0;color:var(--admin-heading);font-size:30px;letter-spacing:-.7px}.page-head p{margin:7px 0 0;color:var(--admin-muted);font-size:13px}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:0 17px;border:0;border-radius:8px;background:var(--pk-yellow);color:#111827;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.07)}.primary-button.small{min-height:38px;padding:0 13px;font-size:12px}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.table-card{background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px;overflow:hidden}.toolbar{padding:18px 16px;border-bottom:1px solid var(--admin-border)}.search-box{height:42px;display:flex;align-items:center;gap:10px;padding:0 12px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-muted)}.search-box input{width:100%;border:0;outline:0;background:transparent;color:var(--admin-heading);font-size:13px}.search-box input::placeholder{color:var(--admin-muted)}
.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}th,td{padding:14px 16px;text-align:left;border-bottom:1px solid var(--admin-row-border);font-size:12px;color:var(--admin-muted)}th{font-size:11px;font-weight:700;color:var(--admin-muted);background:var(--admin-soft)}td strong{color:var(--admin-heading)}.actions-head{text-align:right}.actions{display:flex;justify-content:flex-end;gap:8px}.icon-button{width:34px;height:34px;display:grid;place-items:center;border:1px solid var(--admin-border);border-radius:7px;background:var(--admin-input);color:var(--admin-muted);cursor:pointer}.icon-button:hover,.tree-button:hover{border-color:#d7a900;color:var(--admin-heading);background:var(--admin-accent-soft)}.customer-name{display:flex;align-items:center;gap:10px}.customer-icon{width:30px;height:30px;display:grid;place-items:center;border-radius:7px;color:var(--admin-text);background:var(--admin-chip)}.table-footer{padding:14px 16px;color:var(--admin-muted);font-size:12px}.state-row{padding:80px 20px;text-align:center;color:var(--admin-muted)}.empty-state{display:flex;flex-direction:column;align-items:center;gap:7px}.empty-state i{font-size:30px;margin-bottom:4px}.empty-state strong{color:var(--admin-heading)}.error-state{color:var(--admin-danger-text)}
.drawer-backdrop,.modal-backdrop{position:fixed;inset:0;z-index:100;background:var(--admin-overlay)}.organization-drawer{position:absolute;top:0;right:0;width:min(430px,92vw);height:100%;background:var(--admin-input);box-shadow:-12px 0 30px var(--admin-shadow);display:flex;flex-direction:column}.drawer-head{padding:26px 20px 18px;border-bottom:1px solid var(--admin-border);display:flex;justify-content:space-between;gap:15px}.drawer-head h2{margin:0 0 18px;font-size:18px;color:var(--admin-heading)}.drawer-customer{display:flex;align-items:center;gap:11px}.drawer-customer>i{font-size:22px;color:var(--admin-text)}.drawer-customer div{display:flex;flex-direction:column;gap:3px}.drawer-customer strong{font-size:13px;color:var(--admin-heading)}.drawer-customer span{font-size:11px;color:var(--admin-muted)}.close-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:var(--admin-muted);cursor:pointer;border-radius:7px}.close-button:hover{background:var(--admin-hover);color:var(--admin-heading)}.drawer-toolbar{padding:14px 20px 10px;display:flex;justify-content:flex-end}.drawer-search{margin:0 20px 12px}.tree-list{padding:4px 18px 24px;overflow:auto}.drawer-state{padding:50px 25px;text-align:center;color:var(--admin-muted);font-size:12px}
.modal-backdrop{display:grid;place-items:center;padding:20px}.modal-card{width:min(430px,100%);padding:22px;background:var(--admin-input);border-radius:12px;box-shadow:0 20px 60px var(--admin-shadow)}.small-modal{width:min(400px,100%)}.modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:22px}.modal-head h2{margin:0;color:var(--admin-heading);font-size:18px}.modal-head p{margin:5px 0 0;color:var(--admin-muted);font-size:12px}.modal-card label{display:block;margin-bottom:16px;color:var(--admin-heading);font-size:12px;font-weight:700}.modal-card label span{color:var(--admin-danger-text)}.modal-card label small{font-weight:400;color:var(--admin-muted)}.modal-card input,.modal-card textarea{width:100%;margin-top:7px;padding:11px 12px;border:1px solid var(--admin-border);border-radius:8px;outline:0;background:var(--admin-input);font:inherit;font-size:13px;color:var(--admin-heading);resize:vertical}.modal-card input:focus,.modal-card textarea:focus{border-color:#d7a900;box-shadow:0 0 0 3px rgba(255,193,7,.12)}.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}.secondary-button{min-height:40px;padding:0 18px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-hover);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}
.form-error{margin:0 0 8px;color:var(--admin-danger-text);font-size:12px}
/* Organizasyon ve firma pencereleri (kullanıcı 18 Ekim 2026): geniş, ikonlu başlık ve alan açıklamaları; yalnız X / İptal ile kapanır. */
.modal-card.wide{width:min(640px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:24px 26px;border-radius:14px}
.head-title{display:flex;align-items:flex-start;gap:14px}
.head-icon{flex:none;width:44px;height:44px;display:grid;place-items:center;border-radius:12px;background:var(--pk-yellow);color:#111827;font-size:19px}
.head-icon.danger{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.modal-card.wide .modal-head p{font-size:12.5px;line-height:1.55}
.field-hint{display:flex;gap:7px;margin:-10px 0 16px;color:var(--admin-muted);font-size:12px;line-height:1.5}.field-hint .pi{margin-top:2px}
.info-box{display:flex;gap:10px;margin:0 0 18px;padding:12px 14px;border-radius:10px;background:var(--admin-accent-soft);color:var(--admin-text);font-size:12.5px;line-height:1.55}.info-box .pi{margin-top:3px;color:#b58900}
.info-box.danger{background:var(--admin-danger-bg);color:var(--admin-danger-text)}.info-box.danger .pi{color:var(--admin-danger-text)}

.empty-button{margin-top:12px}
.type-chip{display:inline-block;padding:3px 9px;border-radius:999px;background:var(--admin-chip);color:var(--admin-text);font-size:11px;font-weight:700;white-space:nowrap}
.muted-dash{color:var(--admin-muted)}
.type-field{margin-bottom:16px}.type-label{display:block;margin-bottom:7px;color:var(--admin-heading);font-size:12px;font-weight:700}.type-label span{color:var(--admin-danger-text)}
.type-options{display:grid;gap:8px}
.type-option{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--admin-border);border-radius:9px;background:var(--admin-input);text-align:left;cursor:pointer;font:inherit}
.type-option > .pi{width:32px;height:32px;display:grid;place-items:center;border-radius:8px;background:var(--admin-chip);color:var(--admin-heading)}
.type-option span{display:flex;flex-direction:column;gap:2px}.type-option strong{color:var(--admin-heading);font-size:12.5px}.type-option small{color:var(--admin-muted);font-size:11.5px}
.type-option:hover{border-color:#d7a900}.type-option.on{border-color:#d7a900;background:var(--admin-accent-soft)}.type-option.on > .pi{background:var(--pk-yellow);color:#111827}
.notice-row{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid var(--admin-border);background:var(--admin-accent-soft);color:var(--admin-heading);font-size:12px}
.delete-button:hover{border-color:var(--admin-danger-text);color:var(--admin-danger-text);background:var(--admin-danger-bg)}
.muted-text{margin:0 0 10px;color:var(--admin-muted);font-size:12px}
.delete-list{margin:0 0 16px;padding-left:18px;display:grid;gap:4px;color:var(--admin-text);font-size:13px}.delete-list strong{color:var(--admin-heading)}
.danger-button{min-height:40px;padding:0 18px;border:0;border-radius:8px;background:var(--admin-danger-text);color:#fff;font-size:12px;font-weight:800;cursor:pointer}.danger-button:disabled{opacity:.5;cursor:not-allowed}
@media(max-width:800px){.page-head{align-items:flex-start;flex-direction:column}.primary-button{align-self:flex-end}}
</style>
