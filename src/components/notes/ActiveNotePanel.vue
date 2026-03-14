<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import TagPill from '../common/TagPill.vue'
import EditorCanvas from '../editor/EditorCanvas.vue'

type ChecklistItem = { id?: string; label: string; done: boolean }
type BlockItem = { id?: string; type: string; data: Record<string, unknown> }

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
  }>(),
  {
    editableTags: false,
    showActions: true,
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
  <div class="space-y-4 rounded-3xl border border-white/80 bg-white/90 p-5 shadow-card">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-gray-400">Note active</p>
        <h4 class="font-display text-xl text-ink">{{ props.note.title }}</h4>
        <p class="text-sm text-gray-500">{{ props.note.owner }}</p>
        <div class="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600">
          <span class="text-xs uppercase tracking-[0.3em] text-gray-400">Statut</span>
          <select
            v-model="localStatus"
            class="rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs text-gray-600 focus:border-royal focus:outline-none"
            @change="emitUpdate"
          >
            <option v-for="option in statusOptions" :key="option" :value="option">{{ option }}</option>
          </select>
        </div>
      </div>
      <div v-if="props.showActions" class="flex gap-2">
        <button type="button" class="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600" @click="emit('delete-note', props.note.id)">
          Supprimer
        </button>
        <button type="button" class="rounded-full bg-royal px-4 py-2 text-sm text-white" @click="emit('edit-note', props.note.id)">Éditer</button>
      </div>
    </div>

    <div v-if="!props.editableTags" class="flex flex-wrap gap-2">
      <TagPill v-for="tag in localTags" :key="tag" :label="tag" />
    </div>
    <div v-else class="space-y-3">
      <div class="flex flex-wrap gap-2">
        <span
          v-for="tag in localTags"
          :key="tag"
          class="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3 py-1 text-xs text-gray-600"
        >
          <span>{{ tag }}</span>
          <button type="button" class="text-gray-400 hover:text-rose-500" @click="removeTag(tag)">✕</button>
        </span>
        <span v-if="!localTags.length" class="text-xs text-gray-400">Aucun tag pour le moment.</span>
      </div>
      <form class="flex flex-wrap gap-2" @submit.prevent="addTag">
        <input
          v-model="newTag"
          type="text"
          placeholder="Ajouter un tag"
          class="flex-1 min-w-[160px] rounded-2xl border border-white/80 bg-white/80 px-3 py-2 text-xs text-gray-600 focus:border-royal focus:outline-none"
          @keydown.enter.prevent="addTag"
        />
        <button type="submit" class="rounded-2xl bg-royal px-4 py-2 text-xs font-medium text-white">+ Ajouter</button>
      </form>
    </div>

    <label class="block space-y-2 text-sm text-gray-600">
      <span class="text-xs uppercase tracking-[0.3em] text-gray-400">Résumé</span>
      <textarea
        v-model="localSummary"
        class="w-full rounded-2xl border border-white/70 bg-mist/60 p-3 text-sm text-gray-600 focus:border-royal focus:outline-none"
        rows="3"
        @blur="emitUpdate"
      ></textarea>
    </label>

    <div>
      <p class="text-xs uppercase tracking-[0.3em] text-gray-400">Checklist</p>
      <div class="mt-2 space-y-2">
        <label
          v-for="(task, index) in localChecklist"
          :key="task.id || task.label"
          class="flex items-center gap-2 text-sm text-gray-600"
        >
          <input
            type="checkbox"
            class="h-4 w-4 rounded-full border-gray-300"
            :checked="task.done"
            @change="toggleTask(index)"
          />
          {{ task.label }}
        </label>
        <p v-if="!localChecklist.length" class="text-xs text-gray-400">Aucune tâche pour le moment.</p>
      </div>
    </div>

    <div>
      <p class="text-xs uppercase tracking-[0.3em] text-gray-400">Focus</p>
      <ul class="mt-2 list-disc space-y-1 pl-4 text-sm text-gray-600">
        <li v-for="line in props.note.highlights" :key="line">{{ line }}</li>
      </ul>
    </div>

    <div>
      <div class="flex items-center justify-between">
        <p class="text-xs uppercase tracking-[0.3em] text-gray-400">Blocs (Editor.js)</p>
        <span class="text-xs text-gray-400">{{ localBlocks.length }} bloc(s)</span>
      </div>
      <div class="mt-3">
        <EditorCanvas v-model="localBlocks" />
      </div>
    </div>

    <div>
      <p class="text-xs uppercase tracking-[0.3em] text-gray-400">Chronologie</p>
      <ul class="mt-2 space-y-2 text-sm text-gray-600">
        <li v-for="item in props.timeline" :key="item.event" class="flex items-center gap-3">
          <span class="text-royal">{{ item.time }}</span>
          <span>{{ item.event }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
