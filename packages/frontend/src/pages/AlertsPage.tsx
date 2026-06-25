import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, CheckCircle, Clock, XCircle, FileText } from 'lucide-react';
import api from '@/services/api';
import { useClientStore } from '@/stores/clientStore';
import { Navigate } from 'react-router-dom';
import type { Alert, PaginatedResponse, AlertStatus, AssetType } from '@/types';
import { formatRelativeTime, severityBadgeClass, severityColor } from '@/utils/formatters';

const STATUS_OPTIONS: AlertStatus[] = ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED'];

const ASSET_TYPES: AssetType[] = [
  'COUNTER_BRIEF',
  'RAPID_RESPONSE_TWEET',
  'PRESS_STATEMENT',
  'WHATSAPP_FORWARD',
  'CRISIS_STATEMENT',
  'TALKING_POINTS',
];

export function AlertsPage(): JSX.Element {
  const { activeClient } = useClientStore();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<AlertStatus | ''>('OPEN');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [generatingAsset, setGeneratingAsset] = useState(false);
  const [generatedAsset, setGeneratedAsset] = useState<{ contentEn: string; contentHi?: string; title: string } | null>(null);

  const { data, isLoading } = useQuery<PaginatedResponse<Alert>>({
    queryKey: ['alerts', activeClient?.id, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        clientId: activeClient!.id,
        limit: '50',
        ...(statusFilter && { status: statusFilter }),
      });
      const res = await api.get<{ success: boolean; data: PaginatedResponse<Alert> }>(
        `/alerts?${params}`,
      );
      return res.data.data;
    },
    enabled: !!activeClient,
    refetchInterval: 30000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ alertId, status }: { alertId: string; status: AlertStatus }) => {
      await api.patch(`/alerts/${alertId}/status`, { status });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['alerts', activeClient?.id] });
    },
  });

  const generateAsset = async (alert: Alert, assetType: AssetType): Promise<void> => {
    setGeneratingAsset(true);
    setGeneratedAsset(null);
    try {
      const res = await api.post<{ success: boolean; data: { contentEn: string; contentHi: string; title: string } }>(
        '/assets/generate',
        {
          clientId: activeClient!.id,
          assetType,
          context: alert.description,
          triggeringContent: alert.aiSummary ?? alert.description,
          triggeredByAlertId: alert.id,
        },
      );
      setGeneratedAsset(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingAsset(false);
    }
  };

  if (!activeClient) return <Navigate to="/clients" replace />;

  return (
    <div className="flex gap-4 h-full">
      {/* Alert list */}
      <div className="flex-1 space-y-4 min-w-0">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-nazar-text">Alert Center</h1>
          <div className="flex items-center gap-2">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s === statusFilter ? '' : s)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  statusFilter === s
                    ? 'bg-nazar-accent text-white'
                    : 'bg-nazar-surface text-nazar-muted hover:text-nazar-text border border-nazar-border'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {isLoading && <div className="text-nazar-muted text-center py-12">Loading alerts...</div>}

        <div className="space-y-3">
          {data?.data.map((alert) => (
            <button
              key={alert.id}
              onClick={() => { setSelectedAlert(alert); setGeneratedAsset(null); }}
              className={`w-full text-left card hover:border-nazar-accent/40 transition-colors severity-${alert.severity.toLowerCase()} ${
                selectedAlert?.id === alert.id ? 'border-nazar-accent/60' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <Shield size={18} className={`flex-shrink-0 mt-0.5 ${severityColor(alert.severity)}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-nazar-text">{alert.title}</p>
                    <span className={`flex-shrink-0 ${severityBadgeClass(alert.severity)}`}>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-xs text-nazar-muted mb-2">{alert.description}</p>
                  {alert.aiSummary && (
                    <p className="text-xs text-nazar-text-secondary italic">"{alert.aiSummary.slice(0, 120)}..."</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-nazar-muted">
                    <span>{alert.type.replace(/_/g, ' ')}</span>
                    <span>{formatRelativeTime(alert.createdAt)}</span>
                    <span className="ml-auto badge-neutral">{alert.status}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}

          {data?.data.length === 0 && (
            <div className="text-center py-16 text-nazar-muted">
              <CheckCircle size={40} className="mx-auto mb-3 text-emerald-400/50" />
              <p>No {statusFilter.toLowerCase() || 'active'} alerts</p>
            </div>
          )}
        </div>
      </div>

      {/* Alert detail & response panel */}
      {selectedAlert && (
        <div className="w-96 flex-shrink-0 space-y-4 animate-slide-in">
          {/* Alert info */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-nazar-text">Alert Intelligence</h3>
              <button onClick={() => setSelectedAlert(null)} className="text-nazar-muted hover:text-nazar-text text-xl">×</button>
            </div>

            <div className={`p-3 rounded-lg bg-nazar-surface severity-${selectedAlert.severity.toLowerCase()} mb-3`}>
              <p className="text-sm font-medium text-nazar-text">{selectedAlert.title}</p>
              <p className="text-xs text-nazar-muted mt-1">{selectedAlert.description}</p>
            </div>

            {selectedAlert.aiSummary && (
              <div className="mb-3">
                <p className="text-xs text-nazar-muted mb-1">AI Intelligence Brief</p>
                <p className="text-sm text-nazar-text-secondary leading-relaxed">{selectedAlert.aiSummary}</p>
              </div>
            )}

            {selectedAlert.recommendedActions.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-nazar-muted mb-2">Recommended Actions</p>
                <ul className="space-y-1">
                  {selectedAlert.recommendedActions.map((action, i) => (
                    <li key={i} className="text-xs text-nazar-text-secondary flex items-start gap-2">
                      <span className="text-nazar-accent flex-shrink-0">{i + 1}.</span>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Status controls */}
            <div className="flex flex-wrap gap-2 pt-3 border-t border-nazar-border">
              {(['ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED'] as AlertStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => updateStatus.mutate({ alertId: selectedAlert.id, status: s })}
                  disabled={selectedAlert.status === s}
                  className="text-xs px-2.5 py-1.5 bg-nazar-surface border border-nazar-border rounded-lg
                             hover:border-nazar-accent/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {s === 'ACKNOWLEDGED' && <Clock size={10} className="inline mr-1" />}
                  {s === 'RESOLVED' && <CheckCircle size={10} className="inline mr-1" />}
                  {s === 'DISMISSED' && <XCircle size={10} className="inline mr-1" />}
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Generate response asset */}
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={15} className="text-nazar-accent" />
              <h3 className="text-sm font-semibold text-nazar-text">Generate Response</h3>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              {ASSET_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => generateAsset(selectedAlert, type)}
                  disabled={generatingAsset}
                  className="text-xs px-2.5 py-2 bg-nazar-surface border border-nazar-border rounded-lg
                             hover:border-nazar-accent/50 text-nazar-text-secondary hover:text-nazar-text
                             disabled:opacity-40 transition-colors text-left"
                >
                  {type.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            {generatingAsset && (
              <div className="text-center py-4 text-nazar-muted text-sm">
                <div className="inline-block w-4 h-4 border-2 border-nazar-accent/30 border-t-nazar-accent rounded-full animate-spin mr-2" />
                Generating with Claude AI...
              </div>
            )}

            {generatedAsset && (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-nazar-muted mb-1">English</p>
                  <div className="bg-nazar-surface rounded-lg p-3 text-sm text-nazar-text leading-relaxed max-h-40 overflow-y-auto">
                    {generatedAsset.contentEn}
                  </div>
                </div>
                {generatedAsset.contentHi && (
                  <div>
                    <p className="text-xs text-nazar-muted mb-1">Hindi</p>
                    <div className="bg-nazar-surface rounded-lg p-3 text-sm text-nazar-muted text-hindi leading-relaxed max-h-32 overflow-y-auto">
                      {generatedAsset.contentHi}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
