<template>
  <div class="analysis">
    <div v-if="analysis.match" class="match-line" :class="analysis.match.status">
      <i :class="MATCH_ICONS[analysis.match.status]" />
      <span>{{ MATCH_TEXT[analysis.match.status] }}<template v-if="analysis.match.confirmed_by_user"> — kullanıcı uyarıya rağmen kaydetti</template></span>
    </div>

    <!-- Bölümler alt alta -->
    <section v-if="body">
      <h4>Periyodik kontrolü yapan kuruluş</h4>
      <dl>
        <template v-for="row in bodyRows" :key="row.label"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></template>
      </dl>
      <div v-for="(person, index) in body.personnel || []" :key="index" class="person">
        <h5>{{ ROLE_LABELS[person.role] || person.role || 'Uzman' }}</h5>
        <dl>
          <template v-for="row in personRows(person)" :key="row.label"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></template>
        </dl>
      </div>
      <p v-if="!body.personnel?.length" class="muted">Kontrol eden / onaylayan uzman bilgisi raporun metninde bulunamadı.</p>
    </section>

    <section v-if="analysis.report_information?.length">
      <h4>Rapor bilgileri</h4>
      <dl><template v-for="row in analysis.report_information" :key="row.key"><dt>{{ INFO_LABELS[row.key] || row.key }}</dt><dd>{{ row.value }}</dd></template></dl>
    </section>

    <section v-if="analysis.equipment?.length">
      <h4>Rapordaki teknik özellikler</h4>
      <dl v-for="item in analysis.equipment" :key="`${item.name}-${item.identity}`">
        <dt>Ekipman</dt><dd>{{ item.name }}</dd>
        <template v-if="item.identity"><dt>{{ item.identity_field || 'No' }}</dt><dd>{{ item.identity }}</dd></template>
        <template v-for="attribute in item.attributes" :key="attribute.field"><dt>{{ attribute.field }}</dt><dd>{{ attribute.value }}</dd></template>
      </dl>
    </section>

    <!-- Katalogda olmayan özellikler: ekipmana kaydedilmedi; kataloğa eklenmesi buradan talep edilir -->
    <section v-if="analysis.unmapped_specs?.length">
      <h4>Katalogda olmayan özellikler <span class="count">{{ analysis.unmapped_specs.length }}</span></h4>
      <p class="muted note">Bu özellikler ekipmana kaydedilmedi. Kataloğa eklenmesini talep edebilirsiniz; yetkili onaylayınca kataloğa girer ve değer ekipmana yazılır.</p>
      <div v-for="row in analysis.unmapped_specs" :key="row.id" class="unmapped">
        <div class="unmapped-line">
          <span class="unmapped-label">{{ row.label }}</span>
          <strong>{{ row.value }}</strong>
          <span v-if="row.request" class="request-state" :class="row.request.status">{{ requestText(row.request) }}</span>
          <button v-if="canRequest && (!row.request || row.request.status === 'rejected') && requesting !== row.id" class="link-button" type="button" @click="startRequest(row)">
            {{ row.request ? 'Tekrar talep et' : 'Kataloğa eklenmesini talep et' }}
          </button>
        </div>
        <small v-if="row.request?.note" class="decision-note">Yetkili notu: {{ row.request.note }}</small>
        <form v-if="requesting === row.id" class="request-form" @submit.prevent="sendRequest(row)">
          <input v-model="requestForm.name" type="text" placeholder="Özellik adı" />
          <input v-model="requestForm.unit" type="text" placeholder="Birim (ops.)" class="unit" />
          <button class="small-primary" type="submit" :disabled="sending || !requestForm.name.trim()">{{ sending ? 'Gönderiliyor...' : 'Talep et' }}</button>
          <button class="small-secondary" type="button" :disabled="sending" @click="requesting = null">Vazgeç</button>
        </form>
      </div>
      <p v-if="requestError" class="error-text">{{ requestError }}</p>
    </section>

    <section v-if="analysis.facility_information?.length">
      <h4>Firma / tesis bilgileri</h4>
      <dl><template v-for="row in analysis.facility_information" :key="row.key"><dt>{{ row.key }}</dt><dd>{{ row.value }}</dd></template></dl>
    </section>

    <section v-if="analysis.match?.checks?.length">
      <h4>Ekipman eşleşmesi</h4>
      <dl><template v-for="check in analysis.match.checks" :key="check.field"><dt>{{ check.label }}</dt><dd :class="check.result">{{ check.report || '—' }} <small>(kayıtlı: {{ check.equipment }})</small></dd></template></dl>
    </section>

    <section v-if="analysis.overall_result?.text">
      <h4>Sonuç ve kanaat</h4>
      <p>{{ analysis.overall_result.text }}</p>
    </section>

    <section v-if="analysis.systems?.length > 1">
      <h4>Bölümler</h4>
      <div class="chips"><span v-for="system in analysis.systems" :key="system.name" class="status-chip" :class="system.status">{{ system.name }}</span></div>
    </section>

    <section>
      <h4>Bulgular <span class="count">{{ analysis.findings?.length || 0 }}</span></h4>
      <p v-if="!analysis.findings?.length" class="muted">Raporda bulgu / kusur açıklaması yok.</p>
      <ol v-else class="findings">
        <li v-for="(finding, index) in analysis.findings" :key="index">
          {{ finding.description }}<small v-if="finding.system_name || finding.severity"> · {{ [finding.system_name, finding.severity].filter(Boolean).join(' · ') }}</small>
        </li>
      </ol>
    </section>

    <p class="meta"><template v-if="analysis.fixture">Test verisi: {{ analysis.fixture.original_file_name }} · </template>{{ analysis.model }}<template v-if="analysis.analyzed_at"> · {{ new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(analysis.analyzed_at)) }}</template></p>
  </div>
</template>

<script setup lang="ts">
// Kontrol kaydıyla saklanan yapay zeka rapor analizi (kriterler hariç): kuruluş ve uzmanlar, rapor bilgileri,
// teknik özellikler, eşleşme, sonuç, bulgular — bölümler alt alta.
const props = defineProps<{ analysis: any; equipmentId?: number; inspectionId?: number }>()
const emit = defineEmits<{ updated: [equipment: any] }>()
const { post, errorMessage } = useExpertApi()

const INFO_LABELS: Record<string, string> = {
  report_no: 'Rapor no', company_title: 'Raporu isteyen firma', address: 'Adres', report_date: 'Rapor tarihi', control_date: 'Kontrol tarihi', validity_date: 'Geçerlilik tarihi'
}
const ROLE_LABELS: Record<string, string> = { kontrol_eden: 'Kontrolü yapan uzman', onaylayan: 'Onaylayan uzman' }
const MATCH_TEXT: Record<string, string> = {
  match: 'Eşleşti',
  close: 'Rapor bu ekipmanla eşleşmedi: yazım farkı vardı',
  mismatch: 'Rapor bu ekipmana ait görünmüyordu',
  unknown: 'Seri no karşılaştırılamadı (raporda ya da kayıtta yoktu)'
}
const MATCH_ICONS: Record<string, string> = { match: 'pi pi-check-circle', close: 'pi pi-exclamation-circle', mismatch: 'pi pi-times-circle', unknown: 'pi pi-question-circle' }

const body = computed(() => props.analysis.inspection_body || null)
const rows = (pairs: [string, any][]) => pairs.filter(([, value]) => value).map(([label, value]) => ({ label, value }))
const bodyRows = computed(() => rows([
  ['Unvan', body.value?.name], ['Adres', body.value?.address], ['Telefon', body.value?.phone], ['E-posta', body.value?.email],
  ['Web', body.value?.website], ['Vergi', body.value?.tax_info], ['Akreditasyon', body.value?.accreditation]
]))
const personRows = (person: any) => rows([
  ['Adı soyadı', person.name], ['Mesleği', person.profession], ['Oda sicil no', person.chamber_registry_no],
  ['Diploma', person.diploma], ['Bakanlık yetki no', person.authorization_no]
])

// Katalog talebi: kayıtlı kontrol kaydının rapordaki başlığı için; sonucu yetkili verir (Ayarlar → Katalog talepleri).
const canRequest = computed(() => !!props.equipmentId && !!props.inspectionId)
const requestText = (request: any) => ({
  pending: 'Talep edildi — onay bekliyor',
  approved: `Kataloğa eklendi${request.spec ? `: ${request.spec.name}` : ''}`,
  rejected: 'Talep reddedildi'
} as Record<string, string>)[request.status] || request.status
const requesting = ref<string | null>(null)
const requestForm = reactive({ name: '', unit: '' })
const sending = ref(false)
const requestError = ref('')
// "Kaldırma Kapasitesi (kg)" → ad "Kaldırma Kapasitesi", birim "kg" (öneri; kullanıcı düzeltebilir).
const startRequest = (row: any) => {
  requesting.value = row.id
  requestError.value = ''
  requestForm.unit = row.label.match(/\(([^)]{1,15})\)\s*$/)?.[1] || ''
  requestForm.name = row.label.replace(/\([^)]*\)\s*$/, '').trim()
}
const sendRequest = async (row: any) => {
  if (!requestForm.name.trim()) return
  sending.value = true
  requestError.value = ''
  try {
    const equipment = await post(`/pk-equipment/${props.equipmentId}/inspections/${props.inspectionId}/spec-requests`, {
      id: row.id, name: requestForm.name.trim(), unit: requestForm.unit.trim() || null
    })
    requesting.value = null
    emit('updated', equipment)
  } catch (e: any) {
    requestError.value = errorMessage(e, 'Talep gönderilemedi.')
  } finally { sending.value = false }
}
</script>

<style scoped>
.analysis{display:grid;gap:0;max-width:760px}
.match-line{display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:9px 12px;border-radius:9px;font-size:12px;font-weight:700}
.match-line.match{background:var(--admin-success-bg);color:var(--admin-success-text)}.match-line.close,.match-line.unknown{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.match-line.mismatch{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
section{min-width:0;padding:12px 0;border-top:1px solid var(--admin-border)}
section:first-of-type{border-top:0;padding-top:4px}
h4{display:flex;align-items:center;gap:6px;margin:0 0 8px;color:var(--admin-heading);font-size:12px}
h5{margin:10px 0 6px;color:var(--admin-heading);font-size:11px}
.person{padding-left:10px;border-left:2px solid var(--admin-border)}
dl{display:grid;grid-template-columns:minmax(120px,200px) 1fr;gap:5px 12px;margin:0;font-size:12px}dl + dl{margin-top:8px}
dt{color:var(--admin-muted)}dd{margin:0;color:var(--admin-heading);overflow-wrap:anywhere}dd small{color:var(--admin-muted)}
dd.ok{color:var(--admin-success-text)}dd.close{color:var(--admin-warning-text)}dd.diff{color:var(--admin-danger-text)}
p{margin:0;color:var(--admin-text);font-size:12px;line-height:1.5}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.status-chip{padding:3px 10px;border-radius:999px;background:var(--admin-chip);color:var(--admin-muted);font-size:11px;font-weight:700}
.status-chip.uygun{background:var(--admin-success-bg);color:var(--admin-success-text)}.status-chip.uygun_degil{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.count{padding:1px 7px;border-radius:999px;background:var(--admin-chip);color:var(--admin-muted);font-size:10px}
.findings{margin:0;padding-left:18px;display:grid;gap:5px;color:var(--admin-text);font-size:12px;line-height:1.45}.findings small{color:var(--admin-muted)}
.muted{color:var(--admin-muted)}.note{margin-bottom:8px}
.unmapped{display:grid;gap:4px;padding:6px 0;border-top:1px dashed var(--admin-border)}.unmapped:first-of-type{border-top:0}
.unmapped-line{display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;font-size:12px}
.unmapped-label{color:var(--admin-muted)}.unmapped-line strong{color:var(--admin-heading)}
.request-state{padding:2px 8px;border-radius:999px;background:var(--admin-chip);color:var(--admin-muted);font-size:10px;font-weight:700}
.request-state.pending{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.request-state.approved{background:var(--admin-success-bg);color:var(--admin-success-text)}.request-state.rejected{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.decision-note{color:var(--admin-muted);font-size:11px}
.link-button{border:0;padding:0;background:none;color:var(--admin-link);font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.request-form{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.request-form input{flex:1;min-width:160px;height:32px;padding:0 9px;border:1px solid var(--admin-border);border-radius:7px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:12px;outline:0}
.request-form input.unit{flex:0 0 110px;min-width:0}.request-form input:focus{border-color:#d7a900}
.small-primary,.small-secondary{height:32px;padding:0 12px;border-radius:7px;font:inherit;font-size:12px;font-weight:800;cursor:pointer}
.small-primary{border:0;background:var(--pk-yellow);color:#111827}.small-primary:disabled{opacity:.55;cursor:not-allowed}
.small-secondary{border:1px solid var(--admin-border);background:var(--admin-hover);color:var(--admin-heading)}
.error-text{margin-top:6px;color:var(--admin-danger-text)}.meta{padding-top:10px;border-top:1px solid var(--admin-border);color:var(--admin-muted);font-size:10px}
@media(max-width:640px){dl{grid-template-columns:1fr}dt{margin-top:4px}}
</style>
