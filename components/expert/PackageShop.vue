<template>
  <div ref="root" class="package-page">
    <div v-if="loading" class="state">Yükleniyor...</div>
    <div v-else-if="loadError" class="state error">{{ loadError }} <button class="secondary-button" type="button" @click="load">Tekrar Dene</button></div>

    <template v-else-if="data">
      <!-- Mevcut durum: katalogda Hesabım'daki "Mevcut paketiniz" kartında; bu kart gizli, ileride açılabilir -->
      <section v-if="SHOW_STATUS_CARD" class="card status-card">
        <div class="card-head">
          <span class="card-icon"><i class="pi pi-wallet" /></span>
          <div><h2>Mevcut durum</h2><p>Kredi yalnız rapor okumada düşer; aktif işyeri sayısı paketin limitiyle sınırlıdır.</p></div>
        </div>
        <ExpertCreditSummary class="summary" />
        <NuxtLink to="/expert/settings/analyses?tab=credits" class="text-link"><i class="pi pi-history" /> Kredi hareketleri</NuxtLink>
      </section>

      <!-- Satın alma akışı (adımlı) -->
      <section v-if="chosen" class="card flow">
        <div class="flow-head">
          <button class="text-button" type="button" @click="closeFlow"><i class="pi pi-arrow-left" /> Paketlere dön</button>
          <ol class="steps">
            <li v-for="(label, index) in STEPS" :key="label" :class="{ active: step === index + 1, done: step > index + 1 }"><span>{{ index + 1 }}</span>{{ label }}</li>
          </ol>
        </div>

        <div class="chosen-line">
          <strong>{{ chosen.pkg.name }}</strong> · {{ PERIOD_LABELS[period] }} · {{ formatTl(price(chosen.pkg)) }} + KDV
          <span class="action-tag">{{ ACTION_LABELS[chosen.action] }}</span>
        </div>

        <!-- 1. Fatura bilgileri -->
        <div v-if="step === 1" class="step-body">
          <h3>Fatura bilgileri</h3>
          <ExpertBillingProfileForm v-model:profile="billingProfile" v-model:editing="billingEditing" @forbidden="billingForbidden = true" />
          <p v-if="billingForbidden" class="error">Fatura bilgilerine erişiminiz yok. Paket satın alma yalnız hesap yöneticisindedir.</p>
          <p v-if="flowError" class="error" role="alert">{{ flowError }}</p>
          <div class="step-actions">
            <button class="primary-button" type="button" :disabled="!billingProfile || billingEditing" @click="goSummary">Devam <i class="pi pi-arrow-right" /></button>
          </div>
        </div>

        <!-- 2. Özet ve onay (3. adımda ödeme kutusu bunun üstünde açılır) -->
        <div v-else class="step-body">
          <h3>Özet ve onay</h3>
          <p class="explain">{{ actionExplain }}</p>
          <dl class="sum">
            <div><dt>Paket</dt><dd>{{ chosen.pkg.name }} ({{ PERIOD_LABELS[period].toLocaleLowerCase('tr-TR') }})</dd></div>
            <div><dt>Paket bedeli (KDV hariç)</dt><dd>{{ formatTl(price(chosen.pkg)) }}</dd></div>
            <div><dt>KDV (%20)</dt><dd>{{ formatTl(price(chosen.pkg) * 0.2) }}</dd></div>
            <div class="total"><dt>Toplam</dt><dd>{{ formatTl(price(chosen.pkg) * 1.2) }}</dd></div>
          </dl>
          <p class="hint">Kesin tutar bir sonraki adımda, ödeme ekranıyla birlikte gösterilir. Kartınızdan toplam tutar tek çekim olarak alınır; paket kendiliğinden yenilenmez.</p>
          <label class="check">
            <input v-model="agreements" type="checkbox" />
            <span>
              <a :href="`${SITE}/mesafeli-satis-sozlesmesi`" target="_blank" rel="noopener">Mesafeli Satış Sözleşmesi</a>,
              <a :href="`${SITE}/on-bilgilendirme-formu`" target="_blank" rel="noopener">Ön Bilgilendirme Formu</a> ve
              <a :href="`${SITE}/iptal-iade-kosullari`" target="_blank" rel="noopener">İptal ve İade Koşulları</a>'nı okudum ve kabul ediyorum.
            </span>
          </label>
          <p v-if="flowError" class="error" role="alert">{{ flowError }}</p>
          <div class="step-actions">
            <button class="secondary-button" type="button" :disabled="starting" @click="step = 1">Fatura bilgilerine dön</button>
            <button class="primary-button" type="button" :disabled="!agreements || starting" @click="startPayment">
              <i :class="starting ? 'pi pi-spin pi-spinner' : 'pi pi-lock'" /> {{ starting ? 'Ödeme ekranı hazırlanıyor...' : 'Ödemeye geç' }}
            </button>
          </div>
        </div>

      </section>

      <!-- 3. Ödeme: PayTR kart ekranı açılır pencerede; yalnız X ile kapanır, kapanınca özet adımına dönülür -->
      <div v-if="step === 3 && chosen && paytr" class="modal-backdrop">
        <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="pay-title">
          <div class="modal-head">
            <div><h2 id="pay-title">Kart ile ödeme</h2><p>{{ chosen.pkg.name }} paketi ({{ PERIOD_LABELS[period].toLocaleLowerCase('tr-TR') }}) · Sipariş no: {{ paytr.merchant_oid }}</p></div>
            <button class="close-button" type="button" aria-label="Kapat" @click="closePayment"><i class="pi pi-times" /></button>
          </div>
          <dl class="sum">
            <div><dt>Paket bedeli (KDV hariç)</dt><dd>{{ formatTl(paytr.amounts.net) }}</dd></div>
            <div><dt>KDV (%20)</dt><dd>{{ formatTl(paytr.amounts.vat) }}</dd></div>
            <div class="total"><dt>Toplam</dt><dd>{{ formatTl(paytr.amounts.total) }}</dd></div>
          </dl>
          <iframe id="paketim-paytr" :src="`https://www.paytr.com/odeme/guvenli/${paytr.token}`" title="PayTR güvenli ödeme" class="paytr" frameborder="0" scrolling="no" />
          <p class="hint">Kart bilgileriniz PayTR güvenli ödeme sayfasında işlenir, PKTakip'e iletilmez. Ödeme onaylanınca paketiniz birkaç saniye içinde tanımlanır.</p>
        </section>
      </div>

      <section v-else class="card options">
        <!-- Kurallar: katalogda yok, gizli; ileride açılabilir (yenileme / yükseltme açıklaması ve cayma özet adımında da yazar) -->
        <section v-if="SHOW_RULES" class="rules">
          <i class="pi pi-info-circle" />
          <ul>
            <li><strong>Yenileme:</strong> yeni dönem, mevcut döneminizin sonuna eklenir; bir aylık kredi hemen yüklenir.</li>
            <li><strong>Yükseltme:</strong> yeni paket bugün başlar; kalan krediniz silinmez.</li>
            <li><strong>Cayma:</strong> satın almadan sonraki 14 gün içinde koşulsuz cayabilirsiniz.</li>
            <li>Fiyatlara KDV dahil değildir; ödeme adımında %20 KDV ile toplam tutar gösterilir.</li>
          </ul>
        </section>

        <!-- Tasarım kataloğu 19: Paket seçenekleri; Aylık / Yıllık seçimi başlığın yanında -->
        <header class="options-head">
          <h2>Paket seçenekleri</h2>
          <div class="period-row">
            <span class="muted">{{ period === 'yearly' ? 'Yıllık ödemede fiyat bir yıl içindir.' : 'Aylık ödemede fiyat bir ay içindir.' }}</span>
            <SelectButton v-model="period" :options="PERIODS" option-label="label" option-value="value" :allow-empty="false" aria-label="Ödeme dönemi" />
          </div>
        </header>

        <p v-if="reason" class="reason"><i class="pi pi-lock" /> {{ reason }}</p>

        <div v-if="!data.packages.length" class="state">Şu anda satın alınabilecek paket yok.</div>
        <div class="packages">
          <article v-for="pkg in data.packages" :key="pkg.id" class="package" :class="{ current: pkg.id === status?.package?.id, highlight: pkg.id === highlightId }">
            <header class="package-head">
              <span class="package-icon"><i class="pi pi-box" /></span>
              <span class="package-title"><h3>{{ pkg.name }}</h3><small>{{ formatTl(price(pkg)) }} + KDV / {{ period === 'yearly' ? 'yıl' : 'ay' }}</small></span>
              <span v-if="pkg.id === status?.package?.id" class="current-tag">Mevcut paket</span>
            </header>
            <ul>
              <li><i class="pi pi-check" /> Ayda {{ pkg.monthly_credits }} kredi</li>
              <li><i class="pi pi-check" /> {{ pkg.workplace_limit == null ? 'Sınırsız aktif işyeri' : `${pkg.workplace_limit} aktif işyeri` }}</li>
              <li><i class="pi pi-check" /> Sınırsız kullanıcı</li>
            </ul>
            <template v-if="canBuy">
              <p v-if="actionOf(pkg) === 'locked'" class="locked">Mevcut döneminiz {{ formatDay(status!.paid_until!) }} tarihinde bitince geçebilirsiniz.</p>
              <button v-else class="choose-button" type="button" @click="choose(pkg)">{{ ACTION_LABELS[actionOf(pkg) as Action] }} <i class="pi pi-angle-right" /></button>
            </template>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
// Paketim (7 Kas 2026; Hesabım → Paketim sekmesi): satın alma uygulamanın içinden, PayTR iFrame ile (site yalnız ücretsiz üyelik açar).
// Akış: paket kartı → 1. fatura bilgileri → 2. özet + sözleşme onayı → 3. POST /pk-billing/paytr/start → PayTR kutusu →
// PayTR sonunda /expert/odeme-sonuc'u açar. Tutar ve KDV sunucuda hesaplanır; burada fiyat × 1,20 yalnız ön gösterimdir.

type Action = 'buy' | 'renew' | 'upgrade'
const SITE = 'https://pktakip.com'
const STEPS = ['Fatura bilgileri', 'Özet ve onay', 'Ödeme']
const PERIODS = [{ label: 'Aylık', value: 'monthly' }, { label: 'Yıllık', value: 'yearly' }]
const ACTION_LABELS: Record<Action, string> = { buy: 'Satın al', renew: 'Yenile', upgrade: 'Yükselt' }
// Katalogda yok, gizli; ileride açılabilir: mevcut durum kartı (Hesabım'daki Mevcut paketiniz kartında) ve kurallar kutusu.
const SHOW_STATUS_CARD = false
const SHOW_RULES = false
const root = ref<HTMLElement | null>(null)

const route = useRoute()
const router = useRouter()
const { post, errorMessage } = useExpertApi()
const { status, packages } = useBilling()

const data = ref<PackagesResponse | null>(null)
const loading = ref(true)
const loadError = ref('')
const period = ref<'monthly' | 'yearly'>('monthly')
const highlightId = ref<number | null>(null)

const chosen = ref<{ pkg: PkPackage; action: Action } | null>(null)
const step = ref(1)
const billingProfile = ref<BillingProfile | null>(null)
const billingEditing = ref(false)
const billingForbidden = ref(false)
const agreements = ref(false)
const starting = ref(false)
const flowError = ref('')
const paytr = ref<{ token: string; merchant_oid: string; amounts: { net: string; vat: string; total: string } } | null>(null)

const canBuy = computed(() => !!data.value?.can_pay && !status.value?.unlimited)
const reason = computed(() => canBuy.value ? '' : data.value?.cannot_pay_reason || (status.value?.unlimited ? 'Hesabınız sınırsız kullanımda; paket satın almanız gerekmez.' : 'Bu hesapta paket satın alamazsınız.'))
const price = (pkg: PkPackage) => Number(period.value === 'yearly' ? pkg.yearly_price : pkg.monthly_price)
// Ödenen dönem sürüyor mu (Yenile / daha ucuz pakete geçiş kilidi).
const activePeriod = computed(() => !!status.value?.paid_until && new Date(status.value.paid_until.replace(' ', 'T')).getTime() > Date.now())
const currentPkg = computed(() => data.value?.packages.find(p => p.id === status.value?.package?.id))

// Mevcut paket + aktif dönem → Yenile; daha pahalı → Yükselt; aktif dönemde daha ucuz → kilitli; diğer → Satın al.
const actionOf = (pkg: PkPackage): Action | 'locked' => {
  const current = currentPkg.value
  if (!current) return 'buy'
  if (pkg.id === current.id) return activePeriod.value ? 'renew' : 'buy'
  if (Number(pkg.monthly_price) > Number(current.monthly_price)) return 'upgrade'
  if (activePeriod.value && Number(pkg.monthly_price) < Number(current.monthly_price)) return 'locked'
  return 'buy'
}

const actionExplain = computed(() => {
  if (chosen.value?.action === 'renew') return `Yeni dönem, mevcut döneminizin sonuna (${formatDay(status.value!.paid_until!)}) eklenir.`
  if (chosen.value?.action === 'upgrade') return 'Yeni paket bugün başlar; kalan krediniz silinmez. 14 gün içinde koşulsuz cayabilirsiniz.'
  return 'Paketiniz ödeme onaylanınca başlar. 14 gün içinde koşulsuz cayabilirsiniz.'
})

const choose = (pkg: PkPackage) => {
  const action = actionOf(pkg)
  if (action === 'locked') return
  chosen.value = { pkg, action }
  step.value = 1
  agreements.value = false
  flowError.value = ''
  paytr.value = null
  // Akış kartı paket seçeneklerinin yerinde açılır (Hesabım'da üstte mevcut paket kartı var)
  nextTick(() => root.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
const closeFlow = () => { chosen.value = null; paytr.value = null }
const goSummary = () => { flowError.value = ''; step.value = 2 }
const closePayment = () => { paytr.value = null; step.value = 2 }

const startPayment = async () => {
  if (!chosen.value || starting.value) return
  starting.value = true
  flowError.value = ''
  try {
    paytr.value = await post('/pk-billing/paytr/start', { pk_package_id: chosen.value.pkg.id, period: period.value, agreements: true })
    // Sonuç sayfası paketin tanımlandığını bu önceki durumla karşılaştırarak anlar.
    try { sessionStorage.setItem('pk_pay_before', JSON.stringify({ package_id: status.value?.package?.id ?? null, paid_until: status.value?.paid_until ?? null })) } catch {}
    step.value = 3
    loadResizer()
  } catch (e: any) {
    const errors = e?.data?.errors as Record<string, string[]> | undefined
    if (errors?.billing_profile) step.value = 1
    flowError.value = e?.status === 429 ? 'Çok fazla deneme yapıldı. Bir dakika sonra tekrar deneyin.' : errorMessage(e, 'Ödeme ekranı açılamadı. Bağlantınızı kontrol edip tekrar deneyin.')
  } finally { starting.value = false }
}

// PayTR'nin yükseklik ayarlayıcısı (PayTR dokümanındaki script, sitedeki üyelik formuyla aynı); bir kez yüklenir.
const loadResizer = () => {
  const run = () => nextTick(() => (window as any).iFrameResize?.({}, '#paketim-paytr'))
  if ((window as any).iFrameResize) return run()
  const script = document.createElement('script')
  script.src = 'https://www.paytr.com/js/iframeResizer.min.js'
  script.onload = run
  document.head.appendChild(script)
}

const load = async () => {
  loading.value = true
  loadError.value = ''
  try {
    data.value = await packages()
    status.value = data.value.status
  } catch (e: any) {
    loadError.value = errorMessage(e, 'Paketler alınamadı.')
  } finally { loading.value = false }
}

onMounted(async () => {
  await load()
  // Sitede seçilen paket (?plan=&period=, pk_plan çerezinden): o dönem ve paket seçili açılır; ad eşleşmezse yok sayılır.
  const plan = String(route.query.plan || '').trim().toLocaleLowerCase('tr-TR')
  if (!plan || !data.value) return
  if (route.query.period === 'yearly' || route.query.period === 'monthly') period.value = route.query.period
  const pkg = data.value.packages.find(p => p.name.trim().toLocaleLowerCase('tr-TR') === plan)
  router.replace({ query: { tab: 'package' } })
  if (!pkg) return
  highlightId.value = pkg.id
  if (canBuy.value) choose(pkg)
})
</script>

<style scoped>
.package-page { display: grid; gap: 20px; }
.card { padding: 24px; border: 0; border-radius: var(--pk-radius); background: var(--admin-card); box-shadow: var(--pk-card-shadow); }
.card-head { display: flex; gap: 14px; margin-bottom: 16px; }
.card-icon { display: grid; place-items: center; flex: none; width: 38px; height: 38px; border-radius: 10px; background: var(--admin-soft); color: var(--admin-link); }
.card-head h2 { margin: 0; color: var(--admin-heading); font-size: 17px; font-weight: 700; }
.card-head p { margin: 3px 0 0; color: var(--admin-muted); font-size: 12.5px; }
.status-card .summary { max-width: 420px; }
.text-link { display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; color: var(--admin-link); font-size: 13px; font-weight: 600; }
.rules { display: flex; gap: 12px; padding: 14px 18px; border-radius: 12px; background: var(--admin-accent-soft); color: var(--admin-accent-text); font-size: 13.5px; line-height: 1.6; }
.rules i { margin-top: 4px; }
.rules ul { margin: 0; padding-left: 18px; }
.reason { display: flex; align-items: center; gap: 10px; margin: 0; padding: 14px 18px; border-radius: 12px; background: var(--admin-soft); color: var(--admin-heading); font-size: 14px; font-weight: 600; }
/* Paket seçenekleri (tasarım kataloğu 19) */
.card.options { display: grid; gap: 18px; }
.options-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.options-head h2 { margin: 0; color: var(--admin-heading); font-size: 18px; font-weight: 700; }
.period-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.muted { color: var(--admin-muted); font-size: 13px; }
.packages { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 22px; }
.package { position: relative; display: flex; flex-direction: column; gap: 14px; padding: 24px; border: 1.5px solid transparent; border-radius: var(--pk-radius); background: var(--admin-card); box-shadow: var(--pk-card-shadow); }
.package.current { border-color: var(--pk-accent); box-shadow: 0 0 2px rgba(145, 158, 171, .2), 0 20px 40px -4px rgba(var(--pk-accent-rgb), .16); }
.package.highlight { outline: 2px solid var(--admin-link); outline-offset: 2px; }
.package-head { display: flex; align-items: center; gap: 16px; padding-bottom: 14px; border-bottom: 1px dashed rgba(145, 158, 171, .24); }
.package-icon { flex: none; width: 52px; height: 52px; display: grid; place-items: center; border-radius: 12px; background: var(--admin-accent-soft); color: var(--admin-link); font-size: 22px; }
.package-title { flex: 1; display: grid; gap: 2px; min-width: 0; }
.package h3 { margin: 0; color: var(--admin-heading); font-size: 18px; font-weight: 700; }
.package-title small { color: var(--admin-muted); font-size: 14px; }
.current-tag { align-self: flex-start; padding: 2px 8px; border-radius: 6px; background: var(--admin-accent-soft); color: var(--admin-accent-text); font-size: 12px; font-weight: 700; white-space: nowrap; }
.package ul { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; color: var(--admin-heading); font-size: 14px; }
.package li { display: flex; align-items: center; gap: 12px; }
.package li i { color: var(--admin-success-text); font-size: 15px; font-weight: 700; }
.choose-button { margin-top: auto; display: inline-flex; align-items: center; justify-content: center; gap: 10px; height: 44px; border: 1px solid rgba(145, 158, 171, .32); border-radius: 8px; background: transparent; color: var(--admin-heading); font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
.choose-button:hover { background: rgba(145, 158, 171, .08); }
.locked { margin: auto 0 0; padding: 10px 12px; border-radius: 10px; background: var(--admin-soft); color: var(--admin-muted); font-size: 13px; line-height: 1.5; }
.flow { display: grid; gap: 18px; }
.flow-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.steps { display: flex; gap: 18px; margin: 0; padding: 0; list-style: none; color: var(--admin-muted); font-size: 13px; font-weight: 600; }
.steps li { display: flex; align-items: center; gap: 8px; }
.steps span { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--admin-soft); font-size: 12px; }
.steps li.active { color: var(--admin-heading); }
.steps li.active span { background: var(--pk-accent); color: var(--pk-on-accent); }
.steps li.done span { background: var(--admin-success-bg); color: var(--admin-success-text); }
.chosen-line { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 12px 16px; border-radius: 12px; background: var(--admin-soft); color: var(--admin-text); font-size: 14px; }
.chosen-line strong { color: var(--admin-heading); }
.action-tag { margin-left: auto; padding: 2px 8px; border-radius: 6px; background: var(--admin-accent-soft); color: var(--admin-accent-text); font-size: 12px; font-weight: 700; }
.step-body { display: grid; gap: 14px; max-width: 860px; }
.step-body h3 { margin: 0; color: var(--admin-heading); font-size: 17px; font-weight: 700; }
.explain { margin: 0; color: var(--admin-text); font-size: 14px; line-height: 1.6; }
.sum { display: grid; gap: 8px; margin: 0; padding: 16px 20px; border: 0; border-radius: 12px; background: rgba(145, 158, 171, .08); }
.sum div { display: flex; justify-content: space-between; gap: 12px; color: var(--admin-text); font-size: 14px; }
.sum dd { margin: 0; white-space: nowrap; }
.sum .total { padding-top: 8px; border-top: 1px dashed rgba(145, 158, 171, .24); color: var(--admin-heading); font-size: 16px; font-weight: 700; }
.hint { margin: 0; color: var(--admin-muted); font-size: 13px; line-height: 1.55; }
.check { display: flex; align-items: flex-start; gap: 10px; color: var(--admin-text); font-size: 14px; line-height: 1.55; cursor: pointer; }
.check input { flex: none; width: 19px; height: 19px; margin-top: 2px; accent-color: var(--admin-link); }
.check a { color: var(--admin-link); font-weight: 600; }
.step-actions { display: flex; justify-content: flex-end; gap: 12px; flex-wrap: wrap; }
.paytr { width: 100%; min-height: 420px; border: 0; }
.modal-backdrop { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 20px; background: var(--admin-overlay); }
.modal-card { display: grid; gap: 14px; width: min(720px, 100%); max-height: calc(100vh - 40px); overflow: auto; padding: 24px; background: var(--admin-card); border: 0; border-radius: var(--pk-radius); box-shadow: 0 24px 48px -8px var(--admin-shadow); }
.modal-head { display: flex; justify-content: space-between; gap: 15px; }
.modal-head h2 { margin: 0; color: var(--admin-heading); font-size: 18px; font-weight: 700; }
.modal-head p { margin: 5px 0 0; color: var(--admin-muted); font-size: 12px; }
.close-button { flex: none; width: 34px; height: 34px; display: grid; place-items: center; border: 0; border-radius: 7px; background: transparent; color: var(--admin-muted); cursor: pointer; }
.close-button:hover { background: var(--admin-hover); color: var(--admin-heading); }
.error { margin: 0; color: var(--admin-danger-text); font-size: 13.5px; }
.primary-button, .secondary-button { display: inline-flex; align-items: center; gap: 8px; height: 42px; padding: 0 20px; border-radius: 8px; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
.primary-button { border: 0; background: var(--pk-accent); color: var(--pk-on-accent); box-shadow: 0 8px 16px rgba(var(--pk-accent-rgb), .24); }
.primary-button:hover:not(:disabled) { background: var(--pk-accent-hover); }
.secondary-button { border: 1px solid rgba(145, 158, 171, .32); background: transparent; color: var(--admin-heading); }
.secondary-button:hover:not(:disabled) { background: rgba(145, 158, 171, .08); }
.primary-button:disabled, .secondary-button:disabled { opacity: .55; cursor: not-allowed; box-shadow: none; }
.text-button { display: inline-flex; align-items: center; gap: 8px; padding: 0; border: 0; background: none; color: var(--admin-link); font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; }
.state { padding: 30px; border: 0; border-radius: var(--pk-radius); background: var(--admin-card); box-shadow: var(--pk-card-shadow); color: var(--admin-muted); }
.state.error { color: var(--admin-danger-text); }
@media (max-width: 640px) { .steps { gap: 10px; font-size: 12px; } .action-tag { margin-left: 0; } }
</style>
