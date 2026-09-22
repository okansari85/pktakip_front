export type AuthUser = {
  id: number
  name: string
  email: string
  roles: string[]
  tenant_id: number | null
}

export const useAuth = () => {
  const token = useState<string | null>('auth-token', () => null)
  const user = useState<AuthUser | null>('auth-user', () => null)
  const config = useRuntimeConfig()

  const loadStoredAuth = () => {
    if (!import.meta.client || token.value) return
    token.value = localStorage.getItem('pktakip_token')
    const storedUser = localStorage.getItem('pktakip_user')
    if (storedUser) {
      try { user.value = JSON.parse(storedUser) } catch { localStorage.removeItem('pktakip_user') }
    }
  }

  const login = async (email: string, password: string) => {
    const response = await $fetch<{ token: string; user: AuthUser; message: string }>(`${config.public.apiBaseUrl}/login`, {
      method: 'POST', body: { email, password },
    })
    if (!response.user.roles.includes('super-admin')) {
      throw new Error('Bu panel yalnızca süper admin kullanıcıları içindir.')
    }
    token.value = response.token
    user.value = response.user
    if (import.meta.client) {
      localStorage.setItem('pktakip_token', response.token)
      localStorage.setItem('pktakip_user', JSON.stringify(response.user))
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
    }
    await navigateTo('/login')
  }

  const authHeaders = () => {
    loadStoredAuth()
    return token.value ? { Authorization: `Bearer ${token.value}` } : {}
  }

  return { token, user, loadStoredAuth, login, logout, authHeaders }
}
