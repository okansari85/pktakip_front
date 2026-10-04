<template>
  <div class="drawer-backdrop">
    <aside class="area-drawer">
      <div class="drawer-head">
        <div>
          <h2>Lokasyon Alanları</h2>
          <div class="drawer-subtitle"><i class="pi pi-map-marker" /><div><strong>{{ location.name }}</strong><span>{{ customerName }}</span></div></div>
        </div>
        <button class="close-button" type="button" @click="emit('close')"><i class="pi pi-times" /></button>
      </div>

      <p class="intro"><i class="pi pi-info-circle" /> Alan, lokasyondaki fiziksel yerdir (bina, depo, kat, yemekhane…); isteğe bağlıdır, alan eklenmeyen lokasyon bugünkü gibi çalışır. Alan firmaya bağlı değildir: ekipman firmaya ait kalır, alan yalnızca nerede olduğunu söyler. Ayrı yönetilen bölümler (ör. Müşteri Hizmetleri) alan değil, lokasyonun "Firmalar" listesinde firmanın birimidir.</p>
      <div v-if="canEdit" class="drawer-toolbar">
        <button class="primary-button small" type="button" :disabled="loading" @click="openForm(null, null)"><i class="pi pi-plus" /> Alan Ekle</button>
      </div>

      <div v-if="loading" class="drawer-state">Alanlar yükleniyor...</div>
      <div v-else-if="error" class="drawer-state error-state">{{ error }}</div>
      <div v-else-if="!areas.length" class="drawer-state">Bu lokasyonda alan yok.</div>
      <ul v-else class="area-list">
        <li v-for="area in areas" :key="area.id" class="area-item" :class="{ passive: !area.is_active }">
          <div class="area-row">
            <span class="area-main">
              <strong>{{ area.name }}</strong>
              <small><span class="kind">{{ area.type.name }}</span><template v-if="!area.is_active"> · pasif</template><template v-if="area.equipment_count || area.installation_count"> · {{ countText(area) }}</template></small>
            </span>
            <span v-if="canEdit" class="area-actions">
              <button class="icon-button" type="button" title="Alt alan ekle" @click="openForm(null, area)"><i class="pi pi-plus" /></button>
              <button class="icon-button" type="button" title="Düzenle" @click="openForm(area, null)"><i class="pi pi-pencil" /></button>
              <button class="icon-button danger" type="button" title="Sil" @click="remove(area)"><i class="pi pi-trash" /></button>
            </span>
          </div>
          <ul v-if="area.children.length" class="child-list">
            <li v-for="child in area.children" :key="child.id" class="area-row child" :class="{ passive: !child.is_active }">
              <span class="area-main">
                <strong>{{ child.name }}</strong>
                <small><span class="kind">{{ child.type.name }}</span><template v-if="!child.is_active"> · pasif</template><template v-if="child.equipment_count || child.installation_count"> · {{ countText(child) }}</template></small>
              </span>
              <span v-if="canEdit" class="area-actions">
                <button class="icon-button" type="button" title="Düzenle" @click="openForm(child, area)"><i class="pi pi-pencil" /></button>
                <button class="icon-button danger" type="button" title="Sil" @click="remove(child)"><i class="pi pi-trash" /></button>
              </span>
            </li>
          </ul>
        </li>
      </ul>
      <p v-if="actionError" class="action-error">{{ actionError }}</p>
    </aside>

    <!-- Alan ekle / düzenle -->
    <div v-if="formOpen" class="modal-backdrop">
      <section class="modal-card">
        <div class="modal-head">
          <div>
            <h2>{{ editing ? 'Alanı Düzenle' : parent ? 'Alt Alan Ekle' : 'Alan Ekle' }}</h2>
            <p>{{ parent ? `${parent.name} içinde` : location.name }}</p>
          </div>
          <button class="close-button" type="button" :disabled="saving" @click="formOpen = false"><i class="pi pi-times" /></button>
        </div>
        <label>Alan Adı <span>*</span><input v-model="form.name" type="text" placeholder="Örn. Bilişim Depo, İdari Bina, Yemekhane" /></label>
        <label>Alan Türü <span>*</span>
          <select v-model="form.typeId" @change="onTypeChange">
            <option :value="null" disabled>Seçin</option>
            <option v-for="type in sortedTypes" :key="type.id" :value="type.id">{{ type.name }}</option>
            <option v-if="canEdit" :value="NEW_TYPE">+ Yeni tür ekle…</option>
          </select>
        </label>
        <!-- Yeni tür: yalnızca ad; hesabın listesine eklenir -->
        <div v-if="newTypeOpen" class="new-type">
          <input v-model="newType.name" type="text" placeholder="Tür adı (örn. Arşiv, Laboratuvar)" />
          <button class="secondary-button" type="button" :disabled="!newType.name.trim() || addingType" @click="addType">Ekle</button>
        </div>
        <label v-if="editing && !editing.children?.length" class="parent-select">Üst Alan
          <select v-model="form.parentId">
            <option :value="null">Yok (lokasyonun altında)</option>
            <option v-for="area in parentOptions" :key="area.id" :value="area.id">{{ area.name }}</option>
          </select>
        </label>
        <label v-if="editing" class="check-line"><input v-model="form.active" type="checkbox" /> Aktif</label>
        <p v-if="formError" class="form-error">{{ formError }}</p>
        <div class="modal-actions">
          <button class="secondary-button" type="button" :disabled="saving" @click="formOpen = false">İptal</button>
          <button class="primary-button" type="button" :disabled="!canSave || saving" @click="save">{{ saving ? 'Kaydediliyor...' : 'Kaydet' }}</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
// Lokasyonun alanları (Ayarlar → Lokasyonlar → Alanlar): yalnızca fiziksel yerler (bina, depo, kat, yemekhane…), firmasız;
// alt alan tek kat. Alan türü listesi çoğaltılabilir (hazır türler + hesabın ekledikleri). Düzenleme: OSGB / kurumsal
// hesapta yönetici, bireysel uzman hesabında uzman; diğerleri yalnızca görür.
interface AreaType { id: number; name: string; kind: 'operational' | 'common'; custom?: boolean }
interface Area {
  id: number; name: string; parent_id: number | null; type: AreaType
  is_active: boolean; equipment_count: number; installation_count: number; children: Area[]
}

const props = defineProps<{ location: { id: number; name: string }; customerName?: string | null }>()
const emit = defineEmits<{ close: []; changed: [] }>()

const { get, post, patch, del, errorMessage } = useExpertApi()
const { multiUser, isManager } = useAccount()
const canEdit = computed(() => !multiUser.value || isManager.value)

const NEW_TYPE = -1
const areas = ref<Area[]>([])
const types = ref<AreaType[]>([])
const loading = ref(true)
const error = ref('')
const actionError = ref('')

const sortedTypes = computed(() => [...types.value].sort((a, b) => a.name.localeCompare(b.name, 'tr')))
const countText = (area: Area) => [area.equipment_count && `${area.equipment_count} ekipman`, area.installation_count && `${area.installation_count} tesisat`].filter(Boolean).join(', ')

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const [data, list] = await Promise.all([get('/pk-areas', { location_id: props.location.id }), get<AreaType[]>('/pk-area-types')])
    areas.value = data.areas || []
    types.value = list || []
  } catch (e: any) {
    error.value = errorMessage(e, 'Alanlar alınamadı.')
  } finally { loading.value = false }
}

// --- Form ---
const formOpen = ref(false)
const editing = ref<Area | null>(null)
const parent = ref<Area | null>(null)
const form = reactive({ name: '', typeId: null as number | null, parentId: null as number | null, active: true })
const saving = ref(false)
const formError = ref('')
// Üst alan seçenekleri: lokasyonun üst düzey alanları (kendisi hariç).
const parentOptions = computed(() => areas.value.filter(area => area.id !== editing.value?.id))
const canSave = computed(() => !!form.name.trim() && !!form.typeId && form.typeId !== NEW_TYPE)

const openForm = (area: Area | null, parentArea: Area | null) => {
  editing.value = area
  parent.value = parentArea
  Object.assign(form, {
    name: area?.name || '',
    typeId: area?.type.id ?? null,
    parentId: area ? area.parent_id : parentArea?.id ?? null,
    active: area?.is_active ?? true
  })
  newTypeOpen.value = false
  formError.value = ''
  formOpen.value = true
}

// --- Yeni tür ---
const newTypeOpen = ref(false)
const newType = reactive({ name: '' })
const addingType = ref(false)
const onTypeChange = () => {
  if (form.typeId !== NEW_TYPE) { newTypeOpen.value = false; return }
  newType.name = ''
  newTypeOpen.value = true
}
const addType = async () => {
  addingType.value = true
  formError.value = ''
  try {
    const created = await post<AreaType>('/pk-area-types', { name: newType.name.trim(), kind: 'operational' })
    if (!types.value.some(type => type.id === created.id)) types.value = [...types.value, created]
    form.typeId = created.id
    newTypeOpen.value = false
  } catch (e: any) {
    formError.value = errorMessage(e, 'Tür eklenemedi.')
  } finally { addingType.value = false }
}

const save = async () => {
  if (!canSave.value) return
  saving.value = true
  formError.value = ''
  const body = {
    name: form.name.trim(),
    pk_area_type_id: form.typeId,
    parent_id: form.parentId,
    ...(editing.value ? { is_active: form.active } : { location_id: props.location.id })
  }
  try {
    const data = editing.value ? await patch(`/pk-areas/${editing.value.id}`, body) : await post('/pk-areas', body)
    areas.value = data.areas || []
    formOpen.value = false
    emit('changed')
  } catch (e: any) {
    formError.value = errorMessage(e, 'Alan kaydedilemedi.')
  } finally { saving.value = false }
}

const remove = async (area: Area) => {
  actionError.value = ''
  if (!confirm(`"${area.name}" alanı silinsin mi?`)) return
  try {
    const data = await del<any>(`/pk-areas/${area.id}`)
    areas.value = data.areas || []
    emit('changed')
  } catch (e: any) {
    actionError.value = errorMessage(e, 'Alan silinemedi.')
  }
}

onMounted(load)
</script>

<style scoped>
.drawer-backdrop{position:fixed;inset:0;z-index:100;background:var(--admin-overlay)}
.area-drawer{position:absolute;top:0;right:0;width:min(520px,94vw);height:100%;background:var(--admin-input);box-shadow:-12px 0 30px var(--admin-shadow);display:flex;flex-direction:column}
.drawer-head{padding:26px 20px 18px;border-bottom:1px solid var(--admin-border);display:flex;justify-content:space-between;gap:15px}.drawer-head h2{margin:0 0 18px;font-size:18px;color:var(--admin-heading)}
.drawer-subtitle{display:flex;align-items:center;gap:11px}.drawer-subtitle>i{font-size:20px;color:var(--admin-text)}.drawer-subtitle div{display:flex;flex-direction:column;gap:3px}.drawer-subtitle strong{font-size:13px;color:var(--admin-heading)}.drawer-subtitle span{font-size:11px;color:var(--admin-muted)}
.intro{display:flex;gap:7px;margin:14px 20px 0;color:var(--admin-muted);font-size:11px;line-height:1.5}.intro i{margin-top:2px}
.drawer-toolbar{padding:12px 20px 10px;display:flex;justify-content:flex-end}.drawer-state{padding:50px 25px;text-align:center;color:var(--admin-muted);font-size:12px}.error-state{color:var(--admin-danger-text)}
.area-list{list-style:none;margin:0;padding:4px 18px 24px;overflow:auto;display:grid;gap:10px}
.area-item{padding:10px 12px;border:1px solid var(--admin-border);border-radius:10px}
.area-row{display:flex;justify-content:space-between;align-items:center;gap:10px}
.area-main{display:flex;flex-direction:column;gap:3px;min-width:0}.area-main strong{color:var(--admin-heading);font-size:13px}.area-main small{color:var(--admin-muted);font-size:11px}
.kind{padding:1px 7px;border-radius:999px;font-weight:700;background:var(--admin-chip);color:var(--admin-text)}
.passive{opacity:.6}
.area-actions{display:flex;gap:5px;flex-shrink:0}
.child-list{list-style:none;margin:8px 0 0;padding:0 0 0 16px;display:grid;gap:6px;border-left:2px solid var(--admin-border)}
.area-row.child{padding:6px 0 0 10px}
.icon-button{width:30px;height:30px;display:grid;place-items:center;border:1px solid var(--admin-border);border-radius:7px;background:var(--admin-input);color:var(--admin-muted);cursor:pointer}.icon-button:hover{border-color:#d7a900;background:var(--admin-accent-soft);color:var(--admin-heading)}
.icon-button.danger:hover{border-color:#fda29b;background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.action-error{margin:0 20px 16px;color:var(--admin-danger-text);font-size:12px}
.close-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:var(--admin-muted);cursor:pointer;border-radius:7px}.close-button:hover{background:var(--admin-hover);color:var(--admin-heading)}
.modal-backdrop{position:fixed;inset:0;z-index:110;background:var(--admin-overlay);display:grid;place-items:center;padding:20px}
.modal-card{width:min(480px,100%);padding:22px;background:var(--admin-input);border-radius:12px;box-shadow:0 20px 60px var(--admin-shadow)}
.modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:20px}.modal-head h2{margin:0;color:var(--admin-heading);font-size:18px}.modal-head p{margin:5px 0 0;color:var(--admin-muted);font-size:12px}
.modal-card label{display:block;margin-bottom:14px;color:var(--admin-heading);font-size:12px;font-weight:700}.modal-card label span{color:var(--admin-danger-text)}
.modal-card input,.modal-card select{width:100%;height:42px;margin-top:7px;padding:0 12px;border:1px solid var(--admin-border);border-radius:8px;outline:0;background:var(--admin-input);font:inherit;font-size:13px;color:var(--admin-heading)}
.modal-card input:focus,.modal-card select:focus{border-color:#d7a900;box-shadow:0 0 0 3px rgba(255,193,7,.12)}
.new-type{display:grid;grid-template-columns:1fr auto;gap:8px;margin:-6px 0 14px}.new-type input,.new-type select{margin-top:0}
.check-line{display:flex !important;align-items:center;gap:8px}.check-line input{width:auto;height:auto;margin:0}
.hint{margin:-6px 0 14px;font-size:12px}.hint.warn{color:var(--admin-warning-text)}
.form-error{margin:0 0 8px;color:var(--admin-danger-text);font-size:12px}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 17px;border:0;border-radius:8px;background:var(--pk-yellow);color:#111827;font-size:13px;font-weight:800;cursor:pointer}.primary-button:disabled{opacity:.55;cursor:not-allowed}.primary-button.small{min-height:36px;padding:0 13px;font-size:12px}
.secondary-button{min-height:40px;padding:0 16px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-hover);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}.secondary-button:disabled{opacity:.55;cursor:not-allowed}
</style>
