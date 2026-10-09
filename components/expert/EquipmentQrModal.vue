<script setup lang="ts">
// Ekipman karekod etiketi (tanıtım sitesindeki etiket tasarımının aynısı). Karekod bu ekipmanın uygulamadaki detay
// sayfasının adresini taşır (okutan giriş yapmışsa açılır). Yazdır: yalnız etiket basılır. PNG indir: karekod görseli.
// Kural: pencere dışarı tıklayınca kapanmaz; yalnız X / İptal.
import QrcodeVue from 'qrcode.vue'

const props = defineProps<{ open: boolean; equipmentId: number | string; code?: string | null; typeName?: string | null; place?: string | null; nextControl?: string | null }>()
const emit = defineEmits<{ close: [] }>()

const url = computed(() => (import.meta.client ? `${window.location.origin}/expert/equipment/${props.equipmentId}` : ''))
const qrWrap = ref<HTMLElement | null>(null)

function download() {
  const canvas = qrWrap.value?.querySelector('canvas')
  if (!canvas) return
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = `karekod-${props.code || props.equipmentId}.png`
  a.click()
}
const print = () => window.print()
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop qr-modal">
      <div class="qr-dialog" role="dialog" aria-modal="true" aria-labelledby="qr-baslik">
        <div class="qr-head">
          <h2 id="qr-baslik">Karekod etiketi</h2>
          <button type="button" class="qr-close" aria-label="Kapat" @click="emit('close')"><i class="pi pi-times" /></button>
        </div>

        <div class="qr-label">
          <div class="label-head">
            <span class="label-mark"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#111827" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg></span>
            <span class="label-brand"><span class="pk">PK</span>Takip</span>
            <span class="label-kicker">PERİYODİK KONTROL</span>
          </div>
          <div class="label-body">
            <div ref="qrWrap" class="qr"><QrcodeVue :value="url" :size="96" level="M" render-as="canvas" :margin="1" /></div>
            <div class="label-info">
              <span class="label-code">{{ code || '—' }}</span>
              <span class="label-type">{{ typeName }}</span>
              <span class="label-place">{{ place }}</span>
            </div>
          </div>
          <div class="label-foot"><span>Gelecek kontrol</span><span class="label-date">{{ nextControl || '—' }}</span></div>
        </div>

        <p class="qr-note">Karekod okutulunca bu ekipmanın uygulamadaki sayfası açılır (giriş gerekir).</p>
        <div class="qr-actions">
          <button type="button" class="secondary-button" @click="emit('close')">İptal</button>
          <button type="button" class="secondary-button" @click="download"><i class="pi pi-download" /> PNG indir</button>
          <button type="button" class="primary-button" @click="print"><i class="pi pi-print" /> Yazdır</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style>
/* Yazdırırken yalnız etiket basılır */
@media print {
  body * { visibility: hidden !important; }
  .qr-modal .qr-label, .qr-modal .qr-label * { visibility: visible !important; }
  .qr-modal .qr-label { position: fixed; left: 0; top: 0; box-shadow: none; }
}
</style>

<style scoped>
.qr-modal { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(15, 23, 42, 0.55); }
.qr-dialog { width: 100%; max-width: 380px; background: #fff; border-radius: 16px; padding: 20px; display: flex; flex-direction: column; gap: 16px; align-items: center; }
.qr-head { width: 100%; display: flex; justify-content: space-between; align-items: center; }
.qr-head h2 { margin: 0; font-size: 18px; color: #0f172a; }
.qr-close { width: 36px; height: 36px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; cursor: pointer; }
.qr-note { margin: 0; font-size: 12.5px; color: #64748b; text-align: center; }
.qr-actions { width: 100%; display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }

/* Etiket: tanıtım sitesi features/QrLabel.vue ile aynı */
.qr-label { width: 244px; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; box-shadow: 0 16px 36px rgba(15, 23, 42, 0.1); overflow: hidden; font-family: Inter, system-ui, sans-serif; }
.label-head { background: #111827; padding: 10px 14px; display: flex; align-items: center; gap: 8px; }
.label-mark { width: 20px; height: 20px; border-radius: 5px; background: #ffc107; display: flex; align-items: center; justify-content: center; }
.label-brand { font-size: 13px; font-weight: 800; color: #fff; }
.pk { color: #ffc107; }
.label-kicker { margin-left: auto; font-size: 9.5px; font-weight: 800; letter-spacing: 0.08em; color: #94a3b8; }
.label-body { padding: 14px; display: flex; gap: 12px; align-items: center; }
.qr { flex-shrink: 0; line-height: 0; }
.label-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.label-code { font-size: 16px; font-weight: 800; color: #0f172a; }
.label-type { font-size: 12.5px; color: #334155; }
.label-place { font-size: 11.5px; color: #64748b; }
.label-foot { display: flex; justify-content: space-between; padding: 9px 14px; border-top: 1px solid #edf0f5; background: #f8fafc; font-size: 11.5px; color: #64748b; }
.label-date { font-weight: 800; color: #0f172a; }
</style>
