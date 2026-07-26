import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
  value: string;
  label: string;
  className?: string;
  children?: React.ReactNode;
}

export function CopyButton({
  value,
  label,
  className,
  children,
}: CopyButtonProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error('Could not copy', { description: 'Select the text and copy it manually.' });
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={copied ? `${label} — copied` : label}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className,
      )}
    >
      {copied ? (
        <Check className="size-3.5 shrink-0 text-metricyak-brand-orange" />
      ) : (
        <Copy className="size-3.5 shrink-0" />
      )}
      {children != null && (
        <span className={cn('text-sm', copied && 'text-foreground')}>
          {copied ? 'Copied' : children}
        </span>
      )}
    </button>
  );
}
