/**
 * Backward Scheduler — computes every task's due date from launch date(s).
 *
 * Algorithm:
 *   1. Build a DAG from the task template
 *   2. Add virtual launch milestones as terminal nodes
 *   3. Topological-sort in reverse order (terminal → start)
 *   4. For each task: due = min(successor.due − successor.leadTime)
 *      i.e., a task must be DONE by the time its earliest successor needs to START
 *   5. Apply external anchors (Mattel dates, manual overrides) as hard constraints
 *   6. Flag any compression (task squeezed below its lead time)
 *
 * Special cases:
 *   - Sephora tasks anchor to sephoraLaunchDate instead of dtcLaunchDate
 *   - Samples Available gets an extra dueDateOffset (available 10 BD before shoots)
 *   - Manual-date and optional tasks are excluded from auto-scheduling
 */

import { addBusinessDays, differenceInBusinessDays, parseISO, format } from 'date-fns';
import { LAUNCH_TASK_TEMPLATE, TaskTemplate, toAppOwner, TemplateOwner } from './task-template';
import { PhaseKey, Owner } from './types';

// ── Types ───────────────────────────────────────────────────────────

export interface ScheduleInput {
  dtcLaunchDate: string;          // YYYY-MM-DD, required
  sephoraLaunchDate?: string;     // YYYY-MM-DD, optional
  amazonLaunchDate?: string;      // YYYY-MM-DD, optional
  includeOptional?: string[];     // names of optional tasks to include
  externalAnchors?: ExternalAnchor[];  // hard-coded partner dates (e.g., Mattel)
  manualOverrides?: ManualOverride[];  // user-pinned dates
}

export interface ExternalAnchor {
  taskName: string;
  date: string;                   // YYYY-MM-DD
  partnerName: string;            // e.g., "Mattel"
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
  appOwner: Owner;                // mapped for the app's Owner type
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
  // Compression warnings
  isCompressed?: boolean;         // true if lead time got squeezed
  compressionDays?: number;       // how many BD were lost
  channelAnchor?: 'sephora';
}

export interface ScheduleResult {
  tasks: ScheduledTask[];
  warnings: string[];
  earliestStartDate: string;      // when the first task needs to begin
  totalBusinessDays: number;      // from first task start to launch
}

// ── Helpers ─────────────────────────────────────────────────────────

function subtractBusinessDays(date: Date, days: number): Date {
  // addBusinessDays with negative arg
  return addBusinessDays(date, -days);
}

function formatDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

// ── Virtual milestone names ─────────────────────────────────────────
const DTC_LAUNCH = '__DTC_LAUNCH__';
const SEPHORA_LAUNCH = '__SEPHORA_LAUNCH__';
const AMAZON_LAUNCH = '__AMAZON_LAUNCH__';

// ── Scheduler ───────────────────────────────────────────────────────

export function scheduleLaunch(input: ScheduleInput): ScheduleResult {
  const warnings: string[] = [];
  const dtcDate = parseISO(input.dtcLaunchDate);
  const sephoraDate = input.sephoraLaunchDate ? parseISO(input.sephoraLaunchDate) : null;
  const amazonDate = input.amazonLaunchDate ? parseISO(input.amazonLaunchDate) : null;

  // 1. Filter tasks: exclude optional (unless included) and manual-date tasks
  const includedOptional = new Set(input.includeOptional || []);
  const activeTasks = LAUNCH_TASK_TEMPLATE.filter(t => {
    if (t.isManualDate) return false;
    if (t.isOptional && !includedOptional.has(t.name)) return false;
    // Exclude Sephora-specific tasks if no Sephora date
    if (t.channelAnchor === 'sephora' && !sephoraDate) return false;
    return true;
  });

  // 2. Build name → template map
  const taskMap = new Map<string, TaskTemplate>();
  for (const t of activeTasks) {
    taskMap.set(t.name, t);
  }

  // 3. Build successor map: for each task, which tasks depend on it?
  const successors = new Map<string, string[]>();
  for (const t of activeTasks) {
    for (const dep of t.dependsOn) {
      if (!taskMap.has(dep)) continue; // skip missing deps
      const existing = successors.get(dep) || [];
      existing.push(t.name);
      successors.set(dep, existing);
    }
  }

  // 4. Find terminal tasks (no successors) and connect them to launch milestones
  //    Terminal tasks must complete before launch.
  const terminalTasks: string[] = [];
  for (const t of activeTasks) {
    if (!successors.has(t.name) || successors.get(t.name)!.length === 0) {
      terminalTasks.push(t.name);
    }
  }

  // Create virtual milestone nodes
  // DTC milestone depends on all non-Sephora terminal tasks
  // Sephora milestone depends on Sephora-specific terminal tasks + shared ones
  const milestoneLeadTime = 0;

  // Add virtual successors: terminal tasks → launch milestones
  for (const tn of terminalTasks) {
    const tmpl = taskMap.get(tn)!;
    if (tmpl.channelAnchor === 'sephora') {
      // Sephora-specific task → Sephora milestone
      const existing = successors.get(tn) || [];
      existing.push(SEPHORA_LAUNCH);
      successors.set(tn, existing);
    } else {
      // Everything else → DTC milestone (and Sephora too if it exists)
      const existing = successors.get(tn) || [];
      existing.push(DTC_LAUNCH);
      successors.set(tn, existing);
      if (sephoraDate) {
        existing.push(SEPHORA_LAUNCH);
      }
    }
  }

  // ── PASS 1: Backward scheduling (compute deadlines) ──────────────
  //    due(T) = min over successors S of: due(S) − S.leadTime
  //    i.e., T must be DONE by the time its earliest successor needs to START.

  const deadlines = new Map<string, Date>();

  // Set milestone dates
  deadlines.set(DTC_LAUNCH, dtcDate);
  if (sephoraDate) deadlines.set(SEPHORA_LAUNCH, sephoraDate);
  if (amazonDate) deadlines.set(AMAZON_LAUNCH, amazonDate);

  // Build external anchor map
  const externalAnchorMap = new Map<string, { date: Date; partner: string }>();
  for (const ea of input.externalAnchors || []) {
    externalAnchorMap.set(ea.taskName, { date: parseISO(ea.date), partner: ea.partnerName });
  }

  // Build manual override map
  const manualOverrideMap = new Map<string, Date>();
  for (const mo of input.manualOverrides || []) {
    manualOverrideMap.set(mo.taskName, parseISO(mo.date));
  }

  // Reverse topological sort (Kahn's on successor graph):
  // process terminal tasks first, then their predecessors
  const inDegree = new Map<string, number>();
  const allNames = activeTasks.map(t => t.name);
  for (const name of allNames) {
    inDegree.set(name, 0);
  }
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

  // Backward pass: compute deadline for each task
  for (const name of backwardOrder) {
    const tmpl = taskMap.get(name)!;

    // External anchor = hard constraint (highest priority)
    if (externalAnchorMap.has(name)) {
      deadlines.set(name, externalAnchorMap.get(name)!.date);
      continue;
    }
    // Manual override
    if (manualOverrideMap.has(name)) {
      deadlines.set(name, manualOverrideMap.get(name)!);
      continue;
    }

    const succs = successors.get(name) || [];
    let earliestNeeded: Date | null = null;

    for (const succName of succs) {
      let succDue: Date | undefined;
      let succLeadTime: number;

      if (succName === DTC_LAUNCH || succName === SEPHORA_LAUNCH || succName === AMAZON_LAUNCH) {
        succDue = deadlines.get(succName);
        succLeadTime = milestoneLeadTime;
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

    if (earliestNeeded) {
      if (tmpl.dueDateOffset && tmpl.dueDateOffset < 0) {
        earliestNeeded = subtractBusinessDays(earliestNeeded, Math.abs(tmpl.dueDateOffset));
      }
      deadlines.set(name, earliestNeeded);
    }
  }

  // ── PASS 2: Forward scheduling (compute actual dates) ─────────────
  //    due(T) = max(dep.due for all deps) + T.leadTime
  //    i.e., T starts the day after ALL deps are done, then takes T.leadTime BD.
  //
  //    Forward pass ensures tasks happen as soon as possible after their
  //    prerequisites, instead of floating to the latest possible date.
  //    If the forward date exceeds the backward deadline, we flag compression.

  // Forward topological sort: process tasks whose deps are ALL computed first
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

    // External anchors and manual overrides are hard constraints
    if (externalAnchorMap.has(name)) {
      dueDates.set(name, externalAnchorMap.get(name)!.date);
      continue;
    }
    if (manualOverrideMap.has(name)) {
      dueDates.set(name, manualOverrideMap.get(name)!);
      continue;
    }

    // Forward: due = max(dependency due dates) + this task's lead time
    const activeDeps = tmpl.dependsOn.filter(d => taskMap.has(d));
    let latestDepDue: Date | null = null;

    for (const dep of activeDeps) {
      const depDue = dueDates.get(dep);
      if (depDue && (!latestDepDue || depDue > latestDepDue)) {
        latestDepDue = depDue;
      }
    }

    let forwardDue: Date;
    if (latestDepDue) {
      forwardDue = addBusinessDays(latestDepDue, tmpl.leadTime);
    } else {
      // Root task (no deps): use deadline from backward pass as the due date
      // This anchors the entire forward chain to the backward-computed start
      const deadline = deadlines.get(name);
      forwardDue = deadline || subtractBusinessDays(dtcDate, tmpl.leadTime);
    }

    // Special: Samples Available gets extra offset
    if (tmpl.dueDateOffset && tmpl.dueDateOffset < 0) {
      // For Samples Available, the deadline (from backward pass) already has the offset.
      // In forward pass, we use the deadline directly since it's an ops task with no marketing deps.
      const deadline = deadlines.get(name);
      if (deadline) {
        forwardDue = deadline;
      }
    }

    // Clamp: don't exceed backward deadline (would delay downstream tasks)
    const deadline = deadlines.get(name);
    if (deadline && forwardDue > deadline) {
      // Forward date exceeds deadline — use deadline (some slack is eaten)
      forwardDue = deadline;
    }

    dueDates.set(name, forwardDue);
  }

  // ── Build result with compression detection ───────────────────────
  const scheduledTasks: ScheduledTask[] = [];

  for (let i = 0; i < activeTasks.length; i++) {
    const tmpl = activeTasks[i];
    const due = dueDates.get(tmpl.name);
    if (!due) continue;

    const startDate = subtractBusinessDays(due, tmpl.leadTime);
    const dueDateStr = formatDate(due);
    const startDateStr = formatDate(startDate);

    // Compression: forward due exceeded backward deadline
    const deadline = deadlines.get(tmpl.name);
    let isCompressed = false;
    let compressionDays = 0;

    // Check if forward-computed due was clamped by deadline
    if (deadline) {
      // Compute what forward due WOULD have been without clamping
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
          warnings.push(
            `"${tmpl.name}" is compressed by ${compressionDays} BD — deadline is ${formatDate(deadline)} but deps push it to ${formatDate(idealDue)}.`
          );
        }
      }
    }

    // Check external anchor
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
      isExternalAnchor: !!extAnchor,
      externalPartner: extAnchor?.partner,
      isCompressed,
      compressionDays: isCompressed ? compressionDays : undefined,
      channelAnchor: tmpl.channelAnchor,
    });
  }

  // Sort by due date ascending
  scheduledTasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  // Re-assign sortOrder after sorting
  scheduledTasks.forEach((t, i) => { t.sortOrder = i + 1; });

  // Compute summary
  const allDueDates = scheduledTasks.map(t => t.startDate).sort();
  const earliestStart = allDueDates[0] || input.dtcLaunchDate;
  const totalBD = differenceInBusinessDays(dtcDate, parseISO(earliestStart));

  return {
    tasks: scheduledTasks,
    warnings,
    earliestStartDate: earliestStart,
    totalBusinessDays: totalBD,
  };
}
