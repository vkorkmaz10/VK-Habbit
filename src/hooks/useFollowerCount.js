// useFollowerCount — polls /api/x-followers and exposes count + status.
// Polling is conservative (default 30s) because the edge cache TTL is 15s
// and X follower counts are slow-moving. Caller can override.
import { useEffect, useRef, useState } from 'react';

const ENDPOINT = '/api/x-followers';

export function useFollowerCount({ user = 'vkorkmaz10', intervalMs = 30000 } = {}) {
  const [count, setCount] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const aliveRef = useRef(true);
  const timerRef = useRef(null);

  async function fetchOnce() {
    try {
      const r = await fetch(`${ENDPOINT}?user=${encodeURIComponent(user)}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`http ${r.status}`);
      const data = await r.json();
      if (typeof data.followerCount !== 'number') throw new Error('bad shape');
      if (!aliveRef.current) return;
      setCount(data.followerCount);
      setError(null);
      setUpdatedAt(Date.now());
    } catch (e) {
      if (!aliveRef.current) return;
      setError(e.message || 'error');
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    aliveRef.current = true;
    fetchOnce();
    timerRef.current = setInterval(fetchOnce, Math.max(3000, intervalMs));

    // Tab gizliyken polling durdur, geri dönünce hemen çek
    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(timerRef.current);
      } else {
        fetchOnce();
        timerRef.current = setInterval(fetchOnce, Math.max(3000, intervalMs));
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      aliveRef.current = false;
      clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, intervalMs]);

  return { count, error, loading, updatedAt, refresh: fetchOnce };
}
