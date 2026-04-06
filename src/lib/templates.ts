import { GTMTask, ContentProductionType, Owner, PhaseKey } from './types';
import { v4 as uuid } from 'uuid';
import { addBusinessDays, format } from 'date-fns';

interface TaskTemplate {
  name: string;
  phase: PhaseKey;
  owner: Owner;
  durationDays: number;
  sortOrder: number;
  skipWhen?: ContentProductionType[];
}

const TASK_TEMPLATES: TaskTemplate[] = [
  // Content Planning
  { name: 'Marketing Positioning', phase: 'content_planning', owner: 'marketing', durationDays: 5, sortOrder: 1 },
  { name: 'Copy Direction', phase: 'content_planning', owner: 'marketing', durationDays: 5, sortOrder: 2 },
  { name: 'Brainstorm Meeting', phase: 'content_planning', owner: 'marketing', durationDays: 2, sortOrder: 3 },
  { name: 'Brainstorm Concepts Approved', phase: 'content_planning', owner: 'marketing', durationDays: 3, sortOrder: 4 },
  { name: '1st Draft Marketing Deck & Asset Request Form', phase: 'content_planning', owner: 'channel_leads', durationDays: 5, sortOrder: 5 },

  // Finalize & Inform Mgmt
  { name: 'Final Marketing Launch Deck', phase: 'finalize_mgmt', owner: 'marketing', durationDays: 3, sortOrder: 6 },
  { name: 'Management Approval', phase: 'finalize_mgmt', owner: 'marketing', durationDays: 2, sortOrder: 7 },

  // Content Production
  { name: 'Asset Request Form Approval / AD Start', phase: 'content_production', owner: 'creative', durationDays: 11, sortOrder: 8, skipWhen: ['none'] },
  { name: 'Production Start', phase: 'content_production', owner: 'creative', durationDays: 7, sortOrder: 9, skipWhen: ['none'] },
  { name: 'Shoot Start', phase: 'content_production', owner: 'creative', durationDays: 10, sortOrder: 10, skipWhen: ['none'] },
  { name: 'Retouching Start', phase: 'content_production', owner: 'creative', durationDays: 10, sortOrder: 11, skipWhen: ['none'] },
  { name: 'Tech Hand Off', phase: 'content_production', owner: 'creative', durationDays: 0, sortOrder: 12, skipWhen: ['none', 'no_tech'] },

  // Design Production
  { name: 'Design Briefs Due', phase: 'design_production', owner: 'channel_leads', durationDays: 21, sortOrder: 13 },
  { name: 'Design Approvals & Scheduling Start', phase: 'design_production', owner: 'channel_leads', durationDays: 5, sortOrder: 14 },
  { name: 'Creative 360 Review', phase: 'design_production', owner: 'creative', durationDays: 0, sortOrder: 15 },
  { name: 'Launch', phase: 'design_production', owner: 'marketing', durationDays: 0, sortOrder: 16 },
];

export function generateTasksFromTemplate(
  launchDate: string,
  contentProductionType: ContentProductionType
): GTMTask[] {
  const applicableTemplates = TASK_TEMPLATES.filter(
    t => !t.skipWhen || !t.skipWhen.includes(contentProductionType)
  );

  // Work backwards from launch date
  const launch = new Date(launchDate);
  const tasks: GTMTask[] = [];
  let currentDate = launch;

  // Calculate dates working backwards from launch
  const reversed = [...applicableTemplates].reverse();
  const dates: Date[] = [];

  for (const template of reversed) {
    dates.unshift(new Date(currentDate));
    currentDate = addBusinessDays(currentDate, -template.durationDays);
  }

  for (let i = 0; i < applicableTemplates.length; i++) {
    const template = applicableTemplates[i];
    tasks.push({
      id: uuid(),
      name: template.name,
      phase: template.phase,
      owner: template.owner,
      durationDays: template.durationDays,
      startDate: null,
      dueDate: format(dates[i], 'yyyy-MM-dd'),
      completedDate: null,
      status: 'not_started',
      notes: '',
      dependencies: i > 0 ? [tasks[i - 1].id] : [],
      sortOrder: template.sortOrder,
    });
  }

  return tasks;
}

export function getDefaultStrategy() {
  return {
    targetAudience: '',
    keyInsight: '',
    positioning: '',
    keyMessages: ['', '', ''],
    proofPoints: [''],
    competitiveDifferentiation: '',
    toneOfVoice: '',
  };
}

export function getDefaultMarketingPlan() {
  return {
    objectives: [''],
    keyMetrics: [{ metric: '', target: '' }],
    paidMedia: [
      { channel: 'Social', tactic: '', timing: '', budget: null, kpiTarget: '', status: 'not_started' as const, owner: 'digital' as const, notes: '' },
      { channel: 'YouTube', tactic: '', timing: '', budget: null, kpiTarget: '', status: 'not_started' as const, owner: 'digital' as const, notes: '' },
      { channel: 'Display', tactic: '', timing: '', budget: null, kpiTarget: '', status: 'not_started' as const, owner: 'digital' as const, notes: '' },
      { channel: 'Paid Search (Non-Branded)', tactic: '', timing: '', budget: null, kpiTarget: '', status: 'not_started' as const, owner: 'digital' as const, notes: '' },
      { channel: 'Audio', tactic: '', timing: '', budget: null, kpiTarget: '', status: 'not_started' as const, owner: 'digital' as const, notes: '' },
      { channel: 'OOH', tactic: '', timing: '', budget: null, kpiTarget: '', status: 'not_started' as const, owner: 'digital' as const, notes: '' },
      { channel: 'Native/Partnership', tactic: '', timing: '', budget: null, kpiTarget: '', status: 'not_started' as const, owner: 'digital' as const, notes: '' },
    ],
    influencer: [
      { channel: 'Macro', tactic: '', timing: '', budget: null, kpiTarget: '', status: 'not_started' as const, owner: 'influencer' as const, notes: '' },
      { channel: 'Mid Tier', tactic: '', timing: '', budget: null, kpiTarget: '', status: 'not_started' as const, owner: 'influencer' as const, notes: '' },
      { channel: 'Micro', tactic: '', timing: '', budget: null, kpiTarget: '', status: 'not_started' as const, owner: 'influencer' as const, notes: '' },
      { channel: 'Gifting', tactic: '', timing: '', budget: null, kpiTarget: '', status: 'not_started' as const, owner: 'influencer' as const, notes: '' },
    ],
    owned: [
      { channel: 'Instagram', tactic: '', timing: '', budget: null, kpiTarget: '', status: 'not_started' as const, owner: 'marketing' as const, notes: '' },
      { channel: 'TikTok', tactic: '', timing: '', budget: null, kpiTarget: '', status: 'not_started' as const, owner: 'marketing' as const, notes: '' },
      { channel: 'Email', tactic: '', timing: '', budget: null, kpiTarget: '', status: 'not_started' as const, owner: 'channel_leads' as const, notes: '' },
      { channel: 'SMS', tactic: '', timing: '', budget: null, kpiTarget: '', status: 'not_started' as const, owner: 'channel_leads' as const, notes: '' },
      { channel: 'Homepage Takeover', tactic: '', timing: '', budget: null, kpiTarget: '', status: 'not_started' as const, owner: 'channel_leads' as const, notes: '' },
      { channel: 'Blog', tactic: '', timing: '', budget: null, kpiTarget: '', status: 'not_started' as const, owner: 'channel_leads' as const, notes: '' },
    ],
    retail: [],
    pr: [],
    events: [],
    totalBudget: null,
  };
}

export const CHANNEL_PLAN_SECTIONS = [
  { key: 'paidMedia', label: 'Paid Media (Prospecting)', icon: 'megaphone' },
  { key: 'influencer', label: 'Influencer', icon: 'users' },
  { key: 'owned', label: 'Owned Channels', icon: 'layout' },
  { key: 'retail', label: 'Retail', icon: 'store' },
  { key: 'pr', label: 'PR', icon: 'newspaper' },
  { key: 'events', label: 'Events', icon: 'calendar' },
] as const;
