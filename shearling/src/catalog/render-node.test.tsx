import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createCatalog } from "./catalog.js";
import { defineComponent } from "./define-component.js";
import { RenderNode, renderUiNode } from "./render-node.js";
import type { UiNode } from "./ui-node.js";

const yakBadge = defineComponent({
  name: "YakBadge",
  description: "A small badge naming a yak and its mood.",
  props: z.object({ label: z.string(), mood: z.enum(["calm", "grumpy"]) }),
  component: ({ label, mood }) => <span data-mood={mood}>{label}</span>,
});

const yakPen = defineComponent({
  name: "YakPen",
  description: "A titled pen that holds other components.",
  props: z.object({ title: z.string() }),
  component: ({ title, children }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
});

const catalog = createCatalog([yakBadge, yakPen]);

describe("generative UI rendering", () => {
  it("renders a pen of yak badges and text from an AI-produced tree", () => {
    const node: UiNode = {
      type: "YakPen",
      props: { title: "Morning herd" },
      children: [
        { type: "YakBadge", props: { label: "Yak Herder", mood: "calm" } },
        "and",
        { type: "YakBadge", props: { label: "Yak Shaver", mood: "grumpy" } },
      ],
    };

    expect(renderUiNode(catalog, node).issues).toEqual([]);
    expect(renderToStaticMarkup(<RenderNode catalog={catalog} node={node} />)).toBe(
      '<section><h2>Morning herd</h2><span data-mood="calm">Yak Herder</span>and<span data-mood="grumpy">Yak Shaver</span></section>',
    );
  });

  it("skips a component the catalog does not know and reports where it was", () => {
    const node: UiNode = {
      type: "YakPen",
      props: { title: "Morning herd" },
      children: [{ type: "YakStampede" }, { type: "YakBadge", props: { label: "Yak Herder", mood: "calm" } }],
    };

    const { element, issues } = renderUiNode(catalog, node);

    expect(issues).toEqual([{ path: "$.children[0]", type: "YakStampede", reason: "unknown_component", issues: [] }]);
    expect(renderToStaticMarkup(element)).toBe(
      '<section><h2>Morning herd</h2><span data-mood="calm">Yak Herder</span></section>',
    );
  });

  it("skips a component whose props fail validation and reports the issues", () => {
    const node: UiNode = {
      type: "YakPen",
      props: { title: "Morning herd" },
      children: [{ type: "YakBadge", props: { label: "Yak Shaver", mood: "sleepy" } }],
    };

    const { element, issues } = renderUiNode(catalog, node);

    expect(issues).toEqual([
      {
        path: "$.children[0]",
        type: "YakBadge",
        reason: "invalid_props",
        issues: [expect.objectContaining({ code: "invalid_value", path: ["mood"] })],
      },
    ]);
    expect(renderToStaticMarkup(element)).toBe("<section><h2>Morning herd</h2></section>");
  });

  it("describes every component with its props as JSON Schema for an AI to read", () => {
    expect(catalog.describe()).toEqual([
      {
        name: "YakBadge",
        description: "A small badge naming a yak and its mood.",
        props: {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "object",
          properties: { label: { type: "string" }, mood: { type: "string", enum: ["calm", "grumpy"] } },
          required: ["label", "mood"],
          additionalProperties: false,
        },
      },
      {
        name: "YakPen",
        description: "A titled pen that holds other components.",
        props: {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "object",
          properties: { title: { type: "string" } },
          required: ["title"],
          additionalProperties: false,
        },
      },
    ]);
  });

  it("refuses a catalog with two components under the same name", () => {
    expect(() => createCatalog([yakBadge, yakBadge])).toThrow("Duplicate component name: YakBadge");
  });
});
