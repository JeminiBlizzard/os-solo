import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useSaveKnowledge, type ProjectKnowledge } from '@/hooks/useProjects';
import { toast } from 'sonner';

interface KnowledgeBaseTabProps {
  projectId: number;
  knowledge: ProjectKnowledge | null;
}

const FIELDS: { key: keyof ProjectKnowledge; label: string; hint: string; multiline: boolean }[] = [
  { key: 'version', label: 'Version', hint: 'e.g., 2.1.0', multiline: false },
  { key: 'techStack', label: 'Tech Stack', hint: 'Languages, frameworks, databases, and tools', multiline: true },
  { key: 'architecture', label: 'Architecture', hint: 'System architecture, patterns, and data flow', multiline: true },
  { key: 'conventions', label: 'Conventions', hint: 'Coding standards, naming conventions, file organization rules', multiline: true },
  { key: 'folderStructure', label: 'Folder Structure', hint: 'Key directories and what lives where', multiline: true },
  { key: 'authApproach', label: 'Auth Approach', hint: 'Authentication and authorization patterns', multiline: true },
  { key: 'errorHandling', label: 'Error Handling', hint: 'How errors are caught, logged, and surfaced', multiline: true },
  { key: 'hardConstraints', label: 'Hard Constraints', hint: 'Rules that must never be violated', multiline: true },
  { key: 'endStateVision', label: 'End State Vision', hint: 'What this project looks like when it is done', multiline: true },
];

export function KnowledgeBaseTab({ projectId, knowledge }: KnowledgeBaseTabProps) {
  const saveKnowledge = useSaveKnowledge();
  const [dirty, setDirty] = useState(false);

  const [form, setForm] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of FIELDS) {
      initial[f.key] = (knowledge?.[f.key] as string) ?? '';
    }
    return initial;
  });

  // Reset form when knowledge data changes (e.g., after save invalidation)
  useEffect(() => {
    const updated: Record<string, string> = {};
    for (const f of FIELDS) {
      updated[f.key] = (knowledge?.[f.key] as string) ?? '';
    }
    setForm(updated);
    setDirty(false);
  }, [knowledge]);

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    try {
      await saveKnowledge.mutateAsync({
        projectId,
        ...Object.fromEntries(
          Object.entries(form).map(([k, v]) => [k, v || null])
        ),
      } as any);
      toast.success('Knowledge base saved');
      setDirty(false);
    } catch {
      // error toast handled by apiClient
    }
  };

  const filledCount = FIELDS.filter((f) => form[f.key]?.trim()).length;

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-100">Knowledge Base</h3>
          <p className="text-sm text-gray-50 mt-0.5">
            This context is injected into AI agents when they work on this project.
            {filledCount > 0 && ` ${filledCount} of ${FIELDS.length} fields populated.`}
          </p>
        </div>
        <Button
          onClick={handleSave}
          size="sm"
          disabled={!dirty || saveKnowledge.isPending}
        >
          {saveKnowledge.isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>

      <div className="space-y-5 max-w-3xl">
        {FIELDS.map((field) => (
          <div key={field.key}>
            <Label className="text-sm font-medium text-gray-100 mb-1 block">
              {field.label}
            </Label>
            {field.multiline ? (
              <Textarea
                value={form[field.key] || ''}
                onChange={(e) => handleChange(field.key, e.target.value)}
                placeholder={field.hint}
                className="min-h-[100px] font-mono text-sm"
              />
            ) : (
              <Input
                value={form[field.key] || ''}
                onChange={(e) => handleChange(field.key, e.target.value)}
                placeholder={field.hint}
                className="max-w-md"
              />
            )}
          </div>
        ))}
      </div>

      {dirty && (
        <div className="mt-6 pt-4 border-t border-gray-20 flex gap-2">
          <Button onClick={handleSave} size="sm" disabled={saveKnowledge.isPending}>
            {saveKnowledge.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const reset: Record<string, string> = {};
              for (const f of FIELDS) {
                reset[f.key] = (knowledge?.[f.key] as string) ?? '';
              }
              setForm(reset);
              setDirty(false);
            }}
          >
            Discard
          </Button>
        </div>
      )}
    </div>
  );
}
