import type { OutputData } from '@editorjs/editorjs'
import type { Block } from '../stores/useNotesStore'

/**
 * Converts internal Block array to EditorJS OutputData format.
 */
export function translateToEditorData(blocks: Block[] = []): OutputData {
  return {
    time: Date.now(),
    blocks: blocks.map((block) => ({
      id: block.id,
      type: block.type === 'text' ? 'paragraph' : block.type,
      data: block.data || {},
    })),
  }
}

/**
 * Converts EditorJS OutputData to internal Block array format.
 */
export function translateFromEditorData(data: OutputData): Block[] {
  return (data.blocks || []).map((block) => ({
    id: block.id || (typeof crypto !== 'undefined' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
    type: block.type === 'paragraph' ? 'text' : block.type,
    data: block.data || {},
  }))
}

/**
 * Serializes block array for comparison or storage.
 */
export function serializeBlocks(blocks: Block[] = []): string {
  return JSON.stringify(blocks)
}
