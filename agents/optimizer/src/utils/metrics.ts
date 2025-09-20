import { monitoring_v3 } from '@google-cloud/monitoring';
import { logger } from './logger';

/**
 * Agent metrics collection and reporting
 * Implements comprehensive metrics for Optimizer Agent
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
   * Record optimization latency
   */
  recordOptimizationLatency(optimizationType: string, constraintCount: number, latencySeconds: number): void {
    try {
      this.sendCustomMetric('cemai_optimization_latency_seconds', latencySeconds, {
        agent_id: this.agentId,
        optimization_type: optimizationType,
        constraint_count: constraintCount.toString()
      });
    } catch (error) {
      logger.error('Failed to record optimization latency', { error: (error as Error).message });
    }
  }

  /**
   * Record cost savings
   */
  recordCostSavings(optimizationPeriod: string, savingsPercent: number): void {
    try {
      this.sendCustomMetric('cemai_cost_savings_percent', savingsPercent, {
        agent_id: this.agentId,
        optimization_period: optimizationPeriod
      });
    } catch (error) {
      logger.error('Failed to record cost savings', { error: (error as Error).message });
    }
  }

  /**
   * Record alternative fuel ratio
   */
  recordAlternativeFuelRatio(fuelType: string, ratio: number): void {
    try {
      this.sendCustomMetric('cemai_alternative_fuel_ratio', ratio, {
        agent_id: this.agentId,
        fuel_type: fuelType
      });
    } catch (error) {
      logger.error('Failed to record alternative fuel ratio', { error: (error as Error).message });
    }
  }

  /**
   * Record proposal generation
   */
  recordProposal(proposalType: string, status: string): void {
    try {
      this.sendCustomMetric('cemai_optimization_proposals_total', 1, {
        agent_id: this.agentId,
        proposal_type: proposalType,
        status: status
      });
    } catch (error) {
      logger.error('Failed to record proposal', { error: (error as Error).message });
    }
  }

  /**
   * Record market data processing
   */
  recordMarketDataProcessing(processingType: string, latencySeconds: number): void {
    try {
      this.sendCustomMetric('cemai_market_data_processing_latency_seconds', latencySeconds, {
        agent_id: this.agentId,
        processing_type: processingType
      });
    } catch (error) {
      logger.error('Failed to record market data processing', { error: (error as Error).message });
    }
  }

  /**
   * Record re-optimization triggers
   */
  recordReoptimizationTrigger(triggerType: string, priceChangePercent: number): void {
    try {
      this.sendCustomMetric('cemai_reoptimization_triggers_total', 1, {
        agent_id: this.agentId,
        trigger_type: triggerType,
        price_change_percent: priceChangePercent.toString()
      });
    } catch (error) {
      logger.error('Failed to record re-optimization trigger', { error: (error as Error).message });
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
        this.recordOptimizationLatency(operationName, 0, duration / 1000);
        return result;
      },
      error => {
        const duration = Date.now() - startTime;
        this.recordOptimizationLatency(operationName, 0, duration / 1000);
        this.recordErrorRate('operation_error', 1);
        throw error;
      }
    );
  }
}

