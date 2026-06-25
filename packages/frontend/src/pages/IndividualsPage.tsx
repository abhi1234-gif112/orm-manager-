import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, TrendingUp, Shield, Minus } from 'lucide-react';
import api from '@/services/api';
import { useClientStore } from '@/stores/clientStore';
import { Navigate } from 'react-router-dom';
import type { Individual, PaginatedResponse, IndividualStance } from '@/types';
import { stanceBadgeClass, stanceColor, formatNumber } from '@/utils/formatters';

export function IndividualsPage(): JSX.Element {
  const { activeClient } = useClientStore();
  const queryClient = useQueryClient();
  const [stanceFilter, setStanceFilter] = useState<IndividualStance | ''>('');
  const [selected, setSelected] = useState<Individual | null>(null);

  const { data, isLoading } = useQuery<PaginatedResponse<Individual>>({
    queryKey: ['individuals', activeClient?.id, stanceFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        clientId: activeClient!.id,
        limit: '50',
        ...(stanceFilter && { stance: stanceFilter }),
      });
      const res = await api.get<{ success: boolean; data: PaginatedResponse<Individual> }>(
        `/individuals?${params}`,
      );
      return res.data.data;
    },
    enabled: !!activeClient,
  });

  const rescore = useMutation({
    mutationFn: async (individualId: string) => {
      await api.post(`/individuals/${individualId}/rescore`, { clientId: activeClient!.id });
    },
  });

  const overrideStance = useMutation({
    mutationFn: async ({ id, stance }: { id: string; stance: IndividualStance }) => {
      await api.patch(`/individuals/${id}/stance`, {
        clientId: activeClient!.id,
        stance,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['individuals', activeClient?.id] });
    },
  });

  if (!activeClient) return <Navigate to="/clients" replace />;

  const stances: Array<IndividualStance | ''> = ['', 'THREAT', 'WATCHLIST', 'ALLY', 'NEUTRAL'];

  return (
    <div className="flex gap-4 h-full">
      <div className="flex-1 space-y-4 min-w-0">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-nazar-text">Individual Ecosystem</h1>
          <div className="flex gap-2">
            {stances.map((s) => (
              <button
                key={s}
                onClick={() => setStanceFilter(s)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  stanceFilter === s
                    ? 'bg-nazar-accent text-white'
                    : 'bg-nazar-surface border border-nazar-border text-nazar-muted hover:text-nazar-text'
                }`}
              >
                {s || 'All'}
              </button>
            ))}
          </div>
        </div>

        {isLoading && <div className="text-nazar-muted text-center py-12">Loading profiles...</div>}

        <div className="grid grid-cols-1 gap-3">
          {data?.data.map((individual) => (
            <button
              key={individual.id}
              onClick={() => setSelected(individual)}
              className={`w-full text-left card hover:border-nazar-accent/40 transition-colors ${
                selected?.id === individual.id ? 'border-nazar-accent/60' : ''
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-nazar-border flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-nazar-text">
                    {individual.name.charAt(0)}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-nazar-text">{individual.name}</span>
                    {individual.nameHindi && (
                      <span className="text-xs text-nazar-muted text-hindi">{individual.nameHindi}</span>
                    )}
                    <span className={`ml-auto ${stanceBadgeClass(individual.stance)}`}>
                      {individual.stance}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-nazar-muted">
                    {individual.party && <span>{individual.party}</span>}
                    <span>{individual.type.replace(/_/g, ' ')}</span>
                    {individual.twitterHandle && <span>@{individual.twitterHandle}</span>}
                    <span>{formatNumber(individual.totalFollowers)} followers</span>
                  </div>
                </div>

                {/* Score bars */}
                <div className="flex items-center gap-4 text-xs text-right">
                  <div>
                    <p className="text-nazar-muted mb-0.5">Influence</p>
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 bg-nazar-border rounded-full">
                        <div
                          className="h-1.5 bg-blue-400 rounded-full"
                          style={{ width: `${individual.influenceScore}%` }}
                        />
                      </div>
                      <span className="text-blue-400">{individual.influenceScore}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-nazar-muted mb-0.5">Risk</p>
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 bg-nazar-border rounded-full">
                        <div
                          className="h-1.5 bg-red-400 rounded-full"
                          style={{ width: `${individual.riskScore}%` }}
                        />
                      </div>
                      <span className="text-red-400">{individual.riskScore}</span>
                    </div>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-80 flex-shrink-0 card h-fit space-y-4 animate-slide-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-nazar-text">Profile</h3>
            <button onClick={() => setSelected(null)} className="text-nazar-muted hover:text-nazar-text text-xl">×</button>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-nazar-border flex items-center justify-center mx-auto mb-2">
              <span className="text-xl font-bold text-nazar-text">{selected.name.charAt(0)}</span>
            </div>
            <p className="text-nazar-text font-medium">{selected.name}</p>
            {selected.nameHindi && <p className="text-nazar-muted text-hindi text-sm">{selected.nameHindi}</p>}
            <span className={`inline-block mt-1 ${stanceBadgeClass(selected.stance)}`}>{selected.stance}</span>
          </div>

          {/* Scores */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Influence', value: selected.influenceScore, color: 'text-blue-400', icon: TrendingUp },
              { label: 'Risk', value: selected.riskScore, color: 'text-red-400', icon: Shield },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="bg-nazar-surface rounded-lg p-3 text-center">
                <Icon size={16} className={`mx-auto mb-1 ${color}`} />
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-nazar-muted">{label}</p>
              </div>
            ))}
          </div>

          {/* Stance override */}
          <div>
            <p className="text-xs text-nazar-muted mb-2">Override Stance</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(['ALLY', 'WATCHLIST', 'THREAT', 'NEUTRAL'] as IndividualStance[]).map((s) => (
                <button
                  key={s}
                  onClick={() => overrideStance.mutate({ id: selected.id, stance: s })}
                  className={`text-xs py-1.5 rounded-lg border transition-colors ${
                    selected.stance === s
                      ? 'bg-nazar-accent/20 border-nazar-accent/50 text-nazar-accent'
                      : 'bg-nazar-surface border-nazar-border text-nazar-muted hover:text-nazar-text'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => rescore.mutate(selected.id)}
            disabled={rescore.isPending}
            className="btn-primary w-full text-sm disabled:opacity-60"
          >
            {rescore.isPending ? 'Re-scoring...' : 'Re-score with AI'}
          </button>
        </div>
      )}
    </div>
  );
}
