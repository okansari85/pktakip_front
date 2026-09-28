<template>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Ekipman</th><th>Lokasyon / konum</th><th>Son durum</th><th>Gelecek kontrol</th><th>Kalan gün</th></tr></thead>
      <tbody>
        <tr v-for="item in shown" :key="item.id" @click="navigateTo(`/expert/equipment/${item.id}`)">
          <td><strong>{{ item.type }}</strong><small>{{ [item.code && `no ${item.code}`, item.variant].filter(Boolean).join(' · ') || '—' }}</small></td>
          <td><span>{{ locationLabel(item.location_id, item.location_name) }}</span><small>{{ [item.workplace, item.place].filter(Boolean).join(' · ') || 'Lokasyon geneli' }}</small></td>
          <td><span class="status-badge" :class="item.status">{{ statusText[item.status] || item.status }}</span></td>
          <td>{{ formatDate(item.next_control_date) }}</td>
          <td><span class="days" :class="item.days_left < 0 ? 'overdue' : 'soon'">{{ daysText(item.days_left) }}</span></td>
        </tr>
      </tbody>
    </table>
    <button v-if="limit && items.length > shown.length" class="more" type="button" @click="expanded = true">Tümünü göster ({{ items.length }})</button>
  </div>
</template>

<script setup lang="ts">
// Genel Bakış / Durum Raporu: kontrolü yaklaşan, geciken ya da uygun olmayan ekipman listesi; satır ekipmana gider.
const props = defineProps<{ items: any[]; limit?: number }>()

const { locationLabel } = useDashboardScope()
const statusText = STATUS_TEXT
const expanded = ref(false)
const shown = computed(() => props.limit && !expanded.value ? props.items.slice(0, props.limit) : props.items)
watch(() => props.items, () => { expanded.value = false })

const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('tr-TR').format(new Date(value)) : '—'
const daysText = (days: number | null) => days === null || days === undefined ? '—' : days < 0 ? `${-days} gün geçti` : days === 0 ? 'Bugün' : `${days} gün`
</script>

<style scoped>
.table-wrap{overflow:auto}
table{width:100%;border-collapse:collapse}th,td{padding:9px 12px;text-align:left;border-bottom:1px solid var(--admin-row-border);font-size:12px;color:var(--admin-text);vertical-align:top}
th{font-size:11px;font-weight:700;color:var(--admin-muted);background:var(--admin-soft);white-space:nowrap}
tbody tr{cursor:pointer}tbody tr:hover{background:var(--admin-hover)}
td strong{display:block;color:var(--admin-heading)}td small{display:block;margin-top:2px;color:var(--admin-muted);font-size:11px}
.status-badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap;background:var(--admin-chip);color:var(--admin-muted)}
.status-badge.uygun{background:var(--admin-success-bg);color:var(--admin-success-text)}.status-badge.uygun_degil{background:var(--admin-danger-bg);color:var(--admin-danger-text)}.status-badge.rapor_bekleniyor{background:var(--admin-warning-bg);color:var(--admin-warning-text)}
.days{font-weight:700;white-space:nowrap}.days.overdue{color:var(--admin-danger-text)}.days.soon{color:var(--admin-warning-text)}
.more{margin-top:8px;border:0;background:none;color:var(--admin-link);font:inherit;font-size:12px;font-weight:700;cursor:pointer}
</style>
