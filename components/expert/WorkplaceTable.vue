<template>
  <section class="table-card">
    <div class="toolbar">
      <label class="field">
        <span>Müşteri</span>
        <select v-model="customerFilter">
          <option :value="null">Tüm müşteriler</option>
          <option v-for="name in customerNames" :key="name" :value="name">{{ name }}</option>
        </select>
      </label>
      <label class="field">
        <span>Tehlike Sınıfı</span>
        <select v-model="hazardFilter">
          <option :value="null">Tümü</option>
          <option v-for="hazard in HAZARD_CLASSES" :key="hazard" :value="hazard">{{ hazard }}</option>
        </select>
      </label>
      <label class="field">
        <span>Ara</span>
        <div class="search-box"><i class="pi pi-search" /><input v-model="search" type="text" placeholder="Firma, lokasyon, NACE veya SGK no" /></div>
      </label>
    </div>

    <div v-if="loading" class="state-row">İşyerleri yükleniyor...</div>
    <div v-else-if="error" class="state-row error-state">{{ error }}</div>
    <div v-else-if="filtered.length === 0" class="state-row empty-state">
      <i class="pi pi-map-marker" />
      <strong>İşyeri bulunmuyor</strong>
      <slot name="empty"><span>Aramanızla eşleşen işyeri yok.</span></slot>
    </div>
    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Firma</th>
            <th>Müşteri</th>
            <th>Lokasyon</th>
            <th>NACE</th>
            <th>Tehlike Sınıfı</th>
            <th>SGK Sicil No</th>
            <th>Uzman</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in filtered" :key="item.id">
            <td><div class="name-cell"><span class="row-icon"><i class="pi pi-briefcase" /></span><strong>{{ item.company_name }}</strong></div></td>
            <td>{{ item.customer_name || '—' }}</td>
            <td><div class="stacked"><strong>{{ item.location_name }}</strong><small v-if="item.organization_name">{{ item.organization_name }}</small></div></td>
            <td>
              <div v-if="item.nace_code" class="stacked"><strong>{{ item.nace_code }}</strong><small class="activity" :title="item.activity || ''">{{ item.activity }}</small></div>
              <span v-else>—</span>
            </td>
            <td><span class="hazard-badge" :class="hazardClassKey(item.hazard_class)">{{ item.hazard_class }}</span></td>
            <td>{{ item.sgk_workplace_number || '—' }}</td>
            <td>{{ item.experts?.join(', ') || '—' }}</td>
          </tr>
        </tbody>
      </table>
      <div class="table-footer"><span>Toplam {{ filtered.length }} işyeri</span></div>
    </div>
  </section>
</template>

<script setup lang="ts">
interface WorkplaceRow { id: number; company_name: string; customer_name?: string | null; location_name?: string | null; organization_name?: string | null; nace_code?: string | null; activity?: string | null; hazard_class: string; sgk_workplace_number?: string | null; experts?: string[] }

const props = defineProps<{ workplaces: WorkplaceRow[]; loading?: boolean; error?: string }>()

const search = ref('')
const customerFilter = ref<string | null>(null)
const hazardFilter = ref<string | null>(null)
const trLower = (value?: string | null) => (value || '').toLocaleLowerCase('tr-TR')

const customerNames = computed(() => [...new Set(props.workplaces.map(w => w.customer_name).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'tr')))

const filtered = computed(() => {
  const q = trLower(search.value.trim())
  return props.workplaces.filter(w =>
    (!customerFilter.value || w.customer_name === customerFilter.value) &&
    (!hazardFilter.value || w.hazard_class === hazardFilter.value) &&
    (!q || [w.company_name, w.location_name, w.nace_code, w.sgk_workplace_number, w.activity].some(v => trLower(v).includes(q)))
  )
})
</script>

<style scoped>
.table-card{background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px;overflow:hidden}
.toolbar{padding:18px 16px;border-bottom:1px solid var(--admin-border);display:grid;grid-template-columns:minmax(180px,240px) minmax(160px,200px) 1fr;gap:12px;align-items:start}
.field{display:flex;flex-direction:column;gap:6px;margin:0;font-size:11px;font-weight:700;color:var(--admin-muted)}
.field select{box-sizing:border-box;height:42px;margin:0;padding:0 10px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:13px;outline:0}
.search-box{box-sizing:border-box;height:42px;display:flex;align-items:center;gap:10px;padding:0 12px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-muted)}.search-box input{width:100%;border:0;outline:0;background:transparent;color:var(--admin-heading);font-size:13px}.search-box input::placeholder{color:var(--admin-muted)}
.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}th,td{padding:14px 16px;text-align:left;border-bottom:1px solid var(--admin-row-border);font-size:12px;color:var(--admin-muted);vertical-align:middle}th{font-size:11px;font-weight:700;color:var(--admin-muted);background:var(--admin-soft);white-space:nowrap}td strong{color:var(--admin-heading)}
.name-cell{display:flex;align-items:center;gap:10px}.row-icon{width:30px;height:30px;flex:0 0 30px;display:grid;place-items:center;border-radius:7px;color:var(--admin-text);background:var(--admin-chip)}
.stacked{display:flex;flex-direction:column;gap:3px}.stacked small{font-size:11px;color:var(--admin-muted)}.stacked .activity{max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hazard-badge{display:inline-block;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}.hazard-badge.low{background:var(--admin-success-bg);color:var(--admin-success-text)}.hazard-badge.high{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.hazard-badge.very-high{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.table-footer{padding:14px 16px;color:var(--admin-muted);font-size:12px}.state-row{padding:80px 20px;text-align:center;color:var(--admin-muted)}.empty-state{display:flex;flex-direction:column;align-items:center;gap:7px}.empty-state i{font-size:30px;margin-bottom:4px}.empty-state strong{color:var(--admin-heading)}.error-state{color:var(--admin-danger-text)}
@media(max-width:900px){.toolbar{grid-template-columns:1fr}}
</style>
