import Aura from '@primevue/themes/aura'
import { definePreset } from '@primevue/themes'

// PrimeVue birincil rengi = Behance CRM paletinin birincil mavisi (onay kutusu, ilerleme çubuğu, seçim düğmesi, sayfalama).
const PKTakipTheme = definePreset(Aura, {
  semantic: {
    primary: { 50: '#eef3ff', 100: '#d6e2ff', 200: '#adc6ff', 300: '#6b97ff', 400: '#3d6dff', 500: '#0047ff', 600: '#003de0', 700: '#0030b8', 800: '#002590', 900: '#001a73', 950: '#000f47' }
  }
})

export default defineNuxtConfig({
  compatibilityDate: '2026-09-22',
  devtools: { enabled: true },
  // Oturum localStorage'da tutulduğu için sunucu kullanıcıyı bilemez; panel SPA olarak çalışır.
  ssr: false,
  // Yazı tipi: Public Sans (Behance CRM tasarımındaki yuvarlak, sade grotesk).
  app: {
    head: {
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700;800&display=swap' }
      ]
    }
  },
  modules: ['@primevue/nuxt-module'],
  primevue: {
    options: {
      ripple: true,
      inputVariant: 'outlined',
      // Takvim (DatePicker) Türkçe, hafta pazartesi başlar; diğer metinler PrimeVue varsayılanı (birleştirilir).
      locale: {
        dayNames: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],
        dayNamesShort: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'],
        dayNamesMin: ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'],
        monthNames: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],
        monthNamesShort: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
        firstDayOfWeek: 1,
        today: 'Bugün',
        clear: 'Temizle'
      },
      theme: {
        preset: PKTakipTheme,
        options: {
          prefix: 'p',
          darkModeSelector: 'system',
          cssLayer: false
        }
      }
    }
  },
  css: [
    'primeflex/primeflex.css',
    '~/assets/css/main.css'
  ],
  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api'
    }
  }
})
