import { useQuery } from '@tanstack/react-query';
import { Building2, MapPin, Tag, ArrowRight } from 'lucide-react';
import api from '@/services/api';
import { useClientStore } from '@/stores/clientStore';
import { useNavigate } from 'react-router-dom';
import type { Client, PaginatedResponse } from '@/types';

export function ClientsPage(): JSX.Element {
  const { setActiveClient, activeClient } = useClientStore();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery<PaginatedResponse<Client>>({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: PaginatedResponse<Client> }>('/clients?limit=50');
      return res.data.data;
    },
  });

  const selectClient = (client: Client): void => {
    setActiveClient(client);
    navigate('/dashboard');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-nazar-text">Client Profiles</h1>
        <p className="text-nazar-muted text-sm mt-0.5">Select a profile to begin monitoring</p>
      </div>

      {isLoading && (
        <div className="text-nazar-muted text-center py-16">Loading profiles...</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data?.data.map((client) => (
          <button
            key={client.id}
            onClick={() => selectClient(client)}
            className={`w-full text-left card hover:border-nazar-accent/50 transition-all group ${
              activeClient?.id === client.id ? 'border-nazar-accent/60 bg-nazar-accent/5' : ''
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-nazar-accent/15 flex items-center justify-center flex-shrink-0">
                {client.photoUrl ? (
                  <img src={client.photoUrl} alt={client.name} className="w-12 h-12 rounded-xl object-cover" />
                ) : (
                  <span className="text-xl font-bold text-nazar-accent">{client.name.charAt(0)}</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-nazar-text">{client.name}</p>
                    {client.nameHindi && (
                      <p className="text-sm text-nazar-muted text-hindi">{client.nameHindi}</p>
                    )}
                  </div>
                  <ArrowRight
                    size={16}
                    className="text-nazar-muted group-hover:text-nazar-accent transition-colors flex-shrink-0 mt-1"
                  />
                </div>

                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="badge-info">{client.type}</span>
                  {client.party && <span className="badge-neutral">{client.party}</span>}
                  {client.tier && <span className="badge-neutral">{client.tier}</span>}
                </div>

                <div className="flex items-center gap-3 mt-2 text-xs text-nazar-muted">
                  {client.state && (
                    <span className="flex items-center gap-1">
                      <MapPin size={11} />
                      {client.constituency ? `${client.constituency}, ` : ''}{client.state}
                    </span>
                  )}
                </div>

                {client._count && (
                  <div className="flex items-center gap-4 mt-2 text-xs text-nazar-muted">
                    <span>{client._count.mentions.toLocaleString()} mentions</span>
                    <span className={client._count.alerts > 0 ? 'text-amber-400' : ''}>
                      {client._count.alerts} alerts
                    </span>
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
