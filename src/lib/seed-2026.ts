/**
 * 2026 Launch Seed Data
 *
 * Uses the backward scheduler + bridge to auto-compute all task dates
 * from the master template. Only launch metadata is defined here.
 */

import { v4 as uuid } from 'uuid';
import { Launch, GTMTask, LaunchType, LaunchTier, ContentProductionType, PhaseKey } from './types';
import { getDefaultStrategy, getDefaultMarketingPlan } from './templates';
import { scheduleLaunch, ScheduleInput } from './scheduler';
import { scheduledTasksToGTMTasks } from './scheduler-bridge';

// ── Types ──────────────────────────────────────────────────────────

type LaunchGroup = 'launched' | 'in_progress' | 'planning';

interface LaunchConfig {
  name: string;
  dtcLaunchDate: string;
  sephoraLaunchDate?: string;
  amazonLaunchDate?: string;
  tier: LaunchTier;
  launchType: LaunchType;
  contentProductionType: ContentProductionType;
  productCategory: string;
  productImageUrl?: string;
  description: string;
  group: LaunchGroup;
  designProductionOnly?: boolean;  // filter to design_production phase only
}

// ── Helpers ─────────────────────────────────────────────────────────

const TODAY = '2026-04-03';

function applyStatuses(tasks: GTMTask[], group: LaunchGroup): GTMTask[] {
  return tasks.map(t => {
    if (group === 'launched') {
      return { ...t, status: 'complete' as const, completedDate: t.dueDate };
    }
    if (group === 'in_progress') {
      if (t.dueDate && t.dueDate < TODAY) {
        return { ...t, status: 'complete' as const, completedDate: t.dueDate };
      }
      return t; // stays not_started (default from bridge)
    }
    // planning — all stay not_started
    return t;
  });
}

function filterDesignProductionOnly(tasks: GTMTask[]): GTMTask[] {
  return tasks.filter(t => t.phase === 'design_production');
}

function deriveLaunchStatus(group: LaunchGroup): 'planning' | 'in_progress' | 'launched' | 'post_launch' {
  switch (group) {
    case 'launched': return 'post_launch';
    case 'in_progress': return 'in_progress';
    case 'planning': return 'planning';
  }
}

function buildLaunchFromConfig(config: LaunchConfig): Launch {
  const now = new Date().toISOString();

  // Schedule all tasks from the template
  const scheduleInput: ScheduleInput = {
    dtcLaunchDate: config.dtcLaunchDate,
    sephoraLaunchDate: config.sephoraLaunchDate,
    amazonLaunchDate: config.amazonLaunchDate,
  };
  const result = scheduleLaunch(scheduleInput);

  // Convert to GTMTask[]
  let tasks = scheduledTasksToGTMTasks(result.tasks);

  // Filter to design_production only if needed
  if (config.designProductionOnly) {
    tasks = filterDesignProductionOnly(tasks);
  }

  // Apply status based on launch group
  tasks = applyStatuses(tasks, config.group);

  return {
    id: uuid(),
    name: config.name,
    launchDate: config.dtcLaunchDate,
    sephoraLaunchDate: config.sephoraLaunchDate,
    amazonLaunchDate: config.amazonLaunchDate,
    launchType: config.launchType,
    tier: config.tier,
    contentProductionType: config.contentProductionType,
    status: deriveLaunchStatus(config.group),
    productCategory: config.productCategory,
    productImageUrl: config.productImageUrl,
    description: config.description,
    tasks,
    strategy: getDefaultStrategy(),
    marketingPlan: getDefaultMarketingPlan(),
    createdAt: now,
    updatedAt: now,
  };
}

// ── Launch Definitions ──────────────────────────────────────────────

const LAUNCH_CONFIGS: LaunchConfig[] = [
  // ─── ALREADY LAUNCHED ─────────────────────────────────────────────

  {
    name: 'VVIP Ambassador Program',
    dtcLaunchDate: '2026-02-24',
    tier: 'A',
    launchType: 'campaign',
    contentProductionType: 'no_tech',
    productCategory: 'Brand',
    description: 'VIP ambassador program launch with full content production',
    group: 'launched',
  },
  {
    name: 'Sephora Evereden US In-Store Launch',
    dtcLaunchDate: '2026-03-16',
    tier: 'A',
    launchType: 'new_product',
    contentProductionType: 'with_tech',
    productCategory: 'Retail',
    description: 'Sephora US in-store launch — full GTM production for retail channel',
    group: 'launched',
  },

  // ─── IN PROGRESS ──────────────────────────────────────────────────

  {
    name: 'LE Fragrance Mist x Embreigh',
    dtcLaunchDate: '2026-05-05',
    tier: 'A',
    launchType: 'collaboration',
    contentProductionType: 'with_tech',
    productCategory: 'Kids',
    productImageUrl: 'https://ever-eden.com/cdn/shop/files/DTC_HappyHairDuo_Catalog_GWP_Text_1024x1024.jpg?v=1764698671',
    description: 'Limited edition fragrance mist collaboration with Embreigh — Tier A full production launch',
    group: 'in_progress',
  },
  {
    name: 'Kids Cooling Mineral Sunstick SPF30',
    dtcLaunchDate: '2026-05-19',
    sephoraLaunchDate: '2026-06-30',
    tier: 'B',
    launchType: 'new_product',
    contentProductionType: 'with_tech',
    productCategory: 'Kids',
    productImageUrl: 'https://ever-eden.com/cdn/shop/files/DTC_HealthyMorningDuo_Catalog_GWP_text_pink_1024x1024.jpg?v=1764698279',
    description: 'New SPF30 mineral sunstick for kids — DTC May 19, Sephora June 30',
    group: 'in_progress',
  },
  {
    name: 'Kids Deodorant',
    dtcLaunchDate: '2026-06-19',
    sephoraLaunchDate: '2026-07-03',
    tier: 'A',
    launchType: 'new_product',
    contentProductionType: 'with_tech',
    productCategory: 'Kids',
    productImageUrl: 'https://ever-eden.com/cdn/shop/files/PDP_Catalog_OldPackNewLogo_Kids123Peach_Headband_1024x1024.jpg?v=1773705792',
    description: 'New category entry — kids deodorant. Tier A full production launch. DTC Jun 19, Sephora Jul 3',
    group: 'in_progress',
  },
  {
    name: 'Polly Pocket Set',
    dtcLaunchDate: '2026-08-04',
    tier: 'A',
    launchType: 'collaboration',
    contentProductionType: 'with_tech',
    productCategory: 'Kids',
    description: 'Polly Pocket x Evereden collaboration set — see Mattel tab for additional details',
    group: 'in_progress',
  },

  // ─── PLANNING (NOT STARTED) ───────────────────────────────────────

  {
    name: 'LE Shimmer Lip Oil',
    dtcLaunchDate: '2026-08-06',
    sephoraLaunchDate: '2026-09-28',
    tier: 'B',
    launchType: 'new_product',
    contentProductionType: 'with_tech',
    productCategory: 'Kids',
    description: 'Limited edition shimmer lip oil — DTC Aug 6, Sephora Sep 28',
    group: 'planning',
  },
  {
    name: 'Sephora Evergreen Set',
    dtcLaunchDate: '2026-09-28',
    tier: 'B',
    launchType: 'seasonal',
    contentProductionType: 'none',
    productCategory: 'Retail',
    description: 'Sephora evergreen set — design production only',
    group: 'planning',
    designProductionOnly: true,
  },
  {
    name: 'Kaili Holiday Set',
    dtcLaunchDate: '2026-09-29',
    tier: 'B',
    launchType: 'seasonal',
    contentProductionType: 'with_tech',
    productCategory: 'Kids',
    description: 'Kaili holiday gift set with full production',
    group: 'planning',
  },
  {
    name: 'Embreigh Holiday Set',
    dtcLaunchDate: '2026-10-06',
    tier: 'B',
    launchType: 'seasonal',
    contentProductionType: 'with_tech',
    productCategory: 'Kids',
    description: 'Embreigh holiday gift set with full production',
    group: 'planning',
  },
  {
    name: 'Teen Holiday Set',
    dtcLaunchDate: '2026-10-06',
    sephoraLaunchDate: '2026-09-28',
    tier: 'B',
    launchType: 'seasonal',
    contentProductionType: 'none',
    productCategory: 'Teen',
    description: 'Teen holiday set — design production only. Sephora Sep 28, DTC Oct 6',
    group: 'planning',
    designProductionOnly: true,
  },
  {
    name: 'Preppy in Pink Holiday Set',
    dtcLaunchDate: '2026-09-28',
    tier: 'B',
    launchType: 'seasonal',
    contentProductionType: 'none',
    productCategory: 'Kids',
    description: 'Preppy in Pink holiday set — Sephora exclusive, design production only',
    group: 'planning',
    designProductionOnly: true,
  },
];

// ── Main export ─────────────────────────────────────────────────────

export function generate2026Launches(): Launch[] {
  return LAUNCH_CONFIGS.map(buildLaunchFromConfig);
}
