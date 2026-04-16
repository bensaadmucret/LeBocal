import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('../pages/DashboardPage.vue'),
    meta: { label: 'Tableau de bord', icon: '🏠' },
  },
  {
    path: '/notes',
    name: 'notes',
    component: () => import('../pages/NotesPage.vue'),
    meta: { label: 'Notes', icon: '🗒️' },
  },
  {
    path: '/notes/:id',
    name: 'note-edit',
    component: () => import('../pages/NotesPage.vue'),
    meta: { label: 'Notes', icon: '🗒️' },
  },
  {
    path: '/budget',
    name: 'budget',
    component: () => import('../pages/BudgetPage.vue'),
    meta: { label: 'Budget', icon: '💶' },
  },
  {
    path: '/calendar',
    name: 'calendar',
    component: () => import('../pages/CalendarPage.vue'),
    meta: { label: 'Calendrier', icon: '📅' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../pages/SettingsPage.vue'),
    meta: { label: 'Paramètres', icon: '⚙️' },
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
