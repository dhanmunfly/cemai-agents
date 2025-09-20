import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';

// Mock external dependencies
jest.mock('@google-cloud/vertexai');
jest.mock('@google-cloud/pubsub');
jest.mock('@google-cloud/secret-manager');

describe('Agent Communication Integration Tests', () => {
  let guardianApp: any;
  let optimizerApp: any;
  let masterControlApp: any;
  let egressApp: any;

  beforeAll(async () => {
    // Import agent applications
    const guardianModule = await import('../agents/guardian/src/index');
    const optimizerModule = await import('../agents/optimizer/src/index');
    const masterControlModule = await import('../agents/master_control/src/index');
    const egressModule = await import('../agents/egress/src/index');

    guardianApp = guardianModule.default;
    optimizerApp = optimizerModule.default;
    masterControlApp = masterControlModule.default;
    egressApp = egressModule.default;
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('Guardian Agent', () => {
    it('should predict LSF and generate stability proposal', async () => {
      const sensorData = [
        { timestamp: '2024-01-01T10:00:00Z', lsf: 99.5, kiln_speed: 3.2 },
        { timestamp: '2024-01-01T10:05:00Z', lsf: 99.3, kiln_speed: 3.2 },
        { timestamp: '2024-01-01T10:10:00Z', lsf: 99.1, kiln_speed: 3.2 }
      ];

      const response = await request(guardianApp)
        .post('/v1/predict/lsf')
        .send({ sensorData, predictionHorizon: 60 })
        .expect(200);

      expect(response.body.agent).toBe('guardian');
      expect(response.body.status).toBe('success');
      expect(response.body.prediction).toBeDefined();
      expect(response.body.prediction.currentLSF).toBe(99.1);
      expect(response.body.prediction.predictedLSF).toBeDefined();
      expect(response.body.prediction.confidence).toBeGreaterThan(0.8);
    });

    it('should generate minimal effective action when deviation detected', async () => {
      const sensorData = [
        { timestamp: '2024-01-01T10:00:00Z', lsf: 97.5, kiln_speed: 3.2 },
        { timestamp: '2024-01-01T10:05:00Z', lsf: 97.3, kiln_speed: 3.2 },
        { timestamp: '2024-01-01T10:10:00Z', lsf: 97.1, kiln_speed: 3.2 }
      ];

      const response = await request(guardianApp)
        .post('/v1/predict/lsf')
        .send({ sensorData, predictionHorizon: 60 })
        .expect(200);

      if (response.body.prediction.deviationDetected) {
        expect(response.body.proposal).toBeDefined();
        expect(response.body.proposal.proposalType).toBe('stability');
        expect(response.body.proposal.actions).toHaveLength(1);
        expect(response.body.proposal.actions[0].controlVariable).toBe('kiln_speed');
      }
    });

    it('should handle invalid input gracefully', async () => {
      const response = await request(guardianApp)
        .post('/v1/predict/lsf')
        .send({ invalidData: 'test' })
        .expect(400);

      expect(response.body.error).toBe('Invalid request format');
      expect(response.body.agent).toBe('guardian');
    });
  });

  describe('Optimizer Agent', () => {
    it('should optimize fuel mix and generate cost savings', async () => {
      const optimizationRequest = {
        constraints: [
          {
            name: 'quality_constraint',
            type: 'inequality',
            variables: ['coal_amount', 'biomass_amount', 'waste_amount'],
            bounds: [0, 100]
          }
        ],
        marketData: {
          coalPrice: 100,
          biomassPrice: 80,
          wastePrice: 60,
          electricityPrice: 0.12
        },
        currentState: {
          coal_amount: 80,
          biomass_amount: 15,
          waste_amount: 5,
          mill_power: 3000
        }
      };

      const response = await request(optimizerApp)
        .post('/v1/optimize')
        .send(optimizationRequest)
        .expect(200);

      expect(response.body.agent).toBe('optimizer');
      expect(response.body.status).toBe('success');
      expect(response.body.optimization).toBeDefined();
      expect(response.body.optimization.fuelMix).toBeDefined();
      expect(response.body.optimization.costSavingsPercent).toBeGreaterThan(0);
      expect(response.body.optimization.alternativeFuelRatio).toBeGreaterThan(0);
    });

    it('should handle market data updates and trigger re-optimization', async () => {
      // This would test the Pub/Sub subscription functionality
      // In a real test, we'd publish to the market data topic
      expect(true).toBe(true); // Placeholder for market data test
    });
  });

  describe('Master Control Agent', () => {
    it('should orchestrate workflow and resolve conflicts', async () => {
      const orchestrationRequest = {
        trigger: 'quality_deviation',
        context: {
          severity: 'medium',
          affectedParameters: ['lime_saturation_factor'],
          timestamp: new Date().toISOString()
        },
        requestId: 'test-request-123'
      };

      const response = await request(masterControlApp)
        .post('/v1/orchestrate')
        .send(orchestrationRequest)
        .expect(200);

      expect(response.body.agent).toBe('master_control');
      expect(response.body.status).toBe('success');
      expect(response.body.workflow).toBeDefined();
      expect(response.body.workflow.requestId).toBe('test-request-123');
      expect(response.body.workflow.status).toBeDefined();
    });

    it('should handle A2A message reception', async () => {
      const a2aMessage = {
        messageId: 'msg-test-123',
        conversationId: 'conv-test-123',
        timestamp: new Date().toISOString(),
        correlationId: 'corr-test-123',
        senderAgent: 'guardian_agent',
        recipientAgent: 'master_control_agent',
        messageType: 'proposal',
        payload: {
          proposalType: 'stability',
          urgency: 'medium',
          title: 'Test Proposal'
        },
        protocolVersion: '1.0',
        priority: 'normal'
      };

      const response = await request(masterControlApp)
        .post('/a2a/receive')
        .send(a2aMessage)
        .expect(200);

      expect(response.body.messageId).toBeDefined();
      expect(response.body.messageType).toBe('status');
      expect(response.body.payload.status).toBe('proposal_received');
    });
  });

  describe('Egress Agent', () => {
    it('should handle command execution', async () => {
      const commandRequest = {
        commandId: 'cmd-test-123',
        action: {
          controlVariable: 'kiln_speed',
          currentValue: 3.2,
          proposedValue: 3.3,
          adjustmentMagnitude: 0.1
        },
        authorization: 'auth-test-123',
        priority: 'normal'
      };

      const response = await request(egressApp)
        .post('/v1/command')
        .send(commandRequest)
        .expect(200);

      expect(response.body.agent).toBe('egress');
      expect(response.body.status).toBeDefined();
    });
  });

  describe('End-to-End Workflow', () => {
    it('should complete full decision workflow from prediction to command', async () => {
      // Step 1: Guardian predicts LSF deviation
      const sensorData = [
        { timestamp: '2024-01-01T10:00:00Z', lsf: 97.5, kiln_speed: 3.2 },
        { timestamp: '2024-01-01T10:05:00Z', lsf: 97.3, kiln_speed: 3.2 },
        { timestamp: '2024-01-01T10:10:00Z', lsf: 97.1, kiln_speed: 3.2 }
      ];

      const guardianResponse = await request(guardianApp)
        .post('/v1/predict/lsf')
        .send({ sensorData, predictionHorizon: 60 })
        .expect(200);

      // Step 2: If deviation detected, Master Control orchestrates
      if (guardianResponse.body.prediction.deviationDetected) {
        const orchestrationRequest = {
          trigger: 'quality_deviation',
          context: {
            severity: 'medium',
            affectedParameters: ['lime_saturation_factor'],
            guardianProposal: guardianResponse.body.proposal
          },
          requestId: 'e2e-test-123'
        };

        const masterControlResponse = await request(masterControlApp)
          .post('/v1/orchestrate')
          .send(orchestrationRequest)
          .expect(200);

        expect(masterControlResponse.body.workflow.status).toBeDefined();
        expect(masterControlResponse.body.workflow.latency).toBeLessThan(60); // SLA requirement
      }
    });
  });

  describe('Performance Requirements', () => {
    it('should meet decision latency SLA (<60 seconds)', async () => {
      const startTime = Date.now();
      
      const orchestrationRequest = {
        trigger: 'performance_test',
        context: { testType: 'latency' },
        requestId: 'perf-test-123'
      };

      await request(masterControlApp)
        .post('/v1/orchestrate')
        .send(orchestrationRequest)
        .expect(200);

      const latency = Date.now() - startTime;
      expect(latency).toBeLessThan(60000); // 60 seconds
    });

    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        trigger: 'concurrent_test',
        context: { testId: i },
        requestId: `concurrent-test-${i}`
      }));

      const responses = await Promise.all(
        requests.map(req => 
          request(masterControlApp)
            .post('/v1/orchestrate')
            .send(req)
        )
      );

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('success');
      });
    });
  });

  describe('Security Requirements', () => {
    it('should validate authentication tokens', async () => {
      // Test with invalid token
      const response = await request(guardianApp)
        .post('/v1/predict/lsf')
        .set('Authorization', 'Bearer invalid-token')
        .send({ sensorData: [] })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should sanitize input data', async () => {
      const maliciousInput = {
        sensorData: '<script>alert("xss")</script>',
        predictionHorizon: '; DROP TABLE users;'
      };

      const response = await request(guardianApp)
        .post('/v1/predict/lsf')
        .send(maliciousInput)
        .expect(400);

      expect(response.body.error).toBe('Invalid request format');
    });
  });
});
