<template>
  <div class="ai-page">
    <div class="page-head">
      <div>
        <div class="breadcrumb"><span>Ayarlar</span><i class="pi pi-angle-right" /><strong>Yapay zeka</strong></div>
        <h1>Yapay zeka</h1>
        <p>Periyodik kontrol raporlarını okuyan yapay zeka. Varsayılan istemci rapor yükleme, rapordan ekipman tanımlama ve test sayfasında kullanılır. Şimdilik tüm uzmanlar değiştirebilir.</p>
      </div>
    </div>

    <div v-if="loading" class="card state">Yükleniyor...</div>
    <div v-else-if="loadError" class="card state error-text">{{ loadError }}</div>
    <template v-else>
      <!-- Varsayılan istemci -->
      <section class="card">
        <h2>Varsayılan yapay zeka istemcisi</h2>
        <div class="providers">
          <label v-for="item in providers" :key="item.key" class="provider" :class="{ active: form.provider === item.key }">
            <input v-model="form.provider" type="radio" :value="item.key" />
            <span class="provider-body">
              <strong>{{ item.label }}</strong>
              <small>{{ item.note }}</small>
              <span class="key-state" :class="keyState(item).tone">{{ keyState(item).text }}</span>
            </span>
          </label>
        </div>
      </section>

      <!-- Her istemcinin modeli ve API anahtarı -->
      <section v-for="item in providers" :key="item.key" class="card">
        <h2>{{ item.label }} <span v-if="item.key === form.provider" class="badge">Varsayılan</span></h2>
        <div class="fields">
          <label>Model
            <input v-model="form.models[item.key]" type="text" :placeholder="item.default_model || 'Model adı'" />
            <small>Boş bırakılırsa .env'deki model kullanılır: {{ item.default_model || '—' }}</small>
          </label>
          <div class="suggestions">
            <button v-for="suggestion in item.suggestions" :key="suggestion.id" type="button" class="chip" :class="{ active: (form.models[item.key] || item.default_model) === suggestion.id }" @click="form.models[item.key] = suggestion.id">
              {{ suggestion.id }}<small>{{ suggestion.note }}</small>
            </button>
          </div>
          <label>API anahtarı
            <input v-model="form.keys[item.key]" type="password" autocomplete="new-password" :placeholder="item.key_hint ? `Kayıtlı (${item.key_hint}) — değiştirmek için yeni anahtarı yapıştırın` : 'Anahtarı yapıştırın'" />
            <small v-if="item.key_source === 'db'">
              Bu sayfadan girilmiş, şifreli saklanıyor.
              <button type="button" class="link-button" @click="toggleClear(item.key)">{{ form.clear.includes(item.key) ? 'Kaldırmaktan vazgeç' : 'Kaldır' }}</button>
            </small>
            <small v-else-if="item.key_source === 'env'">.env'deki anahtar kullanılıyor ({{ item.key_env }}). Buraya girerseniz bu geçerli olur.</small>
            <small v-else>Tanımlı değil.</small>
          </label>
        </div>
      </section>

      <p v-if="error" class="error-text">{{ error }}</p>
      <p v-if="saved" class="saved-text"><i class="pi pi-check" /> Kaydedildi.</p>
      <div class="actions">
        <span v-if="updatedBy" class="muted">Son değişiklik: {{ updatedBy }}<template v-if="updatedAt"> · {{ formatDateTime(updatedAt) }}</template></span>
        <button class="primary-button" type="button" :disabled="saving" @click="save">{{ saving ? 'Kaydediliyor...' : 'Kaydet' }}</button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// Ayarlar → Yapay zeka: rapor okuyan varsayılan istemci (Gemini / OpenAI / NVIDIA), modelleri ve API anahtarları.
// Anahtarlar sunucuda şifreli; sayfaya yalnızca son 4 karakteri gelir. Şimdilik tüm uzmanlara açık (ileride süper admin).
definePageMeta({ layout: 'expert-settings', middleware: ['expert', 'expert-super-admin'] })

interface Provider {
  key: string; label: string; note: string; key_env: string; key_source: 'db' | 'env' | null; key_hint: string | null; env_key_set: boolean
  model: string | null; custom_model: boolean; default_model: string | null; suggestions: { id: string; note: string }[]
}
interface Settings { provider: string; providers: Provider[]; updated_by: string | null; updated_at: string | null }

const { get, patch, errorMessage } = useExpertApi()

const providers = ref<Provider[]>([])
const updatedBy = ref<string | null>(null)
const updatedAt = ref<string | null>(null)
const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const saved = ref(false)
const error = ref('')
const form = reactive({ provider: '', models: {} as Record<string, string>, keys: {} as Record<string, string>, clear: [] as string[] })

const apply = (settings: Settings) => {
  providers.value = settings.providers
  updatedBy.value = settings.updated_by
  updatedAt.value = settings.updated_at
  form.provider = settings.provider
  // Model alanı yalnızca sayfadan seçilmişse dolu; boşsa .env'deki model geçerli.
  form.models = Object.fromEntries(settings.providers.map(item => [item.key, item.custom_model ? item.model || '' : '']))
  form.keys = {}
  form.clear = []
}

// İstemci kartındaki anahtar durumu (kaydedilmemiş değişiklikler dahil).
const keyState = (item: Provider) => {
  if (form.keys[item.key]?.trim()) return { tone: 'ok', text: 'Yeni anahtar kaydedilecek' }
  if (form.clear.includes(item.key)) return item.env_key_set ? { tone: 'warn', text: 'Kaldırılacak, .env\'deki kullanılacak' } : { tone: 'missing', text: 'Kaldırılacak, anahtar kalmayacak' }
  if (item.key_source === 'db') return { tone: 'ok', text: `Anahtar kayıtlı (${item.key_hint})` }
  if (item.key_source === 'env') return { tone: 'ok', text: `Anahtar .env'de (${item.key_hint})` }
  return { tone: 'missing', text: 'Anahtar yok' }
}
const toggleClear = (key: string) => {
  form.clear = form.clear.includes(key) ? form.clear.filter(item => item !== key) : [...form.clear, key]
}
const formatDateTime = (value: string) => new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))

const load = async () => {
  loading.value = true
  loadError.value = ''
  try { apply(await get<Settings>('/pk-ai-settings')) }
  catch (e: any) { loadError.value = errorMessage(e, 'Yapay zeka ayarları alınamadı.') }
  finally { loading.value = false }
}

const save = async () => {
  saving.value = true
  saved.value = false
  error.value = ''
  const keys = Object.fromEntries(Object.entries(form.keys).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value))
  try {
    apply(await patch<Settings>('/pk-ai-settings', { provider: form.provider, models: form.models, keys, clear_keys: form.clear }))
    saved.value = true
  } catch (e: any) {
    error.value = errorMessage(e, 'Ayarlar kaydedilemedi.')
  } finally { saving.value = false }
}

onMounted(load)
</script>

<style scoped>
.ai-page{max-width:980px;margin:0 auto}
.page-head{margin-bottom:20px}
.breadcrumb{display:flex;align-items:center;gap:8px;margin-bottom:10px;color:var(--admin-muted);font-size:12px}.breadcrumb strong{color:var(--admin-heading)}
h1{margin:0;color:var(--admin-heading);font-size:30px;letter-spacing:-.7px}.page-head p{margin:7px 0 0;max-width:760px;color:var(--admin-muted);font-size:13px}
.card{margin-bottom:14px;padding:18px;background:var(--admin-card);border:1px solid var(--admin-border);border-radius:12px}
.card h2{display:flex;align-items:center;gap:8px;margin:0 0 14px;color:var(--admin-heading);font-size:15px}
.state{padding:50px 20px;text-align:center;color:var(--admin-muted);font-size:13px}
.badge{padding:2px 9px;border-radius:999px;background:var(--admin-accent-soft);color:var(--admin-heading);font-size:11px;font-weight:700}
.providers{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
.provider{display:flex;align-items:flex-start;gap:10px;padding:14px;border:1px solid var(--admin-border);border-radius:10px;cursor:pointer}
.provider:hover{background:var(--admin-hover)}.provider.active{border-color:#d7a900;box-shadow:0 0 0 3px rgba(255,193,7,.14)}
.provider input{margin-top:3px}
.provider-body{display:flex;flex-direction:column;gap:5px;min-width:0}
.provider-body strong{color:var(--admin-heading);font-size:13px}.provider-body small{color:var(--admin-muted);font-size:11px;line-height:1.4}
.key-state{align-self:flex-start;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700}
.key-state.ok{background:var(--admin-success-bg);color:var(--admin-success-text)}.key-state.warn{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.key-state.missing{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.fields{display:grid;gap:12px}
.fields label{display:grid;gap:6px;color:var(--admin-heading);font-size:12px;font-weight:700}
.fields label small{font-weight:400;color:var(--admin-muted);font-size:11px}
.fields input{height:40px;padding:0 12px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:13px;outline:0}
.fields input:focus{border-color:#d7a900;box-shadow:0 0 0 3px rgba(255,193,7,.12)}
.suggestions{display:flex;flex-wrap:wrap;gap:6px;margin-top:-4px}
.chip{display:inline-flex;align-items:baseline;gap:6px;padding:5px 10px;border:1px solid var(--admin-border);border-radius:999px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.chip small{font-weight:400;color:var(--admin-muted);font-size:11px}
.chip:hover{border-color:#d7a900}.chip.active{border-color:#d7a900;background:var(--admin-accent-soft)}
.link-button{border:0;padding:0;background:none;color:var(--admin-link);font:inherit;font-size:11px;font-weight:700;cursor:pointer}
.actions{display:flex;align-items:center;justify-content:flex-end;gap:14px;margin-top:6px}
.muted{color:var(--admin-muted);font-size:12px}
.primary-button{min-height:42px;padding:0 20px;border:0;border-radius:8px;background:var(--pk-yellow);color:#111827;font-size:13px;font-weight:800;cursor:pointer}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.error-text{margin:0 0 8px;color:var(--admin-danger-text);font-size:12px}
.saved-text{display:flex;align-items:center;gap:6px;margin:0 0 8px;color:var(--admin-success-text);font-size:12px;font-weight:700}
</style>
