import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const CLOSE_GRACE_MS = 180;

export interface FlyoutMenuController {
  openId: string | undefined;
  open: (id: string) => void;
  closeAfterGrace: () => void;
  cancelClose: () => void;
  closeNow: () => void;
}

export function useFlyoutMenu(): FlyoutMenuController {
  const [openId, setOpenId] = useState<string | undefined>(undefined);
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
      setOpenId(id);
    },
    [cancelClose],
  );

  const closeAfterGrace = useCallback((): void => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpenId(undefined), CLOSE_GRACE_MS);
  }, [cancelClose]);

  const closeNow = useCallback((): void => {
    cancelClose();
    setOpenId(undefined);
  }, [cancelClose]);

  return useMemo(
    () => ({ openId, open, closeAfterGrace, cancelClose, closeNow }),
    [openId, open, closeAfterGrace, cancelClose, closeNow],
  );
}
