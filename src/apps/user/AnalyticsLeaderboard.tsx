import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../packages/shared/firebase';
import { UserProfile } from '../../packages/shared/services';
import { PerformanceLogic, KPIData } from '../../packages/shared/calculations';
import { Trophy, Medal, Award, TrendingUp, Download, Filter, Building2, Users, Target, CheckCircle2, AlertTriangle, BarChart3 } from 'lucide-react';
import { KPIProgressBar, StatusChip, cn } from '../../packages/shared/components/UI';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export const AnalyticsLeaderboard = ({ profile }: { profile: UserProfile }) => {
  const [period, setPeriod] = useState('October 2026');
  const [selectedKPI, setSelectedKPI] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [branchesData, setBranchesData] = useState<any[]>([]);
  const [viewType, setViewType] = useState<'staff' | 'branches'>('staff');

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

  useEffect(() => {
    fetchPerformanceData();
  }, [profile.branchId, profile.districtId, profile.role, period]);

  const fetchPerformanceData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Users, Branches, Targets, and Approved Reports
      const [usersSnap, branchesSnap, targetsSnap, reportsSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "branches")),
        getDocs(query(collection(db, "targets"), where("period", "==", period))),
        getDocs(query(collection(db, "reports"), where("status", "==", "approved"), where("period", "==", period)))
      ]);

      const allUsers = usersSnap.docs.map(d => ({ ...(d.data() as any), id: d.id })) as any[];
      const allBranches = branchesSnap.docs.map(d => ({ ...(d.data() as any), id: d.id })) as any[];
      const allTargets = targetsSnap.docs.map(d => ({ ...(d.data() as any), id: d.id })) as any[];
      const allReports = reportsSnap.docs.map(d => ({ ...(d.data() as any), id: d.id })) as any[];

      // Filter staff relevant to current scope
      let relevantStaff = allUsers.filter(u => u.role === 'Branch Staff');
      if (profile.role === 'Branch Manager' && profile.branchId) {
        relevantStaff = relevantStaff.filter(u => u.branchId === profile.branchId);
      } else if (profile.role === 'District Director' && profile.districtId) {
        relevantStaff = relevantStaff.filter(u => u.districtId === profile.districtId);
      }

      // Calculate Staff Performance
      const computedStaff = relevantStaff.map(staff => {
        const staffTargets = allTargets.filter(t => t.ownerId === staff.id);
        const staffReports = allReports.filter(r => r.staffId === staff.uid || r.staffId === staff.id);

        const kpiBreakdown: { [key: string]: { target: number, actual: number, percentage: number } } = {};
        const kpiDataList: KPIData[] = [];

        kpis.forEach(kpi => {
          const targetItem = staffTargets.find(t => t.kpiId === kpi);
          const targetVal = targetItem ? (targetItem.targetValue || targetItem.value || 0) : 0;
          
          const actualVal = staffReports
            .filter(r => r.kpiId === kpi)
            .reduce((sum, r) => sum + (r.actualValue || r.value || 0), 0);

          const progress = PerformanceLogic.calculateKPIProgress(actualVal, targetVal);
          kpiBreakdown[kpi] = {
            target: targetVal,
            actual: actualVal,
            percentage: Math.round(progress)
          };
          kpiDataList.push({ kpiId: kpi, target: targetVal, actual: actualVal });
        });

        const overallScore = Math.round(PerformanceLogic.calculateStaffOverall(kpiDataList));
        const branchName = allBranches.find(b => b.id === staff.branchId)?.name || (staff.branchId ? 'Main Branch' : 'Unassigned');

        return {
          id: staff.id,
          uid: staff.uid,
          name: staff.fullName || staff.username || 'Staff Member',
          username: staff.username,
          branchName,
          overallScore,
          kpiBreakdown,
          rank: 0
        };
      });

      // Sort staff by overall score descending
      computedStaff.sort((a, b) => b.overallScore - a.overallScore);
      computedStaff.forEach((s, idx) => { s.rank = idx + 1; });
      setLeaderboardData(computedStaff);

      // Calculate Branch Performance
      let relevantBranches = allBranches;
      if (profile.districtId && profile.role === 'District Director') {
        relevantBranches = relevantBranches.filter(b => b.districtId === profile.districtId);
      }

      const computedBranches = relevantBranches.map(branch => {
        const branchTargets = allTargets.filter(t => t.ownerId === branch.id);
        const branchReports = allReports.filter(r => r.branchId === branch.id);

        const kpiBreakdown: { [key: string]: { target: number, actual: number, percentage: number } } = {};
        const kpiDataList: KPIData[] = [];

        kpis.forEach(kpi => {
          const targetItem = branchTargets.find(t => t.kpiId === kpi);
          const targetVal = targetItem ? (targetItem.targetValue || targetItem.value || 0) : 0;

          const actualVal = branchReports
            .filter(r => r.kpiId === kpi)
            .reduce((sum, r) => sum + (r.actualValue || r.value || 0), 0);

          const progress = PerformanceLogic.calculateKPIProgress(actualVal, targetVal);
          kpiBreakdown[kpi] = {
            target: targetVal,
            actual: actualVal,
            percentage: Math.round(progress)
          };
          kpiDataList.push({ kpiId: kpi, target: targetVal, actual: actualVal });
        });

        const overallScore = Math.round(PerformanceLogic.calculateStaffOverall(kpiDataList));

        return {
          id: branch.id,
          name: branch.name,
          overallScore,
          kpiBreakdown,
          rank: 0
        };
      });

      computedBranches.sort((a, b) => b.overallScore - a.overallScore);
      computedBranches.forEach((b, idx) => { b.rank = idx + 1; });
      setBranchesData(computedBranches);

    } catch (err) {
      console.error("fetchPerformanceData error:", err);
    } finally {
      setLoading(false);
    }
  };

  const chartData = (viewType === 'staff' ? leaderboardData : branchesData).slice(0, 10).map(item => ({
    name: item.name,
    score: item.overallScore,
    id: item.id
  }));

  const handleExportCSV = () => {
    const data = viewType === 'staff' ? leaderboardData : branchesData;
    if (data.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    if (viewType === 'staff') {
      csvContent += "Rank,Full Name,Branch,Overall Score (%)," + kpis.join(",") + "\n";
      data.forEach(item => {
        const kpiScores = kpis.map(k => `${item.kpiBreakdown[k]?.actual || 0}/${item.kpiBreakdown[k]?.target || 0} (${item.kpiBreakdown[k]?.percentage || 0}%)`);
        csvContent += `${item.rank},"${item.name}","${item.branchName}",${item.overallScore}%,${kpiScores.join(",")}\n`;
      });
    } else {
      csvContent += "Rank,Branch Name,Overall Score (%)," + kpis.join(",") + "\n";
      data.forEach(item => {
        const kpiScores = kpis.map(k => `${item.kpiBreakdown[k]?.actual || 0}/${item.kpiBreakdown[k]?.target || 0} (${item.kpiBreakdown[k]?.percentage || 0}%)`);
        csvContent += `${item.rank},"${item.name}",${item.overallScore}%,${kpiScores.join(",")}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Performance_Report_${viewType}_${period.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-primary tracking-tight flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-500" />
            Performance Rankings
          </h1>
          <p className="text-slate-500 font-medium text-xs mt-0.5">
            Leaderboards & KPI Progress Matrix
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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

          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold px-4 py-2.5 rounded-xl shadow-subtle transition-all"
          >
            <Download className="w-4 h-4 text-accent" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-xl shadow-subtle">
        <button 
          onClick={() => setViewType('staff')}
          className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-all ${viewType === 'staff' ? 'border-accent text-accent' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          <Users className="w-4 h-4" />
          Staff Leaderboard ({leaderboardData.length})
        </button>
        <button 
          onClick={() => setViewType('branches')}
          className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-all ${viewType === 'branches' ? 'border-accent text-accent' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          <Building2 className="w-4 h-4" />
          Branch Rankings ({branchesData.length})
        </button>
      </div>

      {/* Analytics Chart */}
      {!loading && chartData.length > 0 && (
        <div className="card-premium p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-extrabold text-primary flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-accent" />
              Top 10 Comparative Progress (%)
            </h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={60}
                />
                <YAxis hide domain={[0, 120]} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                />
                <Bar dataKey="score" radius={[6, 6, 0, 0]} barSize={40}>
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`chart-cell-${entry.id}-${index}`} 
                      fill={index === 0 ? '#f59e0b' : index === 1 ? '#94a3b8' : index === 2 ? '#b45309' : '#4f46e5'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filter by KPI */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap mr-1">
          <Filter className="w-3.5 h-3.5 inline mr-1" />
          Filter Matrix:
        </span>
        <button 
          onClick={() => setSelectedKPI('All')}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
            selectedKPI === 'All' ? "bg-accent text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          )}
        >
          Overall Score
        </button>
        {kpis.map(kpi => (
          <button 
            key={kpi}
            onClick={() => setSelectedKPI(kpi)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
              selectedKPI === kpi ? "bg-accent text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            )}
          >
            {kpi}
          </button>
        ))}
      </div>

      {/* Top 3 Podium Cards */}
      {!loading && (viewType === 'staff' ? leaderboardData : branchesData).length >= 3 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* 2nd Place */}
          {(viewType === 'staff' ? leaderboardData : branchesData)[1] && (
            <div key={`podium-2-${(viewType === 'staff' ? leaderboardData : branchesData)[1].id}`} className="card-premium bg-gradient-to-br from-slate-50 to-white border border-slate-200 flex flex-col justify-between p-6 order-2 md:order-1">
              <div className="flex justify-between items-start">
                <span className="text-xs font-black text-slate-400 bg-slate-100 px-3 py-1 rounded-full">#2 Silver</span>
                <Medal className="w-8 h-8 text-slate-400" />
              </div>
              <div className="mt-4">
                <h3 className="font-extrabold text-primary text-lg">{(viewType === 'staff' ? leaderboardData : branchesData)[1].name}</h3>
                {viewType === 'staff' && (
                  <p className="text-xs text-slate-400 font-medium">{(viewType === 'staff' ? leaderboardData : branchesData)[1].branchName}</p>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-end">
                <span className="text-xs font-bold text-slate-400 uppercase">Score</span>
                <span className="text-2xl font-black text-slate-700">{(viewType === 'staff' ? leaderboardData : branchesData)[1].overallScore}%</span>
              </div>
            </div>
          )}

          {/* 1st Place */}
          {(viewType === 'staff' ? leaderboardData : branchesData)[0] && (
            <div key={`podium-1-${(viewType === 'staff' ? leaderboardData : branchesData)[0].id}`} className="card-premium bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-2 border-amber-300 shadow-xl flex flex-col justify-between p-6 order-1 md:order-2 scale-105">
              <div className="flex justify-between items-start">
                <span className="text-xs font-black text-amber-700 bg-amber-100 px-3 py-1 rounded-full">👑 #1 Top Performer</span>
                <Trophy className="w-10 h-10 text-amber-500 animate-bounce" />
              </div>
              <div className="mt-4">
                <h3 className="font-extrabold text-primary text-xl">{(viewType === 'staff' ? leaderboardData : branchesData)[0].name}</h3>
                {viewType === 'staff' && (
                  <p className="text-xs text-amber-700 font-bold">{(viewType === 'staff' ? leaderboardData : branchesData)[0].branchName}</p>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-amber-200 flex justify-between items-end">
                <span className="text-xs font-bold text-amber-800 uppercase">Master Score</span>
                <span className="text-3xl font-black text-amber-600">{(viewType === 'staff' ? leaderboardData : branchesData)[0].overallScore}%</span>
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {(viewType === 'staff' ? leaderboardData : branchesData)[2] && (
            <div key={`podium-3-${(viewType === 'staff' ? leaderboardData : branchesData)[2].id}`} className="card-premium bg-gradient-to-br from-amber-900/5 to-white border border-amber-200 flex flex-col justify-between p-6 order-3">
              <div className="flex justify-between items-start">
                <span className="text-xs font-black text-amber-900 bg-amber-50 px-3 py-1 rounded-full">#3 Bronze</span>
                <Award className="w-8 h-8 text-amber-700" />
              </div>
              <div className="mt-4">
                <h3 className="font-extrabold text-primary text-lg">{(viewType === 'staff' ? leaderboardData : branchesData)[2].name}</h3>
                {viewType === 'staff' && (
                  <p className="text-xs text-slate-400 font-medium">{(viewType === 'staff' ? leaderboardData : branchesData)[2].branchName}</p>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-end">
                <span className="text-xs font-bold text-slate-400 uppercase">Score</span>
                <span className="text-2xl font-black text-amber-800">{(viewType === 'staff' ? leaderboardData : branchesData)[2].overallScore}%</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Leaderboard Table */}
      <div className="bg-white rounded-2xl shadow-subtle border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Rank</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">{viewType === 'staff' ? 'Personnel' : 'Branch'}</th>
                {viewType === 'staff' && (
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Branch</th>
                )}
                {selectedKPI === 'All' ? (
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Overall Achievement</th>
                ) : (
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">{selectedKPI} Progress</th>
                )}
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(viewType === 'staff' ? leaderboardData : branchesData).map((item, idx) => {
                const targetScore = selectedKPI === 'All' 
                  ? item.overallScore 
                  : (item.kpiBreakdown[selectedKPI]?.percentage || 0);

                const actualVal = selectedKPI !== 'All' ? (item.kpiBreakdown[selectedKPI]?.actual || 0) : null;
                const targetVal = selectedKPI !== 'All' ? (item.kpiBreakdown[selectedKPI]?.target || 0) : null;

                return (
                  <tr key={`rank-row-${item.id || 'row'}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-black",
                          item.rank === 1 ? "bg-amber-100 text-amber-700" :
                          item.rank === 2 ? "bg-slate-200 text-slate-700" :
                          item.rank === 3 ? "bg-amber-50 text-amber-900 border border-amber-200" :
                          "bg-slate-50 text-slate-400"
                        )}>
                          {item.rank}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-primary text-sm">{item.name}</div>
                      {item.username && (
                        <div className="text-xs text-slate-400">@{item.username}</div>
                      )}
                    </td>
                    {viewType === 'staff' && (
                      <td className="px-6 py-4 text-xs font-bold text-slate-600">
                        {item.branchName}
                      </td>
                    )}
                    <td className="px-6 py-4 min-w-[200px]">
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-primary">{targetScore}%</span>
                          {actualVal !== null && (
                            <span className="text-slate-400 text-[10px]">{actualVal} / {targetVal}</span>
                          )}
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full transition-all duration-500",
                              targetScore >= 100 ? "bg-emerald-500" :
                              targetScore >= 75 ? "bg-accent" :
                              targetScore >= 50 ? "bg-amber-400" :
                              "bg-red-400"
                            )}
                            style={{ width: `${Math.min(targetScore, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {targetScore >= 100 ? (
                        <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200 flex items-center gap-1.5 w-fit">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Exceeding
                        </span>
                      ) : targetScore >= 75 ? (
                        <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold border border-indigo-200 flex items-center gap-1.5 w-fit">
                          <TrendingUp className="w-3.5 h-3.5" />
                          On Track
                        </span>
                      ) : targetScore >= 50 ? (
                        <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-xs font-bold border border-amber-200 flex items-center gap-1.5 w-fit">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Near Target
                        </span>
                      ) : (
                        <span className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-xs font-bold border border-red-200 flex items-center gap-1.5 w-fit">
                          Underperforming
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {((viewType === 'staff' && leaderboardData.length === 0) || (viewType === 'branches' && branchesData.length === 0)) && !loading && (
          <div className="p-16 text-center text-slate-400">
            <Trophy className="w-12 h-12 mx-auto text-slate-200 mb-3" />
            <h3 className="font-bold text-sm uppercase tracking-widest">No Performance Records Found</h3>
            <p className="text-xs mt-1">Make sure targets are allocated and daily reports are submitted & approved.</p>
          </div>
        )}
      </div>
    </div>
  );
};
