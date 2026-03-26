import { ref, computed } from 'vue'
import type { Ref } from 'vue'

export interface CalendarEventInput {
  title: string
  description?: string
  startDate: Date | string
  endDate?: Date | string
  isAllDay?: boolean
  categoryId?: string
  color?: string
  linkedNoteId?: string | null
  linkedBudgetTransactionId?: string | null
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly'
  createNote?: boolean
  createBudgetTransaction?: boolean
  budgetAmount?: number
  budgetType?: 'expense' | 'income'
  budgetAccountId?: string
  budgetCategoryId?: string
}

export interface CalendarEvent {
  id: string
  title: string
  description: string
  startDate: string // ISO format
  endDate: string | null
  isAllDay: boolean
  categoryId: string
  color: string
  linkedNoteId: string | null
  linkedBudgetTransactionId: string | null
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly'
  createdAt: string
  updatedAt: string
}

export interface CalendarCategory {
  id: string
  name: string
  color: string
  icon?: string
}

const STORAGE_KEY = 'le-bocal:calendar:v1'

const defaultCategories: CalendarCategory[] = [
  { id: 'sage', name: 'Personnel', color: '#95a392', icon: '🏠' },
  { id: 'clay', name: 'Travail', color: '#c9b0a1', icon: '💼' },
  { id: 'coral', name: 'Important', color: '#FF8B7B', icon: '⭐' },
  { id: 'mint', name: 'Meeting', color: '#A8E6CF', icon: '👥' },
  { id: 'sky', name: 'Loisirs', color: '#A8D8EA', icon: '🎯' },
]

function generateId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function loadFromStorage(): CalendarEvent[] {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveToStorage(events: CalendarEvent[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  } catch (err) {
    console.error('Failed to save calendar events', err)
  }
}

export function useCalendarStore() {
  const events: Ref<CalendarEvent[]> = ref(loadFromStorage())
  const categories: Ref<CalendarCategory[]> = ref([...defaultCategories])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const selectedDate = ref<Date>(new Date())
  const selectedCategoryId = ref<string | null>(null)

  const filteredEvents = computed(() => {
    if (!selectedCategoryId.value) return events.value
    return events.value.filter(e => e.categoryId === selectedCategoryId.value)
  })

  const eventsForSelectedDate = computed(() => {
    const date = selectedDate.value
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    return filteredEvents.value.filter(event => {
      const eventStart = new Date(event.startDate)
      return eventStart >= startOfDay && eventStart <= endOfDay
    }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
  })

  const eventsForMonth = computed(() => {
    const date = selectedDate.value
    const year = date.getFullYear()
    const month = date.getMonth()
    const startOfMonth = new Date(year, month, 1)
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999)

    return filteredEvents.value.filter(event => {
      const eventStart = new Date(event.startDate)
      return eventStart >= startOfMonth && eventStart <= endOfMonth
    })
  })

  function getEventsForDate(date: Date): CalendarEvent[] {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    return filteredEvents.value.filter(event => {
      const eventStart = new Date(event.startDate)
      return eventStart >= startOfDay && eventStart <= endOfDay
    }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
  }

  function hasEventsOnDate(date: Date): boolean {
    return getEventsForDate(date).length > 0
  }

  async function createEvent(input: CalendarEventInput): Promise<CalendarEvent> {
    loading.value = true
    error.value = null

    try {
      const now = new Date().toISOString()
      const event: CalendarEvent = {
        id: generateId(),
        title: input.title,
        description: input.description || '',
        startDate: input.startDate instanceof Date ? input.startDate.toISOString() : input.startDate,
        endDate: input.endDate ? (input.endDate instanceof Date ? input.endDate.toISOString() : input.endDate) : null,
        isAllDay: input.isAllDay ?? false,
        categoryId: input.categoryId || 'sage',
        color: input.color || defaultCategories[0].color,
        linkedNoteId: input.linkedNoteId || null,
        linkedBudgetTransactionId: input.linkedBudgetTransactionId || null,
        recurrence: input.recurrence || 'none',
        createdAt: now,
        updatedAt: now,
      }

      events.value.push(event)
      saveToStorage(events.value)
      return event
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create event'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateEvent(eventId: string, input: Partial<CalendarEventInput>): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const index = events.value.findIndex(e => e.id === eventId)
      if (index === -1) throw new Error('Event not found')

      const existing = events.value[index]
      const updated: CalendarEvent = {
        ...existing,
        title: input.title ?? existing.title,
        description: input.description ?? existing.description,
        startDate: input.startDate ? (input.startDate instanceof Date ? input.startDate.toISOString() : input.startDate) : existing.startDate,
        endDate: input.endDate !== undefined ? (input.endDate ? (input.endDate instanceof Date ? input.endDate.toISOString() : input.endDate) : null) : existing.endDate,
        isAllDay: input.isAllDay ?? existing.isAllDay,
        categoryId: input.categoryId ?? existing.categoryId,
        color: input.color ?? existing.color,
        linkedNoteId: input.linkedNoteId !== undefined ? input.linkedNoteId : existing.linkedNoteId,
        linkedBudgetTransactionId: input.linkedBudgetTransactionId !== undefined ? input.linkedBudgetTransactionId : existing.linkedBudgetTransactionId,
        recurrence: input.recurrence ?? existing.recurrence,
        updatedAt: new Date().toISOString(),
      }

      events.value[index] = updated
      saveToStorage(events.value)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update event'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteEvent(eventId: string): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const index = events.value.findIndex(e => e.id === eventId)
      if (index === -1) throw new Error('Event not found')

      events.value.splice(index, 1)
      saveToStorage(events.value)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete event'
      throw err
    } finally {
      loading.value = false
    }
  }

  function setSelectedDate(date: Date) {
    selectedDate.value = date
  }

  function setSelectedCategory(categoryId: string | null) {
    selectedCategoryId.value = categoryId
  }

  function linkEventToNote(eventId: string, noteId: string | null) {
    return updateEvent(eventId, { linkedNoteId: noteId })
  }

  function linkEventToBudgetTransaction(eventId: string, transactionId: string | null) {
    return updateEvent(eventId, { linkedBudgetTransactionId: transactionId })
  }

  async function refresh() {
    loading.value = true
    try {
      events.value = loadFromStorage()
    } finally {
      loading.value = false
    }
  }

  // ICS Import/Export helpers
  function exportToICS(): string {
    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Le Bocal//Calendar//FR',
    ]

    for (const event of events.value) {
      const start = new Date(event.startDate)
      const end = event.endDate ? new Date(event.endDate) : new Date(start.getTime() + 60 * 60 * 1000)

      lines.push('BEGIN:VEVENT')
      lines.push(`UID:${event.id}@lebocal.app`)
      lines.push(`DTSTAMP:${formatICSDate(new Date())}`)
      lines.push(`DTSTART:${formatICSDate(start)}`)
      lines.push(`DTEND:${formatICSDate(end)}`)
      lines.push(`SUMMARY:${escapeICS(event.title)}`)
      if (event.description) lines.push(`DESCRIPTION:${escapeICS(event.description)}`)
      lines.push('END:VEVENT')
    }

    lines.push('END:VCALENDAR')
    return lines.join('\r\n')
  }

  function importFromICS(icsData: string): CalendarEventInput[] {
    const events: CalendarEventInput[] = []
    const veventRegex = /BEGIN:VEVENT[\s\S]*?END:VEVENT/g
    const matches = icsData.match(veventRegex)

    if (!matches) return events

    for (const match of matches) {
      const summary = match.match(/SUMMARY:(.+)/)?.[1] || 'Untitled'
      const description = match.match(/DESCRIPTION:(.+)/)?.[1] || ''
      const dtstart = match.match(/DTSTART[:;](\d{8}T?\d{6}Z?)/)?.[1]
      const dtend = match.match(/DTEND[:;](\d{8}T?\d{6}Z?)/)?.[1]

      if (dtstart) {
        events.push({
          title: unescapeICS(summary),
          description: unescapeICS(description),
          startDate: parseICSDate(dtstart),
          endDate: dtend ? parseICSDate(dtend) : undefined,
          isAllDay: !dtstart.includes('T'),
        })
      }
    }

    return events
  }

  return {
    events,
    categories,
    loading,
    error,
    selectedDate,
    selectedCategoryId,
    filteredEvents,
    eventsForSelectedDate,
    eventsForMonth,
    createEvent,
    updateEvent,
    deleteEvent,
    setSelectedDate,
    setSelectedCategory,
    getEventsForDate,
    hasEventsOnDate,
    linkEventToNote,
    linkEventToBudgetTransaction,
    refresh,
    exportToICS,
    importFromICS,
  }
}

// ICS helpers
function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function parseICSDate(icsDate: string): Date {
  if (icsDate.includes('T')) {
    const year = parseInt(icsDate.slice(0, 4))
    const month = parseInt(icsDate.slice(4, 6)) - 1
    const day = parseInt(icsDate.slice(6, 8))
    const hour = parseInt(icsDate.slice(9, 11))
    const min = parseInt(icsDate.slice(11, 13))
    const sec = parseInt(icsDate.slice(13, 15))
    return new Date(Date.UTC(year, month, day, hour, min, sec))
  } else {
    const year = parseInt(icsDate.slice(0, 4))
    const month = parseInt(icsDate.slice(4, 6)) - 1
    const day = parseInt(icsDate.slice(6, 8))
    return new Date(year, month, day)
  }
}

function escapeICS(text: string): string {
  return text.replace(/[\\,;\n]/g, '\\$&').replace(/\n/g, '\\n')
}

function unescapeICS(text: string): string {
  return text.replace(/\\([\\,;\n])/g, '$1').replace(/\\n/g, '\n')
}
