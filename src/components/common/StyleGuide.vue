<script setup lang="ts">
import { ref } from 'vue'

const colors = [
  { name: 'Sage', hex: '#95a392', variable: '--color-accent', description: 'Accent principal, utilisé pour les sélections actives.' },
  { name: 'Clay', hex: '#c9b0a1', variable: '--color-warning', description: 'Couleur d\'action secondaire, utilisée pour la création.' },
  { name: 'Mist', hex: '#f6eede', variable: '--mist', description: 'Couleur de fond douce pour le contraste.' },
  { name: 'Surface', hex: '#faf9f6', variable: '--surface', description: 'Couleur des cartes et surfaces principales.' },
  { name: 'Anthracite', hex: '#3c4146', variable: '--text-main', description: 'Texte principal et éléments sombres.' },
]

const typographies = [
  { name: 'Display (Space Grotesk)', class: 'font-display text-2xl font-semibold', description: 'Utilisé pour les titres de sections et le branding.' },
  { name: 'Sans (Inter)', class: 'font-sans text-base', description: 'Utilisé pour le corps de texte et les contrôles UI.' },
]

const isOpen = ref(true)
</script>

<template>
  <div v-if="isOpen" class="glass-card fixed bottom-6 right-6 z-50 w-80 max-h-[80vh] overflow-y-auto rounded-[32px] p-6 shadow-2xl animate-fade-in border border-white/20">
    <div class="flex items-center justify-between mb-6">
      <h2 class="font-display text-xl font-bold text-anthracite dark:text-mist">Design System</h2>
      <button @click="isOpen = false" class="text-gray-400 hover:text-gray-600">✕</button>
    </div>

    <!-- Colors -->
    <section class="mb-8">
      <h3 class="text-xs uppercase tracking-[0.2em] text-gray-400 font-bold mb-4">Palette Zen</h3>
      <div class="space-y-3">
        <div v-for="color in colors" :key="color.name" class="flex items-center gap-3">
          <div :style="{ backgroundColor: color.hex }" class="h-10 w-10 rounded-xl shadow-inner border border-black/5"></div>
          <div>
            <p class="text-sm font-semibold text-anthracite dark:text-mist">{{ color.name }}</p>
            <p class="text-[10px] text-gray-500 font-mono">{{ color.hex }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Typography -->
    <section class="mb-8">
      <h3 class="text-xs uppercase tracking-[0.2em] text-gray-400 font-bold mb-4">Typographie</h3>
      <div class="space-y-4">
        <div v-for="typo in typographies" :key="typo.name">
          <p :class="typo.class" class="text-anthracite dark:text-mist">{{ typo.name }}</p>
          <p class="text-[10px] text-gray-500 mt-1">{{ typo.description }}</p>
        </div>
      </div>
    </section>

    <!-- Buttons -->
    <section>
      <h3 class="text-xs uppercase tracking-[0.2em] text-gray-400 font-bold mb-4">Boutons</h3>
      <div class="flex flex-wrap gap-4">
        <div class="flex flex-col items-center gap-2">
          <button class="h-12 w-12 rounded-2xl bg-sage flex items-center justify-center text-anthracite shadow-lg tap-effect">
            <span>🏠</span>
          </button>
          <span class="text-[10px] text-gray-500">Nav Active</span>
        </div>
        <div class="flex flex-col items-center gap-2">
          <button class="h-12 w-12 rounded-2xl bg-clay flex items-center justify-center text-mist shadow-lg tap-effect">
            <span class="text-xl font-bold">+</span>
          </button>
          <span class="text-[10px] text-gray-500">Action (Clay)</span>
        </div>
      </div>
    </section>

    <div class="mt-8 pt-4 border-t border-gray-100 dark:border-white/5 text-[10px] text-gray-400 text-center">
      Le Bocal Interface Guide v1.0
    </div>
  </div>
</template>

<style scoped>
.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
}
</style>
