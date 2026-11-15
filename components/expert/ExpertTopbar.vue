<template>
  <header class="expert-topbar">
    <!-- Sol menü: geniş → dar → kapalı → geniş -->
    <button v-tooltip.bottom="menuLabel" class="menu-toggle" type="button" :aria-label="menuLabel" @click="nextMenu"><i class="pi pi-bars" /></button>
    <ExpertWorkplaceSwitcher v-if="!title.startsWith('Ayarlar') && !route.meta.hideWorkplaceSwitcher" />

    <div class="topbar-actions">
      <!-- Süper admin bir hesaba girdiyse: kendi oturumuna (Müşteriler) döner -->
      <button v-if="impersonating" class="return-button" type="button" @click="stopImpersonation"><i class="pi pi-arrow-left" /> Süper admine dön</button>
      <button class="theme-toggle" type="button" :aria-label="isDark ? 'Açık temaya geç' : 'Koyu temaya geç'" @click="toggleTheme">
        <i :class="isDark ? 'pi pi-sun' : 'pi pi-moon'" />
      </button>
      <!-- Bildirim zili (tasarım kataloğu): okunmamış sayısı; tıklayınca son bildirimler -->
      <button class="theme-toggle bell" type="button" :aria-label="unread ? `Bildirimler, ${unread} okunmamış` : 'Bildirimler'" @click="notificationPanel?.toggle($event)">
        <i class="pi pi-bell" />
        <span v-if="unread" class="bell-count">{{ unread > 99 ? '99+' : unread }}</span>
      </button>
      <Popover ref="notificationPanel" :pt="{ root: { style: POPOVER_VARS } }" @show="loadNotifications">
        <div class="notif-panel">
          <header class="notif-head">
            <strong>Bildirimler</strong>
            <button v-if="unread" class="notif-link" type="button" @click="readAll">Tümünü okundu yap</button>
          </header>
          <p v-if="notifLoading && !notifications.length" class="notif-state"><i class="pi pi-spin pi-spinner" /> Yükleniyor...</p>
          <p v-else-if="notifError" class="notif-state error">{{ notifError }}</p>
          <p v-else-if="!notifications.length" class="notif-state">Bildirim yok</p>
          <ul v-else class="notif-list">
            <li v-for="item in notifications" :key="item.id">
              <button type="button" class="notif-item" :class="[NOTIFICATION_TONE[item.type], { unread: !item.read_at }]" @click="openNotification(item)">
                <i :class="NOTIFICATION_ICON[item.type] || 'pi pi-bell'" />
                <span><strong>{{ item.title }}</strong><small v-if="item.body">{{ item.body }}</small><time :datetime="item.created_at">{{ ago(item.created_at) }}</time></span>
              </button>
            </li>
          </ul>
        </div>
      </Popover>
      <div class="user-chip">
        <span class="avatar">{{ initials }}</span>
        <div>
          <strong>{{ user?.name || 'Uzman' }}</strong>
          <small>{{ roleLabel }}</small>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ title?: string }>(), { title: 'Uzman Paneli' })
const route = useRoute()
const { user, impersonating, stopImpersonation } = useAuth()
const { roleLabel } = useAccount()
const { next: nextMenu, label: menuLabel } = useSidebarMode()
const isDark = ref(false)

const initials = computed(() => {
  const name = user.value?.name || 'UZ'
  return name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()
})

const applyTheme = () => {
  if (!import.meta.client) return
  document.documentElement.classList.toggle('dark-theme', isDark.value)
  localStorage.setItem('pktakip_theme', isDark.value ? 'dark' : 'light')
}

const toggleTheme = () => {
  isDark.value = !isDark.value
  applyTheme()
}

// --- Bildirimler (pk-notifications): sayı sayfa açılınca ve panel açılınca alınır; periyodik yoklama yok. ---
const { get, post, errorMessage } = useExpertApi()
const NOTIFICATION_ICON: Record<string, string> = { kontrol_yaklasan: 'pi pi-calendar', kontrol_geciken: 'pi pi-exclamation-triangle', bulgu_hatirlatma: 'pi pi-clipboard' }
const NOTIFICATION_TONE: Record<string, string> = { kontrol_yaklasan: 'warn', kontrol_geciken: 'bad', bulgu_hatirlatma: 'info' }
// Panel gövdeye eklenir: PrimeVue'nun renkleri yerine uygulamanın açık / koyu tema renkleri.
const POPOVER_VARS = '--p-popover-background:var(--admin-surface);--p-popover-border-color:var(--admin-border);--p-popover-color:var(--admin-text);--p-popover-content-padding:0'
const notificationPanel = ref<any>(null)
const unread = ref(0)
const notifications = ref<any[]>([])
const notifLoading = ref(false)
const notifError = ref('')

const relative = new Intl.RelativeTimeFormat('tr-TR', { numeric: 'auto' })
const ago = (value: string) => {
  const minutes = Math.round((new Date(value).getTime() - Date.now()) / 60000)
  if (minutes > -60) return relative.format(minutes, 'minute')
  if (minutes > -1440) return relative.format(Math.round(minutes / 60), 'hour')
  if (minutes > -10080) return relative.format(Math.round(minutes / 1440), 'day')
  return new Intl.DateTimeFormat('tr-TR').format(new Date(value))
}

const loadNotifications = async () => {
  notifLoading.value = true
  notifError.value = ''
  try {
    const page = await get('/pk-notifications', { per_page: 20 })
    notifications.value = page.data
    unread.value = page.unread_count
  } catch (e: any) { notifError.value = errorMessage(e, 'Bildirimler alınamadı.') }
  finally { notifLoading.value = false }
}
// Tıklanan bildirim okundu sayılır ve bağlantısına gidilir (okundu işareti alınamasa da gidilir).
const openNotification = async (item: any) => {
  notificationPanel.value?.hide()
  if (!item.read_at) {
    try {
      const result = await post(`/pk-notifications/${item.id}/read`, {})
      item.read_at = result.read_at
      unread.value = result.unread_count
    } catch { /* bağlantıya yine gidilir */ }
  }
  if (item.link) await navigateTo(item.link)
}
const readAll = async () => {
  try {
    const result = await post('/pk-notifications/read-all', {})
    const now = new Date().toISOString()
    notifications.value.forEach((item) => { item.read_at ??= now })
    unread.value = result.unread_count
  } catch (e: any) { notifError.value = errorMessage(e, 'Bildirimler okundu yapılamadı.') }
}

onMounted(() => {
  isDark.value = localStorage.getItem('pktakip_theme') === 'dark'
  applyTheme()
  get('/pk-notifications', { unread: 1, per_page: 1 }).then((page) => { unread.value = page.unread_count }).catch(() => { /* zil sayısız görünür */ })
})
</script>

<style scoped>
/* Tasarım kataloğu: üst çubuk zeminin üstünde (ayrı bant yok); seçiciler, tema ve kullanıcı ayrı kartlar. */
.expert-topbar { min-height: 76px; display: flex; align-items: center; gap: 12px; padding: 14px 30px 0; }
.menu-toggle { flex: none; width: 44px; height: 44px; display: grid; place-items: center; border: 1px solid var(--admin-border); border-radius: 14px; background: var(--admin-card); color: var(--admin-heading); cursor: pointer; box-shadow: 0 6px 18px rgba(var(--pk-shadow-rgb), .06); }
.menu-toggle:hover { border-color: var(--pk-yellow); color: var(--pk-yellow-dark); }
.topbar-eyebrow { display: block; margin-bottom: 2px; color: var(--pk-yellow-dark); font-size: 10px; font-weight: 800; letter-spacing: .14em; }
.expert-topbar strong { color: var(--admin-heading); font-size: 15px; }
.topbar-actions { display: flex; align-items: center; gap: 12px; margin-left: auto; }
.theme-toggle { width: 44px; height: 44px; border: 1px solid var(--admin-border); border-radius: 14px; background: var(--admin-card); color: var(--admin-muted); cursor: pointer; box-shadow: 0 6px 18px rgba(var(--pk-shadow-rgb), .06); }
.theme-toggle:hover { color: var(--pk-yellow-dark); border-color: var(--pk-yellow); }
.bell { position: relative; }
.bell-count { position: absolute; top: -6px; right: -6px; min-width: 20px; height: 20px; display: grid; place-items: center; padding: 0 5px; border: 2px solid var(--admin-surface); border-radius: 999px; background: var(--admin-danger-text); color: #fff; font-size: 10px; font-weight: 800; line-height: 1; }
.notif-panel { width: min(380px, calc(100vw - 32px)); }
.notif-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--admin-border); }
.notif-head strong { color: var(--admin-heading); font-size: 14px; }
.notif-link { border: 0; background: none; color: var(--admin-link); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
.notif-state { margin: 0; padding: 22px 14px; color: var(--admin-muted); font-size: 13px; text-align: center; }
.notif-state.error { color: var(--admin-danger-text); }
.notif-list { max-height: 420px; overflow: auto; margin: 0; padding: 0; list-style: none; }
.notif-list li + li { border-top: 1px solid var(--admin-row-border); }
.notif-item { width: 100%; display: flex; align-items: flex-start; gap: 10px; padding: 11px 14px; border: 0; border-left: 3px solid transparent; background: none; color: var(--admin-text); font: inherit; text-align: left; cursor: pointer; }
.notif-item:hover { background: var(--admin-hover); }
.notif-item.unread { border-left-color: var(--pk-yellow); background: var(--admin-accent-soft); }
.notif-item > i { margin-top: 2px; font-size: 15px; color: var(--admin-muted); }
.notif-item.warn > i { color: var(--admin-warning-text); } .notif-item.bad > i { color: var(--admin-danger-text); } .notif-item.info > i { color: var(--admin-link); }
.notif-item > span { min-width: 0; display: grid; gap: 3px; }
.notif-item strong { color: var(--admin-heading); font-size: 13px; font-weight: 600; }
.notif-item.unread strong { font-weight: 800; }
.notif-item small { color: var(--admin-text); font-size: 12px; line-height: 1.4; }
.notif-item time { color: var(--admin-muted); font-size: 11px; }
.return-button { display: inline-flex; align-items: center; gap: 7px; height: 38px; padding: 0 14px; border: 1px solid var(--pk-yellow); border-radius: 9px; background: var(--admin-accent-soft); color: var(--admin-accent-text); font: inherit; font-size: 12px; font-weight: 800; cursor: pointer; }
.return-button:hover { background: var(--pk-yellow); color: var(--pk-on-accent); }
.user-chip { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 4px 14px 4px 4px; border: 1px solid var(--admin-border); border-radius: 999px; background: var(--admin-card); box-shadow: 0 6px 18px rgba(var(--pk-shadow-rgb), .06); }
.avatar { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 50%; background: var(--pk-text); color: #fff; font-size: 12px; font-weight: 800; }
.user-chip strong { display: block; font-size: 12px; }
.user-chip small { display: block; margin-top: 2px; color: var(--admin-muted); font-size: 10px; }
@media (max-width: 800px) { .expert-topbar { padding: 12px 16px 0; } }
</style>
