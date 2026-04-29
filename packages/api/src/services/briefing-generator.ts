/**
 * Briefing Generator Service
 *
 * Gathers data from various sources and generates AI briefings.
 * Uses Anthropic provider directly for system-internal briefing generation.
 */

import { db, schema } from '@os-solo/db';
import { eq, desc, gte, and, sql, inArray } from 'drizzle-orm';
import { getProvider } from './ai-provider.js';
import { calculateCostCents } from '@os-solo/shared';

// ========== Types ==========

export interface BriefingData {
  mrr: {
    current_cents: number;
    delta_cents: number;
    trend: 'up' | 'down' | 'flat';
  };
  servers: {
    total: number;
    online: number;
    degraded: number;
    offline: number;
  };
  inbox: {
    new_items: number;
    critical: number;
    in_progress: number;
  };
  approvals: {
    pending: number;
    high_value: number;
  };
  agents: {
    runs_today: number;
    success_rate: number;
    total_cost_cents: number;
  };
  ai_budget: {
    used_cents: number;
    budget_cents: number;
    pct_remaining: number;
  };
}

export interface GeneratedBriefing {
  id: number;
  type: string;
  content: string;
  generated_at: string;
  cost_cents: number;
}

// ========== Data Gatherers ==========

/**
 * Fetch system update status for briefing context
 */
async function checkSystemUpdate(): Promise<{ updateAvailable: boolean; newVersion: string | null }> {
  try {
    const response = await fetch('http://localhost:3001/api/v1/system/update-check', {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return { updateAvailable: false, newVersion: null };
    }

    const data = await response.json();
    if (data.ok && data.data) {
      return {
        updateAvailable: data.data.updateAvailable || false,
        newVersion: data.data.updateAvailable ? data.data.latestVersion : null,
      };
    }

    return { updateAvailable: false, newVersion: null };
  } catch (error) {
    // Silently fail - update check is not critical for briefing
    console.warn('Update check failed in briefing:', error);
    return { updateAvailable: false, newVersion: null };
  }
}

async function gatherBriefingData(userId: number): Promise<BriefingData> {
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  // Execute all queries in parallel
  const [
    mrrSnapshots,
    serverCounts,
    inboxCounts,
    approvalCounts,
    agentStats,
    budgetInfo,
  ] = await Promise.all([
    // MRR - last 2 snapshots
    db
      .select({
        mrrCents: schema.mrrSnapshots.mrrCents,
        snapshotDate: schema.mrrSnapshots.snapshotDate,
      })
      .from(schema.mrrSnapshots)
      .where(eq(schema.mrrSnapshots.userId, userId))
      .orderBy(desc(schema.mrrSnapshots.snapshotDate))
      .limit(2),

    // Server health by status
    db
      .select({
        status: schema.servers.status,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.servers)
      .where(eq(schema.servers.userId, userId))
      .groupBy(schema.servers.status),

    // Inbox items by status
    db
      .select({
        status: schema.inboxItems.status,
        priority: schema.inboxItems.priority,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.inboxItems)
      .where(
        and(
          eq(schema.inboxItems.userId, userId),
          inArray(schema.inboxItems.status, ['new', 'triaged', 'in_progress'])
        )
      )
      .groupBy(schema.inboxItems.status, schema.inboxItems.priority),

    // Approvals pending
    db
      .select({
        count: sql<number>`count(*)::int`,
        highValue: sql<number>`count(*) filter (where action_type in ('payment', 'contract', 'deployment'))::int`,
      })
      .from(schema.approvalQueue)
      .where(
        and(
          eq(schema.approvalQueue.userId, userId),
          eq(schema.approvalQueue.status, 'pending')
        )
      ),

    // Agent runs today
    db
      .select({
        total: sql<number>`count(*)::int`,
        success: sql<number>`count(*) filter (where status = 'success')::int`,
        costCents: sql<number>`COALESCE(SUM(cost_cents), 0)::int`,
      })
      .from(schema.agentRuns)
      .where(
        and(
          eq(schema.agentRuns.userId, userId),
          gte(schema.agentRuns.startedAt, startOfDay)
        )
      ),

    // AI budget from user_settings
    db
      .select({
        budget: schema.userSettings.aiMonthlyBudgetCents,
      })
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, userId))
      .limit(1),
  ]);

  // Monthly AI spend
  const monthlySpendResult = await db
    .select({ total: sql<number>`COALESCE(SUM(cost_cents), 0)::int` })
    .from(schema.agentRuns)
    .where(
      and(
        eq(schema.agentRuns.userId, userId),
        gte(schema.agentRuns.completedAt, startOfMonth)
      )
    );

  // Process MRR
  const currentMrr = mrrSnapshots[0]?.mrrCents ?? 0;
  const previousMrr = mrrSnapshots[1]?.mrrCents ?? 0;
  const mrrDelta = currentMrr - previousMrr;
  const mrrTrend = mrrDelta > 0 ? 'up' : mrrDelta < 0 ? 'down' : 'flat';

  // Process servers
  let totalServers = 0;
  let onlineCount = 0;
  let degradedCount = 0;
  let offlineCount = 0;
  for (const row of serverCounts) {
    totalServers += row.count;
    const status = row.status?.toLowerCase() ?? 'unknown';
    if (status === 'online') onlineCount = row.count;
    else if (status === 'degraded') degradedCount = row.count;
    else offlineCount += row.count;
  }

  // Process inbox
  let newItems = 0;
  let criticalItems = 0;
  let inProgressItems = 0;
  for (const row of inboxCounts) {
    if (row.status === 'new') newItems += row.count;
    if (row.status === 'in_progress') inProgressItems += row.count;
    if (row.priority === 'critical' || row.priority === 'high') criticalItems += row.count;
  }

  // Process approvals
  const pendingApprovals = approvalCounts[0]?.count ?? 0;
  const highValueApprovals = approvalCounts[0]?.highValue ?? 0;

  // Process agents
  const runsToday = agentStats[0]?.total ?? 0;
  const successCount = agentStats[0]?.success ?? 0;
  const successRate = runsToday > 0 ? (successCount / runsToday) * 100 : 100;
  const todayCost = agentStats[0]?.costCents ?? 0;

  // Process budget
  const aiBudget = budgetInfo[0]?.budget ?? 30000;
  const aiUsed = monthlySpendResult[0]?.total ?? 0;
  const pctRemaining = aiBudget > 0 ? ((aiBudget - aiUsed) / aiBudget) * 100 : 0;

  return {
    mrr: {
      current_cents: currentMrr,
      delta_cents: mrrDelta,
      trend: mrrTrend,
    },
    servers: {
      total: totalServers,
      online: onlineCount,
      degraded: degradedCount,
      offline: offlineCount,
    },
    inbox: {
      new_items: newItems,
      critical: criticalItems,
      in_progress: inProgressItems,
    },
    approvals: {
      pending: pendingApprovals,
      high_value: highValueApprovals,
    },
    agents: {
      runs_today: runsToday,
      success_rate: Math.round(successRate),
      total_cost_cents: todayCost,
    },
    ai_budget: {
      used_cents: aiUsed,
      budget_cents: aiBudget,
      pct_remaining: Math.round(pctRemaining),
    },
  };
}

// ========== Prompt Builders ==========

function buildMorningBriefingPrompt(data: BriefingData, updateInfo?: { updateAvailable: boolean; newVersion: string | null }): string {
  const mrrFormatted = (data.mrr.current_cents / 100).toFixed(2);
  const mrrDeltaFormatted = (data.mrr.delta_cents / 100).toFixed(2);
  const budgetUsedFormatted = (data.ai_budget.used_cents / 100).toFixed(2);
  const budgetTotalFormatted = (data.ai_budget.budget_cents / 100).toFixed(2);

  const updateMessage = updateInfo?.updateAvailable
    ? `\n- System Update: OS // SOLO v${updateInfo.newVersion} is available`
    : '';

  return `Generate a concise morning briefing for a solo business operator. Be direct and actionable.

Current Status Data:
- MRR: $${mrrFormatted} (${data.mrr.trend === 'up' ? '+' : ''}$${mrrDeltaFormatted} vs last month)
- Infrastructure: ${data.servers.online}/${data.servers.total} online, ${data.servers.degraded} degraded, ${data.servers.offline} offline
- Inbox: ${data.inbox.new_items} new items, ${data.inbox.critical} critical/high priority, ${data.inbox.in_progress} in progress
- Pending Approvals: ${data.approvals.pending} total, ${data.approvals.high_value} high-value
- Agent Activity (today): ${data.agents.runs_today} runs, ${data.agents.success_rate}% success rate
- AI Budget: $${budgetUsedFormatted}/$${budgetTotalFormatted} used (${data.ai_budget.pct_remaining}% remaining)${updateMessage}

Format your response in markdown with these sections:
1. **Priority Actions** - Top 2-3 things needing immediate attention${updateInfo?.updateAvailable ? ' (mention system update if available)' : ''}
2. **System Status** - One-line summary of infrastructure health
3. **Business Pulse** - Quick MRR and inbox summary
4. **AI Operations** - Budget status and agent performance

Keep it under 250 words. Be specific and actionable.`;
}

function buildEveningDebriefPrompt(data: BriefingData): string {
  const mrrFormatted = (data.mrr.current_cents / 100).toFixed(2);
  const budgetUsedFormatted = (data.ai_budget.used_cents / 100).toFixed(2);
  const budgetTotalFormatted = (data.ai_budget.budget_cents / 100).toFixed(2);
  const todayCostFormatted = (data.agents.total_cost_cents / 100).toFixed(2);

  return `Generate a concise evening debrief for a solo business operator. Focus on reflection and tomorrow's prep.

Today's Data:
- MRR: $${mrrFormatted} (trend: ${data.mrr.trend})
- Infrastructure: ${data.servers.online}/${data.servers.total} servers online
- Inbox: ${data.inbox.in_progress} items in progress, ${data.inbox.new_items} new
- Pending Approvals: ${data.approvals.pending} (${data.approvals.high_value} high-value)
- Agent Runs Today: ${data.agents.runs_today} runs, ${data.agents.success_rate}% success, $${todayCostFormatted} spent
- Monthly AI Budget: $${budgetUsedFormatted}/$${budgetTotalFormatted} (${data.ai_budget.pct_remaining}% remaining)

Format your response in markdown with these sections:
1. **Day Summary** - What was accomplished
2. **Overnight Watch** - Any systems/tasks that need monitoring
3. **Tomorrow's Focus** - Suggested priorities based on pending items
4. **Budget Check** - AI spend tracking note

Keep it under 200 words. End on a positive note.`;
}

// ========== Generator Functions ==========

const BRIEFING_MODEL = 'claude-3-5-haiku-20241022';

export async function generateMorningBriefing(userId: number): Promise<GeneratedBriefing> {
  // Gather data
  const data = await gatherBriefingData(userId);

  // Check for system updates
  const updateInfo = await checkSystemUpdate();

  const prompt = buildMorningBriefingPrompt(data, updateInfo);

  // Get AI provider
  const provider = await getProvider(userId, 'anthropic');
  if (!provider) {
    throw new Error('No AI provider configured. Please add your Anthropic API key in settings.');
  }

  // Generate briefing
  const response = await provider.complete({
    model: BRIEFING_MODEL,
    max_tokens: 1024,
    temperature: 0.7,
    messages: [{ role: 'user', content: prompt }],
    system: 'You are a concise business operations assistant. Generate clear, actionable briefings.',
  });

  // Extract text content
  const textContent = response.content.find((c) => c.type === 'text');
  const content = textContent?.type === 'text' ? textContent.text : '';

  // Calculate cost
  const costCents = calculateCostCents(
    BRIEFING_MODEL,
    response.usage.input_tokens,
    response.usage.output_tokens
  );

  // Persist to database
  const now = new Date();
  const dataSources = ['mrr_snapshots', 'servers', 'inbox_items', 'approval_queue', 'agent_runs', 'user_settings'];

  // Add system_updates to data sources if update is available
  if (updateInfo.updateAvailable) {
    dataSources.push('system_updates');
  }

  const [inserted] = await db
    .insert(schema.briefings)
    .values({
      userId,
      type: 'morning',
      content,
      dataSources,
      costCents: Math.round(costCents * 100),
      generatedAt: now,
    })
    .returning({ id: schema.briefings.id });

  return {
    id: inserted!.id,
    type: 'morning',
    content,
    generated_at: now.toISOString(),
    cost_cents: Math.round(costCents * 100),
  };
}

export async function generateEveningDebrief(userId: number): Promise<GeneratedBriefing> {
  // Gather data
  const data = await gatherBriefingData(userId);
  const prompt = buildEveningDebriefPrompt(data);

  // Get AI provider
  const provider = await getProvider(userId, 'anthropic');
  if (!provider) {
    throw new Error('No AI provider configured. Please add your Anthropic API key in settings.');
  }

  // Generate debrief
  const response = await provider.complete({
    model: BRIEFING_MODEL,
    max_tokens: 1024,
    temperature: 0.7,
    messages: [{ role: 'user', content: prompt }],
    system: 'You are a concise business operations assistant. Generate clear, reflective evening debriefs.',
  });

  // Extract text content
  const textContent = response.content.find((c) => c.type === 'text');
  const content = textContent?.type === 'text' ? textContent.text : '';

  // Calculate cost
  const costCents = calculateCostCents(
    BRIEFING_MODEL,
    response.usage.input_tokens,
    response.usage.output_tokens
  );

  // Persist to database
  const now = new Date();
  const dataSources = ['mrr_snapshots', 'servers', 'inbox_items', 'approval_queue', 'agent_runs', 'user_settings'];

  const [inserted] = await db
    .insert(schema.briefings)
    .values({
      userId,
      type: 'evening',
      content,
      dataSources,
      costCents: Math.round(costCents * 100),
      generatedAt: now,
    })
    .returning({ id: schema.briefings.id });

  return {
    id: inserted!.id,
    type: 'evening',
    content,
    generated_at: now.toISOString(),
    cost_cents: Math.round(costCents * 100),
  };
}

export async function getLatestBriefing(userId: number, type: string): Promise<GeneratedBriefing | null> {
  const result = await db
    .select({
      id: schema.briefings.id,
      type: schema.briefings.type,
      content: schema.briefings.content,
      generatedAt: schema.briefings.generatedAt,
      costCents: schema.briefings.costCents,
    })
    .from(schema.briefings)
    .where(
      and(
        eq(schema.briefings.userId, userId),
        eq(schema.briefings.type, type)
      )
    )
    .orderBy(desc(schema.briefings.generatedAt))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const row = result[0]!;
  return {
    id: row.id,
    type: row.type,
    content: row.content ?? '',
    generated_at: row.generatedAt.toISOString(),
    cost_cents: row.costCents ?? 0,
  };
}
