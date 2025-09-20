/**
 * Egress Agent Configuration Constants
 * Central configuration for OPC-UA communication and plant control
 */

export const OPCUA_CONFIG = {
  endpoint: process.env.OPCUA_ENDPOINT || 'opc.tcp://localhost:4840',
  connectionTimeout: 10000, // 10 seconds
  reconnectInterval: 30000, // 30 seconds
  maxConcurrentCommands: 5,
  commandRateLimit: 10, // commands per minute
  commandTimeout: 30000 // 30 seconds
};

export const PLANT_SYSTEMS = {
  kiln: {
    name: 'kiln_system',
    variables: ['kiln_speed', 'kiln_temperature', 'fuel_flow'],
    safetyLimits: {
      kiln_speed: { min: 2.8, max: 4.2 },
      kiln_temperature: { min: 1400, max: 1500 },
      fuel_flow: { min: 4.5, max: 6.8 }
    }
  },
  mill: {
    name: 'mill_system',
    variables: ['mill_speed', 'mill_power', 'feed_rate'],
    safetyLimits: {
      mill_speed: { min: 15, max: 25 },
      mill_power: { min: 1000, max: 5000 },
      feed_rate: { min: 180, max: 220 }
    }
  },
  preheater: {
    name: 'preheater_system',
    variables: ['preheater_temperature', 'gas_flow'],
    safetyLimits: {
      preheater_temperature: { min: 850, max: 950 },
      gas_flow: { min: 100, max: 200 }
    }
  }
};

export const COMMAND_TYPES = {
  SETPOINT_CHANGE: 'setpoint_change',
  EMERGENCY_STOP: 'emergency_stop',
  PARAMETER_UPDATE: 'parameter_update',
  SYSTEM_RESET: 'system_reset'
};

export const SAFETY_CHECKS = {
  required: true,
  timeout: 5000, // 5 seconds
  validations: [
    'equipment_limits',
    'process_constraints',
    'emergency_conditions',
    'communication_status'
  ]
};

export const AGENT_CONFIG = {
  name: 'egress_agent',
  version: '1.0.0',
  port: process.env.PORT ? Number(process.env.PORT) : 8084,
  logLevel: process.env.LOG_LEVEL || 'INFO',
  environment: process.env.ENVIRONMENT || 'development'
};

export const MASTER_CONTROL_ENDPOINT = process.env.MASTER_CONTROL_ENDPOINT || 
  'https://master-control-agent-us-central1-cemai-agents.a.run.app';

export const EMERGENCY_PROCEDURES = {
  emergencyStopTimeout: 1000, // 1 second
  rollbackTimeout: 5000, // 5 seconds
  notificationChannels: ['master_control', 'plant_operators', 'maintenance']
};

export const CONNECTION_MONITORING = {
  healthCheckInterval: 10000, // 10 seconds
  connectionRetryAttempts: 3,
  connectionRetryDelay: 5000 // 5 seconds
};

export const COMMAND_VALIDATION = {
  maxAdjustmentPercent: 10, // Maximum 10% adjustment per command
  minAdjustmentThreshold: 0.1, // Minimum adjustment to be effective
  validationTimeout: 2000 // 2 seconds
};