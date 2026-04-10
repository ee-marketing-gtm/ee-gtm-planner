'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { Rocket, Filter, ChevronRight } from 'lucide-react';
import { LaunchTier, TIER_CONFIG, LAUNCH_TYPE_LABELS } from '@/lib/types';
import { useData } from '@/components/DataProvider';
import { getLaunchProgress, getDaysUntilLaunch, getNextTask, getPhaseName, getLaunchColor, getLaunchChipStyle } from '@/lib/utils';

export default function LaunchesPage() {
  const { launches, loading } = useData();
  const [filterTier, setFilterTier] = useState<LaunchTier | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  if (loading) return <div className="p-8" />;

  const statusOrder: Record<string, number> = {
    planning: 0, in_progress: 0, launched: 1, post_launch: 2, archived: 3,
  };
  const filtered = launches.filter(l => {
    if (filterStatus === 'all' && l.status === 'archived') return false;
    if (filterTier !== 'all' && l.tier !== filterTier) return false;
    if (filterStatus !== 'all' && l.status !== filterStatus) return false;
    return true;
  }).sort((a, b) => {
    const oa = statusOrder[a.status] ?? 1;
    const ob = statusOrder[b.status] ?? 1;
    if (oa !== ob) return oa - ob;
    return a.launchDate.localeCompare(b.launchDate);
  });

  return (
    <div className="p-8 max-w-[1200px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1B1464]">All Launches</h1>
          <p className="text-sm text-[#A8A29E] mt-1">{launches.length} total launches</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <Filter className="w-4 h-4 text-[#A8A29E]" />
        <select
          value={filterTier}
          onChange={e => setFilterTier(e.target.value as LaunchTier | 'all')}
          className="text-xs px-3 py-1.5 border border-[#E7E5E4] rounded-lg bg-white focus:outline-none"
        >
          <option value="all">All Tiers</option>
          <option value="A">Tier A</option>
          <option value="B">Tier B</option>
          <option value="C">Tier C</option>
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-xs px-3 py-1.5 border border-[#E7E5E4] rounded-lg bg-white focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="planning">Planning</option>
          <option value="in_progress">In Progress</option>
          <option value="launched">Launched</option>
          <option value="post_launch">Post-Launch</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E7E5E4] p-12 text-center">
          <Rocket className="w-10 h-10 text-[#D6D3D1] mx-auto mb-3" />
          <p className="text-sm text-[#A8A29E]">No launches match your filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E7E5E4] overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_100px_100px_120px_150px_40px] gap-3 px-5 py-3 bg-[#FAFAF9] text-[11px] font-medium text-[#A8A29E] uppercase tracking-wider border-b border-[#E7E5E4]">
            <span>Launch</span>
            <span>Type</span>
            <span>Tier</span>
            <span>Date</span>
            <span>Progress</span>
            <span>Next Task</span>
            <span />
          </div>
          {filtered.map(launch => {
            const progress = getLaunchProgress(launch);
            const nextTask = getNextTask(launch);
            const daysUntil = getDaysUntilLaunch(launch);
            return (
              <Link key={launch.id} href={`/launch/${launch.id}`} className="block hover:bg-[#FAFAF9] transition-colors border-b border-[#E7E5E4] last:border-b-0">
                <div className="grid grid-cols-[1fr_120px_100px_100px_120px_150px_40px] gap-3 px-5 py-3 items-center">
                  <div>
                    <p className="text-base font-semibold text-[#1B1464]">{launch.name}</p>
                    <p className="text-[11px] text-[#A8A29E]">{launch.productCategory || '—'}</p>
                  </div>
                  <span className="text-xs text-[#57534E]">{LAUNCH_TYPE_LABELS[launch.launchType].split(' ')[0]}</span>
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full w-fit"
                    style={getLaunchChipStyle(getLaunchColor(launch))}
                  >
                    Tier {launch.tier}
                  </span>
                  <div>
                    <p className="text-xs text-[#57534E]">{format(parseISO(launch.launchDate), 'MMM d')}</p>
                    <p className={`text-[11px] ${daysUntil < 0 ? 'text-[#DC2626]' : 'text-[#A8A29E]'}`}>
                      {daysUntil < 0 ? `${Math.abs(daysUntil)}d past` : `${daysUntil}d away`}
                    </p>
                  </div>
                  <div>
                    <div className="h-1.5 bg-[#F5F5F4] rounded-full overflow-hidden w-20">
                      <div className="h-full rounded-full bg-[#3538CD] progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-[11px] text-[#A8A29E] mt-0.5">{progress}%</p>
                  </div>
                  <div className="min-w-0">
                    {nextTask ? (
                      <>
                        <p className="text-xs text-[#1B1464] truncate">{nextTask.name}</p>
                        <p className="text-[11px] text-[#A8A29E] truncate">{getPhaseName(nextTask.phase)}</p>
                      </>
                    ) : (
                      <p className="text-xs text-[#A8A29E]">All complete</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#D6D3D1]" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
