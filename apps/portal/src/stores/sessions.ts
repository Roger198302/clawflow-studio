import { defineStore } from 'pinia'
import { ref } from 'vue'
import { listSessions, getSession, createSession as apiCreateSession } from '@/api'
import type { FlowSession, SessionDetail } from '@/types'

export const useSessionsStore = defineStore('sessions', () => {
  const sessions = ref<FlowSession[]>([])
  const currentSession = ref<SessionDetail | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchSessions() {
    loading.value = true
    error.value = null
    try {
      sessions.value = await listSessions()
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load sessions'
    } finally {
      loading.value = false
    }
  }

  async function fetchSession(sessionId: string) {
    loading.value = true
    error.value = null
    try {
      currentSession.value = await getSession(sessionId)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load session'
    } finally {
      loading.value = false
    }
  }

  async function createSession(title?: string) {
    loading.value = true
    error.value = null
    try {
      const session = await apiCreateSession(title)
      sessions.value.unshift(session)
      return session
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to create session'
      throw e
    } finally {
      loading.value = false
    }
  }

  return { sessions, currentSession, loading, error, fetchSessions, fetchSession, createSession }
})
