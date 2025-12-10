/**
 * Developer agent prompt builder module
 *
 * Constructs prompts for the Developer agent role,
 * which implements tasks according to Team Lead instructions.
 */

import path from 'path';
import { readTextSafe } from '../utils/files.js';
import type { Task, OrchestratorConfig, TaskAssignmentMessage, CompletionReportMessage, BuildResult } from '../types.js';

// ============================================================================
// Template Loading
// ============================================================================

/**
 * Load the developer role template
 *
 * @param templatePath - Path to the template file
 * @returns Template content or default
 */
export async function loadDeveloperTemplate(templatePath: string): Promise<string> {
  const content = await readTextSafe(templatePath);
  return content || getDefaultDeveloperTemplate();
}

/**
 * Get the default developer template
 *
 * @returns Default template content
 */
function getDefaultDeveloperTemplate(): string {
  return `# Developer Role

You are a Developer responsible for implementing tasks according to the
Team Lead's instructions.

## Responsibilities

1. **Understanding Instructions**
   - Read and understand the Team Lead's instructions
   - Clarify any ambiguities before implementing
   - Follow the specified architecture pattern

2. **Implementation**
   - Create all required files
   - Write clean, maintainable code
   - Follow project conventions
   - Handle edge cases and errors

3. **Verification**
   - Run build verification
   - Test the implementation locally
   - Ensure code compiles without errors

4. **Reporting**
   - Document what was implemented
   - List all files created/modified
   - Report build status accurately

## Guidelines

- Follow the instructions precisely
- Write self-documenting code
- Include appropriate error handling
- Test your work before reporting completion`;
}

// ============================================================================
// Prompt Builders
// ============================================================================

/**
 * Build prompt for task implementation
 *
 * @param task - Task to implement
 * @param instructions - Instructions from Team Lead
 * @param config - Project configuration
 * @param template - Optional custom template
 * @returns Complete prompt string
 */
export function buildImplementationPrompt(
  task: Task,
  instructions: TaskAssignmentMessage,
  config: OrchestratorConfig,
  template?: string
): string {
  const roleTemplate = template || getDefaultDeveloperTemplate();
  const projectPath = config.project.path;
  const messageFilePath = path.join(projectPath, '.claude-orchestrator', 'tasks', 'messages', 'to-team-lead.json');

  return `${roleTemplate}

---

## Implementation Task

### Task Details
- **ID**: ${task.id}
- **Title**: ${task.title}
- **Platform**: ${config.platform}

### Team Lead's Instructions

${instructions.instructions}

### Files to Create
${instructions.filesToCreate?.map((f) => `- \`${f}\``).join('\n') || 'No files specified'}

### Architecture Pattern
${instructions.architecture || 'Not specified'}

${instructions.apiEndpoints?.length ? `### API Endpoints\n${instructions.apiEndpoints.map((e) => `- ${e}`).join('\n')}` : ''}

---

## Your Task

1. Implement the task following the Team Lead's instructions exactly
2. Create all specified files
3. Follow the architecture pattern
4. Run build verification to ensure code compiles
5. Report completion with details

## Build Verification

After implementation, you MUST run a build command to verify:

${getBuildCommand(config.platform)}

## Required Output

After completing the implementation, write your completion report to:
\`${messageFilePath}\`

The JSON format should be:
\`\`\`json
{
  "messages": [{
    "type": "completion_report",
    "taskId": "${task.id}",
    "platform": "${config.platform}",
    "status": "awaiting_review",
    "summary": "Brief summary of what you implemented",
    "filesCreated": ["list", "of", "created", "files"],
    "filesModified": ["list", "of", "modified", "files"],
    "buildResult": {
      "status": "success" or "failed",
      "command": "the build command you ran",
      "errors": 0,
      "output": "relevant output if failed"
    },
    "timestamp": "${new Date().toISOString()}"
  }],
  "lastRead": null
}
\`\`\`

## Important Notes

- Build verification is MANDATORY before reporting completion
- Report build status honestly - "failed" is acceptable for review
- Include all created and modified files in your report
- Provide a clear summary of what was implemented

Begin implementation now.`;
}

// ============================================================================
// Build Commands
// ============================================================================

/**
 * Get the build command for a platform
 *
 * @param platform - Target platform
 * @returns Build command string
 */
export function getBuildCommand(platform: string): string {
  switch (platform) {
    case 'android':
      return `For Android (Kotlin):
\`\`\`bash
cd android && ./gradlew compileDebugKotlin
\`\`\``;

    case 'ios':
      return `For iOS (Swift):
\`\`\`bash
cd ios && xcodebuild build -scheme YourScheme -destination 'platform=iOS Simulator,name=iPhone 15'
\`\`\`
Note: If on Windows/Linux, mark build as "not_applicable"`;

    case 'web':
      return `For Web (TypeScript):
\`\`\`bash
npm run build
# or
npm run typecheck
\`\`\``;

    default:
      return `Run the appropriate build/compile command for your project.
Verify that all code compiles without errors.`;
  }
}

// ============================================================================
// Message Formatting
// ============================================================================

/**
 * Create a completion report message object
 *
 * @param taskId - Task ID
 * @param platform - Target platform
 * @param summary - Implementation summary
 * @param filesCreated - List of created files
 * @param filesModified - List of modified files
 * @param buildResult - Build verification result
 * @returns Completion report message
 */
export function createCompletionReport(
  taskId: string,
  platform: string,
  summary: string,
  filesCreated: string[],
  filesModified: string[],
  buildResult: BuildResult
): CompletionReportMessage {
  return {
    type: 'completion_report',
    taskId,
    platform: platform as CompletionReportMessage['platform'],
    status: 'awaiting_review',
    summary,
    filesCreated,
    filesModified,
    buildResult,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a build result object
 *
 * @param status - Build status
 * @param command - Command that was run
 * @param errors - Number of errors
 * @param output - Optional output
 * @returns Build result object
 */
export function createBuildResult(
  status: BuildResult['status'],
  command: string,
  errors = 0,
  output?: string
): BuildResult {
  return {
    status,
    command,
    errors,
    output,
  };
}

// ============================================================================
// Platform-Specific Helpers
// ============================================================================

/**
 * Get platform-specific coding guidelines
 *
 * @param platform - Target platform
 * @returns Coding guidelines
 */
export function getCodingGuidelines(platform: string): string {
  switch (platform) {
    case 'android':
      return `
## Android Coding Guidelines

- Use Kotlin language features (coroutines, flows, extension functions)
- Follow Kotlin style guide
- Use meaningful variable and function names
- Implement proper null safety
- Use sealed classes for state management
- Document public APIs with KDoc`;

    case 'ios':
      return `
## iOS Coding Guidelines

- Use Swift language features (async/await, property wrappers)
- Follow Swift API Design Guidelines
- Use meaningful variable and function names
- Handle optionals safely
- Use enums with associated values
- Document public APIs with DocC`;

    case 'web':
      return `
## Web Coding Guidelines

- Use TypeScript with strict mode
- Follow project ESLint/Prettier rules
- Use meaningful variable and function names
- Handle errors with try/catch or Result types
- Use async/await for asynchronous code
- Document public APIs with JSDoc/TSDoc`;

    default:
      return `
## General Coding Guidelines

- Write clean, readable code
- Use meaningful names
- Handle errors appropriately
- Document public interfaces
- Follow project conventions`;
  }
}

/**
 * Get platform-specific file patterns
 *
 * @param platform - Target platform
 * @param featureName - Name of the feature
 * @returns Object with file patterns
 */
export function getFilePatterns(
  platform: string,
  featureName: string
): { [key: string]: string } {
  const pascalCase = featureName.charAt(0).toUpperCase() + featureName.slice(1);

  switch (platform) {
    case 'android':
      return {
        screen: `${pascalCase}Screen.kt`,
        viewModel: `${pascalCase}ViewModel.kt`,
        repository: `${pascalCase}Repository.kt`,
        model: `${pascalCase}.kt`,
      };

    case 'ios':
      return {
        view: `${pascalCase}View.swift`,
        viewModel: `${pascalCase}ViewModel.swift`,
        service: `${pascalCase}Service.swift`,
        model: `${pascalCase}.swift`,
      };

    case 'web':
      return {
        component: `${pascalCase}.tsx`,
        hook: `use${pascalCase}.ts`,
        service: `${featureName}.service.ts`,
        types: `${featureName}.types.ts`,
      };

    default:
      return {
        main: `${featureName}.ts`,
        types: `${featureName}.types.ts`,
      };
  }
}
