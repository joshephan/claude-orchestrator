/**
 * Discovery agent prompt builder module
 *
 * Constructs prompts for the Discovery agent role,
 * which scans the project to identify missing features
 * and creates new tasks.
 */

import path from 'path';
import { readTextSafe } from '../utils/files.js';
import type { Task, OrchestratorConfig, TaskPriority } from '../types.js';

// ============================================================================
// Template Loading
// ============================================================================

/**
 * Load the discovery role template
 *
 * @param templatePath - Path to the template file
 * @returns Template content or default
 */
export async function loadDiscoveryTemplate(templatePath: string): Promise<string> {
  const content = await readTextSafe(templatePath);
  return content || getDefaultDiscoveryTemplate();
}

/**
 * Get the default discovery template
 *
 * @returns Default template content
 */
function getDefaultDiscoveryTemplate(): string {
  return `# Discovery Agent Role

You are a Discovery Agent responsible for analyzing the project to identify
features that need to be implemented.

## Responsibilities

1. **Project Analysis**
   - Scan the project structure
   - Understand existing implementations
   - Identify patterns and conventions

2. **Gap Identification**
   - Compare existing features against requirements
   - Identify missing functionality
   - Detect incomplete implementations

3. **Task Creation**
   - Create well-defined tasks for missing features
   - Prioritize tasks appropriately
   - Write clear descriptions

## Guidelines

- Focus on actionable, implementable tasks
- Avoid duplicate tasks
- Prioritize based on dependencies and impact
- Consider project conventions when defining tasks`;
}

// ============================================================================
// Prompt Builders
// ============================================================================

/**
 * Build prompt for feature discovery
 *
 * @param config - Project configuration
 * @param existingTasks - Currently existing tasks
 * @param template - Optional custom template
 * @returns Complete prompt string
 */
export function buildDiscoveryPrompt(
  config: OrchestratorConfig,
  existingTasks: Task[],
  template?: string
): string {
  const roleTemplate = template || getDefaultDiscoveryTemplate();
  const projectPath = config.project.path;
  const queueFilePath = path.join(projectPath, '.claude-orchestrator', 'queue.json');

  // Build existing tasks summary
  const existingTasksSummary = existingTasks.length > 0
    ? existingTasks.map((t) => `- ${t.id}: ${t.title} (${t.status})`).join('\n')
    : 'No existing tasks.';

  return `${roleTemplate}

---

## Discovery Task

### Project Information
- **Project Name**: ${config.project.name}
- **Project Path**: ${config.project.path}
- **Platform**: ${config.platform}

### Development Scope
${config.scope}

### Development Goals
${config.goals.map((g) => `- ${g}`).join('\n')}

### Existing Tasks
${existingTasksSummary}

---

## Your Task

1. Analyze the project structure to understand what exists
2. Review the development scope and goals
3. Identify features or functionality that are missing
4. Create tasks for the missing features (maximum 5 new tasks)

## Directories to Analyze

${getDirectoriesToAnalyze(config.platform)}

## Task Creation Guidelines

For each missing feature, create a task with:
- Clear, descriptive title
- Detailed description of what needs to be implemented
- Appropriate priority (high, medium, low)
- Acceptance criteria

## Required Output

After analysis, add new tasks to the queue file:
\`${queueFilePath}\`

Read the existing queue.json first, then add your new tasks to the "tasks" array.

Each task should follow this format:
\`\`\`json
{
  "id": "task-XXX",
  "type": "feature_implementation",
  "priority": "high|medium|low",
  "title": "Feature Title",
  "description": "Detailed description...",
  "acceptanceCriteria": ["criteria 1", "criteria 2"],
  "status": "pending",
  "createdAt": "${new Date().toISOString()}"
}
\`\`\`

## Important Notes

- Do NOT create tasks that duplicate existing ones
- Generate meaningful task IDs (increment from existing highest ID)
- Focus on features that align with the development goals
- Maximum 5 new tasks per discovery cycle

Begin discovery analysis now.`;
}

// ============================================================================
// Discovery Helpers
// ============================================================================

/**
 * Get directories to analyze for a platform
 *
 * @param platform - Target platform
 * @returns Directory analysis instructions
 */
function getDirectoriesToAnalyze(platform: string): string {
  switch (platform) {
    case 'android':
      return `
### Android Project Structure
- \`app/src/main/java/\` - Main source code
- \`app/src/main/res/\` - Resources (layouts, strings, etc.)
- \`app/src/main/AndroidManifest.xml\` - App manifest
- Look for feature packages under the main source directory`;

    case 'ios':
      return `
### iOS Project Structure
- \`*/Features/\` - Feature modules
- \`*/Views/\` - UI views
- \`*/Models/\` - Data models
- \`*/Services/\` - API and service layers
- Look for SwiftUI views and ViewModels`;

    case 'web':
      return `
### Web Project Structure
- \`src/\` or \`app/\` - Main source code
- \`components/\` - UI components
- \`pages/\` or \`routes/\` - Page components
- \`features/\` - Feature modules
- \`api/\` or \`services/\` - API client code
- Look for React/Vue/Angular components`;

    default:
      return `
### General Project Structure
- Analyze the source directory structure
- Look for existing feature implementations
- Identify patterns in the codebase
- Check for configuration files that indicate project type`;
  }
}

/**
 * Build a task suggestion from discovery results
 *
 * @param title - Task title
 * @param description - Task description
 * @param priority - Task priority
 * @param type - Task type
 * @param acceptanceCriteria - Optional acceptance criteria
 * @returns Partial task object
 */
export function buildTaskSuggestion(
  title: string,
  description: string,
  priority: TaskPriority,
  type = 'feature_implementation',
  acceptanceCriteria?: string[]
): Omit<Task, 'id' | 'status' | 'createdAt'> {
  return {
    type,
    priority,
    title,
    description,
    acceptanceCriteria,
  };
}

/**
 * Get common feature patterns to look for
 *
 * @param platform - Target platform
 * @returns Array of feature patterns
 */
export function getCommonFeaturePatterns(platform: string): string[] {
  const common = [
    'Authentication (login, register, logout)',
    'User profile management',
    'Settings/preferences',
    'Navigation structure',
    'Error handling and display',
    'Loading states',
    'Data persistence',
    'API integration',
  ];

  switch (platform) {
    case 'android':
      return [
        ...common,
        'Material Design components',
        'Navigation graph',
        'Room database',
        'WorkManager for background tasks',
        'Push notifications',
      ];

    case 'ios':
      return [
        ...common,
        'SwiftUI navigation',
        'Core Data or SwiftData',
        'Push notifications',
        'App lifecycle handling',
        'Accessibility support',
      ];

    case 'web':
      return [
        ...common,
        'Routing configuration',
        'State management setup',
        'Form validation',
        'Responsive design',
        'SEO optimization',
      ];

    default:
      return common;
  }
}

/**
 * Determine task priority based on feature type
 *
 * @param featureType - Type of feature
 * @returns Suggested priority
 */
export function suggestPriority(featureType: string): TaskPriority {
  const highPriority = [
    'auth',
    'login',
    'security',
    'error',
    'crash',
    'navigation',
    'core',
  ];

  const mediumPriority = [
    'profile',
    'settings',
    'api',
    'data',
    'list',
    'detail',
  ];

  const lowerFeature = featureType.toLowerCase();

  if (highPriority.some((p) => lowerFeature.includes(p))) {
    return 'high';
  }

  if (mediumPriority.some((p) => lowerFeature.includes(p))) {
    return 'medium';
  }

  return 'low';
}

// ============================================================================
// Task Deduplication
// ============================================================================

/**
 * Check if a task title is similar to existing tasks
 *
 * @param title - New task title
 * @param existingTasks - Array of existing tasks
 * @returns Whether a similar task exists
 */
export function hasSimilarTask(title: string, existingTasks: Task[]): boolean {
  const normalizedTitle = title.toLowerCase().trim();

  return existingTasks.some((task) => {
    const existingTitle = task.title.toLowerCase().trim();

    // Exact match
    if (existingTitle === normalizedTitle) return true;

    // Contains check
    if (existingTitle.includes(normalizedTitle) || normalizedTitle.includes(existingTitle)) {
      return true;
    }

    // Word overlap check
    const newWords = normalizedTitle.split(/\s+/);
    const existingWords = existingTitle.split(/\s+/);
    const commonWords = newWords.filter((w) => existingWords.includes(w) && w.length > 3);

    // If more than half the words are common, consider similar
    return commonWords.length > newWords.length / 2;
  });
}
