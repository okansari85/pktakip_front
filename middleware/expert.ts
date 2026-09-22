export default defineNuxtRouteMiddleware(() => {
  if (import.meta.server) return

  const { loadStoredAuth, token, user } = useAuth()
  loadStoredAuth()

  if (!token.value || !user.value?.is_expert) {
    return navigateTo(user.value?.roles?.includes('super-admin') ? '/customers' : '/login')
  }
})
