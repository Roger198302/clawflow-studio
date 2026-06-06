import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getHealth, getVersion, listRuntimes, getRuntimeHealth } from '@/api'
import type { RuntimeSpec, RuntimeHealth } from '@/types'

export interface GatewayStatus {
  healthy: boolean
  version: string
  protocolVersion: string
  runtimeMode: string
  runtimes: RuntimeSpec[]
  runtimeHealths: Record<string, RuntimeHealth>
}

export const useGatewayStore = defineStore('gateway', () => {
  const status = ref<GatewayStatus | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchStatus() {
    loading.value = true
    error.value = null
    try {
      const [health, version, runtimes] = await Promise.all([
        getHealth(),
        getVersion(),
        listRuntimes(),
      ])

      const healths = await Promise.allSettled(
        runtimes.map((r: RuntimeSpec) => getRuntimeHealth(r.id))
      )

      const runtimeHealths: Record<string, RuntimeHealth> = {}
      healths.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          runtimeHealths[runtimes[i].id] = result.value
        }
      })

      status.value = {
        healthy: health.status === 'ok',
        version: version.version,
        protocolVersion: version.protocolVersion,
        runtimeMode: version.runtimeMode,
        runtimes,
        runtimeHealths,
      }
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to connect to gateway'
      status.value = null
    } finally {
      loading.value = false
    }
  }

  return { status, loading, error, fetchStatus }
})
