<template>
  <div class="companies-page">
    <div class="page-head">
      <div>
        <div class="breadcrumb"><span>Ayarlar</span><i class="pi pi-angle-right" /><strong>Firmalar</strong></div>
        <h1>Firmalar</h1>
        <p v-if="canDelete">Firma tanımlarını yönetin. Firmaları lokasyonlara Lokasyonlar sayfasından atarsınız.</p>
        <p v-else>Hesaptaki firmalar. Firma tanımlarını yönetici değiştirir; uzman atamasını aşağıdan yaparsınız.</p>
      </div>
      <button v-if="canDelete" class="primary-button" type="button" @click="openCompanyForm(null)">
        <i class="pi pi-plus" /><span>Firma Tanımla</span>
      </button>
    </div>

    <section class="table-card">
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
              <th>Unvan</th>
              <th>Tür</th>
              <th>Lokasyon</th>
              <th>Oluşturma Tarihi</th>
              <th class="actions-head">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="company in filteredCompanies" :key="company.business_entity_id">
              <td><div class="name-cell"><span class="row-icon"><i class="pi pi-briefcase" /></span><strong>{{ company.name }}</strong></div></td>
              <td>{{ titleOf[company.business_entity_id] || '—' }}</td>
              <td>{{ companyTypeLabel(company.company_type) }}</td>
              <td>{{ company.locations_count ?? 0 }}</td>
              <td>{{ formatDate(company.created_at) }}</td>
              <td class="actions">
                <button v-if="canDelete" class="icon-button" type="button" title="Düzenle" @click="openCompanyForm(company)"><i class="pi pi-pencil" /></button>
                <button v-if="canDelete" class="icon-button danger" type="button" title="Sil" @click="openDelete(company)"><i class="pi pi-trash" /></button>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="table-footer"><span>Toplam {{ filteredCompanies.length }} firma</span></div>
      </div>
    </section>

    <!-- OSGB / kurumsal hesap: uzman ↔ firma ataması (yönetici, operasyon yöneticisi); bireysel uzmanda yok -->
    <ExpertWorkplaceAssignments v-if="canAssign" />

    <div v-if="companyFormOpen" class="modal-backdrop">
      <section class="modal-card wide">
        <div class="modal-head">
          <div class="head-title"><span class="head-icon"><i :class="editingCompany ? 'pi pi-pencil' : 'pi pi-briefcase'" /></span><div><h2>{{ editingCompany ? 'Firmayı Düzenle' : 'Firma Tanımla' }}</h2><p>{{ editingCompany ? 'Firma kartının bilgilerini güncelleyin; değişiklik firmanın bütün işyerlerinde görünür.' : 'Firma kartı, firmanın kimlik bilgileridir (ad, ünvan, tür).' }}</p></div></div>
          <button class="close-button" type="button" @click="closeCompanyForm"><i class="pi pi-times" /></button>
        </div>
        <div v-if="!editingCompany" class="info-box"><i class="pi pi-lightbulb" /><span>Firmayı bir lokasyona Lokasyonlar sayfasındaki <strong>Lokasyona Firma Tanımla</strong> ile atarsınız. Aynı firma birden fazla lokasyonda işyeri olabilir; firma kartı bir kez tanımlanır.</span></div>
        <label>Firma Adı <span>*</span><input v-model="companyForm.name" type="text" placeholder="Örn. ABC Gıda A.Ş." /></label>
        <p v-if="!duplicateCompany" class="field-hint"><i class="pi pi-info-circle" /> Listelerde ve raporlarda görünen ad.</p>
        <p v-if="duplicateCompany" class="hint warn">"{{ duplicateCompany.name }}" zaten kayıtlı.</p>
        <!-- Ünvan bir kez tanımlanır; aynı şirketin işletmeleri listeden aynı ünvanı seçer -->
        <label>Unvan <small>(Opsiyonel)</small><input v-model="companyForm.title" type="text" list="company-titles" placeholder="Örn. ABC Gıda Sanayi ve Ticaret A.Ş." /></label>
        <datalist id="company-titles"><option v-for="title in titles" :key="title.id" :value="title.name" /></datalist>
        <p class="field-hint"><i class="pi pi-info-circle" /> Resmî ünvan. Aynı şirketin birden fazla firması varsa hepsine aynı ünvanı seçin; daha önce girilenler öneri olarak çıkar.</p>
        <!-- Kısa Ad formdan kaldırıldı (kullanıcı 18 Ekim 2026: PKTakip'te kullanılmıyor); düzenlemede mevcut değer aynen geri gönderilir. -->
        <div class="type-field">
          <span class="type-label">Firma Türü <span>*</span></span>
          <div class="type-options">
            <button type="button" class="type-option" :class="{ on: companyForm.company_type === 'corporate' }" @click="companyForm.company_type = 'corporate'">
              <i class="pi pi-building" /><span><strong>Kurumsal</strong><small>Şirket (A.Ş., Ltd. Şti.) ya da kamu kurumu.</small></span>
            </button>
            <button type="button" class="type-option" :class="{ on: companyForm.company_type === 'individual' }" @click="companyForm.company_type = 'individual'">
              <i class="pi pi-user" /><span><strong>Bireysel (Şahıs)</strong><small>Tek kişiye ait işletme.</small></span>
            </button>
          </div>
        </div>
        <p v-if="companyFormError" class="form-error">{{ companyFormError }}</p>
        <div class="modal-actions">
          <button class="secondary-button" type="button" @click="closeCompanyForm">İptal</button>
          <button class="primary-button" type="button" :disabled="companySaving || !companyForm.name.trim() || !!duplicateCompany" @click="saveCompany">{{ companySaving ? 'Kaydediliyor...' : 'Kaydet' }}</button>
        </div>
      </section>
    </div>

    <!-- Firma silme: önce bağlı kayıtlar kontrol edilir; verisi olan firma silinmez -->
    <div v-if="deleteTarget" class="modal-backdrop">
      <section class="modal-card wide">
        <div class="modal-head">
          <div class="head-title"><span class="head-icon danger"><i class="pi pi-trash" /></span><div><h2>Firmayı Sil</h2><p>"{{ deleteTarget.name }}" firma kartı kalıcı olarak silinir. Verisi (işyeri, ekipman, rapor) olan firma, kayıtlar kaybolmasın diye silinmez.</p></div></div>
          <button class="close-button" type="button" :disabled="deleting" @click="closeDelete"><i class="pi pi-times" /></button>
        </div>
        <p v-if="deleteLoading" class="delete-text"><i class="pi pi-spin pi-spinner" /> Firmanın kayıtları kontrol ediliyor...</p>
        <template v-else-if="deleteSummary">
          <div v-if="!deleteSummary.deletable" class="delete-block">
            <i class="pi pi-ban" />
            <div>
              <strong>Bu firma silinemez</strong>
              <span>Bağlı kayıtlar: {{ deleteSummary.blockers.map(row => `${row.count} ${row.label}`).join(', ') }}.</span>
              <small>Kayıtlar yanlışlıkla silinmesin diye verisi olan firma silinmez.<template v-if="deleteSummary.blockers.some(row => row.label === 'uzman ataması')"> Uzman atamasını bu sayfanın altındaki "Uzman atamaları" bölümünden kaldırabilirsiniz.</template></small>
            </div>
          </div>
          <p v-else class="delete-text">
            <strong>{{ deleteTarget.name }}</strong> silinecek<template v-if="deleteSummary.locations">; {{ deleteSummary.locations }} lokasyon bağlantısı da kaldırılacak (bu lokasyonlarda firmaya ait kayıt yok)</template>. Bu işlem geri alınamaz.
          </p>
        </template>
        <p v-if="deleteError" class="form-error">{{ deleteError }}</p>
        <div class="modal-actions">
          <button class="secondary-button" type="button" :disabled="deleting" @click="closeDelete">{{ deleteSummary?.deletable ? 'Vazgeç' : 'Kapat' }}</button>
          <button v-if="deleteSummary?.deletable" class="danger-button" type="button" :disabled="deleting" @click="confirmDelete">{{ deleting ? 'Siliniyor...' : 'Sil' }}</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'expert-settings', middleware: ['expert', 'expert-settings-role'] })

const { get, post, patch, del, errorMessage } = useExpertApi()
const trLower = (value?: string | null) => (value || '').toLocaleLowerCase('tr-TR')

// Firma adı değişince topbar seçicisindeki işyeri adları da güncel kalsın.
const { load: refreshMyWorkplaces } = useMyWorkplaces()

const companies = ref<MyCompany[]>([])
const companiesLoading = ref(true)
const companiesError = ref('')
const companySearch = ref('')
const companyFormOpen = ref(false)
const companySaving = ref(false)
const companyFormError = ref('')
const editingCompany = ref<MyCompany | null>(null)
const companyForm = reactive({ name: '', short_name: '', company_type: 'corporate', title: '' })

// Firma ünvanları: hesapta bir kez tanımlanır, firmalar ona bağlanır (titleOf: firma → ünvan adı).
const titles = ref<{ id: number; name: string; companies: number }[]>([])
const titleOf = ref<Record<string, string>>({})
const loadTitles = async () => {
  try {
    const data = await get<{ titles: { id: number; name: string; companies: number }[]; links: Record<string, number> }>('/pk-company-titles')
    const names: Record<string, string> = Object.fromEntries(data.titles.map(title => [String(title.id), title.name]))
    titles.value = data.titles
    titleOf.value = Object.fromEntries(Object.entries(data.links || {}).map(([entity, titleId]) => [entity, names[String(titleId)] || '']))
  } catch { titles.value = []; titleOf.value = {} }
}

const filteredCompanies = computed(() => {
  const q = trLower(companySearch.value.trim())
  return companies.value.filter(c => !q || trLower(c.name).includes(q) || trLower(c.short_name).includes(q) || trLower(titleOf.value[c.business_entity_id]).includes(q))
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
  Object.assign(companyForm, { name: company?.name || '', short_name: company?.short_name || '', company_type: company?.company_type || 'corporate', title: company ? titleOf.value[company.business_entity_id] || '' : '' })
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
    let businessEntityId = editingCompany.value?.business_entity_id
    if (editingCompany.value) await patch(`/my-companies/${businessEntityId}`, body)
    else businessEntityId = (await post<MyCompany>('/my-companies', body)).business_entity_id
    // Ünvan değiştiyse: yazılan ünvan hesapta varsa ona bağlanır, yoksa bir kez tanımlanır.
    const title = companyForm.title.trim()
    if (businessEntityId && title !== (titleOf.value[businessEntityId] || '')) await patch(`/pk-company-titles/${businessEntityId}`, { title: title || null })
    companyFormOpen.value = false
    await Promise.all([loadCompanies(), loadTitles(), refreshMyWorkplaces(true)])
  } catch (e: any) {
    companyFormError.value = errorMessage(e, 'Firma kaydedilemedi.')
  } finally { companySaving.value = false }
}

const formatDate = (value?: string) => value ? new Intl.DateTimeFormat('tr-TR').format(new Date(value)) : '—'

onMounted(loadCompanies)
onMounted(loadTitles)

// OSGB / kurumsal hesapta uzman ataması: yönetici ve operasyon yöneticisi.
const { multiUser, isManager, isOperation, load: loadAccount } = useAccount()
const canAssign = computed(() => multiUser.value && (isManager.value || isOperation.value))
onMounted(loadAccount)

// Firma tanımlama, düzenleme ve silme: OSGB / kurumsal hesapta yönetici, bireysel uzman hesabında uzman. Önce bağlı kayıtlar sorulur (sunucu ayrıca
// kontrol eder); yalnızca verisi olmayan firma silinir, verisiz lokasyon bağlantıları birlikte kalkar.
const canDelete = computed(() => !multiUser.value || isManager.value)
const deleteTarget = ref<MyCompany | null>(null)
const deleteSummary = ref<{ deletable: boolean; locations: number; blockers: { label: string; count: number }[] } | null>(null)
const deleteLoading = ref(false)
const deleting = ref(false)
const deleteError = ref('')
const openDelete = async (company: MyCompany) => {
  deleteTarget.value = company
  deleteSummary.value = null
  deleteError.value = ''
  deleteLoading.value = true
  try { deleteSummary.value = await get(`/my-companies/${company.business_entity_id}/delete-summary`) }
  catch (e: any) { deleteError.value = errorMessage(e, 'Firmanın kayıtları kontrol edilemedi.') }
  finally { deleteLoading.value = false }
}
const closeDelete = () => { if (!deleting.value) deleteTarget.value = null }
const confirmDelete = async () => {
  if (!deleteTarget.value || !deleteSummary.value?.deletable) return
  deleting.value = true
  deleteError.value = ''
  try {
    await del(`/my-companies/${deleteTarget.value.business_entity_id}`)
    deleteTarget.value = null
    await Promise.all([loadCompanies(), loadTitles(), refreshMyWorkplaces(true)])
  } catch (e: any) {
    deleteError.value = errorMessage(e, 'Firma silinemedi.')
  } finally { deleting.value = false }
}
</script>

<style scoped>
.companies-page { max-width: 1500px; margin: 0 auto; }
.page-head { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; margin-bottom:20px; }
.breadcrumb { display:flex; align-items:center; gap:8px; margin-bottom:10px; color:var(--admin-muted); font-size:12px; }.breadcrumb strong{color:var(--admin-heading)}
h1{margin:0;color:var(--admin-heading);font-size:30px;letter-spacing:-.7px}.page-head p{margin:7px 0 0;color:var(--admin-muted);font-size:13px}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:0 17px;border:0;border-radius:8px;background:var(--pk-yellow);color:#111827;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.07)}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.table-card{background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px;overflow:hidden}
.toolbar{padding:18px 16px;border-bottom:1px solid var(--admin-border);display:grid;grid-template-columns:minmax(180px,240px) minmax(160px,200px) 1fr;gap:12px;align-items:start}.toolbar.single{display:block}
.field{display:flex;flex-direction:column;gap:6px;margin:0;font-size:11px;font-weight:700;color:var(--admin-muted)}
.field select{box-sizing:border-box;height:42px;margin:0;padding:0 10px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:13px;outline:0}
.search-box{box-sizing:border-box;height:42px;display:flex;align-items:center;gap:10px;padding:0 12px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-muted)}.search-box input{width:100%;border:0;outline:0;background:transparent;color:var(--admin-heading);font-size:13px}.search-box input::placeholder{color:var(--admin-muted)}
.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}th,td{padding:14px 16px;text-align:left;border-bottom:1px solid var(--admin-row-border);font-size:12px;color:var(--admin-muted);vertical-align:middle}th{font-size:11px;font-weight:700;color:var(--admin-muted);background:var(--admin-soft);white-space:nowrap}td strong{color:var(--admin-heading)}
.name-cell{display:flex;align-items:center;gap:10px}.row-icon{width:30px;height:30px;flex:0 0 30px;display:grid;place-items:center;border-radius:7px;color:var(--admin-text);background:var(--admin-chip)}
.stacked{display:flex;flex-direction:column;gap:3px}.stacked small{font-size:11px;color:var(--admin-muted)}.stacked .activity{max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hazard-badge{display:inline-block;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}.hazard-badge.low{background:var(--admin-success-bg);color:var(--admin-success-text)}.hazard-badge.high{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.hazard-badge.very-high{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.actions-head{text-align:right}.actions{text-align:right}
.icon-button{width:32px;height:32px;display:inline-grid;place-items:center;border:1px solid var(--admin-border);border-radius:7px;background:var(--admin-input);color:var(--admin-muted);cursor:pointer}.icon-button:hover{border-color:#d7a900;background:var(--admin-accent-soft);color:var(--admin-heading)}
.actions .icon-button + .icon-button{margin-left:6px}.icon-button.danger:hover{border-color:var(--admin-danger-text);background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.delete-text{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:0;color:var(--admin-text);font-size:13px;line-height:1.5}.delete-text strong{color:var(--admin-heading)}
.delete-block{display:flex;gap:12px;padding:12px 14px;border:1px solid var(--admin-danger-text);border-radius:10px;background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.delete-block > i{margin-top:2px;font-size:16px}.delete-block div{display:flex;flex-direction:column;gap:4px;font-size:12px;line-height:1.45}.delete-block strong{font-size:13px}.delete-block small{color:var(--admin-text);font-size:11px}
.danger-button{min-height:40px;padding:0 18px;border:0;border-radius:8px;background:var(--admin-danger-text);color:#fff;font-size:13px;font-weight:800;cursor:pointer}.danger-button:disabled{opacity:.55;cursor:not-allowed}
.table-footer{padding:14px 16px;color:var(--admin-muted);font-size:12px}.state-row{padding:80px 20px;text-align:center;color:var(--admin-muted)}.empty-state{display:flex;flex-direction:column;align-items:center;gap:7px}.empty-state i{font-size:30px;margin-bottom:4px}.empty-state strong{color:var(--admin-heading)}.error-state{color:var(--admin-danger-text)}
.modal-backdrop{position:fixed;inset:0;z-index:100;background:var(--admin-overlay);display:grid;place-items:center;padding:20px}
.modal-card{width:min(460px,100%);padding:22px;background:var(--admin-input);border-radius:12px;box-shadow:0 20px 60px var(--admin-shadow)}
.modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:22px}.modal-head h2{margin:0;color:var(--admin-heading);font-size:18px}.modal-head p{margin:5px 0 0;color:var(--admin-muted);font-size:12px}
.close-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:var(--admin-muted);cursor:pointer;border-radius:7px}.close-button:hover{background:var(--admin-hover);color:var(--admin-heading)}
.modal-card label{display:block;margin-bottom:16px;color:var(--admin-heading);font-size:12px;font-weight:700}.modal-card label span{color:var(--admin-danger-text)}.modal-card label small{font-weight:400;color:var(--admin-muted)}
.modal-card input,.modal-card select{width:100%;height:42px;margin-top:7px;padding:0 12px;border:1px solid var(--admin-border);border-radius:8px;outline:0;background:var(--admin-input);font:inherit;font-size:13px;color:var(--admin-heading)}
.modal-card input:focus,.modal-card select:focus{border-color:#d7a900;box-shadow:0 0 0 3px rgba(255,193,7,.12)}
.hint{margin:-8px 0 14px;font-size:12px}.hint.warn{color:var(--admin-warning-text)}
/* Organizasyon ve firma pencereleri (kullanıcı 18 Ekim 2026): geniş, ikonlu başlık ve alan açıklamaları; yalnız X / İptal ile kapanır. */
.modal-card.wide{width:min(640px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:24px 26px;border-radius:14px}
.head-title{display:flex;align-items:flex-start;gap:14px}
.head-icon{flex:none;width:44px;height:44px;display:grid;place-items:center;border-radius:12px;background:var(--pk-yellow);color:#111827;font-size:19px}
.head-icon.danger{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.modal-card.wide .modal-head p{font-size:12.5px;line-height:1.55}
.field-hint{display:flex;gap:7px;margin:-10px 0 16px;color:var(--admin-muted);font-size:12px;line-height:1.5}.field-hint .pi{margin-top:2px}
.info-box{display:flex;gap:10px;margin:0 0 18px;padding:12px 14px;border-radius:10px;background:var(--admin-accent-soft);color:var(--admin-text);font-size:12.5px;line-height:1.55}.info-box .pi{margin-top:3px;color:#b58900}
.info-box.danger{background:var(--admin-danger-bg);color:var(--admin-danger-text)}.info-box.danger .pi{color:var(--admin-danger-text)}
.type-field{margin-bottom:16px}.type-label{display:block;margin-bottom:7px;color:var(--admin-heading);font-size:12px;font-weight:700}.type-label span{color:var(--admin-danger-text)}
.type-options{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.type-option{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--admin-border);border-radius:9px;background:var(--admin-input);text-align:left;cursor:pointer;font:inherit}
.type-option > .pi{width:32px;height:32px;display:grid;place-items:center;border-radius:8px;background:var(--admin-chip);color:var(--admin-heading)}
.type-option span{display:flex;flex-direction:column;gap:2px}.type-option strong{color:var(--admin-heading);font-size:12.5px}.type-option small{color:var(--admin-muted);font-size:11.5px}
.type-option:hover{border-color:#d7a900}.type-option.on{border-color:#d7a900;background:var(--admin-accent-soft)}.type-option.on > .pi{background:var(--pk-yellow);color:#111827}
@media(max-width:560px){.type-options{grid-template-columns:1fr}}

.form-error{margin:0 0 8px;color:var(--admin-danger-text);font-size:12px}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}.secondary-button{min-height:40px;padding:0 18px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-hover);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}
@media(max-width:900px){.toolbar{grid-template-columns:1fr}.page-head{align-items:flex-start;flex-direction:column}.primary-button{align-self:flex-end}}
</style>
