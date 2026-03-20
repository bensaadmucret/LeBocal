<template>
  <div
    class="relative overflow-hidden animate-fade-in transition-all duration-300"
    :class="[
      variant === 'glass' && 'glass-card rounded-[40px]',
      variant === 'pastel' && 'bg-white rounded-[32px] border border-[rgba(15,23,42,0.06)] shadow-[0_25px_60px_rgba(15,23,42,0.07)] dark:bg-[#1e1b2e] dark:border-white/10 dark:shadow-[0_25px_60px_rgba(0,0,0,0.5)]',
      hoverable && 'hover:-translate-y-1 hover:shadow-2xl cursor-pointer',
      padding === 'none' && 'p-0',
      padding === 'sm' && 'p-4',
      padding === 'md' && (variant === 'pastel' ? 'p-5' : 'p-6'),
      padding === 'lg' && 'p-10'
    ]"
  >
    <!-- Halo Decoration -->
    <span 
      v-if="halo !== 'none'"
      class="absolute w-36 h-36 rounded-full opacity-60 pointer-events-none"
      :class="[
        halo === 'peach' && 'bg-[#FFCDBC]',
        halo === 'mint' && 'bg-[#AEE6D6]',
        halo === 'lilac' && 'bg-[#DACFFF]',
        haloPosition === 'top-left' && '-left-10 -top-10',
        haloPosition === 'top-right' && '-right-10 -top-10',
        haloPosition === 'bottom-left' && '-left-10 -bottom-10',
        haloPosition === 'bottom-right' && '-right-10 -bottom-10'
      ]"
    ></span>

    <div class="relative z-10 h-full">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  variant?: 'glass' | 'pastel'
  hoverable?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  halo?: 'peach' | 'mint' | 'lilac' | 'none'
  haloPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  animate?: boolean
}

withDefaults(defineProps<Props>(), {
  variant: 'glass',
  hoverable: false,
  padding: 'md',
  halo: 'none',
  haloPosition: 'top-left',
  animate: true
})
</script>

<style scoped>
.glass-card {
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 20px 60px rgba(78, 67, 51, 0.05);
}

.dark .glass-card {
  background: rgba(30, 27, 46, 0.4);
  border-color: rgba(255, 255, 255, 0.05);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}
</style>
