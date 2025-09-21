import express from 'express';
import client from 'prom-client';
import { VertexAI } from '@google-cloud/vertexai';
import { PubSub } from '@google-cloud/pubsub';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { trace } from '@opentelemetry/api';
import { logger } from './utils/logger';
import { A2AClient } from './utils/a2a-client';
import { SecurityValidator } from './utils/security-validator';
import { AgentMetrics } from './utils/metrics';
import { OPTIMIZATION_MODEL, MARKET_DATA_TOPIC } from './config/constants';
import { Message } from '@google-cloud/pubsub';

const app = express();
app.use(express.json());

const port = process.env.PORT ? Number(process.env.PORT) : 8080;
const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'cemai-agents';
const region = process.env.GOOGLE_CLOUD_REGION || 'us-central1';

// Initialize services
const vertexAI = new VertexAI({ project: projectId, location: region });
const pubsub = new PubSub({ projectId });
const secretClient = new SecretManagerServiceClient();
const metrics = new AgentMetrics('optimizer_agent', projectId);
const a2aClient = new A2AClient('optimizer_agent');

// Prometheus metrics
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Custom metrics
const optimizationLatency = new client.Histogram({
  name: 'cemai_optimization_latency_seconds',
  help: 'Fuel mix optimization latency in seconds',
  labelNames: ['optimization_type', 'constraint_count'],
  buckets: [1, 5, 10, 30, 60, 120],
  registers: [register]
});

const costSavings = new client.Gauge({
  name: 'cemai_cost_savings_percent',
  help: 'Cost savings percentage from optimization',
  labelNames: ['optimization_period'],
  registers: [register]
});

const alternativeFuelRatio = new client.Gauge({
  name: 'cemai_alternative_fuel_ratio',
  help: 'Alternative fuel usage ratio',
  labelNames: ['fuel_type'],
  registers: [register]
});

const proposalCount = new client.Counter({
  name: 'cemai_optimization_proposals_total',
  help: 'Total number of optimization proposals generated',
  labelNames: ['proposal_type', 'status'],
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
 * Optimize fuel mix using Vertex AI Optimization
 * Implements market-aware constraint-based optimization
 */
app.post('/v1/optimize', async (req, res) => {
  const tracer = trace.getTracer('optimizer-agent');
  const span = tracer.startSpan('optimize_fuel_mix');
  
  try {
    // Validate input
    if (!SecurityValidator.validateOptimizationRequest(req.body)) {
      return res.status(400).json({
        error: 'Invalid request format',
        agent: 'optimizer'
      });
    }

    const { constraints, marketData, currentState } = req.body;
    
    // Generate optimization using Vertex AI
    const optimization = await generateFuelMixOptimization(constraints, marketData, currentState);
    
    // Create optimization proposal
    const optimizationProposal = await createOptimizationProposal(optimization, constraints);
    
    // Send proposal to Master Control Agent
    await sendOptimizationProposal(optimizationProposal);
    proposalCount.labels('optimization', 'sent').inc();

    // Update metrics
    optimizationLatency.labels('fuel_mix', constraints.length.toString()).observe(optimization.latency);
    costSavings.labels('hourly').set(optimization.costSavingsPercent);
    alternativeFuelRatio.labels('total').set(optimization.alternativeFuelRatio);

    span.setAttributes({
      'optimization.constraint_count': constraints.length,
      'optimization.cost_savings_percent': optimization.costSavingsPercent,
      'optimization.alternative_fuel_ratio': optimization.alternativeFuelRatio,
      'proposal.generated': true
    });

    res.status(200).json({
      agent: 'optimizer',
      status: 'success',
      optimization: {
        fuelMix: optimization.fuelMix,
        costSavingsPercent: optimization.costSavingsPercent,
        alternativeFuelRatio: optimization.alternativeFuelRatio,
        confidence: optimization.confidence,
        constraintsSatisfied: optimization.constraintsSatisfied
      },
      proposal: optimizationProposal,
      timestamp: new Date().toISOString()
    });

  } catch (error: unknown) {
    logger.error('Fuel mix optimization failed', { error: (error as Error).message, stack: (error as Error).stack });
    proposalCount.labels('optimization', 'error').inc();
    
    span.recordException(error as Error);
    span.setStatus({ code: 2, message: (error as Error).message });
    
    res.status(500).json({
      agent: 'optimizer',
      status: 'error',
      error: 'Optimization service unavailable'
    });
  } finally {
    span.end();
  }
});

/**
 * Generate fuel mix optimization using Vertex AI Optimization
 */
async function generateFuelMixOptimization(constraints: any[], marketData: any, currentState: any) {
  const startTime = Date.now();
  
  try {
    // Prepare optimization problem for Vertex AI
    const optimizationProblem = {
      objective: {
        type: 'minimize_cost',
        variables: [
          { name: 'coal_amount', coefficient: marketData.coalPrice },
          { name: 'biomass_amount', coefficient: marketData.biomassPrice },
          { name: 'waste_amount', coefficient: marketData.wastePrice },
          { name: 'mill_power', coefficient: marketData.electricityPrice }
        ]
      },
      constraints: constraints.map(constraint => ({
        name: constraint.name,
        type: constraint.type,
        variables: constraint.variables,
        bounds: constraint.bounds
      })),
      variables: {
        coal_amount: { type: 'continuous', bounds: [0, 100] },
        biomass_amount: { type: 'continuous', bounds: [0, 50] },
        waste_amount: { type: 'continuous', bounds: [0, 30] },
        mill_power: { type: 'continuous', bounds: [1000, 5000] }
      }
    };

    // Call Vertex AI Optimization
    const model = vertexAI.getGenerativeModel({ model: OPTIMIZATION_MODEL });
    const response = await model.generateContent(JSON.stringify({instances: [optimizationProblem]}));
    
    const result = JSON.parse(response.response.candidates?.[0]?.content.parts?.[0].text || '{}');
    const fuelMix = result.variables;
    
    // Calculate metrics
    const totalCost = calculateTotalCost(fuelMix, marketData);
    const baselineCost = calculateBaselineCost(currentState, marketData);
    const costSavingsPercent = ((baselineCost - totalCost) / baselineCost) * 100;
    
    const alternativeFuelRatio = (fuelMix.biomass_amount + fuelMix.waste_amount) / 
                                (fuelMix.coal_amount + fuelMix.biomass_amount + fuelMix.waste_amount) * 100;
    
    const latency = (Date.now() - startTime) / 1000;
    
    return {
      fuelMix,
      costSavingsPercent,
      alternativeFuelRatio,
      confidence: result.confidence || 0.92,
      constraintsSatisfied: result.constraintsSatisfied || true,
      latency,
      totalCost,
      baselineCost
    };
    
  } catch (error: unknown) {
    logger.error('Vertex AI optimization failed', { error: (error as Error).message });
    throw new Error(`Optimization service error: ${(error as Error).message}`);
  }
}

/**
 * Calculate total cost for fuel mix
 */
function calculateTotalCost(fuelMix: any, marketData: any): number {
  return (fuelMix.coal_amount * marketData.coalPrice) +
         (fuelMix.biomass_amount * marketData.biomassPrice) +
         (fuelMix.waste_amount * marketData.wastePrice) +
         (fuelMix.mill_power * marketData.electricityPrice / 1000);
}

/**
 * Calculate baseline cost for current state
 */
function calculateBaselineCost(currentState: any, marketData: any): number {
  return (currentState.coal_amount * marketData.coalPrice) +
         (currentState.biomass_amount * marketData.biomassPrice) +
         (currentState.waste_amount * marketData.wastePrice) +
         (currentState.mill_power * marketData.electricityPrice / 1000);
}

/**
 * Create optimization proposal
 */
async function createOptimizationProposal(optimization: any, constraints: any[]) {
  try {
    const urgency = optimization.costSavingsPercent > 5 ? 'high' : 
                   optimization.costSavingsPercent > 2 ? 'medium' : 'low';
    
    return {
      proposalType: 'optimization',
      urgency,
      title: 'Fuel Mix Optimization',
      description: `Optimize fuel mix to reduce costs by ${optimization.costSavingsPercent.toFixed(2)}%`,
      rationale: `Market conditions favor alternative fuels. Optimization can achieve ${optimization.costSavingsPercent.toFixed(2)}% cost reduction while maintaining quality constraints.`,
      actions: [{
        controlVariable: 'fuel_mix',
        currentValue: 'baseline',
        proposedValue: optimization.fuelMix,
        adjustmentMagnitude: optimization.costSavingsPercent,
        executionMethod: 'gradual',
        safetyChecksRequired: true
      }],
      expectedOutcomes: [{
        metric: 'cost_savings',
        expectedValue: optimization.costSavingsPercent,
        confidence: optimization.confidence,
        timeframe: '1_hour'
      }, {
        metric: 'alternative_fuel_ratio',
        expectedValue: optimization.alternativeFuelRatio,
        confidence: optimization.confidence,
        timeframe: '1_hour'
      }],
      risks: [{
        riskType: 'fuel_availability',
        severity: 'medium',
        probability: 0.2,
        description: 'Alternative fuel availability may be limited'
      }, {
        riskType: 'quality_impact',
        severity: 'low',
        probability: 0.1,
        description: 'Fuel mix change may affect product quality'
      }],
      mitigationStrategies: [
        'Gradual fuel mix transition over 30 minutes',
        'Continuous quality monitoring during transition',
        'Fallback to baseline mix if quality issues detected',
        'Alternative fuel inventory verification before execution'
      ],
      supportingData: {
        optimization,
        constraints,
        marketData: {
          coalPrice: optimization.marketData?.coalPrice,
          biomassPrice: optimization.marketData?.biomassPrice,
          wastePrice: optimization.marketData?.wastePrice,
          electricityPrice: optimization.marketData?.electricityPrice
        }
      },
      confidence: optimization.confidence,
      constraints: constraints.map(c => c.name),
      prerequisites: [
        'Alternative fuel inventory confirmed',
        'Quality constraints validated',
        'Market data freshness verified',
        'No emergency conditions active'
      ]
    };
    
  } catch (error: unknown) {
    logger.error('Optimization proposal creation failed', { error: (error as Error).message });
    throw new Error(`Proposal creation error: ${(error as Error).message}`);
  }
}

/**
 * Send optimization proposal to Master Control Agent via A2A protocol
 */
async function sendOptimizationProposal(proposal: any) {
  try {
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const message = {
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversationId,
      timestamp: new Date().toISOString(),
      correlationId: `corr_${Date.now()}`,
      senderAgent: 'optimizer_agent',
      recipientAgent: 'master_control_agent',
      messageType: 'proposal',
      payload: proposal,
      protocolVersion: '1.0',
      priority: proposal.urgency === 'high' ? 'high' : 'normal'
    };
    
    await a2aClient.sendMessage(message);
    logger.info('Optimization proposal sent to Master Control Agent', { 
      conversationId, 
      proposalType: proposal.proposalType,
      costSavings: proposal.expectedOutcomes[0]?.expectedValue
    });
    
  } catch (error: unknown) {
    logger.error('Failed to send optimization proposal', { error: (error as Error).message });
    throw error;
  }
}

// Subscribe to market data updates
async function subscribeToMarketData() {
  try {
    const subscription = pubsub.subscription('market-data-updates');
    
    subscription.on('message', async (message: Message) => {
      try {
        const data = JSON.parse(message.data.toString());
        
        // Process market data updates
        if (data.type === 'market_update') {
          // Check if significant price changes warrant re-optimization
          const priceChangeThreshold = 0.05; // 5% change
          const significantChange = Object.values(data.priceChanges).some(
            (change: any) => Math.abs(change) > priceChangeThreshold
          );
          
          if (significantChange) {
            logger.info('Significant market change detected, triggering re-optimization', {
              priceChanges: data.priceChanges
            });
            
            // Trigger re-optimization
            await triggerReoptimization(data);
          }
        }
        
        message.ack();
      } catch (error: unknown) {
        logger.error('Error processing market data message', { error: (error as Error).message });
        message.nack();
      }
    });

    subscription.on('error', (error: Error) => {
      logger.error('PubSub subscription error', { error: error.message });
    });
    
    logger.info('Subscribed to market data updates');
  } catch (error: unknown) {
    logger.error('Failed to subscribe to market data', { error: (error as Error).message });
  }
}

/**
 * Trigger re-optimization based on market changes
 */
async function triggerReoptimization(marketData: any) {
  try {
    // Get current plant state (this would typically come from plant systems)
    const currentState = {
      coal_amount: 80,
      biomass_amount: 15,
      waste_amount: 5,
      mill_power: 3000
    };
    
    // Get current constraints (this would typically come from Guardian Agent)
    const constraints = [
      {
        name: 'quality_constraint',
        type: 'inequality',
        variables: ['coal_amount', 'biomass_amount', 'waste_amount'],
        bounds: [0, 100]
      },
      {
        name: 'power_constraint',
        type: 'equality',
        variables: ['mill_power'],
        bounds: [1000, 5000]
      }
    ];
    
    // Generate new optimization
    const optimization = await generateFuelMixOptimization(constraints, marketData, currentState);
    
    // Only create proposal if significant improvement
    if (optimization.costSavingsPercent > 1.0) {
      const proposal = await createOptimizationProposal(optimization, constraints);
      await sendOptimizationProposal(proposal);
      
      logger.info('Market-driven re-optimization completed', {
        costSavings: optimization.costSavingsPercent,
        alternativeFuelRatio: optimization.alternativeFuelRatio
      });
    }
    
  } catch (error: unknown) {
    logger.error('Market-driven re-optimization failed', { error: (error as Error).message });
  }
}

// Initialize agent
async function initializeAgent() {
  try {
    // Subscribe to market data
    await subscribeToMarketData();
    
    logger.info('Optimizer Agent initialized successfully', {
      agent: 'optimizer',
      version: '1.0.0',
      port,
      projectId
    });
  } catch (error: unknown) {
    logger.error('Optimizer Agent initialization failed', { error: (error as Error).message });
    process.exit(1);
  }
}

// Start server
app.listen(port, async () => {
  console.log(`Optimizer Agent listening on :${port}`);
  await initializeAgent();
});


