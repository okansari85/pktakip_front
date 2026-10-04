<template>
  <!-- Paketim: kalan kredi ve ekipman doluluğu (salt okunur; satın alma ödeme adımında gelir) -->
  <div v-if="status" class="credit-summary" :class="{ compact }">
    <div v-if="status.unlimited" class="row">
      <span class="label">Paket</span><strong>Sınırsız</strong>
    </div>
    <template v-else>
      <div class="row">
        <span class="label">{{ status.package?.name || MODE_LABELS[status.mode] }}</span>
        <strong :class="{ empty: (status.credits ?? 0) <= 0 }">{{ status.credits ?? 0 }} kredi</strong>
      </div>
      <template v-if="status.equipment_limit !== null && status.equipment_limit !== undefined">
        <div class="row">
          <span class="label">Ekipman</span>
          <strong :class="{ empty: (status.active_equipment ?? 0) >= status.equipment_limit }">{{ status.active_equipment ?? 0 }} / {{ status.equipment_limit }}</strong>
        </div>
        <div class="bar"><span :style="{ width: `${equipmentPercent}%` }" /></div>
      </template>
      <small v-if="!compact && status.mode === 'package' && status.next_grant_at">Sıradaki yükleme {{ formatDate(status.next_grant_at) }} · +{{ status.monthly_credits }} kredi</small>
    </template>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
const { status, load } = useBilling()
const equipmentPercent = computed(() => {
  const limit = status.value?.equipment_limit
  return limit ? Math.min(100, Math.round((status.value?.active_equipment ?? 0) / limit * 100)) : 100
})
const formatDate = (value: string) => new Intl.DateTimeFormat('tr-TR').format(new Date(value))
onMounted(load)
</script>

<style scoped>
.credit-summary{display:grid;gap:6px;padding:12px 14px;border:1px solid var(--admin-border);border-radius:10px;background:var(--admin-card);font-size:12px}
.row{display:flex;align-items:center;justify-content:space-between;gap:10px}
.label{color:var(--admin-muted);font-size:11px}
strong{color:var(--admin-heading);font-size:14px}strong.empty{color:var(--admin-danger-text)}
small{color:var(--admin-muted);font-size:11px}
.bar{height:4px;border-radius:999px;background:var(--admin-border);overflow:hidden}.bar span{display:block;height:100%;background:var(--pk-yellow)}
.credit-summary.compact{padding:9px 10px;gap:5px;background:transparent;border-color:var(--admin-sidebar-border)}
.credit-summary.compact .label{color:var(--admin-sidebar-muted)}
.credit-summary.compact strong{font-size:12px;color:var(--admin-sidebar-text, var(--admin-heading))}
.credit-summary.compact strong.empty{color:var(--admin-danger-text)}
.credit-summary.compact .bar{background:var(--admin-sidebar-border)}
</style>
