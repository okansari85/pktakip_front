<template>
  <div class="calendar-page" :class="{ reloading: loading && !!data }">
    <div class="page-head">
      <div>
        <!-- Ana Sayfa yalnız bireysel uzmanda var; diğer hesaplarda sayfa yolu Genel Bakış'ta başlar -->
        <nav class="crumb" aria-label="Sayfa yolu">
          <i class="pi pi-home" aria-hidden="true" />
          <NuxtLink :to="individual ? '/expert/anasayfa' : '/expert'">{{ individual ? 'Ana Sayfa' : 'Genel Bakış' }}</NuxtLink>
          <i class="pi pi-angle-right" aria-hidden="true" />
          <strong>Kontrol takvimi</strong>
        </nav>
        <h1>Kontrol takvimi</h1>
        <p>Yaklaşan kontroller ve geciken kayıtlar</p>
        <div v-if="data && groups.length" class="view-switch" role="group" aria-label="Görünüm">
          <button type="button" :class="{ on: view === 'ajanda' }" :aria-pressed="view === 'ajanda'" @click="view = 'ajanda'"><i class="pi pi-calendar" /> Ajanda</button>
          <button type="button" :class="{ on: view === 'yillik' }" :aria-pressed="view === 'yillik'" @click="view = 'yillik'"><i class="pi pi-calendar" /> Yıllık plan</button>
        </div>
      </div>
      <button v-if="data && groups.length && view === 'yillik'" class="plan-button" type="button" @click="openNewPlan"><i class="pi pi-calendar" /> Kontrol planla <i class="pi pi-arrow-right" /></button>
    </div>

    <div v-if="loading && !data" class="card state"><i class="pi pi-spin pi-spinner" /> Takvim hazırlanıyor...</div>
    <div v-else-if="error" class="card state error-text">{{ error }}</div>
    <div v-else-if="!groups.length" class="card state">{{ multiUser ? 'Henüz size atanmış bir işyeri yok.' : 'Henüz işyeriniz yok.' }} {{ kamu ? 'Lokasyonlar' : 'Firmalarım' }}'dan {{ multiUser ? 'işyeri' : 'firma' }} ekleyin.</div>
    <template v-else-if="data">
      <p v-if="plansError" class="plans-error"><i class="pi pi-exclamation-circle" /> {{ plansError }}</p>

      <!-- Ajanda (tasarım kataloğu 03): solda 7 günlük özet, ortada en yakın kontrol, sağda seçili gün; altta hafta ve gecikenler. -->
      <template v-if="view === 'ajanda'">
        <div class="cal-top">
          <section class="card cal-summary">
            <NuxtLink to="/expert/kontroller/7-gun" class="cal-sum-row">
              <span class="cal-sum-icon"><i class="pi pi-clone" /></span>
              <span class="cal-sum-text"><strong>{{ number(soonGroups) }}</strong><small>Yaklaşan kontrol grubu</small></span>
              <i class="pi pi-chevron-right" aria-hidden="true" />
            </NuxtLink>
            <NuxtLink to="/expert/kontroller/7-gun" class="cal-sum-row">
              <span class="cal-sum-icon equipment"><i class="pi pi-box" /></span>
              <span class="cal-sum-text"><strong>{{ number(soonEquipment) }}</strong><small>{{ soonGroups > 1 ? 'Bu gruplardaki ekipman' : 'Bu gruptaki ekipman' }}</small></span>
              <i class="pi pi-chevron-right" aria-hidden="true" />
            </NuxtLink>
            <p class="cal-sum-note"><i class="pi pi-calendar" /> Önümüzdeki 7 gün</p>
            <NuxtLink v-if="overdueGroups" to="/expert/kontroller/suresi-gecen" class="cal-sum-alert"><i class="pi pi-exclamation-triangle" /> {{ number(overdueGroups) }} kontrol grubu gecikmiş</NuxtLink>
          </section>

          <figure class="cal-hero">
            <div class="cal-hero-actions">
              <span v-if="nextDay" class="cal-hero-tag"><i class="pi pi-box" /> {{ agendaGroupsText(nextDay.entries) }} · {{ longDate(nextDay.date) }}</span>
              <button class="plan-button" type="button" @click="openNewPlan"><i class="pi pi-calendar" /> Kontrol planla <i class="pi pi-arrow-right" /></button>
            </div>
            <!-- Katalogdaki görsel (tasarım kataloğu 03'ten kırpıldı: forklift, işaret ve yazısız masa takvimi; marka yazıları silindi).
                 Takvimin günü ve ayı en yakın kontrol günü, görselin üstüne yazılır. Elle çizilmiş karşılığı forklift-izometrik.svg + SVG takvim. -->
            <div class="cal-hero-art">
              <span v-if="SHOW_HERO_PIN" class="cal-hero-pin" aria-hidden="true"><i class="pi pi-calendar" /></span>
              <img src="/katalog/takvim-katalog.webp" alt="" />
              <span class="cal-hero-day" aria-hidden="true">{{ heroDate.day }}</span>
              <span class="cal-hero-month" aria-hidden="true">{{ heroDate.month }}</span>
              <svg v-if="SHOW_SVG_CALENDAR" class="cal-hero-cal" viewBox="0 0 150 200" aria-hidden="true">
                <ellipse cx="78" cy="176" rx="66" ry="16" fill="#1f2937" fill-opacity=".14" />
                <polygon points="40,70 135.3,15 100.7,125 5.4,180" fill="#aeb7c1" />
                <g transform="translate(-5 -3)"><rect width="110" height="120" rx="12" fill="#c3cad2" transform="matrix(0.866 -0.5 0 1 40 70)" /></g>
                <g transform="matrix(0.866 -0.5 0 1 40 70)">
                  <rect width="110" height="120" rx="12" fill="#ffffff" stroke="#d6dce4" stroke-width="1.5" />
                  <path d="M0 62 V12 a12 12 0 0 1 12 -12 h86 a12 12 0 0 1 12 12 V62 Z" fill="#e5483d" />
                  <text x="55" y="50" text-anchor="middle" font-size="46" font-weight="800" fill="#ffffff">{{ heroDate.day }}</text>
                  <text x="55" y="104" text-anchor="middle" font-size="30" font-weight="800" fill="#1f2937">{{ heroDate.month }}</text>
                  <g fill="#7d8792"><rect x="22" y="-9" width="8" height="20" rx="4" /><rect x="51" y="-9" width="8" height="20" rx="4" /><rect x="80" y="-9" width="8" height="20" rx="4" /></g>
                </g>
              </svg>
            </div>
          </figure>

          <section class="card cal-day">
            <header class="cal-day-head"><i class="pi pi-calendar" /><h3>{{ selected.title }}</h3></header>
            <span class="cal-pill" :class="selected.daysLeft < 0 ? 'bad' : 'warn'"><i class="pi pi-clock" /> {{ selected.daysText }}</span>
            <div v-if="selected.place" class="cal-line"><i class="pi pi-map-marker" /> {{ selected.place }}</div>
            <div v-if="selected.groupsText" class="cal-line"><i class="pi pi-clone" /> {{ selected.groupsText }}</div>
            <div v-if="selected.rechecks.length" class="cal-line"><i class="pi pi-list-check" /> {{ selected.rechecks.length }} bulgu tekrar kontrolü</div>
            <button v-for="plan in selected.plans" :key="plan.id" type="button" class="cal-line cal-plan-line" :title="'Planı düzenle'" @click="openPlan(plan)">
              <i class="pi pi-calendar-plus" /><span>{{ controlPlanText(plan) }}</span><i class="pi pi-pencil" />
            </button>
            <p v-if="selected.empty" class="muted">Bu gün kontrol yok.</p>
            <div class="cal-day-actions">
              <button v-if="selected.entries.length || selected.rechecks.length" class="cal-secondary" type="button" @click="dayModal = selectedDay"><i class="pi pi-eye" /> Ekipmanları gör</button>
              <button class="plan-button" type="button" @click="openDayPlan"><i class="pi pi-calendar" /> Plan oluştur</button>
            </div>
          </section>
        </div>

        <div class="cal-bottom">
          <section class="card cal-week">
            <header class="cal-week-head">
              <button class="cal-nav" type="button" aria-label="Önceki hafta" @click="shiftWeek(-1)"><i class="pi pi-chevron-left" /></button>
              <h3>{{ weekLabel }}</h3>
              <button class="cal-nav" type="button" aria-label="Sonraki hafta" @click="shiftWeek(1)"><i class="pi pi-chevron-right" /></button>
            </header>
            <div class="cal-grid">
              <div v-for="day in week" :key="day.date" class="cal-col" :class="{ selected: day.date === selectedDay }" @click="selectedDay = day.date">
                <button type="button" class="cal-col-head" :aria-pressed="day.date === selectedDay" @click.stop="selectedDay = day.date"><strong>{{ day.weekday }}</strong><small>{{ day.label }}</small></button>
                <div class="cal-cell">
                  <template v-for="chip in day.chips.slice(0, CHIP_LIMIT)" :key="chip.key">
                    <button v-if="chip.plan" type="button" class="cal-chip plan" title="Planı düzenle" @click.stop="openPlan(chip.plan)">
                      <i :class="chip.icon" /><span><strong>{{ chip.title }}</strong><small>{{ chip.sub }}</small></span>
                    </button>
                    <span v-else class="cal-chip" :class="chip.tone"><i :class="chip.icon" /><span><strong>{{ chip.title }}</strong><small>{{ chip.sub }}</small></span></span>
                  </template>
                  <span v-if="day.chips.length > CHIP_LIMIT" class="cal-more">+{{ day.chips.length - CHIP_LIMIT }} daha</span>
                  <span v-if="!day.chips.length" class="cal-empty">–</span>
                </div>
              </div>
            </div>
            <footer class="cal-scope"><i class="pi pi-map-marker" /><strong>Kapsam:</strong> {{ scopeText }}</footer>
          </section>

          <section class="card cal-late">
            <header class="cal-late-head"><i class="pi pi-clock" /><h3>Geciken kontrol grupları</h3></header>
            <p v-if="!lateRows.length" class="muted">Geciken kontrol yok.</p>
            <button v-for="row in lateRows" :key="row.key" type="button" class="cal-late-row" @click="dayModal = row.date">
              <span class="cal-late-icon"><i :class="row.kind === 'installation' ? 'pi pi-sitemap' : 'pi pi-box'" /></span>
              <span class="cal-late-name"><strong>{{ row.name }}</strong><small v-if="row.meta">{{ row.meta }}</small></span>
              <span class="cal-late-days">{{ number(row.days) }} gün</span>
              <i class="pi pi-chevron-right" aria-hidden="true" />
            </button>
            <NuxtLink v-if="lateRows.length" to="/expert/kontroller/suresi-gecen" class="cal-link">Kayıtları aç <i class="pi pi-arrow-right" /></NuxtLink>
          </section>
        </div>
      </template>

      <!-- Yıllık plan: 12 ay (kontrol olmayan yılda da), planlar kesikli çizgiyle -->
      <template v-else>
        <ExpertControlCalendar :agenda="data.agenda || []" :undated="data.undated" :query="query" :rechecks="rechecks" :plans="scopedPlans" @edit-plan="openPlan" />
        <p class="cal-scope"><i class="pi pi-map-marker" /><strong>Kapsam:</strong> {{ scopeText }}</p>
      </template>
    </template>

    <ExpertControlDayModal v-if="dayModal" :date="dayModal" :entries="entriesOn(dayModal)" :rechecks="rechecksOn(dayModal)" :plans="plansOn(dayModal)" :query="query" @close="dayModal = null" @edit-plan="dayModal = null; openPlan($event)" />
    <ExpertControlPlanModal v-if="planEditor" :plan="planEditor.plan" :initial="planEditor.initial" @close="planEditor = null" @saved="onPlanSaved" @deleted="onPlanDeleted" />
  </div>
</template>

<script setup lang="ts">
import { agendaDate, agendaDateKey, agendaGroupsText, agendaMergedGroups, agendaNextDay, agendaShortName, controlPlanText, type AgendaEntry } from '~/composables/controlAgenda'

// Kontrol Takvimi (tasarım kataloğu 03): Ajanda (haftalık) ve Yıllık plan; Genel Bakış'ın verisiyle (/pk-dashboard), bulgu tekrar
// kontrolleri (/pk-findings/rechecks) ve kontrol planları (/pk-control-plans). Planlar kontrollerle birlikte, kesikli çizgiyle görünür.
// Kapsam üstteki lokasyon / firma menüsünden; bu sayfada menüde "Tüm lokasyonlar" da seçilebilir (dashboardScope).
definePageMeta({ layout: 'expert', middleware: 'expert', dashboardScope: true })

const { get, errorMessage } = useExpertApi()
const { groups, load, query, scopeLabel, locationLabel, locationId, workplaceId } = useDashboardScope()
const { kamu, multiUser, account, load: loadAccount } = useAccount()
// Ana Sayfa yalnız bireysel uzmanda (sayfa yolu).
const individual = computed(() => !!account.value && !multiUser.value)

const view = ref<'ajanda' | 'yillik'>('ajanda')
const CHIP_LIMIT = 3
const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

const data = ref<any>(null)
// Bulgu Takip: tekrar kontrol tarihi girilmiş bulgular (takvimde ayrıca görünür; alınamazsa takvim yine çalışır).
const rechecks = ref<any[]>([])
const loading = ref(false)
const error = ref('')

// Kontrol planları: kapsamın bütün planları tek istekte.
// shortcut: tarih aralığı (from/to) gönderilmiyor; planlar binlerce olursa yıl / hafta aralığıyla alınmalı.
const plans = ref<any[]>([])
const plansError = ref('')
let plansRequest = 0
const loadPlans = async () => {
  const no = ++plansRequest
  plansError.value = ''
  try {
    const list = await get<any[]>('/pk-control-plans', { 'location_ids[]': query.value['location_ids[]'] })
    if (no === plansRequest) plans.value = list || []
  } catch (e: any) {
    if (no === plansRequest) { plans.value = []; plansError.value = errorMessage(e, 'Kontrol planları alınamadı.') }
  }
}
// Firma seçiliyse: o firmanın ve lokasyon genelinin planları.
const scopedPlans = computed(() => plans.value.filter(plan => !workplaceId.value || !plan.workplace_id || plan.workplace_id === workplaceId.value))

// Aynı kapsam için ikinci istek atılmaz (açılışta işyerleri yüklenince filtre de değişir).
let lastKey = ''
const loadData = async () => {
  if (!groups.value.length) { data.value = null; return }
  const key = JSON.stringify(query.value)
  if (key === lastKey) return
  lastKey = key
  loading.value = true
  error.value = ''
  get('/pk-findings/rechecks', query.value).then(items => { rechecks.value = items }).catch(() => { rechecks.value = [] })
  loadPlans()
  try { data.value = await get('/pk-dashboard', query.value) }
  catch (e: any) { lastKey = ''; error.value = errorMessage(e, 'Takvim alınamadı.') }
  finally { loading.value = false }
}

watch(query, loadData, { deep: true })
onMounted(async () => {
  loadAccount()
  await load()
  loadData()
})

// --- Günler ---
const number = (value: number) => new Intl.NumberFormat('tr-TR').format(value)
const todayKey = agendaDateKey(new Date())
const daysUntil = (date: string) => Math.round((agendaDate(date).getTime() - agendaDate(todayKey).getTime()) / 86400000)
const longDate = (date: string) => new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(agendaDate(date))
const agenda = computed<AgendaEntry[]>(() => data.value?.agenda || [])
const entriesOn = (date: string) => agenda.value.filter(entry => entry.date === date)
const rechecksOn = (date: string) => rechecks.value.filter(item => item.recheck_date === date)
const plansOn = (date: string) => scopedPlans.value.filter(plan => plan.date === date)

// Sol kart: önümüzdeki 7 gün (yarından itibaren; "Önümüzdeki 7 gün" sayfasıyla aynı aralık) ve gecikmiş kontrol grupları.
const soon = computed(() => agenda.value.filter(entry => entry.days_left >= 1 && entry.days_left <= 7))
const soonGroups = computed(() => soon.value.reduce((sum, entry) => sum + entry.groups.length, 0))
const soonEquipment = computed(() => soon.value.reduce((sum, entry) => sum + entry.total, 0))
const overdueGroups = computed(() => agenda.value.filter(entry => entry.days_left < 0).reduce((sum, entry) => sum + entry.groups.length, 0))

// Orta: en yakın kontrol günü (bugün ya da sonrası).
const nextDay = computed(() => agendaNextDay(agenda.value))
// Eski elle çizilmiş takvim ve işaret: katalog görselinde ikisi de var; gizli, ileride açılabilir (forklift-izometrik.svg ile).
const SHOW_SVG_CALENDAR = false
const SHOW_HERO_PIN = false
const heroDate = computed(() => {
  const date = agendaDate(nextDay.value?.date || todayKey)
  return { day: date.getDate(), month: new Intl.DateTimeFormat('tr-TR', { month: 'short' }).format(date).toLocaleUpperCase('tr-TR') }
})

// Seçili gün (sağ kart) ve hafta: açılışta ve kapsam değişince en yakın kontrol günü.
const mondayOf = (date: string) => {
  const value = agendaDate(date)
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7))
  return agendaDateKey(value)
}
const selectedDay = ref(todayKey)
const weekStart = ref(mondayOf(todayKey))
const showDay = (date: string) => {
  selectedDay.value = date
  weekStart.value = mondayOf(date)
}
watch(agenda, () => showDay(nextDay.value?.date || todayKey))
const shiftWeek = (step: number) => {
  const value = agendaDate(weekStart.value)
  value.setDate(value.getDate() + step * 7)
  weekStart.value = agendaDateKey(value)
}

const placeOf = (items: { id: number | null | undefined; name?: string | null }[]) => {
  const ids = new Set(items.map(item => item.id))
  return ids.size > 1 ? `${ids.size} lokasyon` : items[0] ? locationLabel(items[0].id, items[0].name) : ''
}
const selected = computed(() => {
  const date = agendaDate(selectedDay.value)
  const entries = entriesOn(selectedDay.value)
  const dayRechecks = rechecksOn(selectedDay.value)
  const dayPlans = plansOn(selectedDay.value)
  const daysLeft = entries[0]?.days_left ?? daysUntil(selectedDay.value)
  const merged = agendaMergedGroups(entries)
  const single = merged.length === 1 && merged[0]!.kind !== 'installation' ? merged[0] : null
  return {
    title: `${new Intl.DateTimeFormat('tr-TR', { weekday: 'long' }).format(date)}, ${new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' }).format(date)}`,
    daysLeft,
    daysText: daysLeft < 0 ? `${number(-daysLeft)} gün geçti` : daysLeft === 0 ? 'Bugün' : `${number(daysLeft)} gün kaldı`,
    place: placeOf([
      ...entries.map(entry => ({ id: entry.location_id, name: entry.location_name })),
      ...dayRechecks.map(item => ({ id: item.location?.id, name: item.location?.name })),
      ...dayPlans.map(plan => ({ id: plan.location_id, name: plan.location_name }))
    ]),
    groupsText: single ? `${agendaShortName(single.name)} · ${number(single.count)} ekipman` : entries.length ? agendaGroupsText(entries) : '',
    entries,
    rechecks: dayRechecks,
    plans: dayPlans,
    empty: !entries.length && !dayRechecks.length && !dayPlans.length
  }
})

// Hafta: her gün kontrol grupları, bulgu tekrar kontrolleri ve planlar (plan kesikli çizgili; tıklayınca düzenlenir).
const dayMonth = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' })
const chipsOf = (date: string) => {
  const entries = entriesOn(date)
  const late = (entries[0]?.days_left ?? 0) < 0
  const dayRechecks = rechecksOn(date)
  return [
    ...agendaMergedGroups(entries).map(group => ({
      key: `group-${group.key}`,
      title: group.kind === 'installation' ? group.name : `${agendaShortName(group.name)} kontrolleri`,
      sub: `${number(group.count)} ekipman`,
      icon: group.kind === 'installation' ? 'pi pi-sitemap' : 'pi pi-box',
      tone: late ? 'late' : 'due',
      plan: null as any
    })),
    ...(dayRechecks.length ? [{ key: 'recheck', title: 'Bulgu tekrar kontrolü', sub: `${number(dayRechecks.length)} bulgu`, icon: 'pi pi-list-check', tone: 'recheck', plan: null as any }] : []),
    ...plansOn(date).map(plan => ({ key: `plan-${plan.id}`, title: controlPlanText(plan), sub: 'Planlı kontrol', icon: 'pi pi-calendar-plus', tone: 'plan', plan }))
  ]
}
const week = computed(() => WEEKDAYS.map((weekday, index) => {
  const value = agendaDate(weekStart.value)
  value.setDate(value.getDate() + index)
  const date = agendaDateKey(value)
  return { date, weekday, label: dayMonth.format(value), chips: chipsOf(date) }
}))
const weekLabel = computed(() => {
  const start = agendaDate(weekStart.value)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).formatRange(start, end)
})
const scopeText = computed(() => locationId.value ? `1 lokasyon · ${scopeLabel.value}` : scopeLabel.value)

// Geciken kontrol grupları: en çok geciken önce, ilk üç; satır o günün penceresini açar.
const lateRows = computed(() => {
  const many = new Set(agenda.value.map(entry => entry.location_id)).size > 1
  return agenda.value.filter(entry => entry.days_left < 0)
    .flatMap(entry => entry.groups.map(group => ({ entry, group })))
    .sort((a, b) => a.entry.days_left - b.entry.days_left)
    .slice(0, 3)
    .map(({ entry, group }) => ({
      key: `${entry.date}|${entry.location_id}|${group.key}`,
      date: entry.date,
      kind: group.kind,
      name: group.kind === 'installation' ? group.name : agendaShortName(group.name),
      meta: [group.count > 1 ? `${number(group.count)} ekipman` : '', many ? locationLabel(entry.location_id, entry.location_name) : ''].filter(Boolean).join(' · '),
      days: -entry.days_left
    }))
})

// --- Gün penceresi ve plan penceresi ---
const dayModal = ref<string | null>(null)
const planEditor = ref<{ plan?: any; initial?: Record<string, any> } | null>(null)
// Yeni planın lokasyonu: verilen, yoksa üstte seçili lokasyon (tek lokasyon varsa o); firma yalnız aynı lokasyonda.
const planDefaults = (date: string, location: number | null = null) => {
  const location_id = location ?? locationId.value ?? (groups.value.length === 1 ? groups.value[0]!.location_id : null)
  return { date: date < todayKey ? todayKey : date, location_id, workplace_id: location_id && location_id === locationId.value ? workplaceId.value : null }
}
const openNewPlan = () => { planEditor.value = { initial: planDefaults(selectedDay.value) } }
// Sağ karttaki "Plan oluştur": o günün kontrolü tek gruptaysa tür / tesisat ön seçili.
const openDayPlan = () => {
  const entries = selected.value.entries
  const merged = agendaMergedGroups(entries)
  const only = entries.length === 1 && merged.length === 1 ? merged[0]! : null
  planEditor.value = { initial: {
    ...planDefaults(selectedDay.value, entries[0]?.location_id ?? null),
    equipment_type_id: only && only.kind !== 'installation' ? only.id : null,
    equipment_type_name: only && only.kind !== 'installation' ? only.name : null,
    installation_id: only?.kind === 'installation' ? only.id : null
  } }
}
const openPlan = (plan: any) => { planEditor.value = { plan } }
const onPlanSaved = (plan: any) => {
  planEditor.value = null
  loadPlans()
  showDay(plan.date)
}
const onPlanDeleted = () => {
  planEditor.value = null
  loadPlans()
}
</script>

<style scoped>
.calendar-page{margin:0 auto;display:grid;gap:16px}
.page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:4px}
.page-head h1{margin:0;color:var(--admin-heading);font-size:40px;font-weight:800;line-height:1.15;letter-spacing:-1px}.page-head p{margin:7px 0 0;color:var(--admin-muted);font-size:15px}
.crumb{display:flex;align-items:center;gap:8px;margin-bottom:8px;color:var(--admin-muted);font-size:13px}
.crumb a{color:var(--admin-muted)}.crumb a:hover{color:var(--admin-heading)}
.crumb strong{color:var(--admin-heading);font-weight:600}.crumb .pi-angle-right{font-size:11px}
.card{background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px;min-width:0}
.state{display:flex;align-items:center;justify-content:center;gap:8px;padding:60px 20px;color:var(--admin-muted);font-size:13px}
.error-text{color:var(--admin-danger-text)}
.reloading > *{opacity:.5;transition:opacity .15s}
.muted{margin:0;color:var(--admin-muted);font-size:13px}
.plans-error{display:flex;align-items:center;gap:8px;margin:0;padding:10px 14px;border-radius:10px;background:var(--admin-danger-bg);color:var(--admin-danger-text);font-size:13px}
/* Görünüm düğmesi ve mavi ana düğme (katalogdaki gibi) */
.view-switch{display:inline-flex;gap:4px;margin-top:16px;padding:4px;border:1px solid var(--admin-border);border-radius:14px;background:var(--admin-card);box-shadow:0 6px 18px rgba(var(--pk-shadow-rgb),.06)}
.view-switch button{min-height:42px;display:inline-flex;align-items:center;gap:9px;padding:0 20px;border:0;border-radius:10px;background:none;color:var(--admin-heading);font:inherit;font-size:15px;font-weight:600;cursor:pointer}
.view-switch button.on{background:var(--pk-yellow);color:var(--pk-on-accent)}
.plan-button{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:44px;padding:0 18px;border:0;border-radius:12px;background:var(--pk-yellow);color:var(--pk-on-accent);font:inherit;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 8px 20px rgba(var(--pk-accent-rgb),.25)}
.plan-button:hover,.plan-button:focus-visible{background:var(--pk-yellow-dark)}
.plan-button .pi-arrow-right{font-size:12px}
/* Üst sıra: özet, en yakın kontrol, seçili gün */
.cal-top{display:grid;grid-template-columns:330px minmax(0,1fr) 370px;gap:16px;align-items:stretch}
.card.cal-summary{display:flex;flex-direction:column;padding:12px 18px 16px;border-radius:16px;box-shadow:0 10px 28px rgba(var(--pk-shadow-rgb),.06)}
.cal-sum-row{display:flex;align-items:center;gap:16px;padding:12px 4px;color:inherit}
.cal-sum-row + .cal-sum-row{border-top:1px solid var(--admin-row-border)}
.cal-sum-row:hover .cal-sum-text small,.cal-sum-row:focus-visible .cal-sum-text small{color:var(--admin-heading)}
.cal-sum-icon{flex:none;width:52px;height:52px;display:grid;place-items:center;border-radius:12px;background:var(--admin-accent-soft);color:var(--pk-yellow-dark);font-size:22px}
.cal-sum-icon.equipment{background:var(--admin-success-bg);color:var(--admin-success-text)}
.cal-sum-text{flex:1;min-width:0;display:flex;flex-direction:column}
.cal-sum-text strong{color:var(--admin-heading);font-size:30px;line-height:1.1}.cal-sum-text small{color:var(--admin-muted);font-size:15px}
.cal-sum-row > .pi{color:var(--admin-heading);font-size:13px}
.cal-sum-note{display:flex;align-items:center;gap:10px;margin:0;padding:12px 4px;border-top:1px solid var(--admin-border);color:var(--admin-text);font-size:14px}
.cal-sum-alert{display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:10px;background:var(--admin-danger-bg);color:var(--admin-danger-text);font-size:14px;font-weight:600}
.cal-hero{position:relative;min-width:0;margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px}
.cal-hero-actions{align-self:flex-end;display:flex;flex-direction:column;align-items:flex-end;gap:10px}
.cal-hero-tag{display:inline-flex;align-items:center;gap:8px;padding:9px 16px;border:1px solid var(--admin-border);border-radius:999px;background:var(--admin-card);color:var(--admin-heading);font-size:14px;font-weight:600;box-shadow:0 6px 18px rgba(var(--pk-shadow-rgb),.06)}
.cal-hero-tag i{color:var(--pk-yellow-dark)}
.cal-hero-art{position:relative;width:min(100%,600px);container-type:inline-size}
/* Görseldeki masa takviminin kırmızı ve beyaz yüzü (görselde gün merkezi x %78,3 y %67, ay x %76,8 y %80) */
.cal-hero-day,.cal-hero-month{position:absolute;transform:translate(-50%,-50%);font-weight:800;line-height:1;white-space:nowrap}
.cal-hero-day{left:78.3%;top:67%;color:#fff;font-size:9.2cqw}
.cal-hero-month{left:76.8%;top:80%;color:#1f2937;font-size:6.4cqw}
.cal-hero-art img{display:block;width:100%}
.cal-hero-cal{position:absolute;right:3%;bottom:10%;width:30%;font-family:inherit}
.cal-hero-pin{position:absolute;top:-4%;left:26%;width:42px;height:42px;display:grid;place-items:center;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:var(--pk-yellow);color:var(--pk-on-accent);box-shadow:0 6px 16px var(--admin-shadow)}
.cal-hero-pin i{transform:rotate(45deg);font-size:16px}
.card.cal-day{display:flex;flex-direction:column;gap:12px;padding:18px 20px;border-radius:16px;box-shadow:0 10px 28px rgba(var(--pk-shadow-rgb),.06)}
.cal-day-head{display:flex;align-items:center;gap:12px}
.cal-day-head i{color:var(--pk-yellow-dark);font-size:22px}
.cal-day-head h3{margin:0;color:var(--admin-heading);font-size:22px;font-weight:800}
.cal-pill{display:flex;align-items:center;gap:10px;padding:11px 16px;border-radius:12px;font-size:16px;font-weight:700}
.cal-pill.warn{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.cal-pill.bad{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.cal-line{display:flex;align-items:center;gap:12px;padding:6px 4px 10px;border-bottom:1px solid var(--admin-row-border);color:var(--admin-heading);font-size:15px}
.cal-line > .pi:first-child{color:var(--admin-muted);font-size:15px}
.cal-plan-line{width:100%;border:1px dashed var(--admin-heading);border-radius:10px;padding:8px 10px;background:none;font:inherit;text-align:left;cursor:pointer}
.cal-plan-line span{flex:1;min-width:0}.cal-plan-line .pi-pencil{color:var(--admin-muted);font-size:12px}
.cal-plan-line:hover{background:var(--admin-hover)}
.cal-day-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:auto}
.cal-day-actions > *{flex:1}
.cal-secondary{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:44px;padding:0 16px;border:1px solid var(--admin-border);border-radius:12px;background:var(--admin-surface);color:var(--admin-heading);font:inherit;font-size:15px;font-weight:700;cursor:pointer}
.cal-secondary:hover{border-color:var(--pk-yellow)}.cal-secondary i{color:var(--pk-yellow-dark)}
/* Alt sıra: hafta ve geciken kontrol grupları */
.cal-bottom{display:grid;grid-template-columns:minmax(0,1.75fr) minmax(0,1fr);gap:16px}
.card.cal-week,.card.cal-late{display:flex;flex-direction:column;gap:14px;padding:18px 20px;border-radius:18px}
.cal-week-head{display:flex;align-items:center;gap:14px}
.cal-week-head h3{margin:0;color:var(--admin-heading);font-size:22px;font-weight:800}
.cal-nav{width:36px;height:36px;display:grid;place-items:center;border:1px solid var(--admin-border);border-radius:50%;background:var(--admin-surface);color:var(--admin-heading);cursor:pointer}
.cal-nav:hover{border-color:var(--pk-yellow)}
.cal-grid{display:grid;grid-template-columns:repeat(7,minmax(108px,1fr));overflow-x:auto;border:1px solid var(--admin-border);border-radius:14px;background:var(--admin-surface)}
.cal-col{display:flex;flex-direction:column;min-width:0;cursor:pointer}
.cal-col + .cal-col{border-left:1px solid var(--admin-border)}
.cal-col.selected{background:var(--admin-accent-soft)}
.cal-col-head{display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 4px;border:0;border-bottom:1px solid var(--admin-border);background:none;font:inherit;cursor:pointer}
.cal-col-head strong{color:var(--admin-heading);font-size:15px}.cal-col-head small{color:var(--admin-muted);font-size:13px}
.cal-col.selected .cal-col-head strong,.cal-col.selected .cal-col-head small{color:var(--admin-accent-text)}
.cal-cell{flex:1;min-height:140px;display:flex;flex-direction:column;align-items:stretch;justify-content:center;gap:6px;padding:8px 6px}
.cal-empty{color:var(--admin-muted);text-align:center}
.cal-more{color:var(--admin-muted);font-size:12px;font-weight:700;text-align:center}
.cal-chip{display:flex;align-items:flex-start;gap:7px;min-width:0;padding:8px 9px;border:0;border-radius:10px;font:inherit;text-align:left}
.cal-chip > span{min-width:0;display:flex;flex-direction:column}
.cal-chip strong{font-size:13px;font-weight:700;line-height:1.25;overflow-wrap:anywhere}.cal-chip small{font-size:12px;opacity:.85}
.cal-chip > i{margin-top:2px;font-size:13px}
.cal-chip.due{background:var(--pk-yellow);color:var(--pk-on-accent)}
.cal-chip.late{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.cal-chip.recheck{background:var(--admin-chip);color:var(--admin-heading)}
.cal-chip.plan{border:1.5px dashed var(--admin-heading);background:var(--admin-surface);color:var(--admin-heading);cursor:pointer}
.cal-chip.plan:hover{background:var(--admin-hover)}
.cal-scope{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0;padding:10px 14px;border:1px solid var(--admin-border);border-radius:12px;background:var(--admin-surface);color:var(--admin-text);font-size:14px}
.cal-scope i{color:var(--admin-muted)}.cal-scope strong{color:var(--admin-heading)}
.cal-late-head{display:flex;align-items:center;gap:12px}
.cal-late-head i{color:var(--pk-yellow-dark);font-size:20px}
.cal-late-head h3{margin:0;color:var(--admin-heading);font-size:20px;font-weight:800}
.cal-late-row{display:grid;grid-template-columns:52px minmax(0,1fr) auto auto;align-items:center;gap:14px;width:100%;padding:12px 14px;border:1px solid var(--admin-border);border-radius:14px;background:var(--admin-surface);font:inherit;text-align:left;cursor:pointer}
.cal-late-row:hover,.cal-late-row:focus-visible{border-color:var(--pk-yellow)}
.cal-late-icon{width:52px;height:52px;display:grid;place-items:center;border-radius:12px;background:var(--admin-chip);color:var(--admin-heading);font-size:20px}
.cal-late-name{min-width:0;display:flex;flex-direction:column}
.cal-late-name strong{color:var(--admin-heading);font-size:16px}.cal-late-name small{color:var(--admin-muted);font-size:13px}
.cal-late-days{padding:6px 14px;border-radius:999px;background:var(--admin-danger-bg);color:var(--admin-danger-text);font-size:15px;font-weight:700;white-space:nowrap}
.cal-late-row > .pi{color:var(--admin-heading);font-size:13px}
.cal-link{display:inline-flex;align-items:center;gap:8px;color:var(--admin-link);font-size:15px;font-weight:700}
@media (max-width:1250px){
  .cal-top{grid-template-columns:300px minmax(0,1fr)}
  .cal-day{grid-column:1 / -1}
}
@media (max-width:1000px){.cal-bottom{grid-template-columns:minmax(0,1fr)}}
@media (max-width:800px){
  .page-head h1{font-size:32px}
  .cal-top{grid-template-columns:minmax(0,1fr)}
  .cal-hero-art{display:none}
  .cal-hero-actions{align-self:stretch;align-items:stretch}
}
</style>
