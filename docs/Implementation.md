# CemAI Agents - Implementation Guide

## Overview
This document provides detailed implementation guidance for developing the CemAI Agent Swarm. It covers the complete development lifecycle from initial setup to production deployment, following enterprise best practices and ensuring high-quality, secure, and maintainable code.

## Implementation Phases

### Phase 1: Foundation Setup (Weeks 1-2)

#### 1.1 Development Environment Setup
```bash
# Clone repository and setup environment
git clone <repository-url>
cd cemai-agents
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Install development tools
pip install pre-commit black isort flake8 mypy pytest

# Setup pre-commit hooks
pre-commit install
```

#### 1.2 Google Cloud Setup
```bash
# Authenticate with Google Cloud
gcloud auth login
gcloud auth application-default login

# Set project configuration
export PROJECT_ID="your-cemai-project"
export REGION="us-central1"
gcloud config set project $PROJECT_ID
gcloud config set compute/region $REGION

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  aiplatform.googleapis.com \
  alloydb.googleapis.com \
  pubsub.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com
```

#### 1.3 Infrastructure Deployment
```bash
# Deploy base infrastructure
cd infrastructure/terraform
terraform init
terraform workspace new development
terraform plan -var="project_id=$PROJECT_ID"
terraform apply
```

### Phase 2: Shared Components Implementation (Weeks 2-3)

#### 2.1 A2A Protocol Implementation
```python
# shared/protocols/a2a_client.py
import asyncio
import httpx
from typing import Dict, Any
from google.auth.transport.requests import Request
from google.oauth2 import service_account

class A2AClient:
    def __init__(self, agent_id: str, service_account_path: str):
        self.agent_id = agent_id
        self.credentials = service_account.Credentials.from_service_account_file(
            service_account_path,
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
    
    async def send_message(self, recipient: str, message_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Send A2A message with authentication"""
        # Get identity token
        self.credentials.refresh(Request())
        token = self.credentials.token
        
        message = {
            "message_id": self._generate_message_id(),
            "sender_agent": self.agent_id,
            "recipient_agent": recipient,
            "message_type": message_type,
            "payload": payload,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        endpoint = self._resolve_agent_endpoint(recipient)
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{endpoint}/a2a/receive",
                json=message,
                headers={"Authorization": f"Bearer {token}"},
                timeout=30.0
            )
            
            return response.json()
    
    def _resolve_agent_endpoint(self, agent_id: str) -> str:
        """Resolve agent service endpoint"""
        endpoints = {
            "guardian_agent": f"https://guardian-agent-{self.region}-{self.project_id}.a.run.app",
            "optimizer_agent": f"https://optimizer-agent-{self.region}-{self.project_id}.a.run.app",
            "master_control_agent": f"https://master-control-agent-{self.region}-{self.project_id}.a.run.app",
            "egress_agent": f"https://egress-agent-{self.region}-{self.project_id}.a.run.app"
        }
        return endpoints.get(agent_id)
```

#### 2.2 Security Utilities Implementation
```python
# shared/security/auth_utils.py
from google.oauth2 import id_token
from google.auth.transport import requests
import logging

logger = logging.getLogger(__name__)

class SecurityValidator:
    @staticmethod
    def validate_agent_token(token: str, expected_agent: str) -> bool:
        """Validate IAM identity token from another agent"""
        try:
            # Verify token signature and extract claims
            claims = id_token.verify_oauth2_token(
                token, requests.Request()
            )
            
            # Verify the token is from expected agent service account
            expected_email = f"{expected_agent}@{PROJECT_ID}.iam.gserviceaccount.com"
            actual_email = claims.get('email')
            
            if actual_email != expected_email:
                logger.warning(f"Token email mismatch: expected {expected_email}, got {actual_email}")
                return False
                
            return True
            
        except ValueError as e:
            logger.error(f"Token validation failed: {e}")
            return False
    
    @staticmethod
    def validate_request_payload(payload: Dict[str, Any]) -> bool:
        """Validate request payload for security threats"""
        # Implementation of payload validation logic
        dangerous_patterns = [
            r'<script[^>]*>',  # XSS
            r';\s*drop\s+table',  # SQL injection
            r'__import__',  # Python injection
        ]
        
        payload_str = str(payload).lower()
        for pattern in dangerous_patterns:
            if re.search(pattern, payload_str, re.IGNORECASE):
                logger.warning(f"Dangerous pattern detected: {pattern}")
                return False
        
        return True
```

#### 2.3 Monitoring Utilities Implementation
```python
# shared/monitoring/telemetry.py
from opentelemetry import trace
from opentelemetry.exporter.cloud_trace import CloudTraceSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
import structlog
import json

class TelemetryManager:
    def __init__(self, agent_id: str, project_id: str):
        self.agent_id = agent_id
        self.project_id = project_id
        self._setup_tracing()
        self._setup_logging()
    
    def _setup_tracing(self):
        """Configure distributed tracing"""
        trace.set_tracer_provider(TracerProvider())
        
        cloud_trace_exporter = CloudTraceSpanExporter(
            project_id=self.project_id
        )
        
        span_processor = BatchSpanProcessor(cloud_trace_exporter)
        trace.get_tracer_provider().add_span_processor(span_processor)
        
        self.tracer = trace.get_tracer(f"cemai.{self.agent_id}")
    
    def _setup_logging(self):
        """Configure structured logging"""
        structlog.configure(
            processors=[
                structlog.processors.add_log_level,
                structlog.processors.add_logger_name,
                structlog.processors.TimeStamper(fmt="ISO"),
                structlog.processors.JSONRenderer()
            ],
            wrapper_class=structlog.make_filtering_bound_logger(20),
            logger_factory=structlog.PrintLoggerFactory(),
            cache_logger_on_first_use=True,
        )
        
        self.logger = structlog.get_logger(agent_id=self.agent_id)
    
    def trace_agent_operation(self, operation_name: str):
        """Decorator for tracing agent operations"""
        def decorator(func):
            def wrapper(*args, **kwargs):
                with self.tracer.start_as_current_span(operation_name) as span:
                    span.set_attributes({
                        "agent.id": self.agent_id,
                        "operation.name": operation_name,
                        "operation.type": "agent_task"
                    })
                    
                    try:
                        result = func(*args, **kwargs)
                        span.set_attribute("operation.status", "success")
                        return result
                    except Exception as e:
                        span.set_attribute("operation.status", "error")
                        span.set_attribute("error.message", str(e))
                        raise
            return wrapper
        return decorator
```

### Phase 3: Agent Implementation (Weeks 3-6)

#### 3.1 Guardian Agent Implementation
```python
# agents/guardian/src/main.py
from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer
from google.cloud import aiplatform
import asyncio
from typing import Dict, Any

from shared.protocols.a2a_client import A2AClient
from shared.security.auth_utils import SecurityValidator
from shared.monitoring.telemetry import TelemetryManager

app = FastAPI(title="Guardian Agent", version="1.0.0")
security = HTTPBearer()
telemetry = TelemetryManager("guardian_agent", PROJECT_ID)

class GuardianAgent:
    def __init__(self):
        self.agent_id = "guardian_agent"
        self.a2a_client = A2AClient(self.agent_id, SERVICE_ACCOUNT_PATH)
        self.prediction_model = self._init_prediction_model()
        self.quality_bands = {"LSF": {"min": 98.0, "max": 102.0}}
    
    def _init_prediction_model(self):
        """Initialize Vertex AI forecasting model"""
        aiplatform.init(project=PROJECT_ID, location=REGION)
        endpoint = aiplatform.Endpoint(FORECASTING_ENDPOINT_ID)
        return endpoint
    
    @telemetry.trace_agent_operation("predict_lsf")
    async def predict_lsf(self, process_data: Dict[str, Any]) -> Dict[str, Any]:
        """Predict LSF using Vertex AI model"""
        try:
            # Prepare model input
            instances = [self._format_model_input(process_data)]
            
            # Get prediction from Vertex AI
            prediction = self.prediction_model.predict(instances=instances)
            
            predicted_lsf = prediction.predictions[0]["value"]
            confidence = prediction.predictions[0]["confidence"]
            
            return {
                "predicted_lsf": predicted_lsf,
                "confidence": confidence,
                "horizon_minutes": 60,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            telemetry.logger.error("LSF prediction failed", error=str(e))
            raise HTTPException(status_code=500, detail="Prediction failed")
    
    async def calculate_minimal_action(self, prediction: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate minimal corrective action"""
        predicted_lsf = prediction["predicted_lsf"]
        target_lsf = 100.0
        
        if self.quality_bands["LSF"]["min"] <= predicted_lsf <= self.quality_bands["LSF"]["max"]:
            return {"action_required": False, "reason": "Within quality bands"}
        
        deviation = predicted_lsf - target_lsf
        action_magnitude = min(abs(deviation) * 0.1, 0.5)  # Minimal effective action
        
        if predicted_lsf < target_lsf:
            # LSF too low - increase kiln speed slightly
            proposed_action = {
                "control_variable": "kiln_speed",
                "current_value": 3.2,  # From current data
                "proposed_value": 3.2 + action_magnitude,
                "adjustment_type": "increase"
            }
        else:
            # LSF too high - decrease kiln speed slightly
            proposed_action = {
                "control_variable": "kiln_speed", 
                "current_value": 3.2,
                "proposed_value": 3.2 - action_magnitude,
                "adjustment_type": "decrease"
            }
        
        return {
            "action_required": True,
            "proposed_action": proposed_action,
            "expected_outcome": target_lsf,
            "confidence": prediction["confidence"]
        }
    
    async def generate_stability_proposal(self, process_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate complete stability proposal"""
        # Get prediction
        prediction = await self.predict_lsf(process_data)
        
        # Calculate action if needed
        action = await self.calculate_minimal_action(prediction)
        
        if not action["action_required"]:
            return None
        
        # Create A2A proposal message
        proposal = {
            "proposal_type": "stability_correction",
            "urgency": self._determine_urgency(prediction),
            "predicted_deviation": prediction["predicted_lsf"] - 100.0,
            "confidence": prediction["confidence"],
            "proposed_action": action["proposed_action"],
            "expected_outcome": action["expected_outcome"],
            "risk_assessment": "low",
            "timestamp": datetime.utcnow().isoformat()
        }
        
        return proposal

@app.post("/process-data")
async def process_plant_data(data: Dict[str, Any], token = Depends(security)):
    """Process incoming plant data and generate proposals if needed"""
    guardian = GuardianAgent()
    
    # Validate authentication
    if not SecurityValidator.validate_agent_token(token.credentials, "data_ingestion"):
        raise HTTPException(status_code=401, detail="Invalid authentication")
    
    # Generate proposal if stability issue predicted
    proposal = await guardian.generate_stability_proposal(data)
    
    if proposal:
        # Send proposal to Master Control Agent
        response = await guardian.a2a_client.send_message(
            recipient="master_control_agent",
            message_type="proposal",
            payload=proposal
        )
        
        telemetry.logger.info(
            "Stability proposal sent",
            proposal_type=proposal["proposal_type"],
            urgency=proposal["urgency"]
        )
        
        return {"status": "proposal_sent", "proposal_id": response.get("proposal_id")}
    
    return {"status": "no_action_required"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "agent": "guardian", "timestamp": datetime.utcnow().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
```

#### 3.2 Master Control Agent Implementation
```python
# agents/master_control/src/main.py
from langgraph import Graph, Node
from langchain.llms import VertexAI
from sqlalchemy.orm import Session
import asyncio

class MasterControlAgent:
    def __init__(self):
        self.agent_id = "master_control_agent"
        self.llm = VertexAI(model_name="gemini-2.5-pro")
        self.workflow_graph = self._create_workflow_graph()
        self.constitution = self._load_decision_constitution()
    
    def _create_workflow_graph(self) -> Graph:
        """Create LangGraph workflow for decision making"""
        workflow = Graph()
        
        # Define workflow nodes
        workflow.add_node("collect_proposals", self.collect_proposals)
        workflow.add_node("analyze_conflicts", self.analyze_conflicts)
        workflow.add_node("resolve_conflicts", self.resolve_conflicts)
        workflow.add_node("generate_decision", self.generate_decision)
        workflow.add_node("send_commands", self.send_commands)
        
        # Define workflow edges
        workflow.add_edge("collect_proposals", "analyze_conflicts")
        workflow.add_edge("analyze_conflicts", "resolve_conflicts")
        workflow.add_edge("resolve_conflicts", "generate_decision")
        workflow.add_edge("generate_decision", "send_commands")
        
        return workflow
    
    async def collect_proposals(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Collect proposals from all agents"""
        proposals = []
        
        # Request proposals from Guardian Agent
        guardian_proposal = await self.a2a_client.send_message(
            recipient="guardian_agent",
            message_type="request_proposal",
            payload={"context": state.get("trigger_data")}
        )
        if guardian_proposal:
            proposals.append(guardian_proposal)
        
        # Request proposals from Optimizer Agent
        optimizer_proposal = await self.a2a_client.send_message(
            recipient="optimizer_agent",
            message_type="request_proposal", 
            payload={"context": state.get("trigger_data")}
        )
        if optimizer_proposal:
            proposals.append(optimizer_proposal)
        
        return {"proposals": proposals}
    
    async def analyze_conflicts(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze conflicts between proposals"""
        proposals = state["proposals"]
        
        if len(proposals) <= 1:
            return {"conflicts": [], "analysis": "No conflicts detected"}
        
        # Use Gemini to analyze conflicts
        conflict_analysis_prompt = f"""
        Analyze the following proposals for conflicts:
        
        {json.dumps(proposals, indent=2)}
        
        Identify:
        1. Direct conflicts (same parameter, different values)
        2. Indirect conflicts (actions that oppose each other)
        3. Priority conflicts (different urgency levels)
        
        Format response as JSON with conflict descriptions and severity.
        """
        
        analysis = await self.llm.agenerate([conflict_analysis_prompt])
        conflicts = json.loads(analysis.generations[0][0].text)
        
        return {"conflicts": conflicts, "analysis": analysis}
    
    async def resolve_conflicts(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Resolve conflicts using Constitutional AI framework"""
        conflicts = state["conflicts"]
        proposals = state["proposals"]
        
        if not conflicts:
            return {"resolution": "no_conflicts", "final_actions": proposals}
        
        # Apply Constitutional AI reasoning
        resolution_prompt = f"""
        Using the following decision-making constitution:
        
        {self.constitution}
        
        Resolve conflicts between these proposals:
        {json.dumps(proposals, indent=2)}
        
        Detected conflicts:
        {json.dumps(conflicts, indent=2)}
        
        Apply the constitutional framework:
        1. Summarize & Verify the proposals and their goals
        2. Identify explicit conflicts
        3. Evaluate against constitution priorities: Safety > Quality > Emissions > Cost
        4. Synthesize compromise solution
        
        Provide detailed reasoning and final recommended actions.
        """
        
        resolution = await self.llm.agenerate([resolution_prompt])
        resolved_actions = json.loads(resolution.generations[0][0].text)
        
        return {
            "resolution": resolved_actions,
            "reasoning": resolution.generations[0][0].text
        }
    
    async def generate_decision(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Generate final decision with complete audit trail"""
        resolution = state["resolution"]
        
        decision = {
            "decision_id": str(uuid.uuid4()),
            "timestamp": datetime.utcnow().isoformat(),
            "original_proposals": state["proposals"],
            "conflict_analysis": state.get("conflicts", []),
            "resolution_reasoning": resolution,
            "final_actions": resolution.get("recommended_actions", []),
            "decision_maker": self.agent_id,
            "constitution_applied": True
        }
        
        # Store decision in database for audit trail
        await self._store_decision_audit(decision)
        
        return {"decision": decision}
    
    async def send_commands(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Send final commands to Egress Agent"""
        decision = state["decision"]
        actions = decision["final_actions"]
        
        results = []
        for action in actions:
            command_result = await self.a2a_client.send_message(
                recipient="egress_agent",
                message_type="command",
                payload={
                    "command_id": str(uuid.uuid4()),
                    "action": action,
                    "authorization": decision["decision_id"],
                    "priority": action.get("urgency", "normal")
                }
            )
            results.append(command_result)
        
        return {"command_results": results, "status": "completed"}

# FastAPI endpoint to trigger decision workflow
@app.post("/trigger-decision")
async def trigger_decision_workflow(trigger_data: Dict[str, Any]):
    """Trigger the complete decision-making workflow"""
    master_control = MasterControlAgent()
    
    # Execute LangGraph workflow
    initial_state = {"trigger_data": trigger_data}
    final_state = await master_control.workflow_graph.arun(initial_state)
    
    return {
        "workflow_id": str(uuid.uuid4()),
        "status": "completed",
        "decision": final_state.get("decision"),
        "execution_time": final_state.get("execution_time")
    }
```

### Phase 4: Integration and Testing (Weeks 7-8)

#### 4.1 Integration Testing Setup
```python
# tests/integration/test_agent_communication.py
import pytest
import asyncio
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_guardian_to_master_control_workflow():
    """Test complete workflow from Guardian to Master Control"""
    
    # Mock plant data indicating quality deviation
    plant_data = {
        "kiln_temperature": 1450,
        "feed_rate": 185,
        "fuel_flow": 5.2,
        "current_lsf": 99.1,  # Approaching lower quality band
        "timestamp": datetime.utcnow().isoformat()
    }
    
    # Mock Guardian Agent prediction
    with patch('agents.guardian.src.main.GuardianAgent.predict_lsf') as mock_predict:
        mock_predict.return_value = {
            "predicted_lsf": 97.5,  # Below quality band
            "confidence": 0.92,
            "horizon_minutes": 60
        }
        
        # Mock Master Control Agent response
        with patch('shared.protocols.a2a_client.A2AClient.send_message') as mock_send:
            mock_send.return_value = {"proposal_id": "test-123", "status": "received"}
            
            # Test Guardian Agent processing
            guardian = GuardianAgent()
            proposal = await guardian.generate_stability_proposal(plant_data)
            
            # Verify proposal structure
            assert proposal is not None
            assert proposal["proposal_type"] == "stability_correction"
            assert proposal["urgency"] in ["low", "medium", "high", "critical"]
            assert "proposed_action" in proposal
            assert proposal["proposed_action"]["control_variable"] == "kiln_speed"

@pytest.mark.asyncio 
async def test_conflict_resolution_workflow():
    """Test conflict resolution between Guardian and Optimizer"""
    
    # Mock conflicting proposals
    guardian_proposal = {
        "proposal_type": "stability_correction",
        "urgency": "high",
        "proposed_action": {
            "control_variable": "fuel_flow",
            "current_value": 5.2,
            "proposed_value": 5.0,  # Reduce fuel for stability
            "adjustment_type": "decrease"
        }
    }
    
    optimizer_proposal = {
        "proposal_type": "cost_optimization", 
        "urgency": "medium",
        "proposed_action": {
            "control_variable": "fuel_flow",
            "current_value": 5.2,
            "proposed_value": 5.5,  # Increase fuel for optimization
            "adjustment_type": "increase"
        }
    }
    
    master_control = MasterControlAgent()
    
    # Test conflict analysis
    conflicts = await master_control.analyze_conflicts({
        "proposals": [guardian_proposal, optimizer_proposal]
    })
    
    assert len(conflicts["conflicts"]) > 0
    assert "fuel_flow" in str(conflicts["conflicts"])
    
    # Test conflict resolution
    resolution = await master_control.resolve_conflicts({
        "proposals": [guardian_proposal, optimizer_proposal],
        "conflicts": conflicts["conflicts"]
    })
    
    # Verify resolution follows constitution (Safety > Quality > Cost)
    assert "recommended_actions" in resolution["resolution"]
    # Should prioritize Guardian (quality/safety) over Optimizer (cost)
```

#### 4.2 Load Testing Implementation
```python
# tests/load/test_decision_latency.py
from locust import HttpUser, task, between
import json
import time

class AgentLoadTest(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        """Setup for load testing"""
        self.auth_token = self.get_auth_token()
    
    def get_auth_token(self):
        """Get authentication token for testing"""
        # Implementation to get valid test token
        return "test-token-123"
    
    @task(3)
    def test_guardian_prediction_latency(self):
        """Test Guardian Agent prediction response time"""
        start_time = time.time()
        
        test_data = {
            "kiln_temperature": 1445,
            "feed_rate": 185,
            "fuel_flow": 5.1,
            "timestamp": time.time()
        }
        
        with self.client.post(
            "/process-data",
            json=test_data,
            headers={"Authorization": f"Bearer {self.auth_token}"},
            catch_response=True
        ) as response:
            response_time = (time.time() - start_time) * 1000  # Convert to ms
            
            if response.status_code == 200:
                if response_time > 30000:  # 30 seconds
                    response.failure(f"Response too slow: {response_time}ms")
                else:
                    response.success()
            else:
                response.failure(f"HTTP {response.status_code}")
    
    @task(1) 
    def test_master_control_decision_workflow(self):
        """Test complete decision workflow latency"""
        start_time = time.time()
        
        trigger_data = {
            "trigger_type": "quality_deviation",
            "severity": "medium",
            "affected_parameters": ["lime_saturation_factor"],
            "timestamp": time.time()
        }
        
        with self.client.post(
            "/trigger-decision",
            json=trigger_data,
            headers={"Authorization": f"Bearer {self.auth_token}"},
            catch_response=True
        ) as response:
            response_time = (time.time() - start_time) * 1000
            
            if response.status_code == 200:
                if response_time > 60000:  # 60 seconds target
                    response.failure(f"Decision latency exceeded: {response_time}ms")
                else:
                    response.success()
            else:
                response.failure(f"HTTP {response.status_code}")
```

### Phase 5: Production Deployment (Weeks 9-10)

#### 5.1 CI/CD Pipeline Setup
```yaml
# .github/workflows/deploy.yml
name: Deploy CemAI Agents

on:
  push:
    branches: [main]
    paths: ['agents/**', 'shared/**', 'infrastructure/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
          
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-asyncio pytest-cov
          
      - name: Run tests
        run: |
          pytest tests/ -v --cov=agents --cov=shared --cov-min-percentage=90
          
      - name: Security scan
        run: |
          bandit -r agents/ shared/ -f json -o security-report.json
          
  deploy-infrastructure:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2
        
      - name: Terraform Deploy
        run: |
          cd infrastructure/terraform
          terraform init
          terraform plan -var-file="production.tfvars"
          terraform apply -auto-approve
          
  deploy-agents:
    needs: [test, deploy-infrastructure]
    runs-on: ubuntu-latest
    strategy:
      matrix:
        agent: [guardian, optimizer, master_control, egress]
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Google Cloud
        uses: google-github-actions/setup-gcloud@v1
        with:
          service_account_key: ${{ secrets.GCP_SA_KEY }}
          project_id: ${{ secrets.GCP_PROJECT_ID }}
          
      - name: Deploy Agent
        run: |
          gcloud run deploy ${{ matrix.agent }}-agent \
            --source=agents/${{ matrix.agent }} \
            --region=us-central1 \
            --service-account=${{ matrix.agent }}-agent@${{ secrets.GCP_PROJECT_ID }}.iam.gserviceaccount.com \
            --vpc-connector=cemai-agents-connector \
            --vpc-egress=private-ranges-only
```

#### 5.2 Production Monitoring Setup
```python
# monitoring/production_monitoring.py
from google.cloud import monitoring_v3
import asyncio
from datetime import datetime, timedelta

class ProductionMonitor:
    def __init__(self, project_id: str):
        self.project_id = project_id
        self.monitoring_client = monitoring_v3.MetricServiceClient()
        
    async def monitor_system_health(self):
        """Continuous system health monitoring"""
        while True:
            try:
                # Check agent availability
                await self.check_agent_health()
                
                # Monitor decision latency
                await self.monitor_decision_latency()
                
                # Check business KPIs
                await self.monitor_business_metrics()
                
                await asyncio.sleep(60)  # Check every minute
                
            except Exception as e:
                logger.error(f"Monitoring error: {e}")
                await asyncio.sleep(5)
    
    async def check_agent_health(self):
        """Check health of all agent services"""
        agents = ["guardian", "optimizer", "master-control", "egress"]
        
        for agent in agents:
            try:
                endpoint = f"https://{agent}-agent-us-central1-{self.project_id}.a.run.app"
                async with httpx.AsyncClient() as client:
                    response = await client.get(f"{endpoint}/health", timeout=10)
                    
                    if response.status_code != 200:
                        await self.send_alert(f"{agent}-agent", "health_check_failed", {
                            "status_code": response.status_code,
                            "agent": agent
                        })
                        
            except Exception as e:
                await self.send_alert(f"{agent}-agent", "health_check_error", {
                    "error": str(e),
                    "agent": agent
                })
    
    async def monitor_decision_latency(self):
        """Monitor end-to-end decision latency"""
        # Query Cloud Monitoring for decision latency metrics
        query = f"""
        fetch cloud_run_revision
        | filter resource.service_name == "master-control-agent"
        | metric 'custom.googleapis.com/cemai/decision_latency'
        | group_by [resource.service_name], [value_percentile_99: percentile(value, 99)]
        | within 5m
        """
        
        # Execute query and check against SLA
        # Implementation for metric query and alerting
        
    async def send_alert(self, service: str, alert_type: str, details: Dict[str, Any]):
        """Send alert for system issues"""
        alert_payload = {
            "timestamp": datetime.utcnow().isoformat(),
            "service": service,
            "alert_type": alert_type,
            "details": details,
            "severity": self.determine_severity(alert_type)
        }
        
        # Send to alerting system (Slack, PagerDuty, etc.)
        logger.error(f"ALERT: {alert_type} for {service}", extra=alert_payload)

if __name__ == "__main__":
    monitor = ProductionMonitor(PROJECT_ID)
    asyncio.run(monitor.monitor_system_health())
```

## Implementation Best Practices

### Code Quality Standards
- **Type Hints**: All functions must have proper type annotations
- **Docstrings**: Google-style docstrings for all public functions
- **Error Handling**: Comprehensive exception handling with proper logging
- **Testing**: Minimum 90% code coverage with unit and integration tests
- **Security**: Input validation, authentication, and authorization for all endpoints

### Performance Optimization
- **Async Operations**: Use async/await for all I/O operations
- **Connection Pooling**: Reuse database and HTTP connections
- **Caching**: Cache model predictions and configuration data appropriately
- **Resource Management**: Proper cleanup of resources and connections

### Security Implementation
- **Authentication**: IAM-based authentication for all inter-agent communication
- **Authorization**: Role-based access control with least privilege principle
- **Input Validation**: Validate and sanitize all external inputs
- **Audit Logging**: Comprehensive audit trails for all operations
- **Encryption**: TLS 1.3 for all network communication, encryption at rest for sensitive data

### Monitoring and Observability
- **Distributed Tracing**: Full request tracing across all agents
- **Structured Logging**: JSON-formatted logs with correlation IDs
- **Metrics Collection**: Business and technical metrics for all operations
- **Alerting**: Proactive alerting for system health and business KPIs
- **Dashboards**: Real-time dashboards for different stakeholder groups

This implementation guide provides the foundation for building a production-ready, enterprise-grade CemAI Agent Swarm system that meets all requirements for autonomous cement plant optimization.
