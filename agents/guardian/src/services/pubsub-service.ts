import { PubSub } from '@google-cloud/pubsub';
import { logger } from '../utils/logger';

export interface ProposalMessage {
  proposalId: string;
  agentId: string;
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
  timestamp: string;
}

export class PubSubService {
  private pubsub: PubSub;
  private projectId: string;
  private topics: Map<string, any> = new Map();

  constructor(projectId: string) {
    this.projectId = projectId;
    this.pubsub = new PubSub({ projectId });
  }

  async initializeSubscriptions(): Promise<void> {
    try {
      // Initialize subscriptions for Guardian Agent
      const subscriptions = [
        {
          name: 'guardian-process-data-subscription',
          topic: 'plant-sensor-data',
          filter: 'attributes.type="process" OR attributes.type="quality"'
        },
        {
          name: 'guardian-lab-analysis-subscription',
          topic: 'lab-analysis-results',
          filter: 'attributes.analysis_type="chemistry"'
        },
        {
          name: 'guardian-equipment-status-subscription',
          topic: 'equipment-status',
          filter: 'attributes.equipment IN ("kiln", "preheater", "mill")'
        }
      ];

      for (const subConfig of subscriptions) {
        try {
          const topic = this.pubsub.topic(subConfig.topic);
          const subscription = topic.subscription(subConfig.name);
          
          // Check if subscription exists, create if not
          const [exists] = await subscription.exists();
          if (!exists) {
            await topic.createSubscription(subConfig.name, {
              filter: subConfig.filter
            });
            logger.info('Created subscription', {
              name: subConfig.name,
              topic: subConfig.topic,
              filter: subConfig.filter
            });
          } else {
            logger.info('Subscription already exists', {
              name: subConfig.name,
              topic: subConfig.topic
            });
          }
        } catch (error) {
          logger.warn('Failed to initialize subscription', {
            name: subConfig.name,
            topic: subConfig.topic,
            error: (error as Error).message
          });
        }
      }

      logger.info('Pub/Sub subscriptions initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize Pub/Sub subscriptions', { 
        error: (error as Error).message 
      });
      throw error;
    }
  }

  async publishProposal(proposal: ProposalMessage): Promise<void> {
    try {
      const topicName = 'agent-proposals';
      const topic = this.pubsub.topic(topicName);
      
      const messageData = {
        proposalId: proposal.proposalId,
        agentId: proposal.agentId,
        proposalType: proposal.proposalType,
        urgency: proposal.urgency,
        title: proposal.title,
        description: proposal.description,
        rationale: proposal.rationale,
        actions: proposal.actions,
        expectedOutcomes: proposal.expectedOutcomes,
        risks: proposal.risks,
        mitigationStrategies: proposal.mitigationStrategies,
        supportingData: proposal.supportingData,
        confidence: proposal.confidence,
        constraints: proposal.constraints,
        prerequisites: proposal.prerequisites,
        timestamp: proposal.timestamp
      };

      const message = {
        data: Buffer.from(JSON.stringify(messageData)),
        attributes: {
          agent_id: proposal.agentId,
          proposal_type: proposal.proposalType,
          urgency: proposal.urgency,
          timestamp: proposal.timestamp
        }
      };

      const messageId = await topic.publishMessage(message);
      
      logger.info('Proposal published successfully', {
        proposalId: proposal.proposalId,
        agentId: proposal.agentId,
        proposalType: proposal.proposalType,
        urgency: proposal.urgency,
        messageId
      });
      
    } catch (error) {
      logger.error('Failed to publish proposal', { 
        error: (error as Error).message,
        proposalId: proposal.proposalId
      });
      throw error;
    }
  }

  async subscribeToProcessData(callback: (data: any) => Promise<void>): Promise<void> {
    try {
      const subscriptionName = 'guardian-process-data-subscription';
      const subscription = this.pubsub.subscription(subscriptionName);

      subscription.on('message', async (message) => {
        try {
          const data = JSON.parse(message.data.toString());
          
          logger.info('Received process data message', {
            messageId: message.id,
            dataType: data.type,
            variables: data.variables
          });

          await callback(data);
          message.ack();
          
        } catch (error) {
          logger.error('Error processing process data message', { 
            error: (error as Error).message,
            messageId: message.id
          });
          message.nack();
        }
      });

      subscription.on('error', (error) => {
        logger.error('Subscription error', { error: error.message });
      });

      logger.info('Subscribed to process data updates', {
        subscription: subscriptionName
      });
      
    } catch (error) {
      logger.error('Failed to subscribe to process data', { 
        error: (error as Error).message 
      });
      throw error;
    }
  }

  async subscribeToLabAnalysis(callback: (data: any) => Promise<void>): Promise<void> {
    try {
      const subscriptionName = 'guardian-lab-analysis-subscription';
      const subscription = this.pubsub.subscription(subscriptionName);

      subscription.on('message', async (message) => {
        try {
          const data = JSON.parse(message.data.toString());
          
          logger.info('Received lab analysis message', {
            messageId: message.id,
            analysisType: data.analysisType,
            lsf: data.lsf
          });

          await callback(data);
          message.ack();
          
        } catch (error) {
          logger.error('Error processing lab analysis message', { 
            error: (error as Error).message,
            messageId: message.id
          });
          message.nack();
        }
      });

      logger.info('Subscribed to lab analysis updates', {
        subscription: subscriptionName
      });
      
    } catch (error) {
      logger.error('Failed to subscribe to lab analysis', { 
        error: (error as Error).message 
      });
      throw error;
    }
  }

  async subscribeToEquipmentStatus(callback: (data: any) => Promise<void>): Promise<void> {
    try {
      const subscriptionName = 'guardian-equipment-status-subscription';
      const subscription = this.pubsub.subscription(subscriptionName);

      subscription.on('message', async (message) => {
        try {
          const data = JSON.parse(message.data.toString());
          
          logger.info('Received equipment status message', {
            messageId: message.id,
            equipment: data.equipment,
            status: data.status
          });

          await callback(data);
          message.ack();
          
        } catch (error) {
          logger.error('Error processing equipment status message', { 
            error: (error as Error).message,
            messageId: message.id
          });
          message.nack();
        }
      });

      logger.info('Subscribed to equipment status updates', {
        subscription: subscriptionName
      });
      
    } catch (error) {
      logger.error('Failed to subscribe to equipment status', { 
        error: (error as Error).message 
      });
      throw error;
    }
  }

  async publishSensorData(sensorData: any): Promise<void> {
    try {
      const topicName = 'plant-sensor-data';
      const topic = this.pubsub.topic(topicName);
      
      const message = {
        data: Buffer.from(JSON.stringify(sensorData)),
        attributes: {
          type: 'sensor_update',
          source: 'guardian_agent',
          timestamp: new Date().toISOString()
        }
      };

      const messageId = await topic.publishMessage(message);
      
      logger.info('Sensor data published', {
        messageId,
        dataPoints: sensorData.length
      });
      
    } catch (error) {
      logger.error('Failed to publish sensor data', { 
        error: (error as Error).message 
      });
      throw error;
    }
  }

  async close(): Promise<void> {
    // Close all subscriptions
    for (const [name, subscription] of this.topics) {
      try {
        await subscription.close();
        logger.info('Closed subscription', { name });
      } catch (error) {
        logger.warn('Failed to close subscription', { 
          name, 
          error: (error as Error).message 
        });
      }
    }
    
    logger.info('Pub/Sub service closed');
  }
}