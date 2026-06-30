import type { ReactNode } from 'react';
import { type UseResizableOptions, useResizable } from '@/hooks/useResizable';
import { cn } from '@/lib/utils';
import { ResizeHandle } from './ResizeHandle';

export interface ResizableRenderState {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  width: number;
}

interface ResizableProps extends UseResizableOptions {
  className?: string;
  handleClassName?: string;
  hideHandle?: boolean;
  children: ReactNode | ((state: ResizableRenderState) => ReactNode);
}

export function Resizable({
  className,
  handleClassName,
  hideHandle = false,
  children,
  ...options
}: ResizableProps): React.JSX.Element {
  const { panelRef, handleProps, renderWidth, width, collapsed, setCollapsed } =
    useResizable(options);
  const side = options.side ?? 'right';

  const content =
    typeof children === 'function' ? children({ collapsed, setCollapsed, width }) : children;

  return (
    <div
      ref={panelRef}
      data-collapsed={collapsed}
      style={{ width: renderWidth }}
      className={cn('group/panel relative h-full shrink-0', className)}
    >
      <div className="h-full w-full overflow-hidden">{content}</div>
      {!hideHandle && <ResizeHandle side={side} className={handleClassName} {...handleProps} />}
    </div>
  );
}
