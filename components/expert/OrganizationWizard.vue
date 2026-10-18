<template>
  <div class="modal-backdrop">
    <section class="modal-card wizard">
      <div class="modal-head">
        <div class="head-title">
          <span class="head-icon"><i class="pi pi-sitemap" /></span>
          <div>
            <h2>Organizasyon Ekle</h2>
            <p>Hizmet verdiğiniz şirketi, işletmeyi ya da kamu kurumunu birkaç adımda tanımlayın.</p>
          </div>
        </div>
        <button class="close-button" type="button" :disabled="saving" @click="emit('close')"><i class="pi pi-times" /></button>
      </div>

      <div class="layout">
        <!-- Adım listesi -->
        <ol class="stepper" aria-label="Adımlar">
          <li v-for="(n, i) in visibleSteps" :key="n" :class="{ on: step === n, done: step > n }">
            <span class="dot"><i :class="step > n ? 'pi pi-check' : STEPS[n - 1]!.icon" /></span>
            <span class="name">{{ STEPS[n - 1]!.name }}</span>
          </li>
          <li class="stepper-note"><i class="pi pi-info-circle" /> Lokasyonları ve firmaları organizasyonu oluşturduktan sonra eklersiniz.</li>
        </ol>

        <div class="content">
          <div class="step-head">
            <span class="step-icon"><i :class="STEPS[step - 1]!.icon" /></span>
            <div>
              <p class="step-count">Adım {{ visibleSteps.indexOf(step) + 1 }} / {{ visibleSteps.length }}</p>
              <h3>{{ STEPS[step - 1]!.title }}</h3>
              <p class="step-desc">{{ STEPS[step - 1]!.desc }}</p>
            </div>
          </div>

          <!-- 1: tür (müşteri türü olarak kaydedilir; sonraki sihirbazlar soruyu buna göre sorar) -->
          <div v-if="step === 1" class="cards">
            <button
              v-for="k in KINDS" :key="k.id" type="button" class="card" :class="{ on: kind === k.id }"
              :aria-pressed="kind === k.id" @click="kind = k.id"
            >
              <span class="card-icon"><i :class="k.icon" /></span>
              <span class="card-text">
                <strong>{{ k.title }}</strong>
                <small>{{ k.text }}</small>
                <em>{{ k.effect }}</em>
              </span>
              <i v-if="kind === k.id" class="pi pi-check-circle card-check" />
            </button>
          </div>

          <!-- 2: ad -->
          <div v-else-if="step === 2">
            <label>{{ current.nameLabel }} <span>*</span>
              <input ref="nameInput" v-model="name" type="text" :placeholder="current.namePlaceholder" @keydown.enter.prevent="next" />
            </label>
            <p class="hint"><i class="pi pi-lightbulb" /> {{ current.nameHint }}</p>
            <p class="hint"><i class="pi pi-eye" /> Bu ad listelerde, raporlarda ve işyerlerinin üstünde görünür.</p>
          </div>

          <!-- 3: alt organizasyonlar (isteğe bağlı, iki düzey) -->
          <div v-else-if="step === 3">
            <p class="hint"><i class="pi pi-lightbulb" /> {{ current.childHint }}</p>
            <div class="child-tree">
              <div class="tree-root"><span class="tree-icon"><i :class="current.icon" /></span> {{ name.trim() }}</div>
              <div v-for="(child, i) in children" :key="child.key" class="child">
                <div class="child-row">
                  <i class="pi pi-angle-right" />
                  <input v-model="child.name" type="text" :placeholder="current.childPlaceholder" />
                  <button class="icon-button" type="button" title="Altına bir düzey ekle" @click="addGrandchild(child)"><i class="pi pi-plus" /></button>
                  <button class="icon-button danger" type="button" title="Kaldır" @click="children.splice(i, 1)"><i class="pi pi-trash" /></button>
                </div>
                <div v-for="(g, j) in child.children" :key="g.key" class="child-row grand">
                  <i class="pi pi-angle-right" />
                  <input v-model="g.name" type="text" :placeholder="current.grandPlaceholder" />
                  <button class="icon-button danger" type="button" title="Kaldır" @click="child.children.splice(j, 1)"><i class="pi pi-trash" /></button>
                </div>
              </div>
              <button class="add-row" type="button" @click="addChild"><i class="pi pi-plus" /> Alt organizasyon ekle</button>
            </div>
            <p class="hint muted"><i class="pi pi-info-circle" /> <span><strong>+</strong> düğmesi satırın altına bir düzey daha açar. Alt organizasyon şart değildir; sonra "Yapıyı yönet" düğmesinden de ekleyebilirsiniz.</span></p>
          </div>

          <!-- 4: özet -->
          <div v-else>
            <div class="summary">
              <div class="sum-kind"><i :class="current.icon" /> {{ current.title }}</div>
              <div class="tree-root"><span class="tree-icon"><i :class="current.icon" /></span> {{ name.trim() }}</div>
              <template v-for="child in cleanChildren" :key="child.key">
                <div class="sum-row"><i class="pi pi-angle-right" /> {{ child.name }}</div>
                <div v-for="g in child.children" :key="g.key" class="sum-row grand"><i class="pi pi-angle-right" /> {{ g.name }}</div>
              </template>
              <p v-if="!cleanChildren.length" class="muted">Alt organizasyon yok.</p>
            </div>
            <div class="next-steps">
              <strong><i class="pi pi-directions" /> Sonra ne yapacaksınız?</strong>
              <ol>
                <li><b>Lokasyonlar</b> sayfasından bu organizasyona lokasyon (adres, bina, tesis) ekleyin.</li>
                <li>Lokasyonda <b>Lokasyona Firma Tanımla</b> ile işyerini tanımlayın (faaliyet, tehlike sınıfı, çalışan sayısı).</li>
                <li>İşyerine periyodik kontrol ekipmanlarını ekleyin.</li>
              </ol>
            </div>
          </div>

          <p v-if="error" class="form-error">{{ error }}</p>
        </div>
      </div>

      <div class="modal-actions">
        <button v-if="step > 1" class="secondary-button" type="button" :disabled="saving" @click="back"><i class="pi pi-arrow-left" /> Geri</button>
        <button v-else class="secondary-button" type="button" @click="emit('close')">İptal</button>
        <button v-if="step === 3 && !cleanChildren.length" class="secondary-button" type="button" @click="step = 4">Atla</button>
        <button v-if="step < 4" class="primary-button" type="button" :disabled="!canNext" @click="next">İleri <i class="pi pi-arrow-right" /></button>
        <button v-else class="primary-button" type="button" :disabled="saving" @click="create"><i class="pi pi-check" /> {{ saving ? 'Oluşturuluyor...' : 'Oluştur' }}</button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { CustomerType } from '~/composables/useCustomerTypes'
// Bireysel uzmanın "Organizasyon Ekle" sihirbazı: tür → ad → alt organizasyonlar → özet. Mevcut uçlar sırayla çağrılır
// (müşteri, aynı adla kök organizasyon, alt organizasyonlar); OSGB'de müşteri eklerken açılan kökle aynı yöntem.
// 1. adımdaki tür müşterinin türüdür (ekranda "organizasyon" denir; kullanıcı 18 Ekim 2026): pk-customer-types ile kaydedilir,
// "Lokasyona Firma Ata" sihirbazı soruyu buna göre sorar. Şahıs işletmesinde alt organizasyon adımı yok (şubeler lokasyondur).
const emit = defineEmits<{ close: []; created: [customerId: number | string, warning: string] }>()

type Kind = 'kurumsal' | 'sahis' | 'kamu'
interface Grand { key: number; name: string }
interface Child { key: number; name: string; children: Grand[] }

const KINDS: { id: Kind; title: string; text: string; effect: string; icon: string; nameLabel: string; namePlaceholder: string; nameHint: string; childHint: string; childPlaceholder: string; grandPlaceholder: string }[] = [
  {
    id: 'kurumsal', title: 'Kurumsal firma', text: 'Şirket, holding ya da grup şirketleri.', icon: 'pi pi-building',
    effect: 'Lokasyonlara işyeri tanımlarken hangi şirkete ait olduğu (ana firma ya da grup şirketi) sorulur.',
    nameLabel: 'Firma ünvanı', namePlaceholder: 'Örn. Örnek Holding A.Ş.', nameHint: 'Grup şirketleri varsa en üstteki adı yazın (holding ya da ana şirket).',
    childHint: 'Grupları, şirketleri, fabrikaları, şubeleri ya da bölge müdürlüklerini ekleyebilirsiniz.', childPlaceholder: 'Örn. Enerji Grubu', grandPlaceholder: 'Örn. Enerji Santrali'
  },
  {
    id: 'sahis', title: 'Şahıs işletmesi', text: 'Tek kişiye ait işletme.', icon: 'pi pi-user',
    effect: 'Alt organizasyon sorulmaz; her lokasyon işletmenin bir şubesi olur.',
    nameLabel: 'İşletme adı', namePlaceholder: 'Örn. ABC Mobilya', nameHint: 'Tabelada ya da vergi levhasında geçen adı yazabilirsiniz.',
    childHint: 'Birden fazla şubesi varsa şubeleri ekleyebilirsiniz.', childPlaceholder: 'Örn. Merkez Şube', grandPlaceholder: 'Örn. Atölye'
  },
  {
    id: 'kamu', title: 'Kamu kurumu', text: 'Belediye, il müdürlüğü, hastane, okul.', icon: 'pi pi-flag',
    effect: 'Daire başkanlığı, müdürlük gibi birimler alt organizasyon olur; işyeri tanımlarken firma sorulmaz.',
    nameLabel: 'Kurum adı', namePlaceholder: 'Örn. ABC Belediyesi', nameHint: 'Kurumun resmî adını yazın.',
    childHint: 'Daire başkanlıklarını, müdürlükleri ya da bağlı birimleri ekleyebilirsiniz.', childPlaceholder: 'Örn. İtfaiye Dairesi Başkanlığı', grandPlaceholder: 'Örn. Merkez İtfaiye Müdürlüğü'
  }
]
const STEPS = [
  { name: 'Tür', icon: 'pi pi-tags', title: 'Organizasyonun türü nedir?', desc: 'Türe göre sonraki adımlar ve işyeri tanımlarken sorulan sorular değişir. Bir kez seçilir.' },
  { name: 'Ad', icon: 'pi pi-pencil', title: 'Organizasyonun adı nedir?', desc: 'Organizasyon yapısının en üstünde bu ad durur.' },
  { name: 'Alt organizasyonlar', icon: 'pi pi-sitemap', title: 'Alt organizasyonları var mı?', desc: 'İsteğe bağlıdır. Büyük yapılarda birimleri gruplamak, raporları ve listeleri birime göre ayırmak için kullanılır.' },
  { name: 'Özet', icon: 'pi pi-list-check', title: 'Kontrol edip oluşturun', desc: 'Aşağıdaki yapı oluşturulacak. Geri dönüp değiştirebilirsiniz.' }
]

const config = useRuntimeConfig()
const { authHeaders, user } = useAuth()
const headers = () => ({ ...authHeaders(), ...(user.value?.tenant_id ? { 'X-Tenant-ID': String(user.value.tenant_id) } : {}) })
const unwrap = (response: any) => response?.data?.data ?? response?.data ?? response

const step = ref(1)
const kind = ref<Kind | null>(null)
const name = ref('')
const children = ref<Child[]>([])
const saving = ref(false)
const error = ref('')
const nameInput = ref<HTMLInputElement | null>(null)
let seq = 0

const current = computed(() => KINDS.find(k => k.id === kind.value) || KINDS[0]!)
const cleanChildren = computed(() => kind.value === 'sahis' ? [] : children.value
  .filter(c => c.name.trim())
  .map(c => ({ ...c, name: c.name.trim(), children: c.children.filter(g => g.name.trim()).map(g => ({ ...g, name: g.name.trim() })) })))
// Şahıs işletmesi tek kişiye ait tek yapı: alt organizasyon sorulmaz (şubeler lokasyon olarak eklenir; kullanıcı 18 Ekim 2026).
const skipChildren = computed(() => kind.value === 'sahis')
const visibleSteps = computed(() => skipChildren.value ? [1, 2, 4] : [1, 2, 3, 4])
const canNext = computed(() => step.value === 1 ? !!kind.value : step.value === 2 ? !!name.value.trim() : true)

function back() {
  error.value = ''
  step.value = step.value === 4 && skipChildren.value ? 2 : step.value - 1
}
const addChild = () => children.value.push({ key: ++seq, name: '', children: [] })
const addGrandchild = (child: Child) => child.children.push({ key: ++seq, name: '' })

function next() {
  if (!canNext.value) return
  error.value = ''
  step.value = step.value === 2 && skipChildren.value ? 4 : step.value + 1
  if (step.value === 2) nextTick(() => nameInput.value?.focus())
  if (step.value === 3 && !children.value.length) addChild()
}

// Sihirbazın türü → müşteri türü (backend: pk-customer-types).
const KIND_TO_TYPE: Record<Kind, CustomerType> = { kurumsal: 'corporate', sahis: 'individual', kamu: 'public' }
const { save: saveCustomerType } = useCustomerTypes()
const post = (path: string, body: Record<string, unknown>) =>
  $fetch(`${config.public.apiBaseUrl}${path}`, { method: 'POST', headers: headers(), body }).then(unwrap)

async function create() {
  saving.value = true
  error.value = ''
  const title = name.value.trim()
  let customerId: number | string | null = null
  try {
    customerId = (await post('/customers', { name: title, notes: null }))?.id
    if (!customerId) throw new Error('Organizasyon oluşturulamadı.')
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Organizasyon oluşturulamadı.'
    saving.value = false
    return
  }
  const missing: string[] = []
  let typeWarning = ''
  try { await saveCustomerType(customerId, KIND_TO_TYPE[kind.value!]) } catch { typeWarning = ' Türü kaydedilemedi; ilk firma atamasında yeniden sorulur.' }
  // Kök (aynı ad) ve alt organizasyonlar; biri eklenemezse kalanlar yine denenir, kullanıcıya hangileri eksik söylenir.
  const org = (body: Record<string, unknown>) => post(`/customers/${customerId}/organizations`, { color: '#465FFF', ...body }).then(r => r?.id)
  let rootId: number | string | null = null
  try { rootId = await org({ name: title, parent_id: null }) } catch { missing.push(title) }
  if (rootId) {
    for (const child of cleanChildren.value) {
      let childId: number | string | null = null
      try { childId = await org({ name: child.name, parent_id: rootId }) } catch { missing.push(child.name) }
      for (const g of child.children) {
        if (!childId) { missing.push(g.name); continue }
        try { await org({ name: g.name, parent_id: childId }) } catch { missing.push(g.name) }
      }
    }
  }
  saving.value = false
  emit('created', customerId, (missing.length
    ? `"${title}" oluşturuldu ama şunlar eklenemedi: ${missing.join(', ')}. Yapıyı yönet düğmesinden ekleyebilirsiniz.`
    : '') + (typeWarning ? (missing.length ? typeWarning : `"${title}" oluşturuldu.${typeWarning}`) : ''))
}
</script>

<style scoped>
.modal-backdrop{position:fixed;inset:0;z-index:100;background:var(--admin-overlay);display:grid;place-items:center;padding:20px}
.modal-card{width:min(860px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:24px 26px;background:var(--admin-input);border-radius:14px;box-shadow:0 20px 60px var(--admin-shadow)}
.modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:20px}
.head-title{display:flex;align-items:center;gap:14px}
.head-icon{flex:none;width:46px;height:46px;display:grid;place-items:center;border-radius:12px;background:var(--pk-yellow);color:#111827;font-size:20px}
.modal-head h2{margin:0;color:var(--admin-heading);font-size:19px}
.modal-head p{margin:5px 0 0;color:var(--admin-muted);font-size:12.5px}
.close-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:var(--admin-muted);cursor:pointer;border-radius:7px}.close-button:hover{background:var(--admin-hover);color:var(--admin-heading)}
.layout{display:grid;grid-template-columns:200px minmax(0,1fr);gap:24px}
.stepper{list-style:none;margin:0;padding:14px 12px;border-radius:12px;background:var(--admin-soft);display:flex;flex-direction:column;gap:4px;align-self:start}
.stepper li{display:flex;align-items:center;gap:10px;padding:8px;border-radius:8px;color:var(--admin-muted);font-size:12.5px;font-weight:600}
.stepper li.on{background:var(--admin-accent-soft);color:var(--admin-heading)}
.stepper .dot{flex:none;width:28px;height:28px;display:grid;place-items:center;border-radius:50%;background:var(--admin-input);border:1px solid var(--admin-border);font-size:12px}
.stepper li.on .dot{background:var(--pk-yellow);border-color:var(--pk-yellow);color:#111827}
.stepper li.done .dot{background:#12b76a;border-color:#12b76a;color:#fff}
.stepper .stepper-note{align-items:flex-start;margin-top:10px;padding:10px 8px 2px;border-top:1px dashed var(--admin-border);font-size:11.5px;font-weight:500;line-height:1.5}
.stepper-note .pi{margin-top:2px}
.content{min-width:0}
.step-head{display:flex;gap:14px;margin-bottom:18px}
.step-icon{flex:none;width:44px;height:44px;display:grid;place-items:center;border-radius:11px;background:var(--admin-chip);color:var(--admin-heading);font-size:19px}
.step-count{margin:0 0 3px;color:var(--admin-muted);font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
h3{margin:0;color:var(--admin-heading);font-size:17px;line-height:1.3}
.step-desc{margin:6px 0 0;color:var(--admin-muted);font-size:12.5px;line-height:1.55}
.cards{display:grid;gap:10px}
.card{position:relative;display:flex;align-items:flex-start;gap:14px;padding:15px 16px;border:1px solid var(--admin-border);border-radius:11px;background:var(--admin-input);text-align:left;cursor:pointer;font:inherit;transition:border-color .15s ease, background .15s ease}
.card:hover{border-color:#d7a900}.card.on{border-color:#d7a900;background:var(--admin-accent-soft);box-shadow:0 0 0 3px rgba(255,193,7,.12)}
.card-icon{flex:none;width:44px;height:44px;display:grid;place-items:center;border-radius:10px;background:var(--admin-chip);color:var(--admin-heading);font-size:18px}
.card.on .card-icon{background:var(--pk-yellow);color:#111827}
.card-text{display:flex;flex-direction:column;gap:4px;padding-right:24px}.card-text strong{color:var(--admin-heading);font-size:14px}.card-text small{color:var(--admin-muted);font-size:12.5px}
.card-text em{margin-top:2px;color:var(--admin-text);font-size:12px;font-style:normal;line-height:1.45}
.card-check{position:absolute;top:14px;right:14px;color:#b58900;font-size:17px}
label{display:block;margin-bottom:12px;color:var(--admin-heading);font-size:12px;font-weight:700}label span{color:var(--admin-danger-text)}
input{width:100%;height:44px;padding:0 12px;border:1px solid var(--admin-border);border-radius:9px;outline:0;font:inherit;font-size:13px;color:var(--admin-heading);background:var(--admin-input)}
label input{margin-top:7px}
input:focus{border-color:#d7a900;box-shadow:0 0 0 3px rgba(255,193,7,.12)}
.hint{display:flex;gap:8px;margin:0 0 10px;color:var(--admin-text);font-size:12.5px;line-height:1.55}.hint .pi{margin-top:3px;color:var(--admin-muted)}
.hint.muted{margin-top:14px;color:var(--admin-muted)}
.child-tree,.summary{display:grid;gap:8px}
.tree-root{display:flex;align-items:center;gap:9px;font-weight:800;color:var(--admin-heading);font-size:14px}
.tree-icon{width:28px;height:28px;display:grid;place-items:center;border-radius:8px;background:var(--pk-yellow);color:#111827;font-size:13px}
.child{display:grid;gap:8px}
.child-row{display:flex;align-items:center;gap:8px;padding-left:16px}.child-row.grand{padding-left:44px}
.child-row > .pi{color:var(--admin-muted);font-size:12px}
.icon-button{flex:none;width:40px;height:40px;display:grid;place-items:center;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-muted);cursor:pointer}
.icon-button:hover{border-color:#d7a900;color:var(--admin-heading);background:var(--admin-accent-soft)}
.icon-button.danger:hover{border-color:var(--admin-danger-text);color:var(--admin-danger-text);background:var(--admin-danger-bg)}
.add-row{justify-self:start;margin-left:16px;display:inline-flex;align-items:center;gap:7px;padding:9px 13px;border:1px dashed var(--admin-border);border-radius:9px;background:transparent;color:var(--admin-heading);font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}
.add-row:hover{border-color:#d7a900;background:var(--admin-accent-soft)}
.summary{padding:16px 18px;border:1px solid var(--admin-border);border-radius:11px;background:var(--admin-soft)}
.sum-kind{justify-self:start;display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:var(--admin-chip);color:var(--admin-text);font-size:11.5px;font-weight:700}
.sum-row{display:flex;align-items:center;gap:8px;padding-left:16px;color:var(--admin-heading);font-size:13px}.sum-row.grand{padding-left:44px}.sum-row .pi{color:var(--admin-muted);font-size:12px}
.muted{margin:0;color:var(--admin-muted);font-size:12.5px}
.next-steps{margin-top:14px;padding:14px 16px;border-radius:11px;background:var(--admin-accent-soft);color:var(--admin-text);font-size:12.5px;line-height:1.55}
.next-steps strong{display:flex;align-items:center;gap:7px;color:var(--admin-heading);font-size:13px}
.next-steps ol{margin:8px 0 0;padding-left:20px;display:grid;gap:4px}.next-steps b{color:var(--admin-heading)}
.form-error{margin:12px 0 0;color:var(--admin-danger-text);font-size:12.5px}
.modal-actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:10px;margin-top:20px;padding-top:16px;border-top:1px solid var(--admin-border)}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:0 20px;border:0;border-radius:9px;background:var(--pk-yellow);color:#111827;font-size:13px;font-weight:800;cursor:pointer}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.secondary-button{display:inline-flex;align-items:center;gap:7px;min-height:42px;padding:0 18px;border:1px solid var(--admin-border);border-radius:9px;background:var(--admin-hover);color:var(--admin-heading);font-size:12.5px;font-weight:700;cursor:pointer}
@media(max-width:760px){
  .layout{grid-template-columns:minmax(0,1fr)}
  .stepper{flex-direction:row;padding:8px;gap:6px}
  .stepper .name,.stepper .stepper-note{display:none}
}
</style>
