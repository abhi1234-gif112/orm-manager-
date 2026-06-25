import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Bell,
  Users,
  FileText,
  BarChart3,
  Settings,
  Eye,
  Zap,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useClientStore } from '@/stores/clientStore';
import { useAuthStore } from '@/stores/authStore';
import { useState } from 'react';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/mentions', label: 'Mentions', icon: MessageSquare },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/individuals', label: 'Individuals', icon: Users },
  { to: '/assets', label: 'Response Assets', icon: FileText },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar(): JSX.Element {
  const { activeClient } = useClientStore();
  const { user } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-nazar-surface border-r border-nazar-border transition-all duration-300',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-nazar-border">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-nazar-accent flex items-center justify-center">
          <Eye size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <span className="text-white font-bold tracking-wider text-lg">NAZAR</span>
            <p className="text-nazar-muted text-[10px] leading-none">Political Intelligence</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto text-nazar-muted hover:text-nazar-text"
        >
          <ChevronDown size={14} className={cn('transition-transform', collapsed ? '-rotate-90' : 'rotate-90')} />
        </button>
      </div>

      {/* Active client indicator */}
      {activeClient && !collapsed && (
        <div className="mx-3 mt-3 px-3 py-2 bg-nazar-accent/10 border border-nazar-accent/30 rounded-lg">
          <p className="text-[10px] text-nazar-muted uppercase tracking-wider mb-0.5">Monitoring</p>
          <p className="text-sm text-nazar-accent font-medium truncate">{activeClient.name}</p>
          {activeClient.nameHindi && (
            <p className="text-[11px] text-nazar-muted text-hindi truncate">{activeClient.nameHindi}</p>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-nazar-accent/15 text-nazar-accent border border-nazar-accent/30'
                  : 'text-nazar-text-secondary hover:text-nazar-text hover:bg-nazar-border/50',
              )
            }
          >
            <Icon size={18} className="flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User badge */}
      {user && (
        <div className={cn('px-3 py-4 border-t border-nazar-border', collapsed && 'px-2')}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-nazar-accent/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs text-nazar-accent font-bold">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-sm font-medium text-nazar-text truncate">{user.name}</p>
                <p className="text-[11px] text-nazar-muted">{user.role}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
