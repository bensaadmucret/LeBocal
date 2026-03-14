import { computed, ref, watch } from 'vue'

const STORAGE_KEY = 'le-bocal.shortcuts.v1'
const isBrowser = typeof window !== 'undefined'
const isMacPlatform = isBrowser && /mac|ipod|iphone|ipad/i.test(window.navigator.platform)

export const commandDefinitions = [
  {
    id: 'create-note',
    label: 'Créer une note',
    description: 'Ajoute une nouvelle note vide et ouvre l’éditeur.',
    category: 'Notes',
    defaultShortcut: 'Mod+Shift+N',
  },
  {
    id: 'duplicate-note',
    label: 'Dupliquer la note active',
    description: 'Clone la note affichée et ouvre la copie.',
    category: 'Notes',
    defaultShortcut: 'Mod+Shift+D',
  },
  {
    id: 'insert-text-block',
    label: 'Insérer un bloc texte',
    description: 'Ajoute immédiatement un bloc paragraphe dans Editor.js.',
    category: 'Blocs',
    defaultShortcut: 'Mod+Alt+T',
  },
  {
    id: 'insert-checklist-block',
    label: 'Insérer un bloc checklist',
    description: 'Ajoute une nouvelle checklist pour suivre vos tâches.',
    category: 'Blocs',
    defaultShortcut: 'Mod+Alt+L',
  },
  {
    id: 'insert-code-block',
    label: 'Insérer un bloc code',
    description: 'Insère un snippet de code prêt à être édité.',
    category: 'Blocs',
    defaultShortcut: 'Mod+Alt+C',
  },
] as const

export type CommandDefinition = (typeof commandDefinitions)[number]
export type CommandId = CommandDefinition['id']
export type ShortcutMap = Partial<Record<CommandId, string>>

const shortcutOverrides = ref<ShortcutMap>({})
let didLoad = false
let didWatch = false

function ensureLoaded() {
  if (didLoad) return
  if (!isBrowser) {
    didLoad = true
    return
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      shortcutOverrides.value = parsed || {}
    }
  } catch (err) {
    console.warn('Impossible de charger les raccourcis', err)
  } finally {
    didLoad = true
  }
}

function persistShortcuts() {
  if (!isBrowser) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcutOverrides.value))
  } catch (err) {
    console.warn('Impossible de sauvegarder les raccourcis', err)
  }
}

function normalizeKeyName(key: string) {
  if (!key) return ''
  if (key === ' ') return 'Space'
  if (key.length === 1) return key.toUpperCase()
  const lower = key.toLowerCase()
  switch (lower) {
    case 'escape':
      return 'Escape'
    case 'tab':
      return 'Tab'
    case 'enter':
      return 'Enter'
    case 'backspace':
      return 'Backspace'
    case 'delete':
      return 'Delete'
    case 'arrowup':
      return 'ArrowUp'
    case 'arrowdown':
      return 'ArrowDown'
    case 'arrowleft':
      return 'ArrowLeft'
    case 'arrowright':
      return 'ArrowRight'
    default:
      return key.length ? key[0].toUpperCase() + key.slice(1).toLowerCase() : ''
  }
}

function normalizeCode(code?: string) {
  if (!code) return ''
  if (code.startsWith('Key')) return code.slice(3).toUpperCase()
  if (code.startsWith('Digit')) return code.slice(5)
  return normalizeKeyName(code)
}

function translateModShortcut(raw: string) {
  return raw.replace(/Mod/gi, isMacPlatform ? 'Meta' : 'Ctrl')
}

function buildShortcutString(parts: string[]) {
  return parts.join('+')
}

function formatShortcutLabel(shortcut: string | null) {
  if (!shortcut) return '—'
  return shortcut
    .split('+')
    .map((chunk) => {
      switch (chunk) {
        case 'Meta':
          return '⌘'
        case 'Ctrl':
          return 'Ctrl'
        case 'Shift':
          return isMacPlatform ? '⇧' : 'Shift'
        case 'Alt':
        case 'Option':
          return isMacPlatform ? '⌥' : 'Alt'
        default:
          return chunk.length === 1 ? chunk.toUpperCase() : chunk
      }
    })
    .join(' ')
}

function normalizeShortcut(shortcut: string | null) {
  if (!shortcut) return null
  const parts = shortcut
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
  const modifiers = ['Meta', 'Ctrl', 'Alt', 'Shift']
  const orderedParts = modifiers.filter((mod) => parts.includes(mod))
  const key = parts.find((part) => !modifiers.includes(part))
  if (key) orderedParts.push(key)
  return buildShortcutString(orderedParts)
}

function eventToShortcut(event: KeyboardEvent) {
  let key = ''
  const codeKey = normalizeCode(event.code)
  if (codeKey && /^[A-Z0-9]$/.test(codeKey)) {
    key = codeKey
  } else {
    key = normalizeKeyName(event.key)
    if (!key || key === 'Dead') {
      key = codeKey
    }
  }
  if (!key || ['Shift', 'Meta', 'Control', 'Ctrl', 'Alt'].includes(key)) {
    return null
  }
  const parts: string[] = []
  if (event.metaKey) parts.push('Meta')
  if (event.ctrlKey) parts.push('Ctrl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  parts.push(key)
  return buildShortcutString(parts)
}

function getDefaultShortcut(id: CommandId) {
  const definition = commandDefinitions.find((def) => def.id === id)
  if (!definition) return null
  return normalizeShortcut(translateModShortcut(definition.defaultShortcut))
}

function getShortcut(id: CommandId) {
  const override = shortcutOverrides.value[id]
  if (override) return normalizeShortcut(override)!
  return getDefaultShortcut(id)
}

function findConflict(shortcut: string, excludeId?: CommandId) {
  return commandDefinitions.find((cmd) => {
    if (cmd.id === excludeId) return false
    return getShortcut(cmd.id) === shortcut
  })
}

function setShortcut(id: CommandId, shortcut: string) {
  shortcutOverrides.value = { ...shortcutOverrides.value, [id]: shortcut }
}

function resetShortcut(id: CommandId) {
  const next = { ...shortcutOverrides.value }
  delete next[id]
  shortcutOverrides.value = next
}

function resetAllShortcuts() {
  shortcutOverrides.value = {}
}

function hasCustomShortcut(id: CommandId) {
  return Boolean(shortcutOverrides.value[id])
}

function matchEventToCommand(event: KeyboardEvent): CommandId | null {
  const combo = eventToShortcut(event)
  if (!combo) return null
  const normalized = normalizeShortcut(combo)
  const found = commandDefinitions.find((cmd) => getShortcut(cmd.id) === normalized)
  return found?.id ?? null
}

export function useCommandShortcuts() {
  ensureLoaded()
  if (!didWatch && isBrowser) {
    watch(
      shortcutOverrides,
      () => {
        persistShortcuts()
      },
      { deep: true },
    )
    didWatch = true
  }

  return {
    isMacPlatform,
    commands: commandDefinitions,
    getShortcut,
    getDefaultShortcut,
    setShortcut,
    resetShortcut,
    resetAllShortcuts,
    hasCustomShortcut,
    formatShortcutLabel,
    eventToShortcut,
    matchEventToCommand,
    findConflict,
    normalizeShortcut,
  }
}
