// Paket ve kredi (Paketim, Kredi hareketleri). Birim "kredi": yalnızca rapor okuma düşer (metin / OCR 1, görüntü 3, tesisat ve
// tüp kontrol formu 5); ekipman için paketin ayrı aktif ekipman limiti var. Mevcut hesaplar paket atanana kadar sınırsız (geçiş).
export interface BillingStatus {
  mode: 'unlimited' | 'package' | 'promo' | 'none'
  unlimited: boolean
  package?: { id: number; name: string } | null
  monthly_credits?: number
  credits?: number
  equipment_limit?: number | null
  active_equipment?: number
  next_grant_at?: string | null
  resets_at?: string | null
}
export interface CreditEntry {
  id: number
  amount: number
  reason: 'grant' | 'promo' | 'reading' | 'manual' | 'reset'
  note: string | null
  created_at: string
  user: string | null
  analysis: string | null
  kind: string | null
  input: string | null
  file_name: string | null
  detected_type: string | null
}

const REPORT_KINDS: Record<string, string> = { equipment: 'Ekipman raporu', equipment_new: 'Rapordan ekipman tanımlama', bulk: 'Tüp kontrol formu', installation: 'Tesisat raporu' }
export const MODE_LABELS: Record<string, string> = { unlimited: 'Sınırsız (geçiş)', package: 'Paket', promo: 'Ücretsiz deneme', none: 'Paket yok' }

// Hareketin yazısı: "Rapor okundu · Tesisat raporu · dosya.pdf", "Paket kredisi yüklendi" …
export const entryText = (entry: CreditEntry) => {
  if (entry.reason === 'reading') {
    return ['Rapor okundu', entry.kind && REPORT_KINDS[entry.kind], entry.input === 'image' && 'görüntüden', entry.detected_type, entry.file_name].filter(Boolean).join(' · ')
  }
  const base: Record<string, string> = { grant: 'Paket kredisi yüklendi', promo: 'Ücretsiz deneme kredisi', manual: 'Elle düzeltme', reset: 'Kredi sıfırlandı' }
  return [base[entry.reason] || entry.reason, entry.reason === 'grant' || entry.reason === 'promo' ? null : entry.note].filter(Boolean).join(' · ')
}

export const formatEntryDate = (value: string) => new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value.replace(' ', 'T')))

export const useBilling = () => {
  const { get } = useExpertApi()
  const status = useState<BillingStatus | null>('pk-billing-status', () => null)

  const load = async () => {
    try { status.value = await get<BillingStatus>('/pk-billing') } catch { status.value = null }
  }
  const entries = (page = 1) => get<{ data: CreditEntry[]; total: number; current_page: number; last_page: number }>('/pk-billing/entries', { page })

  return { status, load, entries }
}
