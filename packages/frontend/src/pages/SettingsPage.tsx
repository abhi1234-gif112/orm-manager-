import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Play, Trash2, Settings, Wifi } from 'lucide-react';
import api from '@/services/api';
import { useClientStore } from '@/stores/clientStore';
import { Navigate } from 'react-router-dom';
import type { IngestionSourceType } from '@prisma/client';

interface IngestionConfig {
  id: string;
  sourceType: string;
  config: Record<string, unknown>;
  isActive: boolean;
  intervalMinutes: number;
  lastRunAt?: string;
  lastRunStatus?: string;
  errorCount: number;
}

const SOURCE_TYPES = [
  'TWITTER_SEARCH',
  'TWITTER_USER_TIMELINE',
  'YOUTUBE_CHANNEL',
  'YOUTUBE_SEARCH',
  'TELEGRAM_CHANNEL',
  'REDDIT_SEARCH',
  'HINDI_NEWS_SCRAPE',
  'ENGLISH_NEWS_SCRAPE',
  'WEB_SCRAPE',
];

export function SettingsPage(): JSX.Element {
  const { activeClient } = useClientStore();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newConfig, setNewConfig] = useState({
    sourceType: 'TWITTER_SEARCH',
    configJson: '{"query": "", "maxResults": 50}',
    intervalMinutes: 15,
  });

  const { data: configs, isLoading } = useQuery<IngestionConfig[]>({
    queryKey: ['ingestion', activeClient?.id],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: IngestionConfig[] }>(
        `/ingestion?clientId=${activeClient!.id}`,
      );
      return res.data.data;
    },
    enabled: !!activeClient,
  });

  const triggerIngestion = useMutation({
    mutationFn: async (configId: string) => {
      await api.post(`/ingestion/${configId}/trigger`);
    },
  });

  const deleteConfig = useMutation({
    mutationFn: async (configId: string) => {
      await api.delete(`/ingestion/${configId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ingestion', activeClient?.id] });
    },
  });

  const addConfig = useMutation({
    mutationFn: async () => {
      const config = JSON.parse(newConfig.configJson) as Record<string, unknown>;
      await api.post('/ingestion', {
        clientId: activeClient!.id,
        sourceType: newConfig.sourceType,
        config,
        intervalMinutes: newConfig.intervalMinutes,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ingestion', activeClient?.id] });
      setShowAdd(false);
    },
  });

  if (!activeClient) return <Navigate to="/clients" replace />;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-nazar-text">Data Source Settings</h1>
          <p className="text-nazar-muted text-sm mt-0.5">Configure ingestion pipelines for {activeClient.name}</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus size={15} />
          Add Source
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-nazar-text">New Ingestion Source</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-nazar-muted mb-1.5">Source Type</label>
              <select
                className="input text-sm"
                value={newConfig.sourceType}
                onChange={(e) => setNewConfig({ ...newConfig, sourceType: e.target.value })}
              >
                {SOURCE_TYPES.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-nazar-muted mb-1.5">Interval (minutes)</label>
              <input
                type="number"
                min={5}
                max={1440}
                className="input text-sm"
                value={newConfig.intervalMinutes}
                onChange={(e) => setNewConfig({ ...newConfig, intervalMinutes: parseInt(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-nazar-muted mb-1.5">Config (JSON)</label>
            <textarea
              className="input font-mono text-xs min-h-24 resize-none"
              value={newConfig.configJson}
              onChange={(e) => setNewConfig({ ...newConfig, configJson: e.target.value })}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => addConfig.mutate()}
              disabled={addConfig.isPending}
              className="btn-primary text-sm"
            >
              {addConfig.isPending ? 'Adding...' : 'Add Source'}
            </button>
            <button onClick={() => setShowAdd(false)} className="btn-ghost text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Config list */}
      {isLoading && <div className="text-nazar-muted text-center py-8">Loading...</div>}

      <div className="space-y-3">
        {configs?.map((config) => (
          <div key={config.id} className="card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${config.isActive && config.errorCount < 5 ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <div>
                  <p className="text-sm font-medium text-nazar-text">
                    {config.sourceType.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-nazar-muted">
                    Every {config.intervalMinutes}min
                    {config.lastRunAt && ` · Last run: ${new Date(config.lastRunAt).toLocaleTimeString()}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {config.lastRunStatus && (
                  <span className={`text-xs ${config.lastRunStatus.startsWith('OK') ? 'text-emerald-400' : 'text-red-400'}`}>
                    {config.lastRunStatus.slice(0, 30)}
                  </span>
                )}
                <button
                  onClick={() => triggerIngestion.mutate(config.id)}
                  className="p-1.5 text-nazar-muted hover:text-nazar-accent transition-colors"
                  title="Trigger now"
                >
                  <Play size={14} />
                </button>
                <button
                  onClick={() => deleteConfig.mutate(config.id)}
                  className="p-1.5 text-nazar-muted hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {config.errorCount > 0 && (
              <p className="text-xs text-red-400 mt-2">
                ⚠ {config.errorCount} consecutive errors — check credentials/connectivity
              </p>
            )}
          </div>
        ))}

        {configs?.length === 0 && (
          <div className="text-center py-12 text-nazar-muted">
            <Wifi size={36} className="mx-auto mb-3 opacity-30" />
            <p>No ingestion sources configured yet</p>
            <p className="text-xs mt-1">Add sources above to start monitoring</p>
          </div>
        )}
      </div>
    </div>
  );
}
