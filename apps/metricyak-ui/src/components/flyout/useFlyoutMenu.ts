import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const CLOSE_GRACE_MS = 180;

export interface FlyoutMenuController {
  pinnedId: string | undefined;
  overlayId: string | undefined;
  open: (id: string) => void;
  closeAfterGrace: () => void;
  cancelClose: () => void;
  closeNow: () => void;
  togglePin: (id: string) => void;
}

export function useFlyoutMenu(): FlyoutMenuController {
  const [hoveredId, setHoveredId] = useState<string | undefined>(undefined);
  const [pinnedId, setPinnedId] = useState<string | undefined>(undefined);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const cancelClose = useCallback((): void => {
    if (closeTimer.current !== undefined) {
      clearTimeout(closeTimer.current);
      closeTimer.current = undefined;
    }
  }, []);

  useEffect(() => cancelClose, [cancelClose]);

  const open = useCallback(
    (id: string): void => {
      cancelClose();
      setHoveredId(id);
    },
    [cancelClose],
  );

  const closeAfterGrace = useCallback((): void => {
    cancelClose();
    closeTimer.current = setTimeout(() => setHoveredId(undefined), CLOSE_GRACE_MS);
  }, [cancelClose]);

  const closeNow = useCallback((): void => {
    cancelClose();
    setHoveredId(undefined);
  }, [cancelClose]);

  const togglePin = useCallback(
    (id: string): void => {
      cancelClose();
      setPinnedId((current) => (current === id ? undefined : id));
      setHoveredId(undefined);
    },
    [cancelClose],
  );

  const overlayId = hoveredId === pinnedId ? undefined : hoveredId;

  return useMemo(
    () => ({ pinnedId, overlayId, open, closeAfterGrace, cancelClose, closeNow, togglePin }),
    [pinnedId, overlayId, open, closeAfterGrace, cancelClose, closeNow, togglePin],
  );
}
