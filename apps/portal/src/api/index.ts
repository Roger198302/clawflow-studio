import axios from 'axios'
import type {
  FlowSession,
  SessionDetail,
  RuntimeSpec,
  RuntimeHealth,
  FlowEstimate,
  RunReadinessReport,
  LinearExecutionPlan,
  FlowExecutionContractPreview,
} from '@/types'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

// ─── Health & Version ────────────────────────────────────────────────────────

export async function getHealth() {
  const { data } = await api.get('/health')
  return data
}

export async function getVersion() {
  const { data } = await api.get('/version')
  return data
}

// ─── Runtimes ─────────────────────────────────────────────────────────────────

export async function listRuntimes(): Promise<RuntimeSpec[]> {
  const { data } = await api.get('/runtimes')
  return data
}

export async function getRuntime(id: string): Promise<RuntimeSpec> {
  const { data } = await api.get(`/runtimes/${id}`)
  return data
}

export async function getRuntimeHealth(id: string): Promise<RuntimeHealth> {
  const { data } = await api.get(`/runtimes/${id}/health`)
  return data
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function listSessions(): Promise<FlowSession[]> {
  const { data } = await api.get('/sessions')
  return data
}

export async function getSession(sessionId: string): Promise<SessionDetail> {
  const { data } = await api.get(`/sessions/${sessionId}`)
  return data
}

export async function createSession(title?: string): Promise<FlowSession> {
  const { data } = await api.post('/runs', { title })
  return data
}

// ─── Flows ────────────────────────────────────────────────────────────────────

export async function previewFlow(flowSpec: unknown): Promise<FlowExecutionContractPreview> {
  const { data } = await api.post('/flows/preview', flowSpec)
  return data
}

export async function planFlow(flowSpec: unknown): Promise<LinearExecutionPlan> {
  const { data } = await api.post('/flows/plan', flowSpec)
  return data
}

export async function estimateFlow(flowSpec: unknown): Promise<FlowEstimate> {
  const { data } = await api.post('/flows/estimate', flowSpec)
  return data
}

export async function checkReadiness(flowSpec: unknown): Promise<RunReadinessReport> {
  const { data } = await api.post('/flows/readiness', flowSpec)
  return data
}

export default api
