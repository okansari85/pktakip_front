<template>
  <Dialog v-model:visible="visible" modal header="Yeni Müşteri" :style="{ width: '540px' }" :closable="!saving">
    <div class="field">
      <label>Müşteri tipi</label>
      <SelectButton v-model="form.type" :options="TYPE_OPTIONS" option-label="label" option-value="value" :allow-empty="false" :disabled="saving" />
    </div>

    <p class="dialog-intro">{{ current.intro }}</p>

    <div class="field">
      <label for="account-name">{{ current.nameLabel }}</label>
      <InputText id="account-name" v-model="form.name" :placeholder="current.namePlaceholder" fluid :disabled="saving" />
    </div>

    <div class="field">
      <label for="contact-name">{{ current.contactLabel }}</label>
      <InputText id="contact-name" v-model="form.contact_name" :placeholder="current.contactPlaceholder" fluid :disabled="saving" />
    </div>

    <div class="field">
      <label for="account-email">E-posta</label>
      <InputText id="account-email" v-model="form.email" type="email" :placeholder="current.emailPlaceholder" fluid :disabled="saving" />
    </div>

    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

    <template #footer>
      <Button label="Vazgeç" text :disabled="saving" @click="visible = false" />
      <Button :label="current.submit" icon="pi pi-check" class="pk-primary" :loading="saving" @click="submit" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
// Süper admin: yeni müşteri hesabı. Uzman: bugünkü uzman açılışı (/experts, uzman daveti) aynen. OSGB / kurumsal:
// /pk-accounts; açılan kullanıcı hesabın yöneticisi olur, kurumsalda firma, kamuda kurum tek müşteri olarak eklenir.
type AccountType = 'expert' | 'osgb' | 'corporate' | 'public'

const TYPE_OPTIONS: { label: string; value: AccountType }[] = [
  { label: 'Uzman', value: 'expert' },
  { label: 'OSGB', value: 'osgb' },
  { label: 'Kurumsal', value: 'corporate' },
  { label: 'Kamu Kurumu', value: 'public' }
]
const TEXTS: Record<AccountType, { intro: string; nameLabel: string; namePlaceholder: string; contactLabel: string; contactPlaceholder: string; emailPlaceholder: string; submit: string }> = {
  expert: {
    intro: 'Uzman hesabını oluşturun. Davet e-postası gönderilecek ve kullanıcı kendi şifresini belirleyecek.',
    nameLabel: 'Uzman / Firma Adı', namePlaceholder: 'Örn. Ahmet Yılmaz İSG',
    contactLabel: 'Yetkili Ad Soyad', contactPlaceholder: 'Örn. Ahmet Yılmaz',
    emailPlaceholder: 'uzman@example.com', submit: 'Uzmanı Oluştur'
  },
  osgb: {
    intro: 'OSGB hesabını oluşturun. Sorumlu müdür hesabın yöneticisi olur; davet e-postasıyla kendi şifresini belirler.',
    nameLabel: 'OSGB Adı', namePlaceholder: 'Örn. Güven OSGB',
    contactLabel: 'Sorumlu Müdür Ad Soyad', contactPlaceholder: 'Örn. Ayşe Demir',
    emailPlaceholder: 'mudur@osgb.com', submit: 'OSGB Hesabını Oluştur'
  },
  corporate: {
    intro: 'Kurumsal firma hesabını oluşturun. Firma, hesabın tek müşterisi olarak eklenir. Yönetici (müşteri admini) davet e-postasıyla kendi şifresini belirler.',
    nameLabel: 'Firma Adı', namePlaceholder: 'Örn. ABC Holding',
    contactLabel: 'Yönetici (Müşteri Admini) Ad Soyad', contactPlaceholder: 'Örn. Mehmet Kaya',
    emailPlaceholder: 'isg@firma.com', submit: 'Kurumsal Hesabı Oluştur'
  },
  public: {
    intro: 'Kamu kurumu hesabını oluşturun. Kurum, hesabın tek müşterisi olarak eklenir; daire başkanlıkları ve birimler organizasyon, binalar lokasyon olarak girilir. Yönetici davet e-postasıyla kendi şifresini belirler.',
    nameLabel: 'Kurum Adı', namePlaceholder: 'Örn. Büyükşehir Belediyesi',
    contactLabel: 'Yönetici Ad Soyad', contactPlaceholder: 'Örn. İSG birim sorumlusu',
    emailPlaceholder: 'isg@kurum.gov.tr', submit: 'Kamu Hesabını Oluştur'
  }
}

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; created: [data: any] }>()

const config = useRuntimeConfig()
const { authHeaders } = useAuth()
const saving = ref(false)
const error = ref('')
const form = reactive({ type: 'expert' as AccountType, name: '', contact_name: '', email: '' })
const current = computed(() => TEXTS[form.type])

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

watch(() => props.modelValue, (open) => {
  if (open) {
    error.value = ''
    form.type = 'expert'
    form.name = ''
    form.contact_name = ''
    form.email = ''
  }
})

const submit = async () => {
  error.value = ''
  if (!form.name || !form.contact_name || !form.email) {
    error.value = 'Lütfen tüm alanları doldurun.'
    return
  }

  saving.value = true
  try {
    // Uzman: bugünkü uzman açılışı; OSGB / kurumsal / kamu: PKTakip hesabı.
    const response = form.type === 'expert'
      ? await $fetch(`${config.public.apiBaseUrl}/experts`, { method: 'POST', headers: authHeaders(), body: { expert_name: form.name, contact_name: form.contact_name, email: form.email } })
      : await $fetch(`${config.public.apiBaseUrl}/pk-accounts`, { method: 'POST', headers: authHeaders(), body: { type: form.type, account_name: form.name, contact_name: form.contact_name, email: form.email } })
    emit('created', response)
    visible.value = false
  } catch (e: any) {
    error.value = e?.data?.message || e?.data?.errors?.email?.[0] || 'Hesap oluşturulamadı.'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.dialog-intro { margin: 0 0 22px; color: var(--admin-muted); font-size: 13px; line-height: 1.55; }
.field { margin-bottom: 18px; }
.field label { display: block; margin-bottom: 7px; color: var(--admin-heading); font-size: 12px; font-weight: 700; }
</style>
