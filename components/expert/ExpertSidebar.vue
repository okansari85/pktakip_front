<template>
  <aside class="expert-sidebar" :class="{ collapsed }">
    <div class="sidebar-brand">
      <span class="brand-icon">✓</span>
      <div v-if="!collapsed">
        <strong><span>PK</span>Takip</strong>
        <small>{{ edition || 'Periyodik Kontrol Takip' }}</small>
      </div>
    </div>

    <button class="collapse-button" type="button" :aria-label="collapsed ? 'Menüyü aç' : 'Menüyü daralt'" @click="emit('toggle')">
      <i :class="collapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'" />
      <span v-if="!collapsed">Menüyü daralt</span>
    </button>

    <template v-if="mode === 'settings'">
      <NuxtLink to="/expert/workplaces" class="back-link" :title="collapsed ? 'Panele dön' : undefined">
        <i class="pi pi-arrow-left" />
        <span v-if="!collapsed">Panele dön</span>
      </NuxtLink>
      <div v-if="!collapsed" class="sidebar-label">AYARLAR · TANIMLAR</div>
      <nav class="sidebar-nav">
        <!-- Kurumsal hesapta müşteri yok (firma tek müşteri): organizasyonu tam ekran; OSGB / kurumsalda yalnızca yönetici -->
        <NuxtLink v-if="corporate && isManager" to="/expert/settings/organization" class="sidebar-link" :title="collapsed ? 'Organizasyon' : undefined">
          <i class="pi pi-sitemap" />
          <span v-if="!collapsed">Organizasyon</span>
        </NuxtLink>
        <NuxtLink v-else-if="!multiUser || isManager" to="/expert/settings/customers" class="sidebar-link" :title="collapsed ? (multiUser ? 'Müşteriler' : 'Organizasyon Yönetimi') : undefined">
          <i :class="multiUser ? 'pi pi-users' : 'pi pi-sitemap'" />
          <span v-if="!collapsed">{{ multiUser ? 'Müşteriler' : 'Organizasyon Yönetimi' }}</span>
        </NuxtLink>
        <NuxtLink v-if="!multiUser || isManager || isOperation" to="/expert/settings/locations" class="sidebar-link" :title="collapsed ? 'Lokasyonlar' : undefined">
          <i class="pi pi-map-marker" />
          <span v-if="!collapsed">Lokasyonlar</span>
        </NuxtLink>
        <!-- Kamu hesabında Firmalar yok: işyerleri Lokasyonlar → İşyerleri'nden yönetilir -->
        <NuxtLink v-if="!kamu && (!multiUser || isManager || isOperation)" to="/expert/settings/companies" class="sidebar-link" :title="collapsed ? 'Firmalar' : undefined">
          <i class="pi pi-briefcase" />
          <span v-if="!collapsed">Firmalar</span>
        </NuxtLink>
        <NuxtLink v-if="isManager" to="/expert/settings/users" class="sidebar-link" :title="collapsed ? 'Kullanıcılar' : undefined">
          <i class="pi pi-id-card" />
          <span v-if="!collapsed">Kullanıcılar</span>
        </NuxtLink>
        <NuxtLink to="/expert/settings/catalog-requests" class="sidebar-link" :title="collapsed ? 'Katalog talepleri' : undefined">
          <i class="pi pi-inbox" />
          <span v-if="!collapsed">Katalog talepleri</span>
        </NuxtLink>
        <NuxtLink to="/expert/settings/analyses" class="sidebar-link" :title="collapsed ? 'Analiz geçmişi' : undefined">
          <i class="pi pi-history" />
          <span v-if="!collapsed">Analiz geçmişi</span>
        </NuxtLink>
        <!-- Yalnızca süper admin: yapay zeka ayarı ve test sayfası (test verisi üretme) -->
        <NuxtLink v-if="superAdmin" to="/expert/settings/ai" class="sidebar-link" :title="collapsed ? 'Yapay zeka' : undefined">
          <i class="pi pi-sparkles" />
          <span v-if="!collapsed">Yapay zeka</span>
        </NuxtLink>
        <NuxtLink v-if="superAdmin" to="/expert/test" class="sidebar-link" :title="collapsed ? 'Test' : undefined">
          <i class="pi pi-code" />
          <span v-if="!collapsed">Test</span>
        </NuxtLink>
      </nav>
      <div class="sidebar-spacer" />
    </template>

    <template v-else>
      <div v-if="!collapsed" class="sidebar-label">UZMAN PANELİ</div>
      <nav class="sidebar-nav">
        <!-- Yalnızca bireysel uzman; hesap bilgisi gelmeden gösterilmez (OSGB / kurumsalda bir an görünmesin) -->
        <NuxtLink v-if="account && !multiUser" to="/expert/anasayfa" class="sidebar-link" :title="collapsed ? 'Ana Sayfa' : undefined">
          <i class="pi pi-home" />
          <span v-if="!collapsed">Ana Sayfa</span>
        </NuxtLink>
        <NuxtLink to="/expert" class="sidebar-link" active-class="" exact-active-class="router-link-active" :title="collapsed ? 'Genel Bakış' : undefined">
          <i class="pi pi-th-large" />
          <span v-if="!collapsed">Genel Bakış</span>
        </NuxtLink>
        <NuxtLink to="/expert/calendar" class="sidebar-link" :title="collapsed ? 'Kontrol Takvimi' : undefined">
          <i class="pi pi-calendar" />
          <span v-if="!collapsed">Kontrol Takvimi</span>
        </NuxtLink>
        <!-- Periyodik Kontroller: ekipmanlar + tesisatlar (daraltılmış menüde yalnızca simgeler) -->
        <template v-if="collapsed">
          <NuxtLink v-for="item in PERIODIC" :key="item.to" :to="item.to" class="sidebar-link" :title="item.label"><i :class="item.icon" /></NuxtLink>
        </template>
        <div v-else class="sidebar-group" :class="{ open: periodicOpen, active: periodicActive }">
          <button class="sidebar-link group-toggle" type="button" :aria-expanded="periodicOpen" @click="periodicOpen = !periodicOpen">
            <i class="pi pi-calendar-clock" />
            <span>Periyodik Kontroller</span>
            <i class="pi pi-chevron-down chevron" />
          </button>
          <div v-show="periodicOpen" class="sidebar-children">
            <NuxtLink v-for="item in PERIODIC" :key="item.to" :to="item.to" class="sidebar-link child">
              <i :class="item.icon" />
              <span>{{ item.label }}</span>
            </NuxtLink>
          </div>
        </div>
      </nav>

      <div class="sidebar-section">
        <nav class="sidebar-nav">
          <NuxtLink to="/expert/workplaces" class="sidebar-link" :title="collapsed ? (kamu ? 'İşyerlerim' : 'Firmalarım') : undefined">
            <i class="pi pi-briefcase" />
            <span v-if="!collapsed">{{ kamu ? 'İşyerlerim' : 'Firmalarım' }}</span>
          </NuxtLink>
          <NuxtLink :to="settingsHome" class="sidebar-link" :title="collapsed ? 'Ayarlar' : undefined">
            <i class="pi pi-cog" />
            <span v-if="!collapsed">Ayarlar</span>
          </NuxtLink>
        </nav>
      </div>
    </template>

    <div class="sidebar-bottom">
      <!-- Paketim: kalan kredi ve işyeri doluluğu; tıklayınca kredi hareketleri -->
      <NuxtLink v-if="!collapsed" to="/expert/settings/analyses?tab=credits" class="credit-link" title="Kredi hareketleri"><ExpertCreditSummary compact /></NuxtLink>
      <div v-if="!collapsed" class="expert-badge"><i class="pi pi-user" /><span>{{ roleLabel }}</span></div>
      <button class="logout-link" type="button" :title="collapsed ? 'Çıkış Yap' : undefined" @click="logout">
        <i class="pi pi-sign-out" />
        <span v-if="!collapsed">Çıkış Yap</span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ collapsed?: boolean; mode?: 'panel' | 'settings' }>(), { collapsed: false, mode: 'panel' })
const emit = defineEmits<{ toggle: [] }>()
const { logout, superAdmin } = useAuth()
// Hesap türü (OSGB / kurumsal): logonun altı ve rol; bireysel uzmanda bugünkü yazılar.
// Ayarlar menüsü role göre (OSGB / kurumsal): uzman yapı sayfalarını (Lokasyonlar, Firmalar…) görmez; ilk sayfa settingsHome.
const { account, multiUser, corporate, kamu, isManager, isOperation, edition, roleLabel, settingsHome, load: loadAccount } = useAccount()
onMounted(loadAccount)

const PERIODIC = [
  { to: '/expert/equipment', label: 'Ekipmanlar', icon: 'pi pi-wrench' },
  { to: '/expert/installations', label: 'Tesisatlar', icon: 'pi pi-sitemap' },
  { to: '/expert/reports', label: 'Durum Raporu', icon: 'pi pi-chart-bar' }
]
const route = useRoute()
const periodicActive = computed(() => PERIODIC.some(item => route.path.startsWith(item.to)))
// Grup açık gelir; kapatılabilir, içindeki bir sayfaya gidilince yeniden açılır.
const periodicOpen = ref(true)
watch(periodicActive, active => { if (active) periodicOpen.value = true })
</script>

<style scoped>
/* Sayfa uzasa da menü ekran boyunda sabit kalır (yapışık); menü ekrana sığmazsa kendi içinde kayar. */
.expert-sidebar { position: sticky; top: 0; align-self: flex-start; width: 250px; height: 100vh; overflow-y: auto; padding: 22px 14px; display: flex; flex-direction: column; flex-shrink: 0; background: var(--admin-sidebar); color: var(--admin-sidebar-text); border-right: 1px solid var(--admin-sidebar-border); transition: width .2s ease, padding .2s ease; }
.expert-sidebar.collapsed { width: 76px; padding-left: 10px; padding-right: 10px; }
.sidebar-brand { display: flex; align-items: center; gap: 11px; padding: 4px 10px 20px; }
.brand-icon { width: 42px; height: 42px; flex: 0 0 42px; display: grid; place-items: center; border-radius: 11px; background: var(--pk-yellow); color: #111827; font-size: 25px; font-weight: 800; }
.sidebar-brand strong { display: block; font-size: 20px; letter-spacing: -.5px; color: #fff; }
.sidebar-brand strong span { color: var(--pk-yellow); }
.sidebar-brand small { display: block; margin-top: 2px; color: var(--admin-sidebar-muted); font-size: 10px; }
.collapse-button { width: 100%; min-height: 38px; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 16px; border: 1px solid var(--admin-sidebar-border); border-radius: 8px; background: transparent; color: var(--admin-sidebar-muted); cursor: pointer; font-size: 11px; }
.collapse-button:hover { color: #fff; background: var(--admin-sidebar-hover); }
.sidebar-label { padding: 0 12px 8px; color: var(--admin-sidebar-muted); font-size: 10px; font-weight: 700; letter-spacing: .12em; }
.sidebar-nav { display: grid; gap: 5px; }
.sidebar-link { display: flex; align-items: center; gap: 11px; min-height: 44px; padding: 0 13px; border-radius: 9px; color: var(--admin-sidebar-text); transition: .15s ease; }
.collapsed .sidebar-link { justify-content: center; padding: 0; }
.sidebar-link:hover { background: var(--admin-sidebar-hover); color: #fff; }
.sidebar-link.router-link-active { background: var(--pk-yellow); color: #111827; font-weight: 700; }
/* Uzun adlar (ör. Organizasyon Yönetimi) kalınken de tek satır kalsın. */
.sidebar-link > span { white-space: nowrap; }
.sidebar-link.router-link-active > span { letter-spacing: -.3px; }
.group-toggle { width: 100%; border: 0; background: transparent; font: inherit; text-align: left; cursor: pointer; }
.group-toggle .chevron { margin-left: auto; font-size: 11px; transition: transform .15s ease; }
.sidebar-group:not(.open) .chevron { transform: rotate(-90deg); }
.sidebar-group.active > .group-toggle { color: #fff; font-weight: 600; }
.sidebar-children { display: grid; gap: 3px; margin-top: 3px; padding-left: 14px; }
.sidebar-link.child { min-height: 38px; font-size: 13px; }
.back-link { display: flex; align-items: center; gap: 10px; min-height: 40px; margin-bottom: 14px; padding: 0 13px; border-radius: 9px; color: var(--admin-sidebar-muted); font-size: 12px; font-weight: 600; }
.collapsed .back-link { justify-content: center; padding: 0; }
.back-link:hover { background: var(--admin-sidebar-hover); color: #fff; }
.sidebar-spacer { flex: 1; }
.sidebar-section { margin-top: auto; padding-top: 14px; border-top: 1px solid var(--admin-sidebar-border); }
.credit-link { display: block; text-decoration: none; }
.credit-link:hover :deep(.credit-summary) { border-color: var(--pk-yellow); }
.sidebar-bottom { margin-top: 14px; display: grid; gap: 8px; padding: 14px 8px 4px; border-top: 1px solid var(--admin-sidebar-border); }
.expert-badge, .logout-link { display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 0 10px; color: var(--admin-sidebar-muted); font-size: 12px; }
.logout-link { width: 100%; border: 0; background: transparent; cursor: pointer; text-align: left; border-radius: 8px; }
.collapsed .logout-link { justify-content: center; padding: 0; }
.logout-link:hover { background: var(--admin-sidebar-hover); color: #fff; }
@media (max-width: 800px) { .expert-sidebar { position: static; width: 100%; height: auto; overflow: visible; } .expert-sidebar.collapsed { width: 100%; } }
</style>
