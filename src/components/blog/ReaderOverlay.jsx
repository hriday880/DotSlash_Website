import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, ChevronLeft, ChevronRight, Share2 } from 'lucide-react';

export default function ReaderOverlay({ blog, onClose, onNavigate, hasNext, hasPrev }) {
  const [content, setContent] = useState('');

  useEffect(() => {
    if (blog && blog.content_path) {
      fetch(blog.content_path)
        .then(res => res.text())
        .then(text => setContent(text))
        .catch(err => console.error('Failed to load markdown:', err));
    }
  }, [blog]);

  useEffect(() => {
    // Disable body scroll when open (Lenis conflict handling)
    if (blog) {
      document.body.style.overflow = 'hidden';
      document.documentElement.setAttribute('data-lenis-prevent', 'true');
    } else {
      document.body.style.overflow = '';
      document.documentElement.removeAttribute('data-lenis-prevent');
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.removeAttribute('data-lenis-prevent');
    };
  }, [blog]);

  if (!blog) return null;

  const dateStr = new Date(blog.published_at).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).toUpperCase();

  const wordCount = content.split(/\s+/).length;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <div 
      className="fixed inset-0 z-50 flex justify-center bg-[#EBEDF5] overflow-y-auto"
      data-lenis-prevent="true"
      onScroll={(e) => {
        const el = e.target;
        const progress = (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100;
        document.getElementById('reading-progress').style.width = `${progress}%`;
      }}
    >
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 h-1 bg-[#3300FF] z-[60] transition-all duration-75" id="reading-progress" style={{ width: '0%' }}></div>

      <div className="w-full max-w-4xl bg-[#FCFCFD] min-h-screen border-x-4 border-[#3300FF] shadow-2xl relative flex flex-col">

        
        {/* Top Controls */}
        <div className="sticky top-0 z-10 flex justify-between items-center p-4 bg-[#FCFCFD] border-b-2 border-dashed border-[#717784]">
          <div className="flex gap-2">
            <button 
              onClick={() => onNavigate(-1)} 
              disabled={!hasPrev}
              className="p-2 border border-[#00123B] disabled:opacity-30 hover:bg-[#36AEFC] hover:text-white transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={() => onNavigate(1)} 
              disabled={!hasNext}
              className="p-2 border border-[#00123B] disabled:opacity-30 hover:bg-[#36AEFC] hover:text-white transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          
          <div className="flex gap-4">
            <button 
              className="p-2 border border-[#00123B] hover:bg-[#3300FF] hover:text-white transition-colors"
              onClick={() => navigator.clipboard.writeText(window.location.href)}
              title="Copy Link"
            >
              <Share2 size={20} />
            </button>
            <button 
              className="p-2 border border-[#3300FF] text-[#3300FF] hover:bg-[#3300FF] hover:text-white transition-colors font-mono font-bold"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Masthead */}
        <header className="px-8 py-10 border-b-4 border-[#3300FF] text-center">
          <div className="flex justify-between items-end border-b border-[#00123B] pb-2 mb-6 font-mono text-xs text-[#717784] uppercase">
            <span>ISSUE NO. {blog.id} <br/><span className="text-[#3300FF] font-bold">{readTime} MIN READ</span></span>
            <div className="flex items-center gap-2">
              <span className="text-[#3300FF] text-lg font-black leading-none">/.</span>
              <span>DOTSLASH MONTHLY</span>
            </div>
            <span>{dateStr}</span>
          </div>
          <h1 className="font-headline-display text-5xl md:text-7xl text-[#01040B] uppercase tracking-tighter mb-6">
            {blog.title}
          </h1>
          {blog.excerpt && (
            <p className="font-body-lg text-2xl text-[#00123B] font-serif max-w-2xl mx-auto italic">
              {blog.excerpt}
            </p>
          )}
        </header>

        {/* Article Body */}
        <article className="flex-1 px-8 py-12 prose prose-lg prose-blue max-w-none font-serif text-[#01040B]">
          <div className="mb-10 pb-6 border-b border-dashed border-[#717784] flex items-center justify-between font-mono text-sm uppercase">
            <div>
              <span className="text-[#717784]">BY </span>
              <span className="font-bold text-[#3300FF]">{blog.author}</span>
              {blog.author_role && <span className="ml-2 px-2 py-1 bg-[#EBEDF5] text-[#00123B]">{blog.author_role}</span>}
            </div>
            {blog.tags && (
              <div className="flex gap-2">
                {JSON.parse(blog.tags).map(tag => (
                  <span key={tag} className="px-2 py-1 bg-[#3300FF] text-white text-xs">{tag}</span>
                ))}
              </div>
            )}
          </div>
          
          {blog.cover_image && (
            <div className="mb-10 border-2 border-[#00123B] p-2 bg-[#EBEDF5]">
              <img src={blog.cover_image} alt="Cover" className="w-full h-auto mix-blend-luminosity grayscale contrast-125" />
            </div>
          )}

          <div className="first-letter:text-6xl first-letter:font-black first-letter:text-[#3300FF] first-letter:mr-2 first-letter:float-left">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content || '*Loading contents...*'}
            </ReactMarkdown>
          </div>
        </article>
      </div>
    </div>
  );
}
