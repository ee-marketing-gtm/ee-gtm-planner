'use client';

import { useMemo, useState } from 'react';
import { parseISO, differenceInCalendarDays, addDays, format, startOfWeek, isWeekend, isToday } from 'date-fns';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { GTMTask, PHASES, PhaseKey, OWNER_LABELS } from '@/lib/types';

// ── Shared Gantt utilities (used by both single + multi-launch views) ──

export interface GanttDateRange {
  start: Date;
  end: Date;
  totalDays: number;
}

export function computeDateRange(
  tasks: GTMTask[],
  launchDate: string,
  extraLaunchDates?: string[],
  paddingDays = 7
): GanttDateRange {
  let earliest = parseISO(launchDate);
  let latest = parseISO(launchDate);

  for (const t of tasks) {
    const s = t.startDate ? parseISO(t.startDate) : t.dueDate ? addDays(parseISO(t.dueDate), -t.durationDays) : null;
    const d = t.dueDate ? parseISO(t.dueDate) : null;
    if (s && s < earliest) earliest = s;
    if (d && d > latest) latest = d;
  }

  if (extraLaunchDates) {
    for (const ld of extraLaunchDates) {
      const d = parseISO(ld);
      if (d > latest) latest = d;
      if (d < earliest) earliest = d;
    }
  }

  // Snap to start of week for clean headers
  const start = addDays(startOfWeek(earliest, { weekStartsOn: 1 }), -paddingDays);
  const end = addDays(latest, paddingDays);
  const totalDays = differenceInCalendarDays(end, start) + 1;

  return { start, end, totalDays };
}

export function dayIndex(date: Date, rangeStart: Date): number {
  return differenceInCalendarDays(date, rangeStart);
}

// ── Phase colors ──

const PHASE_COLORS: Record<string, string> = {
  content_planning: '#3D4EDB',
  cross_functional: '#9333ea',
  finalize_strategies: '#22c55e',
  content_production: '#f97316',
  design_briefs: '#e85d04',
  design_production: '#EC4899',
};

const PHASE_BG: Record<string, string> = {
  content_planning: '#EEF2FF',
  cross_functional: '#FAF5FF',
  finalize_strategies: '#F0FDF4',
  content_production: '#FFF7ED',
  design_briefs: '#FFF7ED',
  design_production: '#FDF2F8',
};

// ── Month/Week header renderer ──

function GanttHeader({ range }: { range: GanttDateRange }) {
  const months: { label: string; startCol: number; span: number }[] = [];
  const weeks: { startCol: number; span: number; label: string }[] = [];

  let currentMonth = '';
  let monthStart = 0;
  let weekStart = 0;
  let weekLabel = '';

  for (let i = 0; i < range.totalDays; i++) {
    const d = addDays(range.start, i);
    const m = format(d, 'MMM yyyy');
    if (m !== currentMonth) {
      if (currentMonth) months.push({ label: currentMonth, startCol: monthStart + 1, span: i - monthStart });
      currentMonth = m;
      monthStart = i;
    }
    // Week boundaries
    if (d.getDay() === 1 || i === 0) {
      if (weekLabel) weeks.push({ startCol: weekStart + 1, span: i - weekStart, label: weekLabel });
      weekStart = i;
      weekLabel = format(d, 'MMM d');
    }
  }
  // Push final month/week
  if (currentMonth) months.push({ label: currentMonth, startCol: monthStart + 1, span: range.totalDays - monthStart });
  if (weekLabel) weeks.push({ startCol: weekStart + 1, span: range.totalDays - weekStart, label: weekLabel });

  return (
    <div className="sticky top-0 z-20 bg-white border-b border-[#E7E5E4]">
      {/* Month row */}
      <div className="grid" style={{ gridTemplateColumns: `repeat(${range.totalDays}, minmax(18px, 1fr))` }}>
        {months.map((m, i) => (
          <div
            key={i}
            className="text-[11px] font-semibold text-[#1B1464] px-2 py-1.5 border-l border-[#E7E5E4] first:border-l-0 truncate"
            style={{ gridColumn: `${m.startCol} / span ${m.span}` }}
          >
            {m.label}
          </div>
        ))}
      </div>
      {/* Week row */}
      <div className="grid" style={{ gridTemplateColumns: `repeat(${range.totalDays}, minmax(18px, 1fr))` }}>
        {weeks.map((w, i) => (
          <div
            key={i}
            className="text-[10px] text-[#A8A29E] px-2 py-1 border-l border-[#F5F5F4] first:border-l-0 truncate"
            style={{ gridColumn: `${w.startCol} / span ${w.span}` }}
          >
            {w.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Single task bar ──

function TaskBar({ task, range, phaseColor }: { task: GTMTask; range: GanttDateRange; phaseColor: string }) {
  const startDate = task.startDate
    ? parseISO(task.startDate)
    : task.dueDate
      ? addDays(parseISO(task.dueDate), -Math.max(task.durationDays, 1))
      : null;
  const endDate = task.dueDate ? parseISO(task.dueDate) : null;

  if (!startDate || !endDate) return <div className="h-7" />;

  const col1 = Math.max(1, dayIndex(startDate, range.start) + 1);
  const col2 = Math.max(col1 + 1, dayIndex(endDate, range.start) + 2);
  const isComplete = task.status === 'complete';

  return (
    <div
      className="grid items-center h-7"
      style={{ gridTemplateColumns: `repeat(${range.totalDays}, minmax(18px, 1fr))` }}
    >
      <div
        className={`h-5 rounded-md relative group cursor-default ${isComplete ? 'opacity-40' : ''} ${task.isCompressed ? 'ring-1 ring-amber-400' : ''}`}
        style={{
          gridColumn: `${col1} / ${col2}`,
          background: phaseColor,
        }}
        title={`${task.name}\n${format(startDate, 'MMM d')} → ${format(endDate, 'MMM d')} (${task.durationDays}BD)\nOwner: ${OWNER_LABELS[task.owner] || task.owner}`}
      >
        {/* Bar label (only if wide enough) */}
        <span className="absolute inset-0 flex items-center px-1.5 text-[9px] font-medium text-white truncate pointer-events-none">
          {task.isMeeting ? '📅 ' : ''}{task.name}
        </span>
        {/* Tooltip on hover */}
        <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-30 pointer-events-none">
          <div className="bg-[#1B1464] text-white text-[10px] rounded-lg px-3 py-2 shadow-lg whitespace-nowrap max-w-[280px]">
            <p className="font-semibold">{task.name}</p>
            <p className="text-[#A8A29E] mt-0.5">{format(startDate, 'MMM d')} → {format(endDate, 'MMM d')} ({task.durationDays} BD)</p>
            <p className="text-[#A8A29E]">Owner: {OWNER_LABELS[task.owner] || task.owner}</p>
            {task.isCompressed && <p className="text-amber-300 mt-0.5">⚠ Compressed by {task.compressionDays} BD</p>}
            {task.dependencyNames && task.dependencyNames.length > 0 && (
              <p className="text-[#A8A29E] mt-0.5">Deps: {task.dependencyNames.join(', ')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Day column backgrounds (weekends, today) ──

function DayBackgrounds({ range, markers }: { range: GanttDateRange; markers?: { date: string; color: string; label: string }[] }) {
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < range.totalDays; i++) {
    const d = addDays(range.start, i);
    if (isWeekend(d)) {
      elements.push(
        <div
          key={`we-${i}`}
          className="absolute top-0 bottom-0 bg-[#F5F5F4]/60"
          style={{ gridColumn: `${i + 1} / ${i + 2}` }}
        />
      );
    }
    if (isToday(d)) {
      elements.push(
        <div
          key="today"
          className="absolute top-0 bottom-0 w-0.5 bg-[#DC2626] z-10"
          style={{ gridColumn: `${i + 1} / ${i + 2}`, justifySelf: 'center' }}
        />
      );
    }
  }

  // Launch date markers
  if (markers) {
    for (const m of markers) {
      const idx = dayIndex(parseISO(m.date), range.start);
      if (idx >= 0 && idx < range.totalDays) {
        elements.push(
          <div
            key={`marker-${m.label}`}
            className="absolute top-0 bottom-0 z-10 border-l-2 border-dashed"
            style={{ gridColumn: `${idx + 1} / ${idx + 2}`, borderColor: m.color }}
            title={m.label}
          />
        );
      }
    }
  }

  return (
    <div
      className="absolute inset-0 grid pointer-events-none"
      style={{ gridTemplateColumns: `repeat(${range.totalDays}, minmax(18px, 1fr))` }}
    >
      {elements}
    </div>
  );
}

// ── Main GanttChart component (single launch) ──

interface GanttChartProps {
  tasks: GTMTask[];
  launchDate: string;
  sephoraLaunchDate?: string;
  amazonLaunchDate?: string;
}

export default function GanttChart({ tasks, launchDate, sephoraLaunchDate, amazonLaunchDate }: GanttChartProps) {
  const [collapsedPhases, setCollapsedPhases] = useState<Set<PhaseKey>>(new Set());

  const extraDates = [sephoraLaunchDate, amazonLaunchDate].filter(Boolean) as string[];
  const range = useMemo(() => computeDateRange(tasks, launchDate, extraDates), [tasks, launchDate, ...extraDates]);

  const markers = useMemo(() => {
    const m = [{ date: launchDate, color: '#FF1493', label: `DTC Launch: ${format(parseISO(launchDate), 'MMM d')}` }];
    if (sephoraLaunchDate) m.push({ date: sephoraLaunchDate, color: '#8B5CF6', label: `Sephora: ${format(parseISO(sephoraLaunchDate), 'MMM d')}` });
    if (amazonLaunchDate) m.push({ date: amazonLaunchDate, color: '#F97316', label: `Amazon: ${format(parseISO(amazonLaunchDate), 'MMM d')}` });
    return m;
  }, [launchDate, sephoraLaunchDate, amazonLaunchDate]);

  const tasksByPhase = useMemo(() => {
    const grouped: Record<string, GTMTask[]> = {};
    for (const t of tasks) {
      if (!grouped[t.phase]) grouped[t.phase] = [];
      grouped[t.phase].push(t);
    }
    return grouped;
  }, [tasks]);

  const togglePhase = (phase: PhaseKey) => {
    setCollapsedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase);
      else next.add(phase);
      return next;
    });
  };

  if (tasks.length === 0) return <p className="text-sm text-[#A8A29E]">No tasks to display.</p>;

  return (
    <div className="bg-white rounded-xl border border-[#E7E5E4] overflow-hidden">
      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-[#E7E5E4] bg-[#FAFAF9]">
        <span className="text-[10px] text-[#A8A29E] font-medium">LAUNCH MARKERS:</span>
        {markers.map(m => (
          <div key={m.label} className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 border-t-2 border-dashed" style={{ borderColor: m.color }} />
            <span className="text-[10px] text-[#57534E]">{m.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="w-3 h-0.5 bg-[#DC2626]" />
          <span className="text-[10px] text-[#57534E]">Today</span>
        </div>
      </div>

      <div className="flex">
        {/* Left: task names (sticky) */}
        <div className="w-[220px] shrink-0 border-r border-[#E7E5E4] bg-white z-10 sticky left-0">
          {/* Header spacer */}
          <div className="h-[52px] border-b border-[#E7E5E4]" />

          {PHASES.map(phase => {
            const phaseTasks = tasksByPhase[phase.key];
            if (!phaseTasks || phaseTasks.length === 0) return null;
            const isCollapsed = collapsedPhases.has(phase.key);

            return (
              <div key={phase.key}>
                <button
                  onClick={() => togglePhase(phase.key)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#FAFAF9] transition-colors"
                  style={{ background: PHASE_BG[phase.key] }}
                >
                  {isCollapsed ? <ChevronRight className="w-3 h-3 text-[#A8A29E]" /> : <ChevronDown className="w-3 h-3 text-[#A8A29E]" />}
                  <div className="w-2 h-2 rounded-full" style={{ background: phase.color }} />
                  <span className="text-[11px] font-semibold text-[#1B1464] truncate">{phase.name}</span>
                  <span className="text-[10px] text-[#A8A29E] ml-auto">{phaseTasks.length}</span>
                </button>
                {!isCollapsed && phaseTasks.map(t => (
                  <div
                    key={t.id}
                    className={`flex items-center h-7 px-3 text-[11px] truncate border-b border-[#F5F5F4] ${
                      t.status === 'complete' ? 'text-[#A8A29E] line-through' : 'text-[#44403C]'
                    }`}
                    title={t.name}
                  >
                    {t.isMeeting && <span className="mr-1 text-[10px]">📅</span>}
                    {t.name}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Right: scrollable gantt grid */}
        <div className="flex-1 overflow-x-auto">
          <div className="min-w-[1400px] relative">
            <GanttHeader range={range} />

            <div className="relative">
              <DayBackgrounds range={range} markers={markers} />

              {PHASES.map(phase => {
                const phaseTasks = tasksByPhase[phase.key];
                if (!phaseTasks || phaseTasks.length === 0) return null;
                const isCollapsed = collapsedPhases.has(phase.key);
                const phaseColor = PHASE_COLORS[phase.key] || '#6B7280';

                return (
                  <div key={phase.key}>
                    {/* Phase header row spacer */}
                    <div className="h-[30px]" style={{ background: PHASE_BG[phase.key] + '80' }} />
                    {!isCollapsed && phaseTasks.map(t => (
                      <TaskBar key={t.id} task={t} range={range} phaseColor={phaseColor} />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
