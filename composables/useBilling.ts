// Paket ve kredi (Paketim, Kredi hareketleri). Birim "kredi": yalnızca rapor okuma düşer (metin / OCR 1, görüntü 3, tesisat ve
// tüp kontrol formu 5); paketin ayrı aktif işyeri limiti var (her lokasyon-firma kaydı bir işyeri; kullanıcı sınırsız). Mevcut hesaplar paket atanana kadar sınırsız (geçiş).
export interface BillingStatus {
  mode: 'unlimited' | 'package' | 'promo' | 'none'
  unlimited: boolean
  package?: { id: number; name: string } | null
  monthly_credits?: number
  credits?: number
  workplace_limit?: number | null
  active_workplaces?: number
  next_grant_at?: string | null
  resets_at?: string | null
  started_at?: string | null
  // Ödenen dönemin bitişi (satın alınan paket); yoksa null.
  paid_until?: string | null
}
// Fiyatlar KDV hariç; backend string ("1249.00") ya da sayı gönderebilir.
export interface PkPackage { id: number; name: string; monthly_price: string | number; yearly_price: string | number; monthly_credits: number; workplace_limit: number | null }
export interface PackagesResponse { can_pay: boolean; cannot_pay_reason: string | null; packages: PkPackage[]; status: BillingStatus }
export interface BillingProfile { invoice_type: 'bireysel' | 'kurumsal'; name: string; tckn?: string | null; tax_number?: string | null; tax_office?: string | null; phone: string; address: string; billing_address: string }
export interface PkOrder {
  merchant_oid: string
  status: 'pending' | 'paid' | 'failed' | 'attention'
  package: { id: number; name: string } | null
  period: 'monthly' | 'yearly'
  net_amount: string | number
  vat_amount: string | number
  total_amount: string | number
  created_at: string
  paid_at: string | null
}
export const ORDER_STATUS: Record<PkOrder['status'], { label: string; severity: string }> = {
  paid: { label: 'Ödendi', severity: 'success' },
  failed: { label: 'Başarısız', severity: 'danger' },
  pending: { label: 'Bekliyor', severity: 'warn' },
  attention: { label: 'İnceleniyor', severity: 'info' }
}
export const PERIOD_LABELS: Record<string, string> = { monthly: 'Aylık', yearly: 'Yıllık' }
// "1.249,00 ₺"
export const formatTl = (value: string | number) => `${Number(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`
export const formatDay = (value: string) => new Intl.DateTimeFormat('tr-TR').format(new Date(value.replace(' ', 'T')))
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

  const packages = () => get<PackagesResponse>('/pk-billing/packages')
  const orders = (page = 1) => get<{ data: PkOrder[]; total: number; current_page: number; last_page: number }>('/pk-billing/orders', { page })

  return { status, load, entries, packages, orders }
}
