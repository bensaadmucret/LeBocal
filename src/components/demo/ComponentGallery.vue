<script setup lang="ts">
import StatsGrid from '../common/StatsGrid.vue'
import NotesList from '../notes/NotesList.vue'
import ActiveNotePanel from '../notes/ActiveNotePanel.vue'
import TagPill from '../common/TagPill.vue'

const props = defineProps<{
  stats: { title: string; value: number; detail: string }[]
  notes: { title: string; category: string; excerpt: string; status: string; updated: string }[]
  activeNote: {
    title: string
    owner: string
    tags: string[]
    summary: string
    checklist: { label: string; done: boolean }[]
    highlights: string[]
  }
  timeline: { time: string; event: string }[]
}>()
</script>

<template>
  <section class="rounded-[40px] bg-white/80 p-6 shadow-card ring-1 ring-white/60">
    <header class="mb-6 border-b border-white/70 pb-4">
      <p class="text-xs uppercase tracking-[0.4em] text-gray-400">Galerie de composants</p>
      <h2 class="font-display text-2xl text-ink">Kit Vue + Tailwind</h2>
      <p class="text-sm text-gray-500">Chaque bloc reprend exactement la structure desktop pour validation isolée.</p>
    </header>

    <div class="space-y-10">
      <article>
        <p class="text-xs uppercase tracking-[0.3em] text-gray-400">StatsGrid</p>
        <StatsGrid :stats="props.stats" />
      </article>

      <article class="space-y-3">
        <p class="text-xs uppercase tracking-[0.3em] text-gray-400">NotesList</p>
        <NotesList :notes="props.notes" />
      </article>

      <article class="space-y-3">
        <p class="text-xs uppercase tracking-[0.3em] text-gray-400">ActiveNotePanel</p>
        <ActiveNotePanel :note="props.activeNote" :timeline="props.timeline" />
      </article>

      <article>
        <p class="text-xs uppercase tracking-[0.3em] text-gray-400">TagPill</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <TagPill v-for="tag in props.activeNote.tags" :key="tag" :label="tag" />
        </div>
      </article>
    </div>
  </section>
</template>
