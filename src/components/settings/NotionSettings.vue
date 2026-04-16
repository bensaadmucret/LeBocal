<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useNotionStore } from '../../stores/useNotionStore'
import type { NotionSearchResult } from '../../stores/useNotionStore'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

async function openExternal(url: string) {
  if (isTauri) {
    try {
      const { open } = await import('@tauri-apps/plugin-shell')
      await open(url)
    } catch {
      window.open(url, '_blank')
    }
  } else {
    window.open(url, '_blank')
  }
}

const notion = useNotionStore()

const tokenInput = ref('')
const searchQuery = ref('')
const searchResults = ref<NotionSearchResult[]>([])
const selectedParentPage = ref<NotionSearchResult | null>(null)
const showToken = ref(false)

onMounted(async () => {
  await notion.loadConfig()
  await notion.fetchStatus()
})

const canConnect = computed(() => tokenInput.value.trim().startsWith('ntn_') || tokenInput.value.trim().startsWith('secret_'))

async function handleConnect() {
  if (!canConnect.value) return
  try {
    await notion.connect(tokenInput.value.trim())
    tokenInput.value = ''
    showToken.value = false
  } catch { /* error shown via store */ }
}

async function handleDisconnect() {
  await notion.disconnect()
  selectedParentPage.value = null
  searchResults.value = []
}

async function handleSearch() {
  if (!searchQuery.value.trim()) return
  try {
    searchResults.value = await notion.search(searchQuery.value.trim())
  } catch { /* ignore */ }
}

async function handleSyncAll() {
  if (!selectedParentPage.value) return
  try {
    await notion.pushAllNotes(selectedParentPage.value.id)
  } catch { /* error shown via store */ }
}

async function handleSelectPage(page: NotionSearchResult) {
  selectedParentPage.value = page
}
</script>

<template>
  <div class="space-y-6">
    <!-- Connection Section -->
    <div class="glass-card rounded-[32px] p-6 shadow-xl">
      <div class="flex items-center gap-3 mb-4">
        <span class="text-2xl">🔗</span>
        <div>
          <h3 class="font-display text-lg font-semibold text-[var(--text-main)]">Notion</h3>
          <p class="text-xs text-[var(--text-muted)]">Synchronisez vos notes avec votre workspace Notion</p>
        </div>
      </div>

      <!-- Connected State -->
      <div v-if="notion.isConnected.value" class="space-y-4">
        <div class="flex items-center gap-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 p-4">
          <span class="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm">✓</span>
          <div>
            <p class="text-sm font-medium text-emerald-800 dark:text-emerald-200">Connecté</p>
            <p class="text-xs text-emerald-600 dark:text-emerald-400">
              {{ notion.config.value?.workspaceName || 'Workspace' }}
              <span v-if="notion.config.value?.connectedAt"> · depuis {{ new Date(notion.config.value.connectedAt).toLocaleDateString('fr-FR') }}</span>
            </p>
          </div>
        </div>

        <button
          class="rounded-xl border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 transition"
          :disabled="notion.loading.value"
          @click="handleDisconnect"
        >
          Déconnecter
        </button>
      </div>

      <!-- Disconnected State -->
      <div v-else class="space-y-4">
        <div class="rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 p-6 text-center">
          <p class="text-sm text-[var(--text-muted)] mb-1">1. Créez une intégration sur</p>
          <a href="#" class="text-sm font-semibold text-indigo-500 hover:underline" @click.prevent="openExternal('https://www.notion.so/my-integrations')">notion.so/my-integrations</a>
          <p class="text-sm text-[var(--text-muted)] mt-3 mb-1">2. Copiez le token (commence par <code class="rounded bg-gray-100 px-1.5 py-0.5 text-xs">ntn_</code>)</p>
          <p class="text-sm text-[var(--text-muted)] mt-3 mb-1">3. Collez-le ci-dessous</p>
        </div>

        <div class="flex gap-2">
          <div class="flex-1 relative">
            <input
              v-model="tokenInput"
              :type="showToken ? 'text' : 'password'"
              class="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage/30 pr-10"
              placeholder="ntn_xxxxxxxxxxxxxx"
              @keydown.enter="handleConnect"
            />
            <button
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              @click="showToken = !showToken"
            >
              {{ showToken ? '🙈' : '👁️' }}
            </button>
          </div>
          <button
            class="rounded-xl bg-sage px-5 py-2.5 text-sm font-semibold text-anthracite shadow-lg shadow-sage/20 hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
            :disabled="!canConnect || notion.loading.value"
            @click="handleConnect"
          >
            {{ notion.loading.value ? 'Connexion…' : 'Connecter' }}
          </button>
        </div>

        <p v-if="notion.error.value" class="text-xs text-rose-500">{{ notion.error.value }}</p>
      </div>
    </div>

    <!-- Sync Section (only if connected) -->
    <div v-if="notion.isConnected.value" class="glass-card rounded-[32px] p-6 shadow-xl">
      <h3 class="font-display text-lg font-semibold text-[var(--text-main)] mb-2">Synchronisation</h3>
      <p class="text-xs text-[var(--text-muted)] mb-4">Choisissez une page parent dans Notion où synchroniser vos notes.</p>

      <!-- Search -->
      <div class="flex gap-2 mb-4">
        <input
          v-model="searchQuery"
          class="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage/30"
          placeholder="Rechercher une page Notion…"
          @keydown.enter="handleSearch"
        />
        <button
          class="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition"
          @click="handleSearch"
        >
          🔍
        </button>
      </div>

      <!-- Search Results -->
      <div v-if="searchResults.length" class="space-y-1 mb-4 max-h-48 overflow-y-auto">
        <button
          v-for="page in searchResults"
          :key="page.id"
          class="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition"
          :class="selectedParentPage?.id === page.id ? 'bg-sage/10 ring-1 ring-sage/30' : ''"
          @click="handleSelectPage(page)"
        >
          <span>{{ page.icon || '📄' }}</span>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-[var(--text-main)] truncate">{{ page.title }}</p>
            <p class="text-xs text-[var(--text-muted)]">{{ page.parentType }}</p>
          </div>
          <span v-if="selectedParentPage?.id === page.id" class="text-sage font-bold">✓</span>
        </button>
      </div>

      <!-- Selected Parent -->
      <div v-if="selectedParentPage" class="rounded-2xl bg-sage/5 p-4 mb-4">
        <p class="text-xs uppercase tracking-widest text-[var(--text-muted)] font-bold">Destination</p>
        <p class="text-sm font-medium text-[var(--text-main)] mt-1">
          {{ selectedParentPage.icon }} {{ selectedParentPage.title }}
        </p>
      </div>

      <!-- Sync Buttons -->
      <div class="flex gap-2">
        <button
          class="flex-1 rounded-xl bg-sage px-5 py-3 text-sm font-semibold text-anthracite shadow-lg shadow-sage/20 hover:scale-105 transition-transform disabled:opacity-50"
          :disabled="!selectedParentPage || notion.status.value.isSyncing"
          @click="handleSyncAll"
        >
          {{ notion.status.value.isSyncing ? '⏳ Synchronisation…' : '⬆️ Tout synchroniser' }}
        </button>
      </div>

      <!-- Status -->
      <div v-if="notion.status.value.lastSyncAt" class="mt-4 text-xs text-[var(--text-muted)]">
        <p>✓ Dernière sync : {{ new Date(notion.status.value.lastSyncAt).toLocaleString('fr-FR') }}</p>
        <p>{{ notion.status.value.syncCount }} notes synchronisées</p>
      </div>

      <div v-if="notion.status.value.errors.length" class="mt-4 space-y-1">
        <p v-for="(err, i) in notion.status.value.errors.slice(-3)" :key="i" class="text-xs text-rose-500">⚠️ {{ err }}</p>
      </div>
    </div>
  </div>
</template>
