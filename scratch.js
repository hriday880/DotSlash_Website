import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const DB_URL = env.match(/VITE_TURSO_DATABASE_URL="?(.*?)"?$/m)[1];
const DB_TOKEN = env.match(/VITE_TURSO_AUTH_TOKEN="?(.*?)"?$/m)[1];

async function run() {
  const query = 'ALTER TABLE blogs ADD COLUMN views INTEGER DEFAULT 0';
  const res = await fetch(`${DB_URL}/v2/pipeline`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DB_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      requests: [{ type: 'execute', stmt: { sql: query, args: [] } }]
    })
  });
  const data = await res.json();
  console.log(JSON.stringify(data));
}
run();
