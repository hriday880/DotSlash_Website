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

  const pipelineUrl = url.replace(/\/$/, '') + '/v2/pipeline';
  const sql = `SELECT * FROM blogs WHERE status = 'published' ORDER BY published_at DESC`;
  
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
  if (result.type === 'error') throw new Error(result.error.message);

  const cols = result.response.result.cols;
  const rawRows = result.response.result.rows;

  const rows = rawRows.map(row => {
    const obj = {};
    cols.forEach((col, i) => {
      const cell = row[i];
      obj[col.name] = cell.type === 'null' ? null : cell.value;
    });
    return obj;
  });

  fs.mkdirSync(path.join(process.cwd(), 'public/blogs'), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), 'public/blogs/blogs.json'), JSON.stringify(rows, null, 2));
  console.log(`✅ Successfully fetched ${rows.length} blogs and saved to public/blogs/blogs.json`);
}

fetchBlogs().catch(console.error);
