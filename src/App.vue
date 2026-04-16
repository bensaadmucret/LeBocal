<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppShell } from './composables/useAppShell'
import { useTheme } from './composables/useTheme'
import { useUserStore } from './stores/useUserStore'
import CommandPalette from './components/common/CommandPalette.vue'
import NoteComposerModal from './components/notes/NoteComposerModal.vue'
import type { Block } from './stores/useNotesStore'

const route = useRoute()
const router = useRouter()
const shell = useAppShell()
const { isDark, toggleTheme } = useTheme()
const user = useUserStore()

const sidebarOpen = ref(false)

// Avatar logic (same as DesktopWorkspace)
const sidebarAvatarPath = ref('')

const sidebarInitial = computed(() => {
  const name = user.profile.value?.displayName
  return name ? name[0].toUpperCase() : '?'
})

const sidebarAvatarUrl = computed(() => {
  if (sidebarAvatarPath.value?.startsWith('data:image/')) {
    return sidebarAvatarPath.value
  }
  return null
})

onMounted(() => {
  sidebarAvatarPath.value = user.profile.value?.avatarPath || ''
})

watch(() => user.profile.value?.avatarPath, (newPath) => {
  if (newPath !== sidebarAvatarPath.value) {
    sidebarAvatarPath.value = newPath || ''
  }
}, { immediate: true })

const navItems = computed(() => [
  { label: 'Tableau de bord', icon: '🏠', to: '/dashboard', active: route.path === '/dashboard' || route.path === '/' },
  { label: 'Notes', icon: '🗒️', to: '/notes', active: route.path.startsWith('/notes') },
  { label: 'Budget', icon: '💶', to: '/budget', active: route.path === '/budget' },
  { label: 'Calendrier', icon: '📅', to: '/calendar', active: route.path === '/calendar' },
  { label: 'Paramètres', icon: '⚙️', to: '/settings', active: route.path === '/settings' },
])

const quickFlow = computed(() => {
  const notes = shell.store.notes.value
  const reviewCount = notes.filter((note) => note.status?.toLowerCase().includes('rev')).length
  const pendingBlocks = notes.reduce((sum, note) => sum + (note.blocks?.length || 0), 0)
  const lastSyncLabel = shell.lastSyncAt.value ? shell.formatRelativeTime(shell.lastSyncAt.value) : '—'
  return { reviewCount, pendingBlocks, lastSyncLabel }
})

const toastVariants: Record<string, string> = {
  info: 'bg-ink text-white',
  success: 'bg-emerald-500 text-white',
  error: 'bg-rose-600 text-white',
}
</script>

<template>
  <div class="min-h-screen text-[var(--text-main)] transition-colors duration-300">
    <div class="mx-auto flex flex-col lg:flex-row min-h-screen max-w-7xl gap-6 lg:gap-10 px-4 sm:px-6 lg:px-10 py-6 lg:py-10">
      <!-- Mobile Header -->
      <div class="lg:hidden flex items-center justify-between mb-2">
        <div class="flex items-center gap-3">
          <div class="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
            <span class="text-xl">📁</span>
          </div>
          <h2 class="font-display font-semibold text-[var(--text-main)]">Le Bocal</h2>
        </div>
        <button
          class="h-10 w-10 rounded-xl bg-[var(--surface-card)] flex items-center justify-center shadow-md ring-1 ring-black/5 dark:ring-white/10"
          @click="sidebarOpen = !sidebarOpen"
        >
          <span>{{ sidebarOpen ? '✕' : '☰' }}</span>
        </button>
      </div>

      <!-- Sidebar -->
      <aside
        class="sticky top-6 lg:top-10 self-start flex w-full lg:w-60 flex-col items-center gap-4 lg:gap-6 rounded-[32px] lg:rounded-[40px] p-5 lg:p-6 animate-fade-in shadow-xl dark:bg-[var(--surface)] transition-all duration-300 overflow-hidden z-50"
        :class="[sidebarOpen ? 'max-h-[1000px] opacity-100 bg-[var(--surface-card)]' : 'max-h-0 lg:max-h-none opacity-0 lg:opacity-100 hidden lg:flex glass-card']"
      >
        <div class="text-center">
          <p class="text-xs uppercase tracking-[0.35em] text-[var(--text-muted)]">Le Bocal</p>
          <p class="text-sm text-[var(--text-muted)] opacity-80">Workspace</p>
        </div>
        <div class="h-16 w-16 rounded-2xl border-2 border-white shadow-lg overflow-hidden bg-gradient-to-br from-[var(--accent)] to-[var(--accent-secondary)] flex items-center justify-center">
          <img 
            v-if="sidebarAvatarUrl" 
            :src="sidebarAvatarUrl" 
            class="h-full w-full object-cover" 
            alt="avatar" 
          />
          <span v-else class="text-white font-semibold text-2xl">{{ sidebarInitial }}</span>
        </div>
        <nav class="flex w-full flex-col gap-4">
          <router-link
            v-for="item in navItems"
            :key="item.label"
            :to="item.to"
            class="tap-effect flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition-all"
            :class="item.active ? 'bg-sage text-anthracite shadow-md scale-105 font-semibold' : 'text-gray-500 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-white/5'"
            @click="sidebarOpen = false"
          >
            <span>{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </router-link>
        </nav>
        <button class="tap-effect mt-2 flex h-14 w-14 items-center justify-center rounded-[20px] bg-clay text-mist shadow-xl shadow-clay/20 hover:scale-105 transition-transform" @click="shell.handleCreateNote">
          <span class="text-2xl font-bold">+</span>
        </button>

        <div class="w-full rounded-2xl bg-[var(--surface-card)] dark:bg-[var(--glass-bg)] p-4 text-sm text-[var(--text-main)] shadow-sm ring-1 ring-black/5 dark:ring-white/5">
          <p class="text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)] font-bold">Flux rapide</p>
          <ul class="mt-3 space-y-2 text-xs">
            <li>{{ quickFlow.reviewCount }} notes en revue</li>
            <li>{{ quickFlow.pendingBlocks }} blocs en cours</li>
            <li>Sync {{ quickFlow.lastSyncLabel }}</li>
          </ul>
        </div>

        <button
          class="tap-effect flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition-all text-gray-500 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-white/5"
          :title="isDark ? 'Passer au mode jour' : 'Passer au mode nuit'"
          @click="toggleTheme"
        >
          <span class="text-lg">{{ isDark ? '☀️' : '🌙' }}</span>
          <span>{{ isDark ? 'Mode jour' : 'Mode nuit' }}</span>
        </button>
      </aside>

      <!-- Main Content -->
      <main class="flex-1">
        <router-view />


      </main>
    </div>

    <!-- Loading Overlay -->
    <transition name="fade">
      <div v-if="!shell.initialSyncCompleted.value" class="fixed inset-0 z-[60] flex items-center justify-center bg-[#f6eede]/80 backdrop-blur-xl">
        <div class="flex items-center gap-4 rounded-3xl bg-white p-8 text-base font-medium text-anthracite shadow-2xl border border-black/5">
          <span class="h-5 w-5 animate-spin rounded-full border-2 border-sage border-t-transparent"></span>
          Initialisation du Bocal…
        </div>
      </div>
    </transition>

    <!-- Note Composer Modal (global) -->
    <NoteComposerModal
      :open="shell.noteComposerOpen.value"
      :saving="shell.noteComposerSavingMode.value !== null"
      :clear-trigger="shell.noteComposerClearTrigger.value"
      @close="shell.handleCloseNoteComposer"
      @save="shell.handleComposerSave"
      @publish="shell.handleComposerPublish"
      @create-collection="shell.handleComposerCreateCollection"
    />

    <!-- Command Palette (global) -->
    <CommandPalette
      :open="shell.commandPaletteOpen.value"
      :query="shell.commandPaletteQuery.value"
      :sections="shell.commandPaletteSections.value"
      :uses-cache="shell.commandPaletteUsesCache.value"
      :cache-last-sync="shell.paletteCacheLastSyncLabel.value"
      @close="shell.handleCommandPaletteClose"
      @update:query="shell.commandPaletteQuery.value = $event"
      @select="shell.handleCommandPaletteSelect"
    />

    <!-- Toasts (global) -->
    <div class="fixed bottom-6 right-6 z-[80] flex flex-col gap-2">
      <transition-group name="fade">
        <div
          v-for="toast in shell.toasts.value"
          :key="toast.id"
          :class="toastVariants[toast.type] || toastVariants.info"
          class="rounded-xl px-5 py-3 text-sm font-medium shadow-xl backdrop-blur-sm cursor-pointer"
          @click="shell.dismissToast(toast.id)"
        >
          {{ toast.message }}
        </div>
      </transition-group>
    </div>
  </div>
</template>
