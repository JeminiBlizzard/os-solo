import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { agentTemplates } from '../schema/agents.js';

export async function seedAgentTemplates(db: PostgresJsDatabase<any>) {
  console.log('  Seeding built-in agent templates...');

  const templates = [
    {
      name: 'Inbox Triage Agent',
      description: 'Automatically categorizes and prioritizes incoming messages, drafts suggested responses',
      category: 'Communication',
      systemPrompt: `You are an Inbox Triage Agent. Your role is to:
1. Analyze incoming messages from multiple sources (email, SMS, webhooks)
2. Categorize them (support, billing, sales, other)
3. Assign priority levels (urgent, high, normal, low)
4. Draft concise, professional response suggestions
5. Apply triage rules when applicable

Be helpful, concise, and action-oriented. Focus on efficient communication.`,
      defaultSkills: ['email_reader', 'sentiment_analysis', 'draft_composer'],
      defaultSchedule: '*/15 * * * *', // Every 15 minutes
      defaultRequiresApproval: false,
      isBuiltin: true,
    },
    {
      name: 'Infrastructure Monitor',
      description: 'Monitors servers, containers, and Caddy routes; detects anomalies and incidents',
      category: 'Infrastructure',
      systemPrompt: `You are an Infrastructure Monitor Agent. Your role is to:
1. Check server health and container status
2. Detect anomalies in resource usage, uptime, or response times
3. Create incident records for critical issues
4. Identify similar past incidents for pattern recognition
5. Provide actionable recommendations for resolution

Be proactive, precise, and security-conscious. Prioritize system stability.`,
      defaultSkills: ['server_health_check', 'docker_inspector', 'log_analyzer'],
      defaultSchedule: '*/10 * * * *', // Every 10 minutes
      defaultRequiresApproval: false,
      isBuiltin: true,
    },
    {
      name: 'Finance Reporter',
      description: 'Tracks revenue, expenses, and MRR; generates financial insights and alerts',
      category: 'Finance',
      systemPrompt: `You are a Finance Reporter Agent. Your role is to:
1. Monitor subscription status and revenue events
2. Calculate daily MRR snapshots and growth metrics
3. Track operational expenses and categorize spending
4. Identify revenue anomalies or churn risks
5. Generate concise financial summaries and recommendations

Be accurate, analytical, and business-focused. Highlight trends and actionable insights.`,
      defaultSkills: ['mrr_calculator', 'stripe_monitor', 'expense_tracker'],
      defaultSchedule: '0 9 * * *', // Daily at 9 AM
      defaultRequiresApproval: false,
      isBuiltin: true,
    },
  ];

  for (const template of templates) {
    const existing = await db.select()
      .from(agentTemplates)
      .where(eq(agentTemplates.name, template.name))
      .limit(1);

    if (existing.length > 0 && existing[0]) {
      // Update existing
      await db.update(agentTemplates)
        .set({
          description: template.description,
          category: template.category,
          systemPrompt: template.systemPrompt,
          defaultSkills: template.defaultSkills,
          defaultSchedule: template.defaultSchedule,
          defaultRequiresApproval: template.defaultRequiresApproval,
        })
        .where(eq(agentTemplates.id, existing[0]!.id));
    } else {
      // Insert new
      await db.insert(agentTemplates).values(template);
    }
  }

  console.log(`    ✓ ${templates.length} agent templates created/updated`);
}
