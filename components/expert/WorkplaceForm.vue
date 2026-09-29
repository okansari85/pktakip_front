<template>
  <div class="modal-backdrop" @click.self="close">
    <section class="modal-card">
      <div class="modal-head">
        <div>
          <h2>İşyeri Ekle</h2>
          <p v-if="location">{{ location.name }} lokasyonuna firma ekleyin. Firmaya siz uzman olarak atanırsınız.</p>
          <p v-else>{{ corporate ? 'Lokasyon' : 'Müşteri ve lokasyon' }} seçip firma ekleyin. Firmaya siz uzman olarak atanırsınız.</p>
        </div>
        <button class="close-button" type="button" @click="close"><i class="pi pi-times" /></button>
      </div>

      <template v-if="!location">
        <div class="form-row">
          <!-- Kurumsal hesapta müşteri firmanın kendisi: otomatik seçili, kutu yok -->
          <label v-if="!corporate">Müşteri <span>*</span>
            <select v-model="customerId" @change="onCustomerChange">
              <option :value="null" disabled>Müşteri seçin</option>
              <option v-for="customer in customers" :key="customer.id" :value="customer.id">{{ customer.name }}</option>
            </select>
          </label>
          <label>Lokasyon <span>*</span>
            <select v-model="locationId" :disabled="!customerId" @change="loadAttached">
              <option :value="null" disabled>{{ customerId && customerLocations.length === 0 ? 'Lokasyon yok' : 'Lokasyon seçin' }}</option>
              <option v-for="item in customerLocations" :key="item.id" :value="item.id">{{ item.name }}</option>
            </select>
          </label>
        </div>
      </template>

      <label>Firma <span>*</span>
        <select v-model="companySelection" @change="onCompanySelect">
          <option :value="null" disabled>{{ ownCompanies.length || freeCompanies.length ? 'Firma seçin' : 'Bu müşterinin firması yok — yeni firma oluşturun' }}</option>
          <optgroup v-if="ownPlain.length" label="Bu müşterinin firmaları">
            <option v-for="company in ownPlain" :key="company.business_entity_id" :value="company.business_entity_id">{{ company.name }}</option>
          </optgroup>
          <!-- Ünvanlı (görünen adlı) firmalar: adı · ünvanı -->
          <optgroup v-if="ownTitled.length" label="Görünen adlı firmalar">
            <option v-for="company in ownTitled" :key="company.business_entity_id" :value="company.business_entity_id">{{ company.name }} · {{ titleOf[company.business_entity_id] }}</option>
          </optgroup>
          <optgroup v-if="freeCompanies.length" label="Henüz bir müşteride işyeri olmayan firmalar">
            <option v-for="company in freeCompanies" :key="company.business_entity_id" :value="company.business_entity_id">{{ company.name }}{{ titleOf[company.business_entity_id] ? ` · ${titleOf[company.business_entity_id]}` : '' }}</option>
          </optgroup>
          <option :value="NEW_COMPANY">+ Yeni firma oluştur</option>
        </select>
      </label>

      <!-- Görünen ad: aynı şirketin bu lokasyondaki işletmesi / bölümü; o adla firma eklenir, ünvanı seçilen firma olur -->
      <label v-if="companySelection !== NEW_COMPANY">Görünen ad <small>(Opsiyonel)</small>
        <input v-model="displayName" type="text" placeholder="Örn. Beyaz Eşya Depo — boş bırakılırsa firma kendi adıyla eklenir" />
      </label>
      <p v-if="displayNameHint" class="hint" :class="{ warn: displayNameBlocked }">{{ displayNameHint }}</p>

      <div v-if="companySelection === NEW_COMPANY" class="new-company">
        <div class="form-row">
          <label>Firma Adı <span>*</span><input v-model="newCompany.name" type="text" placeholder="Örn. Arçelik A.Ş." @input="duplicateCompany = findDuplicate(newCompany.name)" /></label>
          <label>Firma Türü <span>*</span>
            <select v-model="newCompany.company_type">
              <option value="corporate">Kurumsal</option>
              <option value="individual">Bireysel (Şahıs)</option>
            </select>
          </label>
        </div>
        <p v-if="duplicateCompany" class="hint warn">
          "{{ duplicateCompany.name }}" zaten kayıtlı<template v-if="otherCustomerIds.has(duplicateCompany.business_entity_id)"> (başka bir müşteride işyeri var)</template>.
          <button type="button" class="link-button" @click="useExisting(duplicateCompany)">Bu firmayı seç</button>
        </p>
      </div>

      <label class="nace-field">NACE Kodu / Faaliyet <small>(Tehlike sınıfını otomatik doldurur)</small>
        <input v-model="naceQuery" type="text" placeholder="Kod veya faaliyet ara, örn. 56.11 ya da lokanta" @input="searchNace" @focus="naceOpen = naceResults.length > 0" @blur="naceOpen = false" />
        <ul v-if="naceOpen" class="nace-results">
          <li v-for="item in naceResults" :key="item.id" @mousedown.prevent="selectNace(item)">
            <strong>{{ item.nace_code }}</strong> <em class="activity">{{ item.activity_name }}</em> <em class="badge" :class="hazardClassKey(item.hazard_class)">{{ item.hazard_class }}</em>
          </li>
        </ul>
      </label>

      <div class="form-row">
        <label>Tehlike Sınıfı <span>*</span>
          <select v-model="hazardClass">
            <option value="" disabled>Seçiniz</option>
            <option v-for="hazard in HAZARD_CLASSES" :key="hazard" :value="hazard">{{ hazard }}</option>
          </select>
        </label>
        <label>SGK İşyeri Sicil No <small>(Opsiyonel)</small><input v-model="sgkNumber" type="text" /></label>
      </div>
      <p v-if="selectedNace && hazardClass !== selectedNace.hazard_class" class="hint warn">NACE listesine göre tehlike sınıfı: {{ selectedNace.hazard_class }}. Elle değiştirdiniz.</p>

      <p v-if="error" class="form-error">{{ error }}</p>
      <div class="modal-actions">
        <button class="secondary-button" type="button" @click="close">İptal</button>
        <button class="primary-button" type="button" :disabled="!canSave" @click="save">{{ saving ? 'Kaydediliyor...' : 'Kaydet' }}</button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { HAZARD_CLASSES, hazardClassKey, normalizeCompanyName, useExpertApi, type MyCompany, type NaceItem } from '~/composables/useExpertApi'

const props = defineProps<{ customerId?: number | null; location?: { id: number; name: string } | null }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const NEW_COMPANY = -1
const { get, post, patch, errorMessage } = useExpertApi()

const customers = ref<{ id: number; name: string }[]>([])
const customerLocations = ref<{ id: number; name: string }[]>([])
const customerId = ref<number | null>(props.customerId ?? null)
const locationId = ref<number | null>(props.location?.id ?? null)
const myCompanies = ref<MyCompany[]>([])
const attachedIds = ref<Set<number>>(new Set())
const companySelection = ref<number | null>(null)
const newCompany = reactive({ name: '', company_type: 'corporate' })
const duplicateCompany = ref<MyCompany | null>(null)
const naceQuery = ref('')
const naceResults = ref<NaceItem[]>([])
const naceOpen = ref(false)
const selectedNace = ref<NaceItem | null>(null)
const hazardClass = ref('')
const sgkNumber = ref('')
const saving = ref(false)
const error = ref('')
let naceTimer: ReturnType<typeof setTimeout> | undefined

// Görünen ad (opsiyonel): o adla firma (aynı adlı firma varsa o) lokasyona eklenir, ünvanı seçilen firma olur. Boşsa akış
// bugünkü gibi. titleOf: firma → ünvan adı (ünvanlı firmalar listede ayrı grupta).
const displayName = ref('')
const titleOf = ref<Record<string, string>>({})
const loadTitles = async () => {
  try {
    const data = await get<{ titles: { id: number; name: string }[]; links: Record<string, number> }>('/pk-company-titles')
    const names: Record<string, string> = Object.fromEntries(data.titles.map(title => [String(title.id), title.name]))
    titleOf.value = Object.fromEntries(Object.entries(data.links || {}).map(([entity, titleId]) => [entity, names[String(titleId)] || '']))
  } catch { titleOf.value = {} }
}

// Aynı firma aynı lokasyona ikinci kez eklenemez (görünen adla eklenecekse ekli şirket de seçilebilir: eklenen, görünen adlı firma).
const availableCompanies = computed(() => myCompanies.value.filter(c => displayName.value.trim() || !attachedIds.value.has(c.business_entity_id)))
// Firmaların müşterilere dağılımı (işyeri olduğu lokasyonun müşterisine göre): başka müşterilerin firmaları gösterilmez.
// Kullanıcı aynı adı yazıp "Bu firmayı seç" derse o firma bu müşteri için listeye eklenir.
const customerCompanyIds = ref<Set<number>>(new Set())
const otherCustomerIds = ref<Set<number>>(new Set())
const chosenIds = ref<Set<number>>(new Set())
const ownCompanies = computed(() => availableCompanies.value.filter(c => customerCompanyIds.value.has(c.business_entity_id) || chosenIds.value.has(c.business_entity_id)))
const freeCompanies = computed(() => availableCompanies.value.filter(c => !customerCompanyIds.value.has(c.business_entity_id) && !chosenIds.value.has(c.business_entity_id) && !otherCustomerIds.value.has(c.business_entity_id)))
const ownPlain = computed(() => ownCompanies.value.filter(c => !titleOf.value[c.business_entity_id]))
const ownTitled = computed(() => ownCompanies.value.filter(c => titleOf.value[c.business_entity_id]))
const selectedCompany = computed(() => myCompanies.value.find(c => c.business_entity_id === companySelection.value) || null)
// Görünen adla eklenecek firma: aynı adlı tanım varsa o (bu lokasyonda ekliyse eklenemez).
const displayNameMatch = computed(() => displayName.value.trim() ? findDuplicate(displayName.value) : null)
const displayNameBlocked = computed(() => !!displayNameMatch.value && attachedIds.value.has(displayNameMatch.value.business_entity_id))
const displayNameHint = computed(() => {
  const name = displayName.value.trim()
  if (!name || !selectedCompany.value || companySelection.value === NEW_COMPANY) return ''
  if (displayNameBlocked.value) return `"${displayNameMatch.value!.name}" bu lokasyona zaten ekli.`
  return displayNameMatch.value
    ? `Tanımlı "${displayNameMatch.value.name}" firması eklenir; ünvanı ${selectedCompany.value.name} olur.`
    : `"${name}" adıyla firma olarak eklenir; ünvanı ${selectedCompany.value.name} olur.`
})
const loadCustomerCompanies = async () => {
  customerCompanyIds.value = new Set()
  otherCustomerIds.value = new Set()
  chosenIds.value = new Set()
  if (!customerId.value) return
  try {
    const result = await get<{ customer: number[]; other_customers: number[] }>(`/customers/${customerId.value}/companies`)
    customerCompanyIds.value = new Set(result.customer)
    otherCustomerIds.value = new Set(result.other_customers)
  } catch { /* alınamazsa tüm firmalar gösterilir */ }
}

const canSave = computed(() => !saving.value && !!customerId.value && !!locationId.value && !!hazardClass.value &&
  (companySelection.value === NEW_COMPANY ? !!newCompany.name.trim() && !duplicateCompany.value : !!companySelection.value) &&
  // Görünen ad yoksa seçilen firma bu lokasyonda ekli olamaz; görünen adlı firma da ekli olamaz.
  (companySelection.value === NEW_COMPANY || (displayName.value.trim() ? !displayNameBlocked.value : !attachedIds.value.has(companySelection.value ?? 0))))

const findDuplicate = (name: string) => {
  const key = normalizeCompanyName(name)
  return key ? myCompanies.value.find(c => normalizeCompanyName(c.name) === key) || null : null
}

const useExisting = (company: MyCompany) => {
  if (attachedIds.value.has(company.business_entity_id)) { error.value = `"${company.name}" bu lokasyona zaten ekli.`; return }
  chosenIds.value = new Set([...chosenIds.value, company.business_entity_id])
  companySelection.value = company.business_entity_id
  duplicateCompany.value = null
}

const onCompanySelect = () => { error.value = ''; duplicateCompany.value = companySelection.value === NEW_COMPANY ? findDuplicate(newCompany.name) : null }

const loadAttached = async () => {
  attachedIds.value = new Set()
  companySelection.value = null
  if (!customerId.value || !locationId.value) return
  try {
    const items = await get<{ business_entity_id: number }[]>(`/customers/${customerId.value}/locations/${locationId.value}/companies`)
    attachedIds.value = new Set(items.map(i => i.business_entity_id))
  } catch { /* liste boş kalır; backend yine de mükerrer kaydı engeller */ }
}

const onCustomerChange = async () => {
  locationId.value = null
  customerLocations.value = []
  attachedIds.value = new Set()
  companySelection.value = null
  loadCustomerCompanies()
  if (!customerId.value) return
  try { customerLocations.value = await get(`/customers/${customerId.value}/locations`) } catch { customerLocations.value = [] }
}

const searchNace = () => {
  selectedNace.value = null
  clearTimeout(naceTimer)
  const q = naceQuery.value.trim()
  if (q.length < 2) { naceResults.value = []; naceOpen.value = false; return }
  naceTimer = setTimeout(async () => {
    try {
      naceResults.value = await get<NaceItem[]>('/nace-hazard-classes', { search: q })
      naceOpen.value = naceResults.value.length > 0
    } catch { naceResults.value = []; naceOpen.value = false }
  }, 250)
}

const selectNace = (item: NaceItem) => {
  selectedNace.value = item
  naceQuery.value = `${item.nace_code} - ${item.activity_name}`
  hazardClass.value = item.hazard_class
  naceOpen.value = false
}

const close = () => { if (!saving.value) emit('close') }

const save = async () => {
  if (!canSave.value) return
  saving.value = true
  error.value = ''
  try {
    let businessEntityId = companySelection.value
    if (businessEntityId === NEW_COMPANY) {
      const created = await post<MyCompany>('/my-companies', { name: newCompany.name.trim(), company_type: newCompany.company_type })
      businessEntityId = created.business_entity_id
      myCompanies.value.push(created)
      companySelection.value = businessEntityId
    } else if (displayName.value.trim() && selectedCompany.value) {
      // Görünen ad: o adla firma (tanımlıysa o) eklenir, ünvanı seçilen firma (ör. Beyaz Eşya Depo · Arçelik Pazarlama A.Ş.).
      const owner = selectedCompany.value
      if (displayNameMatch.value) businessEntityId = displayNameMatch.value.business_entity_id
      else {
        const created = await post<MyCompany>('/my-companies', { name: displayName.value.trim(), company_type: owner.company_type || 'corporate' })
        businessEntityId = created.business_entity_id
        myCompanies.value.push(created)
      }
      // Ünvan yetkisi yoksa (OSGB / kurumsalda yönetici değil) firma yine eklenir.
      try { await patch(`/pk-company-titles/${businessEntityId}`, { title: owner.name }) } catch { /* ünvan eklenemedi */ }
    }
    await post(`/customers/${customerId.value}/locations/${locationId.value}/companies`, {
      business_entity_id: businessEntityId,
      hazard_class: hazardClass.value,
      nace_code: selectedNace.value?.nace_code ?? null,
      activity: selectedNace.value?.activity_name ?? null,
      sgk_workplace_number: sgkNumber.value.trim() || null
    })
    emit('saved')
  } catch (e: any) {
    error.value = errorMessage(e, 'İşyeri eklenemedi.')
  } finally { saving.value = false }
}

onMounted(async () => {
  loadTitles()
  try { myCompanies.value = await get<MyCompany[]>('/my-companies') } catch { myCompanies.value = [] }
  if (props.location) await Promise.all([loadAttached(), loadCustomerCompanies()])
  else {
    try { customers.value = await get('/customers') } catch { customers.value = [] }
    // Kurumsal hesap: tek müşteri (firmanın kendisi) otomatik seçilir.
    await loadAccount()
    if (corporate.value && !customerId.value && customers.value[0]) customerId.value = customers.value[0].id
    if (customerId.value) await onCustomerChange()
  }
})

const { corporate, load: loadAccount } = useAccount()
</script>

<style scoped>
.modal-backdrop{position:fixed;inset:0;z-index:110;background:var(--admin-overlay);display:grid;place-items:center;padding:20px}
.modal-card{width:min(560px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:22px;background:var(--admin-input);border-radius:12px;box-shadow:0 20px 60px var(--admin-shadow)}
.modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:22px}.modal-head h2{margin:0;color:var(--admin-heading);font-size:18px}.modal-head p{margin:5px 0 0;color:var(--admin-muted);font-size:12px}
.close-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:var(--admin-muted);cursor:pointer;border-radius:7px}.close-button:hover{background:var(--admin-hover);color:var(--admin-heading)}
label{display:block;margin-bottom:16px;color:var(--admin-heading);font-size:12px;font-weight:700}
label>span{color:var(--admin-danger-text)}label small{font-weight:400;color:var(--admin-muted)}
input,select{width:100%;height:42px;margin-top:7px;padding:0 12px;border:1px solid var(--admin-border);border-radius:8px;outline:0;background:var(--admin-input);font:inherit;font-size:13px;color:var(--admin-heading)}
input:focus,select:focus{border-color:#d7a900;box-shadow:0 0 0 3px rgba(255,193,7,.12)}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.new-company{margin:-6px 0 16px;padding:14px 14px 0;border:1px dashed #d7a900;border-radius:10px;background:var(--admin-accent-soft)}
.nace-field{position:relative}
.nace-results{position:absolute;top:100%;left:0;right:0;z-index:5;max-height:260px;overflow:auto;margin:4px 0 0;padding:4px;list-style:none;background:var(--admin-input);border:1px solid var(--admin-border);border-radius:8px;box-shadow:0 12px 30px var(--admin-shadow)}
.nace-results li{padding:8px 9px;border-radius:6px;font-size:12px;font-weight:400;cursor:pointer;line-height:1.4}.nace-results li:hover{background:var(--admin-hover)}
.nace-results em{font-style:normal}.nace-results .activity{color:var(--admin-heading)}
.badge{margin-left:4px;padding:1px 6px;border-radius:999px;font-size:10px;font-weight:700;white-space:nowrap}
.badge.low{background:var(--admin-success-bg);color:var(--admin-success-text)}.badge.high{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.badge.very-high{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.hint{margin:-8px 0 14px;font-size:12px;color:var(--admin-muted)}.hint.warn{color:var(--admin-warning-text)}
.link-button{border:0;background:none;padding:0;margin-left:4px;color:var(--admin-link);font:inherit;font-weight:700;cursor:pointer;text-decoration:underline}
.form-error{margin:0 0 8px;color:var(--admin-danger-text);font-size:12px}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 17px;border:0;border-radius:8px;background:var(--pk-yellow);color:#111827;font-size:13px;font-weight:800;cursor:pointer}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.secondary-button{min-height:40px;padding:0 18px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-hover);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}
@media(max-width:640px){.form-row{grid-template-columns:1fr}}
</style>
