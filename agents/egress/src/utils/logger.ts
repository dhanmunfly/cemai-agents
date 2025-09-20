import { trace } from '@opentelemetry/api';

export interface LogContext {
  [key: string]: any;
}

export class Logger {
  private serviceName: string;

  constructor(serviceName: string = 'egress-agent') {
    this.serviceName = serviceName;
  }

  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const traceId = trace.getActiveSpan()?.spanContext().traceId || 'no-trace';
    const spanId = trace.getActiveSpan()?.spanContext().spanId || 'no-span';
    
    const logEntry = {
      timestamp,
      level,
      service: this.serviceName,
      message,
      traceId,
      spanId,
      ...context
    };

    return JSON.stringify(logEntry);
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatMessage('INFO', message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('WARN', message, context));
  }

  error(message: string, context?: LogContext): void {
    console.error(this.formatMessage('ERROR', message, context));
  }

  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('DEBUG', message, context));
    }
  }
}

export const logger = new Logger('egress-agent');
