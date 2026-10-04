<template>
  <div class="modal-backdrop">
    <section class="modal-card">
      <div class="modal-head">
        <div><h2>Rapor Bekleniyor</h2><p>{{ installation.name }}</p></div>
        <button class="close-button" type="button" @click="close"><i class="pi pi-times" /></button>
      </div>
      <p class="hint">Firma kontrolü yaptı, rapor henüz gelmedi. Tesisatın durumu "Rapor bekleniyor" olur; sistemlerin ve ekipmanların sonuçları önceki kontrolde kalır. Rapor gelince "Kontrol Ekle" ile yükleyin.</p>
      <div class="form-grid">
        <label>Kontrol tarihi <span>*</span><input v-model="form.control_date" type="date" /></label>
        <label>Kontrolü yapan kuruluş <small>(Opsiyonel)</small><input v-model="form.inspection_body" type="text" placeholder="Periyodik kontrolü yapan firma" /></label>
        <label class="wide">Not <small>(Opsiyonel)</small><textarea v-model="form.notes" rows="2" /></label>
      </div>
      <p v-if="error" class="error-text">{{ error }}</p>
      <div class="modal-actions">
        <button class="secondary-button" type="button" @click="close">İptal</button>
        <button class="primary-button" type="button" :disabled="saving || !form.control_date" @click="save">{{ saving ? 'Kaydediliyor...' : 'Kaydet' }}</button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// Tesisatı "rapor bekleniyor" olarak işaretler (dosyasız); tesisata bağlı ekipmanlara ayrı kayıt açılmaz.
const props = defineProps<{ installation: { id: number; name: string; inspection_body?: string | null } }>()
const emit = defineEmits<{ close: []; saved: [installation: any] }>()

const { post, errorMessage } = useExpertApi()

const form = reactive({ control_date: new Date().toISOString().slice(0, 10), inspection_body: props.installation.inspection_body || '', notes: '' })
const saving = ref(false)
const error = ref('')

const close = () => { if (!saving.value) emit('close') }

const save = async () => {
  saving.value = true
  error.value = ''
  try {
    emit('saved', await post(`/pk-installations/${props.installation.id}/pending`, {
      control_date: form.control_date,
      inspection_body: form.inspection_body.trim() || null,
      notes: form.notes.trim() || null
    }))
  } catch (e: any) {
    error.value = errorMessage(e, 'Kaydedilemedi.')
  } finally { saving.value = false }
}
</script>

<style scoped>
.modal-backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:var(--admin-overlay)}
.modal-card{width:min(500px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:22px;background:var(--admin-card);border-radius:12px;box-shadow:0 20px 60px var(--admin-shadow)}
.modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:12px}
h2{margin:0;color:var(--admin-heading);font-size:18px}.modal-head p{margin:5px 0 0;color:var(--admin-muted);font-size:12px}
.close-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:var(--admin-muted);cursor:pointer;border-radius:7px}.close-button:hover{background:var(--admin-hover);color:var(--admin-heading)}
.hint{margin:0 0 14px;padding:10px 12px;border-radius:9px;background:var(--admin-warning-bg);color:var(--admin-warning-text);font-size:12px;line-height:1.5}
.form-grid{display:grid;grid-template-columns:1fr;gap:10px}
.form-grid label{display:block;color:var(--admin-heading);font-size:12px;font-weight:700}.form-grid label small{font-weight:400;color:var(--admin-muted)}.form-grid label > span{color:var(--admin-danger-text)}
.form-grid input,.form-grid textarea{display:block;width:100%;margin-top:6px;padding:0 10px;height:40px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:13px;outline:0}
.form-grid textarea{height:auto;padding:9px 10px;resize:vertical}
.form-grid input:focus,.form-grid textarea:focus{border-color:#d7a900;box-shadow:0 0 0 3px rgba(255,193,7,.12)}
.error-text{margin:10px 0 0;color:var(--admin-danger-text);font-size:12px}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 17px;border:0;border-radius:8px;background:var(--pk-yellow);color:#111827;font-size:13px;font-weight:800;cursor:pointer}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.secondary-button{min-height:40px;padding:0 18px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-hover);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}
</style>
