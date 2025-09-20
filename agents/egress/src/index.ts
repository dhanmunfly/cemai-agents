import express from 'express';
import client from 'prom-client';
import { trace } from '@opentelemetry/api';
import { logger } from './utils/logger';
import { A2AClient } from './utils/a2a-client';
import { SecurityValidator } from './utils/security-validator';
import { AgentMetrics } from './utils/metrics';
import { OPCUAClient } from './utils/opcua-client';
import { COMMAND_TIMEOUT_MS, OPCUA_ENDPOINT } from './config/constants';

const app = express();
app.use(express.json());

const port = process.env.PORT ? Number(process.env.PORT) : 8084;
const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'cemai-agents';

// Initialize services
const metrics = new AgentMetrics('egress_agent', projectId);
const a2aClient = new A2AClient('egress_agent');
const opcuaClient = new OPCUAClient(OPCUA_ENDPOINT);

// Prometheus metrics
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Custom metrics
const commandLatency = new client.Histogram({
  name: 'cemai_command_latency_seconds',
  help: 'OPC-UA command execution latency in seconds',
  labelNames: ['command_type', 'status'],
  buckets: [0.1, 0.5, 1.0, 2.0, 5.0, 10.0],
  registers: [register]
});

const commandSuccessRate = new client.Gauge({
  name: 'cemai_command_success_rate',
  help: 'OPC-UA command success rate',
  labelNames: ['command_type'],
  registers: [register]
});

const opcuaConnectionStatus = new client.Gauge({
  name: 'cemai_opcua_connection_status',
  help: 'OPC-UA server connection status',
  registers: [register]
});

const commandCount = new client.Counter({
  name: 'cemai_commands_total',
  help: 'Total number of commands executed',
  labelNames: ['command_type', 'status'],
  registers: [register]
});

// Health check endpoints
app.get('/health', (_req, res) => res.status(200).send('OK'));
app.get('/ready', async (_req, res) => {
  try {
    const isConnected = await opcuaClient.isConnected();
    if (isConnected) {
      res.status(200).send('READY');
    } else {
      res.status(503).send('NOT_READY');
    }
  } catch (error) {
    res.status(503).send('NOT_READY');
  }
});
app.get('/startup', (_req, res) => res.status(200).send('STARTED'));
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

/**
 * Execute command on OPC-UA server
 * Implements secure command transmission with validation
 */
app.post('/v1/command', async (req, res) => {
  const tracer = trace.getTracer('egress-agent');
  const span = tracer.startSpan('execute_opcua_command');
  
  try {
    // Validate input
    if (!SecurityValidator.validateCommandRequest(req.body)) {
      return res.status(400).json({
        error: 'Invalid command format',
        agent: 'egress'
      });
    }

    const { commandId, action, authorization, priority = 'normal' } = req.body;
    
    // Validate authorization token
    if (!SecurityValidator.validateAuthorization(authorization)) {
      return res.status(401).json({
        error: 'Invalid authorization',
        agent: 'egress'
      });
    }

    // Execute command with timeout
    const result = await Promise.race([
      executeOPCUACommand(action),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Command timeout')), COMMAND_TIMEOUT_MS)
      )
    ]) as { executedValue: any; latency: number; status: string };
    
    // Update metrics
    commandLatency.labels(action.controlVariable, 'success').observe(result.latency);
    commandSuccessRate.labels(action.controlVariable).set(1);
    commandCount.labels(action.controlVariable, 'success').inc();

    span.setAttributes({
      'command.id': commandId,
      'command.control_variable': action.controlVariable,
      'command.status': 'success',
      'command.latency_seconds': result.latency
    });

    res.status(200).json({
      agent: 'egress',
      status: 'success',
      command: {
        commandId,
        controlVariable: action.controlVariable,
        currentValue: action.currentValue,
        proposedValue: action.proposedValue,
        executedValue: result.executedValue,
        status: 'executed',
        latency: result.latency
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('OPC-UA command execution failed', { 
      error: (error as Error).message, 
      stack: (error as Error).stack 
    });
    commandCount.labels(req.body.action?.controlVariable || 'unknown', 'error').inc();
    
    span.recordException(error as Error);
    span.setStatus({ code: 2, message: (error as Error).message });
    
    res.status(500).json({
      agent: 'egress',
      status: 'error',
      error: 'Command execution failed'
    });
  } finally {
    span.end();
  }
});

/**
 * Execute command on OPC-UA server
 */
async function executeOPCUACommand(action: any) {
  const startTime = Date.now();
  
  try {
    // Ensure OPC-UA connection
    if (!await opcuaClient.isConnected()) {
      await opcuaClient.connect();
    }
    
    // Map control variable to OPC-UA node ID
    const nodeId = mapControlVariableToNodeId(action.controlVariable);
    
    // Validate command safety
    await validateCommandSafety(action, nodeId);
    
    // Execute the command
    const executedValue = await opcuaClient.writeValue(nodeId, action.proposedValue);
    
    // Verify execution
    const verificationValue = await opcuaClient.readValue(nodeId);
    
    const latency = (Date.now() - startTime) / 1000;
    
    logger.info('OPC-UA command executed successfully', {
      controlVariable: action.controlVariable,
      currentValue: action.currentValue,
      proposedValue: action.proposedValue,
      executedValue: verificationValue,
      latency
    });
    
    return {
      executedValue: verificationValue,
      latency,
      status: 'success'
    };
    
  } catch (error) {
    logger.error('OPC-UA command execution failed', { error: (error as Error).message });
    throw new Error(`OPC-UA execution error: ${(error as Error).message}`);
  }
}

/**
 * Map control variable to OPC-UA node ID
 */
function mapControlVariableToNodeId(controlVariable: string): string {
  const nodeMapping: { [key: string]: string } = {
    'kiln_speed': 'ns=2;s=Kiln.Speed.Setpoint',
    'fuel_flow': 'ns=2;s=Fuel.Flow.Setpoint',
    'feed_rate': 'ns=2;s=Feed.Rate.Setpoint',
    'preheater_temp': 'ns=2;s=Preheater.Temperature.Setpoint',
    'mill_power': 'ns=2;s=Mill.Power.Setpoint'
  };
  
  const nodeId = nodeMapping[controlVariable];
  if (!nodeId) {
    throw new Error(`Unknown control variable: ${controlVariable}`);
  }
  
  return nodeId;
}

/**
 * Validate command safety before execution
 */
async function validateCommandSafety(action: any, nodeId: string) {
  // Read current value from OPC-UA
  const currentValue = await opcuaClient.readValue(nodeId);
  
  // Validate proposed value is within safe limits
  const safetyLimits = getSafetyLimits(action.controlVariable);
  if (action.proposedValue < safetyLimits.min || action.proposedValue > safetyLimits.max) {
    throw new Error(`Proposed value ${action.proposedValue} outside safety limits [${safetyLimits.min}, ${safetyLimits.max}]`);
  }
  
  // Validate adjustment magnitude is reasonable
  const adjustmentMagnitude = Math.abs(action.proposedValue - currentValue);
  const maxAdjustment = safetyLimits.maxAdjustment;
  
  if (adjustmentMagnitude > maxAdjustment) {
    throw new Error(`Adjustment magnitude ${adjustmentMagnitude} exceeds maximum allowed ${maxAdjustment}`);
  }
  
  // Check for emergency conditions
  const emergencyStatus = await opcuaClient.readValue('ns=2;s=System.EmergencyStatus');
  if (emergencyStatus === 1) {
    throw new Error('Emergency condition active - commands not allowed');
  }
}

/**
 * Get safety limits for control variables
 */
function getSafetyLimits(controlVariable: string) {
  const limits: { [key: string]: { min: number; max: number; maxAdjustment: number } } = {
    'kiln_speed': { min: 2.8, max: 4.2, maxAdjustment: 0.2 },
    'fuel_flow': { min: 4.5, max: 6.8, maxAdjustment: 0.3 },
    'feed_rate': { min: 180, max: 220, maxAdjustment: 5.0 },
    'preheater_temp': { min: 850, max: 950, maxAdjustment: 10.0 },
    'mill_power': { min: 1000, max: 5000, maxAdjustment: 200.0 }
  };
  
  const limit = limits[controlVariable];
  if (!limit) {
    throw new Error(`No safety limits defined for control variable: ${controlVariable}`);
  }
  
  return limit;
}

/**
 * Handle A2A message reception
 */
app.post('/a2a/receive', async (req, res) => {
  const tracer = trace.getTracer('egress-agent');
  const span = tracer.startSpan('receive_a2a_message');
  
  try {
    // Validate A2A message
    if (!SecurityValidator.validateA2AMessage(req.body)) {
      return res.status(400).json({
        error: 'Invalid A2A message format',
        agent: 'egress'
      });
    }

    const message = req.body;
    
    // Process command message
    if (message.messageType === 'command') {
      const commandResult = await executeOPCUACommand(message.payload.action);
      
      span.setAttributes({
        'a2a.message.type': message.messageType,
        'a2a.message.id': message.messageId,
        'a2a.sender': message.senderAgent,
        'command.status': 'executed'
      });
      
      res.status(200).json({
        messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        conversationId: message.conversationId,
        timestamp: new Date().toISOString(),
        correlationId: message.correlationId,
        senderAgent: 'egress_agent',
        recipientAgent: message.senderAgent,
        messageType: 'status',
        payload: {
          status: 'command_executed',
          result: commandResult,
          message: 'Command executed successfully on OPC-UA server'
        },
        protocolVersion: '1.0',
        priority: 'normal'
      });
    } else {
      throw new Error(`Unknown message type: ${message.messageType}`);
    }
    
  } catch (error) {
    logger.error('A2A message processing failed', { error: (error as Error).message });
    span.recordException(error as Error);
    span.setStatus({ code: 2, message: (error as Error).message });
    
    res.status(500).json({
      error: 'Message processing failed',
      agent: 'egress'
    });
  } finally {
    span.end();
  }
});

/**
 * Get OPC-UA server status and information
 */
app.get('/v1/opcua/status', async (req, res) => {
  const tracer = trace.getTracer('egress-agent');
  const span = tracer.startSpan('get_opcua_status');
  
  try {
    const isConnected = await opcuaClient.isConnected();
    
    if (!isConnected) {
      return res.status(503).json({
        agent: 'egress',
        status: 'disconnected',
        message: 'OPC-UA server not connected'
      });
    }
    
    const serverInfo = await opcuaClient.getServerInfo();
    
    span.setAttributes({
      'opcua.connected': true,
      'opcua.session_id': serverInfo.sessionId,
      'opcua.security_mode': serverInfo.securityMode
    });
    
    res.status(200).json({
      agent: 'egress',
      status: 'connected',
      serverInfo: {
        endpoint: serverInfo.endpoint,
        sessionId: serverInfo.sessionId,
        sessionName: serverInfo.sessionName,
        securityMode: serverInfo.securityMode,
        securityPolicy: serverInfo.securityPolicy,
        status: serverInfo.status,
        capabilities: serverInfo.capabilities
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get OPC-UA status', { error: (error as Error).message });
    span.recordException(error as Error);
    span.setStatus({ code: 2, message: (error as Error).message });
    
    res.status(500).json({
      agent: 'egress',
      status: 'error',
      error: 'Failed to get OPC-UA status'
    });
  } finally {
    span.end();
  }
});

/**
 * Get OPC-UA node information
 */
app.get('/v1/opcua/nodes/:nodeId', async (req, res) => {
  const tracer = trace.getTracer('egress-agent');
  const span = tracer.startSpan('get_opcua_node_info');
  
  try {
    const { nodeId } = req.params;
    
    // Validate node exists
    const exists = await opcuaClient.validateNodeExists(nodeId);
    if (!exists) {
      return res.status(404).json({
        agent: 'egress',
        error: 'Node not found',
        nodeId
      });
    }
    
    // Get node attributes
    const nodeInfo = await opcuaClient.getNodeAttributes(nodeId);
    
    span.setAttributes({
      'opcua.node_id': nodeId,
      'opcua.node_exists': true
    });
    
    res.status(200).json({
      agent: 'egress',
      nodeInfo,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get OPC-UA node info', { 
      nodeId: req.params.nodeId,
      error: (error as Error).message 
    });
    span.recordException(error as Error);
    span.setStatus({ code: 2, message: (error as Error).message });
    
    res.status(500).json({
      agent: 'egress',
      error: 'Failed to get node information'
    });
  } finally {
    span.end();
  }
});

/**
 * Emergency stop endpoint
 */
app.post('/v1/emergency-stop', async (req, res) => {
  const tracer = trace.getTracer('egress-agent');
  const span = tracer.startSpan('emergency_stop');
  
  try {
    // Validate emergency authorization
    if (!SecurityValidator.validateEmergencyAuthorization(req.headers.authorization)) {
      return res.status(401).json({
        error: 'Invalid emergency authorization',
        agent: 'egress'
      });
    }
    
    // Execute emergency stop on OPC-UA
    await opcuaClient.writeValue('ns=2;s=System.EmergencyStop', 1);
    
    logger.warn('Emergency stop executed', {
      timestamp: new Date().toISOString(),
      authorizedBy: req.headers['x-user-id'] || 'unknown'
    });
    
    span.setAttributes({
      'emergency.stop': true,
      'emergency.authorized_by': req.headers['x-user-id'] || 'unknown'
    });
    
    res.status(200).json({
      agent: 'egress',
      status: 'success',
      message: 'Emergency stop executed',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Emergency stop failed', { error: (error as Error).message });
    span.recordException(error as Error);
    span.setStatus({ code: 2, message: (error as Error).message });
    
    res.status(500).json({
      agent: 'egress',
      status: 'error',
      error: 'Emergency stop failed'
    });
  } finally {
    span.end();
  }
});

// Monitor OPC-UA connection status
async function monitorOPCUAConnection() {
  try {
    const isConnected = await opcuaClient.isConnected();
    opcuaConnectionStatus.set(isConnected ? 1 : 0);
    
    if (!isConnected) {
      logger.warn('OPC-UA connection lost, attempting reconnection');
      await opcuaClient.connect();
    }
  } catch (error) {
    logger.error('OPC-UA connection monitoring failed', { error: (error as Error).message });
    opcuaConnectionStatus.set(0);
  }
}

// Initialize agent
async function initializeAgent() {
  try {
    // Connect to OPC-UA server
    await opcuaClient.connect();
    
    // Get server information
    const serverInfo = await opcuaClient.getServerInfo();
    logger.info('OPC-UA server connected', {
      endpoint: serverInfo.endpoint,
      sessionId: serverInfo.sessionId,
      securityMode: serverInfo.securityMode,
      securityPolicy: serverInfo.securityPolicy
    });
    
    // Validate critical nodes exist
    const criticalNodes = [
      'ns=2;s=Kiln.Speed.Setpoint',
      'ns=2;s=Fuel.Flow.Setpoint',
      'ns=2;s=Feed.Rate.Setpoint',
      'ns=2;s=Preheater.Temperature.Setpoint',
      'ns=2;s=Mill.Power.Setpoint',
      'ns=2;s=System.EmergencyStatus',
      'ns=2;s=System.EmergencyStop'
    ];
    
    for (const nodeId of criticalNodes) {
      const exists = await opcuaClient.validateNodeExists(nodeId);
      if (!exists) {
        logger.warn('Critical OPC-UA node not found', { nodeId });
      } else {
        logger.debug('OPC-UA node validated', { nodeId });
      }
    }
    
    // Start connection monitoring
    setInterval(monitorOPCUAConnection, 30000); // Check every 30 seconds
    
    logger.info('Egress Agent initialized successfully', {
      agent: 'egress',
      version: '1.0.0',
      port,
      projectId,
      opcuaEndpoint: OPCUA_ENDPOINT,
      serverInfo: {
        sessionId: serverInfo.sessionId,
        securityMode: serverInfo.securityMode
      }
    });
  } catch (error) {
    logger.error('Egress Agent initialization failed', { error: (error as Error).message });
    process.exit(1);
  }
}

// Start server
app.listen(port, async () => {
  console.log(`Egress Agent listening on :${port}`);
  await initializeAgent();
});


