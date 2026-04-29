import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Trash2, TestTube, Edit } from 'lucide-react';

interface NotificationChannel {
  id: number;
  userId: number;
  type: string;
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NotificationRule {
  id: number;
  userId: number;
  eventType: string;
  severityMinimum: string;
  channelId: number;
  enabled: boolean;
  suppressInFocusMode: boolean;
  createdAt: string;
}

interface ChannelFormData {
  type: string;
  config: Record<string, unknown>;
  enabled: boolean;
}

const CHANNEL_TYPES = [
  { value: 'slack', label: 'Slack' },
  { value: 'discord', label: 'Discord' },
  { value: 'email', label: 'Email' },
  { value: 'browser_push', label: 'Browser Push' },
];

const SEVERITY_LEVELS = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
];

// Event types grouped by category for better UX
const EVENT_TYPE_GROUPS = [
  {
    category: 'Agents',
    events: [
      { value: 'agent.run.started', label: 'Agent Run Started' },
      { value: 'agent.run.completed', label: 'Agent Run Completed' },
      { value: 'agent.run.failed', label: 'Agent Run Failed' },
    ],
  },
  {
    category: 'Approvals',
    events: [
      { value: 'approval.requested', label: 'Approval Requested' },
      { value: 'approval.approved', label: 'Approval Approved' },
      { value: 'approval.rejected', label: 'Approval Rejected' },
    ],
  },
  {
    category: 'Inbox',
    events: [
      { value: 'inbox.item.created', label: 'New Inbox Item' },
      { value: 'inbox.item.high_priority', label: 'High Priority Item' },
    ],
  },
  {
    category: 'Infrastructure',
    events: [
      { value: 'server.health.degraded', label: 'Server Health Degraded' },
      { value: 'server.health.down', label: 'Server Down' },
    ],
  },
  {
    category: 'Budget',
    events: [
      { value: 'budget.warning', label: 'Budget Warning' },
      { value: 'budget.exceeded', label: 'Budget Exceeded' },
    ],
  },
  {
    category: 'Workflows',
    events: [
      { value: 'workflow.completed', label: 'Workflow Completed' },
      { value: 'workflow.failed', label: 'Workflow Failed' },
    ],
  },
];

export function NotificationSettings() {
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelModalOpen, setChannelModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null);
  const [channelForm, setChannelForm] = useState<ChannelFormData>({
    type: 'slack',
    config: {},
    enabled: true,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [channelsRes, rulesRes] = await Promise.all([
        fetch('/api/v1/notification-channels', { credentials: 'include' }),
        fetch('/api/v1/notification-rules', { credentials: 'include' }),
      ]);

      if (channelsRes.ok && rulesRes.ok) {
        const channelsData = await channelsRes.json();
        const rulesData = await rulesRes.json();
        setChannels(channelsData.data || []);
        setRules(rulesData.data || []);
      } else {
        toast.error('Failed to load notification settings');
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
      toast.error('Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };

  // Load channels and rules on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, []);

  const handleAddChannel = () => {
    setEditingChannel(null);
    setChannelForm({
      type: 'slack',
      config: {},
      enabled: true,
    });
    setChannelModalOpen(true);
  };

  const handleEditChannel = (channel: NotificationChannel) => {
    setEditingChannel(channel);
    setChannelForm({
      type: channel.type,
      config: channel.config,
      enabled: channel.enabled,
    });
    setChannelModalOpen(true);
  };

  const handleSaveChannel = async () => {
    try {
      const url = editingChannel
        ? `/api/v1/notification-channels/${editingChannel.id}`
        : '/api/v1/notification-channels';
      const method = editingChannel ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(channelForm),
      });

      if (response.ok) {
        toast.success(editingChannel ? 'Channel updated' : 'Channel created');
        setChannelModalOpen(false);
        loadData();
      } else {
        const error = await response.json();
        toast.error(error.error?.message || 'Failed to save channel');
      }
    } catch (error) {
      console.error('Error saving channel:', error);
      toast.error('Failed to save channel');
    }
  };

  const handleDeleteChannel = async (channelId: number) => {
    if (!confirm('Delete this notification channel? All associated rules will also be deleted.')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/notification-channels/${channelId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        toast.success('Channel deleted');
        loadData();
      } else {
        toast.error('Failed to delete channel');
      }
    } catch (error) {
      console.error('Error deleting channel:', error);
      toast.error('Failed to delete channel');
    }
  };

  const handleTestChannel = async (channelId: number) => {
    try {
      const response = await fetch(`/api/v1/notification-channels/${channelId}/test`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        toast.success('Test notification sent successfully');
      } else {
        const error = await response.json();
        toast.error(error.error?.message || 'Test notification failed');
      }
    } catch (error) {
      console.error('Error testing channel:', error);
      toast.error('Failed to send test notification');
    }
  };

  const handleToggleRule = async (eventType: string, channelId: number, currentEnabled: boolean) => {
    // Find existing rule
    const existingRule = rules.find(
      (r) => r.eventType === eventType && r.channelId === channelId
    );

    try {
      if (existingRule) {
        // Update existing rule
        const response = await fetch(`/api/v1/notification-rules/${existingRule.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ enabled: !currentEnabled }),
        });

        if (response.ok) {
          loadData();
        } else {
          toast.error('Failed to update rule');
        }
      } else {
        // Create new rule
        const response = await fetch('/api/v1/notification-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            eventType,
            channelId,
            severityMinimum: 'info',
            enabled: true,
            suppressInFocusMode: true,
          }),
        });

        if (response.ok) {
          loadData();
        } else {
          const error = await response.json();
          toast.error(error.error?.message || 'Failed to create rule');
        }
      }
    } catch (error) {
      console.error('Error toggling rule:', error);
      toast.error('Failed to update rule');
    }
  };

  const handleSeverityChange = async (ruleId: number, severity: string) => {
    try {
      const response = await fetch(`/api/v1/notification-rules/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ severityMinimum: severity }),
      });

      if (response.ok) {
        loadData();
      } else {
        toast.error('Failed to update severity');
      }
    } catch (error) {
      console.error('Error updating severity:', error);
      toast.error('Failed to update severity');
    }
  };

  const handleFocusModeChange = async (ruleId: number, suppress: boolean) => {
    try {
      const response = await fetch(`/api/v1/notification-rules/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ suppressInFocusMode: suppress }),
      });

      if (response.ok) {
        loadData();
      } else {
        toast.error('Failed to update focus mode setting');
      }
    } catch (error) {
      console.error('Error updating focus mode:', error);
      toast.error('Failed to update focus mode setting');
    }
  };

  const getChannelConfigField = (type: string, key: string, value: unknown) => {
    if (type === 'slack' || type === 'discord') {
      return (
        <div key={key}>
          <Label htmlFor={`config_${key}`}>Webhook URL</Label>
          <Input
            id={`config_${key}`}
            type="url"
            value={value || ''}
            onChange={(e) =>
              setChannelForm({
                ...channelForm,
                config: { ...channelForm.config, webhookUrl: e.target.value },
              })
            }
            placeholder={`https://${type === 'slack' ? 'hooks.slack.com' : 'discord.com/api/webhooks'}/...`}
            className="mt-1"
          />
        </div>
      );
    } else if (type === 'email') {
      return (
        <div key={key}>
          <Label htmlFor={`config_${key}`}>Email Address</Label>
          <Input
            id={`config_${key}`}
            type="email"
            value={channelForm.config.to || ''}
            onChange={(e) =>
              setChannelForm({
                ...channelForm,
                config: { ...channelForm.config, to: e.target.value },
              })
            }
            placeholder="notifications@example.com"
            className="mt-1"
          />
        </div>
      );
    } else if (type === 'browser_push') {
      return (
        <div key="browser_push_info" className="text-sm text-gray-60">
          Browser push subscriptions are managed automatically when you enable notifications in your
          browser.
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-60">Loading notification settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      {/* Channels Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-100">Notification Channels</h2>
          <Button onClick={handleAddChannel} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Channel
          </Button>
        </div>

        {channels.length === 0 ? (
          <div className="text-sm text-gray-60 text-center py-8">
            No notification channels configured. Add one to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {channels.map((channel) => (
              <div
                key={channel.id}
                className="flex items-center justify-between p-3 border border-gray-20 rounded-md"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-100">
                      {CHANNEL_TYPES.find((t) => t.value === channel.type)?.label || channel.type}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        channel.enabled
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {channel.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-60 mt-1">
                    {channel.type === 'email' && String(channel.config.to)}
                    {(channel.type === 'slack' || channel.type === 'discord') &&
                      String(channel.config.webhookUrl)}
                    {channel.type === 'browser_push' && 'Browser notifications'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestChannel(channel.id)}
                  >
                    <TestTube className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditChannel(channel)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteChannel(channel.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Rules Matrix Section */}
      {channels.length > 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Notification Rules</h2>
          <div className="text-sm text-gray-60 mb-4">
            Configure which events trigger notifications for each channel. Click toggles to enable/disable
            rules.
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-20">
                  <th className="text-left p-3 font-medium text-gray-100">Event Type</th>
                  {channels.map((channel) => (
                    <th key={channel.id} className="text-center p-3 font-medium text-gray-100">
                      <div>{CHANNEL_TYPES.find((t) => t.value === channel.type)?.label}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EVENT_TYPE_GROUPS.map((group) => (
                  <>
                    <tr key={`category-${group.category}`} className="bg-gray-10">
                      <td
                        colSpan={channels.length + 1}
                        className="p-2 text-sm font-semibold text-gray-80"
                      >
                        {group.category}
                      </td>
                    </tr>
                    {group.events.map((event) => (
                      <tr key={event.value} className="border-b border-gray-20 hover:bg-gray-10">
                        <td className="p-3 text-sm text-gray-100">{event.label}</td>
                        {channels.map((channel) => {
                          const rule = rules.find(
                            (r) => r.eventType === event.value && r.channelId === channel.id
                          );
                          return (
                            <td key={`${event.value}-${channel.id}`} className="p-3 text-center">
                              <div className="flex flex-col items-center gap-2">
                                <Switch
                                  checked={rule?.enabled ?? false}
                                  onCheckedChange={() =>
                                    handleToggleRule(event.value, channel.id, rule?.enabled ?? false)
                                  }
                                />
                                {rule && rule.enabled && (
                                  <div className="flex flex-col gap-1 w-full">
                                    <Select
                                      value={rule.severityMinimum}
                                      onValueChange={(value) =>
                                        handleSeverityChange(rule.id, value)
                                      }
                                    >
                                      <SelectTrigger className="h-7 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {SEVERITY_LEVELS.map((s) => (
                                          <SelectItem key={s.value} value={s.value}>
                                            {s.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <label className="flex items-center gap-1 text-xs text-gray-60 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={rule.suppressInFocusMode}
                                        onChange={(e) =>
                                          handleFocusModeChange(rule.id, e.target.checked)
                                        }
                                        className="w-3 h-3"
                                      />
                                      <span>Focus</span>
                                    </label>
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-sm text-gray-60">
            <p className="font-medium mb-1">Legend:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Toggle: Enable/disable notification for this event and channel</li>
              <li>Severity dropdown: Minimum severity level to trigger notification</li>
              <li>Focus checkbox: Suppress notification when Focus Mode is active</li>
            </ul>
          </div>
        </Card>
      )}

      {/* Channel Add/Edit Modal */}
      <Dialog open={channelModalOpen} onOpenChange={setChannelModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingChannel ? 'Edit Channel' : 'Add Notification Channel'}</DialogTitle>
            <DialogDescription>
              Configure a notification channel to receive alerts from OS // SOLO
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="channel_type">Channel Type</Label>
              <Select
                value={channelForm.type}
                onValueChange={(value) =>
                  setChannelForm({ ...channelForm, type: value, config: {} })
                }
                disabled={!!editingChannel}
              >
                <SelectTrigger id="channel_type" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {getChannelConfigField(channelForm.type, 'config', channelForm.config)}

            <div className="flex items-center justify-between">
              <Label htmlFor="channel_enabled">Enable Channel</Label>
              <Switch
                id="channel_enabled"
                checked={channelForm.enabled}
                onCheckedChange={(checked) => setChannelForm({ ...channelForm, enabled: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChannelModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveChannel}>
              {editingChannel ? 'Update' : 'Create'} Channel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
