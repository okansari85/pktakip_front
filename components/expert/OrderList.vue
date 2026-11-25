<template>
  <!-- Ödemelerim: paket siparişleri, en yeni önce (tasarım kataloğu 20: Ödeme geçmişi). -->
  <section class="card">
    <h2 class="list-title">Ödeme geçmişi</h2>
    <div v-if="loading && !rows.length" class="state">Yükleniyor...</div>
    <div v-else-if="error" class="state error-text">{{ error }}</div>
    <div v-else-if="!rows.length" class="state">Henüz ödeme yok.</div>
    <div v-else class="table-wrap">
      <PkTable>
        <thead><tr><th>Tarih</th><th>Paket</th><th>Dönem</th><th>Tutar (KDV dahil)</th><th>Durum</th><th>Sipariş no</th></tr></thead>
        <tbody>
          <tr v-for="order in rows" :key="order.merchant_oid">
            <td class="nowrap" :title="formatEntryDate(order.created_at)">{{ formatDay(order.created_at) }}</td>
            <td>{{ order.package?.name || '—' }}</td>
            <td>{{ PERIOD_LABELS[order.period] || order.period }}</td>
            <td class="amount">{{ formatTl(order.total_amount) }}</td>
            <td><Tag :value="ORDER_STATUS[order.status]?.label || order.status" :severity="ORDER_STATUS[order.status]?.severity" :icon="STATUS_ICON[order.status]" rounded :title="STATUS_HINT[order.status]" /></td>
            <td class="mono">{{ order.merchant_oid }}</td>
          </tr>
        </tbody>
      </PkTable>
      <div class="table-footer">
        <span>{{ rows.length }} / {{ total }} ödeme</span>
        <button v-if="page < lastPage" class="secondary-button" type="button" :disabled="loading" @click="loadPage(page + 1)">{{ loading ? 'Yükleniyor...' : 'Daha fazla göster' }}</button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
// loaded: yüklenen satırlar (Hesabım'daki Ödeme özeti son ödemeyi ve durumunu buradan alır).
const emit = defineEmits<{ loaded: [rows: PkOrder[]] }>()
const STATUS_ICON: Record<string, string> = { paid: 'pi pi-check-circle', failed: 'pi pi-times-circle', pending: 'pi pi-clock', attention: 'pi pi-info-circle' }
// Eski açıklama metni (Ödemelerim üstünde gizli) durum etiketinin ipucunda.
const STATUS_HINT: Record<string, string> = { pending: 'Ödeme ekranı açıldı, sonuç gelmedi.', attention: 'Ödeme alındı ama ekibimizin kontrolü gerekiyor; gerekirse sizinle iletişime geçeriz.' }
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
    emit('loaded', rows.value)
  } catch (e: any) {
    error.value = errorMessage(e, 'Ödemeler alınamadı.')
  } finally { loading.value = false }
}
onMounted(() => loadPage(1))
</script>

<style scoped>
.card{padding:24px;background:var(--admin-card);border:0;border-radius:var(--pk-radius);box-shadow:var(--pk-card-shadow)}
.list-title{margin:0 0 16px;color:var(--admin-heading);font-size:17px;font-weight:700}
.state{padding:40px 20px;text-align:center;color:var(--admin-muted);font-size:13px}.error-text{color:var(--admin-danger-text)}
.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}
th,td{padding:12px 16px;text-align:left;border-bottom:1px solid rgba(145,158,171,.2);font-size:14px;color:var(--admin-heading)}
th{border-bottom:0;font-size:13px;font-weight:600;color:var(--admin-muted);background:rgba(145,158,171,.08);white-space:nowrap}
th:first-child{border-radius:8px 0 0 8px}th:last-child{border-radius:0 8px 8px 0}
.nowrap{white-space:nowrap}.amount{font-size:14px;font-weight:700;white-space:nowrap}.mono{font-variant-numeric:tabular-nums;color:var(--admin-text)}
.table-footer{display:flex;align-items:center;justify-content:space-between;padding:12px 4px 0;color:var(--admin-muted);font-size:12px}
.secondary-button{min-height:36px;padding:0 14px;border:1px solid rgba(145,158,171,.32);border-radius:8px;background:transparent;color:var(--admin-heading);font-size:13px;font-weight:700;cursor:pointer}.secondary-button:hover{background:rgba(145,158,171,.08)}
</style>
