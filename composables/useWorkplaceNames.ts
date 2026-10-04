// İşyeri adı (isteğe bağlı): firmanın lokasyondaki kaydının (işyeri) kendi adı, ör. Eskişehir'de Arçelik A.Ş.'nin iki işyeri
// "Eskişehir Buzdolabı İşletmesi" / "Eskişehir Kompresör İşletmesi"; Beylikdüzü'nde Arçelik Pazarlama'nın "Müşteri Hizmetleri"
// işyeri. Firma tüzel kişi, işyeri onun lokasyondaki kaydı, alan fiziksel yer. Ekranlarda işyeri "Ad · Firma" diye görünür; adı
// yoksa yalnızca firma adı. Hesabın bütün işyeri adları bir kez alınır, ekranlar paylaşır.
export const useWorkplaceNames = () => {
  const names = useState<Record<string, string>>('workplace-names', () => ({}))
  const loaded = useState('workplace-names-loaded', () => false)
  const { get, post } = useExpertApi()

  const load = async (force = false) => {
    if (loaded.value && !force) return
    loaded.value = true
    try { names.value = (await get<Record<string, string>>('/pk-workplace-names')) || {} } catch { loaded.value = false }
  }
  const nameOf = (workplaceId?: number | null) => workplaceId ? names.value[String(workplaceId)] || '' : ''
  // "Ad · Firma" (adı yoksa firma adı).
  const workplaceLabel = (workplaceId: number | null | undefined, companyName?: string | null) => {
    const name = nameOf(workplaceId)
    return name ? [name, companyName].filter(Boolean).join(' · ') : companyName || ''
  }
  // Tablolarda iki satır: üstte işletme adı (yoksa firma), altta firma (adı yoksa boş).
  const workplaceTitle = (workplaceId: number | null | undefined, companyName?: string | null) => nameOf(workplaceId) || companyName || ''
  const workplaceFirm = (workplaceId: number | null | undefined, companyName?: string | null) => nameOf(workplaceId) ? companyName || '' : ''
  const setName = async (workplaceId: number, name: string | null) => {
    await post(`/pk-workplace-names/${workplaceId}`, { name })
    const next = { ...names.value }
    if (name?.trim()) next[String(workplaceId)] = name.trim()
    else delete next[String(workplaceId)]
    names.value = next
  }
  // Aynı firmanın bu lokasyondaki ek işyeri (adı zorunlu).
  const addAdditional = async (payload: { location_id: number; business_entity_id: number; name: string; hazard_class: string; nace_code?: string | null; activity?: string | null; sgk_workplace_number?: string | null }) => {
    const created = await post<{ id: number; name: string }>('/pk-workplaces/additional', payload)
    names.value = { ...names.value, [String(created.id)]: created.name }
    return created
  }

  return { names, load, nameOf, workplaceLabel, workplaceTitle, workplaceFirm, setName, addAdditional }
}
