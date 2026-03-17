<template>
  <section class="hero-toolbar">
    <div class="hero-header">
      <div>
        <p class="hero-subtitle">{{ subtitle }}</p>
        <h1 class="hero-title">{{ title }}</h1>
      </div>
      <slot name="header-extra" />
    </div>

    <nav class="hero-breadcrumbs">
      <template v-for="(crumb, index) in breadcrumbs" :key="crumb">
        <span>{{ crumb }}</span>
        <span v-if="index < breadcrumbs.length - 1">·</span>
      </template>
    </nav>

    <div class="hero-toolbar-row">
      <div class="hero-filters">
        <button
          v-for="filter in filters"
          :key="filter.label"
          class="hero-pill"
        >
          <span v-if="filter.icon">{{ filter.icon }}</span>
          {{ filter.label }}
        </button>
      </div>
      <div class="hero-actions">
        <button
          v-for="action in actions"
          :key="action.label"
          class="hero-pill hero-action"
          @click="emit('action', action)"
        >
          <span v-if="action.icon">{{ action.icon }}</span>
          {{ action.label }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  breadcrumbs: { type: Array, default: () => [] },
  filters: { type: Array, default: () => [] },
  actions: { type: Array, default: () => [] },
})

const emit = defineEmits(['action'])
</script>

<style scoped>
.hero-toolbar {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  width: 100%;
}

.hero-subtitle {
  text-transform: uppercase;
  letter-spacing: 0.4em;
  font-size: 0.75rem;
  color: rgba(100, 116, 139, 0.75);
  margin: 0 0 0.35rem;
}

.hero-title {
  font-size: 2.25rem;
  line-height: 2.5rem;
  margin: 0;
  font-weight: 600;
  letter-spacing: 0;
  color: #000;
}

.hero-breadcrumbs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.92rem;
  color: rgba(71, 85, 105, 0.8);
}

.hero-toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  width: 100%;
}

.hero-filters,
.hero-actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.hero-pill {
  border-radius: 999px;
  border: 1px solid rgba(226, 232, 240, 0.85);
  background: rgba(255, 255, 255, 0.96);
  padding: 0.5rem 1.2rem;
  font-size: 0.9rem;
  color: rgba(30, 41, 59, 0.85);
  box-shadow: 0 12px 25px rgba(15, 23, 42, 0.08);
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.hero-action {
  font-weight: 600;
}
</style>
