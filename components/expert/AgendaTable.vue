<template>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Tarih</th><th>Lokasyon</th><th>Kontroller</th><th>Kalan gün</th></tr></thead>
      <tbody>
        <tr v-for="entry in shown" :key="`${entry.date}|${entry.location_id}`" @click="emit('select', entry.date)">
          <td class="nowrap">{{ formatDate(entry.date) }}</td>
          <td>{{ locationLabel(entry.location_id, entry.location_name) }}</td>
          <td><strong>{{ entryText(entry) }}</strong></td>
          <td><span class="days" :class="timingOf(entry.days_left)">{{ daysText(entry.days_left) }}</span></td>
        </tr>
      </tbody>
    </table>
    <button v-if="limit && entries.length > shown.length" class="more" type="button" @click="expanded = true">Tümünü göster ({{ entries.length }})</button>
  </div>
</template>

<script setup lang="ts">
// Genel Bakış: kontrol günleri tablosu (gün + lokasyon başına gruplu: "3 Forklift, 2 Transpalet"; tesisat ve tüpler tek
// kalem). Satıra tıklanınca o günün penceresi açılır (select).
const props = defineProps<{ entries: AgendaEntry[]; limit?: number }>()
const emit = defineEmits<{ select: [date: string] }>()

const { locationLabel } = useDashboardScope()
const timingOf = agendaTiming
const entryText = (entry: AgendaEntry) => agendaGroupsText([entry])
const formatDate = (value: string) => new Intl.DateTimeFormat('tr-TR').format(agendaDate(value))
const daysText = (days: number) => days < 0 ? `${-days} gün geçti` : days === 0 ? 'Bugün' : `${days} gün`

const expanded = ref(false)
const shown = computed(() => props.limit && !expanded.value ? props.entries.slice(0, props.limit) : props.entries)
watch(() => props.entries, () => { expanded.value = false })
</script>

<style scoped>
.table-wrap{overflow:auto}
table{width:100%;border-collapse:collapse}th,td{padding:9px 12px;text-align:left;border-bottom:1px solid var(--admin-row-border);font-size:12px;color:var(--admin-text);vertical-align:top}
th{font-size:11px;font-weight:700;color:var(--admin-muted);background:var(--admin-soft);white-space:nowrap}
tbody tr{cursor:pointer}tbody tr:hover{background:var(--admin-hover)}
td strong{color:var(--admin-heading)}.nowrap{white-space:nowrap}
.days{font-weight:700;white-space:nowrap}.days.overdue{color:var(--admin-danger-text)}.days.d30,.days.d60{color:var(--admin-upcoming-text)}.days.later{color:var(--admin-success-text)}
.more{margin-top:8px;border:0;background:none;color:var(--admin-link);font:inherit;font-size:12px;font-weight:700;cursor:pointer}
</style>
