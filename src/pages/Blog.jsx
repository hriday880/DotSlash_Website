import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import Footer from '../components/Footer';
import { db } from '../lib/db';

import InkAirplane from '../components/Hero/InkAirplane';
import AsciiScene from '../components/Hero/AsciiScene';

const GLITCH_CHARS = '01'; // Just binary or clean text

export default function Blog() {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBlogs = async () => {
      try {
        if (!db) return;
        const res = await db.execute('SELECT * FROM blogs ORDER BY date DESC, created_at DESC');
        if (res.rows) setBlogs(res.rows);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchBlogs();
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-[#030303]"></div>;
  }

  // Coming Soon State
  if (blogs.length === 0) {
    return (
      <div className="min-h-screen bg-[#FFF8E7] text-[#030303] overflow-hidden pt-32 pb-0 flex flex-col relative font-sans">
        
        {/* Isometric Paper Airplane Ink Effect */}
        <div className="absolute inset-0 z-0 opacity-100">
          
          <div className="absolute inset-0 z-0 pointer-events-none opacity-40 mix-blend-multiply">
            <AsciiScene />
          </div>

          <InkAirplane 
            title="COMING SOON"
            subtitle="Transmissions compiling..."
            topText="Node offline"
          />
        </div>
      </div>
    );
  }

  // Loaded Blogs State
  return (
    <div className="min-h-screen bg-[#F3F4F6] text-[#030303] overflow-x-hidden pt-32 pb-0 flex flex-col">
      <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop relative z-10 flex-1 w-full">
        <header className="mb-24 w-full md:w-8/12">
          <h1 className="font-headline-display text-[40px] leading-[48px] sm:text-[60px] sm:leading-[70px] md:text-[80px] lg:text-headline-display lg:leading-[110px] text-[#3300FF] mb-8 uppercase break-words max-w-full">
            Insights
          </h1>
          <p className="font-body-lg text-body-lg text-[#52525B] border-l border-[#E4E4E7] pl-8 max-w-2xl">
            Transmissions, tutorials, and deep dives from our engineers and designers.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-24">
          {blogs.map((post, idx) => (
            <motion.a
              key={post.id}
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="group border border-[#E4E4E7] hover:border-[#3300FF] bg-[#FFFFFF] overflow-hidden flex flex-col transition-all duration-300"
            >
              {post.thumbnail ? (
                <div className="w-full h-48 overflow-hidden bg-[#F4F4F5]">
                  <img src={post.thumbnail} alt={post.title} className="w-full h-full object-cover filter grayscale contrast-125 group-hover:grayscale-0 group-hover:contrast-100 transition-all duration-700 scale-100 group-hover:scale-110" />
                </div>
              ) : (
                <div className="w-full h-48 bg-[#030303] flex items-center justify-center relative overflow-hidden">
                   <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#3300FF_1px,transparent_1px),linear-gradient(to_bottom,#3300FF_1px,transparent_1px)] bg-[size:10px_10px]"></div>
                   <span className="font-mono text-[#3300FF] opacity-50 uppercase text-xs tracking-widest z-10">Data_Fragment</span>
                </div>
              )}
              <div className="p-6 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-4">
                  <span className="font-mono text-xs text-[#A0A0A0]">{post.date}</span>
                  <ExternalLink size={16} className="text-[#3300FF] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="font-headline-md text-xl font-bold mb-3 text-[#030303] group-hover:text-[#3300FF] transition-colors line-clamp-3">
                  {post.title}
                </h3>
              </div>
            </motion.a>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
