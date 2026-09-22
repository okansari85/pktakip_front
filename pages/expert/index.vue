<template>
  <div class="expert-dashboard">
    <div class="page-head">
      <div>
        <span class="eyebrow">Uzman Paneli</span>
        <h1>Hoş geldiniz, {{ user?.name }}</h1>
        <p>Periyodik kontrol süreçlerinizi tek merkezden yönetin.</p>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card"><span>Toplam Lokasyon</span><strong>—</strong></div>
      <div class="stat-card"><span>Yaklaşan Kontroller</span><strong>—</strong></div>
      <div class="stat-card"><span>Açık Bulgular</span><strong>—</strong></div>
      <div class="stat-card"><span>Geciken Kontroller</span><strong>—</strong></div>
    </div>

    <section class="welcome-card">
      <div class="welcome-icon"><i class="pi pi-shield" /></div>
      <div>
        <h2>Periyodik kontrollerinizi yönetin</h2>
        <p>Lokasyonlarınızı, ekipmanlarınızı, kontrollerinizi ve saha bulgularınızı bu panelden takip edebilirsiniz.</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'expert', middleware: 'expert' })

const { user } = useAuth()
</script>

<style scoped>
.expert-dashboard { max-width: 1500px; margin: 0 auto; }
.page-head { margin-bottom: 24px; }
.eyebrow { display: block; margin-bottom: 7px; color: var(--pk-yellow-dark); font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
.page-head h1 { margin: 0; color: var(--admin-heading); font-size: 30px; line-height: 1.15; letter-spacing: -.7px; }
.page-head p { margin: 7px 0 0; color: var(--admin-muted); font-size: 13px; }
.stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 24px; }
.stat-card { min-height: 120px; padding: 22px; display: flex; flex-direction: column; justify-content: space-between; background: var(--admin-card); border: 1px solid var(--admin-border); border-radius: 12px; }
.stat-card span { color: var(--admin-muted); font-size: 12px; }
.stat-card strong { color: var(--admin-heading); font-size: 28px; }
.welcome-card { display: flex; align-items: center; gap: 18px; padding: 26px; background: var(--admin-card); border: 1px solid var(--admin-border); border-radius: 12px; }
.welcome-icon { width: 52px; height: 52px; flex: 0 0 52px; display: grid; place-items: center; border-radius: 12px; background: rgba(255,193,7,.14); color: var(--pk-yellow-dark); font-size: 22px; }
.welcome-card h2 { margin: 0 0 7px; color: var(--admin-heading); font-size: 17px; }
.welcome-card p { margin: 0; color: var(--admin-muted); font-size: 13px; line-height: 1.6; }
@media (max-width: 900px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 550px) { .stats-grid { grid-template-columns: 1fr; } .welcome-card { align-items: flex-start; } }
</style>
