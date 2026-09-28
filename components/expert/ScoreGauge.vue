<template>
  <div class="score-gauge">
    <!-- İç içe halkalar (dıştan içe: tamam, süresi geçmiş, uygun değil), ortada genel skor -->
    <div class="rings">
      <div class="rings-chart">
        <Chart type="doughnut" :data="ringsData" :options="ringsOptions" class="rings-canvas" />
        <div class="rings-center">
          <small>Genel skor</small>
          <strong :class="levelOf(score.percent)">%{{ percentText(score.percent) }}</strong>
          <span>{{ score.ok }} / {{ score.total }} tamam</span>
        </div>
      </div>
      <ul class="rings-legend">
        <li v-for="part in parts.filter(item => item.ring || item.value)" :key="part.key">
          <i :style="{ background: part.color }" />
          <span>{{ part.label }}</span>
          <strong>{{ part.value }}</strong>
          <small>%{{ percentText(shareOf(part.value, score.total)) }}</small>
        </li>
      </ul>
    </div>
    <p class="score-note">Tamam: kontrol süresi geçmemiş, son kontrolü uygun ya da belirtilmemiş (raporda var, bulgusu yok).</p>
  </div>
</template>

<script setup lang="ts">
// Genel skor göstergesi (Genel Bakış haritasının sağı): ekipmanların yüzde kaçı tamam, iç içe halkalarla tamam olmama
// nedenleri (her ekipman tek nedende; öncelik: süresi geçmiş, uygun değil, rapor bekleniyor, rapor yok).
const props = defineProps<{ score: any }>()

const themeKey = useChartThemeKey()
const levelOf = (percent?: number | null) => (percent ?? 0) >= 90 ? 'ok' : (percent ?? 0) >= 70 ? 'warn' : 'bad'
// Tek haneli, aşağı yuvarlanmış (göstergede ve açıklamada aynı hesap).
const shareOf = (value: number, total: number) => total ? Math.floor((value / total) * 1000) / 10 : 0
const percentText = (value?: number | null) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(value ?? 0)

// ring: kendi halkası olanlar (diğerleri yalnızca açıklamada, varsa).
const parts = computed(() => [
  { key: 'ok', label: 'Tamam', color: STATUS_COLORS.uygun, value: props.score?.ok || 0, ring: true },
  { key: 'overdue', label: 'Süresi geçmiş', color: TIMING_COLORS.overdue, value: props.score?.overdue || 0, ring: true },
  { key: 'nonconforming', label: 'Uygun değil', color: '#f97316', value: props.score?.nonconforming || 0, ring: true },
  { key: 'pending', label: 'Rapor bekleniyor', color: STATUS_COLORS.rapor_bekleniyor, value: props.score?.pending || 0, ring: false },
  { key: 'no_report', label: 'Rapor yok', color: '#94a3b8', value: props.score?.no_report || 0, ring: false }
])

// Halkalar: her biri kendi yüzdesi kadar dolu (uçları yuvarlak), kalanı iz rengi; halkalar arası kart rengiyle ayrılır.
const ringsData = computed(() => {
  void themeKey.value
  const theme = chartTheme()
  return {
    labels: ['', ''],
    datasets: parts.value.filter(part => part.ring).map(part => {
      const share = shareOf(part.value, props.score?.total || 0)
      return {
        label: part.label,
        data: [share, Math.max(0, 100 - share)],
        backgroundColor: [part.color, theme.track],
        borderColor: theme.card,
        borderWidth: 4,
        borderRadius: 30,
        hoverOffset: 0
      }
    })
  }
})
const ringsOptions = computed(() => ({
  maintainAspectRatio: false,
  cutout: '42%',
  animation: { animateRotate: true },
  plugins: {
    legend: { display: false },
    tooltip: {
      filter: (item: any) => item.dataIndex === 0,
      callbacks: { label: (item: any) => ` ${item.dataset.label}: %${percentText(item.parsed)}` }
    }
  }
}))
</script>

<style scoped>
.score-note{margin:10px 0 0;color:var(--admin-muted);font-size:11px}
.rings{display:grid;gap:14px}
.rings-chart{position:relative;width:100%;max-width:280px;margin:0 auto;aspect-ratio:1}
.rings-canvas{position:relative;width:100%;height:100%}
.rings-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;pointer-events:none}
.rings-center small{color:var(--admin-muted);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
.rings-center strong{font-size:38px;line-height:1;font-weight:800;letter-spacing:-1px;color:var(--admin-heading)}.rings-center strong.ok{color:#16a34a}.rings-center strong.warn{color:#d97706}.rings-center strong.bad{color:#dc2626}
.rings-center span{color:var(--admin-muted);font-size:11px}
.rings-legend{display:grid;gap:8px;margin:0;padding:0;list-style:none}
.rings-legend li{display:grid;grid-template-columns:12px 1fr auto 44px;align-items:center;gap:8px;font-size:12px;color:var(--admin-text)}
.rings-legend i{width:12px;height:12px;border-radius:50%}.rings-legend strong{color:var(--admin-heading)}.rings-legend small{color:var(--admin-muted);text-align:right}
</style>
