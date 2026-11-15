<template>
  <header class="expert-topbar">
    <!-- Sol menü: geniş → dar → kapalı → geniş -->
    <button v-tooltip.bottom="menuLabel" class="menu-toggle" type="button" :aria-label="menuLabel" @click="nextMenu"><i class="pi pi-bars" /></button>
    <ExpertWorkplaceSwitcher v-if="!title.startsWith('Ayarlar') && !route.meta.hideWorkplaceSwitcher" />

    <div class="topbar-actions">
      <!-- Süper admin bir hesaba girdiyse: kendi oturumuna (Müşteriler) döner -->
      <button v-if="impersonating" class="return-button" type="button" @click="stopImpersonation"><i class="pi pi-arrow-left" /> Süper admine dön</button>
      <button class="theme-toggle" type="button" :aria-label="isDark ? 'Açık temaya geç' : 'Koyu temaya geç'" @click="toggleTheme">
        <i :class="isDark ? 'pi pi-sun' : 'pi pi-moon'" />
      </button>
      <div class="user-chip">
        <span class="avatar">{{ initials }}</span>
        <div>
          <strong>{{ user?.name || 'Uzman' }}</strong>
          <small>{{ roleLabel }}</small>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ title?: string }>(), { title: 'Uzman Paneli' })
const route = useRoute()
const { user, impersonating, stopImpersonation } = useAuth()
const { roleLabel } = useAccount()
const { next: nextMenu, label: menuLabel } = useSidebarMode()
const isDark = ref(false)

const initials = computed(() => {
  const name = user.value?.name || 'UZ'
  return name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()
})

const applyTheme = () => {
  if (!import.meta.client) return
  document.documentElement.classList.toggle('dark-theme', isDark.value)
  localStorage.setItem('pktakip_theme', isDark.value ? 'dark' : 'light')
}

const toggleTheme = () => {
  isDark.value = !isDark.value
  applyTheme()
}

onMounted(() => {
  isDark.value = localStorage.getItem('pktakip_theme') === 'dark'
  applyTheme()
})
</script>

<style scoped>
/* Tasarım kataloğu: üst çubuk zeminin üstünde (ayrı bant yok); seçiciler, tema ve kullanıcı ayrı kartlar. */
.expert-topbar { min-height: 76px; display: flex; align-items: center; gap: 12px; padding: 14px 30px 0; }
.menu-toggle { flex: none; width: 44px; height: 44px; display: grid; place-items: center; border: 1px solid var(--admin-border); border-radius: 14px; background: var(--admin-card); color: var(--admin-heading); cursor: pointer; box-shadow: 0 6px 18px rgba(120, 90, 0, .06); }
.menu-toggle:hover { border-color: var(--pk-yellow); color: var(--pk-yellow-dark); }
.topbar-eyebrow { display: block; margin-bottom: 2px; color: var(--pk-yellow-dark); font-size: 10px; font-weight: 800; letter-spacing: .14em; }
.expert-topbar strong { color: var(--admin-heading); font-size: 15px; }
.topbar-actions { display: flex; align-items: center; gap: 12px; margin-left: auto; }
.theme-toggle { width: 44px; height: 44px; border: 1px solid var(--admin-border); border-radius: 14px; background: var(--admin-card); color: var(--admin-muted); cursor: pointer; box-shadow: 0 6px 18px rgba(120, 90, 0, .06); }
.theme-toggle:hover { color: var(--pk-yellow-dark); border-color: var(--pk-yellow); }
.return-button { display: inline-flex; align-items: center; gap: 7px; height: 38px; padding: 0 14px; border: 1px solid var(--pk-yellow); border-radius: 9px; background: var(--admin-accent-soft); color: var(--admin-accent-text); font: inherit; font-size: 12px; font-weight: 800; cursor: pointer; }
.return-button:hover { background: var(--pk-yellow); color: #111827; }
.user-chip { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 4px 14px 4px 4px; border: 1px solid var(--admin-border); border-radius: 999px; background: var(--admin-card); box-shadow: 0 6px 18px rgba(120, 90, 0, .06); }
.avatar { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 50%; background: var(--pk-yellow); color: #111827; font-size: 12px; font-weight: 800; }
.user-chip strong { display: block; font-size: 12px; }
.user-chip small { display: block; margin-top: 2px; color: var(--admin-muted); font-size: 10px; }
@media (max-width: 800px) { .expert-topbar { padding: 12px 16px 0; } }
</style>
