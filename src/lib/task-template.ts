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
 *
 * DEPENDENCY FLOW OVERVIEW:
 *   Phase 0: RSP → RSP Finalization (pre-planning, NPD-dependent)
 *   Phase 1: Product Sheet → Positioning → GTM Brainstorm
 *            → [6 cross-functional alignment tracks in parallel]
 *            → Finalize strategies (social, influencer, email)
 *            → Finalize 360 GTM Plan (after ALL alignment + strategies + taglines)
 *   Phase 2: Final GTM Deck
 *   Phase 3: Shoot & Content Capture → Shoots → Photo Selects
 *            Creator sourcing → Creator content (needs finished goods)
 *   Phase 4: 9 design briefs (product + bundle) → Brief Alignment Meeting
 *            → Final briefs → R1 Assets → Feedback
 *            → Sephora track (50 BD retail lead) | D2C track (15 BD asset / 10 BD copy lead)
 *   Phase 5: Social campaign → D2C Launch → Sephora Launch (+4 weeks default)
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
  isMeeting?: boolean;
  meetingChecklist?: string[];
  isOptional?: boolean;         // only included if user enables it
  isManualDate?: boolean;       // date set manually, not auto-scheduled
  channelAnchor?: 'sephora';   // anchors to Sephora launch date instead of DTC
  pinnedToLaunchDate?: boolean; // always set due date to the launch date (DTC or Sephora)
  sephoraLeadTime?: number;     // BD before Sephora launch this must be done (e.g., 50)
  d2cAssetLeadTime?: number;    // BD before D2C launch for asset deadline
  d2cCopyLeadTime?: number;     // BD before D2C launch for copy deadline
  dueDateOffset?: number;       // extra BD offset subtracted from computed due
  notes?: string;
  deliverableUrl?: string;      // permanent link to the deliverable template/form
}

/**
 * Master task template — ordered by execution flow.
 *
 * DEPENDENCY RULE: when a task has multiple dependsOn entries,
 * it can only START after ALL of them are complete. The scheduler
 * uses the LATEST dependency due date as the starting point.
 */
export const LAUNCH_TASK_TEMPLATE: TaskTemplate[] = [

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 0: PRE-PLANNING (NPD-dependent, timing works backward)
  // ═══════════════════════════════════════════════════════════════════

  {
    name: 'RSP Finalization',
    leadTime: 3,
    dependsOn: [],
    owner: 'growth',
    phase: 'pre_planning',
    notes: 'Requires final COGS from Operations. Timing backward from when Finalize Bundle Assortment needs it.',
  },

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 1: CONTENT PLANNING
  // ═══════════════════════════════════════════════════════════════════

  {
    name: 'Product Sheet & Competitive Landscape',
    leadTime: 3,
    dependsOn: [],
    owner: 'marketing',
    phase: 'content_planning',
    notes: 'First task — start date computed backward from launch date.',
  },
  {
    name: 'Draft Product Positioning & Messaging',
    leadTime: 3,
    dependsOn: ['Product Sheet & Competitive Landscape'],
    owner: 'marketing',
    phase: 'content_planning',
  },
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
    notes: 'Align on: positioning, marketing pillars, creative concepts, bundle assortment, retail channel presence.',
  },

  // ── Brainstorm Outputs (parallel tracks) ──
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
    dependsOn: ['GTM Brainstorm Meeting', 'RSP Finalization'],
    owner: 'growth',
    phase: 'content_planning',
  },

  // ── Copy Track ──
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
    leadTime: 10,
    dependsOn: ['R1 Taglines & Copy Due'],
    owner: 'copywriter',
    phase: 'content_planning',
    notes: 'Includes back-and-forth iterations with copywriter.',
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
  // PHASE 1b: CROSS-FUNCTIONAL ALIGNMENT
  // All happen in parallel after brainstorm + positioning, all same duration (3 BD)
  // ═══════════════════════════════════════════════════════════════════

  {
    name: 'Align on Paid Influencer Strategy',
    leadTime: 3,
    dependsOn: ['GTM Brainstorm Meeting', 'Finalize Product Positioning & Messaging'],
    owner: 'influencer',
    phase: 'cross_functional',
    notes: 'Must align before brief drafting begins.',
  },
  {
    name: 'Align on Social Strategy',
    leadTime: 3,
    dependsOn: ['GTM Brainstorm Meeting', 'Finalize Product Positioning & Messaging'],
    owner: 'social',
    phase: 'cross_functional',
    notes: 'Must align before brief drafting begins.',
  },
  {
    name: 'Align on Paid Ads Strategy',
    leadTime: 3,
    dependsOn: ['GTM Brainstorm Meeting', 'Finalize Product Positioning & Messaging'],
    owner: 'growth',
    phase: 'cross_functional',
    notes: 'Must align before brief drafting begins.',
  },
  {
    name: 'Align on Email Plan',
    leadTime: 3,
    dependsOn: ['GTM Brainstorm Meeting', 'Finalize Product Positioning & Messaging'],
    owner: 'growth',
    phase: 'cross_functional',
    notes: 'Must align before brief drafting begins.',
  },
  {
    name: 'Align on Homepage Plan',
    leadTime: 3,
    dependsOn: ['GTM Brainstorm Meeting', 'Finalize Product Positioning & Messaging'],
    owner: 'growth',
    support: 'creative',
    phase: 'cross_functional',
    notes: 'Must align before brief drafting begins.',
  },
  {
    name: 'Align on Early Access Decision',
    leadTime: 3,
    dependsOn: ['GTM Brainstorm Meeting', 'Finalize Product Positioning & Messaging'],
    owner: 'growth',
    phase: 'cross_functional',
    notes: 'Decide if launch includes early access window.',
  },

  // ═══════════════════════════════════════════════════════════════════
  // FINALIZE STRATEGIES (after alignment)
  // ═══════════════════════════════════════════════════════════════════

  {
    name: 'Finalize Email Strategy',
    leadTime: 3,
    dependsOn: ['Align on Email Plan'],
    owner: 'growth',
    phase: 'finalize_strategies',
    notes: 'After email plan alignment is complete.',
  },
  {
    name: 'Finalize Social Strategy',
    leadTime: 5,
    dependsOn: ['Align on Social Strategy'],
    owner: 'social',
    phase: 'finalize_strategies',
  },
  {
    name: 'Finalize Influencer Strategy & Start Sourcing Creators',
    leadTime: 15,
    dependsOn: ['Align on Paid Influencer Strategy'],
    owner: 'influencer',
    phase: 'finalize_strategies',
    notes: 'Finalize strategy and begin sourcing creators ahead of creator review meeting.',
  },

  // ── Finalize 360 GTM Plan (after ALL alignment + strategies + taglines) ──
  {
    name: 'Finalize 360 GTM Plan & Retail Channels',
    leadTime: 3,
    dependsOn: [
      'Finalize Product Positioning & Messaging',
      'Finalize Creative Shoot Plan',
      'Finalize Bundle Assortment',
      'Finalize Email Strategy',
      'Finalize Social Strategy',
      'Finalize Influencer Strategy & Start Sourcing Creators',
      'Final Taglines & Campaign Copy Due',
      'Align on Paid Ads Strategy',
      'Align on Homepage Plan',
      'Align on Early Access Decision',
    ],
    owner: 'leadership',
    phase: 'finalize_strategies',
    notes: 'Requires ALL alignment outcomes, finalized strategies, and final taglines.',
  },

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2: FINALIZE & INFORM MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════

  {
    name: 'Final GTM Deck',
    leadTime: 3,
    dependsOn: ['Finalize 360 GTM Plan & Retail Channels'],
    owner: 'marketing',
    support: 'cross-functional',
    phase: 'finalize_mgmt',
    notes: '360 plan captures all inputs; this is the presentation deck.',
  },

  // ═══════════════════════════════════════════════════════════════════
  // PACKAGING MILESTONE (tracked separately; samples must arrive before shoots)
  // ═══════════════════════════════════════════════════════════════════

  {
    name: 'Packaging Samples for Photoshoot Due',
    leadTime: 0,
    dependsOn: [],
    owner: 'ops',
    phase: 'content_production',
    notes: 'Packaging samples must be ready before shoots. Due date works backward from shoot dates. Packaging development tracked separately.',
  },

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 3: CONTENT PRODUCTION
  // ═══════════════════════════════════════════════════════════════════

  // ── Shoot & Content Capture Track ──
  {
    name: 'Draft Shoot & Content Capture Plan',
    leadTime: 3,
    dependsOn: ['GTM Brainstorm Meeting'],
    owner: 'marketing',
    support: 'creative',
    phase: 'content_production',
    notes: 'What content to capture in shoots (not finished creative assets).',
    deliverableUrl: 'https://netorgft3648903.sharepoint.com/:x:/r/sites/EveredenGlobal/_layouts/15/Doc.aspx?sourcedoc=%7B8E824468-31FA-4050-9E86-D6DED103C9C5%7D&file=2026%20Asset%20Form%20.xlsx&action=default&mobileredirect=true',
  },
  {
    name: 'Finalize Shoot & Content Capture Plan',
    leadTime: 5,
    dependsOn: [
      'Draft Shoot & Content Capture Plan',
      'Finalize Product Positioning & Messaging',
    ],
    owner: 'marketing',
    support: 'creative',
    phase: 'content_production',
    notes: 'Requires positioning to be finalized. Determines what gets shot.',
    deliverableUrl: 'https://netorgft3648903.sharepoint.com/:x:/r/sites/EveredenGlobal/_layouts/15/Doc.aspx?sourcedoc=%7B8E824468-31FA-4050-9E86-D6DED103C9C5%7D&file=2026%20Asset%20Form%20.xlsx&action=default&mobileredirect=true',
  },

  // ── Photography Track ──
  {
    name: 'Finished Good Marketing Units Available',
    leadTime: 10,
    dependsOn: [],
    owner: 'ops',
    phase: 'content_production',
    notes: 'Must be available before creator content & seeding. NOT required for photoshoots (those need packaging samples). Due date auto-computed backward from creator content dates.',
  },
  {
    name: 'Lifestyle Shoot',
    leadTime: 5,
    dependsOn: [
      'Finalize Shoot & Content Capture Plan',
      'Finalize Creative Shoot Plan',
      'Packaging Samples for Photoshoot Due',
    ],
    owner: 'creative',
    phase: 'content_production',
    notes: '1-week scheduling window. Needs packaging samples, NOT finished goods. If date changed manually, downstream dates shift.',
  },
  {
    name: 'Product Shoot',
    leadTime: 5,
    dependsOn: [
      'Finalize Shoot & Content Capture Plan',
      'Finalize Creative Shoot Plan',
      'Packaging Samples for Photoshoot Due',
    ],
    owner: 'creative',
    phase: 'content_production',
    notes: '1-week scheduling window. Can run parallel with Lifestyle Shoot. Needs packaging samples.',
  },
  {
    name: 'Lifestyle Photo Selects Ready',
    leadTime: 10,
    dependsOn: ['Lifestyle Shoot'],
    owner: 'creative',
    phase: 'content_production',
    notes: '~2 weeks for photo selects/retouching from lifestyle shoot. Feeds into R1 Assets.',
  },
  {
    name: 'Product Photo Selects Ready',
    leadTime: 10,
    dependsOn: ['Product Shoot'],
    owner: 'creative',
    phase: 'content_production',
    notes: '~2 weeks for photo selects/retouching from product shoot. Feeds into R1 Assets.',
  },

  // ── Creator Track ──
  {
    name: 'Creator Review Meeting',
    leadTime: 3,
    dependsOn: ['Finalize Influencer Strategy & Start Sourcing Creators'],
    owner: 'influencer',
    phase: 'content_production',
    isMeeting: true,
    meetingChecklist: [
      'Review shortlisted creators & content samples',
      'Confirm creator tiers & budget allocation',
      'Align on content deliverables per creator',
      'Set timelines for briefs & content delivery',
    ],
  },
  {
    name: 'Briefs to Creators',
    leadTime: 5,
    dependsOn: ['Creator Review Meeting', 'Finished Good Marketing Units Available'],
    owner: 'influencer',
    phase: 'content_production',
    notes: 'Needs BOTH: confirmed creator list AND finished good marketing units ready to send.',
  },
  {
    name: 'Creator Content Delivered',
    leadTime: 15,
    dependsOn: ['Briefs to Creators'],
    owner: 'influencer',
    phase: 'content_production',
    notes: 'Must be delivered ~1 week (5 BD) before D2C launch.',
  },

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 4a: DESIGN BRIEFS — PRODUCT
  // Each is a separate deliverable with its own link
  // ═══════════════════════════════════════════════════════════════════

  {
    name: 'Draft PDP Gallery Asset Brief',
    leadTime: 5,
    dependsOn: [
      'Final Taglines & Campaign Copy Due',
      'Finalize 360 GTM Plan & Retail Channels',
      'Finalize Bundle Assortment',
    ],
    owner: 'marketing',
    phase: 'design_briefs',
    notes: 'Product PDP gallery images.',
  },
  {
    name: 'Draft Sephora/Amazon Gallery Asset Brief',
    leadTime: 5,
    dependsOn: [
      'Final Taglines & Campaign Copy Due',
      'Finalize 360 GTM Plan & Retail Channels',
      'Finalize Bundle Assortment',
    ],
    owner: 'marketing',
    phase: 'design_briefs',
    notes: 'If different/additional from DTC PDP assets.',
  },
  {
    name: 'Draft Amazon A+ Content Brief',
    leadTime: 5,
    dependsOn: [
      'Final Taglines & Campaign Copy Due',
      'Finalize 360 GTM Plan & Retail Channels',
    ],
    owner: 'marketing',
    phase: 'design_briefs',
  },
  {
    name: 'Draft Email Brief',
    leadTime: 3,
    dependsOn: ['Finalize Email Strategy', 'Align on Email Plan'],
    owner: 'marketing',
    phase: 'design_briefs',
    notes: 'Email campaign briefs based on finalized email plan.',
  },
  {
    name: 'Draft Social Creative Brief',
    leadTime: 4,
    dependsOn: ['Finalize Social Strategy', 'Align on Social Strategy'],
    owner: 'social',
    phase: 'design_briefs',
    notes: 'Social creative direction briefs.',
  },
  {
    name: 'Draft Homepage Asset Brief',
    leadTime: 3,
    dependsOn: [
      'Final Taglines & Campaign Copy Due',
      'Align on Homepage Plan',
      'Finalize 360 GTM Plan & Retail Channels',
    ],
    owner: 'marketing',
    phase: 'design_briefs',
    notes: 'Homepage hero, module, and banner asset briefs.',
  },

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 4b: DESIGN BRIEFS — BUNDLE
  // ═══════════════════════════════════════════════════════════════════

  {
    name: 'Draft Bundle PDP Copy Brief',
    leadTime: 3,
    dependsOn: ['Final Taglines & Campaign Copy Due', 'Finalize Bundle Assortment', 'Finalize 360 GTM Plan & Retail Channels'],
    owner: 'marketing',
    phase: 'design_briefs',
  },
  {
    name: 'Draft Bundle PDP Gallery Asset Brief',
    leadTime: 5,
    dependsOn: ['Final Taglines & Campaign Copy Due', 'Finalize Bundle Assortment', 'Finalize 360 GTM Plan & Retail Channels'],
    owner: 'marketing',
    phase: 'design_briefs',
    notes: 'If any new assets needed for bundle.',
  },
  {
    name: 'Draft Bundle Sephora/Amazon Gallery Asset Brief',
    leadTime: 5,
    dependsOn: ['Final Taglines & Campaign Copy Due', 'Finalize Bundle Assortment', 'Finalize 360 GTM Plan & Retail Channels'],
    owner: 'marketing',
    phase: 'design_briefs',
    notes: 'If different/additional from DTC.',
  },

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 4c: BRIEF ALIGNMENT & ASSET PRODUCTION
  // ═══════════════════════════════════════════════════════════════════

  {
    name: 'Brief Alignment Meeting',
    leadTime: 3,
    dependsOn: [
      'Final GTM Deck',
      'Draft PDP Gallery Asset Brief',
      'Draft Sephora/Amazon Gallery Asset Brief',
      'Draft Amazon A+ Content Brief',
      'Draft Email Brief',
      'Draft Social Creative Brief',
      'Draft Homepage Asset Brief',
      'Draft Bundle PDP Copy Brief',
      'Draft Bundle PDP Gallery Asset Brief',
      'Draft Bundle Sephora/Amazon Gallery Asset Brief',
      'Align on Paid Influencer Strategy',
      'Align on Social Strategy',
      'Align on Paid Ads Strategy',
      'Align on Email Plan',
      'Align on Homepage Plan',
      'Align on Early Access Decision',
    ],
    owner: 'marketing',
    phase: 'design_production',
    isMeeting: true,
    meetingChecklist: [
      'Review ALL draft briefs (product + bundle)',
      'Align on creative direction across channels',
      'Confirm asset specs & dimensions per channel',
      'Review timeline for R1 assets & feedback rounds',
      'Assign final brief owners & deadlines',
    ],
    notes: 'ALL draft briefs (product + bundle), ALL cross-functional alignments, and Final GTM Deck must be complete.',
  },
  {
    name: 'Final Asset Design Briefs Due',
    leadTime: 2,
    dependsOn: ['Brief Alignment Meeting'],
    owner: 'marketing',
    phase: 'design_production',
    notes: 'Finalized design briefs incorporating alignment meeting feedback.',
  },
  {
    name: 'Draft PDP Copy Brief',
    leadTime: 3,
    dependsOn: ['Brief Alignment Meeting'],
    owner: 'marketing',
    phase: 'design_production',
    notes: 'Drafted AFTER brief alignment meeting. Requires 2-3 BD for legal review before finalization.',
  },

  // ── Asset Production Pipeline ──
  {
    name: 'R1 Assets Due (Email, Social, PDP, Homepage, Amazon A+)',
    leadTime: 10,
    dependsOn: ['Final Asset Design Briefs Due', 'Lifestyle Photo Selects Ready', 'Product Photo Selects Ready'],
    owner: 'creative',
    phase: 'design_production',
    notes: 'First round of all design assets. Requires BOTH: finalized briefs AND photo selects. ~2 weeks for creative.',
  },
  {
    name: 'Asset Feedback Due',
    leadTime: 3,
    dependsOn: ['R1 Assets Due (Email, Social, PDP, Homepage, Amazon A+)'],
    owner: 'marketing',
    phase: 'design_production',
  },

  // ── SEPHORA TRACK ──
  // Work tasks (dates computed from dependencies)
  {
    name: 'Sephora Final Assets Ready',
    leadTime: 5,
    dependsOn: ['Asset Feedback Due'],
    owner: 'creative',
    phase: 'design_production',
    channelAnchor: 'sephora',
    notes: 'Finalized Sephora assets after feedback round.',
  },
  {
    name: 'Draft Sephora Catalog & PDP Copy Ready',
    leadTime: 3,
    dependsOn: ['Brief Alignment Meeting'],
    owner: 'marketing',
    phase: 'design_production',
    channelAnchor: 'sephora',
    notes: 'Drafted after brief alignment meeting.',
  },
  {
    name: 'Sephora Catalog & PDP Copy Review',
    leadTime: 3,
    dependsOn: ['Draft Sephora Catalog & PDP Copy Ready'],
    owner: 'marketing',
    phase: 'design_production',
    channelAnchor: 'sephora',
    notes: 'Internal review before finalization.',
  },
  {
    name: 'Final Sephora Catalog & PDP Copy',
    leadTime: 3,
    dependsOn: ['Sephora Catalog & PDP Copy Review'],
    owner: 'marketing',
    phase: 'design_production',
    channelAnchor: 'sephora',
    notes: 'Incorporate review feedback, finalize copy for Sephora submission.',
  },

  // Sephora submission deadlines (pinned to 10 weeks before Sephora launch)
  {
    name: 'Sephora Final Assets Due',
    leadTime: 0,
    dependsOn: [],
    owner: 'retail',
    phase: 'design_production',
    channelAnchor: 'sephora',
    sephoraLeadTime: 50,
    notes: 'Submission deadline: 10 weeks (50 BD) before Sephora launch date.',
  },
  {
    name: 'Sephora Catalog & PDP Copy Due',
    leadTime: 0,
    dependsOn: [],
    owner: 'retail',
    phase: 'design_production',
    channelAnchor: 'sephora',
    sephoraLeadTime: 50,
    notes: 'Submission deadline: 10 weeks (50 BD) before Sephora launch date.',
  },

  // ── D2C / AMAZON TRACK ──
  {
    name: 'DTC & Amazon Final Assets Due',
    leadTime: 5,
    dependsOn: ['Asset Feedback Due'],
    owner: 'creative',
    phase: 'design_production',
    d2cAssetLeadTime: 15,
    notes: 'DTC & Amazon final assets due 3 weeks (15 BD) before D2C launch date.',
  },
  {
    name: 'Final DTC PDP Copy & Reviews Due',
    leadTime: 5,
    dependsOn: ['Draft PDP Copy Brief'],
    owner: 'marketing',
    phase: 'design_production',
    d2cCopyLeadTime: 10,
    notes: 'Legal review (2-3 BD) + cross-functional internal review. Due 2 weeks (10 BD) before D2C launch.',
  },

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 5: LAUNCH
  // ═══════════════════════════════════════════════════════════════════

  // ── Optional Planning Tasks ──
  {
    name: 'Set Up Event Planning Meeting',
    leadTime: 10,
    dependsOn: [],
    owner: 'marketing',
    phase: 'launch',
    isOptional: true,
    notes: '2 weeks to plan launch event. Anchored to Launch Event date.',
  },
  {
    name: 'Set Up OOH Planning',
    leadTime: 10,
    dependsOn: [],
    owner: 'marketing',
    phase: 'launch',
    isOptional: true,
    notes: '2 weeks to plan OOH. Anchored to launch date.',
  },

  // ── Launch Milestones ──
  {
    name: 'Social Campaign Start',
    leadTime: 10,
    dependsOn: ['DTC & Amazon Final Assets Due'],
    owner: 'social',
    phase: 'launch',
    pinnedToLaunchDate: true,
    notes: 'Starts ~2 weeks before D2C launch. Needs final DTC/Amazon assets.',
  },
  {
    name: 'Launch Event',
    leadTime: 0,
    dependsOn: [],
    owner: 'marketing',
    phase: 'launch',
    isManualDate: true,
    isOptional: true,
    notes: 'Date added manually when event is confirmed.',
  },
  {
    name: 'OOH Campaign',
    leadTime: 0,
    dependsOn: [],
    owner: 'marketing',
    phase: 'launch',
    isManualDate: true,
    isOptional: true,
    notes: 'Date added manually when OOH is confirmed.',
  },
  {
    name: 'D2C Launch Complete',
    leadTime: 0,
    dependsOn: ['DTC & Amazon Final Assets Due', 'Final DTC PDP Copy & Reviews Due', 'Creator Content Delivered', 'Social Campaign Start'],
    owner: 'marketing',
    phase: 'launch',
    pinnedToLaunchDate: true,
    notes: 'Confirm all D2C channels are live.',
  },
  {
    name: 'Sephora Launch Complete',
    leadTime: 0,
    dependsOn: ['Sephora Final Assets Due', 'Sephora Catalog & PDP Copy Due'],
    owner: 'marketing',
    phase: 'launch',
    channelAnchor: 'sephora',
    pinnedToLaunchDate: true,
    notes: 'Confirm Sephora is live.',
  },
];

/**
 * Map template owners back to app Owner type.
 */
export function toAppOwner(templateOwner: TemplateOwner): Owner {
  switch (templateOwner) {
    case 'copywriter': return 'external';
    case 'growth': return 'product';
    case 'leadership': return 'marketing';
    default: return templateOwner as Owner;
  }
}
