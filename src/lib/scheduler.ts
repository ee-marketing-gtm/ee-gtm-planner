/**
 * Backward Scheduler — computes every task's due date from launch date(s).
 *
 * Algorithm:
 *   1. Build a DAG from the task template
 *   2. Add virtual launch milestones as terminal nodes
 *   3. PASS 1 (Backward): topological-sort in reverse, compute deadlines
 *      - For each task: deadline = min(successor.deadline − successor.leadTime)
 *      - Sephora-anchored tasks also respect sephoraLeadTime constraints
 *      - D2C tasks respect d2cAssetLeadTime / d2cCopyLeadTime constraints
 *   4. PASS 2 (Forward): topological-sort forward, compute actual due dates
 *      - due = max(dep.due for all deps) + leadTime
 *      - Clamp to backward deadline; flag compression if exceeded
 *   5. Detect bottlenecks (forward date exceeds backward deadline)
 *
 * Multi-channel support:
 *   - DTC launch date = primary anchor
 *   - Sephora launch date = DTC + offset (default 20 BD / 4 weeks)
 *   - Sephora tasks need assets/copy 50 BD before Sephora launch
 *   - D2C tasks need assets 15 BD and copy 10 BD before D2C launch
 *   - Creator content must be delivered 5 BD before D2C launch
 */

import { addBusinessDays, differenceInBusinessDays, parseISO, format } from 'date-fns';
import { LAUNCH_TASK_TEMPLATE, TaskTemplate, toAppOwner, TemplateOwner } from './task-template';
import { PhaseKey, Owner } from './types';

// ── Types ───────────────────────────────────────────────────────────

export interface ScheduleInput {
  dtcLaunchDate: string;          // YYYY-MM-DD, required
  sephoraLaunchDate?: string;     // YYYY-MM-DD, optional (default: DTC + 20 BD)
  amazonLaunchDate?: string;      // YYYY-MM-DD, optional
  sephoraAssetLeadBD?: number;    // BD before Sephora launch for assets (default: 50)
  d2cAssetLeadBD?: number;        // BD before D2C launch for assets (default: 15)
  d2cCopyLeadBD?: number;         // BD before D2C launch for copy (default: 10)
  creatorLeadBD?: number;         // BD before D2C launch for creator content (default: 5)
  includeOptional?: string[];     // names of optional tasks to include
  externalAnchors?: ExternalAnchor[];
  manualOverrides?: ManualOverride[];
}

export interface ExternalAnchor {
  taskName: string;
  date: string;                   // YYYY-MM-DD
  partnerName: string;
}

export interface ManualOverride {
  taskName: string;
  date: string;                   // YYYY-MM-DD
}

export interface ScheduledTask {
  name: string;
  dueDate: string;                // YYYY-MM-DD
  startDate: string;              // YYYY-MM-DD (due − leadTime)
  owner: TemplateOwner;
  appOwner: Owner;
  support?: string;
  phase: PhaseKey;
  leadTime: number;
  dependsOn: string[];
  sortOrder: number;
  isMeeting?: boolean;
  meetingChecklist?: string[];
  isManualDate?: boolean;
  isOptional?: boolean;
  isExternalAnchor?: boolean;
  externalPartner?: string;
  notes?: string;
  deliverableUrl?: string;
  // Compression / bottleneck
  isCompressed?: boolean;
  compressionDays?: number;
  isBottleneck?: boolean;         // true if task cannot meet deadline given deps
  channelAnchor?: 'sephora';
}

export interface ScheduleResult {
  tasks: ScheduledTask[];
  warnings: string[];
  bottlenecks: string[];          // task names that are bottlenecked
  earliestStartDate: string;
  totalBusinessDays: number;
  dtcLaunchDate: string;
  sephoraLaunchDate: string;
}

// ── Helpers ─────────────────────────────────────────────────────────

function subtractBusinessDays(date: Date, days: number): Date {
  return addBusinessDays(date, -days);
}

function formatDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function minDate(...dates: (Date | null | undefined)[]): Date | null {
  const valid = dates.filter((d): d is Date => d != null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a < b ? a : b);
}

// ── Virtual milestone names ─────────────────────────────────────────
const DTC_LAUNCH = '__DTC_LAUNCH__';
const SEPHORA_LAUNCH = '__SEPHORA_LAUNCH__';
const AMAZON_LAUNCH = '__AMAZON_LAUNCH__';

// ── Scheduler ───────────────────────────────────────────────────────

export function scheduleLaunch(input: ScheduleInput): ScheduleResult {
  const warnings: string[] = [];
  const bottleneckList: string[] = [];
  const dtcDate = parseISO(input.dtcLaunchDate);

  // Default Sephora launch = DTC + 20 BD (4 weeks)
  const sephoraDate = input.sephoraLaunchDate
    ? parseISO(input.sephoraLaunchDate)
    : addBusinessDays(dtcDate, 20);
  const amazonDate = input.amazonLaunchDate ? parseISO(input.amazonLaunchDate) : null;

  // Configurable lead times with defaults
  const sephAssetLead = input.sephoraAssetLeadBD ?? 50;
  const d2cAssetLead = input.d2cAssetLeadBD ?? 15;
  const d2cCopyLead = input.d2cCopyLeadBD ?? 10;
  const creatorLead = input.creatorLeadBD ?? 5;

  // Compute hard deadlines for channel-specific tasks
  const sephoraAssetDeadline = subtractBusinessDays(sephoraDate, sephAssetLead);
  const d2cAssetDeadline = subtractBusinessDays(dtcDate, d2cAssetLead);
  const d2cCopyDeadline = subtractBusinessDays(dtcDate, d2cCopyLead);
  const creatorDeadline = subtractBusinessDays(dtcDate, creatorLead);

  // 1. Filter tasks
  const includedOptional = new Set(input.includeOptional || []);
  const activeTasks = LAUNCH_TASK_TEMPLATE.filter(t => {
    if (t.isManualDate) return false;
    if (t.isOptional && !includedOptional.has(t.name)) return false;
    return true;
  });

  // 2. Build name → template map
  const taskMap = new Map<string, TaskTemplate>();
  for (const t of activeTasks) {
    taskMap.set(t.name, t);
  }

  // 3. Build successor map
  const successors = new Map<string, string[]>();
  for (const t of activeTasks) {
    for (const dep of t.dependsOn) {
      if (!taskMap.has(dep)) continue;
      const existing = successors.get(dep) || [];
      existing.push(t.name);
      successors.set(dep, existing);
    }
  }

  // 4. Find terminal tasks → connect to launch milestones
  const terminalTasks: string[] = [];
  for (const t of activeTasks) {
    if (!successors.has(t.name) || successors.get(t.name)!.length === 0) {
      terminalTasks.push(t.name);
    }
  }

  for (const tn of terminalTasks) {
    const tmpl = taskMap.get(tn)!;
    const existing = successors.get(tn) || [];
    if (tmpl.channelAnchor === 'sephora') {
      existing.push(SEPHORA_LAUNCH);
    } else {
      existing.push(DTC_LAUNCH);
    }
    successors.set(tn, existing);
  }

  // ── External anchors & manual overrides ──
  const externalAnchorMap = new Map<string, { date: Date; partner: string }>();
  for (const ea of input.externalAnchors || []) {
    externalAnchorMap.set(ea.taskName, { date: parseISO(ea.date), partner: ea.partnerName });
  }
  const manualOverrideMap = new Map<string, Date>();
  for (const mo of input.manualOverrides || []) {
    manualOverrideMap.set(mo.taskName, parseISO(mo.date));
  }

  // ── PASS 1: Backward scheduling (compute deadlines) ──────────────

  const deadlines = new Map<string, Date>();
  deadlines.set(DTC_LAUNCH, dtcDate);
  deadlines.set(SEPHORA_LAUNCH, sephoraDate);
  if (amazonDate) deadlines.set(AMAZON_LAUNCH, amazonDate);

  // Reverse topological sort (terminal tasks first, then predecessors)
  const inDegree = new Map<string, number>();
  const allNames = activeTasks.map(t => t.name);
  for (const name of allNames) {
    const succs = (successors.get(name) || []).filter(s => taskMap.has(s));
    inDegree.set(name, succs.length);
  }

  const backwardQueue: string[] = [];
  for (const name of allNames) {
    if (inDegree.get(name) === 0) backwardQueue.push(name);
  }

  const backwardOrder: string[] = [];
  while (backwardQueue.length > 0) {
    const current = backwardQueue.shift()!;
    backwardOrder.push(current);
    const tmpl = taskMap.get(current)!;
    for (const dep of tmpl.dependsOn) {
      if (!inDegree.has(dep)) continue;
      const newDeg = inDegree.get(dep)! - 1;
      inDegree.set(dep, newDeg);
      if (newDeg === 0) backwardQueue.push(dep);
    }
  }

  for (const name of backwardOrder) {
    const tmpl = taskMap.get(name)!;

    // Hard constraints first
    if (externalAnchorMap.has(name)) {
      deadlines.set(name, externalAnchorMap.get(name)!.date);
      continue;
    }
    if (manualOverrideMap.has(name)) {
      deadlines.set(name, manualOverrideMap.get(name)!);
      continue;
    }

    // Compute deadline from successors
    const succs = successors.get(name) || [];
    let earliestNeeded: Date | null = null;

    for (const succName of succs) {
      let succDue: Date | undefined;
      let succLeadTime: number;

      if (succName === DTC_LAUNCH || succName === SEPHORA_LAUNCH || succName === AMAZON_LAUNCH) {
        succDue = deadlines.get(succName);
        succLeadTime = 0;
      } else {
        succDue = deadlines.get(succName);
        const succTmpl = taskMap.get(succName);
        succLeadTime = succTmpl ? succTmpl.leadTime : 0;
      }
      if (!succDue) continue;

      const needed = subtractBusinessDays(succDue, succLeadTime);
      if (!earliestNeeded || needed < earliestNeeded) {
        earliestNeeded = needed;
      }
    }

    // Apply channel-specific hard deadlines
    // Sephora asset/copy lead time constraint
    if (tmpl.sephoraLeadTime) {
      const sephConstraint = subtractBusinessDays(sephoraDate, tmpl.sephoraLeadTime);
      earliestNeeded = minDate(earliestNeeded, sephConstraint) || sephConstraint;
    }
    // D2C asset lead time constraint
    if (tmpl.d2cAssetLeadTime) {
      const d2cConstraint = subtractBusinessDays(dtcDate, tmpl.d2cAssetLeadTime);
      earliestNeeded = minDate(earliestNeeded, d2cConstraint) || d2cConstraint;
    }
    // D2C copy lead time constraint
    if (tmpl.d2cCopyLeadTime) {
      const d2cConstraint = subtractBusinessDays(dtcDate, tmpl.d2cCopyLeadTime);
      earliestNeeded = minDate(earliestNeeded, d2cConstraint) || d2cConstraint;
    }
    // Creator content: must finish 5 BD before D2C launch
    if (tmpl.name === 'Creator Content Delivered') {
      earliestNeeded = minDate(earliestNeeded, creatorDeadline) || creatorDeadline;
    }

    // Apply dueDateOffset (e.g., Samples Available needs extra buffer)
    if (earliestNeeded && tmpl.dueDateOffset && tmpl.dueDateOffset < 0) {
      earliestNeeded = subtractBusinessDays(earliestNeeded, Math.abs(tmpl.dueDateOffset));
    }

    if (earliestNeeded) {
      deadlines.set(name, earliestNeeded);
    }
  }

  // ── PASS 2: Forward scheduling (compute actual dates) ─────────────

  const depCount = new Map<string, number>();
  for (const name of allNames) {
    const tmpl = taskMap.get(name)!;
    const activeDeps = tmpl.dependsOn.filter(d => taskMap.has(d));
    depCount.set(name, activeDeps.length);
  }

  const forwardQueue: string[] = [];
  for (const name of allNames) {
    if (depCount.get(name) === 0) forwardQueue.push(name);
  }

  const forwardOrder: string[] = [];
  while (forwardQueue.length > 0) {
    const current = forwardQueue.shift()!;
    forwardOrder.push(current);
    const succs = (successors.get(current) || []).filter(s => taskMap.has(s));
    for (const s of succs) {
      const newDeg = depCount.get(s)! - 1;
      depCount.set(s, newDeg);
      if (newDeg === 0) forwardQueue.push(s);
    }
  }

  const dueDates = new Map<string, Date>();

  for (const name of forwardOrder) {
    const tmpl = taskMap.get(name)!;

    if (externalAnchorMap.has(name)) {
      dueDates.set(name, externalAnchorMap.get(name)!.date);
      continue;
    }
    if (manualOverrideMap.has(name)) {
      dueDates.set(name, manualOverrideMap.get(name)!);
      continue;
    }

    const activeDeps = tmpl.dependsOn.filter(d => taskMap.has(d));
    let latestDepDue: Date | null = null;
    for (const dep of activeDeps) {
      const depDue = dueDates.get(dep);
      if (depDue && (!latestDepDue || depDue > latestDepDue)) latestDepDue = depDue;
    }

    let forwardDue: Date;
    if (latestDepDue) {
      forwardDue = addBusinessDays(latestDepDue, tmpl.leadTime);
    } else {
      // Root task: use backward deadline
      const deadline = deadlines.get(name);
      forwardDue = deadline || subtractBusinessDays(dtcDate, tmpl.leadTime);
    }

    // For ops tasks with dueDateOffset, use backward deadline
    if (tmpl.dueDateOffset && tmpl.dueDateOffset < 0) {
      const deadline = deadlines.get(name);
      if (deadline) forwardDue = deadline;
    }

    // Clamp to backward deadline
    const deadline = deadlines.get(name);
    if (deadline && forwardDue > deadline) {
      forwardDue = deadline;
    }

    dueDates.set(name, forwardDue);
  }

  // ── Build result with compression & bottleneck detection ──────────

  const scheduledTasks: ScheduledTask[] = [];

  for (let i = 0; i < activeTasks.length; i++) {
    const tmpl = activeTasks[i];
    const due = dueDates.get(tmpl.name);
    if (!due) continue;

    const startDate = subtractBusinessDays(due, tmpl.leadTime);
    const dueDateStr = formatDate(due);
    const startDateStr = formatDate(startDate);

    // Compression detection
    const deadline = deadlines.get(tmpl.name);
    let isCompressed = false;
    let compressionDays = 0;
    let isBottleneck = false;

    if (deadline) {
      const activeDeps = tmpl.dependsOn.filter(d => taskMap.has(d));
      let latestDep: Date | null = null;
      for (const dep of activeDeps) {
        const dd = dueDates.get(dep);
        if (dd && (!latestDep || dd > latestDep)) latestDep = dd;
      }
      if (latestDep) {
        const idealDue = addBusinessDays(latestDep, tmpl.leadTime);
        if (idealDue > deadline) {
          isCompressed = true;
          compressionDays = differenceInBusinessDays(idealDue, deadline);
          isBottleneck = true;
          bottleneckList.push(tmpl.name);
          warnings.push(
            `⚠️ BOTTLENECK: "${tmpl.name}" is compressed by ${compressionDays} BD — deadline is ${formatDate(deadline)} but dependencies push it to ${formatDate(idealDue)}.`
          );
        }
      }
    }

    const extAnchor = externalAnchorMap.get(tmpl.name);

    scheduledTasks.push({
      name: tmpl.name,
      dueDate: dueDateStr,
      startDate: startDateStr,
      owner: tmpl.owner,
      appOwner: toAppOwner(tmpl.owner),
      support: tmpl.support,
      phase: tmpl.phase,
      leadTime: tmpl.leadTime,
      dependsOn: tmpl.dependsOn.filter(d => taskMap.has(d)),
      sortOrder: i + 1,
      isMeeting: tmpl.isMeeting,
      meetingChecklist: tmpl.meetingChecklist,
      isOptional: tmpl.isOptional,
      notes: tmpl.notes,
      deliverableUrl: tmpl.deliverableUrl,
      isExternalAnchor: !!extAnchor,
      externalPartner: extAnchor?.partner,
      isCompressed,
      compressionDays: isCompressed ? compressionDays : undefined,
      isBottleneck,
      channelAnchor: tmpl.channelAnchor,
    });
  }

  // Sort by due date ascending
  scheduledTasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  scheduledTasks.forEach((t, i) => { t.sortOrder = i + 1; });

  // Summary
  const allStartDates = scheduledTasks.map(t => t.startDate).sort();
  const earliestStart = allStartDates[0] || input.dtcLaunchDate;
  const totalBD = differenceInBusinessDays(dtcDate, parseISO(earliestStart));

  return {
    tasks: scheduledTasks,
    warnings,
    bottlenecks: bottleneckList,
    earliestStartDate: earliestStart,
    totalBusinessDays: totalBD,
    dtcLaunchDate: formatDate(dtcDate),
    sephoraLaunchDate: formatDate(sephoraDate),
  };
}
