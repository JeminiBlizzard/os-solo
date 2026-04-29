import { useState } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
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

const TIMEZONES = [
  { value: 'America/New_York', label: 'America/New York (EST/EDT)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)' },
  { value: 'America/Denver', label: 'America/Denver (MST/MDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los Angeles (PST/PDT)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEDT/AEST)' },
];

const THEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export function Profile() {
  const { settings, updateSettings, changePassword, isChangingPassword } = useSettings();
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [authWarningModalOpen, setAuthWarningModalOpen] = useState(false);

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-60">Loading settings...</div>
      </div>
    );
  }

  const handleProfileUpdate = (field: string, value: string) => {
    updateSettings({ profile: { [field]: value } });
  };

  const handlePreferenceUpdate = (field: string, value: string) => {
    updateSettings({ preferences: { [field]: value } });
  };

  const handleAuthEnabledToggle = (enabled: boolean) => {
    // Check if user has a password when toggling on
    if (enabled && !settings.profile.auth_enabled) {
      setAuthWarningModalOpen(true);
      return;
    }

    // Note: auth_enabled is in the users table, not user_settings
    // For now, we'll just show a warning. The actual toggle would need
    // a separate endpoint or different handling
    toast.error('Toggling auth requires password setup first');
  };

  const handlePasswordChange = () => {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordForm.new_password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    changePassword(
      {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      },
      {
        onSuccess: () => {
          setPasswordModalOpen(false);
          setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
        },
      }
    );
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Profile Information</h2>
        <div className="space-y-4">
          <div>
            <Label htmlFor="display_name">Display Name</Label>
            <Input
              id="display_name"
              value={settings.profile.display_name}
              onChange={(e) => handleProfileUpdate('display_name', e.target.value)}
              onBlur={(e) => handleProfileUpdate('display_name', e.target.value)}
              placeholder="Your name"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={settings.profile.email}
              onChange={(e) => handleProfileUpdate('email', e.target.value)}
              onBlur={(e) => handleProfileUpdate('email', e.target.value)}
              placeholder="your@email.com"
              className="mt-1"
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Preferences</h2>
        <div className="space-y-4">
          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <Select
              value={settings.preferences.timezone}
              onValueChange={(value) => handlePreferenceUpdate('timezone', value)}
            >
              <SelectTrigger id="timezone" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="theme">Theme</Label>
            <Select
              value={settings.preferences.theme}
              onValueChange={(value) => handlePreferenceUpdate('theme', value)}
            >
              <SelectTrigger id="theme" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THEMES.map((theme) => (
                  <SelectItem key={theme.value} value={theme.value}>
                    {theme.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-60 mt-1">
              Theme implementation coming in v2
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Security</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auth_enabled">Password Authentication</Label>
              <p className="text-sm text-gray-60 mt-1">
                Require password to access the application
              </p>
            </div>
            <Switch
              id="auth_enabled"
              checked={settings.profile.auth_enabled}
              onCheckedChange={handleAuthEnabledToggle}
            />
          </div>

          <div>
            <Button onClick={() => setPasswordModalOpen(true)}>
              Change Password
            </Button>
          </div>
        </div>
      </Card>

      {/* Password Change Modal */}
      <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="current_password">Current Password</Label>
              <Input
                id="current_password"
                type="password"
                value={passwordForm.current_password}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, current_password: e.target.value })
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="new_password">New Password</Label>
              <Input
                id="new_password"
                type="password"
                value={passwordForm.new_password}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, new_password: e.target.value })
                }
                className="mt-1"
              />
              <p className="text-xs text-gray-60 mt-1">
                Must be at least 8 characters
              </p>
            </div>
            <div>
              <Label htmlFor="confirm_password">Confirm New Password</Label>
              <Input
                id="confirm_password"
                type="password"
                value={passwordForm.confirm_password}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, confirm_password: e.target.value })
                }
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePasswordChange} disabled={isChangingPassword}>
              {isChangingPassword ? 'Updating...' : 'Update Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auth Warning Modal */}
      <Dialog open={authWarningModalOpen} onOpenChange={setAuthWarningModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set a Password First</DialogTitle>
            <DialogDescription>
              You must set a password before enabling password authentication.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAuthWarningModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setAuthWarningModalOpen(false);
                setPasswordModalOpen(true);
              }}
            >
              Set Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
