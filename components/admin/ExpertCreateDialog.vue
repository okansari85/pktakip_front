<template>
  <Dialog v-model:visible="visible" modal header="Yeni Uzman Ekle" :style="{ width: '520px' }" :closable="!saving">
    <p class="dialog-intro">Uzman hesabını oluşturun. Davet e-postası gönderilecek ve kullanıcı kendi şifresini belirleyecek.</p>

    <div class="field">
      <label for="expert-name">Uzman / Firma Adı</label>
      <InputText id="expert-name" v-model="form.expert_name" placeholder="Örn. Ahmet Yılmaz İSG" fluid :disabled="saving" />
    </div>

    <div class="field">
      <label for="contact-name">Yetkili Ad Soyad</label>
      <InputText id="contact-name" v-model="form.contact_name" placeholder="Örn. Ahmet Yılmaz" fluid :disabled="saving" />
    </div>

    <div class="field">
      <label for="expert-email">E-posta</label>
      <InputText id="expert-email" v-model="form.email" type="email" placeholder="uzman@example.com" fluid :disabled="saving" />
    </div>

    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

    <template #footer>
      <Button label="Vazgeç" text :disabled="saving" @click="visible = false" />
      <Button label="Uzmanı Oluştur" icon="pi pi-check" class="pk-primary" :loading="saving" @click="submit" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; created: [data: any] }>()

const config = useRuntimeConfig()
const { authHeaders } = useAuth()
const saving = ref(false)
const error = ref('')
const form = reactive({ expert_name: '', contact_name: '', email: '' })

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

watch(() => props.modelValue, (open) => {
  if (open) {
    error.value = ''
    form.expert_name = ''
    form.contact_name = ''
    form.email = ''
  }
})

const submit = async () => {
  error.value = ''
  if (!form.expert_name || !form.contact_name || !form.email) {
    error.value = 'Lütfen tüm alanları doldurun.'
    return
  }

  saving.value = true
  try {
    const response = await $fetch(`${config.public.apiBaseUrl}/experts`, {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    })
    emit('created', response)
    visible.value = false
  } catch (e: any) {
    error.value = e?.data?.message || e?.data?.errors?.email?.[0] || 'Uzman oluşturulamadı.'
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
