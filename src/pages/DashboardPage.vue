<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAppShell } from '../composables/useAppShell'
import StatsGrid from '../components/common/StatsGrid.vue'
import NotesList from '../components/notes/NotesList.vue'
import ActiveNotePanel from '../components/notes/ActiveNotePanel.vue'
import type { Block } from '../stores/useNotesStore'

const shell = useAppShell()
const router = useRouter()

const boardStats = computed(() => {
  const notes = shell.store.notes.value
  const noteCount = notes.length
  const reviewCount = notes.filter((note) => note.status?.toLowerCase().includes('rev')).length
  const blocks = notes.reduce((sum, note) => sum + (note.blocks?.length || 0), 0)
  return [
    { title: 'Notes actives', value: noteCount, detail: `+${Math.max(1, noteCount)} cette semaine` },
    { title: 'Revues à faire', value: reviewCount, detail: `${Math.max(1, reviewCount)} urgentes` },
    { title: 'Blocs créés', value: blocks, detail: `+${Math.max(1, blocks)} vs hier` },
  ]
})

const workspaceNotes = computed(() =>
  shell.store.notes.value.map((note) => ({
    id: note.id,
    title: note.title || 'Sans titre',
    category: (note.tags?.[0] || 'Général').toUpperCase(),
    excerpt: note.summary || 'Aucun résumé pour le moment.',
    status: note.status || 'Brouillon',
    updated: shell.formatRelativeTime(note.updatedAt),
  })),
)

const activeDesktopNote = computed(() => {
  const note = shell.store.activeNote.value || shell.store.notes.value[0]
  if (!note) {
    return {
      id: 'placeholder', title: 'Aucune note active', owner: 'Studio Produit',
      status: 'Brouillon', tags: ['Produit'],
      summary: 'Créez votre première note pour remplir ce panneau.',
      checklist: [], highlights: ['Ajoutez des blocs pour enrichir la note.'], blocks: [],
    }
  }
  const normalizedBlocks: Block[] = (note.blocks || []).map((block, index) => ({
    ...block, id: block.id || `block-${index}`,
  }))
  return {
    id: note.id, title: note.title || 'Sans titre',
    owner: note.status ? `Statut : ${note.status}` : 'Sans statut',
    status: note.status || 'Brouillon',
    tags: note.tags?.length ? note.tags : ['Produit'],
    summary: note.summary || 'Aucun résumé',
    checklist: (note.tasks || []).map((task, index) => ({ id: task.id || `task-${index}`, label: task.label, done: task.done })),
    highlights: note.blocks?.length ? note.blocks.map((block) => `Bloc ${block.type || 'texte'}`) : ['Ajoutez des blocs pour enrichir la note.'],
    blocks: normalizedBlocks,
  }
})

const timeline = computed(() => {
  const note = shell.store.activeNote.value || shell.store.notes.value[0]
  if (!note) return []
  const items = (note.tasks || []).map((task) => ({ time: task.done ? '✓' : '…', event: task.label }))
  if (!items.length) items.push({ time: '⏱', event: 'Aucune tâche pour le moment.' })
  return items
})

const quickFlow = computed(() => {
  const notes = shell.store.notes.value
  const reviewCount = notes.filter((note) => note.status?.toLowerCase().includes('rev')).length
  const pendingBlocks = notes.reduce((sum, note) => sum + (note.blocks?.length || 0), 0)
  const lastSyncLabel = shell.lastSyncAt.value ? shell.formatRelativeTime(shell.lastSyncAt.value) : '—'
  return { reviewCount, pendingBlocks, lastSyncLabel }
})
</script>

<template>
  <div class="space-y-6 lg:space-y-8">
    <header class="flex flex-col md:flex-row md:items-center gap-4 lg:gap-6">
      <div class="flex-1">
        <p class="text-xs uppercase tracking-[0.4em] text-[var(--text-muted)]">Bienvenue, Léna</p>
        <h1 class="font-display text-2xl lg:text-3xl font-semibold text-[var(--text-main)]">Workspace Hub</h1>
      </div>
      <div class="flex items-center gap-3 lg:gap-4">
        <button
          type="button"
          class="flex-1 md:flex-none md:w-64 lg:w-80 rounded-full bg-[var(--surface-card)] dark:bg-[var(--glass-bg)] px-5 lg:px-6 py-2.5 lg:py-3 shadow-inner ring-1 ring-black/5 dark:ring-white/5 flex items-center justify-between gap-3 text-left transition hover:ring-2 hover:ring-sage/30"
          @click="shell.handleCommandPaletteOpen()"
        >
          <span class="flex items-center gap-3 text-[var(--text-muted)]">
            <span class="text-slate-400">🔍</span>
            <span class="text-sm font-medium text-[var(--text-main)] dark:text-white">Rechercher partout</span>
          </span>
          <span class="hidden md:flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
            <span class="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-white/10 dark:text-slate-200">⌘</span>
            <span class="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-white/10 dark:text-slate-200">K</span>
          </span>
        </button>
      </div>
    </header>

    <!-- Hero Card -->
    <section class="hero-card grid gap-6 p-6 lg:p-8 md:grid-cols-[2fr,1fr] animate-fade-in">
      <div>
        <p class="text-sm text-white/80">Espace disponible</p>
        <p class="mt-2 text-3xl lg:text-5xl font-semibold">20.25 GB</p>
        <p class="text-white/70">sur 25 GB utilisés</p>
        <div class="chips mt-6 flex flex-wrap gap-2 text-[10px] lg:text-xs text-white/80">
          <span>Synchro {{ quickFlow.lastSyncLabel }}</span>
          <span>Priorité notes</span>
        </div>
      </div>
      <div class="flex flex-col items-start md:items-end justify-between md:justify-end gap-4">
        <div class="text-left md:text-right">
          <p class="text-[10px] uppercase tracking-[0.3em] text-white/70">Statut</p>
          <p class="mt-1 rounded-xl bg-white/25 px-4 py-1.5 text-white font-medium border border-white/20">Healthy</p>
        </div>
        <button class="tap-effect w-full md:w-auto rounded-xl lg:rounded-2xl bg-white text-sm font-semibold text-slate-900 px-6 py-3 shadow-xl">Gérer l'espace</button>
      </div>
    </section>

    <!-- Stats -->
    <StatsGrid :stats="boardStats" />

    <!-- Main grid -->
    <section class="grid gap-6 lg:grid-cols-[1.6fr,1.1fr]">
      <!-- Left: Collections & Notes -->
      <div class="space-y-6">
        <div class="glass-card rounded-[28px] lg:rounded-[32px] p-5 lg:p-6 shadow-xl">
          <div class="flex items-center justify-between">
            <h2 class="text-lg lg:text-xl font-semibold text-[var(--text-main)]">Collections</h2>
            <router-link to="/notes" class="text-sm text-indigo-500 font-medium">Voir tout</router-link>
          </div>
          <div class="mt-4 lg:mt-5 grid gap-4 grid-cols-1 sm:grid-cols-2">
            <article
              v-for="collection in shell.budgetCategoryBreakdown.value"
              :key="collection.id"
              class="collection-card tap-effect rounded-[24px] lg:rounded-[28px] p-4 lg:p-5 cursor-pointer border border-transparent dark:bg-[var(--glass-bg)]"
              :class="[collection.color || 'bg-gradient-to-br from-white to-slate-50 dark:from-[var(--surface)] dark:to-[var(--glass-bg)]', 'shadow-sm hover:shadow-md']"
            >
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-[10px] uppercase tracking-[0.35em] text-[var(--text-muted)] font-bold">{{ collection.name }}</p>
                  <p class="text-base lg:text-lg font-semibold text-[var(--text-main)]">{{ collection.total }} items</p>
                </div>
                <span class="text-xl lg:text-2xl">{{ collection.icon || '📁' }}</span>
              </div>
              <p class="mt-2 lg:mt-3 text-[10px] text-[var(--text-muted)] font-medium">Auto-mis à jour</p>
            </article>
          </div>
        </div>

        <div class="glass-card rounded-[28px] lg:rounded-[32px] p-5 lg:p-6 shadow-xl">
          <div class="flex items-center justify-between">
            <h2 class="text-lg lg:text-xl font-semibold text-[var(--text-main)]">Notes rapides</h2>
            <router-link to="/notes" class="text-sm text-indigo-500 font-medium">Tout voir</router-link>
          </div>
          <div class="mt-4">
            <NotesList :notes="workspaceNotes" :active-id="activeDesktopNote.id" @select="shell.handleSelectNote" />
          </div>
        </div>
      </div>

      <!-- Right: Active Note -->
      <div class="space-y-6">
        <ActiveNotePanel
          :note="activeDesktopNote"
          :timeline="timeline"
          :budget-transactions="shell.budgetNoteTransactions.value[activeDesktopNote.id] || []"
          @update-note="shell.handleUpdateActiveNote"
          @edit-note="(id: string) => { shell.openEditorModal(id); router.push('/notes') }"
          @delete-note="(id?: string) => shell.promptDeleteNote(id ?? activeDesktopNote.id)"
        />

        <div class="glass-card rounded-[32px] p-6 shadow-xl animate-fade-in">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-[10px] lg:text-xs uppercase tracking-[0.3em] text-[var(--text-muted)] font-bold">Planner</p>
              <h3 class="text-lg lg:text-xl font-semibold text-[var(--text-main)]">{{ shell.budgetTripPlans.value?.[0]?.title || 'Aucun voyage' }}</h3>
            </div>
            <button class="tap-effect rounded-full border border-slate-200 dark:border-white/10 px-4 py-1.5 text-xs text-[var(--text-main)] hover:bg-slate-50 dark:hover:bg-white/5 transition-colors" @click="router.push('/budget')">
              Ouvrir
            </button>
          </div>
          <p class="mt-3 text-xs lg:text-sm text-slate-500">
            {{ shell.budgetTripPlans.value?.[0]?.startDate ? new Date(shell.budgetTripPlans.value[0].startDate).toLocaleDateString() : 'Prochainement' }} ·
            Budget {{ shell.budgetTripPlans.value?.[0]?.estimatedTotal || '0' }} €
          </p>
        </div>
      </div>
    </section>
  </div>
</template>
