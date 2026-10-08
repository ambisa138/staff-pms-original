/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { auth, db, getMessagingInstance, handleFirestoreError, OperationType, cleanForFirestore } from './packages/shared/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, setDoc, serverTimestamp, updateDoc, limit, orderBy } from 'firebase/firestore';
import { Loader2, LayoutDashboard, Users, Map, Building2, ClipboardList, Settings, Lock, UserPlus, ShieldCheck, AlertCircle, FileText, Bell, CheckCircle, TrendingUp, Target, Trophy } from 'lucide-react';
import { Login } from './Login';
import { AppShell } from './packages/shared/components/Shell';
import { UserProfile } from './packages/shared/services';

import { UserOnboarding } from './UserOnboarding';
import { PWAInstallPrompt } from './packages/shared/components/PWAInstall';
import { getToken } from 'firebase/messaging';

import { UserManagement } from './apps/admin/UserManagement';
import { SystemStructure } from './apps/admin/SystemStructure';
import { CustomerMapping } from './apps/user/CustomerMapping';
import { PlansReports } from './apps/user/PlansReports';
import { ReviewQueue } from './apps/user/ReviewQueue';
import { BranchTargets } from './apps/user/BranchTargets';
import { Broadcast } from './apps/user/Broadcast';
import { AnalyticsLeaderboard } from './apps/user/AnalyticsLeaderboard';
import { NotificationCenter } from './apps/user/NotificationCenter';
import { PerformanceRecognition } from './apps/user/PerformanceRecognition';
import { ExecutiveDrilldown } from './apps/user/ExecutiveDrilldown';
import { KPIProgressBar } from './packages/shared/components/UI';
import { Sparkles, Layers, Award } from 'lucide-react';

const MASTER_ADMIN_UID = 'lL950zn7P4fC4SgwbLTPx3ORxvf1';

// --- Shared Root Component ---
export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = () => {
    if (user) {
      fetchProfile(user).then(setProfile).catch(() => null);
    }
  };

  const fetchProfile = async (firebaseUser: FirebaseUser): Promise<UserProfile> => {
    // Master Super Admin auto-bootstrap
    if (
      firebaseUser.uid === MASTER_ADMIN_UID || 
      firebaseUser.email === 'ambogirma7@gmail.com' ||
      firebaseUser.email === 'ambogirma7@bank.com' ||
      firebaseUser.email === 'admin@bank.com'
    ) {
      const adminProfile: UserProfile = {
        uid: firebaseUser.uid,
        fullName: 'System Administrator',
        username: 'ambogirma7',
        role: 'Super Admin',
        email: firebaseUser.email || 'ambogirma7@gmail.com',
        status: 'active',
        mustChangePassword: false,
        profileCompleted: true,
        createdAt: new Date().toISOString()
      };

      // Non-blocking background sync to Firestore
      setDoc(doc(db, "users", firebaseUser.uid), cleanForFirestore({
        ...adminProfile,
        lastLogin: serverTimestamp(),
        createdAt: serverTimestamp()
      }), { merge: true }).catch(err => {
        console.warn("Background admin doc sync:", err);
      });

      return {
        ...adminProfile,
        createdAt: new Date().toISOString()
      };
    }

    try {
      const docRef = doc(db, "users", firebaseUser.uid);
      let docSnap;
      try {
        docSnap = await getDoc(docRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
        throw err;
      }
      if (docSnap.exists()) {
        return docSnap.data() as UserProfile;
      }

      // Check if user has a pre-registered profile by email or username
      if (firebaseUser.email) {
        let q = query(collection(db, "users"), where("email", "==", firebaseUser.email), limit(1));
        let qSnap;
        try {
          qSnap = await getDocs(q);
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, "users");
          throw err;
        }

        if (qSnap.empty) {
          const usernamePrefix = firebaseUser.email.split('@')[0].toLowerCase();
          try {
            qSnap = await getDocs(query(collection(db, "users"), where("username", "==", usernamePrefix), limit(1)));
          } catch (e) {
            console.warn("Username fallback lookup error:", e);
          }
        }

        if (qSnap && !qSnap.empty) {
          const preRegisteredData = qSnap.docs[0].data();
          const mappedProfile: UserProfile = {
            ...preRegisteredData,
            uid: firebaseUser.uid, // Map the authentic UID
          } as UserProfile;

          try {
            await setDoc(doc(db, "users", firebaseUser.uid), cleanForFirestore({
              ...mappedProfile,
              uid: firebaseUser.uid,
              lastLogin: serverTimestamp(),
              updatedAt: serverTimestamp()
            }), { merge: true });
          } catch (err) {
            console.warn("Background user doc map warn:", err);
          }

          return mappedProfile;
        }
      }
    } catch (err) {
      console.warn("Profile fetch error:", err);
    }

    // Default fallback profile
    return {
      uid: firebaseUser.uid,
      fullName: firebaseUser.displayName || 'Bank Staff Member',
      username: (firebaseUser.email || 'user').split('@')[0],
      role: 'Branch Staff',
      email: firebaseUser.email || '',
      status: 'active',
      mustChangePassword: false,
      profileCompleted: true,
      createdAt: new Date().toISOString()
    };
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        setError(null);
        if (firebaseUser) {
          setUser(firebaseUser);
          const userProfile = await fetchProfile(firebaseUser);
          setProfile(userProfile);

          // Non-blocking FCM setup
          getMessagingInstance().then(async (messaging) => {
            if (messaging) {
              const token = await getToken(messaging).catch(() => null);
              if (token) await updateDoc(doc(db, "users", firebaseUser.uid), { fcmToken: token }).catch(() => null);
            }
          }).catch(() => null);
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (err: any) {
        console.error("Initialization error:", err);
        setError(err.message || 'Authentication error');
      } finally {
        setInitializing(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (initializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest text-center">
          Secure Banking Portal Handshake...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="card-premium max-w-sm text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-primary">Connection Alert</h2>
          <p className="text-sm text-slate-500 mt-2">{error}</p>
          <button onClick={() => window.location.reload()} className="btn-primary mt-6 w-full">Retry Connection</button>
        </div>
      </div>
    );
  }

  if (user && profile && (!profile.profileCompleted || profile.mustChangePassword)) {
    return <UserOnboarding profile={profile} onComplete={() => fetchProfile(user).then(setProfile)} />;
  }

  return (
    <BrowserRouter>
      <PWAInstallPrompt />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route 
          path="/*" 
          element={
            !user ? <Navigate to="/login" /> : 
            profile?.role === 'Super Admin' ? <AdminApp profile={profile} onProfileUpdate={refreshProfile} /> : 
            profile ? <UserApp profile={profile} onProfileUpdate={refreshProfile} /> : 
            <div className="min-h-screen flex items-center justify-center text-slate-400">Loading profile...</div>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}

// --- Admin Application Root ---
function AdminApp({ profile, onProfileUpdate }: { profile: UserProfile; onProfileUpdate: () => void }) {
  const adminItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Districts', path: '/districts', icon: Map },
    { label: 'Branches', path: '/branches', icon: Building2 },
    { label: 'Users', path: '/users', icon: Users },
    { label: 'Hierarchy Drilldown', path: '/drilldown', icon: Layers },
    { label: 'Rankings & Analytics', path: '/analytics', icon: Trophy },
    { label: 'Wall of Fame & Awards', path: '/recognition', icon: Sparkles },
    { label: 'Notifications', path: '/notifications', icon: Bell },
    { label: 'Audit Logs', path: '/audit', icon: ClipboardList },
  ];

  return (
    <AppShell role="Super Admin" items={adminItems} profile={profile} onProfileUpdate={onProfileUpdate}>
      <Routes>
        <Route path="/" element={<AdminDashboard />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/districts" element={<SystemStructure />} />
        <Route path="/branches" element={<SystemStructure />} />
        <Route path="/drilldown" element={<ExecutiveDrilldown profile={profile} />} />
        <Route path="/analytics" element={<AnalyticsLeaderboard profile={profile} />} />
        <Route path="/recognition" element={<PerformanceRecognition profile={profile} />} />
        <Route path="/notifications" element={<NotificationCenter profile={profile} />} />
        <Route path="/audit" element={<AuditLogViewer />} />
      </Routes>
    </AppShell>
  );
}

function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, districts: 0, branches: 0, directors: 0, managers: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [uSnap, dSnap, bSnap] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "districts")),
          getDocs(collection(db, "branches"))
        ]);
        
        const allUsers = uSnap.docs.map(d => d.data());
        setStats({
          users: uSnap.size,
          districts: dSnap.size,
          branches: bSnap.size,
          directors: allUsers.filter((u: any) => u.role === 'District Director').length,
          managers: allUsers.filter((u: any) => u.role === 'Branch Manager').length
        });
      } catch (e) {
        console.warn("Stats fetch error:", e);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      <div>
        <h1 className="text-2xl font-black text-primary tracking-tight">Super Admin Portal</h1>
        <p className="text-slate-500 font-medium text-xs mt-1">System Overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="card-premium p-4 flex flex-col items-center text-center">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl mb-3">
            <Users className="w-6 h-6" />
          </div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Staff</div>
          <div className="text-2xl font-black text-primary mt-1">{stats.users}</div>
        </div>

        <div className="card-premium p-4 flex flex-col items-center text-center">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl mb-3">
            <Map className="w-6 h-6" />
          </div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Districts</div>
          <div className="text-2xl font-black text-primary mt-1">{stats.districts}</div>
        </div>

        <div className="card-premium p-4 flex flex-col items-center text-center border-l-4 border-l-indigo-500">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Directors</div>
          <div className="text-2xl font-black text-primary mt-1">{stats.directors}</div>
        </div>

        <div className="card-premium p-4 flex flex-col items-center text-center">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl mb-3">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Branches</div>
          <div className="text-2xl font-black text-primary mt-1">{stats.branches}</div>
        </div>

        <div className="card-premium p-4 flex flex-col items-center text-center border-l-4 border-l-emerald-500">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl mb-3">
            <UserPlus className="w-6 h-6" />
          </div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Managers</div>
          <div className="text-2xl font-black text-primary mt-1">{stats.managers}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-subtle border border-slate-100">
          <h2 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-accent" />
            System Control Quick Links
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Link to="/drilldown" className="p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all font-bold text-sm text-primary flex flex-col gap-2">
              <Layers className="w-5 h-5 text-accent" />
              Hierarchy Drilldown
            </Link>
            <Link to="/recognition" className="p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all font-bold text-sm text-primary flex flex-col gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Wall of Fame & Awards
            </Link>
            <Link to="/users" className="p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all font-bold text-sm text-primary flex flex-col gap-2">
              <UserPlus className="w-5 h-5 text-accent" />
              Register Personnel
            </Link>
            <Link to="/analytics" className="p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all font-bold text-sm text-primary flex flex-col gap-2">
              <Trophy className="w-5 h-5 text-indigo-500" />
              Rankings & Analytics
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-subtle border border-slate-100">
          <h2 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Master Account Authorization
          </h2>
          <div className="space-y-3 text-sm text-slate-600">
            <p><strong className="text-primary">Super Admin Email:</strong> ambogirma7@gmail.com</p>
            <p><strong className="text-primary">Master UID:</strong> lL950zn7P4fC4SgwbLTPx3ORxvf1</p>
            <div className="p-3 bg-green-50 text-green-700 text-xs font-bold rounded-lg border border-green-200 mt-4">
              ✓ Master System Administrator verified
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Audit Log Viewer Component ---
function AuditLogViewer() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const snap = await getDocs(query(collection(db, "auditLogs"), orderBy("timestamp", "desc"), limit(50)));
        setLogs(snap.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      } catch (e) {
        console.warn("Audit log fetch error:", e);
      }
    };
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-primary tracking-tight">System Audit Trail</h1>
        <p className="text-slate-500 font-medium">Security monitoring and change tracking</p>
      </div>

      <div className="bg-white rounded-xl shadow-subtle border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Timestamp</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Actor</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Action</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Target</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((log, idx) => (
              <tr key={`log-${log.id || 'log'}-${idx}`} className="text-sm">
                <td className="px-6 py-4 text-slate-500 font-medium">
                  {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : 'Just now'}
                </td>
                <td className="px-6 py-4 font-bold text-primary">
                  {log.actorId}
                </td>
                <td className="px-6 py-4">
                  <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                    {log.action}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-400">
                  {log.targetId}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && (
          <div className="p-12 text-center text-slate-400">No audit logs recorded yet.</div>
        )}
      </div>
    </div>
  );
}

// --- User Application Root ---
function UserApp({ profile, onProfileUpdate }: { profile: UserProfile; onProfileUpdate: () => void }) {
  const userItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Customers', path: '/customers', icon: Users },
    { label: 'Plans & Reports', path: '/plans', icon: FileText },
    { label: 'Review Queue', path: '/review', icon: ClipboardList },
    { label: 'Branch Targets', path: '/targets', icon: Building2 },
    { label: 'Rankings & Leaderboard', path: '/analytics', icon: Trophy },
    { label: 'Hierarchy Drilldown', path: '/drilldown', icon: Layers },
    { label: 'Wall of Fame & Awards', path: '/recognition', icon: Sparkles },
    { label: 'Notifications', path: '/notifications', icon: Bell },
    { label: 'Broadcast', path: '/broadcast', icon: Bell },
  ];

  return (
    <AppShell role={profile.role || 'Staff'} items={userItems} profile={profile} onProfileUpdate={onProfileUpdate}>
      <Routes>
        <Route path="/" element={<UserDashboard profile={profile} />} />
        <Route path="/customers" element={<CustomerMapping profile={profile} />} />
        <Route path="/plans" element={<PlansReports profile={profile} />} />
        <Route path="/review" element={<ReviewQueue profile={profile} />} />
        <Route path="/targets" element={<BranchTargets profile={profile} />} />
        <Route path="/analytics" element={<AnalyticsLeaderboard profile={profile} />} />
        <Route path="/drilldown" element={<ExecutiveDrilldown profile={profile} />} />
        <Route path="/recognition" element={<PerformanceRecognition profile={profile} />} />
        <Route path="/notifications" element={<NotificationCenter profile={profile} />} />
        <Route path="/broadcast" element={<Broadcast profile={profile} />} />
      </Routes>
    </AppShell>
  );
}

function UserDashboard({ profile }: { profile: UserProfile }) {
  const [customerCount, setCustomerCount] = useState<number>(0);
  const [pendingReviews, setPendingReviews] = useState<number>(0);
  const [submittedPlans, setSubmittedPlans] = useState<number>(0);
  const [kpiProgress, setKpiProgress] = useState<any[]>([]);
  const [loadingKPIs, setLoadingKPIs] = useState<boolean>(true);
  const [branchName, setBranchName] = useState<string>('');
  const [districtName, setDistrictName] = useState<string>('');

  useEffect(() => {
    const fetchUserStats = async () => {
      setLoadingKPIs(true);
      try {
        // Resolve Branch Name & District Name
        if (profile.branchId) {
          try {
            const bSnap = await getDoc(doc(db, "branches", profile.branchId));
            if (bSnap.exists()) setBranchName(bSnap.data().name || '');
          } catch (e) {
            console.warn("Branch lookup note:", e);
          }
        }
        if (profile.districtId) {
          try {
            const dSnap = await getDoc(doc(db, "districts", profile.districtId));
            if (dSnap.exists()) setDistrictName(dSnap.data().name || '');
          } catch (e) {
            console.warn("District lookup note:", e);
          }
        }
        // Active Mapped Customers Count
        let customerQuery;
        if (profile.role === 'Branch Staff') {
          customerQuery = query(collection(db, "mappedCustomers"), where("staffId", "==", profile.uid));
        } else if (profile.role === 'Branch Manager' && profile.branchId) {
          customerQuery = query(collection(db, "mappedCustomers"), where("branchId", "==", profile.branchId));
        } else {
          customerQuery = collection(db, "mappedCustomers");
        }
        const cSnap = await getDocs(customerQuery);
        const allCust = cSnap.docs.map(d => ({ ...d.data(), id: d.id }));
        setCustomerCount(allCust.filter((c: any) => c.status !== 'closed' && c.status !== 'completed').length);

        // Submitted Plans Count
        let plansQuery;
        if (profile.role === 'Branch Staff') {
          plansQuery = query(collection(db, "plans"), where("staffId", "==", profile.uid));
        } else if (profile.role === 'Branch Manager' && profile.branchId) {
          plansQuery = query(collection(db, "plans"), where("branchId", "==", profile.branchId));
        } else {
          plansQuery = collection(db, "plans");
        }
        const pSnap = await getDocs(plansQuery);
        setSubmittedPlans(pSnap.size);

        // Pending Reviews Count
        if (profile.branchId) {
          const rSnap = await getDocs(query(
            collection(db, "reports"), 
            where("branchId", "==", profile.branchId), 
            where("status", "==", "submitted")
          ));
          setPendingReviews(rSnap.size);
        }

        // --- DYNAMIC KPI AGGREGATION ---
        let targetsMap: { [key: string]: number } = {};
        let achievementsMap: { [key: string]: number } = {};

        if (profile.role === 'Branch Staff') {
          // Staff Level KPI rollup
          const targetsQuery = query(collection(db, "targets"), where("ownerId", "==", profile.uid));
          const reportsQuery = query(collection(db, "reports"), where("staffId", "==", profile.uid), where("status", "==", "approved"));
          
          const [targetsSnap, reportsSnap] = await Promise.all([
            getDocs(targetsQuery),
            getDocs(reportsQuery)
          ]);

          targetsSnap.forEach(doc => {
            const data = doc.data();
            targetsMap[data.kpiId] = (targetsMap[data.kpiId] || 0) + (data.targetValue || data.value || 0);
          });

          reportsSnap.forEach(doc => {
            const data = doc.data();
            achievementsMap[data.kpiId] = (achievementsMap[data.kpiId] || 0) + (data.actualValue || data.value || 0);
          });
        } else if (profile.role === 'Branch Manager' && profile.branchId) {
          // Branch Level KPI rollup
          const targetsQuery = query(collection(db, "targets"), where("ownerId", "==", profile.branchId));
          const reportsQuery = query(collection(db, "reports"), where("branchId", "==", profile.branchId), where("status", "==", "approved"));
          
          const [targetsSnap, reportsSnap] = await Promise.all([
            getDocs(targetsQuery),
            getDocs(reportsQuery)
          ]);

          targetsSnap.forEach(doc => {
            const data = doc.data();
            targetsMap[data.kpiId] = (targetsMap[data.kpiId] || 0) + (data.targetValue || data.value || 0);
          });

          reportsSnap.forEach(doc => {
            const data = doc.data();
            achievementsMap[data.kpiId] = (achievementsMap[data.kpiId] || 0) + (data.actualValue || data.value || 0);
          });
        } else if (profile.role === 'District Director' && profile.districtId) {
          // District Level KPI rollup
          // 1. Fetch branches belonging to the district
          const branchesQuery = query(collection(db, "branches"), where("districtId", "==", profile.districtId));
          const branchesSnap = await getDocs(branchesQuery);
          const branchIds = branchesSnap.docs.map(doc => doc.id);

          if (branchIds.length > 0) {
            // 2. Fetch all targets and reports
            const targetsSnap = await getDocs(collection(db, "targets"));
            const reportsSnap = await getDocs(query(collection(db, "reports"), where("status", "==", "approved")));

            // 3. Aggregate in memory
            targetsSnap.forEach(doc => {
              const data = doc.data();
              if (branchIds.includes(data.ownerId)) {
                targetsMap[data.kpiId] = (targetsMap[data.kpiId] || 0) + (data.targetValue || data.value || 0);
              }
            });

            reportsSnap.forEach(doc => {
              const data = doc.data();
              if (branchIds.includes(data.branchId)) {
                achievementsMap[data.kpiId] = (achievementsMap[data.kpiId] || 0) + (data.actualValue || data.value || 0);
              }
            });
          }
        }

        const kpis = [
          "Deposit Mobilization", 
          "Customer Creation", 
          "Coopayebirr", 
          "Merchant & QR", 
          "Michu Onboarding", 
          "Michu Collection", 
          "ATM Creation", 
          "ATM Activation", 
          "Cash Collection"
        ];

        const progressItems = kpis.map(kpi => {
          const target = targetsMap[kpi] || 0;
          const actual = achievementsMap[kpi] || 0;
          return { kpi, target, actual };
        }).filter(item => item.target > 0); // Only keep KPIs that have targets set

        setKpiProgress(progressItems);
      } catch (e) {
        console.warn("User stats fetch error:", e);
      } finally {
        setLoadingKPIs(false);
      }
    };
    fetchUserStats();
  }, [profile.uid, profile.branchId, profile.role, profile.districtId]);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-primary tracking-tight">Welcome, {profile.fullName}</h1>
          <p className="text-slate-500 font-medium text-sm mt-1 flex flex-wrap items-center gap-2">
            <span>Role: <strong className="text-indigo-600 font-bold">{profile.role}</strong></span>
            {branchName && <span>• Branch: <strong className="text-slate-800 font-bold">{branchName}</strong></span>}
            {districtName && <span>• District: <strong className="text-slate-800 font-bold">{districtName}</strong></span>}
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card-premium flex items-center gap-5 bg-gradient-to-br from-indigo-50/50 to-white">
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mapped Customers</div>
            <div className="text-3xl font-black text-primary mt-1">{customerCount}</div>
          </div>
        </div>

        <div className="card-premium flex items-center gap-5 bg-gradient-to-br from-amber-50/50 to-white">
          <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl">
            <FileText className="w-8 h-8" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Submitted Plans</div>
            <div className="text-3xl font-black text-primary mt-1">{submittedPlans}</div>
          </div>
        </div>

        <div className="card-premium flex items-center gap-5 bg-gradient-to-br from-emerald-50/50 to-white">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
            <ClipboardList className="w-8 h-8" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Approvals</div>
            <div className="text-3xl font-black text-primary mt-1">{pendingReviews}</div>
          </div>
        </div>
      </div>

      {/* Target Progress Section */}
      <div className="bg-white rounded-2xl p-6 shadow-subtle border border-slate-100">
        <h2 className="text-xl font-extrabold text-primary mb-6 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-accent" />
          Role Performance & KPI Rollups
        </h2>

        {loadingKPIs ? (
          <div className="text-center py-12 text-slate-400 text-sm font-bold uppercase tracking-widest animate-pulse">
            Calculating performance matrices...
          </div>
        ) : kpiProgress.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {kpiProgress.map((item, idx) => (
              <div key={`kpi-${item.kpi}-${idx}`} className="card-premium p-5 border border-slate-100 bg-slate-50/20 hover:bg-white transition-all">
                <KPIProgressBar value={item.actual} target={item.target} label={item.kpi} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
            <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="font-bold text-slate-500 uppercase tracking-widest">No Active Performance Quotas</h3>
            <p className="text-slate-400 text-xs mt-2 max-w-sm mx-auto">
              There are no allocated performance targets for this period yet. Ask your branch supervisor or district administrator to allocate targets.
            </p>
          </div>
        )}
      </div>

      {/* Extra Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-subtle border border-slate-100">
          <h2 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-accent" />
            Branch Status & Guidelines
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            All submitted performance reports require supporting deposit customer mappings for verification. Ensure plans are updated daily before 9:00 AM to facilitate administrative sync.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/plans" className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 uppercase tracking-wider hover:bg-indigo-100 transition-colors">
              Submit Report
            </Link>
            <Link to="/customers" className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 uppercase tracking-wider hover:bg-emerald-100 transition-colors">
              Map Customer
            </Link>
            <Link to="/recognition" className="text-xs font-black text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 uppercase tracking-wider hover:bg-amber-100 transition-colors flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Wall of Fame
            </Link>
            <Link to="/drilldown" className="text-xs font-black text-purple-700 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-200 uppercase tracking-wider hover:bg-purple-100 transition-colors flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-purple-500" />
              Hierarchy Matrix
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-subtle border border-slate-100 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-primary mb-2 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              Security Lock & Compliance
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Your banking terminal session is secured with a rolling 15-minute inactivity lockdown. Every action is signed and tracked.
            </p>
          </div>
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-4">
            Secured via Firebase Cryptographic Handshake
          </div>
        </div>
      </div>
    </div>
  );
}
