import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';

/**
 * Structured logger for Master Control Agent
 * Implements Google Cloud Logging format with correlation IDs
 */
export const logger: Logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json(),
    format.printf(({ timestamp, level, message, ...meta }) => {
      return JSON.stringify({
        timestamp,
        severity: level.toUpperCase(),
        agent_id: 'master_control_agent',
        version: '1.0.0',
        message,
        ...meta
      });
    })
  ),
  defaultMeta: {
    service: 'master-control-agent',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    })
  ]
});

// Add correlation ID support
export function setCorrelationId(correlationId: string) {
  logger.defaultMeta = {
    ...logger.defaultMeta,
    correlation_id: correlationId
  };
}

// Structured logging helpers
export const logStructured = {
  workflow: (data: any) => logger.info('Workflow executed', { 
    event_type: 'workflow_executed',
    ...data 
  }),
  
  decision: (data: any) => logger.info('Decision made', { 
    event_type: 'decision_made',
    ...data 
  }),
  
  conflictResolution: (data: any) => logger.info('Conflict resolved', {
    event_type: 'conflict_resolved',
    ...data
  }),
  
  proposalReceived: (data: any) => logger.info('Proposal received', {
    event_type: 'proposal_received',
    ...data
  }),
  
  commandSent: (data: any) => logger.info('Command sent to Egress', {
    event_type: 'command_sent',
    ...data
  }),
  
  error: (error: Error, context?: any) => logger.error('Master Control agent error', {
    event_type: 'error',
    error: error.message,
    stack: error.stack,
    ...context
  }),
  
  security: (event: string, data: any) => logger.warn('Security event', {
    event_type: 'security_event',
    security_event: event,
    ...data
  }),
  
  performance: (operation: string, duration: number, metadata?: any) => logger.info('Performance metric', {
    event_type: 'performance_metric',
    operation,
    duration_ms: duration,
    ...metadata
  })
};

