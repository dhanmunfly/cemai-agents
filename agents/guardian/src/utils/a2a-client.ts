import { trace, context } from '@opentelemetry/api';
import { logger } from './logger';

/**
 * A2A (Agent-to-Agent) Communication Client
 * Handles secure, authenticated communication between agents
 */
export class A2AClient {
  private agentId: string;
  private projectId: string;
  private baseUrl: string;

  constructor(agentId: string, projectId?: string) {
    this.agentId = agentId;
    this.projectId = projectId || process.env.GOOGLE_CLOUD_PROJECT || 'cemai-agents';
    this.baseUrl = process.env.A2A_BASE_URL || 'https://master-control-agent.run.app';
  }

  /**
   * Send A2A message with authentication and tracing
   */
  async sendMessage(message: any): Promise<any> {
    const tracer = trace.getTracer('a2a-client');
    const span = tracer.startSpan('send_a2a_message');
    
    try {
      // Add authentication token
      const token = await this.getAuthToken();
      message.sender_token = token;
      message.sender_agent = this.agentId;
      
      // Add tracing information
      const activeSpan = trace.getActiveSpan();
      if (activeSpan) {
        const spanContext = activeSpan.spanContext();
        message.trace_id = spanContext.traceId;
        message.span_id = spanContext.spanId;
      }
      
      // Determine recipient endpoint
      const recipientUrl = this.resolveAgentEndpoint(message.recipient_agent);
      
      // Send HTTP request
      const response = await fetch(`${recipientUrl}/a2a/receive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'User-Agent': `CemAI-Agent/${this.agentId}/1.0.0`
        },
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`A2A message failed: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      span.setAttributes({
        'a2a.message.type': message.messageType,
        'a2a.message.id': message.messageId,
        'a2a.recipient': message.recipient_agent,
        'a2a.response.status': response.status
      });
      
      logger.info('A2A message sent successfully', {
        messageId: message.messageId,
        recipient: message.recipient_agent,
        messageType: message.messageType
      });
      
      return result;
      
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message });
      
      logger.error('A2A message send failed', {
        error: (error as Error).message,
        messageId: message.messageId,
        recipient: message.recipient_agent
      });
      
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Get authentication token for A2A communication
   */
  private async getAuthToken(): Promise<string> {
    try {
      // In production, this would use Google Cloud IAM to generate tokens
      // For now, return a placeholder token
      return `token_${this.agentId}_${Date.now()}`;
    } catch (error) {
      logger.error('Failed to get auth token', { error: (error as Error).message });
      throw new Error('Authentication failed');
    }
  }

  /**
   * Resolve agent endpoint URL
   */
  private resolveAgentEndpoint(agentId: string): string {
    const agentEndpoints: Record<string, string> = {
      'master_control_agent': process.env.MASTER_CONTROL_URL || 'https://master-control-agent.run.app',
      'optimizer_agent': process.env.OPTIMIZER_URL || 'https://optimizer-agent.run.app',
      'egress_agent': process.env.EGRESS_URL || 'https://egress-agent.run.app'
    };
    
    return agentEndpoints[agentId] || `${this.baseUrl}/agents/${agentId}`;
  }

  /**
   * Send proposal message to Master Control Agent
   */
  async sendProposal(proposal: any): Promise<any> {
    const message = {
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversationId: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      correlationId: `corr_${Date.now()}`,
      senderAgent: this.agentId,
      recipientAgent: 'master_control_agent',
      messageType: 'proposal',
      payload: proposal,
      protocolVersion: '1.0',
      priority: proposal.urgency === 'high' ? 'high' : 'normal'
    };
    
    return this.sendMessage(message);
  }

  /**
   * Send status message
   */
  async sendStatus(status: any): Promise<any> {
    const message = {
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversationId: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      correlationId: `corr_${Date.now()}`,
      senderAgent: this.agentId,
      recipientAgent: 'broadcast',
      messageType: 'status',
      payload: status,
      protocolVersion: '1.0',
      priority: 'normal'
    };
    
    return this.sendMessage(message);
  }
}
