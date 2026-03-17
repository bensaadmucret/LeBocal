<template>
  <section class="command-bar">
    <div class="command-input">
      <span class="command-icon">⌘</span>
      <input
        :placeholder="placeholder"
        @focus="$emit('focus')"
      />
      <span class="command-kb">Ctrl + K</span>
    </div>
    <div class="command-tags">
      <button
        v-for="tag in tags"
        :key="tag"
        class="command-tag"
      >
        {{ tag }}
      </button>
    </div>
  </section>
</template>

<script setup>
defineProps({
  placeholder: { type: String, default: 'Rechercher notes, transactions, voyages…' },
  tags: { type: Array, default: () => [] },
})
</script>

<style scoped>
.command-bar {
  border-radius: 32px;
  padding: 1.25rem;
  border: 1px solid rgba(226, 232, 240, 0.8);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 25px 50px rgba(15, 23, 42, 0.08);
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.command-input {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(248, 250, 255, 0.9);
}

.command-icon {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #111;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 600;
}

.command-input input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 0.95rem;
  font-family: inherit;
  color: #0f172a;
}

.command-input input:focus {
  outline: none;
}

.command-kb {
  font-size: 0.8rem;
  color: rgba(15, 23, 42, 0.45);
}

.command-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.command-tag {
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 999px;
  padding: 0.45rem 0.95rem;
  background: rgba(255, 255, 255, 0.95);
  font-size: 0.85rem;
  color: rgba(15, 23, 42, 0.7);
}
</style>
