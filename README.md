# Claude Orchestrator

**THIS IS NOT OFFICIAL CLAUDE CODE TOOL**

Stop developing. Let Claude Code handle everything.

<a href="https://www.producthunt.com/products/claude-orchestrator?embed=true&utm_source=badge-featured&utm_medium=badge&utm_source=badge-claude&#0045;orchestrator" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1048642&theme=light&t=1765370193768" alt="Claude&#0032;Orchestrator - Stop&#0032;developing&#0046;&#0032;Let&#0032;Claude&#0032;Code&#0032;handle&#0032;everything&#0046; | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>

## Features

- **4-Agent Pipeline**: Coordinate Planner, Designer, Tech Lead, and Developer agents
- **Design Token Verification**: Automatically compare design specifications with implementation
- **Project Management**: Initialize and manage development projects
- **Task Queue**: Automatic task discovery, assignment, and tracking
- **Progress Monitoring**: Real-time status updates and logging
- **Checkpoint Recovery**: Stop and resume workflows at any point
- **Figma Integration** (Optional): Extract design tokens from Figma files

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

## 4-Agent Pipeline

Claude Orchestrator uses a sophisticated 4-agent pipeline to handle development tasks:

```
┌─────────────────────────────────┐
│ 1. DISCOVERY                    │
│    - Scan project structure     │
│    - Identify tasks             │
│    - Create tasks in queue      │
└───────────────┬─────────────────┘
                ▼
┌─────────────────────────────────┐
│ 2. PLANNER                      │
│    - Define product vision      │
│    - Break down features        │
│    - Design user flows          │
│    - Document requirements      │
└───────────────┬─────────────────┘
                ▼
┌─────────────────────────────────┐
│ 3. DESIGNER                     │
│    - Create design tokens       │
│    - Define color, typography   │
│    - Specify component styles   │
│    - (Optional) Figma sync      │
└───────────────┬─────────────────┘
                ▼
┌─────────────────────────────────┐
│ 4. TECH LEAD                    │
│    - Analyze planning docs      │
│    - Review design specs        │
│    - Write implementation guide │
│    - Define architecture        │
└───────────────┬─────────────────┘
                ▼
┌─────────────────────────────────┐
│ 5. DEVELOPER                    │
│    - Read instructions          │
│    - Implement features         │
│    - Apply design tokens        │
│    - Run build verification     │
└───────────────┬─────────────────┘
                ▼
┌─────────────────────────────────┐
│ 6. REVIEW & VERIFICATION        │
│    - Tech Lead reviews code     │
│    - Compare design tokens      │
│    - Report discrepancies       │
│    - Log completion             │
└─────────────────────────────────┘
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
- Active agents (Planner, Designer, Tech Lead, Developer)
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

### `claude-orchestrator resume`

Resume from the last checkpoint.

```bash
claude-orchestrator resume
```

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
├── config.json           # Project configuration
├── status.json           # Current agent status
├── queue.json            # Task queue
├── messages/             # Inter-agent communication
│   ├── to-designer.json  # Planner → Designer
│   ├── to-tech-lead.json # Designer → Tech Lead
│   └── to-developer.json # Tech Lead → Developer
├── design/               # Design artifacts
│   ├── tokens.json       # Design tokens
│   └── verification-report.json
└── logs/
    └── log.md            # Development log
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
  "continuous": false,
  "figma": {
    "enabled": false,
    "fileKey": "optional-figma-file-key",
    "accessToken": "optional-figma-access-token"
  }
}
```

## Design Token Verification

The Designer agent creates design tokens that are verified against the implementation:

### Design Tokens Structure

```json
{
  "colors": {
    "primary": "#1E88E5",
    "secondary": "#FF5722",
    "background": "#FFFFFF"
  },
  "fonts": {
    "heading": {
      "family": "Inter",
      "size": "24px",
      "weight": "700"
    }
  },
  "spacing": {
    "sm": "8px",
    "md": "16px",
    "lg": "24px"
  }
}
```

### Verification Process

1. Designer creates design specification with tokens
2. Developer implements using the tokens
3. After implementation, CSS tokens are extracted from the code
4. Tokens are compared with tolerance levels
5. Discrepancies are reported (warnings only, won't block completion)

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
git clone https://github.com/graygate/claude-orchestrator.git
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
