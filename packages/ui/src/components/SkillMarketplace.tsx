/**
 * Skill Marketplace Component
 *
 * Placeholder UI for community skills with import/export functionality.
 * Future expansion: browsing, searching, ratings, and one-click installs.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Upload, Download, Info, AlertCircle, CheckCircle } from 'lucide-react';

interface SkillMarketplaceProps {
  onImportSuccess?: () => void;
}

export function SkillMarketplace({ onImportSuccess }: SkillMarketplaceProps) {
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const handleImportClick = () => {
    // Create file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setImporting(true);
      setImportError(null);
      setImportSuccess(null);

      try {
        const content = await file.text();
        const skillDefinition = JSON.parse(content);

        // Import skill via API
        const response = await fetch('/api/v1/skills/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(skillDefinition),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || 'Failed to import skill');
        }

        setImportSuccess(`Successfully imported skill: ${data.data.skill.name}`);
        onImportSuccess?.();
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Invalid skill file');
      } finally {
        setImporting(false);
      }
    };

    input.click();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <CardTitle>Community Skills Marketplace</CardTitle>
              <CardDescription className="mt-2">
                The OS // SOLO skill marketplace is coming. Community-contributed skills will be browsable and installable here.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              In the meantime, you can import and export skills manually using JSON files.
            </p>

            <div className="flex gap-3">
              <Button
                onClick={handleImportClick}
                disabled={importing}
                variant="default"
              >
                <Upload className="mr-2 h-4 w-4" />
                {importing ? 'Importing...' : 'Import Skill'}
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  window.open('/api/v1/skills/marketplace', '_blank');
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                View API Docs
              </Button>
            </div>

            {importError && (
              <div className="flex items-start gap-2 p-3 border border-red-200 bg-red-50 rounded-md">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <p className="text-sm text-red-900">{importError}</p>
              </div>
            )}

            {importSuccess && (
              <div className="flex items-start gap-2 p-3 border border-green-200 bg-green-50 rounded-md">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <p className="text-sm text-green-900">{importSuccess}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How to Share Skills</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Go to the Skills Registry and click on a skill you want to share</li>
            <li>Click the "Export" button to download the skill as a JSON file</li>
            <li>Share the JSON file with others (via email, GitHub, etc.)</li>
            <li>Others can import it using the "Import Skill" button above</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Browse and search community-contributed skills</li>
            <li>One-click skill installation from remote registry</li>
            <li>Skill ratings and reviews from the community</li>
            <li>Automatic updates for installed marketplace skills</li>
            <li>Skill categories and tagging for easier discovery</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
