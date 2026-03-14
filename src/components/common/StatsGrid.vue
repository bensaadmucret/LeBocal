<script setup lang="ts">
const props = defineProps<{
  stats: { title: string; value: number; detail: string }[]
}>()
</script>

<template>
  <div class="grid gap-4 md:grid-cols-3">
    <article
      v-for="stat in props.stats"
      :key="stat.title"
      class="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-card"
    >
      <p class="text-sm text-gray-500">{{ stat.title }}</p>
      <p class="mt-2 font-display text-4xl text-ink">{{ stat.value }}</p>
      <p class="text-sm text-royal">{{ stat.detail }}</p>
    </article>
  </div>
</template>
