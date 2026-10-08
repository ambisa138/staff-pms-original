import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, cleanForFirestore } from '../../packages/shared/firebase';
import { UserProfile } from '../../packages/shared/services';
import { PerformanceLogic, KPIData } from '../../packages/shared/calculations';
import { 
  Building2, 
  Map, 
  Users, 
  ChevronRight, 
  Target, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Send, 
  Zap, 
  BarChart3, 
  ArrowLeft,
  Search,
  MessageSquare,
  Shield,
  Layers
} from 'lucide-react';
import { KPIProgressBar, StatusChip, cn } from '../../packages/shared/components/UI';

export const ExecutiveDrilldown = ({ profile }: { profile: UserProfile }) => {
  const [period, setPeriod] = useState('October 2026');
  const [loading, setLoading] = useState(true);

  // Hierarchy Data
  const [districts, setDistricts] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [targets, setTargets] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);

  // Navigation Drilldown State
  const [selectedDistrict, setSelectedDistrict] = useState<any | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<any | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Nudge Modal State
  const [nudgeTargetUser, setNudgeTargetUser] = useState<any | null>(null);
  const [nudgeMessage, setNudgeMessage] = useState('');
  const [sendingNudge, setSendingNudge] = useState(false);
  const [nudgeSentSuccess, setNudgeSentSuccess] = useState<string | null>(null);

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

  // Calculate day-of-month pacing benchmark (e.g. Day 20 out of 31 is 64.5%)
  const now = new Date();
  const currentDay = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const pacingPercentage = Math.round((currentDay / daysInMonth) * 100);

  useEffect(() => {
    fetchHierarchyData();
  }, [period]);

  const fetchHierarchyData = async () => {
    setLoading(true);
    try {
      const [dSnap, bSnap, uSnap, tSnap, rSnap] = await Promise.all([
        getDocs(collection(db, "districts")),
        getDocs(collection(db, "branches")),
        getDocs(collection(db, "users")),
        getDocs(query(collection(db, "targets"), where("period", "==", period))),
        getDocs(query(collection(db, "reports"), where("status", "==", "approved"), where("period", "==", period)))
      ]);

      const dedupe = <T extends { id?: string }>(list: T[]): T[] => {
        const seen = new Set<string>();
        return list.filter(item => {
          if (!item.id || seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
      };

      setDistricts(dedupe(dSnap.docs.map(d => ({ ...(d.data() as any), id: d.id }))));
      setBranches(dedupe(bSnap.docs.map(d => ({ ...(d.data() as any), id: d.id }))));
      setUsers(dedupe(uSnap.docs.map(d => ({ ...(d.data() as any), id: d.id }))));
      setTargets(dedupe(tSnap.docs.map(d => ({ ...(d.data() as any), id: d.id }))));
      setReports(dedupe(rSnap.docs.map(d => ({ ...(d.data() as any), id: d.id }))));
    } catch (err) {
      console.warn("fetchHierarchyData error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to calculate score for a branch
  const calculateBranchStats = (branchId: string) => {
    const branchTargets = targets.filter(t => t.ownerId === branchId);
    const branchReports = reports.filter(r => r.branchId === branchId);

    const kpiDataList: KPIData[] = [];
    const kpiBreakdown: { [key: string]: { target: number; actual: number; percentage: number } } = {};

    kpis.forEach(kpi => {
      const targetItem = branchTargets.find(t => t.kpiId === kpi);
      const targetVal = targetItem ? (targetItem.targetValue || targetItem.value || 0) : 0;
      const actualVal = branchReports.filter(r => r.kpiId === kpi).reduce((s, r) => s + (r.actualValue || r.value || 0), 0);
      const progress = PerformanceLogic.calculateKPIProgress(actualVal, targetVal);

      kpiBreakdown[kpi] = { target: targetVal, actual: actualVal, percentage: Math.round(progress) };
      kpiDataList.push({ kpiId: kpi, target: targetVal, actual: actualVal });
    });

    const overallScore = Math.round(PerformanceLogic.calculateStaffOverall(kpiDataList));
    return { overallScore, kpiBreakdown };
  };

  // Helper to calculate score for a staff member
  const calculateStaffStats = (staffId: string, staffUid: string) => {
    const staffTargets = targets.filter(t => t.ownerId === staffId);
    const staffReports = reports.filter(r => r.staffId === staffUid || r.staffId === staffId);

    const kpiDataList: KPIData[] = [];
    const kpiBreakdown: { [key: string]: { target: number; actual: number; percentage: number } } = {};

    kpis.forEach(kpi => {
      const targetItem = staffTargets.find(t => t.kpiId === kpi);
      const targetVal = targetItem ? (targetItem.targetValue || targetItem.value || 0) : 0;
      const actualVal = staffReports.filter(r => r.kpiId === kpi).reduce((s, r) => s + (r.actualValue || r.value || 0), 0);
      const progress = PerformanceLogic.calculateKPIProgress(actualVal, targetVal);

      kpiBreakdown[kpi] = { target: targetVal, actual: actualVal, percentage: Math.round(progress) };
      kpiDataList.push({ kpiId: kpi, target: targetVal, actual: actualVal });
    });

    const overallScore = Math.round(PerformanceLogic.calculateStaffOverall(kpiDataList));
    return { overallScore, kpiBreakdown, totalReports: staffReports.length };
  };

  const handleSendNudge = async () => {
    if (!nudgeTargetUser || !nudgeMessage.trim()) return;
    setSendingNudge(true);
    try {
      await addDoc(collection(db, "notifications"), cleanForFirestore({
        senderId: profile.uid,
        senderName: profile.fullName,
        audience: 'Staff',
        targetUserId: nudgeTargetUser.uid || nudgeTargetUser.id,
        title: `Performance Guidance from ${profile.fullName}`,
        body: nudgeMessage.trim(),
        createdAt: serverTimestamp()
      }));

      setNudgeSentSuccess(`Coaching message sent to ${nudgeTargetUser.fullName}!`);
      setTimeout(() => {
        setNudgeSentSuccess(null);
        setNudgeTargetUser(null);
        setNudgeMessage('');
      }, 2000);
    } catch (err) {
      console.error("Nudge send error:", err);
    } finally {
      setSendingNudge(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-primary tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-accent" />
            Executive Hierarchy Drilldown
          </h1>
          <p className="text-slate-500 font-medium text-xs mt-0.5">
            District, Branch & Staff Matrix
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select 
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-white border border-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl text-primary outline-none focus:ring-2 focus:ring-accent/50 shadow-subtle"
          >
            <option value="October 2026">October 2026</option>
            <option value="November 2026">November 2026</option>
            <option value="December 2026">December 2026</option>
            <option value="Q4 2026">Q4 2026</option>
          </select>
        </div>
      </div>

      {/* Pacing Benchmark Banner */}
      <div className="card-premium p-5 bg-gradient-to-r from-indigo-900 to-primary text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
            <TrendingUp className="w-4 h-4" />
            Monthly Pacing Benchmark
          </div>
          <h3 className="text-lg font-black text-white">
            Day {currentDay} of {daysInMonth} ({pacingPercentage}% Period Elapsed)
          </h3>
          <p className="text-xs text-indigo-200">
            KPI achievements below {pacingPercentage}% are flagged as <strong className="text-amber-300">Pacing Lags</strong> requiring attention.
          </p>
        </div>
        <div className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl border border-white/10">
          <div className="text-center">
            <div className="text-2xl font-black text-accent">{pacingPercentage}%</div>
            <div className="text-[10px] text-white/70 font-bold uppercase">Expected Target</div>
          </div>
        </div>
      </div>

      {/* Breadcrumb Navigation Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-subtle border border-slate-100 flex items-center gap-2 text-sm font-bold text-slate-500 overflow-x-auto">
        <button 
          onClick={() => { setSelectedDistrict(null); setSelectedBranch(null); setSelectedStaff(null); }}
          className={cn("hover:text-primary transition", !selectedDistrict && "text-accent font-black")}
        >
          All Districts ({districts.length})
        </button>

        {selectedDistrict && (
          <>
            <ChevronRight className="w-4 h-4 text-slate-300" />
            <button 
              onClick={() => { setSelectedBranch(null); setSelectedStaff(null); }}
              className={cn("hover:text-primary transition", !selectedBranch && "text-accent font-black")}
            >
              {selectedDistrict.name}
            </button>
          </>
        )}

        {selectedBranch && (
          <>
            <ChevronRight className="w-4 h-4 text-slate-300" />
            <span className="text-accent font-black">{selectedBranch.name}</span>
          </>
        )}
      </div>

      {/* --- LEVEL 1: DISTRICTS LISTING --- */}
      {!selectedDistrict && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {districts.map((d, idx) => {
              const districtBranches = branches.filter(b => b.districtId === d.id);
              const branchScores = districtBranches.map(b => calculateBranchStats(b.id).overallScore);
              const avgScore = branchScores.length > 0 ? Math.round(branchScores.reduce((a, b) => a + b, 0) / branchScores.length) : 0;
              const director = users.find(u => u.uid === d.managerId || u.id === d.managerId || (u.districtId === d.id && u.role === 'District Director'));

              return (
                <div 
                  key={`drill-dist-${d.id}-${idx}`}
                  onClick={() => setSelectedDistrict(d)}
                  className="card-premium hover:shadow-premium cursor-pointer transition-all border border-slate-200 hover:border-accent p-6 flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                        <Map className="w-6 h-6" />
                      </div>
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-black",
                        avgScore >= pacingPercentage ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      )}>
                        {avgScore}% Avg
                      </span>
                    </div>

                    <h3 className="font-extrabold text-primary text-xl mb-1 group-hover:text-accent transition-colors">
                      {d.name}
                    </h3>
                    <p className="text-xs text-slate-400 font-bold mb-4">
                      Director: <span className="text-slate-700">{director?.fullName || d.managerName || 'Unassigned'}</span>
                    </p>

                    <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-100">
                      <div className="flex justify-between text-xs font-bold text-slate-500">
                        <span>Branches Count</span>
                        <span className="text-primary">{districtBranches.length} Branches</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-slate-500">
                        <span>Performance Pacing</span>
                        <span className={avgScore >= pacingPercentage ? "text-emerald-600" : "text-amber-600"}>
                          {avgScore >= pacingPercentage ? "Ahead of Schedule" : "Lagging Behind"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-accent group-hover:translate-x-1 transition-transform">
                    <span>Drill down into branches &rarr;</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- LEVEL 2: BRANCHES IN SELECTED DISTRICT --- */}
      {selectedDistrict && !selectedBranch && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-primary">{selectedDistrict.name} Branches</h2>
              <p className="text-xs text-slate-500 font-medium">Select a branch to drill down into individual staff allocations</p>
            </div>
            <button 
              onClick={() => setSelectedDistrict(null)}
              className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Districts
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {branches.filter(b => b.districtId === selectedDistrict.id).map((b, idx) => {
              const { overallScore, kpiBreakdown } = calculateBranchStats(b.id);
              const branchStaff = users.filter(u => u.branchId === b.id && u.role === 'Branch Staff');
              const manager = users.find(u => u.uid === b.managerId || u.id === b.managerId || (u.branchId === b.id && u.role === 'Branch Manager'));

              return (
                <div 
                  key={`drill-br-${b.id}-${idx}`}
                  onClick={() => setSelectedBranch(b)}
                  className="card-premium hover:shadow-premium cursor-pointer transition-all border border-slate-200 hover:border-accent p-6 flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-black",
                        overallScore >= pacingPercentage ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      )}>
                        {overallScore}% Score
                      </span>
                    </div>

                    <h3 className="font-extrabold text-primary text-xl mb-1 group-hover:text-accent transition-colors">
                      {b.name}
                    </h3>
                    <p className="text-xs text-slate-400 font-bold mb-4">
                      Manager: <span className="text-slate-700">{manager?.fullName || b.managerName || 'Unassigned'}</span>
                    </p>

                    <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-100">
                      <div className="flex justify-between text-xs font-bold text-slate-500">
                        <span>Staff Officers</span>
                        <span className="text-primary">{branchStaff.length} Members</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-slate-500">
                        <span>Deposit Achievement</span>
                        <span className="text-indigo-600">
                          {kpiBreakdown['Deposit Mobilization']?.percentage || 0}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-accent group-hover:translate-x-1 transition-transform">
                    <span>Inspect branch staff members &rarr;</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- LEVEL 3: STAFF IN SELECTED BRANCH --- */}
      {selectedDistrict && selectedBranch && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-primary">{selectedBranch.name} Personnel Matrix</h2>
              <p className="text-xs text-slate-500 font-medium">District: {selectedDistrict.name} &bull; Comparative Staff Rollup</p>
            </div>
            <button 
              onClick={() => setSelectedBranch(null)}
              className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 self-start"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Branches
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-subtle border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Officer</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Overall Progress</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Deposit Target</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Pacing Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Coaching & Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users
                    .filter(u => u.branchId === selectedBranch.id && u.role === 'Branch Staff')
                    .map((staff, idx) => {
                      const { overallScore, kpiBreakdown, totalReports } = calculateStaffStats(staff.id, staff.uid);
                      const isLagging = overallScore < pacingPercentage;

                      return (
                        <tr key={`staff-drill-${staff.id || staff.uid}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-primary text-sm">{staff.fullName}</div>
                            <div className="text-xs text-slate-400">@{staff.username || 'user'} • {staff.email}</div>
                          </td>
                          <td className="px-6 py-4 min-w-[180px]">
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs font-bold">
                                <span className="text-primary">{overallScore}%</span>
                                <span className="text-slate-400 text-[10px]">{totalReports} Reports</span>
                              </div>
                              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-full transition-all",
                                    overallScore >= 100 ? "bg-emerald-500" :
                                    overallScore >= pacingPercentage ? "bg-accent" : "bg-amber-500"
                                  )}
                                  style={{ width: `${Math.min(overallScore, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-800 text-sm">
                              {kpiBreakdown['Deposit Mobilization']?.actual || 0} / {kpiBreakdown['Deposit Mobilization']?.target || 0}
                            </div>
                            <div className="text-[10px] text-indigo-600 font-bold">
                              {kpiBreakdown['Deposit Mobilization']?.percentage || 0}% Achieved
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {overallScore >= 100 ? (
                              <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-bold border border-emerald-200">
                                Century Achiever
                              </span>
                            ) : !isLagging ? (
                              <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full text-xs font-bold border border-indigo-200">
                                On Pacing Track
                              </span>
                            ) : (
                              <span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full text-xs font-bold border border-amber-200 flex items-center gap-1 w-fit">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                Behind Pacing ({pacingPercentage - overallScore}%)
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <button 
                              onClick={() => {
                                setNudgeTargetUser(staff);
                                setNudgeMessage(`Hi ${staff.fullName}, please review your progress for ${period}. Let us focus on closing active customer mobilization plans to hit our branch targets.`);
                              }}
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                            >
                              <Send className="w-3.5 h-3.5" />
                              Send Coaching Nudge
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- Coaching Nudge Modal --- */}
      {nudgeTargetUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-primary/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-extrabold text-primary mb-1">Supervisor Coaching Nudge</h2>
            <p className="text-xs text-slate-500 mb-4">
              Send an instant personalized motivation & guidance notification to <strong className="text-primary">{nudgeTargetUser.fullName}</strong>
            </p>

            {nudgeSentSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold flex items-center gap-2 mb-4 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {nudgeSentSuccess}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Coaching Message</label>
                <textarea 
                  value={nudgeMessage}
                  onChange={(e) => setNudgeMessage(e.target.value)}
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none focus:ring-2 focus:ring-accent/50 min-h-[120px]"
                  placeholder="Type guidance message..."
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setNudgeTargetUser(null)}
                  className="flex-1 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={handleSendNudge}
                  disabled={sendingNudge || !nudgeMessage.trim()}
                  className="flex-1 btn-primary py-2 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {sendingNudge ? 'Sending...' : 'Send Guidance'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
