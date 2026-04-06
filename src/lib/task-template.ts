/**
 * Launch Task Template — the single source of truth for Evereden's GTM process.
 *
 * Each task defines:
 *   - leadTime: business days this task takes to complete
 *   - dependsOn: task names that must be DONE before this task can START
 *     (when multiple deps: task starts after ALL are complete — uses latest due date)
 *   - owner / support: primary and secondary responsible teams
 *   - phase: which GTM phase this belongs to
 *
 * The scheduler walks backward from the launch date(s) to compute every due date.
 */

import { PhaseKey, Owner } from './types';

// ── Extended owner type for template (superset of app Owner type) ──
export type TemplateOwner = Owner | 'copywriter' | 'growth' | 'leadership';

export interface TaskTemplate {
  name: string;
  leadTime: number;             // business days (duration of work)
  dependsOn: string[];          // task names this depends on
  owner: TemplateOwner;
  support?: string;             // secondary owner / team
  phase: PhaseKey;
  isMeeting?: boolean;          // lead time = scheduling window, actual duration = 1 day
  meetingChecklist?: string[];   // for meetings: items to align on / discuss
  isOptional?: boolean;         // only included if user enables it (e.g., events, OOH)
  isManualDate?: boolean;       // date set manually, not auto-scheduled
  channelAnchor?: 'sephora';   // if set, anchors to that channel's launch date instead of DTC
  dueDateOffset?: number;       // extra BD offset subtracted from computed due (e.g., -10 for Samples)
  notes?: string;
}

/**
 * Master task template — ordered by typical execution flow.
 *
 * DEPENDENCY RULE: when a task has multiple dependsOn entries,
 * it can only START after ALL of them are complete. The scheduler
 * uses the LATEST dependency due date as the starting point.
 *
 * FLOW OVERVIEW:
 *   GTM Planning → Brainstorm → [4 parallel tracks from brainstorm]:
 *     Track 1: Positioning → Copy Brief → Taglines → Final Taglines
 *     Track 2: GTM Deck → Asset Requests → Finalize Assets → Shoots → Photo Selects
 *     Track 3: Social Strategy → Sourcing Creators → Creator Content
 *     Track 4: Finalize Email Plan
 *   Then converges:
 *     Draft Briefs (email, PDP, social) → Brief Alignment → Asset Design Briefs
 *     Photo Selects + Asset Design Briefs → R1 Assets → Feedback → Final Assets → Copy → Launch
 */
export const LAUNCH_TASK_TEMPLATE: TaskTemplate[] = [

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 1: CONTENT PLANNING
  // ═══════════════════════════════════════════════════════════════════

  // ── GTM Planning ──────────────────────────────────────────────────
  {
    name: 'Product Sheet & Competitive Landscape',
    leadTime: 3,
    dependsOn: [],
    owner: 'marketing',
    phase: 'content_planning',
    notes: 'First task — start date computed backward from launch date',
  },
  {
    name: 'Draft Product Positioning & Messaging',
    leadTime: 3,
    dependsOn: ['Product Sheet & Competitive Landscape'],
    owner: 'marketing',
    phase: 'content_planning',
  },

  // ── Cross-functional Alignment ────────────────────────────────────
  {
    name: 'GTM Brainstorm Meeting',
    leadTime: 3,
    dependsOn: ['Draft Product Positioning & Messaging'],
    owner: 'marketing',
    support: 'cross-functional',
    phase: 'content_planning',
    isMeeting: true,
    meetingChecklist: [
      'Align on product positioning & marketing pillars',
      'Review creative concepts & mood board direction',
      'Confirm bundle assortment & SKUs',
      'Discuss retail channel presence (Sephora, Amazon, DTC)',
      'Identify key campaign moments & tentpole dates',
    ],
    notes: 'Align on: positioning, marketing pillars, creative concepts, bundle assortment, retail channel presence',
  },

  // ── Brainstorm Outputs (4 parallel tracks) ────────────────────────
  {
    name: 'Finalize Product Positioning & Messaging',
    leadTime: 3,
    dependsOn: ['GTM Brainstorm Meeting'],
    owner: 'marketing',
    phase: 'content_planning',
  },
  {
    name: 'Finalize Creative Shoot Plan',
    leadTime: 3,
    dependsOn: ['GTM Brainstorm Meeting'],
    owner: 'creative',
    phase: 'content_planning',
  },
  {
    name: 'Finalize Bundle Assortment',
    leadTime: 3,
    dependsOn: ['GTM Brainstorm Meeting'],
    owner: 'growth',
    phase: 'content_planning',
  },
  {
    name: 'Finalize 360 GTM Plan & Retail Channels',
    leadTime: 3,
    dependsOn: ['GTM Brainstorm Meeting'],
    owner: 'leadership',
    phase: 'content_planning',
    notes: 'Includes homepage alignment — confirm homepage hero, modules, and timing.',
  },
  {
    name: 'Finalize Email Plan',
    leadTime: 3,
    dependsOn: ['GTM Brainstorm Meeting'],
    owner: 'growth',
    phase: 'content_planning',
  },

  // ── Copy Track ────────────────────────────────────────────────────
  {
    name: 'Submit Tagline + Campaign Copy Brief',
    leadTime: 3,
    dependsOn: ['Finalize Product Positioning & Messaging'],
    owner: 'marketing',
    support: 'copywriter',
    phase: 'content_planning',
  },
  {
    name: 'R1 Taglines & Copy Due',
    leadTime: 5,
    dependsOn: ['Submit Tagline + Campaign Copy Brief'],
    owner: 'copywriter',
    phase: 'content_planning',
  },
  {
    name: 'Tagline / Copy Iteration',
    leadTime: 5,
    dependsOn: ['R1 Taglines & Copy Due'],
    owner: 'copywriter',
    phase: 'content_planning',
  },
  {
    name: 'Final Taglines & Campaign Copy Due',
    leadTime: 5,
    dependsOn: ['Tagline / Copy Iteration'],
    owner: 'marketing',
    support: 'copywriter',
    phase: 'content_planning',
  },

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2: FINALIZE & INFORM MGMT
  // ═══════════════════════════════════════════════════════════════════

  {
    name: 'Final GTM Deck',
    leadTime: 3,
    dependsOn: [
      'Finalize Product Positioning & Messaging',
      'Finalize Bundle Assortment',
      'Finalize 360 GTM Plan & Retail Channels',
      'Final Taglines & Campaign Copy Due',
    ],
    owner: 'marketing',
    support: 'cross-functional',
    phase: 'finalize_mgmt',
    notes: 'Align on: final taglines, final 360 GTM plan, bundle assortment. Requires all brainstorm outputs + final taglines.',
  },

  // ═══════════════════════════════════════════════════════════════════
  // PACKAGING DEVELOPMENT (parallel track after management approval)
  // ═══════════════════════════════════════════════════════════════════

  {
    name: 'Marketing Briefs Creative on Packaging',
    leadTime: 3,
    dependsOn: ['Final GTM Deck'],
    owner: 'marketing',
    phase: 'packaging',
  },
  {
    name: 'Creative Sources & Develops Packaging Options',
    leadTime: 10,
    dependsOn: ['Marketing Briefs Creative on Packaging'],
    owner: 'creative',
    phase: 'packaging',
  },
  {
    name: 'Packaging Design Refinement & Finalization',
    leadTime: 5,
    dependsOn: ['Creative Sources & Develops Packaging Options'],
    owner: 'marketing',
    phase: 'packaging',
    notes: 'Marketing + Kim (founder) refine concepts, finalize structure/shape/colors',
  },
  {
    name: 'Packaging Copy Sheet',
    leadTime: 5,
    dependsOn: ['Marketing Briefs Creative on Packaging'],
    owner: 'marketing',
    phase: 'packaging',
    notes: 'Runs in parallel with design exploration. Draft copy should be near-final for samples.',
  },
  {
    name: 'Packaging Samples Ready',
    leadTime: 0,
    dependsOn: ['Packaging Design Refinement & Finalization', 'Packaging Copy Sheet'],
    owner: 'creative',
    phase: 'packaging',
    notes: 'Gate: packaging finalized before product photoshoot samples',
  },

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 3: CONTENT PRODUCTION
  // ═══════════════════════════════════════════════════════════════════

  // ── Asset Requests Track ──────────────────────────────────────────
  {
    name: 'Draft Asset Request Form',
    leadTime: 3,
    dependsOn: ['Final GTM Deck'],
    owner: 'marketing',
    support: 'creative',
    phase: 'content_production',
  },
  {
    name: 'Finalize Social Strategy',
    leadTime: 5,
    dependsOn: ['Final GTM Deck'],
    owner: 'social',
    phase: 'content_production',
  },
  {
    name: 'Finalize Asset Requests',
    leadTime: 10,
    dependsOn: ['Draft Asset Request Form'],
    owner: 'marketing',
    support: 'creative',
    phase: 'content_production',
    notes: 'Meet with creative during this time to align on all assets needed',
  },

  // ── Photography Track ─────────────────────────────────────────────
  //    Flow: Finalize Asset Requests + Creative Shoot Plan + Samples
  //          → Shoots → Photo Selects Ready (~2 wks)
  //          → feeds into R1 Assets (in Design Production)
  {
    name: 'Samples Available',
    leadTime: 10,
    dependsOn: [],
    owner: 'ops',
    phase: 'content_production',
    dueDateOffset: -10,
    notes: 'Product samples must be physically available 2 weeks (10 BD) before shoots. Due date auto-computed from shoot dates.',
  },
  {
    name: 'Lifestyle Shoot',
    leadTime: 5,
    dependsOn: [
      'Finalize Asset Requests',
      'Finalize Creative Shoot Plan',
      'Samples Available',
      'Packaging Samples Ready',
    ],
    owner: 'creative',
    phase: 'content_production',
    notes: 'Week-long scheduling window. Depends on: asset requests finalized (what to shoot), creative shoot plan (how to shoot), product samples (what to shoot with).',
  },
  {
    name: 'Product Shoot',
    leadTime: 5,
    dependsOn: [
      'Finalize Asset Requests',
      'Finalize Creative Shoot Plan',
      'Samples Available',
      'Packaging Samples Ready',
    ],
    owner: 'creative',
    phase: 'content_production',
    notes: 'Week-long scheduling window. Can run in parallel with or right after Lifestyle Shoot.',
  },
  {
    name: 'Photo Selects Ready',
    leadTime: 10,
    dependsOn: ['Lifestyle Shoot', 'Product Shoot'],
    owner: 'creative',
    phase: 'content_production',
    notes: '~2 weeks for photo selects/retouching from both shoots. These feed into R1 Assets.',
  },

  // ── Creator Track ─────────────────────────────────────────────────
  {
    name: 'Start Sourcing Creators',
    leadTime: 15,
    dependsOn: ['Finalize Social Strategy'],
    owner: 'influencer',
    phase: 'content_production',
    notes: 'Sourcing begins after social strategy is set.',
  },
  {
    name: 'Creator Review Meeting',
    leadTime: 3,
    dependsOn: ['Start Sourcing Creators'],
    owner: 'influencer',
    phase: 'content_production',
    isMeeting: true,
    meetingChecklist: [
      'Review shortlisted creators & their content samples',
      'Confirm creator tiers & budget allocation',
      'Align on content deliverables per creator',
      'Set timelines for briefs & content delivery',
    ],
  },
  {
    name: 'Briefs to Creators',
    leadTime: 5,
    dependsOn: ['Creator Review Meeting', 'Samples Available'],
    owner: 'influencer',
    phase: 'content_production',
    notes: 'Needs BOTH: creator list confirmed (from review meeting) AND product samples ready (to send with briefs).',
  },
  {
    name: 'Creator Content Delivered',
    leadTime: 15,
    dependsOn: ['Briefs to Creators'],
    owner: 'influencer',
    phase: 'content_production',
    dueDateOffset: -10,
    notes: 'Anchored to 2 weeks (10 BD) before launch. Entire creator track works backward from this anchor.',
  },

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 4: DESIGN PRODUCTION
  // ═══════════════════════════════════════════════════════════════════

  // ── Draft Briefs (3 parallel briefs before alignment meeting) ─────
  {
    name: 'Draft Email Briefs',
    leadTime: 3,
    dependsOn: ['Finalize Email Plan'],
    owner: 'marketing',
    phase: 'design_production',
    notes: 'Email campaign briefs based on finalized email plan from Growth.',
  },
  {
    name: 'Draft PDP Gallery Asset Briefs',
    leadTime: 3,
    dependsOn: ['Final Taglines & Campaign Copy Due'],
    owner: 'marketing',
    phase: 'design_production',
    notes: 'PDP gallery image & asset briefs based on final approved taglines/copy.',
  },
  {
    name: 'Draft Social Creative Briefs',
    leadTime: 3,
    dependsOn: ['Finalize Social Strategy'],
    owner: 'social',
    phase: 'design_production',
    notes: 'Social creative direction briefs based on finalized social strategy.',
  },

  // ── Homepage Asset Briefs ──────────────────────────────────────────
  {
    name: 'Draft Homepage Asset Briefs',
    leadTime: 3,
    dependsOn: ['Final Taglines & Campaign Copy Due'],
    owner: 'marketing',
    phase: 'design_production',
    notes: 'Homepage hero, module, and banner asset briefs based on final copy.',
  },

  // ── Brief Alignment & Asset Production ────────────────────────────
  {
    name: 'Brief Alignment Meeting',
    leadTime: 3,
    dependsOn: [
      'Draft Email Briefs',
      'Draft PDP Gallery Asset Briefs',
      'Draft Social Creative Briefs',
      'Draft Homepage Asset Briefs',
    ],
    owner: 'marketing',
    phase: 'design_production',
    isMeeting: true,
    meetingChecklist: [
      'Review all draft briefs (email, PDP, social, homepage, Amazon A+)',
      'Align on creative direction across channels',
      'Align on homepage placement & hero asset direction',
      'Confirm asset specs & dimensions per channel',
      'Review timeline for R1 assets & feedback rounds',
      'Assign final brief owners & deadlines',
    ],
    notes: 'Requires ALL 4 draft briefs (email, PDP, social, homepage) to be complete before meeting can be scheduled.',
  },
  {
    name: 'Asset Design Briefs Due',
    leadTime: 5,
    dependsOn: ['Brief Alignment Meeting'],
    owner: 'marketing',
    phase: 'design_production',
    notes: 'Finalized design briefs incorporating alignment meeting feedback.',
    meetingChecklist: [
      'Email asset briefs',
      'Social asset briefs',
      'PDP gallery asset briefs',
      'Amazon A+ asset briefs',
      'Homepage asset briefs',
    ],
  },
  {
    name: 'R1 Assets Due (Email, Social, PDP, Homepage, Amazon A+)',
    leadTime: 10,
    dependsOn: ['Asset Design Briefs Due', 'Photo Selects Ready'],
    owner: 'creative',
    phase: 'design_production',
    notes: 'First round of all design assets. Requires BOTH: finalized briefs AND photo selects from shoots. ~2 weeks for creative to produce.',
    meetingChecklist: [
      'Email assets',
      'Social assets',
      'PDP gallery assets',
      'Amazon A+ content assets',
      'Homepage hero & module assets',
    ],
  },
  {
    name: 'Asset Feedback Due',
    leadTime: 3,
    dependsOn: ['R1 Assets Due (Email, Social, PDP, Homepage, Amazon A+)'],
    owner: 'marketing',
    phase: 'design_production',
  },
  {
    name: 'Sephora Final Assets Due',
    leadTime: 5,
    dependsOn: ['Asset Feedback Due'],
    owner: 'creative',
    phase: 'design_production',
    channelAnchor: 'sephora',
  },
  {
    name: 'DTC & Amazon Final Assets Due',
    leadTime: 5,
    dependsOn: ['Asset Feedback Due'],
    owner: 'creative',
    phase: 'design_production',
  },
  {
    name: 'Draft Sephora Catalog & PDP Copy Due',
    leadTime: 5,
    dependsOn: ['DTC & Amazon Final Assets Due'],
    owner: 'marketing',
    phase: 'design_production',
  },
  {
    name: 'Final DTC PDP Copy & Reviews Due',
    leadTime: 3,
    dependsOn: ['Draft Sephora Catalog & PDP Copy Due'],
    owner: 'marketing',
    phase: 'design_production',
  },

  // ── Optional Planning Tasks ───────────────────────────────────────
  {
    name: 'Set Up Event Planning Meeting',
    leadTime: 10,
    dependsOn: [],
    owner: 'marketing',
    phase: 'content_planning',
    isOptional: true,
    notes: 'Giving 2 weeks to plan launch event. Anchored to Launch Event date.',
  },
  {
    name: 'Set Up OOH Planning',
    leadTime: 10,
    dependsOn: [],
    owner: 'marketing',
    phase: 'content_planning',
    isOptional: true,
    notes: 'Giving 2 weeks to plan OOH campaign. Anchored to OOH Campaign date.',
  },

  // ── Manual-Date Tasks ─────────────────────────────────────────────
  {
    name: 'Social Campaign',
    leadTime: 0,
    dependsOn: ['Finalize Asset Requests'],
    owner: 'social',
    phase: 'design_production',
    isManualDate: true,
    notes: 'Date range added manually once campaign dates are finalized',
  },
  {
    name: 'Launch Event',
    leadTime: 0,
    dependsOn: [],
    owner: 'marketing',
    phase: 'design_production',
    isManualDate: true,
    notes: 'Date added manually when event is confirmed',
  },
  {
    name: 'OOH Campaign',
    leadTime: 0,
    dependsOn: [],
    owner: 'marketing',
    phase: 'design_production',
    isManualDate: true,
    notes: 'Date added manually when OOH is confirmed',
  },

  // ── Launch Completion ─────────────────────────────────────────────
  {
    name: 'Confirm Launch Complete',
    leadTime: 0,
    dependsOn: ['Launch!'],
    owner: 'marketing',
    phase: 'design_production',
    isMeeting: false,
    notes: 'Confirm all channels are live and launch is complete.',
  },
];

/**
 * Map template owners back to app Owner type.
 * New template roles (copywriter, growth, leadership) get mapped to closest existing owner.
 */
export function toAppOwner(templateOwner: TemplateOwner): Owner {
  switch (templateOwner) {
    case 'copywriter': return 'external';
    case 'growth': return 'product';
    case 'leadership': return 'marketing';
    default: return templateOwner as Owner;
  }
}

/**
 * Friendly labels for template-only owners (for spreadsheet / preview display).
 */
export const TEMPLATE_OWNER_LABELS: Record<TemplateOwner, string> = {
  marketing: 'Marketing',
  channel_leads: 'Channel Leads',
  creative: 'Creative',
  product: 'Product',
  retail: 'Retail',
  influencer: 'Influencer',
  social: 'Social',
  pr: 'PR',
  digital: 'Digital',
  ops: 'Operations',
  external: 'External Partner',
  copywriter: 'Copywriter',
  growth: 'Growth',
  leadership: 'Leadership',
};
