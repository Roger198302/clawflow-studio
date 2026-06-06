<template>
  <div>
    <div class="topbar">
      <div>
        <h1>Dashboard</h1>
        <p class="muted">Welcome to ClawFlow Portal</p>
      </div>
      <GatewayBadge />
    </div>

    <div v-if="gateway.loading" class="loading-msg">Connecting to gateway...</div>
    <div v-else-if="gateway.error" class="error-msg">⚠ {{ gateway.error }}</div>

    <template v-else-if="gateway.status">
      <div class="cards">
        <div class="card">
          <div class="card-value">{{ gateway.status.runtimes.length }}</div>
          <div class="card-label">Runtimes</div>
        </div>
        <div class="card">
          <div class="card-value">{{ onlineRuntimes }}</div>
          <div class="card-label">Online</div>
        </div>
        <div class="card">
          <div class="card-value">{{ sessionsStore.sessions.length }}</div>
          <div class="card-label">Sessions</div>
        </div>
        <div class="card">
          <div class="card-value">{{ gateway.status.version }}</div>
          <div class="card-label">Gateway Version</div>
        </div>
      </div>

      <section class="section">
        <h2>Runtimes</h2>
        <div class="runtimes">
          <div v-for="runtime in gateway.status.runtimes" :key="runtime.id" class="runtime-row">
            <StatusDot :status="gateway.status!.runtimeHealths[runtime.id]?.status ?? 'unknown'" />
            <span class="runtime-name">{{ runtime.name }}</span>
            <span class="runtime-type">{{ runtime.type }}</span>
            <span class="runtime-mode">{{ runtime.executionMode }}</span>
          </div>
        </div>
      </section>
    </template>

    <section class="section">
      <h2>Sessions</h2>
      <div v-if="sessionsStore.loading" class="loading-msg">Loading sessions...</div>
      <div v-else-if="sessionsStore.sessions.length === 0" class="empty-msg">
        No sessions yet. Create one from the Flows page.
      </div>
      <div v-else class="session-list">
        <SessionCard
          v-for="session in sessionsStore.sessions"
          :key="session.id"
          :session="session"
          @click="navigateToSession"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGatewayStore, useSessionsStore } from '@/stores'
import GatewayBadge from '@/components/GatewayBadge.vue'
import StatusDot from '@/components/StatusDot.vue'
import SessionCard from '@/components/SessionCard.vue'
import type { FlowSession, RuntimeSpec } from '@/types'

const gateway = useGatewayStore()
const sessionsStore = useSessionsStore()
const router = useRouter()

const onlineRuntimes = computed(() =>
  gateway.status?.runtimes.filter((r: RuntimeSpec) => r.status === 'online').length ?? 0
)

function navigateToSession(session: FlowSession) {
  router.push({ name: 'flows', query: { session: session.id } })
}

onMounted(async () => {
  await gateway.fetchStatus()
  await sessionsStore.fetchSessions()
})
</script>

<style scoped>
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
}
h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
.muted { color: var(--color-text-muted); }
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 1.25rem;
}
.card-value { font-size: 2rem; font-weight: 700; color: var(--color-primary); }
.card-label { font-size: 0.8rem; color: var(--color-text-muted); margin-top: 0.25rem; }
.section { margin-top: 2rem; }
.section h2 { font-size: 1.1rem; margin-bottom: 1rem; color: var(--color-text); }
.loading-msg { color: var(--color-text-muted); font-size: 0.9rem; }
.error-msg { color: #ef4444; font-size: 0.9rem; margin-bottom: 1rem; }
.empty-msg { color: var(--color-text-muted); font-size: 0.9rem; }
.runtimes {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  overflow: hidden;
}
.runtime-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 1rem;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.85rem;
}
.runtime-row:last-child { border-bottom: none; }
.runtime-name { font-weight: 600; flex: 1; }
.runtime-type, .runtime-mode { color: var(--color-text-muted); font-size: 0.75rem; }
.session-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.75rem;
}
</style>
