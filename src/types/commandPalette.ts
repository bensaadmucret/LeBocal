export type CommandPaletteItemType = 'note' | 'transaction' | 'trip'

export interface CommandPaletteItem {
  id: string
  type: CommandPaletteItemType
  title: string
  subtitle?: string
  badge?: string
  icon?: string
  meta?: string
}

export interface CommandPaletteSection {
  id: string
  label: string
  items: CommandPaletteItem[]
}
