import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Newsstand from '../components/blog/Newsstand';
import ReaderOverlay from '../components/blog/ReaderOverlay';
import { shelfMetrics } from '../components/blog/Bookshelf';
import { getBlogs } from '../lib/blogs';

// Pick the shelf grid whose bay shape best matches the available viewport,
// so the locked camera frames it edge-to-edge without wasted space.
function pickGrid(width, height) {
  if (!width || !height) return { cols: 4, rows: 2 };
  const aspect = width / height;
  const rows = aspect > 1 ? 2 : 3;
  let best = { cols: 2, rows, score: Infinity };
  for (let cols = 2; cols <= 6; cols++) {
    const m = shelfMetrics(cols, rows);
    const score = Math.abs(Math.log(m.fitW / m.fitH / aspect));
    if (score < best.score) best = { cols, rows, score };
  }
  return { cols: best.cols, rows: best.rows };
}

function formatDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
}

export default function Blog() {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [hovered, setHovered] = useState(null);
  const [grid, setGrid] = useState({ cols: 4, rows: 2 });
  const stageRef = useRef(null);
  const swipeX = useRef(null);
  const swiped = useRef(false);

  const { slug } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    getBlogs()
      .then(setBlogs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setGrid((prev) => {
        const next = pickGrid(width, height);
        return prev.cols === next.cols && prev.rows === next.rows ? prev : next;
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Never build more slots than there are issues, so the shelf has no empty gaps
  const cols = Math.min(grid.cols, Math.max(1, blogs.length));
  const rows = Math.min(grid.rows, Math.max(1, Math.ceil(blogs.length / cols)));
  const perPage = cols * rows;
  const pages = Math.max(1, Math.ceil(blogs.length / perPage));
  const selectedIndex = slug ? blogs.findIndex((b) => b.slug === slug) : -1;
  const selectedBlog = selectedIndex >= 0 ? blogs[selectedIndex] : null;

  // Keep the page in range after a resize, and park the camera on the open issue
  useEffect(() => {
    setPage((p) => Math.min(p, pages - 1));
  }, [pages]);
  useEffect(() => {
    if (selectedIndex >= 0) setPage(Math.floor(selectedIndex / perPage));
  }, [selectedIndex, perPage]);

  const goPage = (dir) => setPage((p) => Math.max(0, Math.min(pages - 1, p + dir)));

  useEffect(() => {
    if (selectedBlog) return;
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') goPage(-1);
      if (e.key === 'ArrowRight') goPage(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const handleOpen = (blogSlug) => {
    if (swiped.current) return;
    setHovered(null);
    document.body.style.cursor = '';
    navigate(`/blog/${blogSlug}`);
  };

  const navigateTo = (direction) => {
    const next = blogs[selectedIndex + direction];
    if (next) navigate(`/blog/${next.slug}`);
  };

  const featured = hovered;

  return (
    <div className="relative w-full h-[100svh] bg-[#EBEDF5] pt-20 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="w-full max-w-7xl mx-auto px-4 md:px-12 pt-6 md:pt-8 pb-2 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-[#3300FF] font-bold mb-1">/. The Newsstand</p>
          <h1 className="font-headline-md text-3xl md:text-5xl font-black tracking-tight text-[#01040B] uppercase leading-none">
            DotSlash Monthly
          </h1>
        </div>
        {!loading && blogs.length > 0 && (
          <p className="hidden sm:block font-mono text-xs uppercase tracking-widest text-[#717784] text-right">
            {blogs.length} {blogs.length === 1 ? 'issue' : 'issues'} on the shelf
          </p>
        )}
      </header>

      {/* 3D stage */}
      <div
        ref={stageRef}
        className="relative flex-1 min-h-0 touch-pan-y"
        onPointerDown={(e) => {
          swipeX.current = e.clientX;
          swiped.current = false;
        }}
        onPointerUp={(e) => {
          if (swipeX.current === null) return;
          const dx = e.clientX - swipeX.current;
          swipeX.current = null;
          // Pointerup fires before the canvas click, so this suppresses opening a paper mid-swipe
          if (Math.abs(dx) > 10) swiped.current = true;
          if (e.pointerType !== 'mouse' && Math.abs(dx) > 50) goPage(dx < 0 ? 1 : -1);
        }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center font-mono text-sm text-[#3300FF]">
            <span className="animate-blink">LOADING THE SHELF…</span>
          </div>
        )}
        {!loading && error && (
          <div className="absolute inset-0 flex items-center justify-center font-mono text-sm text-[#01040B]">
            ERROR: {error}
          </div>
        )}
        {!loading && !error && blogs.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center font-mono text-[#717784]">NO ISSUES YET.</div>
        )}
        {!loading && blogs.length > 0 && (
          <Newsstand
            blogs={blogs}
            cols={cols}
            rows={rows}
            page={page}
            pages={pages}
            hoveredSlug={hovered?.slug}
            onOpen={handleOpen}
            onHover={setHovered}
          />
        )}
      </div>

      {/* Bottom bar: preview + pager */}
      {!loading && blogs.length > 0 && (
        <div className="w-full max-w-7xl mx-auto px-4 md:px-12 py-4 flex items-center justify-between gap-6 border-t border-[#D7DAE5]">
          <div className="min-w-0 flex-1 h-12 flex flex-col justify-center">
            {featured ? (
              <>
                <p className="font-mono text-[11px] uppercase tracking-widest text-[#717784] truncate">
                  No. {String(featured.issue ?? featured.id).padStart(3, '0')} · {formatDate(featured.published_at)} · {featured.author}
                </p>
                <p className="font-headline-md text-base md:text-lg font-bold text-[#01040B] truncate">{featured.title}</p>
              </>
            ) : (
              <p className="font-mono text-xs uppercase tracking-widest text-[#717784]">
                <span className="hidden md:inline">Hover a paper to preview · click to read</span>
                <span className="md:hidden">Tap a paper to read · swipe to browse</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => goPage(-1)}
              disabled={page === 0}
              aria-label="Previous shelf"
              className="w-10 h-10 border border-[#01040B] flex items-center justify-center text-[#01040B] hover:bg-[#3300FF] hover:border-[#3300FF] hover:text-white transition-colors disabled:opacity-25 disabled:pointer-events-none"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="font-mono text-xs tracking-widest text-[#01040B] w-16 text-center">
              {String(page + 1).padStart(2, '0')} / {String(pages).padStart(2, '0')}
            </span>
            <button
              onClick={() => goPage(1)}
              disabled={page >= pages - 1}
              aria-label="Next shelf"
              className="w-10 h-10 border border-[#01040B] flex items-center justify-center text-[#01040B] hover:bg-[#3300FF] hover:border-[#3300FF] hover:text-white transition-colors disabled:opacity-25 disabled:pointer-events-none"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Accessible index of every issue */}
      <nav className="sr-only" aria-label="All issues">
        <ul>
          {blogs.map((b) => (
            <li key={b.slug}>
              <Link to={`/blog/${b.slug}`}>{b.title}</Link>
            </li>
          ))}
        </ul>
      </nav>

      <ReaderOverlay
        blog={selectedBlog}
        onClose={() => navigate('/blog')}
        onNavigate={navigateTo}
        hasNext={selectedIndex >= 0 && selectedIndex < blogs.length - 1}
        hasPrev={selectedIndex > 0}
      />
    </div>
  );
}
