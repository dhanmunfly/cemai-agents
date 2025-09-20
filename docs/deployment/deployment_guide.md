# CemAI Agents - Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the CemAI Agent Swarm to Google Cloud Platform. The deployment includes all four agents (Guardian, Optimizer, Master Control, and Egress) with enterprise-grade security, monitoring, and scalability.

## Prerequisites

### Required Tools
- **Google Cloud CLI** (gcloud) - Latest version
- **Terraform** - Version 1.5.0 or later
- **Docker** - For container image building
- **Node.js** - Version 18 or later
- **npm** - For dependency management

### Required Access
- **Google Cloud Project** with billing enabled
- **Organization Admin** access (for VPC Service Controls)
- **Service Account** with required permissions
- **Domain Admin** access (for DNS configuration)

### Required APIs
The following Google Cloud APIs must be enabled:
```bash
gcloud services enable \
  run.googleapis.com \
  aiplatform.googleapis.com \
  alloydb.googleapis.com \
  pubsub.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  cloudkms.googleapis.com \
  cloudtrace.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  compute.googleapis.com \
  servicenetworking.googleapis.com \
  vpcaccess.googleapis.com \
  accesscontextmanager.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  artifactregistry.googleapis.com
```

## Environment Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd cemai-agents
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Google Cloud
```bash
# Authenticate with Google Cloud
gcloud auth login
gcloud auth application-default login

# Set project
export PROJECT_ID="your-cemai-project"
gcloud config set project $PROJECT_ID
gcloud config set compute/region us-central1
```

### 4. Create Terraform Variables File
Create `infrastructure/terraform/terraform.tfvars`:
```hcl
project_id = "your-cemai-project"
region = "us-central1"
zone = "us-central1-a"
environment = "production"
organization_id = "your-org-id"
alloydb_password = "your-secure-password-here"

# Vertex AI Configuration
vertex_ai_endpoints = {
  forecasting_endpoint = "projects/your-project/locations/us-central1/endpoints/your-endpoint-id"
  optimization_endpoint = "projects/your-project/locations/us-central1/endpoints/your-endpoint-id"
  gemini_endpoint = "projects/your-project/locations/us-central1/endpoints/your-endpoint-id"
}

# Plant Configuration
plant_config = {
  opcua_server_endpoint = "opc.tcp://your-plant-server:4840"
  connection_timeout = 30
  max_concurrent_commands = 5
  command_rate_limit = 10
}
```

## Infrastructure Deployment

### 1. Initialize Terraform
```bash
cd infrastructure/terraform
terraform init
```

### 2. Plan Infrastructure
```bash
terraform plan -var-file="terraform.tfvars"
```

### 3. Deploy Infrastructure
```bash
terraform apply -var-file="terraform.tfvars"
```

This will create:
- VPC network with subnets
- AlloyDB cluster for state persistence
- Cloud KMS keys for encryption
- Pub/Sub topics for communication
- Service accounts with IAM roles
- VPC Service Controls perimeter
- Artifact Registry for container images

### 4. Verify Infrastructure
```bash
# Check AlloyDB cluster
gcloud alloydb clusters list

# Check VPC network
gcloud compute networks list

# Check service accounts
gcloud iam service-accounts list
```

## Agent Deployment

### 1. Build Container Images
```bash
# Build all agents
npm run docker:build

# Or build individually
cd agents/guardian && docker build -t gcr.io/$PROJECT_ID/guardian-agent:latest .
cd agents/optimizer && docker build -t gcr.io/$PROJECT_ID/optimizer-agent:latest .
cd agents/master_control && docker build -t gcr.io/$PROJECT_ID/master-control-agent:latest .
cd agents/egress && docker build -t gcr.io/$PROJECT_ID/egress-agent:latest .
```

### 2. Push Images to Registry
```bash
# Configure Docker for GCR
gcloud auth configure-docker

# Push all images
npm run docker:push

# Or push individually
docker push gcr.io/$PROJECT_ID/guardian-agent:latest
docker push gcr.io/$PROJECT_ID/optimizer-agent:latest
docker push gcr.io/$PROJECT_ID/master-control-agent:latest
docker push gcr.io/$PROJECT_ID/egress-agent:latest
```

### 3. Deploy to Cloud Run

#### Guardian Agent
```bash
gcloud run deploy guardian-agent \
  --image=gcr.io/$PROJECT_ID/guardian-agent:latest \
  --region=us-central1 \
  --platform=managed \
  --service-account=guardian-agent@$PROJECT_ID.iam.gserviceaccount.com \
  --vpc-connector=cemai-agents-connector \
  --vpc-egress=private-ranges-only \
  --memory=2Gi \
  --cpu=2 \
  --min-instances=1 \
  --max-instances=10 \
  --timeout=300 \
  --concurrency=100 \
  --set-env-vars="ENVIRONMENT=production,LOG_LEVEL=INFO"
```

#### Optimizer Agent
```bash
gcloud run deploy optimizer-agent \
  --image=gcr.io/$PROJECT_ID/optimizer-agent:latest \
  --region=us-central1 \
  --platform=managed \
  --service-account=optimizer-agent@$PROJECT_ID.iam.gserviceaccount.com \
  --vpc-connector=cemai-agents-connector \
  --vpc-egress=private-ranges-only \
  --memory=4Gi \
  --cpu=2 \
  --min-instances=1 \
  --max-instances=5 \
  --timeout=600 \
  --concurrency=50 \
  --set-env-vars="ENVIRONMENT=production,LOG_LEVEL=INFO"
```

#### Master Control Agent
```bash
gcloud run deploy master-control-agent \
  --image=gcr.io/$PROJECT_ID/master-control-agent:latest \
  --region=us-central1 \
  --platform=managed \
  --service-account=master-control-agent@$PROJECT_ID.iam.gserviceaccount.com \
  --vpc-connector=cemai-agents-connector \
  --vpc-egress=private-ranges-only \
  --memory=4Gi \
  --cpu=4 \
  --min-instances=2 \
  --max-instances=10 \
  --timeout=900 \
  --concurrency=25 \
  --set-env-vars="ENVIRONMENT=production,LOG_LEVEL=INFO"
```

#### Egress Agent
```bash
gcloud run deploy egress-agent \
  --image=gcr.io/$PROJECT_ID/egress-agent:latest \
  --region=us-central1 \
  --platform=managed \
  --service-account=egress-agent@$PROJECT_ID.iam.gserviceaccount.com \
  --vpc-connector=cemai-agents-connector \
  --vpc-egress=private-ranges-only \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=1 \
  --max-instances=3 \
  --timeout=120 \
  --concurrency=10 \
  --set-env-vars="ENVIRONMENT=production,LOG_LEVEL=INFO"
```

## Configuration

### 1. Environment Variables
Each agent requires specific environment variables:

#### Guardian Agent
```bash
VERTEX_AI_ENDPOINT_ID=projects/$PROJECT_ID/locations/us-central1/endpoints/your-endpoint
PUBSUB_SUBSCRIPTION=projects/$PROJECT_ID/subscriptions/guardian-data
MASTER_CONTROL_ENDPOINT=https://master-control-agent-us-central1-$PROJECT_ID.a.run.app
LOG_LEVEL=INFO
PREDICTION_INTERVAL=30
QUALITY_BAND_BUFFER=0.1
```

#### Optimizer Agent
```bash
VERTEX_AI_ENDPOINT_ID=projects/$PROJECT_ID/locations/us-central1/endpoints/your-endpoint
PUBSUB_SUBSCRIPTION=projects/$PROJECT_ID/subscriptions/optimizer-market-data
MASTER_CONTROL_ENDPOINT=https://master-control-agent-us-central1-$PROJECT_ID.a.run.app
LOG_LEVEL=INFO
OPTIMIZATION_INTERVAL=300
MARKET_SENSITIVITY_THRESHOLD=0.05
```

#### Master Control Agent
```bash
GEMINI_MODEL_NAME=gemini-2.5-pro
ALLOYDB_CONNECTION_STRING=postgresql://user:pass@host:port/db
PUBSUB_TOPIC_AGENT_COMMUNICATION=projects/$PROJECT_ID/topics/agent-communication
WORKFLOW_TIMEOUT_MS=60000
LOG_LEVEL=INFO
DECISION_CACHE_TTL=300
CONFLICT_RESOLUTION_TIMEOUT=30000
```

#### Egress Agent
```bash
OPCUA_ENDPOINT=opc.tcp://your-plant-server:4840
COMMAND_TIMEOUT_MS=30000
LOG_LEVEL=INFO
OPCUA_CONNECTION_TIMEOUT=10000
OPCUA_RECONNECT_INTERVAL=30000
```

### 2. Secret Manager Configuration
Store sensitive configuration in Secret Manager:

```bash
# AlloyDB connection string
gcloud secrets create alloydb-connection --data-file=connection-string.txt

# OPC-UA server credentials
gcloud secrets create opcua-credentials --data-file=opcua-creds.json

# Vertex AI endpoint IDs
gcloud secrets create vertex-endpoints --data-file=endpoints.json
```

## Verification

### 1. Health Checks
```bash
# Check all agent health endpoints
curl https://guardian-agent-us-central1-$PROJECT_ID.a.run.app/health
curl https://optimizer-agent-us-central1-$PROJECT_ID.a.run.app/health
curl https://master-control-agent-us-central1-$PROJECT_ID.a.run.app/health
curl https://egress-agent-us-central1-$PROJECT_ID.a.run.app/health
```

### 2. Integration Tests
```bash
# Run integration tests
npm run test:integration

# Run end-to-end tests
npm run test:e2e
```

### 3. Load Testing
```bash
# Run load tests
npm run test:performance
```

## Monitoring Setup

### 1. Cloud Monitoring Dashboards
```bash
# Create monitoring dashboards
gcloud monitoring dashboards create --config-from-file=monitoring/dashboards/agent-dashboard.json
gcloud monitoring dashboards create --config-from-file=monitoring/dashboards/business-metrics.json
```

### 2. Alerting Policies
```bash
# Create alerting policies
gcloud alpha monitoring policies create --policy-from-file=monitoring/alerts/decision-latency.json
gcloud alpha monitoring policies create --policy-from-file=monitoring/alerts/agent-health.json
```

### 3. Log-based Metrics
```bash
# Create log-based metrics
gcloud logging metrics create decision_latency --config-from-file=monitoring/metrics/decision-latency.json
gcloud logging metrics create proposal_count --config-from-file=monitoring/metrics/proposal-count.json
```

## Security Configuration

### 1. VPC Service Controls
```bash
# Verify VPC Service Controls perimeter
gcloud access-context-manager perimeters list
```

### 2. IAM Policies
```bash
# Verify service account permissions
gcloud projects get-iam-policy $PROJECT_ID
```

### 3. Network Security
```bash
# Verify firewall rules
gcloud compute firewall-rules list --filter="name~cemai"
```

## Troubleshooting

### Common Issues

#### 1. Agent Startup Failures
```bash
# Check Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision" --limit=50

# Check service account permissions
gcloud projects get-iam-policy $PROJECT_ID --flatten="bindings[].members" --filter="bindings.members:guardian-agent@$PROJECT_ID.iam.gserviceaccount.com"
```

#### 2. OPC-UA Connection Issues
```bash
# Check Egress Agent logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=egress-agent" --limit=50

# Test OPC-UA connectivity
telnet your-plant-server 4840
```

#### 3. Vertex AI Model Issues
```bash
# Check model endpoint status
gcloud ai endpoints list --region=us-central1

# Test model prediction
gcloud ai endpoints predict ENDPOINT_ID --region=us-central1 --json-request=test-request.json
```

### Debug Commands
```bash
# Get agent service URLs
gcloud run services list --platform=managed --region=us-central1

# Check AlloyDB cluster status
gcloud alloydb clusters describe cemai-agents-cluster --region=us-central1

# Monitor Pub/Sub topics
gcloud pubsub topics list
gcloud pubsub subscriptions list
```

## Maintenance

### 1. Regular Updates
```bash
# Update agent images
npm run docker:build
npm run docker:push

# Deploy updates
gcloud run services update guardian-agent --image=gcr.io/$PROJECT_ID/guardian-agent:latest
```

### 2. Backup Procedures
```bash
# Backup AlloyDB
gcloud alloydb backups create --cluster=cemai-agents-cluster --region=us-central1

# Export Terraform state
terraform state pull > terraform-state-backup.json
```

### 3. Scaling Operations
```bash
# Scale agents based on load
gcloud run services update guardian-agent --min-instances=2 --max-instances=20
```

## Disaster Recovery

### 1. Backup Strategy
- **AlloyDB**: Automated daily backups with 30-day retention
- **Terraform State**: Stored in GCS with versioning enabled
- **Container Images**: Stored in Artifact Registry with retention policies
- **Configuration**: Stored in Secret Manager with replication

### 2. Recovery Procedures
```bash
# Restore from backup
gcloud alloydb backups restore BACKUP_ID --cluster=cemai-agents-cluster --region=us-central1

# Redeploy from Terraform
terraform apply -var-file="terraform.tfvars"
```

## Performance Optimization

### 1. Resource Tuning
- **Memory**: Monitor usage and adjust based on actual consumption
- **CPU**: Scale based on processing requirements
- **Concurrency**: Tune based on request patterns

### 2. Caching Strategy
- **Decision Cache**: 5-minute TTL for repeated decisions
- **Model Predictions**: Cache for 1 minute to reduce Vertex AI calls
- **Configuration**: Cache for 10 minutes to reduce Secret Manager calls

### 3. Database Optimization
- **Connection Pooling**: Configure appropriate pool sizes
- **Query Optimization**: Monitor slow queries and optimize
- **Indexing**: Add indexes for frequently queried fields

## Security Best Practices

### 1. Access Control
- **Least Privilege**: Each agent has minimal required permissions
- **Service Accounts**: Dedicated accounts for each agent
- **VPC Controls**: Network isolation and restricted egress

### 2. Data Protection
- **Encryption**: All data encrypted at rest and in transit
- **Key Management**: Cloud KMS for key rotation and management
- **Audit Logging**: Comprehensive audit trails for all operations

### 3. Monitoring
- **Security Monitoring**: Real-time threat detection
- **Compliance**: Automated compliance checking
- **Incident Response**: Automated alerting and escalation

## Support and Maintenance

### 1. Monitoring
- **Health Checks**: Automated health monitoring
- **Performance Metrics**: Real-time performance tracking
- **Business Metrics**: KPI tracking and reporting

### 2. Support Procedures
- **Incident Response**: 24/7 monitoring and alerting
- **Escalation**: Automated escalation procedures
- **Documentation**: Comprehensive runbooks and procedures

### 3. Updates and Patches
- **Security Updates**: Automated security patch deployment
- **Feature Updates**: Rolling deployment of new features
- **Rollback Procedures**: Automated rollback capabilities

This deployment guide provides comprehensive instructions for deploying and maintaining the CemAI Agent Swarm in a production environment. Follow these procedures carefully to ensure a successful deployment that meets all enterprise requirements.