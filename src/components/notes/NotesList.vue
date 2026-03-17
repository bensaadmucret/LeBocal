<script setup lang="ts">
const props = defineProps<{
  notes: { id: string; title: string; category: string; excerpt: string; status: string; updated: string }[]
  activeId?: string | null
}>()

const emit = defineEmits(['select'])
</script>

<template>
  <article
    v-for="note in props.notes"
    :key="note.title"
    class="glass-card tap-effect rounded-3xl p-4 animate-fade-in"
    :class="note.id === props.activeId ? 'ring-2 ring-royal' : ''"
    role="button"
    tabindex="0"
    @click="emit('select', note.id)"
    @keydown.enter="emit('select', note.id)"
  >
    <div class="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-gray-400 dark:text-slate-500 font-bold">
      <span>{{ note.category }}</span>
      <span>{{ note.status }}</span>
    </div>
    <h5 class="mt-2 font-display text-lg text-ink dark:text-lavender">{{ note.title }}</h5>
    <p class="text-sm text-gray-500 dark:text-slate-400">{{ note.excerpt }}</p>
    <p class="mt-2 text-xs text-gray-400 dark:text-slate-600">Mis à jour {{ note.updated }}</p>
  </article>
</template>
