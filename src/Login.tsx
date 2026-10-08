import React, { useState, useEffect } from 'react';
import { auth, db, cleanForFirestore } from './packages/shared/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup,
  getRedirectResult
} from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ShieldCheck, Lock, User, AlertCircle, Loader2, KeyRound } from 'lucide-react';

export const Login = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [identifierInput, setIdentifierInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  useEffect(() => {
    // Handle redirect result if returning from Google OAuth
    const checkRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          setLoading(false);
        }
      } catch (err: any) {
        console.warn("Redirect sign-in notice:", err);
      }
    };
    checkRedirect();
  }, []);

  const executeSignIn = async (identifier: string, password: string) => {
    setLoading(true);
    setError(null);

    const cleanIdentifier = identifier.trim();
    const cleanPassword = password.trim();

    if (!cleanIdentifier || !cleanPassword) {
      setError("Please provide both username/email and password.");
      setLoading(false);
      return;
    }

    try {
      let matchedUserDoc: any = null;
      let targetAuthEmail = cleanIdentifier;

      // 1. Check if user is Super Admin alias
      const isSuperAdminAlias = 
        cleanIdentifier.toLowerCase() === 'ambogirma7' || 
        cleanIdentifier.toLowerCase() === 'ambogirma7@gmail.com' ||
        cleanIdentifier.toLowerCase() === 'admin' ||
        cleanIdentifier.toLowerCase() === 'superadmin';

      if (isSuperAdminAlias) {
        targetAuthEmail = 'ambogirma7@bank.com';
      } else if (!cleanIdentifier.includes('@')) {
        // Look up by username
        try {
          let snap = await getDocs(query(collection(db, "users"), where("username", "==", cleanIdentifier)));
          if (snap.empty) {
            snap = await getDocs(query(collection(db, "users"), where("username", "==", cleanIdentifier.toLowerCase())));
          }

          if (!snap.empty) {
            matchedUserDoc = { id: snap.docs[0].id, ...snap.docs[0].data() };
            targetAuthEmail = `${(matchedUserDoc.username || cleanIdentifier).toLowerCase()}@bank.com`;
          } else {
            targetAuthEmail = `${cleanIdentifier.toLowerCase()}@bank.com`;
          }
        } catch (queryErr) {
          console.warn("Username query note:", queryErr);
          targetAuthEmail = `${cleanIdentifier.toLowerCase()}@bank.com`;
        }
      } else {
        // User entered an email
        try {
          const snap = await getDocs(query(collection(db, "users"), where("email", "==", cleanIdentifier)));
          if (!snap.empty) {
            matchedUserDoc = { id: snap.docs[0].id, ...snap.docs[0].data() };
            if (matchedUserDoc.username) {
              targetAuthEmail = `${matchedUserDoc.username.toLowerCase()}@bank.com`;
            }
          }
        } catch (e) {
          console.warn("Email query note:", e);
        }
      }

      // 2. Attempt signing in with candidate emails
      let signedIn = false;
      const emailsToTry = [targetAuthEmail];
      if (cleanIdentifier.includes('@') && cleanIdentifier !== targetAuthEmail) {
        emailsToTry.push(cleanIdentifier);
      }
      if (matchedUserDoc?.email && !emailsToTry.includes(matchedUserDoc.email)) {
        emailsToTry.push(matchedUserDoc.email);
      }

      let lastError: any = null;

      for (const email of emailsToTry) {
        try {
          await signInWithEmailAndPassword(auth, email, cleanPassword);
          signedIn = true;
          break;
        } catch (err: any) {
          lastError = err;
        }
      }

      if (signedIn) {
        return;
      }

      // 3. Auto-provision on first login for pre-registered personnel doc
      if (
        lastError?.code === 'auth/user-not-found' || 
        lastError?.code === 'auth/invalid-credential' ||
        lastError?.message?.includes('user-not-found')
      ) {
        try {
          const primaryEmail = targetAuthEmail.includes('@') ? targetAuthEmail : `${cleanIdentifier.toLowerCase()}@bank.com`;
          const userCred = await createUserWithEmailAndPassword(auth, primaryEmail, cleanPassword);

          if (matchedUserDoc) {
            await setDoc(doc(db, "users", userCred.user.uid), cleanForFirestore({
              ...matchedUserDoc,
              uid: userCred.user.uid,
              updatedAt: serverTimestamp()
            }), { merge: true });
          }
          return;
        } catch (createErr: any) {
          if (createErr.code === 'auth/email-already-in-use') {
            throw new Error(`Invalid password for "${cleanIdentifier}". Please check your password.`);
          }
          throw new Error(createErr.message || "Failed to authenticate.");
        }
      }

      // Handle specific error codes
      if (lastError?.code === 'auth/wrong-password' || lastError?.code === 'auth/invalid-credential') {
        throw new Error(`Incorrect password for "${cleanIdentifier}". Please check your credentials or contact your administrator.`);
      } else if (lastError?.code === 'auth/too-many-requests') {
        throw new Error("Too many failed attempts. Please wait a moment and try again.");
      } else {
        throw new Error(lastError?.message || "Invalid credentials. Please verify your username and password.");
      }

    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "Authentication error. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    executeSignIn(identifierInput, passwordInput);
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.warn("Google sign in note:", err);
      if (err.code === 'auth/popup-blocked' || err.message?.includes('popup-blocked')) {
        setError("Browser popup was blocked. Please use Username & Password login above.");
      } else {
        setError(err.message || "Failed to sign in with Google.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 md:p-10 border border-slate-100">
        
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-indigo-50 p-4 rounded-2xl mb-3 border border-indigo-100">
            <ShieldCheck className="w-10 h-10 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Staff Pro Max</h1>
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mt-1">Bank Staff & Management Portal</p>
        </div>

        {/* Username & Password Form */}
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Username or Email</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                name="identifier" 
                type="text" 
                required 
                value={identifierInput}
                onChange={(e) => setIdentifierInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-11 pr-4 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all text-slate-900 font-medium text-sm placeholder:text-slate-400"
                placeholder="Enter assigned username or email"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                name="password" 
                type="password" 
                required 
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-11 pr-4 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all text-slate-900 font-medium text-sm placeholder:text-slate-400"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-xs font-semibold flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer mt-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
              <>
                <KeyRound className="w-4 h-4" />
                Sign In to Banking Portal
              </>
            )}
          </button>
        </form>

        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-slate-200"></div>
          <span className="px-3 text-[10px] uppercase tracking-wider text-slate-400 font-bold">Or Google Access</span>
          <div className="flex-1 border-t border-slate-200"></div>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-3 px-4 rounded-xl font-bold text-xs shadow-2xs transition-all flex items-center justify-center gap-2.5 disabled:opacity-70 cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          Sign In with Google Account
        </button>

        <div className="mt-8 text-center space-y-1">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
            Commercial Banking Portal &copy; 2026 • Production Ready
          </p>
        </div>
      </div>
    </div>
  );
};
