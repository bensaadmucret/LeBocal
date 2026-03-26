<script setup lang="ts">
import type { CalendarEvent, CalendarCategory } from '../../stores/useCalendarStore'

const props = defineProps<{
  event: CalendarEvent
  category: CalendarCategory | undefined
}>()

const emit = defineEmits<{
  click: []
  edit: []
  delete: []
  linkNote: []
  linkBudget: []
}>()

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return ''
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60))
  if (diff < 60) return `${diff} min`
  return `${Math.round(diff / 60)} h`
}
</script>

<template>
  <div
    class="group glass-card rounded-2xl p-4 cursor-pointer hover:scale-[1.02] transition-all tap-effect"
    :class="{ 'opacity-60': event.isAllDay }"
    @click="emit('click')"
  >
    <!-- Header: Time + Actions -->
    <div class="flex items-start justify-between mb-2">
      <div class="flex items-center gap-2">
        <span
          class="px-2 py-1 rounded-lg text-xs font-medium"
          :style="{ backgroundColor: props.category?.color + '20', color: props.category?.color }"
        >
          {{ formatTime(event.startDate) }}
        </span>
        <span v-if="event.endDate" class="text-xs text-gray-400">
          ({{ formatDuration(event.startDate, event.endDate) }})
        </span>
      </div>
      
      <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          class="p-1 rounded-lg hover:bg-white/50 text-gray-400 hover:text-sage transition-colors"
          title="Modifier"
          @click.stop="emit('edit')"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button
          class="p-1 rounded-lg hover:bg-white/50 text-gray-400 hover:text-rose-500 transition-colors"
          title="Supprimer"
          @click.stop="emit('delete')"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Title -->
    <h4 class="font-display text-base font-semibold text-anthracite mb-1">
      {{ event.title }}
    </h4>

    <!-- Description -->
    <p v-if="event.description" class="text-sm text-gray-500 line-clamp-2 mb-2">
      {{ event.description }}
    </p>

    <!-- Category Badge -->
    <div class="flex items-center gap-2 mb-2">
      <span class="text-base">{{ category?.icon || '📅' }}</span>
      <span class="text-xs text-gray-400">{{ category?.name || 'Sans catégorie' }}</span>
    </div>

    <!-- Links -->
    <div class="flex gap-2 mt-3 pt-3 border-t border-gray-100">
      <button
        v-if="!event.linkedNoteId"
        class="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/50 text-xs text-gray-500 hover:bg-white hover:text-sage transition-colors"
        @click.stop="emit('linkNote')"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Créer note
      </button>
      <span
        v-else
        class="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sage/10 text-xs text-sage"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        Note liée
      </span>

      <button
        v-if="!event.linkedBudgetTransactionId"
        class="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/50 text-xs text-gray-500 hover:bg-white hover:text-clay transition-colors"
        @click.stop="emit('linkBudget')"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Transaction
      </button>
      <span
        v-else
        class="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-clay/10 text-xs text-clay"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        Budget lié
      </span>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
