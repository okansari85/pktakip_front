// OSGB / kurumsal hesapta Ayarlar sayfalarının rol kuralı (bireysel uzmanda hepsi açık, bugünkü gibi):
// Müşteriler / Organizasyon / Kullanıcılar yalnızca yöneticiye; Lokasyonlar / Firmalar yönetici ve operasyon yöneticisine.
// Uzman lokasyonlarını ve firmalarını "Firmalarım"da salt okunur görür. Yetkisi yoksa Ayarlar'da açabildiği ilk sayfaya döner.
// Önce "expert" ara yazılımı çalışır (giriş ve uzman kontrolü).
const RULES: Record<string, string[]> = {
  '/expert/settings/customers': ['yonetici'],
  '/expert/settings/organization': ['yonetici'],
  '/expert/settings/users': ['yonetici'],
  '/expert/settings/locations': ['yonetici', 'operasyon'],
  '/expert/settings/companies': ['yonetici', 'operasyon']
}

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const { account, multiUser, settingsHome, load } = useAccount()
  await load()
  const allowed = RULES[to.path.replace(/\/$/, '')]
  if (!allowed || !multiUser.value || allowed.includes(account.value?.role || '')) return
  if (settingsHome.value !== to.path) return navigateTo(settingsHome.value, { replace: true })
})
