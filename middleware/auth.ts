export default defineNuxtRouteMiddleware(() => {
  const { loadStoredAuth, token, user } = useAuth()
  loadStoredAuth()

  if (!token.value || !user.value?.roles?.includes('super-admin')) {
    return navigateTo('/login')
  }
})
