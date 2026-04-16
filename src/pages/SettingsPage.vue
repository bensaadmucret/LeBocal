<script setup lang="ts">
import { ref } from 'vue'
import UserSettings from '../components/settings/UserSettings.vue'
import ShortcutSettings from '../components/settings/ShortcutSettings.vue'
import NotionSettings from '../components/settings/NotionSettings.vue'

type Section = 'account' | 'shortcuts' | 'notion' | 'advanced'

const activeSection = ref<Section>('account')

const sections: { id: Section; label: string; icon: string; desc: string }[] = [
  { id: 'account', label: 'Compte', icon: '👤', desc: 'Profil et préférences personnelles' },
  { id: 'shortcuts', label: 'Raccourcis', icon: '⌨️', desc: 'Configuration clavier personnalisée' },
  { id: 'notion', label: 'Notion', icon: '🔗', desc: 'Synchronisation avec Notion' },
  { id: 'advanced', label: 'Avancé', icon: '⚙️', desc: 'Options avancées de l\'application' },
]
</script>

<template>
  <div class="space-y-6 lg:space-y-8">
    <!-- Header -->
    <header>
      <p class="text-xs uppercase tracking-[0.4em] text-[var(--text-muted)]">Paramètres</p>
      <h1 class="font-display text-2xl lg:text-3xl font-semibold text-[var(--text-main)]">Configuration</h1>
    </header>

    <!-- Navigation Cards -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <button
        v-for="section in sections"
        :key="section.id"
        @click="activeSection = section.id"
        :class="[
          'glass-card p-4 rounded-2xl text-left transition-all',
          activeSection === section.id
            ? 'ring-2 ring-[var(--accent)] bg-[var(--accent)]/5'
            : 'hover:bg-[var(--glass-bg)]'
        ]"
      >
        <div class="flex items-start gap-3">
          <span class="text-2xl">{{ section.icon }}</span>
          <div>
            <h3 class="font-display font-semibold text-[var(--text-main)]">{{ section.label }}</h3>
            <p class="text-xs text-[var(--text-muted)] mt-1">{{ section.desc }}</p>
          </div>
        </div>
      </button>
    </div>

    <!-- Content Area -->
    <div class="min-h-[400px]">
      <UserSettings v-if="activeSection === 'account'" />
      <ShortcutSettings v-if="activeSection === 'shortcuts'" />
      <NotionSettings v-if="activeSection === 'notion'" />
      
      <!-- Advanced Section -->
      <div v-if="activeSection === 'advanced'" class="glass-card rounded-[32px] p-6 shadow-xl">
        <div class="flex items-center gap-3 mb-6">
          <span class="text-2xl">⚙️</span>
          <div>
            <h3 class="font-display text-lg font-semibold text-[var(--text-main)]">Options avancées</h3>
            <p class="text-xs text-[var(--text-muted)]">Paramètres techniques et maintenance</p>
          </div>
        </div>

        <div class="space-y-4">
          <div class="flex items-center justify-between p-4 bg-[var(--glass-bg)] rounded-xl">
            <div>
              <p class="font-medium text-[var(--text-main)]">Version de l'application</p>
              <p class="text-xs text-[var(--text-muted)]">v0.1.0 (Tauri + Vue 3)</p>
            </div>
            <span class="text-xs px-2 py-1 bg-[var(--accent)]/10 text-[var(--accent)] rounded">Beta</span>
          </div>

          <div class="flex items-center justify-between p-4 bg-[var(--glass-bg)] rounded-xl">
            <div>
              <p class="font-medium text-[var(--text-main)]">Base de données</p>
              <p class="text-xs text-[var(--text-muted)]">SQLite locale (le-bocal-prod.db)</p>
            </div>
            <span class="text-xs px-2 py-1 bg-emerald-500/10 text-emerald-600 rounded">OK</span>
          </div>

          <div class="flex items-center justify-between p-4 bg-[var(--glass-bg)] rounded-xl">
            <div>
              <p class="font-medium text-[var(--text-main)]">Cache et données temporaires</p>
              <p class="text-xs text-[var(--text-muted)]">Nettoyage des fichiers obsolètes</p>
            </div>
            <button class="px-4 py-2 bg-[var(--accent)]/10 text-[var(--accent)] rounded-lg hover:bg-[var(--accent)]/20 transition-colors text-sm font-medium">
              Nettoyer
            </button>
          </div>

          <div class="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <p class="text-sm text-amber-600 dark:text-amber-400 font-medium">🛠️ Mode développeur</p>
            <p class="text-xs text-[var(--text-muted)] mt-1">
              Logs détaillés et outils de débogage activés en mode dev.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
