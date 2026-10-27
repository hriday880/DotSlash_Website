import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
const envSource = fs.readFileSync(envPath, 'utf8');
const env = {};
envSource.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1];
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[key] = val;
  }
});

const url = env.VITE_TURSO_DATABASE_URL;
const token = env.VITE_TURSO_AUTH_TOKEN;

async function execute(sql, args = []) {
  const pipelineUrl = url.replace(/\/$/, '') + '/v2/pipeline';
  const formattedArgs = args.map(a => {
    if (a === null || a === undefined) return { type: 'null' };
    if (typeof a === 'number') return { type: 'integer', value: String(a) };
    return { type: 'text', value: String(a) };
  });

  const res = await fetch(pipelineUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        { type: 'execute', stmt: { sql, args: formattedArgs } }
      ]
    })
  });

  if (!res.ok) {
    console.error(`Turso HTTP error: ${res.status}`);
    const text = await res.text();
    console.error(text);
    process.exit(1);
  }

  const data = await res.json();
  const result = data.results[0];
  if (result.type === 'error') {
    throw new Error(result.error.message);
  }
  return result;
}

const schema = `
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
`;

const sampleBlogs = [
  {
    slug: 'tag-youre-built',
    title: "TAG, YOU'RE BUILT!",
    excerpt: 'Nothing worked the first time. Or the second. Here’s how we built the infrastructure for our laser tag event.',
    author: 'DOTSLASH',
    author_role: null,
    tags: JSON.stringify(['HARDWARE', 'LASER TAG']),
    cover_image: null,
    status: 'published',
    accent: '#3300FF',
    content_path: '/blogs/tag-youre-built.md'
  }
];

async function run() {
  console.log('Creating schema...');
  await execute(schema);
  console.log('Schema created.');

  console.log('Clearing old blogs...');
  await execute('DELETE FROM blogs');

  console.log('Inserting seed data...');
  for (const blog of sampleBlogs) {
    await execute(
      `INSERT INTO blogs (slug, title, excerpt, author, author_role, tags, cover_image, status, accent, content_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        blog.slug,
        blog.title,
        blog.excerpt,
        blog.author,
        blog.author_role,
        blog.tags,
        blog.cover_image,
        blog.status,
        blog.accent,
        blog.content_path
      ]
    );
  }
  console.log('Done!');
}

run().catch(console.error);
