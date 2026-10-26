-- Existing usernames remain intact. New assignments must be 3-12 characters.
CREATE FUNCTION catalog.protect_username() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.username IS NOT NULL AND NEW.username IS DISTINCT FROM OLD.username THEN
      RAISE EXCEPTION 'Username cannot be changed' USING ERRCODE = '23514';
    END IF;
    IF NEW.username IS NOT DISTINCT FROM OLD.username THEN
      RETURN NEW;
    END IF;
  END IF;
  IF NEW.username IS NOT NULL AND NEW.username !~ '^[a-z0-9_]{3,12}$' THEN
    RAISE EXCEPTION 'Username must be 3-12 lowercase letters, numbers or underscores' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION catalog.protect_username() FROM PUBLIC;
CREATE TRIGGER profiles_permanent_username BEFORE INSERT OR UPDATE ON catalog.profiles
  FOR EACH ROW EXECUTE FUNCTION catalog.protect_username();
