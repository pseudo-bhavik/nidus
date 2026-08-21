-- ==============================================================================
-- Nidus: Supabase Database Schema for Link Vault
-- ==============================================================================
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- to enable cloud database synchronization for the Link Vault feature.
-- ==============================================================================

-- 1. Create the vault_sections table
CREATE TABLE IF NOT EXISTS public.vault_sections (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  color TEXT DEFAULT 'emerald',
  links JSONB DEFAULT '[]'::jsonb,
  subsections JSONB DEFAULT '[]'::jsonb,
  is_collapsed BOOLEAN DEFAULT false,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create index on user_id and position for high-performance querying
CREATE INDEX IF NOT EXISTS idx_vault_sections_user_id ON public.vault_sections(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_sections_position ON public.vault_sections(position);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.vault_sections ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for authenticated and guest users
-- SELECT Policy
CREATE POLICY "Users can view their own vault sections"
  ON public.vault_sections
  FOR SELECT
  USING (
    auth.uid() = user_id OR user_id IS NULL
  );

-- INSERT Policy
CREATE POLICY "Users can insert their own vault sections"
  ON public.vault_sections
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR user_id IS NULL
  );

-- UPDATE Policy
CREATE POLICY "Users can update their own vault sections"
  ON public.vault_sections
  FOR UPDATE
  USING (
    auth.uid() = user_id OR user_id IS NULL
  )
  WITH CHECK (
    auth.uid() = user_id OR user_id IS NULL
  );

-- DELETE Policy
CREATE POLICY "Users can delete their own vault sections"
  ON public.vault_sections
  FOR DELETE
  USING (
    auth.uid() = user_id OR user_id IS NULL
  );
