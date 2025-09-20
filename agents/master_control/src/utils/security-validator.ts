import { logger } from './logger';

/**
 * Security validation utilities for Master Control Agent
 * Implements input validation and security checks
 */
export class SecurityValidator {
  // Allowed patterns for different input types
  private static readonly PATTERNS = {
    agentId: /^[a-z][a-z0-9_-]*[a-z0-9]$/,
    messageId: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
    numericValue: /^-?[0-9]+(\.[0-9]+)?$/,
    controlVariable: /^[a-z][a-z0-9_]*$/
  };

  // Maximum sizes to prevent DoS
  private static readonly MAX_SIZES = {
    messagePayload: 1024 * 1024, // 1MB
    stringField: 1000,
    arrayLength: 100
  };

  /**
   * Validate orchestration request
   */
  static validateOrchestrationRequest(request: any): boolean {
    try {
      // Check if request exists and has required fields
      if (!request || typeof request !== 'object') {
        logger.warn('Invalid orchestration request: not an object');
        return false;
      }

      // Validate trigger
      if (!request.trigger || typeof request.trigger !== 'object') {
        logger.warn('Invalid orchestration request: missing or invalid trigger');
        return false;
      }

      // Validate context
      if (!request.context || typeof request.context !== 'object') {
        logger.warn('Invalid orchestration request: missing or invalid context');
        return false;
      }

      // Validate request ID if provided
      if (request.requestId && typeof request.requestId !== 'string') {
        logger.warn('Invalid orchestration request: invalid requestId');
        return false;
      }

      // Check for malicious content
      if (this.containsMaliciousContent(request)) {
        logger.warn('Invalid orchestration request: malicious content detected');
        return false;
      }

      return true;

    } catch (error) {
      logger.error('Orchestration request validation error', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Validate A2A message
   */
  static validateA2AMessage(message: any): boolean {
    try {
      // Check message structure
      if (!message || typeof message !== 'object') {
        return false;
      }

      // Validate required fields
      const requiredFields = ['messageId', 'conversationId', 'senderAgent', 'recipientAgent', 'messageType', 'payload'];
      for (const field of requiredFields) {
        if (!message[field]) {
          logger.warn('A2A message validation failed: missing required field', { field });
          return false;
        }
      }

      // Validate agent IDs
      if (!this.PATTERNS.agentId.test(message.senderAgent) || 
          !this.PATTERNS.agentId.test(message.recipientAgent)) {
        logger.warn('A2A message validation failed: invalid agent ID format');
        return false;
      }

      // Validate message type
      const validMessageTypes = ['proposal', 'decision', 'status', 'data', 'command', 'error'];
      if (!validMessageTypes.includes(message.messageType)) {
        logger.warn('A2A message validation failed: invalid message type', { messageType: message.messageType });
        return false;
      }

      // Check payload size
      if (JSON.stringify(message.payload).length > this.MAX_SIZES.messagePayload) {
        logger.warn('A2A message validation failed: payload too large');
        return false;
      }

      // Check for malicious content
      if (this.containsMaliciousContent(message)) {
        logger.warn('A2A message validation failed: malicious content detected');
        return false;
      }

      return true;

    } catch (error) {
      logger.error('A2A message validation error', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Validate proposal message
   */
  static validateProposalMessage(message: any): boolean {
    try {
      if (!this.validateA2AMessage(message)) {
        return false;
      }

      if (message.messageType !== 'proposal') {
        logger.warn('Proposal validation failed: not a proposal message');
        return false;
      }

      const payload = message.payload;
      
      // Validate proposal structure
      if (!payload.proposalType || !['stability', 'optimization', 'emergency'].includes(payload.proposalType)) {
        logger.warn('Proposal validation failed: invalid proposal type');
        return false;
      }

      if (!payload.urgency || !['low', 'medium', 'high', 'critical'].includes(payload.urgency)) {
        logger.warn('Proposal validation failed: invalid urgency level');
        return false;
      }

      if (!payload.actions || !Array.isArray(payload.actions)) {
        logger.warn('Proposal validation failed: missing or invalid actions');
        return false;
      }

      // Validate each action
      for (const action of payload.actions) {
        if (!this.validateControlAction(action)) {
          return false;
        }
      }

      return true;

    } catch (error) {
      logger.error('Proposal validation error', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Validate control action
   */
  static validateControlAction(action: any): boolean {
    try {
      if (!action || typeof action !== 'object') {
        return false;
      }

      // Validate control variable
      if (!action.controlVariable || !this.PATTERNS.controlVariable.test(action.controlVariable)) {
        logger.warn('Control action validation failed: invalid control variable');
        return false;
      }

      // Validate numeric values
      const numericFields = ['currentValue', 'proposedValue', 'adjustmentMagnitude'];
      for (const field of numericFields) {
        if (action[field] !== undefined) {
          if (typeof action[field] !== 'number' || !this.PATTERNS.numericValue.test(action[field].toString())) {
            logger.warn('Control action validation failed: invalid numeric value', { field });
            return false;
          }
        }
      }

      // Validate execution method
      const validExecutionMethods = ['immediate', 'scheduled', 'conditional', 'gradual'];
      if (action.executionMethod && !validExecutionMethods.includes(action.executionMethod)) {
        logger.warn('Control action validation failed: invalid execution method');
        return false;
      }

      return true;

    } catch (error) {
      logger.error('Control action validation error', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Validate decision message
   */
  static validateDecisionMessage(message: any): boolean {
    try {
      if (!this.validateA2AMessage(message)) {
        return false;
      }

      if (message.messageType !== 'decision') {
        logger.warn('Decision validation failed: not a decision message');
        return false;
      }

      const payload = message.payload;
      
      // Validate decision structure
      if (!payload.decisionType || !['approved', 'rejected', 'modified', 'deferred'].includes(payload.decisionType)) {
        logger.warn('Decision validation failed: invalid decision type');
        return false;
      }

      if (!payload.decisionId || typeof payload.decisionId !== 'string') {
        logger.warn('Decision validation failed: missing or invalid decision ID');
        return false;
      }

      return true;

    } catch (error) {
      logger.error('Decision validation error', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Check for malicious content in request
   */
  private static containsMaliciousContent(request: any): boolean {
    const requestStr = JSON.stringify(request).toLowerCase();
    
    const dangerousPatterns = [
      /<script[^>]*>/i,  // XSS attempts
      /;\s*drop\s+table/i,  // SQL injection
      /__import__/i,  // Python injection
      /eval\s*\(/i,  // Code execution
      /exec\s*\(/i,  // Code execution
      /require\s*\(/i,  // Node.js injection
      /process\.env/i,  // Environment variable access
      /fs\./i,  // File system access
      /child_process/i  // Process execution
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(requestStr)) {
        logger.warn('Malicious content detected', { pattern: pattern.source });
        return true;
      }
    }

    return false;
  }

  /**
   * Sanitize input string
   */
  static sanitizeString(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    // Remove potentially dangerous characters
    return input
      .replace(/[<>\"'&]/g, '') // Remove HTML/XML characters
      .replace(/[;()]/g, '') // Remove command injection characters
      .substring(0, this.MAX_SIZES.stringField); // Limit length
  }

  /**
   * Validate numeric range
   */
  static validateNumericRange(value: number, min: number, max: number): boolean {
    return typeof value === 'number' && 
           !isNaN(value) && 
           isFinite(value) && 
           value >= min && 
           value <= max;
  }
}

