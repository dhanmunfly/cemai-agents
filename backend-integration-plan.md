# CemAI Agents - Backend Integration Plan

## Overview

This document outlines the comprehensive plan to integrate the required backend API endpoints and real-time capabilities with the existing CemAI Agents system. The integration will extend the current agent architecture to support human-in-the-loop operations, real-time monitoring, and comprehensive user management.

## Current System Analysis

### Existing Architecture Strengths
- ✅ **Agent-to-Agent Communication**: Robust A2A protocol with authentication
- ✅ **Security Framework**: Zero-trust architecture with IAM service accounts
- ✅ **State Management**: AlloyDB integration for persistent workflows
- ✅ **Monitoring**: Comprehensive metrics and tracing
- ✅ **Pub/Sub Integration**: Event-driven communication between agents

### Integration Points
- **Master Control Agent**: Extend with human-in-the-loop decision endpoints
- **Guardian Agent**: Add KPI monitoring and health prediction endpoints
- **Optimizer Agent**: Expose optimization status and market data endpoints
- **Egress Agent**: Add command execution status and audit endpoints

## Integration Architecture

### 1. API Gateway Layer
```
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │   Auth      │ │   Rate      │ │   CORS      │          │
│  │   Service   │ │   Limiting  │ │   Handler   │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                Backend Services Layer                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │   User      │ │   Real-time │ │   Decision  │          │
│  │   Service   │ │   Service   │ │   Service   │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                Agent Services Layer                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │   Master    │ │   Guardian  │ │   Optimizer │          │
│  │   Control   │ │   Agent     │ │   Agent     │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Authentication & RBAC System (Week 1-2)

#### 1.1 User Management Service
**Location**: `services/user-service/`

```typescript
// services/user-service/src/types/auth.ts
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
```

#### 1.2 Authentication Service Implementation
```typescript
// services/user-service/src/services/auth-service.ts
export class AuthService {
  private jwtSecret: string;
  private refreshTokenSecret: string;
  private userRepository: UserRepository;

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    // Validate credentials
    const user = await this.validateCredentials(credentials);
    
    // Generate JWT tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);
    
    // Update last login
    await this.updateLastLogin(user.id);
    
    return {
      accessToken,
      refreshToken,
      user: this.sanitizeUser(user)
    };
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    // Validate refresh token and generate new access token
  }

  async logout(userId: string): Promise<void> {
    // Invalidate refresh token
  }

  async getCurrentUser(userId: string): Promise<User> {
    // Return current user with permissions
  }
}
```

#### 1.3 RBAC Middleware
```typescript
// shared/middleware/rbac-middleware.ts
export class RBACMiddleware {
  static requireRole(roles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = req.user;
      if (!user || !roles.includes(user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      next();
    };
  }

  static requirePermission(permission: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = req.user;
      if (!user || !user.permissions.includes(permission)) {
        return res.status(403).json({ error: 'Permission denied' });
      }
      next();
    };
  }
}
```

### Phase 2: Real-time Communication Layer (Week 2-3)

#### 2.1 WebSocket/SSE Service
**Location**: `services/realtime-service/`

```typescript
// services/realtime-service/src/services/websocket-service.ts
export class WebSocketService {
  private wss: WebSocketServer;
  private connections: Map<string, WebSocket> = new Map();
  private pubsub: PubSub;

  constructor() {
    this.wss = new WebSocketServer({ port: 8080 });
    this.pubsub = new PubSub();
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.wss.on('connection', (ws, req) => {
      // Authenticate WebSocket connection
      const token = this.extractToken(req);
      const user = this.authenticateToken(token);
      
      if (!user) {
        ws.close(1008, 'Authentication failed');
        return;
      }

      const connectionId = this.generateConnectionId();
      this.connections.set(connectionId, ws);
      
      // Subscribe to user-specific channels
      this.subscribeToChannels(connectionId, user);
      
      ws.on('close', () => {
        this.connections.delete(connectionId);
        this.unsubscribeFromChannels(connectionId);
      });
    });
  }

  private subscribeToChannels(connectionId: string, user: User) {
    // Subscribe to KPI updates
    this.pubsub.subscribe('kpi_update', (data) => {
      this.sendToConnection(connectionId, 'kpi_update', data);
    });

    // Subscribe to process alerts
    this.pubsub.subscribe('process_alert', (data) => {
      this.sendToConnection(connectionId, 'process_alert', data);
    });

    // Subscribe to agent state changes
    this.pubsub.subscribe('agent_state', (data) => {
      this.sendToConnection(connectionId, 'agent_state', data);
    });

    // Subscribe to log entries
    this.pubsub.subscribe('log_entry', (data) => {
      this.sendToConnection(connectionId, 'log_entry', data);
    });
  }
}
```

#### 2.2 Event Broadcasting Service
```typescript
// services/realtime-service/src/services/event-broadcaster.ts
export class EventBroadcaster {
  private pubsub: PubSub;

  async broadcastKPIUpdate(kpiData: KPIData): Promise<void> {
    await this.pubsub.publish('kpi_update', {
      id: kpiData.id,
      name: kpiData.name,
      value: kpiData.value,
      unit: kpiData.unit,
      trend: kpiData.trend,
      status: kpiData.status,
      target: kpiData.target,
      timestamp: new Date().toISOString()
    });
  }

  async broadcastProcessAlert(alert: ProcessAlert): Promise<void> {
    await this.pubsub.publish('process_alert', {
      system: alert.system,
      status: alert.status,
      etaMin: alert.etaMin,
      timestamp: new Date().toISOString()
    });
  }

  async broadcastAgentState(state: AgentState): Promise<void> {
    await this.pubsub.publish('agent_state', {
      autonomy: state.autonomy,
      reason: state.reason,
      pendingDecisionId: state.pendingDecisionId,
      timestamp: new Date().toISOString()
    });
  }
}
```

### Phase 3: Glass Cockpit Integration (Week 3-4)

#### 3.1 KPI Service Extension
**Extend Guardian Agent** with KPI endpoints:

```typescript
// agents/guardian/src/routes/kpi-routes.ts
export class KPIRoutes {
  private guardianService: GuardianService;
  private eventBroadcaster: EventBroadcaster;

  constructor() {
    this.guardianService = new GuardianService();
    this.eventBroadcaster = new EventBroadcaster();
  }

  // GET /kpis/realtime
  async getRealtimeKPIs(req: Request, res: Response): Promise<void> {
    try {
      const kpis = await this.guardianService.getCurrentKPIs();
      
      // Broadcast KPI updates for real-time clients
      for (const kpi of kpis) {
        await this.eventBroadcaster.broadcastKPIUpdate(kpi);
      }
      
      res.json(kpis);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch KPIs' });
    }
  }

  // GET /kpis/history
  async getKPIHistory(req: Request, res: Response): Promise<void> {
    try {
      const { from, to, ids, interval } = req.query;
      const history = await this.guardianService.getKPIHistory({
        from: new Date(from as string),
        to: new Date(to as string),
        ids: ids as string[],
        interval: interval as string
      });
      
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch KPI history' });
    }
  }
}
```

#### 3.2 Health Prediction Service
```typescript
// agents/guardian/src/services/health-prediction-service.ts
export class HealthPredictionService {
  private vertexAI: VertexAIService;

  async getPredictions(systems: string[]): Promise<HealthPredictions> {
    const predictions: HealthPredictions = {};
    
    for (const system of systems) {
      const prediction = await this.vertexAI.predictSystemHealth(system);
      predictions[system] = {
        system,
        status: prediction.status,
        predictionMinutes: prediction.predictionMinutes,
        confidence: prediction.confidence,
        recommendations: prediction.recommendations
      };
    }
    
    return predictions;
  }
}
```

### Phase 4: Co-Pilot Integration (Week 4-5)

#### 4.1 Decision Management Service
**Extend Master Control Agent** with HITL endpoints:

```typescript
// agents/master_control/src/routes/decision-routes.ts
export class DecisionRoutes {
  private masterControlService: MasterControlService;
  private eventBroadcaster: EventBroadcaster;

  // GET /decisions/pending
  async getPendingDecisions(req: Request, res: Response): Promise<void> {
    try {
      const decisions = await this.masterControlService.getPendingDecisions();
      res.json(decisions);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch pending decisions' });
    }
  }

  // POST /decisions/{id}/approve
  async approveDecision(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { rationale } = req.body;
      const user = req.user;

      const result = await this.masterControlService.approveDecision(id, {
        userId: user.id,
        rationale,
        timestamp: new Date()
      });

      // Broadcast decision approval
      await this.eventBroadcaster.broadcastAgentState({
        autonomy: 'on',
        reason: null,
        pendingDecisionId: null
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to approve decision' });
    }
  }

  // POST /decisions/{id}/reject
  async rejectDecision(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { rationale } = req.body;
      const user = req.user;

      const result = await this.masterControlService.rejectDecision(id, {
        userId: user.id,
        rationale,
        timestamp: new Date()
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to reject decision' });
    }
  }
}
```

#### 4.2 Autonomy Control Service
```typescript
// agents/master_control/src/services/autonomy-service.ts
export class AutonomyService {
  private currentState: AgentState = {
    autonomy: 'on',
    reason: null,
    pendingDecisionId: null
  };

  async pauseAutonomy(reason: string, userId: string): Promise<void> {
    this.currentState = {
      autonomy: 'paused',
      reason,
      pendingDecisionId: null
    };

    // Notify all agents to pause operations
    await this.notifyAgents('pause', { reason, userId });
    
    // Broadcast state change
    await this.eventBroadcaster.broadcastAgentState(this.currentState);
  }

  async resumeAutonomy(userId: string): Promise<void> {
    this.currentState = {
      autonomy: 'on',
      reason: null,
      pendingDecisionId: null
    };

    // Notify all agents to resume operations
    await this.notifyAgents('resume', { userId });
    
    // Broadcast state change
    await this.eventBroadcaster.broadcastAgentState(this.currentState);
  }

  async setManualMode(reason: string, userId: string): Promise<void> {
    this.currentState = {
      autonomy: 'manual',
      reason,
      pendingDecisionId: null
    };

    // Notify all agents to enter manual mode
    await this.notifyAgents('manual', { reason, userId });
    
    // Broadcast state change
    await this.eventBroadcaster.broadcastAgentState(this.currentState);
  }
}
```

### Phase 5: Oracle Integration (Week 5-6)

#### 5.1 Chat Service
```typescript
// services/oracle-service/src/services/chat-service.ts
export class ChatService {
  private geminiService: GeminiService;
  private sessionRepository: SessionRepository;

  async sendMessage(sessionId: string, message: string, context?: any): Promise<ChatResponse> {
    const session = await this.sessionRepository.getSession(sessionId);
    
    // Get relevant context from agents
    const agentContext = await this.getAgentContext(context);
    
    // Generate response using Gemini
    const response = await this.geminiService.generateResponse({
      message,
      context: agentContext,
      sessionHistory: session.messages
    });

    // Save message to session
    await this.sessionRepository.addMessage(sessionId, {
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    await this.sessionRepository.addMessage(sessionId, {
      role: 'assistant',
      content: response.content,
      citations: response.citations,
      actions: response.actions,
      timestamp: new Date()
    });

    return response;
  }

  private async getAgentContext(context: any): Promise<any> {
    // Gather relevant context from all agents
    const guardianContext = await this.getGuardianContext();
    const optimizerContext = await this.getOptimizerContext();
    const masterControlContext = await this.getMasterControlContext();
    
    return {
      guardian: guardianContext,
      optimizer: optimizerContext,
      masterControl: masterControlContext,
      ...context
    };
  }
}
```

#### 5.2 SOP Service
```typescript
// services/oracle-service/src/services/sop-service.ts
export class SOPService {
  private sopRepository: SOPRepository;
  private searchService: SearchService;

  async searchSOPs(query: string, limit: number = 10): Promise<SOP[]> {
    return await this.searchService.search(query, {
      index: 'sops',
      limit,
      fields: ['title', 'content', 'tags']
    });
  }

  async getSOP(id: string): Promise<SOP> {
    return await this.sopRepository.getSOP(id);
  }
}
```

### Phase 6: Notifications & Audit (Week 6-7)

#### 6.1 Notification Service
```typescript
// services/notification-service/src/services/notification-service.ts
export class NotificationService {
  private notificationRepository: NotificationRepository;
  private eventBroadcaster: EventBroadcaster;

  async createNotification(notification: Notification): Promise<void> {
    await this.notificationRepository.create(notification);
    
    // Broadcast to real-time clients
    await this.eventBroadcaster.broadcastNotification(notification);
  }

  async getNotifications(userId: string, options: NotificationOptions): Promise<Notification[]> {
    return await this.notificationRepository.getForUser(userId, options);
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.notificationRepository.markAsRead(notificationId, userId);
  }
}
```

#### 6.2 Audit Service
```typescript
// services/audit-service/src/services/audit-service.ts
export class AuditService {
  private auditRepository: AuditRepository;

  async logEvent(event: AuditEvent): Promise<void> {
    await this.auditRepository.create({
      ...event,
      timestamp: new Date(),
      id: this.generateEventId()
    });
  }

  async getAuditEvents(filters: AuditFilters): Promise<AuditEvent[]> {
    return await this.auditRepository.query(filters);
  }
}
```

## Database Schema Extensions

### User Management Tables
```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('operator', 'manager', 'engineer')),
  permissions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- Refresh tokens table
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User sessions table
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Decision Management Tables
```sql
-- Pending decisions table
CREATE TABLE pending_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_proposal JSONB NOT NULL,
  optimizer_proposal JSONB NOT NULL,
  synthesis JSONB NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Decision approvals table
CREATE TABLE decision_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES pending_decisions(id),
  user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(50) NOT NULL CHECK (action IN ('approve', 'reject')),
  rationale TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Notification & Audit Tables
```sql
-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit events table
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  success BOOLEAN NOT NULL,
  metadata JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## API Gateway Configuration

### Express.js API Gateway
```typescript
// api-gateway/src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from './middleware/auth';
import { rbacMiddleware } from './middleware/rbac';
import { correlationMiddleware } from './middleware/correlation';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.UI_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Correlation ID middleware
app.use(correlationMiddleware);

// Authentication middleware
app.use('/api/v1', authMiddleware);

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/kpis', kpiRoutes);
app.use('/api/v1/decisions', rbacMiddleware.requireRole(['operator', 'manager']), decisionRoutes);
app.use('/api/v1/agent', rbacMiddleware.requireRole(['operator']), agentRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/sop', sopRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/audit', rbacMiddleware.requireRole(['manager']), auditRoutes);

// Health checks
app.get('/health', (req, res) => res.json({ status: 'healthy' }));
app.get('/ready', (req, res) => res.json({ status: 'ready' }));

export default app;
```

## Deployment Configuration

### Docker Compose for Local Development
```yaml
# docker-compose.yml
version: '3.8'
services:
  api-gateway:
    build: ./api-gateway
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - JWT_SECRET=your-jwt-secret
      - REFRESH_TOKEN_SECRET=your-refresh-secret
    depends_on:
      - postgres
      - redis

  user-service:
    build: ./services/user-service
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/cemai_users
    depends_on:
      - postgres

  realtime-service:
    build: ./services/realtime-service
    ports:
      - "8080:8080"
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  oracle-service:
    build: ./services/oracle-service
    environment:
      - GEMINI_API_KEY=your-gemini-key
    depends_on:
      - postgres

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=cemai_users
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Cloud Run Deployment
```yaml
# cloud-run/api-gateway.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: cemai-api-gateway
  annotations:
    run.googleapis.com/vpc-access-connector: "cemai-agents-connector"
    run.googleapis.com/vpc-access-egress: "private-ranges-only"
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "2"
        autoscaling.knative.dev/maxScale: "10"
        run.googleapis.com/memory: "2Gi"
        run.googleapis.com/cpu: "2"
    spec:
      serviceAccountName: api-gateway@${PROJECT_ID}.iam.gserviceaccount.com
      containers:
      - image: gcr.io/${PROJECT_ID}/cemai-api-gateway:${VERSION}
        env:
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: jwt-secrets
              key: jwt-secret
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-connection
              key: connection-string
```

## Testing Strategy

### Unit Tests
```typescript
// tests/unit/auth-service.test.ts
describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockUserRepository = createMockUserRepository();
    authService = new AuthService(mockUserRepository);
  });

  describe('login', () => {
    it('should return tokens for valid credentials', async () => {
      const credentials = { email: 'test@example.com', password: 'password' };
      const mockUser = createMockUser();
      
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockUserRepository.validatePassword.mockResolvedValue(true);

      const result = await authService.login(credentials);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe(credentials.email);
    });

    it('should throw error for invalid credentials', async () => {
      const credentials = { email: 'test@example.com', password: 'wrong' };
      
      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(authService.login(credentials)).rejects.toThrow('Invalid credentials');
    });
  });
});
```

### Integration Tests
```typescript
// tests/integration/api-gateway.test.ts
describe('API Gateway Integration', () => {
  let app: Express;
  let authToken: string;

  beforeAll(async () => {
    app = createTestApp();
    authToken = await getTestAuthToken();
  });

  describe('Authentication Flow', () => {
    it('should authenticate user and return tokens', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'password' })
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
    });

    it('should protect authenticated routes', async () => {
      await request(app)
        .get('/api/v1/kpis/realtime')
        .expect(401);
    });
  });

  describe('Real-time Communication', () => {
    it('should establish WebSocket connection with valid token', (done) => {
      const ws = new WebSocket(`ws://localhost:8080?token=${authToken}`);
      
      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });
    });
  });
});
```

## Performance & Security Considerations

### Performance Targets
- **API Response Time**: p95 < 300ms for GET endpoints
- **Authentication**: < 500ms for login/refresh
- **Real-time Latency**: < 2s end-to-end
- **Dashboard Load**: < 3s with config bootstrap

### Security Measures
- **HTTPS Only**: All communications encrypted
- **Rate Limiting**: Per IP and per user limits
- **Input Validation**: Comprehensive validation for all inputs
- **CORS**: Restricted to UI origins only
- **HSTS**: Strict transport security headers
- **Content Security Policy**: Prevent XSS attacks

### Monitoring & Observability
- **Correlation IDs**: Track requests across services
- **Structured Logging**: JSON logs with user/role context
- **Metrics**: Custom metrics for business KPIs
- **Health Checks**: Liveness and readiness probes
- **Distributed Tracing**: End-to-end request tracing

## Migration Strategy

### Phase 1: Parallel Deployment
1. Deploy new services alongside existing agents
2. Implement API gateway with routing to both old and new endpoints
3. Gradually migrate frontend to use new APIs

### Phase 2: Agent Integration
1. Extend existing agents with new endpoints
2. Implement real-time event broadcasting
3. Add human-in-the-loop decision support

### Phase 3: Full Integration
1. Complete migration of all frontend components
2. Deprecate old endpoints
3. Optimize performance and monitoring

## Conclusion

This integration plan provides a comprehensive approach to extending the CemAI Agents system with the required backend capabilities. The phased approach ensures minimal disruption to existing operations while gradually introducing new features. The architecture maintains the existing security and performance standards while adding the necessary human-in-the-loop capabilities and real-time monitoring features.

The implementation will result in a fully integrated system that supports:
- ✅ Secure user authentication and role-based access control
- ✅ Real-time communication via WebSocket/SSE
- ✅ Comprehensive KPI monitoring and health predictions
- ✅ Human-in-the-loop decision management
- ✅ AI-powered chat and SOP assistance
- ✅ Complete audit trails and notifications
- ✅ Enterprise-grade security and performance
