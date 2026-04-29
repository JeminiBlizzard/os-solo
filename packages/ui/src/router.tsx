import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AppShell } from '@/components/shell/AppShell';
import { Dashboard } from '@/pages/Dashboard';
import { Agents } from '@/pages/Agents';
import { AgentDetail } from '@/pages/AgentDetail';
import { AgentCanvas } from '@/pages/AgentCanvas';
import { Approvals } from '@/pages/Approvals';
import { Inbox } from '@/pages/Inbox';
import { Infrastructure } from '@/pages/Infrastructure';
import { Finance } from '@/pages/Finance';
import { Expenses } from '@/pages/Expenses';
import { AIBudget } from '@/pages/AIBudget';
import { Subscriptions } from '@/pages/Subscriptions';
import { Projects } from '@/pages/Projects';
import { ProjectDetail } from '@/pages/ProjectDetail';
import { Vault } from '@/pages/Vault';
import { Skills } from '@/pages/Skills';
import { Analytics } from '@/pages/Analytics';
import { SettingsLayout, SettingsIndex } from '@/pages/SettingsLayout';
import { Profile } from '@/pages/settings/Profile';
import { AIConfiguration } from '@/pages/settings/AIConfiguration';
import { Notifications } from '@/pages/settings/Notifications';
import { Integrations } from '@/pages/settings/Integrations';
import { ResponseTemplates } from '@/pages/settings/ResponseTemplates';
import { TriageRules } from '@/pages/settings/TriageRules';
import { System } from '@/pages/settings/System';
import { AuditLog } from '@/pages/AuditLog';
import { OrgAdmin } from '@/pages/OrgAdmin';
import { SuperAdmin } from '@/pages/SuperAdmin';
import { NotFound } from '@/pages/NotFound';
import { Login } from '@/pages/Login';
import { useSession } from '@/hooks/useSession';

/**
 * Auth guard that redirects to /login if not authenticated.
 */
function RequireAuth() {
  const { isAuthenticated, isLoading } = useSession();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-10">
        <div className="text-gray-60">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export function Router() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />

        {/* Protected routes */}
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/agents/:agentId" element={<AgentDetail />} />
            <Route path="/agents/:agentId/canvas" element={<AgentCanvas />} />
            <Route path="/approvals" element={<Approvals />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/infrastructure" element={<Infrastructure />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/finance/expenses" element={<Expenses />} />
            <Route path="/finance/ai-budget" element={<AIBudget />} />
            <Route path="/finance/subscriptions" element={<Subscriptions />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/vault" element={<Vault />} />
            <Route path="/skills" element={<Skills />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/audit-log" element={<AuditLog />} />
            <Route path="/admin" element={<OrgAdmin />} />
            <Route path="/super-admin" element={<SuperAdmin />} />
            <Route path="/settings" element={<SettingsLayout />}>
              <Route index element={<SettingsIndex />} />
              <Route path="profile" element={<Profile />} />
              <Route path="ai-configuration" element={<AIConfiguration />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="integrations" element={<Integrations />} />
              <Route path="response-templates" element={<ResponseTemplates />} />
              <Route path="triage-rules" element={<TriageRules />} />
              <Route path="system" element={<System />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
