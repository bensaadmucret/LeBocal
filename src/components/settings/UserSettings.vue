<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useUserStore } from '../../stores/useUserStore'
import { invoke } from '@tauri-apps/api/core'

type Tab = 'profile' | 'preferences' | 'advanced'

const activeTab = ref<Tab>('profile')
const user = useUserStore()

// Form state
const displayName = ref('')
const email = ref('')
const language = ref('fr')
const dateFormat = ref('DD/MM/YYYY')
const weekStartsOn = ref<'monday' | 'sunday'>('monday')
const defaultNoteStatus = ref('draft')
const avatarPath = ref('')
const isUploading = ref(false)
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

// Avatar URL - either from uploaded image (base64) or generated from name
const avatarUrl = computed(() => {
  if (avatarPath.value?.startsWith('data:image/')) {
    return avatarPath.value
  }
  return null
})

onMounted(async () => {
  await user.load()
  // Sync form with store
  displayName.value = user.profile.value.displayName || ''
  email.value = user.profile.value.email || ''
  language.value = user.preferences.value.language
  dateFormat.value = user.preferences.value.dateFormat
  weekStartsOn.value = user.preferences.value.weekStartsOn
  defaultNoteStatus.value = user.preferences.value.defaultNoteStatus
  avatarPath.value = user.profile.value.avatarPath || ''
  
  console.log('Avatar loaded:', user.profile.value.avatarPath?.slice(0, 50))
})

// Watch for external changes to profile
watch(() => user.profile.value.avatarPath, (newPath) => {
  if (newPath !== avatarPath.value) {
    avatarPath.value = newPath || ''
    console.log('Avatar updated from store:', newPath?.slice(0, 50))
  }
}, { immediate: true })

async function saveProfile() {
  await user.updateProfile({
    displayName: displayName.value || undefined,
    email: email.value || undefined,
    avatarPath: avatarPath.value || undefined,
  })
}

async function selectAvatar() {
  // Use HTML file input for both mock and Tauri
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/jpeg,image/png,image/gif,image/webp'
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    
    console.log('Selected file:', file.name, 'Size:', (file.size / 1024).toFixed(1), 'KB')
    
    // Check file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image trop grande (max 2MB)')
      return
    }
    
    isUploading.value = true
    
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string
        console.log('Image loaded, base64 length:', base64Data.length)
        
        if (isTauri) {
          try {
            // Validate via Tauri command
            const validated = await invoke<string>('upload_avatar', {
              base64Data: base64Data
            })
            console.log('Tauri validation passed')
            avatarPath.value = validated
            await saveProfile()
          } catch (err) {
            console.error('Tauri upload failed:', err)
            alert('Erreur lors de la sauvegarde: ' + err)
          }
        } else {
          // Mock mode - store directly
          avatarPath.value = base64Data
          await saveProfile()
        }
        
        isUploading.value = false
      }
      reader.onerror = () => {
        console.error('FileReader error')
        alert('Erreur lors de la lecture du fichier')
        isUploading.value = false
      }
      reader.readAsDataURL(file)
    } catch (err) {
      console.error('Failed to upload avatar:', err)
      isUploading.value = false
    }
  }
  input.click()
}

async function removeAvatar() {
  avatarPath.value = ''
  await saveProfile()
}

async function savePreferences() {
  await user.updatePreferences({
    language: language.value,
    dateFormat: dateFormat.value,
    weekStartsOn: weekStartsOn.value,
    defaultNoteStatus: defaultNoteStatus.value,
  })
}

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'profile', label: 'Profil', icon: '👤' },
  { id: 'preferences', label: 'Préférences', icon: '⚙️' },
  { id: 'advanced', label: 'Avancé', icon: '🔧' },
]
</script>

<template>
  <div class="glass-card rounded-[32px] p-6 shadow-xl">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-6">
      <span class="text-2xl">👤</span>
      <div>
        <h3 class="font-display text-lg font-semibold text-[var(--text-main)]">Compte utilisateur</h3>
        <p class="text-xs text-[var(--text-muted)]">Gérez votre profil et vos préférences</p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2 mb-6 p-1 bg-[var(--glass-border)] rounded-2xl">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="activeTab = tab.id"
        :class="[
          'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
          activeTab === tab.id
            ? 'bg-[var(--glass-bg)] text-[var(--text-main)] shadow-sm'
            : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
        ]"
      >
        <span>{{ tab.icon }}</span>
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <!-- Tab Content -->
    <div class="space-y-4">
      <!-- Profile Tab -->
      <div v-if="activeTab === 'profile'" class="space-y-4">
        <!-- Avatar Section -->
        <div class="flex items-center gap-4 p-4 bg-[var(--glass-bg)] rounded-xl">
          <div class="relative">
            <!-- Avatar Image or Initial -->
            <div 
              class="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-[var(--accent)] to-[var(--accent-secondary)] flex items-center justify-center text-2xl"
            >
              <img 
                v-if="avatarUrl" 
                :src="avatarUrl" 
                alt="Avatar"
                class="w-full h-full object-cover"
                @error="console.error('Avatar image failed to load')"
              />
              <span v-else class="text-white font-semibold text-3xl">
                {{ displayName ? displayName[0].toUpperCase() : '?' }}
              </span>
            </div>
            <!-- Upload overlay button -->
            <button
              @click="selectAvatar"
              :disabled="isUploading"
              class="absolute bottom-0 right-0 w-8 h-8 bg-[var(--accent)] rounded-full flex items-center justify-center shadow-lg hover:bg-[var(--accent-secondary)] transition-colors translate-x-1/4 translate-y-1/4"
              :class="{ 'opacity-50 cursor-not-allowed': isUploading }"
            >
              <span v-if="!isUploading" class="text-white text-sm">📷</span>
              <span v-else class="text-white text-xs">⏳</span>
            </button>
          </div>
          
          <div class="flex-1">
            <p class="font-medium text-[var(--text-main)]">Photo de profil</p>
            <p class="text-xs text-[var(--text-muted)] mb-2">
              JPG, PNG ou WebP (max 2MB)
            </p>
            <div class="flex gap-2">
              <button
                @click="selectAvatar"
                :disabled="isUploading"
                class="px-3 py-1.5 bg-[var(--accent)]/10 text-[var(--accent)] rounded-lg text-sm font-medium hover:bg-[var(--accent)]/20 transition-colors"
              >
                {{ avatarUrl ? 'Changer' : 'Ajouter' }}
              </button>
              <button
                v-if="avatarUrl"
                @click="removeAvatar"
                class="px-3 py-1.5 bg-rose-500/10 text-rose-600 rounded-lg text-sm font-medium hover:bg-rose-500/20 transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Nom d'affichage
          </label>
          <input
            v-model="displayName"
            type="text"
            placeholder="Votre nom"
            class="w-full px-4 py-3 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            @blur="saveProfile"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Email
          </label>
          <input
            v-model="email"
            type="email"
            placeholder="votre@email.com"
            class="w-full px-4 py-3 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            @blur="saveProfile"
          />
        </div>

        <!-- Preview Card -->
        <div class="p-4 bg-[var(--glass-bg)] rounded-xl border border-dashed border-[var(--glass-border)]">
          <div class="flex items-center gap-3">
            <div class="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-secondary)] flex items-center justify-center text-2xl overflow-hidden">
              <img 
                v-if="avatarUrl" 
                :src="avatarUrl" 
                alt="Avatar"
                class="w-full h-full object-cover"
              />
              <span v-else class="text-white font-semibold">
                {{ displayName ? displayName[0].toUpperCase() : '?' }}
              </span>
            </div>
            <div>
              <p class="font-medium text-[var(--text-main)]">{{ displayName || 'Sans nom' }}</p>
              <p class="text-sm text-[var(--text-muted)]">{{ email || 'Pas d\'email' }}</p>
            </div>
          </div>
          <p class="text-xs text-[var(--text-muted)] mt-3">
            {{ avatarUrl ? '✨ Avatar personnalisé' : '💡 Avatar généré depuis votre nom' }}
          </p>
        </div>
      </div>

      <!-- Preferences Tab -->
      <div v-if="activeTab === 'preferences'" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Langue
          </label>
          <select
            v-model="language"
            class="w-full px-4 py-3 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            @change="savePreferences"
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Format de date
          </label>
          <select
            v-model="dateFormat"
            class="w-full px-4 py-3 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            @change="savePreferences"
          >
            <option value="DD/MM/YYYY">DD/MM/YYYY (24/01/2024)</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY (01/24/2024)</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD (2024-01-24)</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            La semaine commence le
          </label>
          <div class="flex gap-2">
            <button
              @click="weekStartsOn = 'monday'; savePreferences()"
              :class="[
                'flex-1 px-4 py-3 rounded-xl border transition-all',
                weekStartsOn === 'monday'
                  ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)]'
                  : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-main)]'
              ]"
            >
              Lundi
            </button>
            <button
              @click="weekStartsOn = 'sunday'; savePreferences()"
              :class="[
                'flex-1 px-4 py-3 rounded-xl border transition-all',
                weekStartsOn === 'sunday'
                  ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)]'
                  : 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-main)]'
              ]"
            >
              Dimanche
            </button>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Statut par défaut des nouvelles notes
          </label>
          <select
            v-model="defaultNoteStatus"
            class="w-full px-4 py-3 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            @change="savePreferences"
          >
            <option value="draft">Brouillon</option>
            <option value="review">En revue</option>
            <option value="final">Final</option>
          </select>
        </div>
      </div>

      <!-- Advanced Tab -->
      <div v-if="activeTab === 'advanced'" class="space-y-4">
        <div class="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <p class="text-sm text-amber-600 dark:text-amber-400 font-medium">⚠️ Zone de danger</p>
          <p class="text-xs text-[var(--text-muted)] mt-1">
            Ces actions sont irréversibles. Utilisez-les avec précaution.
          </p>
        </div>

        <div class="flex items-center justify-between p-4 bg-[var(--glass-bg)] rounded-xl">
          <div>
            <p class="font-medium text-[var(--text-main)]">Réinitialiser les préférences</p>
            <p class="text-xs text-[var(--text-muted)]">Retour aux valeurs par défaut</p>
          </div>
          <button
            @click="user.save({ profile: {}, preferences: { language: 'fr', dateFormat: 'DD/MM/YYYY', weekStartsOn: 'monday', defaultNoteStatus: 'draft' } })"
            class="px-4 py-2 bg-rose-500/10 text-rose-600 rounded-lg hover:bg-rose-500/20 transition-colors text-sm font-medium"
          >
            Réinitialiser
          </button>
        </div>

        <div class="flex items-center justify-between p-4 bg-[var(--glass-bg)] rounded-xl">
          <div>
            <p class="font-medium text-[var(--text-main)]">Données locales</p>
            <p class="text-xs text-[var(--text-muted)]">Stockées dans SQLite</p>
          </div>
          <span class="text-xs px-2 py-1 bg-emerald-500/10 text-emerald-600 rounded">
            ✅ Persistant
          </span>
        </div>
      </div>
    </div>

    <!-- Status -->
    <div v-if="user.loading.value" class="mt-4 text-center text-sm text-[var(--text-muted)]">
      Sauvegarde...
    </div>
    <div v-if="user.error.value" class="mt-4 p-3 bg-rose-500/10 text-rose-600 rounded-lg text-sm">
      {{ user.error.value }}
    </div>
  </div>
</template>
