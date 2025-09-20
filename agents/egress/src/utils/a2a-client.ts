import { trace, Span } from '@opentelemetry/api';
import { logger } from './logger';

export interface A2AMessage {
  messageId: string;
  conversationId: string;
  timestamp: string;
  correlationId?: string;
  senderAgent: string;
  recipientAgent: string;
  messageType: 'proposal' | 'decision' | 'status' | 'data' | 'command';
  payload: any;
  protocolVersion: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  authorization?: string;
}

export class A2AClient {
  private agentName: string;
  private tracer = trace.getTracer('egress-agent');

  constructor(agentName: string) {
    this.agentName = agentName;
  }

  startSpan(name: string): Span {
    return this.tracer.startSpan(name);
  }

  async sendMessage(message: A2AMessage): Promise<void> {
    const span = this.startSpan('send_a2a_message');
    
    try {
      // In a real implementation, this would send the message via HTTP or Pub/Sub
      logger.info('A2A message sent', {
        messageId: message.messageId,
        recipientAgent: message.recipientAgent,
        messageType: message.messageType
      });
      
      span.setAttributes({
        'a2a.message.id': message.messageId,
        'a2a.recipient': message.recipientAgent,
        'a2a.message.type': message.messageType
      });
    } catch (error) {
      logger.error('Failed to send A2A message', { 
        messageId: message.messageId,
        error: (error as Error).message 
      });
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message });
      throw error;
    } finally {
      span.end();
    }
  }

  async sendStatus(conversationId: string, status: string, details?: any): Promise<void> {
    const message: A2AMessage = {
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversationId,
      timestamp: new Date().toISOString(),
      senderAgent: this.agentName,
      recipientAgent: 'master_control_agent',
      messageType: 'status',
      payload: { status, details },
      protocolVersion: '1.0',
      priority: 'normal'
    };

    await this.sendMessage(message);
  }
}
