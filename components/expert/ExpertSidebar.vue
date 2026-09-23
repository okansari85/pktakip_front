<template>
  <aside class="expert-sidebar" :class="{ collapsed }">
    <div class="sidebar-brand">
      <span class="brand-icon">✓</span>
      <div v-if="!collapsed">
        <strong><span>PK</span>Takip</strong>
        <small>Periyodik Kontrol Takip</small>
      </div>
    </div>

    <button class="collapse-button" type="button" :aria-label="collapsed ? 'Menüyü aç' : 'Menüyü daralt'" @click="emit('toggle')">
      <i :class="collapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'" />
      <span v-if="!collapsed">Menüyü daralt</span>
    </button>

    <div v-if="!collapsed" class="sidebar-label">UZMAN PANELİ</div>
    <nav class="sidebar-nav">
      <NuxtLink to="/expert" class="sidebar-link" :title="collapsed ? 'Genel Bakış' : undefined">
        <i class="pi pi-home" />
        <span v-if="!collapsed">Genel Bakış</span>
      </NuxtLink>
      <NuxtLink to="/expert/customers" class="sidebar-link" :title="collapsed ? 'Müşteriler' : undefined">
        <i class="pi pi-users" />
        <span v-if="!collapsed">Müşteriler</span>
      </NuxtLink>
      <NuxtLink to="/expert/locations" class="sidebar-link" :title="collapsed ? 'Lokasyonlar' : undefined">
        <i class="pi pi-map-marker" />
        <span v-if="!collapsed">Lokasyonlar</span>
      </NuxtLink>
      <a href="#" class="sidebar-link" @click.prevent>
        <i class="pi pi-wrench" />
        <span v-if="!collapsed">Ekipmanlar</span>
      </a>
      <a href="#" class="sidebar-link" @click.prevent>
        <i class="pi pi-calendar" />
        <span v-if="!collapsed">Kontroller</span>
      </a>
    </nav>

    <div class="sidebar-bottom">
      <div v-if="!collapsed" class="expert-badge"><i class="pi pi-user" /><span>Uzman</span></div>
      <button class="logout-link" type="button" :title="collapsed ? 'Çıkış Yap' : undefined" @click="logout">
        <i class="pi pi-sign-out" />
        <span v-if="!collapsed">Çıkış Yap</span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ collapsed?: boolean }>(), { collapsed: false })
const emit = defineEmits<{ toggle: [] }>()
const { logout } = useAuth()
</script>

<style scoped>
.expert-sidebar { width: 250px; min-height: 100vh; padding: 22px 14px; display: flex; flex-direction: column; flex-shrink: 0; background: var(--admin-sidebar); color: var(--admin-sidebar-text); border-right: 1px solid var(--admin-sidebar-border); transition: width .2s ease, padding .2s ease; }
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
.sidebar-bottom { margin-top: auto; display: grid; gap: 8px; padding: 14px 8px 4px; border-top: 1px solid var(--admin-sidebar-border); }
.expert-badge, .logout-link { display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 0 10px; color: var(--admin-sidebar-muted); font-size: 12px; }
.logout-link { width: 100%; border: 0; background: transparent; cursor: pointer; text-align: left; border-radius: 8px; }
.collapsed .logout-link { justify-content: center; padding: 0; }
.logout-link:hover { background: var(--admin-sidebar-hover); color: #fff; }
@media (max-width: 800px) { .expert-sidebar { width: 100%; min-height: auto; } .expert-sidebar.collapsed { width: 100%; } }
</style>
