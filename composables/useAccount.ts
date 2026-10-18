// Oturumdaki kullanıcının PKTakip hesabı: bireysel uzman (expert), OSGB ya da kurumsal (corporate), ve pktakip rolü
// (yonetici | operasyon | uzman). Panelde hesap türüne ve role göre yazılar / menüler; bireysel uzmanda (ve hesap bilgisi
// gelene kadar) bugünkü yazılar ve menüler aynen kalır.
export interface PkAccount { id: number; name: string; type: string; role?: string }

const EDITIONS: Record<string, string> = { osgb: 'PKTakip OSGB', corporate: 'PKTakip Kurumsal', public: 'PKTakip Kamu' }
// Süren istek: aynı anda çağıranlar (menü, üst seçici, sayfalar) aynı isteği bekler.
let pending: { userId: number; promise: Promise<void> } | null = null
export const ACCOUNT_ROLE_LABELS: Record<string, string> = { yonetici: 'Yönetici', operasyon: 'Operasyon yöneticisi', uzman: 'Uzman' }

export const useAccount = () => {
  const { user } = useAuth()
  const { get } = useExpertApi()
  const account = useState<PkAccount | null>('pk-account', () => null)
  // Hangi kullanıcı için alındı (süper admin başka hesaba girince yeniden alınır).
  const loadedFor = useState<number | null>('pk-account-user', () => null)

  const load = (): Promise<void> => {
    if (!user.value) return Promise.resolve()
    if (pending && pending.userId === user.value.id) return pending.promise
    if (loadedFor.value === user.value.id) return Promise.resolve()
    const userId = user.value.id
    loadedFor.value = userId
    account.value = null
    const promise = (async () => {
      try { account.value = await get<PkAccount | null>('/pk-account') }
      catch (e: any) {
        loadedFor.value = null
        // Oturum açıkken hesap pasife alındıysa (kullanıcı 19 Ekim 2026): çıkış, giriş ekranında mesaj.
        if (e?.data?.code === 'hesap_pasif') { await useAuth().logout(); await navigateTo('/login?pasif=1') }
      }
      finally { pending = null }
    })()
    pending = { userId, promise }
    return promise
  }

  const multiUser = computed(() => ['osgb', 'corporate', 'public'].includes(account.value?.type || ''))
  // Kamu hesabı (public) yapı olarak kurumsal gibidir: kurum tek müşteri, Organizasyon sayfası. Farklar `kamu` ile:
  // firma yerine "işyeri" denir, Firmalar menüsü yok (kullanıcı 18 Ekim 2026).
  const kamu = computed(() => account.value?.type === 'public')
  const corporate = computed(() => account.value?.type === 'corporate' || kamu.value)
  // OSGB / kurumsal hesabın yöneticisi (yapı, kullanıcılar) ve operasyon yöneticisi (uzman atama, tüm hesap).
  const isManager = computed(() => multiUser.value && account.value?.role === 'yonetici')
  const isOperation = computed(() => multiUser.value && account.value?.role === 'operasyon')
  // Logonun altı: "PKTakip OSGB" / "PKTakip Kurumsal"; bireysel uzmanda null (bugünkü yazı).
  const edition = computed(() => EDITIONS[account.value?.type || ''] || null)
  // OSGB / kurumsal hesapta rol adı; bireysel uzmanda "Uzman".
  const roleLabel = computed(() => multiUser.value ? ACCOUNT_ROLE_LABELS[account.value?.role || ''] || 'Uzman' : 'Uzman')
  // Ayarlar'ın ilk sayfası: bireysel uzman ve OSGB yöneticisinde Müşteriler, kurumsal yöneticide Organizasyon, operasyon
  // yöneticisinde Lokasyonlar, uzmanda Katalog talepleri (uzman yapı sayfalarını görmez).
  const settingsHome = computed(() => !multiUser.value ? '/expert/settings/customers'
    : isManager.value ? (corporate.value ? '/expert/settings/organization' : '/expert/settings/customers')
    : isOperation.value ? '/expert/settings/locations' : '/expert/settings/catalog-requests')

  return { account, multiUser, corporate, kamu, isManager, isOperation, edition, roleLabel, settingsHome, load }
}
