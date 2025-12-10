/**
 * Process management utility module
 *
 * Provides functions for spawning, managing, and terminating
 * child processes, particularly for Claude CLI agents.
 */

import { spawn, ChildProcess } from 'child_process';
import fs from 'fs-extra';
import type { SpawnOptions, AgentResult } from '../types.js';

// ============================================================================
// Constants
// ============================================================================

/** Default timeout for agent execution (15 minutes) */
export const DEFAULT_TIMEOUT = 15 * 60 * 1000;

/** Default tools allowed for Claude agent */
export const DEFAULT_ALLOWED_TOOLS = [
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',
  'Bash',
].join(',');

// ============================================================================
// Process Registry
// ============================================================================

/** Registry of active child processes */
const activeProcesses: Map<string, ChildProcess> = new Map();

/**
 * Register a process in the active processes map
 *
 * @param id - Process identifier
 * @param process - Child process to register
 */
export function registerProcess(id: string, process: ChildProcess): void {
  activeProcesses.set(id, process);
}

/**
 * Unregister a process from the active processes map
 *
 * @param id - Process identifier
 */
export function unregisterProcess(id: string): void {
  activeProcesses.delete(id);
}

/**
 * Get an active process by ID
 *
 * @param id - Process identifier
 * @returns Child process or undefined
 */
export function getProcess(id: string): ChildProcess | undefined {
  return activeProcesses.get(id);
}

/**
 * Check if any processes are currently running
 *
 * @returns Whether any processes are active
 */
export function hasActiveProcesses(): boolean {
  return activeProcesses.size > 0;
}

/**
 * Kill all active processes
 */
export function killAllProcesses(): void {
  for (const [id, process] of activeProcesses) {
    try {
      process.kill('SIGTERM');
    } catch {
      // Process may have already exited
    }
    activeProcesses.delete(id);
  }
}

// ============================================================================
// Claude CLI Execution
// ============================================================================

/**
 * Build the Claude CLI command arguments
 *
 * @param prompt - Prompt to send to Claude
 * @param options - Spawn options
 * @returns Array of command arguments
 */
function buildClaudeArgs(
  _prompt: string,
  options: SpawnOptions
): string[] {
  const args = [
    '-p', // Print mode
    '--output-format', 'text',
    '--allowedTools', DEFAULT_ALLOWED_TOOLS,
  ];

  if (options.skipPermissions) {
    args.push('--dangerously-skip-permissions');
  }

  return args;
}

/**
 * Run a Claude agent with a prompt
 *
 * @param id - Unique identifier for this agent run
 * @param prompt - Prompt to send to Claude
 * @param options - Spawn options
 * @returns Agent execution result
 */
export async function runClaudeAgent(
  id: string,
  prompt: string,
  options: SpawnOptions
): Promise<AgentResult> {
  return new Promise((resolve) => {
    const args = buildClaudeArgs(prompt, options);
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Build full command string to avoid deprecation warning
    const command = ['claude', ...args].join(' ');

    // Spawn the Claude process
    const proc = spawn(command, [], {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Register the process
    registerProcess(id, proc);

    // Handle stdout
    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    // Handle stderr
    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    // Send prompt via stdin
    proc.stdin?.write(prompt);
    proc.stdin?.end();

    // Set up timeout
    const timeoutId = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
    }, timeout);

    // Handle process exit
    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      unregisterProcess(id);

      if (timedOut) {
        resolve({
          success: false,
          output: stdout,
          error: 'Agent execution timed out',
          exitCode: -1,
        });
      } else {
        resolve({
          success: code === 0,
          output: stdout,
          error: stderr || undefined,
          exitCode: code ?? -1,
        });
      }
    });

    // Handle spawn errors
    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      unregisterProcess(id);

      resolve({
        success: false,
        output: stdout,
        error: err.message,
        exitCode: -1,
      });
    });
  });
}

/**
 * Run a shell command and capture output
 *
 * @param command - Command to run
 * @param cwd - Working directory
 * @param timeout - Timeout in milliseconds
 * @returns Command output and exit code
 */
export async function runCommand(
  command: string,
  cwd: string,
  timeout = 30000
): Promise<{ output: string; exitCode: number }> {
  return new Promise((resolve) => {
    let output = '';
    let timedOut = false;

    // Determine shell based on platform
    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'cmd' : '/bin/sh';
    const shellArgs = isWindows ? ['/c', command] : ['-c', command];

    const proc = spawn(shell, shellArgs, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.stdout?.on('data', (data: Buffer) => {
      output += data.toString();
    });

    proc.stderr?.on('data', (data: Buffer) => {
      output += data.toString();
    });

    const timeoutId = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
    }, timeout);

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      resolve({
        output: timedOut ? output + '\n[Timed out]' : output,
        exitCode: timedOut ? -1 : (code ?? -1),
      });
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      resolve({
        output: err.message,
        exitCode: -1,
      });
    });
  });
}

// ============================================================================
// Signal Handlers
// ============================================================================

/**
 * Set up graceful shutdown handlers
 *
 * @param cleanup - Optional cleanup function to run before exit
 */
export function setupShutdownHandlers(cleanup?: () => Promise<void>): void {
  const handleShutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down gracefully...`);

    // Kill all active processes
    killAllProcesses();

    // Run cleanup if provided
    if (cleanup) {
      try {
        await cleanup();
      } catch (err) {
        console.error('Cleanup error:', err);
      }
    }

    process.exit(0);
  };

  // Handle termination signals
  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  // Handle uncaught errors
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    killAllProcesses();
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
    killAllProcesses();
    process.exit(1);
  });
}

// ============================================================================
// Process ID Management
// ============================================================================

/**
 * Write the current process ID to a file
 *
 * @param pidFile - Path to the PID file
 */
export async function writePidFile(pidFile: string): Promise<void> {
  await fs.writeFile(pidFile, process.pid.toString(), 'utf-8');
}

/**
 * Read a process ID from a file
 *
 * @param pidFile - Path to the PID file
 * @returns Process ID or null if not found
 */
export async function readPidFile(pidFile: string): Promise<number | null> {
  try {
    const content = await fs.readFile(pidFile, 'utf-8');
    const pid = parseInt(content.trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

/**
 * Remove the PID file
 *
 * @param pidFile - Path to the PID file
 */
export async function removePidFile(pidFile: string): Promise<void> {
  try {
    await fs.remove(pidFile);
  } catch {
    // Ignore errors
  }
}

/**
 * Check if a process with the given PID is running
 *
 * @param pid - Process ID to check
 * @returns Whether the process is running
 */
export function isProcessRunning(pid: number): boolean {
  try {
    // Sending signal 0 doesn't kill the process, just checks if it exists
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
