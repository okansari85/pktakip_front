// Genel Bakış ve Durum Raporu kapsamı: üstteki lokasyon / firma menüsünden (tek seçim, bütün sayfalar). Menüde "Tüm
// lokasyonlar" seçiliyse (ya da hiç lokasyon seçilmediyse) uzmanın bütün lokasyonları; lokasyon seçiliyse o lokasyon,
// firma da seçiliyse o işyeri. Ayrı sayfa filtresi yok.
const NO_CUSTOMER = 'Müşterisiz'

export const useDashboardScope = () => {
  const { groups, load, selectLocation, selectWorkplace } = useMyWorkplaces()
  const { context, allLocations, setAllLocations } = useWorkplaceContext()
  // Yöneticinin Organizasyon seçimi: "Tüm lokasyonlar" o müşterinin / düğümün (alt düğümleriyle) lokasyonları.
  const { locationIds: orgLocationIds, label: orgLabel } = useOrganizationScope()

  const locations = computed(() => orgLocationIds.value ? groups.value.filter(group => orgLocationIds.value!.has(group.location_id)) : groups.value)
  const contextInScope = computed(() => !!context.value && locations.value.some(group => group.location_id === context.value!.location_id))
  // Tek lokasyon varsa "tüm lokasyonlar" yok: o lokasyon (menüde seçili ve kilitli).
  const all = computed(() => groups.value.length !== 1 && (allLocations.value || !contextInScope.value))
  const locationId = computed<number | null>(() => all.value ? null : context.value?.location_id ?? null)
  const workplaceId = computed<number | null>(() => !all.value && context.value?.type === 'workplace' ? context.value.workplace_id ?? null : null)
  // Kapsam daraltılmışsa (organizasyon seçili, tüm lokasyonlarında) onun adı; Uzmanlar sekmesi de buna göre daralır.
  const customer = computed(() => all.value && orgLocationIds.value ? orgLabel.value : '')

  const customerOf = (group: { customer_name?: string | null }) => group.customer_name || NO_CUSTOMER
  const customers = computed(() => [...new Set(groups.value.map(customerOf))].sort((a, b) => a.localeCompare(b, 'tr')))
  const workplaces = computed(() => groups.value.find(group => group.location_id === locationId.value)?.items || [])
  const locationIds = computed(() => locationId.value ? [locationId.value] : locations.value.map(group => group.location_id))
  // API sorgusu: location_ids[] (seçimdeki lokasyonlar), işyeri yalnızca tek lokasyonda.
  const query = computed(() => ({
    'location_ids[]': locationIds.value,
    ...(locationId.value && workplaceId.value ? { workplace_id: workplaceId.value } : {})
  }))

  // Grafik ve listelerde lokasyon: aynı adlı lokasyonlar olabildiği için müşteri adıyla. Kurumsal hesapta müşteri firmanın
  // kendisi (tek müşteri): yalnızca lokasyon adı.
  const { corporate } = useAccount()
  const locationLabel = (id: number | null | undefined, fallback?: string | null) => {
    const group = groups.value.find(item => item.location_id === id)
    if (!group) return fallback || '—'
    return corporate.value ? group.location_name : [group.customer_name, group.location_name].filter(Boolean).join(' · ')
  }
  const scopeLabel = computed(() => {
    if (locationId.value) {
      const workplace = workplaces.value.find(item => item.id === workplaceId.value)
      return [locationLabel(locationId.value, context.value?.location_name), workplace?.company_name || (workplaceId.value ? context.value?.company_name : null)].filter(Boolean).join(' · ')
    }
    return `${orgLocationIds.value ? orgLabel.value : 'Tüm lokasyonlar'} · ${locations.value.length} lokasyon`
  })

  // Seçimler üstteki menüyü değiştirir (ör. Lokasyon özetinde satıra tıklamak o lokasyonu seçer; diğer sayfalar da onunla açılır).
  const setLocation = (value: number | null) => {
    const group = value ? groups.value.find(item => item.location_id === value) : null
    if (group) selectLocation(group)
    else setAllLocations(true)
  }
  const setWorkplace = (value: number | null) => {
    const group = groups.value.find(item => item.location_id === locationId.value)
    const item = group?.items.find(entry => entry.id === value)
    if (group && item) selectWorkplace(group, item)
    else if (group) selectLocation(group)
  }
  const reset = () => setAllLocations(true)
  const setCustomer = (_value: string) => reset()

  return { groups, load, customer, locationId, workplaceId, customers, locations, workplaces, locationIds, query, locationLabel, scopeLabel, setCustomer, setLocation, setWorkplace, reset }
}
