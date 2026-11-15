import Aura from '@primevue/themes/aura'
import { definePreset } from '@primevue/themes'

// Tasarım kataloğu: PrimeVue birincil rengi katalog mavisi (Aura'nın yeşili yerine; onay kutusu, ilerleme çubuğu, seçim düğmesi, sayfalama).
const PKTakipTheme = definePreset(Aura, {
  semantic: {
    primary: { 50: '#eef5ff', 100: '#d9e8ff', 200: '#bcd6ff', 300: '#8ebcff', 400: '#5996fb', 500: '#1a6ff4', 600: '#1259d6', 700: '#1048ad', 800: '#133d8a', 900: '#15366f', 950: '#0f2247' }
  }
})

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
