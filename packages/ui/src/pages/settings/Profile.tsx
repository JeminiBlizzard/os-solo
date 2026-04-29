import { useState, useEffect } from 'react';
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
  const { settings, updateSettings, isUpdating, changePassword, isChangingPassword } = useSettings();

  // Local form state
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [timezone, setTimezone] = useState('');
  const [theme, setTheme] = useState('');

  // Track dirty state per section
  const [profileDirty, setProfileDirty] = useState(false);
  const [prefsDirty, setPrefsDirty] = useState(false);

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [authWarningModalOpen, setAuthWarningModalOpen] = useState(false);

  // Sync local state from server data
  useEffect(() => {
    if (settings) {
      setDisplayName(settings.profile.display_name);
      setEmail(settings.profile.email);
      setTimezone(settings.preferences.timezone);
      setTheme(settings.preferences.theme);
      setProfileDirty(false);
      setPrefsDirty(false);
    }
  }, [settings]);

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-60">Loading settings...</div>
      </div>
    );
  }

  const handleSaveProfile = () => {
    updateSettings(
      { profile: { display_name: displayName, email } },
      {
        onSuccess: () => setProfileDirty(false),
      }
    );
  };

  const handleSavePreferences = () => {
    updateSettings(
      { preferences: { timezone, theme } },
      {
        onSuccess: () => setPrefsDirty(false),
      }
    );
  };

  const handleAuthEnabledToggle = (enabled: boolean) => {
    if (enabled && !settings.profile.auth_enabled) {
      setAuthWarningModalOpen(true);
      return;
    }
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
      {/* Profile */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-100">Profile Information</h2>
          <Button
            onClick={handleSaveProfile}
            disabled={!profileDirty || isUpdating}
            size="sm"
          >
            {isUpdating ? 'Saving...' : 'Save'}
          </Button>
        </div>
        <div className="space-y-4">
          <div>
            <Label htmlFor="display_name">Display Name</Label>
            <Input
              id="display_name"
              value={displayName}
              onChange={(e) => { setDisplayName(e.target.value); setProfileDirty(true); }}
              placeholder="Your name"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setProfileDirty(true); }}
              placeholder="your@email.com"
              className="mt-1"
            />
          </div>
        </div>
      </Card>

      {/* Preferences */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-100">Preferences</h2>
          <Button
            onClick={handleSavePreferences}
            disabled={!prefsDirty || isUpdating}
            size="sm"
          >
            {isUpdating ? 'Saving...' : 'Save'}
          </Button>
        </div>
        <div className="space-y-4">
          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <Select
              value={timezone}
              onValueChange={(v) => { setTimezone(v); setPrefsDirty(true); }}
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
              value={theme}
              onValueChange={(v) => { setTheme(v); setPrefsDirty(true); }}
            >
              <SelectTrigger id="theme" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THEMES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
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

      {/* Security */}
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

      {/* Password Modal */}
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
                onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="new_password">New Password</Label>
              <Input
                id="new_password"
                type="password"
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                className="mt-1"
              />
              <p className="text-xs text-gray-60 mt-1">Must be at least 8 characters</p>
            </div>
            <div>
              <Label htmlFor="confirm_password">Confirm New Password</Label>
              <Input
                id="confirm_password"
                type="password"
                value={passwordForm.confirm_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordModalOpen(false)}>Cancel</Button>
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
            <Button variant="outline" onClick={() => setAuthWarningModalOpen(false)}>Cancel</Button>
            <Button onClick={() => { setAuthWarningModalOpen(false); setPasswordModalOpen(true); }}>
              Set Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
