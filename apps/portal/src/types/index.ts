// Re-export protocol types for portal use
export type {
  FlowSession,
  FlowNode,
  FlowSpec,
  SessionDetail,
  SessionTurn,
  SessionStep,
  SessionIntervention,
  RuntimeSpec,
  RuntimeHealth,
  RuntimeExecutionMode,
  FlowEstimate,
  RunReadinessReport,
  LinearExecutionPlan,
  FlowExecutionContractPreview,
  SessionStatus,
  SessionStepStatus,
  SessionInterventionKind,
  SessionInterventionStatus,
  NodeRole,
  NodeType,
  RuntimeType,
  RuntimeStatus,
} from '@clawflow/protocol'

// Portal-specific types
export interface PortalUser {
  id: string
  name: string
  email: string
  role: 'admin' | 'operator' | 'viewer'
  tenantId: string
}

export interface PortalTenant {
  id: string
  name: string
  plan: 'free' | 'pro' | 'enterprise'
}

export interface SessionListItem {
  id: string
  title: string
  status: string
  createdAt: string
  updatedAt: string
}
