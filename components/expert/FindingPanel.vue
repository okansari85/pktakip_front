<template>
  <div class="finding-detail">
    <div class="detail-top">
      <div class="detail-main">
        <nav class="crumb" aria-label="Sayfa yolu">
          <i class="pi pi-home" aria-hidden="true" />
          <button type="button" class="crumb-link" @click="emit('close')">Bulgu takibi</button>
          <template v-if="finding?.subject?.name"><i class="pi pi-angle-right" aria-hidden="true" /><span>{{ finding.subject.name }}</span></template>
          <i class="pi pi-angle-right" aria-hidden="true" />
          <strong>Bulgu detayı</strong>
        </nav>
        <div class="title-row">
          <h1 id="finding-title">Bulgu detayı</h1>
          <!-- Son raporun sonucu (bulgunun geçtiği en yeni rapor) -->
          <span v-if="lastSource" class="result-chip" :class="lastSource.status === 'uygun' ? 'ok' : 'bad'">
            <i :class="lastSource.status === 'uygun' ? 'pi pi-check' : 'pi pi-times'" aria-hidden="true" /> {{ lastSource.status === 'uygun' ? 'Uygun' : 'Uygun değil' }}
          </span>
        </div>

        <div v-if="loading && !finding" class="card state"><i class="pi pi-spin pi-spinner" /> Bulgu yükleniyor...</div>
        <div v-else-if="loadError" class="card state error-text">{{ loadError }}</div>
        <template v-else-if="finding">
          <!-- Katalogdaki görsel (tasarım kataloğu 21'den kırpıldı, marka yazıları silindi); elle çizilmiş karşılığı public/katalog/bulgu-detay.svg -->
          <figure class="hero"><img src="/katalog/bulgu-detay-katalog.webp" alt="" /></figure>
          <p class="meta">
            <span><i :class="finding.subject?.kind === 'installation' ? 'pi pi-sitemap' : 'pi pi-box'" aria-hidden="true" /> <strong>{{ subjectText || '—' }}</strong><template v-if="placeText"> · {{ placeText }}</template></span>
            <span class="meta-sep" aria-hidden="true" />
            <span><i class="pi pi-file" aria-hidden="true" /> Rapor tarihi {{ findingDay(lastSource?.control_date || finding.last_seen_date) }}</span>
          </p>
          <div class="finding-head" :class="FINDING_STATUS[finding.status]?.tone">
            <h2>{{ finding.text }}</h2>
            <p v-if="finding.component">{{ finding.component }}</p>
          </div>
        </template>
      </div>

      <section v-if="finding" class="card work-card" aria-labelledby="work-title">
        <header class="card-head"><i class="pi pi-wrench" aria-hidden="true" /><h3 id="work-title">Düzeltici işlem</h3></header>
        <!-- Yeni uygun rapor: kapatma önerisi (katalogda yok, gizli; ileride açılabilir) -->
        <div v-if="SHOW_CLOSE_SUGGESTION && finding.close_suggestion && finding.status !== 'kapandi'" class="suggestion">
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
        <div class="form-rows">
          <label class="form-row"><span>Yapılacak iş</span>
            <textarea v-model="form.work" rows="3" :disabled="closed" placeholder="Ör. Etiket yenilenecek ve görünür şekilde takılacak." />
          </label>
          <label class="form-row"><span>Sorumlu</span>
            <span class="field select">
              <i class="pi pi-users" aria-hidden="true" />
              <select v-model="form.responsible_user_id" :disabled="closed">
                <option :value="null">Seçilmedi</option>
                <option v-for="person in responsibles" :key="person.id" :value="person.id">{{ person.name }}</option>
              </select>
              <i class="pi pi-chevron-down" aria-hidden="true" />
            </span>
          </label>
          <!-- Kullanıcı ekle: katalogda yok, gizli (pencere kodu yerinde); ileride açılabilir -->
          <button v-if="SHOW_INVITE && canInvite && !closed" class="link-button invite" type="button" @click="openInvite"><i class="pi pi-user-plus" /> Listede yok mu? Kullanıcı ekle</button>
          <label class="form-row"><span>Termin</span>
            <span class="field"><i class="pi pi-calendar" aria-hidden="true" /><input v-model="form.due_date" type="date" :disabled="closed" /></span>
          </label>
          <!-- Durum "Kapandı" seçilip kaydedilince bulgu kapatılır; kapalı bulguda başka durum seçilince yeniden açılır -->
          <label class="form-row"><span>Durum</span>
            <span class="field select">
              <span class="dot" :class="FINDING_STATUS[form.status]?.tone" aria-hidden="true" />
              <select v-model="form.status">
                <option v-for="(item, key) in FINDING_STATUS" :key="key" :value="key">{{ item.label }}</option>
              </select>
              <i class="pi pi-chevron-down" aria-hidden="true" />
            </span>
          </label>
          <label class="form-row"><span>Tekrar kontrol tarihi</span>
            <span class="field"><i class="pi pi-calendar" aria-hidden="true" /><input v-model="form.recheck_date" type="date" :disabled="closed" /></span>
          </label>
        </div>
        <p v-if="SHOW_RECHECK_HINT" class="hint">Tekrar kontrol tarihi girilince durum "Tekrar kontrol bekliyor" olur ve tarih Kontrol Takvimi'nde görünür.</p>
        <p v-if="saveError" class="error-text small-text">{{ saveError }}</p>
        <div class="form-actions">
          <button class="secondary-button" type="button" :disabled="busy || !dirty" @click="fill(finding)">Vazgeç</button>
          <button class="primary-button" type="button" :disabled="busy || !dirty" @click="save"><i class="pi pi-check" /> {{ busy ? 'Kaydediliyor...' : 'İşi ata' }}</button>
        </div>
      </section>
    </div>

    <div v-if="finding" class="detail-bottom">
      <section class="card notes-card" aria-labelledby="notes-title">
        <header class="card-head"><i class="pi pi-file-edit" aria-hidden="true" /><h3 id="notes-title">Not ve kanıt</h3></header>
        <div class="tabs" role="tablist">
          <button type="button" role="tab" :aria-selected="tab === 'notlar'" :class="{ on: tab === 'notlar' }" @click="tab = 'notlar'"><i class="pi pi-comment" /> Notlar</button>
          <button type="button" role="tab" :aria-selected="tab === 'dosyalar'" :class="{ on: tab === 'dosyalar' }" @click="tab = 'dosyalar'"><i class="pi pi-paperclip" /> Dosyalar</button>
        </div>
        <template v-if="tab === 'notlar'">
          <!-- Not ve / ya da dosya: dosya seçiliyse not dosyayla birlikte kaydedilir -->
          <div class="note-input">
            <textarea v-model="note" rows="3" placeholder="İşlem notu ekleyin" aria-label="İşlem notu" />
            <label class="dropzone" :class="{ over: dragOver, has: !!file }" @dragover.prevent="dragOver = true" @dragleave="dragOver = false" @drop.prevent="dropFile">
              <input ref="fileInput" class="sr-only" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx" @change="pickFile" />
              <i class="pi pi-cloud-upload" aria-hidden="true" />
              <span>{{ file ? file.name : 'Fotoğraf veya belge ekleyin' }}</span>
            </label>
          </div>
          <div class="note-actions">
            <button class="primary-button" type="button" :disabled="busy || (!note.trim() && !file)" @click="file ? upload() : addNote()"><i class="pi pi-comment" /> Not ekle</button>
          </div>
          <ul v-if="notes.length" class="entries">
            <li v-for="item in notes" :key="item.id">
              <p>{{ item.note }}</p>
              <button v-if="item.type === 'dosya'" class="link-button" type="button" @click="openFile(`pk-findings/${finding.id}/files/${item.id}`)"><i class="pi pi-paperclip" /> {{ item.file_name }}</button>
              <small>{{ item.user || '' }} · {{ formatTime(item.created_at) }}</small>
            </li>
          </ul>
        </template>
        <template v-else>
          <ul v-if="files.length" class="entries">
            <li v-for="item in files" :key="item.id">
              <button class="link-button" type="button" @click="openFile(`pk-findings/${finding.id}/files/${item.id}`)"><i class="pi pi-file" /> {{ item.file_name }}</button>
              <small>{{ item.user || '' }} · {{ formatTime(item.created_at) }}</small>
            </li>
          </ul>
          <p v-else class="muted">Henüz dosya eklenmedi.</p>
        </template>
      </section>

      <section class="card related-card" aria-labelledby="related-title">
        <header class="card-head"><i class="pi pi-clone" aria-hidden="true" /><h3 id="related-title">İlgili kayıt</h3></header>
        <div class="related-row">
          <span class="related-icon"><i :class="finding.subject?.kind === 'installation' ? 'pi pi-sitemap' : 'pi pi-box'" aria-hidden="true" /></span>
          <span class="related-text"><strong>{{ finding.subject?.name || '—' }}</strong><small>{{ finding.subject?.kind === 'installation' ? 'Tesisat' : 'Ekipman profili' }}</small></span>
          <!-- Tesisatın kendi sayfası yok; Tesisatlar listesine gider -->
          <NuxtLink v-if="finding.subject?.id" class="soft-button" :to="finding.subject.kind === 'installation' ? '/expert/installations' : `/expert/equipment/${finding.subject.id}`">
            <i class="pi pi-external-link" /> {{ finding.subject.kind === 'installation' ? 'Tesisatlar' : 'Profili aç' }}
          </NuxtLink>
        </div>
        <div class="related-row">
          <span class="related-icon"><i class="pi pi-file" aria-hidden="true" /></span>
          <span class="related-text"><strong>Periyodik kontrol raporu</strong><small>{{ lastSource ? `Son rapor: ${findingDay(lastSource.control_date)}` : 'Bulgunun geçtiği rapor silinmiş.' }}</small></span>
          <button v-if="lastSource?.file_url" class="soft-button" type="button" @click="openFile(lastSource.file_url)"><i class="pi pi-external-link" /> Raporu aç</button>
        </div>
      </section>
    </div>

    <!-- Bulgunun geçtiği bütün raporlar: katalogda yok, gizli (İlgili kayıt'ta son rapor var); ileride açılabilir -->
    <section v-if="finding && SHOW_SOURCES" class="card block">
      <h3>Raporlar</h3>
      <ul class="sources">
        <li v-for="source in finding.sources" :key="`${source.type}-${source.id}`">
          <span>{{ findingDay(source.control_date) }} raporu<template v-if="source.report_no"> · No {{ source.report_no }}</template></span>
          <span class="source-status" :class="source.status === 'uygun' ? 'ok' : 'bad'">{{ source.status === 'uygun' ? 'Uygun' : 'Uygun değil' }}</span>
          <button v-if="source.file_url" class="link-button" type="button" @click="openFile(source.file_url)"><i class="pi pi-file-pdf" /> Raporu aç</button>
        </li>
        <li v-if="!finding.sources.length" class="muted">Bulgunun geçtiği rapor silinmiş.</li>
      </ul>
    </section>

    <!-- Bulguyu kapat (kapanış notu, Yeniden aç): katalogda yok, gizli (kapatma Durum'dan); ileride açılabilir -->
    <section v-if="finding && SHOW_CLOSE_SECTION" class="card block">
      <h3>Bulguyu kapat</h3>
      <template v-if="!closed">
        <label>Kapanış notu (isteğe bağlı)
          <textarea v-model="closeNote" rows="2" placeholder="Ör. Etiket yenilendi, fotoğraf eklendi." />
        </label>
        <div class="form-actions">
          <button class="primary-button" type="button" :disabled="busy" @click="close(closeNote)"><i class="pi pi-check" /> Bulguyu kapat</button>
        </div>
      </template>
      <div v-else class="closed-row">
        <span><i class="pi pi-check-circle" /> {{ formatTime(finding.closed_at) }} tarihinde kapatıldı.</span>
        <button class="secondary-button" type="button" :disabled="busy" @click="reopen">Yeniden aç</button>
      </div>
    </section>

    <!-- İşlem geçmişi: katalogda yok, gizli; ileride açılabilir -->
    <section v-if="finding && SHOW_HISTORY" class="card block">
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
// Bulgu detayı ve iş atama (tasarım kataloğu 21): Bulgu Takip sayfasında liste yerine açılır; "Bulgu takibi" sayfa yolu listeye
// döner. Düzeltici işlem (yapılacak iş / sorumlu / termin / durum / tekrar kontrol), not ve kanıt dosyası, ilgili kayıt.
// Durum "Kapandı" ile kapatma, kapalı bulguda başka durumla yeniden açma.
const props = defineProps<{ findingId: number; responsibles: { id: number; name: string }[]; canInvite: boolean }>()
const emit = defineEmits<{ close: []; changed: []; 'responsibles-changed': [] }>()

// Katalogda yok, gizli; ileride açılabilir (kod ve uç çağrıları yerinde).
const SHOW_CLOSE_SUGGESTION = false // yeni uygun rapor: kapatma önerisi şeridi
const SHOW_INVITE = false // Kullanıcı ekle bağlantısı
const SHOW_RECHECK_HINT = false // tekrar kontrol açıklaması
const SHOW_SOURCES = false // bulgunun geçtiği bütün raporlar
const SHOW_CLOSE_SECTION = false // Bulguyu kapat (kapanış notu, Yeniden aç)
const SHOW_HISTORY = false // İşlem geçmişi

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
const tab = ref<'notlar' | 'dosyalar'>('notlar')
const dragOver = ref(false)

const closed = computed(() => finding.value?.status === 'kapandi')
const subjectText = computed(() => {
  const subject = finding.value?.subject
  if (!subject) return ''
  return [subject.name, subject.code, subject.detail].filter(Boolean).join(' · ')
})
const placeText = computed(() => [finding.value?.workplace?.company_name, finding.value?.location?.name].filter(Boolean).join(' · '))
// Raporlar en yeniden eskiye gelir.
const lastSource = computed(() => finding.value?.sources?.[0] || null)
const files = computed(() => (finding.value?.events || []).filter((event: any) => event.type === 'dosya'))
const notes = computed(() => (finding.value?.events || []).filter((event: any) => event.note && ['not', 'dosya'].includes(event.type)))

const fill = (data: any) => {
  finding.value = data
  Object.assign(form, {
    work: data.work || '', responsible_user_id: data.responsible?.id ?? null, due_date: data.due_date || '',
    status: data.status, recheck_date: data.recheck_date || ''
  })
}
const current = () => ({
  work: finding.value.work || null, responsible_user_id: finding.value.responsible?.id ?? null, due_date: finding.value.due_date || null,
  status: finding.value.status, recheck_date: finding.value.recheck_date || null
})
const payload = () => {
  const data: Record<string, any> = {
    work: form.work.trim() || null, responsible_user_id: form.responsible_user_id, due_date: form.due_date || null,
    status: form.status, recheck_date: form.recheck_date || null
  }
  // Tekrar kontrol tarihi yeni girildiyse durum "Tekrar kontrol bekliyor" (kapatılmıyorsa).
  if (data.recheck_date && data.recheck_date !== finding.value?.recheck_date && !['tekrar_kontrol', 'kapandi'].includes(data.status)) data.status = 'tekrar_kontrol'
  return data
}
const dirty = computed(() => !!finding.value && JSON.stringify(current()) !== JSON.stringify(payload()))

const load = async () => {
  loading.value = true
  loadError.value = ''
  try { fill(await get(`/pk-findings/${props.findingId}`)) }
  catch (e: any) { loadError.value = errorMessage(e, 'Bulgu alınamadı.') }
  finally { loading.value = false }
}

// Her işlem sunucunun döndürdüğü güncel bulguyla sayfayı yeniler; liste ve rozet de yenilenir.
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

const update = (data: Record<string, any>) => run(() => patch(`/pk-findings/${props.findingId}`, data), 'Bulgu kaydedilemedi.')
// İşi ata: Durum "Kapandı" ise önce diğer değişiklikler kaydedilir, sonra bulgu kapatılır. Kapalı bulguda yalnız Durum değişir:
// yeniden açılır (sunucu "Açık" yapar), başka durum seçildiyse o da kaydedilir.
const save = async () => {
  const data = payload()
  if (closed.value) {
    if (data.status !== 'kapandi' && await reopen() && data.status !== 'acik') await update({ status: data.status })
    return
  }
  const closing = data.status === 'kapandi'
  if (closing) data.status = finding.value.status
  if (JSON.stringify(data) !== JSON.stringify(current()) && !(await update(data))) return
  if (closing) await close(null)
}
const addNote = async () => { if (await run(() => post(`/pk-findings/${props.findingId}/notes`, { note: note.value.trim() }), 'Not eklenemedi.')) note.value = '' }
const pickFile = (event: Event) => { file.value = (event.target as HTMLInputElement).files?.[0] || null }
const dropFile = (event: DragEvent) => {
  dragOver.value = false
  file.value = event.dataTransfer?.files?.[0] || file.value
}
// Dosya, yazılmışsa notuyla birlikte yüklenir.
const upload = async () => {
  if (!file.value) return
  const body = new FormData()
  body.append('file', file.value)
  if (note.value.trim()) body.append('note', note.value.trim())
  if (await run(() => postForm(`/pk-findings/${props.findingId}/files`, body), 'Dosya yüklenemedi.')) {
    file.value = null
    note.value = ''
    if (fileInput.value) fileInput.value.value = ''
  }
}
const close = async (text: string | null) => { if (await run(() => post(`/pk-findings/${props.findingId}/close`, { note: text?.trim() || null }), 'Bulgu kapatılamadı.')) closeNote.value = '' }
const reopen = () => run(() => post(`/pk-findings/${props.findingId}/reopen`, {}), 'Bulgu açılamadı.')
const rejectSuggestion = () => run(() => post(`/pk-findings/${props.findingId}/reject-suggestion`, {}), 'Öneri reddedilemedi.')

// Yetki isteyen dosyalar Blob olarak alınıp yeni sekmede açılır.
const openFile = async (path: string) => {
  const newTab = window.open('', '_blank')
  try {
    const blob = await getBlob(`/${path}`)
    const url = URL.createObjectURL(blob)
    if (newTab) newTab.location.href = url
    else window.location.href = url
  } catch (e: any) {
    newTab?.close()
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
onMounted(() => {
  window.scrollTo({ top: 0 })
  load()
})
</script>

<style scoped>
.finding-detail{display:grid;gap:18px}
.crumb{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:8px;color:var(--admin-muted);font-size:13px}
.crumb-link{padding:0;border:0;background:none;color:var(--admin-muted);font:inherit;cursor:pointer}.crumb-link:hover{color:var(--admin-heading)}
.crumb strong{color:var(--admin-heading);font-weight:600}.crumb .pi-angle-right{font-size:11px}
.card{background:var(--admin-card);border:1px solid var(--admin-border);border-radius:16px;min-width:0;box-shadow:0 10px 28px rgba(var(--pk-shadow-rgb),.06)}
.state{display:flex;align-items:center;justify-content:center;gap:8px;padding:60px 20px;color:var(--admin-muted);font-size:13px}
.muted{margin:0;color:var(--admin-muted);font-size:13px}
.error-text{color:var(--admin-danger-text)}.small-text{margin:0;font-size:12.5px}
/* Üst: başlık, çizim, bulgu | Düzeltici işlem */
.detail-top{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,550px);gap:20px;align-items:start}
.detail-main{min-width:0;display:flex;flex-direction:column}
.title-row{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.title-row h1{margin:0;color:var(--admin-heading);font-size:40px;font-weight:800;line-height:1.15;letter-spacing:-1px}
.result-chip{display:inline-flex;align-items:center;gap:10px;padding:9px 18px 9px 10px;border-radius:999px;font-size:17px;font-weight:700;box-shadow:0 8px 20px rgba(var(--pk-shadow-rgb),.08)}
.result-chip i{width:28px;height:28px;display:grid;place-items:center;border-radius:50%;font-size:12px;color:var(--admin-surface)}
.result-chip.bad{background:var(--admin-danger-bg);color:var(--admin-danger-text)}.result-chip.bad i{background:var(--admin-danger-text)}
.result-chip.ok{background:var(--admin-success-bg);color:var(--admin-success-text)}.result-chip.ok i{background:var(--admin-success-text)}
.hero{margin:0;display:flex;justify-content:center}
.hero img{display:block;width:min(100%,660px)}
.meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;margin:6px 0 14px;color:var(--admin-text);font-size:15px}
.meta strong{color:var(--admin-heading);font-weight:700}.meta .pi{color:var(--admin-muted)}
.meta-sep{width:1px;height:18px;background:var(--admin-border)}
.finding-head{display:grid;gap:6px;padding:2px 0 2px 24px;border-left:5px solid var(--admin-muted);border-radius:2px}
.finding-head.bad{border-left-color:var(--admin-danger-text)}.finding-head.warn{border-left-color:var(--admin-warning-text)}
.finding-head.ok{border-left-color:var(--admin-success-text)}.finding-head.info{border-left-color:var(--admin-link)}
.finding-head h2{margin:0;color:var(--admin-heading);font-size:27px;font-weight:800;line-height:1.25}
.finding-head p{margin:0;color:var(--admin-text);font-size:17px}
.card-head{display:flex;align-items:center;gap:14px}
.card-head i{color:var(--pk-yellow);font-size:24px}
.card-head h3{margin:0;color:var(--admin-heading);font-size:24px;font-weight:800}
.work-card{display:flex;flex-direction:column;gap:18px;padding:22px 20px 24px}
.form-rows{display:grid;gap:14px}
.form-row{display:grid;grid-template-columns:110px minmax(0,1fr);align-items:center;gap:12px}
.form-row > span:first-child{color:var(--admin-heading);font-size:15px;font-weight:600;line-height:1.35}
.form-row:first-child{align-items:start}.form-row:first-child > span:first-child{padding-top:10px}
input,select,textarea{width:100%;min-height:42px;padding:8px 14px;border:1px solid var(--admin-border);border-radius:10px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:15px;font-weight:400;outline:0}
textarea{resize:vertical;line-height:1.5}
input:focus,select:focus,textarea:focus{border-color:var(--pk-accent);box-shadow:0 0 0 3px var(--pk-focus-ring)}
input:disabled,select:disabled,textarea:disabled{opacity:.7}
.field{position:relative;display:flex;align-items:center}
.field > .pi:first-child,.field > .dot{position:absolute;left:15px;pointer-events:none}
.field > .pi:first-child{color:var(--admin-heading);font-size:16px}
.field input,.field select{padding-left:46px}
.field.select select{padding-right:40px;appearance:none;cursor:pointer}
.field.select > .pi-chevron-down{position:absolute;right:15px;color:var(--admin-heading);font-size:12px;pointer-events:none}
.dot{width:14px;height:14px;border-radius:50%;background:var(--admin-muted)}
.dot.bad{background:var(--admin-danger-text)}.dot.warn{background:var(--admin-warning-text)}.dot.ok{background:var(--admin-success-text)}.dot.info{background:var(--admin-link)}
.hint{margin:-6px 0 0;color:var(--admin-muted);font-size:12px;line-height:1.5}
.form-actions{display:flex;justify-content:flex-end;gap:14px}
.form-actions .secondary-button{min-width:130px}.form-actions .primary-button{min-width:190px}
.primary-button,.secondary-button{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:46px;padding:0 20px;border-radius:12px;font:inherit;font-size:16px;font-weight:700;cursor:pointer}
.primary-button{border:0;background:var(--pk-yellow);color:var(--pk-on-accent);box-shadow:0 8px 20px rgba(var(--pk-accent-rgb),.25)}
.primary-button:hover:not(:disabled),.primary-button:focus-visible{background:var(--pk-yellow-dark)}
.secondary-button{border:1px solid var(--admin-border);background:var(--admin-surface);color:var(--admin-heading)}
.primary-button:disabled,.secondary-button:disabled{opacity:.55;cursor:not-allowed}
.small{min-height:34px;padding:0 12px;font-size:12px}
.link-button{display:inline-flex;align-items:center;gap:6px;padding:0;border:0;background:transparent;color:var(--admin-link);font:inherit;font-size:13px;font-weight:600;cursor:pointer;text-align:left}
.link-button.invite{justify-self:start;margin:-6px 0 0 122px}
/* Alt: Not ve kanıt | İlgili kayıt */
.detail-bottom{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,550px);gap:20px;align-items:start}
.notes-card,.related-card{display:flex;flex-direction:column;gap:16px;padding:22px 22px 20px}
.tabs{display:flex;gap:26px;border-bottom:1px solid var(--admin-border)}
.tabs button{display:inline-flex;align-items:center;gap:9px;margin-bottom:-1px;padding:4px 4px 12px;border:0;border-bottom:3px solid transparent;background:none;color:var(--admin-heading);font:inherit;font-size:16px;font-weight:600;cursor:pointer}
.tabs button.on{border-bottom-color:var(--pk-yellow);color:var(--admin-link)}
.note-input{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);gap:16px}
.dropzone{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:90px;padding:12px;border:1.5px dashed var(--admin-link);border-radius:12px;background:var(--admin-surface);color:var(--admin-text);font-size:14px;text-align:center;cursor:pointer;overflow-wrap:anywhere}
.dropzone .pi{color:var(--admin-heading);font-size:24px}
.dropzone:hover,.dropzone.over,.dropzone:focus-within{background:var(--admin-accent-soft)}
.dropzone.has{border-style:solid;color:var(--admin-heading);font-weight:600}
.note-actions{display:flex;justify-content:flex-end}
.note-actions .primary-button{min-height:42px}
.entries{margin:0;padding:0;list-style:none;display:grid;gap:10px}
.entries li{display:grid;gap:4px;padding:10px 0;border-top:1px solid var(--admin-row-border)}
.entries li:first-child{border-top:0;padding-top:0}
.entries p{margin:0;color:var(--admin-heading);font-size:14px;line-height:1.5;white-space:pre-line}
.entries small{color:var(--admin-muted);font-size:12px}
.related-row{display:grid;grid-template-columns:56px minmax(0,1fr) auto;align-items:center;gap:16px;padding:14px 16px;border:1px solid var(--admin-border);border-radius:14px;background:var(--admin-surface)}
.related-icon{width:56px;height:56px;display:grid;place-items:center;border-radius:12px;background:var(--admin-chip);color:var(--admin-heading);font-size:22px}
.related-text{min-width:0;display:flex;flex-direction:column;gap:3px}
.related-text strong{color:var(--admin-heading);font-size:18px;font-weight:800}.related-text small{color:var(--admin-text);font-size:14px}
.soft-button{display:inline-flex;align-items:center;gap:10px;min-height:42px;padding:0 18px;border:0;border-radius:12px;background:var(--admin-accent-soft);color:var(--admin-link);font:inherit;font-size:16px;font-weight:700;white-space:nowrap;cursor:pointer}
.soft-button:hover,.soft-button:focus-visible{background:var(--pk-focus-ring)}
/* Gizli bölümler (kapatma önerisi, raporlar, kapatma, geçmiş) */
.block{display:grid;gap:10px;padding:16px}
.block h3{margin:0;color:var(--admin-heading);font-size:15px}
.block label{display:grid;gap:6px;color:var(--admin-heading);font-size:12px;font-weight:700}
.sources,.timeline{margin:0;padding:0;list-style:none;display:grid;gap:8px}
.sources li{display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px;font-size:12px;color:var(--admin-text)}
.source-status{padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700}.source-status.ok{background:var(--admin-success-bg);color:var(--admin-success-text)}.source-status.bad{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.suggestion{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;align-items:start;padding:14px;border-radius:10px;background:var(--admin-success-bg);color:var(--admin-success-text)}
.suggestion>i{margin-top:2px;font-size:18px}.suggestion div:not(.suggestion-actions){display:grid;gap:3px;font-size:13px}.suggestion span{font-size:12px}
.suggestion-actions{grid-column:1 / -1;display:flex;justify-content:flex-end;gap:8px}
.closed-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;color:var(--admin-success-text);font-size:13px}
.timeline li{position:relative;display:grid;gap:3px;padding:0 0 0 16px;border-left:2px solid var(--admin-border)}
.timeline li::before{content:'';position:absolute;left:-6px;top:4px;width:10px;height:10px;border-radius:50%;background:var(--admin-muted)}
.timeline li.ok::before{background:var(--admin-success-text)}.timeline li.warn::before{background:var(--admin-warning-text)}
.event-head{display:flex;justify-content:space-between;gap:10px;font-size:12.5px;color:var(--admin-heading)}.event-head small{color:var(--admin-muted);white-space:nowrap}
.timeline p{margin:0;color:var(--admin-text);font-size:12px;line-height:1.5}
/* Kullanıcı ekle penceresi */
.close-button{flex:none;width:34px;height:34px;display:grid;place-items:center;border:0;border-radius:7px;background:transparent;color:var(--admin-muted);cursor:pointer}.close-button:hover{background:var(--admin-hover);color:var(--admin-heading)}
.modal-backdrop{position:fixed;inset:0;z-index:110;background:var(--admin-overlay);display:grid;place-items:center;padding:20px}
.modal-card{width:min(460px,100%);display:grid;gap:14px;padding:22px;background:var(--admin-input);border-radius:12px;box-shadow:0 20px 60px var(--admin-shadow)}
.modal-card label{display:grid;gap:6px;color:var(--admin-heading);font-size:12px;font-weight:700}
.modal-head{display:flex;justify-content:space-between;gap:15px}.modal-head h2{margin:0;color:var(--admin-heading);font-size:18px}.modal-head p{margin:5px 0 0;color:var(--admin-muted);font-size:12px}
.modal-card label span{color:var(--admin-danger-text)}
.modal-actions{display:flex;justify-content:flex-end;gap:10px}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media (max-width:1250px){
  .detail-top,.detail-bottom{grid-template-columns:minmax(0,1fr)}
}
@media (max-width:800px){
  .title-row h1{font-size:32px}
  .hero{display:none}
  .finding-head h2{font-size:22px}
  .form-row{grid-template-columns:minmax(0,1fr);gap:6px}
  .form-row:first-child > span:first-child{padding-top:0}
  .link-button.invite{margin-left:0}
  .note-input{grid-template-columns:minmax(0,1fr)}
  .related-row{grid-template-columns:44px minmax(0,1fr)}
  .related-icon{width:44px;height:44px}
  .related-row .soft-button{grid-column:1 / -1;justify-content:center}
}
</style>
