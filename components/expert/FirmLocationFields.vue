<template>
  <div class="fields">
    <template v-if="!companyOnly">
    <label>Lokasyonun adı <span class="req">*</span>
      <input ref="nameInput" v-model="draft.name" type="text" placeholder="Örn. Merkez, Fabrika, Şube" />
    </label>
    <p class="hint">Firmanın çalıştığı yer. Tek yeri varsa "Merkez" yazabilirsiniz.</p>

    <div class="row">
      <label>İl <span class="req">*</span>
        <select v-model="draft.cityId" @change="onCity">
          <option :value="null" disabled>İl seçin</option>
          <option v-for="c in cities" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>
      <label>İlçe
        <select v-model="draft.districtId" :disabled="!draft.cityId">
          <option :value="null">İlçe seçin</option>
          <option v-for="d in districts" :key="d.id" :value="d.id">{{ d.name }}</option>
        </select>
      </label>
    </div>
    </template>

    <label v-if="showCompany">Burada hangi firma çalışıyor? <span class="req">*</span>
      <input ref="companyInput" v-model="draft.company" type="text" list="firm-location-companies" placeholder="Örn. ABC Enerji A.Ş." />
      <datalist id="firm-location-companies"><option v-for="n in allCompanyNames" :key="n" :value="n" /></datalist>
    </label>

    <!-- NACE isteğe bağlı: seçilirse tehlike sınıfı kendiliğinden gelir, değiştirilebilir. -->
    <template v-if="!locationOnly">
    <div class="nace">
      <label>Ne iş yapıyor? <small>(isteğe bağlı)</small>
        <input v-model="naceQuery" type="text" placeholder="Faaliyeti ya da NACE kodunu yazın: lokanta, 56.10" autocomplete="off" @input="searchNace" />
      </label>
      <ul v-if="naceResults.length" class="nace-results" aria-label="NACE sonuçları">
        <li v-for="item in naceResults" :key="item.id">
          <button type="button" @click="selectNace(item)"><strong>{{ item.nace_code }}</strong> <span>{{ item.activity_name }}</span> <em :class="hazardClassKey(item.hazard_class)">{{ item.hazard_class }}</em></button>
        </li>
      </ul>
      <p v-if="draft.naceCode" class="selected"><i class="pi pi-check-circle" /> <span><strong>{{ draft.naceCode }}</strong> {{ draft.activity }}</span> <button type="button" class="clear" @click="clearNace">Kaldır</button></p>
    </div>

    <div class="hazard">
      <span class="question">Tehlike sınıfı <span class="req">*</span></span>
      <p class="hint hazard-hint">Firmanın burada yaptığı işe göre seçin. Yukarıdan faaliyet seçerseniz kendiliğinden gelir.</p>
      <div class="hazard-options" role="radiogroup" aria-label="Tehlike sınıfı">
        <button
          v-for="h in HAZARD_CLASSES" :key="h" type="button" role="radio" :aria-checked="draft.hazard === h"
          class="hazard-option" :class="[hazardClassKey(h), { on: draft.hazard === h }]" @click="draft.hazard = h"
        >{{ h }}</button>
      </div>
    </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// Lokasyon formu: Firma Ekle ve firma sayfası aynı alanları kullanır. Backend'de zorunlu olan tek işyeri bilgisi tehlike
// sınıfıdır ve varsayılan verilmez (yanlış sınıf ceza hesabını bozar). NACE isteğe bağlıdır, seçilirse sınıfı doldurur (kullanıcı 1 Kasım 2026).
import { HAZARD_CLASSES, hazardClassKey, useExpertApi, type MyCompany, type NaceItem } from '~/composables/useExpertApi'
import type { LocationDraft } from '~/composables/useFirmSetup'

const props = defineProps<{ draft: LocationDraft; showCompany?: boolean; autofocus?: boolean; companyOnly?: boolean; locationOnly?: boolean; suggestions?: string[]; excluded?: string[] }>()
const { get } = useExpertApi()
const unwrap = (r: any) => r?.data?.data ?? r?.data ?? r ?? []
const cities = ref<{ id: number; name: string }[]>([])
const districts = ref<{ id: number; name: string }[]>([])
const companyNames = ref<string[]>([])
const nameInput = ref<HTMLInputElement | null>(null)
const companyInput = ref<HTMLInputElement | null>(null)
const allCompanyNames = computed(() => [...new Set([...(props.suggestions || []), ...companyNames.value])].filter(n => !props.excluded?.includes(n)))

const naceQuery = ref('')
const naceResults = ref<NaceItem[]>([])
let naceTimer: ReturnType<typeof setTimeout> | undefined
function searchNace() {
  clearTimeout(naceTimer)
  const q = naceQuery.value.trim()
  if (q.length < 2) { naceResults.value = []; return }
  naceTimer = setTimeout(async () => {
    try { naceResults.value = await get<NaceItem[]>('/nace-hazard-classes', { search: q }) } catch { naceResults.value = [] }
  }, 250)
}
function selectNace(item: NaceItem) {
  props.draft.naceCode = item.nace_code
  props.draft.activity = item.activity_name
  props.draft.hazard = item.hazard_class
  naceQuery.value = ''
  naceResults.value = []
}
function clearNace() { props.draft.naceCode = null; props.draft.activity = null }

async function onCity() {
  props.draft.districtId = null
  districts.value = []
  if (!props.draft.cityId) return
  try { districts.value = unwrap(await get(`/cities/${props.draft.cityId}/districts`)) } catch { districts.value = [] }
}

onMounted(async () => {
  if (props.autofocus) nextTick(() => (props.companyOnly ? companyInput : nameInput).value?.focus())
  if (!props.companyOnly) {
    try { cities.value = unwrap(await get('/cities')) } catch { cities.value = [] }
  }
  if (props.showCompany) {
    try { companyNames.value = (await get<MyCompany[]>('/my-companies')).map(c => c.name) } catch { companyNames.value = [] }
  }
})
</script>

<style scoped>
.fields { display: grid; gap: 12px; }
label { display: block; color: var(--admin-heading); font-size: 13px; font-weight: 600; }
label input, label select { margin-top: 6px; }
.req { color: #d92d20; }
input, select { width: 100%; min-height: 44px; padding: 0 12px; border: 1px solid var(--admin-border); border-radius: 9px; outline: 0; background: var(--admin-input); color: var(--admin-heading); font: inherit; font-size: 14px; font-weight: 400; }
input:focus, select:focus { border-color: #d7a900; box-shadow: 0 0 0 3px var(--admin-accent-soft); }
select:disabled { opacity: .55; }
.hint { margin: -6px 0 0; color: var(--admin-muted); font-size: 12px; }
.hazard-hint { margin: -2px 0 8px; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
label small { color: var(--admin-muted); font-weight: 400; }
.nace-results { max-height: 190px; overflow: auto; margin: 6px 0 0; padding: 4px; list-style: none; border: 1px solid var(--admin-border); border-radius: 9px; background: var(--admin-input); }
.nace-results button { width: 100%; min-height: 40px; padding: 7px 9px; border: 0; border-radius: 7px; background: none; color: var(--admin-heading); font: inherit; font-size: 13px; text-align: left; cursor: pointer; }
.nace-results button:hover { background: var(--admin-accent-soft); }
.nace-results em { margin-left: 4px; color: var(--admin-muted); font-size: 12px; font-style: normal; font-weight: 600; }
.selected { display: flex; align-items: center; gap: 8px; margin: 8px 0 0; padding: 8px 10px; border-radius: 8px; background: #ecfdf3; color: #027a48; font-size: 13px; }
.selected span { flex: 1; }
.clear { border: 0; background: none; color: inherit; font: inherit; font-size: 12.5px; font-weight: 700; text-decoration: underline; cursor: pointer; }
.question { display: block; margin-bottom: 6px; color: var(--admin-heading); font-size: 13px; font-weight: 600; }
.hazard-options { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.hazard-option { min-height: 46px; border: 1px solid var(--admin-border); border-radius: 9px; background: var(--admin-input); color: var(--admin-heading); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.hazard-option:hover { border-color: #d7a900; }
.hazard-option.on.low { background: #ecfdf3; border-color: #12b76a; color: #027a48; }
.hazard-option.on.high { background: #fffaeb; border-color: #f79009; color: #b54708; }
.hazard-option.on.very-high { background: #fef3f2; border-color: #d92d20; color: #b42318; }
@media (max-width: 560px) { .row, .hazard-options { grid-template-columns: 1fr; } }
</style>
