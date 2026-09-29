<template>
  <div class="organization-page">
    <div class="page-head">
      <div>
        <div class="breadcrumb"><span>Ayarlar</span><i class="pi pi-angle-right" /><strong>Organizasyon</strong></div>
        <h1>Organizasyon</h1>
        <p>Firmanızın organizasyon yapısını hiyerarşik olarak oluşturun. Lokasyonları organizasyonlara Lokasyonlar sayfasından eklersiniz.</p>
      </div>
      <button v-if="customer" class="primary-button" type="button" @click="openForm(null)">
        <i class="pi pi-plus" /><span>Organizasyon Ekle</span>
      </button>
    </div>

    <section class="table-card">
      <div class="toolbar">
        <div v-if="customer" class="customer"><span class="row-icon"><i class="pi pi-building" /></span><div><strong>{{ customer.name }}</strong><small>{{ nodeCount }} organizasyon</small></div></div>
        <div class="search-box"><i class="pi pi-search" /><input v-model="search" type="text" placeholder="Organizasyon ara..." /></div>
      </div>

      <div v-if="!corporate && account" class="state-row">Bu sayfa kurumsal hesaplar içindir. Müşteri organizasyonlarını <NuxtLink to="/expert/settings/customers">Müşteriler</NuxtLink> sayfasından yönetirsiniz.</div>
      <div v-else-if="loading" class="state-row">Organizasyon yükleniyor...</div>
      <div v-else-if="error" class="state-row error-state">{{ error }}</div>
      <div v-else-if="!customer" class="state-row">Firma kaydı bulunamadı.</div>
      <div v-else-if="filteredTree.length === 0" class="state-row empty-state">
        <i class="pi pi-sitemap" />
        <strong>{{ search ? 'Aramaya uyan organizasyon yok' : 'Henüz organizasyon yok' }}</strong>
        <span v-if="!search">Şirketleri, bölgeleri ya da tesisleri "Organizasyon Ekle" ile oluşturun (ör. Holding → Şirket → Fabrika).</span>
      </div>
      <div v-else class="tree-list">
        <ExpertOrganizationNode v-for="node in filteredTree" :key="node.id" :node="node" :depth="0" @add-child="openForm" @edit="openEditForm" @delete="remove" />
      </div>
    </section>

    <div v-if="formOpen" class="modal-backdrop" @click.self="closeForm">
      <section class="modal-card">
        <div class="modal-head">
          <div><h2>{{ editing ? 'Organizasyonu Düzenle' : 'Organizasyon Ekle' }}</h2><p v-if="editing">"{{ editing.name }}" organizasyonunun adını değiştirin.</p><p v-else>{{ parent ? `${parent.name} altına` : 'En üste' }} yeni organizasyon ekleyin.</p></div>
          <button class="close-button" type="button" @click="closeForm"><i class="pi pi-times" /></button>
        </div>
        <label>Organizasyon Adı <span>*</span><input v-model="name" type="text" placeholder="Örn. Dayanıklı Tüketim" /></label>
        <p v-if="formError" class="form-error">{{ formError }}</p>
        <div class="modal-actions"><button class="secondary-button" type="button" @click="closeForm">İptal</button><button class="primary-button" type="button" :disabled="saving || !name.trim()" @click="save">{{ saving ? 'Kaydediliyor...' : 'Kaydet' }}</button></div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
// Ayarlar → Organizasyon (kurumsal hesap): müşteri menüsü yok, firmanın kendisi hesabın tek müşterisi; organizasyon ağacı
// tam ekran. Müşteriler sayfasındaki organizasyon çekmecesiyle aynı uçlar ve ağaç bileşeni.
definePageMeta({ layout: 'expert-settings', middleware: 'expert' })

interface Customer { id: number; name: string }
interface OrganizationNode { id: number | string; name: string; children?: OrganizationNode[] }

const { get, post, patch, del, errorMessage } = useExpertApi()
const { account, corporate, load: loadAccount } = useAccount()

const customer = ref<Customer | null>(null)
const tree = ref<OrganizationNode[]>([])
const loading = ref(true)
const error = ref('')
const search = ref('')

const unwrap = (response: any) => response?.data?.data ?? response?.data ?? response ?? []
const countNodes = (nodes: OrganizationNode[]): number => nodes.reduce((sum, node) => sum + 1 + countNodes(node.children || []), 0)
const nodeCount = computed(() => countNodes(tree.value))
const filteredTree = computed(() => {
  const q = search.value.trim().toLocaleLowerCase('tr-TR')
  if (!q) return tree.value
  const filter = (nodes: OrganizationNode[]): OrganizationNode[] => nodes.flatMap(node => {
    const children = filter(node.children || [])
    return node.name.toLocaleLowerCase('tr-TR').includes(q) || children.length ? [{ ...node, children }] : []
  })
  return filter(tree.value)
})

const loadTree = async () => {
  if (!customer.value) return
  try {
    const data = unwrap(await get(`/customers/${customer.value.id}/organizations`))
    tree.value = Array.isArray(data) ? data : (data?.organizations || data?.items || data?.tree || [])
  } catch (e: any) { error.value = errorMessage(e, 'Organizasyon ağacı alınamadı.') }
}

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const data = unwrap(await get('/customers'))
    const list: Customer[] = Array.isArray(data) ? data : (data?.items || [])
    customer.value = list[0] || null
    await loadTree()
  } catch (e: any) { error.value = errorMessage(e, 'Firma alınamadı.') }
  finally { loading.value = false }
}

// Ekle / düzenle
const formOpen = ref(false)
const name = ref('')
const parent = ref<OrganizationNode | null>(null)
const editing = ref<OrganizationNode | null>(null)
const formError = ref('')
const saving = ref(false)
const openForm = (node: OrganizationNode | null) => { editing.value = null; parent.value = node; name.value = ''; formError.value = ''; formOpen.value = true }
const openEditForm = (node: OrganizationNode) => { editing.value = node; parent.value = null; name.value = node.name; formError.value = ''; formOpen.value = true }
const closeForm = () => { if (!saving.value) formOpen.value = false }
const save = async () => {
  if (!customer.value || !name.value.trim()) return
  if (editing.value && name.value.trim() === editing.value.name) { formOpen.value = false; return }
  saving.value = true
  formError.value = ''
  try {
    if (editing.value) await patch(`/customers/${customer.value.id}/organizations/${editing.value.id}`, { name: name.value.trim() })
    else await post(`/customers/${customer.value.id}/organizations`, { name: name.value.trim(), parent_id: parent.value?.id ?? null, color: '#465FFF' })
    formOpen.value = false
    await loadTree()
  } catch (e: any) { formError.value = errorMessage(e, 'Organizasyon kaydedilemedi.') }
  finally { saving.value = false }
}

const remove = async (node: OrganizationNode) => {
  if (node.children?.length) { alert('Alt organizasyonları bulunan bir organizasyon silinemez. Önce alt organizasyonları silin.'); return }
  if (!confirm(`"${node.name}" organizasyonu silinsin mi?`)) return
  try {
    await del(`/organizations/${node.id}`)
    await loadTree()
  } catch (e: any) { alert(errorMessage(e, 'Organizasyon silinemedi.')) }
}

onMounted(async () => {
  await loadAccount()
  load()
})
</script>

<style scoped>
.organization-page { max-width: 1500px; margin: 0 auto; }
.page-head { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; margin-bottom:20px; }
.breadcrumb { display:flex; align-items:center; gap:8px; margin-bottom:10px; color:var(--admin-muted); font-size:12px; }.breadcrumb strong{color:var(--admin-heading)}
h1{margin:0;color:var(--admin-heading);font-size:30px;letter-spacing:-.7px}.page-head p{margin:7px 0 0;color:var(--admin-muted);font-size:13px}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:0 17px;border:0;border-radius:8px;background:var(--pk-yellow);color:#111827;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.07)}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.table-card{background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px;overflow:hidden}
.toolbar{padding:18px 16px;border-bottom:1px solid var(--admin-border);display:grid;grid-template-columns:minmax(220px,1fr) minmax(220px,420px);gap:16px;align-items:center}
.customer{display:flex;align-items:center;gap:11px}.customer div{display:flex;flex-direction:column;gap:3px}.customer strong{color:var(--admin-heading);font-size:14px}.customer small{color:var(--admin-muted);font-size:11px}
.row-icon{width:36px;height:36px;flex:0 0 36px;display:grid;place-items:center;border-radius:9px;color:var(--admin-text);background:var(--admin-chip)}
.search-box{box-sizing:border-box;height:42px;display:flex;align-items:center;gap:10px;padding:0 12px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-muted)}.search-box input{width:100%;border:0;outline:0;background:transparent;color:var(--admin-heading);font-size:13px}.search-box input::placeholder{color:var(--admin-muted)}
.tree-list{padding:14px 18px 24px}
.state-row{padding:80px 20px;text-align:center;color:var(--admin-muted)}.state-row a{color:var(--admin-link);font-weight:700}.empty-state{display:flex;flex-direction:column;align-items:center;gap:7px}.empty-state i{font-size:30px;margin-bottom:4px}.empty-state strong{color:var(--admin-heading)}.error-state{color:var(--admin-danger-text)}
.modal-backdrop{position:fixed;inset:0;z-index:100;background:var(--admin-overlay);display:grid;place-items:center;padding:20px}
.modal-card{width:min(400px,100%);padding:22px;background:var(--admin-input);border-radius:12px;box-shadow:0 20px 60px var(--admin-shadow)}
.modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:22px}.modal-head h2{margin:0;color:var(--admin-heading);font-size:18px}.modal-head p{margin:5px 0 0;color:var(--admin-muted);font-size:12px}
.close-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:var(--admin-muted);cursor:pointer;border-radius:7px}.close-button:hover{background:var(--admin-hover);color:var(--admin-heading)}
.modal-card label{display:block;margin-bottom:16px;color:var(--admin-heading);font-size:12px;font-weight:700}.modal-card label span{color:var(--admin-danger-text)}
.modal-card input{width:100%;margin-top:7px;padding:11px 12px;border:1px solid var(--admin-border);border-radius:8px;outline:0;background:var(--admin-input);font:inherit;font-size:13px;color:var(--admin-heading)}
.modal-card input:focus{border-color:#d7a900;box-shadow:0 0 0 3px rgba(255,193,7,.12)}
.form-error{margin:0 0 8px;color:var(--admin-danger-text);font-size:12px}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}.secondary-button{min-height:40px;padding:0 18px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-hover);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}
@media(max-width:800px){.page-head{align-items:flex-start;flex-direction:column}.primary-button{align-self:flex-end}.toolbar{grid-template-columns:1fr}}
</style>
