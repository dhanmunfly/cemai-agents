#!/bin/bash
# CemAI Agents - Mumbai Region Deployment Script (Bash)
# Deploys all agents to Google Cloud Run in Mumbai (asia-south1) region

set -e

# Configuration
PROJECT_ID=${1:-"gcp-hackathon-25"}
REGION=${2:-"asia-south1"}
ARTIFACT_REGISTRY=${3:-"cemai-infrastructure-agents-dev"}
ARTIFACT_REGISTRY_URL="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REGISTRY}"

# Services configuration
declare -A SERVICES=(
    ["guardian-agent"]="agents/guardian:8081"
    ["optimizer-agent"]="agents/optimizer:8082"
    ["master-control-agent"]="agents/master_control:8083"
    ["egress-agent"]="agents/egress:8084"
)

echo "🚀 CemAI Agents Mumbai Deployment"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Artifact Registry: $ARTIFACT_REGISTRY_URL"
echo ""

# Function to check gcloud authentication
check_gcloud_auth() {
    echo "🔐 Checking gcloud authentication..."
    if gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
        echo "✅ Authenticated as: $(gcloud auth list --filter=status:ACTIVE --format='value(account)')"
        return 0
    else
        echo "❌ Not authenticated with gcloud"
        echo "Please run: gcloud auth login"
        return 1
    fi
}

# Function to set up Docker authentication
setup_docker_auth() {
    echo "🔐 Setting up Docker authentication for Artifact Registry..."
    gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
    echo "✅ Docker authentication configured"
}

# Function to build and push Docker image
build_and_push() {
    local service_name=$1
    local service_path=$2
    local image_tag="${ARTIFACT_REGISTRY_URL}/${service_name}:latest"
    
    echo "🔨 Building Docker image for $service_name..."
    docker build -t "$image_tag" "$service_path"
    
    echo "📤 Pushing Docker image to Artifact Registry..."
    docker push "$image_tag"
    
    echo "✅ Successfully built and pushed $service_name"
}

# Function to deploy to Cloud Run
deploy_to_cloud_run() {
    local service_name=$1
    local image_tag="${ARTIFACT_REGISTRY_URL}/${service_name}:latest"
    local port=$2
    
    echo "🚀 Deploying $service_name to Cloud Run..."
    
    gcloud run deploy "$service_name" \
        --image "$image_tag" \
        --platform managed \
        --region "$REGION" \
        --project "$PROJECT_ID" \
        --port "$port" \
        --allow-unauthenticated \
        --memory 1Gi \
        --cpu 1 \
        --min-instances 0 \
        --max-instances 10 \
        --timeout 300 \
        --set-env-vars "ENVIRONMENT=production,LOG_LEVEL=INFO,GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_CLOUD_REGION=$REGION" \
        --quiet
    
    echo "✅ Successfully deployed $service_name"
    
    # Get and display service URL
    local service_url=$(gcloud run services describe "$service_name" --region "$REGION" --project "$PROJECT_ID" --format="value(status.url)" --quiet)
    echo "   Service URL: $service_url"
}

# Function to test deployed services
test_services() {
    echo "🧪 Testing deployed services..."
    
    for service_name in "${!SERVICES[@]}"; do
        local service_url=$(gcloud run services describe "$service_name" --region "$REGION" --project "$PROJECT_ID" --format="value(status.url)" --quiet)
        
        if [ -n "$service_url" ]; then
            echo "Testing $service_name at $service_url/health..."
            if curl -s -f "$service_url/health" > /dev/null; then
                echo "✅ $service_name is healthy"
            else
                echo "⚠️  $service_name health check failed"
            fi
        fi
    done
}

# Main execution
main() {
    # Check authentication
    if ! check_gcloud_auth; then
        exit 1
    fi
    
    # Set up Docker authentication
    setup_docker_auth
    
    # Build, push, and deploy each service
    for service_name in "${!SERVICES[@]}"; do
        IFS=':' read -r service_path port <<< "${SERVICES[$service_name]}"
        
        echo ""
        echo "Processing $service_name..."
        
        build_and_push "$service_name" "$service_path"
        deploy_to_cloud_run "$service_name" "$port"
    done
    
    # Test deployed services
    echo ""
    test_services
    
    # Display all service URLs
    echo ""
    echo "🌐 Deployed Service URLs:"
    for service_name in "${!SERVICES[@]}"; do
        local service_url=$(gcloud run services describe "$service_name" --region "$REGION" --project "$PROJECT_ID" --format="value(status.url)" --quiet)
        if [ -n "$service_url" ]; then
            echo "  $service_name: $service_url"
        fi
    done
    
    echo ""
    echo "🎉 Deployment completed!"
}

# Run main function
main "$@"
