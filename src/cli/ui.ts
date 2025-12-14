/**
 * Terminal UI utilities module
 *
 * Provides functions for displaying formatted output including
 * spinners, tables, boxes, and colored text.
 */

import chalk from 'chalk';
import ora, { Ora } from 'ora';
import Table from 'cli-table3';
import figures from 'figures';
import type { Task, StatusFile, ValidationResult } from '../types.js';

// ============================================================================
// Colors and Symbols
// ============================================================================

/** Status colors */
export const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  muted: chalk.gray,
  highlight: chalk.cyan,
  bold: chalk.bold,
};

/** Status symbols */
export const symbols = {
  success: chalk.green(figures.tick),
  error: chalk.red(figures.cross),
  warning: chalk.yellow(figures.warning),
  info: chalk.blue(figures.info),
  bullet: figures.bullet,
  arrow: figures.arrowRight,
  pointer: figures.pointer,
};

// ============================================================================
// Spinner Management
// ============================================================================

/** Active spinner instance */
let activeSpinner: Ora | null = null;

/**
 * Start a spinner with a message
 *
 * @param message - Spinner text
 * @returns Spinner instance
 */
export function startSpinner(message: string): Ora {
  if (activeSpinner) {
    activeSpinner.stop();
  }
  activeSpinner = ora(message).start();
  return activeSpinner;
}

/**
 * Stop the current spinner with success state
 *
 * @param message - Success message
 */
export function spinnerSuccess(message?: string): void {
  if (activeSpinner) {
    activeSpinner.succeed(message);
    activeSpinner = null;
  }
}

/**
 * Stop the current spinner with failure state
 *
 * @param message - Failure message
 */
export function spinnerFail(message?: string): void {
  if (activeSpinner) {
    activeSpinner.fail(message);
    activeSpinner = null;
  }
}

/**
 * Stop the current spinner with warning state
 *
 * @param message - Warning message
 */
export function spinnerWarn(message?: string): void {
  if (activeSpinner) {
    activeSpinner.warn(message);
    activeSpinner = null;
  }
}

/**
 * Update the current spinner text
 *
 * @param message - New message
 */
export function updateSpinner(message: string): void {
  if (activeSpinner) {
    activeSpinner.text = message;
  }
}

/**
 * Stop the current spinner without a state
 */
export function stopSpinner(): void {
  if (activeSpinner) {
    activeSpinner.stop();
    activeSpinner = null;
  }
}

// ============================================================================
// Header and Banners
// ============================================================================

/**
 * Display the application header
 */
export function showHeader(): void {
  console.log();
  console.log(colors.bold(colors.highlight('╔═══════════════════════════════════════════╗')));
  console.log(colors.bold(colors.highlight('║       Claude Orchestrator CLI             ║')));
  console.log(colors.bold(colors.highlight('║   Multi-Agent Development Automation      ║')));
  console.log(colors.bold(colors.highlight('╚═══════════════════════════════════════════╝')));
  console.log();
}

/**
 * Display a section header
 *
 * @param title - Section title
 */
export function showSection(title: string): void {
  console.log();
  console.log(colors.bold(colors.highlight(`── ${title} ──`)));
  console.log();
}

// ============================================================================
// Validation Display
// ============================================================================

/**
 * Display validation results
 *
 * @param results - Array of validation results
 */
export function showValidationResults(
  results: { label: string; result: ValidationResult }[]
): void {
  console.log();
  for (const { label, result } of results) {
    const symbol = result.valid ? symbols.success : symbols.error;
    const color = result.valid ? colors.success : colors.error;
    console.log(`  ${symbol} ${color(label)}`);

    if (!result.valid && result.suggestion) {
      console.log(colors.muted(`      ${result.suggestion}`));
    }
  }
  console.log();
}

// ============================================================================
// Status Display
// ============================================================================

/**
 * Display current orchestration status
 *
 * @param status - Status file contents
 * @param actuallyRunning - Whether the process is actually running (checked via PID)
 */
export function showStatus(status: StatusFile, actuallyRunning?: boolean): void {
  showSection('Orchestrator Status');

  // Orchestrator status - use actuallyRunning if provided, otherwise fallback to status file
  const orchRunning = actuallyRunning ?? status.orchestrator.running;
  const orchSymbol = orchRunning ? symbols.success : symbols.warning;
  const orchText = orchRunning ? colors.success('Running') : colors.warning('Stopped');
  console.log(`  ${orchSymbol} Orchestrator: ${colors.bold(orchText)}`);

  if (status.orchestrator.pid) {
    console.log(colors.muted(`      PID: ${status.orchestrator.pid}`));
  }
  if (status.orchestrator.startedAt) {
    console.log(colors.muted(`      Started: ${formatTime(status.orchestrator.startedAt)}`));
  }

  console.log();

  // Planner status
  const plannerStatus = status.planner.status;
  const plannerColor = plannerStatus === 'idle' ? colors.muted : colors.highlight;
  console.log(`  ${symbols.pointer} Planner: ${plannerColor(plannerStatus)}`);
  console.log(colors.muted(`      Last activity: ${formatTime(status.planner.lastActivity)}`));

  console.log();

  // Designer status
  const designerStatus = status.designer.status;
  const designerColor = designerStatus === 'idle' ? colors.muted : colors.highlight;
  console.log(`  ${symbols.pointer} Designer: ${designerColor(designerStatus)}`);
  console.log(colors.muted(`      Last activity: ${formatTime(status.designer.lastActivity)}`));

  console.log();

  // Tech Lead status
  const leadStatus = status.techLead.status;
  const leadColor = leadStatus === 'idle' ? colors.muted : colors.highlight;
  console.log(`  ${symbols.pointer} Tech Lead: ${leadColor(leadStatus)}`);
  console.log(colors.muted(`      Last activity: ${formatTime(status.techLead.lastActivity)}`));

  console.log();

  // Developer status
  const devStatus = status.developer.status;
  const devColor = devStatus === 'idle' ? colors.muted : colors.highlight;
  console.log(`  ${symbols.pointer} Developer: ${devColor(devStatus)}`);

  if (status.developer.currentTask) {
    console.log(colors.muted(`      Current task: ${status.developer.currentTask}`));
  }
  console.log(colors.muted(`      Last activity: ${formatTime(status.developer.lastActivity)}`));

  console.log();

  // Last cycle stats
  if (status.lastCycle) {
    showSection('Last Cycle Statistics');
    console.log(`  Cycle #${status.lastCycle.number}`);
    console.log(`    ${symbols.success} Completed: ${status.lastCycle.completed}`);
    console.log(`    ${symbols.error} Failed: ${status.lastCycle.failed}`);
    console.log(`    ${symbols.bullet} Remaining: ${status.lastCycle.remaining}`);
  }
}

// ============================================================================
// Task Display
// ============================================================================

/**
 * Display a table of tasks
 *
 * @param tasks - Array of tasks to display
 * @param title - Table title
 */
export function showTaskTable(tasks: Task[], title = 'Tasks'): void {
  if (tasks.length === 0) {
    console.log(colors.muted(`  No ${title.toLowerCase()} found.`));
    return;
  }

  const table = new Table({
    head: ['ID', 'Title', 'Priority', 'Status'].map((h) => colors.bold(h)),
    style: { head: [], border: [] },
    colWidths: [12, 40, 10, 15],
  });

  for (const task of tasks) {
    const statusColor = getStatusColor(task.status);
    table.push([
      task.id,
      truncate(task.title, 38),
      getPriorityDisplay(task.priority),
      statusColor(task.status),
    ]);
  }

  console.log(table.toString());
}

/**
 * Display a single task's details
 *
 * @param task - Task to display
 */
export function showTaskDetail(task: Task): void {
  showSection(`Task: ${task.id}`);

  console.log(`  ${colors.bold('Title:')} ${task.title}`);
  console.log(`  ${colors.bold('Type:')} ${task.type}`);
  console.log(`  ${colors.bold('Priority:')} ${getPriorityDisplay(task.priority)}`);
  console.log(`  ${colors.bold('Status:')} ${getStatusColor(task.status)(task.status)}`);
  console.log(`  ${colors.bold('Created:')} ${formatTime(task.createdAt)}`);

  if (task.updatedAt) {
    console.log(`  ${colors.bold('Updated:')} ${formatTime(task.updatedAt)}`);
  }

  console.log();
  console.log(`  ${colors.bold('Description:')}`);
  console.log(colors.muted(`    ${task.description}`));

  if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
    console.log();
    console.log(`  ${colors.bold('Acceptance Criteria:')}`);
    for (const criteria of task.acceptanceCriteria) {
      console.log(`    ${symbols.bullet} ${criteria}`);
    }
  }

  if (task.rejectionReason) {
    console.log();
    console.log(`  ${colors.bold(colors.error('Rejection Reason:'))}`);
    console.log(colors.error(`    ${task.rejectionReason}`));
  }
}

/**
 * Display queue statistics
 *
 * @param stats - Queue statistics
 */
export function showQueueStats(stats: {
  pending: number;
  inProgress: number;
  awaitingReview: number;
  completed: number;
  rejected: number;
  total: number;
}): void {
  showSection('Queue Statistics');

  const table = new Table({
    style: { head: [], border: [] },
  });

  table.push(
    [colors.muted('Pending'), colors.highlight(stats.pending.toString())],
    [colors.muted('In Progress'), colors.highlight(stats.inProgress.toString())],
    [colors.muted('Awaiting Review'), colors.highlight(stats.awaitingReview.toString())],
    [colors.muted('Rejected'), colors.error(stats.rejected.toString())],
    [colors.muted('Completed'), colors.success(stats.completed.toString())],
    ['', ''],
    [colors.bold('Total'), colors.bold(stats.total.toString())]
  );

  console.log(table.toString());
}

// ============================================================================
// Progress Display
// ============================================================================

/**
 * Display a progress update during orchestration
 *
 * @param message - Progress message
 * @param context - Optional context data
 */
export function showProgress(message: string, context?: Record<string, unknown>): void {
  const timestamp = colors.muted(`[${new Date().toLocaleTimeString()}]`);
  console.log(`${timestamp} ${message}`);

  if (context) {
    for (const [key, value] of Object.entries(context)) {
      console.log(colors.muted(`  ${key}: ${value}`));
    }
  }
}

/**
 * Display an error message
 *
 * @param message - Error message
 * @param error - Optional error object
 */
export function showError(message: string, error?: unknown): void {
  console.log();
  console.log(`${symbols.error} ${colors.error(message)}`);

  if (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(colors.muted(`  ${errorMessage}`));
  }
}

/**
 * Display a success message
 *
 * @param message - Success message
 */
export function showSuccess(message: string): void {
  console.log(`${symbols.success} ${colors.success(message)}`);
}

/**
 * Display a warning message
 *
 * @param message - Warning message
 */
export function showWarning(message: string): void {
  console.log(`${symbols.warning} ${colors.warning(message)}`);
}

/**
 * Display an info message
 *
 * @param message - Info message
 */
export function showInfo(message: string): void {
  console.log(`${symbols.info} ${colors.info(message)}`);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get color function for task status
 *
 * @param status - Task status
 * @returns Color function
 */
function getStatusColor(status: string): (text: string) => string {
  switch (status) {
    case 'completed':
      return colors.success;
    case 'rejected':
    case 'failed':
      return colors.error;
    case 'in_progress':
    case 'implementing':
      return colors.highlight;
    case 'awaiting_review':
      return colors.warning;
    default:
      return colors.muted;
  }
}

/**
 * Get display string for priority
 *
 * @param priority - Task priority
 * @returns Colored priority string
 */
function getPriorityDisplay(priority: string): string {
  switch (priority) {
    case 'high':
      return colors.error(priority);
    case 'medium':
      return colors.warning(priority);
    case 'low':
      return colors.muted(priority);
    default:
      return priority;
  }
}

/**
 * Format an ISO timestamp for display
 *
 * @param isoString - ISO timestamp string
 * @returns Formatted string
 */
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString();
}

/**
 * Truncate a string to a maximum length
 *
 * @param str - String to truncate
 * @param maxLength - Maximum length
 * @returns Truncated string
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

// ============================================================================
// Interactive Commands Help
// ============================================================================

/**
 * Show available interactive commands
 */
export function showInteractiveHelp(): void {
  console.log();
  console.log(colors.bold('Interactive Commands:'));
  console.log(`  ${colors.highlight('l')} or ${colors.highlight('logs')}    Show recent log entries`);
  console.log(`  ${colors.highlight('s')} or ${colors.highlight('status')}  Show current status`);
  console.log(`  ${colors.highlight('p')} or ${colors.highlight('pause')}   Pause after current task`);
  console.log(`  ${colors.highlight('q')} or ${colors.highlight('quit')}    Stop gracefully`);
  console.log(`  ${colors.highlight('h')} or ${colors.highlight('help')}    Show this help`);
  console.log();
}
