import React, { useState, useRef } from 'react';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { updatePassword } from 'firebase/auth';
import { db, auth, cleanForFirestore } from './packages/shared/firebase';
import { UserProfile } from './packages/shared/services';
import { processProfileImage } from './packages/shared/utils/image';
import { ShieldCheck, User, Phone, Mail, Camera, Loader2, ArrowRight, Plus, CheckCircle2 } from 'lucide-react';

export const UserOnboarding = ({ profile, onComplete }: { profile: UserProfile, onComplete: () => void }) => {
  const [step, setStep] = useState(profile.mustChangePassword ? 1 : 2);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string>(profile.photoUrl || '');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePasswordChange = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newPassword = formData.get('password') as string;
    
    setLoading(true);
    setError(null);
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword).catch((authErr) => {
          console.warn("Auth password update notice:", authErr);
        });
      }
      await updateDoc(doc(db, "users", profile.uid), {
        mustChangePassword: false
      });
      setStep(2);
    } catch (err: any) {
      setError(err.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setError(null);
    try {
      const processedUrl = await processProfileImage(file);
      setPhotoUrl(processedUrl);
    } catch (err: any) {
      console.error("Photo processing error:", err);
      setError("Failed to process photo. Please select an image file.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleProfileComplete = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const phone = formData.get('phone') as string;
    const email = formData.get('email') as string;

    setLoading(true);
    try {
      const targetDocId = (profile as any).id || profile.uid;
      const updateData = cleanForFirestore({
        phone: phone || '',
        email: email || profile.email || '',
        photoUrl: photoUrl || '',
        profileCompleted: true
      });
      await setDoc(doc(db, "users", targetDocId), updateData, { merge: true });
      if (auth.currentUser?.uid && auth.currentUser.uid !== targetDocId) {
        await setDoc(doc(db, "users", auth.currentUser.uid), updateData, { merge: true }).catch(() => null);
      }
      onComplete();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 border border-slate-100">
        {step === 1 ? (
          <div className="space-y-6">
            <div className="text-center">
              <div className="bg-amber-100 p-3 rounded-full inline-block mb-4">
                <ShieldCheck className="w-8 h-8 text-amber-600" />
              </div>
              <h1 className="text-2xl font-bold text-primary">Secure Your Account</h1>
              <p className="text-sm text-slate-500 mt-2">First login detected. Please set a new secure password.</p>
            </div>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">New Password</label>
                <input name="password" type="password" required className="w-full mt-1 px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-accent/50" />
              </div>
              <button disabled={loading} className="w-full btn-primary py-4">
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Update Password"}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <div className="bg-indigo-100 p-3 rounded-full inline-block mb-4">
                <User className="w-8 h-8 text-indigo-600" />
              </div>
              <h1 className="text-2xl font-bold text-primary">Complete Your Profile</h1>
              <p className="text-sm text-slate-500 mt-2">Welcome, {profile.fullName}! Let's finalize your photo and details.</p>
            </div>

            <form onSubmit={handleProfileComplete} className="space-y-4">
              <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                onChange={handlePhotoSelect} 
                className="hidden" 
              />

              <div className="flex flex-col items-center justify-center mb-6">
                <div 
                  onClick={() => fileInputRef.current?.click()} 
                  className="relative group cursor-pointer"
                >
                  <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center border-2 border-dashed border-slate-300 group-hover:border-accent overflow-hidden transition-colors shadow-sm">
                    {uploadingImage ? (
                      <Loader2 className="w-8 h-8 text-accent animate-spin" />
                    ) : photoUrl ? (
                      <img src={photoUrl} alt="Profile preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-8 h-8 text-slate-400 group-hover:text-accent transition-colors" />
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-accent text-white p-2 rounded-full shadow-lg border-2 border-white">
                    <Plus className="w-4 h-4" />
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()} 
                  className="text-xs font-bold text-accent hover:underline mt-2.5"
                >
                  {photoUrl ? "Change Profile Picture" : "Upload Profile Picture"}
                </button>
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-semibold">
                  {error}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Phone Number</label>
                <div className="relative mt-1">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input name="phone" defaultValue={profile.phone || ''} required className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-accent/50" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Work Email</label>
                <div className="relative mt-1">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input name="email" defaultValue={profile.email} required className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-accent/50" />
                </div>
              </div>

              <button disabled={loading || uploadingImage} className="w-full btn-primary py-4 group">
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                  <>
                    Finish Setup
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
