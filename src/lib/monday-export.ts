import { Launch, GTMTask, PHASES, OWNER_LABELS, TaskStatus } from './types';

const MONDAY_COLUMNS = [
  'Group',
  'Name',
  'Subitems',
  'PM',
  'Timeline - Start',
  'Timeline - End',
  'Status',
  'Dependent On',
  'R',
  'A',
  'Responsible Team',
  'C',
  'I',
  'Duration',
  'Notes',
  'Deliverable',
] as const;

type Row = Record<(typeof MONDAY_COLUMNS)[number], string>;

const STATUS_MAP: Record<TaskStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'Working on it',
  waiting_review: 'Working on it',
  complete: 'Done',
  skipped: 'Done',
  blocked: 'Stuck',
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function formatDuration(days: number): string {
  if (!days || days <= 0) return '';
  if (days === 1) return '1 day';
  if (days % 5 === 0) {
    const weeks = days / 5;
    return weeks === 1 ? '1 week' : `${weeks} weeks`;
  }
  return `${days} days`;
}

function escapeCSV(value: string): string {
  if (value === '' || value == null) return '';
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function emptyRow(): Row {
  return MONDAY_COLUMNS.reduce((acc, col) => {
    acc[col] = '';
    return acc;
  }, {} as Row);
}

function dependencyNames(task: GTMTask, byId: Map<string, GTMTask>): string {
  if (!task.dependencies || task.dependencies.length === 0) return '';
  return task.dependencies
    .map(depId => byId.get(depId)?.name ?? '')
    .filter(Boolean)
    .join(', ');
}

export function buildMondayCSV(launch: Launch): string {
  const byId = new Map(launch.tasks.map(t => [t.id, t]));
  const rows: Row[] = [];

  // ── KEY DATES & DEADLINES section ───────────────────────────────────
  const keyDates: Array<{ name: string; date: string }> = [];
  if (launch.launchDate) keyDates.push({ name: 'DTC Launch Date', date: launch.launchDate });
  if (launch.sephoraLaunchDate) keyDates.push({ name: 'Sephora Launch Date', date: launch.sephoraLaunchDate });
  if (launch.amazonLaunchDate) keyDates.push({ name: 'Amazon Launch Date', date: launch.amazonLaunchDate });
  for (const anchor of launch.externalAnchors ?? []) {
    keyDates.push({
      name: anchor.partnerName ? `${anchor.taskName} (${anchor.partnerName})` : anchor.taskName,
      date: anchor.date,
    });
  }

  for (const kd of keyDates) {
    const row = emptyRow();
    row.Group = 'KEY DATES & DEADLINES';
    row.Name = kd.name;
    row['Timeline - Start'] = formatDate(kd.date);
    row['Timeline - End'] = formatDate(kd.date);
    row.Status = 'Not Started';
    rows.push(row);
  }

  // ── One group per phase, in PHASES order ────────────────────────────
  const tasksByPhase = new Map<string, GTMTask[]>();
  for (const task of launch.tasks) {
    const list = tasksByPhase.get(task.phase) ?? [];
    list.push(task);
    tasksByPhase.set(task.phase, list);
  }

  for (const phase of PHASES) {
    const tasks = tasksByPhase.get(phase.key);
    if (!tasks || tasks.length === 0) continue;
    tasks.sort((a, b) => a.sortOrder - b.sortOrder);

    for (const task of tasks) {
      const row = emptyRow();
      row.Group = phase.name;
      row.Name = task.name;
      row['Timeline - Start'] = formatDate(task.startDate);
      row['Timeline - End'] = formatDate(task.dueDate);
      row.Status = STATUS_MAP[task.status] ?? 'Not Started';
      row['Dependent On'] = dependencyNames(task, byId);
      row['Responsible Team'] = OWNER_LABELS[task.owner] ?? '';
      row.Duration = formatDuration(task.durationDays);
      row.Notes = task.notes ?? '';
      row.Deliverable = task.deliverableUrl ?? '';
      rows.push(row);
    }
  }

  const lines = [
    MONDAY_COLUMNS.map(escapeCSV).join(','),
    ...rows.map(r => MONDAY_COLUMNS.map(c => escapeCSV(r[c])).join(',')),
  ];
  return lines.join('\r\n');
}

export function mondayFilename(launch: Launch): string {
  const safe = launch.name
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 60) || 'launch';
  const datePart = (launch.launchDate || '').slice(0, 10);
  return datePart ? `${safe}_GTM_${datePart}_monday.csv` : `${safe}_GTM_monday.csv`;
}

export function downloadMondayCSV(launch: Launch): void {
  const csv = buildMondayCSV(launch);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = mondayFilename(launch);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
