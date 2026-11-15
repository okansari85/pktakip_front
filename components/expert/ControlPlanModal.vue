<template>
  <div class="modal-backdrop">
    <section class="modal-card">
      <div class="modal-head">
        <div>
          <h2>{{ plan ? 'Planı düzenle' : 'Kontrol planla' }}</h2>
          <p>Plan takvimde ve ajandada mevcut kontrollerle birlikte görünür.<template v-if="plan?.created_by_name"> Planlayan: {{ plan.created_by_name }}</template></p>
        </div>
        <button class="close-button" type="button" aria-label="Kapat" @click="close"><i class="pi pi-times" /></button>
      </div>

      <div class="form-grid">
        <label>Tarih <span>*</span><input v-model="form.date" type="date" /></label>
        <label>Lokasyon <span>*</span>
          <select v-model="form.location_id">
            <option :value="null" disabled>Lokasyon seçin</option>
            <option v-for="group in groups" :key="group.location_id" :value="group.location_id">{{ group.location_name }}</option>
          </select>
        </label>
        <label class="wide">Firma / işyeri <small>(isteğe bağlı)</small>
          <select v-model="form.workplace_id" :disabled="!form.location_id">
            <option :value="null">Lokasyon geneli</option>
            <option v-for="item in workplaces" :key="item.id" :value="item.id">{{ workplaceLabel(item.id, item.company_name) }}</option>
          </select>
        </label>
        <label>Ekipman türü <small>(isteğe bağlı)</small>
          <select v-model="form.equipment_type_id" :disabled="!form.location_id">
            <option :value="null">Seçilmedi</option>
            <option v-for="type in types" :key="type.id" :value="type.id">{{ type.name }}</option>
          </select>
        </label>
        <label>Tesisat <small>(isteğe bağlı)</small>
          <select v-model="form.installation_id" :disabled="!form.location_id">
            <option :value="null">Seçilmedi</option>
            <option v-for="item in installations" :key="item.id" :value="item.id">{{ installationLabel(item) }}</option>
          </select>
        </label>
        <div class="wide field">
          <span class="field-label">Ekipmanlar <small>(isteğe bağlı)</small></span>
          <MultiSelect
            v-model="form.equipment_ids"
            :options="equipmentOptions"
            option-label="label"
            option-value="id"
            filter
            filter-placeholder="Ad, no ya da yer ile ara"
            display="chip"
            placeholder="Ekipman seçin"
            empty-message="Bu lokasyonda ekipman yok"
            empty-filter-message="Eşleşen ekipman yok"
            :loading="optionsLoading"
            :disabled="!form.location_id"
            fluid
          />
        </div>
        <label class="wide">Başlık <small>(isteğe bağlı)</small><input v-model="form.title" type="text" maxlength="255" placeholder="Ör. Forklift yıllık kontrolü" /></label>
        <label class="wide">Not <small>(isteğe bağlı)</small><textarea v-model="form.note" rows="3" maxlength="5000" /></label>
      </div>

      <p v-if="optionsError" class="error-text">{{ optionsError }}</p>
      <p v-if="error" class="error-text">{{ error }}</p>
      <div class="modal-actions">
        <button v-if="plan" class="danger-button" type="button" :disabled="saving" @click="remove"><i class="pi pi-trash" /> Sil</button>
        <button class="secondary-button" type="button" @click="close">İptal</button>
        <button class="primary-button" type="button" :disabled="saving || !form.date || !form.location_id" @click="save">{{ saving ? 'Kaydediliyor...' : 'Kaydet' }}</button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// Kontrol planı (pk-control-plans): tarih ve lokasyon zorunlu; firma / işyeri, ekipman türü, ekipmanlar, tesisat, başlık ve not
// isteğe bağlı. Seçenekler lokasyonun ekipman ve tesisat listesinden (Ekipmanlar / Tesisatlar sayfalarının uçları).
// plan: düzenlenen kayıt (Sil düğmesi de görünür); initial: yeni planın ön dolu alanları (seçili gün, kapsam).
const props = defineProps<{ plan?: any; initial?: Record<string, any> }>()
const emit = defineEmits<{ close: []; saved: [plan: any]; deleted: [plan: any] }>()

const { get, post, patch, del, errorMessage } = useExpertApi()
const { groups } = useMyWorkplaces()
const { load: loadNames, workplaceLabel } = useWorkplaceNames()
loadNames()

const source = props.plan || props.initial || {}
const form = reactive({
  date: (source.date as string) || agendaDateKey(new Date()),
  location_id: (source.location_id as number) ?? null,
  workplace_id: (source.workplace_id as number) ?? null,
  equipment_type_id: (source.equipment_type_id as number) ?? null,
  equipment_ids: [...(source.equipment_ids || [])] as number[],
  installation_id: (source.installation_id as number) ?? null,
  title: (source.title as string) || '',
  note: (source.note as string) || ''
})
const body = () => ({
  date: form.date,
  location_id: form.location_id,
  workplace_id: form.workplace_id,
  equipment_type_id: form.equipment_type_id,
  equipment_ids: form.equipment_ids,
  installation_id: form.installation_id,
  title: form.title.trim() || null,
  note: form.note.trim() || null
})
const original = body()

const workplaces = computed(() => groups.value.find(group => group.location_id === form.location_id)?.items || [])

// Lokasyonun ekipman ve tesisatları (lokasyon değişince yeniden alınır; firma, tür, ekipman ve tesisat seçimi sıfırlanır).
const equipment = ref<any[]>([])
const installations = ref<any[]>([])
const optionsLoading = ref(false)
const optionsError = ref('')
let optionsRequest = 0
const loadOptions = async () => {
  const no = ++optionsRequest
  equipment.value = []
  installations.value = []
  optionsError.value = ''
  if (!form.location_id) return
  optionsLoading.value = true
  try {
    const [items, list] = await Promise.all([
      get<any[]>('/pk-equipment', { location_id: form.location_id }),
      get<any[]>('/pk-installations', { location_id: form.location_id })
    ])
    if (no !== optionsRequest) return
    equipment.value = items || []
    installations.value = list || []
  } catch (e: any) {
    if (no === optionsRequest) optionsError.value = errorMessage(e, 'Ekipman ve tesisat listesi alınamadı.')
  } finally { if (no === optionsRequest) optionsLoading.value = false }
}
watch(() => form.location_id, (value, previous) => {
  if (previous !== undefined) Object.assign(form, { workplace_id: null, equipment_type_id: null, equipment_ids: [], installation_id: null })
  loadOptions()
}, { immediate: true })

// Ekipman türleri: lokasyondaki ekipmanların türleri (plandaki tür artık ekipmanda yoksa da listede kalır).
const types = computed(() => {
  const map = new Map<number, string>()
  for (const item of equipment.value) if (item.type?.id) map.set(item.type.id, item.type.name)
  if (form.equipment_type_id && !map.has(form.equipment_type_id)) map.set(form.equipment_type_id, props.plan?.equipment_type_name || props.initial?.equipment_type_name || 'Seçili tür')
  return [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'tr'))
})
const equipmentOptions = computed(() => equipment.value.map(item => ({
  id: item.id,
  label: [item.type?.name ? agendaShortName(item.type.name) : '', item.code && `no ${item.code}`, item.name && item.name !== item.type?.name ? item.name : '', item.place].filter(Boolean).join(' · ') || `Ekipman ${item.id}`
})))
const installationLabel = (item: any) => item.type?.name && item.name && item.name !== item.type.name ? `${item.type.name} · ${item.name}` : item.name || item.type?.name || `Tesisat ${item.id}`

const saving = ref(false)
const error = ref('')
const close = () => { if (!saving.value) emit('close') }

const save = async () => {
  const data = body()
  // Düzenlemede yalnız değişen alanlar gider.
  const changed = props.plan ? Object.fromEntries(Object.entries(data).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify((original as any)[key]))) : data
  if (props.plan && !Object.keys(changed).length) { emit('close'); return }
  saving.value = true
  error.value = ''
  try {
    emit('saved', props.plan ? await patch(`/pk-control-plans/${props.plan.id}`, changed) : await post('/pk-control-plans', data))
  } catch (e: any) {
    error.value = errorMessage(e, 'Plan kaydedilemedi.')
  } finally { saving.value = false }
}

const remove = async () => {
  if (!props.plan || !confirm('Bu kontrol planı silinsin mi?')) return
  saving.value = true
  error.value = ''
  try {
    await del(`/pk-control-plans/${props.plan.id}`)
    emit('deleted', props.plan)
  } catch (e: any) {
    error.value = errorMessage(e, 'Plan silinemedi.')
  } finally { saving.value = false }
}
</script>

<style scoped>
.modal-backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:var(--admin-overlay)}
.modal-card{width:min(640px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:22px;background:var(--admin-card);border-radius:12px;box-shadow:0 20px 60px var(--admin-shadow)}
.modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:14px}
h2{margin:0;color:var(--admin-heading);font-size:18px}.modal-head p{margin:5px 0 0;color:var(--admin-muted);font-size:12px}
.close-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:var(--admin-muted);cursor:pointer;border-radius:7px}.close-button:hover{background:var(--admin-hover);color:var(--admin-heading)}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.form-grid label,.field-label{display:block;color:var(--admin-heading);font-size:12px;font-weight:700}.form-grid label > span{color:var(--admin-danger-text)}
.form-grid small{color:var(--admin-muted);font-weight:400}.wide{grid-column:1 / -1}
.field{display:grid;gap:6px}
.form-grid input,.form-grid select,.form-grid textarea{display:block;width:100%;margin-top:6px;padding:0 10px;height:40px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:13px;outline:0}
.form-grid textarea{height:auto;padding:9px 10px;resize:vertical}
.form-grid input:focus,.form-grid select:focus,.form-grid textarea:focus{border-color:var(--pk-accent);box-shadow:0 0 0 3px var(--pk-focus-ring)}
.form-grid select:disabled{opacity:.6}
.error-text{margin:10px 0 0;color:var(--admin-danger-text);font-size:12px}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 17px;border:0;border-radius:8px;background:var(--pk-yellow);color:var(--pk-on-accent);font-size:13px;font-weight:800;cursor:pointer}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.secondary-button{min-height:40px;padding:0 18px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-hover);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}
.danger-button{display:inline-flex;align-items:center;gap:7px;min-height:40px;margin-right:auto;padding:0 16px;border:1px solid var(--admin-danger-text);border-radius:8px;background:transparent;color:var(--admin-danger-text);font-size:12px;font-weight:700;cursor:pointer}
.danger-button:hover{background:var(--admin-danger-bg)}.danger-button:disabled{opacity:.55;cursor:not-allowed}
@media (max-width:560px){.form-grid{grid-template-columns:1fr}}
</style>
