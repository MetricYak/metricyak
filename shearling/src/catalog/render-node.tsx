import { Fragment, type ReactNode, useEffect, useEffectEvent, useMemo } from "react";
import type { z } from "zod";
import type { Catalog } from "./catalog.js";
import type { UiNode } from "./ui-node.js";

export type RenderIssue = {
  path: string;
  type: string;
  reason: "unknown_component" | "invalid_props";
  issues: z.core.$ZodIssue[];
};

export type RenderedUi = {
  element: ReactNode;
  issues: RenderIssue[];
};

export function renderUiNode(catalog: Catalog, node: UiNode): RenderedUi {
  const issues: RenderIssue[] = [];
  const element = renderAt(catalog, node, "$", issues);
  return { element, issues };
}

function renderAt(catalog: Catalog, node: UiNode, path: string, issues: RenderIssue[]): ReactNode {
  const entry = catalog.get(node.type);
  if (!entry) {
    issues.push({ path, type: node.type, reason: "unknown_component", issues: [] });
    return null;
  }

  const children = node.children?.map((child, index) => {
    if (typeof child === "string") {
      return child;
    }
    const childPath = `${path}.children[${index}]`;
    return <Fragment key={childPath}>{renderAt(catalog, child, childPath, issues)}</Fragment>;
  });

  const result = entry.render(node.props ?? {}, children);
  if (!result.ok) {
    issues.push({ path, type: node.type, reason: "invalid_props", issues: result.issues });
    return null;
  }
  return result.element;
}

export type RenderNodeProps = {
  catalog: Catalog;
  node: UiNode;
  onError?: (issues: RenderIssue[]) => void;
};

export function RenderNode({ catalog, node, onError }: RenderNodeProps): ReactNode {
  const { element, issues } = useMemo(() => renderUiNode(catalog, node), [catalog, node]);

  const reportIssues = useEffectEvent((rendered: RenderIssue[]) => onError?.(rendered));

  useEffect(() => {
    if (issues.length > 0) {
      reportIssues(issues);
    }
  }, [issues]);

  return element;
}
