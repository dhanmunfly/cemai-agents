import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';

/**
 * Structured logger for Optimizer Agent
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
        agent_id: 'optimizer_agent',
        version: '1.0.0',
        message,
        ...meta
      });
    })
  ),
  defaultMeta: {
    service: 'optimizer-agent',
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
  optimization: (data: any) => logger.info('Fuel mix optimization completed', { 
    event_type: 'optimization_completed',
    ...data 
  }),
  
  proposal: (data: any) => logger.info('Optimization proposal created', { 
    event_type: 'proposal_created',
    ...data 
  }),
  
  marketUpdate: (data: any) => logger.info('Market data update received', {
    event_type: 'market_update',
    ...data
  }),
  
  reoptimization: (data: any) => logger.info('Market-driven re-optimization triggered', {
    event_type: 'reoptimization_triggered',
    ...data
  }),
  
  error: (error: Error, context?: any) => logger.error('Optimizer agent error', {
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

