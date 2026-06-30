interface SettingsSectionPlaceholderProps {
  title: string;
  description: string;
}

export function SettingsSectionPlaceholder({
  title,
  description,
}: SettingsSectionPlaceholderProps): React.JSX.Element {
  return (
    <div className="max-w-2xl px-8 py-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="rounded-md border border-border bg-metricyak-50 px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">This section is coming soon.</p>
      </div>
    </div>
  );
}
