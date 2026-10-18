<template>
  <div ref="root" class="picker select-field" :class="{ field: page }">
    <span><i v-if="!page" class="pi pi-sitemap" /> Organizasyon</span>
    <button type="button" class="trigger" :class="{ open }" @click="toggle">
      <span class="trigger-text">{{ currentLabel }}</span>
      <i class="pi pi-chevron-down" />
    </button>

    <div v-if="open" class="panel">
      <div class="search">
        <i class="pi pi-search" />
        <input ref="searchInput" v-model="query" type="text" placeholder="Daire, şube ya da bina ara" @keydown.esc="open = false" @keydown.enter.prevent="pickFirst" />
        <button v-if="query" type="button" class="clear" title="Temizle" @click="query = ''"><i class="pi pi-times" /></button>
      </div>

      <div class="list">
        <template v-if="!searching">
          <button type="button" class="row all" :class="{ on: !value }" @click="pickOrganization('')">
            <span class="name">Tüm organizasyon</span><span class="count">{{ total }}</span>
          </button>
        </template>
        <p v-if="searching && rows.length" class="section">BİRİMLER</p>
        <div v-for="row in rows" :key="row.value" class="row" :class="{ on: value === row.value, empty: !count(row.value), match: row.match }" :style="{ paddingLeft: `${10 + row.depth * 16}px` }">
          <button v-if="row.hasChildren && !searching" type="button" class="caret" :title="expanded.has(row.value) ? 'Kapat' : 'Aç'" @click.stop="toggleNode(row.value)">
            <i :class="expanded.has(row.value) ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" />
          </button>
          <span v-else class="caret-space" />
          <button type="button" class="pick" @click="pickOrganization(row.value)">
            <span class="name">{{ row.label }}</span><span class="count">{{ count(row.value) }}</span>
          </button>
        </div>
        <template v-if="searching">
          <p v-if="buildings.length" class="section">BİNALAR (LOKASYON)</p>
          <button v-for="item in buildings" :key="item.key" type="button" class="row building" @click="pickLocation(item.key)">
            <i class="pi pi-map-marker" />
            <span class="name">{{ item.name }}<small v-if="item.sub">{{ item.sub }}</small></span>
          </button>
          <p v-if="!rows.length && !buildings.length" class="none">"{{ query.trim() }}" ile eşleşen birim ya da bina yok.</p>
        </template>
      </div>

      <label class="footer"><input v-model="showEmpty" type="checkbox" /> Lokasyonu olmayan birimleri de göster</label>
    </div>
  </div>
</template>

<script setup lang="ts">
// Kamu hesabında üst menünün Organizasyon seçicisi (kullanıcı 18 Ekim 2026): kurumun yüzlerce birimi düz listede bulunamıyordu.
// Arama kutusu + açılıp kapanan ağaç; varsayılan olarak yalnız lokasyonu olan birimler. Aramada eşleşen binalar da çıkar,
// bina seçilince doğrudan o lokasyona gidilir. Veri dışarıdan: üst bar (WorkplaceSwitcher) ve Ayarlar → Lokasyonlar (page).
// options: ağaç sırasıyla düğümler (value, label, depth); value '' = tüm organizasyon; buildings: aramada çıkan binalar.
type Secenek = { value: string; label: string; depth: number }
type Bina = { key: number; name: string; sub?: string | null }
const props = defineProps<{ options: Secenek[]; value: string; count: (value: string) => number; total: number; buildings?: Bina[]; page?: boolean }>()
const emit = defineEmits<{ organization: [value: string]; location: [key: number] }>()
const count = (value: string) => props.count(value)
const options = computed(() => props.options)

const SHOW_EMPTY_KEY = 'pktakip_kamu_show_empty'
const open = ref(false)
const query = ref('')
const showEmpty = ref(false)
const root = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
onMounted(() => { try { showEmpty.value = localStorage.getItem(SHOW_EMPTY_KEY) === '1' } catch {} })
watch(showEmpty, value => { try { value ? localStorage.setItem(SHOW_EMPTY_KEY, '1') : localStorage.removeItem(SHOW_EMPTY_KEY) } catch {} })

const lower = (text: string) => text.toLocaleLowerCase('tr')
const searching = computed(() => query.value.trim().length >= 2)

// Düz seçenek listesinden ağaç ilişkisi: her düğümün üst düğümü ve alt düğümü olup olmadığı.
const tree = computed(() => {
  const list = options.value
  const stack: number[] = []
  return list.map((option, index) => {
    while (stack.length && list[stack[stack.length - 1]!]!.depth >= option.depth) stack.pop()
    const parents = stack.map(i => list[i]!.value)
    stack.push(index)
    return { ...option, parents, hasChildren: (list[index + 1]?.depth ?? -1) > option.depth }
  })
})

// Açık düğümler: ilk iki seviye (kurum, Genel Sekreterlik gibi) ve seçili birimin üstleri.
const expanded = ref(new Set<string>())
const initExpanded = () => {
  const set = new Set(tree.value.filter(node => node.depth <= 1).map(node => node.value))
  tree.value.find(node => node.value === props.value)?.parents.forEach(parent => set.add(parent))
  expanded.value = set
}
const toggleNode = (value: string) => {
  const set = new Set(expanded.value)
  set.has(value) ? set.delete(value) : set.add(value)
  expanded.value = set
}

const rows = computed(() => {
  const shown = (value: string) => showEmpty.value || count(value) > 0
  if (!searching.value) {
    return tree.value.filter(node => shown(node.value) && node.parents.every(parent => expanded.value.has(parent))).map(node => ({ ...node, match: false }))
  }
  // Aramada eşleşen birimler üstleriyle birlikte, hepsi açık. Aranan birim lokasyonsuz olsa da görünür (soluk, 0):
  // birimin var olduğu ama lokasyonu olmadığı anlaşılır.
  const q = lower(query.value.trim())
  const matched = new Set(tree.value.filter(node => lower(node.label).includes(q)).map(node => node.value))
  const keep = new Set<string>()
  tree.value.forEach(node => { if (matched.has(node.value)) { keep.add(node.value); node.parents.forEach(parent => keep.add(parent)) } })
  return tree.value.filter(node => keep.has(node.value)).map(node => ({ ...node, match: matched.has(node.value) }))
})

const buildings = computed(() => {
  if (!searching.value) return []
  const q = lower(query.value.trim())
  return (props.buildings || []).filter(item => lower(item.name).includes(q)).slice(0, 30)
})

const currentLabel = computed(() => {
  const option = options.value.find(item => item.value === props.value)
  return option ? `${option.label} (${count(option.value)})` : 'Tüm organizasyon'
})

function toggle() {
  open.value = !open.value
  if (open.value) { query.value = ''; initExpanded(); nextTick(() => searchInput.value?.focus()) }
}
function pickOrganization(value: string) { emit('organization', value); open.value = false }
function pickLocation(key: number) { emit('location', key); open.value = false }
// Enter: aramada ilk eşleşen birim, yoksa ilk bina.
function pickFirst() {
  const first = rows.value.find(row => row.match)
  if (first) pickOrganization(first.value)
  else if (buildings.value[0]) pickLocation(buildings.value[0].key)
}

// Panel dışına tıklanınca kapanır (açılır liste; modal değil).
const onDocument = (event: MouseEvent) => { if (open.value && root.value && !root.value.contains(event.target as Node)) open.value = false }
onMounted(() => document.addEventListener('mousedown', onDocument))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocument))
</script>

<style scoped>
.picker { position: relative; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.picker > span { display: flex; align-items: center; gap: 5px; color: var(--admin-muted); font-size: 10px; font-weight: 700; }
.picker > span i { font-size: 10px; color: var(--pk-yellow-dark); }
.trigger { width: 260px; height: 34px; display: flex; align-items: center; gap: 8px; padding: 0 10px; border: 1px solid var(--admin-border); border-radius: 8px; background: var(--admin-card); color: var(--admin-heading); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; text-align: left; }
.trigger.open, .trigger:focus { border-color: #d7a900; box-shadow: 0 0 0 3px rgba(255,193,7,.12); outline: 0; }
.trigger-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.trigger .pi { font-size: 11px; color: var(--admin-muted); }
.panel { position: absolute; top: calc(100% + 6px); left: 0; z-index: 60; width: 420px; max-width: calc(100vw - 32px); display: flex; flex-direction: column; border: 1px solid var(--admin-border); border-radius: 12px; background: var(--admin-card); box-shadow: 0 18px 50px var(--admin-shadow); }
.search { position: relative; padding: 10px; border-bottom: 1px solid var(--admin-border); }
.search > .pi { position: absolute; left: 22px; top: 50%; transform: translateY(-50%); color: var(--admin-muted); font-size: 12px; }
.search input { width: 100%; height: 36px; padding: 0 32px; border: 1px solid var(--admin-border); border-radius: 8px; outline: 0; background: var(--admin-input); color: var(--admin-heading); font: inherit; font-size: 13px; }
.search input:focus { border-color: #d7a900; box-shadow: 0 0 0 3px rgba(255,193,7,.12); }
.clear { position: absolute; right: 18px; top: 50%; transform: translateY(-50%); border: 0; background: transparent; color: var(--admin-muted); cursor: pointer; }
.list { max-height: 420px; overflow: auto; padding: 6px; }
.section { margin: 8px 8px 4px; color: var(--admin-muted); font-size: 10.5px; font-weight: 800; letter-spacing: .05em; }
.row { width: 100%; display: flex; align-items: center; gap: 4px; padding: 0 10px; border: 0; border-radius: 7px; background: transparent; color: var(--admin-heading); font: inherit; font-size: 12.5px; text-align: left; }
.row:hover { background: var(--admin-hover); }
.row.on { background: var(--admin-accent-soft); }
.row.empty { color: var(--admin-muted); }
.row.match .name { font-weight: 700; }
.row.all, .row.building { min-height: 34px; cursor: pointer; gap: 8px; }
.row.all .name { font-weight: 700; }
.caret, .caret-space { flex: none; width: 22px; height: 22px; }
.caret { display: grid; place-items: center; border: 0; border-radius: 5px; background: transparent; color: var(--admin-muted); cursor: pointer; font-size: 10px; }
.caret:hover { background: var(--admin-chip); color: var(--admin-heading); }
.pick { flex: 1; min-width: 0; min-height: 32px; display: flex; align-items: center; gap: 8px; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.name { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.35; }
.name small { color: var(--admin-muted); font-size: 11px; }
.count { flex: none; min-width: 24px; padding: 1px 7px; border-radius: 10px; background: var(--admin-chip); color: var(--admin-muted); font-size: 11px; font-weight: 700; text-align: center; }
.row.building .pi { color: var(--pk-yellow-dark); font-size: 12px; }
.none { margin: 14px 10px; color: var(--admin-muted); font-size: 12.5px; }
.footer { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-top: 1px solid var(--admin-border); color: var(--admin-muted); font-size: 12px; cursor: pointer; }
.footer input { width: 15px; height: 15px; margin: 0; accent-color: #d7a900; }
@media (max-width: 1100px) { .trigger { width: 200px; } }
/* Lokasyonlar sayfasındaki filtre: sayfanın diğer kutularıyla aynı boy */
.picker.field > span { color: var(--admin-muted); font-size: 11px; font-weight: 700; }
.picker.field .trigger { width: 100%; min-width: 260px; height: 42px; font-size: 13px; border-radius: 8px; }
</style>
