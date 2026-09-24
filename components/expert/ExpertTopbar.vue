<template>
  <header class="expert-topbar">
    <ExpertWorkplaceSwitcher v-if="!title.startsWith('Ayarlar')" />
    <div v-else />

    <div class="topbar-actions">
      <button class="theme-toggle" type="button" :aria-label="isDark ? 'Açık temaya geç' : 'Koyu temaya geç'" @click="toggleTheme">
        <i :class="isDark ? 'pi pi-sun' : 'pi pi-moon'" />
      </button>
      <div class="user-chip">
        <span class="avatar">{{ initials }}</span>
        <div>
          <strong>{{ user?.name || 'Uzman' }}</strong>
          <small>Uzman</small>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ title?: string }>(), { title: 'Uzman Paneli' })
const { user } = useAuth()
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
.expert-topbar { min-height: 72px; display: flex; align-items: center; justify-content: space-between; padding: 0 30px; background: var(--admin-surface); border-bottom: 1px solid var(--admin-border); }
.topbar-eyebrow { display: block; margin-bottom: 2px; color: var(--pk-yellow-dark); font-size: 10px; font-weight: 800; letter-spacing: .14em; }
.expert-topbar strong { color: var(--admin-heading); font-size: 15px; }
.topbar-actions { display: flex; align-items: center; gap: 14px; }
.theme-toggle { width: 38px; height: 38px; border: 1px solid var(--admin-border); border-radius: 9px; background: var(--admin-card); color: var(--admin-muted); cursor: pointer; }
.theme-toggle:hover { color: var(--pk-yellow-dark); border-color: var(--pk-yellow); }
.user-chip { display: flex; align-items: center; gap: 9px; }
.avatar { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 50%; background: var(--pk-yellow); color: #111827; font-size: 12px; font-weight: 800; }
.user-chip strong { display: block; font-size: 12px; }
.user-chip small { display: block; margin-top: 2px; color: var(--admin-muted); font-size: 10px; }
</style>
