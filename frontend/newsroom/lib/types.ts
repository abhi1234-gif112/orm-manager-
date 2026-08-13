// Mirrors backend/app/schemas/source.py -- keep in sync manually until an OpenAPI
// codegen step is added in a later phase.

export type SourceType =
  | "rss"
  | "atom"
  | "web"
  | "youtube"
  | "official_release"
  | "press_release";

export type IngestionMethod = "rss_poll" | "web_scrape" | "api" | "manual";

export interface Source {
  id: string;
  name: string;
  url: string;
  source_type: SourceType;
  language: string | null;
  geography: string[] | null;
  category: string | null;
  reliability_score: number | null;
  ingestion_method: IngestionMethod;
  active: boolean;
  created_at: string;
  last_checked: string | null;
  last_success_at: string | null;
  failure_count: number;
}

export interface SourceCreateInput {
  name: string;
  url: string;
  source_type: SourceType;
  ingestion_method: IngestionMethod;
  language?: string;
  category?: string;
}

export type UserRole = "admin" | "editor" | "contributor" | "viewer";

export interface CurrentUser {
  id: string;
  email: string;
  display_name: string | null;
  role: UserRole;
  active: boolean;
}
