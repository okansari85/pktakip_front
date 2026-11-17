<template>
  <div class="ai-page">
    <div class="page-head">
      <!-- Ana Sayfa yalnız bireysel uzmanda var; diğer hesaplarda sayfa yolu Genel Bakış'ta başlar -->
      <nav class="crumb" aria-label="Sayfa yolu">
        <PkIcon class="pi pi-home" aria-hidden="true" />
        <NuxtLink :to="individual ? '/expert/anasayfa' : '/expert'">{{ individual ? 'Ana Sayfa' : 'Genel Bakış' }}</NuxtLink>
        <PkIcon class="pi pi-angle-right" aria-hidden="true" />
        <strong>Yapay zekâ ayarları</strong>
      </nav>
      <h1>Yapay zekâ ayarları</h1>
      <p>Periyodik kontrol raporlarının okuma yapılandırması</p>
    </div>

    <div v-if="loading" class="card state">Yükleniyor...</div>
    <div v-else-if="loadError" class="card state error-text">{{ loadError }}</div>
    <template v-else>
      <!-- Sağlayıcı, model, okuma yöntemi ve bağlantı -->
        <section class="card main">
          <h2><PkIcon class="pi pi-microchip-ai" /> Rapor okuma sağlayıcısı</h2>
          <!-- Varsayılan istemci -->
          <div class="providers">
            <label v-for="item in providers" :key="item.key" class="provider" :class="{ active: form.provider === item.key }" :title="item.note">
              <input v-model="form.provider" type="radio" :value="item.key" class="sr-only" />
              <PkIcon :class="PROVIDER_ICON[item.key] || 'pi pi-microchip-ai'" class="provider-icon" />
              <strong>{{ item.label }}</strong>
              <span v-if="form.provider === item.key" class="key-state" :class="keyState(item).tone" :title="keyState(item).text">{{ keyState(item).tone === 'ok' ? 'Bağlı' : keyState(item).text }}</span>
              <span class="radio-mark"><PkIcon v-if="form.provider === item.key" class="pi pi-check" /></span>
            </label>
          </div>

          <!-- Seçili istemcinin modeli: listeden seçilir ya da yazılır; boşsa .env'deki model -->
          <div class="field">
            <span class="field-label">Model</span>
            <Select v-if="current" :model-value="form.models[current.key] || null" :options="(current.suggestions || []).map(s => ({ label: `${s.id} · ${s.note}`, value: s.id }))" option-label="label" option-value="value" editable show-clear
              :placeholder="`Varsayılan model${current.default_model ? ` (${current.default_model})` : ''}`" class="model-select" aria-label="Model" @update:model-value="(value: any) => { form.models[current!.key] = value ?? '' }" />
          </div>

          <!-- Okuma yöntemi: tek uzun talimat (eski) ya da küçük ajanlar (yeni, Docling) -->
          <div class="field">
            <span class="field-label">Okuma yöntemi</span>
            <div class="methods">
              <label class="method" :class="{ active: !form.agents }" title="Tek talimat: rapor tek seferde, uzun talimatla okunur (büyük bulut modelleri için).">
                <input v-model="form.agents" type="radio" :value="false" />
                <span><strong>Standart okuma</strong><small>Tek geçişte rapor alanlarını çıkarır</small></span>
              </label>
              <label class="method" :class="{ active: form.agents }" title="Çok ajanlı (Docling): PDF bölümlere ayrılır, her bölümü tek işi olan küçük bir ajan okur (yerel sunucu için gerekli).">
                <input v-model="form.agents" type="radio" :value="true" />
                <span>
                  <strong>Ayrıntılı okuma</strong><small>Tablo ve ekipman alanlarını ayrı inceler</small>
                  <em v-if="form.agents && !doclingReady" class="key-state warn">Docling kurulu değil: tesisat raporları düz metinle okunur</em>
                </span>
              </label>
            </div>
          </div>

          <!-- Seçili istemcinin bağlantısı; Bağlantıyı yönet: her istemcinin modeli ve API anahtarı (aşağıdaki kartlar) -->
          <div v-if="current" class="connection" :class="keyState(current).tone">
            <PkIcon :class="PROVIDER_ICON[current.key] || 'pi pi-microchip-ai'" class="provider-icon" />
            <span class="connection-text">
              <strong>{{ current.label }} bağlantısı</strong>
              <span class="key-state" :class="keyState(current).tone" :title="keyState(current).text">{{ keyState(current).tone === 'ok' ? 'Bağlantı hazır' : keyState(current).text }}</span>
            </span>
            <button class="text-link" type="button" :aria-expanded="showConnections" @click="showConnections = !showConnections">Bağlantıyı yönet <PkIcon :class="showConnections ? 'pi pi-chevron-up' : 'pi pi-external-link'" /></button>
          </div>

          <p v-if="error" class="error-text">{{ error }}</p>
          <p v-if="saved" class="saved-text"><PkIcon class="pi pi-check" /> Kaydedildi.</p>
          <div class="actions">
            <button class="primary-button" type="button" :disabled="saving" @click="save"><PkIcon class="pi pi-save" /> {{ saving ? 'Kaydediliyor...' : 'Değişiklikleri kaydet' }}</button>
            <NuxtLink to="/expert/test" class="secondary-button"><PkIcon class="pi pi-play" /> Örnek raporla dene</NuxtLink>
          </div>
          <!-- Son değişikliği yapan: katalogda yok, gizli; ileride açılabilir -->
          <span v-if="SHOW_UPDATED_BY && updatedBy" class="muted">Son değişiklik: {{ updatedBy }}<template v-if="updatedAt"> · {{ formatDateTime(updatedAt) }}</template></span>
        </section>

      <!-- Her istemcinin modeli ve API anahtarı (Bağlantıyı yönet ile açılır) -->
      <template v-if="showConnections">
      <section v-for="item in providers" :key="item.key" class="card">
        <h2>{{ item.label }} <span v-if="item.key === form.provider" class="badge">Varsayılan</span></h2>
        <div class="fields">
          <label v-if="item.key === 'local'">Sunucu adresi
            <input v-model="form.localUrl" type="text" :placeholder="localUrlDefault || 'http://127.0.0.1:8090/v1'" />
            <small>OpenAI uyumlu adres, sonu /v1. Laptop: http://127.0.0.1:8090/v1. Boş bırakılırsa .env'deki: {{ localUrlDefault || '—' }}</small>
          </label>
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
      <p v-if="saved" class="saved-text"><PkIcon class="pi pi-check" /> Kaydedildi.</p>
      <div class="actions end">
        <button class="primary-button" type="button" :disabled="saving" @click="save"><PkIcon class="pi pi-save" /> {{ saving ? 'Kaydediliyor...' : 'Değişiklikleri kaydet' }}</button>
      </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
// Ayarlar → Yapay zeka: rapor okuyan varsayılan istemci (Gemini / OpenAI / NVIDIA / yerel sunucu), okuma yöntemi (tek talimat /
// çok ajanlı), modelleri ve API anahtarları.
// Anahtarlar sunucuda şifreli; sayfaya yalnızca son 4 karakteri gelir. Şimdilik tüm uzmanlara açık (ileride süper admin).
definePageMeta({ layout: 'expert-settings', middleware: ['expert', 'expert-super-admin'] })

interface Provider {
  key: string; label: string; note: string; key_env: string; key_source: 'db' | 'env' | null; key_hint: string | null; env_key_set: boolean
  model: string | null; custom_model: boolean; default_model: string | null; suggestions: { id: string; note: string }[]; key_optional: boolean
}
interface Settings {
  provider: string; providers: Provider[]; updated_by: string | null; updated_at: string | null
  agents: boolean; local_url: string | null; local_url_default: string | null; docling_ready: boolean
}

const { get, patch, errorMessage } = useExpertApi()
const { multiUser, account, load: loadAccount } = useAccount()
const individual = computed(() => !!account.value && !multiUser.value)
// Sağlayıcı kartlarındaki simge (marka logosu kullanılmaz)
const PROVIDER_ICON: Record<string, string> = { gemini: 'pi pi-sparkles', openai: 'pi pi-microchip-ai', nvidia: 'pi pi-bolt', local: 'pi pi-server' }
// Son değişikliği yapan ve zamanı: katalogda yok, gizli; ileride açılabilir
const SHOW_UPDATED_BY = false
const showConnections = ref(false)

const providers = ref<Provider[]>([])
const current = computed(() => providers.value.find(item => item.key === form.provider) || null)
const updatedBy = ref<string | null>(null)
const updatedAt = ref<string | null>(null)
const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const saved = ref(false)
const error = ref('')
const localUrlDefault = ref<string | null>(null)
const doclingReady = ref(false)
const form = reactive({ provider: '', agents: false, localUrl: '', models: {} as Record<string, string>, keys: {} as Record<string, string>, clear: [] as string[] })

const apply = (settings: Settings) => {
  providers.value = settings.providers
  updatedBy.value = settings.updated_by
  updatedAt.value = settings.updated_at
  form.provider = settings.provider
  form.agents = settings.agents
  // Adres alanı yalnızca sayfadan girilmişse dolu; boşsa .env'deki geçerli.
  form.localUrl = settings.local_url || ''
  localUrlDefault.value = settings.local_url_default
  doclingReady.value = settings.docling_ready
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
  return item.key_optional ? { tone: 'ok', text: 'Anahtar gerekmez' } : { tone: 'missing', text: 'Anahtar yok' }
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
    apply(await patch<Settings>('/pk-ai-settings', { provider: form.provider, agents: form.agents, local_url: form.localUrl.trim() || null, models: form.models, keys, clear_keys: form.clear }))
    saved.value = true
  } catch (e: any) {
    error.value = errorMessage(e, 'Ayarlar kaydedilemedi.')
  } finally { saving.value = false }
}

onMounted(() => { loadAccount(); load() })
</script>

<style scoped>
.ai-page{margin:0 auto;display:grid;gap:24px}
.page-head h1{margin:0;color:var(--admin-heading);font-size: 24px;font-weight: 700;line-height:1.15;letter-spacing: 0}.page-head p{margin:7px 0 0;color:var(--admin-muted);font-size:15px}
.crumb{display:flex;align-items:center;gap:8px;margin-bottom:8px;color:var(--admin-muted);font-size:13px}
.crumb a{color:var(--admin-muted)}.crumb a:hover{color:var(--admin-heading)}
.crumb strong{color:var(--admin-heading);font-weight:600}.crumb .pi-angle-right{font-size:11px}
.card{padding:24px;background:var(--admin-card);border:0;border-radius:var(--pk-radius);min-width:0;box-shadow:var(--pk-card-shadow)}
.card h2{display:flex;align-items:center;gap:10px;margin:0 0 16px;color:var(--admin-heading);font-size:17px;font-weight:700}
.state{padding:50px 20px;text-align:center;color:var(--admin-muted);font-size:13px}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
/* Ana kart */
.card.main{display:grid;gap:24px;padding:24px}
.card.main h2{margin:0;font-size:17px;font-weight:700}.card.main h2 i{color:var(--admin-link);font-size:22px}
.providers{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.provider{position:relative;display:flex;align-items:center;gap:14px;min-height:72px;padding:12px 18px;border:1px solid var(--admin-border);border-radius:12px;background:var(--admin-card);cursor:pointer}
.provider:hover{background:var(--admin-hover)}
.provider.active{border:2px solid var(--pk-accent);padding:11px 17px;background:var(--admin-accent-soft)}
.provider:focus-within{box-shadow:0 0 0 3px var(--pk-focus-ring)}
.provider-icon{flex:none;width:36px;display:grid;place-items:center;color:var(--admin-heading);font-size:24px}
.provider strong{color:var(--admin-heading);font-size:17px;font-weight:600}
.radio-mark{flex:none;width:22px;height:22px;display:grid;place-items:center;margin-left:auto;border:1.5px solid var(--admin-muted);border-radius:50%;color:var(--pk-on-accent);font-size:11px}
.provider.active .radio-mark{border-color:var(--pk-accent);background:var(--pk-accent)}
.key-state{display:inline-flex;align-items:center;gap:6px;align-self:center;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700;font-style:normal}
.key-state.ok::before{content:'';width:7px;height:7px;border-radius:50%;background:currentColor}
.key-state.ok{background:var(--admin-success-bg);color:var(--admin-success-text)}.key-state.warn{background:var(--admin-warning-bg);color:var(--admin-warning-text)}.key-state.missing{background:var(--admin-danger-bg);color:var(--admin-danger-text)}
.field{display:grid;gap:8px}
.field-label{color:var(--admin-heading);font-size:17px;font-weight:700}
.model-select{width:100%}
.model-select :deep(.p-select-label){padding:12px 18px;color:var(--admin-heading);font-size:16px}
.methods{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.method{display:flex;align-items:flex-start;gap:14px;padding:16px 18px;border:1px solid var(--admin-border);border-radius:12px;cursor:pointer}
.method:hover{background:var(--admin-hover)}
.method.active{border:2px solid var(--pk-accent);padding:15px 17px;background:var(--admin-accent-soft)}
.method input{flex:none;width:20px;height:20px;margin:3px 0 0;accent-color:var(--pk-accent)}
.method span{display:grid;gap:4px}
.method strong{color:var(--admin-heading);font-size:17px;font-weight:700}
.method small{color:var(--admin-text);font-size:14px}
.method .key-state{justify-self:start;margin-top:4px;font-size:12px}
.connection{display:flex;align-items:center;gap:14px;padding:16px 18px;border:1px solid var(--admin-border);border-radius:12px;background:var(--admin-soft)}
.connection.ok{border-color:var(--admin-success-bg);background:var(--admin-success-bg)}
.connection-text{display:grid;justify-items:start;gap:6px;min-width:0}
.connection-text strong{color:var(--admin-heading);font-size:17px;font-weight:700}
.connection .key-state{background:var(--admin-card)}
.text-link{display:inline-flex;align-items:center;gap:8px;margin-left:auto;padding:0;border:0;background:none;color:var(--admin-link);font:inherit;font-size:15px;font-weight:700;cursor:pointer;white-space:nowrap}
.actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.actions.end{display:flex;justify-content:flex-end}
.primary-button,.secondary-button{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:48px;padding:0 22px;border-radius:8px;font:inherit;font-size:15px;font-weight:700;cursor:pointer;text-decoration:none}
.primary-button{border:0;background:var(--pk-accent);color:var(--pk-on-accent);box-shadow:0 8px 16px rgba(var(--pk-accent-rgb),.24)}.primary-button:hover{background:var(--pk-accent-hover)}.primary-button:disabled{opacity:.55;cursor:not-allowed}
.secondary-button{border:1px solid rgba(145,158,171,.32);background:var(--admin-card);color:var(--admin-heading)}.secondary-button:hover{background:var(--admin-hover)}
.secondary-button i{color:var(--admin-link)}
/* Bağlantıyı yönet: istemci kartları */
.badge{padding:2px 8px;border-radius:6px;background:var(--admin-accent-soft);color:var(--admin-accent-text);font-size:12px;font-weight:700}
.fields{display:grid;gap:12px}
.fields label{display:grid;gap:6px;color:var(--admin-heading);font-size:12px;font-weight:700}
.fields label small{font-weight:400;color:var(--admin-muted);font-size:11px}
.fields input{height:40px;padding:0 12px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:13px;outline:0}
.fields input:focus{border-color:var(--pk-accent);box-shadow:0 0 0 3px var(--pk-focus-ring)}
.suggestions{display:flex;flex-wrap:wrap;gap:6px;margin-top:-4px}
.chip{display:inline-flex;align-items:baseline;gap:6px;padding:5px 10px;border:1px solid var(--admin-border);border-radius:999px;background:var(--admin-input);color:var(--admin-heading);font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.chip small{font-weight:400;color:var(--admin-muted);font-size:11px}
.chip:hover{border-color:var(--pk-accent)}.chip.active{border-color:var(--pk-accent);background:var(--admin-accent-soft)}
.link-button{border:0;padding:0;background:none;color:var(--admin-link);font:inherit;font-size:11px;font-weight:700;cursor:pointer}
.muted{color:var(--admin-muted);font-size:12px}
.error-text{margin:0;color:var(--admin-danger-text);font-size:13px}
.saved-text{display:flex;align-items:center;gap:6px;margin:0;color:var(--admin-success-text);font-size:13px;font-weight:700}
@media (max-width:700px){.providers,.methods,.actions{grid-template-columns:1fr}.page-head h1{font-size: 22px}.connection{flex-wrap:wrap}}
</style>
