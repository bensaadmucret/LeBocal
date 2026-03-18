import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildPaletteSections,
  evaluateEntry,
  isCacheFresh,
  loadPaletteCacheFromStorage,
  parsePaletteQuery,
  savePaletteCacheToStorage,
  clearPaletteCacheStorage,
  type CommandPaletteCatalogEntry,
} from './paletteEngine'

describe('parsePaletteQuery', () => {
  it('extrait correctement les filtres type/tag/date et les tokens texte', () => {
    const filters = parsePaletteQuery('type:note urgent tag:prod date:today revue')
    expect(filters.typeFilters.has('note')).toBe(true)
    expect(filters.tagFilters).toContain('prod')
    expect(filters.dateFilters).toHaveLength(1)
    expect(filters.textTokens).toEqual(['urgent', 'revue'])
    expect(filters.hasFilters).toBe(true)
  })
})

describe('buildPaletteSections & evaluateEntry', () => {
  const limits = { notes: 5, transactions: 5, trips: 5 }
  const baseEntries: CommandPaletteCatalogEntry[] = [
    {
      type: 'note',
      payload: {
        id: 'note-1',
        title: 'Plan Alpha',
        summary: 'Revue critique',
        status: 'Brouillon',
        tags: ['prod'],
        updatedAt: Date.now(),
      },
    },
    {
      type: 'transaction',
      payload: {
        id: 'txn-1',
        label: 'Facture design',
        accountName: 'Bocal Banque',
        categoryName: 'Design',
        amount: 420,
        memo: 'UI Sprint',
        date: '2024-01-04',
        type: 'expense',
        accountCurrency: 'EUR',
      },
    },
    {
      type: 'trip',
      payload: {
        id: 'trip-1',
        title: 'Offsite Barcelone',
        startDate: '2024-05-01',
        endDate: '2024-05-05',
        durationDays: 4,
        notes: 'Team building',
        estimatedTotal: 2500,
        updatedAt: Date.now() - 1_000_000,
      },
    },
  ]

  it('retourne les sections triées avec limites respectées', () => {
    const sections = buildPaletteSections(baseEntries, '', limits)
    expect(sections).toHaveLength(3)
    expect(sections[0].items).toHaveLength(1)
    expect(sections[1].items).toHaveLength(1)
    expect(sections[2].items).toHaveLength(1)
  })

  it('applique correctement les filtres saisis', () => {
    const sections = buildPaletteSections(baseEntries, 'type:note alpha', limits)
    const noteSection = sections.find((section) => section.id === 'notes')
    const transactionSection = sections.find((section) => section.id === 'transactions')
    expect(noteSection?.items).toHaveLength(1)
    expect(transactionSection?.items).toHaveLength(0)
  })

  it("évalue l'entrée avec prise en compte des tokens", () => {
    const filters = parsePaletteQuery('facture design')
    const evaluation = evaluateEntry(baseEntries[1], filters)
    expect(evaluation.passes).toBe(true)
    const failingFilters = parsePaletteQuery('facture acoustique')
    const failingEvaluation = evaluateEntry(baseEntries[1], failingFilters)
    expect(failingEvaluation.passes).toBe(false)
  })
})

describe('Cache helpers', () => {
  const STORAGE_KEY = 'vitest:palette-cache'
  const payload = {
    entries: [
      {
        type: 'note' as const,
        payload: {
          id: 'note-cache',
          title: 'Note cache',
          summary: '',
          status: 'Brouillon',
          tags: [],
          updatedAt: Date.now(),
        },
      },
    ],
    savedAt: Date.now(),
    lastSyncAt: Date.now() - 1_000,
  }

  beforeEach(() => {
    const storage: Record<string, string> = {}
    const localStorage = {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value
      },
      removeItem: (key: string) => {
        delete storage[key]
      },
    }
    ;(globalThis as any).window = { localStorage }
  })

  it('persiste et recharge le cache palette', () => {
    savePaletteCacheToStorage(STORAGE_KEY, payload)
    const loaded = loadPaletteCacheFromStorage(STORAGE_KEY)
    expect(loaded?.entries[0]?.payload.title).toBe('Note cache')
    expect(loaded?.lastSyncAt).toBe(payload.lastSyncAt)
  })

  it('nettoie le cache si clearPaletteCacheStorage est invoqué', () => {
    savePaletteCacheToStorage(STORAGE_KEY, payload)
    clearPaletteCacheStorage(STORAGE_KEY)
    const loaded = loadPaletteCacheFromStorage(STORAGE_KEY)
    expect(loaded).toBeNull()
  })

  it('détermine la fraîcheur selon un TTL', () => {
    const now = Date.now()
    expect(isCacheFresh(now - 1_000, 5_000)).toBe(true)
    expect(isCacheFresh(now - 10_000, 5_000)).toBe(false)
  })
})
