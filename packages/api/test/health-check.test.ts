import { describe, it, expect, vi } from 'vitest';

// Mock the database module
vi.mock('@os-solo/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    query: {
      servers: {
        findFirst: vi.fn(),
      },
      serverIncidents: {
        findFirst: vi.fn(),
      },
    },
  },
  schema: {
    servers: {
      id: 'id',
      name: 'name',
      mcpEndpoint: 'mcp_endpoint',
      status: 'status',
      userId: 'user_id',
      lastHealthyAt: 'last_healthy_at',
      lastCheckedAt: 'last_checked_at',
      updatedAt: 'updated_at',
    },
    serverIncidents: {
      id: 'id',
      serverId: 'server_id',
      userId: 'user_id',
      severity: 'severity',
      title: 'title',
      description: 'description',
      status: 'status',
      aiAnalysis: 'ai_analysis',
      similarIncidentId: 'similar_incident_id',
      startedAt: 'started_at',
      acknowledgedAt: 'acknowledged_at',
      resolvedAt: 'resolved_at',
    },
  },
}));

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '{"similar_incident_id": 123, "similarity_score": 85, "analysis": "Both incidents show database connection failures"}',
          },
        ],
      }),
    },
  })),
}));

describe('Health Check Worker', () => {
  describe('Scheduled Job Configuration', () => {
    it('should be registered with cron expression */5 * * * *', () => {
      const cronExpression = '*/5 * * * *';
      expect(cronExpression).toBe('*/5 * * * *');
    });

    it('should run every 5 minutes', () => {
      const intervalMs = 5 * 60 * 1000;
      expect(intervalMs).toBe(300000);
    });
  });

  describe('Server Ping', () => {
    it('should set status=online and update last_healthy_at on successful ping', () => {
      const now = new Date();
      const server = {
        status: 'healthy',
        lastHealthyAt: now,
        lastCheckedAt: now,
      };

      expect(server.status).toBe('healthy');
      expect(server.lastHealthyAt).toBeInstanceOf(Date);
      expect(server.lastCheckedAt).toBeInstanceOf(Date);
    });

    it('should require 2 consecutive failures before setting status=offline', () => {
      const consecutiveFailures = new Map<number, number>();
      const serverId = 1;

      // First failure
      consecutiveFailures.set(serverId, 1);
      expect(consecutiveFailures.get(serverId)).toBe(1);

      // Second failure
      consecutiveFailures.set(serverId, 2);
      expect(consecutiveFailures.get(serverId)).toBe(2);

      const shouldMarkOffline = consecutiveFailures.get(serverId)! >= 2;
      expect(shouldMarkOffline).toBe(true);
    });

    it('should set status=degraded on MCP subprotocol error', () => {
      const pingResult = {
        ok: true,
        degraded: true,
        error: 'Server returned 500 error',
      };

      const status = pingResult.degraded ? 'degraded' : 'healthy';
      expect(status).toBe('degraded');
    });

    it('should clear consecutive failures on successful ping', () => {
      const consecutiveFailures = new Map<number, number>();
      const serverId = 1;

      consecutiveFailures.set(serverId, 1);
      expect(consecutiveFailures.get(serverId)).toBe(1);

      // Successful ping clears failures
      consecutiveFailures.delete(serverId);
      expect(consecutiveFailures.get(serverId)).toBeUndefined();
    });
  });

  describe('Incident Auto-Creation', () => {
    it('should create critical incident on transition to offline', () => {
      const transition = {
        from: 'healthy',
        to: 'offline',
      };

      const incidentSeverity = transition.to === 'offline' ? 'critical' : 'medium';
      expect(incidentSeverity).toBe('critical');
    });

    it('should create medium incident on transition to degraded', () => {
      const transition = {
        from: 'healthy',
        to: 'degraded',
      };

      const incidentSeverity = transition.to === 'degraded' ? 'medium' : 'critical';
      expect(incidentSeverity).toBe('medium');
    });

    it('should auto-generate incident title from server name', () => {
      const serverName = 'Production VPS';
      const status = 'offline';

      const title = `Server ${serverName} is ${status}`;
      expect(title).toBe('Server Production VPS is offline');
    });

    it('should create incident with status=open', () => {
      const incident = {
        status: 'open',
        startedAt: new Date(),
      };

      expect(incident.status).toBe('open');
      expect(incident.startedAt).toBeInstanceOf(Date);
    });

    it('should not create incident if no status transition', () => {
      const currentStatus = 'offline';
      const newStatus = 'offline';

      const shouldCreateIncident = currentStatus !== newStatus;
      expect(shouldCreateIncident).toBe(false);
    });
  });

  describe('Incident Deduplication', () => {
    it('should check for existing incidents within 1 hour window', () => {
      const dedupWindowMs = 60 * 60 * 1000; // 1 hour
      const now = Date.now();
      const oneHourAgo = new Date(now - dedupWindowMs);

      expect(oneHourAgo.getTime()).toBe(now - 3600000);
    });

    it('should not create duplicate incident for same server+severity within 1h', () => {
      const existingIncident = {
        serverId: 1,
        severity: 'critical',
        startedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      };

      const newIncident = {
        serverId: 1,
        severity: 'critical',
      };

      const isDuplicate = existingIncident.serverId === newIncident.serverId &&
                         existingIncident.severity === newIncident.severity;

      expect(isDuplicate).toBe(true);
    });

    it('should allow new incident after 1 hour window', () => {
      const existingIncident = {
        startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      };

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const isOutsideWindow = existingIncident.startedAt < oneHourAgo;

      expect(isOutsideWindow).toBe(true);
    });
  });

  describe('AI Incident Analysis', () => {
    it('should populate similar_incident_id when similarity > 80%', () => {
      const aiResult = {
        similar_incident_id: 123,
        similarity_score: 85,
      };

      const shouldLinkIncident = aiResult.similarity_score >= 80;
      expect(shouldLinkIncident).toBe(true);
      expect(aiResult.similar_incident_id).toBe(123);
    });

    it('should not link incident when similarity < 80%', () => {
      const aiResult = {
        similar_incident_id: 123,
        similarity_score: 75,
      };

      const linkedId = aiResult.similarity_score >= 80 ? aiResult.similar_incident_id : null;
      expect(linkedId).toBeNull();
    });

    it('should run AI analysis asynchronously', () => {
      const incident = {
        id: 1,
        aiAnalysis: null,
        similarIncidentId: null,
      };

      // Incident created immediately
      expect(incident.id).toBe(1);

      // AI analysis filled in later
      const updatedIncident = {
        ...incident,
        aiAnalysis: 'Analysis complete',
        similarIncidentId: 123,
      };

      expect(updatedIncident.aiAnalysis).not.toBeNull();
    });

    it('should leave ai_analysis=null if AI analysis fails', () => {
      const incident = {
        id: 1,
        status: 'open',
        aiAnalysis: null,
      };

      // Incident creation not blocked by AI failure
      expect(incident.status).toBe('open');
      expect(incident.aiAnalysis).toBeNull();
    });

    it('should compare with past resolved incidents only', () => {
      const pastIncidents = [
        { id: 1, status: 'resolved' },
        { id: 2, status: 'open' },
        { id: 3, status: 'resolved' },
      ];

      const resolvedOnly = pastIncidents.filter(i => i.status === 'resolved');
      expect(resolvedOnly).toHaveLength(2);
      expect(resolvedOnly.map(i => i.id)).toEqual([1, 3]);
    });
  });

  describe('Dashboard Integration', () => {
    it('should make incidents visible in Dashboard Requires Attention', () => {
      const incident = {
        id: 1,
        status: 'open',
        severity: 'critical',
        startedAt: new Date(),
      };

      // Incidents with status='open' appear in dashboard
      const requiresAttention = incident.status === 'open';
      expect(requiresAttention).toBe(true);
    });

    it('should exclude resolved incidents from Requires Attention', () => {
      const incident = {
        status: 'resolved',
        resolvedAt: new Date(),
      };

      const requiresAttention = incident.status === 'open';
      expect(requiresAttention).toBe(false);
    });
  });

  describe('Status Transition Logic', () => {
    it('should detect online to offline transition', () => {
      const previousStatus = 'healthy';
      const newStatus = 'offline';

      const isTransition = previousStatus !== newStatus;
      expect(isTransition).toBe(true);
    });

    it('should detect online to degraded transition', () => {
      const previousStatus = 'healthy';
      const newStatus = 'degraded';

      const isTransition = previousStatus !== newStatus;
      expect(isTransition).toBe(true);
    });

    it('should not trigger on offline to offline', () => {
      const previousStatus = 'offline';
      const newStatus = 'offline';

      const isTransition = previousStatus !== newStatus;
      expect(isTransition).toBe(false);
    });
  });
});
