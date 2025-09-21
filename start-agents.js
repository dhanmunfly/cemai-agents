#!/usr/bin/env node
/**
 * CemAI Agents - Centralized Startup Script
 * Loads environment configuration and starts all agents
 */

import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables from config file
function loadEnvironmentConfig() {
  try {
    const configPath = join(process.cwd(), 'environment-config.env');
    const configContent = readFileSync(configPath, 'utf8');
    
    const envVars: Record<string, string> = {};
    
    configContent.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#') && line.includes('=')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').trim();
        if (key && value) {
          envVars[key.trim()] = value;
        }
      }
    });
    
    // Set environment variables
    Object.entries(envVars).forEach(([key, value]) => {
      process.env[key] = value;
    });
    
    console.log('✅ Environment configuration loaded successfully');
    console.log(`📋 Environment: ${process.env.ENVIRONMENT}`);
    console.log(`📋 Log Level: ${process.env.LOG_LEVEL}`);
    console.log(`📋 Debug Mode: ${process.env.DEBUG_MODE}`);
    
  } catch (error) {
    console.error('❌ Failed to load environment configuration:', error);
    process.exit(1);
  }
}

// Start a single agent
function startAgent(agentName: string, port: string, additionalEnv: Record<string, string> = {}) {
  return new Promise<void>((resolve, reject) => {
    console.log(`🚀 Starting ${agentName} agent on port ${port}...`);
    
    const agentPath = join(process.cwd(), 'agents', agentName);
    const env = {
      ...process.env,
      PORT: port,
      ...additionalEnv
    };
    
    const child = spawn('npm', ['run', 'dev'], {
      cwd: agentPath,
      env,
      stdio: 'pipe',
      shell: true
    });
    
    child.stdout?.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        console.log(`[${agentName.toUpperCase()}] ${output}`);
      }
    });
    
    child.stderr?.on('data', (data) => {
      const error = data.toString().trim();
      if (error) {
        console.error(`[${agentName.toUpperCase()}] ERROR: ${error}`);
      }
    });
    
    child.on('error', (error) => {
      console.error(`❌ Failed to start ${agentName} agent:`, error);
      reject(error);
    });
    
    child.on('exit', (code) => {
      if (code === 0) {
        console.log(`✅ ${agentName} agent started successfully`);
        resolve();
      } else {
        console.error(`❌ ${agentName} agent exited with code ${code}`);
        reject(new Error(`Agent ${agentName} exited with code ${code}`));
      }
    });
    
    // Store child process for cleanup
    (global as any).agentProcesses = (global as any).agentProcesses || [];
    (global as any).agentProcesses.push(child);
  });
}

// Start all agents in sequence
async function startAllAgents() {
  try {
    console.log('🎯 Starting CemAI Agent Swarm...\n');
    
    // Start agents in dependency order
    const agents = [
      {
        name: 'guardian',
        port: process.env.GUARDIAN_PORT || '8081',
        env: {
          MASTER_CONTROL_ENDPOINT: process.env.MASTER_CONTROL_ENDPOINT || 'http://localhost:8083'
        }
      },
      {
        name: 'optimizer',
        port: process.env.OPTIMIZER_PORT || '8082',
        env: {
          MASTER_CONTROL_ENDPOINT: process.env.MASTER_CONTROL_ENDPOINT || 'http://localhost:8083'
        }
      },
      {
        name: 'master_control',
        port: process.env.MASTER_CONTROL_PORT || '8083',
        env: {
          GUARDIAN_ENDPOINT: process.env.GUARDIAN_ENDPOINT || 'http://localhost:8081',
          OPTIMIZER_ENDPOINT: process.env.OPTIMIZER_ENDPOINT || 'http://localhost:8082',
          EGRESS_ENDPOINT: process.env.EGRESS_ENDPOINT || 'http://localhost:8084'
        }
      },
      {
        name: 'egress',
        port: process.env.EGRESS_PORT || '8084',
        env: {
          MASTER_CONTROL_ENDPOINT: process.env.MASTER_CONTROL_ENDPOINT || 'http://localhost:8083'
        }
      }
    ];
    
    // Start agents with a small delay between each
    for (const agent of agents) {
      await startAgent(agent.name, agent.port, agent.env);
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
    }
    
    console.log('\n🎉 All CemAI agents started successfully!');
    console.log('\n📊 Agent Status:');
    console.log(`   Guardian Agent:     http://localhost:${process.env.GUARDIAN_PORT || '8081'}/health`);
    console.log(`   Optimizer Agent:    http://localhost:${process.env.OPTIMIZER_PORT || '8082'}/health`);
    console.log(`   Master Control:     http://localhost:${process.env.MASTER_CONTROL_PORT || '8083'}/health`);
    console.log(`   Egress Agent:      http://localhost:${process.env.EGRESS_PORT || '8084'}/health`);
    
    console.log('\n🔧 To test agent communication:');
    console.log('   curl http://localhost:8081/health');
    console.log('   curl http://localhost:8082/health');
    console.log('   curl http://localhost:8083/health');
    console.log('   curl http://localhost:8084/health');
    
    console.log('\n⏹️  Press Ctrl+C to stop all agents');
    
  } catch (error) {
    console.error('❌ Failed to start agents:', error);
    process.exit(1);
  }
}

// Cleanup function
function cleanup() {
  console.log('\n🛑 Shutting down CemAI Agent Swarm...');
  
  const processes = (global as any).agentProcesses || [];
  processes.forEach((child: any) => {
    if (child && !child.killed) {
      child.kill('SIGTERM');
    }
  });
  
  setTimeout(() => {
    processes.forEach((child: any) => {
      if (child && !child.killed) {
        child.kill('SIGKILL');
      }
    });
    process.exit(0);
  }, 5000);
}

// Handle process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Main execution
async function main() {
  try {
    loadEnvironmentConfig();
    await startAllAgents();
  } catch (error) {
    console.error('❌ Startup failed:', error);
    process.exit(1);
  }
}

main();
