<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import DesktopWorkspace from './components/layout/DesktopWorkspace.vue'
import { useNotesStore } from './stores/useNotesStore'
import type { Task, NoteUpdatePayload, Block } from './stores/useNotesStore'
import { useBudgetStore } from './stores/useBudgetStore'
import type {
  BudgetAccountInput,
  BudgetTransactionInput,
  BudgetTransaction,
  BudgetTripPlanInput,
  BudgetBankProfileInput,
} from './stores/useBudgetStore'
import NotesList from './components/notes/NotesList.vue'
import { useFeedback } from './composables/useFeedback'
import ActiveNotePanel from './components/notes/ActiveNotePanel.vue'
import { useCommandShortcuts } from './composables/useCommandShortcuts'
import type { CommandId } from './composables/useCommandShortcuts'
import { useEditorBridge, type EditorActions } from './composables/useEditorBridge'

const baseNav = [
  { label: 'Tableau de bord', icon: '🏠' },
  { label: 'Notes', icon: '🗒️' },
  { label: 'Budget', icon: '💶' },
  { label: 'Paramètres', icon: '⚙️' },
]

const store = useNotesStore()
const budgetStore = useBudgetStore()
const showAllNotes = ref(false)
const showEditorModal = ref(false)
const createNoteDialogOpen = ref(false)
const createNoteTitle = ref('Nouvelle note')
const createNoteLoading = ref(false)
const pendingDeleteId = ref<string | null>(null)
const activeNav = ref('Tableau de bord')
const lastSyncAt = ref<number | null>(null)
const { toasts, logs, showToast, dismissToast, pushLog } = useFeedback()
const initialSyncCompleted = ref(false)
const { matchEventToCommand, getShortcut, formatShortcutLabel } = useCommandShortcuts()
const { editorEntry } = useEditorBridge()
type PlannerMode = 'vacation' | 'bank'

const toastVariants: Record<string, string> = {
  info: 'bg-ink text-white',
  success: 'bg-emerald-500 text-white',
  error: 'bg-rose-600 text-white',
}

function handleOpenBudgetPlanner(mode: PlannerMode) {
  openBudgetPlanner(mode)
}

function handleCloseBudgetPlanner() {
  closeBudgetPlanner()
}

async function handleCreateBudgetAccount(payload: BudgetAccountInput & { target?: number | null; alertThreshold?: number | null }) {
  try {
    await budgetStore.createAccount(payload)
    showToast('Compte budget créé', 'success')
    pushLog('success', `Compte créé : ${payload.name}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Impossible de créer le compte"
    showToast(message, 'error')
    pushLog('error', message)
  }
}

async function handleCreateBudgetTransaction(payload: BudgetTransactionInput) {
  try {
    await budgetStore.recordTransaction(payload)
    showToast('Transaction enregistrée', 'success')
    pushLog('success', `Transaction ${payload.type === 'expense' ? 'débit' : 'crédit'} enregistrée`)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Impossible d'enregistrer la transaction"
    showToast(message, 'error')
    pushLog('error', message)
  }
}

async function handleUpdateBudgetAccount({ accountId, input }: { accountId: string; input: Partial<BudgetAccountInput> & { target?: number | null; alertThreshold?: number | null } }) {
  try {
    await budgetStore.updateAccount(accountId, input)
    showToast('Compte mis à jour', 'success')
    pushLog('success', `Compte mis à jour : ${input.name || accountId}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Impossible de mettre à jour le compte'
    showToast(message, 'error')
    pushLog('error', message)
  }
}

async function handleDeleteBudgetAccount(accountId: string) {
  try {
    await budgetStore.deleteAccount(accountId)
    showToast('Compte supprimé', 'info')
    pushLog('info', `Compte supprimé : ${accountId}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Suppression du compte impossible'
    showToast(message, 'error')
    pushLog('error', message)
  }
}

async function handleUpdateBudgetTransaction({ transactionId, input }: { transactionId: string; input: Partial<BudgetTransactionInput> }) {
  try {
    await budgetStore.updateTransaction(transactionId, input)
    showToast('Transaction mise à jour', 'success')
    pushLog('success', `Transaction mise à jour : ${transactionId}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Impossible de mettre à jour la transaction'
    showToast(message, 'error')
    pushLog('error', message)
  }
}

async function handleDeleteBudgetTransaction(transactionId: string) {
  try {
    await budgetStore.deleteTransaction(transactionId)
    showToast('Transaction supprimée', 'info')
    pushLog('info', `Transaction supprimée : ${transactionId}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Suppression de la transaction impossible'
    showToast(message, 'error')
    pushLog('error', message)
  }
}

async function handleLinkBudgetTransactionNote({ transactionId, noteId }: { transactionId: string; noteId: string | null }) {
  try {
    await budgetStore.linkTransactionToNote(transactionId, noteId)
    showToast(noteId ? 'Transaction associée à la note' : 'Association retirée', 'success')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Association impossible'
    showToast(message, 'error')
    pushLog('error', message)
  }
}

async function handleSaveBudgetTripPlan(payload: BudgetTripPlanInput) {
  try {
    await budgetStore.saveTripPlan(payload)
    showToast(payload.id ? 'Plan vacances mis à jour' : 'Plan vacances enregistré', 'success')
    pushLog('success', `Plan vacances ${payload.id ? 'mis à jour' : 'créé'} : ${payload.title}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Impossible de sauvegarder le plan vacances'
    showToast(message, 'error')
    pushLog('error', message)
  }
}

async function handleDeleteBudgetTripPlan(planId: string) {
  try {
    await budgetStore.deleteTripPlan(planId)
    showToast('Plan vacances supprimé', 'info')
    pushLog('info', `Plan vacances supprimé : ${planId}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Impossible de supprimer le plan'
    showToast(message, 'error')
    pushLog('error', message)
  }
}

async function handleCreateBankProfile(payload: BudgetBankProfileInput) {
  try {
    await budgetStore.createBankProfile(payload)
    showToast('Banque ajoutée', 'success')
    pushLog('success', `Banque ajoutée : ${payload.bankName}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Impossible de créer le compte bancaire'
    showToast(message, 'error')
    pushLog('error', message)
  }
}

async function handleUpdateBankProfile({ profileId, input }: { profileId: string; input: Partial<BudgetBankProfileInput> }) {
  try {
    await budgetStore.updateBankProfile(profileId, input)
    showToast('Banque mise à jour', 'success')
    pushLog('success', `Banque mise à jour : ${input.bankName || profileId}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Impossible de mettre à jour la banque'
    showToast(message, 'error')
    pushLog('error', message)
  }
}

async function handleDeleteBankProfile(profileId: string) {
  try {
    await budgetStore.deleteBankProfile(profileId)
    showToast('Banque supprimée', 'info')
    pushLog('info', `Banque supprimée : ${profileId}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Impossible de supprimer la banque'
    showToast(message, 'error')
    pushLog('error', message)
  }
}

async function handleRefreshBudget() {
  try {
    await budgetStore.refresh()
    showToast('Budget synchronisé', 'info')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Impossible de rafraîchir le budget'
    showToast(message, 'error')
    pushLog('error', message)
  }
}

const logBadgeVariants: Record<string, string> = {
  info: 'bg-gray-200 text-gray-700',
  success: 'bg-emerald-100 text-emerald-700',
  error: 'bg-rose-100 text-rose-600',
}
const lastSyncedPayload = new Map<string, string>()

function shortcutLabelFor(id: CommandId) {
  const combo = getShortcut(id)
  return combo ? formatShortcutLabel(combo) : null
}

const shortcutHints = computed(() => ({
  createNote: shortcutLabelFor('create-note'),
}))

const budgetPlannerOpen = ref(false)
const budgetPlannerMode = ref<PlannerMode>('vacation')

function triggerEditorAction(action: keyof EditorActions) {
  const actions = editorEntry.value.actions
  if (!actions || typeof actions[action] !== 'function') {
    showToast('Ouvrez une note pour insérer un bloc', 'info')
    pushLog('info', 'Commande ignorée : aucun éditeur actif')
    return
  }
  Promise.resolve(actions[action]())
    .catch((err) => {
      console.error('Editor action failed', err)
      showToast("Impossible d'insérer le bloc", 'error')
    })
}

function executeCommand(commandId: CommandId | null) {
  if (!commandId) return false
  switch (commandId) {
    case 'create-note':
      if (workspaceMode.value === 'budget') {
        openBudgetPlanner('vacation')
        return true
      }
      handleCreateNote()
      return true
    case 'duplicate-note':
      if (!currentNoteId.value) {
        showToast('Aucune note à dupliquer', 'info')
        return false
      }
      void handleDuplicateActiveNote()
      return true
    case 'insert-text-block':
      triggerEditorAction('insertTextBlock')
      return true
    case 'insert-checklist-block':
      triggerEditorAction('insertChecklistBlock')
      return true
    case 'insert-code-block':
      triggerEditorAction('insertCodeBlock')
      return true
    default:
      return false
  }
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (event.defaultPrevented) return
  const commandId = matchEventToCommand(event)
  if (!commandId) return
  const handled = executeCommand(commandId)
  if (handled) {
    event.preventDefault()
    event.stopPropagation()
  }
}

onMounted(async () => {
  try {
    await Promise.all([store.refresh(), budgetStore.refresh()])
    lastSyncAt.value = Date.now()
  } finally {
    initialSyncCompleted.value = true
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleGlobalKeydown, true)
  }
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleGlobalKeydown, true)
  }
})

watch(
  () => store.activeNote.value,
  (note) => {
    if (!note) {
      showEditorModal.value = false
      return
    }
    lastSyncedPayload.set(note.id, serializeSyncPayload(normalizeSyncPayload(note)))
  },
  { immediate: true, deep: true },
)

const recentLogs = computed(() => logs.value.slice(0, 6))
const isBackgroundSyncing = computed(() => initialSyncCompleted.value && store.loading.value)

const quickFlow = computed(() => {
  const notes = store.notes.value
  const reviewCount = notes.filter((note) => note.status?.toLowerCase().includes('rev')).length
  const pendingBlocks = notes.reduce((sum, note) => sum + (note.blocks?.length || 0), 0)
  const lastSyncLabel = lastSyncAt.value ? formatRelativeTime(lastSyncAt.value) : '—'
  return {
    reviewCount,
    pendingBlocks,
    lastSyncLabel,
  }
})

const workspaceMode = computed(() => {
  if (activeNav.value === 'Paramètres') return 'settings'
  if (activeNav.value === 'Budget') return 'budget'
  return 'workspace'
})

const budgetSummary = computed(() => {
  const accounts = budgetStore.accounts.value
  const currency = budgetStore.preferences.value.defaultCurrency || 'EUR'
  const targetAccount = accounts.find((account) => typeof account.target === 'number' && account.target > 0)
  const targets = targetAccount?.target
    ? {
        label: targetAccount.name,
        progress: Math.min(100, (targetAccount.balance / targetAccount.target) * 100 || 0),
        remaining: Math.max(0, Math.round((targetAccount.target - targetAccount.balance) * 100) / 100),
      }
    : null
  return {
    totalBalance: budgetStore.totalBalance.value,
    currency,
    accountCount: accounts.length,
    targets,
  }
})

const budgetCategoryBreakdown = computed(() => {
  const totals: Record<string, number> = {}
  for (const transaction of budgetStore.transactions.value) {
    totals[transaction.categoryId] = (totals[transaction.categoryId] || 0) + transaction.amount
  }
  return budgetStore.categories.value
    .map((category) => ({
      id: category.id,
      name: category.name,
      total: Math.round((totals[category.id] || 0) * 100) / 100,
      type: category.type,
      color: category.color,
      icon: category.icon,
    }))
    .filter((category) => category.total !== 0)
})

const budgetTransactionsDisplay = computed(() => {
  const accounts = budgetStore.accounts.value
  const categories = budgetStore.categories.value
  const fallbackCurrency = budgetStore.preferences.value.defaultCurrency || 'EUR'
  return budgetStore.transactions.value.map((transaction) => {
    const account = accounts.find((acct) => acct.id === transaction.accountId)
    const category = categories.find((cat) => cat.id === transaction.categoryId)
    return {
      ...transaction,
      accountName: account?.name,
      accountCurrency: account?.currency || fallbackCurrency,
      categoryName: category?.name,
      categoryColor: category?.color,
    }
  })
})

const budgetNotes = computed(() =>
  store.notes.value.map((note) => ({
    id: note.id,
    title: note.title || 'Sans titre',
  })),
)

const budgetTripPlans = computed(() => budgetStore.tripPlans.value)
const budgetBankProfiles = computed(() => budgetStore.bankProfiles.value)

const budgetNoteTransactions = computed(() => {
  const accounts = budgetStore.accounts.value
  const categories = budgetStore.categories.value
  const fallbackCurrency = budgetStore.preferences.value.defaultCurrency || 'EUR'
  return budgetStore.transactions.value.reduce(
    (acc, transaction) => {
      if (!transaction.noteId) return acc
      const account = accounts.find((acct) => acct.id === transaction.accountId)
      const category = categories.find((cat) => cat.id === transaction.categoryId)
      if (!acc[transaction.noteId]) acc[transaction.noteId] = []
      acc[transaction.noteId].push({
        ...transaction,
        accountName: account?.name,
        categoryName: category?.name,
        currency: account?.currency || fallbackCurrency,
      })
      return acc
    },
    {} as Record<string, (BudgetTransaction & { accountName?: string; categoryName?: string; currency?: string })[]>,
  )
})

const budgetLoading = computed(() => budgetStore.loading.value)

function openBudgetPlanner(mode: PlannerMode) {
  budgetPlannerMode.value = mode
  budgetPlannerOpen.value = true
}

function closeBudgetPlanner() {
  budgetPlannerOpen.value = false
}

watch(
  () => workspaceMode.value,
  (mode) => {
    if (mode !== 'budget' && budgetPlannerOpen.value) {
      closeBudgetPlanner()
    }
  },
)

watch(
  () => store.error.value,
  (message) => {
    if (message) {
      showToast(message, 'error')
      pushLog('error', message)
    }
  },
)

watch(
  () => budgetStore.error.value,
  (message) => {
    if (message) {
      showToast(message, 'error')
      pushLog('error', message)
    }
  },
)

watch(
  () => store.loading.value,
  (isLoading) => {
    if (!isLoading) {
      lastSyncAt.value = Date.now()
    }
  },
)

const currentNoteId = computed(() => store.activeNote.value?.id ?? store.notes.value[0]?.id ?? null)

const desktopNav = computed(() => baseNav.map((item) => ({ ...item, active: item.label === activeNav.value })))

const boardStats = computed(() => {
  const notes = store.notes.value
  const noteCount = notes.length
  const reviewCount = notes.filter((note) => note.status?.toLowerCase().includes('rev')).length
  const blocks = notes.reduce((sum, note) => sum + (note.blocks?.length || 0), 0)
  return [
    { title: 'Notes actives', value: noteCount, detail: `+${Math.max(1, noteCount)} cette semaine` },
    { title: 'Revues à faire', value: reviewCount, detail: `${Math.max(1, reviewCount)} urgentes` },
    { title: 'Blocs créés', value: blocks, detail: `+${Math.max(1, blocks)} vs hier` },
  ]
})

const workspaceNotes = computed(() => {
  return store.notes.value.map((note) => ({
    id: note.id,
    title: note.title || 'Sans titre',
    category: (note.tags?.[0] || 'Général').toUpperCase(),
    excerpt: note.summary || 'Aucun résumé pour le moment.',
    status: note.status || 'Brouillon',
    updated: formatRelativeTime(note.updatedAt),
  }))
})

const activeDesktopNote = computed(() => {
  const note = store.activeNote.value || store.notes.value[0]
  if (!note) {
    return {
      id: 'placeholder',
      title: 'Aucune note active',
      owner: 'Studio Produit',
      status: 'Brouillon',
      tags: ['Produit'],
      summary: 'Créez votre première note pour remplir ce panneau.',
      checklist: [],
      highlights: ['Ajoutez des blocs pour enrichir la note.'],
      blocks: [],
    }
  }
  const normalizedBlocks: Block[] = (note.blocks || []).map((block, index) => ({
    ...block,
    id: block.id || `block-${index}`,
  }))
  return {
    id: note.id,
    title: note.title || 'Sans titre',
    owner: note.status ? `Statut : ${note.status}` : 'Sans statut',
    status: note.status || 'Brouillon',
    tags: note.tags?.length ? note.tags : ['Produit'],
    summary: note.summary || 'Aucun résumé',
    checklist: (note.tasks || []).map((task, index) => ({ id: task.id || `task-${index}`, label: task.label, done: task.done })),
    highlights: note.blocks?.length
      ? note.blocks.map((block) => `Bloc ${block.type || 'texte'}`)
      : ['Ajoutez des blocs pour enrichir la note.'],
    blocks: normalizedBlocks,
  }
})

const timeline = computed(() => {
  const note = store.activeNote.value || store.notes.value[0]
  if (!note) return []
  const items = (note.tasks || []).map((task) => ({
    time: task.done ? '✓' : '…',
    event: task.label,
  }))
  if (!items.length) {
    items.push({ time: '⏱', event: 'Aucune tâche pour le moment.' })
  }
  return items
})

async function handleSelectNote(id: string) {
  await store.setActiveNote(id)
  showAllNotes.value = false
  const note = store.notes.value.find((item) => item.id === id)
  pushLog('info', `Note ouverte : ${note?.title || 'Sans titre'}`)
}

function handleNavSelect(label: string) {
  activeNav.value = label
  if (label !== 'Budget' && budgetPlannerOpen.value) {
    closeBudgetPlanner()
  }
  pushLog('info', `Section ${label} ouverte`)
}

function handleCreateNote() {
  createNoteTitle.value = 'Nouvelle note'
  createNoteDialogOpen.value = true
}

async function submitCreateNote() {
  const title = createNoteTitle.value.trim()
  if (!title) {
    showToast('Veuillez saisir un titre', 'error')
    return
  }
  createNoteLoading.value = true
  try {
    await store.createNote({ title })
    showAllNotes.value = false
    createNoteDialogOpen.value = false
    openEditorModal()
    showToast('Note créée', 'success')
    pushLog('success', `Note créée : ${title}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Impossible de créer la note'
    showToast(message, 'error')
    pushLog('error', message)
  } finally {
    createNoteLoading.value = false
  }
}

function cancelCreateNoteDialog() {
  createNoteDialogOpen.value = false
}

function handleViewAll() {
  showAllNotes.value = true
  pushLog('info', 'Vue “Toutes les notes” ouverte')
}

async function openEditorModal(noteId?: string) {
  const targetId = noteId || currentNoteId.value
  if (!targetId) return
  if (noteId && noteId !== currentNoteId.value) {
    await store.setActiveNote(noteId)
  }
  showEditorModal.value = true
}

function closeEditorModal() {
  showEditorModal.value = false
}

function handleModalSave() {
  if (!currentNoteId.value) return
  closeEditorModal()
  showToast('Note sauvegardée', 'success')
  pushLog('success', 'Note sauvegardée via modale')
}

async function handleUpdateActiveNote(payload: {
  status: string
  summary: string
  tasks: { id?: string; label: string; done: boolean }[]
  blocks: Block[]
  tags: string[]
}) {
  const noteId = currentNoteId.value
  if (!noteId) return
  const normalized = normalizeSyncPayload({
    status: payload.status,
    summary: payload.summary,
    tasks: payload.tasks.map((task, index) => ({ id: task.id || `task-${index}`, label: task.label, done: !!task.done })),
    blocks: payload.blocks.map((block, index) => ({ ...block, id: block.id || `block-${index}`, data: { ...block.data } })),
    tags: payload.tags,
  })
  const serialized = serializeSyncPayload(normalized)
  if (lastSyncedPayload.get(noteId) === serialized) return
  lastSyncedPayload.set(noteId, serialized)
  try {
    await store.updateNote(noteId, normalized)
  } catch (err) {
    console.error('Failed to sync note', err)
    showToast("Échec de la synchronisation de la note", 'error')
    pushLog('error', 'Synchronisation de note impossible')
  }
}

async function handleDuplicate(noteId: string) {
  await store.duplicateNote(noteId)
  showToast('Note dupliquée', 'info')
  pushLog('success', 'Note dupliquée')
}

async function handleDuplicateActiveNote() {
  const noteId = currentNoteId.value
  if (!noteId) return
  await store.duplicateNote(noteId)
  showToast('Note dupliquée', 'info')
  pushLog('success', 'Note dupliquée')
  openEditorModal()
}

async function handleDelete(noteId: string) {
  try {
    await store.deleteNote(noteId)
    showToast('Note supprimée', 'success')
    pushLog('success', 'Note supprimée')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Impossible de supprimer la note'
    showToast(message, 'error')
    pushLog('error', message)
    throw err
  }
}

async function handleDeleteActiveNote(noteId?: string) {
  const targetId = noteId || currentNoteId.value
  if (!targetId) return
  await handleDelete(targetId)
  if (showEditorModal.value) {
    closeEditorModal()
  }
}

function promptDeleteNote(noteId?: string) {
  const targetId = noteId || currentNoteId.value
  if (!targetId) return
  pendingDeleteId.value = targetId
}

function cancelPendingDelete() {
  pendingDeleteId.value = null
}

async function confirmPendingDelete() {
  if (!pendingDeleteId.value) return
  await handleDeleteActiveNote(pendingDeleteId.value)
  pendingDeleteId.value = null
}

async function handleShare() {
  const note = store.activeNote.value
  if (!note) {
    showToast('Aucune note active à partager', 'info')
    pushLog('info', 'Tentative de partage sans note active')
    return
  }

  const content = `# ${note.title || 'Sans titre'}\n\n${note.summary || 'Résumé en attente.'}\n\n---\nStatut : ${note.status || 'Brouillon'}\nDernière mise à jour : ${new Date(note.updatedAt).toLocaleString()}\n\n## Checklist\n${
    (note.tasks || []).length ? note.tasks.map((task) => `- [${task.done ? 'x' : ' '}] ${task.label}`).join('\n') : '- Aucune tâche'
  }`

  if (navigator.share) {
    try {
      await navigator.share({
        title: note.title || 'Note',
        text: content,
      })
      showToast('Note partagée via Web Share', 'success')
      pushLog('success', 'Note partagée via Web Share')
      return
    } catch {
      // fallback below
    }
  }

  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(content)
      showToast('Contenu copié dans le presse-papiers', 'success')
      pushLog('success', 'Note copiée dans le presse-papiers')
      return
    } catch {
      // fallback to download
    }
  }

  downloadTextFile(content, `${note.title || 'note'}.md`)
  showToast('Fichier markdown téléchargé', 'info')
  pushLog('info', 'Export markdown téléchargé')
}

function downloadTextFile(text: string, filename: string) {
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function formatRelativeTime(timestamp?: number) {
  if (!timestamp) return '—'
  const diff = Date.now() - timestamp
  const minutes = Math.round(diff / 60000)
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.round(hours / 24)
  return `il y a ${days} j`
}

function formatLogTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function normalizeSyncPayload(payload: {
  status?: string
  summary?: string
  tasks?: Task[]
  blocks?: { id?: string; type?: string; data?: Record<string, unknown> }[]
  tags?: string[]
}) {
  return {
    status: payload.status ?? store.activeNote.value?.status ?? 'Brouillon',
    summary: payload.summary ?? '',
    tasks: (payload.tasks || []).map((task, index) => ({
      id: task.id || `task-${index}`,
      label: task.label ?? '',
      done: !!task.done,
    })),
    blocks: (payload.blocks || []).map((block, index) => ({
      id: block.id || `block-${index}`,
      type: block.type || 'text',
      data: normalizeBlockData(block.data),
    })),
    tags: Array.isArray(payload.tags)
      ? payload.tags
      : store.activeNote.value?.tags?.length
        ? store.activeNote.value.tags
        : ['Général'],
  }
}

function normalizeBlockData(data?: Record<string, unknown>) {
  if (!data) return {}
  try {
    return JSON.parse(JSON.stringify(data))
  } catch {
    return {}
  }
}

function serializeSyncPayload(payload: {
  status: string
  summary: string
  tasks: Task[]
  blocks: { id?: string; type: string; data: Record<string, unknown> }[]
  tags: string[]
}) {
  return JSON.stringify(payload)
}

 </script>

<template>
  <div class="min-h-screen text-[var(--text-main)] transition-colors duration-300">
    <div class="mx-auto max-w-[1200px] py-10 px-6">
      <DesktopWorkspace
        :nav-items="desktopNav"
        :stats="boardStats"
        :notes="workspaceNotes"
        :active-note="activeDesktopNote"
        :timeline="timeline"
        :mode="workspaceMode"
        :quick-flow="quickFlow"
        :shortcut-hints="shortcutHints"
        :budget-summary="budgetSummary"
        :budget-accounts="budgetStore.accounts.value"
        :budget-transactions="budgetTransactionsDisplay"
        :budget-alerts="budgetStore.alerts.value"
        :budget-categories="budgetCategoryBreakdown"
        :budget-category-options="budgetStore.categories.value"
        :budget-notes="budgetNotes"
        :budget-note-transactions="budgetNoteTransactions"
        :budget-loading="budgetLoading"
        :budget-trip-plans="budgetTripPlans"
        :budget-bank-profiles="budgetBankProfiles"
        :budget-planner-open="budgetPlannerOpen"
        :budget-planner-mode="budgetPlannerMode"
        @create-note="handleCreateNote"
        @share="handleShare"
        @view-all="handleViewAll"
        @select-note="handleSelectNote"
        @update-active-note="handleUpdateActiveNote"
        @edit-note="openEditorModal"
        @delete-note="promptDeleteNote"
        @select-nav="handleNavSelect"
        @create-budget-account="handleCreateBudgetAccount"
        @update-budget-account="handleUpdateBudgetAccount"
        @delete-budget-account="handleDeleteBudgetAccount"
        @create-budget-transaction="handleCreateBudgetTransaction"
        @update-budget-transaction="handleUpdateBudgetTransaction"
        @delete-budget-transaction="handleDeleteBudgetTransaction"
        @link-budget-transaction-note="handleLinkBudgetTransactionNote"
        @save-budget-trip="handleSaveBudgetTripPlan"
        @delete-budget-trip="handleDeleteBudgetTripPlan"
        @create-bank-profile="handleCreateBankProfile"
        @update-bank-profile="handleUpdateBankProfile"
        @delete-bank-profile="handleDeleteBankProfile"
        @open-budget-planner="handleOpenBudgetPlanner"
        @close-budget-planner="handleCloseBudgetPlanner"
        @refresh-budget="handleRefreshBudget"
      />
    </div>

    <transition name="fade">
      <div v-if="!initialSyncCompleted" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div class="flex items-center gap-3 rounded-2xl bg-white/90 px-6 py-4 text-sm text-gray-600 shadow-2xl">
          <span class="h-4 w-4 animate-spin rounded-full border-2 border-royal border-t-transparent"></span>
          Initialisation des notes…
        </div>
      </div>
    </transition>

    <transition name="fade">
      <div
        v-if="showEditorModal"
        class="fixed inset-0 z-[65] flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-10"
      >
        <div class="relative w-full max-w-4xl rounded-[32px] bg-white/95 p-6 shadow-2xl" style="max-height: 90vh; overflow-y: auto;">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="font-display text-2xl text-[var(--text-main)]">Édition de la note</h2>
              <p class="text-sm text-gray-500">Toutes les modifications sont synchronisées automatiquement.</p>
            </div>
            <button class="text-sm text-gray-500" @click="closeEditorModal">Fermer ✕</button>
          </div>
          <div class="mt-6 space-y-4">
            <ActiveNotePanel
              v-if="store.activeNote.value"
              :note="activeDesktopNote"
              :timeline="timeline"
              :editable-tags="true"
              :show-actions="false"
              :budget-transactions="budgetNoteTransactions?.[activeDesktopNote.id] || []"
              @update-note="handleUpdateActiveNote"
            />
            <div class="flex flex-wrap justify-end gap-2">
              <button
                class="rounded-2xl border border-white/70 bg-white/80 px-5 py-2 text-sm text-gray-600"
                @click="handleDuplicateActiveNote"
              >
                Dupliquer
              </button>
              <button
                class="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-2 text-sm text-rose-600"
                @click="promptDeleteNote()"
              >
                Supprimer
              </button>
              <button class="rounded-2xl bg-royal px-5 py-2 text-sm font-medium text-white" @click="handleModalSave">
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <transition name="fade">
      <div
        v-if="initialSyncCompleted && isBackgroundSyncing"
        class="fixed right-6 bottom-6 z-[55] flex items-center gap-3 rounded-full bg-white/90 px-4 py-2 text-sm text-gray-600 shadow-xl"
      >
        <span class="h-3 w-3 animate-spin rounded-full border border-royal border-t-transparent"></span>
        Synchronisation des notes…
      </div>
    </transition>

    <transition name="fade">
      <div v-if="createNoteDialogOpen" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
        <div class="w-full max-w-md rounded-3xl bg-[var(--surface-card)] dark:bg-[var(--surface-card)] p-6 text-center shadow-2xl ring-1 ring-black/5 dark:ring-white/10">
          <p class="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400 font-bold">Nouvelle note</p>
          <h3 class="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">Choisir un titre</h3>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">Un titre clair aide à retrouver la note plus tard.</p>
          <form class="mt-4 space-y-3" @submit.prevent="submitCreateNote">
            <input
              v-model="createNoteTitle"
              type="text"
              class="w-full rounded-2xl border border-gray-200 px-4 py-2 text-gray-700 focus:border-royal focus:outline-none"
              placeholder="Ex. Retro produit"
              autocomplete="off"
            />
            <div class="flex justify-end gap-2">
              <button type="button" class="rounded-full px-4 py-2 text-sm text-gray-500" @click="cancelCreateNoteDialog">Annuler</button>
              <button type="submit" class="rounded-full bg-royal px-4 py-2 text-sm font-medium text-white" :disabled="createNoteLoading">
                {{ createNoteLoading ? 'Création…' : 'Créer' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </transition>

    <transition name="fade">
      <div
        v-if="pendingDeleteId"
        class="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4"
      >
        <div class="w-full max-w-md rounded-3xl bg-[var(--surface-card)] p-6 text-center shadow-2xl">
          <h3 class="font-display text-2xl text-[var(--text-main)]">Supprimer la note ?</h3>
          <p class="mt-3 text-sm text-gray-600">Cette action est définitive. La note sera retirée de votre base.</p>
          <div class="mt-6 flex justify-end gap-3">
            <button class="rounded-2xl border border-white/70 px-4 py-2 text-sm text-gray-600" @click="cancelPendingDelete">Annuler</button>
            <button class="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-medium text-white" @click="confirmPendingDelete">Supprimer</button>
          </div>
        </div>
      </div>
    </transition>

    <transition name="fade">
      <div
        v-if="showAllNotes"
        class="fixed inset-0 z-40 flex items-start justify-center bg-black/40 px-4 py-10"
      >
        <div class="relative w-full max-w-3xl rounded-[32px] bg-[var(--surface-card)] p-6 shadow-xl ring-1 ring-black/5 dark:ring-white/10">
          <div class="flex items-center justify-between">
            <h2 class="font-display text-2xl text-[var(--text-main)]">Toutes les notes</h2>
            <button class="text-sm text-gray-500" @click="showAllNotes = false">Fermer ✕</button>
          </div>
          <div class="mt-6 max-h-[70vh] space-y-3 overflow-y-auto pr-2">
            <NotesList
              :notes="workspaceNotes"
              :active-id="currentNoteId"
              @select="handleSelectNote"
            />
          </div>
        </div>
      </div>
    </transition>

    <TransitionGroup name="toast" tag="div" class="fixed right-6 top-6 z-[70] space-y-3">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="[
          'flex items-center justify-between gap-4 rounded-2xl px-5 py-3 text-sm shadow-lg ring-1 ring-black/10',
          toastVariants[toast.type] || toastVariants.info,
        ]"
      >
        <span>{{ toast.message }}</span>
        <button class="text-xs text-white/80" @click="dismissToast(toast.id)">Fermer</button>
      </div>
    </TransitionGroup>
  </div>
</template>
