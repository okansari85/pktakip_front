<template>
  <div class="home-page">
    <div class="home-top">
      <div class="home-left">
        <nav class="crumb" aria-label="Sayfa yolu"><i class="pi pi-home" aria-hidden="true" /><span>Ana Sayfa</span></nav>
        <h1>Ana sayfa</h1>
        <p class="home-sub">Merhaba, {{ firstName }}<i class="sep" aria-hidden="true" /><span>{{ today }}</span></p>

        <section class="plan-card">
          <h2>Bugünkü iş planınız</h2>
          <p v-if="loading" class="plan-muted"><i class="pi pi-spin pi-spinner" /> Yükleniyor...</p>
          <p v-else-if="error" class="plan-muted error-text">{{ error }}</p>
          <p v-else-if="loaded && !groups.length" class="plan-muted">Henüz işyeriniz yok. Firmalarım'dan firma ekleyin.</p>
          <template v-else-if="data">
            <div v-if="overdueGroups" class="plan-row bad"><i class="pi pi-exclamation-triangle" /><strong>{{ number(overdueGroups) }} gecikmiş kontrol grubu</strong></div>
            <div v-if="nextDay" class="plan-row next">
              <i class="pi pi-calendar" />
              <strong>{{ agendaGroupsText(nextDay.entries) }} kontrolü {{ nextDay.days_left === 0 ? 'bugün' : `${nextDay.days_left} gün sonra` }}</strong>
            </div>
            <p v-if="!overdueGroups && !nextDay" class="plan-muted">Gecikmiş ya da yaklaşan kontrol yok.</p>
          </template>
          <div class="plan-actions">
            <NuxtLink to="/expert/calendar" class="plan-button primary"><i class="pi pi-calendar" /> Kontrol takvimi <i class="pi pi-chevron-right" /></NuxtLink>
            <NuxtLink to="/expert/bulgu-takip" class="plan-button"><i class="pi pi-clipboard" /> Bulguları aç <i class="pi pi-chevron-right" /></NuxtLink>
          </div>
          <div v-if="openFindings !== null" class="plan-findings"><i class="pi pi-clipboard" /><strong>{{ number(openFindings) }} açık bulgu</strong></div>
        </section>
      </div>

      <figure class="home-hero">
        <img src="/katalog/yerlesim.svg" alt="" />
        <figcaption><i class="pi pi-map-marker" /> Örnek yerleşim</figcaption>
      </figure>
    </div>

    <nav class="home-cards" aria-label="Ana sayfa bağlantıları">
      <NuxtLink v-for="card in cards" :key="card.to" :to="card.to" class="home-card">
        <img :src="card.image" alt="" class="home-card-image" />
        <span class="home-card-text"><strong>{{ card.title }}</strong><span>{{ card.text }}</span></span>
        <i class="pi pi-chevron-right" aria-hidden="true" />
      </NuxtLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { agendaGroupsText, agendaNextDay } from '~/composables/controlAgenda'

// Bireysel uzmanın giriş sonrası ilk sayfası (tasarım kataloğu 01): bugünkü iş planı, örnek yerleşim çizimi ve sayfa kartları.
// Lokasyon seçici burada gizli; sayılar uzmanın bütün lokasyonlarından.
definePageMeta({ layout: 'expert', middleware: 'expert', hideWorkplaceSwitcher: true })

// Durum Raporu kartı: katalogda yok, gizli; ileride açılabilir.
const SHOW_REPORT_CARD = false

const { user } = useAuth()
const { account, multiUser, load } = useAccount()
const { groups, loaded, load: loadWorkplaces } = useMyWorkplaces()
const { get, errorMessage } = useExpertApi()
const { open: openFindings, refresh: refreshFindings } = useFindingCount()

const number = (value: number) => new Intl.NumberFormat('tr-TR').format(value)
const firstName = computed(() => (user.value?.name || 'Uzman').split(' ')[0])
const today = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())

const data = ref<any>(null)
const loading = ref(false)
const error = ref('')
// "Kontrol grubu": takvimdeki bir kalem (gün + lokasyon + tür / tesisat / tüp); Genel bakış'taki sayımla aynı.
const overdueGroups = computed(() => (data.value?.agenda || []).filter((entry: any) => entry.days_left < 0).reduce((sum: number, entry: any) => sum + (entry.groups?.length || 0), 0))
const nextDay = computed(() => agendaNextDay(data.value?.agenda))

const cards = computed(() => [
  { to: '/expert', title: 'Genel bakış', text: 'Portföy özeti', image: '/katalog/genel-bakis.svg' },
  { to: '/expert/calendar', title: 'Kontrol takvimi', text: 'Yaklaşan kontroller', image: '/katalog/takvim.svg' },
  { to: '/expert/bulgu-takip', title: 'Bulgu takibi', text: openFindings.value === null ? 'Bulgular' : `${number(openFindings.value)} açık bulgu`, image: '/katalog/bulgu.svg' },
  { to: '/expert/equipment', title: 'Ekipmanlar', text: data.value ? `${number(data.value.totals?.equipment || 0)} ekipman` : 'Ekipman kayıtları', image: '/katalog/ekipman.svg' },
  { to: '/expert/installations', title: 'Tesisatlar', text: data.value ? `${number(data.value.installations?.length || 0)} tesisat` : 'Tesisat kayıtları', image: '/katalog/tesisat.svg' },
  { to: '/expert/workplaces', title: 'Firmalarım', text: 'Firma ve lokasyonlar', image: '/katalog/firmalar.svg' },
  ...(SHOW_REPORT_CARD ? [{ to: '/expert/reports', title: 'Durum Raporu', text: 'Kontrol raporları', image: '/anasayfa/durum-raporu.png' }] : [])
])

// İşyerleri gelince (başka bir yer yüklüyor olabilir) bir kez: Genel bakış'ın verisi, bütün lokasyonlarla.
const loadData = async () => {
  if (!account.value || multiUser.value || !groups.value.length || data.value || loading.value) return
  refreshFindings()
  loading.value = true
  error.value = ''
  try { data.value = await get('/pk-dashboard', { 'location_ids[]': groups.value.map(group => group.location_id) }) }
  catch (e: any) { error.value = errorMessage(e, 'İş planı alınamadı.') }
  finally { loading.value = false }
}
watch(groups, loadData)

// OSGB / kurumsal / kamu hesabında bu sayfa yok; adres elle yazılırsa Genel Bakış'a döner.
onMounted(async () => {
  await load()
  if (multiUser.value) return navigateTo('/expert', { replace: true })
  await loadWorkplaces()
  loadData()
})
</script>

<style scoped>
.home-page { display: grid; gap: 22px; }
.home-top { display: grid; grid-template-columns: minmax(360px, 470px) minmax(0, 1fr); gap: 24px; align-items: stretch; }
.home-left { min-width: 0; }
.crumb { display: flex; align-items: center; gap: 8px; color: var(--admin-muted); font-size: 14px; }
.home-left h1 { margin: 10px 0 6px; color: var(--admin-heading); font-size: 44px; font-weight: 800; letter-spacing: -1.2px; line-height: 1.1; }
.home-sub { display: flex; align-items: center; gap: 12px; margin: 0; color: var(--admin-muted); font-size: 18px; }
.home-sub span { font-size: 15px; }
.sep { width: 6px; height: 6px; border-radius: 50%; background: var(--admin-border); }

.plan-card { margin-top: 26px; padding: 22px 22px 18px; border: 1px solid var(--admin-border); border-radius: 18px; background: var(--admin-card); box-shadow: 0 10px 28px rgba(var(--pk-shadow-rgb), .06); }
.plan-card h2 { margin: 0 0 16px; color: var(--admin-heading); font-size: 22px; font-weight: 800; letter-spacing: -.3px; }
.plan-row { display: flex; align-items: center; gap: 14px; margin-bottom: 10px; padding: 14px 16px; border-radius: 12px; color: var(--admin-heading); font-size: 16px; }
.plan-row i { flex: none; font-size: 20px; }
.plan-row strong { min-width: 0; font-weight: 700; }
.plan-row.bad { background: var(--admin-danger-bg); }
.plan-row.bad i { color: var(--admin-danger-text); }
.plan-row.next { background: var(--admin-accent-soft); }
.plan-row.next i { color: var(--pk-yellow-dark); }
.plan-muted { margin: 0 0 10px; color: var(--admin-muted); font-size: 14px; }
.error-text { color: var(--admin-danger-text); }
.plan-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
.plan-button { display: inline-flex; align-items: center; gap: 10px; min-height: 50px; padding: 0 16px; border: 1px solid var(--admin-border); border-radius: 12px; background: var(--admin-card); color: var(--admin-heading); font-size: 15px; font-weight: 700; }
.plan-button .pi-chevron-right { font-size: 12px; }
.plan-button:hover { border-color: var(--pk-yellow); }
.plan-button.primary { border-color: var(--pk-yellow); background: var(--pk-yellow); color: var(--pk-on-accent); }
.plan-button.primary:hover { background: var(--pk-yellow-dark); }
.plan-findings { display: flex; align-items: center; gap: 12px; margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--admin-border); color: var(--admin-heading); font-size: 17px; }
.plan-findings i { color: var(--admin-muted); font-size: 18px; }

.home-hero { position: relative; min-width: 0; margin: 0; display: flex; align-items: center; justify-content: center; }
.home-hero img { width: 100%; max-height: 440px; object-fit: contain; }
.home-hero figcaption, .home-hero figcaption i { display: inline-flex; align-items: center; gap: 8px; }
.home-hero figcaption { position: absolute; right: 8px; bottom: 6px; padding: 9px 16px; border: 1px solid var(--admin-border); border-radius: 999px; background: var(--admin-card); color: var(--admin-heading); font-size: 14px; font-weight: 600; box-shadow: 0 6px 18px rgba(var(--pk-shadow-rgb), .06); }

.home-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.home-card { min-width: 0; min-height: 140px; display: flex; align-items: center; gap: 18px; padding: 12px 22px 12px 14px; border: 1px solid var(--admin-border); border-radius: 18px; background: var(--admin-card); color: inherit; box-shadow: 0 10px 28px rgba(var(--pk-shadow-rgb), .06); transition: transform .15s ease, border-color .15s ease; }
.home-card:hover, .home-card:focus-visible { transform: translateY(-2px); border-color: var(--pk-yellow); }
.home-card-image { flex: none; width: 150px; height: 112px; object-fit: contain; }
.home-card-text { flex: 1; min-width: 0; }
.home-card strong { display: block; color: var(--admin-heading); font-size: 22px; font-weight: 800; letter-spacing: -.4px; }
.home-card-text span { display: block; margin-top: 4px; color: var(--admin-muted); font-size: 16px; }
.home-card > i { flex: none; color: var(--admin-heading); font-size: 15px; }

/* Dar ekranda çizim kalkar, kartlar ikili / tekli. */
@media (max-width: 1100px) {
  .home-top { grid-template-columns: minmax(0, 1fr); }
  .home-hero { display: none; }
  .home-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 800px) {
  .home-left h1 { font-size: 34px; }
  .home-card-image { width: 110px; height: 84px; }
}
@media (max-width: 600px) { .home-cards { grid-template-columns: minmax(0, 1fr); } }
</style>
