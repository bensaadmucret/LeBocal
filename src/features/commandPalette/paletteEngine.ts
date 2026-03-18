import type { CommandPaletteItem, CommandPaletteItemType, CommandPaletteSection } from '../../types/commandPalette'
import type { Note } from '../../stores/useNotesStore'
import type { BudgetTripPlan, BudgetTransaction } from '../../stores/useBudgetStore'

export type BudgetTransactionDisplay = BudgetTransaction & {
  accountName?: string
  accountCurrency?: string
  categoryName?: string
  categoryColor?: string
}

export type PaletteNoteSnapshot = Pick<Note, 'id' | 'title' | 'summary' | 'status' | 'tags' | 'updatedAt'>

export type PaletteTransactionSnapshot = Pick<
  BudgetTransactionDisplay,
  'id' | 'label' | 'accountName' | 'categoryName' | 'amount' | 'memo' | 'date' | 'type' | 'accountCurrency'
>

export type PaletteTripSnapshot = Pick<
  BudgetTripPlan,
  'id' | 'title' | 'startDate' | 'endDate' | 'durationDays' | 'notes' | 'estimatedTotal' | 'updatedAt'
>

export type CommandPaletteCatalogEntry =
  | { type: 'note'; payload: PaletteNoteSnapshot }
  | { type: 'transaction'; payload: PaletteTransactionSnapshot }
  | { type: 'trip'; payload: PaletteTripSnapshot }

export interface ScoredPaletteRow {
  item: CommandPaletteItem
  score: number
  recency: number
  amountMagnitude: number
}

export interface PaletteDateFilter {
  comparator: 'eq' | 'before' | 'after'
  value: number
}

export interface PaletteQueryFilters {
  textTokens: string[]
  tagFilters: string[]
  dateFilters: PaletteDateFilter[]
  typeFilters: Set<CommandPaletteItemType>
  hasFilters: boolean
}

export interface EntryEvaluationResult {
  passes: boolean
  score: number
  recency: number
  amountMagnitude: number
}

export interface PaletteSectionLimits {
  notes: number
  transactions: number
  trips: number
}

export interface PaletteCachePayload {
  entries: CommandPaletteCatalogEntry[]
  savedAt: number
  lastSyncAt?: number | null
}

export function buildPaletteSections(
  catalog: CommandPaletteCatalogEntry[],
  query: string,
  limits: PaletteSectionLimits,
): CommandPaletteSection[] {
  const filters = parsePaletteQuery(query)
  const buckets: Record<'notes' | 'transactions' | 'trips', ScoredPaletteRow[]> = {
    notes: [],
    transactions: [],
    trips: [],
  }

  for (const entry of catalog) {
    const evaluation = evaluateEntry(entry, filters)
    if (!evaluation.passes) continue
    const item = paletteItemFromEntry(entry)
    if (!item) continue
    const bucketKey = entry.type === 'note' ? 'notes' : entry.type === 'transaction' ? 'transactions' : 'trips'
    buckets[bucketKey].push({
      item,
      score: evaluation.score,
      recency: evaluation.recency,
      amountMagnitude: evaluation.amountMagnitude,
    })
  }

  return [
    { id: 'notes', label: 'Notes', items: selectTopItems(buckets.notes, limits.notes) },
    { id: 'transactions', label: 'Transactions', items: selectTopItems(buckets.transactions, limits.transactions) },
    { id: 'trips', label: 'Voyages', items: selectTopItems(buckets.trips, limits.trips) },
  ]
}

export function selectTopItems(rows: ScoredPaletteRow[], limit: number) {
  return rows
    .sort((a, b) => b.score - a.score || b.recency - a.recency || b.amountMagnitude - a.amountMagnitude)
    .slice(0, limit)
    .map((row) => row.item)
}

export function parsePaletteQuery(raw: string): PaletteQueryFilters {
  const filters: PaletteQueryFilters = {
    textTokens: [],
    tagFilters: [],
    dateFilters: [],
    typeFilters: new Set<CommandPaletteItemType>(),
    hasFilters: false,
  }
  raw
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .forEach((token) => {
      if (token.startsWith('type:')) {
        const value = token.slice(5)
        if (isPaletteType(value)) {
          filters.typeFilters.add(value)
        }
        return
      }
      if (token.startsWith('tag:')) {
        const tag = token.slice(4)
        if (tag) filters.tagFilters.push(tag)
        return
      }
      if (token.startsWith('date:')) {
        const parsed = parseDateFilter(token.slice(5))
        if (parsed) filters.dateFilters.push(parsed)
        return
      }
      filters.textTokens.push(token)
    })
  filters.hasFilters =
    filters.textTokens.length > 0 || filters.tagFilters.length > 0 || filters.dateFilters.length > 0 || filters.typeFilters.size > 0
  return filters
}

export function parseDateFilter(value: string): PaletteDateFilter | null {
  if (!value) return null
  let comparator: PaletteDateFilter['comparator'] = 'eq'
  let token = value
  if (value.startsWith('>=')) {
    comparator = 'after'
    token = value.slice(2)
  } else if (value.startsWith('>')) {
    comparator = 'after'
    token = value.slice(1)
  } else if (value.startsWith('<=')) {
    comparator = 'before'
    token = value.slice(2)
  } else if (value.startsWith('<')) {
    comparator = 'before'
    token = value.slice(1)
  }
  const timestamp = parseDateToken(token)
  if (timestamp === null) return null
  return { comparator, value: timestamp }
}

export function parseDateToken(value: string): number | null {
  if (!value) return null
  const normalized = value.toLowerCase()
  const today = startOfDay(new Date())
  if (normalized === 'today' || normalized === 'ajd' || normalized === 'auj') {
    return today.getTime()
  }
  if (normalized === 'yesterday' || normalized === 'hier') {
    today.setDate(today.getDate() - 1)
    return today.getTime()
  }
  if (normalized === 'week' || normalized === '-7d') {
    today.setDate(today.getDate() - 7)
    return today.getTime()
  }
  if (/^\d{4}$/.test(value)) {
    return new Date(Number(value), 0, 1).getTime()
  }
  if (/^\d{4}-\d{2}$/.test(value)) {
    return new Date(`${value}-01`).getTime()
  }
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? null : parsed
}

export function isPaletteType(value: string): value is CommandPaletteItemType {
  return value === 'note' || value === 'transaction' || value === 'trip'
}

export function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function evaluateEntry(entry: CommandPaletteCatalogEntry, filters: PaletteQueryFilters): EntryEvaluationResult {
  const recency = entryRecencyTimestamp(entry) ?? 0
  const amountMagnitude = entryAmountMagnitude(entry)
  if (filters.typeFilters.size && !filters.typeFilters.has(entry.type)) {
    return { passes: false, score: 0, recency, amountMagnitude }
  }

  const haystack = entrySearchText(entry)
  if (filters.textTokens.some((token) => !haystack.includes(token))) {
    return { passes: false, score: 0, recency, amountMagnitude }
  }

  const tagPool = entryTagPool(entry)
  if (filters.tagFilters.some((tag) => !tagPool.some((value) => value.includes(tag)))) {
    return { passes: false, score: 0, recency, amountMagnitude }
  }

  const datePool = entryDatePool(entry)
  if (filters.dateFilters.length && !matchesDateFilters(datePool, filters.dateFilters)) {
    return { passes: false, score: 0, recency, amountMagnitude }
  }

  let score = baseTypeScore(entry.type) + recencyBoost(recency)
  if (entry.type === 'transaction') {
    score += amountBoost(amountMagnitude)
  }
  if (filters.textTokens.length) {
    score += filters.textTokens.length * 12
  }
  if (filters.tagFilters.length) {
    score += filters.tagFilters.length * 8
  }
  if (filters.dateFilters.length) {
    score += filters.dateFilters.length * 8
  }
  if (filters.typeFilters.size) {
    score += 10
  }

  return { passes: true, score, recency, amountMagnitude }
}

export function baseTypeScore(type: CommandPaletteItemType) {
  switch (type) {
    case 'note':
      return 60
    case 'transaction':
      return 55
    case 'trip':
      return 50
    default:
      return 40
  }
}

export function recencyBoost(timestamp: number | null) {
  if (!timestamp) return 0
  const ageInDays = Math.max(0, (Date.now() - timestamp) / 86_400_000)
  return Math.max(0, 30 - ageInDays)
}

export function amountBoost(amount: number) {
  if (!amount) return 0
  return Math.min(25, Math.log10(Math.abs(amount) + 1) * 10)
}

export function entryRecencyTimestamp(entry: CommandPaletteCatalogEntry) {
  if (entry.type === 'note') return entry.payload.updatedAt || null
  if (entry.type === 'transaction') return toTimestamp(entry.payload.date)
  return toTimestamp(entry.payload.updatedAt) ?? toTimestamp(entry.payload.startDate)
}

export function entryAmountMagnitude(entry: CommandPaletteCatalogEntry) {
  if (entry.type === 'transaction') {
    return Math.abs(entry.payload.amount)
  }
  return 0
}

export function matchesDateFilters(values: number[], filters: PaletteDateFilter[]) {
  if (!filters.length) return true
  if (!values.length) return false
  return filters.every((filter) => values.some((value) => compareDate(value, filter)))
}

export function compareDate(value: number, filter: PaletteDateFilter) {
  if (!Number.isFinite(value)) return false
  if (filter.comparator === 'before') {
    return value <= filter.value
  }
  if (filter.comparator === 'after') {
    return value >= filter.value
  }
  return isSameDay(value, filter.value)
}

export function isSameDay(aMs: number, bMs: number) {
  const a = new Date(aMs)
  const b = new Date(bMs)
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function toTimestamp(value: string | number | null | undefined): number | null {
  if (value == null) return null
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? null : parsed
}

export function entrySearchText(entry: CommandPaletteCatalogEntry) {
  if (entry.type === 'note') {
    const note = entry.payload
    return [note.title, note.summary, note.status, note.tags?.join(' ')].filter(Boolean).join(' ').toLowerCase()
  }
  if (entry.type === 'transaction') {
    const txn = entry.payload
    return [txn.label, txn.accountName, txn.categoryName, String(txn.amount), txn.memo, txn.date]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
  }
  const trip = entry.payload
  return [trip.title, trip.notes, trip.startDate, trip.endDate].filter(Boolean).join(' ').toLowerCase()
}

export function entryTagPool(entry: CommandPaletteCatalogEntry): string[] {
  if (entry.type === 'note') {
    return (entry.payload.tags || []).map((tag) => tag.toLowerCase())
  }
  if (entry.type === 'transaction') {
    return [entry.payload.categoryName, entry.payload.accountName].filter(Boolean).map((value) => value!.toLowerCase())
  }
  return []
}

export function entryDatePool(entry: CommandPaletteCatalogEntry): number[] {
  if (entry.type === 'transaction') {
    const txDate = toTimestamp(entry.payload.date)
    return txDate ? [txDate] : []
  }
  if (entry.type === 'trip') {
    return [toTimestamp(entry.payload.startDate), toTimestamp(entry.payload.endDate)].filter(
      (value): value is number => typeof value === 'number',
    )
  }
  if (entry.type === 'note') {
    return entry.payload.updatedAt ? [entry.payload.updatedAt] : []
  }
  return []
}

export function paletteEntryId(entry: CommandPaletteCatalogEntry) {
  if (entry.type === 'note') return `note:${entry.payload.id}`
  if (entry.type === 'transaction') return `transaction:${entry.payload.id}`
  return `trip:${entry.payload.id}`
}

export function paletteItemFromEntry(entry: CommandPaletteCatalogEntry): CommandPaletteItem | null {
  if (entry.type === 'note') {
    const note = entry.payload
    return {
      id: paletteEntryId(entry),
      type: 'note',
      icon: '🗒️',
      title: note.title || 'Sans titre',
      subtitle: note.summary || 'Résumé indisponible',
      badge: note.status || 'Brouillon',
      meta: new Date(note.updatedAt).toLocaleDateString(),
    }
  }
  if (entry.type === 'transaction') {
    const txn = entry.payload
    const amountLabel = formatCurrency(txn.amount, txn.accountCurrency || 'EUR')
    return {
      id: paletteEntryId(entry),
      type: 'transaction',
      icon: txn.type === 'expense' ? '💸' : '💰',
      title: txn.label,
      subtitle: [txn.accountName, txn.categoryName].filter(Boolean).join(' · ') || 'Transaction',
      badge: txn.categoryName || undefined,
      meta: `${txn.type === 'expense' ? '-' : '+'}${amountLabel}`,
    }
  }
  const trip = entry.payload
  return {
    id: paletteEntryId(entry),
    type: 'trip',
    icon: '✈️',
    title: trip.title,
    subtitle: `${formatDateLabel(trip.startDate)} → ${formatDateLabel(trip.endDate)}`,
    badge: 'Voyage',
    meta: `${trip.durationDays ?? ''}j`,
  }
}

export function formatDateLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString()
}

export function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

export function truncatePaletteEntries<T>(entries: T[], limit: number) {
  if (entries.length <= limit) return entries
  return entries.slice(0, limit)
}

export function signatureForEntries(entries: CommandPaletteCatalogEntry[]) {
  return JSON.stringify(entries.map((entry) => `${entry.type}:${paletteEntryId(entry)}`))
}

export function isCacheFresh(savedAt: number | null | undefined, ttlMs: number) {
  if (!savedAt) return false
  return Date.now() - savedAt < ttlMs
}

export function shouldUsePaletteCache(options: { hasLiveEntries: boolean; hasUsableCache: boolean; offline: boolean }) {
  if (!options.hasUsableCache) return false
  if (options.offline) return true
  return !options.hasLiveEntries
}

export function loadPaletteCacheFromStorage(storageKey: string): PaletteCachePayload | null {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const payload = parsed as PaletteCachePayload & { entries?: unknown }
    if (!Array.isArray(payload.entries)) return null
    const entries = payload.entries.filter(isValidPaletteEntry)
    return {
      entries,
      savedAt: typeof payload.savedAt === 'number' ? payload.savedAt : Date.now(),
      lastSyncAt: typeof payload.lastSyncAt === 'number' ? payload.lastSyncAt : null,
    }
  } catch (err) {
    console.warn('Failed to load palette cache', err)
    return null
  }
}

export function savePaletteCacheToStorage(storageKey: string, payload: PaletteCachePayload) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(payload))
  } catch (err) {
    console.warn('Failed to persist palette cache', err)
  }
}

export function clearPaletteCacheStorage(storageKey: string) {
  try {
    window.localStorage.removeItem(storageKey)
  } catch (err) {
    console.warn('Failed to clear palette cache', err)
  }
}

function isValidPaletteEntry(entry: unknown): entry is CommandPaletteCatalogEntry {
  if (!entry || typeof entry !== 'object') return false
  const record = entry as CommandPaletteCatalogEntry
  if (record.type === 'note' && record.payload && typeof record.payload === 'object') {
    return typeof record.payload.id === 'string'
  }
  if (record.type === 'transaction' && record.payload && typeof record.payload === 'object') {
    return typeof record.payload.id === 'string'
  }
  if (record.type === 'trip' && record.payload && typeof record.payload === 'object') {
    return typeof record.payload.id === 'string'
  }
  return false
}
