import type { ResizeHandleProps as HandleProps, ResizeSide } from '@/hooks/useResizable';
import { cn } from '@/lib/utils';

interface ResizeHandleProps extends HandleProps {
  side: ResizeSide;
  className?: string;
}

export function ResizeHandle({
  side,
  className,
  ...handleProps
}: ResizeHandleProps): React.JSX.Element {
  return (
    <div
      {...handleProps}
      className={cn(
        'group/handle absolute top-0 z-20 h-full w-2 cursor-col-resize touch-none select-none',
        side === 'right' ? 'right-0 translate-x-1/2' : 'left-0 -translate-x-1/2',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-sidebar-border transition-[transform,background-color] group-hover/handle:scale-x-[3] group-hover/handle:bg-ring group-data-[resizing=true]/panel:scale-x-[3] group-data-[resizing=true]/panel:bg-ring" />
    </div>
  );
}
