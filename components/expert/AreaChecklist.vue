<template>
  <div class="area-checklist">
    <label v-for="area in visible" :key="area.id" class="area-check" :class="{ checked: modelValue.includes(area.id) }">
      <input type="checkbox" :checked="modelValue.includes(area.id)" :disabled="disabled" @change="toggle(area.id)" />
      <span><strong>{{ area.label }}</strong><small>{{ area.typeName }}<template v-if="!area.active"> · pasif</template></small></span>
    </label>
  </div>
</template>

<script setup lang="ts">
// Alanların (fiziksel yerler) toplu seçimi, ör. bir birimin kullandığı alanlar. Pasif alanlar yalnızca seçiliyse görünür.
const props = defineProps<{ areas: AreaOption[]; modelValue: number[]; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: number[]] }>()

const visible = computed(() => props.areas.filter(area => area.active || props.modelValue.includes(area.id)))
const toggle = (id: number) => emit('update:modelValue', props.modelValue.includes(id) ? props.modelValue.filter(item => item !== id) : [...props.modelValue, id])
</script>

<style scoped>
.area-checklist{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.area-check{display:flex;align-items:flex-start;gap:9px;margin:0 !important;padding:9px 11px;border:1px solid var(--admin-border);border-radius:9px;background:var(--admin-input);cursor:pointer;font-weight:400 !important}
.area-check:hover{border-color:#d7a900}.area-check.checked{border-color:#d7a900;background:var(--admin-accent-soft)}
.area-check input{width:16px;height:16px;margin:1px 0 0;accent-color:#d7a900;flex-shrink:0}
.area-check span{display:flex;flex-direction:column;gap:2px;min-width:0}.area-check strong{color:var(--admin-heading);font-size:12px}.area-check small{color:var(--admin-muted);font-size:10px}
@media(max-width:640px){.area-checklist{grid-template-columns:1fr}}
</style>
