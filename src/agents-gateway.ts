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
    service: 'cemai-infrastructure-agents-gateway'
  });
});

app.get('/api/v1/ping', (_req, res) => {
  res.status(200).json({
    message: 'pong',
    timestamp: new Date().toISOString(),
    service: 'cemai-infrastructure-agents-gateway'
  });
});

app.get('/api/v1/version', (_req, res) => {
  res.status(200).json({
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.ENVIRONMENT || 'development'
  });
});

// Agent URLs (working individual agents)
const AGENT_URLS = {
  guardian: 'https://guardian-agent-917156149361.asia-south1.run.app',
  optimizer: 'https://optimizer-agent-917156149361.asia-south1.run.app',
  masterControl: 'https://master-control-agent-917156149361.asia-south1.run.app',
  egress: 'https://egress-agent-917156149361.asia-south1.run.app'
};

// Authentication endpoints (mock implementation)
app.post('/api/v1/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  // Mock authentication - replace with real implementation
  if (username === 'admin' && password === 'admin') {
    res.status(200).json({
      success: true,
      token: 'mock-jwt-token-' + Date.now(),
      user: {
        id: '1',
        username: 'admin',
        role: 'admin'
      }
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
});

app.post('/api/v1/auth/refresh', (req, res) => {
  res.status(200).json({
    success: true,
    token: 'mock-refreshed-token-' + Date.now()
  });
});

app.get('/api/v1/auth/me', (req, res) => {
  res.status(200).json({
    user: {
      id: '1',
      username: 'admin',
      role: 'admin'
    }
  });
});

// Agent status endpoints
app.get('/api/v1/agents/status', async (_req, res) => {
  try {
    const agentStatuses = [];
    
    // Check each agent's health
    for (const [agentName, agentUrl] of Object.entries(AGENT_URLS)) {
      try {
        const response = await fetch(`${agentUrl}/health`);
        const isHealthy = response.ok;
        
        agentStatuses.push({
          id: agentName,
          name: agentName.charAt(0).toUpperCase() + agentName.slice(1) + ' Agent',
          status: isHealthy ? 'healthy' : 'unhealthy',
          url: agentUrl,
          lastChecked: new Date().toISOString()
        });
      } catch (error) {
        agentStatuses.push({
          id: agentName,
          name: agentName.charAt(0).toUpperCase() + agentName.slice(1) + ' Agent',
          status: 'unreachable',
          url: agentUrl,
          lastChecked: new Date().toISOString(),
          error: (error as Error).message
        });
      }
    }
    
    res.status(200).json({
      timestamp: new Date().toISOString(),
      agents: agentStatuses
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check agent statuses',
      message: (error as Error).message
    });
  }
});

// Agent communication endpoints
app.post('/api/v1/agents/guardian/predict', async (req, res) => {
  try {
    const response = await fetch(`${AGENT_URLS.guardian}/v1/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body)
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to communicate with Guardian Agent',
      message: (error as Error).message
    });
  }
});

app.post('/api/v1/agents/optimizer/optimize', async (req, res) => {
  try {
    const response = await fetch(`${AGENT_URLS.optimizer}/v1/optimize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body)
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to communicate with Optimizer Agent',
      message: (error as Error).message
    });
  }
});

app.post('/api/v1/agents/master-control/orchestrate', async (req, res) => {
  try {
    const response = await fetch(`${AGENT_URLS.masterControl}/v1/orchestrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body)
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to communicate with Master Control Agent',
      message: (error as Error).message
    });
  }
});

app.post('/api/v1/agents/egress/execute', async (req, res) => {
  try {
    const response = await fetch(`${AGENT_URLS.egress}/v1/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body)
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to communicate with Egress Agent',
      message: (error as Error).message
    });
  }
});

// System metrics endpoint
app.get('/api/v1/metrics', async (_req, res) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      system: {
        cpu: Math.random() * 100,
        memory: Math.random() * 100,
        disk: Math.random() * 100,
        network: Math.random() * 100
      },
      agents: {} as Record<string, any>
    };
    
    // Get metrics from each agent
    for (const [agentName, agentUrl] of Object.entries(AGENT_URLS)) {
      try {
        const response = await fetch(`${agentUrl}/v1/metrics`);
        if (response.ok) {
          const agentMetrics = await response.json();
          metrics.agents[agentName] = agentMetrics;
        }
      } catch (error) {
        metrics.agents[agentName] = { error: 'Unreachable' };
      }
    }
    
    res.status(200).json(metrics);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to collect metrics',
      message: (error as Error).message
    });
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  logger.info(`CemAI Infrastructure Agents Gateway started on port ${port}`);
  logger.info(`Environment: ${process.env.ENVIRONMENT || 'development'}`);
  logger.info('Agent URLs:', AGENT_URLS);
});

export default app;
