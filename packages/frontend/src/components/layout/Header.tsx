import { Bell, LogOut, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useClientStore } from '@/stores/clientStore';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { useQuery } from '@tanstack/react-query';
import type { Alert } from '@/types';

export function Header(): JSX.Element {
  const { user, logout } = useAuthStore();
  const { activeClient } = useClientStore();
  const navigate = useNavigate();

  const { data: openAlerts } = useQuery<Alert[]>({
    queryKey: ['alerts-count', activeClient?.id],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { data: Alert[] } }>(
        `/alerts?clientId=${activeClient?.id}&status=OPEN&limit=10`,
      );
      return res.data.data.data;
    },
    enabled: !!activeClient,
    refetchInterval: 60000,
  });

  const criticalCount = openAlerts?.filter((a) => a.severity === 'CRITICAL').length ?? 0;

  const handleLogout = async (): Promise<void> => {
    const refreshToken = useAuthStore.getState().refreshToken;
    try {
      await api.post('/auth/logout', { refreshToken });
    } catch {
      // ignore
    }
    logout();
    navigate('/login');
  };

  return (
    <header className="h-14 bg-nazar-surface border-b border-nazar-border flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        {activeClient && (
          <>
            <span className="text-nazar-muted text-sm">Active Profile:</span>
            <span className="text-nazar-text font-medium text-sm">{activeClient.name}</span>
            {activeClient.party && (
              <span className="badge-info">{activeClient.party}</span>
            )}
            {activeClient.state && (
              <span className="badge-neutral">{activeClient.state}</span>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Real-time refresh indicator */}
        <div className="flex items-center gap-1.5 text-emerald-400 text-xs">
          <RefreshCw size={11} className="animate-spin" style={{ animationDuration: '3s' }} />
          <span>Live</span>
        </div>

        {/* Alert bell */}
        <button
          onClick={() => navigate('/alerts')}
          className="relative p-2 text-nazar-text-secondary hover:text-nazar-text transition-colors"
        >
          <Bell size={18} />
          {criticalCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center animate-pulse-threat">
              {criticalCount}
            </span>
          )}
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-nazar-text-secondary hover:text-nazar-text text-sm transition-colors"
        >
          <LogOut size={15} />
          <span className="hidden sm:block">Logout</span>
        </button>
      </div>
    </header>
  );
}
