import { OPCUAClient, MessageSecurityMode, SecurityPolicy, AttributeIds, makeBrowsePath, ClientSubscription, TimestampsToReturn, MonitoringParametersOptions, ReadValueIdOptions, ClientMonitoredItem, DataValue, ClientSession, DataType, Variant } from 'node-opcua';
import { logger } from './logger';
import { OPCUA_CONFIG, PLANT_SYSTEMS, COMMAND_TYPES, SAFETY_CHECKS, COMMAND_VALIDATION } from '../config/constants';

export interface OPCUACommand {
  commandId: string;
  action: {
    controlVariable: string;
    currentValue: number;
    proposedValue: number;
    adjustmentMagnitude: number;
    executionMethod?: string;
    safetyChecksRequired?: boolean;
  };
  authorization: string;
  priority: string;
}

export interface OPCUAConnectionStatus {
  connected: boolean;
  lastConnected?: Date;
  lastError?: string;
  connectionAttempts: number;
  monitoredNodes: number;
}

interface PlantSystem {
  name: string;
  variables: string[];
  safetyLimits: Record<string, { min: number; max: number }>;
}

export class OPCUAClientService {
  private client: OPCUAClient;
  private endpoint: string;
  private session?: ClientSession;
  private connectionStatus: OPCUAConnectionStatus;
  private subscription?: ClientSubscription;
  private monitoredItems: Map<string, ClientMonitoredItem> = new Map();
  private reconnectTimer?: NodeJS.Timeout;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
    this.connectionStatus = {
      connected: false,
      connectionAttempts: 0,
      monitoredNodes: 0
    };

    this.client = OPCUAClient.create({
      applicationName: 'CemAI Egress Agent',
      connectionStrategy: {
        initialDelay: 1000,
        maxRetry: 5
      },
      securityMode: MessageSecurityMode.None,
      securityPolicy: SecurityPolicy.None,
      endpoint_must_exist: false
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connection_lost', () => {
      logger.warn('OPC-UA connection lost');
      this.connectionStatus.connected = false;
      this.connectionStatus.lastError = 'Connection lost';
      this.scheduleReconnect();
    });

    this.client.on('connection_reestablished', () => {
      logger.info('OPC-UA connection reestablished');
      this.connectionStatus.connected = true;
      this.connectionStatus.lastConnected = new Date();
      this.resumeMonitoring();
    });

    this.client.on('error', (error) => {
      logger.error('OPC-UA client error', { error: error.message });
      this.connectionStatus.lastError = error.message;
    });
  }

  async connect(): Promise<boolean> {
    try {
      logger.info('Connecting to OPC-UA server', { endpoint: this.endpoint });

      await this.client.connect(this.endpoint);
      
      this.session = await this.client.createSession();
      
      // Create subscription for monitoring
      this.subscription = ClientSubscription.create(this.session, {
        requestedPublishingInterval: 1000,
        requestedLifetimeCount: 100,
        requestedMaxKeepAliveCount: 10,
        maxNotificationsPerPublish: 100,
        publishingEnabled: true,
        priority: 10
      });

      this.subscription.on('started', () => {
        logger.info('OPC-UA subscription started');
      });

      this.subscription.on('keepalive', () => {
        logger.debug('OPC-UA subscription keepalive');
      });

      this.subscription.on('terminated', () => {
        logger.warn('OPC-UA subscription terminated');
      });

      this.connectionStatus.connected = true;
      this.connectionStatus.lastConnected = new Date();
      this.connectionStatus.connectionAttempts = 0;

      logger.info('OPC-UA connection established successfully');
      return true;

    } catch (error) {
      logger.error('Failed to connect to OPC-UA server', { 
        error: (error as Error).message,
        endpoint: this.endpoint
      });
      
      this.connectionStatus.connected = false;
      this.connectionStatus.lastError = (error as Error).message;
      this.connectionStatus.connectionAttempts++;
      
      this.scheduleReconnect();
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = undefined;
      }

      if (this.subscription) {
        await this.subscription.terminate();
        this.subscription = undefined;
      }

      if (this.session) {
        await this.session.close();
        this.session = undefined;
      }

      await this.client.disconnect();
      this.connectionStatus.connected = false;

      logger.info('OPC-UA connection closed');
    } catch (error) {
      logger.error('Error disconnecting from OPC-UA server', { 
        error: (error as Error).message 
      });
    }
  }

  async executeCommand(command: OPCUACommand): Promise<any> {
    try {
      if (!this.connectionStatus.connected) {
        throw new Error('OPC-UA server not connected');
      }

      logger.info('Executing OPC-UA command', {
        commandId: command.commandId,
        controlVariable: command.action.controlVariable,
        proposedValue: command.action.proposedValue
      });

      // Perform safety checks if required
      if (command.action.safetyChecksRequired !== false) {
        await this.performSafetyChecks(command);
      }

      // Validate command parameters
      await this.validateCommand(command);

      // Execute the command
      const result = await this.writeValue(
        command.action.controlVariable,
        command.action.proposedValue
      );

      logger.info('OPC-UA command executed successfully', {
        commandId: command.commandId,
        controlVariable: command.action.controlVariable,
        result
      });

      return {
        commandId: command.commandId,
        status: 'success',
        result,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to execute OPC-UA command', {
        commandId: command.commandId,
        error: (error as Error).message
      });

      return {
        commandId: command.commandId,
        status: 'failed',
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async readValue(nodeId: string): Promise<any> {
    try {
      if (!this.session) {
        throw new Error('No active OPC-UA session');
      }

      const dataValue = await this.session.read({
        nodeId: nodeId,
        attributeId: AttributeIds.Value
      });

      return {
        nodeId,
        value: dataValue.value.value,
        timestamp: dataValue.sourceTimestamp,
        status: dataValue.statusCode.isGood() ? 'good' : 'bad'
      };

    } catch (error) {
      logger.error('Failed to read OPC-UA value', {
        nodeId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  async writeValue(nodeId: string, value: any): Promise<any> {
    try {
      if (!this.session) {
        throw new Error('No active OPC-UA session');
      }

      const dataType = this.getDataType(value);
      const statusCode = await this.session.write({
        nodeId: nodeId,
        attributeId: AttributeIds.Value,
        value: new DataValue({
          value: new Variant({
            dataType: DataType[dataType as keyof typeof DataType],
            value: value
          })
        })
      });

      if (statusCode.value !== 0) {
        throw new Error(`Write failed with status: ${statusCode.description}`);
      }

      return {
        nodeId,
        value,
        statusCode: statusCode.description,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to write OPC-UA value', {
        nodeId,
        value,
        error: (error as Error).message
      });
      throw error;
    }
  }

  async monitorNode(nodeId: string, callback: (data: DataValue) => void): Promise<void> {
    try {
      if (!this.subscription) {
        throw new Error('No active OPC-UA subscription');
      }
      if (!this.session) {
        throw new Error('No active OPC-UA session');
      }

      const itemToMonitor: ReadValueIdOptions = {
        nodeId: nodeId,
        attributeId: AttributeIds.Value
      };

      const parameters: MonitoringParametersOptions = {
        samplingInterval: 1000,
        discardOldest: true,
        queueSize: 10
      };

      const monitoredItem = ClientMonitoredItem.create(
        this.subscription,
        itemToMonitor,
        parameters,
        TimestampsToReturn.Both
      );

      monitoredItem.on('changed', (dataValue: DataValue) => {
        callback(dataValue);
      });

      this.monitoredItems.set(nodeId, monitoredItem);
      this.connectionStatus.monitoredNodes++;

      logger.info('Started monitoring OPC-UA node', {
        nodeId,
        monitoredNodes: this.connectionStatus.monitoredNodes
      });

    } catch (error) {
      logger.error('Failed to monitor OPC-UA node', {
        nodeId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  async stopMonitoringNode(nodeId: string): Promise<void> {
    try {
      const monitoredItem = this.monitoredItems.get(nodeId);
      if (monitoredItem) {
        await monitoredItem.terminate();
        this.monitoredItems.delete(nodeId);
        this.connectionStatus.monitoredNodes--;

        logger.info('Stopped monitoring OPC-UA node', {
          nodeId,
          monitoredNodes: this.connectionStatus.monitoredNodes
        });
      }
    } catch (error) {
      logger.error('Failed to stop monitoring OPC-UA node', {
        nodeId,
        error: (error as Error).message
      });
    }
  }

  async emergencyStop(): Promise<any> {
    try {
      logger.warn('Emergency stop initiated');

      // Stop all monitoring
      for (const [nodeId, monitoredItem] of this.monitoredItems) {
        try {
          await monitoredItem.terminate();
        } catch (error) {
          logger.warn('Failed to stop monitoring during emergency stop', {
            nodeId,
            error: (error as Error).message
          });
        }
      }

      this.monitoredItems.clear();
      this.connectionStatus.monitoredNodes = 0;

      // Disconnect from OPC-UA server
      await this.disconnect();

      logger.warn('Emergency stop completed');

      return {
        status: 'success',
        message: 'Emergency stop completed',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Emergency stop failed', { 
        error: (error as Error).message 
      });
      
      return {
        status: 'failed',
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      };
    }
  }

  getConnectionStatus(): OPCUAConnectionStatus {
    return { ...this.connectionStatus };
  }

  async isConnected(): Promise<boolean> {
    return this.connectionStatus.connected;
  }

  async getServerInfo(): Promise<any> {
    if (!this.session) {
      throw new Error('No active session');
    }
    return {
      endpoint: this.endpoint,
      sessionId: this.session.sessionId,
      securityMode: this.client.securityMode,
      securityPolicy: this.client.securityPolicy,
      status: 'connected',
      capabilities: [] // Add actual capabilities if needed
    };
  }

  async validateNodeExists(nodeId: string): Promise<boolean> {
    try {
      await this.readValue(nodeId);
      return true;
    } catch {
      return false;
    }
  }

  async getNodeAttributes(nodeId: string): Promise<any> {
    if (!this.session) {
      throw new Error('No active session');
    }
    const attributesToRead = [
      { nodeId, attributeId: AttributeIds.NodeClass },
      { nodeId, attributeId: AttributeIds.BrowseName },
      { nodeId, attributeId: AttributeIds.DisplayName },
      { nodeId, attributeId: AttributeIds.DataType },
      { nodeId, attributeId: AttributeIds.ValueRank }
    ];
    const results = await this.session.read(attributesToRead);
    const info: { [key: string]: any } = {};
    results.forEach((result, index) => {
      const attr = attributesToRead[index].attributeId;
      info[AttributeIds[attr]] = result.value?.value;
    });
    return info;
  }

  private async performSafetyChecks(command: OPCUACommand): Promise<void> {
    try {
      const controlVariable = command.action.controlVariable;
      const proposedValue = command.action.proposedValue;

      // Find the system and safety limits for this control variable
      let safetyLimits: { min: number; max: number } | null = null;
      for (const system of Object.values(PLANT_SYSTEMS) as PlantSystem[]) {
        if (system.safetyLimits[controlVariable]) {
          safetyLimits = system.safetyLimits[controlVariable];
          break;
        }
      }

      if (!safetyLimits) {
        logger.warn('No safety limits found for control variable', { controlVariable });
        return;
      }

      // Check if proposed value is within safety limits
      if (proposedValue < safetyLimits.min || proposedValue > safetyLimits.max) {
        throw new Error(
          `Proposed value ${proposedValue} for ${controlVariable} is outside safety limits [${safetyLimits.min}, ${safetyLimits.max}]`
        );
      }

      // Check adjustment magnitude
      const adjustmentPercent = Math.abs(command.action.adjustmentMagnitude) / command.action.currentValue * 100;
      if (adjustmentPercent > COMMAND_VALIDATION.maxAdjustmentPercent) {
        throw new Error(
          `Adjustment magnitude ${adjustmentPercent.toFixed(2)}% exceeds maximum allowed ${COMMAND_VALIDATION.maxAdjustmentPercent}%`
        );
      }

      logger.info('Safety checks passed', {
        controlVariable,
        proposedValue,
        safetyLimits,
        adjustmentPercent: adjustmentPercent.toFixed(2)
      });

    } catch (error) {
      logger.error('Safety checks failed', {
        commandId: command.commandId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  private async validateCommand(command: OPCUACommand): Promise<void> {
    try {
      // Validate command structure
      if (!command.commandId || !command.action || !command.authorization) {
        throw new Error('Invalid command structure');
      }

      // Validate control variable exists
      const controlVariable = command.action.controlVariable;
      let variableExists = false;
      for (const system of Object.values(PLANT_SYSTEMS) as PlantSystem[]) {
        if (system.variables.includes(controlVariable)) {
          variableExists = true;
          break;
        }
      }

      if (!variableExists) {
        throw new Error(`Unknown control variable: ${controlVariable}`);
      }

      // Validate values are numeric
      if (typeof command.action.currentValue !== 'number' || 
          typeof command.action.proposedValue !== 'number') {
        throw new Error('Control values must be numeric');
      }

      logger.info('Command validation passed', {
        commandId: command.commandId,
        controlVariable
      });

    } catch (error) {
      logger.error('Command validation failed', {
        commandId: command.commandId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return; // Already scheduled
    }

    const delay = Math.min(1000 * Math.pow(2, this.connectionStatus.connectionAttempts), 30000);
    
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = undefined;
      
      if (this.connectionStatus.connectionAttempts < 5) {
        logger.info('Attempting to reconnect to OPC-UA server', {
          attempt: this.connectionStatus.connectionAttempts + 1,
          delay
        });
        
        await this.connect();
      } else {
        logger.error('Maximum reconnection attempts reached');
      }
    }, delay);
  }

  private async resumeMonitoring(): Promise<void> {
    // In a real implementation, this would restore monitoring for all previously monitored nodes
    logger.info('Resuming OPC-UA monitoring');
  }

  private getDataType(value: any): any {
    if (typeof value === 'number') {
      return 'Double';
    } else if (typeof value === 'boolean') {
      return 'Boolean';
    } else if (typeof value === 'string') {
      return 'String';
    } else {
      return 'Double'; // Default to Double
    }
  }
}