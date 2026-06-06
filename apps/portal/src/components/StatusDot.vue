<template>
  <span class="dot" :class="status" :title="status" />
</template>

<script setup lang="ts">
defineProps<{ status: string }>()
</script>

<style scoped>
.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.online  { background: #10b981; }
.offline { background: #6b7280; }
.error   { background: #ef4444; }
.unknown { background: #f59e0b; }
</style>
