import { shallowRef } from 'vue'

export interface EditorActions {
  insertTextBlock: (content?: string) => Promise<void> | void
  insertChecklistBlock: () => Promise<void> | void
  insertCodeBlock: () => Promise<void> | void
}

interface EditorBridgeEntry {
  token: symbol | null
  actions: EditorActions | null
}

const activeEditorEntry = shallowRef<EditorBridgeEntry>({ token: null, actions: null })
const editorStack: EditorBridgeEntry[] = []

function updateActiveEntry() {
  const next = editorStack[editorStack.length - 1]
  activeEditorEntry.value = next ?? { token: null, actions: null }
}

export function useEditorBridge() {
  function registerEditor(token: symbol, actions: EditorActions | null) {
    const existingIndex = editorStack.findIndex((entry) => entry.token === token)
    if (existingIndex !== -1) {
      editorStack.splice(existingIndex, 1)
    }
    editorStack.push({ token, actions })
    updateActiveEntry()
  }

  function unregisterEditor(token: symbol) {
    const index = editorStack.findIndex((entry) => entry.token === token)
    if (index === -1) return
    editorStack.splice(index, 1)
    updateActiveEntry()
  }

  return {
    editorEntry: activeEditorEntry,
    registerEditor,
    unregisterEditor,
  }
}
