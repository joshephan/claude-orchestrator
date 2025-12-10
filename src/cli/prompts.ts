/**
 * Interactive prompts module
 *
 * Handles user input through interactive CLI prompts
 * for configuration and project selection.
 */

import inquirer from 'inquirer';
import path from 'path';
import { listDirectories, isValidProject } from '../utils/files.js';
import type { Platform, OrchestratorConfig } from '../types.js';

// ============================================================================
// Project Selection
// ============================================================================

/**
 * Prompt user to select a project directory
 *
 * @param startDir - Starting directory for browsing
 * @returns Selected project path
 */
export async function selectProjectDirectory(startDir = process.cwd()): Promise<string> {
  let currentDir = startDir;

  while (true) {
    const dirs = await listDirectories(currentDir);
    const choices = [
      { name: '📁 [Select this directory]', value: '__SELECT__' },
      { name: '📂 [Go up one level]', value: '__UP__' },
      { name: '📝 [Enter path manually]', value: '__MANUAL__' },
      ...dirs.map((d) => ({ name: `   ${d}/`, value: d })),
    ];

    const { selection } = await inquirer.prompt<{ selection: string }>([
      {
        type: 'list',
        name: 'selection',
        message: `Current: ${currentDir}\nSelect project directory:`,
        choices,
        pageSize: 15,
      },
    ]);

    if (selection === '__SELECT__') {
      // Check if valid project
      if (await isValidProject(currentDir)) {
        return currentDir;
      }

      const { confirmAnyway } = await inquirer.prompt<{ confirmAnyway: boolean }>([
        {
          type: 'confirm',
          name: 'confirmAnyway',
          message: 'This directory does not appear to be a project. Continue anyway?',
          default: false,
        },
      ]);

      if (confirmAnyway) {
        return currentDir;
      }
    } else if (selection === '__UP__') {
      currentDir = path.dirname(currentDir);
    } else if (selection === '__MANUAL__') {
      const { manualPath } = await inquirer.prompt<{ manualPath: string }>([
        {
          type: 'input',
          name: 'manualPath',
          message: 'Enter project path:',
          default: currentDir,
        },
      ]);
      return path.resolve(manualPath);
    } else {
      currentDir = path.join(currentDir, selection);
    }
  }
}

// ============================================================================
// Configuration Prompts
// ============================================================================

/**
 * Prompt user for development scope and goals
 *
 * @param existingConfig - Optional existing configuration to edit
 * @returns Configuration updates
 */
export async function promptForConfiguration(
  existingConfig?: Partial<OrchestratorConfig>
): Promise<{
  scope: string;
  goals: string[];
  platform: Platform;
  maxTasks: number;
  continuous: boolean;
}> {
  const answers = await inquirer.prompt<{
    scope: string;
    goalsInput: string;
    platform: Platform;
    maxTasks: number;
    continuous: boolean;
  }>([
    {
      type: 'input',
      name: 'scope',
      message: 'Development scope (describe what you want to build):',
      default: existingConfig?.scope || '',
      validate: (input) => (input.trim() ? true : 'Scope is required'),
    },
    {
      type: 'input',
      name: 'goalsInput',
      message: 'Development goals (comma-separated):',
      default: existingConfig?.goals?.join(', ') || '',
      validate: (input) => (input.trim() ? true : 'At least one goal is required'),
    },
    {
      type: 'list',
      name: 'platform',
      message: 'Target platform:',
      choices: [
        { name: 'Web (JavaScript/TypeScript)', value: 'web' },
        { name: 'Android (Kotlin)', value: 'android' },
        { name: 'iOS (Swift)', value: 'ios' },
        { name: 'Custom', value: 'custom' },
      ],
      default: existingConfig?.platform || 'web',
    },
    {
      type: 'number',
      name: 'maxTasks',
      message: 'Maximum tasks per cycle:',
      default: existingConfig?.maxTasks || 10,
      validate: (input) => (input > 0 && input <= 50 ? true : 'Must be between 1 and 50'),
    },
    {
      type: 'confirm',
      name: 'continuous',
      message: 'Enable continuous mode (auto-discover and implement)?',
      default: existingConfig?.continuous || false,
    },
  ]);

  return {
    scope: answers.scope.trim(),
    goals: answers.goalsInput.split(',').map((g) => g.trim()).filter(Boolean),
    platform: answers.platform,
    maxTasks: answers.maxTasks,
    continuous: answers.continuous,
  };
}

/**
 * Prompt for quick start configuration (minimal prompts)
 *
 * @returns Quick start configuration
 */
export async function promptQuickStart(): Promise<{
  scope: string;
  goals: string[];
}> {
  const answers = await inquirer.prompt<{
    scope: string;
    goalsInput: string;
  }>([
    {
      type: 'input',
      name: 'scope',
      message: 'What do you want to build?',
      validate: (input) => (input.trim() ? true : 'Please describe what you want to build'),
    },
    {
      type: 'input',
      name: 'goalsInput',
      message: 'List your main goals (comma-separated):',
      validate: (input) => (input.trim() ? true : 'Please enter at least one goal'),
    },
  ]);

  return {
    scope: answers.scope.trim(),
    goals: answers.goalsInput.split(',').map((g) => g.trim()).filter(Boolean),
  };
}

// ============================================================================
// Confirmation Prompts
// ============================================================================

/**
 * Prompt for confirmation
 *
 * @param message - Confirmation message
 * @param defaultValue - Default value
 * @returns User's confirmation
 */
export async function confirm(message: string, defaultValue = true): Promise<boolean> {
  const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
    {
      type: 'confirm',
      name: 'confirmed',
      message,
      default: defaultValue,
    },
  ]);
  return confirmed;
}

/**
 * Prompt for single choice selection
 *
 * @param message - Selection message
 * @param choices - Available choices
 * @returns Selected value
 */
export async function select<T extends string>(
  message: string,
  choices: Array<{ name: string; value: T }>
): Promise<T> {
  const { selection } = await inquirer.prompt<{ selection: T }>([
    {
      type: 'list',
      name: 'selection',
      message,
      choices,
    },
  ]);
  return selection;
}

/**
 * Prompt for text input
 *
 * @param message - Input message
 * @param defaultValue - Default value
 * @returns User input
 */
export async function input(message: string, defaultValue = ''): Promise<string> {
  const { value } = await inquirer.prompt<{ value: string }>([
    {
      type: 'input',
      name: 'value',
      message,
      default: defaultValue,
    },
  ]);
  return value.trim();
}

// ============================================================================
// Task Prompts
// ============================================================================

/**
 * Prompt user to add a new task
 *
 * @returns Task data or null if cancelled
 */
export async function promptNewTask(): Promise<{
  type: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
} | null> {
  const { addTask } = await inquirer.prompt<{ addTask: boolean }>([
    {
      type: 'confirm',
      name: 'addTask',
      message: 'Would you like to add a new task?',
      default: true,
    },
  ]);

  if (!addTask) {
    return null;
  }

  const answers = await inquirer.prompt<{
    type: string;
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }>([
    {
      type: 'list',
      name: 'type',
      message: 'Task type:',
      choices: [
        { name: 'Feature Implementation', value: 'feature_implementation' },
        { name: 'Bug Fix', value: 'bug_fix' },
        { name: 'Refactoring', value: 'refactoring' },
        { name: 'Documentation', value: 'documentation' },
        { name: 'Testing', value: 'testing' },
        { name: 'Other', value: 'other' },
      ],
    },
    {
      type: 'input',
      name: 'title',
      message: 'Task title:',
      validate: (input) => (input.trim() ? true : 'Title is required'),
    },
    {
      type: 'editor',
      name: 'description',
      message: 'Task description (opens editor):',
    },
    {
      type: 'list',
      name: 'priority',
      message: 'Priority:',
      choices: [
        { name: 'High', value: 'high' },
        { name: 'Medium', value: 'medium' },
        { name: 'Low', value: 'low' },
      ],
      default: 'medium',
    },
  ]);

  return answers;
}

// ============================================================================
// Interactive Mode
// ============================================================================

/**
 * Wait for a single keypress
 *
 * @returns Pressed key
 */
export function waitForKey(): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const onData = (key: string) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);

      // Handle Ctrl+C
      if (key === '\u0003') {
        process.exit(0);
      }

      resolve(key.toLowerCase());
    };

    stdin.on('data', onData);
  });
}

/**
 * Prompt for action during orchestration
 *
 * @returns Selected action
 */
export async function promptAction(): Promise<'logs' | 'status' | 'pause' | 'quit' | 'help' | 'continue'> {
  const key = await waitForKey();

  switch (key) {
    case 'l':
      return 'logs';
    case 's':
      return 'status';
    case 'p':
      return 'pause';
    case 'q':
      return 'quit';
    case 'h':
    case '?':
      return 'help';
    default:
      return 'continue';
  }
}
