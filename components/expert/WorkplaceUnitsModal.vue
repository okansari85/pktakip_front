<template>
  <div class="modal-backdrop">
    <section class="modal-card">
      <div class="modal-head">
        <div><h2>Birimler</h2><p>{{ workplace.name }} · {{ location.name }}</p></div>
        <button class="close-button" type="button" :disabled="saving" @click="emit('close')"><i class="pi pi-times" /></button>
      </div>
      <p class="hint">Aynı işyerinde ayrı yönetilen birimler (ör. Müşteri Hizmetleri). Ekipman firmaya ait kalır; ekipman eklerken birimi de seçebilirsiniz.</p>

      <div v-if="loading" class="state">Birimler yükleniyor...</div>
      <template v-else>
        <ul v-if="mine.length" class="unit-list">
          <li v-for="unit in mine" :key="unit.id" class="unit" :class="{ passive: !unit.is_active }">
            <div class="unit-main">
              <strong>{{ unit.name }}</strong>
              <small>{{ [unit.manager && `Sorumlu: ${unit.manager}`, unit.areas.length ? unit.areas.map(area => area.name).join(', ') : 'alan seçilmedi', unit.equipment_count && `${unit.equipment_count} ekipman`, !unit.is_active && 'pasif'].filter(Boolean).join(' · ') }}</small>
            </div>
            <span v-if="canEdit" class="unit-actions">
              <button class="icon-button" type="button" title="Düzenle" @click="openForm(unit)"><i class="pi pi-pencil" /></button>
              <button class="icon-button danger" type="button" title="Sil" @click="removeUnit(unit)"><i class="pi pi-trash" /></button>
            </span>
          </li>
        </ul>
        <p v-else-if="!formOpen" class="state">Bu işyerinde birim yok.</p>

        <!-- Birim ekle / düzenle: ad, sorumlu (opsiyonel), kullandığı alanlar (opsiyonel) -->
        <div v-if="formOpen" class="unit-form">
          <label>Birim adı <span>*</span><input v-model="form.name" type="text" placeholder="Örn. Müşteri Hizmetleri" /></label>
          <label>Sorumlu <small>(Opsiyonel)</small><input v-model="form.manager" type="text" placeholder="Birim müdürü / sorumlusu" /></label>
          <div class="areas-field">
            <span>Kullandığı alanlar <small>(Opsiyonel)</small></span>
            <ExpertAreaChecklist v-if="areaOptions.length" v-model="form.areaIds" :areas="areaOptions" :disabled="saving" />
            <small v-else class="muted">Lokasyonda alan tanımlı değil (lokasyonun "Alanlar" panelinden eklenir).</small>
          </div>
          <label v-if="form.id" class="check-line"><input v-model="form.active" type="checkbox" /> Aktif</label>
          <div class="form-actions">
            <button class="secondary-button" type="button" :disabled="saving" @click="formOpen = false">Vazgeç</button>
            <button class="primary-button" type="button" :disabled="saving || !form.name.trim()" @click="saveUnit">{{ saving ? 'Kaydediliyor...' : 'Kaydet' }}</button>
          </div>
        </div>
        <button v-else-if="canEdit" class="add-button" type="button" @click="openForm(null)"><i class="pi pi-plus" /> Birim ekle</button>
      </template>

      <p v-if="error" class="form-error">{{ error }}</p>
      <div class="modal-actions">
        <button class="secondary-button" type="button" :disabled="saving" @click="emit('close')">Kapat</button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// Bir işyerinin (firmanın lokasyondaki kaydı) operasyonel birimleri (Ayarlar → Lokasyonlar → Firmalar → "Birimler").
// Düzenleme: OSGB / kurumsal hesapta yönetici, bireysel uzman hesabında uzman; diğerleri yalnızca görür.
const props = defineProps<{ location: { id: number; name: string }; workplace: { id: number; name: string } }>()
const emit = defineEmits<{ close: []; changed: [] }>()

const { errorMessage } = useExpertApi()
const { units, load, save, remove } = useOperationalUnits()
const { options: areaOptions, load: loadAreas } = useLocationAreas()
const { multiUser, isManager } = useAccount()
const canEdit = computed(() => !multiUser.value || isManager.value)

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const mine = computed(() => units.value.filter(unit => unit.workplace_id === props.workplace.id))

const formOpen = ref(false)
const form = reactive({ id: null as number | null, name: '', manager: '', areaIds: [] as number[], active: true })
const openForm = (unit: OperationalUnit | null) => {
  Object.assign(form, { id: unit?.id ?? null, name: unit?.name || '', manager: unit?.manager || '', areaIds: unit?.areas.map(area => area.id) || [], active: unit?.is_active ?? true })
  error.value = ''
  formOpen.value = true
}

const saveUnit = async () => {
  saving.value = true
  error.value = ''
  const body = {
    name: form.name.trim(), manager: form.manager.trim() || null, area_ids: form.areaIds,
    ...(form.id ? { is_active: form.active } : { location_business_entity_id: props.workplace.id })
  }
  try {
    const data = await save(body, form.id)
    units.value = data.units || []
    formOpen.value = false
    emit('changed')
  } catch (e: any) {
    error.value = errorMessage(e, 'Birim kaydedilemedi.')
  } finally { saving.value = false }
}

const removeUnit = async (unit: OperationalUnit) => {
  if (!confirm(`"${unit.name}" birimi silinsin mi?`)) return
  error.value = ''
  try {
    const data = await remove(unit.id)
    units.value = data.units || []
    emit('changed')
  } catch (e: any) {
    error.value = errorMessage(e, 'Birim silinemedi.')
  }
}

onMounted(async () => {
  await Promise.all([load(props.location.id), loadAreas(props.location.id)])
  loading.value = false
})
</script>

<style scoped>
.modal-backdrop{position:fixed;inset:0;z-index:120;background:var(--admin-overlay);display:grid;place-items:center;padding:20px}
.modal-card{width:min(560px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:22px;background:var(--admin-input);border-radius:12px;box-shadow:0 20px 60px var(--admin-shadow)}
.modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:10px}.modal-head h2{margin:0;color:var(--admin-heading);font-size:18px}.modal-head p{margin:5px 0 0;color:var(--admin-muted);font-size:12px}
.close-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:var(--admin-muted);cursor:pointer;border-radius:7px}.close-button:hover{background:var(--admin-hover);color:var(--admin-heading)}
.hint{margin:0 0 14px;color:var(--admin-muted);font-size:12px;line-height:1.5}
.state{padding:18px 6px;color:var(--admin-muted);font-size:12px;text-align:center}
.unit-list{list-style:none;margin:0 0 12px;padding:0;display:grid;gap:8px}
.unit{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid var(--admin-border);border-radius:10px}.unit.passive{opacity:.6}
.unit-main{display:flex;flex-direction:column;gap:3px;min-width:0}.unit-main strong{color:var(--admin-heading);font-size:13px}.unit-main small{color:var(--admin-muted);font-size:11px}
.unit-actions{display:flex;gap:5px;flex-shrink:0}
.icon-button{width:30px;height:30px;display:grid;place-items:center;border:1px solid var(--admin-border);border-radius:7px;background:var(--admin-input);color:var(--admin-muted);cursor:pointer}.icon-button:hover{border-color:#d7a900;background:var(--admin-accent-soft);color:var(--admin-heading)}
.icon-button.danger:hover{border-color:#fda29b;background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.unit-form{padding:14px;border:1px dashed #d7a900;border-radius:10px;background:var(--admin-accent-soft)}
.unit-form label{display:block;margin-bottom:12px;color:var(--admin-heading);font-size:12px;font-weight:700}.unit-form label span{color:var(--admin-danger-text)}.unit-form label small{font-weight:400;color:var(--admin-muted)}
.unit-form input[type=text]{width:100%;height:40px;margin-top:6px;padding:0 12px;border:1px solid var(--admin-border);border-radius:8px;outline:0;background:var(--admin-input);font:inherit;font-size:13px;color:var(--admin-heading)}
.areas-field{margin-bottom:12px}.areas-field > span{display:block;margin-bottom:8px;color:var(--admin-heading);font-size:12px;font-weight:700}.areas-field > span small{font-weight:400;color:var(--admin-muted)}
.muted{color:var(--admin-muted);font-size:11px}
.check-line{display:flex !important;align-items:center;gap:8px}.check-line input{width:auto;height:auto;margin:0}
.form-actions{display:flex;justify-content:flex-end;gap:8px}
.add-button{display:inline-flex;align-items:center;gap:6px;padding:0;border:0;background:none;color:var(--admin-link);font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.form-error{margin:12px 0 0;color:var(--admin-danger-text);font-size:12px}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:38px;padding:0 16px;border:0;border-radius:8px;background:var(--pk-yellow);color:#111827;font-size:13px;font-weight:800;cursor:pointer}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.secondary-button{min-height:38px;padding:0 16px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-hover);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}
</style>
