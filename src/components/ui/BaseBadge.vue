<script setup lang="ts">
interface Props {
  variant?: 'default' | 'sage' | 'clay' | 'outline'
}

withDefaults(defineProps<Props>(), {
  variant: 'default'
})
</script>

<template>
  <span
    class="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors duration-200"
    :class="[
      variant === 'default' && 'bg-black/5 dark:bg-white/10 text-anthracite dark:text-blue-200',
      variant === 'sage' && 'bg-sage/20 text-sage dark:bg-[#7c91ff]/20 dark:text-[#cdd5ff]',
      variant === 'clay' && 'bg-clay/20 text-clay dark:bg-[#ffce6b]/20 dark:text-[#ffce6b]',
      variant === 'outline' && 'border border-black/10 dark:border-white/20 text-anthracite dark:text-mist'
    ]"
  >
    <slot />
  </span>
</template>
