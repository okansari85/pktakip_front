<template>
  <main class="login-page">
    <section class="login-brand">
      <img src="/pktakip-logo-dark.svg" alt="PKTakip - Periyodik Kontrol Takip" class="brand-logo" />
      <div class="brand-line"></div>
      <h2>Periyodik Kontrol Takip</h2>
      <p>Periyodik kontrollerinizi tek merkezden yönetin.</p>
    </section>

    <section class="login-panel">
      <div class="login-card">
        <img src="/pktakip-logo.svg" alt="PKTakip" class="mobile-logo" />
        <h1>Hoş geldiniz</h1>
        <p class="intro">Yönetim paneline giriş yapmak için bilgilerinizi girin.</p>

        <form @submit.prevent="submit">
          <div class="field">
            <label for="email">E-posta</label>
            <InputText id="email" v-model="email" type="email" placeholder="ornek@firma.com" autocomplete="email" fluid />
          </div>
          <div class="field">
            <label for="password">Şifre</label>
            <Password id="password" v-model="password" :feedback="false" toggleMask placeholder="Şifrenizi girin" autocomplete="current-password" fluid />
          </div>
          <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
          <Button type="submit" label="Giriş Yap" icon="pi pi-arrow-right" iconPos="right" class="login-button" :loading="loading" fluid />
        </form>

        <div class="login-footer">PKTakip Yönetim Paneli</div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const { login } = useAuth()

const submit = async () => {
  error.value = ''
  loading.value = true
  try {
    await login(email.value, password.value)
    await navigateTo('/customers')
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Giriş yapılamadı.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page{min-height:100vh;display:grid;grid-template-columns:1.05fr .95fr;background:#fff}.login-brand{position:relative;display:flex;flex-direction:column;justify-content:center;padding:80px 10%;background:#111827;color:#fff;overflow:hidden}.login-brand:before{content:"";position:absolute;width:560px;height:560px;border-radius:50%;background:#ffc107;right:-270px;bottom:-300px;opacity:.10}.brand-logo{position:relative;width:min(390px,100%);height:auto;margin-bottom:34px}.brand-line{position:relative;width:54px;height:4px;background:#ffc107;margin-bottom:18px;border-radius:4px}.login-brand h2{position:relative;margin:0 0 8px;color:#fff;font-size:24px;font-weight:700}.login-brand p{position:relative;max-width:390px;color:#d1d5db;line-height:1.7;margin:0;font-size:15px}.login-panel{display:flex;align-items:center;justify-content:center;padding:40px;background:#f8fafc}.login-card{width:min(410px,100%);background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:42px;box-shadow:0 12px 35px rgba(15,23,42,.06)}.mobile-logo{display:none;width:230px;height:auto;margin:0 auto 28px}.login-card h1{margin:0;color:#111827;font-size:29px;letter-spacing:-.7px}.intro{margin:8px 0 30px;color:#64748b;font-size:14px;line-height:1.5}.field{margin-bottom:20px}.field label{display:block;color:#111827;font-size:13px;font-weight:600;margin-bottom:8px}.login-button{margin-top:8px;background:#ffc107;border-color:#ffc107;color:#111827;font-weight:700;height:44px}.login-button:hover{background:#e6a900;border-color:#e6a900;color:#111827}.login-footer{text-align:center;color:#94a3b8;font-size:11px;margin-top:28px}@media(max-width:800px){.login-page{grid-template-columns:1fr}.login-brand{display:none}.login-panel{min-height:100vh;padding:22px}.login-card{padding:32px 26px}.mobile-logo{display:block}}
</style>
