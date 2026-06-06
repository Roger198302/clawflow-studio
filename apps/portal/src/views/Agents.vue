<template>
  <div>
    <h1>Agents</h1>
    <p class="muted">Connected agents and runtime status</p>
    <div class="empty">
      <p>No agents connected yet.</p>
    </div>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
.muted { color: var(--color-text-muted); margin-bottom: 2rem; }
.empty {
  background: var(--color-surface);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius);
  padding: 3rem;
  text-align: center;
  color: var(--color-text-muted);
}
</style>
