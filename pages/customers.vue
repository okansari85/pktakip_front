<template>
  <div class="customers-page">
    <div class="page-head">
      <div>
        <span class="eyebrow">Tanımlamalar / Müşteriler</span>
        <h1>Müşteriler</h1>
        <p>PKTakip uzman müşterilerini yönetin.</p>
      </div>
      <Button label="Yeni Uzman" icon="pi pi-plus" class="pk-primary" />
    </div>

    <CustomerStats :total="experts.length" :active="activeCount" :inactive="inactiveCount" />

    <CustomerTable :customers="experts" :loading="loading" @open="openTenant" />

    <Message v-if="error" severity="error" :closable="false" class="error-message">{{ error }}</Message>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const config = useRuntimeConfig()
const { authHeaders } = useAuth()
const tenants = ref<any[]>([])
const loading = ref(true)
const error = ref('')

const experts = computed(() => tenants.value.filter(tenant => tenant.tenant_type === 'expert'))
const activeCount = computed(() => experts.value.filter(tenant => Boolean(tenant.status)).length)
const inactiveCount = computed(() => experts.value.filter(tenant => !tenant.status).length)

onMounted(async () => {
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
})

const openTenant = (tenant: any) => {
  console.log('tenant', tenant)
}
</script>

<style scoped>
.customers-page { max-width: 1500px; margin: 0 auto; }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 24px; }
.eyebrow { display: block; margin-bottom: 7px; color: var(--pk-yellow-dark); font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
.page-head h1 { margin: 0; color: var(--admin-heading); font-size: 30px; line-height: 1.15; letter-spacing: -.7px; }
.page-head p { margin: 7px 0 0; color: var(--admin-muted); font-size: 13px; }
.error-message { margin-top: 16px; }
@media (max-width: 700px) { .page-head { align-items: flex-start; flex-direction: column; } }
</style>
