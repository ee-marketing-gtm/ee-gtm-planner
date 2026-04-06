'use client';

import { useState } from 'react';
import { Launch, ChannelPlan, MarketingPlan360, Owner, OWNER_LABELS, OWNER_COLORS, TaskStatus } from '@/lib/types';
import { CHANNEL_PLAN_SECTIONS } from '@/lib/templates';
import { Target, ChevronDown, ChevronRight, Plus, Trash2, DollarSign } from 'lucide-react';

interface Props {
  launch: Launch;
  onUpdate: (launch: Launch) => void;
}

type SectionKey = keyof Pick<MarketingPlan360, 'paidMedia' | 'influencer' | 'owned' | 'retail' | 'pr' | 'events'>;

export function MarketingPlanTab({ launch, onUpdate }: Props) {
  const plan = launch.marketingPlan;
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['paidMedia', 'influencer', 'owned']));

  const updatePlan = (updates: Partial<MarketingPlan360>) => {
    onUpdate({ ...launch, marketingPlan: { ...plan, ...updates } });
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const updateChannel = (sectionKey: SectionKey, index: number, updates: Partial<ChannelPlan>) => {
    const section = [...plan[sectionKey]];
    section[index] = { ...section[index], ...updates };
    updatePlan({ [sectionKey]: section });
  };

  const addChannel = (sectionKey: SectionKey) => {
    const newChannel: ChannelPlan = {
      channel: '', tactic: '', timing: '', budget: null,
      kpiTarget: '', status: 'not_started', owner: 'marketing', notes: '',
    };
    updatePlan({ [sectionKey]: [...plan[sectionKey], newChannel] });
  };

  const removeChannel = (sectionKey: SectionKey, index: number) => {
    updatePlan({ [sectionKey]: plan[sectionKey].filter((_, i) => i !== index) });
  };

  const totalBudget = ['paidMedia', 'influencer', 'owned', 'retail', 'pr', 'events'].reduce((sum, key) => {
    return sum + (plan[key as SectionKey] || []).reduce((s: number, c: ChannelPlan) => s + (c.budget || 0), 0);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#FFF0F7] rounded-xl p-4 border border-[#FF1493]/10">
        <div className="flex items-start gap-2">
          <Target className="w-4 h-4 text-[#FF1493] mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[#FF1493]">360 Marketing Plan</p>
            <p className="text-xs text-[#FF1493]/70 mt-0.5">
              Build your full-funnel marketing plan. Define tactics, timing, budget, and KPIs for every channel.
            </p>
          </div>
        </div>
      </div>

      {/* Objectives */}
      <div className="bg-white rounded-xl border border-[#E7E5E4] p-5">
        <h3 className="text-sm font-semibold text-[#1C1917] mb-3">Launch Objectives</h3>
        <div className="space-y-2">
          {plan.objectives.map((obj, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-[#A8A29E] w-5 text-center">{i + 1}</span>
              <input
                type="text"
                value={obj}
                onChange={e => {
                  const list = [...plan.objectives];
                  list[i] = e.target.value;
                  updatePlan({ objectives: list });
                }}
                placeholder="e.g., Drive 500 units in first 30 days"
                className="flex-1 px-3 py-2 border border-[#E7E5E4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF1493]/20"
              />
              {plan.objectives.length > 1 && (
                <button onClick={() => updatePlan({ objectives: plan.objectives.filter((_, j) => j !== i) })} className="text-xs text-[#D6D3D1] hover:text-[#DC2626]">×</button>
              )}
            </div>
          ))}
          <button onClick={() => updatePlan({ objectives: [...plan.objectives, ''] })} className="text-xs text-[#FF1493] hover:underline">+ Add objective</button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="bg-white rounded-xl border border-[#E7E5E4] p-5">
        <h3 className="text-sm font-semibold text-[#1C1917] mb-3">Key Metrics</h3>
        <div className="space-y-2">
          {plan.keyMetrics.map((m, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <input
                type="text"
                value={m.metric}
                onChange={e => {
                  const list = [...plan.keyMetrics];
                  list[i] = { ...list[i], metric: e.target.value };
                  updatePlan({ keyMetrics: list });
                }}
                placeholder="Metric (e.g., Revenue)"
                className="px-3 py-2 border border-[#E7E5E4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF1493]/20"
              />
              <input
                type="text"
                value={m.target}
                onChange={e => {
                  const list = [...plan.keyMetrics];
                  list[i] = { ...list[i], target: e.target.value };
                  updatePlan({ keyMetrics: list });
                }}
                placeholder="Target (e.g., $50K first month)"
                className="px-3 py-2 border border-[#E7E5E4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF1493]/20"
              />
              {plan.keyMetrics.length > 1 && (
                <button onClick={() => updatePlan({ keyMetrics: plan.keyMetrics.filter((_, j) => j !== i) })} className="text-xs text-[#D6D3D1] hover:text-[#DC2626] px-1">×</button>
              )}
            </div>
          ))}
          <button onClick={() => updatePlan({ keyMetrics: [...plan.keyMetrics, { metric: '', target: '' }] })} className="text-xs text-[#FF1493] hover:underline">+ Add metric</button>
        </div>
      </div>

      {/* Budget Summary */}
      <div className="bg-white rounded-xl border border-[#E7E5E4] p-5">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="w-4 h-4 text-[#FF1493]" />
          <h3 className="text-sm font-semibold text-[#1C1917]">Budget Summary</h3>
        </div>
        <p className="text-2xl font-bold text-[#1C1917]">
          ${totalBudget.toLocaleString()}
        </p>
        <p className="text-xs text-[#A8A29E]">Total across all channels</p>
      </div>

      {/* Channel Sections */}
      {CHANNEL_PLAN_SECTIONS.map(section => {
        const sectionKey = section.key as SectionKey;
        const channels = plan[sectionKey] || [];
        const isExpanded = expandedSections.has(sectionKey);
        const sectionBudget = channels.reduce((s, c) => s + (c.budget || 0), 0);

        return (
          <div key={sectionKey} className="bg-white rounded-xl border border-[#E7E5E4] overflow-hidden">
            <button
              onClick={() => toggleSection(sectionKey)}
              className="w-full flex items-center justify-between p-4 hover:bg-[#FAFAF9] transition-colors"
            >
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[#1C1917]">{section.label}</h3>
                <span className="text-xs text-[#A8A29E]">{channels.length} channels</span>
                {sectionBudget > 0 && (
                  <span className="text-xs text-[#FF1493] font-medium">${sectionBudget.toLocaleString()}</span>
                )}
              </div>
              {isExpanded ? <ChevronDown className="w-4 h-4 text-[#A8A29E]" /> : <ChevronRight className="w-4 h-4 text-[#A8A29E]" />}
            </button>

            {isExpanded && (
              <div className="border-t border-[#E7E5E4]">
                {channels.length > 0 && (
                  <div className="grid grid-cols-[150px_1fr_100px_100px_100px_120px_40px] gap-2 px-4 py-2 bg-[#FAFAF9] text-[11px] font-medium text-[#A8A29E] uppercase tracking-wider">
                    <span>Channel</span>
                    <span>Tactic</span>
                    <span>Timing</span>
                    <span>Budget</span>
                    <span>KPI Target</span>
                    <span>Owner</span>
                    <span />
                  </div>
                )}
                {channels.map((channel, i) => (
                  <div key={i} className="grid grid-cols-[150px_1fr_100px_100px_100px_120px_40px] gap-2 px-4 py-2 border-t border-[#E7E5E4] items-center">
                    <input
                      type="text"
                      value={channel.channel}
                      onChange={e => updateChannel(sectionKey, i, { channel: e.target.value })}
                      placeholder="Channel"
                      className="px-2 py-1.5 border border-[#E7E5E4] rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#FF1493]/20"
                    />
                    <input
                      type="text"
                      value={channel.tactic}
                      onChange={e => updateChannel(sectionKey, i, { tactic: e.target.value })}
                      placeholder="Tactic details"
                      className="px-2 py-1.5 border border-[#E7E5E4] rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#FF1493]/20"
                    />
                    <input
                      type="text"
                      value={channel.timing}
                      onChange={e => updateChannel(sectionKey, i, { timing: e.target.value })}
                      placeholder="Timing"
                      className="px-2 py-1.5 border border-[#E7E5E4] rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#FF1493]/20"
                    />
                    <input
                      type="number"
                      value={channel.budget ?? ''}
                      onChange={e => updateChannel(sectionKey, i, { budget: e.target.value ? Number(e.target.value) : null })}
                      placeholder="$0"
                      className="px-2 py-1.5 border border-[#E7E5E4] rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#FF1493]/20"
                    />
                    <input
                      type="text"
                      value={channel.kpiTarget}
                      onChange={e => updateChannel(sectionKey, i, { kpiTarget: e.target.value })}
                      placeholder="Target"
                      className="px-2 py-1.5 border border-[#E7E5E4] rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#FF1493]/20"
                    />
                    <select
                      value={channel.owner}
                      onChange={e => updateChannel(sectionKey, i, { owner: e.target.value as Owner })}
                      className="px-2 py-1.5 border border-[#E7E5E4] rounded text-xs focus:outline-none"
                    >
                      {Object.entries(OWNER_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <button onClick={() => removeChannel(sectionKey, i)} className="text-[#D6D3D1] hover:text-[#DC2626]">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <div className="px-4 py-3 border-t border-[#E7E5E4]">
                  <button onClick={() => addChannel(sectionKey)} className="flex items-center gap-1.5 text-xs text-[#FF1493] hover:underline">
                    <Plus className="w-3 h-3" /> Add channel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
