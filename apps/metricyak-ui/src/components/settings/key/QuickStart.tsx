import { CopyButton } from '@/components/settings/CopyButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface QuickStartProps {
  keyValue: string;
  ingestUrl: string;
}

function curlSnippet(ingestUrl: string, keyValue: string): string {
  return [
    `curl -X POST ${ingestUrl} \\`,
    `  -H "Authorization: Bearer ${keyValue}" \\`,
    '  -H "Content-Type: application/json" \\',
    `  -d '{"events":[{"name":"signup_completed"}]}'`,
  ].join('\n');
}

export function QuickStart({ keyValue, ingestUrl }: QuickStartProps): React.JSX.Element {
  const snippet = curlSnippet(ingestUrl, keyValue);

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="px-4 pb-0 pt-4 sm:px-5 sm:pt-5">
        <CardTitle className="text-sm font-semibold text-foreground">Send an event</CardTitle>
        <CardDescription>Paste this into a terminal to check the key works.</CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
        <div className="relative">
          <pre className="overflow-x-auto rounded-md border border-input bg-metricyak-50 px-3 py-2.5 pr-28 font-mono text-[12px] leading-relaxed text-foreground">
            {snippet}
          </pre>
          <CopyButton
            value={snippet}
            label="Copy the example request"
            className="absolute right-2 top-2 rounded-md border border-input bg-background px-2.5 py-1.5"
          >
            Copy
          </CopyButton>
        </div>
      </CardContent>
    </Card>
  );
}
