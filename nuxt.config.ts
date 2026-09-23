import Aura from '@primevue/themes/aura'

export default defineNuxtConfig({
  compatibilityDate: '2026-09-22',
  devtools: { enabled: true },
  // Oturum localStorage'da tutulduğu için sunucu kullanıcıyı bilemez; panel SPA olarak çalışır.
  ssr: false,
  modules: ['@primevue/nuxt-module'],
  primevue: {
    options: {
      ripple: true,
      inputVariant: 'outlined',
      theme: {
        preset: Aura,
        options: {
          prefix: 'p',
          darkModeSelector: 'system',
          cssLayer: false
        }
      }
    }
  },
  css: [
    'primeicons/primeicons.css',
    'primeflex/primeflex.css',
    '~/assets/css/main.css'
  ],
  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api'
    }
  }
})
