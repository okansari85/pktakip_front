<template>
  <section class="card matching-card">
    <div class="matching-head">
      <h3>Eşleştirme bekliyor <span class="count" :class="{ warn: total }">{{ total }}</span></h3>
      <small v-if="board.form">
        Mevcut envanter ile son tüm envanter formu ({{ formLabel(board.form) }}) arasındaki fark; ek formların eşleşmeyen satırları da sağda.
        Soldan bir tüp, sağdan bir satır seçip eşleştirin; tüp yeni rapordaki adı (yer, no) alır.
      </small>
      <small v-else-if="board.forms.length">Tüm envanter formu yok: yalnızca ek formların eşleşmeyen satırları sağda. Kontrol Formları'nda bir formu "Tüm envanter" yapınca sol liste de gelir.</small>
    </div>

    <div v-if="loading && !loaded" class="state">Yükleniyor...</div>
    <div v-else-if="error" class="state error-text">{{ error }}</div>
    <div v-else-if="!board.forms.length" class="state empty"><i class="pi pi-file-check" /><strong>Henüz tüp kontrol formu yok</strong></div>
    <div v-else-if="!total" class="state empty"><i class="pi pi-check-circle" /><strong>Fark yok</strong><span>Envanter ile kontrol formları birebir aynı.</span></div>

    <div v-else class="board">
      <!-- Sol: envanterde olup yeni raporda olmayan tüpler -->
      <div class="column">
        <header>
          <h4>Envanterden çıkarılacaklar <span class="count">{{ board.left.length }}</span></h4>
          <small>Envanterde olup yeni raporda olmayan tüpler</small>
        </header>
        <div class="search"><i class="pi pi-search" /><input v-model="leftSearch" type="text" placeholder="Yer ya da no ile ara" /></div>
        <label class="select-all"><input type="checkbox" :checked="allChecked(leftView, leftChecked)" :disabled="!leftView.length" @change="toggleAll(leftView, leftChecked)" /> Tümünü seç</label>
        <ul class="items">
          <!-- Satıra tıklamak seçer -->
          <li v-for="item in leftView" :key="item.id">
            <label class="item" :class="{ active: leftChecked.includes(item.id) }">
              <input v-model="leftChecked" type="checkbox" :value="item.id" />
              <span class="label"><strong>{{ tubeLabel(item) }}</strong><small v-if="item.last_control_date">son kontrol {{ formatDate(item.last_control_date) }}</small></span>
              <span v-if="similarLeft.has(item.id)" class="similar">benzer</span>
            </label>
          </li>
          <li v-if="!leftView.length" class="none">Sonuç yok.</li>
        </ul>
        <footer>
          <button class="secondary-button" type="button" :disabled="working || !leftChecked.length" @click="deactivateIds = [...leftChecked]">
            <i class="pi pi-ban" /> Seçilenleri envanterden çıkar ({{ leftChecked.length }})
          </button>
        </footer>
      </div>

      <!-- Sağ: yeni raporda olup envanterde karşılığı olmayan satırlar -->
      <div class="column">
        <header>
          <h4>Yeni eklenecekler <span class="count">{{ board.right.length }}</span></h4>
          <small>Yeni raporda olup envanterde olmayan tüpler</small>
        </header>
        <div class="search"><i class="pi pi-search" /><input v-model="rightSearch" type="text" placeholder="Yer ya da no ile ara" /></div>
        <label class="select-all"><input type="checkbox" :checked="allChecked(rightView, rightChecked)" :disabled="!rightView.length" @change="toggleAll(rightView, rightChecked)" /> Tümünü seç</label>
        <ul class="items">
          <!-- Satıra tıklamak seçer -->
          <li v-for="row in rightView" :key="row.id">
            <label class="item" :class="{ active: rightChecked.includes(row.id) }">
              <input v-model="rightChecked" type="checkbox" :value="row.id" />
              <span class="label"><strong>{{ rowLabel(row) }}</strong><small>{{ [row.capacity && `${row.capacity} kg`, row.fill_date && `dolum ${row.fill_date}`, STATUS_LABELS[row.status], manyForms && formLabel(formsById.get(row.form_id))].filter(Boolean).join(' · ') }}</small></span>
              <span v-if="similarRight.has(row.id)" class="similar">benzer</span>
            </label>
          </li>
          <li v-if="!rightView.length" class="none">Sonuç yok.</li>
        </ul>
        <footer>
          <button class="secondary-button" type="button" :disabled="working || !rightChecked.length" @click="addChecked">
            <i class="pi pi-plus" /> Seçilenleri yeni tüp olarak ekle ({{ rightChecked.length }})
          </button>
        </footer>
      </div>
    </div>

    <!-- Seçili çift: soldan ve sağdan birer seçim → eşleştir -->
    <div v-if="board.forms.length && (leftChecked.length || rightChecked.length)" class="match-bar">
      <span class="pick" :class="{ empty: !leftItem }">{{ leftItem ? tubeLabel(leftItem) : leftChecked.length ? `Solda ${leftChecked.length} tüp seçili` : 'Soldan bir tüp seçin' }}</span>
      <i class="pi pi-arrow-right-arrow-left" />
      <span class="pick" :class="{ empty: !rightItem }">{{ rightItem ? rowLabel(rightItem) : rightChecked.length ? `Sağda ${rightChecked.length} satır seçili` : 'Sağdan bir satır seçin' }}</span>
      <small v-if="leftChecked.length > 1 || rightChecked.length > 1">Eşleştirmek için iki listeden birer tane seçin.</small>
      <small v-if="leftItem && rightItem">Tüp yeni rapordaki adı alır: <strong>{{ [rightItem.place, rightItem.code && `no ${rightItem.code}`].filter(Boolean).join(' · ') }}</strong></small>
      <p v-if="matchError" class="error-text">{{ matchError }}</p>
      <div class="bar-actions">
        <button class="secondary-button" type="button" :disabled="working" @click="clearPick">Vazgeç</button>
        <button class="primary-button" type="button" :disabled="!leftItem || !rightItem || working" @click="match">
          <i :class="working ? 'pi pi-spin pi-spinner' : 'pi pi-link'" /> Eşleştir
        </button>
      </div>
    </div>

    <ExpertEquipmentDeactivateModal v-if="deactivateIds.length" :ids="deactivateIds" :title="`${deactivateIds.length} tüp envanterden çıkarılacak (pasife alınır)`" @close="deactivateIds = []" @saved="onDeactivated" />
  </section>
</template>

<script setup lang="ts">
// Ekipmanlar → Yangın Söndürme Cihazı → Eşleştirme bekliyor: mevcut envanter ile son tüp kontrol formu arasındaki fark. Sol:
// envanterde olup raporda olmayan tüpler (envanterden çıkarılacaklar, pasife alınır); sağ: raporda olup envanterde olmayan
// satırlar (yeni eklenecekler). Kullanıcı soldan bir tüp, sağdan bir satır seçip eşleştirir: tüpe formun kontrol kaydı işlenir,
// tüp yeni rapordaki adı alır. Hiçbiri kendiliğinden yapılmaz; benzerlik yalnızca sıralama ve "benzer" işaretidir.
const props = defineProps<{ context: any; refreshKey?: number }>()
const emit = defineEmits<{ changed: []; count: [total: number] }>()

const STATUS_LABELS: Record<string, string> = { uygun: 'Uygun', uygun_degil: 'Uygun değil' }

const { get, post, errorMessage } = useExpertApi()
const board = ref<{ form: any; forms: any[]; left: any[]; right: any[] }>({ form: null, forms: [], left: [], right: [] })
const loading = ref(false)
const loaded = ref(false)
const error = ref('')
const working = ref(false)
const matchError = ref('')
const leftSearch = ref('')
const rightSearch = ref('')
const leftChecked = ref<number[]>([])
const rightChecked = ref<number[]>([])
const deactivateIds = ref<number[]>([])

const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('tr-TR').format(new Date(value)) : '—'
const rowLabel = (row: any) => [row.place, row.code && `no ${row.code}`, row.variant || row.type_text].filter(Boolean).join(' · ')
// Form adı: tarih ve dosya adı (rapor no yedek).
const fileTitle = (name?: string | null) => (name || '').toLowerCase().endsWith('.pdf') ? (name || '').slice(0, -4) : (name || '')
const formLabel = (form: any) => form ? [formatDate(form.control_date), fileTitle(form.report_file_name) || form.report_no].filter(Boolean).join(' · ') : ''
const formsById = computed(() => new Map(board.value.forms.map(form => [form.id, form])))
// Sağdaki satırlar birden fazla formdan geliyorsa satırda formu da yazılır.
const manyForms = computed(() => new Set(board.value.right.map(row => row.form_id)).size > 1)
const total = computed(() => board.value.left.length + board.value.right.length)
// Eşleştirilecek çift: iki listede de tek seçim varsa.
const leftItem = computed(() => leftChecked.value.length === 1 ? board.value.left.find(item => item.id === leftChecked.value[0]) || null : null)
const rightItem = computed(() => rightChecked.value.length === 1 ? board.value.right.find(row => row.id === rightChecked.value[0]) || null : null)
// Tümünü seç: görünen (aramaya uyan) satırlar.
const allChecked = (list: any[], checked: number[]) => !!list.length && list.every(item => checked.includes(item.id))
const toggleAll = (list: any[], checked: number[]) => {
  const ids = list.map(item => item.id)
  const next = allChecked(list, checked) ? checked.filter(id => !ids.includes(id)) : [...new Set([...checked, ...ids])]
  checked.splice(0, checked.length, ...next)
}
const matches = (text: string, search: string) => !compactText(search) || compactText(text).includes(compactText(search))
// Karşı tarafta seçili olana göre en benzer üstte; yoksa yere göre.
const byPlace = (a: any, b: any) => (a.place || '').localeCompare(b.place || '', 'tr') || (a.code || '').localeCompare(b.code || '', 'tr', { numeric: true })
const leftView = computed(() => {
  const list = board.value.left.filter(item => matches(tubeLabel(item), leftSearch.value))
  const other = rightItem.value
  return other ? [...list].sort((a, b) => tubeScore(other, b) - tubeScore(other, a) || byPlace(a, b)) : [...list].sort(byPlace)
})
const rightView = computed(() => {
  const list = board.value.right.filter(row => matches(rowLabel(row), rightSearch.value))
  const other = leftItem.value
  return other ? [...list].sort((a, b) => tubeScore(b, other) - tubeScore(a, other) || byPlace(a, b)) : [...list].sort(byPlace)
})
// "benzer" işareti: karşı taraftaki seçime en çok benzeyen ilk üç (puanı yeterliyse).
const similarLeft = computed(() => new Set(rightItem.value ? leftView.value.filter(item => tubeScore(rightItem.value, item) >= 2).slice(0, 3).map(item => item.id) : []))
const similarRight = computed(() => new Set(leftItem.value ? rightView.value.filter(row => tubeScore(row, leftItem.value) >= 2).slice(0, 3).map(row => row.id) : []))

const clearPick = () => { leftChecked.value = []; rightChecked.value = []; matchError.value = '' }
watch([leftChecked, rightChecked], () => { matchError.value = '' })

const load = async () => {
  if (!props.context) { board.value = { form: null, forms: [], left: [], right: [] }; emit('count', 0); return }
  loading.value = true
  error.value = ''
  try {
    const data = await get('/pk-bulk-report-matches/board', { location_id: props.context.location_id })
    board.value = { form: data.form, forms: data.forms || [], left: data.left || [], right: data.right || [] }
    const leftIds = new Set(board.value.left.map(item => item.id))
    const rightIds = new Set(board.value.right.map(row => row.id))
    leftChecked.value = leftChecked.value.filter(id => leftIds.has(id))
    rightChecked.value = rightChecked.value.filter(id => rightIds.has(id))
    emit('count', total.value)
  } catch (e: any) {
    error.value = errorMessage(e, 'Eşleştirme bekleyenler alınamadı.')
  } finally { loading.value = false; loaded.value = true }
}

const match = async () => {
  if (!leftItem.value || !rightItem.value) return
  working.value = true
  matchError.value = ''
  try {
    await post('/pk-bulk-report-matches/board/match', { row_id: rightItem.value.id, equipment_id: leftItem.value.id })
    clearPick()
    await load()
    emit('changed')
  } catch (e: any) {
    matchError.value = errorMessage(e, 'Eşleştirilemedi.')
  } finally { working.value = false }
}
const addChecked = async () => {
  const count = rightChecked.value.length
  if (!count || !confirm(`${count} satır yeni tüp olarak envantere eklensin mi? Her birine bu formla kontrol kaydı açılır.`)) return
  working.value = true
  try {
    await post('/pk-bulk-report-matches/board/add', { ids: rightChecked.value })
    rightChecked.value = []
    await load()
    emit('changed')
  } catch (e: any) {
    alert(errorMessage(e, 'Eklenemedi.'))
  } finally { working.value = false }
}
const onDeactivated = async () => {
  deactivateIds.value = []
  leftChecked.value = []
  await load()
  emit('changed')
}

watch(() => [props.refreshKey, props.context && `${props.context.location_id}-${props.context.workplace_id ?? ''}`], () => load())
onMounted(load)
</script>

<style scoped>
.card{background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px}
.matching-card{overflow:hidden}
.matching-head{padding:16px 18px;border-bottom:1px solid var(--admin-border)}
h3{margin:0;color:var(--admin-heading);font-size:15px}.matching-head small{display:block;margin-top:4px;color:var(--admin-muted);font-size:12px;line-height:1.5}
h4{margin:0;color:var(--admin-heading);font-size:13px}
.count{min-width:20px;padding:1px 7px;border-radius:999px;background:var(--admin-chip);color:var(--admin-muted);font-size:11px;font-weight:700}
.count.warn{background:var(--admin-warning-bg);color:var(--admin-warning-text)}
.state{padding:50px 20px;text-align:center;color:var(--admin-muted);font-size:13px}
.empty{display:flex;flex-direction:column;align-items:center;gap:7px}.empty i{font-size:26px;color:var(--admin-success-text)}.empty strong{color:var(--admin-heading)}
.board{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:14px 18px}
.column{display:flex;flex-direction:column;min-width:0;border:1px solid var(--admin-border);border-radius:10px;overflow:hidden}
.column header{padding:10px 12px;border-bottom:1px solid var(--admin-border);background:var(--admin-soft)}.column header small{display:block;margin-top:3px;color:var(--admin-muted);font-size:11px}
.search{display:flex;align-items:center;gap:8px;margin:10px 12px 6px;padding:0 10px;height:34px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-muted)}
.search input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--admin-heading);font:inherit;font-size:12px}
.items{height:440px;overflow:auto;margin:0;padding:0 6px 6px;list-style:none}
.select-all{display:flex;align-items:center;gap:8px;margin:2px 12px 6px;padding:0 8px;color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}
.item{display:flex;align-items:center;gap:9px;padding:7px 8px;border:1px solid transparent;border-radius:8px;cursor:pointer}
.item:hover{background:var(--admin-hover)}
.item.active{border-color:#d7a900;background:var(--admin-accent-soft)}
.items li.none{padding:7px 8px;color:var(--admin-muted);font-size:12px}
.label{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.label strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--admin-heading);font-size:12px;font-weight:600}
.label small{color:var(--admin-muted);font-size:11px}
.similar{flex-shrink:0;padding:1px 7px;border-radius:999px;background:var(--admin-warning-bg);color:var(--admin-warning-text);font-size:10px;font-weight:700}
.column footer{margin-top:auto;padding:10px 12px;border-top:1px solid var(--admin-border)}
.match-bar{position:sticky;bottom:0;display:flex;align-items:center;flex-wrap:wrap;gap:10px;padding:12px 18px;border-top:1px solid var(--admin-border);background:var(--admin-card);box-shadow:0 -6px 16px var(--admin-shadow)}
.match-bar .pick{max-width:36%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:5px 10px;border:1px solid #d7a900;border-radius:8px;color:var(--admin-heading);font-size:12px;font-weight:700}
.match-bar .pick.empty{border-style:dashed;border-color:var(--admin-border);color:var(--admin-muted);font-weight:400}
.match-bar > i{color:var(--admin-muted)}
.match-bar small{flex-basis:100%;color:var(--admin-muted);font-size:12px}.match-bar small strong{color:var(--admin-heading)}
.match-bar .error-text{flex-basis:100%;margin:0;font-size:12px}
.bar-actions{display:flex;gap:8px;margin-left:auto}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:36px;padding:0 15px;border:0;border-radius:8px;background:var(--pk-yellow);color:#111827;font-size:13px;font-weight:800;cursor:pointer;white-space:nowrap}
.secondary-button{display:inline-flex;align-items:center;gap:7px;min-height:34px;padding:0 13px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-hover);color:var(--admin-heading);font:inherit;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}
.primary-button:disabled,.secondary-button:disabled{opacity:.55;cursor:not-allowed}
.error-text{color:var(--admin-danger-text)}
@media(max-width:900px){.board{grid-template-columns:1fr}.match-bar .pick{max-width:100%}}
</style>
