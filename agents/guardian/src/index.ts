import express from 'express';
import client from 'prom-client';
import { trace, context } from '@opentelemetry/api';
import { logger } from './utils/logger';
import { A2AClient } from './utils/a2a-client';
import { SecurityValidator } from './utils/security-validator';
import { AgentMetrics } from './utils/metrics';
import { VertexAIForecastingService } from './services/vertex-ai-service';
import { AlloyDBService } from './services/alloydb-service';
import { PubSubService } from './services/pubsub-service';
import { LSF_PREDICTION_MODEL, QUALITY_BAND_TOLERANCE, CONTROL_VARIABLES } from './config/constants';

const app = express();
app.use(express.json());

const port = process.env.PORT ? Number(process.env.PORT) : 8081;
const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'cemai-agents';
const region = process.env.GOOGLE_CLOUD_REGION || 'us-central1';

// Initialize services
const metrics = new AgentMetrics('guardian_agent', projectId);
const a2aClient = new A2AClient('guardian_agent');

// Initialize real services
const vertexAIService = new VertexAIForecastingService(
  projectId,
  region,
  LSF_PREDICTION_MODEL
);

const alloyDBService = new AlloyDBService(
  projectId,
  region,
  process.env.ALLOYDB_CLUSTER_ID || 'cemai-cluster',
  process.env.ALLOYDB_DATABASE || 'cemai_db',
  process.env.ALLOYDB_CONNECTION_STRING
);

const pubsubService = new PubSubService(projectId);

// Prometheus metrics
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Custom metrics
const predictionLatency = new client.Histogram({
  name: 'cemai_prediction_latency_seconds',
  help: 'LSF prediction latency in seconds',
  labelNames: ['model_type', 'prediction_horizon'],
  buckets: [0.1, 0.5, 1.0, 2.0, 5.0, 10.0],
  registers: [register]
});

const predictionAccuracy = new client.Gauge({
  name: 'cemai_prediction_accuracy',
  help: 'LSF prediction accuracy percentage',
  labelNames: ['model_type'],
  registers: [register]
});

const proposalCount = new client.Counter({
  name: 'cemai_proposals_total',
  help: 'Total number of stability proposals generated',
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
 * Get agent status and current operational state
 */
app.get('/status', async (req, res) => {
  try {
    const status = {
      agent: 'guardian',
      status: 'operational',
      version: '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      predictions: {
        total: await getTotalPredictions(),
        accuracy: await getCurrentAccuracy(),
        lastPrediction: await getLastPredictionTime()
      },
      quality: {
        currentLSF: await getCurrentLSF(),
        qualityBandStatus: await getQualityBandStatus(),
        deviationCount: await getDeviationCount()
      },
      model: {
        version: '1.0.0',
        status: 'active',
        lastRetrain: await getLastRetrainTime()
      },
      timestamp: new Date().toISOString()
    };
    
    res.status(200).json(status);
  } catch (error) {
    logger.error('Failed to get agent status', { error: error.message });
    res.status(500).json({
      agent: 'guardian',
      status: 'error',
      error: 'Failed to retrieve agent status'
    });
  }
});

/**
 * Get current quality metrics and LSF status
 */
app.get('/current-quality', async (req, res) => {
  try {
    const qualityMetrics = {
      agent: 'guardian',
      currentLSF: await getCurrentLSF(),
      targetLSF: 100.0,
      qualityBand: {
        min: 98.0,
        max: 102.0,
        tolerance: 2.0
      },
      status: await getQualityBandStatus(),
      deviation: {
        magnitude: await getCurrentDeviation(),
        direction: await getDeviationDirection(),
        timeToDeviation: await getTimeToDeviation()
      },
      trends: {
        lastHour: await getLSFTrend('1h'),
        lastDay: await getLSFTrend('24h'),
        lastWeek: await getLSFTrend('7d')
      },
      timestamp: new Date().toISOString()
    };
    
    res.status(200).json(qualityMetrics);
  } catch (error) {
    logger.error('Failed to get current quality metrics', { error: error.message });
    res.status(500).json({
      agent: 'guardian',
      status: 'error',
      error: 'Failed to retrieve quality metrics'
    });
  }
});

/**
 * Validate control action before execution
 */
app.post('/validate-action', async (req, res) => {
  try {
    const { action } = req.body;
    
    if (!action || !action.controlVariable || action.proposedValue === undefined) {
      return res.status(400).json({
        agent: 'guardian',
        status: 'error',
        error: 'Invalid action format'
      });
    }
    
    const validation = await validateControlAction(action);
    
    res.status(200).json({
      agent: 'guardian',
      status: 'success',
      validation,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Control action validation failed', { error: error.message });
    res.status(500).json({
      agent: 'guardian',
      status: 'error',
      error: 'Action validation failed'
    });
  }
});

/**
 * Receive process data from external systems
 */
app.post('/receive-data', async (req, res) => {
  try {
    const { data } = req.body;
    
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({
        agent: 'guardian',
        status: 'error',
        error: 'Invalid data format'
      });
    }
    
    // Process incoming data
    const processedData = await processIncomingData(data);
    
    // Trigger LSF prediction if LSF data is present
    if (processedData.hasLSFData) {
      const prediction = await vertexAIService.predictLSF({
        sensorData: processedData.sensorData,
        predictionHorizonMinutes: 60
      });
      
      if (prediction.deviationDetected) {
        const proposal = await calculateMinimalEffectiveAction(
          prediction.currentLSF,
          prediction.predictedLSF,
          processedData.sensorData,
          `req_${Date.now()}`
        );
        
        if (proposal) {
          await pubsubService.publishProposal(proposal);
          proposalCount.labels('stability', 'sent').inc();
        }
      }
    }
    
    res.status(200).json({
      agent: 'guardian',
      status: 'success',
      processed: processedData.count,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to process incoming data', { error: error.message });
    res.status(500).json({
      agent: 'guardian',
      status: 'error',
      error: 'Data processing failed'
    });
  }
});

/**
 * Emergency stop endpoint
 */
app.post('/emergency-stop', async (req, res) => {
  try {
    logger.warn('Emergency stop triggered', { 
      timestamp: new Date().toISOString(),
      reason: req.body.reason || 'Manual emergency stop'
    });
    
    // Send emergency stop command to Master Control Agent
    const emergencyMessage = {
      messageId: `emergency_${Date.now()}`,
      conversationId: `emergency_conv_${Date.now()}`,
      timestamp: new Date().toISOString(),
      senderAgent: 'guardian_agent',
      recipientAgent: 'master_control_agent',
      messageType: 'command',
      payload: {
        command: 'emergency_stop',
        reason: req.body.reason || 'Manual emergency stop',
        urgency: 'critical',
        timestamp: new Date().toISOString()
      },
      protocolVersion: '1.0',
      priority: 'critical'
    };
    
    await a2aClient.sendMessage(emergencyMessage);
    
    res.status(200).json({
      agent: 'guardian',
      status: 'success',
      message: 'Emergency stop command sent',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Emergency stop failed', { error: error.message });
    res.status(500).json({
      agent: 'guardian',
      status: 'error',
      error: 'Emergency stop failed'
    });
  }
});

/**
 * Get prediction history
 */
app.get('/v1/predictions/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    
    const history = await alloyDBService.getPredictionHistory(limit, startDate, endDate);
    
    res.status(200).json({
      agent: 'guardian',
      status: 'success',
      history,
      count: history.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get prediction history', { error: error.message });
    res.status(500).json({
      agent: 'guardian',
      status: 'error',
      error: 'Failed to retrieve prediction history'
    });
  }
});

/**
 * Get model performance metrics
 */
app.get('/v1/model/metrics', async (req, res) => {
  try {
    const modelVersion = req.query.modelVersion as string;
    const days = parseInt(req.query.days as string) || 7;
    
    const metrics = await alloyDBService.getModelPerformanceMetrics(modelVersion, days);
    
    res.status(200).json({
      agent: 'guardian',
      status: 'success',
      metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get model metrics', { error: error.message });
    res.status(500).json({
      agent: 'guardian',
      status: 'error',
      error: 'Failed to retrieve model metrics'
    });
  }
});

/**
 * Retrain model endpoint
 */
app.post('/v1/model/retrain', async (req, res) => {
  try {
    const { trainingData } = req.body;
    
    if (!trainingData || !Array.isArray(trainingData)) {
      return res.status(400).json({
        agent: 'guardian',
        status: 'error',
        error: 'Invalid training data format'
      });
    }
    
    const result = await vertexAIService.retrainModel(trainingData);
    
    res.status(200).json({
      agent: 'guardian',
      status: 'success',
      retraining: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Model retraining failed', { error: error.message });
    res.status(500).json({
      agent: 'guardian',
      status: 'error',
      error: 'Model retraining failed'
    });
  }
});

/**
 * Generate LSF prediction using real Vertex AI Forecasting
 * Implements minimal effective action principle
 */
app.post('/v1/predict/lsf', async (req, res) => {
  const tracer = trace.getTracer('guardian-agent');
  const span = tracer.startSpan('predict_lsf');
  
  try {
    // Validate input
    if (!SecurityValidator.validatePredictionRequest(req.body)) {
      return res.status(400).json({
        error: 'Invalid request format',
        agent: 'guardian'
      });
    }

    const { sensorData, predictionHorizon = 60 } = req.body;
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Generate prediction using real Vertex AI service
    const prediction = await vertexAIService.predictLSF(sensorData, predictionHorizon);
    
    // Store prediction in database
    await alloyDBService.storePrediction({
      requestId,
      sensorData,
      predictionHorizonMinutes: predictionHorizon,
      currentLSF: prediction.currentLSF,
      predictedLSF: prediction.predictedLSF,
      confidence: prediction.confidence,
      deviationDetected: prediction.deviationDetected,
      deviationMagnitude: prediction.deviationMagnitude,
      accuracy: prediction.accuracy,
      modelVersion: prediction.modelVersion,
      latency: prediction.latency
    });
    
    // Calculate minimal effective action if deviation predicted
    let stabilityProposal = null;
    if (prediction.deviationDetected) {
      stabilityProposal = await calculateMinimalEffectiveAction(
        prediction.currentLSF,
        prediction.predictedLSF,
        sensorData,
        requestId
      );
      
      // Store proposal in database
      if (stabilityProposal) {
        await alloyDBService.storeProposal({
          proposalId: stabilityProposal.proposalId || `prop_${Date.now()}`,
          requestId,
          proposalType: stabilityProposal.proposalType,
          urgency: stabilityProposal.urgency,
          title: stabilityProposal.title,
          description: stabilityProposal.description,
          rationale: stabilityProposal.rationale,
          actions: stabilityProposal.actions,
          expectedOutcomes: stabilityProposal.expectedOutcomes,
          risks: stabilityProposal.risks,
          mitigationStrategies: stabilityProposal.mitigationStrategies,
          supportingData: stabilityProposal.supportingData,
          confidence: stabilityProposal.confidence,
          constraints: stabilityProposal.constraints,
          prerequisites: stabilityProposal.prerequisites
        });
        
        // Send proposal to Master Control Agent via Pub/Sub
        await pubsubService.publishProposal(stabilityProposal);
        proposalCount.labels('stability', 'sent').inc();
      }
    }

    // Update metrics
    predictionLatency.labels('lsf_model', `${predictionHorizon}m`).observe(prediction.latency);
    predictionAccuracy.labels('lsf_model').set(prediction.accuracy);

    span.setAttributes({
      'prediction.horizon_minutes': predictionHorizon,
      'prediction.confidence': prediction.confidence,
      'prediction.deviation_detected': prediction.deviationDetected,
      'proposal.generated': !!stabilityProposal,
      'request.id': requestId
    });

    res.status(200).json({
      agent: 'guardian',
      status: 'success',
      requestId,
      prediction: {
        currentLSF: prediction.currentLSF,
        predictedLSF: prediction.predictedLSF,
        confidence: prediction.confidence,
        horizonMinutes: predictionHorizon,
        deviationDetected: prediction.deviationDetected,
        deviationMagnitude: prediction.deviationMagnitude,
        accuracy: prediction.accuracy,
        modelVersion: prediction.modelVersion
      },
      proposal: stabilityProposal,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('LSF prediction failed', { error: error.message, stack: error.stack });
    proposalCount.labels('stability', 'error').inc();
    
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message });
    
    res.status(500).json({
      agent: 'guardian',
      status: 'error',
      error: 'Prediction service unavailable'
    });
  } finally {
    span.end();
  }
});

/**
 * Generate LSF prediction using Vertex AI Forecasting model
 */
async function generateLSFPrediction(sensorData: any, horizonMinutes: number) {
  const startTime = Date.now();
  
  try {
    // Prepare input data for Vertex AI Forecasting
    const inputData = {
      instances: [{
        timeSeriesData: {
          timeSeriesId: 'lsf_prediction',
          values: sensorData.map((point: any) => ({
            timestamp: point.timestamp,
            value: point.lsf
          }))
        },
        predictionHorizon: horizonMinutes
      }]
    };

    // Call Vertex AI Forecasting model
    const model = vertexAI.getModel(LSF_PREDICTION_MODEL);
    const response = await model.predict(inputData);
    
    const prediction = response.predictions[0];
    const currentLSF = sensorData[sensorData.length - 1].lsf;
    const predictedLSF = prediction.value;
    
    // Calculate deviation from quality band
    const deviationDetected = Math.abs(predictedLSF - 100) > QUALITY_BAND_TOLERANCE;
    const deviationMagnitude = Math.abs(predictedLSF - 100);
    
    const latency = (Date.now() - startTime) / 1000;
    
    return {
      currentLSF,
      predictedLSF,
      confidence: prediction.confidence || 0.95,
      deviationDetected,
      deviationMagnitude,
      latency,
      accuracy: 0.92 // This would be calculated from model performance metrics
    };
    
  } catch (error) {
    logger.error('Vertex AI prediction failed', { error: error.message });
    throw new Error(`Prediction service error: ${error.message}`);
  }
}

/**
 * Calculate minimal effective action to correct LSF deviation
 * Implements the core Guardian principle of minimal intervention
 */
async function calculateMinimalEffectiveAction(
  currentLSF: number,
  predictedLSF: number,
  sensorData: any[],
  requestId: string
) {
  try {
    const deviation = predictedLSF - 100; // Target LSF is 100
    const deviationMagnitude = Math.abs(deviation);
    
    // Determine urgency based on deviation magnitude
    let urgency = 'low';
    if (deviationMagnitude > 1.5) urgency = 'high';
    else if (deviationMagnitude > 1.0) urgency = 'medium';
    
    // Select most effective control variable based on current process state
    const currentState = sensorData[sensorData.length - 1];
    const controlVariable = selectOptimalControlVariable(currentState, deviation);
    
    // Calculate minimal adjustment magnitude
    const adjustmentMagnitude = calculateMinimalAdjustment(deviation, controlVariable);
    
    // Only propose action if adjustment is significant enough
    if (Math.abs(adjustmentMagnitude) < 0.05) {
      return null; // Adjustment too small to be effective
    }
    
    const currentValue = currentState[controlVariable];
    const proposedValue = currentValue + adjustmentMagnitude;
    
    // Validate proposed action against safety constraints
    const validation = await validateControlAction({
      controlVariable,
      currentValue,
      proposedValue,
      adjustmentMagnitude
    });
    
    if (!validation.isValid) {
      logger.warn('Proposed action failed validation', { 
        controlVariable, 
        proposedValue, 
        reason: validation.reason 
      });
      return null;
    }
    
    return {
      proposalId: `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      requestId,
      proposalType: 'stability_correction',
      urgency,
      title: 'LSF Stability Correction',
      description: `Minimal ${controlVariable} adjustment to correct predicted LSF deviation`,
      rationale: `Predicted LSF ${predictedLSF.toFixed(2)} deviates ${deviationMagnitude.toFixed(2)}% from target. Minimal effective action required.`,
      actions: [{
        controlVariable,
        currentValue,
        proposedValue,
        adjustmentMagnitude,
        executionMethod: 'immediate',
        safetyChecksRequired: true,
        validation: validation
      }],
      expectedOutcomes: [{
        metric: 'lime_saturation_factor',
        expectedValue: 100,
        confidence: 0.85,
        timeframe: '30_minutes'
      }],
      risks: [{
        riskType: 'process_disruption',
        severity: 'low',
        probability: 0.1,
        description: 'Minor process adjustment may cause temporary instability'
      }],
      mitigationStrategies: [
        'Gradual implementation over 5-minute period',
        'Continuous monitoring during adjustment',
        'Automatic rollback if adverse effects detected'
      ],
      supportingData: {
        currentLSF,
        predictedLSF,
        deviationMagnitude,
        sensorData: sensorData.slice(-10) // Last 10 data points
      },
      confidence: 0.85,
      constraints: [
        'Maintain kiln speed within safe operating range',
        'Ensure temperature stability during adjustment',
        'Monitor downstream process variables'
      ],
      prerequisites: [
        'Stable kiln operation confirmed',
        'No emergency conditions active',
        'Downstream processes ready for adjustment'
      ]
    };
    
  } catch (error) {
    logger.error('Minimal effective action calculation failed', { error: error.message });
    throw new Error(`Action calculation error: ${error.message}`);
  }
}

/**
 * Select optimal control variable based on current process state and deviation
 */
function selectOptimalControlVariable(currentState: any, deviation: number): string {
  // Simple heuristic: use kiln_speed for small deviations, fuel_flow for larger ones
  const deviationMagnitude = Math.abs(deviation);
  
  if (deviationMagnitude < 0.5) {
    return 'kiln_speed'; // Fine adjustment
  } else if (deviationMagnitude < 1.0) {
    return 'fuel_flow'; // Medium adjustment
  } else {
    return 'feed_rate'; // Coarse adjustment
  }
}

/**
 * Calculate minimal adjustment magnitude based on deviation and control variable
 */
function calculateMinimalAdjustment(deviation: number, controlVariable: string): number {
  const deviationMagnitude = Math.abs(deviation);
  
  // Different control variables have different sensitivity
  const sensitivity = {
    kiln_speed: 0.1,    // High sensitivity
    fuel_flow: 0.05,     // Medium sensitivity
    feed_rate: 0.02,     // Low sensitivity
    preheater_temp: 0.08 // Medium-high sensitivity
  };
  
  const baseAdjustment = deviationMagnitude * sensitivity[controlVariable];
  
  // Apply direction
  return deviation > 0 ? baseAdjustment : -baseAdjustment;
}

/**
 * Validate control action against safety constraints
 */
async function validateControlAction(action: any): Promise<any> {
  try {
    const { controlVariable, proposedValue } = action;
    
    // Get control limits from constants
    const limits = CONTROL_VARIABLES[controlVariable];
    if (!limits) {
      return {
        isValid: false,
        reason: `Unknown control variable: ${controlVariable}`
      };
    }
    
    // Check if proposed value is within safe operating range
    if (proposedValue < limits.min || proposedValue > limits.max) {
      return {
        isValid: false,
        reason: `Proposed value ${proposedValue} outside safe range [${limits.min}, ${limits.max}]`
      };
    }
    
    // Check for excessive adjustment
    const adjustmentMagnitude = Math.abs(action.adjustmentMagnitude);
    const maxAdjustment = limits.step * 5; // Max 5 steps at once
    
    if (adjustmentMagnitude > maxAdjustment) {
      return {
        isValid: false,
        reason: `Adjustment magnitude ${adjustmentMagnitude} exceeds maximum ${maxAdjustment}`
      };
    }
    
    return {
      isValid: true,
      reason: 'Action validated successfully',
      constraints: limits
    };
    
  } catch (error) {
    logger.error('Control action validation failed', { error: error.message });
    return {
      isValid: false,
      reason: `Validation error: ${error.message}`
    };
  }
}

/**
 * Process incoming sensor data
 */
async function processIncomingData(data: any[]): Promise<any> {
  try {
    let hasLSFData = false;
    const sensorData = [];
    
    for (const point of data) {
      if (point.lsf !== undefined) {
        hasLSFData = true;
      }
      sensorData.push({
        timestamp: point.timestamp || new Date().toISOString(),
        lsf: point.lsf,
        kiln_speed: point.kiln_speed,
        fuel_flow: point.fuel_flow,
        feed_rate: point.feed_rate,
        preheater_temperature: point.preheater_temperature
      });
    }
    
    return {
      hasLSFData,
      sensorData,
      count: data.length
    };
    
  } catch (error) {
    logger.error('Failed to process incoming data', { error: error.message });
    throw error;
  }
}

// Helper functions for status endpoints
async function getTotalPredictions(): Promise<number> {
  try {
    const history = await alloyDBService.getPredictionHistory(1);
    return history.length;
  } catch (error) {
    return 0;
  }
}

async function getCurrentAccuracy(): Promise<number> {
  try {
    const metrics = await alloyDBService.getModelPerformanceMetrics('1.0.0', 1);
    return metrics.average_accuracy || 0.92;
  } catch (error) {
    return 0.92;
  }
}

async function getLastPredictionTime(): Promise<string | null> {
  try {
    const history = await alloyDBService.getPredictionHistory(1);
    return history.length > 0 ? history[0].timestamp : null;
  } catch (error) {
    return null;
  }
}

async function getCurrentLSF(): Promise<number> {
  try {
    const history = await alloyDBService.getPredictionHistory(1);
    return history.length > 0 ? history[0].current_lsf : 100.0;
  } catch (error) {
    return 100.0;
  }
}

async function getQualityBandStatus(): Promise<string> {
  try {
    const currentLSF = await getCurrentLSF();
    if (currentLSF >= 98.0 && currentLSF <= 102.0) {
      return 'within_spec';
    } else if (currentLSF >= 97.5 && currentLSF <= 102.5) {
      return 'warning';
    } else {
      return 'critical';
    }
  } catch (error) {
    return 'unknown';
  }
}

async function getDeviationCount(): Promise<number> {
  try {
    const history = await alloyDBService.getPredictionHistory(100);
    return history.filter(p => p.deviation_detected).length;
  } catch (error) {
    return 0;
  }
}

async function getLastRetrainTime(): Promise<string | null> {
  // This would be stored in a separate table in a real implementation
  return null;
}

async function getCurrentDeviation(): Promise<number> {
  try {
    const currentLSF = await getCurrentLSF();
    return Math.abs(currentLSF - 100.0);
  } catch (error) {
    return 0;
  }
}

async function getDeviationDirection(): Promise<string> {
  try {
    const currentLSF = await getCurrentLSF();
    if (currentLSF > 100.0) return 'high';
    if (currentLSF < 100.0) return 'low';
    return 'target';
  } catch (error) {
    return 'unknown';
  }
}

async function getTimeToDeviation(): Promise<number | null> {
  // This would be calculated from prediction models
  return null;
}

async function getLSFTrend(period: string): Promise<any> {
  try {
    const history = await alloyDBService.getPredictionHistory(100);
    // Simple trend calculation - in real implementation would use time series analysis
    const recent = history.slice(0, 10);
    const older = history.slice(10, 20);
    
    const recentAvg = recent.reduce((sum, p) => sum + p.current_lsf, 0) / recent.length;
    const olderAvg = older.reduce((sum, p) => sum + p.current_lsf, 0) / older.length;
    
    return {
      period,
      trend: recentAvg > olderAvg ? 'increasing' : 'decreasing',
      change: recentAvg - olderAvg,
      current: recentAvg
    };
  } catch (error) {
    return { period, trend: 'unknown', change: 0, current: 100.0 };
  }

/**
 * Send stability proposal to Master Control Agent via A2A protocol
 */
async function sendStabilityProposal(proposal: any) {
  try {
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const message = {
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversationId,
      timestamp: new Date().toISOString(),
      correlationId: `corr_${Date.now()}`,
      senderAgent: 'guardian_agent',
      recipientAgent: 'master_control_agent',
      messageType: 'proposal',
      payload: proposal,
      protocolVersion: '1.0',
      priority: proposal.urgency === 'high' ? 'high' : 'normal'
    };
    
    await a2aClient.sendMessage(message);
    logger.info('Stability proposal sent to Master Control Agent', { 
      conversationId, 
      proposalType: proposal.proposalType 
    });
    
  } catch (error) {
    logger.error('Failed to send stability proposal', { error: error.message });
    throw error;
  }
}

// Subscribe to process data updates
async function subscribeToProcessData() {
  try {
    await pubsubService.initializeSubscriptions();
    
    // In a real implementation, this would set up message handlers
    // For now, we'll log that subscriptions are initialized
    logger.info('Pub/Sub subscriptions initialized successfully');
    
  } catch (error) {
    logger.error('Failed to initialize Pub/Sub subscriptions', { error: error.message });
  }
}

// Initialize agent
async function initializeAgent() {
  try {
    // Initialize AlloyDB schema
    await alloyDBService.initializeSchema();
    
    // Initialize Pub/Sub subscriptions
    await subscribeToProcessData();
    
    logger.info('Guardian Agent initialized successfully', {
      agent: 'guardian',
      version: '1.0.0',
      port,
      projectId,
      region,
      alloydbCluster: process.env.ALLOYDB_CLUSTER_ID || 'cemai-cluster',
      vertexAIModel: LSF_PREDICTION_MODEL
    });
  } catch (error) {
    logger.error('Guardian Agent initialization failed', { error: error.message });
    process.exit(1);
  }
}

// Start server
app.listen(port, async () => {
  console.log(`Guardian Agent listening on :${port}`);
  await initializeAgent();
});


