<template>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Tür</th><th>Kategori</th><th>Toplam</th><th>Uygun</th><th>Uygun değil</th><th>Belirtilmemiş</th><th>Rapor bekleniyor</th><th>Rapor yok</th><th>Süresi geçmiş</th><th>60 gün içinde</th><th class="bar-col">Uygun oranı</th></tr></thead>
      <tbody>
        <tr v-for="type in types" :key="type.type_id">
          <td><strong>{{ type.name }}</strong></td>
          <td class="muted">{{ type.category }}</td>
          <td><strong>{{ type.total }}</strong></td>
          <td class="ok-text">{{ type.status.uygun || '—' }}</td>
          <td class="bad-text">{{ type.status.uygun_degil || '—' }}</td>
          <td>{{ type.status.belirtilmemis || '—' }}</td>
          <td>{{ type.status.rapor_bekleniyor || '—' }}</td>
          <td>{{ type.status.rapor_yok || '—' }}</td>
          <td class="bad-text">{{ type.overdue || '—' }}</td>
          <td class="warn-text">{{ type.upcoming || '—' }}</td>
          <!-- Yüzde kaçı uygun: ilerleme çubuğu ve oran (%90+ yeşil, %70+ turuncu, altı kırmızı) -->
          <td class="bar-col">
            <div class="ratio">
              <div class="ratio-bar"><i :class="levelOf(shareOf(type.status.uygun, type.total))" :style="{ width: `${shareOf(type.status.uygun, type.total)}%` }" /></div>
              <strong :class="levelOf(shareOf(type.status.uygun, type.total))">%{{ percentText(shareOf(type.status.uygun, type.total)) }}</strong>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
// Ekipman türleri tablosu (Durum Raporu'ndaki "Ekipman türleri" tablosuyla aynı): tür başına son kontrol durumu, süresi
// geçmiş / 60 gün içinde ve uygun oranı. Veri pk-dashboard/report yanıtının types listesi.
defineProps<{ types: any[] }>()

// Yüzde kaçı uygun: tek haneli, aşağı yuvarlanmış; renk eşikleri %90 / %70.
const shareOf = (value: number, total: number) => total ? Math.floor(((value || 0) / total) * 1000) / 10 : 0
const percentText = (value: number) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(value)
const levelOf = (value: number) => value >= 90 ? 'ok' : value >= 70 ? 'warn' : 'bad'
</script>

<style scoped>
.table-wrap{overflow:auto}
table{width:100%;border-collapse:collapse}th,td{padding:9px 12px;text-align:left;border-bottom:1px solid var(--admin-row-border);font-size:12px;color:var(--admin-text);vertical-align:top}
th{font-size:11px;font-weight:700;color:var(--admin-muted);background:var(--admin-soft);white-space:nowrap}
td strong{color:var(--admin-heading)}
.ok-text{color:var(--admin-success-text);font-weight:700}.bad-text{color:var(--admin-danger-text);font-weight:700}.warn-text{color:var(--admin-warning-text);font-weight:700}.muted{color:var(--admin-muted)}
.bar-col{width:180px}
.ratio{display:flex;align-items:center;gap:8px}
.ratio-bar{flex:1;height:8px;border-radius:999px;overflow:hidden;background:var(--admin-chip)}.ratio-bar i{display:block;height:100%;border-radius:999px}
.ratio-bar i.ok{background:#16a34a}.ratio-bar i.warn{background:#d97706}.ratio-bar i.bad{background:#dc2626}
.ratio strong{min-width:44px;text-align:right;font-size:12px}.ratio strong.ok{color:#16a34a}.ratio strong.warn{color:#d97706}.ratio strong.bad{color:#dc2626}
</style>
