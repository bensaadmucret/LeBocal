<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, watch, ref, reactive } from 'vue'
import EditorCanvas from '../editor/EditorCanvas.vue'
import AddTagControl from './AddTagControl.vue'
import type { Collection, NoteUpdatePayload } from '../../stores/useNotesStore'
import { useNoteDraft, type TabId, type DraftAttachment, type NoteDraft } from '../../composables/useNoteDraft'

const props = withDefaults(
  defineProps<{
    open: boolean
    collections: Collection[]
    savingMode?: 'save' | 'publish' | null
    clearTrigger?: number
    draftKey?: string
  }>(),
  {
    savingMode: null,
    clearTrigger: 0,
    draftKey: 'note-composer-draft-v3', // Incremented version for new structure
  },
)

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'save', payload: NoteUpdatePayload): void
  (event: 'publish', payload: NoteUpdatePayload): void
  (event: 'create-collection', payload: { label: string; tag: string; accent: string }): void
}>()

const defaultDraft = (): NoteDraft => ({
  title: '',
  summary: '',
  status: 'Brouillon',
  priority: 'Medium',
  collectionId: null,
  tags: [],
  reminderAt: null,
  blocks: [],
  attachments: [],
  relations: [],
})

const { draft, lastAutoSave, isDirty, history, loadDraft, clearDraft, buildPayload, restoreFromHistory } = useNoteDraft(props.draftKey, defaultDraft)

const activeTab = ref<TabId | 'history'>('collections')
const isPeek = ref(false)
const newTag = ref('')
const relationInput = ref('')
const showCollectionForm = ref(false)
const collectionAccentOptions = ['#95a392', '#3c4146', '#c9b0a1', '#8db596', '#c98e8e']
const newCollection = reactive({
  label: '',
  tag: '',
  accent: '#95a392',
})

const autoSaveLabel = computed(() => {
  if (!lastAutoSave.value) return 'En attente'
  if (isDirty.value) return 'Modifications en cours...'
  const diff = Date.now() - lastAutoSave.value
  if (diff < 5000) return 'Enregistré instantanément'
  if (diff < 60_000) return `Enregistré il y a ${Math.round(diff / 1000)}s`
  return `Enregistré à ${new Date(lastAutoSave.value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
})

watch(
  () => props.clearTrigger,
  () => {
    clearDraft()
    newTag.value = ''
    relationInput.value = ''
    showCollectionForm.value = false
    resetCollectionForm()
  },
)

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      loadDraft()
    }
  },
  { immediate: true },
)

function handleKeyDown(e: KeyboardEvent) {
  if (!props.open) return
  
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const modifier = isMac ? e.metaKey : e.ctrlKey

  if (modifier && e.key === 's') {
    e.preventDefault()
    handleSave()
  } else if (modifier && e.key === 'Enter') {
    e.preventDefault()
    handlePublish()
  } else if (e.key === 'Escape') {
    if (showCollectionForm.value) {
      showCollectionForm.value = false
    } else {
      emit('close')
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

const canSave = computed(() => !!draft.title.trim())

const isDescriptionEmpty = computed(() => {
  const blocks = draft.blocks || []
  if (!blocks.length) return true
  return blocks.every((block) => {
    if (!block?.data) return true
    const data = block.data as { text?: string }
    const raw = typeof data.text === 'string' ? data.text : JSON.stringify(block.data)
    return raw.replace(/<[^>]*>/g, '').trim().length === 0
  })
})

function handleAddTag() {
  const value = newTag.value.trim()
  if (!value) return
  if (!draft.tags.includes(value)) {
    draft.tags = [...draft.tags, value]
  }
  newTag.value = ''
}

function removeTag(tag: string) {
  draft.tags = draft.tags.filter((item) => item !== tag)
}

function handleAttachmentInput(event: Event) {
  const target = event.target as HTMLInputElement
  if (!target.files?.length) return
  const items: DraftAttachment[] = Array.from(target.files).map((file) => ({
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    type: file.type || 'document',
  }))
  draft.attachments = [...draft.attachments, ...items]
  target.value = ''
}

function removeAttachment(id: string) {
  draft.attachments = draft.attachments.filter((attachment) => attachment.id !== id)
}

function toggleCollectionForm() {
  if (showCollectionForm.value) {
    showCollectionForm.value = false
    resetCollectionForm()
  } else {
    showCollectionForm.value = true
  }
}

function resetCollectionForm() {
  newCollection.label = ''
  newCollection.tag = ''
  newCollection.accent = collectionAccentOptions[0]
}

function handleCollectionCreate() {
  const label = newCollection.label.trim()
  if (!label) return
  const payload = {
    label,
    tag: (newCollection.tag || label).trim(),
    accent: newCollection.accent || '#95a392',
  }
  emit('create-collection', payload)
  resetCollectionForm()
  showCollectionForm.value = false
}

function handleSave() {
  if (!canSave.value || props.savingMode) return
  emit('save', buildPayload('Brouillon'))
}

function handlePublish() {
  if (!canSave.value || props.savingMode) return
  emit('publish', buildPayload('Publié'))
}

</script>

<template>
  <transition name="fade">
    <div v-if="open" :class="['note-composer__overlay', { 'is-peek': isPeek }]">
      <div :class="['note-composer__sheet', { 'is-peek': isPeek }]">
        <header class="note-composer__header">
          <div class="note-composer__toolbar">
            <button 
              class="icon-toggle" 
              type="button" 
              :title="isPeek ? 'Agrandir' : 'Réduire (Mode Peek)'"
              @click="isPeek = !isPeek"
            >
              {{ isPeek ? '↗' : '↙' }}
            </button>
            <button class="icon icon-close" type="button" aria-label="Fermer la modale" @click="emit('close')">✕</button>
          </div>
        </header>

        <section class="note-composer__body">
          <div class="note-composer__column note-composer__column--hero">
            <div class="document-pane">
              <input
                v-model="draft.title"
                class="document-pane__title"
                placeholder="Votre titre"
              />
              <div class="document-pane__actions">
                <AddTagControl v-model="newTag" placeholder="Ajouter un tag" @submit="handleAddTag" />
              </div>
              <div v-if="draft.tags.length" class="document-pane__tags">
                <span v-for="tag in draft.tags" :key="tag" class="document-pane__tag">
                  {{ tag }}
                  <button type="button" aria-label="Retirer le tag" @click="removeTag(tag)">×</button>
                </span>
              </div>
              <label class="document-pane__summary">
                <span>Résumé</span>
                <textarea
                  v-model="draft.summary"
                  rows="3"
                  placeholder="Ajoutez un aperçu rapide (optionnel)"
                ></textarea>
              </label>
              <div class="document-pane__editor">
                <div class="document-pane__editor-head">
                  <div class="document-pane__editor-actions">
                    <button type="button" class="doc-icon-button" aria-label="Ajouter un bloc">
                      <span aria-hidden="true">＋</span>
                    </button>
                  </div>
                  <p class="document-pane__hint">Cliquez sur “+” pour insérer vos blocs (texte, tâches, idées) puis éditez librement.</p>
                </div>
                <div class="document-pane__editor-surface">
                  <div v-if="isDescriptionEmpty" class="document-pane__placeholder">Ajoutez un bloc avec “+” puis commencez à rédiger ici.</div>
                  <EditorCanvas v-model="draft.blocks" />
                </div>
              </div>
            </div>
          </div>

          <div class="note-composer__column note-composer__column--content">
            <div class="note-composer__main">
              <nav class="composer-tabs">
                <button
                  v-for="tab in ['collections', 'attachments', 'history']"
                  :key="tab"
                  :class="['composer-tab', { active: activeTab === tab }]"
                  type="button"
                  @click="activeTab = tab as any"
                >
                  {{ tab === 'collections' ? 'Collections' : tab === 'attachments' ? 'Pièces jointes' : 'Historique' }}
                </button>
                <span class="autosave" :class="{ 'is-dirty': isDirty }">{{ autoSaveLabel }}</span>
              </nav>

              <section v-show="activeTab === 'collections'" class="composer-panel">
                <div class="composer-field composer-field--stack">
                  <span>Collection associée</span>
                  <div class="collections-grid">
                    <button
                      v-for="collection in collections"
                      :key="collection.id"
                      type="button"
                      :class="['collection-card', { selected: draft.collectionId === collection.id }]"
                      @click="draft.collectionId = collection.id"
                    >
                      <span class="collection-accent" :style="{ background: collection.accent }"></span>
                      <div>
                        <p class="collection-label">{{ collection.label }}</p>
                        <p class="collection-tag">{{ collection.tag }}</p>
                      </div>
                    </button>
                  </div>
                  <button class="text-link" type="button" @click="toggleCollectionForm">
                    {{ showCollectionForm ? 'Fermer le formulaire' : '+ Créer une nouvelle collection' }}
                  </button>
                  <div v-if="showCollectionForm" class="collection-form">
                    <label>
                      <span>Nom</span>
                      <input v-model="newCollection.label" placeholder="Nom de la collection" />
                    </label>
                    <label>
                      <span>Tag</span>
                      <input v-model="newCollection.tag" placeholder="Label court" />
                    </label>
                    <div class="accent-picker">
                      <span>Accent</span>
                      <div class="accent-picker__swatches">
                        <button
                          v-for="color in collectionAccentOptions"
                          :key="color"
                          type="button"
                          :style="{ background: color }"
                          :class="['accent-dot', { selected: newCollection.accent === color }]"
                          @click="newCollection.accent = color"
                        />
                      </div>
                    </div>
                    <div class="collection-form__actions">
                      <button type="button" class="ghost" @click="toggleCollectionForm">Annuler</button>
                      <button
                        type="button"
                        class="primary"
                        :disabled="!newCollection.label.trim()"
                        @click="handleCollectionCreate"
                      >
                        Créer
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <section v-show="activeTab === 'attachments'" class="composer-panel">
                <p class="panel-helper">Glissez vos fichiers ici ou utilisez le bouton ci-dessous.</p>
                <label class="upload-drop">
                  <input type="file" multiple @change="handleAttachmentInput" />
                  <span>Ajouter des fichiers</span>
                </label>
                <ul class="attachment-list" v-if="draft.attachments.length">
                  <li v-for="file in draft.attachments" :key="file.id">
                    <div>
                      <strong>{{ file.name }}</strong>
                      <small>{{ (file.size / 1024).toFixed(1) }} ko</small>
                    </div>
                    <button type="button" @click="removeAttachment(file.id)">Supprimer</button>
                  </li>
                </ul>
                <p v-else class="panel-helper muted">Aucune pièce jointe pour le moment.</p>
              </section>

              <section v-show="activeTab === 'history'" class="composer-panel">
                <p class="panel-helper">Dernières versions enregistrées localement.</p>
                <ul class="history-list" v-if="history.length">
                  <li v-for="entry in history" :key="entry.timestamp" class="history-item">
                    <div class="history-item__info">
                      <strong>{{ new Date(entry.timestamp).toLocaleTimeString() }}</strong>
                      <span>{{ new Date(entry.timestamp).toLocaleDateString() }}</span>
                    </div>
                    <button class="ghost ghost--subtle" type="button" @click="restoreFromHistory(entry)">Restaurer</button>
                  </li>
                </ul>
                <p v-else class="panel-helper muted">Aucun historique disponible.</p>
              </section>
            </div>
          </div>
        </section>

        <footer class="note-composer__footer">
          <button class="ghost" type="button" @click="emit('close')">Annuler</button>
          <div class="note-composer__cta">
            <button class="ghost" type="button" :disabled="!canSave || savingMode === 'save'" @click="handleSave">
              {{ savingMode === 'save' ? 'Enregistrement…' : 'Enregistrer' }}
            </button>
            <button class="primary" type="button" :disabled="!canSave || savingMode === 'publish'" @click="handlePublish">
              {{ savingMode === 'publish' ? 'Publication…' : 'Publier' }}
            </button>
          </div>
        </footer>
      </div>
    </div>
  </transition>
</template>

<style scoped>

.note-composer__overlay {
  position: fixed;
  inset: 0;
  background: linear-gradient(135deg, rgba(14, 19, 45, 0.8), rgba(26, 25, 58, 0.8));
  backdrop-filter: blur(18px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 64px;
  z-index: 80;
  overflow: hidden;
}

.note-composer__sheet {
  width: min(1280px, 100%);
  background: radial-gradient(circle at top left, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0)), #f6eede;
  border-radius: 48px;
  box-shadow:
    0 40px 120px rgba(78, 67, 51, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
  padding: 64px;
  display: flex;
  flex-direction: column;
  gap: 56px;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
}

.note-composer__header {
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
}

.note-composer__header-pill {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.28em;
  color: var(--color-text-secondary, #7c819d);
  padding: 10px 18px;
  border-radius: 999px;
  border: 1px solid rgba(124, 129, 157, 0.25);
  background: rgba(255, 255, 255, 0.45);
  box-shadow: 0 10px 30px rgba(15, 20, 40, 0.08);
}

.icon.icon-close {
  border: none;
  background: #cbd5c8;
  color: #3c4146;
  width: 44px;
  height: 44px;
  border-radius: 999px;
  font-size: 16px;
  box-shadow: 0 10px 20px rgba(149, 163, 146, 0.2);
  transition: transform 0.2s ease;
}

.icon.icon-close:hover {
  transform: rotate(90deg);
}

.note-composer__title-input {
  border: none;
  background: transparent;
  font-size: 38px;
  font-weight: 600;
  color: #3c4146;
  width: 100%;
}

.note-composer__title-input:focus {
  outline: none;
}

.note-composer__body {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 36px;
}

.note-composer__column {
  display: flex;
  flex-direction: column;
}

.note-composer__column--hero {
  position: relative;
  margin-top: -16px;
}

.note-composer__column--content {
  display: flex;
  flex-direction: column;
  gap: 24px;
  position: relative;
  padding-left: 32px;
}

.note-composer__column--content::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(53, 55, 70, 0.12);
}

.document-pane {
  width: 100%;
  padding: 0;
  background: transparent;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.document-pane__label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #7b7f8f;
}

.document-pane__icon {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  background: #f6f7fb;
  display: grid;
  place-items: center;
  color: #8a8fa3;
}

.document-pane__title {
  border: none;
  background: transparent;
  font-size: 40px;
  font-weight: 600;
  color: #3c4146;
  line-height: 1.4;
  letter-spacing: -0.01em;
}

.document-pane__title::placeholder {
  color: #c5c8d3;
}

.document-pane__title:focus {
  outline: none;
}

.document-pane__summary {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-secondary, #5a6275);
}

.document-pane__summary textarea {
  border-radius: 16px;
  border: 1px solid rgba(226, 230, 240, 0.9);
  padding: 12px 14px;
  font-size: 14px;
  resize: none;
}

.document-pane__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.doc-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  border: 1px solid rgba(182, 186, 204, 0.9);
  background: #fff;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  color: #4f5368;
}

.doc-pill svg {
  display: block;
  width: 12px;
  height: 12px;
}

.document-pane__editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.document-pane__editor-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.document-pane__hint {
  margin: 0;
  font-size: 12px;
  color: rgba(83, 87, 108, 0.75);
}

.document-pane__editor-actions {
  display: inline-flex;
  gap: 6px;
}

.doc-icon-button {
  width: 26px;
  height: 26px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: #fff;
  color: rgba(48, 50, 68, 0.8);
  font-size: 16px;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.document-pane__editor-surface {
  position: relative;
  border-radius: 20px;
  background: #fff;
  min-height: 260px;
  padding: 20px 24px 24px 56px;
}

.document-pane__editor-surface::before {
  content: '';
  position: absolute;
  left: 28px;
  top: 20px;
  bottom: 20px;
  width: 2px;
  border-radius: 999px;
  background: rgba(71, 76, 98, 0.18);
}

.document-pane__placeholder {
  position: absolute;
  top: 26px;
  left: 60px;
  font-size: 16px;
  color: rgba(71, 76, 98, 0.6);
  pointer-events: none;
}

.composer-hero-card {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.92), rgba(241, 244, 255, 0.92));
  border-radius: 32px;
  padding: 32px;
  box-shadow:
    0 30px 70px rgba(15, 20, 40, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hero-card__label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary, #7c819d);
}

.hero-card__icon {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: var(--color-bg-muted, #f1f4ff);
  display: grid;
  place-items: center;
}

.hero-card__title-input {
  border: none;
  background: transparent;
  font-size: 36px;
  font-weight: 600;
  color: var(--color-text-primary, #0f1321);
}

.hero-card__title-input:focus {
  outline: none;
}

.hero-card__subtitle {
  font-size: 15px;
  color: var(--color-text-secondary, #7c819d);
}

.hero-card__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.composer-info-grid {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.composer-card {
  background: #fff;
  border-radius: var(--radius-card, 16px);
  border: 1px solid var(--color-border, #e2e6f0);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 10px 30px rgba(17, 19, 34, 0.05);
}

.composer-card__headline {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--color-text-secondary, #5a6275);
}

.composer-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--color-text-secondary, #5a6275);
}

.composer-field--stack > span {
  font-size: 11px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.composer-card--grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.composer-field--full {
  grid-column: span 2;
}

.composer-field input,
.composer-field select,
.composer-field textarea {
  border-radius: var(--radius-input, 12px);
  border: 1px solid var(--color-border, #e2e6f0);
  padding: 10px 12px;
  font-size: 14px;
  color: var(--color-text-primary, #111322);
  background: var(--color-bg-surface, #fff);
}

.note-composer__main {
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(12px);
  border-radius: 32px;
  border: none;
  padding: 48px;
  display: flex;
  flex-direction: column;
  gap: 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.05);
}

.composer-tabs {
  display: flex;
  align-items: center;
  gap: 16px;
}

.composer-tabs button,
.composer-tabs .autosave {
  padding-top: 4px;
  padding-bottom: 4px;
}

.composer-tab {
  border: none;
  background: transparent;
  padding-bottom: 8px;
  font-weight: 600;
  font-size: 14px;
  color: var(--color-text-secondary, #5a6275);
  border-bottom: 2px solid transparent;
}

.composer-tab.active {
  color: #3c4146;
  border-bottom-color: #95a392;
}

.autosave {
  margin-left: auto;
  font-size: 12px;
  color: var(--color-text-secondary, #5a6275);
}

.composer-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.editor-shell {
  border: 1px solid var(--color-border, #e2e6f0);
  border-radius: 16px;
  padding: 12px;
  min-height: 260px;
}

.tag-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.collections-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 12px;
}

.collection-card {
  border-radius: 20px;
  border: none;
  background: #fff;
  padding: 16px 20px;
  display: flex;
  gap: 12px;
  align-items: center;
  text-align: left;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.02);
}

.collection-card.selected {
  background: #95a392;
  box-shadow: 0 10px 30px rgba(149, 163, 146, 0.2);
}

.collection-card.selected .collection-label {
  color: #fff;
}

.collection-card.selected .collection-tag {
  color: rgba(255, 255, 255, 0.8);
}

.collection-accent {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  flex-shrink: 0;
}

.collection-label {
  font-weight: 600;
  font-size: 14px;
  color: var(--color-text-primary, #111322);
  margin: 0 0 2px;
}

.collection-tag {
  margin: 0;
  font-size: 11px;
  color: var(--color-text-secondary, #5a6275);
}

.collection-form {
  margin-top: 12px;
  padding: 16px;
  border: 1px solid rgba(226, 230, 240, 0.9);
  border-radius: 0;
  background: rgba(245, 247, 251, 0.65);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.collection-form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-secondary, #5a6275);
}

.collection-form input {
  border-radius: 0;
  border: 1px solid rgba(210, 214, 228, 0.9);
  padding: 10px 12px;
  font-size: 14px;
  background: #fff;
}

.accent-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
  color: var(--color-text-secondary, #5a6275);
}

.accent-picker__swatches {
  display: flex;
  gap: 8px;
}

.accent-dot {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 2px solid transparent;
  cursor: pointer;
}

.accent-dot.selected {
  border-color: rgba(17, 19, 34, 0.4);
  box-shadow: 0 0 0 4px rgba(91, 62, 241, 0.12);
}

.collection-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--color-tag-bg, #eef2ff);
  color: var(--color-tag-text, #3d45a8);
  border-radius: 999px;
  font-size: 12px;
}

.tag-pill button {
  border: none;
  background: transparent;
  cursor: pointer;
}

.tag-form,
.relation-form {
  display: flex;
  gap: 8px;
}

.tag-form input,
.relation-form input {
  flex: 1;
}

.text-link {
  border: none;
  background: transparent;
  color: var(--color-accent, #4c6ef5);
  font-weight: 600;
  text-align: left;
}

.upload-drop {
  border: 2px dashed var(--color-border, #e2e6f0);
  border-radius: 16px;
  padding: 24px;
  text-align: center;
  color: var(--color-text-secondary, #5a6275);
  cursor: pointer;
}

.upload-drop input {
  display: none;
}

.attachment-list {
  list-style: none;
  padding: 0;
  margin: 16px 0 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.attachment-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid var(--color-border, #e2e6f0);
  border-radius: 12px;
  padding: 12px;
}

.history-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.history-item {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--color-border, #e2e6f0);
}

.panel-helper {
  font-size: 13px;
  color: var(--color-text-secondary, #5a6275);
}

.panel-helper.muted {
  color: rgba(90, 98, 117, 0.7);
  text-align: center;
}

.note-composer__footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
}

.note-composer__cta {
  display: flex;
  gap: 10px;
}

.primary,
.ghost,
.icon {
  border-radius: 999px;
  border: 1px solid transparent;
  padding: 10px 20px;
  font-weight: 600;
  cursor: pointer;
}

.primary {
  background: #95a392;
  color: #3c4146;
  box-shadow: 0 10px 25px rgba(149, 163, 146, 0.15);
}

.primary:disabled,
.ghost:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ghost {
  background: transparent;
  border-color: var(--color-border, #e2e6f0);
  color: var(--color-text-primary, #111322);
}

.ghost--subtle {
  border-color: rgba(255, 255, 255, 0.6);
  background: rgba(253, 254, 255, 0.6);
}

.icon {
  padding: 8px 12px;
  background: var(--color-bg-muted, #f5f7fb);
}


.note-composer__overlay.is-peek {
  background: transparent;
  backdrop-filter: none;
  pointer-events: none;
  justify-content: flex-end;
  padding: 20px;
}

.note-composer__sheet.is-peek {
  pointer-events: auto;
  width: 480px;
  height: calc(100vh - 40px);
  max-height: none;
  border-radius: 24px;
  box-shadow: -20px 0 60px rgba(15, 20, 40, 0.15);
  padding: 24px;
  gap: 24px;
}

.note-composer__sheet.is-peek .note-composer__body {
  grid-template-columns: 1fr;
  overflow-y: auto;
  gap: 24px;
}

.note-composer__sheet.is-peek .note-composer__column--content {
  padding-left: 0;
  border-left: none;
  margin-top: 24px;
}

.note-composer__sheet.is-peek .note-composer__column--content::before {
  display: none;
}

.note-composer__sheet.is-peek .document-pane__title {
  font-size: 28px;
}

.note-composer__sheet.is-peek .document-pane__editor-surface {
  min-height: 180px;
}

.note-composer__toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon-toggle {
  background: white;
  border: 1px solid var(--color-border, #e2e6f0);
  border-radius: 10px;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.icon-toggle:hover {
  background: #f5f7fb;
  border-color: #d2d6e4;
}

.history-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #f9faff;
  border: 1px solid rgba(226, 230, 240, 0.8);
  border-radius: 12px;
}

.history-item__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.history-item__info strong {
  font-size: 14px;
  color: var(--color-text-primary, #111322);
}

.history-item__info span {
  font-size: 11px;
  color: var(--color-text-secondary, #5a6275);
}

.autosave.is-dirty {
  color: var(--color-accent, #4c6ef5);
  font-weight: bold;
}

@media (max-width: 1024px) {
  .note-composer__body {
    grid-template-columns: 1fr;
  }
  .note-composer__sidebar {
    order: 2;
  }
  .note-composer__main {
    order: 1;
  }
}
</style>
