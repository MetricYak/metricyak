import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
      // Clipboard blocked (e.g. insecure context) — nothing sensible to do.
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={copied ? `${label} — copied` : label}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md text-muted-foreground transition-colors hover:text-foreground',
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
