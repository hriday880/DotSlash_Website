import { listNewsletters, newsletterToBlog } from './newsletters';

async function getStaticBlogs() {
  try {
    const res = await fetch('/blogs/blogs.json');
    if (!res.ok) throw new Error('Failed to fetch blogs');
    return await res.json();
  } catch (err) {
    console.error('Error loading blogs:', err);
    return [];
  }
}

// The database is the source of truth (issues are managed from the admin
// dashboard). The static blogs.json is only a fallback for when it's unreachable.
export async function getBlogs() {
  let all;
  try {
    const rows = await listNewsletters();
    all = rows ? rows.map(newsletterToBlog) : await getStaticBlogs();
  } catch (err) {
    console.error('Error loading newsletters, using static issues:', err);
    all = await getStaticBlogs();
  }
  all.sort((a, b) => new Date(a.published_at) - new Date(b.published_at));
  all.forEach((b, i) => (b.issue = i + 1));
  return all.reverse();
}

export async function getBlogBySlug(slug) {
  const blogs = await getBlogs();
  return blogs.find(b => b.slug === slug) || null;
}
