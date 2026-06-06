<template>
  <div class="detail">
    <!-- Top bar -->
    <div class="topbar">
      <button class="btn-ghost back-btn" @click="router.back()">← Back</button>
      <div class="header-info">
        <h1>{{ sessionDetail?.session.title || 'Session' }}</h1>
        <StatusBadge v-if="sessionDetail?.session.status" :status="sessionDetail.session.status" />
      </div>
    </div>

    <!-- Loading / error -->
    <div v-if="loading" class="loading-msg">Loading session...</div>
    <div v-else-if="error" class="error-msg">⚠ {{ error }}</div>

    <template v-else-if="sessionDetail">
      <!-- Session meta -->
      <div class="meta-row">
        <span class="meta-item">
          <span class="meta-label">ID</span>
          <code class="mono">{{ sessionDetail.session.id }}</code>
        </span>
        <span class="meta-item">
          <span class="meta-label">Created</span>
          <span>{{ formatDate(sessionDetail.session.createdAt) }}</span>
        </span>
        <span class="meta-item">
          <span class="meta-label">Updated</span>
          <span>{{ formatDate(sessionDetail.session.updatedAt) }}</span>
        </span>
        <span v-if="sessionDetail.session.currentNodeId" class="meta-item">
          <span class="meta-label">Current Node</span>
          <code class="mono">{{ sessionDetail.session.currentNodeId }}</code>
        </span>
      </div>

      <!-- Turns -->
      <section v-if="sessionDetail.turns.length > 0" class="section">
        <h2>Conversation</h2>
        <div class="turns">
          <div
            v-for="turn in sessionDetail.turns"
            :key="turn.id"
            class="turn"
            :class="`turn--${turn.role}`"
          >
            <div class="turn-header">
              <span class="turn-role">{{ turn.role }}</span>
              <span v-if="turn.nodeId" class="turn-node">node: {{ turn.nodeId }}</span>
              <span class="turn-time">{{ formatDate(turn.createdAt) }}</span>
            </div>
            <div class="turn-content">{{ turn.content }}</div>
          </div>
        </div>
      </section>

      <!-- Steps -->
      <section v-if="sessionDetail.steps.length > 0" class="section">
        <h2>Steps ({{ sessionDetail.steps.length }})</h2>
        <div class="steps">
          <div
            v-for="(step, idx) in sessionDetail.steps"
            :key="step.id"
            class="step-row"
            :class="`step--${step.status}`"
          >
            <div class="step-idx">{{ idx + 1 }}</div>
            <div class="step-body">
              <div class="step-header">
                <span class="step-title">{{ step.title || step.id }}</span>
                <StatusBadge :status="step.status" />
              </div>
              <div v-if="step.nodeId" class="step-meta">node: {{ step.nodeId }}</div>
              <div v-if="step.error" class="step-error">⚠ {{ step.error }}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Interventions -->
      <section v-if="sessionDetail.interventions?.length" class="section">
        <h2>Interventions</h2>
        <div class="interventions">
          <div
            v-for="iv in sessionDetail.interventions"
            :key="iv.id"
            class="iv-row"
            :class="`iv--${iv.status}`"
          >
            <span class="iv-kind">{{ iv.kind }}</span>
            <StatusBadge :status="iv.status" />
            <span v-if="iv.reason" class="iv-reason">{{ iv.reason }}</span>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionsStore } from '@/stores'
import StatusBadge from '@/components/StatusBadge.vue'

const route = useRoute()
const router = useRouter()
const sessionsStore = useSessionsStore()

const sessionDetail = ref(sessionsStore.currentSession)
const loading = ref(false)
const error = ref<string | null>(null)

function formatDate(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
}

onMounted(async () => {
  const id = route.params.id as string
  if (!id) {
    error.value = 'No session ID provided'
    return
  }
  // Use store's currentSession if it matches; otherwise fetch
  if (sessionDetail.value?.session.id !== id) {
    loading.value = true
    error.value = null
    try {
      await sessionsStore.fetchSession(id)
      sessionDetail.value = sessionsStore.currentSession
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load session'
    } finally {
      loading.value = false
    }
  }
})
</script>

<style scoped>
.detail { max-width: 860px; }

.topbar {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.back-btn {
  padding: 0.4rem 0.9rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  color: var(--color-text);
  cursor: pointer;
  font-size: 0.85rem;
  white-space: nowrap;
}
.back-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }

.header-info { display: flex; align-items: center; gap: 0.75rem; }
h1 { font-size: 1.5rem; margin: 0; }

.loading-msg, .error-msg { font-size: 0.9rem; margin-bottom: 1rem; }
.error-msg { color: #ef4444; }

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
  font-size: 0.8rem;
}
.meta-item { display: flex; flex-direction: column; gap: 0.2rem; }
.meta-label { color: var(--color-text-muted); }
.mono { font-family: monospace; font-size: 0.75rem; }

.section { margin-bottom: 2rem; }
.section h2 { font-size: 1rem; margin-bottom: 0.9rem; color: var(--color-text-muted); }

/* Turns */
.turns { display: flex; flex-direction: column; gap: 0.75rem; }
.turn {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 1rem;
}
.turn--user { border-left: 3px solid #3b82f6; }
.turn--assistant { border-left: 3px solid #22c55e; }
.turn--runtime { border-left: 3px solid #a855f7; }
.turn--system { border-left: 3px solid #f59e0b; }

.turn-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.75rem;
  margin-bottom: 0.5rem;
}
.turn-role {
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.7rem;
  background: var(--color-bg);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}
.turn-node, .turn-time { color: var(--color-text-muted); }
.turn-content { font-size: 0.875rem; line-height: 1.6; white-space: pre-wrap; }

/* Steps */
.steps { display: flex; flex-direction: column; gap: 0.5rem; }
.step-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 0.75rem 1rem;
}
.step-row.step--failed { border-color: #ef4444; }
.step-row.step--running { border-color: #3b82f6; }
.step-idx {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 0.1rem;
}
.step-body { flex: 1; min-width: 0; }
.step-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; }
.step-title { font-size: 0.85rem; font-weight: 600; }
.step-meta { font-size: 0.75rem; color: var(--color-text-muted); }
.step-error { font-size: 0.75rem; color: #ef4444; margin-top: 0.25rem; }

/* Interventions */
.interventions { display: flex; flex-direction: column; gap: 0.5rem; }
.iv-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 0.6rem 1rem;
  font-size: 0.85rem;
}
.iv-kind { font-weight: 600; }
.iv-reason { color: var(--color-text-muted); font-size: 0.8rem; margin-left: auto; }
</style>
