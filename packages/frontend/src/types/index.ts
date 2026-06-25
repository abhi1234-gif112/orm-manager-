export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'ANALYST' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  lastLoginAt?: string;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  nameHindi?: string;
  type: 'POLITICIAN' | 'PARTY' | 'ORGANIZATION' | 'MINISTRY';
  tier: 'NATIONAL' | 'STATE' | 'DISTRICT' | 'LOCAL';
  party?: string;
  constituency?: string;
  state?: string;
  bio?: string;
  photoUrl?: string;
  keywords: string[];
  twitterHandle?: string;
  _count?: { mentions: number; alerts: number; individuals: number };
}

export type PoliticalSentiment =
  | 'STRONGLY_POSITIVE'
  | 'POSITIVE'
  | 'NEUTRAL'
  | 'NEGATIVE'
  | 'STRONGLY_NEGATIVE'
  | 'MIXED';

export type ContentTone =
  | 'SUPPORTIVE'
  | 'CRITICAL'
  | 'INFLAMMATORY'
  | 'SATIRICAL'
  | 'FACTUAL'
  | 'MISINFORMATION'
  | 'THREATENING'
  | 'NEUTRAL';

export type MentionSource =
  | 'TWITTER'
  | 'FACEBOOK'
  | 'INSTAGRAM'
  | 'YOUTUBE'
  | 'LINKEDIN'
  | 'TELEGRAM'
  | 'REDDIT'
  | 'WHATSAPP_UPLOAD'
  | 'HINDI_NEWS'
  | 'ENGLISH_NEWS'
  | 'WEB'
  | 'MANUAL';

export interface Mention {
  id: string;
  clientId: string;
  source: MentionSource;
  sourceUrl?: string;
  authorHandle?: string;
  authorName?: string;
  authorFollowers?: number;
  authorVerified: boolean;
  platform: string;
  contentOriginal: string;
  contentSummaryEn?: string;
  contentSummaryHi?: string;
  language: string;
  politicalSentiment?: PoliticalSentiment;
  contentTone?: ContentTone;
  sentimentScore?: number;
  topics: string[];
  isDisinformation: boolean;
  threatLevel?: number;
  likes: number;
  shares: number;
  comments: number;
  views: number;
  reachEstimate: number;
  processedByAI: boolean;
  publishedAt?: string;
  createdAt: string;
  individual?: { id: string; name: string; stance: string } | null;
}

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type AlertType =
  | 'VIRAL_NEGATIVE'
  | 'DISINFORMATION'
  | 'COORDINATED_ATTACK'
  | 'SENTIMENT_SHIFT'
  | 'THREAT_ACTOR'
  | 'CRISIS'
  | 'OPPORTUNITY'
  | 'COMPETITOR_MOVE'
  | 'MEDIA_SPIKE';
export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED';

export interface Alert {
  id: string;
  clientId: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  description: string;
  aiSummary?: string;
  recommendedActions: string[];
  createdAt: string;
  resolvedAt?: string;
  acknowledgedAt?: string;
}

export type IndividualStance = 'ALLY' | 'THREAT' | 'WATCHLIST' | 'NEUTRAL';
export type IndividualType =
  | 'POLITICIAN'
  | 'JOURNALIST'
  | 'INFLUENCER'
  | 'ACTIVIST'
  | 'BUREAUCRAT'
  | 'ACADEMIC'
  | 'TROLL_NETWORK'
  | 'BOT_ACCOUNT'
  | 'UNKNOWN';

export interface Individual {
  id: string;
  name: string;
  nameHindi?: string;
  type: IndividualType;
  party?: string;
  twitterHandle?: string;
  totalFollowers: number;
  influenceScore: number;
  riskScore: number;
  stanceScore: number;
  stance: IndividualStance;
  _count?: { mentions: number };
  clientProfiles?: Array<{ stanceOverride?: IndividualStance; notes?: string }>;
}

export type AssetType =
  | 'COUNTER_BRIEF'
  | 'RAPID_RESPONSE_TWEET'
  | 'PRESS_STATEMENT'
  | 'PRESS_KIT'
  | 'WHATSAPP_FORWARD'
  | 'SOCIAL_CAPTION'
  | 'TALKING_POINTS'
  | 'FACT_CHECK'
  | 'NARRATIVE_MEMO'
  | 'MEDIA_PITCH'
  | 'CRISIS_STATEMENT';

export interface ResponseAsset {
  id: string;
  clientId: string;
  type: AssetType;
  status: 'DRAFT' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';
  title: string;
  contentEn: string;
  contentHi?: string;
  context?: string;
  createdAt: string;
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

export interface DashboardData {
  mentionVolume: number;
  sentimentBreakdown: Array<{ politicalSentiment: string; _count: number }>;
  topTopics: Array<{ topic: string; count: number }>;
  recentAlerts: Alert[];
  volumeBySource: Array<{ source: string; _count: number }>;
}
