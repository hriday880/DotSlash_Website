import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { db } from '../lib/db';
import { LogOut, Upload, Trash2, Megaphone, Users, FileText, Eye, Edit2, Calendar } from 'lucide-react';

export default function AdminDashboard() {
  const navigate = useNavigate();
  
  // RBAC checks
  const role = localStorage.getItem('dotslash_admin_auth');
  const isSuperAdmin = role === 'superadmin';
  const isBlogAdmin = role === 'blogadmin';
  const isAnnouncementAdmin = role === 'announcementadmin';

  if (!role) {
    return <Navigate to="/login" replace />;
  }

  // Determine initial tab based on role
  const defaultTab = isSuperAdmin ? 'personnel' : (isBlogAdmin ? 'blogs' : 'announcements');
  const [activeTab, setActiveTab] = useState(defaultTab);
  
  const [members, setMembers] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [events, setEvents] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  const [memberForm, setMemberForm] = useState({ name: '', role: '', department: 'executive', imageFile: null });
  const [editMemberId, setEditMemberId] = useState(null);
  
  const [blogForm, setBlogForm] = useState({ title: '', url: '', thumbnailFile: null, date: '' });
  const [announcementForm, setAnnouncementForm] = useState({ content: '' });
  
  const [eventForm, setEventForm] = useState({ title: '', date: '', description: '', imageFile: null });

  const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  const checkAndSeedPersonnel = async (existingPersonnel) => {
    if (existingPersonnel && existingPersonnel.length > 0) return existingPersonnel;
    
    const initialPersonnel = [
      { name: "Hriday", role: "President", department: "executive", image: "/team/hriday.png" },
      { name: "Tejashwini", role: "Vice president", department: "executive", image: "/team/tejashwini.png" },
      { name: "Sadhya", role: "Secretary", department: "executive", image: "/team/sadhya.png" },
      { name: "Dhriti", role: "PR Head", department: "executive", image: "/team/dhriti.png" },
      { name: "Manan", role: "Treasurer", department: "executive", image: "/team/manan.png" },
      
      { name: "Yashshree", role: "Co-head of Logistics", department: "logistics", image: "/team/yashshree.png?v=2" },
      { name: "Anushaa", role: "Co-head of Logistics", department: "logistics", image: "/team/anushaa.png?v=2" },
      { name: "Jane", role: "Social Media Head", department: "social_media", image: "/team/jane_doe.jpeg" },
      { name: "Sia", role: "Content Head", department: "content", image: "/team/sia.png?v=2" },
      { name: "Dev", role: "Coding Team Head", department: "coding_robotics", image: "/team/jane_doe.jpeg" },
      { name: "Jane", role: "Build Space Head", department: "coding_robotics", image: "/team/jane_doe.jpeg" },
      { name: "Aryan", role: "Outreach Head", department: "outreach", image: "/team/jane_doe.jpeg" },
      { name: "Heena", role: "Design Head", department: "design", image: "/team/jane_doe.jpeg" },
    ];

    for (const member of initialPersonnel) {
      const uuid = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2);
      await db.execute(
        'INSERT INTO personnel (id, name, role, department, image) VALUES (?, ?, ?, ?, ?)',
        [uuid, member.name, member.role, member.department, member.image]
      );
    }
    const freshRes = await db.execute('SELECT * FROM personnel ORDER BY created_at ASC');
    return freshRes.rows;
  };

  const checkAndSeedEvents = async (existingEvents) => {
    if (existingEvents && existingEvents.length > 0) return existingEvents;
    
    const initialEvents = [
      {
        title: "DotSlash Mixer (DotSlash Arcade)",
        date: "September 4, 2026",
        image: "/events/mixer.png?v=1",
        description: "DotSlash FLAME's inaugural event of the academic year, bringing a futuristic arcade experience to campus at Learning Commons. Featuring student-built interactive games and installations including the DotSlash Mirror, Slash Runner, Pixel Art Guessing Game, Puzzle Camera, and a custom Sticker Claw Machine with tear-away arcade tickets and rewards. With over 70+ attendees and upbeat music, the event connected new students through an immersive celebration of creative technology."
      },
      {
        title: "Shuttle Shot",
        date: "November 3, 2025",
        image: "/events/shuttleshot.png?v=1",
        description: "In an exciting collaboration with the Astronomy Club, Shuttle Shot brings together the best of both worlds. An evening dedicated to exploring the cosmos through code, featuring interactive sessions, stargazing, and an immersive digital journey through our solar system. Participants engage in a unique blend of astronomy discussions and technology applications designed to inspire the next generation of space tech enthusiasts."
      },
      {
        title: "Tech AND Sport!",
        date: "September 12 & 13, 2025",
        image: "/events/techandsport.png?v=1",
        description: "A groundbreaking two-day event in partnership with the Squash Club. Bridging the physical and digital realms, this event features sports analytics, tracking technologies, and competitive squash matches. Discover how technology is revolutionizing sports training, performance tracking, and match analysis while breaking a sweat on the courts."
      },
      {
        title: "The Matrix Screening",
        date: "September 9, 2025",
        image: "/events/matrix.png?v=1",
        description: "Enter the Matrix with us for a special screening of the sci-fi classic. Followed by a deep dive discussion into the philosophical and technological themes of the movie. We'll explore concepts of simulated reality, artificial intelligence, and cybernetics, drawing parallels between the film's vision and our current technological trajectory."
      },
      {
        title: "DotSlash Jeopardy Night",
        date: "February 8, 2024",
        image: "/events/jeopardy.png?v=1",
        description: "A battle of wits and technical knowledge! Our custom-built Jeopardy platform tested participants on various categories spanning programming languages, tech history, pop culture, and computational logic. An evening of intense competition, laughter, and learning, with prizes for the ultimate trivia champions."
      },
      {
        title: "Code Along",
        date: "November 4, 2023",
        image: "/events/codealong.png?v=1",
        description: "An interactive coding workshop led by industry veteran Mr. Navneet Karnani. Participants built a full-stack application from scratch, learning modern development practices, debugging techniques, and deployment strategies. A hands-on experience bridging academic concepts with real-world software engineering."
      },
      {
        title: "Orabot",
        date: "October 6, 2023",
        image: "/events/orabot.png?v=1",
        description: "A unique public speaking and technology competition focusing on Large Language Models. Participants were challenged to craft persuasive speeches and arguments with the assistance of AI tools, then deliver them live. Exploring the intersection of human communication and artificial intelligence generation."
      },
      {
        title: "Apple Keynote event",
        date: "September 12, 2023",
        image: "/events/applekeynote.png?v=1",
        description: "Our annual tradition of watching the Apple Keynote together, enhanced with our custom-built Apple Bingo web application. Real-time excitement as we tracked product announcements, design reveals, and classic 'one more thing' moments, with the first to complete their digital bingo card winning exclusive tech swag."
      }
    ];

    // reverse so older events get inserted first, then newer, maintaining chronological order
    for (const event of initialEvents.reverse()) {
      const uuid = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2);
      await db.execute(
        'INSERT INTO events (id, title, date, image, description) VALUES (?, ?, ?, ?, ?)',
        [uuid, event.title, event.date, event.image, event.description]
      );
    }
    const freshRes = await db.execute('SELECT * FROM events ORDER BY created_at DESC');
    return freshRes.rows;
  };

  const loadData = async () => {
    try {
      if (!db) return;
      
      // Ensure ALL tables exist before querying
      await db.execute(`CREATE TABLE IF NOT EXISTS personnel (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, department TEXT, image TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
      await db.execute(`CREATE TABLE IF NOT EXISTS blogs (id TEXT PRIMARY KEY, title TEXT, url TEXT, thumbnail TEXT, date TEXT, views INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
      await db.execute(`CREATE TABLE IF NOT EXISTS announcements (id TEXT PRIMARY KEY, content TEXT, is_active INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
      await db.execute(`CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, title TEXT, date TEXT, image TEXT, description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);

      const [memRes, blogRes, annRes, evRes] = await Promise.all([
        db.execute('SELECT * FROM personnel'),
        db.execute('SELECT * FROM blogs ORDER BY created_at DESC'),
        db.execute('SELECT * FROM announcements ORDER BY created_at DESC'),
        db.execute('SELECT * FROM events ORDER BY created_at DESC')
      ]);
      
      const loadedPersonnel = memRes.rows || [];
      const seededPersonnel = await checkAndSeedPersonnel(loadedPersonnel);
      setMembers(seededPersonnel);

      if (blogRes.rows) setBlogs(blogRes.rows);
      if (annRes.rows) setAnnouncements(annRes.rows);
      
      const loadedEvents = evRes.rows || [];
      const seededEvents = await checkAndSeedEvents(loadedEvents);
      setEvents(seededEvents);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('dotslash_admin_auth');
    navigate('/login');
  };

  const uploadImage = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: formData
    });
    
    if (!res.ok) throw new Error("Upload failed");
    const data = await res.json();
    return data.secure_url;
  };

  const handleMemberSubmit = async (e) => {
    e.preventDefault();
    if (!memberForm.name || !memberForm.role || (!memberForm.imageFile && !editMemberId)) {
      alert("Please fill all fields and select an image.");
      return;
    }
    
    setUploading(true);
    try {
      let imageUrl = null;
      if (memberForm.imageFile) {
        imageUrl = await uploadImage(memberForm.imageFile);
      }
      
      if (editMemberId) {
        if (imageUrl) {
          await db.execute('UPDATE personnel SET name = ?, role = ?, department = ?, image = ? WHERE id = ?', [memberForm.name, memberForm.role, memberForm.department, imageUrl, editMemberId]);
        } else {
          await db.execute('UPDATE personnel SET name = ?, role = ?, department = ? WHERE id = ?', [memberForm.name, memberForm.role, memberForm.department, editMemberId]);
        }
        setEditMemberId(null);
      } else {
        const id = (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2));
        await db.execute('INSERT INTO personnel (id, name, role, department, image) VALUES (?, ?, ?, ?, ?)', [id, memberForm.name, memberForm.role, memberForm.department, imageUrl]);
      }
      
      setMemberForm({ name: '', role: '', department: 'executive', imageFile: null });
      loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to save member");
    } finally {
      setUploading(false);
    }
  };

  const editMember = (member) => {
    setMemberForm({ name: member.name, role: member.role, department: member.department, imageFile: null });
    setEditMemberId(member.id);
    setActiveTab('personnel');
  };

  const deleteMember = async (id) => {
    if (!confirm("Remove this member?")) return;
    await db.execute('DELETE FROM personnel WHERE id = ?', [id]);
    loadData();
  };

  const handleBlogSubmit = async (e) => {
    e.preventDefault();
    if (!blogForm.title || !blogForm.url || !blogForm.date) {
      alert("Fill required fields");
      return;
    }
    setUploading(true);
    try {
      let thumbnailUrl = null;
      if (blogForm.thumbnailFile) {
        thumbnailUrl = await uploadImage(blogForm.thumbnailFile);
      }
      
      const id = (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2));
      await db.execute(
        'INSERT INTO blogs (id, title, url, thumbnail, date) VALUES (?, ?, ?, ?, ?)',
        [id, blogForm.title, blogForm.url, thumbnailUrl, blogForm.date]
      );
      setBlogForm({ title: '', url: '', thumbnailFile: null, date: '' });
      loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to add blog");
    } finally {
      setUploading(false);
    }
  };

  const deleteBlog = async (id) => {
    if (!confirm("Delete this blog?")) return;
    await db.execute('DELETE FROM blogs WHERE id = ?', [id]);
    loadData();
  };

  const handleAnnouncementSubmit = async (e) => {
    e.preventDefault();
    if (!announcementForm.content) return;
    setUploading(true);
    try {
      const id = (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2));
      await db.execute('UPDATE announcements SET is_active = 0');
      await db.execute(
        'INSERT INTO announcements (id, content, is_active) VALUES (?, ?, 1)',
        [id, announcementForm.content]
      );
      setAnnouncementForm({ content: '' });
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const toggleAnnouncement = async (id, currentStatus) => {
    await db.execute('UPDATE announcements SET is_active = ? WHERE id = ?', [currentStatus ? 0 : 1, id]);
    loadData();
  };

  const deleteAnnouncement = async (id) => {
    if (!confirm("Delete this announcement?")) return;
    await db.execute('DELETE FROM announcements WHERE id = ?', [id]);
    loadData();
  };

  const handleEventSubmit = async (e) => {
    e.preventDefault();
    if (!eventForm.title || !eventForm.date || !eventForm.description || !eventForm.imageFile) {
      alert("Please fill all fields and select an image.");
      return;
    }
    setUploading(true);
    try {
      const imageUrl = await uploadImage(eventForm.imageFile);
      const id = (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2));
      await db.execute(
        'INSERT INTO events (id, title, date, image, description) VALUES (?, ?, ?, ?, ?)',
        [id, eventForm.title, eventForm.date, imageUrl, eventForm.description]
      );
      setEventForm({ title: '', date: '', description: '', imageFile: null });
      loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to add event");
    } finally {
      setUploading(false);
    }
  };

  const deleteEvent = async (id) => {
    if (!confirm("Delete this event?")) return;
    await db.execute('DELETE FROM events WHERE id = ?', [id]);
    loadData();
  };

  return (
    <div className="min-h-screen bg-[#030303] text-white font-sans overflow-x-hidden pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        
        <header className="flex justify-between items-end mb-12 border-b border-[#353535] pb-6">
          <div>
            <h1 className="font-headline-display text-4xl text-[#3300FF] uppercase tracking-tighter">Command Center</h1>
            <p className="font-mono text-xs text-[#A0A0A0] tracking-widest mt-2 uppercase">Role: {role}</p>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-[#A0A0A0] hover:text-[#FF3366] transition-colors font-mono text-xs uppercase">
            <LogOut size={16} /> Disconnect
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          <div className="lg:col-span-4 flex flex-col gap-8">
            <div className="flex flex-wrap gap-2">
              {isSuperAdmin && (
                <>
                  <button onClick={() => {setActiveTab('personnel'); setEditMemberId(null); setMemberForm({ name: '', role: '', department: 'executive', imageFile: null })}} className={`flex items-center gap-2 px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors ${activeTab === 'personnel' ? 'bg-[#3300FF] text-white' : 'border border-[#353535] text-[#A0A0A0] hover:border-[#3300FF]'}`}>
                    <Users size={14} /> Personnel
                  </button>
                  <button onClick={() => setActiveTab('events')} className={`flex items-center gap-2 px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors ${activeTab === 'events' ? 'bg-[#3300FF] text-white' : 'border border-[#353535] text-[#A0A0A0] hover:border-[#3300FF]'}`}>
                    <Calendar size={14} /> Events
                  </button>
                </>
              )}
              {(isSuperAdmin || isBlogAdmin) && (
                <button onClick={() => setActiveTab('blogs')} className={`flex items-center gap-2 px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors ${activeTab === 'blogs' ? 'bg-[#3300FF] text-white' : 'border border-[#353535] text-[#A0A0A0] hover:border-[#3300FF]'}`}>
                  <FileText size={14} /> Blogs
                </button>
              )}
              {(isSuperAdmin || isAnnouncementAdmin) && (
                <button onClick={() => setActiveTab('announcements')} className={`flex items-center gap-2 px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors ${activeTab === 'announcements' ? 'bg-[#3300FF] text-white' : 'border border-[#353535] text-[#A0A0A0] hover:border-[#3300FF]'}`}>
                  <Megaphone size={14} /> Broadcast
                </button>
              )}
            </div>

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
                  <span className="text-xs font-mono text-[#A0A0A0] truncate max-w-full">{memberForm.imageFile ? memberForm.imageFile.name : (editMemberId ? 'Replace Scan (Optional)' : 'Upload Scan')}</span>
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => setMemberForm({...memberForm, imageFile: e.target.files[0]})} />
                </label>
                
                {editMemberId && (
                  <button type="button" onClick={() => {setEditMemberId(null); setMemberForm({ name: '', role: '', department: 'executive', imageFile: null });}} className="text-xs text-[#A0A0A0] font-mono hover:text-white uppercase tracking-widest text-left">
                    Cancel Edit
                  </button>
                )}

                <button type="submit" disabled={uploading} className="mt-4 bg-[#3300FF] hover:bg-[#00D4FF] text-white py-4 uppercase tracking-[0.2em] font-bold text-sm shadow-[0_0_15px_rgba(51,0,255,0.4)] disabled:opacity-50">
                  {uploading ? 'SAVING...' : (editMemberId ? 'UPDATE MEMBER' : 'ADD MEMBER')}
                </button>
              </form>
            )}

            {/* Events Form */}
            {activeTab === 'events' && (
              <form onSubmit={handleEventSubmit} className="flex flex-col gap-5">
                <input type="text" placeholder="Event Title" value={eventForm.title} onChange={(e) => setEventForm({...eventForm, title: e.target.value})} className="w-full bg-[#030303] border border-[#353535] px-4 py-3 text-white font-mono text-sm focus:border-[#00D4FF] outline-none" />
                <input type="text" placeholder="Date (e.g. September 12, 2025)" value={eventForm.date} onChange={(e) => setEventForm({...eventForm, date: e.target.value})} className="w-full bg-[#030303] border border-[#353535] px-4 py-3 text-white font-mono text-sm focus:border-[#00D4FF] outline-none" />
                <textarea 
                  placeholder="Event Description..." 
                  value={eventForm.description} 
                  onChange={(e) => setEventForm({...eventForm, description: e.target.value})} 
                  className="w-full bg-[#030303] border border-[#353535] px-4 py-3 text-white font-mono text-sm focus:border-[#00D4FF] outline-none h-32 resize-none" 
                />
                <label className="w-full bg-[#030303] border border-[#353535] border-dashed p-6 flex flex-col items-center cursor-pointer hover:border-[#00D4FF]">
                  <Upload size={20} className="text-[#A0A0A0] mb-3" />
                  <span className="text-xs font-mono text-[#A0A0A0] truncate max-w-full">{eventForm.imageFile ? eventForm.imageFile.name : 'Upload Event Banner'}</span>
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => setEventForm({...eventForm, imageFile: e.target.files[0]})} />
                </label>
                <button type="submit" disabled={uploading} className="mt-4 bg-[#3300FF] hover:bg-[#00D4FF] text-white py-4 uppercase tracking-[0.2em] font-bold text-sm shadow-[0_0_15px_rgba(51,0,255,0.4)] disabled:opacity-50">
                  {uploading ? 'UPLOADING...' : 'ADD EVENT'}
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
                {activeTab === 'events' && events.length}
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
                  <div key={member.id} className={`bg-[#0a0a0a] border ${editMemberId === member.id ? 'border-[#00D4FF]' : 'border-[#222]'} hover:border-[#3300FF] p-3 flex gap-4 items-center relative group transition-all`}>
                    <img src={member.image} alt={member.name} className="w-16 h-16 object-cover filter grayscale group-hover:grayscale-0 transition-all" />
                    <div className="flex-1 min-w-0 pr-16">
                      <h3 className="font-headline-md text-white uppercase text-lg truncate">{member.name}</h3>
                      <p className="text-[11px] text-[#A0A0A0] font-mono truncate">{member.role}</p>
                    </div>
                    <div className="absolute top-1/2 -translate-y-1/2 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => editMember(member)} className="p-2 text-[#00D4FF] hover:bg-[#00D4FF]/20 rounded"><Edit2 size={14} /></button>
                      <button onClick={() => deleteMember(member.id)} className="p-2 text-[#FF3366] hover:bg-[#FF3366]/20 rounded"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}

                {/* Events List */}
                {activeTab === 'events' && events.map(event => (
                  <div key={event.id} className="bg-[#0a0a0a] border border-[#222] hover:border-[#3300FF] p-4 relative group transition-all col-span-full">
                    <div className="flex gap-4">
                      {event.image && <img src={event.image} alt="" className="w-24 h-24 object-cover opacity-70 group-hover:opacity-100" />}
                      <div className="flex-1 pr-12">
                        <h3 className="font-headline-md text-white text-xl">{event.title}</h3>
                        <p className="text-xs text-[#00D4FF] font-mono mt-1">{event.date}</p>
                        <p className="text-sm text-[#A0A0A0] font-mono mt-2 line-clamp-2">{event.description}</p>
                      </div>
                    </div>
                    <button onClick={() => deleteEvent(event.id)} className="absolute top-4 right-4 bg-[#FF3366]/20 p-2 text-[#FF3366] opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                  </div>
                ))}

                {/* Blogs List */}
                {activeTab === 'blogs' && blogs.map(blog => (
                  <div key={blog.id} className="bg-[#0a0a0a] border border-[#222] hover:border-[#3300FF] p-4 relative group transition-all">
                    {blog.thumbnail && <img src={blog.thumbnail} alt="" className="w-full h-32 object-cover mb-4 opacity-50 group-hover:opacity-100" />}
                    <h3 className="font-headline-md text-white text-md line-clamp-2">{blog.title}</h3>
                    <div className="flex justify-between items-center mt-2 pr-8">
                      <p className="text-[10px] text-[#00D4FF] font-mono">{blog.date}</p>
                      <div className="flex items-center gap-1 text-[10px] text-[#A0A0A0] font-mono bg-[#111] px-2 py-1 rounded">
                        <Eye size={12} />
                        {blog.views || 0}
                      </div>
                    </div>
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
