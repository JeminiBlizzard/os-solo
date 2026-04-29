import { useState } from 'react';
import { PageHeader } from '@/components/shell/PageHeader';
import { ComingSoonBanner } from '@/components/ComingSoonBanner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, Plus } from 'lucide-react';

// Mock data for users
const mockUsers = [
  {
    id: 1,
    name: 'Alice Johnson',
    email: 'alice@example.com',
    role: 'owner' as const,
    status: 'active' as const,
  },
  {
    id: 2,
    name: 'Bob Smith',
    email: 'bob@example.com',
    role: 'admin' as const,
    status: 'active' as const,
  },
  {
    id: 3,
    name: 'Carol Martinez',
    email: 'carol@example.com',
    role: 'member' as const,
    status: 'invited' as const,
  },
];

// Mock data for API keys
const mockApiKeys = [
  {
    id: 1,
    name: 'Production API Key',
    keyPrefix: 'sk_live_****abc123',
    scopes: ['read', 'write'],
    lastUsed: '2026-04-26T14:32:00Z',
    created: '2026-01-15T10:00:00Z',
  },
  {
    id: 2,
    name: 'Development API Key',
    keyPrefix: 'sk_live_****def456',
    scopes: ['read'],
    lastUsed: '2026-04-25T09:15:00Z',
    created: '2026-02-01T08:30:00Z',
  },
];

function RoleBadge({ role }: { role: 'owner' | 'admin' | 'member' }) {
  const colors = {
    owner: 'bg-purple-80 text-purple-30',
    admin: 'bg-blue-80 text-blue-30',
    member: 'bg-gray-70 text-gray-30',
  };

  return (
    <Badge className={`${colors[role]} border-0`}>
      {role}
    </Badge>
  );
}

function StatusBadge({ status }: { status: 'active' | 'invited' }) {
  const colors = {
    active: 'bg-green-80 text-green-30',
    invited: 'bg-yellow-80 text-yellow-30',
  };

  return (
    <Badge className={`${colors[status]} border-0`}>
      {status}
    </Badge>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function OrgAdmin() {
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [apiKeySearchQuery, setApiKeySearchQuery] = useState('');

  return (
    <div>
      <PageHeader
        title="Organization Admin"
        subtitle="Manage users, permissions, and API keys for your organization"
      />

      <ComingSoonBanner />

      <Tabs defaultValue="users" className="mt-6">
        <TabsList>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
        </TabsList>

        {/* User Management Tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-50" />
              <Input
                placeholder="Search users..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="pl-9"
                disabled
              />
            </div>
            <Button disabled className="gap-2">
              <UserPlus className="h-4 w-4" />
              Invite User
            </Button>
          </div>

          {/* Coming in v2 notice for invite button */}
          <div className="rounded-lg border border-blue-80 bg-blue-90 p-3">
            <p className="text-sm text-blue-30">
              <strong>Coming in v2:</strong> User invitations and role management will be available in a future release.
            </p>
          </div>

          <div className="rounded-lg border border-gray-80 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="text-gray-50">{user.email}</TableCell>
                    <TableCell>
                      <RoleBadge role={user.role} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={user.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" disabled>
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api-keys" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-50" />
              <Input
                placeholder="Search API keys..."
                value={apiKeySearchQuery}
                onChange={(e) => setApiKeySearchQuery(e.target.value)}
                className="pl-9"
                disabled
              />
            </div>
            <Button disabled className="gap-2">
              <Plus className="h-4 w-4" />
              Create API Key
            </Button>
          </div>

          {/* Coming in v2 notice */}
          <div className="rounded-lg border border-blue-80 bg-blue-90 p-3">
            <p className="text-sm text-blue-30">
              <strong>Coming in v2:</strong> API key generation and management will be available in a future release.
            </p>
          </div>

          <div className="rounded-lg border border-gray-80 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockApiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell className="font-mono text-sm text-gray-50">
                      {key.keyPrefix}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {key.scopes.map((scope) => (
                          <Badge key={scope} className="bg-gray-80 text-gray-30 border-0">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-50 text-sm">
                      {formatDate(key.lastUsed)}
                    </TableCell>
                    <TableCell className="text-gray-50 text-sm">
                      {formatDate(key.created)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" disabled>
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
