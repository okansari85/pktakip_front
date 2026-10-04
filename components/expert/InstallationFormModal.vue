<template>
  <div class="modal-backdrop">
    <section class="modal-card">
      <div class="modal-head">
        <div>
          <h2>{{ installation ? 'Tesisatı Düzenle' : 'Tesisat Ekle' }}</h2>
          <p>{{ [type.name, locationName].filter(Boolean).join(' · ') }}</p>
        </div>
        <button class="close-button" type="button" @click="close"><i class="pi pi-times" /></button>
      </div>

      <div class="form-grid">
        <label v-if="!installation">Ait olduğu yer <span>*</span>
          <select v-model="form.location_business_entity_id">
            <option :value="null">Lokasyon geneli</option>
            <option v-for="workplace in workplaces" :key="workplace.id" :value="workplace.id">{{ workplace.company_name }}</option>
          </select>
        </label>
        <!-- Lokasyonda alan tanımlıysa: tesisat yine lokasyon geneli; bina / alan bazında kayıtsa alan seçilir -->
        <label v-if="areas.length">Alan / bina <small>(Opsiyonel)</small>
          <select v-model="form.pk_area_id">
            <option :value="null">Lokasyon geneli</option>
            <option v-for="area in areas" :key="area.id" :value="area.id">{{ area.label }}</option>
          </select>
        </label>
        <label :class="{ wide: !!installation && !areas.length }">Ad <small>(Opsiyonel)</small><input v-model="form.name" type="text" :placeholder="type.name" />
          <!-- Elektrik ailesi: rapor bina bazında geliyorsa her bina ayrı kayıt; adı bina adı (rapor yüklerken eşleştirilir) -->
          <small v-if="['elektrik-ic-tesisati', 'topraklama', 'yangin-algilama', 'havalandirma-klima', 'paratoner', 'akumulator'].includes(type.slug)" class="field-hint">Bina bazında rapor geliyorsa bina adı (ör. Tesellüm Depo)</small>
          <small v-else-if="type.slug === 'trafo'" class="field-hint">Birden fazla trafo merkezi varsa merkezin adı (ör. TM-2)</small>
        </label>
      </div>

      <!-- Sistemler: yalnızca bu tesisat türünün katalogundan -->
      <div class="systems">
        <div class="systems-head">
          <strong>Tesisattaki sistemler</strong>
          <small>{{ selected.length }} seçili</small>
        </div>
        <p class="hint">Tesisatta bulunan sistemleri işaretleyin. Kontrol raporunda geçip burada olmayan sistem, kontrol kaydedilince eklenir.</p>
        <div class="system-grid">
          <label v-for="system in options" :key="system.id" class="system-option" :class="{ checked: selected.includes(system.id), locked: locked.includes(system.id) }">
            <input v-model="selected" type="checkbox" :value="system.id" :disabled="locked.includes(system.id)" />
            <span>
              <strong>{{ system.name }}</strong>
              <small v-if="locked.includes(system.id)">Kontrol kayıtlarında geçiyor, çıkarılamaz</small>
              <small v-else-if="system.equipment_types?.length">Ekipmanları: {{ system.equipment_types.map((type: any) => type.name).join(', ') }}</small>
              <small v-else-if="system.card">Genel bilgilerde kart olarak görünür</small>
            </span>
          </label>
        </div>
      </div>

      <label class="notes">Not <small>(Opsiyonel)</small><textarea v-model="form.notes" rows="2" placeholder="Tesisatla ilgili not" /></label>

      <p v-if="error" class="error-text">{{ error }}</p>
      <div class="modal-actions">
        <button v-if="installation" class="danger-link" type="button" :disabled="saving" @click="remove"><i class="pi pi-trash" /> Tesisatı sil</button>
        <button class="secondary-button" type="button" :disabled="saving" @click="close">İptal</button>
        <button class="primary-button" type="button" :disabled="saving" @click="save">{{ saving ? 'Kaydediliyor...' : 'Kaydet' }}</button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// Tesisat ekleme / düzenleme: rapor istemez. Sistemler tesisat türünün katalogundan seçilir (ekipman kategorisi → tür gibi).
const props = defineProps<{ type: any; context: any; workplaces: { id: number; company_name: string }[]; installation?: any }>()
const emit = defineEmits<{ close: []; saved: [installation: any]; deleted: [] }>()

const { post, patch, del, errorMessage } = useExpertApi()

const saving = ref(false)
const error = ref('')
const form = reactive({
  name: props.installation?.name && props.installation.name !== props.type.name ? props.installation.name : '',
  notes: props.installation?.notes || '',
  location_business_entity_id: null as number | null,
  pk_area_id: null as number | null
})

// Alanlar (isteğe bağlı): lokasyonda alan yoksa kutu görünmez, tesisat bugünkü gibi kaydedilir.
const { options: areaOptions, assignments: areaAssignments, load: loadAreas, setInstallationArea } = useLocationAreas()
const currentAreaId = computed<number | null>(() => props.installation ? areaAssignments.value.installations[String(props.installation.id)] ?? null : null)
const areas = computed(() => areaOptions.value.filter(area => area.active || area.id === currentAreaId.value))
onMounted(async () => {
  await loadAreas(props.installation?.location?.id ?? props.context?.location_id, !!props.installation)
  form.pk_area_id = currentAreaId.value
})
const current = computed<any[]>(() => (props.installation?.systems || []).filter((system: any) => system.system_id))
const selected = ref<number[]>(current.value.map(system => system.system_id))
// Kontrol kaydında geçen sistem çıkarılamaz (geçmişteki sonucu silinirdi).
const locked = computed(() => current.value.filter(system => system.has_results).map(system => system.system_id))
// Katalog + tesisatta olup katalogdan kalkmış sistemler (görünmez olup sessizce silinmesinler).
const options = computed(() => [
  ...props.type.systems,
  ...current.value.filter(system => !props.type.systems.some((option: any) => option.id === system.system_id))
    .map(system => ({ id: system.system_id, name: system.name, card: system.card }))
])
const locationName = computed(() => props.installation?.location?.name || props.context?.location_name || '')

const close = () => { if (!saving.value) emit('close') }

const save = async () => {
  saving.value = true
  error.value = ''
  const body = { name: form.name.trim() || null, notes: form.notes.trim() || null, system_ids: selected.value }
  try {
    const saved = props.installation
      ? await patch(`/pk-installations/${props.installation.id}`, body)
      : await post('/pk-installations', {
        ...body,
        installation_type_id: props.type.id,
        location_id: props.context.location_id,
        location_business_entity_id: form.location_business_entity_id
      })
    // Alan değiştiyse ayrıca yazılır (yalnızca lokasyonda alan varsa).
    const installationId = saved?.id ?? saved?.installation?.id ?? props.installation?.id
    if (areaOptions.value.length && installationId && form.pk_area_id !== currentAreaId.value) await setInstallationArea(installationId, form.pk_area_id)
    emit('saved', saved)
  } catch (e: any) {
    error.value = errorMessage(e, 'Tesisat kaydedilemedi.')
  } finally { saving.value = false }
}

const remove = async () => {
  if (!props.installation || !confirm(`${props.installation.name} tüm kontrol kayıtları ve raporlarıyla birlikte silinsin mi? Ekipmanlar menüsündeki ekipmanlar silinmez; bu raporlardan ekipmanlara yazılan kontrol kayıtları silinir.`)) return
  saving.value = true
  error.value = ''
  try {
    await del(`/pk-installations/${props.installation.id}`)
    emit('deleted')
  } catch (e: any) {
    error.value = errorMessage(e, 'Tesisat silinemedi.')
  } finally { saving.value = false }
}
</script>

<style scoped>
.modal-backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:var(--admin-overlay)}
.modal-card{width:min(720px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:22px;background:var(--admin-card);border-radius:12px;box-shadow:0 20px 60px var(--admin-shadow)}
.modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:18px}
h2{margin:0;color:var(--admin-heading);font-size:18px}.modal-head p{margin:5px 0 0;color:var(--admin-muted);font-size:12px}
.close-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:var(--admin-muted);cursor:pointer;border-radius:7px}.close-button:hover{background:var(--admin-hover);color:var(--admin-heading)}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px}
.form-grid label,.notes{display:block;color:var(--admin-heading);font-size:12px;font-weight:700}.wide{grid-column:1 / -1}
label > span{color:var(--admin-danger-text)}label small{font-weight:400;color:var(--admin-muted)}
label small.field-hint{display:block;font-size:11px}
.form-grid input,.form-grid select,.notes textarea{display:block;width:100%;height:40px;margin-top:6px;padding:0 10px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:13px;outline:0}
.notes{margin-top:16px}.notes textarea{height:auto;padding:9px 10px;resize:vertical}
.form-grid input:focus,.form-grid select:focus,.notes textarea:focus{border-color:#d7a900;box-shadow:0 0 0 3px rgba(255,193,7,.12)}
.systems{margin-top:18px}
.systems-head{display:flex;align-items:baseline;justify-content:space-between;color:var(--admin-heading);font-size:13px}.systems-head small{color:var(--admin-muted);font-size:12px}
.hint{margin:6px 0 10px;color:var(--admin-muted);font-size:12px}
.system-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.system-option{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid var(--admin-border);border-radius:10px;cursor:pointer}
.system-option:hover{border-color:#d7a900}.system-option.checked{border-color:#d7a900;background:var(--admin-accent-soft)}.system-option.locked{cursor:default}
.system-option input{width:16px;height:16px;margin-top:1px;accent-color:#d7a900;flex-shrink:0}
.system-option span{display:flex;flex-direction:column;gap:3px;min-width:0}.system-option strong{color:var(--admin-heading);font-size:12px}.system-option small{color:var(--admin-muted);font-size:11px;font-weight:400}
.error-text{margin:12px 0 0;color:var(--admin-danger-text);font-size:12px}
.modal-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:20px}
.danger-link{display:inline-flex;align-items:center;gap:6px;margin-right:auto;border:0;background:none;color:var(--admin-danger-text);font:inherit;font-size:12px;font-weight:700;cursor:pointer}.danger-link:disabled{opacity:.5}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 17px;border:0;border-radius:8px;background:var(--pk-yellow);color:#111827;font-size:13px;font-weight:800;cursor:pointer}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.secondary-button{min-height:40px;padding:0 18px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-hover);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}
@media(max-width:640px){.form-grid,.system-grid{grid-template-columns:1fr}}
</style>
