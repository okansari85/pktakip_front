<template>
  <main class="set-password-page">
    <section class="set-password-card">
      <img src="/pktakip-logo.svg" alt="PKTakip" class="logo" />
      <h1>Hesabınızı Aktifleştirin</h1>
      <p class="intro">PKTakip hesabınız için giriş şifrenizi belirleyin.</p>

      <form @submit.prevent="submit">
        <div class="field">
          <label for="password">Yeni Şifre</label>
          <Password id="password" v-model="password" :feedback="true" toggleMask placeholder="En az 8 karakter" fluid autocomplete="new-password" />
        </div>

        <div class="field">
          <label for="password_confirmation">Yeni Şifre Tekrar</label>
          <Password id="password_confirmation" v-model="passwordConfirmation" :feedback="false" toggleMask placeholder="Şifrenizi tekrar girin" fluid autocomplete="new-password" />
        </div>

        <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
        <Message v-if="success" severity="success" :closable="false">{{ success }}</Message>

        <Button type="submit" label="Şifremi Oluştur" icon="pi pi-check" class="pk-primary" :loading="loading" fluid :disabled="!token || !email || !!success" />
      </form>

      <NuxtLink to="/login" class="login-link">Giriş ekranına dön</NuxtLink>
    </section>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const config = useRuntimeConfig()
const password = ref('')
const passwordConfirmation = ref('')
const error = ref('')
const success = ref('')
const loading = ref(false)

const token = computed(() => String(route.query.token || ''))
const email = computed(() => String(route.query.email || ''))

const submit = async () => {
  error.value = ''
  if (!token.value || !email.value) {
    error.value = 'Geçersiz davet bağlantısı.'
    return
  }
  if (password.value.length < 8) {
    error.value = 'Şifreniz en az 8 karakter olmalıdır.'
    return
  }
  if (password.value !== passwordConfirmation.value) {
    error.value = 'Şifreler eşleşmiyor.'
    return
  }

  loading.value = true
  try {
    const response = await $fetch<{ message: string }>(`${config.public.apiBaseUrl}/experts/set-password`, {
      method: 'POST',
      body: {
        email: email.value,
        token: token.value,
        password: password.value,
        password_confirmation: passwordConfirmation.value,
      },
    })
    success.value = response.message
  } catch (e: any) {
    error.value = e?.data?.message || e?.data?.errors?.token?.[0] || 'Şifre oluşturulamadı.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.set-password-page { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #f8fafc; }
.set-password-card { width: min(460px, 100%); padding: 38px; border: 1px solid #e5e7eb; border-radius: 16px; background: #fff; box-shadow: 0 20px 50px rgba(15,23,42,.08); }
.logo { display: block; width: 190px; margin: 0 auto 34px; }
h1 { margin: 0; color: #111827; font-size: 27px; letter-spacing: -.5px; }
.intro { margin: 8px 0 28px; color: #64748b; font-size: 13px; }
.field { margin-bottom: 18px; }
.field label { display: block; margin-bottom: 7px; color: #111827; font-size: 12px; font-weight: 700; }
.login-link { display: block; margin-top: 22px; text-align: center; color: #b57b00; font-size: 13px; }
</style>
