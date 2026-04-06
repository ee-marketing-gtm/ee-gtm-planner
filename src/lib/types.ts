export type LaunchType = 'new_product' | 'product_extension' | 'campaign' | 'seasonal' | 'collaboration';
export type LaunchTier = 'A' | 'B' | 'C';
export type ContentProductionType = 'none' | 'no_tech' | 'with_tech' | 'landing_page';
export type TaskStatus = 'not_started' | 'in_progress' | 'complete' | 'blocked' | 'skipped' | 'waiting_review';
export type PhaseKey = 'content_planning' | 'finalize_mgmt' | 'content_production' | 'design_production' | 'packaging';
export type Owner = 'marketing' | 'channel_leads' | 'creative' | 'product' | 'retail' | 'influencer' | 'pr' | 'digital' | 'ops' | 'social' | 'external';

export interface GTMTask {
  id: string;
  name: string;
  phase: PhaseKey;
  owner: Owner;
  durationDays: number;
  startDate: string | null;
  dueDate: string | null;
  completedDate: string | null;
  status: TaskStatus;
  notes: string;
  dependencies: string[]; // task IDs
  dependencyNames?: string[]; // human-readable task names (from scheduler)
  sortOrder: number;
  deliverableUrl?: string;
  deliverableLabel?: string;
  isMeeting?: boolean;
  isCompressed?: boolean;
  compressionDays?: number;
  approvalStatus?: 'draft' | 'submitted' | 'approved' | 'revision_needed';
  submittedDate?: string | null;
  approvedDate?: string | null;
  meetingChecklist?: string[];
}

// Tasks that typically produce deliverables
export const DELIVERABLE_TASKS: Record<string, string> = {
  'Product Sheet & Competitive Landscape': 'Product Sheet',
  'Marketing Positioning': 'Positioning Doc',
  'Tagline/Copy Brief': 'Copy Brief',
  'Asset Request Form': 'Asset Request Form',
  'Draft GTM Deck': 'GTM Deck Draft',
  '1st Draft Marketing Deck': 'Marketing Deck Draft',
  'Final GTM Deck': 'Final GTM Deck',
  'Final Marketing Launch Deck': 'Final Marketing Deck',
  'Asset Request Form Approval / AD Start': 'Approved Asset Request',
  'Asset Design Briefs Due': 'Design Briefs',
  'R1 Assets Due (Email, Social, PDP, Homepage, Amazon A+)': 'R1 Assets Folder',
  'Sephora Final Assets Due': 'Sephora Assets',
  'DTC Final Assets Due': 'DTC Assets',
  'Sephora Catalog & PDP Copy Due': 'Sephora PDP Copy',
  'DTC PDP Copy & Reviews Due': 'DTC PDP Copy',
  'Briefs to Creators': 'Creator Briefs',
  'Social Campaign Brief': 'Social Brief',
};

// Lead time in business days for each task type (used for smart alerts)
export const TASK_LEAD_TIMES: Record<string, number> = {
  'Product Sheet & Competitive Landscape': 5,
  'Marketing Positioning': 5,
  'Draft GTM Deck': 5,
  'GTM Deck Review Meeting': 1,
  'Tagline/Copy Brief': 5,
  'R1 Taglines': 5,
  'Final Taglines': 15,
  'Brainstorm Meeting': 1,
  'Brainstorm Concepts Approved': 3,
  'Asset Request Form': 2,
  'Final GTM Deck': 3,
  'Asset Request Form Approval / AD Start': 2,
  'Photo Sample Ready': 5,
  'Lifestyle Shoot': 3,
  'Product Shoot': 2,
  'Start Sourcing Creators': 10,
  'Creator Review Meeting': 1,
  'Briefs to Creators': 3,
  'Creator Content Delivered': 15,
  'Brief Alignment Meeting': 1,
  'Asset Design Briefs Due': 5,
  'R1 Assets Due (Email, Social, PDP)': 10,
  'Asset Feedback Due': 3,
  'Sephora Final Assets Due': 5,
  'DTC Final Assets Due': 5,
  'Sephora Catalog & PDP Copy Due': 5,
  'DTC PDP Copy & Reviews Due': 3,
  'Social Campaign Brief': 3,
  'Samples Available': 5,
};

export interface Phase {
  key: PhaseKey;
  name: string;
  color: string;
}

export interface LaunchStrategy {
  targetAudience: string;
  keyInsight: string;
  positioning: string;
  keyMessages: string[];
  proofPoints: string[];
  competitiveDifferentiation: string;
  toneOfVoice: string;
}

export interface ChannelPlan {
  channel: string;
  tactic: string;
  timing: string;
  budget: number | null;
  kpiTarget: string;
  status: TaskStatus;
  owner: Owner;
  notes: string;
}

export interface MarketingPlan360 {
  objectives: string[];
  keyMetrics: { metric: string; target: string; }[];
  paidMedia: ChannelPlan[];
  influencer: ChannelPlan[];
  owned: ChannelPlan[];
  retail: ChannelPlan[];
  pr: ChannelPlan[];
  events: ChannelPlan[];
  totalBudget: number | null;
}

export interface ExternalAnchorConfig {
  taskName: string;
  date: string;
  partnerName: string;
}

export interface Launch {
  id: string;
  name: string;
  launchDate: string; // DTC launch date (primary)
  sephoraLaunchDate?: string; // Sephora launch date if different
  amazonLaunchDate?: string; // Amazon launch date if different
  launchType: LaunchType;
  tier: LaunchTier;
  contentProductionType: ContentProductionType;
  status: 'planning' | 'in_progress' | 'launched' | 'post_launch' | 'archived';
  productCategory: string;
  productImageUrl?: string; // URL to product image
  brandColor?: string; // Custom brand color (hex), falls back to tier color
  description: string;
  tasks: GTMTask[];
  externalAnchors?: ExternalAnchorConfig[];
  strategy: LaunchStrategy;
  marketingPlan: MarketingPlan360;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const PHASES: Phase[] = [
  { key: 'content_planning', name: 'Content Planning', color: '#6366F1' },
  { key: 'finalize_mgmt', name: 'Finalize & Inform Mgmt', color: '#F59E0B' },
  { key: 'content_production', name: 'Content Production', color: '#10B981' },
  { key: 'design_production', name: 'Design Production', color: '#EC4899' },
  { key: 'packaging', name: 'Packaging Development', color: '#7C3AED' },
];

export const OWNER_LABELS: Record<Owner, string> = {
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
};

export const OWNER_COLORS: Record<Owner, string> = {
  marketing: '#6366F1',
  channel_leads: '#F59E0B',
  creative: '#EC4899',
  product: '#8B5CF6',
  retail: '#14B8A6',
  influencer: '#F97316',
  social: '#0EA5E9',
  pr: '#06B6D4',
  digital: '#3B82F6',
  ops: '#64748B',
  external: '#A855F7',
};

export const LAUNCH_TYPE_LABELS: Record<LaunchType, string> = {
  new_product: 'New Product Launch',
  product_extension: 'Product Extension',
  campaign: 'Campaign / Moment',
  seasonal: 'Seasonal',
  collaboration: 'Collaboration',
};

export const TIER_CONFIG: Record<LaunchTier, { label: string; color: string; description: string }> = {
  A: { label: 'Tier A — Tentpole', color: '#EF4444', description: 'Major new product launch, full 360 marketing support' },
  B: { label: 'Tier B — Moderate', color: '#F59E0B', description: 'Product extension or key campaign, select channel support' },
  C: { label: 'Tier C — Light', color: '#6B7280', description: 'Seasonal moment or minor update, always-on channels only' },
};
