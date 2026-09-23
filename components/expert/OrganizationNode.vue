<template>
  <div class="node-wrap">
    <div class="node-row" :style="{ paddingLeft: `${depth * 22}px` }">
      <button v-if="node.children?.length" class="expand-button" type="button" @click="expanded = !expanded">
        <i :class="expanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" />
      </button>
      <span v-else class="expand-placeholder" />
      <i class="pi pi-folder node-icon" />
      <span class="node-name">{{ node.name }}</span>
      <button class="node-menu" type="button" title="Alt organizasyon ekle" @click="emit('add-child', node)">
        <i class="pi pi-ellipsis-h" />
      </button>
    </div>
    <div v-if="expanded && node.children?.length" class="children">
      <OrganizationNode v-for="child in node.children" :key="child.id" :node="child" :depth="depth + 1" @add-child="forwardAddChild" />
    </div>
  </div>
</template>

<script setup lang="ts">
interface OrganizationNode { id: number | string; name: string; children?: OrganizationNode[] }
withDefaults(defineProps<{ node: OrganizationNode; depth?: number }>(), { depth: 0 })
const emit = defineEmits<{ 'add-child': [node: OrganizationNode] }>()
const expanded = ref(true)
const forwardAddChild = (node: OrganizationNode) => emit('add-child', node)
</script>

<style scoped>
.node-row{min-height:42px;display:flex;align-items:center;gap:8px;border-radius:7px;color:#263140}.node-row:hover{background:#f7f8fa}.expand-button,.node-menu{width:28px;height:28px;display:grid;place-items:center;border:0;background:transparent;color:#7b8798;border-radius:6px;cursor:pointer}.expand-button:hover,.node-menu:hover{background:#eceff3;color:#111827}.expand-placeholder{width:28px;flex:0 0 28px}.node-icon{color:#667085;font-size:15px}.node-name{min-width:0;flex:1;font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.node-menu{margin-left:auto}
</style>
