import { Pool } from 'pg';
import { logger } from '../utils/logger';

export interface PredictionRecord {
  requestId: string;
  sensorData: any;
  predictionHorizonMinutes: number;
  currentLSF: number;
  predictedLSF: number;
  confidence: number;
  deviationDetected: boolean;
  deviationMagnitude: number;
  accuracy: number;
  modelVersion: string;
  latency: number;
}

export interface ProposalRecord {
  proposalId: string;
  requestId: string;
  proposalType: string;
  urgency: string;
  title: string;
  description: string;
  rationale: string;
  actions: any[];
  expectedOutcomes: any[];
  risks: any[];
  mitigationStrategies: string[];
  supportingData: any;
  confidence: number;
  constraints: string[];
  prerequisites: string[];
}

export class AlloyDBService {
  private pool: Pool;
  private projectId: string;
  private region: string;
  private clusterId: string;
  private database: string;

  constructor(
    projectId: string,
    region: string,
    clusterId: string,
    database: string,
    connectionString?: string
  ) {
    this.projectId = projectId;
    this.region = region;
    this.clusterId = clusterId;
    this.database = database;

    // Initialize connection pool
    this.pool = new Pool({
      connectionString: connectionString || this.buildConnectionString(),
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', { error: err.message });
    });
  }

  private buildConnectionString(): string {
    // In a real implementation, this would build the connection string
    // using the AlloyDB cluster information
    return `postgresql://cemai-admin:password@${this.clusterId}-primary.${this.region}.alloydb.googleapis.com:5432/${this.database}`;
  }

  async initializeSchema(): Promise<void> {
    try {
      const client = await this.pool.connect();
      
      // Create predictions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS predictions (
          id SERIAL PRIMARY KEY,
          request_id VARCHAR(255) UNIQUE NOT NULL,
          sensor_data JSONB NOT NULL,
          prediction_horizon_minutes INTEGER NOT NULL,
          current_lsf DECIMAL(5,2) NOT NULL,
          predicted_lsf DECIMAL(5,2) NOT NULL,
          confidence DECIMAL(3,2) NOT NULL,
          deviation_detected BOOLEAN NOT NULL,
          deviation_magnitude DECIMAL(5,2) NOT NULL,
          accuracy DECIMAL(3,2) NOT NULL,
          model_version VARCHAR(50) NOT NULL,
          latency DECIMAL(5,2) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create proposals table
      await client.query(`
        CREATE TABLE IF NOT EXISTS proposals (
          id SERIAL PRIMARY KEY,
          proposal_id VARCHAR(255) UNIQUE NOT NULL,
          request_id VARCHAR(255) NOT NULL,
          proposal_type VARCHAR(50) NOT NULL,
          urgency VARCHAR(20) NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          rationale TEXT NOT NULL,
          actions JSONB NOT NULL,
          expected_outcomes JSONB NOT NULL,
          risks JSONB NOT NULL,
          mitigation_strategies TEXT[] NOT NULL,
          supporting_data JSONB NOT NULL,
          confidence DECIMAL(3,2) NOT NULL,
          constraints TEXT[] NOT NULL,
          prerequisites TEXT[] NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (request_id) REFERENCES predictions(request_id)
        )
      `);

      // Create indexes for performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON predictions(created_at);
        CREATE INDEX IF NOT EXISTS idx_predictions_deviation_detected ON predictions(deviation_detected);
        CREATE INDEX IF NOT EXISTS idx_proposals_proposal_type ON proposals(proposal_type);
        CREATE INDEX IF NOT EXISTS idx_proposals_urgency ON proposals(urgency);
      `);

      client.release();
      
      logger.info('AlloyDB schema initialized successfully', {
        clusterId: this.clusterId,
        database: this.database
      });
      
    } catch (error) {
      logger.error('Failed to initialize AlloyDB schema', { 
        error: (error as Error).message,
        clusterId: this.clusterId
      });
      throw error;
    }
  }

  async storePrediction(prediction: PredictionRecord): Promise<void> {
    try {
      const client = await this.pool.connect();
      
      await client.query(`
        INSERT INTO predictions (
          request_id, sensor_data, prediction_horizon_minutes,
          current_lsf, predicted_lsf, confidence, deviation_detected,
          deviation_magnitude, accuracy, model_version, latency
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (request_id) DO UPDATE SET
          sensor_data = EXCLUDED.sensor_data,
          prediction_horizon_minutes = EXCLUDED.prediction_horizon_minutes,
          current_lsf = EXCLUDED.current_lsf,
          predicted_lsf = EXCLUDED.predicted_lsf,
          confidence = EXCLUDED.confidence,
          deviation_detected = EXCLUDED.deviation_detected,
          deviation_magnitude = EXCLUDED.deviation_magnitude,
          accuracy = EXCLUDED.accuracy,
          model_version = EXCLUDED.model_version,
          latency = EXCLUDED.latency
      `, [
        prediction.requestId,
        JSON.stringify(prediction.sensorData),
        prediction.predictionHorizonMinutes,
        prediction.currentLSF,
        prediction.predictedLSF,
        prediction.confidence,
        prediction.deviationDetected,
        prediction.deviationMagnitude,
        prediction.accuracy,
        prediction.modelVersion,
        prediction.latency
      ]);

      client.release();
      
      logger.info('Prediction stored successfully', {
        requestId: prediction.requestId,
        predictedLSF: prediction.predictedLSF
      });
      
    } catch (error) {
      logger.error('Failed to store prediction', { 
        error: (error as Error).message,
        requestId: prediction.requestId
      });
      throw error;
    }
  }

  async storeProposal(proposal: ProposalRecord): Promise<void> {
    try {
      const client = await this.pool.connect();
      
      await client.query(`
        INSERT INTO proposals (
          proposal_id, request_id, proposal_type, urgency, title, description,
          rationale, actions, expected_outcomes, risks, mitigation_strategies,
          supporting_data, confidence, constraints, prerequisites
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (proposal_id) DO UPDATE SET
          request_id = EXCLUDED.request_id,
          proposal_type = EXCLUDED.proposal_type,
          urgency = EXCLUDED.urgency,
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          rationale = EXCLUDED.rationale,
          actions = EXCLUDED.actions,
          expected_outcomes = EXCLUDED.expected_outcomes,
          risks = EXCLUDED.risks,
          mitigation_strategies = EXCLUDED.mitigation_strategies,
          supporting_data = EXCLUDED.supporting_data,
          confidence = EXCLUDED.confidence,
          constraints = EXCLUDED.constraints,
          prerequisites = EXCLUDED.prerequisites
      `, [
        proposal.proposalId,
        proposal.requestId,
        proposal.proposalType,
        proposal.urgency,
        proposal.title,
        proposal.description,
        proposal.rationale,
        JSON.stringify(proposal.actions),
        JSON.stringify(proposal.expectedOutcomes),
        JSON.stringify(proposal.risks),
        proposal.mitigationStrategies,
        JSON.stringify(proposal.supportingData),
        proposal.confidence,
        proposal.constraints,
        proposal.prerequisites
      ]);

      client.release();
      
      logger.info('Proposal stored successfully', {
        proposalId: proposal.proposalId,
        proposalType: proposal.proposalType,
        urgency: proposal.urgency
      });
      
    } catch (error) {
      logger.error('Failed to store proposal', { 
        error: (error as Error).message,
        proposalId: proposal.proposalId
      });
      throw error;
    }
  }

  async getPredictionHistory(limit: number = 100, startDate?: Date, endDate?: Date): Promise<PredictionRecord[]> {
    try {
      const client = await this.pool.connect();
      
      let query = `
        SELECT * FROM predictions 
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramCount = 0;

      if (startDate) {
        paramCount++;
        query += ` AND created_at >= $${paramCount}`;
        params.push(startDate);
      }

      if (endDate) {
        paramCount++;
        query += ` AND created_at <= $${paramCount}`;
        params.push(endDate);
      }

      query += ` ORDER BY created_at DESC LIMIT $${++paramCount}`;
      params.push(limit);

      const result = await client.query(query, params);
      client.release();

      const predictions = result.rows.map(row => ({
        requestId: row.request_id,
        sensorData: row.sensor_data,
        predictionHorizonMinutes: row.prediction_horizon_minutes,
        currentLSF: row.current_lsf,
        predictedLSF: row.predicted_lsf,
        confidence: row.confidence,
        deviationDetected: row.deviation_detected,
        deviationMagnitude: row.deviation_magnitude,
        accuracy: row.accuracy,
        modelVersion: row.model_version,
        latency: row.latency
      }));

      logger.info('Retrieved prediction history', {
        count: predictions.length,
        limit,
        startDate,
        endDate
      });

      return predictions;
      
    } catch (error) {
      logger.error('Failed to get prediction history', { error: (error as Error).message });
      throw error;
    }
  }

  async getModelPerformanceMetrics(modelVersion?: string, days: number = 7): Promise<any> {
    try {
      const client = await this.pool.connect();
      
      let query = `
        SELECT 
          AVG(accuracy) as avg_accuracy,
          AVG(confidence) as avg_confidence,
          AVG(latency) as avg_latency,
          COUNT(*) as total_predictions,
          COUNT(CASE WHEN deviation_detected = true THEN 1 END) as deviation_count
        FROM predictions 
        WHERE created_at >= NOW() - INTERVAL '${days} days'
      `;
      const params: any[] = [];

      if (modelVersion) {
        query += ` AND model_version = $1`;
        params.push(modelVersion);
      }

      const result = await client.query(query, params);
      client.release();

      const metrics = {
        modelVersion: modelVersion || 'all',
        periodDays: days,
        avgAccuracy: parseFloat(result.rows[0].avg_accuracy) || 0,
        avgConfidence: parseFloat(result.rows[0].avg_confidence) || 0,
        avgLatency: parseFloat(result.rows[0].avg_latency) || 0,
        totalPredictions: parseInt(result.rows[0].total_predictions) || 0,
        deviationCount: parseInt(result.rows[0].deviation_count) || 0
      };

      logger.info('Retrieved model performance metrics', metrics);
      return metrics;
      
    } catch (error) {
      logger.error('Failed to get model performance metrics', { error: (error as Error).message });
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    logger.info('AlloyDB connection pool closed');
  }
}