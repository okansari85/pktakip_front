<template>
  <div class="firm-page">
    <div class="page-head">
      <div>
        <h1>Firmalarım</h1>
        <p>Hizmet verdiğiniz firmaları buradan ekleyin ve yönetin.</p>
      </div>
      <button class="primary-button" type="button" @click="wizardOpen = true"><i class="pi pi-plus-circle" /> Firma Ekle</button>
    </div>

    <div v-if="firms.length" class="stats">
      <div class="stat"><span class="stat-icon blue"><i class="pi pi-building" /></span><div><small>Toplam Firma</small><strong>{{ firms.length }}</strong></div></div>
      <div class="stat"><span class="stat-icon green"><i class="pi pi-map-marker" /></span><div><small>Toplam Lokasyon</small><strong>{{ locationTotal }}</strong></div></div>
    </div>

    <section class="card">
      <div v-if="loading" class="state">Firmalar yükleniyor...</div>
      <div v-else-if="error" class="state error">
        {{ error }}
        <button class="secondary-button" type="button" @click="load">Tekrar Dene</button>
      </div>
      <div v-else-if="!firms.length" class="empty">
        <span class="empty-icon"><i class="pi pi-building" /></span>
        <strong>Henüz firmanız yok</strong>
        <span>İlk firmanızı ekleyin; birkaç soruyla hazır olur.</span>
        <button class="primary-button" type="button" @click="wizardOpen = true"><i class="pi pi-plus-circle" /> İlk Firmamı Ekle</button>
      </div>
      <template v-else>
        <div class="toolbar">
          <label class="search"><i class="pi pi-search" /><span class="sr-only">Firma ara</span><input v-model="search" type="text" placeholder="Firma adı ile ara..." /></label>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Firma Adı</th><th>Firma Türü</th><th class="num">Lokasyon</th><th class="num">İşyeri</th><th class="end"><span class="sr-only">İşlem</span></th></tr></thead>
            <tbody>
              <tr v-for="firm in filtered" :key="firm.id" tabindex="0" @click="open(firm)" @keydown.enter="open(firm)">
                <td><div class="name"><span class="avatar" :style="{ background: colorOf(firm.name) }">{{ initials(firm.name) }}</span><strong>{{ firm.name }}</strong></div></td>
                <td><span v-if="firm.type" class="chip" :class="firm.type">{{ customerTypeLabel(firm.type) }}</span><span v-else class="muted">—</span></td>
                <td class="num">{{ firm.locations_count }}</td>
                <td class="num">{{ firm.workplaces_count }}</td>
                <td class="end"><span class="open-link">Aç <i class="pi pi-angle-right" /></span></td>
              </tr>
              <tr v-if="!filtered.length"><td colspan="5" class="state">Aramanızla eşleşen firma yok.</td></tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>

    <ExpertFirmWizard v-if="wizardOpen" :firms="firms" @close="wizardOpen = false" @changed="load" />
  </div>
</template>

<script setup lang="ts">
import { customerTypeLabel } from '~/composables/useCustomerTypes'
import type { Firm } from '~/composables/useFirmSetup'

const { listFirms } = useFirmSetup()
const { errorMessage } = useExpertApi()
const firms = ref<Firm[]>([])
const loading = ref(true)
const error = ref('')
const search = ref('')
const wizardOpen = ref(false)

const locationTotal = computed(() => firms.value.reduce((sum, f) => sum + f.locations_count, 0))
const filtered = computed(() => {
  const q = search.value.trim().toLocaleLowerCase('tr-TR')
  return q ? firms.value.filter(f => f.name.toLocaleLowerCase('tr-TR').includes(q)) : firms.value
})
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toLocaleUpperCase('tr-TR')
const COLORS = ['#f79009', '#12b76a', '#2e90fa', '#7a5af8', '#0e7090', '#c11574', '#b54708', '#3538cd']
const colorOf = (name: string) => COLORS[[...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % COLORS.length]
const open = (firm: Firm) => navigateTo(`/expert/firma/${firm.id}`)

async function load() {
  error.value = ''
  try { firms.value = await listFirms() }
  catch (e: any) { error.value = errorMessage(e, 'Firmalar alınamadı.') }
  finally { loading.value = false }
}
onMounted(load)
</script>

<style scoped>
.firm-page { max-width: 1500px; margin: 0 auto; }
.page-head { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; }
h1 { margin: 0; color: var(--admin-heading); font-size: 30px; letter-spacing: -.7px; }
.page-head p { margin: 6px 0 0; color: var(--admin-muted); font-size: 14px; }
.primary-button, .secondary-button { min-height: 46px; display: inline-flex; align-items: center; justify-content: center; gap: 9px; padding: 0 18px; border-radius: 10px; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
.primary-button { border: 1px solid var(--pk-yellow); background: var(--pk-yellow); color: #111827; }
.primary-button:hover { background: var(--pk-yellow-dark); }
.secondary-button { min-height: 38px; border: 1px solid var(--admin-border); background: var(--admin-input); color: var(--admin-heading); }
.stats { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 16px; }
.stat { min-width: 220px; display: flex; align-items: center; gap: 14px; padding: 14px 18px; border: 1px solid var(--admin-border); border-radius: 12px; background: var(--admin-card, var(--admin-input)); }
.stat small { display: block; color: var(--admin-muted); font-size: 12.5px; }
.stat strong { color: var(--admin-heading); font-size: 24px; }
.stat-icon { width: 46px; height: 46px; display: grid; place-items: center; border-radius: 11px; font-size: 20px; }
.stat-icon.blue { background: #d1e9ff; color: #175cd3; } .stat-icon.green { background: #dcfae6; color: #067647; }
.card { border: 1px solid var(--admin-border); border-radius: 12px; background: var(--admin-card, var(--admin-input)); overflow: hidden; }
.toolbar { padding: 14px; border-bottom: 1px solid var(--admin-border); }
.search { position: relative; display: block; max-width: 420px; }
.search i { position: absolute; left: 13px; top: 14px; color: var(--admin-muted); }
.search input { width: 100%; min-height: 42px; padding: 0 12px 0 36px; border: 1px solid var(--admin-border); border-radius: 9px; outline: 0; background: var(--admin-input); color: var(--admin-heading); font: inherit; font-size: 14px; }
.search input:focus { border-color: #d7a900; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.table-wrap { position: relative; overflow-x: auto; }
table { width: 100%; min-width: 640px; border-collapse: collapse; }
th { padding: 11px 16px; background: var(--admin-soft); color: var(--admin-muted); font-size: 12.5px; font-weight: 700; text-align: left; }
td { padding: 12px 16px; border-top: 1px solid var(--admin-border); color: var(--admin-heading); font-size: 14px; }
tbody tr[tabindex] { cursor: pointer; }
tbody tr[tabindex]:hover, tbody tr[tabindex]:focus-visible { outline: 0; background: var(--admin-accent-soft); }
.num { text-align: center; } .end { text-align: right; }
.name { display: flex; align-items: center; gap: 12px; }
.avatar { flex: none; width: 36px; height: 36px; display: grid; place-items: center; border-radius: 50%; color: #fff; font-size: 12.5px; font-weight: 700; }
.chip { display: inline-block; padding: 4px 10px; border-radius: 7px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.chip.corporate { background: #d1e9ff; color: #175cd3; } .chip.individual { background: #dcfae6; color: #067647; } .chip.public { background: #fef0c7; color: #b54708; }
.muted { color: var(--admin-muted); }
.open-link { color: var(--admin-heading); font-size: 13px; font-weight: 700; white-space: nowrap; }
.state { padding: 34px 16px; color: var(--admin-muted); text-align: center; font-size: 14px; }
.state.error { display: grid; justify-items: center; gap: 12px; color: #b42318; }
.empty { display: grid; justify-items: center; gap: 8px; padding: 56px 16px; color: var(--admin-muted); text-align: center; font-size: 14px; }
.empty strong { color: var(--admin-heading); font-size: 18px; }
.empty .primary-button { margin-top: 10px; }
.empty-icon { width: 64px; height: 64px; display: grid; place-items: center; border-radius: 16px; background: var(--admin-accent-soft); color: var(--admin-heading); font-size: 26px; }
@media (max-width: 560px) { h1 { font-size: 25px; } .page-head .primary-button { width: 100%; } .stat { flex: 1; min-width: 150px; } }
</style>
