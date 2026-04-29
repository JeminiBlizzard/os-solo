import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ProjectOverview } from '@/components/projects/ProjectOverview';
import { NotesTab } from '@/components/projects/NotesTab';
import { KnowledgeBaseTab } from '@/components/projects/KnowledgeBaseTab';
import { ActivityTimeline } from '@/components/projects/ActivityTimeline';
import { useProject } from '@/hooks/useProjects';

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  const projectId = id ? parseInt(id, 10) : null;
  const { data, isLoading } = useProject(projectId);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-60">Loading project...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <div className="text-gray-60 mb-4">Project not found</div>
        <Button onClick={() => navigate('/projects')}>
          Back to Projects
        </Button>
      </div>
    );
  }

  const { project, knowledge, activity, agents } = data;

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title={project.name}
        subtitle={`Status: ${project.status}`}
        actions={
          <Button variant="outline" onClick={() => navigate('/projects')}>
            Back to Projects
          </Button>
        }
      />

      <div className="px-4">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setSearchParams({ tab: v })}
        >
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <ProjectOverview project={project} knowledge={knowledge} agents={agents} />
          </TabsContent>

          <TabsContent value="notes">
            <NotesTab projectId={project.id} />
          </TabsContent>

          <TabsContent value="knowledge">
            <KnowledgeBaseTab projectId={project.id} knowledge={knowledge} />
          </TabsContent>

          <TabsContent value="activity">
            <ActivityTimeline activity={activity} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
