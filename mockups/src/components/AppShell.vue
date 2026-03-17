<template>
  <div class="mockups-app">
    <div class="top-nav-row">
      <TopNavShell
        :brand="brand"
        :nav-links="navLinks"
        :action-buttons="navActions"
      />
    </div>

    <main class="app-main">
      <slot name="header" />
      <slot />
    </main>
  </div>
</template>

<script setup>
import TopNavShell from './TopNavShell.vue'

const props = defineProps({
  brand: { type: String, default: '' },
  navLinks: { type: Array, default: () => [] },
  navActions: { type: Array, default: () => [] },
})
</script>
