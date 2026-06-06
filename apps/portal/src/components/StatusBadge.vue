<template>
  <span class="badge" :class="status">{{ status }}</span>
</template>

<script setup lang="ts">
defineProps<{ status: string }>()
</script>

<style scoped>
.badge {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
}
.idle    { background: rgba(107,114,128,0.15); color: #6b7280; }
.running { background: rgba(59,130,246,0.15); color: #3b82f6; }
.paused  { background: rgba(234,179,8,0.15);  color: #f59e0b; }
.completed { background: rgba(16,185,129,0.15); color: #10b981; }
.error   { background: rgba(239,68,68,0.15); color: #ef4444; }
</style>
