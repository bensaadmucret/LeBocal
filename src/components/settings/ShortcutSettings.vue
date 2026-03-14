<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useCommandShortcuts } from '../../composables/useCommandShortcuts'
import type { CommandId } from '../../composables/useCommandShortcuts'

const {
  commands,
  getShortcut,
  formatShortcutLabel,
  eventToShortcut,
  setShortcut,
  resetShortcut,
  resetAllShortcuts,
  hasCustomShortcut,
  findConflict,
  normalizeShortcut,
} = useCommandShortcuts()

const editingCommand = ref<CommandId | null>(null)
const capturePreview = ref<string | null>(null)
const conflictMessage = ref<string | null>(null)
const canUseWindow = typeof window !== 'undefined'

const hasCustomizations = computed(() => commands.some((cmd) => hasCustomShortcut(cmd.id)))

function startCapture(id: CommandId) {
  editingCommand.value = id
  capturePreview.value = null
  conflictMessage.value = null
}

function stopCapture() {
  editingCommand.value = null
  capturePreview.value = null
  conflictMessage.value = null
}

function handleCapture(event: KeyboardEvent) {
  if (!editingCommand.value) return
  event.preventDefault()
  event.stopPropagation()
  if (event.key === 'Escape') {
    stopCapture()
    return
  }
  const combo = eventToShortcut(event)
  capturePreview.value = combo
  const normalized = combo ? normalizeShortcut(combo) : null
  if (!normalized) return
  const conflict = findConflict(normalized, editingCommand.value)
  if (conflict) {
    conflictMessage.value = `Conflit avec « ${conflict.label} »`
    return
  }
  setShortcut(editingCommand.value, normalized)
  stopCapture()
}

watch(
  () => editingCommand.value,
  (value) => {
    if (!canUseWindow) return
    if (value) {
      window.addEventListener('keydown', handleCapture, true)
    } else {
      window.removeEventListener('keydown', handleCapture, true)
    }
  },
)

onBeforeUnmount(() => {
  if (canUseWindow) {
    window.removeEventListener('keydown', handleCapture, true)
  }
})

function currentShortcutLabel(id: CommandId) {
  const shortcut = getShortcut(id)
  if (!shortcut) return 'Aucun'
  return formatShortcutLabel(shortcut)
}

function previewLabel() {
  if (!capturePreview.value) return 'Appuyez sur la nouvelle combinaison…'
  const normalized = normalizeShortcut(capturePreview.value)
  if (!normalized) return 'Appuyez sur la nouvelle combinaison…'
  return `Nouvelle combinaison : ${formatShortcutLabel(normalized)}`
}

function handleReset(id: CommandId) {
  resetShortcut(id)
  if (editingCommand.value === id) {
    stopCapture()
  }
}

function handleResetAll() {
  resetAllShortcuts()
  stopCapture()
}
</script>

<template>
  <section class="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-card">
    <header class="flex flex-wrap items-center justify-between gap-3 border-b border-white/70 pb-4">
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-gray-400">Raccourcis clavier</p>
        <h2 class="mt-2 font-display text-2xl text-ink">Palette d’actions</h2>
        <p class="text-sm text-gray-500">Configurez les combinaisons qui exécutent immédiatement les actions de prise de notes.</p>
      </div>
      <button
        class="rounded-full border border-white/80 px-4 py-2 text-sm text-gray-600 disabled:opacity-40"
        :disabled="!hasCustomizations"
        @click="handleResetAll"
      >
        Réinitialiser tout
      </button>
    </header>

    <div class="mt-6 space-y-4">
      <article
        v-for="command in commands"
        :key="command.id"
        class="rounded-3xl border border-white/70 bg-white/80 p-4"
      >
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p class="font-medium text-ink">{{ command.label }}</p>
            <p class="text-sm text-gray-500">{{ command.description }}</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="min-w-[120px] rounded-full bg-mist px-4 py-2 text-center text-sm font-medium text-gray-700">
              {{ currentShortcutLabel(command.id) }}
            </span>
            <button
              class="rounded-full border border-royal/30 px-4 py-2 text-sm text-royal"
              @click="startCapture(command.id)"
            >
              Modifier
            </button>
            <button
              class="rounded-full border border-white/80 px-3 py-2 text-xs text-gray-500 disabled:opacity-40"
              :disabled="!hasCustomShortcut(command.id)"
              @click="handleReset(command.id)"
            >
              Réinitialiser
            </button>
          </div>
        </div>
        <p v-if="editingCommand === command.id" class="mt-3 rounded-2xl bg-lilac/30 px-3 py-2 text-sm text-royal">
          {{ previewLabel() }}
        </p>
        <p v-if="conflictMessage && editingCommand === command.id" class="mt-2 text-sm text-rose-500">
          {{ conflictMessage }}
        </p>
      </article>
    </div>
  </section>
</template>
