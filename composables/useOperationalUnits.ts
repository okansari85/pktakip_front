// Operasyonel birimler (isteğe bağlı): işyerinin (firmanın lokasyondaki kaydı) içinde ayrı yönetilen birimler, ör. Arçelik
// Pazarlama Beylikdüzü'nde "Beyaz Eşya Depo" ve "Müşteri Hizmetleri". Birim fiziksel değildir; kullandığı alanlar ayrıca seçilir.
// Ekipman firmaya (işyerine) ait, birimi isteğe bağlı ve yalnızca kendi işyerinin birimi. Birimi olmayan işyerinde birim kutusu
// hiç görünmez.
export interface OperationalUnit {
  id: number
  name: string
  manager: string | null
  is_active: boolean
  workplace_id: number
  workplace: string | null
  areas: { id: number; name: string }[]
  equipment_count: number
}

export const useOperationalUnits = () => {
  const { get, post, patch, del } = useExpertApi()
  const units = ref<OperationalUnit[]>([])
  const assignments = ref<Record<string, number>>({})
  const byId = computed(() => new Map(units.value.map(unit => [unit.id, unit])))
  let request = 0

  const load = async (locationId?: number | null, withAssignments = false) => {
    const current = ++request
    if (!locationId) { units.value = []; assignments.value = {}; return }
    try {
      const data = await get('/pk-units', { location_id: locationId })
      const map = withAssignments && data.units?.length ? await get('/pk-units/assignments', { location_id: locationId }) : null
      if (current !== request) return
      units.value = data.units || []
      assignments.value = map?.equipment || {}
    } catch {
      if (current === request) { units.value = []; assignments.value = {} }
    }
  }
  // İşyerinin aktif birimleri (ekipman formları); düzenlemede mevcut birim pasif olsa da listede kalır.
  const unitsOf = (workplaceId?: number | null, keepId?: number | null) => workplaceId
    ? units.value.filter(unit => unit.workplace_id === workplaceId && (unit.is_active || unit.id === keepId))
    : []
  const unitOfEquipment = (equipmentId: number) => {
    const id = assignments.value[String(equipmentId)]
    return id ? byId.value.get(id) || null : null
  }
  const setEquipmentUnit = (equipmentId: number, unitId: number | null) => post(`/pk-equipment/${equipmentId}/unit`, { pk_operational_unit_id: unitId })
  const save = (body: Record<string, any>, unitId?: number | null) => unitId ? patch<any>(`/pk-units/${unitId}`, body) : post<any>('/pk-units', body)
  const remove = (unitId: number) => del<any>(`/pk-units/${unitId}`)

  return { units, assignments, byId, load, unitsOf, unitOfEquipment, setEquipmentUnit, save, remove }
}
