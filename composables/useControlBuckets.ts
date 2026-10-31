// Genel Bakış kontrol kartları ve detay ekranları: mevcut takvim verisinden (pk-dashboard agenda) tarih dilimleri.
// Her satır takvimdeki bir kalemdir (gün + lokasyon + grup); tüpler ve tesisat tek kalem sayılır.
import type { WorkplaceGroup } from '~/composables/useWorkplaceContext'

export type ControlBucket = 'bugun' | '7-gun' | '8-30-gun' | 'suresi-gecen'
export interface ControlRow { key: string; date: string; days_left: number; firm: string; location: string; kind: 'Ekipman' | 'Tesisat'; item: string }

export const CONTROL_BUCKETS: Record<ControlBucket, { label: string; title: string; icon: string; tone: string; priority: string; message: string; match: (days: number) => boolean }> = {
  bugun: { label: 'Bugün', title: 'Bugün Yapılacak Kontroller', icon: 'pi pi-calendar', tone: 'blue', priority: 'Son Gün', message: 'Kontrol tarihi bugün dolan kayıtlar var. İlgili kontrollerin gün içinde tamamlanmasını takip edin.', match: d => d === 0 },
  '7-gun': { label: 'Önümüzdeki 7 gün', title: 'Önümüzdeki 7 Gün Yapılacak Kontroller', icon: 'pi pi-calendar-plus', tone: 'amber', priority: 'Acil', message: 'Önümüzdeki 7 gün içinde kontrol tarihi dolacak kayıtlar var. Kontrolleri gecikmeden planlayın.', match: d => d >= 1 && d <= 7 },
  '8-30-gun': { label: '8 - 30 gün', title: '8 - 30 Gün Yapılacak Kontroller', icon: 'pi pi-calendar-clock', tone: 'slate', priority: 'Planlanmalı', message: 'Önümüzdeki 8-30 gün içinde kontrol zamanı gelecek kayıtlar var. Kontrol takviminizi buna göre düzenleyin.', match: d => d >= 8 && d <= 30 },
  'suresi-gecen': { label: 'Süresi geçen', title: 'Süresi Geçen Kontroller', icon: 'pi pi-exclamation-triangle', tone: 'red', priority: 'Süresi Aşıldı', message: 'Kontrol tarihi geçmiş ve yeni tarihi girilmemiş kontroller var. Gecikmeleri öncelikli olarak inceleyin.', match: d => d < 0 }
}
export const CONTROL_BUCKET_KEYS = Object.keys(CONTROL_BUCKETS) as ControlBucket[]

export const controlRows = (agenda: any[] | undefined, groups: WorkplaceGroup[]): ControlRow[] => {
  const firmOf = new Map(groups.map(g => [g.location_id, g.customer_name || '']))
  return (agenda || []).flatMap((entry: any) => (entry.groups || []).map((g: any) => ({
    key: `${entry.date}|${entry.location_id}|${g.key}`,
    date: entry.date,
    days_left: entry.days_left,
    firm: firmOf.get(entry.location_id) || '',
    location: entry.location_name || '',
    kind: g.kind === 'installation' ? 'Tesisat' as const : 'Ekipman' as const,
    item: g.count > 1 ? `${g.name} (${g.count})` : g.name
  })))
}

export const rowsOf = (rows: ControlRow[], bucket: ControlBucket) => {
  const list = rows.filter(row => CONTROL_BUCKETS[bucket].match(row.days_left))
  // Süresi geçende en eski önce; diğerlerinde en yakın tarih önce.
  return list.sort((a, b) => bucket === 'suresi-gecen' ? a.days_left - b.days_left : a.date.localeCompare(b.date))
}

export const priorityOf = (days: number) => CONTROL_BUCKET_KEYS.map(key => CONTROL_BUCKETS[key]).find(b => b.match(days))
export const formatControlDate = (value: string) => new Intl.DateTimeFormat('tr-TR').format(new Date(value))
