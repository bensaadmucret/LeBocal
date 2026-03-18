<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { CommandPaletteSection } from '../../types/commandPalette'

const props = defineProps<{
  open: boolean
  sections: CommandPaletteSection[]
  query: string
  isOffline?: boolean
  usesCache?: boolean
  cacheLabel?: string | null
}>()

const emit = defineEmits<{
  'update:query': [value: string]
  select: [itemId: string]
  close: []
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const activeIndex = ref(0)
const canUseDocument = typeof document !== 'undefined'
const shortcutKeyClasses =
  'rounded-md border border-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-500 dark:border-white/10 dark:text-slate-200'

const flattenedItems = computed(() => {
  const list: Array<{ section: CommandPaletteSection; itemIndex: number }> = []
  props.sections.forEach((section) => {
    section.items.forEach((_item, itemIndex) => {
      list.push({ section, itemIndex })
    })
  })
  return list
})

const activeItem = computed(() => {
  const current = flattenedItems.value[activeIndex.value]
  if (!current) return null
  const { section, itemIndex } = current
  return section.items[itemIndex]
})

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:query', target.value)
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.open) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    const lastIndex = Math.max(0, flattenedItems.value.length - 1)
    activeIndex.value = Math.min(lastIndex, activeIndex.value + 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = Math.max(0, activeIndex.value - 1)
  } else if (event.key === 'Enter') {
    if (activeItem.value) {
      event.preventDefault()
      emit('select', activeItem.value.id)
    }
  } else if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
  }
}

function handleClickItem(itemId: string) {
  emit('select', itemId)
}

function isActiveRow(sectionId: string, itemIndex: number) {
  const current = flattenedItems.value[activeIndex.value]
  return current?.section.id === sectionId && current.itemIndex === itemIndex
}

watch(
  () => props.open,
  async (isOpen) => {
    if (!canUseDocument) return
    if (isOpen) {
      await nextTick()
      activeIndex.value = 0
      inputRef.value?.focus()
      document.addEventListener('keydown', handleKeydown)
    } else {
      document.removeEventListener('keydown', handleKeydown)
    }
  },
  { immediate: true },
)

onMounted(() => {
  if (props.open && canUseDocument) {
    document.addEventListener('keydown', handleKeydown)
  }
})

onBeforeUnmount(() => {
  if (canUseDocument) {
    document.removeEventListener('keydown', handleKeydown)
  }
})
</script>

<template>
  <Teleport to="body">
    <transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-40 flex items-start justify-center bg-ink/30 backdrop-blur-sm"
        @click.self="emit('close')"
      >
        <div class="mt-16 w-full max-w-2xl rounded-[28px] border border-white/60 bg-white/95 p-4 shadow-2xl dark:border-white/10 dark:bg-slate-900/90">
          <header class="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/80 p-3 dark:border-white/10 dark:bg-slate-900/60">
            <div class="flex flex-1 items-center gap-2 rounded-2xl bg-mist px-3 py-2 text-gray-500 dark:bg-white/5 dark:text-slate-300">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.6">
                <circle cx="11" cy="11" r="7" />
                <line x1="16.65" y1="16.65" x2="21" y2="21" />
              </svg>
              <input
                ref="inputRef"
                :value="query"
                type="text"
                class="flex-1 bg-transparent text-base text-ink placeholder:text-gray-500 focus:outline-none dark:text-white"
                placeholder="Tape quelque chose à chercher…"
                autocomplete="off"
                @input="handleInput"
              />
            </div>
            <span class="hidden items-center gap-1 rounded-xl border border-white/70 px-3 py-1 text-xs text-gray-500 dark:border-white/10 dark:text-slate-300 md:flex">
              <span class="rounded-md border border-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-500 dark:border-white/10 dark:text-slate-200">⌘</span>
              <span class="rounded-md border border-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-500 dark:border-white/10 dark:text-slate-200">K</span>
            </span>
            <span v-if="isOffline" class="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-400/20 dark:text-amber-200">Offline</span>
          </header>

          <section class="mt-4 max-h-[60vh] space-y-6 overflow-y-auto pr-2">
            <div v-if="usesCache" class="rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 px-4 py-2 text-xs text-amber-700 dark:border-amber-200/40 dark:bg-amber-400/10 dark:text-amber-200">
              Résultats hors ligne — dernière synchro {{ cacheLabel || 'inconnue' }}
            </div>
            <template v-for="section in sections" :key="section.id">
              <div v-if="section.items.length" class="space-y-2">
                <p class="text-xs uppercase tracking-[0.3em] text-gray-400">{{ section.label }}</p>
                <ul class="overflow-hidden rounded-2xl border border-white/70 bg-white/80 dark:border-white/5 dark:bg-white/5">
                  <li
                    v-for="(item, index) in section.items"
                    :key="item.id"
                    class="cursor-pointer border-b border-white/50 last:border-b-0 dark:border-white/5"
                    :class="{
                      'bg-royal/10 text-ink dark:bg-royal/20 dark:text-white': isActiveRow(section.id, index),
                      'hover:bg-royal/5 dark:hover:bg-white/10': true,
                    }"
                    @click="handleClickItem(item.id)"
                  >
                    <div class="flex items-center justify-between px-4 py-3">
                      <div class="flex items-center gap-3">
                        <span class="text-lg">{{ item.icon }}</span>
                        <div>
                          <p class="font-medium text-ink dark:text-white">{{ item.title }}</p>
                          <p class="text-sm text-gray-500 dark:text-slate-300">{{ item.subtitle }}</p>
                        </div>
                      </div>
                      <div class="flex items-center gap-2 text-xs text-gray-400">
                        <span v-if="item.badge" class="rounded-full bg-royal/10 px-2 py-1 text-royal dark:bg-royal/20 dark:text-royal-100">{{ item.badge }}</span>
                        <span>{{ item.meta }}</span>
                      </div>
                    </div>
                  </li>
                </ul>
              </div>
            </template>
            <p v-if="!flattenedItems.length" class="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500 dark:border-white/10 dark:text-slate-300">
              Aucun résultat. Essaie un autre mot clé ou un filtre (`tag:` / `type:` / `date:`).
            </p>
          </section>

          <footer class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/70 px-4 py-2 text-xs text-gray-500 dark:border-white/5 dark:bg-white/5 dark:text-slate-300">
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-1">
                <span :class="shortcutKeyClasses">↑</span>
                <span :class="shortcutKeyClasses">↓</span>
                <span>naviguer</span>
              </div>
              <div class="flex items-center gap-1">
                <span :class="shortcutKeyClasses">Enter</span>
                <span>ouvrir</span>
              </div>
              <div class="flex items-center gap-1">
                <span :class="shortcutKeyClasses">Esc</span>
                <span>fermer</span>
              </div>
            </div>
            <div class="flex items-center gap-1 text-[11px]">
              <span :class="shortcutKeyClasses">Ctrl/⌘</span>
              <span :class="shortcutKeyClasses">K</span>
              <span>rouvrir</span>
            </div>
          </footer>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
