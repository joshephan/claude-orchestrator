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
 * Skills-optimized: Compact prompt with essential context and output format
 *
 * @param task - Task to plan
 * @param config - Project configuration
 * @param template - Optional custom template (ignored when using skills)
 * @returns Complete prompt string
 */
export function buildPlanningPrompt(
  task: Task,
  config: OrchestratorConfig,
  _template?: string
): string {
  const projectPath = config.project.path;
  const messageFilePath = path.join(
    projectPath,
    '.claude-orchestrator',
    'messages',
    'to-designer.json'
  );

  return `You are a Product Planner. Create a planning document for the following task.

## Task
- ID: ${task.id}
- Title: ${task.title}
- Priority: ${task.priority}
- Description: ${task.description}

## Project Context
- Project: ${config.project.name}
- Platform: ${config.platform}
- Scope: ${config.scope}
- Goals: ${config.goals.join(', ')}

## REQUIRED OUTPUT

You MUST write the following JSON to: ${messageFilePath}

{
  "messages": [{
    "type": "planning_document",
    "taskId": "${task.id}",
    "platform": "${config.platform}",
    "timestamp": "${new Date().toISOString()}",
    "productVision": "1-2 sentence vision statement",
    "coreFeatures": [
      {"name": "Feature", "description": "What it does", "priority": "high|medium|low", "acceptanceCriteria": ["criterion"]}
    ],
    "userFlows": [
      {"name": "Flow", "description": "Purpose", "steps": [{"step": 1, "action": "User action", "expectedResult": "Result"}]}
    ],
    "requirements": ["Technical requirement 1", "Technical requirement 2"]
  }],
  "lastRead": null
}

Analyze the task and write the planning document JSON file now.`;
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
