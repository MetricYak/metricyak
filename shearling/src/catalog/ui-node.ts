import { z } from "zod";

export type UiNode = {
  type: string;
  props?: Record<string, unknown> | undefined;
  children?: UiChild[] | undefined;
};

export type UiChild = UiNode | string;

export const uiNodeSchema: z.ZodType<UiNode> = z.object({
  type: z.string().min(1),
  props: z.record(z.string(), z.unknown()).optional(),
  get children() {
    return z.array(z.union([z.string(), uiNodeSchema])).optional();
  },
});
