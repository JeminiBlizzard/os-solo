import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Skill } from '@/hooks/useSkills';

interface SkillFormProps {
  open: boolean;
  onClose: () => void;
  skill?: Skill | null;
  onSave: (data: any) => Promise<void>;
  isSaving: boolean;
}

export function SkillForm({ open, onClose, skill, onSave, isSaving }: SkillFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [readme, setReadme] = useState('');
  const [tags, setTags] = useState('');
  const [config, setConfig] = useState('{}');

  const isEdit = !!skill;

  useEffect(() => {
    if (skill) {
      setName(skill.name);
      setDescription(skill.description || '');
      setCategory(skill.category || '');
      setVersion(skill.version);
      setReadme(''); // Don't load readme for edits unless needed
      setTags(skill.tags?.join(', ') || '');
      setConfig(JSON.stringify(skill.config || {}, null, 2));
    } else {
      // Reset form for create
      setName('');
      setDescription('');
      setCategory('');
      setVersion('1.0.0');
      setReadme('');
      setTags('');
      setConfig('{}');
    }
  }, [skill, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    // Parse and validate JSON config
    let parsedConfig;
    try {
      parsedConfig = JSON.parse(config);
    } catch (error) {
      toast.error('Invalid JSON in config field');
      return;
    }

    // Parse tags
    const tagsArray = tags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    try {
      const data = {
        name: name.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        version: version.trim(),
        readme: readme.trim() || null,
        tags: tagsArray,
        config: parsedConfig,
      };

      if (isEdit) {
        await onSave({ id: skill.id, ...data });
        toast.success('Skill updated successfully');
      } else {
        await onSave(data);
        toast.success('Skill created successfully');
      }

      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save skill');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Skill' : 'Create New Skill'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update skill details' : 'Add a new custom skill to your registry'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 px-1">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium text-gray-90">
              Name *
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., custom_api_call"
              required
              disabled={isEdit} // Don't allow name changes for existing skills
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium text-gray-90">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this skill does"
              className="w-full min-h-[60px] px-3 py-2 border border-gray-20 rounded text-sm"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="category" className="text-sm font-medium text-gray-90">
                Category
              </label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., http, cli, sql"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="version" className="text-sm font-medium text-gray-90">
                Version
              </label>
              <Input
                id="version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0.0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="tags" className="text-sm font-medium text-gray-90">
              Tags
            </label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Comma-separated tags (e.g., api, http, custom)"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="config" className="text-sm font-medium text-gray-90">
              Configuration (JSON)
            </label>
            <textarea
              id="config"
              value={config}
              onChange={(e) => setConfig(e.target.value)}
              placeholder='{"executor_type": "http", "schema": {}}'
              className="w-full min-h-[120px] px-3 py-2 border border-gray-20 rounded text-sm font-mono"
              rows={6}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="readme" className="text-sm font-medium text-gray-90">
              Readme (Markdown)
            </label>
            <textarea
              id="readme"
              value={readme}
              onChange={(e) => setReadme(e.target.value)}
              placeholder="# Skill Name&#10;&#10;Detailed documentation in markdown format..."
              className="w-full min-h-[120px] px-3 py-2 border border-gray-20 rounded text-sm font-mono"
              rows={6}
            />
          </div>

          <DialogFooter className="sticky bottom-0 bg-white pt-4 border-t border-gray-20">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : isEdit ? 'Update Skill' : 'Create Skill'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
