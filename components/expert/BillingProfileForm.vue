<template>
  <!-- Fatura bilgileri (Paketim satın alma 1. adım ve Hesabım ortak). Yalnız ödeme yapabilen kişi görür; diğerine backend 403. -->
  <div class="billing-profile">
    <div v-if="loading" class="state">Fatura bilgileri yükleniyor...</div>
    <div v-else-if="loadError" class="state error">{{ loadError }} <button class="secondary-button" type="button" @click="load">Tekrar Dene</button></div>

    <div v-else-if="profile && !editing" class="summary">
      <dl>
        <div><dt>Fatura türü</dt><dd>{{ profile.invoice_type === 'kurumsal' ? 'Kurumsal (şirket)' : 'Bireysel (şahıs)' }}</dd></div>
        <div><dt>{{ profile.invoice_type === 'kurumsal' ? 'Unvan' : 'Ad soyad' }}</dt><dd>{{ profile.name }}</dd></div>
        <div v-if="profile.invoice_type === 'kurumsal'"><dt>Vergi no / dairesi</dt><dd>{{ profile.tax_number }} · {{ profile.tax_office }}</dd></div>
        <div v-else><dt>T.C. kimlik no</dt><dd>{{ profile.tckn }}</dd></div>
        <div><dt>Telefon</dt><dd>{{ profile.phone }}</dd></div>
        <div><dt>Adres</dt><dd>{{ profile.address }}</dd></div>
        <div><dt>Fatura adresi</dt><dd>{{ profile.billing_address === profile.address ? 'Adresle aynı' : profile.billing_address }}</dd></div>
      </dl>
      <button class="secondary-button" type="button" @click="startEdit"><PkIcon class="pi pi-pencil" /> Değiştir</button>
    </div>

    <!-- Tasarım kataloğu 18: Bireysel / Kurumsal seçimi, iki sütunlu alanlar, adres tam genişlik -->
    <form v-else class="form" novalidate @submit.prevent="save">
      <p v-if="!inline" class="hint">Faturanız bu bilgilerle kesilir. Bireysel faturada TC kimlik numaranız, kurumsal faturada şirketinizin vergi bilgileri gerekir.</p>
      <div class="segments" role="radiogroup" aria-label="Fatura türü">
        <label :class="{ on: form.invoice_type === 'bireysel' }" title="Bireysel (şahıs)"><input v-model="form.invoice_type" type="radio" value="bireysel" class="sr-only" /><PkIcon class="pi pi-user" /> Bireysel</label>
        <label :class="{ on: form.invoice_type === 'kurumsal' }" title="Kurumsal (şirket)"><input v-model="form.invoice_type" type="radio" value="kurumsal" class="sr-only" /><PkIcon class="pi pi-building" /> Kurumsal</label>
      </div>

      <div class="grid">
        <div class="field">
          <label :for="`${uid}-name`">{{ form.invoice_type === 'kurumsal' ? 'Şirket unvanı' : 'Ad soyad' }} <span class="req">*</span></label>
          <input :id="`${uid}-name`" v-model="form.name" maxlength="255" :placeholder="form.invoice_type === 'kurumsal' ? 'Örn. Örnek Mühendislik Ltd. Şti.' : 'Faturadaki ad ve soyad'" />
          <small v-if="errors.name" class="error">{{ errors.name }}</small>
        </div>
        <div v-if="form.invoice_type === 'bireysel'" class="field">
          <label :for="`${uid}-tckn`">T.C. kimlik no <span class="req">*</span></label>
          <input :id="`${uid}-tckn`" v-model="form.tckn" maxlength="11" inputmode="numeric" placeholder="11 haneli" />
          <small v-if="errors.tckn" class="error">{{ errors.tckn }}</small>
        </div>
        <template v-else>
          <div class="field">
            <label :for="`${uid}-taxno`">Vergi no <span class="req">*</span></label>
            <input :id="`${uid}-taxno`" v-model="form.tax_number" maxlength="11" inputmode="numeric" placeholder="10 haneli" />
            <small v-if="errors.tax_number" class="error">{{ errors.tax_number }}</small>
          </div>
          <div class="field">
            <label :for="`${uid}-taxoffice`">Vergi dairesi <span class="req">*</span></label>
            <input :id="`${uid}-taxoffice`" v-model="form.tax_office" maxlength="150" placeholder="Örn. Kadıköy" />
            <small v-if="errors.tax_office" class="error">{{ errors.tax_office }}</small>
          </div>
        </template>
        <div class="field">
          <label :for="`${uid}-phone`">Telefon <span class="req">*</span></label>
          <input :id="`${uid}-phone`" v-model="form.phone" maxlength="30" inputmode="tel" placeholder="05xx xxx xx xx" />
          <small v-if="errors.phone" class="error">{{ errors.phone }}</small>
        </div>
        <div class="field full">
          <label :for="`${uid}-address`">Adres <span class="req">*</span></label>
          <textarea :id="`${uid}-address`" v-model="form.address" rows="3" maxlength="500" placeholder="Mahalle, sokak, no, ilçe / il" />
          <small v-if="errors.address" class="error">{{ errors.address }}</small>
        </div>
        <label class="check full"><input v-model="sameAddress" type="checkbox" /> Fatura adresi adresle aynı</label>
        <div v-if="!sameAddress" class="field full">
          <label :for="`${uid}-billing`">Fatura adresi <span class="req">*</span></label>
          <textarea :id="`${uid}-billing`" v-model="form.billing_address" rows="3" maxlength="500" placeholder="Faturanın gönderileceği adres" />
          <small v-if="errors.billing_address" class="error">{{ errors.billing_address }}</small>
        </div>
      </div>

      <div class="actions">
        <button class="primary-button" type="submit" :disabled="saving"><PkIcon class="pi pi-save" /> {{ saving ? 'Kaydediliyor...' : 'Bilgileri kaydet' }}</button>
        <button v-if="profile" class="secondary-button" type="button" :disabled="saving" @click="cancel">Vazgeç</button>
        <span v-if="saveError" class="error" role="alert">{{ saveError }}</span>
        <span v-else-if="savedOk" class="ok" role="status"><PkIcon class="pi pi-check" /> Fatura bilgileri kaydedildi.</span>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
// inline: Hesabım'da kayıtlı bilgiler özet yerine doğrudan formda açılır; kayıttan sonra form açık kalır, Vazgeç kayıtlı
// bilgilere döner. Paketim satın alma adımında (inline yok) eskisi gibi özet + Değiştir.
const props = withDefaults(defineProps<{ inline?: boolean }>(), { inline: false })
const emit = defineEmits<{ forbidden: [] }>()
// profile: kayıtlı fatura bilgisi (yoksa null); editing: form açık mı (Paketim, form açıkken "Devam"ı kapatır).
const profile = defineModel<BillingProfile | null>('profile', { default: null })
const editing = defineModel<boolean>('editing', { default: false })

const uid = useId()
const { get, put, errorMessage } = useExpertApi()
const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const saveError = ref('')
const savedOk = ref(false)
const errors = ref<Record<string, string>>({})
const sameAddress = ref(true)
const form = reactive({ invoice_type: 'bireysel' as BillingProfile['invoice_type'], name: '', tckn: '', tax_number: '', tax_office: '', phone: '', address: '', billing_address: '' })

const startEdit = () => {
  const p = profile.value
  Object.assign(form, { invoice_type: p?.invoice_type ?? 'bireysel', name: p?.name ?? '', tckn: p?.tckn ?? '', tax_number: p?.tax_number ?? '', tax_office: p?.tax_office ?? '', phone: p?.phone ?? '', address: p?.address ?? '', billing_address: p?.billing_address ?? '' })
  sameAddress.value = !p || p.billing_address === p.address
  errors.value = {}
  saveError.value = ''
  editing.value = true
}
const cancel = () => { savedOk.value = false; if (props.inline) startEdit(); else editing.value = false }
watch(form, () => { savedOk.value = false })

const load = async () => {
  loading.value = true
  loadError.value = ''
  try {
    profile.value = await get<BillingProfile | null>('/pk-billing/profile') || null
    if (!profile.value || props.inline) startEdit()
  } catch (e: any) {
    if (e?.status === 403) return emit('forbidden')
    loadError.value = errorMessage(e, 'Fatura bilgileri alınamadı.')
  } finally { loading.value = false }
}

const save = async () => {
  const kurumsal = form.invoice_type === 'kurumsal'
  const body = {
    invoice_type: form.invoice_type,
    name: form.name.trim(),
    tckn: kurumsal ? null : form.tckn.trim(),
    tax_number: kurumsal ? form.tax_number.trim() : null,
    tax_office: kurumsal ? form.tax_office.trim() : null,
    phone: form.phone.trim(),
    address: form.address.trim(),
    billing_address: (sameAddress.value ? form.address : form.billing_address).trim()
  }
  saving.value = true
  saveError.value = ''
  errors.value = {}
  try {
    const saved = await put<BillingProfile | null>('/pk-billing/profile', body)
    profile.value = saved?.invoice_type ? saved : body
    editing.value = false
    if (props.inline) {
      startEdit()
      await nextTick()
      savedOk.value = true
    }
  } catch (e: any) {
    const list = e?.data?.errors as Record<string, string[]> | undefined
    if (list) errors.value = Object.fromEntries(Object.entries(list).map(([k, v]) => [k, v[0]]))
    // Alanı formda olmayan hata (ör. invoice_type) ya da genel hata alttaki satırda.
    saveError.value = list && Object.keys(list).every(k => k in form && k !== 'invoice_type') ? 'Kırmızı alanları düzeltin.' : errorMessage(e, 'Fatura bilgileri kaydedilemedi.')
  } finally { saving.value = false }
}

onMounted(load)
</script>

<style scoped>
.state { padding: 16px; border-radius: 12px; background: var(--admin-soft); color: var(--admin-muted); font-size: 13.5px; }
.state.error, .error { color: var(--admin-danger-text); }
.ok { color: var(--admin-success-text); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.summary { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.summary dl { display: grid; gap: 8px; margin: 0; }
.summary dl div { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 12px; font-size: 13.5px; }
.summary dt { color: var(--admin-muted); }
.summary dd { margin: 0; color: var(--admin-heading); font-weight: 600; white-space: pre-line; }
.hint { margin: 0; color: var(--admin-muted); font-size: 13px; line-height: 1.5; }
.form { display: grid; gap: 18px; }
/* Bireysel / Kurumsal: hap düğmeler, seçili mavi */
.segments { justify-self: start; display: inline-flex; gap: 4px; padding: 5px; border: 1px solid var(--admin-border); border-radius: 14px; background: var(--admin-soft); }
.segments label { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-width: 190px; min-height: 44px; padding: 0 20px; border-radius: 10px; color: var(--admin-heading); font-size: 16px; font-weight: 600; cursor: pointer; }
.segments label:hover { background: var(--admin-hover); }
.segments label.on { background: var(--pk-accent); color: var(--pk-on-accent); }
.segments label:focus-within { box-shadow: 0 0 0 3px var(--pk-focus-ring); }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 28px; }
.field { display: grid; gap: 7px; min-width: 0; align-content: start; }
.field.full, .check.full { grid-column: 1 / -1; }
.field > label { color: var(--admin-heading); font-size: 15px; font-weight: 700; }
.field input, .field textarea { box-sizing: border-box; width: 100%; min-height: 46px; padding: 11px 16px; border: 1px solid rgba(145, 158, 171, .32); border-radius: 8px; background: var(--admin-input); color: var(--admin-heading); font: inherit; font-size: 15.5px; resize: vertical; }
.field input:focus, .field textarea:focus { outline: 0; border-color: var(--pk-accent); box-shadow: 0 0 0 3px var(--pk-focus-ring); }
.field small { display: block; font-size: 12px; }
.check { display: flex; align-items: center; gap: 12px; color: var(--admin-text); font-size: 15px; cursor: pointer; }
.check input { width: 22px; height: 22px; accent-color: var(--pk-accent); }
.req { color: var(--admin-danger-text); }
.actions { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; font-size: 13.5px; }
.primary-button, .secondary-button { display: inline-flex; align-items: center; justify-content: center; gap: 10px; height: 48px; padding: 0 24px; border-radius: 8px; font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; }
.primary-button { min-width: 230px; border: 0; background: var(--pk-accent); color: var(--pk-on-accent); box-shadow: 0 8px 16px rgba(var(--pk-accent-rgb), .24); }
.primary-button:hover { background: var(--pk-accent-hover); }
.secondary-button { flex: none; min-width: 120px; border: 1px solid rgba(145, 158, 171, .32); background: transparent; color: var(--admin-heading); }
.secondary-button:hover { background: rgba(145, 158, 171, .08); }
.summary .secondary-button, .state .secondary-button { height: 40px; min-width: 0; font-size: 14px; }
.primary-button:disabled, .secondary-button:disabled { opacity: .55; cursor: not-allowed; box-shadow: none; }
@media (max-width: 640px) {
  .grid, .summary dl div { grid-template-columns: 1fr; gap: 12px; }
  .segments { justify-self: stretch; } .segments label { min-width: 0; flex: 1; }
  .summary { flex-direction: column; }
}
</style>
