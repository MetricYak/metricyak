import { motion, useReducedMotion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

function FlatlineSvg({ reduced }: { reduced: boolean }): React.JSX.Element {
  return (
    <svg viewBox="0 0 200 44" className="w-44 text-metricyak-400" aria-hidden="true">
      <motion.path
        d="M0,22 L55,22 L65,5 L73,39 L80,11 L86,28 L91,22 L200,22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduced ? { opacity: 1 } : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={
          reduced
            ? { duration: 0 }
            : {
                pathLength: { duration: 1.5, ease: 'easeInOut', delay: 0.05 },
                opacity: { duration: 0.15 },
              }
        }
      />
    </svg>
  );
}

export function NotFoundPage(): React.JSX.Element {
  const navigate = useNavigate();
  const reduced = useReducedMotion() ?? false;

  const fadeUp = (delay: number) =>
    ({
      initial: { opacity: 0, y: reduced ? 0 : 10 },
      animate: { opacity: 1, y: 0 },
      transition: {
        duration: reduced ? 0 : 0.35,
        delay: reduced ? 0 : delay,
        ease: 'easeOut',
      },
    }) as const;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-7 p-8 text-center">
      <FlatlineSvg reduced={reduced} />

      <div className="flex flex-col items-center gap-3">
        <motion.p
          {...fadeUp(0.14)}
          className="text-5xl font-bold tracking-tight text-metricyak-500"
        >
          404
        </motion.p>

        <motion.h1
          {...fadeUp(0.24)}
          className="text-xl font-semibold text-foreground"
          style={{ textWrap: 'balance' } as React.CSSProperties}
        >
          Signal lost.
        </motion.h1>

        <motion.p
          {...fadeUp(0.32)}
          className="max-w-xs text-sm text-muted-foreground"
          style={{ textWrap: 'pretty' } as React.CSSProperties}
        >
          This URL isn't in the stream. Double-check the address or head back to the dashboard.
        </motion.p>
      </div>

      <motion.div {...fadeUp(0.4)}>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="raised cursor-pointer rounded-md bg-button-orange px-5 py-2.5 text-sm font-medium text-metricyak-25"
        >
          Back to Dashboard
        </button>
      </motion.div>
    </div>
  );
}
