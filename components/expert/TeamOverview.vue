<template>
  <div class="team-overview">
    <div v-if="loading && !data" class="card state"><i class="pi pi-spin pi-spinner" /> Uzman özeti hazırlanıyor...</div>
    <div v-else-if="error" class="card state error-text">{{ error }}</div>
    <template v-else-if="data">
      <!-- Uzman bazında PK durumu: atandığı firmalar ve o lokasyonların lokasyon geneli ekipmanı -->
      <section class="card list-card">
        <header>
          <div><h3>Uzmanlar</h3><small>Uzman bazında PK durumu (yüzde kaçı tamam): atandığı firmaların ve o lokasyonların lokasyon geneli ekipmanı; en çok süresi geçmiş üstte.</small></div>
          <NuxtLink v-if="isManager" class="link-button" to="/expert/settings/users">Kullanıcılar <i class="pi pi-arrow-right" /></NuxtLink>
        </header>
        <p v-if="!data.experts.length" class="muted pad">Hesapta aktif uzman yok.</p>
        <div v-for="row in data.experts" :key="row.id" class="location-row static">
          <span class="location-name"><strong>{{ row.name }}</strong><small>{{ row.workplaces }} firma · {{ row.locations }} lokasyon · {{ row.score.total }} ekipman</small></span>
          <template v-if="row.score.total">
            <div class="progress-bar"><i :class="levelOf(row.score.percent)" :style="{ width: `${row.score.percent ?? 0}%` }" /></div>
            <strong class="location-percent" :class="levelOf(row.score.percent)">%{{ percentText(row.score.percent) }}</strong>
            <small class="location-detail">{{ row.score.ok }} / {{ row.score.total }} tamam<template v-if="row.score.overdue"> · {{ row.score.overdue }} süresi geçmiş</template><template v-if="row.score.nonconforming"> · {{ row.score.nonconforming }} uygun değil</template></small>
          </template>
          <span v-else class="location-empty">{{ row.workplaces ? 'Ekipman yok' : 'Firma atanmamış' }}</span>
        </div>
      </section>

      <div class="grid two">
        <!-- Uzmanı olmayan firmalar -->
        <section class="card list-card">
          <header>
            <div><h3>Uzmanı olmayan firmalar</h3><small>Kimseye atanmamış firmalar; Firmalar sayfasından uzman atanır.</small></div>
            <NuxtLink class="link-button" to="/expert/settings/companies">Uzman ata <i class="pi pi-arrow-right" /></NuxtLink>
          </header>
          <p v-if="!data.unassigned.length" class="muted pad">Bütün firmaların uzmanı var.</p>
          <div v-for="item in data.unassigned" :key="item.id" class="line">
            <span class="dot warn" />
            <span class="line-main"><strong>{{ item.company_name }}</strong><small>{{ [corporate ? null : item.customer_name, item.location_name].filter(Boolean).join(' · ') }}</small></span>
          </div>
        </section>

        <!-- Bu ayki rapor okumaları (kontür bunlardan düşülecek) -->
        <section class="card list-card">
          <header><div><h3>Bu ay okunan raporlar</h3><small>{{ monthText }} · kullanıcı bazında (başarısız okumalar sayılmaz)</small></div><strong class="total">{{ data.usage.total }}</strong></header>
          <p v-if="!data.usage.users.length" class="muted pad">Bu ay rapor okunmadı.</p>
          <div v-for="item in data.usage.users" :key="item.id" class="line">
            <span class="line-main"><strong>{{ item.name }}</strong><small>{{ roleLabels[item.role] || '' }}</small></span>
            <span class="line-meta">{{ item.total }} okuma</span>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// Genel Bakış → Uzmanlar sekmesi (OSGB / kurumsal hesabın yöneticisi ve operasyon yöneticisi): uzman bazında durum, uzmanı
// olmayan firmalar, bu ayki rapor okumaları.
const props = defineProps<{ data: any; loading?: boolean; error?: string }>()

const { isManager, corporate } = useAccount()
const roleLabels = ACCOUNT_ROLE_LABELS
const levelOf = (percent?: number | null) => (percent ?? 0) >= 90 ? 'ok' : (percent ?? 0) >= 70 ? 'warn' : 'bad'
const percentText = (value?: number | null) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(value ?? 0)
const monthText = computed(() => props.data?.usage?.month
  ? new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(new Date(`${props.data.usage.month}-01T00:00:00`))
  : '')
</script>

<style scoped>
.team-overview{display:grid;gap:16px}
.card{background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px;min-width:0}
.state{display:flex;align-items:center;justify-content:center;gap:8px;padding:60px 20px;color:var(--admin-muted);font-size:13px}.error-text{color:var(--admin-danger-text)}
.list-card{padding:16px 18px}
.list-card header{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px}
h3{margin:0;color:var(--admin-heading);font-size:15px}header small{display:block;margin-top:3px;color:var(--admin-muted);font-size:12px}
.total{color:var(--admin-heading);font-size:24px}
.grid.two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.location-row{display:grid;grid-template-columns:minmax(220px,1.3fr) minmax(120px,2fr) 64px minmax(180px,1.2fr);align-items:center;gap:14px;padding:10px 8px;border-top:1px solid var(--admin-row-border)}
.location-name{display:flex;flex-direction:column;gap:2px;min-width:0}.location-name strong{color:var(--admin-heading);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.location-name small{color:var(--admin-muted);font-size:11px}
.location-percent{text-align:right;font-size:16px}.location-percent.ok{color:#16a34a}.location-percent.warn{color:#d97706}.location-percent.bad{color:#dc2626}
.location-detail{color:var(--admin-muted);font-size:11px}.location-empty{grid-column:2 / -1;color:var(--admin-muted);font-size:12px}
.progress-bar{height:10px;border-radius:999px;background:var(--admin-chip);overflow:hidden}.progress-bar i{display:block;height:100%;border-radius:999px}
.progress-bar i.ok{background:#16a34a}.progress-bar i.warn{background:#d97706}.progress-bar i.bad{background:#dc2626}
.line{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--admin-row-border)}
.line-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.line-main strong{color:var(--admin-heading);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.line-main small{color:var(--admin-muted);font-size:11px}
.line-meta{color:var(--admin-muted);font-size:12px;white-space:nowrap}
.dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;background:var(--admin-muted)}.dot.warn{background:#f59e0b}
.link-button{display:inline-flex;align-items:center;gap:6px;color:var(--admin-link);font-size:12px;font-weight:700;text-decoration:none}
.muted{margin:0;color:var(--admin-muted);font-size:12px}.pad{padding:10px 0}
@media(max-width:900px){.grid.two{grid-template-columns:1fr}.location-row{grid-template-columns:1fr 64px}.location-row .progress-bar,.location-detail{grid-column:1 / -1}}
</style>
