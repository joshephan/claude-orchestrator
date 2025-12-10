/**
 * Task queue management module
 *
 * Handles task queue operations including adding, updating,
 * and transitioning tasks through their lifecycle.
 */

import { getFilePath, readJSON, writeJSON, resolvePath } from '../utils/files.js';
import type { Task, TaskQueue, TaskStatus, TaskPriority } from '../types.js';

// ============================================================================
// Queue Loading/Saving
// ============================================================================

/**
 * Load the task queue for a project
 *
 * @param projectPath - Path to the project
 * @returns Task queue
 */
export async function loadQueue(projectPath: string): Promise<TaskQueue> {
  const absolutePath = resolvePath(projectPath);
  return readJSON<TaskQueue>(getFilePath(absolutePath, 'queue'));
}

/**
 * Save the task queue for a project
 *
 * @param projectPath - Path to the project
 * @param queue - Queue to save
 */
export async function saveQueue(projectPath: string, queue: TaskQueue): Promise<void> {
  const absolutePath = resolvePath(projectPath);
  queue.lastUpdated = new Date().toISOString();
  await writeJSON(getFilePath(absolutePath, 'queue'), queue);
}

// ============================================================================
// Task ID Generation
// ============================================================================

/**
 * Generate a new unique task ID
 *
 * @param queue - Current queue to check for existing IDs
 * @returns New unique task ID
 */
export function generateTaskId(queue: TaskQueue): string {
  // Find highest existing ID number
  const allTasks = [...queue.tasks, ...queue.completed];
  let maxNum = 0;

  for (const task of allTasks) {
    const match = task.id.match(/^task-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  // Generate new ID with zero-padded number
  const newNum = maxNum + 1;
  return `task-${String(newNum).padStart(3, '0')}`;
}

// ============================================================================
// Task Operations
// ============================================================================

/**
 * Add a new task to the queue
 *
 * @param projectPath - Path to the project
 * @param task - Partial task data (id will be generated)
 * @returns Created task
 */
export async function addTask(
  projectPath: string,
  task: Omit<Task, 'id' | 'status' | 'createdAt'>
): Promise<Task> {
  const queue = await loadQueue(projectPath);

  const newTask: Task = {
    ...task,
    id: generateTaskId(queue),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  queue.tasks.push(newTask);
  await saveQueue(projectPath, queue);

  return newTask;
}

/**
 * Add multiple tasks to the queue
 *
 * @param projectPath - Path to the project
 * @param tasks - Array of partial task data
 * @returns Created tasks
 */
export async function addTasks(
  projectPath: string,
  tasks: Omit<Task, 'id' | 'status' | 'createdAt'>[]
): Promise<Task[]> {
  const queue = await loadQueue(projectPath);
  const createdTasks: Task[] = [];

  for (const task of tasks) {
    const newTask: Task = {
      ...task,
      id: generateTaskId({ ...queue, tasks: [...queue.tasks, ...createdTasks] }),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    createdTasks.push(newTask);
  }

  queue.tasks.push(...createdTasks);
  await saveQueue(projectPath, queue);

  return createdTasks;
}

/**
 * Get a task by ID
 *
 * @param projectPath - Path to the project
 * @param taskId - Task ID to find
 * @returns Task or undefined
 */
export async function getTask(
  projectPath: string,
  taskId: string
): Promise<Task | undefined> {
  const queue = await loadQueue(projectPath);
  return queue.tasks.find((t) => t.id === taskId) ||
    queue.completed.find((t) => t.id === taskId);
}

/**
 * Update a task's data
 *
 * @param projectPath - Path to the project
 * @param taskId - Task ID to update
 * @param updates - Partial task updates
 * @returns Updated task
 */
export async function updateTask(
  projectPath: string,
  taskId: string,
  updates: Partial<Omit<Task, 'id' | 'createdAt'>>
): Promise<Task> {
  const queue = await loadQueue(projectPath);
  const taskIndex = queue.tasks.findIndex((t) => t.id === taskId);

  if (taskIndex === -1) {
    throw new Error(`Task not found: ${taskId}`);
  }

  queue.tasks[taskIndex] = {
    ...queue.tasks[taskIndex],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await saveQueue(projectPath, queue);
  return queue.tasks[taskIndex];
}

/**
 * Update a task's status
 *
 * @param projectPath - Path to the project
 * @param taskId - Task ID to update
 * @param status - New status
 * @returns Updated task
 */
export async function updateTaskStatus(
  projectPath: string,
  taskId: string,
  status: TaskStatus
): Promise<Task> {
  return updateTask(projectPath, taskId, { status });
}

// ============================================================================
// Task Lifecycle
// ============================================================================

/**
 * Set the current task being processed
 *
 * @param projectPath - Path to the project
 * @param taskId - Task ID to set as current (null to clear)
 */
export async function setCurrentTask(
  projectPath: string,
  taskId: string | null
): Promise<void> {
  const queue = await loadQueue(projectPath);
  queue.current = taskId;
  await saveQueue(projectPath, queue);
}

/**
 * Complete a task and move it to the completed list
 *
 * @param projectPath - Path to the project
 * @param taskId - Task ID to complete
 */
export async function completeTask(projectPath: string, taskId: string): Promise<void> {
  const queue = await loadQueue(projectPath);
  const taskIndex = queue.tasks.findIndex((t) => t.id === taskId);

  if (taskIndex === -1) {
    throw new Error(`Task not found: ${taskId}`);
  }

  // Update task status and move to completed
  const task = {
    ...queue.tasks[taskIndex],
    status: 'completed' as TaskStatus,
    updatedAt: new Date().toISOString(),
  };

  queue.tasks.splice(taskIndex, 1);
  queue.completed.push(task);

  // Clear current if this was the current task
  if (queue.current === taskId) {
    queue.current = null;
  }

  await saveQueue(projectPath, queue);
}

/**
 * Reject a task
 *
 * @param projectPath - Path to the project
 * @param taskId - Task ID to reject
 * @param reason - Rejection reason
 */
export async function rejectTask(
  projectPath: string,
  taskId: string,
  reason: string
): Promise<void> {
  await updateTask(projectPath, taskId, {
    status: 'rejected',
    rejectionReason: reason,
  });
}

/**
 * Reset a task back to pending
 *
 * @param projectPath - Path to the project
 * @param taskId - Task ID to reset
 */
export async function resetTask(projectPath: string, taskId: string): Promise<void> {
  await updateTask(projectPath, taskId, {
    status: 'pending',
    rejectionReason: undefined,
  });
}

// ============================================================================
// Task Queries
// ============================================================================

/**
 * Get pending tasks
 *
 * @param projectPath - Path to the project
 * @returns Array of pending tasks
 */
export async function getPendingTasks(projectPath: string): Promise<Task[]> {
  const queue = await loadQueue(projectPath);
  return queue.tasks.filter((t) => t.status === 'pending');
}

/**
 * Get in-progress tasks
 *
 * @param projectPath - Path to the project
 * @returns Array of in-progress tasks
 */
export async function getInProgressTasks(projectPath: string): Promise<Task[]> {
  const queue = await loadQueue(projectPath);
  return queue.tasks.filter((t) => t.status === 'in_progress');
}

/**
 * Get tasks awaiting review
 *
 * @param projectPath - Path to the project
 * @returns Array of tasks awaiting review
 */
export async function getAwaitingReviewTasks(projectPath: string): Promise<Task[]> {
  const queue = await loadQueue(projectPath);
  return queue.tasks.filter((t) => t.status === 'awaiting_review');
}

/**
 * Get the next pending task by priority
 *
 * @param projectPath - Path to the project
 * @returns Next pending task or undefined
 */
export async function getNextPendingTask(projectPath: string): Promise<Task | undefined> {
  const pending = await getPendingTasks(projectPath);

  if (pending.length === 0) return undefined;

  // Sort by priority (high > medium > low) then by creation date
  const priorityOrder: Record<TaskPriority, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };

  pending.sort((a, b) => {
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;

    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return pending[0];
}

/**
 * Get queue statistics
 *
 * @param projectPath - Path to the project
 * @returns Queue statistics
 */
export async function getQueueStats(projectPath: string): Promise<{
  pending: number;
  inProgress: number;
  awaitingReview: number;
  completed: number;
  rejected: number;
  total: number;
}> {
  const queue = await loadQueue(projectPath);

  const pending = queue.tasks.filter((t) => t.status === 'pending').length;
  const inProgress = queue.tasks.filter((t) => t.status === 'in_progress').length;
  const awaitingReview = queue.tasks.filter((t) => t.status === 'awaiting_review').length;
  const rejected = queue.tasks.filter((t) => t.status === 'rejected').length;
  const completed = queue.completed.length;

  return {
    pending,
    inProgress,
    awaitingReview,
    completed,
    rejected,
    total: queue.tasks.length + completed,
  };
}

/**
 * Check if there are any tasks to process
 *
 * @param projectPath - Path to the project
 * @returns Whether there are processable tasks
 */
export async function hasTasksToProcess(projectPath: string): Promise<boolean> {
  const pending = await getPendingTasks(projectPath);
  const inProgress = await getInProgressTasks(projectPath);
  return pending.length > 0 || inProgress.length > 0;
}
