import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { AlertTriangle, MessageSquare, TrendingUp, Shield, Zap } from 'lucide-react';
import api from '@/services/api';
import { useClientStore } from '@/stores/clientStore';
import { Navigate } from 'react-router-dom';
import type { DashboardData, Alert } from '@/types';
import {
  formatNumber,
  formatRelativeTime,
  severityBadgeClass,
  sentimentColor,
} from '@/utils/formatters';

const SENTIMENT_COLORS = {
  STRONGLY_POSITIVE: '#10B981',
  POSITIVE: '#34D399',
  NEUTRAL: '#6B7280',
  NEGATIVE: '#F87171',
  STRONGLY_NEGATIVE: '#EF4444',
  MIXED: '#F59E0B',
};

export function DashboardPage(): JSX.Element {
  const { activeClient } = useClientStore();

  const { data: dashboard, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard', activeClient?.id],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: DashboardData }>(
        `/clients/${activeClient!.id}/dashboard`,
      );
      return res.data.data;
    },
    enabled: !!activeClient,
    refetchInterval: 60000,
  });

  const { data: trendData } = useQuery({
    queryKey: ['sentiment-trend', activeClient?.id],
    queryFn: async () => {
      const res = await api.get(`/analytics/sentiment-trend?clientId=${activeClient!.id}&days=7`);
      return res.data.data as Array<{ date: string; avgSentiment: number }>;
    },
    enabled: !!activeClient,
  });

  if (!activeClient) {
    return <Navigate to="/clients" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-nazar-muted">Loading intelligence data...</div>
      </div>
    );
  }

  const positiveCount = dashboard?.sentimentBreakdown
    .filter((s) => s.politicalSentiment?.includes('POSITIVE'))
    .reduce((a, b) => a + b._count, 0) ?? 0;

  const negativeCount = dashboard?.sentimentBreakdown
    .filter((s) => s.politicalSentiment?.includes('NEGATIVE'))
    .reduce((a, b) => a + b._count, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-nazar-text">Intelligence Dashboard</h1>
        <p className="text-nazar-muted text-sm mt-0.5">
          Real-time monitoring for{' '}
          <span className="text-nazar-accent">{activeClient.name}</span>
          {activeClient.nameHindi && (
            <span className="text-hindi ml-2 text-nazar-muted">({activeClient.nameHindi})</span>
          )}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-nazar-muted text-xs uppercase tracking-wider">Mentions (24h)</span>
            <MessageSquare size={16} className="text-nazar-accent" />
          </div>
          <div className="text-2xl font-bold text-nazar-text">
            {formatNumber(dashboard?.mentionVolume ?? 0)}
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-nazar-muted text-xs uppercase tracking-wider">Positive</span>
            <TrendingUp size={16} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">{formatNumber(positiveCount)}</div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-nazar-muted text-xs uppercase tracking-wider">Negative</span>
            <AlertTriangle size={16} className="text-red-400" />
          </div>
          <div className="text-2xl font-bold text-red-400">{formatNumber(negativeCount)}</div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-nazar-muted text-xs uppercase tracking-wider">Open Alerts</span>
            <Shield size={16} className="text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">
            {dashboard?.recentAlerts?.length ?? 0}
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sentiment trend */}
        <div className="card lg:col-span-2">
          <h3 className="text-sm font-medium text-nazar-text mb-4">Sentiment Trend (7 days)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trendData ?? []}>
              <defs>
                <linearGradient id="sentimentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#6B7280', fontSize: 11 }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis
                domain={[-1, 1]}
                tick={{ fill: '#6B7280', fontSize: 11 }}
                tickFormatter={(v: number) => v.toFixed(1)}
              />
              <Tooltip
                contentStyle={{ background: '#1A2235', border: '1px solid #1E2D45', borderRadius: 8 }}
                labelStyle={{ color: '#9CA3AF' }}
                itemStyle={{ color: '#60A5FA' }}
              />
              <Area
                type="monotone"
                dataKey="avgSentiment"
                stroke="#3B82F6"
                fill="url(#sentimentGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Sentiment pie */}
        <div className="card">
          <h3 className="text-sm font-medium text-nazar-text mb-4">Sentiment Breakdown</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={dashboard?.sentimentBreakdown ?? []}
                dataKey="_count"
                nameKey="politicalSentiment"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
              >
                {dashboard?.sentimentBreakdown.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={
                      SENTIMENT_COLORS[entry.politicalSentiment as keyof typeof SENTIMENT_COLORS] ?? '#6B7280'
                    }
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1A2235', border: '1px solid #1E2D45', borderRadius: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {dashboard?.sentimentBreakdown.slice(0, 4).map((s) => (
              <div key={s.politicalSentiment} className="flex items-center justify-between text-xs">
                <span
                  className={sentimentColor(s.politicalSentiment as never)}
                >
                  {s.politicalSentiment?.replace(/_/g, ' ')}
                </span>
                <span className="text-nazar-muted">{s._count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active Alerts */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-nazar-text">Active Alerts</h3>
            <Zap size={15} className="text-amber-400" />
          </div>
          <div className="space-y-3">
            {dashboard?.recentAlerts?.length === 0 && (
              <p className="text-nazar-muted text-sm text-center py-4">No active alerts</p>
            )}
            {dashboard?.recentAlerts?.map((alert: Alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg bg-nazar-surface severity-${alert.severity.toLowerCase()}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-nazar-text font-medium leading-snug">{alert.title}</p>
                  <span className={severityBadgeClass(alert.severity)}>{alert.severity}</span>
                </div>
                <p className="text-xs text-nazar-muted mt-1">{formatRelativeTime(alert.createdAt)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Top Topics */}
        <div className="card">
          <h3 className="text-sm font-medium text-nazar-text mb-4">Top Topics (24h)</h3>
          <div className="space-y-2">
            {dashboard?.topTopics?.slice(0, 8).map(({ topic, count }) => {
              const max = dashboard.topTopics[0]?.count ?? 1;
              const pct = Math.round((count / max) * 100);
              return (
                <div key={topic} className="flex items-center gap-3">
                  <span className="text-xs text-nazar-muted capitalize w-32 truncate">
                    {topic.replace(/_/g, ' ')}
                  </span>
                  <div className="flex-1 bg-nazar-border rounded-full h-1.5">
                    <div
                      className="bg-nazar-accent rounded-full h-1.5 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-nazar-muted w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
