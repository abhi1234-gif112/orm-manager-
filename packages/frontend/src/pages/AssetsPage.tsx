import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Copy, Check, Plus } from 'lucide-react';
import api from '@/services/api';
import { useClientStore } from '@/stores/clientStore';
import { Navigate } from 'react-router-dom';
import type { ResponseAsset, AssetType } from '@/types';
import { formatRelativeTime } from '@/utils/formatters';

const ASSET_TYPES: Array<{ type: AssetType; label: string; description: string }> = [
  { type: 'COUNTER_BRIEF', label: 'Counter Brief', description: 'Intelligence brief for internal use' },
  { type: 'RAPID_RESPONSE_TWEET', label: 'Tweet Response', description: 'Rapid 280-char response' },
  { type: 'PRESS_STATEMENT', label: 'Press Statement', description: 'Formal media statement' },
  { type: 'PRESS_KIT', label: 'Press Kit', description: 'Comprehensive media package' },
  { type: 'WHATSAPP_FORWARD', label: 'WhatsApp Forward', description: 'Grassroots sharing content' },
  { type: 'TALKING_POINTS', label: 'Talking Points', description: 'Spokesperson bullet points' },
  { type: 'FACT_CHECK', label: 'Fact Check', description: 'Evidence-based rebuttals' },
  { type: 'NARRATIVE_MEMO', label: 'Narrative Memo', description: 'Internal strategy memo' },
  { type: 'CRISIS_STATEMENT', label: 'Crisis Statement', description: 'Crisis communication' },
];

export function AssetsPage(): JSX.Element {
  const { activeClient } = useClientStore();
  const [selectedType, setSelectedType] = useState<AssetType | ''>('');
  const [generating, setGenerating] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [form, setForm] = useState({ assetType: '' as AssetType, context: '', triggeringContent: '' });
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<ResponseAsset | null>(null);

  const { data: assets, refetch } = useQuery<ResponseAsset[]>({
    queryKey: ['assets', activeClient?.id, selectedType],
    queryFn: async () => {
      const params = new URLSearchParams({
        clientId: activeClient!.id,
        ...(selectedType && { type: selectedType }),
      });
      const res = await api.get<{ success: boolean; data: ResponseAsset[] }>(`/assets?${params}`);
      return res.data.data;
    },
    enabled: !!activeClient,
  });

  const copyToClipboard = async (text: string, id: string): Promise<void> => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleGenerate = async (): Promise<void> => {
    if (!form.assetType || !form.triggeringContent) return;
    setGenerating(true);
    try {
      await api.post('/assets/generate', {
        clientId: activeClient!.id,
        ...form,
        context: form.context || `Response asset for ${activeClient!.name}`,
      });
      setShowGenerator(false);
      setForm({ assetType: '' as AssetType, context: '', triggeringContent: '' });
      void refetch();
    } finally {
      setGenerating(false);
    }
  };

  if (!activeClient) return <Navigate to="/clients" replace />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-nazar-text">Response Asset Library</h1>
        <button
          onClick={() => setShowGenerator(!showGenerator)}
          className="btn-primary flex items-center gap-1.5 text-sm"
        >
          <Plus size={15} />
          Generate Asset
        </button>
      </div>

      {/* Generator form */}
      {showGenerator && (
        <div className="card border-nazar-accent/30 space-y-4">
          <h3 className="text-sm font-semibold text-nazar-text">Generate New Asset with Claude AI</h3>

          <div className="grid grid-cols-2 gap-2">
            {ASSET_TYPES.map(({ type, label, description }) => (
              <button
                key={type}
                onClick={() => setForm({ ...form, assetType: type })}
                className={`text-left p-3 rounded-lg border transition-colors ${
                  form.assetType === type
                    ? 'border-nazar-accent bg-nazar-accent/10 text-nazar-accent'
                    : 'border-nazar-border bg-nazar-surface text-nazar-text-secondary hover:text-nazar-text'
                }`}
              >
                <p className="text-xs font-medium">{label}</p>
                <p className="text-[11px] text-nazar-muted mt-0.5">{description}</p>
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs text-nazar-muted mb-1.5">Triggering Content / Situation</label>
            <textarea
              className="input min-h-20 resize-none"
              placeholder="Paste the content that needs a response, or describe the situation..."
              value={form.triggeringContent}
              onChange={(e) => setForm({ ...form, triggeringContent: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs text-nazar-muted mb-1.5">Additional Context (optional)</label>
            <input
              className="input"
              placeholder="Any additional context for the AI..."
              value={form.context}
              onChange={(e) => setForm({ ...form, context: e.target.value })}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={generating || !form.assetType || !form.triggeringContent}
              className="btn-primary disabled:opacity-60 flex items-center gap-2"
            >
              {generating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate with Claude AI'
              )}
            </button>
            <button onClick={() => setShowGenerator(false)} className="btn-ghost">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedType('')}
          className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
            !selectedType ? 'bg-nazar-accent text-white' : 'bg-nazar-surface border border-nazar-border text-nazar-muted'
          }`}
        >
          All
        </button>
        {ASSET_TYPES.map(({ type, label }) => (
          <button
            key={type}
            onClick={() => setSelectedType(type === selectedType ? '' : type)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              selectedType === type ? 'bg-nazar-accent text-white' : 'bg-nazar-surface border border-nazar-border text-nazar-muted hover:text-nazar-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Asset grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {assets?.map((asset) => (
          <div
            key={asset.id}
            className="card hover:border-nazar-accent/30 transition-colors cursor-pointer"
            onClick={() => setSelectedAsset(asset === selectedAsset ? null : asset)}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <span className="badge-info text-[11px]">{asset.type.replace(/_/g, ' ')}</span>
                <p className="text-sm font-medium text-nazar-text mt-1">{asset.title}</p>
              </div>
              <FileText size={15} className="text-nazar-muted flex-shrink-0 mt-1" />
            </div>

            <p className="text-xs text-nazar-text-secondary line-clamp-3 mb-3">
              {asset.contentEn}
            </p>

            {asset === selectedAsset && (
              <div className="space-y-2 border-t border-nazar-border pt-3">
                <div className="bg-nazar-surface rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-nazar-muted">English</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); void copyToClipboard(asset.contentEn, `${asset.id}-en`); }}
                      className="text-nazar-muted hover:text-nazar-text"
                    >
                      {copied === `${asset.id}-en` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    </button>
                  </div>
                  <p className="text-xs text-nazar-text-secondary leading-relaxed">{asset.contentEn}</p>
                </div>

                {asset.contentHi && (
                  <div className="bg-nazar-surface rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-nazar-muted">Hindi</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); void copyToClipboard(asset.contentHi!, `${asset.id}-hi`); }}
                        className="text-nazar-muted hover:text-nazar-text"
                      >
                        {copied === `${asset.id}-hi` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </button>
                    </div>
                    <p className="text-xs text-nazar-muted text-hindi leading-relaxed">{asset.contentHi}</p>
                  </div>
                )}
              </div>
            )}

            <p className="text-[11px] text-nazar-muted mt-2">{formatRelativeTime(asset.createdAt)}</p>
          </div>
        ))}
      </div>

      {assets?.length === 0 && (
        <div className="text-center py-16 text-nazar-muted">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p>No assets yet. Generate one above.</p>
        </div>
      )}
    </div>
  );
}
