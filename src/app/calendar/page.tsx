'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  format,
  parseISO,
  startOfYear,
  endOfYear,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  isToday,
  isSameDay,
  addDays,
  subDays,
  differenceInDays,
  getMonth,
  getYear,
} from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, Plus, X } from 'lucide-react';
import { Launch, TIER_CONFIG, LaunchTier } from '@/lib/types';
import { useData } from '@/components/DataProvider';
import { getReadableTextStyle } from '@/lib/utils';

type ZoomLevel = 'year' | 'quarter' | 'month' | 'week';

interface BrandMoment {
  name: string;
  start: Date;
  end: Date;
  color: string;
  type: 'sale' | 'holiday' | 'season' | 'custom';
  isCustom?: boolean;
  customId?: string;
}

interface CustomMoment {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  color: string;
}

interface ManualEvent {
  id: string;
  name: string;
  date: string;
  color: string;
}

const PRESET_COLORS = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#0EA5E9', '#F97316', '#8B5CF6', '#EF4444'];

const CUSTOM_MOMENTS_KEY = 'ee-gtm-custom-moments';

async function loadFromApi(): Promise<CustomMoment[]> {
  try {
    const res = await fetch('/api/data/custom_moments');
    const data = await res.json();
    const parsed = data.value ? JSON.parse(data.value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // fallback to localStorage
    const raw = localStorage.getItem(CUSTOM_MOMENTS_KEY);
    const fallback = raw ? JSON.parse(raw) : [];
    return Array.isArray(fallback) ? fallback : [];
  }
}

function saveToApi(moments: CustomMoment[]) {
  localStorage.setItem(CUSTOM_MOMENTS_KEY, JSON.stringify(moments)); // keep as cache
  fetch('/api/data/custom_moments', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: moments }),
  }).catch(() => {}); // fire and forget
}

function getBrandMoments(year: number): BrandMoment[] {
  return [
    // Sephora Sale Events
    { name: 'Sephora Spring Sale', start: new Date(year, 3, 1), end: new Date(year, 3, 15), color: '#8B5CF6', type: 'sale' },
    { name: 'Sephora VIB Sale', start: new Date(year, 10, 1), end: new Date(year, 10, 14), color: '#8B5CF6', type: 'sale' },
    { name: 'Sephora Holiday', start: new Date(year, 11, 1), end: new Date(year, 11, 24), color: '#8B5CF6', type: 'sale' },
    // Holidays
    { name: "Valentine's Day", start: new Date(year, 1, 14), end: new Date(year, 1, 14), color: '#EC4899', type: 'holiday' },
    { name: "Mother's Day", start: new Date(year, 4, 10), end: new Date(year, 4, 10), color: '#EC4899', type: 'holiday' },
    { name: "Father's Day", start: new Date(year, 5, 21), end: new Date(year, 5, 21), color: '#0EA5E9', type: 'holiday' },
    { name: 'Back to School', start: new Date(year, 7, 1), end: new Date(year, 7, 31), color: '#F59E0B', type: 'holiday' },
    { name: 'Halloween', start: new Date(year, 9, 31), end: new Date(year, 9, 31), color: '#F97316', type: 'holiday' },
    { name: 'Black Friday', start: new Date(year, 10, 27), end: new Date(year, 10, 27), color: '#1B1464', type: 'holiday' },
    { name: 'Christmas', start: new Date(year, 11, 25), end: new Date(year, 11, 25), color: '#10B981', type: 'holiday' },
    // Seasons
    { name: 'Summer Season', start: new Date(year, 5, 1), end: new Date(year, 7, 31), color: '#FBBF24', type: 'season' },
    { name: 'Holiday Season', start: new Date(year, 10, 1), end: new Date(year, 11, 31), color: '#10B981', type: 'season' },
  ];
}

function getEarliestTaskDate(launch: Launch): Date {
  const taskDates = launch.tasks
    .filter(t => t.dueDate)
    .map(t => parseISO(t.dueDate!));
  if (taskDates.length === 0) return subDays(parseISO(launch.launchDate), 60);
  return taskDates.reduce((earliest, d) => (d < earliest ? d : earliest), taskDates[0]);
}

// Marketing Calendar always uses tier color (not per-launch brand color) so
// the calendar gives a consistent tier-at-a-glance read.
function getTierColor(launch: Launch): string {
  return TIER_CONFIG[launch.tier].color;
}

function getTierBgColor(launch: Launch): string {
  return TIER_CONFIG[launch.tier].color + '20';
}

/** Assign vertical row indices to brand moment events to avoid overlap. */
function assignBrandMomentRows(events: BrandMoment[], dayToPercent: (d: Date) => number): number[] {
  const rows: number[] = [];
  // Track the rightmost edge per row (in percent)
  const rowEnds: number[] = [];
  const MIN_GAP = 6; // minimum gap in percent between items

  for (let i = 0; i < events.length; i++) {
    const bm = events[i];
    const isSingle = isSameDay(bm.start, bm.end);
    const left = dayToPercent(bm.start);
    const right = isSingle ? left + MIN_GAP : dayToPercent(bm.end);

    let placed = false;
    for (let r = 0; r < rowEnds.length; r++) {
      if (left >= rowEnds[r] + MIN_GAP) {
        rows.push(r);
        rowEnds[r] = right;
        placed = true;
        break;
      }
    }
    if (!placed) {
      rows.push(rowEnds.length);
      rowEnds.push(right);
    }
  }
  return rows;
}

export default function CalendarPage() {
  const { launches: allLaunches, loading } = useData();
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [mounted, setMounted] = useState(false);
  const [zoom, setZoom] = useState<ZoomLevel>('year');
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentQuarter, setCurrentQuarter] = useState(1);
  const [currentMonth, setCurrentMonth] = useState(0); // 0-indexed
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [customMoments, setCustomMoments] = useState<CustomMoment[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  // Floating hover card for launch bars (uses fixed positioning so it can
  // escape the calendar container's overflow-hidden and stay in viewport).
  const [hoverCard, setHoverCard] = useState<{ launch: Launch; x: number; y: number } | null>(null);
  const [newEventName, setNewEventName] = useState('');
  const [newEventStart, setNewEventStart] = useState('');
  const [newEventEnd, setNewEventEnd] = useState('');
  const [newEventColor, setNewEventColor] = useState(PRESET_COLORS[0]);

  useEffect(() => {
    const data = allLaunches.filter(l => l.status !== 'archived');
    setLaunches(data);
  }, [allLaunches]);

  useEffect(() => {
    async function init() {
      setCustomMoments(await loadFromApi());
      setMounted(true);
      const now = new Date();
      setCurrentYear(getYear(now));
      setCurrentQuarter(Math.floor(getMonth(now) / 3) + 1);
      setCurrentMonth(getMonth(now));
      setCurrentWeekStart(startOfWeek(now, { weekStartsOn: 1 }));
    }
    init();
  }, []);

  const today = new Date();

  const brandMoments = useMemo(() => {
    const hardcoded = getBrandMoments(currentYear);
    const custom: BrandMoment[] = customMoments.map(cm => ({
      name: cm.name,
      start: parseISO(cm.startDate),
      end: parseISO(cm.endDate),
      color: cm.color,
      type: 'custom' as const,
      isCustom: true,
      customId: cm.id,
    }));
    return [...hardcoded, ...custom];
  }, [currentYear, customMoments]);

  function addCustomEvent() {
    if (!newEventName.trim() || !newEventStart) return;
    const cm: CustomMoment = {
      id: crypto.randomUUID(),
      name: newEventName.trim(),
      startDate: newEventStart,
      endDate: newEventEnd || newEventStart,
      color: newEventColor,
    };
    const updated = [...customMoments, cm];
    setCustomMoments(updated);
    saveToApi(updated);
    setNewEventName('');
    setNewEventStart('');
    setNewEventEnd('');
    setNewEventColor(PRESET_COLORS[0]);
    setShowAddForm(false);
  }

  function deleteCustomEvent(customId: string) {
    const updated = customMoments.filter(cm => cm.id !== customId);
    setCustomMoments(updated);
    saveToApi(updated);
  }

  // Navigation
  function navigatePrev() {
    if (zoom === 'year') setCurrentYear(y => y - 1);
    else if (zoom === 'quarter') {
      if (currentQuarter === 1) { setCurrentYear(y => y - 1); setCurrentQuarter(4); }
      else setCurrentQuarter(q => q - 1);
    } else if (zoom === 'month') {
      if (currentMonth === 0) { setCurrentYear(y => y - 1); setCurrentMonth(11); }
      else setCurrentMonth(m => m - 1);
    } else {
      setCurrentWeekStart(s => subDays(s, 7));
    }
  }

  function navigateNext() {
    if (zoom === 'year') setCurrentYear(y => y + 1);
    else if (zoom === 'quarter') {
      if (currentQuarter === 4) { setCurrentYear(y => y + 1); setCurrentQuarter(1); }
      else setCurrentQuarter(q => q + 1);
    } else if (zoom === 'month') {
      if (currentMonth === 11) { setCurrentYear(y => y + 1); setCurrentMonth(0); }
      else setCurrentMonth(m => m + 1);
    } else {
      setCurrentWeekStart(s => addDays(s, 7));
    }
  }

  function goToToday() {
    const now = new Date();
    setCurrentYear(getYear(now));
    setCurrentQuarter(Math.floor(getMonth(now) / 3) + 1);
    setCurrentMonth(getMonth(now));
    setCurrentWeekStart(startOfWeek(now, { weekStartsOn: 1 }));
  }

  function getNavigationLabel(): string {
    if (zoom === 'year') return String(currentYear);
    if (zoom === 'quarter') return `Q${currentQuarter} ${currentYear}`;
    if (zoom === 'month') return format(new Date(currentYear, currentMonth, 1), 'MMMM yyyy');
    return `Week of ${format(currentWeekStart, 'MMM d, yyyy')}`;
  }

  // Compute the visible date range
  const getVisibleRange = useCallback((): { start: Date; end: Date } => {
    if (zoom === 'year') return { start: startOfYear(new Date(currentYear, 0)), end: endOfYear(new Date(currentYear, 0)) };
    if (zoom === 'quarter') {
      const qStart = (currentQuarter - 1) * 3;
      return { start: new Date(currentYear, qStart, 1), end: endOfMonth(new Date(currentYear, qStart + 2, 1)) };
    }
    if (zoom === 'month') return { start: startOfMonth(new Date(currentYear, currentMonth, 1)), end: endOfMonth(new Date(currentYear, currentMonth, 1)) };
    return { start: currentWeekStart, end: endOfWeek(currentWeekStart, { weekStartsOn: 1 }) };
  }, [zoom, currentYear, currentQuarter, currentMonth, currentWeekStart]);

  if (!mounted || loading) return <div className="p-8" />;

  const visibleRange = getVisibleRange();
  const totalDays = differenceInDays(visibleRange.end, visibleRange.start) + 1;

  // Filter launches visible in this range
  const visibleLaunches = launches.filter(launch => {
    const launchDate = parseISO(launch.launchDate);
    const planStart = getEarliestTaskDate(launch);
    // Span end = latest of D2C social end or Sephora launch date (so Sephora-only
    // visibility in the range still pulls the launch in).
    const d2cSocialEnd = addDays(launchDate, 7);
    const sepDate = launch.sephoraLaunchDate ? parseISO(launch.sephoraLaunchDate) : d2cSocialEnd;
    const spanEnd = sepDate > d2cSocialEnd ? sepDate : d2cSocialEnd;
    // Check if any part of the launch span overlaps with visible range
    return planStart <= visibleRange.end && spanEnd >= visibleRange.start;
  }).sort((a, b) => a.launchDate.localeCompare(b.launchDate));

  function dayToPercent(date: Date): number {
    const d = differenceInDays(date, visibleRange.start);
    return Math.max(0, Math.min(100, (d / totalDays) * 100));
  }

  function renderTodayMarker(showLabel: boolean = true) {
    if (today < visibleRange.start || today > visibleRange.end) return null;
    const left = dayToPercent(today);
    return (
      <div
        className="absolute top-0 bottom-0 z-20 pointer-events-none"
        style={{ left: `${left}%` }}
        title={`Today: ${format(today, 'MMM d, yyyy')}`}
      >
        <div className="w-0.5 h-full bg-[#3538CD]" />
        {showLabel && (
          <div className="absolute -top-1 -left-[9px] w-[20px] text-center text-[9px] font-bold text-[#3538CD]">
            Today
          </div>
        )}
      </div>
    );
  }

  function renderTimelineHeaders() {
    if (zoom === 'year') {
      const months = eachMonthOfInterval({ start: visibleRange.start, end: visibleRange.end });
      return (
        <div className="flex border-b border-[#E7E5E4]">
          {months.map((m, i) => (
            <div
              key={i}
              className="flex-1 text-center text-[11px] font-medium text-[#57534E] py-2 border-r border-[#E7E5E4] last:border-r-0"
              title={format(m, 'MMMM yyyy')}
            >
              {format(m, 'MMM')}
            </div>
          ))}
        </div>
      );
    }

    if (zoom === 'quarter') {
      const months = eachMonthOfInterval({ start: visibleRange.start, end: visibleRange.end });
      return (
        <div className="flex border-b border-[#E7E5E4]">
          {months.map((m, i) => (
            <div
              key={i}
              className="flex-1 text-center text-[11px] font-medium text-[#57534E] py-2 border-r border-[#E7E5E4] last:border-r-0"
              title={format(m, 'MMMM yyyy')}
            >
              {format(m, 'MMMM')}
            </div>
          ))}
        </div>
      );
    }

    if (zoom === 'month') {
      const weeks = eachWeekOfInterval({ start: visibleRange.start, end: visibleRange.end }, { weekStartsOn: 1 });
      return (
        <div className="flex border-b border-[#E7E5E4]">
          {weeks.map((w, i) => {
            const weekEnd = endOfWeek(w, { weekStartsOn: 1 });
            const clippedStart = w < visibleRange.start ? visibleRange.start : w;
            const clippedEnd = weekEnd > visibleRange.end ? visibleRange.end : weekEnd;
            const span = differenceInDays(clippedEnd, clippedStart) + 1;
            return (
              <div
                key={i}
                className="text-center text-[11px] font-medium text-[#57534E] py-2 border-r border-[#E7E5E4] last:border-r-0"
                style={{ flex: span }}
                title={`${format(clippedStart, 'MMM d, yyyy')} - ${format(clippedEnd, 'MMM d, yyyy')}`}
              >
                {format(clippedStart, 'MMM d')} - {format(clippedEnd, 'd')}
              </div>
            );
          })}
        </div>
      );
    }

    // Week view
    const days = eachDayOfInterval({ start: visibleRange.start, end: visibleRange.end });
    return (
      <div className="flex border-b border-[#E7E5E4]">
        {days.map((d, i) => (
          <div
            key={i}
            className={`flex-1 text-center py-2 border-r border-[#E7E5E4] last:border-r-0 ${
              isToday(d) ? 'bg-[#EEF0FF]' : ''
            }`}
            title={format(d, 'EEEE, MMMM d, yyyy')}
          >
            <div className="text-[10px] text-[#A8A29E]">{format(d, 'EEE')}</div>
            <div className={`text-[13px] font-medium ${isToday(d) ? 'text-[#3538CD]' : 'text-[#57534E]'}`}>
              {format(d, 'd')}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderGridLines() {
    if (zoom === 'year') {
      const months = eachMonthOfInterval({ start: visibleRange.start, end: visibleRange.end });
      return (
        <>
          {months.map((m, i) => {
            if (i === 0) return null;
            const left = dayToPercent(m);
            return (
              <div
                key={i}
                className="absolute top-0 bottom-0 border-l border-[#F5F5F4] pointer-events-none"
                style={{ left: `${left}%` }}
              />
            );
          })}
        </>
      );
    }
    if (zoom === 'quarter') {
      const months = eachMonthOfInterval({ start: visibleRange.start, end: visibleRange.end });
      return (
        <>
          {months.map((m, i) => {
            if (i === 0) return null;
            const left = dayToPercent(m);
            return (
              <div
                key={i}
                className="absolute top-0 bottom-0 border-l border-[#F5F5F4] pointer-events-none"
                style={{ left: `${left}%` }}
              />
            );
          })}
        </>
      );
    }
    if (zoom === 'month') {
      const weeks = eachWeekOfInterval({ start: visibleRange.start, end: visibleRange.end }, { weekStartsOn: 1 });
      return (
        <>
          {weeks.map((w, i) => {
            if (i === 0) return null;
            const left = dayToPercent(w);
            return (
              <div
                key={i}
                className="absolute top-0 bottom-0 border-l border-[#F5F5F4] pointer-events-none"
                style={{ left: `${left}%` }}
              />
            );
          })}
        </>
      );
    }
    // Week
    const days = eachDayOfInterval({ start: visibleRange.start, end: visibleRange.end });
    return (
      <>
        {days.map((d, i) => {
          if (i === 0) return null;
          const left = dayToPercent(d);
          return (
            <div
              key={i}
              className="absolute top-0 bottom-0 border-l border-[#F5F5F4] pointer-events-none"
              style={{ left: `${left}%` }}
            />
          );
        })}
      </>
    );
  }

  function renderLaunchBar(launch: Launch, _index: number) {
    const launchDate = parseISO(launch.launchDate);
    const sepDate = launch.sephoraLaunchDate ? parseISO(launch.sephoraLaunchDate) : null;
    const planStart = getEarliestTaskDate(launch);
    const tierColor = getTierColor(launch);
    const tierBg = getTierBgColor(launch);

    // D2C social campaign (14 days before D2C launch to 7 days after).
    const socialStart = subDays(launchDate, 14);
    const socialEnd = addDays(launchDate, 7);
    const socialLeftPct = dayToPercent(socialStart);
    const socialRightPct = dayToPercent(socialEnd);
    const socialWidth = Math.max(socialRightPct - socialLeftPct, 0.5);

    // ── D2C bar: from plan start → D2C launch date ──
    const d2cLeft = dayToPercent(planStart);
    const d2cRight = dayToPercent(launchDate);
    const d2cWidth = Math.max(d2cRight - d2cLeft, 0.5);

    // ── Sephora bar: from plan start → Sephora launch date ──
    // Only rendered if the launch has a Sephora date. Sephora planning runs
    // in parallel with D2C (same plan start) but ends at the Sephora launch.
    const sepLeft = sepDate ? dayToPercent(planStart) : 0;
    const sepRight = sepDate ? dayToPercent(sepDate) : 0;
    const sepWidth = sepDate ? Math.max(sepRight - sepLeft, 0.5) : 0;

    const SEPHORA_COLOR = '#8B5CF6';
    const SEPHORA_BG = '#F3ECFF';

    // Row height is taller when we show both bars so chips don't overlap.
    const hasTwoBars = !!sepDate;
    const rowHeight = hasTwoBars ? 74 : 52;

    return (
      <div key={launch.id} className="relative" style={{ height: `${rowHeight}px` }}>
        {/* Social campaign span (background, behind the D2C bar) */}
        <div
          className="absolute top-[14px] h-[12px] rounded-sm opacity-30 pointer-events-none"
          style={{
            left: `${socialLeftPct}%`,
            width: `${socialWidth}%`,
            backgroundColor: tierColor,
          }}
          title={`Social Campaign: ${launch.name} (${format(socialStart, 'MMM d')} - ${format(socialEnd, 'MMM d')})`}
        />

        {/* D2C planning bar */}
        <Link
          href={`/launch/${launch.id}`}
          className="absolute top-[8px] h-[24px] rounded flex items-center px-1.5 overflow-hidden cursor-pointer hover:brightness-95 transition-all"
          style={{
            left: `${d2cLeft}%`,
            width: `${d2cWidth}%`,
            backgroundColor: tierBg,
            borderLeft: `3px solid ${tierColor}`,
            minWidth: '2px',
          }}
          onMouseEnter={e => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setHoverCard({ launch, x: rect.left + rect.width / 2, y: rect.top });
          }}
          onMouseLeave={() => setHoverCard(null)}
        >
          <span
            className="text-[10px] font-medium truncate whitespace-nowrap"
            style={getReadableTextStyle(tierColor)}
          >
            <span className="opacity-70 mr-1">D2C</span>{launch.name}
          </span>
        </Link>

        {/* Sephora planning bar (stacked below D2C) */}
        {sepDate && (
          <Link
            href={`/launch/${launch.id}`}
            className="absolute top-[36px] h-[22px] rounded flex items-center px-1.5 overflow-hidden cursor-pointer hover:brightness-95 transition-all"
            style={{
              left: `${sepLeft}%`,
              width: `${sepWidth}%`,
              backgroundColor: SEPHORA_BG,
              borderLeft: `3px solid ${SEPHORA_COLOR}`,
              minWidth: '2px',
            }}
            onMouseEnter={e => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setHoverCard({ launch, x: rect.left + rect.width / 2, y: rect.top });
            }}
            onMouseLeave={() => setHoverCard(null)}
          >
            <span
              className="text-[10px] font-medium truncate whitespace-nowrap"
              style={{ color: SEPHORA_COLOR }}
            >
              <span className="opacity-70 mr-1">Sephora</span>{launch.name}
            </span>
          </Link>
        )}

        {/* D2C launch date marker — vertical line + chip below the bars */}
        {launchDate >= visibleRange.start && launchDate <= visibleRange.end && (
          <div
            className="absolute z-10 flex flex-col items-center pointer-events-none"
            style={{
              left: `${dayToPercent(launchDate)}%`,
              top: '6px',
              bottom: '16px',
              transform: 'translateX(-50%)',
            }}
          >
            <div className="w-[2px] flex-1 rounded-sm" style={{ backgroundColor: tierColor }} />
          </div>
        )}
        {launchDate >= visibleRange.start && launchDate <= visibleRange.end && (
          <span
            className="absolute z-10 text-[8px] font-bold leading-none px-1 py-[1px] rounded bg-white shadow-sm border border-[#E7E5E4] pointer-events-none whitespace-nowrap"
            style={{
              left: `${dayToPercent(launchDate)}%`,
              bottom: '2px',
              transform: 'translateX(-50%)',
              color: tierColor,
            }}
          >
            D2C {format(launchDate, 'MMM d')}
          </span>
        )}

        {/* Sephora launch date marker */}
        {sepDate && sepDate >= visibleRange.start && sepDate <= visibleRange.end && (
          <div
            className="absolute z-10 flex flex-col items-center pointer-events-none"
            style={{
              left: `${dayToPercent(sepDate)}%`,
              top: '34px',
              bottom: '16px',
              transform: 'translateX(-50%)',
            }}
          >
            <div className="w-[2px] flex-1 rounded-sm" style={{ backgroundColor: SEPHORA_COLOR }} />
          </div>
        )}
        {sepDate && sepDate >= visibleRange.start && sepDate <= visibleRange.end && (
          <span
            className="absolute z-10 text-[8px] font-bold leading-none px-1 py-[1px] rounded bg-white shadow-sm border border-[#E7E5E4] pointer-events-none whitespace-nowrap"
            style={{
              left: `${dayToPercent(sepDate)}%`,
              bottom: '2px',
              transform: 'translateX(-50%)',
              color: SEPHORA_COLOR,
            }}
          >
            Seph {format(sepDate, 'MMM d')}
          </span>
        )}

      </div>
    );
  }

  function renderBrandMomentsRow() {
    const visible = brandMoments.filter(bm =>
      bm.start <= visibleRange.end && bm.end >= visibleRange.start
    );

    if (visible.length === 0) return null;

    // Filter out seasons (no longer rendered as background shading)
    const events = visible.filter(bm => bm.type !== 'season');

    // Assign rows to events to avoid overlap
    const eventRows = assignBrandMomentRows(events, dayToPercent);
    const maxRow = eventRows.length > 0 ? Math.max(...eventRows) : 0;
    const ROW_HEIGHT = 28;
    const BASE_TOP = 20;
    const sectionHeight = BASE_TOP + (maxRow + 1) * ROW_HEIGHT + 12;

    return (
      <div className="relative border-t border-[#E7E5E4]" style={{ height: `${sectionHeight}px` }}>
        {/* Row label */}
        <div className="absolute left-0 top-0 bottom-0 w-0 overflow-visible z-10">
          <span className="absolute left-2 top-1 text-[9px] font-medium text-[#A8A29E] uppercase tracking-wider whitespace-nowrap">
            Brand Moments
          </span>
        </div>

        {renderGridLines()}

        {/* Events / sales - stacked vertically using row assignments */}
        {events.map((bm, i) => {
          const row = eventRows[i];
          const topOffset = BASE_TOP + row * ROW_HEIGHT;
          const isSingleDay = isSameDay(bm.start, bm.end);
          const left = dayToPercent(bm.start);

          if (isSingleDay) {
            return (
              <div
                key={`event-${i}`}
                className="absolute z-10 group/evt"
                style={{ left: `${left}%`, top: `${topOffset}px`, transform: 'translateX(-50%)' }}
              >
                <div
                  className="w-2 h-2 rounded-full mb-0.5 mx-auto"
                  style={{ backgroundColor: bm.color }}
                />
                <span className="text-[8px] font-medium whitespace-nowrap block text-center" style={{ color: bm.color }}>
                  {bm.name}
                </span>
                {/* Rich tooltip */}
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover/evt:block z-30 pointer-events-none">
                  <div className="bg-[#1B1464] text-white text-[11px] rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                    <p className="font-semibold">{bm.name}</p>
                    <p className="text-white/60 mt-0.5">{format(bm.start, 'MMM d, yyyy')}</p>
                    <p className="text-white/40 text-[10px] mt-0.5">{bm.type === 'custom' ? 'Custom event' : bm.type.charAt(0).toUpperCase() + bm.type.slice(1)}</p>
                  </div>
                </div>
                {/* Delete button for custom events */}
                {bm.isCustom && bm.customId && (
                  <button
                    onClick={() => deleteCustomEvent(bm.customId!)}
                    className="absolute -top-2 -right-3 w-3.5 h-3.5 rounded-full bg-red-500 text-white hidden group-hover/evt:flex items-center justify-center z-40"
                    title="Delete custom event"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            );
          }

          const right = dayToPercent(bm.end);
          const width = Math.max(right - left, 0.5);
          return (
            <div
              key={`event-${i}`}
              className="absolute h-[18px] rounded-sm flex items-center justify-center overflow-visible group/evt"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                top: `${topOffset + 2}px`,
                backgroundColor: bm.color + '20',
                borderLeft: `2px solid ${bm.color}`,
              }}
              title={`${bm.name}: ${format(bm.start, 'MMM d, yyyy')} - ${format(bm.end, 'MMM d, yyyy')}`}
            >
              <span className="text-[8px] font-medium truncate px-1" style={{ color: bm.color }}>
                {bm.name}
              </span>
              {/* Rich tooltip */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover/evt:block z-30 pointer-events-none">
                <div className="bg-[#1B1464] text-white text-[11px] rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                  <p className="font-semibold">{bm.name}</p>
                  <p className="text-white/60 mt-0.5">{format(bm.start, 'MMM d, yyyy')} - {format(bm.end, 'MMM d, yyyy')}</p>
                  <p className="text-white/40 text-[10px] mt-0.5">{bm.type === 'custom' ? 'Custom event' : bm.type.charAt(0).toUpperCase() + bm.type.slice(1)}</p>
                </div>
              </div>
              {/* Delete button for custom events */}
              {bm.isCustom && bm.customId && (
                <button
                  onClick={() => deleteCustomEvent(bm.customId!)}
                  className="absolute -top-2 -right-2 w-3.5 h-3.5 rounded-full bg-red-500 text-white hidden group-hover/evt:flex items-center justify-center z-40"
                  title="Delete custom event"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          );
        })}

        {renderTodayMarker(false)}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1B1464]">Marketing Calendar</h1>
          <p className="text-sm text-[#A8A29E] mt-1">
            {visibleLaunches.length} launch{visibleLaunches.length !== 1 ? 'es' : ''} in view
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 border border-[#1B1464] rounded-lg bg-[#1B1464] text-white hover:bg-[#2D2A7C] transition-colors"
            title="Add a brand moment to the calendar"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Moment
          </button>
          <button
            onClick={goToToday}
            className="text-xs px-3 py-1.5 border border-[#E7E5E4] rounded-lg bg-white hover:bg-[#FAFAF9] text-[#57534E] transition-colors"
            title="Jump to today"
          >
            Today
          </button>
        </div>
      </div>

      {/* Add Brand Moment Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl border border-[#E7E5E4] p-4 mb-4 shadow-sm">
          <h3 className="text-sm font-semibold text-[#1B1464] mb-3">Add Brand Moment</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-[10px] font-medium text-[#78716C] uppercase tracking-wider mb-1">Event Name</label>
              <input
                type="text"
                value={newEventName}
                onChange={e => setNewEventName(e.target.value)}
                placeholder="e.g. PR Event"
                className="w-full border border-[#E7E5E4] rounded-lg px-3 py-1.5 text-sm text-[#1B1464] focus:outline-none focus:ring-2 focus:ring-[#1B1464]/20 focus:border-[#1B1464]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[#78716C] uppercase tracking-wider mb-1">Start Date</label>
              <input
                type="date"
                value={newEventStart}
                onChange={e => setNewEventStart(e.target.value)}
                className="border border-[#E7E5E4] rounded-lg px-3 py-1.5 text-sm text-[#1B1464] focus:outline-none focus:ring-2 focus:ring-[#1B1464]/20 focus:border-[#1B1464]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[#78716C] uppercase tracking-wider mb-1">End Date</label>
              <input
                type="date"
                value={newEventEnd}
                onChange={e => setNewEventEnd(e.target.value)}
                className="border border-[#E7E5E4] rounded-lg px-3 py-1.5 text-sm text-[#1B1464] focus:outline-none focus:ring-2 focus:ring-[#1B1464]/20 focus:border-[#1B1464]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[#78716C] uppercase tracking-wider mb-1">Color</label>
              <div className="flex items-center gap-1">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewEventColor(c)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${newEventColor === c ? 'border-[#1B1464] scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={addCustomEvent}
                disabled={!newEventName.trim() || !newEventStart}
                className="px-4 py-1.5 rounded-lg bg-[#1B1464] text-white text-xs font-medium hover:bg-[#2D2A7C] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 rounded-lg border border-[#E7E5E4] text-xs text-[#57534E] hover:bg-[#F5F5F4] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zoom controls + navigation */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1 bg-[#F5F5F4] rounded-lg p-0.5">
          {(['year', 'quarter', 'month', 'week'] as ZoomLevel[]).map(level => (
            <button
              key={level}
              onClick={() => setZoom(level)}
              className={`text-[11px] font-medium px-3 py-1.5 rounded-md transition-colors ${
                zoom === level
                  ? 'bg-white text-[#1B1464] shadow-sm'
                  : 'text-[#A8A29E] hover:text-[#57534E]'
              }`}
              title={`View by ${level}`}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={navigatePrev}
            className="p-1.5 rounded-lg hover:bg-[#F5F5F4] text-[#57534E] transition-colors"
            title="Previous"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-[#1B1464] min-w-[160px] text-center">
            {getNavigationLabel()}
          </span>
          <button
            onClick={navigateNext}
            className="p-1.5 rounded-lg hover:bg-[#F5F5F4] text-[#57534E] transition-colors"
            title="Next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Calendar body */}
      <div className="bg-white rounded-xl border border-[#E7E5E4] overflow-hidden">
        {/* Timeline header */}
        {renderTimelineHeaders()}

        {/* Launch rows */}
        {visibleLaunches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <CalendarDays className="w-10 h-10 text-[#D6D3D1] mb-3" />
            <p className="text-sm text-[#A8A29E]">No launches in this period.</p>
          </div>
        ) : (
          <div className="relative">
            {renderGridLines()}
            {renderTodayMarker()}

            <div className="relative py-2 px-0">
              {visibleLaunches.map((launch, i) => renderLaunchBar(launch, i))}
            </div>
          </div>
        )}

        {/* Brand moments */}
        {renderBrandMomentsRow()}
      </div>

      {/* Legend */}
      <div className="mt-4 bg-white rounded-xl border border-[#E7E5E4] px-5 py-3.5">
        <p className="text-[10px] font-medium text-[#A8A29E] uppercase tracking-wider mb-2.5">Legend</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[#57534E]">
          {/* Tier colors */}
          <div className="flex items-center gap-3">
            {(['A', 'B', 'C'] as LaunchTier[]).map(tier => (
              <div key={tier} className="flex items-center gap-1.5">
                <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: TIER_CONFIG[tier].color }} />
                <span>Tier {tier} launch bar</span>
              </div>
            ))}
          </div>

          <div className="w-px h-4 bg-[#E7E5E4]" />

          {/* Social campaign */}
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-2 rounded-sm bg-[#A8A29E] opacity-30" />
            <span>Social campaign (30% opacity bar)</span>
          </div>

          <div className="w-px h-4 bg-[#E7E5E4]" />

          {/* Launch date markers */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-0.5">
                {(['A', 'B', 'C'] as LaunchTier[]).map(tier => (
                  <div key={tier} className="w-[2px] h-4 rounded-sm" style={{ backgroundColor: TIER_CONFIG[tier].color }} />
                ))}
              </div>
              <span>D2C launch (Amazon included)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-[2px] h-4 rounded-sm bg-[#8B5CF6]" />
              <span>Sephora launch</span>
            </div>
          </div>

          <div className="w-px h-4 bg-[#E7E5E4]" />

          {/* Brand moments */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-3 rounded-sm bg-[#8B5CF6]/20 border-l-2 border-[#8B5CF6]" />
              <span>Sale / holiday range</span>
            </div>
          </div>

          <div className="w-px h-4 bg-[#E7E5E4]" />

          {/* Today marker */}
          <div className="flex items-center gap-1.5">
            <div className="w-0.5 h-4 bg-[#3538CD]" />
            <span className="text-[#3538CD] font-medium">Today</span>
          </div>
        </div>
      </div>

      {/* Floating launch hover card (fixed positioning so it escapes the
          calendar's overflow-hidden container and flips to stay on-screen). */}
      {hoverCard && (() => {
        const l = hoverCard.launch;
        const cardWidth = 280;
        const cardHeight = 180;
        const margin = 8;
        const vw = typeof window !== 'undefined' ? window.innerWidth : 1400;
        const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
        // Prefer above the bar; flip below if not enough room.
        let top = hoverCard.y - cardHeight - margin;
        if (top < margin) top = hoverCard.y + 32 + margin;
        // Horizontally center on cursor but clamp to viewport.
        let left = hoverCard.x - cardWidth / 2;
        if (left < margin) left = margin;
        if (left + cardWidth > vw - margin) left = vw - cardWidth - margin;
        if (top + cardHeight > vh - margin) top = vh - cardHeight - margin;

        const lDate = parseISO(l.launchDate);
        const sDate = l.sephoraLaunchDate ? parseISO(l.sephoraLaunchDate) : null;
        const done = l.tasks.filter(t => t.status === 'complete').length;
        const inProg = l.tasks.filter(t => t.status === 'in_progress').length;
        const tierColor = TIER_CONFIG[l.tier].color;
        const channelLabel = l.sephoraChannel === 'in_store' ? 'In-store'
          : l.sephoraChannel === 'online' ? 'Online'
          : l.sephoraChannel === 'both' ? 'Online + In-store' : null;

        return (
          <div
            className="fixed z-50 pointer-events-none animate-fade-in"
            style={{ top, left, width: cardWidth }}
          >
            <div className="bg-[#1B1464] text-white text-[11px] rounded-lg px-3.5 py-3 shadow-2xl">
              <p className="font-semibold text-[13px] leading-tight">{l.name}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: tierColor + '35', color: '#fff' }}>Tier {l.tier}</span>
                <span className="text-white/50 text-[10px] capitalize">{l.status.replace('_', ' ')}</span>
              </div>
              <div className="mt-2 space-y-0.5 text-white/70">
                <p><span className="text-white/40">D2C:</span> {format(lDate, 'MMM d, yyyy')}</p>
                {sDate && (
                  <p>
                    <span className="text-white/40">Sephora:</span> {format(sDate, 'MMM d, yyyy')}
                    {channelLabel && <span className="text-white/40"> · {channelLabel}</span>}
                  </p>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2 text-[10px]">
                <span className="text-green-300">{done} done</span>
                <span className="text-blue-300">{inProg} in progress</span>
                <span className="text-white/40">{l.tasks.length - done - inProg} remaining</span>
              </div>
              <p className="text-white/40 mt-2 text-[10px]">Click to open launch →</p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
