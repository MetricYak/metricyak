interface PlaceholderPageProps {
  title: string;
}

export function PlaceholderPage({ title }: PlaceholderPageProps): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="font-semibold text-2xl">{title}</h1>
      <p className="text-muted-foreground text-sm">This page is not built yet.</p>
    </div>
  );
}
