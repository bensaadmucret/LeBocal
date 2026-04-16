import { computed, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'

export interface UserProfile {
  displayName?: string
  email?: string
  avatarPath?: string
}

export interface AppPreferences {
  language: string
  dateFormat: string
  weekStartsOn: 'monday' | 'sunday'
  defaultNoteStatus: string
}

export interface UserPreferences {
  profile: UserProfile
  preferences: AppPreferences
}

const DEFAULT_PREFS: UserPreferences = {
  profile: {},
  preferences: {
    language: 'fr',
    dateFormat: 'DD/MM/YYYY',
    weekStartsOn: 'monday',
    defaultNoteStatus: 'draft',
  },
}

const prefs = ref<UserPreferences>(structuredClone(DEFAULT_PREFS))
const profile = ref<UserProfile>({
  displayName: undefined,
  email: undefined,
  avatarPath: undefined,
})
const preferences = ref<AppPreferences>({ ...DEFAULT_PREFS.preferences })
const loading = ref(false)
const error = ref<string | null>(null)
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export function notifyProfileUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('profile-updated'))
  }
}

function syncRefs() {
  // Update profile properties individually to maintain reactivity
  profile.value.displayName = prefs.value.profile.displayName
  profile.value.email = prefs.value.profile.email
  profile.value.avatarPath = prefs.value.profile.avatarPath
  
  // Update preferences properties individually
  preferences.value.language = prefs.value.preferences.language
  preferences.value.dateFormat = prefs.value.preferences.dateFormat
  preferences.value.weekStartsOn = prefs.value.preferences.weekStartsOn
  preferences.value.defaultNoteStatus = prefs.value.preferences.defaultNoteStatus
}

export function useUserStore() {

  async function load() {
    if (!isTauri) {
      // Mock: load from localStorage
      const saved = localStorage.getItem('le-bocal-user')
      if (saved) {
        try {
          prefs.value = { ...DEFAULT_PREFS, ...JSON.parse(saved) }
          syncRefs()
        } catch { /* ignore */ }
      }
      return
    }
    loading.value = true
    error.value = null
    try {
      const data = await invoke<UserPreferences>('get_user_preferences')
      prefs.value = { ...DEFAULT_PREFS, ...data }
      syncRefs()
    } catch (err) {
      error.value = String(err)
    } finally {
      loading.value = false
    }
  }

  async function save(newPrefs: UserPreferences) {
    prefs.value = newPrefs
    syncRefs()
    notifyProfileUpdate()
    if (!isTauri) {
      localStorage.setItem('le-bocal-user', JSON.stringify(prefs.value))
      return
    }
    loading.value = true
    error.value = null
    try {
      await invoke('set_user_preferences', { prefs: newPrefs })
    } catch (err) {
      error.value = String(err)
    } finally {
      loading.value = false
    }
  }

  async function updateProfile(updates: Partial<UserProfile>) {
    await save({
      ...prefs.value,
      profile: { ...prefs.value.profile, ...updates },
    })
  }

  async function updatePreferences(updates: Partial<AppPreferences>) {
    await save({
      ...prefs.value,
      preferences: { ...prefs.value.preferences, ...updates },
    })
  }

  return {
    profile: profile as typeof profile,
    preferences: preferences as typeof preferences,
    loading,
    error,
    load,
    save,
    updateProfile,
    updatePreferences,
  }
}
