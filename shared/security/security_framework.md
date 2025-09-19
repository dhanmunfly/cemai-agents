# CemAI Agents - Security Framework

## Overview

The CemAI Agent Swarm implements a comprehensive zero-trust security architecture designed to protect critical industrial control systems while enabling autonomous operation. This framework ensures that every interaction is authenticated, authorized, audited, and encrypted.

## Security Principles

### 1. Zero-Trust Architecture
- **Never Trust, Always Verify**: Every request is authenticated regardless of source
- **Least Privilege Access**: Minimum permissions required for operation
- **Assume Breach**: Design with the assumption that perimeter security may fail
- **Continuous Verification**: Ongoing validation of identity and authorization

### 2. Defense in Depth
Multiple layers of security controls to protect against various attack vectors:
- **Network Security**: VPC isolation and service controls
- **Identity & Access**: IAM-based authentication and authorization  
- **Application Security**: Input validation and secure coding practices
- **Data Security**: Encryption at rest and in transit
- **Operational Security**: Monitoring, logging, and incident response

### 3. Regulatory Compliance
- **IEC 62443**: Industrial cybersecurity standards
- **NIST Cybersecurity Framework**: Risk management approach
- **SOX Compliance**: Financial controls and audit trails
- **GDPR**: Data protection and privacy requirements

## Identity & Access Management (IAM)

### Service Account Architecture

#### Dedicated Service Accounts
Each agent operates under a dedicated service account with minimal required permissions:

```yaml
service_accounts:
  guardian_agent:
    email: "guardian-agent@${PROJECT_ID}.iam.gserviceaccount.com"
    display_name: "Guardian Agent Service Account"
    description: "Process stability monitoring and quality assurance"
    
  optimizer_agent:
    email: "optimizer-agent@${PROJECT_ID}.iam.gserviceaccount.com"
    display_name: "Optimizer Agent Service Account"
    description: "Cost optimization and sustainability management"
    
  master_control_agent:
    email: "master-control-agent@${PROJECT_ID}.iam.gserviceaccount.com"
    display_name: "Master Control Agent Service Account"
    description: "Swarm coordination and decision arbitration"
    
  egress_agent:
    email: "egress-agent@${PROJECT_ID}.iam.gserviceaccount.com"
    display_name: "Egress Agent Service Account"
    description: "Secure command transmission to plant systems"
```

#### Role-Based Access Control (RBAC)

##### Guardian Agent Permissions
```yaml
guardian_agent_roles:
  # AI/ML Platform Access
  - "roles/aiplatform.user"                    # Vertex AI forecasting models
  
  # Data Access
  - "roles/pubsub.subscriber"                  # Process data ingestion
  - "roles/storage.objectViewer"               # Model artifacts (read-only)
  
  # Database Access  
  - "roles/alloydb.client"                     # State persistence (limited)
  
  # Monitoring & Observability
  - "roles/monitoring.metricWriter"            # Custom metrics
  - "roles/cloudtrace.agent"                   # Distributed tracing
  - "roles/logging.logWriter"                  # Application logs

guardian_agent_restrictions:
  # Network restrictions
  - no_internet_egress: true
  - vpc_only: true
  - allowed_destinations: ["vertex-ai-endpoints", "alloydb-cluster"]
  
  # Resource restrictions  
  - max_memory: "2Gi"
  - max_cpu: "2"
  - max_concurrent_requests: 100
```

##### Optimizer Agent Permissions
```yaml
optimizer_agent_roles:
  # AI/ML Platform Access
  - "roles/aiplatform.user"                    # Vertex AI optimization
  
  # Data Access
  - "roles/pubsub.subscriber"                  # Market data subscription
  - "roles/storage.objectViewer"               # Model artifacts (read-only)
  
  # Database Access
  - "roles/alloydb.client"                     # State persistence
  
  # External API Access (restricted)
  - "custom.roles.marketDataAccess"            # Custom role for market APIs
  
  # Monitoring & Observability
  - "roles/monitoring.metricWriter"
  - "roles/cloudtrace.agent"
  - "roles/logging.logWriter"

optimizer_agent_restrictions:
  - internet_egress: "restricted"              # Only to approved market data APIs
  - vpc_only: true
  - allowed_external_domains: ["api.energymarket.com", "commodities.bloomberg.com"]
```

##### Master Control Agent Permissions
```yaml
master_control_agent_roles:
  # AI/ML Platform Access
  - "roles/aiplatform.user"                    # Gemini 2.5 Pro access
  
  # Agent Communication
  - "custom.roles.agentCommunication"          # Send/receive A2A messages
  
  # Database Access
  - "roles/alloydb.client"                     # Full LangGraph checkpointing
  
  # Command Authorization
  - "custom.roles.commandAuthorization"        # Authorize egress commands
  
  # Monitoring & Observability
  - "roles/monitoring.metricWriter"
  - "roles/cloudtrace.agent"
  - "roles/logging.logWriter"
  - "roles/cloudaudit.admin"                   # Audit trail management

master_control_restrictions:
  - no_internet_egress: true
  - vpc_only: true
  - max_decision_latency: "60s"                # Hard timeout for decisions
  - requires_approval_for: ["emergency_stop", "major_setpoint_changes"]
```

##### Egress Agent Permissions (Most Restricted)
```yaml
egress_agent_roles:
  # Plant Communication (EXCLUSIVE)
  - "custom.roles.plantCommunication"          # ONLY agent with this permission
  
  # Command Validation
  - "custom.roles.commandValidator"            # Validate incoming commands
  
  # Monitoring & Observability
  - "roles/monitoring.metricWriter"
  - "roles/cloudtrace.agent" 
  - "roles/logging.logWriter"

egress_agent_restrictions:
  - no_internet_egress: true
  - vpc_only: true
  - exclusive_plant_access: true               # Only agent allowed to talk to plant
  - command_source_validation: "master_control_only"
  - max_concurrent_commands: 5
  - command_rate_limit: "10/minute"
```

### Custom IAM Roles

#### Agent Communication Role
```yaml
custom.roles.agentCommunication:
  title: "Agent Communication Role"
  description: "Allows sending and receiving A2A protocol messages"
  stage: "GA"
  permissions:
    - "run.services.invoke"                    # Invoke other agent services
    - "iam.serviceAccounts.generateIdToken"    # Generate tokens for auth
    - "pubsub.messages.ack"                    # A2A message acknowledgment
    - "storage.objects.get"                    # Shared protocol schemas

custom.roles.plantCommunication:
  title: "Plant Communication Role"  
  description: "EXCLUSIVE access to plant OPC-UA systems"
  stage: "GA"
  permissions:
    - "compute.networks.access"                # Private Service Connect
    - "servicenetworking.services.use"         # PSC endpoint access
    - "custom.opcua.commands.send"             # Send OPC-UA commands
    - "custom.opcua.status.read"               # Read OPC-UA status

custom.roles.commandAuthorization:
  title: "Command Authorization Role"
  description: "Authorize commands for plant execution"
  stage: "GA"
  permissions:
    - "custom.commands.authorize"              # Authorize outgoing commands
    - "custom.commands.audit"                  # Audit command execution
    - "iam.serviceAccounts.signBlob"           # Sign command payloads
```

## Network Security

### VPC Service Controls

#### Perimeter Configuration
```yaml
vpc_service_controls:
  perimeter_name: "cemai-agents-perimeter"
  perimeter_type: "PERIMETER_TYPE_REGULAR"
  
  # Protected resources
  resources:
    - "projects/${PROJECT_ID}"
    - "projects/${PROJECT_ID}/services/run.googleapis.com"
    - "projects/${PROJECT_ID}/services/aiplatform.googleapis.com"
    - "projects/${PROJECT_ID}/services/alloydb.googleapis.com"
  
  # Restricted services
  restricted_services:
    - "run.googleapis.com"
    - "aiplatform.googleapis.com"  
    - "alloydb.googleapis.com"
    - "pubsub.googleapis.com"
    - "storage.googleapis.com"
  
  # Access policy
  access_policy: |
    # Allow access only from authorized networks
    origin.ip in ['10.0.0.0/8']  # Internal VPC ranges only
    
    # Allow access only to/from authorized services
    destination.service_name in RESTRICTED_SERVICES
    
    # Deny all external internet access except approved APIs
    NOT (destination.ip in EXTERNAL_IP_RANGES AND 
         request.headers['host'] NOT in APPROVED_EXTERNAL_HOSTS)
```

#### Egress Policy (Highly Restrictive)
```yaml
egress_policy:
  # Deny all by default
  default_action: "DENY"
  
  # Allowed internal communication
  allow_rules:
    - name: "agent-to-agent-communication"
      destination: "*.a.run.app"              # Cloud Run internal domains
      ports: ["443"]
      protocol: "HTTPS"
      
    - name: "vertex-ai-endpoints"
      destination: "aiplatform.googleapis.com"
      ports: ["443"] 
      protocol: "HTTPS"
      
    - name: "alloydb-database"
      destination: "10.0.0.0/24"              # AlloyDB VPC range
      ports: ["5432"]
      protocol: "TCP"
  
  # Emergency overrides (audit logged)
  emergency_rules:
    - name: "emergency-market-data"
      destination: "api.energymarket.com"
      enabled: false                          # Disabled by default
      requires_approval: true
      auto_disable_after: "1h"
```

### Private Service Connect

#### Plant Connectivity
```yaml
private_service_connect:
  endpoint_name: "plant-opcua-endpoint"
  network: "projects/${PROJECT_ID}/global/networks/cemai-vpc"
  subnetwork: "projects/${PROJECT_ID}/regions/${REGION}/subnetworks/plant-subnet"
  
  # Target service (on-premise OPC-UA)
  target_service: "projects/${PLANT_PROJECT}/regions/${REGION}/serviceAttachments/opcua-server"
  
  # Access control
  allowed_principals:
    - "serviceAccount:egress-agent@${PROJECT_ID}.iam.gserviceaccount.com"
  
  # Security configuration
  security_policy: "plant-communication-policy"
  connection_logging: true
  connection_timeout: "30s"
```

## Data Security

### Encryption Standards

#### Encryption at Rest
```yaml
encryption_at_rest:
  # AlloyDB encryption
  alloydb:
    encryption_type: "CUSTOMER_MANAGED_ENCRYPTION_KEY"
    kms_key: "projects/${PROJECT_ID}/locations/${REGION}/keyRings/cemai-ring/cryptoKeys/alloydb-key"
    
  # Cloud Storage encryption  
  storage:
    encryption_type: "CUSTOMER_MANAGED_ENCRYPTION_KEY"
    kms_key: "projects/${PROJECT_ID}/locations/${REGION}/keyRings/cemai-ring/cryptoKeys/storage-key"
    
  # Pub/Sub encryption
  pubsub:
    encryption_type: "CUSTOMER_MANAGED_ENCRYPTION_KEY"
    kms_key: "projects/${PROJECT_ID}/locations/${REGION}/keyRings/cemai-ring/cryptoKeys/pubsub-key"
```

#### Encryption in Transit
```yaml
encryption_in_transit:
  # All HTTPS with TLS 1.3
  tls_policy:
    minimum_version: "TLS_1_3"
    cipher_suites: ["TLS_AES_256_GCM_SHA384", "TLS_CHACHA20_POLY1305_SHA256"]
    
  # mTLS for agent-to-agent communication
  mtls:
    enabled: true
    certificate_authority: "projects/${PROJECT_ID}/locations/${REGION}/certificateAuthorities/cemai-ca"
    client_certificates: true
    
  # OPC-UA encryption
  opcua:
    security_mode: "SignAndEncrypt"
    security_policy: "Basic256Sha256"
    certificate_validation: "strict"
```

### Secret Management

#### Cloud Secret Manager Configuration
```yaml
secrets:
  # API keys and tokens
  - name: "market-data-api-key"
    secret_data: "${MARKET_API_KEY}"
    access_policy:
      - "serviceAccount:optimizer-agent@${PROJECT_ID}.iam.gserviceaccount.com"
  
  # Plant system credentials
  - name: "opcua-credentials"
    secret_data: "${OPCUA_USERNAME}:${OPCUA_PASSWORD}"
    access_policy:
      - "serviceAccount:egress-agent@${PROJECT_ID}.iam.gserviceaccount.com"
  
  # Inter-agent authentication keys
  - name: "agent-signing-key"
    secret_data: "${SIGNING_PRIVATE_KEY}"
    access_policy:
      - "serviceAccount:master-control-agent@${PROJECT_ID}.iam.gserviceaccount.com"
  
  # Database credentials
  - name: "alloydb-password"
    secret_data: "${DB_PASSWORD}"
    access_policy:
      - "serviceAccount:guardian-agent@${PROJECT_ID}.iam.gserviceaccount.com"
      - "serviceAccount:optimizer-agent@${PROJECT_ID}.iam.gserviceaccount.com"
      - "serviceAccount:master-control-agent@${PROJECT_ID}.iam.gserviceaccount.com"
```

## Application Security

### Input Validation Framework
```python
from typing import Any, Dict
from pydantic import BaseModel, ValidationError
import re

class SecurityValidator:
    """Comprehensive input validation for agent communications"""
    
    # Allowed patterns for different input types
    PATTERNS = {
        'agent_id': r'^[a-z][a-z0-9_-]*[a-z0-9]$',
        'message_id': r'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$',
        'numeric_value': r'^-?[0-9]+(\.[0-9]+)?$',
        'control_variable': r'^[a-z][a-z0-9_]*$'
    }
    
    # Maximum sizes to prevent DoS
    MAX_SIZES = {
        'message_payload': 1024 * 1024,  # 1MB
        'string_field': 1000,
        'array_length': 100
    }
    
    @staticmethod
    def validate_a2a_message(message: Dict[str, Any]) -> bool:
        """Validate A2A message structure and content"""
        try:
            # Schema validation
            validated_message = A2AMessage.parse_obj(message)
            
            # Size validation
            if len(str(message)) > SecurityValidator.MAX_SIZES['message_payload']:
                raise ValueError("Message payload too large")
            
            # Pattern validation
            if not re.match(SecurityValidator.PATTERNS['agent_id'], validated_message.sender_agent):
                raise ValueError("Invalid sender agent ID format")
            
            if not re.match(SecurityValidator.PATTERNS['message_id'], validated_message.message_id):
                raise ValueError("Invalid message ID format")
            
            # Content validation
            SecurityValidator._validate_payload_content(validated_message.payload)
            
            return True
            
        except (ValidationError, ValueError) as e:
            logger.error(f"Message validation failed: {e}")
            return False
    
    @staticmethod
    def _validate_payload_content(payload: Dict[str, Any]) -> None:
        """Validate payload content for security threats"""
        
        # Check for injection attempts
        dangerous_patterns = [
            r'<script[^>]*>',  # XSS attempts
            r';\s*drop\s+table',  # SQL injection
            r'__import__',  # Python injection
            r'eval\s*\(',  # Code execution
            r'exec\s*\(',  # Code execution
        ]
        
        payload_str = str(payload).lower()
        for pattern in dangerous_patterns:
            if re.search(pattern, payload_str, re.IGNORECASE):
                raise ValueError(f"Potentially malicious content detected: {pattern}")
        
        # Validate numeric ranges
        for key, value in payload.items():
            if isinstance(value, (int, float)):
                if abs(value) > 1e10:  # Prevent extremely large numbers
                    raise ValueError(f"Numeric value out of safe range: {key}")
```

### Secure API Implementation
```python
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.security import HTTPBearer
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import time

# Rate limiting to prevent abuse
limiter = Limiter(key_func=get_remote_address)
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

security = HTTPBearer()

@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Add security headers to all responses"""
    response = await call_next(request)
    
    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    
    return response

@app.post("/a2a/receive")
@limiter.limit("100/minute")  # Rate limiting
async def receive_message(
    request: Request,
    message: A2AMessage,
    token: HTTPAuthorizationCredentials = Depends(security)
):
    """Secure A2A message endpoint with comprehensive validation"""
    
    # Input validation
    if not SecurityValidator.validate_a2a_message(message.dict()):
        raise HTTPException(status_code=400, detail="Invalid message format")
    
    # Authentication validation
    if not authenticate_message(message):
        # Log security event
        logger.warning(f"Authentication failed for message from {message.sender_agent}")
        raise HTTPException(status_code=401, detail="Authentication failed")
    
    # Authorization validation  
    if not authorize_message(message):
        logger.warning(f"Authorization failed for {message.message_type} from {message.sender_agent}")
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Process message with timeout
    try:
        async with asyncio.timeout(30):  # 30 second timeout
            response = await process_message(message)
        return response
        
    except asyncio.TimeoutError:
        logger.error(f"Message processing timeout for {message.message_id}")
        raise HTTPException(status_code=504, detail="Processing timeout")
    
    except Exception as e:
        logger.error(f"Message processing error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
```

## Monitoring & Incident Response

### Security Event Monitoring
```yaml
security_monitoring:
  # Authentication failures
  auth_failure_alerts:
    threshold: 5  # failures per minute
    action: "block_source_ip"
    notification: "security-team@company.com"
  
  # Unusual access patterns
  anomaly_detection:
    baseline_period: "7d"
    threshold: "2_std_dev"
    actions: ["alert", "additional_logging"]
  
  # Command execution monitoring
  command_monitoring:
    log_all_commands: true
    alert_on_emergency_commands: true
    require_approval_for: ["emergency_stop", "major_changes"]
  
  # Network security events
  network_monitoring:
    blocked_connections: "log_and_alert"
    vpc_violations: "immediate_alert"
    egress_violations: "block_and_alert"
```

### Incident Response Procedures
```yaml
incident_response:
  severity_levels:
    critical:
      - "Unauthorized plant system access"
      - "Command injection detected"
      - "Mass authentication failures"
      response_time: "15_minutes"
      escalation: "security_team_lead"
    
    high:
      - "Agent compromise suspected"
      - "Abnormal network traffic"
      - "Configuration changes"
      response_time: "1_hour"
      escalation: "on_call_engineer"
    
    medium:
      - "Repeated authentication failures"
      - "Performance anomalies"
      response_time: "4_hours"
      escalation: "team_lead"
  
  automated_responses:
    - condition: "auth_failures > 10/minute"
      action: "temporary_ip_block"
      duration: "1_hour"
    
    - condition: "agent_not_responding"
      action: "restart_agent_service"
      max_attempts: 3
    
    - condition: "emergency_command_detected"
      action: "human_approval_required"
      timeout: "5_minutes"
```

### Audit & Compliance

#### Audit Trail Requirements
```yaml
audit_requirements:
  # All command executions
  command_audit:
    log_fields: ["timestamp", "agent_id", "command_type", "parameters", "outcome"]
    retention: "7_years"
    integrity_protection: "digital_signature"
  
  # All agent decisions
  decision_audit:
    log_fields: ["timestamp", "decision_id", "input_proposals", "reasoning", "outcome"]
    retention: "7_years"  
    integrity_protection: "immutable_log"
  
  # All access attempts
  access_audit:
    log_fields: ["timestamp", "source_ip", "user_agent", "outcome", "resource"]
    retention: "1_year"
    real_time_monitoring: true
  
  # Configuration changes
  config_audit:
    log_fields: ["timestamp", "changed_by", "old_value", "new_value", "justification"]
    retention: "7_years"
    approval_required: true
```

This comprehensive security framework ensures that the CemAI Agent Swarm operates with enterprise-grade security while maintaining the flexibility and performance required for autonomous industrial operations.
