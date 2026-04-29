# OS // SOLO -- How-To Guide

A self-hosted business operating system for solopreneurs running AI-assisted companies. One app, one morning review, everything you need to run your operation.

---

## What You Get

OS // SOLO consolidates your daily operating workflow into a single control plane:

- **Dashboard** -- AI-generated morning briefing, key metrics, approval queue, agent activity feed
- **AI Agents** -- Define autonomous agents with system prompts, skills, schedules, budgets, and governance rules
- **Approval Queue** -- Review and approve/reject agent-proposed actions before they execute
- **Inbox** -- Unified triage for email, Stripe events, GitHub notifications, and webhooks
- **Infrastructure** -- Live view of your VPS fleet, containers, health checks, and Caddy routes via MCP
- **Finance** -- MRR tracking from Stripe, expense management, AI spend monitoring, revenue per product
- **Projects** -- Project registry with overview, activity timelines, and placeholder tabs for notes and knowledge bases (v2)
- **Vault** -- Encrypted credential storage with agent access controls and rotation reminders
- **Analytics** -- Per-agent performance dashboards: runs, costs, approval rates, estimated time saved
- **Command Bar** -- Cmd+K natural language command palette for navigation, quick actions, and data queries
- **Workflow Canvas** -- Visual drag-and-drop editor for agent execution flows (trigger / agent / action)
- **Notifications** -- Push alerts via browser, Slack, Discord, and email
- **Settings** -- Profile, AI config, integrations, triage rules, response templates, system admin
- **Audit Log** -- Immutable record of every action taken by you or your agents

---

## Prerequisites

- A Linux VPS (Ubuntu 22.04+ recommended) with at least 2GB RAM and 20GB disk
- Docker and Docker Compose installed
- A domain name pointed at your VPS (for TLS via Caddy or similar reverse proxy)
- An Anthropic API key (get one at https://console.anthropic.com)

Optional but recommended:
- Stripe account (for MRR and revenue tracking)
- Email account with IMAP/SMTP access (for inbox triage)
- GitHub personal access token (for repo notifications)
- MCP servers running on your VPS fleet (for infrastructure monitoring)

---

## Quick Start

### 1. Clone the repository

```bash
cd /opt
git clone https://github.com/JeminiBlizzard/os-solo.git
cd os-solo
```

### 2. Create your environment file

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Server
PORT=3200
NODE_ENV=production

# Database (these configure the Postgres container)
POSTGRES_USER=ossolo
POSTGRES_PASSWORD=<generate-a-strong-password>
POSTGRES_DB=ossolo
DATABASE_URL=postgres://ossolo:<same-password>@postgres:5432/ossolo

# Session
SESSION_SECRET=<generate-a-random-64-char-string>

# Authentication (leave false for local/Tailscale use)
AUTH_ENABLED=false

# AI
ANTHROPIC_API_KEY=<your-anthropic-api-key>
DEFAULT_AI_MODEL=claude-sonnet-4-20250514

# Vault Encryption
VAULT_ENCRYPTION_KEY=<generate-a-random-32-byte-hex-string>

# Feature Flags
ENABLE_AGENT_RUNTIME=true
ENABLE_INTEGRATIONS=true
```

Generate secure values:

```bash
# Session secret (64 chars)
openssl rand -hex 32

# Vault encryption key (32-byte hex)
openssl rand -hex 32

# Postgres password
openssl rand -base64 24
```

### 3. Create the Docker network

OS // SOLO expects an external network called `webnet` for reverse proxy connectivity:

```bash
docker network create webnet
```

### 4. Build and start

```bash
docker compose up -d --build
```

This starts two containers:
- `os-solo` -- the application (API + static UI), port 3200
- `os-solo-postgres-1` -- PostgreSQL 16, internal network only

The app auto-runs database migrations and seeds structural data (default user, agent templates, AI provider config) on first start.

### 5. Set up your reverse proxy

If you're using Caddy, add a route to your Caddyfile:

```
solo.yourdomain.com {
    reverse_proxy localhost:3200
}
```

Reload Caddy:

```bash
caddy reload --config /etc/caddy/Caddyfile
```

### 6. Open the app

Navigate to `https://solo.yourdomain.com` (or `http://localhost:3200` for local access).

You'll land on the Dashboard. No login required unless you've set `AUTH_ENABLED=true`.

---

## First Launch Walkthrough

When you first open OS // SOLO, the database is empty except for structural seeds. Here's how to get value out of it in your first session.

### Set your timezone and preferences

Go to **Settings** (bottom of the sidebar). Under the Profile tab, set your display name, timezone, and preferred date format. These affect all time displays across the app.

### Connect your Anthropic API key

Your API key from the `.env` file is already configured. Verify it under **Settings > AI Configuration**. You can change the default model, set a monthly AI budget cap, and toggle memory extraction for agents.

### Add your first project

Go to **Projects** in the sidebar. Click "New Project" and fill in:
- Name (e.g., "My SaaS Product")
- Description
- Repo URL (optional -- links to your GitHub repo)
- Status (Active)

Once created, you can view the project overview and activity timeline. The **Notes** and **Knowledge Base** tabs are stubbed out for a future release -- when wired, the Knowledge Base will let you feed project context (tech stack, architecture, conventions) directly to your AI agents.

### Register your servers

Go to **Infrastructure** and click "Add Server." Enter:
- Server name
- Hostname / IP address
- Provider (e.g., DigitalOcean, Hetzner)
- MCP endpoint URL (if you run an MCP server on that VPS)
- Monthly cost

If you provide an MCP endpoint, OS // SOLO will auto-discover Docker containers and Caddy routes on that server. Health checks run every 5 minutes.

### Create your first agent

Go to **Agents** and click "Add Agent." You can start from a template (Inbox Triage, Infrastructure Monitor, Finance Reporter) or build from scratch.

Key fields:
- **Name** -- what you'll see in the roster and logs
- **System Prompt** -- the agent's instructions (what it does, how it thinks, what it can access)
- **Schedule** -- cron expression (e.g., `0 9 * * *` for daily at 9am), event-triggered, or manual-only
- **Governance** -- "Requires Approval" means the agent's output goes to the Approval Queue before executing. Set a confidence threshold to auto-approve high-confidence actions.
- **Monthly Budget** -- hard cap on AI spend for this agent. The agent auto-pauses when it hits the limit.
- **Skills** -- assign registered skills (send email, run command, query database, etc.)

### Generate your first briefing

Go to the **Dashboard** and click "Generate Briefing." The AI synthesizes data from all connected systems into a morning summary: approval queue count, infrastructure health, open tickets, MRR, recent agent activity. Takes about 10-15 seconds.

---

## Connecting Integrations

### Stripe (Revenue Tracking)

1. Go to **Settings > Integrations**
2. Add a Stripe integration with your API key and webhook secret
3. Set up a webhook in your Stripe dashboard pointing to `https://solo.yourdomain.com/api/v1/webhooks/stripe`
4. Subscribe to events: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.created`

Revenue events will flow into the **Finance** page automatically. MRR is calculated from active recurring subscriptions.

### Email (Inbox Triage)

1. Go to **Settings > Integrations**
2. Add an Email integration with your IMAP and SMTP credentials
3. Use the "Test Connection" button to verify both inbound and outbound work
4. Set up triage rules under **Settings > Triage Rules** to auto-archive known noise (e.g., marketing emails, automated receipts)

The inbox poller checks for new emails every 5 minutes. AI triage assigns category, priority, and drafts responses for support items.

### GitHub (Notifications)

1. Go to **Settings > Integrations**
2. Add a GitHub integration with a personal access token
3. Set up a webhook in your GitHub repo pointing to `https://solo.yourdomain.com/api/v1/webhooks/github`

Issues, security alerts, and PR reviews will flow into the **Inbox**.

### MCP Servers (Infrastructure)

Each VPS in your fleet needs an MCP server running to enable live container discovery, health checks, and remote actions. When you add a server in **Infrastructure**, provide the MCP endpoint URL. OS // SOLO will call `docker_ps`, parse Caddyfiles, and monitor health through MCP.

---

## Daily Workflow

The intended daily flow takes about 15 minutes:

1. **Open the Dashboard.** Read the morning briefing. Check the Quick Metrics panel.
2. **Clear the Approval Queue.** Review what your agents want to do. Approve, reject, or edit. Bulk-approve low-risk items.
3. **Scan the Inbox.** Review AI-triaged items. Send responses. Assign complex items to agents.
4. **Check Infrastructure.** Glance at server health. Investigate any incidents.
5. **Review Finance.** Check MRR trends and AI spend. Note anything unusual.
6. Get back to deep work. Agents handle the rest. (Focus Mode toggle is stubbed in the topbar for a future release.)

---

## Agent Management

### Scheduling

Agents can run on four schedule types:
- **Cron** -- standard cron expressions. `*/15 * * * *` = every 15 minutes. `0 9 * * 1` = Monday at 9am.
- **Event** -- triggered by internal events (new ticket, payment failed, server offline)
- **Manual** -- only runs when you click "Run Now"
- **Continuous** -- runs in a loop (use with caution and budget caps)

The **Autopilot** page (accessible from the Agents section) shows all scheduled agents, their next run time, and run history.

### Governance

Every agent has a governance setting:
- **Requires Approval** (default) -- all outputs go to the Approval Queue
- **Autonomous with Threshold** -- outputs above a confidence score auto-approve; below go to the queue
- **Fully Autonomous** -- everything executes without review (use sparingly)

### Budget Enforcement

Each agent has a monthly budget in cents. When an agent's AI spend hits the cap, it auto-pauses. You can override the pause or increase the budget. Budgets reset on the 1st of each month.

The global AI budget is set in **Settings > AI Configuration** and applies as a ceiling across all agents.

### Agent Memory

After each run, agents can optionally extract key facts and decisions into their memory. On future runs, relevant memories are injected into the agent's context. This lets agents build up operational knowledge over time without you repeating instructions.

Toggle memory extraction globally in Settings or per-agent in the agent config.

---

## Vault Usage

Store API keys, database URLs, SSH keys, and other credentials in the **Vault**. Secrets are encrypted at rest using AES-256-GCM.

Secrets can be scoped to a specific project (only agents working on that project can access them) or global (available to all agents).

- **Reveal** -- temporarily shows the decrypted value. Auto-hides after 30 seconds.
- **Copy** -- copies to clipboard without displaying.
- **Rotation reminders** -- set a reminder interval (e.g., 90 days). The Dashboard briefing will flag secrets that are overdue for rotation.

Every access (human reveal, agent read, clipboard copy) is logged in the Vault access log.

---

## Command Bar

Press **Cmd+K** (Mac) or **Ctrl+K** (Windows/Linux) from any page.

Examples of what you can type:
- `inbox` -- navigates to the Inbox
- `open project MaxScripts` -- navigates to a specific project
- `What's the MRR this month?` -- queries Finance data and shows the answer inline
- `restart bookbuilder on Brock Cloud VPS` -- executes an infrastructure action (with confirmation)
- `pause the Content Writer agent` -- quick agent management

Recent commands appear when you open the bar with no input.

---

## Workflow Canvas

For agents that need more complex execution flows than a single prompt, use the **Workflow Canvas**.

Open any agent from the roster and click "Canvas." The editor provides:
- **Triggers** (left column) -- what starts the flow (cron, webhook, Stripe event, email received)
- **Cognitive Core** (middle) -- the AI agent node that processes input
- **Actions** (right column) -- what happens after processing (send email, create ticket, run command, queue for approval)

Place components on the canvas, connect them with edges, and activate the workflow. When active, the Agent Runtime follows the workflow graph instead of simple prompt execution.

---

## Notifications

Configure push notifications in **Settings > Notifications**.

Supported channels:
- **Browser Push** -- system notifications even when the tab isn't focused
- **Slack** -- formatted messages via webhook
- **Discord** -- embedded messages via webhook
- **Email** -- alerts via your configured SMTP

Each event type (agent failure, server offline, budget warning, new urgent ticket, etc.) can be routed to specific channels with severity filtering.

The in-app notification bell in the top bar shows recent notifications regardless of push channel configuration.

---

## Multi-Provider AI

OS // SOLO ships with Anthropic as the default and fully tested AI provider. You can add additional providers in **Settings > AI Providers**:

- **OpenAI** -- GPT models via chat completions
- **Google Gemini** -- via generateContent API
- **Ollama** -- local models, no API key needed, zero cost
- **Custom** -- any provider with an OpenAI-compatible API

Each agent can be configured with its own provider and model. Cost tracking adjusts per provider's pricing. Ollama runs are tracked at $0.

Anthropic is the only provider with full tool use support in v1. Other providers handle basic prompt/response flows.

---

## Backups

### Database backup

```bash
docker exec os-solo-postgres-1 pg_dump -U ossolo ossolo > backup_$(date +%Y%m%d).sql
```

### Database restore

```bash
cat backup_20260428.sql | docker exec -i os-solo-postgres-1 psql -U ossolo ossolo
```

### Full data export

Go to **Settings > System** and click "Export Data" to download a JSON file containing all your data.

---

## Updating

Check for updates in **Settings > System**. The app checks the GitHub releases API (cached hourly) and shows available updates with release notes.

To update manually:

```bash
cd /opt/os-solo
git pull origin main
docker compose up -d --build
```

The app runs any pending database migrations automatically on startup.

---

## Enabling Authentication

By default, OS // SOLO runs without authentication -- suitable for local access or behind Tailscale/WireGuard. To enable auth:

1. Set `AUTH_ENABLED=true` in your `.env` file
2. Restart the app: `docker compose up -d`
3. On first visit, you'll be prompted to set a password
4. All subsequent visits require login. Sessions last 30 days.

To change your password, go to **Settings > Profile > Security**.

---

## Troubleshooting

**App won't start / container exits immediately**
Check logs: `docker compose logs app`. Common causes: missing `.env` values, Postgres not ready (wait for health check), port 3200 already in use.

**Database connection refused**
The app connects to Postgres via the Docker internal network hostname `postgres`. Make sure both containers are on the `internal` network: `docker compose ps`.

**MCP server not responding**
Verify the MCP endpoint URL is correct and accessible from the VPS running OS // SOLO. Test with: `curl -s <mcp-endpoint-url>`.

**AI briefing fails**
Check that your `ANTHROPIC_API_KEY` is valid and has credits. Check the agent run logs in the Agents section for error details.

**Inbox not picking up emails**
Verify IMAP credentials in Settings > Integrations. Use the "Test Connection" button. Check that the IMAP server allows app-specific passwords (required for Gmail).

---

## Project Structure

```
os-solo/
  packages/
    api/          Express 5 REST API + WebSocket server
    ui/           React 19 + Vite SPA
    db/           Drizzle ORM schema, migrations, seeds
    shared/       TypeScript types, constants, utilities
    agent-runtime/  Agent executor, scheduler, memory
    integrations/ Plugin framework + first-party integrations
  docker-compose.yml
  Dockerfile
  .env
```

---

## License

Apache 2.0
