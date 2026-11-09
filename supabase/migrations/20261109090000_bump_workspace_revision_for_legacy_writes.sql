-- Keep revision-based compare-and-swap safe while older deployed clients still
-- write lifeos_workspace directly with updated_at instead of calling the RPC.
CREATE OR REPLACE FUNCTION public.bump_lifeos_workspace_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- The RPC explicitly advances revision. Legacy clients do not, so advance it
  -- here to make their writes visible to every revision-aware client.
  IF NEW.revision IS NOT DISTINCT FROM OLD.revision THEN
    NEW.revision := OLD.revision + 1;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_lifeos_workspace_revision() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bump_lifeos_workspace_revision() TO authenticated, service_role;

DROP TRIGGER IF EXISTS lifeos_workspace_revision_guard ON public.lifeos_workspace;
CREATE TRIGGER lifeos_workspace_revision_guard
BEFORE UPDATE ON public.lifeos_workspace
FOR EACH ROW
EXECUTE FUNCTION public.bump_lifeos_workspace_revision();
