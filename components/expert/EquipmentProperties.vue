<template>
  <div class="specs">
    <p v-if="!properties.length && !pendingSpecs?.length" class="empty">Henüz rapordan okunmuş teknik özellik yok. Periyodik kontrol raporu yapay zeka ile yüklenince burada görünür.</p>
    <table v-if="properties.length">
      <tbody>
        <template v-for="property in properties" :key="property.key">
          <tr>
            <th :title="property.raw_field ? `Raporda: ${property.raw_field}: ${property.raw_value}` : undefined">{{ property.field }}</th>
            <td>
              <form v-if="editKey === property.key" class="edit" @submit.prevent="save(property)">
                <input v-model="editValue" type="text" />
                <button class="primary-button" type="submit" :disabled="saving || !editValue.trim()">{{ saving ? '...' : 'Kaydet' }}</button>
                <button class="secondary-button" type="button" :disabled="saving" @click="editKey = null">İptal</button>
              </form>
              <template v-else>
                <span class="value">{{ withUnit(property.value, property.unit) }}</span>
                <span v-if="property.source === 'manual'" class="badge manual" title="Elle düzeltildi">elle</span>
                <span v-if="property.changed" class="badge changed" title="Raporlar arasında farklı değerler var">değişti</span>
              </template>
              <p v-if="editKey === property.key && error" class="error-text">{{ error }}</p>
            </td>
            <td class="row-actions">
              <button v-if="property.history.length > 1" class="icon-button" :class="{ active: openKey === property.key }" type="button" title="Geçmiş" aria-label="Geçmiş" @click="toggle(property.key)"><i class="pi pi-history" /></button>
              <button class="icon-button" type="button" title="Düzelt" aria-label="Düzelt" @click="startEdit(property)"><i class="pi pi-pencil" /></button>
              <button class="icon-button danger" type="button" title="Sil" aria-label="Sil" @click="remove(property)"><i class="pi pi-trash" /></button>
            </td>
          </tr>
          <tr v-if="openKey === property.key" class="history-row">
            <td colspan="3">
              <ul class="history">
                <li v-for="row in property.history" :key="row.id" :class="{ rejected: !row.accepted, removed: row.is_removed }">
                  <strong>{{ row.is_removed ? row.value : withUnit(row.value, property.unit) }}</strong>
                  <small>{{ row.source === 'manual' ? 'Elle' : (row.report_no || 'Rapor') }} · {{ formatDate(row.effective_at) }}<template v-if="row.created_by"> · {{ row.created_by }}</template><template v-if="row.raw_field"> · raporda “{{ row.raw_field }}: {{ row.raw_value }}”</template></small>
                  <span v-if="row.current" class="badge current">geçerli</span>
                  <span v-else-if="!row.accepted" class="badge rejected">kullanılmadı</span>
                </li>
              </ul>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
    <!-- Katalog dışı olup yetkiliye gönderilen talepler -->
    <div v-if="pendingSpecs?.length" class="pending">
      <h4><i class="pi pi-clock" /> Kataloğa eklenmesi onay bekleyen ({{ pendingSpecs.length }})</h4>
      <div v-for="item in pendingSpecs" :key="item.id" class="pending-row">
        <span>{{ item.name }}<template v-if="item.unit"> ({{ item.unit }})</template></span>
        <strong>{{ item.raw_value || '—' }}</strong>
      </div>
    </div>
    <p v-if="properties.length" class="note">Raporlardan okunur; hiçbir rapor mevcut değeri kendiliğinden değiştirmez, silinen özellik sonraki raporda gelirse sorulur.</p>
  </div>
</template>

<script setup lang="ts">
// Ekipmanın rapordan okunan teknik özellikleri: kompakt özellik tablosu, geçmiş, elle düzeltme ve silme.
const props = defineProps<{ equipmentId: number; properties: any[]; pendingSpecs?: any[] }>()
const emit = defineEmits<{ updated: [equipment: any] }>()

const { post, del, errorMessage } = useExpertApi()

const openKey = ref<string | null>(null)
const editKey = ref<string | null>(null)
const editValue = ref('')
const saving = ref(false)
const error = ref('')

const withUnit = (value: any, unit?: string | null) => value === null || value === undefined || value === '' ? '—' : (unit && /^[\d.,]+$/.test(String(value)) ? `${value} ${unit}` : String(value))
const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('tr-TR').format(new Date(value)) : ''
const toggle = (key: string) => { openKey.value = openKey.value === key ? null : key }
const startEdit = (property: any) => {
  editKey.value = property.key
  editValue.value = property.value ?? ''
  error.value = ''
}

const save = async (property: any) => {
  saving.value = true
  error.value = ''
  try {
    emit('updated', await post(`/pk-equipment/${props.equipmentId}/properties`, { key: property.key, value: editValue.value.trim() }))
    editKey.value = null
  } catch (e: any) {
    error.value = errorMessage(e, 'Kaydedilemedi.')
  } finally { saving.value = false }
}

const remove = async (property: any) => {
  if (!confirm(`"${property.field}" silinsin mi? Sonraki bir raporda gelirse eklensin mi diye sorulur.`)) return
  try {
    emit('updated', await del(`/pk-equipment/${props.equipmentId}/properties/${property.key}`))
  } catch (e: any) {
    alert(errorMessage(e, 'Silinemedi.'))
  }
}
</script>

<style scoped>
.empty{margin:0;padding:24px 8px;text-align:center;color:var(--admin-muted);font-size:12px}
table{width:100%;border-collapse:collapse;font-size:12px}
tr:nth-child(odd of :not(.history-row)) th,tr:nth-child(odd of :not(.history-row)) td{background:var(--admin-soft)}
th,td{padding:7px 10px;text-align:left;vertical-align:middle;border-bottom:1px solid var(--admin-row-border)}
th{width:44%;color:var(--admin-muted);font-weight:600}
.value{color:var(--admin-heading);font-weight:700;overflow-wrap:anywhere}
.row-actions{width:1%;white-space:nowrap;text-align:right}
.row-actions .icon-button{opacity:.35}tr:hover .row-actions .icon-button,.row-actions .icon-button.active{opacity:1}
.icon-button{width:26px;height:26px;display:inline-grid;place-items:center;border:0;border-radius:6px;background:transparent;color:var(--admin-muted);cursor:pointer}
.icon-button:hover,.icon-button.active{background:var(--admin-hover);color:var(--admin-heading)}.icon-button.danger:hover{color:var(--admin-danger-text)}.icon-button i{font-size:12px}
.badge{display:inline-block;margin-left:6px;padding:0 6px;border-radius:999px;font-size:10px;font-weight:700;background:var(--admin-chip);color:var(--admin-muted)}
.badge.manual{background:var(--admin-accent-soft);color:var(--admin-heading)}.badge.changed{background:var(--admin-warning-bg);color:var(--admin-warning-text)}
.badge.current{background:var(--admin-success-bg);color:var(--admin-success-text)}.badge.rejected{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.edit{display:flex;gap:6px}
.edit input{flex:1;min-width:0;height:30px;padding:0 8px;border:1px solid var(--admin-border);border-radius:7px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:12px;outline:0}
.edit input:focus{border-color:#d7a900;box-shadow:0 0 0 3px rgba(255,193,7,.12)}
.primary-button,.secondary-button{height:30px;padding:0 10px;border-radius:7px;font-size:11px;font-weight:800;cursor:pointer}
.primary-button{border:0;background:var(--pk-yellow);color:#111827}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.secondary-button{border:1px solid var(--admin-border);background:var(--admin-card);color:var(--admin-heading)}
.history-row td{background:var(--admin-card);padding:6px 10px 10px}
.history{list-style:none;margin:0;padding:0 0 0 12px;border-left:2px solid var(--admin-border);display:grid;gap:5px}
.history li{display:flex;flex-wrap:wrap;align-items:center;gap:2px 8px;font-size:12px;color:var(--admin-heading)}
.history li small{color:var(--admin-muted);font-size:10px}
.history li.rejected strong{color:var(--admin-muted);text-decoration:line-through}.history li.removed strong{color:var(--admin-danger-text)}
.error-text{margin:4px 0 0;color:var(--admin-danger-text);font-size:11px}
.pending{margin-top:12px;padding:10px 12px;border:1px dashed var(--admin-border);border-radius:9px}
.pending h4{display:flex;align-items:center;gap:6px;margin:0 0 6px;color:var(--admin-warning-text);font-size:12px}
.pending-row{display:grid;grid-template-columns:44% 1fr;gap:10px;padding:4px 0;font-size:12px;color:var(--admin-muted)}.pending-row strong{color:var(--admin-heading)}
.note{margin:8px 0 0;color:var(--admin-muted);font-size:10px}
</style>
