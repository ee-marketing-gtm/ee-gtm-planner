'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Launch } from '@/lib/types';
import { fetchLaunches, saveLaunchesRemote, fetchTimestamps } from '@/lib/api-store';

const POLL_INTERVAL = 20_000; // 20 seconds

interface DataContextValue {
  launches: Launch[];
  loading: boolean;
  saveLaunches: (launches: Launch[]) => void;
  saveLaunch: (launch: Launch) => void;
  deleteLaunch: (id: string) => void;
  refreshLaunches: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [launches, setLaunchesState] = useState<Launch[]>([]);
  const [loading, setLoading] = useState(true);
  const lastTimestamp = useRef(0);
  const saveInFlight = useRef(false);

  // Load from API on mount
  const loadLaunches = useCallback(async () => {
    try {
      const result = await fetchLaunches();
      const parsed: Launch[] = JSON.parse(result.value);
      setLaunchesState(parsed);
      lastTimestamp.current = result.updatedAt;
    } catch {
      // If API fails (e.g. no DB configured), fall back to localStorage
      if (typeof window !== 'undefined') {
        const data = localStorage.getItem('ee-gtm-launches');
        if (data) setLaunchesState(JSON.parse(data));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLaunches();
  }, [loadLaunches]);

  // Poll for changes from other users
  useEffect(() => {
    const interval = setInterval(async () => {
      if (saveInFlight.current) return;
      try {
        const timestamps = await fetchTimestamps();
        const remote = timestamps.launches || 0;
        if (remote > lastTimestamp.current) {
          const result = await fetchLaunches();
          const parsed: Launch[] = JSON.parse(result.value);
          setLaunchesState(parsed);
          lastTimestamp.current = result.updatedAt;
        }
      } catch {
        // Polling failure is non-critical, just skip
      }
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Save launches to API + localStorage backup
  const saveLaunches = useCallback((newLaunches: Launch[]) => {
    setLaunchesState(newLaunches);
    // localStorage as immediate cache
    if (typeof window !== 'undefined') {
      localStorage.setItem('ee-gtm-launches', JSON.stringify(newLaunches));
    }
    // Fire-and-forget API save
    saveInFlight.current = true;
    saveLaunchesRemote(newLaunches)
      .then(({ updatedAt }) => {
        lastTimestamp.current = updatedAt;
      })
      .catch(() => {
        // API save failed — localStorage has the data, it'll sync next time
      })
      .finally(() => {
        saveInFlight.current = false;
      });
  }, []);

  const saveLaunch = useCallback((launch: Launch) => {
    setLaunchesState(prev => {
      const idx = prev.findIndex(l => l.id === launch.id);
      let next: Launch[];
      if (idx >= 0) {
        next = [...prev];
        next[idx] = { ...launch, updatedAt: new Date().toISOString() };
      } else {
        next = [...prev, launch];
      }
      // Save in the same tick
      if (typeof window !== 'undefined') {
        localStorage.setItem('ee-gtm-launches', JSON.stringify(next));
      }
      saveInFlight.current = true;
      saveLaunchesRemote(next)
        .then(({ updatedAt }) => { lastTimestamp.current = updatedAt; })
        .catch(() => {})
        .finally(() => { saveInFlight.current = false; });
      return next;
    });
  }, []);

  const deleteLaunch = useCallback((id: string) => {
    setLaunchesState(prev => {
      const next = prev.filter(l => l.id !== id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('ee-gtm-launches', JSON.stringify(next));
      }
      saveInFlight.current = true;
      saveLaunchesRemote(next)
        .then(({ updatedAt }) => { lastTimestamp.current = updatedAt; })
        .catch(() => {})
        .finally(() => { saveInFlight.current = false; });
      return next;
    });
  }, []);

  return (
    <DataContext.Provider value={{
      launches,
      loading,
      saveLaunches,
      saveLaunch,
      deleteLaunch,
      refreshLaunches: loadLaunches,
    }}>
      {children}
    </DataContext.Provider>
  );
}
