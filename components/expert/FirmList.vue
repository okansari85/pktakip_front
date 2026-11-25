<template>
  <div class="firm-page">
    <!-- Firmalarım (Behance CRM tasarımı): başlık + Firma ekle, sayılar ve öne çıkan firma; altta liste -->
    <div class="page-head">
      <div>
        <nav class="crumb" aria-label="Sayfa yolu">
          <PkIcon class="pi pi-home" aria-hidden="true" />
          <!-- Ana Sayfa yalnız bireysel uzmanda var; OSGB'de sayfa yolu Genel Bakış'ta başlar -->
          <NuxtLink :to="multiUser ? '/expert' : '/expert/anasayfa'">{{ multiUser ? 'Genel Bakış' : 'Ana Sayfa' }}</NuxtLink>
          <PkIcon class="pi pi-angle-right" aria-hidden="true" />
          <strong>Firmalarım</strong>
        </nav>
        <h1>Firmalarım</h1>
      </div>
      <button v-if="canAdd" class="primary-button" type="button" @click="wizardOpen = true"><PkIcon class="pi pi-plus" /> Firma ekle</button>
    </div>
    <div class="top">
      <div class="stat-tile primary"><span>Firma</span><strong>{{ firms.length }}</strong><PkIcon class="pi pi-building" aria-hidden="true" /></div>
      <div class="stat-tile success"><span>Lokasyon</span><strong>{{ locationTotal }}</strong><PkIcon class="pi pi-map-marker" aria-hidden="true" /></div>
      <!-- Öne çıkan firma: satırdaki göz simgesiyle seçilir (ilk açılışta listedeki ilk firma) -->
      <section v-if="featured" class="card featured-card">
        <span class="avatar big" :style="{ background: colorOf(featured.name) }">{{ initials(featured.name) }}</span>
        <div>
          <strong>{{ featured.name }}</strong>
          <small>{{ featured.locations_count }} lokasyon · {{ featured.workplaces_count }} işyeri</small>
        </div>
        <NuxtLink :to="`/expert/firma/${featured.id}`" class="soft-link">Firma detayları</NuxtLink>
      </section>
    </div>

    <section class="card list-card">
      <div v-if="loading" class="state">Firmalar yükleniyor...</div>
      <div v-else-if="error" class="state error">
        {{ error }}
        <button class="secondary-button" type="button" @click="load">Tekrar Dene</button>
      </div>
      <div v-else-if="!firms.length" class="empty">
        <span class="empty-icon"><PkIcon class="pi pi-building" /></span>
        <strong>Henüz firmanız yok</strong>
        <span>İlk firmanızı ekleyin; birkaç soruyla hazır olur.</span>
        <button v-if="canAdd" class="primary-button" type="button" @click="wizardOpen = true"><PkIcon class="pi pi-plus-circle" /> İlk Firmamı Ekle</button>
      </div>
      <template v-else>
        <div class="toolbar">
          <label class="search"><PkIcon class="pi pi-search" /><span class="sr-only">Firma ara</span><input v-model="search" type="text" placeholder="Firma adı ile ara..." /></label>
          <Select v-model="typeFilter" :options="typeOptions" option-label="label" option-value="id" placeholder="Tüm türler" show-clear class="type-filter" aria-label="Firma türü" />
        </div>
        <!-- Bütün hesaplarda tablo; satır ana firmanın şema sayfasını açar (OSGB'deki satır içi ağaç kalktı, kullanıcı 17 Kas 2026). -->
        <div class="table-wrap">
          <PkTable>
            <thead><tr><th>Firma</th><th>Tür</th><th>Lokasyon</th><th v-if="SHOW_WORKPLACE_COLUMN" class="num">İşyeri</th><th>İşlemler</th></tr></thead>
            <tbody>
              <tr v-for="firm in filtered" :key="firm.id" tabindex="0" :class="{ featured: featured?.id === firm.id }" @click="open(firm)" @keydown.enter="open(firm)">
                <td>
                  <div class="name">
                    <span class="avatar" :style="{ background: colorOf(firm.name) }">{{ initials(firm.name) }}</span>
                    <strong>{{ firm.name }}</strong>
                  </div>
                </td>
                <td><span v-if="firm.type">{{ customerTypeLabel(firm.type) }}</span><span v-else class="muted">—</span></td>
                <td><span class="location-count"><PkIcon class="pi pi-map-marker" aria-hidden="true" /> {{ firm.locations_count }} lokasyon</span></td>
                <td v-if="SHOW_WORKPLACE_COLUMN" class="num">{{ firm.workplaces_count }}</td>
                <td>
                  <div class="row-actions">
                    <button v-tooltip.top="'Önizle'" class="action-button" type="button" :aria-label="`${firm.name} önizle`" @click.stop="featuredId = firm.id"><PkIcon class="pi pi-eye" /></button>
                    <button v-if="canAdd" v-tooltip.top="'Düzenle'" class="action-button" type="button" :aria-label="`${firm.name} düzenle`" @click.stop="navigateTo(`/expert/firma/${firm.id}?duzenle=1`)"><PkIcon class="pi pi-pencil" /></button>
                    <button v-tooltip.top="'Aç'" class="action-button" type="button" :aria-label="`${firm.name} aç`" @click.stop="open(firm)"><PkIcon class="pi pi-arrow-right" /></button>
                  </div>
                </td>
              </tr>
              <tr v-if="!filtered.length"><td :colspan="SHOW_WORKPLACE_COLUMN ? 5 : 4" class="state">Aramanızla eşleşen firma yok.</td></tr>
            </tbody>
          </PkTable>
        </div>
      </template>
    </section>

    <ExpertFirmWizard v-if="wizardOpen && !multiUser" :firms="firms" @close="wizardOpen = false" @changed="load" />
    <!-- OSGB: mevcut Müşteri Ekle sihirbazı (Ayarlar → Müşteriler'deki); oluşturulunca müşterinin sayfası açılır -->
    <ExpertOrganizationWizard v-if="wizardOpen && multiUser" customer-mode @close="wizardOpen = false" @created="id => navigateTo(`/expert/firma/${id}`)" />
  </div>
</template>

<script setup lang="ts">
import { CUSTOMER_TYPES, customerTypeLabel } from '~/composables/useCustomerTypes'
import type { Firm } from '~/composables/useFirmSetup'

// Gizli; ileride açılabilir.
const SHOW_WORKPLACE_COLUMN = false // Tablodaki İşyeri sayısı sütunu (öne çıkan firma kartında yazıyor)

const { listFirms } = useFirmSetup()
const { errorMessage } = useExpertApi()
const firms = ref<Firm[]>([])
const loading = ref(true)
const error = ref('')
const search = ref('')
const typeFilter = ref<string | null>(null)
const typeOptions = CUSTOMER_TYPES
const wizardOpen = ref(false)
// OSGB: müşteriyi yönetici ekler (operasyon yöneticisi listeyi ve ağacı görür).
const { multiUser, isManager } = useAccount()
const canAdd = computed(() => !multiUser.value || isManager.value)

const locationTotal = computed(() => firms.value.reduce((sum, f) => sum + f.locations_count, 0))
const filtered = computed(() => {
  const q = search.value.trim().toLocaleLowerCase('tr-TR')
  return firms.value.filter(f => (!q || f.name.toLocaleLowerCase('tr-TR').includes(q)) && (!typeFilter.value || f.type === typeFilter.value))
})
const featuredId = ref<Firm['id'] | null>(null)
const featured = computed(() => firms.value.find(f => f.id === featuredId.value) || filtered.value[0] || null)
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
.firm-page { margin: 0 auto; }
/* Behance CRM tasarımı: başlık satırı, pastel sayı kutuları, öne çıkan firma kartı */
.page-head { display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; }
.crumb { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: var(--admin-muted); font-size: 13px; }
.crumb a { color: var(--admin-muted); } .crumb a:hover { color: var(--admin-heading); }
.crumb strong { color: var(--admin-heading); font-weight: 600; } .crumb .pi-angle-right { font-size: 11px; }
h1 { margin: 0; color: var(--admin-heading); font-size: 24px; font-weight: 700; line-height: 1.15; letter-spacing: 0; }
.primary-button, .secondary-button { min-height: 40px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 0 16px; border-radius: 8px; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
.primary-button { border: 0; background: var(--pk-accent); color: var(--pk-on-accent); box-shadow: 0 8px 16px rgba(var(--pk-accent-rgb), .24); }
.primary-button:hover { background: var(--pk-accent-hover); }
.secondary-button { border: 1px solid rgba(145, 158, 171, .32); background: transparent; color: var(--admin-heading); }
.top { display: grid; grid-template-columns: 200px 200px minmax(0, 1fr); gap: 24px; margin-bottom: 24px; }
.stat-tile { position: relative; display: flex; flex-direction: column; gap: 4px; padding: 20px 22px; border-radius: var(--pk-radius); }
.stat-tile span { font-size: 15px; font-weight: 700; }
.stat-tile strong { font-size: 32px; font-weight: 700; line-height: 1.15; }
.stat-tile i { position: absolute; right: 18px; bottom: 16px; font-size: 18px; opacity: .7; }
.stat-tile.primary { background: var(--pk-primary-lighter); color: var(--pk-primary-dark); }
.stat-tile.success { background: var(--pk-success-lighter); color: var(--pk-success-dark); }
:global(.dark-theme) .stat-tile { background: var(--admin-card); }
.featured-card { display: flex; align-items: center; gap: 16px; padding: 20px 24px; overflow: visible; }
.featured-card > div { flex: 1; display: grid; gap: 4px; min-width: 0; }
.featured-card strong { color: var(--admin-heading); font-size: 17px; font-weight: 700; overflow-wrap: anywhere; }
.featured-card small { color: var(--admin-muted); font-size: 13px; }
.soft-link { flex: none; display: inline-flex; align-items: center; padding: 8px 14px; border-radius: 8px; background: var(--admin-accent-soft); color: var(--pk-accent); font-size: 13px; font-weight: 700; }
.soft-link:hover { background: rgba(var(--pk-accent-rgb), .16); }
.card { border: 0; border-radius: var(--pk-radius); background: var(--admin-card); box-shadow: var(--pk-card-shadow); overflow: hidden; }
.toolbar { display: flex; flex-wrap: wrap; gap: 14px; padding: 20px 24px; }
.type-filter { min-width: 240px; min-height: 42px; border-radius: 9px; }
.search { position: relative; display: block; flex: 0 1 420px; }
.search i { position: absolute; left: 13px; top: 14px; color: var(--admin-muted); }
.search input { width: 100%; min-height: 42px; padding: 0 12px 0 36px; border: 1px solid var(--admin-border); border-radius: 9px; outline: 0; background: var(--admin-input); color: var(--admin-heading); font: inherit; font-size: 14px; }
.search input:focus { border-color: var(--pk-accent); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.table-wrap { position: relative; overflow-x: auto; }
.tree-list { padding: 10px 14px 14px; }
table { width: 100%; min-width: 640px; border-collapse: collapse; }
th { padding: 14px 24px; background: rgba(145, 158, 171, .08); color: var(--admin-muted); font-size: 13px; font-weight: 600; text-align: left; }
td { padding: 12px 24px; border-top: 1px solid rgba(145, 158, 171, .2); color: var(--admin-heading); font-size: 14px; }
tbody tr[tabindex] { cursor: pointer; }
tbody tr[tabindex]:hover, tbody tr[tabindex]:focus-visible { outline: 0; background: var(--admin-accent-soft); }
.num { text-align: center; } .end { text-align: right; }
.name { display: flex; align-items: center; gap: 12px; }
.avatar { flex: none; width: 36px; height: 36px; display: grid; place-items: center; border-radius: 50%; color: #fff; font-size: 12.5px; font-weight: 700; }
.chip { display: inline-block; padding: 4px 10px; border-radius: 7px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.chip.corporate { background: #d1e9ff; color: #175cd3; } .chip.individual { background: #dcfae6; color: #067647; } .chip.public { background: #fef0c7; color: #b54708; }
.muted { color: var(--admin-muted); }
.open-link { color: var(--admin-heading); font-size: 13px; font-weight: 700; white-space: nowrap; }
.avatar.big { width: 48px; height: 48px; font-size: 15px; }
.name strong { font-size: 14px; font-weight: 600; }
tbody tr.featured { background: var(--admin-accent-soft); }
.location-count { display: inline-flex; align-items: center; gap: 8px; } .location-count i { color: var(--pk-accent); }
.row-actions { display: flex; gap: 10px; }
.action-button { width: 40px; height: 36px; display: grid; place-items: center; border: 1px solid var(--admin-border); border-radius: 10px; background: var(--admin-card); color: var(--admin-accent-text); cursor: pointer; }
.action-button:hover { border-color: var(--pk-accent); background: var(--admin-accent-soft); }
@media (max-width: 1100px) { .top { grid-template-columns: 1fr 1fr; } .featured-card { grid-column: 1 / -1; } }
.state { padding: 34px 16px; color: var(--admin-muted); text-align: center; font-size: 14px; }
.state.error { display: grid; justify-items: center; gap: 12px; color: #b42318; }
.empty { display: grid; justify-items: center; gap: 8px; padding: 56px 16px; color: var(--admin-muted); text-align: center; font-size: 14px; }
.empty strong { color: var(--admin-heading); font-size: 18px; }
.empty .primary-button { margin-top: 10px; }
.empty-icon { width: 64px; height: 64px; display: grid; place-items: center; border-radius: 16px; background: var(--admin-accent-soft); color: var(--admin-heading); font-size: 26px; }
@media (max-width: 560px) { h1 { font-size: 25px; } .page-head .primary-button { width: 100%; } .stat { flex: 1; min-width: 150px; } }
</style>
