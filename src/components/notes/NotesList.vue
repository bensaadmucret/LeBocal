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
    class="rounded-3xl border border-white/80 bg-white/80 p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-lg"
    :class="note.id === props.activeId ? 'ring-2 ring-royal' : ''"
    role="button"
    tabindex="0"
    @click="emit('select', note.id)"
    @keydown.enter="emit('select', note.id)"
  >
    <div class="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-gray-400">
      <span>{{ note.category }}</span>
      <span>{{ note.status }}</span>
    </div>
    <h5 class="mt-2 font-display text-lg text-ink">{{ note.title }}</h5>
    <p class="text-sm text-gray-500">{{ note.excerpt }}</p>
    <p class="mt-2 text-xs text-gray-400">Mis à jour {{ note.updated }}</p>
  </article>
</template>
