// Uzman panelinde yalnızca süper admine açık sayfalar (Yapay zeka ayarı, Test): süper admin değilse Genel Bakış'a döner.
// Önce "expert" ara yazılımı çalışır (giriş ve uzman kontrolü).
export default defineNuxtRouteMiddleware(() => {
  if (import.meta.server) return

  const { loadStoredAuth, superAdmin } = useAuth()
  loadStoredAuth()

  if (!superAdmin.value) return navigateTo('/expert')
})
