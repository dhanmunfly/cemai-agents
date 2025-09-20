import { logger } from './logger';

export class AgentMetrics {
  private agentName: string;
  private projectId: string;
  private metrics: Map<string, any> = new Map();

  constructor(agentName: string, projectId: string) {
    this.agentName = agentName;
    this.projectId = projectId;
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    // Initialize default metrics
    this.metrics.set('requests_total', 0);
    this.metrics.set('requests_success', 0);
    this.metrics.set('requests_error', 0);
    this.metrics.set('response_time_ms', 0);
    this.metrics.set('active_connections', 0);
    this.metrics.set('memory_usage_mb', 0);
    this.metrics.set('cpu_usage_percent', 0);
    
    logger.info('Agent metrics initialized', {
      agent: this.agentName,
      projectId: this.projectId
    });
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(metricName: string, labels?: Record<string, string>): void {
    try {
      const currentValue = this.metrics.get(metricName) || 0;
      this.metrics.set(metricName, currentValue + 1);
      
      logger.debug('Counter metric incremented', {
        agent: this.agentName,
        metric: metricName,
        value: currentValue + 1,
        labels
      });
    } catch (error) {
      logger.error('Failed to increment counter metric', {
        agent: this.agentName,
        metric: metricName,
        error: (error as Error).message
      });
    }
  }

  /**
   * Set a gauge metric value
   */
  setGauge(metricName: string, value: number, labels?: Record<string, string>): void {
    try {
      this.metrics.set(metricName, value);
      
      logger.debug('Gauge metric set', {
        agent: this.agentName,
        metric: metricName,
        value,
        labels
      });
    } catch (error) {
      logger.error('Failed to set gauge metric', {
        agent: this.agentName,
        metric: metricName,
        value,
        error: (error as Error).message
      });
    }
  }

  /**
   * Record a histogram value
   */
  recordHistogram(metricName: string, value: number, labels?: Record<string, string>): void {
    try {
      const currentValues = this.metrics.get(metricName) || [];
      currentValues.push({
        value,
        timestamp: Date.now(),
        labels
      });
      
      // Keep only last 1000 values to prevent memory issues
      if (currentValues.length > 1000) {
        currentValues.splice(0, currentValues.length - 1000);
      }
      
      this.metrics.set(metricName, currentValues);
      
      logger.debug('Histogram metric recorded', {
        agent: this.agentName,
        metric: metricName,
        value,
        labels
      });
    } catch (error) {
      logger.error('Failed to record histogram metric', {
        agent: this.agentName,
        metric: metricName,
        value,
        error: (error as Error).message
      });
    }
  }

  /**
   * Record request metrics
   */
  recordRequest(success: boolean, responseTimeMs: number, labels?: Record<string, string>): void {
    try {
      this.incrementCounter('requests_total', labels);
      
      if (success) {
        this.incrementCounter('requests_success', labels);
      } else {
        this.incrementCounter('requests_error', labels);
      }
      
      this.recordHistogram('response_time_ms', responseTimeMs, labels);
      
      logger.debug('Request metrics recorded', {
        agent: this.agentName,
        success,
        responseTimeMs,
        labels
      });
    } catch (error) {
      logger.error('Failed to record request metrics', {
        agent: this.agentName,
        success,
        responseTimeMs,
        error: (error as Error).message
      });
    }
  }

  /**
   * Update system resource metrics
   */
  updateSystemMetrics(): void {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      this.setGauge('memory_usage_mb', memUsage.heapUsed / 1024 / 1024);
      this.setGauge('cpu_usage_percent', (cpuUsage.user + cpuUsage.system) / 1000000);
      
      logger.debug('System metrics updated', {
        agent: this.agentName,
        memoryMB: memUsage.heapUsed / 1024 / 1024,
        cpuPercent: (cpuUsage.user + cpuUsage.system) / 1000000
      });
    } catch (error) {
      logger.error('Failed to update system metrics', {
        agent: this.agentName,
        error: (error as Error).message
      });
    }
  }

  /**
   * Get all metrics as a formatted object
   */
  getAllMetrics(): Record<string, any> {
    try {
      const allMetrics: Record<string, any> = {};
      
      for (const [key, value] of this.metrics) {
        allMetrics[key] = value;
      }
      
      // Add metadata
      allMetrics._metadata = {
        agent: this.agentName,
        projectId: this.projectId,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      };
      
      return allMetrics;
    } catch (error) {
      logger.error('Failed to get all metrics', {
        agent: this.agentName,
        error: (error as Error).message
      });
      return {};
    }
  }

  /**
   * Get specific metric value
   */
  getMetric(metricName: string): any {
    try {
      return this.metrics.get(metricName);
    } catch (error) {
      logger.error('Failed to get metric', {
        agent: this.agentName,
        metric: metricName,
        error: (error as Error).message
      });
      return null;
    }
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    try {
      this.metrics.clear();
      this.initializeMetrics();
      
      logger.info('Metrics reset', {
        agent: this.agentName
      });
    } catch (error) {
      logger.error('Failed to reset metrics', {
        agent: this.agentName,
        error: (error as Error).message
      });
    }
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusFormat(): string {
    try {
      let prometheusMetrics = '';
      
      // Add metadata
      prometheusMetrics += `# HELP cemai_agent_info Agent information\n`;
      prometheusMetrics += `# TYPE cemai_agent_info gauge\n`;
      prometheusMetrics += `cemai_agent_info{agent="${this.agentName}",project="${this.projectId}"} 1\n`;
      
      // Export counter metrics
      for (const [key, value] of this.metrics) {
        if (typeof value === 'number') {
          prometheusMetrics += `# HELP cemai_${key} ${key} metric\n`;
          prometheusMetrics += `# TYPE cemai_${key} counter\n`;
          prometheusMetrics += `cemai_${key}{agent="${this.agentName}"} ${value}\n`;
        }
      }
      
      return prometheusMetrics;
    } catch (error) {
      logger.error('Failed to export Prometheus metrics', {
        agent: this.agentName,
        error: (error as Error).message
      });
      return '';
    }
  }

  /**
   * Start periodic metric collection
   */
  startPeriodicCollection(intervalMs: number = 30000): void {
    try {
      setInterval(() => {
        this.updateSystemMetrics();
      }, intervalMs);
      
      logger.info('Started periodic metric collection', {
        agent: this.agentName,
        intervalMs
      });
    } catch (error) {
      logger.error('Failed to start periodic metric collection', {
        agent: this.agentName,
        intervalMs,
        error: (error as Error).message
      });
    }
  }
}