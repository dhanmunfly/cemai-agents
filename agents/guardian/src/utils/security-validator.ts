import { logger } from './logger';

export class SecurityValidator {
  /**
   * Validate prediction request format and content
   */
  static validatePredictionRequest(body: any): boolean {
    try {
      // Check if required fields exist
      if (!body.sensorData || !Array.isArray(body.sensorData)) {
        logger.warn('Invalid prediction request: missing or invalid sensorData');
        return false;
      }

      // Validate sensor data structure
      for (const dataPoint of body.sensorData) {
        if (!dataPoint.timestamp || !dataPoint.lsf) {
          logger.warn('Invalid sensor data point: missing timestamp or lsf');
          return false;
        }

        // Validate LSF value range
        if (typeof dataPoint.lsf !== 'number' || dataPoint.lsf < 0 || dataPoint.lsf > 200) {
          logger.warn('Invalid LSF value: out of range', { lsf: dataPoint.lsf });
          return false;
        }

        // Validate timestamp format
        if (isNaN(Date.parse(dataPoint.timestamp))) {
          logger.warn('Invalid timestamp format', { timestamp: dataPoint.timestamp });
          return false;
        }
      }

      // Validate prediction horizon if provided
      if (body.predictionHorizon && 
          (typeof body.predictionHorizon !== 'number' || 
           body.predictionHorizon < 1 || 
           body.predictionHorizon > 120)) {
        logger.warn('Invalid prediction horizon', { horizon: body.predictionHorizon });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error validating prediction request', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Validate optimization request format and content
   */
  static validateOptimizationRequest(body: any): boolean {
    try {
      // Check required fields
      if (!body.constraints || !Array.isArray(body.constraints)) {
        logger.warn('Invalid optimization request: missing or invalid constraints');
        return false;
      }

      if (!body.marketData || typeof body.marketData !== 'object') {
        logger.warn('Invalid optimization request: missing or invalid marketData');
        return false;
      }

      if (!body.currentState || typeof body.currentState !== 'object') {
        logger.warn('Invalid optimization request: missing or invalid currentState');
        return false;
      }

      // Validate constraints
      for (const constraint of body.constraints) {
        if (!constraint.name || !constraint.type || !constraint.variables || !constraint.bounds) {
          logger.warn('Invalid constraint structure', { constraint });
          return false;
        }
      }

      // Validate market data
      const requiredMarketFields = ['coalPrice', 'biomassPrice', 'wastePrice', 'electricityPrice'];
      for (const field of requiredMarketFields) {
        if (typeof body.marketData[field] !== 'number' || body.marketData[field] < 0) {
          logger.warn('Invalid market data field', { field, value: body.marketData[field] });
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error('Error validating optimization request', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Validate orchestration request format and content
   */
  static validateOrchestrationRequest(body: any): boolean {
    try {
      // Check required fields
      if (!body.trigger || typeof body.trigger !== 'string') {
        logger.warn('Invalid orchestration request: missing or invalid trigger');
        return false;
      }

      if (!body.context || typeof body.context !== 'object') {
        logger.warn('Invalid orchestration request: missing or invalid context');
        return false;
      }

      // Validate trigger values
      const validTriggers = ['quality_deviation', 'market_change', 'emergency', 'scheduled'];
      if (!validTriggers.includes(body.trigger)) {
        logger.warn('Invalid trigger value', { trigger: body.trigger });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error validating orchestration request', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Validate A2A message format and content
   */
  static validateA2AMessage(message: any): boolean {
    try {
      // Check required fields
      const requiredFields = [
        'messageId', 'conversationId', 'timestamp', 'senderAgent', 
        'recipientAgent', 'messageType', 'payload', 'protocolVersion'
      ];

      for (const field of requiredFields) {
        if (!message[field]) {
          logger.warn('Invalid A2A message: missing required field', { field });
          return false;
        }
      }

      // Validate message type
      const validMessageTypes = ['proposal', 'decision', 'status', 'data', 'command'];
      if (!validMessageTypes.includes(message.messageType)) {
        logger.warn('Invalid A2A message type', { messageType: message.messageType });
        return false;
      }

      // Validate protocol version
      if (message.protocolVersion !== '1.0') {
        logger.warn('Invalid A2A protocol version', { version: message.protocolVersion });
        return false;
      }

      // Validate timestamp format
      if (isNaN(Date.parse(message.timestamp))) {
        logger.warn('Invalid A2A message timestamp', { timestamp: message.timestamp });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error validating A2A message', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Validate command request format and content
   */
  static validateCommandRequest(body: any): boolean {
    try {
      // Check required fields
      if (!body.commandId || typeof body.commandId !== 'string') {
        logger.warn('Invalid command request: missing or invalid commandId');
        return false;
      }

      if (!body.action || typeof body.action !== 'object') {
        logger.warn('Invalid command request: missing or invalid action');
        return false;
      }

      if (!body.authorization || typeof body.authorization !== 'string') {
        logger.warn('Invalid command request: missing or invalid authorization');
        return false;
      }

      // Validate action structure
      const requiredActionFields = ['controlVariable', 'currentValue', 'proposedValue'];
      for (const field of requiredActionFields) {
        if (!body.action[field]) {
          logger.warn('Invalid command action: missing required field', { field });
          return false;
        }
      }

      // Validate value types
      if (typeof body.action.currentValue !== 'number' || 
          typeof body.action.proposedValue !== 'number') {
        logger.warn('Invalid command action: non-numeric values');
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error validating command request', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Sanitize input data to prevent injection attacks
   */
  static sanitizeInput(input: any): any {
    try {
      if (typeof input === 'string') {
        // Remove potentially dangerous characters
        return input
          .replace(/<script[^>]*>.*?<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .trim();
      }

      if (Array.isArray(input)) {
        return input.map(item => this.sanitizeInput(item));
      }

      if (typeof input === 'object' && input !== null) {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(input)) {
          sanitized[key] = this.sanitizeInput(value);
        }
        return sanitized;
      }

      return input;
    } catch (error) {
      logger.error('Error sanitizing input', { error: (error as Error).message });
      return input;
    }
  }

  /**
   * Validate authentication token (placeholder implementation)
   */
  static validateToken(token: string): boolean {
    try {
      // In a real implementation, this would validate the IAM token
      // For now, we'll do basic format validation
      if (!token || typeof token !== 'string') {
        return false;
      }

      // Basic JWT format check
      const parts = token.split('.');
      if (parts.length !== 3) {
        logger.warn('Invalid token format');
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error validating token', { error: (error as Error).message });
      return false;
    }
  }
}