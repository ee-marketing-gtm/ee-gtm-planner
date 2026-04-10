'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { Video, ExternalLink, ChevronDown, ChevronRight, CheckSquare, Square, CalendarDays } from 'lucide-react';
import { Launch, GTMTask } from '@/lib/types';
import { useData } from '@/components/DataProvider';
import { getStatusColor, getStatusLabel, getLaunchChipStyle, getLaunchColor } from '@/lib/utils';

interface MeetingRow {
  task: GTMTask;
  launch: Launch;
}

export default function MeetingsPage() {
  const { launches: allLaunches, loading } = useData();
  const launches = useMemo(
    () => allLaunches.filter(l => l.status !== 'archived'),
    [allLaunches]
  );
  const [mounted, setMounted] = useState(false);
  const [selectedLaunches, setSelectedLaunches] = useState<Set<string>>(new Set());
  const [expandedMeetings, setExpandedMeetings] = useState<Set<string>>(new Set());

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

  const toggleExpanded = (key: string) => {
    setExpandedMeetings(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAll = () => setSelectedLaunches(new Set(launches.map(l => l.id)));
  const selectNone = () => setSelectedLaunches(new Set());

  const rows = useMemo(() => {
    const result: MeetingRow[] = [];
    for (const launch of launches) {
      if (!selectedLaunches.has(launch.id)) continue;
      for (const task of launch.tasks) {
        const isMeetingByName = /meeting|review meeting|alignment meeting|brainstorm/i.test(task.name);
        if (!task.isMeeting && !isMeetingByName) continue;
        result.push({ task, launch });
      }
    }
    return result.sort((a, b) => (a.task.dueDate || '9999').localeCompare(b.task.dueDate || '9999'));
  }, [launches, selectedLaunches]);

  const buildOutlookUrl = (task: GTMTask, launch: Launch): string => {
    const subject = encodeURIComponent(`${task.name} - ${launch.name}`);
    const startDate = task.startDate || task.dueDate || '';
    return `https://outlook.office.com/calendar/0/deeplink/compose?subject=${subject}&startdt=${startDate}T09:00:00&enddt=${startDate}T10:00:00`;
  };

  if (!mounted || loading) return <div className="p-8" />;

  return (
    <div className="p-8 max-w-[1400px]">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1B1464]">Meetings</h1>
        <p className="text-sm text-[#A8A29E] mt-1">
          All meetings across launches &mdash; schedule in Outlook and track checklist items.
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

      {/* Count */}
      <p className="text-xs text-[#A8A29E] mb-4">{rows.length} meetings shown</p>

      {/* Meeting cards */}
      {rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E7E5E4] p-12 text-center">
          <Video className="w-10 h-10 text-[#D6D3D1] mx-auto mb-3" />
          <p className="text-sm text-[#A8A29E]">No meetings found. Select a launch above or create a new launch.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(({ task, launch }) => {
            const key = `${launch.id}-${task.id}`;
            const isExpanded = expandedMeetings.has(key);
            const hasChecklist = task.meetingChecklist && task.meetingChecklist.length > 0;

            return (
              <div
                key={key}
                className="bg-white rounded-xl border border-[#E7E5E4] overflow-hidden"
              >
                {/* Main row */}
                <div className="grid grid-cols-[1fr_160px_240px_100px_auto] gap-3 px-4 py-3 items-center">
                  {/* Meeting name + launch */}
                  <div>
                    <Link
                      href={`/launch/${launch.id}?task=${task.id}`}
                      className="text-sm font-medium text-[#1B1464] hover:text-[#3538CD] transition-colors"
                    >
                      {task.name}
                    </Link>
                    <span
                      className="inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                      style={getLaunchChipStyle(getLaunchColor(launch))}
                    >
                      {launch.name}
                    </span>
                  </div>

                  {/* Schedule Window */}
                  <div>
                    {task.startDate && task.dueDate ? (
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-[#3538CD]" />
                        <span className="text-xs text-[#57534E]">
                          {format(parseISO(task.startDate), 'MMM d')} &rarr; {format(parseISO(task.dueDate), 'MMM d')}
                        </span>
                      </div>
                    ) : task.dueDate ? (
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-[#A8A29E]" />
                        <span className="text-xs text-[#57534E]">
                          By {format(parseISO(task.dueDate), 'MMM d')}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-[#A8A29E]">&mdash;</span>
                    )}
                    {task.startDate && task.dueDate && (
                      <p className="text-[10px] text-[#A8A29E] mt-0.5">
                        Schedule between {format(parseISO(task.startDate), 'MMM d')} and {format(parseISO(task.dueDate), 'MMM d')}
                      </p>
                    )}
                  </div>

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

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <a
                      href={buildOutlookUrl(task, launch)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-[#1B1464] text-white hover:bg-[#2D2378] transition-colors whitespace-nowrap"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Schedule in Outlook
                    </a>
                    {hasChecklist && (
                      <button
                        onClick={() => toggleExpanded(key)}
                        className="p-1 rounded hover:bg-[#F5F5F4] transition-colors"
                      >
                        {isExpanded
                          ? <ChevronDown className="w-4 h-4 text-[#57534E]" />
                          : <ChevronRight className="w-4 h-4 text-[#57534E]" />
                        }
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded checklist */}
                {isExpanded && hasChecklist && (
                  <div className="px-4 py-3 bg-[#FAFAF9] border-t border-[#E7E5E4]">
                    <p className="text-[11px] font-semibold text-[#57534E] uppercase tracking-wide mb-2">Meeting Checklist</p>
                    <div className="space-y-1.5">
                      {task.meetingChecklist!.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          {task.status === 'complete'
                            ? <CheckSquare className="w-3.5 h-3.5 text-[#10B981] mt-0.5 flex-shrink-0" />
                            : <Square className="w-3.5 h-3.5 text-[#D6D3D1] mt-0.5 flex-shrink-0" />
                          }
                          <span className="text-xs text-[#57534E]">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
