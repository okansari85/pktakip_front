<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <section class="modal-card">
      <div class="modal-head">
        <div>
          <h2>{{ longDate }}</h2>
          <p><span class="days" :class="timingOf(daysLeft)">{{ daysText(daysLeft) }}</span> · {{ total }} ekipmanın kontrolü dolar</p>
        </div>
        <button class="close-button" type="button" @click="emit('close')"><i class="pi pi-times" /></button>
      </div>

      <div v-for="entry in entries" :key="entry.location_id ?? 0" class="entry">
        <h3><i class="pi pi-map-marker" /> {{ locationLabel(entry.location_id, entry.location_name) }}</h3>
        <div v-for="group in entry.groups" :key="group.key" class="group" :class="{ open: isOpen(entry, group) }">
          <button type="button" class="group-toggle" @click="toggle(entry, group)">
            <i class="pi" :class="isOpen(entry, group) ? 'pi-chevron-down' : 'pi-chevron-right'" />
            <strong>{{ groupText(group) }}</strong>
            <small v-if="group.kind === 'type' && shortName(group.name) !== group.name">{{ group.name }}</small>
          </button>
          <div v-if="isOpen(entry, group)" class="group-body">
            <NuxtLink v-if="group.kind === 'installation'" class="link-button" to="/expert/installations">Tesisatlar <i class="pi pi-arrow-right" /></NuxtLink>
            <p v-if="listOf(entry, group)?.loading" class="muted">Yükleniyor...</p>
            <p v-else-if="listOf(entry, group)?.error" class="error-text">{{ listOf(entry, group)?.error }}</p>
            <ExpertEquipmentDueTable v-else :items="listOf(entry, group)?.items || []" :limit="20" />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// Kontrol takviminde bir gün: o gün kontrolü dolan ekipman lokasyona göre, gruplu (tesisat, tüp, tür). Gruba tıklayınca
// ekipmanları açılır (satır ekipmana gider).
const props = defineProps<{ date: string; entries: AgendaEntry[]; query: Record<string, any> }>()
const emit = defineEmits<{ close: [] }>()

const { get, errorMessage } = useExpertApi()
const { locationLabel } = useDashboardScope()

const timingOf = agendaTiming
const groupText = agendaGroupText
const shortName = agendaShortName
const longDate = computed(() => new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }).format(agendaDate(props.date)))
const daysLeft = computed(() => props.entries[0]?.days_left ?? null)
const total = computed(() => props.entries.reduce((sum, entry) => sum + entry.total, 0))
const daysText = (days: number | null) => days === null ? '—' : days < 0 ? `${-days} gün geçti` : days === 0 ? 'Bugün' : `${days} gün kaldı`

// Açık gruplar ve ekipman listeleri (lokasyon + grup başına bir kez alınır).
const keyOf = (entry: AgendaEntry, group: AgendaGroup) => `${entry.location_id}|${group.key}`
const open = ref<string[]>([])
const lists = reactive<Record<string, { loading: boolean; items: any[]; error: string }>>({})
const isOpen = (entry: AgendaEntry, group: AgendaGroup) => open.value.includes(keyOf(entry, group))
const listOf = (entry: AgendaEntry, group: AgendaGroup) => lists[keyOf(entry, group)]

const load = async (entry: AgendaEntry, group: AgendaGroup) => {
  const key = keyOf(entry, group)
  if (lists[key] && !lists[key].error) return
  lists[key] = { loading: true, items: [], error: '' }
  try {
    lists[key].items = await get('/pk-dashboard/due', { ...props.query, 'location_ids[]': [entry.location_id], date: props.date, group: group.key })
  } catch (e: any) {
    lists[key].error = errorMessage(e, 'Liste alınamadı.')
  } finally { lists[key].loading = false }
}
const toggle = (entry: AgendaEntry, group: AgendaGroup) => {
  const key = keyOf(entry, group)
  if (open.value.includes(key)) { open.value = open.value.filter(item => item !== key); return }
  open.value = [...open.value, key]
  load(entry, group)
}

// Günde tek grup varsa doğrudan açık gelir.
const only = props.entries.length === 1 && props.entries[0]?.groups.length === 1 ? props.entries[0] : null
if (only?.groups[0]) toggle(only, only.groups[0])
</script>

<style scoped>
.modal-backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:var(--admin-overlay)}
.modal-card{width:min(920px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:22px;background:var(--admin-card);border-radius:12px;box-shadow:0 20px 60px var(--admin-shadow)}
.modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:14px}
h2{margin:0;color:var(--admin-heading);font-size:18px}.modal-head p{margin:5px 0 0;color:var(--admin-muted);font-size:12px}
.close-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:var(--admin-muted);cursor:pointer;border-radius:7px}.close-button:hover{background:var(--admin-hover);color:var(--admin-heading)}
.days{font-weight:800}.days.overdue{color:var(--admin-danger-text)}.days.d30,.days.d60{color:var(--admin-upcoming-text)}.days.later{color:var(--admin-success-text)}
.entry{padding-top:12px;border-top:1px solid var(--admin-border)}.entry + .entry{margin-top:14px}
h3{display:flex;align-items:center;gap:7px;margin:0 0 8px;color:var(--admin-heading);font-size:14px}h3 i{color:var(--admin-muted);font-size:13px}
.group{border-radius:9px}.group.open{background:var(--admin-soft)}
.group-toggle{display:flex;align-items:baseline;flex-wrap:wrap;gap:8px;width:100%;padding:9px 10px;border:0;border-radius:9px;background:none;font:inherit;text-align:left;cursor:pointer;color:var(--admin-text)}
.group-toggle:hover{background:var(--admin-hover)}
.group-toggle i{color:var(--admin-muted);font-size:10px}.group-toggle strong{color:var(--admin-heading);font-size:13px}.group-toggle small{color:var(--admin-muted);font-size:11px}
.group-body{display:grid;gap:8px;padding:2px 10px 12px}
.link-button{justify-self:start;display:inline-flex;align-items:center;gap:6px;color:var(--admin-link);font-size:12px;font-weight:700;text-decoration:none}
.muted{margin:0;color:var(--admin-muted);font-size:12px}.error-text{margin:0;color:var(--admin-danger-text);font-size:12px}
</style>
