<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  variant?: 'primary' | 'secondary' | 'ghost' | 'clay'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false
})

const buttonClasses = computed(() => {
  const base = "tap-effect inline-flex items-center justify-center gap-2 font-display font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: 'bg-sage text-white shadow-[0_8px_20px_-4px_rgba(149,163,146,0.3)] hover:shadow-[0_12px_24px_-4px_rgba(149,163,146,0.45)] focus:ring-sage dark:bg-[#7c91ff] dark:shadow-[0_8px_20px_-4px_rgba(124,145,255,0.3)] dark:focus:ring-[#7c91ff]',
    clay: 'bg-clay text-white shadow-[0_8px_20px_-4px_rgba(201,176,161,0.3)] hover:shadow-[0_12px_24px_-4px_rgba(201,176,161,0.45)] focus:ring-clay dark:bg-[#ffce6b] dark:text-anthracite dark:shadow-[0_8px_20px_-4px_rgba(255,206,107,0.3)] dark:focus:ring-[#ffce6b]',
    secondary: 'glass-card text-anthracite dark:text-mist border border-white/20 hover:bg-white/10 dark:hover:bg-white/5 focus:ring-mist',
    ghost: 'text-anthracite dark:text-mist hover:bg-black/5 dark:hover:bg-white/5 focus:ring-gray-400'
  };

  const sizes = {
    sm: 'py-2 px-8 text-[11px] font-bold uppercase tracking-wider rounded-xl',
    md: 'py-3.5 px-14 text-sm rounded-2xl',
    lg: 'py-5 px-20 text-base font-semibold rounded-[32px]',
    icon: 'h-12 w-12 rounded-2xl p-0'
  };

  return `${base} ${variants[props.variant]} ${sizes[props.size]}`;
});
</script>

<template>
  <button
    :disabled="disabled"
    :class="buttonClasses"
  >
    <slot />
  </button>
</template>
