<template>
  <div class="modal-backdrop">
    <section class="modal-card">
      <div class="modal-head">
        <div>
          <h2>Ekipman Ekle</h2>
          <p>{{ system.name }} · {{ installation.workplace ? workplaceLabel(installation.workplace.id, installation.workplace.company_name) : 'Lokasyon geneli' }} · {{ installation.location?.name }}</p>
        </div>
        <button class="close-button" type="button" @click="close"><i class="pi pi-times" /></button>
      </div>

      <p class="hint">Her satır bir ekipman. Eklenen ekipmanlar Ekipmanlar menüsünde de görünür; marka, model ve seri no ekipmanın kendi sayfasından girilir.</p>

      <div class="rows">
        <div class="row head" :style="gridStyle">
          <span v-if="!single">Tür</span><span>No</span><span>Konum</span><span v-if="anyVariants">Tip</span><span />
        </div>
        <div v-for="(row, index) in rows" :key="row.uid" class="row" :class="{ invalid: row.error }" :style="gridStyle">
          <select v-if="!single" v-model="row.equipment_type_id" :disabled="saving" @change="row.variant = ''">
            <option v-for="type in types" :key="type.id" :value="type.id">{{ type.name }}</option>
          </select>
          <input v-model="row.code" type="text" :disabled="saving" placeholder="Örn. YD-01" />
          <input v-model="row.place" type="text" :disabled="saving" placeholder="Örn. B Blok giriş" />
          <select v-if="anyVariants" v-model="row.variant" :disabled="saving || !variantsOf(row).length">
            <option value="">{{ variantsOf(row).length ? 'Seçilmedi' : '—' }}</option>
            <option v-for="variant in variantsOf(row)" :key="variant" :value="variant">{{ variant }}</option>
          </select>
          <button class="icon-button" type="button" title="Satırı sil" aria-label="Satırı sil" :disabled="saving || rows.length === 1" @click="rows.splice(index, 1)"><i class="pi pi-times" /></button>
          <small v-if="row.error" class="row-error">{{ row.error }}</small>
        </div>
      </div>
      <div class="add-rows">
        <button class="link-button" type="button" :disabled="saving" @click="addRows(1)"><i class="pi pi-plus" /> Satır ekle</button>
        <button class="link-button" type="button" :disabled="saving" @click="addRows(5)"><i class="pi pi-plus" /> 5 satır ekle</button>
        <small>Yeni satırın numarası bir öncekinden devam eder (YD-01 → YD-02).</small>
      </div>

      <p v-if="error" class="error-text">{{ error }}</p>
      <div class="modal-actions">
        <button class="secondary-button" type="button" :disabled="saving" @click="close">İptal</button>
        <button class="primary-button" type="button" :disabled="saving || !filled.length" @click="save">
          {{ saving ? `Kaydediliyor ${done}/${total}` : filled.length ? `${filled.length} ekipmanı kaydet` : 'Kaydet' }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// Tesisat sisteminin içinden toplu ekipman ekleme: tür sistemin katalogundaki türlerden, yer tesisattan. Her satır
// Ekipmanlar'daki normal ekleme ile kaydedilir (aynı kayıt iki menüde görünür). Aynı tür + no + konumda kayıt varsa eklenmez.
const props = defineProps<{ installation: any; system: any; types: { id: number; name: string; variants: string[]; variant_label: string | null }[] }>()
const emit = defineEmits<{ close: []; saved: []; changed: [] }>()

interface Row { uid: number; equipment_type_id: number; code: string; place: string; variant: string; error: string }

const { post, errorMessage } = useExpertApi()
// İşyeri adı varsa "Ad · Firma" (adlar sayfada yüklenmiş olur).
const { workplaceLabel } = useWorkplaceNames()

let uid = 0
const newRow = (from?: Row): Row => ({
  uid: ++uid,
  equipment_type_id: from?.equipment_type_id ?? props.types[0]?.id,
  code: from ? nextCode(from.code.trim()) : '',
  place: '',
  variant: from?.variant ?? '',
  error: ''
})
const rows = ref<Row[]>([newRow()])
const saving = ref(false)
const done = ref(0)
const total = ref(0)
const error = ref('')

const single = computed(() => props.types.length === 1)
const anyVariants = computed(() => props.types.some(type => type.variants?.length))
const gridStyle = computed(() => ({
  gridTemplateColumns: [single.value ? '' : 'minmax(150px,1.3fr)', 'minmax(90px,.8fr)', 'minmax(140px,1.4fr)', anyVariants.value ? 'minmax(120px,1fr)' : '', '32px'].filter(Boolean).join(' ')
}))
const variantsOf = (row: Row) => props.types.find(type => type.id === row.equipment_type_id)?.variants || []
const isFilled = (row: Row) => !!(row.code.trim() || row.place.trim())
const filled = computed(() => rows.value.filter(isFilled))
const norm = (value?: string | null) => (value || '').trim().toLocaleLowerCase('tr-TR')

// Sondaki sayıyı bir artırır, baştaki sıfırları korur (YD-09 → YD-10); sayı yoksa boş.
function nextCode (code: string) {
  let start = code.length
  while (start > 0 && code[start - 1] >= '0' && code[start - 1] <= '9') start--
  if (start === code.length) return ''
  const digits = code.slice(start)
  return code.slice(0, start) + String(Number(digits) + 1).padStart(digits.length, '0')
}
const addRows = (count: number) => {
  for (let i = 0; i < count; i++) rows.value.push(newRow(rows.value[rows.value.length - 1]))
}

// Kimlik: aynı tür + no + konum. Sistemde zaten olan ya da listede tekrar eden satır işaretlenir.
const validate = () => {
  const seen = new Set<string>()
  let ok = true
  for (const row of rows.value) {
    row.error = ''
    if (!isFilled(row)) continue
    const key = `${row.equipment_type_id}|${norm(row.code)}|${norm(row.place)}`
    if ((props.system.equipment || []).some((item: any) => item.type?.id === row.equipment_type_id && norm(item.code) === norm(row.code) && norm(item.place) === norm(row.place))) {
      row.error = 'Bu no ve konumda bu türde bir ekipman zaten var.'
      ok = false
    } else if (seen.has(key)) {
      row.error = 'Bu satır listede tekrar ediyor.'
      ok = false
    }
    seen.add(key)
  }
  return ok
}

const close = () => { if (!saving.value) emit('close') }

const save = async () => {
  error.value = ''
  if (!validate()) { error.value = 'İşaretli satırları düzeltin.'; return }
  const queue = [...filled.value]
  saving.value = true
  done.value = 0
  total.value = queue.length
  for (const row of queue) {
    try {
      await post('/pk-equipment', {
        location_id: props.installation.location?.id,
        location_business_entity_id: props.installation.workplace?.id ?? null,
        equipment_type_id: row.equipment_type_id,
        variant: row.variant || null,
        code: row.code.trim() || null,
        place: row.place.trim() || null
      })
      rows.value = rows.value.filter(item => item.uid !== row.uid)
      done.value++
    } catch (e: any) {
      row.error = errorMessage(e, 'Kaydedilemedi.')
    }
  }
  saving.value = false
  if (done.value === total.value) { emit('saved'); return }
  // Bir kısmı kaydedildi: liste yenilenir, hatalı satırlar pencerede kalır.
  if (done.value) emit('changed')
  if (!rows.value.length) rows.value.push(newRow())
  error.value = `${done.value} ekipman kaydedildi; işaretli satırlar kaydedilemedi.`
}
</script>

<style scoped>
.modal-backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:var(--admin-overlay)}
.modal-card{width:min(820px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:22px;background:var(--admin-card);border-radius:12px;box-shadow:0 20px 60px var(--admin-shadow)}
.modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:12px}
h2{margin:0;color:var(--admin-heading);font-size:18px}.modal-head p{margin:5px 0 0;color:var(--admin-muted);font-size:12px}
.close-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:var(--admin-muted);cursor:pointer;border-radius:7px}.close-button:hover{background:var(--admin-hover);color:var(--admin-heading)}
.hint{margin:0 0 14px;color:var(--admin-muted);font-size:12px}
.rows{display:grid;gap:6px}
.row{display:grid;gap:8px;align-items:center}
.row.head span{color:var(--admin-muted);font-size:11px;font-weight:700}
.row input,.row select{width:100%;min-width:0;height:38px;padding:0 10px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:13px;outline:0}
.row input:focus,.row select:focus{border-color:#d7a900;box-shadow:0 0 0 3px rgba(255,193,7,.12)}
.row.invalid input,.row.invalid select{border-color:var(--admin-danger-text)}
.row-error{grid-column:1 / -1;margin-top:-2px;color:var(--admin-danger-text);font-size:11px}
.icon-button{width:32px;height:32px;display:grid;place-items:center;border:0;border-radius:7px;background:transparent;color:var(--admin-muted);cursor:pointer}.icon-button:hover:not(:disabled){background:var(--admin-hover);color:var(--admin-danger-text)}.icon-button:disabled{opacity:.35;cursor:default}
.add-rows{display:flex;align-items:center;flex-wrap:wrap;gap:14px;margin-top:10px}.add-rows small{color:var(--admin-muted);font-size:11px}
.link-button{display:inline-flex;align-items:center;gap:6px;border:0;background:none;color:var(--admin-link);font:inherit;font-size:12px;font-weight:700;cursor:pointer}.link-button:disabled{opacity:.5}
.error-text{margin:12px 0 0;color:var(--admin-danger-text);font-size:12px}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 17px;border:0;border-radius:8px;background:var(--pk-yellow);color:#111827;font-size:13px;font-weight:800;cursor:pointer}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.secondary-button{min-height:40px;padding:0 18px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-hover);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}
@media(max-width:640px){.row{grid-template-columns:1fr 1fr !important}.row.head{display:none}.row .icon-button{justify-self:end}}
</style>
