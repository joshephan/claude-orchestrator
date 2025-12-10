/**
 * Default configuration values module
 *
 * Contains all default values and constants used throughout
 * the orchestrator application.
 */

import type { Platform } from '../types.js';

// ============================================================================
// Application Info
// ============================================================================

/** Application name */
export const APP_NAME = 'claude-orchestrator';

/** Application version */
export const APP_VERSION = '1.0.0';

/** Application description */
export const APP_DESCRIPTION = 'Stop developing. Let Claude Code handle everything.';

// ============================================================================
// Directory and File Names
// ============================================================================

/** Name of the orchestrator directory */
export const ORCHESTRATOR_DIR_NAME = '.claude-orchestrator';

/** File names within the orchestrator directory */
export const FILE_NAMES = {
  config: 'config.json',
  status: 'status.json',
  queue: 'queue.json',
  pid: 'orchestrator.pid',
  toDeveloper: 'messages/to-developer.json',
  toTeamLead: 'messages/to-team-lead.json',
  log: 'logs/log.md',
} as const;

/** Template file names */
export const TEMPLATE_NAMES = {
  teamLead: 'team-lead.md',
  developer: 'developer.md',
  protocol: 'protocol.md',
} as const;

// ============================================================================
// Timeouts
// ============================================================================

/** Default timeouts in milliseconds */
export const TIMEOUTS = {
  /** Team lead task assignment */
  teamLead: 5 * 60 * 1000, // 5 minutes

  /** Developer implementation */
  developer: 15 * 60 * 1000, // 15 minutes

  /** Task review */
  review: 3 * 60 * 1000, // 3 minutes

  /** Feature discovery */
  discovery: 10 * 60 * 1000, // 10 minutes

  /** Environment validation */
  validation: 30 * 1000, // 30 seconds

  /** Shell command execution */
  command: 60 * 1000, // 1 minute
} as const;

// ============================================================================
// Limits
// ============================================================================

/** Default limits */
export const LIMITS = {
  /** Maximum tasks per cycle */
  maxTasksPerCycle: 10,

  /** Maximum tasks from discovery per cycle */
  maxDiscoveryTasks: 5,

  /** Maximum log file size before rotation (bytes) */
  maxLogSize: 100 * 1024, // 100KB

  /** Maximum concurrent agents */
  maxConcurrentAgents: 1,

  /** Minimum Node.js version */
  minNodeVersion: 18,
} as const;

// ============================================================================
// Intervals
// ============================================================================

/** Default intervals in milliseconds */
export const INTERVALS = {
  /** Polling interval for status checks */
  poll: 5 * 1000, // 5 seconds

  /** Delay between cycles in continuous mode */
  cyclePause: 5 * 1000, // 5 seconds

  /** Delay when no tasks found in continuous mode */
  emptyQueuePause: 30 * 1000, // 30 seconds

  /** Log watch interval */
  logWatch: 1 * 1000, // 1 second
} as const;

// ============================================================================
// Claude CLI Configuration
// ============================================================================

/** Default allowed tools for Claude agent */
export const DEFAULT_ALLOWED_TOOLS = [
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',
  'Bash',
] as const;

/** Claude CLI command */
export const CLAUDE_COMMAND = 'claude';

/** Claude CLI installation command */
export const CLAUDE_INSTALL_COMMAND = 'npm install -g @anthropic-ai/claude-code';

// ============================================================================
// Platform Defaults
// ============================================================================

/** Default platform */
export const DEFAULT_PLATFORM: Platform = 'web';

/** Platform-specific configurations */
export const PLATFORM_CONFIG: Record<Platform, {
  language: string;
  framework: string;
  buildCommand: string;
  testCommand: string;
  sourceDir: string;
}> = {
  android: {
    language: 'Kotlin',
    framework: 'Jetpack Compose',
    buildCommand: 'cd android && ./gradlew compileDebugKotlin',
    testCommand: 'cd android && ./gradlew testDebugUnitTest',
    sourceDir: 'android/app/src/main/java',
  },
  ios: {
    language: 'Swift',
    framework: 'SwiftUI',
    buildCommand: 'cd ios && xcodebuild build -scheme App -destination "platform=iOS Simulator,name=iPhone 15"',
    testCommand: 'cd ios && xcodebuild test -scheme App -destination "platform=iOS Simulator,name=iPhone 15"',
    sourceDir: 'ios',
  },
  web: {
    language: 'TypeScript',
    framework: 'React/Next.js',
    buildCommand: 'npm run build',
    testCommand: 'npm test',
    sourceDir: 'src',
  },
  custom: {
    language: 'Various',
    framework: 'Custom',
    buildCommand: 'echo "Define build command"',
    testCommand: 'echo "Define test command"',
    sourceDir: 'src',
  },
};

// ============================================================================
// Task Defaults
// ============================================================================

/** Default task type */
export const DEFAULT_TASK_TYPE = 'feature_implementation';

/** Default task priority */
export const DEFAULT_TASK_PRIORITY = 'medium';

/** Task type descriptions */
export const TASK_TYPES = {
  feature_implementation: 'Implementation of a new feature',
  bug_fix: 'Fix for an existing bug',
  refactoring: 'Code refactoring without changing behavior',
  documentation: 'Documentation updates',
  testing: 'Adding or updating tests',
  other: 'Other task type',
} as const;

/** Priority weights for sorting */
export const PRIORITY_WEIGHTS: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

// ============================================================================
// Messages
// ============================================================================

/** User-facing messages */
export const MESSAGES = {
  notInitialized: 'Project not initialized. Run "claude-orchestrator init" first.',
  alreadyInitialized: 'Project is already initialized.',
  noTasks: 'No tasks to process.',
  noInProgressTasks: 'No in-progress tasks to resume.',
  claudeNotInstalled: 'Claude Code CLI is not installed.',
  claudeNotAuthenticated: 'Claude Code CLI is not authenticated.',
  orchestratorRunning: 'Orchestrator is already running.',
  orchestratorNotRunning: 'Orchestrator is not running.',
} as const;

// ============================================================================
// Help Text
// ============================================================================

/** Examples for CLI help */
export const EXAMPLES = [
  {
    command: 'claude-orchestrator init',
    description: 'Initialize orchestrator in current directory',
  },
  {
    command: 'claude-orchestrator start --scope "User auth" --goals "Login,Register"',
    description: 'Start with specific scope and goals',
  },
  {
    command: 'claude-orchestrator start --continuous',
    description: 'Start in continuous discovery mode',
  },
  {
    command: 'claude-orchestrator status',
    description: 'Check current orchestration status',
  },
  {
    command: 'claude-orchestrator logs --follow',
    description: 'Stream live log updates',
  },
  {
    command: 'claude-orchestrator stop',
    description: 'Stop running orchestration',
  },
  {
    command: 'claude-orchestrator resume',
    description: 'Resume from last checkpoint',
  },
] as const;
