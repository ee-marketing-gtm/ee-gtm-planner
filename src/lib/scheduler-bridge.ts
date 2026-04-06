/**
 * Bridge between the scheduler's ScheduledTask[] and the app's GTMTask[].
 * Converts scheduler output into the format stored on Launch objects.
 */

import { v4 as uuid } from 'uuid';
import { GTMTask } from './types';
import { ScheduledTask } from './scheduler';

export function scheduledTasksToGTMTasks(scheduledTasks: ScheduledTask[]): GTMTask[] {
  // First pass: assign IDs and build name→ID map
  const nameToId = new Map<string, string>();
  const ids: string[] = [];
  for (const st of scheduledTasks) {
    const id = uuid();
    nameToId.set(st.name, id);
    ids.push(id);
  }

  // Second pass: build GTMTask[] with resolved dependencies
  return scheduledTasks.map((st, i) => ({
    id: ids[i],
    name: st.name,
    phase: st.phase,
    owner: st.appOwner,
    durationDays: st.leadTime,
    startDate: st.startDate,
    dueDate: st.dueDate,
    completedDate: null,
    status: 'not_started' as const,
    notes: st.notes || '',
    dependencies: st.dependsOn
      .map(depName => nameToId.get(depName))
      .filter((id): id is string => id !== undefined),
    dependencyNames: st.dependsOn.length > 0 ? st.dependsOn : undefined,
    sortOrder: st.sortOrder,
    isMeeting: st.isMeeting || undefined,
    meetingChecklist: st.meetingChecklist || undefined,
    isCompressed: st.isCompressed || undefined,
    compressionDays: st.compressionDays || undefined,
  }));
}
