# Guardian Agent Specification - "The Stabilizer"

## Overview

The Guardian Agent serves as the plant's defensive line, singularly focused on maintaining process stability and ensuring final product quality meets specifications. It operates as the quality assurance specialist within the CemAI agent swarm.

## Core Responsibilities

### Primary Mission
- Monitor process stability in real-time
- Predict quality deviations before they occur
- Propose minimal corrective actions to maintain quality bands
- Ensure product specifications are never compromised

### Key Performance Indicators
- **Prediction Accuracy**: >95% accuracy for LSF predictions within 60-minute horizon
- **Quality Band Maintenance**: Keep LSF within ±2% of target 99.5% of the time
- **Response Time**: Issue stability proposals within 30 seconds of deviation detection
- **Over-correction Prevention**: Minimize control action magnitude by 40% vs traditional PID

## Technical Specifications

### Core Feature 1: Predictive Stability Monitoring

#### ML Model Integration
```python
# Vertex AI Forecasting Model Integration
model_endpoint = "projects/{PROJECT}/locations/{REGION}/endpoints/{ENDPOINT_ID}"
prediction_horizon = 60  # minutes
confidence_threshold = 0.85
quality_band = {"LSF": {"min": 98.0, "max": 102.0}}  # ±2% of target 100
```

#### Input Data Sources
- **Real-time Process Data**: Kiln temperature, feed rate, fuel flow
- **Chemical Analysis**: Raw meal chemistry, clinker composition
- **Environmental Data**: Ambient temperature, humidity
- **Equipment Status**: Motor speeds, pressure readings, flow rates

#### Prediction Logic
```python
class StabilityPredictor:
    def predict_lsf_deviation(self, current_data: ProcessData) -> Prediction:
        """
        Predict LSF deviation using Vertex AI Forecasting model
        
        Returns:
            Prediction object with:
            - predicted_lsf: float (60-minute ahead prediction)
            - confidence: float (model confidence 0-1)
            - deviation_magnitude: float (how far outside quality band)
            - time_to_deviation: int (minutes until deviation occurs)
        """
```

#### Quality Band Monitoring
- **Target LSF**: 100.0 (configurable per plant)
- **Acceptable Range**: 98.0 - 102.0 (±2%)
- **Warning Threshold**: 98.5 - 101.5 (±1.5%)
- **Critical Threshold**: 97.5 - 102.5 (±2.5%)

### Core Feature 2: Minimal Effective Action Calculation

#### Action Philosophy
The Guardian Agent is engineered to propose the **Minimal Effective Action** - the smallest possible setpoint adjustment required to bring predicted LSF back within quality bands.

#### Control Variables
```python
control_variables = {
    "kiln_speed": {"min": 2.8, "max": 4.2, "step": 0.1},  # RPM
    "fuel_flow": {"min": 4.5, "max": 6.8, "step": 0.05},  # t/h
    "feed_rate": {"min": 180, "max": 220, "step": 1.0},   # t/h
    "preheater_temp": {"min": 850, "max": 950, "step": 5}, # °C
}
```

#### Action Calculation Algorithm
```python
def calculate_minimal_action(self, prediction: Prediction) -> ControlAction:
    """
    Calculate the minimal control action to correct predicted deviation
    
    Algorithm:
    1. Determine deviation severity (how far outside quality band)
    2. Calculate required correction magnitude 
    3. Identify most effective control variable (highest sensitivity)
    4. Calculate minimal adjustment step
    5. Validate action doesn't create secondary instabilities
    """
    
    if prediction.deviation_magnitude < 0.5:
        return self._micro_adjustment(prediction)
    elif prediction.deviation_magnitude < 1.0:
        return self._minor_adjustment(prediction)
    else:
        return self._major_adjustment(prediction)
```

### Core Feature 3: Proposal Formulation

#### A2A Protocol Integration
When a deviation is predicted, the Guardian formulates a structured "Stability Proposal" using the standardized A2A protocol.

#### Proposal Structure
```python
@dataclass
class StabilityProposal:
    agent_id: str = "guardian_agent"
    proposal_type: str = "stability_correction"
    urgency: str  # "low", "medium", "high", "critical"
    
    # Prediction details
    predicted_deviation: float
    confidence: float
    time_horizon: int  # minutes
    
    # Proposed action
    control_variable: str
    current_value: float
    proposed_value: float
    adjustment_magnitude: float
    
    # Expected outcome
    expected_lsf: float
    risk_assessment: str
    secondary_effects: List[str]
    
    # Metadata
    timestamp: datetime
    data_sources: List[str]
    model_version: str
```

#### Proposal Validation
Before sending proposals to Master Control, the Guardian validates:
1. **Safety Constraints**: No proposed action violates equipment limits
2. **Process Constraints**: Action respects operational boundaries  
3. **Quality Impact**: Correction will achieve target LSF range
4. **Side Effects**: No unintended consequences on other parameters

## Implementation Architecture

### Service Structure
```
guardian/
├── src/
│   ├── main.py              # FastAPI service entry point
│   ├── predictor.py         # ML model integration
│   ├── controller.py        # Control action calculation
│   ├── monitor.py           # Real-time monitoring
│   └── proposer.py          # A2A proposal formulation
├── config/
│   ├── model_config.yaml    # Vertex AI model configuration
│   ├── quality_bands.yaml   # Plant-specific quality parameters
│   └── control_limits.yaml  # Equipment operational limits
├── Dockerfile               # Container configuration
├── requirements.txt         # Python dependencies
└── cloudbuild.yaml         # Cloud Build configuration
```

### API Endpoints

#### Health & Status
```python
@app.get("/health")
async def health_check() -> HealthStatus

@app.get("/status")
async def agent_status() -> AgentStatus
```

#### Monitoring & Prediction
```python
@app.post("/predict")
async def predict_stability(data: ProcessData) -> Prediction

@app.get("/current-quality")
async def get_current_quality() -> QualityMetrics

@app.post("/validate-action")
async def validate_control_action(action: ControlAction) -> ValidationResult
```

#### A2A Communication
```python
@app.post("/receive-data")
async def receive_process_data(data: ProcessDataStream) -> Acknowledgment

@app.post("/emergency-stop")
async def emergency_stop() -> StopConfirmation
```

### Data Integration

#### Pub/Sub Subscriptions
```yaml
subscriptions:
  - topic: "plant-sensor-data"
    filter: "attributes.type='process' OR attributes.type='quality'"
  - topic: "lab-analysis-results"
    filter: "attributes.analysis_type='chemistry'"
  - topic: "equipment-status"
    filter: "attributes.equipment IN ('kiln', 'preheater', 'mill')"
```

#### Vertex AI Model Configuration
```yaml
vertex_ai:
  forecasting_model:
    endpoint_id: "${FORECASTING_ENDPOINT_ID}"
    region: "${GCP_REGION}"
    prediction_horizon: 60  # minutes
    input_features:
      - "kiln_temperature"
      - "feed_rate"
      - "fuel_flow"
      - "preheater_temperature"
      - "mill_speed"
    target_variable: "lime_saturation_factor"
```

## Monitoring & Observability

### Key Metrics
```python
metrics = {
    "prediction_accuracy": "Percentage of predictions within tolerance",
    "proposal_frequency": "Number of proposals per hour", 
    "action_effectiveness": "Success rate of proposed actions",
    "response_time": "Time from deviation detection to proposal",
    "model_drift": "Prediction accuracy degradation over time"
}
```

### Alerting Rules
```yaml
alerts:
  - name: "high_prediction_error"
    condition: "prediction_accuracy < 90%"
    severity: "warning"
    
  - name: "guardian_unresponsive"
    condition: "response_time > 60s"
    severity: "critical"
    
  - name: "quality_band_violation"
    condition: "lsf_deviation > 2.5%"
    severity: "critical"
```

### Trace Instrumentation
- All prediction requests traced end-to-end
- Model inference latency monitoring
- Proposal generation workflow tracing
- A2A communication span tracking

## Security Configuration

### IAM Service Account
```yaml
guardian_agent_sa:
  email: "guardian-agent@${PROJECT_ID}.iam.gserviceaccount.com"
  roles:
    - "roles/aiplatform.user"          # Vertex AI access
    - "roles/pubsub.subscriber"        # Pub/Sub data ingestion
    - "roles/storage.objectViewer"     # Model artifact access
    - "roles/trace.agent"              # Cloud Trace instrumentation
  restrictions:
    - no_internet_egress: true
    - vpc_only: true
```

### Environment Variables
```bash
# Required
VERTEX_AI_ENDPOINT_ID=projects/${PROJECT}/locations/${REGION}/endpoints/${ENDPOINT}
PUBSUB_SUBSCRIPTION=projects/${PROJECT}/subscriptions/guardian-data
MASTER_CONTROL_ENDPOINT=https://master-control-${REGION}-${PROJECT}.a.run.app

# Optional
LOG_LEVEL=INFO
PREDICTION_INTERVAL=30  # seconds
QUALITY_BAND_BUFFER=0.1  # additional margin
```

## Testing Strategy

### Unit Tests
- Prediction logic validation
- Control action calculations
- Proposal formatting
- Error handling scenarios

### Integration Tests  
- Vertex AI model integration
- Pub/Sub message processing
- A2A protocol communication
- Database state persistence

### Performance Tests
- Prediction latency under load
- Concurrent request handling
- Memory usage optimization
- Cold start performance

### Quality Assurance
- Model prediction accuracy testing
- Control action safety validation
- End-to-end quality band maintenance
- Regression testing for model updates

## Deployment Configuration

### Cloud Run Service
```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: guardian-agent
  annotations:
    run.googleapis.com/vpc-access-connector: "plant-connector"
    run.googleapis.com/vpc-access-egress: "private-ranges-only"
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "1"
        autoscaling.knative.dev/maxScale: "10"
        run.googleapis.com/memory: "2Gi"
        run.googleapis.com/cpu: "2"
    spec:
      serviceAccountName: guardian-agent@${PROJECT_ID}.iam.gserviceaccount.com
      containers:
      - image: gcr.io/${PROJECT_ID}/guardian-agent:${VERSION}
        env:
        - name: VERTEX_AI_ENDPOINT_ID
          valueFrom:
            secretKeyRef:
              name: vertex-endpoints
              key: forecasting-endpoint
```

### Resource Requirements
- **Memory**: 2GB (for model inference and data processing)
- **CPU**: 2 vCPUs (for real-time calculations)
- **Storage**: 1GB (for temporary model artifacts)
- **Network**: VPC connector for secure plant communication

## Operational Procedures

### Startup Sequence
1. Initialize Vertex AI client connections
2. Subscribe to Pub/Sub data streams
3. Load plant-specific quality parameters
4. Validate model endpoint accessibility
5. Begin real-time monitoring loop

### Shutdown Procedure
1. Complete in-flight predictions
2. Send final proposals to Master Control
3. Gracefully unsubscribe from Pub/Sub
4. Close Vertex AI connections
5. Save final state to AlloyDB

### Error Recovery
- Automatic retry for transient ML model failures
- Fallback to statistical models if Vertex AI unavailable
- Circuit breaker pattern for external service calls
- Graceful degradation with reduced prediction accuracy

### Maintenance Procedures
- Rolling model updates with A/B testing
- Quality band parameter adjustments
- Control limit recalibration
- Performance tuning and optimization
