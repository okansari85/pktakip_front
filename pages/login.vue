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
          <div class="feature">
            <i class="pi pi-shield"></i>
            <span>Güvenli<br />Veri Yönetimi</span>
          </div>
          <div class="feature">
            <i class="pi pi-file-edit"></i>
            <span>Dijital<br />Süreçler</span>
          </div>
          <div class="feature">
            <i class="pi pi-chart-bar"></i>
            <span>Daha Verimli<br />Operasyonlar</span>
          </div>
        </div>
      </div>
    </section>

    <section class="form-panel">
      <div class="login-card">
        <img src="/pktakip-logo.svg" alt="PKTakip - Periyodik Kontrol Takip" class="form-logo" />

        <h1>Sisteme Giriş Yapın</h1>
        <p class="intro">Hesabınızla giriş yaparak devam edin.</p>

        <form @submit.prevent="submit">
          <div class="field">
            <label for="email">E-posta</label>
            <div class="input-wrap">
              <i class="pi pi-envelope"></i>
              <InputText id="email" v-model="email" type="email" placeholder="E-posta adresiniz" autocomplete="email" fluid />
            </div>
          </div>

          <div class="field">
            <label for="password">Şifre</label>
            <div class="input-wrap">
              <i class="pi pi-lock"></i>
              <Password id="password" v-model="password" :feedback="false" toggleMask placeholder="Şifreniz" autocomplete="current-password" fluid />
            </div>
          </div>

          <div class="form-options">
            <label class="remember">
              <Checkbox v-model="remember" :binary="true" />
              <span>Beni hatırla</span>
            </label>
            <a href="#" @click.prevent>Şifremi unuttum?</a>
          </div>

          <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

          <Button type="submit" label="Giriş Yap" icon="pi pi-arrow-right" iconPos="right" class="login-button" :loading="loading" fluid />
        </form>

        <div class="divider"><span></span><b>veya</b><span></span></div>

        <div class="security-box">
          <i class="pi pi-shield"></i>
          <div>
            <strong>Yetkili Kullanım</strong>
            <p>Bu sistem yalnızca yetkili kullanıcılar içindir.<br />Tüm erişimler kayıt altına alınmaktadır.</p>
          </div>
        </div>
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
.login-page{min-height:100vh;display:grid;grid-template-columns:53.5% 46.5%;background:#fff}.hero-panel{position:relative;min-height:100vh;overflow:hidden;background:#111827 url('data:image/jpeg;base64,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') center/cover no-repeat}.hero-overlay{position:absolute;inset:0;background:linear-gradient(90deg,rgba(7,10,15,.88),rgba(7,10,15,.66) 55%,rgba(7,10,15,.78)),linear-gradient(180deg,rgba(0,0,0,.22),rgba(0,0,0,.58))}.hero-content{position:relative;z-index:1;height:100%;min-height:100vh;padding:62px 9.2%;display:flex;flex-direction:column}.hero-logo{width:375px;max-width:100%;height:auto}.hero-copy{margin-top:106px}.hero-copy h2{margin:0;color:#fff;font-size:53px;line-height:1.12;letter-spacing:-1.8px;font-weight:800}.hero-copy h2 span{color:#ffc107}.hero-line{width:62px;height:5px;background:#ffc107;border-radius:5px;margin:32px 0 28px}.hero-copy p{margin:0;color:#e5e7eb;font-size:18px;line-height:1.65}.hero-features{margin-top:auto;display:flex;gap:72px;padding-bottom:42px}.feature{display:flex;align-items:center;gap:14px;color:#fff;font-size:16px;line-height:1.35}.feature i{color:#ffc107;font-size:34px}.form-panel{display:flex;align-items:center;justify-content:center;background:#fff;padding:54px 8%}.login-card{width:min(560px,100%)}.form-logo{width:360px;max-width:88%;height:auto;display:block;margin:0 auto 42px}.login-card h1{margin:0;text-align:center;color:#111827;font-size:36px;letter-spacing:-1px;font-weight:800}.intro{text-align:center;margin:10px 0 42px;color:#7b8499;font-size:18px}.field{margin-bottom:27px}.field label{display:block;margin:0 0 10px;color:#111827;font-size:16px;font-weight:700}.input-wrap{position:relative}.input-wrap>i{position:absolute;z-index:2;left:18px;top:50%;transform:translateY(-50%);color:#7b8499;font-size:20px}.input-wrap :deep(.p-inputtext),.input-wrap :deep(.p-password-input){height:56px;border:1px solid #d7dce5;border-radius:11px;padding-left:54px;font-size:16px;color:#111827;box-shadow:none}.input-wrap :deep(.p-inputtext:focus),.input-wrap :deep(.p-password-input:focus){border-color:#ffc107;box-shadow:0 0 0 3px rgba(255,193,7,.13)}.input-wrap :deep(.p-password){width:100%}.input-wrap :deep(.p-password .p-icon-field){width:100%}.input-wrap :deep(.p-password .p-inputtext){width:100%;padding-right:52px}.input-wrap :deep(.p-password .p-icon){color:#697386}.form-options{display:flex;justify-content:space-between;align-items:center;margin:3px 0 31px;font-size:15px}.remember{display:flex;align-items:center;gap:10px;color:#273142;cursor:pointer}.remember :deep(.p-checkbox){width:23px;height:23px}.form-options a{color:#e6a900;text-decoration:underline;text-underline-offset:2px}.login-button{height:58px;border-radius:11px;background:#ffc107;border-color:#ffc107;color:#111827;font-size:18px;font-weight:800}.login-button:hover{background:#efb400;border-color:#efb400;color:#111827}.divider{display:flex;align-items:center;gap:17px;margin:38px 0}.divider span{height:1px;background:#dce1e9;flex:1}.divider b{color:#7b8499;font-size:16px;font-weight:500}.security-box{display:flex;gap:18px;align-items:flex-start;padding:22px 24px;border-radius:13px;background:#fff9e9}.security-box>i{color:#c28b00;font-size:27px;margin-top:2px}.security-box strong{display:block;color:#1d2430;font-size:16px;margin-bottom:5px}.security-box p{margin:0;color:#7b8499;font-size:15px;line-height:1.6}@media(max-width:1000px){.login-page{grid-template-columns:1fr}.hero-panel{display:none}.form-panel{min-height:100vh;padding:30px}.login-card{max-width:520px}}@media(max-width:600px){.form-panel{padding:24px}.form-logo{width:260px;margin-bottom:30px}.login-card h1{font-size:29px}.intro{font-size:15px;margin-bottom:30px}.login-button{height:54px}.security-box{padding:18px}.form-options{font-size:14px}}
</style>
