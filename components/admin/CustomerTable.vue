<template>
  <div class="table-card">
    <div class="table-head">
      <div><strong>Uzmanlar</strong><span>Tenant tipi <b>Uzman</b> olan müşteriler</span></div>
      <span class="count-badge">{{ customers.length }} kayıt</span>
    </div>

    <DataTable :value="customers" :loading="loading" paginator :rows="10" responsiveLayout="scroll" emptyMessage="Kayıtlı uzman bulunamadı.">
      <Column header="Müşteri">
        <template #body="{ data }">
          <div class="customer-cell">
            <span class="customer-avatar">{{ initials(data.name) }}</span>
            <div><strong>{{ data.name }}</strong><small>{{ data.slug }}</small></div>
          </div>
        </template>
      </Column>
      <Column header="Tip"><template #body><Tag value="Uzman" severity="warn" /></template></Column>
      <Column header="Durum">
        <template #body="{ data }"><Tag :value="data.status ? 'Aktif' : 'Pasif'" :severity="data.status ? 'success' : 'danger'" /></template>
      </Column>
      <Column header="İşlemler" headerStyle="width: 150px">
        <template #body="{ data }">
          <div class="actions">
            <Button icon="pi pi-envelope" text rounded aria-label="Davet maili gönder" v-tooltip.top="'Davet maili gönder'" @click="sendInvite(data)" />
            <Button icon="pi pi-sign-in" text rounded aria-label="Uzman olarak giriş yap" v-tooltip.top="'Uzman olarak giriş yap'" @click="impersonate(data)" />
            <Button icon="pi pi-chevron-right" text rounded aria-label="Müşteri detayını aç" @click="openTenant(data)" />
          </div>
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<script setup lang="ts">
defineProps<{ customers: any[]; loading: boolean }>()
const emit = defineEmits<{ open: [tenant: any]; impersonate: [tenant: any]; sendInvite: [tenant: any] }>()
const initials = (name: string) => name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()
const openTenant = (tenant: any) => emit('open', tenant)
const impersonate = (tenant: any) => emit('impersonate', tenant)
const sendInvite = (tenant: any) => emit('sendInvite', tenant)
</script>

<style scoped>
.table-card { overflow: hidden; border: 1px solid var(--admin-border); border-radius: 12px; background: var(--admin-card); box-shadow: 0 1px 2px rgba(15, 23, 42, .03); }
.table-head { min-height: 72px; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; border-bottom: 1px solid var(--admin-border); }
.table-head strong { display: block; color: var(--admin-heading); font-size: 14px; }
.table-head span { display: block; margin-top: 4px; color: var(--admin-muted); font-size: 11px; }
.table-head b { color: var(--pk-yellow-dark); }
.count-badge { padding: 5px 9px; border-radius: 7px; background: var(--admin-soft); color: var(--admin-muted) !important; font-weight: 600; }
.customer-cell { display: flex; align-items: center; gap: 11px; }
.customer-avatar { width: 36px; height: 36px; display: grid; place-items: center; flex: 0 0 auto; border-radius: 9px; background: #fff5cc; color: #b57b00; font-size: 11px; font-weight: 800; }
.customer-cell strong { display: block; color: var(--admin-heading); font-size: 13px; }
.customer-cell small { display: block; margin-top: 3px; color: var(--admin-muted); font-size: 10px; }
.actions { display: flex; align-items: center; gap: 2px; }
:deep(.p-datatable-thead > tr > th) { padding: 13px 16px; background: var(--admin-soft); color: var(--admin-muted); border-color: var(--admin-border); font-size: 11px; font-weight: 700; }
:deep(.p-datatable-tbody > tr > td) { padding: 12px 16px; background: var(--admin-card); color: var(--admin-text); border-color: var(--admin-border); }
:deep(.p-paginator) { background: var(--admin-card); border-color: var(--admin-border); }
</style>
