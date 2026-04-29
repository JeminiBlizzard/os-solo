import { useSettings } from '@/hooks/useSettings';
import { Card } from '@/components/ui/card';
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
import { AIProviders } from '@/components/settings/AIProviders';

const AI_MODELS = [
  { value: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
  { value: 'claude-opus-4', label: 'Claude Opus 4' },
  { value: 'claude-sonnet-3-5', label: 'Claude Sonnet 3.5' },
  { value: 'claude-haiku-3-5', label: 'Claude Haiku 3.5' },
];

export function AIConfiguration() {
  const { settings, updateSettings } = useSettings();

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-60">Loading settings...</div>
      </div>
    );
  }

  const handleModelChange = (value: string) => {
    updateSettings({ preferences: { default_ai_model: value } });
  };

  const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dollars = parseFloat(e.target.value);
    if (!isNaN(dollars) && dollars >= 0) {
      const cents = Math.round(dollars * 100);
      updateSettings({ preferences: { ai_monthly_budget_cents: cents } });
    }
  };

  const handleAutoPauseToggle = (checked: boolean) => {
    updateSettings({ preferences: { auto_pause_budget: checked } });
  };

  const handleMemoryExtractionToggle = (checked: boolean) => {
    updateSettings({ preferences: { auto_memory_extraction: checked } });
  };

  // Convert cents to dollars for display
  const budgetDollars = (settings.preferences.ai_monthly_budget_cents / 100).toFixed(2);

  return (
    <div className="max-w-3xl space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Default Settings</h2>
        <div className="space-y-4">
          <div>
            <Label htmlFor="default_ai_model">Default AI Model</Label>
            <Select
              value={settings.preferences.default_ai_model || ''}
              onValueChange={handleModelChange}
            >
              <SelectTrigger id="default_ai_model" className="mt-1">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {AI_MODELS.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-60 mt-1">
              Default model for AI agents and briefings
            </p>
          </div>

          <div>
            <Label htmlFor="ai_monthly_budget">Monthly AI Budget</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-60">
                $
              </span>
              <Input
                id="ai_monthly_budget"
                type="number"
                step="0.01"
                min="0"
                value={budgetDollars}
                onChange={handleBudgetChange}
                className="pl-7"
              />
            </div>
            <p className="text-xs text-gray-60 mt-1">
              Maximum monthly spend on AI API calls
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto_pause_budget">Auto-pause on Budget Threshold</Label>
              <p className="text-sm text-gray-60 mt-1">
                Automatically pause AI operations when monthly budget is reached
              </p>
            </div>
            <Switch
              id="auto_pause_budget"
              checked={settings.preferences.auto_pause_budget}
              onCheckedChange={handleAutoPauseToggle}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto_memory_extraction">Memory Extraction Default</Label>
              <p className="text-sm text-gray-60 mt-1">
                Enable automatic memory extraction for AI interactions by default
              </p>
            </div>
            <Switch
              id="auto_memory_extraction"
              checked={settings.preferences.auto_memory_extraction}
              onCheckedChange={handleMemoryExtractionToggle}
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <AIProviders />
      </Card>
    </div>
  );
}
