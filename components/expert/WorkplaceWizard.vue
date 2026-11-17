<template>
  <div class="modal-backdrop">
    <section class="modal-card wizard">
      <div class="modal-head">
        <div class="head-title">
          <span class="head-icon"><i class="pi pi-briefcase" /></span>
          <div>
            <h2>{{ kamuAccount ? 'Lokasyona İşyeri Ekle' : customerType === 'public' ? 'Lokasyona İşyeri Ata' : 'Lokasyona Firma Ata' }}</h2>
            <p><i class="pi pi-map-marker" /> {{ location.name }}<template v-if="customerName"> · {{ customerName }}</template></p>
          </div>
        </div>
        <button class="close-button" type="button" :disabled="saving" @click="close"><i class="pi pi-times" /></button>
      </div>

      <div class="layout">
        <!-- Adım listesi -->
        <ol class="stepper" aria-label="Adımlar">
          <li v-for="(s, i) in steps" :key="s" :class="{ on: i === stepIndex, done: i < stepIndex }">
            <span class="dot"><i :class="i < stepIndex ? 'pi pi-check' : meta[s].icon" /></span>
            <span class="name">{{ meta[s].name }}</span>
          </li>
        </ol>

        <div class="content">
          <div class="step-head">
            <span class="step-icon"><i :class="meta[step].icon" /></span>
            <div>
              <p class="step-count">Adım {{ stepIndex + 1 }} / {{ steps.length }}</p>
              <h3>{{ stepTitle }}</h3>
              <p class="step-desc">{{ meta[step].desc }}</p>
            </div>
          </div>

          <div v-if="!ready" class="loading"><i class="pi pi-spin pi-spinner" /> Yükleniyor...</div>

          <!-- Müşteri türü (yalnız türü boş eski müşterilerde, bir kez): cevaba göre sonraki sorular değişir -->
          <template v-else-if="step === 'ctype'">
            <div class="cards">
              <button v-for="t in CUSTOMER_TYPES" :key="t.id" type="button" class="card" :class="{ on: pickedType === t.id }" @click="pickedType = t.id">
                <span class="card-icon"><i :class="t.icon" /></span>
                <span class="card-text"><strong>{{ t.label }}</strong><small>{{ t.text }}</small></span>
                <i v-if="pickedType === t.id" class="pi pi-check-circle card-check" />
              </button>
            </div>
          </template>

          <!-- Firma (KSY-SIS): ana firmanın Firmalar listesinden seçilir; burada yeni firma yazılmaz. Kamu kurumunda da aynı. -->
          <template v-else-if="step === 'company'">
            <label>Firma
              <select v-model="companySelection">
                <option v-if="!firms.length && customerName" :value="SELF">{{ customerName }}</option>
                <option v-else :value="null" disabled>Firma seçin</option>
                <option v-for="c in firms" :key="c.business_entity_id" :value="c.business_entity_id">{{ companyLabel(c) }}</option>
              </select>
            </label>
            <p v-if="!firms.length" class="hint"><i class="pi pi-info-circle" /> <span>Bu ana firmanın Firmalar listesi boş. Başka firma için firma sayfasındaki Firmalar sekmesinden ekleyin.</span></p>
          </template>

          <!-- Alt tesis (KSY-SIS): aynı firmanın bu lokasyondaki ikinci işyeri ayrı alt tesiste açılır; ad ile ayırma yok. -->
          <template v-else-if="step === 'sub'">
            <label>Alt tesis <small>(isteğe bağlı)</small>
              <select v-model="subFacilityId">
                <option :value="null">Lokasyonun geneli</option>
                <option v-for="sub in subFacilities" :key="sub.id" :value="sub.id">{{ sub.name }}</option>
              </select>
            </label>
            <p v-if="subTaken" class="hint warn"><i class="pi pi-exclamation-triangle" />
              <span v-if="subFacilityId">"{{ chosenName }}" bu alt tesiste zaten kayıtlı. Başka bir alt tesis seçin.</span>
              <span v-else-if="subFacilities.length">"{{ chosenName }}" bu lokasyonda zaten kayıtlı. İkinci işyeri için bir alt tesis seçin.</span>
              <span v-else>"{{ chosenName }}" bu lokasyonda zaten kayıtlı. İkinci işyeri ayrı bir alt tesiste açılır; alt tesisi firma sayfasındaki lokasyon kartından ekleyin.</span>
            </p>
            <label v-if="!namedByLocation">İşyeri adı <small>(isteğe bağlı)</small>
              <input ref="focusInput" v-model="displayName" type="text" placeholder="Boşsa firma adı görünür" @keydown.enter.prevent="next" />
            </label>
          </template>

          <!-- 4. Faaliyet (NACE) -->
          <template v-else-if="step === 'nace'">
            <label>NACE kodu ya da faaliyet
              <span class="search"><i class="pi pi-search" /><input ref="focusInput" v-model="naceQuery" type="text" placeholder="Örn. 56.11 ya da lokanta, itfaiye, okul" @input="searchNace" /></span>
            </label>
            <p v-if="selectedNace" class="selected"><i class="pi pi-check-circle" /> <strong>{{ selectedNace.nace_code }}</strong> {{ selectedNace.activity_name }}</p>
            <ul v-else-if="naceResults.length" class="nace-results">
              <li v-for="item in naceResults" :key="item.id">
                <button type="button" @click="selectNace(item)">
                  <strong>{{ item.nace_code }}</strong> <span class="activity">{{ item.activity_name }}</span> <em class="badge" :class="hazardClassKey(item.hazard_class)">{{ item.hazard_class }}</em>
                </button>
              </li>
            </ul>
            <button type="button" class="link-button skip" @click="skipNace"><i class="pi pi-question-circle" /> Bilmiyorum, tehlike sınıfını kendim seçeceğim</button>
            <!-- Uygulamada taşeron yok (kullanıcı 18 Ekim 2026): başka firma ekleme bağlantısı kaldırıldı; işyeri organizasyonun kendisi. -->
          </template>

          <!-- 5. Tehlike sınıfı -->
          <template v-else-if="step === 'hazard'">
            <template v-if="selectedNace && !hazardEdit">
              <p class="hint"><i class="pi pi-info-circle" /> NACE listesine göre ({{ selectedNace.nace_code }}) tehlike sınıfı <em class="badge" :class="hazardClassKey(selectedNace.hazard_class)">{{ selectedNace.hazard_class }}</em>. Doğru mu?</p>
              <div class="cards row">
                <button type="button" class="card" @click="hazardClass = selectedNace.hazard_class; next()">
                  <span class="card-icon ok"><i class="pi pi-check" /></span>
                  <span class="card-text"><strong>Evet, doğru</strong><small>NACE listesindeki sınıf kullanılır.</small></span>
                </button>
                <button type="button" class="card" @click="hazardEdit = true">
                  <span class="card-icon"><i class="pi pi-pencil" /></span>
                  <span class="card-text"><strong>Değiştir</strong><small>Sınıfı kendiniz seçersiniz.</small></span>
                </button>
              </div>
            </template>
            <div v-else class="cards row three">
              <button v-for="h in HAZARDS" :key="h.id" type="button" class="card hazard" :class="[{ on: hazardClass === h.id }, hazardClassKey(h.id)]" @click="hazardClass = h.id">
                <span class="card-icon"><i :class="h.icon" /></span>
                <span class="card-text"><strong>{{ h.id }}</strong><small>{{ h.text }}</small></span>
              </button>
            </div>
          </template>

          <!-- 6. Çalışan sayısı -->
          <template v-else-if="step === 'employees'">
            <div class="cards row three">
              <button v-for="b in EMPLOYEE_BANDS" :key="b.value" type="button" class="card" :class="{ on: employeeBand === b.value }" @click="employeeBand = b.value; next()">
                <span class="card-icon"><i :class="b.icon" /></span>
                <span class="card-text"><strong>{{ b.label }}</strong><small>{{ b.text }}</small></span>
              </button>
            </div>
          </template>

          <!-- 7. SGK -->
          <template v-else-if="step === 'sgk'">
            <label>SGK işyeri sicil no <small>(isteğe bağlı)</small>
              <input ref="focusInput" v-model="sgkNumber" type="text" @keydown.enter.prevent="next" />
            </label>
          </template>

          <!-- 8. Özet -->
          <template v-else>
            <dl class="summary">
              <template v-if="!isSelf"><dt><i class="pi pi-briefcase" /> Firma</dt><dd>{{ chosenName }}</dd></template>
              <template v-else-if="customerName"><dt><i class="pi pi-sitemap" /> {{ account === 'osgb' ? 'Müşteri' : account === 'public' ? 'Organizasyon' : 'Ana firma' }}</dt><dd>{{ customerName }}<small v-if="customerType"> · {{ customerTypeLabel(customerType) }}</small></dd></template>
              <template v-if="!namedByLocation && displayName.trim()"><dt><i class="pi pi-tag" /> İşyeri adı</dt><dd>{{ displayName.trim() }} <small>· listelerde "{{ displayName.trim() }} · {{ chosenName }}"</small></dd></template>
              <dt><i class="pi pi-map-marker" /> Lokasyon</dt><dd>{{ location.name }}</dd>
              <dt><i class="pi pi-th-large" /> Alt tesis</dt><dd>{{ subFacilities.find(s => s.id === subFacilityId)?.name || 'Lokasyonun geneli' }}</dd>
              <dt><i class="pi pi-search" /> Faaliyet</dt><dd>{{ selectedNace ? `${selectedNace.nace_code} ${selectedNace.activity_name}` : '—' }}</dd>
              <dt><i class="pi pi-exclamation-triangle" /> Tehlike sınıfı</dt><dd><em class="badge" :class="hazardClassKey(hazardClass)">{{ hazardClass }}</em></dd>
              <dt><i class="pi pi-users" /> Çalışan sayısı</dt><dd>{{ EMPLOYEE_BANDS.find(b => b.value === employeeBand)?.label }}</dd>
              <dt><i class="pi pi-id-card" /> SGK sicil no</dt><dd>{{ sgkNumber.trim() || '—' }}</dd>
            </dl>
            <label v-if="namedByLocation">İşyeri adı <small>(lokasyon adından gelir; isterseniz değiştirin)</small>
              <input v-model="displayName" type="text" :placeholder="location.name" />
            </label>
            <p class="hint"><i class="pi pi-user" /> Bu işyerine siz uzman olarak atanırsınız; ekipmanları bu işyerine ekleyebilirsiniz.</p>
          </template>

          <p v-if="error" class="form-error">{{ error }}</p>
        </div>
      </div>

      <div class="modal-actions">
        <button v-if="stepIndex > 0" class="secondary-button" type="button" :disabled="saving || savingType" @click="back"><i class="pi pi-arrow-left" /> Geri</button>
        <button v-else class="secondary-button" type="button" @click="close">İptal</button>
        <button v-if="step === 'sgk' && !sgkNumber.trim()" class="secondary-button" type="button" @click="next">Atla</button>
        <button v-if="step === 'summary'" class="primary-button" type="button" :disabled="saving" @click="save"><i class="pi pi-check" /> {{ kamuAccount ? (saving ? 'Ekleniyor...' : 'Ekle') : (saving ? 'Atanıyor...' : 'Ata') }}</button>
        <button v-else-if="!(step === 'sgk' && !sgkNumber.trim())" class="primary-button" type="button" :disabled="!ready || !canNext || savingType" @click="next">{{ savingType ? 'Kaydediliyor...' : 'İleri' }} <i class="pi pi-arrow-right" /></button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// "Lokasyona Firma Ata" sihirbazı (KSY-SIS yapısı): firma ana firmanın Firmalar listesinden seçilir (burada yeni firma
// yazılmaz; liste boşsa ana firmanın kendisi). Şahıs işletmesinde firma işletmenin kendisidir. Kamu kurumu da aynı işler.
// Aynı firmanın bu lokasyondaki ikinci işyeri ayrı alt tesiste açılır (backend 422 ile ayrıca engeller).
// Türü boş eski müşteride ilk adımda bir kez sorulur ve kaydedilir.
import { HAZARD_CLASSES, hazardClassKey, normalizeCompanyName, useExpertApi, type MyCompany, type NaceItem } from '~/composables/useExpertApi'
import { CUSTOMER_TYPES, customerTypeLabel, useCustomerTypes, type CustomerType } from '~/composables/useCustomerTypes'

// account: bireysel uzman (expert), OSGB (osgb; ekranda "müşteri" denir) ya da kurumsal hesap (corporate; müşteri firmanın
// kendisi, tür sorulmaz, kurumsal firma gibi işler).
const props = defineProps<{ customerId: number | null; customerName?: string | null; location: { id: number; name: string }; account?: 'expert' | 'osgb' | 'corporate' | 'public' }>()
// Kamu hesabı (public): müşteri kurumun kendisi, türü hep kamu (sorulmaz); ekranda firma yerine "işyeri" denir,
// lokasyona birden çok işyeri eklenebilir (kullanıcı 18 Ekim 2026). Diğer hesaplarda hiçbir şey değişmez.
const kamuAccount = computed(() => props.account === 'public')
const noun = computed(() => props.account === 'osgb' ? 'müşteri' : props.account === 'public' ? 'organizasyon' : 'ana firma')
const emit = defineEmits<{ close: []; saved: [] }>()

type Step = 'ctype' | 'company' | 'sub' | 'nace' | 'hazard' | 'employees' | 'sgk' | 'summary'
const SELF = -2
const HAZARDS = [
  { id: 'Az Tehlikeli', icon: 'pi pi-shield', text: 'Düşük riskli faaliyetler.' },
  { id: 'Tehlikeli', icon: 'pi pi-exclamation-circle', text: 'Orta riskli faaliyetler.' },
  { id: 'Çok Tehlikeli', icon: 'pi pi-exclamation-triangle', text: 'Yüksek riskli faaliyetler.' }
]
const EMPLOYEE_BANDS = [
  { value: 'lt10', label: "10'dan az", icon: 'pi pi-user', text: '1–9 çalışan' },
  { value: '10_49', label: '10–49', icon: 'pi pi-users', text: '10 ile 49 arası çalışan' },
  { value: '50_plus', label: '50 ve üzeri', icon: 'pi pi-building', text: '50 ve daha fazla çalışan' }
]
// Adım adları, ikonları ve açıklamaları (sol liste + adım başlığı).
const STEP_META: Record<Step, { name: string; icon: string; title: string; desc: string }> = {
  ctype: { name: 'Tür', icon: 'pi pi-tags', title: 'Ne tür bir organizasyon?', desc: 'Bir kez sorulur ve kaydedilir; sonraki sorular cevaba göre değişir.' },
  company: { name: 'Firma', icon: 'pi pi-briefcase', title: 'Lokasyona atanacak firmayı seçiniz', desc: 'Ana firmanın Firmalar listesinden seçin.' },
  sub: { name: 'Alt tesis', icon: 'pi pi-th-large', title: 'İşyeri lokasyonun neresinde?', desc: 'Aynı firmanın bu lokasyondaki ikinci işyeri ayrı bir alt tesiste açılır. Alt tesis seçilmezse işyeri lokasyonun genelindedir.' },
  nace: { name: 'Faaliyet', icon: 'pi pi-search', title: 'Bu lokasyonda ne iş yapılıyor?', desc: 'NACE kodunu ya da faaliyeti yazın; seçtiğiniz faaliyetin tehlike sınıfı otomatik gelir.' },
  hazard: { name: 'Tehlike sınıfı', icon: 'pi pi-exclamation-triangle', title: 'Tehlike sınıfı', desc: 'Tehlike sınıfı, olası idari para cezası hesabında ve işyeri bilgilerinde kullanılır.' },
  employees: { name: 'Çalışan sayısı', icon: 'pi pi-users', title: 'Bu işyerinde kaç kişi çalışıyor?', desc: 'Olası idari para cezası (6331) tehlike sınıfı ve çalışan sayısına göre hesaplanır.' },
  sgk: { name: 'SGK sicil', icon: 'pi pi-id-card', title: 'İşyerinin SGK sicil numarasını biliyor musunuz?', desc: 'İsteğe bağlıdır; bilmiyorsanız atlayın, sonra lokasyonun firma panelinden ekleyebilirsiniz.' },
  summary: { name: 'Özet', icon: 'pi pi-list-check', title: 'Kontrol edip atayın', desc: 'Bilgileri kontrol edin. Geri dönüp değiştirebilirsiniz.' }
}

// Kamu hesabında adım adları ve açıklamaları işyerine göre.
const KAMU_META: Partial<Record<Step, Partial<{ name: string; title: string; desc: string }>>> = {
  summary: { title: 'Kontrol edip ekleyin' }
}
type StepMeta = { name: string; icon: string; title: string; desc: string }
const meta = computed<Record<Step, StepMeta>>(() => kamuAccount.value
  ? Object.fromEntries((Object.keys(STEP_META) as Step[]).map(k => [k, { ...STEP_META[k], ...KAMU_META[k] }])) as Record<Step, StepMeta>
  : STEP_META)

const { get, post, errorMessage } = useExpertApi()
const { status: billing, load: loadBilling } = useBilling()
const { setName: setWorkplaceName } = useWorkplaceNames()
const workplaceLimitFull = () => {
  const limit = billing.value?.unlimited ? null : billing.value?.workplace_limit
  return limit !== null && limit !== undefined && (billing.value?.active_workplaces ?? 0) >= limit
}

// Müşteri türü: şahısta işyeri işletmenin kendisidir (firma sorulmaz); kurumsal ve kamuda firma sorulur; boşsa bir kez sorulur.
const { load: loadCustomerTypes, save: saveCustomerType } = useCustomerTypes()
const customerType = ref<CustomerType | null>(null)
const typeAsked = ref(false)
const pickedType = ref<CustomerType | null>(null)
const savingType = ref(false)
const ready = ref(false)
const companySelection = ref<number | null>(null)
const subFacilityId = ref<number | null>(null)
const displayName = ref('')
const naceQuery = ref('')
const naceResults = ref<NaceItem[]>([])
const selectedNace = ref<NaceItem | null>(null)
const hazardClass = ref('')
const hazardEdit = ref(false)
const employeeBand = ref('')
const sgkNumber = ref('')
const saving = ref(false)
const error = ref('')
const focusInput = ref<HTMLInputElement | null>(null)
let naceTimer: ReturnType<typeof setTimeout> | undefined

const myCompanies = ref<MyCompany[]>([])
// Ana firmanın Firmalar listesi (customers/{c}/firms) ve lokasyonun alt tesisleri.
const firms = ref<{ business_entity_id: number; name: string }[]>([])
const subFacilities = ref<{ id: number; name: string }[]>([])
// Lokasyondaki işyerleri: firma → alt tesis (null = lokasyonun geneli).
const attached = ref<{ business_entity_id: number; sub_facility_id: number | null }[]>([])
const titleOf = ref<Record<string, string>>({})

const findDuplicate = (name: string) => {
  const key = normalizeCompanyName(name)
  return key ? myCompanies.value.find(c => normalizeCompanyName(c.name) === key) || null : null
}
const companyLabel = (c: { business_entity_id: number; name: string }) => titleOf.value[c.business_entity_id] ? `${c.name} · ${titleOf.value[c.business_entity_id]}` : c.name
// Ana firmanın kendisi (şahıs işletmesi ya da Firmalar listesi boş): ana firmayla aynı adı taşıyan firma kartı; yoksa kayıtta açılır.
const selfCompany = computed(() => props.customerName ? findDuplicate(props.customerName) : null)
const isSelf = computed(() => customerType.value === 'individual' || customerType.value === 'public' || companySelection.value === SELF)
// Şahıs işletmesinde her lokasyon bir şubedir: işyerine lokasyonun adı verilir (firma kartı işletmenin kendisi).
const namedByLocation = computed(() => customerType.value === 'individual')
const chosenId = computed<number | null>(() => isSelf.value
  ? selfCompany.value?.business_entity_id ?? null
  : companySelection.value && companySelection.value > 0 ? companySelection.value : null)
const chosenName = computed(() => isSelf.value
  ? selfCompany.value?.name || props.customerName || ''
  : firms.value.find(c => c.business_entity_id === chosenId.value)?.name || '')
// Firma bu lokasyonda seçilen alt tesiste (ya da zaten varken lokasyonun genelinde) varsa kayıt açılmaz.
const subTaken = computed(() => {
  if (chosenId.value === null) return false
  const taken = attached.value.filter(i => i.business_entity_id === chosenId.value).map(i => i.sub_facility_id ?? null)
  return taken.length > 0 && (subFacilityId.value === null || taken.includes(subFacilityId.value))
})

const steps = computed<Step[]>(() => [
  ...(typeAsked.value ? ['ctype' as Step] : []),
  // Kamu kurumunda firma sorulmaz: işyerinin firması kurumun kendisi (kullanıcı 17 Kas 2026).
  ...(customerType.value === 'corporate' ? ['company' as Step] : []),
  'sub', 'nace', 'hazard', 'employees', 'sgk', 'summary'
])
const stepIndex = ref(0)
const step = computed(() => steps.value[Math.min(stepIndex.value, steps.value.length - 1)]!)
const stepTitle = computed(() => {
  if (step.value === 'ctype') return props.customerName ? `"${props.customerName}" ne tür bir ${noun.value}?` : `Ne tür bir ${noun.value}?`
  if (step.value === 'nace' && !isSelf.value && chosenName.value) return `"${chosenName.value}" bu lokasyonda ne iş yapıyor?`
  return meta.value[step.value].title
})

const canNext = computed(() => {
  switch (step.value) {
    case 'ctype': return !!pickedType.value
    case 'company': return !!companySelection.value
    case 'sub': return !subTaken.value
    case 'nace': return !!selectedNace.value
    case 'hazard': return !!hazardClass.value
    case 'employees': return !!employeeBand.value
    default: return true
  }
})

function focusLater() { nextTick(() => focusInput.value?.focus()) }
async function next() {
  if (!canNext.value) return
  error.value = ''
  // Tür adımı: müşteriye kaydedilir, sonraki adımlar türe göre açılır.
  if (step.value === 'ctype' && pickedType.value !== customerType.value) {
    savingType.value = true
    try {
      await saveCustomerType(props.customerId!, pickedType.value)
      customerType.value = pickedType.value
      if (companySelection.value === null && !firms.value.length && props.customerName) companySelection.value = SELF
    } catch (e: any) {
      error.value = errorMessage(e, 'Tür kaydedilemedi.')
      return
    } finally { savingType.value = false }
  }
  if (stepIndex.value < steps.value.length - 1) stepIndex.value++
  focusLater()
}
function back() { error.value = ''; if (stepIndex.value > 0) stepIndex.value-- }
function close() { if (!saving.value) emit('close') }

function searchNace() {
  selectedNace.value = null
  clearTimeout(naceTimer)
  const q = naceQuery.value.trim()
  if (q.length < 2) { naceResults.value = []; return }
  naceTimer = setTimeout(async () => {
    try { naceResults.value = await get<NaceItem[]>('/nace-hazard-classes', { search: q }) } catch { naceResults.value = [] }
  }, 250)
}
function selectNace(item: NaceItem) {
  selectedNace.value = item
  naceQuery.value = `${item.nace_code} - ${item.activity_name}`
  naceResults.value = []
  hazardClass.value = item.hazard_class
  hazardEdit.value = false
  next()
}
function skipNace() {
  selectedNace.value = null
  naceQuery.value = ''
  naceResults.value = []
  hazardClass.value = ''
  hazardEdit.value = true
  stepIndex.value++
}

// Özete gelince ad boşsa lokasyon adıyla doldurulur (şahıs).
watch(() => steps.value[stepIndex.value], (current) => {
  if (current === 'summary' && namedByLocation.value && !displayName.value.trim()) displayName.value = props.location.name
})

async function save() {
  saving.value = true
  error.value = ''
  try {
    await loadBilling()
    if (workplaceLimitFull()) {
      error.value = `İşyeri limitiniz doldu (${billing.value?.active_workplaces} / ${billing.value?.workplace_limit}). Yeni işyeri eklemek için paketinizi yükseltin.`
      return
    }
    let businessEntityId = chosenId.value
    if (businessEntityId === null) {
      // Yalnız ana firmanın kendisi için: aynı adlı kart yoksa açılır (backend işyeriyle birlikte bu ana firmaya bağlar).
      const created = await post<MyCompany>('/my-companies', { name: chosenName.value, company_type: customerType.value === 'individual' ? 'individual' : 'corporate' })
      businessEntityId = created.business_entity_id
      myCompanies.value.push(created)
    }
    const workplaceName = displayName.value.trim()
    const created = await post<{ id: number }>(`/customers/${props.customerId}/locations/${props.location.id}/companies`, {
      business_entity_id: businessEntityId,
      hazard_class: hazardClass.value,
      nace_code: selectedNace.value?.nace_code ?? null,
      activity: selectedNace.value?.activity_name ?? null,
      sgk_workplace_number: sgkNumber.value.trim() || null,
      sub_facility_id: subFacilityId.value
    })
    const workplaceId = created?.id ?? null
    loadBilling()
    try {
      if (workplaceId) await post(`/pk-workplace-employee-bands/${workplaceId}`, { band: employeeBand.value })
    } catch (e: any) {
      error.value = errorMessage(e, `${kamuAccount.value ? 'İşyeri eklendi' : 'Firma atandı'} ama çalışan sayısı kaydedilemedi; Genel Bakış → Ceza sekmesinden seçebilirsiniz.`)
      return
    }
    try {
      if (workplaceId && workplaceName && normalizeCompanyName(workplaceName) !== normalizeCompanyName(chosenName.value)) await setWorkplaceName(workplaceId, workplaceName)
    } catch (e: any) {
      error.value = errorMessage(e, kamuAccount.value ? 'İşyeri eklendi ama adı kaydedilemedi; lokasyonun İşyerleri panelinden düzenleyebilirsiniz.' : 'Firma atandı ama işyeri adı kaydedilemedi; lokasyonun firma panelinden düzenleyebilirsiniz.')
      return
    }
    emit('saved')
  } catch (e: any) {
    error.value = errorMessage(e, kamuAccount.value ? 'İşyeri eklenemedi.' : 'Firma atanamadı.')
  } finally { saving.value = false }
}

onMounted(async () => {
  // Kurumsal hesap: müşteri firmanın kendisi; tür sorulmaz, kurumsal firma gibi (ana firma ya da başka firma).
  // Kamu hesabı: kurumun kendisi, tür hep kamu (sorulmaz).
  const types = props.account === 'corporate' || kamuAccount.value ? {} : await loadCustomerTypes()
  customerType.value = kamuAccount.value ? 'public' : props.account === 'corporate' ? 'corporate' : props.customerId ? types[String(props.customerId)] ?? null : null
  typeAsked.value = !customerType.value
  pickedType.value = customerType.value
  try {
    const data = await get<{ titles: { id: number; name: string }[]; links: Record<string, number> }>('/pk-company-titles')
    const names: Record<string, string> = Object.fromEntries(data.titles.map(title => [String(title.id), title.name]))
    titleOf.value = Object.fromEntries(Object.entries(data.links || {}).map(([entity, titleId]) => [entity, names[String(titleId)] || '']))
  } catch { titleOf.value = {} }
  type Firm = { business_entity_id: number; name: string }
  const [companies, firmList, subs, items] = await Promise.all([
    get<MyCompany[]>('/my-companies').catch(() => [] as MyCompany[]),
    props.customerId ? get<Firm[]>(`/customers/${props.customerId}/firms`).catch(() => [] as Firm[]) : Promise.resolve([] as Firm[]),
    get<{ id: number; name: string }[]>(`/locations/${props.location.id}/sub-facilities`).catch(() => []),
    // Alınamazsa boş kalır; backend yine de aynı alt tesiste ikinci kaydı engeller.
    get<{ business_entity_id: number; sub_facility_id: number | null }[]>(`/customers/${props.customerId}/locations/${props.location.id}/companies`).catch(() => [])
  ])
  myCompanies.value = companies
  firms.value = firmList
  subFacilities.value = subs
  attached.value = items
  if (!firms.value.length && props.customerName) companySelection.value = SELF
  ready.value = true
})
</script>

<style scoped>
.modal-backdrop{position:fixed;inset:0;z-index:110;background:var(--admin-overlay);display:grid;place-items:center;padding:20px}
.modal-card{width:min(860px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:24px 26px;background:var(--admin-input);border-radius:14px;box-shadow:0 20px 60px var(--admin-shadow)}
.modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:20px}
.head-title{display:flex;align-items:center;gap:14px}
.head-icon{flex:none;width:46px;height:46px;display:grid;place-items:center;border-radius:12px;background:var(--pk-yellow);color:var(--pk-on-accent);font-size:20px}
.modal-head h2{margin:0;color:var(--admin-heading);font-size:19px}
.modal-head p{display:flex;align-items:center;gap:6px;margin:5px 0 0;color:var(--admin-muted);font-size:12.5px}
.close-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:var(--admin-muted);cursor:pointer;border-radius:7px}.close-button:hover{background:var(--admin-hover);color:var(--admin-heading)}
.layout{display:grid;grid-template-columns:190px minmax(0,1fr);gap:24px}
.stepper{list-style:none;margin:0;padding:14px 12px;border-radius:12px;background:var(--admin-soft);display:flex;flex-direction:column;gap:4px;align-self:start}
.stepper li{display:flex;align-items:center;gap:10px;padding:8px;border-radius:8px;color:var(--admin-muted);font-size:12.5px;font-weight:600}
.stepper li.on{background:var(--admin-accent-soft);color:var(--admin-heading)}
.stepper .dot{flex:none;width:28px;height:28px;display:grid;place-items:center;border-radius:50%;background:var(--admin-input);border:1px solid var(--admin-border);font-size:12px}
.stepper li.on .dot{background:var(--pk-yellow);border-color:var(--pk-yellow);color:var(--pk-on-accent)}
.stepper li.done .dot{background:#12b76a;border-color:#12b76a;color:#fff}
.content{min-width:0}
.step-head{display:flex;gap:14px;margin-bottom:18px}
.step-icon{flex:none;width:44px;height:44px;display:grid;place-items:center;border-radius:11px;background:var(--admin-chip);color:var(--admin-heading);font-size:19px}
.step-count{margin:0 0 3px;color:var(--admin-muted);font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
h3{margin:0;color:var(--admin-heading);font-size:17px;line-height:1.3}
.step-desc{margin:6px 0 0;color:var(--admin-muted);font-size:12.5px;line-height:1.55}
.loading{display:flex;align-items:center;gap:8px;padding:30px 0;color:var(--admin-muted);font-size:13px}
.example{display:flex;gap:10px;margin:0 0 14px;padding:12px 14px;border-radius:10px;background:var(--admin-accent-soft);color:var(--admin-text);font-size:12.5px;line-height:1.55}.example > .pi{margin-top:3px;color:var(--admin-accent-text)}.example b{color:var(--admin-heading)}
.preview{display:flex;align-items:center;gap:8px;margin:-4px 0 0;color:var(--admin-muted);font-size:12.5px}.preview strong{color:var(--admin-heading)}
.firm-strip{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:-4px 0 18px;padding:10px 13px;border:1px solid var(--admin-border);border-radius:10px;background:var(--admin-soft);color:var(--admin-text);font-size:12.5px}
.firm-strip > .pi{color:var(--admin-heading)}.firm-strip strong{color:var(--admin-heading)}.firm-strip small{color:var(--admin-muted)}
.firm-strip .link-button{margin-left:auto;font-size:12px}
.aside-link{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:22px 0 0;padding-top:14px;border-top:1px dashed var(--admin-border);color:var(--admin-muted);font-size:12px}
.firm-strip.other{border-color:var(--pk-accent);background:var(--admin-accent-soft)}
.question{display:flex;align-items:center;gap:8px;margin:6px 0 10px;color:var(--admin-heading);font-size:13px;font-weight:700}
.cards{display:grid;gap:10px;margin-bottom:14px}.cards.row{grid-template-columns:repeat(2,minmax(0,1fr))}.cards.row.three{grid-template-columns:repeat(3,minmax(0,1fr))}
.card{position:relative;display:flex;align-items:flex-start;gap:12px;padding:14px;border:1px solid var(--admin-border);border-radius:11px;background:var(--admin-input);text-align:left;cursor:pointer;font:inherit;transition:border-color .15s ease, background .15s ease}
.cards.row .card{flex-direction:column}
.card:hover{border-color:var(--pk-accent)}.card.on{border-color:var(--pk-accent);background:var(--admin-accent-soft);box-shadow:0 0 0 3px var(--pk-focus-ring)}
.card-icon{flex:none;width:40px;height:40px;display:grid;place-items:center;border-radius:10px;background:var(--admin-chip);color:var(--admin-heading);font-size:17px}
.card.on .card-icon{background:var(--pk-yellow);color:var(--pk-on-accent)}
.card-icon.ok{background:var(--admin-success-bg);color:var(--admin-success-text)}
.card.hazard.low .card-icon{background:var(--admin-success-bg);color:var(--admin-success-text)}
.card.hazard.high .card-icon{background:var(--admin-warning-bg);color:var(--admin-warning-text)}
.card.hazard.very-high .card-icon{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.card-text{display:flex;flex-direction:column;gap:4px}.card-text strong{color:var(--admin-heading);font-size:13.5px}.card-text small{color:var(--admin-muted);font-size:12px;line-height:1.45}
.card-check{position:absolute;top:12px;right:12px;color:var(--admin-accent-text);font-size:17px}
label{display:block;margin-bottom:14px;color:var(--admin-heading);font-size:12px;font-weight:700}label small{font-weight:400;color:var(--admin-muted)}
input,select{width:100%;height:44px;margin-top:7px;padding:0 12px;border:1px solid var(--admin-border);border-radius:9px;outline:0;background:var(--admin-input);font:inherit;font-size:13px;color:var(--admin-heading)}
input:focus,select:focus{border-color:var(--pk-accent);box-shadow:0 0 0 3px var(--pk-focus-ring)}
.search{position:relative;display:block}.search .pi{position:absolute;left:13px;top:50%;margin-top:3px;transform:translateY(-50%);color:var(--admin-muted)}.search input{padding-left:36px}
.hint{display:flex;gap:8px;margin:0 0 12px;color:var(--admin-muted);font-size:12.5px;line-height:1.55}.hint .pi{margin-top:3px}
.hint.warn{color:var(--admin-warning-text)}.hint.ok{color:var(--admin-success-text)}
.selected{display:flex;align-items:center;gap:8px;margin:-4px 0 12px;padding:11px 13px;border-radius:9px;background:var(--admin-success-bg);color:var(--admin-success-text);font-size:13px}
.nace-results{max-height:260px;overflow:auto;margin:-6px 0 12px;padding:4px;list-style:none;border:1px solid var(--admin-border);border-radius:9px}
.nace-results button{width:100%;padding:9px 10px;border:0;border-radius:6px;background:transparent;text-align:left;font:inherit;font-size:12.5px;line-height:1.45;color:var(--admin-muted);cursor:pointer}
.nace-results button:hover{background:var(--admin-hover)}.nace-results .activity{color:var(--admin-heading)}
.badge{padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;font-style:normal;white-space:nowrap}
.badge.low{background:var(--admin-success-bg);color:var(--admin-success-text)}.badge.high{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.badge.very-high{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.link-button{border:0;background:none;padding:0;margin-left:4px;color:var(--admin-link);font:inherit;font-weight:700;cursor:pointer;text-decoration:underline}
.link-button.skip{display:inline-flex;align-items:center;gap:6px;margin:0;font-size:12.5px}
.summary{display:grid;grid-template-columns:150px minmax(0,1fr);gap:10px 14px;margin:0 0 16px;padding:16px 18px;border:1px solid var(--admin-border);border-radius:11px;background:var(--admin-soft);font-size:13px}
.summary dt{display:flex;align-items:center;gap:8px;color:var(--admin-muted)}.summary dd{margin:0;color:var(--admin-heading);font-weight:600}.summary small{font-weight:400;color:var(--admin-muted)}
.form-error{margin:8px 0 0;color:var(--admin-danger-text);font-size:12.5px}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px;padding-top:16px;border-top:1px solid var(--admin-border)}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:0 20px;border:0;border-radius:9px;background:var(--pk-yellow);color:var(--pk-on-accent);font-size:13px;font-weight:800;cursor:pointer}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.secondary-button{display:inline-flex;align-items:center;gap:7px;min-height:42px;padding:0 18px;border:1px solid var(--admin-border);border-radius:9px;background:var(--admin-hover);color:var(--admin-heading);font-size:12.5px;font-weight:700;cursor:pointer}
@media(max-width:760px){
  .layout{grid-template-columns:minmax(0,1fr)}
  .stepper{flex-direction:row;overflow:hidden;padding:8px;gap:6px}
  .stepper .name{display:none}
  .cards.row,.cards.row.three{grid-template-columns:minmax(0,1fr)}
  .cards.row .card{flex-direction:row}
}
</style>
