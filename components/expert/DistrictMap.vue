<template>
  <div ref="root" class="district-map" @mouseleave="hover = null">
    <div v-if="!districts.length" class="map-loading"><i class="pi pi-spin pi-spinner" /> Harita yükleniyor...</div>
    <svg v-else :viewBox="viewBox" role="img" :aria-label="`${cityName} ilçe haritası`">
      <g ref="layer">
        <path
          v-for="district in districts" :key="district.name" :d="district.d" :data-name="district.name"
          class="district" :class="[levelOf(district.name), { active: selected === district.name }]"
          @mousemove="onHover($event, district.name)" @click="onClick(district.name)"
        />
      </g>
      <!-- İlçe adları ve lokasyonu olan ilçelerde sayı -->
      <g class="labels">
        <text v-for="label in labels" :key="label.name" :x="label.x" :y="label.y + (statOf(label.name) ? 24 : 0)" text-anchor="middle" class="label">{{ label.name }}</text>
      </g>
      <g class="bubbles">
        <g v-for="bubble in bubbles" :key="bubble.name" :transform="`translate(${bubble.x}, ${bubble.y})`" class="bubble" :class="bubble.level" @click="onClick(bubble.name)" @mousemove="onHover($event, bubble.name)">
          <circle :r="bubble.r" />
          <text text-anchor="middle" dominant-baseline="central">{{ bubble.count }}</text>
        </g>
      </g>
    </svg>
    <div v-if="hover" class="map-tooltip" :style="{ left: `${hover.x}px`, top: `${hover.y}px` }">
      <strong>{{ hover.name }}</strong>
      <template v-if="statOf(hover.name)">
        <span>{{ statOf(hover.name)!.count }} lokasyon · {{ statOf(hover.name)!.equipment }} ekipman</span>
        <span v-if="statOf(hover.name)!.overdue" class="bad">{{ statOf(hover.name)!.overdue }} gecikmiş</span>
        <span v-if="statOf(hover.name)!.nonconforming" class="bad">{{ statOf(hover.name)!.nonconforming }} uygun değil</span>
        <span v-if="statOf(hover.name)!.upcoming" class="warn">{{ statOf(hover.name)!.upcoming }} yaklaşan</span>
      </template>
      <span v-else class="muted">Lokasyon yok</span>
    </div>
    <p class="attribution">Harita verisi © OpenStreetMap katkıda bulunanlar (ODbL)</p>
  </div>
</template>

<script setup lang="ts">
// Tek il haritası (kullanıcı 18 Ekim 2026): kamu hesabının bütün lokasyonları tek ildeyse Türkiye yerine o ilin ilçeleri.
// Renkler Türkiye haritasıyla aynı. İlçeye tıklanınca "select" (tekrar tıklanınca null).
// Sınırlar: geoBoundaries TUR ADM2 (OpenStreetMap, ODbL) il il bölünmüş, ilçe adları veritabanındaki adlarla aynı (public/maps/ilce/<plaka>.json).
interface DistrictStat { name: string; count: number; equipment: number; overdue: number; nonconforming: number; upcoming: number }
const props = defineProps<{ cityCode: number; stats: DistrictStat[]; selected?: string | null }>()
const emit = defineEmits<{ select: [name: string | null] }>()
const districts = ref<{ name: string; d: string }[]>([])
const cityName = ref('')
const viewBox = ref('0 0 600 400')
const centers = ref<Record<string, { x: number; y: number }>>({})
const hover = ref<{ name: string; x: number; y: number } | null>(null)
const root = ref<HTMLElement | null>(null)
const layer = ref<SVGGElement | null>(null)
const statOf = (name: string) => props.stats.find(stat => stat.name === name) || null
const levelOf = (name: string) => {
  const stat = statOf(name)
  if (!stat) return 'none'
  if (stat.overdue || stat.nonconforming) return 'bad'
  if (stat.upcoming) return 'warn'
  return stat.equipment ? 'ok' : 'empty'
}
const maxCount = computed(() => Math.max(1, ...props.stats.map(stat => stat.count)))
const bubbles = computed(() => props.stats
  .filter(stat => centers.value[stat.name])
  .map(stat => ({ name: stat.name, count: stat.count, level: levelOf(stat.name), ...centers.value[stat.name]!, r: 13 + Math.round((stat.count / maxCount.value) * 9) })))
const labels = computed(() => districts.value.filter(district => centers.value[district.name]).map(district => ({ name: district.name, ...centers.value[district.name]! })))
const onHover = (event: MouseEvent, name: string) => {
  const box = root.value?.getBoundingClientRect()
  if (!box) return
  hover.value = { name, x: event.clientX - box.left + 14, y: event.clientY - box.top + 14 }
}
const onClick = (name: string) => { if (statOf(name)) emit('select', props.selected === name ? null : name) }
// İlçe merkezleri (sayı balonu ve ad için): çizildikten sonra her ilçenin sınır kutusunun ortası.
const measure = async () => {
  await nextTick()
  const result: Record<string, { x: number; y: number }> = {}
  layer.value?.querySelectorAll<SVGPathElement>('path.district').forEach(path => {
    const box = path.getBBox()
    result[path.dataset.name!] = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  })
  centers.value = result
}
const load = async () => {
  districts.value = []
  try {
    const data = await $fetch<{ il: string; viewBox: string; ilceler: { ad: string; d: string }[] }>(`/maps/ilce/${props.cityCode}.json`)
    cityName.value = data.il
    viewBox.value = data.viewBox
    districts.value = data.ilceler.map(item => ({ name: item.ad, d: item.d }))
    await measure()
  } catch { districts.value = [] }
}
onMounted(load)
watch(() => props.cityCode, load)
</script>

<style scoped>
.district-map{position:relative;width:100%}
svg{display:block;width:100%;height:auto;max-height:520px}
.map-loading{display:flex;align-items:center;justify-content:center;gap:8px;min-height:260px;color:var(--admin-muted);font-size:12px}
.district{fill:var(--admin-soft);stroke:var(--admin-border);stroke-width:1.2;transition:fill .15s}
.district.none{cursor:default}
.district.ok{fill:#bbf7d0;stroke:#16a34a}.district.warn{fill:#fde68a;stroke:#d97706}.district.bad{fill:#fecaca;stroke:#dc2626}.district.empty{fill:#bfdbfe;stroke:#2563eb}
.district:not(.none){cursor:pointer}.district:not(.none):hover{filter:brightness(.95)}
.district.active{stroke-width:3}
.label{font-size:11px;font-weight:700;fill:var(--admin-muted);pointer-events:none;paint-order:stroke;stroke:var(--admin-card);stroke-width:3px}
.bubble{cursor:pointer}
.bubble circle{fill:#fff;stroke-width:2.5;stroke:#64748b;filter:drop-shadow(0 2px 3px rgba(0,0,0,.18))}
.bubble.ok circle{stroke:#16a34a}.bubble.warn circle{stroke:#d97706}.bubble.bad circle{stroke:#dc2626}.bubble.empty circle{stroke:#2563eb}
.bubble text{font-size:13px;font-weight:800;fill:#111827;pointer-events:none}
.map-tooltip{position:absolute;z-index:2;display:flex;flex-direction:column;gap:2px;min-width:150px;padding:8px 10px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-card);box-shadow:0 8px 24px var(--admin-shadow);font-size:11px;color:var(--admin-text);pointer-events:none}
.map-tooltip strong{color:var(--admin-heading);font-size:12px}.map-tooltip .bad{color:var(--admin-danger-text);font-weight:700}.map-tooltip .warn{color:var(--admin-warning-text);font-weight:700}.map-tooltip .muted{color:var(--admin-muted)}
.attribution{margin:6px 0 0;color:var(--admin-muted);font-size:10px;text-align:right}
:global(.dark-theme) .district.ok{fill:#14532d}:global(.dark-theme) .district.warn{fill:#78350f}:global(.dark-theme) .district.bad{fill:#7f1d1d}:global(.dark-theme) .district.empty{fill:#1e3a8a}
:global(.dark-theme) .bubble circle{fill:#0f172a}:global(.dark-theme) .bubble text{fill:#f8fafc}
</style>
