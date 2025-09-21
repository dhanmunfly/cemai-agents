import express from 'express';

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 8080;

app.use(express.json());

// Root endpoint
app.get('/', (_req, res) => {
  res.status(200).json({
    message: 'CemAI Test Service is running',
    timestamp: new Date().toISOString(),
    service: 'cemai-test-service',
    version: '1.0.0',
    port: port
  });
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'cemai-test-service'
  });
});

// Authentication endpoint
app.post('/api/v1/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  console.log('Login attempt:', { username, hasPassword: !!password });
  
  if (username === 'operator@cemai.com' && password === 'password123') {
    res.status(200).json({
      token: 'mock-jwt-token-' + Date.now(),
      refreshToken: 'mock-refresh-token-' + Date.now(),
      user: { 
        id: 'user-123', 
        email: username, 
        role: 'operator',
        name: 'CemAI Operator'
      },
      expiresIn: 3600
    });
  } else {
    res.status(401).json({ 
      message: 'Invalid credentials',
      error: 'AUTHENTICATION_FAILED'
    });
  }
});

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`CemAI Test Service listening on port ${port}`);
});
