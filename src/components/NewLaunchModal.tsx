'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuid } from 'uuid';
import { X, Plus, Lock } from 'lucide-react';
import { Launch, LaunchType, LaunchTier, ContentProductionType, ExternalAnchorConfig, LAUNCH_TYPE_LABELS, TIER_CONFIG } from '@/lib/types';
import { getDefaultStrategy, getDefaultMarketingPlan } from '@/lib/templates';
import { scheduleLaunch } from '@/lib/scheduler';
import { scheduledTasksToGTMTasks } from '@/lib/scheduler-bridge';
import { useData } from '@/components/DataProvider';

interface Props {
  onClose: () => void;
}

export function NewLaunchModal({ onClose }: Props) {
  const router = useRouter();
  const { saveLaunch } = useData();
  const [name, setName] = useState('');
  const [launchDate, setLaunchDate] = useState('');
  const [sephoraLaunchDate, setSephoraLaunchDate] = useState('');
  const [amazonLaunchDate, setAmazonLaunchDate] = useState('');
  const [launchType, setLaunchType] = useState<LaunchType>('new_product');
  const [tier, setTier] = useState<LaunchTier>('A');
  const [contentProductionType, setContentProductionType] = useState<ContentProductionType>('with_tech');
  const [productCategory, setProductCategory] = useState('');
  const [description, setDescription] = useState('');

  // External partner anchors
  const [anchors, setAnchors] = useState<ExternalAnchorConfig[]>([]);
  const [newAnchorTask, setNewAnchorTask] = useState('');
  const [newAnchorDate, setNewAnchorDate] = useState('');
  const [newAnchorPartner, setNewAnchorPartner] = useState('');

  const addAnchor = () => {
    if (newAnchorTask && newAnchorDate && newAnchorPartner) {
      setAnchors([...anchors, { taskName: newAnchorTask, date: newAnchorDate, partnerName: newAnchorPartner }]);
      setNewAnchorTask('');
      setNewAnchorDate('');
      setNewAnchorPartner('');
    }
  };

  const removeAnchor = (idx: number) => {
    setAnchors(anchors.filter((_, i) => i !== idx));
  };

  function handleCreate() {
    if (!name || !launchDate) return;

    const result = scheduleLaunch({
      dtcLaunchDate: launchDate,
      sephoraLaunchDate: sephoraLaunchDate || undefined,
      amazonLaunchDate: amazonLaunchDate || undefined,
      externalAnchors: anchors.length > 0 ? anchors : undefined,
    });

    const tasks = scheduledTasksToGTMTasks(result.tasks);
    const now = new Date().toISOString();

    const launch: Launch = {
      id: uuid(),
      name,
      launchDate,
      sephoraLaunchDate: sephoraLaunchDate || undefined,
      amazonLaunchDate: amazonLaunchDate || undefined,
      launchType,
      tier,
      contentProductionType,
      status: 'planning',
      productCategory,
      description,
      tasks,
      externalAnchors: anchors.length > 0 ? anchors : undefined,
      strategy: getDefaultStrategy(),
      marketingPlan: getDefaultMarketingPlan(),
      createdAt: now,
      updatedAt: now,
    };

    saveLaunch(launch);
    onClose();
    router.push(`/launch/${launch.id}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-fade-in max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-[#E7E5E4] sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-lg font-semibold">Create New Launch</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#F5F5F4]">
            <X className="w-5 h-5 text-[#A8A29E]" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[#57534E] mb-1.5">Launch Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., SPF 50 Summer Launch"
              className="w-full px-3 py-2 border border-[#E7E5E4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF1493]/20 focus:border-[#FF1493]"
            />
          </div>

          {/* Launch Dates */}
          <div>
            <label className="block text-[13px] font-medium text-[#57534E] mb-1.5">Launch Dates</label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-[#A8A29E] mb-1">DTC *</label>
                <input
                  type="date"
                  value={launchDate}
                  onChange={e => setLaunchDate(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E7E5E4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF1493]/20 focus:border-[#FF1493]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#A8A29E] mb-1">Sephora</label>
                <input
                  type="date"
                  value={sephoraLaunchDate}
                  onChange={e => setSephoraLaunchDate(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E7E5E4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF1493]/20 focus:border-[#FF1493]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#A8A29E] mb-1">Amazon</label>
                <input
                  type="date"
                  value={amazonLaunchDate}
                  onChange={e => setAmazonLaunchDate(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E7E5E4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF1493]/20 focus:border-[#FF1493]"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[#57534E] mb-1.5">Product Category</label>
              <input
                type="text"
                value={productCategory}
                onChange={e => setProductCategory(e.target.value)}
                placeholder="e.g., Kids, Mom, Baby"
                className="w-full px-3 py-2 border border-[#E7E5E4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF1493]/20 focus:border-[#FF1493]"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#57534E] mb-1.5">Launch Type</label>
              <select
                value={launchType}
                onChange={e => setLaunchType(e.target.value as LaunchType)}
                className="w-full px-3 py-2 border border-[#E7E5E4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF1493]/20 focus:border-[#FF1493]"
              >
                {Object.entries(LAUNCH_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#57534E] mb-1.5">Launch Tier</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(TIER_CONFIG) as [LaunchTier, typeof TIER_CONFIG.A][]).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => setTier(key)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    tier === key
                      ? 'border-[#FF1493] bg-[#FFF0F7] ring-1 ring-[#FF1493]/20'
                      : 'border-[#E7E5E4] hover:border-[#D6D3D1]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: config.color }}
                    />
                    <span className="text-sm font-medium">{config.label.split(' — ')[0]}</span>
                  </div>
                  <p className="text-[11px] text-[#A8A29E] leading-tight">{config.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#57534E] mb-1.5">Content Production</label>
            <select
              value={contentProductionType}
              onChange={e => setContentProductionType(e.target.value as ContentProductionType)}
              className="w-full px-3 py-2 border border-[#E7E5E4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF1493]/20 focus:border-[#FF1493]"
            >
              <option value="with_tech">Full Production (with Tech)</option>
              <option value="no_tech">Content Production (No Tech)</option>
              <option value="none">No Content Production</option>
              <option value="landing_page">Landing Page Required</option>
            </select>
          </div>

          {/* External Partner Deadlines */}
          <div className="border border-[#E7E5E4] rounded-lg p-3">
            <h3 className="text-[13px] font-medium text-[#57534E] mb-2 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-purple-500" />
              External Partner Deadlines
              <span className="text-[11px] text-[#A8A29E] font-normal ml-1">(optional)</span>
            </h3>
            {anchors.map((a, i) => (
              <div key={i} className="flex items-center gap-2 mb-2 text-sm">
                <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-md text-xs font-medium">{a.partnerName}</span>
                <span className="text-[#44403C] text-xs">{a.taskName}</span>
                <span className="text-[#A8A29E] text-xs">{a.date}</span>
                <button onClick={() => removeAnchor(i)} className="text-[#A8A29E] hover:text-red-500 ml-auto">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <div className="flex gap-2 items-end">
              <input
                type="text"
                placeholder="Partner name"
                value={newAnchorPartner}
                onChange={e => setNewAnchorPartner(e.target.value)}
                className="w-24 px-2 py-1.5 border border-[#D6D3D1] rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
              <input
                type="text"
                placeholder="Task name"
                value={newAnchorTask}
                onChange={e => setNewAnchorTask(e.target.value)}
                className="flex-1 px-2 py-1.5 border border-[#D6D3D1] rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
              <input
                type="date"
                value={newAnchorDate}
                onChange={e => setNewAnchorDate(e.target.value)}
                className="w-32 px-2 py-1.5 border border-[#D6D3D1] rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
              <button
                onClick={addAnchor}
                disabled={!newAnchorTask || !newAnchorDate || !newAnchorPartner}
                className="px-2.5 py-1.5 bg-purple-600 text-white rounded-md text-xs font-medium disabled:opacity-40 hover:bg-purple-700"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#57534E] mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of this launch..."
              rows={2}
              className="w-full px-3 py-2 border border-[#E7E5E4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF1493]/20 focus:border-[#FF1493] resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-[#E7E5E4] sticky bottom-0 bg-white rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[#57534E] hover:bg-[#F5F5F4] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name || !launchDate}
            className="px-4 py-2 text-sm font-medium bg-[#FF1493] text-white rounded-lg hover:bg-[#D4117D] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Create Launch
          </button>
        </div>
      </div>
    </div>
  );
}
