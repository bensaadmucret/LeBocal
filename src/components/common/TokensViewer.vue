<script setup lang="ts">
const colors = [
  { name: 'Sage (Accent)', value: '#95a392', variable: '--color-accent', description: 'Used for primary actions and highlights.' },
  { name: 'Clay (Action)', value: '#c9b0a1', variable: '--color-warning', description: 'Secondary action color, naturally warm.' },
  { name: 'Mist (Background)', value: '#f6eede', variable: '--app-bg', description: 'The base "Zen" background color.' },
  { name: 'Surface', value: '#faf9f6', variable: '--surface', description: 'Base surface color for cards and panels.' },
  { name: 'Anthracite (Text)', value: '#3c4146', variable: '--text-main', description: 'Primary text color for maximum readability.' },
];

const fontSizes = ['12px', '14px', '16px', '20px', '24px', '32px', '40px', '48px'];
</script>

<template>
  <div class="p-8 max-w-4xl mx-auto space-y-12">
    <section>
      <h1 class="text-4xl font-display font-bold mb-4">Design System Tokens</h1>
      <p class="text-slate-500 max-w-2xl">
        The "Zen" palette focuses on natural, muted tones to provide a calm and focused environment.
      </p>
    </section>

    <section class="space-y-6">
      <h2 class="text-2xl font-display font-semibold border-b pb-2">Colors</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div 
          v-for="color in colors" 
          :key="color.name"
          class="flex items-center gap-4 p-4 rounded-3xl bg-white/50 border border-black/5 dark:bg-slate-900/50 dark:border-white/5"
        >
          <div 
            class="w-16 h-16 rounded-2xl shadow-inner border border-black/5"
            :style="{ backgroundColor: color.value }"
          />
          <div class="flex-1">
            <div class="flex justify-between items-start">
              <h3 class="font-semibold">{{ color.name }}</h3>
              <code class="text-[10px] px-2 py-0.5 bg-black/5 rounded-full uppercase">{{ color.value }}</code>
            </div>
            <p class="text-xs text-slate-500 font-mono mt-1">{{ color.variable }}</p>
            <p class="text-sm mt-2 leading-relaxed opacity-70">{{ color.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="space-y-6">
      <h2 class="text-2xl font-display font-semibold border-b pb-2">Typography</h2>
      
      <div class="space-y-8 p-8 rounded-[40px] bg-white/30 border border-black/5">
        <div>
          <p class="text-xs uppercase tracking-widest text-slate-400 mb-4">Display Font: Space Grotesk</p>
          <div class="space-y-2">
            <p v-for="size in fontSizes" :key="size" :style="{ fontSize: size }" class="font-display font-semibold leading-none">
              The quick brown fox ({{ size }})
            </p>
          </div>
        </div>

        <div class="pt-8 border-t">
          <p class="text-xs uppercase tracking-widest text-slate-400 mb-4">Body Font: Inter</p>
          <div class="space-y-4">
            <p class="font-sans leading-relaxed">
              Design is not just what it looks like and feels like. Design is how it works. 
              The most important thing in communication is hearing what isn't said.
            </p>
            <p class="font-sans font-medium text-slate-500 italic">
              "Simple is good."
            </p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
