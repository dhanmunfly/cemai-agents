# CemAI Agents - Environment Setup Guide

## Quick Start

### 1. Copy Environment Configuration
```bash
# Copy the example configuration
cp environment-config.env .env

# Or on Windows
copy environment-config.env .env
```

### 2. Start All Agents

#### Option A: PowerShell (Recommended for Windows)
```powershell
.\start-agents.ps1
```

#### Option B: Batch File (Windows CMD)
```cmd
start-agents.bat
```

#### Option C: Node.js Script (Cross-platform)
```bash
node start-agents.js
```

#### Option D: Manual Start
```bash
# Terminal 1 - Guardian Agent
cd agents/guardian
npm run dev

# Terminal 2 - Optimizer Agent  
cd agents/optimizer
npm run dev

# Terminal 3 - Master Control Agent
cd agents/master_control
npm run dev

# Terminal 4 - Egress Agent
cd agents/egress
npm run dev
```

## Environment Configuration

The `environment-config.env` file contains all configuration settings for the CemAI agents system. Here are the key sections:

### General Configuration
```env
ENVIRONMENT=development
LOG_LEVEL=INFO
GOOGLE_CLOUD_PROJECT=cemai-agents
GOOGLE_CLOUD_REGION=us-central1
```

### Agent Ports
```env
GUARDIAN_PORT=8081
OPTIMIZER_PORT=8082
MASTER_CONTROL_PORT=8083
EGRESS_PORT=8084
```

### Agent Endpoints
```env
GUARDIAN_ENDPOINT=http://localhost:8081
OPTIMIZER_ENDPOINT=http://localhost:8082
MASTER_CONTROL_ENDPOINT=http://localhost:8083
EGRESS_ENDPOINT=http://localhost:8084
```

### Development Settings
```env
DEBUG_MODE=true
MOCK_SERVICES=true
SKIP_DATABASE_INIT=true
VERBOSE_LOGGING=true
```

## Agent Health Checks

Once all agents are running, you can verify they're working:

```bash
# Check Guardian Agent
curl http://localhost:8081/health

# Check Optimizer Agent
curl http://localhost:8082/health

# Check Master Control Agent
curl http://localhost:8083/health

# Check Egress Agent
curl http://localhost:8084/health
```

Expected response:
```json
{
  "status": "healthy",
  "agent": "guardian_agent",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45,
  "version": "1.0.0"
}
```

## Agent Communication Test

Test agent-to-agent communication:

```bash
# Test Guardian -> Master Control communication
curl -X POST http://localhost:8081/api/predict \
  -H "Content-Type: application/json" \
  -d '{
    "sensorData": {
      "kiln_speed": 3.5,
      "fuel_flow": 5.2,
      "feed_rate": 200,
      "preheater_temp": 900
    },
    "predictionHorizonMinutes": 60
  }'

# Test Optimizer -> Master Control communication
curl -X POST http://localhost:8082/api/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "fuelPrices": {
      "coal": 100,
      "biomass": 80,
      "waste": 60,
      "rdf": 70
    },
    "constraints": {
      "quality": "maintain",
      "emissions": "minimize"
    }
  }'
```

## Troubleshooting

### Common Issues

#### 1. Port Already in Use
```bash
# Find process using port
netstat -ano | findstr :8081

# Kill process (Windows)
taskkill /PID <PID> /F

# Kill process (Linux/Mac)
kill -9 <PID>
```

#### 2. Database Connection Errors
The agents are configured to skip database initialization in development mode. If you see database errors:

1. Ensure `ENVIRONMENT=development` in your config
2. Ensure `SKIP_DATABASE_INIT=true` in your config
3. Check that the AlloyDB service modifications are in place

#### 3. Agent Not Starting
1. Check if all dependencies are installed: `npm install`
2. Check if TypeScript compilation succeeded: `npm run build`
3. Check the agent logs for specific error messages
4. Verify environment variables are set correctly

#### 4. Agent Communication Failures
1. Verify all agents are running on correct ports
2. Check that endpoint URLs are correct in the config
3. Ensure no firewall is blocking localhost communication
4. Check agent logs for communication errors

### Logs and Debugging

#### Enable Verbose Logging
```env
LOG_LEVEL=DEBUG
VERBOSE_LOGGING=true
DEBUG_MODE=true
```

#### View Agent Logs
Each agent outputs logs to its console. For centralized logging, you can redirect output:

```bash
# Redirect all agent logs to files
node start-agents.js > agents.log 2>&1
```

#### Check Agent Status
```bash
# Check if agents are responding
curl -s http://localhost:8081/health | jq .
curl -s http://localhost:8082/health | jq .
curl -s http://localhost:8083/health | jq .
curl -s http://localhost:8084/health | jq .
```

## Production Deployment

For production deployment, update the environment configuration:

```env
ENVIRONMENT=production
LOG_LEVEL=WARN
DEBUG_MODE=false
MOCK_SERVICES=false
SKIP_DATABASE_INIT=false
VERBOSE_LOGGING=false

# Use real Google Cloud credentials
GOOGLE_CLOUD_PROJECT=your-production-project
VERTEX_AI_ENDPOINT_ID=your-real-endpoint
ALLOYDB_CONNECTION_STRING=your-real-connection-string

# Use secure secrets
A2A_SECRET_KEY=your-production-secret-key
JWT_SECRET=your-production-jwt-secret
API_KEY=your-production-api-key
```

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Guardian Agent │    │ Optimizer Agent │    │ Master Control  │
│   (Port 8081)   │    │   (Port 8082)   │    │   (Port 8083)   │
│                 │    │                 │    │                 │
│ • LSF Prediction│    │ • Fuel Mix Opt  │    │ • Orchestration│
│ • Quality Check │    │ • Cost Analysis │    │ • Decision Mgmt│
│ • Stability     │    │ • Market Data   │    │ • Conflict Res  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  Egress Agent   │
                    │   (Port 8084)   │
                    │                 │
                    │ • OPC-UA Comm   │
                    │ • Plant Control │
                    │ • Command Exec  │
                    └─────────────────┘
```

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review agent logs for specific error messages
3. Verify environment configuration is correct
4. Ensure all dependencies are installed and up to date
