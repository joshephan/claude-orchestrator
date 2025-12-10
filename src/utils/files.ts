/**
 * File system utility module
 *
 * Provides helper functions for file operations including
 * JSON reading/writing, path manipulation, and directory management.
 */

import fs from 'fs-extra';
import path from 'path';

// ============================================================================
// Constants
// ============================================================================

/** Name of the orchestrator directory */
export const ORCHESTRATOR_DIR = '.claude-orchestrator';

/** File paths within the orchestrator directory */
export const FILES = {
  config: 'config.json',
  status: 'status.json',
  queue: 'queue.json',
  toDeveloper: 'messages/to-developer.json',
  toTeamLead: 'messages/to-team-lead.json',
  log: 'logs/log.md',
} as const;

// ============================================================================
// Path Helpers
// ============================================================================

/**
 * Get the full path to the orchestrator directory for a project
 *
 * @param projectPath - Root path of the project
 * @returns Full path to the orchestrator directory
 */
export function getOrchestratorDir(projectPath: string): string {
  return path.join(projectPath, ORCHESTRATOR_DIR);
}

/**
 * Get the full path to a file within the orchestrator directory
 *
 * @param projectPath - Root path of the project
 * @param file - File key from FILES constant
 * @returns Full path to the file
 */
export function getFilePath(
  projectPath: string,
  file: keyof typeof FILES
): string {
  return path.join(projectPath, ORCHESTRATOR_DIR, FILES[file]);
}

/**
 * Check if a project has been initialized with the orchestrator
 *
 * @param projectPath - Root path of the project
 * @returns Whether the project has an orchestrator directory
 */
export async function isInitialized(projectPath: string): Promise<boolean> {
  const configPath = getFilePath(projectPath, 'config');
  return fs.pathExists(configPath);
}

// ============================================================================
// JSON Operations
// ============================================================================

/**
 * Read and parse a JSON file
 *
 * @param filePath - Path to the JSON file
 * @returns Parsed JSON content
 * @throws Error if file doesn't exist or is invalid JSON
 */
export async function readJSON<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * Read a JSON file, returning a default value if it doesn't exist
 *
 * @param filePath - Path to the JSON file
 * @param defaultValue - Default value if file doesn't exist
 * @returns Parsed JSON content or default value
 */
export async function readJSONSafe<T>(
  filePath: string,
  defaultValue: T
): Promise<T> {
  try {
    const exists = await fs.pathExists(filePath);
    if (!exists) {
      return defaultValue;
    }
    return await readJSON<T>(filePath);
  } catch {
    return defaultValue;
  }
}

/**
 * Write data to a JSON file with pretty formatting
 *
 * @param filePath - Path to the JSON file
 * @param data - Data to write
 */
export async function writeJSON<T>(filePath: string, data: T): Promise<void> {
  // Ensure directory exists
  await fs.ensureDir(path.dirname(filePath));

  // Write with pretty formatting
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Update a JSON file by reading, modifying, and writing back
 *
 * @param filePath - Path to the JSON file
 * @param updater - Function to modify the data
 */
export async function updateJSON<T>(
  filePath: string,
  updater: (data: T) => T
): Promise<void> {
  const data = await readJSON<T>(filePath);
  const updated = updater(data);
  await writeJSON(filePath, updated);
}

// ============================================================================
// Directory Operations
// ============================================================================

/**
 * Initialize the orchestrator directory structure
 *
 * @param projectPath - Root path of the project
 */
export async function initDirectoryStructure(projectPath: string): Promise<void> {
  const orchestratorDir = getOrchestratorDir(projectPath);

  // Create directory structure
  await fs.ensureDir(path.join(orchestratorDir, 'messages'));
  await fs.ensureDir(path.join(orchestratorDir, 'logs'));
}

/**
 * Clean up temporary files in the orchestrator directory
 *
 * @param projectPath - Root path of the project
 */
export async function cleanupTemp(projectPath: string): Promise<void> {
  const orchestratorDir = getOrchestratorDir(projectPath);
  const tempDir = path.join(orchestratorDir, 'temp');

  if (await fs.pathExists(tempDir)) {
    await fs.remove(tempDir);
  }
}

// ============================================================================
// File Content Helpers
// ============================================================================

/**
 * Read a text file's content
 *
 * @param filePath - Path to the file
 * @returns File content as string
 */
export async function readText(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8');
}

/**
 * Read a text file safely, returning empty string if not found
 *
 * @param filePath - Path to the file
 * @returns File content or empty string
 */
export async function readTextSafe(filePath: string): Promise<string> {
  try {
    if (!(await fs.pathExists(filePath))) {
      return '';
    }
    return await readText(filePath);
  } catch {
    return '';
  }
}

/**
 * Write text content to a file
 *
 * @param filePath - Path to the file
 * @param content - Content to write
 */
export async function writeText(filePath: string, content: string): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Append text content to a file
 *
 * @param filePath - Path to the file
 * @param content - Content to append
 */
export async function appendText(filePath: string, content: string): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
  await fs.appendFile(filePath, content, 'utf-8');
}

// ============================================================================
// Project Detection
// ============================================================================

/**
 * Detect project name from package.json
 *
 * @param projectPath - Root path of the project
 * @returns Project name or directory name as fallback
 */
export async function detectProjectName(projectPath: string): Promise<string> {
  const packageJsonPath = path.join(projectPath, 'package.json');

  try {
    if (await fs.pathExists(packageJsonPath)) {
      const packageJson = await readJSON<{ name?: string }>(packageJsonPath);
      if (packageJson.name) {
        return packageJson.name;
      }
    }
  } catch {
    // Ignore errors, use fallback
  }

  // Fallback to directory name
  return path.basename(projectPath);
}

/**
 * Check if a directory looks like a valid project
 *
 * @param dirPath - Path to check
 * @returns Whether the directory appears to be a project
 */
export async function isValidProject(dirPath: string): Promise<boolean> {
  // Check for common project indicators
  const indicators = [
    'package.json',
    'tsconfig.json',
    'Cargo.toml',
    'go.mod',
    'requirements.txt',
    'pom.xml',
    'build.gradle',
    '.git',
  ];

  for (const indicator of indicators) {
    if (await fs.pathExists(path.join(dirPath, indicator))) {
      return true;
    }
  }

  return false;
}

/**
 * List subdirectories in a directory
 *
 * @param dirPath - Path to list
 * @returns Array of subdirectory names
 */
export async function listDirectories(dirPath: string): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();
}

/**
 * Get absolute path, resolving relative paths from cwd
 *
 * @param inputPath - Path to resolve
 * @returns Absolute path
 */
export function resolvePath(inputPath: string): string {
  return path.isAbsolute(inputPath)
    ? inputPath
    : path.resolve(process.cwd(), inputPath);
}
