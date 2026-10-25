-- Supabase exposes the `public` schema through its Data API (PostgREST).
-- Enable RLS with no policies so the anon/authenticated roles cannot read or
-- write these tables via the public API key. Prisma connects as the table
-- owner (postgres), which bypasses RLS, so the app is unaffected.
-- Re-run after any `db push --force-reset` (npm run db:push does this).
ALTER TABLE public.person ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_child ENABLE ROW LEVEL SECURITY;
