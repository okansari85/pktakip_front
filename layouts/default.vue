<template>
  <div class="admin-layout">
    <AdminSidebar />
    <main class="main-area">
      <AdminTopbar />
      <div class="page-content"><slot /></div>
    </main>
  </div>
</template>

<style scoped>
.admin-layout { min-height: 100vh; display: flex; background: var(--admin-background); }
.main-area { min-width: 0; flex: 1; }
.page-content { padding: 30px 34px 40px; }
@media (max-width: 800px) {
  .admin-layout { display: block; }
  .page-content { padding: 20px 16px 30px; }
}
</style>
