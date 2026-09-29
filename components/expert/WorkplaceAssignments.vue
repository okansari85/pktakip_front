<template>
  <section class="table-card assignments">
    <div class="section-head">
      <div>
        <h2>Uzman atamaları</h2>
        <p>Firma (işyeri) başına uzman. Uzman, Firmalarım'da yalnızca atandığı firmaları görür.</p>
      </div>
      <span v-if="unassignedCount" class="warn-badge"><i class="pi pi-exclamation-triangle" /> {{ unassignedCount }} firmanın uzmanı yok</span>
    </div>
    <div class="toolbar">
      <div class="search-box"><i class="pi pi-search" /><input v-model="search" type="text" placeholder="Firma, müşteri ya da lokasyon ara" /></div>
      <label class="check"><input v-model="onlyUnassigned" type="checkbox" /> Sadece uzmanı olmayanlar</label>
    </div>

    <div v-if="loading" class="state-row">Atamalar yükleniyor...</div>
    <div v-else-if="error" class="state-row error-state">{{ error }}</div>
    <div v-else-if="!workplaces.length" class="state-row">Henüz firma (işyeri) yok. Firmaları lokasyonlara Lokasyonlar sayfasından eklersiniz.</div>
    <div v-else-if="!shown.length" class="state-row">Filtreye uyan firma yok.</div>
    <div v-else class="table-wrap">
      <table>
        <thead><tr><th>Firma</th><th>{{ corporate ? 'Lokasyon' : 'Müşteri · Lokasyon' }}</th><th>Uzmanlar</th><th class="actions-head">İşlemler</th></tr></thead>
        <tbody>
          <tr v-for="item in shown" :key="item.id">
            <td><strong>{{ item.company_name }}</strong></td>
            <td>{{ [corporate ? null : item.customer_name, item.location_name].filter(Boolean).join(' · ') }}</td>
            <td>
              <span v-for="person in expertsOf(item)" :key="person.id" class="chip">{{ person.name }}</span>
              <span v-if="!expertsOf(item).length" class="chip empty">Uzman yok</span>
            </td>
            <td class="actions"><button class="icon-button" type="button" title="Uzman ata" @click="open(item)"><i class="pi pi-user-edit" /></button></td>
          </tr>
        </tbody>
      </table>
      <div class="table-footer"><span>Toplam {{ shown.length }} firma</span></div>
    </div>

    <div v-if="target" class="modal-backdrop" @click.self="close">
      <section class="modal-card">
        <div class="modal-head">
          <div><h2>Uzman Ata</h2><p>{{ target.company_name }} · {{ target.location_name }}</p></div>
          <button class="close-button" type="button" @click="close"><i class="pi pi-times" /></button>
        </div>
        <p v-if="!experts.length" class="hint">Hesapta aktif uzman yok. Uzmanları Kullanıcılar sayfasından eklersiniz.</p>
        <div v-else class="expert-list">
          <label v-for="person in experts" :key="person.id" class="expert-option">
            <input v-model="selected" type="checkbox" :value="person.id" />
            <span><strong>{{ person.name }}</strong><small>{{ person.email }}</small></span>
          </label>
        </div>
        <p v-if="formError" class="form-error">{{ formError }}</p>
        <div class="modal-actions">
          <button class="secondary-button" type="button" @click="close">İptal</button>
          <button class="primary-button" type="button" :disabled="saving || !experts.length" @click="save">{{ saving ? 'Kaydediliyor...' : 'Kaydet' }}</button>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
// Ayarlar → Firmalar altında (yalnızca OSGB / kurumsal hesabın yöneticisi ve operasyon yöneticisi): firma (işyeri) başına
// uzman ataması. Bireysel uzman hesabında gösterilmez.
interface AssignedUser { id: number; name: string; role: string; passive: boolean }
interface AssignmentWorkplace { id: number; company_name: string; location_name: string; customer_name?: string | null; users: AssignedUser[] }
interface Expert { id: number; name: string; email: string }

const { get, patch, errorMessage } = useExpertApi()
// Kurumsal hesapta müşteri firmanın kendisi: yalnızca lokasyon.
const { corporate } = useAccount()

const workplaces = ref<AssignmentWorkplace[]>([])
const experts = ref<Expert[]>([])
const loading = ref(true)
const error = ref('')
const search = ref('')
const onlyUnassigned = ref(false)

// Firmanın uzmanları (yönetici / operasyon yöneticisinin işyeri eklerken oluşan kaydı uzman sayılmaz).
const expertsOf = (item: AssignmentWorkplace) => item.users.filter(person => person.role === 'uzman')
const unassignedCount = computed(() => workplaces.value.filter(item => !expertsOf(item).length).length)
const trLower = (value?: string | null) => (value || '').toLocaleLowerCase('tr-TR')
const shown = computed(() => {
  const q = trLower(search.value.trim())
  return workplaces.value.filter(item => (!onlyUnassigned.value || !expertsOf(item).length)
    && (!q || [item.company_name, item.customer_name, item.location_name].some(value => trLower(value).includes(q))))
})

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const data = await get<{ workplaces: AssignmentWorkplace[]; experts: Expert[] }>('/pk-account/assignments')
    workplaces.value = data.workplaces
    experts.value = data.experts
  } catch (e: any) { error.value = errorMessage(e, 'Atamalar alınamadı.') }
  finally { loading.value = false }
}

const target = ref<AssignmentWorkplace | null>(null)
const selected = ref<number[]>([])
const saving = ref(false)
const formError = ref('')
const open = (item: AssignmentWorkplace) => { target.value = item; selected.value = expertsOf(item).map(person => person.id); formError.value = '' }
const close = () => { if (!saving.value) target.value = null }
const save = async () => {
  if (!target.value) return
  saving.value = true
  formError.value = ''
  try {
    const updated = await patch<AssignmentWorkplace>(`/pk-account/assignments/${target.value.id}`, { user_ids: selected.value })
    workplaces.value = workplaces.value.map(item => item.id === updated.id ? { ...item, users: updated.users } : item)
    target.value = null
  } catch (e: any) { formError.value = errorMessage(e, 'Atama kaydedilemedi.') }
  finally { saving.value = false }
}

onMounted(load)
</script>

<style scoped>
.table-card{margin-top:20px;background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px;overflow:hidden}
.section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px 16px 0}
.section-head h2{margin:0;color:var(--admin-heading);font-size:16px}.section-head p{margin:5px 0 0;color:var(--admin-muted);font-size:12px}
.warn-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;background:var(--admin-warning-bg);color:var(--admin-warning-text);font-size:11px;font-weight:800;white-space:nowrap}
.toolbar{padding:14px 16px 18px;border-bottom:1px solid var(--admin-border);display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.search-box{box-sizing:border-box;flex:1;min-width:220px;height:42px;display:flex;align-items:center;gap:10px;padding:0 12px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-muted)}.search-box input{width:100%;border:0;outline:0;background:transparent;color:var(--admin-heading);font-size:13px}.search-box input::placeholder{color:var(--admin-muted)}
.check{display:inline-flex;align-items:center;gap:8px;color:var(--admin-text);font-size:12px;font-weight:700;cursor:pointer}.check input{width:16px;height:16px;accent-color:#d7a900}
.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}th,td{padding:14px 16px;text-align:left;border-bottom:1px solid var(--admin-row-border);font-size:12px;color:var(--admin-muted);vertical-align:middle}th{font-size:11px;font-weight:700;color:var(--admin-muted);background:var(--admin-soft);white-space:nowrap}td strong{color:var(--admin-heading)}
.chip{display:inline-block;margin:2px 4px 2px 0;padding:3px 10px;border-radius:999px;background:var(--admin-chip);color:var(--admin-text);font-size:11px;font-weight:700}.chip.empty{background:var(--admin-warning-bg);color:var(--admin-warning-text)}
.actions-head{text-align:right}.actions{text-align:right}
.icon-button{width:32px;height:32px;display:inline-grid;place-items:center;border:1px solid var(--admin-border);border-radius:7px;background:var(--admin-input);color:var(--admin-muted);cursor:pointer}.icon-button:hover{border-color:#d7a900;background:var(--admin-accent-soft);color:var(--admin-heading)}
.table-footer{padding:14px 16px;color:var(--admin-muted);font-size:12px}.state-row{padding:50px 20px;text-align:center;color:var(--admin-muted);font-size:13px}.error-state{color:var(--admin-danger-text)}
.modal-backdrop{position:fixed;inset:0;z-index:100;background:var(--admin-overlay);display:grid;place-items:center;padding:20px}
.modal-card{width:min(460px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:22px;background:var(--admin-input);border-radius:12px;box-shadow:0 20px 60px var(--admin-shadow)}
.modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:18px}.modal-head h2{margin:0;color:var(--admin-heading);font-size:18px}.modal-head p{margin:5px 0 0;color:var(--admin-muted);font-size:12px}
.close-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:var(--admin-muted);cursor:pointer;border-radius:7px}.close-button:hover{background:var(--admin-hover);color:var(--admin-heading)}
.expert-list{display:grid;gap:6px;max-height:340px;overflow:auto}
.expert-option{display:flex;align-items:center;gap:10px;padding:9px 10px;border:1px solid var(--admin-border);border-radius:9px;cursor:pointer}.expert-option:hover{background:var(--admin-hover)}
.expert-option input{width:16px;height:16px;accent-color:#d7a900}.expert-option span{display:flex;flex-direction:column;gap:2px}.expert-option strong{color:var(--admin-heading);font-size:13px}.expert-option small{color:var(--admin-muted);font-size:11px}
.hint{margin:0 0 12px;color:var(--admin-muted);font-size:12px}.form-error{margin:10px 0 0;color:var(--admin-danger-text);font-size:12px}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
.primary-button{min-height:40px;padding:0 17px;border:0;border-radius:8px;background:var(--pk-yellow);color:#111827;font-size:13px;font-weight:800;cursor:pointer}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.secondary-button{min-height:40px;padding:0 18px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-hover);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}
</style>
