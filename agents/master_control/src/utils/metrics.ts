import { monitoring_v3 } from '@google-cloud/monitoring';
import { logger } from './logger';

/**
 * Agent metrics collection and reporting
 * Implements comprehensive metrics for Master Control Agent
 */
export class AgentMetrics {
  private agentId: string;
  private projectId: string;
  private monitoringClient: monitoring_v3.MetricServiceClient;
  private projectName: string;

  constructor(agentId: string, projectId: string) {
    this.agentId = agentId;
    this.projectId = projectId;
    this.monitoringClient = new monitoring_v3.MetricServiceClient();
    this.projectName = `projects/${projectId}`;
  }

  /**
   * Record decision latency
   */
  recordDecisionLatency(decisionType: string, proposalCount: number, latencySeconds: number): void {
    try {
      this.sendCustomMetric('cemai_decision_latency_seconds', latencySeconds, {
        agent_id: this.agentId,
        decision_type: decisionType,
        proposal_count: proposalCount.toString()
      });
    } catch (error) {
      logger.error('Failed to record decision latency', { error: (error as Error).message });
    }
  }

  /**
   * Record conflict resolution rate
   */
  recordConflictResolution(conflictType: string, resolutionRate: number): void {
    try {
      this.sendCustomMetric('cemai_conflict_resolution_rate', resolutionRate, {
        agent_id: this.agentId,
        conflict_type: conflictType
      });
    } catch (error) {
      logger.error('Failed to record conflict resolution', { error: (error as Error).message });
    }
  }

  /**
   * Record proposal acceptance rate
   */
  recordProposalAcceptance(agentId: string, proposalType: string, acceptanceRate: number): void {
    try {
      this.sendCustomMetric('cemai_proposal_acceptance_rate', acceptanceRate, {
        master_control_agent: this.agentId,
        specialist_agent: agentId,
        proposal_type: proposalType
      });
    } catch (error) {
      logger.error('Failed to record proposal acceptance', { error: (error as Error).message });
    }
  }

  /**
   * Record workflow execution
   */
  recordWorkflowExecution(status: string): void {
    try {
      this.sendCustomMetric('cemai_workflows_total', 1, {
        agent_id: this.agentId,
        status: status
      });
    } catch (error) {
      logger.error('Failed to record workflow execution', { error: (error as Error).message });
    }
  }

  /**
   * Record Constitutional AI decision making
   */
  recordConstitutionalDecision(decisionType: string, confidence: number, latencySeconds: number): void {
    try {
      this.sendCustomMetric('cemai_constitutional_decision_latency_seconds', latencySeconds, {
        agent_id: this.agentId,
        decision_type: decisionType,
        confidence: confidence.toString()
      });
    } catch (error) {
      logger.error('Failed to record Constitutional AI decision', { error: (error as Error).message });
    }
  }

  /**
   * Record agent communication
   */
  recordAgentCommunication(recipientAgent: string, messageType: string, latencySeconds: number): void {
    try {
      this.sendCustomMetric('cemai_agent_communication_latency_seconds', latencySeconds, {
        sender_agent: this.agentId,
        recipient_agent: recipientAgent,
        message_type: messageType
      });
    } catch (error) {
      logger.error('Failed to record agent communication', { error: (error as Error).message });
    }
  }

  /**
   * Record command execution
   */
  recordCommandExecution(commandType: string, status: string): void {
    try {
      this.sendCustomMetric('cemai_command_executions_total', 1, {
        agent_id: this.agentId,
        command_type: commandType,
        status: status
      });
    } catch (error) {
      logger.error('Failed to record command execution', { error: (error as Error).message });
    }
  }

  /**
   * Record agent availability
   */
  recordAvailability(availability: number): void {
    try {
      this.sendCustomMetric('cemai_agent_availability', availability, {
        agent_id: this.agentId
      });
    } catch (error) {
      logger.error('Failed to record availability', { error: (error as Error).message });
    }
  }

  /**
   * Record error rate
   */
  recordErrorRate(errorType: string, errorRate: number): void {
    try {
      this.sendCustomMetric('cemai_agent_error_rate', errorRate, {
        agent_id: this.agentId,
        error_type: errorType
      });
    } catch (error) {
      logger.error('Failed to record error rate', { error: (error as Error).message });
    }
  }

  /**
   * Record business metrics
   */
  recordBusinessMetric(metricName: string, value: number, labels: Record<string, string> = {}): void {
    try {
      this.sendCustomMetric(`cemai_business_${metricName}`, value, {
        agent_id: this.agentId,
        ...labels
      });
    } catch (error) {
      logger.error('Failed to record business metric', { 
        error: (error as Error).message,
        metricName,
        value
      });
    }
  }

  /**
   * Send custom metric to Google Cloud Monitoring
   */
  private sendCustomMetric(metricName: string, value: number, labels: Record<string, string>): void {
    const series = new monitoring_v3.TimeSeries();
    series.metric = {
      type: `custom.googleapis.com/${metricName}`,
      labels: labels
    };
    
    series.resource = {
      type: 'gce_instance',
      labels: {
        instance_id: this.agentId,
        zone: process.env.GOOGLE_CLOUD_REGION || 'us-central1'
      }
    };

    const point = new monitoring_v3.Point();
    point.value = { doubleValue: value };
    point.interval = {
      endTime: {
        seconds: Math.floor(Date.now() / 1000)
      }
    };

    series.points = [point];

    // Send to Cloud Monitoring (async, don't wait for response)
    this.monitoringClient.createTimeSeries({
      name: this.projectName,
      timeSeries: [series]
    }).catch(error => {
      logger.error('Failed to send metric to Cloud Monitoring', { 
        error: error.message,
        metricName,
        value
      });
    });
  }

  /**
   * Get agent health metrics
   */
  async getHealthMetrics(): Promise<any> {
    try {
      // This would typically query Cloud Monitoring for recent metrics
      // For now, return a basic health status
      return {
        agent_id: this.agentId,
        status: 'healthy',
        uptime: process.uptime(),
        memory_usage: process.memoryUsage(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to get health metrics', { error: (error as Error).message });
      return {
        agent_id: this.agentId,
        status: 'error',
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Record performance timing
   */
  timeOperation<T>(operationName: string, operation: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    
    return operation().then(
      result => {
        const duration = Date.now() - startTime;
        this.recordDecisionLatency(operationName, 0, duration / 1000);
        return result;
      },
      error => {
        const duration = Date.now() - startTime;
        this.recordDecisionLatency(operationName, 0, duration / 1000);
        this.recordErrorRate('operation_error', 1);
        throw error;
      }
    );
  }
}

