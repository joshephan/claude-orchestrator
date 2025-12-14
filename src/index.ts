/**
 * Claude Orchestrator - Main Entry Point
 *
 * This module exports the main orchestrator functionality and
 * sets up the CLI application using Commander.js.
 */

import { Command } from 'commander';
import {
  initCommand,
  startCommand,
  statusCommand,
  logsCommand,
  stopCommand,
  resumeCommand,
} from './cli/commands.js';
import { APP_NAME, APP_VERSION, APP_DESCRIPTION, EXAMPLES } from './config/defaults.js';
import type { StartOptions, LogsOptions, Platform } from './types.js';

// ============================================================================
// CLI Setup
// ============================================================================

/**
 * Create and configure the CLI program
 *
 * @returns Configured Commander program
 */
export function createProgram(): Command {
  const program = new Command();

  // Program metadata
  program
    .name(APP_NAME)
    .version(APP_VERSION)
    .description(APP_DESCRIPTION);

  // Init command
  program
    .command('init [directory]')
    .description('Initialize orchestrator in a project directory')
    .action(async (directory?: string) => {
      await initCommand(directory);
    });

  // Start command
  program
    .command('start')
    .description('Start the orchestration process')
    .option('-s, --scope <scope>', 'Development scope description')
    .option('-g, --goals <goals>', 'Comma-separated development goals')
    .option('-m, --max-tasks <n>', 'Maximum tasks per cycle', parseInt)
    .option('-p, --platform <platform>', 'Target platform (android, ios, web, custom)')
    .option('-c, --continuous', 'Enable continuous discovery mode')
    .option('-d, --dry-run', 'Preview without execution')
    .option('--skip-permissions', 'Skip Claude permission prompts')
    .option('-q, --quiet', 'Quiet mode - minimal output (default: verbose)')
    .action(async (options: {
      scope?: string;
      goals?: string;
      maxTasks?: number;
      platform?: string;
      continuous?: boolean;
      dryRun?: boolean;
      skipPermissions?: boolean;
      quiet?: boolean;
    }) => {
      const startOptions: StartOptions = {
        scope: options.scope,
        goals: options.goals,
        maxTasks: options.maxTasks,
        platform: options.platform as Platform,
        continuous: options.continuous,
        dryRun: options.dryRun,
        skipPermissions: options.skipPermissions,
        quiet: options.quiet,
      };
      await startCommand(startOptions);
    });

  // Status command
  program
    .command('status')
    .description('Show current orchestration status')
    .action(async () => {
      await statusCommand();
    });

  // Logs command
  program
    .command('logs')
    .description('View development logs')
    .option('-t, --tail <n>', 'Show last n lines', parseInt)
    .option('-f, --follow', 'Stream new log entries')
    .option('--task <id>', 'Filter by task ID')
    .action(async (options: {
      tail?: number;
      follow?: boolean;
      task?: string;
    }) => {
      const logsOptions: LogsOptions = {
        tail: options.tail,
        follow: options.follow,
        task: options.task,
      };
      await logsCommand(logsOptions);
    });

  // Stop command
  program
    .command('stop')
    .description('Stop running orchestration')
    .action(async () => {
      await stopCommand();
    });

  // Resume command
  program
    .command('resume')
    .description('Resume from last checkpoint')
    .action(async () => {
      await resumeCommand();
    });

  // Add examples to help
  program.addHelpText('after', `
Examples:
${EXAMPLES.map((e) => `  $ ${e.command}\n    ${e.description}`).join('\n\n')}
  `);

  return program;
}

/**
 * Run the CLI application
 *
 * @param args - Command line arguments (defaults to process.argv)
 */
export async function run(args: string[] = process.argv): Promise<void> {
  const program = createProgram();

  try {
    await program.parseAsync(args);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// ============================================================================
// Module Exports
// ============================================================================

// Re-export types
export * from './types.js';

// Re-export core functionality
export {
  validateEnvironment,
  isClaudeReady,
} from './core/validator.js';

export {
  initProject,
  loadConfig,
  updateConfig,
  loadStatus,
  saveStatus,
  checkInitialized,
  updateOrchestratorStatus,
  updateAgentStatus,
  getProjectOrchestratorDir,
  getProjectFilePath,
} from './core/project.js';

export {
  loadQueue,
  addTask,
  getPendingTasks,
  getQueueStats,
  updateTaskStatus,
  completeTask,
} from './core/queue.js';

export {
  processTask,
  processTaskV2,
  runTeamLead,
  runDeveloper,
  runReview,
  runPlanner,
  runDesigner,
  runTechLead,
  runDesignVerification,
} from './core/agent.js';

// Re-export utilities
export { logger } from './utils/logger.js';
export * from './utils/files.js';
export {
  DEFAULT_TIMEOUT,
  registerProcess,
  unregisterProcess,
  getProcess,
  hasActiveProcesses,
  killAllProcesses,
  runClaudeAgent,
  runCommand,
  setupShutdownHandlers,
  writePidFile,
  readPidFile,
  removePidFile,
  isProcessRunning,
} from './utils/process.js';

// Re-export UI components
export * as ui from './cli/ui.js';

// Re-export prompts
export {
  selectProjectDirectory,
  promptForConfiguration,
  confirm,
} from './cli/prompts.js';

// Re-export agent builders
export * from './agents/planner.js';
export * from './agents/designer.js';
export * from './agents/team-lead.js';
export * from './agents/developer.js';
export * from './agents/discovery.js';

// Re-export design utilities
export * from './utils/figma.js';
export * from './utils/css-extractor.js';
export * from './utils/design-comparator.js';

// Re-export config
export * from './config/defaults.js';

// ============================================================================
// Main Entry Point
// ============================================================================

// Run CLI if this is the main module
// Note: This check works in ESM when running directly with Node.js
const isMainModule = import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`;

if (isMainModule) {
  run().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
