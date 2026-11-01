// Üstteki menünün Organizasyon kutusu (OSGB / kurumsal hesabın yöneticisi ve bireysel uzman): seçilen müşteri ya da organizasyon
// düğümü (alt düğümleriyle) lokasyon listesini daraltır; Genel Bakış ve Durum Raporu "Tüm lokasyonlar"da bunun lokasyonlarını
// gösterir. OSGB'de de kurumsalda da liste müşterilerin kök organizasyon düğümlerinden başlar (müşteri satırı yok).
// Seçim tarayıcıda saklanır.
export interface OrganizationNode { id: number; name: string; children: OrganizationNode[] }
interface OrganizationCustomer { id: number; name: string; nodes: OrganizationNode[]; location_ids: number[] }
interface OrganizationData { customers: OrganizationCustomer[]; location_nodes: Record<string, number> }

const SCOPE_KEY = 'pktakip_organization_scope'

export const useOrganizationScope = () => {
  const data = useState<OrganizationData | null>('organization-scope-data', () => null)
  const loading = useState('organization-scope-loading', () => false)
  // '' (tüm organizasyon) | 'c:<müşteri id>' | 'o:<düğüm id>'
  const scope = useState<string>('organization-scope', () => '')
  const scopeLoaded = useState('organization-scope-loaded', () => false)
  if (import.meta.client && !scopeLoaded.value) {
    scopeLoaded.value = true
    try { scope.value = localStorage.getItem(SCOPE_KEY) || '' } catch {}
  }
  const { isManager, account } = useAccount()
  const individual = computed(() => account.value?.type === 'expert')
  const available = computed(() => isManager.value || individual.value)
  const { get } = useExpertApi()

  const setScope = (value: string) => {
    scope.value = value
    if (!import.meta.client) return
    try { value ? localStorage.setItem(SCOPE_KEY, value) : localStorage.removeItem(SCOPE_KEY) } catch {}
  }

  // Kutudaki seçenekler, ağaç sırasıyla ve girinti derinliğiyle.
  const options = computed(() => {
    const list: { value: string; label: string; depth: number }[] = []
    const walk = (nodes: OrganizationNode[], depth: number) => nodes.forEach(node => {
      list.push({ value: `o:${node.id}`, label: node.name, depth })
      walk(node.children || [], depth + 1)
    })
    // OSGB'de de müşteri satırı yok: her müşterinin kök organizasyon düğümünden başlar (kurumsalda olduğu gibi).
    for (const customer of data.value?.customers || []) walk(customer.nodes, 0)
    return list
  })
  // Bireysel uzmanda alt organizasyon yoksa seçilecek bir şey de yok: kutu gizli.
  const visible = computed(() => individual.value ? options.value.some(option => option.depth > 0) : isManager.value && options.value.length > 0)

  // force: firma sayfasında yapı değişince liste tazelenir.
  const load = async (force = false) => {
    if (!available.value || (data.value && !force) || loading.value) return
    loading.value = true
    try { data.value = await get<OrganizationData>(individual.value ? '/pk-expert/organizations' : '/pk-account/organizations') }
    catch { data.value = { customers: [], location_nodes: {} } }
    finally { loading.value = false }
    // Hatırlanan seçim artık yoksa (düğüm silinmiş): tüm organizasyon.
    if (scope.value && !options.value.some(option => option.value === scope.value)) setScope('')
  }

  // Bir seçeneğin (müşteri ya da düğüm, alt düğümleriyle) lokasyonları; null: bulunamadı.
  const idsFor = (value: string): Set<number> | null => {
    if (!value || !data.value) return null
    const id = Number(value.slice(2))
    if (value.startsWith('c:')) {
      const customer = data.value.customers.find(item => item.id === id)
      return customer ? new Set(customer.location_ids) : null
    }
    const find = (nodes: OrganizationNode[]): OrganizationNode | null => {
      for (const node of nodes) {
        if (node.id === id) return node
        const found = find(node.children || [])
        if (found) return found
      }
      return null
    }
    const root = data.value.customers.map(customer => find(customer.nodes)).find(Boolean)
    if (!root) return null
    const subtree = new Set<number>()
    const collect = (node: OrganizationNode) => { subtree.add(node.id); (node.children || []).forEach(collect) }
    collect(root)
    return new Set(Object.entries(data.value.location_nodes).filter(([, node]) => subtree.has(node)).map(([location]) => Number(location)))
  }
  // Seçimin lokasyonları; null: daraltma yok (seçim yok, yönetici değil ya da veri gelmedi).
  const locationIds = computed<Set<number> | null>(() => visible.value && scope.value ? idsFor(scope.value) : null)
  const label = computed(() => locationIds.value ? options.value.find(option => option.value === scope.value)?.label || '' : '')

  return { load, available, options, visible, scope, setScope, locationIds, label, idsFor }
}
