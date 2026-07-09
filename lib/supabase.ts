import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) are not set. Database operations will fail until configured.'
  );
}

// Fallback placeholders for build-time static generation to prevent createClient crashes
const buildTimeUrl = supabaseUrl || 'https://placeholder-project-url.supabase.co';
const buildTimeKey = supabaseAnonKey || 'placeholder-anon-key';

export const supabase = createClient(buildTimeUrl, buildTimeKey);
