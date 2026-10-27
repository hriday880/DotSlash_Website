import { db } from './db';

// Newsletters are uploaded as PDFs from the admin dashboard. Each page is
// rendered to an image in the browser (so the site shows the exact layout),
// uploaded to Cloudinary, and the row is stored in Turso.

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const PAGE_WIDTH = 1800; // px, sharp enough for retina reading

// Columns added after the table first shipped; older databases get them via ALTER TABLE
const LATE_COLUMNS = { author: 'TEXT', excerpt: 'TEXT', body: 'TEXT', pdf_url: 'TEXT', pages: 'TEXT' };

let tableReady = null;
export function ensureNewslettersTable() {
  if (!db) return Promise.resolve();
  tableReady ??= createTable().catch((err) => {
    tableReady = null;
    throw err;
  });
  return tableReady;
}

async function createTable() {
  await db.execute(`CREATE TABLE IF NOT EXISTS newsletters (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE,
    title TEXT NOT NULL,
    excerpt TEXT,
    author TEXT,
    date TEXT,
    pdf_url TEXT,
    pages TEXT,
    body TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  const info = await db.execute('PRAGMA table_info(newsletters)');
  const existing = new Set(info.rows.map((r) => r.name));
  for (const [col, type] of Object.entries(LATE_COLUMNS)) {
    if (!existing.has(col)) await db.execute(`ALTER TABLE newsletters ADD COLUMN ${col} ${type}`);
  }
}

export function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
}

// Renders every page to a PNG blob and pulls out the text layer
export async function renderPdf(file, onProgress = () => {}) {
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  const text = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    onProgress(`Rendering page ${n} of ${pdf.numPages}`);
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: PAGE_WIDTH / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    pages.push(await new Promise((resolve) => canvas.toBlob(resolve, 'image/png')));
    const content = await page.getTextContent();
    text.push(content.items.map((i) => i.str + (i.hasEOL ? '\n' : ' ')).join(''));
  }
  return { pages, text: text.join('\n\n').replace(/[ \t]+/g, ' ').trim() };
}

async function cloudinaryUpload(file, resourceType) {
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', UPLOAD_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return (await res.json()).secure_url;
}

async function uploadPdfAssets(file, onProgress) {
  const { pages, text } = await renderPdf(file, onProgress);

  const pageUrls = [];
  for (let i = 0; i < pages.length; i++) {
    onProgress(`Uploading page ${i + 1} of ${pages.length}`);
    pageUrls.push(await cloudinaryUpload(pages[i], 'image'));
  }

  // The original PDF is only used for the download button, so a failure
  // here (e.g. the preset disallows raw files) shouldn't block publishing
  let pdfUrl = null;
  try {
    onProgress('Uploading PDF');
    pdfUrl = await cloudinaryUpload(file, 'raw');
  } catch (err) {
    console.warn('PDF upload failed, publishing without download link:', err);
  }
  return { pageUrls, pdfUrl, text };
}

export async function publishNewsletter({ file, title, excerpt, author, date }, onProgress = () => {}) {
  if (!db) throw new Error('Database is not configured');
  await ensureNewslettersTable();
  const { pageUrls, pdfUrl, text } = await uploadPdfAssets(file, onProgress);

  onProgress('Saving');
  const id = window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).slice(2);
  const slug = `${slugify(title) || 'issue'}-${id.slice(0, 6)}`;
  await db.execute(
    'INSERT INTO newsletters (id, slug, title, excerpt, author, date, pdf_url, pages, body) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, slug, title, excerpt || null, author || null, date, pdfUrl, JSON.stringify(pageUrls), text]
  );
}

// One-time import of issues that shipped as static files (public/blogs/blogs.json)
// so they show up in the admin list like any uploaded PDF. A flag row makes
// sure an issue deleted from admin is never re-imported.
const MIGRATION_FLAG = 'static_newsletters_imported_v1';

async function importStaticIssues() {
  await db.execute('CREATE TABLE IF NOT EXISTS app_flags (key TEXT PRIMARY KEY, set_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  const flag = await db.execute('SELECT key FROM app_flags WHERE key = ?', [MIGRATION_FLAG]);
  if (flag.rows.length) return;

  const res = await fetch('/blogs/blogs.json');
  const issues = res.ok ? (await res.json()).filter((b) => b.page_images?.length) : [];
  for (const b of issues) {
    let body = '';
    try {
      if (b.content_path) body = await (await fetch(b.content_path)).text();
    } catch {
      body = '';
    }
    await db.execute(
      'INSERT OR IGNORE INTO newsletters (id, slug, title, excerpt, author, date, pdf_url, pages, body) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        `static-${b.slug}`,
        b.slug,
        b.title,
        b.excerpt || null,
        b.author || null,
        (b.published_at || '').slice(0, 10),
        b.pdf_path || null,
        JSON.stringify(b.page_images),
        body,
      ]
    );
  }
  await db.execute('INSERT OR IGNORE INTO app_flags (key) VALUES (?)', [MIGRATION_FLAG]);
}

export async function listNewsletters() {
  if (!db) return null;
  await ensureNewslettersTable();
  await importStaticIssues();
  const res = await db.execute('SELECT * FROM newsletters ORDER BY date DESC, created_at DESC');
  return res.rows;
}

// Edit details; a new PDF is optional and replaces the pages when given
export async function updateNewsletter(id, { file, title, excerpt, author, date }, onProgress = () => {}) {
  await ensureNewslettersTable();
  if (file) {
    const { pageUrls, pdfUrl, text } = await uploadPdfAssets(file, onProgress);
    onProgress('Saving');
    await db.execute(
      'UPDATE newsletters SET title = ?, excerpt = ?, author = ?, date = ?, pdf_url = ?, pages = ?, body = ? WHERE id = ?',
      [title, excerpt || null, author || null, date, pdfUrl, JSON.stringify(pageUrls), text, id]
    );
  } else {
    onProgress('Saving');
    await db.execute('UPDATE newsletters SET title = ?, excerpt = ?, author = ?, date = ? WHERE id = ?', [
      title,
      excerpt || null,
      author || null,
      date,
      id,
    ]);
  }
}

export async function deleteNewsletter(id) {
  await db.execute('DELETE FROM newsletters WHERE id = ?', [id]);
}

// Shape a DB row like the static blog entries the newsstand expects
export function newsletterToBlog(row) {
  let pages = [];
  try {
    pages = JSON.parse(row.pages || '[]');
  } catch {
    pages = [];
  }
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    author: row.author || 'DOTSLASH',
    author_role: null,
    tags: null,
    cover_image: null,
    published_at: row.date || row.created_at,
    accent: '#3300FF',
    front_image: pages[0] || null,
    page_images: pages,
    pdf_path: row.pdf_url,
    body: row.body,
  };
}
