import { createCatalog } from "./catalog/catalog.js";

export { type Catalog, type ComponentDescription, createCatalog } from "./catalog/catalog.js";
export {
  type CatalogEntry,
  type ComponentDefinition,
  defineComponent,
  type RenderResult,
} from "./catalog/define-component.js";
export {
  type RenderedUi,
  type RenderIssue,
  RenderNode,
  type RenderNodeProps,
  renderUiNode,
} from "./catalog/render-node.js";
export { type UiChild, type UiNode, uiNodeSchema } from "./catalog/ui-node.js";

export const shearlingCatalog = createCatalog([]);
