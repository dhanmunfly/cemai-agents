# CemAI Agents - System Architecture

## Overview

The CemAI Agent Swarm implements a **"Supervisor → Specialists"** architecture where each agent is an independent, containerized microservice with specific expertise. This modular design enables scalable intelligence that can be upgraded one "skill" at a time.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     External Systems                            │
├─────────────────────────────────────────────────────────────────┤
│  Market Data APIs  │  Weather APIs  │  Energy Pricing APIs     │
└─────────────────┬───────────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│                  Pub/Sub Event Stream                           │
└─────────────────┬───────────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│                    Agent Swarm Layer                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │  Guardian Agent │    │ Optimizer Agent │                    │
│  │ "The Stabilizer"│    │ "The Economist" │                    │
│  └─────────┬───────┘    └─────────┬───────┘                    │
│            │                      │                            │
│            └──────────┬───────────┘                            │
│                       │                                        │
│            ┌─────────▼─────────┐                               │
│            │ Master Control    │                               │
│            │ Agent             │                               │
│            │ "The Conductor"   │                               │
│            └─────────┬─────────┘                               │
│                      │                                         │
│            ┌─────────▼─────────┐                               │
│            │ Egress Agent      │                               │
│            │ "The Actuator"    │                               │
│            └─────────┬─────────┘                               │
└──────────────────────┼─────────────────────────────────────────┘
                       │
┌─────────────────────▼──────────────────────────────────────────┐
│                Plant OT Network                                 │
├─────────────────────────────────────────────────────────────────┤
│  OPC-UA Server  │  DCS Systems  │  Sensor Networks             │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Agent Services Layer

#### Guardian Agent ("The Stabilizer")
- **Purpose**: Process stability and quality assurance
- **Technology**: Cloud Run + Vertex AI Forecasting
- **Key Features**:
  - Predictive LSF monitoring (60-minute horizon)
  - Minimal effective action calculations
  - Quality deviation alerts

#### Optimizer Agent ("The Economist")  
- **Purpose**: Cost optimization and sustainability
- **Technology**: Cloud Run + Vertex AI Optimization
- **Key Features**:
  - Constraint-based fuel mix optimization
  - Market-aware re-evaluation triggers
  - Alternative fuel maximization

#### Master Control Agent ("The Conductor")
- **Purpose**: Swarm coordination and decision arbitration
- **Technology**: Cloud Run + LangGraph + Gemini 2.5 Pro
- **Key Features**:
  - Stateful multi-agent orchestration
  - Constitutional AI framework
  - Conflict resolution with compromise synthesis

#### Egress Agent ("The Actuator")
- **Purpose**: Secure command transmission to plant systems
- **Technology**: Cloud Run + Private Service Connect
- **Key Features**:
  - Single point of egress control
  - Command authentication and validation
  - OPC-UA protocol translation

### 2. Shared Services Layer

#### Communication Protocols (`shared/protocols/`)
- A2A (Agent-to-Agent) message formats
- Proposal structures and schemas
- Error handling and retry logic

#### Security Framework (`shared/security/`)
- IAM service account configurations
- Authentication utilities
- Encryption and secret management

#### Monitoring & Observability (`shared/monitoring/`)
- Cloud Trace integration
- Structured logging utilities
- Metrics collection and alerting

### 3. Infrastructure Layer

#### Compute Platform
- **Cloud Run**: Serverless container platform for all agents
- **Auto-scaling**: 0 to N instances based on demand
- **Cold start optimization**: Pre-warmed instances for critical agents

#### Data & State Management
- **AlloyDB**: LangGraph checkpointer for stateful workflows
- **Cloud Storage**: Model artifacts and configuration storage
- **Pub/Sub**: Event-driven communication and market data ingestion

#### AI/ML Platform
- **Vertex AI**: Hosted AI services (Gemini, Forecasting, Optimization)
- **Model Registry**: Versioned model artifacts
- **Prediction Endpoints**: Real-time inference services

#### Security Perimeter
- **VPC Service Controls**: Network security boundary
- **Private Service Connect**: Secure on-premise connectivity
- **IAM**: Least-privilege access control

## Data Flow Architecture

### 1. Real-time Monitoring Flow
```
Plant Sensors → OPC-UA → Pub/Sub → Guardian Agent → Predictions
```

### 2. Optimization Flow  
```
Market Data → Pub/Sub → Optimizer Agent → Constraint Solving → Proposals
```

### 3. Decision Flow
```
Agent Proposals → Master Control → Conflict Resolution → Final Decision
```

### 4. Command Flow
```
Master Control → Egress Agent → Private Connect → OPC-UA → Plant DCS
```

## Scalability Considerations

### Horizontal Scaling
- Each agent can scale independently based on workload
- Stateless agent design enables unlimited horizontal scaling
- LangGraph checkpointing allows for fault-tolerant scale-down

### Vertical Scaling
- Cloud Run automatic resource allocation
- Memory and CPU optimization per agent type
- GPU acceleration for ML-intensive agents

### Geographic Distribution
- Multi-region deployment for global cement operations
- Regional data sovereignty compliance
- Edge computing for low-latency plant integration

## Security Architecture

### Zero-Trust Principles
1. **Identity Verification**: Every request authenticated
2. **Least Privilege**: Minimal required permissions per agent
3. **Network Segmentation**: VPC isolation and controls
4. **Encryption**: All data encrypted in transit and at rest

### Defense in Depth
```
Internet → Cloud Load Balancer → VPC → Cloud Run → Agent Logic
         ↓                      ↓         ↓            ↓
    DDoS Protection     Firewall Rules  IAM Auth   Business Logic
```

### Audit & Compliance
- Complete audit trail for all decisions
- Regulatory compliance (SOX, GDPR, industry standards)
- Security scanning and vulnerability management

## Performance Characteristics

### Latency Targets
- **Decision Latency**: <60 seconds end-to-end
- **Agent Response**: <5 seconds per agent
- **Conflict Resolution**: <30 seconds for complex scenarios

### Throughput Targets  
- **Event Processing**: 10,000 events/minute per plant
- **Concurrent Decisions**: 100 simultaneous decision threads
- **API Requests**: 50,000 requests/minute system-wide

### Availability Targets
- **System Uptime**: 99.95% (4.38 hours downtime/year)
- **Agent Availability**: 99.9% per individual agent
- **Data Consistency**: Eventually consistent with <1 minute convergence

## Technology Stack Summary

| Component | Technology | Purpose |
|-----------|------------|---------|
| Compute | Cloud Run | Serverless container platform |
| AI/ML | Vertex AI (Gemini 2.5 Pro) | Large language model inference |
| Forecasting | Vertex AI Forecasting | Time series prediction |
| Optimization | Vertex AI Optimization | Constraint solving |
| Orchestration | LangGraph | Stateful agent workflows |
| Database | AlloyDB | State persistence |
| Messaging | Pub/Sub | Event-driven communication |
| Storage | Cloud Storage | Model and config storage |
| Security | VPC Service Controls | Network perimeter |
| Connectivity | Private Service Connect | Secure on-premise access |
| Monitoring | Cloud Trace + Logging | Observability platform |
| Infrastructure | Terraform | Infrastructure as Code |

## Future Architecture Considerations

### Extensibility
- Plugin architecture for new agent types
- Dynamic agent registration and discovery
- Hot-swappable agent versions

### Advanced AI Capabilities
- Multi-modal AI (vision + language) for equipment monitoring
- Reinforcement learning for optimization
- Federated learning across multiple plants

### Edge Computing
- Local agent deployment for ultra-low latency
- Offline operation capabilities
- Hybrid cloud-edge orchestration
