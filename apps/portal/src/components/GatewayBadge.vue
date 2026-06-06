<template>
  <div class="gateway-badge" :class="statusClass" :title="tooltip">
    <span class="dot" />
    <span class="label">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGatewayStore } from '@/stores'

const gateway = useGatewayStore()

const statusClass = computed(() => {
  if (gateway.loading) return 'loading'
  if (gateway.error) return 'error'
  if (gateway.status?.healthy) return 'ok'
  return 'unknown'
})

const label = computed(() => {
  if (gateway.loading) return 'Connecting...'
  if (gateway.error) return 'Disconnected'
  if (gateway.status?.healthy) return `Gateway ${gateway.status.version}`
  return 'Unknown'
})

const tooltip = computed(() => {
  if (gateway.error) return `Error: ${gateway.error}`
  if (!gateway.status) return 'No status'
  return `${gateway.status.runtimeMode} mode · ${gateway.status.runtimes.length} runtimes`
})
</script>

<style scoped>
.gateway-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.6rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  border: 1px solid;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.ok {
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.3);
  color: #10b981;
}
.ok .dot { background: #10b981; }
.loading {
  background: rgba(234, 179, 8, 0.1);
  border-color: rgba(234, 179, 8, 0.3);
  color: #f59e0b;
}
.loading .dot {
  background: #f59e0b;
  animation: pulse 1s infinite;
}
.error {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
}
.error .dot { background: #ef4444; }
.unknown {
  background: rgba(107, 114, 128, 0.1);
  border-color: rgba(107, 114, 128, 0.3);
  color: #6b7280;
}
.unknown .dot { background: #6b7280; }
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
