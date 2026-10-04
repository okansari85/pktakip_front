<template>
  <div class="users-page">
    <div class="page-head">
      <div>
        <div class="breadcrumb"><span>Ayarlar</span><i class="pi pi-angle-right" /><strong>Kullanıcılar</strong></div>
        <h1>Kullanıcılar</h1>
        <p>Hesabınızın kullanıcılarını yönetin. Uzmanları firmalara Firmalar sayfasından atarsınız.</p>
      </div>
      <button v-if="isManager" class="primary-button" type="button" @click="openInvite">
        <i class="pi pi-plus" /><span>Kullanıcı Ekle</span>
      </button>
    </div>

    <p v-if="feedback" class="feedback" :class="feedback.type">{{ feedback.text }}</p>

    <section class="table-card">
      <div class="toolbar">
        <label class="field">Rol
          <select v-model="roleFilter">
            <option value="">Tümü</option>
            <option v-for="(label, key) in ROLE_LABELS" :key="key" :value="key">{{ label }}</option>
          </select>
        </label>
        <label class="field">Durum
          <select v-model="statusFilter">
            <option value="">Tümü</option>
            <option v-for="(label, key) in STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
          </select>
        </label>
        <label class="field">Ara
          <div class="search-box"><i class="pi pi-search" /><input v-model="search" type="text" placeholder="Ad ya da e-posta" /></div>
        </label>
      </div>

      <div v-if="loading" class="state-row">Kullanıcılar yükleniyor...</div>
      <div v-else-if="error" class="state-row error-state">{{ error }}</div>
      <div v-else-if="filteredUsers.length === 0" class="state-row empty-state">
        <i class="pi pi-id-card" />
        <strong>{{ users.length ? 'Filtreye uyan kullanıcı yok' : 'Henüz kullanıcı yok' }}</strong>
        <span v-if="!users.length">"Kullanıcı Ekle" ile uzman ya da operasyon yöneticisi davet edin.</span>
      </div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ad Soyad</th>
              <th>Rol</th>
              <th>Firma</th>
              <th>Durum</th>
              <th>Eklenme</th>
              <th class="actions-head">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredUsers" :key="item.id" :class="{ passive: item.status === 'pasif' }">
              <td>
                <div class="name-cell">
                  <span class="row-icon">{{ initials(item.name) }}</span>
                  <div class="stacked"><strong>{{ item.name }}<em v-if="item.id === user?.id"> (siz)</em></strong><small>{{ item.email }}</small></div>
                </div>
              </td>
              <td><span class="role-badge" :class="item.role">{{ item.role_label }}</span></td>
              <td>{{ item.role === 'uzman' ? `${item.workplaces_count} firma` : 'Tüm hesap' }}</td>
              <td><span class="status-badge" :class="item.status">{{ STATUS_LABELS[item.status] }}</span></td>
              <td>{{ formatDate(item.created_at) }}</td>
              <td class="actions">
                <button v-if="impersonating && item.status !== 'pasif' && item.id !== user?.id" class="icon-button" type="button" title="Bu kullanıcı olarak gir" @click="enterAs(item)"><i class="pi pi-sign-in" /></button>
                <template v-if="isManager">
                  <button v-if="item.status === 'davet'" class="icon-button" type="button" title="Daveti yeniden gönder" :disabled="busyId === item.id" @click="resend(item)"><i class="pi pi-envelope" /></button>
                  <button v-if="item.status !== 'pasif'" class="icon-button" type="button" title="Rolü değiştir" @click="openRole(item)"><i class="pi pi-pencil" /></button>
                  <button v-if="item.status === 'pasif'" class="icon-button" type="button" title="Aktife al (yeni davet gönderilir)" :disabled="busyId === item.id" @click="activate(item)"><i class="pi pi-refresh" /></button>
                  <button v-else-if="item.id !== user?.id" class="icon-button danger" type="button" title="Pasife al" @click="deactivateTarget = item"><i class="pi pi-ban" /></button>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="table-footer"><span>Toplam {{ filteredUsers.length }} kullanıcı</span><span v-if="counts">{{ counts }}</span></div>
      </div>
    </section>

    <!-- Kullanıcı ekle: davet e-postasıyla kendi şifresini belirler -->
    <div v-if="inviteOpen" class="modal-backdrop">
      <section class="modal-card">
        <div class="modal-head">
          <div><h2>Kullanıcı Ekle</h2><p>Davet e-postası gider; kullanıcı kendi şifresini belirler.</p></div>
          <button class="close-button" type="button" @click="closeInvite"><i class="pi pi-times" /></button>
        </div>
        <label>Ad Soyad <span>*</span><input v-model="inviteForm.name" type="text" placeholder="Örn. Ayşe Demir" /></label>
        <label>E-posta <span>*</span><input v-model="inviteForm.email" type="email" placeholder="ornek@firma.com" /></label>
        <label>Rol <span>*</span>
          <select v-model="inviteForm.role"><option v-for="(label, key) in ROLE_LABELS" :key="key" :value="key">{{ label }}</option></select>
        </label>
        <p class="hint">{{ ROLE_HINTS[inviteForm.role] }}</p>
        <p v-if="formError" class="form-error">{{ formError }}</p>
        <div class="modal-actions">
          <button class="secondary-button" type="button" @click="closeInvite">İptal</button>
          <button class="primary-button" type="button" :disabled="saving || !inviteForm.name.trim() || !inviteForm.email.trim()" @click="invite">{{ saving ? 'Gönderiliyor...' : 'Davet Et' }}</button>
        </div>
      </section>
    </div>

    <!-- Rol değiştir -->
    <div v-if="roleTarget" class="modal-backdrop">
      <section class="modal-card">
        <div class="modal-head">
          <div><h2>Rolü Değiştir</h2><p>{{ roleTarget.name }}</p></div>
          <button class="close-button" type="button" @click="roleTarget = null"><i class="pi pi-times" /></button>
        </div>
        <label>Rol
          <select v-model="roleValue"><option v-for="(label, key) in ROLE_LABELS" :key="key" :value="key">{{ label }}</option></select>
        </label>
        <p class="hint">{{ ROLE_HINTS[roleValue] }}</p>
        <p v-if="formError" class="form-error">{{ formError }}</p>
        <div class="modal-actions">
          <button class="secondary-button" type="button" @click="roleTarget = null">İptal</button>
          <button class="primary-button" type="button" :disabled="saving || roleValue === roleTarget.role" @click="saveRole">{{ saving ? 'Kaydediliyor...' : 'Kaydet' }}</button>
        </div>
      </section>
    </div>

    <!-- Pasife al -->
    <div v-if="deactivateTarget" class="modal-backdrop">
      <section class="modal-card">
        <div class="modal-head">
          <div><h2>Pasife Al</h2><p>{{ deactivateTarget.name }}</p></div>
          <button class="close-button" type="button" @click="deactivateTarget = null"><i class="pi pi-times" /></button>
        </div>
        <ul class="effects">
          <li>Giriş yapamaz, açık oturumları kapanır.</li>
          <li v-if="deactivateTarget.role === 'uzman' && deactivateTarget.workplaces_count">Atandığı {{ deactivateTarget.workplaces_count }} firmadan çıkarılır; firmalar uzmansız kalır.</li>
          <li>Verileri (ekipman, kontrol, rapor) silinmez.</li>
          <li>Aktife alınca yeni davetle şifresini belirler.</li>
        </ul>
        <p v-if="formError" class="form-error">{{ formError }}</p>
        <div class="modal-actions">
          <button class="secondary-button" type="button" @click="deactivateTarget = null">İptal</button>
          <button class="danger-button" type="button" :disabled="saving" @click="deactivate">{{ saving ? 'Kaydediliyor...' : 'Pasife Al' }}</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
// Ayarlar → Kullanıcılar (yalnızca OSGB / kurumsal hesabın yöneticisi): davet, rol, pasif / aktif. Süper admin hesaptayken
// satırdan o kullanıcı olarak girebilir (her rolün panelini görmek için).
definePageMeta({ layout: 'expert-settings', middleware: ['expert', 'expert-settings-role'] })

interface AccountUser { id: number; name: string; email: string; role: string; role_label: string; status: 'aktif' | 'davet' | 'pasif'; workplaces_count: number; created_at?: string | null }

const ROLE_LABELS = ACCOUNT_ROLE_LABELS
const ROLE_HINTS: Record<string, string> = {
  yonetici: 'Müşteri, lokasyon, organizasyon, firma ve kullanıcıları yönetir; her şeyi görür.',
  operasyon: 'Her şeyi görür ve çalışır, uzmanları firmalara atar; yapıyı ve kullanıcıları değiştirmez.',
  uzman: 'Atandığı firmalarda ve o lokasyonların lokasyon geneli ekipmanında çalışır.'
}
const STATUS_LABELS: Record<string, string> = { aktif: 'Aktif', davet: 'Davet bekliyor', pasif: 'Pasif' }

const { get, post, patch, errorMessage } = useExpertApi()
const { user, impersonating, impersonateUser } = useAuth()
const { account, isManager, load: loadAccount } = useAccount()

const users = ref<AccountUser[]>([])
const loading = ref(true)
const error = ref('')
const feedback = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const search = ref('')
const roleFilter = ref('')
const statusFilter = ref('')
const busyId = ref<number | null>(null)
const saving = ref(false)
const formError = ref('')

const trLower = (value?: string | null) => (value || '').toLocaleLowerCase('tr-TR')
const filteredUsers = computed(() => {
  const q = trLower(search.value.trim())
  return users.value.filter(item => (!roleFilter.value || item.role === roleFilter.value)
    && (!statusFilter.value || item.status === statusFilter.value)
    && (!q || trLower(item.name).includes(q) || trLower(item.email).includes(q)))
})
const counts = computed(() => Object.entries(ROLE_LABELS)
  .map(([key, label]) => ({ label, count: users.value.filter(item => item.role === key && item.status !== 'pasif').length }))
  .filter(item => item.count)
  .map(item => `${item.count} ${item.label.toLocaleLowerCase('tr-TR')}`)
  .join(' · '))

const initials = (name: string) => name.split(' ').map(part => part[0]).slice(0, 2).join('').toLocaleUpperCase('tr-TR')
const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('tr-TR').format(new Date(value)) : '—'
const say = (type: 'success' | 'error', text: string) => { feedback.value = { type, text } }
const replace = (item: AccountUser) => { users.value = users.value.map(existing => existing.id === item.id ? item : existing) }

const loadUsers = async () => {
  loading.value = true
  error.value = ''
  try { users.value = await get<AccountUser[]>('/pk-account/users') }
  catch (e: any) { error.value = errorMessage(e, 'Kullanıcılar alınamadı.') }
  finally { loading.value = false }
}

// Davet
const inviteOpen = ref(false)
const inviteForm = reactive({ name: '', email: '', role: 'uzman' })
const openInvite = () => { Object.assign(inviteForm, { name: '', email: '', role: 'uzman' }); formError.value = ''; inviteOpen.value = true }
const closeInvite = () => { if (!saving.value) inviteOpen.value = false }
const invite = async () => {
  saving.value = true
  formError.value = ''
  try {
    const response = await post<{ message: string; user: AccountUser }>('/pk-account/users', { name: inviteForm.name.trim(), email: inviteForm.email.trim(), role: inviteForm.role })
    users.value = [...users.value, response.user]
    inviteOpen.value = false
    say('success', response.message)
  } catch (e: any) { formError.value = errorMessage(e, 'Kullanıcı eklenemedi.') }
  finally { saving.value = false }
}

// Rol
const roleTarget = ref<AccountUser | null>(null)
const roleValue = ref('uzman')
const openRole = (item: AccountUser) => { roleTarget.value = item; roleValue.value = item.role; formError.value = '' }
const saveRole = async () => {
  if (!roleTarget.value) return
  saving.value = true
  formError.value = ''
  try {
    const updated = await patch<AccountUser>(`/pk-account/users/${roleTarget.value.id}`, { role: roleValue.value })
    replace(updated)
    say('success', `${updated.name} artık ${updated.role_label}.`)
    roleTarget.value = null
    // Kendi rolünü değiştirdiyse menü ve yetkiler yeniden alınır.
    if (updated.id === user.value?.id) reloadNuxtApp({ path: '/expert' })
  } catch (e: any) { formError.value = errorMessage(e, 'Rol değiştirilemedi.') }
  finally { saving.value = false }
}

// Pasif / aktif
const deactivateTarget = ref<AccountUser | null>(null)
const deactivate = async () => {
  if (!deactivateTarget.value) return
  saving.value = true
  formError.value = ''
  try {
    const updated = await post<AccountUser>(`/pk-account/users/${deactivateTarget.value.id}/deactivate`, {})
    replace(updated)
    say('success', `${updated.name} pasife alındı.`)
    deactivateTarget.value = null
  } catch (e: any) { formError.value = errorMessage(e, 'Pasife alınamadı.') }
  finally { saving.value = false }
}
const activate = async (item: AccountUser) => {
  busyId.value = item.id
  try {
    const updated = await post<AccountUser>(`/pk-account/users/${item.id}/activate`, {})
    replace(updated)
    say('success', `${updated.name} aktife alındı; şifresini belirlemesi için davet e-postası gönderildi.`)
  } catch (e: any) { say('error', errorMessage(e, 'Aktife alınamadı.')) }
  finally { busyId.value = null }
}
const resend = async (item: AccountUser) => {
  busyId.value = item.id
  try {
    const response = await post<{ message: string }>(`/pk-account/users/${item.id}/resend-invitation`, {})
    say('success', `${item.name}: ${response.message}`)
  } catch (e: any) { say('error', errorMessage(e, 'Davet gönderilemedi.')) }
  finally { busyId.value = null }
}

// Süper admin: bu kullanıcı olarak gir
const enterAs = async (item: AccountUser) => {
  if (!account.value) return
  try { await impersonateUser(account.value.id, item.id) }
  catch (e: any) { say('error', errorMessage(e, 'Kullanıcı olarak girilemedi.')) }
}

onMounted(async () => {
  await loadAccount()
  loadUsers()
})
</script>

<style scoped>
.users-page { max-width: 1500px; margin: 0 auto; }
.page-head { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; margin-bottom:20px; }
.breadcrumb { display:flex; align-items:center; gap:8px; margin-bottom:10px; color:var(--admin-muted); font-size:12px; }.breadcrumb strong{color:var(--admin-heading)}
h1{margin:0;color:var(--admin-heading);font-size:30px;letter-spacing:-.7px}.page-head p{margin:7px 0 0;color:var(--admin-muted);font-size:13px}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:0 17px;border:0;border-radius:8px;background:var(--pk-yellow);color:#111827;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.07)}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.feedback{margin:0 0 14px;padding:10px 14px;border-radius:9px;font-size:12px}.feedback.success{background:var(--admin-success-bg);color:var(--admin-success-text)}.feedback.error{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.table-card{background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px;overflow:hidden}
.toolbar{padding:18px 16px;border-bottom:1px solid var(--admin-border);display:grid;grid-template-columns:minmax(160px,220px) minmax(160px,200px) 1fr;gap:12px;align-items:start}
.field{display:flex;flex-direction:column;gap:6px;margin:0;font-size:11px;font-weight:700;color:var(--admin-muted)}
.field select{box-sizing:border-box;height:42px;margin:0;padding:0 10px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:13px;outline:0}
.search-box{box-sizing:border-box;height:42px;display:flex;align-items:center;gap:10px;padding:0 12px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-muted)}.search-box input{width:100%;border:0;outline:0;background:transparent;color:var(--admin-heading);font-size:13px}.search-box input::placeholder{color:var(--admin-muted)}
.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}th,td{padding:14px 16px;text-align:left;border-bottom:1px solid var(--admin-row-border);font-size:12px;color:var(--admin-muted);vertical-align:middle}th{font-size:11px;font-weight:700;color:var(--admin-muted);background:var(--admin-soft);white-space:nowrap}td strong{color:var(--admin-heading)}
tr.passive td{opacity:.6}
.name-cell{display:flex;align-items:center;gap:10px}.row-icon{width:32px;height:32px;flex:0 0 32px;display:grid;place-items:center;border-radius:50%;color:#111827;background:var(--pk-yellow);font-size:11px;font-weight:800}
.stacked{display:flex;flex-direction:column;gap:3px}.stacked small{font-size:11px;color:var(--admin-muted)}.stacked em{font-style:normal;font-weight:500;color:var(--admin-muted)}
.role-badge,.status-badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap;background:var(--admin-chip);color:var(--admin-text)}
.role-badge.yonetici{background:var(--admin-accent-soft);color:var(--admin-accent-text)}.role-badge.operasyon{background:rgba(37,99,235,.1);color:var(--admin-link)}
.status-badge.aktif{background:var(--admin-success-bg);color:var(--admin-success-text)}.status-badge.davet{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.status-badge.pasif{background:var(--admin-chip);color:var(--admin-muted)}
.actions-head{text-align:right}.actions{text-align:right;white-space:nowrap}
.icon-button{width:32px;height:32px;margin-left:4px;display:inline-grid;place-items:center;border:1px solid var(--admin-border);border-radius:7px;background:var(--admin-input);color:var(--admin-muted);cursor:pointer}.icon-button:hover{border-color:#d7a900;background:var(--admin-accent-soft);color:var(--admin-heading)}.icon-button:disabled{opacity:.5;cursor:wait}
.icon-button.danger:hover{border-color:var(--admin-danger-text);background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.table-footer{display:flex;justify-content:space-between;gap:12px;padding:14px 16px;color:var(--admin-muted);font-size:12px}.state-row{padding:80px 20px;text-align:center;color:var(--admin-muted)}.empty-state{display:flex;flex-direction:column;align-items:center;gap:7px}.empty-state i{font-size:30px;margin-bottom:4px}.empty-state strong{color:var(--admin-heading)}.error-state{color:var(--admin-danger-text)}
.modal-backdrop{position:fixed;inset:0;z-index:100;background:var(--admin-overlay);display:grid;place-items:center;padding:20px}
.modal-card{width:min(460px,100%);padding:22px;background:var(--admin-input);border-radius:12px;box-shadow:0 20px 60px var(--admin-shadow)}
.modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:22px}.modal-head h2{margin:0;color:var(--admin-heading);font-size:18px}.modal-head p{margin:5px 0 0;color:var(--admin-muted);font-size:12px}
.close-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:var(--admin-muted);cursor:pointer;border-radius:7px}.close-button:hover{background:var(--admin-hover);color:var(--admin-heading)}
.modal-card label{display:block;margin-bottom:16px;color:var(--admin-heading);font-size:12px;font-weight:700}.modal-card label span{color:var(--admin-danger-text)}
.modal-card input,.modal-card select{width:100%;height:42px;margin-top:7px;padding:0 12px;border:1px solid var(--admin-border);border-radius:8px;outline:0;background:var(--admin-input);font:inherit;font-size:13px;color:var(--admin-heading)}
.modal-card input:focus,.modal-card select:focus{border-color:#d7a900;box-shadow:0 0 0 3px rgba(255,193,7,.12)}
.hint{margin:-8px 0 14px;color:var(--admin-muted);font-size:12px;line-height:1.5}
.effects{margin:0 0 14px;padding-left:18px;color:var(--admin-text);font-size:12px;line-height:1.8}
.form-error{margin:0 0 8px;color:var(--admin-danger-text);font-size:12px}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}.secondary-button{min-height:40px;padding:0 18px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-hover);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}
.danger-button{min-height:40px;padding:0 18px;border:0;border-radius:8px;background:#dc2626;color:#fff;font-size:12px;font-weight:800;cursor:pointer}.danger-button:disabled{opacity:.55}
@media(max-width:900px){.toolbar{grid-template-columns:1fr}.page-head{align-items:flex-start;flex-direction:column}.primary-button{align-self:flex-end}}
</style>
