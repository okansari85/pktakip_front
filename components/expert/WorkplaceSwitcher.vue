<template>
  <div class="switcher" :class="{ empty: !context && !showAll }">
    <!-- Yönetici: lokasyonların bağlı olduğu organizasyon (OSGB'de müşteri ve düğümleri), girintili ağaç -->
    <template v-if="orgVisible">
      <!-- Kamu hesabı: yüzlerce birim için aramalı ağaç (diğer hesaplarda düz kutu aynen) -->
      <ExpertKamuOrgPicker v-if="kamu" :options="orgOptions" :value="orgScope" :count="orgCount" :total="groups.length" :buildings="buildingItems" @organization="applyOrganization" @location="pickLocationId" />
      <label v-else class="select-field">
        <span><i class="pi pi-sitemap" /> Organizasyon</span>
        <select :value="orgScope" @change="onOrganizationChange">
          <option value="">Tüm organizasyon</option>
          <option v-for="option in orgOptions" :key="option.value" :value="option.value">{{ INDENT.repeat(option.depth) + option.label }} ({{ orgCount(option.value) }})</option>
        </select>
      </label>
      <i class="pi pi-angle-right separator" />
    </template>

    <label class="select-field">
      <span><i class="pi pi-map-marker" /> Lokasyon</span>
      <select :value="showAll ? ALL : contextVisible ? context?.location_id : ''" :disabled="!loaded || groups.length <= 1" @change="onLocationChange">
        <option value="" disabled>{{ !loaded ? 'Yükleniyor...' : groups.length === 0 ? 'İşyeri yok' : 'Lokasyon seçin' }}</option>
        <!-- Genel Bakış / Durum Raporu: bütün lokasyonlar birlikte (seçili lokasyon hatırlanır, diğer sayfalar onunla açılır) -->
        <option v-if="dashboardPage && visibleGroups.length > 1" :value="ALL">Tüm lokasyonlar ({{ visibleGroups.length }})</option>
        <!-- Kurumsal hesapta müşteri firmanın kendisi: müşteri grubu başlığı yok -->
        <template v-if="corporate">
          <option v-for="group in visibleGroups" :key="group.location_id" :value="group.location_id">{{ group.location_name }}</option>
        </template>
        <optgroup v-for="customer in customers" v-else :key="customer.name" :label="customer.name">
          <option v-for="group in customer.groups" :key="group.location_id" :value="group.location_id">{{ group.location_name }}</option>
        </optgroup>
      </select>
    </label>

    <!-- Seçili lokasyonda tek firma varsa firma kutusu yok (seçilecek bir şey yok; lokasyonun tamamı o firma) -->
    <i v-if="!singleWorkplace" class="pi pi-angle-right separator" />

    <label v-if="!singleWorkplace" class="select-field">
      <span><i class="pi pi-briefcase" /> Firma</span>
      <select :value="showAll || !contextVisible ? '' : context?.workplace_id ?? ''" :disabled="!selectedGroup || showAll" @change="onWorkplaceChange">
        <option value="">{{ showAll || selectedGroup ? 'Tüm firmalar' : 'Önce lokasyon seçin' }}</option>
        <!-- İşyeri adı varsa "Ad · Firma" (aynı firmanın lokasyonda birden çok işyeri ayırt edilir) -->
        <option v-for="item in selectedGroup?.items || []" :key="item.id" :value="item.id">{{ workplaceLabel(item.id, item.company_name) }}</option>
      </select>
    </label>
  </div>
</template>

<script setup lang="ts">
const { context, setContext, allLocations, setAllLocations } = useWorkplaceContext()
const { groups, loaded, load, selectLocation, selectWorkplace } = useMyWorkplaces()
const { corporate, kamu, isManager } = useAccount()
const { load: loadOrganizations, options: orgOptions, visible: orgVisible, scope: orgScope, setScope, locationIds: orgLocationIds, idsFor } = useOrganizationScope()
// Seçeneğin kapsadığı, menüde olan (işyeri bulunan) lokasyon sayısı.
const orgCount = (value: string) => {
  const ids = idsFor(value)
  return ids ? groups.value.filter(group => ids.has(group.location_id)).length : 0
}

// Genel Bakış ve Durum Raporu (sayfa meta: dashboardScope) kapsamı bu menüden: "Tüm lokasyonlar" yalnızca orada seçilebilir.
const ALL = 'all'
const INDENT = '   '
const route = useRoute()
const dashboardPage = computed(() => route.meta.dashboardScope === true)
// Organizasyon seçiliyse yalnızca onun lokasyonları.
const visibleGroups = computed(() => orgLocationIds.value ? groups.value.filter(group => orgLocationIds.value!.has(group.location_id)) : groups.value)
const contextVisible = computed(() => !!context.value && visibleGroups.value.some(group => group.location_id === context.value!.location_id))
// Tek lokasyonda "Tüm lokasyonlar" yok: lokasyon seçili gelir ve kilitlidir.
const showAll = computed(() => dashboardPage.value && visibleGroups.value.length > 1 && (allLocations.value || !contextVisible.value))

// Lokasyonlar müşteriye göre gruplanır (optgroup).
const customers = computed(() => {
  const map = new Map<string, { name: string; groups: WorkplaceGroup[] }>()
  for (const group of visibleGroups.value) {
    const name = group.customer_name || 'Diğer'
    if (!map.has(name)) map.set(name, { name, groups: [] })
    map.get(name)!.groups.push(group)
  }
  return [...map.values()]
})

const selectedGroup = computed(() => contextVisible.value ? groups.value.find(g => g.location_id === context.value?.location_id) || null : null)
// Firma kutusu gereksizse gizli: seçili lokasyonda tek firma var ya da "Tüm lokasyonlar"da her lokasyonun tek firması var
// (ör. restoran zinciri: her şubede aynı ünvan). Lokasyonun "çok şubeli bina" ayarına bakılmaz; çok firmalı kampüslerde de kapalı.
const singleWorkplace = computed(() => showAll.value
  ? visibleGroups.value.every(group => group.items.length <= 1)
  : selectedGroup.value?.items.length === 1)

// Organizasyon değişince Genel Bakış / Durum Raporu onun bütün lokasyonlarına geçer. Seçili lokasyon onun dışındaysa: tek
// lokasyonu varsa o seçilir, yoksa lokasyon seçimi boşalır (Ekipmanlar gibi sayfalar lokasyon ister).
const onOrganizationChange = (event: Event) => applyOrganization((event.target as HTMLSelectElement).value)
const applyOrganization = (value: string) => {
  setScope(value)
  if (!contextVisible.value) {
    const only = visibleGroups.value.length === 1 ? visibleGroups.value[0] : null
    if (only) selectLocation(only)
    else setContext(null)
  }
  setAllLocations(true)
}

// Kamu seçicisinde aramadan bina seçildi: seçili birimin dışındaysa organizasyon "tümü" olur, doğrudan o lokasyona gidilir.
const buildingItems = computed(() => groups.value.map(group => ({ key: group.location_id, name: group.location_name, sub: group.organization_name })))
const pickLocationId = (id: number) => { const group = groups.value.find(g => g.location_id === id); if (group) pickLocation(group) }
const pickLocation = (group: WorkplaceGroup) => {
  if (orgLocationIds.value && !orgLocationIds.value.has(group.location_id)) setScope('')
  selectLocation(group)
  setAllLocations(false)
}

// Lokasyon değişince context "tüm lokasyon" olur; firma ikinci kutudan daraltılır.
const onLocationChange = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value
  if (value === ALL) { setAllLocations(true); return }
  const group = groups.value.find(g => g.location_id === Number(value))
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
const { load: loadNames, workplaceLabel } = useWorkplaceNames()
onMounted(() => loadNames())
// Organizasyon ağacı yalnızca yöneticide (hesap bilgisi gelince).
watch(isManager, manager => { if (manager) loadOrganizations() }, { immediate: true })
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
