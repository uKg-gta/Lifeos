ALTER TABLE public.lifeos_workspace
  ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 1;

ALTER TABLE public.lifeos_workspace
  ADD CONSTRAINT lifeos_workspace_revision_positive CHECK (revision > 0);

CREATE OR REPLACE FUNCTION public.save_lifeos_workspace(p_data jsonb, p_expected_revision bigint)
RETURNS TABLE(saved boolean, new_revision bigint)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_revision bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_data IS NULL OR p_expected_revision IS NULL OR p_expected_revision < 0 THEN
    RAISE EXCEPTION 'Invalid workspace payload or revision';
  END IF;

  IF p_expected_revision = 0 THEN
    INSERT INTO public.lifeos_workspace (user_id, data, updated_at, revision)
    VALUES (v_user_id, p_data, now(), 1)
    ON CONFLICT (user_id) DO NOTHING
    RETURNING revision INTO v_revision;
  ELSE
    UPDATE public.lifeos_workspace AS w
       SET data = p_data,
           updated_at = now(),
           revision = w.revision + 1
     WHERE w.user_id = v_user_id
       AND w.revision = p_expected_revision
    RETURNING revision INTO v_revision;
  END IF;

  IF v_revision IS NULL THEN
    RETURN QUERY SELECT false, NULL::bigint;
  ELSE
    RETURN QUERY SELECT true, v_revision;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.save_lifeos_workspace(jsonb, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_lifeos_workspace(jsonb, bigint) TO authenticated;
