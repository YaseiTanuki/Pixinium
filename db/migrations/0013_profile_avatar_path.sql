-- Avatar image bytes live in the private `pixinium` bucket under profile/avatar/.
-- Store only the stable object key; signed URLs are generated per request.
ALTER TABLE catalog.profiles
  ADD COLUMN avatar_path text CHECK (
    avatar_path IS NULL OR avatar_path ~ '^profile/avatar/[0-9a-f-]+\.[a-z0-9]+$'
  );
