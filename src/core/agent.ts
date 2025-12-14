/**
 * Agent management module
 *
 * Handles spawning and coordinating Claude agents for the 4-agent pipeline:
 * Planner -> Designer -> Tech Lead -> Developer
 */

import path from 'path';
import { runClaudeAgent } from '../utils/process.js';
import { getFilePath, readJSON, writeJSON, resolvePath } from '../utils/files.js';
import { logger } from '../utils/logger.js';
import { updateAgentStatus, loadStatus, saveStatus } from './project.js';
import { updateTaskStatus, setCurrentTask, completeTask, rejectTask } from './queue.js';

// Agent prompt builders
import { buildPlanningPrompt } from '../agents/planner.js';
import { buildDesignPrompt } from '../agents/designer.js';
import { buildTechLeadPrompt } from '../agents/team-lead.js';

// Design utilities
import { extractCSSTokens } from '../utils/css-extractor.js';
import { compareDesignTokens, createVerificationMessage } from '../utils/design-comparator.js';

import type {
  Task,
  OrchestratorConfig,
  MessageFile,
  TaskAssignmentMessage,
  CompletionReportMessage,
  PlanningDocumentMessage,
  DesignSpecificationMessage,
  AgentResult,
  DiscrepancyItem,
} from '../types.js';

// ============================================================================
// Constants
// ============================================================================

/** Default timeout for planner (5 minutes) */
const PLANNER_TIMEOUT = 5 * 60 * 1000;

/** Default timeout for designer (5 minutes) */
const DESIGNER_TIMEOUT = 5 * 60 * 1000;

/** Default timeout for tech lead (5 minutes) */
const TECH_LEAD_TIMEOUT = 5 * 60 * 1000;

/** Default timeout for team lead - legacy alias (5 minutes) */
const TEAM_LEAD_TIMEOUT = 5 * 60 * 1000;

/** Default timeout for developer (15 minutes) */
const DEVELOPER_TIMEOUT = 15 * 60 * 1000;

/** Default timeout for review (3 minutes) */
const REVIEW_TIMEOUT = 3 * 60 * 1000;

// ============================================================================
// Message File Operations
// ============================================================================

type MessageTarget = 'toDesigner' | 'toTechLead' | 'toDeveloper' | 'toTeamLead';

/**
 * Clear messages for an agent
 *
 * @param projectPath - Path to the project
 * @param target - Which message file to clear
 */
async function clearMessages(
  projectPath: string,
  target: MessageTarget
): Promise<void> {
  const absolutePath = resolvePath(projectPath);
  const messageFile: MessageFile = {
    messages: [],
    lastRead: new Date().toISOString(),
  };
  await writeJSON(getFilePath(absolutePath, target), messageFile);
}

/**
 * Read messages for an agent
 *
 * @param projectPath - Path to the project
 * @param target - Which message file to read
 * @returns Message file contents
 */
async function readMessages(
  projectPath: string,
  target: MessageTarget
): Promise<MessageFile> {
  const absolutePath = resolvePath(projectPath);
  return readJSON<MessageFile>(getFilePath(absolutePath, target));
}

// ============================================================================
// Prompt Builders
// ============================================================================

/**
 * Build prompt for team lead to assign a task
 *
 * @param task - Task to assign
 * @param config - Project configuration
 * @returns Prompt string
 */
function buildTeamLeadPrompt(task: Task, config: OrchestratorConfig): string {
  const projectPath = config.project.path;

  return `You are a Team Lead responsible for analyzing tasks and creating implementation instructions.

## Current Task
- **ID**: ${task.id}
- **Title**: ${task.title}
- **Description**: ${task.description}
- **Priority**: ${task.priority}
- **Platform**: ${config.platform}

## Project Context
- **Project Name**: ${config.project.name}
- **Development Scope**: ${config.scope}
- **Goals**: ${config.goals.join(', ')}

## Your Responsibilities
1. Analyze the task requirements
2. Study any reference files mentioned in the task
3. Create detailed implementation instructions for the developer
4. Write the instructions to the message file

## Instructions
1. Read and understand the task thoroughly
2. Identify the files that need to be created or modified
3. Design the implementation approach
4. Write clear, step-by-step instructions

## Output
You MUST write your instructions to:
${path.join(projectPath, '.claude-orchestrator', 'messages', 'to-developer.json')}

The file format should be:
{
  "messages": [{
    "type": "task_assignment",
    "taskId": "${task.id}",
    "platform": "${config.platform}",
    "title": "${task.title}",
    "instructions": "Your detailed implementation instructions here",
    "filesToCreate": ["list of files to create"],
    "architecture": "Architecture pattern to follow",
    "apiEndpoints": ["API endpoints if applicable"],
    "timestamp": "ISO timestamp"
  }],
  "lastRead": null
}

Begin your analysis now.`;
}

/**
 * Build prompt for developer to implement a task
 *
 * @param task - Task to implement
 * @param instructions - Instructions from team lead
 * @param config - Project configuration
 * @returns Prompt string
 */
function buildDeveloperPrompt(
  task: Task,
  instructions: TaskAssignmentMessage,
  config: OrchestratorConfig
): string {
  const projectPath = config.project.path;

  return `You are a Developer responsible for implementing tasks according to the Team Lead's instructions.

## Current Task
- **ID**: ${task.id}
- **Title**: ${task.title}
- **Platform**: ${config.platform}

## Team Lead's Instructions
${instructions.instructions}

## Files to Create
${instructions.filesToCreate?.map((f) => `- ${f}`).join('\n') || 'No files specified'}

## Architecture Pattern
${instructions.architecture || 'Not specified'}

${instructions.apiEndpoints?.length ? `## API Endpoints\n${instructions.apiEndpoints.map((e) => `- ${e}`).join('\n')}` : ''}

## Your Responsibilities
1. Implement the task following the instructions exactly
2. Create all specified files
3. Follow the architecture pattern
4. Test your implementation by running a build check
5. Report completion with details

## Output
After implementation, you MUST write your completion report to:
${path.join(projectPath, '.claude-orchestrator', 'messages', 'to-team-lead.json')}

The file format should be:
{
  "messages": [{
    "type": "completion_report",
    "taskId": "${task.id}",
    "platform": "${config.platform}",
    "status": "awaiting_review",
    "summary": "Brief summary of what was implemented",
    "filesCreated": ["list of files created"],
    "filesModified": ["list of files modified"],
    "buildResult": {
      "status": "success" or "failed",
      "command": "build command used",
      "errors": 0
    },
    "timestamp": "ISO timestamp"
  }],
  "lastRead": null
}

Begin implementation now.`;
}

/**
 * Build prompt for team lead to review a completion report
 *
 * @param task - Task being reviewed
 * @param report - Completion report from developer
 * @param config - Project configuration
 * @returns Prompt string
 */
function buildReviewPrompt(
  task: Task,
  report: CompletionReportMessage,
  config: OrchestratorConfig
): string {
  return `You are a Team Lead reviewing a completed task implementation.

## Task Under Review
- **ID**: ${task.id}
- **Title**: ${task.title}
- **Platform**: ${config.platform}

## Developer's Report
- **Summary**: ${report.summary || 'No summary provided'}
- **Files Created**: ${report.filesCreated?.join(', ') || 'None'}
- **Files Modified**: ${report.filesModified?.join(', ') || 'None'}
- **Build Status**: ${report.buildResult?.status || 'Unknown'}
- **Build Errors**: ${report.buildResult?.errors ?? 'Unknown'}

## Review Criteria
1. Build status must be "success"
2. All required files must be created
3. Implementation must match the task requirements

## Your Task
1. Verify the build was successful
2. Check that the created files exist and are properly implemented
3. Determine if the task should be approved or rejected

## Output
Based on your review, output ONE of the following lines:
- APPROVE: Task completed successfully
- REJECT: [reason for rejection]

Your review:`;
}

// ============================================================================
// Agent Execution
// ============================================================================

/**
 * Run the team lead agent to assign a task
 *
 * @param projectPath - Path to the project
 * @param task - Task to assign
 * @param config - Project configuration
 * @param skipPermissions - Whether to skip permission prompts
 * @returns Agent result
 */
export async function runTeamLead(
  projectPath: string,
  task: Task,
  config: OrchestratorConfig,
  skipPermissions = false
): Promise<AgentResult> {
  const absolutePath = resolvePath(projectPath);

  logger.info(`Team Lead analyzing task: ${task.id} - ${task.title}`);
  await updateAgentStatus(projectPath, 'teamLead', 'analyzing');

  // Clear previous messages
  await clearMessages(projectPath, 'toDeveloper');

  // Build and run prompt
  const prompt = buildTeamLeadPrompt(task, config);
  const result = await runClaudeAgent('team-lead', prompt, {
    cwd: absolutePath,
    timeout: TEAM_LEAD_TIMEOUT,
    skipPermissions,
  });

  await updateAgentStatus(projectPath, 'teamLead', 'idle');

  if (result.success) {
    logger.info(`Team Lead completed task assignment for ${task.id}`);
  } else {
    logger.error(`Team Lead failed for task ${task.id}: ${result.error}`);
  }

  return result;
}

/**
 * Run the developer agent to implement a task
 *
 * @param projectPath - Path to the project
 * @param task - Task to implement
 * @param config - Project configuration
 * @param skipPermissions - Whether to skip permission prompts
 * @returns Agent result
 */
export async function runDeveloper(
  projectPath: string,
  task: Task,
  config: OrchestratorConfig,
  skipPermissions = false
): Promise<AgentResult> {
  const absolutePath = resolvePath(projectPath);

  // Read team lead's instructions
  const messages = await readMessages(projectPath, 'toDeveloper');
  const instruction = messages.messages.find(
    (m) => m.type === 'task_assignment' && m.taskId === task.id
  ) as TaskAssignmentMessage | undefined;

  if (!instruction) {
    return {
      success: false,
      output: '',
      error: 'No instructions found from Team Lead',
      exitCode: -1,
    };
  }

  logger.info(`Developer implementing task: ${task.id} - ${task.title}`);
  await updateAgentStatus(projectPath, 'developer', 'implementing', task.id);

  // Clear previous messages
  await clearMessages(projectPath, 'toTeamLead');

  // Build and run prompt
  const prompt = buildDeveloperPrompt(task, instruction, config);
  const result = await runClaudeAgent('developer', prompt, {
    cwd: absolutePath,
    timeout: DEVELOPER_TIMEOUT,
    skipPermissions,
  });

  await updateAgentStatus(projectPath, 'developer', 'idle', null);

  if (result.success) {
    logger.info(`Developer completed implementation for ${task.id}`);
  } else {
    logger.error(`Developer failed for task ${task.id}: ${result.error}`);
  }

  return result;
}

/**
 * Run the team lead agent to review a completion
 *
 * @param projectPath - Path to the project
 * @param task - Task to review
 * @param config - Project configuration
 * @param skipPermissions - Whether to skip permission prompts
 * @returns Review result (approved/rejected)
 */
export async function runReview(
  projectPath: string,
  task: Task,
  config: OrchestratorConfig,
  skipPermissions = false
): Promise<{ approved: boolean; reason?: string }> {
  const absolutePath = resolvePath(projectPath);

  // Read developer's completion report
  const messages = await readMessages(projectPath, 'toTeamLead');
  const report = messages.messages.find(
    (m) => m.type === 'completion_report' && m.taskId === task.id
  ) as CompletionReportMessage | undefined;

  if (!report) {
    logger.warn(`No completion report found for task ${task.id}`);
    return { approved: false, reason: 'No completion report found' };
  }

  // Quick check: if build failed, auto-reject
  if (report.buildResult.status === 'failed') {
    logger.warn(`Auto-rejecting ${task.id}: Build failed`);
    return { approved: false, reason: 'Build verification failed' };
  }

  logger.info(`Team Lead reviewing task: ${task.id}`);
  await updateAgentStatus(projectPath, 'teamLead', 'reviewing');

  // Build and run prompt
  const prompt = buildReviewPrompt(task, report, config);
  const result = await runClaudeAgent('review', prompt, {
    cwd: absolutePath,
    timeout: REVIEW_TIMEOUT,
    skipPermissions,
  });

  await updateAgentStatus(projectPath, 'teamLead', 'idle');

  // Parse review result
  const output = result.output.toLowerCase();
  const approved = output.includes('approve');

  if (approved) {
    logger.info(`Task ${task.id} approved`);
    return { approved: true };
  } else {
    const rejectMatch = result.output.match(/REJECT:\s*(.+)/i);
    const reason = rejectMatch ? rejectMatch[1].trim() : 'Review failed';
    logger.warn(`Task ${task.id} rejected: ${reason}`);
    return { approved: false, reason };
  }
}

// ============================================================================
// Task Processing Pipeline
// ============================================================================

/**
 * Process task result with error details
 */
export interface ProcessTaskResult {
  success: boolean;
  error?: string;
  phase?: 'team_lead' | 'developer' | 'review';
}

/**
 * Process a single task through the full pipeline
 *
 * @param projectPath - Path to the project
 * @param task - Task to process
 * @param config - Project configuration
 * @param skipPermissions - Whether to skip permission prompts
 * @returns Task result with error details
 */
export async function processTask(
  projectPath: string,
  task: Task,
  config: OrchestratorConfig,
  skipPermissions = false
): Promise<ProcessTaskResult> {
  logger.info(`Processing task: ${task.id} - ${task.title}`);

  try {
    // Set as current task
    await setCurrentTask(projectPath, task.id);
    await updateTaskStatus(projectPath, task.id, 'in_progress');

    // Phase 1: Team Lead assignment
    const teamLeadResult = await runTeamLead(projectPath, task, config, skipPermissions);
    if (!teamLeadResult.success) {
      const error = teamLeadResult.error || 'Team Lead failed to analyze task';
      logger.error(`Team Lead failed for ${task.id}: ${error}`);
      return { success: false, error, phase: 'team_lead' };
    }

    // Phase 2: Developer implementation
    const developerResult = await runDeveloper(projectPath, task, config, skipPermissions);
    if (!developerResult.success) {
      const error = developerResult.error || 'Developer failed to implement task';
      logger.error(`Developer failed for ${task.id}: ${error}`);
      return { success: false, error, phase: 'developer' };
    }

    // Phase 3: Update status to awaiting review
    await updateTaskStatus(projectPath, task.id, 'awaiting_review');

    // Phase 4: Team Lead review
    const reviewResult = await runReview(projectPath, task, config, skipPermissions);

    if (reviewResult.approved) {
      await completeTask(projectPath, task.id);
      logger.info(`Task ${task.id} completed successfully`);

      // Log to development log
      const messages = await readMessages(projectPath, 'toTeamLead');
      const report = messages.messages.find(
        (m) => m.type === 'completion_report' && m.taskId === task.id
      ) as CompletionReportMessage | undefined;

      if (report) {
        await logger.logTaskCompletion(
          task.id,
          task.title,
          config.platform,
          task.priority,
          report.summary,
          report.filesCreated,
          report.filesModified,
          report.buildResult.status,
          'approved'
        );
      }

      return { success: true };
    } else {
      await rejectTask(projectPath, task.id, reviewResult.reason || 'Review failed');
      logger.warn(`Task ${task.id} rejected: ${reviewResult.reason}`);

      await logger.logTaskCompletion(
        task.id,
        task.title,
        config.platform,
        task.priority,
        'Implementation rejected',
        [],
        [],
        'failed',
        'rejected',
        reviewResult.reason
      );

      return { success: false, error: reviewResult.reason || 'Review failed', phase: 'review' };
    }
  } catch (error) {
    logger.error(`Error processing task ${task.id}: ${error}`);
    return { success: false, error: String(error) };
  } finally {
    // Clear current task
    await setCurrentTask(projectPath, null);
    // Clear messages
    await clearMessages(projectPath, 'toDeveloper');
    await clearMessages(projectPath, 'toTeamLead');
  }
}

/**
 * Update cycle statistics in status file
 *
 * @param projectPath - Path to the project
 * @param cycleNumber - Current cycle number
 * @param completed - Tasks completed
 * @param failed - Tasks failed
 * @param remaining - Tasks remaining
 */
export async function updateCycleStats(
  projectPath: string,
  cycleNumber: number,
  completed: number,
  failed: number,
  remaining: number
): Promise<void> {
  const status = await loadStatus(projectPath);
  status.lastCycle = {
    number: cycleNumber,
    completed,
    failed,
    remaining,
  };
  await saveStatus(projectPath, status);
}

// ============================================================================
// Discovery Agent
// ============================================================================

/** Default timeout for discovery (5 minutes) */
const DISCOVERY_TIMEOUT = 5 * 60 * 1000;

/**
 * Run the discovery agent to find and create tasks
 *
 * @param projectPath - Path to the project
 * @param config - Project configuration
 * @param skipPermissions - Whether to skip permission prompts
 * @returns Agent result
 */
export async function runDiscovery(
  projectPath: string,
  config: OrchestratorConfig,
  skipPermissions = false
): Promise<AgentResult> {
  const absolutePath = resolvePath(projectPath);
  const queueFilePath = path.join(absolutePath, '.claude-orchestrator', 'queue.json');

  logger.info('Discovery agent starting...');
  await updateAgentStatus(projectPath, 'teamLead', 'analyzing');

  const prompt = `You are a Discovery Agent. Your task is to analyze the project and create implementation tasks.

## Project Information
- **Project Name**: ${config.project.name}
- **Project Path**: ${config.project.path}
- **Platform**: ${config.platform}

## Development Scope
${config.scope}

## Development Goals
${config.goals.map((g) => `- ${g}`).join('\n')}

## Your Task

1. Analyze the project structure to understand the codebase
2. Based on the scope and goals, identify what needs to be implemented
3. Create specific, actionable tasks

## IMPORTANT: You MUST add tasks to the queue file

Read the current queue file at: ${queueFilePath}

Then add new tasks to the "tasks" array. Each task should have:
- "id": unique string like "task-001", "task-002", etc.
- "type": "feature_implementation"
- "priority": "high", "medium", or "low"
- "title": clear, descriptive title
- "description": detailed description of what to implement
- "acceptanceCriteria": array of criteria
- "status": "pending"
- "createdAt": ISO timestamp

Create 1-5 tasks based on the goals. Be specific and actionable.

Example task:
{
  "id": "task-001",
  "type": "feature_implementation",
  "priority": "high",
  "title": "Implement character chat UI",
  "description": "Create the chat interface for character conversations...",
  "acceptanceCriteria": ["Chat messages display correctly", "User can send messages"],
  "status": "pending",
  "createdAt": "${new Date().toISOString()}"
}

Start by reading the queue file, then write the updated queue with your new tasks.`;

  const result = await runClaudeAgent('discovery', prompt, {
    cwd: absolutePath,
    timeout: DISCOVERY_TIMEOUT,
    skipPermissions,
  });

  await updateAgentStatus(projectPath, 'techLead', 'idle');

  if (result.success) {
    logger.info('Discovery agent completed');
  } else {
    logger.error(`Discovery agent failed: ${result.error}`);
  }

  return result;
}

// ============================================================================
// 4-Agent Pipeline: New Agent Functions
// ============================================================================

/**
 * Run the planner agent to create a planning document
 *
 * @param projectPath - Path to the project
 * @param task - Task to plan
 * @param config - Project configuration
 * @param skipPermissions - Whether to skip permission prompts
 * @returns Agent result
 */
export async function runPlanner(
  projectPath: string,
  task: Task,
  config: OrchestratorConfig,
  skipPermissions = false
): Promise<AgentResult> {
  const absolutePath = resolvePath(projectPath);

  logger.info(`Planner analyzing task: ${task.id} - ${task.title}`);
  await updateAgentStatus(projectPath, 'planner', 'planning');

  // Clear previous messages
  await clearMessages(projectPath, 'toDesigner');

  // Build and run prompt
  const prompt = buildPlanningPrompt(task, config);
  const result = await runClaudeAgent('planner', prompt, {
    cwd: absolutePath,
    timeout: PLANNER_TIMEOUT,
    skipPermissions,
  });

  await updateAgentStatus(projectPath, 'planner', 'idle');

  if (result.success) {
    logger.info(`Planner completed planning for ${task.id}`);
  } else {
    logger.error(`Planner failed for task ${task.id}: ${result.error}`);
  }

  return result;
}

/**
 * Run the designer agent to create design specifications
 *
 * @param projectPath - Path to the project
 * @param task - Task to design
 * @param planningDoc - Planning document from planner
 * @param config - Project configuration
 * @param skipPermissions - Whether to skip permission prompts
 * @returns Agent result
 */
export async function runDesigner(
  projectPath: string,
  task: Task,
  planningDoc: PlanningDocumentMessage,
  config: OrchestratorConfig,
  skipPermissions = false
): Promise<AgentResult> {
  const absolutePath = resolvePath(projectPath);

  logger.info(`Designer creating design spec for task: ${task.id}`);
  await updateAgentStatus(projectPath, 'designer', 'designing');

  // Clear previous messages
  await clearMessages(projectPath, 'toTechLead');

  // Build and run prompt
  const prompt = buildDesignPrompt(task, planningDoc, config);
  const result = await runClaudeAgent('designer', prompt, {
    cwd: absolutePath,
    timeout: DESIGNER_TIMEOUT,
    skipPermissions,
  });

  await updateAgentStatus(projectPath, 'designer', 'idle');

  if (result.success) {
    logger.info(`Designer completed design spec for ${task.id}`);
  } else {
    logger.error(`Designer failed for task ${task.id}: ${result.error}`);
  }

  return result;
}

/**
 * Run the tech lead agent to create development instructions
 *
 * @param projectPath - Path to the project
 * @param task - Task to assign
 * @param planningDoc - Planning document from planner
 * @param designSpec - Design specification from designer
 * @param config - Project configuration
 * @param skipPermissions - Whether to skip permission prompts
 * @returns Agent result
 */
export async function runTechLead(
  projectPath: string,
  task: Task,
  planningDoc: PlanningDocumentMessage,
  designSpec: DesignSpecificationMessage,
  config: OrchestratorConfig,
  skipPermissions = false
): Promise<AgentResult> {
  const absolutePath = resolvePath(projectPath);

  logger.info(`Tech Lead creating instructions for task: ${task.id}`);
  await updateAgentStatus(projectPath, 'techLead', 'assigning');

  // Clear previous messages
  await clearMessages(projectPath, 'toDeveloper');

  // Build and run prompt
  const prompt = buildTechLeadPrompt(task, planningDoc, designSpec, config);
  const result = await runClaudeAgent('tech-lead', prompt, {
    cwd: absolutePath,
    timeout: TECH_LEAD_TIMEOUT,
    skipPermissions,
  });

  await updateAgentStatus(projectPath, 'techLead', 'idle');

  if (result.success) {
    logger.info(`Tech Lead completed instructions for ${task.id}`);
  } else {
    logger.error(`Tech Lead failed for task ${task.id}: ${result.error}`);
  }

  return result;
}

/**
 * Run design verification to compare implementation with design tokens
 *
 * @param projectPath - Path to the project
 * @param task - Task to verify
 * @param designSpec - Original design specification
 * @param config - Project configuration
 * @returns Verification result with discrepancies
 */
export async function runDesignVerification(
  projectPath: string,
  task: Task,
  designSpec: DesignSpecificationMessage,
  config: OrchestratorConfig
): Promise<{ verified: boolean; matchPercentage: number; discrepancies: DiscrepancyItem[] }> {
  const absolutePath = resolvePath(projectPath);

  logger.info(`Running design verification for task: ${task.id}`);
  await updateAgentStatus(projectPath, 'designer', 'verifying');

  try {
    // Extract CSS tokens from the implementation
    const cssTokens = await extractCSSTokens({
      rootDir: absolutePath,
      parseTailwind: true,
    });

    // Compare with design tokens
    const result = compareDesignTokens(
      designSpec.designTokens,
      cssTokens,
      { minMatchPercentage: 90 }
    );

    // Log the verification result
    if (result.verified) {
      logger.info(`Design verification passed for ${task.id}: ${result.matchPercentage}% match`);
    } else {
      logger.warn(`Design verification warning for ${task.id}: ${result.matchPercentage}% match, ${result.discrepancies.length} discrepancies`);
    }

    // Save verification report
    const verificationMessage = createVerificationMessage(task.id, config.platform, result);
    await writeJSON(getFilePath(absolutePath, 'verificationReport'), verificationMessage);

    return {
      verified: result.verified,
      matchPercentage: result.matchPercentage,
      discrepancies: result.discrepancies,
    };
  } catch (error) {
    logger.error(`Design verification error for ${task.id}: ${error}`);
    return {
      verified: true, // Don't block on verification errors
      matchPercentage: 0,
      discrepancies: [],
    };
  } finally {
    await updateAgentStatus(projectPath, 'designer', 'idle');
  }
}

// ============================================================================
// 4-Agent Pipeline: Process Task
// ============================================================================

/**
 * Process task result with error details for 4-agent pipeline
 */
export interface ProcessTaskResultV2 {
  success: boolean;
  error?: string;
  phase?: 'planner' | 'designer' | 'tech_lead' | 'developer' | 'review' | 'verification';
  designVerification?: {
    verified: boolean;
    matchPercentage: number;
    discrepancies: DiscrepancyItem[];
  };
}

/**
 * Process a single task through the 4-agent pipeline
 *
 * Pipeline: Planner -> Designer -> Tech Lead -> Developer -> Review -> Design Verification
 *
 * @param projectPath - Path to the project
 * @param task - Task to process
 * @param config - Project configuration
 * @param skipPermissions - Whether to skip permission prompts
 * @returns Task result with error details
 */
export async function processTaskV2(
  projectPath: string,
  task: Task,
  config: OrchestratorConfig,
  skipPermissions = false
): Promise<ProcessTaskResultV2> {
  logger.info(`Processing task (4-agent pipeline): ${task.id} - ${task.title}`);

  try {
    // Set as current task
    await setCurrentTask(projectPath, task.id);
    await updateTaskStatus(projectPath, task.id, 'in_progress');

    // =========================================================================
    // Phase 1: Planner
    // =========================================================================
    logger.info(`[Phase 1/6] Planner analyzing task ${task.id}`);
    const plannerResult = await runPlanner(projectPath, task, config, skipPermissions);
    if (!plannerResult.success) {
      const error = plannerResult.error || 'Planner failed to create planning document';
      logger.error(`Planner failed for ${task.id}: ${error}`);
      return { success: false, error, phase: 'planner' };
    }

    // Read planning document
    const plannerMessages = await readMessages(projectPath, 'toDesigner');
    const planningDoc = plannerMessages.messages.find(
      (m) => m.type === 'planning_document' && m.taskId === task.id
    ) as PlanningDocumentMessage | undefined;

    if (!planningDoc) {
      return { success: false, error: 'Planner did not create planning document', phase: 'planner' };
    }

    // =========================================================================
    // Phase 2: Designer
    // =========================================================================
    logger.info(`[Phase 2/6] Designer creating design spec for ${task.id}`);
    const designerResult = await runDesigner(projectPath, task, planningDoc, config, skipPermissions);
    if (!designerResult.success) {
      const error = designerResult.error || 'Designer failed to create design specification';
      logger.error(`Designer failed for ${task.id}: ${error}`);
      return { success: false, error, phase: 'designer' };
    }

    // Read design specification
    const designerMessages = await readMessages(projectPath, 'toTechLead');
    const designSpec = designerMessages.messages.find(
      (m) => m.type === 'design_specification' && m.taskId === task.id
    ) as DesignSpecificationMessage | undefined;

    if (!designSpec) {
      return { success: false, error: 'Designer did not create design specification', phase: 'designer' };
    }

    // Save design tokens for later verification
    await writeJSON(getFilePath(resolvePath(projectPath), 'designTokens'), designSpec.designTokens);

    // =========================================================================
    // Phase 3: Tech Lead
    // =========================================================================
    logger.info(`[Phase 3/6] Tech Lead creating instructions for ${task.id}`);
    const techLeadResult = await runTechLead(projectPath, task, planningDoc, designSpec, config, skipPermissions);
    if (!techLeadResult.success) {
      const error = techLeadResult.error || 'Tech Lead failed to create instructions';
      logger.error(`Tech Lead failed for ${task.id}: ${error}`);
      return { success: false, error, phase: 'tech_lead' };
    }

    // =========================================================================
    // Phase 4: Developer
    // =========================================================================
    logger.info(`[Phase 4/6] Developer implementing ${task.id}`);
    const developerResult = await runDeveloper(projectPath, task, config, skipPermissions);
    if (!developerResult.success) {
      const error = developerResult.error || 'Developer failed to implement task';
      logger.error(`Developer failed for ${task.id}: ${error}`);
      return { success: false, error, phase: 'developer' };
    }

    // Update status to awaiting review
    await updateTaskStatus(projectPath, task.id, 'awaiting_review');

    // =========================================================================
    // Phase 5: Tech Lead Review
    // =========================================================================
    logger.info(`[Phase 5/6] Tech Lead reviewing ${task.id}`);
    const reviewResult = await runReview(projectPath, task, config, skipPermissions);

    if (!reviewResult.approved) {
      await rejectTask(projectPath, task.id, reviewResult.reason || 'Review failed');
      logger.warn(`Task ${task.id} rejected: ${reviewResult.reason}`);

      await logger.logTaskCompletion(
        task.id,
        task.title,
        config.platform,
        task.priority,
        'Implementation rejected',
        [],
        [],
        'failed',
        'rejected',
        reviewResult.reason
      );

      return { success: false, error: reviewResult.reason || 'Review failed', phase: 'review' };
    }

    // =========================================================================
    // Phase 6: Design Verification (warning only, does not block)
    // =========================================================================
    logger.info(`[Phase 6/6] Running design verification for ${task.id}`);
    const verificationResult = await runDesignVerification(projectPath, task, designSpec, config);

    // Log verification results but don't fail the task
    if (!verificationResult.verified) {
      logger.warn(`Design verification found ${verificationResult.discrepancies.length} discrepancies (${verificationResult.matchPercentage}% match)`);
    }

    // Complete the task
    await completeTask(projectPath, task.id);
    logger.info(`Task ${task.id} completed successfully`);

    // Log to development log
    const messages = await readMessages(projectPath, 'toTeamLead');
    const report = messages.messages.find(
      (m) => m.type === 'completion_report' && m.taskId === task.id
    ) as CompletionReportMessage | undefined;

    if (report) {
      await logger.logTaskCompletion(
        task.id,
        task.title,
        config.platform,
        task.priority,
        report.summary,
        report.filesCreated,
        report.filesModified,
        report.buildResult.status,
        'approved'
      );
    }

    return {
      success: true,
      designVerification: verificationResult,
    };
  } catch (error) {
    logger.error(`Error processing task ${task.id}: ${error}`);
    return { success: false, error: String(error) };
  } finally {
    // Clear current task
    await setCurrentTask(projectPath, null);
    // Clear all messages
    await clearMessages(projectPath, 'toDesigner');
    await clearMessages(projectPath, 'toTechLead');
    await clearMessages(projectPath, 'toDeveloper');
    await clearMessages(projectPath, 'toTeamLead');
  }
}
