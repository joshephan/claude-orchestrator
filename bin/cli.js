#!/usr/bin/env node

/**
 * Claude Orchestrator CLI Entry Point
 *
 * This is the main entry point for the CLI tool.
 * It imports and runs the compiled TypeScript code from the dist directory.
 *
 * Usage:
 *   claude-orchestrator init [directory]
 *   claude-orchestrator start [options]
 *   claude-orchestrator status
 *   claude-orchestrator logs [options]
 *   claude-orchestrator stop
 *   claude-orchestrator resume
 */

import { run } from '../dist/index.js';

// Run the CLI
run().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
