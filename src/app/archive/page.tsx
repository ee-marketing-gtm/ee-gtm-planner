'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format, parseISO, isBefore, addDays } from 'date-fns';
import { Archive, ArrowLeft, Undo2, Trash2, CheckCircle2 } from 'lucide-react';
import { Launch, TIER_CONFIG, LAUNCH_TYPE_LABELS, PHASES } from '@/lib/types';
import { useData } from '@/components/DataProvider';
import { getLaunchProgress, getLaunchColor } from '@/lib/utils';

export default function ArchivePage() {
  const { launches, saveLaunches, loading } = useData();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const archivedLaunches = launches.filter(l => {
    if (l.status === 'post_launch') return true;
    // Auto-archive: 30+ days past launch date
    const launchDate = parseISO(l.launchDate);
    const thirtyDaysAgo = addDays(new Date(), -30);
    return isBefore(launchDate, thirtyDaysAgo);
  }).sort((a, b) => b.launchDate.localeCompare(a.launchDate));

  const handleRestore = (id: string) => {
    const updated = launches.map(l =>
      l.id === id ? { ...l, status: 'in_progress' as const, updatedAt: new Date().toISOString() } : l
    );
    saveLaunches(updated);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Permanently delete "${name}"? This cannot be undone.`)) {
      const updated = launches.filter(l => l.id !== id);
      saveLaunches(updated);
    }
  };

  if (!mounted || loading) return <div className="p-8" />;

  return (
    <div className="p-8 max-w-[1000px]">
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-[#A8A29E] hover:text-[#57534E] mb-4">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Command Center
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <Archive className="w-6 h-6 text-[#A8A29E]" />
        <div>
          <h1 className="text-2xl font-bold text-[#1B1464]">Archive</h1>
          <p className="text-sm text-[#A8A29E]">
            {archivedLaunches.length} archived launch{archivedLaunches.length !== 1 ? 'es' : ''}
          </p>
        </div>
      </div>

      {archivedLaunches.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E7E5E4] p-12 text-center">
          <Archive className="w-10 h-10 text-[#D6D3D1] mx-auto mb-3" />
          <p className="text-sm text-[#A8A29E]">No archived launches yet.</p>
          <p className="text-xs text-[#D6D3D1] mt-1">Launches are auto-archived 30 days after their launch date.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {archivedLaunches.map(launch => {
            const progress = getLaunchProgress(launch);
            const deliverables = launch.tasks.filter(t => t.deliverableUrl && t.deliverableUrl.trim());
            return (
              <div key={launch.id} className="bg-white rounded-xl border border-[#E7E5E4] p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: getLaunchColor(launch) }} />
                      <Link href={`/launch/${launch.id}`} className="text-base font-semibold text-[#1B1464] hover:text-[#3538CD] transition-colors">
                        {launch.name}
                      </Link>
                      <span
                        className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                        style={{ background: getLaunchColor(launch) + '15', color: getLaunchColor(launch) }}
                      >
                        Tier {launch.tier}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#A8A29E]">
                      <span>{LAUNCH_TYPE_LABELS[launch.launchType]}</span>
                      <span>·</span>
                      <span>Launched {format(parseISO(launch.launchDate), 'MMM d, yyyy')}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-[#10B981]" />
                        {progress}% complete
                      </span>
                      {deliverables.length > 0 && (
                        <>
                          <span>·</span>
                          <span>{deliverables.length} deliverable{deliverables.length !== 1 ? 's' : ''}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleRestore(launch.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E7E5E4] text-[#57534E] rounded-lg text-[11px] font-medium hover:bg-[#FAFAF9] hover:border-[#D6D3D1] transition-all"
                    >
                      <Undo2 className="w-3 h-3" />
                      Restore
                    </button>
                    <button
                      onClick={() => handleDelete(launch.id, launch.name)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-[#D6D3D1] hover:text-[#DC2626] transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
