import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { trace } from '@opentelemetry/api';

/**
 * AlloyDB State Manager for Master Control Agent
 * Handles LangGraph workflow state persistence and checkpointing
 */
export class AlloyDBStateManager {
  private pool: Pool;
  private projectId: string;
  private region: string;
  private clusterId: string;
  private databaseName: string;

  constructor(
    projectId: string,
    region: string,
    clusterId: string,
    databaseName: string,
    connectionString?: string
  ) {
    this.projectId = projectId;
    this.region = region;
    this.clusterId = clusterId;
    this.databaseName = databaseName;

    // Initialize connection pool
    this.pool = new Pool({
      connectionString: connectionString || this.buildConnectionString(),
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: {
        rejectUnauthorized: false
      }
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error('AlloyDB state manager pool error', { error: err.message });
    });
  }

  /**
   * Build connection string for AlloyDB
   */
  private buildConnectionString(): string {
    return `postgresql://master-control-agent:${process.env.DB_PASSWORD}@${this.clusterId}-${this.region}.alloydb.googleapis.com:5432/${this.databaseName}`;
  }

  /**
   * Initialize database schema for LangGraph state management
   */
  async initializeSchema(): Promise<void> {
    const tracer = trace.getTracer('master-control-agent');
    const span = tracer.startSpan('alloydb_state_schema_init');
    
    try {
      const client = await this.pool.connect();
      
      try {
        // Create workflow states table for LangGraph checkpointing
        await client.query(`
          CREATE TABLE IF NOT EXISTS workflow_states (
            id SERIAL PRIMARY KEY,
            request_id VARCHAR(255) UNIQUE NOT NULL,
            conversation_id VARCHAR(255) NOT NULL,
            timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            trigger VARCHAR(100) NOT NULL,
            context JSONB NOT NULL,
            proposals JSONB NOT NULL DEFAULT '[]',
            conflicts JSONB NOT NULL DEFAULT '[]',
            analysis JSONB,
            decision JSONB,
            approved_actions JSONB NOT NULL DEFAULT '[]',
            rejected_actions JSONB NOT NULL DEFAULT '[]',
            modifications JSONB NOT NULL DEFAULT '[]',
            status VARCHAR(50) NOT NULL DEFAULT 'initializing',
            error TEXT,
            trace_id VARCHAR(255),
            span_id VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          )
        `);

        // Create LangGraph checkpoints table
        await client.query(`
          CREATE TABLE IF NOT EXISTS langgraph_checkpoints (
            id SERIAL PRIMARY KEY,
            checkpoint_id VARCHAR(255) UNIQUE NOT NULL,
            thread_id VARCHAR(255) NOT NULL,
            checkpoint_ns VARCHAR(255) NOT NULL,
            checkpoint_data JSONB NOT NULL,
            metadata JSONB,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          )
        `);

        // Create decision history table
        await client.query(`
          CREATE TABLE IF NOT EXISTS decision_history (
            id SERIAL PRIMARY KEY,
            decision_id VARCHAR(255) UNIQUE NOT NULL,
            request_id VARCHAR(255) NOT NULL REFERENCES workflow_states(request_id),
            decision_type VARCHAR(50) NOT NULL,
            decision_rationale TEXT NOT NULL,
            risk_evaluation TEXT NOT NULL,
            compromise_explanation TEXT,
            confidence DECIMAL(5,3) NOT NULL,
            execution_priority VARCHAR(20) NOT NULL,
            execution_timeline TEXT NOT NULL,
            monitoring_requirements JSONB NOT NULL DEFAULT '[]',
            constitutional_compliance BOOLEAN NOT NULL DEFAULT true,
            human_approval_required BOOLEAN NOT NULL DEFAULT false,
            human_approval_status VARCHAR(20),
            human_approver VARCHAR(255),
            human_approval_timestamp TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          )
        `);

        // Create agent communication log table
        await client.query(`
          CREATE TABLE IF NOT EXISTS agent_communication_log (
            id SERIAL PRIMARY KEY,
            message_id VARCHAR(255) UNIQUE NOT NULL,
            conversation_id VARCHAR(255) NOT NULL,
            sender_agent VARCHAR(100) NOT NULL,
            recipient_agent VARCHAR(100) NOT NULL,
            message_type VARCHAR(50) NOT NULL,
            payload JSONB NOT NULL,
            timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            status VARCHAR(20) NOT NULL DEFAULT 'sent',
            response_time_ms INTEGER,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          )
        `);

        // Create performance metrics table
        await client.query(`
          CREATE TABLE IF NOT EXISTS performance_metrics (
            id SERIAL PRIMARY KEY,
            metric_name VARCHAR(100) NOT NULL,
            metric_value DECIMAL(15,6) NOT NULL,
            metric_unit VARCHAR(50),
            labels JSONB,
            timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          )
        `);

        // Create indexes for performance
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_workflow_states_request_id 
          ON workflow_states(request_id)
        `);
        
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_workflow_states_conversation_id 
          ON workflow_states(conversation_id)
        `);
        
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_workflow_states_status 
          ON workflow_states(status)
        `);
        
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_workflow_states_timestamp 
          ON workflow_states(timestamp DESC)
        `);
        
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_langgraph_checkpoints_thread_id 
          ON langgraph_checkpoints(thread_id)
        `);
        
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_langgraph_checkpoints_checkpoint_ns 
          ON langgraph_checkpoints(checkpoint_ns)
        `);
        
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_decision_history_request_id 
          ON decision_history(request_id)
        `);
        
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_agent_communication_conversation_id 
          ON agent_communication_log(conversation_id)
        `);
        
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp 
          ON performance_metrics(timestamp DESC)
        `);

        logger.info('AlloyDB state management schema initialized successfully');
        
      } finally {
        client.release();
      }
      
    } catch (error) {
      logger.error('Failed to initialize AlloyDB state schema', { error: error.message });
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Save workflow state for LangGraph checkpointing
   */
  async saveWorkflowState(state: any): Promise<void> {
    const tracer = trace.getTracer('master-control-agent');
    const span = tracer.startSpan('alloydb_save_workflow_state');
    
    try {
      const client = await this.pool.connect();
      
      try {
        const query = `
          INSERT INTO workflow_states (
            request_id, conversation_id, timestamp, trigger, context,
            proposals, conflicts, analysis, decision, approved_actions,
            rejected_actions, modifications, status, error, trace_id, span_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (request_id) DO UPDATE SET
            conversation_id = EXCLUDED.conversation_id,
            timestamp = EXCLUDED.timestamp,
            trigger = EXCLUDED.trigger,
            context = EXCLUDED.context,
            proposals = EXCLUDED.proposals,
            conflicts = EXCLUDED.conflicts,
            analysis = EXCLUDED.analysis,
            decision = EXCLUDED.decision,
            approved_actions = EXCLUDED.approved_actions,
            rejected_actions = EXCLUDED.rejected_actions,
            modifications = EXCLUDED.modifications,
            status = EXCLUDED.status,
            error = EXCLUDED.error,
            trace_id = EXCLUDED.trace_id,
            span_id = EXCLUDED.span_id,
            updated_at = NOW()
        `;
        
        const values = [
          state.requestId,
          state.conversationId,
          state.timestamp,
          state.trigger,
          JSON.stringify(state.context),
          JSON.stringify(state.proposals || []),
          JSON.stringify(state.conflicts || []),
          JSON.stringify(state.analysis),
          JSON.stringify(state.decision),
          JSON.stringify(state.approvedActions || []),
          JSON.stringify(state.rejectedActions || []),
          JSON.stringify(state.modifications || []),
          state.status,
          state.error,
          state.traceId,
          state.spanId
        ];
        
        await client.query(query, values);
        
        span.setAttributes({
          'workflow.request_id': state.requestId,
          'workflow.conversation_id': state.conversationId,
          'workflow.status': state.status
        });
        
        logger.info('Workflow state saved to AlloyDB', {
          requestId: state.requestId,
          conversationId: state.conversationId,
          status: state.status
        });
        
      } finally {
        client.release();
      }
      
    } catch (error) {
      logger.error('Failed to save workflow state to AlloyDB', { 
        error: error.message,
        requestId: state.requestId
      });
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Load workflow state for LangGraph checkpointing
   */
  async loadWorkflowState(requestId: string): Promise<any> {
    const tracer = trace.getTracer('master-control-agent');
    const span = tracer.startSpan('alloydb_load_workflow_state');
    
    try {
      const client = await this.pool.connect();
      
      try {
        const query = `
          SELECT * FROM workflow_states WHERE request_id = $1
        `;
        
        const result = await client.query(query, [requestId]);
        
        if (result.rows.length === 0) {
          return null;
        }
        
        const row = result.rows[0];
        
        const state = {
          requestId: row.request_id,
          conversationId: row.conversation_id,
          timestamp: row.timestamp,
          trigger: row.trigger,
          context: JSON.parse(row.context),
          proposals: JSON.parse(row.proposals),
          conflicts: JSON.parse(row.conflicts),
          analysis: row.analysis ? JSON.parse(row.analysis) : null,
          decision: row.decision ? JSON.parse(row.decision) : null,
          approvedActions: JSON.parse(row.approved_actions),
          rejectedActions: JSON.parse(row.rejected_actions),
          modifications: JSON.parse(row.modifications),
          status: row.status,
          error: row.error,
          traceId: row.trace_id,
          spanId: row.span_id
        };
        
        span.setAttributes({
          'workflow.request_id': state.requestId,
          'workflow.status': state.status
        });
        
        logger.info('Workflow state loaded from AlloyDB', {
          requestId: state.requestId,
          status: state.status
        });
        
        return state;
        
      } finally {
        client.release();
      }
      
    } catch (error) {
      logger.error('Failed to load workflow state from AlloyDB', { 
        error: error.message,
        requestId
      });
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Save LangGraph checkpoint
   */
  async saveCheckpoint(
    checkpointId: string,
    threadId: string,
    checkpointNs: string,
    checkpointData: any,
    metadata?: any
  ): Promise<void> {
    const tracer = trace.getTracer('master-control-agent');
    const span = tracer.startSpan('alloydb_save_checkpoint');
    
    try {
      const client = await this.pool.connect();
      
      try {
        const query = `
          INSERT INTO langgraph_checkpoints (
            checkpoint_id, thread_id, checkpoint_ns, checkpoint_data, metadata
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (checkpoint_id) DO UPDATE SET
            checkpoint_data = EXCLUDED.checkpoint_data,
            metadata = EXCLUDED.metadata
        `;
        
        const values = [
          checkpointId,
          threadId,
          checkpointNs,
          JSON.stringify(checkpointData),
          JSON.stringify(metadata || {})
        ];
        
        await client.query(query, values);
        
        span.setAttributes({
          'checkpoint.id': checkpointId,
          'checkpoint.thread_id': threadId,
          'checkpoint.ns': checkpointNs
        });
        
        logger.info('LangGraph checkpoint saved', {
          checkpointId,
          threadId,
          checkpointNs
        });
        
      } finally {
        client.release();
      }
      
    } catch (error) {
      logger.error('Failed to save LangGraph checkpoint', { 
        error: error.message,
        checkpointId
      });
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Load LangGraph checkpoint
   */
  async loadCheckpoint(
    threadId: string,
    checkpointNs: string
  ): Promise<any> {
    const tracer = trace.getTracer('master-control-agent');
    const span = tracer.startSpan('alloydb_load_checkpoint');
    
    try {
      const client = await this.pool.connect();
      
      try {
        const query = `
          SELECT * FROM langgraph_checkpoints 
          WHERE thread_id = $1 AND checkpoint_ns = $2
          ORDER BY created_at DESC LIMIT 1
        `;
        
        const result = await client.query(query, [threadId, checkpointNs]);
        
        if (result.rows.length === 0) {
          return null;
        }
        
        const row = result.rows[0];
        
        const checkpoint = {
          checkpointId: row.checkpoint_id,
          threadId: row.thread_id,
          checkpointNs: row.checkpoint_ns,
          checkpointData: JSON.parse(row.checkpoint_data),
          metadata: JSON.parse(row.metadata),
          createdAt: row.created_at
        };
        
        span.setAttributes({
          'checkpoint.thread_id': threadId,
          'checkpoint.ns': checkpointNs
        });
        
        logger.info('LangGraph checkpoint loaded', {
          threadId,
          checkpointNs
        });
        
        return checkpoint;
        
      } finally {
        client.release();
      }
      
    } catch (error) {
      logger.error('Failed to load LangGraph checkpoint', { 
        error: error.message,
        threadId,
        checkpointNs
      });
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Save decision to history
   */
  async saveDecision(decisionData: {
    decisionId: string;
    requestId: string;
    decisionType: string;
    decisionRationale: string;
    riskEvaluation: string;
    compromiseExplanation?: string;
    confidence: number;
    executionPriority: string;
    executionTimeline: string;
    monitoringRequirements: string[];
    constitutionalCompliance: boolean;
    humanApprovalRequired?: boolean;
  }): Promise<void> {
    const tracer = trace.getTracer('master-control-agent');
    const span = tracer.startSpan('alloydb_save_decision');
    
    try {
      const client = await this.pool.connect();
      
      try {
        const query = `
          INSERT INTO decision_history (
            decision_id, request_id, decision_type, decision_rationale,
            risk_evaluation, compromise_explanation, confidence, execution_priority,
            execution_timeline, monitoring_requirements, constitutional_compliance,
            human_approval_required
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `;
        
        const values = [
          decisionData.decisionId,
          decisionData.requestId,
          decisionData.decisionType,
          decisionData.decisionRationale,
          decisionData.riskEvaluation,
          decisionData.compromiseExplanation,
          decisionData.confidence,
          decisionData.executionPriority,
          decisionData.executionTimeline,
          JSON.stringify(decisionData.monitoringRequirements),
          decisionData.constitutionalCompliance,
          decisionData.humanApprovalRequired || false
        ];
        
        await client.query(query, values);
        
        span.setAttributes({
          'decision.id': decisionData.decisionId,
          'decision.type': decisionData.decisionType,
          'decision.confidence': decisionData.confidence,
          'decision.priority': decisionData.executionPriority
        });
        
        logger.info('Decision saved to history', {
          decisionId: decisionData.decisionId,
          requestId: decisionData.requestId,
          decisionType: decisionData.decisionType
        });
        
      } finally {
        client.release();
      }
      
    } catch (error) {
      logger.error('Failed to save decision to history', { 
        error: error.message,
        decisionId: decisionData.decisionId
      });
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Log agent communication
   */
  async logAgentCommunication(messageData: {
    messageId: string;
    conversationId: string;
    senderAgent: string;
    recipientAgent: string;
    messageType: string;
    payload: any;
    status: string;
    responseTimeMs?: number;
  }): Promise<void> {
    const tracer = trace.getTracer('master-control-agent');
    const span = tracer.startSpan('alloydb_log_communication');
    
    try {
      const client = await this.pool.connect();
      
      try {
        const query = `
          INSERT INTO agent_communication_log (
            message_id, conversation_id, sender_agent, recipient_agent,
            message_type, payload, status, response_time_ms
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;
        
        const values = [
          messageData.messageId,
          messageData.conversationId,
          messageData.senderAgent,
          messageData.recipientAgent,
          messageData.messageType,
          JSON.stringify(messageData.payload),
          messageData.status,
          messageData.responseTimeMs
        ];
        
        await client.query(query, values);
        
        span.setAttributes({
          'communication.message_id': messageData.messageId,
          'communication.sender': messageData.senderAgent,
          'communication.recipient': messageData.recipientAgent,
          'communication.type': messageData.messageType,
          'communication.status': messageData.status
        });
        
      } finally {
        client.release();
      }
      
    } catch (error) {
      logger.error('Failed to log agent communication', { 
        error: error.message,
        messageId: messageData.messageId
      });
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Record performance metrics
   */
  async recordPerformanceMetric(
    metricName: string,
    metricValue: number,
    metricUnit?: string,
    labels?: any
  ): Promise<void> {
    const tracer = trace.getTracer('master-control-agent');
    const span = tracer.startSpan('alloydb_record_metric');
    
    try {
      const client = await this.pool.connect();
      
      try {
        const query = `
          INSERT INTO performance_metrics (
            metric_name, metric_value, metric_unit, labels
          ) VALUES ($1, $2, $3, $4)
        `;
        
        const values = [
          metricName,
          metricValue,
          metricUnit,
          JSON.stringify(labels || {})
        ];
        
        await client.query(query, values);
        
        span.setAttributes({
          'metric.name': metricName,
          'metric.value': metricValue,
          'metric.unit': metricUnit
        });
        
      } finally {
        client.release();
      }
      
    } catch (error) {
      logger.error('Failed to record performance metric', { 
        error: error.message,
        metricName
      });
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Get workflow statistics
   */
  async getWorkflowStatistics(days: number = 7): Promise<{
    totalWorkflows: number;
    completedWorkflows: number;
    failedWorkflows: number;
    averageLatency: number;
    successRate: number;
  }> {
    const tracer = trace.getTracer('master-control-agent');
    const span = tracer.startSpan('alloydb_get_workflow_stats');
    
    try {
      const client = await this.pool.connect();
      
      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        const query = `
          SELECT 
            COUNT(*) as total_workflows,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_workflows,
            COUNT(CASE WHEN status = 'error' THEN 1 END) as failed_workflows,
            AVG(EXTRACT(EPOCH FROM (updated_at - timestamp))) as avg_latency
          FROM workflow_states
          WHERE timestamp >= $1
        `;
        
        const result = await client.query(query, [startDate]);
        const row = result.rows[0];
        
        const totalWorkflows = parseInt(row.total_workflows);
        const completedWorkflows = parseInt(row.completed_workflows);
        const failedWorkflows = parseInt(row.failed_workflows);
        const averageLatency = parseFloat(row.avg_latency) || 0;
        const successRate = totalWorkflows > 0 ? (completedWorkflows / totalWorkflows) : 0;
        
        span.setAttributes({
          'stats.total_workflows': totalWorkflows,
          'stats.completed_workflows': completedWorkflows,
          'stats.failed_workflows': failedWorkflows,
          'stats.avg_latency': averageLatency,
          'stats.success_rate': successRate
        });
        
        return {
          totalWorkflows,
          completedWorkflows,
          failedWorkflows,
          averageLatency,
          successRate
        };
        
      } finally {
        client.release();
      }
      
    } catch (error) {
      logger.error('Failed to get workflow statistics', { error: error.message });
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    try {
      await this.pool.end();
      logger.info('AlloyDB state manager connections closed');
    } catch (error) {
      logger.error('Error closing AlloyDB state manager connections', { error: error.message });
    }
  }

  /**
   * Health check for database connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      try {
        await client.query('SELECT 1');
        return true;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('AlloyDB state manager health check failed', { error: error.message });
      return false;
    }
  }
}
