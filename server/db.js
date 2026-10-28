// Minimal Turso HTTP (/v2/pipeline) client. The token lives only on this server.

function toArg(a) {
  if (a === null || a === undefined) return { type: 'null' };
  if (typeof a === 'number') {
    return Number.isInteger(a)
      ? { type: 'integer', value: String(a) }
      : { type: 'float', value: a };
  }
  return { type: 'text', value: String(a) };
}

function toRows(result) {
  const { cols, rows } = result.response.result;
  return rows.map(row => {
    const obj = {};
    cols.forEach((col, i) => {
      const cell = row[i];
      if (cell.type === 'null') obj[col.name] = null;
      else if (cell.type === 'integer') obj[col.name] = Number(cell.value);
      else obj[col.name] = cell.value;
    });
    return obj;
  });
}

export function createDb(url, token) {
  if (!url || !token) throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required');
  const pipelineUrl = url.replace(/^libsql:\/\//, 'https://').replace(/\/$/, '') + '/v2/pipeline';

  async function pipeline(statements) {
    const requests = statements.map(s =>
      typeof s === 'string'
        ? { type: 'execute', stmt: { sql: s, args: [] } }
        : { type: 'execute', stmt: { sql: s.sql, args: (s.args || []).map(toArg) } }
    );
    requests.push({ type: 'close' });

    const res = await fetch(pipelineUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) throw new Error(`Turso HTTP error: ${res.status} ${await res.text()}`);

    const data = await res.json();
    return data.results.slice(0, statements.length).map(r => {
      if (r.type === 'error') throw new Error(r.error.message);
      return { rows: toRows(r), rowsAffected: r.response.result.affected_row_count };
    });
  }

  return {
    async execute(sql, args = []) {
      const [result] = await pipeline([{ sql, args }]);
      return result;
    },
    batch: pipeline
  };
}
