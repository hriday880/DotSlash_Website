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
    slug: 'future-of-data',
    title: 'THE FUTURE OF DATA ARCHITECTURE',
    excerpt: 'Examining the paradigm shift in low-latency processing pipelines.',
    author: 'SYSTEM ADMIN',
    author_role: 'LEAD ARCHITECT',
    tags: JSON.stringify(['DATA', 'ARCHITECTURE']),
    cover_image: null,
    status: 'published',
    accent: '#3300FF',
    content_path: '/blogs/future-of-data.md'
  },
  {
    slug: 'scaling-webgl',
    title: 'SCALING WEBGL PERFORMANCES',
    excerpt: 'Techniques for maintaining 60FPS in complex 3D web environments.',
    author: 'RENDER.BOT',
    author_role: 'GRAPHICS ENGINEER',
    tags: JSON.stringify(['WEBGL', 'PERFORMANCE']),
    cover_image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80',
    status: 'published',
    accent: '#00D4FF',
    content_path: '/blogs/scaling-webgl.md'
  },
  {
    slug: 'designing-interfaces',
    title: 'BRUTALIST INTERFACE DESIGN',
    excerpt: 'Why strict constraints lead to better user experiences.',
    author: 'UX_MODULE',
    author_role: 'DESIGN RESEARCH',
    tags: JSON.stringify(['DESIGN', 'UI']),
    cover_image: null,
    status: 'published',
    accent: '#1f1f1f',
    content_path: '/blogs/designing-interfaces.md'
  },
  {
    slug: 'distributed-systems',
    title: 'DISTRIBUTED CONSENSUS',
    excerpt: 'A deep dive into modern consensus algorithms.',
    author: 'SYSTEM ADMIN',
    author_role: 'LEAD ARCHITECT',
    tags: JSON.stringify(['SYSTEMS', 'BACKEND']),
    cover_image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80',
    status: 'published',
    accent: '#3300FF',
    content_path: '/blogs/distributed-systems.md'
  },
  {
    slug: 'cyber-security',
    title: 'ZERO TRUST NETWORKS',
    excerpt: 'Implementing zero trust in legacy architectures.',
    author: 'SEC_OP',
    author_role: 'SECURITY LEAD',
    tags: JSON.stringify(['SECURITY', 'INFRA']),
    cover_image: null,
    status: 'published',
    accent: '#A0A0A0',
    content_path: '/blogs/cyber-security.md'
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
