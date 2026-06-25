import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Upload, RefreshCw, ExternalLink, Cpu } from 'lucide-react';
import api from '@/services/api';
import { useClientStore } from '@/stores/clientStore';
import { Navigate } from 'react-router-dom';
import type { Mention, PaginatedResponse, MentionSource } from '@/types';
import {
  formatRelativeTime,
  sentimentColor,
  formatNumber,
  sourceIcon,
} from '@/utils/formatters';

const SOURCES: MentionSource[] = [
  'TWITTER', 'FACEBOOK', 'INSTAGRAM', 'YOUTUBE', 'TELEGRAM',
  'REDDIT', 'HINDI_NEWS', 'ENGLISH_NEWS', 'WHATSAPP_UPLOAD',
];

const SENTIMENTS = ['STRONGLY_POSITIVE', 'POSITIVE', 'NEUTRAL', 'NEGATIVE', 'STRONGLY_NEGATIVE', 'MIXED'];

export function MentionsPage(): JSX.Element {
  const { activeClient } = useClientStore();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [sentiment, setSentiment] = useState('');
  const [selectedMention, setSelectedMention] = useState<Mention | null>(null);

  const { data, isLoading, refetch } = useQuery<PaginatedResponse<Mention>>({
    queryKey: ['mentions', activeClient?.id, page, search, source, sentiment],
    queryFn: async () => {
      const params = new URLSearchParams({
        clientId: activeClient!.id,
        page: String(page),
        limit: '20',
        ...(search && { search }),
        ...(source && { source }),
        ...(sentiment && { sentiment }),
      });
      const res = await api.get<{ success: boolean; data: PaginatedResponse<Mention> }>(
        `/mentions?${params}`,
      );
      return res.data.data;
    },
    enabled: !!activeClient,
  });

  if (!activeClient) return <Navigate to="/clients" replace />;

  return (
    <div className="flex gap-4 h-full">
      {/* List panel */}
      <div className="flex-1 space-y-4 min-w-0">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-nazar-text">Mentions Feed</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => refetch()} className="btn-ghost text-xs flex items-center gap-1.5">
              <RefreshCw size={13} />
              Refresh
            </button>
            <button className="btn-ghost text-xs flex items-center gap-1.5">
              <Upload size={13} />
              Upload WhatsApp
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nazar-muted" />
            <input
              className="input pl-9 w-48 text-sm h-9"
              placeholder="Search mentions..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          <select
            className="input w-36 text-sm h-9"
            value={source}
            onChange={(e) => { setSource(e.target.value); setPage(1); }}
          >
            <option value="">All Sources</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>

          <select
            className="input w-44 text-sm h-9"
            value={sentiment}
            onChange={(e) => { setSentiment(e.target.value); setPage(1); }}
          >
            <option value="">All Sentiments</option>
            {SENTIMENTS.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        {/* Mentions list */}
        {isLoading ? (
          <div className="text-nazar-muted text-center py-12">Loading mentions...</div>
        ) : (
          <div className="space-y-2">
            {data?.data.map((mention) => (
              <button
                key={mention.id}
                onClick={() => setSelectedMention(mention)}
                className={`w-full text-left card hover:border-nazar-accent/40 transition-colors ${
                  selectedMention?.id === mention.id ? 'border-nazar-accent/60' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-nazar-border flex items-center justify-center flex-shrink-0 text-xs font-bold text-nazar-muted">
                    {sourceIcon(mention.source)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-nazar-text truncate">
                        {mention.authorName ?? mention.authorHandle ?? 'Unknown'}
                      </span>
                      {mention.authorVerified && (
                        <span className="text-blue-400 text-xs">✓</span>
                      )}
                      <span className="text-xs text-nazar-muted ml-auto flex-shrink-0">
                        {formatRelativeTime(mention.publishedAt ?? mention.createdAt)}
                      </span>
                    </div>

                    <p className="text-sm text-nazar-text-secondary line-clamp-2">
                      {mention.contentSummaryEn ?? mention.contentOriginal}
                    </p>

                    {mention.language === 'hi' && mention.contentSummaryHi && (
                      <p className="text-xs text-nazar-muted text-hindi mt-1 line-clamp-1">
                        {mention.contentSummaryHi}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-2">
                      {mention.politicalSentiment && (
                        <span className={`text-xs ${sentimentColor(mention.politicalSentiment)}`}>
                          {mention.politicalSentiment.replace(/_/g, ' ')}
                        </span>
                      )}
                      {(mention.threatLevel ?? 0) >= 7 && (
                        <span className="badge-threat">⚠ Threat {mention.threatLevel}</span>
                      )}
                      {mention.isDisinformation && (
                        <span className="badge-warning">Disinfo</span>
                      )}
                      {!mention.processedByAI && (
                        <span className="badge-neutral flex items-center gap-1">
                          <Cpu size={10} /> Queued
                        </span>
                      )}
                      <div className="ml-auto flex items-center gap-2 text-xs text-nazar-muted">
                        <span>❤ {formatNumber(mention.likes)}</span>
                        <span>🔁 {formatNumber(mention.shares)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Pagination */}
        {data && data.pagination.pages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-40"
            >
              Prev
            </button>
            <span className="text-xs text-nazar-muted">
              {page} / {data.pagination.pages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(data.pagination.pages, p + 1))}
              disabled={page === data.pagination.pages}
              className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedMention && (
        <div className="w-80 card h-fit sticky top-0 space-y-4 flex-shrink-0 animate-slide-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-nazar-text">Mention Detail</h3>
            <button
              onClick={() => setSelectedMention(null)}
              className="text-nazar-muted hover:text-nazar-text text-lg leading-none"
            >
              ×
            </button>
          </div>

          {selectedMention.sourceUrl && (
            <a
              href={selectedMention.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-nazar-accent hover:underline"
            >
              <ExternalLink size={12} /> View Original
            </a>
          )}

          <div>
            <p className="text-xs text-nazar-muted mb-1">Original Content</p>
            <p className="text-sm text-nazar-text-secondary leading-relaxed">
              {selectedMention.contentOriginal}
            </p>
          </div>

          {selectedMention.contentSummaryHi && (
            <div>
              <p className="text-xs text-nazar-muted mb-1">Hindi Summary</p>
              <p className="text-sm text-nazar-muted text-hindi leading-relaxed">
                {selectedMention.contentSummaryHi}
              </p>
            </div>
          )}

          {selectedMention.topics.length > 0 && (
            <div>
              <p className="text-xs text-nazar-muted mb-2">Topics</p>
              <div className="flex flex-wrap gap-1">
                {selectedMention.topics.map((t) => (
                  <span key={t} className="badge-info capitalize">
                    {t.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-nazar-muted mb-0.5">Sentiment</p>
              <p className={sentimentColor(selectedMention.politicalSentiment)}>
                {selectedMention.politicalSentiment?.replace(/_/g, ' ') ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-nazar-muted mb-0.5">Threat Level</p>
              <p className={selectedMention.threatLevel && selectedMention.threatLevel >= 7 ? 'text-red-400' : 'text-nazar-text'}>
                {selectedMention.threatLevel ?? '—'} / 10
              </p>
            </div>
            <div>
              <p className="text-nazar-muted mb-0.5">Reach Est.</p>
              <p className="text-nazar-text">{formatNumber(selectedMention.reachEstimate)}</p>
            </div>
            <div>
              <p className="text-nazar-muted mb-0.5">Language</p>
              <p className="text-nazar-text uppercase">{selectedMention.language}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
