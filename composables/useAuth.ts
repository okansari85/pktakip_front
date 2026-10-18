export type AuthUser = {
  id: number
  name: string
  email: string
  roles: string[]
  is_expert: boolean
  tenant_id: number | null
}

export const useAuth = () => {
  const token = useState<string | null>('auth-token', () => null)
  const user = useState<AuthUser | null>('auth-user', () => null)
  // Süper admin bir hesaba girdiyse (kendi oturumu pktakip_admin_* altında saklı): "Süper admine dön" görünür.
  const impersonating = useState<boolean>('auth-impersonating', () => false)
  // Hesaba giren süper adminin kendi rolleri (saklı oturumundan): uzman panelinde yalnızca süper admine açık menüler için.
  const adminRoles = useState<string[]>('auth-admin-roles', () => [])
  const config = useRuntimeConfig()

  const readAdminRoles = () => {
    try { adminRoles.value = JSON.parse(localStorage.getItem('pktakip_admin_user') || 'null')?.roles || [] } catch { adminRoles.value = [] }
  }
  const loadStoredAuth = () => {
    if (!import.meta.client || token.value) return
    token.value = localStorage.getItem('pktakip_token')
    const storedUser = localStorage.getItem('pktakip_user')
    if (storedUser) {
      try { user.value = JSON.parse(storedUser) } catch { localStorage.removeItem('pktakip_user') }
    }
    impersonating.value = Boolean(localStorage.getItem('pktakip_admin_token'))
    readAdminRoles()
  }
  // Süper admin: kendi oturumu süper admin ya da bir hesaba süper admin olarak girmiş (Yapay zeka ayarı, Test sayfası).
  const superAdmin = computed(() => !!user.value?.roles?.includes('super-admin') || (impersonating.value && adminRoles.value.includes('super-admin')))

  // Oturum anahtarını sunucuda siler (çıkış).
  const revoke = (value: string | null) => value
    ? $fetch(`${config.public.apiBaseUrl}/logout`, { method: 'POST', headers: { Authorization: `Bearer ${value}` } }).catch(() => undefined)
    : Promise.resolve()
  // Uzman panelinde seçili lokasyon / işyeri (useWorkplaceContext): süper admin bir hesaba girerken kenara alınır, o
  // hesapta önceki oturumun seçimi kullanılmaz; hesaptan çıkınca geri konur.
  const CONTEXT_KEY = 'pktakip_workplace_context'
  const clearAdminSession = () => {
    localStorage.removeItem('pktakip_admin_token')
    localStorage.removeItem('pktakip_admin_user')
    const stashed = localStorage.getItem('pktakip_admin_workplace_context')
    if (stashed !== null) {
      if (stashed) localStorage.setItem(CONTEXT_KEY, stashed)
      else localStorage.removeItem(CONTEXT_KEY)
      localStorage.removeItem('pktakip_admin_workplace_context')
    }
    impersonating.value = false
    adminRoles.value = []
  }

  const login = async (email: string, password: string) => {
    const response = await $fetch<{ token: string; user: AuthUser; message: string }>(`${config.public.apiBaseUrl}/login`, {
      method: 'POST', body: { email, password },
    })
    if (!response.user.roles.includes('super-admin') && !response.user.is_expert) {
      throw new Error('Bu panel yalnızca yetkili kullanıcılar içindir.')
    }
    // Süper adminin pasife aldığı hesap (kullanıcı 19 Ekim 2026): oturum açılmaz, alınan jeton kapatılır.
    if (!response.user.roles.includes('super-admin')) {
      try {
        await $fetch(`${config.public.apiBaseUrl}/pk-account`, { headers: { Authorization: `Bearer ${response.token}`, Accept: 'application/json' } })
      } catch (e: any) {
        if (e?.data?.code === 'hesap_pasif') {
          await $fetch(`${config.public.apiBaseUrl}/logout`, { method: 'POST', headers: { Authorization: `Bearer ${response.token}` } }).catch(() => undefined)
          throw new Error(e.data.message)
        }
      }
    }
    token.value = response.token
    user.value = response.user
    if (import.meta.client) {
      localStorage.setItem('pktakip_token', response.token)
      localStorage.setItem('pktakip_user', JSON.stringify(response.user))
      // Yeni giriş: önceden kalmış süper admin oturumu varsa bu kullanıcıya geçmez.
      clearAdminSession()
    }
  }

  const logout = async () => {
    loadStoredAuth()
    if (token.value) await $fetch(`${config.public.apiBaseUrl}/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token.value}` } }).catch(() => undefined)
    token.value = null
    user.value = null
    if (import.meta.client) {
      localStorage.removeItem('pktakip_token')
      localStorage.removeItem('pktakip_user')
      // Süper admin bir hesaptayken çıkarsa saklanan kendi oturumu da kapanır.
      await revoke(localStorage.getItem('pktakip_admin_token'))
      clearAdminSession()
    }
    await navigateTo('/login')
  }

  // Süper admin bir hesaba girer: kendi oturumu saklanır, hesabın yöneticisi olarak panele geçilir. Sayfa baştan yüklenir:
  // önceki hesabın bellekteki listeleri (işyerleri, filtreler) yeni hesapta kullanılmaz.
  const startImpersonation = (nextToken: string, nextUser: AuthUser) => {
    if (!import.meta.client) return
    loadStoredAuth()
    if (!localStorage.getItem('pktakip_admin_token') && token.value && user.value) {
      localStorage.setItem('pktakip_admin_token', token.value)
      localStorage.setItem('pktakip_admin_user', JSON.stringify(user.value))
      localStorage.setItem('pktakip_admin_workplace_context', localStorage.getItem(CONTEXT_KEY) ?? '')
    }
    localStorage.removeItem(CONTEXT_KEY)
    token.value = nextToken
    user.value = nextUser
    localStorage.setItem('pktakip_token', nextToken)
    localStorage.setItem('pktakip_user', JSON.stringify(nextUser))
    impersonating.value = true
    readAdminRoles()
    reloadNuxtApp({ path: '/expert' })
  }

  // Süper admin hesaptayken o hesabın başka bir kullanıcısı olarak girer (Kullanıcılar sayfası): istek saklı süper admin
  // oturumuyla yapılır, önceki giriş anahtarı silinir, sayfa baştan yüklenir.
  const impersonateUser = async (tenantId: number, userId: number) => {
    if (!import.meta.client) return
    const adminToken = localStorage.getItem('pktakip_admin_token')
    if (!adminToken) throw new Error('Süper admin oturumu bulunamadı.')
    const response = await $fetch<{ token: string; user: AuthUser }>(`${config.public.apiBaseUrl}/pk-accounts/${tenantId}/users/${userId}/impersonate`, {
      method: 'POST', headers: { Accept: 'application/json', Authorization: `Bearer ${adminToken}` }
    })
    await revoke(token.value)
    startImpersonation(response.token, response.user)
  }

  // "Süper admine dön": hesaba giriş anahtarı silinir, süper admin oturumu geri gelir (Müşteriler sayfası, baştan yüklenir).
  const stopImpersonation = async () => {
    if (!import.meta.client) return
    const adminToken = localStorage.getItem('pktakip_admin_token')
    const adminUser = localStorage.getItem('pktakip_admin_user')
    await revoke(token.value)
    localStorage.removeItem(CONTEXT_KEY)
    clearAdminSession()
    if (!adminToken || !adminUser) return logout()
    token.value = adminToken
    user.value = JSON.parse(adminUser)
    localStorage.setItem('pktakip_token', adminToken)
    localStorage.setItem('pktakip_user', adminUser)
    reloadNuxtApp({ path: '/customers' })
  }

  const authHeaders = () => {
    loadStoredAuth()
    return token.value ? { Authorization: `Bearer ${token.value}` } : {}
  }

  return { token, user, impersonating, superAdmin, loadStoredAuth, login, logout, authHeaders, startImpersonation, stopImpersonation, impersonateUser }
}
