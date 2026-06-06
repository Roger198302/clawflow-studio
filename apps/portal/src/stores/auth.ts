import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { PortalUser, PortalTenant } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<PortalUser | null>(null)
  const tenant = ref<PortalTenant | null>(null)
  const token = ref<string | null>(null)

  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  function login(newToken: string, newUser: PortalUser, newTenant: PortalTenant) {
    token.value = newToken
    user.value = newUser
    tenant.value = newTenant
    localStorage.setItem('portal_token', newToken)
  }

  function logout() {
    token.value = null
    user.value = null
    tenant.value = null
    localStorage.removeItem('portal_token')
  }

  function restoreSession() {
    const saved = localStorage.getItem('portal_token')
    if (saved) token.value = saved
    // TODO: validate token with backend
  }

  return { user, tenant, token, isAuthenticated, isAdmin, login, logout, restoreSession }
})
