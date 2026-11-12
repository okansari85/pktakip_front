// Bulgu Takip (2026-11-12): durum adları / renkleri, geçmiş yazıları ve menüdeki açık bulgu rozeti.
// "Aksiyon" kelimesi hiçbir yerde kullanılmaz (kullanıcı kararı).
export const FINDING_STATUS: Record<string, { label: string; tone: 'bad' | 'info' | 'warn' | 'ok' }> = {
  acik: { label: 'Açık', tone: 'bad' },
  devam: { label: 'Devam ediyor', tone: 'info' },
  tekrar_kontrol: { label: 'Tekrar kontrol bekliyor', tone: 'warn' },
  kapandi: { label: 'Kapandı', tone: 'ok' }
}

export const FINDING_EVENT_LABELS: Record<string, string> = {
  olusturuldu: 'Rapordan bulgu oluştu',
  tekrar_goruldu: 'Yeni raporda tekrar görüldü',
  guncellendi: 'Güncellendi',
  not: 'Not eklendi',
  dosya: 'Kanıt dosyası eklendi',
  oneri: 'Yeni rapor uygun: kapatma önerildi',
  oneri_reddedildi: 'Kapatma önerisi reddedildi',
  kapandi: 'Bulgu kapatıldı',
  yeniden_acildi: 'Yeniden açıldı',
  rapordan_cikarildi: 'Rapordan çıkarıldı',
  hatirlatma: 'Termin hatırlatması gönderildi'
}

export const FINDING_FIELD_LABELS: Record<string, string> = {
  work: 'Yapılacak iş', responsible_user_id: 'Sorumlu', due_date: 'Termin', recheck_date: 'Tekrar kontrol', status: 'Durum'
}

// "2026-11-05" → "05.11.2026"
export const findingDay = (value?: string | null) => value ? value.slice(0, 10).split('-').reverse().join('.') : '—'

// Menüdeki rozet: kullanıcının lokasyonlarındaki kapanmamış bulgular (Bulgu Takip sayfası değişince yeniler).
export const useFindingCount = () => {
  const open = useState<number | null>('pk-findings-open', () => null)
  const { get } = useExpertApi()
  const { groups, load } = useMyWorkplaces()

  const refresh = async () => {
    await load()
    if (!groups.value.length) { open.value = 0; return }
    try {
      const result = await get<{ open: number }>('/pk-findings/count', { 'location_ids[]': groups.value.map(group => group.location_id) })
      open.value = result.open
    } catch { /* rozet görünmez; sayfa çalışmaya devam eder */ }
  }

  return { open, refresh }
}
