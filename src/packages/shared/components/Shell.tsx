import React, { useState, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { db, auth, cleanForFirestore } from '../firebase';
import { UserProfile } from '../services';
import { processProfileImage } from '../utils/image';
import { 
  LogOut, 
  Menu, 
  X, 
  Shield, 
  Camera, 
  User, 
  Phone, 
  Mail, 
  Check, 
  Loader2, 
  Edit2,
  Sparkles
} from 'lucide-react';
import { cn } from './UI';
import { useInactivityTimeout } from '../hooks/useInactivityTimeout';

interface SidebarItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

export const AppShell = ({ 
  children, 
  role, 
  items, 
  profile, 
  onProfileUpdate 
}: { 
  children: React.ReactNode; 
  role: string; 
  items: SidebarItem[]; 
  profile?: UserProfile; 
  onProfileUpdate?: () => void; 
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string>(profile?.photoUrl || '');
  const [fullName, setFullName] = useState<string>(profile?.fullName || '');
  const [phone, setPhone] = useState<string>(profile?.phone || '');
  const [email, setEmail] = useState<string>(profile?.email || '');
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 15-minute inactivity session lock
  useInactivityTimeout(15 * 60 * 1000);

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const handleOpenProfileModal = () => {
    if (profile) {
      setPhotoUrl(profile.photoUrl || '');
      setFullName(profile.fullName || '');
      setPhone(profile.phone || '');
      setEmail(profile.email || '');
    }
    setMsg(null);
    setShowProfileModal(true);
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg(null);
    try {
      const processedUrl = await processProfileImage(file);
      setPhotoUrl(processedUrl);
      setMsg({ type: 'success', text: 'New photo selected! Click Save Profile to apply.' });
    } catch (err: any) {
      console.error("Photo processing error:", err);
      setMsg({ type: 'error', text: 'Failed to process image file.' });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSavingProfile(true);
    setMsg(null);
    try {
      const targetDocId = (profile as any).id || profile.uid;
      const updateData = cleanForFirestore({
        fullName: fullName.trim() || profile.fullName,
        phone: phone.trim(),
        email: email.trim() || profile.email,
        photoUrl: photoUrl || ''
      });

      await setDoc(doc(db, "users", targetDocId), updateData, { merge: true });
      if (auth.currentUser?.uid && auth.currentUser.uid !== targetDocId) {
        await setDoc(doc(db, "users", auth.currentUser.uid), updateData, { merge: true }).catch(() => null);
      }

      setMsg({ type: 'success', text: 'Profile & profile picture updated successfully!' });
      if (onProfileUpdate) onProfileUpdate();
      setTimeout(() => {
        setShowProfileModal(false);
      }, 1200);
    } catch (err: any) {
      console.error("Profile save error:", err);
      setMsg({ type: 'error', text: err.message || 'Failed to save profile changes.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const userInitials = profile?.fullName
    ? profile.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'BP';

  return (
    <div className="min-h-screen bg-background-grey flex flex-col md:flex-row">
      {/* Hidden file input for global avatar upload */}
      <input 
        type="file" 
        ref={fileInputRef} 
        accept="image/*" 
        onChange={handlePhotoSelect} 
        className="hidden" 
      />

      {/* --- Desktop Sidebar --- */}
      <aside className="hidden md:flex w-64 bg-primary flex-col sticky top-0 h-screen shadow-premium z-30">
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center shadow-md shadow-accent/30 font-black text-white text-sm">
              BP
            </div>
            <div>
              <h1 className="text-white font-extrabold text-base leading-none tracking-tight">Staff Pro Max</h1>
              <span className="text-[10px] text-accent uppercase font-black tracking-widest mt-1 inline-block">{role}</span>
            </div>
          </div>
        </div>

        {/* Logged in User Badge with Avatar */}
        {profile && (
          <div className="p-4 mx-3 my-2 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3 group">
            <div 
              onClick={handleOpenProfileModal} 
              className="relative cursor-pointer shrink-0"
              title="Click to edit profile photo"
            >
              <div className="w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center font-bold text-sm overflow-hidden border border-white/20">
                {profile.photoUrl ? (
                  <img src={profile.photoUrl} alt={profile.fullName} className="w-full h-full object-cover" />
                ) : (
                  userInitials
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 bg-white text-slate-900 p-1 rounded-full shadow border border-slate-200">
                <Camera className="w-2.5 h-2.5 text-accent" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-white font-bold text-xs truncate leading-tight">{profile.fullName}</div>
              <div className="text-accent text-[10px] font-mono truncate mt-0.5">@{profile.username}</div>
            </div>

            <button 
              onClick={handleOpenProfileModal} 
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 transition-colors shrink-0"
              title="Edit Profile & Photo"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                isActive 
                  ? "bg-accent text-white shadow-lg shadow-accent/20" 
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2">
          <div className="px-4 py-2 rounded-xl bg-white/5 flex items-center justify-between text-[11px] text-white/60">
            <span className="flex items-center gap-1.5 font-semibold">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              Terminal Guard
            </span>
            <span className="text-[10px] font-bold text-emerald-400">ACTIVE</span>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-bold text-red-300 hover:bg-red-500/10 hover:text-red-400 transition-all cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* --- Mobile Header & Navigation --- */}
      <header className="md:hidden bg-primary p-4 flex justify-between items-center sticky top-0 z-50 shadow-lg">
        <div className="flex items-center gap-3">
          {profile && (
            <div 
              onClick={handleOpenProfileModal}
              className="relative w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center font-bold text-xs overflow-hidden cursor-pointer"
            >
              {profile.photoUrl ? (
                <img src={profile.photoUrl} alt={profile.fullName} className="w-full h-full object-cover" />
              ) : (
                userInitials
              )}
            </div>
          )}
          <div>
            <h1 className="text-white font-bold text-sm">Staff Pro Max</h1>
            <span className="text-[9px] text-accent font-bold uppercase">{role}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {profile && (
            <button 
              onClick={handleOpenProfileModal} 
              className="p-1.5 bg-white/10 text-white rounded-lg text-xs font-bold flex items-center gap-1"
            >
              <Camera className="w-3.5 h-3.5 text-accent" />
            </button>
          )}
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-white p-1">
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-primary z-40 md:hidden flex flex-col p-8 pt-24 space-y-3">
          {profile && (
            <div className="p-4 bg-white/5 rounded-2xl flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-accent text-white flex items-center justify-center font-bold overflow-hidden">
                {profile.photoUrl ? (
                  <img src={profile.photoUrl} alt={profile.fullName} className="w-full h-full object-cover" />
                ) : (
                  userInitials
                )}
              </div>
              <div className="flex-1">
                <div className="text-white font-bold text-sm">{profile.fullName}</div>
                <div className="text-accent text-xs">@{profile.username}</div>
              </div>
              <button 
                onClick={() => { setIsMobileMenuOpen(false); handleOpenProfileModal(); }}
                className="btn-accent text-xs py-1.5 px-3"
              >
                Edit Photo
              </button>
            </div>
          )}

          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-white text-lg font-bold flex items-center gap-4 py-2 border-b border-white/5"
            >
              <item.icon className="w-5 h-5 text-accent" />
              {item.label}
            </NavLink>
          ))}
          <button 
            onClick={handleLogout}
            className="text-red-400 text-lg font-bold flex items-center gap-4 pt-6 border-t border-white/10"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      )}

      {/* --- Main Content --- */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full pb-20 md:pb-8">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2.5 z-50 shadow-lg">
        {items.slice(0, 5).map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => cn(
              "flex flex-col items-center gap-1 transition-all py-1 px-2 rounded-lg",
              isActive ? "text-accent font-bold" : "text-slate-400"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[9px] uppercase tracking-tighter">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* --- Profile & Profile Photo Modal --- */}
      {showProfileModal && profile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 border border-slate-100 relative">
            <button 
              onClick={() => setShowProfileModal(false)} 
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-accent" />
              <h2 className="text-xl font-extrabold text-primary">My Profile & Avatar</h2>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Avatar Selector */}
              <div className="flex flex-col items-center justify-center my-4">
                <div 
                  onClick={() => fileInputRef.current?.click()} 
                  className="relative group cursor-pointer"
                  title="Click to select new photo"
                >
                  <div className="w-28 h-28 rounded-full bg-slate-100 flex items-center justify-center border-4 border-slate-100 shadow-md group-hover:border-accent overflow-hidden transition-all">
                    {uploading ? (
                      <Loader2 className="w-8 h-8 text-accent animate-spin" />
                    ) : photoUrl ? (
                      <img src={photoUrl} alt="Profile photo" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-2xl font-black text-slate-400">{userInitials}</div>
                    )}
                  </div>
                  <div className="absolute bottom-0 right-0 bg-accent text-white p-2 rounded-full shadow-lg border-2 border-white hover:scale-110 transition-transform">
                    <Camera className="w-4 h-4" />
                  </div>
                </div>

                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()} 
                  className="text-xs font-bold text-accent hover:underline mt-3 flex items-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" />
                  {photoUrl ? "Upload New Profile Picture" : "Choose Profile Picture"}
                </button>
              </div>

              {msg && (
                <div className={cn(
                  "p-3 rounded-xl text-xs font-semibold flex items-center gap-2",
                  msg.type === 'success' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
                )}>
                  {msg.type === 'success' && <Check className="w-4 h-4 shrink-0 text-emerald-600" />}
                  <span>{msg.text}</span>
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Full Name</label>
                <div className="relative mt-1">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-accent/50" 
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Phone Number</label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+2519..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-accent/50" 
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Email</label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-accent/50" 
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowProfileModal(false)}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={savingProfile || uploading}
                  className="flex-1 btn-primary py-2.5 text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
