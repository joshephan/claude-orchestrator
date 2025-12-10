# Agent Communication Protocol

This document defines the communication protocol between agents in the Claude Orchestrator system.

## Overview

The orchestrator uses a file-based message passing system for inter-agent communication. All messages are stored as JSON files in the `.claude-orchestrator/tasks/messages/` directory.

## Message Flow

```
┌─────────────┐     to-developer.json     ┌─────────────┐
│  Team Lead  │ ────────────────────────▶ │  Developer  │
└─────────────┘                           └─────────────┘
      ▲                                          │
      │         to-team-lead.json                │
      └──────────────────────────────────────────┘
```

## Message Types

### 1. Task Assignment (Team Lead → Developer)

**File**: `to-developer.json`

**Structure**:
```json
{
  "messages": [
    {
      "type": "task_assignment",
      "taskId": "task-001",
      "platform": "web|android|ios|custom",
      "title": "Task Title",
      "instructions": "Detailed implementation instructions",
      "filesToCreate": ["path/to/file1.ts", "path/to/file2.ts"],
      "architecture": "Architecture pattern to follow",
      "apiEndpoints": ["GET /api/resource", "POST /api/resource"],
      "timestamp": "2024-01-01T00:00:00.000Z"
    }
  ],
  "lastRead": null
}
```

**Required Fields**:
- `type`: Must be "task_assignment"
- `taskId`: Unique task identifier
- `platform`: Target platform
- `title`: Task title for reference
- `instructions`: Detailed implementation guide
- `filesToCreate`: List of files to create
- `architecture`: Architecture pattern
- `timestamp`: ISO 8601 timestamp

**Optional Fields**:
- `apiEndpoints`: API endpoints to implement

### 2. Completion Report (Developer → Team Lead)

**File**: `to-team-lead.json`

**Structure**:
```json
{
  "messages": [
    {
      "type": "completion_report",
      "taskId": "task-001",
      "platform": "web|android|ios|custom",
      "status": "awaiting_review",
      "summary": "Brief summary of implementation",
      "filesCreated": ["path/to/created/file.ts"],
      "filesModified": ["path/to/modified/file.ts"],
      "buildResult": {
        "status": "success|failed|not_applicable|not_verified",
        "command": "npm run build",
        "errors": 0,
        "output": "Build output if failed"
      },
      "timestamp": "2024-01-01T00:00:00.000Z"
    }
  ],
  "lastRead": null
}
```

**Required Fields**:
- `type`: Must be "completion_report"
- `taskId`: Task identifier being reported
- `platform`: Target platform
- `status`: Must be "awaiting_review"
- `summary`: Implementation summary
- `filesCreated`: List of new files
- `filesModified`: List of modified files
- `buildResult`: Build verification result
- `timestamp`: ISO 8601 timestamp

### 3. Build Result Object

**Structure**:
```json
{
  "status": "success|failed|not_applicable|not_verified",
  "command": "The build command executed",
  "errors": 0,
  "output": "Optional: Error output or relevant messages"
}
```

**Status Values**:
- `success`: Build completed without errors
- `failed`: Build failed with errors
- `not_applicable`: Build not applicable (e.g., iOS on Windows)
- `not_verified`: Build was not run (not recommended)

## Message Lifecycle

### Writing Messages

1. Read the existing message file
2. Append new message to the `messages` array
3. Write the updated file

### Reading Messages

1. Read the message file
2. Find messages matching the current task
3. Process the message
4. Update `lastRead` timestamp

### Clearing Messages

After task completion, message files are cleared:
```json
{
  "messages": [],
  "lastRead": "2024-01-01T00:00:00.000Z"
}
```

## Task State Transitions

```
     ┌─────────────────────────────────────────────────────┐
     │                                                     │
     ▼                                                     │
┌─────────┐    ┌─────────────┐    ┌─────────────────┐    ┌───────────┐
│ pending │───▶│ in_progress │───▶│ awaiting_review │───▶│ completed │
└─────────┘    └─────────────┘    └─────────────────┘    └───────────┘
                     │                    │
                     │                    │
                     │                    ▼
                     │              ┌──────────┐
                     └─────────────▶│ rejected │
                                    └──────────┘
```

**Transitions**:
- `pending` → `in_progress`: Team Lead starts analyzing
- `in_progress` → `awaiting_review`: Developer submits report
- `awaiting_review` → `completed`: Team Lead approves
- `awaiting_review` → `rejected`: Team Lead rejects
- `rejected` → `pending`: Task reset for retry

## Error Handling

### Missing Instructions
If developer cannot find instructions:
- Report error in completion report
- Set buildResult.status to "not_verified"
- Include explanation in summary

### Build Failures
If build fails:
- Attempt to fix errors
- If unfixable, report honestly
- Include error output in buildResult.output

### Review Failures
If review identifies issues:
- Task marked as rejected
- Rejection reason stored in task
- Task can be retried after fixes

## File Locations

All paths are relative to project root:

```
.claude-orchestrator/
├── tasks/
│   ├── queue.json           # Task queue
│   ├── status.json          # Agent status
│   └── messages/
│       ├── to-developer.json
│       └── to-team-lead.json
└── logs/
    └── log.md               # Development log
```

## Best Practices

1. **Always include timestamps** in all messages
2. **Validate JSON** before writing
3. **Handle missing files** gracefully
4. **Clear messages** after task completion
5. **Log important events** for debugging
6. **Use consistent formats** across all messages
