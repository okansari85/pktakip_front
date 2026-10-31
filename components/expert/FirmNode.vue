<template>
  <li class="node">
    <div class="node-row" :class="{ root: depth === 0 }">
      <span class="node-icon"><i :class="depth === 0 ? 'pi pi-building' : 'pi pi-sitemap'" /></span>
      <strong class="node-name">{{ node.name }}</strong>
      <div class="node-actions">
        <button class="add-button main" type="button" @click="emit('add-location', node)"><i class="pi pi-plus" /> Lokasyon Ekle</button>
        <button v-if="canBranch && depth < 2" class="add-button" type="button" @click="emit('add-node', node)"><i class="pi pi-plus" /> {{ branchLabel }}</button>
      </div>
    </div>

    <ul v-if="ownLocations.length" class="locations">
      <li v-for="location in ownLocations" :key="location.id" class="location">
        <i class="pi pi-map-marker" />
        <div class="location-text">
          <strong>{{ location.name }}</strong>
          <small v-if="location.city">{{ location.city }}<template v-if="location.district"> / {{ location.district }}</template></small>
        </div>
        <span v-if="workplaceCount(location)" class="ready"><i class="pi pi-check-circle" /> İşyeri hazır</span>
        <button v-if="workplaceCount(location)" class="go-button" type="button" @click="emit('equipment', location)"><i class="pi pi-wrench" /> Ekipmanlar</button>
        <button v-else class="go-button warn" type="button" @click="emit('add-workplace', location)"><i class="pi pi-plus" /> İşyeri Ekle</button>
      </li>
    </ul>

    <ul v-if="node.children?.length" class="children">
      <ExpertFirmNode
        v-for="child in node.children" :key="child.id" :node="child" :depth="depth + 1" :locations="locations"
        :workplace-count="workplaceCount" :can-branch="canBranch" :branch-label="branchLabel"
        @add-location="emit('add-location', $event)" @add-node="emit('add-node', $event)"
        @equipment="emit('equipment', $event)" @add-workplace="emit('add-workplace', $event)"
      />
    </ul>
  </li>
</template>

<script setup lang="ts">
import type { FirmLocation, FirmNode } from '~/composables/useFirmSetup'

const props = defineProps<{ node: FirmNode; depth: number; locations: FirmLocation[]; workplaceCount: (l: FirmLocation) => number; canBranch: boolean; branchLabel: string }>()
const emit = defineEmits<{ 'add-location': [node: FirmNode]; 'add-node': [node: FirmNode]; equipment: [location: FirmLocation]; 'add-workplace': [location: FirmLocation] }>()
const ownLocations = computed(() => props.locations.filter(l => String(l.organization_id) === String(props.node.id)))
</script>

<style scoped>
.node { list-style: none; }
.node-row { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 10px 12px; border-radius: 10px; background: var(--admin-soft); }
.node-row.root { background: var(--admin-accent-soft); }
.node-icon { flex: none; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 9px; background: var(--admin-input); color: var(--admin-heading); }
.node-name { flex: 1; min-width: 140px; color: var(--admin-heading); font-size: 14.5px; }
.node-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.add-button, .go-button { min-height: 36px; display: inline-flex; align-items: center; gap: 7px; padding: 0 12px; border: 1px solid var(--admin-border); border-radius: 8px; background: var(--admin-input); color: var(--admin-heading); font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.add-button:hover, .go-button:hover { border-color: #d7a900; }
.add-button.main { border-color: var(--pk-yellow); background: var(--pk-yellow); color: #111827; }
.go-button.warn { border-color: #f79009; color: #b54708; }
.locations, .children { margin: 8px 0 0; padding: 0 0 0 22px; border-left: 2px solid var(--admin-border); margin-left: 16px; display: grid; gap: 8px; }
.location { list-style: none; display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 9px 12px; border: 1px solid var(--admin-border); border-radius: 9px; background: var(--admin-input); color: var(--admin-muted); }
.location-text { flex: 1; min-width: 120px; display: grid; }
.location-text strong { color: var(--admin-heading); font-size: 14px; }
.location-text small { font-size: 12px; }
.ready { display: inline-flex; align-items: center; gap: 5px; color: #027a48; font-size: 12.5px; font-weight: 600; white-space: nowrap; }
</style>
