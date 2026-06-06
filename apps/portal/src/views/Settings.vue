<template>
  <div>
    <h1>Settings</h1>
    <p class="muted">Portal and tenant configuration</p>
    <div class="section">
      <h2>Tenant Info</h2>
      <div class="field">
        <label>Tenant ID</label>
        <input type="text" placeholder="tenant-id" />
      </div>
      <div class="field">
        <label>Gateway URL</label>
        <input type="text" placeholder="http://localhost:3000" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped>
h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
.muted { color: var(--color-text-muted); margin-bottom: 2rem; }
.section {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 1.5rem;
  max-width: 480px;
}
h2 { font-size: 1rem; margin-bottom: 1rem; }
.field { margin-bottom: 1rem; }
label {
  display: block;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-bottom: 0.35rem;
}
input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  color: var(--color-text);
  font-size: 0.9rem;
}
input:focus {
  outline: none;
  border-color: var(--color-primary);
}
</style>
