// src/hooks/usePendingSync.js
import { useEffect, useRef, useState } from 'react';
import { syncPendingWrites } from '../services/pendingSync';

export default function usePendingSync({ intervalMs = 60_000 } = {}) {
  const runningRef = useRef(false);
  const [status, setStatus] = useState({ uploaded: 0, remaining: 0, lastRun: null });

  useEffect(() => {
    async function runNow() {
      if (runningRef.current) return;
      if (!navigator.onLine) return;
      runningRef.current = true;
      try {
        setStatus(prev => ({ ...prev, lastRun: Date.now() }));
        const res = await syncPendingWrites({ onProgress: (p) => setStatus(prev => ({ ...prev, ...p })) });
        setStatus(prev => ({ ...prev, ...res, lastRun: Date.now() }));
      } catch (err) {
        console.error('sync error', err);
      } finally {
        runningRef.current = false;
      }
    }

    // run immediately if online
    if (navigator.onLine) runNow();

    // periodic run
    const iv = setInterval(() => {
      if (navigator.onLine) runNow();
    }, intervalMs);

    // run on browser online event
    const onOnline = () => runNow();
    window.addEventListener('online', onOnline);

    return () => {
      clearInterval(iv);
      window.removeEventListener('online', onOnline);
    };
  }, [intervalMs]);

  return status;
}
