<template>
  <div class="calendar-page" :class="{ reloading: loading && !!data }">
    <div class="page-head">
      <div>
        <!-- Ana Sayfa yalnız bireysel uzmanda var; diğer hesaplarda sayfa yolu Genel Bakış'ta başlar -->
        <nav class="crumb" aria-label="Sayfa yolu">
          <PkIcon class="pi pi-home" aria-hidden="true" />
          <NuxtLink :to="individual ? '/expert/anasayfa' : '/expert'">{{ individual ? 'Ana Sayfa' : 'Genel Bakış' }}</NuxtLink>
          <PkIcon class="pi pi-angle-right" aria-hidden="true" />
          <strong>Kontrol takvimi</strong>
        </nav>
        <h1>Kontrol takvimi</h1>
        <p>Yaklaşan kontroller ve geciken kayıtlar</p>
        <div v-if="data && groups.length" class="view-switch" role="group" aria-label="Görünüm">
          <button type="button" :class="{ on: view === 'ajanda' }" :aria-pressed="view === 'ajanda'" @click="view = 'ajanda'"><PkIcon class="pi pi-calendar" /> Ajanda</button>
          <button type="button" :class="{ on: view === 'yillik' }" :aria-pressed="view === 'yillik'" @click="view = 'yillik'"><PkIcon class="pi pi-calendar" /> Yıllık plan</button>
        </div>
      </div>
      <button v-if="data && groups.length" class="plan-button" type="button" @click="openNewPlan"><PkIcon class="pi pi-calendar" /> Kontrol planla <PkIcon class="pi pi-arrow-right" /></button>
    </div>

    <div v-if="loading && !data" class="card state"><PkIcon class="pi pi-spin pi-spinner" /> Takvim hazırlanıyor...</div>
    <div v-else-if="error" class="card state error-text">{{ error }}</div>
    <div v-else-if="!groups.length" class="card state">{{ multiUser ? 'Henüz size atanmış bir işyeri yok.' : 'Henüz işyeriniz yok.' }} {{ kamu ? 'Lokasyonlar' : 'Firmalarım' }}'dan {{ multiUser ? 'işyeri' : 'firma' }} ekleyin.</div>
    <template v-else-if="data">
      <p v-if="plansError" class="plans-error"><PkIcon class="pi pi-exclamation-circle" /> {{ plansError }}</p>

      <!-- Ajanda: solda 7 günlük özet ve en yakın kontrol, sağda seçili gün; altta hafta ve gecikenler. -->
      <template v-if="view === 'ajanda'">
        <div class="cal-top">
          <section class="card cal-summary">
            <NuxtLink to="/expert/kontroller/7-gun" class="cal-sum-row">
              <span class="cal-sum-icon"><PkIcon class="pi pi-clone" /></span>
              <span class="cal-sum-text"><strong>{{ number(soonGroups) }}</strong><small>Yaklaşan kontrol grubu</small></span>
              <PkIcon class="pi pi-chevron-right" aria-hidden="true" />
            </NuxtLink>
            <NuxtLink to="/expert/kontroller/7-gun" class="cal-sum-row">
              <span class="cal-sum-icon equipment"><PkIcon class="pi pi-box" /></span>
              <span class="cal-sum-text"><strong>{{ number(soonEquipment) }}</strong><small>{{ soonGroups > 1 ? 'Bu gruplardaki ekipman' : 'Bu gruptaki ekipman' }}</small></span>
              <PkIcon class="pi pi-chevron-right" aria-hidden="true" />
            </NuxtLink>
            <p class="cal-sum-note"><PkIcon class="pi pi-calendar" /> Önümüzdeki 7 gün</p>
            <p v-if="nextDay" class="cal-sum-next"><PkIcon class="pi pi-box" /> {{ agendaGroupsText(nextDay.entries) }} · {{ longDate(nextDay.date) }}</p>
            <NuxtLink v-if="overdueGroups" to="/expert/kontroller/suresi-gecen" class="cal-sum-alert"><PkIcon class="pi pi-exclamation-triangle" /> {{ number(overdueGroups) }} kontrol grubu gecikmiş</NuxtLink>
          </section>

          <section class="card cal-day">
            <header class="cal-day-head"><PkIcon class="pi pi-calendar" /><h3>{{ selected.title }}</h3></header>
            <span class="cal-pill" :class="selected.daysLeft < 0 ? 'bad' : 'warn'"><PkIcon class="pi pi-clock" /> {{ selected.daysText }}</span>
            <div v-if="selected.place" class="cal-line"><PkIcon class="pi pi-map-marker" /> {{ selected.place }}</div>
            <div v-if="selected.groupsText" class="cal-line"><PkIcon class="pi pi-clone" /> {{ selected.groupsText }}</div>
            <div v-if="selected.rechecks.length" class="cal-line"><PkIcon class="pi pi-list-check" /> {{ selected.rechecks.length }} bulgu tekrar kontrolü</div>
            <button v-for="plan in selected.plans" :key="plan.id" type="button" class="cal-line cal-plan-line" :title="'Planı düzenle'" @click="openPlan(plan)">
              <PkIcon class="pi pi-calendar-plus" /><span>{{ controlPlanText(plan) }}</span><PkIcon class="pi pi-pencil" />
            </button>
            <p v-if="selected.empty" class="muted">Bu gün kontrol yok.</p>
            <div class="cal-day-actions">
              <button v-if="selected.entries.length || selected.rechecks.length" class="cal-secondary" type="button" @click="dayModal = selectedDay"><PkIcon class="pi pi-eye" /> Ekipmanları gör</button>
              <button class="plan-button" type="button" @click="openDayPlan"><PkIcon class="pi pi-calendar" /> Plan oluştur</button>
            </div>
          </section>
        </div>

        <div class="cal-bottom">
          <section class="card cal-week">
            <header class="cal-week-head">
              <button class="cal-nav" type="button" aria-label="Önceki hafta" @click="shiftWeek(-1)"><PkIcon class="pi pi-chevron-left" /></button>
              <h3>{{ weekLabel }}</h3>
              <button class="cal-nav" type="button" aria-label="Sonraki hafta" @click="shiftWeek(1)"><PkIcon class="pi pi-chevron-right" /></button>
            </header>
            <div class="cal-grid">
              <div v-for="day in week" :key="day.date" class="cal-col" :class="{ selected: day.date === selectedDay }" @click="selectedDay = day.date">
                <button type="button" class="cal-col-head" :aria-pressed="day.date === selectedDay" @click.stop="selectedDay = day.date"><strong>{{ day.weekday }}</strong><small>{{ day.label }}</small></button>
                <div class="cal-cell">
                  <template v-for="chip in day.chips.slice(0, CHIP_LIMIT)" :key="chip.key">
                    <button v-if="chip.plan" type="button" class="cal-chip plan" title="Planı düzenle" @click.stop="openPlan(chip.plan)">
                      <PkIcon :class="chip.icon" /><span><strong>{{ chip.title }}</strong><small>{{ chip.sub }}</small></span>
                    </button>
                    <span v-else class="cal-chip" :class="chip.tone"><PkIcon :class="chip.icon" /><span><strong>{{ chip.title }}</strong><small>{{ chip.sub }}</small></span></span>
                  </template>
                  <span v-if="day.chips.length > CHIP_LIMIT" class="cal-more">+{{ day.chips.length - CHIP_LIMIT }} daha</span>
                  <span v-if="!day.chips.length" class="cal-empty">–</span>
                </div>
              </div>
            </div>
            <footer class="cal-scope"><PkIcon class="pi pi-map-marker" /><strong>Kapsam:</strong> {{ scopeText }}</footer>
          </section>

          <section class="card cal-late">
            <header class="cal-late-head"><PkIcon class="pi pi-clock" /><h3>Geciken kontrol grupları</h3></header>
            <p v-if="!lateRows.length" class="muted">Geciken kontrol yok.</p>
            <button v-for="row in lateRows" :key="row.key" type="button" class="cal-late-row" @click="dayModal = row.date">
              <span class="cal-late-icon"><PkIcon :class="row.kind === 'installation' ? 'pi pi-sitemap' : 'pi pi-box'" /></span>
              <span class="cal-late-name"><strong>{{ row.name }}</strong><small v-if="row.meta">{{ row.meta }}</small></span>
              <span class="cal-late-days">{{ number(row.days) }} gün</span>
              <PkIcon class="pi pi-chevron-right" aria-hidden="true" />
            </button>
            <NuxtLink v-if="lateRows.length" to="/expert/kontroller/suresi-gecen" class="cal-link">Kayıtları aç <PkIcon class="pi pi-arrow-right" /></NuxtLink>
          </section>
        </div>
      </template>

      <!-- Yıllık plan: 12 ay (kontrol olmayan yılda da), planlar kesikli çizgiyle -->
      <template v-else>
        <ExpertControlCalendar :agenda="data.agenda || []" :undated="data.undated" :query="query" :rechecks="rechecks" :plans="scopedPlans" @edit-plan="openPlan" />
        <p class="cal-scope"><PkIcon class="pi pi-map-marker" /><strong>Kapsam:</strong> {{ scopeText }}</p>
      </template>
    </template>

    <ExpertControlDayModal v-if="dayModal" :date="dayModal" :entries="entriesOn(dayModal)" :rechecks="rechecksOn(dayModal)" :plans="plansOn(dayModal)" :query="query" @close="dayModal = null" @edit-plan="dayModal = null; openPlan($event)" />
    <ExpertControlPlanModal v-if="planEditor" :plan="planEditor.plan" :initial="planEditor.initial" @close="planEditor = null" @saved="onPlanSaved" @deleted="onPlanDeleted" />
  </div>
</template>

<script setup lang="ts">
import { agendaDate, agendaDateKey, agendaGroupsText, agendaMergedGroups, agendaNextDay, agendaShortName, controlPlanText, type AgendaEntry } from '~/composables/controlAgenda'

// Kontrol Takvimi: Ajanda (haftalık) ve Yıllık plan; Genel Bakış'ın verisiyle (/pk-dashboard), bulgu tekrar
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

// En yakın kontrol günü (bugün ya da sonrası).
const nextDay = computed(() => agendaNextDay(agenda.value))

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
.calendar-page{margin:0 auto;display:grid;gap:24px}
.page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:4px}
.page-head h1{margin:0;color:var(--admin-heading);font-size: 24px;font-weight: 700;line-height:1.15;letter-spacing: 0}.page-head p{margin:7px 0 0;color:var(--admin-muted);font-size:15px}
.crumb{display:flex;align-items:center;gap:8px;margin-bottom:8px;color:var(--admin-muted);font-size:13px}
.crumb a{color:var(--admin-muted)}.crumb a:hover{color:var(--admin-heading)}
.crumb strong{color:var(--admin-heading);font-weight:600}.crumb .pi-angle-right{font-size:11px}
.card{background:var(--admin-card);border:0;border-radius:var(--pk-radius);box-shadow:var(--pk-card-shadow);min-width:0}
.state{display:flex;align-items:center;justify-content:center;gap:8px;padding:60px 20px;color:var(--admin-muted);font-size:13px}
.error-text{color:var(--admin-danger-text)}
.reloading > *{opacity:.5;transition:opacity .15s}
.muted{margin:0;color:var(--admin-muted);font-size:13px}
.plans-error{display:flex;align-items:center;gap:8px;margin:0;padding:10px 14px;border-radius:10px;background:var(--admin-danger-bg);color:var(--admin-danger-text);font-size:13px}
/* Görünüm düğmesi ve mavi ana düğme */
.view-switch{display:inline-flex;gap:4px;margin-top:16px;padding:4px;border:1px solid rgba(145,158,171,.32);border-radius:10px;background:var(--admin-card)}
.view-switch button{min-height:38px;display:inline-flex;align-items:center;gap:7px;padding:0 14px;border:0;border-radius:7px;background:none;color:var(--admin-muted);font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.view-switch button.on{background:var(--pk-accent);color:var(--pk-on-accent)}
.plan-button{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:44px;padding:0 18px;border:0;border-radius:8px;background:var(--pk-accent);color:var(--pk-on-accent);font:inherit;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 8px 16px rgba(var(--pk-accent-rgb),.24)}
.plan-button:hover,.plan-button:focus-visible{background:var(--pk-accent-hover)}
.plan-button .pi-arrow-right{font-size:12px}
/* Üst sıra: özet ve en yakın kontrol, seçili gün */
.cal-top{display:grid;grid-template-columns:minmax(0,1.75fr) minmax(0,1fr);gap:24px;align-items:stretch}
.card.cal-summary{display:flex;flex-direction:column;padding:16px 24px 24px}
.cal-sum-row{display:flex;align-items:center;gap:16px;padding:12px 0;color:inherit}
.cal-sum-row + .cal-sum-row{border-top:1px dashed rgba(145,158,171,.24)}
.cal-sum-row:hover .cal-sum-text small,.cal-sum-row:focus-visible .cal-sum-text small{color:var(--admin-heading)}
.cal-sum-icon{flex:none;width:52px;height:52px;display:grid;place-items:center;border-radius:12px;background:var(--pk-primary-lighter);color:var(--pk-primary-dark);font-size:22px}
.cal-sum-icon.equipment{background:var(--pk-success-lighter);color:var(--pk-success-dark)}
.cal-sum-text{flex:1;min-width:0;display:flex;flex-direction:column}
.cal-sum-text strong{color:var(--admin-heading);font-size:28px;font-weight:700;line-height:1.15}.cal-sum-text small{color:var(--admin-muted);font-size:14px}
.cal-sum-row > .pi{color:var(--admin-muted);font-size:13px}
.cal-sum-note,.cal-sum-next{display:flex;align-items:center;gap:10px;margin:0;padding:12px 0;border-top:1px dashed rgba(145,158,171,.24);color:var(--admin-text);font-size:14px}
.cal-sum-next{color:var(--admin-heading);font-weight:600}.cal-sum-next i{color:var(--pk-accent)}
.cal-sum-alert{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:8px;background:var(--admin-danger-bg);color:var(--admin-danger-text);font-size:14px;font-weight:600}
.card.cal-day{display:flex;flex-direction:column;gap:12px;padding:24px}
.cal-day-head{display:flex;align-items:center;gap:12px}
.cal-day-head i{color:var(--pk-accent);font-size:18px}
.cal-day-head h3{margin:0;color:var(--admin-heading);font-size:17px;font-weight:700}
.cal-pill{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700;line-height:20px}
.cal-pill.warn{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.cal-pill.bad{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.cal-line{display:flex;align-items:center;gap:12px;padding:6px 0 10px;border-bottom:1px dashed rgba(145,158,171,.24);color:var(--admin-heading);font-size:14px}
.cal-line > .pi:first-child{color:var(--admin-muted);font-size:15px}
.cal-plan-line{width:100%;border:1px dashed rgba(145,158,171,.48);border-radius:8px;padding:8px 10px;background:none;font:inherit;text-align:left;cursor:pointer}
.cal-plan-line span{flex:1;min-width:0}.cal-plan-line .pi-pencil{color:var(--admin-muted);font-size:12px}
.cal-plan-line:hover{background:var(--admin-hover)}
.cal-day-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:auto}
.cal-day-actions > *{flex:1}
.cal-secondary{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:44px;padding:0 16px;border:1px solid rgba(145,158,171,.32);border-radius:8px;background:transparent;color:var(--admin-heading);font:inherit;font-size:14px;font-weight:700;cursor:pointer}
.cal-secondary:hover{background:rgba(145,158,171,.08)}.cal-secondary i{color:var(--pk-accent)}
/* Alt sıra: hafta ve geciken kontrol grupları */
.cal-bottom{display:grid;grid-template-columns:minmax(0,1.75fr) minmax(0,1fr);gap:24px}
.card.cal-week,.card.cal-late{display:flex;flex-direction:column;gap:16px;padding:24px}
.cal-week-head{display:flex;align-items:center;gap:14px}
.cal-week-head h3{margin:0;color:var(--admin-heading);font-size:17px;font-weight:700}
.cal-nav{width:36px;height:36px;display:grid;place-items:center;border:1px solid rgba(145,158,171,.32);border-radius:8px;background:transparent;color:var(--admin-heading);cursor:pointer}
.cal-nav:hover{background:rgba(145,158,171,.08)}
.cal-grid{display:grid;grid-template-columns:repeat(7,minmax(108px,1fr));overflow-x:auto;border-radius:12px}
.cal-col{display:flex;flex-direction:column;min-width:0;cursor:pointer}
.cal-col + .cal-col{border-left:1px solid rgba(145,158,171,.2)}
.cal-col.selected{background:var(--admin-accent-soft)}
.cal-col-head{display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 4px;border:0;background:rgba(145,158,171,.08);font:inherit;cursor:pointer}
.cal-col-head strong{color:var(--admin-muted);font-size:13px;font-weight:600}.cal-col-head small{color:var(--admin-muted);font-size:12px}
.cal-col.selected .cal-col-head strong,.cal-col.selected .cal-col-head small{color:var(--admin-accent-text)}
.cal-cell{flex:1;min-height:140px;display:flex;flex-direction:column;align-items:stretch;justify-content:center;gap:6px;padding:8px 6px}
.cal-empty{color:var(--admin-muted);text-align:center}
.cal-more{color:var(--admin-muted);font-size:12px;font-weight:700;text-align:center}
.cal-chip{display:flex;align-items:flex-start;gap:7px;min-width:0;padding:8px 9px;border:0;border-radius:8px;font:inherit;text-align:left}
.cal-chip > span{min-width:0;display:flex;flex-direction:column}
.cal-chip strong{font-size:13px;font-weight:700;line-height:1.25;overflow-wrap:anywhere}.cal-chip small{font-size:12px;opacity:.85}
.cal-chip > i{margin-top:2px;font-size:13px}
.cal-chip.due{background:var(--pk-accent);color:var(--pk-on-accent)}
.cal-chip.late{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.cal-chip.recheck{background:var(--admin-chip);color:var(--admin-heading)}
.cal-chip.plan{border:1px dashed rgba(145,158,171,.48);background:var(--admin-card);color:var(--admin-heading);cursor:pointer}
.cal-chip.plan:hover{background:var(--admin-hover)}
.cal-scope{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0;padding:0;color:var(--admin-muted);font-size:13px}
.cal-scope i{color:var(--admin-muted)}.cal-scope strong{color:var(--admin-heading)}
.cal-late-head{display:flex;align-items:center;gap:12px}
.cal-late-head i{color:var(--pk-accent);font-size:18px}
.cal-late-head h3{margin:0;color:var(--admin-heading);font-size:17px;font-weight:700}
.cal-late-row{display:grid;grid-template-columns:40px minmax(0,1fr) auto auto;align-items:center;gap:14px;width:100%;padding:12px 0;border:0;background:none;font:inherit;text-align:left;cursor:pointer}
.cal-late-row + .cal-late-row{border-top:1px dashed rgba(145,158,171,.24)}
.cal-late-row:hover .cal-late-name strong,.cal-late-row:focus-visible .cal-late-name strong{color:var(--admin-link)}
.cal-late-icon{width:40px;height:40px;display:grid;place-items:center;border-radius:10px;background:var(--pk-error-lighter);color:var(--pk-error-dark);font-size:16px}
.cal-late-name{min-width:0;display:flex;flex-direction:column}
.cal-late-name strong{color:var(--admin-heading);font-size:14px;font-weight:600}.cal-late-name small{color:var(--admin-muted);font-size:13px}
.cal-late-days{padding:2px 8px;border-radius:6px;background:var(--admin-danger-bg);color:var(--admin-danger-text);font-size:12px;font-weight:700;white-space:nowrap}
.cal-late-row > .pi{color:var(--admin-muted);font-size:13px}
.cal-link{display:inline-flex;align-items:center;gap:8px;color:var(--admin-link);font-size:14px;font-weight:700}
@media (max-width:1000px){.cal-bottom{grid-template-columns:minmax(0,1fr)}}
@media (max-width:900px){.cal-top{grid-template-columns:minmax(0,1fr)}}
@media (max-width:800px){
  .page-head h1{font-size: 22px}
}
</style>
