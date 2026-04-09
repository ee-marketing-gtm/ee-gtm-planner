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
    phaseColor: '#3D4EDB',
    phaseBg: '#EEF2FF',
    phaseIcon: <Target className="w-6 h-6" />,
    description: 'Define the strategic foundation — positioning, messaging, creative direction, and copy.',
    totalDuration: '~25 business days',
    checkpoint: 'Positioning, Copy & Creative Direction Locked',
    checkpointDetails: [
      'Product positioning & messaging finalized',
      'Creative shoot plan finalized',
      'Bundle assortment finalized',
      'Final taglines & campaign copy delivered',
      'RSP finalization complete',
    ],
    tasks: [
      { name: 'Product Sheet & Competitive Landscape', owner: 'Marketing', duration: '3 days', icon: <Target className="w-4 h-4" />, description: 'Research competitive landscape and build the product sheet — the starting point for everything downstream.', tips: ['This is the very first task — start date is computed backward from launch', 'Include key differentiators, ingredient story, and claims'] },
      { name: 'Draft Product Positioning & Messaging', owner: 'Marketing', duration: '3 days', icon: <MessageSquare className="w-4 h-4" />, description: 'Develop the core positioning statement, key messages, and messaging hierarchy.', tips: ['Messages should work short (social) and long (email)', 'Align with Product on claims and ingredient story'] },
      { name: 'GTM Brainstorm Meeting', owner: 'Marketing', duration: '3 days', icon: <Users className="w-4 h-4" />, description: 'Cross-functional creative brainstorm to align on positioning, marketing pillars, creative concepts, bundle assortment, and retail channel presence.', tips: ['Don\'t squeeze into another meeting — schedule dedicated time', 'Come with positioning + copy direction finalized'] },
      { name: 'Finalize Positioning, Shoot Plan & Bundles', owner: 'Marketing / Creative / Growth', duration: '3 days', icon: <CheckSquare className="w-4 h-4" />, description: 'Three parallel tracks after brainstorm: finalize product positioning, creative shoot plan, and bundle assortment (requires RSP finalization).' },
      { name: 'Tagline & Campaign Copy Track', owner: 'Marketing / Copywriter', duration: '~23 days', icon: <FileText className="w-4 h-4" />, description: 'Submit copy brief, receive R1 taglines (5 BD), iterate (10 BD), and deliver final taglines & campaign copy.', tips: ['Copy iteration includes back-and-forth with copywriter — plan for 10 BD', 'Final taglines gate the 360 GTM Plan and all design briefs'] },
    ],
  },
  {
    id: 'cross_functional',
    phase: 'Alignment',
    phaseColor: '#9333ea',
    phaseBg: '#F5F3FF',
    phaseIcon: <Users className="w-6 h-6" />,
    description: 'Six parallel cross-functional alignment tracks — all happen simultaneously after brainstorm + positioning.',
    totalDuration: '~3 business days',
    checkpoint: 'All Channel Strategies Aligned',
    checkpointDetails: [
      'Paid influencer strategy aligned',
      'Social strategy aligned',
      'Paid ads strategy aligned',
      'Email plan aligned',
      'Homepage plan aligned',
      'Early access decision made',
    ],
    tasks: [
      { name: 'Align on Paid Influencer Strategy', owner: 'Influencer', duration: '3 days', icon: <Star className="w-4 h-4" />, description: 'Align on paid influencer approach before brief drafting begins.' },
      { name: 'Align on Social Strategy', owner: 'Social', duration: '3 days', icon: <MessageSquare className="w-4 h-4" />, description: 'Align on social strategy before brief drafting begins.' },
      { name: 'Align on Paid Ads Strategy', owner: 'Growth', duration: '3 days', icon: <Zap className="w-4 h-4" />, description: 'Align on paid ads approach and budget allocation.' },
      { name: 'Align on Email Plan', owner: 'Growth', duration: '3 days', icon: <FileText className="w-4 h-4" />, description: 'Align on email campaign plan and cadence.' },
      { name: 'Align on Homepage Plan', owner: 'Growth / Creative', duration: '3 days', icon: <Monitor className="w-4 h-4" />, description: 'Align on homepage hero, modules, and banner plan.' },
      { name: 'Align on Early Access Decision', owner: 'Growth', duration: '3 days', icon: <Lock className="w-4 h-4" />, description: 'Decide if launch includes an early access window.' },
    ],
  },
  {
    id: 'finalize_strategies',
    phase: 'Strategies',
    phaseColor: '#22c55e',
    phaseBg: '#F0FDF4',
    phaseIcon: <Presentation className="w-6 h-6" />,
    description: 'Finalize channel strategies, build the 360 GTM plan, and create the final GTM deck.',
    totalDuration: '~18 business days',
    checkpoint: '360 GTM Plan & Final Deck Complete',
    checkpointDetails: [
      'Email strategy finalized',
      'Social strategy finalized',
      'Influencer strategy finalized & creator sourcing started',
      '360 GTM Plan & Retail Channels approved (requires ALL alignment + strategies + taglines)',
      'Final GTM Deck presented',
    ],
    tasks: [
      { name: 'Finalize Email Strategy', owner: 'Growth', duration: '3 days', icon: <FileText className="w-4 h-4" />, description: 'Finalize email strategy after email plan alignment.' },
      { name: 'Finalize Social Strategy', owner: 'Social', duration: '5 days', icon: <MessageSquare className="w-4 h-4" />, description: 'Finalize social strategy after social alignment.' },
      { name: 'Finalize Influencer Strategy & Start Sourcing', owner: 'Influencer', duration: '15 days', icon: <Star className="w-4 h-4" />, description: 'Finalize influencer strategy and begin sourcing creators ahead of creator review meeting.', tips: ['This is the longest task in this phase — start early', 'Creator sourcing feeds into the Creator Review Meeting in Content Production'] },
      { name: 'Finalize 360 GTM Plan & Retail Channels', owner: 'Leadership', duration: '3 days', icon: <ShieldCheck className="w-4 h-4" />, description: 'Requires ALL alignment outcomes, finalized strategies, and final taglines. This is the big convergence point.', tips: ['Cannot start until every alignment and strategy task is done', 'This gates ALL design briefs downstream'] },
      { name: 'Final GTM Deck', owner: 'Marketing', duration: '3 days', icon: <Presentation className="w-4 h-4" />, description: 'Build the presentation deck from the 360 plan — the GTM source of truth.', tips: ['Include the "why" behind each channel choice', 'Send to leadership in advance for review'] },
    ],
  },
  {
    id: 'content_production',
    phase: 'Content Production',
    phaseColor: '#f97316',
    phaseBg: '#FFF7ED',
    phaseIcon: <Camera className="w-6 h-6" />,
    description: 'Shoots, photo selects, and creator content — two parallel tracks (photography + creators).',
    totalDuration: '~30 business days',
    checkpoint: 'Photo Selects & Creator Content Delivered',
    checkpointDetails: [
      'Lifestyle & product photo selects ready (feed into R1 assets)',
      'Creator content delivered (~1 week before D2C launch)',
      'Packaging samples received for photoshoot',
      'Finished goods available for creator seeding',
    ],
    tasks: [
      { name: 'Draft & Finalize Shoot Plan', owner: 'Marketing / Creative', duration: '8 days', icon: <FileText className="w-4 h-4" />, description: 'Draft the shoot & content capture plan (3 BD), then finalize it once positioning is locked (5 BD).', tips: ['Use the standardized Asset Form template', 'Requires finalized positioning before the plan can be finalized'] },
      { name: 'Lifestyle & Product Shoots', owner: 'Creative', duration: '5 days each', icon: <Camera className="w-4 h-4" />, description: 'Lifestyle and product shoots run in parallel. Both need packaging samples (not finished goods).', tips: ['Marketing should attend for real-time alignment', 'Capture BTS content for social while you have the setup'] },
      { name: 'Photo Selects & Retouching', owner: 'Creative', duration: '10 days each', icon: <Scissors className="w-4 h-4" />, description: 'Lifestyle and product photo selects and retouching (~2 weeks each). These feed directly into R1 Assets.', tips: ['Build in one round of revisions — plan for it', 'Confirm all tech specs with Digital/Ops before handoff'] },
      { name: 'Creator Review Meeting', owner: 'Influencer', duration: '3 days', icon: <Users className="w-4 h-4" />, description: 'Review shortlisted creators, confirm tiers & budget, align on content deliverables.' },
      { name: 'Briefs to Creators', owner: 'Influencer', duration: '5 days', icon: <FileText className="w-4 h-4" />, description: 'Send briefs to confirmed creators. Requires both confirmed creator list AND finished good marketing units.', tips: ['Cannot start until finished goods are available for shipping'] },
      { name: 'Creator Content Delivered', owner: 'Influencer', duration: '15 days', icon: <Star className="w-4 h-4" />, description: 'Creators produce and deliver content. Must arrive ~1 week (5 BD) before D2C launch.' },
    ],
  },
  {
    id: 'design_briefs',
    phase: 'Design Briefs',
    phaseColor: '#e85d04',
    phaseBg: '#FFF7ED',
    phaseIcon: <FileText className="w-6 h-6" />,
    description: 'Draft all design briefs — 9 briefs across product and bundle, all in parallel.',
    totalDuration: '~5 business days',
    checkpoint: 'All Draft Design Briefs Submitted',
    checkpointDetails: [
      'PDP Gallery, Sephora/Amazon Gallery, Amazon A+ briefs drafted',
      'Email, Social, Homepage briefs drafted',
      'Bundle PDP Copy, Bundle PDP Gallery, Bundle Sephora/Amazon Gallery briefs drafted',
    ],
    tasks: [
      { name: 'Draft PDP Gallery Asset Brief', owner: 'Marketing', duration: '5 days', icon: <FileText className="w-4 h-4" />, description: 'Product PDP gallery images brief. Requires final taglines, 360 GTM plan, and bundle assortment.' },
      { name: 'Draft Sephora/Amazon Gallery Asset Brief', owner: 'Marketing', duration: '5 days', icon: <FileText className="w-4 h-4" />, description: 'Sephora and Amazon gallery asset brief (if different from DTC PDP assets).' },
      { name: 'Draft Amazon A+ Content Brief', owner: 'Marketing', duration: '5 days', icon: <FileText className="w-4 h-4" />, description: 'Amazon A+ enhanced content brief.' },
      { name: 'Draft Email, Social & Homepage Briefs', owner: 'Marketing / Social', duration: '3-4 days', icon: <MessageSquare className="w-4 h-4" />, description: 'Email brief (3 BD), Social creative brief (4 BD), and Homepage asset brief (3 BD) — all in parallel.' },
      { name: 'Draft Bundle Briefs (PDP Copy, Gallery, Sephora/Amazon)', owner: 'Marketing', duration: '3-5 days', icon: <Package className="w-4 h-4" />, description: 'Bundle PDP copy brief (3 BD), Bundle PDP gallery (5 BD), and Bundle Sephora/Amazon gallery (5 BD) — all in parallel.' },
    ],
  },
  {
    id: 'design_production',
    phase: 'Asset Production',
    phaseColor: '#EC4899',
    phaseBg: '#FDF2F8',
    phaseIcon: <PenTool className="w-6 h-6" />,
    description: 'Align on briefs, produce R1 assets, iterate feedback, and deliver final assets per channel.',
    totalDuration: '~25 business days',
    checkpoint: 'All Final Assets Delivered — Ready to Launch',
    checkpointDetails: [
      'Brief Alignment Meeting completed (all briefs + all alignments reviewed)',
      'R1 Assets delivered and feedback incorporated',
      'Sephora final assets submitted (10 weeks before Sephora launch)',
      'DTC & Amazon final assets delivered (3 weeks before D2C launch)',
      'Final PDP copy & reviews complete (2 weeks before D2C launch)',
      'Social campaign started (1 week before D2C launch)',
    ],
    tasks: [
      { name: 'Brief Alignment Meeting', owner: 'Marketing', duration: '3 days', icon: <Users className="w-4 h-4" />, description: 'Review ALL draft briefs (product + bundle) and ALL cross-functional alignments. Align on creative direction, asset specs, and timeline.', tips: ['All 9 draft briefs and all 6 alignment outcomes must be complete before this meeting', 'This is the single biggest convergence point for design production'] },
      { name: 'Final Asset Design Briefs & PDP Copy Brief', owner: 'Marketing', duration: '2-3 days', icon: <FileText className="w-4 h-4" />, description: 'Finalize design briefs incorporating alignment meeting feedback (2 BD). Draft PDP copy brief (3 BD, requires legal review).' },
      { name: 'R1 Assets Due', owner: 'Creative', duration: '10 days', icon: <Palette className="w-4 h-4" />, description: 'First round of all design assets (email, social, PDP, homepage, Amazon A+). Requires finalized briefs AND photo selects.', tips: ['~2 weeks for creative production', 'Cannot start until both final briefs and photo selects are ready'] },
      { name: 'Asset Feedback & Final Delivery', owner: 'Marketing / Creative', duration: '3-5 days', icon: <Eye className="w-4 h-4" />, description: 'Feedback on R1 assets (3 BD), then final assets for Sephora (5 BD) and DTC/Amazon (5 BD).' },
      { name: 'Social Campaign Start & Launch', owner: 'Social / Marketing', duration: 'Launch', icon: <Rocket className="w-4 h-4" />, description: 'Social campaign starts 5 BD before D2C launch. D2C launches first, Sephora follows ~4 weeks later.', tips: ['Have a launch day checklist — verify every channel is live and correct', 'Schedule a post-launch debrief for 2-4 weeks after launch'] },
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
            <span className="text-xs text-[#57534E]">Total timeline: <strong>~106 business days (21 weeks)</strong> for full production launches</span>
          </div>
          <div className="flex mt-2 rounded-full overflow-hidden h-2">
            <div className="h-full" style={{ width: '24%', background: '#3D4EDB' }} />
            <div className="h-full" style={{ width: '3%', background: '#9333ea' }} />
            <div className="h-full" style={{ width: '17%', background: '#22c55e' }} />
            <div className="h-full" style={{ width: '28%', background: '#f97316' }} />
            <div className="h-full" style={{ width: '5%', background: '#e85d04' }} />
            <div className="h-full" style={{ width: '23%', background: '#EC4899' }} />
          </div>
          <div className="flex mt-1">
            <span className="text-[9px] text-[#3D4EDB]" style={{ width: '24%' }}>25d</span>
            <span className="text-[9px] text-[#9333ea]" style={{ width: '3%' }}>3d</span>
            <span className="text-[9px] text-[#22c55e]" style={{ width: '17%' }}>18d</span>
            <span className="text-[9px] text-[#f97316]" style={{ width: '28%' }}>30d</span>
            <span className="text-[9px] text-[#e85d04]" style={{ width: '5%' }}>5d</span>
            <span className="text-[9px] text-[#EC4899]" style={{ width: '23%' }}>25d</span>
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
            { type: 'Full Production', subtitle: 'With Tech', phases: ['Content Planning', 'Alignment', 'Strategies', 'Content Production', 'Design Briefs', 'Asset Production'], duration: '~106 days', example: 'SPF 50 Launch, Kids Hair Launch', colors: ['#3D4EDB', '#9333ea', '#22c55e', '#f97316', '#e85d04', '#EC4899'] },
            { type: 'No Content Production', subtitle: 'Campaign / Moment', phases: ['Content Planning', 'Alignment', 'Strategies', 'Design Briefs', 'Asset Production'], duration: '~76 days', example: "Mother's Day, Memorial Day Sale", colors: ['#3D4EDB', '#9333ea', '#22c55e', '#e85d04', '#EC4899'] },
            { type: 'Content Prod (No Tech)', subtitle: 'No landing page needed', phases: ['Content Planning', 'Alignment', 'Strategies', 'Content Prod*', 'Design Briefs', 'Asset Production'], duration: '~96 days', example: 'Product extension, restock campaign', colors: ['#3D4EDB', '#9333ea', '#22c55e', '#f97316', '#e85d04', '#EC4899'] },
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
  // ── Content Planning ──
  { name: 'Product Sheet & Competitive Landscape', phase: 'Content Planning', owner: 'Marketing', duration: '3 business days', description: 'Research the competitive landscape and build the product sheet — the starting point for positioning and messaging.', keyDeliverables: ['Competitive landscape analysis', 'Product sheet with key claims', 'Ingredient story and differentiators'], bestPractices: ['This is the very first task — start date is computed backward from launch', 'Include key differentiators, ingredient story, and claims'] },
  { name: 'Draft Product Positioning & Messaging', phase: 'Content Planning', owner: 'Marketing', duration: '3 business days', description: 'Develop the core positioning statement, key messages, and messaging hierarchy based on the product sheet.', keyDeliverables: ['Positioning statement', 'Key messages (3-5)', 'Messaging hierarchy'], bestPractices: ['Messages should work short (social) and long (email)', 'Align with Product on claims and ingredient story'] },
  { name: 'GTM Brainstorm Meeting', phase: 'Content Planning', owner: 'Marketing', duration: '3 business days', description: 'Cross-functional brainstorm to align on positioning, marketing pillars, creative concepts, bundle assortment, and retail channel presence.', keyDeliverables: ['Aligned positioning & marketing pillars', 'Creative concept directions', 'Bundle assortment direction', 'Retail channel presence plan'], bestPractices: ['Schedule as a dedicated session — don\'t squeeze into another meeting', 'Come with positioning + messaging drafted', 'Invite: Marketing, Creative, Growth, Channel Leads'], prerequisite: 'Draft Product Positioning & Messaging must be complete' },
  { name: 'Finalize Positioning, Shoot Plan & Bundles', phase: 'Content Planning', owner: 'Marketing / Creative / Growth', duration: '3 business days', description: 'Three parallel tracks after brainstorm: finalize product positioning & messaging, creative shoot plan, and bundle assortment (requires RSP finalization).', keyDeliverables: ['Finalized product positioning & messaging', 'Finalized creative shoot plan', 'Finalized bundle assortment'], bestPractices: ['Bundle assortment requires RSP finalization (final COGS from Operations)', 'These three tracks run in parallel — coordinate to keep them aligned'] },
  { name: 'Tagline & Campaign Copy', phase: 'Content Planning', owner: 'Marketing / Copywriter', duration: '23 business days', description: 'Full copy track: submit brief (3 BD), receive R1 taglines (5 BD), iterate with copywriter (10 BD), deliver final taglines & campaign copy (5 BD).', keyDeliverables: ['Tagline + campaign copy brief', 'R1 taglines', 'Final taglines & campaign copy'], bestPractices: ['Copy iteration includes back-and-forth with copywriter — plan for 10 BD', 'Final taglines gate the 360 GTM Plan and all design briefs', 'Start the brief as soon as positioning is finalized'] },

  // ── Alignment ──
  { name: 'Cross-Functional Alignment (6 parallel tracks)', phase: 'Alignment', owner: 'Influencer / Social / Growth', duration: '3 business days', description: 'Six alignment tracks run simultaneously after brainstorm + positioning: Paid Influencer, Social, Paid Ads, Email, Homepage, and Early Access.', keyDeliverables: ['Paid influencer strategy aligned', 'Social strategy aligned', 'Paid ads strategy aligned', 'Email plan aligned', 'Homepage plan aligned', 'Early access decision made'], bestPractices: ['All six tracks are 3 BD and run in parallel — total phase is only 3 BD', 'Must align before strategy finalization and brief drafting begins', 'Each alignment feeds into its corresponding finalize step'], prerequisite: 'GTM Brainstorm Meeting and Finalize Product Positioning & Messaging must be complete' },

  // ── Strategies ──
  { name: 'Finalize Channel Strategies', phase: 'Strategies', owner: 'Growth / Social / Influencer', duration: '3-15 business days', description: 'Finalize email strategy (3 BD), social strategy (5 BD), and influencer strategy + start sourcing creators (15 BD) — all after their respective alignments.', keyDeliverables: ['Finalized email strategy', 'Finalized social strategy', 'Finalized influencer strategy', 'Creator sourcing started'], bestPractices: ['Influencer strategy + sourcing is the longest at 15 BD — start early', 'Creator sourcing feeds into the Creator Review Meeting in Content Production'] },
  { name: 'Finalize 360 GTM Plan & Retail Channels', phase: 'Strategies', owner: 'Leadership', duration: '3 business days', description: 'The big convergence point: requires ALL alignment outcomes, ALL finalized strategies, and final taglines/copy before it can start.', keyDeliverables: ['Approved 360 GTM Plan', 'Retail channel decisions', 'Go/no-go on each channel'], bestPractices: ['Cannot start until every alignment, strategy, and copy task is done', 'This gates ALL design briefs downstream — delays here cascade everywhere'], prerequisite: 'All alignment tasks, all finalized strategies, and final taglines must be complete' },
  { name: 'Final GTM Deck', phase: 'Strategies', owner: 'Marketing', duration: '3 business days', description: 'Build the final GTM presentation deck — the single source of truth for the launch.', keyDeliverables: ['Final GTM deck with strategy, channels, budget, timeline', 'Launch timeline'], bestPractices: ['Include the "why" behind each channel choice', 'Send to leadership in advance for review', 'This deck becomes the GTM bible — make it comprehensive'] },

  // ── Content Production ──
  { name: 'Draft & Finalize Shoot Plan', phase: 'Content Production', owner: 'Marketing / Creative', duration: '8 business days', description: 'Draft the shoot & content capture plan (3 BD after brainstorm), then finalize once positioning is locked (5 BD).', keyDeliverables: ['Shoot & content capture plan', 'Shot list', 'Content capture requirements by channel'], bestPractices: ['Use the standardized Asset Form template', 'Requires finalized positioning before the plan can be finalized'] },
  { name: 'Lifestyle & Product Shoots', phase: 'Content Production', owner: 'Creative', duration: '5 business days each', description: 'Lifestyle and product shoots run in parallel. Both need packaging samples and finalized shoot plan.', keyDeliverables: ['Lifestyle photography', 'Product photography', 'BTS content for social'], bestPractices: ['Marketing should attend for real-time alignment', 'Capture BTS content for social while you have the setup', 'Need packaging samples — NOT finished goods'] },
  { name: 'Photo Selects & Retouching', phase: 'Content Production', owner: 'Creative', duration: '10 business days each', description: 'Lifestyle and product photo selects and retouching (~2 weeks each). These feed directly into R1 Assets in Asset Production.', keyDeliverables: ['Retouched lifestyle photos', 'Retouched product photos', 'All file formats per channel specs'], bestPractices: ['Build in one round of revisions — plan for it', 'Photo selects gate R1 Assets — delays here cascade into Asset Production'] },
  { name: 'Creator Track', phase: 'Content Production', owner: 'Influencer', duration: '23 business days', description: 'Creator Review Meeting (3 BD) after influencer sourcing, then briefs to creators (5 BD, needs finished goods), then creator content delivered (15 BD).', keyDeliverables: ['Confirmed creator list', 'Creator briefs sent', 'Creator content delivered'], bestPractices: ['Cannot send briefs until finished goods marketing units are available', 'Creator content must arrive ~1 week (5 BD) before D2C launch'] },

  // ── Design Briefs ──
  { name: 'Draft All Design Briefs', phase: 'Design Briefs', owner: 'Marketing / Social', duration: '3-5 business days', description: 'Draft 9 design briefs in parallel: PDP Gallery (5 BD), Sephora/Amazon Gallery (5 BD), Amazon A+ (5 BD), Email (3 BD), Social (4 BD), Homepage (3 BD), Bundle PDP Copy (3 BD), Bundle PDP Gallery (5 BD), Bundle Sephora/Amazon Gallery (5 BD).', keyDeliverables: ['PDP Gallery Asset Brief', 'Sephora/Amazon Gallery Asset Brief', 'Amazon A+ Content Brief', 'Email Brief', 'Social Creative Brief', 'Homepage Asset Brief', 'Bundle PDP Copy Brief', 'Bundle PDP Gallery Asset Brief', 'Bundle Sephora/Amazon Gallery Asset Brief'], bestPractices: ['All 9 briefs run in parallel — coordinate across owners', 'Most briefs require final taglines, 360 GTM plan, and/or bundle assortment', 'All briefs feed into the Brief Alignment Meeting'], prerequisite: 'Final Taglines, 360 GTM Plan, and Finalize Bundle Assortment must be complete' },

  // ── Asset Production ──
  { name: 'Brief Alignment Meeting', phase: 'Asset Production', owner: 'Marketing', duration: '3 business days', description: 'Review ALL draft briefs (product + bundle) and ALL cross-functional alignment outcomes. Align on creative direction, asset specs, dimensions, and timeline.', keyDeliverables: ['Aligned creative direction across channels', 'Confirmed asset specs & dimensions', 'Timeline for R1 assets & feedback'], bestPractices: ['All 9 draft briefs and all 6 alignment outcomes must be complete', 'This is the single biggest convergence point for design production', 'Schedule as a dedicated session'], prerequisite: 'All 9 draft design briefs and all 6 cross-functional alignments must be complete' },
  { name: 'Final Briefs & R1 Assets', phase: 'Asset Production', owner: 'Marketing / Creative', duration: '12 business days', description: 'Finalize design briefs (2 BD), draft PDP copy brief (3 BD, needs legal review), then produce R1 assets for email, social, PDP, homepage, and Amazon A+ (~10 BD). R1 assets require finalized briefs AND photo selects.', keyDeliverables: ['Final asset design briefs', 'PDP copy brief (with legal review)', 'R1 assets (email, social, PDP, homepage, Amazon A+)'], bestPractices: ['R1 assets take ~2 weeks for creative production', 'Cannot start until both final briefs and photo selects are ready'] },
  { name: 'Asset Feedback & Final Delivery', phase: 'Asset Production', owner: 'Marketing / Creative', duration: '8 business days', description: 'Asset feedback (3 BD), then parallel final delivery: Sephora final assets (5 BD, due 10 weeks before Sephora launch), DTC & Amazon final assets (5 BD, due 3 weeks before D2C launch), final PDP copy (5 BD, due 2 weeks before D2C launch).', keyDeliverables: ['Sephora final assets submitted', 'DTC & Amazon final assets delivered', 'Final PDP copy & reviews complete', 'Social assets ready'], bestPractices: ['Sephora assets due 50 BD (10 weeks) before Sephora launch — plan for this deadline early', 'DTC assets due 15 BD (3 weeks) before D2C launch'] },
  { name: 'Launch!', phase: 'Asset Production', owner: 'Marketing', duration: 'Launch day', description: 'Social campaign starts 5 BD before D2C launch. D2C launches first, Sephora follows approximately 4 weeks later (default).', keyDeliverables: ['Social campaign live', 'D2C launch complete', 'Sephora launch complete'], bestPractices: ['Have a launch day checklist — verify every channel is live and correct', 'Monitor first 24-48 hours closely for any issues', 'Schedule a post-launch debrief 2-4 weeks after launch'] },
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
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedType === opt.key ? 'bg-[#3538CD] text-white' : 'bg-[#F5F5F4] text-[#57534E] hover:bg-[#E7E5E4]'}`}>
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
                      <h4 className="text-xs font-semibold text-[#1B1464] mb-2 flex items-center gap-1.5"><CheckSquare className="w-3.5 h-3.5 text-[#3538CD]" /> Key Deliverables</h4>
                      <ul className="space-y-1">
                        {step.keyDeliverables.map((d, j) => (
                          <li key={j} className="text-xs text-[#57534E] flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-[#3538CD]" /> {d}</li>
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
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3538CD] text-white text-xs font-medium hover:bg-[#2D31B3] transition-colors shrink-0 ml-4"
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
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., GTM Marketing Deck Template" className="w-full border border-[#E7E5E4] rounded-lg px-3 py-2 text-sm text-[#1B1464] focus:outline-none focus:ring-2 focus:ring-[#3538CD]/20 focus:border-[#3538CD]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full border border-[#E7E5E4] rounded-lg px-3 py-2 text-sm text-[#1B1464] focus:outline-none focus:ring-2 focus:ring-[#3538CD]/20 focus:border-[#3538CD]">
                  {TEMPLATE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#57534E] mb-1">Link / URL *</label>
              <input value={url} onChange={e => setUrl(e.target.value)} placeholder="e.g., Google Drive, Notion, or Canva link" className="w-full border border-[#E7E5E4] rounded-lg px-3 py-2 text-sm text-[#1B1464] focus:outline-none focus:ring-2 focus:ring-[#3538CD]/20 focus:border-[#3538CD]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#57534E] mb-1">Description (optional)</label>
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of when to use this template" className="w-full border border-[#E7E5E4] rounded-lg px-3 py-2 text-sm text-[#1B1464] focus:outline-none focus:ring-2 focus:ring-[#3538CD]/20 focus:border-[#3538CD]" />
            </div>
            <div className="flex justify-end">
              <button onClick={handleAdd} disabled={!name.trim()} className="px-4 py-2 rounded-lg bg-[#3538CD] text-white text-xs font-medium hover:bg-[#2D31B3] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
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
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3538CD] text-white text-xs font-medium hover:bg-[#2D31B3] transition-colors shrink-0"
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
                          className="flex-1 border border-[#E7E5E4] rounded-lg px-3 py-2 text-sm text-[#1B1464] focus:outline-none focus:ring-2 focus:ring-[#3538CD]/20 focus:border-[#3538CD]"
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') handleUpdateUrl(t.id); if (e.key === 'Escape') setEditingId(null); }}
                        />
                        <button onClick={() => handleUpdateUrl(t.id)} disabled={!editUrl.trim()} className="px-3 py-2 rounded-lg bg-[#3538CD] text-white text-xs font-medium hover:bg-[#2D31B3] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
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
