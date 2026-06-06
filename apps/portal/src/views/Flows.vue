<template>
  <div>
    <h1>Flows</h1>
    <p class="muted">Manage your automation flows</p>
    <div class="empty">
      <p>No flows yet. Create your first flow to get started.</p>
      <button class="btn-primary">New Flow</button>
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
.btn-primary {
  margin-top: 1rem;
  padding: 0.5rem 1.25rem;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  cursor: pointer;
  font-size: 0.9rem;
}
.btn-primary:hover { background: var(--color-primary-hover); }
</style>
