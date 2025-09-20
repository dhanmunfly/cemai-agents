/**
 * Optimizer Agent Configuration Constants
 * Central configuration for fuel mix optimization and market monitoring
 */

export const OPTIMIZATION_MODEL = process.env.VERTEX_AI_ENDPOINT_ID || 
  'projects/cemai-agents/locations/us-central1/endpoints/fuel-optimization-model';

export const MARKET_DATA_TOPIC = process.env.PUBSUB_TOPIC || 'market-data-updates';
export const MARKET_SENSITIVITY_THRESHOLD = 0.05; // 5% price change threshold

export const FUEL_TYPES = {
  coal: { min: 0, max: 100, defaultPrice: 100 },
  biomass: { min: 0, max: 50, defaultPrice: 80 },
  waste: { min: 0, max: 30, defaultPrice: 60 },
  rdf: { min: 0, max: 25, defaultPrice: 70 }
};

export const MILL_POWER_LIMITS = {
  min: 1000, // kW
  max: 5000, // kW
  default: 3000
};

export const OPTIMIZATION_TARGETS = {
  costSavingsPercent: { min: 5, max: 8 }, // Target 5-8% reduction
  heatRateImprovement: { min: 3, max: 4 }, // Target 3-4% improvement
  alternativeFuelIncrease: { min: 10, max: 15 } // Target 10-15% increase
};

export const URGENCY_THRESHOLDS = {
  low: 1.0,    // <1% cost savings
  medium: 3.0,  // 1-3% cost savings
  high: 5.0,    // 3-5% cost savings
  critical: 8.0 // >5% cost savings
};

export const AGENT_CONFIG = {
  name: 'optimizer_agent',
  version: '1.0.0',
  port: process.env.PORT ? Number(process.env.PORT) : 8082,
  logLevel: process.env.LOG_LEVEL || 'INFO',
  environment: process.env.ENVIRONMENT || 'development'
};

export const PUBSUB_CONFIG = {
  subscription: process.env.PUBSUB_SUBSCRIPTION || 'optimizer-market-data-subscription',
  topics: {
    marketData: 'market-data-updates',
    alternativeFuel: 'alternative-fuel-availability',
    qualityConstraints: 'quality-constraints'
  }
};

export const MASTER_CONTROL_ENDPOINT = process.env.MASTER_CONTROL_ENDPOINT || 
  'https://master-control-agent-us-central1-cemai-agents.a.run.app';

export const OPTIMIZATION_INTERVAL_SECONDS = 300; // 5 minutes
export const MARKET_RESPONSE_TIMEOUT_SECONDS = 30;
export const CONSTRAINT_VALIDATION_TIMEOUT_SECONDS = 10;