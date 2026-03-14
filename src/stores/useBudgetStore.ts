import { computed, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'

export type BudgetAccountType = 'bank' | 'vacation' | 'savings' | 'cash'
export type BudgetTransactionType = 'income' | 'expense'
export type BudgetTripEstimateType = 'activity' | 'meal' | 'souvenir' | 'other'

export interface BudgetAccount {
  id: string
  name: string
  type: BudgetAccountType
  currency: string
  balance: number
  target?: number | null
  alertThreshold?: number | null
  icon?: string
  color?: string
  tags?: string[]
  description?: string
}

function defaultBankProfiles(): BudgetBankProfile[] {
  return [
    {
      id: cryptoId(),
      bankName: 'Banque Nationale',
      accountLabel: 'Courant perso',
      currency: 'EUR',
      balance: 2400,
      accountNumber: 'FR76 **** 1234',
      notes: 'Compte principal pour les dépenses quotidiennes',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]
}

export interface BudgetCategory {
  id: string
  name: string
  type: BudgetTransactionType
  color: string
  icon?: string
  parentId?: string | null
}

export interface BudgetTransaction {
  id: string
  accountId: string
  type: BudgetTransactionType
  amount: number
  categoryId: string
  label: string
  date: string
  noteId?: string | null
  memo?: string
}

export interface BudgetAlert {
  id: string
  message: string
  severity: 'info' | 'warning' | 'danger'
  accountId?: string
}

export interface BudgetPreferences {
  defaultCurrency: string
}

export interface BudgetBankProfile {
  id: string
  bankName: string
  accountLabel: string
  accountNumber?: string
  currency: string
  balance: number
  target?: number | null
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface BudgetBankProfileInput extends Partial<Omit<BudgetBankProfile, 'id' | 'createdAt' | 'updatedAt'>> {
  bankName: string
  accountLabel: string
  currency: string
  balance: number
}

export interface BudgetTripTransportSegmentInput {
  id?: string
  mode: string
  label: string
  cost: number
  notes?: string
}

export interface BudgetTripLodgingInput {
  checkIn: string
  checkOut: string
  ratePerNight: number
}

export interface BudgetTripActivityEstimateInput {
  id?: string
  label: string
  type: BudgetTripEstimateType
  cost: number
  notes?: string
}

export interface BudgetTripAlertInput {
  id?: string
  label: string
  targetDate: string
  notifySystem: boolean
  status?: 'todo' | 'done'
}

export interface BudgetTripPlanInput {
  id?: string
  title: string
  startDate: string
  endDate: string
  transports: BudgetTripTransportSegmentInput[]
  lodging?: BudgetTripLodgingInput | null
  activities: BudgetTripActivityEstimateInput[]
  alerts: BudgetTripAlertInput[]
  linkedBankProfileId?: string | null
  notes?: string
}

export interface BudgetTripTransportSegment extends Omit<BudgetTripTransportSegmentInput, 'id'> {
  id: string
}

export interface BudgetTripLodging extends BudgetTripLodgingInput {
  totalNights: number
  totalCost: number
}

export interface BudgetTripActivityEstimate extends Omit<BudgetTripActivityEstimateInput, 'id'> {
  id: string
}

export interface BudgetTripAlert extends Omit<BudgetTripAlertInput, 'id'> {
  id: string
}

export interface BudgetTripPlan {
  id: string
  title: string
  startDate: string
  endDate: string
  durationDays: number
  transports: BudgetTripTransportSegment[]
  lodging?: BudgetTripLodging | null
  activities: BudgetTripActivityEstimate[]
  alerts: BudgetTripAlert[]
  linkedBankProfileId?: string | null
  estimatedTotal: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface BudgetAccountInput extends Partial<Omit<BudgetAccount, 'id' | 'balance'>> {
  name: string
  type: BudgetAccountType
  currency: string
}

export interface BudgetTransactionInput extends Omit<BudgetTransaction, 'id'> {}

export interface BudgetData {
  accounts: BudgetAccount[]
  transactions: BudgetTransaction[]
  categories: BudgetCategory[]
  preferences: BudgetPreferences
  bankProfiles: BudgetBankProfile[]
  tripPlans: BudgetTripPlan[]
}

const DEFAULT_BUDGET_DATA: BudgetData = {
  accounts: [],
  transactions: [],
  categories: [],
  preferences: { defaultCurrency: 'EUR' },
  bankProfiles: [],
  tripPlans: [],
}

const budgetState = ref<BudgetData>(structuredClone(DEFAULT_BUDGET_DATA))
const loading = ref(false)
const error = ref<string | null>(null)
const isTauri = typeof window !== 'undefined' && '__TAURI_IPC__' in window
const MOCK_STORAGE_KEY = 'le-bocal-budget'

export function useBudgetStore() {
  const accounts = computed(() => budgetState.value.accounts)
  const transactions = computed(() =>
    [...budgetState.value.transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  )
  const categories = computed(() => budgetState.value.categories)
  const bankProfiles = computed(() => budgetState.value.bankProfiles)
  const tripPlans = computed(() => budgetState.value.tripPlans)
  const preferences = computed(() => budgetState.value.preferences)

  const totalBalance = computed(() => budgetState.value.accounts.reduce((sum, account) => sum + account.balance, 0))

  const alerts = computed<BudgetAlert[]>(() => {
    const list: BudgetAlert[] = []
    for (const account of budgetState.value.accounts) {
      if (typeof account.alertThreshold === 'number' && account.balance <= account.alertThreshold) {
        list.push({
          id: `alert-${account.id}`,
          accountId: account.id,
          severity: 'warning',
          message: `${account.name} approche du seuil (${formatCurrency(account.balance, account.currency)})`,
        })
      }
      if (account.target && account.balance >= account.target) {
        list.push({
          id: `target-${account.id}`,
          accountId: account.id,
          severity: 'info',
          message: `${account.name} a atteint son objectif (${formatCurrency(account.balance, account.currency)})`,
        })
      }
    }
    return list
  })

  async function refresh() {
    loading.value = true
    error.value = null
    try {
      const data = await invokeOrMock<BudgetData>('get_budget_data')
      budgetState.value = normalizeBudgetData(data)
    } catch (err) {
      error.value = formatError(err)
    } finally {
      loading.value = false
    }
  }

  async function createAccount(input: BudgetAccountInput) {
    await callAndHydrate('create_budget_account', { input })
  }

  async function updateAccount(accountId: string, input: Partial<BudgetAccountInput>) {
    await callAndHydrate('update_budget_account', { account_id: accountId, accountId, input })
  }

  async function deleteAccount(accountId: string) {
    await callAndHydrate('delete_budget_account', { account_id: accountId, accountId })
  }

  async function recordTransaction(input: BudgetTransactionInput) {
    await callAndHydrate('record_budget_transaction', { input })
  }

  async function updateTransaction(transactionId: string, input: Partial<BudgetTransactionInput>) {
    await callAndHydrate('update_budget_transaction', { transaction_id: transactionId, transactionId, input })
  }

  async function deleteTransaction(transactionId: string) {
    await callAndHydrate('delete_budget_transaction', { transaction_id: transactionId, transactionId })
  }

  async function linkTransactionToNote(transactionId: string, noteId: string | null) {
    await callAndHydrate('link_budget_transaction_note', { transaction_id: transactionId, transactionId, note_id: noteId, noteId })
  }

  async function saveTripPlan(input: BudgetTripPlanInput) {
    await callAndHydrate('save_budget_trip_plan', { input })
  }

  async function deleteTripPlan(planId: string) {
    await callAndHydrate('delete_budget_trip_plan', { plan_id: planId, planId })
  }

  async function createBankProfile(input: BudgetBankProfileInput) {
    await callAndHydrate('create_bank_profile', { input })
  }

  async function updateBankProfile(profileId: string, input: Partial<BudgetBankProfileInput>) {
    await callAndHydrate('update_bank_profile', { profile_id: profileId, profileId, input })
  }

  async function deleteBankProfile(profileId: string) {
    await callAndHydrate('delete_bank_profile', { profile_id: profileId, profileId })
  }

  async function callAndHydrate(command: string, args?: Record<string, unknown>) {
    loading.value = true
    error.value = null
    try {
      const data = await invokeOrMock<BudgetData>(command, args)
      budgetState.value = normalizeBudgetData(data)
    } catch (err) {
      error.value = formatError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    accounts,
    transactions,
    categories,
    preferences,
    bankProfiles,
    tripPlans,
    alerts,
    totalBalance,
    loading,
    error,
    refresh,
    createAccount,
    updateAccount,
    deleteAccount,
    recordTransaction,
    updateTransaction,
    deleteTransaction,
    linkTransactionToNote,
    saveTripPlan,
    deleteTripPlan,
    createBankProfile,
    updateBankProfile,
    deleteBankProfile,
  }
}

function normalizeBudgetData(data: BudgetData): BudgetData {
  return {
    accounts: Array.isArray(data.accounts) ? data.accounts : [],
    transactions: Array.isArray(data.transactions) ? data.transactions : [],
    categories: Array.isArray(data.categories) ? data.categories : [],
    preferences: data.preferences || { defaultCurrency: 'EUR' },
    bankProfiles: Array.isArray(data.bankProfiles) ? data.bankProfiles : [],
    tripPlans: Array.isArray(data.tripPlans) ? data.tripPlans : [],
  }
}

async function invokeOrMock<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    return invoke<T>(command, args)
  }
  return mockInvoke<T>(command, args)
}

async function mockInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const data = getMockBudget()
  const write = (next: BudgetData) => {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(next))
    return normalizeBudgetData(next)
  }

  switch (command) {
    case 'get_budget_data':
      return normalizeBudgetData(data) as T
    case 'create_budget_account': {
      const input = (args?.input as BudgetAccountInput) || {
        name: 'Nouveau compte',
        type: 'bank',
        currency: data.preferences.defaultCurrency,
      }
      const nextAccount = createAccountRecord(input)
      return write({ ...data, accounts: [nextAccount, ...data.accounts] }) as T
    }
    case 'update_budget_account': {
      const accountId = (args?.account_id ?? args?.accountId) as string
      const input = (args?.input as Partial<BudgetAccountInput>) || {}
      const nextAccounts = data.accounts.map((account) =>
        account.id === accountId
          ? {
              ...account,
              ...input,
            }
          : account,
      )
      return write({ ...data, accounts: nextAccounts }) as T
    }
    case 'delete_budget_account': {
      const accountId = (args?.account_id ?? args?.accountId) as string
      const remainingAccounts = data.accounts.filter((account) => account.id !== accountId)
      const remainingTransactions = data.transactions.filter((transaction) => transaction.accountId !== accountId)
      return write({ ...data, accounts: remainingAccounts, transactions: remainingTransactions }) as T
    }
    case 'record_budget_transaction': {
      const input = args?.input as BudgetTransactionInput
      if (!input) return normalizeBudgetData(data) as T
      const transaction = createTransactionRecord(input)
      const updatedAccounts = applyTransaction(data.accounts, transaction, 1)
      return write({ ...data, accounts: updatedAccounts, transactions: [transaction, ...data.transactions] }) as T
    }
    case 'update_budget_transaction': {
      const transactionId = (args?.transaction_id ?? args?.transactionId) as string
      const input = (args?.input as Partial<BudgetTransactionInput>) || {}
      const existing = data.transactions.find((txn) => txn.id === transactionId)
      if (!existing) return normalizeBudgetData(data) as T
      const revertedAccounts = applyTransaction(data.accounts, existing, -1)
      const updatedTransaction = { ...existing, ...input }
      const reappliedAccounts = applyTransaction(revertedAccounts, updatedTransaction, 1)
      const nextTransactions = data.transactions.map((txn) => (txn.id === transactionId ? updatedTransaction : txn))
      return write({ ...data, accounts: reappliedAccounts, transactions: nextTransactions }) as T
    }
    case 'delete_budget_transaction': {
      const transactionId = (args?.transaction_id ?? args?.transactionId) as string
      const existing = data.transactions.find((txn) => txn.id === transactionId)
      if (!existing) return normalizeBudgetData(data) as T
      const updatedAccounts = applyTransaction(data.accounts, existing, -1)
      const nextTransactions = data.transactions.filter((txn) => txn.id !== transactionId)
      return write({ ...data, accounts: updatedAccounts, transactions: nextTransactions }) as T
    }
    case 'link_budget_transaction_note': {
      const transactionId = (args?.transaction_id ?? args?.transactionId) as string
      const noteId = (args?.note_id ?? args?.noteId) as string | null
      const nextTransactions = data.transactions.map((txn) => (txn.id === transactionId ? { ...txn, noteId } : txn))
      return write({ ...data, transactions: nextTransactions }) as T
    }
    case 'save_budget_trip_plan': {
      const input = (args?.input as BudgetTripPlanInput) || null
      if (!input) return normalizeBudgetData(data) as T
      const nextPlans = upsertTripPlanRecord(data.tripPlans, input)
      return write({ ...data, tripPlans: nextPlans }) as T
    }
    case 'delete_budget_trip_plan': {
      const planId = (args?.plan_id ?? args?.planId) as string
      const nextPlans = data.tripPlans.filter((plan) => plan.id !== planId)
      return write({ ...data, tripPlans: nextPlans }) as T
    }
    case 'create_bank_profile': {
      const input = (args?.input as BudgetBankProfileInput) || null
      if (!input) return normalizeBudgetData(data) as T
      const nextProfile = createBankProfileRecord(input)
      return write({ ...data, bankProfiles: [nextProfile, ...data.bankProfiles] }) as T
    }
    case 'update_bank_profile': {
      const profileId = (args?.profile_id ?? args?.profileId) as string
      const input = (args?.input as Partial<BudgetBankProfileInput>) || {}
      const nextProfiles = data.bankProfiles.map((profile) => (profile.id === profileId ? { ...profile, ...input, updatedAt: new Date().toISOString() } : profile))
      return write({ ...data, bankProfiles: nextProfiles }) as T
    }
    case 'delete_bank_profile': {
      const profileId = (args?.profile_id ?? args?.profileId) as string
      const nextProfiles = data.bankProfiles.filter((profile) => profile.id !== profileId)
      return write({ ...data, bankProfiles: nextProfiles }) as T
    }
    default:
      throw new Error(`Commande budget ${command} indisponible hors Tauri`)
  }
}

function getMockBudget(): BudgetData {
  const raw = localStorage.getItem(MOCK_STORAGE_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      return ensureBudgetDefaults(parsed)
    } catch {
      return ensureBudgetDefaults({})
    }
  }
  const initial = ensureBudgetDefaults({})
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(initial))
  return initial
}

function ensureBudgetDefaults(data: Partial<BudgetData>): BudgetData {
  const accounts = Array.isArray(data.accounts) && data.accounts.length ? data.accounts : defaultAccounts()
  const categories = Array.isArray(data.categories) && data.categories.length ? data.categories : defaultCategories()
  const transactions = Array.isArray(data.transactions) && data.transactions.length ? data.transactions : defaultTransactions(accounts, categories)
  const preferences = data.preferences || { defaultCurrency: 'EUR' }
  const bankProfiles = Array.isArray(data.bankProfiles) ? data.bankProfiles : defaultBankProfiles()
  const tripPlans = Array.isArray(data.tripPlans) ? data.tripPlans : []
  return { accounts, transactions, categories, preferences, bankProfiles, tripPlans }
}

function defaultAccounts(): BudgetAccount[] {
  return [
    {
      id: cryptoId(),
      name: 'Compte courant',
      type: 'bank',
      currency: 'EUR',
      balance: 2400,
      alertThreshold: 500,
      icon: '🏦',
      tags: ['Maison'],
      description: 'Dépenses quotidiennes',
    },
    {
      id: cryptoId(),
      name: 'Budget vacances',
      type: 'vacation',
      currency: 'EUR',
      balance: 1800,
      target: 2500,
      icon: '🏖️',
      color: 'bg-amber-50 text-amber-600',
      tags: ['Voyage'],
    },
    {
      id: cryptoId(),
      name: 'Épargne de précaution',
      type: 'savings',
      currency: 'EUR',
      balance: 5200,
      target: 8000,
      icon: '💎',
      tags: ['Sécurité'],
    },
  ]
}

function defaultCategories(): BudgetCategory[] {
  return [
    { id: 'cat-1', name: 'Salaire', type: 'income', color: 'bg-emerald-50 text-emerald-700', icon: '💼' },
    { id: 'cat-2', name: 'Hébergement', type: 'expense', color: 'bg-indigo-50 text-indigo-700', icon: '🏨', parentId: 'vacances' },
    { id: 'cat-3', name: 'Transport', type: 'expense', color: 'bg-sky-50 text-sky-600', icon: '✈️', parentId: 'vacances' },
    { id: 'cat-4', name: 'Frais bancaires', type: 'expense', color: 'bg-rose-50 text-rose-600', icon: '🏦' },
    { id: 'cat-5', name: 'Intérêts', type: 'income', color: 'bg-amber-50 text-amber-600', icon: '📈' },
  ]
}

function defaultTransactions(accounts: BudgetAccount[], categories: BudgetCategory[]): BudgetTransaction[] {
  if (!accounts.length || !categories.length) return []
  const courant = accounts[0]
  const vacances = accounts[1] || accounts[0]
  return [
    {
      id: cryptoId(),
      accountId: courant.id,
      type: 'income',
      amount: 3200,
      categoryId: categories[0].id,
      label: 'Salaire Mars',
      date: new Date().toISOString(),
    },
    {
      id: cryptoId(),
      accountId: vacances.id,
      type: 'expense',
      amount: 450,
      categoryId: categories[1].id,
      label: 'Acompte hôtel Lisbonne',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    },
    {
      id: cryptoId(),
      accountId: vacances.id,
      type: 'expense',
      amount: 180,
      categoryId: categories[2].id,
      label: 'Billets train Porto',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    },
  ]
}

function createAccountRecord(input: BudgetAccountInput): BudgetAccount {
  return {
    id: cryptoId(),
    balance: 0,
    target: input.target ?? null,
    alertThreshold: input.alertThreshold ?? null,
    icon: input.icon,
    color: input.color,
    tags: input.tags,
    description: input.description,
    ...input,
  }
}

function createTransactionRecord(input: BudgetTransactionInput): BudgetTransaction {
  return {
    id: cryptoId(),
    noteId: input.noteId ?? null,
    memo: input.memo,
    ...input,
  }
}

function createBankProfileRecord(input: BudgetBankProfileInput): BudgetBankProfile {
  const now = new Date().toISOString()
  return {
    id: cryptoId(),
    target: input.target ?? null,
    notes: input.notes,
    accountNumber: input.accountNumber,
    ...input,
    createdAt: now,
    updatedAt: now,
  }
}

function upsertTripPlanRecord(existingPlans: BudgetTripPlan[], input: BudgetTripPlanInput): BudgetTripPlan[] {
  const now = new Date().toISOString()
  const baseId = input.id || cryptoId()
  const transports: BudgetTripTransportSegment[] = (input.transports || []).map((segment) => ({
    id: segment.id || cryptoId(),
    mode: segment.mode,
    label: segment.label,
    cost: Math.max(0, Math.round(segment.cost * 100) / 100),
    notes: segment.notes,
  }))
  const activities: BudgetTripActivityEstimate[] = (input.activities || []).map((activity) => ({
    id: activity.id || cryptoId(),
    label: activity.label,
    type: activity.type,
    cost: Math.max(0, Math.round(activity.cost * 100) / 100),
    notes: activity.notes,
  }))
  const alerts: BudgetTripAlert[] = (input.alerts || []).map((alert) => ({
    id: alert.id || cryptoId(),
    label: alert.label,
    targetDate: alert.targetDate,
    notifySystem: alert.notifySystem,
    status: alert.status ?? 'todo',
  }))
  const lodging = input.lodging
    ? (() => {
        const checkIn = input.lodging!.checkIn
        const checkOut = input.lodging!.checkOut
        const nights = Math.max(0, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)))
        const rate = Math.max(0, input.lodging!.ratePerNight)
        return {
          checkIn,
          checkOut,
          ratePerNight: rate,
          totalNights: nights,
          totalCost: Math.round(rate * nights * 100) / 100,
        }
      })()
    : null

  const transportTotal = transports.reduce((sum, segment) => sum + segment.cost, 0)
  const activityTotal = activities.reduce((sum, activity) => sum + activity.cost, 0)
  const lodgingTotal = lodging?.totalCost ?? 0
  const estimatedTotal = Math.round((transportTotal + activityTotal + lodgingTotal) * 100) / 100
  const durationDays = Math.max(0, Math.ceil((new Date(input.endDate).getTime() - new Date(input.startDate).getTime()) / (1000 * 60 * 60 * 24)))

  const nextPlan: BudgetTripPlan = {
    id: baseId,
    title: input.title,
    startDate: input.startDate,
    endDate: input.endDate,
    durationDays,
    transports,
    lodging,
    activities,
    alerts,
    linkedBankProfileId: input.linkedBankProfileId || null,
    estimatedTotal,
    notes: input.notes,
    createdAt: input.id ? existingPlans.find((plan) => plan.id === input.id)?.createdAt || now : now,
    updatedAt: now,
  }

  if (input.id) {
    return existingPlans.map((plan) => (plan.id === input.id ? nextPlan : plan))
  }
  return [nextPlan, ...existingPlans]
}

function applyTransaction(accounts: BudgetAccount[], transaction: BudgetTransaction, direction: 1 | -1) {
  return accounts.map((account) => {
    if (account.id !== transaction.accountId) return account
    const sign = transaction.type === 'expense' ? -1 : 1
    const delta = direction * sign * transaction.amount
    return { ...account, balance: Math.round((account.balance + delta) * 100) / 100 }
  })
}

function cryptoId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount)
}

function formatError(err: unknown): string {
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message
  return 'Une erreur budget est survenue'
}
