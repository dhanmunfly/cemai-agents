import { StateGraph, END } from '@langchain/langgraph';
import { logger } from './utils/logger';
import { DECISION_CONSTITUTION, WORKFLOW_STATUS } from './config/constants';

export interface WorkflowState {
  requestId: string;
  conversationId: string;
  timestamp: string;
  trigger: string;
  context: any;
  proposals: any[];
  conflicts: any[];
  approvedActions: any[];
  rejectedActions: any[];
  modifications: any[];
  status: keyof typeof WORKFLOW_STATUS;
  decision?: any;
  executionResults?: any[];
}

/**
 * Build the LangGraph workflow for Master Control Agent
 */
export function buildGraph(): StateGraph<WorkflowState> {
  const workflow = new StateGraph<WorkflowState>({
    channels: {
      requestId: 'string',
      conversationId: 'string',
      timestamp: 'string',
      trigger: 'string',
      context: 'any',
      proposals: 'array',
      conflicts: 'array',
      approvedActions: 'array',
      rejectedActions: 'array',
      modifications: 'array',
      status: 'string',
      decision: 'any',
      executionResults: 'array'
    }
  });

  // Add workflow nodes
  workflow.addNode('collect_proposals', collectProposals);
  workflow.addNode('analyze_conflicts', analyzeConflicts);
  workflow.addNode('resolve_conflicts', resolveConflicts);
  workflow.addNode('generate_decision', generateDecision);
  workflow.addNode('send_commands', sendCommands);

  // Add workflow edges
  workflow.addEdge('collect_proposals', 'analyze_conflicts');
  workflow.addEdge('analyze_conflicts', 'resolve_conflicts');
  workflow.addEdge('resolve_conflicts', 'generate_decision');
  workflow.addEdge('generate_decision', 'send_commands');
  workflow.addEdge('send_commands', END);

  return workflow.compile();
}

/**
 * Collect proposals from specialist agents
 */
async function collectProposals(state: WorkflowState): Promise<Partial<WorkflowState>> {
  try {
    logger.info('Collecting proposals from specialist agents', {
      requestId: state.requestId,
      trigger: state.trigger
    });

    const proposals: any[] = [];

    // Simulate collecting proposals from agents
    if (state.trigger === 'quality_deviation') {
      proposals.push({
        agentId: 'guardian_agent',
        proposalType: 'stability',
        urgency: 'medium',
        actions: [{
          controlVariable: 'kiln_speed',
          currentValue: 3.2,
          proposedValue: 3.3,
          adjustmentMagnitude: 0.1
        }]
      });
    }

    return {
      proposals,
      status: WORKFLOW_STATUS.COLLECTING
    };

  } catch (error) {
    logger.error('Failed to collect proposals', { 
      error: (error as Error).message,
      requestId: state.requestId
    });
    
    return {
      status: WORKFLOW_STATUS.ERROR,
      proposals: []
    };
  }
}

/**
 * Analyze conflicts between proposals
 */
async function analyzeConflicts(state: WorkflowState): Promise<Partial<WorkflowState>> {
  try {
    logger.info('Analyzing conflicts between proposals', {
      requestId: state.requestId,
      proposalCount: state.proposals.length
    });

    const conflicts: any[] = [];

    if (state.proposals.length <= 1) {
      logger.info('No conflicts detected - single or no proposals');
      return {
        conflicts: [],
        status: WORKFLOW_STATUS.ANALYZING
      };
    }

    // Simple conflict detection logic
    for (let i = 0; i < state.proposals.length; i++) {
      for (let j = i + 1; j < state.proposals.length; j++) {
        const proposal1 = state.proposals[i];
        const proposal2 = state.proposals[j];

        // Check for conflicting control variables
        const actions1 = proposal1.actions.map((a: any) => a.controlVariable);
        const actions2 = proposal2.actions.map((a: any) => a.controlVariable);
        
        const conflictingVariables = actions1.filter((v: string) => actions2.includes(v));
        
        if (conflictingVariables.length > 0) {
          conflicts.push({
            type: 'control_variable_conflict',
            severity: 'high',
            description: `Conflicting control variables: ${conflictingVariables.join(', ')}`,
            affectedProposals: [proposal1.agentId, proposal2.agentId],
            conflictingParameters: conflictingVariables
          });
        }
      }
    }

    logger.info('Conflict analysis completed', {
      requestId: state.requestId,
      conflictCount: conflicts.length
    });

    return {
      conflicts,
      status: WORKFLOW_STATUS.ANALYZING
    };

  } catch (error) {
    logger.error('Failed to analyze conflicts', { 
      error: (error as Error).message,
      requestId: state.requestId
    });
    
    return {
      status: WORKFLOW_STATUS.ERROR,
      conflicts: []
    };
  }
}

/**
 * Resolve conflicts using Constitutional AI framework
 */
async function resolveConflicts(state: WorkflowState): Promise<Partial<WorkflowState>> {
  try {
    logger.info('Resolving conflicts using Constitutional AI', {
      requestId: state.requestId,
      conflictCount: state.conflicts.length
    });

    if (state.conflicts.length === 0) {
      logger.info('No conflicts to resolve');
      return {
        status: WORKFLOW_STATUS.RESOLVING,
        approvedActions: state.proposals.flatMap((p: any) => p.actions),
        rejectedActions: [],
        modifications: []
      };
    }

    // Apply Constitutional AI framework
    const approvedActions: any[] = [];
    const rejectedActions: any[] = [];
    const modifications: any[] = [];

    // Sort proposals by constitutional priority (Safety > Quality > Emissions > Cost)
    const sortedProposals = state.proposals.sort((a: any, b: any) => {
      const priorityA = getConstitutionalPriority(a);
      const priorityB = getConstitutionalPriority(b);
      return priorityA - priorityB;
    });

    // Process proposals in priority order
    for (const proposal of sortedProposals) {
      if (proposal.proposalType === 'stability') {
        // Safety and Quality (Priority 1 & 2) - Always approve
        approvedActions.push(...proposal.actions);
      } else if (proposal.proposalType === 'optimization') {
        // Cost optimization (Priority 4) - Only approve if no conflicts
        const hasConflicts = state.conflicts.some((c: any) => 
          c.affectedProposals.includes(proposal.agentId)
        );
        
        if (!hasConflicts) {
          approvedActions.push(...proposal.actions);
        } else {
          // Modify optimization to reduce conflicts
          const modifiedActions = proposal.actions.map((action: any) => ({
            ...action,
            executionMethod: 'gradual',
            adjustmentMagnitude: action.adjustmentMagnitude * 0.5
          }));
          modifications.push(...modifiedActions);
        }
      }
    }

    logger.info('Conflict resolution completed', {
      requestId: state.requestId,
      approvedActions: approvedActions.length,
      modifications: modifications.length
    });

    return {
      status: WORKFLOW_STATUS.RESOLVING,
      approvedActions,
      rejectedActions,
      modifications
    };

  } catch (error) {
    logger.error('Failed to resolve conflicts', { 
      error: (error as Error).message,
      requestId: state.requestId
    });
    
    return {
      status: WORKFLOW_STATUS.ERROR,
      approvedActions: [],
      rejectedActions: [],
      modifications: []
    };
  }
}

/**
 * Generate final decision with complete audit trail
 */
async function generateDecision(state: WorkflowState): Promise<Partial<WorkflowState>> {
  try {
    logger.info('Generating final decision', {
      requestId: state.requestId,
      approvedActions: state.approvedActions.length,
      rejectedActions: state.rejectedActions.length
    });

    const decision = {
      decisionId: `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      originalProposals: state.proposals.map((p: any) => p.agentId),
      conflictAnalysis: state.conflicts,
      approvedActions: state.approvedActions,
      rejectedActions: state.rejectedActions,
      modifications: state.modifications,
      decisionMaker: 'master_control_agent',
      constitutionApplied: true,
      reasoning: `Decision based on ${state.proposals.length} proposals with ${state.conflicts.length} conflicts. Constitutional AI framework applied.`,
      riskAssessment: `Risk level: ${state.conflicts.length > 0 ? 'medium' : 'low'}. ${state.conflicts.length} conflicts detected and resolved.`,
      executionPlan: {
        executionOrder: state.approvedActions.map((action: any, index: number) => ({
          step: index + 1,
          action: action.controlVariable,
          method: action.executionMethod || 'immediate',
          safetyChecks: action.safetyChecksRequired || true
        })),
        estimatedDuration: state.approvedActions.length * 5,
        rollbackPlan: 'Automatic rollback if any action fails'
      }
    };

    logger.info('Final decision generated', {
      requestId: state.requestId,
      decisionId: decision.decisionId,
      actionCount: state.approvedActions.length
    });

    return {
      decision,
      status: WORKFLOW_STATUS.DECIDING
    };

  } catch (error) {
    logger.error('Failed to generate decision', { 
      error: (error as Error).message,
      requestId: state.requestId
    });
    
    return {
      status: WORKFLOW_STATUS.ERROR,
      decision: null
    };
  }
}

/**
 * Send commands to Egress Agent
 */
async function sendCommands(state: WorkflowState): Promise<Partial<WorkflowState>> {
  try {
    logger.info('Sending commands to Egress Agent', {
      requestId: state.requestId,
      commandCount: state.approvedActions.length
    });

    const executionResults: any[] = [];

    for (const action of state.approvedActions) {
      try {
        // In a real implementation, this would send HTTP requests to the Egress Agent
        const commandResult = {
          commandId: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          status: 'success',
          action,
          decisionId: state.decision?.decisionId,
          timestamp: new Date().toISOString()
        };
        
        executionResults.push(commandResult);
        
        logger.info('Command sent successfully', {
          commandId: commandResult.commandId,
          action: action.controlVariable
        });
      } catch (error) {
        logger.error('Failed to send command', {
          action: action.controlVariable,
          error: (error as Error).message
        });
        
        executionResults.push({
          commandId: `failed_${Date.now()}`,
          status: 'failed',
          error: (error as Error).message,
          action
        });
      }
    }

    logger.info('All commands processed', {
      requestId: state.requestId,
      successCount: executionResults.filter(r => r.status === 'success').length,
      failureCount: executionResults.filter(r => r.status === 'failed').length
    });

    return {
      executionResults,
      status: WORKFLOW_STATUS.COMPLETED
    };

  } catch (error) {
    logger.error('Failed to send commands', { 
      error: (error as Error).message,
      requestId: state.requestId
    });
    
    return {
      status: WORKFLOW_STATUS.ERROR,
      executionResults: []
    };
  }
}

// Helper function
function getConstitutionalPriority(proposal: any): number {
  switch (proposal.proposalType) {
    case 'stability':
    case 'emergency':
      return 1; // Safety priority
    case 'quality':
      return 2; // Quality priority
    case 'emissions':
      return 3; // Emissions priority
    case 'optimization':
      return 4; // Cost priority
    default:
      return 5;
  }
}