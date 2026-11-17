<template>
  <div class="modal-backdrop">
    <section class="modal-card">
      <div class="modal-head">
        <div><h2>Rapor Bekleniyor</h2><p>{{ equipment.name || equipment.type?.name }}<template v-if="equipment.code"> · Ekipman no {{ equipment.code }}</template></p></div>
        <button class="close-button" type="button" @click="close"><PkIcon class="pi pi-times" /></button>
      </div>
      <p class="hint">Firma kontrolü yaptı, rapor sonucu henüz gelmedi. Rapor gelince "Yeni Periyodik Kontrol Raporu Yükle" ile sonucu girin.</p>
      <div class="form-grid">
        <label>Kontrol tarihi <span>*</span><input v-model="form.control_date" type="date" /></label>
        <label>Kontrolü yapan kuruluş <small>(Opsiyonel)</small><input v-model="form.inspection_body" type="text" placeholder="Periyodik kontrolü yapan firma" /></label>
        <label class="wide">Not <small>(Opsiyonel)</small><textarea v-model="form.note" rows="2" /></label>
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
// Ekipmanı "rapor bekleniyor" olarak işaretler (dosyasız); sonuç rapor gelince yüklenir.
const props = defineProps<{ equipment: { id: number; name?: string | null; code?: string | null; type?: { name: string } | null } }>()
const emit = defineEmits<{ close: []; saved: [equipment: any] }>()

const { post, errorMessage } = useExpertApi()

const form = reactive({ control_date: new Date().toISOString().slice(0, 10), inspection_body: '', note: '' })
const saving = ref(false)
const error = ref('')

const close = () => { if (!saving.value) emit('close') }

const save = async () => {
  saving.value = true
  error.value = ''
  try {
    emit('saved', await post(`/pk-equipment/${props.equipment.id}/inspections`, {
      status: 'rapor_bekleniyor',
      control_date: form.control_date,
      inspection_body: form.inspection_body.trim() || null,
      note: form.note.trim() || null
    }))
  } catch (e: any) {
    error.value = errorMessage(e, 'Kaydedilemedi.')
  } finally { saving.value = false }
}
</script>

<style scoped>
.modal-backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:var(--admin-overlay)}
.modal-card{width:min(500px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:24px;background:var(--admin-card);border:0;border-radius:var(--pk-radius);box-shadow:0 24px 48px -8px var(--admin-shadow)}
.modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:12px}
h2{margin:0;color:var(--admin-heading);font-size:18px;font-weight:700}.modal-head p{margin:5px 0 0;color:var(--admin-muted);font-size:12px}
.close-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:var(--admin-muted);cursor:pointer;border-radius:7px}.close-button:hover{background:var(--admin-hover);color:var(--admin-heading)}
.hint{margin:0 0 14px;padding:10px 12px;border-radius:9px;background:var(--admin-warning-bg);color:var(--admin-warning-text);font-size:12px}
.form-grid{display:grid;grid-template-columns:1fr;gap:10px}
.form-grid label{display:block;color:var(--admin-heading);font-size:12px;font-weight:700}.form-grid label small{font-weight:400;color:var(--admin-muted)}.form-grid label > span{color:var(--admin-danger-text)}
.form-grid input,.form-grid textarea{display:block;width:100%;margin-top:6px;padding:0 10px;height:40px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:13px;outline:0}
.form-grid textarea{height:auto;padding:9px 10px;resize:vertical}
.form-grid input:focus,.form-grid textarea:focus{border-color:var(--pk-accent);box-shadow:0 0 0 3px var(--pk-focus-ring)}
.error-text{margin:10px 0 0;color:var(--admin-danger-text);font-size:12px}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 17px;border:0;border-radius:8px;background:var(--pk-accent);color:var(--pk-on-accent);font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 8px 16px rgba(var(--pk-accent-rgb),.24)}.primary-button:hover:not(:disabled){background:var(--pk-accent-hover)}.primary-button:disabled{opacity:.55;cursor:not-allowed;box-shadow:none}
.secondary-button{min-height:40px;padding:0 18px;border:1px solid rgba(145,158,171,.32);border-radius:8px;background:transparent;color:var(--admin-heading);font-size:13px;font-weight:700;cursor:pointer}.secondary-button:hover{background:rgba(145,158,171,.08)}
</style>
