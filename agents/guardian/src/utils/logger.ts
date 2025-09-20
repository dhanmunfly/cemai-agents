import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';

/**
 * Structured logger for Guardian Agent
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
        agent_id: 'guardian_agent',
        version: '1.0.0',
        message,
        ...meta
      });
    })
  ),
  defaultMeta: {
    service: 'guardian-agent',
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
  prediction: (data: any) => logger.info('LSF prediction generated', { 
    event_type: 'prediction_generated',
    ...data 
  }),
  
  proposal: (data: any) => logger.info('Stability proposal created', { 
    event_type: 'proposal_created',
    ...data 
  }),
  
  error: (error: Error, context?: any) => logger.error('Guardian agent error', {
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

