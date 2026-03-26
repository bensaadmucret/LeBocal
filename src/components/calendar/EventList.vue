<script setup lang="ts">
import { computed } from 'vue'
import EventCard from './EventCard.vue'
import type { CalendarEvent, CalendarCategory } from '../../stores/useCalendarStore'

const props = defineProps<{
  selectedDate: Date
  events: CalendarEvent[]
  categories: CalendarCategory[]
  loading?: boolean
}>()

const emit = defineEmits<{
  createEvent: []
  editEvent: [eventId: string]
  deleteEvent: [eventId: string]
  linkNote: [eventId: string]
  linkBudget: [eventId: string]
}>()

const formattedDate = computed(() => {
  return props.selectedDate.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
})

const isToday = computed(() => {
  const today = new Date()
  return props.selectedDate.toDateString() === today.toDateString()
})

function getCategory(categoryId: string): CalendarCategory | undefined {
  return props.categories.find(c => c.id === categoryId)
}
</script>

<template>
  <div class="glass-card rounded-[32px] p-6 shadow-xl h-full">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="font-display text-lg font-semibold text-anthracite">
          {{ formattedDate }}
        </h3>
        <span
          v-if="isToday"
          class="px-2 py-0.5 rounded-full bg-sage/20 text-sage text-xs font-medium"
        >
          Aujourd'hui
        </span>
      </div>
      <button
        class="h-10 w-10 rounded-full bg-sage text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform tap-effect"
        @click="emit('createEvent')"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>

    <!-- Events List -->
    <div v-if="events.length > 0" class="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
      <EventCard
        v-for="event in events"
        :key="event.id"
        :event="event"
        :category="getCategory(event.categoryId)"
        @click="emit('editEvent', event.id)"
        @edit="emit('editEvent', event.id)"
        @delete="emit('deleteEvent', event.id)"
        @link-note="emit('linkNote', event.id)"
        @link-budget="emit('linkBudget', event.id)"
      />
    </div>

    <!-- Empty State -->
    <div
      v-else
      class="flex flex-col items-center justify-center py-12 text-center"
    >
      <div class="h-16 w-16 rounded-2xl bg-white/50 flex items-center justify-center mb-4">
        <svg class="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <p class="text-sm text-gray-400">Aucun événement</p>
      <p class="text-xs text-gray-300 mt-1">Cliquez sur + pour en créer un</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <span class="h-5 w-5 animate-spin rounded-full border-2 border-sage border-t-transparent"></span>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(149, 163, 146, 0.3);
  border-radius: 10px;
}
</style>
