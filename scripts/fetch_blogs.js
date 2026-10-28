import fs from 'fs';
import path from 'path';

// Parse .env and .env.local
function loadEnv() {
  const env = { ...process.env };
  const loadFile = (file) => {
    try {
      const src = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      src.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          let val = match[2].trim();
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          env[match[1]] = val;
        }
      });
    } catch (e) {
      // ignore missing files
    }
  };
  loadFile('.env');
  loadFile('.env.local');
  return env;
}

const env = loadEnv();
const url = env.VITE_TURSO_DATABASE_URL;
const token = env.VITE_TURSO_AUTH_TOKEN;

async function fetchBlogs() {
  if (!url || !token) {
    console.warn('⚠️ No Turso credentials found. Using existing blogs.json or mock data.');
    return;
  }

  const blogsJsonPath = path.join(process.cwd(), 'public/blogs/blogs.json');
  let existingBySlug = new Map();
  try {
    const existing = JSON.parse(fs.readFileSync(blogsJsonPath, 'utf8'));
    if (Array.isArray(existing)) {
      existing.forEach((b) => {
        if (b?.slug) existingBySlug.set(b.slug, b);
      });
    }
  } catch {
    // ignore missing or invalid file
  }

  const pipelineUrl = url.replace(/\/$/, '') + '/v2/pipeline';
  const sql = `SELECT * FROM newsletters ORDER BY date DESC, created_at DESC`;

  const res = await fetch(pipelineUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        { type: 'execute', stmt: { sql, args: [] } }
      ]
    })
  });

  if (!res.ok) {
    throw new Error(`Turso HTTP error: ${res.status}`);
  }

  const data = await res.json();
  const result = data.results[0];
  if (result.type === 'error') {
    if (/no such table/i.test(result.error.message || '')) {
      console.log('ℹ️ Newsletters table not initialized yet; retaining bundled public/blogs/blogs.json.');
      return;
    }
    throw new Error(result.error.message);
  }

  const cols = result.response.result.cols;
  const rawRows = result.response.result.rows;

  const dbRows = rawRows.map((row) => {
    const obj = {};
    cols.forEach((col, i) => {
      const cell = row[i];
      obj[col.name] = cell.type === 'null' ? null : cell.value;
    });
    return obj;
  });

  if (dbRows.length === 0) {
    console.log('ℹ️ No newsletter rows in DB yet; retaining bundled public/blogs/blogs.json.');
    return;
  }

  const rows = dbRows.map((row, idx) => {
    let pages = [];
    try {
      pages = JSON.parse(row.pages || '[]');
    } catch {
      pages = [];
    }
    const prev = existingBySlug.get(row.slug) || {};
    return {
      id: prev.id ?? row.id ?? idx + 1,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt ?? prev.excerpt ?? null,
      author: row.author || prev.author || 'DOTSLASH',
      author_role: prev.author_role ?? null,
      tags: prev.tags ?? null,
      cover_image: prev.cover_image ?? null,
      published_at: row.date || row.created_at || prev.published_at,
      status: 'published',
      featured: prev.featured ?? 0,
      accent: prev.accent || '#3300FF',
      content_path: prev.content_path ?? null,
      front_image: pages[0] || prev.front_image || null,
      page_images: pages.length ? pages : (prev.page_images || []),
      pdf_path: row.pdf_url || prev.pdf_path || null,
    };
  });

  fs.mkdirSync(path.join(process.cwd(), 'public/blogs'), { recursive: true });
  fs.writeFileSync(blogsJsonPath, JSON.stringify(rows, null, 2) + '\n');
  console.log(`✅ Successfully synced ${rows.length} newsletter issue(s) to public/blogs/blogs.json`);
}

fetchBlogs().catch(console.error);
