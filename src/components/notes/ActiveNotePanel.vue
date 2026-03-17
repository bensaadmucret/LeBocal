<script setup lang="ts">
import { nextTick, ref, watch, onMounted, onBeforeUnmount, type ComponentPublicInstance } from 'vue'
import TagPill from '../common/TagPill.vue'
import EditorCanvas from '../editor/EditorCanvas.vue'
import { useEditorBridge } from '../../composables/useEditorBridge'
import type { Block } from '../../stores/useNotesStore'

type ChecklistItem = { id?: string; label: string; done: boolean }
type BlockItem = Block

const props = withDefaults(
  defineProps<{
    note: {
      id: string
      title: string
      owner: string
      status: string
      tags: string[]
      summary: string
      checklist: ChecklistItem[]
      highlights: string[]
      blocks: BlockItem[]
    }
    timeline: { time: string; event: string }[]
    editableTags?: boolean
    showActions?: boolean
    budgetTransactions?: {
      id: string
      label: string
      amount: number
      type: string
      date: string
      accountName?: string
      categoryName?: string
      currency?: string
    }[]
  }>(),
  {
    editableTags: false,
    showActions: true,
    budgetTransactions: () => [],
  },
)

const emit = defineEmits<{
  (event: 'update-note', payload: { status: string; summary: string; tasks: ChecklistItem[]; blocks: BlockItem[]; tags: string[] }): void
  (event: 'edit-note', noteId?: string): void
  (event: 'delete-note', noteId?: string): void
}>()

const statusOptions = ['Brouillon', 'En cours', 'Revue', 'Archivé']

const localSummary = ref('')
const localChecklist = ref<ChecklistItem[]>([])
const localBlocks = ref<BlockItem[]>([])
const localStatus = ref('Brouillon')
const localTags = ref<string[]>([])
const newTag = ref('')
const syncing = ref(false)
const showTransactions = ref(false)
const showTimeline = ref(false)
const isEditing = ref(false)
type EditorCanvasInstance = ComponentPublicInstance & {
  insertTextBlock: (content: string) => Promise<void>
  insertChecklistBlock: () => Promise<void>
  insertCodeBlock: () => Promise<void>
}
const editorCanvas = ref<EditorCanvasInstance | null>(null)
const { registerEditor, unregisterEditor } = useEditorBridge()
const editorToken = Symbol('active-note-editor')

watch(
  () => props.note,
  (note) => {
    syncing.value = true
    localSummary.value = note.summary
    localChecklist.value = note.checklist.map((task) => ({ ...task }))
    localBlocks.value = note.blocks?.map((block) => ({ ...block, data: { ...block.data } })) || []
    localStatus.value = note.status || 'Brouillon'
    localTags.value = Array.isArray(note.tags) ? [...note.tags] : []
    nextTick(() => {
      syncing.value = false
    })
  },
  { deep: true, immediate: true },
)

watch(
  () => localBlocks.value,
  () => {
    if (syncing.value) return
    emitUpdate()
  },
  { deep: true },
)

function syncEditorBridge() {
  const instance = editorCanvas.value
  if (!instance) {
    unregisterEditor(editorToken)
    return
  }
  registerEditor(editorToken, {
    insertTextBlock: (content = 'Nouveau paragraphe') => instance.insertTextBlock(content),
    insertChecklistBlock: () => instance.insertChecklistBlock(),
    insertCodeBlock: () => instance.insertCodeBlock(),
  })
}

watch(editorCanvas, () => {
  nextTick(() => syncEditorBridge())
})

watch(
  () => props.note.id,
  () => {
    nextTick(() => syncEditorBridge())
  },
)

onMounted(() => {
  nextTick(() => syncEditorBridge())
})

onBeforeUnmount(() => {
  unregisterEditor(editorToken)
})

function toggleTask(index: number) {
  localChecklist.value = localChecklist.value.map((task, idx) =>
    idx === index ? { ...task, done: !task.done } : task,
  )
  emitUpdate()
}

function emitUpdate() {
  emit('update-note', {
    status: localStatus.value,
    summary: localSummary.value,
    tasks: localChecklist.value,
    blocks: localBlocks.value,
    tags: localTags.value,
  })
}

function addTag() {
  const value = newTag.value.trim()
  if (!value) return
  if (!localTags.value.includes(value)) {
    localTags.value = [...localTags.value, value]
    emitUpdate()
  }
  newTag.value = ''
}

function removeTag(tag: string) {
  localTags.value = localTags.value.filter((current) => current !== tag)
  emitUpdate()
}
</script>

<template>
  <div class="rounded-[32px] bg-[var(--surface-card)] p-6 shadow-xl animate-fade-in flex flex-col gap-6 ring-1 ring-black/5 dark:ring-white/5">
    <!-- Header (Mockup Style) -->
    <div class="flex items-start justify-between">
      <div class="space-y-1">
        <p class="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">Note active</p>
        <h3 class="text-2xl font-semibold text-[var(--text-main)] leading-tight">{{ props.note.title }}</h3>
        <p v-if="!isEditing" class="text-sm text-[var(--text-muted)]">{{ localSummary }}</p>
        <div v-else class="flex items-center gap-2 text-[10px] text-[var(--text-muted)] font-bold">
          <span>STATUT</span>
          <select
            v-model="localStatus"
            class="bg-transparent text-royal dark:text-lavender focus:outline-none cursor-pointer"
            @change="emitUpdate"
          >
            <option v-for="option in statusOptions" :key="option" :value="option">{{ option }}</option>
          </select>
        </div>
      </div>
      <div class="flex gap-2">
        <button 
          v-if="isEditing"
          type="button" 
          class="tap-effect rounded-2xl border border-rose-100 bg-rose-50 p-2 text-rose-500 hover:bg-rose-100 transition-colors" 
          @click="emit('delete-note', props.note.id)"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
        <button 
          type="button" 
          class="tap-effect rounded-2xl px-6 py-2.5 text-sm font-semibold transition-all shadow-lg"
          :class="isEditing ? 'bg-royal text-white shadow-royal/20' : 'bg-indigo-600 text-white shadow-indigo-600/20'"
          @click="isEditing = !isEditing"
        >
          {{ isEditing ? 'Enregistrer' : 'Éditer' }}
        </button>
      </div>
    </div>

    <!-- Content (Conditional between Mockup and Advanced Editor) -->
    <div v-if="!isEditing" class="space-y-6">
      <!-- Mockup Checklist -->
      <ul v-if="localChecklist.length" class="list-disc space-y-2 pl-6 text-sm text-slate-600 dark:text-slate-400">
        <li v-for="task in localChecklist" :key="task.id || task.label" :class="{ 'opacity-50 line-through': task.done }">
          {{ task.label }}
        </li>
      </ul>

      <!-- Subtle Editor Content Preview -->
      <div v-if="localBlocks.length" class="border-t border-slate-50 pt-4">
        <div class="flex items-center justify-between mb-3">
           <span class="text-[10px] uppercase tracking-[0.3em] text-slate-400 font-bold">Contenu étendu</span>
           <span class="text-[10px] text-slate-300 font-bold">{{ localBlocks.length }} BLOCS</span>
        </div>
        <div class="max-h-60 overflow-y-auto custom-scrollbar opacity-80 pointer-events-none grayscale-[0.2]">
           <EditorCanvas :model-value="localBlocks" />
        </div>
      </div>
    </div>

    <!-- Advanced Editor (Visible when isEditing is true) -->
    <div v-else class="space-y-6 overflow-y-auto max-h-[60vh] pr-2 custom-scrollbar animate-fade-in">

      <div v-if="localSummary || props.editableTags" class="space-y-3">
        <div v-if="localTags.length || props.editableTags">
          <p class="mb-2 text-[10px] uppercase tracking-[0.3em] text-gray-400 dark:text-slate-500 font-bold">Tags</p>
          <div v-if="!props.editableTags" class="flex flex-wrap gap-1.5">
            <TagPill v-for="tag in localTags" :key="tag" :label="tag" class="text-[10px] py-0.5 px-2 dark:bg-royal/20 dark:text-lavender dark:border-royal/30" />
          </div>
          <div v-else class="space-y-2">
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="tag in localTags"
                :key="tag"
                class="inline-flex items-center gap-1.5 rounded-full border border-white/80 dark:border-white/10 bg-white/80 dark:bg-deep/40 px-2 py-0.5 text-[10px] text-gray-600 dark:text-slate-300"
              >
                <span>{{ tag }}</span>
                <button type="button" class="text-gray-400 hover:text-rose-500" @click="removeTag(tag)">✕</button>
              </span>
            </div>
            <form class="flex gap-2" @submit.prevent="addTag">
              <input
                v-model="newTag"
                type="text"
                placeholder="Nouveau tag"
                class="flex-1 rounded-xl border border-white/80 bg-white/80 px-3 py-1.5 text-xs text-gray-600 focus:border-royal focus:outline-none"
                @keydown.enter.prevent="addTag"
              />
              <button type="submit" class="rounded-xl bg-royal/10 px-3 py-1.5 text-[10px] font-bold text-royal hover:bg-royal hover:text-white transition-colors">AJOUTER</button>
            </form>
          </div>
        </div>

        <div v-if="localSummary || props.editableTags">
          <span class="text-[10px] uppercase tracking-[0.3em] text-gray-400 dark:text-slate-500 font-bold">Résumé</span>
          <textarea
            v-model="localSummary"
            class="mt-1.5 w-full rounded-2xl border border-white/70 dark:border-white/10 bg-indigo-50/30 dark:bg-royal/5 p-3 text-xs leading-relaxed text-gray-600 dark:text-slate-300 focus:border-royal focus:outline-none transition-colors"
            :rows="localSummary.length > 100 ? 3 : 2"
            @blur="emitUpdate"
          ></textarea>
        </div>
      </div>

      <div v-if="localChecklist.length">
        <p class="text-[10px] uppercase tracking-[0.3em] text-gray-400 dark:text-slate-500 font-bold mb-2">Checklist</p>
        <div class="max-h-40 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
          <label
            v-for="(task, index) in localChecklist"
            :key="task.id || task.label"
            class="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer group"
          >
            <input
              type="checkbox"
              class="h-3.5 w-3.5 rounded-full border-gray-300 dark:border-slate-700 bg-transparent text-royal focus:ring-royal/20"
              :checked="task.done"
              @change="toggleTask(index)"
            />
            <span :class="{ 'line-through text-slate-400 dark:text-slate-600': task.done }">{{ task.label }}</span>
          </label>
        </div>
      </div>

      <div v-if="props.note.highlights?.length">
        <p class="text-[10px] uppercase tracking-[0.3em] text-gray-400 font-bold mb-2">Focus Highlights</p>
        <ul class="list-disc space-y-1 pl-4 text-xs text-slate-500 italic">
          <li v-for="line in props.note.highlights" :key="line">{{ line }}</li>
        </ul>
      </div>

      <div>
        <div class="flex items-center justify-between mb-2">
          <p class="text-[10px] uppercase tracking-[0.3em] text-gray-400 dark:text-slate-500 font-bold">Contenu (Editor.js)</p>
          <span class="text-[10px] font-bold text-royal dark:text-lavender bg-royal/10 dark:bg-royal/20 px-2 py-0.5 rounded-full">{{ localBlocks.length }} BLOCS</span>
        </div>
        <div class="max-h-[400px] overflow-y-auto rounded-2xl border border-indigo-50/50 dark:border-white/5 bg-white/40 dark:bg-deep/20 p-1 custom-scrollbar">
          <EditorCanvas ref="editorCanvas" v-model="localBlocks" />
        </div>
      </div>

      <!-- Collapsible Sections -->
      <div class="border-t border-slate-100 pt-3 space-y-3">
        <div v-if="props.budgetTransactions?.length">
          <button 
            @click="showTransactions = !showTransactions"
            class="flex w-full items-center justify-between text-[10px] uppercase tracking-[0.3em] text-gray-400 font-bold hover:text-royal transition-colors"
          >
            <span>Transactions liées</span>
            <span>{{ showTransactions ? '−' : '+' }}</span>
          </button>
          <ul v-if="showTransactions" class="mt-3 space-y-2 text-xs animate-fade-in">
            <li v-for="transaction in props.budgetTransactions" :key="transaction.id" class="rounded-xl border border-white bg-white/60 p-3 shadow-sm">
              <div class="flex items-center justify-between">
                <span class="font-semibold text-slate-800">{{ transaction.label }}</span>
                <span :class="transaction.type === 'expense' ? 'text-rose-500 font-bold' : 'text-emerald-500 font-bold'">
                  {{ transaction.type === 'expense' ? '-' : '+' }}
                  {{
                    new Intl.NumberFormat('fr-FR', {
                      style: 'currency',
                      currency: transaction.currency || 'EUR',
                    }).format(transaction.amount)
                  }}
                </span>
              </div>
              <div class="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                <span>{{ new Date(transaction.date).toLocaleDateString() }}</span>
                <span>•</span>
                <span>{{ transaction.accountName }}</span>
              </div>
            </li>
          </ul>
        </div>

        <div v-if="props.timeline?.length">
          <button 
            @click="showTimeline = !showTimeline"
            class="flex w-full items-center justify-between text-[10px] uppercase tracking-[0.3em] text-gray-400 font-bold hover:text-royal transition-colors"
          >
            <span>Chronologie</span>
            <span>{{ showTimeline ? '−' : '+' }}</span>
          </button>
          <ul v-if="showTimeline" class="mt-3 space-y-2 text-xs animate-fade-in pr-2">
            <li v-for="item in props.timeline" :key="item.event" class="flex items-start gap-3">
              <span class="text-royal font-bold tabular-nums min-w-[45px]">{{ item.time }}</span>
              <span class="text-slate-500">{{ item.event }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
