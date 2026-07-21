const SEPARATORS = /[._\-/\s]+/;

export function suggestShortName(eventType: string): string {
  const trimmed = eventType.trim();
  if (!trimmed) return '';
  const [firstSegment] = trimmed.split(SEPARATORS);
  return (firstSegment ?? trimmed).toLowerCase();
}
