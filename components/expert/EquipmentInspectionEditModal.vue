<template>
  <div class="modal-backdrop">
    <section class="modal-card">
      <div class="modal-head">
        <div><h2>Kontrol Kaydını Düzenle</h2><p>{{ equipment.name || equipment.type?.name }}<template v-if="equipment.code"> · Ekipman no {{ equipment.code }}</template></p></div>
        <button class="close-button" type="button" @click="close"><i class="pi pi-times" /></button>
      </div>
      <p v-if="pending" class="hint">Rapor bekleniyor kaydı. Sonuç, rapor gelince "Yeni Periyodik Kontrol Raporu Yükle" ile girilir.</p>
      <p v-else class="hint">Rapor dosyası<template v-if="inspection.analysis"> ve yapay zeka analizi</template> değişmez. Yanlış rapor yüklendiyse kaydı silip yeniden yükleyin.</p>

      <div class="form-grid">
        <label v-if="!pending">Durum <span>*</span>
          <select v-model="form.status">
            <option value="uygun">Uygun</option>
            <option value="uygun_degil">Uygun değil</option>
            <!-- Raporda uygunluğu yazmayan kayıt (tesisat raporundan): düzenlemede korunur -->
            <option v-if="props.inspection.status === 'belirtilmemis'" value="belirtilmemis">Belirtilmemiş</option>
          </select>
        </label>
        <label>Kontrol tarihi <span>*</span><input v-model="form.control_date" type="date" /></label>
        <label v-if="!pending">Gelecek kontrol<input v-model="form.next_control_date" type="date" /></label>
        <label v-if="!pending">Rapor no<input v-model="form.report_no" type="text" placeholder="Raporda yazan numara" /></label>
        <label :class="{ wide: pending }">Kontrolü yapan kuruluş<input v-model="form.inspection_body" type="text" placeholder="Periyodik kontrolü yapan firma" /></label>
        <label v-if="pending" class="wide">Not<textarea v-model="form.note" rows="2" /></label>
        <template v-else>
          <label class="wide">Sonuç ve kanaat<textarea v-model="form.conclusion" rows="3" placeholder="Raporun sonuç ve kanaat bölümü" /></label>
          <div class="wide findings-edit">
            <div class="findings-head">
              <span>Bulgular <small>(varsa, madde madde)</small></span>
              <button class="link-button" type="button" @click="addFinding"><i class="pi pi-plus" /> Bulgu ekle</button>
            </div>
            <p v-if="!form.findings.length" class="muted">Bulgu yok.</p>
            <ol v-else>
              <li v-for="(_, index) in form.findings" :key="index">
                <textarea v-model="form.findings[index]" rows="2" placeholder="Bulgu / kusur açıklaması" />
                <button class="icon-button" type="button" title="Bulguyu sil" aria-label="Bulguyu sil" @click="form.findings.splice(index, 1)"><i class="pi pi-times" /></button>
              </li>
            </ol>
          </div>
        </template>
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
// Kayıtlı kontrolü düzenler (elle girişteki hata, eksik bulgu); rapor dosyası ve yapay zeka analizi değişmez.
const props = defineProps<{
  equipment: { id: number; name?: string | null; code?: string | null; type?: { name: string } | null }
  inspection: any
}>()
const emit = defineEmits<{ close: []; saved: [equipment: any] }>()

const { patch, errorMessage } = useExpertApi()

const pending = computed(() => props.inspection.status === 'rapor_bekleniyor')
const form = reactive({
  status: props.inspection.status as string,
  control_date: props.inspection.control_date || '',
  next_control_date: props.inspection.next_control_date || '',
  report_no: props.inspection.report_no || '',
  inspection_body: props.inspection.inspection_body || '',
  note: props.inspection.note || '',
  conclusion: props.inspection.conclusion || '',
  findings: [...(props.inspection.findings || [])] as string[]
})
const saving = ref(false)
const error = ref('')

const addFinding = () => { form.findings.push('') }
const close = () => { if (!saving.value) emit('close') }

const save = async () => {
  saving.value = true
  error.value = ''
  try {
    emit('saved', await patch(`/pk-equipment/${props.equipment.id}/inspections/${props.inspection.id}`, {
      status: form.status,
      control_date: form.control_date,
      next_control_date: form.next_control_date || null,
      report_no: form.report_no.trim() || null,
      inspection_body: form.inspection_body.trim() || null,
      note: form.note.trim() || null,
      conclusion: form.conclusion.trim() || null,
      findings: form.findings.map(finding => finding.trim()).filter(Boolean)
    }))
  } catch (e: any) {
    error.value = errorMessage(e, 'Kaydedilemedi.')
  } finally { saving.value = false }
}
</script>

<style scoped>
.modal-backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:var(--admin-overlay)}
.modal-card{width:min(640px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:22px;background:var(--admin-card);border-radius:12px;box-shadow:0 20px 60px var(--admin-shadow)}
.modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:12px}
h2{margin:0;color:var(--admin-heading);font-size:18px}.modal-head p{margin:5px 0 0;color:var(--admin-muted);font-size:12px}
.close-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:var(--admin-muted);cursor:pointer;border-radius:7px}.close-button:hover{background:var(--admin-hover);color:var(--admin-heading)}
.hint{margin:0 0 14px;padding:10px 12px;border-radius:9px;background:var(--admin-hover);color:var(--admin-muted);font-size:12px}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px}
.form-grid label{display:block;color:var(--admin-heading);font-size:12px;font-weight:700}.form-grid label > span{color:var(--admin-danger-text)}.wide{grid-column:1 / -1}
.form-grid input,.form-grid select,.form-grid textarea{display:block;width:100%;margin-top:6px;padding:0 10px;height:40px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:13px;outline:0}
.form-grid textarea{height:auto;padding:9px 10px;resize:vertical}
.form-grid input:focus,.form-grid select:focus,.form-grid textarea:focus{border-color:#d7a900;box-shadow:0 0 0 3px rgba(255,193,7,.12)}
.findings-edit{display:grid;gap:8px}
.findings-head{display:flex;align-items:center;justify-content:space-between;color:var(--admin-heading);font-size:12px;font-weight:700}.findings-head small{font-weight:400;color:var(--admin-muted)}
.findings-edit ol{display:grid;gap:6px;margin:0;padding-left:22px;color:var(--admin-muted);font-size:12px}
.findings-edit li{padding-left:2px}.findings-edit li > *{vertical-align:top}
.findings-edit li textarea{display:inline-block;width:calc(100% - 40px);margin:0;padding:8px 10px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:13px;resize:vertical;outline:0}
.findings-edit li textarea:focus{border-color:#d7a900;box-shadow:0 0 0 3px rgba(255,193,7,.12)}
.link-button{display:inline-flex;align-items:center;gap:6px;border:0;background:none;color:var(--admin-link);font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.icon-button{width:32px;height:32px;margin-left:6px;display:inline-grid;place-items:center;border:0;border-radius:7px;background:transparent;color:var(--admin-muted);cursor:pointer}.icon-button:hover{background:var(--admin-hover);color:var(--admin-danger-text)}
.muted{margin:0;color:var(--admin-muted);font-size:12px}
.error-text{margin:10px 0 0;color:var(--admin-danger-text);font-size:12px}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 17px;border:0;border-radius:8px;background:var(--pk-yellow);color:#111827;font-size:13px;font-weight:800;cursor:pointer}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.secondary-button{min-height:40px;padding:0 18px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-hover);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}
@media (max-width:560px){.form-grid{grid-template-columns:1fr}}
</style>
