<template>
  <div class="customers-page">
    <div class="page-head">
      <div>
        <div class="breadcrumb"><span>Uzman Paneli</span><i class="pi pi-angle-right" /><strong>Müşteriler</strong></div>
        <h1>Müşteriler</h1>
        <p>Müşterilerinizi yönetin. Her müşteri için organizasyon yapısını hiyerarşik olarak oluşturabilirsiniz.</p>
      </div>
      <button class="primary-button" type="button" @click="openCustomerForm">
        <i class="pi pi-plus" />
        <span>Müşteri Ekle</span>
      </button>
    </div>

    <section class="table-card">
      <div class="toolbar">
        <div class="search-box">
          <i class="pi pi-search" />
          <input v-model="search" type="text" placeholder="Müşteri ara" />
        </div>
      </div>

      <div v-if="loading" class="state-row">Müşteriler yükleniyor...</div>
      <div v-else-if="error" class="state-row error-state">{{ error }}</div>
      <div v-else-if="filteredCustomers.length === 0" class="state-row empty-state">
        <i class="pi pi-building" />
        <strong>Henüz müşteri bulunmuyor</strong>
        <span>İlk müşterinizi ekleyerek başlayabilirsiniz.</span>
      </div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Müşteri Adı</th>
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
              <td>{{ customer.locations_count ?? 0 }}</td>
              <td>{{ customer.firms_count ?? 0 }}</td>
              <td>{{ formatDate(customer.created_at) }}</td>
              <td class="actions">
                <button class="icon-button tree-button" type="button" title="Organizasyonu yönet" @click="openOrganization(customer)">
                  <i class="pi pi-sitemap" />
                </button>
                <button class="icon-button" type="button" title="Diğer işlemler"><i class="pi pi-ellipsis-h" /></button>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="table-footer"><span>Toplam {{ filteredCustomers.length }} müşteri</span></div>
      </div>
    </section>

    <div v-if="organizationOpen" class="drawer-backdrop" @click.self="closeOrganization">
      <aside class="organization-drawer">
        <div class="drawer-head">
          <div>
            <h2>Müşteri Organizasyonu</h2>
            <div class="drawer-customer"><i class="pi pi-building" /><div><strong>{{ selectedCustomer?.name }}</strong><span>Organizasyon yapısını yönetin.</span></div></div>
          </div>
          <button class="close-button" type="button" @click="closeOrganization"><i class="pi pi-times" /></button>
        </div>

        <div class="drawer-toolbar">
          <button class="primary-button small" type="button" @click="openOrganizationForm(null)"><i class="pi pi-plus" /> Alt Organizasyon Ekle</button>
        </div>

        <div class="drawer-search search-box"><i class="pi pi-search" /><input v-model="organizationSearch" type="text" placeholder="Organizasyon ara..." /></div>

        <div v-if="organizationLoading" class="drawer-state">Organizasyonlar yükleniyor...</div>
        <div v-else-if="organizationError" class="drawer-state error-state">{{ organizationError }}</div>
        <div v-else-if="filteredTree.length === 0" class="drawer-state">Bu müşteriye bağlı organizasyon bulunmuyor.</div>
        <div v-else class="tree-list">
          <OrganizationNode
            v-for="node in filteredTree"
            :key="node.id"
            :node="node"
            :depth="0"
            @add-child="openOrganizationForm"
          />
        </div>
      </aside>
    </div>

    <div v-if="customerFormOpen" class="modal-backdrop" @click.self="closeCustomerForm">
      <section class="modal-card">
        <div class="modal-head"><div><h2>Müşteri Ekle</h2><p>Yeni müşteri kaydı oluşturun.</p></div><button class="close-button" type="button" @click="closeCustomerForm"><i class="pi pi-times" /></button></div>
        <label>Müşteri Adı <span>*</span><input v-model="customerName" type="text" placeholder="Örn. Koç Holding" /></label>
        <label>Not <small>(Opsiyonel)</small><textarea v-model="customerNotes" rows="3" placeholder="Müşteri ile ilgili notlar..."></textarea></label>
        <div class="modal-actions"><button class="secondary-button" type="button" @click="closeCustomerForm">İptal</button><button class="primary-button" type="button" :disabled="saving" @click="createCustomer">{{ saving ? 'Kaydediliyor...' : 'Kaydet' }}</button></div>
      </section>
    </div>

    <div v-if="organizationFormOpen" class="modal-backdrop" @click.self="closeOrganizationForm">
      <section class="modal-card small-modal">
        <div class="modal-head"><div><h2>Organizasyon Ekle</h2><p>{{ organizationParent ? `${organizationParent.name} altına` : 'Müşteri köküne' }} yeni organizasyon ekleyin.</p></div><button class="close-button" type="button" @click="closeOrganizationForm"><i class="pi pi-times" /></button></div>
        <label>Organizasyon Adı <span>*</span><input v-model="organizationName" type="text" placeholder="Örn. Dayanıklı Tüketim" /></label>
        <div class="modal-actions"><button class="secondary-button" type="button" @click="closeOrganizationForm">İptal</button><button class="primary-button" type="button" :disabled="savingOrganization" @click="createOrganization">{{ savingOrganization ? 'Kaydediliyor...' : 'Kaydet' }}</button></div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'expert', middleware: 'expert' })

interface Customer { id: number | string; name: string; locations_count?: number; firms_count?: number; created_at?: string }
interface OrganizationNode { id: number | string; name: string; children?: OrganizationNode[] }

const config = useRuntimeConfig()
const { authHeaders } = useAuth()
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
const savingOrganization = ref(false)

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
    const response = await $fetch(`${config.public.apiBaseUrl}/customers`, { headers: authHeaders() })
    const data = unwrap(response)
    customers.value = Array.isArray(data) ? data : (data?.items || [])
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
    const response = await $fetch(`${config.public.apiBaseUrl}/customers/${customer.id}/organizations`, { headers: authHeaders() })
    const data = unwrap(response)
    organizationTree.value = Array.isArray(data) ? data : (data?.items || data?.tree || [])
  } catch (e: any) {
    organizationError.value = e?.data?.message || 'Organizasyon ağacı alınamadı.'
  } finally { organizationLoading.value = false }
}

const closeOrganization = () => { organizationOpen.value = false; selectedCustomer.value = null; organizationTree.value = [] }
const openCustomerForm = () => { customerName.value = ''; customerNotes.value = ''; customerFormOpen.value = true }
const closeCustomerForm = () => { if (!saving.value) customerFormOpen.value = false }
const openOrganizationForm = (parent: OrganizationNode | null) => { organizationParent.value = parent; organizationName.value = ''; organizationFormOpen.value = true }
const closeOrganizationForm = () => { if (!savingOrganization.value) organizationFormOpen.value = false }

const createCustomer = async () => {
  if (!customerName.value.trim()) return
  saving.value = true
  try {
    await $fetch(`${config.public.apiBaseUrl}/customers`, { method: 'POST', headers: authHeaders(), body: { name: customerName.value.trim(), notes: customerNotes.value.trim() || null } })
    customerFormOpen.value = false
    await loadCustomers()
  } catch (e: any) { error.value = e?.data?.message || 'Müşteri oluşturulamadı.' }
  finally { saving.value = false }
}

const createOrganization = async () => {
  if (!organizationName.value.trim() || !selectedCustomer.value) return
  savingOrganization.value = true
  try {
    await $fetch(`${config.public.apiBaseUrl}/customers/${selectedCustomer.value.id}/organizations`, {
      method: 'POST', headers: authHeaders(), body: { name: organizationName.value.trim(), parent_id: organizationParent.value?.id ?? null }
    })
    organizationFormOpen.value = false
    await openOrganization(selectedCustomer.value)
  } catch (e: any) { organizationError.value = e?.data?.message || 'Organizasyon oluşturulamadı.' }
  finally { savingOrganization.value = false }
}

const formatDate = (value?: string) => value ? new Intl.DateTimeFormat('tr-TR').format(new Date(value)) : '—'

onMounted(loadCustomers)
</script>

<style scoped>
.customers-page { max-width: 1500px; margin: 0 auto; }
.page-head { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; margin-bottom:24px; }
.breadcrumb { display:flex; align-items:center; gap:8px; margin-bottom:10px; color:var(--admin-muted); font-size:12px; }.breadcrumb strong{color:var(--admin-heading)}
h1{margin:0;color:var(--admin-heading);font-size:30px;letter-spacing:-.7px}.page-head p{margin:7px 0 0;color:var(--admin-muted);font-size:13px}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:0 17px;border:0;border-radius:8px;background:var(--pk-yellow);color:#111827;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.07)}.primary-button.small{min-height:38px;padding:0 13px;font-size:12px}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.table-card{background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px;overflow:hidden}.toolbar{padding:18px 16px;border-bottom:1px solid var(--admin-border)}.search-box{height:42px;display:flex;align-items:center;gap:10px;padding:0 12px;border:1px solid var(--admin-border);border-radius:8px;background:#fff;color:#8a96a8}.search-box input{width:100%;border:0;outline:0;background:transparent;color:var(--admin-heading);font-size:13px}.search-box input::placeholder{color:#8a96a8}
.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}th,td{padding:14px 16px;text-align:left;border-bottom:1px solid #edf0f5;font-size:12px;color:var(--admin-muted)}th{font-size:11px;font-weight:700;color:#667085;background:#fbfcfe}td strong{color:var(--admin-heading)}.actions-head{text-align:right}.actions{display:flex;justify-content:flex-end;gap:8px}.icon-button{width:34px;height:34px;display:grid;place-items:center;border:1px solid var(--admin-border);border-radius:7px;background:#fff;color:#68758a;cursor:pointer}.icon-button:hover,.tree-button:hover{border-color:#d7a900;color:#111827;background:#fff9df}.customer-name{display:flex;align-items:center;gap:10px}.customer-icon{width:30px;height:30px;display:grid;place-items:center;border-radius:7px;color:#2b3442;background:#f2f4f7}.table-footer{padding:14px 16px;color:var(--admin-muted);font-size:12px}.state-row{padding:80px 20px;text-align:center;color:var(--admin-muted)}.empty-state{display:flex;flex-direction:column;align-items:center;gap:7px}.empty-state i{font-size:30px;margin-bottom:4px}.empty-state strong{color:var(--admin-heading)}.error-state{color:#b42318}
.drawer-backdrop,.modal-backdrop{position:fixed;inset:0;z-index:100;background:rgba(15,23,42,.16)}.organization-drawer{position:absolute;top:0;right:0;width:min(430px,92vw);height:100%;background:#fff;box-shadow:-12px 0 30px rgba(15,23,42,.10);display:flex;flex-direction:column}.drawer-head{padding:26px 20px 18px;border-bottom:1px solid var(--admin-border);display:flex;justify-content:space-between;gap:15px}.drawer-head h2{margin:0 0 18px;font-size:18px;color:var(--admin-heading)}.drawer-customer{display:flex;align-items:center;gap:11px}.drawer-customer>i{font-size:22px;color:#263140}.drawer-customer div{display:flex;flex-direction:column;gap:3px}.drawer-customer strong{font-size:13px;color:var(--admin-heading)}.drawer-customer span{font-size:11px;color:var(--admin-muted)}.close-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:#7b8798;cursor:pointer;border-radius:7px}.close-button:hover{background:#f3f5f8;color:#111827}.drawer-toolbar{padding:14px 20px 10px;display:flex;justify-content:flex-end}.drawer-search{margin:0 20px 12px}.tree-list{padding:4px 18px 24px;overflow:auto}.drawer-state{padding:50px 25px;text-align:center;color:var(--admin-muted);font-size:12px}
.modal-backdrop{display:grid;place-items:center;padding:20px}.modal-card{width:min(430px,100%);padding:22px;background:#fff;border-radius:12px;box-shadow:0 20px 60px rgba(15,23,42,.18)}.small-modal{width:min(400px,100%)}.modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:22px}.modal-head h2{margin:0;color:var(--admin-heading);font-size:18px}.modal-head p{margin:5px 0 0;color:var(--admin-muted);font-size:12px}.modal-card label{display:block;margin-bottom:16px;color:var(--admin-heading);font-size:12px;font-weight:700}.modal-card label span{color:#d92d20}.modal-card label small{font-weight:400;color:var(--admin-muted)}.modal-card input,.modal-card textarea{width:100%;margin-top:7px;padding:11px 12px;border:1px solid var(--admin-border);border-radius:8px;outline:0;font:inherit;font-size:13px;color:var(--admin-heading);resize:vertical}.modal-card input:focus,.modal-card textarea:focus{border-color:#d7a900;box-shadow:0 0 0 3px rgba(255,193,7,.12)}.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}.secondary-button{min-height:40px;padding:0 18px;border:1px solid var(--admin-border);border-radius:8px;background:#f7f8fa;color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}
@media(max-width:800px){.page-head{align-items:flex-start;flex-direction:column}.primary-button{align-self:flex-end}}
</style>
