@echo off
REM CemAI Agents - Windows Batch Startup Script
REM Loads environment configuration and starts all agents

setlocal enabledelayedexpansion

echo ============================================
echo CemAI Agents - Agent Swarm Startup
echo ============================================
echo.

REM Check if config file exists
if not exist "environment-config.env" (
    echo ERROR: Environment configuration file not found: environment-config.env
    echo Please create the configuration file first.
    pause
    exit /b 1
)

echo Loading environment configuration...

REM Load environment variables from config file
for /f "usebackq tokens=1,2 delims==" %%a in ("environment-config.env") do (
    if not "%%a"=="" if not "%%a:~0,1%"=="#" (
        set "%%a=%%b"
    )
)

echo Environment: %ENVIRONMENT%
echo Log Level: %LOG_LEVEL%
echo Debug Mode: %DEBUG_MODE%
echo.

REM Set default values if not specified
if not defined GUARDIAN_PORT set GUARDIAN_PORT=8081
if not defined OPTIMIZER_PORT set OPTIMIZER_PORT=8082
if not defined MASTER_CONTROL_PORT set MASTER_CONTROL_PORT=8083
if not defined EGRESS_PORT set EGRESS_PORT=8084

if not defined MASTER_CONTROL_ENDPOINT set MASTER_CONTROL_ENDPOINT=http://localhost:8083
if not defined GUARDIAN_ENDPOINT set GUARDIAN_ENDPOINT=http://localhost:8081
if not defined OPTIMIZER_ENDPOINT set OPTIMIZER_ENDPOINT=http://localhost:8082
if not defined EGRESS_ENDPOINT set EGRESS_ENDPOINT=http://localhost:8084

echo Starting CemAI Agent Swarm...
echo.

REM Start Guardian Agent
echo Starting Guardian Agent on port %GUARDIAN_PORT%...
start "Guardian Agent" cmd /k "cd agents\guardian && set PORT=%GUARDIAN_PORT% && set MASTER_CONTROL_ENDPOINT=%MASTER_CONTROL_ENDPOINT% && npm run dev"
timeout /t 3 /nobreak >nul

REM Start Optimizer Agent
echo Starting Optimizer Agent on port %OPTIMIZER_PORT%...
start "Optimizer Agent" cmd /k "cd agents\optimizer && set PORT=%OPTIMIZER_PORT% && set MASTER_CONTROL_ENDPOINT=%MASTER_CONTROL_ENDPOINT% && npm run dev"
timeout /t 3 /nobreak >nul

REM Start Master Control Agent
echo Starting Master Control Agent on port %MASTER_CONTROL_PORT%...
start "Master Control Agent" cmd /k "cd agents\master_control && set PORT=%MASTER_CONTROL_PORT% && set GUARDIAN_ENDPOINT=%GUARDIAN_ENDPOINT% && set OPTIMIZER_ENDPOINT=%OPTIMIZER_ENDPOINT% && set EGRESS_ENDPOINT=%EGRESS_ENDPOINT% && npm run dev"
timeout /t 3 /nobreak >nul

REM Start Egress Agent
echo Starting Egress Agent on port %EGRESS_PORT%...
start "Egress Agent" cmd /k "cd agents\egress && set PORT=%EGRESS_PORT% && set MASTER_CONTROL_ENDPOINT=%MASTER_CONTROL_ENDPOINT% && npm run dev"
timeout /t 3 /nobreak >nul

echo.
echo All agents started successfully!
echo.
echo Agent Status:
echo   Guardian Agent:     http://localhost:%GUARDIAN_PORT%/health
echo   Optimizer Agent:    http://localhost:%OPTIMIZER_PORT%/health
echo   Master Control:     http://localhost:%MASTER_CONTROL_PORT%/health
echo   Egress Agent:      http://localhost:%EGRESS_PORT%/health
echo.
echo To test agent communication:
echo   curl http://localhost:%GUARDIAN_PORT%/health
echo   curl http://localhost:%OPTIMIZER_PORT%/health
echo   curl http://localhost:%MASTER_CONTROL_PORT%/health
echo   curl http://localhost:%EGRESS_PORT%/health
echo.
echo Press any key to exit (agents will continue running)...
pause >nul
