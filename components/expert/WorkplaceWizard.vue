<template>
  <div class="modal-backdrop">
    <section class="modal-card wizard">
      <div class="modal-head">
        <div class="head-title">
          <span class="head-icon"><i class="pi pi-briefcase" /></span>
          <div>
            <h2>Lokasyona Firma Ata</h2>
            <p><i class="pi pi-map-marker" /> {{ location.name }}<template v-if="customerName"> · {{ customerName }}</template></p>
          </div>
        </div>
        <button class="close-button" type="button" :disabled="saving" @click="close"><i class="pi pi-times" /></button>
      </div>

      <div class="layout">
        <!-- Adım listesi -->
        <ol class="stepper" aria-label="Adımlar">
          <li v-for="(s, i) in steps" :key="s" :class="{ on: i === stepIndex, done: i < stepIndex }">
            <span class="dot"><i :class="i < stepIndex ? 'pi pi-check' : STEP_META[s].icon" /></span>
            <span class="name">{{ STEP_META[s].name }}</span>
          </li>
        </ol>

        <div class="content">
          <div class="step-head">
            <span class="step-icon"><i :class="STEP_META[step].icon" /></span>
            <div>
              <p class="step-count">Adım {{ stepIndex + 1 }} / {{ steps.length }}</p>
              <h3>{{ stepTitle }}</h3>
              <p class="step-desc">{{ STEP_META[step].desc }}</p>
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

          <!-- Kamu kurumu: kuruma mı, lokasyondaki bir firmaya mı hizmet? Firmaya hizmette kurum için kayıt açılmaz (kullanıcı 18 Ekim 2026). -->
          <template v-else-if="step === 'target'">
            <div class="cards">
              <button type="button" class="card" :class="{ on: target === 'self' }" @click="target = 'self'">
                <span class="card-icon"><i class="pi pi-flag" /></span>
                <span class="card-text">
                  <strong>{{ selfAttached ? 'Kurumun ayrı bir birimine' : 'Kurumun kendisine' }}</strong>
                  <small v-if="selfAttached">"{{ location.name }}" zaten kayıtlı. Ayrı SGK sicilli başka bir birimse ayırt edici bir adla eklenir.</small>
                  <small v-else>İşyeri "{{ location.name }}" adıyla açılır; firma sorulmaz.</small>
                </span>
                <i v-if="target === 'self'" class="pi pi-check-circle card-check" />
              </button>
              <button type="button" class="card" :class="{ on: target === 'firm' }" @click="target = 'firm'">
                <span class="card-icon"><i class="pi pi-briefcase" /></span>
                <span class="card-text">
                  <strong>Lokasyondaki bir firmaya</strong>
                  <small>Kantin, kafeterya, kiracı gibi lokasyonda faaliyet gösteren ayrı bir firma. Kurum için kayıt açılmaz.</small>
                </span>
                <i v-if="target === 'firm'" class="pi pi-check-circle card-check" />
              </button>
            </div>
          </template>

          <!-- Firma: kurumsal müşteride ana firma ya da grup şirketi; kamuda lokasyondaki firma -->
          <template v-else-if="step === 'company'">
            <label>{{ customerType === 'corporate' ? 'Şirket' : 'Firma' }}
              <select v-model="companySelection" @change="onCompanySelect">
                <option v-if="customerType === 'corporate' && customerName" :value="SELF">{{ customerName }} (ana firma)</option>
                <option v-else :value="null" disabled>Firma seçin</option>
                <optgroup v-if="ownCompanies.length" label="Bu organizasyonun firmaları">
                  <option v-for="c in ownCompanies" :key="c.business_entity_id" :value="c.business_entity_id">{{ companyLabel(c) }}</option>
                </optgroup>
                <optgroup v-if="freeCompanies.length" label="Henüz bir organizasyonda işyeri olmayan firmalar">
                  <option v-for="c in freeCompanies" :key="c.business_entity_id" :value="c.business_entity_id">{{ companyLabel(c) }}</option>
                </optgroup>
                <option :value="NEW_COMPANY">{{ customerType === 'corporate' ? '+ Yeni şirket ekle (grup şirketi)' : '+ Yeni firma ekle' }}</option>
              </select>
            </label>
            <template v-if="companySelection === NEW_COMPANY">
              <label>{{ customerType === 'corporate' ? 'Şirketin' : 'Firmanın' }} adı nedir?
                <input ref="focusInput" v-model="newCompany.name" type="text" :placeholder="customerType === 'corporate' ? 'Örn. Örnek Enerji A.Ş.' : 'Örn. Örnek Yemek Hizmetleri'" @input="duplicateCompany = findDuplicate(newCompany.name)" />
              </label>
              <p v-if="duplicateCompany" class="hint warn">
                <i class="pi pi-exclamation-triangle" /> <span>"{{ duplicateCompany.name }}" zaten kayıtlı. Bunu mu kastettiniz?
                  <button type="button" class="link-button" @click="useExisting(duplicateCompany)">Evet, bunu seç</button></span>
              </p>
              <!-- Unvan (isteğe bağlı): Firma Tanımla'daki gibi; hesapta bir kez tanımlanır, aynı şirketin firmaları aynı ünvanı seçer -->
              <label>Unvan <small>(isteğe bağlı, resmî ünvan)</small>
                <input v-model="newTitle" type="text" list="wizard-company-titles" placeholder="Örn. Örnek Yemek Hizmetleri Ltd. Şti." />
              </label>
              <datalist id="wizard-company-titles"><option v-for="t in titleNames" :key="t" :value="t" /></datalist>
              <template v-if="customerType !== 'corporate'">
                <p class="question"><i class="pi pi-tag" /> Firmanın türü nedir?</p>
                <div class="cards row">
                  <button v-for="t in FIRM_TYPES" :key="t.id" type="button" class="card" :class="{ on: newFirmType === t.id }" @click="newFirmType = t.id">
                    <span class="card-icon"><i :class="t.icon" /></span>
                    <span class="card-text"><strong>{{ t.label }}</strong><small>{{ t.text }}</small></span>
                  </button>
                </div>
              </template>
            </template>
          </template>

          <!-- 3. Kampüs: firma bu lokasyonda zaten var -->
          <template v-else-if="step === 'campus'">
            <div class="cards row">
              <button type="button" class="card" :class="{ on: separate === true }" @click="separate = true">
                <span class="card-icon"><i class="pi pi-clone" /></span>
                <span class="card-text"><strong>Evet, ayrı işletme</strong><small>Ayrı SGK sicili var (ör. kampüsteki yemekhane). Ayırt edici bir adla eklenir.</small></span>
              </button>
              <button type="button" class="card" :class="{ on: separate === false }" @click="separate = false">
                <span class="card-icon"><i class="pi pi-equals" /></span>
                <span class="card-text"><strong>Hayır, aynı işletme</strong><small>Zaten kayıtlı olan işyeri; yeniden atamaya gerek yok.</small></span>
              </button>
            </div>
            <label v-if="separate">Bu işletmeyi nasıl ayırt edelim?
              <input v-model="displayName" type="text" placeholder="Örn. Yemekhane İşletmesi" />
            </label>
            <p v-else-if="separate === false" class="hint ok"><i class="pi pi-check-circle" /> Bu işletme zaten kayıtlı. Pencereyi kapatabilirsiniz.</p>
          </template>

          <!-- İşyeri adı (kullanıcı 18 Ekim 2026): firma lokasyonun bir bölümünde çalışıyor ve o bölüm özel bir adla anılıyorsa
               (ör. ABC A.Ş. → Depo) soru olarak sorulur. Kamu kurumunda (ad = lokasyon) ve şahısta (ad = şube) sorulmaz. -->
          <template v-else-if="step === 'wname'">
            <div class="example">
              <i class="pi pi-lightbulb" />
              <span><strong>Örnek:</strong> ABC A.Ş. bu lokasyonun bir bölümünde faaliyet gösteriyor ve orası <b>"Depo"</b> diye anılıyor.
                Adı "Depo" girilirse işyeri listelerde <b>Depo · ABC A.Ş.</b> diye görünür; aynı firmanın başka bölümleriyle karışmaz.</span>
            </div>
            <div class="cards row">
              <button type="button" class="card" :class="{ on: hasOwnName === false }" @click="hasOwnName = false; displayName = ''">
                <span class="card-icon"><i class="pi pi-map" /></span>
                <span class="card-text"><strong>Lokasyonun tamamında</strong><small>Firma bütün lokasyonda faaliyet gösteriyor. İşyeri listelerde "{{ chosenName }}" olarak görünür.</small></span>
              </button>
              <button type="button" class="card" :class="{ on: hasOwnName === true }" @click="hasOwnName = true; focusLater()">
                <span class="card-icon"><i class="pi pi-th-large" /></span>
                <span class="card-text"><strong>Lokasyonun bir bölümünde</strong><small>Firma belli bir bölümde çalışıyor (Depo, Yemekhane, Üretim Binası…). Bölümün adını yazarsınız.</small></span>
              </button>
            </div>
            <template v-if="hasOwnName">
              <label>Bölümün adını (İşyeri adını) giriniz
                <input ref="focusInput" v-model="displayName" type="text" placeholder="Örn. Depo" @keydown.enter.prevent="next" />
              </label>
              <p class="preview"><i class="pi pi-eye" /> Listelerde şöyle görünecek: <strong>{{ displayName.trim() || 'Depo' }} · {{ chosenName }}</strong></p>
            </template>
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
              <template v-if="!isSelf"><dt><i class="pi pi-briefcase" /> {{ customerType === 'corporate' ? 'Şirket' : 'Firma' }}</dt><dd>{{ chosenName }}<small v-if="willCreateCompany"> · yeni {{ customerType === 'corporate' ? 'şirket' : 'firma' }}</small></dd></template>
              <template v-else-if="customerName"><dt><i class="pi pi-sitemap" /> Organizasyon</dt><dd>{{ customerName }}<small v-if="customerType"> · {{ customerTypeLabel(customerType) }}</small></dd></template>
              <template v-if="isSelf && customerType === 'public'"><dt><i class="pi pi-building" /> İşyeri</dt><dd>{{ chosenName }}<small v-if="willCreateCompany"> · Firmalar'a bu adla eklenir</small></dd></template>
              <template v-if="askName && displayName.trim()"><dt><i class="pi pi-tag" /> İşyeri adı</dt><dd>{{ displayName.trim() }} <small>· listelerde "{{ displayName.trim() }} · {{ chosenName }}"</small></dd></template>
              <dt><i class="pi pi-map-marker" /> Lokasyon</dt><dd>{{ location.name }}</dd>
              <dt><i class="pi pi-search" /> Faaliyet</dt><dd>{{ selectedNace ? `${selectedNace.nace_code} ${selectedNace.activity_name}` : '—' }}</dd>
              <dt><i class="pi pi-exclamation-triangle" /> Tehlike sınıfı</dt><dd><em class="badge" :class="hazardClassKey(hazardClass)">{{ hazardClass }}</em></dd>
              <dt><i class="pi pi-users" /> Çalışan sayısı</dt><dd>{{ EMPLOYEE_BANDS.find(b => b.value === employeeBand)?.label }}</dd>
              <dt><i class="pi pi-id-card" /> SGK sicil no</dt><dd>{{ sgkNumber.trim() || '—' }}</dd>
            </dl>
            <label v-if="!alreadyAttached && namedByLocation">İşyeri adı <small>(lokasyon adından gelir; isterseniz değiştirin)</small>
              <input v-model="displayName" type="text" :placeholder="location.name" />
            </label>
            <p v-else-if="alreadyAttached" class="hint"><i class="pi pi-clone" /> "{{ displayName.trim() }}" adıyla ayrı işletme olarak eklenecek.</p>
            <p class="hint"><i class="pi pi-user" /> Bu işyerine siz uzman olarak atanırsınız; ekipmanları bu işyerine ekleyebilirsiniz.</p>
          </template>

          <p v-if="error" class="form-error">{{ error }}</p>
        </div>
      </div>

      <div class="modal-actions">
        <button v-if="stepIndex > 0" class="secondary-button" type="button" :disabled="saving || savingType" @click="back"><i class="pi pi-arrow-left" /> Geri</button>
        <button v-else class="secondary-button" type="button" @click="close">İptal</button>
        <button v-if="step === 'campus' && separate === false" class="primary-button" type="button" @click="close">Kapat</button>
        <button v-else-if="step === 'sgk' && !sgkNumber.trim()" class="secondary-button" type="button" @click="next">Atla</button>
        <button v-if="step === 'summary'" class="primary-button" type="button" :disabled="saving" @click="save"><i class="pi pi-check" /> {{ saving ? 'Atanıyor...' : 'Ata' }}</button>
        <button v-else-if="!(step === 'campus' && separate === false) && !(step === 'sgk' && !sgkNumber.trim())" class="primary-button" type="button" :disabled="!ready || !canNext || savingType" @click="next">{{ savingType ? 'Kaydediliyor...' : 'İleri' }} <i class="pi pi-arrow-right" /></button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// Bireysel uzmanın "Lokasyona Firma Ata" sihirbazı (kullanıcı 18 Ekim 2026): soru-cevapla WorkplaceForm'un yaptığını yapar,
// kaydı aynı isteklerle yapar. Sorular müşteri türüne göre (pk-customer-types): kamu kurumu / şahıs işletmesinde işyeri
// organizasyonun kendisidir, firma hiç anılmaz (aynı adlı firma kartı varsa o, yoksa arka planda açılır); kurumsalda şirket
// sorulur (ana firma ya da grup şirketi). Türü boş eski müşteride ilk adımda bir kez sorulur ve kaydedilir. Uygulamada taşeron yok.
import { HAZARD_CLASSES, hazardClassKey, normalizeCompanyName, useExpertApi, type MyCompany, type NaceItem } from '~/composables/useExpertApi'
import { CUSTOMER_TYPES, customerTypeLabel, useCustomerTypes, type CustomerType } from '~/composables/useCustomerTypes'

const props = defineProps<{ customerId: number | null; customerName?: string | null; location: { id: number; name: string } }>()
const emit = defineEmits<{ close: []; saved: [] }>()

type Step = 'ctype' | 'target' | 'company' | 'wname' | 'campus' | 'nace' | 'hazard' | 'employees' | 'sgk' | 'summary'
const SELF = -2
const NEW_COMPANY = -1
const FIRM_TYPES = [
  { id: 'corporate', label: 'Kurumsal firma', icon: 'pi pi-building', text: 'Şirket (A.Ş., Ltd. Şti.).' },
  { id: 'individual', label: 'Şahıs işletmesi', icon: 'pi pi-user', text: 'Tek kişiye ait işletme.' }
]
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
  target: { name: 'Hizmet', icon: 'pi pi-compass', title: 'Bu lokasyonda kime hizmet veriyorsunuz?', desc: 'Kurumun kendisine mi, lokasyonda faaliyet gösteren bir firmaya mı? Firmaya hizmet veriyorsanız kurum için kayıt açılmaz.' },
  company: { name: 'Şirket', icon: 'pi pi-briefcase', title: 'Bu işyeri hangi şirkete ait?', desc: 'Genellikle ana firmanın kendisidir. Holdinglerde grup şirketini seçin ya da ekleyin.' },
  wname: { name: 'Faaliyet yeri', icon: 'pi pi-th-large', title: 'Lokasyonun tamamında mı, bir bölümünde mi faaliyet gösteriyor?', desc: 'Firma lokasyonun yalnız bir bölümünde çalışıyorsa o bölümün adı işyerinin adı olur; aynı firmanın farklı bölümleri böylece ayrılır.' },
  campus: { name: 'Ayrı işletme', icon: 'pi pi-clone', title: 'Bu lokasyonda zaten bir işyeri kayıtlı', desc: 'Aynı lokasyonda (ör. kampüs) ayrı SGK sicilli başka bir işletme olabilir. Bu ayrı bir işletme mi?' },
  nace: { name: 'Faaliyet', icon: 'pi pi-search', title: 'Bu lokasyonda ne iş yapılıyor?', desc: 'NACE kodunu ya da faaliyeti yazın; seçtiğiniz faaliyetin tehlike sınıfı otomatik gelir.' },
  hazard: { name: 'Tehlike sınıfı', icon: 'pi pi-exclamation-triangle', title: 'Tehlike sınıfı', desc: 'Tehlike sınıfı, olası idari para cezası hesabında ve işyeri bilgilerinde kullanılır.' },
  employees: { name: 'Çalışan sayısı', icon: 'pi pi-users', title: 'Bu işyerinde kaç kişi çalışıyor?', desc: 'Olası idari para cezası (6331) tehlike sınıfı ve çalışan sayısına göre hesaplanır.' },
  sgk: { name: 'SGK sicil', icon: 'pi pi-id-card', title: 'İşyerinin SGK sicil numarasını biliyor musunuz?', desc: 'İsteğe bağlıdır; bilmiyorsanız atlayın, sonra lokasyonun firma panelinden ekleyebilirsiniz.' },
  summary: { name: 'Özet', icon: 'pi pi-list-check', title: 'Kontrol edip atayın', desc: 'Bilgileri kontrol edin. Geri dönüp değiştirebilirsiniz.' }
}

const { get, post, patch, errorMessage } = useExpertApi()
const newTitle = ref('')
const titleNames = ref<string[]>([])
const { status: billing, load: loadBilling } = useBilling()
const { setName: setWorkplaceName, addAdditional } = useWorkplaceNames()
const workplaceLimitFull = () => {
  const limit = billing.value?.unlimited ? null : billing.value?.workplace_limit
  return limit !== null && limit !== undefined && (billing.value?.active_workplaces ?? 0) >= limit
}

// Müşteri türü: kamu ve şahısta işyeri organizasyonun kendisidir (firma sorulmaz); kurumsalda şirket sorulur; boşsa bir kez sorulur.
const { load: loadCustomerTypes, save: saveCustomerType } = useCustomerTypes()
const customerType = ref<CustomerType | null>(null)
const typeAsked = ref(false)
const pickedType = ref<CustomerType | null>(null)
const savingType = ref(false)
const ready = ref(false)
const companySelection = ref<number | null>(props.customerName ? SELF : null)
// Kamu kurumu: kurumun kendisi (self) ya da lokasyondaki bir firma (firm).
const target = ref<'self' | 'firm'>('self')
const newFirmType = ref<string | null>(null)
const newCompany = reactive({ name: '' })
const duplicateCompany = ref<MyCompany | null>(null)
const separate = ref<boolean | null>(null)
const hasOwnName = ref<boolean | null>(null)
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
const attachedIds = ref<Set<number>>(new Set())
const customerCompanyIds = ref<Set<number>>(new Set())
const otherCustomerIds = ref<Set<number>>(new Set())
const chosenIds = ref<Set<number>>(new Set())
const titleOf = ref<Record<string, string>>({})

const findDuplicate = (name: string) => {
  const key = normalizeCompanyName(name)
  return key ? myCompanies.value.find(c => normalizeCompanyName(c.name) === key) || null : null
}
const companyLabel = (c: MyCompany) => titleOf.value[c.business_entity_id] ? `${c.name} · ${titleOf.value[c.business_entity_id]}` : c.name
// Organizasyonun kendisi: organizasyonla aynı adı taşıyan firma kartı.
// Organizasyonun kendi işyerinin firma kartı: kamu kurumunda lokasyonun adı (her birim kendi kartı, ör. GençOsman İtfaiye
// Müdürlüğü; kullanıcı 18 Ekim 2026), şahıs ve kurumsalda organizasyonun adı. Aynı adla kart varsa o kullanılır.
const selfCardName = computed(() => customerType.value === 'public' ? props.location.name : props.customerName || '')
const selfCompany = computed(() => selfCardName.value ? findDuplicate(selfCardName.value) : null)
const ownCompanies = computed(() => myCompanies.value.filter(c => customerCompanyIds.value.has(c.business_entity_id) || chosenIds.value.has(c.business_entity_id)))
const freeCompanies = computed(() => myCompanies.value.filter(c => !customerCompanyIds.value.has(c.business_entity_id) && !chosenIds.value.has(c.business_entity_id) && !otherCustomerIds.value.has(c.business_entity_id)))

// İşyeri organizasyonun kendisi mi: kamu / şahıs her zaman; kurumsalda "ana firma" seçiliyse.
const isSelf = computed(() => customerType.value === 'corporate' ? companySelection.value === SELF
  : customerType.value === 'public' ? target.value === 'self' : true)
// Şahıs işletmesinde her lokasyon bir şubedir: işyerine lokasyonun adı verilir (firma kartı işletmenin kendisi).
// Kamu kurumunda buna gerek yok: firma kartı zaten lokasyonun adıyla açılır.
const namedByLocation = computed(() => customerType.value === 'individual')
// Seçilen firmanın kimliği (yeni kart açılacaksa null).
const chosenId = computed<number | null>(() => isSelf.value
  ? selfCompany.value?.business_entity_id ?? null
  : companySelection.value && companySelection.value > 0 ? companySelection.value : null)
const willCreateCompany = computed(() => chosenId.value === null)
const selfAttached = computed(() => !!selfCompany.value && attachedIds.value.has(selfCompany.value.business_entity_id))
const chosenName = computed(() => isSelf.value
  ? selfCompany.value?.name || selfCardName.value
  : chosenId.value ? myCompanies.value.find(c => c.business_entity_id === chosenId.value)?.name || '' : newCompany.name.trim())
// Kart gerekirse: şahısta şahıs, diğerlerinde kurumsal (firma türünde kamu yok; kamu kurumu kurumsal görünür, kullanıcı onayladı).
const chosenType = computed(() => isSelf.value ? (customerType.value === 'individual' ? 'individual' : 'corporate')
  : customerType.value === 'public' ? newFirmType.value || 'corporate' : 'corporate')
const alreadyAttached = computed(() => chosenId.value !== null && attachedIds.value.has(chosenId.value))
// İşyeri adı sorusu: kurumsal firmada ve lokasyondaki firmada (kamu kurumunun kendisinde ve şahısta sorulmaz; ayrı işletmede campus adımı sorar).
const askName = computed(() => !alreadyAttached.value && !namedByLocation.value && !(customerType.value === 'public' && isSelf.value))

const steps = computed<Step[]>(() => [
  ...(typeAsked.value ? ['ctype' as Step] : []),
  ...(customerType.value === 'public' ? ['target' as Step] : []),
  ...(customerType.value === 'corporate' || (customerType.value === 'public' && target.value === 'firm') ? ['company' as Step] : []),
  ...(alreadyAttached.value ? ['campus' as Step] : []),
  ...(askName.value ? ['wname' as Step] : []),
  'nace', 'hazard', 'employees', 'sgk', 'summary'
])
const stepIndex = ref(0)
const step = computed(() => steps.value[Math.min(stepIndex.value, steps.value.length - 1)]!)
const stepTitle = computed(() => {
  if (step.value === 'ctype' && props.customerName) return `"${props.customerName}" ne tür bir organizasyon?`
  if (step.value === 'company' && customerType.value !== 'corporate') return 'Hangi firma?'
  if (step.value === 'wname' && chosenName.value) return `"${chosenName.value}" lokasyonun tamamında mı, bir bölümünde mi faaliyet gösteriyor?`
  if (step.value === 'campus') return isSelf.value ? 'Bu lokasyonda zaten bir işyeri kayıtlı' : `"${chosenName.value}" bu lokasyonda zaten kayıtlı`
  if (step.value === 'nace' && !isSelf.value && chosenName.value) return `"${chosenName.value}" bu lokasyonda ne iş yapıyor?`
  return STEP_META[step.value].title
})

const canNext = computed(() => {
  switch (step.value) {
    case 'ctype': return !!pickedType.value
    case 'target': return true
    case 'company': return companySelection.value === NEW_COMPANY
      ? !!newCompany.name.trim() && !duplicateCompany.value && (customerType.value === 'corporate' || !!newFirmType.value)
      : !!companySelection.value
    case 'wname': return hasOwnName.value === false || (hasOwnName.value === true && !!displayName.value.trim())
    case 'campus': return separate.value === true && !!displayName.value.trim()
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
      if (customerType.value === 'corporate' && companySelection.value === null && props.customerName) companySelection.value = SELF
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

function onCompanySelect() { duplicateCompany.value = companySelection.value === NEW_COMPANY ? findDuplicate(newCompany.name) : null; focusLater() }
function useExisting(company: MyCompany) {
  chosenIds.value = new Set([...chosenIds.value, company.business_entity_id])
  companySelection.value = company.business_entity_id
  duplicateCompany.value = null
}

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

// Seçim değişince sonraki adımın cevapları sıfırlanır (eski cevapla kayıt olmasın).
watch(target, (value) => { if (value === 'firm') { companySelection.value = null; newFirmType.value = null } })
watch(chosenId, () => { separate.value = null; if (alreadyAttached.value) displayName.value = '' })
// Özete gelince ad boşsa lokasyon adıyla doldurulur (kamu / şahıs).
watch(() => steps.value[stepIndex.value], (current) => {
  if (current === 'summary' && namedByLocation.value && !alreadyAttached.value && !displayName.value.trim()) displayName.value = props.location.name
})

// Kayıt: WorkplaceForm.save ile aynı istekler ve sıra.
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
      const created = await post<MyCompany>('/my-companies', { name: chosenName.value, company_type: chosenType.value || 'corporate' })
      businessEntityId = created.business_entity_id
      myCompanies.value.push(created)
      // Unvan yeni firmaya bağlanır (Firma Tanımla ile aynı uç); kaydedilemezse işyeri yine eklenir.
      if (!isSelf.value && newTitle.value.trim()) {
        try { await patch(`/pk-company-titles/${businessEntityId}`, { title: newTitle.value.trim() }) } catch { /* Firmalar sayfasından eklenebilir */ }
      }
    }
    const workplaceName = displayName.value.trim()
    const details = {
      hazard_class: hazardClass.value,
      nace_code: selectedNace.value?.nace_code ?? null,
      activity: selectedNace.value?.activity_name ?? null,
      sgk_workplace_number: sgkNumber.value.trim() || null
    }
    let workplaceId: number | null = null
    if (alreadyAttached.value) {
      workplaceId = (await addAdditional({ location_id: props.location.id, business_entity_id: businessEntityId, name: workplaceName, ...details })).id
    } else {
      await post(`/customers/${props.customerId}/locations/${props.location.id}/companies`, { business_entity_id: businessEntityId, ...details })
      const items = await get<{ id: number; business_entity_id: number }[]>(`/customers/${props.customerId}/locations/${props.location.id}/companies`)
      workplaceId = items.filter(item => item.business_entity_id === businessEntityId).sort((a, b) => b.id - a.id)[0]?.id ?? null
    }
    loadBilling()
    try {
      if (workplaceId) await post(`/pk-workplace-employee-bands/${workplaceId}`, { band: employeeBand.value })
    } catch (e: any) {
      error.value = errorMessage(e, 'Firma atandı ama çalışan sayısı kaydedilemedi; Genel Bakış → Ceza sekmesinden seçebilirsiniz.')
      return
    }
    try {
      if (workplaceId && workplaceName && !alreadyAttached.value) await setWorkplaceName(workplaceId, workplaceName)
    } catch (e: any) {
      error.value = errorMessage(e, 'Firma atandı ama işyeri adı kaydedilemedi; lokasyonun firma panelinden düzenleyebilirsiniz.')
      return
    }
    emit('saved')
  } catch (e: any) {
    error.value = errorMessage(e, 'Firma atanamadı.')
  } finally { saving.value = false }
}

onMounted(async () => {
  const types = await loadCustomerTypes()
  customerType.value = props.customerId ? types[String(props.customerId)] ?? null : null
  typeAsked.value = !customerType.value
  pickedType.value = customerType.value
  ready.value = true
  try {
    const data = await get<{ titles: { id: number; name: string }[]; links: Record<string, number> }>('/pk-company-titles')
    const names: Record<string, string> = Object.fromEntries(data.titles.map(title => [String(title.id), title.name]))
    titleOf.value = Object.fromEntries(Object.entries(data.links || {}).map(([entity, titleId]) => [entity, names[String(titleId)] || '']))
    titleNames.value = data.titles.map(title => title.name)
  } catch { titleOf.value = {} }
  try { myCompanies.value = await get<MyCompany[]>('/my-companies') } catch { myCompanies.value = [] }
  try {
    const items = await get<{ business_entity_id: number }[]>(`/customers/${props.customerId}/locations/${props.location.id}/companies`)
    attachedIds.value = new Set(items.map(i => i.business_entity_id))
  } catch { /* boş kalır; backend yine de mükerrer kaydı engeller */ }
  try {
    const result = await get<{ customer: number[]; other_customers: number[] }>(`/customers/${props.customerId}/companies`)
    customerCompanyIds.value = new Set(result.customer)
    otherCustomerIds.value = new Set(result.other_customers)
  } catch { /* alınamazsa tüm firmalar gösterilir */ }
})
</script>

<style scoped>
.modal-backdrop{position:fixed;inset:0;z-index:110;background:var(--admin-overlay);display:grid;place-items:center;padding:20px}
.modal-card{width:min(860px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:24px 26px;background:var(--admin-input);border-radius:14px;box-shadow:0 20px 60px var(--admin-shadow)}
.modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:20px}
.head-title{display:flex;align-items:center;gap:14px}
.head-icon{flex:none;width:46px;height:46px;display:grid;place-items:center;border-radius:12px;background:var(--pk-yellow);color:#111827;font-size:20px}
.modal-head h2{margin:0;color:var(--admin-heading);font-size:19px}
.modal-head p{display:flex;align-items:center;gap:6px;margin:5px 0 0;color:var(--admin-muted);font-size:12.5px}
.close-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:var(--admin-muted);cursor:pointer;border-radius:7px}.close-button:hover{background:var(--admin-hover);color:var(--admin-heading)}
.layout{display:grid;grid-template-columns:190px minmax(0,1fr);gap:24px}
.stepper{list-style:none;margin:0;padding:14px 12px;border-radius:12px;background:var(--admin-soft);display:flex;flex-direction:column;gap:4px;align-self:start}
.stepper li{display:flex;align-items:center;gap:10px;padding:8px;border-radius:8px;color:var(--admin-muted);font-size:12.5px;font-weight:600}
.stepper li.on{background:var(--admin-accent-soft);color:var(--admin-heading)}
.stepper .dot{flex:none;width:28px;height:28px;display:grid;place-items:center;border-radius:50%;background:var(--admin-input);border:1px solid var(--admin-border);font-size:12px}
.stepper li.on .dot{background:var(--pk-yellow);border-color:var(--pk-yellow);color:#111827}
.stepper li.done .dot{background:#12b76a;border-color:#12b76a;color:#fff}
.content{min-width:0}
.step-head{display:flex;gap:14px;margin-bottom:18px}
.step-icon{flex:none;width:44px;height:44px;display:grid;place-items:center;border-radius:11px;background:var(--admin-chip);color:var(--admin-heading);font-size:19px}
.step-count{margin:0 0 3px;color:var(--admin-muted);font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
h3{margin:0;color:var(--admin-heading);font-size:17px;line-height:1.3}
.step-desc{margin:6px 0 0;color:var(--admin-muted);font-size:12.5px;line-height:1.55}
.loading{display:flex;align-items:center;gap:8px;padding:30px 0;color:var(--admin-muted);font-size:13px}
.example{display:flex;gap:10px;margin:0 0 14px;padding:12px 14px;border-radius:10px;background:var(--admin-accent-soft);color:var(--admin-text);font-size:12.5px;line-height:1.55}.example > .pi{margin-top:3px;color:#b58900}.example b{color:var(--admin-heading)}
.preview{display:flex;align-items:center;gap:8px;margin:-4px 0 0;color:var(--admin-muted);font-size:12.5px}.preview strong{color:var(--admin-heading)}
.firm-strip{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:-4px 0 18px;padding:10px 13px;border:1px solid var(--admin-border);border-radius:10px;background:var(--admin-soft);color:var(--admin-text);font-size:12.5px}
.firm-strip > .pi{color:var(--admin-heading)}.firm-strip strong{color:var(--admin-heading)}.firm-strip small{color:var(--admin-muted)}
.firm-strip .link-button{margin-left:auto;font-size:12px}
.aside-link{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:22px 0 0;padding-top:14px;border-top:1px dashed var(--admin-border);color:var(--admin-muted);font-size:12px}
.firm-strip.other{border-color:#d7a900;background:var(--admin-accent-soft)}
.question{display:flex;align-items:center;gap:8px;margin:6px 0 10px;color:var(--admin-heading);font-size:13px;font-weight:700}
.cards{display:grid;gap:10px;margin-bottom:14px}.cards.row{grid-template-columns:repeat(2,minmax(0,1fr))}.cards.row.three{grid-template-columns:repeat(3,minmax(0,1fr))}
.card{position:relative;display:flex;align-items:flex-start;gap:12px;padding:14px;border:1px solid var(--admin-border);border-radius:11px;background:var(--admin-input);text-align:left;cursor:pointer;font:inherit;transition:border-color .15s ease, background .15s ease}
.cards.row .card{flex-direction:column}
.card:hover{border-color:#d7a900}.card.on{border-color:#d7a900;background:var(--admin-accent-soft);box-shadow:0 0 0 3px rgba(255,193,7,.12)}
.card-icon{flex:none;width:40px;height:40px;display:grid;place-items:center;border-radius:10px;background:var(--admin-chip);color:var(--admin-heading);font-size:17px}
.card.on .card-icon{background:var(--pk-yellow);color:#111827}
.card-icon.ok{background:var(--admin-success-bg);color:var(--admin-success-text)}
.card.hazard.low .card-icon{background:var(--admin-success-bg);color:var(--admin-success-text)}
.card.hazard.high .card-icon{background:var(--admin-warning-bg);color:var(--admin-warning-text)}
.card.hazard.very-high .card-icon{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.card-text{display:flex;flex-direction:column;gap:4px}.card-text strong{color:var(--admin-heading);font-size:13.5px}.card-text small{color:var(--admin-muted);font-size:12px;line-height:1.45}
.card-check{position:absolute;top:12px;right:12px;color:#b58900;font-size:17px}
label{display:block;margin-bottom:14px;color:var(--admin-heading);font-size:12px;font-weight:700}label small{font-weight:400;color:var(--admin-muted)}
input,select{width:100%;height:44px;margin-top:7px;padding:0 12px;border:1px solid var(--admin-border);border-radius:9px;outline:0;background:var(--admin-input);font:inherit;font-size:13px;color:var(--admin-heading)}
input:focus,select:focus{border-color:#d7a900;box-shadow:0 0 0 3px rgba(255,193,7,.12)}
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
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:0 20px;border:0;border-radius:9px;background:var(--pk-yellow);color:#111827;font-size:13px;font-weight:800;cursor:pointer}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.secondary-button{display:inline-flex;align-items:center;gap:7px;min-height:42px;padding:0 18px;border:1px solid var(--admin-border);border-radius:9px;background:var(--admin-hover);color:var(--admin-heading);font-size:12.5px;font-weight:700;cursor:pointer}
@media(max-width:760px){
  .layout{grid-template-columns:minmax(0,1fr)}
  .stepper{flex-direction:row;overflow:hidden;padding:8px;gap:6px}
  .stepper .name{display:none}
  .cards.row,.cards.row.three{grid-template-columns:minmax(0,1fr)}
  .cards.row .card{flex-direction:row}
}
</style>
