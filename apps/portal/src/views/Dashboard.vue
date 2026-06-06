<template>
  <div>
    <h1>Dashboard</h1>
    <p class="muted">Welcome to ClawFlow Portal</p>
    <div class="cards">
      <div class="card">
        <div class="card-value">{{ stats.agents }}</div>
        <div class="card-label">Active Agents</div>
      </div>
      <div class="card">
        <div class="card-value">{{ stats.flows }}</div>
        <div class="card-label">Flows</div>
      </div>
      <div class="card">
        <div class="card-value">{{ stats.tasks }}</div>
        <div class="card-label">Tasks Today</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const stats = { agents: 0, flows: 0, tasks: 0 }
</script>

<style scoped>
h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
.muted { color: var(--color-text-muted); margin-bottom: 2rem; }
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 1.25rem;
}
.card-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-primary);
}
.card-label {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-top: 0.25rem;
}
</style>
