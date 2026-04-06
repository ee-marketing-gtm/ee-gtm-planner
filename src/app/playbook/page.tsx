'use client';

import { useState, useEffect } from 'react';
import { PHASES, ContentProductionType } from '@/lib/types';
import {
  Target, BookOpen, Clock, Users, CheckSquare, ArrowRight, Lightbulb, AlertCircle,
  MessageSquare, FileText, Presentation, ShieldCheck, Camera, Scissors, Monitor,
  PenTool, Rocket, ArrowDown, Lock, ChevronDown, ChevronRight, Sparkles,
  Eye, Palette, Star, Zap, Upload, FolderOpen, Link2, Trash2, Plus, X, Package
} from 'lucide-react';

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1: PROCESS WORKFLOW
// ══════════════════════════════════════════════════════════════════════════════

interface GateTask {
  name: string;
  owner: string;
  duration: string;
  icon: React.ReactNode;
  description: string;
  tips?: string[];
}

interface Gate {
  id: string;
  phase: string;
  phaseColor: string;
  phaseBg: string;
  phaseIcon: React.ReactNode;
  description: string;
  totalDuration: string;
  checkpoint: string;
  checkpointDetails: string[];
  tasks: GateTask[];
}

const GATES: Gate[] = [
  {
    id: 'content_planning',
    phase: 'Content Planning',
    phaseColor: '#6366F1',
    phaseBg: '#EEF2FF',
    phaseIcon: <Target className="w-6 h-6" />,
    description: 'Define the strategic foundation — who the launch is for, what it says, and how it looks.',
    totalDuration: '~20 business days',
    checkpoint: 'Strategy & Creative Direction Locked',
    checkpointDetails: [
      'Positioning statement approved',
      'Key messages and copy direction finalized',
      'Creative concepts approved from brainstorm',
      'Asset request form and marketing deck drafted',
    ],
    tasks: [
      { name: 'Marketing Positioning', owner: 'Marketing', duration: '5 days', icon: <Target className="w-4 h-4" />, description: 'Define target audience, key insight, positioning statement, and competitive differentiation.', tips: ['Review past GTM decks for frameworks that worked', 'Align with Product on claims and ingredient story'] },
      { name: 'Copy Direction', owner: 'Marketing', duration: '5 days', icon: <MessageSquare className="w-4 h-4" />, description: 'Develop messaging hierarchy, 3-5 key messages, proof points, tone of voice, and headline options.', tips: ['Messages should work short (social) and long (email)', 'Include specific claims for regulatory review if needed'] },
      { name: 'Brainstorm Meeting', owner: 'Marketing', duration: '2 days', icon: <Users className="w-4 h-4" />, description: 'Cross-functional creative brainstorm with Marketing, Creative, and Channel Leads to align on visual direction and campaign narrative.', tips: ['Don\'t squeeze into another meeting — schedule dedicated time', 'Come with positioning + copy direction finalized'] },
      { name: 'Brainstorm Concepts Approved', owner: 'Marketing', duration: '3 days', icon: <CheckSquare className="w-4 h-4" />, description: 'Finalize and get sign-off on creative concepts, shot list direction, and high-level asset list by channel.' },
      { name: '1st Draft Marketing Deck & Asset Request Form', owner: 'Channel Leads', duration: '5 days', icon: <FileText className="w-4 h-4" />, description: 'Channel leads build the 360 marketing deck and asset request forms with specs per channel.', tips: ['Use the standardized template — don\'t start from scratch', 'If one person owns multiple briefs, flag workload early'] },
    ],
  },
  {
    id: 'finalize_mgmt',
    phase: 'Finalize & Inform Mgmt',
    phaseColor: '#F59E0B',
    phaseBg: '#FFFBEB',
    phaseIcon: <Presentation className="w-6 h-6" />,
    description: 'Polish the plan, get leadership buy-in, and lock the strategy before moving into production.',
    totalDuration: '~5 business days',
    checkpoint: 'Management Approved — Go to Production',
    checkpointDetails: ['Final marketing deck with strategy, channels, budget, and timeline', 'Explicit management sign-off received', 'Any revision notes incorporated'],
    tasks: [
      { name: 'Final Marketing Launch Deck', owner: 'Marketing', duration: '3 days', icon: <Presentation className="w-4 h-4" />, description: 'Polish the marketing deck incorporating all channel plans, budget, and timeline into a single source of truth.', tips: ['This deck becomes the GTM bible — make it comprehensive', 'Include the "why" behind each channel choice'] },
      { name: 'Management Approval', owner: 'Marketing', duration: '2 days', icon: <ShieldCheck className="w-4 h-4" />, description: 'Present the launch plan to leadership for approval before moving into production.', tips: ['Send deck in advance so leadership can review beforehand', 'Get explicit sign-off — silence ≠ approval'] },
    ],
  },
  {
    id: 'packaging',
    phase: 'Packaging Development',
    phaseColor: '#7C3AED',
    phaseBg: '#F5F3FF',
    phaseIcon: <Package className="w-6 h-6" />,
    description: 'Develop packaging design and copy in parallel with production — must be finalized before photoshoot samples.',
    totalDuration: '~18 business days',
    checkpoint: 'Packaging Samples Ready for Photoshoot',
    checkpointDetails: [
      'Packaging structure and colors finalized',
      'Copy sheet draft ready (near-final)',
      'Samples available for product photoshoot',
    ],
    tasks: [
      { name: 'Marketing Briefs Creative on Packaging Concept', owner: 'Marketing', duration: '3 days', icon: <FileText className="w-4 h-4" />, description: 'Marketing develops the packaging concept brief covering brand positioning, target shelf presence, key claims, and visual direction for creative to begin sourcing.', tips: ['Include competitive shelf references', 'Specify must-have claims and regulatory constraints upfront'] },
      { name: 'Creative Sources & Develops Packaging Options', owner: 'Creative', duration: '10 days', icon: <Palette className="w-4 h-4" />, description: 'Creative team sources materials, develops structural and graphic options, and presents 2-3 packaging directions for review.', tips: ['Request vendor samples early — lead times can be long', 'Present options with mock-ups showing shelf context'] },
      { name: 'Marketing + Kim Refine & Finalize Design', owner: 'Marketing', duration: '5 days', icon: <CheckSquare className="w-4 h-4" />, description: 'Marketing and founder (Kim) review packaging options, provide feedback, and make final design selection. Kim is the final decision-maker on packaging aesthetics.', tips: ['Schedule founder review early — her calendar fills fast', 'Come with a clear recommendation and rationale', 'Founder is final decision-maker on packaging aesthetics'] },
      { name: 'Develop Packaging Copy Sheet', owner: 'Marketing', duration: '5 days', icon: <MessageSquare className="w-4 h-4" />, description: 'Develop the full packaging copy sheet including front panel, back panel, ingredient call-outs, claims, and regulatory copy. This runs in parallel with design exploration.', tips: ['Start copy sheet during design exploration — don\'t wait for final design', 'Coordinate with regulatory on claims language early', 'Copy sheet should be near-final before photoshoot samples are produced'] },
    ],
  },
  {
    id: 'content_production',
    phase: 'Content Production',
    phaseColor: '#10B981',
    phaseBg: '#ECFDF5',
    phaseIcon: <Camera className="w-6 h-6" />,
    description: 'Execute the creative vision — photography, video, retouching, and technical asset preparation.',
    totalDuration: '~38 business days',
    checkpoint: 'Final Assets Delivered & Tech-Ready',
    checkpointDetails: ['All retouched assets delivered in required formats', 'Tech-ready files handed off (web, PDP, etc.)', 'One round of revisions completed'],
    tasks: [
      { name: 'Asset Request Form Approval & AD Start', owner: 'Creative', duration: '11 days', icon: <Palette className="w-4 h-4" />, description: 'Creative reviews and approves asset requests, begins art direction and pre-production planning.', tips: ['Creative needs complete briefs — incomplete briefs cause delays', 'Confirm model/talent availability early'] },
      { name: 'Production Start', owner: 'Creative', duration: '7 days', icon: <Camera className="w-4 h-4" />, description: 'Pre-production logistics: location scouting, prop sourcing, styling, and production scheduling.' },
      { name: 'Shoot', owner: 'Creative', duration: '10 days', icon: <Star className="w-4 h-4" />, description: 'Photography and/or video production days, including initial selects.', tips: ['Marketing should attend for real-time alignment', 'Capture BTS content for social while you have the setup'] },
      { name: 'Retouching', owner: 'Creative', duration: '10 days', icon: <Scissors className="w-4 h-4" />, description: 'Post-production retouching, color correction, and file preparation.', tips: ['Build in one round of revisions — plan for it', 'Confirm all tech specs with Digital/Ops before handoff'] },
      { name: 'Tech Hand Off', owner: 'Creative', duration: '—', icon: <Monitor className="w-4 h-4" />, description: 'Technical handoff of web-ready files for PDP, landing pages, and digital channels.' },
    ],
  },
  {
    id: 'design_production',
    phase: 'Design Production',
    phaseColor: '#EC4899',
    phaseBg: '#FDF2F8',
    phaseIcon: <PenTool className="w-6 h-6" />,
    description: 'Turn final assets into channel-ready creative — email, web, social, paid — and launch.',
    totalDuration: '~26 business days',
    checkpoint: 'All Creative Approved — Ready to Launch',
    checkpointDetails: ['All channel creative reviewed and approved', 'Visual and messaging consistency confirmed across touchpoints', 'All CTAs and links verified', 'Launch day checklist complete'],
    tasks: [
      { name: 'Design Briefs Due', owner: 'Channel Leads', duration: '21 days', icon: <FileText className="w-4 h-4" />, description: 'Channel leads submit detailed design briefs for email, web, social, and paid media creative.', tips: ['Start writing briefs while assets are still in production — don\'t wait', 'Reference approved strategy and key messages in every brief'] },
      { name: 'Design Approvals & Scheduling', owner: 'Channel Leads', duration: '5 days', icon: <Eye className="w-4 h-4" />, description: 'Review designed assets per channel and schedule content for launch.' },
      { name: 'Creative 360 Review', owner: 'Creative', duration: '—', icon: <Sparkles className="w-4 h-4" />, description: 'Cross-functional review of ALL designed assets together to ensure consistency across every touchpoint.', tips: ['Do this as a single session — seeing everything together catches inconsistencies', 'Check: Are key messages consistent? Visual identity cohesive? CTAs aligned?'] },
      { name: 'Launch!', owner: 'Marketing', duration: 'Day 0', icon: <Rocket className="w-4 h-4" />, description: 'Go live across all channels. Monitor performance and be ready to optimize.', tips: ['Have a launch day checklist — verify every channel is live and correct', 'Schedule a post-launch debrief for 2-4 weeks after launch'] },
    ],
  },
];

function ProcessTab() {
  const [expandedGate, setExpandedGate] = useState<string | null>('content_planning');
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  return (
    <div>
      {/* Visual Pipeline Overview */}
      <div className="bg-white rounded-2xl border border-[#E7E5E4] p-6 mb-8">
        <h2 className="text-xs font-semibold text-[#A8A29E] uppercase tracking-wider mb-5">End-to-End Pipeline</h2>
        <div className="flex items-stretch gap-0">
          {GATES.map((gate, i) => (
            <div key={gate.id} className="flex items-stretch flex-1">
              <button onClick={() => setExpandedGate(expandedGate === gate.id ? null : gate.id)} className="flex-1 group">
                <div className="rounded-xl p-4 h-full flex flex-col items-center text-center transition-all hover:shadow-md border-2"
                  style={{ background: gate.phaseBg, borderColor: expandedGate === gate.id ? gate.phaseColor : 'transparent' }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2" style={{ background: gate.phaseColor + '20', color: gate.phaseColor }}>
                    {gate.phaseIcon}
                  </div>
                  <p className="text-xs font-bold text-[#1B1464] leading-tight">{gate.phase}</p>
                  <p className="text-[10px] text-[#A8A29E] mt-1">{gate.totalDuration}</p>
                  <div className="mt-2 flex items-center gap-1">
                    <span className="text-[10px] font-medium" style={{ color: gate.phaseColor }}>{gate.tasks.length} tasks</span>
                  </div>
                </div>
              </button>
              {i < GATES.length - 1 && (
                <div className="flex flex-col items-center justify-center px-2">
                  <div className="w-6 h-6 rounded-full bg-[#F5F5F4] border-2 border-[#E7E5E4] flex items-center justify-center">
                    <Lock className="w-3 h-3 text-[#A8A29E]" />
                  </div>
                  <div className="w-px h-3 bg-[#E7E5E4]" />
                  <p className="text-[8px] text-[#A8A29E] font-medium uppercase tracking-wide" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', letterSpacing: '0.05em' }}>GATE</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Total timeline bar */}
        <div className="mt-5 pt-4 border-t border-[#E7E5E4]">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[#A8A29E]" />
            <span className="text-xs text-[#57534E]">Total timeline: <strong>~89 business days (18 weeks)</strong> for full production launches</span>
          </div>
          <div className="flex mt-2 rounded-full overflow-hidden h-2">
            <div className="h-full" style={{ width: '22%', background: '#6366F1' }} />
            <div className="h-full" style={{ width: '6%', background: '#F59E0B' }} />
            <div className="h-full" style={{ width: '43%', background: '#10B981' }} />
            <div className="h-full" style={{ width: '29%', background: '#EC4899' }} />
          </div>
          <div className="flex mt-1">
            <span className="text-[9px] text-[#6366F1]" style={{ width: '22%' }}>20d</span>
            <span className="text-[9px] text-[#F59E0B]" style={{ width: '6%' }}>5d</span>
            <span className="text-[9px] text-[#10B981]" style={{ width: '43%' }}>38d</span>
            <span className="text-[9px] text-[#EC4899]" style={{ width: '29%' }}>26d</span>
          </div>
        </div>
      </div>

      {/* Detailed Phase Breakdown */}
      <div className="space-y-4">
        {GATES.map((gate, gateIndex) => {
          const isExpanded = expandedGate === gate.id;
          return (
            <div key={gate.id}>
              <div className="bg-white rounded-2xl border border-[#E7E5E4] overflow-hidden">
                <button onClick={() => setExpandedGate(isExpanded ? null : gate.id)} className="w-full p-5 flex items-center gap-4 hover:bg-[#FAFAF9] transition-colors text-left">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: gate.phaseBg, color: gate.phaseColor }}>
                    {gate.phaseIcon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: gate.phaseColor }}>Phase {gateIndex + 1}</span>
                      <span className="text-[10px] text-[#A8A29E]">·</span>
                      <span className="text-[10px] text-[#A8A29E]">{gate.totalDuration}</span>
                    </div>
                    <h3 className="text-base font-bold text-[#1B1464]">{gate.phase}</h3>
                    <p className="text-xs text-[#57534E] mt-0.5">{gate.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-[#A8A29E]">{gate.tasks.length} tasks</span>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-[#A8A29E]" /> : <ChevronRight className="w-4 h-4 text-[#A8A29E]" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-[#E7E5E4]">
                    <div className="p-5 space-y-3">
                      {gate.tasks.map((task, taskIndex) => {
                        const taskKey = `${gate.id}-${taskIndex}`;
                        const isTaskExpanded = expandedTask === taskKey;
                        return (
                          <div key={taskIndex}>
                            <button onClick={() => setExpandedTask(isTaskExpanded ? null : taskKey)} className="w-full group">
                              <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#FAFAF9] transition-colors">
                                <div className="flex flex-col items-center shrink-0">
                                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: gate.phaseColor + '15', color: gate.phaseColor }}>
                                    {task.icon}
                                  </div>
                                  {taskIndex < gate.tasks.length - 1 && <div className="w-px h-4 mt-1" style={{ background: gate.phaseColor + '30' }} />}
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                  <p className="text-sm font-semibold text-[#1B1464]">{task.name}</p>
                                  <div className="flex items-center gap-3 mt-0.5">
                                    <span className="text-[11px] text-[#A8A29E] flex items-center gap-1"><Clock className="w-3 h-3" /> {task.duration}</span>
                                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: gate.phaseColor + '10', color: gate.phaseColor }}>{task.owner}</span>
                                  </div>
                                </div>
                                <ChevronRight className={`w-4 h-4 text-[#D6D3D1] transition-transform ${isTaskExpanded ? 'rotate-90' : ''}`} />
                              </div>
                            </button>
                            {isTaskExpanded && (
                              <div className="ml-11 pl-3 border-l-2 mb-2" style={{ borderColor: gate.phaseColor + '30' }}>
                                <div className="bg-[#FAFAF9] rounded-xl p-4 space-y-3">
                                  <p className="text-sm text-[#57534E]">{task.description}</p>
                                  {task.tips && task.tips.length > 0 && (
                                    <div>
                                      <p className="text-[11px] font-semibold text-[#1B1464] mb-1.5 flex items-center gap-1"><Zap className="w-3 h-3 text-[#F59E0B]" /> Pro Tips</p>
                                      <ul className="space-y-1">
                                        {task.tips.map((tip, j) => (
                                          <li key={j} className="text-xs text-[#57534E] flex items-start gap-2"><span className="text-[#F59E0B] mt-0.5 shrink-0">→</span> {tip}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Gate Checkpoint */}
                    <div className="mx-5 mb-5 rounded-xl p-4 border-2 border-dashed" style={{ borderColor: gate.phaseColor + '40', background: gate.phaseBg }}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: gate.phaseColor, color: 'white' }}>
                          <Lock className="w-3 h-3" />
                        </div>
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: gate.phaseColor }}>Gate Checkpoint</p>
                      </div>
                      <p className="text-sm font-semibold text-[#1B1464] mb-2">{gate.checkpoint}</p>
                      <ul className="space-y-1.5">
                        {gate.checkpointDetails.map((detail, i) => (
                          <li key={i} className="text-xs text-[#57534E] flex items-start gap-2">
                            <CheckSquare className="w-3 h-3 mt-0.5 shrink-0" style={{ color: gate.phaseColor }} />{detail}
                          </li>
                        ))}
                      </ul>
                      {gateIndex < GATES.length - 1 && (
                        <p className="text-[11px] mt-3 flex items-center gap-1.5" style={{ color: gate.phaseColor }}>
                          <AlertCircle className="w-3 h-3" />Must be cleared before advancing to {GATES[gateIndex + 1].phase}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {gateIndex < GATES.length - 1 && (
                <div className="flex justify-center py-1"><ArrowDown className="w-5 h-5 text-[#D6D3D1]" /></div>
              )}
            </div>
          );
        })}
      </div>

      {/* Launch Types Reference */}
      <div className="bg-white rounded-2xl border border-[#E7E5E4] p-5 mt-8">
        <h3 className="text-sm font-bold text-[#1B1464] mb-4">How the Pipeline Changes by Launch Type</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { type: 'Full Production', subtitle: 'With Tech', phases: ['Content Planning', 'Finalize & Mgmt', 'Content Production', 'Design Production'], duration: '~89 days', example: 'SPF 50 Launch, Kids Hair Launch', colors: ['#6366F1', '#F59E0B', '#10B981', '#EC4899'] },
            { type: 'No Content Production', subtitle: 'Campaign / Moment', phases: ['Content Planning', 'Finalize & Mgmt', 'Design Production'], duration: '~51 days', example: "Mother's Day, Memorial Day Sale", colors: ['#6366F1', '#F59E0B', '#EC4899'] },
            { type: 'Content Prod (No Tech)', subtitle: 'No landing page needed', phases: ['Content Planning', 'Finalize & Mgmt', 'Content Prod*', 'Design Production'], duration: '~79 days', example: 'Product extension, restock campaign', colors: ['#6366F1', '#F59E0B', '#10B981', '#EC4899'] },
          ].map((lt, i) => (
            <div key={i} className="bg-[#FAFAF9] rounded-xl p-4">
              <p className="text-sm font-bold text-[#1B1464]">{lt.type}</p>
              <p className="text-[11px] text-[#A8A29E] mb-3">{lt.subtitle}</p>
              <div className="flex gap-0.5 mb-3">
                {lt.colors.map((c, j) => <div key={j} className="h-1.5 flex-1 rounded-full" style={{ background: c }} />)}
              </div>
              <div className="space-y-1 mb-3">
                {lt.phases.map((p, j) => (
                  <div key={j} className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: lt.colors[j] }} />
                    <span className="text-[11px] text-[#57534E]">{p}</span>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-[#E7E5E4]">
                <p className="text-[11px] text-[#A8A29E]"><strong>{lt.duration}</strong> total</p>
                <p className="text-[10px] text-[#A8A29E] mt-0.5">e.g., {lt.example}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2: STEP-BY-STEP PLAYBOOK
// ══════════════════════════════════════════════════════════════════════════════

interface PlaybookStep {
  name: string;
  phase: string;
  owner: string;
  duration: string;
  description: string;
  keyDeliverables: string[];
  bestPractices: string[];
  prerequisite?: string;
}

const PLAYBOOK_STEPS: PlaybookStep[] = [
  { name: 'Marketing Positioning', phase: 'Content Planning', owner: 'Marketing', duration: '5 business days', description: 'Define the core positioning for this launch: who it\'s for, what problem it solves, and how it\'s differentiated.', keyDeliverables: ['Target audience definition', 'Key consumer insight', 'Positioning statement', 'Competitive differentiation'], bestPractices: ['Review past GTM decks for positioning frameworks that worked', 'Check competitive landscape for recent launches in the same space', 'Align with Product team on product claims and ingredient story'] },
  { name: 'Copy Direction', phase: 'Content Planning', owner: 'Marketing', duration: '5 business days', description: 'Develop the messaging hierarchy and copy direction that will inform all creative and channel-specific briefs.', keyDeliverables: ['Key messages (3-5)', 'Proof points', 'Tone of voice guidelines', 'Headline/tagline options'], bestPractices: ['Key messages should be adaptable across channels (short for social, longer for email)', 'Include specific claims with regulatory review if needed', 'Test copy direction with internal team before proceeding'] },
  { name: 'Brainstorm Meeting', phase: 'Content Planning', owner: 'Marketing', duration: '2 business days', description: 'Cross-functional creative brainstorm to align on visual direction, content concepts, and campaign narrative.', keyDeliverables: ['Meeting notes with concept directions', 'Mood board or visual references', 'Agreed-upon creative territory'], bestPractices: ['Schedule this as a dedicated session — don\'t try to squeeze it into another meeting', 'Invite: Marketing, Creative, Channel Leads. Optional: Product, Retail', 'Come prepared with positioning and copy direction finalized'], prerequisite: 'Marketing Positioning and Copy Direction must be approved before this meeting' },
  { name: 'Brainstorm Concepts Approved', phase: 'Content Planning', owner: 'Marketing', duration: '3 business days', description: 'Finalize and get sign-off on the creative concepts that came out of the brainstorm session.', keyDeliverables: ['Approved concept(s)', 'Shot list direction (if applicable)', 'High-level asset list by channel'], bestPractices: ['Document the approved direction clearly so it can be referenced in all downstream briefs', 'If there\'s disagreement, escalate quickly — don\'t let this step stall the timeline'] },
  { name: '1st Draft Marketing Deck & Asset Request Form', phase: 'Content Planning', owner: 'Channel Leads', duration: '5 business days', description: 'Channel leads build out the 360 marketing deck and asset request forms detailing exactly what\'s needed per channel.', keyDeliverables: ['Marketing deck draft (strategy + channel plans)', 'Asset request form with specs per channel', 'Budget allocations by channel'], bestPractices: ['Use the standardized template — don\'t start from scratch', 'If one person owns multiple channel briefs, flag workload early so they can plan ahead', 'Include specs (dimensions, formats, copy character counts) in the asset request form'], prerequisite: 'Brainstorm concepts must be approved before writing channel-specific briefs' },
  { name: 'Final Marketing Launch Deck', phase: 'Finalize & Inform Mgmt', owner: 'Marketing', duration: '3 business days', description: 'Polish the marketing deck incorporating all channel plans, budget, and timeline into a single source of truth.', keyDeliverables: ['Final marketing deck', 'Launch timeline', 'Budget summary'], bestPractices: ['This deck becomes the GTM source of truth — make it comprehensive', 'Include strategy rationale, not just what you\'re doing but why'] },
  { name: 'Management Approval', phase: 'Finalize & Inform Mgmt', owner: 'Marketing', duration: '2 business days', description: 'Present the launch plan to leadership for approval before moving into production.', keyDeliverables: ['Management sign-off', 'Any revision notes incorporated'], bestPractices: ['Send the deck in advance so leadership can review before the meeting', 'Come prepared to justify budget and channel choices with data from past launches', 'Get explicit sign-off — don\'t assume silence is approval'] },
  { name: 'Asset Request Form Approval & AD Start', phase: 'Content Production', owner: 'Creative', duration: '11 business days', description: 'Creative team reviews and approves asset requests, then begins art direction and pre-production.', keyDeliverables: ['Approved asset request forms', 'Art direction concepts', 'Production schedule'], bestPractices: ['Creative needs clear, complete briefs — incomplete briefs cause delays', 'Confirm model/talent availability early in this phase'] },
  { name: 'Production & Shoot', phase: 'Content Production', owner: 'Creative', duration: '17 business days', description: 'Photography/video production including shoot days and initial selects.', keyDeliverables: ['Raw content from shoot', 'Initial selects', 'Behind-the-scenes content (if applicable)'], bestPractices: ['Marketing should attend the shoot for real-time alignment', 'Capture extra BTS content for social while you have the setup'] },
  { name: 'Retouching & Tech Hand Off', phase: 'Content Production', owner: 'Creative', duration: '10 business days', description: 'Post-production retouching and technical handoff of final assets.', keyDeliverables: ['Final retouched assets', 'All file formats per channel specs', 'Tech-ready files (web, PDP, etc.)'], bestPractices: ['Build in one round of revisions — plan for it, don\'t let it surprise your timeline', 'Confirm all tech specs with Digital/Ops before handoff'] },
  { name: 'Design Briefs Due', phase: 'Design Production', owner: 'Channel Leads', duration: '21 business days', description: 'Channel leads submit detailed design briefs for email, web, social, and paid media creative.', keyDeliverables: ['Email design brief', 'Social creative brief', 'Web/PDP design brief', 'Paid media creative brief'], bestPractices: ['Start writing briefs as soon as final assets are in production — don\'t wait until they\'re fully done', 'Reference the approved strategy and key messages in every brief', 'Flag if one person is writing multiple briefs — plan for workload overlap'] },
  { name: 'Design Approvals & Creative 360 Review', phase: 'Design Production', owner: 'Channel Leads + Creative', duration: '5 business days', description: 'Review all designed assets across channels to ensure consistency and quality.', keyDeliverables: ['All channel creative approved', 'Consistent visual and messaging across touchpoints'], bestPractices: ['Do this as a single cross-functional review — seeing everything together catches inconsistencies', 'Check: Are key messages consistent? Is visual identity cohesive? Are all CTAs aligned?'] },
  { name: 'Launch!', phase: 'Design Production', owner: 'Marketing', duration: 'Launch day', description: 'Go live across all channels. Monitor performance and be ready to optimize.', keyDeliverables: ['All channels live', 'Launch day monitoring dashboard', 'Quick-response plan for issues'], bestPractices: ['Have a launch day checklist — check every channel is live and correct', 'Monitor first 24-48 hours closely for any issues', 'Schedule a post-launch debrief 2-4 weeks after launch'] },
];

function StepByStepTab() {
  const [selectedType, setSelectedType] = useState<ContentProductionType>('with_tech');
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const filteredSteps = PLAYBOOK_STEPS.filter(step => {
    if (selectedType === 'none' && step.phase === 'Content Production') return false;
    return true;
  });

  const totalDuration = filteredSteps.reduce((sum, step) => {
    const match = step.duration.match(/(\d+)/);
    return sum + (match ? parseInt(match[1]) : 0);
  }, 0);

  return (
    <div>
      {/* Production type selector */}
      <div className="bg-white rounded-xl border border-[#E7E5E4] p-4 mb-6">
        <label className="block text-xs font-medium text-[#57534E] mb-2">Viewing playbook for:</label>
        <div className="flex gap-2">
          {[
            { key: 'with_tech', label: 'Full Production (with Tech)' },
            { key: 'no_tech', label: 'Content Production (No Tech)' },
            { key: 'none', label: 'No Content Production' },
          ].map(opt => (
            <button key={opt.key} onClick={() => setSelectedType(opt.key as ContentProductionType)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedType === opt.key ? 'bg-[#FF1493] text-white' : 'bg-[#F5F5F4] text-[#57534E] hover:bg-[#E7E5E4]'}`}>
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-[#A8A29E] mt-2">Total timeline: ~{totalDuration} business days ({Math.ceil(totalDuration / 5)} weeks) before launch</p>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {filteredSteps.map((step, i) => {
          const isExpanded = expandedStep === i;
          const phaseConfig = PHASES.find(p => p.name === step.phase);
          const prevPhase = i > 0 ? filteredSteps[i - 1].phase : null;
          const showPhaseHeader = step.phase !== prevPhase;

          return (
            <div key={i}>
              {showPhaseHeader && (
                <div className="flex items-center gap-2 mt-6 mb-3 first:mt-0">
                  <div className="w-3 h-3 rounded-full" style={{ background: phaseConfig?.color || '#6B7280' }} />
                  <h2 className="text-sm font-bold text-[#1B1464]">{step.phase}</h2>
                </div>
              )}
              <div className="bg-white rounded-xl border border-[#E7E5E4] overflow-hidden">
                <button onClick={() => setExpandedStep(isExpanded ? null : i)} className="w-full flex items-center justify-between p-4 hover:bg-[#FAFAF9] transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#F5F5F4] flex items-center justify-center text-xs font-bold text-[#57534E]">{i + 1}</div>
                    <div>
                      <p className="text-sm font-medium text-[#1B1464]">{step.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[11px] text-[#A8A29E] flex items-center gap-1"><Clock className="w-3 h-3" /> {step.duration}</span>
                        <span className="text-[11px] text-[#A8A29E] flex items-center gap-1"><Users className="w-3 h-3" /> {step.owner}</span>
                      </div>
                    </div>
                  </div>
                  <ArrowRight className={`w-4 h-4 text-[#A8A29E] transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>
                {isExpanded && (
                  <div className="border-t border-[#E7E5E4] p-4 space-y-4">
                    <p className="text-sm text-[#57534E]">{step.description}</p>
                    {step.prerequisite && (
                      <div className="flex items-start gap-2 bg-amber-50 rounded-lg p-3">
                        <AlertCircle className="w-4 h-4 text-[#F59E0B] mt-0.5 shrink-0" />
                        <p className="text-xs text-[#92400E]"><strong>Prerequisite:</strong> {step.prerequisite}</p>
                      </div>
                    )}
                    <div>
                      <h4 className="text-xs font-semibold text-[#1B1464] mb-2 flex items-center gap-1.5"><CheckSquare className="w-3.5 h-3.5 text-[#FF1493]" /> Key Deliverables</h4>
                      <ul className="space-y-1">
                        {step.keyDeliverables.map((d, j) => (
                          <li key={j} className="text-xs text-[#57534E] flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-[#FF1493]" /> {d}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-[#1B1464] mb-2 flex items-center gap-1.5"><Lightbulb className="w-3.5 h-3.5 text-[#F59E0B]" /> Best Practices</h4>
                      <ul className="space-y-1.5">
                        {step.bestPractices.map((bp, j) => (
                          <li key={j} className="text-xs text-[#57534E] flex items-start gap-2"><span className="text-[#F59E0B] mt-0.5">→</span> {bp}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3: TEMPLATES
// ══════════════════════════════════════════════════════════════════════════════

interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  url: string;
  addedAt: string;
}

const TEMPLATE_CATEGORIES = [
  'PDP Copy & Module Brief',
  'Gallery Asset Briefs (Amazon, D2C, Sephora)',
  'Amazon A+ Content Briefs',
  'Social Creative Content Briefs',
  'GTM Deck',
  'Asset Request Form',
  'Product Page',
  'Email Briefs',
  'Campaign Copy Briefs (Copywriter)',
  'Packaging Copy Briefs (Copywriter)',
  'Packaging Copy Sheets',
  'Packaging Concept Brief (Creative)',
];

const SEED_TEMPLATES: Omit<Template, 'id' | 'addedAt'>[] = TEMPLATE_CATEGORIES.flatMap(cat => {
  // Pre-populated templates with known files
  if (cat === 'Gallery Asset Briefs (Amazon, D2C, Sephora)') {
    return [
      {
        name: `${cat} - Template`,
        category: cat,
        description: 'PDP Gallery Asset Briefs deck — 9 asset types (USPs, Claims, Hero, Safety, Ingredients, Lifestyle, Texture, How To Use, Complete The Routine)',
        url: '',
      },
      {
        name: `${cat} - Example`,
        category: cat,
        description: `Reference example of a completed ${cat}`,
        url: '',
      },
    ];
  }
  return [
    {
      name: `${cat} - Template`,
      category: cat,
      description: `Base template for ${cat}`,
      url: '',
    },
    {
      name: `${cat} - Example`,
      category: cat,
      description: `Reference example of a completed ${cat}`,
      url: '',
    },
  ];
});

const TEMPLATES_STORAGE_KEY = 'ee-gtm-templates';

function getTemplates(): Template[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(TEMPLATES_STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

function saveTemplates(templates: Template[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  // Sync to API
  fetch('/api/data/templates', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: templates }),
  }).catch(() => {});
}

async function loadTemplatesFromApi(): Promise<Template[]> {
  try {
    const res = await fetch('/api/data/templates');
    const data = await res.json();
    const parsed = data.value ? JSON.parse(data.value) : [];
    if (parsed.length > 0) {
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(parsed));
      return parsed;
    }
  } catch {}
  return getTemplates();
}

function TemplatesTab() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState(TEMPLATE_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState('');

  useEffect(() => {
    loadTemplatesFromApi().then(existing => {
      if (existing.length > 0) {
        setTemplates(existing);
      } else {
        const seeded: Template[] = SEED_TEMPLATES.map(t => ({
          ...t,
          id: crypto.randomUUID(),
          addedAt: new Date().toISOString(),
        }));
        saveTemplates(seeded);
        setTemplates(seeded);
      }
    });
  }, []);

  function handleAdd() {
    if (!name.trim()) return;
    const newTemplate: Template = {
      id: crypto.randomUUID(),
      name: name.trim(),
      category,
      description: description.trim(),
      url: url.trim(),
      addedAt: new Date().toISOString(),
    };
    const updated = [...templates, newTemplate];
    saveTemplates(updated);
    setTemplates(updated);
    setName('');
    setDescription('');
    setUrl('');
    setShowAdd(false);
  }

  function handleDelete(id: string) {
    const updated = templates.filter(t => t.id !== id);
    saveTemplates(updated);
    setTemplates(updated);
  }

  function handleUpdateUrl(id: string) {
    if (!editUrl.trim()) return;
    const updated = templates.map(t => t.id === id ? { ...t, url: editUrl.trim() } : t);
    saveTemplates(updated);
    setTemplates(updated);
    setEditingId(null);
    setEditUrl('');
  }

  const grouped = templates.reduce<Record<string, Template[]>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-[#57534E]">
            Store links to your base templates for decks, briefs, and other launch assets. Keep everything in one place so the team always starts from the latest version.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF1493] text-white text-xs font-medium hover:bg-[#D4117D] transition-colors shrink-0 ml-4"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Template
        </button>
      </div>

      {/* Add template modal */}
      {showAdd && (
        <div className="bg-white rounded-xl border border-[#E7E5E4] p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#1B1464]">Add Template</h3>
            <button onClick={() => setShowAdd(false)} className="text-[#A8A29E] hover:text-[#57534E]"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">Template Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., GTM Marketing Deck Template" className="w-full border border-[#E7E5E4] rounded-lg px-3 py-2 text-sm text-[#1B1464] focus:outline-none focus:ring-2 focus:ring-[#FF1493]/20 focus:border-[#FF1493]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full border border-[#E7E5E4] rounded-lg px-3 py-2 text-sm text-[#1B1464] focus:outline-none focus:ring-2 focus:ring-[#FF1493]/20 focus:border-[#FF1493]">
                  {TEMPLATE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#57534E] mb-1">Link / URL *</label>
              <input value={url} onChange={e => setUrl(e.target.value)} placeholder="e.g., Google Drive, Notion, or Canva link" className="w-full border border-[#E7E5E4] rounded-lg px-3 py-2 text-sm text-[#1B1464] focus:outline-none focus:ring-2 focus:ring-[#FF1493]/20 focus:border-[#FF1493]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#57534E] mb-1">Description (optional)</label>
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of when to use this template" className="w-full border border-[#E7E5E4] rounded-lg px-3 py-2 text-sm text-[#1B1464] focus:outline-none focus:ring-2 focus:ring-[#FF1493]/20 focus:border-[#FF1493]" />
            </div>
            <div className="flex justify-end">
              <button onClick={handleAdd} disabled={!name.trim()} className="px-4 py-2 rounded-lg bg-[#FF1493] text-white text-xs font-medium hover:bg-[#D4117D] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template list */}
      {templates.length === 0 && !showAdd ? (
        <div className="bg-white rounded-xl border border-[#E7E5E4] p-12 text-center">
          <FolderOpen className="w-10 h-10 text-[#D6D3D1] mx-auto mb-3" />
          <p className="text-sm text-[#A8A29E] mb-1">No templates yet</p>
          <p className="text-xs text-[#D6D3D1]">Add links to your base templates for decks, briefs, and checklists so the team can easily find them.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => (
            <div key={cat}>
              <h3 className="text-xs font-semibold text-[#78716C] uppercase tracking-wider mb-2">{cat}</h3>
              <div className="space-y-2">
                {items.map(t => (
                  <div key={t.id} className="bg-white rounded-xl border border-[#E7E5E4] p-4 group hover:border-[#D6D3D1] transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${t.url ? 'bg-[#F5F5F4]' : 'bg-[#FFF7ED] border border-[#FDBA74]'}`}>
                        <FileText className={`w-4 h-4 ${t.url ? 'text-[#57534E]' : 'text-[#F97316]'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1B1464]">{t.name}</p>
                        {t.description && <p className="text-xs text-[#A8A29E] mt-0.5 truncate">{t.description}</p>}
                      </div>
                      {t.url ? (
                        <a href={t.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F5F5F4] text-xs font-medium text-[#57534E] hover:bg-[#E7E5E4] transition-colors shrink-0">
                          <Link2 className="w-3 h-3" />
                          Open
                        </a>
                      ) : (
                        <button
                          onClick={() => { setEditingId(t.id); setEditUrl(''); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF1493] text-white text-xs font-medium hover:bg-[#D4117D] transition-colors shrink-0"
                        >
                          <Plus className="w-3 h-3" />
                          Add Link
                        </button>
                      )}
                      {t.url ? (
                        <button
                          onClick={() => {
                            const updated = templates.map(tmpl => tmpl.id === t.id ? { ...tmpl, url: '' } : tmpl);
                            saveTemplates(updated);
                            setTemplates(updated);
                          }}
                          className="p-1.5 rounded-lg text-[#D6D3D1] hover:text-[#EF4444] hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                          title="Remove link"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="p-1.5 rounded-lg text-[#D6D3D1] hover:text-[#EF4444] hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete template"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {editingId === t.id && (
                      <div className="mt-3 flex items-center gap-2 ml-13 pl-13">
                        <input
                          value={editUrl}
                          onChange={e => setEditUrl(e.target.value)}
                          placeholder="Paste Google Drive, Notion, or Canva link..."
                          className="flex-1 border border-[#E7E5E4] rounded-lg px-3 py-2 text-sm text-[#1B1464] focus:outline-none focus:ring-2 focus:ring-[#FF1493]/20 focus:border-[#FF1493]"
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') handleUpdateUrl(t.id); if (e.key === 'Escape') setEditingId(null); }}
                        />
                        <button onClick={() => handleUpdateUrl(t.id)} disabled={!editUrl.trim()} className="px-3 py-2 rounded-lg bg-[#FF1493] text-white text-xs font-medium hover:bg-[#D4117D] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                          Save
                        </button>
                        <button onClick={() => setEditingId(null)} className="px-3 py-2 rounded-lg bg-[#F5F5F4] text-xs font-medium text-[#57534E] hover:bg-[#E7E5E4] transition-colors">
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════

type Tab = 'process' | 'steps' | 'templates';

export default function PlaybookPage() {
  const [tab, setTab] = useState<Tab>('process');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'process', label: 'Process Workflow' },
    { key: 'steps', label: 'Step-by-Step' },
    { key: 'templates', label: 'Templates' },
  ];

  return (
    <div className="p-8 max-w-[1000px]">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1B1464]">GTM Playbook</h1>
        <p className="text-sm text-[#A8A29E] mt-1">
          The standardized GTM process, step-by-step guides, and base templates for every launch.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-[#F5F5F4] rounded-lg p-0.5 mb-6 w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-[12px] font-medium px-4 py-2 rounded-md transition-colors ${
              tab === t.key
                ? 'bg-white text-[#1B1464] shadow-sm'
                : 'text-[#A8A29E] hover:text-[#57534E]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'process' && <ProcessTab />}
      {tab === 'steps' && <StepByStepTab />}
      {tab === 'templates' && <TemplatesTab />}
    </div>
  );
}
