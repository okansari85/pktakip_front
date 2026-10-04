<template>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Tesisat</th><th>Lokasyon</th><th>Durum</th><th>Son kontrol</th><th>Geçerlilik</th><th>Kalan gün</th><th>Sistemler</th><th>Kontrolü yapan</th></tr></thead>
      <tbody>
        <template v-for="group in groups" :key="group.key">
          <!-- Tür satırı: tek kayıtsa kaydın kendisi; birden çok kayıtsa en sorunlu kaydın durumu ve tarihleri, tıklayınca kayıtlar -->
          <tr :class="{ group: group.items.length > 1, open: isOpen(group.key) }" @click="group.items.length > 1 && toggle(group.key)">
            <td>
              <span class="title">
                <i v-if="group.items.length > 1" class="pi chevron" :class="isOpen(group.key) ? 'pi-chevron-down' : 'pi-chevron-right'" />
                <strong>{{ group.name }}</strong>
                <span v-if="group.items.length > 1" class="count">{{ group.items.length }} kayıt</span>
              </span>
              <small v-if="group.items.length > 1">{{ group.items.map(recordName).join(', ') }}</small>
              <small v-else-if="hasOwnName(group.items[0])">{{ group.items[0].name }}</small>
            </td>
            <td class="muted">{{ locationsText(group.items) }}</td>
            <td>
              <span class="status-badge" :class="group.worst.status">{{ STATUS_LABELS[group.worst.status] || group.worst.status }}</span>
              <small v-if="group.items.length > 1 && statusMix(group.items)">{{ statusMix(group.items) }}</small>
            </td>
            <td class="nowrap">{{ formatDate(group.worst.last_control_date) }}</td>
            <td class="nowrap">{{ formatDate(group.worst.next_control_date) }}</td>
            <td class="nowrap" :class="daysClass(group.worst.days_left)">{{ daysText(group.worst.days_left) }}</td>
            <td class="nowrap"><span :class="systemsClass(group.items)">{{ systemsText(group.items) }}</span></td>
            <td class="muted body-cell" :title="bodiesText(group.items)">{{ bodiesText(group.items) || '—' }}</td>
          </tr>
          <!-- Kayıtlar (bina / tesis geneli) -->
          <template v-if="group.items.length > 1 && isOpen(group.key)">
            <tr v-for="item in group.items" :key="item.id" class="child">
              <td><span class="child-name">{{ recordName(item) }}</span></td>
              <td class="muted">{{ locationsText([item]) }}</td>
              <td><span class="status-badge" :class="item.status">{{ STATUS_LABELS[item.status] || item.status }}</span></td>
              <td class="nowrap">{{ formatDate(item.last_control_date) }}</td>
              <td class="nowrap">{{ formatDate(item.next_control_date) }}</td>
              <td class="nowrap" :class="daysClass(item.days_left)">{{ daysText(item.days_left) }}</td>
              <td class="nowrap"><span :class="systemsClass([item])">{{ systemsText([item]) }}</span></td>
              <td class="muted body-cell" :title="item.inspection_body || ''">{{ item.inspection_body || '—' }}</td>
            </tr>
          </template>
        </template>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
// Tesisat özeti (Genel Bakış, Lokasyonlar sekmesinin altı): aynı türdeki tesisat kayıtları (ör. bina bazında yangın algılama)
// tek satırda gruplu; satırda en sorunlu kaydın durumu ve tarihleri, tıklayınca kayıtlar. En sorunlu tür üstte
// (uygun değil, kontrol yok, rapor bekleniyor, uygun; aynı durumda süresi en çok geçmiş önce). Veri pk-dashboard installations.
const props = defineProps<{ installations: any[] }>()

const STATUS_LABELS: Record<string, string> = { uygun: 'Uygun', uygun_degil: 'Uygun değil', rapor_bekleniyor: 'Rapor bekleniyor', rapor_yok: 'Kontrol yok', belirtilmemis: 'Belirtilmemiş' }
const STATUS_ORDER = ['uygun_degil', 'rapor_yok', 'rapor_bekleniyor', 'belirtilmemis', 'uygun']

const { locationLabel } = useDashboardScope()
const { load: loadNames, workplaceLabel } = useWorkplaceNames()
onMounted(() => loadNames())

const rank = (status: string) => {
  const index = STATUS_ORDER.indexOf(status)
  return index < 0 ? STATUS_ORDER.length : index
}
const compare = (a: any, b: any) => rank(a.status) - rank(b.status)
  || (a.days_left ?? Number.MAX_SAFE_INTEGER) - (b.days_left ?? Number.MAX_SAFE_INTEGER)
  || String(a.name || '').localeCompare(String(b.name || ''), 'tr')

const groups = computed(() => {
  const map = new Map<string, { key: string; name: string; items: any[] }>()
  for (const item of props.installations) {
    const key = String(item.type?.id ?? item.type?.name ?? item.name)
    const group = map.get(key) || { key, name: item.type?.name || item.name, items: [] }
    group.items.push(item)
    map.set(key, group)
  }
  return [...map.values()]
    .map(group => {
      const items = [...group.items].sort(compare)
      return { ...group, items, worst: items[0] }
    })
    .sort((a, b) => compare(a.worst, b.worst) || a.name.localeCompare(b.name, 'tr'))
})

const open = ref<string[]>([])
const isOpen = (key: string) => open.value.includes(key)
const toggle = (key: string) => { open.value = isOpen(key) ? open.value.filter(item => item !== key) : [...open.value, key] }

// Kaydın adı türden farklıysa bina / bölüm adıdır; aynıysa tesis geneli.
const hasOwnName = (item: any) => !!item.name && !!item.type?.name && item.name !== item.type.name
const recordName = (item: any) => hasOwnName(item) ? item.name : 'Tesis geneli'
const unique = (values: any[]) => [...new Set(values.filter(Boolean))]
const locationsText = (items: any[]) => {
  const labels = unique(items.map(item => [locationLabel(item.location?.id, item.location_name), item.workplace && workplaceLabel(item.workplace.id, item.workplace.company_name)].filter(Boolean).join(' · ')))
  return labels.length > 1 ? `${labels.length} lokasyon` : labels[0] || '—'
}
const bodiesText = (items: any[]) => {
  const bodies = unique(items.map(item => item.inspection_body))
  return bodies.length > 1 ? `${bodies.length} kuruluş` : bodies[0] || ''
}
// Gruptaki kayıtların durum dağılımı (ör. "1 uygun · 1 uygun değil"); hepsi aynıysa yazılmaz.
const statusMix = (items: any[]) => {
  const counts = new Map<string, number>()
  items.forEach(item => counts.set(item.status, (counts.get(item.status) || 0) + 1))
  if (counts.size < 2) return ''
  return [...counts.entries()].sort((a, b) => rank(a[0]) - rank(b[0])).map(([status, count]) => `${count} ${(STATUS_LABELS[status] || status).toLocaleLowerCase('tr-TR')}`).join(' · ')
}
const systemsText = (items: any[]) => {
  const total = items.reduce((sum, item) => sum + (item.systems_count || 0), 0)
  const bad = items.reduce((sum, item) => sum + (item.nonconforming_systems || 0), 0)
  return !total ? '—' : bad ? `${bad} / ${total} uygun değil` : `${total} sistem`
}
const systemsClass = (items: any[]) => {
  const total = items.reduce((sum, item) => sum + (item.systems_count || 0), 0)
  return !total ? 'muted' : items.some(item => item.nonconforming_systems) ? 'bad-text' : 'ok-text'
}

const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('tr-TR').format(new Date(value)) : '—'
const daysText = (days: number | null) => days === null || days === undefined ? '—' : days < 0 ? `${-days} gün geçti` : days === 0 ? 'Bugün' : `${days} gün`
const daysClass = (days: number | null) => days === null || days === undefined ? 'muted' : days < 0 ? 'bad-text' : days <= 60 ? 'warn-text' : ''
</script>

<style scoped>
.table-wrap{overflow:auto}
table{width:100%;border-collapse:collapse}th,td{padding:9px 12px;text-align:left;border-bottom:1px solid var(--admin-row-border);font-size:12px;color:var(--admin-text);vertical-align:top}
th{font-size:11px;font-weight:700;color:var(--admin-muted);background:var(--admin-soft);white-space:nowrap}
td small{display:block;margin-top:3px;color:var(--admin-muted);font-size:11px}
.title{display:inline-flex;align-items:center;gap:7px}.title strong{color:var(--admin-heading)}
.chevron{font-size:10px;color:var(--admin-muted)}
.count{padding:1px 7px;border-radius:999px;background:var(--admin-chip);color:var(--admin-muted);font-size:10px;font-weight:700;white-space:nowrap}
tr.group{cursor:pointer}tr.group:hover td{background:var(--admin-hover)}tr.group.open td{background:var(--admin-soft)}
tr.child td{background:var(--admin-soft)}.child-name{display:block;padding-left:24px;color:var(--admin-heading);font-weight:600}
.nowrap{white-space:nowrap}
.ok-text{color:var(--admin-success-text);font-weight:700}.bad-text{color:var(--admin-danger-text);font-weight:700}.warn-text{color:var(--admin-warning-text);font-weight:700}.muted{color:var(--admin-muted)}
.body-cell{max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.status-badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap;background:var(--admin-chip);color:var(--admin-muted)}
.status-badge.uygun{background:var(--admin-success-bg);color:var(--admin-success-text)}.status-badge.uygun_degil{background:var(--admin-danger-bg);color:var(--admin-danger-text)}.status-badge.rapor_bekleniyor{background:var(--admin-warning-bg);color:var(--admin-warning-text)}
</style>
