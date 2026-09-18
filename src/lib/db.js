// Direct Turso HTTP API client — bypasses @libsql/client migration bug
const url = import.meta.env.VITE_TURSO_DATABASE_URL;
const authToken = import.meta.env.VITE_TURSO_AUTH_TOKEN;

class TursoDB {
  constructor(url, token) {
    // Ensure we use the /v2/pipeline endpoint
    this.pipelineUrl = url.replace(/\/$/, '') + '/v2/pipeline';
    this.token = token;
  }

  async execute(query, argsArray) {
    let sql, args;

    if (typeof query === 'string') {
      sql = query;
      // Support db.execute('SQL', [arg1, arg2]) calling convention
      args = (argsArray || []).map(a => {
        if (a === null || a === undefined) return { type: 'null' };
        if (typeof a === 'number') return { type: 'integer', value: String(a) };
        return { type: 'text', value: String(a) };
      });
    } else {
      sql = query.sql;
      args = (query.args || []).map(a => {
        if (a === null || a === undefined) return { type: 'null' };
        if (typeof a === 'number') return { type: 'integer', value: String(a) };
        return { type: 'text', value: String(a) };
      });
    }

    const res = await fetch(this.pipelineUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          { type: 'execute', stmt: { sql, args } }
        ]
      })
    });

    if (!res.ok) {
      throw new Error(`Turso HTTP error: ${res.status}`);
    }

    const data = await res.json();
    const result = data.results[0];

    if (result.type === 'error') {
      throw new Error(result.error.message);
    }

    // Convert Turso response format to match @libsql/client format
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

    return {
      rows,
      columns: cols.map(c => c.name),
      rowsAffected: result.response.result.affected_row_count,
      lastInsertRowid: result.response.result.last_insert_rowid,
    };
  }
}

export const db = (url && authToken) ? new TursoDB(url, authToken) : null;
