# Zoz - OpenClaw AI Assistant

**Name:** Zoz  
**Emoji:** 🧠  
**Built with:** Zack

## What This Is

A complete AI assistant setup running on a VDS with:
- **Memory System** - Session persistence with smart compression
- **SubAgents** - Senior (mistral:7b) + Junior (qwen:7b) dev team
- **Ollama Integration** - On-demand local LLMs
- **Telegram Bot** - 24/7 messaging access
- **OpenClaw Gateway** - Core orchestration

## Communication Channels

| Channel | Status | Access |
|---------|--------|--------|
| Telegram | ✅ Active | @your_bot_username |
| Webchat/TUI | ✅ Active | http://127.0.0.1:18789 |

*WhatsApp, Discord, Slack, Signal are explicitly disabled*

## Quick Start

```bash
# Start Ollama (for subagents)
./ollama/ollama-control start

# Check status
./ollama/ollama-control status

# Use subagents
python3 subagents/subagent_v3.py delegate "Design a REST API"
```

## Project Structure

```
.
├── memory_system.py          # MCP server for memory
├── subagents/                # SubAgent system
│   ├── subagent_v3.py       # Main controller
│   ├── tmux_manager.py      # Process management
│   ├── log_analyzer.py      # Log analysis
│   └── health_monitor.py    # Health checks
├── ollama/                   # Ollama setup
│   ├── docker-compose.yml   # Container config
│   └── ollama-control       # Control script
├── MEMORY_USAGE.md          # Memory system docs
├── SUBAGENT_ARCHITECTURE.md # SubAgent design
└── CHANNEL_POLICY.md        # Communication policy
```

## SubAgents

| Agent | Model | Role |
|-------|-------|------|
| SeniorDev | mistral:7b | Design, review, architecture |
| JuniorDev | qwen:7b | Implementation, tests, docs |

## Memory System

- Auto-saves all conversations
- Smart compression (~4k token context)
- Per-session persistence
- MCP server integration

## Heartbeat

- Checks Ollama health every 5 min
- Auto-stops after 1hr inactivity
- Wake triggers: "senior", "junior", "subagent", "delegate"

---

*Built March 2026*
