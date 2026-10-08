import { useEffect, useRef } from 'react';
import { auth } from '../firebase';

/**
 * Hook to automatically sign out the user after a period of inactivity.
 * Default: 15 minutes.
 */
export const useInactivityTimeout = (timeoutMs: number = 15 * 60 * 1000) => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      await auth.signOut();
      window.location.href = '/login?reason=timeout';
    }, timeoutMs);
  };

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    const handleActivity = () => resetTimer();

    events.forEach(event => window.addEventListener(event, handleActivity));
    resetTimer(); // Start timer on mount

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timeoutMs]);

  return null;
};
