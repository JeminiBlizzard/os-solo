import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { workflowComponents } from '../schema/workflows.js';

export async function seedWorkflowComponents(db: PostgresJsDatabase<any>) {
  console.log('  Seeding built-in workflow components...');

  const components = [
    // TRIGGERS
    {
      type: 'trigger',
      name: 'Cron Schedule',
      description: 'Trigger workflow on a cron schedule',
      icon: 'Clock',
      defaultConfig: {
        cronExpression: '0 9 * * *',
        timezone: 'UTC',
      },
      isBuiltin: true,
      userId: null,
    },
    {
      type: 'trigger',
      name: 'Webhook',
      description: 'Trigger workflow via HTTP webhook',
      icon: 'Webhook',
      defaultConfig: {
        method: 'POST',
        authType: 'bearer',
      },
      isBuiltin: true,
      userId: null,
    },
    {
      type: 'trigger',
      name: 'Stripe Event',
      description: 'Trigger on Stripe webhook events',
      icon: 'CreditCard',
      defaultConfig: {
        events: ['invoice.paid', 'customer.subscription.created'],
      },
      isBuiltin: true,
      userId: null,
    },
    {
      type: 'trigger',
      name: 'Email Received',
      description: 'Trigger when email is received',
      icon: 'Mail',
      defaultConfig: {
        filters: {
          from: '',
          subject: '',
        },
      },
      isBuiltin: true,
      userId: null,
    },
    {
      type: 'trigger',
      name: 'GitHub Event',
      description: 'Trigger on GitHub webhook events',
      icon: 'Github',
      defaultConfig: {
        events: ['push', 'pull_request', 'issues'],
        repository: '',
      },
      isBuiltin: true,
      userId: null,
    },

    // COGNITIVE CORE
    {
      type: 'agent',
      name: 'AI Agent',
      description: 'Execute AI agent with LLM reasoning',
      icon: 'Brain',
      defaultConfig: {
        model: 'claude-sonnet-4-5',
        systemPrompt: '',
        temperature: 0.7,
        maxTokens: 4096,
      },
      isBuiltin: true,
      userId: null,
    },

    // ACTIONS
    {
      type: 'action',
      name: 'Send Email',
      description: 'Send an email notification',
      icon: 'Send',
      defaultConfig: {
        to: '',
        subject: '',
        body: '',
        fromName: 'OS // SOLO',
      },
      isBuiltin: true,
      userId: null,
    },
    {
      type: 'action',
      name: 'Create Ticket',
      description: 'Create a support or task ticket',
      icon: 'Ticket',
      defaultConfig: {
        title: '',
        description: '',
        priority: 'normal',
        assignee: '',
      },
      isBuiltin: true,
      userId: null,
    },
    {
      type: 'action',
      name: 'MCP Command',
      description: 'Execute MCP tool command',
      icon: 'Terminal',
      defaultConfig: {
        server: '',
        tool: '',
        params: {},
      },
      isBuiltin: true,
      userId: null,
    },
    {
      type: 'action',
      name: 'Post Webhook',
      description: 'Send HTTP POST webhook',
      icon: 'Globe',
      defaultConfig: {
        url: '',
        method: 'POST',
        headers: {},
        body: {},
      },
      isBuiltin: true,
      userId: null,
    },
    {
      type: 'action',
      name: 'Queue Approval',
      description: 'Queue item for human approval',
      icon: 'CheckCircle',
      defaultConfig: {
        title: '',
        description: '',
        approverEmail: '',
        autoExpireHours: 24,
      },
      isBuiltin: true,
      userId: null,
    },
    {
      type: 'action',
      name: 'Update Database',
      description: 'Execute database update query',
      icon: 'Database',
      defaultConfig: {
        table: '',
        operation: 'insert',
        data: {},
      },
      isBuiltin: true,
      userId: null,
    },
  ];

  for (const component of components) {
    const existing = await db.select()
      .from(workflowComponents)
      .where(eq(workflowComponents.name, component.name))
      .limit(1);

    if (existing.length > 0 && existing[0]) {
      // Update existing builtin component
      await db.update(workflowComponents)
        .set({
          type: component.type,
          description: component.description,
          icon: component.icon,
          defaultConfig: component.defaultConfig,
        })
        .where(eq(workflowComponents.id, existing[0]!.id));
    } else {
      // Insert new component
      await db.insert(workflowComponents).values(component);
    }
  }

  console.log(`    ✓ ${components.length} workflow components created/updated`);
}
