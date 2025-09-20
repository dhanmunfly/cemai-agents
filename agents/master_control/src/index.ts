import express from 'express';
import client from 'prom-client';
import { trace } from '@opentelemetry/api';
import { logger } from './utils/logger';
import { A2AClient } from './utils/a2a-client';
import { SecurityValidator } from './utils/security-validator';
import { AgentMetrics } from './utils/metrics';
import { buildGraph } from './graph';
import { DECISION_TIMEOUT_MS } from './config/constants';

const app = express();
app.use(express.json());

const port = process.env.PORT ? Number(process.env.PORT) : 8083;
const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'cemai-agents';

// Initialize services
const metrics = new AgentMetrics('master_control_agent', projectId);
const a2aClient = new A2AClient('master_control_agent');

// Prometheus metrics
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Custom metrics
const decisionLatency = new client.Histogram({
  name: 'cemai_decision_latency_seconds',
  help: 'Master Control decision latency in seconds',
  labelNames: ['decision_type', 'proposal_count'],
  buckets: [1, 5, 10, 30, 60, 120],
  registers: [register]
});

const conflictResolutionRate = new client.Gauge({
  name: 'cemai_conflict_resolution_rate',
  help: 'Conflict resolution success rate',
  labelNames: ['conflict_type'],
  registers: [register]
});

const proposalAcceptanceRate = new client.Gauge({
  name: 'cemai_proposal_acceptance_rate',
  help: 'Proposal acceptance rate by Master Control',
  labelNames: ['agent_id', 'proposal_type'],
  registers: [register]
});

const workflowCount = new client.Counter({
  name: 'cemai_workflows_total',
  help: 'Total number of Master Control workflows executed',
  labelNames: ['status'],
  registers: [register]
});

// Health check endpoints
app.get('/health', (_req, res) => res.status(200).send('OK'));
app.get('/ready', (_req, res) => res.status(200).send('READY'));
app.get('/startup', (_req, res) => res.status(200).send('STARTED'));
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

/**
 * Orchestrate multi-agent decision workflow using LangGraph
 * Implements Constitutional AI framework for conflict resolution
 */
app.post('/v1/orchestrate', async (req, res) => {
  const tracer = trace.getTracer('master-control-agent');
  const span = tracer.startSpan('orchestrate_workflow');
  
  try {
    // Validate input
    if (!SecurityValidator.validateOrchestrationRequest(req.body)) {
      return res.status(400).json({
        error: 'Invalid request format',
        agent: 'master_control'
      });
    }

    const { trigger, context, requestId } = req.body;
    
    // Generate unique identifiers
    const workflowRequestId = requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize workflow state
    const initialState = {
      requestId: workflowRequestId,
      conversationId,
      timestamp: new Date().toISOString(),
      trigger,
      context,
      proposals: [],
      conflicts: [],
      approvedActions: [],
      rejectedActions: [],
      modifications: [],
      status: 'initializing' as const
    };
    
    // Execute LangGraph workflow with timeout
    const graph = buildGraph();
    const result = await Promise.race([
      graph.invoke(initialState),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Decision timeout')), DECISION_TIMEOUT_MS)
      )
    ]);
    
    // Update metrics
    const latency = (Date.now() - new Date(initialState.timestamp).getTime()) / 1000;
    decisionLatency.labels('orchestration', result.proposals?.length?.toString() || '0').observe(latency);
    workflowCount.labels(result.status).inc();
    
    if (result.status === 'completed') {
      proposalAcceptanceRate.labels('guardian', 'stability').set(
        result.guardianProposal ? 1 : 0
      );
      proposalAcceptanceRate.labels('optimizer', 'optimization').set(
        result.optimizerProposal ? 1 : 0
      );
    }
    
    span.setAttributes({
      'workflow.request_id': workflowRequestId,
      'workflow.conversation_id': conversationId,
      'workflow.status': result.status,
      'workflow.proposal_count': result.proposals?.length || 0,
      'workflow.conflict_count': result.conflicts?.length || 0,
      'workflow.approved_actions': result.approvedActions?.length || 0,
      'workflow.latency_seconds': latency
    });

    res.status(200).json({
      agent: 'master_control',
      status: 'success',
      workflow: {
        requestId: workflowRequestId,
        conversationId,
        status: result.status,
        proposals: result.proposals,
        conflicts: result.conflicts,
        decision: result.decision,
        approvedActions: result.approvedActions,
        rejectedActions: result.rejectedActions,
        modifications: result.modifications,
        latency: latency
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Workflow orchestration failed', { error: error.message, stack: error.stack });
    workflowCount.labels('error').inc();
    
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message });
    
    res.status(500).json({
      agent: 'master_control',
      status: 'error',
      error: 'Workflow orchestration failed'
    });
  } finally {
    span.end();
  }
});

/**
 * Handle A2A message reception
 */
app.post('/a2a/receive', async (req, res) => {
  const tracer = trace.getTracer('master-control-agent');
  const span = tracer.startSpan('receive_a2a_message');
  
  try {
    // Validate A2A message
    if (!SecurityValidator.validateA2AMessage(req.body)) {
      return res.status(400).json({
        error: 'Invalid A2A message format',
        agent: 'master_control'
      });
    }

    const message = req.body;
    
    // Process message based on type
    let response;
    switch (message.messageType) {
      case 'proposal':
        response = await handleProposal(message);
        break;
      case 'status':
        response = await handleStatus(message);
        break;
      case 'data':
        response = await handleData(message);
        break;
      default:
        throw new Error(`Unknown message type: ${message.messageType}`);
    }
    
    span.setAttributes({
      'a2a.message.type': message.messageType,
      'a2a.message.id': message.messageId,
      'a2a.sender': message.senderAgent
    });
    
    res.status(200).json(response);
    
  } catch (error) {
    logger.error('A2A message processing failed', { error: error.message });
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message });
    
    res.status(500).json({
      error: 'Message processing failed',
      agent: 'master_control'
    });
  } finally {
    span.end();
  }
});

/**
 * Handle incoming proposals from specialist agents
 */
async function handleProposal(message: any): Promise<any> {
  try {
    logger.info('Received proposal from specialist agent', {
      senderAgent: message.senderAgent,
      proposalType: message.payload.proposalType,
      urgency: message.payload.urgency
    });
    
    // Store proposal for processing
    // In a real implementation, this would be stored in AlloyDB for LangGraph checkpointing
    
    return {
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversationId: message.conversationId,
      timestamp: new Date().toISOString(),
      correlationId: message.correlationId,
      senderAgent: 'master_control_agent',
      recipientAgent: message.senderAgent,
      messageType: 'status',
      payload: {
        status: 'proposal_received',
        message: 'Proposal received and queued for processing'
      },
      protocolVersion: '1.0',
      priority: 'normal'
    };
    
  } catch (error) {
    logger.error('Proposal handling failed', { error: error.message });
    throw error;
  }
}

/**
 * Handle status messages
 */
async function handleStatus(message: any): Promise<any> {
  try {
    logger.info('Received status message', {
      senderAgent: message.senderAgent,
      status: message.payload.agent_status
    });
    
    return {
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversationId: message.conversationId,
      timestamp: new Date().toISOString(),
      correlationId: message.correlationId,
      senderAgent: 'master_control_agent',
      recipientAgent: message.senderAgent,
      messageType: 'status',
      payload: {
        status: 'acknowledged',
        message: 'Status message acknowledged'
      },
      protocolVersion: '1.0',
      priority: 'normal'
    };
    
  } catch (error) {
    logger.error('Status handling failed', { error: error.message });
    throw error;
  }
}

/**
 * Handle data messages
 */
async function handleData(message: any): Promise<any> {
  try {
    logger.info('Received data message', {
      senderAgent: message.senderAgent,
      dataType: message.payload.dataType
    });
    
    return {
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversationId: message.conversationId,
      timestamp: new Date().toISOString(),
      correlationId: message.correlationId,
      senderAgent: 'master_control_agent',
      recipientAgent: message.senderAgent,
      messageType: 'status',
      payload: {
        status: 'data_received',
        message: 'Data message received and processed'
      },
      protocolVersion: '1.0',
      priority: 'normal'
    };
    
  } catch (error) {
    logger.error('Data handling failed', { error: error.message });
    throw error;
  }
}

// Initialize agent
async function initializeAgent() {
  try {
    logger.info('Master Control Agent initialized successfully', {
      agent: 'master_control',
      version: '1.0.0',
      port,
      projectId
    });
  } catch (error) {
    logger.error('Master Control Agent initialization failed', { error: error.message });
    process.exit(1);
  }
}

// Start server
app.listen(port, async () => {
  console.log(`Master Control Agent listening on :${port}`);
  console.log('To open LangGraph Studio for this graph:');
  console.log('  npm --workspace @cemai/master_control run studio');
  await initializeAgent();
});


