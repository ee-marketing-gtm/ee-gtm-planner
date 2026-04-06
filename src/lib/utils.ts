import { Launch, GTMTask, PHASES, PhaseKey, TIER_CONFIG } from './types';
import { differenceInBusinessDays, parseISO, isAfter, isBefore, isToday, addDays } from 'date-fns';

/** Get the display color for a launch: custom brandColor if set, otherwise tier color. */
export function getLaunchColor(launch: Launch): string {
  return launch.brandColor || TIER_CONFIG[launch.tier].color;
}

export function getNextTask(launch: Launch): GTMTask | null {
  return launch.tasks
    .filter(t => t.status !== 'complete' && t.status !== 'skipped')
    .sort((a, b) => a.sortOrder - b.sortOrder)[0] || null;
}

export function getOverdueTasks(launch: Launch): GTMTask[] {
  const today = new Date();
  return launch.tasks.filter(t => {
    if (t.status === 'complete' || t.status === 'skipped' || !t.dueDate) return false;
    return isBefore(parseISO(t.dueDate), today) && !isToday(parseISO(t.dueDate));
  });
}

export function getUpcomingTasks(launch: Launch, withinDays: number = 7): GTMTask[] {
  const today = new Date();
  const cutoff = addDays(today, withinDays);
  return launch.tasks.filter(t => {
    if (t.status === 'complete' || t.status === 'skipped' || !t.dueDate) return false;
    const due = parseISO(t.dueDate);
    return (isAfter(due, today) || isToday(due)) && isBefore(due, cutoff);
  });
}

export function getLaunchProgress(launch: Launch): number {
  if (launch.tasks.length === 0) return 0;
  const completed = launch.tasks.filter(t => t.status === 'complete' || t.status === 'skipped').length;
  return Math.round((completed / launch.tasks.length) * 100);
}

export function getCurrentPhase(launch: Launch): PhaseKey | null {
  const nextTask = getNextTask(launch);
  return nextTask?.phase || null;
}

export function getPhaseProgress(launch: Launch, phase: PhaseKey): number {
  const phaseTasks = launch.tasks.filter(t => t.phase === phase);
  if (phaseTasks.length === 0) return 0;
  const completed = phaseTasks.filter(t => t.status === 'complete' || t.status === 'skipped').length;
  return Math.round((completed / phaseTasks.length) * 100);
}

export function getDaysUntilLaunch(launch: Launch): number {
  return differenceInBusinessDays(parseISO(launch.launchDate), new Date());
}

export function getPhaseColor(phase: PhaseKey): string {
  return PHASES.find(p => p.key === phase)?.color || '#6B7280';
}

export function getPhaseName(phase: PhaseKey): string {
  return PHASES.find(p => p.key === phase)?.name || phase;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'complete': return '#10B981';
    case 'in_progress': return '#3B82F6';
    case 'blocked': return '#EF4444';
    case 'waiting_review': return '#F59E0B';
    case 'skipped': return '#9CA3AF';
    default: return '#6B7280';
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'not_started': return 'Not Started';
    case 'in_progress': return 'In Progress';
    case 'complete': return 'Completed';
    case 'blocked': return 'Stuck';
    case 'waiting_review': return 'Waiting for Review';
    case 'skipped': return 'Skipped';
    case 'planning': return 'Planning';
    case 'launched': return 'Launched';
    case 'post_launch': return 'Post-Launch';
    default: return status;
  }
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
