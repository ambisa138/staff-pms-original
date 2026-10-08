import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, serverTimestamp, where, doc, updateDoc, setDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, handleFirestoreError, OperationType, cleanForFirestore } from '../../packages/shared/firebase';
import firebaseConfig from '../../../firebase-applet-config.json';
import { UserPlus, Search, Filter, MoreVertical, Shield, Building, MapPin, Edit, Check, X, Copy, KeyRound, CheckCircle2 } from 'lucide-react';
import { StatusChip, cn } from '../../packages/shared/components/UI';

const getSecondaryAuth = () => {
  const existingApp = getApps().find(a => a.name === 'AdminSecondaryAuth');
  const app = existingApp || initializeApp(firebaseConfig, 'AdminSecondaryAuth');
  return getAuth(app);
};

export const UserManagement = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [createdCredential, setCreatedCredential] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  const [districts, setDistricts] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: 'Bank123456!',
    role: 'Branch Staff',
    districtId: '',
    branchId: '',
    phone: ''
  });
  const [registering, setRegistering] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchHierarchy();
  }, []);

  const fetchHierarchy = async () => {
    try {
      let dSnap;
      try {
        dSnap = await getDocs(collection(db, "districts"));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, "districts");
        return;
      }

      let bSnap;
      try {
        bSnap = await getDocs(collection(db, "branches"));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, "branches");
        return;
      }

      const dedupeList = <T extends { id?: string; uid?: string; email?: string }>(list: T[]): T[] => {
        const seen = new Set<string>();
        return list.filter(item => {
          const key = item.id || item.uid || item.email;
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      };

      setDistricts(dedupeList(dSnap.docs.map(d => ({ ...(d.data() as any), id: d.id }))));
      setBranches(dedupeList(bSnap.docs.map(d => ({ ...(d.data() as any), id: d.id }))));
    } catch (e: any) {
      console.warn("Hierarchy fetch error:", e);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let snap;
      try {
        snap = await getDocs(collection(db, "users"));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, "users");
        return;
      }

      const dedupeList = <T extends { id?: string; uid?: string; email?: string }>(list: T[]): T[] => {
        const seen = new Set<string>();
        return list.filter(item => {
          const key = item.id || item.uid || item.email;
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      };

      setUsers(dedupeList(snap.docs.map(doc => ({ ...(doc.data() as any), id: doc.id }))));
    } catch (e: any) {
      console.warn("Users fetch error:", e);
      setErrorMsg(e.message || "Failed to fetch users.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.email) return;
    setRegistering(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const generatedUsername = generateUsername(formData.fullName);
      const userPassword = formData.password || 'Bank123456!';
      let authUid = 'user_' + Date.now();

      // Create user in Firebase Authentication via secondary app
      try {
        const secAuth = getSecondaryAuth();
        const primaryAuthEmail = `${generatedUsername.toLowerCase()}@bank.com`;
        const userCred = await createUserWithEmailAndPassword(secAuth, primaryAuthEmail, userPassword);
        authUid = userCred.user.uid;
        await signOut(secAuth);
      } catch (authErr: any) {
        console.warn("Auth provision note (bank email):", authErr.message);
        try {
          const secAuth = getSecondaryAuth();
          const userCred = await createUserWithEmailAndPassword(secAuth, formData.email.trim(), userPassword);
          authUid = userCred.user.uid;
          await signOut(secAuth);
        } catch (e2: any) {
          console.warn("Auth provision note (direct email):", e2.message);
        }
      }
      
      const newUser = cleanForFirestore({
        uid: authUid,
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        username: generatedUsername,
        role: formData.role,
        districtId: formData.districtId || '',
        branchId: formData.branchId || '',
        phone: formData.phone || '',
        status: 'active',
        mustChangePassword: true,
        profileCompleted: true,
        createdAt: serverTimestamp()
      });

      try {
        await setDoc(doc(db, "users", authUid), newUser);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${authUid}`);
        return;
      }
      
      // Log action in audit logs
      try {
        await addDoc(collection(db, "auditLogs"), {
          action: "CREATE_USER",
          actorId: "SuperAdmin",
          targetId: authUid,
          timestamp: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, "auditLogs");
        return;
      }

      setCreatedCredential({
        fullName: formData.fullName.trim(),
        username: generatedUsername,
        email: formData.email.trim(),
        password: userPassword,
        role: formData.role
      });

      setShowModal(false);
      setSuccessMsg(`User ${formData.fullName} created successfully with username @${generatedUsername}.`);
      setFormData({
        fullName: '',
        email: '',
        password: 'Bank123456!',
        role: 'Branch Staff',
        districtId: '',
        branchId: '',
        phone: ''
      });
      fetchUsers();
    } catch (err: any) {
      console.error("User registration error:", err);
      setErrorMsg(err.message || "Failed to register user. Please check permissions.");
    } finally {
      setRegistering(false);
    }
  };

  const handleUpdateUserAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setRegistering(true);
    setErrorMsg(null);
    try {
      const userDocId = editingUser.id || editingUser.uid;
      await updateDoc(doc(db, "users", userDocId), cleanForFirestore({
        fullName: editingUser.fullName,
        role: editingUser.role,
        districtId: editingUser.districtId || '',
        branchId: editingUser.branchId || '',
        phone: editingUser.phone || '',
        status: editingUser.status || 'active'
      }));

      setSuccessMsg(`Updated assignments for ${editingUser.fullName}.`);
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      console.error("User update error:", err);
      setErrorMsg(err.message || "Failed to update user.");
    } finally {
      setRegistering(false);
    }
  };

  const generateUsername = (fullName: string) => {
    const parts = fullName.trim().toLowerCase().split(' ');
    if (parts.length < 2) return parts[0] || 'user';
    return `${parts[0]}_${parts[1]}`.replace(/[^a-z0-9_]/g, '');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredUsers = users.filter(u => 
    u.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-primary tracking-tight">Personnel Directory</h1>
          <p className="text-slate-500 font-medium text-xs mt-0.5">Staff & Management Accounts</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="btn-primary"
        >
          <UserPlus className="w-5 h-5" />
          Register New User
        </button>
      </div>

      {createdCredential && (
        <div className="p-6 bg-indigo-50 border border-indigo-200 rounded-2xl animate-in fade-in">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 text-white rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-indigo-950 text-base">New Staff Account Credentials Generated</h3>
                <p className="text-xs text-indigo-700">Share these login credentials with the staff member</p>
              </div>
            </div>
            <button 
              onClick={() => setCreatedCredential(null)}
              className="text-indigo-400 hover:text-indigo-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 bg-white p-4 rounded-xl border border-indigo-100 font-mono text-xs">
            <div>
              <div className="text-slate-400 font-sans font-bold uppercase text-[10px]">Full Name</div>
              <div className="font-bold text-slate-800 text-sm mt-0.5">{createdCredential.fullName}</div>
            </div>
            <div>
              <div className="text-slate-400 font-sans font-bold uppercase text-[10px]">Username</div>
              <div className="font-bold text-indigo-600 text-sm mt-0.5">@{createdCredential.username}</div>
            </div>
            <div>
              <div className="text-slate-400 font-sans font-bold uppercase text-[10px]">Login Email</div>
              <div className="font-bold text-slate-800 text-sm mt-0.5">{createdCredential.email}</div>
            </div>
            <div>
              <div className="text-slate-400 font-sans font-bold uppercase text-[10px]">Password</div>
              <div className="font-bold text-emerald-600 text-sm mt-0.5">{createdCredential.password}</div>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={() => copyToClipboard(`Staff Login Credentials:\nName: ${createdCredential.fullName}\nUsername: ${createdCredential.username}\nEmail: ${createdCredential.email}\nPassword: ${createdCredential.password}\nRole: ${createdCredential.role}`)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied to Clipboard!' : 'Copy Credentials to Clipboard'}
            </button>
          </div>
        </div>
      )}

      {successMsg && !createdCredential && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-emerald-600" />
            {successMsg}
          </div>
          <button onClick={() => setSuccessMsg(null)}><X className="w-4 h-4 text-emerald-500" /></button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-bold flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)}><X className="w-4 h-4 text-red-500" /></button>
        </div>
      )}

      {/* --- Filters --- */}
      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl shadow-subtle border border-slate-100">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by name, email, role, or username..." 
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-accent/50 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* --- User Table --- */}
      <div className="bg-white rounded-xl shadow-subtle border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">District / Branch Assignment</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user, idx) => (
                <tr key={`user-row-${user.id || user.uid || 'usr'}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-primary font-bold overflow-hidden border border-slate-200 shrink-0">
                        {user.photoUrl ? (
                          <img src={user.photoUrl} alt={user.fullName} className="w-full h-full object-cover" />
                        ) : (
                          user.fullName?.charAt(0)
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-primary text-sm">{user.fullName}</div>
                        <div className="text-[10px] text-slate-400 font-medium">@{user.username || generateUsername(user.fullName || 'user')} • {user.email}</div>
                        {user.lastLogin && (
                          <div className="text-[9px] text-indigo-500 font-bold uppercase mt-0.5">Last seen: {user.lastLogin.toDate ? user.lastLogin.toDate().toLocaleString() : 'Recent'}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                      <Shield className="w-3.5 h-3.5 text-accent" />
                      {user.role}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                        {districts.find(d => d.id === user.districtId)?.name || (user.districtId ? 'Assigned District' : 'No District Assigned')}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                        <Building className="w-3.5 h-3.5 text-amber-500" />
                        {branches.find(b => b.id === user.branchId)?.name || (user.branchId ? 'Assigned Branch' : 'No Branch Assigned')}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusChip status={user.status || 'active'} />
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => setEditingUser({ ...user })}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Edit / Assign
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && !loading && (
          <div className="p-12 text-center">
            <div className="text-slate-300 mb-2 font-bold text-sm uppercase tracking-widest">No personnel records found</div>
            <p className="text-slate-400 text-xs">Try adjusting your filters or search term</p>
          </div>
        )}
      </div>

      {/* --- Edit User Modal --- */}
      {editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-primary/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-extrabold text-primary mb-1">Edit User Assignment</h2>
            <p className="text-xs text-slate-400 mb-6">{editingUser.fullName} ({editingUser.email})</p>
            <form onSubmit={handleUpdateUserAssignment} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Full Name</label>
                <input 
                  required 
                  value={editingUser.fullName}
                  onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
                  className="w-full mt-1 px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-accent/50 text-sm font-bold" 
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Role</label>
                <select 
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                  className="w-full mt-1 px-4 py-2 rounded-lg border border-slate-200 outline-none text-sm font-bold bg-slate-50"
                >
                  <option value="Super Admin">Super Admin</option>
                  <option value="District Director">District Director</option>
                  <option value="Branch Manager">Branch Manager</option>
                  <option value="Branch Staff">Branch Staff</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">District</label>
                  <select 
                    value={editingUser.districtId || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, districtId: e.target.value, branchId: '' })}
                    className="w-full mt-1 px-4 py-2 rounded-lg border border-slate-200 outline-none text-sm font-bold bg-slate-50"
                  >
                    <option value="">No District</option>
                    {districts.map((d, idx) => <option key={`edit-dist-${d.id}-${idx}`} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Branch</label>
                  <select 
                    value={editingUser.branchId || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, branchId: e.target.value })}
                    className="w-full mt-1 px-4 py-2 rounded-lg border border-slate-200 outline-none text-sm font-bold bg-slate-50"
                  >
                    <option value="">No Branch</option>
                    {branches
                      .filter(b => !editingUser.districtId || b.districtId === editingUser.districtId)
                      .map((b, idx) => <option key={`edit-br-${b.id}-${idx}`} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <button 
                  type="button" 
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={registering}
                  className="flex-1 btn-primary py-2 text-sm disabled:opacity-50"
                >
                  {registering ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Registration Modal --- */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-primary/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-extrabold text-primary mb-6">Register Bank Staff Member</h2>
            <form onSubmit={handleRegisterUser} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Full Name</label>
                <input 
                  required 
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full mt-1 px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-accent/50 text-sm font-bold" 
                  placeholder="e.g. Abebe Kebede"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Email Address</label>
                  <input 
                    type="email"
                    required 
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full mt-1 px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-accent/50 text-sm font-bold" 
                    placeholder="user@bank.com"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Initial Password</label>
                  <input 
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full mt-1 px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-accent/50 text-sm font-bold font-mono" 
                    placeholder="Bank123456!"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Role</label>
                  <select 
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full mt-1 px-4 py-2 rounded-lg border border-slate-200 outline-none text-sm font-bold bg-slate-50"
                  >
                    <option value="District Director">District Director</option>
                    <option value="Branch Manager">Branch Manager</option>
                    <option value="Branch Staff">Branch Staff</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Phone Number</label>
                  <input 
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full mt-1 px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-accent/50 text-sm font-bold" 
                    placeholder="+251 9..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">District</label>
                  <select 
                    value={formData.districtId}
                    onChange={(e) => setFormData({ ...formData, districtId: e.target.value, branchId: '' })}
                    className="w-full mt-1 px-4 py-2 rounded-lg border border-slate-200 outline-none text-sm font-bold bg-slate-50"
                  >
                    <option value="">Select District</option>
                    {districts.map((d, idx) => <option key={`reg-dist-${d.id}-${idx}`} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Branch</label>
                  <select 
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                    className="w-full mt-1 px-4 py-2 rounded-lg border border-slate-200 outline-none text-sm font-bold bg-slate-50"
                  >
                    <option value="">Select Branch</option>
                    {branches
                      .filter(b => !formData.districtId || b.districtId === formData.districtId)
                      .map((b, idx) => <option key={`reg-br-${b.id}-${idx}`} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={registering}
                  className="flex-1 btn-primary py-2 text-sm disabled:opacity-50"
                >
                  {registering ? 'Saving User...' : 'Register User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

