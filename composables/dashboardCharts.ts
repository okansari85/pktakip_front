// Genel Bakış / Durum Raporu grafik renkleri ve ortak Chart.js ayarları (açık / koyu temada okunur).
export const STATUS_KEYS = ['uygun', 'uygun_degil', 'belirtilmemis', 'rapor_bekleniyor', 'rapor_yok'] as const
export const STATUS_TEXT: Record<string, string> = { uygun: 'Uygun', uygun_degil: 'Uygun değil', belirtilmemis: 'Belirtilmemiş', rapor_bekleniyor: 'Rapor bekleniyor', rapor_yok: 'Rapor yok' }
export const STATUS_COLORS: Record<string, string> = { uygun: '#16a34a', uygun_degil: '#dc2626', belirtilmemis: '#94a3b8', rapor_bekleniyor: '#f59e0b', rapor_yok: '#cbd5e1' }

export const TIMING_TEXT: Record<string, string> = { overdue: 'Süresi geçmiş', d30: '30 gün içinde', d60: '31–60 gün', later: '60 günden sonra', none: 'Tarihi yok' }
export const TIMING_COLORS: Record<string, string> = { overdue: '#dc2626', d30: '#f97316', d60: '#facc15', later: '#16a34a', none: '#cbd5e1' }

// Tema (açık / koyu, html'deki dark-theme sınıfı) değişince artar: grafik ayarları buna bağlı hesaplanır, renkler yeniden okunur.
export const useChartThemeKey = () => {
  const key = useState('chart-theme-key', () => 0)
  if (import.meta.client) {
    let observer: MutationObserver | null = null
    onMounted(() => {
      key.value++
      observer = new MutationObserver(() => { key.value++ })
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    })
    onBeforeUnmount(() => observer?.disconnect())
  }
  return key
}

// Temadan metin / ızgara renkleri (çağrıldığı anda okunur; useChartThemeKey ile tema değişince yeniden).
export const chartTheme = () => {
  const css = import.meta.client ? getComputedStyle(document.documentElement) : null
  const read = (name: string, fallback: string) => css?.getPropertyValue(name).trim() || fallback
  return {
    text: read('--admin-text', '#334155'), muted: read('--admin-muted', '#64748b'), grid: read('--admin-row-border', '#edf0f5'),
    // Halka göstergede boş kısım (iz) ve halkalar arası boşluk.
    track: read('--admin-chip', '#eef2f7'), card: read('--admin-card', '#ffffff')
  }
}

// Halka grafik: ortada toplam, sağda açıklama.
export const doughnutOptions = () => {
  const theme = chartTheme()
  return {
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: {
      legend: { position: 'right', labels: { color: theme.text, usePointStyle: true, pointStyle: 'circle', padding: 12, font: { size: 12 } } },
      tooltip: { callbacks: { label: (item: any) => ` ${item.label}: ${item.parsed}` } }
    }
  }
}

// Çubuk grafik (yığılmış); yatay için indexAxis 'y'. onClick: tıklanan çubuğun sırası.
export const barOptions = (options: { horizontal?: boolean; stacked?: boolean; onClick?: (index: number) => void; legend?: boolean } = {}) => {
  const theme = chartTheme()
  const valueAxis = { stacked: options.stacked ?? true, beginAtZero: true, ticks: { color: theme.muted, precision: 0 }, grid: { color: theme.grid } }
  const labelAxis = {
    stacked: options.stacked ?? true,
    ticks: { color: theme.text, autoSkip: false, callback(this: any, value: any) { const label = String(this.getLabelForValue(value)); return label.length > 34 ? `${label.slice(0, 33)}…` : label } },
    grid: { display: false }
  }
  return {
    maintainAspectRatio: false,
    indexAxis: options.horizontal ? 'y' : 'x',
    scales: options.horizontal ? { x: valueAxis, y: labelAxis } : { x: labelAxis, y: valueAxis },
    plugins: { legend: { display: options.legend ?? true, position: 'bottom', labels: { color: theme.text, usePointStyle: true, pointStyle: 'rectRounded', padding: 14 } } },
    onClick: (_event: any, elements: any[]) => { if (elements.length && options.onClick) options.onClick(elements[0].index) },
    onHover: (event: any, elements: any[]) => { if (options.onClick && event?.native?.target) event.native.target.style.cursor = elements.length ? 'pointer' : 'default' }
  }
}
