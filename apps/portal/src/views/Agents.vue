<template>
  <div>
    <div class="topbar">
      <div>
        <h1>Agents</h1>
        <p class="muted">Runtime agents and their current status</p>
      </div>
      <div class="topbar-actions">
        <button class="btn-ghost" @click="refresh">Refresh</button>
        <button class="btn-primary" @click="showRegister = true">+ Register Runtime</button>
      </div>
    </div>

    <!-- Register Runtime modal -->
    <div v-if="showRegister" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <h2>Register Runtime</h2>
        <form @submit.prevent="handleRegister">
          <div class="field">
            <label>Name <span class="required">*</span></label>
            <input v-model="form.name" type="text" placeholder="e.g. claude-code-dev" required />
          </div>
          <div class="field">
            <label>Type <span class="required">*</span></label>
            <select v-model="form.type" required>
              <option value="">Select type...</option>
              <option value="openclaw">openclaw</option>
              <option value="mock">mock</option>
              <option value="hermes">hermes</option>
              <option value="codex">codex</option>
              <option value="claude-code">claude-code</option>
              <option value="shell">shell</option>
              <option value="mcp">mcp</option>
              <option value="http">http</option>
              <option value="custom">custom</option>
            </select>
          </div>
          <div class="field">
            <label>Execution Mode <span class="required">*</span></label>
            <select v-model="form.executionMode" required>
              <option value="">Select mode...</option>
              <option value="mock">mock</option>
              <option value="protected">protected</option>
              <option value="unavailable">unavailable</option>
            </select>
          </div>
          <div class="field">
            <label>Endpoint <span class="optional">(optional)</span></label>
            <input v-model="form.endpoint" type="text" placeholder="e.g. ws://localhost:9222" />
          </div>
          <div class="field">
            <label>Command <span class="optional">(optional)</span></label>
            <input v-model="form.command" type="text" placeholder="e.g. npx claude-code" />
          </div>
          <div class="field">
            <label>Description <span class="optional">(optional)</span></label>
            <input v-model="form.description" type="text" placeholder="Brief description" />
          </div>
          <div v-if="registerError" class="error-msg">⚠ {{ registerError }}</div>
          <div v-if="registerSuccess" class="success-msg">✅ Runtime registered successfully.</div>
          <div class="modal-actions">
            <button type="button" class="btn-ghost" @click="closeModal">Cancel</button>
            <button type="submit" class="btn-primary" :disabled="registering">
              {{ registering ? 'Registering...' : 'Register' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="gateway.loading" class="loading-msg">Loading runtimes...</div>
    <div v-else-if="gateway.error" class="error-msg">⚠ {{ gateway.error }}</div>

    <template v-else-if="gateway.status">
      <div class="summary-cards">
        <div class="card">
          <div class="card-value">{{ gateway.status.runtimes.length }}</div>
          <div class="card-label">Total Runtimes</div>
        </div>
        <div class="card success">
          <div class="card-value">{{ onlineCount }}</div>
          <div class="card-label">Online</div>
        </div>
        <div class="card danger">
          <div class="card-value">{{ gateway.status.runtimes.length - onlineCount }}</div>
          <div class="card-label">Offline</div>
        </div>
        <div class="card">
          <div class="card-value">{{ gateway.status.healthy ? '✅' : '❌' }}</div>
          <div class="card-label">Gateway Healthy</div>
        </div>
      </div>

      <section class="section">
        <h2>Runtime Details</h2>
        <div v-if="gateway.status.runtimes.length === 0" class="empty-msg">
          No runtimes registered with the gateway.
        </div>
        <div class="runtime-grid">
          <div
            v-for="runtime in gateway.status.runtimes"
            :key="runtime.id"
            class="runtime-card"
          >
            <div class="runtime-header">
              <StatusDot
                :status="gateway.status!.runtimeHealths[runtime.id]?.status ?? 'unknown'"
                size="md"
              />
              <span class="runtime-name">{{ runtime.name }}</span>
            </div>

            <div class="runtime-fields">
              <div class="field-row">
                <span class="field-label">ID</span>
                <span class="field-value mono">{{ runtime.id }}</span>
              </div>
              <div class="field-row">
                <span class="field-label">Type</span>
                <span class="field-value">{{ runtime.type }}</span>
              </div>
              <div class="field-row">
                <span class="field-label">Mode</span>
                <span class="field-value badge">{{ runtime.executionMode }}</span>
              </div>

            </div>

            <div v-if="gateway.status!.runtimeHealths[runtime.id]" class="health-detail">
              <div class="field-row">
                <span class="field-label">Health</span>
                <StatusBadge
                  :status="gateway.status!.runtimeHealths[runtime.id].status ?? 'unknown'"
                />
              </div>
              <div
                v-if="gateway.status!.runtimeHealths[runtime.id].message"
                class="health-error"
              >
                ⚠ {{ gateway.status!.runtimeHealths[runtime.id].message }}
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useGatewayStore } from '@/stores'
import { registerRuntime } from '@/api'
import type { RuntimeType, RuntimeExecutionMode } from '@/types'
import StatusDot from '@/components/StatusDot.vue'
import StatusBadge from '@/components/StatusBadge.vue'

const gateway = useGatewayStore()

// ─── Register modal ───────────────────────────────────────────────────────────
const showRegister = ref(false)
const registering = ref(false)
const registerError = ref<string | null>(null)
const registerSuccess = ref(false)

const form = reactive({
  name: '',
  type: '' as RuntimeType | '',
  executionMode: '' as RuntimeExecutionMode | '',
  endpoint: '',
  command: '',
  description: '',
})

function closeModal() {
  showRegister.value = false
  registerError.value = null
  registerSuccess.value = false
  Object.assign(form, { name: '', type: '', executionMode: '', endpoint: '', command: '', description: '' })
}

async function handleRegister() {
  if (!form.name || !form.type || !form.executionMode) return
  registering.value = true
  registerError.value = null
  registerSuccess.value = false
  try {
    await registerRuntime({
      id: `runtime-${Date.now()}`,
      name: form.name,
      type: form.type as RuntimeType,
      executionMode: form.executionMode as RuntimeExecutionMode,
      endpoint: form.endpoint || undefined,
      command: form.command || undefined,
      description: form.description || undefined,
      capabilities: [],
    })
    registerSuccess.value = true
    await gateway.fetchStatus()
    setTimeout(closeModal, 1200)
  } catch (e: unknown) {
    registerError.value = e instanceof Error ? e.message : 'Failed to register runtime'
  } finally {
    registering.value = false
  }
}

// ─── Computed ──────────────────────────────────────────────────────────────────
const onlineCount = computed(
  () =>
    gateway.status?.runtimes.filter(
      (r) => gateway.status!.runtimeHealths[r.id]?.status === 'online'
    ).length ?? 0
)

// ─── Refresh ──────────────────────────────────────────────────────────────────
async function refresh() {
  await gateway.fetchStatus()
}

onMounted(async () => {
  if (!gateway.status) {
    await gateway.fetchStatus()
  }
})
</script>

<style scoped>
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
}
.topbar-actions { display: flex; gap: 0.5rem; }
h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
.muted { color: var(--color-text-muted); }
.btn-ghost {
  padding: 0.4rem 1rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  color: var(--color-text);
  cursor: pointer;
  font-size: 0.85rem;
}
.btn-ghost:hover { border-color: var(--color-primary); color: var(--color-primary); }
.btn-primary {
  padding: 0.4rem 1rem;
  background: var(--color-primary);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius);
  color: #fff;
  cursor: pointer;
  font-size: 0.85rem;
}
.btn-primary:hover { opacity: 0.85; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 1.25rem;
}
.card.success .card-value { color: #22c55e; }
.card.danger .card-value { color: #ef4444; }
.card-value { font-size: 2rem; font-weight: 700; color: var(--color-primary); }
.card-label { font-size: 0.75rem; color: var(--color-text-muted); margin-top: 0.25rem; }

.section { margin-top: 1.5rem; }
.section h2 { font-size: 1.1rem; margin-bottom: 1rem; }

.loading-msg { color: var(--color-text-muted); }
.error-msg { color: #ef4444; margin-bottom: 1rem; }
.empty-msg { color: var(--color-text-muted); font-size: 0.9rem; }

.runtime-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}
.runtime-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 1.25rem;
}
.runtime-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 1rem;
}
.runtime-name { font-weight: 700; font-size: 1rem; }

.runtime-fields { display: flex; flex-direction: column; gap: 0.4rem; }
.field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.8rem;
}
.field-label { color: var(--color-text-muted); }
.field-value { color: var(--color-text); font-weight: 500; }
.field-value.mono { font-family: monospace; font-size: 0.75rem; opacity: 0.7; }
.field-value.badge {
  background: var(--color-primary);
  color: #fff;
  border-radius: 9999px;
  padding: 0.1rem 0.5rem;
  font-size: 0.7rem;
}

.health-detail {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border);
}
.health-error {
  margin-top: 0.4rem;
  font-size: 0.75rem;
  color: #f59e0b;
}

/* ─── Modal ───────────────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 1.75rem;
  width: min(480px, 90vw);
  max-height: 90vh;
  overflow-y: auto;
}
.modal h2 { font-size: 1.2rem; margin-bottom: 1.25rem; }
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.25rem;
}

/* ─── Form fields ──────────────────────────────────────────────────────────── */
.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-bottom: 1rem;
}
.field label {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  font-weight: 500;
}
.field .required { color: #ef4444; }
.field .optional { color: var(--color-text-muted); font-weight: 400; font-size: 0.75rem; }
.field input,
.field select {
  padding: 0.45rem 0.75rem;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  color: var(--color-text);
  font-size: 0.85rem;
  font-family: inherit;
}
.field input:focus,
.field select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.error-msg { color: #ef4444; font-size: 0.8rem; margin-top: 0.5rem; }
.success-msg { color: #22c55e; font-size: 0.8rem; margin-top: 0.5rem; }
</style>
