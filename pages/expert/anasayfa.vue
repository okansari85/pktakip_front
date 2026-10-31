<template>
  <div class="home-page">
    <header class="home-head">
      <p class="home-welcome">Hoş geldiniz</p>
      <h1>{{ user?.name || 'Uzman' }}</h1>
      <h2>Bugün ne yapmak istiyorsunuz?</h2>
      <p class="home-lead">Periyodik kontrol süreçlerinizi kolayca yönetin.</p>
    </header>

    <nav class="home-cards" aria-label="Ana sayfa bağlantıları">
      <NuxtLink v-for="card in CARDS" :key="card.to" :to="card.to" class="home-card" :class="card.tone">
        <img :src="`/anasayfa/${card.image}.png`" alt="" class="home-card-image" />
        <div class="home-card-row">
          <div>
            <strong>{{ card.title }}</strong>
            <span>{{ card.text }}</span>
          </div>
          <i class="pi pi-chevron-right" aria-hidden="true" />
        </div>
      </NuxtLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
// Bireysel uzmanın giriş sonrası yönlendirme sayfası: yalnız kartlar, veri isteği yok. Lokasyon seçici burada gizli.
definePageMeta({ layout: 'expert', middleware: 'expert', hideWorkplaceSwitcher: true })

const CARDS = [
  { to: '/expert', title: 'Genel Bakış', text: 'Portföy özeti', image: 'genel-bakis', tone: 'blue' },
  { to: '/expert/calendar', title: 'Kontrol Takvimi', text: 'Kontrol tarihleri', image: 'takvim', tone: 'green' },
  { to: '/expert/workplaces', title: 'Firmalarım', text: 'Firma ve lokasyonlar', image: 'firmalar', tone: 'yellow' },
  { to: '/expert/equipment', title: 'Ekipmanlar', text: 'Ekipman kayıtları', image: 'ekipmanlar', tone: 'green' },
  { to: '/expert/installations', title: 'Tesisatlar', text: 'Tesisat kayıtları', image: 'tesisatlar', tone: 'blue' },
  { to: '/expert/reports', title: 'Durum Raporu', text: 'Kontrol raporları', image: 'durum-raporu', tone: 'yellow' }
]

const { user } = useAuth()
const { multiUser, load } = useAccount()
// OSGB / kurumsal / kamu hesabında bu sayfa yok; adres elle yazılırsa Genel Bakış'a döner.
onMounted(async () => {
  await load()
  if (multiUser.value) await navigateTo('/expert', { replace: true })
})
</script>

<style scoped>
/* Layout'un iç boşluğu sıfırlanır: arka plan görseli içerik alanının tamamını kaplasın. */
.home-page { min-height: calc(100vh - 72px); margin: -30px -34px -40px; padding: 44px 34px 40px; background: url('/anasayfa/arkaplan.svg') right -80px / 1300px auto no-repeat; }
/* Geniş ekranda yazı ve kartlar birlikte ortalanır; yazı kartların sol kenarıyla hizalı kalır. */
.home-head { max-width: 1240px; margin: 0 auto 34px; }
.home-welcome { margin: 0; color: var(--admin-muted); font-size: 24px; }
.home-head h1 { margin: 4px 0; color: var(--admin-heading); font-size: 48px; font-weight: 800; letter-spacing: -1.5px; line-height: 1.1; }
.home-head h2 { margin: 0 0 10px; color: #7288a8; font-size: 34px; font-weight: 700; letter-spacing: -.5px; line-height: 1.15; }
.home-lead { margin: 0; color: var(--admin-muted); font-size: 16px; }
.home-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; max-width: 1240px; margin: 0 auto; }
.home-card { display: flex; flex-direction: column; gap: 16px; padding: 22px 24px; border: 1px solid var(--admin-border); border-radius: 16px; color: inherit; text-decoration: none; box-shadow: 0 10px 28px rgba(40, 70, 110, .08); transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease; }
.home-card:hover, .home-card:focus-visible { transform: translateY(-2px); border-color: var(--pk-yellow); box-shadow: 0 14px 32px rgba(40, 70, 110, .14); }
.home-card.blue { background: linear-gradient(135deg, #ffffff 40%, #eaf2fd); }
.home-card.green { background: linear-gradient(135deg, #ffffff 40%, #e6f8ef); }
.home-card.yellow { background: linear-gradient(135deg, #ffffff 40%, #fdf5df); }
.home-card-image { width: 118px; height: 106px; object-fit: cover; border-radius: 20px; }
.home-card-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.home-card strong { display: block; color: var(--admin-heading); font-size: 22px; font-weight: 800; letter-spacing: -.4px; }
.home-card span { display: block; margin-top: 4px; color: var(--admin-muted); font-size: 14px; }
.home-card i { flex: 0 0 42px; width: 42px; height: 42px; display: grid; place-items: center; border: 1px solid var(--admin-border); border-radius: 50%; background: rgba(255, 255, 255, .7); color: var(--admin-heading); font-size: 14px; }
/* Görsel ve açık geçişler koyu temaya uymaz: temanın düz yüzeyi kullanılır. */
:root.dark-theme .home-page { background: none; }
:root.dark-theme .home-card { background: var(--admin-card); box-shadow: none; }
:root.dark-theme .home-card i { background: transparent; }
/* Dar ekranda çizim yazının altına girer: kaldırılır. */
@media (max-width: 1100px) {
  .home-page { background: none; }
  .home-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 800px) {
  .home-page { margin: -20px -16px -30px; padding: 28px 16px 30px; }
  .home-welcome { font-size: 19px; }
  .home-head h1 { font-size: 34px; }
  .home-head h2 { font-size: 24px; }
}
@media (max-width: 560px) { .home-cards { grid-template-columns: minmax(0, 1fr); } }
</style>
