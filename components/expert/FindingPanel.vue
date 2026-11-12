<template>
  <div class="drawer-backdrop">
    <aside class="finding-drawer" role="dialog" aria-modal="true" aria-labelledby="finding-title">
      <div class="drawer-head">
        <div class="head-main">
          <span v-if="finding" class="status-chip" :class="FINDING_STATUS[finding.status]?.tone">{{ FINDING_STATUS[finding.status]?.label }}</span>
          <h2 id="finding-title">Bulgu detayı</h2>
          <p v-if="finding">{{ subjectText }}<template v-if="placeText"> · {{ placeText }}</template></p>
        </div>
        <button class="close-button" type="button" aria-label="Kapat" @click="emit('close')"><i class="pi pi-times" /></button>
      </div>

      <div v-if="loading && !finding" class="drawer-state"><i class="pi pi-spin pi-spinner" /> Bulgu yükleniyor...</div>
      <div v-else-if="loadError" class="drawer-state error-text">{{ loadError }}</div>
      <div v-else-if="finding" class="drawer-body">
        <!-- Yeni uygun rapor: kapatma önerisi (kendiliğinden kapanmaz, kullanıcı onaylar) -->
        <div v-if="finding.close_suggestion && finding.status !== 'kapandi'" class="suggestion">
          <i class="pi pi-check-circle" />
          <div>
            <strong>Yeni rapor uygun ({{ findingDay(finding.close_suggestion.date) }})</strong>
            <span>Bu bulgu son raporda geçmiyor. Bulgu kapatılsın mı?</span>
          </div>
          <div class="suggestion-actions">
            <button class="secondary-button small" type="button" :disabled="busy" @click="rejectSuggestion">Açık kalsın</button>
            <button class="primary-button small" type="button" :disabled="busy" @click="close(null)">Kapat</button>
          </div>
        </div>

        <section class="block">
          <h3>Bulgu</h3>
          <p class="finding-text">{{ finding.text }}</p>
          <p v-if="finding.component" class="muted"><i class="pi pi-box" /> {{ finding.component }}</p>
          <ul class="sources">
            <li v-for="source in finding.sources" :key="`${source.type}-${source.id}`">
              <span>{{ findingDay(source.control_date) }} raporu<template v-if="source.report_no"> · No {{ source.report_no }}</template></span>
              <span class="source-status" :class="source.status === 'uygun' ? 'ok' : 'bad'">{{ source.status === 'uygun' ? 'Uygun' : 'Uygun değil' }}</span>
              <button v-if="source.file_url" class="link-button" type="button" @click="openFile(source.file_url)"><i class="pi pi-file-pdf" /> Raporu aç</button>
            </li>
            <li v-if="!finding.sources.length" class="muted">Bulgunun geçtiği rapor silinmiş.</li>
          </ul>
        </section>

        <section class="block">
          <h3>Takip</h3>
          <label>Yapılacak iş
            <textarea v-model="form.work" rows="3" :disabled="closed" placeholder="Ör. Etiket yenilenecek ve görünür şekilde takılacak." />
          </label>
          <label>Sorumlu
            <select v-model="form.responsible_user_id" :disabled="closed">
              <option :value="null">Seçilmedi</option>
              <option v-for="person in responsibles" :key="person.id" :value="person.id">{{ person.name }}</option>
            </select>
          </label>
          <button v-if="canInvite && !closed" class="link-button invite" type="button" @click="openInvite"><i class="pi pi-user-plus" /> Listede yok mu? Kullanıcı ekle</button>
          <div class="two">
            <label>Termin
              <input v-model="form.due_date" type="date" :disabled="closed" />
            </label>
            <label>Durum
              <select v-model="form.status" :disabled="closed">
                <option v-for="key in ['acik', 'devam', 'tekrar_kontrol']" :key="key" :value="key">{{ FINDING_STATUS[key].label }}</option>
              </select>
            </label>
          </div>
          <label>Tekrar kontrol tarihi
            <input v-model="form.recheck_date" type="date" :disabled="closed" />
          </label>
          <p class="hint">Tekrar kontrol tarihi girilince durum "Tekrar kontrol bekliyor" olur ve tarih Kontrol Takvimi'nde görünür.</p>
          <p v-if="saveError" class="error-text small-text">{{ saveError }}</p>
          <div v-if="!closed" class="row-actions">
            <button class="primary-button" type="button" :disabled="busy || !dirty" @click="save">{{ busy ? 'Kaydediliyor...' : 'Kaydet' }}</button>
          </div>
        </section>

        <section class="block">
          <h3>Not ve kanıt</h3>
          <label>Not
            <textarea v-model="note" rows="2" placeholder="Ör. Firmaya bildirildi, parça siparişi verildi." />
          </label>
          <div class="row-actions">
            <button class="secondary-button" type="button" :disabled="busy || !note.trim()" @click="addNote">Not ekle</button>
          </div>
          <div class="file-row">
            <input ref="fileInput" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx" @change="pickFile" />
            <button class="secondary-button" type="button" :disabled="busy || !file" @click="upload"><i class="pi pi-paperclip" /> Kanıt ekle</button>
          </div>
          <ul v-if="files.length" class="files">
            <li v-for="item in files" :key="item.id">
              <button class="link-button" type="button" @click="openFile(`pk-findings/${finding.id}/files/${item.id}`)"><i class="pi pi-file" /> {{ item.file_name }}</button>
              <small>{{ item.user || '' }} · {{ formatTime(item.created_at) }}</small>
            </li>
          </ul>
        </section>

        <section class="block">
          <h3>Bulguyu kapat</h3>
          <template v-if="!closed">
            <label>Kapanış notu (isteğe bağlı)
              <textarea v-model="closeNote" rows="2" placeholder="Ör. Etiket yenilendi, fotoğraf eklendi." />
            </label>
            <div class="row-actions">
              <button class="primary-button" type="button" :disabled="busy" @click="close(closeNote)"><i class="pi pi-check" /> Bulguyu kapat</button>
            </div>
          </template>
          <div v-else class="closed-row">
            <span><i class="pi pi-check-circle" /> {{ formatTime(finding.closed_at) }} tarihinde kapatıldı.</span>
            <button class="secondary-button" type="button" :disabled="busy" @click="reopen">Yeniden aç</button>
          </div>
        </section>

        <section class="block">
          <h3>İşlem geçmişi</h3>
          <ol class="timeline">
            <li v-for="event in finding.events" :key="event.id" :class="eventTone(event.type)">
              <div class="event-head">
                <strong>{{ FINDING_EVENT_LABELS[event.type] || event.type }}</strong>
                <small>{{ formatTime(event.created_at) }}</small>
              </div>
              <p v-for="line in eventLines(event)" :key="line">{{ line }}</p>
              <small v-if="event.user" class="muted">{{ event.user }}</small>
            </li>
          </ol>
        </section>
      </div>
    </aside>

    <!-- Kullanıcı ekle (Ayarlar › Kullanıcılar ile aynı davet); eklenen kişi hemen sorumlu olur -->
    <div v-if="inviteOpen" class="modal-backdrop">
      <section class="modal-card">
        <div class="modal-head">
          <div><h2>Kullanıcı Ekle</h2><p>Davet e-postası gider; kullanıcı kendi şifresini belirler.</p></div>
          <button class="close-button" type="button" aria-label="Kapat" @click="inviteOpen = false"><i class="pi pi-times" /></button>
        </div>
        <label>Ad Soyad <span>*</span><input v-model="inviteForm.name" type="text" placeholder="Örn. Ayşe Demir" /></label>
        <label>E-posta <span>*</span><input v-model="inviteForm.email" type="email" placeholder="ornek@firma.com" /></label>
        <label>Rol <span>*</span>
          <select v-model="inviteForm.role"><option v-for="(label, key) in ACCOUNT_ROLE_LABELS" :key="key" :value="key">{{ label }}</option></select>
        </label>
        <p v-if="inviteError" class="error-text small-text">{{ inviteError }}</p>
        <div class="modal-actions">
          <button class="secondary-button" type="button" @click="inviteOpen = false">İptal</button>
          <button class="primary-button" type="button" :disabled="inviting || !inviteForm.name.trim() || !inviteForm.email.trim()" @click="invite">{{ inviting ? 'Gönderiliyor...' : 'Davet Et ve Sorumlu Yap' }}</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
// Bulgu Takip detay paneli: bulgu ve raporları, yapılacak iş / sorumlu / termin / durum / tekrar kontrol, not, kanıt dosyası,
// kapatma (ya da yeni uygun raporun kapatma önerisi) ve işlem geçmişi. Yalnız X ile kapanır.
const props = defineProps<{ findingId: number; responsibles: { id: number; name: string }[]; canInvite: boolean }>()
const emit = defineEmits<{ close: []; changed: []; 'responsibles-changed': [] }>()

const { get, post, postForm, patch, getBlob, errorMessage } = useExpertApi()

const finding = ref<any>(null)
const loading = ref(false)
const loadError = ref('')
const busy = ref(false)
const saveError = ref('')
const form = reactive<{ work: string; responsible_user_id: number | null; due_date: string; status: string; recheck_date: string }>({ work: '', responsible_user_id: null, due_date: '', status: 'acik', recheck_date: '' })
const note = ref('')
const closeNote = ref('')
const file = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const closed = computed(() => finding.value?.status === 'kapandi')
const subjectText = computed(() => {
  const subject = finding.value?.subject
  if (!subject) return ''
  return [subject.name, subject.code, subject.detail].filter(Boolean).join(' · ')
})
const placeText = computed(() => [finding.value?.workplace?.company_name, finding.value?.location?.name].filter(Boolean).join(' · '))
const files = computed(() => (finding.value?.events || []).filter((event: any) => event.type === 'dosya'))

const fill = (data: any) => {
  finding.value = data
  Object.assign(form, {
    work: data.work || '', responsible_user_id: data.responsible?.id ?? null, due_date: data.due_date || '',
    status: data.status === 'kapandi' ? 'acik' : data.status, recheck_date: data.recheck_date || ''
  })
}
const payload = () => {
  const data: Record<string, any> = {
    work: form.work.trim() || null, responsible_user_id: form.responsible_user_id, due_date: form.due_date || null,
    status: form.status, recheck_date: form.recheck_date || null
  }
  // Tekrar kontrol tarihi yeni girildiyse durum "Tekrar kontrol bekliyor".
  if (data.recheck_date && data.recheck_date !== finding.value?.recheck_date && data.status !== 'tekrar_kontrol') data.status = 'tekrar_kontrol'
  return data
}
const dirty = computed(() => {
  if (!finding.value) return false
  const current = { work: finding.value.work || null, responsible_user_id: finding.value.responsible?.id ?? null, due_date: finding.value.due_date || null, status: finding.value.status, recheck_date: finding.value.recheck_date || null }
  return JSON.stringify(current) !== JSON.stringify(payload())
})

const load = async () => {
  loading.value = true
  loadError.value = ''
  try { fill(await get(`/pk-findings/${props.findingId}`)) }
  catch (e: any) { loadError.value = errorMessage(e, 'Bulgu alınamadı.') }
  finally { loading.value = false }
}

// Her işlem sunucunun döndürdüğü güncel bulguyla paneli yeniler; liste ve rozet de yenilenir.
const run = async (action: () => Promise<any>, fallback: string) => {
  if (busy.value) return
  busy.value = true
  saveError.value = ''
  try {
    fill(await action())
    emit('changed')
    return true
  } catch (e: any) {
    saveError.value = errorMessage(e, fallback)
    return false
  } finally { busy.value = false }
}

const save = () => run(() => patch(`/pk-findings/${props.findingId}`, payload()), 'Bulgu kaydedilemedi.')
const addNote = async () => { if (await run(() => post(`/pk-findings/${props.findingId}/notes`, { note: note.value.trim() }), 'Not eklenemedi.')) note.value = '' }
const pickFile = (event: Event) => { file.value = (event.target as HTMLInputElement).files?.[0] || null }
const upload = async () => {
  if (!file.value) return
  const body = new FormData()
  body.append('file', file.value)
  if (await run(() => postForm(`/pk-findings/${props.findingId}/files`, body), 'Dosya yüklenemedi.')) {
    file.value = null
    if (fileInput.value) fileInput.value.value = ''
  }
}
const close = async (text: string | null) => { if (await run(() => post(`/pk-findings/${props.findingId}/close`, { note: text?.trim() || null }), 'Bulgu kapatılamadı.')) closeNote.value = '' }
const reopen = () => run(() => post(`/pk-findings/${props.findingId}/reopen`, {}), 'Bulgu açılamadı.')
const rejectSuggestion = () => run(() => post(`/pk-findings/${props.findingId}/reject-suggestion`, {}), 'Öneri reddedilemedi.')

// Yetki isteyen dosyalar Blob olarak alınıp yeni sekmede açılır.
const openFile = async (path: string) => {
  const tab = window.open('', '_blank')
  try {
    const blob = await getBlob(`/${path}`)
    const url = URL.createObjectURL(blob)
    if (tab) tab.location.href = url
    else window.location.href = url
  } catch (e: any) {
    tab?.close()
    saveError.value = errorMessage(e, 'Dosya açılamadı.')
  }
}

// Kullanıcı ekle: davet edilir, sorumlu listesi yenilenir, kişi hemen sorumlu olarak kaydedilir.
const inviteOpen = ref(false)
const inviting = ref(false)
const inviteError = ref('')
const inviteForm = reactive({ name: '', email: '', role: 'uzman' })
const openInvite = () => { Object.assign(inviteForm, { name: '', email: '', role: 'uzman' }); inviteError.value = ''; inviteOpen.value = true }
const invite = async () => {
  inviting.value = true
  inviteError.value = ''
  try {
    const response = await post<{ user: { id: number } }>('/pk-account/users', { name: inviteForm.name.trim(), email: inviteForm.email.trim(), role: inviteForm.role })
    emit('responsibles-changed')
    inviteOpen.value = false
    form.responsible_user_id = response.user.id
    await run(() => patch(`/pk-findings/${props.findingId}`, { responsible_user_id: response.user.id }), 'Sorumlu kaydedilemedi.')
  } catch (e: any) { inviteError.value = errorMessage(e, 'Kullanıcı eklenemedi.') }
  finally { inviting.value = false }
}

const formatTime = (value?: string | null) => value ? new Date(value).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const eventTone = (type: string) => ['kapandi', 'oneri'].includes(type) ? 'ok' : ['hatirlatma', 'rapordan_cikarildi'].includes(type) ? 'warn' : ''
const fieldValue = (field: string, value: any, names: Record<string, any>, side: 'old' | 'new') => {
  if (value === null || value === undefined || value === '') return '—'
  if (field === 'status') return FINDING_STATUS[value]?.label || value
  if (field === 'responsible_user_id') return names[`${side}_name`] || '—'
  if (field === 'due_date' || field === 'recheck_date') return findingDay(String(value))
  return String(value)
}
const eventLines = (event: any): string[] => {
  const lines: string[] = []
  if (event.type === 'guncellendi' && event.meta) {
    for (const [field, change] of Object.entries<any>(event.meta)) {
      lines.push(`${FINDING_FIELD_LABELS[field] || field}: ${fieldValue(field, change.old, change, 'old')} → ${fieldValue(field, change.new, change, 'new')}`)
    }
  }
  if (['olusturuldu', 'tekrar_goruldu', 'oneri'].includes(event.type) && event.meta?.control_date) lines.push(`${findingDay(event.meta.control_date)} tarihli rapor`)
  if (event.type === 'dosya' && event.file_name) lines.push(event.file_name)
  if (event.note) lines.push(event.note)
  return lines
}

watch(() => props.findingId, load)
onMounted(load)
</script>

<style scoped>
.drawer-backdrop{position:fixed;inset:0;z-index:100;background:var(--admin-overlay)}
.finding-drawer{position:absolute;top:0;right:0;width:min(560px,100vw);height:100%;background:var(--admin-input);box-shadow:-12px 0 30px var(--admin-shadow);display:flex;flex-direction:column}
.drawer-head{padding:22px 20px 16px;border-bottom:1px solid var(--admin-border);display:flex;justify-content:space-between;gap:15px}
.head-main{display:grid;gap:6px;min-width:0}.head-main h2{margin:0;font-size:18px;color:var(--admin-heading)}.head-main p{margin:0;color:var(--admin-muted);font-size:12px;line-height:1.5}
.drawer-state{display:flex;align-items:center;justify-content:center;gap:8px;padding:50px 25px;color:var(--admin-muted);font-size:13px}
.drawer-body{flex:1;overflow-y:auto;padding:16px 20px 30px;display:grid;gap:14px;align-content:start}
.block{display:grid;gap:10px;padding:14px;border:1px solid var(--admin-border);border-radius:10px;background:var(--admin-card)}
.block h3{margin:0;color:var(--admin-heading);font-size:14px}
.finding-text{margin:0;color:var(--admin-heading);font-size:14px;line-height:1.55}
.muted{margin:0;color:var(--admin-muted);font-size:12px}
.sources,.files,.timeline{margin:0;padding:0;list-style:none;display:grid;gap:8px}
.sources li{display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px;font-size:12px;color:var(--admin-text)}
.source-status{padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700}.source-status.ok{background:var(--admin-success-bg);color:var(--admin-success-text)}.source-status.bad{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
label{display:grid;gap:6px;color:var(--admin-heading);font-size:12px;font-weight:700}
input,select,textarea{width:100%;min-height:40px;padding:8px 11px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:13px;font-weight:400;outline:0}
textarea{resize:vertical;line-height:1.5}
input:focus,select:focus,textarea:focus{border-color:#d7a900;box-shadow:0 0 0 3px rgba(255,193,7,.12)}
input:disabled,select:disabled,textarea:disabled{opacity:.7}
input[type=file]{min-height:auto;padding:7px;font-size:12px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.hint{margin:-4px 0 0;color:var(--admin-muted);font-size:11.5px;line-height:1.5}
.row-actions{display:flex;justify-content:flex-end;gap:10px}
.file-row{display:flex;gap:10px;align-items:center}.file-row .secondary-button{flex:none;white-space:nowrap}
.files li{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px;font-size:12px}.files small{color:var(--admin-muted)}
.link-button{display:inline-flex;align-items:center;gap:6px;padding:0;border:0;background:transparent;color:var(--admin-link);font:inherit;font-size:12px;font-weight:600;cursor:pointer;text-align:left}
.link-button.invite{justify-self:start;margin-top:-4px}
.status-chip{justify-self:start;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:800}
.status-chip.bad{background:var(--admin-danger-bg);color:var(--admin-danger-text)}.status-chip.warn{background:var(--admin-warning-bg);color:var(--admin-warning-text)}
.status-chip.ok{background:var(--admin-success-bg);color:var(--admin-success-text)}.status-chip.info{background:var(--admin-accent-soft);color:var(--admin-link)}
.suggestion{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;align-items:start;padding:14px;border-radius:10px;background:var(--admin-success-bg);color:var(--admin-success-text)}
.suggestion>i{margin-top:2px;font-size:18px}.suggestion div:not(.suggestion-actions){display:grid;gap:3px;font-size:13px}.suggestion span{font-size:12px}
.suggestion-actions{grid-column:1 / -1;display:flex;justify-content:flex-end;gap:8px}
.closed-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;color:var(--admin-success-text);font-size:13px}
.timeline li{position:relative;display:grid;gap:3px;padding:0 0 0 16px;border-left:2px solid var(--admin-border)}
.timeline li::before{content:'';position:absolute;left:-6px;top:4px;width:10px;height:10px;border-radius:50%;background:var(--admin-muted)}
.timeline li.ok::before{background:var(--admin-success-text)}.timeline li.warn::before{background:var(--admin-warning-text)}
.event-head{display:flex;justify-content:space-between;gap:10px;font-size:12.5px;color:var(--admin-heading)}.event-head small{color:var(--admin-muted);white-space:nowrap}
.timeline p{margin:0;color:var(--admin-text);font-size:12px;line-height:1.5}
.error-text{color:var(--admin-danger-text)}.small-text{margin:0;font-size:12px}
.close-button{flex:none;width:34px;height:34px;display:grid;place-items:center;border:0;border-radius:7px;background:transparent;color:var(--admin-muted);cursor:pointer}.close-button:hover{background:var(--admin-hover);color:var(--admin-heading)}
.primary-button,.secondary-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:40px;padding:0 16px;border-radius:8px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.primary-button{border:0;background:var(--pk-yellow);color:#111827}.secondary-button{border:1px solid var(--admin-border);background:var(--admin-hover);color:var(--admin-heading)}
.primary-button:disabled,.secondary-button:disabled{opacity:.55;cursor:not-allowed}
.small{min-height:34px;padding:0 12px;font-size:12px}
.modal-backdrop{position:fixed;inset:0;z-index:110;background:var(--admin-overlay);display:grid;place-items:center;padding:20px}
.modal-card{width:min(460px,100%);display:grid;gap:14px;padding:22px;background:var(--admin-input);border-radius:12px;box-shadow:0 20px 60px var(--admin-shadow)}
.modal-head{display:flex;justify-content:space-between;gap:15px}.modal-head h2{margin:0;color:var(--admin-heading);font-size:18px}.modal-head p{margin:5px 0 0;color:var(--admin-muted);font-size:12px}
.modal-card label span{color:var(--admin-danger-text)}
.modal-actions{display:flex;justify-content:flex-end;gap:10px}
@media (max-width:640px){.two{grid-template-columns:1fr}.file-row{flex-direction:column;align-items:stretch}}
</style>
