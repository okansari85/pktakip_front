<template>
  <div class="customers-page">
    <div class="page-head">
      <div>
        <span class="eyebrow">Tanımlamalar / Müşteriler</span>
        <h1>Müşteriler</h1>
        <p>PKTakip müşterilerini (uzman, OSGB, kurumsal, kamu) yönetin.</p>
      </div>
      <button type="button" class="new-expert-button" @click="openCreateDialog">
        <i class="pi pi-plus" />
        <span>Yeni Müşteri</span>
      </button>
    </div>

    <AdminCustomerStats :total="accounts.length" :active="activeCount" :inactive="inactiveCount" :detail="typeDetail" />

    <AdminCustomerTable :customers="accounts" :loading="loading" @open="openTenant" @impersonate="impersonate" @sendInvite="sendInvite" @toggle-status="toggleStatus" @remove="openDelete" />

    <Message v-if="success" severity="success" :closable="false" class="feedback-message">{{ success }}</Message>
    <Message v-if="error" severity="error" :closable="false" class="feedback-message">{{ error }}</Message>

    <AdminAccountCreateDialog v-model="showCreate" @created="handleCreated" />
    <AdminAccountDeleteDialog v-model="showDelete" :tenant="deleteTarget" @deleted="handleDeleted" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'super-admin' })

const config = useRuntimeConfig()
const { authHeaders, startImpersonation } = useAuth()
const tenants = ref<any[]>([])
const loading = ref(true)
const error = ref('')
const success = ref('')
const showCreate = ref(false)

// PKTakip hesapları: bireysel uzman, OSGB, kurumsal (Taşeron'un firma hesapları listelenmez).
const ACCOUNT_TYPES: Record<string, string> = { expert: 'uzman', osgb: 'OSGB', corporate: 'kurumsal', public: 'kamu' }
const accounts = computed(() => tenants.value.filter(tenant => tenant.tenant_type in ACCOUNT_TYPES))
const activeCount = computed(() => accounts.value.filter(tenant => Boolean(tenant.status)).length)
const inactiveCount = computed(() => accounts.value.filter(tenant => !tenant.status).length)
const typeDetail = computed(() => Object.entries(ACCOUNT_TYPES)
  .map(([type, label]) => ({ label, count: accounts.value.filter(tenant => tenant.tenant_type === type).length }))
  .filter(item => item.count)
  .map(item => `${item.count} ${item.label}`)
  .join(' · '))

const openCreateDialog = () => {
  error.value = ''
  showCreate.value = true
}

const loadExperts = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await $fetch<{ data: any[] }>(`${config.public.apiBaseUrl}/tenants`, {
      headers: authHeaders()
    })
    tenants.value = response.data || []
  } catch (e: any) {
    error.value = e?.data?.message || 'Müşteriler alınamadı.'
  } finally {
    loading.value = false
  }
}

onMounted(loadExperts)

const handleCreated = async (response: any) => {
  success.value = response?.message || 'Hesap oluşturuldu ve davet e-postası gönderildi.'
  await loadExperts()
}

// Davet yeniden: uzmanda bugünkü uzman daveti, OSGB / kurumsalda hesabın yöneticisine PKTakip daveti.
const sendInvite = async (tenant: any) => {
  error.value = ''
  success.value = ''
  const path = tenant.tenant_type === 'expert' ? `/experts/${tenant.id}/resend-invitation` : `/pk-accounts/${tenant.id}/resend-invitation`
  try {
    const response = await $fetch<{ message: string }>(`${config.public.apiBaseUrl}${path}`, {
      method: 'POST',
      headers: authHeaders(),
    })

    success.value = response.message || 'Davet e-postası yeniden gönderildi.'
  } catch (e: any) {
    error.value = e?.data?.message || 'Davet e-postası gönderilemedi.'
  }
}

// Pasife / aktife alma (kullanıcı 19 Ekim 2026): pasif hesabın kullanıcıları giriş yapamaz; veriler kalır.
const toggleStatus = async (tenant: any) => {
  error.value = ''
  success.value = ''
  const pasif = Boolean(tenant.status)
  if (pasif && !confirm(`"${tenant.name}" pasife alınsın mı? Hesabın kullanıcıları giriş yapamaz; veriler silinmez.`)) return
  try {
    const response = await $fetch<{ message: string }>(`${config.public.apiBaseUrl}/pk-accounts/${tenant.id}/${pasif ? 'deactivate' : 'activate'}`, { method: 'POST', headers: authHeaders() })
    success.value = response.message
    await loadExperts()
  } catch (e: any) {
    error.value = e?.data?.message || 'Hesabın durumu değiştirilemedi.'
  }
}

// Kalıcı silme: yalnız pasif hesapta; özet + hesabın adı yazılarak (AccountDeleteDialog).
const showDelete = ref(false)
const deleteTarget = ref<any>(null)
const openDelete = (tenant: any) => { error.value = ''; success.value = ''; deleteTarget.value = tenant; showDelete.value = true }
const handleDeleted = async (message: string) => { success.value = message; await loadExperts() }

const openTenant = (tenant: any) => {
  console.log('tenant', tenant)
}

// Hesaba giriş (her tür): hesabın yöneticisi olarak panele geçilir (sayfa baştan yüklenir); üst çubuktaki "Süper admine
// dön" ile bu sayfaya dönülür.
const impersonate = async (tenant: any) => {
  error.value = ''
  success.value = ''
  try {
    const response = await $fetch<{ token: string; user: any }>(`${config.public.apiBaseUrl}/pk-accounts/${tenant.id}/impersonate`, {
      method: 'POST',
      headers: authHeaders(),
    })

    startImpersonation(response.token, response.user)
  } catch (e: any) {
    error.value = e?.data?.message || 'Hesaba geçiş yapılamadı.'
  }
}
</script>

<style scoped>
.customers-page { max-width: 1500px; margin: 0 auto; }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 24px; }
.eyebrow { display: block; margin-bottom: 7px; color: var(--pk-yellow-dark); font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
.page-head h1 { margin: 0; color: var(--admin-heading); font-size: 30px; line-height: 1.15; letter-spacing: -.7px; }
.page-head p { margin: 7px 0 0; color: var(--admin-muted); font-size: 13px; }
.new-expert-button { display: inline-flex; align-items: center; gap: 8px; min-height: 42px; padding: 0 16px; border: 0; border-radius: 9px; background: var(--pk-yellow); color: #111827; font-size: 13px; font-weight: 800; cursor: pointer; box-shadow: 0 5px 14px rgba(0,0,0,.08); }
.new-expert-button:hover { filter: brightness(.96); transform: translateY(-1px); }
.feedback-message { margin-top: 16px; }
@media (max-width: 700px) { .page-head { align-items: flex-start; flex-direction: column; } }
</style>
