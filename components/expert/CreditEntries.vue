<template>
  <section class="card">
    <div v-if="loading && !rows.length" class="state">Yükleniyor...</div>
    <div v-else-if="error" class="state error-text">{{ error }}</div>
    <div v-else-if="!rows.length" class="state">Henüz kredi hareketi yok.</div>
    <div v-else class="table-wrap">
      <table>
        <thead><tr><th>Tarih</th><th>Hareket</th><th>Kullanıcı</th><th class="amount">Kredi</th></tr></thead>
        <tbody>
          <tr v-for="entry in rows" :key="entry.id">
            <td class="nowrap">{{ formatEntryDate(entry.created_at) }}</td>
            <td>{{ entryText(entry) }}</td>
            <td>{{ entry.user || '—' }}</td>
            <td class="amount" :class="entry.amount > 0 ? 'plus' : 'minus'">{{ entry.amount > 0 ? `+${entry.amount}` : entry.amount }}</td>
          </tr>
        </tbody>
      </table>
      <div class="table-footer">
        <span>{{ rows.length }} / {{ total }} hareket</span>
        <button v-if="page < lastPage" class="secondary-button" type="button" :disabled="loading" @click="loadPage(page + 1)">{{ loading ? 'Yükleniyor...' : 'Daha fazla göster' }}</button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
// Kredi hareketleri: yükleme (+) ve okuma (−) satırları, en yeni önce. Kaynak verilmezse oturumdaki hesabın hareketleri
// (OSGB / kurumsal hesapta uzman yalnızca kendi okumalarını görür, sunucu süzer); süper admin bir hesabınkini verir.
const props = defineProps<{ source?: (page: number) => Promise<{ data: CreditEntry[]; total: number; current_page: number; last_page: number }> }>()
const { entries } = useBilling()
const { errorMessage } = useExpertApi()
const rows = ref<CreditEntry[]>([])
const total = ref(0)
const page = ref(1)
const lastPage = ref(1)
const loading = ref(false)
const error = ref('')

const loadPage = async (next: number) => {
  loading.value = true
  error.value = ''
  try {
    const data = await (props.source || entries)(next)
    rows.value = next === 1 ? data.data : [...rows.value, ...data.data]
    total.value = data.total
    page.value = data.current_page
    lastPage.value = data.last_page
  } catch (e: any) {
    error.value = errorMessage(e, 'Kredi hareketleri alınamadı.')
  } finally { loading.value = false }
}
onMounted(() => loadPage(1))
defineExpose({ reload: () => loadPage(1) })
</script>

<style scoped>
.card{background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px;overflow:hidden}
.state{padding:40px 20px;text-align:center;color:var(--admin-muted);font-size:12px}.error-text{color:var(--admin-danger-text)}
.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}
th,td{padding:11px 14px;text-align:left;border-bottom:1px solid var(--admin-row-border);font-size:12px;color:var(--admin-text)}
th{font-size:11px;font-weight:700;color:var(--admin-muted);background:var(--admin-soft);white-space:nowrap}
.nowrap{white-space:nowrap}.amount{text-align:right;font-weight:800;white-space:nowrap}.amount.plus{color:var(--admin-success-text)}.amount.minus{color:var(--admin-heading)}
.table-footer{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;color:var(--admin-muted);font-size:12px}
.secondary-button{min-height:34px;padding:0 14px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-hover);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}
</style>
