<template>
  <ExpertFirmTree :key="String(route.params.id)" :customer-id="String(route.params.id)" />
</template>

<script setup lang="ts">
// Firma (müşteri) sayfası: bütün yapı tek ağaçta (components/expert/FirmTree.vue; OSGB Firmalarım'daki tek ağaç da aynı bileşen).
definePageMeta({ layout: 'expert', middleware: 'expert' })
const route = useRoute()
</script>
