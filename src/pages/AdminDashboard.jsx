import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { db } from '../lib/db';
import { LogOut, Upload, Trash2, Megaphone, Users, FileText } from 'lucide-react';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [activeTab, setActiveTab] = useState('personnel'); // 'personnel', 'blogs', 'announcements'
  
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // Data
  const [members, setMembers] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  
  // Forms
  const [memberForm, setMemberForm] = useState({ name: '', role: '', department: 'executive', imageFile: null });
  const [blogForm, setBlogForm] = useState({ title: '', url: '', thumbnailFile: null, date: '' });
  const [announcementForm, setAnnouncementForm] = useState({ content: '', is_active: 1 });

  useEffect(() => {
    if (localStorage.getItem('dotslash_admin_auth') !== 'true') {
      setIsAuthenticated(false);
    } else {
      loadData();
    }
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('dotslash_admin_auth');
    navigate('/login');
  };

  const loadData = async () => {
    try {
      if (!db) return;
      
      const memRes = await db.execute('SELECT * FROM members ORDER BY created_at DESC');
      setMembers(memRes.rows || []);
      
      const blogRes = await db.execute('SELECT * FROM blogs ORDER BY created_at DESC');
      setBlogs(blogRes.rows || []);
      
      const annRes = await db.execute('SELECT * FROM announcements ORDER BY created_at DESC');
      setAnnouncements(annRes.rows || []);
      
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (file) => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) return null;

    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", uploadPreset);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: data
    });
    const fileRes = await res.json();
    return fileRes.secure_url;
  };

  // ---------------- MEMBERS ----------------
  const handleMemberSubmit = async (e) => {
    e.preventDefault();
    if (!memberForm.name || !memberForm.role || !memberForm.imageFile) {
      alert("Please fill all fields and select an image.");
      return;
    }
    setUploading(true);
    try {
      const imageUrl = await uploadImage(memberForm.imageFile);
      if (!imageUrl) throw new Error("Upload failed");
      const id = crypto.randomUUID();
      await db.execute({
        sql: 'INSERT INTO members (id, name, role, department, image) VALUES (?, ?, ?, ?, ?)',
        args: [id, memberForm.name, memberForm.role, memberForm.department, imageUrl]
      });
      setMemberForm({ name: '', role: '', department: 'executive', imageFile: null });
      loadData();
    } catch (err) { alert(err.message); } finally { setUploading(false); }
  };

  const deleteMember = async (id) => {
    if (!confirm("Are you sure?")) return;
    await db.execute({ sql: 'DELETE FROM members WHERE id = ?', args: [id] });
    loadData();
  };

  // ---------------- BLOGS ----------------
  const handleBlogSubmit = async (e) => {
    e.preventDefault();
    if (!blogForm.title || !blogForm.url || !blogForm.date) {
      alert("Please fill title, url, and date.");
      return;
    }
    setUploading(true);
    try {
      let imageUrl = null;
      if (blogForm.thumbnailFile) {
        imageUrl = await uploadImage(blogForm.thumbnailFile);
      }
      const id = crypto.randomUUID();
      await db.execute({
        sql: 'INSERT INTO blogs (id, title, url, thumbnail, date) VALUES (?, ?, ?, ?, ?)',
        args: [id, blogForm.title, blogForm.url, imageUrl || '', blogForm.date]
      });
      setBlogForm({ title: '', url: '', thumbnailFile: null, date: '' });
      loadData();
    } catch (err) { alert(err.message); } finally { setUploading(false); }
  };

  const deleteBlog = async (id) => {
    if (!confirm("Are you sure?")) return;
    await db.execute({ sql: 'DELETE FROM blogs WHERE id = ?', args: [id] });
    loadData();
  };

  // ---------------- ANNOUNCEMENTS ----------------
  const handleAnnouncementSubmit = async (e) => {
    e.preventDefault();
    if (!announcementForm.content) return;
    setUploading(true);
    try {
      const id = crypto.randomUUID();
      await db.execute({
        sql: 'INSERT INTO announcements (id, content, is_active) VALUES (?, ?, ?)',
        args: [id, announcementForm.content, announcementForm.is_active]
      });
      setAnnouncementForm({ content: '', is_active: 1 });
      loadData();
    } catch (err) { alert(err.message); } finally { setUploading(false); }
  };

  const toggleAnnouncement = async (id, currentStatus) => {
    await db.execute({
      sql: 'UPDATE announcements SET is_active = ? WHERE id = ?',
      args: [currentStatus === 1 ? 0 : 1, id]
    });
    loadData();
  };
  
  const deleteAnnouncement = async (id) => {
    if (!confirm("Are you sure?")) return;
    await db.execute({ sql: 'DELETE FROM announcements WHERE id = ?', args: [id] });
    loadData();
  };

  if (!isAuthenticated) return <Navigate to="/login" />;

  return (
    <div className="min-h-screen bg-[#030303] text-[#FFFFFF] pt-32 px-4 pb-20 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-end mb-8 border-b border-[#3300FF]/30 pb-6">
          <div>
            <h1 className="font-headline-md text-4xl md:text-5xl text-[#3300FF] uppercase tracking-tighter mb-2">Admin Terminal</h1>
            <p className="font-mono text-sm text-[#00D4FF] tracking-widest uppercase">System Control</p>
          </div>
          <button onClick={handleSignOut} className="flex items-center gap-2 text-[#A0A0A0] hover:text-[#FF3366] transition-colors border border-transparent hover:border-[#FF3366]/50 px-4 py-2 rounded-sm bg-transparent hover:bg-[#FF3366]/10">
            <LogOut size={16} /> <span className="font-mono text-sm uppercase">Disconnect</span>
          </button>
        </header>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-[#353535]">
          <button onClick={() => setActiveTab('personnel')} className={`flex items-center gap-2 pb-4 px-4 font-mono text-sm uppercase tracking-widest transition-colors ${activeTab === 'personnel' ? 'text-[#00D4FF] border-b-2 border-[#00D4FF]' : 'text-[#A0A0A0] hover:text-white'}`}>
            <Users size={16} /> Personnel
          </button>
          <button onClick={() => setActiveTab('blogs')} className={`flex items-center gap-2 pb-4 px-4 font-mono text-sm uppercase tracking-widest transition-colors ${activeTab === 'blogs' ? 'text-[#00D4FF] border-b-2 border-[#00D4FF]' : 'text-[#A0A0A0] hover:text-white'}`}>
            <FileText size={16} /> Blogs
          </button>
          <button onClick={() => setActiveTab('announcements')} className={`flex items-center gap-2 pb-4 px-4 font-mono text-sm uppercase tracking-widest transition-colors ${activeTab === 'announcements' ? 'text-[#00D4FF] border-b-2 border-[#00D4FF]' : 'text-[#A0A0A0] hover:text-white'}`}>
            <Megaphone size={16} /> Announcements
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Form Section */}
          <div className="lg:col-span-4 bg-gradient-to-b from-[#131313] to-[#0a0a0a] border border-[#353535] p-8 h-fit relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3300FF] to-[#00D4FF]"></div>
            
            <h2 className="text-xl font-headline-md uppercase tracking-widest text-white mb-8 flex items-center gap-3">
              <span className="w-2 h-2 bg-[#00D4FF] inline-block animate-pulse"></span>
              {activeTab === 'personnel' && 'Register Operative'}
              {activeTab === 'blogs' && 'Publish Log'}
              {activeTab === 'announcements' && 'Broadcast Signal'}
            </h2>

            {/* Personnel Form */}
            {activeTab === 'personnel' && (
              <form onSubmit={handleMemberSubmit} className="flex flex-col gap-5">
                <input type="text" placeholder="Name" value={memberForm.name} onChange={(e) => setMemberForm({...memberForm, name: e.target.value})} className="w-full bg-[#030303] border border-[#353535] px-4 py-3 text-white font-mono text-sm focus:border-[#00D4FF] outline-none" />
                <input type="text" placeholder="Role" value={memberForm.role} onChange={(e) => setMemberForm({...memberForm, role: e.target.value})} className="w-full bg-[#030303] border border-[#353535] px-4 py-3 text-white font-mono text-sm focus:border-[#00D4FF] outline-none" />
                <select value={memberForm.department} onChange={(e) => setMemberForm({...memberForm, department: e.target.value})} className="w-full bg-[#030303] border border-[#353535] px-4 py-3 text-white font-mono text-sm focus:border-[#00D4FF] outline-none appearance-none cursor-pointer">
                  <option value="executive">Executive</option>
                  <option value="content">Content</option>
                  <option value="social_media">Social Media</option>
                  <option value="outreach">Outreach</option>
                  <option value="logistics">Logistics</option>
                  <option value="design">Design</option>
                  <option value="coding_robotics">Coding and Robotics</option>
                </select>
                <label className="w-full bg-[#030303] border border-[#353535] border-dashed p-6 flex flex-col items-center cursor-pointer hover:border-[#00D4FF]">
                  <Upload size={20} className="text-[#A0A0A0] mb-3" />
                  <span className="text-xs font-mono text-[#A0A0A0] truncate max-w-full">{memberForm.imageFile ? memberForm.imageFile.name : 'Upload Scan'}</span>
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => setMemberForm({...memberForm, imageFile: e.target.files[0]})} />
                </label>
                <button type="submit" disabled={uploading} className="mt-4 bg-[#3300FF] hover:bg-[#00D4FF] text-white py-4 uppercase tracking-[0.2em] font-bold text-sm shadow-[0_0_15px_rgba(51,0,255,0.4)] disabled:opacity-50">
                  {uploading ? 'UPLOADING...' : 'SAVE'}
                </button>
              </form>
            )}

            {/* Blogs Form */}
            {activeTab === 'blogs' && (
              <form onSubmit={handleBlogSubmit} className="flex flex-col gap-5">
                <input type="text" placeholder="Blog Title" value={blogForm.title} onChange={(e) => setBlogForm({...blogForm, title: e.target.value})} className="w-full bg-[#030303] border border-[#353535] px-4 py-3 text-white font-mono text-sm focus:border-[#00D4FF] outline-none" />
                <input type="url" placeholder="Medium URL" value={blogForm.url} onChange={(e) => setBlogForm({...blogForm, url: e.target.value})} className="w-full bg-[#030303] border border-[#353535] px-4 py-3 text-white font-mono text-sm focus:border-[#00D4FF] outline-none" />
                <input type="date" value={blogForm.date} onChange={(e) => setBlogForm({...blogForm, date: e.target.value})} className="w-full bg-[#030303] border border-[#353535] px-4 py-3 text-white font-mono text-sm focus:border-[#00D4FF] outline-none" />
                
                <label className="w-full bg-[#030303] border border-[#353535] border-dashed p-6 flex flex-col items-center cursor-pointer hover:border-[#00D4FF]">
                  <Upload size={20} className="text-[#A0A0A0] mb-3" />
                  <span className="text-xs font-mono text-[#A0A0A0] truncate max-w-full">{blogForm.thumbnailFile ? blogForm.thumbnailFile.name : 'Optional Thumbnail'}</span>
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => setBlogForm({...blogForm, thumbnailFile: e.target.files[0]})} />
                </label>
                <button type="submit" disabled={uploading} className="mt-4 bg-[#3300FF] hover:bg-[#00D4FF] text-white py-4 uppercase tracking-[0.2em] font-bold text-sm shadow-[0_0_15px_rgba(51,0,255,0.4)] disabled:opacity-50">
                  {uploading ? 'UPLOADING...' : 'SAVE BLOG'}
                </button>
              </form>
            )}

            {/* Announcements Form */}
            {activeTab === 'announcements' && (
              <form onSubmit={handleAnnouncementSubmit} className="flex flex-col gap-5">
                <textarea 
                  placeholder="Enter announcement text... (Keep it punchy)" 
                  value={announcementForm.content} 
                  onChange={(e) => setAnnouncementForm({...announcementForm, content: e.target.value})} 
                  className="w-full bg-[#030303] border border-[#353535] px-4 py-3 text-white font-mono text-sm focus:border-[#00D4FF] outline-none h-32 resize-none" 
                />
                <button type="submit" disabled={uploading} className="mt-4 bg-[#3300FF] hover:bg-[#00D4FF] text-white py-4 uppercase tracking-[0.2em] font-bold text-sm shadow-[0_0_15px_rgba(51,0,255,0.4)] disabled:opacity-50">
                  {uploading ? 'UPLOADING...' : 'BROADCAST'}
                </button>
              </form>
            )}
          </div>

          {/* List Section */}
          <div className="lg:col-span-8">
            <div className="flex justify-between items-center mb-8 border-b border-[#353535] pb-2">
              <h2 className="text-sm font-mono uppercase tracking-widest text-[#A0A0A0]">Active Registry</h2>
              <span className="text-[#00D4FF] font-mono text-xs">
                {activeTab === 'personnel' && members.length}
                {activeTab === 'blogs' && blogs.length}
                {activeTab === 'announcements' && announcements.length} ENTRIES
              </span>
            </div>
            
            {loading ? (
              <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-[#3300FF] border-t-[#00D4FF] rounded-full animate-spin"></div></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Members List */}
                {activeTab === 'personnel' && members.map(member => (
                  <div key={member.id} className="bg-[#0a0a0a] border border-[#222] hover:border-[#3300FF] p-3 flex gap-4 items-center relative group transition-all">
                    <img src={member.image} alt={member.name} className="w-16 h-16 object-cover filter grayscale group-hover:grayscale-0 transition-all" />
                    <div className="flex-1 min-w-0 pr-8">
                      <h3 className="font-headline-md text-white uppercase text-lg truncate">{member.name}</h3>
                      <p className="text-[11px] text-[#A0A0A0] font-mono truncate">{member.role}</p>
                    </div>
                    <button onClick={() => deleteMember(member.id)} className="absolute top-1/2 -translate-y-1/2 right-4 text-[#FF3366] opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                  </div>
                ))}

                {/* Blogs List */}
                {activeTab === 'blogs' && blogs.map(blog => (
                  <div key={blog.id} className="bg-[#0a0a0a] border border-[#222] hover:border-[#3300FF] p-4 relative group transition-all">
                    {blog.thumbnail && <img src={blog.thumbnail} alt="" className="w-full h-32 object-cover mb-4 opacity-50 group-hover:opacity-100" />}
                    <h3 className="font-headline-md text-white text-md line-clamp-2">{blog.title}</h3>
                    <p className="text-[10px] text-[#00D4FF] font-mono mt-2">{blog.date}</p>
                    <button onClick={() => deleteBlog(blog.id)} className="absolute top-4 right-4 bg-[#FF3366]/20 p-2 text-[#FF3366] opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                  </div>
                ))}

                {/* Announcements List */}
                {activeTab === 'announcements' && announcements.map(ann => (
                  <div key={ann.id} className={`bg-[#0a0a0a] border ${ann.is_active ? 'border-[#00D4FF]' : 'border-[#222]'} p-4 relative group transition-all col-span-full`}>
                    <p className="font-mono text-sm text-white pr-24">{ann.content}</p>
                    <div className="absolute top-4 right-4 flex gap-2">
                      <button onClick={() => toggleAnnouncement(ann.id, ann.is_active)} className={`text-[10px] px-2 py-1 font-mono uppercase border ${ann.is_active ? 'border-[#00D4FF] text-[#00D4FF]' : 'border-[#A0A0A0] text-[#A0A0A0]'}`}>
                        {ann.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </button>
                      <button onClick={() => deleteAnnouncement(ann.id)} className="p-1 text-[#FF3366] hover:bg-[#FF3366]/20"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
