import { useState } from 'react';
import { PageHeader } from '@/components/shell/PageHeader';
import { useSkills, useCreateSkill, useUpdateSkill } from '@/hooks/useSkills';
import { SkillDetail } from '@/components/SkillDetail';
import { SkillForm } from '@/components/SkillForm';
import { Button } from '@/components/ui/button';
import type { Skill } from '@/hooks/useSkills';

export function Skills() {
  const { data, isLoading } = useSkills();
  const createSkill = useCreateSkill();
  const updateSkill = useUpdateSkill();
  const [selectedSkillId, setSelectedSkillId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);

  const skills = data?.skills ?? [];

  const handleCreateNew = () => {
    setEditingSkill(null);
    setFormOpen(true);
  };

  const handleEdit = (skill: Skill) => {
    setEditingSkill(skill);
    setFormOpen(true);
  };

  const handleSave = async (data: any) => {
    if (data.id) {
      // Update existing
      await updateSkill.mutateAsync(data);
    } else {
      // Create new
      await createSkill.mutateAsync(data);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Skills"
        subtitle={`${skills.length} skill${skills.length !== 1 ? 's' : ''} in registry`}
        actions={
          <Button onClick={handleCreateNew}>
            Create Skill
          </Button>
        }
      />

      {/* Skills Grid */}
      <div className="flex-1 px-4 pb-4 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-60">
            Loading skills...
          </div>
        ) : skills.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-60">
            <p className="text-center">No skills found in the registry</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-20">
                  <th className="text-left py-3 px-3 text-sm font-medium text-gray-70">Name</th>
                  <th className="text-left py-3 px-3 text-sm font-medium text-gray-70">Description</th>
                  <th className="text-left py-3 px-3 text-sm font-medium text-gray-70">Category</th>
                  <th className="text-left py-3 px-3 text-sm font-medium text-gray-70">Author</th>
                  <th className="text-left py-3 px-3 text-sm font-medium text-gray-70">Version</th>
                  <th className="text-left py-3 px-3 text-sm font-medium text-gray-70">Source</th>
                  <th className="text-left py-3 px-3 text-sm font-medium text-gray-70">Usage</th>
                  <th className="text-left py-3 px-3 text-sm font-medium text-gray-70">Status</th>
                </tr>
              </thead>
              <tbody>
                {skills.map((skill) => (
                  <tr
                    key={skill.id}
                    onClick={() => setSelectedSkillId(skill.id)}
                    className="border-b border-gray-10 hover:bg-gray-10 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-90">{skill.name}</span>
                        {skill.tags && skill.tags.length > 0 && (
                          <div className="flex gap-1">
                            {skill.tags.slice(0, 2).map((tag, idx) => (
                              <span
                                key={idx}
                                className="inline-block px-1.5 py-0.5 text-xs bg-gray-20 text-gray-70 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                            {skill.tags.length > 2 && (
                              <span className="inline-block px-1.5 py-0.5 text-xs bg-gray-20 text-gray-70 rounded">
                                +{skill.tags.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-sm text-gray-70 max-w-md truncate">
                      {skill.description || '—'}
                    </td>
                    <td className="py-3 px-3 text-sm text-gray-70">
                      {skill.category || '—'}
                    </td>
                    <td className="py-3 px-3 text-sm text-gray-70">
                      {skill.author}
                    </td>
                    <td className="py-3 px-3 text-sm text-gray-70">
                      {skill.version}
                    </td>
                    <td className="py-3 px-3 text-sm">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded ${
                        skill.installSource === 'builtin'
                          ? 'bg-blue-10 text-blue-70'
                          : skill.installSource === 'marketplace'
                          ? 'bg-purple-10 text-purple-70'
                          : 'bg-gray-20 text-gray-70'
                      }`}>
                        {skill.installSource}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-sm text-gray-70">
                      {skill.usageCount.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-sm">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded ${
                        skill.isEnabled
                          ? 'bg-green-10 text-green-70'
                          : 'bg-gray-20 text-gray-70'
                      }`}>
                        {skill.isEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Skill Detail Modal */}
      {selectedSkillId && (
        <SkillDetail
          skillId={selectedSkillId}
          onClose={() => setSelectedSkillId(null)}
          onEdit={(skill) => {
            setSelectedSkillId(null);
            handleEdit(skill);
          }}
        />
      )}

      {/* Skill Form Modal */}
      <SkillForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        skill={editingSkill}
        onSave={handleSave}
        isSaving={createSkill.isPending || updateSkill.isPending}
      />
    </div>
  );
}
