# CemAI Agents - Complete Mumbai Deployment Script
# Single script to deploy all agents to Mumbai region

param(
    [switch]$Help,
    [switch]$SkipAuth,
    [switch]$BuildOnly,
    [switch]$DeployOnly
)

if ($Help) {
    Write-Host "CemAI Agents Complete Mumbai Deployment" -ForegroundColor Green
    Write-Host "Usage: .\deploy-all-agents.ps1 [-SkipAuth] [-BuildOnly] [-DeployOnly] [-Help]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Parameters:" -ForegroundColor Cyan
    Write-Host "  -SkipAuth      Skip authentication checks"
    Write-Host "  -BuildOnly     Only build Docker images, don't deploy"
    Write-Host "  -DeployOnly    Only deploy, skip building (assumes images exist)"
    Write-Host "  -Help          Show this help message"
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Cyan
    Write-Host "  .\deploy-all-agents.ps1"
    Write-Host "  .\deploy-all-agents.ps1 -BuildOnly"
    Write-Host "  .\deploy-all-agents.ps1 -DeployOnly"
    exit 0
}

# Configuration
$ProjectId = "gcp-hackathon-25"
$Region = "asia-south1"
$ArtifactRegistry = "cemai-infrastructure-agents-dev"
$ArtifactRegistryUrl = "$Region-docker.pkg.dev/$ProjectId/$ArtifactRegistry"

$Agents = @(
    @{ Name = "guardian-agent"; Port = 8080; Path = "agents/guardian"; Status = "pending" },
    @{ Name = "optimizer-agent"; Port = 8080; Path = "agents/optimizer"; Status = "pending" },
    @{ Name = "master-control-agent"; Port = 8080; Path = "agents/master_control"; Status = "pending" },
    @{ Name = "egress-agent"; Port = 8080; Path = "agents/egress"; Status = "pending" }
)

Write-Host "🚀 CemAI Agents Complete Mumbai Deployment" -ForegroundColor Green
Write-Host "Project: $ProjectId" -ForegroundColor Cyan
Write-Host "Region: $Region" -ForegroundColor Cyan
Write-Host "Artifact Registry: $ArtifactRegistryUrl" -ForegroundColor Cyan
Write-Host ""

# Function to check authentication
function Test-Authentication {
    if ($SkipAuth) {
        Write-Host "⏭️  Skipping authentication check" -ForegroundColor Yellow
        return $true
    }
    
    Write-Host "🔐 Checking authentication..." -ForegroundColor Blue
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
    Write-Host "🔐 Setting up Docker authentication..." -ForegroundColor Blue
    try {
        gcloud auth configure-docker "${Region}-docker.pkg.dev" --quiet
        Write-Host "✅ Docker authentication configured" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to configure Docker authentication" -ForegroundColor Red
        throw
    }
}

# Function to build Docker image
function Build-Agent {
    param(
        [string]$AgentName,
        [string]$AgentPath
    )
    
    $imageTag = "$ArtifactRegistryUrl/$AgentName:latest"
    
    Write-Host "🔨 Building $AgentName..." -ForegroundColor Blue
    try {
        docker build -t $imageTag $AgentPath
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Successfully built $AgentName" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ Failed to build $AgentName" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ Error building $AgentName`: $_" -ForegroundColor Red
        return $false
    }
}

# Function to push Docker image
function Push-Agent {
    param(
        [string]$AgentName
    )
    
    $imageTag = "$ArtifactRegistryUrl/$AgentName:latest"
    
    Write-Host "📤 Pushing $AgentName..." -ForegroundColor Blue
    try {
        docker push $imageTag
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Successfully pushed $AgentName" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ Failed to push $AgentName" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ Error pushing $AgentName`: $_" -ForegroundColor Red
        return $false
    }
}

# Function to deploy to Cloud Run
function Deploy-Agent {
    param(
        [string]$AgentName,
        [int]$Port
    )
    
    $imageTag = "$ArtifactRegistryUrl/$AgentName:latest"
    
    Write-Host "🚀 Deploying $AgentName to Cloud Run..." -ForegroundColor Blue
    try {
        gcloud run deploy $AgentName `
            --image $imageTag `
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
            Write-Host "✅ Successfully deployed $AgentName" -ForegroundColor Green
            
            # Get the service URL
            $serviceUrl = gcloud run services describe $AgentName --region $Region --project $ProjectId --format="value(status.url)" --quiet
            Write-Host "   Service URL: $serviceUrl" -ForegroundColor Cyan
            
            return $true
        } else {
            Write-Host "❌ Failed to deploy $AgentName" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ Error deploying $AgentName`: $_" -ForegroundColor Red
        return $false
    }
}

# Function to test deployed service
function Test-Agent {
    param(
        [string]$AgentName
    )
    
    $serviceUrl = gcloud run services describe $AgentName --region $Region --project $ProjectId --format="value(status.url)" --quiet
    
    if ($serviceUrl) {
        Write-Host "🧪 Testing $AgentName at $serviceUrl/health..." -ForegroundColor Yellow
        
        try {
            $response = Invoke-RestMethod -Uri "$serviceUrl/health" -Method Get -TimeoutSec 30
            Write-Host "✅ $AgentName is healthy" -ForegroundColor Green
            return $true
        } catch {
            Write-Host "⚠️  $AgentName health check failed: $_" -ForegroundColor Yellow
            return $false
        }
    } else {
        Write-Host "❌ Could not get service URL for $AgentName" -ForegroundColor Red
        return $false
    }
}

# Main execution
try {
    # Check authentication
    if (-not (Test-Authentication)) {
        exit 1
    }
    
    # Set up Docker authentication
    Set-DockerAuth
    
    $successCount = 0
    $totalCount = $Agents.Count
    
    Write-Host ""
    Write-Host "🎯 Starting deployment of $totalCount agents..." -ForegroundColor Magenta
    
    # Process each agent
    foreach ($agent in $Agents) {
        Write-Host ""
        Write-Host "=" * 60 -ForegroundColor Gray
        Write-Host "Processing $($agent.Name) (Port: $($agent.Port))" -ForegroundColor Magenta
        Write-Host "=" * 60 -ForegroundColor Gray
        
        $success = $true
        
        # Build Docker image (unless DeployOnly is specified)
        if (-not $DeployOnly) {
            if (-not (Build-Agent -AgentName $agent.Name -AgentPath $agent.Path)) {
                $success = $false
            }
            
            # Push image (unless BuildOnly is specified)
            if ($success -and -not $BuildOnly) {
                if (-not (Push-Agent -AgentName $agent.Name)) {
                    $success = $false
                }
            }
        }
        
        # Deploy to Cloud Run (unless BuildOnly is specified)
        if ($success -and -not $BuildOnly) {
            if (-not (Deploy-Agent -AgentName $agent.Name -Port $agent.Port)) {
                $success = $false
            }
        }
        
        # Update agent status
        if ($success) {
            $agent.Status = "success"
            $successCount++
            Write-Host "✅ $($agent.Name) completed successfully" -ForegroundColor Green
        } else {
            $agent.Status = "failed"
            Write-Host "❌ $($agent.Name) failed" -ForegroundColor Red
        }
    }
    
    # Summary
    Write-Host ""
    Write-Host "=" * 60 -ForegroundColor Gray
    Write-Host "📊 DEPLOYMENT SUMMARY" -ForegroundColor Green
    Write-Host "=" * 60 -ForegroundColor Gray
    
    Write-Host "Successfully processed: $successCount/$totalCount agents" -ForegroundColor Cyan
    
    foreach ($agent in $Agents) {
        $statusIcon = if ($agent.Status -eq "success") { "✅" } else { "❌" }
        $statusColor = if ($agent.Status -eq "success") { "Green" } else { "Red" }
        Write-Host "  $statusIcon $($agent.Name)" -ForegroundColor $statusColor
    }
    
    # Display service URLs for successful deployments
    if ($successCount -gt 0 -and -not $BuildOnly) {
        Write-Host ""
        Write-Host "🌐 DEPLOYED SERVICE URLs:" -ForegroundColor Green
        
        foreach ($agent in $Agents) {
            if ($agent.Status -eq "success") {
                $serviceUrl = gcloud run services describe $agent.Name --region $Region --project $ProjectId --format="value(status.url)" --quiet
                if ($serviceUrl) {
                    Write-Host "  $($agent.Name): $serviceUrl" -ForegroundColor White
                }
            }
        }
        
        # Test deployed services
        Write-Host ""
        Write-Host "🧪 HEALTH CHECKS:" -ForegroundColor Green
        
        foreach ($agent in $Agents) {
            if ($agent.Status -eq "success") {
                Test-Agent -AgentName $agent.Name
            }
        }
    }
    
    Write-Host ""
    if ($successCount -eq $totalCount) {
        Write-Host "🎉 ALL AGENTS DEPLOYED SUCCESSFULLY!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Some agents failed. Check the logs above." -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ Deployment failed: $_" -ForegroundColor Red
    exit 1
}
