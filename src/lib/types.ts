export type LaunchType = 'new_product' | 'product_extension' | 'campaign' | 'seasonal' | 'collaboration';
export type LaunchTier = 'A' | 'B' | 'C';
export type ContentProductionType = 'none' | 'no_tech' | 'with_tech' | 'landing_page';
export type TaskStatus = 'not_started' | 'in_progress' | 'complete' | 'blocked' | 'skipped' | 'waiting_review';
export type PhaseKey = 'content_planning' | 'cross_functional' | 'finalize_strategies' | 'content_production' | 'design_briefs' | 'design_production';
export type Owner = 'marketing' | 'creative' | 'growth' | 'retail' | 'influencer' | 'pr' | 'ops' | 'social' | 'copywriter';

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
  isBottleneck?: boolean;
  approvalStatus?: 'draft' | 'submitted' | 'approved' | 'revision_needed';
  submittedDate?: string | null;
  approvedDate?: string | null;
  meetingChecklist?: string[];
}

// Tasks that typically produce deliverables (each gets a link column)
export const DELIVERABLE_TASKS: Record<string, string> = {
  'Product Sheet & Competitive Landscape': 'Product Sheet',
  'Draft Product Positioning & Messaging': 'Positioning Draft',
  'Final GTM Deck': 'Final GTM Deck',
  'Submit Tagline + Campaign Copy Brief': 'Copy Brief',
  'R1 Taglines & Copy Due': 'R1 Taglines',
  'Final Taglines & Campaign Copy Due': 'Final Taglines & Copy',
  'Draft Shoot & Content Capture Plan': 'Shoot Capture Plan Draft',
  'Finalize Shoot & Content Capture Plan': 'Final Shoot Capture Plan',
  'Draft PDP Gallery Asset Brief': 'PDP Gallery Brief',
  'Draft Sephora/Amazon Gallery Asset Brief': 'Sephora/Amazon Gallery Brief',
  'Draft Amazon A+ Content Brief': 'Amazon A+ Brief',
  'Draft Email Brief': 'Email Brief',
  'Draft Social Creative Brief': 'Social Brief',
  'Draft Homepage Asset Brief': 'Homepage Brief',
  'Draft PDP Copy Brief': 'PDP Copy Brief',
  'Draft Bundle PDP Copy Brief': 'Bundle PDP Copy Brief',
  'Draft Bundle PDP Gallery Asset Brief': 'Bundle Gallery Brief',
  'Draft Bundle Sephora/Amazon Gallery Asset Brief': 'Bundle Sephora/Amazon Brief',
  'Final Asset Design Briefs Due': 'Final Design Briefs',
  'R1 Assets Due (Email, Social, PDP, Homepage, Amazon A+)': 'R1 Assets Folder',
  'Sephora Final Assets Due': 'Sephora Assets',
  'DTC & Amazon Final Assets Due': 'DTC/Amazon Assets',
  'Draft Sephora Catalog & PDP Copy Due': 'Sephora Copy Draft',
  'Final Sephora Catalog & PDP Copy': 'Final Sephora Copy',
  'Final DTC PDP Copy & Reviews Due': 'Final DTC PDP Copy',
  'Briefs to Creators': 'Creator Briefs',
  'Creator Content Delivered': 'Creator Content',
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
  { key: 'content_planning', name: 'Content Planning', color: '#3D4EDB' },
  { key: 'cross_functional', name: 'Alignment', color: '#9333ea' },
  { key: 'finalize_strategies', name: 'Strategies', color: '#22c55e' },
  { key: 'content_production', name: 'Content Production', color: '#f97316' },
  { key: 'design_briefs', name: 'Design Briefs', color: '#e85d04' },
  { key: 'design_production', name: 'Asset Production', color: '#EC4899' },
];

export const OWNER_LABELS: Record<Owner, string> = {
  marketing: 'Marketing',
  creative: 'Creative',
  growth: 'Growth',
  retail: 'Retail',
  influencer: 'Influencer',
  social: 'Social',
  pr: 'PR',
  ops: 'Operations',
  copywriter: 'Copywriter',
};

export const OWNER_COLORS: Record<Owner, string> = {
  marketing: '#6366F1',
  creative: '#EC4899',
  growth: '#8B5CF6',
  retail: '#14B8A6',
  influencer: '#F97316',
  social: '#0EA5E9',
  pr: '#06B6D4',
  ops: '#64748B',
  copywriter: '#A855F7',
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
