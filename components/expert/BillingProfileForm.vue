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
        <div v-else><dt>TC kimlik no</dt><dd>{{ profile.tckn }}</dd></div>
        <div><dt>Telefon</dt><dd>{{ profile.phone }}</dd></div>
        <div><dt>Adres</dt><dd>{{ profile.address }}</dd></div>
        <div><dt>Fatura adresi</dt><dd>{{ profile.billing_address === profile.address ? 'Adresle aynı' : profile.billing_address }}</dd></div>
      </dl>
      <button class="secondary-button" type="button" @click="startEdit"><i class="pi pi-pencil" /> Değiştir</button>
    </div>

    <form v-else class="form" novalidate @submit.prevent="save">
      <p class="hint">Faturanız bu bilgilerle kesilir. Bireysel faturada TC kimlik numaranız, kurumsal faturada şirketinizin vergi bilgileri gerekir.</p>
      <div class="field">
        <span class="label">Fatura türü</span>
        <div class="segments" role="radiogroup" aria-label="Fatura türü">
          <label :class="{ on: form.invoice_type === 'bireysel' }"><input v-model="form.invoice_type" type="radio" value="bireysel" /> Bireysel (şahıs)</label>
          <label :class="{ on: form.invoice_type === 'kurumsal' }"><input v-model="form.invoice_type" type="radio" value="kurumsal" /> Kurumsal (şirket)</label>
        </div>
      </div>

      <div class="field">
        <label :for="`${uid}-name`">{{ form.invoice_type === 'kurumsal' ? 'Şirket unvanı' : 'Ad soyad' }} <span class="req">*</span></label>
        <div>
          <input :id="`${uid}-name`" v-model="form.name" maxlength="255" :placeholder="form.invoice_type === 'kurumsal' ? 'Örn. Örnek Mühendislik Ltd. Şti.' : 'Faturadaki ad ve soyad'" />
          <small v-if="errors.name" class="error">{{ errors.name }}</small>
        </div>
      </div>
      <template v-if="form.invoice_type === 'bireysel'">
        <div class="field">
          <label :for="`${uid}-tckn`">TC kimlik no <span class="req">*</span></label>
          <div>
            <input :id="`${uid}-tckn`" v-model="form.tckn" maxlength="11" inputmode="numeric" placeholder="11 haneli" />
            <small v-if="errors.tckn" class="error">{{ errors.tckn }}</small>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="field">
          <label :for="`${uid}-taxno`">Vergi no <span class="req">*</span></label>
          <div>
            <input :id="`${uid}-taxno`" v-model="form.tax_number" maxlength="11" inputmode="numeric" placeholder="10 haneli" />
            <small v-if="errors.tax_number" class="error">{{ errors.tax_number }}</small>
          </div>
        </div>
        <div class="field">
          <label :for="`${uid}-taxoffice`">Vergi dairesi <span class="req">*</span></label>
          <div>
            <input :id="`${uid}-taxoffice`" v-model="form.tax_office" maxlength="150" placeholder="Örn. Kadıköy" />
            <small v-if="errors.tax_office" class="error">{{ errors.tax_office }}</small>
          </div>
        </div>
      </template>
      <div class="field">
        <label :for="`${uid}-phone`">Telefon <span class="req">*</span></label>
        <div>
          <input :id="`${uid}-phone`" v-model="form.phone" maxlength="30" inputmode="tel" placeholder="05xx xxx xx xx" />
          <small v-if="errors.phone" class="error">{{ errors.phone }}</small>
        </div>
      </div>
      <div class="field">
        <label :for="`${uid}-address`">Adres <span class="req">*</span></label>
        <div>
          <textarea :id="`${uid}-address`" v-model="form.address" rows="2" maxlength="500" placeholder="Mahalle, sokak, no, ilçe / il" />
          <small v-if="errors.address" class="error">{{ errors.address }}</small>
        </div>
      </div>
      <div class="field">
        <span />
        <label class="check"><input v-model="sameAddress" type="checkbox" /> Fatura adresi adresle aynı</label>
      </div>
      <div v-if="!sameAddress" class="field">
        <label :for="`${uid}-billing`">Fatura adresi <span class="req">*</span></label>
        <div>
          <textarea :id="`${uid}-billing`" v-model="form.billing_address" rows="2" maxlength="500" placeholder="Faturanın gönderileceği adres" />
          <small v-if="errors.billing_address" class="error">{{ errors.billing_address }}</small>
        </div>
      </div>

      <div class="actions">
        <span v-if="saveError" class="error" role="alert">{{ saveError }}</span>
        <button v-if="profile" class="secondary-button" type="button" :disabled="saving" @click="editing = false">Vazgeç</button>
        <button class="primary-button" type="submit" :disabled="saving"><i class="pi pi-save" /> {{ saving ? 'Kaydediliyor...' : 'Fatura bilgilerini kaydet' }}</button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
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

const load = async () => {
  loading.value = true
  loadError.value = ''
  try {
    profile.value = await get<BillingProfile | null>('/pk-billing/profile') || null
    if (!profile.value) startEdit()
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
.summary { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.summary dl { display: grid; gap: 8px; margin: 0; }
.summary dl div { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 12px; font-size: 13.5px; }
.summary dt { color: var(--admin-muted); }
.summary dd { margin: 0; color: var(--admin-heading); font-weight: 600; white-space: pre-line; }
.hint { margin: 0 0 6px; color: var(--admin-muted); font-size: 13px; line-height: 1.5; }
.form { display: grid; gap: 12px; }
.field { display: grid; grid-template-columns: 180px minmax(0, 1fr); align-items: start; gap: 12px; min-width: 0; }
.field > label, .field > .label { padding-top: 10px; color: var(--admin-heading); font-size: 13.5px; font-weight: 600; }
.segments { justify-self: start; }
.field input:not([type=checkbox]):not([type=radio]), .field textarea { box-sizing: border-box; width: 100%; min-height: 40px; padding: 9px 14px; border: 1px solid var(--admin-border); border-radius: 10px; background: var(--admin-input); color: var(--admin-text); font: inherit; font-size: 14px; resize: vertical; }
.field input:focus, .field textarea:focus { outline: 2px solid var(--admin-link); outline-offset: 0; }
.field small { display: block; margin-top: 4px; font-size: 12px; }
.segments { display: inline-flex; gap: 4px; padding: 4px; border: 1px solid var(--admin-border); border-radius: 10px; background: var(--admin-soft); }
.segments label { display: flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 14px; border-radius: 7px; color: var(--admin-muted); font-size: 13px; font-weight: 700; cursor: pointer; }
.segments label.on { background: var(--admin-card); color: var(--admin-heading); box-shadow: 0 1px 2px rgba(15, 23, 42, .12); }
.segments input { accent-color: var(--admin-link); }
.check { display: flex; align-items: center; gap: 8px; color: var(--admin-text); font-size: 13.5px; cursor: pointer; }
.check input { width: 18px; height: 18px; accent-color: var(--admin-link); }
.req { color: var(--admin-danger-text); }
.actions { display: flex; align-items: center; justify-content: flex-end; gap: 12px; flex-wrap: wrap; font-size: 13.5px; }
.primary-button, .secondary-button { display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 18px; border-radius: 10px; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
.primary-button { border: 0; background: var(--pk-yellow); color: #1b1b1b; }
.secondary-button { flex: none; border: 1px solid var(--admin-border); background: var(--admin-card); color: var(--admin-text); font-weight: 600; }
.primary-button:disabled, .secondary-button:disabled { opacity: .55; cursor: not-allowed; }
@media (max-width: 640px) {
  .field, .summary dl div { grid-template-columns: 1fr; gap: 6px; }
  .field > label, .field > .label { padding-top: 0; }
  .summary { flex-direction: column; }
}
</style>
