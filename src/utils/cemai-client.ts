/**
 * CemAI Agents - Axios Client with Interceptors
 * HTTP client with authentication, retry, and correlation ID support
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { 
  LoginRequest, 
  LoginResponse, 
  RefreshTokenRequest, 
  RefreshTokenResponse,
  LogoutRequest,
  MeResponse,
  RealtimeKPIs,
  KPIHistoryRequest,
  KPIHistoryResponse,
  HealthPredictionsRequest,
  HealthPredictionsResponse,
  MasterLogRequest,
  MasterLogResponse,
  AgentStateResponse,
  PauseAutonomyRequest,
  ResumeAutonomyRequest,
  ManualModeRequest,
  PendingDecisionsResponse,
  ApproveDecisionRequest,
  RejectDecisionRequest,
  DecisionResponse,
  DecisionDetailsResponse,
  DecisionHistoryRequest,
  DecisionHistoryResponse,
  ChatMessage,
  ChatResponse,
  ChatSessionsResponse,
  ChatMessagesRequest,
  ChatMessagesResponse,
  ChatSuggestionsRequest,
  ChatSuggestionsResponse,
  SOPSearchRequest,
  SOPSearchResponse,
  SOPDetailsResponse,
  NotificationsRequest,
  NotificationsResponse,
  MarkNotificationReadRequest,
  AuditEvent,
  AuditEventsRequest,
  AuditEventsResponse,
  SystemConfig,
  SystemPing,
  SystemVersion,
  ErrorResponse,
  RequestHeaders
} from './api-contracts';

export interface CemAIClientConfig {
  baseURL: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  enableRetry?: boolean;
  enableCorrelationId?: boolean;
}

export class CemAIClient {
  private client: AxiosInstance;
  private config: CemAIClientConfig;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private isRefreshing = false;
  private refreshPromise: Promise<string> | null = null;

  constructor(config: CemAIClientConfig) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      enableRetry: true,
      enableCorrelationId: true,
      ...config
    };

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Version': 'v1'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add correlation ID
        if (this.config.enableCorrelationId) {
          config.headers['X-Request-Id'] = this.generateCorrelationId();
        }

        // Add authorization header
        if (this.accessToken) {
          config.headers['Authorization'] = `Bearer ${this.accessToken}`;
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        // Handle 401 errors (token expired)
        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            // Wait for ongoing refresh
            try {
              const newToken = await this.refreshPromise;
              originalRequest.headers!['Authorization'] = `Bearer ${newToken}`;
              return this.client(originalRequest);
            } catch (refreshError) {
              this.handleAuthError();
              return Promise.reject(refreshError);
            }
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            this.refreshPromise = this.refreshAccessToken();
            const newToken = await this.refreshPromise;
            
            originalRequest.headers!['Authorization'] = `Bearer ${newToken}`;
            this.isRefreshing = false;
            this.refreshPromise = null;
            
            return this.client(originalRequest);
          } catch (refreshError) {
            this.isRefreshing = false;
            this.refreshPromise = null;
            this.handleAuthError();
            return Promise.reject(refreshError);
          }
        }

        // Handle retry logic
        if (this.config.enableRetry && this.shouldRetry(error)) {
          return this.retryRequest(originalRequest);
        }

        return Promise.reject(this.transformError(error));
      }
    );
  }

  private generateCorrelationId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private shouldRetry(error: AxiosError): boolean {
    if (!error.config) return false;
    
    const retryCount = (error.config as any)._retryCount || 0;
    if (retryCount >= this.config.retryAttempts!) return false;

    // Retry on network errors or 5xx status codes
    return !error.response || (error.response.status >= 500 && error.response.status < 600);
  }

  private async retryRequest(config: AxiosRequestConfig): Promise<AxiosResponse> {
    const retryCount = (config as any)._retryCount || 0;
    (config as any)._retryCount = retryCount + 1;

    // Exponential backoff
    const delay = this.config.retryDelay! * Math.pow(2, retryCount);
    await new Promise(resolve => setTimeout(resolve, delay));

    return this.client(config);
  }

  private async refreshAccessToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await axios.post<RefreshTokenResponse>(
        `${this.config.baseURL}/api/v1/auth/refresh`,
        { refreshToken: this.refreshToken }
      );

      this.accessToken = response.data.accessToken;
      return this.accessToken;
    } catch (error) {
      this.handleAuthError();
      throw error;
    }
  }

  private handleAuthError(): void {
    this.accessToken = null;
    this.refreshToken = null;
    
    // Emit auth error event for UI to handle
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:error'));
    }
  }

  private transformError(error: AxiosError): ErrorResponse {
    if (error.response?.data) {
      return error.response.data as ErrorResponse;
    }

    return {
      code: 'NETWORK_ERROR',
      message: error.message || 'Network error occurred',
      details: {
        status: error.response?.status,
        statusText: error.response?.statusText
      }
    };
  }

  // ============================================================================
  // Authentication Methods
  // ============================================================================

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>('/api/v1/auth/login', credentials);
    
    this.accessToken = response.data.accessToken;
    this.refreshToken = response.data.refreshToken;
    
    return response.data;
  }

  async logout(): Promise<void> {
    if (this.refreshToken) {
      try {
        await this.client.post('/api/v1/auth/logout', { refreshToken: this.refreshToken });
      } catch (error) {
        // Log error but don't throw - logout should always succeed
        console.warn('Logout request failed:', error);
      }
    }

    this.accessToken = null;
    this.refreshToken = null;
  }

  async getCurrentUser(): Promise<MeResponse> {
    const response = await this.client.get<MeResponse>('/api/v1/auth/me');
    return response.data;
  }

  // ============================================================================
  // System Configuration Methods
  // ============================================================================

  async getSystemConfig(): Promise<SystemConfig> {
    const response = await this.client.get<SystemConfig>('/api/v1/system/config');
    return response.data;
  }

  async ping(): Promise<SystemPing> {
    const response = await this.client.get<SystemPing>('/api/v1/system/ping');
    return response.data;
  }

  async getSystemVersion(): Promise<SystemVersion> {
    const response = await this.client.get<SystemVersion>('/api/v1/system/version');
    return response.data;
  }

  // ============================================================================
  // Glass Cockpit Methods
  // ============================================================================

  async getRealtimeKPIs(): Promise<RealtimeKPIs> {
    const response = await this.client.get<RealtimeKPIs>('/api/v1/kpis/realtime');
    return response.data;
  }

  async getKPIHistory(params: KPIHistoryRequest): Promise<KPIHistoryResponse> {
    const response = await this.client.get<KPIHistoryResponse>('/api/v1/kpis/history', { params });
    return response.data;
  }

  async getHealthPredictions(params: HealthPredictionsRequest): Promise<HealthPredictionsResponse> {
    const response = await this.client.get<HealthPredictionsResponse>('/api/v1/process/health/predictions', { params });
    return response.data;
  }

  async getMasterLog(params: MasterLogRequest): Promise<MasterLogResponse> {
    const response = await this.client.get<MasterLogResponse>('/api/v1/logs/master', { params });
    return response.data;
  }

  // ============================================================================
  // Co-Pilot Methods
  // ============================================================================

  async getAgentState(): Promise<AgentStateResponse> {
    const response = await this.client.get<AgentStateResponse>('/api/v1/agent/state');
    return response.data;
  }

  async pauseAutonomy(data: PauseAutonomyRequest): Promise<void> {
    await this.client.post('/api/v1/agent/pause', data);
  }

  async resumeAutonomy(): Promise<void> {
    await this.client.post('/api/v1/agent/resume');
  }

  async setManualMode(data: ManualModeRequest): Promise<void> {
    await this.client.post('/api/v1/agent/manual', data);
  }

  async getPendingDecisions(): Promise<PendingDecisionsResponse> {
    const response = await this.client.get<PendingDecisionsResponse>('/api/v1/decisions/pending');
    return response.data;
  }

  async approveDecision(decisionId: string, data: ApproveDecisionRequest): Promise<DecisionResponse> {
    const response = await this.client.post<DecisionResponse>(`/api/v1/decisions/${decisionId}/approve`, data);
    return response.data;
  }

  async rejectDecision(decisionId: string, data: RejectDecisionRequest): Promise<DecisionResponse> {
    const response = await this.client.post<DecisionResponse>(`/api/v1/decisions/${decisionId}/reject`, data);
    return response.data;
  }

  async getDecisionDetails(decisionId: string): Promise<DecisionDetailsResponse> {
    const response = await this.client.get<DecisionDetailsResponse>(`/api/v1/decisions/${decisionId}`);
    return response.data;
  }

  async getDecisionHistory(params: DecisionHistoryRequest): Promise<DecisionHistoryResponse> {
    const response = await this.client.get<DecisionHistoryResponse>('/api/v1/decisions/history', { params });
    return response.data;
  }

  // ============================================================================
  // Oracle Methods
  // ============================================================================

  async sendChatMessage(data: ChatMessage): Promise<ChatResponse> {
    const response = await this.client.post<ChatResponse>('/api/v1/chat/message', data);
    return response.data;
  }

  async getChatSessions(): Promise<ChatSessionsResponse> {
    const response = await this.client.get<ChatSessionsResponse>('/api/v1/chat/sessions');
    return response.data;
  }

  async getChatMessages(sessionId: string, params: ChatMessagesRequest): Promise<ChatMessagesResponse> {
    const response = await this.client.get<ChatMessagesResponse>(`/api/v1/chat/sessions/${sessionId}/messages`, { params });
    return response.data;
  }

  async getChatSuggestions(params: ChatSuggestionsRequest): Promise<ChatSuggestionsResponse> {
    const response = await this.client.get<ChatSuggestionsResponse>('/api/v1/chat/suggestions', { params });
    return response.data;
  }

  async searchSOPs(params: SOPSearchRequest): Promise<SOPSearchResponse> {
    const response = await this.client.get<SOPSearchResponse>('/api/v1/sop/search', { params });
    return response.data;
  }

  async getSOPDetails(sopId: string): Promise<SOPDetailsResponse> {
    const response = await this.client.get<SOPDetailsResponse>(`/api/v1/sop/${sopId}`);
    return response.data;
  }

  // ============================================================================
  // Notifications & Audit Methods
  // ============================================================================

  async getNotifications(params: NotificationsRequest): Promise<NotificationsResponse> {
    const response = await this.client.get<NotificationsResponse>('/api/v1/notifications', { params });
    return response.data;
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    await this.client.post(`/api/v1/notifications/${notificationId}/read`);
  }

  async logAuditEvent(event: AuditEvent): Promise<void> {
    await this.client.post('/api/v1/audit/events', event);
  }

  async getAuditEvents(params: AuditEventsRequest): Promise<AuditEventsResponse> {
    const response = await this.client.get<AuditEventsResponse>('/api/v1/audit/events', { params });
    return response.data;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  setRefreshToken(token: string): void {
    this.refreshToken = token;
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  static create(config: CemAIClientConfig): CemAIClient {
    return new CemAIClient(config);
  }

  static createFromConfig(): CemAIClient {
    const baseURL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';
    
    return new CemAIClient({
      baseURL,
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      enableRetry: true,
      enableCorrelationId: true
    });
  }
}

// ============================================================================
// Default Export
// ============================================================================

export default CemAIClient;
