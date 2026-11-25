<template>
  <div class="table-wrap">
    <PkTable>
      <thead><tr><th>Lokasyon</th><th>Toplam</th><th>Uygun</th><th>Uygun değil</th><th>Süresi geçmiş</th><th>60 gün içinde</th><th>Rapor yok</th><th class="bar-col">Dağılım</th></tr></thead>
      <tbody>
        <tr v-for="location in locations" :key="location.location_id" class="clickable" @click="setLocation(location.location_id)">
          <td><strong>{{ locationLabel(location.location_id, location.location_name) }}</strong></td>
          <td><strong>{{ location.total }}</strong></td>
          <td class="ok-text">{{ location.status.uygun || '—' }}</td>
          <td class="bad-text">{{ location.nonconforming || '—' }}</td>
          <td class="bad-text">{{ location.overdue || '—' }}</td>
          <td class="warn-text">{{ location.upcoming || '—' }}</td>
          <td>{{ location.no_report || '—' }}</td>
          <td class="bar-col">
            <div class="mini-bar"><span v-for="key in statusKeys" :key="key" :style="{ width: `${location.total ? (location.status[key] / location.total) * 100 : 0}%`, background: statusColors[key] }" :title="`${statusText[key]}: ${location.status[key]}`" /></div>
          </td>
        </tr>
      </tbody>
    </PkTable>
  </div>
</template>

<script setup lang="ts">
// Lokasyon başına ekipman durumu (en sorunlu üstte gelir): Genel Bakış (haritanın altı) ve Durum Raporu. Satıra tıklayınca
// o lokasyona iner.
defineProps<{ locations: any[] }>()

const { locationLabel, setLocation } = useDashboardScope()
const statusKeys = STATUS_KEYS
const statusText = STATUS_TEXT
const statusColors = STATUS_COLORS
</script>

<style scoped>
.table-wrap{overflow:auto}
table{width:100%;border-collapse:collapse}th,td{padding:12px 16px;text-align:left;border-bottom:1px solid rgba(145,158,171,.2);font-size:13px;color:var(--admin-text);vertical-align:top}
th{border-bottom:0;font-size:13px;font-weight:600;color:var(--admin-muted);background:rgba(145,158,171,.08);white-space:nowrap}
td strong{color:var(--admin-heading)}
tr.clickable{cursor:pointer}tr.clickable:hover{background:var(--admin-hover)}
.ok-text{color:var(--admin-success-text);font-weight:700}.bad-text{color:var(--admin-danger-text);font-weight:700}.warn-text{color:var(--admin-warning-text);font-weight:700}
.bar-col{width:180px}
.mini-bar{display:flex;height:10px;border-radius:999px;overflow:hidden;background:var(--admin-chip)}.mini-bar span{display:block;height:100%}
</style>
