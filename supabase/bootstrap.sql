-- Bootstrap for a brand-new LifeOS Supabase project only.
-- The live project created this table before migration history was enabled.
CREATE TABLE public.lifeos_workspace (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lifeos_workspace ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own workspace"
  ON public.lifeos_workspace FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can read their own workspace"
  ON public.lifeos_workspace FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own workspace"
  ON public.lifeos_workspace FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE ON TABLE public.lifeos_workspace TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.lifeos_workspace TO service_role;
