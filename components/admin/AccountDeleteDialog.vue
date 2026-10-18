<template>
  <Dialog v-model:visible="visible" modal header="Hesabı Kalıcı Olarak Sil" :style="{ width: '560px' }" :closable="!deleting" :dismissable-mask="false">
    <div v-if="loading" class="state"><i class="pi pi-spin pi-spinner" /> Silinecek kayıtlar hesaplanıyor...</div>
    <template v-else-if="summary">
      <Message severity="error" :closable="false">Bu işlem geri alınamaz. Hesap, aşağıdaki bütün kayıtları ve dosyalarıyla birlikte silinir.</Message>
      <dl class="summary">
        <dt>Hesap</dt><dd><strong>{{ summary.name }}</strong></dd>
        <dt>Müşteri</dt><dd>{{ summary.customers }}</dd>
        <dt>Organizasyon</dt><dd>{{ summary.organizations }}</dd>
        <dt>Lokasyon</dt><dd>{{ summary.locations }}</dd>
        <dt>İşyeri</dt><dd>{{ summary.workplaces }}</dd>
        <dt>Ekipman</dt><dd>{{ summary.equipment }}</dd>
        <dt>Kontrol kaydı</dt><dd>{{ summary.inspections }}</dd>
        <dt>Kullanıcı</dt><dd>{{ summary.users }} <small>(yalnız bu hesaba ait olanlar)</small></dd>
      </dl>
      <div class="field">
        <label for="confirm-name">Onaylamak için hesabın adını yazın: <b>{{ summary.name }}</b></label>
        <InputText id="confirm-name" v-model="confirmName" fluid :disabled="deleting" autocomplete="off" />
      </div>
    </template>
    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

    <template #footer>
      <Button label="İptal" text :disabled="deleting" @click="visible = false" />
      <Button label="Kalıcı olarak sil" icon="pi pi-trash" severity="danger" :loading="deleting" :disabled="!summary || confirmName.trim() !== summary.name.trim()" @click="remove" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
// Süper admin: pasif hesabı kalıcı silme (kullanıcı 19 Ekim 2026). Önce silinecek kayıtların özeti, hesabın adı yazılınca silinir.
const props = defineProps<{ modelValue: boolean; tenant: any | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; deleted: [message: string] }>()

const config = useRuntimeConfig()
const { authHeaders } = useAuth()
const summary = ref<any>(null)
const loading = ref(false)
const deleting = ref(false)
const error = ref('')
const confirmName = ref('')

const visible = computed({ get: () => props.modelValue, set: value => emit('update:modelValue', value) })

watch(() => props.modelValue, async (open) => {
  if (!open || !props.tenant) return
  summary.value = null
  confirmName.value = ''
  error.value = ''
  loading.value = true
  try {
    summary.value = await $fetch(`${config.public.apiBaseUrl}/pk-accounts/${props.tenant.id}/deletion-summary`, { headers: authHeaders() })
  } catch (e: any) {
    error.value = e?.data?.message || 'Özet alınamadı.'
  } finally { loading.value = false }
})

const remove = async () => {
  if (!props.tenant) return
  deleting.value = true
  error.value = ''
  try {
    const response = await $fetch<{ message: string }>(`${config.public.apiBaseUrl}/pk-accounts/${props.tenant.id}`, {
      method: 'DELETE', headers: authHeaders(), body: { confirm_name: confirmName.value }
    })
    emit('deleted', response.message)
    visible.value = false
  } catch (e: any) {
    const errors = e?.data?.errors
    error.value = (errors && (Object.values(errors).flat()[0] as string)) || e?.data?.message || 'Hesap silinemedi.'
  } finally { deleting.value = false }
}
</script>

<style scoped>
.state { display: flex; align-items: center; gap: 8px; padding: 24px 0; color: var(--admin-muted); font-size: 13px; }
.summary { display: grid; grid-template-columns: 140px 1fr; gap: 8px 14px; margin: 18px 0; font-size: 13px; }
.summary dt { color: var(--admin-muted); }
.summary dd { margin: 0; color: var(--admin-heading); font-weight: 700; }
.summary small { color: var(--admin-muted); font-weight: 400; }
.field label { display: block; margin-bottom: 7px; color: var(--admin-heading); font-size: 12px; }
</style>
