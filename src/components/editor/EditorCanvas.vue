<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import EditorJS, { type OutputData } from '@editorjs/editorjs'
import Header from '@editorjs/header'
import List from '@editorjs/list'
import Checklist from '@editorjs/checklist'
import Code from '@editorjs/code'
import type { Block } from '../../stores/useNotesStore'

const props = defineProps<{ modelValue: Block[] }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: Block[]): void }>()

const holderId = `editor-${Math.random().toString(36).slice(2)}`
const isReady = ref(false)
let editor: EditorJS | null = null
let updatingFromEditor = false
let lastSerialized = serializeBlocks(props.modelValue)
let suppressNextChange = false

onMounted(async () => {
  await initEditor()
})

onBeforeUnmount(() => {
  editor?.destroy()
  editor = null
})

watch(
  () => props.modelValue,
  async (blocks) => {
    if (updatingFromEditor || !editor) return
    const serialized = serializeBlocks(blocks)
    if (serialized === lastSerialized) return
    lastSerialized = serialized
    suppressNextChange = true
    try {
      await editor.isReady
      if (typeof editor.render === 'function') {
        await editor.render(toEditorData(blocks))
      }
    } catch (err) {
      console.warn('Editor render skipped', err)
    }
  },
  { deep: true },
)

async function initEditor() {
  editor = new EditorJS({
    holder: holderId,
    minHeight: 0,
    data: toEditorData(props.modelValue),
    tools: {
      header: Header,
      list: List,
      checklist: Checklist,
      code: Code,
    },
    onReady: () => {
      isReady.value = true
    },
    onChange: async () => {
      if (!editor) return
      if (suppressNextChange) {
        suppressNextChange = false
        return
      }
      const data = await editor.save()
      const blocks = fromEditorData(data)
      updatingFromEditor = true
      lastSerialized = serializeBlocks(blocks)
      emit('update:modelValue', blocks)
      updatingFromEditor = false
    },
  })
}

function toEditorData(blocks: Block[] = []): OutputData {
  return {
    blocks: blocks.map((block) => ({
      id: block.id,
      type: block.type === 'text' ? 'paragraph' : block.type,
      data: block.data || {},
    })),
  }
}

function fromEditorData(data: OutputData): Block[] {
  return (data.blocks || []).map((block) => ({
    id: block.id || cryptoId(),
    type: block.type === 'paragraph' ? 'text' : block.type,
    data: block.data || {},
  }))
}

function serializeBlocks(blocks: Block[] = []) {
  return JSON.stringify(blocks)
}

function cryptoId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random()}`
}

async function insertTextBlock(content: string) {
  if (!editor || !content.trim()) return
  await editor.blocks.insert('paragraph', { text: content.trim() }, undefined, undefined, undefined, false)
}

async function saveBlocks(): Promise<Block[]> {
  if (!editor) return []
  const data = await editor.save()
  return fromEditorData(data)
}

defineExpose({
  insertTextBlock,
  saveBlocks,
  isReady,
})
</script>

<template>
  <div :id="holderId" class="editor-canvas rounded-2xl border border-white/70 bg-white/95"></div>
</template>

<style scoped>
.editor-canvas {
  min-height: 320px;
  padding: 1.5rem 1.25rem 2rem;
}
.editor-canvas :deep(.ce-block__content) {
  max-width: 100%;
}
.editor-canvas :deep(.ce-toolbar__content),
.editor-canvas :deep(.ce-settings__content) {
  max-width: 100%;
}
</style>
