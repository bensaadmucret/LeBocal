<script setup lang="ts">
import { ref, computed } from 'vue'
import CalendarMonthView from './CalendarMonthView.vue'
import EventList from './EventList.vue'
import EventComposerModal from './EventComposerModal.vue'
import { useCalendarStore, type CalendarEvent, type CalendarEventInput } from '../../stores/useCalendarStore'
import type { BudgetAccount, BudgetCategory } from '../../stores/useBudgetStore'

const props = defineProps<{
  notes: { id: string; title: string }[]
  budgetAccounts: BudgetAccount[]
  budgetCategories: BudgetCategory[]
}>()

const emit = defineEmits<{
  createNoteFromEvent: [title: string, eventId: string]
  createBudgetTransactionFromEvent: [payload: { 
    eventId: string
    amount: number
    type: 'expense' | 'income'
    accountId: string
    categoryId: string
    label: string
    date: Date
  }]
  linkEventToExistingNote: [eventId: string, noteId: string]
}>()

const store = useCalendarStore()

const currentDate = ref(new Date())
const composerOpen = ref(false)
const editingEvent = ref<CalendarEvent | null>(null)

const selectedDateLabel = computed(() => {
  return store.selectedDate.value.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
})

function prevMonth() {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1, 1)
}

function nextMonth() {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 1)
}

function selectDate(date: Date) {
  store.setSelectedDate(date)
}

function openComposer() {
  editingEvent.value = null
  composerOpen.value = true
}

function editEvent(eventId: string) {
  const event = store.events.value.find(e => e.id === eventId)
  if (event) {
    editingEvent.value = event as any
    composerOpen.value = true
  }
}

function closeComposer() {
  composerOpen.value = false
  editingEvent.value = null
}

async function handleSaveEvent(input: CalendarEventInput) {
  const event = await store.createEvent(input)
  
  // Create linked note if requested
  if (input.createNote) {
    emit('createNoteFromEvent', input.title, event.id)
  }
  
  // Create linked budget transaction if requested
  if (input.createBudgetTransaction && input.budgetAmount && input.budgetAccountId) {
    emit('createBudgetTransactionFromEvent', {
      eventId: event.id,
      amount: input.budgetAmount,
      type: input.budgetType || 'expense',
      accountId: input.budgetAccountId,
      categoryId: input.budgetCategoryId || '',
      label: input.title,
      date: input.startDate instanceof Date ? input.startDate : new Date(input.startDate),
    })
  }
  
  closeComposer()
}

async function handleUpdateEvent(eventId: string, input: CalendarEventInput) {
  await store.updateEvent(eventId, input)
  closeComposer()
}

async function handleDeleteEvent(eventId: string) {
  await store.deleteEvent(eventId)
  closeComposer()
}

function handleLinkNote(eventId: string) {
  // For now, create a new note - could be extended to select existing note
  const event = store.events.value.find(e => e.id === eventId)
  if (event) {
    emit('createNoteFromEvent', event.title, eventId)
  }
}

function handleLinkBudget(eventId: string) {
  const event = store.events.value.find(e => e.id === eventId)
  if (event && props.budgetAccounts.length > 0) {
    emit('createBudgetTransactionFromEvent', {
      eventId,
      amount: 0,
      type: 'expense',
      accountId: props.budgetAccounts[0].id,
      categoryId: props.budgetCategories[0]?.id || '',
      label: event.title,
      date: new Date(event.startDate),
    })
  }
}

function getEventsForDate(date: Date) {
  return store.getEventsForDate(date).map(e => ({ color: e.color, categoryId: e.categoryId }))
}

function exportICS() {
  const icsContent = store.exportToICS()
  const blob = new Blob([icsContent], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `le-bocal-calendar-${new Date().toISOString().split('T')[0]}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

function importICS(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  
  const reader = new FileReader()
  reader.onload = (e) => {
    const icsData = e.target?.result as string
    if (icsData) {
      const importedEvents = store.importFromICS(icsData)
      importedEvents.forEach(evt => store.createEvent(evt))
    }
  }
  reader.readAsText(file)
  input.value = ''
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <header class="flex items-center justify-between">
      <div>
        <h2 class="font-display text-2xl font-semibold text-anthracite">Calendrier</h2>
        <p class="text-sm text-gray-500 mt-1">{{ selectedDateLabel }}</p>
      </div>
      <div class="flex items-center gap-3">
        <!-- Import/Export -->
        <label class="h-10 px-4 rounded-xl bg-white/50 flex items-center gap-2 text-sm text-gray-600 hover:bg-white cursor-pointer transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Importer .ics
          <input type="file" accept=".ics,.ical" class="hidden" @change="importICS">
        </label>
        <button
          class="h-10 px-4 rounded-xl bg-white/50 flex items-center gap-2 text-sm text-gray-600 hover:bg-white transition-colors"
          @click="exportICS"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exporter
        </button>
      </div>
    </header>

    <!-- Main Grid: Calendar + Events -->
    <section class="grid gap-6 lg:grid-cols-[1.5fr,1fr]">
      <!-- Calendar -->
      <CalendarMonthView
        :current-date="currentDate"
        :selected-date="store.selectedDate.value"
        :has-events-on-date="store.hasEventsOnDate"
        :get-events-for-date="getEventsForDate"
        @select-date="selectDate"
        @prev-month="prevMonth"
        @next-month="nextMonth"
      />

      <!-- Events List -->
      <EventList
        :selected-date="store.selectedDate.value"
        :events="store.eventsForSelectedDate.value"
        :categories="store.categories.value"
        :loading="store.loading.value"
        @create-event="openComposer"
        @edit-event="editEvent"
        @delete-event="store.deleteEvent"
        @link-note="handleLinkNote"
        @link-budget="handleLinkBudget"
      />
    </section>

    <!-- Composer Modal -->
    <EventComposerModal
      :open="composerOpen"
      :event="editingEvent"
      :categories="store.categories.value"
      :notes="props.notes"
      :budget-accounts="props.budgetAccounts"
      :budget-categories="props.budgetCategories"
      @close="closeComposer"
      @save="handleSaveEvent"
      @update="handleUpdateEvent"
      @delete="handleDeleteEvent"
    />
  </div>
</template>
