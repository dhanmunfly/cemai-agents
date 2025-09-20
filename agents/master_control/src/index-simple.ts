import express from 'express';
import { logger } from './utils/logger-simple';

const app = express();
app.use(express.json());

const port = process.env.PORT ? Number(process.env.PORT) : 8083;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    agent: 'master_control',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.json({
    agent: 'master_control',
    metrics: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    }
  });
});

// Simple orchestration endpoint
app.post('/v1/orchestrate', (req, res) => {
  try {
    const { trigger, context, requestId } = req.body;
    
    logger.info('Received orchestration request', { trigger, requestId });
    
    // Simulate workflow processing
    const workflowRequestId = requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Mock workflow result
    const result = {
      requestId: workflowRequestId,
      conversationId,
      status: 'completed',
      proposals: [],
      conflicts: [],
      decision: {
        summary: 'Mock decision for demonstration',
        rationale: 'This is a simplified version for testing',
        recommendedAdjustments: {}
      },
      approvedActions: [],
      rejectedActions: [],
      modifications: [],
      latency: 0.5
    };
    
    res.status(200).json({
      agent: 'master_control',
      status: 'success',
      workflow: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    logger.error('Workflow orchestration failed', { error: error.message });
    
    res.status(500).json({
      agent: 'master_control',
      status: 'error',
      error: 'Workflow orchestration failed'
    });
  }
});

// A2A message endpoint
app.post('/a2a/receive', (req, res) => {
  try {
    const message = req.body;
    
    logger.info('Received A2A message', { 
      messageId: message.message_id,
      sender: message.sender_agent,
      type: message.message_type
    });
    
    res.status(200).json({
      agent: 'master_control',
      status: 'success',
      messageId: message.message_id,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    logger.error('A2A message processing failed', { error: error.message });
    
    res.status(500).json({
      agent: 'master_control',
      status: 'error',
      error: 'Message processing failed'
    });
  }
});

// Start server
app.listen(port, () => {
  logger.info(`Master Control Agent running on port ${port}`);
  console.log(`🚀 Master Control Agent started on http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`📈 Metrics: http://localhost:${port}/metrics`);
  console.log(`🎯 Orchestration: http://localhost:${port}/v1/orchestrate`);
  console.log(`📨 A2A Messages: http://localhost:${port}/a2a/receive`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Master Control Agent shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Master Control Agent shutting down gracefully');
  process.exit(0);
});
