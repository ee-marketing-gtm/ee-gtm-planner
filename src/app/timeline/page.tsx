'use client';

import { useEffect, useState, useMemo } from 'react';
import { parseISO, addDays, format, differenceInCalendarDays, isWeekend, isToday, startOfWeek } from 'date-fns';
import { ChevronDown, ChevronRight, Check, CheckCircle2, Circle, Clock } from 'lucide-react';
import Link from 'next/link';
import { Launch, GTMTask, PHASES, OWNER_LABELS, TIER_CONFIG, PhaseKey } from '@/lib/types';
import { useData } from '@/components/DataProvider';
import { getLaunchColor } from '@/lib/utils';
import { computeDateRange, dayIndex, GanttDateRange } from '@/components/GanttChart';

const LAUNCH_COLORS = ['#FF1493', '#6366F1', '#10B981', '#F59E0B', '#EC4899', '#0EA5E9', '#F97316', '#8B5CF6', '#14B8A6', '#EF4444'];

const PHASE_COLORS: Record<string, string> = {
  content_planning: '#6366F1',
  finalize_mgmt: '#F59E0B',
  content_production: '#10B981',
  design_production: '#EC4899',
  packaging: '#7C3AED',
};

function desaturateColor(hex: string, amount: number): string {
  // Simple desaturation: blend towards gray
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const gray = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
  const nr = Math.round(r + (gray - r) * amount);
  const ng = Math.round(g + (gray - g) * amount);
  const nb = Math.round(b + (gray - b) * amount);
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

export default function TimelinePage() {
  const { launches: allLaunches, loading } = useData();
  const launches = useMemo(
    () => allLaunches.filter(l => l.status !== 'post_launch' && l.status !== 'archived'),
    [allLaunches]
  );
  const [mounted, setMounted] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedLaunches, setExpandedLaunches] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (loading) return;
    // Auto-select first 3
    setSelectedIds(new Set(launches.slice(0, 3).map(l => l.id)));
    setExpandedLaunches(new Set(launches.slice(0, 3).map(l => l.id)));
    setMounted(true);
  }, [loading, launches]);

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setExpandedLaunches(prev2 => { const n = new Set(prev2); n.delete(id); return n; });
      } else {
        next.add(id);
        setExpandedLaunches(prev2 => new Set([...prev2, id]));
      }
      return next;
    });
  };

  const toggleExpanded = (id: string) => {
    setExpandedLaunches(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedLaunches = useMemo(
    () => launches.filter(l => selectedIds.has(l.id)),
    [launches, selectedIds]
  );

  // Compute shared date range across all selected launches
  const range = useMemo(() => {
    if (selectedLaunches.length === 0) return null;
    const allTasks = selectedLaunches.flatMap(l => l.tasks);
    const allLaunchDates = selectedLaunches.flatMap(l => {
      const dates = [l.launchDate];
      if (l.sephoraLaunchDate) dates.push(l.sephoraLaunchDate);
      if (l.amazonLaunchDate) dates.push(l.amazonLaunchDate);
      return dates;
    });
    const primary = allLaunchDates[0] || new Date().toISOString().slice(0, 10);
    return computeDateRange(allTasks, primary, allLaunchDates.slice(1), 10);
  }, [selectedLaunches]);

  // Color map for launches — prefer brandColor, then tier color, then fallback palette
  const launchColorMap = useMemo(() => {
    const map = new Map<string, string>();
    selectedLaunches.forEach((l, i) => map.set(l.id, getLaunchColor(l) || LAUNCH_COLORS[i % LAUNCH_COLORS.length]));
    return map;
  }, [selectedLaunches]);

  if (!mounted || loading) return <div className="p-8" />;

  return (
    <div className="p-8 max-w-[1600px]">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1B1464]">Launch Timeline</h1>
        <p className="text-sm text-[#A8A29E] mt-1">Compare timelines across multiple launches</p>
      </div>

      {/* Launch selector */}
      <div className="bg-white rounded-xl border border-[#E7E5E4] p-4 mb-6">
        <h2 className="text-xs font-semibold text-[#78716C] uppercase tracking-wider mb-3">Select Launches</h2>
        <div className="flex flex-wrap gap-2">
          {launches.map(l => {
            const isSelected = selectedIds.has(l.id);
            const color = launchColorMap.get(l.id) || '#A8A29E';
            return (
              <button
                key={l.id}
                onClick={() => toggleSelected(l.id)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  isSelected
                    ? 'text-white shadow-sm'
                    : 'bg-white text-[#57534E] border-[#E7E5E4] hover:border-[#D6D3D1]'
                }`}
                style={isSelected ? { background: color, borderColor: color } : {}}
              >
                {isSelected && <Check className="w-3 h-3" />}
                {l.name}
                <span className={`text-[10px] ${isSelected ? 'text-white/70' : 'text-[#A8A29E]'}`}>
                  {format(parseISO(l.launchDate), 'MMM d')}
                </span>
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded-full"
                  style={isSelected
                    ? { background: 'rgba(255,255,255,0.2)' }
                    : { background: getLaunchColor(l) + '15', color: getLaunchColor(l) }
                  }
                >
                  {l.tier}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Gantt */}
      {selectedLaunches.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E7E5E4] p-12 text-center">
          <p className="text-sm text-[#A8A29E]">Select launches above to see their timelines.</p>
        </div>
      ) : range ? (
        <div className="bg-white rounded-xl border border-[#E7E5E4] overflow-hidden">
          {/* Legend */}
          <div className="flex items-center gap-4 px-4 py-2 border-b border-[#E7E5E4] bg-[#FAFAF9] flex-wrap">
            {/* Launch colors */}
            {selectedLaunches.map(l => (
              <div key={l.id} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ background: launchColorMap.get(l.id) }} />
                <span className="text-[10px] font-medium text-[#57534E]">{l.name}</span>
                <span className="text-[10px] text-[#A8A29E]">(DTC {format(parseISO(l.launchDate), 'MMM d')})</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 ml-auto">
              <div className="w-3 h-0.5 bg-[#DC2626]" />
              <span className="text-[10px] text-[#57534E]">Today</span>
            </div>

            <div className="w-px h-3 bg-[#E7E5E4]" />

            {/* Phase colors */}
            <div className="flex items-center gap-3">
              {PHASES.map(p => (
                <div key={p.key} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm" style={{ background: p.color }} />
                  <span className="text-[10px] text-[#57534E]">{p.name}</span>
                </div>
              ))}
            </div>

            <div className="w-px h-3 bg-[#E7E5E4]" />

            {/* Task status opacity legend */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-medium text-[#78716C]">Status:</span>
              <div className="flex items-center gap-1">
                <div className="w-5 h-3 rounded-sm" style={{ background: '#6366F1' }} />
                <span className="text-[10px] text-[#57534E]">In Progress</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-5 h-3 rounded-sm opacity-60" style={{ background: desaturateColor('#6366F1', 0.5) }} />
                <span className="text-[10px] text-[#57534E]">Not Started</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-5 h-3 rounded-sm opacity-40" style={{ background: '#6366F1' }} />
                <span className="text-[10px] text-[#57534E]">Complete</span>
              </div>
            </div>
          </div>

          <div className="flex">
            {/* Left: labels */}
            <div className="w-[220px] shrink-0 border-r border-[#E7E5E4] bg-white z-10 sticky left-0">
              {/* Header spacer */}
              <div className="h-[52px] border-b border-[#E7E5E4]" />

              {selectedLaunches.map(l => {
                const isExpanded = expandedLaunches.has(l.id);
                const color = launchColorMap.get(l.id) || '#6B7280';
                const sortedTasks = [...l.tasks].sort((a, b) => (a.startDate || a.dueDate || '').localeCompare(b.startDate || b.dueDate || ''));

                return (
                  <div key={l.id}>
                    {/* Launch header */}
                    <button
                      onClick={() => toggleExpanded(l.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#FAFAF9] transition-colors border-b border-[#E7E5E4]"
                    >
                      {isExpanded ? <ChevronDown className="w-3 h-3 text-[#A8A29E]" /> : <ChevronRight className="w-3 h-3 text-[#A8A29E]" />}
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                      <Link href={`/launch/${l.id}`} onClick={e => e.stopPropagation()} className="text-[11px] font-semibold text-[#1B1464] truncate hover:text-[#FF1493]">
                        {l.name}
                      </Link>
                      <span className="text-[10px] text-[#A8A29E] ml-auto">{l.tasks.length}</span>
                    </button>
                    {isExpanded && sortedTasks.map(t => (
                      <div
                        key={t.id}
                        className={`flex items-center h-7 px-3 pl-7 text-[11px] truncate border-b border-[#F5F5F4] ${
                          t.status === 'complete'
                            ? 'text-[#A8A29E] line-through'
                            : t.status === 'not_started'
                              ? 'text-[#A8A29E]'
                              : 'text-[#44403C]'
                        }`}
                        title={t.name}
                      >
                        {t.status === 'complete' && <CheckCircle2 className="w-3 h-3 text-[#A8A29E] mr-1 shrink-0" />}
                        {t.status === 'in_progress' && <Clock className="w-3 h-3 text-[#57534E] mr-1 shrink-0" />}
                        {t.status === 'not_started' && <Circle className="w-3 h-3 text-[#D6D3D1] mr-1 shrink-0" />}
                        {t.isMeeting && <span className="mr-1 text-[10px]">📅</span>}
                        {t.name}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Right: scrollable gantt */}
            <div className="flex-1 overflow-x-auto">
              <div className="min-w-[1400px] relative">
                {/* Header */}
                <MultiGanttHeader range={range} />

                <div className="relative">
                  {/* Day backgrounds */}
                  <MultiDayBackgrounds range={range} launches={selectedLaunches} colorMap={launchColorMap} />

                  {selectedLaunches.map(l => {
                    const isExpanded = expandedLaunches.has(l.id);
                    const color = launchColorMap.get(l.id) || '#6B7280';
                    const sortedTasks = [...l.tasks].sort((a, b) => (a.startDate || a.dueDate || '').localeCompare(b.startDate || b.dueDate || ''));

                    return (
                      <div key={l.id}>
                        {/* Launch summary bar */}
                        <div className="h-[37px] border-b border-[#E7E5E4]">
                          <div
                            className="grid items-center h-full"
                            style={{ gridTemplateColumns: `repeat(${range.totalDays}, minmax(18px, 1fr))` }}
                          >
                            {(() => {
                              const tasks = l.tasks.filter(t => t.dueDate);
                              if (tasks.length === 0) return null;
                              const earliest = tasks.reduce((min, t) => {
                                const s = t.startDate || t.dueDate;
                                return s && s < min ? s : min;
                              }, l.launchDate);
                              const col1 = Math.max(1, dayIndex(parseISO(earliest), range.start) + 1);
                              const col2 = Math.max(col1 + 1, dayIndex(parseISO(l.launchDate), range.start) + 2);
                              return (
                                <div
                                  className="h-2 rounded-full opacity-30"
                                  style={{ gridColumn: `${col1} / ${col2}`, background: color }}
                                />
                              );
                            })()}
                          </div>
                        </div>
                        {/* Individual task bars */}
                        {isExpanded && sortedTasks.map(t => {
                          const startDate = t.startDate
                            ? parseISO(t.startDate)
                            : t.dueDate
                              ? addDays(parseISO(t.dueDate), -Math.max(t.durationDays, 1))
                              : null;
                          const endDate = t.dueDate ? parseISO(t.dueDate) : null;

                          if (!startDate || !endDate) return <div key={t.id} className="h-6" />;

                          const col1 = Math.max(1, dayIndex(startDate, range.start) + 1);
                          const col2 = Math.max(col1 + 1, dayIndex(endDate, range.start) + 2);
                          const phaseColor = PHASE_COLORS[t.phase] || '#6B7280';
                          const isComplete = t.status === 'complete';
                          const isNotStarted = t.status === 'not_started';

                          // Determine visual styling based on status
                          const barColor = isNotStarted ? desaturateColor(phaseColor, 0.5) : phaseColor;
                          const barOpacity = isComplete ? 'opacity-40' : isNotStarted ? 'opacity-60' : '';

                          return (
                            <div
                              key={t.id}
                              className="grid items-center h-7 border-b border-[#F5F5F4]"
                              style={{ gridTemplateColumns: `repeat(${range.totalDays}, minmax(18px, 1fr))` }}
                            >
                              <div
                                className={`h-5 rounded-md relative group cursor-default ${barOpacity} ${t.isCompressed ? 'ring-1 ring-amber-400' : ''}`}
                                style={{
                                  gridColumn: `${col1} / ${col2}`,
                                  background: barColor,
                                }}
                              >
                                {/* Strikethrough overlay for complete tasks */}
                                {isComplete && (
                                  <div className="absolute inset-0 flex items-center pointer-events-none">
                                    <div className="w-full h-px bg-white/60" />
                                  </div>
                                )}
                                <span className="absolute inset-0 flex items-center px-1.5 text-[9px] font-medium text-white truncate pointer-events-none">
                                  {isComplete && <CheckCircle2 className="w-3 h-3 mr-0.5 shrink-0" />}
                                  {t.isMeeting ? '📅 ' : ''}{t.name}
                                </span>
                                {/* Rich hover tooltip */}
                                <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-30 pointer-events-none">
                                  <div className="bg-[#1B1464] text-white text-[10px] rounded-lg px-3 py-2 shadow-lg whitespace-nowrap max-w-[300px]">
                                    <p className="font-semibold text-[11px]">{t.name}</p>
                                    <p className="text-white/60 mt-0.5">{l.name}</p>
                                    <p className="text-white/60 mt-0.5">{format(startDate, 'MMM d')} → {format(endDate, 'MMM d')} ({t.durationDays} BD)</p>
                                    <p className="text-white/60">Owner: {OWNER_LABELS[t.owner] || t.owner}</p>
                                    <p className="mt-0.5">
                                      <span className={
                                        isComplete ? 'text-green-300' : isNotStarted ? 'text-white/40' : 'text-blue-300'
                                      }>
                                        Status: {t.status.replace('_', ' ')}
                                      </span>
                                    </p>
                                    {t.isCompressed && <p className="text-amber-300 mt-0.5">⚠ Compressed by {t.compressionDays} BD</p>}
                                    {t.dependencyNames && t.dependencyNames.length > 0 && (
                                      <p className="text-white/60 mt-0.5">Deps: {t.dependencyNames.join(', ')}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Header for multi-launch gantt ──

function MultiGanttHeader({ range }: { range: GanttDateRange }) {
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
    if (d.getDay() === 1 || i === 0) {
      if (weekLabel) weeks.push({ startCol: weekStart + 1, span: i - weekStart, label: weekLabel });
      weekStart = i;
      weekLabel = format(d, 'MMM d');
    }
  }
  if (currentMonth) months.push({ label: currentMonth, startCol: monthStart + 1, span: range.totalDays - monthStart });
  if (weekLabel) weeks.push({ startCol: weekStart + 1, span: range.totalDays - weekStart, label: weekLabel });

  const colStyle = `repeat(${range.totalDays}, minmax(18px, 1fr))`;

  return (
    <div className="sticky top-0 z-20 bg-white border-b border-[#E7E5E4]">
      <div className="grid" style={{ gridTemplateColumns: colStyle }}>
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
      <div className="grid" style={{ gridTemplateColumns: colStyle }}>
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

// ── Day backgrounds for multi-launch gantt ──

function MultiDayBackgrounds({ range, launches, colorMap }: { range: GanttDateRange; launches: Launch[]; colorMap: Map<string, string> }) {
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
  for (const l of launches) {
    const color = colorMap.get(l.id) || '#6B7280';
    const idx = dayIndex(parseISO(l.launchDate), range.start);
    if (idx >= 0 && idx < range.totalDays) {
      elements.push(
        <div
          key={`launch-${l.id}`}
          className="absolute top-0 bottom-0 z-10 border-l-2 border-dashed"
          style={{ gridColumn: `${idx + 1} / ${idx + 2}`, borderColor: color }}
          title={`${l.name} DTC Launch: ${format(parseISO(l.launchDate), 'MMM d')}`}
        />
      );
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
