export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return

  const { loadStoredAuth, token, user } = useAuth()
  loadStoredAuth()

  if (!token.value || !user.value?.is_expert) {
    if (user.value?.roles?.includes('super-admin')) return navigateTo('/customers')
    setLoginMark(false)
    // Girişten sonra istenen sayfaya dönülür (sitedeki "Hesabım" → /expert/hesabim).
    return navigateTo({ path: '/login', query: to.fullPath === '/expert' ? undefined : { r: to.fullPath } })
  }

  // Sitede üyelikte seçilen paket (pk_plan çerezi, 7 gün): bir kez okunur, silinir, Paketim o paketle açılır.
  const raw = document.cookie.split('; ').find(item => item.startsWith('pk_plan='))?.slice(8)
  if (raw) {
    siteCookie('pk_plan', '', 0)
    try {
      const plan = JSON.parse(decodeURIComponent(raw))
      if (plan?.name && to.path !== '/expert/paketim') return navigateTo({ path: '/expert/paketim', query: { plan: String(plan.name), period: plan.period === 'yearly' ? 'yearly' : 'monthly' } })
    } catch { /* bozuk çerez: yok sayılır */ }
  }
})
