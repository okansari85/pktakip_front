<template>
  <div class="result-page">
    <section class="card" role="status">
      <span class="icon" :class="ok ? 'ok' : 'fail'"><i :class="ok ? 'pi pi-check' : 'pi pi-times'" /></span>
      <template v-if="ok">
        <h1>Ödemeniz alındı</h1>
        <p v-if="applied">Paketiniz tanımlandı: <strong>{{ status?.package?.name }}</strong><template v-if="status?.paid_until"> · ödenen dönem bitişi {{ formatDay(status.paid_until) }}</template>.</p>
        <p v-else-if="waiting"><i class="pi pi-spin pi-spinner" /> Paketiniz birkaç saniye içinde tanımlanır, lütfen bekleyin...</p>
        <p v-else>Ödemeniz alındı; paketinizin tanımlanması biraz gecikebilir. Birkaç dakika sonra Paketim sayfasından kontrol edin.</p>
        <NuxtLink to="/expert/paketim" class="primary-button">Paketim'e dön</NuxtLink>
      </template>
      <template v-else>
        <h1>Ödeme tamamlanamadı</h1>
        <p>Kartınızdan çekim yapılmadı. Kart bilgilerinizi kontrol edip yeniden deneyebilirsiniz.</p>
        <NuxtLink to="/expert/paketim" class="primary-button">Tekrar dene</NuxtLink>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
// PayTR ödeme kutusunun sonunda açılan sayfa (?durum=basarili|basarisiz). Yalnız bilgi verir: paket, PayTR'nin sunucuya
// bildirimi doğrulanınca tanımlanır. PayTR bu sayfayı kutunun (iframe) içinde açar; tüm pencereye taşınır.
definePageMeta({ layout: 'expert', middleware: 'expert', hideWorkplaceSwitcher: true })

const ok = useRoute().query.durum === 'basarili'
const { status, load } = useBilling()
const waiting = ref(ok)
const applied = ref(false)
let alive = true
onBeforeUnmount(() => { alive = false })

onMounted(async () => {
  if (window.top && window.top !== window.self) {
    window.top.location.href = window.location.href
    return
  }
  if (!ok) return
  // Ödeme öncesi durum (Paketim yazar); yoksa ilk okunan durum. Paket ya da dönem bitişi değişince tanımlanmış sayılır.
  let before: { package_id: number | null; paid_until: string | null } | null = null
  try { before = JSON.parse(sessionStorage.getItem('pk_pay_before') || 'null') } catch {}
  // Bildirim gecikebilir: 2 sn arayla en çok 10 kez.
  for (let i = 0; i < 10 && alive; i++) {
    await load()
    const now = { package_id: status.value?.package?.id ?? null, paid_until: status.value?.paid_until ?? null }
    if (!before) before = now
    else if (now.package_id !== before.package_id || now.paid_until !== before.paid_until) {
      applied.value = true
      try { sessionStorage.removeItem('pk_pay_before') } catch {}
      break
    }
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  waiting.value = false
})
</script>

<style scoped>
.result-page { display: grid; place-items: center; padding: 40px 0; }
.card { display: flex; flex-direction: column; align-items: center; gap: 16px; width: 100%; max-width: 520px; padding: 34px 28px; border: 1px solid var(--admin-border); border-radius: 18px; background: var(--admin-card); text-align: center; box-shadow: 0 8px 24px rgba(40, 70, 110, .06); }
.icon { display: grid; place-items: center; width: 58px; height: 58px; border-radius: 50%; font-size: 24px; }
.icon.ok { background: var(--admin-success-bg); color: var(--admin-success-text); }
.icon.fail { background: var(--admin-danger-bg); color: var(--admin-danger-text); }
h1 { margin: 0; color: var(--admin-heading); font-size: 24px; }
p { margin: 0; color: var(--admin-text); font-size: 14.5px; line-height: 1.6; }
.primary-button { display: inline-flex; align-items: center; justify-content: center; align-self: stretch; height: 46px; border-radius: 10px; background: var(--pk-yellow); color: #1b1b1b; font-weight: 800; text-decoration: none; }
</style>
