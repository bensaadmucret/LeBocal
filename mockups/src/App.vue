<template>
  <AppShell
    :brand="brand"
    :nav-links="navLinks"
    :nav-actions="navActions"
  >
    <template #header>
      <BreadcrumbToolbar
        title="Bienvenue, Léna"
        subtitle="Accueil"
        :breadcrumbs="breadcrumbs"
        :filters="filters"
        :actions="heroActions"
        @action="handleToolbarAction"
      />
    </template>

    <GlobalSummaryGrid :cards="activeWidgets" />

    <CommandPaletteBar
      :tags="commandTags"
    />

    <div v-if="showWidgetManager" class="widget-modal">
      <div class="widget-modal__panel">
        <header>
          <h3>Widgets disponibles</h3>
          <button class="widget-modal__close" @click="showWidgetManager = false">✕</button>
        </header>
        <ul>
          <li v-for="widget in widgetCatalog" :key="widget.id">
            <label>
              <input
                type="checkbox"
                :checked="widget.active"
                @change="toggleWidget(widget.id)"
              />
              <span>
                {{ widget.label }}
                <small>{{ widget.meta }}</small>
              </span>
            </label>
          </li>
        </ul>
        <button class="widget-modal__cta" @click="showWidgetManager = false">Fermer</button>
      </div>
    </div>

    <section class="cards-row">
      <article class="promo-card">
        <div class="promo-image">✨</div>
        <div class="promo-content">
          <div class="promo-header">
            <p class="promo-title">Pro Version</p>
            <span class="chip-pill">15 Days</span>
          </div>
          <p class="promo-text">Vos earnings avec la version pro restent stables cette semaine.</p>
          <button class="btn-dark">
            Learn more
            <span>➜</span>
          </button>
        </div>
      </article>

      <article class="kpi-card">
        <header>
          <span>Activity</span>
          <span class="kpi-pill">Weekly</span>
        </header>
        <p class="kpi-value">186h</p>
        <p class="kpi-sub">Worked this week</p>
        <div class="activity-bars">
          <span style="height: 38px"></span>
          <span style="height: 52px"></span>
          <span style="height: 64px"></span>
          <span class="active" style="height: 98px"></span>
          <span style="height: 46px"></span>
          <span style="height: 32px"></span>
          <span style="height: 28px"></span>
        </div>
        <div class="activity-labels">
          <span>Lun</span>
          <span>Mar</span>
          <span>Mer</span>
          <span>Jeu</span>
          <span>Ven</span>
          <span>Sam</span>
          <span>Dim</span>
        </div>
      </article>

      <article class="visa-card">
        <div class="visa-top">
          <p class="visa-label">Virtual card</p>
          <span class="visa-chip">VISA</span>
        </div>
        <p class="visa-value">$390.00</p>
        <p class="visa-sub">•••• 6802 · 09/28</p>
        <div class="mini-filter-bar">
          <button>Dollar 72%</button>
          <button>Tether 28%</button>
        </div>
        <button class="visa-link">Voir détails</button>
      </article>
    </section>
  </AppShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import AppShell from './components/AppShell.vue'
import BreadcrumbToolbar from './components/BreadcrumbToolbar.vue'
import GlobalSummaryGrid from './components/GlobalSummaryGrid.vue'
import CommandPaletteBar from './components/CommandPaletteBar.vue'

const brand = ''

const navLinks = [
  { label: 'Dashboard', active: true },
  { label: 'People' },
  { label: 'Hiring' },
  { label: 'Devices' },
  { label: 'Apps' },
  { label: 'Salary' },
  { label: 'Calendar' },
  { label: 'Reviews' },
]

const commandTags = ['vacances 2026', 'projet roman', 'abonnements', 'transactions', 'notes liées']

const navActions = [
  { type: 'pill', label: 'Setting', icon: '⚙️' },
  { type: 'icon', icon: '🔔', label: 'Notifications', variant: 'alert' },
  { type: 'icon', icon: '👤', label: 'Profil', variant: 'profile' },
]

const breadcrumbs = ['Accueil', 'Dashboard']

const filters = [
  { icon: '🔍', label: 'Search' },
  { icon: '🧭', label: 'Filters' },
  { icon: '📅', label: '20-27 Jan, 2025' },
]

const heroActions = computed(() => {
  const actions = []
  const hasHiddenWidgets = widgetCatalog.value.some((widget) => !widget.active)
  actions.push({ label: hasHiddenWidgets ? 'Ajouter un widget' : 'Retirer un widget', icon: hasHiddenWidgets ? '➕' : '−' })
  actions.push({ label: 'Créer un rapport' })
  return actions
})

const widgetCatalog = ref([
  {
    id: 'balance',
    icon: '💼',
    label: 'Solde total',
    value: '€42 380',
    meta: '4 comptes synchronisés',
    background: 'linear-gradient(135deg, rgba(237, 253, 147, 0.8), rgba(255, 255, 255, 0.95))',
    borderColor: 'rgba(237, 253, 147, 0.6)',
    iconBackground: 'rgba(237, 253, 147, 0.75)',
    active: true,
  },
  {
    id: 'spend',
    icon: '📉',
    label: 'Dépenses du mois',
    value: '€3 920',
    meta: '‑8% vs janvier',
    background: 'linear-gradient(135deg, rgba(201, 206, 226, 0.9), rgba(255, 255, 255, 0.95))',
    borderColor: 'rgba(200, 206, 225, 0.8)',
    iconBackground: 'rgba(200, 206, 225, 0.8)',
    active: true,
  },
  {
    id: 'payments',
    icon: '📆',
    label: 'Paiements à venir',
    value: '€1 140',
    meta: 'Prochains 10 jours',
    background: 'linear-gradient(135deg, rgba(147, 214, 214, 0.8), rgba(255, 255, 255, 0.95))',
    borderColor: 'rgba(147, 214, 214, 0.7)',
    iconBackground: 'rgba(147, 214, 214, 0.75)',
    active: true,
  },
  {
    id: 'notes',
    icon: '🗒️',
    label: 'Notes critiques',
    value: '3 notes',
    meta: 'Vacances 2026, Roman, Abonnements',
    background: 'linear-gradient(135deg, rgba(200, 206, 225, 0.45), rgba(255, 255, 255, 0.95))',
    borderColor: 'rgba(200, 206, 225, 0.6)',
    iconBackground: 'rgba(200, 206, 225, 0.65)',
    active: true,
  },
  {
    id: 'vacation',
    icon: '✈️',
    label: 'Budget vacances',
    value: '€7 800',
    meta: 'Assoc. à 2 comptes · Reste €2 150',
    background: 'linear-gradient(135deg, rgba(147, 214, 214, 0.7), rgba(237, 253, 147, 0.75))',
    borderColor: 'rgba(147, 214, 214, 0.7)',
    iconBackground: 'rgba(237, 253, 147, 0.8)',
    active: false,
  },
])

const activeWidgets = computed(() => widgetCatalog.value.filter((widget) => widget.active))

const showWidgetManager = ref(false)

const toggleWidget = (id) => {
  widgetCatalog.value = widgetCatalog.value.map((widget) =>
    widget.id === id ? { ...widget, active: !widget.active } : widget
  )
}

const handleToolbarAction = (action) => {
  if (action.label === 'Ajouter un widget' || action.label === 'Retirer un widget') {
    showWidgetManager.value = true
  }
}
</script>

<style scoped>
.widget-modal {
  position: fixed;
  inset: 0;
  background: rgba(7, 8, 15, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(6px);
  z-index: 50;
}

.widget-modal__panel {
  width: min(420px, 90vw);
  background: rgba(255, 255, 255, 0.98);
  border-radius: 32px;
  padding: 1.75rem;
  box-shadow: 0 30px 70px rgba(15, 23, 42, 0.2);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.widget-modal__panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.widget-modal__panel h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
}

.widget-modal__close {
  border: none;
  background: rgba(248, 248, 255, 0.9);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  cursor: pointer;
  font-size: 1rem;
}

.widget-modal__panel ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.widget-modal__panel label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.95rem;
  color: #0f172a;
}

.widget-modal__panel small {
  display: block;
  color: rgba(15, 23, 42, 0.55);
  font-size: 0.8rem;
}

.widget-modal__cta {
  border: none;
  border-radius: 999px;
  padding: 0.65rem 1.4rem;
  background: #000;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
</style>
