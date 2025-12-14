/**
 * Designer agent prompt builder module
 *
 * Constructs prompts for the Designer agent role,
 * which creates design specifications and verifies design-implementation consistency.
 */

import path from 'path';
import { readTextSafe } from '../utils/files.js';
import type {
  Task,
  OrchestratorConfig,
  PlanningDocumentMessage,
  DesignSpecificationMessage,
  DesignVerificationMessage,
  DesignTokens,
  ComponentSpec,
  DiscrepancyItem,
  CompletionReportMessage,
  Platform,
} from '../types.js';

// ============================================================================
// Template Loading
// ============================================================================

/**
 * Load the designer role template
 *
 * @param templatePath - Path to the template file
 * @returns Template content or default
 */
export async function loadDesignerTemplate(templatePath: string): Promise<string> {
  const content = await readTextSafe(templatePath);
  return content || getDefaultDesignerTemplate();
}

/**
 * Get the default designer template
 *
 * @returns Default template content
 */
function getDefaultDesignerTemplate(): string {
  return `# Designer Role

You are a UI/UX Designer responsible for creating design specifications
and ensuring visual consistency between design and implementation.

## Responsibilities

1. **Design System Definition**
   - Define design tokens (colors, typography, spacing)
   - Create consistent visual language
   - Establish component specifications

2. **UI Design**
   - Design interfaces based on planning documents
   - Create intuitive and accessible layouts
   - Consider responsive design requirements

3. **Design-Code Verification**
   - Compare implemented UI with design specifications
   - Identify visual discrepancies
   - Provide feedback for corrections

## Guidelines

- Maintain consistency across all components
- Follow platform-specific design guidelines
- Prioritize accessibility and usability
- Document all design decisions
- Use standard design token naming conventions`;
}

// ============================================================================
// Prompt Builders
// ============================================================================

/**
 * Build prompt for creating design specification
 *
 * @param task - Task to design
 * @param planningDoc - Planning document from planner
 * @param config - Project configuration
 * @param template - Optional custom template
 * @returns Complete prompt string
 */
export function buildDesignPrompt(
  task: Task,
  planningDoc: PlanningDocumentMessage,
  config: OrchestratorConfig,
  template?: string
): string {
  const roleTemplate = template || getDefaultDesignerTemplate();
  const projectPath = config.project.path;
  const messageFilePath = path.join(
    projectPath,
    '.claude-orchestrator',
    'messages',
    'to-tech-lead.json'
  );

  const figmaContext = config.figma?.enabled
    ? `\n### Figma Integration\nFigma integration is enabled. If available, reference the Figma file for design tokens.`
    : '';

  return `${roleTemplate}

---

## Current Design Task

### Task Details
- **ID**: ${task.id}
- **Title**: ${task.title}
- **Platform**: ${config.platform}
${figmaContext}

### Planning Document Input

**Product Vision**: ${planningDoc.productVision}

**Core Features**:
${planningDoc.coreFeatures.map((f) => `- **${f.name}** (${f.priority}): ${f.description}`).join('\n')}

**User Flows**:
${planningDoc.userFlows.map((flow) => `
#### ${flow.name}
${flow.description}
${flow.steps.map((s) => `${s.step}. ${s.action} → ${s.expectedResult}`).join('\n')}`).join('\n')}

**Technical Requirements**:
${planningDoc.requirements.map((r) => `- ${r}`).join('\n')}

---

## Your Task

1. Define design tokens based on the planning document
2. Create component specifications
3. Ensure platform-appropriate design patterns
4. Document the design system

## Required Output

You MUST write your design specification to the following file:
\`${messageFilePath}\`

The JSON format should be:
\`\`\`json
{
  "messages": [{
    "type": "design_specification",
    "taskId": "${task.id}",
    "platform": "${config.platform}",
    "timestamp": "${new Date().toISOString()}",
    "designTokens": {
      "colors": {
        "primary": "#1E88E5",
        "secondary": "#FF5722",
        "background": "#FFFFFF",
        "surface": "#F5F5F5",
        "text-primary": "#212121",
        "text-secondary": "#757575",
        "error": "#D32F2F",
        "success": "#388E3C"
      },
      "fonts": {
        "heading": {
          "family": "Inter",
          "size": "24px",
          "weight": "700",
          "lineHeight": "1.3"
        },
        "body": {
          "family": "Inter",
          "size": "16px",
          "weight": "400",
          "lineHeight": "1.5"
        },
        "caption": {
          "family": "Inter",
          "size": "12px",
          "weight": "400",
          "lineHeight": "1.4"
        }
      },
      "spacing": {
        "xs": "4px",
        "sm": "8px",
        "md": "16px",
        "lg": "24px",
        "xl": "32px"
      },
      "borderRadius": {
        "sm": "4px",
        "md": "8px",
        "lg": "16px",
        "full": "9999px"
      }
    },
    "componentSpecs": [
      {
        "name": "ComponentName",
        "description": "What this component does",
        "usedTokens": ["primary", "md", "body"]
      }
    ],
    "figmaReference": "https://figma.com/file/... (optional)"
  }],
  "lastRead": null
}
\`\`\`

${getPlatformDesignGuidelines(config.platform)}

Begin creating the design specification now.`;
}

/**
 * Build prompt for design verification
 *
 * @param task - Task to verify
 * @param designSpec - Original design specification
 * @param report - Completion report from developer
 * @param discrepancies - Discrepancies found by automated comparison
 * @param config - Project configuration
 * @returns Complete prompt string
 */
export function buildDesignVerificationPrompt(
  _task: Task,
  designSpec: DesignSpecificationMessage,
  report: CompletionReportMessage,
  discrepancies: DiscrepancyItem[],
  config: OrchestratorConfig
): string {
  const roleTemplate = getDefaultDesignerTemplate();
  const projectPath = config.project.path;
  const reportFilePath = path.join(
    projectPath,
    '.claude-orchestrator',
    'design',
    'verification-report.json'
  );

  const discrepancySection =
    discrepancies.length > 0
      ? `
### Automated Discrepancy Report

The following discrepancies were detected automatically:

| Token | Type | Expected | Actual | Severity |
|-------|------|----------|--------|----------|
${discrepancies.map((d) => `| ${d.tokenName} | ${d.type} | ${d.expectedValue} | ${d.actualValue} | ${d.severity} |`).join('\n')}`
      : `
### Automated Discrepancy Report

No discrepancies were detected by automated comparison.`;

  return `${roleTemplate}

---

## Design Verification Task

You are verifying that the developer's implementation matches the design specification.

### Original Design Tokens

**Colors**:
${Object.entries(designSpec.designTokens.colors)
  .map(([name, value]) => `- ${name}: ${value}`)
  .join('\n')}

**Fonts**:
${Object.entries(designSpec.designTokens.fonts)
  .map(([name, token]) => `- ${name}: ${token.family} ${token.size} ${token.weight}`)
  .join('\n')}

**Spacing**:
${Object.entries(designSpec.designTokens.spacing)
  .map(([name, value]) => `- ${name}: ${value}`)
  .join('\n')}

### Developer's Implementation Report

- **Files Created**: ${report.filesCreated?.join(', ') || 'None'}
- **Files Modified**: ${report.filesModified?.join(', ') || 'None'}
- **Build Status**: ${report.buildResult?.status || 'Unknown'}

${discrepancySection}

---

## Your Task

1. Review the automated discrepancy report
2. Verify the severity of each discrepancy
3. Determine if the implementation is acceptable
4. Provide recommendations for fixes if needed

## Required Output

Write your verification report to:
\`${reportFilePath}\`

NOTE: This is for informational purposes. The task will proceed regardless of discrepancies,
but the report will be included in the logs for future reference.

Provide your assessment now.`;
}

// ============================================================================
// Message Formatting
// ============================================================================

/**
 * Create a design specification message object
 *
 * @param taskId - Task ID
 * @param platform - Target platform
 * @param designTokens - Design tokens
 * @param componentSpecs - Component specifications
 * @param figmaReference - Optional Figma file reference
 * @returns Design specification message
 */
export function createDesignSpecMessage(
  taskId: string,
  platform: Platform,
  designTokens: DesignTokens,
  componentSpecs: ComponentSpec[],
  figmaReference?: string
): DesignSpecificationMessage {
  return {
    type: 'design_specification',
    taskId,
    platform,
    timestamp: new Date().toISOString(),
    designTokens,
    componentSpecs,
    figmaReference,
  };
}

/**
 * Create a design verification message object
 *
 * @param taskId - Task ID
 * @param platform - Target platform
 * @param verified - Whether design matches implementation
 * @param matchPercentage - Match percentage
 * @param totalChecked - Total tokens checked
 * @param discrepancies - List of discrepancies
 * @param summary - Summary text
 * @returns Design verification message
 */
export function createDesignVerificationMessage(
  taskId: string,
  platform: Platform,
  verified: boolean,
  matchPercentage: number,
  totalChecked: number,
  discrepancies: DiscrepancyItem[],
  summary: string
): DesignVerificationMessage {
  return {
    type: 'design_verification',
    taskId,
    platform,
    timestamp: new Date().toISOString(),
    verified,
    matchPercentage,
    totalChecked,
    discrepancies,
    summary,
  };
}

/**
 * Create a component specification object
 *
 * @param name - Component name
 * @param description - Component description
 * @param usedTokens - Tokens used by this component
 * @param figmaNodeId - Optional Figma node ID
 * @returns Component specification
 */
export function createComponentSpec(
  name: string,
  description: string,
  usedTokens: string[],
  figmaNodeId?: string
): ComponentSpec {
  return {
    name,
    description,
    usedTokens,
    figmaNodeId,
  };
}

// ============================================================================
// Prompt Helpers
// ============================================================================

/**
 * Get platform-specific design guidelines
 *
 * @param platform - Target platform
 * @returns Design guidelines
 */
export function getPlatformDesignGuidelines(platform: string): string {
  switch (platform) {
    case 'android':
      return `
## Android Design Guidelines

- Follow Material Design 3 principles
- Use Material color system (primary, secondary, tertiary)
- Implement dynamic color support where applicable
- Use standard Material spacing (4dp grid)
- Follow elevation and shadow guidelines
- Ensure touch targets are at least 48dp`;

    case 'ios':
      return `
## iOS Design Guidelines

- Follow Human Interface Guidelines
- Use SF Pro or SF Compact fonts
- Implement dynamic type support
- Use semantic colors for dark mode support
- Follow safe area guidelines
- Ensure touch targets are at least 44pt`;

    case 'web':
      return `
## Web Design Guidelines

- Use CSS custom properties for tokens
- Implement responsive breakpoints
- Follow WCAG 2.1 AA accessibility standards
- Use relative units (rem, em) for typography
- Implement focus states for keyboard navigation
- Consider reduced motion preferences`;

    default:
      return `
## General Design Guidelines

- Maintain visual hierarchy
- Ensure sufficient color contrast
- Use consistent spacing and alignment
- Implement clear focus states
- Consider accessibility requirements`;
  }
}

/**
 * Get default design tokens for a platform
 *
 * @param platform - Target platform
 * @returns Default design tokens
 */
export function getDefaultDesignTokens(platform: string): DesignTokens {
  const baseTokens: DesignTokens = {
    colors: {
      primary: '#1E88E5',
      secondary: '#FF5722',
      background: '#FFFFFF',
      surface: '#F5F5F5',
      'text-primary': '#212121',
      'text-secondary': '#757575',
      error: '#D32F2F',
      success: '#388E3C',
    },
    fonts: {
      heading: {
        family: 'Inter',
        size: '24px',
        weight: '700',
        lineHeight: '1.3',
      },
      body: {
        family: 'Inter',
        size: '16px',
        weight: '400',
        lineHeight: '1.5',
      },
      caption: {
        family: 'Inter',
        size: '12px',
        weight: '400',
        lineHeight: '1.4',
      },
    },
    spacing: {
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px',
    },
    borderRadius: {
      sm: '4px',
      md: '8px',
      lg: '16px',
      full: '9999px',
    },
  };

  // Platform-specific adjustments
  if (platform === 'android') {
    baseTokens.fonts.heading.family = 'Roboto';
    baseTokens.fonts.body.family = 'Roboto';
    baseTokens.fonts.caption.family = 'Roboto';
  } else if (platform === 'ios') {
    baseTokens.fonts.heading.family = 'SF Pro Display';
    baseTokens.fonts.body.family = 'SF Pro Text';
    baseTokens.fonts.caption.family = 'SF Pro Text';
  }

  return baseTokens;
}
