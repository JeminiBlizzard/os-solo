# OS // SOLO

A self-hosted business operating system for solopreneurs running AI-assisted companies.

One app. 15-minute morning review. 22 features covering agent orchestration, infrastructure monitoring, inbox triage, financial tracking, and scheduled automation.

## The Idea

A one-person company should be able to open one app in the morning, review what happened overnight, approve or reject autonomous agent work, check business health, and get back to high-value creative work -- all in 15 minutes.

## What's Inside

- **Dashboard** -- AI-synthesized morning briefing with metrics, approvals, and agent activity
- **AI Agents** -- Autonomous agents with system prompts, schedules, budgets, and governance
- **Approval Queue** -- Human-in-the-loop review for agent-proposed actions
- **Inbox & Triage** -- Unified inbox for email, Stripe, GitHub, and webhooks with AI triage
- **Infrastructure** -- Live fleet view of VPS servers and containers via MCP
- **Finance & MRR** -- Stripe revenue tracking, expense management, AI spend monitoring
- **Projects** -- Project registry with overview and activity timelines (notes and knowledge base tabs are v2)
- **Vault** -- AES-256-GCM encrypted credential storage with agent access controls
- **Workflow Canvas** -- Visual editor for agent execution flows
- **Command Bar** -- Cmd+K natural language navigation, actions, and queries
- **Analytics** -- Per-agent performance: runs, costs, approval rates, time saved
- **Notifications** -- Browser push, Slack, Discord, and email alerts with Focus Mode
- **Multi-Provider AI** -- Anthropic (default), OpenAI, Gemini, Ollama, or any OpenAI-compatible API
- **Audit Log** -- Immutable record of every action by humans and agents

## Stack

TypeScript monorepo (pnpm), React 19 + Vite, Tailwind CSS + shadcn/ui, IBM Carbon-inspired design tokens, Express 5, PostgreSQL + Drizzle ORM, Node.js 20+.

## Quick Start

```bash
git clone https://github.com/JeminiBlizzard/os-solo.git
cd os-solo
cp .env.example .env
# Edit .env with your values (see HOW-TO.md)
docker network create webnet
docker compose up -d --build
```

Open `http://localhost:3200`.

## Documentation

See [HOW-TO.md](HOW-TO.md) for the full setup guide, integration walkthroughs, daily workflow, agent management, and troubleshooting.

## License

Apache 2.0 -- see [LICENSE](LICENSE) for details.
