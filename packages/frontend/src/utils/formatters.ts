import { formatDistanceToNow, format } from 'date-fns';
import type { PoliticalSentiment, AlertSeverity, IndividualStance } from '@/types';

export function formatRelativeTime(date: string | undefined): string {
  if (!date) return '—';
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatDate(date: string | undefined): string {
  if (!date) return '—';
  return format(new Date(date), 'dd MMM yyyy, HH:mm');
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function sentimentLabel(s: PoliticalSentiment | undefined): string {
  const map: Record<PoliticalSentiment, string> = {
    STRONGLY_POSITIVE: 'Very Positive',
    POSITIVE: 'Positive',
    NEUTRAL: 'Neutral',
    NEGATIVE: 'Negative',
    STRONGLY_NEGATIVE: 'Very Negative',
    MIXED: 'Mixed',
  };
  return s ? (map[s] ?? s) : '—';
}

export function sentimentColor(s: PoliticalSentiment | undefined): string {
  if (!s) return 'text-nazar-muted';
  if (s === 'STRONGLY_POSITIVE' || s === 'POSITIVE') return 'text-emerald-400';
  if (s === 'STRONGLY_NEGATIVE' || s === 'NEGATIVE') return 'text-red-400';
  if (s === 'MIXED') return 'text-amber-400';
  return 'text-nazar-muted';
}

export function severityColor(severity: AlertSeverity): string {
  const map: Record<AlertSeverity, string> = {
    CRITICAL: 'text-red-400',
    HIGH: 'text-orange-400',
    MEDIUM: 'text-amber-400',
    LOW: 'text-blue-400',
    INFO: 'text-gray-400',
  };
  return map[severity];
}

export function severityBadgeClass(severity: AlertSeverity): string {
  const map: Record<AlertSeverity, string> = {
    CRITICAL: 'badge-threat',
    HIGH: 'bg-orange-900/40 text-orange-400 border border-orange-800/60 text-xs px-2 py-0.5 rounded-full font-medium',
    MEDIUM: 'badge-warning',
    LOW: 'badge-info',
    INFO: 'badge-neutral',
  };
  return map[severity];
}

export function stanceColor(stance: IndividualStance): string {
  const map: Record<IndividualStance, string> = {
    ALLY: 'text-emerald-400',
    THREAT: 'text-red-400',
    WATCHLIST: 'text-amber-400',
    NEUTRAL: 'text-gray-400',
  };
  return map[stance];
}

export function stanceBadgeClass(stance: IndividualStance): string {
  const map: Record<IndividualStance, string> = {
    ALLY: 'badge-success',
    THREAT: 'badge-threat',
    WATCHLIST: 'badge-warning',
    NEUTRAL: 'badge-neutral',
  };
  return map[stance];
}

export function sourceIcon(source: string): string {
  const icons: Record<string, string> = {
    TWITTER: '𝕏',
    FACEBOOK: 'fb',
    INSTAGRAM: 'ig',
    YOUTUBE: '▶',
    TELEGRAM: '✈',
    REDDIT: '⬆',
    WHATSAPP_UPLOAD: '📱',
    HINDI_NEWS: '📰',
    ENGLISH_NEWS: '🗞',
    LINKEDIN: 'in',
    WEB: '🌐',
    MANUAL: '✍',
  };
  return icons[source] ?? '•';
}
