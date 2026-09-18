import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import Footer from '../components/Footer';

export default function Blog() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const username = import.meta.env.VITE_MEDIUM_USERNAME || "@medium";
        const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=https://medium.com/feed/${username}`);
        const data = await res.json();
        
        if (data.status === "ok") {
          setPosts(data.items);
        }
      } catch (err) {
        console.error("Failed to fetch blog posts:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPosts();
  }, []);

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-[#030303] overflow-x-hidden pt-32 pb-0 flex flex-col">
      <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop relative z-10 flex-1 w-full">
        <header className="mb-24 w-full md:w-8/12">
          <h1 className="font-headline-display text-[40px] leading-[48px] sm:text-[60px] sm:leading-[70px] md:text-[80px] lg:text-headline-display lg:leading-[110px] text-[#3300FF] mb-8 uppercase break-words max-w-full">
            Insights
          </h1>
          <p className="font-body-lg text-body-lg text-[#52525B] border-l border-[#E4E4E7] pl-8 max-w-2xl">
            Thoughts, tutorials, and deep dives from our engineers and designers.
          </p>
        </header>

        {loading ? (
          <div className="text-[#3300FF] font-mono text-xl animate-pulse">Loading data...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-24">
            {posts.map((post, idx) => (
              <motion.a
                key={post.guid}
                href={post.link}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="group border border-[#E4E4E7] hover:border-[#3300FF] bg-[#FFFFFF] overflow-hidden flex flex-col transition-all duration-300"
              >
                {post.thumbnail && (
                  <div className="w-full h-48 overflow-hidden bg-[#F4F4F5]">
                    <img 
                      src={post.thumbnail} 
                      alt="Thumbnail" 
                      className="w-full h-full object-cover filter grayscale contrast-125 group-hover:grayscale-0 group-hover:contrast-100 transition-all duration-700 scale-100 group-hover:scale-110" 
                    />
                  </div>
                )}
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <span className="font-mono text-xs text-[#A0A0A0]">
                      {new Date(post.pubDate).toLocaleDateString()}
                    </span>
                    <ExternalLink size={16} className="text-[#3300FF] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <h3 className="font-headline-md text-xl font-bold mb-3 text-[#030303] group-hover:text-[#3300FF] transition-colors">
                    {post.title}
                  </h3>
                  <div className="flex flex-wrap gap-2 mt-auto">
                    {post.categories.slice(0, 3).map(cat => (
                      <span key={cat} className="text-[10px] uppercase tracking-widest text-[#52525B] border border-[#E4E4E7] px-2 py-1">
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.a>
            ))}
            
            {posts.length === 0 && (
              <p className="font-mono text-[#52525B]">No transmissions found.</p>
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
