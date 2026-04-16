<script setup lang="ts">
import { useAppShell } from '../composables/useAppShell'
import BudgetWorkspace from '../components/budget/BudgetWorkspace.vue'

const shell = useAppShell()
</script>

<template>
  <div class="space-y-6 lg:space-y-8">
    <header>
      <p class="text-xs uppercase tracking-[0.4em] text-[var(--text-muted)]">Budget</p>
      <h1 class="font-display text-2xl lg:text-3xl font-semibold text-[var(--text-main)]">Suivi financier</h1>
    </header>

    <BudgetWorkspace
      v-if="shell.budgetSummary.value && shell.budgetStore.accounts.value.length >= 0"
      :summary="shell.budgetSummary.value"
      :accounts="shell.budgetStore.accounts.value"
      :transactions="shell.budgetTransactionsDisplay.value"
      :alerts="shell.budgetStore.alerts.value"
      :categories="shell.budgetCategoryBreakdown.value"
      :category-options="shell.budgetStore.categories.value"
      :notes="shell.budgetNotes.value"
      :trip-plans="shell.budgetTripPlans.value"
      :bank-profiles="shell.budgetBankProfiles.value"
      @open-planner="(mode: 'vacation' | 'bank') => shell.openBudgetPlanner(mode)"
      @close-planner="shell.closeBudgetPlanner"
      @refresh="shell.handleRefreshBudget"
    />
    <div v-else class="glass-card rounded-[32px] p-12 text-center">
      <p class="text-[var(--text-muted)]">Chargement du budget…</p>
    </div>
  </div>
</template>
