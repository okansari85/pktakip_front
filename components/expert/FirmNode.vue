<template>
  <li class="node">
    <div class="tree-row" :class="{ on: selectedLocationId == null && String(selectedId) === String(node.id) }">
      <button class="tree-item" type="button" :aria-current="selectedLocationId == null && String(selectedId) === String(node.id) ? 'true' : undefined" @click="emit('select', node)">
        <i :class="[ICON[kind], `k-${kind}`]" />
        <span>{{ node.name }}</span>
      </button>
      <button class="tree-add" type="button" :aria-label="`${node.name} altına ekle`" @click="emit('add', node)"><i class="pi pi-plus" /> Ekle</button>
    </div>
    <ul v-if="ownLocations.length || visibleChildren.length" class="branch">
      <li v-for="location in ownLocations" :key="location.id">
        <!-- Lokasyon seçilince sağda işyerleri ve satır içi ekleme formu açılır. -->
        <button
          class="tree-location" :class="{ on: String(selectedLocationId) === String(location.id) }" type="button"
          :aria-current="String(selectedLocationId) === String(location.id) ? 'true' : undefined" @click="emit('select-location', location)"
        >
          <i class="pi pi-map-marker k-location" />
          <span>{{ location.name }}<small :class="{ empty: !firmsOf(location).length }">{{ firmsOf(location).length ? `${firmsOf(location).length} işyeri` : 'Henüz işyeri yok' }}</small></span>
        </button>
      </li>
      <ExpertFirmNode
        v-for="child in visibleChildren" :key="child.id" :node="child" :depth="depth + 1" :locations="locations"
        :firms-of="firmsOf" :selected-id="selectedId" :selected-location-id="selectedLocationId" :kind-of="kindOf"
        @select="emit('select', $event)" @add="emit('add', $event)" @select-location="emit('select-location', $event)"
      />
    </ul>
  </li>
</template>

<script setup lang="ts">
import type { FirmLocation, FirmNode } from '~/composables/useFirmSetup'

const props = defineProps<{ node: FirmNode; depth: number; locations: FirmLocation[]; firmsOf: (l: FirmLocation) => string[]; selectedId: number | string | null; selectedLocationId?: number | string | null; kindOf?: (n: FirmNode) => string }>()
const emit = defineEmits<{ select: [node: FirmNode]; add: [node: FirmNode]; 'select-location': [location: FirmLocation] }>()
const ownLocations = computed(() => props.locations.filter(l => String(l.organization_id) === String(props.node.id)))
// Renkler firma sayfasındakiyle aynı: kök mor, organizasyon mavi, lokasyon turuncu.
const ICON: Record<string, string> = { root: 'pi pi-building', org: 'pi pi-sitemap' }
const kindOfNode = (n: FirmNode, depth: number) => props.kindOf ? props.kindOf(n) : depth === 0 ? 'root' : 'org'
const kind = computed(() => kindOfNode(props.node, props.depth))
// Alt organizasyonların hepsi ağaçta görünür (sınırsız derinlik).
const visibleChildren = computed(() => props.node.children || [])
</script>

<style scoped>
.node, .branch li { list-style: none; }
.branch { display: grid; gap: 2px; margin: 2px 0 2px 15px; padding: 0 0 0 9px; border-left: 2px solid var(--admin-border); }
.tree-row { display: flex; align-items: center; gap: 4px; padding-right: 5px; border-radius: 8px; }
.tree-row:hover { background: var(--admin-soft); }
.tree-row.on, .tree-row.on:hover { background: var(--pk-yellow); }
.tree-row.on .tree-item { color: #111827; }
.tree-add { flex: none; min-height: 30px; display: inline-flex; align-items: center; gap: 4px; padding: 0 8px; border: 1px solid var(--admin-border); border-radius: 7px; background: var(--admin-input); color: var(--admin-heading); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
.tree-add:hover { border-color: #d7a900; }
.tree-add i { font-size: 10px; }
.tree-item, .tree-location { width: 100%; display: flex; align-items: flex-start; gap: 8px; border: 0; border-radius: 8px; background: none; font: inherit; text-align: left; cursor: pointer; overflow-wrap: anywhere; }
.tree-item { min-height: 38px; padding: 9px 10px; color: var(--admin-heading); font-size: 13.5px; font-weight: 700; }
.tree-location:hover { background: var(--admin-soft); }
.tree-location.on, .tree-location.on:hover { background: var(--pk-yellow); }
.tree-location.on span, .tree-location.on small, .tree-location.on i { color: #111827; }
.tree-item i, .tree-location i { flex: none; margin-top: 2px; }
.tree-location { min-height: 38px; padding: 7px 10px; color: var(--admin-muted); font-size: 13px; }
.tree-location span { display: grid; gap: 1px; color: var(--admin-heading); font-weight: 600; }
.tree-location small { color: var(--admin-muted); font-size: 11.5px; font-weight: 500; }
.tree-location small.empty { color: #b54708; }
.tree-item span { display: inline-flex; flex-wrap: wrap; align-items: baseline; gap: 6px; }
.kind-tag { padding: 1px 6px; border-radius: 999px; background: #ecfdf3; color: #067647; font-size: 10.5px; font-weight: 700; text-transform: uppercase; }
.k-root { color: #5925dc; }
.k-org, .k-group, .k-unit { color: #175cd3; }
.k-company { color: #067647; }
.k-location { color: #b54708; }
.tree-row.on i, .tree-location.on i { color: #111827; }
</style>
