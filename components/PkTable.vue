<!--
  Bütün tablolar bu bileşenle: geniş ekranda düz tablo, telefonda (760 px altı) her satır bir kart, her hücre "BAŞLIK  değer" satırı (SahaAsistan gibi).
  Kullanım: <table> yerine <PkTable> (class, v-if vb. tabloya geçer; sayfanın kendi stilleri aynen çalışır).
  PrimeVue DataTable için: <PkTable wrap><DataTable …/></PkTable> — içindeki tablolar aynı kuralı alır.
  Başlıklar hücrelere data-label olarak yazılır; satırlar değiştikçe (MutationObserver) yenilenir. Başlıkta data-label varsa o kullanılır.
-->
<template>
  <div v-if="wrap" ref="root" class="pk-table-host"><slot /></div>
  <table v-else ref="root" class="pk-table"><slot /></table>
</template>

<script setup lang="ts">
defineProps<{ wrap?: boolean }>()

const root = ref<HTMLElement | null>(null)
let observer: MutationObserver | null = null
let pending = false

function labelTable(table: HTMLTableElement) {
  const headRows = table.tHead?.rows
  if (!headRows?.length) return
  // Başlık satırı birden çoksa en alttaki (en ayrıntılı) satır; colspan kadar sütun ilerler.
  const labels: string[] = []
  for (const th of headRows[headRows.length - 1]!.cells) {
    const text = (th.dataset.label ?? th.textContent ?? '').trim()
    for (let i = 0; i < (th.colSpan || 1); i++) labels.push(text)
  }
  // Yalnız bu tablonun kendi satırları; iç içe tablo kendi başlığıyla ayrıca etiketlenir.
  for (const body of [...table.tBodies, ...(table.tFoot ? [table.tFoot] : [])]) {
    for (const row of body.rows) {
      let col = 0
      for (const cell of row.cells) {
        const label = labels[col] ?? ''
        if (cell.dataset.label !== label) cell.dataset.label = label
        col += cell.colSpan || 1
      }
    }
  }
}

function labelAll() {
  pending = false
  const el = root.value
  if (!el) return
  const tables = el instanceof HTMLTableElement ? [el, ...el.querySelectorAll('table')] : [...el.querySelectorAll('table')]
  tables.forEach(t => labelTable(t as HTMLTableElement))
}

function schedule() {
  if (!pending) { pending = true; requestAnimationFrame(labelAll) }
}

onMounted(() => {
  if (!root.value) return
  // Yalnız eklenen/çıkan düğümleri izler; kendi yazdığımız data-label nitelikleri yeniden tetiklemez.
  observer = new MutationObserver(schedule)
  observer.observe(root.value, { childList: true, subtree: true, characterData: true })
  labelAll()
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<style>
/* Sayfaların kendi (scoped) tablo stilleri genişlik, dolgu, nowrap verebildiği için yapı kuralları !important. Yazdırmada uygulanmaz. */
@media screen and (max-width: 760px) {
  .pk-table, .pk-table-host table { min-width: 0 !important; width: 100% !important; border-collapse: separate !important; table-layout: auto !important; }
  .pk-table > thead, .pk-table-host table > thead { display: none !important; }
  .pk-table, .pk-table > tbody, .pk-table > tfoot, .pk-table > tbody > tr, .pk-table > tfoot > tr,
  .pk-table-host table, .pk-table-host table > tbody, .pk-table-host table > tfoot, .pk-table-host table > tbody > tr, .pk-table-host table > tfoot > tr { display: block !important; width: 100% !important; }
  .pk-table > tbody > tr, .pk-table > tfoot > tr, .pk-table-host table > tbody > tr, .pk-table-host table > tfoot > tr {
    margin: 0 0 10px; padding: 6px 14px; border: 1px solid rgba(145, 158, 171, .24); border-radius: 14px; background: var(--admin-card, #fff); height: auto !important;
  }
  /* Hücre: solda başlık, sağda değerin bütün parçaları; uzun metin kırılır. */
  .pk-table > tbody > tr > td, .pk-table > tbody > tr > th, .pk-table > tfoot > tr > td,
  .pk-table-host table > tbody > tr > td, .pk-table-host table > tfoot > tr > td {
    display: grid !important; grid-template-columns: minmax(0, 40%) minmax(0, 1fr); column-gap: 14px; align-items: start;
    width: 100% !important; max-width: none !important; min-width: 0 !important; padding: 7px 0 !important; border: 0 !important;
    text-align: right !important; white-space: normal !important; overflow-wrap: anywhere; position: static !important; background: transparent !important;
  }
  .pk-table td > *, .pk-table th > *, .pk-table-host td > * { grid-column: 2; min-width: 0; max-width: 100%; justify-self: end; }
  .pk-table td[data-label]::before, .pk-table th[data-label]::before, .pk-table-host td[data-label]::before {
    content: attr(data-label); grid-column: 1; grid-row: 1 / span 9; text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .4px;
    text-transform: uppercase; color: var(--admin-muted, #637381); padding-top: 2px; overflow-wrap: normal;
  }
  /* Başlığı olmayan hücre (işlem düğmeleri, açılan ayrıntı satırı) kartın tam genişliğinde. */
  .pk-table td:not([data-label]), .pk-table td[data-label=""], .pk-table th:not([data-label]), .pk-table th[data-label=""],
  .pk-table-host td:not([data-label]), .pk-table-host td[data-label=""] { display: block !important; text-align: left !important; }
  .pk-table td[data-label=""]::before, .pk-table th[data-label=""]::before, .pk-table-host td[data-label=""]::before { content: none; }
  .pk-table td[colspan], .pk-table-host td[colspan] { display: block !important; text-align: left !important; }
  .pk-table td[colspan]::before, .pk-table-host td[colspan]::before { content: none; }
  .pk-table td:empty, .pk-table-host td:empty { display: none !important; }
}
</style>
