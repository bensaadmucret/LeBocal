<script setup lang="ts">
import { ref, computed } from 'vue'
import StatsGrid from '../common/StatsGrid.vue'
import NotesList from '../notes/NotesList.vue'
import ActiveNotePanel from '../notes/ActiveNotePanel.vue'
import ShortcutSettings from '../settings/ShortcutSettings.vue'
import BudgetWorkspace from '../budget/BudgetWorkspace.vue'
import { useTheme } from '../../composables/useTheme'
import type {
  BudgetAccount,
  BudgetAlert,
  BudgetCategory,
  BudgetTransaction,
  BudgetTransactionType,
  BudgetTripPlan,
  BudgetTripPlanInput,
  BudgetBankProfile,
  BudgetBankProfileInput,
} from '../../stores/useBudgetStore'
import type { Block } from '../../stores/useNotesStore'

const props = defineProps<{
  navItems: { label: string; icon: string; active?: boolean }[]
  stats: { title: string; value: number; detail: string }[]
  notes: { id: string; title: string; category: string; excerpt: string; status: string; updated: string }[]
  activeNote: {
    id: string
    title: string
    owner: string
    status: string
    tags: string[]
    summary: string
    checklist: { id?: string; label: string; done: boolean }[]
    highlights: string[]
    blocks: Block[]
  }
  timeline: { time: string; event: string }[]
  mode?: 'workspace' | 'settings' | 'budget'
  quickFlow?: { reviewCount: number; pendingBlocks: number; lastSyncLabel: string }
  shortcutHints?: { createNote?: string | null }
  budgetSummary?: {
    totalBalance: number
    currency: string
    accountCount: number
    targets?: { label: string; progress: number; remaining: number } | null
  }
  budgetAccounts?: BudgetAccount[]
  budgetTransactions?: (BudgetTransaction & {
    accountName?: string
    categoryName?: string
    categoryColor?: string
  })[]
  budgetAlerts?: BudgetAlert[]
  budgetCategories?: { id: string; name: string; total: number; type: BudgetTransactionType; color?: string; icon?: string }[]
  budgetCategoryOptions?: BudgetCategory[]
  budgetNotes?: { id: string; title: string }[]
  budgetNoteTransactions?: Record<string, (BudgetTransaction & {
    accountName?: string
    categoryName?: string
    categoryColor?: string
  })[]>
  budgetLoading?: boolean
  budgetTripPlans?: BudgetTripPlan[]
  budgetBankProfiles?: BudgetBankProfile[]
  budgetPlannerOpen?: boolean
  budgetPlannerMode?: 'vacation' | 'bank'
}>()

const emit = defineEmits([
  'create-note',
  'share',
  'view-all',
  'select-note',
  'update-active-note',
  'edit-note',
  'delete-note',
  'select-nav',
  'create-budget-account',
  'update-budget-account',
  'delete-budget-account',
  'create-budget-transaction',
  'update-budget-transaction',
  'delete-budget-transaction',
  'link-budget-transaction-note',
  'save-budget-trip',
  'delete-budget-trip',
  'create-bank-profile',
  'update-bank-profile',
  'delete-bank-profile',
  'open-budget-planner',
  'close-budget-planner',
  'refresh-budget',
  'open-command-palette',
])


const sidebarOpen = ref(false)
const selectedCollectionId = ref<string | null>(null)
const plannerExpanded = ref(false)
const { isDark, toggleTheme } = useTheme()

const filteredNotes = computed(() => {
  let notes = props.notes
  if (selectedCollectionId.value) {
    const coll = props.budgetCategories?.find(c => c.id === selectedCollectionId.value)
    if (coll) {
      notes = notes.filter(n => n.category.toLowerCase() === coll.name.toLowerCase())
    }
  }
  return notes
})

const mode = computed(() => props.mode ?? 'workspace')
const quickFlow = computed(() =>
  props.quickFlow || { reviewCount: 0, pendingBlocks: 0, lastSyncLabel: '—' },
)

function toggleCollection(id: string) {
  selectedCollectionId.value = selectedCollectionId.value === id ? null : id
}

function forwardSaveTrip(payload: BudgetTripPlanInput) {
  emit('save-budget-trip', payload)
}

function forwardDeleteTrip(planId: string) {
  emit('delete-budget-trip', planId)
}

function forwardCreateBankProfile(payload: BudgetBankProfileInput) {
  emit('create-bank-profile', payload)
}

function forwardUpdateBankProfile(payload: { profileId: string; input: Partial<BudgetBankProfileInput> }) {
  emit('update-bank-profile', payload)
}

function forwardDeleteBankProfile(profileId: string) {
  emit('delete-bank-profile', profileId)
}

function forwardOpenPlanner(mode: 'vacation' | 'bank') {
  emit('open-budget-planner', mode)
}

function forwardClosePlanner() {
  emit('close-budget-planner')
}
</script>

<template>
  <div class="mx-auto flex flex-col lg:flex-row min-h-screen max-w-7xl gap-6 lg:gap-10 px-4 sm:px-6 lg:px-10 py-6 lg:py-10">
    <!-- Mobile Header/Toggle -->
    <div class="lg:hidden flex items-center justify-between mb-2">
      <div class="flex items-center gap-3">
        <div class="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
          <span class="text-xl">📁</span>
        </div>
        <h2 class="font-display font-semibold text-[var(--text-main)]">Le Bocal</h2>
      </div>
      <button 
        class="h-10 w-10 rounded-xl bg-[var(--surface-card)] flex items-center justify-center shadow-md ring-1 ring-black/5 dark:ring-white/10"
        @click="sidebarOpen = !sidebarOpen"
      >
        <span>{{ sidebarOpen ? '✕' : '☰' }}</span>
      </button>
    </div>

    <!-- Sidebar -->
    <aside 
      class="glass-card flex w-full lg:w-64 flex-col items-center gap-6 lg:gap-10 rounded-[32px] lg:rounded-[40px] p-6 lg:p-8 animate-fade-in shadow-xl dark:bg-[var(--surface)] transition-all duration-300 overflow-hidden"
      :class="[sidebarOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 lg:max-h-none opacity-0 lg:opacity-100 hidden lg:flex']"
    >
      <div class="text-center">
        <p class="text-xs uppercase tracking-[0.35em] text-[var(--text-muted)]">Le Bocal</p>
        <p class="text-sm text-[var(--text-muted)] opacity-80">Workspace</p>
      </div>
      <img src="https://i.pravatar.cc/96" class="h-16 w-16 rounded-2xl border-2 border-white shadow-lg" alt="avatar" />
      <nav class="flex w-full flex-col gap-4">
        <button
          v-for="item in props.navItems"
          :key="item.label"
          class="tap-effect flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition-all"
          :class="item.active ? 'bg-royal text-white shadow-lg scale-105 font-semibold' : 'text-gray-500 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-white/5'"
          @click="emit('select-nav', item.label)"
        >
          <span>{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </button>
      </nav>
      <button class="tap-effect mt-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg hover:shadow-indigo-500/40 transition-shadow" @click="emit('create-note')">
        <span class="text-2xl">+</span>
      </button>

      <div class="w-full rounded-2xl bg-[var(--surface-card)] dark:bg-[var(--glass-bg)] p-4 text-sm text-[var(--text-main)] shadow-sm ring-1 ring-black/5 dark:ring-white/5">
        <p class="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)] font-bold">Flux rapide</p>
        <ul class="mt-3 space-y-2 text-xs">
          <li>{{ quickFlow.reviewCount }} notes en revue</li>
          <li>{{ quickFlow.pendingBlocks }} blocs en cours</li>
          <li>Sync il y a {{ quickFlow.lastSyncLabel }}</li>
        </ul>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 space-y-6 lg:space-y-8 animate-fade-in">
      <header class="flex flex-col md:flex-row md:items-center gap-4 lg:gap-6">
        <div class="flex-1">
          <p class="text-xs uppercase tracking-[0.4em] text-[var(--text-muted)]">Bienvenue, Léna</p>
          <h1 class="font-display text-2xl lg:text-3xl font-semibold text-[var(--text-main)]">Workspace Hub</h1>
        </div>
        <div class="flex items-center gap-3 lg:gap-4">
          <button
            type="button"
            class="flex-1 md:flex-none md:w-64 lg:w-80 rounded-full bg-[var(--surface-card)] dark:bg-[var(--glass-bg)] px-5 lg:px-6 py-2.5 lg:py-3 shadow-inner ring-1 ring-black/5 dark:ring-white/5 flex items-center justify-between gap-3 text-left transition hover:ring-2 hover:ring-royal/30"
            @click="emit('open-command-palette')"
          >
            <span class="flex items-center gap-3 text-[var(--text-muted)]">
              <span class="text-slate-400">🔍</span>
              <span class="text-sm font-medium text-[var(--text-main)] dark:text-white">Rechercher partout</span>
            </span>
            <span class="hidden md:flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
              <span class="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-white/10 dark:text-slate-200">⌘</span>
              <span class="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-white/10 dark:text-slate-200">K</span>
            </span>
          </button>
          <button 
            class="h-10 w-10 lg:h-12 lg:w-12 rounded-xl lg:rounded-2xl bg-[var(--surface-card)] dark:bg-[var(--glass-bg)] shadow-lg flex items-center justify-center text-lg lg:text-xl tap-effect ring-1 ring-black/5 dark:ring-white/10 transition-all hover:scale-110"
            :title="isDark ? 'Passer au mode jour' : 'Passer au mode nuit'"
            @click="toggleTheme"
          >
            {{ isDark ? '☀️' : '⚙️' }}
          </button>
        </div>
      </header>

      <!-- Hero Card (Space & Status) -->
      <section v-if="mode === 'workspace'" class="hero-card grid gap-6 p-6 lg:p-8 md:grid-cols-[2fr,1fr] animate-fade-in">
        <div>
          <p class="text-sm text-white/80">Espace disponible</p>
          <p class="mt-2 text-3xl lg:text-5xl font-semibold">20.25 GB</p>
          <p class="text-white/70">sur 25 GB utilisés</p>
          <div class="chips mt-6 flex flex-wrap gap-2 text-[10px] lg:text-xs text-white/80">
            <span>Synchro {{ quickFlow.lastSyncLabel }}</span>
            <span>Priorité notes</span>
          </div>
        </div>
        <div class="flex flex-col items-start md:items-end justify-between md:justify-end gap-4">
          <div class="text-left md:text-right">
            <p class="text-[10px] uppercase tracking-[0.3em] text-white/70">Statut</p>
            <p class="mt-1 rounded-xl bg-white/25 px-4 py-1.5 text-white font-medium border border-white/20">Healthy</p>
          </div>
          <button class="tap-effect w-full md:w-auto rounded-xl lg:rounded-2xl bg-white text-sm font-semibold text-slate-900 px-6 py-3 shadow-xl">Gérer l'espace</button>
        </div>
      </section>

      <!-- Dashboard Sections -->
      <section v-if="mode === 'workspace'" class="grid gap-6 lg:grid-cols-[1.6fr,1.1fr]">
        <!-- Left: Collections & Notes -->
        <div class="space-y-6">
          <div class="glass-card rounded-[28px] lg:rounded-[32px] p-5 lg:p-6 shadow-xl">
            <div class="flex items-center justify-between">
              <h2 class="text-lg lg:text-xl font-semibold text-[var(--text-main)]">Collections</h2>
              <button class="text-sm text-indigo-500 font-medium" @click="emit('view-all')">Voir tout</button>
            </div>
            <div class="mt-4 lg:mt-5 grid gap-4 grid-cols-1 sm:grid-cols-2">
              <article
                v-for="collection in props.budgetCategories"
                :key="collection.id"
                class="collection-card tap-effect rounded-[24px] lg:rounded-[28px] p-4 lg:p-5 cursor-pointer border border-transparent dark:bg-[var(--glass-bg)]"
                :class="[
                  collection.color || 'bg-gradient-to-br from-white to-slate-50 dark:from-[var(--surface)] dark:to-[var(--glass-bg)]',
                  selectedCollectionId === collection.id ? 'ring-2 ring-royal border-royal/20 bg-white dark:bg-[var(--surface)] shadow-lg' : 'shadow-sm hover:shadow-md'
                ]"
                @click="toggleCollection(collection.id)"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-[10px] uppercase tracking-[0.35em] text-[var(--text-muted)] font-bold">{{ collection.name }}</p>
                    <p class="text-base lg:text-lg font-semibold text-[var(--text-main)]">{{ collection.total }} items</p>
                  </div>
                  <span class="text-xl lg:text-2xl">{{ collection.icon || '📁' }}</span>
                </div>
                <p class="mt-2 lg:mt-3 text-[10px] text-[var(--text-muted)] font-medium">Auto-mis à jour</p>
              </article>
            </div>
          </div>

          <div class="glass-card rounded-[28px] lg:rounded-[32px] p-5 lg:p-6 shadow-xl">
            <div class="flex items-center justify-between">
              <h2 class="text-lg lg:text-xl font-semibold text-[var(--text-main)]">Notes rapides</h2>
              <button class="text-sm text-indigo-500 font-medium" @click="emit('view-all')">Tout voir</button>
            </div>
            <div class="mt-4">
              <NotesList :notes="filteredNotes" :active-id="activeNote.id" @select="emit('select-note', $event)" />
            </div>
          </div>
        </div>

        <!-- Right: Active Note & Planner -->
        <div class="space-y-6">
          <ActiveNotePanel
            :note="props.activeNote"
            :timeline="props.timeline"
            :budget-transactions="props.budgetNoteTransactions?.[props.activeNote.id] || []"
            @update-note="emit('update-active-note', $event)"
            @edit-note="(id) => emit('edit-note', id)"
            @delete-note="(id) => emit('delete-note', id ?? props.activeNote.id)"
          />

          <div class="glass-card rounded-[32px] p-6 shadow-xl animate-fade-in">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-[10px] lg:text-xs uppercase tracking-[0.3em] text-[var(--text-muted)] font-bold">Planner</p>
                <h3 class="text-lg lg:text-xl font-semibold text-[var(--text-main)]">{{ budgetTripPlans?.[0]?.title || 'Aucun voyage' }}</h3>
              </div>
              <button 
                class="tap-effect rounded-full border border-slate-200 dark:border-white/10 px-4 py-1.5 text-xs text-[var(--text-main)] hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                @click="plannerExpanded = !plannerExpanded"
              >
                {{ plannerExpanded ? 'Fermer' : 'Ouvrir' }}
              </button>
            </div>
            <p class="mt-3 text-xs lg:text-sm text-slate-500">
              {{ budgetTripPlans?.[0]?.startDate ? new Date(budgetTripPlans[0].startDate).toLocaleDateString() : 'Prochainement' }} · 
              Budget {{ budgetTripPlans?.[0]?.estimatedTotal || '0' }} € · 
              Banque {{ budgetTripPlans?.[0]?.linkedBankProfileId || 'N/A' }}
            </p>
            <div v-if="plannerExpanded" class="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 animate-fade-in">
               <button 
                class="w-full rounded-xl lg:rounded-2xl bg-indigo-600 py-3 text-white text-sm font-semibold tap-effect shadow-lg shadow-indigo-600/20"
                @click="forwardOpenPlanner('vacation')"
              >
                Gérer le voyage
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Settings & Budget Views -->
      <section v-if="mode === 'settings' || mode === 'budget'" class="animate-fade-in">
        <div v-if="mode === 'settings'" class="grid gap-6 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
          <ShortcutSettings />
          <div class="glass-card rounded-[32px] border border-dashed border-gray-200 bg-white/80 p-6 text-left">
            <p class="text-[10px] uppercase tracking-[0.3em] text-gray-400 font-bold">Bientôt disponible</p>
            <h3 class="mt-3 font-display text-xl text-ink">Gestion du compte</h3>
          </div>
        </div>

        <div v-else-if="mode === 'budget'">
          <BudgetWorkspace
            v-if="props.budgetSummary && props.budgetAccounts && props.budgetTransactions"
            :summary="props.budgetSummary"
            :accounts="props.budgetAccounts"
            :transactions="props.budgetTransactions"
            :alerts="props.budgetAlerts || []"
            :categories="props.budgetCategories || []"
            :category-options="props.budgetCategoryOptions || []"
            :notes="props.budgetNotes || []"
            :trip-plans="props.budgetTripPlans || []"
            :bank-profiles="props.budgetBankProfiles || []"
            @open-planner="forwardOpenPlanner"
            @close-planner="forwardClosePlanner"
            @refresh="() => emit('refresh-budget')"
          />
        </div>
      </section>
    </main>
  </div>
</template>
