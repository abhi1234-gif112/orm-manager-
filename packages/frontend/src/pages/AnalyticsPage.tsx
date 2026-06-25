import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
} from 'recharts';
import api from '@/services/api';
import { useClientStore } from '@/stores/clientStore';
import { Navigate } from 'react-router-dom';
import { useState } from 'react';

export function AnalyticsPage(): JSX.Element {
  const { activeClient } = useClientStore();
  const [days, setDays] = useState('7');

  const { data: sourceBreakdown } = useQuery({
    queryKey: ['source-breakdown', activeClient?.id, days],
    queryFn: async () => {
      const res = await api.get(`/analytics/source-breakdown?clientId=${activeClient!.id}&days=${days}`);
      return res.data.data as Array<{ source: string; _count: number; _avg: { sentimentScore: number } }>;
    },
    enabled: !!activeClient,
  });

  const { data: topicCloud } = useQuery({
    queryKey: ['topic-cloud', activeClient?.id, days],
    queryFn: async () => {
      const res = await api.get(`/analytics/topic-cloud?clientId=${activeClient!.id}&days=${days}`);
      return res.data.data as Array<{ topic: string; count: number; avgSentiment: number }>;
    },
    enabled: !!activeClient,
  });

  const { data: threatRadar } = useQuery({
    queryKey: ['threat-radar', activeClient?.id],
    queryFn: async () => {
      const res = await api.get(`/analytics/threat-radar?clientId=${activeClient!.id}`);
      return res.data.data as {
        topThreats: Array<{ id: string; name: string; riskScore: number; influenceScore: number }>;
        openAlerts: number;
        disinfoCount: number;
      };
    },
    enabled: !!activeClient,
  });

  if (!activeClient) return <Navigate to="/clients" replace />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-nazar-text">Analytics & Intelligence</h1>
        <select
          className="input w-32 h-9 text-sm"
          value={days}
          onChange={(e) => setDays(e.target.value)}
        >
          <option value="1">24 hours</option>
          <option value="7">7 days</option>
          <option value="30">30 days</option>
        </select>
      </div>

      {/* Threat summary */}
      {threatRadar && (
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-card col-span-1">
            <p className="text-xs text-nazar-muted uppercase tracking-wider">Open Alerts</p>
            <p className="text-3xl font-bold text-amber-400">{threatRadar.openAlerts}</p>
          </div>
          <div className="stat-card col-span-1">
            <p className="text-xs text-nazar-muted uppercase tracking-wider">Disinfo (24h)</p>
            <p className="text-3xl font-bold text-red-400">{threatRadar.disinfoCount}</p>
          </div>
          <div className="stat-card col-span-1">
            <p className="text-xs text-nazar-muted uppercase tracking-wider">Threat Actors</p>
            <p className="text-3xl font-bold text-orange-400">{threatRadar.topThreats.length}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Source breakdown */}
        <div className="card">
          <h3 className="text-sm font-medium text-nazar-text mb-4">Mentions by Source</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sourceBreakdown ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45" />
              <XAxis
                dataKey="source"
                tick={{ fill: '#6B7280', fontSize: 10 }}
                tickFormatter={(v: string) => v.replace(/_/g, ' ').slice(0, 8)}
              />
              <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#1A2235', border: '1px solid #1E2D45', borderRadius: 8 }}
                labelStyle={{ color: '#9CA3AF' }}
              />
              <Bar dataKey="_count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top threat actors */}
        <div className="card">
          <h3 className="text-sm font-medium text-nazar-text mb-4">Top Threat Actors</h3>
          {threatRadar?.topThreats.length === 0 && (
            <p className="text-nazar-muted text-sm text-center py-8">No threat actors identified</p>
          )}
          <div className="space-y-3">
            {threatRadar?.topThreats.map((t) => (
              <div key={t.id} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-red-900/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs text-red-400 font-bold">{t.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-nazar-text truncate">{t.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <div className="flex items-center gap-1.5 text-xs text-nazar-muted">
                      <span>Risk:</span>
                      <div className="w-16 h-1 bg-nazar-border rounded-full">
                        <div className="h-1 bg-red-400 rounded-full" style={{ width: `${t.riskScore}%` }} />
                      </div>
                      <span className="text-red-400">{t.riskScore}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Topic analysis */}
      <div className="card">
        <h3 className="text-sm font-medium text-nazar-text mb-4">Topic Distribution</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {topicCloud?.slice(0, 12).map(({ topic, count, avgSentiment }) => (
            <div key={topic} className="bg-nazar-surface rounded-lg p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm capitalize text-nazar-text">{topic.replace(/_/g, ' ')}</span>
                <span className="text-xs text-nazar-muted">{count}</span>
              </div>
              <div className="w-full bg-nazar-border rounded-full h-1">
                <div
                  className={`h-1 rounded-full ${avgSentiment >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                  style={{ width: `${Math.abs(avgSentiment) * 100}%` }}
                />
              </div>
              <p className={`text-[11px] mt-1 ${avgSentiment >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {avgSentiment >= 0 ? '+' : ''}{avgSentiment.toFixed(2)} sentiment
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
