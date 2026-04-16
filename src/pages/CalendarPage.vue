<script setup lang="ts">
import { useAppShell } from '../composables/useAppShell'
import CalendarWorkspace from '../components/calendar/CalendarWorkspace.vue'

const shell = useAppShell()
</script>

<template>
  <div class="space-y-6 lg:space-y-8">
    <header>
      <p class="text-xs uppercase tracking-[0.4em] text-[var(--text-muted)]">Calendrier</p>
      <h1 class="font-display text-2xl lg:text-3xl font-semibold text-[var(--text-main)]">Agenda</h1>
    </header>

    <CalendarWorkspace
      :notes="shell.budgetNotes.value"
      :budget-accounts="shell.budgetStore.accounts.value"
      :budget-categories="shell.budgetStore.categories.value"
      @create-note-from-event="shell.handleCreateNoteFromEvent"
      @create-budget-transaction-from-event="shell.handleCreateBudgetTransactionFromEvent"
    />
  </div>
</template>
