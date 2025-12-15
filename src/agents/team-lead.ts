/**
 * Tech Lead agent prompt builder module
 *
 * Constructs prompts for the Tech Lead agent role,
 * which designs development tasks and creates implementation instructions.
 *
 * Note: This module was formerly named Team Lead. The core functionality
 * remains similar but now integrates with Planner and Designer agents.
 */

import path from 'path';
import { readTextSafe } from '../utils/files.js';
import type {
  Task,
  OrchestratorConfig,
  TaskAssignmentMessage,
  CompletionReportMessage,
  PlanningDocumentMessage,
  DesignSpecificationMessage,
} from '../types.js';

// ============================================================================
// Template Loading
// ============================================================================

/**
 * Load the team lead role template
 *
 * @param templatePath - Path to the template file
 * @returns Template content or default
 */
export async function loadTeamLeadTemplate(templatePath: string): Promise<string> {
  const content = await readTextSafe(templatePath);
  return content || getDefaultTeamLeadTemplate();
}

/**
 * Get the default team lead template
 *
 * @returns Default template content
 */
function getDefaultTeamLeadTemplate(): string {
  return getDefaultTechLeadTemplate();
}

/**
 * Get the default tech lead template
 *
 * @returns Default template content
 */
function getDefaultTechLeadTemplate(): string {
  return `# Tech Lead Role

You are a Tech Lead responsible for designing development tasks and creating
clear, actionable implementation instructions for developers.

## Responsibilities

1. **Task Analysis**
   - Understand the task requirements thoroughly
   - Identify dependencies and prerequisites
   - Determine the scope and complexity

2. **Implementation Planning**
   - Design the technical approach
   - Identify files to create or modify
   - Define the architecture pattern to follow

3. **Instruction Writing**
   - Write clear, step-by-step instructions
   - Include code examples where helpful
   - Specify acceptance criteria

## Guidelines

- Be specific and detailed in your instructions
- Consider edge cases and error handling
- Follow project conventions and patterns
- Provide context for why certain approaches are chosen`;
}

// ============================================================================
// Prompt Builders
// ============================================================================

/**
 * Build prompt for task assignment
 *
 * @param task - Task to assign
 * @param config - Project configuration
 * @param template - Optional custom template
 * @returns Complete prompt string
 */
export function buildAssignmentPrompt(
  task: Task,
  config: OrchestratorConfig,
  template?: string
): string {
  const roleTemplate = template || getDefaultTeamLeadTemplate();
  const projectPath = config.project.path;
  const messageFilePath = path.join(projectPath, '.claude-orchestrator', 'tasks', 'messages', 'to-developer.json');

  return `${roleTemplate}

---

## Current Assignment

### Task Details
- **ID**: ${task.id}
- **Title**: ${task.title}
- **Type**: ${task.type}
- **Priority**: ${task.priority}
- **Description**: ${task.description}

### Project Context
- **Project Name**: ${config.project.name}
- **Platform**: ${config.platform}
- **Development Scope**: ${config.scope}
- **Goals**: ${config.goals.join(', ')}

${task.webReference ? `### Reference Files\n${task.webReference.files.map((f) => `- ${f}`).join('\n')}` : ''}

${task.acceptanceCriteria ? `### Acceptance Criteria\n${task.acceptanceCriteria.map((c) => `- ${c}`).join('\n')}` : ''}

---

## Your Task

1. Analyze the task requirements carefully
2. Study any reference files to understand existing patterns
3. Design the implementation approach
4. Write detailed instructions for the developer

## Required Output

You MUST write your instructions to the following file:
\`${messageFilePath}\`

The JSON format should be:
\`\`\`json
{
  "messages": [{
    "type": "task_assignment",
    "taskId": "${task.id}",
    "platform": "${config.platform}",
    "title": "${task.title}",
    "instructions": "Your detailed implementation instructions here...",
    "filesToCreate": ["list", "of", "files", "to", "create"],
    "architecture": "Architecture pattern to follow",
    "apiEndpoints": ["API endpoints if applicable"],
    "timestamp": "${new Date().toISOString()}"
  }],
  "lastRead": null
}
\`\`\`

## Instructions Format

Your instructions should include:
1. Overview of what needs to be implemented
2. Step-by-step implementation guide
3. Code structure and patterns to follow
4. Integration points with existing code
5. Testing requirements
6. Any special considerations

Begin your analysis and write the instructions now.`;
}

/**
 * Build prompt for task review
 *
 * @param task - Task to review
 * @param report - Completion report from developer
 * @param config - Project configuration
 * @param template - Optional custom template
 * @returns Complete prompt string
 */
export function buildReviewPrompt(
  task: Task,
  report: CompletionReportMessage,
  config: OrchestratorConfig,
  template?: string
): string {
  const roleTemplate = template || getDefaultTeamLeadTemplate();

  return `${roleTemplate}

---

## Code Review Task

You are reviewing a completed implementation from the developer.

### Original Task
- **ID**: ${task.id}
- **Title**: ${task.title}
- **Description**: ${task.description}
- **Platform**: ${config.platform}

### Developer's Report
- **Summary**: ${report.summary || 'No summary provided'}
- **Files Created**: ${report.filesCreated?.length > 0 ? report.filesCreated.join(', ') : 'None'}
- **Files Modified**: ${report.filesModified?.length > 0 ? report.filesModified.join(', ') : 'None'}
- **Build Status**: ${report.buildResult?.status || 'Unknown'}
- **Build Errors**: ${report.buildResult?.errors ?? 'Unknown'}
${report.buildResult?.output ? `- **Build Output**: ${report.buildResult.output}` : ''}

---

## Review Criteria

1. **Build Verification**: Build must pass (status: "success")
2. **File Creation**: All required files must be created
3. **Requirements**: Implementation must meet task requirements
4. **Code Quality**: Code should follow project conventions

## Your Decision

Based on your review of the implementation:

1. Check if the build was successful
2. Verify that the created files exist and are properly implemented
3. Ensure the task requirements are met

## Required Output

After your review, output ONE of these lines:
- \`APPROVE: Task completed successfully\`
- \`REJECT: [specific reason for rejection]\`

Your review decision:`;
}

// ============================================================================
// Message Formatting
// ============================================================================

/**
 * Create a task assignment message object
 *
 * @param taskId - Task ID
 * @param title - Task title
 * @param platform - Target platform
 * @param instructions - Implementation instructions
 * @param filesToCreate - List of files to create
 * @param architecture - Architecture pattern
 * @param apiEndpoints - Optional API endpoints
 * @returns Task assignment message
 */
export function createAssignmentMessage(
  taskId: string,
  title: string,
  platform: string,
  instructions: string,
  filesToCreate: string[],
  architecture: string,
  apiEndpoints?: string[]
): TaskAssignmentMessage {
  return {
    type: 'task_assignment',
    taskId,
    platform: platform as TaskAssignmentMessage['platform'],
    title,
    instructions,
    filesToCreate,
    architecture,
    apiEndpoints,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// Prompt Helpers
// ============================================================================

/**
 * Get platform-specific architecture guidelines
 *
 * @param platform - Target platform
 * @returns Architecture guidelines
 */
export function getPlatformGuidelines(platform: string): string {
  switch (platform) {
    case 'android':
      return `
## Android Architecture Guidelines

- Use MVVM with ViewModel and StateFlow
- Implement UI with Jetpack Compose
- Follow Material Design 3 guidelines
- Use Retrofit for network calls
- Implement Repository pattern for data layer
- Use Hilt for dependency injection`;

    case 'ios':
      return `
## iOS Architecture Guidelines

- Use MVVM with ObservableObject
- Implement UI with SwiftUI
- Follow Human Interface Guidelines
- Use URLSession or Alamofire for networking
- Implement Combine for reactive programming
- Use dependency injection containers`;

    case 'web':
      return `
## Web Architecture Guidelines

- Use component-based architecture
- Implement state management appropriately
- Follow responsive design principles
- Use TypeScript for type safety
- Implement API client abstraction
- Follow accessibility guidelines`;

    default:
      return `
## General Architecture Guidelines

- Follow clean architecture principles
- Separate concerns into layers
- Use dependency injection
- Implement proper error handling
- Write testable code`;
  }
}

// ============================================================================
// Tech Lead Extended Functions
// ============================================================================

/**
 * Load the tech lead role template
 *
 * @param templatePath - Path to the template file
 * @returns Template content or default
 */
export async function loadTechLeadTemplate(templatePath: string): Promise<string> {
  const content = await readTextSafe(templatePath);
  return content || getDefaultTechLeadTemplate();
}

/**
 * Build prompt for tech lead with planning and design context
 *
 * Skills-optimized: Short context prompt that triggers orchestrator-tech-lead skill
 *
 * @param task - Task to assign
 * @param planningDoc - Planning document from Planner
 * @param designSpec - Design specification from Designer
 * @param config - Project configuration
 * @param template - Optional custom template (ignored when using skills)
 * @returns Complete prompt string
 */
export function buildTechLeadPrompt(
  task: Task,
  planningDoc: PlanningDocumentMessage,
  designSpec: DesignSpecificationMessage,
  config: OrchestratorConfig,
  _template?: string
): string {
  const projectPath = config.project.path;
  const messageFilePath = path.join(
    projectPath,
    '.claude-orchestrator',
    'messages',
    'to-developer.json'
  );

  // Compact design tokens
  const colorsCompact = Object.entries(designSpec.designTokens.colors)
    .slice(0, 4)
    .map(([k, v]) => `${k}:${v}`)
    .join(', ');

  const spacingCompact = Object.entries(designSpec.designTokens.spacing)
    .map(([k, v]) => `${k}:${v}`)
    .join(', ');

  const componentsCompact = designSpec.componentSpecs
    .map((c) => c.name)
    .join(', ');

  return `[ORCHESTRATOR TECH LEAD TASK]

Task: ${task.id} - ${task.title}
Type: ${task.type} | Priority: ${task.priority}
Platform: ${config.platform}

Description: ${task.description}

PLANNING INPUT:
Vision: ${planningDoc.productVision}
Features: ${planningDoc.coreFeatures.map((f) => f.name).join(', ')}
Requirements: ${planningDoc.requirements.slice(0, 3).join('; ')}

DESIGN INPUT:
Colors: ${colorsCompact}
Spacing: ${spacingCompact}
Components: ${componentsCompact}

OUTPUT FILE: ${messageFilePath}
TASK ID: ${task.id}
TIMESTAMP: ${new Date().toISOString()}

Create implementation instructions with file list, architecture pattern, and design token references for the developer.`;
}
