// Bireysel uzmanın firma akışı: firma → organizasyon düğümü → lokasyon → işyeri zincirini mevcut uçlarla sırayla kurar.
// Backend değişmez; uçlar ayrı olduğu için yarıda kesilen kurulumda "ilerleme" korunur, tekrar denenince yalnız kalan adım çalışır.
import { normalizeCompanyName, useExpertApi, type MyCompany } from '~/composables/useExpertApi'
import { useCustomerTypes, type CustomerType } from '~/composables/useCustomerTypes'

export type FirmKind = 'sahis' | 'limited' | 'holding' | 'kamu'
export interface Firm { id: number | string; name: string; type: CustomerType | null; locations_count: number; workplaces_count: number }
export interface FirmNode { id: number | string; name: string; children?: FirmNode[] }
export interface FirmLocation { id: number | string; name: string; city?: string | null; district?: string | null; organization_id?: number | string | null }
export interface FirmProgress { customerId?: number | string; rootId?: number | string }
export interface WorkplaceProgress { locationId?: number | string; workplaceDone?: boolean }
export interface LocationDraft { name: string; cityId: number | null; districtId: number | null; address: string; hazard: string; company: string; naceCode?: string | null; activity?: string | null }

export const FIRM_KINDS: { id: FirmKind; type: CustomerType; title: string; text: string; icon: string; tone: string; nameLabel: string; placeholder: string; hasTree: boolean }[] = [
  { id: 'sahis', type: 'individual', title: 'Şahıs işletmesi', text: 'Vergi dairesine kayıtlı, tek kişiye ait işletme.', icon: 'pi pi-user', tone: 'green', nameLabel: 'İşletmenin adı', placeholder: 'Örn. ABC Mobilya', hasTree: false },
  { id: 'limited', type: 'corporate', title: 'Limited / Anonim şirket', text: 'Tek şirket: Ltd. Şti. ya da A.Ş.', icon: 'pi pi-building', tone: 'blue', nameLabel: 'Şirketin adı', placeholder: 'Örn. ABC Ltd. Şti.', hasTree: false },
  { id: 'holding', type: 'corporate', title: 'Holding ya da grup', text: 'Birden fazla şirketi olan yapı. En tepeden başlamanız gerekmez, yalnız bir grubu da ekleyebilirsiniz.', icon: 'pi pi-sitemap', tone: 'purple', nameLabel: 'Holdingin ya da grubun adı', placeholder: 'Örn. ABC Holding ya da ABC Enerji Grubu', hasTree: true },
  { id: 'kamu', type: 'public', title: 'Kamu kurumu', text: 'Belediye, il müdürlüğü, hastane, okul.', icon: 'pi pi-flag', tone: 'orange', nameLabel: 'Kurumun adı', placeholder: 'Örn. ABC Belediyesi', hasTree: true }
]

const unwrap = (response: any) => response?.data?.data ?? response?.data ?? response
const toList = (data: any, key?: string) => Array.isArray(data) ? data : (key && data?.[key]) || data?.items || []

export const useFirmSetup = () => {
  const { get, post } = useExpertApi()
  const { load: loadTypes, save: saveType } = useCustomerTypes()
  const { status: billing, load: loadBilling } = useBilling()
  const { setName } = useWorkplaceNames()

  const listFirms = async (): Promise<Firm[]> => {
    const [customers, counts, types] = await Promise.all([
      get('/customers'),
      get<Record<string, number>>('/customer-company-counts').catch(() => ({} as Record<string, number>)),
      loadTypes()
    ])
    return toList(unwrap(customers)).map((c: any) => ({
      id: c.id, name: c.name, type: types[String(c.id)] ?? null,
      locations_count: c.locations_count ?? 0, workplaces_count: counts[String(c.id)] ?? 0
    }))
  }

  const loadStructure = async (customerId: number | string) => {
    const [tree, locations] = await Promise.all([
      get(`/customers/${customerId}/organizations`),
      get(`/customers/${customerId}/locations`)
    ])
    const treeData = unwrap(tree)
    return { nodes: toList(treeData, 'organizations') as FirmNode[], locations: toList(unwrap(locations)) as FirmLocation[] }
  }

  const addNode = async (customerId: number | string, name: string, parentId: number | string | null) =>
    unwrap(await post(`/customers/${customerId}/organizations`, { name, parent_id: parentId, color: '#465FFF' }))?.id as number | string

  // Firma: müşteri kaydı, türü ve aynı adlı kök düğüm. progress dolu gelirse yapılmış adımlar atlanır.
  const createFirm = async (kind: FirmKind, name: string, progress: FirmProgress) => {
    const type = FIRM_KINDS.find(k => k.id === kind)!.type
    if (!progress.customerId) {
      progress.customerId = unwrap(await post('/customers', { name, notes: null }))?.id
      if (!progress.customerId) throw new Error('Firma oluşturulamadı.')
      // Tür kaydedilemezse firma yine çalışır; ilk gereken yerde yeniden sorulur.
      await saveType(progress.customerId, type).catch(() => {})
    }
    if (!progress.rootId) progress.rootId = await addNode(progress.customerId, name, null)
    return progress as Required<FirmProgress>
  }

  const workplaceLimitMessage = async () => {
    await loadBilling()
    const b = billing.value
    const limit = b?.unlimited ? null : b?.workplace_limit
    return limit != null && (b?.active_workplaces ?? 0) >= limit
      ? `İşyeri hakkınız doldu (${b?.active_workplaces} / ${limit}). Yeni firma eklemek için paketinizi yükseltin.`
      : ''
  }

  // Lokasyon boş bir yerdir: ağacın herhangi bir düğümüne bağlanır, firma sonra eklenir.
  const addLocation = async (customerId: number | string, nodeId: number | string, draft: LocationDraft) => {
    const locationName = draft.name.trim()
    const created = unwrap(await post(`/customers/${customerId}/organizations/${nodeId}/locations`, {
      name: locationName, city_id: draft.cityId, district_id: draft.districtId, address: draft.address.trim() || null
    }))
    const id = created?.id ?? (await loadStructure(customerId)).locations.find(l => l.name === locationName)?.id
    if (!id) throw new Error('Lokasyon oluşturulamadı.')
    return id as number | string
  }

  // Lokasyon ve işyeri: düğüme lokasyon eklenir, firma kartı bulunur ya da açılır, lokasyona işyeri bağlanır.
  const addWorkplace = async (customerId: number | string, nodeId: number | string, draft: LocationDraft, type: CustomerType | null, progress: WorkplaceProgress) => {
    const locationName = draft.name.trim()
    if (!progress.locationId) progress.locationId = await addLocation(customerId, nodeId, draft)
    // Kamu kurumunda her birimin kartı lokasyonun adıyla açılır (mevcut sihirbazla aynı kural).
    const companyName = (type === 'public' ? locationName : draft.company).trim()
    const companies = await get<MyCompany[]>('/my-companies')
    const key = normalizeCompanyName(companyName)
    const existing = companies.find(c => normalizeCompanyName(c.name) === key)
    const businessEntityId = existing?.business_entity_id
      ?? (await post<MyCompany>('/my-companies', { name: companyName, company_type: type === 'individual' ? 'individual' : 'corporate' })).business_entity_id
    const path = `/customers/${customerId}/locations/${progress.locationId}/companies`
    await post(path, { business_entity_id: businessEntityId, hazard_class: draft.hazard, nace_code: draft.naceCode ?? null, activity: draft.activity ?? null, sgk_workplace_number: null })
    progress.workplaceDone = true
    // Şahıs işletmesinde işyeri lokasyonun adını taşır (şube); ad kaydedilemezse işyeri yine çalışır.
    if (type === 'individual') {
      const items = await get<{ id: number; business_entity_id: number }[]>(path).catch(() => [])
      const id = items.filter(i => i.business_entity_id === businessEntityId).sort((a, b) => b.id - a.id)[0]?.id
      if (id) await setName(id, locationName).catch(() => {})
    }
    loadBilling()
    return progress.locationId
  }

  return { listFirms, loadStructure, addNode, createFirm, addLocation, addWorkplace, workplaceLimitMessage }
}

// Yeni eklenen işyerini aktif çalışma alanı yapıp ekipman sayfasını açar.
export const useGoToEquipment = () => {
  const { load, groups, selectLocation } = useMyWorkplaces()
  return async (locationId: number | string) => {
    await load(true)
    const group = groups.value.find(g => String(g.location_id) === String(locationId))
    if (group) selectLocation(group)
    await navigateTo('/expert/equipment')
  }
}
