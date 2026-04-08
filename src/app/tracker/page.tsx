'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { format, parseISO, isBefore, isToday, addDays } from 'date-fns';
import { Calendar, Filter, ChevronDown, ArrowUpDown } from 'lucide-react';
import { Launch, GTMTask, PHASES, PhaseKey, OWNER_LABELS, OWNER_COLORS, Owner, TaskStatus, TIER_CONFIG } from '@/lib/types';
import { useData } from '@/components/DataProvider';
import { getPhaseName, getLaunchColor } from '@/lib/utils';

type ViewMode = 'by_launch' | 'by_date' | 'by_owner';
type TimeFilter = 'overdue' | 'this_week' | 'next_2_weeks' | 'all';
type SortDir = 'asc' | 'desc';

interface TaskWithLaunch {
  task: GTMTask;
  launch: Launch;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'not_started', label: 'Not Started', color: '#6B7280' },
  { value: 'in_progress', label: 'In Progress', color: '#3B82F6' },
  { value: 'blocked', label: 'Stuck', color: '#EF4444' },
  { value: 'waiting_review', label: 'Waiting for Review', color: '#F59E0B' },
  { value: 'complete', label: 'Completed', color: '#10B981' },
];

function getStatusMeta(status: TaskStatus) {
  return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
}

function StatusDropdown({
  status,
  onStatusChange,
}: {
  status: TaskStatus;
  onStatusChange: (s: TaskStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const meta = getStatusMeta(status);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative"
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      <button
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(!open);
        }}
        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors hover:opacity-80 whitespace-nowrap"
        style={{ background: meta.color + '18', color: meta.color }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
        {meta.label}
        <ChevronDown className="w-3 h-3 ml-0.5" />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-[#E7E5E4] rounded-lg shadow-lg py-1 min-w-[170px]">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                onStatusChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-[#FAFAF9] transition-colors ${
                opt.value === status ? 'font-semibold' : ''
              }`}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: opt.color }} />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TrackerPage() {
  const { launches, saveLaunches, loading } = useData();
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('by_date');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [ownerFilter, setOwnerFilter] = useState<Owner | 'all'>('all');
  const [phaseFilter, setPhaseFilter] = useState<PhaseKey | 'all'>('all');
  const [hideComplete, setHideComplete] = useState(true);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleStatusChange = (launchId: string, taskId: string, newStatus: TaskStatus) => {
    const updated = launches.map(l => {
      if (l.id !== launchId) return l;
      return {
        ...l,
        updatedAt: new Date().toISOString(),
        tasks: l.tasks.map(t =>
          t.id === taskId
            ? {
                ...t,
                status: newStatus,
                completedDate: newStatus === 'complete' ? new Date().toISOString() : t.completedDate,
              }
            : t
        ),
      };
    });
    saveLaunches(updated);
  };

  const allTasks = useMemo(() => {
    const tasks: TaskWithLaunch[] = [];
    for (const launch of launches) {
      if (launch.status === 'post_launch' || launch.status === 'archived') continue;
      for (const task of launch.tasks) {
        if (hideComplete && (task.status === 'complete' || task.status === 'skipped')) continue;
        if (ownerFilter !== 'all' && task.owner !== ownerFilter) continue;
        if (phaseFilter !== 'all' && task.phase !== phaseFilter) continue;

        const now = new Date();
        if (timeFilter !== 'all' && task.dueDate) {
          const due = parseISO(task.dueDate);
          if (timeFilter === 'overdue' && !(isBefore(due, now) && !isToday(due))) continue;
          if (timeFilter === 'this_week' && !(due <= addDays(now, 7))) continue;
          if (timeFilter === 'next_2_weeks' && !(due <= addDays(now, 14))) continue;
        }

        tasks.push({ task, launch });
      }
    }
    const sorted = tasks.sort((a, b) => (a.task.dueDate || '9999').localeCompare(b.task.dueDate || '9999'));
    return sortDir === 'desc' ? sorted.reverse() : sorted;
  }, [launches, hideComplete, ownerFilter, phaseFilter, timeFilter, sortDir]);

  if (!mounted || loading) return <div className="p-8" />;

  const groupedByDate = () => {
    const groups: Record<string, TaskWithLaunch[]> = {};
    for (const item of allTasks) {
      const key = item.task.dueDate ? format(parseISO(item.task.dueDate), 'EEEE, MMM d, yyyy') : 'No Due Date';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  };

  const groupedByOwner = () => {
    const groups: Record<string, TaskWithLaunch[]> = {};
    for (const item of allTasks) {
      const key = OWNER_LABELS[item.task.owner];
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  };

  const groupedByLaunch = () => {
    const groups: Record<string, TaskWithLaunch[]> = {};
    for (const item of allTasks) {
      if (!groups[item.launch.name]) groups[item.launch.name] = [];
      groups[item.launch.name].push(item);
    }
    return groups;
  };

  const groups = viewMode === 'by_date' ? groupedByDate()
    : viewMode === 'by_owner' ? groupedByOwner()
    : groupedByLaunch();

  return (
    <div className="p-8 max-w-[1500px]">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1B1464]">Cross-Functional Tracker</h1>
        <p className="text-sm text-[#A8A29E] mt-1">
          All tasks across all launches — see what&apos;s next, what&apos;s overdue, and who owns what.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6 bg-white rounded-xl border border-[#E7E5E4] p-4">
        <Filter className="w-4 h-4 text-[#A8A29E]" />

        <div className="flex items-center bg-[#F5F5F4] rounded-lg p-0.5">
          {([
            ['by_date', 'By Date'],
            ['by_launch', 'By Launch'],
            ['by_owner', 'By Owner'],
          ] as [ViewMode, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setViewMode(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === key ? 'bg-white shadow-sm text-[#1B1464]' : 'text-[#A8A29E]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <select value={timeFilter} onChange={e => setTimeFilter(e.target.value as TimeFilter)} className="text-xs px-3 py-1.5 border border-[#E7E5E4] rounded-lg bg-white focus:outline-none">
          <option value="all">All Dates</option>
          <option value="overdue">Overdue Only</option>
          <option value="this_week">This Week</option>
          <option value="next_2_weeks">Next 2 Weeks</option>
        </select>

        <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value as Owner | 'all')} className="text-xs px-3 py-1.5 border border-[#E7E5E4] rounded-lg bg-white focus:outline-none">
          <option value="all">All Owners</option>
          {Object.entries(OWNER_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select value={phaseFilter} onChange={e => setPhaseFilter(e.target.value as PhaseKey | 'all')} className="text-xs px-3 py-1.5 border border-[#E7E5E4] rounded-lg bg-white focus:outline-none">
          <option value="all">All Phases</option>
          {PHASES.map(p => (
            <option key={p.key} value={p.key}>{p.name}</option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-xs text-[#57534E] cursor-pointer ml-auto">
          <input
            type="checkbox"
            checked={hideComplete}
            onChange={e => setHideComplete(e.target.checked)}
            className="rounded border-[#D6D3D1] text-[#FF1493] focus:ring-[#FF1493]"
          />
          Hide completed
        </label>
      </div>

      {/* Task count */}
      <p className="text-xs text-[#A8A29E] mb-4">{allTasks.length} tasks shown</p>

      {/* Column headers */}
      {allTasks.length > 0 && (
        <div className="grid grid-cols-[140px_1fr_160px_140px_80px_80px_130px] gap-3 px-4 py-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#A8A29E]">
          <span>Status</span>
          <span>Task</span>
          <span>Launch</span>
          <span>Owner</span>
          <span>Start</span>
          <button
            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            className="flex items-center gap-0.5 hover:text-[#57534E] transition-colors"
          >
            Due
            <ArrowUpDown className="w-3 h-3" />
            <span className="text-[9px] font-normal normal-case">({sortDir === 'asc' ? 'earliest' : 'latest'})</span>
          </button>
          <span>Phase</span>
        </div>
      )}

      {/* Grouped Tasks */}
      {Object.keys(groups).length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E7E5E4] p-12 text-center">
          <Calendar className="w-10 h-10 text-[#D6D3D1] mx-auto mb-3" />
          <p className="text-sm text-[#A8A29E]">No tasks match your filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groups).map(([groupName, items]) => (
            <div key={groupName} className="bg-white rounded-xl border border-[#E7E5E4] overflow-hidden">
              <div className="px-4 py-3 bg-[#FAFAF9] border-b border-[#E7E5E4]">
                <h3 className="text-sm font-semibold text-[#1B1464]">{groupName}</h3>
                <span className="text-[11px] text-[#A8A29E]">{items.length} task{items.length !== 1 ? 's' : ''}</span>
              </div>
              <div>
                {items.map(({ task, launch }) => {
                  const isOverdue = task.dueDate && task.status !== 'complete' && task.status !== 'skipped' &&
                    isBefore(parseISO(task.dueDate), new Date()) && !isToday(parseISO(task.dueDate));
                  const tierColor = getLaunchColor(launch);

                  return (
                    <div
                      key={task.id}
                      className={`border-t border-[#E7E5E4] first:border-t-0 ${isOverdue ? 'bg-red-50/30' : ''}`}
                    >
                      <div className="grid grid-cols-[140px_1fr_160px_140px_80px_80px_130px] gap-3 px-4 py-3 items-center">
                        {/* Status pill - inline dropdown */}
                        <StatusDropdown
                          status={task.status}
                          onStatusChange={(newStatus) => handleStatusChange(launch.id, task.id, newStatus)}
                        />

                        {/* Task name - clickable link */}
                        <Link
                          href={`/launch/${launch.id}?task=${task.id}`}
                          className="hover:text-[#FF1493] transition-colors min-w-0"
                        >
                          <p className={`text-sm truncate ${task.status === 'complete' ? 'line-through text-[#A8A29E]' : 'text-[#1B1464]'}`}>
                            {task.name}
                          </p>
                          {task.dependencies.length > 0 && (() => {
                            const allDepsComplete = task.dependencies.every(depId => {
                              const dep = launch.tasks.find(t => t.id === depId);
                              return dep && (dep.status === 'complete' || dep.status === 'skipped');
                            });
                            if (allDepsComplete) return null;
                            const incompleteDeps = task.dependencies.filter(depId => {
                              const dep = launch.tasks.find(t => t.id === depId);
                              return dep && dep.status !== 'complete' && dep.status !== 'skipped';
                            });
                            const depNames = incompleteDeps.map(depId => {
                              const dep = launch.tasks.find(t => t.id === depId);
                              return dep?.name || '';
                            }).filter(Boolean);
                            const drivingDep = incompleteDeps.reduce<GTMTask | null>((latest, depId) => {
                              const dep = launch.tasks.find(t => t.id === depId);
                              if (!dep?.dueDate) return latest;
                              if (!latest?.dueDate) return dep;
                              return dep.dueDate > latest.dueDate ? dep : latest;
                            }, null);
                            return (
                              <p className="text-[10px] text-[#A8A29E] truncate mt-0.5">
                                {incompleteDeps.length === 1
                                  ? <>Waiting on: {depNames[0]}</>
                                  : <>Waiting on {incompleteDeps.length} deps{drivingDep ? <> — driven by: <span className="text-[#57534E]">{drivingDep.name}</span></> : null}</>
                                }
                              </p>
                            );
                          })()}
                        </Link>

                        {/* Launch name with tier dot */}
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: tierColor }}
                          />
                          <span className="text-xs text-[#57534E] truncate">{launch.name}</span>
                        </div>

                        {/* Owner */}
                        <span
                          className="text-[11px] font-medium px-2 py-0.5 rounded-full w-fit whitespace-nowrap"
                          style={{ background: OWNER_COLORS[task.owner] + '15', color: OWNER_COLORS[task.owner] }}
                        >
                          {OWNER_LABELS[task.owner]}
                        </span>

                        {/* Start date */}
                        <span className="text-xs text-[#A8A29E]">
                          {task.startDate ? format(parseISO(task.startDate), 'MMM d') : '—'}
                        </span>

                        {/* Due date */}
                        <span className={`text-xs ${isOverdue ? 'text-[#DC2626] font-medium' : 'text-[#57534E]'}`}>
                          {task.dueDate ? format(parseISO(task.dueDate), 'MMM d') : '—'}
                        </span>

                        {/* Phase */}
                        <span className="text-xs text-[#A8A29E]">{getPhaseName(task.phase)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
