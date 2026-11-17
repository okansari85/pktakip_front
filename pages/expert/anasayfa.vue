<template>
  <div class="home-page">
    <div class="home-top">
      <div class="home-left">
        <nav class="crumb" aria-label="Sayfa yolu"><PkIcon class="pi pi-home" aria-hidden="true" /><span>Ana Sayfa</span></nav>
        <h1>Ana sayfa</h1>
        <p class="home-sub">Merhaba, {{ firstName }}<i class="sep" aria-hidden="true" /><span>{{ today }}</span></p>

        <section class="plan-card">
          <h2>Bugünkü iş planınız</h2>
          <p v-if="loading" class="plan-muted"><PkIcon class="pi pi-spin pi-spinner" /> Yükleniyor...</p>
          <p v-else-if="error" class="plan-muted error-text">{{ error }}</p>
          <p v-else-if="loaded && !groups.length" class="plan-muted">Henüz işyeriniz yok. Firmalarım'dan firma ekleyin.</p>
          <template v-else-if="data">
            <div v-if="overdueGroups" class="plan-row bad"><PkIcon class="pi pi-exclamation-triangle" /><strong>{{ number(overdueGroups) }} gecikmiş kontrol grubu</strong></div>
            <div v-if="nextDay" class="plan-row next">
              <PkIcon class="pi pi-calendar" />
              <strong>{{ agendaGroupsText(nextDay.entries) }} kontrolü {{ nextDay.days_left === 0 ? 'bugün' : `${nextDay.days_left} gün sonra` }}</strong>
            </div>
            <p v-if="!overdueGroups && !nextDay" class="plan-muted">Gecikmiş ya da yaklaşan kontrol yok.</p>
          </template>
          <div class="plan-actions">
            <NuxtLink to="/expert/calendar" class="plan-button primary"><PkIcon class="pi pi-calendar" /> Kontrol takvimi <PkIcon class="pi pi-chevron-right" /></NuxtLink>
            <NuxtLink to="/expert/bulgu-takip" class="plan-button"><PkIcon class="pi pi-clipboard" /> Bulguları aç <PkIcon class="pi pi-chevron-right" /></NuxtLink>
          </div>
          <div v-if="openFindings !== null" class="plan-findings"><PkIcon class="pi pi-clipboard" /><strong>{{ number(openFindings) }} açık bulgu</strong></div>
        </section>
      </div>
    </div>

    <nav class="home-cards" aria-label="Ana sayfa bağlantıları">
      <NuxtLink v-for="card in cards" :key="card.to" :to="card.to" class="home-card">
        <span class="home-card-icon" :class="card.tone" aria-hidden="true"><PkIcon :class="card.icon" /></span>
        <span class="home-card-text"><strong>{{ card.title }}</strong><span>{{ card.text }}</span></span>
        <PkIcon class="pi pi-chevron-right" aria-hidden="true" />
      </NuxtLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { agendaGroupsText, agendaNextDay } from '~/composables/controlAgenda'

// Bireysel uzmanın giriş sonrası ilk sayfası: bugünkü iş planı ve sayfa kartları.
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
  { to: '/expert', title: 'Genel bakış', text: 'Portföy özeti', icon: 'pi pi-chart-pie', tone: 'violet' },
  { to: '/expert/calendar', title: 'Kontrol takvimi', text: 'Yaklaşan kontroller', icon: 'pi pi-calendar', tone: 'primary' },
  { to: '/expert/bulgu-takip', title: 'Bulgu takibi', text: openFindings.value === null ? 'Bulgular' : `${number(openFindings.value)} açık bulgu`, icon: 'pi pi-clipboard', tone: 'error' },
  { to: '/expert/equipment', title: 'Ekipmanlar', text: data.value ? `${number(data.value.totals?.equipment || 0)} ekipman` : 'Ekipman kayıtları', icon: 'pi pi-wrench', tone: 'warning' },
  { to: '/expert/installations', title: 'Tesisatlar', text: data.value ? `${number(data.value.installations?.length || 0)} tesisat` : 'Tesisat kayıtları', icon: 'pi pi-bolt', tone: 'info' },
  { to: '/expert/workplaces', title: 'Firmalarım', text: 'Firma ve lokasyonlar', icon: 'pi pi-building', tone: 'success' },
  ...(SHOW_REPORT_CARD ? [{ to: '/expert/reports', title: 'Durum Raporu', text: 'Kontrol raporları', icon: 'pi pi-file', tone: 'primary' }] : [])
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
.home-page { display: grid; gap: 24px; }
.home-top { display: grid; grid-template-columns: minmax(0, 1fr); gap: 24px; }
.home-left { min-width: 0; }
.crumb { display: flex; align-items: center; gap: 8px; color: var(--admin-muted); font-size: 13px; }
.home-left h1 { margin: 10px 0 6px; color: var(--admin-heading); font-size: 24px; font-weight: 700; letter-spacing: 0; line-height: 1.1; }
.home-sub { display: flex; align-items: center; gap: 12px; margin: 0; color: var(--admin-muted); font-size: 15px; }
.home-sub span { font-size: 14px; }
.sep { width: 6px; height: 6px; border-radius: 50%; background: var(--admin-border); }

.plan-card { margin-top: 24px; padding: 24px; border: 0; border-radius: var(--pk-radius); background: var(--admin-card); box-shadow: var(--pk-card-shadow); }
.plan-card h2 { margin: 0 0 16px; color: var(--admin-heading); font-size: 17px; font-weight: 700; }
.plan-row { display: flex; align-items: center; gap: 14px; margin-bottom: 10px; padding: 14px 16px; border-radius: 12px; color: var(--admin-heading); font-size: 15px; }
.plan-row i { flex: none; font-size: 18px; }
.plan-row strong { min-width: 0; font-weight: 700; }
.plan-row.bad { background: var(--admin-danger-bg); }
.plan-row.bad i { color: var(--admin-danger-text); }
.plan-row.next { background: var(--admin-accent-soft); }
.plan-row.next i { color: var(--pk-accent); }
.plan-muted { margin: 0 0 10px; color: var(--admin-muted); font-size: 14px; }
.error-text { color: var(--admin-danger-text); }
.plan-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px; }
.plan-button { display: inline-flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 16px; border: 1px solid rgba(145, 158, 171, .32); border-radius: 8px; background: transparent; color: var(--admin-heading); font-size: 14px; font-weight: 700; }
.plan-button .pi-chevron-right { font-size: 12px; }
.plan-button:hover { background: rgba(145, 158, 171, .08); }
.plan-button.primary { border-color: transparent; background: var(--pk-accent); color: var(--pk-on-accent); box-shadow: 0 8px 16px rgba(var(--pk-accent-rgb), .24); }
.plan-button.primary:hover { background: var(--pk-accent-hover); }
.plan-findings { display: flex; align-items: center; gap: 12px; margin-top: 18px; padding-top: 16px; border-top: 1px dashed rgba(145, 158, 171, .24); color: var(--admin-heading); font-size: 15px; }
.plan-findings i { color: var(--admin-muted); font-size: 16px; }

.home-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }
.home-card { min-width: 0; display: flex; align-items: center; gap: 16px; padding: 24px; border: 0; border-radius: var(--pk-radius); background: var(--admin-card); color: inherit; box-shadow: var(--pk-card-shadow); transition: box-shadow .2s ease; }
.home-card:hover, .home-card:focus-visible { box-shadow: 0 0 2px rgba(145, 158, 171, .2), 0 20px 40px -4px rgba(145, 158, 171, .24); }
.home-card-icon { flex: none; width: 56px; height: 56px; display: grid; place-items: center; border-radius: 14px; font-size: 22px; }
.home-card-icon.violet { background: var(--pk-violet-lighter); color: var(--pk-violet-dark); }
.home-card-icon.primary { background: var(--pk-primary-lighter); color: var(--pk-primary-dark); }
.home-card-icon.info { background: var(--pk-info-lighter); color: var(--pk-info-dark); }
.home-card-icon.success { background: var(--pk-success-lighter); color: var(--pk-success-dark); }
.home-card-icon.warning { background: var(--pk-warning-lighter); color: var(--pk-warning-dark); }
.home-card-icon.error { background: var(--pk-error-lighter); color: var(--pk-error-dark); }
.home-card-text { flex: 1; min-width: 0; }
.home-card strong { display: block; color: var(--admin-heading); font-size: 17px; font-weight: 700; }
.home-card-text span { display: block; margin-top: 4px; color: var(--admin-muted); font-size: 14px; }
.home-card > i { flex: none; color: var(--admin-muted); font-size: 14px; }

@media (max-width: 1100px) { .home-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 600px) { .home-cards { grid-template-columns: minmax(0, 1fr); } }
</style>
