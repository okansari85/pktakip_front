<script setup lang="ts">
const { loadStoredAuth, token, user } = useAuth()
loadStoredAuth()

if (token.value && user.value?.is_expert) {
  await navigateTo('/expert')
} else if (token.value && user.value?.roles?.includes('super-admin')) {
  await navigateTo('/customers')
} else {
  await navigateTo('/login')
}
</script>

<template><div /></template>
