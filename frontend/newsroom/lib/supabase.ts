import { createClient } from "@supabase/supabase-js";

// NEXT_PUBLIC_* vars are inlined at build time, so a real deployment must pass
// them as Docker build args (see Dockerfile / docker-compose.saptanga.yml), not
// just container runtime env. The fallback below only prevents `next build`
// from crashing when unset locally -- it is never a working Supabase project.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

// Auth happens against Supabase directly from the browser; the backend never
// sees a password, only the resulting JWT (verified in backend/app/core/security.py).
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
