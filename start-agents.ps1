# CemAI Agents - Windows PowerShell Startup Script
# Loads environment configuration and starts all agents

param(
    [string]$ConfigFile = "environment-config.env",
    [switch]$Help
)

if ($Help) {
    Write-Host "CemAI Agents Startup Script" -ForegroundColor Green
    Write-Host "Usage: .\start-agents.ps1 [-ConfigFile <path>] [-Help]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Parameters:" -ForegroundColor Cyan
    Write-Host "  -ConfigFile  Path to environment configuration file (default: environment-config.env)"
    Write-Host "  -Help        Show this help message"
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Cyan
    Write-Host "  .\start-agents.ps1"
    Write-Host "  .\start-agents.ps1 -ConfigFile my-config.env"
    exit 0
}

# Function to load environment configuration
function Load-EnvironmentConfig {
    param([string]$ConfigPath)
    
    try {
        if (-not (Test-Path $ConfigPath)) {
            Write-Error "Configuration file not found: $ConfigPath"
            exit 1
        }
        
        Write-Host "📋 Loading environment configuration from: $ConfigPath" -ForegroundColor Blue
        
        $configContent = Get-Content $ConfigPath -Raw
        $envVars = @{}
        
        $configContent -split "`n" | ForEach-Object {
            $line = $_.Trim()
            if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
                $parts = $line -split "=", 2
                if ($parts.Length -eq 2) {
                    $key = $parts[0].Trim()
                    $value = $parts[1].Trim()
                    if ($key -and $value) {
                        $envVars[$key] = $value
                    }
                }
            }
        }
        
        # Set environment variables
        $envVars.GetEnumerator() | ForEach-Object {
            [Environment]::SetEnvironmentVariable($_.Key, $_.Value, "Process")
        }
        
        Write-Host "✅ Environment configuration loaded successfully" -ForegroundColor Green
        Write-Host "📋 Environment: $($env:ENVIRONMENT)" -ForegroundColor Cyan
        Write-Host "📋 Log Level: $($env:LOG_LEVEL)" -ForegroundColor Cyan
        Write-Host "📋 Debug Mode: $($env:DEBUG_MODE)" -ForegroundColor Cyan
        
    } catch {
        Write-Error "Failed to load environment configuration: $_"
        exit 1
    }
}

# Function to start a single agent
function Start-Agent {
    param(
        [string]$AgentName,
        [string]$Port,
        [hashtable]$AdditionalEnv = @{}
    )
    
    Write-Host "🚀 Starting $AgentName agent on port $Port..." -ForegroundColor Yellow
    
    $agentPath = Join-Path $PSScriptRoot "agents\$AgentName"
    
    if (-not (Test-Path $agentPath)) {
        Write-Error "Agent directory not found: $agentPath"
        return $false
    }
    
    # Set environment variables
    $env:PORT = $Port
    $AdditionalEnv.GetEnumerator() | ForEach-Object {
        [Environment]::SetEnvironmentVariable($_.Key, $_.Value, "Process")
    }
    
    try {
        # Start the agent process
        $process = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory $agentPath -PassThru -NoNewWindow
        
        # Store process for cleanup
        if (-not $global:AgentProcesses) {
            $global:AgentProcesses = @()
        }
        $global:AgentProcesses += $process
        
        # Wait a moment for startup
        Start-Sleep -Seconds 3
        
        if ($process.HasExited) {
            Write-Error "$AgentName agent failed to start (exit code: $($process.ExitCode))"
            return $false
        }
        
        Write-Host "✅ $AgentName agent started successfully (PID: $($process.Id))" -ForegroundColor Green
        return $true
        
    } catch {
        Write-Error "Failed to start $AgentName agent: $_"
        return $false
    }
}

# Function to start all agents
function Start-AllAgents {
    Write-Host "🎯 Starting CemAI Agent Swarm..." -ForegroundColor Green
    Write-Host ""
    
    # Define agents in dependency order
    $agents = @(
        @{
            Name = "guardian"
            Port = if ($env:GUARDIAN_PORT) { $env:GUARDIAN_PORT } else { "8081" }
            AdditionalEnv = @{
                MASTER_CONTROL_ENDPOINT = if ($env:MASTER_CONTROL_ENDPOINT) { $env:MASTER_CONTROL_ENDPOINT } else { "http://localhost:8083" }
            }
        },
        @{
            Name = "optimizer"
            Port = if ($env:OPTIMIZER_PORT) { $env:OPTIMIZER_PORT } else { "8082" }
            AdditionalEnv = @{
                MASTER_CONTROL_ENDPOINT = if ($env:MASTER_CONTROL_ENDPOINT) { $env:MASTER_CONTROL_ENDPOINT } else { "http://localhost:8083" }
            }
        },
        @{
            Name = "master_control"
            Port = if ($env:MASTER_CONTROL_PORT) { $env:MASTER_CONTROL_PORT } else { "8083" }
            AdditionalEnv = @{
                GUARDIAN_ENDPOINT = if ($env:GUARDIAN_ENDPOINT) { $env:GUARDIAN_ENDPOINT } else { "http://localhost:8081" }
                OPTIMIZER_ENDPOINT = if ($env:OPTIMIZER_ENDPOINT) { $env:OPTIMIZER_ENDPOINT } else { "http://localhost:8082" }
                EGRESS_ENDPOINT = if ($env:EGRESS_ENDPOINT) { $env:EGRESS_ENDPOINT } else { "http://localhost:8084" }
            }
        },
        @{
            Name = "egress"
            Port = if ($env:EGRESS_PORT) { $env:EGRESS_PORT } else { "8084" }
            AdditionalEnv = @{
                MASTER_CONTROL_ENDPOINT = if ($env:MASTER_CONTROL_ENDPOINT) { $env:MASTER_CONTROL_ENDPOINT } else { "http://localhost:8083" }
            }
        }
    )
    
    $successCount = 0
    
    foreach ($agent in $agents) {
        if (Start-Agent -AgentName $agent.Name -Port $agent.Port -AdditionalEnv $agent.AdditionalEnv) {
            $successCount++
        }
        
        # Small delay between agent starts
        Start-Sleep -Seconds 2
    }
    
    if ($successCount -eq $agents.Count) {
        Write-Host ""
        Write-Host "🎉 All CemAI agents started successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📊 Agent Status:" -ForegroundColor Cyan
        Write-Host "   Guardian Agent:     http://localhost:$(if ($env:GUARDIAN_PORT) { $env:GUARDIAN_PORT } else { '8081' })/health" -ForegroundColor White
        Write-Host "   Optimizer Agent:    http://localhost:$(if ($env:OPTIMIZER_PORT) { $env:OPTIMIZER_PORT } else { '8082' })/health" -ForegroundColor White
        Write-Host "   Master Control:     http://localhost:$(if ($env:MASTER_CONTROL_PORT) { $env:MASTER_CONTROL_PORT } else { '8083' })/health" -ForegroundColor White
        Write-Host "   Egress Agent:      http://localhost:$(if ($env:EGRESS_PORT) { $env:EGRESS_PORT } else { '8084' })/health" -ForegroundColor White
        
        Write-Host ""
        Write-Host "🔧 To test agent communication:" -ForegroundColor Cyan
        Write-Host "   curl http://localhost:8081/health" -ForegroundColor White
        Write-Host "   curl http://localhost:8082/health" -ForegroundColor White
        Write-Host "   curl http://localhost:8083/health" -ForegroundColor White
        Write-Host "   curl http://localhost:8084/health" -ForegroundColor White
        
        Write-Host ""
        Write-Host "⏹️  Press Ctrl+C to stop all agents" -ForegroundColor Yellow
        
        # Keep script running
        try {
            while ($true) {
                Start-Sleep -Seconds 1
            }
        } catch [System.Management.Automation.PipelineStoppedException] {
            # Handle Ctrl+C gracefully
        }
        
    } else {
        Write-Host ""
        Write-Host "❌ Some agents failed to start. Check the logs above." -ForegroundColor Red
        exit 1
    }
}

# Cleanup function
function Stop-AllAgents {
    Write-Host ""
    Write-Host "🛑 Shutting down CemAI Agent Swarm..." -ForegroundColor Yellow
    
    if ($global:AgentProcesses) {
        foreach ($process in $global:AgentProcesses) {
            if ($process -and -not $process.HasExited) {
                Write-Host "   Stopping process $($process.Id)..." -ForegroundColor Yellow
                $process.Kill()
            }
        }
    }
    
    Write-Host "✅ All agents stopped" -ForegroundColor Green
}

# Handle cleanup on script exit
Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
    Stop-AllAgents
}

# Main execution
try {
    Load-EnvironmentConfig -ConfigPath $ConfigFile
    Start-AllAgents
} catch {
    Write-Error "Startup failed: $_"
    Stop-AllAgents
    exit 1
}
