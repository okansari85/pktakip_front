<template>
  <div class="packages-page">
    <div class="page-head">
      <div>
        <span class="eyebrow">Yönetim / Paketler</span>
        <h1>Paketler ve Krediler</h1>
        <p>Paketleri tanımlayın, hesaplara paket atayın, gerekirse elle kredi ekleyin. Kredi yalnızca rapor okumada düşer; işyeri sayısı paketin aktif işyeri limitiyle sınırlanır (kullanıcı sınırsız).</p>
      </div>
    </div>

    <div class="tabs">
      <button type="button" :class="{ active: tab === 'accounts' }" @click="tab = 'accounts'">Hesaplar</button>
      <button type="button" :class="{ active: tab === 'packages' }" @click="tab = 'packages'">Paketler</button>
    </div>

    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

    <!-- Hesaplar: paket, kalan kredi, işyeri doluluğu -->
    <div v-if="tab === 'accounts'" class="table-card">
      <DataTable :value="accounts" :loading="loading" responsiveLayout="scroll" emptyMessage="Hesap yok.">
        <Column header="Hesap">
          <template #body="{ data }"><strong>{{ data.name }}</strong><small class="block">{{ TYPE_LABELS[data.tenant_type] }}</small></template>
        </Column>
        <Column header="Paket">
          <template #body="{ data }">
            <Tag :value="data.package?.name || MODE_LABELS[data.mode]" :severity="data.mode === 'package' ? 'success' : data.mode === 'unlimited' ? 'secondary' : data.mode === 'promo' ? 'info' : 'danger'" />
          </template>
        </Column>
        <Column header="Kredi">
          <template #body="{ data }"><span v-if="data.unlimited" class="muted">Sınırsız</span><strong v-else :class="{ danger: data.credits <= 0 }">{{ data.credits }}</strong><small v-if="data.mode === 'package'" class="block">aylık +{{ data.monthly_credits }}</small></template>
        </Column>
        <Column header="Aktif işyeri">
          <template #body="{ data }">{{ data.active_workplaces ?? '—' }}<span v-if="data.workplace_limit !== null && data.workplace_limit !== undefined" class="muted"> / {{ data.workplace_limit }}</span></template>
        </Column>
        <Column header="Sıradaki yükleme">
          <template #body="{ data }">{{ data.next_grant_at ? formatDate(data.next_grant_at) : '—' }}</template>
        </Column>
        <Column header="İşlemler" headerStyle="width: 150px">
          <template #body="{ data }">
            <div class="actions">
              <Button icon="pi pi-box" text rounded v-tooltip.top="'Paket ata'" @click="openAssign(data)" />
              <Button icon="pi pi-plus-circle" text rounded v-tooltip.top="'Elle kredi'" @click="openCredit(data)" />
              <Button icon="pi pi-list" text rounded v-tooltip.top="'Kredi hareketleri'" @click="entriesFor = data" />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Paketler: hesap türüne göre -->
    <template v-else>
      <div class="toolbar"><Button label="Yeni paket" icon="pi pi-plus" class="pk-primary" @click="openPackage(null)" /></div>
      <div class="table-card">
        <DataTable :value="packages" :loading="loading" responsiveLayout="scroll" emptyMessage="Paket yok.">
          <Column header="Paket"><template #body="{ data }"><strong>{{ data.name }}</strong></template></Column>
          <Column header="Müşteri türü"><template #body="{ data }">{{ TYPE_LABELS[data.account_type] }}</template></Column>
          <Column header="Aylık kredi"><template #body="{ data }">{{ data.monthly_credits }}</template></Column>
          <Column header="İşyeri limiti"><template #body="{ data }">{{ data.workplace_limit ?? 'Sınırsız' }}</template></Column>
          <Column header="Aylık fiyat"><template #body="{ data }">{{ money(data.monthly_price) }}</template></Column>
          <Column header="Yıllık fiyat"><template #body="{ data }">{{ money(data.yearly_price) }}</template></Column>
          <Column header="Durum"><template #body="{ data }"><Tag :value="data.is_active ? 'Aktif' : 'Pasif'" :severity="data.is_active ? 'success' : 'secondary'" /></template></Column>
          <Column header="" headerStyle="width: 70px"><template #body="{ data }"><Button icon="pi pi-pencil" text rounded @click="openPackage(data)" /></template></Column>
        </DataTable>
      </div>
      <p class="hint">Paketi değiştirmek, o paketin atanmış olduğu hesapları değiştirmez (hesap atama anındaki değerlerle devam eder); hesaba yeniden atanınca yeni değerler geçer.</p>
    </template>

    <!-- Paket ekle / düzenle -->
    <Dialog v-model:visible="packageOpen" modal :header="packageForm.id ? 'Paketi düzenle' : 'Yeni paket'" :style="{ width: '520px' }" :closable="!saving">
      <div class="field"><label>Paket adı</label><InputText v-model="packageForm.name" fluid /></div>
      <div class="field"><label>Müşteri türü</label><SelectButton v-model="packageForm.account_type" :options="TYPE_OPTIONS" option-label="label" option-value="value" :allow-empty="false" /></div>
      <div class="grid-2">
        <div class="field"><label>Aylık kredi</label><InputNumber v-model="packageForm.monthly_credits" :min="0" fluid /></div>
        <div class="field"><label>İşyeri limiti <small>(boş = sınırsız)</small></label><InputNumber v-model="packageForm.workplace_limit" :min="0" fluid /></div>
        <div class="field"><label>Aylık fiyat (TL + KDV)</label><InputNumber v-model="packageForm.monthly_price" :min="0" :max-fraction-digits="2" fluid /></div>
        <div class="field"><label>Yıllık fiyat (TL + KDV)</label><InputNumber v-model="packageForm.yearly_price" :min="0" :max-fraction-digits="2" fluid /></div>
      </div>
      <label class="check"><Checkbox v-model="packageForm.is_active" binary /> Aktif (satışta)</label>
      <Message v-if="dialogError" severity="error" :closable="false">{{ dialogError }}</Message>
      <template #footer>
        <Button label="Vazgeç" text :disabled="saving" @click="packageOpen = false" />
        <Button label="Kaydet" icon="pi pi-check" class="pk-primary" :loading="saving" :disabled="!packageForm.name.trim()" @click="savePackage" />
      </template>
    </Dialog>

    <!-- Paket ata -->
    <Dialog v-model:visible="assignOpen" modal header="Paket ata" :style="{ width: '480px' }" :closable="!saving">
      <p class="dialog-intro">{{ target?.name }} · {{ target && TYPE_LABELS[target.tenant_type] }}</p>
      <div class="field">
        <label>Paket</label>
        <Select v-model="assignForm.choice" :options="assignOptions" option-label="label" option-value="value" fluid />
      </div>
      <p class="hint">Pakete geçişte önceki kredi sıfırlanır ve paketin ilk ayının kredisi hemen yüklenir; sonra her ay aynı gün yüklenir, yılda bir sıfırlanır.</p>
      <div class="field"><label>Not <small>(opsiyonel)</small></label><InputText v-model="assignForm.note" fluid /></div>
      <Message v-if="dialogError" severity="error" :closable="false">{{ dialogError }}</Message>
      <template #footer>
        <Button label="Vazgeç" text :disabled="saving" @click="assignOpen = false" />
        <Button label="Ata" icon="pi pi-check" class="pk-primary" :loading="saving" :disabled="!assignForm.choice" @click="saveAssign" />
      </template>
    </Dialog>

    <!-- Elle kredi -->
    <Dialog v-model:visible="creditOpen" modal header="Elle kredi" :style="{ width: '440px' }" :closable="!saving">
      <p class="dialog-intro">{{ target?.name }} · kalan {{ target?.unlimited ? 'sınırsız' : `${target?.credits ?? 0} kredi` }}</p>
      <div class="field"><label>Kredi <small>(eksi değer düşer)</small></label><InputNumber v-model="creditForm.amount" fluid /></div>
      <div class="field"><label>Açıklama</label><InputText v-model="creditForm.note" placeholder="Örn. Ek kredi paketi, hatalı okuma iadesi" fluid /></div>
      <Message v-if="dialogError" severity="error" :closable="false">{{ dialogError }}</Message>
      <template #footer>
        <Button label="Vazgeç" text :disabled="saving" @click="creditOpen = false" />
        <Button label="Kaydet" icon="pi pi-check" class="pk-primary" :loading="saving" :disabled="!creditForm.amount || !creditForm.note.trim()" @click="saveCredit" />
      </template>
    </Dialog>

    <!-- Kredi hareketleri -->
    <Dialog :visible="!!entriesFor" modal :header="`Kredi hareketleri · ${entriesFor?.name || ''}`" :style="{ width: '760px' }" @update:visible="value => { if (!value) entriesFor = null }">
      <ExpertCreditEntries v-if="entriesFor" :source="page => adminEntries(entriesFor!.id, page)" />
    </Dialog>
  </div>
</template>

<script setup lang="ts">
// Süper admin: paket tanımları ve hesapların paketleri / kredileri (ödeme adımı gelene kadar paketler buradan atanır).
definePageMeta({ middleware: 'super-admin' })

const config = useRuntimeConfig()
const { authHeaders } = useAuth()
const api = <T = any>(path: string, options: any = {}) => $fetch<T>(`${config.public.apiBaseUrl}/pk-admin${path}`, { headers: authHeaders(), ...options })
const messageOf = (e: any, fallback: string) => {
  const errors = e?.data?.errors
  return (errors && (Object.values(errors).flat()[0] as string)) || e?.data?.message || fallback
}

const TYPE_LABELS: Record<string, string> = { expert: 'Bireysel uzman', osgb: 'OSGB', corporate: 'Kurumsal' }
const TYPE_OPTIONS = [{ label: 'Bireysel uzman', value: 'expert' }, { label: 'OSGB', value: 'osgb' }, { label: 'Kurumsal', value: 'corporate' }]
const money = (value: any) => value === null || value === undefined ? '—' : `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(Number(value))} TL`
const formatDate = (value: string) => new Intl.DateTimeFormat('tr-TR').format(new Date(value))

const tab = ref<'accounts' | 'packages'>('accounts')
const accounts = ref<any[]>([])
const packages = ref<any[]>([])
const loading = ref(true)
const error = ref('')
const saving = ref(false)
const dialogError = ref('')

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    [accounts.value, packages.value] = await Promise.all([api<any[]>('/accounts'), api<any[]>('/packages')])
  } catch (e: any) {
    error.value = messageOf(e, 'Paketler alınamadı.')
  } finally { loading.value = false }
}

// --- Paket ---
const packageOpen = ref(false)
const packageForm = reactive({ id: null as number | null, name: '', account_type: 'expert', monthly_credits: 0 as number | null, workplace_limit: null as number | null, monthly_price: null as number | null, yearly_price: null as number | null, is_active: true })
const openPackage = (item: any) => {
  Object.assign(packageForm, item
    ? { id: item.id, name: item.name, account_type: item.account_type, monthly_credits: item.monthly_credits, workplace_limit: item.workplace_limit, monthly_price: item.monthly_price === null ? null : Number(item.monthly_price), yearly_price: item.yearly_price === null ? null : Number(item.yearly_price), is_active: !!item.is_active }
    : { id: null, name: '', account_type: 'expert', monthly_credits: 0, workplace_limit: null, monthly_price: null, yearly_price: null, is_active: true })
  dialogError.value = ''
  packageOpen.value = true
}
const savePackage = async () => {
  saving.value = true
  dialogError.value = ''
  const body = { ...packageForm, name: packageForm.name.trim(), monthly_credits: packageForm.monthly_credits ?? 0 }
  try {
    await (packageForm.id ? api(`/packages/${packageForm.id}`, { method: 'PATCH', body }) : api('/packages', { method: 'POST', body }))
    packageOpen.value = false
    await load()
  } catch (e: any) {
    dialogError.value = messageOf(e, 'Paket kaydedilemedi.')
  } finally { saving.value = false }
}

// --- Hesaba paket ata ---
const target = ref<any>(null)
const assignOpen = ref(false)
const assignForm = reactive({ choice: '' as string, note: '' })
const assignOptions = computed(() => [
  ...packages.value.filter(item => item.is_active && item.account_type === target.value?.tenant_type)
    .map(item => ({ label: `${item.name} · ${item.monthly_credits} kredi/ay · ${item.workplace_limit ?? 'sınırsız'} işyeri`, value: `package:${item.id}` })),
  { label: 'Sınırsız (geçiş)', value: 'unlimited' },
  { label: 'Paket yok (okuma ve yeni işyeri kapalı)', value: 'none' }
])
const openAssign = (account: any) => {
  target.value = account
  assignForm.choice = account.mode === 'package' && account.package ? `package:${account.package.id}` : account.mode === 'unlimited' ? 'unlimited' : ''
  assignForm.note = ''
  dialogError.value = ''
  assignOpen.value = true
}
const saveAssign = async () => {
  saving.value = true
  dialogError.value = ''
  const [mode, id] = assignForm.choice.split(':')
  try {
    await api(`/accounts/${target.value.id}/assign`, { method: 'POST', body: { mode, pk_package_id: id ? Number(id) : null, note: assignForm.note.trim() || null } })
    assignOpen.value = false
    await load()
  } catch (e: any) {
    dialogError.value = messageOf(e, 'Paket atanamadı.')
  } finally { saving.value = false }
}

// --- Elle kredi ---
const creditOpen = ref(false)
const creditForm = reactive({ amount: null as number | null, note: '' })
const openCredit = (account: any) => {
  target.value = account
  Object.assign(creditForm, { amount: null, note: '' })
  dialogError.value = ''
  creditOpen.value = true
}
const saveCredit = async () => {
  saving.value = true
  dialogError.value = ''
  try {
    await api(`/accounts/${target.value.id}/credit`, { method: 'POST', body: { amount: creditForm.amount, note: creditForm.note.trim() } })
    creditOpen.value = false
    await load()
  } catch (e: any) {
    dialogError.value = messageOf(e, 'Kredi eklenemedi.')
  } finally { saving.value = false }
}

// --- Kredi hareketleri ---
const entriesFor = ref<any>(null)
const adminEntries = (tenantId: number, page: number) => api<any>(`/accounts/${tenantId}/entries`, { query: { page } })

onMounted(load)
</script>

<style scoped>
.packages-page { display: grid; gap: 16px; }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; }
.eyebrow { color: var(--admin-muted); font-size: 12px; }
h1 { margin: 8px 0 0; color: var(--admin-heading); font-size: 28px; letter-spacing: -.6px; }
.page-head p { max-width: 760px; margin: 7px 0 0; color: var(--admin-muted); font-size: 13px; line-height: 1.5; }
.tabs { display: flex; gap: 4px; width: fit-content; padding: 4px; border: 1px solid var(--admin-border); border-radius: 10px; background: var(--admin-card); }
.tabs button { min-height: 34px; padding: 0 16px; border: 0; border-radius: 7px; background: transparent; color: var(--admin-muted); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
.tabs button.active { background: var(--admin-accent-soft); color: var(--admin-heading); }
.toolbar { display: flex; justify-content: flex-end; }
.table-card { overflow: hidden; border: 1px solid var(--admin-border); border-radius: 12px; background: var(--admin-card); }
.block { display: block; margin-top: 3px; color: var(--admin-muted); font-size: 11px; }
.muted { color: var(--admin-muted); }
.danger { color: var(--admin-danger-text); }
.actions { display: flex; gap: 2px; }
.hint { margin: 0; color: var(--admin-muted); font-size: 12px; line-height: 1.5; }
.dialog-intro { margin: 0 0 14px; color: var(--admin-muted); font-size: 13px; }
.field { display: grid; gap: 6px; margin-bottom: 14px; }
.field label { color: var(--admin-heading); font-size: 12px; font-weight: 700; }
.field label small { color: var(--admin-muted); font-weight: 400; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; }
.check { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; color: var(--admin-heading); font-size: 13px; }
:deep(.p-datatable-thead > tr > th) { padding: 13px 16px; background: var(--admin-soft); color: var(--admin-muted); border-color: var(--admin-border); font-size: 11px; font-weight: 700; }
:deep(.p-datatable-tbody > tr > td) { padding: 12px 16px; background: var(--admin-card); color: var(--admin-text); border-color: var(--admin-border); font-size: 13px; }
</style>
