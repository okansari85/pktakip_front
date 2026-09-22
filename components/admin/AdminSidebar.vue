<template>
  <aside class="admin-sidebar">
    <div class="sidebar-brand">
      <span class="brand-icon">✓</span>
      <div>
        <strong><span>PK</span>Takip</strong>
        <small>Periyodik Kontrol Takip</small>
      </div>
    </div>

    <div class="sidebar-label">YÖNETİM</div>
    <nav class="sidebar-nav">
      <NuxtLink to="/customers" class="sidebar-link">
        <i class="pi pi-users" />
        <span>Müşteriler</span>
      </NuxtLink>
    </nav>

    <div class="sidebar-bottom">
      <div class="admin-badge"><i class="pi pi-shield" /><span>Süper Admin</span></div>
      <button class="logout-link" type="button" @click="logout">
        <i class="pi pi-sign-out" />
        <span>Çıkış Yap</span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
const { logout } = useAuth()
</script>

<style scoped>
.admin-sidebar { width: 250px; min-height: 100vh; padding: 22px 14px; display: flex; flex-direction: column; background: var(--admin-sidebar); color: var(--admin-sidebar-text); border-right: 1px solid var(--admin-sidebar-border); }
.sidebar-brand { display: flex; align-items: center; gap: 11px; padding: 4px 10px 28px; }
.brand-icon { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 11px; background: var(--pk-yellow); color: #111827; font-size: 25px; font-weight: 800; }
.sidebar-brand strong { display: block; font-size: 20px; letter-spacing: -.5px; color: #fff; }
.sidebar-brand strong span { color: var(--pk-yellow); }
.sidebar-brand small { display: block; margin-top: 2px; color: var(--admin-sidebar-muted); font-size: 10px; }
.sidebar-label { padding: 0 12px 8px; color: var(--admin-sidebar-muted); font-size: 10px; font-weight: 700; letter-spacing: .12em; }
.sidebar-nav { display: grid; gap: 5px; }
.sidebar-link { display: flex; align-items: center; gap: 11px; min-height: 44px; padding: 0 13px; border-radius: 9px; color: var(--admin-sidebar-text); transition: .15s ease; }
.sidebar-link:hover { background: var(--admin-sidebar-hover); color: #fff; }
.sidebar-link.router-link-active { background: var(--pk-yellow); color: #111827; font-weight: 700; }
.sidebar-bottom { margin-top: auto; display: grid; gap: 8px; padding: 14px 8px 4px; border-top: 1px solid var(--admin-sidebar-border); }
.admin-badge, .logout-link { display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 0 10px; color: var(--admin-sidebar-muted); font-size: 12px; }
.logout-link { width: 100%; border: 0; background: transparent; cursor: pointer; text-align: left; border-radius: 8px; }
.logout-link:hover { background: var(--admin-sidebar-hover); color: #fff; }
</style>
