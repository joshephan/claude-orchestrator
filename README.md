# Claude Orchestrator

**THIS IS NOT OFFICIAL CLAUDE CODE TOOL**

A CLI tool for orchestrating multi-agent development workflows using Claude Code. This tool manages a team lead and developer agent collaboration system to automate software development tasks.

## Features

- **Multi-Agent Orchestration**: Coordinate team lead and developer agents
- **Project Management**: Initialize and manage development projects
- **Task Queue**: Automatic task discovery, assignment, and tracking
- **Progress Monitoring**: Real-time status updates and logging
- **Checkpoint Recovery**: Stop and resume workflows at any point

## Prerequisites

- Node.js >= 18.0.0
- Claude Code CLI installed and authenticated

## Installation

```bash
# Install globally
npm install -g @graygate/claude-orchestrator

# Or run directly with npx
npx @graygate/claude-orchestrator
```

## Quick Start

### 1. Initialize a Project

```bash
cd your-project
claude-orchestrator init
```

### 2. Start Development

```bash
claude-orchestrator start --scope "Implement user authentication" --goals "Login,Register,Password Reset"
```

### 3. Monitor Progress

```bash
# View current status
claude-orchestrator status

# Watch logs
claude-orchestrator logs --follow
```

## Commands

### `claude-orchestrator init`

Initialize the orchestrator in a project directory.

```bash
claude-orchestrator init [directory]
```

Options:
- `[directory]` - Target project directory (default: current directory)

### `claude-orchestrator start`

Start the orchestration process.

```bash
claude-orchestrator start [options]
```

Options:
- `--scope <scope>` - Development scope description
- `--goals <goals>` - Comma-separated development goals
- `--max-tasks <n>` - Maximum tasks per cycle (default: 10)
- `--platform <platform>` - Target platform (android, ios, web, custom)
- `--continuous` - Enable continuous discovery and implementation
- `--dry-run` - Preview without execution

### `claude-orchestrator status`

Show current orchestration status.

```bash
claude-orchestrator status
```

Displays:
- Active agents and their status
- Current task being processed
- Queue statistics
- Recent activity

### `claude-orchestrator logs`

View development logs.

```bash
claude-orchestrator logs [options]
```

Options:
- `--tail <n>` - Show last n entries
- `--follow` - Stream new log entries in real-time
- `--task <id>` - Filter logs by task ID

### `claude-orchestrator stop`

Stop running agents gracefully.

```bash
claude-orchestrator stop
```

This command:
- Sends graceful shutdown signal to active agents
- Saves current state for later resume
- Marks in-progress tasks appropriately

### `claude-orchestrator resume`

Resume from the last checkpoint.

```bash
claude-orchestrator resume
```

This command:
- Loads saved state from previous run
- Continues processing in-progress tasks
- Restarts agent processes

## Interactive Mode

During orchestration, you can use these keyboard shortcuts:

| Key | Action |
|-----|--------|
| `l` | Show recent log entries |
| `s` | Show current status |
| `p` | Pause after current task |
| `q` | Stop gracefully |
| `r` | Resume paused work |

## Configuration

The orchestrator creates a `.claude-orchestrator/` directory in your project with:

```
.claude-orchestrator/
├── config.json      # Project configuration
├── status.json      # Current agent status
├── queue.json       # Task queue
├── messages/        # Inter-agent communication
│   ├── to-developer.json
│   └── to-team-lead.json
└── logs/
    └── log.md       # Development log
```

### config.json

```json
{
  "project": {
    "name": "your-project",
    "path": "/absolute/path/to/project"
  },
  "scope": "Development scope description",
  "goals": ["goal1", "goal2"],
  "platform": "web",
  "maxTasks": 10,
  "continuous": false
}
```

## Workflow

```
┌─────────────────────────────────┐
│ 1. DISCOVERY (optional)         │
│    - Scan project structure     │
│    - Identify missing features  │
│    - Create tasks in queue      │
└───────────────┬─────────────────┘
                ▼
┌─────────────────────────────────┐
│ 2. TEAM LEAD                    │
│    - Analyze task requirements  │
│    - Study reference code       │
│    - Write implementation guide │
└───────────────┬─────────────────┘
                ▼
┌─────────────────────────────────┐
│ 3. DEVELOPER                    │
│    - Read instructions          │
│    - Implement features         │
│    - Run verification           │
│    - Submit completion report   │
└───────────────┬─────────────────┘
                ▼
┌─────────────────────────────────┐
│ 4. REVIEW                       │
│    - Verify implementation      │
│    - Check build status         │
│    - Log completion/rejection   │
└─────────────────────────────────┘
```

## Task States

Tasks move through these states:

```
pending → in_progress → awaiting_review → completed
                    ↓
                 rejected
```

## Development

### Build from Source

```bash
# Clone the repository
git clone https://github.com/your-username/claude-orchestrator.git
cd claude-orchestrator

# Install dependencies
npm install

# Build
npm run build

# Run locally
node bin/cli.js
```

### Run Tests

```bash
npm test
```

## Troubleshooting

### Claude Code Not Found

If you see "Claude Code CLI not found", install it with:

```bash
npm install -g @anthropic-ai/claude-code
```

### Authentication Required

If Claude Code is not authenticated, run:

```bash
claude login
```

### Task Stuck

If a task appears stuck:

1. Check status: `claude-orchestrator status`
2. View logs: `claude-orchestrator logs --tail 50`
3. Stop and resume: `claude-orchestrator stop && claude-orchestrator resume`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

Made by [Sanghoon Han from Parallax AI LLC](https://parallax.kr)
