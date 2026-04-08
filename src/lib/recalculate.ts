import { Launch, GTMTask } from './types';
import { parseISO, differenceInBusinessDays, addBusinessDays, format, isAfter, isBefore, startOfDay } from 'date-fns';

export interface TaskDateChange {
  taskName: string;
  oldDate: string;
  newDate: string;
  daysMoved: number;
}

export interface RecalcResult {
  tasks: GTMTask[];
  daysLate: number;
  daysAbsorbed: number;
  impossible: boolean;
  warnings: string[];
  changes: TaskDateChange[];
}

// Anchor task names that should never move
const ANCHOR_PATTERNS = [
  'DTC Launch', 'Sephora US Launch', 'Sephora Launch',
  'Sephora Final Assets', 'DTC Final Assets',
  'PDP Ready', 'Launch',
];

function isAnchorTask(taskName: string): boolean {
  return ANCHOR_PATTERNS.some(p => taskName.includes(p));
}

// Minimum lead time threshold — tasks with gaps this small or smaller won't be compressed
const MIN_GAP_THRESHOLD = 3;

export function recalculateTimeline(launch: Launch): RecalcResult {
  const today = startOfDay(new Date());
  const warnings: string[] = [];
  const changes: TaskDateChange[] = [];

  // Build mutable task map
  const taskMap = new Map(launch.tasks.map(t => [t.id, { ...t }]));

  // Build reverse dependency map: taskId → [IDs of tasks that depend on it]
  const dependentsOf = new Map<string, string[]>();
  for (const t of launch.tasks) {
    for (const depId of t.dependencies) {
      if (!dependentsOf.has(depId)) dependentsOf.set(depId, []);
      dependentsOf.get(depId)!.push(t.id);
    }
  }

  // Find overdue incomplete tasks
  const overdueTasks = launch.tasks.filter(t =>
    t.status !== 'complete' && t.status !== 'skipped' && t.dueDate &&
    isBefore(parseISO(t.dueDate), today)
  );

  if (overdueTasks.length === 0) {
    return { tasks: launch.tasks, daysLate: 0, daysAbsorbed: 0, impossible: false, warnings: ['Timeline is on track — no recalculation needed.'], changes: [] };
  }

  const earliestOverdue = overdueTasks.reduce((min, t) =>
    t.dueDate! < min ? t.dueDate! : min, overdueTasks[0].dueDate!);
  const daysLate = differenceInBusinessDays(today, parseISO(earliestOverdue));

  // Step 1: Push overdue tasks to today (or today + duration if they have start/due)
  for (const t of overdueTasks) {
    const task = taskMap.get(t.id)!;
    const originalDate = task.dueDate!;
    const duration = task.durationDays || (task.startDate && task.dueDate
      ? differenceInBusinessDays(parseISO(task.dueDate), parseISO(task.startDate))
      : 3);

    task.startDate = format(today, 'yyyy-MM-dd');
    task.dueDate = format(addBusinessDays(today, duration), 'yyyy-MM-dd');

    const daysMoved = differenceInBusinessDays(parseISO(task.dueDate), parseISO(originalDate));
    if (daysMoved !== 0) {
      changes.push({ taskName: task.name, oldDate: originalDate, newDate: task.dueDate, daysMoved });
    }
  }

  // Step 2: Topological sort propagation — ensure every task starts after all deps finish
  // Process tasks in topological order (by dependency depth)
  const processed = new Set<string>();
  const taskOrder: string[] = [];

  function visit(id: string) {
    if (processed.has(id)) return;
    processed.add(id);
    const task = taskMap.get(id);
    if (!task) return;
    // Visit all dependencies first
    for (const depId of task.dependencies) {
      visit(depId);
    }
    taskOrder.push(id);
  }

  for (const t of launch.tasks) {
    visit(t.id);
  }

  // Process in topological order — push forward if deps finish after start
  for (const id of taskOrder) {
    const task = taskMap.get(id)!;
    if (task.status === 'complete' || task.status === 'skipped' || !task.dueDate) continue;
    if (task.dependencies.length === 0) continue;

    // Find the latest dependency end date
    // For completed deps, use completedDate (they're done — don't block on original dueDate)
    // For incomplete deps, use dueDate
    let latestDepDue = '';
    for (const depId of task.dependencies) {
      const dep = taskMap.get(depId);
      if (!dep) continue;
      const depEndDate = (dep.status === 'complete' || dep.status === 'skipped')
        ? (dep.completedDate?.split('T')[0] || dep.dueDate || '')
        : (dep.dueDate || '');
      if (depEndDate > latestDepDue) latestDepDue = depEndDate;
    }
    if (!latestDepDue) continue;

    const latestDepDate = parseISO(latestDepDue);
    const currentStart = task.startDate ? parseISO(task.startDate) :
      (task.durationDays ? addBusinessDays(parseISO(task.dueDate), -task.durationDays) : parseISO(task.dueDate));

    // If latest dep finishes after this task starts, push it forward
    if (isAfter(latestDepDate, currentStart) || format(latestDepDate, 'yyyy-MM-dd') === format(currentStart, 'yyyy-MM-dd') && isAfter(latestDepDate, currentStart)) {
      const originalDate = task.dueDate;
      const duration = task.durationDays ||
        (task.startDate ? differenceInBusinessDays(parseISO(task.dueDate), parseISO(task.startDate)) : 3);

      task.startDate = format(latestDepDate, 'yyyy-MM-dd');
      task.dueDate = format(addBusinessDays(latestDepDate, Math.max(0, duration)), 'yyyy-MM-dd');

      const daysMoved = differenceInBusinessDays(parseISO(task.dueDate), parseISO(originalDate));
      if (daysMoved !== 0 && !changes.find(c => c.taskName === task.name)) {
        changes.push({ taskName: task.name, oldDate: originalDate, newDate: task.dueDate, daysMoved });
      }
    }
  }

  // Check if any tasks now exceed the launch date
  const launchDateStr = launch.launchDate;
  const launchDateParsed = launchDateStr ? parseISO(launchDateStr) : null;
  let impossible = false;
  let daysOverLaunch = 0;

  if (launchDateParsed) {
    for (const task of taskMap.values()) {
      if (task.status === 'complete' || task.status === 'skipped' || !task.dueDate) continue;
      if (task.name === 'D2C Launch' || task.name === 'Sephora Launch') continue;
      const taskDue = parseISO(task.dueDate);
      if (isAfter(taskDue, launchDateParsed)) {
        const over = differenceInBusinessDays(taskDue, launchDateParsed);
        if (over > daysOverLaunch) daysOverLaunch = over;
        impossible = true;
      }
    }
  }

  if (impossible) {
    warnings.push(`${daysOverLaunch} business day${daysOverLaunch !== 1 ? 's' : ''} past the launch date — consider extending the launch date or reducing task durations.`);
  }

  const daysAbsorbed = daysLate;

  if (changes.length === 0) {
    warnings.push('Timeline is on track — no recalculation needed.');
  }

  return {
    tasks: Array.from(taskMap.values()),
    daysLate: impossible ? daysOverLaunch : daysLate,
    daysAbsorbed,
    impossible,
    warnings,
    changes,
  };
}

/**
 * When a task is completed early, calculate how many days were saved
 * and find the tightest upcoming windows to add buffer to.
 */
export function calculateEarlyFinishRedistribution(launch: Launch, completedTaskId: string): {
  daysSaved: number;
  redistributions: { taskId: string; taskName: string; currentGap: number; newGap: number }[];
  newTasks: GTMTask[];
} | null {
  const today = startOfDay(new Date());
  const task = launch.tasks.find(t => t.id === completedTaskId);
  if (!task || !task.dueDate) return null;

  const dueDate = parseISO(task.dueDate);
  const daysSaved = differenceInBusinessDays(dueDate, today);
  if (daysSaved <= 0) return null; // Not early

  // Find incomplete tasks after this one, sorted by due date
  const upcomingTasks = launch.tasks
    .filter(t => t.status !== 'complete' && t.status !== 'skipped' && t.dueDate && t.id !== completedTaskId)
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

  if (upcomingTasks.length < 2) return null;

  // Find the tightest gaps (smallest lead times between consecutive tasks)
  const gapsWithInfo: { taskId: string; taskName: string; gap: number; index: number }[] = [];

  for (let i = 1; i < upcomingTasks.length; i++) {
    const prevDate = parseISO(upcomingTasks[i - 1].dueDate!);
    const currDate = parseISO(upcomingTasks[i].dueDate!);
    const gap = differenceInBusinessDays(currDate, prevDate);

    // Only consider non-anchor tasks with tight gaps
    if (!isAnchorTask(upcomingTasks[i].name) && gap > 0 && gap <= 5) {
      gapsWithInfo.push({
        taskId: upcomingTasks[i].id,
        taskName: upcomingTasks[i].name,
        gap,
        index: i,
      });
    }
  }

  if (gapsWithInfo.length === 0) return null;

  // Sort by tightest gap first
  gapsWithInfo.sort((a, b) => a.gap - b.gap);

  // Distribute saved days to the tightest windows
  let daysToDistribute = daysSaved;
  const redistributions: { taskId: string; taskName: string; currentGap: number; newGap: number }[] = [];
  const taskDateAdjustments = new Map<string, number>(); // taskId -> days to add

  for (const gapInfo of gapsWithInfo) {
    if (daysToDistribute <= 0) break;

    // Add 1-2 days to each tight window, distribute evenly
    const daysToAdd = Math.min(daysToDistribute, 2);
    redistributions.push({
      taskId: gapInfo.taskId,
      taskName: gapInfo.taskName,
      currentGap: gapInfo.gap,
      newGap: gapInfo.gap + daysToAdd,
    });
    taskDateAdjustments.set(gapInfo.taskId, daysToAdd);
    daysToDistribute -= daysToAdd;
  }

  // Build new task list with adjusted dates
  // Push affected tasks and everything after them forward
  const adjustedTaskIds = new Set(taskDateAdjustments.keys());
  const newTasks = launch.tasks.map(t => {
    if (adjustedTaskIds.has(t.id)) {
      const daysToAdd = taskDateAdjustments.get(t.id)!;
      return {
        ...t,
        dueDate: t.dueDate ? format(addBusinessDays(parseISO(t.dueDate), daysToAdd), 'yyyy-MM-dd') : t.dueDate,
      };
    }
    return { ...t };
  });

  return { daysSaved, redistributions, newTasks };
}
