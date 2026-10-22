CREATE TABLE IF NOT EXISTS archive_items (
  title text PRIMARY KEY,
  category text NOT NULL CHECK (category IN ('Wallpapers', 'Music', 'Games')),
  meta text NOT NULL,
  image text,
  crop text,
  color text NOT NULL,
  accent text CHECK (accent IS NULL OR accent = 'music'),
  sort_order integer NOT NULL
);
