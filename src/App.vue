<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import DesktopWorkspace from './components/layout/DesktopWorkspace.vue'
import { useNotesStore } from './stores/useNotesStore'
import type { Task, NoteUpdatePayload } from './stores/useNotesStore'
import NotesList from './components/notes/NotesList.vue'
import { useFeedback } from './composables/useFeedback'
import ActiveNotePanel from './components/notes/ActiveNotePanel.vue'

const baseNav = [
  { label: 'Tableau de bord', icon: '🏠' },
  { label: 'Notes', icon: '🗒️' },
  { label: 'Paramètres', icon: '⚙️' },
]

const store = useNotesStore()
const showAllNotes = ref(false)
const showEditorModal = ref(false)
const pendingDeleteId = ref<string | null>(null)
const activeNav = ref('Tableau de bord')
const lastSyncAt = ref<number | null>(null)
const { toasts, logs, showToast, dismissToast, pushLog } = useFeedback()
const initialSyncCompleted = ref(false)
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
const lastSyncedPayload = new Map<string, string>()

onMounted(async () => {
  try {
    await store.refresh()
    lastSyncAt.value = Date.now()
  } finally {
    initialSyncCompleted.value = true
  }
})

watch(
  () => store.activeNote.value,
  (note) => {
    if (!note) {
      showEditorModal.value = false
      return
    }
    lastSyncedPayload.set(note.id, serializeSyncPayload(normalizeSyncPayload(note)))
  },
  { immediate: true, deep: true },
)

const recentLogs = computed(() => logs.value.slice(0, 6))
const isBackgroundSyncing = computed(() => initialSyncCompleted.value && store.loading.value)

watch(
  () => store.error.value,
  (message) => {
    if (message) {
      showToast(message, 'error')
      pushLog('error', message)
    }
  },
)

watch(
  () => store.loading.value,
  (isLoading) => {
    if (!isLoading) {
      lastSyncAt.value = Date.now()
    }
  },
)

const currentNoteId = computed(() => store.activeNote.value?.id ?? store.notes.value[0]?.id ?? null)

const desktopNav = computed(() => baseNav.map((item) => ({ ...item, active: item.label === activeNav.value })))

const boardStats = computed(() => {
  const notes = store.notes.value
  const noteCount = notes.length
  const reviewCount = notes.filter((note) => note.status?.toLowerCase().includes('rev')).length
  const blocks = notes.reduce((sum, note) => sum + (note.blocks?.length || 0), 0)
  return [
    { title: 'Notes actives', value: noteCount, detail: `+${Math.max(1, noteCount)} cette semaine` },
    { title: 'Revues à faire', value: reviewCount, detail: `${Math.max(1, reviewCount)} urgentes` },
    { title: 'Blocs créés', value: blocks, detail: `+${Math.max(1, blocks)} vs hier` },
  ]
})

const workspaceNotes = computed(() => {
  return store.notes.value.map((note) => ({
    id: note.id,
    title: note.title || 'Sans titre',
    category: (note.tags?.[0] || 'Général').toUpperCase(),
    excerpt: note.summary || 'Aucun résumé pour le moment.',
    status: note.status || 'Brouillon',
    updated: formatRelativeTime(note.updatedAt),
  }))
})

const activeDesktopNote = computed(() => {
  const note = store.activeNote.value || store.notes.value[0]
  if (!note) {
    return {
      id: 'placeholder',
      title: 'Aucune note active',
      owner: 'Studio Produit',
      tags: ['Produit'],
      summary: 'Créez votre première note pour remplir ce panneau.',
      checklist: [],
      highlights: ['Ajoutez des blocs pour enrichir la note.'],
      blocks: [],
    }
  }
  return {
    id: note.id,
    title: note.title || 'Sans titre',
    owner: note.status ? `Statut : ${note.status}` : 'Sans statut',
    tags: note.tags?.length ? note.tags : ['Produit'],
    summary: note.summary || 'Aucun résumé',
    checklist: (note.tasks || []).map((task) => ({ id: task.id, label: task.label, done: task.done })),
    highlights: note.blocks?.length
      ? note.blocks.map((block) => `Bloc ${block.type || block.kind}`)
      : ['Ajoutez des blocs pour enrichir la note.'],
    blocks: note.blocks || [],
  }
})

const timeline = computed(() => {
  const note = store.activeNote.value || store.notes.value[0]
  if (!note) return []
  const items = (note.tasks || []).map((task) => ({
    time: task.done ? '✓' : '…',
    event: task.label,
  }))
  if (!items.length) {
    items.push({ time: '⏱', event: 'Aucune tâche pour le moment.' })
  }
  return items
})

async function handleSelectNote(id: string) {
  await store.setActiveNote(id)
  showAllNotes.value = false
  const note = store.notes.value.find((item) => item.id === id)
  pushLog('info', `Note ouverte : ${note?.title || 'Sans titre'}`)
}

function handleNavSelect(label: string) {
  activeNav.value = label
  pushLog('info', `Section ${label} ouverte`)
}

async function handleCreateNote() {
  await store.createNote()
  showAllNotes.value = false
  openEditorModal()
}

function handleViewAll() {
  showAllNotes.value = true
  pushLog('info', 'Vue “Toutes les notes” ouverte')
}

async function openEditorModal(noteId?: string) {
  const targetId = noteId || currentNoteId.value
  if (!targetId) return
  if (noteId && noteId !== currentNoteId.value) {
    await store.setActiveNote(noteId)
  }
  showEditorModal.value = true
}

function closeEditorModal() {
  showEditorModal.value = false
}

function handleModalSave() {
  if (!currentNoteId.value) return
  closeEditorModal()
  showToast('Note sauvegardée', 'success')
  pushLog('success', 'Note sauvegardée via modale')
}

async function handleUpdateActiveNote(payload: {
  status?: string
  summary?: string
  tasks?: Task[]
  blocks?: { id?: string; type: string; data: Record<string, unknown> }[]
  tags?: string[]
}) {
  const noteId = currentNoteId.value
  if (!noteId) return
  const normalized = normalizeSyncPayload(payload)
  const serialized = serializeSyncPayload(normalized)
  if (lastSyncedPayload.get(noteId) === serialized) return
  lastSyncedPayload.set(noteId, serialized)
  try {
    await store.updateNote(noteId, normalized)
  } catch (err) {
    console.error('Failed to sync note', err)
    showToast("Échec de la synchronisation de la note", 'error')
    pushLog('error', 'Synchronisation de note impossible')
  }
}

async function handleDuplicate(noteId: string) {
  await store.duplicateNote(noteId)
  showToast('Note dupliquée', 'info')
  pushLog('success', 'Note dupliquée')
}

async function handleDuplicateActiveNote() {
  const noteId = currentNoteId.value
  if (!noteId) return
  await store.duplicateNote(noteId)
  showToast('Note dupliquée', 'info')
  pushLog('success', 'Note dupliquée')
  openEditorModal()
}

async function handleDelete(noteId: string) {
  try {
    await store.deleteNote(noteId)
    showToast('Note supprimée', 'success')
    pushLog('success', 'Note supprimée')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Impossible de supprimer la note'
    showToast(message, 'error')
    pushLog('error', message)
    throw err
  }
}

async function handleDeleteActiveNote(noteId?: string) {
  const targetId = noteId || currentNoteId.value
  if (!targetId) return
  await handleDelete(targetId)
  if (showEditorModal.value) {
    closeEditorModal()
  }
}

function promptDeleteNote(noteId?: string) {
  const targetId = noteId || currentNoteId.value
  if (!targetId) return
  pendingDeleteId.value = targetId
}

function cancelPendingDelete() {
  pendingDeleteId.value = null
}

async function confirmPendingDelete() {
  if (!pendingDeleteId.value) return
  await handleDeleteActiveNote(pendingDeleteId.value)
  pendingDeleteId.value = null
}

async function handleShare() {
  const note = store.activeNote.value
  if (!note) {
    showToast('Aucune note active à partager', 'info')
    pushLog('info', 'Tentative de partage sans note active')
    return
  }

  const content = `# ${note.title || 'Sans titre'}\n\n${note.summary || 'Résumé en attente.'}\n\n---\nStatut : ${note.status || 'Brouillon'}\nDernière mise à jour : ${new Date(note.updatedAt).toLocaleString()}\n\n## Checklist\n${
    (note.tasks || []).length ? note.tasks.map((task) => `- [${task.done ? 'x' : ' '}] ${task.label}`).join('\n') : '- Aucune tâche'
  }`

  if (navigator.share) {
    try {
      await navigator.share({
        title: note.title || 'Note',
        text: content,
      })
      showToast('Note partagée via Web Share', 'success')
      pushLog('success', 'Note partagée via Web Share')
      return
    } catch {
      // fallback below
    }
  }

  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(content)
      showToast('Contenu copié dans le presse-papiers', 'success')
      pushLog('success', 'Note copiée dans le presse-papiers')
      return
    } catch {
      // fallback to download
    }
  }

  downloadTextFile(content, `${note.title || 'note'}.md`)
  showToast('Fichier markdown téléchargé', 'info')
  pushLog('info', 'Export markdown téléchargé')
}

function downloadTextFile(text: string, filename: string) {
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function formatRelativeTime(timestamp?: number) {
  if (!timestamp) return '—'
  const diff = Date.now() - timestamp
  const minutes = Math.round(diff / 60000)
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.round(hours / 24)
  return `il y a ${days} j`
}

function formatLogTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function normalizeSyncPayload(payload: {
  status?: string
  summary?: string
  tasks?: Task[]
  blocks?: { id?: string; type?: string; data?: Record<string, unknown> }[]
  tags?: string[]
}) {
  return {
    status: payload.status ?? store.activeNote.value?.status ?? 'Brouillon',
    summary: payload.summary ?? '',
    tasks: (payload.tasks || []).map((task, index) => ({
      id: task.id || `task-${index}`,
      label: task.label ?? '',
      done: !!task.done,
    })),
    blocks: (payload.blocks || []).map((block, index) => ({
      id: block.id || `block-${index}`,
      type: block.type || 'text',
      data: normalizeBlockData(block.data),
    })),
    tags: Array.isArray(payload.tags)
      ? payload.tags
      : store.activeNote.value?.tags?.length
        ? store.activeNote.value.tags
        : ['Général'],
  }
}

function normalizeBlockData(data?: Record<string, unknown>) {
  if (!data) return {}
  try {
    return JSON.parse(JSON.stringify(data))
  } catch {
    return {}
  }
}

function serializeSyncPayload(payload: {
  status: string
  summary: string
  tasks: Task[]
  blocks: { id?: string; type: string; data: Record<string, unknown> }[]
  tags: string[]
}) {
  return JSON.stringify(payload)
}

 </script>

<template>
  <div class="min-h-screen bg-[#f2efff] text-ink">
    <div class="mx-auto max-w-[1200px] py-10 px-6">
      <DesktopWorkspace
        :nav-items="desktopNav"
        :stats="boardStats"
        :notes="workspaceNotes"
        :active-note="activeDesktopNote"
        :timeline="timeline"
        :mode="activeNav === 'Paramètres' ? 'settings' : 'workspace'"
        :quick-flow="quickFlow"
        @create-note="handleCreateNote"
        @share="handleShare"
        @view-all="handleViewAll"
        @select-note="handleSelectNote"
        @update-active-note="handleUpdateActiveNote"
        @edit-note="openEditorModal"
        @delete-note="promptDeleteNote"
        @select-nav="handleNavSelect"
      />
    </div>

    <transition name="fade">
      <div v-if="!initialSyncCompleted" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div class="flex items-center gap-3 rounded-2xl bg-white/90 px-6 py-4 text-sm text-gray-600 shadow-2xl">
          <span class="h-4 w-4 animate-spin rounded-full border-2 border-royal border-t-transparent"></span>
          Initialisation des notes…
        </div>
      </div>
    </transition>

    <transition name="fade">
      <div
        v-if="showEditorModal"
        class="fixed inset-0 z-[65] flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-10"
      >
        <div class="relative w-full max-w-4xl rounded-[32px] bg-white/95 p-6 shadow-2xl" style="max-height: 90vh; overflow-y: auto;">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="font-display text-2xl text-ink">Édition de la note</h2>
              <p class="text-sm text-gray-500">Toutes les modifications sont synchronisées automatiquement.</p>
            </div>
            <button class="text-sm text-gray-500" @click="closeEditorModal">Fermer ✕</button>
          </div>
          <div class="mt-6 space-y-4">
            <ActiveNotePanel
              v-if="store.activeNote.value"
              :note="activeDesktopNote"
              :timeline="timeline"
              :editable-tags="true"
              :show-actions="false"
              @update-note="handleUpdateActiveNote"
            />
            <div class="flex flex-wrap justify-end gap-2">
              <button
                class="rounded-2xl border border-white/70 bg-white/80 px-5 py-2 text-sm text-gray-600"
                @click="handleDuplicateActiveNote"
              >
                Dupliquer
              </button>
              <button
                class="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-2 text-sm text-rose-600"
                @click="promptDeleteNote()"
              >
                Supprimer
              </button>
              <button class="rounded-2xl bg-royal px-5 py-2 text-sm font-medium text-white" @click="handleModalSave">
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <transition name="fade">
      <div
        v-if="initialSyncCompleted && isBackgroundSyncing"
        class="fixed right-6 bottom-6 z-[55] flex items-center gap-3 rounded-full bg-white/90 px-4 py-2 text-sm text-gray-600 shadow-xl"
      >
        <span class="h-3 w-3 animate-spin rounded-full border border-royal border-t-transparent"></span>
        Synchronisation des notes…
      </div>
    </transition>

    <transition name="fade">
      <div
        v-if="pendingDeleteId"
        class="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4"
      >
        <div class="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl">
          <h3 class="font-display text-2xl text-ink">Supprimer la note ?</h3>
          <p class="mt-3 text-sm text-gray-600">Cette action est définitive. La note sera retirée de votre base.</p>
          <div class="mt-6 flex justify-end gap-3">
            <button class="rounded-2xl border border-white/70 px-4 py-2 text-sm text-gray-600" @click="cancelPendingDelete">Annuler</button>
            <button class="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-medium text-white" @click="confirmPendingDelete">Supprimer</button>
          </div>
        </div>
      </div>
    </transition>

    <transition name="fade">
      <div
        v-if="showAllNotes"
        class="fixed inset-0 z-40 flex items-start justify-center bg-black/40 px-4 py-10"
      >
        <div class="relative w-full max-w-3xl rounded-[32px] bg-white p-6 shadow-2xl">
          <div class="flex items-center justify-between">
            <h2 class="font-display text-2xl text-ink">Toutes les notes</h2>
            <button class="text-sm text-gray-500" @click="showAllNotes = false">Fermer ✕</button>
          </div>
          <div class="mt-6 max-h-[70vh] space-y-3 overflow-y-auto pr-2">
            <NotesList
              :notes="workspaceNotes"
              :active-id="currentNoteId"
              @select="handleSelectNote"
            />
          </div>
        </div>
      </div>
    </transition>

    <TransitionGroup name="toast" tag="div" class="fixed right-6 top-6 z-[70] space-y-3">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="[
          'flex items-center justify-between gap-4 rounded-2xl px-5 py-3 text-sm shadow-lg ring-1 ring-black/10',
          toastVariants[toast.type] || toastVariants.info,
        ]"
      >
        <span>{{ toast.message }}</span>
        <button class="text-xs text-white/80" @click="dismissToast(toast.id)">Fermer</button>
      </div>
    </TransitionGroup>
  </div>
</template>
