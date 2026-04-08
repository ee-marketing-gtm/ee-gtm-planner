'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Rocket, Target, Calendar, CalendarDays, PlusCircle, Archive, GanttChart, BookOpen, FileText, Video, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { NewLaunchModal } from './NewLaunchModal';
import { StarLogo } from './StarLogo';
import { useData } from './DataProvider';

const NAV_ITEMS = [
  { href: '/', label: 'Command Center', icon: LayoutDashboard },
  { href: '/launches', label: 'All Launches', icon: Rocket },
  { href: '/calendar', label: 'Marketing Calendar', icon: CalendarDays },
  { href: '/timeline', label: 'Launch Timeline', icon: GanttChart },
  { href: '/tracker', label: 'Cross-Functional Tracker', icon: Calendar },
  { href: '/deliverables', label: 'Deliverables', icon: FileText },
  { href: '/meetings', label: 'Meetings', icon: Video },
  { href: '/playbook', label: 'GTM Playbook', icon: BookOpen },
  { href: '/archive', label: 'Archive', icon: Archive },
];

export function Sidebar() {
  const pathname = usePathname();
  const [showNewLaunch, setShowNewLaunch] = useState(false);
  const { saveLaunches } = useData();

  const handleResetAll = () => {
    if (window.confirm('This will permanently delete ALL existing launches and start fresh with the new task template. This cannot be undone.\n\nContinue?')) {
      saveLaunches([]);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ee-gtm-launches');
      }
      window.location.href = '/';
    }
  };

  if (pathname === '/login') return null;

  return (
    <>
      <aside className="fixed left-0 top-0 bottom-0 w-[240px] bg-white border-r border-[#E7E5E4] flex flex-col z-30">
        <div className="p-5 border-b border-[#E7E5E4]">
          <div className="flex items-center gap-2.5">
            <StarLogo className="w-8 h-8" />
            <div>
              <h1 className="text-sm font-semibold text-[#1B1464] leading-tight">Evereden</h1>
              <p className="text-[11px] text-[#A8A29E] leading-tight">GTM Planner</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-3 px-3 space-y-0.5">
          {NAV_ITEMS.map(item => {
            const isActive = pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  isActive
                    ? 'bg-[#FFF0F7] text-[#FF1493]'
                    : 'text-[#57534E] hover:bg-[#F5F5F4]'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[#E7E5E4] space-y-2">
          <button
            onClick={() => setShowNewLaunch(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-[#FF1493] text-white text-[13px] font-medium hover:bg-[#D4117D] transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            New Launch
          </button>
          <button
            onClick={handleResetAll}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-[#A8A29E] hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Reset all launches
          </button>
        </div>
      </aside>

      {showNewLaunch && <NewLaunchModal onClose={() => setShowNewLaunch(false)} />}
    </>
  );
}
