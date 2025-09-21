import express from 'express';
import cors from 'cors';
import { logger } from './utils/logger';

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 8080;

// CORS configuration for frontend access
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://localhost:5173', 
    'https://cemai-infrastructure-ui-dev-2e6ovquneq-el.a.run.app',
    'https://cemai-infrastructure-ui-dev-917156149361.asia-south1.run.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

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

// Root endpoint
app.get('/', (_req, res) => {
  res.status(200).json({
    message: 'CemAI Auth Gateway is running',
    timestamp: new Date().toISOString(),
    service: 'cemai-auth-gateway',
    version: '1.0.0'
  });
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'cemai-auth-gateway'
  });
});

// Authentication endpoints
app.post('/api/v1/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  logger.info('Login attempt', { username, hasPassword: !!password });
  
  // Demo credentials for development
  if (username === 'operator@cemai.com' && password === 'password123') {
    const token = 'mock-jwt-token-' + Date.now();
    const refreshToken = 'mock-refresh-token-' + Date.now();
    
    logger.info('Login successful', { username, token: token.substring(0, 20) + '...' });
    
    res.status(200).json({
      token,
      refreshToken,
      user: { 
        id: 'user-123', 
        email: username, 
        role: 'operator',
        name: 'CemAI Operator'
      },
      expiresIn: 3600
    });
  } else {
    logger.warn('Login failed', { username, reason: 'Invalid credentials' });
    res.status(401).json({ 
      message: 'Invalid credentials',
      error: 'AUTHENTICATION_FAILED'
    });
  }
});

app.post('/api/v1/auth/refresh', (req, res) => {
  logger.info('Token refresh request');
  
  res.status(200).json({
    token: 'new-mock-jwt-token-' + Date.now(),
    refreshToken: 'new-mock-refresh-token-' + Date.now(),
    expiresIn: 3600
  });
});

app.get('/api/v1/auth/me', (req, res) => {
  logger.info('User profile request');
  
  res.status(200).json({
    id: 'user-123',
    email: 'operator@cemai.com',
    role: 'operator',
    name: 'CemAI Operator'
  });
});

// Agent status endpoint
app.get('/api/v1/agents/status', (_req, res) => {
  res.status(200).json({
    timestamp: new Date().toISOString(),
    agents: [
      { 
        id: 'guardian', 
        name: 'Guardian Agent', 
        status: 'healthy', 
        url: 'https://guardian-agent-917156149361.asia-south1.run.app',
        lastChecked: new Date().toISOString() 
      },
      { 
        id: 'optimizer', 
        name: 'Optimizer Agent', 
        status: 'healthy', 
        url: 'https://optimizer-agent-917156149361.asia-south1.run.app',
        lastChecked: new Date().toISOString() 
      },
      { 
        id: 'master_control', 
        name: 'Master Control Agent', 
        status: 'healthy', 
        url: 'https://master-control-agent-917156149361.asia-south1.run.app',
        lastChecked: new Date().toISOString() 
      },
      { 
        id: 'egress', 
        name: 'Egress Agent', 
        status: 'healthy', 
        url: 'https://egress-agent-917156149361.asia-south1.run.app',
        lastChecked: new Date().toISOString() 
      }
    ]
  });
});

// System metrics endpoint
app.get('/api/v1/metrics', (_req, res) => {
  res.status(200).json({
    system: {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      disk: Math.random() * 100,
      network: Math.random() * 100
    },
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(`Auth Gateway Error: ${err.message}`, {
    method: req.method,
    path: req.path,
    error: err.message,
    stack: err.stack
  });
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Start the server
app.listen(port, () => {
  logger.info(`CemAI Auth Gateway listening on port ${port}`);
  console.log(`CemAI Auth Gateway listening on port ${port}`);
});
