CREATE TABLE IF NOT EXISTS blogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  author TEXT,
  author_role TEXT,
  tags TEXT,
  cover_image TEXT,
  published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'published',
  featured BOOLEAN DEFAULT 0,
  accent TEXT,
  content_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
