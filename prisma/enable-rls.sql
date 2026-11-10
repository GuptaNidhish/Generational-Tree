-- Supabase exposes the `public` schema through its Data API (PostgREST).
-- Enable RLS with no policies so the anon/authenticated roles cannot read or
-- write these tables via the public API key. Prisma connects as the table
-- owner (postgres), which bypasses RLS, so the app is unaffected.
-- Re-run after any `db push --force-reset` (npm run db:push does this).
ALTER TABLE public.person ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_child ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment ENABLE ROW LEVEL SECURITY;

-- At most one owner account. Prisma can't express a partial index, so it lives here.
CREATE UNIQUE INDEX IF NOT EXISTS admin_single_owner ON public.admin (role) WHERE role = 'owner';
