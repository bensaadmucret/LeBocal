<script setup lang="ts">
const props = defineProps<{ label: string }>()
</script>

<template>
  <span class="rounded-full bg-clay/20 px-3 py-1 text-xs font-medium text-sage">
    {{ props.label }}
  </span>
</template>
