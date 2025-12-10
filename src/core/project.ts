/**
 * Project management module
 *
 * Handles project initialization, configuration loading/saving,
 * and directory structure management.
 */

import fs from 'fs-extra';
import {
  getOrchestratorDir,
  getFilePath,
  isInitialized,
  readJSON,
  writeJSON,
  initDirectoryStructure,
  detectProjectName,
  resolvePath,
} from '../utils/files.js';
import type {
  OrchestratorConfig,
  TaskQueue,
  StatusFile,
  MessageFile,
} from '../types.js';

// ============================================================================
// Default Values
// ============================================================================

/**
 * Create default configuration for a project
 *
 * @param projectPath - Absolute path to the project
 * @param projectName - Name of the project
 * @returns Default configuration
 */
function createDefaultConfig(
  projectPath: string,
  projectName: string
): OrchestratorConfig {
  return {
    project: {
      name: projectName,
      path: projectPath,
    },
    scope: '',
    goals: [],
    platform: 'web',
    maxTasks: 10,
    continuous: false,
    initialized: new Date().toISOString(),
  };
}

/**
 * Create default task queue
 *
 * @returns Default queue
 */
function createDefaultQueue(): TaskQueue {
  return {
    version: '1.0',
    tasks: [],
    completed: [],
    current: null,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Create default status file
 *
 * @returns Default status
 */
function createDefaultStatus(): StatusFile {
  return {
    orchestrator: {
      running: false,
      pid: null,
      startedAt: null,
    },
    teamLead: {
      status: 'idle',
      lastActivity: new Date().toISOString(),
    },
    developer: {
      status: 'idle',
      currentTask: null,
      lastActivity: new Date().toISOString(),
    },
    lastCycle: null,
  };
}

/**
 * Create default message file
 *
 * @returns Default message file
 */
function createDefaultMessageFile(): MessageFile {
  return {
    messages: [],
    lastRead: null,
  };
}

// ============================================================================
// Project Initialization
// ============================================================================

/**
 * Initialize a project with the orchestrator
 *
 * @param projectPath - Path to the project (can be relative)
 * @returns Configuration that was created
 */
export async function initProject(projectPath: string): Promise<OrchestratorConfig> {
  // Resolve to absolute path
  const absolutePath = resolvePath(projectPath);

  // Check if project exists
  if (!(await fs.pathExists(absolutePath))) {
    throw new Error(`Project directory does not exist: ${absolutePath}`);
  }

  // Check if already initialized
  if (await isInitialized(absolutePath)) {
    throw new Error('Project is already initialized. Use --force to reinitialize.');
  }

  // Detect project name
  const projectName = await detectProjectName(absolutePath);

  // Create directory structure
  await initDirectoryStructure(absolutePath);

  // Create default files
  const config = createDefaultConfig(absolutePath, projectName);
  const queue = createDefaultQueue();
  const status = createDefaultStatus();
  const messageFile = createDefaultMessageFile();

  // Write files
  await writeJSON(getFilePath(absolutePath, 'config'), config);
  await writeJSON(getFilePath(absolutePath, 'queue'), queue);
  await writeJSON(getFilePath(absolutePath, 'status'), status);
  await writeJSON(getFilePath(absolutePath, 'toDeveloper'), messageFile);
  await writeJSON(getFilePath(absolutePath, 'toTeamLead'), messageFile);

  // Create empty log file
  const logPath = getFilePath(absolutePath, 'log');
  const logHeader = `# Development Log\n\nProject: ${projectName}\nInitialized: ${config.initialized}\n\n---\n\n`;
  await fs.writeFile(logPath, logHeader, 'utf-8');

  return config;
}

/**
 * Force reinitialize a project (removes existing orchestrator directory)
 *
 * @param projectPath - Path to the project
 * @returns New configuration
 */
export async function reinitProject(projectPath: string): Promise<OrchestratorConfig> {
  const absolutePath = resolvePath(projectPath);
  const orchestratorDir = getOrchestratorDir(absolutePath);

  // Remove existing orchestrator directory
  if (await fs.pathExists(orchestratorDir)) {
    await fs.remove(orchestratorDir);
  }

  // Initialize fresh
  return initProject(projectPath);
}

// ============================================================================
// Configuration Management
// ============================================================================

/**
 * Load project configuration
 *
 * @param projectPath - Path to the project
 * @returns Configuration
 */
export async function loadConfig(projectPath: string): Promise<OrchestratorConfig> {
  const absolutePath = resolvePath(projectPath);

  if (!(await isInitialized(absolutePath))) {
    throw new Error('Project is not initialized. Run "claude-orchestrator init" first.');
  }

  return readJSON<OrchestratorConfig>(getFilePath(absolutePath, 'config'));
}

/**
 * Save project configuration
 *
 * @param projectPath - Path to the project
 * @param config - Configuration to save
 */
export async function saveConfig(
  projectPath: string,
  config: OrchestratorConfig
): Promise<void> {
  const absolutePath = resolvePath(projectPath);
  await writeJSON(getFilePath(absolutePath, 'config'), config);
}

/**
 * Update project configuration with partial values
 *
 * @param projectPath - Path to the project
 * @param updates - Partial configuration updates
 * @returns Updated configuration
 */
export async function updateConfig(
  projectPath: string,
  updates: Partial<OrchestratorConfig>
): Promise<OrchestratorConfig> {
  const config = await loadConfig(projectPath);
  const updated = { ...config, ...updates };
  await saveConfig(projectPath, updated);
  return updated;
}

// ============================================================================
// Status Management
// ============================================================================

/**
 * Load status file
 *
 * @param projectPath - Path to the project
 * @returns Status file contents
 */
export async function loadStatus(projectPath: string): Promise<StatusFile> {
  const absolutePath = resolvePath(projectPath);
  return readJSON<StatusFile>(getFilePath(absolutePath, 'status'));
}

/**
 * Save status file
 *
 * @param projectPath - Path to the project
 * @param status - Status to save
 */
export async function saveStatus(
  projectPath: string,
  status: StatusFile
): Promise<void> {
  const absolutePath = resolvePath(projectPath);
  await writeJSON(getFilePath(absolutePath, 'status'), status);
}

/**
 * Update orchestrator running status
 *
 * @param projectPath - Path to the project
 * @param running - Whether orchestrator is running
 * @param pid - Process ID if running
 */
export async function updateOrchestratorStatus(
  projectPath: string,
  running: boolean,
  pid: number | null = null
): Promise<void> {
  const status = await loadStatus(projectPath);
  status.orchestrator = {
    running,
    pid,
    startedAt: running ? new Date().toISOString() : null,
  };
  await saveStatus(projectPath, status);
}

/**
 * Update agent status
 *
 * @param projectPath - Path to the project
 * @param agent - Which agent to update
 * @param agentStatus - New status
 * @param currentTask - Current task ID (for developer)
 */
export async function updateAgentStatus(
  projectPath: string,
  agent: 'teamLead' | 'developer',
  agentStatus: string,
  currentTask?: string | null
): Promise<void> {
  const status = await loadStatus(projectPath);

  if (agent === 'teamLead') {
    status.teamLead = {
      status: agentStatus as StatusFile['teamLead']['status'],
      lastActivity: new Date().toISOString(),
    };
  } else {
    status.developer = {
      status: agentStatus as StatusFile['developer']['status'],
      currentTask: currentTask ?? status.developer.currentTask,
      lastActivity: new Date().toISOString(),
    };
  }

  await saveStatus(projectPath, status);
}

// ============================================================================
// Project Utilities
// ============================================================================

/**
 * Check if a project is initialized
 *
 * @param projectPath - Path to check
 * @returns Whether project is initialized
 */
export async function checkInitialized(projectPath: string): Promise<boolean> {
  const absolutePath = resolvePath(projectPath);
  return isInitialized(absolutePath);
}

/**
 * Get the orchestrator directory path for a project
 *
 * @param projectPath - Path to the project
 * @returns Orchestrator directory path
 */
export function getProjectOrchestratorDir(projectPath: string): string {
  const absolutePath = resolvePath(projectPath);
  return getOrchestratorDir(absolutePath);
}

/**
 * Get a specific file path within the orchestrator directory
 *
 * @param projectPath - Path to the project
 * @param file - File key
 * @returns Full path to the file
 */
export function getProjectFilePath(
  projectPath: string,
  file: 'config' | 'status' | 'queue' | 'pid' | 'toDeveloper' | 'toTeamLead' | 'log'
): string {
  const absolutePath = resolvePath(projectPath);
  return getFilePath(absolutePath, file);
}
