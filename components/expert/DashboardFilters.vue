<template>
  <div class="dashboard-filters">
    <!-- Kurumsal hesapta müşteri firmanın kendisi: müşteri seçimi yok -->
    <select v-if="!corporate" :value="customer" @change="setCustomer(($event.target as HTMLSelectElement).value)">
      <option value="">Tüm müşteriler</option>
      <option v-for="item in customers" :key="item" :value="item">{{ item }}</option>
    </select>
    <select :value="locationId ?? ''" @change="setLocation(Number(($event.target as HTMLSelectElement).value) || null)">
      <option value="">Tüm lokasyonlar{{ customer ? '' : ` (${locations.length})` }}</option>
      <option v-for="group in locations" :key="group.location_id" :value="group.location_id">{{ customer ? group.location_name : locationLabel(group.location_id) }}</option>
    </select>
    <select :value="workplaceId ?? ''" :disabled="!locationId" @change="setWorkplace(Number(($event.target as HTMLSelectElement).value) || null)">
      <option value="">{{ locationId ? 'Tüm işyerleri' : 'İşyeri (önce lokasyon)' }}</option>
      <option v-for="item in workplaces" :key="item.id" :value="item.id">{{ item.company_name }}</option>
    </select>
    <button v-if="customer || locationId" class="reset" type="button" title="Tüm lokasyonlara dön" @click="reset"><i class="pi pi-filter-slash" /> Temizle</button>
  </div>
</template>

<script setup lang="ts">
// Genel Bakış / Durum Raporu filtresi: müşteri → lokasyon → işyeri (boşsa uzmanın tüm lokasyonları).
const { customer, locationId, workplaceId, customers, locations, workplaces, locationLabel, setCustomer, setLocation, setWorkplace, reset } = useDashboardScope()
const { corporate } = useAccount()
</script>

<style scoped>
.dashboard-filters{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
select{height:38px;min-width:170px;max-width:280px;padding:0 10px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:12px}
select:disabled{opacity:.55}
.reset{display:inline-flex;align-items:center;gap:6px;height:38px;padding:0 12px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-card);color:var(--admin-muted);font:inherit;font-size:12px;font-weight:700;cursor:pointer}.reset:hover{color:var(--admin-heading)}
@media(max-width:700px){select{flex:1 1 100%;max-width:none}}
</style>
