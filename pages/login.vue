<template>
  <main class="login-page">
    <section class="hero-panel">
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <img src="/pktakip-logo-dark.svg" alt="PKTakip - Periyodik Kontrol Takip" class="hero-logo" />
        <div class="hero-copy">
          <h2>Güvenli<br />Kontrol,<br /><span>Sürdürülebilir<br />Yarınlar.</span></h2>
          <div class="hero-line"></div>
          <p>Periyodik kontrollerinizi dijital<br />olarak yönetin, güvenli bir gelecek<br />için bugün adım atın.</p>
        </div>
        <div class="hero-features">
          <div class="feature"><i class="pi pi-shield"></i><span>Güvenli<br />Veri Yönetimi</span></div>
          <div class="feature"><i class="pi pi-file-edit"></i><span>Dijital<br />Süreçler</span></div>
          <div class="feature"><i class="pi pi-chart-bar"></i><span>Daha Verimli<br />Operasyonlar</span></div>
        </div>
      </div>
    </section>
    <section class="form-panel">
      <div class="login-card">
        <img src="/pktakip-logo.svg" alt="PKTakip - Periyodik Kontrol Takip" class="form-logo" />
        <h1>Sisteme Giriş Yapın</h1>
        <p class="intro">Hesabınızla giriş yaparak devam edin.</p>
        <form @submit.prevent="submit">
          <div class="field"><label for="email">E-posta</label><div class="input-wrap"><i class="pi pi-envelope"></i><InputText id="email" v-model="email" type="email" placeholder="E-posta adresiniz" autocomplete="email" fluid /></div></div>
          <div class="field"><label for="password">Şifre</label><div class="input-wrap"><i class="pi pi-lock"></i><Password id="password" v-model="password" :feedback="false" toggleMask placeholder="Şifreniz" autocomplete="current-password" fluid /></div></div>
          <div class="form-options"><label class="remember"><Checkbox v-model="remember" :binary="true" /><span>Beni hatırla</span></label><a href="#" @click.prevent>Şifremi unuttum?</a></div>
          <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
          <Button type="submit" label="Giriş Yap" icon="pi pi-arrow-right" iconPos="right" class="login-button" :loading="loading" fluid />
        </form>
        <div class="divider"><span></span><b>veya</b><span></span></div>
        <div class="security-box"><i class="pi pi-shield"></i><div><strong>Yetkili Kullanım</strong><p>Bu sistem yalnızca yetkili kullanıcılar içindir.<br />Tüm erişimler kayıt altına alınmaktadır.</p></div></div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })
const email = ref('')
const password = ref('')
const remember = ref(false)
const error = ref('')
const loading = ref(false)
const { login, user } = useAuth()
const submit = async () => {
  error.value = ''
  loading.value = true
  try {
    await login(email.value, password.value)
    await navigateTo(user.value?.is_expert ? '/expert' : '/customers')
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Giriş yapılamadı.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page{min-height:100vh;display:grid;grid-template-columns:53.5% 46.5%;background:#fff}.hero-panel{position:relative;min-height:100vh;overflow:hidden;background:#111827 url('/login-left.jpg') center/cover no-repeat}.hero-overlay{position:absolute;inset:0;background:linear-gradient(90deg,rgba(7,10,15,.88),rgba(7,10,15,.66) 55%,rgba(7,10,15,.78)),linear-gradient(180deg,rgba(0,0,0,.22),rgba(0,0,0,.58))}.hero-content{position:relative;z-index:1;height:100%;min-height:100vh;padding:62px 9.2%;display:flex;flex-direction:column}.hero-logo{width:375px;max-width:100%;height:auto}.hero-copy{margin-top:106px}.hero-copy h2{margin:0;color:#fff;font-size:53px;line-height:1.12;letter-spacing:-1.8px;font-weight:800}.hero-copy h2 span{color:#ffc107}.hero-line{width:62px;height:5px;background:#ffc107;border-radius:5px;margin:32px 0 28px}.hero-copy p{margin:0;color:#e5e7eb;font-size:18px;line-height:1.65}.hero-features{margin-top:auto;display:flex;gap:72px;padding-bottom:42px}.feature{display:flex;align-items:center;gap:14px;color:#fff;font-size:16px;line-height:1.35}.feature i{color:#ffc107;font-size:34px}.form-panel{display:flex;align-items:center;justify-content:center;background:#fff;padding:54px 8%}.login-card{width:min(560px,100%)}.form-logo{width:360px;max-width:88%;height:auto;display:block;margin:0 auto 42px}.login-card h1{margin:0;text-align:center;color:#111827;font-size:36px;letter-spacing:-1px;font-weight:800}.intro{text-align:center;margin:10px 0 42px;color:#7b8499;font-size:18px}.field{margin-bottom:27px}.field label{display:block;margin:0 0 10px;color:#111827;font-size:16px;font-weight:700}.input-wrap{position:relative}.input-wrap>i{position:absolute;z-index:2;left:18px;top:50%;transform:translateY(-50%);color:#7b8499;font-size:20px}.input-wrap :deep(.p-inputtext),.input-wrap :deep(.p-password-input){height:56px;border:1px solid #d7dce5;border-radius:11px;padding-left:54px;font-size:16px;color:#111827;box-shadow:none}.input-wrap :deep(.p-inputtext:focus),.input-wrap :deep(.p-password-input:focus){border-color:#ffc107;box-shadow:0 0 0 3px rgba(255,193,7,.13)}.input-wrap :deep(.p-password){width:100%}.input-wrap :deep(.p-password .p-icon-field){width:100%}.input-wrap :deep(.p-password .p-inputtext){width:100%;padding-right:52px}.input-wrap :deep(.p-password .p-icon){color:#697386}.form-options{display:flex;justify-content:space-between;align-items:center;margin:3px 0 31px;font-size:15px}.remember{display:flex;align-items:center;gap:10px;color:#273142;cursor:pointer}.remember :deep(.p-checkbox){width:23px;height:23px}.form-options a{color:#e6a900;text-decoration:underline;text-underline-offset:2px}.login-button{height:58px;border-radius:11px;background:#ffc107;border-color:#ffc107;color:#111827;font-size:18px;font-weight:800}.login-button:hover{background:#efb400;border-color:#efb400;color:#111827}.divider{display:flex;align-items:center;gap:17px;margin:38px 0}.divider span{height:1px;background:#dce1e9;flex:1}.divider b{color:#7b8499;font-size:16px;font-weight:500}.security-box{display:flex;gap:18px;align-items:flex-start;padding:22px 24px;border-radius:13px;background:#fff9e9}.security-box>i{color:#c28b00;font-size:27px;margin-top:2px}.security-box strong{display:block;color:#1d2430;font-size:16px;margin-bottom:5px}.security-box p{margin:0;color:#7b8499;font-size:15px;line-height:1.6}@media(max-width:1000px){.login-page{grid-template-columns:1fr}.hero-panel{display:none}.form-panel{min-height:100vh;padding:30px}.login-card{max-width:520px}}@media(max-width:600px){.form-panel{padding:24px}.form-logo{width:260px;margin-bottom:30px}.login-card h1{font-size:29px}.intro{font-size:15px;margin-bottom:30px}.login-button{height:54px}.security-box{padding:18px}.form-options{font-size:14px}}
</style>
