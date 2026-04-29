import { useState } from 'react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateProject } from '@/hooks/useProjects';

interface CreateProjectDrawerProps {
  open: boolean;
  onClose: () => void;
}

// Color palette matching the API
const COLOR_PALETTE = [
  '#0f62fe', // Blue
  '#24a148', // Green
  '#da1e28', // Red
  '#8a3ffc', // Purple
  '#ff7eb6', // Pink
  '#f1c21b', // Yellow
  '#d12771', // Magenta
  '#1192e8', // Light blue
];

export function CreateProjectDrawer({ open, onClose }: CreateProjectDrawerProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0]!);
  const [customColor, setCustomColor] = useState('');
  const [useCustomColor, setUseCustomColor] = useState(false);

  const createProject = useCreateProject();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Project name is required');
      return;
    }

    try {
      const color = useCustomColor ? customColor : selectedColor;
      await createProject.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        status: 'active',
      });

      toast.success('Project created successfully');

      // Reset form
      setName('');
      setDescription('');
      setSelectedColor(COLOR_PALETTE[0]!);
      setCustomColor('');
      setUseCustomColor(false);

      onClose();
    } catch (error) {
      // Error is already handled by apiClient with toast
      console.error('Failed to create project:', error);
    }
  };

  const handleClose = () => {
    if (!createProject.isPending) {
      onClose();
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <SheetHeader>
            <SheetTitle>Create Project</SheetTitle>
            <SheetDescription>
              Add a new project to organize your work
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 py-6">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-100 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Awesome Project"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-100 mb-1">
                Description
              </label>
              <Input
                id="description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the project"
              />
            </div>

            {/* Color Picker */}
            <div>
              <label className="block text-sm font-medium text-gray-100 mb-2">
                Color
              </label>

              {/* Preset colors */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`h-10 border-2 transition-all ${
                      !useCustomColor && selectedColor === color
                        ? 'border-gray-100 ring-2 ring-brand ring-offset-2'
                        : 'border-gray-20 hover:border-gray-40'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      setSelectedColor(color);
                      setUseCustomColor(false);
                    }}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>

              {/* Custom color */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="use-custom-color"
                  checked={useCustomColor}
                  onChange={(e) => setUseCustomColor(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="use-custom-color" className="text-sm text-gray-60">
                  Use custom color
                </label>
              </div>

              {useCustomColor && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="color"
                    value={customColor || '#000000'}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="h-10 w-20 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    placeholder="#000000"
                    pattern="^#[0-9A-Fa-f]{6}$"
                    className="flex-1"
                  />
                </div>
              )}
            </div>
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createProject.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createProject.isPending}>
              {createProject.isPending ? 'Creating...' : 'Create Project'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
