export interface MyCompany { business_entity_id: number; company_id?: number; name: string; short_name?: string | null; company_type?: string | null; locations_count?: number; created_at?: string }
export interface NaceItem { id: number; nace_code: string; activity_name: string; hazard_class: string }

export const HAZARD_CLASSES = ['Az Tehlikeli', 'Tehlikeli', 'Çok Tehlikeli']

export const hazardClassKey = (value?: string | null) =>
  value === 'Çok Tehlikeli' ? 'very-high' : value === 'Tehlikeli' ? 'high' : 'low'

// Backend'deki kontrolle aynı: "Arçelik A.Ş", "ARÇELİK A.Ş." ve "arcelik aş" aynı firma sayılır.
export const normalizeCompanyName = (name: string) =>
  name.replace(/I/g, 'ı').replace(/İ/g, 'i').toLocaleLowerCase('tr-TR')
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
    .replace(/[^a-z0-9]/g, '')

// Uzman paneli API çağrıları: auth + tenant header'larını ekler.
export const useExpertApi = () => {
  const config = useRuntimeConfig()
  const { authHeaders, user } = useAuth()

  const headers = () => ({
    ...authHeaders(),
    ...(user.value?.tenant_id ? { 'X-Tenant-ID': String(user.value.tenant_id) } : {})
  })
  const url = (path: string) => `${config.public.apiBaseUrl}${path}`

  const get = <T = any>(path: string, query?: Record<string, any>) =>
    $fetch<T>(url(path), { headers: headers(), query })
  const post = <T = any>(path: string, body: Record<string, any>) =>
    $fetch<T>(url(path), { method: 'POST', headers: headers(), body })
  // Dosya yükleme (multipart); Content-Type'ı tarayıcı sınır değeriyle kendisi ayarlar.
  const postForm = <T = any>(path: string, body: FormData) =>
    $fetch<T>(url(path), { method: 'POST', headers: headers(), body })
  const patch = <T = any>(path: string, body: Record<string, any>) =>
    $fetch<T>(url(path), { method: 'PATCH', headers: headers(), body })
  const del = <T = any>(path: string) =>
    $fetch<T>(url(path), { method: 'DELETE', headers: headers() })

  const errorMessage = (e: any, fallback: string) => {
    const errors = e?.data?.errors
    return (errors && (Object.values(errors).flat()[0] as string)) || e?.data?.message || fallback
  }

  return { get, post, postForm, patch, del, errorMessage }
}
