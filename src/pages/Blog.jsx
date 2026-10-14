import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Newsstand from '../components/blog/Newsstand';
import ReaderOverlay from '../components/blog/ReaderOverlay';
import { getBlogs } from '../lib/blogs';

export default function Blog() {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const { slug } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const data = await getBlogs();
        setBlogs(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const selectedBlog = slug ? blogs.find(b => b.slug === slug) : null;
  const selectedIndex = slug ? blogs.findIndex(b => b.slug === slug) : -1;

  const handleOpen = (blogSlug) => {
    navigate(`/blog/${blogSlug}`);
  };

  const handleClose = () => {
    navigate('/blog');
  };

  const navigateTo = (direction) => {
    if (selectedIndex === -1) return;
    const nextIndex = selectedIndex + direction;
    if (nextIndex >= 0 && nextIndex < blogs.length) {
      navigate(`/blog/${blogs[nextIndex].slug}`);
    }
  };

  const [rotationTarget, setRotationTarget] = useState(0);

  const handleRotate = (dir) => {
    const angle = (Math.PI * 2) / 4; // 4 items per tier
    setRotationTarget(prev => prev + dir * angle);
  };

  return (
    <div className="relative w-full h-screen bg-[#EBEDF5] overflow-hidden pt-20">
      {/* 3D Newsstand Scene */}
      <div className="absolute inset-0 z-0 pt-20">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center font-mono text-[#3300FF]">
            <span className="animate-blink">LOADING [====      ]</span>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center font-mono text-[#01040B]">
            <span className="flex items-center gap-2">
              <span className="text-red-500 text-2xl">⚠️</span> 
              ERROR: {error}
            </span>
          </div>
        )}
        {!loading && !error && blogs.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center font-mono text-[#717784] text-xl">
            NO ISSUES YET.
          </div>
        )}
        {!loading && blogs.length > 0 && (
          <>
            <Newsstand 
              blogs={blogs} 
              activeSlug={slug}
              onOpen={handleOpen} 
              rotationTarget={rotationTarget}
            />
            {/* 2D Overlay UI */}
            <div className="absolute inset-0 pointer-events-none z-10">
              
              {/* Top Title (Matches reference image) */}
              <div className="absolute top-4 left-0 w-full text-center">
                <h1 className="text-4xl md:text-5xl font-serif text-[#01040B] font-medium tracking-tight">
                  dotslash monthly
                </h1>
                <div className="flex justify-center gap-8 mt-6">
                  <span className="flex items-center gap-2 font-mono text-sm uppercase text-[#01040B] font-bold"><span className="w-3 h-3 rounded-full bg-[#3300FF]"></span> software</span>
                  <span className="flex items-center gap-2 font-mono text-sm uppercase text-[#01040B] font-bold"><span className="w-3 h-3 rounded-full bg-red-500"></span> hardware</span>
                  <span className="flex items-center gap-2 font-mono text-sm uppercase text-[#01040B] font-bold"><span className="w-3 h-3 rounded-full bg-yellow-400"></span> culture</span>
                </div>
              </div>

              {/* Left Side Text */}
              <div className="absolute top-1/2 left-8 md:left-16 lg:left-32 -translate-y-1/2 w-64 md:w-72">
                <h2 className="text-xl md:text-2xl font-serif text-[#01040B] mb-4 leading-snug font-medium">
                  Digital experiences designed to be explored, enjoyed, and remembered.
                </h2>
                <p className="text-xs font-mono text-[#717784] uppercase tracking-widest">Side 1 of {Math.ceil(blogs.length / 4) || 1}</p>
              </div>

              {/* Navigation Arrows */}
              <div className="absolute top-1/2 left-0 w-full flex justify-between px-8 md:px-24 lg:px-64 -translate-y-1/2 pointer-events-none">
                <button 
                  onClick={() => handleRotate(1)}
                  className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#01040B] text-white flex items-center justify-center hover:bg-[#3300FF] transition-colors shadow-lg cursor-pointer pointer-events-auto"
                >
                  &lt;
                </button>
                <button 
                  onClick={() => handleRotate(-1)}
                  className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#01040B] text-white flex items-center justify-center hover:bg-[#3300FF] transition-colors shadow-lg cursor-pointer pointer-events-auto"
                >
                  &gt;
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Reader Overlay */}
      <ReaderOverlay 
        blog={selectedBlog} 
        onClose={handleClose} 
        onNavigate={navigateTo}
        hasNext={selectedIndex < blogs.length - 1}
        hasPrev={selectedIndex > 0}
      />
    </div>
  );
}
