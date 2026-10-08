import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db, cleanForFirestore, handleFirestoreError, OperationType } from '../../packages/shared/firebase';
import { UserProfile } from '../../packages/shared/services';
import { FileText, Plus, ChevronRight, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { StatusChip, cn } from '../../packages/shared/components/UI';

export const PlansReports = ({ profile }: { profile: UserProfile }) => {
  const [plans, setPlans] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [mappedCustomers, setMappedCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'plans' | 'reports'>('plans');

  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Plan Form State
  const [planType, setPlanType] = useState('Daily');
  const [planDescription, setPlanDescription] = useState('');

  // Report Form State
  const [kpiId, setKpiId] = useState('Deposit Mobilization');
  const [actualValue, setActualValue] = useState('');
  const [period, setPeriod] = useState('October 2026');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [closeCustomerCycle, setCloseCustomerCycle] = useState(true);

  useEffect(() => {
    fetchData();
  }, [profile.uid]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const pQ = query(collection(db, "plans"), where("staffId", "==", profile.uid));
      const rQ = query(collection(db, "reports"), where("staffId", "==", profile.uid));
      const cQ = query(collection(db, "mappedCustomers"), where("staffId", "==", profile.uid));
      
      const [pSnap, rSnap, cSnap] = await Promise.all([
        getDocs(pQ), 
        getDocs(rQ),
        getDocs(cQ)
      ]);
      
      const dedupeList = <T extends { id?: string }>(list: T[]): T[] => {
        const seen = new Set<string>();
        return list.filter(item => {
          if (!item.id || seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
      };

      setPlans(dedupeList(pSnap.docs.map(doc => ({ ...(doc.data() as any), id: doc.id }))));
      setReports(dedupeList(rSnap.docs.map(doc => ({ ...(doc.data() as any), id: doc.id }))));
      
      const customers = dedupeList(cSnap.docs.map(doc => ({ ...(doc.data() as any), id: doc.id })));
      setMappedCustomers(customers);
      
      // Auto-select first customer if available
      if (customers.length > 0) {
        setSelectedCustomer(customers[0].id);
      }
    } catch (err) {
      console.error("Error fetching plans/reports/customers:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlanOrReport = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation for deposit mobilization
    if (activeTab === 'reports' && kpiId === 'Deposit Mobilization' && !selectedCustomer) {
      alert("Please map a customer first for Deposit Mobilization reports.");
      return;
    }

    setSubmitting(true);
    try {
      if (activeTab === 'plans') {
        const planData = cleanForFirestore({
          staffId: profile.uid,
          branchId: profile.branchId || 'Headquarters',
          type: planType,
          kpiId: "General",
          description: planDescription,
          status: 'submitted',
          createdAt: serverTimestamp()
        });
        try {
          await addDoc(collection(db, "plans"), planData);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, "plans");
          return;
        }
        setPlanDescription('');
      } else {
        const selectedCustObj = mappedCustomers.find(c => c.id === selectedCustomer);
        const reportData = cleanForFirestore({
          staffId: profile.uid,
          branchId: profile.branchId || 'Headquarters',
          kpiId,
          actualValue: Number(actualValue) || 0,
          value: Number(actualValue) || 0,
          period,
          status: 'submitted',
          customerId: kpiId === 'Deposit Mobilization' ? (selectedCustomer || '') : '',
          customerName: (kpiId === 'Deposit Mobilization' && selectedCustObj) ? (selectedCustObj.customerName || '') : '',
          createdAt: serverTimestamp()
        });
        try {
          await addDoc(collection(db, "reports"), reportData);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, "reports");
          return;
        }

        // If Deposit Mobilization and user opted to close customer cycle
        if (kpiId === 'Deposit Mobilization' && selectedCustomer && closeCustomerCycle) {
          try {
            await updateDoc(doc(db, "mappedCustomers", selectedCustomer), cleanForFirestore({
              status: 'closed',
              closedAt: serverTimestamp()
            }));
          } catch (err) {
            console.warn("Could not update customer status to closed:", err);
          }
        }

        setActualValue('');
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      console.error("Creation error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const isDepositMobilization = kpiId === 'Deposit Mobilization';
  const hasNoCustomers = mappedCustomers.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-primary tracking-tight">Plans & Reports</h1>
          <p className="text-slate-500 font-medium text-xs mt-0.5">Commitment Plans & Performance Reports</p>
        </div>
        <button onClick={() => {
          // Set initial values
          setKpiId('Deposit Mobilization');
          if (mappedCustomers.length > 0) {
            setSelectedCustomer(mappedCustomers[0].id);
          }
          setShowModal(true);
        }} className="btn-primary">
          <Plus className="w-5 h-5" />
          Create New {activeTab === 'plans' ? 'Plan' : 'Report'}
        </button>
      </div>

      <div className="flex border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('plans')}
          className={`px-8 py-4 text-sm font-bold transition-all border-b-2 ${activeTab === 'plans' ? 'border-accent text-accent' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          Commitment Plans
        </button>
        <button 
          onClick={() => setActiveTab('reports')}
          className={`px-8 py-4 text-sm font-bold transition-all border-b-2 ${activeTab === 'reports' ? 'border-accent text-accent' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          Performance Reports
        </button>
      </div>

      <div className="space-y-4">
        {activeTab === 'plans' ? (
          plans.map((plan, idx) => (
            <div key={`plan-${plan.id || 'p'}-${idx}`} className="card-premium flex items-center justify-between group hover:border-accent transition-all">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center",
                  plan.status === 'approved' ? "bg-green-50" : "bg-slate-50"
                )}>
                  <FileText className={cn(
                    "w-6 h-6",
                    plan.status === 'approved' ? "text-green-600" : "text-slate-400"
                  )} />
                </div>
                <div>
                  <div className="font-bold text-primary">{plan.type} Plan</div>
                  <div className="text-xs text-slate-400">
                    Submitted on {plan.createdAt?.toDate ? plan.createdAt.toDate().toLocaleDateString() : 'Just now'}
                  </div>
                  <p className="text-sm text-slate-500 mt-1 font-medium">{plan.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <StatusChip status={plan.status} />
              </div>
            </div>
          ))
        ) : (
          reports.map((report, idx) => (
            <div key={`report-${report.id || 'r'}-${idx}`} className="card-premium flex items-center justify-between group hover:border-accent transition-all">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center",
                  report.status === 'approved' ? "bg-green-50" : "bg-slate-50"
                )}>
                  <CheckCircle className={cn(
                    "w-6 h-6",
                    report.status === 'approved' ? "text-green-600" : "text-slate-400"
                  )} />
                </div>
                <div>
                  <div className="font-bold text-primary">{report.kpiId} Report</div>
                  <div className="text-xs text-slate-400 font-bold">
                    Actual Achievement: {report.actualValue || report.value} • {report.period}
                  </div>
                  {report.customerName && (
                    <div className="text-xs text-indigo-600 font-bold mt-1 uppercase tracking-wider">
                      Mapped Customer: {report.customerName}
                    </div>
                  )}
                  {report.comment && (
                    <div className="text-xs text-amber-600 mt-1 bg-amber-50 px-2.5 py-1 rounded-lg inline-block border border-amber-100 font-medium">
                      Feedback: {report.comment}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-6">
                <StatusChip status={report.status} />
              </div>
            </div>
          ))
        )}

        {((activeTab === 'plans' && plans.length === 0) || (activeTab === 'reports' && reports.length === 0)) && !loading && (
          <div className="py-20 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
            <FileText className="w-12 h-12 mx-auto mb-4 text-slate-200" />
            <p className="font-bold text-sm uppercase tracking-widest text-slate-300">No {activeTab} submitted yet</p>
          </div>
        )}
      </div>

      {/* --- Modal --- */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-primary/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-extrabold text-primary mb-6">
              Create New {activeTab === 'plans' ? 'Commitment Plan' : 'Performance Report'}
            </h2>
            <form onSubmit={handleCreatePlanOrReport} className="space-y-4">
              {activeTab === 'plans' ? (
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Plan Frequency</label>
                    <select 
                      value={planType}
                      onChange={(e) => setPlanType(e.target.value)}
                      className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-200 outline-none text-sm font-bold bg-slate-50 text-primary"
                    >
                      <option value="daily">Daily Plan</option>
                      <option value="weekly">Weekly Plan</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Commitment Description</label>
                    <textarea 
                      required
                      value={planDescription}
                      onChange={(e) => setPlanDescription(e.target.value)}
                      placeholder="Outline target deposit mobilizations, customer visits, or account creation goals..."
                      className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none focus:ring-2 focus:ring-accent/50 min-h-[120px] text-primary"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Select KPI</label>
                    <select 
                      value={kpiId}
                      onChange={(e) => setKpiId(e.target.value)}
                      className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-200 outline-none text-sm font-bold bg-slate-50 text-primary"
                    >
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
                      ].map(k => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                  </div>

                  {isDepositMobilization && (
                    <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100/50 space-y-3">
                      <label className="text-xs font-bold text-slate-500 uppercase">
                        Link Mapped Customer <span className="text-red-500">*</span>
                      </label>
                      {hasNoCustomers ? (
                        <div className="text-xs text-red-500 font-bold flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          No mapped customers found! Go to Customer Mapping to add potential deposits before submitting reports.
                        </div>
                      ) : (
                        <>
                          <select 
                            value={selectedCustomer}
                            onChange={(e) => setSelectedCustomer(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-accent/50"
                          >
                            {mappedCustomers.map((cust, idx) => (
                              <option key={`report-cust-${cust.id}-${idx}`} value={cust.id}>
                                {cust.customerName} - ${cust.plannedAmount?.toLocaleString()} ({cust.accountNumber})
                              </option>
                            ))}
                          </select>
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer pt-1">
                            <input 
                              type="checkbox"
                              checked={closeCustomerCycle}
                              onChange={(e) => setCloseCustomerCycle(e.target.checked)}
                              className="rounded text-accent focus:ring-accent/50"
                            />
                            <span>Close and complete mapped customer cycle with this report</span>
                          </label>
                        </>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase ml-1">Actual Achievement</label>
                      <input 
                        type="number"
                        required
                        value={actualValue}
                        onChange={(e) => setActualValue(e.target.value)}
                        placeholder="0"
                        className="w-full mt-1 px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-accent/50 text-sm font-bold text-primary"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase ml-1">Target Period</label>
                      <select 
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-200 outline-none text-sm font-bold bg-slate-50 text-primary"
                      >
                        <option value="October 2026">October 2026</option>
                        <option value="November 2026">November 2026</option>
                        <option value="December 2026">December 2026</option>
                        <option value="Q4 2026">Q4 2026</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-6 border-t border-slate-100 mt-6">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting || (activeTab === 'reports' && isDepositMobilization && hasNoCustomers)}
                  className="flex-1 btn-accent py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Submitting...' : 'Submit Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
