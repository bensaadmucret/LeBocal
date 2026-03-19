<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import EditorJS from '@editorjs/editorjs'
import Header from '@editorjs/header'
import List from '@editorjs/list'
import Checklist from '@editorjs/checklist'
import Code from '@editorjs/code'
import Image from '@editorjs/image'
import type { Block } from '../../stores/useNotesStore'
import { translateToEditorData, translateFromEditorData, serializeBlocks } from '../../utils/editor-mapper'

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
        await editor.render(translateToEditorData(blocks))
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
    data: translateToEditorData(props.modelValue),
    tools: {
      header: Header,
      list: List,
      checklist: Checklist,
      code: Code,
      image: {
        class: Image,
        config: {
          uploader: {
            async uploadByFile(file: File) {
              // Mock upload: convert to base64 for local preview
              return new Promise((resolve) => {
                const reader = new FileReader()
                reader.onload = (e) => {
                  resolve({
                    success: 1,
                    file: {
                      url: e.target?.result as string,
                    },
                  })
                }
                reader.readAsDataURL(file)
              })
            },
            async uploadByUrl(url: string) {
              return {
                success: 1,
                file: { url },
              }
            },
          },
        },
      },
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
      const blocks = translateFromEditorData(data)
      updatingFromEditor = true
      lastSerialized = serializeBlocks(blocks)
      emit('update:modelValue', blocks)
      updatingFromEditor = false
    },
  })
}

async function insertTextBlock(content = 'Nouveau paragraphe') {
  if (!editor || !content.trim()) return
  await editor.blocks.insert('paragraph', { text: content.trim() }, undefined, undefined, undefined, false)
}

async function insertChecklistBlock() {
  if (!editor) return
  await editor.blocks.insert(
    'checklist',
    { items: [{ text: 'Nouvelle tâche', checked: false }] },
    undefined,
    undefined,
    undefined,
    false,
  )
}

async function insertCodeBlock() {
  if (!editor) return
  await editor.blocks.insert('code', { code: '// Nouveau snippet' }, undefined, undefined, undefined, false)
}

async function saveBlocks(): Promise<Block[]> {
  if (!editor) return []
  const data = await editor.save()
  return translateFromEditorData(data)
}

defineExpose({
  insertTextBlock,
  insertChecklistBlock,
  insertCodeBlock,
  saveBlocks,
  isReady,
})
</script>

<template>
  <div :id="holderId" class="editor-canvas rounded-[32px] bg-white/40 backdrop-blur-sm shadow-sm"></div>
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
