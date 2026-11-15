<template>
  <div class="firm-page">
    <!-- Firmalarım (tasarım kataloğu 11): başlık, sayılar ve Firma ekle, öne çıkan firma, yerleşke çizimi; altta liste -->
    <div class="top">
      <div class="top-left">
        <nav class="crumb" aria-label="Sayfa yolu">
          <i class="pi pi-home" aria-hidden="true" />
          <!-- Ana Sayfa yalnız bireysel uzmanda var; OSGB'de sayfa yolu Genel Bakış'ta başlar -->
          <NuxtLink :to="multiUser ? '/expert' : '/expert/anasayfa'">{{ multiUser ? 'Genel Bakış' : 'Ana Sayfa' }}</NuxtLink>
          <i class="pi pi-angle-right" aria-hidden="true" />
          <strong>Firmalarım</strong>
        </nav>
        <h1>Firmalarım</h1>
        <p class="lead">Tüm portföyünüzü tek ekrandan yönetin</p>
        <section class="card stats-card">
          <div class="stat-row">
            <div class="stat"><span class="stat-icon"><i class="pi pi-building" /></span><span><strong>{{ firms.length }}</strong><small>Firma</small></span></div>
            <div class="stat"><span class="stat-icon"><i class="pi pi-map-marker" /></span><span><strong>{{ locationTotal }}</strong><small>Lokasyon</small></span></div>
          </div>
          <button v-if="canAdd" class="primary-button wide" type="button" @click="wizardOpen = true"><i class="pi pi-plus" /> Firma ekle</button>
        </section>
        <!-- Öne çıkan firma: satırdaki göz simgesiyle seçilir (ilk açılışta listedeki ilk firma) -->
        <section v-if="featured" class="card featured-card">
          <img :src="thumbOf(featured)" alt="" />
          <div>
            <strong>{{ featured.name }}</strong>
            <small>{{ featured.locations_count }} lokasyon · {{ featured.workplaces_count }} işyeri</small>
            <NuxtLink :to="`/expert/firma/${featured.id}`" class="soft-link">Firma detayları <i class="pi pi-arrow-right" aria-hidden="true" /></NuxtLink>
          </div>
        </section>
      </div>
      <figure class="hero">
        <!-- Katalogdaki görsel (tasarım kataloğu 11'den kırpıldı) -->
        <img src="/katalog/firmalarim-katalog.webp" alt="" />
        <figcaption><i class="pi pi-clone" aria-hidden="true" /> Örnek yerleşim</figcaption>
      </figure>
    </div>

    <section class="card list-card">
      <div v-if="loading" class="state">Firmalar yükleniyor...</div>
      <div v-else-if="error" class="state error">
        {{ error }}
        <button class="secondary-button" type="button" @click="load">Tekrar Dene</button>
      </div>
      <div v-else-if="!firms.length" class="empty">
        <span class="empty-icon"><i class="pi pi-building" /></span>
        <strong>Henüz firmanız yok</strong>
        <span>İlk firmanızı ekleyin; birkaç soruyla hazır olur.</span>
        <button v-if="canAdd" class="primary-button" type="button" @click="wizardOpen = true"><i class="pi pi-plus-circle" /> İlk Firmamı Ekle</button>
      </div>
      <template v-else>
        <div class="toolbar">
          <label class="search"><i class="pi pi-search" /><span class="sr-only">Firma ara</span><input v-model="search" type="text" placeholder="Firma adı ile ara..." /></label>
          <Select v-model="typeFilter" :options="typeOptions" option-label="label" option-value="id" placeholder="Tüm türler" show-clear class="type-filter" aria-label="Firma türü" />
        </div>
        <!-- OSGB: bütün müşteriler tek ağaçta; müşteri satırına tıklanınca yapısı yüklenip açılır (bireysel uzmanda tablo aynen). -->
        <div v-if="multiUser" class="tree-list">
          <ExpertFirmTree v-for="firm in filtered" :key="firm.id" embedded :customer-id="firm.id" :preview="firm" @changed="load" />
          <p v-if="!filtered.length" class="state">Aramanızla eşleşen firma yok.</p>
        </div>
        <div v-else class="table-wrap">
          <table>
            <thead><tr><th>Firma</th><th>Tür</th><th>Lokasyon</th><th v-if="SHOW_WORKPLACE_COLUMN" class="num">İşyeri</th><th>İşlemler</th></tr></thead>
            <tbody>
              <tr v-for="firm in filtered" :key="firm.id" tabindex="0" :class="{ featured: featured?.id === firm.id }" @click="open(firm)" @keydown.enter="open(firm)">
                <td>
                  <div class="name">
                    <span v-if="SHOW_INITIALS_AVATAR" class="avatar" :style="{ background: colorOf(firm.name) }">{{ initials(firm.name) }}</span>
                    <img v-else class="thumb" :src="thumbOf(firm)" alt="" />
                    <strong>{{ firm.name }}</strong>
                  </div>
                </td>
                <td><span v-if="firm.type">{{ customerTypeLabel(firm.type) }}</span><span v-else class="muted">—</span></td>
                <td><span class="location-count"><i class="pi pi-map-marker" aria-hidden="true" /> {{ firm.locations_count }} lokasyon</span></td>
                <td v-if="SHOW_WORKPLACE_COLUMN" class="num">{{ firm.workplaces_count }}</td>
                <td>
                  <div class="row-actions">
                    <button v-tooltip.top="'Önizle'" class="action-button" type="button" :aria-label="`${firm.name} önizle`" @click.stop="featuredId = firm.id"><i class="pi pi-eye" /></button>
                    <button v-if="canAdd" v-tooltip.top="'Düzenle'" class="action-button" type="button" :aria-label="`${firm.name} düzenle`" @click.stop="navigateTo(`/expert/firma/${firm.id}?duzenle=1`)"><i class="pi pi-pencil" /></button>
                    <button v-tooltip.top="'Aç'" class="action-button" type="button" :aria-label="`${firm.name} aç`" @click.stop="open(firm)"><i class="pi pi-arrow-right" /></button>
                  </div>
                </td>
              </tr>
              <tr v-if="!filtered.length"><td :colspan="SHOW_WORKPLACE_COLUMN ? 5 : 4" class="state">Aramanızla eşleşen firma yok.</td></tr>
            </tbody>
          </table>
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

// Tasarım kataloğu 11'de olmayan öğeler: katalogda yok, gizli; ileride açılabilir.
const SHOW_WORKPLACE_COLUMN = false // Tablodaki İşyeri sayısı sütunu (öne çıkan firma kartında yazıyor)
const SHOW_INITIALS_AVATAR = false // Firma adının baş harfleriyle renkli yuvarlak (katalogda bina resmi)

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
// Firma resmi yok: türe göre katalogdaki bina resmi (kurumsal, kamu, şahıs).
const THUMBS: Record<string, string> = { corporate: '/katalog/firma-kurumsal-katalog.webp', public: '/katalog/firma-kamu-katalog.webp', individual: '/katalog/firma-sahis-katalog.webp' }
const thumbOf = (firm: Firm) => THUMBS[firm.type || ''] || THUMBS.corporate
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
/* Üst sıra (tasarım kataloğu 11) */
.top { display: grid; grid-template-columns: minmax(300px, 380px) minmax(0, 1fr); gap: 16px; align-items: start; margin-bottom: 18px; }
.top-left { display: grid; gap: 14px; }
.crumb { display: flex; align-items: center; gap: 8px; color: var(--admin-muted); font-size: 13px; }
.crumb a { color: var(--admin-muted); } .crumb a:hover { color: var(--admin-heading); }
.crumb strong { color: var(--admin-heading); font-weight: 600; } .crumb .pi-angle-right { font-size: 11px; }
h1 { margin: 0; color: var(--admin-heading); font-size: 40px; font-weight: 800; line-height: 1.15; letter-spacing: -1px; }
.lead { margin: -8px 0 4px; color: var(--admin-muted); font-size: 15px; }
.primary-button, .secondary-button { min-height: 46px; display: inline-flex; align-items: center; justify-content: center; gap: 9px; padding: 0 18px; border-radius: 10px; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
.primary-button { border: 1px solid var(--pk-yellow); background: var(--pk-yellow); color: var(--pk-on-accent); }
.primary-button:hover { background: var(--pk-yellow-dark); }
.primary-button.wide { width: 100%; font-size: 16px; box-shadow: 0 8px 20px rgba(var(--pk-accent-rgb), .25); }
.secondary-button { min-height: 38px; border: 1px solid var(--admin-border); background: var(--admin-input); color: var(--admin-heading); }
.stats-card, .featured-card { padding: 16px; border-radius: 16px; overflow: visible; box-shadow: 0 10px 28px rgba(var(--pk-shadow-rgb), .06); }
.stats-card { display: grid; gap: 14px; }
.stat-row { display: grid; grid-template-columns: 1fr 1fr; }
.stat { display: flex; align-items: center; gap: 12px; padding: 2px 4px; }
.stat + .stat { padding-left: 18px; border-left: 1px solid var(--admin-border); }
.stat > span:last-child { display: grid; }
.stat small { color: var(--admin-text); font-size: 14px; }
.stat strong { color: var(--admin-heading); font-size: 26px; font-weight: 800; line-height: 1.1; }
.stat-icon { flex: none; width: 52px; height: 52px; display: grid; place-items: center; border-radius: 50%; background: var(--admin-accent-soft); color: var(--admin-accent-text); font-size: 21px; }
.featured-card { display: flex; align-items: center; gap: 16px; }
.featured-card img { flex: none; width: 112px; height: 92px; border-radius: 10px; object-fit: cover; }
.featured-card > div { display: grid; justify-items: start; gap: 4px; min-width: 0; }
.featured-card strong { color: var(--admin-heading); font-size: 19px; font-weight: 800; overflow-wrap: anywhere; }
.featured-card small { color: var(--admin-muted); font-size: 14px; }
.soft-link { display: inline-flex; align-items: center; gap: 8px; margin-top: 6px; padding: 8px 14px; border-radius: 10px; background: var(--admin-accent-soft); color: var(--admin-accent-text); font-size: 14.5px; font-weight: 700; }
.soft-link:hover { box-shadow: inset 0 0 0 1px var(--pk-accent); }
.hero { position: relative; min-width: 0; margin: 0; display: flex; justify-content: center; }
.hero img { display: block; width: min(100%, 1000px); margin-top: 36px; }
.hero figcaption { position: absolute; top: 0; right: 0; display: inline-flex; align-items: center; gap: 8px; padding: 8px 15px; border: 1px solid var(--admin-border); border-radius: 999px; background: var(--admin-card); color: var(--admin-heading); font-size: 14px; font-weight: 600; box-shadow: 0 6px 18px rgba(var(--pk-shadow-rgb), .06); }
.card { border: 1px solid var(--admin-border); border-radius: 12px; background: var(--admin-card, var(--admin-input)); overflow: hidden; }
.list-card { border-radius: 16px; box-shadow: 0 10px 28px rgba(var(--pk-shadow-rgb), .05); }
.toolbar { display: flex; flex-wrap: wrap; gap: 14px; padding: 16px 18px; }
.type-filter { min-width: 240px; min-height: 42px; border-radius: 9px; }
.search { position: relative; display: block; flex: 0 1 420px; }
.search i { position: absolute; left: 13px; top: 14px; color: var(--admin-muted); }
.search input { width: 100%; min-height: 42px; padding: 0 12px 0 36px; border: 1px solid var(--admin-border); border-radius: 9px; outline: 0; background: var(--admin-input); color: var(--admin-heading); font: inherit; font-size: 14px; }
.search input:focus { border-color: var(--pk-accent); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.table-wrap { position: relative; overflow-x: auto; }
.tree-list { padding: 10px 14px 14px; }
table { width: 100%; min-width: 640px; border-collapse: collapse; }
th { padding: 12px 18px; background: var(--admin-soft); color: var(--admin-heading); font-size: 14.5px; font-weight: 700; text-align: left; }
td { padding: 10px 18px; border-top: 1px solid var(--admin-border); color: var(--admin-heading); font-size: 15px; }
tbody tr[tabindex] { cursor: pointer; }
tbody tr[tabindex]:hover, tbody tr[tabindex]:focus-visible { outline: 0; background: var(--admin-accent-soft); }
.num { text-align: center; } .end { text-align: right; }
.name { display: flex; align-items: center; gap: 12px; }
.avatar { flex: none; width: 36px; height: 36px; display: grid; place-items: center; border-radius: 50%; color: #fff; font-size: 12.5px; font-weight: 700; }
.chip { display: inline-block; padding: 4px 10px; border-radius: 7px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.chip.corporate { background: #d1e9ff; color: #175cd3; } .chip.individual { background: #dcfae6; color: #067647; } .chip.public { background: #fef0c7; color: #b54708; }
.muted { color: var(--admin-muted); }
.open-link { color: var(--admin-heading); font-size: 13px; font-weight: 700; white-space: nowrap; }
.thumb { flex: none; width: 96px; height: 52px; border-radius: 8px; object-fit: cover; }
.name strong { font-size: 16px; }
tbody tr.featured { background: var(--admin-accent-soft); }
.location-count { display: inline-flex; align-items: center; gap: 8px; } .location-count i { color: var(--pk-accent); }
.row-actions { display: flex; gap: 10px; }
.action-button { width: 40px; height: 36px; display: grid; place-items: center; border: 1px solid var(--admin-border); border-radius: 10px; background: var(--admin-card); color: var(--admin-accent-text); cursor: pointer; }
.action-button:hover { border-color: var(--pk-accent); background: var(--admin-accent-soft); }
@media (max-width: 1100px) { .top { grid-template-columns: 1fr; } .hero img { margin-top: 0; } .hero figcaption { top: auto; bottom: 0; } }
.state { padding: 34px 16px; color: var(--admin-muted); text-align: center; font-size: 14px; }
.state.error { display: grid; justify-items: center; gap: 12px; color: #b42318; }
.empty { display: grid; justify-items: center; gap: 8px; padding: 56px 16px; color: var(--admin-muted); text-align: center; font-size: 14px; }
.empty strong { color: var(--admin-heading); font-size: 18px; }
.empty .primary-button { margin-top: 10px; }
.empty-icon { width: 64px; height: 64px; display: grid; place-items: center; border-radius: 16px; background: var(--admin-accent-soft); color: var(--admin-heading); font-size: 26px; }
@media (max-width: 560px) { h1 { font-size: 25px; } .page-head .primary-button { width: 100%; } .stat { flex: 1; min-width: 150px; } }
</style>
