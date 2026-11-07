<template>
  <!-- Ödemelerim: paket siparişleri, en yeni önce (Kredi hareketleri tablosuyla aynı biçim). -->
  <section class="card">
    <div v-if="loading && !rows.length" class="state">Yükleniyor...</div>
    <div v-else-if="error" class="state error-text">{{ error }}</div>
    <div v-else-if="!rows.length" class="state">Henüz ödeme yok.</div>
    <div v-else class="table-wrap">
      <table>
        <thead><tr><th>Tarih</th><th>Paket</th><th>Dönem</th><th class="amount">Tutar (KDV dahil)</th><th>Durum</th><th>Sipariş no</th></tr></thead>
        <tbody>
          <tr v-for="order in rows" :key="order.merchant_oid">
            <td class="nowrap">{{ formatEntryDate(order.created_at) }}</td>
            <td>{{ order.package?.name || '—' }}</td>
            <td>{{ PERIOD_LABELS[order.period] || order.period }}</td>
            <td class="amount">{{ formatTl(order.total_amount) }}</td>
            <td><Tag :value="ORDER_STATUS[order.status]?.label || order.status" :severity="ORDER_STATUS[order.status]?.severity" /></td>
            <td class="mono">{{ order.merchant_oid }}</td>
          </tr>
        </tbody>
      </table>
      <div class="table-footer">
        <span>{{ rows.length }} / {{ total }} ödeme</span>
        <button v-if="page < lastPage" class="secondary-button" type="button" :disabled="loading" @click="loadPage(page + 1)">{{ loading ? 'Yükleniyor...' : 'Daha fazla göster' }}</button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const { orders } = useBilling()
const { errorMessage } = useExpertApi()
const rows = ref<PkOrder[]>([])
const total = ref(0)
const page = ref(1)
const lastPage = ref(1)
const loading = ref(false)
const error = ref('')

const loadPage = async (next: number) => {
  loading.value = true
  error.value = ''
  try {
    const data = await orders(next)
    rows.value = next === 1 ? data.data : [...rows.value, ...data.data]
    total.value = data.total
    page.value = data.current_page
    lastPage.value = data.last_page
  } catch (e: any) {
    error.value = errorMessage(e, 'Ödemeler alınamadı.')
  } finally { loading.value = false }
}
onMounted(() => loadPage(1))
</script>

<style scoped>
.card{background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px;overflow:hidden}
.state{padding:40px 20px;text-align:center;color:var(--admin-muted);font-size:12px}.error-text{color:var(--admin-danger-text)}
.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}
th,td{padding:11px 14px;text-align:left;border-bottom:1px solid var(--admin-row-border);font-size:12px;color:var(--admin-text)}
th{font-size:11px;font-weight:700;color:var(--admin-muted);background:var(--admin-soft);white-space:nowrap}
.nowrap{white-space:nowrap}.amount{text-align:right;font-weight:800;white-space:nowrap}.mono{font-family:ui-monospace,monospace;font-size:11px;color:var(--admin-muted)}
.table-footer{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;color:var(--admin-muted);font-size:12px}
.secondary-button{min-height:34px;padding:0 14px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-hover);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}
</style>
