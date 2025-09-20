import { logger } from './logger';

/**
 * Security validation utilities for Optimizer Agent
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
   * Validate optimization request
   */
  static validateOptimizationRequest(request: any): boolean {
    try {
      // Check if request exists and has required fields
      if (!request || typeof request !== 'object') {
        logger.warn('Invalid optimization request: not an object');
        return false;
      }

      // Validate constraints
      if (!request.constraints || !Array.isArray(request.constraints)) {
        logger.warn('Invalid optimization request: missing or invalid constraints');
        return false;
      }

      // Check constraints size
      if (request.constraints.length > this.MAX_SIZES.arrayLength) {
        logger.warn('Invalid optimization request: constraints array too large');
        return false;
      }

      // Validate each constraint
      for (const constraint of request.constraints) {
        if (!this.validateConstraint(constraint)) {
          return false;
        }
      }

      // Validate market data
      if (!request.marketData || typeof request.marketData !== 'object') {
        logger.warn('Invalid optimization request: missing or invalid marketData');
        return false;
      }

      if (!this.validateMarketData(request.marketData)) {
        return false;
      }

      // Validate current state
      if (!request.currentState || typeof request.currentState !== 'object') {
        logger.warn('Invalid optimization request: missing or invalid currentState');
        return false;
      }

      if (!this.validateCurrentState(request.currentState)) {
        return false;
      }

      // Check for malicious content
      if (this.containsMaliciousContent(request)) {
        logger.warn('Invalid optimization request: malicious content detected');
        return false;
      }

      return true;

    } catch (error) {
      logger.error('Optimization request validation error', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Validate constraint
   */
  private static validateConstraint(constraint: any): boolean {
    if (!constraint || typeof constraint !== 'object') {
      logger.warn('Invalid constraint: not an object');
      return false;
    }

    // Check required fields
    if (!constraint.name || typeof constraint.name !== 'string') {
      logger.warn('Invalid constraint: missing or invalid name');
      return false;
    }

    if (!constraint.type || !['inequality', 'equality'].includes(constraint.type)) {
      logger.warn('Invalid constraint: invalid type');
      return false;
    }

    if (!constraint.variables || !Array.isArray(constraint.variables)) {
      logger.warn('Invalid constraint: missing or invalid variables');
      return false;
    }

    if (!constraint.bounds || !Array.isArray(constraint.bounds) || constraint.bounds.length !== 2) {
      logger.warn('Invalid constraint: missing or invalid bounds');
      return false;
    }

    // Validate bounds are numeric
    if (!this.PATTERNS.numericValue.test(constraint.bounds[0].toString()) ||
        !this.PATTERNS.numericValue.test(constraint.bounds[1].toString())) {
      logger.warn('Invalid constraint: non-numeric bounds');
      return false;
    }

    return true;
  }

  /**
   * Validate market data
   */
  private static validateMarketData(marketData: any): boolean {
    const requiredFields = ['coalPrice', 'biomassPrice', 'wastePrice', 'electricityPrice'];
    
    for (const field of requiredFields) {
      if (marketData[field] === undefined || typeof marketData[field] !== 'number') {
        logger.warn('Invalid market data: missing or invalid field', { field });
        return false;
      }

      if (!this.PATTERNS.numericValue.test(marketData[field].toString())) {
        logger.warn('Invalid market data: non-numeric value', { field });
        return false;
      }

      // Check reasonable price ranges
      if (marketData[field] < 0 || marketData[field] > 10000) {
        logger.warn('Invalid market data: price out of reasonable range', { field, value: marketData[field] });
        return false;
      }
    }

    return true;
  }

  /**
   * Validate current state
   */
  private static validateCurrentState(currentState: any): boolean {
    const requiredFields = ['coal_amount', 'biomass_amount', 'waste_amount', 'mill_power'];
    
    for (const field of requiredFields) {
      if (currentState[field] === undefined || typeof currentState[field] !== 'number') {
        logger.warn('Invalid current state: missing or invalid field', { field });
        return false;
      }

      if (!this.PATTERNS.numericValue.test(currentState[field].toString())) {
        logger.warn('Invalid current state: non-numeric value', { field });
        return false;
      }

      // Check reasonable ranges
      if (currentState[field] < 0) {
        logger.warn('Invalid current state: negative value', { field, value: currentState[field] });
        return false;
      }
    }

    return true;
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

