import type React from 'react';
import { Launch, GTMTask, PHASES, PhaseKey, TIER_CONFIG } from './types';
import { differenceInBusinessDays, parseISO, isAfter, isBefore, isToday, addDays } from 'date-fns';

/** Get the display color for a launch: custom brandColor if set, otherwise tier color. */
export function getLaunchColor(launch: Launch): string {
  return launch.brandColor || TIER_CONFIG[launch.tier].color;
}

/** Compute relative luminance of a hex color (0 = black, 1 = white). */
export function getColorLuminance(hex: string): number {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return 0.5;
  const r = parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = parseInt(cleaned.slice(4, 6), 16) / 255;
  const toLin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

/** True if the given color is light enough that dark text / halo is needed for contrast. */
export function isLightColor(hex: string): boolean {
  return getColorLuminance(hex) > 0.6;
}

/**
 * Style helper for text drawn in a launch/brand color. When the color is
 * light enough that it would wash out on a white background, render it as
 * a highlighter-style background chip behind dark navy text instead so it
 * stays readable. Otherwise, just return the color as-is.
 *
 * Use mode='highlight' (default) for inline text like titles and labels
 * where you want the marker/highlighter effect. Use mode='soft' for UI
 * elements (tabs, badges) where you don't want to steal the background
 * slot — it falls back to a dark-halo text-shadow for light colors.
 */
export function getReadableTextStyle(
  hex: string,
  mode: 'highlight' | 'soft' = 'highlight',
): React.CSSProperties {
  if (!isLightColor(hex)) return { color: hex };

  if (mode === 'soft') {
    return {
      color: hex,
      textShadow:
        '0 0 1px rgba(27, 20, 100, 0.9), 0 0 2px rgba(27, 20, 100, 0.6), 0 1px 2px rgba(27, 20, 100, 0.35)',
    };
  }

  return {
    color: '#1B1464',
    background: hex,
    padding: '0 0.3em',
    borderRadius: '3px',
    // So wrapped inline text keeps the highlight chip on each line segment
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
  };
}

/**
 * Style helper for a launch-name chip/pill. Normally we tint with
 * `hex + '15'` background + `hex` text, but that is unreadable when the
 * launch color is very light (e.g. pale yellow). In that case flip the
 * chip to use the full color as the background with dark navy text.
 */
export function getLaunchChipStyle(hex: string): React.CSSProperties {
  if (isLightColor(hex)) {
    return { background: hex, color: '#1B1464' };
  }
  return { background: hex + '15', color: hex };
}

/**
 * Dot indicator style for a launch. Light colors get a dark outline so the
 * dot stays visible on white backgrounds.
 */
export function getLaunchDotStyle(hex: string): React.CSSProperties {
  if (isLightColor(hex)) {
    return { background: hex, boxShadow: 'inset 0 0 0 1px #1B1464' };
  }
  return { background: hex };
}

/**
 * When a template lives in Google Docs / Sheets / Slides, we can transform
 * the URL to trigger the "Make a copy" dialog (so the user ends up with an
 * untitled copy they can rename and save to the right launch folder). For
 * any other provider (SharePoint, Notion, Dropbox, Canva, etc.) we just
 * return the URL as-is and let the user do File > Make a Copy manually.
 */
export function getTemplateCopyUrl(url: string): string {
  if (!url) return url;
  // Match https://docs.google.com/{document|spreadsheets|presentation|forms}/d/{id}/...
  const match = url.match(
    /^(https:\/\/docs\.google\.com\/(?:document|spreadsheets|presentation|forms)\/d\/[^/]+)\//,
  );
  if (match) return `${match[1]}/copy`;
  return url;
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
