<template>
  <div class="profile-page">
    <!-- Tasarım kataloğu 17-20: solda başlık, sekmeler ve bölümün ana kartı; sağda bölümün çizimi -->
    <div class="top">
      <div class="main-col">
        <div class="page-head">
          <!-- Ana Sayfa yalnız bireysel uzmanda var; diğer hesaplarda sayfa yolu Genel Bakış'ta başlar -->
          <nav class="crumb" aria-label="Sayfa yolu">
            <i class="pi pi-home" aria-hidden="true" />
            <NuxtLink :to="individual ? '/expert/anasayfa' : '/expert'">{{ individual ? 'Ana Sayfa' : 'Genel Bakış' }}</NuxtLink>
            <i class="pi pi-angle-right" aria-hidden="true" />
            <strong>Hesabım</strong>
          </nav>
          <h1>Hesabım</h1>
          <p>{{ SUBTITLES[tab] }}</p>
        </div>

        <div class="tabs" role="tablist" aria-label="Hesabım bölümleri">
          <button v-for="item in tabs" :key="item.value" type="button" role="tab" :aria-selected="tab === item.value" :class="{ active: tab === item.value }" @click="tab = item.value">
            <i :class="item.icon" /> {{ item.label }}
          </button>
        </div>

        <!-- Fatura bilgileri: faturanın kesileceği ad / unvan, kimlik ya da vergi bilgisi ve adresler (ödeme yapabilene) -->
        <section v-if="tab === 'billing'" class="card wide">
          <h2 class="card-title">Fatura bilgileri</h2>
          <!-- inline: kayıtlı bilgiler doğrudan formda (özet görünümü yok); Vazgeç kaydedilmemiş değişiklikleri geri alır -->
          <ExpertBillingProfileForm inline @forbidden="canPay = false" />
        </section>

        <!-- Paketim (katalog 19): mevcut paket; paket seçenekleri ve satın alma aşağıda (PackageShop) -->
        <section v-else-if="tab === 'package'" class="card package-card">
          <header class="package-head">
            <h2 class="card-title">Mevcut paketiniz</h2>
            <span v-if="billing" class="package-tag">{{ billing.package?.name || MODE_LABELS[billing.mode] }}</span>
          </header>
          <dl class="package-rows">
            <div>
              <dt><span class="row-icon"><i class="pi pi-database" /></span> Kalan kredi</dt>
              <dd><strong>{{ billing ? billing.unlimited ? 'Sınırsız' : billing.credits ?? 0 : '—' }}</strong><small v-if="billing && !billing.unlimited"> kredi</small></dd>
            </div>
            <div>
              <dt><span class="row-icon"><i class="pi pi-building" /></span> Aktif işyeri</dt>
              <dd class="usage-cell">
                <strong>{{ billing?.active_workplaces ?? '—' }}<small v-if="billing?.workplace_limit != null">/{{ billing.workplace_limit }}</small></strong>
                <template v-if="billing?.workplace_limit">
                  <ProgressBar :value="workplacePercent" :show-value="false" class="usage" />
                  <small>%{{ workplacePercent }}</small>
                </template>
              </dd>
            </div>
            <div>
              <dt><span class="row-icon"><i class="pi pi-calendar" /></span> Yenileme tarihi</dt>
              <dd><strong>{{ billing?.paid_until ? formatDay(billing.paid_until) : '—' }}</strong></dd>
            </div>
          </dl>
          <div class="package-actions">
            <button class="primary-button" type="button" @click="scrollToPackages"><i class="pi pi-box" /> Paketi yönet <i class="pi pi-arrow-right" /></button>
            <NuxtLink to="/expert/settings/analyses?tab=credits" class="credit-link"><i class="pi pi-file" /> Kredi hareketleri</NuxtLink>
          </div>
        </section>

        <!-- Ödemelerim: paket siparişleri -->
        <section v-else-if="tab === 'orders'" class="orders">
          <p class="muted">Uygulamadan yaptığınız paket ödemeleri. "Bekliyor": ödeme ekranı açıldı, sonuç gelmedi. "İnceleniyor": ödeme alındı ama ekibimizin kontrolü gerekiyor; gerekirse sizinle iletişime geçeriz.</p>
          <ExpertOrderList />
        </section>

        <div v-else-if="loading" class="state">Yükleniyor...</div>
        <div v-else-if="loadError" class="state error">{{ loadError }}<button class="secondary-button" type="button" @click="load">Tekrar Dene</button></div>

        <form v-else class="profile-form" @submit.prevent="save">
          <!-- Profil bilgileri (katalog 17): baş harfli avatar, ad, e-posta, telefon -->
          <section class="card profile-card">
            <h2 class="card-title">Profil bilgileri</h2>
            <div class="profile-body">
              <div class="avatar-col">
                <span class="initials-avatar" aria-hidden="true">{{ initials }}</span>
                <button class="soft-button" type="button" :aria-expanded="avatarOpen" @click="avatarOpen = !avatarOpen"><i class="pi pi-image" /> Avatarı değiştir</button>
              </div>
              <div class="fields">
                <div class="field"><label for="p-name">Ad ve soyad</label><input id="p-name" :value="profile.name" readonly /></div>
                <div class="field"><label for="p-email">E-posta</label><input id="p-email" :value="profile.email" readonly /></div>
                <div class="field"><label for="p-phone">Telefon</label><input id="p-phone" v-model="form.phone" maxlength="30" placeholder="İsteğe bağlı" inputmode="tel" /></div>
                <p class="info"><i class="pi pi-info-circle" /> E-posta adresiniz hesap bilgilerinizde kayıtlıdır.</p>
              </div>
            </div>
            <!-- Avatar seçimi (Avatarı değiştir ile açılır): gerçek fotoğraf yerine bir ikon -->
            <div v-if="avatarOpen" class="avatars" role="radiogroup" aria-label="Profil avatarı">
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
            <div class="actions">
              <span v-if="saveError" class="message error" role="alert">{{ saveError }}</span>
              <span v-else-if="saved" class="message ok" role="status"><i class="pi pi-check" /> Profil kaydedildi.</span>
              <button class="primary-button" type="submit" :disabled="saving || (form.profession === 'isg_uzmani' && !form.expert_class)">
                <i class="pi pi-save" /> {{ saving ? 'Kaydediliyor...' : 'Değişiklikleri kaydet' }}
              </button>
              <button class="outline-button" type="button" :disabled="saving" @click="fill(profile)">Vazgeç</button>
            </div>
          </section>

          <!-- Mesleki bilgiler yalnız bireysel uzman hesabında; katalogda yok, gizli (ileride açılabilir) -->
          <section v-if="SHOW_PROFESSION_CARD && !multiUser" class="card">
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

          <!-- Eski Hesap Bilgileri kartı (kullanıcı adı, kayıt tarihi): katalogda yok, gizli; ileride açılabilir -->
          <section v-if="SHOW_LEGACY_ACCOUNT_CARD" class="card">
            <div class="card-head">
              <span class="card-icon"><i class="pi pi-shield" /></span>
              <div><h2>Hesap Bilgileri</h2><p>Hesap oluşturulurken kaydedilen bilgiler</p></div>
            </div>
            <div class="field"><label for="p-user">Kullanıcı Adı</label><input id="p-user" :value="profile.email" readonly /></div>
            <div class="field"><label for="p-created">Sisteme Kayıt Tarihi</label><input id="p-created" :value="createdText" readonly /></div>
          </section>
        </form>
      </div>

      <aside class="side-col">
        <!-- Profil: katalogdaki yaka kartı (katalog 17'den kırpıldı; karttaki kişi adı silindi, kullanıcının adı yazılır) -->
        <template v-if="tab === 'profile'">
          <figure class="hero">
            <div class="hero-art badge-art">
              <img src="/katalog/profil-katalog.webp" alt="" />
              <span class="hero-pill"><i class="pi pi-check" /><span><small>Hesap durumu</small><strong>Aktif</strong></span></span>
              <span class="badge-initials" aria-hidden="true">{{ initials }}</span>
              <span class="badge-name" aria-hidden="true">{{ profile.name || user?.name }}</span>
              <span class="badge-role" aria-hidden="true">{{ roleLabel }}</span>
            </div>
          </figure>
          <section class="card side-card">
            <h2 class="card-title">Hesap bilgileri</h2>
            <dl class="info-rows">
              <div><dt><i class="pi pi-user" /> Rol</dt><dd>{{ roleLabel }}</dd></div>
              <div><dt><i class="pi pi-clone" /> Paket</dt><dd>{{ billing ? billing.package?.name || MODE_LABELS[billing.mode] : '—' }}</dd></div>
              <div><dt><i class="pi pi-box" /> Kredi</dt><dd>{{ billing ? billing.unlimited ? 'Sınırsız' : `${billing.credits ?? 0} kredi` : '—' }}</dd></div>
            </dl>
          </section>
        </template>

        <!-- Fatura bilgileri: katalogdaki bina ve fatura (katalog 18'den kırpıldı) -->
        <template v-else-if="tab === 'billing'">
          <figure class="hero">
            <div class="hero-art">
              <img src="/katalog/fatura-katalog.webp" alt="" />
              <span class="hero-pill doc"><i class="pi pi-file" /><strong>Fatura profili</strong></span>
            </div>
          </figure>
          <section class="card side-card note-card">
            <span class="note-icon"><i class="pi pi-file" /></span>
            <div><h2>Faturalandırma</h2><p>Paket ödemelerinizde bu bilgiler kullanılır.</p></div>
          </section>
        </template>

        <!-- Paketim: katalogdaki küpler ve jetonlar (katalog 19'dan kırpıldı) -->
        <figure v-else-if="tab === 'package'" class="hero">
          <div class="hero-art">
            <img src="/katalog/paketim-katalog.webp" alt="" />
            <span v-if="billing" class="hero-pill package-pill"><i class="pi pi-check" /><span><strong class="plain">{{ billing.package?.name || MODE_LABELS[billing.mode] }}</strong><strong v-if="billing.mode !== 'none'">Aktif</strong></span></span>
          </div>
        </figure>
      </aside>
    </div>

    <!-- Paketim: paket seçenekleri ve satın alma akışı (PayTR) -->
    <ExpertPackageShop v-if="tab === 'package'" id="paket-secenekleri" />
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
// Katalogda yok, gizli; ileride açılabilir: Mesleki Bilgiler (bireysel uzman) ve eski Hesap Bilgileri kartı (kullanıcı adı,
// kayıt tarihi). Kayıtlı değerler korunur, profil kaydında aynen gönderilir.
const SHOW_PROFESSION_CARD = false
const SHOW_LEGACY_ACCOUNT_CARD = false
const SUBTITLES: Record<string, string> = {
  profile: 'Profil ve iletişim bilgilerinizi yönetin.',
  billing: 'Fatura bilgilerinizi yönetin.',
  package: 'Paket ve kredi kullanımınızı yönetin.',
  orders: 'Ödeme ve fatura geçmişinizi görüntüleyin.'
}

const { get, patch, errorMessage } = useExpertApi()
const { packages, status: billing, load: loadBilling } = useBilling()
const { multiUser, account, roleLabel, load: loadAccount } = useAccount()
const { user } = useAuth()
const route = useRoute()
const router = useRouter()
const individual = computed(() => !!account.value && !multiUser.value)

// Ödeme yapabilir mi (GET /pk-billing/packages can_pay); alınamazsa fatura ve ödeme bölümleri görünmez.
const canPay = ref(false)
const tabs = computed(() => [
  { value: 'profile', label: 'Profil', icon: 'pi pi-user' },
  ...(canPay.value ? [{ value: 'billing', label: 'Fatura bilgileri', icon: 'pi pi-file' }] : []),
  { value: 'package', label: 'Paketim', icon: 'pi pi-box' },
  ...(canPay.value ? [{ value: 'orders', label: 'Ödemelerim', icon: 'pi pi-credit-card' }] : [])
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
const avatarOpen = ref(false)

const workplacePercent = computed(() => {
  const limit = billing.value?.workplace_limit
  return limit ? Math.min(100, Math.round((billing.value?.active_workplaces ?? 0) / limit * 100)) : 0
})
const scrollToPackages = () => document.getElementById('paket-secenekleri')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
const createdText = computed(() => profile.value.created_at ? new Date(profile.value.created_at).toLocaleDateString('tr-TR') : '')
// Baş harfler (üst çubuktaki gibi): adın ilk iki kelimesinin ilk harfleri.
const initials = computed(() => (profile.value.name || user.value?.name || 'UZ').split(' ').filter(Boolean).map(part => part[0]).slice(0, 2).join('').toLocaleUpperCase('tr-TR'))

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
  loadAccount()
  loadBilling()
  packages().then((res) => { canPay.value = res.can_pay }).catch(() => {})
})
</script>

<style scoped>
.profile-page { margin: 0 auto; display: grid; gap: 20px; }
.page-head h1 { margin: 0; color: var(--admin-heading); font-size: 40px; font-weight: 800; line-height: 1.15; letter-spacing: -1px; }
.page-head p { margin: 7px 0 0; color: var(--admin-muted); font-size: 15px; }
.crumb { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: var(--admin-muted); font-size: 13px; }
.crumb a { color: var(--admin-muted); } .crumb a:hover { color: var(--admin-heading); }
.crumb strong { color: var(--admin-heading); font-weight: 600; } .crumb .pi-angle-right { font-size: 11px; }
/* Üst: solda başlık, sekmeler, ana kart; sağda çizim */
.top { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 32px; align-items: start; }
.main-col, .side-col { display: grid; gap: 20px; min-width: 0; }
/* Sekmeler: hap görünümlü, seçili mavi */
.tabs { display: flex; flex-wrap: wrap; gap: 4px; width: fit-content; max-width: 100%; padding: 6px; border: 1px solid var(--admin-border); border-radius: 14px; background: var(--admin-card); box-shadow: 0 8px 22px rgba(var(--pk-shadow-rgb), .05); }
.tabs button { display: inline-flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 22px; border: 0; border-radius: 10px; background: transparent; color: var(--admin-heading); font: inherit; font-size: 15.5px; font-weight: 500; cursor: pointer; }
.tabs button:hover { background: var(--admin-hover); }
.tabs button.active { background: var(--pk-accent); color: var(--pk-on-accent); font-weight: 600; }
.card { padding: 22px 24px; border: 1px solid var(--admin-border); border-radius: 16px; background: var(--admin-card); box-shadow: 0 10px 28px rgba(var(--pk-shadow-rgb), .05); }
.card.wide { max-width: none; }
.card-title { margin: 0 0 18px; color: var(--admin-heading); font-size: 24px; font-weight: 800; }
.card-head { display: flex; gap: 14px; margin-bottom: 18px; }
.card-icon { display: grid; place-items: center; flex: none; width: 38px; height: 38px; border-radius: 10px; background: var(--admin-soft); color: var(--admin-link); }
.card-head h2 { margin: 0; color: var(--admin-heading); font-size: 17px; }
.card-head p { margin: 3px 0 0; color: var(--admin-muted); font-size: 12.5px; }
.muted { margin: 12px 0 0; color: var(--admin-muted); font-size: 13px; line-height: 1.55; }
.orders { display: grid; gap: 12px; }
.orders .muted { margin: 0; }
/* Profil bilgileri */
.profile-form { display: grid; gap: 20px; }
.profile-body { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 28px; }
.avatar-col { display: flex; flex-direction: column; align-items: center; gap: 18px; padding-right: 28px; border-right: 1px solid var(--admin-border); }
.initials-avatar { width: 140px; height: 140px; display: grid; place-items: center; border-radius: 50%; background: var(--pk-text); color: var(--pk-surface); font-size: 46px; font-weight: 800; letter-spacing: 1px; }
.soft-button { display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 16px; border: 1px solid var(--admin-border); border-radius: 10px; background: var(--admin-accent-soft); color: var(--admin-link); font: inherit; font-size: 14.5px; font-weight: 700; cursor: pointer; }
.soft-button:hover { border-color: var(--pk-accent); }
.fields { display: grid; gap: 14px; }
.field { display: grid; gap: 6px; }
.field label { color: var(--admin-heading); font-size: 14px; font-weight: 700; }
.field input, .field select { height: 44px; padding: 0 16px; border: 1px solid var(--admin-border); border-radius: 10px; background: var(--admin-input); color: var(--admin-heading); font: inherit; font-size: 15.5px; }
.field input[readonly] { font-weight: 600; }
.field input:focus, .field select:focus { outline: 0; border-color: var(--pk-accent); box-shadow: 0 0 0 3px var(--pk-focus-ring); }
.info { display: flex; align-items: center; gap: 8px; margin: 0; color: var(--admin-muted); font-size: 13px; }
.req { color: var(--admin-danger-text); }
.avatars { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 18px; }
.avatar-option { position: relative; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 18px 12px; border: 1px solid var(--admin-border); border-radius: 12px; cursor: pointer; color: var(--admin-heading); font-size: 13px; }
.avatar-option.selected { border-color: var(--admin-link); background: var(--admin-accent-soft); }
.avatar-option input { position: absolute; top: 12px; right: 12px; width: 18px; height: 18px; accent-color: var(--admin-link); }
.avatar-option:focus-within { outline: 2px solid var(--admin-link); outline-offset: 2px; }
.avatar-art { width: 64px; height: 64px; }
.actions { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 14px; margin-top: 22px; }
.message { margin-right: auto; font-size: 13.5px; }
.message.error { color: var(--admin-danger-text); }
.message.ok { color: var(--admin-success-text); }
.primary-button { display: inline-flex; align-items: center; justify-content: center; gap: 10px; height: 48px; min-width: 260px; padding: 0 24px; border: 0; border-radius: 12px; background: var(--pk-accent); color: var(--pk-on-accent); font: inherit; font-weight: 700; font-size: 16px; cursor: pointer; }
.primary-button:hover { background: var(--pk-accent-hover); }
.primary-button:disabled { opacity: .55; cursor: not-allowed; }
.outline-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 48px; min-width: 110px; padding: 0 22px; border: 1px solid var(--admin-border); border-radius: 12px; background: var(--admin-card); color: var(--admin-heading); font: inherit; font-size: 16px; font-weight: 700; cursor: pointer; }
.outline-button:hover { background: var(--admin-hover); }
.secondary-button { margin-left: 12px; height: 36px; padding: 0 14px; border: 1px solid var(--admin-border); border-radius: 10px; background: var(--admin-card); color: var(--admin-text); cursor: pointer; }
.state { padding: 30px; border: 1px solid var(--admin-border); border-radius: 14px; background: var(--admin-card); color: var(--admin-muted); }
.state.error { color: var(--admin-danger-text); }
/* Sağ sütun: çizim ve yan kart */
.hero { min-width: 0; margin: 0; display: flex; justify-content: center; }
.hero-art { position: relative; width: min(100%, 560px); container-type: inline-size; }
.hero-art img { display: block; width: 100%; }
.hero-pill { position: absolute; top: 2%; left: 2%; display: inline-flex; align-items: center; gap: 12px; padding: 12px 22px 12px 14px; border: 1px solid var(--admin-border); border-radius: 16px; background: var(--admin-card); box-shadow: 0 10px 26px rgba(var(--pk-shadow-rgb), .1); }
.hero-pill > i { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; background: var(--admin-success-text); color: var(--pk-on-accent); font-size: 14px; }
.hero-pill > span { display: grid; }
.hero-pill small { color: var(--admin-heading); font-size: 14px; font-weight: 600; }
.hero-pill strong { color: var(--admin-success-text); font-size: 19px; font-weight: 800; }
/* Yaka kartının üstüne kullanıcının baş harfleri, adı ve rolü (görselle birlikte büyür, kartın eğimiyle) */
.badge-initials, .badge-name, .badge-role { position: absolute; transform: translate(-50%, -50%) rotate(7deg); white-space: nowrap; pointer-events: none; }
.badge-initials { left: 43.2%; top: 54.3%; color: var(--pk-surface); font-size: 6.2cqw; font-weight: 800; }
.badge-name { left: 41.6%; top: 66.6%; max-width: 46%; overflow: hidden; text-overflow: ellipsis; color: var(--pk-text); font-size: 3.7cqw; font-weight: 800; }
.badge-role { left: 39.8%; top: 72%; color: var(--pk-muted); font-size: 2.8cqw; font-weight: 500; }
.hero-pill.doc { top: 19%; gap: 14px; padding: 14px 26px 14px 18px; }
.hero-pill.doc > i { width: auto; height: auto; background: none; color: var(--admin-link); font-size: 24px; }
.hero-pill.doc strong { color: var(--admin-heading); font-size: 18px; font-weight: 600; }
.package-pill { top: 6%; left: auto; right: 4%; }
.package-pill strong.plain { color: var(--admin-heading); font-size: 17px; }
/* Mevcut paketiniz */
.package-head { display: flex; align-items: center; gap: 14px; margin-bottom: 10px; }
.package-head .card-title { margin: 0; }
.package-tag { padding: 4px 14px; border: 1px solid var(--pk-accent); border-radius: 10px; background: var(--admin-accent-soft); color: var(--admin-link); font-size: 16px; font-weight: 700; }
.package-rows { display: grid; margin: 0; }
.package-rows div { display: grid; grid-template-columns: 220px minmax(0, 1fr); align-items: center; gap: 16px; padding: 12px 0; }
.package-rows div + div { border-top: 1px solid var(--admin-border); }
.package-rows dt { display: flex; align-items: center; gap: 14px; padding-right: 16px; border-right: 1px solid var(--admin-border); color: var(--admin-heading); font-size: 16px; font-weight: 600; }
.row-icon { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 50%; background: var(--admin-accent-soft); color: var(--admin-link); font-size: 17px; }
.package-rows dd { margin: 0; color: var(--admin-text); font-size: 18px; }
.package-rows dd strong { color: var(--admin-heading); font-size: 30px; font-weight: 800; }
.package-rows dd strong small { color: var(--admin-heading); font-size: 28px; font-weight: 700; }
.usage-cell { display: flex; align-items: center; gap: 16px; }
.usage-cell > small { color: var(--admin-muted); font-size: 15px; }
.usage { flex: 1; height: 10px; }
.package-actions { display: flex; align-items: center; gap: 36px; flex-wrap: wrap; margin-top: 16px; }
.package-actions .primary-button { min-width: 0; }
.credit-link { display: inline-flex; align-items: center; gap: 10px; color: var(--admin-link); font-size: 17px; font-weight: 700; text-decoration: underline; }
.side-card .card-title { margin-bottom: 8px; }
.note-card { display: flex; align-items: center; gap: 20px; }
.note-icon { flex: none; width: 72px; height: 72px; display: grid; place-items: center; border-radius: 16px; background: var(--admin-soft); color: var(--admin-heading); font-size: 30px; box-shadow: 0 6px 16px rgba(var(--pk-shadow-rgb), .08); }
.note-card h2 { margin: 0; color: var(--admin-heading); font-size: 24px; font-weight: 800; }
.note-card p { margin: 6px 0 0; color: var(--admin-text); font-size: 16px; }
.info-rows { display: grid; margin: 0; }
.info-rows div { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 4px; }
.info-rows div + div { border-top: 1px solid var(--admin-border); }
.info-rows dt { display: flex; align-items: center; gap: 14px; color: var(--admin-heading); font-size: 16px; }
.info-rows dt i { color: var(--admin-muted); font-size: 18px; }
.info-rows dd { margin: 0; color: var(--admin-heading); font-size: 17px; font-weight: 800; }
@media (max-width: 1200px) { .top { grid-template-columns: 1fr; } .side-col { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; } }
@media (max-width: 800px) {
  .page-head h1 { font-size: 30px; }
  .side-col { grid-template-columns: 1fr; }
  .profile-body { grid-template-columns: 1fr; }
  .avatar-col { padding: 0 0 18px; border-right: 0; border-bottom: 1px solid var(--admin-border); }
  .avatars { grid-template-columns: 1fr; }
  .primary-button { min-width: 0; flex: 1; }
}
</style>
