'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { subscribe, unsubscribe, peekUndo, popUndo, type UndoEntry } from '@/lib/undo';
import { UndoToast } from './UndoToast';

const AUTO_DISMISS_MS = 5000;

export function UndoProvider() {
  const [current, setCurrent] = useState<UndoEntry | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    setCurrent(undefined);
  }, [clearTimer]);

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
  }, [clearTimer, dismiss]);

  useEffect(() => {
    const listener = () => {
      const top = peekUndo();
      if (top) {
        setCurrent(top);
        startTimer();
      }
    };
    subscribe(listener);
    return () => {
      unsubscribe(listener);
      clearTimer();
    };
  }, [startTimer, clearTimer]);

  const handleUndo = useCallback(() => {
    clearTimer();
    popUndo();
    setCurrent(undefined);
  }, [clearTimer]);

  if (!current) return null;

  return (
    <UndoToast
      label={current.label}
      onUndo={handleUndo}
      onDismiss={dismiss}
    />
  );
}
