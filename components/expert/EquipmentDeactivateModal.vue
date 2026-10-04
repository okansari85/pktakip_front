<template>
  <div class="modal-backdrop">
    <section class="modal-card">
      <div class="modal-head">
        <div><h2>Pasife Al</h2><p>{{ title }}</p></div>
        <button class="close-button" type="button" @click="close"><i class="pi pi-times" /></button>
      </div>
      <p class="hint">Ekipman silinmez; kontrol geçmişi ve raporları kalır. Pasif ekipmana kontrol eklenmez, kalan gün hesabına ve tesisat listesine girmez. İstediğiniz zaman aktife alabilirsiniz.</p>
      <div class="form-grid">
        <label>Neden <span>*</span>
          <select v-model="form.reason">
            <option value="">Seçin</option>
            <option v-for="(label, key) in reasons" :key="key" :value="key">{{ label }}</option>
          </select>
        </label>
        <label>Tarih<input v-model="form.deactivated_at" type="date" /></label>
        <label class="wide">Not <small>(Opsiyonel)</small><textarea v-model="form.note" rows="2" /></label>
      </div>
      <p v-if="error" class="error-text">{{ error }}</p>
      <div class="modal-actions">
        <button class="secondary-button" type="button" @click="close">İptal</button>
        <button class="primary-button" type="button" :disabled="saving || !form.reason" @click="save">{{ saving ? 'Kaydediliyor...' : 'Pasife al' }}</button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// Ekipmanı (tek ya da toplu) pasife alır: neden, tarih (varsayılan bugün), not.
const props = defineProps<{ ids: number[]; title: string }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { post, errorMessage } = useExpertApi()
const reasons = DEACTIVATION_REASONS

const form = reactive({ reason: '', deactivated_at: new Date().toISOString().slice(0, 10), note: '' })
const saving = ref(false)
const error = ref('')

const close = () => { if (!saving.value) emit('close') }

const save = async () => {
  saving.value = true
  error.value = ''
  try {
    await post('/pk-equipment/bulk-deactivate', {
      ids: props.ids,
      reason: form.reason,
      deactivated_at: form.deactivated_at || null,
      note: form.note.trim() || null
    })
    emit('saved')
  } catch (e: any) {
    error.value = errorMessage(e, 'Pasife alınamadı.')
  } finally { saving.value = false }
}
</script>

<style scoped>
.modal-backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:var(--admin-overlay)}
.modal-card{width:min(500px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:22px;background:var(--admin-card);border-radius:12px;box-shadow:0 20px 60px var(--admin-shadow)}
.modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:12px}
h2{margin:0;color:var(--admin-heading);font-size:18px}.modal-head p{margin:5px 0 0;color:var(--admin-muted);font-size:12px}
.close-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:var(--admin-muted);cursor:pointer;border-radius:7px}.close-button:hover{background:var(--admin-hover);color:var(--admin-heading)}
.hint{margin:0 0 14px;padding:10px 12px;border-radius:9px;background:var(--admin-soft);color:var(--admin-text);font-size:12px;line-height:1.5}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.wide{grid-column:1 / -1}
.form-grid label{display:block;color:var(--admin-heading);font-size:12px;font-weight:700}.form-grid label small{font-weight:400;color:var(--admin-muted)}.form-grid label > span{color:var(--admin-danger-text)}
.form-grid input,.form-grid select,.form-grid textarea{display:block;width:100%;margin-top:6px;padding:0 10px;height:40px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:13px;outline:0}
.form-grid textarea{height:auto;padding:9px 10px;resize:vertical}
.form-grid input:focus,.form-grid select:focus,.form-grid textarea:focus{border-color:#d7a900;box-shadow:0 0 0 3px rgba(255,193,7,.12)}
.error-text{margin:10px 0 0;color:var(--admin-danger-text);font-size:12px}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 17px;border:0;border-radius:8px;background:var(--pk-yellow);color:#111827;font-size:13px;font-weight:800;cursor:pointer}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.secondary-button{min-height:40px;padding:0 18px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-hover);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}
@media(max-width:520px){.form-grid{grid-template-columns:1fr}}
</style>
