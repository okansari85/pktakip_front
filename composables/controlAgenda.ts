// Kontrol takvimi (Genel Bakış): gün + lokasyon başına kontrolü dolan ekipman grupları (tesisat, tüp, tür) ve yazımı.
export interface AgendaGroup { key: string; kind: 'installation' | 'tube' | 'type'; id: number | null; name: string; count: number }
export interface AgendaEntry { date: string; days_left: number; location_id: number | null; location_name: string | null; total: number; groups: AgendaGroup[] }

const GROUP_ORDER = { installation: 0, tube: 1, type: 2 }

// Parantez içi açıklama olmadan tür adı: "Endüstriyel Kapı (Seksiyonel / Sürgülü / Otomatik)" → "Endüstriyel Kapı".
export const agendaShortName = (name: string) => name.split(' (')[0] || name

// "3 Forklift", "468 Yangın tüpü"; tesisat: "Yangın Tesisatı (315 ekipman)", aynı adlı birden çok: "2 Yangın Tesisatı (500 ekipman)".
export const agendaGroupText = (group: AgendaGroup & { installations?: number }) => group.kind === 'installation'
  ? `${(group.installations || 1) > 1 ? `${group.installations} ` : ''}${group.name} (${group.count} ekipman)`
  : `${group.count} ${agendaShortName(group.name)}`

// Bir günün grupları (birden çok lokasyon olabilir) birleşik: türler toplanır, aynı adlı tesisatlar tek kalem.
export const agendaMergedGroups = (entries: AgendaEntry[]) => {
  const merged = new Map<string, AgendaGroup & { installations: number }>()
  for (const entry of entries) {
    for (const group of entry.groups) {
      const key = group.kind === 'installation' ? `installation|${group.name}` : group.key
      const current = merged.get(key)
      if (!current) { merged.set(key, { ...group, installations: 1 }); continue }
      current.count += group.count
      if (group.kind === 'installation') current.installations++
    }
  }
  return [...merged.values()].sort((a, b) => GROUP_ORDER[a.kind] - GROUP_ORDER[b.kind] || b.count - a.count || a.name.localeCompare(b.name, 'tr'))
}
export const agendaGroupsText = (entries: AgendaEntry[]) => agendaMergedGroups(entries).map(agendaGroupText).join(', ')

// En yakın kontrol günü (bugün ya da sonrası) ve o günün kalemleri: Ana sayfa iş planı ve Genel bakış takvim kartı.
export const agendaNextDay = (agenda: AgendaEntry[] | undefined) => {
  const entries = (agenda || []).filter(entry => entry.days_left >= 0)
  const date = entries.map(entry => entry.date).sort()[0]
  return date ? { date, days_left: entries.find(entry => entry.date === date)!.days_left, entries: entries.filter(entry => entry.date === date) } : null
}

// Kontrol planı (pk-control-plans): ne kontrol edileceği ("Yangın Tesisatı · Forklift · 2 ekipman"); başlık varsa başlığı.
export const controlPlanSubject = (plan: any) => [plan.installation?.name, plan.equipment_type_name && agendaShortName(plan.equipment_type_name), plan.equipment?.length ? `${plan.equipment.length} ekipman` : ''].filter(Boolean).join(' · ')
export const controlPlanText = (plan: any) => plan.title || controlPlanSubject(plan) || 'Planlı kontrol'

// Kontrol zamanı (renk): süresi geçmiş / 30 gün içinde / 31–60 gün / 60 günden sonra.
export const agendaTiming = (days: number | null | undefined) => days === null || days === undefined ? 'none' : days < 0 ? 'overdue' : days <= 30 ? 'd30' : days <= 60 ? 'd60' : 'later'

// "2026-11-05" ↔ yerel tarih (saat dilimi kaymadan).
export const agendaDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year || 0, (month || 1) - 1, day || 1)
}
export const agendaDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
