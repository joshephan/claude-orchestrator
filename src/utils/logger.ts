/**
 * Logger utility module
 *
 * Provides structured logging with levels, colors, and file output.
 * Supports both console and file-based logging with automatic rotation.
 */

import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import type { LogLevel, LogEntry } from '../types.js';

// ============================================================================
// Constants
// ============================================================================

/** Maximum log file size before rotation (100KB) */
const MAX_LOG_SIZE = 100 * 1024;

/** Log level colors */
const LEVEL_COLORS: Record<LogLevel, (text: string) => string> = {
  debug: chalk.gray,
  info: chalk.blue,
  warn: chalk.yellow,
  error: chalk.red,
};

/** Log level prefixes */
const LEVEL_PREFIXES: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: 'INFO ',
  warn: 'WARN ',
  error: 'ERROR',
};

// ============================================================================
// Logger Class
// ============================================================================

/**
 * Logger class for structured logging
 */
export class Logger {
  private logDir: string | null = null;
  private logFile: string | null = null;
  private minLevel: LogLevel = 'info';
  private silent: boolean = false;

  /**
   * Initialize the logger with a log directory
   *
   * @param logDir - Directory to store log files
   */
  async init(logDir: string): Promise<void> {
    this.logDir = logDir;
    this.logFile = path.join(logDir, 'log.md');

    // Ensure log directory exists
    await fs.ensureDir(logDir);

    // Check if log rotation is needed
    await this.checkRotation();
  }

  /**
   * Set the minimum log level
   *
   * @param level - Minimum level to log
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Set silent mode (no console output)
   *
   * @param silent - Whether to suppress console output
   */
  setSilent(silent: boolean): void {
    this.silent = silent;
  }

  /**
   * Log a debug message
   *
   * @param message - Message to log
   * @param context - Optional context data
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  /**
   * Log an info message
   *
   * @param message - Message to log
   * @param context - Optional context data
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  /**
   * Log a warning message
   *
   * @param message - Message to log
   * @param context - Optional context data
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  /**
   * Log an error message
   *
   * @param message - Message to log
   * @param context - Optional context data
   */
  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  /**
   * Core logging function
   *
   * @param level - Log level
   * @param message - Message to log
   * @param context - Optional context data
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): void {
    // Check if level should be logged
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
    };

    // Console output
    if (!this.silent) {
      this.consoleLog(entry);
    }

    // File output (async, don't await)
    if (this.logFile) {
      this.fileLog(entry).catch((err) => {
        console.error('Failed to write log:', err);
      });
    }
  }

  /**
   * Check if a level should be logged based on minimum level
   *
   * @param level - Level to check
   * @returns Whether the level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  /**
   * Output log entry to console with formatting
   *
   * @param entry - Log entry to output
   */
  private consoleLog(entry: LogEntry): void {
    const colorFn = LEVEL_COLORS[entry.level];
    const prefix = LEVEL_PREFIXES[entry.level];
    const timestamp = chalk.gray(this.formatTime(entry.timestamp));
    const levelStr = colorFn(`[${prefix}]`);
    const message = entry.level === 'error' ? chalk.red(entry.message) : entry.message;

    console.log(`${timestamp} ${levelStr} ${message}`);

    // Log context if present
    if (entry.context && Object.keys(entry.context).length > 0) {
      console.log(chalk.gray('  Context:'), entry.context);
    }
  }

  /**
   * Write log entry to file
   *
   * @param entry - Log entry to write
   */
  private async fileLog(entry: LogEntry): Promise<void> {
    if (!this.logFile) return;

    // Check rotation before writing
    await this.checkRotation();

    const line = `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}\n`;
    await fs.appendFile(this.logFile, line);
  }

  /**
   * Check if log rotation is needed and perform if necessary
   */
  private async checkRotation(): Promise<void> {
    if (!this.logFile || !this.logDir) return;

    try {
      const exists = await fs.pathExists(this.logFile);
      if (!exists) return;

      const stats = await fs.stat(this.logFile);
      if (stats.size < MAX_LOG_SIZE) return;

      // Rotate log file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedFile = path.join(this.logDir, `log-${timestamp}.md`);
      await fs.rename(this.logFile, rotatedFile);

      // Create new log file with header
      const header = `# Development Log\n\nRotated from: ${rotatedFile}\n\n---\n\n`;
      await fs.writeFile(this.logFile, header);
    } catch {
      // Ignore rotation errors
    }
  }

  /**
   * Format timestamp for console output
   *
   * @param isoString - ISO timestamp string
   * @returns Formatted time string
   */
  private formatTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  /**
   * Log a task completion entry to the markdown log
   *
   * @param taskId - Task ID
   * @param title - Task title
   * @param platform - Target platform
   * @param priority - Task priority
   * @param summary - Implementation summary
   * @param filesCreated - List of created files
   * @param filesModified - List of modified files
   * @param buildStatus - Build verification status
   * @param reviewStatus - Review result
   */
  async logTaskCompletion(
    taskId: string,
    title: string,
    platform: string,
    priority: string,
    summary: string,
    filesCreated: string[],
    filesModified: string[],
    buildStatus: string,
    reviewStatus: 'approved' | 'rejected',
    rejectionReason?: string
  ): Promise<void> {
    if (!this.logFile) return;

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].slice(0, 5);

    const statusEmoji = reviewStatus === 'approved' ? 'Completed' : 'Rejected';
    const statusIcon = reviewStatus === 'approved' ? '✅' : '❌';

    let entry = `\n## [${dateStr} ${timeStr}] Task ${statusEmoji}: ${title}\n\n`;
    entry += `**Task ID:** ${taskId}\n`;
    entry += `**Platform:** ${platform.toUpperCase()}\n`;
    entry += `**Priority:** ${priority}\n\n`;
    entry += `### Summary\n${summary}\n\n`;

    if (filesCreated.length > 0 || filesModified.length > 0) {
      entry += `### Files\n`;
      if (filesCreated.length > 0) {
        entry += `**Created:**\n${filesCreated.map((f) => `- ${f}`).join('\n')}\n`;
      }
      if (filesModified.length > 0) {
        entry += `**Modified:**\n${filesModified.map((f) => `- ${f}`).join('\n')}\n`;
      }
      entry += '\n';
    }

    entry += `### Build Verification\n- Status: ${buildStatus}\n\n`;
    entry += `### Review Status\n${statusIcon} ${reviewStatus.charAt(0).toUpperCase() + reviewStatus.slice(1)}`;

    if (rejectionReason) {
      entry += `\n- Reason: ${rejectionReason}`;
    }

    entry += '\n\n---\n';

    await fs.appendFile(this.logFile, entry);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/** Global logger instance */
export const logger = new Logger();

export default logger;
