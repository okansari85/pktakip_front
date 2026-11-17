<template>
  <div class="requests-page">
    <div class="page-head">
      <!-- Ana Sayfa yalnız bireysel uzmanda var; diğer hesaplarda sayfa yolu Genel Bakış'ta başlar -->
      <nav class="crumb" aria-label="Sayfa yolu">
        <i class="pi pi-home" aria-hidden="true" />
        <NuxtLink :to="individual ? '/expert/anasayfa' : '/expert'">{{ individual ? 'Ana Sayfa' : 'Genel Bakış' }}</NuxtLink>
        <i class="pi pi-angle-right" aria-hidden="true" />
        <strong>Katalog talepleri</strong>
      </nav>
      <h1>Katalog talepleri</h1>
      <p>Teknik özellik ve tesisat sistemi taleplerinizi takip edin</p>
    </div>

    <!-- Üst sıra: talep sayıları, seçili talep -->
    <div class="top">
      <section class="card counts">
        <button type="button" class="count-row" :class="{ active: tab === 'pending' }" @click="tab = 'pending'">
          <span class="count-icon warn"><i class="pi pi-hourglass" /></span><span class="count-label">Onay bekleyen</span>
          <strong>{{ allRequests.filter(item => item.status === 'pending').length }}</strong><i class="pi pi-angle-right" />
        </button>
        <button type="button" class="count-row" :class="{ active: tab === 'decided' }" @click="tab = 'decided'">
          <span class="count-icon ok"><i class="pi pi-check" /></span><span class="count-label">Sonuçlanan</span>
          <strong>{{ allRequests.filter(item => item.status !== 'pending').length }}</strong><i class="pi pi-angle-right" />
        </button>
      </section>
      <!-- Seçili talep: satırdaki Detay ile değişir; ilk açılışta en yeni bekleyen talep -->
      <section v-if="featured" class="card featured">
        <header class="featured-head">
          <span class="featured-icon"><i class="pi pi-verified" /></span>
          <span class="featured-title">
            <strong>{{ featured.name }}<template v-if="featured.unit"> ({{ featured.unit }})</template></strong>
            <small>{{ featured.kind === 'spec' ? 'Teknik özellik talebi' : 'Tesisat sistemi talebi' }}</small>
          </span>
          <span class="status" :class="featured.status"><i :class="STATUS_ICON[featured.status]" /> {{ STATUS[featured.status] }}</span>
        </header>
        <dl v-if="featured.kind === 'spec'" class="featured-rows">
          <div><dt><i class="pi pi-box" /> Ekipman</dt><dd>{{ featured.type?.name || '—' }}</dd></div>
          <div><dt><i class="pi pi-barcode" /> Ekipman no</dt><dd>{{ featured.equipment ? featured.equipment.code || featured.equipment.id : '—' }}</dd></div>
        </dl>
        <dl v-else class="featured-rows">
          <div><dt><i class="pi pi-sitemap" /> Tesisat</dt><dd>{{ featured.report?.installation || featured.type?.name || '—' }}</dd></div>
          <div><dt><i class="pi pi-file" /> Rapor</dt><dd>{{ featured.report ? [formatDate(featured.report.control_date), featured.report.report_no].filter(Boolean).join(' · ') : 'Rapor silinmiş' }}</dd></div>
        </dl>
        <NuxtLink v-if="featured.kind === 'spec' && featured.equipment && featured.own_tenant" :to="`/expert/equipment/${featured.equipment.id}`" class="featured-link">Ekipmana git <i class="pi pi-arrow-right" /></NuxtLink>
        <NuxtLink v-else-if="featured.kind === 'system' && featured.report && featured.own_tenant" to="/expert/installations" class="featured-link">Tesisatlara git <i class="pi pi-arrow-right" /></NuxtLink>
      </section>
    </div>

    <section class="card list">
      <div class="tabs">
        <button type="button" :class="{ active: tab === 'pending' }" @click="tab = 'pending'">Bekleyen <span class="count">{{ pending.length }}</span></button>
        <button type="button" :class="{ active: tab === 'decided' }" @click="tab = 'decided'">Sonuçlanan <span class="count">{{ decided.length }}</span></button>
      </div>

      <div class="tools">
        <div class="kinds">
          <button type="button" :class="{ active: kind === 'spec' }" @click="setKind('spec')"><i class="pi pi-cog" /> Teknik özellikler <span v-if="SHOW_KIND_COUNTS" class="count">{{ specRequests.filter(item => item.status === 'pending').length }}</span></button>
          <button type="button" :class="{ active: kind === 'system' }" @click="setKind('system')"><i class="pi pi-sitemap" /> Tesisat sistemleri <span v-if="SHOW_KIND_COUNTS" class="count">{{ systemRequests.filter(item => item.status === 'pending').length }}</span></button>
        </div>
        <label class="search"><i class="pi pi-search" aria-hidden="true" /><input v-model="search" type="search" placeholder="Talep ara" aria-label="Talep ara" /></label>
      </div>

      <div v-if="loading" class="state">Yükleniyor...</div>
      <div v-else-if="error" class="state error-text">{{ error }}</div>
      <div v-else-if="!rows.length" class="state">{{ search.trim() ? 'Aramaya uyan talep yok.' : tab === 'pending' ? 'Bekleyen talep yok.' : 'Sonuçlanan talep yok.' }}</div>

      <!-- Teknik özellik talepleri -->
      <div v-else-if="kind === 'spec'" class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ekipman</th><th>Talep edilen özellik</th><th>Rapordaki ifade</th><th v-if="canManage">Talep eden</th><th>Durum</th><th class="actions">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="item in rows" :key="item.id">
              <tr :class="{ selected: featured?.kind === 'spec' && featured.id === item.id }">
                <td>
                  <span class="subject"><span class="subject-icon"><i class="pi pi-box" /></span><strong>{{ item.type?.name || '—' }}<template v-if="item.equipment"> · No{{ item.equipment.code || item.equipment.id }}</template></strong></span>
                </td>
                <td>{{ item.name }}<template v-if="item.unit"> ({{ item.unit }})</template></td>
                <td><span class="muted">{{ item.raw_label }}:</span> {{ item.raw_value || '—' }}</td>
                <td v-if="canManage">{{ item.requested_by || '—' }}<small class="block muted">{{ formatDateTime(item.created_at) }}</small></td>
                <td>
                  <span class="status" :class="item.status"><i :class="STATUS_ICON[item.status]" /> {{ STATUS[item.status] }}</span>
                  <small v-if="item.status === 'approved' && item.spec" class="block muted">→ {{ item.spec.name }}<template v-if="item.spec.unit"> ({{ item.spec.unit }})</template></small>
                  <small v-if="item.decision_note" class="block muted">{{ item.decision_note }}</small>
                </td>
                <td class="actions">
                  <template v-if="canManage && tab === 'pending'">
                    <button class="primary-button" type="button" @click="openDecision(item)">Onayla</button>
                    <button class="secondary-button" type="button" :disabled="busy" @click="reject(item)">Reddet</button>
                  </template>
                  <button class="detail-link" type="button" @click="showDetail(item, 'spec')">Detay <i class="pi pi-arrow-right" /></button>
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
              <th>Tesisat</th><th>Talep edilen sistem</th><th>Rapordaki sonuç</th><th>Rapor</th><th v-if="canManage">Talep eden</th><th>Durum</th><th class="actions">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="item in rows" :key="item.id">
              <tr :class="{ selected: featured?.kind === 'system' && featured.id === item.id }">
                <td><span class="subject"><span class="subject-icon"><i class="pi pi-sitemap" /></span><strong>{{ item.type?.name || '—' }}</strong></span></td>
                <td>{{ item.name }}</td>
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
                <td v-if="canManage">{{ item.requested_by || '—' }}<small class="block muted">{{ formatDateTime(item.created_at) }}</small></td>
                <td>
                  <span class="status" :class="item.status"><i :class="STATUS_ICON[item.status]" /> {{ STATUS[item.status] }}</span>
                  <small v-if="item.status === 'approved' && item.system" class="block muted">→ {{ item.system.name }}</small>
                  <small v-if="item.decision_note" class="block muted">{{ item.decision_note }}</small>
                </td>
                <td class="actions">
                  <template v-if="canManage && tab === 'pending'">
                    <button class="primary-button" type="button" @click="openSystemDecision(item)">Onayla</button>
                    <button class="secondary-button" type="button" :disabled="busy" @click="rejectSystem(item)">Reddet</button>
                  </template>
                  <button class="detail-link" type="button" @click="showDetail(item, 'system')">Detay <i class="pi pi-arrow-right" /></button>
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
const STATUS_ICON: Record<string, string> = { pending: 'pi pi-clock', approved: 'pi pi-check-circle', rejected: 'pi pi-times-circle' }
const RESULT: Record<string, string> = { uygun: 'Uygun', uygun_degil: 'Uygun değil' }
// Tür düğmelerindeki bekleyen sayısı: katalogda yok, gizli; ileride açılabilir (sayılar sekmelerde ve üstteki kartta)
const SHOW_KIND_COUNTS = false

const { get, post, errorMessage } = useExpertApi()
const { multiUser, account, load: loadAccount } = useAccount()
const individual = computed(() => !!account.value && !multiUser.value)
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
// Talep ara: yüklenen talepler içinde (sunucu en çok 500 talep döner, hepsi sayfada)
const search = ref('')
const matches = (item: any, text: string) => [item.name, item.unit, item.raw_label, item.raw_value, item.type?.name, item.equipment?.name, item.equipment?.code, item.report?.installation, item.report?.report_no, item.requested_by]
  .some(value => value && String(value).toLocaleLowerCase('tr-TR').includes(text))
const rows = computed(() => {
  const list = tab.value === 'pending' ? pending.value : decided.value
  const text = search.value.trim().toLocaleLowerCase('tr-TR')
  return text ? list.filter(item => matches(item, text)) : list
})
// Üstteki kart: Detay ile seçilen talep; seçilmediyse en yeni bekleyen (yoksa en yeni) talep.
const allRequests = computed(() => [...specRequests.value.map(item => ({ ...item, kind: 'spec' })), ...systemRequests.value.map(item => ({ ...item, kind: 'system' }))]
  .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))))
const picked = ref<{ id: number; kind: string } | null>(null)
const featured = computed(() => allRequests.value.find(item => picked.value && item.id === picked.value.id && item.kind === picked.value.kind)
  || allRequests.value.find(item => item.status === 'pending') || allRequests.value[0] || null)
const showDetail = (item: any, itemKind: 'spec' | 'system') => {
  picked.value = { id: item.id, kind: itemKind }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
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

onMounted(() => { loadAccount(); load() })
</script>

<style scoped>
.requests-page{margin:0 auto;display:grid;gap:24px}
.page-head h1{margin:0;color:var(--admin-heading);font-size: 24px;font-weight: 700;line-height:1.15;letter-spacing: 0}.page-head p{margin:7px 0 0;color:var(--admin-muted);font-size:15px}
.crumb{display:flex;align-items:center;gap:8px;margin-bottom:8px;color:var(--admin-muted);font-size:13px}
.crumb a{color:var(--admin-muted)}.crumb a:hover{color:var(--admin-heading)}
.crumb strong{color:var(--admin-heading);font-weight:600}.crumb .pi-angle-right{font-size:11px}
.card{background:var(--admin-card);border:0;border-radius:var(--pk-radius);min-width:0;box-shadow:var(--pk-card-shadow)}
.state{padding:50px 20px;text-align:center;color:var(--admin-muted);font-size:13px}
/* Üst sıra: sayılar, seçili talep */
.top{display:grid;grid-template-columns:340px minmax(0,1fr);gap:24px;align-items:stretch}
.card.counts{display:grid;align-content:start;gap:12px;padding:16px}
.count-row{display:flex;align-items:center;gap:14px;padding:14px;border:1px solid rgba(145,158,171,.2);border-radius:12px;background:var(--admin-card);font:inherit;text-align:left;cursor:pointer}
.count-row:hover{background:rgba(145,158,171,.08)}
.count-row.active{border-color:var(--pk-accent);box-shadow:0 0 0 3px var(--pk-focus-ring)}
.count-icon{flex:none;width:40px;height:40px;display:grid;place-items:center;border-radius:10px;font-size:17px}
.count-icon.warn{background:var(--pk-warning-lighter);color:var(--pk-warning-dark)}.count-icon.ok{background:var(--pk-success-lighter);color:var(--pk-success-dark)}
:global(.dark-theme) .count-icon.warn{background:var(--admin-warning-bg);color:var(--admin-warning-text)}:global(.dark-theme) .count-icon.ok{background:var(--admin-success-bg);color:var(--admin-success-text)}
.count-label{flex:1;color:var(--admin-heading);font-size:15px;font-weight:600}
.count-row strong{color:var(--admin-heading);font-size:24px;font-weight:700}
.count-row > .pi-angle-right{color:var(--admin-muted)}
.card.featured{display:grid;align-content:start;gap:4px;padding:24px}
.featured-head{display:flex;align-items:flex-start;gap:12px;padding-bottom:14px;border-bottom:1px solid rgba(145,158,171,.2)}
.featured-icon{flex:none;width:44px;height:44px;display:grid;place-items:center;border-radius:50%;background:var(--admin-accent-soft);color:var(--admin-link);font-size:20px}
.featured-title{flex:1;display:grid;gap:4px;min-width:0}
.featured-title strong{color:var(--admin-heading);font-size:17px;font-weight:700;overflow-wrap:anywhere}
.featured-title small{color:var(--admin-muted);font-size:14px}
.featured-rows{display:grid;margin:0}
.featured-rows div{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 4px;border-bottom:1px dashed rgba(145,158,171,.24)}
.featured-rows dt{display:flex;align-items:center;gap:10px;color:var(--admin-text);font-size:14px}.featured-rows dt i{color:var(--admin-muted)}
.featured-rows dd{margin:0;color:var(--admin-heading);font-size:15px;font-weight:700;text-align:right}
.featured-link{justify-self:start;display:inline-flex;align-items:center;gap:8px;margin-top:12px;color:var(--admin-link);font-size:14px;font-weight:700}
/* Liste kartı */
.card.list{padding:8px 24px 24px}
.tabs{display:flex;gap:28px;border-bottom:1px solid rgba(145,158,171,.2)}
.tabs button{display:inline-flex;align-items:center;gap:10px;padding:14px 2px;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;background:none;color:var(--admin-muted);font:inherit;font-size:14px;font-weight:600;cursor:pointer}
.tabs button:hover{color:var(--admin-heading)}.tabs button.active{color:var(--admin-heading);border-bottom-color:var(--pk-accent);font-weight:700}
.count{min-width:24px;padding:2px 8px;border-radius:6px;background:var(--admin-chip);color:var(--admin-text);font-size:12px;font-weight:700;text-align:center}
.tabs button.active .count{background:var(--pk-accent);color:var(--pk-on-accent)}
.tools{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin:16px 0 14px}
.kinds{display:flex;flex-wrap:wrap;gap:12px}
.kinds button{display:inline-flex;align-items:center;gap:9px;height:44px;padding:0 18px;border:1px solid rgba(145,158,171,.32);border-radius:8px;background:var(--admin-card);color:var(--admin-heading);font:inherit;font-size:14px;font-weight:600;cursor:pointer}
.kinds button:hover{background:var(--admin-hover)}
.kinds button.active{border-color:var(--pk-accent);background:var(--admin-accent-soft);color:var(--admin-link);font-weight:700}
.search{position:relative;display:flex;align-items:center;flex:0 1 440px;min-width:220px}
.search i{position:absolute;left:16px;color:var(--admin-muted)}
.search input{width:100%;height:44px;padding:0 14px 0 44px;border:1px solid rgba(145,158,171,.32);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:14px;outline:0}
.search input:focus{border-color:var(--pk-accent);box-shadow:0 0 0 3px var(--pk-focus-ring)}
.table-wrap{overflow:auto;border-radius:8px}
table{width:100%;border-collapse:collapse}th,td{padding:14px 20px;text-align:left;border-bottom:1px solid rgba(145,158,171,.2);font-size:14px;color:var(--admin-text);vertical-align:middle}
tbody tr:last-child td{border-bottom:0}
th{font-size:13px;font-weight:600;color:var(--admin-muted);background:rgba(145,158,171,.08);border-bottom:0;white-space:nowrap}
tbody tr.selected{background:var(--admin-accent-soft)}
td strong{color:var(--admin-heading)}.muted{color:var(--admin-muted)}.block{display:block;margin-top:4px;font-size:12px}
.subject{display:inline-flex;align-items:center;gap:12px}
.subject-icon{flex:none;width:36px;height:36px;display:grid;place-items:center;border-radius:50%;background:var(--admin-accent-soft);color:var(--admin-link)}
.subject strong{font-size:14px;font-weight:600}
.link-button{display:inline-flex;align-items:center;gap:5px;margin-left:8px;border:0;background:none;color:var(--admin-link);font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.result{display:inline-block;padding:2px 8px;border-radius:6px;background:var(--admin-chip);color:var(--admin-muted);font-size:12px;font-weight:700}
.result.uygun{background:var(--admin-success-bg);color:var(--admin-success-text)}.result.uygun_degil{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.findings{display:grid;gap:4px;margin:8px 0 0;padding-left:18px;max-width:420px;font-size:13px}
.status{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700;white-space:nowrap}
.status.pending{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.status.approved{background:var(--admin-success-bg);color:var(--admin-success-text)}.status.rejected{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.actions{white-space:nowrap;text-align:right}.actions button + button{margin-left:8px}
.detail-link{display:inline-flex;align-items:center;gap:8px;padding:0;border:0;background:none;color:var(--admin-link);font:inherit;font-size:14px;font-weight:700;cursor:pointer}
.detail-link:hover{text-decoration:underline}
.primary-button,.secondary-button{min-height:32px;padding:0 12px;border-radius:8px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.primary-button{border:0;background:var(--pk-accent);color:var(--pk-on-accent);box-shadow:0 8px 16px rgba(var(--pk-accent-rgb),.24)}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.secondary-button{border:1px solid rgba(145,158,171,.32);background:var(--admin-card);color:var(--admin-heading)}.secondary-button:disabled{opacity:.55}
.decision-row td{background:var(--admin-soft)}
.decision{display:grid;gap:8px;max-width:640px}
.radio{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--admin-heading);font-weight:700;cursor:pointer}
.decision-fields{display:flex;gap:8px;padding-left:22px}
.decision input,.decision select{height:34px;padding:0 10px;border:1px solid var(--admin-border);border-radius:7px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:12px;outline:0}
.decision-fields input,.decision-fields select{flex:1;min-width:0}.decision-fields input.unit{flex:0 0 130px}
.decision-actions{display:flex;justify-content:flex-end;gap:8px}
.error-text{margin:0;color:var(--admin-danger-text);font-size:12px}
@media (max-width:800px){.top{grid-template-columns:1fr}.page-head h1{font-size: 22px}}
</style>
