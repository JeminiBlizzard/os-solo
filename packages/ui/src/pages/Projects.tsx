import { useState } from 'react';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { CreateProjectDrawer } from '@/components/projects/CreateProjectDrawer';
import { useProjects } from '@/hooks/useProjects';

type FilterTab = 'all' | 'active' | 'paused' | 'completed';

export function Projects() {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data, isLoading } = useProjects(showArchived);
  const projects = data?.projects ?? [];

  // Filter projects based on active tab
  const filteredProjects = projects.filter((project) => {
    if (activeTab === 'all') return true;
    return project.status.toLowerCase() === activeTab;
  });

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Projects"
        subtitle={`${filteredProjects.length} project${filteredProjects.length !== 1 ? 's' : ''}`}
        actions={
          <Button onClick={() => setDrawerOpen(true)}>
            Add Project
          </Button>
        }
      />

      <div className="px-4 pb-2 space-y-3">
        {/* Status Filter Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as FilterTab)}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="paused">Paused</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Show Archived Toggle */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="show-archived"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="h-4 w-4"
          />
          <label htmlFor="show-archived" className="text-sm text-gray-60 cursor-pointer">
            Show archived projects
          </label>
        </div>
      </div>

      {/* Project Grid */}
      <div className="flex-1 px-4 pb-4 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-60">
            Loading projects...
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-60">
            {projects.length === 0 ? (
              <>
                <p className="text-lg text-gray-100 mb-2">No projects yet</p>
                <p className="text-sm mb-4">Create a project to start tracking your work, notes, and agent context.</p>
                <Button onClick={() => setDrawerOpen(true)}>
                  Add Project
                </Button>
              </>
            ) : (
              <p className="text-center">
                {activeTab === 'all'
                  ? 'No projects match the current filter'
                  : `No ${activeTab} projects`}
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>

      {/* Create Project Drawer */}
      <CreateProjectDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
