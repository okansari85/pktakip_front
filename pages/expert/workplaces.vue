<template>
  <div class="workplaces-page">
    <div class="page-head">
      <div>
        <div class="breadcrumb"><span>Uzman Paneli</span><i class="pi pi-angle-right" /><strong>Firmalarım</strong></div>
        <h1>Firmalarım</h1>
        <p v-if="loaded && workplaces.length">
          <strong>{{ workplaces.length }}</strong> işyeri · <strong>{{ locationCount }}</strong> lokasyon · <strong>{{ customerCount }}</strong> müşteri
        </p>
        <p v-else>Hizmet verdiğiniz işyerleri.</p>
      </div>
    </div>

    <ExpertWorkplaceTable :workplaces="workplaces" :loading="!loaded && !error" :error="error">
      <template #empty>
        <template v-if="workplaces.length === 0">
          <span>Müşteri, lokasyon ve firma tanımlarını Ayarlar'dan yapabilirsiniz.</span>
          <NuxtLink to="/expert/settings/companies" class="secondary-link"><i class="pi pi-cog" /> Ayarlar'a git</NuxtLink>
        </template>
        <span v-else>Aramanızla eşleşen işyeri yok.</span>
      </template>
    </ExpertWorkplaceTable>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'expert', middleware: 'expert' })

const { workplaces, loaded, error, load } = useMyWorkplaces()

const locationCount = computed(() => new Set(workplaces.value.map(w => w.location_id)).size)
const customerCount = computed(() => new Set(workplaces.value.map(w => w.customer_name).filter(Boolean)).size)

// Sayfa her açıldığında listeyi tazeler (Ayarlar'da yapılan değişiklikler görünsün).
onMounted(() => load(true))
</script>

<style scoped>
.workplaces-page { max-width: 1500px; margin: 0 auto; }
.page-head { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; margin-bottom:24px; }
.breadcrumb { display:flex; align-items:center; gap:8px; margin-bottom:10px; color:var(--admin-muted); font-size:12px; }.breadcrumb strong{color:var(--admin-heading)}
h1{margin:0;color:var(--admin-heading);font-size:30px;letter-spacing:-.7px}.page-head p{margin:7px 0 0;color:var(--admin-muted);font-size:13px}.page-head p strong{color:var(--admin-heading)}
.secondary-link{display:inline-flex;align-items:center;gap:7px;margin-top:8px;padding:9px 14px;border:1px solid var(--admin-border);border-radius:8px;background:var(--admin-input);color:var(--admin-heading);font-size:12px;font-weight:700}.secondary-link:hover{border-color:#d7a900;background:var(--admin-accent-soft)}
</style>
