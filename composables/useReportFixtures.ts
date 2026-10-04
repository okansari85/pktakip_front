// Rapor analizi test verileri (fikstür, test sayfasında üretilir): seçilirse yapay zeka çağrılmaz, rapor kota harcamadan tekrar denenir.
export const fixtureOrigin = (fixture: { context?: { mode?: string; type?: string } | null; provider?: string | null }) => {
  if (fixture.provider === 'elle') return 'elle hazırlandı'
  if (fixture.context?.mode === 'catalog') return 'ekipman raporu'
  if (fixture.context?.mode === 'installation') return 'tesisat raporu'
  if (fixture.context?.mode === 'electrical') {
    if (fixture.context?.type === 'topraklama') return 'topraklama tesisatı raporu'
    if (fixture.context?.type === 'yangin-algilama') return 'yangın algılama raporu'
    if (fixture.context?.type === 'havalandirma-klima') return 'havalandırma ve klima raporu'
    if (fixture.context?.type === 'paratoner') return 'paratoner raporu'
    if (fixture.context?.type === 'akumulator') return 'akümülatör raporu'
    if (fixture.context?.type === 'trafo') return 'trafo merkezi raporu'
    return 'elektrik iç tesisatı raporu'
  }
  if (fixture.context?.mode === 'bulk') return 'tüp raporu'
  return 'eski test'
}

export const useReportFixtures = () => {
  const { get } = useExpertApi()
  const fixtures = ref<any[]>([])
  const loaded = ref(false)
  const formatDateTime = (value?: string | null) => value ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : ''
  // Model adı: aynı raporun farklı sağlayıcılarla (Gemini / OpenAI / NVIDIA) okunmuş hallerini ayırmak için.
  const fixtureLabel = (fixture: any) => [fixture.original_file_name, fixtureOrigin(fixture), fixture.input === 'image' && 'görüntüden okundu', fixture.input === 'ocr' && 'OCR ile okundu', fixture.provider !== 'elle' && fixture.model, formatDateTime(fixture.created_at)].filter(Boolean).join(' · ')
  // Test verisi yalnızca süper admine (uzman / OSGB / kurumsal görmez): liste boş kalınca pencerelerdeki seçim de çıkmaz.
  const { superAdmin } = useAuth()
  const loadFixtures = async () => {
    if (loaded.value || !superAdmin.value) return
    loaded.value = true
    try { fixtures.value = (await get<any>('/pk-report-analyses')).fixtures || [] } catch { fixtures.value = [] }
  }

  return { fixtures, fixtureLabel, loadFixtures }
}
