<template>
  <section>
    <TransitionGroup name="widget-list" tag="div" class="summary-grid">
      <article
        v-for="card in cards"
        :key="card.id"
        class="summary-card"
        :style="cardStyle(card)"
      >
        <div class="summary-card-header">
          <span class="summary-card-icon" :style="iconStyle(card)">{{ card.icon }}</span>
          <span class="summary-card-label">{{ card.label }}</span>
        </div>
        <p class="summary-card-value">{{ card.value }}</p>
        <p class="summary-card-meta">{{ card.meta }}</p>
      </article>
    </TransitionGroup>
  </section>
</template>

<script setup>
const props = defineProps({
  cards: {
    type: Array,
    default: () => [],
  },
})

const defaultStyles = {
  background: 'rgba(255, 255, 255, 0.92)',
  borderColor: 'rgba(200, 206, 225, 0.5)',
  iconBackground: 'rgba(233, 236, 255, 0.9)',
}

const cardStyle = (card) => ({
  background: card.background || defaultStyles.background,
  borderColor: card.borderColor || defaultStyles.borderColor,
})

const iconStyle = (card) => ({
  background: card.iconBackground || defaultStyles.iconBackground,
})
</script>

<style scoped>
.summary-grid {
  display: flex;
  flex-wrap: nowrap;
  gap: 1rem;
  overflow: visible;
}

.summary-card {
  border-radius: 28px;
  padding: 1.5rem;
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex: 1 1 0;
  min-width: 0;
}

.widget-list-enter-active,
.widget-list-leave-active {
  transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
}

.widget-list-enter-from,
.widget-list-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

.summary-card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  color: rgba(15, 23, 42, 0.55);
}

.summary-card-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 14px;
}

.summary-card-value {
  font-size: 2rem;
  margin: 0;
  font-weight: 600;
  color: #020205;
}

.summary-card-meta {
  margin: 0;
  font-size: 0.95rem;
  color: rgba(15, 23, 42, 0.65);
}
</style>
