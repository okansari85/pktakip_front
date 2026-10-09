<script setup lang="ts">
// Olası idari para cezası (Genel Bakış): seçili işyerinin — lokasyon geneli ekipmanlar dahil — süresi geçmiş ya da uygun
// olmayan aktif ekipmanları için 6331 s. Kanun 26/1-n tutarı (ÇSGB 2026 tablosu). Tutar işyerinin tehlike sınıfı ve
// çalışan sayısına göre, ekipman başına ve aykırılık sürdükçe her ay. "compact": Lokasyonlar sekmesindeki kart.
const props = defineProps<{ locationId: number; workplaceId: number; compact?: boolean }>()
const emit = defineEmits<{ detail: [] }>()

type Item = { id: number; name: string | null; code: string | null; type: string | null; general: boolean; overdue: boolean; nonconforming: boolean; days_left: number | null }
type Fines = {
  year: number; legal: string; rate: number | null; total: number | null
  workplace: { id: number; company_name: string | null; hazard_class: string; nace_code: string | null; band: string | null; band_label: string | null }
  bands: { value: string; label: string }[]
  counts: { total: number; overdue: number; nonconforming: number; general: number }
  items: Item[]
}

const { get, post, errorMessage } = useExpertApi()
const data = ref<Fines | null>(null)
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const open = ref<Set<string>>(new Set())

const money = (n: number | null | undefined) => (n == null ? '—' : `${n.toLocaleString('tr-TR')} TL`)
const reason = (i: Item) => [i.overdue && 'Süresi geçmiş', i.nonconforming && 'Uygun değil'].filter(Boolean).join(' · ')
// Ekipmanlar türe göre gruplu (en kalabalık tür üstte); grup satırına tıklayınca ekipmanları açılır.
const groups = computed(() => {
  const map = new Map<string, Item[]>()
  for (const item of data.value?.items || []) {
    const key = item.type || item.name || 'Diğer'
    map.set(key, [...(map.get(key) || []), item])
  }
  return [...map.entries()]
    .map(([type, items]) => ({ type, items, overdue: items.filter(i => i.overdue).length, nonconforming: items.filter(i => i.nonconforming).length }))
    .sort((a, b) => b.items.length - a.items.length || a.type.localeCompare(b.type, 'tr'))
})
const toggle = (type: string) => {
  const next = new Set(open.value)
  next.has(type) ? next.delete(type) : next.add(type)
  open.value = next
}
const groupTotal = (count: number) => (data.value?.rate == null ? null : data.value.rate * count)

async function load() {
  loading.value = true
  error.value = ''
  try { data.value = await get<Fines>('/pk-dashboard/fines', { location_id: props.locationId, workplace_id: props.workplaceId }) }
  catch (e: any) { error.value = errorMessage(e, 'Ceza hesabı alınamadı.') }
  finally { loading.value = false }
}

async function setBand(band: string) {
  if (!band || saving.value) return
  saving.value = true
  try { await post(`/pk-workplace-employee-bands/${props.workplaceId}`, { band }); await load() }
  catch (e: any) { error.value = errorMessage(e, 'Çalışan sayısı kaydedilemedi.') }
  finally { saving.value = false }
}

watch(() => [props.locationId, props.workplaceId], () => { open.value = new Set(); load() }, { immediate: true })
</script>

<template>
  <!-- Kart (Lokasyonlar sekmesi) -->
  <section v-if="compact" class="card fine-card" :class="{ loading }">
    <header>
      <div><h3>Olası idari para cezası</h3><small>{{ data?.workplace.company_name }} · {{ data?.year }} · ekipman başına, her ay</small></div>
      <button class="link-button" type="button" @click="emit('detail')">Ayrıntı</button>
    </header>
    <p v-if="error" class="muted error-text">{{ error }}</p>
    <template v-else-if="data">
      <strong class="fine-total" :class="{ none: !data.counts.total }">{{ data.counts.total ? money(data.total) : '0 TL' }}</strong>
      <small v-if="data.total === null && data.counts.total" class="muted">Çalışan sayısı seçilmedi; Ayrıntı'dan seçin.</small>
      <small class="muted">{{ data.counts.overdue }} süresi geçmiş · {{ data.counts.nonconforming }} uygun değil<template v-if="data.rate"> · {{ money(data.rate) }} / ekipman</template></small>
    </template>
  </section>

  <!-- Sekme (Ceza) -->
  <div v-else class="fine-tab">
    <div v-if="loading && !data" class="card state"><i class="pi pi-spin pi-spinner" /> Hesaplanıyor...</div>
    <div v-else-if="error && !data" class="card state error-text">{{ error }}</div>
    <template v-else-if="data">
      <div class="kpis three">
        <div class="kpi" :class="{ bad: data.total }"><span>Olası ceza (aylık)</span><strong>{{ data.counts.total ? money(data.total) : '0 TL' }}</strong><small>{{ data.counts.total }} ekipman × {{ money(data.rate) }}</small></div>
        <div class="kpi" :class="{ bad: data.counts.overdue }"><span>Süresi geçmiş</span><strong>{{ data.counts.overdue }}</strong><small>periyodik kontrolü yapılmamış</small></div>
        <div class="kpi" :class="{ bad: data.counts.nonconforming }"><span>Uygun değil</span><strong>{{ data.counts.nonconforming }}</strong><small>son kontrol sonucu</small></div>
      </div>

      <section class="card fine-basis">
        <div class="basis-row"><span>İşyeri</span><strong>{{ data.workplace.company_name }}</strong></div>
        <div class="basis-row"><span>Tehlike sınıfı</span><strong>{{ data.workplace.hazard_class || '—' }}</strong><small v-if="data.workplace.nace_code">NACE {{ data.workplace.nace_code }} · işyeri kaydından</small></div>
        <div class="basis-row">
          <span>Çalışan sayısı</span>
          <select :value="data.workplace.band || ''" :disabled="saving" aria-label="Çalışan sayısı" @change="setBand(($event.target as HTMLSelectElement).value)">
            <option value="" disabled>Seçiniz</option>
            <option v-for="b in data.bands" :key="b.value" :value="b.value">{{ b.label }}</option>
          </select>
        </div>
        <div class="basis-row"><span>Ekipman başına</span><strong>{{ money(data.rate) }}</strong></div>
        <p v-if="!data.workplace.band" class="warn-text">Tutarı hesaplamak için bu işyerinin çalışan sayısını seçin.</p>
        <p v-if="error" class="error-text">{{ error }}</p>
      </section>

      <section class="card list-card">
        <header><div><h3>Cezaya konu ekipmanlar</h3><small>Süresi geçmiş ya da uygun olmayan aktif ekipmanlar; lokasyon geneli ekipmanlar dahil. Bir ekipman bir kez sayılır.</small></div></header>
        <p v-if="!data.items.length" class="muted pad">Bu işyerinde cezaya konu ekipman yok.</p>
        <table v-else class="fine-table">
          <thead><tr><th>Ekipman türü</th><th class="num">Adet</th><th>Süresi geçmiş</th><th>Uygun değil</th><th class="num">Tutar</th></tr></thead>
          <tbody>
            <template v-for="g in groups" :key="g.type">
              <tr class="group-row" :class="{ open: open.has(g.type) }" tabindex="0" :aria-expanded="open.has(g.type)" @click="toggle(g.type)" @keydown.enter.prevent="toggle(g.type)" @keydown.space.prevent="toggle(g.type)">
                <td><i class="pi" :class="open.has(g.type) ? 'pi-chevron-down' : 'pi-chevron-right'" /> {{ g.type }}</td>
                <td class="num">{{ g.items.length }}</td>
                <td :class="{ 'error-text': g.overdue }">{{ g.overdue || '—' }}</td>
                <td :class="{ 'error-text': g.nonconforming }">{{ g.nonconforming || '—' }}</td>
                <td class="num">{{ money(groupTotal(g.items.length)) }}</td>
              </tr>
              <template v-if="open.has(g.type)">
                <tr v-for="i in g.items" :key="i.id" class="item-row">
                  <td><NuxtLink :to="`/expert/equipment/${i.id}`">{{ i.name || i.type }}</NuxtLink><small v-if="i.code"> · no {{ i.code }}</small><small v-if="i.general" class="general"> · Lokasyon geneli</small></td>
                  <td />
                  <td colspan="2">{{ reason(i) }}<small v-if="i.days_left != null"> · <span :class="{ 'error-text': i.days_left < 0 }">{{ i.days_left < 0 ? `${-i.days_left} gün geçti` : `${i.days_left} gün` }}</span></small></td>
                  <td class="num">{{ money(data.rate) }}</td>
                </tr>
              </template>
            </template>
          </tbody>
        </table>
      </section>

      <p class="fine-note">
        Kaynak: ÇSGB, 6331 sayılı Kanuna göre {{ data.year }} yılında uygulanacak idari para cezaları (yeniden değerleme %25,49) — {{ data.legal }}.
        Tutar her ekipman için ayrı ve tespit tarihinden itibaren aykırılık sürdükçe her ay uygulanır. Bu hesap bilgilendirme amaçlıdır, resmî tespit değildir.
      </p>
    </template>
  </div>
</template>

<style scoped>
.fine-card{display:flex;flex-direction:column;gap:8px;padding:18px}
.fine-card header,.list-card header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.fine-card h3,.list-card h3{margin:0;color:var(--admin-heading);font-size:15px}
.fine-card small,.list-card header small{color:var(--admin-muted);font-size:11px}
.fine-card.loading{opacity:.6}
.fine-total{color:var(--admin-danger-text);font-size:30px;line-height:1.1}
.fine-total.none{color:#16a34a}
.fine-tab{display:flex;flex-direction:column;gap:16px}
.kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.kpi{display:flex;flex-direction:column;gap:6px;padding:18px;background:var(--admin-card);border:1px solid var(--admin-border);border-left:4px solid var(--admin-border);border-radius:12px}
.kpi span{color:var(--admin-muted);font-size:12px;font-weight:700}.kpi strong{color:var(--admin-heading);font-size:28px;line-height:1}.kpi small{color:var(--admin-muted);font-size:11px}
.kpi.bad{border-left-color:var(--admin-danger-text)}.kpi.bad strong{color:var(--admin-danger-text)}
.card{background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px;min-width:0}
.state{display:flex;align-items:center;justify-content:center;gap:8px;padding:60px 20px;color:var(--admin-muted);font-size:13px}
.fine-basis{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px 24px;padding:18px}
.basis-row{display:flex;flex-direction:column;gap:4px}.basis-row span{color:var(--admin-muted);font-size:12px;font-weight:700}.basis-row strong{color:var(--admin-heading);font-size:15px}
.basis-row small{color:var(--admin-muted);font-size:11px}
.basis-row select{min-height:38px;border:1px solid var(--admin-border);border-radius:8px;padding:0 10px;background:var(--admin-card);color:var(--admin-heading);font:inherit}
.warn-text{grid-column:1/-1;margin:0;color:#b54708;font-size:12px}
.error-text{color:var(--admin-danger-text)}
.list-card{padding:18px;display:flex;flex-direction:column;gap:12px}
.fine-table{width:100%;border-collapse:collapse;font-size:13px}
.fine-table th{text-align:left;color:var(--admin-muted);font-size:11px;font-weight:700;padding:8px;border-bottom:1px solid var(--admin-border)}
.fine-table td{padding:9px 8px;border-bottom:1px solid var(--admin-border);color:var(--admin-heading)}
.fine-table td small{color:var(--admin-muted)}.fine-table .general{color:#b54708}
.fine-table .num{text-align:right;white-space:nowrap}
.group-row{cursor:pointer}.group-row td{font-weight:700}.group-row:hover td,.group-row.open td{background:var(--admin-border)}
.group-row:focus-visible{outline:2px solid #175cd3;outline-offset:-2px}.group-row .pi{font-size:11px;color:var(--admin-muted);margin-right:4px}
.item-row td:first-child{padding-left:28px}
.fine-table a{color:var(--admin-heading);font-weight:600;text-decoration:none}.fine-table a:hover{text-decoration:underline}
.muted{color:var(--admin-muted)}.pad{padding:4px 0}
.link-button{border:0;background:none;color:#175cd3;font:inherit;font-size:12px;font-weight:700;cursor:pointer;padding:0}
.fine-note{margin:0;color:var(--admin-muted);font-size:11.5px;line-height:1.6}
@media (max-width:760px){.kpis{grid-template-columns:1fr}.fine-table{display:block;overflow-x:auto}}
</style>
