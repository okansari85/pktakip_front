<template>
  <div class="control-calendar">
    <section class="card calendar-card">
      <header class="calendar-head">
        <div>
          <h3>Kontrol takvimi</h3>
          <small>Kontrolü dolan günler renkli. Güne ya da ayın altındaki satıra tıklayınca o günün kontrolleri açılır.</small>
        </div>
        <div class="year-nav">
          <button type="button" class="nav-button" aria-label="Önceki yıl" @click="year--"><i class="pi pi-chevron-left" /></button>
          <button type="button" class="year-button" @click="year--">{{ year - 1 }}</button>
          <strong class="year-current">{{ year }}</strong>
          <button type="button" class="year-button" @click="year++">{{ year + 1 }}</button>
          <button type="button" class="nav-button" aria-label="Sonraki yıl" @click="year++"><i class="pi pi-chevron-right" /></button>
          <button v-if="year !== thisYear" type="button" class="link-button" @click="year = thisYear">Bu yıl</button>
        </div>
      </header>

      <!-- Seçili yıldan önce dolmuş, hâlâ yapılmamış kontroller (takvimde önceki yıllarda kalır). -->
      <div v-if="earlier.length" class="earlier">
        <strong><i class="pi pi-exclamation-triangle" /> Önceki yıllardan süresi geçmiş kontroller</strong>
        <div class="earlier-items">
          <button v-for="day in earlier.slice(0, EARLIER_LIMIT)" :key="day.date" type="button" class="earlier-item" @click="openDay(day.date)">
            {{ day.text }} <small>({{ formatDate(day.date) }}{{ day.place ? ` · ${day.place}` : '' }})</small>
          </button>
          <button v-if="earlier.length > EARLIER_LIMIT" type="button" class="link-button" @click="year = yearOf(earlier[EARLIER_LIMIT]!.date)">+{{ earlier.length - EARLIER_LIMIT }} gün daha</button>
        </div>
      </div>

      <div class="legend">
        <span v-for="key in LEGEND" :key="key"><i :class="key" />{{ timingText[key] }}</span>
        <span v-if="undated" class="undated">{{ undated }} ekipmanın kontrol tarihi yok; takvimde görünmez.</span>
      </div>

      <div class="months">
        <article v-for="month in months" :key="month.key" class="month" :class="{ current: month.key === thisMonthKey }">
          <header>
            <strong>{{ month.name }}</strong>
            <span v-if="month.days.length" class="count">{{ month.days.length }} gün</span>
          </header>
          <DatePicker
            :key="`${month.key}-${resets[month.key] || 0}`"
            inline
            class="month-picker"
            :model-value="selectedDate?.startsWith(month.key) ? selectedValue : null"
            :min-date="month.start"
            :max-date="month.end"
            :disabled-dates="month.idle"
            :show-other-months="false"
            @date-select="onPick"
            @month-change="reset(month.key)"
            @year-change="reset(month.key)"
          >
            <template #date="{ date }">
              <span class="day" :class="dayClass(date)" :title="dayTitle(date)">{{ date.day }}</span>
            </template>
          </DatePicker>
          <ul v-if="month.days.length" class="day-lines">
            <li v-for="day in shownDays(month)" :key="day.date">
              <button type="button" :class="{ selected: day.date === selectedDate }" @click="openDay(day.date)">
                <i class="dot" :class="timingOf(day.days_left)" />
                <span class="date">{{ dayLabel(day.date) }}</span>
                <span class="text">{{ day.text }}<small>{{ day.place }}</small></span>
              </button>
            </li>
          </ul>
          <button v-if="month.days.length > DAY_LIMIT" type="button" class="link-button more" @click="toggleMonth(month.key)">
            {{ expandedMonths.includes(month.key) ? 'Daha az' : `+${month.days.length - DAY_LIMIT} gün daha` }}
          </button>
          <p v-if="!month.days.length" class="empty">Kontrol yok</p>
        </article>
      </div>
    </section>

    <!-- Süresi geçmiş ya da 60 gün içinde dolan kontroller: gün + lokasyon başına gruplu (tüp ve tesisat tek kalem). -->
    <section class="card list-card">
      <header><h3>Yaklaşan ve gecikmiş kontroller</h3><small>Süresi geçmiş ya da 60 gün içinde dolan, en eski önce. Satıra tıklayınca o günün kontrolleri açılır.</small></header>
      <p v-if="!soon.length" class="muted">60 gün içinde dolan ya da süresi geçmiş kontrol yok.</p>
      <ExpertAgendaTable v-else :entries="soon" :limit="12" @select="openDay" />
    </section>

    <ExpertControlDayModal v-if="selectedDate" :date="selectedDate" :entries="entriesOn(selectedDate)" :query="query" @close="selectedDate = null" />
  </div>
</template>

<script setup lang="ts">
// Genel Bakış > Kontrol takvimi: yıllık takvim (PrimeVue DatePicker, her ay ayrı), kontrolü dolan günler renkli; her ayın
// altında o ayın günleri gruplu ("5 Kas · 3 Forklift, 2 Transpalet"). Tesisata bağlı ekipman tesisat, tüpler tek kalem.
// Güne tıklayınca o günün kontrolleri (lokasyona göre) pencerede açılır.
const props = defineProps<{ agenda: AgendaEntry[]; undated?: number; query: Record<string, any> }>()

const { locationLabel } = useDashboardScope()

const MONTH_NAMES = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const LEGEND = ['overdue', 'd30', 'd60', 'later'] as const
const EARLIER_LIMIT = 6
const DAY_LIMIT = 4

const pad = (value: number) => String(value).padStart(2, '0')
const today = new Date()
const thisYear = today.getFullYear()
const thisMonthKey = `${thisYear}-${pad(today.getMonth() + 1)}`
const year = ref(thisYear)
const yearOf = (date: string) => Number(date.slice(0, 4))

const timingText = TIMING_TEXT
const timingOf = agendaTiming
const formatDate = (value: string) => new Intl.DateTimeFormat('tr-TR').format(agendaDate(value))
const dayLabel = (value: string) => new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' }).format(agendaDate(value))

// Günler (birden çok lokasyon birleşik): renk, ay satırı ve ipucu metni.
interface CalendarDay { date: string; days_left: number; entries: AgendaEntry[]; text: string; place: string }
const days = computed(() => {
  const byDate = new Map<string, AgendaEntry[]>()
  for (const entry of props.agenda || []) byDate.set(entry.date, [...(byDate.get(entry.date) || []), entry])
  return new Map<string, CalendarDay>([...byDate].map(([date, entries]): [string, CalendarDay] => [date, {
    date,
    days_left: entries[0]!.days_left,
    entries,
    text: agendaGroupsText(entries),
    place: entries.length > 1 ? `${entries.length} lokasyon` : locationLabel(entries[0]!.location_id, entries[0]!.location_name)
  }]))
})
const entriesOn = (date: string) => days.value.get(date)?.entries || []

// Seçili yılın ayları: her DatePicker kendi ayında sabit (başlığı gizli); kontrolü olmayan günler seçilemez.
const months = computed(() => MONTH_NAMES.map((name, index) => {
  const key = `${year.value}-${pad(index + 1)}`
  const last = new Date(year.value, index + 1, 0).getDate()
  const monthDays = [...days.value.values()].filter(day => day.date.startsWith(key))
  const busy = new Set(monthDays.map(day => Number(day.date.slice(8, 10))))
  return {
    key,
    name,
    start: new Date(year.value, index, 1),
    end: new Date(year.value, index, last),
    days: monthDays,
    idle: Array.from({ length: last }, (_, offset) => offset + 1).filter(day => !busy.has(day)).map(day => new Date(year.value, index, day))
  }
}))
type CalendarMonth = (typeof months.value)[number]

const expandedMonths = ref<string[]>([])
const toggleMonth = (key: string) => {
  expandedMonths.value = expandedMonths.value.includes(key) ? expandedMonths.value.filter(item => item !== key) : [...expandedMonths.value, key]
}
const shownDays = (month: CalendarMonth) => expandedMonths.value.includes(month.key) ? month.days : month.days.slice(0, DAY_LIMIT)

// Klavyeyle ay dışına çıkılırsa takvim kendi ayına döner (yeniden kurulur).
const resets = reactive<Record<string, number>>({})
const reset = (key: string) => { resets[key] = (resets[key] || 0) + 1 }

const keyOf = (date: { year: number; month: number; day: number }) => `${date.year}-${pad(date.month + 1)}-${pad(date.day)}`
const dayClass = (date: { year: number; month: number; day: number }) => {
  const day = days.value.get(keyOf(date))
  return day ? ['has', agendaTiming(day.days_left), { selected: day.date === selectedDate.value }] : []
}
const dayTitle = (date: { year: number; month: number; day: number }) => {
  const day = days.value.get(keyOf(date))
  return day ? `${day.text} · ${day.place}` : undefined
}

// Seçili gün: pencere açık; o günün yılına geçilir.
const selectedDate = ref<string | null>(null)
const selectedValue = computed(() => selectedDate.value ? agendaDate(selectedDate.value) : null)
const openDay = (date: string) => {
  year.value = yearOf(date)
  selectedDate.value = date
}
const onPick = (value: Date) => {
  const date = agendaDateKey(value)
  if (days.value.has(date)) openDay(date)
}

// Seçili yıldan önce dolmuş, hâlâ yapılmamış kontroller.
const earlier = computed(() => [...days.value.values()].filter(day => day.days_left < 0 && yearOf(day.date) < year.value))

// Yaklaşan ve gecikmiş: gün + lokasyon satırları (tarih sırasıyla gelir).
const soon = computed(() => (props.agenda || []).filter(entry => entry.days_left <= 60))

// Kapsam (filtre, il) değişince pencere kapanır.
watch(() => props.agenda, () => { selectedDate.value = null })
</script>

<style scoped>
.control-calendar{display:grid;gap:16px}
.card{background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px;min-width:0;padding:16px 18px}
h3{margin:0;color:var(--admin-heading);font-size:15px}
.calendar-head,.list-card header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.calendar-head small,.list-card header small{display:block;margin-top:4px;color:var(--admin-muted);font-size:12px}
.year-nav{display:flex;align-items:center;gap:4px}
.nav-button,.year-button{height:32px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-card);color:var(--admin-muted);font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.nav-button{width:32px;display:grid;place-items:center}.year-button{padding:0 10px}
.nav-button:hover,.year-button:hover{background:var(--admin-hover);color:var(--admin-heading)}
.year-current{min-width:64px;height:32px;display:grid;place-items:center;border-radius:8px;background:var(--pk-yellow);color:#111827;font-size:14px}
.link-button{display:inline-flex;align-items:center;gap:6px;border:0;background:none;color:var(--admin-link);font:inherit;font-size:12px;font-weight:700;cursor:pointer;padding:0 6px}
.earlier{display:grid;gap:8px;margin-bottom:12px;padding:10px 12px;border:1px solid var(--admin-danger-text);border-radius:10px;background:var(--admin-danger-bg)}
.earlier > strong{display:flex;align-items:center;gap:7px;color:var(--admin-danger-text);font-size:12px}
.earlier-items{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.earlier-item{padding:5px 10px;border:1px solid var(--admin-danger-text);border-radius:999px;background:var(--admin-card);color:var(--admin-danger-text);font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.earlier-item small{color:var(--admin-muted);font-weight:500}.earlier-item:hover{background:var(--admin-hover)}
.legend{display:flex;flex-wrap:wrap;align-items:center;gap:14px;margin-bottom:12px;color:var(--admin-muted);font-size:11px}
.legend span{display:inline-flex;align-items:center;gap:6px}.legend i{width:12px;height:12px;border-radius:50%}
.legend .undated{margin-left:auto}
.overdue{--timing:#dc2626}.d30{--timing:#f97316}.d60{--timing:#facc15}.later{--timing:#16a34a}
.legend i,.dot{background:var(--timing,var(--admin-muted))}
.months{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
.month{display:flex;flex-direction:column;gap:8px;min-width:0;padding:12px;border:1px solid var(--admin-border);border-radius:10px}
.month.current{border-color:var(--pk-yellow);box-shadow:0 0 0 1px var(--pk-yellow)}
.month > header{display:flex;align-items:center;justify-content:space-between;gap:8px}
.month > header strong{color:var(--admin-heading);font-size:13px}
.count{padding:1px 8px;border-radius:999px;background:var(--admin-chip);color:var(--admin-muted);font-size:11px;font-weight:700}
.empty{margin:0;color:var(--admin-muted);font-size:11px;text-align:center}
.more{align-self:flex-start}
/* PrimeVue DatePicker: başlık gizli, uygulama renkleri (açık / koyu tema) */
.month-picker{display:block;width:100%}
.month-picker :deep(.p-datepicker-panel){width:100%;min-width:0;padding:0;border:0;background:transparent;box-shadow:none;color:var(--admin-text)}
.month-picker :deep(.p-datepicker-calendar-container),.month-picker :deep(.p-datepicker-calendar){display:block;width:100%;padding:0;border:0}
.month-picker :deep(.p-datepicker-header){display:none}
.month-picker :deep(.p-datepicker-day-view){width:100%;margin:0;border-collapse:collapse;font-size:12px}
.month-picker :deep(.p-datepicker-weekday-cell){padding:2px 0}
.month-picker :deep(.p-datepicker-weekday){color:var(--admin-muted);font-size:10px;font-weight:700}
.month-picker :deep(.p-datepicker-day-cell){padding:1px}
.month-picker :deep(.p-datepicker-day){width:28px;height:28px;margin:0 auto;padding:0;border-radius:50%;background:transparent;color:var(--admin-text);font-size:12px}
.month-picker :deep(.p-datepicker-day.p-disabled){opacity:1;color:var(--admin-muted);cursor:default}
.month-picker :deep(.p-datepicker-day-selected){background:transparent;color:inherit}
.month-picker :deep(.p-datepicker-today > .p-datepicker-day){box-shadow:inset 0 0 0 2px var(--pk-yellow);color:var(--admin-heading);font-weight:800}
.day{display:grid;place-items:center;width:100%;height:100%;border-radius:50%}
.day.has{background:var(--timing);color:#fff;font-weight:800;cursor:pointer}.day.has.d60{color:#111827}
.day.has:hover{filter:brightness(1.1)}
.day.selected{box-shadow:0 0 0 2px var(--admin-card),0 0 0 4px var(--admin-heading)}
.day-lines{display:grid;gap:2px;margin:0;padding:0;list-style:none}
.day-lines button{display:grid;grid-template-columns:10px 46px minmax(0,1fr);align-items:start;gap:8px;width:100%;padding:5px 6px;border:0;border-radius:7px;background:none;font:inherit;text-align:left;cursor:pointer;color:var(--admin-text)}
.day-lines button:hover,.day-lines button.selected{background:var(--admin-hover)}
.dot{width:10px;height:10px;margin-top:3px;border-radius:50%}
.date{color:var(--admin-heading);font-size:12px;font-weight:800;white-space:nowrap}
.text{min-width:0;font-size:12px;line-height:1.4}.text small{display:block;color:var(--admin-muted);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.muted{margin:0;color:var(--admin-muted);font-size:12px}
@media(max-width:600px){.legend .undated{margin-left:0}}
</style>
