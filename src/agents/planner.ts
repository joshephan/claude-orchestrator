/**
 * Planner agent prompt builder module
 *
 * Constructs prompts for the Planner agent role,
 * which defines product features, identity, and user flows.
 */

import path from 'path';
import { readTextSafe } from '../utils/files.js';
import type {
  Task,
  OrchestratorConfig,
  PlanningDocumentMessage,
  FeatureDefinition,
  UserFlow,
  Platform,
} from '../types.js';

// ============================================================================
// Template Loading
// ============================================================================

/**
 * Load the planner role template
 *
 * @param templatePath - Path to the template file
 * @returns Template content or default
 */
export async function loadPlannerTemplate(templatePath: string): Promise<string> {
  const content = await readTextSafe(templatePath);
  return content || getDefaultPlannerTemplate();
}

/**
 * Get the default planner template
 *
 * @returns Default template content
 */
function getDefaultPlannerTemplate(): string {
  return `# Planner Role

You are a Product Planner responsible for defining product features, identity,
and ensuring smooth user experiences throughout the application.

## Responsibilities

1. **Product Vision**
   - Define the core value proposition
   - Identify target users and their needs
   - Establish product identity and brand voice

2. **Feature Definition**
   - Break down requirements into concrete features
   - Prioritize features based on user value
   - Define acceptance criteria for each feature

3. **User Flow Design**
   - Map out key user journeys
   - Identify pain points and opportunities
   - Ensure logical and intuitive navigation

4. **Requirements Analysis**
   - Gather and document technical requirements
   - Identify dependencies and constraints
   - Define success metrics

## Guidelines

- Focus on user needs and business value
- Be specific and measurable in your definitions
- Consider edge cases and error states
- Keep the scope realistic and achievable
- Document assumptions and decisions`;
}

// ============================================================================
// Prompt Builders
// ============================================================================

/**
 * Build prompt for planning a task
 *
 * @param task - Task to plan
 * @param config - Project configuration
 * @param template - Optional custom template
 * @returns Complete prompt string
 */
export function buildPlanningPrompt(
  task: Task,
  config: OrchestratorConfig,
  template?: string
): string {
  const roleTemplate = template || getDefaultPlannerTemplate();
  const projectPath = config.project.path;
  const messageFilePath = path.join(
    projectPath,
    '.claude-orchestrator',
    'messages',
    'to-designer.json'
  );

  return `${roleTemplate}

---

## Current Planning Task

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

${task.acceptanceCriteria ? `### Initial Acceptance Criteria\n${task.acceptanceCriteria.map((c) => `- ${c}`).join('\n')}` : ''}

---

## Your Task

1. Analyze the task requirements from a product perspective
2. Define the product vision for this feature
3. Break down the feature into concrete sub-features
4. Design the key user flows
5. Document technical requirements

## Required Output

You MUST write your planning document to the following file:
\`${messageFilePath}\`

The JSON format should be:
\`\`\`json
{
  "messages": [{
    "type": "planning_document",
    "taskId": "${task.id}",
    "platform": "${config.platform}",
    "timestamp": "${new Date().toISOString()}",
    "productVision": "Clear statement of what this feature achieves and why it matters",
    "coreFeatures": [
      {
        "name": "Feature Name",
        "description": "What this feature does",
        "priority": "high|medium|low",
        "acceptanceCriteria": ["Criterion 1", "Criterion 2"]
      }
    ],
    "userFlows": [
      {
        "name": "Flow Name",
        "description": "What this flow achieves",
        "steps": [
          { "step": 1, "action": "User action", "expectedResult": "System response" }
        ]
      }
    ],
    "requirements": [
      "Technical requirement 1",
      "Technical requirement 2"
    ]
  }],
  "lastRead": null
}
\`\`\`

## Planning Guidelines

1. **Product Vision**: A clear, concise statement (1-2 sentences)
2. **Core Features**: 2-5 features with clear acceptance criteria
3. **User Flows**: 1-3 key user journeys with step-by-step actions
4. **Requirements**: Technical needs for the designer and developers

Begin your analysis and write the planning document now.`;
}

// ============================================================================
// Message Formatting
// ============================================================================

/**
 * Create a planning document message object
 *
 * @param taskId - Task ID
 * @param platform - Target platform
 * @param productVision - Product vision statement
 * @param coreFeatures - List of core features
 * @param userFlows - User flow definitions
 * @param requirements - Technical requirements
 * @returns Planning document message
 */
export function createPlanningDocumentMessage(
  taskId: string,
  platform: Platform,
  productVision: string,
  coreFeatures: FeatureDefinition[],
  userFlows: UserFlow[],
  requirements: string[]
): PlanningDocumentMessage {
  return {
    type: 'planning_document',
    taskId,
    platform,
    timestamp: new Date().toISOString(),
    productVision,
    coreFeatures,
    userFlows,
    requirements,
  };
}

/**
 * Create a feature definition object
 *
 * @param name - Feature name
 * @param description - Feature description
 * @param priority - Priority level
 * @param acceptanceCriteria - Acceptance criteria
 * @returns Feature definition
 */
export function createFeatureDefinition(
  name: string,
  description: string,
  priority: 'high' | 'medium' | 'low',
  acceptanceCriteria?: string[]
): FeatureDefinition {
  return {
    name,
    description,
    priority,
    acceptanceCriteria,
  };
}

/**
 * Create a user flow object
 *
 * @param name - Flow name
 * @param description - Flow description
 * @param steps - Flow steps
 * @returns User flow definition
 */
export function createUserFlow(
  name: string,
  description: string,
  steps: Array<{ step: number; action: string; expectedResult: string }>
): UserFlow {
  return {
    name,
    description,
    steps,
  };
}

// ============================================================================
// Prompt Helpers
// ============================================================================

/**
 * Get platform-specific planning considerations
 *
 * @param platform - Target platform
 * @returns Planning considerations
 */
export function getPlatformPlanningConsiderations(platform: string): string {
  switch (platform) {
    case 'android':
      return `
## Android-Specific Considerations

- Consider Material Design 3 components and patterns
- Plan for different screen sizes and orientations
- Consider offline-first capabilities
- Plan for Android-specific permissions
- Consider back button behavior and navigation`;

    case 'ios':
      return `
## iOS-Specific Considerations

- Follow Human Interface Guidelines
- Plan for different device sizes (iPhone, iPad)
- Consider iOS-specific gestures and interactions
- Plan for system integrations (Shortcuts, Widgets)
- Consider privacy and permissions`;

    case 'web':
      return `
## Web-Specific Considerations

- Plan for responsive design (mobile, tablet, desktop)
- Consider accessibility (WCAG compliance)
- Plan for SEO requirements
- Consider browser compatibility
- Plan for progressive enhancement`;

    default:
      return `
## General Considerations

- Plan for different user skill levels
- Consider internationalization needs
- Plan for error handling and edge cases
- Consider performance requirements
- Plan for future extensibility`;
  }
}

/**
 * Get common feature patterns for a platform
 *
 * @param platform - Target platform
 * @returns Common feature patterns
 */
export function getPlannerFeaturePatterns(platform: string): string[] {
  const commonPatterns = [
    'User authentication and authorization',
    'Data persistence and synchronization',
    'Error handling and recovery',
    'Loading states and feedback',
    'Settings and preferences',
  ];

  const platformPatterns: Record<string, string[]> = {
    android: [
      'Material Design theming',
      'Navigation with back stack',
      'Push notifications',
      'Background processing',
    ],
    ios: [
      'SwiftUI navigation patterns',
      'Push notifications (APNs)',
      'Core Data integration',
      'App Clips / Widgets',
    ],
    web: [
      'Responsive layouts',
      'Progressive Web App features',
      'Browser notifications',
      'Offline support',
    ],
  };

  return [...commonPatterns, ...(platformPatterns[platform] || [])];
}
