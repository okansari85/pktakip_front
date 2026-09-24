<template>
  <div class="companies-page">
    <div class="page-head">
      <div>
        <div class="breadcrumb"><span>Uzman Paneli</span><i class="pi pi-angle-right" /><strong>Firmalarım</strong></div>
        <h1>Firmalarım</h1>
        <p>Hizmet verdiğiniz işyerlerini ve firma tanımlarınızı yönetin.</p>
      </div>
      <button v-if="tab === 'workplaces'" class="primary-button" type="button" @click="workplaceFormOpen = true">
        <i class="pi pi-plus" /><span>İşyeri Ekle</span>
      </button>
      <button v-else class="primary-button" type="button" @click="openCompanyForm(null)">
        <i class="pi pi-plus" /><span>Firma Tanımla</span>
      </button>
    </div>

    <div class="tabs">
      <button type="button" :class="{ active: tab === 'workplaces' }" @click="tab = 'workplaces'">
        <i class="pi pi-map-marker" /> İşyerlerim <span class="count">{{ workplaces.length }}</span>
      </button>
      <button type="button" :class="{ active: tab === 'companies' }" @click="tab = 'companies'">
        <i class="pi pi-briefcase" /> Firma Tanımları <span class="count">{{ companies.length }}</span>
      </button>
    </div>

    <!-- İşyerlerim -->
    <section v-if="tab === 'workplaces'" class="table-card">
      <div class="toolbar">
        <label class="field">
          <span>Müşteri</span>
          <select v-model="customerFilter">
            <option :value="null">Tüm müşteriler</option>
            <option v-for="name in customerNames" :key="name" :value="name">{{ name }}</option>
          </select>
        </label>
        <label class="field">
          <span>Tehlike Sınıfı</span>
          <select v-model="hazardFilter">
            <option :value="null">Tümü</option>
            <option v-for="hazard in HAZARD_CLASSES" :key="hazard" :value="hazard">{{ hazard }}</option>
          </select>
        </label>
        <label class="field">
          <span>Ara</span>
          <div class="search-box"><i class="pi pi-search" /><input v-model="workplaceSearch" type="text" placeholder="Firma, lokasyon, NACE veya SGK no" /></div>
        </label>
      </div>

      <div v-if="workplacesLoading" class="state-row">İşyerleri yükleniyor...</div>
      <div v-else-if="workplacesError" class="state-row error-state">{{ workplacesError }}</div>
      <div v-else-if="filteredWorkplaces.length === 0" class="state-row empty-state">
        <i class="pi pi-map-marker" />
        <strong>İşyeri bulunmuyor</strong>
        <span>"İşyeri Ekle" ile bir lokasyona firma ekleyebilirsiniz.</span>
      </div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Firma</th>
              <th>Müşteri</th>
              <th>Lokasyon</th>
              <th>NACE</th>
              <th>Tehlike Sınıfı</th>
              <th>SGK Sicil No</th>
              <th>Uzman</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredWorkplaces" :key="item.id">
              <td><div class="name-cell"><span class="row-icon"><i class="pi pi-briefcase" /></span><strong>{{ item.company_name }}</strong></div></td>
              <td>{{ item.customer_name || '—' }}</td>
              <td>
                <div class="stacked"><strong>{{ item.location_name }}</strong><small v-if="item.organization_name">{{ item.organization_name }}</small></div>
              </td>
              <td>
                <div v-if="item.nace_code" class="stacked"><strong>{{ item.nace_code }}</strong><small class="activity" :title="item.activity || ''">{{ item.activity }}</small></div>
                <span v-else>—</span>
              </td>
              <td><span class="hazard-badge" :class="hazardClassKey(item.hazard_class)">{{ item.hazard_class }}</span></td>
              <td>{{ item.sgk_workplace_number || '—' }}</td>
              <td>{{ item.experts?.join(', ') || '—' }}</td>
            </tr>
          </tbody>
        </table>
        <div class="table-footer"><span>Toplam {{ filteredWorkplaces.length }} işyeri</span></div>
      </div>
    </section>

    <!-- Firma Tanımları -->
    <section v-else class="table-card">
      <div class="toolbar single">
        <div class="search-box"><i class="pi pi-search" /><input v-model="companySearch" type="text" placeholder="Firma ara" /></div>
      </div>

      <div v-if="companiesLoading" class="state-row">Firmalar yükleniyor...</div>
      <div v-else-if="companiesError" class="state-row error-state">{{ companiesError }}</div>
      <div v-else-if="filteredCompanies.length === 0" class="state-row empty-state">
        <i class="pi pi-briefcase" />
        <strong>Henüz firma tanımı yok</strong>
        <span>Firmaları buradan ya da işyeri eklerken tanımlayabilirsiniz.</span>
      </div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Firma Adı</th>
              <th>Kısa Ad</th>
              <th>Tür</th>
              <th>Lokasyon</th>
              <th>Oluşturma Tarihi</th>
              <th class="actions-head">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="company in filteredCompanies" :key="company.business_entity_id">
              <td><div class="name-cell"><span class="row-icon"><i class="pi pi-briefcase" /></span><strong>{{ company.name }}</strong></div></td>
              <td>{{ company.short_name || '—' }}</td>
              <td>{{ companyTypeLabel(company.company_type) }}</td>
              <td>{{ company.locations_count ?? 0 }}</td>
              <td>{{ formatDate(company.created_at) }}</td>
              <td class="actions"><button class="icon-button" type="button" title="Düzenle" @click="openCompanyForm(company)"><i class="pi pi-pencil" /></button></td>
            </tr>
          </tbody>
        </table>
        <div class="table-footer"><span>Toplam {{ filteredCompanies.length }} firma</span></div>
      </div>
    </section>

    <ExpertWorkplaceForm v-if="workplaceFormOpen" @close="workplaceFormOpen = false" @saved="onWorkplaceSaved" />

    <div v-if="companyFormOpen" class="modal-backdrop" @click.self="closeCompanyForm">
      <section class="modal-card">
        <div class="modal-head">
          <div><h2>{{ editingCompany ? 'Firmayı Düzenle' : 'Firma Tanımla' }}</h2><p>{{ editingCompany ? 'Firma bilgilerini güncelleyin.' : 'Yeni firma kaydı oluşturun.' }}</p></div>
          <button class="close-button" type="button" @click="closeCompanyForm"><i class="pi pi-times" /></button>
        </div>
        <label>Firma Adı <span>*</span><input v-model="companyForm.name" type="text" placeholder="Örn. Arçelik A.Ş." /></label>
        <p v-if="duplicateCompany" class="hint warn">"{{ duplicateCompany.name }}" zaten kayıtlı.</p>
        <label>Kısa Ad <small>(Opsiyonel)</small><input v-model="companyForm.short_name" type="text" /></label>
        <label>Firma Türü <span>*</span>
          <select v-model="companyForm.company_type">
            <option value="corporate">Kurumsal</option>
            <option value="individual">Bireysel (Şahıs)</option>
          </select>
        </label>
        <p v-if="companyFormError" class="form-error">{{ companyFormError }}</p>
        <div class="modal-actions">
          <button class="secondary-button" type="button" @click="closeCompanyForm">İptal</button>
          <button class="primary-button" type="button" :disabled="companySaving || !companyForm.name.trim() || !!duplicateCompany" @click="saveCompany">{{ companySaving ? 'Kaydediliyor...' : 'Kaydet' }}</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'expert', middleware: 'expert' })

interface Workplace { id: number; company_name: string; customer_name?: string | null; location_name?: string | null; organization_name?: string | null; nace_code?: string | null; activity?: string | null; hazard_class: string; sgk_workplace_number?: string | null; experts?: string[] }

const { get, post, patch, errorMessage } = useExpertApi()
const trLower = (value?: string | null) => (value || '').toLocaleLowerCase('tr-TR')

const tab = ref<'workplaces' | 'companies'>('workplaces')

// İşyerlerim
const workplaces = ref<Workplace[]>([])
const workplacesLoading = ref(true)
const workplacesError = ref('')
const workplaceSearch = ref('')
const customerFilter = ref<string | null>(null)
const hazardFilter = ref<string | null>(null)
const workplaceFormOpen = ref(false)

const customerNames = computed(() => [...new Set(workplaces.value.map(w => w.customer_name).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'tr')))

const filteredWorkplaces = computed(() => {
  const q = trLower(workplaceSearch.value.trim())
  return workplaces.value.filter(w =>
    (!customerFilter.value || w.customer_name === customerFilter.value) &&
    (!hazardFilter.value || w.hazard_class === hazardFilter.value) &&
    (!q || [w.company_name, w.location_name, w.nace_code, w.sgk_workplace_number, w.activity].some(v => trLower(v).includes(q)))
  )
})

const loadWorkplaces = async () => {
  workplacesLoading.value = true
  workplacesError.value = ''
  try { workplaces.value = await get<Workplace[]>('/my-workplaces') }
  catch (e: any) { workplacesError.value = errorMessage(e, 'İşyerleri alınamadı.') }
  finally { workplacesLoading.value = false }
}

const onWorkplaceSaved = async () => {
  workplaceFormOpen.value = false
  await Promise.all([loadWorkplaces(), loadCompanies()])
}

// Firma Tanımları
const companies = ref<MyCompany[]>([])
const companiesLoading = ref(true)
const companiesError = ref('')
const companySearch = ref('')
const companyFormOpen = ref(false)
const companySaving = ref(false)
const companyFormError = ref('')
const editingCompany = ref<MyCompany | null>(null)
const companyForm = reactive({ name: '', short_name: '', company_type: 'corporate' })

const filteredCompanies = computed(() => {
  const q = trLower(companySearch.value.trim())
  return companies.value.filter(c => !q || trLower(c.name).includes(q) || trLower(c.short_name).includes(q))
})

// Aynı firmanın ikinci kez tanımlanmasını formda da engeller (backend ayrıca kontrol eder).
const duplicateCompany = computed(() => {
  const key = normalizeCompanyName(companyForm.name)
  if (!key) return null
  return companies.value.find(c => c.business_entity_id !== editingCompany.value?.business_entity_id && normalizeCompanyName(c.name) === key) || null
})

const companyTypeLabel = (type?: string | null) => type === 'individual' ? 'Bireysel' : type === 'corporate' ? 'Kurumsal' : '—'

const loadCompanies = async () => {
  companiesLoading.value = true
  companiesError.value = ''
  try { companies.value = await get<MyCompany[]>('/my-companies') }
  catch (e: any) { companiesError.value = errorMessage(e, 'Firmalar alınamadı.') }
  finally { companiesLoading.value = false }
}

const openCompanyForm = (company: MyCompany | null) => {
  editingCompany.value = company
  Object.assign(companyForm, { name: company?.name || '', short_name: company?.short_name || '', company_type: company?.company_type || 'corporate' })
  companyFormError.value = ''
  companyFormOpen.value = true
}
const closeCompanyForm = () => { if (!companySaving.value) companyFormOpen.value = false }

const saveCompany = async () => {
  if (!companyForm.name.trim() || duplicateCompany.value) return
  companySaving.value = true
  companyFormError.value = ''
  const body = { name: companyForm.name.trim(), short_name: companyForm.short_name.trim() || null, company_type: companyForm.company_type }
  try {
    if (editingCompany.value) await patch(`/my-companies/${editingCompany.value.business_entity_id}`, body)
    else await post('/my-companies', body)
    companyFormOpen.value = false
    await Promise.all([loadCompanies(), loadWorkplaces()])
  } catch (e: any) {
    companyFormError.value = errorMessage(e, 'Firma kaydedilemedi.')
  } finally { companySaving.value = false }
}

const formatDate = (value?: string) => value ? new Intl.DateTimeFormat('tr-TR').format(new Date(value)) : '—'

onMounted(() => { loadWorkplaces(); loadCompanies() })
</script>

<style scoped>
.companies-page { max-width: 1500px; margin: 0 auto; }
.page-head { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; margin-bottom:20px; }
.breadcrumb { display:flex; align-items:center; gap:8px; margin-bottom:10px; color:var(--admin-muted); font-size:12px; }.breadcrumb strong{color:var(--admin-heading)}
h1{margin:0;color:var(--admin-heading);font-size:30px;letter-spacing:-.7px}.page-head p{margin:7px 0 0;color:var(--admin-muted);font-size:13px}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:0 17px;border:0;border-radius:8px;background:var(--pk-yellow);color:#111827;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.07)}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.tabs{display:flex;gap:4px;margin-bottom:16px;border-bottom:1px solid var(--admin-border)}
.tabs button{display:inline-flex;align-items:center;gap:8px;padding:11px 14px;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;background:none;color:var(--admin-muted);font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.tabs button:hover{color:var(--admin-heading)}.tabs button.active{color:var(--admin-heading);border-bottom-color:var(--pk-yellow)}
.tabs .count{min-width:22px;padding:1px 7px;border-radius:999px;background:#f2f4f7;color:#475467;font-size:11px}
.table-card{background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px;overflow:hidden}
.toolbar{padding:18px 16px;border-bottom:1px solid var(--admin-border);display:grid;grid-template-columns:minmax(180px,240px) minmax(160px,200px) 1fr;gap:12px;align-items:start}.toolbar.single{display:block}
.field{display:flex;flex-direction:column;gap:6px;margin:0;font-size:11px;font-weight:700;color:#667085}
.field select{box-sizing:border-box;height:42px;margin:0;padding:0 10px;border:1px solid var(--admin-border);border-radius:8px;background:#fff;color:var(--admin-heading);font:inherit;font-size:13px;outline:0}
.search-box{box-sizing:border-box;height:42px;display:flex;align-items:center;gap:10px;padding:0 12px;border:1px solid var(--admin-border);border-radius:8px;background:#fff;color:#8a96a8}.search-box input{width:100%;border:0;outline:0;background:transparent;color:var(--admin-heading);font-size:13px}.search-box input::placeholder{color:#8a96a8}
.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}th,td{padding:14px 16px;text-align:left;border-bottom:1px solid #edf0f5;font-size:12px;color:var(--admin-muted);vertical-align:middle}th{font-size:11px;font-weight:700;color:#667085;background:#fbfcfe;white-space:nowrap}td strong{color:var(--admin-heading)}
.name-cell{display:flex;align-items:center;gap:10px}.row-icon{width:30px;height:30px;flex:0 0 30px;display:grid;place-items:center;border-radius:7px;color:#2b3442;background:#f2f4f7}
.stacked{display:flex;flex-direction:column;gap:3px}.stacked small{font-size:11px;color:var(--admin-muted)}.stacked .activity{max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hazard-badge{display:inline-block;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}.hazard-badge.low{background:#ecfdf3;color:#067647}.hazard-badge.high{background:#fffaeb;color:#b54708}.hazard-badge.very-high{background:#fef3f2;color:#b42318}
.actions-head{text-align:right}.actions{text-align:right}
.icon-button{width:32px;height:32px;display:inline-grid;place-items:center;border:1px solid var(--admin-border);border-radius:7px;background:#fff;color:#68758a;cursor:pointer}.icon-button:hover{border-color:#d7a900;background:#fff9df;color:#111827}
.table-footer{padding:14px 16px;color:var(--admin-muted);font-size:12px}.state-row{padding:80px 20px;text-align:center;color:var(--admin-muted)}.empty-state{display:flex;flex-direction:column;align-items:center;gap:7px}.empty-state i{font-size:30px;margin-bottom:4px}.empty-state strong{color:var(--admin-heading)}.error-state{color:#b42318}
.modal-backdrop{position:fixed;inset:0;z-index:100;background:rgba(15,23,42,.16);display:grid;place-items:center;padding:20px}
.modal-card{width:min(460px,100%);padding:22px;background:#fff;border-radius:12px;box-shadow:0 20px 60px rgba(15,23,42,.18)}
.modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:22px}.modal-head h2{margin:0;color:var(--admin-heading);font-size:18px}.modal-head p{margin:5px 0 0;color:var(--admin-muted);font-size:12px}
.close-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:#7b8798;cursor:pointer;border-radius:7px}.close-button:hover{background:#f3f5f8;color:#111827}
.modal-card label{display:flex;flex-direction:column;margin-bottom:16px;color:var(--admin-heading);font-size:12px;font-weight:700}.modal-card label span{color:#d92d20}.modal-card label small{font-weight:400;color:var(--admin-muted)}
.modal-card input,.modal-card select{width:100%;height:42px;margin-top:7px;padding:0 12px;border:1px solid var(--admin-border);border-radius:8px;outline:0;background:#fff;font:inherit;font-size:13px;color:var(--admin-heading)}
.modal-card input:focus,.modal-card select:focus{border-color:#d7a900;box-shadow:0 0 0 3px rgba(255,193,7,.12)}
.hint{margin:-8px 0 14px;font-size:12px}.hint.warn{color:#b54708}
.form-error{margin:0 0 8px;color:#b42318;font-size:12px}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}.secondary-button{min-height:40px;padding:0 18px;border:1px solid var(--admin-border);border-radius:8px;background:#f7f8fa;color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}
@media(max-width:900px){.toolbar{grid-template-columns:1fr}.page-head{align-items:flex-start;flex-direction:column}.primary-button{align-self:flex-end}}
</style>
