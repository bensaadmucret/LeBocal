<script setup lang="ts">
import { computed } from 'vue'
import { useAppShell } from '../composables/useAppShell'
import NotesList from '../components/notes/NotesList.vue'
import ActiveNotePanel from '../components/notes/ActiveNotePanel.vue'
import NoteComposerModal from '../components/notes/NoteComposerModal.vue'
import EditorCanvas from '../components/editor/EditorCanvas.vue'
import CommandPalette from '../components/common/CommandPalette.vue'
import type { Block } from '../stores/useNotesStore'

const shell = useAppShell()

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

const toastVariants: Record<string, string> = {
  info: 'bg-ink text-white',
  success: 'bg-emerald-500 text-white',
  error: 'bg-rose-600 text-white',
}

const logBadgeVariants: Record<string, string> = {
  info: 'bg-gray-200 text-gray-700',
  success: 'bg-emerald-100 text-emerald-700',
  error: 'bg-rose-100 text-rose-600',
}
</script>

<template>
  <div class="space-y-6 lg:space-y-8">
    <header class="flex items-center justify-between">
      <div>
        <p class="text-xs uppercase tracking-[0.4em] text-[var(--text-muted)]">Notes</p>
        <h1 class="font-display text-2xl lg:text-3xl font-semibold text-[var(--text-main)]">Mes notes</h1>
      </div>
      <div class="flex items-center gap-3">
        <button
          class="tap-effect rounded-2xl bg-sage text-white px-5 py-2.5 text-sm font-semibold shadow-lg shadow-sage/20 hover:scale-105 transition-transform"
          @click="shell.handleCreateNote"
        >
          + Nouvelle note
        </button>
      </div>
    </header>

    <section class="grid gap-6 lg:grid-cols-[1fr,1.4fr]">
      <!-- Left: Notes list -->
      <div class="glass-card rounded-[32px] p-5 lg:p-6 shadow-xl">
        <h2 class="text-lg font-semibold text-[var(--text-main)] mb-4">Toutes les notes</h2>
        <NotesList :notes="workspaceNotes" :active-id="activeDesktopNote.id" @select="shell.handleSelectNote" />
      </div>

      <!-- Right: Active note -->
      <ActiveNotePanel
        :note="activeDesktopNote"
        :timeline="timeline"
        :budget-transactions="shell.budgetNoteTransactions.value[activeDesktopNote.id] || []"
        @update-note="shell.handleUpdateActiveNote"
        @edit-note="shell.openEditorModal"
        @delete-note="(id?: string) => shell.promptDeleteNote(id ?? activeDesktopNote.id)"
      />
    </section>

    <!-- Editor Modal -->
    <transition name="fade">
      <div v-if="shell.showEditorModal.value" class="fixed inset-0 z-[65] flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-10">
        <div class="relative w-full max-w-5xl rounded-[48px] bg-[#faf9f6] dark:bg-[var(--surface)] p-12 shadow-2xl border border-black/5" style="max-height: 92vh; overflow-y: auto;">
          <div class="flex items-center justify-between mb-8">
            <div>
              <h2 class="font-display text-3xl text-anthracite tracking-tight">Édition de la note</h2>
              <p class="text-sm text-clay mt-1">Vos modifications sont sauvegardées instantanément.</p>
            </div>
            <button class="h-10 w-10 flex items-center justify-center rounded-full bg-black/5 text-anthracite hover:bg-black/10 transition-colors" @click="shell.closeEditorModal">✕</button>
          </div>
          <EditorCanvas :model-value="activeDesktopNote.blocks" @update:model-value="(blocks: Block[]) => shell.handleUpdateActiveNote({ status: activeDesktopNote.status, summary: activeDesktopNote.summary, tasks: activeDesktopNote.checklist, blocks, tags: activeDesktopNote.tags })" />
          <div class="mt-8 flex justify-end gap-3">
            <button class="rounded-2xl border border-slate-200 px-6 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition" @click="shell.closeEditorModal">Fermer</button>
            <button class="rounded-2xl bg-sage px-6 py-3 text-sm font-semibold text-white shadow-lg hover:scale-105 transition-transform" @click="shell.closeEditorModal">Sauvegarder</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Note Composer Modal -->
    <NoteComposerModal
      :open="shell.noteComposerOpen.value"
      :saving="shell.noteComposerSavingMode.value !== null"
      :clear-trigger="shell.noteComposerClearTrigger.value"
      @close="shell.handleCloseNoteComposer"
      @save="shell.handleComposerSave"
      @publish="shell.handleComposerPublish"
      @create-collection="shell.handleComposerCreateCollection"
    />

    <!-- Delete Confirmation -->
    <transition name="fade">
      <div v-if="shell.pendingDeleteId.value" class="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
        <div class="rounded-[32px] bg-white dark:bg-[var(--surface)] p-8 shadow-2xl max-w-sm text-center">
          <p class="font-display text-xl text-[var(--text-main)] mb-2">Supprimer cette note ?</p>
          <p class="text-sm text-[var(--text-muted)] mb-6">Cette action est irréversible.</p>
          <div class="flex justify-center gap-3">
            <button class="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium" @click="shell.cancelPendingDelete">Annuler</button>
            <button class="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white" @click="shell.confirmPendingDelete">Supprimer</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Command Palette -->
    <CommandPalette
      :open="shell.commandPaletteOpen.value"
      :query="shell.commandPaletteQuery.value"
      :sections="shell.commandPaletteSections.value"
      :uses-cache="shell.commandPaletteUsesCache.value"
      :cache-last-sync="shell.paletteCacheLastSyncLabel.value"
      @close="shell.handleCommandPaletteClose"
      @update:query="shell.commandPaletteQuery.value = $event"
      @select="shell.handleCommandPaletteSelect"
    />

    <!-- Toasts -->
    <div class="fixed bottom-6 right-6 z-[80] flex flex-col gap-2">
      <transition-group name="fade">
        <div
          v-for="toast in shell.toasts.value"
          :key="toast.id"
          :class="toastVariants[toast.type] || toastVariants.info"
          class="rounded-xl px-5 py-3 text-sm font-medium shadow-xl backdrop-blur-sm"
          @click="shell.dismissToast(toast.id)"
        >
          {{ toast.message }}
        </div>
      </transition-group>
    </div>
  </div>
</template>
