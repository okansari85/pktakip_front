<template>
  <div class="modal-backdrop">
    <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="firm-wizard-title">
      <div class="modal-head">
        <span class="head-icon"><i :class="step === 'done' ? 'pi pi-check' : 'pi pi-building'" /></span>
        <div>
          <h2 id="firm-wizard-title">{{ title }}</h2>
          <p>{{ subtitle }}</p>
        </div>
        <button class="close-button" type="button" aria-label="Kapat" :disabled="saving" @click="close"><i class="pi pi-times" /></button>
      </div>

      <!-- 1: tür -->
      <div v-if="step === 'kind'" class="kinds">
        <button v-for="k in FIRM_KINDS" :key="k.id" type="button" class="kind" :class="k.tone" @click="pick(k.id)">
          <span class="kind-icon"><i :class="k.icon" /></span>
          <span class="kind-text"><strong>{{ k.title }}</strong><small>{{ k.text }}</small></span>
          <i class="pi pi-angle-right" />
        </button>
      </div>

      <!-- 2: bilgiler. Tek şirket: ad + ilk lokasyon. Holding / kamu: yalnız ad, yapı sonraki ekranda. -->
      <div v-else-if="step === 'form'" class="form">
        <label>{{ kindInfo.nameLabel }} <span class="req">*</span>
          <input ref="nameInput" v-model="name" type="text" :placeholder="kindInfo.placeholder" :disabled="!!progress.customerId" />
        </label>
        <p v-if="duplicate" class="hint warn">
          <i class="pi pi-exclamation-triangle" /> <span>"{{ duplicate.name }}" zaten kayıtlı. <NuxtLink :to="`/expert/firma/${duplicate.id}`">Firmayı aç</NuxtLink> ve oradan lokasyon ekleyin.</span>
        </p>
        <ExpertFirmLocationFields v-if="!kindInfo.hasTree" :draft="draft" />
        <p v-else class="hint info"><i class="pi pi-info-circle" /> Sonraki ekranda {{ kind === 'holding' ? 'şirketleri ve lokasyonlarını' : 'birimleri ve lokasyonları' }} tek yerden ekleyeceksiniz.</p>
      </div>

      <!-- 3: hazır -->
      <div v-else class="done">
        <div class="done-box"><i class="pi pi-check-circle" /><div><strong>{{ name.trim() }} hazır.</strong><span>{{ draft.name.trim() }} lokasyonu ve işyeri oluşturuldu.</span></div></div>
        <p class="next">Şimdi ne yapmak istersiniz?</p>
        <button class="primary-button full" type="button" @click="goEquipment"><i class="pi pi-wrench" /> Ekipman Ekle</button>
        <button class="secondary-button full" type="button" @click="openFirm"><i class="pi pi-map-marker" /> Başka Lokasyon Ekle</button>
        <button class="link-button" type="button" @click="emit('close')">Şimdilik bu kadar</button>
      </div>

      <p v-if="error" class="form-error" role="alert">{{ error }}</p>

      <div v-if="step !== 'done'" class="modal-actions">
        <button v-if="step === 'form' && !progress.customerId" class="secondary-button" type="button" :disabled="saving" @click="step = 'kind'; error = ''"><i class="pi pi-arrow-left" /> Geri</button>
        <button v-else class="secondary-button" type="button" :disabled="saving" @click="close">İptal</button>
        <button v-if="step === 'form'" class="primary-button" type="button" :disabled="!canSave || saving" @click="save">
          {{ saving ? 'Oluşturuluyor...' : kindInfo.hasTree ? 'Devam Et' : 'Firmayı Oluştur' }} <i v-if="!saving" class="pi pi-arrow-right" />
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { normalizeCompanyName } from '~/composables/useExpertApi'
import { FIRM_KINDS, type Firm, type FirmKind, type FirmProgress, type LocationDraft, type WorkplaceProgress } from '~/composables/useFirmSetup'

const props = defineProps<{ firms: Firm[] }>()
const emit = defineEmits<{ close: []; changed: [] }>()
const { createFirm, addWorkplace, workplaceLimitMessage } = useFirmSetup()
const { errorMessage } = useExpertApi()
const goToEquipment = useGoToEquipment()

const step = ref<'kind' | 'form' | 'done'>('kind')
const kind = ref<FirmKind>('limited')
const name = ref('')
const draft = reactive<LocationDraft>({ name: '', cityId: null, districtId: null, address: '', hazard: '', company: '' })
const saving = ref(false)
const error = ref('')
const nameInput = ref<HTMLInputElement | null>(null)
// Yarıda kalan kurulum: tekrar denenince yalnız kalan adım çalışır, aynı kayıt ikinci kez açılmaz.
const progress = reactive<FirmProgress>({})
const workplace = reactive<WorkplaceProgress>({})

const kindInfo = computed(() => FIRM_KINDS.find(k => k.id === kind.value)!)
const duplicate = computed(() => {
  if (progress.customerId) return null
  const key = normalizeCompanyName(name.value)
  return key ? props.firms.find(f => normalizeCompanyName(f.name) === key) || null : null
})
const limitFull = ref(false)
const canSave = computed(() => !limitFull.value && !!name.value.trim() && !duplicate.value && (kindInfo.value.hasTree || (!!draft.name.trim() && !!draft.cityId && !!draft.hazard)))
const title = computed(() => step.value === 'done' ? 'Firma hazır' : step.value === 'kind' ? 'Firma Ekle' : kindInfo.value.title)
const subtitle = computed(() => step.value === 'kind' ? 'Eklemek istediğiniz firmanın türünü seçin.' : step.value === 'form' ? 'Yalnız gerekli bilgileri soruyoruz.' : 'Firma listenize eklendi.')

// İşyeri hakkı doluysa form doldurtulmadan söylenir. Holding / kamu firması yine açılır; işyeri hakkı lokasyon eklerken gerekir.
async function pick(id: FirmKind) {
  kind.value = id
  step.value = 'form'
  error.value = ''
  nextTick(() => nameInput.value?.focus())
  limitFull.value = false
  if (!kindInfo.value.hasTree) {
    const message = await workplaceLimitMessage().catch(() => '')
    limitFull.value = !!message
    error.value = message
  }
}
function close() { if (!saving.value) emit('close') }

async function save() {
  if (!canSave.value) return
  saving.value = true
  error.value = ''
  try {
    if (!kindInfo.value.hasTree && !workplace.locationId) {
      const limit = await workplaceLimitMessage()
      if (limit) { error.value = limit; return }
    }
    const firm = await createFirm(kind.value, name.value.trim(), progress)
    if (kindInfo.value.hasTree) {
      emit('changed')
      await navigateTo(`/expert/firma/${firm.customerId}?yeni=1`)
      return
    }
    draft.company = name.value.trim()
    await addWorkplace(firm.customerId, firm.rootId, draft, kindInfo.value.type, workplace)
    emit('changed')
    step.value = 'done'
  } catch (e: any) {
    error.value = errorMessage(e, e?.message || 'Firma oluşturulamadı. Bağlantınızı kontrol edip tekrar deneyin.')
  } finally { saving.value = false }
}

const goEquipment = () => goToEquipment(workplace.locationId!)
const openFirm = () => navigateTo(`/expert/firma/${progress.customerId}?lokasyon=1`)
</script>

<style scoped>
.modal-backdrop { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 16px; background: var(--admin-overlay); }
.modal-card { width: min(560px, 100%); max-height: calc(100vh - 32px); overflow: auto; padding: 22px; border-radius: 14px; background: var(--admin-input); box-shadow: 0 20px 60px var(--admin-shadow); }
.modal-head { display: flex; align-items: center; gap: 13px; margin-bottom: 18px; }
.modal-head > div { flex: 1; min-width: 0; }
.modal-head h2 { margin: 0; color: var(--admin-heading); font-size: 19px; }
.modal-head p { margin: 3px 0 0; color: var(--admin-muted); font-size: 13px; }
.head-icon { flex: none; width: 44px; height: 44px; display: grid; place-items: center; border-radius: 11px; background: var(--pk-yellow); color: #111827; font-size: 19px; }
.close-button { flex: none; width: 36px; height: 36px; border: 0; border-radius: 8px; background: transparent; color: var(--admin-muted); cursor: pointer; }
.close-button:hover { background: var(--admin-hover); color: var(--admin-heading); }
.kinds { display: grid; gap: 10px; }
.kind { width: 100%; display: flex; align-items: center; gap: 14px; padding: 14px; border: 1px solid var(--admin-border); border-radius: 11px; background: var(--admin-input); color: var(--admin-heading); font: inherit; text-align: left; cursor: pointer; }
.kind:hover { border-color: #d7a900; background: var(--admin-accent-soft); }
.kind-icon { flex: none; width: 46px; height: 46px; display: grid; place-items: center; border-radius: 11px; font-size: 19px; }
.green .kind-icon { background: #dcfae6; color: #067647; } .blue .kind-icon { background: #d1e9ff; color: #175cd3; } .purple .kind-icon { background: #ebe9fe; color: #5925dc; } .orange .kind-icon { background: #fef0c7; color: #b54708; }
.kind-text { flex: 1; display: grid; gap: 2px; }
.kind-text strong { font-size: 14.5px; }
.kind-text small { color: var(--admin-muted); font-size: 12.5px; }
.form { display: grid; gap: 12px; }
.form > label { display: block; color: var(--admin-heading); font-size: 13px; font-weight: 600; }
label input, label select { margin-top: 6px; }
.form input { width: 100%; min-height: 44px; padding: 0 12px; border: 1px solid var(--admin-border); border-radius: 9px; outline: 0; background: var(--admin-input); color: var(--admin-heading); font: inherit; font-size: 14px; font-weight: 400; }
.form input:focus { border-color: #d7a900; box-shadow: 0 0 0 3px var(--admin-accent-soft); }
.req { color: #d92d20; }
.hint { display: flex; gap: 8px; margin: 0; padding: 10px 12px; border-radius: 9px; font-size: 13px; line-height: 1.45; }
.hint.warn { background: #fffaeb; color: #b54708; } .hint.warn a { font-weight: 700; text-decoration: underline; }
.hint.info { background: var(--admin-soft); color: var(--admin-muted); }
.form-error { margin: 14px 0 0; padding: 10px 12px; border-radius: 9px; background: #fef3f2; color: #b42318; font-size: 13px; }
.modal-actions { display: flex; justify-content: space-between; gap: 10px; margin-top: 18px; }
.primary-button, .secondary-button { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 16px; border-radius: 9px; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
.primary-button { border: 1px solid var(--pk-yellow); background: var(--pk-yellow); color: #111827; }
.primary-button:hover:not(:disabled) { background: var(--pk-yellow-dark); }
.primary-button:disabled { opacity: .5; cursor: default; }
.secondary-button { border: 1px solid var(--admin-border); background: var(--admin-input); color: var(--admin-heading); }
.full { width: 100%; }
.done { display: grid; gap: 10px; }
.done-box { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 11px; background: #ecfdf3; color: #027a48; }
.done-box > i { font-size: 24px; }
.done-box div { display: grid; gap: 2px; font-size: 13px; }
.done-box strong { font-size: 15px; }
.next { margin: 6px 0 0; color: var(--admin-heading); font-size: 14px; font-weight: 600; }
.link-button { min-height: 38px; border: 0; background: none; color: var(--admin-muted); font: inherit; font-size: 13px; cursor: pointer; text-decoration: underline; }
</style>
