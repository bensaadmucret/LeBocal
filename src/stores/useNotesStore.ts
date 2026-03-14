import { ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'

export interface Task {
  id: string
  label: string
  done: boolean
}

export interface Sections {
  problem: string
  standardization: string
  prioritization: string
  snippet: string
}

export interface Block {
  id: string
  type: string
  data: Record<string, unknown>
}

export interface Collection {
  id: string
  tag: string
  label: string
  accent: string
}

export interface CollectionInputPayload {
  tag: string
  label: string
  accent: string
}

export interface TemplateDefinition {
  id: string
  icon: string
  title: string
  description: string
  accent: string
  payload: NoteUpdatePayload
}

export interface TemplateInputPayload {
  icon: string
  title: string
  description: string
  accent: string
  payload: NoteUpdatePayload
}

export interface Note {
  id: string
  title: string
  summary: string
  status: string
  tags: string[]
  updatedAt: number
  tasks: Task[]
  sections: Sections
  blocks: Block[]
}

export interface AppData {
  notes: Note[]
  activeNoteId: string | null
  collections: Collection[]
  templates: TemplateDefinition[]
}

export interface NoteUpdatePayload {
  title?: string
  summary?: string
  status?: string
  tags?: string[]
  tasks?: Task[]
  sections?: Sections
  blocks?: Block[]
}

const appData = ref<AppData>({ notes: [], activeNoteId: null, collections: [], templates: [] })
const loading = ref(false)
const error = ref<string | null>(null)
const isTauri = typeof window !== 'undefined' && '__TAURI_IPC__' in window
const MOCK_STORAGE_KEY = 'le-bocal-mock'

export function useNotesStore() {
  const notes = computed(() => appData.value.notes)
  const activeNote = computed(() => {
    if (!appData.value.activeNoteId) return null
    return appData.value.notes.find((note) => note.id === appData.value.activeNoteId) ?? null
  })
  const collections = computed(() => appData.value.collections)
  const templates = computed(() => appData.value.templates)

  async function refresh() {
    loading.value = true
    error.value = null
    try {
      const data = await invokeOrMock<AppData>('get_app_data')
      appData.value = { ...data, notes: normalizeNotes(data.notes) }
    } catch (err) {
      error.value = formatError(err)
    } finally {
      loading.value = false
    }
  }

  async function createNote(payload?: NoteUpdatePayload) {
    await callAndHydrate('create_note', { payload })
  }

  async function updateNote(noteId: string, payload: NoteUpdatePayload) {
    await callAndHydrate('update_note', { note_id: noteId, noteId, payload })
  }

  async function deleteNote(noteId: string) {
    await callAndHydrate('delete_note', { note_id: noteId, noteId })
  }

  async function duplicateNote(noteId: string) {
    await callAndHydrate('duplicate_note', { note_id: noteId, noteId })
  }

  async function setActiveNote(noteId: string) {
    await callAndHydrate('set_active_note', { note_id: noteId, noteId })
  }

  async function createCollection(input: CollectionInputPayload) {
    await callAndHydrate('create_collection', { input })
  }

  async function updateCollection(collectionId: string, input: CollectionInputPayload) {
    await callAndHydrate('update_collection', { collection_id: collectionId, collectionId, input })
  }

  async function deleteCollection(collectionId: string) {
    await callAndHydrate('delete_collection', { collection_id: collectionId, collectionId })
  }

  async function createTemplate(input: TemplateInputPayload) {
    await callAndHydrate('create_template', { input })
  }

  async function updateTemplate(templateId: string, input: TemplateInputPayload) {
    await callAndHydrate('update_template', { template_id: templateId, templateId, input })
  }

  async function deleteTemplate(templateId: string) {
    await callAndHydrate('delete_template', { template_id: templateId, templateId })
  }

  async function callAndHydrate(command: string, args?: Record<string, unknown>) {
    loading.value = true
    error.value = null
    try {
      const data = await invokeOrMock<AppData>(command, args)
      appData.value = { ...data, notes: normalizeNotes(data.notes) }
    } catch (err) {
      error.value = formatError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    notes,
    activeNote,
    collections,
    templates,
    loading,
    error,
    refresh,
    createNote,
    updateNote,
    deleteNote,
    duplicateNote,
    setActiveNote,
    createCollection,
    updateCollection,
    deleteCollection,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  }
}

function normalizeNotes(notes: Note[]): Note[] {
  return notes.map((note) => ({
    ...note,
    updatedAt: typeof note.updatedAt === 'number' ? note.updatedAt : Number(note.updatedAt) || Date.now(),
    tags: Array.isArray(note.tags) ? note.tags : [],
    tasks: Array.isArray(note.tasks) ? note.tasks : [],
    blocks: Array.isArray(note.blocks) ? note.blocks : [],
  }))
}

function formatError(err: unknown): string {
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message
  return 'Une erreur est survenue'
}

async function invokeOrMock<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    return invoke<T>(command, args)
  }
  return mockInvoke<T>(command, args)
}

async function mockInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const data = getMockData()
  const { notes, activeNoteId, collections, templates } = data
  const write = (next: AppData) => {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(next))
    return normalizeMockData(next)
  }

  switch (command) {
    case 'get_app_data':
      return normalizeMockData(data) as T
    case 'create_note': {
      const payload = (args?.payload as NoteUpdatePayload) || {}
      const note = createDefaultNote(payload)
      const next: AppData = { notes: [note, ...notes], activeNoteId: note.id, collections, templates }
      return write(next) as T
    }
    case 'set_active_note': {
      const noteId = (args?.note_id ?? args?.noteId) as string
      const next: AppData = { notes, activeNoteId: noteId, collections, templates }
      return write(next) as T
    }
    case 'update_note': {
      const noteId = (args?.note_id ?? args?.noteId) as string
      const payload = (args?.payload as NoteUpdatePayload) || {}
      const nextNotes = notes.map((note) =>
        note.id === noteId
          ? {
              ...note,
              ...payload,
              tags: payload.tags ?? note.tags,
              tasks: payload.tasks ?? note.tasks,
              sections: payload.sections ?? note.sections,
              blocks: payload.blocks ?? note.blocks,
              updatedAt: Date.now(),
            }
          : note,
      )
      return write({ notes: nextNotes, activeNoteId, collections, templates }) as T
    }
    case 'duplicate_note': {
      const noteId = (args?.note_id ?? args?.noteId) as string
      const original = notes.find((note) => note.id === noteId)
      if (!original) return normalizeMockData(data) as T
      const duplicate = createDefaultNote({ ...original, title: `${original.title || 'Sans titre'} (copie)` })
      const next = { notes: [duplicate, ...notes], activeNoteId: duplicate.id, collections, templates }
      return write(next) as T
    }
    case 'delete_note': {
      const noteId = (args?.note_id ?? args?.noteId) as string
      const remaining = notes.filter((note) => note.id !== noteId)
      const nextActive = activeNoteId === noteId ? remaining[0]?.id ?? null : activeNoteId
      return write({ notes: remaining, activeNoteId: nextActive, collections, templates }) as T
    }
    case 'create_collection': {
      const input = (args?.input as CollectionInputPayload) || { tag: 'Nouvelle', label: 'Nouvelle', accent: 'bg-emerald-50 text-emerald-700' }
      const nextCollection = createMockCollection(input)
      return write({ notes, activeNoteId, collections: [nextCollection, ...collections], templates }) as T
    }
    case 'update_collection': {
      const collectionId = (args?.collection_id ?? args?.collectionId) as string
      const input = (args?.input as CollectionInputPayload) || { tag: '', label: '', accent: '' }
      const nextCollections = collections.map((col) => (col.id === collectionId ? { ...col, ...input } : col))
      return write({ notes, activeNoteId, collections: nextCollections, templates }) as T
    }
    case 'delete_collection': {
      const collectionId = (args?.collection_id ?? args?.collectionId) as string
      const nextCollections = collections.filter((col) => col.id !== collectionId)
      return write({ notes, activeNoteId, collections: nextCollections, templates }) as T
    }
    case 'create_template': {
      const input = (args?.input as TemplateInputPayload) || defaultTemplateInput()
      const template = createMockTemplate(input)
      return write({ notes, activeNoteId, collections, templates: [template, ...templates] }) as T
    }
    case 'update_template': {
      const templateId = (args?.template_id ?? args?.templateId) as string
      const input = (args?.input as TemplateInputPayload) || defaultTemplateInput()
      const nextTemplates = templates.map((tpl) => (tpl.id === templateId ? { ...tpl, ...input } : tpl))
      return write({ notes, activeNoteId, collections, templates: nextTemplates }) as T
    }
    case 'delete_template': {
      const templateId = (args?.template_id ?? args?.templateId) as string
      const nextTemplates = templates.filter((tpl) => tpl.id !== templateId)
      return write({ notes, activeNoteId, collections, templates: nextTemplates }) as T
    }
    default:
      throw new Error(`Commande ${command} indisponible hors Tauri`)
  }
}

function getMockData(): AppData {
  const raw = localStorage.getItem(MOCK_STORAGE_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      return ensureMockDefaults(parsed)
    } catch {
      return ensureMockDefaults({})
    }
  }
  const initial = ensureMockDefaults({})
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(initial))
  return initial
}

function ensureMockDefaults(data: Partial<AppData>): AppData {
  const notes = Array.isArray(data.notes) && data.notes.length ? data.notes : [createDefaultNote()]
  const activeId = data.activeNoteId ?? notes[0]?.id ?? null
  const collections = Array.isArray(data.collections) && data.collections.length ? data.collections : defaultCollections()
  const templates = Array.isArray(data.templates) && data.templates.length ? data.templates : defaultTemplates()
  return { notes, activeNoteId: activeId, collections, templates }
}

function normalizeMockData(data: AppData): AppData {
  return {
    notes: normalizeNotes(data.notes),
    activeNoteId: data.activeNoteId,
    collections: Array.isArray(data.collections) ? data.collections : [],
    templates: Array.isArray(data.templates) ? data.templates : [],
  }
}

function createDefaultNote(partial: NoteUpdatePayload = {}): Note {
  const uuid = self.crypto?.randomUUID ? self.crypto.randomUUID() : `${Date.now()}-${Math.random()}`
  return {
    id: uuid,
    title: partial.title || 'Nouvelle note',
    summary: partial.summary || 'Résumé en attente.',
    status: partial.status || 'Brouillon',
    tags: partial.tags || ['Général'],
    updatedAt: Date.now(),
    tasks: partial.tasks || [],
    sections:
      partial.sections || ({ problem: '', prioritization: '', standardization: '', snippet: '' } as Sections),
    blocks: partial.blocks || [],
  }
}

function createMockCollection(input: CollectionInputPayload): Collection {
  const id = self.crypto?.randomUUID ? self.crypto.randomUUID() : `${Date.now()}-${Math.random()}`
  return {
    id,
    tag: input.tag || 'Nouvelle',
    label: input.label || input.tag || 'Nouvelle',
    accent: input.accent || 'bg-emerald-50 text-emerald-700',
  }
}

function createMockTemplate(input: TemplateInputPayload): TemplateDefinition {
  const id = self.crypto?.randomUUID ? self.crypto.randomUUID() : `${Date.now()}-${Math.random()}`
  return {
    id,
    icon: input.icon || '🧩',
    title: input.title || 'Template personnalisé',
    description: input.description || 'Template enregistré via le mode Mock.',
    accent: input.accent || 'bg-ink text-white',
    payload: input.payload || defaultTemplatePayload(),
  }
}

function defaultCollections(): Collection[] {
  return [
    { id: self.crypto?.randomUUID ? self.crypto.randomUUID() : 'col-1', tag: 'Général', label: 'Général', accent: 'bg-emerald-50 text-emerald-700' },
    { id: self.crypto?.randomUUID ? self.crypto.randomUUID() : 'col-2', tag: 'Produit', label: 'Produit', accent: 'bg-rose-50 text-rose-600' },
  ]
}

function defaultTemplatePayload(): NoteUpdatePayload {
  return {
    title: 'Brief quotidien',
    summary: 'Etat des lieux rapide de la journée.',
    status: 'Brouillon',
    tags: ['Daily'],
    tasks: [],
    sections: { problem: '', prioritization: '', standardization: '', snippet: '' },
    blocks: [
      { id: self.crypto?.randomUUID ? self.crypto.randomUUID() : 'block-1', type: 'header', data: { text: 'Objectifs du jour' } },
      { id: self.crypto?.randomUUID ? self.crypto.randomUUID() : 'block-2', type: 'text', data: { text: '• ...' } },
    ],
  }
}

function defaultTemplateInput(): TemplateInputPayload {
  return {
    icon: '🧩',
    title: 'Template personnalisé',
    description: 'Définissez vos propres modèles dans le mode Mock.',
    accent: 'bg-ink text-white',
    payload: defaultTemplatePayload(),
  }
}

function defaultTemplates(): TemplateDefinition[] {
  return [createMockTemplate(defaultTemplateInput())]
}
