<template>
  <div class="requests-page">
    <div class="page-head">
      <div>
        <div class="breadcrumb"><span>Ayarlar</span><i class="pi pi-angle-right" /><strong>Katalog talepleri</strong></div>
        <h1>Katalog talepleri</h1>
        <template v-if="kind === 'spec'">
          <p v-if="canManage">Raporlarda geçip teknik özellik kataloğunda olmayan özellikler için uzmanların talepleri. Onaylanan özellik tüm kullanıcılarda katalogda görünür.</p>
          <p v-else>Kataloğa eklenmesini talep ettiğiniz teknik özellikler. Yetkili onaylayınca özellik kataloğa, değer ekipmana eklenir.</p>
        </template>
        <template v-else>
          <p v-if="canManage">Tesisat raporlarında geçip katalogda olmayan sistemler için uzmanların talepleri. Onaylanan sistem tüm kullanıcılarda katalogda görünür; rapordaki sonucu talep eden tesisata yazılır.</p>
          <p v-else>Kataloğa eklenmesini talep ettiğiniz tesisat sistemleri. Yetkili onaylayınca sistem kataloğa, rapordaki sonucu ve bulguları tesisatınıza eklenir.</p>
        </template>
      </div>
    </div>

    <div class="kinds">
      <button type="button" :class="{ active: kind === 'spec' }" @click="setKind('spec')">Teknik özellikler <span class="count">{{ specRequests.filter(item => item.status === 'pending').length }}</span></button>
      <button type="button" :class="{ active: kind === 'system' }" @click="setKind('system')">Tesisat sistemleri <span class="count">{{ systemRequests.filter(item => item.status === 'pending').length }}</span></button>
    </div>

    <div class="tabs">
      <button type="button" :class="{ active: tab === 'pending' }" @click="tab = 'pending'">Bekleyen <span class="count">{{ pending.length }}</span></button>
      <button type="button" :class="{ active: tab === 'decided' }" @click="tab = 'decided'">Karara bağlanan <span class="count">{{ decided.length }}</span></button>
    </div>

    <section class="card">
      <div v-if="loading" class="state">Yükleniyor...</div>
      <div v-else-if="error" class="state error-text">{{ error }}</div>
      <div v-else-if="!rows.length" class="state">{{ tab === 'pending' ? 'Bekleyen talep yok.' : 'Karara bağlanmış talep yok.' }}</div>

      <!-- Teknik özellik talepleri -->
      <div v-else-if="kind === 'spec'" class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ekipman türü</th><th>Talep edilen özellik</th><th>Raporda</th><th>Ekipman</th><th>Talep eden</th><th>Durum</th><th v-if="canManage && tab === 'pending'" />
            </tr>
          </thead>
          <tbody>
            <template v-for="item in rows" :key="item.id">
              <tr>
                <td>{{ item.type?.name || '—' }}</td>
                <td><strong>{{ item.name }}</strong><template v-if="item.unit"> ({{ item.unit }})</template></td>
                <td class="muted">{{ item.raw_label }}: <strong>{{ item.raw_value || '—' }}</strong></td>
                <td>
                  <NuxtLink v-if="item.equipment && item.own_tenant" :to="`/expert/equipment/${item.equipment.id}`" class="link">{{ item.equipment.name || `Ekipman no ${item.equipment.code || item.equipment.id}` }}</NuxtLink>
                  <span v-else-if="item.equipment">{{ item.equipment.name || `Ekipman no ${item.equipment.code || item.equipment.id}` }}</span>
                  <span v-else class="muted">—</span>
                </td>
                <td>{{ item.requested_by || '—' }}<small class="block muted">{{ formatDateTime(item.created_at) }}</small></td>
                <td>
                  <span class="status" :class="item.status">{{ STATUS[item.status] }}</span>
                  <small v-if="item.status === 'approved' && item.spec" class="block muted">→ {{ item.spec.name }}<template v-if="item.spec.unit"> ({{ item.spec.unit }})</template></small>
                  <small v-if="item.decision_note" class="block muted">{{ item.decision_note }}</small>
                </td>
                <td v-if="canManage && tab === 'pending'" class="actions">
                  <button class="primary-button" type="button" @click="openDecision(item)">Onayla</button>
                  <button class="secondary-button" type="button" :disabled="busy" @click="reject(item)">Reddet</button>
                </td>
              </tr>
              <tr v-if="decisionFor === item.id" class="decision-row">
                <td colspan="7">
                  <div class="decision">
                    <label class="radio"><input v-model="decision.mode" type="radio" value="new" /> Yeni özellik olarak ekle</label>
                    <div v-if="decision.mode === 'new'" class="decision-fields">
                      <input v-model="decision.name" type="text" placeholder="Özellik adı" />
                      <input v-model="decision.unit" type="text" placeholder="Birim (ops.)" class="unit" />
                    </div>
                    <label class="radio"><input v-model="decision.mode" type="radio" value="map" /> Katalogdaki bir özellikle aynı (rapordaki ad diğer ad olarak eklenir)</label>
                    <div v-if="decision.mode === 'map'" class="decision-fields">
                      <select v-model="decision.map_key">
                        <option value="" disabled>Özellik seçin</option>
                        <option v-for="spec in item.specs" :key="spec.key" :value="spec.key">{{ spec.name }}<template v-if="spec.unit"> ({{ spec.unit }})</template></option>
                      </select>
                    </div>
                    <input v-model="decision.note" type="text" placeholder="Not (ops.)" class="note" />
                    <p v-if="decisionError" class="error-text">{{ decisionError }}</p>
                    <div class="decision-actions">
                      <button class="secondary-button" type="button" :disabled="busy" @click="decisionFor = null">Vazgeç</button>
                      <button class="primary-button" type="button" :disabled="busy || (decision.mode === 'new' ? !decision.name.trim() : !decision.map_key)" @click="approve(item)">{{ busy ? 'Kaydediliyor...' : 'Onayla' }}</button>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Tesisat sistemi talepleri -->
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tesisat türü</th><th>Talep edilen sistem</th><th>Rapordaki sonuç</th><th>Rapor</th><th>Talep eden</th><th>Durum</th><th v-if="canManage && tab === 'pending'" />
            </tr>
          </thead>
          <tbody>
            <template v-for="item in rows" :key="item.id">
              <tr>
                <td>{{ item.type?.name || '—' }}</td>
                <td><strong>{{ item.name }}</strong></td>
                <td>
                  <span class="result" :class="item.result.status">{{ RESULT[item.result.status] || 'Belirtilmemiş' }}</span>
                  <button v-if="item.result.findings.length" class="link-button" type="button" @click="toggleFindings(item.id)">
                    {{ item.result.findings.length }} bulgu <i :class="openFindings === item.id ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" />
                  </button>
                  <ol v-if="openFindings === item.id" class="findings"><li v-for="(finding, index) in item.result.findings" :key="index">{{ finding }}</li></ol>
                </td>
                <td>
                  <template v-if="item.report">
                    {{ formatDate(item.report.control_date) }}<template v-if="item.report.report_no"> · {{ item.report.report_no }}</template>
                    <small class="block muted">{{ [item.report.installation, item.report.location].filter(Boolean).join(' · ') }}</small>
                  </template>
                  <span v-else class="muted">Rapor silinmiş</span>
                </td>
                <td>{{ item.requested_by || '—' }}<small class="block muted">{{ formatDateTime(item.created_at) }}</small></td>
                <td>
                  <span class="status" :class="item.status">{{ STATUS[item.status] }}</span>
                  <small v-if="item.status === 'approved' && item.system" class="block muted">→ {{ item.system.name }}</small>
                  <small v-if="item.decision_note" class="block muted">{{ item.decision_note }}</small>
                </td>
                <td v-if="canManage && tab === 'pending'" class="actions">
                  <button class="primary-button" type="button" @click="openSystemDecision(item)">Onayla</button>
                  <button class="secondary-button" type="button" :disabled="busy" @click="rejectSystem(item)">Reddet</button>
                </td>
              </tr>
              <tr v-if="decisionFor === item.id" class="decision-row">
                <td colspan="7">
                  <div class="decision">
                    <label class="radio"><input v-model="systemDecision.mode" type="radio" value="new" /> Yeni sistem olarak kataloğa ekle</label>
                    <div v-if="systemDecision.mode === 'new'" class="decision-fields">
                      <input v-model="systemDecision.name" type="text" placeholder="Sistem adı" />
                    </div>
                    <label class="radio"><input v-model="systemDecision.mode" type="radio" value="map" /> Katalogdaki bir sistemle aynı</label>
                    <div v-if="systemDecision.mode === 'map'" class="decision-fields">
                      <select v-model="systemDecision.system_id">
                        <option :value="null" disabled>Sistem seçin</option>
                        <option v-for="system in item.systems" :key="system.id" :value="system.id">{{ system.name }}</option>
                      </select>
                    </div>
                    <input v-model="systemDecision.note" type="text" placeholder="Not (ops.)" class="note" />
                    <p v-if="decisionError" class="error-text">{{ decisionError }}</p>
                    <div class="decision-actions">
                      <button class="secondary-button" type="button" :disabled="busy" @click="decisionFor = null">Vazgeç</button>
                      <button class="primary-button" type="button" :disabled="busy || (systemDecision.mode === 'new' ? !systemDecision.name.trim() : !systemDecision.system_id)" @click="approveSystem(item)">{{ busy ? 'Kaydediliyor...' : 'Onayla' }}</button>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// Katalog dışı talepler: teknik özellikler (ekipman raporları) ve tesisat sistemleri (tesisat raporları). Uzman kendi
// taleplerini görür; yetkili onaylar (yeni kayıt ya da katalogdakiyle aynı) veya reddeder.
definePageMeta({ layout: 'expert-settings', middleware: 'expert' })

const STATUS: Record<string, string> = { pending: 'Onay bekliyor', approved: 'Onaylandı', rejected: 'Reddedildi' }
const RESULT: Record<string, string> = { uygun: 'Uygun', uygun_degil: 'Uygun değil' }

const { get, post, errorMessage } = useExpertApi()
const specRequests = ref<any[]>([])
const systemRequests = ref<any[]>([])
const canManage = ref(false)
const loading = ref(true)
const error = ref('')
const busy = ref(false)
const kind = ref<'spec' | 'system'>('spec')
const tab = ref<'pending' | 'decided'>('pending')

const source = computed(() => kind.value === 'spec' ? specRequests.value : systemRequests.value)
const pending = computed(() => source.value.filter(item => item.status === 'pending'))
const decided = computed(() => source.value.filter(item => item.status !== 'pending'))
const rows = computed(() => tab.value === 'pending' ? pending.value : decided.value)
const formatDateTime = (value?: string | null) => value ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : ''
const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('tr-TR').format(new Date(value)) : '—'

const apply = (data: any) => { specRequests.value = data.requests || []; canManage.value = !!data.can_manage }
const applySystems = (data: any) => { systemRequests.value = data.requests || []; canManage.value = canManage.value || !!data.can_manage }
const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const [specs, systems] = await Promise.all([get('/pk-catalog-requests'), get('/pk-installation-system-requests')])
    apply(specs)
    applySystems(systems)
  } catch (e: any) { error.value = errorMessage(e, 'Talepler alınamadı.') }
  finally { loading.value = false }
}
const setKind = (value: 'spec' | 'system') => { kind.value = value; decisionFor.value = null; openFindings.value = null }

// Onay: yeni özellik (ad / birim düzeltilebilir) ya da katalogdaki bir özelliğe bağlama.
const decisionFor = ref<number | null>(null)
const decisionError = ref('')
const decision = reactive({ mode: 'new', name: '', unit: '', map_key: '', note: '' })
const openDecision = (item: any) => {
  Object.assign(decision, { mode: 'new', name: item.name, unit: item.unit || '', map_key: '', note: '' })
  decisionError.value = ''
  decisionFor.value = item.id
}
const approve = async (item: any) => {
  busy.value = true
  decisionError.value = ''
  try {
    apply(await post(`/pk-catalog-requests/${item.id}/approve`, decision.mode === 'new'
      ? { name: decision.name.trim(), unit: decision.unit.trim() || null, note: decision.note.trim() || null }
      : { map_key: decision.map_key, note: decision.note.trim() || null }))
    decisionFor.value = null
  } catch (e: any) {
    decisionError.value = errorMessage(e, 'Onaylanamadı.')
  } finally { busy.value = false }
}
const reject = async (item: any) => {
  const note = prompt(`"${item.name}" talebi reddedilsin mi? İsterseniz bir not yazın:`, '')
  if (note === null) return
  busy.value = true
  try { apply(await post(`/pk-catalog-requests/${item.id}/reject`, { note: note.trim() || null })) }
  catch (e: any) { alert(errorMessage(e, 'Reddedilemedi.')) }
  finally { busy.value = false }
}

// Tesisat sistemi: yeni sistem olarak (ad düzeltilebilir) ya da katalogdaki bir sistemle aynı.
const openFindings = ref<number | null>(null)
const toggleFindings = (id: number) => { openFindings.value = openFindings.value === id ? null : id }
const systemDecision = reactive({ mode: 'new', name: '', system_id: null as number | null, note: '' })
const openSystemDecision = (item: any) => {
  Object.assign(systemDecision, { mode: 'new', name: item.name, system_id: null, note: '' })
  decisionError.value = ''
  decisionFor.value = item.id
}
const approveSystem = async (item: any) => {
  busy.value = true
  decisionError.value = ''
  try {
    applySystems(await post(`/pk-installation-system-requests/${item.id}/approve`, systemDecision.mode === 'new'
      ? { name: systemDecision.name.trim(), note: systemDecision.note.trim() || null }
      : { system_id: systemDecision.system_id, note: systemDecision.note.trim() || null }))
    decisionFor.value = null
  } catch (e: any) {
    decisionError.value = errorMessage(e, 'Onaylanamadı.')
  } finally { busy.value = false }
}
const rejectSystem = async (item: any) => {
  const note = prompt(`"${item.name}" talebi reddedilsin mi? İsterseniz bir not yazın:`, '')
  if (note === null) return
  busy.value = true
  try { applySystems(await post(`/pk-installation-system-requests/${item.id}/reject`, { note: note.trim() || null })) }
  catch (e: any) { alert(errorMessage(e, 'Reddedilemedi.')) }
  finally { busy.value = false }
}

onMounted(load)
</script>

<style scoped>
.requests-page { max-width: 1500px; margin: 0 auto; }
.page-head { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; margin-bottom:20px; }
.breadcrumb { display:flex; align-items:center; gap:8px; margin-bottom:10px; color:var(--admin-muted); font-size:12px; }.breadcrumb strong{color:var(--admin-heading)}
h1{margin:0;color:var(--admin-heading);font-size:30px;letter-spacing:-.7px}.page-head p{margin:7px 0 0;max-width:760px;color:var(--admin-muted);font-size:13px}
.kinds{display:inline-flex;gap:4px;margin-bottom:14px;padding:4px;border:1px solid var(--admin-border);border-radius:10px;background:var(--admin-soft)}
.kinds button{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border:0;border-radius:7px;background:none;color:var(--admin-muted);font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.kinds button.active{background:var(--admin-card);color:var(--admin-heading);box-shadow:0 1px 3px var(--admin-shadow)}
.tabs{display:flex;gap:4px;margin-bottom:16px;border-bottom:1px solid var(--admin-border)}
.tabs button{display:inline-flex;align-items:center;gap:8px;padding:11px 14px;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;background:none;color:var(--admin-muted);font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.tabs button:hover{color:var(--admin-heading)}.tabs button.active{color:var(--admin-heading);border-bottom-color:var(--pk-yellow)}
.count{min-width:22px;padding:1px 7px;border-radius:999px;background:var(--admin-chip);color:var(--admin-text);font-size:11px}
.card{background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px;overflow:hidden}
.state{padding:50px 20px;text-align:center;color:var(--admin-muted);font-size:13px}
.table-wrap{overflow:auto}
table{width:100%;border-collapse:collapse}th,td{padding:12px 16px;text-align:left;border-bottom:1px solid var(--admin-row-border);font-size:12px;color:var(--admin-text);vertical-align:top}
th{font-size:11px;font-weight:700;color:var(--admin-muted);background:var(--admin-soft);white-space:nowrap}
td strong{color:var(--admin-heading)}.muted{color:var(--admin-muted)}.block{display:block;margin-top:2px}
.link{color:var(--admin-link);font-weight:700}
.link-button{display:inline-flex;align-items:center;gap:5px;margin-left:8px;border:0;background:none;color:var(--admin-link);font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.result{display:inline-block;padding:2px 9px;border-radius:999px;background:var(--admin-chip);color:var(--admin-muted);font-size:11px;font-weight:700}
.result.uygun{background:var(--admin-success-bg);color:var(--admin-success-text)}.result.uygun_degil{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.findings{display:grid;gap:4px;margin:8px 0 0;padding-left:18px;max-width:420px}
.status{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
.status.pending{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.status.approved{background:var(--admin-success-bg);color:var(--admin-success-text)}.status.rejected{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.actions{white-space:nowrap;text-align:right}.actions button + button{margin-left:6px}
.primary-button,.secondary-button{min-height:32px;padding:0 12px;border-radius:7px;font-size:12px;font-weight:800;cursor:pointer}
.primary-button{border:0;background:var(--pk-yellow);color:#111827}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.secondary-button{border:1px solid var(--admin-border);background:var(--admin-card);color:var(--admin-heading)}.secondary-button:disabled{opacity:.55}
.decision-row td{background:var(--admin-soft)}
.decision{display:grid;gap:8px;max-width:640px}
.radio{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--admin-heading);font-weight:700;cursor:pointer}
.decision-fields{display:flex;gap:8px;padding-left:22px}
.decision input,.decision select{height:34px;padding:0 10px;border:1px solid var(--admin-border);border-radius:7px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:12px;outline:0}
.decision-fields input,.decision-fields select{flex:1;min-width:0}.decision-fields input.unit{flex:0 0 130px}
.decision-actions{display:flex;justify-content:flex-end;gap:8px}
.error-text{margin:0;color:var(--admin-danger-text);font-size:12px}
</style>
