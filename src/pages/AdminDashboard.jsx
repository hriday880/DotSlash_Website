import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { db } from '../lib/db';
import { LogOut, Upload, Trash2 } from 'lucide-react';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    department: 'executive',
    imageFile: null
  });

  useEffect(() => {
    if (localStorage.getItem('dotslash_admin_auth') !== 'true') {
      setIsAuthenticated(false);
    } else {
      loadMembers();
    }
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('dotslash_admin_auth');
    navigate('/login');
  };

  const loadMembers = async () => {
    try {
      if (!db) {
        console.warn("DB not initialized - check env vars");
        setLoading(false);
        return;
      }
      const result = await db.execute('SELECT * FROM members ORDER BY created_at DESC');
      setMembers(result.rows || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (file) => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
    
    if (!cloudName || !uploadPreset) {
      alert("Cloudinary environment variables missing.");
      return null;
    }

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.role || !formData.imageFile) {
      alert("Please fill all fields and select an image.");
      return;
    }
    
    setUploading(true);
    try {
      const imageUrl = await uploadImage(formData.imageFile);
      if (!imageUrl) throw new Error("Image upload failed");
      
      const id = crypto.randomUUID();
      await db.execute({
        sql: 'INSERT INTO members (id, name, role, department, image) VALUES (?, ?, ?, ?, ?)',
        args: [id, formData.name, formData.role, formData.department, imageUrl]
      });
      
      setFormData({ name: '', role: '', department: 'executive', imageFile: null });
      loadMembers();
    } catch (err) {
      console.error(err);
      alert("Error adding member: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure?")) return;
    try {
      await db.execute({ sql: 'DELETE FROM members WHERE id = ?', args: [id] });
      loadMembers();
    } catch (err) {
      console.error(err);
    }
  };

  if (!isAuthenticated) return <Navigate to="/login" />;

  return (
    <div className="min-h-screen bg-[#030303] text-[#FFFFFF] pt-32 px-4 pb-20 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-end mb-12 border-b border-[#3300FF]/30 pb-6">
          <div>
            <h1 className="font-headline-md text-4xl md:text-5xl text-[#3300FF] uppercase tracking-tighter mb-2">Admin Terminal</h1>
            <p className="font-mono text-sm text-[#00D4FF] tracking-widest uppercase">System Control & Personnel Management</p>
          </div>
          <button onClick={handleSignOut} className="flex items-center gap-2 text-[#A0A0A0] hover:text-[#FF3366] transition-colors border border-transparent hover:border-[#FF3366]/50 px-4 py-2 rounded-sm bg-transparent hover:bg-[#FF3366]/10">
            <LogOut size={16} /> <span className="font-mono text-sm uppercase">Disconnect</span>
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Form Section */}
          <div className="lg:col-span-4 bg-gradient-to-b from-[#131313] to-[#0a0a0a] border border-[#353535] p-8 h-fit relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3300FF] to-[#00D4FF]"></div>
            
            <h2 className="text-xl font-headline-md uppercase tracking-widest text-white mb-8 flex items-center gap-3">
              <span className="w-2 h-2 bg-[#00D4FF] inline-block animate-pulse"></span>
              Register Operative
            </h2>
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-[#A0A0A0] mb-2 font-mono">Operative Name</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full bg-[#030303] border border-[#353535] px-4 py-3 text-white font-mono text-sm focus:border-[#00D4FF] focus:ring-1 focus:ring-[#00D4FF] outline-none transition-all placeholder-[#353535]" placeholder="e.g. Jane Doe" />
              </div>
              
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-[#A0A0A0] mb-2 font-mono">Designation (Role)</label>
                <input type="text" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} className="w-full bg-[#030303] border border-[#353535] px-4 py-3 text-white font-mono text-sm focus:border-[#00D4FF] focus:ring-1 focus:ring-[#00D4FF] outline-none transition-all placeholder-[#353535]" placeholder="e.g. Design Head" />
              </div>
              
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-[#A0A0A0] mb-2 font-mono">Division (Department)</label>
                <select value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} className="w-full bg-[#030303] border border-[#353535] px-4 py-3 text-white font-mono text-sm focus:border-[#00D4FF] focus:ring-1 focus:ring-[#00D4FF] outline-none transition-all appearance-none cursor-pointer">
                  <option value="executive">Executive Committee</option>
                  <option value="content">Content</option>
                  <option value="social_media">Social Media</option>
                  <option value="outreach">Outreach</option>
                  <option value="logistics">Logistics</option>
                  <option value="design">Design</option>
                  <option value="coding_robotics">Coding and Robotics</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-[#A0A0A0] mb-2 font-mono">Visual ID (Image)</label>
                <label className="w-full bg-[#030303] border border-[#353535] border-dashed p-6 flex flex-col items-center justify-center cursor-pointer hover:border-[#00D4FF] hover:bg-[#00D4FF]/5 transition-all group-hover:border-[#353535]">
                  <Upload size={20} className="text-[#A0A0A0] mb-3 group-hover:text-[#00D4FF] transition-colors" />
                  <span className="text-xs font-mono text-[#A0A0A0] text-center px-4 truncate w-full">
                    {formData.imageFile ? formData.imageFile.name : 'CLICK TO UPLOAD SCAN'}
                  </span>
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => setFormData({...formData, imageFile: e.target.files[0]})} />
                </label>
              </div>

              <button type="submit" disabled={uploading} className="mt-6 bg-[#3300FF] hover:bg-[#00D4FF] text-white py-4 uppercase tracking-[0.2em] font-bold text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(51,0,255,0.4)] hover:shadow-[0_0_25px_rgba(0,212,255,0.6)]">
                {uploading ? 'UPLOADING...' : 'AUTHORIZE & SAVE'}
              </button>
            </form>
          </div>

          {/* List Section */}
          <div className="lg:col-span-8">
            <div className="flex justify-between items-center mb-8 border-b border-[#353535] pb-2">
              <h2 className="text-sm font-mono uppercase tracking-widest text-[#A0A0A0]">Active Personnel Registry</h2>
              <span className="text-[#00D4FF] font-mono text-xs">{members.length} ENTRIES</span>
            </div>
            
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="w-8 h-8 border-2 border-[#3300FF] border-t-[#00D4FF] rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {members.map(member => (
                  <div key={member.id} className="bg-[#0a0a0a] border border-[#222] hover:border-[#3300FF] p-3 flex gap-4 items-center relative group transition-all duration-300 hover:bg-[#111]">
                    <div className="w-16 h-16 shrink-0 border border-[#333] group-hover:border-[#00D4FF] transition-colors overflow-hidden relative">
                      <div className="absolute inset-0 bg-[#00D4FF] opacity-0 group-hover:opacity-20 transition-opacity z-10 mix-blend-overlay"></div>
                      <img src={member.image} alt={member.name} className="w-full h-full object-cover filter grayscale group-hover:grayscale-0 transition-all duration-500" />
                    </div>
                    <div className="flex-1 min-w-0 pr-8">
                      <h3 className="font-headline-md text-white uppercase text-lg truncate leading-tight group-hover:text-[#00D4FF] transition-colors">{member.name}</h3>
                      <p className="text-[11px] text-[#A0A0A0] font-mono truncate">{member.role}</p>
                      <span className="inline-block mt-2 px-2 py-0.5 bg-[#3300FF]/20 text-[#3300FF] border border-[#3300FF]/30 text-[9px] uppercase tracking-widest font-mono">
                        {member.department.replace('_', ' ')}
                      </span>
                    </div>
                    <button onClick={() => handleDelete(member.id)} className="absolute top-1/2 -translate-y-1/2 right-4 text-[#FF3366] opacity-0 group-hover:opacity-100 transition-all hover:scale-110 p-2 bg-[#FF3366]/10 rounded-full border border-[#FF3366]/20">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {members.length === 0 && (
                  <div className="col-span-full py-20 border border-dashed border-[#353535] text-center text-[#A0A0A0] font-mono text-sm uppercase tracking-widest">
                    No active personnel found.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
