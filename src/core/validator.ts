/**
 * Environment validator module
 *
 * Validates that Claude Code CLI is installed and authenticated,
 * and checks other environment requirements.
 */

import { runCommand } from '../utils/process.js';
import type { ValidationResult } from '../types.js';

// ============================================================================
// Constants
// ============================================================================

/** Minimum required Node.js version */
const MIN_NODE_VERSION = 18;

/** Claude CLI installation command */
const CLAUDE_INSTALL_CMD = 'npm install -g @anthropic-ai/claude-code';

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Check if Node.js version meets minimum requirements
 *
 * @returns Validation result
 */
export function validateNodeVersion(): ValidationResult {
  const version = process.versions.node;
  const major = parseInt(version.split('.')[0], 10);

  if (major < MIN_NODE_VERSION) {
    return {
      valid: false,
      error: `Node.js ${MIN_NODE_VERSION} or higher is required. Current version: ${version}`,
      suggestion: `Please upgrade Node.js to version ${MIN_NODE_VERSION} or higher.`,
    };
  }

  return { valid: true };
}

/**
 * Check if Claude Code CLI is installed
 *
 * @returns Validation result with installation status
 */
export async function validateClaudeInstalled(): Promise<ValidationResult> {
  try {
    // Try to get Claude version
    const { exitCode } = await runCommand('claude --version', process.cwd(), 10000);

    if (exitCode !== 0) {
      return {
        valid: false,
        error: 'Claude Code CLI is not installed or not in PATH.',
        suggestion: `Install Claude Code CLI with:\n  ${CLAUDE_INSTALL_CMD}`,
      };
    }

    return { valid: true };
  } catch {
    return {
      valid: false,
      error: 'Failed to check Claude Code CLI installation.',
      suggestion: `Install Claude Code CLI with:\n  ${CLAUDE_INSTALL_CMD}`,
    };
  }
}

/**
 * Check if Claude Code CLI is authenticated
 *
 * This is done by attempting to run a simple command that requires auth.
 * If not authenticated, Claude will prompt for login.
 *
 * @returns Validation result with authentication status
 */
export async function validateClaudeAuth(): Promise<ValidationResult> {
  try {
    // Try to run a command that requires authentication
    // Using --version should work without auth, so we try a minimal prompt
    const { output, exitCode } = await runCommand(
      'claude -p "echo test" --output-format text',
      process.cwd(),
      30000
    );

    // Check for common auth error indicators
    const authErrors = [
      'not authenticated',
      'please login',
      'authentication required',
      'unauthorized',
      'login required',
    ];

    const lowerOutput = output.toLowerCase();
    const hasAuthError = authErrors.some((err) => lowerOutput.includes(err));

    if (hasAuthError || exitCode !== 0) {
      return {
        valid: false,
        error: 'Claude Code CLI is not authenticated.',
        suggestion: 'Please run "claude login" to authenticate.',
      };
    }

    return { valid: true };
  } catch {
    return {
      valid: false,
      error: 'Failed to verify Claude Code authentication.',
      suggestion: 'Please run "claude login" to authenticate.',
    };
  }
}

/**
 * Run all environment validations
 *
 * @param skipAuth - Whether to skip authentication check (for init command)
 * @returns Array of validation results with labels
 */
export async function validateEnvironment(
  skipAuth = false
): Promise<{ label: string; result: ValidationResult }[]> {
  const validations: { label: string; result: ValidationResult }[] = [];

  // Check Node.js version
  validations.push({
    label: 'Node.js version',
    result: validateNodeVersion(),
  });

  // Check Claude installation
  validations.push({
    label: 'Claude Code CLI installed',
    result: await validateClaudeInstalled(),
  });

  // Check Claude authentication (unless skipped)
  if (!skipAuth) {
    const installResult = validations[1].result;
    if (installResult.valid) {
      validations.push({
        label: 'Claude Code authenticated',
        result: await validateClaudeAuth(),
      });
    }
  }

  return validations;
}

/**
 * Check if all validations passed
 *
 * @param results - Array of validation results
 * @returns Whether all validations passed
 */
export function allValid(
  results: { label: string; result: ValidationResult }[]
): boolean {
  return results.every((r) => r.result.valid);
}

/**
 * Get the first failed validation
 *
 * @param results - Array of validation results
 * @returns First failed validation or undefined
 */
export function getFirstError(
  results: { label: string; result: ValidationResult }[]
): { label: string; result: ValidationResult } | undefined {
  return results.find((r) => !r.result.valid);
}

// ============================================================================
// Quick Validation
// ============================================================================

/**
 * Quick check if Claude is ready (installed and authenticated)
 *
 * @returns Whether Claude is ready to use
 */
export async function isClaudeReady(): Promise<boolean> {
  const installResult = await validateClaudeInstalled();
  if (!installResult.valid) return false;

  const authResult = await validateClaudeAuth();
  return authResult.valid;
}
