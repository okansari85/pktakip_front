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
