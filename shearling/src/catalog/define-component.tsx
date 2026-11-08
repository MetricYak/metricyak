import type { ComponentType, ReactElement, ReactNode } from "react";
import type { z } from "zod";

export type RenderResult = { ok: true; element: ReactElement } | { ok: false; issues: z.core.$ZodIssue[] };

export type CatalogEntry = {
  name: string;
  description: string;
  props: z.ZodObject;
  render(props: unknown, children: ReactNode): RenderResult;
};

export type ComponentDefinition<Schema extends z.ZodObject> = {
  name: string;
  description: string;
  props: Schema;
  component: ComponentType<z.output<Schema> & { children?: ReactNode }>;
};

export function defineComponent<Schema extends z.ZodObject>({
  name,
  description,
  props,
  component: Component,
}: ComponentDefinition<Schema>): CatalogEntry {
  return {
    name,
    description,
    props,
    render(input, children) {
      const result = props.safeParse(input);
      if (!result.success) {
        return { ok: false, issues: result.error.issues };
      }
      return { ok: true, element: <Component {...result.data}>{children}</Component> };
    },
  };
}
