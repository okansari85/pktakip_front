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
// Tasarım kataloğu 22: rapor pencerelerinin "Kaynak rapor" kartı. Dosya seçimi pencerenin kendi dosya kutusundan (pick); kart
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
.source{display:grid;gap:14px;min-width:0;padding:16px 18px;background:var(--admin-card);border:1px solid var(--admin-border);border-radius:18px;box-shadow:0 10px 28px rgba(var(--pk-shadow-rgb),.05)}
header{display:flex;align-items:center;flex-wrap:wrap;gap:8px 14px;min-width:0}
.head-icon{color:var(--admin-link);font-size:20px}
h3{margin:0;color:var(--admin-heading);font-size:20px;font-weight:800;white-space:nowrap}
header strong{min-width:0;max-width:100%;overflow:hidden;color:var(--admin-heading);font-size:16px;font-weight:600;white-space:nowrap;text-overflow:ellipsis}
.chip{padding:3px 10px;border-radius:999px;background:var(--admin-accent-soft);color:var(--admin-link);font-size:12px;font-weight:700;white-space:nowrap}
.outline-button{display:inline-flex;align-items:center;gap:7px;height:36px;margin-left:auto;padding:0 13px;border:1px solid var(--pk-accent);border-radius:10px;background:var(--admin-card);color:var(--admin-link);font:inherit;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap}
.outline-button:hover{background:var(--admin-accent-soft)}.outline-button:disabled{opacity:.55;cursor:not-allowed}
.pick{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;min-height:190px;padding:22px;border:1.5px dashed var(--admin-border);border-radius:14px;background:var(--admin-soft);color:var(--admin-muted);font:inherit;text-align:center;cursor:pointer}
.pick:hover{border-color:var(--pk-accent)}.pick:disabled{cursor:not-allowed}
.pick > i{width:52px;height:52px;display:grid;place-items:center;border-radius:14px;background:var(--admin-accent-soft);color:var(--admin-link);font-size:24px}
.pick span{display:flex;flex-direction:column;gap:5px;max-width:420px}
.pick :slotted(strong){color:var(--admin-heading);font-size:15px}
.pick :slotted(small){color:var(--admin-muted);font-size:12px;line-height:1.45}
.preview{width:100%;height:340px;border:1px solid var(--admin-border);border-radius:12px;background:var(--admin-soft)}
.preview.image{height:auto;max-height:340px;object-fit:contain}
</style>
