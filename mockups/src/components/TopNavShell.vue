<template>
  <div class="top-nav" :class="{ wrap, 'nav-mobile-open': isMobileNavOpen }">
    <div class="top-nav-left">
      <button
        class="menu-toggle"
        type="button"
        @click="toggleMobileNav"
        aria-label="Afficher le menu"
      >
        <span class="menu-toggle-glyph" :class="{ open: isMobileNavOpen }">
          <span></span>
          <span></span>
          <span></span>
        </span>
        <span class="menu-toggle-label">{{ isMobileNavOpen ? 'Fermer' : 'Menu' }}</span>
      </button>
      <span v-if="brand" class="nav-brand">{{ brand }}</span>
      <div class="nav-menu" :class="{ 'nav-menu--open': isMobileNavOpen }">
        <button
          v-for="link in navLinks"
          :key="link.label"
          class="nav-link"
          :class="{ active: link.active }"
        >
          <span v-if="link.icon" class="nav-link-icon">{{ link.icon }}</span>
          {{ link.label }}
        </button>
      </div>
    </div>
    <div class="top-nav-actions">
      <template v-for="(action, index) in actionButtons" :key="index">
        <button
          v-if="action.type === 'pill'"
          class="settings-pill"
        >
          <span v-if="action.icon" class="nav-link-icon settings-icon">{{ action.icon }}</span>
          {{ action.label }}
        </button>
        <button
          v-else
          class="top-nav-icon"
          :class="action.variant ? `top-nav-icon--${action.variant}` : ''"
          :title="action.label"
        >
          <span>{{ action.icon || '•' }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  brand: { type: String, default: '' },
  navLinks: { type: Array, default: () => [] },
  actionButtons: { type: Array, default: () => [] },
  wrap: { type: Boolean, default: true },
})

const isMobileNavOpen = ref(false)

const toggleMobileNav = () => {
  if (window.innerWidth > 768) return
  isMobileNavOpen.value = !isMobileNavOpen.value
}
</script>

<style scoped>
.top-nav {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  padding: 0.8rem 1.4rem;
  border-radius: 999px;
  background: linear-gradient(120deg, rgba(255, 255, 255, 0.97), rgba(241, 244, 255, 0.95));
  border: 1px solid rgba(200, 206, 225, 0.6);
  box-shadow: 0 22px 45px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(24px);
  width: 100%;
}

.top-nav-left {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.menu-toggle {
  display: none;
  border: none;
  border-radius: 999px;
  background: #000;
  color: #fff;
  height: 36px;
  padding: 0 0.9rem;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow: inset 0 -3px 10px rgba(255, 255, 255, 0.08), 0 12px 24px rgba(0, 0, 0, 0.25);
}

.menu-toggle-glyph {
  display: inline-flex;
  flex-direction: column;
  gap: 3px;
}

.menu-toggle-glyph span {
  width: 12px;
  height: 2px;
  border-radius: 999px;
  background: currentColor;
  display: block;
  transition: transform 0.2s ease;
}

.menu-toggle-glyph.open span:nth-child(1) {
  transform: translateY(3px) rotate(40deg);
}

.menu-toggle-glyph.open span:nth-child(2) {
  transform: translateY(-3px) rotate(-40deg);
}

.nav-brand {
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.45em;
  text-transform: uppercase;
  color: rgba(15, 23, 42, 0.45);
  padding-left: 0.4rem;
}

.nav-menu {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.nav-link {
  border-radius: 999px;
  padding: 0.45rem 1rem;
  font-size: 0.95rem;
  font-weight: 500;
  color: rgba(17, 24, 39, 0.8);
  border: 1px solid transparent;
  background: transparent;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
}

.nav-link.active {
  background: #050505;
  color: #fff;
  border-color: #050505;
  box-shadow: inset 0 -4px 14px rgba(0, 0, 0, 0.4);
}

.nav-link-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.06);
  border: 1px solid rgba(15, 23, 42, 0.05);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
}

.nav-link.active .nav-link-icon {
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}

.top-nav-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.settings-pill {
  border-radius: 999px;
  border: 1px solid rgba(200, 206, 225, 0.8);
  background: rgba(255, 255, 255, 0.98);
  padding: 0.4rem 0.95rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.86rem;
  color: rgba(15, 23, 42, 0.85);
  box-shadow: 0 15px 32px rgba(15, 23, 42, 0.08);
}

.settings-icon {
  background: rgba(15, 23, 42, 0.07);
}

.top-nav-icon {
  width: 36px;
  height: 36px;
  border-radius: 20px;
  border: 1px solid rgba(200, 206, 225, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.12);
  font-size: 0.95rem;
}

.top-nav-icon--alert {
  background: rgba(255, 247, 210, 0.9);
  border-color: rgba(255, 195, 78, 0.5);
}

.top-nav-icon--profile {
  background: rgba(241, 245, 255, 0.95);
  border-color: rgba(200, 206, 225, 0.7);
}

@media (max-width: 1024px) {
  .top-nav {
    padding: 0.85rem 1.2rem;
    gap: 0.75rem;
  }

  .top-nav-left {
    flex: 1;
    min-width: 0;
  }

  .nav-menu {
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .nav-menu::-webkit-scrollbar {
    display: none;
  }

  .nav-link {
    white-space: nowrap;
  }
}

@media (max-width: 640px) {
  .menu-toggle {
    display: inline-flex;
  }

  .nav-menu {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    right: 0;
    padding: 0.85rem 1rem;
    border-radius: 28px;
    background: rgba(255, 255, 255, 0.95);
    box-shadow: 0 25px 45px rgba(15, 23, 42, 0.12);
    display: none;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: flex-start;
    z-index: 5;
  }

  .nav-menu--open {
    display: flex;
  }
}
</style>
