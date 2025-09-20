# Master Control Agent Specification - "The Conductor"

## Overview

The Master Control Agent serves as the brain of the operation and the swarm coordinator. It decomposes goals, tasks specialists, evaluates their proposals, resolves conflicts, and manages the entire decision lifecycle. It operates as the central orchestrator within the CemAI agent swarm using LangGraph for stateful multi-agent workflows.

## Core Responsibilities

### Primary Mission
- Orchestrate multi-agent decision workflows
- Resolve conflicts between specialist agent proposals
- Implement Constitutional AI framework for ethical decision making
- Manage stateful reasoning processes with LangGraph
- Ensure sub-60 second decision latency
- Maintain >95% recommendation acceptance rate

### Key Performance Indicators
- **Decision Latency**: Complete end-to-end decisions within 60 seconds
- **Recommendation Acceptance Rate**: >95% of proposals deemed correct and safe
- **Conflict Resolution Success**: 100% resolution of agent conflicts
- **Workflow Completion Rate**: >99% successful workflow completion
- **System Uptime**: 99.95% availability on Cloud Run

## Technical Specifications

### Core Feature 1: Stateful Multi-Agent Orchestration

#### LangGraph Workflow Implementation
```typescript
// LangGraph Workflow Definition
import { StateGraph, END } from "@langchain/langgraph";

const workflow = new StateGraph({
  channels: {
    requestId: string,
    conversationId: string,
    timestamp: string,
    trigger: string,
    context: any,
    proposals: Proposal[],
    conflicts: Conflict[],
    approvedActions: Action[],
    rejectedActions: Action[],
    modifications: Modification[],
    status: 'initializing' | 'collecting' | 'analyzing' | 'resolving' | 'deciding' | 'executing' | 'completed' | 'error'
  }
});

// Workflow Nodes
workflow.addNode("collect_proposals", collectProposals);
workflow.addNode("analyze_conflicts", analyzeConflicts);
workflow.addNode("resolve_conflicts", resolveConflicts);
workflow.addNode("generate_decision", generateDecision);
workflow.addNode("send_commands", sendCommands);

// Workflow Edges
workflow.addEdge("collect_proposals", "analyze_conflicts");
workflow.addEdge("analyze_conflicts", "resolve_conflicts");
workflow.addEdge("resolve_conflicts", "generate_decision");
workflow.addEdge("generate_decision", "send_commands");
workflow.addEdge("send_commands", END);
```

#### Workflow State Management
```typescript
interface WorkflowState {
  requestId: string;
  conversationId: string;
  timestamp: string;
  trigger: string;
  context: any;
  proposals: Proposal[];
  conflicts: Conflict[];
  approvedActions: Action[];
  rejectedActions: Action[];
  modifications: Modification[];
  status: WorkflowStatus;
  decision?: Decision;
  executionResults?: ExecutionResult[];
}

class WorkflowOrchestrator {
  async executeWorkflow(initialState: WorkflowState): Promise<WorkflowState> {
    // Execute LangGraph workflow with AlloyDB checkpointing
    const result = await this.workflowGraph.invoke(initialState, {
      configurable: {
        checkpoint_ns: `workflow_${initialState.requestId}`,
        thread_id: initialState.conversationId
      }
    });
    
    return result;
  }
}
```

### Core Feature 2: Constitutional AI Framework

#### Decision-Making Constitution
```typescript
const DECISION_CONSTITUTION = {
  priorities: [
    { level: 1, objective: "Safety", description: "Ensure plant and personnel safety" },
    { level: 2, objective: "Quality", description: "Maintain product quality specifications" },
    { level: 3, objective: "Emissions", description: "Minimize environmental impact" },
    { level: 4, objective: "Cost", description: "Optimize operational costs" }
  ],
  
  conflictResolutionRules: [
    "Safety always takes precedence over all other objectives",
    "Quality constraints cannot be violated for cost optimization",
    "Emissions reductions should be pursued when cost-neutral",
    "Cost optimization is acceptable within safety and quality bounds"
  ],
  
  decisionProcess: [
    "Summarize and verify all proposals and their goals",
    "Identify explicit conflicts between proposals",
    "Evaluate conflicts against constitutional priorities",
    "Synthesize compromise solution respecting higher priorities",
    "Document reasoning for audit trail"
  ]
};
```

#### Conflict Resolution Algorithm
```typescript
class ConflictResolver {
  async resolveConflicts(proposals: Proposal[], conflicts: Conflict[]): Promise<Resolution> {
    // 1. Summarize & Verify
    const summary = await this.summarizeProposals(proposals);
    
    // 2. Identify Conflicts
    const conflictAnalysis = await this.analyzeConflicts(conflicts);
    
    // 3. Evaluate Against Constitution
    const constitutionalEvaluation = await this.evaluateAgainstConstitution(
      proposals, 
      conflicts, 
      DECISION_CONSTITUTION
    );
    
    // 4. Synthesize Compromise
    const compromiseSolution = await this.synthesizeCompromise(
      constitutionalEvaluation
    );
    
    return {
      resolution: compromiseSolution,
      reasoning: this.generateReasoning(constitutionalEvaluation),
      constitutionalCompliance: true
    };
  }
}
```

### Core Feature 3: Gemini 2.5 Pro Integration

#### Advanced Reasoning Engine
```typescript
class GeminiReasoningEngine {
  private gemini: VertexAI;
  
  async analyzeConflicts(proposals: Proposal[]): Promise<ConflictAnalysis> {
    const prompt = `
    Analyze the following agent proposals for conflicts:
    
    ${JSON.stringify(proposals, null, 2)}
    
    Identify:
    1. Direct conflicts (same parameter, different values)
    2. Indirect conflicts (actions that oppose each other)
    3. Priority conflicts (different urgency levels)
    4. Safety implications of each proposal
    
    Format response as JSON with conflict descriptions and severity ratings.
    `;
    
    const response = await this.gemini.generateContent(prompt);
    return JSON.parse(response.response.text());
  }
  
  async resolveConflictsUsingConstitution(
    proposals: Proposal[], 
    conflicts: Conflict[]
  ): Promise<Resolution> {
    const prompt = `
    Using the following decision-making constitution:
    
    ${JSON.stringify(DECISION_CONSTITUTION, null, 2)}
    
    Resolve conflicts between these proposals:
    ${JSON.stringify(proposals, null, 2)}
    
    Detected conflicts:
    ${JSON.stringify(conflicts, null, 2)}
    
    Apply the constitutional framework:
    1. Summarize & Verify the proposals and their goals
    2. Identify explicit conflicts
    3. Evaluate against constitution priorities: Safety > Quality > Emissions > Cost
    4. Synthesize compromise solution
    
    Provide detailed reasoning and final recommended actions.
    `;
    
    const response = await this.gemini.generateContent(prompt);
    return JSON.parse(response.response.text());
  }
}
```

## Implementation Architecture

### Service Structure
```
master_control/
├── src/
│   ├── main.ts                 # Express service entry point
│   ├── graph.ts                # LangGraph workflow definition
│   ├── orchestrator.ts         # Workflow orchestration logic
│   ├── conflict-resolver.ts    # Constitutional AI implementation
│   ├── decision-engine.ts      # Gemini 2.5 Pro integration
│   └── state-manager.ts        # AlloyDB state persistence
├── config/
│   ├── workflow-config.yaml    # LangGraph configuration
│   ├── constitution.yaml       # Decision-making constitution
│   └── gemini-config.yaml      # Gemini model configuration
├── Dockerfile                   # Container configuration
├── package.json                 # Node.js dependencies
└── cloudbuild.yaml             # Cloud Build configuration
```

### API Endpoints

#### Workflow Orchestration
```typescript
@app.post('/v1/orchestrate')
async def orchestrateWorkflow(request: OrchestrationRequest): Promise<WorkflowResponse>

@app.get('/v1/workflow-status/:requestId')
async def getWorkflowStatus(requestId: string): Promise<WorkflowStatus>

@app.post('/v1/workflow-resume/:requestId')
async def resumeWorkflow(requestId: string): Promise<WorkflowResponse>
```

#### A2A Communication
```typescript
@app.post('/a2a/receive')
async def receiveA2AMessage(message: A2AMessage): Promise<A2AResponse>

@app.post('/a2a/broadcast')
async def broadcastToAgents(message: BroadcastMessage): Promise<BroadcastResponse>
```

#### Decision Management
```typescript
@app.get('/v1/decision-history')
async def getDecisionHistory(filters: DecisionFilters): Promise<DecisionHistory>

@app.post('/v1/decision-review')
async def reviewDecision(decisionId: string, review: DecisionReview): Promise<ReviewResponse>
```

### Data Integration

#### AlloyDB State Persistence
```typescript
class StateManager {
  async saveWorkflowState(state: WorkflowState): Promise<void> {
    await this.alloyDB.query(`
      INSERT INTO workflow_states (
        request_id, conversation_id, timestamp, trigger, 
        context, proposals, conflicts, status, decision
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (request_id) DO UPDATE SET
        conversation_id = EXCLUDED.conversation_id,
        timestamp = EXCLUDED.timestamp,
        status = EXCLUDED.status,
        decision = EXCLUDED.decision
    `, [
      state.requestId, state.conversationId, state.timestamp,
      state.trigger, JSON.stringify(state.context),
      JSON.stringify(state.proposals), JSON.stringify(state.conflicts),
      state.status, JSON.stringify(state.decision)
    ]);
  }
  
  async loadWorkflowState(requestId: string): Promise<WorkflowState> {
    const result = await this.alloyDB.query(`
      SELECT * FROM workflow_states WHERE request_id = $1
    `, [requestId]);
    
    return this.deserializeWorkflowState(result.rows[0]);
  }
}
```

#### Pub/Sub Integration
```yaml
subscriptions:
  - topic: "agent-proposals"
    filter: "attributes.agent IN ('guardian_agent', 'optimizer_agent')"
  - topic: "workflow-triggers"
    filter: "attributes.type='decision_request'"
  - topic: "emergency-events"
    filter: "attributes.severity='critical'"
```

## Monitoring & Observability

### Key Metrics
```typescript
const metrics = {
  decisionLatency: "End-to-end decision latency in seconds",
  conflictResolutionRate: "Percentage of conflicts successfully resolved",
  proposalAcceptanceRate: "Percentage of proposals accepted by human review",
  workflowCompletionRate: "Percentage of workflows completed successfully",
  constitutionalComplianceRate: "Percentage of decisions following constitution",
  geminiResponseTime: "Gemini 2.5 Pro response time in seconds"
};
```

### Alerting Rules
```yaml
alerts:
  - name: "decision_latency_exceeded"
    condition: "decision_latency > 60s"
    severity: "critical"
    
  - name: "conflict_resolution_failure"
    condition: "conflict_resolution_rate < 95%"
    severity: "warning"
    
  - name: "workflow_completion_low"
    condition: "workflow_completion_rate < 99%"
    severity: "critical"
    
  - name: "constitutional_violation"
    condition: "constitutional_compliance_rate < 100%"
    severity: "critical"
```

### Trace Instrumentation
- All workflow executions traced end-to-end
- LangGraph node execution span tracking
- Gemini API call latency monitoring
- A2A communication span tracking
- AlloyDB state persistence tracing

## Security Configuration

### IAM Service Account
```yaml
master_control_agent_sa:
  email: "master-control-agent@${PROJECT_ID}.iam.gserviceaccount.com"
  roles:
    - "roles/aiplatform.user"          # Gemini 2.5 Pro access
    - "roles/alloydb.instanceUser"       # AlloyDB state persistence
    - "roles/pubsub.subscriber"         # Agent communication
    - "roles/pubsub.publisher"          # Command broadcasting
    - "roles/trace.agent"               # Cloud Trace instrumentation
  restrictions:
    - no_internet_egress: true
    - vpc_only: true
```

### Environment Variables
```bash
# Required
GEMINI_MODEL_NAME=gemini-2.5-pro
ALLOYDB_CONNECTION_STRING=postgresql://user:pass@host:port/db
PUBSUB_TOPIC_AGENT_COMMUNICATION=projects/${PROJECT}/topics/agent-communication
WORKFLOW_TIMEOUT_MS=60000

# Optional
LOG_LEVEL=INFO
DECISION_CACHE_TTL=300  # seconds
CONFLICT_RESOLUTION_TIMEOUT=30000  # milliseconds
```

## Testing Strategy

### Unit Tests
- LangGraph workflow node validation
- Constitutional AI logic testing
- Conflict resolution algorithm validation
- State persistence logic testing

### Integration Tests
- End-to-end workflow execution
- Gemini 2.5 Pro integration
- AlloyDB state persistence
- A2A protocol communication

### Performance Tests
- Decision latency under load
- Concurrent workflow handling
- Memory usage optimization
- Cold start performance

### Quality Assurance
- Constitutional compliance testing
- Decision audit trail validation
- Conflict resolution accuracy testing
- Workflow state consistency verification

## Deployment Configuration

### Cloud Run Service
```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: master-control-agent
  annotations:
    run.googleapis.com/vpc-access-connector: "plant-connector"
    run.googleapis.com/vpc-access-egress: "private-ranges-only"
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "1"
        autoscaling.knative.dev/maxScale: "5"
        run.googleapis.com/memory: "4Gi"
        run.googleapis.com/cpu: "4"
    spec:
      serviceAccountName: master-control-agent@${PROJECT_ID}.iam.gserviceaccount.com
      containers:
      - image: gcr.io/${PROJECT_ID}/master-control-agent:${VERSION}
        env:
        - name: ALLOYDB_CONNECTION_STRING
          valueFrom:
            secretKeyRef:
              name: alloydb-connection
              key: connection-string
```

### Resource Requirements
- **Memory**: 4GB (for LangGraph state management and Gemini processing)
- **CPU**: 4 vCPUs (for complex reasoning and workflow orchestration)
- **Storage**: 2GB (for temporary state and model artifacts)
- **Network**: VPC connector for secure plant communication

## Operational Procedures

### Startup Sequence
1. Initialize Gemini 2.5 Pro client connections
2. Connect to AlloyDB for state persistence
3. Load LangGraph workflow configuration
4. Subscribe to agent communication topics
5. Begin workflow orchestration loop

### Shutdown Procedure
1. Complete in-flight workflows
2. Save final state to AlloyDB
3. Send final commands to Egress Agent
4. Gracefully unsubscribe from Pub/Sub
5. Close Gemini connections

### Error Recovery
- Automatic retry for transient Gemini failures
- Workflow state recovery from AlloyDB checkpoints
- Circuit breaker pattern for external service calls
- Graceful degradation with reduced reasoning capability

### Maintenance Procedures
- Rolling workflow updates with A/B testing
- Constitutional framework adjustments
- Performance tuning and optimization
- Decision audit trail maintenance

