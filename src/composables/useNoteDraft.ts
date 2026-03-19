import { ref, reactive, watch, onBeforeUnmount, nextTick } from 'vue'
import type { Block, NoteStatus, NotePriority, NoteUpdatePayload } from '../stores/useNotesStore'

export type TabId = 'collections' | 'attachments'

export interface DraftAttachment {
  id: string
  name: string
  size: number
  type: string
}

export interface NoteDraft {
  title: string
  summary: string
  status: NoteStatus
  priority: NotePriority
  collectionId: string | null
  tags: string[]
  reminderAt: string | null
  blocks: Block[]
  attachments: DraftAttachment[]
  relations: string[]
}

export function useNoteDraft(draftKey: string, defaultDraft: () => NoteDraft) {
  const draft = reactive<NoteDraft>(defaultDraft())
  const lastAutoSave = ref<number | null>(null)
  const isDirty = ref(false)
  const history = ref<{ timestamp: number; data: string }[]>([])
  const historyKey = `${draftKey}-history`
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

  function loadDraft() {
    if (typeof window === 'undefined') return
    const cached = localStorage.getItem(draftKey)
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        Object.assign(draft, { ...defaultDraft(), ...parsed, attachments: [] })
        lastAutoSave.value = Date.now()
      } catch (err) {
        console.warn('Failed to parse draft', err)
        Object.assign(draft, defaultDraft())
      }
    } else {
      Object.assign(draft, defaultDraft())
    }
    isDirty.value = false
    loadHistory()
  }

  function loadHistory() {
    const rawHistory = localStorage.getItem(historyKey)
    if (rawHistory) {
      try {
        history.value = JSON.parse(rawHistory)
      } catch {
        history.value = []
      }
    }
  }

  function saveToHistory() {
    const { attachments, ...rest } = draft
    const entry = {
      timestamp: Date.now(),
      data: JSON.stringify(rest),
    }
    // Keep last 10 versions
    const nextHistory = [entry, ...history.value].slice(0, 10)
    history.value = nextHistory
    localStorage.setItem(historyKey, JSON.stringify(nextHistory))
  }

  function restoreFromHistory(entry: { timestamp: number; data: string }) {
    try {
      const parsed = JSON.parse(entry.data)
      Object.assign(draft, parsed)
      isDirty.value = true
      persistDraft()
    } catch (err) {
      console.error('Failed to restore history', err)
    }
  }

  function persistDraft() {
    if (typeof window === 'undefined') return
    const { attachments, ...rest } = draft
    localStorage.setItem(draftKey, JSON.stringify(rest))
    lastAutoSave.value = Date.now()
    isDirty.value = false
    saveToHistory()
    console.log('Draft auto-saved at', new Date(lastAutoSave.value).toLocaleTimeString())
  }

  function clearDraft() {
    Object.assign(draft, defaultDraft())
    if (typeof window !== 'undefined') {
      localStorage.removeItem(draftKey)
      localStorage.removeItem(historyKey)
    }
    lastAutoSave.value = null
    isDirty.value = false
    history.value = []
  }

  // Debounced auto-save logic
  watch(
    draft,
    () => {
      isDirty.value = true
      if (autoSaveTimer) clearTimeout(autoSaveTimer)
      autoSaveTimer = setTimeout(() => {
        if (isDirty.value) {
          persistDraft()
        }
      }, 3000) // 3 seconds debounce
    },
    { deep: true }
  )

  onBeforeUnmount(() => {
    if (autoSaveTimer) clearTimeout(autoSaveTimer)
    if (isDirty.value) {
      persistDraft()
    }
  })

  function buildPayload(statusOverride?: NoteStatus): NoteUpdatePayload {
    return {
      title: draft.title.trim(),
      summary: draft.summary.trim(),
      status: statusOverride || draft.status,
      priority: draft.priority,
      tags: draft.tags,
      blocks: draft.blocks,
      collectionId: draft.collectionId,
      reminderAt: draft.reminderAt ? Date.parse(draft.reminderAt) : null,
      linkedEntities: draft.relations,
    }
  }

  return {
    draft,
    lastAutoSave,
    isDirty,
    history,
    loadDraft,
    persistDraft,
    clearDraft,
    buildPayload,
    restoreFromHistory,
  }
}
