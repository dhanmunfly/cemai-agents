# CemAI Agents - Observability Specification

## Overview

This document defines the comprehensive observability framework for the CemAI Agent Swarm, ensuring complete visibility into system behavior, performance, and decision-making processes. The framework implements "Radical Observability" principles where every decision, proposal, and conflict resolution is fully traceable and debuggable.

## Observability Principles

### 1. Three Pillars of Observability
- **Logs**: Detailed structured logs for debugging and audit trails
- **Metrics**: Real-time performance and business metrics
- **Traces**: End-to-end request flow through the agent swarm

### 2. Proactive Monitoring
- Predictive alerting based on trend analysis
- Anomaly detection for unusual patterns
- SLA monitoring with automated remediation

### 3. Security-First Observability
- All monitoring data encrypted and access-controlled
- Audit trails for all observability system access
- Privacy-preserving telemetry collection

## Distributed Tracing

### Trace Architecture
Every request flow through the agent swarm is instrumented with distributed tracing using Google Cloud Trace, providing complete visibility into multi-agent interactions.

#### Trace Structure
```python
# Example trace hierarchy for a decision workflow
Trace: decision_workflow_abc123
├── Span: master_control.receive_trigger
│   ├── Span: master_control.request_proposals
│   │   ├── Span: guardian.generate_proposal
│   │   │   ├── Span: vertex_ai.forecast_lsf
│   │   │   ├── Span: guardian.calculate_action
│   │   │   └── Span: guardian.format_proposal
│   │   └── Span: optimizer.generate_proposal
│   │       ├── Span: vertex_ai.optimize_fuel_mix
│   │       ├── Span: pubsub.get_market_data
│   │       └── Span: optimizer.format_proposal
│   ├── Span: master_control.resolve_conflicts
│   │   ├── Span: gemini.analyze_proposals
│   │   ├── Span: master_control.apply_constitution
│   │   └── Span: master_control.synthesize_compromise
│   └── Span: egress.execute_command
│       ├── Span: egress.validate_command
│       ├── Span: opcua.send_command
│       └── Span: egress.log_execution
```

#### Custom Trace Attributes
```python
# Standard attributes for all agent spans
STANDARD_ATTRIBUTES = {
    "agent.id": "guardian_agent",
    "agent.version": "v1.0.0",
    "conversation.id": "conv_abc123",
    "message.id": "msg_def456",
    "message.type": "proposal",
    "workflow.stage": "conflict_resolution",
    "security.principal": "guardian-agent@project.iam.gserviceaccount.com"
}

# Business-specific attributes
BUSINESS_ATTRIBUTES = {
    "cement.plant.id": "plant_001",
    "cement.process.variable": "lime_saturation_factor",
    "cement.prediction.horizon": "60_minutes",
    "cement.optimization.objective": "minimize_cost",
    "cement.risk.level": "medium"
}

# Performance attributes
PERFORMANCE_ATTRIBUTES = {
    "model.inference.latency_ms": 150,
    "model.confidence": 0.95,
    "prediction.accuracy": 0.92,
    "optimization.improvement_percent": 3.2
}
```

#### Trace Sampling Strategy
```yaml
sampling_config:
  # Always sample critical workflows
  always_sample:
    - "emergency_stop"
    - "safety_violation"
    - "quality_deviation"
    - "system_failure"
  
  # High sampling for important workflows
  high_sampling:
    rate: 0.5  # 50%
    workflows:
      - "decision_workflow"
      - "conflict_resolution"
      - "command_execution"
  
  # Standard sampling for regular operations
  standard_sampling:
    rate: 0.1  # 10%
    workflows:
      - "health_check"
      - "status_update"
      - "data_ingestion"
  
  # Low sampling for high-volume operations
  low_sampling:
    rate: 0.01  # 1%
    workflows:
      - "metric_collection"
      - "heartbeat"
```

## Logging Framework

### Structured Logging Standard
All agents use structured JSON logging with standardized fields for consistency and searchability.

#### Log Entry Structure
```json
{
  "timestamp": "2024-09-19T21:00:00.000Z",
  "severity": "INFO",
  "agent_id": "guardian_agent",
  "version": "v1.0.0",
  "trace_id": "abc123def456",
  "span_id": "span789",
  "conversation_id": "conv_abc123",
  "message": "Generated stability proposal",
  "event_type": "proposal_generated",
  "context": {
    "prediction": {
      "variable": "lime_saturation_factor",
      "current_value": 99.2,
      "predicted_value": 97.8,
      "confidence": 0.95,
      "horizon_minutes": 60
    },
    "proposed_action": {
      "control_variable": "kiln_speed",
      "current_value": 3.2,
      "proposed_value": 3.3,
      "adjustment_magnitude": 0.1
    }
  },
  "metadata": {
    "request_id": "req_123",
    "user_agent": "Guardian/1.0",
    "source_ip": "10.0.1.15",
    "duration_ms": 245
  }
}
```

#### Log Levels and Categories
```python
# Log severity levels (Google Cloud Logging standard)
LOG_LEVELS = {
    "DEBUG": "Detailed information for debugging",
    "INFO": "General operational information",
    "NOTICE": "Normal but significant events",
    "WARNING": "Warning conditions that require attention",
    "ERROR": "Error conditions that affect operation",
    "CRITICAL": "Critical conditions requiring immediate action",
    "ALERT": "System-wide alerts requiring operator action",
    "EMERGENCY": "System is unusable, emergency response required"
}

# Event categories for filtering and analysis
EVENT_CATEGORIES = {
    "agent.startup": "Agent initialization and startup",
    "agent.shutdown": "Agent graceful shutdown",
    "prediction.generated": "ML model prediction completed",
    "proposal.created": "Agent created proposal",
    "proposal.sent": "Proposal sent to Master Control",
    "decision.received": "Decision received from Master Control",
    "command.executed": "Command sent to plant systems",
    "error.handled": "Error caught and handled",
    "security.event": "Security-related event",
    "performance.metric": "Performance measurement",
    "audit.trail": "Audit trail entry"
}
```

#### Log Retention and Storage
```yaml
log_retention_policy:
  # Critical security and audit logs
  security_logs:
    retention_days: 2555  # 7 years for compliance
    storage_class: "STANDARD"
    encryption: "CUSTOMER_MANAGED"
    
  # Business decision logs
  decision_logs:
    retention_days: 2555  # 7 years for compliance
    storage_class: "STANDARD"
    encryption: "CUSTOMER_MANAGED"
    
  # Operational logs
  operational_logs:
    retention_days: 365   # 1 year
    storage_class: "STANDARD"
    after_90_days: "NEARLINE"
    
  # Debug logs
  debug_logs:
    retention_days: 30    # 30 days
    storage_class: "STANDARD"
    
  # Performance logs
  performance_logs:
    retention_days: 90    # 90 days
    storage_class: "STANDARD"
```

## Metrics Collection

### Business Metrics
Key performance indicators that directly relate to business outcomes and system effectiveness.

```python
# Decision Quality Metrics
DECISION_METRICS = {
    "cemai.decision.accuracy": {
        "type": "gauge",
        "description": "Percentage of decisions that achieved expected outcomes",
        "unit": "percent",
        "labels": ["agent_id", "decision_type"],
        "target": 95.0
    },
    
    "cemai.decision.latency": {
        "type": "histogram",
        "description": "Time from trigger to final decision",
        "unit": "seconds",
        "labels": ["agent_id", "urgency"],
        "buckets": [1, 5, 10, 30, 60, 120, 300],
        "target": 60.0
    },
    
    "cemai.proposal.acceptance_rate": {
        "type": "gauge",
        "description": "Percentage of proposals accepted by Master Control",
        "unit": "percent",
        "labels": ["agent_id", "proposal_type"],
        "target": 90.0
    }
}

# Plant Performance Metrics
PLANT_METRICS = {
    "cemai.plant.power_consumption": {
        "type": "gauge",
        "description": "Specific power consumption (kWh/ton)",
        "unit": "kwh_per_ton",
        "labels": ["plant_id", "optimization_period"],
        "target_improvement": -5.0  # 5% reduction
    },
    
    "cemai.plant.heat_rate": {
        "type": "gauge",
        "description": "Specific heat consumption (kcal/kg)",
        "unit": "kcal_per_kg",
        "labels": ["plant_id", "fuel_mix"],
        "target_improvement": -3.0  # 3% improvement
    },
    
    "cemai.plant.alternative_fuel_ratio": {
        "type": "gauge",
        "description": "Percentage of alternative fuels used",
        "unit": "percent",
        "labels": ["plant_id", "fuel_type"],
        "target": 15.0  # 15% alternative fuel usage
    },
    
    "cemai.plant.quality_deviation": {
        "type": "gauge",
        "description": "LSF deviation from target",
        "unit": "percent",
        "labels": ["plant_id", "product_grade"],
        "target": 2.0  # Within ±2%
    }
}

# System Performance Metrics
SYSTEM_METRICS = {
    "cemai.agent.availability": {
        "type": "gauge",
        "description": "Agent service availability",
        "unit": "percent",
        "labels": ["agent_id", "region"],
        "target": 99.95
    },
    
    "cemai.agent.response_time": {
        "type": "histogram",
        "description": "Agent response time for requests",
        "unit": "milliseconds",
        "labels": ["agent_id", "request_type"],
        "buckets": [10, 50, 100, 500, 1000, 5000],
        "target": 2000  # 2 second P99
    },
    
    "cemai.agent.error_rate": {
        "type": "gauge",
        "description": "Agent error rate",
        "unit": "percent",
        "labels": ["agent_id", "error_type"],
        "target": 0.1  # <0.1% error rate
    }
}
```

### Custom Metrics Implementation
```python
from google.cloud import monitoring_v3
from prometheus_client import Counter, Histogram, Gauge, start_http_server
import time
from typing import Dict, Any

class AgentMetrics:
    """Comprehensive metrics collection for CemAI agents"""
    
    def __init__(self, agent_id: str, project_id: str):
        self.agent_id = agent_id
        self.project_id = project_id
        
        # Initialize Google Cloud Monitoring client
        self.monitoring_client = monitoring_v3.MetricServiceClient()
        self.project_name = f"projects/{project_id}"
        
        # Initialize Prometheus metrics
        self._init_prometheus_metrics()
        
        # Start metrics server
        start_http_server(9090)
    
    def _init_prometheus_metrics(self):
        """Initialize Prometheus metrics"""
        
        # Decision metrics
        self.decision_latency = Histogram(
            'cemai_decision_latency_seconds',
            'Decision latency in seconds',
            ['agent_id', 'decision_type']
        )
        
        self.proposal_count = Counter(
            'cemai_proposals_total',
            'Total number of proposals generated',
            ['agent_id', 'proposal_type', 'status']
        )
        
        self.prediction_accuracy = Gauge(
            'cemai_prediction_accuracy',
            'Prediction accuracy percentage',
            ['agent_id', 'model_type']
        )
        
        # System metrics
        self.request_duration = Histogram(
            'cemai_request_duration_seconds',
            'Request processing duration',
            ['agent_id', 'endpoint', 'method'],
            buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 5.0, 10.0]
        )
        
        self.active_connections = Gauge(
            'cemai_active_connections',
            'Number of active connections',
            ['agent_id']
        )
    
    @contextmanager
    def time_operation(self, operation_type: str, **labels):
        """Context manager for timing operations"""
        start_time = time.time()
        try:
            yield
        finally:
            duration = time.time() - start_time
            self.decision_latency.labels(
                agent_id=self.agent_id,
                decision_type=operation_type,
                **labels
            ).observe(duration)
    
    def record_proposal(self, proposal_type: str, status: str):
        """Record proposal generation"""
        self.proposal_count.labels(
            agent_id=self.agent_id,
            proposal_type=proposal_type,
            status=status
        ).inc()
    
    def update_prediction_accuracy(self, model_type: str, accuracy: float):
        """Update prediction accuracy metrics"""
        self.prediction_accuracy.labels(
            agent_id=self.agent_id,
            model_type=model_type
        ).set(accuracy)
    
    def send_custom_metric(self, metric_name: str, value: float, labels: Dict[str, str]):
        """Send custom metric to Google Cloud Monitoring"""
        
        series = monitoring_v3.TimeSeries()
        series.metric.type = f"custom.googleapis.com/{metric_name}"
        series.resource.type = "gce_instance"
        
        # Add labels
        for key, val in labels.items():
            series.metric.labels[key] = val
        
        # Create data point
        point = series.points.add()
        point.value.double_value = value
        point.interval.end_time.seconds = int(time.time())
        
        # Send to Cloud Monitoring
        self.monitoring_client.create_time_series(
            name=self.project_name,
            time_series=[series]
        )
```

## Alerting Framework

### Alert Categories and Severity
```yaml
alert_categories:
  # Critical - Immediate response required
  critical:
    severity: "CRITICAL"
    response_time: "5 minutes"
    escalation: "immediate"
    notifications: ["pager", "sms", "email"]
    
  # High - Response required within 1 hour
  high:
    severity: "HIGH"
    response_time: "1 hour"
    escalation: "automated_then_human"
    notifications: ["email", "slack"]
    
  # Medium - Response required within 4 hours
  medium:
    severity: "MEDIUM"
    response_time: "4 hours"
    escalation: "business_hours"
    notifications: ["email"]
    
  # Low - Informational, no immediate action required
  low:
    severity: "LOW"
    response_time: "24 hours"
    escalation: "none"
    notifications: ["dashboard"]
```

### Alert Definitions
```yaml
critical_alerts:
  # System availability alerts
  - name: "Agent Service Down"
    condition: "cemai_agent_availability < 99"
    duration: "2 minutes"
    severity: "CRITICAL"
    description: "Critical agent service is unavailable"
    
  - name: "Decision Latency Exceeded"
    condition: "cemai_decision_latency_seconds > 120"
    duration: "1 minute"
    severity: "CRITICAL"
    description: "Decision latency exceeds 2 minutes"
    
  - name: "Quality Band Violation"
    condition: "cemai_plant_quality_deviation > 2.5"
    duration: "5 minutes"
    severity: "CRITICAL"
    description: "Product quality outside acceptable range"
    
  # Security alerts
  - name: "Authentication Failures"
    condition: "rate(cemai_auth_failures_total[5m]) > 10"
    duration: "1 minute"
    severity: "CRITICAL"
    description: "High rate of authentication failures detected"
    
  - name: "Unauthorized Access Attempt"
    condition: "cemai_unauthorized_access_total > 0"
    duration: "0 seconds"
    severity: "CRITICAL"
    description: "Unauthorized access attempt detected"

high_alerts:
  # Performance alerts
  - name: "High Error Rate"
    condition: "cemai_agent_error_rate > 1"
    duration: "5 minutes"
    severity: "HIGH"
    description: "Agent error rate exceeds 1%"
    
  - name: "Proposal Rejection Rate High"
    condition: "100 - cemai_proposal_acceptance_rate < 85"
    duration: "10 minutes"
    severity: "HIGH"
    description: "Proposal acceptance rate below 85%"
    
  - name: "Model Accuracy Degradation"
    condition: "cemai_prediction_accuracy < 90"
    duration: "15 minutes"
    severity: "HIGH"
    description: "Model prediction accuracy below 90%"
    
  # Business alerts
  - name: "Cost Optimization Target Missed"
    condition: "cemai_plant_power_consumption > baseline * 1.02"
    duration: "30 minutes"
    severity: "HIGH"
    description: "Power consumption 2% above baseline"

medium_alerts:
  # Resource alerts
  - name: "High Memory Usage"
    condition: "container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.8"
    duration: "10 minutes"
    severity: "MEDIUM"
    description: "Container memory usage above 80%"
    
  - name: "High CPU Usage"
    condition: "rate(container_cpu_usage_seconds_total[5m]) > 0.8"
    duration: "15 minutes"
    severity: "MEDIUM"
    description: "Container CPU usage above 80%"
```

### Automated Remediation
```yaml
remediation_actions:
  # Auto-scaling actions
  scale_up_agent:
    trigger: "High request volume or latency"
    action: "Increase Cloud Run instances"
    max_instances: 20
    cooldown: "5 minutes"
    
  restart_unhealthy_agent:
    trigger: "Health check failures"
    action: "Restart Cloud Run service"
    max_attempts: 3
    backoff: "exponential"
    
  # Security actions
  block_suspicious_ip:
    trigger: "High authentication failure rate"
    action: "Add IP to VPC firewall deny list"
    duration: "1 hour"
    review_required: true
    
  enable_emergency_mode:
    trigger: "Critical system failure"
    action: "Switch to human-only control"
    notification: "immediate"
    override_timeout: "24 hours"
```

## Dashboard and Visualization

### Executive Dashboard
High-level view for business stakeholders showing key performance indicators and ROI metrics.

```yaml
executive_dashboard:
  title: "CemAI Agent Swarm - Executive View"
  refresh_interval: "5 minutes"
  
  widgets:
    # Business impact metrics
    - title: "Cost Savings This Month"
      type: "single_stat"
      metric: "cemai_cost_savings_usd"
      timeframe: "30d"
      target: "$50,000"
      
    - title: "Energy Efficiency Improvement"
      type: "gauge"
      metric: "cemai_energy_efficiency_improvement_percent"
      timeframe: "7d"
      target: "5%"
      
    - title: "Alternative Fuel Usage"
      type: "line_chart"
      metric: "cemai_alternative_fuel_ratio"
      timeframe: "7d"
      target: "15%"
      
    - title: "Quality Compliance"
      type: "gauge"
      metric: "cemai_quality_compliance_percent"
      timeframe: "24h"
      target: "99.5%"
      
    # System reliability
    - title: "System Availability"
      type: "single_stat"
      metric: "cemai_system_availability"
      timeframe: "30d"
      target: "99.95%"
      
    - title: "Decision Accuracy"
      type: "gauge"
      metric: "cemai_decision_accuracy"
      timeframe: "7d"
      target: "95%"
```

### Operations Dashboard
Detailed technical view for operations teams monitoring system health and performance.

```yaml
operations_dashboard:
  title: "CemAI Agent Swarm - Operations View"
  refresh_interval: "30 seconds"
  
  sections:
    agent_health:
      title: "Agent Health Overview"
      widgets:
        - title: "Agent Status"
          type: "status_grid"
          agents: ["guardian", "optimizer", "master_control", "egress"]
          
        - title: "Request Latency (P99)"
          type: "multi_line_chart"
          metrics: 
            - "cemai_agent_response_time{percentile='99'}"
          groupby: "agent_id"
          
        - title: "Error Rates"
          type: "bar_chart"
          metric: "cemai_agent_error_rate"
          groupby: "agent_id"
    
    decision_workflow:
      title: "Decision Workflow"
      widgets:
        - title: "Decision Pipeline"
          type: "sankey_diagram"
          source: "trace_analysis"
          
        - title: "Conflict Resolution Rate"
          type: "line_chart"
          metric: "cemai_conflict_resolution_rate"
          
        - title: "Proposal Success Rate"
          type: "heatmap"
          metric: "cemai_proposal_acceptance_rate"
          groupby: ["agent_id", "proposal_type"]
    
    infrastructure:
      title: "Infrastructure Health"
      widgets:
        - title: "Cloud Run Instances"
          type: "multi_stat"
          metrics:
            - "cloud_run_instances_active"
            - "cloud_run_instances_total"
            
        - title: "Database Performance"
          type: "line_chart"
          metrics:
            - "alloydb_cpu_utilization"
            - "alloydb_memory_utilization"
            - "alloydb_connection_count"
```

### Security Dashboard
Dedicated view for security monitoring and compliance tracking.

```yaml
security_dashboard:
  title: "CemAI Agent Swarm - Security View"
  refresh_interval: "1 minute"
  
  sections:
    access_control:
      title: "Access Control & Authentication"
      widgets:
        - title: "Authentication Success Rate"
          type: "gauge"
          metric: "cemai_auth_success_rate"
          target: "99.9%"
          
        - title: "Failed Authentication Attempts"
          type: "time_series"
          metric: "cemai_auth_failures_total"
          alert_threshold: 10
          
        - title: "Active Sessions"
          type: "single_stat"
          metric: "cemai_active_sessions"
          
    network_security:
      title: "Network Security"
      widgets:
        - title: "VPC Traffic Flow"
          type: "network_topology"
          source: "vpc_flow_logs"
          
        - title: "Blocked Connections"
          type: "bar_chart"
          metric: "cemai_blocked_connections_total"
          groupby: "source_ip"
          
        - title: "Egress Violations"
          type: "list"
          metric: "cemai_egress_violations"
          
    audit_compliance:
      title: "Audit & Compliance"
      widgets:
        - title: "Audit Log Volume"
          type: "line_chart"
          metric: "cemai_audit_logs_total"
          
        - title: "Compliance Score"
          type: "gauge"
          metric: "cemai_compliance_score"
          target: "100%"
          
        - title: "Recent Security Events"
          type: "event_list"
          source: "security_events"
          limit: 20
```

This comprehensive observability specification ensures that the CemAI Agent Swarm operates with complete transparency, enabling operators to monitor, debug, and optimize the system while maintaining security and compliance requirements.
