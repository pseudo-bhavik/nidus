-- ==============================================================================
-- 🔒 NIDUS WORKSPACE — STRICT ROW-LEVEL SECURITY & DATA ISOLATION MIGRATION
-- Run this in your Supabase SQL Editor to guarantee 100% private data isolation
-- ==============================================================================

-- 1. CLEAN UP: Remove any orphaned or legacy public test records with NULL user_id
DELETE FROM public.calendar_events WHERE user_id IS NULL;
DELETE FROM public.sticky_notes WHERE user_id IS NULL;
DELETE FROM public.whiteboard_docs WHERE user_id IS NULL;
DELETE FROM public.vault_sections WHERE user_id IS NULL;
DELETE FROM public.bookmarks WHERE user_id IS NULL;

-- 2. CALENDAR EVENTS: Enable RLS & Strict User Isolation
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can view their own calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can insert their own calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can update their own calendar events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can delete their own calendar events" ON public.calendar_events;

CREATE POLICY "calendar_events_strict_user_isolation"
  ON public.calendar_events
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. STICKY NOTES: Enable RLS & Strict User Isolation
ALTER TABLE public.sticky_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own sticky notes" ON public.sticky_notes;
DROP POLICY IF EXISTS "sticky_notes_user_isolation" ON public.sticky_notes;

CREATE POLICY "sticky_notes_strict_user_isolation"
  ON public.sticky_notes
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. WHITEBOARD CANVAS DOCS: Enable RLS & Strict User Isolation
ALTER TABLE public.whiteboard_docs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own whiteboard docs" ON public.whiteboard_docs;
DROP POLICY IF EXISTS "whiteboard_docs_user_isolation" ON public.whiteboard_docs;

CREATE POLICY "whiteboard_docs_strict_user_isolation"
  ON public.whiteboard_docs
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. LINK VAULT SECTIONS: Enable RLS & Strict User Isolation
ALTER TABLE public.vault_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own vault sections" ON public.vault_sections;
DROP POLICY IF EXISTS "vault_sections_user_isolation" ON public.vault_sections;

CREATE POLICY "vault_sections_strict_user_isolation"
  ON public.vault_sections
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. BOOKMARKS: Enable RLS & Strict User Isolation
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own bookmarks" ON public.bookmarks;
DROP POLICY IF EXISTS "bookmarks_user_isolation" ON public.bookmarks;

CREATE POLICY "bookmarks_strict_user_isolation"
  ON public.bookmarks
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
