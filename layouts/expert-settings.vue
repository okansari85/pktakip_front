<template>
  <div class="expert-layout">
    <ExpertSidebar v-if="sidebarMode !== 'kapali'" mode="settings" :collapsed="sidebarMode === 'dar'" />
    <main class="main-area">
      <ExpertTopbar title="Ayarlar" />
      <div class="page-content"><slot /></div>
    </main>
  </div>
</template>

<script setup lang="ts">
// Sol menü: geniş / dar / kapalı (düğmesi üst çubukta).
const { mode: sidebarMode } = useSidebarMode()
</script>

<style scoped>
.expert-layout { min-height: 100vh; display: flex; background: var(--admin-backdrop); }
.main-area { min-width: 0; flex: 1; }
.page-content { padding: 32px 40px 48px; }
@media (max-width: 800px) {
  .expert-layout { display: block; }
  .page-content { padding: 20px 16px 30px; }
}
</style>
