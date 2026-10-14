export async function getBlogs() {
  try {
    const res = await fetch('/blogs/blogs.json');
    if (!res.ok) throw new Error('Failed to fetch blogs');
    return await res.json();
  } catch (err) {
    console.error('Error loading blogs:', err);
    return [];
  }
}

export async function getBlogBySlug(slug) {
  const blogs = await getBlogs();
  return blogs.find(b => b.slug === slug) || null;
}
