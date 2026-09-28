<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <section class="modal-card">
      <div class="modal-head">
        <div>
          <small class="category">{{ data?.category?.name || summary.category?.name }} · {{ summary.type?.name }}<template v-if="summary.code"> · Ekipman no {{ summary.code }}</template></small>
          <h2>{{ summary.name || summary.type?.name }}<span v-if="summary.variant" class="tag">{{ summary.variant }}</span></h2>
        </div>
        <button class="close-button" type="button" @click="emit('close')"><i class="pi pi-times" /></button>
      </div>

      <div v-if="loading" class="state">Yükleniyor...</div>
      <div v-else-if="error" class="state error-text">{{ error }}</div>
      <template v-else-if="data">
        <div class="top">
          <div class="photo">
            <img v-if="data.photo_url" :src="data.photo_url" :alt="data.type?.name" />
            <div v-else class="photo-placeholder"><i class="pi pi-image" /><span>Fotoğraf yok</span></div>
          </div>
          <dl class="info">
            <dt>Durum</dt><dd><span class="status-badge" :class="data.status">{{ STATUS_LABELS[data.status] }}</span></dd>
            <dt>Son kontrol</dt><dd>{{ formatDate(data.last_control_date) }}</dd>
            <dt>Gelecek kontrol</dt><dd>{{ formatDate(data.next_control_date) }}</dd>
            <dt>Kalan gün</dt><dd><span v-if="!data.is_active" class="muted">Pasif</span><span v-else class="days" :class="daysKey(data.days_left)">{{ daysText(data.days_left) }}</span></dd>
            <dt>Marka / Model</dt><dd>{{ [data.brand, data.model].filter(Boolean).join(' / ') || '—' }}</dd>
            <dt>Seri no</dt><dd>{{ data.serial_no || '—' }}</dd>
            <dt>Ait olduğu yer</dt><dd>{{ data.workplace?.company_name || 'Lokasyon geneli' }}</dd>
            <dt>Bulunduğu yer</dt><dd>{{ data.place || '—' }}</dd>
          </dl>
        </div>

        <h3>Son kontroller <span class="count">{{ data.inspections?.length || 0 }}</span></h3>
        <div v-if="!data.inspections?.length" class="muted">Henüz kontrol kaydı yok.</div>
        <ul v-else class="history">
          <li v-for="inspection in data.inspections.slice(0, 5)" :key="inspection.id">
            <span class="status-badge" :class="inspection.status">{{ STATUS_LABELS[inspection.status] }}</span>
            <span>{{ formatDate(inspection.control_date) }}</span>
            <span v-if="inspection.next_control_date" class="muted">→ {{ formatDate(inspection.next_control_date) }}</span>
            <small><i v-if="inspection.has_report" class="pi pi-file-pdf" title="Rapor yüklü" /> {{ SOURCE_LABELS[inspection.source] }}</small>
          </li>
        </ul>
      </template>

      <div class="modal-actions">
        <!-- Pasif ekipmana kontrol eklenmez. Tesisata bağlı ekipman: kontrolü tesisat raporundan gelir (rapor / rapor bekleniyor tesisatta) -->
        <span v-if="data && !data.is_active" class="bound-note"><i class="pi pi-ban" /> Pasif ekipman; kontrol eklenmez.</span>
        <template v-else-if="data?.installation">
          <span class="bound-note"><i class="pi pi-info-circle" /> Kontrolü {{ data.installation.name }} raporundan gelir.</span>
          <NuxtLink class="secondary-button" to="/expert/installations">{{ data.installation.name }} <i class="pi pi-arrow-right" /></NuxtLink>
        </template>
        <template v-else>
          <button class="secondary-button" type="button" :disabled="!data" @click="emit('pending', data)"><i class="pi pi-hourglass" /> Rapor bekleniyor</button>
          <button class="secondary-button" type="button" :disabled="!data" @click="emit('upload', data)"><i class="pi pi-file-arrow-up" /> Yeni Periyodik Kontrol Raporu Yükle</button>
        </template>
        <NuxtLink class="primary-button" :to="`/expert/equipment/${summary.id}`">Profili aç <i class="pi pi-arrow-right" /></NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// Ekipman listesinden hızlı önizleme: sayfadan çıkmadan fotoğraf, tarihler ve son kontroller.
const props = defineProps<{ summary: any }>()
const emit = defineEmits<{ close: []; upload: [equipment: any]; pending: [equipment: any] }>()

const STATUS_LABELS: Record<string, string> = { uygun: 'Uygun', uygun_degil: 'Uygun değil', rapor_bekleniyor: 'Rapor bekleniyor', belirtilmemis: 'Belirtilmemiş', rapor_yok: 'Rapor yok' }
const SOURCE_LABELS: Record<string, string> = { manual: 'Elle', ai: 'Yapay zeka' }

const { get, errorMessage } = useExpertApi()
const data = ref<any>(null)
const loading = ref(true)
const error = ref('')

const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('tr-TR').format(new Date(value)) : '—'
const daysText = (days: number | null) => days === null || days === undefined ? '—' : days < 0 ? `${-days} gün geçti` : days === 0 ? 'Bugün' : `${days} gün`
const daysKey = (days: number | null) => days === null || days === undefined ? '' : days < 0 ? 'overdue' : days <= 30 ? 'soon' : 'ok'

onMounted(async () => {
  try { data.value = await get(`/pk-equipment/${props.summary.id}`) }
  catch (e: any) { error.value = errorMessage(e, 'Ekipman alınamadı.') }
  finally { loading.value = false }
})
</script>

<style scoped>
.modal-backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:var(--admin-overlay)}
.modal-card{width:min(720px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:22px;background:var(--admin-card);border-radius:12px;box-shadow:0 20px 60px var(--admin-shadow)}
.modal-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:16px}
.category{color:var(--admin-muted);font-size:11px;font-weight:700}
.tag{display:inline-block;margin-left:8px;padding:2px 9px;border-radius:999px;border:1px solid var(--admin-border);background:var(--admin-soft);color:var(--admin-text);font-size:11px;font-weight:700;vertical-align:middle}
h2{margin:3px 0 0;color:var(--admin-heading);font-size:18px}
h3{display:flex;align-items:center;gap:6px;margin:20px 0 10px;color:var(--admin-heading);font-size:13px}
.close-button{width:34px;height:34px;display:grid;place-items:center;border:0;background:transparent;color:var(--admin-muted);cursor:pointer;border-radius:7px}.close-button:hover{background:var(--admin-hover);color:var(--admin-heading)}
.state{padding:40px 20px;text-align:center;color:var(--admin-muted)}
.top{display:grid;grid-template-columns:220px 1fr;gap:18px;align-items:start}
.photo{aspect-ratio:4/3;border-radius:10px;overflow:hidden;background:var(--admin-soft);border:1px solid var(--admin-border)}
.photo img{width:100%;height:100%;object-fit:cover;display:block}
.photo-placeholder{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:var(--admin-muted);font-size:12px}.photo-placeholder i{font-size:28px}
.info{display:grid;grid-template-columns:max-content 1fr;gap:7px 16px;margin:0;font-size:12px}.info dt{color:var(--admin-muted)}.info dd{margin:0;color:var(--admin-heading)}
.days{font-weight:700}.days.overdue{color:var(--admin-danger-text)}.days.soon{color:var(--admin-warning-text)}
.status-badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
.status-badge.uygun{background:var(--admin-success-bg);color:var(--admin-success-text)}.status-badge.uygun_degil{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.status-badge.rapor_bekleniyor{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.status-badge.rapor_yok,.status-badge.belirtilmemis{background:var(--admin-chip);color:var(--admin-muted)}
.count{padding:1px 7px;border-radius:999px;background:var(--admin-chip);color:var(--admin-muted);font-size:11px}
.history{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.history li{display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid var(--admin-border);border-radius:9px;font-size:12px;color:var(--admin-heading)}.history small{margin-left:auto;color:var(--admin-muted);font-size:10px}
.muted{color:var(--admin-muted);font-size:12px}.error-text{color:var(--admin-danger-text)}
.modal-actions{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:10px;margin-top:20px}
.bound-note{display:inline-flex;align-items:center;gap:6px;margin-right:auto;color:var(--admin-muted);font-size:12px}
a.secondary-button{text-decoration:none}
.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 17px;border:0;border-radius:8px;background:var(--pk-yellow);color:#111827;font-size:13px;font-weight:800;cursor:pointer;text-decoration:none}
.secondary-button{display:inline-flex;align-items:center;gap:7px;min-height:40px;padding:0 16px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-hover);color:var(--admin-heading);font-size:12px;font-weight:700;cursor:pointer}.secondary-button:disabled{opacity:.55}
@media(max-width:640px){.top{grid-template-columns:1fr}}
</style>
