# CemAI Agents - Mumbai Region Deployment Guide

## Overview

This guide explains how to deploy the CemAI Agents to Google Cloud Run in the Mumbai region (asia-south1) using the existing `cemai-infrastructure-agents-dev` artifact registry.

## Prerequisites

1. **Google Cloud CLI** installed and configured
2. **Docker** installed and running
3. **Access** to the `gcp-hackathon-25` project
4. **Authentication** with Google Cloud

## Quick Start

### 1. Authenticate with Google Cloud
```bash
gcloud auth login
gcloud config set project gcp-hackathon-25
```

### 2. Deploy All Agents (PowerShell - Windows)
```powershell
.\deploy-mumbai.ps1
```

### 3. Deploy All Agents (Bash - Linux/Mac)
```bash
./deploy-mumbai.sh
```

### 4. Deploy with Custom Parameters
```powershell
# PowerShell
.\deploy-mumbai.ps1 -ProjectId "gcp-hackathon-25" -Region "asia-south1" -ArtifactRegistry "cemai-infrastructure-agents-dev"

# Bash
./deploy-mumbai.sh gcp-hackathon-25 asia-south1 cemai-infrastructure-agents-dev
```

## Deployment Options

### Build Only (Don't Deploy)
```powershell
.\deploy-mumbai.ps1 -BuildOnly
```

### Deploy Only (Skip Building)
```powershell
.\deploy-mumbai.ps1 -DeployOnly
```

## Manual Deployment Steps

If you prefer to deploy manually:

### 1. Set up Docker Authentication
```bash
gcloud auth configure-docker asia-south1-docker.pkg.dev
```

### 2. Build and Push Each Agent

#### Guardian Agent
```bash
docker build -t asia-south1-docker.pkg.dev/gcp-hackathon-25/cemai-infrastructure-agents-dev/guardian-agent:latest agents/guardian
docker push asia-south1-docker.pkg.dev/gcp-hackathon-25/cemai-infrastructure-agents-dev/guardian-agent:latest
```

#### Optimizer Agent
```bash
docker build -t asia-south1-docker.pkg.dev/gcp-hackathon-25/cemai-infrastructure-agents-dev/optimizer-agent:latest agents/optimizer
docker push asia-south1-docker.pkg.dev/gcp-hackathon-25/cemai-infrastructure-agents-dev/optimizer-agent:latest
```

#### Master Control Agent
```bash
docker build -t asia-south1-docker.pkg.dev/gcp-hackathon-25/cemai-infrastructure-agents-dev/master-control-agent:latest agents/master_control
docker push asia-south1-docker.pkg.dev/gcp-hackathon-25/cemai-infrastructure-agents-dev/master-control-agent:latest
```

#### Egress Agent
```bash
docker build -t asia-south1-docker.pkg.dev/gcp-hackathon-25/cemai-infrastructure-agents-dev/egress-agent:latest agents/egress
docker push asia-south1-docker.pkg.dev/gcp-hackathon-25/cemai-infrastructure-agents-dev/egress-agent:latest
```

### 3. Deploy to Cloud Run

#### Guardian Agent
```bash
gcloud run deploy guardian-agent \
  --image asia-south1-docker.pkg.dev/gcp-hackathon-25/cemai-infrastructure-agents-dev/guardian-agent:latest \
  --platform managed \
  --region asia-south1 \
  --project gcp-hackathon-25 \
  --port 8081 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300
```

#### Optimizer Agent
```bash
gcloud run deploy optimizer-agent \
  --image asia-south1-docker.pkg.dev/gcp-hackathon-25/cemai-infrastructure-agents-dev/optimizer-agent:latest \
  --platform managed \
  --region asia-south1 \
  --project gcp-hackathon-25 \
  --port 8082 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300
```

#### Master Control Agent
```bash
gcloud run deploy master-control-agent \
  --image asia-south1-docker.pkg.dev/gcp-hackathon-25/cemai-infrastructure-agents-dev/master-control-agent:latest \
  --platform managed \
  --region asia-south1 \
  --project gcp-hackathon-25 \
  --port 8083 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300
```

#### Egress Agent
```bash
gcloud run deploy egress-agent \
  --image asia-south1-docker.pkg.dev/gcp-hackathon-25/cemai-infrastructure-agents-dev/egress-agent:latest \
  --platform managed \
  --region asia-south1 \
  --project gcp-hackathon-25 \
  --port 8084 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300
```

## Environment Configuration

The deployed agents will use the following environment variables:

```env
ENVIRONMENT=production
LOG_LEVEL=INFO
GOOGLE_CLOUD_PROJECT=gcp-hackathon-25
GOOGLE_CLOUD_REGION=asia-south1
```

## Service URLs

After deployment, your agents will be available at:

- **Guardian Agent**: `https://guardian-agent-[hash].asia-south1.run.app`
- **Optimizer Agent**: `https://optimizer-agent-[hash].asia-south1.run.app`
- **Master Control Agent**: `https://master-control-agent-[hash].asia-south1.run.app`
- **Egress Agent**: `https://egress-agent-[hash].asia-south1.run.app`

## Health Checks

Test your deployed agents:

```bash
# Get service URLs
gcloud run services list --region asia-south1 --project gcp-hackathon-25

# Test health endpoints
curl https://guardian-agent-[hash].asia-south1.run.app/health
curl https://optimizer-agent-[hash].asia-south1.run.app/health
curl https://master-control-agent-[hash].asia-south1.run.app/health
curl https://egress-agent-[hash].asia-south1.run.app/health
```

## Troubleshooting

### Common Issues

1. **Authentication Error**
   ```bash
   gcloud auth login
   gcloud auth configure-docker asia-south1-docker.pkg.dev
   ```

2. **Permission Denied**
   - Ensure you have the necessary IAM roles:
     - Cloud Run Admin
     - Artifact Registry Writer
     - Service Account User

3. **Build Failures**
   - Check Docker is running
   - Verify Dockerfile exists in each agent directory
   - Check for TypeScript compilation errors

4. **Deployment Failures**
   - Check Cloud Run quotas
   - Verify region is correct
   - Check project ID is correct

### Logs

View logs for deployed services:

```bash
gcloud run services logs read guardian-agent --region asia-south1 --project gcp-hackathon-25
gcloud run services logs read optimizer-agent --region asia-south1 --project gcp-hackathon-25
gcloud run services logs read master-control-agent --region asia-south1 --project gcp-hackathon-25
gcloud run services logs read egress-agent --region asia-south1 --project gcp-hackathon-25
```

## Next Steps

1. **Configure Domain**: Set up custom domains if needed
2. **SSL Certificates**: Configure SSL certificates
3. **Monitoring**: Set up Cloud Monitoring and alerting
4. **CI/CD**: Integrate with GitHub Actions or Cloud Build
5. **Scaling**: Adjust min/max instances based on load

## Support

For issues with deployment:
1. Check the troubleshooting section above
2. Review Cloud Run logs
3. Verify IAM permissions
4. Check Google Cloud Console for service status
