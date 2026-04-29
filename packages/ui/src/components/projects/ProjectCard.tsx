import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import type { Project } from '@/hooks/useProjects';

interface ProjectCardProps {
  project: Project;
}

function formatMoney(cents: number | null): string {
  if (cents === null) return '-';
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars);
}

function getStatusVariant(status: string): 'default' | 'brand' | 'outline' {
  switch (status.toLowerCase()) {
    case 'active':
      return 'brand';
    case 'paused':
      return 'default';
    default:
      return 'outline';
  }
}

export function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/projects/${project.id}`);
  };

  return (
    <div
      className="bg-white border border-gray-20 hover:border-gray-40 transition-colors cursor-pointer group"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Color accent - top strip */}
      {project.color && (
        <div className="h-1" style={{ backgroundColor: project.color }} />
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-base font-semibold text-gray-100 group-hover:text-brand transition-colors">
            {project.name}
          </h3>
          <Badge variant={getStatusVariant(project.status)} className="ml-2 capitalize">
            {project.status}
          </Badge>
        </div>

        {/* Metadata Grid */}
        <div className="space-y-2 text-sm text-gray-60">
          {project.linkedServerName && (
            <div className="flex items-center gap-2">
              <span className="text-gray-40">Server:</span>
              <span className="font-medium">{project.linkedServerName}</span>
            </div>
          )}

          {project.linkedProductMrrCents !== null && (
            <div className="flex items-center gap-2">
              <span className="text-gray-40">MRR:</span>
              <span className="font-medium">{formatMoney(project.linkedProductMrrCents)}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-gray-40">Agents:</span>
            <span className="font-medium">{project.agentCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
