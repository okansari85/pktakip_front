<template><CustomerTableImpl v-bind="$attrs" @open="$emit('open', $event)" /></template>
<script setup lang="ts">import CustomerTableImpl from './admin/CustomerTable.vue'
defineEmits<{ open: [tenant: any] }>()</script>
