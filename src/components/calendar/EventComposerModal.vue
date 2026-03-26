<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { CalendarEvent, CalendarEventInput } from '../../stores/useCalendarStore'
import type { BudgetAccount, BudgetCategory } from '../../stores/useBudgetStore'

const props = defineProps<{
  open: boolean
  event: CalendarEvent | null
  categories: { id: string; name: string; color: string; icon?: string }[]
  notes: { id: string; title: string }[]
  budgetAccounts: BudgetAccount[]
  budgetCategories: BudgetCategory[]
}>()

const emit = defineEmits<{
  close: []
  save: [input: CalendarEventInput]
  update: [eventId: string, input: CalendarEventInput]
  delete: [eventId: string]
}>()

const isEditing = computed(() => !!props.event)

const form = ref({
  title: '',
  description: '',
  startDate: new Date(),
  endDate: undefined as Date | undefined,
  isAllDay: false,
  categoryId: 'personal',
  recurrence: 'none' as 'none' | 'daily' | 'weekly' | 'monthly',
  createNote: false,
  createBudgetTransaction: false,
  budgetAmount: undefined as number | undefined,
  budgetType: 'expense' as 'expense' | 'income',
  budgetAccountId: '',
  budgetCategoryId: '',
})

const showNoteOptions = ref(false)
const showBudgetOptions = ref(false)

watch(
  () => props.event,
  (event) => {
    if (event) {
      form.value = {
        title: event.title,
        description: event.description || '',
        startDate: new Date(event.startDate),
        endDate: event.endDate ? new Date(event.endDate) : undefined,
        isAllDay: event.isAllDay || false,
        categoryId: event.categoryId || 'personal',
        recurrence: event.recurrence || 'none',
        createNote: false,
        createBudgetTransaction: false,
        budgetAmount: undefined,
        budgetType: 'expense',
        budgetAccountId: props.budgetAccounts[0]?.id || '',
        budgetCategoryId: props.budgetCategories[0]?.id || '',
      }
    } else {
      resetForm()
    }
  },
  { immediate: true }
)

watch(
  () => props.open,
  (open) => {
    if (open && !props.event) {
      resetForm()
    }
  }
)

function resetForm() {
  form.value = {
    title: '',
    description: '',
    startDate: new Date(),
    endDate: undefined,
    isAllDay: false,
    categoryId: 'personal',
    recurrence: 'none',
    createNote: false,
    createBudgetTransaction: false,
    budgetAmount: undefined,
    budgetType: 'expense',
    budgetAccountId: props.budgetAccounts[0]?.id || '',
    budgetCategoryId: props.budgetCategories[0]?.id || '',
  }
  showNoteOptions.value = false
  showBudgetOptions.value = false
}

function handleSubmit() {
  const input: CalendarEventInput = {
    title: form.value.title,
    description: form.value.description,
    startDate: form.value.startDate,
    endDate: form.value.endDate,
    isAllDay: form.value.isAllDay,
    categoryId: form.value.categoryId,
    recurrence: form.value.recurrence,
    createNote: form.value.createNote,
    createBudgetTransaction: form.value.createBudgetTransaction,
    budgetAmount: form.value.budgetAmount,
    budgetType: form.value.budgetType,
    budgetAccountId: form.value.budgetAccountId,
    budgetCategoryId: form.value.budgetCategoryId,
  }

  if (props.event) {
    emit('update', props.event.id, input)
  } else {
    emit('save', input)
  }
}

function handleCategoryChange(categoryId: string) {
  form.value.categoryId = categoryId
}

function handleDelete() {
  if (props.event) {
    emit('delete', props.event.id)
  }
}

function formatDateTimeLocal(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-md px-4"
        @click.self="emit('close')"
      >
        <div class="w-full max-w-2xl rounded-[32px] bg-[#faf9f6] p-6 shadow-2xl border border-black/5 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-display text-xl text-anthracite">
              {{ isEditing ? 'Modifier' : 'Nouvel événement' }}
            </h3>
            <button class="text-gray-400 hover:text-gray-600" @click="emit('close')">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form class="space-y-3" @submit.prevent="handleSubmit">
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Titre</label>
              <input
                v-model="form.title"
                type="text"
                placeholder="Nom de l'événement..."
                class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/20"
                required
              />
            </div>

            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Catégorie</label>
              <div class="flex gap-2 flex-wrap">
                <button
                  v-for="category in categories"
                  :key="category.id"
                  type="button"
                  :class="[
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all',
                    form.categoryId === category.id
                      ? 'ring-2 ring-offset-1'
                      : 'hover:bg-white/70',
                  ]"
                  :style="{
                    backgroundColor: form.categoryId === category.id ? category.color + '30' : 'rgba(255,255,255,0.5)',
                    '--ring-color': category.color,
                    color: category.color,
                  }"
                  @click="handleCategoryChange(category.id)"
                >
                  <span>{{ category.icon }}</span>
                  <span>{{ category.name }}</span>
                </button>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Début</label>
                <input
                  :value="formatDateTimeLocal(form.startDate as Date)"
                  type="datetime-local"
                  class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-sage focus:outline-none"
                  @input="form.startDate = new Date(($event.target as HTMLInputElement).value)"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-1">Fin (optionnel)</label>
                <input
                  :value="form.endDate ? formatDateTimeLocal(form.endDate as Date) : ''"
                  type="datetime-local"
                  class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-sage focus:outline-none"
                  @input="form.endDate = ($event.target as HTMLInputElement).value ? new Date(($event.target as HTMLInputElement).value) : undefined"
                />
              </div>
            </div>

            <div class="flex items-center gap-2">
              <input
                id="allday"
                v-model="form.isAllDay"
                type="checkbox"
                class="h-4 w-4 rounded border-gray-300 text-sage focus:ring-sage"
              />
              <label for="allday" class="text-sm text-gray-700">Toute la journée</label>
            </div>

            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Description</label>
              <textarea
                v-model="form.description"
                rows="2"
                placeholder="Détails de l'événement..."
                class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/20 resize-none"
              />
            </div>

            <div class="border-t border-gray-100 pt-2">
              <button
                type="button"
                class="flex items-center justify-between w-full text-sm text-gray-600 hover:text-sage transition-colors"
                @click="showNoteOptions = !showNoteOptions"
              >
                <span class="flex items-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Créer une note liée
                </span>
                <svg
                  :class="['w-4 h-4 transition-transform', showNoteOptions ? 'rotate-180' : '']"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div v-if="showNoteOptions" class="mt-2 pl-6">
                <label class="flex items-center gap-2 text-sm">
                  <input v-model="form.createNote" type="checkbox" class="rounded text-sage" />
                  Créer automatiquement une note pour cet événement
                </label>
              </div>
            </div>

            <div class="border-t border-gray-100 pt-2">
              <button
                type="button"
                class="flex items-center justify-between w-full text-sm text-gray-600 hover:text-clay transition-colors"
                @click="showBudgetOptions = !showBudgetOptions"
              >
                <span class="flex items-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Créer une transaction budget
                </span>
                <svg
                  :class="['w-4 h-4 transition-transform', showBudgetOptions ? 'rotate-180' : '']"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div v-if="showBudgetOptions" class="mt-2 space-y-2 pl-6">
                <label class="flex items-center gap-2 text-sm">
                  <input v-model="form.createBudgetTransaction" type="checkbox" class="rounded text-clay" />
                  Créer une transaction automatiquement
                </label>
                <div v-if="form.createBudgetTransaction" class="space-y-2">
                  <input
                    v-model.number="form.budgetAmount"
                    type="number"
                    step="0.01"
                    placeholder="Montant"
                    class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  />
                  <div class="grid grid-cols-2 gap-2">
                    <select v-model="form.budgetType" class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
                      <option value="expense">Dépense</option>
                      <option value="income">Revenu</option>
                    </select>
                    <select v-model="form.budgetAccountId" class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
                      <option v-for="account in budgetAccounts" :key="account.id" :value="account.id">{{ account.name }}</option>
                    </select>
                  </div>
                  <select v-model="form.budgetCategoryId" class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
                    <option v-for="category in budgetCategories" :key="category.id" :value="category.id">{{ category.name }}</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Récurrence</label>
              <select
                v-model="form.recurrence"
                class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-sage focus:outline-none"
              >
                <option value="none">Une seule fois</option>
                <option value="daily">Tous les jours</option>
                <option value="weekly">Toutes les semaines</option>
                <option value="monthly">Tous les mois</option>
              </select>
            </div>

            <div class="flex gap-2 pt-2 border-t border-gray-100">
              <button
                v-if="isEditing"
                type="button"
                class="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 text-sm font-medium hover:bg-rose-100 transition-colors"
                @click="handleDelete"
              >
                Supprimer
              </button>
              <button
                type="button"
                class="flex-1 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                @click="emit('close')"
              >
                Annuler
              </button>
              <button
                type="submit"
                class="flex-1 px-3 py-2 rounded-xl bg-sage text-white text-sm font-medium hover:brightness-95 transition-all"
              >
                {{ isEditing ? 'Enregistrer' : 'Créer' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
