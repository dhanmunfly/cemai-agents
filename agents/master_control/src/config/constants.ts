/**
 * Master Control Agent Configuration Constants
 * Central configuration for workflow orchestration and decision making
 */

export const DECISION_TIMEOUT_MS = 60000; // 60 seconds SLA
export const CONFLICT_RESOLUTION_TIMEOUT_MS = 30000; // 30 seconds
export const DECISION_CACHE_TTL_SECONDS = 300; // 5 minutes

export const GEMINI_MODEL_NAME = 'gemini-2.5-pro';
export const GEMINI_ENDPOINT = process.env.GEMINI_ENDPOINT || 
  'projects/cemai-agents/locations/us-central1/endpoints/gemini-reasoning';

export const DECISION_CONSTITUTION = {
  priorities: [
    { level: 1, objective: 'Safety', description: 'Ensure plant and personnel safety' },
    { level: 2, objective: 'Quality', description: 'Maintain product quality specifications' },
    { level: 3, objective: 'Emissions', description: 'Minimize environmental impact' },
    { level: 4, objective: 'Cost', description: 'Optimize operational costs' }
  ],
  
  conflictResolutionRules: [
    'Safety always takes precedence over all other objectives',
    'Quality constraints cannot be violated for cost optimization',
    'Emissions reductions should be pursued when cost-neutral',
    'Cost optimization is acceptable within safety and quality bounds'
  ],
  
  decisionProcess: [
    'Summarize and verify all proposals and their goals',
    'Identify explicit conflicts between proposals',
    'Evaluate conflicts against constitutional priorities',
    'Synthesize compromise solution respecting higher priorities',
    'Document reasoning for audit trail'
  ]
};

export const WORKFLOW_STATUS = {
  INITIALIZING: 'initializing',
  COLLECTING: 'collecting',
  ANALYZING: 'analyzing',
  RESOLVING: 'resolving',
  DECIDING: 'deciding',
  EXECUTING: 'executing',
  COMPLETED: 'completed',
  ERROR: 'error'
} as const;

export const AGENT_CONFIG = {
  name: 'master_control_agent',
  version: '1.0.0',
  port: process.env.PORT ? Number(process.env.PORT) : 8083,
  logLevel: process.env.LOG_LEVEL || 'INFO',
  environment: process.env.ENVIRONMENT || 'development'
};

export const ALLOYDB_CONFIG = {
  clusterId: process.env.ALLOYDB_CLUSTER_ID || 'cemai-cluster',
  database: process.env.ALLOYDB_DATABASE || 'cemai_db',
  connectionString: process.env.ALLOYDB_CONNECTION_STRING
};

export const PUBSUB_CONFIG = {
  topics: {
    agentCommunication: 'agent-communication',
    workflowTriggers: 'workflow-triggers',
    emergencyEvents: 'emergency-events'
  },
  subscriptions: {
    agentProposals: 'agent-proposals-subscription',
    workflowTriggers: 'workflow-triggers-subscription',
    emergencyEvents: 'emergency-events-subscription'
  }
};

export const SPECIALIST_AGENTS = {
  guardian: {
    name: 'guardian_agent',
    endpoint: process.env.GUARDIAN_ENDPOINT || 'https://guardian-agent-us-central1-cemai-agents.a.run.app',
    capabilities: ['stability_monitoring', 'quality_prediction', 'minimal_action_calculation']
  },
  optimizer: {
    name: 'optimizer_agent',
    endpoint: process.env.OPTIMIZER_ENDPOINT || 'https://optimizer-agent-us-central1-cemai-agents.a.run.app',
    capabilities: ['fuel_optimization', 'cost_calculation', 'market_analysis']
  },
  egress: {
    name: 'egress_agent',
    endpoint: process.env.EGRESS_ENDPOINT || 'https://egress-agent-us-central1-cemai-agents.a.run.app',
    capabilities: ['command_execution', 'opcua_communication', 'plant_control']
  }
};

export const PERFORMANCE_TARGETS = {
  decisionLatencySeconds: 60,
  conflictResolutionRate: 0.95,
  proposalAcceptanceRate: 0.95,
  workflowCompletionRate: 0.99,
  constitutionalComplianceRate: 1.0
};