<template>
  <div class="table-wrap">
    <PkTable :class="{ compact }">
      <thead>
        <tr><th>Tarih</th><th>Firma / Kurum</th><th>Lokasyon / Tesis</th><th v-if="!compact">Tür</th><th>Ekipman / Tesisat</th><th>Öncelik</th></tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.key" tabindex="0" @click="emit('select', row.date)" @keydown.enter="emit('select', row.date)">
          <td class="nowrap">{{ formatControlDate(row.date) }}</td>
          <td>{{ row.firm || '—' }}</td>
          <td>{{ row.location || '—' }}</td>
          <td v-if="!compact">{{ row.kind }}</td>
          <td>{{ row.item }}</td>
          <td><span class="priority" :class="priorityOf(row.days_left)?.tone">{{ priorityOf(row.days_left)?.priority }}</span></td>
        </tr>
        <tr v-if="!rows.length"><td :colspan="compact ? 5 : 6" class="empty">{{ empty }}</td></tr>
      </tbody>
    </PkTable>
  </div>
</template>

<script setup lang="ts">
import { formatControlDate, priorityOf, type ControlRow } from '~/composables/useControlBuckets'

defineProps<{ rows: ControlRow[]; empty: string; compact?: boolean }>()
const emit = defineEmits<{ select: [date: string] }>()
</script>

<style scoped>
.table-wrap { position: relative; overflow-x: auto; }
table { width: 100%; min-width: 520px; border-collapse: collapse; }
table.compact { min-width: 430px; }
table.compact th, table.compact td { padding-left: 7px; padding-right: 7px; font-size: 12.5px; }
th { padding: 12px 16px; background: rgba(145, 158, 171, .08); color: var(--admin-muted); font-size: 13px; font-weight: 600; text-align: left; white-space: nowrap; }
td { padding: 12px 16px; border-top: 1px solid rgba(145, 158, 171, .2); color: var(--admin-heading); font-size: 13px; }
tbody tr[tabindex] { cursor: pointer; }
tbody tr[tabindex]:hover, tbody tr[tabindex]:focus-visible { outline: 0; background: var(--admin-accent-soft); }
.nowrap { white-space: nowrap; }
.empty { padding: 24px 10px; color: var(--admin-muted); text-align: center; }
.priority { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 700; white-space: nowrap; }
.priority.blue, .priority.amber { background: var(--admin-danger-bg); color: var(--admin-danger-text); }
.priority.slate { background: var(--admin-warning-bg); color: var(--admin-warning-text); }
.priority.red { background: var(--pk-error-dark); color: #fff; }
</style>
