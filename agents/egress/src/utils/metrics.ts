import { logger } from './logger';

export interface MetricLabels {
  [key: string]: string;
}

export class AgentMetrics {
  private agentName: string;
  private projectId: string;

  constructor(agentName: string, projectId: string) {
    this.agentName = agentName;
    this.projectId = projectId;
  }

  recordCommandExecution(commandType: string, status: 'success' | 'error', latency: number): void {
    logger.info('Command execution metric recorded', {
      agent: this.agentName,
      commandType,
      status,
      latency,
      timestamp: new Date().toISOString()
    });
  }

  recordOPCUAConnection(status: 'connected' | 'disconnected'): void {
    logger.info('OPC-UA connection metric recorded', {
      agent: this.agentName,
      status,
      timestamp: new Date().toISOString()
    });
  }

  recordEmergencyStop(authorizedBy: string): void {
    logger.warn('Emergency stop metric recorded', {
      agent: this.agentName,
      authorizedBy,
      timestamp: new Date().toISOString()
    });
  }

  recordA2AMessage(messageType: string, status: 'sent' | 'received' | 'error'): void {
    logger.info('A2A message metric recorded', {
      agent: this.agentName,
      messageType,
      status,
      timestamp: new Date().toISOString()
    });
  }
}
