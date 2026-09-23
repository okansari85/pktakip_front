<template>
  <div class="locations-page">
    <div class="page-head">
      <div>
        <div class="breadcrumb"><span>Uzman Paneli</span><i class="pi pi-angle-right" /><strong>Lokasyonlar</strong></div>
        <h1>Lokasyonlar</h1>
        <p>Müşteri ve organizasyon seçerek lokasyonları görüntüleyin ve yeni lokasyon ekleyin.</p>
      </div>
      <button class="primary-button" type="button" :disabled="!selectedCustomerId || organizationOptions.length === 0" @click="openLocationForm">
        <i class="pi pi-plus" />
        <span>Lokasyon Ekle</span>
      </button>
    </div>

    <section class="table-card">
      <div class="toolbar">
        <label class="field">
          <span>Müşteri</span>
          <select v-model="selectedCustomerId" @change="onCustomerChange">
            <option :value="null" disabled>Müşteri seçin</option>
            <option v-for="customer in customers" :key="customer.id" :value="customer.id">{{ customer.name }}</option>
          </select>
        </label>
        <label class="field">
          <span>Organizasyon</span>
          <select v-model="selectedOrganizationId" :disabled="!selectedCustomerId">
            <option :value="null">Tüm organizasyonlar</option>
            <option v-for="option in organizationOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
          </select>
        </label>
        <div class="search-box">
          <i class="pi pi-search" />
          <input v-model="search" type="text" placeholder="Lokasyon ara" />
        </div>
      </div>

      <div v-if="customersLoading" class="state-row">Müşteriler yükleniyor...</div>
      <div v-else-if="error" class="state-row error-state">{{ error }}</div>
      <div v-else-if="!selectedCustomerId" class="state-row empty-state">
        <i class="pi pi-building" />
        <strong>Müşteri seçin</strong>
        <span>Lokasyonları görmek için önce bir müşteri seçin.</span>
      </div>
      <div v-else-if="locationsLoading" class="state-row">Lokasyonlar yükleniyor...</div>
      <div v-else-if="filteredLocations.length === 0" class="state-row empty-state">
        <i class="pi pi-map-marker" />
        <strong>Lokasyon bulunmuyor</strong>
        <span v-if="organizationOptions.length === 0">Bu müşterinin organizasyonu yok. Önce Müşteriler sayfasından organizasyon ekleyin.</span>
        <span v-else>Seçili organizasyon için ilk lokasyonu ekleyebilirsiniz.</span>
      </div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Lokasyon Adı</th>
              <th>Organizasyon</th>
              <th>İl / İlçe</th>
              <th>Adres</th>
              <th>Oluşturma Tarihi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="location in filteredLocations" :key="location.id">
              <td><div class="location-name"><span class="location-icon"><i class="pi pi-map-marker" /></span><strong>{{ location.name }}</strong></div></td>
              <td>{{ location.organization_name || '—' }}</td>
              <td>{{ [location.city, location.district].filter(Boolean).join(' / ') || '—' }}</td>
              <td class="address-cell">{{ location.address || '—' }}</td>
              <td>{{ formatDate(location.created_at) }}</td>
            </tr>
          </tbody>
        </table>
        <div class="table-footer"><span>Toplam {{ filteredLocations.length }} lokasyon</span></div>
      </div>
    </section>

    <div v-if="locationFormOpen" class="modal-backdrop" @click.self="closeLocationForm">
      <section class="modal-card">
        <div class="modal-head">
          <div><h2>Lokasyon Ekle</h2><p>{{ selectedCustomer?.name }} için yeni lokasyon oluşturun.</p></div>
          <button class="close-button" type="button" @click="closeLocationForm"><i class="pi pi-times" /></button>
        </div>
        <label>Organizasyon <span>*</span>
          <select v-model="form.organization_id">
            <option :value="null" disabled>Organizasyon seçin</option>
            <option v-for="option in organizationOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
          </select>
        </label>
        <label>Lokasyon Adı <span>*</span><input v-model="form.name" type="text" placeholder="Örn. Kadıköy Şubesi" /></label>
        <div class="form-row">
          <label>İl
            <select v-model="form.city_id" @change="onCityChange">
              <option :value="null">Seçiniz</option>
              <option v-for="city in cities" :key="city.id" :value="city.id">{{ city.name }}</option>
            </select>
          </label>
          <label>İlçe
            <select v-model="form.district_id" :disabled="!form.city_id">
              <option :value="null">Seçiniz</option>
              <option v-for="district in districts" :key="district.id" :value="district.id">{{ district.name }}</option>
            </select>
          </label>
        </div>
        <label>Adres <small>(Opsiyonel)</small><textarea v-model="form.address" rows="3" placeholder="Açık adres..."></textarea></label>
        <p v-if="formError" class="form-error">{{ formError }}</p>
        <div class="modal-actions">
          <button class="secondary-button" type="button" @click="closeLocationForm">İptal</button>
          <button class="primary-button" type="button" :disabled="saving || !form.name.trim() || !form.organization_id" @click="createLocation">{{ saving ? 'Kaydediliyor...' : 'Kaydet' }}</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'expert', middleware: 'expert' })

interface Customer { id: number; name: string }
interface OrganizationNode { id: number; name: string; children?: OrganizationNode[] }
interface Location { id: number; name: string; address?: string | null; city?: string | null; district?: string | null; organization_id?: number | null; organization_name?: string | null; created_at?: string }
interface Option { id: number; name: string }

const config = useRuntimeConfig()
const { authHeaders, user } = useAuth()
const tenantHeaders = () => ({
  ...authHeaders(),
  ...(user.value?.tenant_id ? { 'X-Tenant-ID': String(user.value.tenant_id) } : {})
})
const api = (path: string) => `${config.public.apiBaseUrl}${path}`
const unwrap = (response: any) => response?.data?.data ?? response?.data ?? response ?? []

const customers = ref<Customer[]>([])
const customersLoading = ref(true)
const error = ref('')
const selectedCustomerId = ref<number | null>(null)
const selectedOrganizationId = ref<number | null>(null)
const organizationTree = ref<OrganizationNode[]>([])
const locations = ref<Location[]>([])
const locationsLoading = ref(false)
const search = ref('')

const cities = ref<Option[]>([])
const districts = ref<Option[]>([])
const locationFormOpen = ref(false)
const saving = ref(false)
const formError = ref('')
const form = reactive({ organization_id: null as number | null, name: '', city_id: null as number | null, district_id: null as number | null, address: '' })

const selectedCustomer = computed(() => customers.value.find(c => c.id === selectedCustomerId.value) || null)

// Ağacı girintili seçenek listesine çevirir.
const organizationOptions = computed(() => {
  const options: { id: number; label: string }[] = []
  const walk = (nodes: OrganizationNode[], depth: number) => nodes.forEach(node => {
    options.push({ id: node.id, label: `${'   '.repeat(depth)}${depth ? '└ ' : ''}${node.name}` })
    walk(node.children || [], depth + 1)
  })
  walk(organizationTree.value, 0)
  return options
})

// Seçili organizasyon ve alt organizasyonlarının id'leri.
const selectedOrganizationIds = computed(() => {
  if (!selectedOrganizationId.value) return null
  const ids = new Set<number>()
  const collect = (node: OrganizationNode) => { ids.add(node.id); (node.children || []).forEach(collect) }
  const find = (nodes: OrganizationNode[]): boolean => nodes.some(node => node.id === selectedOrganizationId.value ? (collect(node), true) : find(node.children || []))
  find(organizationTree.value)
  return ids
})

const filteredLocations = computed(() => {
  const q = search.value.trim().toLocaleLowerCase('tr-TR')
  return locations.value.filter(location =>
    (!selectedOrganizationIds.value || (location.organization_id != null && selectedOrganizationIds.value.has(location.organization_id))) &&
    (!q || location.name.toLocaleLowerCase('tr-TR').includes(q))
  )
})

const loadCustomers = async () => {
  customersLoading.value = true
  error.value = ''
  try {
    const data = unwrap(await $fetch(api('/customers'), { headers: tenantHeaders() }))
    customers.value = Array.isArray(data) ? data : (data?.items || [])
  } catch (e: any) {
    error.value = e?.data?.message || 'Müşteriler alınamadı.'
  } finally { customersLoading.value = false }
}

const loadCustomerData = async () => {
  if (!selectedCustomerId.value) return
  locationsLoading.value = true
  error.value = ''
  try {
    const [treeResponse, locationResponse] = await Promise.all([
      $fetch(api(`/customers/${selectedCustomerId.value}/organizations`), { headers: tenantHeaders() }),
      $fetch(api(`/customers/${selectedCustomerId.value}/locations`), { headers: tenantHeaders() })
    ])
    const tree = unwrap(treeResponse)
    organizationTree.value = Array.isArray(tree) ? tree : (tree?.organizations || [])
    const list = unwrap(locationResponse)
    locations.value = Array.isArray(list) ? list : []
  } catch (e: any) {
    error.value = e?.data?.message || 'Lokasyonlar alınamadı.'
  } finally { locationsLoading.value = false }
}

const onCustomerChange = () => {
  selectedOrganizationId.value = null
  organizationTree.value = []
  locations.value = []
  loadCustomerData()
}

const loadCities = async () => {
  if (cities.value.length) return
  try { cities.value = unwrap(await $fetch(api('/cities'), { headers: tenantHeaders() })) } catch { cities.value = [] }
}

const onCityChange = async () => {
  form.district_id = null
  districts.value = []
  if (!form.city_id) return
  try { districts.value = unwrap(await $fetch(api(`/cities/${form.city_id}/districts`), { headers: tenantHeaders() })) } catch { districts.value = [] }
}

const openLocationForm = () => {
  Object.assign(form, { organization_id: selectedOrganizationId.value, name: '', city_id: null, district_id: null, address: '' })
  districts.value = []
  formError.value = ''
  locationFormOpen.value = true
  loadCities()
}
const closeLocationForm = () => { if (!saving.value) locationFormOpen.value = false }

const createLocation = async () => {
  if (!selectedCustomerId.value || !form.organization_id || !form.name.trim()) return
  saving.value = true
  formError.value = ''
  try {
    await $fetch(api(`/customers/${selectedCustomerId.value}/organizations/${form.organization_id}/locations`), {
      method: 'POST',
      headers: tenantHeaders(),
      body: { name: form.name.trim(), city_id: form.city_id, district_id: form.district_id, address: form.address.trim() || null }
    })
    locationFormOpen.value = false
    await loadCustomerData()
  } catch (e: any) {
    const errors = e?.data?.errors
    formError.value = (errors && Object.values(errors).flat()[0] as string) || e?.data?.message || 'Lokasyon oluşturulamadı.'
  } finally { saving.value = false }
}

const formatDate = (value?: string) => value ? new Intl.DateTimeFormat('tr-TR').format(new Date(value)) : '—'

onMounted(loadCustomers)
</script>

<style scoped>
.locations-page { max-width: 1500px; margin: 0 auto; }
.page-head { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; margin-bottom:24px; }
.breadcrumb { display:flex; align-items:center; gap:8px; margin-bottom:10px; color:var(--admin-muted); font-size:12px; }.breadcrumb strong{color:var(--admin-heading)}
h1{margin:0;color:var(--admin-heading);font-size:30px;letter-spacing:-.7px}.page-head p{margin:7px 0 0;color:var(--admin-muted);font-size:13px}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:0 17px;border:0;border-radius:8px;background:var(--pk-yellow);color:#111827;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.07)}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.table-card{background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px;overflow:hidden}
.toolbar{padding:18px 16px;border-bottom:1px solid var(--admin-border);display:grid;grid-template-columns:minmax(180px,260px) minmax(200px,320px) 1fr;gap:12px;align-items:end}
.field{display:flex;flex-direction:column;gap:6px;font-size:11px;font-weight:700;color:#667085}
.field select,.modal-card select{height:42px;padding:0 10px;border:1px solid var(--admin-border);border-radius:8px;background:#fff;color:var(--admin-heading);font:inherit;font-size:13px;outline:0}
.field select:focus,.modal-card select:focus{border-color:#d7a900;box-shadow:0 0 0 3px rgba(255,193,7,.12)}
.search-box{height:42px;display:flex;align-items:center;gap:10px;padding:0 12px;border:1px solid var(--admin-border);border-radius:8px;background:#fff;color:#8a96a8}.search-box input{width:100%;border:0;outline:0;background:transparent;color:var(--admin-heading);font-size:13px}.search-box input::placeholder{color:#8a96a8}
.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}th,td{padding:14px 16px;text-align:left;border-bottom:1px solid #edf0f5;font-size:12px;color:var(--admin-muted)}th{font-size:11px;font-weight:700;color:#667085;background:#fbfcfe}td strong{color:var(--admin-heading)}
.address-cell{max-width:320px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.location-name{display:flex;align-items:center;gap:10px}.location-icon{width:30px;height:30px;display:grid;place-items:center;border-radius:7px;color:#2b3442;background:#f2f4f7}
.table-footer{padding:14px 16px;color:var(--admin-muted);font-size:12px}.state-row{padding:80px 20px;text-align:center;color:var(--admin-muted)}.empty-state{display:flex;flex-direction:column;align-items:center;gap:7px}.empty-state i{font-size:30px;margin-bottom:4px}.empty-state strong{color:var(--admin-heading)}.error-state{color:#b42318}
.modal-backdrop{position:fixed;inset:0;z-index:100;background:rgba(15,23,42,.16);display:grid;place-items:center;padding:20px}
.modal-card{width:min(480px,100%);padding:22px;background:#fff;border-radius:12px;box-shadow:0 20px 60px rgba(15,23,42,.18)}
.modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:22px}.modal-head h2{margin:0;color:var(--admin-heading);font-size:18px}.modal-head p{margin:5px 0 0;color:var(--admin-muted);font-size:12px}
.close-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:#7b8798;cursor:pointer;border-radius:7px}.close-button:hover{background:#f3f5f8;color:#111827}
.modal-card label{display:flex;flex-direction:column;margin-bottom:16px;color:var(--admin-heading);font-size:12px;font-weight:700}.modal-card label span{color:#d92d20}.modal-card label small{font-weight:400;color:var(--admin-muted)}
.modal-card select{margin-top:7px;width:100%}
.modal-card input,.modal-card textarea{width:100%;margin-top:7px;padding:11px 12px;border:1px solid var(--admin-border);border-radius:8px;outline:0;font:inherit;font-size:13px;color:var(--admin-heading);resize:vertical}.modal-card input:focus,.modal-card textarea:focus{border-color:#d7a900;box-shadow:0 0 0 3px rgba(255,193,7,.12)}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.form-error{margin:0 0 8px;color:#b42318;font-size:12px}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}.secondary-button{min-height:40px;padding:0 18px;border:1px solid var(--admin-border);border-radius:8px;background:#f7f8fa;color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}
@media(max-width:900px){.toolbar{grid-template-columns:1fr}.page-head{align-items:flex-start;flex-direction:column}.primary-button{align-self:flex-end}.form-row{grid-template-columns:1fr}}
</style>
