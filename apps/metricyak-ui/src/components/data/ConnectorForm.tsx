import type { ConnectorField, ConnectorSchema } from '@/api/signal-sources';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type ConnectorFormValues = Record<string, string>;

function isListField(field: ConnectorField): boolean {
  return field.type === 'array';
}

export function initialValuesFor(schema: ConnectorSchema): ConnectorFormValues {
  const properties = schema.properties ?? {};
  return Object.fromEntries(Object.keys(properties).map((name) => [name, '']));
}

export function toConfig(
  schema: ConnectorSchema,
  values: ConnectorFormValues,
): Record<string, unknown> {
  const properties = schema.properties ?? {};
  const entries = Object.entries(properties).map(([name, field]) => {
    const raw = values[name] ?? '';
    if (isListField(field)) {
      return [
        name,
        raw
          .split(',')
          .map((part) => part.trim())
          .filter((part) => part.length > 0),
      ];
    }
    return [name, raw.trim()];
  });
  return Object.fromEntries(entries);
}

function labelFor(name: string, field: ConnectorField): string {
  return field.description?.split('.')[0] ?? name;
}

export function ConnectorForm({
  schema,
  values,
  errors,
  onChange,
}: {
  schema: ConnectorSchema;
  values: ConnectorFormValues;
  errors: Record<string, string>;
  onChange: (name: string, value: string) => void;
}): React.JSX.Element {
  const properties = Object.entries(schema.properties ?? {});
  const required = new Set(schema.required ?? []);

  return (
    <div className="flex flex-col gap-4">
      {properties.map(([name, field]) => {
        const fieldId = `connector-${name}`;
        const error = errors[name];
        return (
          <div key={name} className="flex flex-col gap-1.5">
            <Label htmlFor={fieldId}>
              {labelFor(name, field)}
              {required.has(name) ? null : (
                <span className="ml-1 font-normal text-muted-foreground text-xs">optional</span>
              )}
            </Label>
            <Input
              id={fieldId}
              value={values[name] ?? ''}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${fieldId}-error` : `${fieldId}-hint`}
              placeholder={isListField(field) ? 'production, staging' : undefined}
              onChange={(event) => onChange(name, event.target.value)}
            />
            {error ? (
              <p id={`${fieldId}-error`} className="text-destructive text-xs">
                {error}
              </p>
            ) : (
              <p id={`${fieldId}-hint`} className="text-muted-foreground text-xs">
                {isListField(field)
                  ? `${field.description ?? ''} Separate several with commas.`.trim()
                  : field.description}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
