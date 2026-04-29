import { NavLink } from 'react-router-dom';
import { User, Brain, Bell, Link2, FileText, ListFilter, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SettingsNavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const NAV_ITEMS: SettingsNavItem[] = [
  { label: 'Profile', path: '/settings/profile', icon: User },
  { label: 'AI Configuration', path: '/settings/ai-configuration', icon: Brain },
  { label: 'Notifications', path: '/settings/notifications', icon: Bell },
  { label: 'Integrations', path: '/settings/integrations', icon: Link2 },
  { label: 'Response Templates', path: '/settings/response-templates', icon: FileText },
  { label: 'Triage Rules', path: '/settings/triage-rules', icon: ListFilter },
  { label: 'System', path: '/settings/system', icon: Settings2 },
];

export function SettingsNav() {
  return (
    <nav className="w-60 border-r border-gray-20 bg-white flex-shrink-0">
      <div className="p-4">
        <h2 className="text-sm font-semibold text-gray-100 mb-3">Settings</h2>
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                      isActive
                        ? 'bg-gray-20 text-gray-100'
                        : 'text-gray-70 hover:bg-gray-10 hover:text-gray-100'
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
