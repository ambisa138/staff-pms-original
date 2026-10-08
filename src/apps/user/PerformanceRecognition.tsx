import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, cleanForFirestore } from '../../packages/shared/firebase';
import { UserProfile } from '../../packages/shared/services';
import { PerformanceLogic, KPIData } from '../../packages/shared/calculations';
import { 
  Trophy, 
  Award, 
  Medal, 
  Sparkles, 
  Printer, 
  Download, 
  Eye, 
  CheckCircle2, 
  Star, 
  ShieldCheck, 
  Building2, 
  Users, 
  Calendar,
  Zap,
  Flame,
  User,
  X
} from 'lucide-react';
import { cn } from '../../packages/shared/components/UI';

export const PerformanceRecognition = ({ profile }: { profile: UserProfile }) => {
  const [period, setPeriod] = useState('October 2026');
  const [loading, setLoading] = useState(true);
  const [topPerformers, setTopPerformers] = useState<any[]>([]);
  const [selectedCertificate, setSelectedCertificate] = useState<any | null>(null);
  const certificateRef = useRef<HTMLDivElement>(null);

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
    fetchRecognitionData();
  }, [period, profile.districtId, profile.branchId, profile.role]);

  const fetchRecognitionData = async () => {
    setLoading(true);
    try {
      const [usersSnap, branchesSnap, targetsSnap, reportsSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "branches")),
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

      const allUsers = dedupe(usersSnap.docs.map(d => ({ ...(d.data() as any), id: d.id })));
      const allBranches = dedupe(branchesSnap.docs.map(d => ({ ...(d.data() as any), id: d.id })));
      const allTargets = dedupe(targetsSnap.docs.map(d => ({ ...(d.data() as any), id: d.id })));
      const allReports = dedupe(reportsSnap.docs.map(d => ({ ...(d.data() as any), id: d.id })));

      let relevantStaff = allUsers.filter(u => u.role === 'Branch Staff' || u.role === 'Branch Manager');

      if (profile.role === 'Branch Manager' && profile.branchId) {
        relevantStaff = relevantStaff.filter(u => u.branchId === profile.branchId);
      } else if (profile.role === 'District Director' && profile.districtId) {
        relevantStaff = relevantStaff.filter(u => u.districtId === profile.districtId);
      }

      const calculated = relevantStaff.map(staff => {
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
        const branchName = allBranches.find(b => b.id === staff.branchId)?.name || (staff.branchId ? 'Main Branch' : 'Headquarters');

        // Evaluate Badges
        const badges: string[] = [];
        if (overallScore >= 100) badges.push('Century Club Member');
        if (overallScore >= 120) badges.push('Grand Master Performer');
        if (kpiBreakdown['Deposit Mobilization']?.percentage >= 100) badges.push('Deposit Mobilization Champion');
        if (kpiBreakdown['Customer Creation']?.percentage >= 100) badges.push('Customer Acquisition Leader');
        if (kpiBreakdown['Coopayebirr']?.percentage >= 100 || kpiBreakdown['ATM Creation']?.percentage >= 100) badges.push('Digital Channels Pioneer');
        if (staffReports.length >= 10) badges.push('Consistent Achiever');

        return {
          id: staff.id,
          uid: staff.uid,
          fullName: staff.fullName || 'Bank Officer',
          username: staff.username,
          role: staff.role,
          email: staff.email,
          branchName,
          overallScore,
          badges,
          reportCount: staffReports.length,
          kpiBreakdown
        };
      });

      calculated.sort((a, b) => b.overallScore - a.overallScore);
      setTopPerformers(calculated);

    } catch (err) {
      console.warn("fetchRecognitionData error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-primary tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-500" />
            Wall of Fame & Honors
          </h1>
          <p className="text-slate-500 font-medium text-xs mt-0.5">
            Staff Recognition & Digital Certificates
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

      {/* Hall of Fame Badges Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-premium bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-200 flex items-center gap-4 p-5">
          <div className="p-3.5 bg-amber-500 text-white rounded-2xl shadow-md shadow-amber-200">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Century Club</div>
            <div className="text-2xl font-black text-amber-950 mt-0.5">
              {topPerformers.filter(p => p.overallScore >= 100).length} Officers
            </div>
          </div>
        </div>

        <div className="card-premium bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border border-indigo-200 flex items-center gap-4 p-5">
          <div className="p-3.5 bg-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-200">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider">Deposit Champions</div>
            <div className="text-2xl font-black text-indigo-950 mt-0.5">
              {topPerformers.filter(p => p.kpiBreakdown['Deposit Mobilization']?.percentage >= 100).length} Officers
            </div>
          </div>
        </div>

        <div className="card-premium bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-200 flex items-center gap-4 p-5">
          <div className="p-3.5 bg-emerald-600 text-white rounded-2xl shadow-md shadow-emerald-200">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Digital Pioneers</div>
            <div className="text-2xl font-black text-emerald-950 mt-0.5">
              {topPerformers.filter(p => (p.kpiBreakdown['Coopayebirr']?.percentage >= 100 || p.kpiBreakdown['ATM Creation']?.percentage >= 100)).length} Officers
            </div>
          </div>
        </div>

        <div className="card-premium bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-200 flex items-center gap-4 p-5">
          <div className="p-3.5 bg-purple-600 text-white rounded-2xl shadow-md shadow-purple-200">
            <Star className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">Active Achievers</div>
            <div className="text-2xl font-black text-purple-950 mt-0.5">
              {topPerformers.length} Active
            </div>
          </div>
        </div>
      </div>

      {/* Wall of Fame Cards */}
      <div className="space-y-4">
        <h2 className="text-xl font-extrabold text-primary flex items-center gap-2">
          <Award className="w-6 h-6 text-accent" />
          Recognition Honor Roll
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {topPerformers.map((staff, idx) => (
            <div 
              key={`wall-fame-${staff.id || staff.uid}-${idx}`} 
              className={cn(
                "card-premium hover:shadow-premium transition-all flex flex-col justify-between p-6 relative overflow-hidden",
                idx === 0 ? "border-2 border-amber-300 bg-gradient-to-br from-amber-500/10 to-white" :
                idx === 1 ? "border-2 border-slate-300 bg-gradient-to-br from-slate-100 to-white" :
                idx === 2 ? "border-2 border-amber-800/30 bg-gradient-to-br from-amber-900/5 to-white" :
                "border-slate-200 bg-white"
              )}
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg",
                      idx === 0 ? "bg-amber-500 text-white shadow-lg shadow-amber-200" :
                      idx === 1 ? "bg-slate-400 text-white shadow-lg shadow-slate-200" :
                      idx === 2 ? "bg-amber-800 text-white shadow-lg shadow-amber-900/20" :
                      "bg-indigo-50 text-indigo-700"
                    )}>
                      {idx + 1}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-primary font-bold overflow-hidden border border-slate-200 shrink-0">
                        {staff.photoUrl ? (
                          <img src={staff.photoUrl} alt={staff.fullName} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-6 h-6 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-primary text-base leading-snug">{staff.fullName}</h3>
                        <p className="text-xs text-slate-400 font-medium">{staff.branchName} • {staff.role}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-primary">{staff.overallScore}%</div>
                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Score</div>
                  </div>
                </div>

                {/* Badges Earned */}
                <div className="space-y-1.5 mb-6">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Badges & Accolades</div>
                  <div className="flex flex-wrap gap-1.5">
                    {staff.badges.length > 0 ? (
                      staff.badges.map((badge: string, bIdx: number) => (
                        <span 
                          key={`badge-${staff.id}-${bIdx}`}
                          className="bg-amber-50 text-amber-800 border border-amber-200/80 px-2.5 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1"
                        >
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                          {badge}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">Target completion in progress</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Generate Certificate Button */}
              <button 
                onClick={() => setSelectedCertificate(staff)}
                className="w-full py-2.5 px-4 bg-primary hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
              >
                <Award className="w-4 h-4 text-amber-400" />
                View & Print Certificate of Excellence
              </button>
            </div>
          ))}

          {topPerformers.length === 0 && !loading && (
            <div className="col-span-full py-20 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
              <Trophy className="w-12 h-12 mx-auto text-slate-200 mb-3" />
              <h3 className="font-bold text-sm uppercase tracking-widest text-slate-400">No Honor Roll Records for this Period</h3>
              <p className="text-xs text-slate-400 mt-1">Submit activity reports to calculate performance ratings.</p>
            </div>
          )}
        </div>
      </div>

      {/* --- Digital Certificate Modal --- */}
      {selectedCertificate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-primary/40 backdrop-blur-md overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-6 md:p-8 animate-in fade-in zoom-in duration-200 my-8">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Award className="w-6 h-6 text-amber-500" />
                <h3 className="font-extrabold text-primary text-lg">Official Certificate of Achievement</h3>
              </div>
              <button 
                onClick={() => setSelectedCertificate(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Certificate Canvas */}
            <div 
              ref={certificateRef}
              className="mt-6 p-8 md:p-10 rounded-2xl border-8 border-double border-amber-600/30 bg-gradient-to-b from-amber-50/20 via-white to-amber-50/30 relative text-center space-y-6 shadow-inner print:m-0 print:border-none"
            >
              {/* Watermark Seal */}
              <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
                <ShieldCheck className="w-96 h-96 text-primary" />
              </div>

              <div className="flex items-center justify-center gap-3">
                <div className="w-10 h-10 bg-primary text-accent font-black rounded-xl flex items-center justify-center text-sm">
                  BP
                </div>
                <div className="text-left">
                  <div className="text-base font-black text-primary tracking-tight">COOPERATIVE BANK OF OROMIA</div>
                  <div className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">Performance Management System</div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-black uppercase tracking-[0.3em] text-amber-700">Certificate of Excellence</div>
                <div className="text-xs text-slate-400 font-medium">This certificate is proudly awarded to</div>
              </div>

              <div>
                <h2 className="text-2xl md:text-3xl font-black text-primary tracking-tight underline decoration-amber-400 decoration-2 underline-offset-8">
                  {selectedCertificate.fullName}
                </h2>
                <p className="text-xs text-slate-500 font-bold mt-3">
                  {selectedCertificate.role} • {selectedCertificate.branchName}
                </p>
              </div>

              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed font-medium">
                In recognition of outstanding dedication, exceptional target achievement of <strong className="text-primary font-black text-sm">{selectedCertificate.overallScore}%</strong>, and exemplary performance during the performance evaluation period of <strong>{period}</strong>.
              </p>

              <div className="grid grid-cols-2 gap-8 pt-6 border-t border-amber-200/50 mt-6">
                <div>
                  <div className="font-mono text-xs font-bold text-slate-800 border-b border-slate-300 pb-1">
                    System Verified Authorization
                  </div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold mt-1">Super Admin & Directorate</div>
                </div>
                <div>
                  <div className="font-mono text-xs font-bold text-slate-800 border-b border-slate-300 pb-1">
                    {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold mt-1">Issue Date & Timestamp</div>
                </div>
              </div>

              <div className="text-[9px] text-slate-400 font-mono tracking-wider pt-2">
                Verification Code: CERT-BP-{selectedCertificate.id?.slice(0, 8).toUpperCase()}-2026
              </div>
            </div>

            <div className="flex gap-3 pt-6 mt-4 border-t border-slate-100">
              <button 
                type="button" 
                onClick={() => setSelectedCertificate(null)}
                className="flex-1 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition"
              >
                Close
              </button>
              <button 
                type="button" 
                onClick={handlePrint}
                className="flex-1 btn-primary py-2.5 text-sm flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print / Save PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
