import { type FormEvent, useState } from 'react';
import { createOrganization } from '@/api/organizations';
import { createProject } from '@/api/projects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useProjectContext } from '@/contexts/ProjectContext';

export function OnboardingPage(): React.JSX.Element {
  const { setActiveProject } = useProjectContext();
  const [orgName, setOrgName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = orgName.trim().length > 0 && projectName.trim().length > 0 && !submitting;

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const org = await createOrganization(orgName.trim());
      const project = await createProject(org.id, projectName.trim());
      setActiveProject(project, { id: org.id, name: org.name, slug: org.slug });
    } catch {
      setError('Could not create your workspace. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Welcome to MetricYak</h1>
          <p className="text-sm text-muted-foreground">
            Create your organization and first project to get started.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-name">Organization name</Label>
          <Input
            id="org-name"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Acme Rockets"
            maxLength={64}
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-name">First project name</Label>
          <Input
            id="project-name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Web App"
            maxLength={128}
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={!canSubmit} className="w-full">
          {submitting ? 'Creating…' : 'Create workspace'}
        </Button>
      </form>
    </div>
  );
}
