// Genel Bakış ve Durum Raporu kapsamı: uzmanın tüm lokasyonları; müşteri → lokasyon → işyeri filtresiyle daralır.
// İki sayfa aynı seçimi paylaşır (sayfalar arasında geçince korunur).
const NO_CUSTOMER = 'Müşterisiz'

export const useDashboardScope = () => {
  const { groups, load } = useMyWorkplaces()
  const customer = useState<string>('dashboard-customer', () => '')
  const locationId = useState<number | null>('dashboard-location', () => null)
  const workplaceId = useState<number | null>('dashboard-workplace', () => null)

  const customerOf = (group: { customer_name?: string | null }) => group.customer_name || NO_CUSTOMER
  const customers = computed(() => [...new Set(groups.value.map(customerOf))].sort((a, b) => a.localeCompare(b, 'tr')))
  const locations = computed(() => groups.value.filter(group => !customer.value || customerOf(group) === customer.value))
  const workplaces = computed(() => groups.value.find(group => group.location_id === locationId.value)?.items || [])
  const locationIds = computed(() => locationId.value ? [locationId.value] : locations.value.map(group => group.location_id))
  // API sorgusu: location_ids[] (seçimdeki lokasyonlar), işyeri yalnızca tek lokasyonda.
  const query = computed(() => ({
    'location_ids[]': locationIds.value,
    ...(locationId.value && workplaceId.value ? { workplace_id: workplaceId.value } : {})
  }))

  // Grafik ve listelerde lokasyon: aynı adlı lokasyonlar olabildiği için müşteri adıyla.
  const locationLabel = (id: number | null | undefined, fallback?: string | null) => {
    const group = groups.value.find(item => item.location_id === id)
    return group ? [group.customer_name, group.location_name].filter(Boolean).join(' · ') : (fallback || '—')
  }
  const scopeLabel = computed(() => {
    if (locationId.value) {
      const workplace = workplaces.value.find(item => item.id === workplaceId.value)
      return [locationLabel(locationId.value), workplace?.company_name].filter(Boolean).join(' · ')
    }
    return customer.value ? `${customer.value} · ${locations.value.length} lokasyon` : `Tüm lokasyonlar · ${groups.value.length} lokasyon`
  })

  const setCustomer = (value: string) => { customer.value = value; locationId.value = null; workplaceId.value = null }
  const setLocation = (value: number | null) => {
    locationId.value = value
    workplaceId.value = null
    // Lokasyon seçilince müşterisi de seçili gelir (grafikten tıklanınca da).
    const group = groups.value.find(item => item.location_id === value)
    if (group) customer.value = customerOf(group)
  }
  const setWorkplace = (value: number | null) => { workplaceId.value = value }
  const reset = () => setCustomer('')

  return { groups, load, customer, locationId, workplaceId, customers, locations, workplaces, locationIds, query, locationLabel, scopeLabel, setCustomer, setLocation, setWorkplace, reset }
}
