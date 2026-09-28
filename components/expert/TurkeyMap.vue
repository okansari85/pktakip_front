<template>
  <div ref="root" class="turkey-map" @mouseleave="hover = null">
    <div v-if="!provinces.length" class="map-loading"><i class="pi pi-spin pi-spinner" /> Harita yükleniyor...</div>
    <svg v-else :viewBox="viewBox" role="img" aria-label="Türkiye lokasyon haritası">
      <g ref="layer">
        <g
          v-for="province in provinces" :key="province.code" :data-code="province.code"
          class="province" :class="[levelOf(province.code), { active: selected === province.code }]"
          @mousemove="onHover($event, province)" @click="onClick(province.code)"
        >
          <path v-for="(d, index) in province.paths" :key="index" :d="d" />
        </g>
      </g>
      <!-- Lokasyonu olan illerde sayı -->
      <g class="bubbles">
        <g v-for="bubble in bubbles" :key="bubble.code" :transform="`translate(${bubble.x}, ${bubble.y})`" class="bubble" :class="bubble.level" @click="onClick(bubble.code)" @mousemove="onHover($event, bubble.province)">
          <circle :r="bubble.r" />
          <text text-anchor="middle" dominant-baseline="central">{{ bubble.count }}</text>
        </g>
      </g>
    </svg>
    <div v-if="hover" class="map-tooltip" :style="{ left: `${hover.x}px`, top: `${hover.y}px` }">
      <strong>{{ hover.name }}</strong>
      <template v-if="cityOf(hover.code)">
        <span>{{ cityOf(hover.code)!.count }} lokasyon · {{ cityOf(hover.code)!.equipment }} ekipman</span>
        <span v-if="cityOf(hover.code)!.overdue" class="bad">{{ cityOf(hover.code)!.overdue }} gecikmiş</span>
        <span v-if="cityOf(hover.code)!.nonconforming" class="bad">{{ cityOf(hover.code)!.nonconforming }} uygun değil</span>
        <span v-if="cityOf(hover.code)!.upcoming" class="warn">{{ cityOf(hover.code)!.upcoming }} yaklaşan</span>
      </template>
      <span v-else class="muted">Lokasyon yok</span>
    </div>
  </div>
</template>

<script setup lang="ts">
// Türkiye il haritası: lokasyonu olan iller durumuna göre renklenir (kırmızı: gecikmiş ya da uygun değil, sarı: 60 gün içinde
// kontrol, yeşil: sorunsuz, mavi: ekipmanı yok), üstünde lokasyon sayısı. İle tıklanınca "select" (tekrar tıklanınca null).
// Harita: github.com/ali-han/Turkey-SVG-Map (assets/maps/turkey.svg; il grupları plaka koduyla).
interface MapCity { code: number; name: string; count: number; equipment: number; overdue: number; nonconforming: number; upcoming: number }

const props = defineProps<{ cities: MapCity[]; selected?: number | null }>()
const emit = defineEmits<{ select: [code: number | null] }>()

interface Province { code: number; name: string; paths: string[] }
const provinces = ref<Province[]>([])
const viewBox = ref('0 0 1005 490')
const centers = ref<Record<number, { x: number; y: number }>>({})
const hover = ref<{ code: number; name: string; x: number; y: number } | null>(null)
const root = ref<HTMLElement | null>(null)
const layer = ref<SVGGElement | null>(null)

const cityOf = (code: number) => props.cities.find(city => city.code === code) || null
const levelOf = (code: number) => {
  const city = cityOf(code)
  if (!city) return 'none'
  if (city.overdue || city.nonconforming) return 'bad'
  if (city.upcoming) return 'warn'
  return city.equipment ? 'ok' : 'empty'
}
const maxCount = computed(() => Math.max(1, ...props.cities.map(city => city.count)))
const bubbles = computed(() => props.cities
  .filter(city => centers.value[city.code])
  .map(city => ({
    code: city.code, count: city.count, level: levelOf(city.code), ...centers.value[city.code],
    r: 11 + Math.round((city.count / maxCount.value) * 9),
    province: provinces.value.find(item => item.code === city.code)!
  })))

const onHover = (event: MouseEvent, province: Province) => {
  const box = root.value?.getBoundingClientRect()
  if (!box) return
  hover.value = { code: province.code, name: province.name, x: event.clientX - box.left + 14, y: event.clientY - box.top + 14 }
}
const onClick = (code: number) => { if (cityOf(code)) emit('select', props.selected === code ? null : code) }

// İl merkezleri (sayı balonu için): çizildikten sonra her ilin sınır kutusunun ortası.
const measure = async () => {
  await nextTick()
  const result: Record<number, { x: number; y: number }> = {}
  layer.value?.querySelectorAll<SVGGElement>('g.province').forEach(group => {
    const box = group.getBBox()
    result[Number(group.dataset.code)] = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  })
  centers.value = result
}

onMounted(async () => {
  // SVG ayrı parça olarak yüklenir (Genel Bakış açılışını yavaşlatmasın).
  const svg = (await import('~/assets/maps/turkey.svg?raw')).default as string
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  viewBox.value = doc.documentElement.getAttribute('viewBox') || viewBox.value
  provinces.value = [...doc.querySelectorAll('g[data-city-code]')].map(group => ({
    code: Number(group.getAttribute('data-city-code')),
    name: group.getAttribute('data-city-name') || '',
    paths: [...group.querySelectorAll('path')].map(path => path.getAttribute('d') || '').filter(Boolean)
  }))
  await measure()
})
</script>

<style scoped>
.turkey-map{position:relative;width:100%}
svg{display:block;width:100%;height:auto}
.map-loading{display:flex;align-items:center;justify-content:center;gap:8px;min-height:260px;color:var(--admin-muted);font-size:12px}
.province path{fill:var(--admin-soft);stroke:var(--admin-border);stroke-width:.8;transition:fill .15s}
.province.none path{cursor:default}
.province.ok path{fill:#bbf7d0;stroke:#16a34a}.province.warn path{fill:#fde68a;stroke:#d97706}.province.bad path{fill:#fecaca;stroke:#dc2626}.province.empty path{fill:#bfdbfe;stroke:#2563eb}
.province:not(.none){cursor:pointer}.province:not(.none):hover path{filter:brightness(.95)}
.province.active path{stroke-width:2.2}
.bubble{cursor:pointer}
.bubble circle{fill:#fff;stroke-width:2.5;stroke:#64748b;filter:drop-shadow(0 2px 3px rgba(0,0,0,.18))}
.bubble.ok circle{stroke:#16a34a}.bubble.warn circle{stroke:#d97706}.bubble.bad circle{stroke:#dc2626}.bubble.empty circle{stroke:#2563eb}
.bubble text{font-size:12px;font-weight:800;fill:#111827;pointer-events:none}
.map-tooltip{position:absolute;z-index:2;display:flex;flex-direction:column;gap:2px;min-width:150px;padding:8px 10px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-card);box-shadow:0 8px 24px var(--admin-shadow);font-size:11px;color:var(--admin-text);pointer-events:none}
.map-tooltip strong{color:var(--admin-heading);font-size:12px}.map-tooltip .bad{color:var(--admin-danger-text);font-weight:700}.map-tooltip .warn{color:var(--admin-warning-text);font-weight:700}.map-tooltip .muted{color:var(--admin-muted)}
:global(.dark-theme) .province.ok path{fill:#14532d}:global(.dark-theme) .province.warn path{fill:#78350f}:global(.dark-theme) .province.bad path{fill:#7f1d1d}:global(.dark-theme) .province.empty path{fill:#1e3a8a}
:global(.dark-theme) .bubble circle{fill:#0f172a}:global(.dark-theme) .bubble text{fill:#f8fafc}
</style>
