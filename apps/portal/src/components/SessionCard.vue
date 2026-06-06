<template>
  <div class="session-card" @click="$emit('click', session)">
    <div class="header">
      <span class="title">{{ session.title || 'Untitled Session' }}</span>
      <StatusBadge :status="session.status" />
    </div>
    <div class="meta">
      <span class="id">{{ session.id }}</span>
      <span class="created">{{ relativeTime(session.createdAt) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FlowSession } from '@/types'
import StatusBadge from './StatusBadge.vue'

defineProps<{ session: FlowSession }>()
defineEmits<{ click: [session: FlowSession] }>()

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
</script>

<style scoped>
.session-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 1rem;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.session-card:hover {
  border-color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.1);
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}
.title {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--color-text);
}
.meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}
.id {
  font-family: monospace;
  opacity: 0.6;
}
</style>
