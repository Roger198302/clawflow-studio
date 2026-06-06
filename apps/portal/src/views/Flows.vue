<template>
  <div>
    <div class="topbar">
      <div>
        <h1>Flows</h1>
        <p class="muted">Create and manage your automation sessions</p>
      </div>
      <button class="btn-primary" @click="showCreate = true">+ New Session</button>
    </div>

    <!-- Create session modal -->
    <div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
      <div class="modal">
        <h2>New Session</h2>
        <div class="field">
          <label>Session Title <span class="optional">(optional)</span></label>
          <input
            v-model="newTitle"
            type="text"
            placeholder="e.g. Daily standup digest"
            @keyup.enter="handleCreate"
          />
        </div>
        <div class="modal-actions">
          <button class="btn-ghost" @click="showCreate = false">Cancel</button>
          <button class="btn-primary" :disabled="creating" @click="handleCreate">
            {{ creating ? 'Creating...' : 'Create' }}
          </button>
        </div>
        <div v-if="createError" class="error-msg">⚠ {{ createError }}</div>
      </div>
    </div>

    <!-- Sessions list -->
    <div v-if="sessionsStore.loading" class="loading-msg">Loading sessions...</div>
    <div v-else-if="sessionsStore.error" class="error-msg">⚠ {{ sessionsStore.error }}</div>

    <template v-else>
      <!-- Search / filter bar -->
      <div v-if="sessionsStore.sessions.length > 0" class="search-bar">
        <input
          v-model="search"
          type="text"
          placeholder="Search sessions..."
          class="search-input"
        />
        <select v-model="statusFilter" class="filter-select">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="idle">Idle</option>
          <option value="completed">Completed</option>
          <option value="error">Error</option>
        </select>
      </div>

      <div v-if="filteredSessions.length === 0 && sessionsStore.sessions.length === 0" class="empty">
        <div class="empty-icon">🚀</div>
        <p>No sessions yet. Create your first flow to get started.</p>
        <button class="btn-primary" @click="showCreate = true">+ New Session</button>
      </div>

      <div v-else-if="filteredSessions.length === 0" class="empty">
        <p>No sessions match your filter.</p>
        <button class="btn-ghost" @click="search = ''; statusFilter = 'all'">Clear filter</button>
      </div>

      <div v-else class="session-grid">
        <SessionCard
          v-for="session in filteredSessions"
          :key="session.id"
          :session="session"
          @click="openSession"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSessionsStore } from '@/stores'
import SessionCard from '@/components/SessionCard.vue'
import type { FlowSession } from '@/types'

const sessionsStore = useSessionsStore()

const showCreate = ref(false)
const newTitle = ref('')
const creating = ref(false)
const createError = ref<string | null>(null)
const search = ref('')
const statusFilter = ref('all')

const filteredSessions = computed(() => {
  let list = sessionsStore.sessions
  if (statusFilter.value !== 'all') {
    list = list.filter((s) => s.status === statusFilter.value)
  }
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(
      (s) =>
        s.title?.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
    )
  }
  return list
})

async function handleCreate() {
  if (creating.value) return
  creating.value = true
  createError.value = null
  try {
    const session = await sessionsStore.createSession(newTitle.value || undefined)
    showCreate.value = false
    newTitle.value = ''
    openSession(session)
  } catch (e: unknown) {
    createError.value = e instanceof Error ? e.message : 'Failed to create session'
  } finally {
    creating.value = false
  }
}

function openSession(session: FlowSession) {
  // TODO: navigate to session detail view when implemented
  console.info('Session clicked:', session.id)
}

onMounted(async () => {
  await sessionsStore.fetchSessions()
})
</script>

<style scoped>
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}
h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
.muted { color: var(--color-text-muted); }

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
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

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
  width: min(480px, 90vw);
}
.modal h2 { font-size: 1.25rem; margin-bottom: 1.5rem; }

.field { margin-bottom: 1.25rem; }
label {
  display: block;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-bottom: 0.4rem;
}
.optional { opacity: 0.6; }
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

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.error-msg { color: #ef4444; font-size: 0.85rem; margin-top: 0.75rem; }

/* Search bar */
.search-bar {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}
.search-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  color: var(--color-text);
  font-size: 0.85rem;
}
.search-input:focus { outline: none; border-color: var(--color-primary); }
.filter-select {
  padding: 0.5rem 0.75rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  color: var(--color-text);
  font-size: 0.85rem;
  cursor: pointer;
}

/* Empty */
.empty {
  background: var(--color-surface);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius);
  padding: 3rem;
  text-align: center;
  color: var(--color-text-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}
.empty-icon { font-size: 2.5rem; }

.loading-msg { color: var(--color-text-muted); font-size: 0.9rem; }

/* Session grid */
.session-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.75rem;
}
</style>
