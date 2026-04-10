'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuid } from 'uuid';
import { X, Plus, Lock } from 'lucide-react';
import { Launch, LaunchType, LaunchTier, ExternalAnchorConfig, LAUNCH_TYPE_LABELS, TIER_CONFIG } from '@/lib/types';
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
  const launchDateRef = useRef<HTMLInputElement>(null);
  const sephoraDateRef = useRef<HTMLInputElement>(null);

  // Accept MM/DD/YYYY typed input and normalize to YYYY-MM-DD.
  const normalizeDate = (raw: string): string => {
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (slashMatch) {
      let [, m, d, y] = slashMatch;
      if (y.length === 2) y = '20' + y;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return '';
  };
  const [hasSephora, setHasSephora] = useState(true);

  const [launchType, setLaunchType] = useState<LaunchType>('new_product');
  const [tier, setTier] = useState<LaunchTier>('A');
  const [productCategory, setProductCategory] = useState('');
  const [description, setDescription] = useState('');

  // Configurable lead times (in business days)
  const [sephoraAssetLead, setSephoraAssetLead] = useState(50);
  const [d2cAssetLead, setD2cAssetLead] = useState(15);
  const [d2cCopyLead, setD2cCopyLead] = useState(10);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPartners, setShowPartners] = useState(false);

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
    // Pull the latest value straight from the DOM in case the user typed a
    // date and the browser hasn't committed it to React state yet.
    const rawLaunch = launchDateRef.current?.value || launchDate;
    const rawSephora = sephoraDateRef.current?.value || sephoraLaunchDate;
    const resolvedLaunchDate = normalizeDate(rawLaunch);
    const resolvedSephoraDate = normalizeDate(rawSephora);

    if (!name || !resolvedLaunchDate) return;
    if (resolvedLaunchDate !== launchDate) setLaunchDate(resolvedLaunchDate);
    if (resolvedSephoraDate !== sephoraLaunchDate) setSephoraLaunchDate(resolvedSephoraDate);

    const effectiveSephoraDate = hasSephora ? (resolvedSephoraDate || undefined) : undefined;

    const result = scheduleLaunch({
      dtcLaunchDate: resolvedLaunchDate,
      sephoraLaunchDate: effectiveSephoraDate,
      amazonLaunchDate: resolvedLaunchDate || undefined,
      sephoraAssetLeadBD: sephoraAssetLead,
      d2cAssetLeadBD: d2cAssetLead,
      d2cCopyLeadBD: d2cCopyLead,
      externalAnchors: anchors.length > 0 ? anchors : undefined,
    });

    let tasks = scheduledTasksToGTMTasks(result.tasks);

    // If not launching in Sephora, remove Sephora-specific tasks
    if (!hasSephora) {
      const sephoraTaskNames = new Set(
        tasks.filter(t => t.name.toLowerCase().includes('sephora')).map(t => t.id)
      );
      tasks = tasks
        .filter(t => !sephoraTaskNames.has(t.id))
        .map(t => ({
          ...t,
          dependencies: t.dependencies.filter(d => !sephoraTaskNames.has(d)),
        }));
    }
    const now = new Date().toISOString();

    const launch: Launch = {
      id: uuid(),
      name,
      launchDate: resolvedLaunchDate,
      sephoraLaunchDate: hasSephora ? (resolvedSephoraDate || undefined) : undefined,
      amazonLaunchDate: resolvedLaunchDate || undefined,
      launchType,
      tier,
      contentProductionType: 'with_tech',
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
              className="w-full px-3 py-2 border border-[#E7E5E4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3538CD]/20 focus:border-[#3538CD]"
            />
          </div>

          {/* Launch Dates */}
          <div>
            <label className="block text-[13px] font-medium text-[#57534E] mb-1.5">Launch Dates</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-[#A8A29E] mb-1">DTC / Amazon *</label>
                <input
                  ref={launchDateRef}
                  type="date"
                  value={launchDate}
                  onChange={e => setLaunchDate(e.target.value)}
                  onBlur={e => {
                    const n = normalizeDate(e.target.value);
                    if (n) setLaunchDate(n);
                  }}
                  className="w-full px-3 py-2 border border-[#E7E5E4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3538CD]/20 focus:border-[#3538CD]"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 mb-1 cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={hasSephora}
                    onChange={e => {
                      setHasSephora(e.target.checked);
                      if (!e.target.checked) setSephoraLaunchDate('');
                    }}
                    className="w-3.5 h-3.5 rounded accent-[#3538CD]"
                  />
                  <span className="text-[11px] text-[#A8A29E]">Sephora Launch Date</span>
                </label>
                {hasSephora ? (
                  <>
                    <input
                      ref={sephoraDateRef}
                      type="date"
                      value={sephoraLaunchDate}
                      onChange={e => setSephoraLaunchDate(e.target.value)}
                      onBlur={e => {
                        const n = normalizeDate(e.target.value);
                        if (n) setSephoraLaunchDate(n);
                      }}
                      className="w-full px-3 py-2 border border-[#E7E5E4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3538CD]/20 focus:border-[#3538CD]"
                    />
                    {!sephoraLaunchDate && launchDate && (
                      <p className="text-[10px] text-[#A8A29E] mt-0.5">Will default to DTC + 4 weeks</p>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] text-[#A8A29E] px-3 py-2 bg-[#F5F5F4] rounded-lg">No Sephora launch</p>
                )}
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
                className="w-full px-3 py-2 border border-[#E7E5E4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3538CD]/20 focus:border-[#3538CD]"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#57534E] mb-1.5">Launch Type</label>
              <select
                value={launchType}
                onChange={e => setLaunchType(e.target.value as LaunchType)}
                className="w-full px-3 py-2 border border-[#E7E5E4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3538CD]/20 focus:border-[#3538CD]"
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
                      ? 'border-[#3538CD] bg-[#EEF0FF] ring-1 ring-[#3538CD]/20'
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

          {/* Retail Lead Time Settings */}
          <div className="border border-[#E7E5E4] rounded-lg p-3">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 w-full text-left"
            >
              <span className="text-[13px] font-medium text-[#57534E]">Retail Lead Times</span>
              <span className="text-[11px] text-[#A8A29E] font-normal ml-1">(click to customize)</span>
              <span className="ml-auto text-[#A8A29E] text-xs">{showAdvanced ? '▲' : '▼'}</span>
            </button>
            {showAdvanced && (
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-[#A8A29E] mb-1">Sephora assets (BD before Sephora launch)</label>
                  <input
                    type="number"
                    value={sephoraAssetLead}
                    onChange={e => setSephoraAssetLead(parseInt(e.target.value) || 50)}
                    className="w-full px-2 py-1.5 border border-[#D6D3D1] rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-purple-300 text-center"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#A8A29E] mb-1">D2C assets (BD before D2C launch)</label>
                  <input
                    type="number"
                    value={d2cAssetLead}
                    onChange={e => setD2cAssetLead(parseInt(e.target.value) || 15)}
                    className="w-full px-2 py-1.5 border border-[#D6D3D1] rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-purple-300 text-center"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#A8A29E] mb-1">D2C copy (BD before D2C launch)</label>
                  <input
                    type="number"
                    value={d2cCopyLead}
                    onChange={e => setD2cCopyLead(parseInt(e.target.value) || 10)}
                    className="w-full px-2 py-1.5 border border-[#D6D3D1] rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-purple-300 text-center"
                  />
                </div>
              </div>
            )}
          </div>

          {/* External Partner Deadlines */}
          <div className="border border-[#E7E5E4] rounded-lg p-3">
            <button
              type="button"
              onClick={() => setShowPartners(!showPartners)}
              className="flex items-center gap-1.5 w-full text-left"
            >
              <Lock className="w-3.5 h-3.5 text-purple-500" />
              <span className="text-[13px] font-medium text-[#57534E]">External Partner Deadlines</span>
              <span className="text-[11px] text-[#A8A29E] font-normal ml-1">(click to customize)</span>
              {anchors.length > 0 && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">{anchors.length}</span>}
              <span className="ml-auto text-[#A8A29E] text-xs">{showPartners ? '▲' : '▼'}</span>
            </button>
            {showPartners && (<>
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
            </>)}
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#57534E] mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of this launch..."
              rows={2}
              className="w-full px-3 py-2 border border-[#E7E5E4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3538CD]/20 focus:border-[#3538CD] resize-none"
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
            disabled={!name}
            className="px-4 py-2 text-sm font-medium bg-[#3538CD] text-white rounded-lg hover:bg-[#2D31B3] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Create Launch
          </button>
        </div>
      </div>
    </div>
  );
}
