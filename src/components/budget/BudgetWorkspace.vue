<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type {
  BudgetAccount,
  BudgetAccountInput,
  BudgetAlert,
  BudgetBankProfile,
  BudgetBankProfileInput,
  BudgetCategory,
  BudgetTransaction,
  BudgetTransactionInput,
  BudgetTransactionType,
  BudgetTripPlan,
  BudgetTripPlanInput,
  BudgetTripEstimateType,
} from '../../stores/useBudgetStore'

type PlannerMode = 'vacation' | 'bank'

interface BudgetSummary {
  totalBalance: number
  currency: string
  accountCount: number
  targets?: {
    label: string
    progress: number
    remaining: number
  } | null
}

interface CategoryBreakdown {
  id: string
  name: string
  total: number
  type: BudgetTransactionType
  color?: string
  icon?: string
}

type TransactionDisplay = BudgetTransaction & {
  accountName?: string
  categoryName?: string
  categoryColor?: string
  accountCurrency?: string
}

interface TripTransportDraft {
  id: string
  mode: string
  label: string
  cost: string
  notes: string
}

interface TripActivityDraft {
  id: string
  type: BudgetTripEstimateType
  label: string
  cost: string
  notes: string
}

interface TripAlertDraft {
  id: string
  label: string
  targetDate: string
  notifySystem: boolean
  status: 'todo' | 'done'
}

interface TripLodgingDraft {
  checkIn: string
  checkOut: string
  rate: string
}

interface BankProfileDraft {
  id: string | null
  bankName: string
  accountLabel: string
  accountNumber: string
  currency: string
  balance: string
  target: string
  notes: string
}

const DAY = 1000 * 60 * 60 * 24

const transportModes = [
  { value: 'train', label: 'Train' },
  { value: 'plane', label: 'Avion' },
  { value: 'car', label: 'Voiture' },
  { value: 'boat', label: 'Bateau' },
  { value: 'other', label: 'Autre' },
]

const activityTypes = [
  { value: 'activity', label: 'Activité' },
  { value: 'meal', label: 'Repas' },
  { value: 'souvenir', label: 'Souvenir' },
  { value: 'other', label: 'Autre' },
]

const props = defineProps<{
  summary: BudgetSummary
  accounts: BudgetAccount[]
  transactions: TransactionDisplay[]
  alerts: BudgetAlert[]
  categories: CategoryBreakdown[]
  categoryOptions: BudgetCategory[]
  notes: { id: string; title: string }[]
  tripPlans: BudgetTripPlan[]
  bankProfiles: BudgetBankProfile[]
  plannerOpen?: boolean
  plannerMode?: PlannerMode
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'create-account', payload: BudgetAccountInput & { target?: number | null; alertThreshold?: number | null }): void
  (e: 'update-account', payload: { accountId: string; input: Partial<BudgetAccountInput> & { target?: number | null; alertThreshold?: number | null } }): void
  (e: 'delete-account', accountId: string): void
  (e: 'create-transaction', payload: BudgetTransactionInput): void
  (e: 'update-transaction', payload: { transactionId: string; input: Partial<BudgetTransactionInput> }): void
  (e: 'delete-transaction', transactionId: string): void
  (e: 'link-transaction-note', payload: { transactionId: string; noteId: string | null }): void
  (e: 'save-trip', payload: BudgetTripPlanInput): void
  (e: 'delete-trip', planId: string): void
  (e: 'create-bank-profile', payload: BudgetBankProfileInput): void
  (e: 'update-bank-profile', payload: { profileId: string; input: Partial<BudgetBankProfileInput> }): void
  (e: 'delete-bank-profile', profileId: string): void
  (e: 'open-planner', mode: PlannerMode): void
  (e: 'close-planner'): void
  (e: 'refresh'): void
}>()

const accountForm = reactive({
  name: '',
  type: 'bank' as BudgetAccountInput['type'],
  currency: 'EUR',
  target: '',
  alertThreshold: '',
})

const showAccountForm = ref(false)
const editingAccountId = ref<string | null>(null)

const transactionForm = reactive({
  accountId: '',
  type: 'expense' as BudgetTransactionType,
  categoryId: '',
  amount: '',
  label: '',
  date: new Date().toISOString().slice(0, 10),
  noteId: '',
})

const showTransactionForm = ref(false)
const editingTransactionId = ref<string | null>(null)
const noteLinkingId = ref<string | null>(null)

const plannerOpen = computed(() => props.plannerOpen ?? false)
const plannerMode = computed<PlannerMode>(() => props.plannerMode ?? 'vacation')
const availableTripPlans = computed(() => props.tripPlans || [])
const availableBankProfiles = computed(() => props.bankProfiles || [])

const tripForm = reactive({
  id: null as string | null,
  title: '',
  startDate: '',
  endDate: '',
  transports: [] as TripTransportDraft[],
  lodgingEnabled: false,
  lodging: { checkIn: '', checkOut: '', rate: '' } as TripLodgingDraft,
  activities: [] as TripActivityDraft[],
  alerts: [] as TripAlertDraft[],
  linkedBankProfileId: '',
  notes: '',
})

const bankForm = reactive<BankProfileDraft>({
  id: null,
  bankName: '',
  accountLabel: '',
  accountNumber: '',
  currency: 'EUR',
  balance: '',
  target: '',
  notes: '',
})

function uuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const filteredCategories = computed(() => props.categoryOptions.filter((category) => category.type === transactionForm.type))

watch(
  () => props.summary.currency,
  (currency) => {
    if (!accountForm.currency) accountForm.currency = currency
    if (!bankForm.currency) bankForm.currency = currency
  },
  { immediate: true },
)

watch(
  () => transactionForm.type,
  () => {
    if (!filteredCategories.value.some((category) => category.id === transactionForm.categoryId)) {
      transactionForm.categoryId = filteredCategories.value[0]?.id || ''
    }
  },
  { immediate: true },
)

watch(
  () => props.accounts,
  (accounts) => {
    if (!accounts.some((account) => account.id === transactionForm.accountId)) {
      transactionForm.accountId = accounts[0]?.id || ''
    }
  },
  { immediate: true },
)

watch(
  availableBankProfiles,
  (profiles) => {
    if (!profiles.some((profile) => profile.id === tripForm.linkedBankProfileId)) {
      tripForm.linkedBankProfileId = ''
    }
  },
  { immediate: true },
)

watch(
  () => plannerOpen.value,
  (open) => {
    if (!open) {
      resetTripForm()
      resetBankForm()
      return
    }
    ensureTripFormArrays()
    if (plannerMode.value === 'vacation' && !tripForm.startDate) {
      const today = new Date().toISOString().slice(0, 10)
      tripForm.startDate = today
      tripForm.endDate = today
    }
    if (plannerMode.value === 'bank' && !bankForm.currency) {
      bankForm.currency = props.summary.currency
    }
  },
  { immediate: true },
)

watch(
  () => plannerMode.value,
  (mode) => {
    if (!plannerOpen.value) return
    if (mode === 'vacation') {
      ensureTripFormArrays()
    } else if (!bankForm.currency) {
      bankForm.currency = props.summary.currency
    }
  },
)

function ensureTripFormArrays() {
  if (!tripForm.transports.length) addTransportSegment()
  if (!tripForm.activities.length) addActivityEstimate()
  if (!tripForm.alerts.length) addAlertReminder()
}

function resetAccountForm() {
  accountForm.name = ''
  accountForm.type = 'bank'
  accountForm.currency = props.summary.currency
  accountForm.target = ''
  accountForm.alertThreshold = ''
  showAccountForm.value = false
}

function submitAccount() {
  if (!accountForm.name.trim()) return
  const payload = {
    name: accountForm.name.trim(),
    type: accountForm.type,
    currency: accountForm.currency || props.summary.currency,
    target: accountForm.target ? Number(accountForm.target) : null,
    alertThreshold: accountForm.alertThreshold ? Number(accountForm.alertThreshold) : null,
  }
  if (editingAccountId.value) {
    emit('update-account', { accountId: editingAccountId.value, input: payload })
  } else {
    emit('create-account', payload)
  }
  editingAccountId.value = null
  resetAccountForm()
}

function startEditAccount(account: BudgetAccount) {
  editingAccountId.value = account.id
  accountForm.name = account.name
  accountForm.type = account.type
  accountForm.currency = account.currency
  accountForm.target = account.target ? String(account.target) : ''
  accountForm.alertThreshold = account.alertThreshold ? String(account.alertThreshold) : ''
  showAccountForm.value = true
}

function cancelAccountEdit() {
  editingAccountId.value = null
  resetAccountForm()
}

function requestDeleteAccount(accountId: string) {
  if (window.confirm('Supprimer ce compte et ses transactions ?')) {
    emit('delete-account', accountId)
  }
}

function resetTransactionForm() {
  transactionForm.accountId = props.accounts[0]?.id || ''
  transactionForm.type = 'expense'
  transactionForm.categoryId = filteredCategories.value[0]?.id || ''
  transactionForm.amount = ''
  transactionForm.label = ''
  transactionForm.date = new Date().toISOString().slice(0, 10)
  transactionForm.noteId = ''
  showTransactionForm.value = false
}

function submitTransaction() {
  if (!transactionForm.accountId || !transactionForm.categoryId || !transactionForm.amount || !transactionForm.label.trim()) return
  const payload = {
    accountId: transactionForm.accountId,
    categoryId: transactionForm.categoryId,
    type: transactionForm.type,
    amount: Number(transactionForm.amount),
    label: transactionForm.label.trim(),
    date: new Date(transactionForm.date || new Date()).toISOString(),
    noteId: transactionForm.noteId || null,
  }
  if (editingTransactionId.value) {
    emit('update-transaction', { transactionId: editingTransactionId.value, input: payload })
  } else {
    emit('create-transaction', payload)
  }
  editingTransactionId.value = null
  resetTransactionForm()
}

function startEditTransaction(transaction: TransactionDisplay) {
  editingTransactionId.value = transaction.id
  transactionForm.accountId = transaction.accountId
  transactionForm.type = transaction.type
  transactionForm.categoryId = transaction.categoryId
  transactionForm.amount = String(transaction.amount)
  transactionForm.label = transaction.label
  transactionForm.date = transaction.date.slice(0, 10)
  transactionForm.noteId = transaction.noteId || ''
  showTransactionForm.value = true
}

function cancelTransactionEdit() {
  editingTransactionId.value = null
  resetTransactionForm()
}

function requestDeleteTransaction(transactionId: string) {
  if (window.confirm('Supprimer cette transaction ?')) {
    emit('delete-transaction', transactionId)
  }
}

function handleNoteLink(transactionId: string, event: Event) {
  const select = event.target as HTMLSelectElement
  emit('link-transaction-note', { transactionId, noteId: select.value || null })
  noteLinkingId.value = null
}

function toggleNoteSelector(transactionId: string) {
  noteLinkingId.value = noteLinkingId.value === transactionId ? null : transactionId
}

function addTransportSegment() {
  tripForm.transports.push({ id: uuid(), mode: 'train', label: '', cost: '', notes: '' })
}

function removeTransportSegment(id: string) {
  if (tripForm.transports.length === 1) return
  tripForm.transports = tripForm.transports.filter((segment) => segment.id !== id)
}

function addActivityEstimate() {
  tripForm.activities.push({ id: uuid(), type: 'activity', label: '', cost: '', notes: '' })
}

function removeActivityEstimate(id: string) {
  if (tripForm.activities.length === 1) return
  tripForm.activities = tripForm.activities.filter((activity) => activity.id !== id)
}

function addAlertReminder() {
  const today = new Date().toISOString().slice(0, 10)
  tripForm.alerts.push({ id: uuid(), label: '', targetDate: today, notifySystem: true, status: 'todo' })
}

function removeAlertReminder(id: string) {
  if (tripForm.alerts.length === 1) return
  tripForm.alerts = tripForm.alerts.filter((alert) => alert.id !== id)
}

function resetTripForm() {
  tripForm.id = null
  tripForm.title = ''
  tripForm.startDate = ''
  tripForm.endDate = ''
  tripForm.transports = []
  tripForm.activities = []
  tripForm.alerts = []
  tripForm.lodgingEnabled = false
  tripForm.lodging = { checkIn: '', checkOut: '', rate: '' }
  tripForm.linkedBankProfileId = ''
  tripForm.notes = ''
}

function populateTripForm(plan: BudgetTripPlan) {
  tripForm.id = plan.id
  tripForm.title = plan.title
  tripForm.startDate = plan.startDate.slice(0, 10)
  tripForm.endDate = plan.endDate.slice(0, 10)
  tripForm.transports = plan.transports.map((segment) => ({
    id: segment.id,
    mode: segment.mode,
    label: segment.label,
    cost: String(segment.cost),
    notes: segment.notes || '',
  }))
  tripForm.activities = plan.activities.map((activity) => ({
    id: activity.id,
    type: activity.type,
    label: activity.label,
    cost: String(activity.cost),
    notes: activity.notes || '',
  }))
  tripForm.alerts = plan.alerts.map((alert) => ({
    id: alert.id,
    label: alert.label,
    targetDate: alert.targetDate.slice(0, 10),
    notifySystem: alert.notifySystem,
    status: alert.status ?? 'todo',
  }))
  tripForm.lodgingEnabled = Boolean(plan.lodging)
  tripForm.lodging = {
    checkIn: plan.lodging?.checkIn?.slice(0, 10) || '',
    checkOut: plan.lodging?.checkOut?.slice(0, 10) || '',
    rate: plan.lodging ? String(plan.lodging.ratePerNight) : '',
  }
  tripForm.linkedBankProfileId = plan.linkedBankProfileId || ''
  tripForm.notes = plan.notes || ''
  ensureTripFormArrays()
}

function resetBankForm() {
  bankForm.id = null
  bankForm.bankName = ''
  bankForm.accountLabel = ''
  bankForm.accountNumber = ''
  bankForm.currency = props.summary.currency
  bankForm.balance = ''
  bankForm.target = ''
  bankForm.notes = ''
}

function populateBankForm(profile: BudgetBankProfile) {
  bankForm.id = profile.id
  bankForm.bankName = profile.bankName
  bankForm.accountLabel = profile.accountLabel
  bankForm.accountNumber = profile.accountNumber || ''
  bankForm.currency = profile.currency
  bankForm.balance = String(profile.balance)
  bankForm.target = profile.target ? String(profile.target) : ''
  bankForm.notes = profile.notes || ''
}

const tripDurationDays = computed(() => {
  if (!tripForm.startDate || !tripForm.endDate) return 0
  const start = new Date(tripForm.startDate).getTime()
  const end = new Date(tripForm.endDate).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0
  return Math.max(1, Math.ceil((end - start) / DAY))
})

const lodgingTotal = computed(() => {
  if (!tripForm.lodgingEnabled || !tripForm.lodging.checkIn || !tripForm.lodging.checkOut || !tripForm.lodging.rate) return 0
  const checkIn = new Date(tripForm.lodging.checkIn).getTime()
  const checkOut = new Date(tripForm.lodging.checkOut).getTime()
  if (Number.isNaN(checkIn) || Number.isNaN(checkOut) || checkOut <= checkIn) return 0
  const nights = Math.max(1, Math.ceil((checkOut - checkIn) / DAY))
  return Math.round(Number(tripForm.lodging.rate || 0) * nights * 100) / 100
})

const tripEstimates = computed(() => {
  const transport = tripForm.transports.reduce((sum, segment) => sum + (Number(segment.cost) || 0), 0)
  const activities = tripForm.activities.reduce((sum, activity) => sum + (Number(activity.cost) || 0), 0)
  const lodging = lodgingTotal.value
  const total = Math.round((transport + activities + lodging) * 100) / 100
  return { transport, activities, lodging, total }
})

function submitTripPlan() {
  if (!tripForm.title.trim() || !tripForm.startDate || !tripForm.endDate) return
  const payload: BudgetTripPlanInput = {
    id: tripForm.id || undefined,
    title: tripForm.title.trim(),
    startDate: new Date(tripForm.startDate).toISOString(),
    endDate: new Date(tripForm.endDate).toISOString(),
    transports: tripForm.transports.map((segment) => ({
      id: segment.id,
      mode: segment.mode,
      label: segment.label.trim() || 'Transport',
      cost: Number(segment.cost) || 0,
      notes: segment.notes?.trim() || undefined,
    })),
    lodging:
      tripForm.lodgingEnabled && tripForm.lodging.checkIn && tripForm.lodging.checkOut && tripForm.lodging.rate
        ? {
            checkIn: new Date(tripForm.lodging.checkIn).toISOString(),
            checkOut: new Date(tripForm.lodging.checkOut).toISOString(),
            ratePerNight: Number(tripForm.lodging.rate) || 0,
          }
        : null,
    activities: tripForm.activities.map((activity) => ({
      id: activity.id,
      type: activity.type,
      label: activity.label.trim() || 'Activité',
      cost: Number(activity.cost) || 0,
      notes: activity.notes?.trim() || undefined,
    })),
    alerts: tripForm.alerts.map((alert) => ({
      id: alert.id,
      label: alert.label.trim() || 'Rappel',
      targetDate: new Date(alert.targetDate).toISOString(),
      notifySystem: alert.notifySystem,
      status: alert.status,
    })),
    linkedBankProfileId: tripForm.linkedBankProfileId || null,
    notes: tripForm.notes?.trim() || undefined,
  }
  emit('save-trip', payload)
  emit('close-planner')
}

function submitBankProfile() {
  if (!bankForm.bankName.trim() || !bankForm.accountLabel.trim()) return
  const payload: BudgetBankProfileInput = {
    bankName: bankForm.bankName.trim(),
    accountLabel: bankForm.accountLabel.trim(),
    accountNumber: bankForm.accountNumber?.trim() || undefined,
    currency: bankForm.currency || props.summary.currency,
    balance: Number(bankForm.balance) || 0,
    target: bankForm.target ? Number(bankForm.target) : undefined,
    notes: bankForm.notes?.trim() || undefined,
  }
  if (bankForm.id) {
    emit('update-bank-profile', { profileId: bankForm.id, input: payload })
  } else {
    emit('create-bank-profile', payload)
  }
  emit('close-planner')
}

function startTripPlanning(plan?: BudgetTripPlan) {
  if (plan) {
    populateTripForm(plan)
  } else {
    resetTripForm()
    ensureTripFormArrays()
  }
  emit('open-planner', 'vacation')
}

function startBankPlanning(profile?: BudgetBankProfile) {
  if (profile) {
    populateBankForm(profile)
  } else {
    resetBankForm()
  }
  emit('open-planner', 'bank')
}

function requestDeleteTrip(planId: string) {
  if (window.confirm('Supprimer ce plan vacances ?')) {
    emit('delete-trip', planId)
  }
}

function requestDeleteBankProfile(profileId: string) {
  if (window.confirm('Supprimer ce compte bancaire ?')) {
    emit('delete-bank-profile', profileId)
  }
}

function cancelPlanner() {
  emit('close-planner')
}

function switchPlannerMode(mode: PlannerMode) {
  if (plannerMode.value === mode) return
  emit('open-planner', mode)
}
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-[32px] bg-[var(--color-bg-muted)] dark:bg-[var(--glass-bg)] p-6 border border-[var(--color-border)]">
      <div class="flex flex-wrap items-center gap-6">
        <div>
          <p class="text-xs uppercase tracking-[0.3em] text-[var(--color-text-secondary)]">Vue Budget</p>
          <h2 class="font-display text-3xl text-[var(--color-text-primary)]">Pilotage des comptes</h2>
          <p class="text-sm text-[var(--color-text-secondary)]">Soldes consolidés, transactions récentes et objectifs par typologie.</p>
        </div>
        <div class="ml-auto grid gap-4 sm:grid-cols-2">
          <div class="rounded-3xl bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] p-4 shadow-card border border-[var(--color-border)]">
            <p class="text-xs uppercase tracking-[0.3em] text-[var(--color-text-secondary)]">Solde total</p>
            <p class="mt-2 font-display text-2xl text-emerald-600">
              {{ new Intl.NumberFormat('fr-FR', { style: 'currency', currency: summary.currency }).format(summary.totalBalance) }}
            </p>
            <p class="text-xs text-[var(--color-text-secondary)]">{{ summary.accountCount }} comptes suivis</p>
          </div>
          <div class="rounded-3xl bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] p-4 shadow-card border border-[var(--color-border)]">
            <p class="text-xs uppercase tracking-[0.3em] text-[var(--color-text-secondary)]">Progression</p>
            <div class="mt-2">
              <div v-if="summary.targets" class="space-y-2">
                <p class="text-sm font-medium text-[var(--color-text-primary)]">{{ summary.targets.label }}</p>
                <div class="h-2 rounded-full bg-[var(--color-border)]">
                  <div class="h-full rounded-full bg-[var(--color-accent)]" :style="{ width: `${Math.min(100, summary.targets.progress)}%` }"></div>
                </div>
                <p class="text-xs text-[var(--color-text-secondary)]">{{ summary.targets.progress.toFixed(0) }}% – reste {{ summary.targets.remaining }}€</p>
              </div>
              <p v-else class="text-xs text-[var(--color-text-secondary)]">Définissez un objectif pour suivre vos budgets thématiques.</p>
            </div>
          </div>
        </div>
        <div class="flex flex-wrap gap-3">
          <button class="rounded-full bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-5 py-2 text-sm text-[var(--color-accent)] shadow-card border border-[var(--color-border)]" :disabled="loading" @click="emit('refresh')">
            Actualiser
          </button>
          <button class="flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm text-white shadow-card" @click="startTripPlanning()">
            <span>Planifier un budget</span>
            <span class="rounded-full bg-white/20 px-2 py-0.5 text-[11px]">⌘⇧N</span>
          </button>
          <button class="rounded-full bg-emerald-500 px-5 py-2 text-sm text-white shadow-card" @click="startBankPlanning()">
            Gérer les banques
          </button>
        </div>
      </div>
    </div>

    <div v-if="alerts.length" class="grid gap-3 rounded-[28px] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] p-5 shadow-card border border-[var(--color-border)]">
      <div class="flex items-center justify-between">
        <h3 class="font-display text-xl text-[var(--color-text-primary)]">Alertes</h3>
        <span class="rounded-full bg-rose-100 dark:bg-rose-900/30 px-3 py-1 text-xs text-rose-600">{{ alerts.length }} active(s)</span>
      </div>
      <ul class="space-y-2">
        <li
          v-for="alert in alerts"
          :key="alert.id"
          :class="[
            'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm',
            alert.severity === 'danger' ? 'bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300' : alert.severity === 'warning' ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300' : 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
          ]"
        >
          <span v-if="alert.severity === 'danger'">⚠️</span>
          <span v-else-if="alert.severity === 'warning'">⏳</span>
          <span v-else>✨</span>
          {{ alert.message }}
        </li>
      </ul>
    </div>

    <div class="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
      <section class="space-y-4 rounded-[28px] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] p-5 shadow-card border border-[var(--color-border)]">
        <div class="flex flex-wrap items-center gap-3">
          <div>
            <h3 class="font-display text-xl text-[var(--color-text-primary)]">Comptes</h3>
            <p class="text-xs uppercase tracking-[0.3em] text-[var(--color-text-secondary)]">{{ accounts.length }} suivi(s)</p>
          </div>
          <button
            class="ml-auto rounded-full border border-[var(--color-accent)]/50 px-4 py-1.5 text-sm text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
            @click="showAccountForm = !showAccountForm"
          >
            {{ showAccountForm ? 'Fermer le formulaire' : 'Ajouter un compte' }}
          </button>
        </div>
        <form v-if="showAccountForm" class="space-y-3 rounded-2xl bg-[var(--color-bg-muted)] dark:bg-[var(--glass-bg)] p-4 border border-[var(--color-border)]" @submit.prevent="submitAccount">
          <div class="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
            <span class="uppercase tracking-[0.3em]">{{ editingAccountId ? 'Modifier le compte' : 'Nouveau compte' }}</span>
            <button v-if="editingAccountId" type="button" class="text-rose-600 hover:underline" @click="cancelAccountEdit">Annuler</button>
          </div>
          <div class="grid gap-2 md:grid-cols-2">
            <input
              v-model="accountForm.name"
              type="text"
              placeholder="Nom du compte"
              class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            />
            <select v-model="accountForm.type" class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
              <option value="bank">Banque</option>
              <option value="vacation">Vacances</option>
              <option value="savings">Épargne</option>
              <option value="cash">Espèces</option>
            </select>
          </div>
          <div class="grid gap-2 md:grid-cols-3">
            <input v-model="accountForm.currency" type="text" placeholder="Devise" class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]" />
            <input v-model="accountForm.target" type="number" min="0" step="100" placeholder="Objectif" class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]" />
            <input
              v-model="accountForm.alertThreshold"
              type="number"
              min="0"
              step="50"
              placeholder="Seuil alerte"
              class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            />
          </div>
          <button class="w-full rounded-full bg-emerald-500 py-2 text-sm font-medium text-white" type="submit">
            {{ editingAccountId ? 'Sauvegarder' : 'Créer' }}
          </button>
        </form>
        <div class="grid gap-4 md:grid-cols-2">
          <article
            v-for="account in accounts"
            :key="account.id"
            class="rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-muted)] dark:bg-[var(--glass-bg)] p-4"
          >
            <div class="flex items-center justify-between">
              <div class="text-2xl">{{ account.icon || '💳' }}</div>
              <span class="rounded-full bg-[var(--color-bg-surface)] dark:bg-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text-secondary)]">{{ account.type }}</span>
            </div>
            <h4 class="mt-3 font-display text-lg text-[var(--color-text-primary)]">{{ account.name }}</h4>
            <p class="text-sm text-[var(--color-text-secondary)]">{{ account.description || 'Solde actuel' }}</p>
            <p class="mt-3 text-2xl font-semibold text-emerald-600">
              {{ new Intl.NumberFormat('fr-FR', { style: 'currency', currency: account.currency }).format(account.balance) }}
            </p>
            <div v-if="account.target" class="mt-2">
              <div class="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                <span>Objectif</span>
                <span>{{ Math.round((account.balance / account.target) * 100) }}%</span>
              </div>
              <div class="mt-1 h-2 rounded-full bg-[var(--color-border)]">
                <div class="h-full rounded-full bg-[var(--color-accent)]" :style="{ width: `${Math.min(100, (account.balance / account.target) * 100)}%` }"></div>
              </div>
            </div>
            <div class="mt-3 flex gap-2 text-xs">
              <button class="rounded-full border border-[var(--color-border)] px-3 py-1 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]" @click="startEditAccount(account)">
                Éditer
              </button>
              <button class="rounded-full border border-rose-200 dark:border-rose-800 px-3 py-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30" @click="requestDeleteAccount(account.id)">
                Supprimer
              </button>
            </div>
          </article>
        </div>
      </section>

      <section class="space-y-4 rounded-[28px] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] p-5 shadow-card border border-[var(--color-border)]">
        <h3 class="font-display text-xl text-[var(--color-text-primary)]">Catégories clés</h3>
        <ul class="space-y-3">
          <li v-for="category in categories" :key="category.id">
            <div class="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
              <div class="flex items-center gap-2">
                <span class="text-lg">{{ category.icon || '•' }}</span>
                <span>{{ category.name }}</span>
              </div>
              <span class="font-medium text-[var(--color-text-primary)]">
                {{ new Intl.NumberFormat('fr-FR', { style: 'currency', currency: summary.currency }).format(category.total) }}
              </span>
            </div>
            <div class="mt-1 h-2 rounded-full bg-[var(--color-border)]">
              <div class="h-full rounded-full bg-[var(--color-accent)]" :style="{ width: `${Math.min(100, (category.total / summary.totalBalance) * 100 || 0)}%` }"></div>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <div class="space-y-6">
      <section class="space-y-4 rounded-[28px] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] p-5 shadow-card border border-[var(--color-border)]">
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-3">
            <h3 class="font-display text-xl text-[var(--color-text-primary)]">Transactions</h3>
            <span class="rounded-full bg-[var(--color-bg-muted)] px-3 py-1 text-xs uppercase tracking-[0.3em] text-[var(--color-text-secondary)]">{{ transactions.length }} récente(s)</span>
          </div>
          <div class="ml-auto">
            <button
              class="rounded-full border border-[var(--color-accent)]/50 px-4 py-1.5 text-sm font-medium text-[var(--color-accent)] transition hover:bg-[var(--color-accent)]/10"
              @click="showTransactionForm = !showTransactionForm"
            >
              {{ showTransactionForm ? 'Masquer le formulaire' : 'Nouvelle transaction' }}
            </button>
          </div>
        </div>
        <form v-if="showTransactionForm" class="space-y-3 rounded-2xl bg-[var(--color-bg-muted)] dark:bg-[var(--glass-bg)] p-4 border border-[var(--color-border)]" @submit.prevent="submitTransaction">
          <div class="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
            <span class="uppercase tracking-[0.3em]">{{ editingTransactionId ? 'Modifier la transaction' : 'Nouvelle transaction' }}</span>
            <button v-if="editingTransactionId" type="button" class="text-rose-600 hover:underline" @click="cancelTransactionEdit">Annuler</button>
          </div>
          <div class="grid gap-2 md:grid-cols-2">
            <select v-model="transactionForm.accountId" class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
              <option disabled value="">Choisir un compte</option>
              <option v-for="account in accounts" :key="account.id" :value="account.id">{{ account.name }}</option>
            </select>
            <select v-model="transactionForm.type" class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
              <option value="expense">Dépense</option>
              <option value="income">Revenu</option>
            </select>
          </div>
          <div class="grid gap-2 md:grid-cols-2">
            <select v-model="transactionForm.categoryId" class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
              <option disabled value="">Catégorie</option>
              <option v-for="category in filteredCategories" :key="category.id" :value="category.id">{{ category.name }}</option>
            </select>
            <input v-model="transactionForm.label" type="text" placeholder="Libellé" class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]" />
          </div>
          <div class="grid gap-2 md:grid-cols-3">
            <input v-model="transactionForm.amount" type="number" min="0" step="0.01" placeholder="Montant" class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]" />
            <input v-model="transactionForm.date" type="date" class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]" />
            <select v-model="transactionForm.noteId" class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
              <option value="">Associer une note</option>
              <option v-for="note in notes" :key="note.id" :value="note.id">{{ note.title }}</option>
            </select>
          </div>
          <button class="w-full rounded-full bg-[var(--color-accent)] py-2 text-sm font-medium text-white" type="submit">
            {{ editingTransactionId ? 'Mettre à jour' : 'Enregistrer' }}
          </button>
        </form>
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm text-[var(--color-text-secondary)]">
            <thead>
              <tr class="text-xs uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
                <th class="py-2">Date</th>
                <th>Libellé</th>
                <th>Compte</th>
                <th>Catégorie</th>
                <th class="text-right">Montant</th>
                <th>Note liée</th>
                <th class="text-right">&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="transaction in transactions" :key="transaction.id" class="border-t border-[var(--color-border)]">
                <td class="py-3 text-[var(--color-text-secondary)]">{{ new Date(transaction.date).toLocaleDateString() }}</td>
                <td class="font-medium text-[var(--color-text-primary)]">{{ transaction.label }}</td>
                <td class="text-[var(--color-text-secondary)]">{{ transaction.accountName || '—' }}</td>
                <td>
                  <span class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs" :class="transaction.categoryColor || 'bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)]'">
                    {{ transaction.categoryName || 'N/A' }}
                  </span>
                </td>
                <td class="text-right font-semibold" :class="transaction.type === 'expense' ? 'text-rose-600' : 'text-emerald-600'">
                  {{ transaction.type === 'expense' ? '-' : '+' }}
                  {{
                    new Intl.NumberFormat('fr-FR', {
                      style: 'currency',
                      currency: transaction.accountCurrency || summary.currency,
                    }).format(transaction.amount)
                  }}
                </td>
                <td>
                  <select
                    class="w-full rounded-full border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-3 py-1 text-xs text-[var(--color-text-primary)]"
                    :value="transaction.noteId || ''"
                    @change="(event) => handleNoteLink(transaction.id, event)"
                  >
                    <option value="">Aucune</option>
                    <option v-for="note in notes" :key="note.id" :value="note.id">{{ note.title }}</option>
                  </select>
                </td>
                <td class="text-right">
                  <div class="flex justify-end gap-2 text-base">
                    <button
                      class="rounded-full bg-[var(--color-bg-muted)] px-2 py-1 text-xs text-[var(--color-text-secondary)] transition hover:bg-[var(--color-accent)] hover:text-white"
                      aria-label="Éditer"
                      @click="startEditTransaction(transaction)"
                    >
                      ✎
                    </button>
                    <button
                      class="rounded-full bg-rose-50 dark:bg-rose-900/30 px-2 py-1 text-xs text-rose-600 transition hover:bg-rose-100 dark:hover:bg-rose-900/50"
                      aria-label="Supprimer"
                      @click="requestDeleteTransaction(transaction.id)"
                    >
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="space-y-4 rounded-[28px] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] p-5 shadow-card border border-[var(--color-border)]">
        <div class="flex flex-wrap items-start gap-3">
          <div class="space-y-1">
            <h3 class="font-display text-xl text-[var(--color-text-primary)]">Planifications & banques</h3>
            <p class="text-sm text-[var(--color-text-secondary)]">Visualisez vos voyages à venir et les comptes qui les financent.</p>
          </div>
          <div class="ml-auto flex flex-wrap gap-2">
            <button class="rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm font-medium text-white shadow-sm" @click="startTripPlanning()">Plan vacances</button>
            <button class="rounded-full border border-emerald-400 dark:border-emerald-600 px-5 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30" @click="startBankPlanning()">Ajouter une banque</button>
          </div>
        </div>
        <div class="grid gap-4 xl:grid-cols-2">
          <div class="rounded-[26px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] dark:bg-[var(--glass-bg)] p-4 shadow-inner">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-lg">✈️</span>
                <div>
                  <p class="text-sm font-semibold text-[var(--color-text-primary)]">Plans vacances</p>
                  <p class="text-xs text-[var(--color-text-secondary)]">{{ availableTripPlans.length }} plan(s) suivi(s)</p>
                </div>
              </div>
            </div>
            <div v-if="!availableTripPlans.length" class="mt-4 rounded-2xl border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-text-secondary)]">
              Aucun plan enregistré pour le moment.
            </div>
            <div v-else class="mt-4 space-y-3 overflow-y-auto pr-1" style="max-height: 280px">
              <article
                v-for="plan in availableTripPlans"
                :key="plan.id"
                class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)]/60 p-4"
              >
                <div class="flex flex-wrap items-start gap-3">
                  <div class="space-y-1">
                    <p class="font-semibold text-[var(--color-text-primary)]">{{ plan.title }}</p>
                    <p class="text-xs text-[var(--color-text-secondary)]">
                      {{ new Date(plan.startDate).toLocaleDateString() }} → {{ new Date(plan.endDate).toLocaleDateString() }} · {{ plan.durationDays }} j
                    </p>
                    <p class="text-xs text-[var(--color-text-secondary)]">
                      Budget estimé
                      <span class="font-medium text-[var(--color-text-primary)]">
                        {{ new Intl.NumberFormat('fr-FR', { style: 'currency', currency: summary.currency }).format(plan.estimatedTotal) }}
                      </span>
                    </p>
                    <p v-if="plan.linkedBankProfileId" class="text-xs text-[var(--color-text-secondary)]">
                      Banque liée : {{ availableBankProfiles.find((profile) => profile.id === plan.linkedBankProfileId)?.bankName || '—' }}
                    </p>
                  </div>
                  <div class="ml-auto flex gap-2 text-xs">
                    <button class="rounded-full bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] border border-[var(--color-border)] px-3 py-1 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]" @click="startTripPlanning(plan)">Éditer</button>
                    <button class="rounded-full bg-rose-50 dark:bg-rose-900/30 px-3 py-1 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/50" @click="requestDeleteTrip(plan.id)">Suppr.</button>
                  </div>
                </div>
              </article>
            </div>
          </div>

          <div class="rounded-[26px] border border-[var(--color-border)] bg-[var(--color-bg-muted)] dark:bg-[var(--glass-bg)] p-4 shadow-inner">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-lg">🏦</span>
                <div>
                  <p class="text-sm font-semibold text-[var(--color-text-primary)]">Comptes bancaires</p>
                  <p class="text-xs text-[var(--color-text-secondary)]">{{ availableBankProfiles.length }} compte(s) suivi(s)</p>
                </div>
              </div>
            </div>
            <div v-if="!availableBankProfiles.length" class="mt-4 rounded-2xl border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-text-secondary)]">
              Ajoutez vos banques pour suivre les enveloppes dédiées au voyage.
            </div>
            <div v-else class="mt-4 space-y-3 overflow-y-auto pr-1" style="max-height: 280px">
              <article
                v-for="profile in availableBankProfiles"
                :key="profile.id"
                class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)]/60 p-4"
              >
                <div class="flex flex-wrap items-start gap-3">
                  <div class="space-y-1">
                    <p class="font-semibold text-[var(--color-text-primary)]">{{ profile.bankName }} · {{ profile.accountLabel }}</p>
                    <p class="text-xs text-[var(--color-text-secondary)]">
                      Solde
                      <span class="font-medium text-emerald-600">
                        {{ new Intl.NumberFormat('fr-FR', { style: 'currency', currency: profile.currency }).format(profile.balance) }}
                      </span>
                    </p>
                    <div v-if="profile.target" class="space-y-1 text-xs text-[var(--color-text-secondary)]">
                      <p>Objectif {{ new Intl.NumberFormat('fr-FR', { style: 'currency', currency: profile.currency }).format(profile.target) }}</p>
                      <div class="h-1.5 w-full rounded-full bg-[var(--color-border)]">
                        <div
                          class="h-full rounded-full bg-emerald-500"
                          :style="{ width: `${Math.min(100, (profile.balance / profile.target) * 100)}%` }"
                        ></div>
                      </div>
                    </div>
                    <p v-if="profile.notes" class="text-xs text-[var(--color-text-secondary)]">{{ profile.notes }}</p>
                  </div>
                  <div class="ml-auto flex gap-2 text-xs">
                    <button class="rounded-full bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] border border-[var(--color-border)] px-3 py-1 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]" @click="startBankPlanning(profile)">Éditer</button>
                    <button class="rounded-full bg-rose-50 dark:bg-rose-900/30 px-3 py-1 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/50" @click="requestDeleteBankProfile(profile.id)">Suppr.</button>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>
    </div>

    <transition name="fade">
      <div v-if="plannerOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div class="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[32px] bg-[var(--color-bg-surface)] dark:bg-[var(--surface)] p-6 shadow-2xl border border-[var(--color-border)]">
          <div class="flex flex-wrap items-center gap-3">
            <div>
              <p class="text-xs uppercase tracking-[0.3em] text-[var(--color-text-secondary)]">Assistant budget</p>
              <h3 class="font-display text-2xl text-[var(--color-text-primary)]">{{ plannerMode === 'vacation' ? 'Plan vacances' : 'Gestion bancaire' }}</h3>
            </div>
            <div class="ml-auto flex rounded-full border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-1 text-sm">
              <button
                class="rounded-full px-4 py-1"
                :class="plannerMode === 'vacation' ? 'bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-secondary)]'"
                @click="switchPlannerMode('vacation')"
              >
                Vacances
              </button>
              <button
                class="rounded-full px-4 py-1"
                :class="plannerMode === 'bank' ? 'bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-secondary)]'"
                @click="switchPlannerMode('bank')"
              >
                Banque
              </button>
            </div>
            <button class="rounded-full bg-[var(--color-bg-muted)] dark:bg-[var(--glass-bg)] border border-[var(--color-border)] px-3 py-1 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)]" @click="cancelPlanner">Fermer</button>
          </div>

          <div v-if="plannerMode === 'vacation'" class="mt-6 space-y-5">
            <div class="grid gap-3 md:grid-cols-2">
              <div class="space-y-2">
                <label class="text-xs uppercase tracking-[0.3em] text-[var(--color-text-secondary)]">Titre du voyage</label>
                <input v-model="tripForm.title" type="text" placeholder="Ex. Roadtrip Lisbonne" class="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-4 py-2 text-[var(--color-text-primary)]" />
              </div>
              <div class="space-y-2">
                <label class="text-xs uppercase tracking-[0.3em] text-[var(--color-text-secondary)]">Banque liée</label>
                <select v-model="tripForm.linkedBankProfileId" class="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-4 py-2 text-[var(--color-text-primary)]">
                  <option value="">Aucune</option>
                  <option v-for="profile in availableBankProfiles" :key="profile.id" :value="profile.id">{{ profile.bankName }} · {{ profile.accountLabel }}</option>
                </select>
              </div>
            </div>
            <div class="grid gap-3 md:grid-cols-3">
              <div class="space-y-2">
                <label class="text-xs uppercase tracking-[0.3em] text-[var(--color-text-secondary)]">Début</label>
                <input v-model="tripForm.startDate" type="date" class="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-4 py-2 text-[var(--color-text-primary)]" />
              </div>
              <div class="space-y-2">
                <label class="text-xs uppercase tracking-[0.3em] text-[var(--color-text-secondary)]">Fin</label>
                <input v-model="tripForm.endDate" type="date" class="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-4 py-2 text-[var(--color-text-primary)]" />
              </div>
              <div class="space-y-2">
                <label class="text-xs uppercase tracking-[0.3em] text-[var(--color-text-secondary)]">Durée estimée</label>
                <p class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-4 py-2 text-sm text-[var(--color-text-primary)]">{{ tripDurationDays }} jour(s)</p>
              </div>
            </div>

            <div class="space-y-3 rounded-2xl border border-dashed border-[var(--color-border)] p-4">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-semibold text-[var(--color-text-primary)]">Segments de transport</h4>
                <button class="text-sm text-[var(--color-accent)]" @click="addTransportSegment">+ Ajouter un segment</button>
              </div>
              <div v-for="segment in tripForm.transports" :key="segment.id" class="grid gap-2 md:grid-cols-[1fr,1fr,120px,auto]">
                <select v-model="segment.mode" class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
                  <option v-for="mode in transportModes" :key="mode.value" :value="mode.value">{{ mode.label }}</option>
                </select>
                <input v-model="segment.label" type="text" placeholder="Libellé" class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]" />
                <input v-model="segment.cost" type="number" min="0" step="10" placeholder="Coût (€)" class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]" />
                <div class="flex items-center gap-2">
                  <input v-model="segment.notes" type="text" placeholder="Notes" class="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]" />
                  <button class="text-rose-500 hover:text-rose-600" @click.prevent="removeTransportSegment(segment.id)">✕</button>
                </div>
              </div>
            </div>

            <div class="space-y-3 rounded-2xl border border-dashed border-[var(--color-border)] p-4">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-semibold text-[var(--color-text-primary)]">Hébergement</h4>
                <label class="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <input v-model="tripForm.lodgingEnabled" type="checkbox" class="rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]" />
                  Suivre les nuits
                </label>
              </div>
              <div v-if="tripForm.lodgingEnabled" class="grid gap-2 md:grid-cols-4">
                <input v-model="tripForm.lodging.checkIn" type="date" class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]" />
                <input v-model="tripForm.lodging.checkOut" type="date" class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]" />
                <input v-model="tripForm.lodging.rate" type="number" min="0" step="10" placeholder="€/nuit" class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]" />
                <p class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-3 py-2 text-sm text-[var(--color-text-primary)]">Total : {{ new Intl.NumberFormat('fr-FR', { style: 'currency', currency: summary.currency }).format(lodgingTotal) }}</p>
              </div>
            </div>

            <div class="space-y-3 rounded-2xl border border-dashed border-[var(--color-border)] p-4">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-semibold text-[var(--color-text-primary)]">Activités & repas</h4>
                <button class="text-sm text-[var(--color-accent)]" @click="addActivityEstimate">+ Ajouter une ligne</button>
              </div>
              <div v-for="activity in tripForm.activities" :key="activity.id" class="grid gap-2 md:grid-cols-[1fr,1fr,120px,auto]">
                <select v-model="activity.type" class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
                  <option v-for="type in activityTypes" :key="type.value" :value="type.value">{{ type.label }}</option>
                </select>
                <input v-model="activity.label" type="text" placeholder="Libellé" class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]" />
                <input v-model="activity.cost" type="number" min="0" step="10" placeholder="Coût (€)" class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]" />
                <div class="flex items-center gap-2">
                  <input v-model="activity.notes" type="text" placeholder="Notes" class="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]" />
                  <button class="text-rose-500 hover:text-rose-600" @click.prevent="removeActivityEstimate(activity.id)">✕</button>
                </div>
              </div>
            </div>

            <div class="space-y-3 rounded-2xl border border-dashed border-[var(--color-border)] p-4">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-semibold text-[var(--color-text-primary)]">Alertes & rappels</h4>
                <button class="text-sm text-[var(--color-accent)]" @click="addAlertReminder">+ Ajouter un rappel</button>
              </div>
              <div v-for="alert in tripForm.alerts" :key="alert.id" class="grid gap-2 md:grid-cols-[1fr,1fr,auto]">
                <input v-model="alert.label" type="text" placeholder="Ex. Réserver billets" class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]" />
                <div class="grid gap-2 md:grid-cols-2">
                  <input v-model="alert.targetDate" type="date" class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]" />
                  <select v-model="alert.status" class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
                    <option value="todo">À faire</option>
                    <option value="done">Terminé</option>
                  </select>
                </div>
                <div class="flex items-center gap-3">
                  <label class="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                    <input v-model="alert.notifySystem" type="checkbox" class="rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]" />
                    Notifier système
                  </label>
                  <button class="text-rose-500 hover:text-rose-600" @click.prevent="removeAlertReminder(alert.id)">✕</button>
                </div>
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-xs uppercase tracking-[0.3em] text-[var(--color-text-secondary)]">Notes</label>
              <textarea v-model="tripForm.notes" rows="3" placeholder="Informations additionnelles" class="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-4 py-2 text-[var(--color-text-primary)]"></textarea>
            </div>

            <div class="rounded-2xl bg-[var(--color-bg-muted)] dark:bg-[var(--glass-bg)] border border-[var(--color-border)] p-4 text-sm text-[var(--color-text-primary)]">
              <p class="font-semibold">Estimation globale : {{ new Intl.NumberFormat('fr-FR', { style: 'currency', currency: summary.currency }).format(tripEstimates.total) }}</p>
              <p class="text-xs text-[var(--color-text-secondary)]">Transport {{ new Intl.NumberFormat('fr-FR', { style: 'currency', currency: summary.currency }).format(tripEstimates.transport) }} · Activités {{ new Intl.NumberFormat('fr-FR', { style: 'currency', currency: summary.currency }).format(tripEstimates.activities) }} · Hébergement {{ new Intl.NumberFormat('fr-FR', { style: 'currency', currency: summary.currency }).format(tripEstimates.lodging) }}</p>
            </div>

            <div class="flex flex-wrap justify-end gap-3">
              <button class="rounded-full border border-[var(--color-border)] px-5 py-2 text-sm text-[var(--color-text-secondary)]" @click="cancelPlanner">Annuler</button>
              <button class="rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm text-white" @click="submitTripPlan">{{ tripForm.id ? 'Mettre à jour' : 'Créer le plan' }}</button>
            </div>
          </div>

          <div v-else class="mt-6 space-y-4">
            <div class="grid gap-3 md:grid-cols-2">
              <div class="space-y-2">
                <label class="text-xs uppercase tracking-[0.3em] text-[var(--color-text-secondary)]">Nom de la banque</label>
                <input v-model="bankForm.bankName" type="text" placeholder="Ex. Banque Nationale" class="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-4 py-2 text-[var(--color-text-primary)]" />
              </div>
              <div class="space-y-2">
                <label class="text-xs uppercase tracking-[0.3em] text-[var(--color-text-secondary)]">Libellé du compte</label>
                <input v-model="bankForm.accountLabel" type="text" placeholder="Courant / Épargne" class="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-4 py-2 text-[var(--color-text-primary)]" />
              </div>
            </div>
            <div class="grid gap-3 md:grid-cols-3">
              <div class="space-y-2">
                <label class="text-xs uppercase tracking-[0.3em] text-[var(--color-text-secondary)]">Numéro (facultatif)</label>
                <input v-model="bankForm.accountNumber" type="text" placeholder="IBAN" class="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-4 py-2 text-[var(--color-text-primary)]" />
              </div>
              <div class="space-y-2">
                <label class="text-xs uppercase tracking-[0.3em] text-[var(--color-text-secondary)]">Devise</label>
                <input v-model="bankForm.currency" type="text" class="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-4 py-2 text-[var(--color-text-primary)]" />
              </div>
              <div class="space-y-2">
                <label class="text-xs uppercase tracking-[0.3em] text-[var(--color-text-secondary)]">Objectif (€)</label>
                <input v-model="bankForm.target" type="number" min="0" step="100" class="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-4 py-2 text-[var(--color-text-primary)]" />
              </div>
            </div>
            <div class="grid gap-3 md:grid-cols-2">
              <div class="space-y-2">
                <label class="text-xs uppercase tracking-[0.3em] text-[var(--color-text-secondary)]">Solde suivi</label>
                <input v-model="bankForm.balance" type="number" min="0" step="10" class="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-4 py-2 text-[var(--color-text-primary)]" />
              </div>
              <div class="space-y-2">
                <label class="text-xs uppercase tracking-[0.3em] text-[var(--color-text-secondary)]">Notes</label>
                <textarea v-model="bankForm.notes" rows="3" placeholder="Commentaires, conditions…" class="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] dark:bg-[var(--glass-bg)] px-4 py-2 text-[var(--color-text-primary)]"></textarea>
              </div>
            </div>

            <div class="flex flex-wrap justify-end gap-3">
              <button class="rounded-full border border-[var(--color-border)] px-5 py-2 text-sm text-[var(--color-text-secondary)]" @click="cancelPlanner">Annuler</button>
              <button class="rounded-full bg-emerald-500 px-5 py-2 text-sm text-white" @click="submitBankProfile">{{ bankForm.id ? 'Mettre à jour' : 'Enregistrer la banque' }}</button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>
