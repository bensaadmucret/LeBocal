<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  currentDate: Date
  selectedDate: Date
  hasEventsOnDate: (date: Date) => boolean
  getEventsForDate: (date: Date) => { color: string; categoryId: string }[]
}>()

const emit = defineEmits<{
  selectDate: [date: Date]
  prevMonth: []
  nextMonth: []
}>()

const monthNames = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

const calendarDays = computed(() => {
  const year = props.currentDate.getFullYear()
  const month = props.currentDate.getMonth()
  
  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  
  const startDay = firstDayOfMonth.getDay()
  const daysInMonth = lastDayOfMonth.getDate()
  
  const days: { date: Date; day: number; isCurrentMonth: boolean; isToday: boolean; isSelected: boolean }[] = []
  
  // Previous month padding
  const prevMonthDays = new Date(year, month, 0).getDate()
  for (let i = startDay - 1; i >= 0; i--) {
    days.push({
      date: new Date(year, month - 1, prevMonthDays - i),
      day: prevMonthDays - i,
      isCurrentMonth: false,
      isToday: false,
      isSelected: false,
    })
  }
  
  // Current month
  const today = new Date()
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month, i)
    days.push({
      date,
      day: i,
      isCurrentMonth: true,
      isToday: date.toDateString() === today.toDateString(),
      isSelected: date.toDateString() === props.selectedDate.toDateString(),
    })
  }
  
  // Next month padding (fill to 42 cells = 6 rows)
  const remainingCells = 42 - days.length
  for (let i = 1; i <= remainingCells; i++) {
    days.push({
      date: new Date(year, month + 1, i),
      day: i,
      isCurrentMonth: false,
      isToday: false,
      isSelected: false,
    })
  }
  
  return days
})

function formatMonthYear(date: Date): string {
  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`
}

function selectDate(date: Date) {
  emit('selectDate', date)
}
</script>

<template>
  <div class="glass-card rounded-[32px] p-6 shadow-xl">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <h2 class="font-display text-xl font-semibold text-anthracite">
        {{ formatMonthYear(currentDate) }}
      </h2>
      <div class="flex gap-2">
        <button
          class="h-8 w-8 rounded-full bg-white/50 flex items-center justify-center hover:bg-white transition-colors"
          @click="emit('prevMonth')"
        >
          <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          class="h-8 w-8 rounded-full bg-white/50 flex items-center justify-center hover:bg-white transition-colors"
          @click="emit('nextMonth')"
        >
          <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Day Names -->
    <div class="grid grid-cols-7 gap-1 mb-2">
      <div
        v-for="day in dayNames"
        :key="day"
        class="text-center text-xs font-medium text-gray-400 py-2"
      >
        {{ day }}
      </div>
    </div>

    <!-- Calendar Grid -->
    <div class="grid grid-cols-7 gap-1">
      <button
        v-for="(day, index) in calendarDays"
        :key="index"
        :class="[
          'relative h-12 rounded-xl flex flex-col items-center justify-center transition-all tap-effect',
          day.isCurrentMonth ? 'text-anthracite hover:bg-white/70' : 'text-gray-300',
          day.isToday ? 'bg-sage/20 text-sage font-semibold' : '',
          day.isSelected ? 'ring-2 ring-sage bg-white' : '',
        ]"
        @click="selectDate(day.date)"
      >
        <span class="text-sm">{{ day.day }}</span>
        
        <!-- Event dots -->
        <div v-if="hasEventsOnDate(day.date)" class="flex gap-0.5 mt-0.5">
          <div
            v-for="(event, i) in getEventsForDate(day.date).slice(0, 3)"
            :key="i"
            class="w-1 h-1 rounded-full"
            :style="{ backgroundColor: event.color }"
          />
        </div>
      </button>
    </div>

    <!-- Today button -->
    <div class="mt-4 flex justify-center">
      <button
        class="px-4 py-2 rounded-full text-sm font-medium text-sage hover:bg-sage/10 transition-colors"
        @click="selectDate(new Date())"
      >
        Aujourd'hui
      </button>
    </div>
  </div>
</template>
