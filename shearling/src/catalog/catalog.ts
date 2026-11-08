import { z } from "zod";
import type { CatalogEntry } from "./define-component.js";

export type ComponentDescription = {
  name: string;
  description: string;
  props: z.core.JSONSchema.JSONSchema;
};

export type Catalog = {
  entries: readonly CatalogEntry[];
  get(name: string): CatalogEntry | undefined;
  describe(): ComponentDescription[];
};

export function createCatalog(entries: readonly CatalogEntry[]): Catalog {
  const byName = new Map<string, CatalogEntry>();
  for (const entry of entries) {
    if (byName.has(entry.name)) {
      throw new Error(`Duplicate component name: ${entry.name}`);
    }
    byName.set(entry.name, entry);
  }

  return {
    entries,
    get: (name) => byName.get(name),
    describe: () =>
      entries.map(({ name, description, props }) => ({ name, description, props: z.toJSONSchema(props) })),
  };
}
