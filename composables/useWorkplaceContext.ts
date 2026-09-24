// Uzman panelindeki aktif çalışma alanı: bir lokasyonun tamamı ya da lokasyondaki tek bir işyeri.
// Tarayıcıda saklanır; Ayarlar sayfaları bu context'i kullanmaz.
export interface WorkplaceContext {
  type: 'location' | 'workplace'
  location_id: number
  location_name: string
  customer_name?: string | null
  workplace_id?: number
  company_name?: string
}

export interface Workplace { id: number; company_name: string; customer_name?: string | null; location_id: number; location_name: string; organization_name?: string | null; nace_code?: string | null; hazard_class: string; sgk_workplace_number?: string | null }
export interface WorkplaceGroup { location_id: number; location_name: string; customer_name?: string | null; organization_name?: string | null; items: Workplace[] }

const STORAGE_KEY = 'pktakip_workplace_context'

// İşyerlerini lokasyona göre gruplar (müşteri, sonra lokasyon adına göre sıralı).
export const groupWorkplaces = (workplaces: Workplace[]): WorkplaceGroup[] => {
  const map = new Map<number, WorkplaceGroup>()
  for (const item of workplaces) {
    if (!map.has(item.location_id)) map.set(item.location_id, { location_id: item.location_id, location_name: item.location_name, customer_name: item.customer_name, organization_name: item.organization_name, items: [] })
    map.get(item.location_id)!.items.push(item)
  }
  return [...map.values()]
    .map(group => ({ ...group, items: [...group.items].sort((a, b) => a.company_name.localeCompare(b.company_name, 'tr')) }))
    .sort((a, b) => (a.customer_name || '').localeCompare(b.customer_name || '', 'tr') || a.location_name.localeCompare(b.location_name, 'tr'))
}

// Uzmanın işyerleri; Firmalarım sayfası ve topbar seçicisi aynı listeyi paylaşır.
export const useMyWorkplaces = () => {
  const workplaces = useState<Workplace[]>('my-workplaces', () => [])
  const loading = useState('my-workplaces-loading', () => false)
  const loaded = useState('my-workplaces-loaded', () => false)
  const error = useState('my-workplaces-error', () => '')
  const { get, errorMessage } = useExpertApi()
  const { context, setContext } = useWorkplaceContext()

  const load = async (force = false) => {
    if (loading.value || (loaded.value && !force)) return
    loading.value = true
    error.value = ''
    try {
      workplaces.value = await get<Workplace[]>('/my-workplaces')
      loaded.value = true
      // Hatırlanan context artık listede yoksa (silinmiş/kaldırılmış) temizlenir.
      const current = context.value
      if (current && !(current.type === 'workplace'
        ? workplaces.value.some(w => w.id === current.workplace_id)
        : workplaces.value.some(w => w.location_id === current.location_id))) setContext(null)
    } catch (e: any) {
      error.value = errorMessage(e, 'İşyerleri alınamadı.')
    } finally { loading.value = false }
  }

  const groups = computed(() => groupWorkplaces(workplaces.value))

  const selectLocation = (group: WorkplaceGroup) => setContext({ type: 'location', location_id: group.location_id, location_name: group.location_name, customer_name: group.customer_name })
  const selectWorkplace = (group: WorkplaceGroup, item: Workplace) => setContext({
    type: 'workplace', location_id: group.location_id, location_name: group.location_name, customer_name: group.customer_name,
    workplace_id: item.id, company_name: item.company_name
  })
  const isLocationActive = (locationId: number) => context.value?.type === 'location' && context.value.location_id === locationId
  const isWorkplaceActive = (workplaceId: number) => context.value?.type === 'workplace' && context.value.workplace_id === workplaceId

  return { workplaces, groups, loading, loaded, error, load, selectLocation, selectWorkplace, isLocationActive, isWorkplaceActive }
}

export const useWorkplaceContext = () => {
  const context = useState<WorkplaceContext | null>('workplace-context', () => null)
  const loaded = useState('workplace-context-loaded', () => false)

  if (import.meta.client && !loaded.value) {
    loaded.value = true
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) context.value = JSON.parse(stored)
    } catch { localStorage.removeItem(STORAGE_KEY) }
  }

  const setContext = (value: WorkplaceContext | null) => {
    context.value = value
    if (!import.meta.client) return
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    else localStorage.removeItem(STORAGE_KEY)
  }

  const label = computed(() => {
    if (!context.value) return null
    return context.value.type === 'workplace'
      ? `${context.value.company_name} · ${context.value.location_name}`
      : `${context.value.location_name} · Tüm lokasyon`
  })

  return { context, setContext, label }
}
