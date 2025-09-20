/**
 * CemAI Agents - API Contract Types
 * TypeScript interfaces for backend integration requirements
 */

// ============================================================================
// Authentication & RBAC Types
// ============================================================================

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'operator' | 'manager' | 'engineer';
  permissions: string[];
  createdAt: Date;
  lastLogin?: Date;
}

export interface JWTPayload {
  sub: string; // user ID
  exp: number;
  role: string;
  permissions: string[];
  iat: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
}

export interface LogoutRequest {
  refreshToken: string;
}

export interface MeResponse {
  id: string;
  name: string;
  role: string;
  permissions: string[];
}

// ============================================================================
// Real-time Communication Types
// ============================================================================

export interface KPIData {
  id: string;
  name: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  status: 'normal' | 'warning' | 'critical' | 'offline';
  target: {
    min: number;
    max: number;
  };
  timestamp: string;
}

export interface ProcessAlert {
  system: string;
  status: 'stable' | 'warning' | 'critical';
  etaMin?: number;
  timestamp: string;
}

export interface AgentState {
  autonomy: 'on' | 'paused' | 'manual';
  reason?: string;
  pendingDecisionId?: string;
  timestamp: string;
}

export interface LogEntry {
  timestamp: string;
  agent: 'guardian' | 'optimizer' | 'master' | 'egress';
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  correlationId?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  timestamp: string;
}

export interface ChatToken {
  token: string;
  isComplete: boolean;
}

// ============================================================================
// System Configuration Types
// ============================================================================

export interface SystemConfig {
  apiBaseUrl: string;
  wsUrl?: string;
  sseUrl?: string;
  pollingIntervals: {
    kpisMs: number;
  };
  featureFlags: Record<string, boolean>;
}

export interface SystemPing {
  latency: number;
  timestamp: string;
}

export interface SystemVersion {
  version: string;
  build: string;
  commit: string;
  timestamp: string;
}

// ============================================================================
// Glass Cockpit Types
// ============================================================================

export interface RealtimeKPIs {
  [key: string]: KPIData;
}

export interface KPIHistoryRequest {
  from: string;
  to: string;
  ids?: string[];
  interval: '1m' | '5m' | '15m' | '1h';
}

export interface KPIHistoryResponse {
  [key: string]: {
    id: string;
    name: string;
    unit: string;
    data: Array<{
      timestamp: string;
      value: number;
    }>;
  };
}

export interface HealthPrediction {
  system: string;
  status: 'healthy' | 'warning' | 'critical';
  predictionMinutes?: number;
  confidence: number;
  recommendations: string[];
}

export interface HealthPredictionsRequest {
  systems: string[];
}

export interface HealthPredictionsResponse {
  [key: string]: HealthPrediction;
}

export interface MasterLogRequest {
  fromTs?: string;
  level?: 'debug' | 'info' | 'warn' | 'error';
  limit?: number;
}

export interface MasterLogResponse {
  logs: LogEntry[];
  total: number;
  hasMore: boolean;
}

// ============================================================================
// Co-Pilot Types
// ============================================================================

export interface AgentStateResponse {
  autonomy: 'on' | 'paused' | 'manual';
  reason?: string;
  pendingDecisionId?: string;
}

export interface PauseAutonomyRequest {
  reason: string;
}

export interface ResumeAutonomyRequest {
  // No additional fields needed
}

export interface ManualModeRequest {
  reason: string;
}

export interface Proposal {
  id: string;
  agent: 'guardian' | 'optimizer';
  title: string;
  description: string;
  adjustments: Record<string, number>;
  predictedImpact: Record<string, number>;
  confidence: number;
}

export interface DecisionSynthesis {
  summary: string;
  rationale: string;
  recommendedAdjustments: Record<string, number>;
}

export interface PendingDecision {
  id: string;
  guardian: Proposal;
  optimizer: Proposal;
  synthesis: DecisionSynthesis;
  createdAt: string;
}

export interface PendingDecisionsResponse {
  decisions: PendingDecision[];
}

export interface ApproveDecisionRequest {
  rationale?: string;
}

export interface RejectDecisionRequest {
  rationale: string;
}

export interface DecisionResponse {
  id: string;
  status: 'approved' | 'rejected';
  timestamp: string;
  userId: string;
  rationale?: string;
}

export interface DecisionDetailsResponse extends PendingDecision {
  predictedImpact?: Record<string, number>;
  actualImpact?: Record<string, number>;
  executionStatus?: 'pending' | 'executing' | 'completed' | 'failed';
  executionResults?: any[];
}

export interface DecisionHistoryRequest {
  from?: string;
  to?: string;
  status?: 'approved' | 'rejected' | 'pending';
  q?: string;
  page?: number;
  size?: number;
}

export interface DecisionHistoryResponse {
  items: DecisionDetailsResponse[];
  page: number;
  size: number;
  total: number;
}

// ============================================================================
// Oracle Types
// ============================================================================

export interface ChatMessage {
  sessionId: string;
  message: string;
  context?: any;
}

export interface ChatResponse {
  content: string;
  citations?: string[];
  actions?: string[];
  sessionId: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatSessionsResponse {
  sessions: ChatSession[];
}

export interface ChatMessagesRequest {
  after?: string;
}

export interface ChatMessagesResponse {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    citations?: string[];
    actions?: string[];
    timestamp: string;
  }>;
}

export interface ChatSuggestionsRequest {
  context: string;
}

export interface ChatSuggestionsResponse {
  suggestions: string[];
}

export interface SOPSearchRequest {
  q: string;
  limit?: number;
}

export interface SOP {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SOPSearchResponse {
  sops: SOP[];
  total: number;
}

export interface SOPDetailsResponse extends SOP {
  steps: Array<{
    step: number;
    title: string;
    description: string;
    warnings?: string[];
  }>;
  attachments: Array<{
    name: string;
    url: string;
    type: string;
  }>;
}

// ============================================================================
// Notifications & Audit Types
// ============================================================================

export interface NotificationsRequest {
  unreadOnly?: boolean;
  page?: number;
  size?: number;
}

export interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
}

export interface MarkNotificationReadRequest {
  // No additional fields needed
}

export interface AuditEvent {
  userId: string;
  action: string;
  resource: string;
  success: boolean;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface AuditEventsRequest {
  from?: string;
  to?: string;
  user?: string;
  action?: string;
  page?: number;
  size?: number;
}

export interface AuditEventsResponse {
  events: AuditEvent[];
  total: number;
}

// ============================================================================
// Common Types
// ============================================================================

export interface ErrorResponse {
  code: string;
  message: string;
  details?: any;
}

export interface PaginationParams {
  page?: number;
  size?: number;
  sort?: string;
  q?: string;
  from?: string;
  to?: string;
}

export interface ApiResponse<T> {
  data: T;
  timestamp: string;
  requestId: string;
}

export interface ApiError {
  error: ErrorResponse;
  timestamp: string;
  requestId: string;
}

// ============================================================================
// WebSocket/SSE Event Types
// ============================================================================

export interface WebSocketEvent {
  type: 'kpi_update' | 'process_alert' | 'agent_state' | 'log_entry' | 'notification' | 'chat_token';
  data: any;
  timestamp: string;
}

export interface SSEEvent {
  id: string;
  event: string;
  data: string;
  retry?: number;
}

// ============================================================================
// Request/Response Headers
// ============================================================================

export interface RequestHeaders {
  'Authorization'?: string;
  'Content-Type'?: string;
  'X-Request-Id'?: string;
  'X-API-Version'?: string;
  'X-Idempotency-Key'?: string;
}

export interface ResponseHeaders {
  'X-Request-Id': string;
  'X-API-Version': string;
  'X-Content-Type-Options': string;
  'X-Frame-Options': string;
  'X-XSS-Protection': string;
  'Strict-Transport-Security': string;
  'Content-Security-Policy': string;
}

// ============================================================================
// Example Payloads (as requested)
// ============================================================================

export const ExamplePayloads = {
  decisionPending: {
    id: "dec_123",
    guardian: {
      id: "prop_guardian_123",
      agent: "guardian" as const,
      title: "LSF Stability Correction",
      description: "Adjust kiln speed to maintain LSF within quality band",
      adjustments: { kiln_speed: 0.1 },
      predictedImpact: { lsf_deviation: -0.5 },
      confidence: 0.95
    },
    optimizer: {
      id: "prop_optimizer_123",
      agent: "optimizer" as const,
      title: "Fuel Mix Optimization",
      description: "Increase alternative fuel ratio for cost savings",
      adjustments: { alternative_fuel_ratio: 0.05 },
      predictedImpact: { cost_savings: 2.5 },
      confidence: 0.88
    },
    synthesis: {
      summary: "Combined stability and optimization approach",
      rationale: "Guardian proposal takes priority for safety, optimizer adjustments applied within safety bounds",
      recommendedAdjustments: { kiln_speed: 0.1, alternative_fuel_ratio: 0.02 }
    }
  } as PendingDecision,

  kpiRealtime: {
    specificPower: {
      id: "specific_power",
      name: "Specific Power Consumption",
      value: 45.2,
      unit: "kWh/t",
      trend: "down" as const,
      status: "normal" as const,
      target: { min: 40, max: 50 },
      timestamp: "2024-01-15T10:30:00Z"
    },
    heatRate: {
      id: "heat_rate",
      name: "Heat Rate",
      value: 3.2,
      unit: "MJ/kg",
      trend: "stable" as const,
      status: "normal" as const,
      target: { min: 3.0, max: 3.5 },
      timestamp: "2024-01-15T10:30:00Z"
    }
  } as RealtimeKPIs,

  agentState: {
    autonomy: "paused" as const,
    reason: "decision_required",
    pendingDecisionId: "dec_123"
  } as AgentStateResponse
};
