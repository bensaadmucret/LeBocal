<script setup lang="ts">
const props = defineProps<{ label: string }>()
</script>

<template>
  <span class="rounded-full bg-lilac/60 px-3 py-1 text-xs font-medium text-royal">
    {{ props.label }}
  </span>
</template>
