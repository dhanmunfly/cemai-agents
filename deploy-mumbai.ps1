# CemAI Agents - Mumbai Region Deployment Script
# Deploys all agents to Google Cloud Run in Mumbai (asia-south1) region

param(
    [string]$ProjectId = "gcp-hackathon-25",
    [string]$Region = "asia-south1",
    [string]$ArtifactRegistry = "cemai-infrastructure-agents-dev",
    [switch]$BuildOnly,
    [switch]$DeployOnly,
    [switch]$Help
)

if ($Help) {
    Write-Host "CemAI Agents Mumbai Deployment Script" -ForegroundColor Green
    Write-Host "Usage: .\deploy-mumbai.ps1 [-ProjectId <id>] [-Region <region>] [-ArtifactRegistry <registry>] [-BuildOnly] [-DeployOnly] [-Help]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Parameters:" -ForegroundColor Cyan
    Write-Host "  -ProjectId        Google Cloud Project ID (default: gcp-hackathon-25)"
    Write-Host "  -Region          Google Cloud Region (default: asia-south1)"
    Write-Host "  -ArtifactRegistry Artifact Registry name (default: cemai-infrastructure-agents-dev)"
    Write-Host "  -BuildOnly       Only build Docker images, don't deploy"
    Write-Host "  -DeployOnly      Only deploy, skip building (assumes images exist)"
    Write-Host "  -Help            Show this help message"
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Cyan
    Write-Host "  .\deploy-mumbai.ps1"
    Write-Host "  .\deploy-mumbai.ps1 -BuildOnly"
    Write-Host "  .\deploy-mumbai.ps1 -DeployOnly"
    exit 0
}

# Configuration
$ArtifactRegistryUrl = "$Region-docker.pkg.dev/$ProjectId/$ArtifactRegistry"
$Services = @(
    @{ Name = "guardian-agent"; Port = 8080; Path = "agents/guardian" },
    @{ Name = "optimizer-agent"; Port = 8080; Path = "agents/optimizer" },
    @{ Name = "master-control-agent"; Port = 8080; Path = "agents/master_control" },
    @{ Name = "egress-agent"; Port = 8080; Path = "agents/egress" }
)

Write-Host "🚀 CemAI Agents Mumbai Deployment" -ForegroundColor Green
Write-Host "Project: $ProjectId" -ForegroundColor Cyan
Write-Host "Region: $Region" -ForegroundColor Cyan
Write-Host "Artifact Registry: $ArtifactRegistryUrl" -ForegroundColor Cyan
Write-Host ""

# Function to check if gcloud is authenticated
function Test-GCloudAuth {
    try {
        $result = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null
        if ($result) {
            Write-Host "✅ Authenticated as: $result" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ Not authenticated with gcloud" -ForegroundColor Red
            Write-Host "Please run: gcloud auth login" -ForegroundColor Yellow
            return $false
        }
    } catch {
        Write-Host "❌ gcloud not found or not configured" -ForegroundColor Red
        Write-Host "Please install Google Cloud CLI and run: gcloud auth login" -ForegroundColor Yellow
        return $false
    }
}

# Function to set up Docker authentication
function Set-DockerAuth {
    Write-Host "🔐 Setting up Docker authentication for Artifact Registry..." -ForegroundColor Blue
    try {
        gcloud auth configure-docker "${Region}-docker.pkg.dev" --quiet
        Write-Host "✅ Docker authentication configured" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to configure Docker authentication" -ForegroundColor Red
        throw
    }
}

# Function to build Docker image
function Build-DockerImage {
    param(
        [string]$ServiceName,
        [string]$ServicePath,
        [string]$ImageTag
    )
    
    Write-Host "🔨 Building Docker image for $ServiceName..." -ForegroundColor Blue
    
    try {
        # Build the Docker image
        docker build -t $ImageTag $ServicePath
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Successfully built $ServiceName" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ Failed to build $ServiceName" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ Error building $ServiceName`: $_" -ForegroundColor Red
        return $false
    }
}

# Function to push Docker image
function Push-DockerImage {
    param(
        [string]$ImageTag
    )
    
    Write-Host "📤 Pushing Docker image to Artifact Registry..." -ForegroundColor Blue
    
    try {
        docker push $ImageTag
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Successfully pushed image" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ Failed to push image" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ Error pushing image: $_" -ForegroundColor Red
        return $false
    }
}

# Function to deploy to Cloud Run
function Deploy-CloudRun {
    param(
        [string]$ServiceName,
        [string]$ImageTag,
        [int]$Port
    )
    
    Write-Host "🚀 Deploying $ServiceName to Cloud Run..." -ForegroundColor Blue
    
    try {
        # Deploy to Cloud Run
        gcloud run deploy $ServiceName `
            --image $ImageTag `
            --platform managed `
            --region $Region `
            --project $ProjectId `
            --port $Port `
            --allow-unauthenticated `
            --memory 1Gi `
            --cpu 1 `
            --min-instances 0 `
            --max-instances 10 `
            --timeout 300 `
            --set-env-vars "ENVIRONMENT=production,LOG_LEVEL=INFO,GOOGLE_CLOUD_PROJECT=$ProjectId,GOOGLE_CLOUD_REGION=$Region" `
            --quiet
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Successfully deployed $ServiceName" -ForegroundColor Green
            
            # Get the service URL
            $serviceUrl = gcloud run services describe $ServiceName --region $Region --project $ProjectId --format="value(status.url)" --quiet
            Write-Host "   Service URL: $serviceUrl" -ForegroundColor Cyan
            
            return $true
        } else {
            Write-Host "❌ Failed to deploy $ServiceName" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ Error deploying $ServiceName`: $_" -ForegroundColor Red
        return $false
    }
}

# Function to test deployed services
function Test-DeployedServices {
    Write-Host "🧪 Testing deployed services..." -ForegroundColor Blue
    
    foreach ($service in $Services) {
        $serviceUrl = gcloud run services describe $service.Name --region $Region --project $ProjectId --format="value(status.url)" --quiet
        
        if ($serviceUrl) {
            Write-Host "Testing $($service.Name) at $serviceUrl/health..." -ForegroundColor Yellow
            
            try {
                $response = Invoke-RestMethod -Uri "$serviceUrl/health" -Method Get -TimeoutSec 30
                Write-Host "✅ $($service.Name) is healthy" -ForegroundColor Green
            } catch {
                Write-Host "⚠️  $($service.Name) health check failed: $_" -ForegroundColor Yellow
            }
        }
    }
}

# Main execution
try {
    # Check authentication
    if (-not (Test-GCloudAuth)) {
        exit 1
    }
    
    # Set up Docker authentication
    Set-DockerAuth
    
    $buildSuccess = @()
    $deploySuccess = @()
    
    # Build and deploy each service
    foreach ($service in $Services) {
        $imageTag = "$ArtifactRegistryUrl/$($service.Name):latest"
        
        Write-Host ""
        Write-Host "Processing $($service.Name)..." -ForegroundColor Magenta
        
        # Build Docker image (unless DeployOnly is specified)
        if (-not $DeployOnly) {
            if (Build-DockerImage -ServiceName $service.Name -ServicePath $service.Path -ImageTag $imageTag) {
                $buildSuccess += $service.Name
                
                # Push image (unless BuildOnly is specified)
                if (-not $BuildOnly) {
                    if (Push-DockerImage -ImageTag $imageTag) {
                        Write-Host "✅ Image pushed successfully" -ForegroundColor Green
                    } else {
                        Write-Host "❌ Failed to push image for $($service.Name)" -ForegroundColor Red
                        continue
                    }
                }
            } else {
                Write-Host "❌ Failed to build $($service.Name), skipping deployment" -ForegroundColor Red
                continue
            }
        }
        
        # Deploy to Cloud Run (unless BuildOnly is specified)
        if (-not $BuildOnly) {
            if (Deploy-CloudRun -ServiceName $service.Name -ImageTag $imageTag -Port $service.Port) {
                $deploySuccess += $service.Name
            }
        }
    }
    
    # Summary
    Write-Host ""
    Write-Host "📊 Deployment Summary" -ForegroundColor Green
    
    if (-not $DeployOnly) {
        Write-Host "Built Services: $($buildSuccess.Count)/$($Services.Count)" -ForegroundColor Cyan
        $buildSuccess | ForEach-Object { Write-Host "  ✅ $_" -ForegroundColor Green }
    }
    
    if (-not $BuildOnly) {
        Write-Host "Deployed Services: $($deploySuccess.Count)/$($Services.Count)" -ForegroundColor Cyan
        $deploySuccess | ForEach-Object { Write-Host "  ✅ $_" -ForegroundColor Green }
        
        # Test deployed services
        if ($deploySuccess.Count -gt 0) {
            Write-Host ""
            Test-DeployedServices
        }
        
        # Display service URLs
        Write-Host ""
        Write-Host "🌐 Deployed Service URLs:" -ForegroundColor Green
        foreach ($service in $Services) {
            $serviceUrl = gcloud run services describe $service.Name --region $Region --project $ProjectId --format="value(status.url)" --quiet
            if ($serviceUrl) {
                Write-Host "  $($service.Name): $serviceUrl" -ForegroundColor White
            }
        }
    }
    
    Write-Host ""
    Write-Host "🎉 Deployment completed!" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Deployment failed: $_" -ForegroundColor Red
    exit 1
}