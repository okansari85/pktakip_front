<template>
  <ol class="steps" aria-label="Adımlar">
    <li v-for="(label, index) in LABELS" :key="label" :class="{ done: index + 1 < step, active: index + 1 === step }" :aria-current="index + 1 === step ? 'step' : undefined">
      <span><PkIcon v-if="index + 1 < step" class="pi pi-check" /><template v-else>{{ index + 1 }}</template></span>{{ label }}
    </li>
  </ol>
</template>

<script setup lang="ts">
// Rapor yükleme pencerelerinin adımları (yalnız gösterim). step: 1 Dosya yükle, 2 Bilgileri doğrula, 3 Kaydet.
defineProps<{ step: number }>()
const LABELS = ['Dosya yükle', 'Bilgileri doğrula', 'Kaydet']
</script>

<style scoped>
.steps{display:flex;align-items:center;gap:28px;margin:0;padding:0;list-style:none}
.steps li{position:relative;display:inline-flex;align-items:center;gap:10px;padding:4px 14px 4px 4px;border:0;border-radius:8px;background:transparent;color:var(--admin-muted);font-size:14px;font-weight:600;white-space:nowrap}
.steps li + li::before{content:'';position:absolute;right:calc(100% + 3px);top:50%;width:22px;height:2px;border-radius:2px;background:rgba(145,158,171,.2)}
.steps li.done + li::before{background:var(--pk-success-main)}
.steps span{width:28px;height:28px;display:grid;place-items:center;border-radius:50%;background:rgba(145,158,171,.16);color:var(--admin-muted);font-size:13px;font-weight:700}
.steps i{font-size:12px;font-weight:800}
.steps li.done{color:var(--admin-heading)}
.steps li.done span{background:var(--admin-success-bg);color:var(--admin-success-text)}
.steps li.active{background:var(--admin-accent-soft);color:var(--admin-heading);font-weight:700}
.steps li.active span{background:var(--pk-accent);color:var(--pk-on-accent)}
@media(max-width:700px){.steps{gap:14px}.steps li{padding-right:10px;font-size:12px}.steps li + li::before{width:10px}}
</style>
