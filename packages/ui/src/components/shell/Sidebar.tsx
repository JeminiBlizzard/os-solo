import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Bot,
  CheckSquare,
  Inbox,
  Server,
  DollarSign,
  FolderKanban,
  Lock,
  Shield,
  ShieldCheck,
  Settings,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePendingApprovalCount } from '@/hooks/useApprovals';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  badge?: number | null;
  showDot?: boolean;
}

interface NavGroup {
  title?: string;
  items: NavItem[];
}

interface UpdateCheckResult {
  updateAvailable: boolean;
}

function NotificationBadge({ count }: { count: number | null | undefined }) {
  if (!count || count <= 0) return null;

  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-brand text-xs font-medium text-white px-1.5">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function UpdateIndicatorDot() {
  return (
    <span className="ml-auto flex h-2 w-2 rounded-full bg-brand animate-pulse" />
  );
}

function useNavGroups(): NavGroup[] {
  const { data: pendingCount } = usePendingApprovalCount();

  // Check for system updates
  const { data: updateCheck } = useQuery({
    queryKey: ['system-update-check'],
    queryFn: async (): Promise<UpdateCheckResult> => {
      return await apiClient.get<UpdateCheckResult>('/api/v1/system/update-check');
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: false, // Don't retry if it fails
  });

  const hasUpdate = updateCheck?.updateAvailable || false;

  return [
    {
      items: [
        { label: 'Dashboard', path: '/', icon: LayoutDashboard },
        { label: 'Agents', path: '/agents', icon: Bot },
        { label: 'Approval Queue', path: '/approvals', icon: CheckSquare, badge: pendingCount },
        { label: 'Inbox', path: '/inbox', icon: Inbox },
        { label: 'Infrastructure', path: '/infrastructure', icon: Server },
        { label: 'Finance', path: '/finance', icon: DollarSign },
        { label: 'Projects', path: '/projects', icon: FolderKanban },
        { label: 'Vault', path: '/vault', icon: Lock },
        { label: 'Analytics', path: '/analytics', icon: BarChart3 },
      ],
    },
    {
      title: 'System Administration',
      items: [
        { label: 'Org Admin', path: '/admin', icon: Shield },
        { label: 'Super Admin', path: '/super-admin', icon: ShieldCheck },
      ],
    },
    {
      title: 'Settings',
      items: [{ label: 'Settings', path: '/settings', icon: Settings, showDot: hasUpdate }],
    },
  ];
}

export function Sidebar() {
  const navGroups = useNavGroups();
  return (
    <aside className="w-60 bg-white border-r border-gray-20 flex flex-col h-screen">
      <div className="flex-1 overflow-y-auto py-4">
        {navGroups.map((group, groupIdx) => (
          <div key={groupIdx} className="mb-6">
            {group.title && (
              <h3 className="px-4 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-60">
                {group.title}
              </h3>
            )}
            <nav className="space-y-1 px-2">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors border-l-4 border-transparent',
                        isActive
                          ? 'bg-gray-20 border-brand text-gray-100'
                          : 'text-gray-70 hover:bg-gray-10 hover:text-gray-100'
                      )
                    }
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{item.label}</span>
                    {item.badge ? (
                      <NotificationBadge count={item.badge} />
                    ) : item.showDot ? (
                      <UpdateIndicatorDot />
                    ) : null}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Version footer */}
      <div className="p-4 border-t border-gray-20">
        <p className="text-xs text-gray-60">OS // SOLO</p>
        <p className="text-xs text-gray-50">v0.0.0</p>
      </div>
    </aside>
  );
}
