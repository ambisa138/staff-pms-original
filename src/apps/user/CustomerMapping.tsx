import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db, cleanForFirestore, handleFirestoreError, OperationType } from '../../packages/shared/firebase';
import { UserProfile } from '../../packages/shared/services';
import { UserPlus, Search, Calendar, Landmark, CreditCard, DollarSign, CheckCircle2, PhoneCall, AlertTriangle, Lock, CheckCircle, RefreshCw, User, X } from 'lucide-react';
import { StatusChip } from '../../packages/shared/components/UI';

export const CustomerMapping = ({ profile }: { profile: UserProfile }) => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [allMappedCustomers, setAllMappedCustomers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter and search
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'closed'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Form input state for real-time duplicate detection
  const [formAccount, setFormAccount] = useState('');
  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const fetchCustomersAndUsers = async () => {
    setLoading(true);
    try {
      // Fetch all mapped customers for global duplicate check & release cycle inspection
      let allSnap;
      try {
        allSnap = await getDocs(collection(db, "mappedCustomers"));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, "mappedCustomers");
        return;
      }

      let uSnap;
      try {
        uSnap = await getDocs(collection(db, "users"));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, "users");
        return;
      }

      const userMap = new Map();
      uSnap.docs.forEach(d => {
        const u = d.data();
        userMap.set(d.id, u.fullName || u.username || 'Staff Member');
        if (u.uid) userMap.set(u.uid, u.fullName || u.username || 'Staff Member');
      });
      setUsers(uSnap.docs.map(d => ({ ...d.data(), id: d.id })));

      const allList: any[] = allSnap.docs.map(d => {
        const data = d.data() as any;
        const staffName = data.staffName || userMap.get(data.staffId) || (data.staffId === profile.uid ? profile.fullName : 'Staff Member');
        return {
          ...data,
          id: d.id,
          resolvedStaffName: staffName
        };
      });

      const dedupeList = <T extends { id?: string }>(list: T[]): T[] => {
        const seen = new Set<string>();
        return list.filter(item => {
          if (!item.id || seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
      };

      const dedupedList = dedupeList(allList);
      setAllMappedCustomers(dedupedList);

      // Filter visible customers based on role
      if (profile.role === 'Super Admin' || profile.role === 'District Director') {
        setCustomers(dedupedList);
      } else if (profile.role === 'Branch Manager' && profile.branchId) {
        setCustomers(dedupedList.filter((c: any) => c.branchId === profile.branchId));
      } else {
        // Mapped customers are shown to the owner only
        setCustomers(dedupedList.filter((c: any) => c.staffId === profile.uid || c.staffId === (profile as any).id));
      }
    } catch (err: any) {
      console.warn("fetchCustomers error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomersAndUsers();
  }, [profile.uid, profile.branchId, profile.role]);

  // Real-time duplicate checking
  useEffect(() => {
    const trimmedAccount = formAccount.trim();
    const trimmedName = formName.trim().toLowerCase();

    if (!trimmedAccount && !trimmedName) {
      setDuplicateWarning(null);
      return;
    }

    // Check if there is an active (unclosed) customer mapping
    const existingActive = allMappedCustomers.find(c => {
      const isAccountMatch = trimmedAccount && c.accountNumber && c.accountNumber.trim().toLowerCase() === trimmedAccount.toLowerCase();
      const isNameMatch = trimmedName && c.customerName && c.customerName.trim().toLowerCase() === trimmedName;
      const isNotClosed = c.status !== 'closed' && c.status !== 'completed';
      return (isAccountMatch || isNameMatch) && isNotClosed;
    });

    if (existingActive) {
      const staffName = existingActive.resolvedStaffName || existingActive.staffName || 'Staff Member';
      setDuplicateWarning(`This customer is mapped by ${staffName}`);
    } else {
      setDuplicateWarning(null);
    }
  }, [formAccount, formName, allMappedCustomers]);

  const handleUpdateStatus = async (customerId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "mappedCustomers", customerId), cleanForFirestore({
        status: newStatus,
        ...(newStatus === 'closed' || newStatus === 'completed' ? { closedAt: serverTimestamp() } : {})
      }));
      setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, status: newStatus } : c));
      setAllMappedCustomers(prev => prev.map(c => c.id === customerId ? { ...c, status: newStatus } : c));
      setSuccessMsg(`Customer mapping status updated to ${newStatus}.`);
    } catch (err) {
      console.error("Status update error:", err);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    
    const trimmedAccount = formAccount.trim();
    const trimmedName = formName.trim();

    // Check if duplicate active customer exists
    const existingActive = allMappedCustomers.find(c => {
      const isAccountMatch = trimmedAccount && c.accountNumber && c.accountNumber.trim().toLowerCase() === trimmedAccount.toLowerCase();
      const isNameMatch = trimmedName && c.customerName && c.customerName.trim().toLowerCase() === trimmedName.toLowerCase();
      const isNotClosed = c.status !== 'closed' && c.status !== 'completed';
      return (isAccountMatch || isNameMatch) && isNotClosed;
    });

    if (existingActive) {
      const staffName = existingActive.resolvedStaffName || existingActive.staffName || 'another staff member';
      setErrorMsg(`This customer is mapped by ${staffName}. Customer mapping will not allow duplicate mappings until their report against plans is closed.`);
      setSaving(false);
      return;
    }

    try {
      const customerData = cleanForFirestore({
        staffId: profile.uid,
        staffName: profile.fullName || 'Staff Member',
        branchId: profile.branchId || 'Headquarters',
        customerName: trimmedName || 'Valued Customer',
        accountNumber: trimmedAccount || '',
        plannedAmount: Number(formAmount) || 0,
        plannedDate: formDate || new Date().toISOString().split('T')[0],
        status: 'pending',
        createdAt: serverTimestamp()
      });

      try {
        await addDoc(collection(db, "mappedCustomers"), customerData);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, "mappedCustomers");
        return;
      }

      setShowModal(false);
      setSuccessMsg(`Customer "${trimmedName}" mapped successfully by ${profile.fullName}!`);
      setFormAccount('');
      setFormName('');
      setFormAmount('');
      fetchCustomersAndUsers();
    } catch (err: any) {
      console.error("handleAddCustomer error:", err);
      setErrorMsg(err.message || "Failed to save mapped customer.");
    } finally {
      setSaving(false);
    }
  };

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = 
      c.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.accountNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.resolvedStaffName?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filterTab === 'active') {
      return c.status !== 'closed' && c.status !== 'completed';
    }
    if (filterTab === 'closed') {
      return c.status === 'closed' || c.status === 'completed';
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-primary tracking-tight">Customer Deposit Mapping</h1>
          <p className="text-slate-500 font-medium text-xs mt-0.5">Customer Directory & Mobilization</p>
        </div>
        <button 
          onClick={() => {
            setFormAccount('');
            setFormName('');
            setFormAmount('');
            setDuplicateWarning(null);
            setErrorMsg(null);
            setShowModal(true);
          }} 
          className="btn-primary"
        >
          <UserPlus className="w-5 h-5" />
          Map New Customer
        </button>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            {successMsg}
          </div>
          <button onClick={() => setSuccessMsg(null)}><X className="w-4 h-4 text-emerald-500" /></button>
        </div>
      )}

      {/* --- Filter & Search Controls --- */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl shadow-subtle border border-slate-100">
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setFilterTab('all')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${filterTab === 'all' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            All ({customers.length})
          </button>
          <button 
            onClick={() => setFilterTab('active')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${filterTab === 'active' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Active / Open ({customers.filter(c => c.status !== 'closed' && c.status !== 'completed').length})
          </button>
          <button 
            onClick={() => setFilterTab('closed')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${filterTab === 'closed' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Closed / Completed ({customers.filter(c => c.status === 'closed' || c.status === 'completed').length})
          </button>
        </div>

        <div className="w-full sm:w-72 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by customer, account, or staff..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>
      </div>

      {/* --- Customer Cards Grid --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.map((c, idx) => {
          const isOwner = c.staffId === profile.uid || profile.role === 'Super Admin' || profile.role === 'District Director' || profile.role === 'Branch Manager';
          const isClosed = c.status === 'closed' || c.status === 'completed';

          return (
            <div key={`cust-card-${c.id || 'cust'}-${idx}`} className={`card-premium hover:shadow-premium transition-all flex flex-col justify-between ${isClosed ? 'opacity-85 border-slate-200 bg-slate-50/40' : 'border-slate-100'}`}>
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600">
                    <Landmark className="w-5 h-5" />
                  </div>
                  <StatusChip status={c.status} />
                </div>
                
                <h3 className="font-extrabold text-primary text-lg mb-1">{c.customerName}</h3>
                
                <div className="flex items-center gap-2 text-xs text-slate-500 font-bold mb-3">
                  <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                  <span>Acc: {c.accountNumber}</span>
                </div>

                {/* Staff Member Display */}
                <div className="p-2.5 bg-slate-50 rounded-xl mb-4 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-accent" />
                    <span className="text-xs font-bold text-slate-700">
                      Mapped by: <span className="text-primary">{c.resolvedStaffName || c.staffName || 'Staff Member'}</span>
                    </span>
                  </div>
                  {isClosed && (
                    <span className="text-[10px] bg-slate-200 text-slate-700 font-extrabold px-2 py-0.5 rounded-full">
                      Report Closed
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Target Amount</div>
                    <div className="text-base font-extrabold text-primary">${c.plannedAmount?.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Planned Date</div>
                    <div className="text-xs font-bold text-slate-600 mt-1">{c.plannedDate}</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 mt-4 border-t border-slate-100 space-y-2">
                {!isClosed ? (
                  <div className="flex flex-wrap gap-2">
                    {c.status === 'pending' && (
                      <button 
                        onClick={() => handleUpdateStatus(c.id, 'contacted')}
                        className="flex-1 py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        Contacted
                      </button>
                    )}
                    {c.status !== 'deposited' && (
                      <button 
                        onClick={() => handleUpdateStatus(c.id, 'deposited')}
                        className="flex-1 py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Deposited
                      </button>
                    )}
                    {isOwner && (
                      <button 
                        onClick={() => handleUpdateStatus(c.id, 'closed')}
                        className="w-full py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1"
                        title="Close report cycle to release this customer for future mapping"
                      >
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        Close Report & Complete Mapping
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs text-slate-400 font-medium py-1">
                    <span>Cycle completed & closed</span>
                    <button 
                      onClick={() => handleUpdateStatus(c.id, 'pending')}
                      className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Re-open
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filteredCustomers.length === 0 && !loading && (
          <div className="col-span-full py-20 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
            <div className="text-slate-300 mb-2">
              <UserPlus className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="font-bold text-sm uppercase tracking-widest text-slate-400">No mapped customers found</p>
            </div>
            <p className="text-slate-400 text-xs">Map potential deposits to track mobilization performance against target plans</p>
          </div>
        )}
      </div>

      {/* --- Map New Customer Modal --- */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-primary/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-extrabold text-primary mb-2">Map New Customer</h2>
            <p className="text-xs text-slate-500 mb-6">
              Enter customer account details. If customer has an active mapping, duplicate creation will be prevented.
            </p>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold mb-4 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {duplicateWarning && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold mb-4 flex items-start gap-2 animate-pulse">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <span className="font-extrabold">{duplicateWarning}</span>
                  <p className="font-normal text-[11px] mt-0.5 text-amber-700">
                    Duplicate mapping is locked until their report against plans is closed.
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Account Number</label>
                <input 
                  required
                  value={formAccount}
                  onChange={(e) => setFormAccount(e.target.value)}
                  placeholder="e.g. 10002938492"
                  className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-accent/50 text-sm font-bold text-primary" 
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Customer / Entity Name</label>
                <input 
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Commercial Trading PLC"
                  className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-accent/50 text-sm font-bold text-primary" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Planned Deposit Amount</label>
                  <input 
                    type="number" 
                    required 
                    min="1"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="50000"
                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-accent/50 text-sm font-bold text-primary" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Target Date</label>
                  <input 
                    type="date" 
                    required 
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-accent/50 text-sm font-bold text-primary" 
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-6 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="flex-1 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving || !!duplicateWarning}
                  className="flex-1 btn-accent py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Checking & Saving...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

