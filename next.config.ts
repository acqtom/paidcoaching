import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Vercel Supabase integration sets its own env var names
  // (NEXT_PUBLIC_SUPABASE_URL, but SUPABASE_ANON_KEY / SUPABASE_PUBLISHABLE_KEY
  // without a NEXT_PUBLIC_ prefix). This re-exposes the key under the name
  // our Supabase clients read, falling back for local dev where
  // NEXT_PUBLIC_SUPABASE_ANON_KEY is already set directly in .env.local.
  env: {
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.SUPABASE_PUBLISHABLE_KEY ??
      process.env.SUPABASE_ANON_KEY,
  },
};

export default nextConfig;
