<template>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Tür</th><th>Kategori</th><th>Toplam</th><th>Uygun</th><th>Uygun değil</th><th v-for="[key, label] in optionalStatus" :key="key">{{ label }}</th><th>Süresi geçmiş</th><th>60 gün içinde</th><th class="bar-col">Uygun oranı</th></tr></thead>
      <tbody>
        <tr v-for="type in types" :key="type.type_id">
          <td><strong>{{ type.name }}</strong></td>
          <td class="muted">{{ type.category }}</td>
          <td><strong>{{ type.total }}</strong></td>
          <td class="ok-text">{{ type.status.uygun || '—' }}</td>
          <td class="bad-text">{{ type.status.uygun_degil || '—' }}</td>
          <td v-for="[key] in optionalStatus" :key="key">{{ type.status[key] || '—' }}</td>
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
const props = defineProps<{ types: any[] }>()
// Belirtilmemiş / Rapor bekleniyor / Rapor yok: hiçbir satırda değeri yoksa sütun gösterilmez (veri gelince görünür).
const OPTIONAL_STATUS = [['belirtilmemis', 'Belirtilmemiş'], ['rapor_bekleniyor', 'Rapor bekleniyor'], ['rapor_yok', 'Rapor yok']] as const
const optionalStatus = computed(() => OPTIONAL_STATUS.filter(([key]) => props.types.some(type => type.status?.[key])))

// Yüzde kaçı uygun: tek haneli, aşağı yuvarlanmış; renk eşikleri %90 / %70.
const shareOf = (value: number, total: number) => total ? Math.floor(((value || 0) / total) * 1000) / 10 : 0
const percentText = (value: number) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(value)
const levelOf = (value: number) => value >= 90 ? 'ok' : value >= 70 ? 'warn' : 'bad'
</script>

<style scoped>
.table-wrap{overflow:auto}
table{width:100%;border-collapse:collapse}th,td{padding:12px 16px;text-align:left;border-bottom:1px solid rgba(145,158,171,.2);font-size:13px;color:var(--admin-text);vertical-align:top}
th{border-bottom:0;font-size:13px;font-weight:600;color:var(--admin-muted);background:rgba(145,158,171,.08);white-space:nowrap}
td strong{color:var(--admin-heading)}
.ok-text{color:var(--admin-success-text);font-weight:700}.bad-text{color:var(--admin-danger-text);font-weight:700}.warn-text{color:var(--admin-warning-text);font-weight:700}.muted{color:var(--admin-muted)}
.bar-col{width:180px}
.ratio{display:flex;align-items:center;gap:8px}
.ratio-bar{flex:1;height:8px;border-radius:999px;overflow:hidden;background:var(--admin-chip)}.ratio-bar i{display:block;height:100%;border-radius:999px}
.ratio-bar i.ok{background:var(--pk-success-main)}.ratio-bar i.warn{background:var(--pk-warning)}.ratio-bar i.bad{background:var(--pk-error)}
.ratio strong{min-width:44px;text-align:right;font-size:13px}.ratio strong.ok{color:var(--admin-success-text)}.ratio strong.warn{color:var(--admin-warning-text)}.ratio strong.bad{color:var(--admin-danger-text)}
</style>
