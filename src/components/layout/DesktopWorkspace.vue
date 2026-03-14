<script setup lang="ts">
import { computed } from 'vue'
import StatsGrid from '../common/StatsGrid.vue'
import NotesList from '../notes/NotesList.vue'
import ActiveNotePanel from '../notes/ActiveNotePanel.vue'
import ShortcutSettings from '../settings/ShortcutSettings.vue'

const props = defineProps<{
  navItems: { label: string; icon: string; active?: boolean }[]
  stats: { title: string; value: number; detail: string }[]
  notes: { id: string; title: string; category: string; excerpt: string; status: string; updated: string }[]
  activeNote: {
    id: string
    title: string
    owner: string
    status: string
    tags: string[]
    summary: string
    checklist: { id?: string; label: string; done: boolean }[]
    highlights: string[]
    blocks: { id?: string; type: string; data: Record<string, unknown> }[]
  }
  timeline: { time: string; event: string }[]
  mode?: 'workspace' | 'settings'
  quickFlow?: { reviewCount: number; pendingBlocks: number; lastSyncLabel: string }
  shortcutHints?: { createNote?: string | null }
}>()

const emit = defineEmits([
  'create-note',
  'share',
  'view-all',
  'select-note',
  'update-active-note',
  'edit-note',
  'delete-note',
  'select-nav',
])

const mode = computed(() => props.mode ?? 'workspace')
const quickFlow = computed(() =>
  props.quickFlow || { reviewCount: 0, pendingBlocks: 0, lastSyncLabel: '—' },
)
</script>

<template>
  <section class="rounded-[40px] bg-white/90 p-6 shadow-card ring-1 ring-white/70">
    <div class="grid gap-6 lg:grid-cols-[260px,1fr]">
      <aside class="rounded-[28px] bg-lilac/40 p-5">
        <div>
          <p class="text-xs uppercase tracking-[0.3em] text-gray-500">Navigation</p>
          <h2 class="mt-2 font-display text-2xl text-ink">Le Bocal</h2>
        </div>
        <nav class="mt-6 space-y-2">
          <button
            v-for="item in props.navItems"
            :key="item.label"
            class="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium"
            :class="item.active ? 'bg-white text-royal shadow-card' : 'text-gray-500 hover:bg-white/70'"
            @click="emit('select-nav', item.label)"
          >
            <span>{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </button>
        </nav>
        <div class="mt-8 rounded-2xl bg-white/80 p-4 text-sm text-gray-600">
          <p class="font-medium text-ink">Flux rapide</p>
          <ul class="mt-3 space-y-2">
            <li>· {{ quickFlow.reviewCount }} notes en revue</li>
            <li>· {{ quickFlow.pendingBlocks }} blocs en cours</li>
            <li>· Dernière synchro : {{ quickFlow.lastSyncLabel }}</li>
          </ul>
          <button class="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-royal py-2 text-white" @click="emit('create-note')">
            <span>Nouvelle note</span>
            <span v-if="props.shortcutHints?.createNote" class="rounded-full bg-white/20 px-2 py-0.5 text-[11px] tracking-wide">
              {{ props.shortcutHints.createNote }}
            </span>
          </button>
        </div>
      </aside>

      <div class="space-y-6">
        <div class="flex flex-wrap gap-3 rounded-[28px] bg-mist p-5">
          <div>
            <p class="text-sm text-gray-500">Bonjour, Léna</p>
            <h3 class="font-display text-2xl text-ink">Tableau de bord</h3>
          </div>
          <div class="flex flex-1 flex-wrap justify-end gap-3">
            <input
              type="search"
              placeholder="Rechercher…"
              class="flex-1 min-w-[200px] rounded-2xl border border-white/80 bg-white/80 px-4 py-2 text-sm text-gray-600"
            />
            <div class="relative min-w-[200px]">
              <select
                class="w-full appearance-none rounded-2xl border border-white/80 bg-white/90 px-4 py-2 pr-10 text-sm text-gray-600 shadow-inner focus:border-royal focus:outline-none focus:ring-2 focus:ring-royal/20"
              >
                <option>Dernières mises à jour</option>
                <option>Statut</option>
                <option>Collaborateurs</option>
              </select>
              <span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
                ▾
              </span>
            </div>
            <button class="rounded-2xl bg-royal px-5 py-2 text-white" @click="emit('share')">Partager</button>
          </div>
        </div>

        <StatsGrid v-if="mode === 'workspace'" :stats="props.stats" />

        <div v-if="mode === 'workspace'" class="grid gap-6 lg:grid-cols-2">
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <h4 class="font-display text-xl text-ink">Notes en cours</h4>
              <button class="text-sm text-royal" @click="emit('view-all')">Tout voir →</button>
            </div>
            <NotesList :notes="props.notes" @select="emit('select-note', $event)" />
          </div>

          <ActiveNotePanel
            :note="props.activeNote"
            :timeline="props.timeline"
            @update-note="emit('update-active-note', $event)"
            @edit-note="(id) => emit('edit-note', id)"
            @delete-note="(id) => emit('delete-note', id ?? props.activeNote.id)"
          />
        </div>

        <div v-else class="grid gap-6 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
          <ShortcutSettings />
          <div class="rounded-[32px] border border-dashed border-gray-200 bg-white/80 p-6 text-left">
            <p class="text-xs uppercase tracking-[0.3em] text-gray-400">Bientôt disponible</p>
            <h3 class="mt-3 font-display text-xl text-ink">Gestion du compte &amp; préférences</h3>
            <p class="mt-2 text-sm text-gray-500">
              Utilisez déjà l’espace de raccourcis clavier pendant que nous préparons la gestion des profils, l’équipe et les contrôles de confidentialité.
            </p>
            <ul class="mt-4 space-y-2 text-sm text-gray-500">
              <li>· Profil et avatar</li>
              <li>· Connexions cloud</li>
              <li>· Préférences de notifications</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
