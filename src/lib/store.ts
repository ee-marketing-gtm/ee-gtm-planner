'use client';

import { Launch } from './types';

const STORAGE_KEY = 'ee-gtm-launches';

export function getLaunches(): Launch[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveLaunches(launches: Launch[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(launches));
}

export function getLaunch(id: string): Launch | undefined {
  return getLaunches().find(l => l.id === id);
}

export function saveLaunch(launch: Launch) {
  const launches = getLaunches();
  const idx = launches.findIndex(l => l.id === launch.id);
  if (idx >= 0) {
    launches[idx] = { ...launch, updatedAt: new Date().toISOString() };
  } else {
    launches.push(launch);
  }
  saveLaunches(launches);
}

export function deleteLaunch(id: string) {
  saveLaunches(getLaunches().filter(l => l.id !== id));
}
