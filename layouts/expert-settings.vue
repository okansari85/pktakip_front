<template>
  <div class="expert-layout">
    <ExpertSidebar mode="settings" :collapsed="sidebarCollapsed" @toggle="sidebarCollapsed = !sidebarCollapsed" />
    <main class="main-area">
      <ExpertTopbar title="Ayarlar" />
      <div class="page-content"><slot /></div>
    </main>
  </div>
</template>

<script setup lang="ts">
const sidebarCollapsed = ref(false)
</script>

<style scoped>
.expert-layout { min-height: 100vh; display: flex; background: var(--admin-background); }
.main-area { min-width: 0; flex: 1; }
.page-content { padding: 30px 34px 40px; }
@media (max-width: 800px) {
  .expert-layout { display: block; }
  .page-content { padding: 20px 16px 30px; }
}
</style>
