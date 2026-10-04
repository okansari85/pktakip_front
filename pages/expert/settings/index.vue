<script setup lang="ts">
definePageMeta({ middleware: 'expert' })
// Role göre Ayarlar'ın ilk sayfası (bireysel uzmanda Müşteriler, bugünkü gibi).
const { settingsHome, load } = useAccount()
await load()
await navigateTo(settingsHome.value, { replace: true })
</script>

<template><div /></template>
