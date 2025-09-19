# CemAI Agents - Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the CemAI Agent Swarm to Google Cloud Platform. The deployment process follows enterprise best practices with infrastructure as code, automated testing, and comprehensive monitoring.

## Prerequisites

### Required Tools
- **Google Cloud SDK**: `gcloud` CLI tool (version 400.0.0+)
- **Terraform**: Infrastructure as Code (version 1.5.0+)
- **Docker**: Container runtime (version 20.0.0+)
- **Python**: Development runtime (version 3.11+)
- **Git**: Version control (version 2.30.0+)

### Required Permissions
The deploying user must have the following IAM roles:
- `Project Editor` or `Owner`
- `Security Admin` (for VPC Service Controls)
- `Service Account Admin` (for creating service accounts)
- `Cloud KMS Admin` (for encryption key management)

### Google Cloud APIs
The following APIs must be enabled (automated in Terraform):
```bash
# Core compute and networking
compute.googleapis.com
run.googleapis.com
vpcaccess.googleapis.com
servicenetworking.googleapis.com

# AI/ML platform
aiplatform.googleapis.com

# Data and messaging
alloydb.googleapis.com
pubsub.googleapis.com
storage.googleapis.com

# Security and monitoring
iam.googleapis.com
secretmanager.googleapis.com
cloudkms.googleapis.com
cloudtrace.googleapis.com
logging.googleapis.com
monitoring.googleapis.com
```

## Step 1: Environment Setup

### 1.1 Clone Repository
```bash
git clone <repository-url>
cd cemai-agents
```

### 1.2 Set Environment Variables
Create a `.env` file with project-specific configuration:
```bash
# Project configuration
export PROJECT_ID="your-gcp-project-id"
export REGION="us-central1"
export ZONE="us-central1-a"
export ENVIRONMENT="prod"

# Database configuration
export ALLOYDB_PASSWORD="$(openssl rand -base64 32)"

# Plant integration (provided by plant IT team)
export OPCUA_SERVER_ENDPOINT="opc.tcp://plant-server:4840"
export OPCUA_USERNAME="cemai_service"
export OPCUA_PASSWORD="secure_plant_password"

# External APIs (optional)
export MARKET_DATA_API_KEY="your_market_api_key"
export WEATHER_API_KEY="your_weather_api_key"
```

### 1.3 Authenticate with Google Cloud
```bash
# Authenticate with your user account
gcloud auth login

# Set default project
gcloud config set project $PROJECT_ID

# Enable Application Default Credentials for Terraform
gcloud auth application-default login
```

## Step 2: Infrastructure Deployment

### 2.1 Initialize Terraform
```bash
cd infrastructure/terraform

# Initialize Terraform backend
terraform init

# Create workspace for environment isolation
terraform workspace new $ENVIRONMENT
terraform workspace select $ENVIRONMENT
```

### 2.2 Plan Infrastructure Deployment
```bash
# Review planned changes
terraform plan \
  -var="project_id=$PROJECT_ID" \
  -var="region=$REGION" \
  -var="environment=$ENVIRONMENT" \
  -var="alloydb_password=$ALLOYDB_PASSWORD" \
  -out=tfplan
```

### 2.3 Deploy Infrastructure
```bash
# Apply infrastructure changes
terraform apply tfplan

# Note the outputs for later steps
terraform output > ../terraform_outputs.txt
```

### 2.4 Verify Infrastructure
```bash
# Verify VPC creation
gcloud compute networks list --filter="name:cemai-agents-vpc"

# Verify AlloyDB cluster
gcloud alloydb clusters list --region=$REGION

# Verify service accounts
gcloud iam service-accounts list --filter="displayName:*Agent*"
```

## Step 3: Secrets and Configuration

### 3.1 Store Sensitive Configuration
```bash
# Store database password
echo -n "$ALLOYDB_PASSWORD" | gcloud secrets create alloydb-password --data-file=-

# Store plant system credentials
echo -n "$OPCUA_USERNAME:$OPCUA_PASSWORD" | gcloud secrets create opcua-credentials --data-file=-

# Store API keys
echo -n "$MARKET_DATA_API_KEY" | gcloud secrets create market-data-api-key --data-file=-
```

### 3.2 Grant Secret Access to Service Accounts
```bash
# Grant access to Guardian Agent
gcloud secrets add-iam-policy-binding alloydb-password \
  --member="serviceAccount:guardian-agent@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Grant access to Egress Agent
gcloud secrets add-iam-policy-binding opcua-credentials \
  --member="serviceAccount:egress-agent@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Grant access to Optimizer Agent
gcloud secrets add-iam-policy-binding market-data-api-key \
  --member="serviceAccount:optimizer-agent@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Step 4: Container Image Building

### 4.1 Configure Docker for Artifact Registry
```bash
# Configure Docker authentication
gcloud auth configure-docker $REGION-docker.pkg.dev
```

### 4.2 Build Agent Images
```bash
# Build Guardian Agent
cd agents/guardian
docker build -t $REGION-docker.pkg.dev/$PROJECT_ID/cemai-agents-images/guardian-agent:v1.0.0 .
docker push $REGION-docker.pkg.dev/$PROJECT_ID/cemai-agents-images/guardian-agent:v1.0.0

# Build Optimizer Agent
cd ../optimizer
docker build -t $REGION-docker.pkg.dev/$PROJECT_ID/cemai-agents-images/optimizer-agent:v1.0.0 .
docker push $REGION-docker.pkg.dev/$PROJECT_ID/cemai-agents-images/optimizer-agent:v1.0.0

# Build Master Control Agent
cd ../master_control
docker build -t $REGION-docker.pkg.dev/$PROJECT_ID/cemai-agents-images/master-control-agent:v1.0.0 .
docker push $REGION-docker.pkg.dev/$PROJECT_ID/cemai-agents-images/master-control-agent:v1.0.0

# Build Egress Agent
cd ../egress
docker build -t $REGION-docker.pkg.dev/$PROJECT_ID/cemai-agents-images/egress-agent:v1.0.0 .
docker push $REGION-docker.pkg.dev/$PROJECT_ID/cemai-agents-images/egress-agent:v1.0.0
```

## Step 5: Cloud Run Service Deployment

### 5.1 Deploy Guardian Agent
```bash
cd infrastructure/cloud_run

# Substitute environment variables in YAML
envsubst < guardian_agent.yaml > guardian_agent_deployed.yaml

# Deploy to Cloud Run
gcloud run services replace guardian_agent_deployed.yaml --region=$REGION
```

### 5.2 Deploy Remaining Agents
```bash
# Deploy each agent service
for agent in optimizer master_control egress; do
  envsubst < ${agent}_agent.yaml > ${agent}_agent_deployed.yaml
  gcloud run services replace ${agent}_agent_deployed.yaml --region=$REGION
done
```

### 5.3 Verify Service Deployment
```bash
# List deployed services
gcloud run services list --region=$REGION

# Check service health
for service in guardian-agent optimizer-agent master-control-agent egress-agent; do
  url=$(gcloud run services describe $service --region=$REGION --format="value(status.url)")
  curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" $url/health
done
```

## Step 6: Database Setup

### 6.1 Connect to AlloyDB
```bash
# Get AlloyDB connection details
ALLOYDB_IP=$(gcloud alloydb instances describe cemai-agents-primary \
  --cluster=cemai-agents-cluster \
  --region=$REGION \
  --format="value(ipAddress)")

# Connect using Cloud SQL Proxy (if needed)
cloud_sql_proxy -instances=$PROJECT_ID:$REGION:cemai-agents-cluster=tcp:5432 &
```

### 6.2 Initialize Database Schema
```bash
# Run database migration scripts
cd database/migrations
psql "host=$ALLOYDB_IP port=5432 dbname=cemai_agents user=cemai-admin" \
  -f 001_create_tables.sql \
  -f 002_create_indexes.sql \
  -f 003_seed_data.sql
```

## Step 7: Vertex AI Model Setup

### 7.1 Upload Training Data
```bash
# Upload historical plant data for model training
gsutil cp data/training/lsf_historical.csv gs://$PROJECT_ID-cemai-artifacts/training-data/
gsutil cp data/training/optimization_historical.csv gs://$PROJECT_ID-cemai-artifacts/training-data/
```

### 7.2 Create and Train Models
```bash
# Create forecasting model
gcloud ai custom-jobs create \
  --region=$REGION \
  --display-name="LSF-Forecasting-Training" \
  --config=vertex_ai/forecasting_job.yaml

# Create optimization model endpoint
gcloud ai endpoints create \
  --region=$REGION \
  --display-name="Fuel-Mix-Optimizer"
```

### 7.3 Deploy Models to Endpoints
```bash
# Deploy forecasting model
gcloud ai endpoints deploy-model $FORECASTING_ENDPOINT_ID \
  --region=$REGION \
  --model=$FORECASTING_MODEL_ID \
  --display-name="lsf-forecasting-v1"

# Deploy optimization model
gcloud ai endpoints deploy-model $OPTIMIZATION_ENDPOINT_ID \
  --region=$REGION \
  --model=$OPTIMIZATION_MODEL_ID \
  --display-name="fuel-mix-optimizer-v1"
```

## Step 8: Pub/Sub Topic and Subscription Setup

### 8.1 Create Subscriptions for Each Agent
```bash
# Guardian Agent subscriptions
gcloud pubsub subscriptions create guardian-plant-data \
  --topic=cemai-agents-plant-sensor-data \
  --ack-deadline=60

# Optimizer Agent subscriptions
gcloud pubsub subscriptions create optimizer-market-data \
  --topic=cemai-agents-market-data \
  --ack-deadline=60

# Master Control Agent subscriptions
gcloud pubsub subscriptions create master-control-communication \
  --topic=cemai-agents-agent-communication \
  --ack-deadline=60
```

### 8.2 Configure Dead Letter Queues
```bash
# Create dead letter topics
gcloud pubsub topics create cemai-agents-dead-letter

# Update subscriptions with dead letter policy
gcloud pubsub subscriptions update guardian-plant-data \
  --dead-letter-topic=cemai-agents-dead-letter \
  --max-delivery-attempts=5
```

## Step 9: Monitoring and Alerting Setup

### 9.1 Create Custom Dashboards
```bash
# Import dashboard configurations
gcloud monitoring dashboards create --config-from-file=monitoring/executive_dashboard.json
gcloud monitoring dashboards create --config-from-file=monitoring/operations_dashboard.json
gcloud monitoring dashboards create --config-from-file=monitoring/security_dashboard.json
```

### 9.2 Configure Alert Policies
```bash
# Create alert policies
gcloud alpha monitoring policies create --policy-from-file=monitoring/critical_alerts.yaml
gcloud alpha monitoring policies create --policy-from-file=monitoring/performance_alerts.yaml
gcloud alpha monitoring policies create --policy-from-file=monitoring/security_alerts.yaml
```

### 9.3 Set Up Notification Channels
```bash
# Create email notification channel
gcloud alpha monitoring channels create \
  --display-name="Security Team Email" \
  --type=email \
  --channel-labels=email_address=security-team@company.com
```

## Step 10: Security Configuration

### 10.1 Enable VPC Service Controls
```bash
# Create access policy
gcloud access-context-manager policies create \
  --title="CemAI Agents Policy" \
  --organization=$ORG_ID

# Create service perimeter
gcloud access-context-manager perimeters create cemai-agents-perimeter \
  --policy=$POLICY_ID \
  --title="CemAI Agents Perimeter" \
  --resources=projects/$PROJECT_ID \
  --restricted-services=run.googleapis.com,aiplatform.googleapis.com
```

### 10.2 Configure Audit Logging
```bash
# Enable audit logs for all services
gcloud logging sinks create cemai-audit-sink \
  bigquery.googleapis.com/projects/$PROJECT_ID/datasets/cemai_audit_logs \
  --log-filter='protoPayload.serviceName:("run.googleapis.com" OR "aiplatform.googleapis.com")'
```

## Step 11: Plant Integration Setup

### 11.1 Configure Private Service Connect
```bash
# Create Private Service Connect endpoint (to be done by plant IT team)
gcloud compute addresses create plant-opcua-psc \
  --subnet=cemai-agents-plant-subnet \
  --region=$REGION

# Create forwarding rule for OPC-UA connection
gcloud compute forwarding-rules create plant-opcua-forwarding-rule \
  --region=$REGION \
  --network=cemai-agents-vpc \
  --address=plant-opcua-psc \
  --target-service-attachment=$PLANT_SERVICE_ATTACHMENT
```

### 11.2 Test Plant Connectivity
```bash
# Test OPC-UA connection from Egress Agent
gcloud run jobs create test-plant-connection \
  --image=$REGION-docker.pkg.dev/$PROJECT_ID/cemai-agents-images/egress-agent:v1.0.0 \
  --service-account=egress-agent@$PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars="TEST_MODE=true,OPCUA_ENDPOINT=$OPCUA_SERVER_ENDPOINT" \
  --region=$REGION

gcloud run jobs execute test-plant-connection --region=$REGION
```

## Step 12: End-to-End Testing

### 12.1 System Integration Tests
```bash
cd tests/integration

# Run integration test suite
python -m pytest test_agent_communication.py -v
python -m pytest test_decision_workflow.py -v
python -m pytest test_plant_integration.py -v
```

### 12.2 Load Testing
```bash
# Install load testing tools
pip install locust

# Run load tests
locust -f tests/load/agent_load_test.py \
  --host=https://master-control-agent-$REGION-$PROJECT_ID.a.run.app \
  --users=50 \
  --spawn-rate=5 \
  --run-time=5m
```

### 12.3 Security Testing
```bash
# Run security tests
python -m pytest tests/security/test_authentication.py -v
python -m pytest tests/security/test_authorization.py -v
python -m pytest tests/security/test_input_validation.py -v
```

## Step 13: Production Readiness Checklist

### 13.1 Performance Validation
- [ ] All services respond to health checks within 5 seconds
- [ ] Decision latency is under 60 seconds for standard scenarios
- [ ] System handles 100 concurrent requests without degradation
- [ ] Memory usage is under 80% during normal operation

### 13.2 Security Validation
- [ ] All agents authenticate using IAM service accounts
- [ ] VPC Service Controls are active and blocking unauthorized access
- [ ] All secrets are stored in Secret Manager with proper access controls
- [ ] Audit logging is enabled and functioning

### 13.3 Monitoring Validation
- [ ] All dashboards are displaying metrics correctly
- [ ] Alert policies trigger within expected timeframes
- [ ] Notification channels are receiving test alerts
- [ ] Distributed tracing is capturing end-to-end workflows

### 13.4 Business Validation
- [ ] Plant integration is established and commands are being executed
- [ ] Quality predictions are accurate within ±2% tolerance
- [ ] Cost optimization recommendations are being generated
- [ ] Alternative fuel utilization targets are being met

## Step 14: Go-Live Procedures

### 14.1 Gradual Rollout
1. **Phase 1: Monitoring Only** (Week 1)
   - Enable all agents in monitoring mode
   - No commands sent to plant systems
   - Validate predictions and recommendations

2. **Phase 2: Limited Control** (Week 2-3)
   - Enable minor setpoint adjustments only
   - Human approval required for all changes
   - Monitor system performance and accuracy

3. **Phase 3: Autonomous Operation** (Week 4+)
   - Enable full autonomous operation
   - Remove human approval gates for standard operations
   - Maintain emergency stop capabilities

### 14.2 Rollback Procedures
```bash
# Emergency rollback script
#!/bin/bash
# Stop all agent services
gcloud run services update-traffic guardian-agent --to-revisions=LATEST=0 --region=$REGION
gcloud run services update-traffic optimizer-agent --to-revisions=LATEST=0 --region=$REGION
gcloud run services update-traffic master-control-agent --to-revisions=LATEST=0 --region=$REGION

# Enable manual plant control
# (Plant-specific procedures)
```

## Step 15: Ongoing Operations

### 15.1 Regular Maintenance
- **Daily**: Review dashboards and alert status
- **Weekly**: Analyze performance trends and optimization opportunities
- **Monthly**: Update models with new training data
- **Quarterly**: Review security policies and access controls

### 15.2 Model Updates
```bash
# Deploy new model version
gcloud ai endpoints deploy-model $ENDPOINT_ID \
  --region=$REGION \
  --model=$NEW_MODEL_ID \
  --traffic-split="0:100" \  # Canary deployment
  --display-name="model-v2"

# Gradually shift traffic to new model
gcloud ai endpoints update-traffic $ENDPOINT_ID \
  --region=$REGION \
  --traffic-split="0:50,1:50"  # 50/50 split for A/B testing
```

### 15.3 Disaster Recovery
- **RTO (Recovery Time Objective)**: 1 hour
- **RPO (Recovery Point Objective)**: 15 minutes
- **Backup Strategy**: Cross-region database replication
- **Failover Process**: Automated failover to secondary region

## Troubleshooting

### Common Issues

#### Agent Service Fails to Start
```bash
# Check service logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=guardian-agent" \
  --limit=50 \
  --format="table(timestamp,severity,textPayload)"

# Check service account permissions
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --format="table(bindings.role)" \
  --filter="bindings.members:guardian-agent@$PROJECT_ID.iam.gserviceaccount.com"
```

#### Database Connection Issues
```bash
# Test database connectivity
gcloud sql connect cemai-agents-cluster --user=cemai-admin --database=cemai_agents

# Check VPC connectivity
gcloud compute instances create test-vm \
  --subnet=cemai-agents-data-subnet \
  --no-address \
  --image-family=debian-11 \
  --image-project=debian-cloud

gcloud compute ssh test-vm --command="ping $ALLOYDB_IP"
```

#### Model Endpoint Issues
```bash
# Check endpoint status
gcloud ai endpoints describe $ENDPOINT_ID --region=$REGION

# Test prediction endpoint
curl -X POST \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{"instances": [{"feature1": 1.0, "feature2": 2.0}]}' \
  "https://$REGION-aiplatform.googleapis.com/v1/projects/$PROJECT_ID/locations/$REGION/endpoints/$ENDPOINT_ID:predict"
```

## Support and Documentation

### Support Contacts
- **Technical Issues**: tech-support@company.com
- **Security Issues**: security-team@company.com
- **Business Questions**: operations-team@company.com

### Additional Documentation
- [System Architecture](../architecture/system_architecture.md)
- [Security Framework](../../shared/security/security_framework.md)
- [API Documentation](../api/a2a_protocol.md)
- [Monitoring Guide](../../shared/monitoring/observability_specification.md)

This comprehensive deployment guide ensures a smooth, secure, and reliable deployment of the CemAI Agent Swarm system.
