// Müşteri türü (kurumsal / şahıs / kamu): OSGB ve bireysel uzman müşteri eklerken seçer (backend: pk-customer-types,
// customers.customer_type). "Lokasyona Firma Ata" sihirbazı soruyu türe göre sorar; boşsa bir kez sorar ve kaydeder.
export type CustomerType = 'corporate' | 'individual' | 'public'

export const CUSTOMER_TYPES: { id: CustomerType; label: string; icon: string; text: string }[] = [
  { id: 'corporate', label: 'Kurumsal firma', icon: 'pi pi-building', text: 'Şirket, holding ya da grup şirketleri.' },
  { id: 'individual', label: 'Şahıs işletmesi', icon: 'pi pi-user', text: 'Tek kişiye ait işletme; lokasyonlar şubesidir.' },
  { id: 'public', label: 'Kamu kurumu', icon: 'pi pi-flag', text: 'Belediye, il müdürlüğü, hastane, okul.' }
]

export const customerTypeLabel = (type?: string | null) => CUSTOMER_TYPES.find(t => t.id === type)?.label || ''

export const useCustomerTypes = () => {
  const { get, patch } = useExpertApi()
  // Hesabın müşterileri: müşteri kimliği → tür (boşsa null).
  const load = () => get<Record<string, CustomerType | null>>('/pk-customer-types').catch(() => ({} as Record<string, CustomerType | null>))
  const save = (customerId: number | string, type: CustomerType | null) => patch(`/pk-customer-types/${customerId}`, { type })
  return { load, save }
}
