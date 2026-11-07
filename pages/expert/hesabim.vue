<template>
  <div class="profile-page">
    <header class="page-head">
      <span class="head-icon"><i class="pi pi-user" /></span>
      <div>
        <h1>Hesabım</h1>
        <p>Profiliniz, fatura bilgileriniz, paketiniz ve ödemeleriniz tek yerde.</p>
      </div>
    </header>

    <div class="tabs" role="tablist" aria-label="Hesabım bölümleri">
      <button v-for="item in tabs" :key="item.value" type="button" role="tab" :aria-selected="tab === item.value" :class="{ active: tab === item.value }" @click="tab = item.value">
        <i :class="item.icon" /> {{ item.label }}
      </button>
    </div>

    <!-- Fatura bilgileri: faturanın kesileceği ad / unvan, kimlik ya da vergi bilgisi ve adresler (ödeme yapabilene) -->
    <section v-if="tab === 'billing'" class="card wide">
      <div class="card-head">
        <span class="card-icon"><i class="pi pi-file" /></span>
        <div><h2>Fatura bilgileri</h2><p>Paket satın aldığınızda faturanız bu bilgilerle kesilir. Satın alma sırasında da değiştirebilirsiniz.</p></div>
      </div>
      <ExpertBillingProfileForm @forbidden="canPay = false" />
    </section>

    <!-- Paketim: durum, paketler ve satın alma (yenile / yükselt) -->
    <ExpertPackageShop v-else-if="tab === 'package'" />

    <!-- Ödemelerim: paket siparişleri -->
    <section v-else-if="tab === 'orders'" class="orders">
      <p class="muted">Uygulamadan yaptığınız paket ödemeleri. "Bekliyor": ödeme ekranı açıldı, sonuç gelmedi. "İnceleniyor": ödeme alındı ama ekibimizin kontrolü gerekiyor; gerekirse sizinle iletişime geçeriz.</p>
      <ExpertOrderList />
    </section>

    <div v-else-if="loading" class="state">Yükleniyor...</div>
    <div v-else-if="loadError" class="state error">{{ loadError }}<button class="secondary-button" type="button" @click="load">Tekrar Dene</button></div>

    <form v-else class="profile-grid" @submit.prevent="save">
      <div class="column">
        <section class="card">
          <div class="card-head">
            <span class="card-icon"><i class="pi pi-user" /></span>
            <div><h2>Profil Avatarı</h2><p>Gerçek fotoğraf yerine bir ikon seçin.</p></div>
          </div>
          <div class="avatars" role="radiogroup" aria-label="Profil avatarı">
            <label v-for="item in AVATARS" :key="item.value" class="avatar-option" :class="{ selected: form.avatar === item.value }">
              <input v-model="form.avatar" type="radio" name="avatar" :value="item.value" />
              <svg viewBox="0 0 64 64" class="avatar-art" aria-hidden="true">
                <circle cx="32" cy="32" r="32" :fill="item.bg" />
                <path d="M12 60c2-12 10-17 20-17s18 5 20 17a32 32 0 0 1-40 0z" :fill="item.shirt" />
                <rect x="27" y="36" width="10" height="9" rx="3" fill="#f2c4a0" />
                <path v-if="item.value === 'kadin'" d="M17 33c0-14 6-21 15-21s15 7 15 21v9c-4 2-7 2-9 1V27H26v16c-2 1-5 1-9-1z" fill="#3b2a24" />
                <ellipse cx="32" cy="28" rx="11" ry="12" fill="#f6d2b4" />
                <path v-if="item.value === 'erkek'" d="M20 27c0-9 5-14 12-14s12 5 12 14c-3-4-7-6-12-6s-9 2-12 6z" fill="#2f2622" />
                <path v-else d="M21 26c1-8 5-12 11-12s10 4 11 12c-4-3-7-6-11-7-3 3-6 5-11 7z" fill="#3b2a24" />
                <circle cx="28" cy="29" r="1.3" fill="#3a2a22" /><circle cx="36" cy="29" r="1.3" fill="#3a2a22" />
                <path d="M29 34c2 1.5 4 1.5 6 0" stroke="#b5654a" stroke-width="1.4" fill="none" stroke-linecap="round" />
              </svg>
              <strong>{{ item.label }}</strong>
            </label>
          </div>
        </section>

        <section class="card">
          <div class="card-head">
            <span class="card-icon"><i class="pi pi-id-card" /></span>
            <div><h2>Kişisel Bilgiler</h2><p>Hesap bilgileriniz ve iletişim tercihleriniz</p></div>
          </div>
          <div class="field"><label for="p-name">Ad ve Soyad</label><input id="p-name" :value="profile.name" readonly /></div>
          <div class="field"><label for="p-phone">Telefon Numarası</label><input id="p-phone" v-model="form.phone" maxlength="30" placeholder="İsteğe bağlı" inputmode="tel" /></div>
          <div class="field"><label for="p-email">E-posta Adresi</label><input id="p-email" :value="profile.email" readonly /></div>
        </section>

        <section class="card">
          <div class="card-head">
            <span class="card-icon"><i class="pi pi-briefcase" /></span>
            <div><h2>Mesleki Bilgiler</h2><p>Mesleğinizi ve çalışma alanınızı seçin.</p></div>
          </div>
          <div class="field">
            <label for="p-profession">Meslek</label>
            <select id="p-profession" v-model="form.profession">
              <option :value="null">Seçin</option>
              <option v-for="item in PROFESSIONS" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </div>
          <div v-if="form.profession === 'isg_uzmani'" class="field">
            <label for="p-class">Uzmanlık Sınıfı <span class="req">*</span></label>
            <select id="p-class" v-model="form.expert_class" required>
              <option :value="null" disabled>Seçin</option>
              <option v-for="item in CLASSES" :key="item" :value="item">{{ item }} Sınıfı İş Güvenliği Uzmanı</option>
            </select>
          </div>
          <div class="field"><label for="p-specialty">Uzmanlık Alanı</label><input id="p-specialty" v-model="form.specialty" maxlength="150" placeholder="İsteğe bağlı" /></div>
          <div class="field"><label for="p-employer">Çalıştığı Kuruluş</label><input id="p-employer" v-model="form.employer" maxlength="150" placeholder="İsteğe bağlı (örn. ABC OSGB)" /></div>
        </section>
      </div>

      <div class="column">
        <section class="card">
          <div class="card-head">
            <span class="card-icon"><i class="pi pi-building" /></span>
            <div><h2>Firmalar</h2><p>Gelecekteki e-Katip entegrasyonu</p></div>
          </div>
          <div class="note">
            <i class="pi pi-info-circle" />
            <div><strong>İleride e-Katip ile bağlantı planlanıyor.</strong><span>Firma bilgilerinin otomatik getirilmesi düşünülmektedir. Entegrasyon şu anda aktif değildir.</span></div>
          </div>
        </section>

        <section class="card">
          <div class="card-head">
            <span class="card-icon"><i class="pi pi-shield" /></span>
            <div><h2>Hesap Bilgileri</h2><p>Hesap oluşturulurken kaydedilen bilgiler</p></div>
          </div>
          <div class="field"><label for="p-user">Kullanıcı Adı</label><input id="p-user" :value="profile.email" readonly /></div>
          <div class="field"><label for="p-created">Sisteme Kayıt Tarihi</label><input id="p-created" :value="createdText" readonly /></div>
        </section>
      </div>

      <div class="actions">
        <span v-if="saveError" class="message error" role="alert">{{ saveError }}</span>
        <span v-else-if="saved" class="message ok" role="status"><i class="pi pi-check" /> Profil kaydedildi.</span>
        <button class="primary-button" type="submit" :disabled="saving || (form.profession === 'isg_uzmani' && !form.expert_class)">
          <i class="pi pi-save" /> {{ saving ? 'Kaydediliyor...' : 'Profili Kaydet' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
// Hesabım (7 Kas 2026; sitedeki "Hesabım" düğmesi buraya gelir): Profil (Kullanıcı Profili, mockup 29 Eki) tüm hesap
// türlerinde; Fatura bilgileri ve Ödemelerim yalnız ödeme yapabilene (bireysel uzman ya da hesabın yöneticisi, can_pay).
// Ad, e-posta ve kayıt tarihi hesaptan gelir, değişmez.
definePageMeta({ layout: 'expert', middleware: 'expert', hideWorkplaceSwitcher: true })

interface Profile { name: string; email: string; created_at: string | null; avatar: string | null; phone: string | null; profession: string | null; expert_class: string | null; specialty: string | null; employer: string | null }

const AVATARS = [
  { value: 'erkek', label: 'Erkek Avatar', bg: '#c9ecef', shirt: '#3d6fb6' },
  { value: 'kadin', label: 'Kadın Avatar', bg: '#c9ecef', shirt: '#e29aa6' }
]
const PROFESSIONS = [
  { value: 'isg_uzmani', label: 'İş Güvenliği Uzmanı' },
  { value: 'isyeri_hekimi', label: 'İşyeri Hekimi' },
  { value: 'dsp', label: 'Diğer Sağlık Personeli (DSP)' }
]
const CLASSES = ['A', 'B', 'C']

const { get, patch, errorMessage } = useExpertApi()
const { packages } = useBilling()
const route = useRoute()
const router = useRouter()

// Ödeme yapabilir mi (GET /pk-billing/packages can_pay); alınamazsa fatura ve ödeme bölümleri görünmez.
const canPay = ref(false)
const tabs = computed(() => [
  { value: 'profile', label: 'Profil', icon: 'pi pi-user' },
  ...(canPay.value ? [{ value: 'billing', label: 'Fatura bilgileri', icon: 'pi pi-file' }] : []),
  { value: 'package', label: 'Paketim', icon: 'pi pi-box' },
  ...(canPay.value ? [{ value: 'orders', label: 'Ödemelerim', icon: 'pi pi-receipt' }] : [])
])
// Bölüm adreste (?tab=) tutulur; görünmeyen bölüm istenirse Profil açılır.
const tab = computed({
  get: () => tabs.value.find(item => item.value === route.query.tab)?.value || 'profile',
  set: (value: string) => { router.replace({ query: value === 'profile' ? {} : { tab: value } }) }
})

const profile = ref<Profile>({ name: '', email: '', created_at: null, avatar: null, phone: null, profession: null, expert_class: null, specialty: null, employer: null })
const form = reactive({ avatar: null as string | null, phone: '', profession: null as string | null, expert_class: null as string | null, specialty: '', employer: '' })
const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const saveError = ref('')
const saved = ref(false)

const createdText = computed(() => profile.value.created_at ? new Date(profile.value.created_at).toLocaleDateString('tr-TR') : '')

const fill = (data: Profile) => {
  profile.value = data
  // Avatar seçilmemişse ilki (mockup'taki gibi) seçili gelir.
  Object.assign(form, { avatar: data.avatar ?? AVATARS[0].value, phone: data.phone ?? '', profession: data.profession, expert_class: data.expert_class, specialty: data.specialty ?? '', employer: data.employer ?? '' })
}

const load = async () => {
  loading.value = true
  loadError.value = ''
  try { fill(await get<Profile>('/pk-profile')) }
  catch (e: any) { loadError.value = errorMessage(e, 'Profil bilgileri alınamadı.') }
  finally { loading.value = false }
}

// Meslek değişince eski sınıf kalmasın (backend de siler).
watch(() => form.profession, (value) => { if (value !== 'isg_uzmani') form.expert_class = null })
watch(form, () => { saved.value = false })

const save = async () => {
  saving.value = true
  saveError.value = ''
  try {
    fill(await patch<Profile>('/pk-profile', { ...form, phone: form.phone.trim() || null, specialty: form.specialty.trim() || null, employer: form.employer.trim() || null }))
    await nextTick()
    saved.value = true
  }
  catch (e: any) { saveError.value = errorMessage(e, 'Profil kaydedilemedi. Tekrar deneyin.') }
  finally { saving.value = false }
}

onMounted(() => {
  load()
  packages().then((res) => { canPay.value = res.can_pay }).catch(() => {})
})
</script>

<style scoped>
.profile-page { max-width: 1500px; margin: 0 auto; }
.page-head { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
.head-icon { display: grid; place-items: center; width: 58px; height: 58px; border-radius: 14px; background: var(--admin-accent-soft); color: var(--admin-link); font-size: 24px; }
.page-head h1 { margin: 0; color: var(--admin-heading); font-size: 30px; letter-spacing: -.7px; }
.page-head p { margin: 6px 0 0; color: var(--admin-muted); font-size: 14px; }
.tabs { display: flex; flex-wrap: wrap; gap: 4px; width: fit-content; max-width: 100%; margin-bottom: 20px; padding: 4px; border: 1px solid var(--admin-border); border-radius: 10px; background: var(--admin-card); }
.tabs button { display: inline-flex; align-items: center; gap: 8px; min-height: 38px; padding: 0 16px; border: 0; border-radius: 7px; background: transparent; color: var(--admin-muted); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.tabs button.active { background: var(--admin-accent-soft); color: var(--admin-heading); }
.card.wide { max-width: 980px; }
.muted { margin: 12px 0 0; color: var(--admin-muted); font-size: 13px; line-height: 1.55; }
.orders { display: grid; gap: 12px; }
.orders .muted { margin: 0; }
.profile-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; align-items: start; }
.column { display: flex; flex-direction: column; gap: 20px; }
.card { padding: 22px 24px; border: 1px solid var(--admin-border); border-radius: 16px; background: var(--admin-card); box-shadow: 0 8px 24px rgba(40, 70, 110, .06); }
.card-head { display: flex; gap: 14px; margin-bottom: 18px; }
.card-icon { display: grid; place-items: center; flex: none; width: 38px; height: 38px; border-radius: 10px; background: var(--admin-soft); color: var(--admin-link); }
.card-head h2 { margin: 0; color: var(--admin-heading); font-size: 17px; }
.card-head p { margin: 3px 0 0; color: var(--admin-muted); font-size: 12.5px; }
.avatars { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.avatar-option { position: relative; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 18px 12px; border: 1px solid var(--admin-border); border-radius: 12px; cursor: pointer; color: var(--admin-heading); font-size: 13px; }
.avatar-option.selected { border-color: var(--admin-link); background: var(--admin-accent-soft); }
.avatar-option input { position: absolute; top: 12px; right: 12px; width: 18px; height: 18px; accent-color: var(--admin-link); }
.avatar-option:focus-within { outline: 2px solid var(--admin-link); outline-offset: 2px; }
.avatar-art { width: 64px; height: 64px; }
.field { display: grid; grid-template-columns: 180px minmax(0, 1fr); align-items: center; gap: 12px; margin-top: 12px; }
.field label { color: var(--admin-heading); font-size: 13.5px; font-weight: 600; }
.field input, .field select { height: 40px; padding: 0 14px; border: 1px solid var(--admin-border); border-radius: 10px; background: var(--admin-input); color: var(--admin-text); font: inherit; font-size: 14px; }
.field input[readonly] { background: var(--admin-soft); color: var(--admin-muted); }
.field input:focus, .field select:focus { outline: 2px solid var(--admin-link); outline-offset: 0; }
.req { color: var(--admin-danger-text); }
.note { display: flex; gap: 12px; padding: 14px 16px; border-radius: 12px; background: var(--admin-accent-soft); color: var(--admin-accent-text); font-size: 13px; }
.note i { margin-top: 2px; }
.note div { display: flex; flex-direction: column; gap: 4px; }
.actions { grid-column: 1 / -1; display: flex; align-items: center; justify-content: flex-end; gap: 14px; }
.message { font-size: 13.5px; }
.message.error { color: var(--admin-danger-text); }
.message.ok { color: var(--admin-success-text); }
.primary-button { display: inline-flex; align-items: center; gap: 8px; height: 42px; padding: 0 20px; border: 0; border-radius: 10px; background: var(--pk-yellow); color: #1b1b1b; font-weight: 700; font-size: 14px; cursor: pointer; }
.primary-button:disabled { opacity: .55; cursor: not-allowed; }
.secondary-button { margin-left: 12px; height: 36px; padding: 0 14px; border: 1px solid var(--admin-border); border-radius: 10px; background: var(--admin-card); color: var(--admin-text); cursor: pointer; }
.state { padding: 30px; border: 1px solid var(--admin-border); border-radius: 14px; background: var(--admin-card); color: var(--admin-muted); }
.state.error { color: var(--admin-danger-text); }
@media (max-width: 1100px) { .profile-grid { grid-template-columns: 1fr; } }
@media (max-width: 640px) { .field { grid-template-columns: 1fr; gap: 6px; } .avatars { grid-template-columns: 1fr; } }
</style>
