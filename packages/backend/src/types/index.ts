import type { User } from '@prisma/client';

// Extend Express Request with authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: Pick<User, 'id' | 'email' | 'role' | 'name'>;
      clientId?: string;
    }
  }
}

// Political topic taxonomy — fixed classification set
export const POLITICAL_TOPICS = [
  'governance',
  'corruption',
  'development',
  'healthcare',
  'education',
  'economy',
  'inflation',
  'security',
  'communal',
  'caste',
  'election',
  'policy',
  'infrastructure',
  'environment',
  'agriculture',
  'women_safety',
  'youth',
  'foreign_affairs',
  'defence',
  'judiciary',
  'media',
  'party_politics',
  'personal_attack',
  'disinformation',
  'protest',
  'scam',
  'welfare',
  'religious',
  'constitutional',
] as const;

export type PoliticalTopic = (typeof POLITICAL_TOPICS)[number];

// Claude AI response types
export interface AIAnalysisResult {
  politicalSentiment: string;
  contentTone: string;
  sentimentScore: number;        // -1.0 to 1.0
  topics: PoliticalTopic[];
  namedEntities: {
    politicians: string[];
    parties: string[];
    places: string[];
    organizations: string[];
  };
  isDisinformation: boolean;
  threatLevel: number;           // 0–10
  summaryEn: string;
  summaryHi: string;
  detectedLanguage: string;
}

export interface IndividualScores {
  influenceScore: number;        // 0–100
  riskScore: number;             // 0–100
  stanceScore: number;           // -1.0 to 1.0
  stance: 'ALLY' | 'THREAT' | 'WATCHLIST' | 'NEUTRAL';
}

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export type JobName =
  | 'ingest.twitter'
  | 'ingest.facebook'
  | 'ingest.youtube'
  | 'ingest.telegram'
  | 'ingest.news.hindi'
  | 'ingest.news.english'
  | 'ingest.reddit'
  | 'ai.analyze.mention'
  | 'ai.score.individual'
  | 'ai.generate.asset'
  | 'alert.evaluate'
  | 'analytics.snapshot';
