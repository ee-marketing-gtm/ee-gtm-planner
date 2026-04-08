'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO, isBefore, isToday, addDays, startOfDay, addBusinessDays } from 'date-fns';
import {
  Rocket, AlertTriangle, Clock, CheckCircle2, ArrowRight,
  CalendarDays, ChevronRight, Circle, Download, List, LayoutGrid,
  ChevronDown, Eye, Pause, Plus, Undo2, RefreshCw, Archive
} from 'lucide-react';
import { Launch, GTMTask, TaskStatus, PHASES, TIER_CONFIG, LAUNCH_TYPE_LABELS, OWNER_LABELS, OWNER_COLORS, DELIVERABLE_TASKS } from '@/lib/types';
import { differenceInBusinessDays } from 'date-fns';
import { ExternalLink, Link2 as LinkIcon } from 'lucide-react';
import { useData } from '@/components/DataProvider';
import { getStatusLabel, getStatusColor } from '@/lib/utils';
import {
  getNextTask, getOverdueTasks, getUpcomingTasks,
  getLaunchProgress, getDaysUntilLaunch, getPhaseName, getLaunchColor
} from '@/lib/utils';
import { generate2026Launches } from '@/lib/seed-2026';

function getDisplayLabel(task: GTMTask): string {
  // Show custom label if set, otherwise try to extract filename from URL, fall back to generic label
  if (task.deliverableLabel && task.deliverableLabel.trim()) return task.deliverableLabel;
  if (task.deliverableUrl && task.deliverableUrl.trim()) {
    try {
      const url = new URL(task.deliverableUrl);
      const pathname = url.pathname;
      const segments = pathname.split('/').filter(Boolean);
      const last = segments[segments.length - 1];
      if (last && last.includes('.') && last.length < 80) return decodeURIComponent(last);
    } catch {}
  }
  return DELIVERABLE_TASKS[task.name] || 'Link';
}

interface TaskWithLaunch {
  task: GTMTask;
  launch: Launch;
}

export default function Dashboard() {
  const { launches, saveLaunches, loading } = useData();
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<'agenda' | 'launches'>('agenda');
  useEffect(() => {
    setMounted(true);
  }, []);

  const updateTask = useCallback((launchId: string, taskId: string, updates: Partial<GTMTask>) => {
    const next = launches.map(l => {
      if (l.id !== launchId) return l;
      return {
        ...l,
        updatedAt: new Date().toISOString(),
        tasks: l.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t),
      };
    });
    saveLaunches(next);
  }, [launches, saveLaunches]);

  const activeLaunches = useMemo(() => launches.filter(l => {
    return l.status !== 'post_launch' && l.status !== 'archived';
  }), [launches]);

  const allOverdue = useMemo(() => activeLaunches.flatMap(l =>
    getOverdueTasks(l).map(t => ({ task: t, launch: l }))
  ).sort((a, b) => (a.task.dueDate || '').localeCompare(b.task.dueDate || '')), [activeLaunches]);

  const allUpcoming = useMemo(() => activeLaunches.flatMap(l =>
    getUpcomingTasks(l, 14).map(t => ({ task: t, launch: l }))
  ).sort((a, b) => (a.task.dueDate || '').localeCompare(b.task.dueDate || '')), [activeLaunches]);

  const allIncompleteTasks = useMemo(() => activeLaunches.flatMap(l =>
    l.tasks
      .filter(t => t.status !== 'complete' && t.status !== 'skipped' && t.dueDate)
      .map(t => ({ task: t, launch: l }))
  ).sort((a, b) => (a.task.dueDate || '').localeCompare(b.task.dueDate || '')), [activeLaunches]);

  // Recently completed tasks (completed today)
  const recentlyCompletedTasks = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return activeLaunches.flatMap(l =>
      l.tasks
        .filter(t => t.status === 'complete' && t.completedDate === todayStr)
        .map(t => ({ task: t, launch: l }))
    ).sort((a, b) => (b.task.completedDate || '').localeCompare(a.task.completedDate || ''));
  }, [activeLaunches]);

  // Smart alerts: tasks that need to start NOW based on lead time vs days remaining
  const startNowTasks = useMemo(() => {
    const today = startOfDay(new Date());
    return activeLaunches.flatMap(l =>
      l.tasks
        .filter(t => {
          if (t.status === 'complete' || t.status === 'skipped' || t.status === 'in_progress' || !t.dueDate) return false;
          const dueDate = parseISO(t.dueDate);
          const daysUntilDue = differenceInBusinessDays(dueDate, today);
          const leadTime = t.durationDays || 3;
          // Alert if days remaining <= lead time and task hasn't started (include tasks due today)
          return daysUntilDue >= 0 && daysUntilDue <= leadTime && t.status === 'not_started';
        })
        .map(t => {
          const dueDate = parseISO(t.dueDate!);
          const daysUntilDue = differenceInBusinessDays(dueDate, today);
          const leadTime = t.durationDays || 3;
          return { task: t, launch: l, daysUntilDue, leadTime };
        })
    ).sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  }, [activeLaunches]);

  // Ready to start: upcoming tasks whose dependencies are all complete
  const readyToStartTasks = useMemo(() => {
    const today = startOfDay(new Date());
    const twoWeeksOut = addDays(today, 21);
    return activeLaunches.flatMap(l => {
      const completedIds = new Set(l.tasks.filter(t => t.status === 'complete' || t.status === 'skipped').map(t => t.id));
      return l.tasks
        .filter(t => {
          if (t.status !== 'not_started' || !t.dueDate) return false;
          const dueDate = parseISO(t.dueDate);
          if (isBefore(dueDate, today) || isToday(dueDate)) return false; // overdue/today handled elsewhere
          if (dueDate > twoWeeksOut) return false; // too far out
          // Check all dependencies are complete
          if (t.dependencies.length > 0) {
            return t.dependencies.every(depId => completedIds.has(depId));
          }
          return true; // no deps = ready
        })
        .map(t => ({ task: t, launch: l }));
    }).sort((a, b) => (a.task.dueDate || '').localeCompare(b.task.dueDate || ''))
    .slice(0, 8); // Show top 8
  }, [activeLaunches]);

  const tasksByDate = useMemo(() => {
    const groups: { label: string; dateKey: string; tasks: TaskWithLaunch[]; isOverdue: boolean; isToday: boolean }[] = [];
    const today = startOfDay(new Date());
    const seen = new Set<string>();

    for (const item of allIncompleteTasks) {
      const dateKey = item.task.dueDate!;
      if (seen.has(dateKey)) {
        groups.find(g => g.dateKey === dateKey)?.tasks.push(item);
        continue;
      }
      seen.add(dateKey);
      const d = parseISO(dateKey);
      const overdue = isBefore(d, today) && !isToday(d);
      const todayFlag = isToday(d);
      groups.push({
        label: todayFlag ? 'Today' : format(d, 'EEEE, MMM d'),
        dateKey,
        tasks: [item],
        isOverdue: overdue,
        isToday: todayFlag,
      });
    }
    return groups;
  }, [allIncompleteTasks]);

  const totalTasks = useMemo(() => activeLaunches.reduce((sum, l) => sum + l.tasks.length, 0), [activeLaunches]);
  const completedTasks = useMemo(() => activeLaunches.reduce(
    (sum, l) => sum + l.tasks.filter(t => t.status === 'complete' || t.status === 'skipped').length, 0
  ), [activeLaunches]);

  if (!mounted || loading) return <div className="p-8" />;

  const hasLaunches = activeLaunches.length > 0;

  return (
    <div className="p-8 max-w-[1400px]">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#1B1464]">Command Center</h1>
          <p className="text-sm text-[#A8A29E] mt-1">
            {activeLaunches.length} active launch{activeLaunches.length !== 1 ? 'es' : ''} · {allIncompleteTasks.length} tasks remaining
          </p>
        </div>
        {hasLaunches && (
          <div className="flex items-center bg-[#F5F5F4] rounded-lg p-0.5">
            <button
              onClick={() => setView('agenda')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === 'agenda' ? 'bg-white shadow-sm text-[#1B1464]' : 'text-[#A8A29E]'
              }`}
            >
              <List className="w-3.5 h-3.5" /> What&apos;s Next
            </button>
            <button
              onClick={() => setView('launches')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === 'launches' ? 'bg-white shadow-sm text-[#1B1464]' : 'text-[#A8A29E]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> By Launch
            </button>
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Rocket className="w-5 h-5 text-[#FF1493]" />}
          label="Active Launches"
          value={activeLaunches.length}
          bg="bg-[#FFF0F7]"
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5 text-[#DC2626]" />}
          label="Overdue Tasks"
          value={allOverdue.length}
          bg="bg-red-50"
          alert={allOverdue.length > 0}
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-[#F59E0B]" />}
          label="Due This Week"
          value={allUpcoming.filter(t => {
            const d = t.task.dueDate ? parseISO(t.task.dueDate) : null;
            return d && d <= new Date(Date.now() + 7 * 86400000);
          }).length}
          bg="bg-amber-50"
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5 text-[#10B981]" />}
          label="Tasks Complete"
          value={totalTasks > 0 ? `${completedTasks}/${totalTasks}` : '0'}
          bg="bg-emerald-50"
        />
      </div>

      {!hasLaunches ? (
        <div className="bg-white rounded-xl border border-[#E7E5E4] p-12 text-center">
          <Rocket className="w-10 h-10 text-[#D6D3D1] mx-auto mb-3" />
          <p className="text-sm text-[#A8A29E]">No active launches yet.</p>
          <p className="text-xs text-[#D6D3D1] mt-1 mb-4">Click &ldquo;New Launch&rdquo; to get started, or load the 2026 calendar.</p>
          <button
            onClick={() => {
              const seeded = generate2026Launches();
              saveLaunches([...launches, ...seeded]);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#FF1493] text-white text-sm font-medium rounded-lg hover:bg-[#D4117D] transition-colors"
          >
            <Download className="w-4 h-4" />
            Load 2026 Launches
          </button>
        </div>
      ) : view === 'agenda' ? (
        <AgendaView
          tasksByDate={tasksByDate}
          activeLaunches={activeLaunches}
          updateTask={updateTask}
          recentlyCompletedTasks={recentlyCompletedTasks}
          startNowTasks={startNowTasks}
          readyToStartTasks={readyToStartTasks}
        />
      ) : (
        <LaunchesView activeLaunches={activeLaunches} />
      )}
    </div>
  );
}

function AgendaView({ tasksByDate, activeLaunches, updateTask, recentlyCompletedTasks, startNowTasks, readyToStartTasks }: {
  tasksByDate: { label: string; dateKey: string; tasks: TaskWithLaunch[]; isOverdue: boolean; isToday: boolean }[];
  activeLaunches: Launch[];
  updateTask: (launchId: string, taskId: string, updates: Partial<GTMTask>) => void;
  recentlyCompletedTasks: TaskWithLaunch[];
  startNowTasks: { task: GTMTask; launch: Launch; daysUntilDue: number; leadTime: number }[];
  readyToStartTasks: TaskWithLaunch[];
}) {
  const router = useRouter();
  const [showCompleted, setShowCompleted] = useState(true);

  const handleRescheduleGroup = (group: { dateKey: string; tasks: TaskWithLaunch[] }) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    for (const { task, launch } of group.tasks) {
      updateTask(launch.id, task.id, { dueDate: todayStr });
    }
  };

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Main: Task Agenda */}
      <div className="col-span-2">

        {/* START NOW — Smart lead time alerts */}
        {startNowTasks.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#57534E] uppercase tracking-wider mb-3">
              <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
              Start Now
              <span className="text-xs font-medium text-[#A8A29E] normal-case tracking-normal">
                — these need lead time before they&apos;re due
              </span>
            </div>
            <div className="bg-amber-50 rounded-xl border border-amber-200 divide-y divide-amber-200">
              {startNowTasks.map(({ task, launch, daysUntilDue, leadTime }) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-amber-100/50 transition-colors"
                  onClick={() => router.push(`/launch/${launch.id}?task=${task.id}`)}
                >
                  <div className="w-8 h-8 rounded-full bg-[#F59E0B]/10 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-[#F59E0B]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 mb-1"
                      style={{ background: getLaunchColor(launch) + '15', color: getLaunchColor(launch) }}
                    >
                      <span className="w-2 h-2 rounded-full inline-block" style={{ background: getLaunchColor(launch) }} />
                      {launch.name}
                    </span>
                    <p className="text-sm text-[#1B1464] font-medium truncate">{task.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-[#F59E0B]">
                      {daysUntilDue === 0 ? 'Due today' : `Due in ${daysUntilDue}d`}
                    </p>
                    <p className="text-[10px] text-[#92400E]">
                      Needs {leadTime}d lead time
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed Today — at the TOP */}
        {recentlyCompletedTasks.length > 0 && (
          <div className="mb-6">
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center gap-2 text-sm font-semibold text-[#57534E] uppercase tracking-wider mb-4 hover:text-[#1B1464] transition-colors"
            >
              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              Completed Today
              <span className="text-xs font-medium text-[#A8A29E] normal-case tracking-normal">
                ({recentlyCompletedTasks.length})
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-[#A8A29E] transition-transform ${showCompleted ? '' : '-rotate-90'}`} />
            </button>

            {showCompleted && (
              <div className="bg-white rounded-xl border border-[#E7E5E4] divide-y divide-[#E7E5E4]">
                {recentlyCompletedTasks.map(({ task, launch }) => (
                  <div key={task.id} className="flex items-center gap-3 px-4 py-3">
                    <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 mb-1"
                        style={{ background: getLaunchColor(launch) + '15', color: getLaunchColor(launch) }}
                      >
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: getLaunchColor(launch) }} />
                        {launch.name}
                      </span>
                      <p className="text-sm text-[#A8A29E] line-through truncate">{task.name}</p>
                    </div>
                    {/* Deliverable link if present */}
                    {task.deliverableUrl && task.deliverableUrl.trim() && (
                      <a
                        href={task.deliverableUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#FFF0F7] text-[#FF1493] rounded text-[10px] font-medium hover:bg-[#FF1493] hover:text-white transition-colors shrink-0"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                        {getDisplayLabel(task)}
                      </a>
                    )}
                    <button
                      onClick={() => updateTask(launch.id, task.id, { status: 'not_started', completedDate: null })}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-[#E7E5E4] text-[#57534E] rounded-lg text-[11px] font-medium hover:bg-[#FAFAF9] hover:border-[#D6D3D1] transition-all shrink-0"
                    >
                      <Undo2 className="w-3 h-3" />
                      Undo
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <h2 className="text-sm font-semibold text-[#57534E] uppercase tracking-wider mb-4">
          Upcoming Due Dates
        </h2>

        {tasksByDate.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E7E5E4] p-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-[#10B981] mx-auto mb-2" />
            <p className="text-sm text-[#A8A29E]">All caught up!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tasksByDate.map(group => (
              <div key={group.dateKey} className="bg-white rounded-xl border border-[#E7E5E4]">
                {/* Date header */}
                <div className={`px-4 py-2.5 border-b border-[#E7E5E4] flex items-center justify-between rounded-t-xl ${
                  group.isOverdue ? 'bg-red-50' : group.isToday ? 'bg-[#FFF0F7]' : 'bg-[#FAFAF9]'
                }`}>
                  <div className="flex items-center gap-2">
                    {group.isOverdue && <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626]" />}
                    {group.isToday && <span className="w-2 h-2 rounded-full bg-[#FF1493] pulse-dot" />}
                    <h3 className={`text-sm font-semibold ${
                      group.isOverdue ? 'text-[#DC2626]' : group.isToday ? 'text-[#FF1493]' : 'text-[#1B1464]'
                    }`}>
                      {group.label}
                      {group.isOverdue && ' — Overdue'}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {group.isOverdue && (
                      <button
                        onClick={() => handleRescheduleGroup(group)}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-[#DC2626]/30 text-[#DC2626] rounded-lg text-[10px] font-medium hover:bg-red-50 transition-colors"
                        title="Move all overdue tasks in this group to today"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Reschedule to Today
                      </button>
                    )}
                    <span className="text-[11px] text-[#A8A29E]">
                      {group.tasks.length} task{group.tasks.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Tasks */}
                <div className="divide-y divide-[#E7E5E4]">
                  {group.tasks.map(({ task, launch }) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      launch={launch}
                      isOverdue={group.isOverdue}
                      updateTask={updateTask}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right column */}
      <div className="space-y-6">
        {/* Ready to Start — dependency-based */}
        {readyToStartTasks.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-[#57534E] uppercase tracking-wider mb-3">Ready to Start</h2>
            <div className="bg-white rounded-xl border border-[#E7E5E4] divide-y divide-[#E7E5E4]">
              {readyToStartTasks.map(({ task, launch }) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-[#FAFAF9] transition-colors"
                  onClick={() => router.push(`/launch/${launch.id}?task=${task.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#1B1464] font-medium truncate">{task.name}</p>
                    <p className="text-[10px] text-[#A8A29E] truncate">{launch.name} · Due {task.dueDate ? format(parseISO(task.dueDate), 'MMM d') : '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Launch Progress */}
        <div>
          <h2 className="text-sm font-semibold text-[#57534E] uppercase tracking-wider mb-3">Active Launches</h2>
          <div className="space-y-3">
          {activeLaunches
            .filter(l => l.status !== 'launched')
            .sort((a, b) => a.launchDate.localeCompare(b.launchDate))
            .map(launch => {
              const progress = getLaunchProgress(launch);
              const daysUntil = getDaysUntilLaunch(launch);
              const nextTask = getNextTask(launch);

              return (
                <Link key={launch.id} href={`/launch/${launch.id}`} className="block">
                  <div className="bg-white rounded-xl border border-[#E7E5E4] p-3.5 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      {/* Product image */}
                      {launch.productImageUrl ? (
                        <img
                          src={launch.productImageUrl}
                          alt={launch.name}
                          className="w-10 h-10 rounded-lg object-cover shrink-0 bg-[#F5F5F4]"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center text-white text-xs font-bold"
                          style={{ background: getLaunchColor(launch) }}>
                          {launch.name.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <h3 className="text-sm font-semibold text-[#1B1464] truncate">{launch.name}</h3>
                          <span className={`text-[11px] font-bold whitespace-nowrap ml-2 ${
                            daysUntil < 0 ? 'text-[#DC2626]' : daysUntil <= 30 ? 'text-[#F59E0B]' : 'text-[#57534E]'
                          }`}>
                            {daysUntil < 0 ? `${Math.abs(daysUntil)}d past` : `${daysUntil}d`}
                          </span>
                        </div>

                        {/* Launch dates — scannable */}
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mb-1.5">
                          <span className="text-[10px] text-[#57534E]">
                            DTC {format(parseISO(launch.launchDate), 'MMM d')}
                          </span>
                          {launch.sephoraLaunchDate && (
                            <span className="text-[10px] text-[#14B8A6]">
                              Sephora {format(parseISO(launch.sephoraLaunchDate), 'MMM d')}
                            </span>
                          )}
                          {launch.amazonLaunchDate && (
                            <span className="text-[10px] text-[#F97316]">
                              Amazon {format(parseISO(launch.amazonLaunchDate), 'MMM d')}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="flex-1 h-1.5 bg-[#F5F5F4] rounded-full overflow-hidden">
                            <div className="h-full rounded-full progress-fill bg-[#FF1493]" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="text-[10px] text-[#A8A29E] w-7 text-right">{progress}%</span>
                        </div>

                        {nextTask && (
                          <div className="flex items-center gap-1.5 text-[10px] text-[#57534E]">
                            <ArrowRight className="w-2.5 h-2.5 text-[#FF1493]" />
                            <span className="truncate">Next: {nextTask.name}</span>
                            {nextTask.dueDate && (
                              <span className="text-[#A8A29E] whitespace-nowrap ml-auto">
                                {format(parseISO(nextTask.dueDate), 'MMM d')}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const TASK_STATUSES: { value: TaskStatus; label: string; color: string; icon: React.ReactNode }[] = [
  { value: 'not_started', label: 'Not Started', color: '#6B7280', icon: <Circle className="w-3.5 h-3.5" /> },
  { value: 'in_progress', label: 'In Progress', color: '#3B82F6', icon: <Clock className="w-3.5 h-3.5" /> },
  { value: 'blocked', label: 'Stuck', color: '#EF4444', icon: <Pause className="w-3.5 h-3.5" /> },
  { value: 'waiting_review', label: 'Waiting for Review', color: '#F59E0B', icon: <Eye className="w-3.5 h-3.5" /> },
  { value: 'complete', label: 'Completed', color: '#10B981', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
];

function TaskRow({ task, launch, isOverdue, updateTask }: {
  task: GTMTask;
  launch: Launch;
  isOverdue: boolean;
  updateTask: (launchId: string, taskId: string, updates: Partial<GTMTask>) => void;
}) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState(task.deliverableUrl || '');
  const [linkLabel, setLinkLabel] = useState(task.deliverableLabel || '');
  const statusRef = useRef<HTMLDivElement>(null);
  const linkRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false);
      if (linkRef.current && !linkRef.current.contains(e.target as Node)) setLinkOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const deliverableLabel = DELIVERABLE_TASKS[task.name];
  const hasLink = task.deliverableUrl && task.deliverableUrl.trim() !== '';
  const currentStatus = TASK_STATUSES.find(s => s.value === task.status) || TASK_STATUSES[0];

  function handleStatusChange(status: TaskStatus) {
    const updates: Partial<GTMTask> = { status };
    if (status === 'complete') {
      updates.completedDate = new Date().toISOString().split('T')[0];
    } else {
      updates.completedDate = null;
    }
    updateTask(launch.id, task.id, updates);
    setStatusOpen(false);
  }

  function handleLinkSave() {
    updateTask(launch.id, task.id, {
      deliverableUrl: linkValue.trim(),
      deliverableLabel: linkLabel.trim() || undefined,
    });
    setLinkOpen(false);
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAF9] transition-colors group border-t border-[#E7E5E4] first:border-t-0">
      {/* Status pill dropdown */}
      <div className="relative shrink-0" ref={statusRef}>
        <button
          onClick={() => setStatusOpen(!statusOpen)}
          className="flex items-center gap-1.5 rounded-full pl-1.5 pr-2 py-1 border transition-colors hover:shadow-sm"
          style={{
            color: currentStatus.color,
            borderColor: currentStatus.color + '40',
            background: currentStatus.color + '10',
          }}
        >
          {currentStatus.icon}
          <span className="text-[10px] font-semibold whitespace-nowrap">{currentStatus.label}</span>
          <ChevronDown className="w-2.5 h-2.5 opacity-60" />
        </button>

        {statusOpen && (
          <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg border border-[#E7E5E4] shadow-lg py-1 w-[200px] animate-fade-in">
            {TASK_STATUSES.map(s => (
              <button
                key={s.value}
                onClick={() => handleStatusChange(s.value)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-[#FAFAF9] transition-colors ${
                  task.status === s.value ? 'bg-[#FAFAF9] font-semibold' : ''
                }`}
              >
                <span style={{ color: s.color }}>{s.icon}</span>
                <span className="text-[#1B1464]">{s.label}</span>
                {task.status === s.value && <CheckCircle2 className="w-3 h-3 ml-auto text-[#FF1493]" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Task name + launch name prominent */}
      <Link href={`/launch/${launch.id}?task=${task.id}`} className="flex-1 min-w-[180px]">
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 mb-1"
          style={{ background: getLaunchColor(launch) + '15', color: getLaunchColor(launch) }}
        >
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: getLaunchColor(launch) }} />
          {launch.name}
        </span>
        <p className="text-sm text-[#1B1464] font-medium truncate">{task.name}</p>
      </Link>

      {/* Deliverable link / add link */}
      {deliverableLabel && (
        <div className="relative shrink-0" ref={linkRef}>
          {hasLink ? (
            <a
              href={task.deliverableUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#FFF0F7] text-[#FF1493] rounded text-[10px] font-medium hover:bg-[#FF1493] hover:text-white transition-colors max-w-[180px]"
              title={`Open ${getDisplayLabel(task)}`}
            >
              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{getDisplayLabel(task)}</span>
            </a>
          ) : (
            <button
              onClick={() => setLinkOpen(!linkOpen)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#F5F5F4] text-[#A8A29E] rounded text-[10px] font-medium hover:bg-[#FFF0F7] hover:text-[#FF1493] transition-colors"
              title={`Add link for ${deliverableLabel}`}
            >
              <Plus className="w-2.5 h-2.5" />
              {deliverableLabel}
            </button>
          )}

          {linkOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg border border-[#E7E5E4] shadow-lg p-3 w-[320px] animate-fade-in">
              <label className="text-[11px] font-medium text-[#57534E] mb-1.5 block">
                Link for {deliverableLabel}
              </label>
              <input
                type="url"
                value={linkValue}
                onChange={(e) => setLinkValue(e.target.value)}
                placeholder="https://..."
                className="w-full px-2.5 py-1.5 border border-[#E7E5E4] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#FF1493]/20 focus:border-[#FF1493] mb-2"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleLinkSave(); if (e.key === 'Escape') setLinkOpen(false); }}
              />
              <label className="text-[11px] font-medium text-[#57534E] mb-1 block">
                File name (optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={linkLabel}
                  onChange={(e) => setLinkLabel(e.target.value)}
                  placeholder={`e.g. "Q1 Marketing Deck v3"`}
                  className="flex-1 px-2.5 py-1.5 border border-[#E7E5E4] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#FF1493]/20 focus:border-[#FF1493]"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleLinkSave(); if (e.key === 'Escape') setLinkOpen(false); }}
                />
                <button
                  onClick={handleLinkSave}
                  disabled={!linkValue.trim()}
                  className="px-3 py-1.5 bg-[#FF1493] text-white text-xs font-medium rounded-lg hover:bg-[#D4117D] transition-colors disabled:opacity-40"
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Owner tag */}
      <span
        className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
        style={{ background: OWNER_COLORS[task.owner] + '15', color: OWNER_COLORS[task.owner] }}
      >
        {OWNER_LABELS[task.owner]}
      </span>

      <Link href={`/launch/${launch.id}`} className="shrink-0">
        <ChevronRight className="w-4 h-4 text-[#D6D3D1] group-hover:text-[#FF1493]" />
      </Link>
    </div>
  );
}

function LaunchesView({ activeLaunches }: { activeLaunches: Launch[] }) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-[#57534E] uppercase tracking-wider">Active Launches</h2>
      {activeLaunches
        .sort((a, b) => a.launchDate.localeCompare(b.launchDate))
        .map(launch => <LaunchCard key={launch.id} launch={launch} />)
      }
    </div>
  );
}

function StatCard({ icon, label, value, bg, alert }: {
  icon: React.ReactNode; label: string; value: number | string; bg: string; alert?: boolean;
}) {
  return (
    <div className={`${bg} rounded-xl p-4 border border-transparent`}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs font-medium text-[#57534E]">{label}</span></div>
      <p className={`text-2xl font-bold ${alert ? 'text-[#DC2626]' : 'text-[#1B1464]'}`}>{value}</p>
    </div>
  );
}

function LaunchCard({ launch }: { launch: Launch }) {
  const progress = getLaunchProgress(launch);
  const daysUntil = getDaysUntilLaunch(launch);
  const nextTask = getNextTask(launch);
  const overdue = getOverdueTasks(launch);

  return (
    <Link href={`/launch/${launch.id}`} className="block">
      <div className="bg-white rounded-xl border border-[#E7E5E4] p-5 hover:shadow-md transition-shadow group">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ background: getLaunchColor(launch) }} />
              <h3 className="text-base font-semibold text-[#1B1464]">{launch.name}</h3>
            </div>
            <div className="flex items-center gap-3 text-xs text-[#A8A29E]">
              <span>{LAUNCH_TYPE_LABELS[launch.launchType]}</span>
              <span>·</span>
              <span>{launch.productCategory || 'No category'}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                style={{ background: getLaunchColor(launch) + '15', color: getLaunchColor(launch) }}
              >
                Tier {launch.tier}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-lg font-bold ${daysUntil < 0 ? 'text-[#DC2626]' : daysUntil <= 14 ? 'text-[#F59E0B]' : 'text-[#1B1464]'}`}>
              {daysUntil < 0 ? `${Math.abs(daysUntil)}d past` : `${daysUntil}d`}
            </p>
            <p className="text-[11px] text-[#A8A29E]">{format(parseISO(launch.launchDate), 'MMM d, yyyy')}</p>
          </div>
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-[#57534E]">{progress}% complete</span>
            {overdue.length > 0 && (
              <span className="text-[11px] text-[#DC2626] font-medium">{overdue.length} overdue</span>
            )}
          </div>
          <div className="h-1.5 bg-[#F5F5F4] rounded-full overflow-hidden">
            <div className="h-full rounded-full progress-fill" style={{ width: `${progress}%`, background: overdue.length > 0 ? '#F59E0B' : '#FF1493' }} />
          </div>
        </div>

        <div className="flex gap-1 mb-3">
          {PHASES.map(phase => {
            const phaseTasks = launch.tasks.filter(t => t.phase === phase.key);
            if (phaseTasks.length === 0) return null;
            const phaseComplete = phaseTasks.filter(t => t.status === 'complete' || t.status === 'skipped').length;
            return (
              <div key={phase.key} className="flex-1" title={phase.name}>
                <div className="h-1 rounded-full"
                  style={{
                    background: phaseComplete === phaseTasks.length ? phase.color
                      : phaseComplete > 0 ? `linear-gradient(to right, ${phase.color} ${(phaseComplete/phaseTasks.length)*100}%, #E7E5E4 0%)`
                      : '#E7E5E4',
                  }}
                />
                <p className="text-[9px] text-[#A8A29E] mt-1 truncate">{phase.name}</p>
              </div>
            );
          })}
        </div>

        {nextTask && (
          <div className="flex items-center justify-between bg-[#FAFAF9] rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <ArrowRight className="w-3.5 h-3.5 text-[#FF1493] shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#1B1464] truncate">Next: {nextTask.name}</p>
                <p className="text-[11px] text-[#A8A29E]">{getPhaseName(nextTask.phase)} · Due {nextTask.dueDate ? format(parseISO(nextTask.dueDate), 'MMM d') : '—'}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#D6D3D1] group-hover:text-[#FF1493] transition-colors" />
          </div>
        )}
      </div>
    </Link>
  );
}
