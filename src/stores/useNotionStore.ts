import { ref, computed } from 'vue'

export interface NotionConfig {
  accessToken: string
  workspaceName: string | null
  connectedAt: string | null
}

export interface NotionSyncStatus {
  lastSyncAt: string | null
  syncCount: number
  errors: string[]
  isSyncing: boolean
}

export interface NotionSearchResult {
  id: string
  title: string
  url: string
  icon: string | null
  parentType: string
}

export interface NotionPageDetail {
  id: string
  url: string
  title: string
  createdTime: string
  lastEditedTime: string
}

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export function useNotionStore() {
  const config = ref<NotionConfig | null>(null)
  const status = ref<NotionSyncStatus>({ lastSyncAt: null, syncCount: 0, errors: [], isSyncing: false })
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isConnected = computed(() => !!config.value?.accessToken)

  async function connect(accessToken: string) {
    loading.value = true
    error.value = null
    try {
      if (!isTauri) throw new Error('Disponible uniquement dans l\'app desktop')
      const { invoke } = await import('@tauri-apps/api/core')
      const result = await invoke<NotionConfig>('notion_connect', { accessToken })
      config.value = result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      error.value = message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function disconnect() {
    loading.value = true
    error.value = null
    try {
      if (!isTauri) return
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('notion_disconnect')
      config.value = null
      status.value = { lastSyncAt: null, syncCount: 0, errors: [], isSyncing: false }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      error.value = message
    } finally {
      loading.value = false
    }
  }

  async function fetchStatus() {
    try {
      if (!isTauri) return
      const { invoke } = await import('@tauri-apps/api/core')
      status.value = await invoke<NotionSyncStatus>('notion_status')
    } catch { /* ignore */ }
  }

  async function loadConfig() {
    try {
      if (!isTauri) return
      // Load from user preferences which includes notion_config
      const { invoke } = await import('@tauri-apps/api/core')
      const userPrefs = await invoke<{ notionConfig?: NotionConfig | null }>('get_user_preferences')
      if (userPrefs?.notionConfig) {
        config.value = userPrefs.notionConfig
      }
    } catch { /* ignore */ }
  }

  async function search(query: string): Promise<NotionSearchResult[]> {
    if (!isTauri) return []
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke<NotionSearchResult[]>('notion_search', { query })
  }

  async function getPage(pageId: string): Promise<NotionPageDetail> {
    if (!isTauri) throw new Error('Not available')
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke<NotionPageDetail>('notion_get_page', { pageId })
  }

  async function pushNote(noteId: string, parentPageId: string) {
    loading.value = true
    error.value = null
    try {
      if (!isTauri) throw new Error('Not available')
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('notion_push_note', { noteId, parentPageId })
      status.value.syncCount++
      status.value.lastSyncAt = new Date().toISOString()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      error.value = message
      status.value.errors.push(message)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function pushAllNotes(parentPageId: string) {
    loading.value = true
    status.value.isSyncing = true
    error.value = null
    try {
      if (!isTauri) throw new Error('Not available')
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('notion_push_all_notes', { parentPageId })
      status.value.lastSyncAt = new Date().toISOString()
      await fetchStatus()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      error.value = message
      status.value.errors.push(message)
      throw err
    } finally {
      loading.value = false
      status.value.isSyncing = false
    }
  }

  return {
    config, status, loading, error, isConnected,
    connect, disconnect, fetchStatus, loadConfig, search, getPage, pushNote, pushAllNotes,
  }
}
