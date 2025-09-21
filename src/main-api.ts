import express from 'express';
import cors from 'cors';
import { logger } from './utils/logger';

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });
  next();
});

// Health check endpoints
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'cemai-infrastructure-agents'
  });
});

app.get('/api/v1/ping', (_req, res) => {
  res.status(200).json({
    message: 'pong',
    timestamp: new Date().toISOString(),
    service: 'cemai-infrastructure-agents'
  });
});

app.get('/api/v1/version', (_req, res) => {
  res.status(200).json({
    version: '1.0.0',
    build: process.env.BUILD_ID || 'dev',
    timestamp: new Date().toISOString()
  });
});

// Authentication endpoints
app.post('/api/v1/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      error: 'Email and password are required'
    });
  }
  
  // Mock authentication for demo
  if (email === 'operator@cemai.com' && password === 'password123') {
    res.status(200).json({
      data: {
        accessToken: 'mock_access_token_' + Date.now(),
        refreshToken: 'mock_refresh_token_' + Date.now(),
        user: {
          id: 'user_123',
          name: 'Plant Operator',
          email: 'operator@cemai.com',
          role: 'operator',
          permissions: ['read_kpis', 'approve_decisions', 'view_logs']
        }
      },
      timestamp: new Date().toISOString(),
      requestId: 'req_' + Date.now()
    });
  } else {
    res.status(401).json({
      error: 'Invalid credentials'
    });
  }
});

app.post('/api/v1/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(400).json({
      error: 'Refresh token is required'
    });
  }
  
  res.status(200).json({
    data: {
      accessToken: 'new_access_token_' + Date.now(),
      refreshToken: 'new_refresh_token_' + Date.now()
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/v1/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authorization header required'
    });
  }
  
  res.status(200).json({
    data: {
      id: 'user_123',
      name: 'Plant Operator',
      email: 'operator@cemai.com',
      role: 'operator',
      permissions: ['read_kpis', 'approve_decisions', 'view_logs']
    },
    timestamp: new Date().toISOString()
  });
});

app.post('/api/v1/auth/logout', (_req, res) => {
  res.status(200).json({
    message: 'Logged out successfully',
    timestamp: new Date().toISOString()
  });
});

// Glass Cockpit endpoints
app.get('/api/v1/kpis/realtime', (_req, res) => {
  res.status(200).json({
    data: {
      specificPower: {
        id: 'specific_power',
        name: 'Specific Power Consumption',
        value: 45.2,
        unit: 'kWh/t',
        trend: 'down',
        status: 'normal',
        target: { min: 40, max: 50 },
        timestamp: new Date().toISOString()
      },
      heatRate: {
        id: 'heat_rate',
        name: 'Heat Rate',
        value: 3.2,
        unit: 'MJ/kg',
        trend: 'stable',
        status: 'normal',
        target: { min: 3.0, max: 3.5 },
        timestamp: new Date().toISOString()
      },
      lsf: {
        id: 'lsf',
        name: 'Lime Saturation Factor',
        value: 99.5,
        unit: '%',
        trend: 'stable',
        status: 'normal',
        target: { min: 98.0, max: 102.0 },
        timestamp: new Date().toISOString()
      }
    },
    timestamp: new Date().toISOString(),
    requestId: 'req_' + Date.now()
  });
});

app.get('/api/v1/kpis/history', (req, res) => {
  const { from, to, interval = '1h' } = req.query;
  
  res.status(200).json({
    data: {
      kpis: [
        {
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          specificPower: 45.1,
          heatRate: 3.2,
          lsf: 99.4
        },
        {
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          specificPower: 45.3,
          heatRate: 3.1,
          lsf: 99.6
        }
      ]
    },
    timestamp: new Date().toISOString(),
    requestId: 'req_' + Date.now()
  });
});

app.post('/api/v1/health/predictions', (req, res) => {
  const { systems } = req.body;
  
  res.status(200).json({
    data: {
      predictions: systems.map((system: string) => ({
        system,
        healthScore: Math.random() * 100,
        predictedIssues: [],
        confidence: 0.95,
        timestamp: new Date().toISOString()
      }))
    },
    timestamp: new Date().toISOString(),
    requestId: 'req_' + Date.now()
  });
});

app.get('/api/v1/alerts/process', (_req, res) => {
  res.status(200).json({
    data: {
      alerts: [
        {
          id: 'alert_1',
          type: 'warning',
          message: 'LSF approaching upper limit',
          severity: 'medium',
          timestamp: new Date().toISOString(),
          acknowledged: false
        }
      ]
    },
    timestamp: new Date().toISOString(),
    requestId: 'req_' + Date.now()
  });
});

app.get('/api/v1/logs/master', (req, res) => {
  const { level = 'info', limit = 50 } = req.query;
  
  res.status(200).json({
    data: {
      logs: [
        {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'System operating normally',
          agent: 'master_control'
        },
        {
          timestamp: new Date(Date.now() - 300000).toISOString(),
          level: 'info',
          message: 'Guardian agent prediction completed',
          agent: 'guardian'
        }
      ]
    },
    timestamp: new Date().toISOString(),
    requestId: 'req_' + Date.now()
  });
});

// Co-Pilot endpoints
app.get('/api/v1/agent/state', (_req, res) => {
  res.status(200).json({
    data: {
      autonomy: 'paused',
      reason: 'decision_required',
      pendingDecisionId: 'dec_123'
    },
    timestamp: new Date().toISOString(),
    requestId: 'req_' + Date.now()
  });
});

app.post('/api/v1/agent/pause', (req, res) => {
  const { reason } = req.body;
  
  res.status(200).json({
    message: 'Autonomy paused',
    reason,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/v1/agent/resume', (_req, res) => {
  res.status(200).json({
    message: 'Autonomy resumed',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/v1/agent/manual', (req, res) => {
  const { reason } = req.body;
  
  res.status(200).json({
    message: 'Manual mode activated',
    reason,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/v1/decisions/pending', (_req, res) => {
  res.status(200).json({
    data: {
      decisions: [
        {
          id: 'dec_123',
          guardian: {
            id: 'prop_guardian_123',
            agent: 'guardian',
            title: 'LSF Stability Correction',
            description: 'Adjust kiln speed to maintain LSF within quality band',
            adjustments: { kiln_speed: 0.1 },
            predictedImpact: { lsf_deviation: -0.5 },
            confidence: 0.95
          },
          optimizer: {
            id: 'prop_optimizer_123',
            agent: 'optimizer',
            title: 'Fuel Mix Optimization',
            description: 'Increase alternative fuel ratio for cost savings',
            adjustments: { alternative_fuel_ratio: 0.05 },
            predictedImpact: { cost_savings: 2.5 },
            confidence: 0.88
          },
          synthesis: {
            summary: 'Combined stability and optimization approach',
            rationale: 'Guardian proposal takes priority for safety, optimizer adjustments applied within safety bounds',
            recommendedAdjustments: {
              kiln_speed: 0.1,
              alternative_fuel_ratio: 0.02
            }
          },
          createdAt: new Date().toISOString()
        }
      ]
    },
    timestamp: new Date().toISOString(),
    requestId: 'req_' + Date.now()
  });
});

app.post('/api/v1/decisions/:id/approve', (req, res) => {
  const { id } = req.params;
  const { rationale } = req.body;
  
  res.status(200).json({
    message: 'Decision approved',
    decisionId: id,
    rationale,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/v1/decisions/:id/reject', (req, res) => {
  const { id } = req.params;
  const { rationale } = req.body;
  
  res.status(200).json({
    message: 'Decision rejected',
    decisionId: id,
    rationale,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/v1/decisions/:id', (req, res) => {
  const { id } = req.params;
  
  res.status(200).json({
    data: {
      id,
      status: 'pending',
      createdAt: new Date().toISOString(),
      details: 'Decision details here'
    },
    timestamp: new Date().toISOString(),
    requestId: 'req_' + Date.now()
  });
});

app.get('/api/v1/decisions/history', (req, res) => {
  const { page = 1, size = 20, status } = req.query;
  
  res.status(200).json({
    data: {
      decisions: [
        {
          id: 'dec_122',
          status: 'approved',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          approvedBy: 'operator@cemai.com'
        }
      ],
      pagination: {
        page: Number(page),
        size: Number(size),
        total: 1
      }
    },
    timestamp: new Date().toISOString(),
    requestId: 'req_' + Date.now()
  });
});

// Oracle endpoints
app.post('/api/v1/chat/message', (req, res) => {
  const { message, context } = req.body;
  
  res.status(200).json({
    data: {
      response: `I understand you're asking about: ${message}. Based on current plant data, here's my analysis...`,
      suggestions: [
        'What is the current LSF trend?',
        'How can I optimize fuel consumption?',
        'What are the current alerts?'
      ],
      citations: [
        {
          source: 'Guardian Agent',
          data: 'LSF: 99.5%'
        }
      ]
    },
    timestamp: new Date().toISOString(),
    requestId: 'req_' + Date.now()
  });
});

app.get('/api/v1/chat/sessions', (_req, res) => {
  res.status(200).json({
    data: {
      sessions: [
        {
          id: 'session_1',
          title: 'LSF Analysis Discussion',
          createdAt: new Date().toISOString(),
          messageCount: 5
        }
      ]
    },
    timestamp: new Date().toISOString(),
    requestId: 'req_' + Date.now()
  });
});

app.get('/api/v1/chat/sessions/:id/messages', (req, res) => {
  const { id } = req.params;
  
  res.status(200).json({
    data: {
      messages: [
        {
          id: 'msg_1',
          role: 'user',
          content: 'What is the current LSF value?',
          timestamp: new Date().toISOString()
        },
        {
          id: 'msg_2',
          role: 'assistant',
          content: 'The current LSF is 99.5%, which is within the normal range.',
          timestamp: new Date().toISOString()
        }
      ]
    },
    timestamp: new Date().toISOString(),
    requestId: 'req_' + Date.now()
  });
});

app.post('/api/v1/chat/suggestions', (req, res) => {
  const { context } = req.body;
  
  res.status(200).json({
    data: {
      suggestions: [
        'What factors affect LSF stability?',
        'How can I improve fuel efficiency?',
        'What are the current optimization opportunities?'
      ]
    },
    timestamp: new Date().toISOString(),
    requestId: 'req_' + Date.now()
  });
});

app.get('/api/v1/sops/search', (req, res) => {
  const { q, limit = 10 } = req.query;
  
  res.status(200).json({
    data: {
      sops: [
        {
          id: 'sop_1',
          title: 'Kiln Maintenance Procedure',
          description: 'Standard operating procedure for kiln maintenance',
          tags: ['maintenance', 'kiln'],
          steps: 15
        }
      ]
    },
    timestamp: new Date().toISOString(),
    requestId: 'req_' + Date.now()
  });
});

app.get('/api/v1/sops/:id', (req, res) => {
  const { id } = req.params;
  
  res.status(200).json({
    data: {
      id,
      title: 'Kiln Maintenance Procedure',
      description: 'Standard operating procedure for kiln maintenance',
      steps: [
        {
          step: 1,
          title: 'Safety Check',
          description: 'Perform safety checks before starting maintenance',
          duration: '15 minutes'
        }
      ]
    },
    timestamp: new Date().toISOString(),
    requestId: 'req_' + Date.now()
  });
});

// Notifications & Audit endpoints
app.get('/api/v1/notifications', (req, res) => {
  const { unreadOnly = false, page = 1, size = 20 } = req.query;
  
  res.status(200).json({
    data: {
      notifications: [
        {
          id: 'notif_1',
          title: 'LSF Alert',
          message: 'LSF approaching upper limit',
          type: 'warning',
          read: false,
          timestamp: new Date().toISOString()
        }
      ],
      pagination: {
        page: Number(page),
        size: Number(size),
        total: 1
      }
    },
    timestamp: new Date().toISOString(),
    requestId: 'req_' + Date.now()
  });
});

app.post('/api/v1/notifications/:id/read', (req, res) => {
  const { id } = req.params;
  
  res.status(200).json({
    message: 'Notification marked as read',
    notificationId: id,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/v1/audit/events', (req, res) => {
  const { from, to, page = 1, size = 50 } = req.query;
  
  res.status(200).json({
    data: {
      events: [
        {
          id: 'event_1',
          action: 'decision_approved',
          user: 'operator@cemai.com',
          timestamp: new Date().toISOString(),
          details: 'Approved LSF correction decision'
        }
      ],
      pagination: {
        page: Number(page),
        size: Number(size),
        total: 1
      }
    },
    timestamp: new Date().toISOString(),
    requestId: 'req_' + Date.now()
  });
});

// System Configuration endpoints
app.get('/api/v1/config/system', (_req, res) => {
  res.status(200).json({
    data: {
      environment: 'development',
      version: '1.0.0',
      features: {
        decisionHub: true,
        oracleChat: true,
        autonomyControl: true,
        healthPredictions: true,
        realTimeUpdates: true
      }
    },
    timestamp: new Date().toISOString(),
    requestId: 'req_' + Date.now()
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  
  res.status(500).json({
    error: 'Internal server error',
    timestamp: new Date().toISOString(),
    requestId: 'req_' + Date.now()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(port, () => {
  logger.info(`CemAI Infrastructure API listening on port ${port}`, {
    port,
    environment: process.env.NODE_ENV || 'development'
  });
});

export default app;
