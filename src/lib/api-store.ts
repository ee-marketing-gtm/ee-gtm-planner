const API_BASE = '/api/data';

export async function fetchLaunches(): Promise<{ value: string; updatedAt: number }> {
  const res = await fetch(`${API_BASE}/launches`);
  if (!res.ok) throw new Error('Failed to fetch launches');
  return res.json();
}

export async function saveLaunchesRemote(launches: unknown[]): Promise<{ updatedAt: number }> {
  const res = await fetch(`${API_BASE}/launches`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: launches }),
  });
  if (!res.ok) throw new Error('Failed to save launches');
  return res.json();
}

export async function fetchTemplates(): Promise<{ value: string; updatedAt: number }> {
  const res = await fetch(`${API_BASE}/templates`);
  if (!res.ok) throw new Error('Failed to fetch templates');
  return res.json();
}

export async function saveTemplatesRemote(templates: unknown): Promise<{ updatedAt: number }> {
  const res = await fetch(`${API_BASE}/templates`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: templates }),
  });
  if (!res.ok) throw new Error('Failed to save templates');
  return res.json();
}

export async function fetchCustomMoments(): Promise<{ value: string; updatedAt: number }> {
  const res = await fetch(`${API_BASE}/custom_moments`);
  if (!res.ok) throw new Error('Failed to fetch custom moments');
  return res.json();
}

export async function saveCustomMomentsRemote(moments: unknown[]): Promise<{ updatedAt: number }> {
  const res = await fetch(`${API_BASE}/custom_moments`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: moments }),
  });
  if (!res.ok) throw new Error('Failed to save custom moments');
  return res.json();
}

export async function fetchTimestamps(): Promise<Record<string, number>> {
  const res = await fetch(`${API_BASE}/timestamps`);
  if (!res.ok) throw new Error('Failed to fetch timestamps');
  return res.json();
}
