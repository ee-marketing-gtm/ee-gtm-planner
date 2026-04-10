'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { FileText, ExternalLink, Plus, Package, ChevronUp, ChevronDown } from 'lucide-react';
import { Launch, GTMTask, DELIVERABLE_TASKS } from '@/lib/types';
import { useData } from '@/components/DataProvider';
import { getStatusColor, getStatusLabel, getLaunchChipStyle, getLaunchColor, getLaunchDotStyle } from '@/lib/utils';

interface DeliverableRow {
  task: GTMTask;
  launch: Launch;
  deliverableLabel: string;
}

export default function DeliverablesPage() {
  const { launches: allLaunches, loading } = useData();
  const launches = useMemo(
    () => allLaunches.filter(l => l.status !== 'archived'),
    [allLaunches]
  );
  const [mounted, setMounted] = useState(false);
  const [selectedLaunches, setSelectedLaunches] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<'task' | 'launch' | 'dueDate' | 'status'>('dueDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (field: 'task' | 'launch' | 'dueDate' | 'status') => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  useEffect(() => {
    if (loading) return;
    setSelectedLaunches(new Set(launches.map(l => l.id)));
    setMounted(true);
  }, [loading, launches]);

  const toggleLaunch = (id: string) => {
    setSelectedLaunches(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => setSelectedLaunches(new Set(launches.map(l => l.id)));
  const selectNone = () => setSelectedLaunches(new Set());

  const rows = useMemo(() => {
    const result: DeliverableRow[] = [];
    for (const launch of launches) {
      if (!selectedLaunches.has(launch.id)) continue;
      for (const task of launch.tasks) {
        const isDeliverableTask = task.name in DELIVERABLE_TASKS || !!task.deliverableUrl;
        if (!isDeliverableTask) continue;
        result.push({
          task,
          launch,
          deliverableLabel: task.deliverableLabel || DELIVERABLE_TASKS[task.name] || 'Deliverable',
        });
      }
    }

    const statusOrder: Record<string, number> = { 'not-started': 0, 'in-progress': 1, 'blocked': 2, 'complete': 3, 'skipped': 4 };
    const dir = sortDirection === 'asc' ? 1 : -1;

    return result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'task':
          cmp = a.task.name.localeCompare(b.task.name);
          break;
        case 'launch':
          cmp = a.launch.name.localeCompare(b.launch.name);
          break;
        case 'dueDate':
          cmp = (a.task.dueDate || '9999').localeCompare(b.task.dueDate || '9999');
          break;
        case 'status':
          cmp = (statusOrder[a.task.status] ?? 99) - (statusOrder[b.task.status] ?? 99);
          break;
      }
      return cmp * dir;
    });
  }, [launches, selectedLaunches, sortField, sortDirection]);

  if (!mounted || loading) return <div className="p-8" />;

  const totalMissing = rows.filter(r => !r.task.deliverableUrl).length;
  const totalLinked = rows.filter(r => !!r.task.deliverableUrl).length;

  return (
    <div className="p-8 max-w-[1400px]">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1B1464]">Deliverables</h1>
        <p className="text-sm text-[#A8A29E] mt-1">
          Track all deliverables across launches &mdash; see what&apos;s linked, what&apos;s missing, and jump to add links.
        </p>
      </div>

      {/* Launch selector */}
      <div className="bg-white rounded-xl border border-[#E7E5E4] p-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-[#57534E]">Filter by launch:</span>
          <button onClick={selectAll} className="text-[11px] text-[#3538CD] hover:underline">All</button>
          <button onClick={selectNone} className="text-[11px] text-[#A8A29E] hover:underline">None</button>
          <div className="w-px h-4 bg-[#E7E5E4]" />
          {launches.map(l => (
            <button
              key={l.id}
              onClick={() => toggleLaunch(l.id)}
              className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                selectedLaunches.has(l.id)
                  ? 'bg-[#EEF0FF] border-[#3538CD] text-[#3538CD]'
                  : 'bg-white border-[#E7E5E4] text-[#A8A29E] hover:border-[#D6D3D1]'
              }`}
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-4">
        <p className="text-xs text-[#A8A29E]">{rows.length} deliverables shown</p>
        <span className="text-xs text-[#10B981]">{totalLinked} linked</span>
        <span className="text-xs text-[#DC2626]">{totalMissing} missing</span>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E7E5E4] p-12 text-center">
          <Package className="w-10 h-10 text-[#D6D3D1] mx-auto mb-3" />
          <p className="text-sm text-[#A8A29E]">No deliverables found. Select a launch above or create a new launch.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E7E5E4] overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[minmax(0,2.2fr)_minmax(180px,260px)_90px_110px_minmax(160px,200px)] gap-3 px-4 py-3 bg-[#FAFAF9] border-b border-[#E7E5E4]">
            {([['task', 'Task Name'], ['launch', 'Launch'], ['dueDate', 'Due Date'], ['status', 'Status']] as const).map(([field, label]) => (
              <button
                key={field}
                onClick={() => toggleSort(field)}
                className="flex items-center gap-1 text-[11px] font-semibold text-[#57534E] uppercase tracking-wide hover:text-[#1B1464] transition-colors text-left"
              >
                {label}
                {sortField === field ? (
                  sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-30" />
                )}
              </button>
            ))}
            <span className="text-[11px] font-semibold text-[#57534E] uppercase tracking-wide">Deliverable</span>
          </div>
          {/* Rows */}
          {rows.map(({ task, launch, deliverableLabel }) => (
            <div
              key={`${launch.id}-${task.id}`}
              className="grid grid-cols-[minmax(0,2.2fr)_minmax(180px,260px)_90px_110px_minmax(160px,200px)] gap-3 px-4 py-3 items-center border-t border-[#E7E5E4] first:border-t-0 hover:bg-[#FAFAF9] transition-colors"
            >
              {/* Task Name */}
              <div className="min-w-0">
                <Link
                  href={`/launch/${launch.id}?task=${task.id}`}
                  className="text-sm text-[#1B1464] hover:text-[#3538CD] transition-colors truncate block"
                >
                  {task.name}
                </Link>
              </div>

              {/* Launch */}
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold truncate w-fit max-w-full"
                style={getLaunchChipStyle(getLaunchColor(launch))}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={getLaunchDotStyle(getLaunchColor(launch))}
                />
                <span className="truncate">{launch.name}</span>
              </span>

              {/* Due Date */}
              <span className="text-xs text-[#57534E]">
                {task.dueDate ? format(parseISO(task.dueDate), 'MMM d') : '\u2014'}
              </span>

              {/* Status */}
              <span
                className="text-[11px] font-medium px-2 py-0.5 rounded-full w-fit whitespace-nowrap"
                style={{
                  background: getStatusColor(task.status) + '15',
                  color: getStatusColor(task.status),
                }}
              >
                {getStatusLabel(task.status)}
              </span>

              {/* Deliverable Link */}
              {task.deliverableUrl ? (
                <a
                  href={task.deliverableUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={deliverableLabel}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-[#F0FDF4] text-[#10B981] border border-[#10B981]/20 hover:bg-[#DCFCE7] transition-colors w-full max-w-full min-w-0"
                >
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  <span className="truncate">{deliverableLabel}</span>
                </a>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#A8A29E]">Missing</span>
                  <Link
                    href={`/launch/${launch.id}?task=${task.id}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#EEF0FF] text-[#3538CD] hover:bg-[#FFE0EF] transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
