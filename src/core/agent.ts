/**
 * Agent management module
 *
 * Handles spawning and coordinating Claude agents for
 * team lead and developer roles.
 */

import path from 'path';
import { runClaudeAgent, setupShutdownHandlers, killAllProcesses } from '../utils/process.js';
import { getFilePath, readJSON, writeJSON, resolvePath } from '../utils/files.js';
import { logger } from '../utils/logger.js';
import { updateAgentStatus, loadStatus, saveStatus } from './project.js';
import { updateTaskStatus, setCurrentTask, completeTask, rejectTask } from './queue.js';
import type {
  Task,
  Platform,
  OrchestratorConfig,
  MessageFile,
  TaskAssignmentMessage,
  CompletionReportMessage,
  AgentResult,
  CycleStats,
} from '../types.js';

// ============================================================================
// Constants
// ============================================================================

/** Default timeout for team lead (5 minutes) */
const TEAM_LEAD_TIMEOUT = 5 * 60 * 1000;

/** Default timeout for developer (15 minutes) */
const DEVELOPER_TIMEOUT = 15 * 60 * 1000;

/** Default timeout for review (3 minutes) */
const REVIEW_TIMEOUT = 3 * 60 * 1000;

// ============================================================================
// Message File Operations
// ============================================================================

/**
 * Clear messages for an agent
 *
 * @param projectPath - Path to the project
 * @param target - Which message file to clear
 */
async function clearMessages(
  projectPath: string,
  target: 'toDeveloper' | 'toTeamLead'
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
  target: 'toDeveloper' | 'toTeamLead'
): Promise<MessageFile> {
  const absolutePath = resolvePath(projectPath);
  return readJSON<MessageFile>(getFilePath(absolutePath, target));
}

/**
 * Write a message to a message file
 *
 * @param projectPath - Path to the project
 * @param target - Which message file to write to
 * @param message - Message to write
 */
async function writeMessage(
  projectPath: string,
  target: 'toDeveloper' | 'toTeamLead',
  message: TaskAssignmentMessage | CompletionReportMessage
): Promise<void> {
  const absolutePath = resolvePath(projectPath);
  const messageFile = await readMessages(projectPath, target);
  messageFile.messages.push(message);
  await writeJSON(getFilePath(absolutePath, target), messageFile);
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
${path.join(projectPath, '.claude-orchestrator', 'tasks', 'messages', 'to-developer.json')}

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
${instructions.filesToCreate.map((f) => `- ${f}`).join('\n')}

## Architecture Pattern
${instructions.architecture}

${instructions.apiEndpoints ? `## API Endpoints\n${instructions.apiEndpoints.map((e) => `- ${e}`).join('\n')}` : ''}

## Your Responsibilities
1. Implement the task following the instructions exactly
2. Create all specified files
3. Follow the architecture pattern
4. Test your implementation by running a build check
5. Report completion with details

## Output
After implementation, you MUST write your completion report to:
${path.join(projectPath, '.claude-orchestrator', 'tasks', 'messages', 'to-team-lead.json')}

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
- **Summary**: ${report.summary}
- **Files Created**: ${report.filesCreated.join(', ')}
- **Files Modified**: ${report.filesModified.join(', ')}
- **Build Status**: ${report.buildResult.status}
- **Build Errors**: ${report.buildResult.errors}

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
 * Process a single task through the full pipeline
 *
 * @param projectPath - Path to the project
 * @param task - Task to process
 * @param config - Project configuration
 * @param skipPermissions - Whether to skip permission prompts
 * @returns Whether task was completed successfully
 */
export async function processTask(
  projectPath: string,
  task: Task,
  config: OrchestratorConfig,
  skipPermissions = false
): Promise<boolean> {
  logger.info(`Processing task: ${task.id} - ${task.title}`);

  try {
    // Set as current task
    await setCurrentTask(projectPath, task.id);
    await updateTaskStatus(projectPath, task.id, 'in_progress');

    // Phase 1: Team Lead assignment
    const teamLeadResult = await runTeamLead(projectPath, task, config, skipPermissions);
    if (!teamLeadResult.success) {
      logger.error(`Team Lead failed for ${task.id}`);
      return false;
    }

    // Phase 2: Developer implementation
    const developerResult = await runDeveloper(projectPath, task, config, skipPermissions);
    if (!developerResult.success) {
      logger.error(`Developer failed for ${task.id}`);
      return false;
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

      return true;
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

      return false;
    }
  } catch (error) {
    logger.error(`Error processing task ${task.id}: ${error}`);
    return false;
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
