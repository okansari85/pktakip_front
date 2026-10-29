<template>
  <div class="calendar-page" :class="{ reloading: loading && !!data }">
    <div class="page-head">
      <div>
        <h1>Kontrol Takvimi</h1>
        <p>{{ scopeLabel }}</p>
      </div>
    </div>

    <div v-if="loading && !data" class="card state"><i class="pi pi-spin pi-spinner" /> Takvim hazırlanıyor...</div>
    <div v-else-if="error" class="card state error-text">{{ error }}</div>
    <div v-else-if="!groups.length" class="card state">Henüz size atanmış bir işyeri yok. {{ kamu ? 'Lokasyonlar' : 'Firmalarım' }}'dan işyeri ekleyin.</div>
    <ExpertControlCalendar v-else-if="data" :agenda="data.agenda || []" :undated="data.undated" :query="query" />
  </div>
</template>

<script setup lang="ts">
// Kontrol Takvimi (sol menü; eskiden Genel Bakış'ın sekmesiydi): yıllık takvim, Genel Bakış'ın verisiyle (/pk-dashboard).
// Kapsam üstteki lokasyon / firma menüsünden; bu sayfada menüde "Tüm lokasyonlar" da seçilebilir (dashboardScope).
definePageMeta({ layout: 'expert', middleware: 'expert', dashboardScope: true })

const { get, errorMessage } = useExpertApi()
const { groups, load, query, scopeLabel } = useDashboardScope()
const { kamu } = useAccount()

const data = ref<any>(null)
const loading = ref(false)
const error = ref('')

// Aynı kapsam için ikinci istek atılmaz (açılışta işyerleri yüklenince filtre de değişir).
let lastKey = ''
const loadData = async () => {
  if (!groups.value.length) { data.value = null; return }
  const key = JSON.stringify(query.value)
  if (key === lastKey) return
  lastKey = key
  loading.value = true
  error.value = ''
  try { data.value = await get('/pk-dashboard', query.value) }
  catch (e: any) { lastKey = ''; error.value = errorMessage(e, 'Takvim alınamadı.') }
  finally { loading.value = false }
}

watch(query, loadData, { deep: true })
onMounted(async () => {
  await load()
  loadData()
})
</script>

<style scoped>
.calendar-page{max-width:1500px;margin:0 auto;display:grid;gap:16px}
.page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:4px}
.page-head h1{margin:0;color:var(--admin-heading);font-size:30px;line-height:1.15;letter-spacing:-.7px}.page-head p{margin:7px 0 0;color:var(--admin-muted);font-size:13px}
.card{background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px;min-width:0}
.state{display:flex;align-items:center;justify-content:center;gap:8px;padding:60px 20px;color:var(--admin-muted);font-size:13px}
.error-text{color:var(--admin-danger-text)}
.reloading > *{opacity:.5;transition:opacity .15s}
</style>
