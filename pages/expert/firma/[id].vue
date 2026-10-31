<template>
  <div class="firm-detail">
    <NuxtLink to="/expert/workplaces" class="back"><i class="pi pi-arrow-left" /> Firmalarım</NuxtLink>

    <div v-if="loading" class="state">Yükleniyor...</div>
    <div v-else-if="error && !firm" class="state error">{{ error }}<button class="secondary-button" type="button" @click="load">Tekrar Dene</button></div>

    <template v-else-if="firm">
      <div class="page-head">
        <div>
          <h1>{{ firm.name }}</h1>
          <p><span v-if="firm.type" class="chip">{{ customerTypeLabel(firm.type) }}</span> {{ locations.length }} lokasyon</p>
        </div>
      </div>

      <div v-if="guide" class="guide"><i class="pi pi-lightbulb" /><span>{{ guide }}</span></div>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>

      <section class="card">
        <ul class="tree">
          <ExpertFirmNode
            v-for="node in nodes" :key="node.id" :node="node" :depth="0" :locations="locations"
            :workplace-count="workplaceCount" :can-branch="canBranch" :branch-label="branchLabel"
            @add-location="openLocation" @add-node="openNode" @equipment="goEquipment" @add-workplace="wizardLocation = $event"
          />
        </ul>
        <div v-if="!nodes.length" class="state">Bu firmanın yapısı boş. <button class="link-button" type="button" @click="repairRoot">Düzelt</button></div>
      </section>

      <section class="other">
        <details>
          <summary>Diğer işlemler</summary>
          <div class="other-body">
            <NuxtLink to="/expert/settings/locations" class="other-link"><i class="pi pi-cog" /> Lokasyonları ayrıntılı düzenle</NuxtLink>
            <NuxtLink to="/expert/settings/customers" class="other-link"><i class="pi pi-pencil" /> Firma adını ya da yapısını düzenle</NuxtLink>
            <button class="other-link danger" type="button" @click="openDelete"><i class="pi pi-trash" /> Firmayı sil</button>
          </div>
        </details>
      </section>
    </template>

    <!-- Lokasyon ekle -->
    <div v-if="locationNode" class="modal-backdrop">
      <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="location-title">
        <div class="modal-head">
          <span class="head-icon"><i class="pi pi-map-marker" /></span>
          <div><h2 id="location-title">Lokasyon Ekle</h2><p>{{ locationNode.name }} altına eklenecek.</p></div>
          <button class="close-button" type="button" aria-label="Kapat" :disabled="saving" @click="closeLocation"><i class="pi pi-times" /></button>
        </div>
        <ExpertFirmLocationFields :draft="draft" :show-company="askCompany" autofocus />
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
        <div class="modal-actions">
          <button class="secondary-button" type="button" :disabled="saving" @click="closeLocation">İptal</button>
          <button class="primary-button" type="button" :disabled="!canSaveLocation || saving || limitFull" @click="saveLocation">{{ saving ? 'Ekleniyor...' : 'Lokasyonu Ekle' }}</button>
        </div>
      </section>
    </div>

    <!-- Şirket / birim ekle -->
    <div v-if="nodeParent" class="modal-backdrop">
      <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="node-title">
        <div class="modal-head">
          <span class="head-icon"><i class="pi pi-sitemap" /></span>
          <div><h2 id="node-title">{{ branchLabel }}</h2><p>{{ nodeParent.name }} altına eklenecek.</p></div>
          <button class="close-button" type="button" aria-label="Kapat" :disabled="saving" @click="nodeParent = null"><i class="pi pi-times" /></button>
        </div>
        <label class="field">{{ firm?.type === 'public' ? 'Birimin adı' : 'Şirketin adı' }} <span class="req">*</span>
          <input ref="nodeInput" v-model="nodeName" type="text" :placeholder="firm?.type === 'public' ? 'Örn. İtfaiye Müdürlüğü' : 'Örn. ABC Enerji A.Ş.'" @keydown.enter.prevent="saveNode" />
        </label>
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
        <div class="modal-actions">
          <button class="secondary-button" type="button" :disabled="saving" @click="nodeParent = null">İptal</button>
          <button class="primary-button" type="button" :disabled="!nodeName.trim() || saving" @click="saveNode">{{ saving ? 'Ekleniyor...' : 'Ekle' }}</button>
        </div>
      </section>
    </div>

    <!-- Eski kayıtta işyeri olmayan lokasyon: mevcut sihirbaz -->
    <ExpertWorkplaceWizard
      v-if="wizardLocation && firm" :customer-id="Number(firm.id)" :customer-name="firm.name"
      :location="{ id: Number(wizardLocation.id), name: wizardLocation.name }" account="expert"
      @close="wizardLocation = null" @saved="wizardLocation = null; load()"
    />

    <!-- Firmayı sil -->
    <div v-if="deleteOpen" class="modal-backdrop">
      <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="delete-title">
        <div class="modal-head">
          <span class="head-icon danger"><i class="pi pi-trash" /></span>
          <div><h2 id="delete-title">Firmayı Sil</h2><p>"{{ firm?.name }}" kalıcı olarak silinir.</p></div>
          <button class="close-button" type="button" aria-label="Kapat" :disabled="deleting" @click="deleteOpen = false"><i class="pi pi-times" /></button>
        </div>
        <p class="delete-warn"><i class="pi pi-exclamation-triangle" /> Bu işlem <strong>geri alınamaz</strong>. Altındaki lokasyonlar, işyerleri, ekipmanlar ve kontrol raporları da silinir.</p>
        <p v-if="!summary && !formError" class="muted">Kayıtlar hesaplanıyor...</p>
        <template v-if="summary">
          <ul v-if="summaryRows.length" class="delete-list"><li v-for="row in summaryRows" :key="row.label"><strong>{{ row.count }}</strong> {{ row.label }}</li></ul>
          <p v-if="summary.blockers.length" class="form-error">Silinemez: {{ summary.blockers.join(', ') }}.</p>
          <label v-else-if="summaryRows.length" class="field">Onaylamak için firma adını yazın<input v-model="deleteConfirm" type="text" :placeholder="firm?.name" /></label>
        </template>
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
        <div class="modal-actions">
          <button class="secondary-button" type="button" :disabled="deleting" @click="deleteOpen = false">İptal</button>
          <button class="danger-button" type="button" :disabled="!canDelete || deleting" @click="removeFirm">{{ deleting ? 'Siliniyor...' : 'Kalıcı Olarak Sil' }}</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
// Bireysel uzmanın firma sayfası: firma → şirket/birim → lokasyon → işyeri zinciri tek ağaçta. Ağaçtaki yeri seçmek atamadır.
import { customerTypeLabel } from '~/composables/useCustomerTypes'
import type { Firm, FirmLocation, FirmNode, LocationDraft, WorkplaceProgress } from '~/composables/useFirmSetup'

definePageMeta({ layout: 'expert', middleware: 'expert' })

const route = useRoute()
const { get, del, errorMessage } = useExpertApi()
const { listFirms, loadStructure, addNode, addWorkplace, workplaceLimitMessage } = useFirmSetup()
const { workplaces, load: loadWorkplaces } = useMyWorkplaces()
const { multiUser, load: loadAccount } = useAccount()
const goToEquipment = useGoToEquipment()

const firm = ref<Firm | null>(null)
const nodes = ref<FirmNode[]>([])
const locations = ref<FirmLocation[]>([])
const loading = ref(true)
const error = ref('')

const canBranch = computed(() => firm.value?.type === 'corporate' || firm.value?.type === 'public')
const branchLabel = computed(() => firm.value?.type === 'public' ? 'Birim Ekle' : 'Şirket Ekle')
const hasBranches = computed(() => nodes.value.some(n => n.children?.length))
const guide = computed(() => {
  if (locations.value.length) return ''
  if (firm.value?.type === 'public' && route.query.yeni) return 'Birimleri varsa "Birim Ekle" ile ekleyin, sonra çalışılan yerler için "Lokasyon Ekle"ye basın.'
  if (firm.value?.type === 'corporate' && route.query.yeni) return 'Grubun şirketlerini "Şirket Ekle" ile ekleyin, sonra her şirketin yanındaki "Lokasyon Ekle"ye basın.'
  return 'Başlamak için "Lokasyon Ekle"ye basın.'
})
const workplaceCount = (location: FirmLocation) => workplaces.value.filter(w => String(w.location_id) === String(location.id)).length

async function load() {
  error.value = ''
  try {
    await loadAccount()
    // Bu ekran yalnız bireysel uzman içindir; diğer hesaplar kendi sayfalarına döner.
    if (multiUser.value) return navigateTo('/expert/workplaces', { replace: true })
    const [firms, structure] = await Promise.all([listFirms(), loadStructure(String(route.params.id)), loadWorkplaces(true)])
    firm.value = firms.find(f => String(f.id) === String(route.params.id)) || null
    if (!firm.value) { error.value = 'Firma bulunamadı.'; return }
    nodes.value = structure.nodes
    locations.value = structure.locations
  } catch (e: any) {
    error.value = errorMessage(e, 'Firma bilgileri alınamadı.')
  } finally { loading.value = false }
}

// --- Lokasyon ---
const locationNode = ref<FirmNode | null>(null)
const newDraft = (): LocationDraft => ({ name: '', cityId: null, districtId: null, address: '', hazard: '', company: '', naceCode: null, activity: null })
const draft = reactive<LocationDraft>(newDraft())
const progress = ref<WorkplaceProgress>({})
const saving = ref(false)
const formError = ref('')
const isRoot = (node: FirmNode) => nodes.value.some(n => n.id === node.id)
// Tek şirkette firma sorulmaz. Grupta altına eklenen şirket varsayılan gelir, değiştirilebilir.
const askCompany = computed(() => firm.value?.type === 'corporate' && !!locationNode.value && (hasBranches.value || !isRoot(locationNode.value)))
const canSaveLocation = computed(() => !!draft.name.trim() && !!draft.cityId && !!draft.hazard && (firm.value?.type === 'public' || !!draft.company.trim()))

const limitFull = ref(false)
function openLocation(node: FirmNode) {
  Object.assign(draft, newDraft(), { company: node.name })
  progress.value = {}
  formError.value = ''
  limitFull.value = false
  locationNode.value = node
  // İşyeri hakkı doluysa form doldurtulmadan söylenir.
  workplaceLimitMessage().then((message) => { limitFull.value = !!message; formError.value = message }).catch(() => {})
}
function closeLocation() { if (!saving.value) locationNode.value = null }

async function saveLocation() {
  if (!canSaveLocation.value || !firm.value || !locationNode.value) return
  saving.value = true
  formError.value = ''
  try {
    if (!progress.value.locationId) {
      const limit = await workplaceLimitMessage()
      if (limit) { formError.value = limit; return }
    }
    await addWorkplace(firm.value.id, locationNode.value.id, draft, firm.value.type, progress.value)
    locationNode.value = null
    await load()
  } catch (e: any) {
    formError.value = errorMessage(e, e?.message || 'Lokasyon eklenemedi. Tekrar deneyin.')
  } finally { saving.value = false }
}

// --- Şirket / birim ---
const nodeParent = ref<FirmNode | null>(null)
const nodeName = ref('')
const nodeInput = ref<HTMLInputElement | null>(null)
function openNode(node: FirmNode) {
  nodeName.value = ''
  formError.value = ''
  nodeParent.value = node
  nextTick(() => nodeInput.value?.focus())
}
async function saveNode() {
  if (!nodeName.value.trim() || !firm.value || !nodeParent.value || saving.value) return
  saving.value = true
  formError.value = ''
  try {
    await addNode(firm.value.id, nodeName.value.trim(), nodeParent.value.id)
    nodeParent.value = null
    await load()
  } catch (e: any) {
    formError.value = errorMessage(e, 'Eklenemedi. Tekrar deneyin.')
  } finally { saving.value = false }
}
// Eski kayıtta kök düğüm yoksa (yarım kalmış kurulum) aynı adla açılır.
async function repairRoot() {
  if (!firm.value) return
  try { await addNode(firm.value.id, firm.value.name, null); await load() }
  catch (e: any) { error.value = errorMessage(e, 'Düzeltilemedi.') }
}

const wizardLocation = ref<FirmLocation | null>(null)
const goEquipment = (location: FirmLocation) => goToEquipment(location.id)

// --- Silme: mevcut uçlar; kayıt varsa onay için ad yazılır ---
interface Summary { organizations: number; locations: number; workplaces: number; equipment: number; inspections: number; blockers: string[] }
const deleteOpen = ref(false)
const summary = ref<Summary | null>(null)
const deleteConfirm = ref('')
const deleting = ref(false)
const summaryRows = computed(() => summary.value ? [
  { label: 'lokasyon', count: summary.value.locations },
  { label: 'işyeri', count: summary.value.workplaces },
  { label: 'ekipman', count: summary.value.equipment },
  { label: 'kontrol raporu (dosyalarıyla)', count: summary.value.inspections }
].filter(r => r.count > 0) : [])
const canDelete = computed(() => !!summary.value && !summary.value.blockers.length
  && (!summaryRows.value.length || deleteConfirm.value.trim().toLocaleLowerCase('tr-TR') === firm.value?.name.trim().toLocaleLowerCase('tr-TR')))
async function openDelete() {
  deleteOpen.value = true
  summary.value = null
  deleteConfirm.value = ''
  formError.value = ''
  try { summary.value = await get<Summary>(`/customers/${firm.value?.id}/purge-summary`) }
  catch (e: any) { formError.value = errorMessage(e, 'Firmanın kayıtları alınamadı.') }
}
async function removeFirm() {
  if (!canDelete.value) return
  deleting.value = true
  formError.value = ''
  try {
    await del(`/customers/${firm.value?.id}/purge`)
    await loadWorkplaces(true)
    await navigateTo('/expert/workplaces')
  } catch (e: any) {
    formError.value = errorMessage(e, 'Firma silinemedi.')
  } finally { deleting.value = false }
}

onMounted(async () => {
  await load()
  // "Başka Lokasyon Ekle" ile gelindiyse form hemen açılır.
  if (route.query.lokasyon && nodes.value[0]) openLocation(nodes.value[0])
})
</script>

<style scoped>
.firm-detail { max-width: 1500px; margin: 0 auto; }
.back { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 14px; color: var(--admin-muted); font-size: 13.5px; font-weight: 600; }
.back:hover { color: var(--admin-heading); }
.page-head { margin-bottom: 16px; }
h1 { margin: 0; color: var(--admin-heading); font-size: 28px; letter-spacing: -.6px; overflow-wrap: anywhere; }
.page-head p { display: flex; align-items: center; gap: 10px; margin: 8px 0 0; color: var(--admin-muted); font-size: 13.5px; }
.chip { padding: 3px 9px; border-radius: 7px; background: var(--admin-soft); color: var(--admin-heading); font-size: 12px; font-weight: 600; }
.guide { display: flex; gap: 10px; margin-bottom: 14px; padding: 12px 14px; border-radius: 10px; background: #fffaeb; color: #b54708; font-size: 14px; line-height: 1.45; }
.card { padding: 14px; border: 1px solid var(--admin-border); border-radius: 12px; background: var(--admin-card, var(--admin-input)); }
.tree { margin: 0; padding: 0; display: grid; gap: 10px; }
.state { padding: 34px 16px; color: var(--admin-muted); text-align: center; font-size: 14px; }
.state.error { display: grid; justify-items: center; gap: 12px; color: #b42318; }
.link-button { border: 0; background: none; color: inherit; font: inherit; font-weight: 700; text-decoration: underline; cursor: pointer; }
.other { margin-top: 16px; color: var(--admin-muted); font-size: 13.5px; }
.other summary { padding: 8px 2px; cursor: pointer; font-weight: 600; }
.other-body { display: grid; justify-items: start; gap: 6px; padding: 6px 2px; }
.other-link { display: inline-flex; align-items: center; gap: 8px; min-height: 36px; border: 0; background: none; color: var(--admin-heading); font: inherit; font-size: 13.5px; cursor: pointer; }
.other-link:hover { text-decoration: underline; }
.other-link.danger { color: #b42318; }
.modal-backdrop { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 16px; background: var(--admin-overlay); }
.modal-card { width: min(540px, 100%); max-height: calc(100vh - 32px); overflow: auto; padding: 22px; border-radius: 14px; background: var(--admin-input); box-shadow: 0 20px 60px var(--admin-shadow); }
.modal-head { display: flex; align-items: center; gap: 13px; margin-bottom: 18px; }
.modal-head > div { flex: 1; min-width: 0; }
.modal-head h2 { margin: 0; color: var(--admin-heading); font-size: 19px; }
.modal-head p { margin: 3px 0 0; color: var(--admin-muted); font-size: 13px; overflow-wrap: anywhere; }
.head-icon { flex: none; width: 44px; height: 44px; display: grid; place-items: center; border-radius: 11px; background: var(--pk-yellow); color: #111827; font-size: 19px; }
.head-icon.danger { background: #fee4e2; color: #b42318; }
.close-button { flex: none; width: 36px; height: 36px; border: 0; border-radius: 8px; background: transparent; color: var(--admin-muted); cursor: pointer; }
.close-button:hover { background: var(--admin-hover); color: var(--admin-heading); }
.field { display: block; color: var(--admin-heading); font-size: 13px; font-weight: 600; }
.field input { margin-top: 6px; }
.field input { width: 100%; min-height: 44px; padding: 0 12px; border: 1px solid var(--admin-border); border-radius: 9px; outline: 0; background: var(--admin-input); color: var(--admin-heading); font: inherit; font-size: 14px; font-weight: 400; }
.field input:focus { border-color: #d7a900; }
.req { color: #d92d20; }
.form-error { margin: 14px 0 0; padding: 10px 12px; border-radius: 9px; background: #fef3f2; color: #b42318; font-size: 13px; }
.muted { color: var(--admin-muted); font-size: 13px; }
.delete-warn { display: flex; gap: 8px; margin: 0 0 12px; padding: 10px 12px; border-radius: 9px; background: #fef3f2; color: #b42318; font-size: 13px; line-height: 1.45; }
.delete-list { margin: 0 0 12px; padding-left: 18px; color: var(--admin-heading); font-size: 13.5px; }
.modal-actions { display: flex; justify-content: space-between; gap: 10px; margin-top: 18px; }
.primary-button, .secondary-button, .danger-button { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 16px; border-radius: 9px; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
.primary-button { border: 1px solid var(--pk-yellow); background: var(--pk-yellow); color: #111827; }
.primary-button:hover:not(:disabled) { background: var(--pk-yellow-dark); }
.secondary-button { border: 1px solid var(--admin-border); background: var(--admin-input); color: var(--admin-heading); }
.danger-button { border: 1px solid #d92d20; background: #d92d20; color: #fff; }
.primary-button:disabled, .danger-button:disabled { opacity: .5; cursor: default; }
</style>
