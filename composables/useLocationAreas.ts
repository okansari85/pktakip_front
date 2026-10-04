// Lokasyonun alanları (isteğe bağlı; Ayarlar → Lokasyonlar → Alanlar): fiziksel yerler (bina, kat, depo, yemekhane…); seçim
// kutuları için düz liste (alt alan "Üst › Alt"),
// ekipman / tesisat → alan eşlemesi ve alan atama. Lokasyonda alan yoksa liste boştur; ekranlar alan kutusunu hiç göstermez,
// her şey bugünkü gibi çalışır.
export interface AreaOption {
  id: number
  label: string
  typeName: string
  active: boolean
}

// Alan fiziksel yerdir: seçim kutularında yalnızca adı (alt alan "Üst › Alt").
export const areaText = (area: AreaOption) => area.label

export const useLocationAreas = () => {
  const { get, post } = useExpertApi()
  const options = ref<AreaOption[]>([])
  const assignments = ref<{ equipment: Record<string, number>; installations: Record<string, number> }>({ equipment: {}, installations: {} })
  const byId = computed(() => new Map(options.value.map(area => [area.id, area])))
  let request = 0

  const option = (area: any, label: string): AreaOption => ({
    id: area.id, label, typeName: area.type?.name || '', active: area.is_active !== false
  })

  const load = async (locationId?: number | null, withAssignments = false) => {
    const current = ++request
    if (!locationId) { options.value = []; assignments.value = { equipment: {}, installations: {} }; return }
    try {
      const data = await get('/pk-areas', { location_id: locationId })
      const flat: AreaOption[] = []
      for (const area of data.areas || []) {
        flat.push(option(area, area.name))
        for (const child of area.children || []) flat.push(option(child, `${area.name} › ${child.name}`))
      }
      const map = withAssignments && flat.length ? await get('/pk-areas/assignments', { location_id: locationId }) : null
      if (current !== request) return
      options.value = flat
      assignments.value = { equipment: map?.equipment || {}, installations: map?.installations || {} }
    } catch {
      if (current === request) { options.value = []; assignments.value = { equipment: {}, installations: {} } }
    }
  }

  const setEquipmentArea = (equipmentId: number, areaId: number | null) => post(`/pk-equipment/${equipmentId}/area`, { pk_area_id: areaId })
  const setInstallationArea = (installationId: number, areaId: number | null) => post(`/pk-installations/${installationId}/area`, { pk_area_id: areaId })

  return { options, assignments, byId, load, setEquipmentArea, setInstallationArea }
}
