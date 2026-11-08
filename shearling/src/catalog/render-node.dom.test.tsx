// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createCatalog } from "./catalog.js";
import { defineComponent } from "./define-component.js";
import { type RenderIssue, RenderNode } from "./render-node.js";
import type { UiNode } from "./ui-node.js";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const yakBadge = defineComponent({
  name: "YakBadge",
  description: "A small badge naming a yak and its mood.",
  props: z.object({ label: z.string(), mood: z.enum(["calm", "grumpy"]) }),
  component: ({ label, mood }) => <span data-mood={mood}>{label}</span>,
});

const catalog = createCatalog([yakBadge]);

const sleepyYak: UiNode = { type: "YakBadge", props: { label: "Yak Shaver", mood: "sleepy" } };
const calmYak: UiNode = { type: "YakBadge", props: { label: "Yak Herder", mood: "calm" } };
const stampede: UiNode = { type: "YakStampede" };

function Herd({ node, reports }: { node: UiNode; reports: RenderIssue[][] }) {
  const [renders, setRenders] = useState(0);
  return (
    <div data-renders={renders}>
      <RenderNode
        catalog={catalog}
        node={node}
        onError={(issues) => {
          reports.push(issues);
          setRenders((count) => count + 1);
        }}
      />
    </div>
  );
}

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
});

describe("generative UI error reporting", () => {
  it("reports a bad tree once when the parent stores each report with an inline callback", () => {
    const reports: RenderIssue[][] = [];

    act(() => root.render(<Herd node={sleepyYak} reports={reports} />));

    expect(reports).toEqual([
      [
        {
          path: "$",
          type: "YakBadge",
          reason: "invalid_props",
          issues: [expect.objectContaining({ code: "invalid_value", path: ["mood"] })],
        },
      ],
    ]);
    expect(container.innerHTML).toBe('<div data-renders="1"></div>');
  });

  it("does not report again when the parent re-renders the same tree", () => {
    const reports: RenderIssue[][] = [];
    const render = (label: string) =>
      root.render(
        <div title={label}>
          <RenderNode catalog={catalog} node={stampede} onError={(issues) => reports.push(issues)} />
        </div>,
      );

    act(() => render("first"));
    act(() => render("second"));

    expect(reports).toEqual([[{ path: "$", type: "YakStampede", reason: "unknown_component", issues: [] }]]);
  });

  it("reports again when the model sends a new tree", () => {
    const reports: RenderIssue[][] = [];
    const render = (node: UiNode) =>
      root.render(<RenderNode catalog={catalog} node={node} onError={(issues) => reports.push(issues)} />);

    act(() => render(stampede));
    act(() => render(calmYak));
    act(() => render(sleepyYak));

    expect(reports).toEqual([
      [{ path: "$", type: "YakStampede", reason: "unknown_component", issues: [] }],
      [
        {
          path: "$",
          type: "YakBadge",
          reason: "invalid_props",
          issues: [expect.objectContaining({ code: "invalid_value", path: ["mood"] })],
        },
      ],
    ]);
    expect(container.innerHTML).toBe("");
  });
});
