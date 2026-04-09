'use client';

import { Launch, LaunchStrategy } from '@/lib/types';
import { Lightbulb, Users, MessageSquare, Shield, Palette } from 'lucide-react';

interface Props {
  launch: Launch;
  onUpdate: (launch: Launch) => void;
}

export function StrategyTab({ launch, onUpdate }: Props) {
  const s = launch.strategy;

  const updateStrategy = (updates: Partial<LaunchStrategy>) => {
    onUpdate({ ...launch, strategy: { ...s, ...updates } });
  };

  const updateListItem = (field: 'keyMessages' | 'proofPoints', index: number, value: string) => {
    const list = [...s[field]];
    list[index] = value;
    updateStrategy({ [field]: list });
  };

  const addListItem = (field: 'keyMessages' | 'proofPoints') => {
    updateStrategy({ [field]: [...s[field], ''] });
  };

  const removeListItem = (field: 'keyMessages' | 'proofPoints', index: number) => {
    updateStrategy({ [field]: s[field].filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-[#EEF0FF] rounded-xl p-4 border border-[#3538CD]/10">
        <div className="flex items-start gap-2">
          <Lightbulb className="w-4 h-4 text-[#3538CD] mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[#3538CD]">Strategy Builder</p>
            <p className="text-xs text-[#3538CD]/70 mt-0.5">
              Define your positioning, messaging, and proof points. This will inform all channel briefs and creative direction.
            </p>
          </div>
        </div>
      </div>

      {/* Target Audience */}
      <Section
        icon={<Users className="w-4 h-4" />}
        title="Target Audience"
        description="Who is this launch for? Be specific about demographics, psychographics, and buying behavior."
      >
        <textarea
          value={s.targetAudience}
          onChange={e => updateStrategy({ targetAudience: e.target.value })}
          placeholder="e.g., Health-conscious millennial moms (25-40) looking for clean, effective skincare for their children. They read ingredient labels, follow pediatric dermatologists on social, and are willing to pay a premium for safe products."
          rows={3}
          className="w-full px-3 py-2 border border-[#E7E5E4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3538CD]/20 resize-none"
        />
      </Section>

      {/* Key Insight */}
      <Section
        icon={<Lightbulb className="w-4 h-4" />}
        title="Key Consumer Insight"
        description="What tension, unmet need, or truth about the audience does this product solve?"
      >
        <textarea
          value={s.keyInsight}
          onChange={e => updateStrategy({ keyInsight: e.target.value })}
          placeholder="e.g., Parents want to protect their children's skin but feel overwhelmed by conflicting information about which ingredients are truly safe."
          rows={2}
          className="w-full px-3 py-2 border border-[#E7E5E4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3538CD]/20 resize-none"
        />
      </Section>

      {/* Positioning Statement */}
      <Section
        icon={<MessageSquare className="w-4 h-4" />}
        title="Positioning Statement"
        description="For [target audience] who [need/want], [product] is the [category] that [key benefit] because [reason to believe]."
      >
        <textarea
          value={s.positioning}
          onChange={e => updateStrategy({ positioning: e.target.value })}
          placeholder="For [target audience] who [need/want], [product] is the [category] that [key benefit] because [reason to believe]."
          rows={3}
          className="w-full px-3 py-2 border border-[#E7E5E4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3538CD]/20 resize-none"
        />
      </Section>

      {/* Key Messages */}
      <Section
        icon={<MessageSquare className="w-4 h-4" />}
        title="Key Messages"
        description="3-5 core messages that should be consistent across all channels."
      >
        <div className="space-y-2">
          {s.keyMessages.map((msg, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-[#A8A29E] w-5 text-center">{i + 1}</span>
              <input
                type="text"
                value={msg}
                onChange={e => updateListItem('keyMessages', i, e.target.value)}
                placeholder={`Key message ${i + 1}`}
                className="flex-1 px-3 py-2 border border-[#E7E5E4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3538CD]/20"
              />
              {s.keyMessages.length > 1 && (
                <button onClick={() => removeListItem('keyMessages', i)} className="text-xs text-[#D6D3D1] hover:text-[#DC2626]">×</button>
              )}
            </div>
          ))}
          <button onClick={() => addListItem('keyMessages')} className="text-xs text-[#3538CD] hover:underline">+ Add message</button>
        </div>
      </Section>

      {/* Proof Points */}
      <Section
        icon={<Shield className="w-4 h-4" />}
        title="Proof Points"
        description="Clinical results, ingredient callouts, certifications, expert endorsements."
      >
        <div className="space-y-2">
          {s.proofPoints.map((point, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-[#A8A29E]">•</span>
              <input
                type="text"
                value={point}
                onChange={e => updateListItem('proofPoints', i, e.target.value)}
                placeholder="e.g., Dermatologist tested, 98% saw improvement in 4 weeks"
                className="flex-1 px-3 py-2 border border-[#E7E5E4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3538CD]/20"
              />
              {s.proofPoints.length > 1 && (
                <button onClick={() => removeListItem('proofPoints', i)} className="text-xs text-[#D6D3D1] hover:text-[#DC2626]">×</button>
              )}
            </div>
          ))}
          <button onClick={() => addListItem('proofPoints')} className="text-xs text-[#3538CD] hover:underline">+ Add proof point</button>
        </div>
      </Section>

      {/* Competitive Differentiation */}
      <Section
        icon={<Shield className="w-4 h-4" />}
        title="Competitive Differentiation"
        description="How does this product stand apart from competitors?"
      >
        <textarea
          value={s.competitiveDifferentiation}
          onChange={e => updateStrategy({ competitiveDifferentiation: e.target.value })}
          placeholder="What makes this product unique vs. competitors?"
          rows={2}
          className="w-full px-3 py-2 border border-[#E7E5E4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3538CD]/20 resize-none"
        />
      </Section>

      {/* Tone of Voice */}
      <Section
        icon={<Palette className="w-4 h-4" />}
        title="Tone of Voice"
        description="How should this launch feel? What adjectives describe the creative direction?"
      >
        <input
          type="text"
          value={s.toneOfVoice}
          onChange={e => updateStrategy({ toneOfVoice: e.target.value })}
          placeholder="e.g., Warm, expert, reassuring, playful"
          className="w-full px-3 py-2 border border-[#E7E5E4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3538CD]/20"
        />
      </Section>
    </div>
  );
}

function Section({ icon, title, description, children }: {
  icon: React.ReactNode; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#E7E5E4] p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[#3538CD]">{icon}</span>
        <h3 className="text-sm font-semibold text-[#1C1917]">{title}</h3>
      </div>
      <p className="text-xs text-[#A8A29E] mb-3">{description}</p>
      {children}
    </div>
  );
}
