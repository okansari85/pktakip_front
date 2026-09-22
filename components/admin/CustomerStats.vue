<template>
  <section class="stats-grid">
    <div class="stat-card">
      <span class="stat-icon"><i class="pi pi-users" /></span>
      <div><small>Toplam Uzman</small><strong>{{ total }}</strong></div>
    </div>
    <div class="stat-card">
      <span class="stat-icon success"><i class="pi pi-check-circle" /></span>
      <div><small>Aktif</small><strong>{{ active }}</strong></div>
    </div>
    <div class="stat-card">
      <span class="stat-icon muted"><i class="pi pi-ban" /></span>
      <div><small>Pasif</small><strong>{{ inactive }}</strong></div>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ total: number; active: number; inactive: number }>()
</script>

<style scoped>
.stats-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin: 0 0 22px; }
.stat-card { min-height: 96px; display: flex; align-items: center; gap: 14px; padding: 18px; border: 1px solid var(--admin-border); border-radius: 12px; background: var(--admin-card); box-shadow: 0 1px 2px rgba(15, 23, 42, .03); }
.stat-icon { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 10px; background: #fff5cc; color: #c88c00; }
.stat-icon.success { background: #e8f8ef; color: #16a34a; }
.stat-icon.muted { background: var(--admin-soft); color: var(--admin-muted); }
.stat-card small { display: block; color: var(--admin-muted); font-size: 11px; }
.stat-card strong { display: block; margin-top: 5px; color: var(--admin-heading); font-size: 24px; line-height: 1; }
@media (max-width: 800px) { .stats-grid { grid-template-columns: 1fr; } }
</style>
