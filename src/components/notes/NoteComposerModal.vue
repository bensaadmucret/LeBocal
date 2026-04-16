<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, watch, ref, reactive } from 'vue'
import EditorCanvas from '../editor/EditorCanvas.vue'
import AddTagControl from './AddTagControl.vue'
import type { NoteUpdatePayload } from '../../stores/useNotesStore'
import { useNoteDraft, type NoteDraft } from '../../composables/useNoteDraft'

const props = withDefaults(
  defineProps<{
    open: boolean
    savingMode?: 'save' | 'publish' | null
    clearTrigger?: number
    draftKey?: string
  }>(),
  { savingMode: null, clearTrigger: 0, draftKey: 'note-composer-draft-v4' },
)

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'save', payload: NoteUpdatePayload): void
  (event: 'publish', payload: NoteUpdatePayload): void
  (event: 'create-collection', payload: { label: string; tag: string; accent: string }): void
}>()

const defaultDraft = (): NoteDraft => ({
  title: '', summary: '', status: 'Brouillon', priority: 'Medium',
  collectionId: null, tags: [], reminderAt: null, blocks: [], attachments: [], relations: [],
})

const { draft, lastAutoSave, isDirty, loadDraft, clearDraft, buildPayload } = useNoteDraft(props.draftKey, defaultDraft)

const newTag = ref('')
const step = ref<'write' | 'details'>('write')

const autoSaveLabel = computed(() => {
  if (!lastAutoSave.value) return ''
  if (isDirty.value) return '●'
  const diff = Date.now() - lastAutoSave.value
  if (diff < 5000) return '✓ Enregistré'
  if (diff < 60_000) return `✓ il y a ${Math.round(diff / 1000)}s`
  return `✓ ${new Date(lastAutoSave.value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
})

watch(() => props.clearTrigger, () => { clearDraft(); newTag.value = ''; step.value = 'write' })
watch(() => props.open, (isOpen) => { if (isOpen) { loadDraft(); step.value = 'write' } }, { immediate: true })

function handleKeyDown(e: KeyboardEvent) {
  if (!props.open) return
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const mod = isMac ? e.metaKey : e.ctrlKey
  if (mod && e.key === 's') { e.preventDefault(); handleSave() }
  else if (mod && e.key === 'Enter') { e.preventDefault(); handlePublish() }
  else if (e.key === 'Escape') { emit('close') }
}

onMounted(() => window.addEventListener('keydown', handleKeyDown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeyDown))

const canSave = computed(() => !!draft.title.trim())

function handleAddTag() {
  const v = newTag.value.trim()
  if (!v) return
  if (!draft.tags.includes(v)) draft.tags = [...draft.tags, v]
  newTag.value = ''
}

function removeTag(tag: string) { draft.tags = draft.tags.filter(t => t !== tag) }

function handleSave() { if (!canSave.value || props.savingMode) return; emit('save', buildPayload('Brouillon')) }
function handlePublish() { if (!canSave.value || props.savingMode) return; emit('publish', buildPayload('Publié')) }
</script>

<template>
  <transition name="fade">
    <div v-if="open" class="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div class="w-full max-w-2xl rounded-[32px] bg-[var(--surface)] shadow-2xl border border-black/5 overflow-hidden flex flex-col" style="max-height: 88vh;">
        <!-- Header -->
        <div class="flex items-center justify-between px-8 pt-6 pb-2">
          <div>
            <h2 class="font-display text-xl font-semibold text-[var(--text-main)]">Nouvelle note</h2>
            <p class="text-xs text-[var(--text-muted)] mt-0.5">{{ autoSaveLabel }}</p>
          </div>
          <button class="h-9 w-9 flex items-center justify-center rounded-full hover:bg-black/5 transition text-[var(--text-muted)]" @click="emit('close')">✕</button>
        </div>

        <!-- Step: Write -->
        <div v-if="step === 'write'" class="flex-1 overflow-y-auto px-8 py-4 space-y-5">
          <input
            v-model="draft.title"
            class="w-full border-none bg-transparent text-2xl font-semibold text-[var(--text-main)] placeholder:text-[var(--text-muted)]/40 focus:outline-none"
            placeholder="Titre de la note"
            autofocus
          />

          <textarea
            v-model="draft.summary"
            rows="2"
            class="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)]/50 resize-none focus:outline-none focus:ring-2 focus:ring-sage/30"
            placeholder="Résumé rapide (optionnel)"
          />

          <div class="flex flex-wrap gap-2 items-center">
            <span v-for="tag in draft.tags" :key="tag" class="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-tag-bg)] text-[var(--color-tag-text)] px-3 py-1 text-xs font-medium">
              {{ tag }}
              <button class="hover:text-rose-500 transition" @click="removeTag(tag)">×</button>
            </span>
            <AddTagControl v-model="newTag" placeholder="+ Tag" @submit="handleAddTag" />
          </div>

          <div class="rounded-2xl border border-[var(--color-border)] bg-white/50 dark:bg-[var(--glass-bg)] p-4 min-h-[200px]">
            <EditorCanvas v-model="draft.blocks" />
          </div>
        </div>

        <!-- Step: Details (optional, for later expansion) -->
        <div v-if="step === 'details'" class="flex-1 overflow-y-auto px-8 py-4">
          <p class="text-sm text-[var(--text-muted)]">Détails supplémentaires à venir (collection, rappel, pièces jointes…)</p>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between px-8 py-4 border-t border-[var(--color-border)]">
          <div class="flex items-center gap-3">
            <button
              v-if="step === 'write'"
              class="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition flex items-center gap-1"
              @click="step = 'details'"
            >
              ⚙️ Options
            </button>
            <button
              v-else
              class="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition"
              @click="step = 'write'"
            >
              ← Retour
            </button>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="rounded-full border border-[var(--color-border)] px-5 py-2 text-sm font-medium text-[var(--text-main)] hover:bg-black/5 transition"
              :disabled="!canSave || savingMode === 'save'"
              @click="handleSave"
            >
              {{ savingMode === 'save' ? 'Enregistrement…' : 'Brouillon' }}
            </button>
            <button
              class="rounded-full bg-sage px-5 py-2 text-sm font-semibold text-anthracite shadow-lg shadow-sage/20 hover:scale-105 transition-transform"
              :disabled="!canSave || savingMode === 'publish'"
              @click="handlePublish"
            >
              {{ savingMode === 'publish' ? 'Publication…' : 'Publier' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>
