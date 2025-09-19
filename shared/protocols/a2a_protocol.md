# Agent-to-Agent (A2A) Communication Protocol

## Overview

The A2A protocol defines the standardized communication interface between all agents in the CemAI swarm. It ensures reliable, authenticated, and traceable inter-agent communication while maintaining the flexibility needed for complex multi-agent workflows.

## Protocol Principles

### 1. Structured Communication
All agent communications use standardized message formats with strict schemas to ensure compatibility and reduce integration errors.

### 2. Authenticated Exchanges  
Every A2A message is authenticated using GCP IAM tokens to ensure secure, verifiable communication between trusted agents.

### 3. Traceable Workflows
All messages include correlation IDs and tracing headers to enable end-to-end observability across the agent swarm.

### 4. Stateful Conversations
Support for multi-turn conversations and stateful workflows using conversation threading and message sequencing.

## Message Structure

### Base Message Format
```python
@dataclass
class A2AMessage:
    # Message metadata
    message_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    conversation_id: str  # Groups related messages
    timestamp: datetime = field(default_factory=datetime.utcnow)
    correlation_id: str  # For distributed tracing
    
    # Agent information
    sender_agent: str
    recipient_agent: str
    message_type: str
    
    # Authentication
    sender_token: str  # IAM token for authentication
    
    # Payload
    payload: Dict[str, Any]
    
    # Protocol metadata
    protocol_version: str = "1.0"
    priority: str = "normal"  # "low", "normal", "high", "critical"
    expires_at: Optional[datetime] = None
    
    # Tracing headers
    trace_id: Optional[str] = None
    span_id: Optional[str] = None
```

### Message Types

#### 1. Proposal Messages
Used by specialist agents to send optimization or stability proposals to the Master Control Agent.

```python
@dataclass
class ProposalMessage(A2AMessage):
    message_type: str = "proposal"
    
    payload: ProposalPayload
    
@dataclass
class ProposalPayload:
    proposal_type: str  # "stability", "optimization", "emergency"
    urgency: str  # "low", "medium", "high", "critical"
    
    # Proposal details
    title: str
    description: str
    rationale: str
    
    # Proposed actions
    actions: List[ControlAction]
    expected_outcomes: List[ExpectedOutcome]
    
    # Risk assessment
    risks: List[Risk]
    mitigation_strategies: List[str]
    
    # Supporting data
    supporting_data: Dict[str, Any]
    confidence: float  # 0.0 to 1.0
    
    # Constraints and requirements
    constraints: List[Constraint]
    prerequisites: List[str]
```

#### 2. Decision Messages
Used by Master Control Agent to communicate final decisions back to specialist agents.

```python
@dataclass
class DecisionMessage(A2AMessage):
    message_type: str = "decision"
    
    payload: DecisionPayload

@dataclass  
class DecisionPayload:
    decision_id: str
    original_proposals: List[str]  # Message IDs of original proposals
    
    # Decision details
    decision_type: str  # "approved", "rejected", "modified", "deferred"
    approved_actions: List[ControlAction]
    rejected_actions: List[ControlAction]
    modifications: List[ActionModification]
    
    # Reasoning
    decision_rationale: str
    risk_evaluation: str
    compromise_explanation: Optional[str]
    
    # Execution details
    execution_priority: str
    execution_timeline: str
    monitoring_requirements: List[str]
```

#### 3. Status Messages
Used for health checks, capability announcements, and operational status updates.

```python
@dataclass
class StatusMessage(A2AMessage):
    message_type: str = "status"
    
    payload: StatusPayload

@dataclass
class StatusPayload:
    agent_status: str  # "healthy", "degraded", "offline", "starting"
    capabilities: List[str]
    current_load: float  # 0.0 to 1.0
    
    # Performance metrics
    response_times: Dict[str, float]  # operation -> avg response time
    error_rates: Dict[str, float]     # operation -> error rate
    
    # Resource utilization
    memory_usage: float
    cpu_usage: float
    
    # Operational details
    active_conversations: int
    pending_proposals: int
    last_health_check: datetime
```

#### 4. Data Messages
Used for sharing sensor data, model predictions, and analytical results between agents.

```python
@dataclass
class DataMessage(A2AMessage):
    message_type: str = "data"
    
    payload: DataPayload

@dataclass
class DataPayload:
    data_type: str  # "sensor_reading", "prediction", "analysis_result"
    data_source: str
    
    # Data content
    data: Dict[str, Any]
    metadata: Dict[str, Any]
    
    # Quality indicators
    confidence: Optional[float]
    accuracy: Optional[float]
    freshness: datetime  # When data was generated
    
    # Processing instructions
    requires_acknowledgment: bool = False
    processing_hints: List[str] = field(default_factory=list)
```

#### 5. Command Messages
Used by Master Control Agent to send execution commands to the Egress Agent.

```python
@dataclass
class CommandMessage(A2AMessage):
    message_type: str = "command"
    
    payload: CommandPayload

@dataclass
class CommandPayload:
    command_id: str
    command_type: str  # "setpoint_change", "emergency_stop", "parameter_update"
    
    # Command details
    target_system: str  # "kiln", "mill", "preheater", etc.
    parameters: Dict[str, Any]
    
    # Execution requirements
    execution_method: str  # "immediate", "scheduled", "conditional"
    execution_time: Optional[datetime]
    conditions: List[str] = field(default_factory=list)
    
    # Safety and validation
    safety_checks_required: bool = True
    validation_steps: List[str] = field(default_factory=list)
    rollback_plan: Optional[str] = None
    
    # Authorization
    authorization_token: str
    authorized_by: str  # Agent ID that authorized this command
```

## Communication Patterns

### 1. Request-Response Pattern
Simple synchronous communication for status checks and data queries.

```python
# Guardian requests current market data from Optimizer
request = DataMessage(
    sender_agent="guardian_agent",
    recipient_agent="optimizer_agent", 
    conversation_id=conv_id,
    payload=DataPayload(
        data_type="market_query",
        data={"fuel_types": ["coal", "biomass"], "timeframe": "current"}
    )
)

response = await send_a2a_message(request)
```

### 2. Publish-Subscribe Pattern
Asynchronous communication for broadcasting status updates and alerts.

```python
# Guardian publishes stability alert to all interested agents
alert = StatusMessage(
    sender_agent="guardian_agent",
    recipient_agent="broadcast",
    payload=StatusPayload(
        agent_status="alert",
        capabilities=["stability_monitoring"],
        message="LSF approaching quality band limits"
    )
)
```

### 3. Workflow Orchestration Pattern
Complex multi-step conversations managed by Master Control Agent.

```python
# Master Control orchestrates multi-agent decision workflow
conversation_id = str(uuid.uuid4())

# Step 1: Request proposals from specialists
await request_proposals(conversation_id, ["guardian_agent", "optimizer_agent"])

# Step 2: Collect and analyze proposals  
proposals = await collect_proposals(conversation_id, timeout=30)

# Step 3: Resolve conflicts and make decision
decision = await resolve_conflicts(proposals)

# Step 4: Broadcast decision to all participants
await broadcast_decision(conversation_id, decision)
```

## Authentication & Security

### IAM Token Authentication
```python
def authenticate_message(message: A2AMessage) -> bool:
    """Validate IAM token and verify sender identity"""
    try:
        # Verify IAM token signature
        token_info = id_token.verify_oauth2_token(
            message.sender_token, 
            requests.Request()
        )
        
        # Verify sender agent identity matches token
        expected_email = f"{message.sender_agent}@{PROJECT_ID}.iam.gserviceaccount.com"
        return token_info.get("email") == expected_email
        
    except ValueError:
        return False
```

### Message Encryption
```python
def encrypt_sensitive_payload(payload: Dict[str, Any]) -> str:
    """Encrypt sensitive data using Cloud KMS"""
    kms_client = kms.KeyManagementServiceClient()
    key_name = f"projects/{PROJECT}/locations/{REGION}/keyRings/{RING}/cryptoKeys/{KEY}"
    
    plaintext = json.dumps(payload).encode('utf-8')
    encrypt_response = kms_client.encrypt(
        request={"name": key_name, "plaintext": plaintext}
    )
    
    return base64.b64encode(encrypt_response.ciphertext).decode('utf-8')
```

## Error Handling

### Error Response Format
```python
@dataclass
class ErrorResponse(A2AMessage):
    message_type: str = "error"
    
    payload: ErrorPayload

@dataclass
class ErrorPayload:
    error_code: str
    error_message: str
    error_details: Dict[str, Any]
    
    # Retry information
    is_retryable: bool
    retry_after: Optional[int]  # seconds
    
    # Context
    original_message_id: str
    stack_trace: Optional[str] = None
```

### Retry Logic
```python
class A2ARetryPolicy:
    max_retries: int = 3
    base_delay: float = 1.0  # seconds
    max_delay: float = 60.0  # seconds
    backoff_multiplier: float = 2.0
    
    retryable_errors = [
        "TEMPORARY_FAILURE",
        "RATE_LIMITED", 
        "SERVICE_UNAVAILABLE"
    ]
```

## Implementation Example

### FastAPI Endpoint for A2A Communication
```python
from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer

app = FastAPI()
security = HTTPBearer()

@app.post("/a2a/receive")
async def receive_a2a_message(
    message: A2AMessage,
    token: HTTPAuthorizationCredentials = Depends(security)
):
    # Authenticate the message
    if not authenticate_message(message):
        raise HTTPException(status_code=401, detail="Authentication failed")
    
    # Validate message format
    if not validate_message_schema(message):
        raise HTTPException(status_code=400, detail="Invalid message format")
    
    # Process message based on type
    try:
        if message.message_type == "proposal":
            response = await handle_proposal(message)
        elif message.message_type == "decision":
            response = await handle_decision(message)
        elif message.message_type == "status":
            response = await handle_status(message)
        else:
            raise HTTPException(status_code=400, detail="Unknown message type")
            
        return response
        
    except Exception as e:
        # Return structured error response
        error_response = ErrorResponse(
            sender_agent="current_agent",
            recipient_agent=message.sender_agent,
            conversation_id=message.conversation_id,
            payload=ErrorPayload(
                error_code="PROCESSING_ERROR",
                error_message=str(e),
                error_details={"exception_type": type(e).__name__},
                is_retryable=True,
                original_message_id=message.message_id
            )
        )
        return error_response
```

### Client Library for Sending Messages
```python
class A2AClient:
    def __init__(self, agent_id: str, service_account_path: str):
        self.agent_id = agent_id
        self.auth = service_account.Credentials.from_service_account_file(
            service_account_path,
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
    
    async def send_message(self, message: A2AMessage) -> A2AMessage:
        """Send A2A message with authentication and tracing"""
        
        # Add authentication token
        message.sender_token = self._get_id_token()
        message.sender_agent = self.agent_id
        
        # Add tracing information
        current_span = trace.get_current_span()
        message.trace_id = current_span.get_span_context().trace_id
        message.span_id = current_span.get_span_context().span_id
        
        # Determine recipient endpoint
        recipient_url = self._resolve_agent_endpoint(message.recipient_agent)
        
        # Send HTTP request
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{recipient_url}/a2a/receive",
                json=message.dict(),
                headers={"Authorization": f"Bearer {message.sender_token}"},
                timeout=30.0
            )
            
            if response.status_code == 200:
                return A2AMessage.parse_obj(response.json())
            else:
                raise A2AException(f"Message failed: {response.status_code}")
```

## Monitoring & Observability

### Message Tracing
```python
@trace_calls
async def handle_proposal(message: A2AMessage) -> A2AMessage:
    """Handle incoming proposal with full tracing"""
    
    span = trace.get_current_span()
    span.set_attributes({
        "agent.sender": message.sender_agent,
        "agent.recipient": message.recipient_agent,
        "message.type": message.message_type,
        "message.id": message.message_id,
        "conversation.id": message.conversation_id
    })
    
    # Process the proposal
    result = await process_proposal(message.payload)
    
    span.set_attribute("processing.result", result.status)
    return result
```

### Performance Metrics
```python
# Key metrics to track
metrics = {
    "a2a.message.count": "Total messages sent/received",
    "a2a.message.latency": "Message processing latency",
    "a2a.message.errors": "Message processing errors",
    "a2a.conversation.duration": "Complete conversation duration",
    "a2a.authentication.failures": "Authentication failure rate"
}
```

## Version Management

### Protocol Versioning
- Semantic versioning (e.g., 1.0.0)
- Backward compatibility for minor versions
- Graceful degradation for version mismatches

### Schema Evolution
```python
def migrate_message_schema(message: dict, from_version: str, to_version: str) -> dict:
    """Migrate message format between protocol versions"""
    
    if from_version == "1.0" and to_version == "1.1":
        # Add new fields with defaults
        message.setdefault("priority", "normal")
        message.setdefault("expires_at", None)
    
    return message
```

This comprehensive A2A protocol ensures robust, secure, and observable communication between all agents in the CemAI swarm, enabling complex multi-agent workflows while maintaining enterprise-grade reliability and security standards.
