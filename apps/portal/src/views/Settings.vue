<template>
  <div>
    <div class="topbar">
      <div>
        <h1>Settings</h1>
        <p class="muted">Portal and tenant configuration</p>
      </div>
    </div>

    <div class="settings-layout">
      <!-- User section -->
      <section class="section">
        <h2>User</h2>
        <div class="card">
          <div v-if="auth.isAuthenticated" class="user-info">
            <div class="user-avatar">{{ initials }}</div>
            <div class="user-details">
              <div class="user-name">{{ auth.user?.name }}</div>
              <div class="user-email">{{ auth.user?.email }}</div>
              <div class="user-role badge" :class="auth.user?.role">{{ auth.user?.role }}</div>
            </div>
          </div>
          <div v-else class="not-authed">
            <p class="muted">Not logged in.</p>
            <button class="btn-primary" @click="showLogin = true">Login</button>
          </div>
        </div>
      </section>

      <!-- Tenant section -->
      <section class="section">
        <h2>Tenant</h2>
        <div class="card">
          <template v-if="auth.isAuthenticated && auth.tenant">
            <div class="field-row">
              <span class="field-label">Tenant ID</span>
              <span class="field-value mono">{{ auth.tenant.id }}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Name</span>
              <span class="field-value">{{ auth.tenant.name }}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Plan</span>
              <span class="field-value badge" :class="auth.tenant.plan">{{ auth.tenant.plan }}</span>
            </div>
          </template>
          <template v-else>
            <p class="muted">No tenant associated.</p>
          </template>
        </div>
      </section>

      <!-- Gateway section -->
      <section class="section">
        <h2>Gateway</h2>
        <div class="card">
          <div class="field-row">
            <span class="field-label">Gateway URL</span>
            <span class="field-value mono">/api</span>
          </div>
          <div class="field-row">
            <span class="field-label">Status</span>
            <span v-if="gateway.status" class="field-value">
              <StatusDot :status="gateway.status.healthy ? 'online' : 'error'" size="sm" />
              {{ gateway.status.healthy ? 'Connected' : 'Unhealthy' }}
            </span>
            <span v-else-if="gateway.error" class="field-value error">Error</span>
            <span v-else class="field-value muted">—</span>
          </div>
          <div v-if="gateway.status" class="field-row">
            <span class="field-label">Version</span>
            <span class="field-value">{{ gateway.status.version }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Runtimes</span>
            <span class="field-value">{{ gateway.status?.runtimes.length ?? '—' }}</span>
          </div>
        </div>
      </section>

      <!-- Logout -->
      <section v-if="auth.isAuthenticated" class="section">
        <h2>Session</h2>
        <div class="card">
          <button class="btn-danger" @click="handleLogout">Sign out</button>
        </div>
      </section>
    </div>

    <!-- Login modal (stub — needs auth implementation) -->
    <div v-if="showLogin" class="modal-overlay" @click.self="showLogin = false">
      <div class="modal">
        <h2>Sign in</h2>
        <div class="field">
          <label>Token</label>
          <input v-model="loginToken" type="password" placeholder="Paste your access token" />
        </div>
        <p class="modal-note">
          Auth integration not yet implemented. Token will be stored locally.
        </p>
        <div class="modal-actions">
          <button class="btn-ghost" @click="showLogin = false">Cancel</button>
          <button class="btn-primary" @click="handleLogin">Sign in</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore, useGatewayStore } from '@/stores'
import StatusDot from '@/components/StatusDot.vue'

const auth = useAuthStore()
const gateway = useGatewayStore()

const showLogin = ref(false)
const loginToken = ref('')

const initials = computed(() => {
  const name = auth.user?.name ?? ''
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

function handleLogin() {
  // Stub: create a minimal session from the token field
  // Real implementation calls auth endpoint
  auth.login(loginToken.value, {
    id: 'local-user',
    name: 'Local User',
    email: 'user@localhost',
    role: 'operator',
    tenantId: 'local-tenant',
  }, {
    id: 'local-tenant',
    name: 'Local Tenant',
    plan: 'pro',
  })
  showLogin.value = false
  loginToken.value = ''
}

function handleLogout() {
  auth.logout()
}

onMounted(async () => {
  auth.restoreSession()
  if (!gateway.status) {
    await gateway.fetchStatus()
  }
})
</script>

<style scoped>
.topbar { margin-bottom: 2rem; }
h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
.muted { color: var(--color-text-muted); }

.settings-layout {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 600px;
}

.section h2 {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  margin-bottom: 0.75rem;
}

.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 1.25rem;
}

.field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.875rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--color-border);
}
.field-row:last-child { border-bottom: none; }
.field-label { color: var(--color-text-muted); }
.field-value { font-weight: 500; }
.field-value.mono { font-family: monospace; font-size: 0.8rem; }
.field-value.muted { color: var(--color-text-muted); }
.field-value.error { color: #ef4444; }
.field-value { display: flex; align-items: center; gap: 0.4rem; }

/* User section */
.user-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.user-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.1rem;
  flex-shrink: 0;
}
.user-name { font-weight: 600; }
.user-email { font-size: 0.8rem; color: var(--color-text-muted); margin-top: 0.15rem; }
.user-role { margin-top: 0.35rem; display: inline-block; }

.not-authed {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Badges */
.badge {
  display: inline-block;
  padding: 0.15rem 0.6rem;
  border-radius: 9999px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: capitalize;
}
.badge.admin { background: #7c3aed; color: #fff; }
.badge.operator { background: #2563eb; color: #fff; }
.badge.viewer { background: #6b7280; color: #fff; }
.badge.free { background: #6b7280; color: #fff; }
.badge.pro { background: #2563eb; color: #fff; }
.badge.enterprise { background: #7c3aed; color: #fff; }

/* Buttons */
.btn-primary {
  padding: 0.5rem 1.25rem;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  cursor: pointer;
  font-size: 0.9rem;
}
.btn-primary:hover { background: var(--color-primary-hover); }

.btn-ghost {
  padding: 0.5rem 1rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  color: var(--color-text);
  cursor: pointer;
  font-size: 0.9rem;
}
.btn-ghost:hover { border-color: var(--color-primary); color: var(--color-primary); }

.btn-danger {
  padding: 0.5rem 1.25rem;
  background: transparent;
  color: #ef4444;
  border: 1px solid #ef4444;
  border-radius: var(--radius);
  cursor: pointer;
  font-size: 0.9rem;
}
.btn-danger:hover { background: #ef4444; color: #fff; }

/* Modal */
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
  border-radius: calc(var(--radius) * 2);
  padding: 2rem;
  width: min(420px, 90vw);
}
.modal h2 { font-size: 1.25rem; margin-bottom: 1.5rem; }
.modal-note {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-bottom: 1.25rem;
  padding: 0.75rem;
  background: rgba(99, 102, 241, 0.1);
  border-radius: var(--radius);
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
.field { margin-bottom: 1.25rem; }
label {
  display: block;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-bottom: 0.4rem;
}
input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  color: var(--color-text);
  font-size: 0.9rem;
  box-sizing: border-box;
}
input:focus { outline: none; border-color: var(--color-primary); }
</style>
