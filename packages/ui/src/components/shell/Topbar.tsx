import { Search, Zap, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { NotificationBell } from '../NotificationBell';

export function Topbar() {
  return (
    <header className="h-14 border-b border-gray-20 bg-white flex items-center px-4 gap-4">
      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="h-8 w-8 bg-brand flex items-center justify-center text-white font-bold text-sm">
          OS
        </div>
        <span className="font-semibold text-gray-100" style={{ fontWeight: 600 }}>
          OS // SOLO
        </span>
      </div>

      {/* Global search */}
      <div className="flex-1 max-w-xl mx-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-50" />
          <Input
            type="search"
            placeholder="Search (Cmd+K)"
            className="pl-10"
            disabled
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Focus Mode stub */}
        <Button variant="ghost" size="icon" disabled title="Focus Mode (coming soon)">
          <Zap className="h-5 w-5" />
        </Button>

        {/* Notification bell */}
        <NotificationBell />

        {/* User avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-9 w-9 bg-gray-20"
            >
              <User className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled>Settings</DropdownMenuItem>
            <DropdownMenuItem disabled>Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
