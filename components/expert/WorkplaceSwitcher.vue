<template>
  <div class="switcher" :class="{ empty: !context }">
    <label class="select-field">
      <span><i class="pi pi-map-marker" /> Lokasyon</span>
      <select :value="context?.location_id ?? ''" :disabled="!loaded || groups.length === 0" @change="onLocationChange">
        <option value="" disabled>{{ !loaded ? 'Yükleniyor...' : groups.length === 0 ? 'İşyeri yok' : 'Lokasyon seçin' }}</option>
        <optgroup v-for="customer in customers" :key="customer.name" :label="customer.name">
          <option v-for="group in customer.groups" :key="group.location_id" :value="group.location_id">{{ group.location_name }}</option>
        </optgroup>
      </select>
    </label>

    <i class="pi pi-angle-right separator" />

    <label class="select-field">
      <span><i class="pi pi-briefcase" /> Firma</span>
      <select :value="context?.workplace_id ?? ''" :disabled="!selectedGroup" @change="onWorkplaceChange">
        <option value="">{{ selectedGroup ? 'Tüm lokasyon' : 'Önce lokasyon seçin' }}</option>
        <option v-for="item in selectedGroup?.items || []" :key="item.id" :value="item.id">{{ item.company_name }}</option>
      </select>
    </label>
  </div>
</template>

<script setup lang="ts">
const { context } = useWorkplaceContext()
const { groups, loaded, load, selectLocation, selectWorkplace } = useMyWorkplaces()

// Lokasyonlar müşteriye göre gruplanır (optgroup).
const customers = computed(() => {
  const map = new Map<string, { name: string; groups: WorkplaceGroup[] }>()
  for (const group of groups.value) {
    const name = group.customer_name || 'Diğer'
    if (!map.has(name)) map.set(name, { name, groups: [] })
    map.get(name)!.groups.push(group)
  }
  return [...map.values()]
})

const selectedGroup = computed(() => groups.value.find(g => g.location_id === context.value?.location_id) || null)

// Lokasyon değişince context "tüm lokasyon" olur; firma ikinci kutudan daraltılır.
const onLocationChange = (event: Event) => {
  const group = groups.value.find(g => g.location_id === Number((event.target as HTMLSelectElement).value))
  if (group) selectLocation(group)
}

const onWorkplaceChange = (event: Event) => {
  const group = selectedGroup.value
  if (!group) return
  const id = Number((event.target as HTMLSelectElement).value)
  const item = group.items.find(i => i.id === id)
  if (item) selectWorkplace(group, item)
  else selectLocation(group)
}

onMounted(() => load())
</script>

<style scoped>
.switcher { min-width: 0; display: flex; align-items: flex-end; gap: 8px; margin-right: auto; }
.select-field { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.select-field > span { display: flex; align-items: center; gap: 5px; color: var(--admin-muted); font-size: 10px; font-weight: 700; }
.select-field > span i { font-size: 10px; color: var(--pk-yellow-dark); }
.select-field select { width: 220px; height: 34px; padding: 0 8px; border: 1px solid var(--admin-border); border-radius: 8px; background: var(--admin-card); color: var(--admin-heading); font: inherit; font-size: 12px; font-weight: 600; outline: 0; cursor: pointer; }
.select-field select:focus { border-color: #d7a900; box-shadow: 0 0 0 3px rgba(255,193,7,.12); }
.select-field select:disabled { cursor: not-allowed; opacity: .7; }
.empty .select-field:first-child select { border-color: #fec84b; }
.separator { margin-bottom: 10px; color: var(--admin-muted); font-size: 12px; }
@media (max-width: 1100px) { .select-field select { width: 170px; } }
@media (max-width: 800px) { .switcher { display: none; } }
</style>
