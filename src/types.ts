/**
 * TypeScript type definitions for Claude Orchestrator
 *
 * This module contains all interfaces and types used throughout the application.
 */

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Project information stored in config
 */
export interface ProjectInfo {
  /** Project name (usually from package.json) */
  name: string;
  /** Absolute path to the project directory */
  path: string;
}

/**
 * Figma integration configuration
 */
export interface FigmaConfig {
  /** Whether Figma integration is enabled */
  enabled: boolean;
  /** Figma file key */
  fileKey?: string;
  /** Figma access token */
  accessToken?: string;
}

/**
 * Main configuration stored in .claude-orchestrator/config.json
 */
export interface OrchestratorConfig {
  /** Project information */
  project: ProjectInfo;
  /** Development scope description */
  scope: string;
  /** List of development goals */
  goals: string[];
  /** Target platform (android, ios, web, custom) */
  platform: Platform;
  /** Maximum tasks to process per cycle */
  maxTasks: number;
  /** Whether to run in continuous discovery mode */
  continuous: boolean;
  /** Timestamp when initialized */
  initialized: string;
  /** Figma integration configuration (optional) */
  figma?: FigmaConfig;
}

/**
 * Supported target platforms
 */
export type Platform = 'android' | 'ios' | 'web' | 'custom';

// ============================================================================
// Task Types
// ============================================================================

/**
 * Task status in the queue lifecycle
 */
export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'awaiting_review'
  | 'completed'
  | 'rejected';

/**
 * Task priority levels
 */
export type TaskPriority = 'high' | 'medium' | 'low';

/**
 * Reference to web implementation files
 */
export interface WebReference {
  /** List of reference file paths */
  files: string[];
}

/**
 * Target directory configuration for a platform
 */
export interface PlatformTarget {
  /** Target directory path */
  targetPath: string;
  /** List of files that should be created */
  requiredFiles?: string[];
}

/**
 * A task in the queue
 */
export interface Task {
  /** Unique task identifier */
  id: string;
  /** Task type (e.g., feature_implementation, bug_fix) */
  type: string;
  /** Task priority */
  priority: TaskPriority;
  /** Short task title */
  title: string;
  /** Detailed description of the task */
  description: string;
  /** Reference to web implementation */
  webReference?: WebReference;
  /** Android target configuration */
  androidTarget?: PlatformTarget;
  /** iOS target configuration */
  iosTarget?: PlatformTarget;
  /** Web target configuration */
  webTarget?: PlatformTarget;
  /** List of acceptance criteria */
  acceptanceCriteria?: string[];
  /** Current task status */
  status: TaskStatus;
  /** ISO timestamp when created */
  createdAt: string;
  /** ISO timestamp when last updated */
  updatedAt?: string;
  /** Reason for rejection if rejected */
  rejectionReason?: string;
}

/**
 * Task queue stored in .claude-orchestrator/queue.json
 */
export interface TaskQueue {
  /** Queue version for compatibility */
  version: string;
  /** Pending and in-progress tasks */
  tasks: Task[];
  /** Completed tasks */
  completed: Task[];
  /** Currently processing task ID */
  current: string | null;
  /** ISO timestamp when last updated */
  lastUpdated: string;
}

// ============================================================================
// Agent Types
// ============================================================================

/**
 * Agent status values
 */
export type AgentStatus =
  | 'idle'
  | 'planning'
  | 'designing'
  | 'analyzing'
  | 'assigning'
  | 'implementing'
  | 'reviewing'
  | 'verifying';

/**
 * Planner agent status
 */
export interface PlannerStatus {
  /** Current status */
  status: AgentStatus;
  /** ISO timestamp of last activity */
  lastActivity: string;
}

/**
 * Designer agent status
 */
export interface DesignerStatus {
  /** Current status */
  status: AgentStatus;
  /** ISO timestamp of last activity */
  lastActivity: string;
}

/**
 * Tech Lead agent status (formerly Team Lead)
 */
export interface TechLeadStatus {
  /** Current status */
  status: AgentStatus;
  /** ISO timestamp of last activity */
  lastActivity: string;
}

/**
 * Team lead agent status
 * @deprecated Use TechLeadStatus instead
 */
export interface TeamLeadStatus {
  /** Current status */
  status: AgentStatus;
  /** ISO timestamp of last activity */
  lastActivity: string;
}

/**
 * Developer agent status
 */
export interface DeveloperStatus {
  /** Current status */
  status: AgentStatus;
  /** Currently assigned task ID */
  currentTask: string | null;
  /** ISO timestamp of last activity */
  lastActivity: string;
}

/**
 * Orchestrator process status
 */
export interface OrchestratorStatus {
  /** Whether orchestrator is running */
  running: boolean;
  /** Process ID if running */
  pid: number | null;
  /** ISO timestamp when started */
  startedAt: string | null;
}

/**
 * Last cycle statistics
 */
export interface CycleStats {
  /** Cycle number */
  number: number;
  /** Tasks completed in this cycle */
  completed: number;
  /** Tasks failed in this cycle */
  failed: number;
  /** Tasks remaining after this cycle */
  remaining: number;
}

/**
 * Status file stored in .claude-orchestrator/status.json
 */
export interface StatusFile {
  /** Orchestrator process status */
  orchestrator: OrchestratorStatus;
  /** Planner agent status */
  planner: PlannerStatus;
  /** Designer agent status */
  designer: DesignerStatus;
  /** Tech Lead agent status */
  techLead: TechLeadStatus;
  /** Developer agent status */
  developer: DeveloperStatus;
  /** Statistics from last cycle */
  lastCycle: CycleStats | null;
}

// ============================================================================
// Message Types
// ============================================================================

/**
 * Message types for inter-agent communication
 */
export type MessageType =
  | 'task_assignment'
  | 'completion_report'
  | 'review_result'
  | 'discovery_result'
  | 'planning_document'
  | 'design_specification'
  | 'design_verification';

/**
 * Base message structure
 */
export interface BaseMessage {
  /** Message type */
  type: MessageType;
  /** Related task ID */
  taskId: string;
  /** Target platform */
  platform: Platform;
  /** ISO timestamp */
  timestamp: string;
}

/**
 * Task assignment message from team lead to developer
 */
export interface TaskAssignmentMessage extends BaseMessage {
  type: 'task_assignment';
  /** Task title */
  title: string;
  /** Implementation instructions */
  instructions: string;
  /** Files to create */
  filesToCreate: string[];
  /** Architecture pattern to follow */
  architecture: string;
  /** API endpoints to implement */
  apiEndpoints?: string[];
}

/**
 * Build verification result
 */
export interface BuildResult {
  /** Build status */
  status: 'success' | 'failed' | 'not_applicable' | 'not_verified';
  /** Build command used */
  command: string;
  /** Number of errors */
  errors: number;
  /** Error output if failed */
  output?: string;
}

/**
 * Completion report message from developer to team lead
 */
export interface CompletionReportMessage extends BaseMessage {
  type: 'completion_report';
  /** Task status after implementation */
  status: 'awaiting_review';
  /** Implementation summary */
  summary: string;
  /** Files created */
  filesCreated: string[];
  /** Files modified */
  filesModified: string[];
  /** Build verification result */
  buildResult: BuildResult;
}

/**
 * Message file structure
 */
export interface MessageFile {
  /** List of messages */
  messages: (TaskAssignmentMessage | CompletionReportMessage | PlanningDocumentMessage | DesignSpecificationMessage | DesignVerificationMessage)[];
  /** ISO timestamp when last read */
  lastRead: string | null;
}

// ============================================================================
// Planning Types (Planner Agent)
// ============================================================================

/**
 * Feature definition in planning document
 */
export interface FeatureDefinition {
  /** Feature name */
  name: string;
  /** Feature description */
  description: string;
  /** Priority level */
  priority: TaskPriority;
  /** Acceptance criteria */
  acceptanceCriteria?: string[];
}

/**
 * User flow step
 */
export interface UserFlowStep {
  /** Step number */
  step: number;
  /** Action description */
  action: string;
  /** Expected result */
  expectedResult: string;
}

/**
 * User flow definition
 */
export interface UserFlow {
  /** Flow name */
  name: string;
  /** Flow description */
  description: string;
  /** Flow steps */
  steps: UserFlowStep[];
}

/**
 * Planning document message from Planner to Designer
 */
export interface PlanningDocumentMessage extends BaseMessage {
  type: 'planning_document';
  /** Product vision statement */
  productVision: string;
  /** Core features list */
  coreFeatures: FeatureDefinition[];
  /** User flows */
  userFlows: UserFlow[];
  /** Technical requirements */
  requirements: string[];
}

// ============================================================================
// Design Types (Designer Agent)
// ============================================================================

/**
 * Font token definition
 */
export interface FontToken {
  /** Font family name */
  family: string;
  /** Font size (e.g., "16px") */
  size: string;
  /** Font weight (e.g., "400", "bold") */
  weight: string;
  /** Line height (e.g., "1.5", "24px") */
  lineHeight?: string;
  /** Letter spacing */
  letterSpacing?: string;
}

/**
 * Design tokens extracted from Figma or defined by designer
 */
export interface DesignTokens {
  /** Color tokens (name -> hex/rgb value) */
  colors: Record<string, string>;
  /** Font tokens */
  fonts: Record<string, FontToken>;
  /** Spacing tokens (name -> px value) */
  spacing: Record<string, string>;
  /** Border radius tokens */
  borderRadius?: Record<string, string>;
  /** Shadow tokens */
  shadows?: Record<string, string>;
}

/**
 * Component specification
 */
export interface ComponentSpec {
  /** Component name */
  name: string;
  /** Component description */
  description: string;
  /** Design tokens used by this component */
  usedTokens: string[];
  /** Figma node reference (optional) */
  figmaNodeId?: string;
}

/**
 * Design specification message from Designer to Tech Lead
 */
export interface DesignSpecificationMessage extends BaseMessage {
  type: 'design_specification';
  /** Design tokens */
  designTokens: DesignTokens;
  /** Component specifications */
  componentSpecs: ComponentSpec[];
  /** Figma file reference URL (optional) */
  figmaReference?: string;
}

/**
 * Design discrepancy item
 */
export interface DiscrepancyItem {
  /** Token type (color, font, spacing, etc.) */
  type: 'color' | 'font' | 'spacing' | 'borderRadius' | 'shadow' | 'other';
  /** Token name */
  tokenName: string;
  /** Expected value from design */
  expectedValue: string;
  /** Actual value from implementation */
  actualValue: string;
  /** Difference description */
  difference: string;
  /** Severity level */
  severity: 'error' | 'warning' | 'info';
}

/**
 * Design verification message (result of comparing design vs implementation)
 */
export interface DesignVerificationMessage extends BaseMessage {
  type: 'design_verification';
  /** Whether design matches implementation */
  verified: boolean;
  /** Match percentage (0-100) */
  matchPercentage: number;
  /** Total tokens checked */
  totalChecked: number;
  /** List of discrepancies found */
  discrepancies: DiscrepancyItem[];
  /** Summary report */
  summary: string;
}

// ============================================================================
// CLI Types
// ============================================================================

/**
 * Options for the start command
 */
export interface StartOptions {
  /** Development scope */
  scope?: string;
  /** Comma-separated goals */
  goals?: string;
  /** Maximum tasks per cycle */
  maxTasks?: number;
  /** Target platform */
  platform?: Platform;
  /** Enable continuous mode */
  continuous?: boolean;
  /** Dry run without execution */
  dryRun?: boolean;
  /** Skip permission prompts */
  skipPermissions?: boolean;
  /** Quiet mode - minimal output */
  quiet?: boolean;
}

/**
 * Options for the logs command
 */
export interface LogsOptions {
  /** Number of entries to show */
  tail?: number;
  /** Stream new entries */
  follow?: boolean;
  /** Filter by task ID */
  task?: string;
}

/**
 * Validation result from environment checks
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
  /** Suggestion for fixing the issue */
  suggestion?: string;
}

// ============================================================================
// Process Types
// ============================================================================

/**
 * Options for spawning a Claude agent
 */
export interface SpawnOptions {
  /** Working directory */
  cwd: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Environment variables */
  env?: Record<string, string>;
  /** Skip permission prompts */
  skipPermissions?: boolean;
}

/**
 * Result from running a Claude agent
 */
export interface AgentResult {
  /** Whether the agent succeeded */
  success: boolean;
  /** Output from the agent */
  output: string;
  /** Error output if any */
  error?: string;
  /** Exit code */
  exitCode: number;
}

// ============================================================================
// Logger Types
// ============================================================================

/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Log entry structure
 */
export interface LogEntry {
  /** Log level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** ISO timestamp */
  timestamp: string;
  /** Additional context data */
  context?: Record<string, unknown>;
}
