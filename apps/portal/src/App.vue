<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="logo">🦞 ClawFlow</div>
      <nav>
        <RouterLink to="/">Dashboard</RouterLink>
        <RouterLink to="/flows">Flows</RouterLink>
        <RouterLink to="/agents">Agents</RouterLink>
        <RouterLink to="/settings">Settings</RouterLink>
      </nav>
    </aside>
    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
}
.sidebar {
  width: 220px;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  padding: 1.5rem 1rem;
  flex-shrink: 0;
}
.logo {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 2rem;
  padding: 0 0.5rem;
}
nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
nav a {
  color: var(--color-text-muted);
  text-decoration: none;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius);
  font-size: 0.9rem;
  transition: background 0.15s, color 0.15s;
}
nav a:hover,
nav a.router-link-active {
  background: rgba(99, 102, 241, 0.15);
  color: var(--color-primary);
}
.content {
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
}
</style>
