# Shearling

A soft, sturdy React design system that people and AI can build with. Made by [MetricYak](https://github.com/MetricYak/metricyak).

Every Shearling component is a normal React component and also an entry in a **catalog**. The catalog describes each component's props as JSON Schema, so a model can produce a UI tree as JSON. Shearling validates that tree and renders it with real components.

## Install

```sh
pnpm add @metricyak/shearling react react-dom tailwindcss
```

Shearling is compiled by your app's Tailwind CSS v4, so set up Tailwind for your build tool first (for example `@tailwindcss/vite`). Then import Tailwind followed by Shearling's stylesheet in your app's CSS:

```css
@import "tailwindcss";
@import "@metricyak/shearling/styles.css";
```

Shearling's stylesheet doesn't import Tailwind itself. It tells your Tailwind to scan Shearling's components for the classes they use.

## Generative UI

Register components in a catalog:

```tsx
import { createCatalog, defineComponent } from "@metricyak/shearling";
import { z } from "zod";

const yakBadge = defineComponent({
  name: "YakBadge",
  description: "A small badge naming a yak and its mood.",
  props: z.object({ label: z.string(), mood: z.enum(["calm", "grumpy"]) }),
  component: ({ label, mood }) => <span data-mood={mood}>{label}</span>,
});

const catalog = createCatalog([yakBadge]);
```

Pass the model `catalog.describe()`, which lists each component's name, description and props JSON Schema. Then render what it returns:

```tsx
import { RenderNode, uiNodeSchema } from "@metricyak/shearling";

const node = uiNodeSchema.parse(modelOutput);

<RenderNode catalog={catalog} node={node} onError={(issues) => console.warn(issues)} />;
```

Unknown components and invalid props are skipped rather than crashing the page. Each one is reported to `onError` with its path in the tree, so you can send the issues back to the model to fix.

`renderUiNode(catalog, node)` does the same without React state, and returns `{ element, issues }`.

## Developing

```sh
pnpm storybook      # Storybook on http://localhost:6006
pnpm --filter @metricyak/shearling test
pnpm --filter @metricyak/shearling build
```

## License

MIT
