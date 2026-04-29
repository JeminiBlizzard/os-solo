import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import healthRouter from './routes/health.js';
import pingRouter from './routes/ping.js';
import authRouter from './routes/auth.js';
import agentsRouter from './routes/agents.js';
import schedulerRouter from './routes/scheduler.js';
import inboxRouter from './routes/inbox.js';
import triageRulesRouter from './routes/triage-rules.js';
import webhooksRouter from './routes/webhooks.js';
import approvalsRouter from './routes/approvals.js';
import dashboardRouter from './routes/dashboard.js';
import serversRouter from './routes/servers.js';
import projectsRouter from './routes/projects.js';
import settingsRouter from './routes/settings.js';
import expensesRouter from './routes/expenses.js';
import vaultRouter from './routes/vault.js';
import auditLogRouter from './routes/audit-log.js';
import integrationsRouter from './routes/integrations.js';
import workflowComponentsRouter from './routes/workflow-components.js';
import skillsRouter from './routes/skills.js';
import skillMarketplaceRouter from './routes/skill-marketplace.js';
import commandBarRouter from './routes/command-bar.js';
import systemRouter from './routes/system.js';
import notificationChannelsRouter from './routes/notification-channels.js';
import notificationRulesRouter from './routes/notification-rules.js';
import notificationsRouter from './routes/notifications.js';
import aiProvidersRouter from './routes/ai-providers.js';
import agentAnalyticsRouter from './routes/agent-analytics.js';
import analyticsRouter from './routes/analytics.js';
import { authMiddleware } from './middleware/auth.js';
import { startSessionCleanupJob } from './jobs/session-cleanup.js';
import { startAutopilotScheduler } from './jobs/autopilot-scheduler.js';
import { startDiscoveryWorker } from './infrastructure/discovery-worker.js';
import { startHealthCheckWorker } from './infrastructure/health-check.js';
import { startMonthlySnapshotJob } from './finance/monthly-snapshot-job.js';
import './types/context.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT ?? 3200;
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: isProduction ? undefined : false,
  }),
);
app.use(cors());
app.use(cookieParser());
app.use(express.json());

// Auth middleware (applied globally, skips public paths internally)
app.use(authMiddleware);

// API Routes
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/ping', pingRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/agents', agentsRouter);
app.use('/api/v1/scheduler', schedulerRouter);
app.use('/api/v1/inbox', inboxRouter);
app.use('/api/v1/triage-rules', triageRulesRouter);
app.use('/api/v1/webhooks', webhooksRouter);
app.use('/api/v1/approvals', approvalsRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/servers', serversRouter);
app.use('/api/v1/projects', projectsRouter);
app.use('/api/v1/settings', settingsRouter);
app.use('/api/v1/expenses', expensesRouter);
app.use('/api/v1/vault', vaultRouter);
app.use('/api/v1/audit-log', auditLogRouter);
app.use('/api/v1/integrations', integrationsRouter);
app.use('/api/v1/workflow-components', workflowComponentsRouter);
app.use('/api/v1/skills', skillsRouter);
app.use('/api/v1/skills', skillMarketplaceRouter);
app.use('/api/v1/command-bar', commandBarRouter);
app.use('/api/v1/system', systemRouter);
app.use('/api/v1/notification-channels', notificationChannelsRouter);
app.use('/api/v1/notification-rules', notificationRulesRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/ai-providers', aiProvidersRouter);
app.use('/api/v1/agents', agentAnalyticsRouter);
app.use('/api/v1/analytics', analyticsRouter);

// Serve static files and SPA fallback in production
if (isProduction) {
  const uiDistPath = join(__dirname, '../../ui/dist');

  if (existsSync(uiDistPath)) {
    app.use(express.static(uiDistPath));

    // SPA fallback - serve index.html for all non-API routes
    // Express 5 uses path-to-regexp v8 which requires named parameters for wildcards
    app.get('/{*path}', (_req, res) => {
      res.sendFile(join(uiDistPath, 'index.html'));
    });
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT} (${isProduction ? 'production' : 'development'})`);

  // Start background jobs
  startSessionCleanupJob();
  startAutopilotScheduler();
  startDiscoveryWorker();
  startHealthCheckWorker();
  startMonthlySnapshotJob();
});
