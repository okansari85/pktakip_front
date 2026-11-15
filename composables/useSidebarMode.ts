// Sol menünün üç hâli (KSY-SIS'teki gibi): geniş (simge + yazı), dar (yalnız simge), kapalı. Üst çubuktaki düğme sırayla geçer;
// seçim tarayıcıda hatırlanır (ilk açılışta dar, tasarım kataloğundaki gibi).
export type SidebarMode = 'genis' | 'dar' | 'kapali'
const ORDER: SidebarMode[] = ['genis', 'dar', 'kapali']
const STORAGE_KEY = 'pktakip_menu'

export const useSidebarMode = () => {
  const mode = useState<SidebarMode>('pk-sidebar-mode', () => 'dar')
  const loaded = useState('pk-sidebar-mode-loaded', () => false)
  if (import.meta.client && !loaded.value) {
    loaded.value = true
    try { const saved = localStorage.getItem(STORAGE_KEY) as SidebarMode; if (ORDER.includes(saved)) mode.value = saved } catch {}
  }
  const next = () => {
    mode.value = ORDER[(ORDER.indexOf(mode.value) + 1) % ORDER.length]!
    try { localStorage.setItem(STORAGE_KEY, mode.value) } catch {}
  }
  const label = computed(() => ({ genis: 'Menüyü daralt', dar: 'Menüyü kapat', kapali: 'Menüyü aç' })[mode.value])
  return { mode, next, label }
}
