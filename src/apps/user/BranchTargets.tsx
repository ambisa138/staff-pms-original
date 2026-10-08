import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, cleanForFirestore, handleFirestoreError, OperationType } from '../../packages/shared/firebase';
import { UserProfile } from '../../packages/shared/services';
import { Target, Building2, Users, TrendingUp, Search, User } from 'lucide-react';
import { cn } from '../../packages/shared/components/UI';

export const BranchTargets = ({ profile }: { profile: UserProfile }) => {
  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntity, setSelectedEntity] = useState<any | null>(null);

  const [kpiTargets, setKpiTargets] = useState<{ [key: string]: number }>({});
  const [period, setPeriod] = useState('October 2026');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const isBranchManager = profile.role === 'Branch Manager';

  useEffect(() => {
    const fetchEntities = async () => {
      setLoading(true);
      try {
        let q;
        if (isBranchManager) {
          // Branch Managers set targets for their staff
          q = query(
            collection(db, "users"), 
            where("branchId", "==", profile.branchId || 'Headquarters'),
            where("role", "==", "Branch Staff")
          );
        } else if (profile.role === 'Super Admin') {
          q = collection(db, "branches");
        } else if (profile.districtId) {
          q = query(collection(db, "branches"), where("districtId", "==", profile.districtId));
        } else {
          q = collection(db, "branches");
        }
        
        const snap = await getDocs(q);
        const dedupeList = <T extends { id?: string }>(list: T[]): T[] => {
          const seen = new Set<string>();
          return list.filter(item => {
            if (!item.id || seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          });
        };

        setEntities(dedupeList(snap.docs.map(doc => ({ ...(doc.data() as any), id: doc.id }))));
      } catch (err) {
        console.error("Error fetching target entities:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEntities();
  }, [profile.districtId, profile.role, profile.branchId, isBranchManager]);

  // Load existing targets for selected entity when period or entity changes
  useEffect(() => {
    if (!selectedEntity) return;
    
    const fetchExistingTargets = async () => {
      try {
        const q = query(
          collection(db, "targets"),
          where("ownerId", "==", selectedEntity.id),
          where("period", "==", period)
        );
        const snap = await getDocs(q);
        const targets: { [key: string]: number } = {};
        snap.forEach(doc => {
          const data = doc.data();
          targets[data.kpiId] = data.targetValue || data.value || 0;
        });
        setKpiTargets(targets);
      } catch (err) {
        console.warn("Error fetching existing targets:", err);
      }
    };
    
    fetchExistingTargets();
  }, [selectedEntity, period]);

  const handleSaveTargets = async () => {
    if (!selectedEntity) return;
    setSaving(true);
    setSavedSuccess(false);
    try {
      for (const [kpiName, value] of Object.entries(kpiTargets)) {
        if (value !== undefined && Number(value) >= 0) {
          const targetData = cleanForFirestore({
            ownerId: selectedEntity.id,
            scope: isBranchManager ? 'staff' : 'branch',
            kpiId: kpiName,
            targetValue: Number(value),
            value: Number(value),
            period,
            createdBy: profile.uid,
            createdAt: serverTimestamp()
          });
          await addDoc(collection(db, "targets"), targetData);
        }
      }
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error("Save targets error:", err);
    } finally {
      setSaving(false);
    }
  };

  const filteredEntities = entities.filter(entity => {
    const name = entity.name || entity.fullName || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Sidebar: List */}
      <div className="lg:col-span-1 space-y-6">
        <div>
          <h1 className="text-2xl font-black text-primary tracking-tight">
            {isBranchManager ? 'Staff Quotas' : 'District Quotas'}
          </h1>
          <p className="text-slate-500 font-medium text-xs mt-0.5">
            {isBranchManager ? 'Staff Target Allocations' : 'Branch Target Allocations'}
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={isBranchManager ? "Search staff..." : "Search branches..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>

        {loading ? (
          <div className="text-center py-8 text-slate-400 text-sm font-bold uppercase tracking-widest animate-pulse">
            Loading...
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {filteredEntities.map((entity, idx) => {
              const displayName = entity.fullName || entity.name || 'Unknown';
              return (
                <div 
                  key={`target-entity-${entity.id || 'entity'}-${idx}`} 
                  onClick={() => {
                    setSelectedEntity(entity);
                    setKpiTargets({});
                  }}
                  className={cn(
                    "card-premium p-4 cursor-pointer transition-all border-l-4",
                    selectedEntity?.id === entity.id ? "border-accent ring-2 ring-accent/10" : "border-slate-200 hover:border-accent/50"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      isBranchManager ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600"
                    )}>
                      {isBranchManager ? (
                        <User className="w-5 h-5" />
                      ) : (
                        <Building2 className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-primary text-sm leading-snug">{displayName}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {isBranchManager ? entity.role : `Branch ID: ${entity.id}`}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {filteredEntities.length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-slate-100 text-slate-400 text-xs">
                No {isBranchManager ? 'staff members' : 'branches'} found.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main: Target Editor */}
      <div className="lg:col-span-2">
        {selectedEntity ? (
          <div className="card-premium space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-slate-100 pb-6">
              <div>
                <h2 className="text-2xl font-extrabold text-primary">Target Allocation</h2>
                <p className="text-slate-500 text-sm">
                  Setting KPIs for <span className="font-bold text-accent">{selectedEntity.fullName || selectedEntity.name}</span>
                </p>
              </div>
              <div>
                <select 
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="bg-slate-100 text-xs font-bold px-4 py-2.5 rounded-xl border-none outline-none text-primary cursor-pointer hover:bg-slate-200 transition-colors"
                >
                  <option value="October 2026">October 2026</option>
                  <option value="November 2026">November 2026</option>
                  <option value="December 2026">December 2026</option>
                  <option value="Q4 2026">Q4 2026</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                "Deposit Mobilization", 
                "Customer Creation", 
                "Coopayebirr", 
                "Merchant & QR", 
                "Michu Onboarding", 
                "Michu Collection", 
                "ATM Creation", 
                "ATM Activation", 
                "Cash Collection"
              ].map(kpi => (
                <div key={kpi} className="card-premium p-4 flex items-center justify-between group bg-slate-50/50 hover:bg-white transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center group-hover:bg-accent/10 transition-colors">
                      <Target className="w-4 h-4 text-slate-400 group-hover:text-accent" />
                    </div>
                    <span className="text-sm font-bold text-slate-700">{kpi}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      placeholder="0"
                      value={kpiTargets[kpi] !== undefined ? kpiTargets[kpi] : ''}
                      onChange={(e) => setKpiTargets({ ...kpiTargets, [kpi]: Number(e.target.value) })}
                      className="w-24 bg-white border border-slate-200 rounded-lg px-3 py-2 text-right text-sm font-bold text-primary focus:ring-2 focus:ring-accent/50 outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-6 border-t border-slate-100">
              {savedSuccess ? (
                <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-lg">
                  ✓ Targets Updated Successfully!
                </span>
              ) : <div />}
              <button 
                onClick={handleSaveTargets}
                disabled={saving}
                className="btn-accent px-10 disabled:opacity-50"
              >
                {saving ? 'Updating...' : 'Update Targets'}
              </button>
            </div>
          </div>
        ) : (
          <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200 p-8">
            <TrendingUp className="w-12 h-12 text-slate-200 mb-4" />
            <h3 className="text-slate-400 font-bold uppercase tracking-widest">
              Select {isBranchManager ? 'Staff' : 'Branch'} to Set Targets
            </h3>
            <p className="text-slate-400 text-xs mt-2 max-w-xs mx-auto">
              {isBranchManager 
                ? 'Allocated quotas will define individual goals for staff tracking.'
                : 'Allocated quotas will be visible to branch managers for staff distribution.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
