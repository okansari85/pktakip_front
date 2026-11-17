<template>
  <section class="source">
    <header>
      <i class="pi pi-file head-icon" />
      <h3>Kaynak rapor</h3>
      <template v-if="file">
        <strong :title="file.name">{{ file.name }}</strong>
        <span class="chip">{{ size }}</span>
        <button class="outline-button" type="button" :disabled="disabled" @click="emit('pick')"><i class="pi pi-refresh" /> Dosya değiştir</button>
      </template>
    </header>
    <button v-if="!file" class="pick" type="button" :disabled="disabled" @click="emit('pick')">
      <i class="pi pi-cloud-upload" /><span><slot /></span>
    </button>
    <!-- Seçilen dosyanın önizlemesi (tarayıcıda, sunucuya gitmez) -->
    <iframe v-else-if="isPdf" :src="url" class="preview" title="Rapor önizleme" />
    <img v-else-if="isImage" :src="url" class="preview image" alt="Rapor önizleme" />
  </section>
</template>

<script setup lang="ts">
// Rapor pencerelerinin "Kaynak rapor" kartı. Dosya seçimi pencerenin kendi dosya kutusundan (pick); kart
// yalnızca adı, boyutu ve önizlemeyi gösterir.
const props = defineProps<{ file: File | null; disabled?: boolean }>()
const emit = defineEmits<{ pick: [] }>()

const url = ref('')
const release = () => { if (url.value) URL.revokeObjectURL(url.value); url.value = '' }
watch(() => props.file, file => { release(); if (file) url.value = URL.createObjectURL(file) }, { immediate: true })
onBeforeUnmount(release)

const isPdf = computed(() => !!props.file && (props.file.type === 'application/pdf' || props.file.name.toLowerCase().endsWith('.pdf')))
const isImage = computed(() => !!props.file?.type.startsWith('image/'))
const size = computed(() => props.file ? `${(props.file.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : '')
</script>

<style scoped>
.source{display:grid;gap:16px;min-width:0;padding:24px;background:var(--admin-card);border:0;border-radius:var(--pk-radius);box-shadow:var(--pk-card-shadow)}
header{display:flex;align-items:center;flex-wrap:wrap;gap:8px 14px;min-width:0}
.head-icon{color:var(--admin-link);font-size:20px}
h3{margin:0;color:var(--admin-heading);font-size:17px;font-weight:700;white-space:nowrap}
header strong{min-width:0;max-width:100%;overflow:hidden;color:var(--admin-heading);font-size:16px;font-weight:600;white-space:nowrap;text-overflow:ellipsis}
.chip{padding:2px 8px;border-radius:6px;background:var(--admin-accent-soft);color:var(--admin-accent-text);font-size:12px;font-weight:700;white-space:nowrap}
.outline-button{display:inline-flex;align-items:center;gap:7px;height:36px;margin-left:auto;padding:0 13px;border:1px solid rgba(145,158,171,.32);border-radius:8px;background:var(--admin-card);color:var(--admin-heading);font:inherit;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap}
.outline-button:hover{background:rgba(145,158,171,.08)}.outline-button:disabled{opacity:.55;cursor:not-allowed}
.pick{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;min-height:190px;padding:24px;border:1px dashed rgba(145,158,171,.32);border-radius:12px;background:rgba(145,158,171,.04);color:var(--admin-muted);font:inherit;text-align:center;cursor:pointer}
.pick:hover{border-color:var(--pk-accent)}.pick:disabled{cursor:not-allowed}
.pick > i{width:52px;height:52px;display:grid;place-items:center;border-radius:12px;background:var(--pk-primary-lighter);color:var(--pk-primary-dark);font-size:24px}
:global(.dark-theme) .pick > i{background:var(--admin-accent-soft);color:var(--admin-accent-text)}
.pick span{display:flex;flex-direction:column;gap:5px;max-width:420px}
.pick :slotted(strong){color:var(--admin-heading);font-size:15px}
.pick :slotted(small){color:var(--admin-muted);font-size:12px;line-height:1.45}
.preview{width:100%;height:340px;border:1px solid rgba(145,158,171,.2);border-radius:8px;background:var(--admin-soft)}
.preview.image{height:auto;max-height:340px;object-fit:contain}
</style>
