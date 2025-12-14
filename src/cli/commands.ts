/**
 * CLI command handlers module
 *
 * Implements the logic for each CLI command including
 * init, start, status, logs, stop, and resume.
 */

import path from 'path';
import fs from 'fs-extra';
import { logger } from '../utils/logger.js';
import { resolvePath, readTextSafe } from '../utils/files.js';
import { setupShutdownHandlers, killAllProcesses, readPidFile, writePidFile, removePidFile, isProcessRunning } from '../utils/process.js';
import { validateEnvironment, allValid, getFirstError } from '../core/validator.js';
import { initProject, loadConfig, updateConfig, loadStatus, updateOrchestratorStatus, checkInitialized, getProjectFilePath } from '../core/project.js';
import { loadQueue, getPendingTasks, getInProgressTasks, getQueueStats } from '../core/queue.js';
import { processTaskV2, updateCycleStats, runDiscovery } from '../core/agent.js';
import { selectProjectDirectory, promptForConfiguration, confirm } from './prompts.js';
import * as ui from './ui.js';
import type { StartOptions, LogsOptions, Platform } from '../types.js';

// ============================================================================
// Init Command
// ============================================================================

/**
 * Initialize a project with the orchestrator
 *
 * @param directory - Optional directory to initialize
 */
export async function initCommand(directory?: string): Promise<void> {
  ui.showHeader();
  ui.showSection('Project Initialization');

  // Validate environment
  ui.startSpinner('Checking environment...');
  const validations = await validateEnvironment(true); // Skip auth check for init

  if (!allValid(validations)) {
    ui.spinnerFail('Environment check failed');
    ui.showValidationResults(validations);
    const error = getFirstError(validations);
    if (error) {
      process.exit(1);
    }
  }
  ui.spinnerSuccess('Environment check passed');

  // Select or use provided directory
  let projectPath: string;
  if (directory) {
    projectPath = resolvePath(directory);
  } else {
    ui.showInfo('Select a project directory to initialize:');
    projectPath = await selectProjectDirectory();
  }

  // Check if already initialized
  if (await checkInitialized(projectPath)) {
    const reinit = await confirm('Project is already initialized. Reinitialize?', false);
    if (!reinit) {
      ui.showInfo('Initialization cancelled.');
      return;
    }
    // Remove existing orchestrator directory
    const orchestratorDir = path.join(projectPath, '.claude-orchestrator');
    await fs.remove(orchestratorDir);
  }

  // Initialize project
  ui.startSpinner('Initializing project...');
  try {
    const config = await initProject(projectPath);
    ui.spinnerSuccess('Project initialized');

    ui.showSection('Configuration');
    ui.showSuccess(`Project: ${config.project.name}`);
    ui.showInfo(`Path: ${config.project.path}`);
    ui.showInfo(`Orchestrator directory: ${path.join(projectPath, '.claude-orchestrator')}`);

    console.log();
    ui.showInfo('Next steps:');
    console.log('  1. Run "claude-orchestrator start" to begin orchestration');
    console.log('  2. Or run "claude-orchestrator start --scope <scope> --goals <goals>"');
  } catch (error) {
    ui.spinnerFail('Initialization failed');
    ui.showError('Failed to initialize project', error);
    process.exit(1);
  }
}

// ============================================================================
// Start Command
// ============================================================================

/**
 * Start the orchestration process
 *
 * @param options - Start command options
 */
export async function startCommand(options: StartOptions): Promise<void> {
  ui.showHeader();
  ui.showSection('Starting Orchestration');

  // Validate environment
  ui.startSpinner('Validating environment...');
  const validations = await validateEnvironment();

  if (!allValid(validations)) {
    ui.spinnerFail('Environment validation failed');
    ui.showValidationResults(validations);
    process.exit(1);
  }
  ui.spinnerSuccess('Environment validated');

  // Check project initialization
  const projectPath = process.cwd();
  if (!(await checkInitialized(projectPath))) {
    ui.showError('Project not initialized. Run "claude-orchestrator init" first.');
    process.exit(1);
  }

  // Load configuration
  let config = await loadConfig(projectPath);

  // Check if already running
  const status = await loadStatus(projectPath);
  if (status.orchestrator.running && status.orchestrator.pid) {
    if (isProcessRunning(status.orchestrator.pid)) {
      ui.showError('Orchestrator is already running.');
      ui.showInfo(`PID: ${status.orchestrator.pid}`);
      process.exit(1);
    }
  }

  // Get configuration from options or prompts
  if (options.scope || options.goals) {
    // Use command line options
    const updates: Partial<typeof config> = {};
    if (options.scope) updates.scope = options.scope;
    if (options.goals) {
      updates.goals = options.goals.split(',').map((g) => g.trim());
    }
    if (options.platform) updates.platform = options.platform as Platform;
    if (options.maxTasks) updates.maxTasks = options.maxTasks;
    if (options.continuous !== undefined) updates.continuous = options.continuous;

    config = await updateConfig(projectPath, updates);
  } else if (!config.scope || config.goals.length === 0) {
    // Prompt for configuration
    ui.showSection('Configure Development');
    const configUpdates = await promptForConfiguration(config);
    config = await updateConfig(projectPath, configUpdates);
  }

  // Show configuration
  ui.showSection('Configuration');
  console.log(`  Project: ${config.project.name}`);
  console.log(`  Scope: ${config.scope}`);
  console.log(`  Goals: ${config.goals.join(', ')}`);
  console.log(`  Platform: ${config.platform}`);
  console.log(`  Max tasks: ${config.maxTasks}`);
  console.log(`  Continuous: ${config.continuous}`);

  // Dry run check
  if (options.dryRun) {
    ui.showSection('Dry Run');
    ui.showInfo('Would start orchestration with the above configuration.');
    ui.showInfo('No changes will be made.');
    return;
  }

  // Initialize logger
  const logDir = path.join(projectPath, '.claude-orchestrator', 'logs');
  await logger.init(logDir);

  // Setup shutdown handlers
  const pidFile = path.join(projectPath, '.claude-orchestrator', 'orchestrator.pid');
  setupShutdownHandlers(async () => {
    await updateOrchestratorStatus(projectPath, false);
    await removePidFile(pidFile);
  });

  // Mark as running
  await writePidFile(pidFile);
  await updateOrchestratorStatus(projectPath, true, process.pid);

  // Start orchestration
  ui.showSection('Orchestration Started');
  ui.showInteractiveHelp();

  let cycle = 0;
  let shouldContinue = true;
  const skipPermissions = options.skipPermissions ?? false;

  try {
    while (shouldContinue) {
      cycle++;
      logger.info(`Starting cycle ${cycle}`);
      ui.showProgress(`Cycle ${cycle} started`);

      // Get tasks to process
      const pendingTasks = await getPendingTasks(projectPath);
      const inProgressTasks = await getInProgressTasks(projectPath);
      const tasksToProcess = [...inProgressTasks, ...pendingTasks].slice(0, config.maxTasks);

      if (tasksToProcess.length === 0) {
        // Run discovery to create tasks
        ui.startSpinner('Running discovery agent... (analyzing project and creating tasks)');
        const discoveryResult = await runDiscovery(projectPath, config, skipPermissions);

        if (!discoveryResult.success) {
          ui.spinnerFail('Discovery failed');
          ui.showError('Discovery error', discoveryResult.error);
          if (!config.continuous) {
            break;
          }
        } else {
          ui.spinnerSuccess('Discovery completed');
        }

        // Re-check for tasks after discovery
        const newPendingTasks = await getPendingTasks(projectPath);
        if (newPendingTasks.length === 0) {
          if (config.continuous) {
            ui.showInfo('No tasks created. Waiting for new tasks...');
            await sleep(30000);
            continue;
          } else {
            ui.showInfo('No tasks to process after discovery.');
            break;
          }
        }

        // Continue with newly discovered tasks
        tasksToProcess.push(...newPendingTasks.slice(0, config.maxTasks));
        ui.showSuccess(`Discovery found ${newPendingTasks.length} task(s)`);
      }

      ui.showProgress(`Processing ${tasksToProcess.length} task(s)`);

      let completed = 0;
      let failed = 0;

      for (const task of tasksToProcess) {
        ui.startSpinner(`Processing: ${task.id} - ${task.title}`);

        const result = await processTaskV2(projectPath, task, config, skipPermissions);

        if (result.success) {
          completed++;
          ui.spinnerSuccess(`Task ${task.id} completed`);

          // Show design verification result if available
          if (result.designVerification) {
            const dv = result.designVerification;
            if (dv.discrepancies.length > 0) {
              ui.showWarning(
                `Design verification: ${dv.matchPercentage.toFixed(0)}% match, ${dv.discrepancies.length} discrepancy(ies) found`
              );
            }
          }
        } else {
          failed++;
          ui.spinnerFail(`Task ${task.id} failed`);
          if (result.error) {
            ui.showError(`  Phase: ${result.phase || 'unknown'}`, result.error);
          }
        }
      }

      // Update cycle stats
      const remaining = (await getPendingTasks(projectPath)).length;
      await updateCycleStats(projectPath, cycle, completed, failed, remaining);

      ui.showProgress(`Cycle ${cycle} completed`, { completed, failed, remaining });

      // Check if should continue
      if (!config.continuous && remaining === 0) {
        shouldContinue = false;
      }

      // Small delay between cycles
      if (shouldContinue) {
        await sleep(5000);
      }
    }
  } catch (error) {
    logger.error('Orchestration error', { error: String(error) });
    ui.showError('Orchestration error', error);
  } finally {
    // Cleanup
    await updateOrchestratorStatus(projectPath, false);
    await removePidFile(pidFile);
    killAllProcesses();
  }

  ui.showSection('Orchestration Complete');
  const stats = await getQueueStats(projectPath);
  ui.showQueueStats(stats);
}

// ============================================================================
// Status Command
// ============================================================================

/**
 * Show current orchestration status
 */
export async function statusCommand(): Promise<void> {
  ui.showHeader();

  const projectPath = process.cwd();

  if (!(await checkInitialized(projectPath))) {
    ui.showError('Project not initialized. Run "claude-orchestrator init" first.');
    process.exit(1);
  }

  try {
    const status = await loadStatus(projectPath);
    const stats = await getQueueStats(projectPath);

    // Check if orchestrator process is actually running
    const pidFile = getProjectFilePath(projectPath, 'pid');
    const pid = await readPidFile(pidFile);
    const actuallyRunning = pid !== null && isProcessRunning(pid);

    // Update status if mismatch
    if (status.orchestrator.running !== actuallyRunning) {
      status.orchestrator.running = actuallyRunning;
      if (!actuallyRunning) {
        status.orchestrator.pid = null;
      }
    }

    ui.showStatus(status, actuallyRunning);
    ui.showQueueStats(stats);

    // Show recent tasks
    ui.showSection('Recent Tasks');
    const queue = await loadQueue(projectPath);
    const recentTasks = [...queue.tasks].slice(0, 5);
    ui.showTaskTable(recentTasks, 'Pending/In Progress');

    if (queue.completed.length > 0) {
      console.log();
      const recentCompleted = [...queue.completed].slice(-5).reverse();
      ui.showTaskTable(recentCompleted, 'Recently Completed');
    }
  } catch (error) {
    ui.showError('Failed to load status', error);
    process.exit(1);
  }
}

// ============================================================================
// Logs Command
// ============================================================================

/**
 * View development logs
 *
 * @param options - Logs command options
 */
export async function logsCommand(options: LogsOptions): Promise<void> {
  const projectPath = process.cwd();

  if (!(await checkInitialized(projectPath))) {
    ui.showError('Project not initialized. Run "claude-orchestrator init" first.');
    process.exit(1);
  }

  const logPath = getProjectFilePath(projectPath, 'log');
  const logContent = await readTextSafe(logPath);

  if (!logContent) {
    ui.showInfo('No log entries found.');
    return;
  }

  // Parse and filter logs
  let lines = logContent.split('\n');

  // Filter by task if specified
  if (options.task) {
    const taskLines: string[] = [];
    let inTask = false;

    for (const line of lines) {
      if (line.includes(`Task ID: ${options.task}`) || line.includes(`Task ID:** ${options.task}`)) {
        inTask = true;
      }
      if (inTask) {
        taskLines.push(line);
        if (line.startsWith('---')) {
          inTask = false;
        }
      }
    }
    lines = taskLines;
  }

  // Apply tail limit
  if (options.tail) {
    lines = lines.slice(-options.tail);
  }

  // Output
  if (lines.length === 0) {
    ui.showInfo('No matching log entries found.');
  } else {
    console.log(lines.join('\n'));
  }

  // Follow mode
  if (options.follow) {
    ui.showInfo('Watching for new log entries... (Ctrl+C to stop)');
    let lastSize = logContent.length;

    const watcher = setInterval(async () => {
      const newContent = await readTextSafe(logPath);
      if (newContent.length > lastSize) {
        const newPart = newContent.slice(lastSize);
        process.stdout.write(newPart);
        lastSize = newContent.length;
      }
    }, 1000);

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      clearInterval(watcher);
      console.log();
      process.exit(0);
    });

    // Keep process alive
    await new Promise(() => {});
  }
}

// ============================================================================
// Stop Command
// ============================================================================

/**
 * Stop running orchestration
 */
export async function stopCommand(): Promise<void> {
  ui.showHeader();
  ui.showSection('Stopping Orchestration');

  const projectPath = process.cwd();

  if (!(await checkInitialized(projectPath))) {
    ui.showError('Project not initialized.');
    process.exit(1);
  }

  const pidFile = path.join(projectPath, '.claude-orchestrator', 'orchestrator.pid');
  const pid = await readPidFile(pidFile);

  if (!pid) {
    ui.showInfo('Orchestrator is not running.');
    return;
  }

  if (!isProcessRunning(pid)) {
    ui.showInfo('Orchestrator process not found. Cleaning up...');
    await updateOrchestratorStatus(projectPath, false);
    await removePidFile(pidFile);
    return;
  }

  ui.startSpinner('Stopping orchestrator...');

  try {
    process.kill(pid, 'SIGTERM');
    await sleep(2000);

    if (isProcessRunning(pid)) {
      process.kill(pid, 'SIGKILL');
    }

    await updateOrchestratorStatus(projectPath, false);
    await removePidFile(pidFile);

    ui.spinnerSuccess('Orchestrator stopped');
  } catch (error) {
    ui.spinnerFail('Failed to stop orchestrator');
    ui.showError('Stop failed', error);
    process.exit(1);
  }
}

// ============================================================================
// Resume Command
// ============================================================================

/**
 * Resume orchestration from checkpoint
 */
export async function resumeCommand(): Promise<void> {
  ui.showHeader();
  ui.showSection('Resuming Orchestration');

  const projectPath = process.cwd();

  if (!(await checkInitialized(projectPath))) {
    ui.showError('Project not initialized. Run "claude-orchestrator init" first.');
    process.exit(1);
  }

  // Check for in-progress tasks
  const inProgressTasks = await getInProgressTasks(projectPath);

  if (inProgressTasks.length === 0) {
    ui.showInfo('No in-progress tasks to resume.');
    const pendingTasks = await getPendingTasks(projectPath);
    if (pendingTasks.length > 0) {
      ui.showInfo(`Found ${pendingTasks.length} pending task(s). Use "claude-orchestrator start" to process them.`);
    }
    return;
  }

  ui.showInfo(`Found ${inProgressTasks.length} in-progress task(s) to resume.`);

  // Start with resume flag
  await startCommand({ skipPermissions: true });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sleep for a specified duration
 *
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
