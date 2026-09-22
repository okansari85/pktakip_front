export default defineNuxtRouteMiddleware(() => {
  if (import.meta.server) return

  const { loadStoredAuth, token, user } = useAuth()
  loadStoredAuth()

  if (!token.value || !user.value?.roles?.includes('super-admin')) {
    return navigateTo(user.value?.is_expert ? '/expert' : '/login')
  }
})
