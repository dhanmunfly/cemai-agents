# Optimizer Agent Specification - "The Economist"

## Overview

The Optimizer Agent serves as the plant's profit and sustainability engine, constantly seeking opportunities to reduce operational costs and maximize alternative fuel use without prompting. It operates as the economic optimization specialist within the CemAI agent swarm.

## Core Responsibilities

### Primary Mission
- Optimize fuel mix for maximum cost efficiency
- Maximize alternative fuel utilization (biomass, waste fuels)
- Respond dynamically to market price changes
- Maintain quality constraints while minimizing costs
- Achieve target KPIs: 5-8% power reduction, 3-4% heat rate improvement, 10-15% alternative fuel increase

### Key Performance Indicators
- **Cost Savings**: Achieve 5-8% reduction in specific power consumption
- **Heat Rate Improvement**: Improve heat rate by 3-4%
- **Alternative Fuel Utilization**: Increase alternative fuel usage by 10-15%
- **Response Time**: Re-optimize within 30 seconds of significant market changes
- **Constraint Satisfaction**: Maintain 100% compliance with quality constraints

## Technical Specifications

### Core Feature 1: Constraint-Based Optimization

#### Vertex AI Optimization Integration
```typescript
// Vertex AI Optimization Model Configuration
const OPTIMIZATION_MODEL = "projects/{PROJECT}/locations/{REGION}/endpoints/{ENDPOINT_ID}";
const optimizationProblem = {
  objective: {
    type: 'minimize_cost',
    variables: [
      { name: 'coal_amount', coefficient: marketData.coalPrice },
      { name: 'biomass_amount', coefficient: marketData.biomassPrice },
      { name: 'waste_amount', coefficient: marketData.wastePrice },
      { name: 'mill_power', coefficient: marketData.electricityPrice }
    ]
  },
  constraints: [
    {
      name: 'quality_constraint',
      type: 'inequality',
      variables: ['coal_amount', 'biomass_amount', 'waste_amount'],
      bounds: [0, 100]
    },
    {
      name: 'power_constraint',
      type: 'equality',
      variables: ['mill_power'],
      bounds: [1000, 5000]
    }
  ]
};
```

#### Input Data Sources
- **Market Data**: Real-time fuel prices, electricity spot prices
- **Plant State**: Current fuel mix, power consumption, quality parameters
- **Quality Constraints**: LSF limits from Guardian Agent
- **Equipment Limits**: Mill capacity, fuel storage availability
- **Environmental Data**: Alternative fuel availability, weather conditions

#### Optimization Algorithm
```typescript
class FuelMixOptimizer {
  async optimizeFuelMix(constraints: Constraint[], marketData: MarketData, currentState: PlantState): Promise<OptimizationResult> {
    // 1. Prepare optimization problem
    const problem = this.buildOptimizationProblem(constraints, marketData);
    
    // 2. Call Vertex AI Optimization
    const result = await this.vertexAI.optimize(problem);
    
    // 3. Validate solution against constraints
    const validatedResult = await this.validateSolution(result, constraints);
    
    // 4. Calculate economic impact
    const impact = this.calculateEconomicImpact(validatedResult, currentState, marketData);
    
    return {
      fuelMix: validatedResult.variables,
      costSavingsPercent: impact.costSavingsPercent,
      alternativeFuelRatio: impact.alternativeFuelRatio,
      confidence: result.confidence,
      constraintsSatisfied: validatedResult.constraintsSatisfied
    };
  }
}
```

### Core Feature 2: Market-Aware Re-evaluation

#### Event-Driven Optimization Triggers
The Optimizer Agent subscribes to real-time market data streams and triggers immediate re-optimization when significant price changes occur.

```typescript
// Market Data Subscription
const marketDataSubscription = pubsub.subscription('market-data-updates');

marketDataSubscription.on('message', async (message) => {
  const data = JSON.parse(message.data.toString());
  
  if (data.type === 'market_update') {
    const priceChangeThreshold = 0.05; // 5% change
    const significantChange = Object.values(data.priceChanges).some(
      (change: number) => Math.abs(change) > priceChangeThreshold
    );
    
    if (significantChange) {
      await triggerReoptimization(data);
    }
  }
});
```

#### Market Sensitivity Analysis
- **Coal Price Changes**: Immediate impact on fuel mix optimization
- **Electricity Spot Prices**: Affects mill power optimization
- **Alternative Fuel Availability**: Dynamic constraint adjustment
- **Carbon Credit Prices**: Influences sustainability optimization

### Core Feature 3: Alternative Fuel Maximization

#### Sustainability Optimization
```typescript
class AlternativeFuelOptimizer {
  async maximizeAlternativeFuel(currentMix: FuelMix, constraints: Constraint[]): Promise<FuelMix> {
    // 1. Identify alternative fuel opportunities
    const opportunities = await this.identifyAlternativeFuelOpportunities();
    
    // 2. Calculate maximum sustainable alternative fuel ratio
    const maxRatio = this.calculateMaxAlternativeFuelRatio(constraints);
    
    // 3. Optimize mix within sustainability constraints
    const optimizedMix = await this.optimizeForSustainability(maxRatio, opportunities);
    
    return optimizedMix;
  }
  
  private calculateMaxAlternativeFuelRatio(constraints: Constraint[]): number {
    // Consider quality constraints, equipment limits, and availability
    const qualityLimit = this.getQualityConstraintLimit(constraints);
    const equipmentLimit = this.getEquipmentCapacityLimit();
    const availabilityLimit = this.getAlternativeFuelAvailability();
    
    return Math.min(qualityLimit, equipmentLimit, availabilityLimit);
  }
}
```

## Implementation Architecture

### Service Structure
```
optimizer/
├── src/
│   ├── main.ts                 # FastAPI service entry point
│   ├── optimizer.ts            # Core optimization engine
│   ├── market-monitor.ts       # Market data monitoring
│   ├── constraint-manager.ts   # Constraint handling
│   └── proposal-generator.ts   # A2A proposal formulation
├── config/
│   ├── optimization-config.yaml    # Vertex AI model configuration
│   ├── market-thresholds.yaml      # Market sensitivity thresholds
│   └── fuel-limits.yaml            # Fuel mix operational limits
├── Dockerfile                   # Container configuration
├── package.json                 # Node.js dependencies
└── cloudbuild.yaml             # Cloud Build configuration
```

### API Endpoints

#### Optimization & Analysis
```typescript
@app.post('/v1/optimize')
async def optimizeFuelMix(request: OptimizationRequest): Promise<OptimizationResponse>

@app.get('/v1/current-optimization')
async def getCurrentOptimization(): Promise<OptimizationStatus>

@app.post('/v1/validate-constraints')
async def validateConstraints(constraints: Constraint[]): Promise<ValidationResult>
```

#### Market Data Integration
```typescript
@app.post('/v1/market-update')
async def processMarketUpdate(update: MarketDataUpdate): Promise<void>

@app.get('/v1/market-sensitivity')
async def getMarketSensitivity(): Promise<SensitivityAnalysis>
```

#### A2A Communication
```typescript
@app.post('/a2a/receive')
async def receiveA2AMessage(message: A2AMessage): Promise<A2AResponse>

@app.post('/v1/emergency-stop')
async def emergencyStop(): Promise<StopConfirmation>
```

### Data Integration

#### Pub/Sub Subscriptions
```yaml
subscriptions:
  - topic: "market-data-updates"
    filter: "attributes.type='fuel_prices' OR attributes.type='electricity_prices'"
  - topic: "alternative-fuel-availability"
    filter: "attributes.fuel_type IN ('biomass', 'waste', 'rdf')"
  - topic: "quality-constraints"
    filter: "attributes.source='guardian_agent'"
```

#### Vertex AI Model Configuration
```yaml
vertex_ai:
  optimization_model:
    endpoint_id: "${OPTIMIZATION_ENDPOINT_ID}"
    region: "${GCP_REGION}"
    model_type: "linear_programming"
    input_features:
      - "coal_price"
      - "biomass_price"
      - "waste_price"
      - "electricity_price"
      - "quality_constraints"
      - "equipment_limits"
    optimization_objectives:
      - "minimize_cost"
      - "maximize_alternative_fuel"
      - "minimize_emissions"
```

## Monitoring & Observability

### Key Metrics
```typescript
const metrics = {
  optimizationLatency: "Time to complete optimization in seconds",
  costSavingsPercent: "Percentage cost reduction achieved",
  alternativeFuelRatio: "Percentage of alternative fuel in mix",
  marketResponseTime: "Time to respond to market changes",
  constraintViolations: "Number of constraint violations",
  optimizationSuccessRate: "Percentage of successful optimizations"
};
```

### Alerting Rules
```yaml
alerts:
  - name: "optimization_failure"
    condition: "optimization_success_rate < 95%"
    severity: "warning"
    
  - name: "market_response_slow"
    condition: "market_response_time > 30s"
    severity: "critical"
    
  - name: "cost_savings_below_target"
    condition: "cost_savings_percent < 3%"
    severity: "warning"
    
  - name: "alternative_fuel_ratio_low"
    condition: "alternative_fuel_ratio < 10%"
    severity: "warning"
```

### Trace Instrumentation
- All optimization requests traced end-to-end
- Market data processing workflow tracing
- Constraint validation span tracking
- A2A communication span tracking

## Security Configuration

### IAM Service Account
```yaml
optimizer_agent_sa:
  email: "optimizer-agent@${PROJECT_ID}.iam.gserviceaccount.com"
  roles:
    - "roles/aiplatform.user"          # Vertex AI access
    - "roles/pubsub.subscriber"        # Market data ingestion
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
PUBSUB_SUBSCRIPTION=projects/${PROJECT}/subscriptions/optimizer-market-data
MASTER_CONTROL_ENDPOINT=https://master-control-${REGION}-${PROJECT}.a.run.app

# Optional
LOG_LEVEL=INFO
OPTIMIZATION_INTERVAL=300  # seconds
MARKET_SENSITIVITY_THRESHOLD=0.05  # 5% change threshold
```

## Testing Strategy

### Unit Tests
- Optimization algorithm validation
- Constraint handling logic
- Market data processing
- Cost calculation accuracy

### Integration Tests
- Vertex AI model integration
- Pub/Sub market data processing
- A2A protocol communication
- Database state persistence

### Performance Tests
- Optimization latency under load
- Concurrent market data processing
- Memory usage optimization
- Cold start performance

### Quality Assurance
- Optimization result validation
- Constraint satisfaction testing
- Economic impact verification
- Regression testing for model updates

## Deployment Configuration

### Cloud Run Service
```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: optimizer-agent
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
      serviceAccountName: optimizer-agent@${PROJECT_ID}.iam.gserviceaccount.com
      containers:
      - image: gcr.io/${PROJECT_ID}/optimizer-agent:${VERSION}
        env:
        - name: VERTEX_AI_ENDPOINT_ID
          valueFrom:
            secretKeyRef:
              name: vertex-endpoints
              key: optimization-endpoint
```

### Resource Requirements
- **Memory**: 2GB (for optimization calculations and market data processing)
- **CPU**: 2 vCPUs (for real-time optimization)
- **Storage**: 1GB (for temporary model artifacts)
- **Network**: VPC connector for secure plant communication

## Operational Procedures

### Startup Sequence
1. Initialize Vertex AI client connections
2. Subscribe to market data streams
3. Load optimization model and constraints
4. Validate model endpoint accessibility
5. Begin real-time optimization loop

### Shutdown Procedure
1. Complete in-flight optimizations
2. Send final proposals to Master Control
3. Gracefully unsubscribe from Pub/Sub
4. Close Vertex AI connections
5. Save final state to AlloyDB

### Error Recovery
- Automatic retry for transient optimization failures
- Fallback to rule-based optimization if Vertex AI unavailable
- Circuit breaker pattern for external service calls
- Graceful degradation with reduced optimization accuracy

### Maintenance Procedures
- Rolling model updates with A/B testing
- Market sensitivity threshold adjustments
- Constraint limit recalibration
- Performance tuning and optimization

