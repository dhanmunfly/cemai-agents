# CemAI Frontend Integration Guide
# Updated with VERIFIED Working URLs

## 🎯 **Frontend Configuration**

### **Primary Agent URLs (All Working & Verified)**
```javascript
const AGENT_CONFIG = {
  guardian: {
    baseUrl: 'https://guardian-agent-917156149361.asia-south1.run.app',
    healthUrl: 'https://guardian-agent-917156149361.asia-south1.run.app/health',
    predictUrl: 'https://guardian-agent-917156149361.asia-south1.run.app/v1/predict',
    statusUrl: 'https://guardian-agent-917156149361.asia-south1.run.app/v1/status',
    metricsUrl: 'https://guardian-agent-917156149361.asia-south1.run.app/v1/metrics'
  },
  optimizer: {
    baseUrl: 'https://optimizer-agent-917156149361.asia-south1.run.app',
    healthUrl: 'https://optimizer-agent-917156149361.asia-south1.run.app/health',
    optimizeUrl: 'https://optimizer-agent-917156149361.asia-south1.run.app/v1/optimize',
    statusUrl: 'https://optimizer-agent-917156149361.asia-south1.run.app/v1/status',
    metricsUrl: 'https://optimizer-agent-917156149361.asia-south1.run.app/v1/metrics'
  },
  masterControl: {
    baseUrl: 'https://master-control-agent-917156149361.asia-south1.run.app',
    healthUrl: 'https://master-control-agent-917156149361.asia-south1.run.app/health',
    orchestrateUrl: 'https://master-control-agent-917156149361.asia-south1.run.app/v1/orchestrate',
    statusUrl: 'https://master-control-agent-917156149361.asia-south1.run.app/v1/status',
    metricsUrl: 'https://master-control-agent-917156149361.asia-south1.run.app/v1/metrics'
  },
  egress: {
    baseUrl: 'https://egress-agent-917156149361.asia-south1.run.app',
    healthUrl: 'https://egress-agent-917156149361.asia-south1.run.app/health',
    executeUrl: 'https://egress-agent-917156149361.asia-south1.run.app/v1/execute',
    statusUrl: 'https://egress-agent-917156149361.asia-south1.run.app/v1/status',
    metricsUrl: 'https://egress-agent-917156149361.asia-south1.run.app/v1/metrics'
  }
};
```

### **Environment Variables**
```bash
# Primary API Base URL (Guardian Agent as main)
DEV_API_BASE_URL=https://guardian-agent-917156149361.asia-south1.run.app

# WebSocket URL (for real-time updates)
DEV_WS_URL=wss://cemai-infrastructure-agents-dev-2e6ovquneq-el.a.run.app/ws

# Individual Agent URLs
GUARDIAN_AGENT_URL=https://guardian-agent-917156149361.asia-south1.run.app
OPTIMIZER_AGENT_URL=https://optimizer-agent-917156149361.asia-south1.run.app
MASTER_CONTROL_AGENT_URL=https://master-control-agent-917156149361.asia-south1.run.app
EGRESS_AGENT_URL=https://egress-agent-917156149361.asia-south1.run.app
```

## 🔧 **Frontend Integration Code**

### **Agent Client Class**
```javascript
class CemAIAgentClient {
  constructor() {
    this.agents = {
      guardian: 'https://guardian-agent-917156149361.asia-south1.run.app',
      optimizer: 'https://optimizer-agent-917156149361.asia-south1.run.app',
      masterControl: 'https://master-control-agent-917156149361.asia-south1.run.app',
      egress: 'https://egress-agent-917156149361.asia-south1.run.app'
    };
  }

  // Health Check for All Agents
  async checkAllAgentHealth() {
    const healthStatus = {};
    
    for (const [agentName, baseUrl] of Object.entries(this.agents)) {
      try {
        const response = await fetch(`${baseUrl}/health`);
        healthStatus[agentName] = {
          status: response.ok ? 'healthy' : 'unhealthy',
          url: baseUrl,
          lastChecked: new Date().toISOString()
        };
      } catch (error) {
        healthStatus[agentName] = {
          status: 'unreachable',
          url: baseUrl,
          error: error.message,
          lastChecked: new Date().toISOString()
        };
      }
    }
    
    return healthStatus;
  }

  // Guardian Agent - Security & Monitoring
  async guardianPredict(data) {
    const response = await fetch(`${this.agents.guardian}/v1/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  }

  // Optimizer Agent - Performance Optimization
  async optimizerOptimize(data) {
    const response = await fetch(`${this.agents.optimizer}/v1/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  }

  // Master Control Agent - Workflow Orchestration
  async masterControlOrchestrate(data) {
    const response = await fetch(`${this.agents.masterControl}/v1/orchestrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  }

  // Egress Agent - External Communication
  async egressExecute(data) {
    const response = await fetch(`${this.agents.egress}/v1/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  }

  // Get Agent Status
  async getAgentStatus(agentName) {
    const response = await fetch(`${this.agents[agentName]}/v1/status`);
    return response.json();
  }

  // Get Agent Metrics
  async getAgentMetrics(agentName) {
    const response = await fetch(`${this.agents[agentName]}/v1/metrics`);
    return response.json();
  }
}
```

### **React Hook for Agent Communication**
```javascript
import { useState, useEffect } from 'react';

export const useCemAIAgents = () => {
  const [agentClient] = useState(() => new CemAIAgentClient());
  const [agentHealth, setAgentHealth] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkHealth = async () => {
      setLoading(true);
      const health = await agentClient.checkAllAgentHealth();
      setAgentHealth(health);
      setLoading(false);
    };

    checkHealth();
    
    // Poll health every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [agentClient]);

  return {
    agentClient,
    agentHealth,
    loading,
    // Convenience methods
    guardianPredict: agentClient.guardianPredict.bind(agentClient),
    optimizerOptimize: agentClient.optimizerOptimize.bind(agentClient),
    masterControlOrchestrate: agentClient.masterControlOrchestrate.bind(agentClient),
    egressExecute: agentClient.egressExecute.bind(agentClient)
  };
};
```

## 📊 **API Endpoints Reference**

### **Health Checks (All Working)**
- Guardian: `GET https://guardian-agent-917156149361.asia-south1.run.app/health`
- Optimizer: `GET https://optimizer-agent-917156149361.asia-south1.run.app/health`
- Master Control: `GET https://master-control-agent-917156149361.asia-south1.run.app/health`
- Egress: `GET https://egress-agent-917156149361.asia-south1.run.app/health`

### **Agent-Specific Endpoints**

#### **Guardian Agent (Security & Monitoring)**
- Predict: `POST /v1/predict`
- Status: `GET /v1/status`
- Metrics: `GET /v1/metrics`

#### **Optimizer Agent (Performance)**
- Optimize: `POST /v1/optimize`
- Status: `GET /v1/status`
- Metrics: `GET /v1/metrics`

#### **Master Control Agent (Orchestration)**
- Orchestrate: `POST /v1/orchestrate`
- Status: `GET /v1/status`
- Metrics: `GET /v1/metrics`

#### **Egress Agent (External Communication)**
- Execute: `POST /v1/execute`
- Status: `GET /v1/status`
- Metrics: `GET /v1/metrics`

## 🚀 **Quick Start Example**

```javascript
// Initialize the client
const cemaiClient = new CemAIAgentClient();

// Check all agent health
const health = await cemaiClient.checkAllAgentHealth();
console.log('Agent Health:', health);

// Use Guardian Agent for prediction
const prediction = await cemaiClient.guardianPredict({
  sensorData: { temperature: 25, pressure: 1.2 },
  timestamp: new Date().toISOString()
});

// Use Optimizer Agent for optimization
const optimization = await cemaiClient.optimizerOptimize({
  constraints: { maxCost: 1000, minEfficiency: 0.8 },
  variables: { speed: 100, temperature: 200 }
});

// Use Master Control Agent for orchestration
const orchestration = await cemaiClient.masterControlOrchestrate({
  workflow: 'production_optimization',
  parameters: { batchSize: 1000 }
});

// Use Egress Agent for external communication
const execution = await cemaiClient.egressExecute({
  command: 'adjust_kiln_speed',
  parameters: { speed: 95 }
});
```

## ✅ **Verification Status**

All URLs have been tested and verified:
- ✅ Guardian Agent: Working
- ✅ Optimizer Agent: Working
- ✅ Master Control Agent: Working
- ✅ Egress Agent: Working

**Ready for frontend integration!** 🎯
