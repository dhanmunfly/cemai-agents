/**
 * Guardian Agent Configuration Constants
 * Central configuration for LSF prediction and stability monitoring
 */

export const LSF_PREDICTION_MODEL = process.env.VERTEX_AI_ENDPOINT_ID || 
  'projects/cemai-agents/locations/us-central1/endpoints/lsf-forecasting-model';

export const QUALITY_BAND_TOLERANCE = 2.0; // ±2% from target LSF
export const TARGET_LSF = 100.0;
export const QUALITY_BAND_MIN = TARGET_LSF - QUALITY_BAND_TOLERANCE; // 98.0
export const QUALITY_BAND_MAX = TARGET_LSF + QUALITY_BAND_TOLERANCE; // 102.0

export const PREDICTION_HORIZON_MINUTES = 60;
export const CONFIDENCE_THRESHOLD = 0.85;
export const MIN_ADJUSTMENT_THRESHOLD = 0.05; // Minimum effective action threshold

export const CONTROL_VARIABLES = {
  kiln_speed: { min: 2.8, max: 4.2, step: 0.1 },
  fuel_flow: { min: 4.5, max: 6.8, step: 0.05 },
  feed_rate: { min: 180, max: 220, step: 1.0 },
  preheater_temp: { min: 850, max: 950, step: 5 }
};

export const URGENCY_THRESHOLDS = {
  low: 0.5,    // <0.5% deviation
  medium: 1.0,  // 0.5-1.0% deviation
  high: 1.5,    // 1.0-1.5% deviation
  critical: 2.0 // >1.5% deviation
};

export const AGENT_CONFIG = {
  name: 'guardian_agent',
  version: '1.0.0',
  port: process.env.PORT ? Number(process.env.PORT) : 8081,
  logLevel: process.env.LOG_LEVEL || 'INFO',
  environment: process.env.ENVIRONMENT || 'development'
};

export const PUBSUB_CONFIG = {
  subscription: process.env.PUBSUB_SUBSCRIPTION || 'guardian-data-subscription',
  topic: process.env.PUBSUB_TOPIC || 'plant-sensor-data'
};

export const ALLOYDB_CONFIG = {
  clusterId: process.env.ALLOYDB_CLUSTER_ID || 'cemai-cluster',
  database: process.env.ALLOYDB_DATABASE || 'cemai_db',
  connectionString: process.env.ALLOYDB_CONNECTION_STRING
};

export const MASTER_CONTROL_ENDPOINT = process.env.MASTER_CONTROL_ENDPOINT || 
  'https://master-control-agent-us-central1-cemai-agents.a.run.app';

export const PREDICTION_INTERVAL_SECONDS = 30;
export const QUALITY_BAND_BUFFER = 0.1;