import { logger } from './logger';

export class SecurityValidator {
  static validateCommandRequest(body: any): boolean {
    try {
      // Validate required fields
      if (!body.commandId || !body.action || !body.authorization) {
        return false;
      }

      // Validate action structure
      const action = body.action;
      if (!action.controlVariable || typeof action.proposedValue !== 'number') {
        return false;
      }

      // Validate control variable names (prevent injection)
      const validControlVariables = [
        'kiln_speed', 'fuel_flow', 'feed_rate', 
        'preheater_temp', 'mill_power'
      ];
      
      if (!validControlVariables.includes(action.controlVariable)) {
        logger.warn('Invalid control variable attempted', { 
          controlVariable: action.controlVariable 
        });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Command request validation failed', { 
        error: (error as Error).message 
      });
      return false;
    }
  }

  static validateAuthorization(authorization: string): boolean {
    try {
      // In a real implementation, this would validate JWT tokens
      // For now, check for basic format
      if (!authorization || typeof authorization !== 'string') {
        return false;
      }

      // Basic format validation (Bearer token)
      if (!authorization.startsWith('Bearer ')) {
        return false;
      }

      const token = authorization.substring(7);
      if (token.length < 10) {
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Authorization validation failed', { 
        error: (error as Error).message 
      });
      return false;
    }
  }

  static validateA2AMessage(message: any): boolean {
    try {
      // Validate required fields
      const requiredFields = [
        'messageId', 'conversationId', 'timestamp', 
        'senderAgent', 'messageType', 'payload'
      ];

      for (const field of requiredFields) {
        if (!message[field]) {
          return false;
        }
      }

      // Validate message type
      const validMessageTypes = ['proposal', 'decision', 'status', 'data', 'command'];
      if (!validMessageTypes.includes(message.messageType)) {
        return false;
      }

      return true;
    } catch (error) {
      logger.error('A2A message validation failed', { 
        error: (error as Error).message 
      });
      return false;
    }
  }

  static validateEmergencyAuthorization(authorization?: string): boolean {
    try {
      if (!authorization) {
        return false;
      }

      // Emergency authorization should be more restrictive
      // In a real implementation, this would check for emergency-level permissions
      return authorization.includes('emergency') || authorization.includes('admin');
    } catch (error) {
      logger.error('Emergency authorization validation failed', { 
        error: (error as Error).message 
      });
      return false;
    }
  }
}
