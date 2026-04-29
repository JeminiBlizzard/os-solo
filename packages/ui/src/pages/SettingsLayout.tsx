import { Outlet, Navigate } from 'react-router-dom';
import { PageHeader } from '@/components/shell/PageHeader';
import { SettingsNav } from '@/components/settings/SettingsNav';

export function SettingsLayout() {
  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Settings"
        subtitle="Manage your profile, preferences, and integrations"
      />
      <div className="flex flex-1 overflow-hidden">
        <SettingsNav />
        <main className="flex-1 overflow-y-auto bg-gray-10 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function SettingsIndex() {
  return <Navigate to="/settings/profile" replace />;
}
