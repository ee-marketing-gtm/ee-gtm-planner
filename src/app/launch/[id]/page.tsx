'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { format, parseISO, addBusinessDays, differenceInBusinessDays } from 'date-fns';
import {
  ArrowLeft, CheckCircle2, Circle, Clock, AlertTriangle,
  ChevronDown, ChevronRight, Trash2, RotateCcw, Plus, Pencil, Archive,
  Eye, Pause, Calendar, Settings2, Check
} from 'lucide-react';
import Link from 'next/link';
import { Launch, GTMTask, PHASES, PhaseKey, OWNER_LABELS, OWNER_COLORS, TIER_CONFIG, TaskStatus, DELIVERABLE_TASKS, Owner } from '@/lib/types';
import { ExternalLink, Link2 as LinkIcon, Sparkles } from 'lucide-react';
import { isAfter, startOfDay } from 'date-fns';
import { useData } from '@/components/DataProvider';
import { getLaunchProgress, getPhaseProgress, getDaysUntilLaunch, getStatusColor, getPhaseName } from '@/lib/utils';
import GanttChart from '@/components/GanttChart';
import { recalculateTimeline, calculateEarlyFinishRedistribution, TaskDateChange } from '@/lib/recalculate';
import { scheduleLaunch } from '@/lib/scheduler';
import { scheduledTasksToGTMTasks } from '@/lib/scheduler-bridge';
import { RefreshCw, AlertCircle, X } from 'lucide-react';

function getDisplayLabel(task: GTMTask): string {
  if (task.deliverableLabel && task.deliverableLabel.trim()) return task.deliverableLabel;
  if (task.deliverableUrl && task.deliverableUrl.trim()) {
    try {
      const url = new URL(task.deliverableUrl);
      const segments = url.pathname.split('/').filter(Boolean);
      const last = segments[segments.length - 1];
      if (last && last.includes('.') && last.length < 80) return decodeURIComponent(last);
    } catch {}
  }
  return DELIVERABLE_TASKS[task.name] || 'Link';
}

const STATUS_OPTIONS: { value: TaskStatus; label: string; color: string; icon: React.ReactNode }[] = [
  { value: 'not_started', label: 'Not Started', color: '#6B7280', icon: <Circle className="w-3.5 h-3.5" /> },
  { value: 'in_progress', label: 'In Progress', color: '#3B82F6', icon: <Clock className="w-3.5 h-3.5" /> },
  { value: 'blocked', label: 'Stuck', color: '#EF4444', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  { value: 'waiting_review', label: 'Waiting for Review', color: '#F59E0B', icon: <Eye className="w-3.5 h-3.5" /> },
  { value: 'complete', label: 'Completed', color: '#10B981', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
];

type Tab = 'tracker' | 'files' | 'meetings' | 'timeline';

export default function LaunchDetail() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { launches, saveLaunch, deleteLaunch, loading } = useData();
  const initialTaskId = searchParams.get('task');
  const [launch, setLaunch] = useState<Launch | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('tracker');
  const [expandedPhases, setExpandedPhases] = useState<Set<PhaseKey>>(new Set(PHASES.map(p => p.key)));
  const [mounted, setMounted] = useState(false);
  const [recalcResult, setRecalcResult] = useState<{ daysLate: number; daysAbsorbed: number; impossible: boolean; warnings: string[]; changes: TaskDateChange[]; pendingTasks?: import('@/lib/types').GTMTask[] } | null>(null);
  const [preRecalcTasks, setPreRecalcTasks] = useState<import('@/lib/types').GTMTask[] | null>(null);
  const [cascadeWarning, setCascadeWarning] = useState<{
    triggerTaskId: string;
    pendingTasks: import('@/lib/types').GTMTask[];
    originalPendingTasks: import('@/lib/types').GTMTask[]; // snapshot before any quick fixes
    chainTaskIds: string[]; // ordered dependency chain from trigger to over-launch tasks
    overCount: number;
    maxDaysOver: number;
    originalOverTaskIds: string[]; // tasks that were over before quick fixes
    hasFixes: boolean; // whether any quick fixes have been applied
  } | null>(null);
  const [highlightedTaskIds, setHighlightedTaskIds] = useState<Set<string>>(new Set());
  const [scrollToTaskId, setScrollToTaskId] = useState<string | null>(null);
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);
  const undoStackRef = useRef<import('@/lib/types').GTMTask[][]>([]);
  const [undoToast, setUndoToast] = useState<string | null>(null);
  const undoToastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [customHex, setCustomHex] = useState(launch?.brandColor || '');
  const [imageUrlInput, setImageUrlInput] = useState(launch?.productImageUrl || '');

  const foundLaunch = launches.find(l => l.id === params.id);

  useEffect(() => {
    if (foundLaunch) {
      setLaunch(foundLaunch);
      setCustomHex(foundLaunch.brandColor || '');
      setImageUrlInput(foundLaunch.productImageUrl || '');
    }
    setMounted(true);
  }, [foundLaunch]);

  const updateLaunch = useCallback((updated: Launch) => {
    // Push current tasks to undo stack before applying changes
    if (launch?.tasks) {
      undoStackRef.current = [...undoStackRef.current.slice(-19), launch.tasks];
    }
    setLaunch(updated);
    saveLaunch(updated);
  }, [launch]);

  const togglePhase = (phase: PhaseKey) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase);
      else next.add(phase);
      return next;
    });
  };

  const handleUndo = useCallback(() => {
    if (!launch || undoStackRef.current.length === 0) return;
    const previousTasks = undoStackRef.current.pop()!;
    const restored = { ...launch, tasks: previousTasks, updatedAt: new Date().toISOString() };
    setLaunch(restored);
    saveLaunch(restored);
    setUndoToast('Change undone');
    if (undoToastTimerRef.current) clearTimeout(undoToastTimerRef.current);
    undoToastTimerRef.current = setTimeout(() => setUndoToast(null), 2500);
  }, [launch]);

  // Ctrl+Z / Cmd+Z keyboard shortcut
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        // Don't intercept if user is typing in an input
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        handleUndo();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [handleUndo]);

  const updateTaskNotes = (taskId: string, notes: string) => {
    if (!launch) return;
    const updated = {
      ...launch,
      tasks: launch.tasks.map(t => t.id === taskId ? { ...t, notes } : t),
    };
    updateLaunch(updated);
  };

  const handleDelete = () => {
    if (!launch) return;
    if (confirm(`Delete "${launch.name}"? This cannot be undone.`)) {
      deleteLaunch(launch.id);
      router.push('/');
    }
  };

  const handleArchive = () => {
    if (!launch) return;
    updateLaunch({ ...launch, status: 'post_launch' });
    router.push('/archive');
  };

  // Flash highlight on changed tasks and scroll to the furthest-moved one
  const flashChangedTasks = useCallback((changedIds: Set<string>, scrollTo?: string) => {
    if (changedIds.size === 0) return;
    setHighlightedTaskIds(changedIds);
    if (scrollTo) setScrollToTaskId(scrollTo);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedTaskIds(new Set());
      setScrollToTaskId(null);
    }, 5000);
  }, []);

  const updateTaskField = useCallback((taskId: string, updates: Partial<GTMTask>) => {
    if (!launch) return;

    // If dependencies changed, recalculate this task's dates and cascade downstream
    if ('dependencies' in updates) {
      const taskMap = new Map(launch.tasks.map(t => [t.id, { ...t }]));
      const task = taskMap.get(taskId)!;
      Object.assign(task, updates);

      // Recalculate this task's start/due based on new dependencies
      if (task.dependencies.length > 0) {
        const latestDepDue = task.dependencies.reduce((latest, dId) => {
          const d = taskMap.get(dId);
          if (!d) return latest;
          const endDate = (d.status === 'complete' || d.status === 'skipped')
            ? (d.completedDate?.split('T')[0] || d.dueDate || '') : (d.dueDate || '');
          return endDate > latest ? endDate : latest;
        }, '');
        if (latestDepDue) {
          const newStart = parseISO(latestDepDue);
          const dur = task.durationDays || 1;
          task.startDate = format(newStart, 'yyyy-MM-dd');
          task.dueDate = format(addBusinessDays(newStart, Math.max(0, dur)), 'yyyy-MM-dd');
        }
      }

      // BFS cascade downstream from this task
      const dependentsOf = new Map<string, string[]>();
      for (const t of launch.tasks) {
        for (const depId of (t.id === taskId ? task.dependencies : t.dependencies)) {
          if (!dependentsOf.has(depId)) dependentsOf.set(depId, []);
          dependentsOf.get(depId)!.push(t.id);
        }
      }
      const queue = [taskId];
      const visited = new Set<string>([taskId]);
      while (queue.length > 0) {
        const currentId = queue.shift()!;
        const deps = dependentsOf.get(currentId) || [];
        for (const depId of deps) {
          if (visited.has(depId)) continue;
          const depTask = taskMap.get(depId)!;
          if (!depTask.dueDate) continue;
          const latestDepDue = depTask.dependencies.reduce((latest, dId) => {
            const d = taskMap.get(dId);
            if (!d) return latest;
            const endDate = d.dueDate || '';
            return endDate > latest ? endDate : latest;
          }, '');
          if (!latestDepDue) continue;
          const newStart = parseISO(latestDepDue);
          const dur = depTask.durationDays || 1;
          const newStartStr = format(newStart, 'yyyy-MM-dd');
          const newDueStr = format(addBusinessDays(newStart, Math.max(0, dur)), 'yyyy-MM-dd');
          if (depTask.startDate !== newStartStr || depTask.dueDate !== newDueStr) {
            depTask.startDate = newStartStr;
            depTask.dueDate = newDueStr;
            visited.add(depId);
            queue.push(depId);
          }
        }
      }

      const cascadedIds = new Set(Array.from(visited).filter(id => id !== taskId));
      updateLaunch({ ...launch, tasks: Array.from(taskMap.values()) });
      if (cascadedIds.size > 0) flashChangedTasks(cascadedIds);
      return;
    }

    const updated = {
      ...launch,
      tasks: launch.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t),
    };
    updateLaunch(updated);
  }, [launch, updateLaunch, flashChangedTasks]);

  const updateTaskStatus = useCallback((taskId: string, status: TaskStatus) => {
    if (!launch) return;
    const wasComplete = launch.tasks.find(t => t.id === taskId)?.status === 'complete';
    const isNowComplete = status === 'complete';
    const completedDate = isNowComplete ? new Date().toISOString() : null;

    // Build task map with the status change applied
    const taskMap = new Map(launch.tasks.map(t => [t.id, { ...t }]));
    const changedTask = taskMap.get(taskId)!;
    changedTask.status = status;
    changedTask.completedDate = completedDate;

    // If completing or uncompleting, recalculate downstream tasks
    // because the effective end date for this task changes
    if (wasComplete !== isNowComplete) {
      const dependentsOf = new Map<string, string[]>();
      for (const t of launch.tasks) {
        for (const depId of t.dependencies) {
          if (!dependentsOf.has(depId)) dependentsOf.set(depId, []);
          dependentsOf.get(depId)!.push(t.id);
        }
      }

      // BFS cascade from the status-changed task
      const queue = [taskId];
      const visited = new Set<string>([taskId]);
      while (queue.length > 0) {
        const currentId = queue.shift()!;
        const deps = dependentsOf.get(currentId) || [];
        for (const depId of deps) {
          if (visited.has(depId)) continue;
          const depTask = taskMap.get(depId)!;
          if (!depTask.dueDate) continue;
          // Find latest dep end date (use completedDate for complete/skipped tasks)
          const latestDepDue = depTask.dependencies.reduce((latest, dId) => {
            const d = taskMap.get(dId);
            if (!d) return latest;
            const endDate = d.dueDate || '';
            return endDate > latest ? endDate : latest;
          }, '');
          if (!latestDepDue) continue;
          const newStart = parseISO(latestDepDue);
          const dur = depTask.durationDays || 1;
          const newDue = addBusinessDays(newStart, Math.max(0, dur));
          const newStartStr = format(newStart, 'yyyy-MM-dd');
          const newDueStr = format(newDue, 'yyyy-MM-dd');
          if (depTask.startDate !== newStartStr || depTask.dueDate !== newDueStr) {
            depTask.startDate = newStartStr;
            depTask.dueDate = newDueStr;
            visited.add(depId);
            queue.push(depId);
          }
        }
      }

      const cascadedIds = new Set(Array.from(visited).filter(id => id !== taskId));
      const newTasks = Array.from(taskMap.values());
      updateLaunch({ ...launch, tasks: newTasks });
      if (cascadedIds.size > 0) flashChangedTasks(cascadedIds);
    } else {
      updateLaunch({ ...launch, tasks: Array.from(taskMap.values()) });
    }
  }, [launch, updateLaunch, flashChangedTasks]);

  // Cascade due dates through dependency graph when a task's date changes
  // extraUpdates: optional additional field changes to apply to the source task (e.g. durationDays from lead time stepper)
  const updateTaskDateWithCascade = useCallback((taskId: string, newDate: string, extraUpdates?: Partial<GTMTask>) => {
    if (!launch) return;
    const task = launch.tasks.find(t => t.id === taskId);
    if (!task) return;
    if (!task.dueDate) {
      updateTaskField(taskId, { dueDate: newDate, ...extraUpdates });
      return;
    }
    if (newDate === task.dueDate && !extraUpdates) return;

    // Build task map and reverse dependency map (task → tasks that depend on it)
    const taskMap = new Map(launch.tasks.map(t => [t.id, { ...t }]));
    const dependentsOf = new Map<string, string[]>(); // taskId → [dependent task IDs]
    for (const t of launch.tasks) {
      for (const depId of t.dependencies) {
        if (!dependentsOf.has(depId)) dependentsOf.set(depId, []);
        dependentsOf.get(depId)!.push(t.id);
      }
    }

    // Apply changes to the source task
    const sourceTask = taskMap.get(taskId)!;
    const isLeadTimeChange = extraUpdates && 'durationDays' in extraUpdates;

    if (isLeadTimeChange) {
      // Lead time change: keep start date fixed, recalculate due date from start + new duration
      const newDuration = extraUpdates!.durationDays as number;
      sourceTask.durationDays = newDuration;
      if (sourceTask.startDate) {
        sourceTask.dueDate = format(addBusinessDays(parseISO(sourceTask.startDate), Math.max(0, newDuration)), 'yyyy-MM-dd');
      } else {
        // No start date — just set due date directly
        sourceTask.dueDate = newDate;
      }
    } else {
      // Manual date change: set due date, recalculate start = due - duration
      sourceTask.dueDate = newDate;
      if (sourceTask.startDate && sourceTask.durationDays != null) {
        sourceTask.startDate = format(addBusinessDays(parseISO(newDate), -sourceTask.durationDays), 'yyyy-MM-dd');
      }
    }
    // Apply any other extra field updates
    if (extraUpdates) {
      const { durationDays: _d, ...otherUpdates } = extraUpdates as Record<string, unknown>;
      if (Object.keys(otherUpdates).length > 0) Object.assign(sourceTask, otherUpdates);
    }

    // BFS: recalculate all downstream tasks through dependency graph
    // For each downstream task: start = max(all dep due dates), due = start + duration
    const queue = [taskId];
    const visited = new Set<string>([taskId]);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const deps = dependentsOf.get(currentId) || [];

      for (const depTaskId of deps) {
        if (visited.has(depTaskId)) continue;
        const depTask = taskMap.get(depTaskId)!;
        if (!depTask.dueDate) continue;

        // Find the latest dependency end date for this task
        // For completed/skipped deps, use completedDate so they don't block
        const latestDepDue = depTask.dependencies.reduce((latest, dId) => {
          const d = taskMap.get(dId);
          if (!d) return latest;
          const endDate = (d.status === 'complete' || d.status === 'skipped')
            ? (d.completedDate?.split('T')[0] || d.dueDate || '')
            : (d.dueDate || '');
          if (endDate > latest) return endDate;
          return latest;
        }, '');

        if (!latestDepDue) continue;

        // Recalculate: start = latest dep due, due = start + duration
        const newStart = parseISO(latestDepDue);
        const duration = depTask.durationDays || 1;
        const newDue = addBusinessDays(newStart, Math.max(0, duration));
        const newStartStr = format(newStart, 'yyyy-MM-dd');
        const newDueStr = format(newDue, 'yyyy-MM-dd');

        // Only cascade if dates actually changed
        if (depTask.startDate !== newStartStr || depTask.dueDate !== newDueStr) {
          depTask.startDate = newStartStr;
          depTask.dueDate = newDueStr;
          visited.add(depTaskId);
          queue.push(depTaskId);
        }
      }
    }

    // Check if any tasks NEWLY exceed launch dates (ignore ones already over before this change)
    const newTasks = Array.from(taskMap.values());
    const dtcLaunch = launch.launchDate ? parseISO(launch.launchDate) : null;
    const oldTaskMap = new Map(launch.tasks.map(t => [t.id, t]));

    const overTaskIds: string[] = [];
    for (const t of newTasks) {
      if (t.status === 'complete' || t.status === 'skipped' || !t.dueDate) continue;
      if (t.name === 'D2C Launch' || t.name === 'Sephora Launch') continue;
      const due = parseISO(t.dueDate);
      if (dtcLaunch && isAfter(due, dtcLaunch)) {
        const oldTask = oldTaskMap.get(t.id);
        const wasAlreadyOver = oldTask?.dueDate && isAfter(parseISO(oldTask.dueDate), dtcLaunch);
        const gotWorse = oldTask?.dueDate && t.dueDate > oldTask.dueDate;
        if (!wasAlreadyOver || gotWorse) {
          overTaskIds.push(t.id);
        }
      }
    }

    if (overTaskIds.length > 0) {
      // Build the chain: trigger task + all downstream tasks that were affected by the cascade
      // Also walk backwards from the trigger to include upstream tasks the user could compress
      const chainIds = new Set<string>();

      // 1. Include the trigger task
      chainIds.add(taskId);

      // 2. Walk backwards from trigger to include upstream dependencies (gives context)
      const backQueue = [taskId];
      const backVisited = new Set<string>([taskId]);
      while (backQueue.length > 0) {
        const cur = backQueue.shift()!;
        const curTask = taskMap.get(cur);
        if (!curTask) continue;
        for (const depId of curTask.dependencies) {
          if (backVisited.has(depId)) continue;
          backVisited.add(depId);
          const depTask = taskMap.get(depId);
          if (depTask && depTask.status !== 'complete' && depTask.status !== 'skipped') {
            chainIds.add(depId);
            // Only go back a few levels — we don't need the whole history
            // Stop if we've gone back 5 tasks
            if (chainIds.size < 8) backQueue.push(depId);
          }
        }
      }

      // 3. Include all downstream cascade-affected tasks (from visited set)
      for (const id of visited) {
        chainIds.add(id);
      }

      // 4. Also include any over tasks not already in the set
      for (const id of overTaskIds) {
        chainIds.add(id);
      }

      // Order chain by due date
      const chainTaskIds = Array.from(chainIds)
        .map(id => taskMap.get(id)!)
        .filter(t => t && t.name !== 'D2C Launch' && t.name !== 'Sephora Launch')
        .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
        .map(t => t.id);

      const maxDaysOver = overTaskIds.reduce((max, id) => {
        const t = taskMap.get(id)!;
        const days = dtcLaunch ? differenceInBusinessDays(parseISO(t.dueDate!), dtcLaunch) : 0;
        return Math.max(max, days);
      }, 0);

      setCascadeWarning({
        triggerTaskId: taskId,
        pendingTasks: newTasks,
        originalPendingTasks: newTasks,
        chainTaskIds,
        overCount: overTaskIds.length,
        maxDaysOver,
        originalOverTaskIds: overTaskIds,
        hasFixes: false,
      });
      return;
    }

    updateLaunch({ ...launch, tasks: newTasks });

    // Flash highlight on cascaded tasks (exclude the source task the user just edited)
    // Don't scroll — keep the user at their current position
    const cascadedIds = new Set(Array.from(visited).filter(id => id !== taskId));
    if (cascadedIds.size > 0) {
      flashChangedTasks(cascadedIds);
    }
  }, [launch, updateLaunch, updateTaskField, flashChangedTasks]);

  if (!mounted || loading) return <div className="p-8" />;
  if (!launch) return (
    <div className="p-8 text-center">
      <p className="text-[#A8A29E]">Launch not found.</p>
      <Link href="/" className="text-[#FF1493] text-sm mt-2 inline-block">Back to dashboard</Link>
    </div>
  );

  const progress = getLaunchProgress(launch);
  const daysUntil = getDaysUntilLaunch(launch);
  const accentColor = launch.brandColor || TIER_CONFIG[launch.tier].color;

  const PRESET_COLORS = [
    '#FF1493', '#EF4444', '#F59E0B', '#10B981', '#3B82F6',
    '#6366F1', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#1B1464',
  ];

  const deliverableCount = launch.tasks.filter(t => t.deliverableUrl && t.deliverableUrl.trim()).length;

  const meetingTasks = launch.tasks.filter(t => t.isMeeting);
  const TABS: { key: Tab; label: string; badge?: number }[] = [
    { key: 'tracker', label: 'Task Tracker' },
    { key: 'files', label: 'Files', badge: deliverableCount },
    { key: 'meetings', label: 'Meetings', badge: meetingTasks.length },
    { key: 'timeline', label: 'Timeline' },
  ];

  return (
    <div className="p-8 max-w-[1200px]">
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-xs text-[#A8A29E] hover:text-[#57534E] mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              {launch.productImageUrl ? (
                <img
                  src={launch.productImageUrl}
                  alt={launch.name}
                  className="w-12 h-12 rounded-lg object-cover border border-[#E7E5E4] shrink-0"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-lg font-bold shrink-0"
                  style={{ background: accentColor }}
                >
                  {launch.name.charAt(0).toUpperCase()}
                </div>
              )}
              <h1 className="text-2xl font-bold" style={{ color: launch.brandColor || '#1B1464' }}>{launch.name}</h1>
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                style={{
                  background: TIER_CONFIG[launch.tier].color + '15',
                  color: TIER_CONFIG[launch.tier].color,
                }}
              >
                Tier {launch.tier}
              </span>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-1.5 rounded-lg transition-colors ${showSettings ? 'bg-[#F5F5F4] text-[#1B1464]' : 'text-[#A8A29E] hover:text-[#57534E] hover:bg-[#F5F5F4]'}`}
                title="Launch settings"
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
            {launch.description && (
              <p className="text-sm text-[#57534E] mb-2">{launch.description}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-[#A8A29E]">
              <span>Launch: {format(parseISO(launch.launchDate), 'MMMM d, yyyy')}</span>
              <span>·</span>
              <span>{launch.productCategory || 'No category'}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className={`text-2xl font-bold ${daysUntil < 0 ? 'text-[#DC2626]' : daysUntil <= 14 ? 'text-[#F59E0B]' : ''}`} style={daysUntil >= 15 ? { color: accentColor } : undefined}>
                {daysUntil < 0 ? `${Math.abs(daysUntil)}d past` : `${daysUntil} days`}
              </p>
              <p className="text-[11px] text-[#A8A29E]">until launch</p>
            </div>
            <button
              onClick={handleArchive}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#E7E5E4] text-[#57534E] rounded-lg text-xs font-medium hover:bg-[#F5F5F4] transition-colors"
              title="Move to archive"
            >
              <Archive className="w-3.5 h-3.5" />
              Archive
            </button>
            <button onClick={handleDelete} className="p-2 rounded-lg hover:bg-red-50 text-[#D6D3D1] hover:text-[#DC2626] transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-4 bg-white rounded-xl border border-[#E7E5E4] p-5 animate-fade-in space-y-5">
            <h3 className="text-sm font-semibold text-[#1B1464]">Launch Customization</h3>

            {/* Brand Color */}
            <div>
              <label className="block text-[11px] font-medium text-[#57534E] mb-2">Brand Color</label>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {PRESET_COLORS.map(color => {
                  const isSelected = launch.brandColor === color;
                  return (
                    <button
                      key={color}
                      onClick={() => {
                        setCustomHex(color);
                        updateLaunch({ ...launch, brandColor: color });
                      }}
                      className="relative w-7 h-7 rounded-full border-2 transition-all"
                      style={{
                        background: color,
                        borderColor: isSelected ? '#1B1464' : 'transparent',
                        boxShadow: isSelected ? '0 0 0 2px white, 0 0 0 4px ' + color : undefined,
                      }}
                      title={color}
                    >
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-white absolute inset-0 m-auto" />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-[#A8A29E]">Custom:</label>
                <input
                  type="text"
                  value={customHex}
                  onChange={e => setCustomHex(e.target.value)}
                  onBlur={() => {
                    if (/^#[0-9A-Fa-f]{6}$/.test(customHex)) {
                      updateLaunch({ ...launch, brandColor: customHex });
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && /^#[0-9A-Fa-f]{6}$/.test(customHex)) {
                      updateLaunch({ ...launch, brandColor: customHex });
                    }
                  }}
                  placeholder="#FF1493"
                  className="w-24 px-2 py-1 border border-[#E7E5E4] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#FF1493]/20 font-mono"
                />
                {customHex && /^#[0-9A-Fa-f]{6}$/.test(customHex) && (
                  <div className="w-5 h-5 rounded-full border border-[#E7E5E4]" style={{ background: customHex }} />
                )}
                {launch.brandColor && (
                  <button
                    onClick={() => {
                      setCustomHex('');
                      updateLaunch({ ...launch, brandColor: undefined });
                    }}
                    className="text-[11px] text-[#A8A29E] hover:text-[#57534E] ml-2 transition-colors"
                  >
                    Reset to tier default
                  </button>
                )}
              </div>
            </div>

            {/* Regenerate Tasks from Template */}
            <div>
              <label className="block text-[11px] font-medium text-[#57534E] mb-2">Task Template</label>
              <p className="text-[11px] text-[#A8A29E] mb-2">
                Re-run the scheduler with the latest task template. Preserves status, notes, and links on tasks that still exist. Adds new tasks, removes deleted ones.
              </p>
              <button
                onClick={() => {
                  if (!confirm('Regenerate all tasks from the latest template? Your status, notes, links, and dates will be preserved on all existing tasks.')) return;
                  const result = scheduleLaunch({
                    dtcLaunchDate: launch.launchDate,
                    sephoraLaunchDate: launch.sephoraLaunchDate || undefined,
                    amazonLaunchDate: launch.amazonLaunchDate || undefined,
                    externalAnchors: launch.externalAnchors || undefined,
                  });
                  const freshTasks = scheduledTasksToGTMTasks(result.tasks);

                  // Build lookup from old tasks by name
                  const oldByName = new Map(launch.tasks.map(t => [t.name, t]));

                  // Rename mappings: old task name → new task names that should inherit its state
                  const renameMappings: Record<string, string[]> = {
                    'Photo Selects Ready': ['Lifestyle Photo Selects Ready', 'Product Photo Selects Ready'],
                    'Sephora Final Assets Due': ['Sephora Final Assets Ready'],
                    'Draft Sephora Catalog & PDP Copy Due': ['Draft Sephora Catalog Copy'],
                    'Draft Sephora Catalog & PDP Copy Ready': ['Draft Sephora Catalog Copy'],
                    'Final Sephora Catalog & PDP Copy': ['Final Sephora Catalog Copy'],
                    'Sephora Catalog & PDP Copy Review': ['Final Sephora Catalog Copy'],
                    'Finalize Influencer Strategy': ['Finalize Influencer Strategy & Start Sourcing Creators'],
                    'Start Sourcing Creators': ['Finalize Influencer Strategy & Start Sourcing Creators'],
                    'D2C Launch Complete': ['D2C Launch'],
                    'Sephora Launch Complete': ['Sephora Launch'],
                  };
                  // Build reverse: new name → old name
                  const renameReverse = new Map<string, string>();
                  for (const [oldName, newNames] of Object.entries(renameMappings)) {
                    for (const newName of newNames) {
                      if (oldByName.has(oldName) && !oldByName.has(newName)) {
                        renameReverse.set(newName, oldName);
                      }
                    }
                  }

                  const mergedTasks = freshTasks.map(ft => {
                    const old = oldByName.get(ft.name) || (renameReverse.has(ft.name) ? oldByName.get(renameReverse.get(ft.name)!) : undefined);
                    if (!old) return ft;

                    return {
                      ...ft,
                      status: old.status,
                      completedDate: old.completedDate,
                      notes: old.notes || ft.notes,
                      deliverableUrl: old.deliverableUrl || ft.deliverableUrl,
                      deliverableLabel: old.deliverableLabel,
                      // Preserve user's dates — regenerate is for picking up new tasks/deps, not resetting dates
                      dueDate: old.dueDate || ft.dueDate,
                      startDate: old.startDate || ft.startDate,
                    };
                  });
                  updateLaunch({ ...launch, tasks: mergedTasks, updatedAt: new Date().toISOString() });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#3D4EDB] text-white rounded-lg text-xs font-medium hover:bg-[#3040c0] transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Regenerate Tasks from Template
              </button>
            </div>

            {/* Product Image */}
            <div>
              <label className="block text-[11px] font-medium text-[#57534E] mb-2">Product Image</label>
              <div className="flex items-center gap-3">
                <input
                  type="url"
                  value={imageUrlInput}
                  onChange={e => setImageUrlInput(e.target.value)}
                  onBlur={() => {
                    if (imageUrlInput !== (launch.productImageUrl || '')) {
                      updateLaunch({ ...launch, productImageUrl: imageUrlInput || undefined });
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && imageUrlInput !== (launch.productImageUrl || '')) {
                      updateLaunch({ ...launch, productImageUrl: imageUrlInput || undefined });
                    }
                  }}
                  placeholder="Paste image URL..."
                  className="flex-1 px-3 py-1.5 border border-[#E7E5E4] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#FF1493]/20"
                />
                {launch.productImageUrl && (
                  <button
                    onClick={() => {
                      setImageUrlInput('');
                      updateLaunch({ ...launch, productImageUrl: undefined });
                    }}
                    className="text-[11px] text-[#DC2626] hover:text-[#B91C1C] transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
              {launch.productImageUrl && (
                <div className="mt-2">
                  <img
                    src={launch.productImageUrl}
                    alt="Product preview"
                    className="w-16 h-16 rounded-lg object-cover border border-[#E7E5E4]"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Progress */}
        <div className="mt-4 bg-white rounded-xl border border-[#E7E5E4] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[#1B1464]">Overall Progress</span>
            <span className="text-sm font-bold" style={{ color: accentColor }}>{progress}%</span>
          </div>
          <div className="h-2 bg-[#F5F5F4] rounded-full overflow-hidden mb-3">
            <div className="h-full rounded-full progress-fill" style={{ width: `${progress}%`, background: accentColor }} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {PHASES.map(phase => {
              const phaseTasks = launch.tasks.filter(t => t.phase === phase.key);
              if (phaseTasks.length === 0) return (
                <div key={phase.key} className="text-center">
                  <p className="text-[11px] text-[#A8A29E] mb-1">{phase.name}</p>
                  <p className="text-xs text-[#D6D3D1]">N/A</p>
                </div>
              );
              const pp = getPhaseProgress(launch, phase.key);
              return (
                <div key={phase.key}>
                  <p className="text-[11px] text-[#A8A29E] mb-1">{phase.name}</p>
                  <div className="h-1 bg-[#F5F5F4] rounded-full overflow-hidden">
                    <div className="h-full rounded-full progress-fill" style={{ width: `${pp}%`, background: phase.color }} />
                  </div>
                  <p className="text-[11px] font-medium mt-0.5" style={{ color: phase.color }}>{pp}%</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recalculate Timeline */}
        {(() => {
          const overdueTasks = launch.tasks.filter(t =>
            t.status !== 'complete' && t.status !== 'skipped' && t.dueDate &&
            parseISO(t.dueDate) < new Date() && !recalcResult
          );
          if (overdueTasks.length === 0 && !recalcResult) return null;

          return recalcResult ? (() => {
            const largestShift = recalcResult.changes.length > 0
              ? recalcResult.changes.reduce((max, c) => Math.abs(c.daysMoved) > Math.abs(max.daysMoved) ? c : max, recalcResult.changes[0])
              : null;

            return (
            <div className={`mt-3 rounded-xl border p-4 ${recalcResult.impossible ? 'bg-red-50 border-red-200' : 'bg-[#FFF0F7] border-[#FF1493]/20'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {recalcResult.impossible ? (
                    <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
                  ) : (
                    <RefreshCw className="w-4 h-4 text-[#FF1493] shrink-0" />
                  )}
                  <div>
                    {recalcResult.impossible ? (
                      <p className="text-sm font-medium text-[#DC2626]">
                        Cannot fit timeline before launch date
                      </p>
                    ) : (
                      <p className="text-sm text-[#1B1464]">
                        <span className="font-medium text-[#FF1493]">Timeline recalculated</span>
                        {' — '}
                        <span className="text-[#57534E]">
                          {recalcResult.changes.length} task{recalcResult.changes.length !== 1 ? 's' : ''} shifted
                          {largestShift && (
                            <>, largest move: <span className="font-medium">{largestShift.taskName}</span> <span className="text-[#F59E0B]">+{largestShift.daysMoved}d</span></>
                          )}
                        </span>
                      </p>
                    )}
                    {recalcResult.impossible && (
                      <p className="text-xs text-[#92400E] mt-0.5">
                        Tasks would need to extend {recalcResult.daysLate} business day{recalcResult.daysLate !== 1 ? 's' : ''} past the launch date. Consider extending the launch date or reducing task durations.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {recalcResult.impossible && recalcResult.pendingTasks && (
                    <button
                      onClick={() => {
                        updateLaunch({ ...launch, tasks: recalcResult.pendingTasks! });
                        setRecalcResult({ ...recalcResult, impossible: false, pendingTasks: undefined });
                      }}
                      className="px-3 py-1.5 bg-[#DC2626] text-white text-xs font-medium rounded-lg hover:bg-[#B91C1C] transition-colors"
                    >
                      Apply Anyway
                    </button>
                  )}
                  {preRecalcTasks && !recalcResult.impossible && (
                    <button
                      onClick={() => {
                        updateLaunch({ ...launch, tasks: preRecalcTasks });
                        setPreRecalcTasks(null);
                        setRecalcResult(null);
                      }}
                      className="px-3 py-1.5 border border-[#E7E5E4] text-[#57534E] text-xs font-medium rounded-lg hover:bg-[#F5F5F4] transition-colors"
                    >
                      Undo
                    </button>
                  )}
                  <button onClick={() => { setRecalcResult(null); if (!recalcResult.impossible) setPreRecalcTasks(null); }} className="px-3 py-1.5 bg-[#FF1493] text-white text-xs font-medium rounded-lg hover:bg-[#D4117D] transition-colors">
                    {recalcResult.impossible ? 'Dismiss' : 'OK'}
                  </button>
                </div>
              </div>

              {/* Warnings — only show if critical */}
              {recalcResult.warnings.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[#FF1493]/10 space-y-1">
                  {recalcResult.warnings.map((w, i) => (
                    <p key={i} className="text-[11px] text-[#57534E] flex items-start gap-1.5">
                      <span className="text-[#F59E0B] mt-0.5 shrink-0">&#9679;</span>
                      {w}
                    </p>
                  ))}
                </div>
              )}
            </div>
            );
          })() : overdueTasks.length > 0 ? (
            <div className="mt-3 bg-amber-50 rounded-xl border border-amber-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                  <div>
                    <p className="text-sm font-medium text-[#92400E]">
                      {overdueTasks.length} task{overdueTasks.length !== 1 ? 's' : ''} past due
                    </p>
                    <p className="text-xs text-[#92400E]/70">
                      Recalculate to shift dates forward while protecting launch deadlines
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setPreRecalcTasks([...launch.tasks]);
                    const result = recalculateTimeline(launch);
                    if (result.impossible) {
                      setRecalcResult({ daysLate: result.daysLate, daysAbsorbed: result.daysAbsorbed, impossible: result.impossible, warnings: result.warnings, changes: result.changes, pendingTasks: result.tasks });
                      return;
                    }
                    updateLaunch({ ...launch, tasks: result.tasks });
                    setRecalcResult({ daysLate: result.daysLate, daysAbsorbed: result.daysAbsorbed, impossible: result.impossible, warnings: result.warnings, changes: result.changes });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF1493] text-white text-xs font-medium rounded-lg hover:bg-[#D4117D] transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Recalculate Timeline
                </button>
              </div>
            </div>
          ) : null;
        })()}
        </div>

      {/* Cascade Warning - rendered inline in TrackerView, fallback for other tabs */}
      {cascadeWarning && activeTab !== 'tracker' && (
        <div className="bg-red-50 rounded-xl border border-red-200 p-4 mb-4 animate-fade-in">
          <div className="flex items-start gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-[#DC2626] mt-0.5 shrink-0" />
            <p className="text-sm font-medium text-[#DC2626]">
              This pushes {cascadeWarning.overCount} task{cascadeWarning.overCount !== 1 ? 's' : ''} past launch ({cascadeWarning.maxDaysOver} BD over). Switch to Task Tracker to resolve.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                updateLaunch({ ...launch, tasks: cascadeWarning.pendingTasks });
                setCascadeWarning(null);
              }}
              className="px-3 py-1.5 bg-[#DC2626] text-white text-xs font-medium rounded-lg hover:bg-[#B91C1C] transition-colors"
            >
              Keep with Delays
            </button>
            <button
              onClick={() => setCascadeWarning(null)}
              className="px-3 py-1.5 border border-[#E7E5E4] text-[#57534E] text-xs font-medium rounded-lg hover:bg-[#F5F5F4] transition-colors"
            >
              Undo Change
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#E7E5E4] mb-6">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? ''
                : 'border-transparent text-[#A8A29E] hover:text-[#57534E]'
            }`}
            style={activeTab === tab.key ? { borderColor: accentColor, color: accentColor } : undefined}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-full" style={{ background: accentColor + '15', color: accentColor }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
        {/* Undo button */}
        {undoStackRef.current.length > 0 && (
          <button
            onClick={handleUndo}
            className="ml-auto flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-[#A8A29E] hover:text-[#57534E] hover:bg-[#F5F5F4] rounded-lg transition-colors mb-0.5 self-center"
            title="Undo last change (Ctrl+Z)"
          >
            <RotateCcw className="w-3 h-3" />
            Undo
          </button>
        )}
      </div>

      {/* Undo toast */}
      {undoToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1B1464] text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 animate-fade-in">
          <RotateCcw className="w-3.5 h-3.5" />
          {undoToast}
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'tracker' && (
        <TrackerView
          launch={launch}
          expandedPhases={expandedPhases}
          togglePhase={togglePhase}
          updateTaskStatus={updateTaskStatus}
          updateTaskNotes={updateTaskNotes}
          onUpdateLaunch={updateLaunch}
          updateTaskField={updateTaskField}
          updateTaskDateWithCascade={updateTaskDateWithCascade}
          initialTaskId={initialTaskId}
          cascadeWarning={cascadeWarning}
          onCascadeApply={() => {
            if (cascadeWarning) {
              const oldByName = new Map(launch.tasks.map(t => [t.id, t]));
              const changedIds = new Set<string>();
              let furthestId = '';
              let furthestDate = '';
              for (const t of cascadeWarning.pendingTasks) {
                const old = oldByName.get(t.id);
                if (old && old.dueDate !== t.dueDate && t.id !== cascadeWarning.triggerTaskId) {
                  changedIds.add(t.id);
                  if (t.dueDate && t.dueDate > furthestDate) {
                    furthestDate = t.dueDate;
                    furthestId = t.id;
                  }
                }
              }
              updateLaunch({ ...launch, tasks: cascadeWarning.pendingTasks });
              setCascadeWarning(null);
              if (changedIds.size > 0) flashChangedTasks(changedIds, furthestId || undefined);
            }
          }}
          onCascadeApplyOriginal={() => {
            if (cascadeWarning) {
              // Apply the original cascade (before quick fixes)
              const oldByName = new Map(launch.tasks.map(t => [t.id, t]));
              const changedIds = new Set<string>();
              let furthestId = '';
              let furthestDate = '';
              for (const t of cascadeWarning.originalPendingTasks) {
                const old = oldByName.get(t.id);
                if (old && old.dueDate !== t.dueDate && t.id !== cascadeWarning.triggerTaskId) {
                  changedIds.add(t.id);
                  if (t.dueDate && t.dueDate > furthestDate) {
                    furthestDate = t.dueDate;
                    furthestId = t.id;
                  }
                }
              }
              updateLaunch({ ...launch, tasks: cascadeWarning.originalPendingTasks });
              setCascadeWarning(null);
              if (changedIds.size > 0) flashChangedTasks(changedIds, furthestId || undefined);
            }
          }}
          onCascadeDismiss={() => setCascadeWarning(null)}
          onCascadeAdjustLeadTime={(adjustTaskId: string, newDuration: number) => {
            if (!cascadeWarning) return;
            // Clone all pending tasks
            const taskMap = new Map(cascadeWarning.pendingTasks.map(t => [t.id, { ...t }]));
            const dependentsOf = new Map<string, string[]>();
            for (const t of cascadeWarning.pendingTasks) {
              for (const depId of t.dependencies) {
                if (!dependentsOf.has(depId)) dependentsOf.set(depId, []);
                dependentsOf.get(depId)!.push(t.id);
              }
            }

            // Adjust the target task's lead time
            const adjustTask = taskMap.get(adjustTaskId)!;
            adjustTask.durationDays = newDuration;
            if (adjustTask.startDate) {
              adjustTask.dueDate = format(addBusinessDays(parseISO(adjustTask.startDate), Math.max(0, newDuration)), 'yyyy-MM-dd');
            }

            // BFS cascade from adjusted task
            const queue = [adjustTaskId];
            const visited = new Set<string>([adjustTaskId]);
            while (queue.length > 0) {
              const currentId = queue.shift()!;
              const deps = dependentsOf.get(currentId) || [];
              for (const depId of deps) {
                if (visited.has(depId)) continue;
                const depTask = taskMap.get(depId)!;
                if (!depTask.dueDate) continue;
                const latestDepDue = depTask.dependencies.reduce((latest, dId) => {
                  const d = taskMap.get(dId);
                  if (!d) return latest;
                  const endDate = (d.status === 'complete' || d.status === 'skipped')
                    ? (d.completedDate?.split('T')[0] || d.dueDate || '') : (d.dueDate || '');
                  return endDate > latest ? endDate : latest;
                }, '');
                if (!latestDepDue) continue;
                const newStart = parseISO(latestDepDue);
                const dur = depTask.durationDays || 1;
                const newDue = addBusinessDays(newStart, Math.max(0, dur));
                const newStartStr = format(newStart, 'yyyy-MM-dd');
                const newDueStr = format(newDue, 'yyyy-MM-dd');
                if (depTask.startDate !== newStartStr || depTask.dueDate !== newDueStr) {
                  depTask.startDate = newStartStr;
                  depTask.dueDate = newDueStr;
                  visited.add(depId);
                  queue.push(depId);
                }
              }
            }

            // Recheck if still over launch
            const newTasks = Array.from(taskMap.values());
            const dtcLaunch = launch.launchDate ? parseISO(launch.launchDate) : null;
            let overCount = 0;
            let maxDaysOver = 0;
            for (const t of newTasks) {
              if (t.status === 'complete' || t.status === 'skipped' || !t.dueDate) continue;
              if (t.name === 'D2C Launch' || t.name === 'Sephora Launch') continue;
              const due = parseISO(t.dueDate);
              if (dtcLaunch && isAfter(due, dtcLaunch)) {
                overCount++;
                maxDaysOver = Math.max(maxDaysOver, differenceInBusinessDays(due, dtcLaunch));
              }
            }

            if (overCount === 0) {
              // All resolved — don't auto-apply, show success state so user can confirm
              setCascadeWarning({
                ...cascadeWarning,
                pendingTasks: newTasks,
                overCount: 0,
                maxDaysOver: 0,
                hasFixes: true,
              });
            } else {
              // Update the warning with recalculated tasks
              setCascadeWarning({
                ...cascadeWarning,
                pendingTasks: newTasks,
                overCount,
                maxDaysOver,
                hasFixes: true,
              });
            }
          }}
          onCascadeRemoveDep={(taskId: string, depToRemove: string) => {
            if (!cascadeWarning) return;
            // Clone all pending tasks and remove the dependency
            const taskMap = new Map(cascadeWarning.pendingTasks.map(t => [t.id, { ...t }]));
            const targetTask = taskMap.get(taskId);
            if (!targetTask) return;
            targetTask.dependencies = targetTask.dependencies.filter(d => d !== depToRemove);

            // Build reverse dep map
            const dependentsOf = new Map<string, string[]>();
            for (const t of taskMap.values()) {
              for (const depId of t.dependencies) {
                if (!dependentsOf.has(depId)) dependentsOf.set(depId, []);
                dependentsOf.get(depId)!.push(t.id);
              }
            }

            // Recalculate the target task's dates based on remaining deps
            if (targetTask.dependencies.length > 0) {
              const latestDepDue = targetTask.dependencies.reduce((latest, dId) => {
                const d = taskMap.get(dId);
                if (!d) return latest;
                const endDate = (d.status === 'complete' || d.status === 'skipped')
                  ? (d.completedDate?.split('T')[0] || d.dueDate || '') : (d.dueDate || '');
                return endDate > latest ? endDate : latest;
              }, '');
              if (latestDepDue) {
                const newStart = parseISO(latestDepDue);
                const dur = targetTask.durationDays || 1;
                targetTask.startDate = format(newStart, 'yyyy-MM-dd');
                targetTask.dueDate = format(addBusinessDays(newStart, Math.max(0, dur)), 'yyyy-MM-dd');
              }
            }

            // BFS cascade from the modified task
            const queue = [taskId];
            const visited = new Set<string>([taskId]);
            while (queue.length > 0) {
              const currentId = queue.shift()!;
              const deps = dependentsOf.get(currentId) || [];
              for (const depId of deps) {
                if (visited.has(depId)) continue;
                const depTask = taskMap.get(depId)!;
                if (!depTask.dueDate) continue;
                const latestDep = depTask.dependencies.reduce((latest, dId) => {
                  const d = taskMap.get(dId);
                  if (!d) return latest;
                  const endDate = (d.status === 'complete' || d.status === 'skipped')
                    ? (d.completedDate?.split('T')[0] || d.dueDate || '') : (d.dueDate || '');
                  return endDate > latest ? endDate : latest;
                }, '');
                if (!latestDep) continue;
                const newStart = parseISO(latestDep);
                const dur = depTask.durationDays || 1;
                const newDue = addBusinessDays(newStart, Math.max(0, dur));
                const newStartStr = format(newStart, 'yyyy-MM-dd');
                const newDueStr = format(newDue, 'yyyy-MM-dd');
                if (depTask.startDate !== newStartStr || depTask.dueDate !== newDueStr) {
                  depTask.startDate = newStartStr;
                  depTask.dueDate = newDueStr;
                  visited.add(depId);
                  queue.push(depId);
                }
              }
            }

            // Recheck if still over launch
            const newTasks = Array.from(taskMap.values());
            const dtcLaunch = launch.launchDate ? parseISO(launch.launchDate) : null;
            let overCount = 0;
            let maxDaysOver = 0;
            for (const t of newTasks) {
              if (t.status === 'complete' || t.status === 'skipped' || !t.dueDate) continue;
              if (t.name === 'D2C Launch' || t.name === 'Sephora Launch') continue;
              const due = parseISO(t.dueDate);
              if (dtcLaunch && isAfter(due, dtcLaunch)) {
                overCount++;
                maxDaysOver = Math.max(maxDaysOver, differenceInBusinessDays(due, dtcLaunch));
              }
            }

            if (overCount === 0) {
              // All resolved — show success state so user can confirm
              setCascadeWarning({
                ...cascadeWarning,
                pendingTasks: newTasks,
                overCount: 0,
                maxDaysOver: 0,
                hasFixes: true,
              });
            } else {
              // Update the warning with recalculated tasks
              setCascadeWarning({
                ...cascadeWarning,
                pendingTasks: newTasks,
                overCount,
                maxDaysOver,
                hasFixes: true,
              });
            }
          }}
          highlightedTaskIds={highlightedTaskIds}
          scrollToTaskId={scrollToTaskId}
        />
      )}
      {activeTab === 'files' && (
        <DeliverablesView launch={launch} />
      )}
      {activeTab === 'meetings' && (
        <MeetingsView launch={launch} updateTaskStatus={updateTaskStatus} />
      )}
      {activeTab === 'timeline' && (
        <GanttChart
          tasks={launch.tasks}
          launchDate={launch.launchDate}
          sephoraLaunchDate={launch.sephoraLaunchDate}
          amazonLaunchDate={launch.amazonLaunchDate}
        />
      )}
    </div>
  );
}

function TrackerView({ launch, expandedPhases, togglePhase, updateTaskStatus, updateTaskNotes, onUpdateLaunch, updateTaskField, updateTaskDateWithCascade, initialTaskId, cascadeWarning, onCascadeApply, onCascadeApplyOriginal, onCascadeDismiss, onCascadeAdjustLeadTime, onCascadeRemoveDep, highlightedTaskIds, scrollToTaskId }: {
  launch: Launch;
  expandedPhases: Set<PhaseKey>;
  togglePhase: (phase: PhaseKey) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  updateTaskNotes: (taskId: string, notes: string) => void;
  onUpdateLaunch: (launch: Launch) => void;
  updateTaskField: (taskId: string, updates: Partial<GTMTask>) => void;
  updateTaskDateWithCascade: (taskId: string, newDate: string, extraUpdates?: Partial<GTMTask>) => void;
  initialTaskId?: string | null;
  cascadeWarning: {
    triggerTaskId: string;
    pendingTasks: import('@/lib/types').GTMTask[];
    originalPendingTasks: import('@/lib/types').GTMTask[];
    chainTaskIds: string[];
    overCount: number;
    maxDaysOver: number;
    originalOverTaskIds: string[];
    hasFixes: boolean;
  } | null;
  onCascadeApply: () => void;
  onCascadeApplyOriginal: () => void;
  onCascadeDismiss: () => void;
  onCascadeAdjustLeadTime: (taskId: string, newDuration: number) => void;
  onCascadeRemoveDep: (taskId: string, depToRemove: string) => void;
  highlightedTaskIds: Set<string>;
  scrollToTaskId: string | null;
}) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(initialTaskId || null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hideCompleted, setHideCompleted] = useState(true);
  const [sortBy, setSortBy] = useState<'due' | 'owner' | 'phase'>('due');
  const [sortAsc, setSortAsc] = useState(true);
  const [showFullChain, setShowFullChain] = useState(false);
  const [showCascadeDetails, setShowCascadeDetails] = useState(false);
  const bulkRef = useRef<HTMLDivElement>(null);
  const scrolledToTask = useRef(false);

  const lastClickedRef = useRef<string | null>(null);

  // Auto-scroll to the furthest-moved task when cascade happens
  useEffect(() => {
    if (scrollToTaskId) {
      setTimeout(() => {
        const el = document.getElementById(`task-${scrollToTaskId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [scrollToTaskId]);

  const toggleTaskSelection = (taskId: string, shiftKey?: boolean) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (shiftKey && lastClickedRef.current) {
        const allTaskIds = launch.tasks.map(t => t.id);
        const lastIdx = allTaskIds.indexOf(lastClickedRef.current);
        const curIdx = allTaskIds.indexOf(taskId);
        if (lastIdx !== -1 && curIdx !== -1) {
          const [start, end] = lastIdx < curIdx ? [lastIdx, curIdx] : [curIdx, lastIdx];
          for (let i = start; i <= end; i++) {
            next.add(allTaskIds[i]);
          }
        }
      } else {
        if (next.has(taskId)) next.delete(taskId);
        else next.add(taskId);
      }
      lastClickedRef.current = taskId;
      return next;
    });
  };

  const selectAllTasks = () => {
    if (selectedTaskIds.size === launch.tasks.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(launch.tasks.map(t => t.id)));
    }
  };

  const bulkUpdateStatus = (status: TaskStatus) => {
    const updated = {
      ...launch,
      tasks: launch.tasks.map(t => {
        if (!selectedTaskIds.has(t.id)) return t;
        return { ...t, status, completedDate: status === 'complete' ? new Date().toISOString().split('T')[0] : null };
      }),
    };
    onUpdateLaunch(updated);
    setSelectedTaskIds(new Set());
    setBulkStatusOpen(false);
  };

  // Close bulk dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (bulkRef.current && !bulkRef.current.contains(e.target as Node)) setBulkStatusOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ESC to deselect all
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedTaskIds(new Set());
        setBulkStatusOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-scroll to the task if opened via ?task= param
  useEffect(() => {
    if (initialTaskId && !scrolledToTask.current) {
      scrolledToTask.current = true;
      // Small delay to let the DOM render the expanded task
      setTimeout(() => {
        const el = document.getElementById(`task-${initialTaskId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
    }
  }, [initialTaskId]);

  const [earlyFinishPrompt, setEarlyFinishPrompt] = useState<{
    taskId: string;
    daysSaved: number;
    redistributions: { taskId: string; taskName: string; currentGap: number; newGap: number }[];
    newTasks: GTMTask[];
  } | null>(null);

  const handleMarkComplete = (taskId: string) => {
    const task = launch.tasks.find(t => t.id === taskId);
    if (!task || !task.dueDate) {
      updateTaskStatus(taskId, 'complete');
      return;
    }

    // Check if completing early
    const dueDate = parseISO(task.dueDate);
    const today = startOfDay(new Date());
    const isEarly = isAfter(dueDate, today);

    if (isEarly) {
      const result = calculateEarlyFinishRedistribution(launch, taskId);
      if (result && result.daysSaved > 0 && result.redistributions.length > 0) {
        setEarlyFinishPrompt({ taskId, ...result });
        return;
      }
    }

    updateTaskStatus(taskId, 'complete');
  };

  const handleAcceptRedistribution = () => {
    if (!earlyFinishPrompt) return;
    // Apply redistributed dates AND mark task complete
    const updatedTasks = earlyFinishPrompt.newTasks.map(t =>
      t.id === earlyFinishPrompt.taskId
        ? { ...t, status: 'complete' as TaskStatus, completedDate: new Date().toISOString() }
        : t
    );
    onUpdateLaunch({ ...launch, tasks: updatedTasks });
    setEarlyFinishPrompt(null);
  };

  const handleDeclineRedistribution = () => {
    if (!earlyFinishPrompt) return;
    updateTaskStatus(earlyFinishPrompt.taskId, 'complete');
    setEarlyFinishPrompt(null);
  };

  const updateDeliverableUrl = (taskId: string, url: string) => {
    onUpdateLaunch({
      ...launch,
      tasks: launch.tasks.map(t => t.id === taskId ? { ...t, deliverableUrl: url } : t),
    });
  };

  return (
    <div className="space-y-4">
      {/* Early finish prompt */}
      {earlyFinishPrompt && (
        <div className="bg-[#FFF0F7] rounded-xl border border-[#FF1493]/20 p-4 animate-fade-in">
          <div className="flex items-start gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-[#FF1493] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-[#FF1493]">
                Nice! You finished {earlyFinishPrompt.daysSaved} day{earlyFinishPrompt.daysSaved !== 1 ? 's' : ''} early
              </p>
              <p className="text-xs text-[#57534E] mt-0.5">
                Want to add buffer to these tight windows?
              </p>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-[#E7E5E4] divide-y divide-[#E7E5E4] mb-3">
            {earlyFinishPrompt.redistributions.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2">
                <span className="text-xs text-[#1B1464]">{r.taskName}</span>
                <span className="text-xs text-[#FF1493] font-medium">
                  {r.currentGap}d → {r.newGap}d (+{r.newGap - r.currentGap})
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAcceptRedistribution}
              className="px-3 py-1.5 bg-[#FF1493] text-white text-xs font-medium rounded-lg hover:bg-[#D4117D] transition-colors"
            >
              Add buffer to tight tasks
            </button>
            <button
              onClick={handleDeclineRedistribution}
              className="px-3 py-1.5 text-[#57534E] text-xs font-medium hover:bg-[#F5F5F4] rounded-lg transition-colors"
            >
              Keep dates as-is
            </button>
          </div>
        </div>
      )}

      {/* Search bar + filters */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search tasks by name, notes, or owner..."
            className="w-full px-4 py-2.5 pl-10 border border-[#E7E5E4] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FF1493]/20 focus:border-[#FF1493] bg-white"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A29E]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A8A29E] hover:text-[#57534E]">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setHideCompleted(!hideCompleted)}
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap ${
            hideCompleted
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-white text-[#A8A29E] border-[#E7E5E4] hover:border-[#D6D3D1]'
          }`}
          title={hideCompleted ? 'Show completed tasks' : 'Hide completed tasks'}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          {hideCompleted ? 'Show done' : 'Hide done'}
        </button>
      </div>

      {/* Chronological task list */}
      {(() => {
        const q = searchQuery.toLowerCase().trim();
        const filteredTasks = q
          ? launch.tasks.filter(t =>
              t.name.toLowerCase().includes(q) ||
              (t.notes && t.notes.toLowerCase().includes(q)) ||
              (OWNER_LABELS[t.owner] && OWNER_LABELS[t.owner].toLowerCase().includes(q))
            )
          : launch.tasks;
        const phaseOrder = Object.fromEntries(PHASES.map((p, i) => [p.key, i]));
        const ownerOrder = Object.fromEntries(Object.keys(OWNER_LABELS).map((k, i) => [k, i]));
        const taskSort = (a: GTMTask, b: GTMTask) => {
          let cmp = 0;
          if (sortBy === 'due') {
            const aDate = a.dueDate || a.startDate || '9999';
            const bDate = b.dueDate || b.startDate || '9999';
            cmp = aDate.localeCompare(bDate);
          } else if (sortBy === 'owner') {
            cmp = (ownerOrder[a.owner] ?? 99) - (ownerOrder[b.owner] ?? 99);
          } else if (sortBy === 'phase') {
            cmp = (phaseOrder[a.phase] ?? 99) - (phaseOrder[b.phase] ?? 99);
          }
          if (cmp !== 0) return sortAsc ? cmp : -cmp;
          // Secondary sort always by due date asc
          const aDate = a.dueDate || '9999';
          const bDate = b.dueDate || '9999';
          return aDate.localeCompare(bDate) || a.sortOrder - b.sortOrder;
        };
        const activeTasks = [...filteredTasks.filter(t => t.status !== 'complete' && t.status !== 'skipped')].sort(taskSort);
        const doneTasks = [...filteredTasks.filter(t => t.status === 'complete' || t.status === 'skipped')].sort(taskSort);
        const sortedTasks = activeTasks;
        const phaseMap = Object.fromEntries(PHASES.map(p => [p.key, p]));

        return (
          <div className="bg-white rounded-xl border border-[#E7E5E4]">
            {/* Sticky header group */}
            <div className="sticky top-0 z-20 bg-white rounded-t-xl border-b border-[#E7E5E4]">
            {/* Phase legend */}
            <div className="flex items-center gap-4 px-4 py-2.5 bg-[#FAFAF9] border-b border-[#E7E5E4]">
              {PHASES.map(p => {
                const count = launch.tasks.filter(t => t.phase === p.key).length;
                if (count === 0) return null;
                return (
                  <div key={p.key} className="flex items-center gap-1.5 text-[11px] text-[#57534E]">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                    {p.name}
                  </div>
                );
              })}
            </div>
            {/* Bulk action bar */}
            {selectedTaskIds.size > 0 && (
              <div className="flex items-center gap-3 px-4 py-2 bg-[#FF1493]/5 border-b border-[#FF1493]/20">
                <span className="text-xs font-medium text-[#FF1493]">
                  {selectedTaskIds.size} selected
                </span>
                <div className="relative" ref={bulkRef}>
                  <button
                    onClick={() => setBulkStatusOpen(!bulkStatusOpen)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-[#E7E5E4] rounded-lg text-xs font-medium text-[#1B1464] hover:bg-[#FAFAF9] transition-colors"
                  >
                    Change Status
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {bulkStatusOpen && (
                    <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg border border-[#E7E5E4] shadow-lg py-1 w-[200px] animate-fade-in">
                      {STATUS_OPTIONS.map(s => (
                        <button
                          key={s.value}
                          onClick={() => bulkUpdateStatus(s.value)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-[#FAFAF9] transition-colors"
                        >
                          <span style={{ color: s.color }}>{s.icon}</span>
                          <span className="text-[#1B1464]">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setSelectedTaskIds(new Set())}
                  className="text-xs text-[#A8A29E] hover:text-[#57534E] transition-colors ml-auto"
                >
                  Clear selection
                </button>
              </div>
            )}
            {/* Column headers */}
            <div className="grid grid-cols-[20px_1fr_120px_80px_120px_140px_40px] gap-x-3 px-4 py-2 bg-[#FAFAF9] text-[11px] font-medium text-[#A8A29E] uppercase tracking-wider border-b border-[#E7E5E4]">
              <input
                type="checkbox"
                checked={selectedTaskIds.size === launch.tasks.length && launch.tasks.length > 0}
                onChange={selectAllTasks}
                className="w-3.5 h-3.5 rounded border-[#D6D3D1] text-[#FF1493] focus:ring-[#FF1493]/20 cursor-pointer"
              />
              <button onClick={() => { if (sortBy === 'phase') setSortAsc(!sortAsc); else { setSortBy('phase'); setSortAsc(true); } }} className={`text-left hover:text-[#57534E] transition-colors ${sortBy === 'phase' ? 'text-[#57534E]' : ''}`}>
                Task {sortBy === 'phase' && (sortAsc ? '↑' : '↓')}
              </button>
              <button onClick={() => { if (sortBy === 'owner') setSortAsc(!sortAsc); else { setSortBy('owner'); setSortAsc(true); } }} className={`text-left hover:text-[#57534E] transition-colors ${sortBy === 'owner' ? 'text-[#57534E]' : ''}`}>
                Owner {sortBy === 'owner' && (sortAsc ? '↑' : '↓')}
              </button>
              <span>Lead</span>
              <button onClick={() => { if (sortBy === 'due') setSortAsc(!sortAsc); else { setSortBy('due'); setSortAsc(true); } }} className={`text-left hover:text-[#57534E] transition-colors ${sortBy === 'due' ? 'text-[#57534E]' : ''}`}>
                Due Date {sortBy === 'due' && (sortAsc ? '↑' : '↓')}
              </button>
              <span>Status</span>
              <span />
            </div>
            </div>{/* end sticky header */}
            {sortedTasks.map(task => {
              const phase = phaseMap[task.phase] || PHASES[0];
              return (
                <React.Fragment key={task.id}>
                <TaskRow
                  task={task}
                  launch={launch}
                  phase={phase}
                  isExpanded={expandedTaskId === task.id}
                  isSelected={selectedTaskIds.has(task.id)}
                  isHighlighted={highlightedTaskIds.has(task.id)}
                  onToggleSelect={(shiftKey?: boolean) => toggleTaskSelection(task.id, shiftKey)}
                  onToggleExpand={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                  onMarkComplete={handleMarkComplete}
                  updateTaskStatus={updateTaskStatus}
                  updateTaskNotes={updateTaskNotes}
                  updateDeliverableUrl={updateDeliverableUrl}
                  updateTaskField={updateTaskField}
                  updateTaskDateWithCascade={updateTaskDateWithCascade}
                  onDeleteTask={(taskId) => {
                    onUpdateLaunch({ ...launch, tasks: launch.tasks.filter(t => t.id !== taskId) });
                  }}
                  onNavigateToTask={(targetId) => {
                    // If target is in the done section and it's hidden, reveal it
                    const targetTask = launch.tasks.find(t => t.id === targetId);
                    if (targetTask && (targetTask.status === 'complete' || targetTask.status === 'skipped') && hideCompleted) {
                      setHideCompleted(false);
                    }
                    setExpandedTaskId(targetId);
                    setTimeout(() => {
                      const el = document.getElementById(`task-${targetId}`);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 150);
                  }}
                />
                {cascadeWarning && cascadeWarning.triggerTaskId === task.id && (
                  <div className="border-x border-b border-red-200 animate-fade-in">
                    {(() => {
                      const pendingMap = new Map(cascadeWarning.pendingTasks.map(t => [t.id, t]));
                      const dtcLaunch = launch.launchDate ? parseISO(launch.launchDate) : null;
                      const allResolved = cascadeWarning.overCount === 0 && cascadeWarning.hasFixes;

                      // Current over tasks
                      const currentOverIds = new Set(
                        cascadeWarning.pendingTasks
                          .filter(t => {
                            if (t.status === 'complete' || t.status === 'skipped' || !t.dueDate) return false;
                            if (t.name === 'D2C Launch' || t.name === 'Sephora Launch') return false;
                            return dtcLaunch && isAfter(parseISO(t.dueDate), dtcLaunch);
                          })
                          .map(t => t.id)
                      );

                      // Originally-over tasks for the list
                      const originalOverTasks = cascadeWarning.originalOverTaskIds
                        .map(id => pendingMap.get(id))
                        .filter((t): t is GTMTask => !!t);

                      // Find the ROOT bottleneck — the earliest task in the chain that's driving delays
                      // Instead of per-task fixes, find the key upstream tasks that, if unblocked, fix the most
                      const unblockFixes: { taskId: string; taskName: string; depId: string; depName: string; fixesCount: number }[] = [];

                      // For each still-over task, trace back to find the real bottleneck dependency
                      // The bottleneck is the task closest to the trigger that's causing the cascade
                      const bottleneckCounts = new Map<string, { taskId: string; depId: string; count: number }>();
                      for (const overTask of originalOverTasks) {
                        if (!currentOverIds.has(overTask.id)) continue;
                        // Walk back from over task to find the first task that depends on the trigger (or near it)
                        let current = overTask;
                        const walked = new Set<string>([overTask.id]);
                        while (current) {
                          // Find this task's driving dep in the chain
                          let drivingDepId: string | null = null;
                          let latestDue = '';
                          for (const depId of current.dependencies) {
                            const d = pendingMap.get(depId);
                            if (!d?.dueDate) continue;
                            const endDate = (d.status === 'complete' || d.status === 'skipped')
                              ? (d.completedDate?.split('T')[0] || d.dueDate) : d.dueDate;
                            if (endDate > latestDue) { latestDue = endDate; drivingDepId = depId; }
                          }
                          if (!drivingDepId) break;
                          const drivingDep = pendingMap.get(drivingDepId);
                          if (!drivingDep) break;
                          // Is the driving dep over launch? If so, the bottleneck is further upstream
                          const depOver = dtcLaunch && drivingDep.dueDate && isAfter(parseISO(drivingDep.dueDate), dtcLaunch);
                          if (!depOver || walked.has(drivingDepId)) {
                            // This is the bottleneck link — current task depends on something that's on-time (or we're at the trigger)
                            // Removing current's dep on drivingDep would let current schedule earlier
                            const key = `${current.id}-${drivingDepId}`;
                            const existing = bottleneckCounts.get(key);
                            if (existing) {
                              existing.count++;
                            } else {
                              bottleneckCounts.set(key, { taskId: current.id, depId: drivingDepId, count: 1 });
                            }
                            break;
                          }
                          walked.add(drivingDepId);
                          current = drivingDep;
                        }
                      }

                      // Sort by how many over-tasks each fix would help
                      const sortedBottlenecks = Array.from(bottleneckCounts.values())
                        .sort((a, b) => b.count - a.count);

                      for (const bn of sortedBottlenecks.slice(0, 3)) {
                        const task = pendingMap.get(bn.taskId);
                        const dep = pendingMap.get(bn.depId);
                        if (task && dep) {
                          unblockFixes.push({
                            taskId: bn.taskId,
                            taskName: task.name,
                            depId: bn.depId,
                            depName: dep.name,
                            fixesCount: bn.count,
                          });
                        }
                      }

                      return (
                        <>
                          {/* Header bar — always visible, clearly clickable */}
                          <div className={`flex items-center gap-0 ${allResolved ? 'bg-emerald-50' : 'bg-red-50'}`}>
                            <button
                              onClick={() => setShowCascadeDetails(!showCascadeDetails)}
                              className={`flex-1 flex items-center gap-2 px-4 py-2.5 text-left transition-colors rounded-none ${
                                allResolved ? 'hover:bg-emerald-100' : 'hover:bg-red-100'
                              }`}
                            >
                              {allResolved ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                {allResolved ? (
                                  <span className="text-xs font-medium text-emerald-700">All delays resolved</span>
                                ) : (
                                  <span className="text-xs font-medium text-[#DC2626]">
                                    {cascadeWarning.overCount} task{cascadeWarning.overCount !== 1 ? 's' : ''} past launch ({cascadeWarning.maxDaysOver} BD over)
                                  </span>
                                )}
                              </div>
                              <span className={`text-[10px] ${allResolved ? 'text-emerald-600' : 'text-[#DC2626]'} shrink-0`}>
                                {showCascadeDetails ? 'Hide' : 'Resolve'}
                              </span>
                              {showCascadeDetails ? (
                                <ChevronDown className={`w-3.5 h-3.5 shrink-0 ${allResolved ? 'text-emerald-500' : 'text-[#DC2626]'}`} />
                              ) : (
                                <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${allResolved ? 'text-emerald-500' : 'text-[#DC2626]'}`} />
                              )}
                            </button>
                            {/* Inline action buttons */}
                            <div className="flex items-center gap-1.5 px-3 shrink-0">
                              {allResolved ? (
                                <button onClick={onCascadeApply} className="px-2.5 py-1 bg-emerald-600 text-white text-[11px] font-medium rounded-md hover:bg-emerald-700 transition-colors">
                                  Save
                                </button>
                              ) : (
                                <button onClick={onCascadeApply} className="px-2.5 py-1 bg-[#DC2626]/10 text-[#DC2626] text-[11px] font-medium rounded-md hover:bg-[#DC2626]/20 transition-colors">
                                  Keep
                                </button>
                              )}
                              <button onClick={onCascadeDismiss} className="px-2.5 py-1 text-[#A8A29E] text-[11px] font-medium hover:text-[#57534E] transition-colors">
                                Undo
                              </button>
                            </div>
                          </div>

                          {/* Expandable details */}
                          {showCascadeDetails && (
                            <div className={`px-4 py-3 border-t ${allResolved ? 'bg-emerald-50/30 border-emerald-100' : 'bg-red-50/30 border-red-100'}`}>
                              {/* Simple task list */}
                              <div className="space-y-0 rounded-lg border border-[#E7E5E4] overflow-hidden mb-3">
                                <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 px-3 py-1.5 bg-[#FAFAF9] border-b border-[#E7E5E4]">
                                  <span />
                                  <span className="text-[10px] font-semibold text-[#A8A29E] uppercase tracking-wide">Task</span>
                                  <span className="text-[10px] font-semibold text-[#A8A29E] uppercase tracking-wide">Due</span>
                                  <span className="text-[10px] font-semibold text-[#A8A29E] uppercase tracking-wide text-right">Status</span>
                                </div>
                                {originalOverTasks.map(overTask => {
                                  const isResolved = !currentOverIds.has(overTask.id);
                                  const daysOver = dtcLaunch && overTask.dueDate
                                    ? differenceInBusinessDays(parseISO(overTask.dueDate), dtcLaunch) : 0;
                                  return (
                                    <div key={overTask.id} className={`grid grid-cols-[auto_1fr_auto_auto] gap-x-3 px-3 py-2 items-center border-b border-[#F5F5F4] last:border-b-0 ${
                                      isResolved ? 'bg-emerald-50/50' : 'bg-white'
                                    }`}>
                                      {isResolved ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                      ) : (
                                        <AlertCircle className="w-3.5 h-3.5 text-[#DC2626]" />
                                      )}
                                      <span className={`text-[11px] truncate ${isResolved ? 'text-emerald-700' : 'text-[#44403C]'}`}>
                                        {overTask.name}
                                      </span>
                                      <span className={`text-[11px] ${isResolved ? 'text-emerald-600' : 'text-[#57534E]'}`}>
                                        {overTask.dueDate ? format(parseISO(overTask.dueDate), 'MMM d') : '—'}
                                      </span>
                                      {isResolved ? (
                                        <span className="text-[10px] font-medium text-emerald-600">Fixed</span>
                                      ) : (
                                        <span className="text-[10px] font-medium text-[#DC2626]">+{daysOver} BD</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Quick fixes — consolidated, not per-task */}
                              {unblockFixes.length > 0 && (
                                <div className="mb-3">
                                  <p className="text-[10px] font-semibold text-[#78716C] uppercase tracking-wide mb-1.5 ml-1">Quick fixes</p>
                                  <div className="space-y-1">
                                    {unblockFixes.map(fix => (
                                      <button
                                        key={`${fix.taskId}-${fix.depId}`}
                                        onClick={() => onCascadeRemoveDep(fix.taskId, fix.depId)}
                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-[#E7E5E4] hover:border-amber-300 hover:bg-amber-50 transition-colors text-left"
                                      >
                                        <span className="text-[10px] text-amber-600 font-medium shrink-0">Unblock</span>
                                        <span className="text-[11px] text-[#44403C] truncate flex-1">
                                          {fix.taskName} <span className="text-[#A8A29E]">from</span> {fix.depName}
                                        </span>
                                        {fix.fixesCount > 1 && (
                                          <span className="text-[9px] text-[#A8A29E] shrink-0">fixes {fix.fixesCount}</span>
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Full chain toggle */}
                              <div className="mb-3">
                                <button
                                  onClick={() => setShowFullChain(!showFullChain)}
                                  className="text-[10px] text-[#A8A29E] hover:text-[#57534E] transition-colors flex items-center gap-1 ml-1"
                                >
                                  {showFullChain ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                  <span>Adjust lead times manually ({cascadeWarning.chainTaskIds.length} tasks)</span>
                                </button>
                                {showFullChain && (
                                  <div className="bg-white rounded-lg border border-[#E7E5E4] overflow-hidden mt-1.5">
                                    <div className="grid grid-cols-[1fr_80px_90px] gap-0 px-3 py-1.5 bg-[#FAFAF9] border-b border-[#E7E5E4]">
                                      <span className="text-[10px] font-semibold text-[#A8A29E] uppercase tracking-wide">Task</span>
                                      <span className="text-[10px] font-semibold text-[#A8A29E] uppercase tracking-wide text-center">Lead</span>
                                      <span className="text-[10px] font-semibold text-[#A8A29E] uppercase tracking-wide text-right">Due</span>
                                    </div>
                                    {cascadeWarning.chainTaskIds.map((chainId) => {
                                      const chainTask = pendingMap.get(chainId);
                                      if (!chainTask) return null;
                                      const isOver = dtcLaunch && chainTask.dueDate && chainTask.name !== 'D2C Launch' && chainTask.name !== 'Sephora Launch'
                                        ? isAfter(parseISO(chainTask.dueDate), dtcLaunch) : false;
                                      return (
                                        <div
                                          key={chainId}
                                          className={`grid grid-cols-[1fr_80px_90px] gap-0 px-3 py-1.5 items-center border-b border-[#F5F5F4] last:border-b-0 ${isOver ? 'bg-red-50' : ''}`}
                                        >
                                          <span className={`text-[11px] truncate ${isOver ? 'text-[#DC2626] font-medium' : 'text-[#44403C]'}`}>
                                            {chainTask.name}
                                          </span>
                                          <div className="flex items-center justify-center gap-0.5">
                                            <button
                                              onClick={() => onCascadeAdjustLeadTime(chainId, Math.max(0, (chainTask.durationDays || 1) - 1))}
                                              className="w-5 h-5 flex items-center justify-center rounded text-[#A8A29E] hover:bg-[#F5F5F4] hover:text-[#57534E] transition-colors text-xs"
                                              disabled={chainTask.durationDays <= 0}
                                            >−</button>
                                            <span className="text-[11px] font-medium text-[#1B1464] w-5 text-center">{chainTask.durationDays}</span>
                                            <button
                                              onClick={() => onCascadeAdjustLeadTime(chainId, (chainTask.durationDays || 0) + 1)}
                                              className="w-5 h-5 flex items-center justify-center rounded text-[#A8A29E] hover:bg-[#F5F5F4] hover:text-[#57534E] transition-colors text-xs"
                                            >+</button>
                                          </div>
                                          <span className={`text-[11px] text-right ${isOver ? 'text-[#DC2626] font-medium' : 'text-[#57534E]'}`}>
                                            {chainTask.dueDate ? format(parseISO(chainTask.dueDate), 'MMM d') : '—'}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              {/* Bottom action buttons */}
                              <div className="flex items-center gap-2">
                                {allResolved ? (
                                  <button onClick={onCascadeApply} className="px-3 py-1.5 bg-emerald-600 text-white text-[11px] font-medium rounded-lg hover:bg-emerald-700 transition-colors">
                                    Save with Fixes
                                  </button>
                                ) : (
                                  <button onClick={onCascadeApply} className="px-3 py-1.5 bg-[#DC2626] text-white text-[11px] font-medium rounded-lg hover:bg-[#B91C1C] transition-colors">
                                    Keep with Delays
                                  </button>
                                )}
                                {cascadeWarning.hasFixes && (
                                  <button onClick={onCascadeApplyOriginal} className="px-3 py-1.5 border border-[#E7E5E4] text-[#57534E] text-[11px] font-medium rounded-lg hover:bg-[#F5F5F4] transition-colors">
                                    Save without Fixes
                                  </button>
                                )}
                                <button onClick={onCascadeDismiss} className="px-3 py-1.5 text-[#A8A29E] text-[11px] font-medium hover:text-[#57534E] transition-colors">
                                  Undo Change
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
                </React.Fragment>
              );
            })}
            {/* Done section */}
            {doneTasks.length > 0 && !hideCompleted && (
              <>
                <button
                  onClick={() => setHideCompleted(true)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 bg-emerald-50/50 border-t border-[#E7E5E4] text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Done ({doneTasks.length})
                  <ChevronDown className={`w-3.5 h-3.5 ml-auto transition-transform ${hideCompleted ? '-rotate-90' : ''}`} />
                </button>
                {doneTasks.map(task => {
                  const phase = phaseMap[task.phase] || PHASES[0];
                  return (
                    <TaskRow
                      key={task.id}
                      task={task}
                      launch={launch}
                      phase={phase}
                      isExpanded={expandedTaskId === task.id}
                      isSelected={selectedTaskIds.has(task.id)}
                      isHighlighted={highlightedTaskIds.has(task.id)}
                      onToggleSelect={(shiftKey?: boolean) => toggleTaskSelection(task.id, shiftKey)}
                      onToggleExpand={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                      onMarkComplete={handleMarkComplete}
                      updateTaskStatus={updateTaskStatus}
                      updateTaskNotes={updateTaskNotes}
                      updateDeliverableUrl={updateDeliverableUrl}
                      updateTaskField={updateTaskField}
                      updateTaskDateWithCascade={updateTaskDateWithCascade}
                      onDeleteTask={(taskId) => {
                        onUpdateLaunch({ ...launch, tasks: launch.tasks.filter(t => t.id !== taskId) });
                      }}
                      onNavigateToTask={(targetId) => {
                        const targetTask = launch.tasks.find(t => t.id === targetId);
                        if (targetTask && (targetTask.status === 'complete' || targetTask.status === 'skipped') && hideCompleted) {
                          setHideCompleted(false);
                        }
                        setExpandedTaskId(targetId);
                        setTimeout(() => {
                          const el = document.getElementById(`task-${targetId}`);
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 150);
                      }}
                    />
                  );
                })}
              </>
            )}
            {hideCompleted && doneTasks.length > 0 && (
              <button
                onClick={() => setHideCompleted(false)}
                className="w-full flex items-center gap-2 px-4 py-2.5 bg-emerald-50/30 border-t border-[#E7E5E4] text-xs text-[#A8A29E] hover:text-emerald-700 hover:bg-emerald-50/50 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Show {doneTasks.length} completed task{doneTasks.length !== 1 ? 's' : ''}
              </button>
            )}
            {/* Add Task button */}
            <button
              onClick={() => {
                const newTask: GTMTask = {
                  id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  name: 'New Task',
                  phase: 'content_planning',
                  owner: 'marketing',
                  durationDays: 3,
                  startDate: null,
                  dueDate: null,
                  completedDate: null,
                  status: 'not_started',
                  notes: '',
                  dependencies: [],
                  sortOrder: launch.tasks.length,
                };
                onUpdateLaunch({ ...launch, tasks: [...launch.tasks, newTask] });
                setExpandedTaskId(newTask.id);
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-[#A8A29E] hover:text-[#FF1493] hover:bg-[#FFF0F7] transition-colors border-t border-[#E7E5E4]"
            >
              <Plus className="w-3.5 h-3.5" />
              Add task
            </button>
          </div>
        );
      })()}
    </div>
  );
}

function TaskRow({ task, launch, phase, isExpanded, isSelected, isHighlighted, onToggleSelect, onToggleExpand, onMarkComplete, updateTaskStatus, updateTaskNotes, updateDeliverableUrl, updateTaskField, updateTaskDateWithCascade, onDeleteTask, onNavigateToTask }: {
  task: GTMTask;
  launch: Launch;
  phase: { key: PhaseKey; color: string };
  isExpanded: boolean;
  isSelected?: boolean;
  isHighlighted?: boolean;
  onToggleSelect?: (shiftKey?: boolean) => void;
  onToggleExpand: () => void;
  onMarkComplete: (taskId: string) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  updateTaskNotes: (taskId: string, notes: string) => void;
  updateDeliverableUrl: (taskId: string, url: string) => void;
  updateTaskField: (taskId: string, updates: Partial<GTMTask>) => void;
  updateTaskDateWithCascade: (taskId: string, newDate: string, extraUpdates?: Partial<GTMTask>) => void;
  onDeleteTask: (taskId: string) => void;
  onNavigateToTask?: (taskId: string) => void;
}) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(task.name);
  const [linkLabel, setLinkLabel] = useState(task.deliverableLabel || '');
  const [editingDeps, setEditingDeps] = useState(false);
  const [editingLink, setEditingLink] = useState(false);
  const [notesOpen, setNotesOpen] = useState(!!(task.notes && task.notes.trim()));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const isOverdue = task.dueDate && task.status !== 'complete' && task.status !== 'skipped' &&
    parseISO(task.dueDate) < new Date();
  const isPastLaunch = task.dueDate && task.status !== 'complete' && task.status !== 'skipped' &&
    task.name !== 'D2C Launch' && task.name !== 'Sephora Launch' &&
    launch.launchDate && parseISO(task.dueDate) > parseISO(launch.launchDate);
  const allDepsComplete = task.dependencies.length > 0 && task.dependencies.every(depId => {
    const dep = launch.tasks.find(t => t.id === depId);
    return dep && (dep.status === 'complete' || dep.status === 'skipped');
  });
  const deliverableLabel = DELIVERABLE_TASKS[task.name];
  const hasLink = task.deliverableUrl && task.deliverableUrl.trim() !== '';
  const currentStatus = STATUS_OPTIONS.find(s => s.value === task.status) || STATUS_OPTIONS[0];

  function handleStatusChange(status: TaskStatus) {
    if (status === 'complete') {
      onMarkComplete(task.id);
    } else {
      updateTaskStatus(task.id, status);
    }
    setStatusOpen(false);
  }

  return (
    <div id={`task-${task.id}`} className={`border-t border-[#E7E5E4] transition-colors duration-1000 ${isHighlighted ? 'bg-blue-50 ring-1 ring-blue-200' : isOverdue || isPastLaunch ? 'bg-red-50/50' : ''} ${isSelected ? 'bg-[#FF1493]/5' : ''} ${allDepsComplete && task.status === 'not_started' ? 'border-l-2 border-l-emerald-400' : ''}`}>
      <div className="grid grid-cols-[20px_1fr_120px_80px_120px_140px_40px] gap-x-3 px-4 py-3 items-center hover:bg-[#FAFAF9] transition-colors">
        {/* Selection checkbox */}
        <input
          type="checkbox"
          checked={!!isSelected}
          onChange={() => {}}
          onClick={e => { e.stopPropagation(); onToggleSelect?.(e.shiftKey); }}
          className="w-3.5 h-3.5 rounded border-[#D6D3D1] text-[#FF1493] focus:ring-[#FF1493]/20 cursor-pointer"
        />
        {/* Task name — inline editable */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {editingName ? (
              <input
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={() => { updateTaskField(task.id, { name: nameValue.trim() || task.name }); setEditingName(false); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { updateTaskField(task.id, { name: nameValue.trim() || task.name }); setEditingName(false); } if (e.key === 'Escape') { setNameValue(task.name); setEditingName(false); } }}
                className="text-sm text-[#1B1464] border-b border-[#FF1493] outline-none bg-transparent w-full"
                autoFocus
              />
            ) : (
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: phase.color }} title={PHASES.find(p => p.key === task.phase)?.name || task.phase} />
                <p
                  className={`text-sm truncate cursor-pointer hover:text-[#FF1493] transition-colors ${task.status === 'complete' ? 'line-through text-[#A8A29E]' : 'text-[#1B1464]'}`}
                  onClick={onToggleExpand}
                  title="Click to view details"
                >
                  {task.isMeeting && <span className="mr-1">📅</span>}
                  {task.name}
                </p>
                {task.isCompressed && (
                  <span className="shrink-0 bg-amber-100 text-amber-700 text-[9px] px-1.5 py-0.5 rounded font-medium" title={`Compressed by ${task.compressionDays} BD`}>
                    -{task.compressionDays}d
                  </span>
                )}
              </div>
            )}
            {/* Deliverable link button */}
            {deliverableLabel && hasLink && (
              <a
                href={task.deliverableUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#FFF0F7] text-[#FF1493] rounded-md text-[10px] font-medium hover:bg-[#FF1493] hover:text-white transition-colors shrink-0 cursor-pointer max-w-[160px]"
                title={`Open ${getDisplayLabel(task)}`}
              >
                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate">{getDisplayLabel(task)}</span>
              </a>
            )}
            {deliverableLabel && !hasLink && (
              <button
                onClick={onToggleExpand}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F5F5F4] text-[#A8A29E] rounded-md text-[10px] font-medium hover:bg-[#FFF0F7] hover:text-[#FF1493] transition-colors shrink-0"
                title="Add link"
              >
                <Plus className="w-2.5 h-2.5" />
                Add Link
              </button>
            )}
          </div>
          {/* Subtitle — dependency status or notes */}
          {!isExpanded && task.status !== 'complete' && task.status !== 'skipped' && (() => {
            if (task.dependencies.length > 0) {
              const allComplete = task.dependencies.every(depId => {
                const d = launch.tasks.find(t => t.id === depId);
                return d && (d.status === 'complete' || d.status === 'skipped');
              });
              if (allComplete) {
                return <p className="text-[11px] text-emerald-500 mt-0.5">Ready</p>;
              }
              const drivingDep = task.dependencies.reduce<GTMTask | null>((latest, depId) => {
                const dep = launch.tasks.find(t => t.id === depId);
                if (!dep?.dueDate || dep.status === 'complete' || dep.status === 'skipped') return latest;
                if (!latest?.dueDate) return dep;
                return dep.dueDate > latest.dueDate ? dep : latest;
              }, null);
              if (drivingDep) {
                return (
                  <p className="text-[11px] text-[#78716C] mt-0.5 truncate">
                    waiting on <button onClick={() => onNavigateToTask?.(drivingDep.id)} className="text-[#78716C] underline decoration-dotted hover:text-[#FF1493] transition-colors">{drivingDep.name}</button>
                  </p>
                );
              }
            }
            // No dependencies — show note preview if any
            if (task.dependencies.length === 0 && task.notes && task.notes.trim()) {
              return <p className="text-[11px] text-[#78716C] mt-0.5 truncate max-w-md">{task.notes}</p>;
            }
            return null;
          })()}
        </div>

        {/* Owner — editable select */}
        <select
          value={task.owner}
          onChange={e => updateTaskField(task.id, { owner: e.target.value as Owner })}
          className="text-xs font-medium px-2 py-1 rounded-full border-0 bg-transparent cursor-pointer focus:outline-none"
          style={{ color: OWNER_COLORS[task.owner] }}
        >
          {Object.entries(OWNER_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        {/* Lead time stepper */}
        <div className="inline-flex items-center border border-[#E7E5E4] rounded-lg overflow-hidden h-[26px]">
          <button
            onClick={(e) => {
              e.stopPropagation();
              const current = task.durationDays || (task.startDate && task.dueDate ? differenceInBusinessDays(parseISO(task.dueDate), parseISO(task.startDate)) : 3);
              if (current <= 1) return;
              const newDuration = current - 1;
              const startDate = task.startDate || (task.dueDate ? format(addBusinessDays(parseISO(task.dueDate), -current), 'yyyy-MM-dd') : null);
              if (startDate) {
                const newDueDate = format(addBusinessDays(parseISO(startDate), newDuration), 'yyyy-MM-dd');
                updateTaskDateWithCascade(task.id, newDueDate, { durationDays: newDuration });
              } else {
                updateTaskField(task.id, { durationDays: newDuration });
              }
            }}
            className="px-1.5 text-[11px] text-[#57534E] hover:bg-[#F5F5F4] transition-colors font-medium h-full"
            title="Reduce lead time"
          >
            −
          </button>
          <span className="px-1 text-[11px] font-semibold text-[#1B1464] bg-[#FAFAF9] border-x border-[#E7E5E4] min-w-[32px] text-center h-full flex items-center justify-center">
            {task.durationDays || (task.startDate && task.dueDate ? differenceInBusinessDays(parseISO(task.dueDate), parseISO(task.startDate)) : '—')}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const current = task.durationDays || (task.startDate && task.dueDate ? differenceInBusinessDays(parseISO(task.dueDate), parseISO(task.startDate)) : 3);
              const newDuration = current + 1;
              const startDate = task.startDate || (task.dueDate ? format(addBusinessDays(parseISO(task.dueDate), -current), 'yyyy-MM-dd') : null);
              if (startDate) {
                const newDueDate = format(addBusinessDays(parseISO(startDate), newDuration), 'yyyy-MM-dd');
                updateTaskDateWithCascade(task.id, newDueDate, { durationDays: newDuration });
              } else {
                updateTaskField(task.id, { durationDays: newDuration });
              }
            }}
            className="px-1.5 text-[11px] text-[#57534E] hover:bg-[#F5F5F4] transition-colors font-medium h-full"
            title="Increase lead time"
          >
            +
          </button>
        </div>

        {/* Due Date — inline editable */}
        {editingDate ? (
          <input
            type="date"
            value={task.dueDate || ''}
            onChange={(e) => {
              updateTaskDateWithCascade(task.id, e.target.value);
              setEditingDate(false);
            }}
            onBlur={() => setEditingDate(false)}
            onKeyDown={(e) => e.stopPropagation()}
            className="text-xs px-1 py-0.5 border border-[#FF1493] rounded bg-white focus:outline-none"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setEditingDate(true)}
            className={`text-xs text-left hover:text-[#FF1493] transition-colors ${isOverdue || isPastLaunch ? 'text-[#DC2626] font-medium' : 'text-[#57534E]'}`}
            title={isPastLaunch ? 'Past launch date! Click to edit (cascades to downstream tasks)' : 'Click to edit due date (cascades to downstream tasks)'}
          >
            {task.dueDate ? format(parseISO(task.dueDate), 'MMM d, yyyy') : '+ Set date'}
          </button>
        )}

        {/* Status pill */}
        <div className="relative" ref={statusRef}>
          <button
            onClick={() => setStatusOpen(!statusOpen)}
            className="flex items-center gap-1.5 rounded-full pl-1.5 pr-2 py-1 border transition-colors hover:shadow-sm text-left"
            style={{
              color: currentStatus.color,
              borderColor: currentStatus.color + '40',
              background: currentStatus.color + '10',
            }}
          >
            {currentStatus.icon}
            <span className="text-[10px] font-semibold whitespace-nowrap">{currentStatus.label}</span>
          </button>
          {statusOpen && (
            <div className="fixed z-[100] bg-white rounded-lg border border-[#E7E5E4] shadow-lg py-1 w-[200px] animate-fade-in" style={{ top: (statusRef.current?.getBoundingClientRect().bottom ?? 0) + 4, left: (statusRef.current?.getBoundingClientRect().left ?? 0) - 60 }}>
              {STATUS_OPTIONS.map(s => (
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

        <button
          onClick={onToggleExpand}
          className="text-[#D6D3D1] hover:text-[#57534E] transition-colors text-xs"
          title="Details"
        >
          ···
        </button>
      </div>

      {/* Expanded detail panel */}
      {isExpanded && (
        <div className="px-4 pb-4 ml-9 space-y-3 animate-fade-in">

          {/* Task name edit */}
          <div className="flex items-center gap-2">
            {editingName ? (
              <input
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={() => { updateTaskField(task.id, { name: nameValue.trim() || task.name }); setEditingName(false); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { updateTaskField(task.id, { name: nameValue.trim() || task.name }); setEditingName(false); } if (e.key === 'Escape') { setNameValue(task.name); setEditingName(false); } }}
                className="text-sm font-medium text-[#1B1464] border-b border-[#FF1493] outline-none bg-transparent flex-1"
                autoFocus
              />
            ) : (
              <>
                <span className="text-sm font-medium text-[#1B1464]">{task.name}</span>
                <button
                  onClick={() => { setNameValue(task.name); setEditingName(true); }}
                  className="p-0.5 rounded hover:bg-[#F5F5F4] text-[#A8A29E] hover:text-[#57534E] transition-colors"
                  title="Edit task name"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </>
            )}
          </div>

          {/* Schedule window + lead time control */}
          <div className="flex items-center gap-3 flex-wrap">
            {task.startDate && task.dueDate && (
              <div className="flex items-center gap-1.5 text-[11px] text-[#57534E]">
                <Calendar className="w-3 h-3 text-[#A8A29E]" />
                <span>{format(parseISO(task.startDate), 'MMM d')} → {format(parseISO(task.dueDate), 'MMM d, yyyy')}</span>
              </div>
            )}
            {/* Lead time / duration adjuster */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[#A8A29E]">Lead time:</span>
              <div className="inline-flex items-center border border-[#E7E5E4] rounded-lg overflow-hidden">
                <button
                  onClick={() => {
                    const current = task.durationDays || (task.startDate && task.dueDate ? differenceInBusinessDays(parseISO(task.dueDate), parseISO(task.startDate)) : 3);
                    if (current <= 1) return;
                    const newDuration = current - 1;
                    const startDate = task.startDate || (task.dueDate ? format(addBusinessDays(parseISO(task.dueDate), -newDuration), 'yyyy-MM-dd') : null);
                    if (startDate) {
                      const newDueDate = format(addBusinessDays(parseISO(startDate), newDuration), 'yyyy-MM-dd');
                      updateTaskDateWithCascade(task.id, newDueDate, { durationDays: newDuration });
                    } else {
                      updateTaskField(task.id, { durationDays: newDuration });
                    }
                  }}
                  className="px-1.5 py-0.5 text-[11px] text-[#57534E] hover:bg-[#F5F5F4] transition-colors font-medium"
                  title="Reduce lead time by 1 BD"
                >
                  −
                </button>
                <span className="px-2 py-0.5 text-[11px] font-semibold text-[#1B1464] bg-[#FAFAF9] border-x border-[#E7E5E4] min-w-[40px] text-center">
                  {task.durationDays || (task.startDate && task.dueDate ? differenceInBusinessDays(parseISO(task.dueDate), parseISO(task.startDate)) : '—')} BD
                </span>
                <button
                  onClick={() => {
                    const current = task.durationDays || (task.startDate && task.dueDate ? differenceInBusinessDays(parseISO(task.dueDate), parseISO(task.startDate)) : 3);
                    const newDuration = current + 1;
                    const startDate = task.startDate || (task.dueDate ? format(addBusinessDays(parseISO(task.dueDate), -current), 'yyyy-MM-dd') : null);
                    if (startDate) {
                      const newDueDate = format(addBusinessDays(parseISO(startDate), newDuration), 'yyyy-MM-dd');
                      updateTaskDateWithCascade(task.id, newDueDate, { durationDays: newDuration });
                    } else {
                      updateTaskField(task.id, { durationDays: newDuration });
                    }
                  }}
                  className="px-1.5 py-0.5 text-[11px] text-[#57534E] hover:bg-[#F5F5F4] transition-colors font-medium"
                  title="Increase lead time by 1 BD"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* 1. Dependencies — read-only pills with edit toggle */}
          {(task.dependencies.length > 0 || editingDeps || launch.tasks.some(t => t.dependencies.includes(task.id))) && (
            <div className="space-y-1.5">
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <label className="text-[11px] font-medium text-[#57534E]">Depends on</label>
                  {!editingDeps && (
                    <button
                      onClick={() => setEditingDeps(true)}
                      className="p-0.5 rounded hover:bg-[#F5F5F4] text-[#A8A29E] hover:text-[#57534E] transition-colors"
                      title="Edit dependencies"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {task.dependencies.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {task.dependencies.map(depId => {
                      const dep = launch.tasks.find(t => t.id === depId);
                      if (!dep) return null;
                      const isComplete = dep.status === 'complete';
                      return (
                        <div
                          key={depId}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border group/dep ${
                            isComplete
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-[#F5F5F4] text-[#57534E] border-[#E7E5E4]'
                          }`}
                        >
                          <button
                            onClick={() => onNavigateToTask?.(dep.id)}
                            className="inline-flex items-center gap-1 cursor-pointer hover:text-[#FF1493] transition-colors"
                            title={`Go to ${dep.name}`}
                          >
                            {isComplete
                              ? <CheckCircle2 className="w-3 h-3" />
                              : <Circle className="w-3 h-3" />
                            }
                            {dep.name}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const newDeps = task.dependencies.filter(d => d !== depId);
                              updateTaskField(task.id, { dependencies: newDeps });
                            }}
                            className="ml-0.5 p-0.5 rounded-full opacity-0 group-hover/dep:opacity-100 hover:bg-red-100 hover:text-red-500 text-[#A8A29E] transition-all"
                            title={`Remove dependency on ${dep.name}`}
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : !editingDeps ? (
                  <p className="text-[10px] text-[#A8A29E]">No dependencies</p>
                ) : null}
                {task.dependencies.length > 0 && !editingDeps && (() => {
                  const allDepsComplete = task.dependencies.every(depId => {
                    const dep = launch.tasks.find(t => t.id === depId);
                    return dep && (dep.status === 'complete' || dep.status === 'skipped');
                  });
                  if (allDepsComplete) {
                    return <p className="text-[10px] text-emerald-600 mt-1">All dependencies complete</p>;
                  }
                  // Find the driving dep among INCOMPLETE deps only
                  const drivingDep = task.dependencies.reduce<GTMTask | null>((latest, depId) => {
                    const dep = launch.tasks.find(t => t.id === depId);
                    if (!dep?.dueDate) return latest;
                    if (dep.status === 'complete' || dep.status === 'skipped') return latest;
                    if (!latest?.dueDate) return dep;
                    return dep.dueDate > latest.dueDate ? dep : latest;
                  }, null);
                  return drivingDep ? (
                    <p className="text-[10px] text-[#A8A29E] mt-1">
                      Waiting on incomplete dependencies
                      {task.dependencies.length > 1 && (
                        <span className="text-[#FF1493]"> — driven by: {drivingDep.name} ({drivingDep.dueDate ? format(parseISO(drivingDep.dueDate), 'MMM d') : 'no date'})</span>
                      )}
                    </p>
                  ) : null;
                })()}
                {editingDeps && (
                  <div className="mt-2">
                    <label className="text-[10px] font-medium text-[#57534E] mb-1 block">Edit Dependencies</label>
                    <select
                      multiple
                      value={task.dependencies}
                      onChange={e => {
                        const selected = Array.from(e.target.selectedOptions).map(o => o.value);
                        updateTaskField(task.id, { dependencies: selected });
                      }}
                      className="w-[280px] px-2 py-1 border border-[#E7E5E4] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#FF1493]/20 max-h-[100px]"
                    >
                      {launch.tasks
                        .filter(t => t.id !== task.id)
                        .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
                        .map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))
                      }
                    </select>
                    <p className="text-[10px] text-[#A8A29E] mt-0.5">Hold Cmd/Ctrl to select multiple</p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => setEditingDeps(false)}
                        className="px-3 py-1 bg-[#FF1493] text-white text-[11px] font-medium rounded-lg hover:bg-[#D4117D] transition-colors"
                      >
                        Done
                      </button>
                      <button
                        onClick={() => setEditingDeps(false)}
                        className="px-3 py-1 text-[#57534E] text-[11px] font-medium hover:bg-[#F5F5F4] rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {(() => {
                const blockedTasks = launch.tasks.filter(t => t.dependencies.includes(task.id));
                if (blockedTasks.length === 0) return null;
                return (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <label className="text-[11px] font-medium text-[#57534E]">Blocks ({blockedTasks.length})</label>
                    </div>
                    <div className="space-y-1">
                      {blockedTasks.map(bt => (
                        <div
                          key={bt.id}
                          className="flex items-center gap-2 group/block"
                        >
                          <button
                            onClick={() => {
                              const newDeps = bt.dependencies.filter(d => d !== task.id);
                              updateTaskField(bt.id, { dependencies: newDeps });
                            }}
                            className="w-4 h-4 rounded border border-amber-300 bg-amber-50 flex items-center justify-center shrink-0 hover:bg-red-100 hover:border-red-300 transition-colors group/cb"
                            title={`Unblock — remove ${bt.name}'s dependency on this task`}
                          >
                            <X className="w-2.5 h-2.5 text-amber-400 group-hover/cb:text-red-500 transition-colors" />
                          </button>
                          <button
                            onClick={() => onNavigateToTask?.(bt.id)}
                            className={`text-[11px] truncate cursor-pointer hover:text-[#FF1493] transition-colors ${
                              bt.status === 'complete' || bt.status === 'skipped' ? 'text-[#A8A29E] line-through' : 'text-[#44403C]'
                            }`}
                            title={`Go to ${bt.name}`}
                          >
                            {bt.name}
                          </button>
                          <span className="text-[9px] text-[#A8A29E] shrink-0">
                            {bt.dueDate ? format(parseISO(bt.dueDate), 'MMM d') : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* 2. Deliverable — compact link preview or inline add */}
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <LinkIcon className="w-3 h-3 text-[#57534E]" />
              <label className="text-[11px] font-medium text-[#57534E]">
                {deliverableLabel || 'Deliverable'}
              </label>
              {hasLink && (
                <button
                  onClick={() => setEditingLink(!editingLink)}
                  className="p-0.5 rounded hover:bg-[#F5F5F4] text-[#A8A29E] hover:text-[#57534E] transition-colors"
                  title="Edit link"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>
            {hasLink && !editingLink ? (
              <a
                href={task.deliverableUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FFF0F7] text-[#FF1493] rounded-lg text-xs font-medium hover:bg-[#FF1493] hover:text-white transition-colors"
              >
                <ExternalLink className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[300px]">{getDisplayLabel(task)}</span>
              </a>
            ) : hasLink && editingLink ? (
              <div className="flex gap-2 items-center">
                <input
                  type="url"
                  value={task.deliverableUrl || ''}
                  onChange={e => updateDeliverableUrl(task.id, e.target.value)}
                  placeholder="Paste link..."
                  className="flex-1 px-3 py-1.5 border border-[#E7E5E4] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#FF1493]/20"
                />
                <input
                  type="text"
                  value={linkLabel}
                  onChange={e => { setLinkLabel(e.target.value); updateTaskField(task.id, { deliverableLabel: e.target.value }); }}
                  placeholder="Label (optional)"
                  className="w-[180px] px-3 py-1.5 border border-[#E7E5E4] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#FF1493]/20"
                />
                <button
                  onClick={() => setEditingLink(false)}
                  className="text-[#A8A29E] hover:text-[#57534E] p-1 rounded hover:bg-[#F5F5F4] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : !editingLink ? (
              <button
                onClick={() => setEditingLink(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-dashed border-[#D6D3D1] text-[#A8A29E] rounded-lg text-xs hover:border-[#FF1493] hover:text-[#FF1493] hover:bg-[#FFF0F7] transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add link
              </button>
            ) : (
              <div className="flex gap-2 items-center">
                <input
                  type="url"
                  value={task.deliverableUrl || ''}
                  onChange={e => updateDeliverableUrl(task.id, e.target.value)}
                  placeholder="Paste Google Drive, Dropbox, or other link..."
                  className="flex-1 px-3 py-1.5 border border-[#E7E5E4] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#FF1493]/20"
                  autoFocus
                />
                <input
                  type="text"
                  value={linkLabel}
                  onChange={e => { setLinkLabel(e.target.value); updateTaskField(task.id, { deliverableLabel: e.target.value }); }}
                  placeholder="Label (optional)"
                  className="w-[180px] px-3 py-1.5 border border-[#E7E5E4] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#FF1493]/20"
                />
                <button
                  onClick={() => setEditingLink(false)}
                  className="text-[#A8A29E] hover:text-[#57534E] p-1 rounded hover:bg-[#F5F5F4] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* 3. Meeting scheduler — only for meeting tasks */}
          {task.isMeeting && (
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-900 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Meeting
                  </p>
                  {task.startDate && task.dueDate && task.startDate !== task.dueDate ? (
                    <p className="text-[11px] text-blue-700 mt-0.5">
                      Schedule between {format(parseISO(task.startDate), 'MMM d')} and {format(parseISO(task.dueDate), 'MMM d')}
                    </p>
                  ) : task.dueDate ? (
                    <p className="text-[11px] text-blue-700 mt-0.5">
                      Due {format(parseISO(task.dueDate), 'MMM d, yyyy')}
                    </p>
                  ) : null}
                </div>
                <a
                  href={`https://outlook.office.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(task.name + ' \u2014 ' + launch.name)}&startdt=${task.startDate || task.dueDate || ''}T09:00:00&enddt=${task.startDate || task.dueDate || ''}T10:00:00`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors shrink-0"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Schedule in Outlook
                </a>
              </div>
            </div>
          )}

          {/* 3b. Sub-items / Checklist */}
          {task.meetingChecklist && task.meetingChecklist.length > 0 && (
            <div className="bg-[#FAFAF9] rounded-lg border border-[#E7E5E4] p-3">
              <p className="text-[11px] font-medium text-[#57534E] mb-2">
                {task.isMeeting ? 'Discussion Items' : 'Sub-items'}
              </p>
              <div className="space-y-1.5">
                {task.meetingChecklist.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-[#57534E]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#A8A29E] shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Approval tracking */}
          <div>
            <label className="block text-[11px] font-medium text-[#57534E] mb-1.5">Approval Status</label>
            <div className="flex items-center gap-1.5">
              {(['draft', 'submitted', 'approved', 'revision_needed'] as const).map(status => {
                const isActive = (task.approvalStatus || 'draft') === status;
                const colors: Record<string, string> = {
                  draft: '#6B7280',
                  submitted: '#3B82F6',
                  approved: '#10B981',
                  revision_needed: '#F59E0B',
                };
                const labels: Record<string, string> = {
                  draft: 'Draft',
                  submitted: 'Submitted',
                  approved: 'Approved',
                  revision_needed: 'Needs Revision',
                };
                return (
                  <button
                    key={status}
                    onClick={() => {
                      const updates: Partial<GTMTask> = { approvalStatus: status };
                      if (status === 'submitted') updates.submittedDate = new Date().toISOString();
                      if (status === 'approved') updates.approvedDate = new Date().toISOString();
                      updateTaskField(task.id, updates);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-semibold border transition-colors ${
                      isActive
                        ? 'text-white border-transparent'
                        : 'bg-white hover:bg-[#F5F5F4]'
                    }`}
                    style={isActive
                      ? { background: colors[status], borderColor: colors[status] }
                      : { color: colors[status], borderColor: colors[status] + '40' }
                    }
                  >
                    {labels[status]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Notes & Updates — collapsible */}
          <div>
            <button
              onClick={() => setNotesOpen(!notesOpen)}
              className="flex items-center gap-1 text-[11px] font-medium text-[#57534E] hover:text-[#1B1464] transition-colors"
            >
              {notesOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Notes & Updates
              {task.notes && task.notes.trim() && !notesOpen && (
                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-[#FF1493] shrink-0" />
              )}
            </button>
            {notesOpen && (
              <textarea
                value={task.notes}
                onChange={e => updateTaskNotes(task.id, e.target.value)}
                placeholder="Add notes or status updates..."
                rows={3}
                className="w-full mt-1.5 px-3 py-2 border border-[#E7E5E4] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#FF1493]/20 resize-none"
              />
            )}
          </div>

          {/* 6. Lead Time & Dependencies — collapsible power-user section */}
          <div>
            <button
              onClick={() => setAdvancedOpen(!advancedOpen)}
              className="flex items-center gap-1 text-[11px] font-medium text-[#A8A29E] hover:text-[#57534E] transition-colors"
            >
              {advancedOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <Settings2 className="w-3 h-3" />
              Lead Time & Dependencies
            </button>
            {advancedOpen && (
              <div className="flex gap-4 mt-2">
                <div>
                  <label className="block text-[11px] font-medium text-[#57534E] mb-1">Lead Time (days)</label>
                  <input
                    type="number"
                    min={1}
                    value={task.durationDays}
                    onChange={e => updateTaskField(task.id, { durationDays: parseInt(e.target.value) || 1 })}
                    className="w-20 px-2 py-1.5 border border-[#E7E5E4] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#FF1493]/20"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#57534E] mb-1">Edit Dependencies</label>
                  <select
                    multiple
                    value={task.dependencies}
                    onChange={e => {
                      const selected = Array.from(e.target.selectedOptions).map(o => o.value);
                      updateTaskField(task.id, { dependencies: selected });
                    }}
                    className="w-[240px] px-2 py-1 border border-[#E7E5E4] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#FF1493]/20 max-h-[80px]"
                  >
                    {launch.tasks
                      .filter(t => t.id !== task.id)
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))
                    }
                  </select>
                  <p className="text-[10px] text-[#A8A29E] mt-0.5">Hold Cmd/Ctrl to select multiple</p>
                </div>
              </div>
            )}
          </div>

          {/* 7. Delete task — danger zone */}
          <div className="pt-2 border-t border-[#E7E5E4]">
            <button
              onClick={() => {
                if (confirm(`Delete task "${task.name}"?`)) onDeleteTask(task.id);
              }}
              className="inline-flex items-center gap-1.5 text-[11px] text-[#DC2626] hover:bg-red-50 px-2 py-1 rounded transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Delete task
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DeliverablesView({ launch }: { launch: Launch }) {
  const tasksWithLinks = launch.tasks.filter(t => t.deliverableUrl && t.deliverableUrl.trim());
  const tasksMissingLinks = launch.tasks.filter(t => DELIVERABLE_TASKS[t.name] && (!t.deliverableUrl || !t.deliverableUrl.trim()));

  return (
    <div className="space-y-6">
      {/* Linked deliverables */}
      <div>
        <h3 className="text-sm font-semibold text-[#1B1464] mb-3">
          Linked Deliverables ({tasksWithLinks.length})
        </h3>
        {tasksWithLinks.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E7E5E4] p-8 text-center">
            <LinkIcon className="w-8 h-8 text-[#D6D3D1] mx-auto mb-2" />
            <p className="text-sm text-[#A8A29E]">No deliverables linked yet.</p>
            <p className="text-xs text-[#D6D3D1] mt-1">Add links to tasks in the Task Tracker tab.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#E7E5E4] divide-y divide-[#E7E5E4]">
            {tasksWithLinks.map(task => {
              const phase = PHASES.find(p => p.key === task.phase);
              return (
                <div key={task.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAF9] transition-colors">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: phase?.color || '#6B7280' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#1B1464] font-medium truncate">{task.name}</p>
                    <p className="text-[11px] text-[#A8A29E]">{phase?.name || 'Unknown Phase'}</p>
                  </div>
                  <a
                    href={task.deliverableUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FFF0F7] text-[#FF1493] rounded-lg text-xs font-medium hover:bg-[#FF1493] hover:text-white transition-colors shrink-0"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {getDisplayLabel(task)}
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Missing deliverables */}
      {tasksMissingLinks.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[#A8A29E] mb-3">
            Missing Links ({tasksMissingLinks.length})
          </h3>
          <div className="bg-white rounded-xl border border-[#E7E5E4] divide-y divide-[#E7E5E4]">
            {tasksMissingLinks.map(task => {
              const phase = PHASES.find(p => p.key === task.phase);
              return (
                <div key={task.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-2 h-2 rounded-full shrink-0 opacity-40" style={{ background: phase?.color || '#6B7280' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#A8A29E] truncate">{task.name}</p>
                    <p className="text-[11px] text-[#D6D3D1]">{DELIVERABLE_TASKS[task.name]}</p>
                  </div>
                  <span className="text-[11px] text-[#D6D3D1] px-2 py-0.5 bg-[#F5F5F4] rounded">No link</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MeetingsView({ launch, updateTaskStatus }: { launch: Launch; updateTaskStatus: (taskId: string, status: TaskStatus) => void }) {
  const meetingTasks = launch.tasks
    .filter(t => t.isMeeting)
    .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));

  const upcoming = meetingTasks.filter(t => t.status !== 'complete' && t.status !== 'skipped');
  const past = meetingTasks.filter(t => t.status === 'complete' || t.status === 'skipped');

  const buildOutlookUrl = (task: GTMTask) => {
    const date = task.dueDate || task.startDate || '';
    return `https://outlook.office.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(task.name + ' \u2014 ' + launch.name)}&startdt=${date}T09:00:00&enddt=${date}T10:00:00`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-[#1B1464] mb-3">
          Upcoming Meetings ({upcoming.length})
        </h3>
        {upcoming.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E7E5E4] p-8 text-center">
            <Calendar className="w-8 h-8 text-[#D6D3D1] mx-auto mb-2" />
            <p className="text-sm text-[#A8A29E]">All meetings scheduled or completed.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#E7E5E4] divide-y divide-[#E7E5E4]">
            {upcoming.map(task => {
              const phase = PHASES.find(p => p.key === task.phase);
              const isOverdue = task.dueDate && parseISO(task.dueDate) < new Date();
              return (
                <div key={task.id} className={`flex items-center gap-3 px-4 py-3 ${isOverdue ? 'bg-red-50/50' : 'hover:bg-[#FAFAF9]'} transition-colors`}>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: phase?.color || '#6B7280' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#1B1464] font-medium truncate">{task.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {task.startDate && task.dueDate && task.startDate !== task.dueDate ? (
                        <p className="text-[11px] text-[#57534E]">
                          {format(parseISO(task.startDate), 'MMM d')} – {format(parseISO(task.dueDate), 'MMM d, yyyy')}
                        </p>
                      ) : task.dueDate ? (
                        <p className={`text-[11px] ${isOverdue ? 'text-[#DC2626] font-medium' : 'text-[#57534E]'}`}>
                          {isOverdue ? 'Overdue — was ' : ''}{format(parseISO(task.dueDate), 'MMM d, yyyy')}
                        </p>
                      ) : null}
                      <p className="text-[11px] text-[#A8A29E]">{OWNER_LABELS[task.owner]}</p>
                    </div>
                    {task.meetingChecklist && task.meetingChecklist.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {task.meetingChecklist.map((item, i) => (
                          <p key={i} className="text-[10px] text-[#A8A29E] flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-[#D6D3D1] shrink-0" />
                            {item}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={buildOutlookUrl(task)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-600 hover:text-white transition-colors"
                    >
                      <Calendar className="w-3 h-3" />
                      Schedule
                    </a>
                    <button
                      onClick={() => updateTaskStatus(task.id, 'complete')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-[#E7E5E4] text-[#A8A29E] rounded-lg text-xs hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-colors"
                    >
                      <Check className="w-3 h-3" />
                      Done
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {past.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[#A8A29E] mb-3">
            Completed ({past.length})
          </h3>
          <div className="bg-white rounded-xl border border-[#E7E5E4] divide-y divide-[#E7E5E4]">
            {past.map(task => (
              <div key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <p className="text-sm text-[#A8A29E] line-through truncate flex-1">{task.name}</p>
                {task.dueDate && (
                  <span className="text-[11px] text-[#D6D3D1]">{format(parseISO(task.dueDate), 'MMM d')}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

