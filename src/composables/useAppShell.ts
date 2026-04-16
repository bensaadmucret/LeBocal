import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useNotesStore } from '../stores/useNotesStore'
import { useBudgetStore } from '../stores/useBudgetStore'
import { useCalendarStore } from '../stores/useCalendarStore'
import { useFeedback } from './useFeedback'
import { useCommandShortcuts, type CommandId } from './useCommandShortcuts'
import { useEditorBridge, type EditorActions } from './useEditorBridge'
import {
  buildPaletteSections,
  isCacheFresh,
  loadPaletteCacheFromStorage,
  paletteEntryId,
  savePaletteCacheToStorage,
  signatureForEntries,
  truncatePaletteEntries,
  clearPaletteCacheStorage,
  type BudgetTransactionDisplay,
  type CommandPaletteCatalogEntry,
  type PaletteNoteSnapshot,
  type PaletteTransactionSnapshot,
  type PaletteTripSnapshot,
} from '../features/commandPalette/paletteEngine'
import type { NoteUpdatePayload, Block, Task, CollectionInputPayload } from '../stores/useNotesStore'
import type {
  BudgetAccountInput,
  BudgetTransactionInput,
  BudgetTransaction,
  BudgetTripPlanInput,
  BudgetBankProfileInput,
} from '../stores/useBudgetStore'

export type PlannerMode = 'vacation' | 'bank'

const PALETTE_SECTION_LIMITS = { notes: 18, transactions: 18, trips: 10 }
const PALETTE_CACHE_KEY = 'le-bocal:command-palette-cache:v1'
const PALETTE_CACHE_MAX_ENTRIES = 150
const PALETTE_CACHE_TTL_MS = 1000 * 60 * 60 * 24

export function useAppShell() {
  const store = useNotesStore()
  const budgetStore = useBudgetStore()
  const calendarStore = useCalendarStore()
  const { toasts, logs, showToast, dismissToast, pushLog } = useFeedback()
  const { matchEventToCommand, getShortcut, formatShortcutLabel } = useCommandShortcuts()
  const { editorEntry } = useEditorBridge()

  const initialSyncCompleted = ref(false)
  const lastSyncAt = ref<number | null>(null)
  const showEditorModal = ref(false)
  const noteComposerOpen = ref(false)
  const noteComposerSavingMode = ref<null | 'save' | 'publish'>(null)
  const noteComposerClearTrigger = ref(0)
  const pendingDeleteId = ref<string | null>(null)
  const commandPaletteOpen = ref(false)
  const commandPaletteQuery = ref('')
  const commandPaletteOffline = ref(false)
  const budgetPlannerOpen = ref(false)
  const budgetPlannerMode = ref<PlannerMode>('vacation')
  const showAllNotes = ref(false)

  const canUseWindow = typeof window !== 'undefined'
  const lastSyncedPayload = new Map<string, string>()

  // Palette cache
  const paletteCache = ref<CommandPaletteCatalogEntry[]>([])
  const paletteCacheMeta = ref<{ savedAt: number | null; lastSyncAt: number | null }>({
    savedAt: null,
    lastSyncAt: null,
  })
  let lastSavedPaletteSignature: string | null = null

  if (typeof window !== 'undefined') {
    const payload = loadPaletteCacheFromStorage(PALETTE_CACHE_KEY)
    if (payload && isCacheFresh(payload.savedAt, PALETTE_CACHE_TTL_MS)) {
      paletteCache.value = payload.entries
      paletteCacheMeta.value = { savedAt: payload.savedAt, lastSyncAt: payload.lastSyncAt ?? null }
      lastSavedPaletteSignature = signatureForEntries(paletteCache.value)
    } else if (payload) {
      clearPaletteCacheStorage(PALETTE_CACHE_KEY)
    }
  }

  // Computed
  const currentNoteId = computed(() => store.activeNote.value?.id ?? store.notes.value[0]?.id ?? null)

  const shortcutHints = computed(() => ({
    createNote: shortcutLabelFor('create-note'),
  }))

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
    return { totalBalance: budgetStore.totalBalance.value, currency, accountCount: accounts.length, targets }
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
    store.notes.value.map((note) => ({ id: note.id, title: note.title || 'Sans titre' })),
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

  const livePaletteCatalog = computed<CommandPaletteCatalogEntry[]>(() => {
    const entries: CommandPaletteCatalogEntry[] = []
    for (const note of store.notes.value) {
      const snapshot: PaletteNoteSnapshot = {
        id: note.id,
        title: note.title || 'Sans titre',
        summary: note.summary || '',
        status: note.status || 'Brouillon',
        tags: Array.isArray(note.tags) ? note.tags : [],
        updatedAt: note.updatedAt,
      }
      entries.push({ type: 'note', payload: snapshot })
    }
    for (const transaction of budgetTransactionsDisplay.value.slice(0, 80)) {
      const snapshot: PaletteTransactionSnapshot = {
        id: transaction.id,
        label: transaction.label,
        accountName: transaction.accountName,
        categoryName: transaction.categoryName,
        amount: transaction.amount,
        memo: transaction.memo,
        date: transaction.date,
        type: transaction.type,
        accountCurrency: transaction.accountCurrency,
      }
      entries.push({ type: 'transaction', payload: snapshot })
    }
    for (const trip of budgetTripPlans.value) {
      const snapshot: PaletteTripSnapshot = {
        id: trip.id,
        title: trip.title,
        startDate: trip.startDate,
        endDate: trip.endDate,
        durationDays: trip.durationDays,
        notes: trip.notes,
        estimatedTotal: trip.estimatedTotal,
        updatedAt: trip.updatedAt,
      }
      entries.push({ type: 'trip', payload: snapshot })
    }
    return entries
  })

  const paletteSource = computed(() => {
    const hasLiveEntries = livePaletteCatalog.value.length > 0
    const cacheFresh = isCacheFresh(paletteCacheMeta.value.savedAt, PALETTE_CACHE_TTL_MS)
    const hasUsableCache = cacheFresh && paletteCache.value.length > 0
    const shouldUseCache = (!hasLiveEntries && hasUsableCache) || (commandPaletteOffline.value && hasUsableCache)
    if (shouldUseCache) return { entries: paletteCache.value, fromCache: true }
    return { entries: livePaletteCatalog.value, fromCache: false }
  })

  const commandPaletteCatalog = computed<CommandPaletteCatalogEntry[]>(() => paletteSource.value.entries)
  const commandPaletteUsesCache = computed(() => paletteSource.value.fromCache)
  const paletteCacheLastSyncLabel = computed(() => {
    if (!commandPaletteUsesCache.value) return null
    const ts = paletteCacheMeta.value.lastSyncAt ?? paletteCacheMeta.value.savedAt
    if (!ts) return null
    return new Date(ts).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
  })

  const commandPaletteSections = computed(() =>
    buildPaletteSections(commandPaletteCatalog.value, commandPaletteQuery.value, PALETTE_SECTION_LIMITS),
  )

  const commandPaletteEntryMap = computed(() => {
    const map = new Map<string, CommandPaletteCatalogEntry>()
    for (const entry of commandPaletteCatalog.value) {
      map.set(paletteEntryId(entry), entry)
    }
    return map
  })

  const isBackgroundSyncing = computed(() => initialSyncCompleted.value && store.loading.value)
  const recentLogs = computed(() => logs.value.slice(0, 6))

  // Watchers
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

  watch(
    () => ({ entries: livePaletteCatalog.value, offline: commandPaletteOffline.value }),
    ({ entries, offline }) => {
      if (!entries.length || offline) return
      const truncated = truncatePaletteEntries(entries, PALETTE_CACHE_MAX_ENTRIES)
      const signature = signatureForEntries(truncated)
      if (signature === lastSavedPaletteSignature) return
      lastSavedPaletteSignature = signature
      paletteCache.value = truncated
      paletteCacheMeta.value = { savedAt: Date.now(), lastSyncAt: lastSyncAt.value }
      savePaletteCacheToStorage(PALETTE_CACHE_KEY, {
        entries: truncated,
        savedAt: paletteCacheMeta.value.savedAt!,
        lastSyncAt: paletteCacheMeta.value.lastSyncAt,
      })
    },
    { deep: true },
  )

  watch(
    () => store.error.value,
    (message) => { if (message) { showToast(message, 'error'); pushLog('error', message) } },
  )

  watch(
    () => budgetStore.error.value,
    (message) => { if (message) { showToast(message, 'error'); pushLog('error', message) } },
  )

  watch(
    () => store.loading.value,
    (isLoading) => { if (!isLoading) lastSyncAt.value = Date.now() },
  )

  // Methods
  function shortcutLabelFor(id: CommandId) {
    const combo = getShortcut(id)
    return combo ? formatShortcutLabel(combo) : null
  }

  function updateOfflineIndicator() {
    if (typeof navigator === 'undefined') return
    commandPaletteOffline.value = !navigator.onLine
  }

  function triggerEditorAction(action: keyof EditorActions) {
    const actions = editorEntry.value.actions
    if (!actions || typeof actions[action] !== 'function') {
      showToast('Ouvrez une note pour insérer un bloc', 'info')
      pushLog('info', 'Commande ignorée : aucun éditeur actif')
      return
    }
    Promise.resolve(actions[action]()).catch((err) => {
      console.error('Editor action failed', err)
      showToast("Impossible d'insérer le bloc", 'error')
    })
  }

  function executeCommand(commandId: CommandId | null) {
    if (!commandId) return false
    switch (commandId) {
      case 'create-note':
        handleCreateNote()
        return true
      case 'duplicate-note':
        if (!currentNoteId.value) { showToast('Aucune note à dupliquer', 'info'); return false }
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
    if (handled) { event.preventDefault(); event.stopPropagation() }
  }

  function handlePaletteShortcut(event: KeyboardEvent) {
    if (!canUseWindow) return
    const target = event.target as HTMLElement | null
    if (isEditableTarget(target)) return
    const key = event.key?.toLowerCase()
    const wantsToggle = (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && key === 'k'
    if (!wantsToggle) return
    event.preventDefault()
    if (commandPaletteOpen.value) {
      handleCommandPaletteClose()
    } else {
      commandPaletteQuery.value = ''
      handleCommandPaletteOpen()
    }
  }

  function isEditableTarget(target: HTMLElement | null) {
    if (!target) return false
    const editableTags = ['INPUT', 'TEXTAREA', 'SELECT']
    if (editableTags.includes(target.tagName)) return true
    if (target.isContentEditable) return true
    return false
  }

  // Note actions
  async function handleSelectNote(id: string) {
    await store.setActiveNote(id)
    showAllNotes.value = false
    const note = store.notes.value.find((item) => item.id === id)
    pushLog('info', `Note ouverte : ${note?.title || 'Sans titre'}`)
  }

  function handleCreateNote() {
    noteComposerOpen.value = true
  }

  function handleCloseNoteComposer() {
    noteComposerOpen.value = false
  }

  async function handleComposerAction(mode: 'save' | 'publish', payload: NoteUpdatePayload) {
    if (!payload.title?.trim()) { showToast('Veuillez saisir un titre', 'error'); return }
    noteComposerSavingMode.value = mode
    try {
      await store.createNote(payload)
      noteComposerOpen.value = false
      noteComposerClearTrigger.value += 1
      showAllNotes.value = false
      showToast(mode === 'publish' ? 'Note publiée' : 'Note enregistrée', 'success')
      pushLog('success', `Note ${mode === 'publish' ? 'publiée' : 'enregistrée'} : ${payload.title}`)
      await openEditorModal()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de créer la note'
      showToast(message, 'error')
      pushLog('error', message)
    } finally {
      noteComposerSavingMode.value = null
    }
  }

  const handleComposerSave = (payload: NoteUpdatePayload) => handleComposerAction('save', payload)
  const handleComposerPublish = (payload: NoteUpdatePayload) => handleComposerAction('publish', payload)

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

  async function handleUpdateActiveNote(payload: {
    status: string; summary: string
    tasks: { id?: string; label: string; done: boolean }[]
    blocks: Block[]; tags: string[]
  }) {
    const noteId = currentNoteId.value
    if (!noteId) return
    const normalized = normalizeSyncPayload({
      status: payload.status, summary: payload.summary,
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
    await handleDelete(pendingDeleteId.value)
    if (showEditorModal.value) closeEditorModal()
    pendingDeleteId.value = null
  }

  async function handleShare() {
    const note = store.activeNote.value
    if (!note) {
      showToast('Aucune note active à partager', 'info')
      pushLog('info', 'Tentative de partage sans note active')
      return
    }
    const content = `# ${note.title || 'Sans titre'}\n\n${note.summary || 'Résumé en attente.'}\n\n---\nStatut : ${note.status || 'Brouillon'}\nDernière mise à jour : ${new Date(note.updatedAt).toLocaleString()}\n\n## Checklist\n${(note.tasks || []).length ? note.tasks.map((task) => `- [${task.done ? 'x' : ' '}] ${task.label}`).join('\n') : '- Aucune tâche'}`
    if (navigator.share) {
      try { await navigator.share({ title: note.title || 'Note', text: content }); showToast('Note partagée via Web Share', 'success'); pushLog('success', 'Note partagée via Web Share'); return } catch { /* fallback */ }
    }
    if (navigator.clipboard) {
      try { await navigator.clipboard.writeText(content); showToast('Contenu copié dans le presse-papiers', 'success'); pushLog('success', 'Note copiée dans le presse-papiers'); return } catch { /* fallback */ }
    }
    downloadTextFile(content, `${note.title || 'note'}.md`)
    showToast('Fichier markdown téléchargé', 'info')
    pushLog('info', 'Export markdown téléchargé')
  }

  async function handleCreateNoteFromEvent(title: string, _eventId: string) {
    try {
      await store.createNote({ title: `Événement: ${title}`, summary: `Note créée automatiquement pour l'événement "${title}"`, status: 'Brouillon', tags: ['Calendrier'] })
      showToast('Note créée depuis le calendrier', 'success')
      pushLog('success', `Note créée pour l'événement: ${title}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de créer la note'
      showToast(message, 'error')
    }
  }

  async function handleCreateBudgetTransactionFromEvent(payload: {
    eventId: string; amount: number; type: 'expense' | 'income'
    accountId: string; categoryId: string; label: string; date: Date
  }) {
    try {
      await budgetStore.recordTransaction({
        accountId: payload.accountId, categoryId: payload.categoryId,
        amount: payload.amount, type: payload.type,
        date: payload.date.toISOString(), label: payload.label,
        memo: `Transaction créée depuis l'événement calendrier`, noteId: null,
      })
      showToast('Transaction créée depuis le calendrier', 'success')
      pushLog('success', 'Transaction liée à un événement calendrier')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de créer la transaction'
      showToast(message, 'error')
    }
  }

  async function handleComposerCreateCollection(payload: CollectionInputPayload) {
    try {
      await store.createCollection(payload)
      showToast('Collection créée', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de créer la collection'
      showToast(message, 'error')
      pushLog('error', message)
    }
  }

  // Budget actions
  async function handleCreateBudgetAccount(payload: BudgetAccountInput & { target?: number | null; alertThreshold?: number | null }) {
    try { await budgetStore.createAccount(payload); showToast('Compte budget créé', 'success'); pushLog('success', `Compte créé : ${payload.name}`) }
    catch (err) { const message = err instanceof Error ? err.message : "Impossible de créer le compte"; showToast(message, 'error'); pushLog('error', message) }
  }

  async function handleCreateBudgetTransaction(payload: BudgetTransactionInput) {
    try { await budgetStore.recordTransaction(payload); showToast('Transaction enregistrée', 'success'); pushLog('success', `Transaction ${payload.type === 'expense' ? 'débit' : 'crédit'} enregistrée`) }
    catch (err) { const message = err instanceof Error ? err.message : "Impossible d'enregistrer la transaction"; showToast(message, 'error'); pushLog('error', message) }
  }

  async function handleUpdateBudgetAccount({ accountId, input }: { accountId: string; input: Partial<BudgetAccountInput> & { target?: number | null; alertThreshold?: number | null } }) {
    try { await budgetStore.updateAccount(accountId, input); showToast('Compte mis à jour', 'success'); pushLog('success', `Compte mis à jour : ${input.name || accountId}`) }
    catch (err) { const message = err instanceof Error ? err.message : 'Impossible de mettre à jour le compte'; showToast(message, 'error'); pushLog('error', message) }
  }

  async function handleDeleteBudgetAccount(accountId: string) {
    try { await budgetStore.deleteAccount(accountId); showToast('Compte supprimé', 'info'); pushLog('info', `Compte supprimé : ${accountId}`) }
    catch (err) { const message = err instanceof Error ? err.message : 'Suppression du compte impossible'; showToast(message, 'error'); pushLog('error', message) }
  }

  async function handleUpdateBudgetTransaction({ transactionId, input }: { transactionId: string; input: Partial<BudgetTransactionInput> }) {
    try { await budgetStore.updateTransaction(transactionId, input); showToast('Transaction mise à jour', 'success'); pushLog('success', `Transaction mise à jour : ${transactionId}`) }
    catch (err) { const message = err instanceof Error ? err.message : 'Impossible de mettre à jour la transaction'; showToast(message, 'error'); pushLog('error', message) }
  }

  async function handleDeleteBudgetTransaction(transactionId: string) {
    try { await budgetStore.deleteTransaction(transactionId); showToast('Transaction supprimée', 'info'); pushLog('info', `Transaction supprimée : ${transactionId}`) }
    catch (err) { const message = err instanceof Error ? err.message : 'Suppression de la transaction impossible'; showToast(message, 'error'); pushLog('error', message) }
  }

  async function handleLinkBudgetTransactionNote({ transactionId, noteId }: { transactionId: string; noteId: string | null }) {
    try { await budgetStore.linkTransactionToNote(transactionId, noteId); showToast(noteId ? 'Transaction associée à la note' : 'Association retirée', 'success') }
    catch (err) { const message = err instanceof Error ? err.message : 'Association impossible'; showToast(message, 'error'); pushLog('error', message) }
  }

  async function handleSaveBudgetTripPlan(payload: BudgetTripPlanInput) {
    try { await budgetStore.saveTripPlan(payload); showToast(payload.id ? 'Plan vacances mis à jour' : 'Plan vacances enregistré', 'success'); pushLog('success', `Plan vacances ${payload.id ? 'mis à jour' : 'créé'} : ${payload.title}`) }
    catch (err) { const message = err instanceof Error ? err.message : 'Impossible de sauvegarder le plan vacances'; showToast(message, 'error'); pushLog('error', message) }
  }

  async function handleDeleteBudgetTripPlan(planId: string) {
    try { await budgetStore.deleteTripPlan(planId); showToast('Plan vacances supprimé', 'info'); pushLog('info', `Plan vacances supprimé : ${planId}`) }
    catch (err) { const message = err instanceof Error ? err.message : 'Impossible de supprimer le plan'; showToast(message, 'error'); pushLog('error', message) }
  }

  async function handleCreateBankProfile(payload: BudgetBankProfileInput) {
    try { await budgetStore.createBankProfile(payload); showToast('Banque ajoutée', 'success'); pushLog('success', `Banque ajoutée : ${payload.bankName}`) }
    catch (err) { const message = err instanceof Error ? err.message : 'Impossible de créer le compte bancaire'; showToast(message, 'error'); pushLog('error', message) }
  }

  async function handleUpdateBankProfile({ profileId, input }: { profileId: string; input: Partial<BudgetBankProfileInput> }) {
    try { await budgetStore.updateBankProfile(profileId, input); showToast('Banque mise à jour', 'success'); pushLog('success', `Banque mise à jour : ${input.bankName || profileId}`) }
    catch (err) { const message = err instanceof Error ? err.message : 'Impossible de mettre à jour la banque'; showToast(message, 'error'); pushLog('error', message) }
  }

  async function handleDeleteBankProfile(profileId: string) {
    try { await budgetStore.deleteBankProfile(profileId); showToast('Banque supprimée', 'info'); pushLog('info', `Banque supprimée : ${profileId}`) }
    catch (err) { const message = err instanceof Error ? err.message : 'Impossible de supprimer la banque'; showToast(message, 'error'); pushLog('error', message) }
  }

  async function handleRefreshBudget() {
    try { await budgetStore.refresh(); showToast('Budget synchronisé', 'info') }
    catch (err) { const message = err instanceof Error ? err.message : 'Impossible de rafraîchir le budget'; showToast(message, 'error'); pushLog('error', message) }
  }

  function openBudgetPlanner(mode: PlannerMode) { budgetPlannerMode.value = mode; budgetPlannerOpen.value = true }
  function closeBudgetPlanner() { budgetPlannerOpen.value = false }

  // Command Palette
  function handleCommandPaletteOpen(prefill?: string) {
    commandPaletteQuery.value = prefill ?? commandPaletteQuery.value
    updateOfflineIndicator()
    commandPaletteOpen.value = true
  }
  function handleCommandPaletteClose() { commandPaletteOpen.value = false }

  async function handleCommandPaletteSelect(itemId: string) {
    const entry = commandPaletteEntryMap.value.get(itemId)
    if (!entry) { handleCommandPaletteClose(); return }
    if (entry.type === 'note') {
      await store.setActiveNote(entry.payload.id)
      pushLog('info', `Note ouverte via palette : ${entry.payload.title || 'Sans titre'}`)
    } else if (entry.type === 'transaction') {
      showToast(`Transaction « ${entry.payload.label} »`, 'info')
      pushLog('info', `Transaction consultée via palette : ${entry.payload.label}`)
    } else if (entry.type === 'trip') {
      openBudgetPlanner('vacation')
      showToast(`Voyage « ${entry.payload.title} »`, 'info')
      pushLog('info', `Voyage ouvert via palette : ${entry.payload.title}`)
    }
    handleCommandPaletteClose()
  }

  // Helpers
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
    return new Date(timestamp).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  function downloadTextFile(text: string, filename: string) {
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = filename
    document.body.appendChild(link); link.click(); document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function normalizeSyncPayload(payload: {
    status?: string; summary?: string
    tasks?: Task[]; blocks?: { id?: string; type?: string; data?: Record<string, unknown> }[]
    tags?: string[]
  }) {
    return {
      status: payload.status ?? store.activeNote.value?.status ?? 'Brouillon',
      summary: payload.summary ?? '',
      tasks: (payload.tasks || []).map((task, index) => ({ id: task.id || `task-${index}`, label: task.label ?? '', done: !!task.done })),
      blocks: (payload.blocks || []).map((block, index) => ({ id: block.id || `block-${index}`, type: block.type || 'text', data: normalizeBlockData(block.data) })),
      tags: Array.isArray(payload.tags) ? payload.tags : store.activeNote.value?.tags?.length ? store.activeNote.value.tags : ['Général'],
    }
  }

  function normalizeBlockData(data?: Record<string, unknown>) {
    if (!data) return {}
    try { return JSON.parse(JSON.stringify(data)) } catch { return {} }
  }

  function serializeSyncPayload(payload: { status: string; summary: string; tasks: Task[]; blocks: { id?: string; type: string; data: Record<string, unknown> }[]; tags: string[] }) {
    return JSON.stringify(payload)
  }

  // Lifecycle
  onMounted(async () => {
    try {
      await Promise.all([store.refresh(), budgetStore.refresh()])
      lastSyncAt.value = Date.now()
    } finally {
      initialSyncCompleted.value = true
    }
    if (canUseWindow) {
      window.addEventListener('keydown', handleGlobalKeydown, true)
      window.addEventListener('keydown', handlePaletteShortcut, true)
      window.addEventListener('online', updateOfflineIndicator)
      window.addEventListener('offline', updateOfflineIndicator)
      updateOfflineIndicator()
    }
  })

  onBeforeUnmount(() => {
    if (canUseWindow) {
      window.removeEventListener('keydown', handleGlobalKeydown, true)
      window.removeEventListener('keydown', handlePaletteShortcut, true)
      window.removeEventListener('online', updateOfflineIndicator)
      window.removeEventListener('offline', updateOfflineIndicator)
    }
  })

  return {
    // Stores
    store, budgetStore, calendarStore,
    // State
    initialSyncCompleted, lastSyncAt, showEditorModal, noteComposerOpen,
    noteComposerSavingMode, noteComposerClearTrigger, pendingDeleteId,
    commandPaletteOpen, commandPaletteQuery, commandPaletteOffline,
    budgetPlannerOpen, budgetPlannerMode, showAllNotes,
    toasts, logs,
    // Computed
    currentNoteId, shortcutHints, budgetSummary, budgetCategoryBreakdown,
    budgetTransactionsDisplay, budgetNotes, budgetTripPlans, budgetBankProfiles,
    budgetNoteTransactions, budgetLoading, commandPaletteSections,
    commandPaletteCatalog, commandPaletteEntryMap, commandPaletteUsesCache,
    paletteCacheLastSyncLabel, isBackgroundSyncing, recentLogs,
    // Methods
    showToast, dismissToast, pushLog,
    handleSelectNote, handleCreateNote, handleCloseNoteComposer,
    handleComposerSave, handleComposerPublish, handleComposerCreateCollection,
    openEditorModal, closeEditorModal, handleUpdateActiveNote,
    handleDuplicateActiveNote, handleDelete, promptDeleteNote,
    cancelPendingDelete, confirmPendingDelete, handleShare,
    handleCreateNoteFromEvent, handleCreateBudgetTransactionFromEvent,
    handleCreateBudgetAccount, handleCreateBudgetTransaction,
    handleUpdateBudgetAccount, handleDeleteBudgetAccount,
    handleUpdateBudgetTransaction, handleDeleteBudgetTransaction,
    handleLinkBudgetTransactionNote, handleSaveBudgetTripPlan,
    handleDeleteBudgetTripPlan, handleCreateBankProfile,
    handleUpdateBankProfile, handleDeleteBankProfile,
    handleRefreshBudget, openBudgetPlanner, closeBudgetPlanner,
    handleCommandPaletteOpen, handleCommandPaletteClose, handleCommandPaletteSelect,
    formatRelativeTime, formatLogTimestamp,
  }
}
