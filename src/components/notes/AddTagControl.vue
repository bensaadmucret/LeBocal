<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
  }>(),
  {
    placeholder: 'Ajouter un tag',
  },
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
  (event: 'submit'): void
}>()

function handleInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    emit('submit')
  }
}
</script>

<template>
  <form class="add-tag-control" @submit.prevent="emit('submit')">
    <span class="add-tag-control__icon" aria-hidden="true">#</span>
    <input
      :value="modelValue"
      :placeholder="props.placeholder"
      @input="handleInput"
      @keydown="handleKeydown"
    />
    <button type="submit">Ajouter</button>
  </form>
</template>

<style scoped>
.add-tag-control {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  border: 1px solid rgba(182, 186, 204, 0.9);
  background: #fff;
  padding: 3px 10px 3px 8px;
  box-shadow: 0 10px 30px rgba(15, 20, 40, 0.05);
  width: fit-content;
  max-width: 220px;
}

.add-tag-control__icon {
  font-size: 13px;
  font-weight: 600;
  color: #6f7390;
}

.add-tag-control input {
  border: none;
  background: transparent;
  font-size: 13px;
  color: #353746;
  min-width: 100px;
}

.add-tag-control input:focus {
  outline: none;
}

.add-tag-control input::placeholder {
  color: #b5b8c6;
}

.add-tag-control button {
  border: none;
  background: transparent;
  color: var(--color-accent, #95a392);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
}
</style>
