<template>
  <div class="customers-page">
    <div class="page-head">
      <div>
        <span class="eyebrow">Tanımlamalar / Müşteriler</span>
        <h1>Müşteriler</h1>
        <p>PKTakip uzman müşterilerini yönetin.</p>
      </div>
      <Button label="Yeni Uzman" icon="pi pi-plus" class="pk-primary" @click="showCreate = true" />
    </div>

    <CustomerStats :total="experts.length" :active="activeCount" :inactive="inactiveCount" />

    <CustomerTable :customers="experts" :loading="loading" @open="openTenant" @impersonate="impersonate" />

    <Message v-if="success" severity="success" :closable="false" class="feedback-message">{{ success }}</Message>
    <Message v-if="error" severity="error" :closable="false" class="feedback-message">{{ error }}</Message>

    <ExpertCreateDialog v-model="showCreate" @created="handleCreated" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const config = useRuntimeConfig()
const { authHeaders } = useAuth()
const tenants = ref<any[]>([])
const loading = ref(true)
const error = ref('')
const success = ref('')
const showCreate = ref(false)

const experts = computed(() => tenants.value.filter(tenant => tenant.tenant_type === 'expert'))
const activeCount = computed(() => experts.value.filter(tenant => Boolean(tenant.status)).length)
const inactiveCount = computed(() => experts.value.filter(tenant => !tenant.status).length)

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
  success.value = response?.message || 'Uzman oluşturuldu ve davet e-postası gönderildi.'
  await loadExperts()
}

const openTenant = (tenant: any) => {
  console.log('tenant', tenant)
}

const impersonate = async (tenant: any) => {
  const userId = tenant?.expert_user_id
  if (!userId) {
    error.value = 'Bu uzman için giriş kullanıcısı bulunamadı.'
    return
  }

  try {
    const response = await $fetch<{ token: string; user: any }>(`${config.public.apiBaseUrl}/users/${userId}/impersonate`, {
      method: 'POST',
      headers: authHeaders(),
    })

    localStorage.setItem('pktakip_impersonated_from_admin', localStorage.getItem('pktakip_token') || '')
    localStorage.setItem('pktakip_token', response.token)
    localStorage.setItem('pktakip_user', JSON.stringify(response.user))
    await navigateTo('/')
  } catch (e: any) {
    error.value = e?.data?.message || 'Uzman hesabına geçiş yapılamadı.'
  }
}
</script>

<style scoped>
.customers-page { max-width: 1500px; margin: 0 auto; }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 24px; }
.eyebrow { display: block; margin-bottom: 7px; color: var(--pk-yellow-dark); font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
.page-head h1 { margin: 0; color: var(--admin-heading); font-size: 30px; line-height: 1.15; letter-spacing: -.7px; }
.page-head p { margin: 7px 0 0; color: var(--admin-muted); font-size: 13px; }
.feedback-message { margin-top: 16px; }
@media (max-width: 700px) { .page-head { align-items: flex-start; flex-direction: column; } }
</style>
