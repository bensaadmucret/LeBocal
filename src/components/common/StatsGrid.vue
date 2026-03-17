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
      class="glass-card tap-effect animate-fade-in group rounded-3xl p-5"
    >
      <p class="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] group-hover:text-royal dark:group-hover:text-lavender transition-colors">{{ stat.title }}</p>
      <p class="mt-2 font-display text-4xl text-[var(--text-main)]">{{ stat.value }}</p>
      <div class="mt-3 flex items-center justify-between text-xs font-medium text-royal dark:text-lavender">
        <span>{{ stat.detail }}</span>
        <span class="opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
      </div>
    </article>
  </div>
</template>
