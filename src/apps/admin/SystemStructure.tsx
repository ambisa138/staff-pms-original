import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, serverTimestamp, where, query } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, cleanForFirestore } from '../../packages/shared/firebase';
import { Map, Building2, Plus, Search, ChevronRight, UserCheck, Users, Shield, ArrowRight, Check, X } from 'lucide-react';

import { useLocation } from 'react-router-dom';

export const SystemStructure = () => {
  const location = useLocation();
  const [districts, setDistricts] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'districts' | 'branches'>('districts');

  useEffect(() => {
    if (location.pathname === '/branches') {
      setActiveTab('branches');
    } else {
      setActiveTab('districts');
    }
  }, [location.pathname]);

  const [searchTerm, setSearchTerm] = useState('');

  // Modals / assignment states
  const [selectedDistrictForAssignment, setSelectedDistrictForAssignment] = useState<any | null>(null);
  const [selectedBranchForAssignment, setSelectedBranchForAssignment] = useState<any | null>(null);
  const [selectedBranchForStaff, setSelectedBranchForStaff] = useState<any | null>(null);
  const [assigningDirectorId, setAssigningDirectorId] = useState('');
  const [assigningManagerId, setAssigningManagerId] = useState('');
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [savingAssignment, setSavingAssignment] = useState(false);

  const [name, setName] = useState('');
  const [selectedDistrictId, setSelectedDistrictId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
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

      let uSnap;
      try {
        uSnap = await getDocs(collection(db, "users"));
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

      const userList = dedupeList(uSnap.docs.map(d => ({ ...(d.data() as any), id: d.id })));
      const districtList = dedupeList(dSnap.docs.map(d => ({ ...(d.data() as any), id: d.id })));
      const branchList = dedupeList(bSnap.docs.map(d => ({ ...(d.data() as any), id: d.id })));

      setUsers(userList);
      setDistricts(districtList);
      setBranches(branchList);
    } catch (err: any) {
      console.error("fetchData error:", err);
      setErrorMsg(err.message || "Failed to fetch structure hierarchy.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      if (activeTab === 'districts') {
        let docRef;
        try {
          docRef = await addDoc(collection(db, "districts"), cleanForFirestore({
            name: name.trim(),
            createdAt: serverTimestamp()
          }));
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, "districts");
          return;
        }
        setDistricts(prev => [...prev, { id: docRef.id, name: name.trim() }]);
        setSuccessMsg(`District "${name.trim()}" created successfully!`);
      } else {
        if (!selectedDistrictId) {
          setErrorMsg("Please select a parent district for this branch.");
          setSubmitting(false);
          return;
        }
        let docRef;
        try {
          docRef = await addDoc(collection(db, "branches"), cleanForFirestore({
            name: name.trim(),
            districtId: selectedDistrictId,
            createdAt: serverTimestamp()
          }));
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, "branches");
          return;
        }
        setBranches(prev => [...prev, { id: docRef.id, name: name.trim(), districtId: selectedDistrictId }]);
        setSuccessMsg(`Branch "${name.trim()}" created successfully!`);
      }
      setName('');
      setSelectedDistrictId('');
    } catch (err: any) {
      console.error("Add entity error:", err);
      setErrorMsg(err.message || "Failed to add entity. Please check permissions.");
    } finally {
      setSubmitting(false);
    }
  };

  // Assign District Director
  const handleAssignDistrictDirector = async () => {
    if (!selectedDistrictForAssignment) return;
    setSavingAssignment(true);
    setErrorMsg(null);
    try {
      const selectedUser = users.find(u => u.uid === assigningDirectorId || u.id === assigningDirectorId);
      
      // Update District doc
      await updateDoc(doc(db, "districts", selectedDistrictForAssignment.id), cleanForFirestore({
        managerId: assigningDirectorId || '',
        managerName: selectedUser ? selectedUser.fullName : '',
        managerEmail: selectedUser ? selectedUser.email : ''
      }));

      // Update User role & districtId if assigned
      if (selectedUser) {
        const userDocId = selectedUser.id || selectedUser.uid;
        await updateDoc(doc(db, "users", userDocId), cleanForFirestore({
          districtId: selectedDistrictForAssignment.id,
          role: 'District Director'
        }));
      }

      setSuccessMsg(`Assigned ${selectedUser?.fullName || 'Director'} to district.`);
      setSelectedDistrictForAssignment(null);
      fetchData();
    } catch (err: any) {
      console.error("Assign Director error:", err);
      setErrorMsg(err.message || "Failed to assign director.");
    } finally {
      setSavingAssignment(false);
    }
  };

  // Assign Branch Manager
  const handleAssignBranchManager = async () => {
    if (!selectedBranchForAssignment) return;
    setSavingAssignment(true);
    setErrorMsg(null);
    try {
      const selectedUser = users.find(u => u.uid === assigningManagerId || u.id === assigningManagerId);
      
      // Update Branch doc
      await updateDoc(doc(db, "branches", selectedBranchForAssignment.id), cleanForFirestore({
        managerId: assigningManagerId || '',
        managerName: selectedUser ? selectedUser.fullName : '',
        managerEmail: selectedUser ? selectedUser.email : ''
      }));

      // Update User role, branchId and districtId
      if (selectedUser) {
        const userDocId = selectedUser.id || selectedUser.uid;
        await updateDoc(doc(db, "users", userDocId), cleanForFirestore({
          branchId: selectedBranchForAssignment.id,
          districtId: selectedBranchForAssignment.districtId || '',
          role: 'Branch Manager'
        }));
      }

      setSuccessMsg(`Assigned ${selectedUser?.fullName || 'Manager'} to branch.`);
      setSelectedBranchForAssignment(null);
      fetchData();
    } catch (err: any) {
      console.error("Assign Branch Manager error:", err);
      setErrorMsg(err.message || "Failed to assign branch manager.");
    } finally {
      setSavingAssignment(false);
    }
  };

  // Assign Staff Members to Branch
  const handleSaveBranchStaff = async () => {
    if (!selectedBranchForStaff) return;
    setSavingAssignment(true);
    setErrorMsg(null);
    try {
      // Find all users who should be assigned to this branch
      const updates = users.map(async (u) => {
        const isSelected = selectedStaffIds.includes(u.uid || u.id);
        const userDocId = u.id || u.uid;
        if (isSelected && u.branchId !== selectedBranchForStaff.id) {
          // Assign to this branch
          return updateDoc(doc(db, "users", userDocId), cleanForFirestore({
            branchId: selectedBranchForStaff.id,
            districtId: selectedBranchForStaff.districtId || '',
            role: u.role === 'District Director' || u.role === 'Branch Manager' ? u.role : 'Branch Staff'
          }));
        } else if (!isSelected && u.branchId === selectedBranchForStaff.id && u.role === 'Branch Staff') {
          // Unassign from this branch
          return updateDoc(doc(db, "users", userDocId), cleanForFirestore({
            branchId: ''
          }));
        }
      });

      await Promise.all(updates);
      setSuccessMsg(`Staff members updated for ${selectedBranchForStaff.name}.`);
      setSelectedBranchForStaff(null);
      fetchData();
    } catch (err: any) {
      console.error("Staff assignment error:", err);
      setErrorMsg(err.message || "Failed to update staff assignments.");
    } finally {
      setSavingAssignment(false);
    }
  };

  const filteredDistricts = districts.filter(d => 
    d.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.managerName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredBranches = branches.filter(b => 
    b.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.managerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    districts.find(d => d.id === b.districtId)?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-primary tracking-tight">Districts & Branches</h1>
          <p className="text-slate-500 font-medium text-xs mt-0.5">Structure & Manager Assignments</p>
        </div>
      </div>

      {successMsg && (
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

      {/* --- Tabs --- */}
      <div className="flex border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('districts')}
          className={`px-8 py-4 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${activeTab === 'districts' ? 'border-accent text-accent' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          <Map className="w-4 h-4" />
          Districts ({districts.length})
        </button>
        <button 
          onClick={() => setActiveTab('branches')}
          className={`px-8 py-4 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${activeTab === 'branches' ? 'border-accent text-accent' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          <Building2 className="w-4 h-4" />
          Branches ({branches.length})
        </button>
      </div>

      {/* --- Tab Content --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex bg-white p-4 rounded-xl shadow-subtle border border-slate-100 items-center">
            <Search className="w-4 h-4 text-slate-400 mr-3" />
            <input 
              type="text" 
              placeholder={`Search ${activeTab} by name or assigned manager...`} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-sm text-primary font-medium"
            />
          </div>

          <div className="bg-white rounded-xl shadow-subtle border border-slate-100 divide-y divide-slate-100">
            {activeTab === 'districts' ? (
              filteredDistricts.map((d, idx) => {
                const assignedDirector = users.find(u => u.uid === d.managerId || u.id === d.managerId || (u.districtId === d.id && u.role === 'District Director'));
                const districtBranches = branches.filter(b => b.districtId === d.id);
                
                return (
                  <div key={`dist-card-${d.id || 'dist'}-${idx}`} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                        <Map className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="font-extrabold text-primary text-base">{d.name}</div>
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
                          <span className="font-semibold text-slate-700 flex items-center gap-1">
                            <Shield className="w-3.5 h-3.5 text-indigo-500" />
                            Director: {assignedDirector?.fullName || d.managerName || 'Unassigned'}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span>{districtBranches.length} Branches</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setSelectedDistrictForAssignment(d);
                        setAssigningDirectorId(assignedDirector?.uid || assignedDirector?.id || d.managerId || '');
                      }}
                      className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 self-start md:self-auto"
                    >
                      <UserCheck className="w-4 h-4" />
                      {assignedDirector ? 'Change Director' : 'Assign Director'}
                    </button>
                  </div>
                );
              })
            ) : (
              filteredBranches.map((b, idx) => {
                const assignedManager = users.find(u => u.uid === b.managerId || u.id === b.managerId || (u.branchId === b.id && u.role === 'Branch Manager'));
                const staffMembers = users.filter(u => u.branchId === b.id && u.role === 'Branch Staff');
                const parentDistrict = districts.find(d => d.id === b.districtId);

                return (
                  <div key={`branch-card-${b.id || 'branch'}-${idx}`} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 font-bold">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="font-extrabold text-primary text-base">{b.name}</div>
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
                          <span className="font-bold text-slate-600">District: {parentDistrict?.name || 'Unassigned'}</span>
                          <span className="text-slate-300">•</span>
                          <span className="font-semibold text-amber-700 flex items-center gap-1">
                            <Shield className="w-3.5 h-3.5 text-amber-500" />
                            Manager: {assignedManager?.fullName || b.managerName || 'Unassigned'}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-600 flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            {staffMembers.length} Staff Members
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-start md:self-auto">
                      <button 
                        onClick={() => {
                          setSelectedBranchForAssignment(b);
                          setAssigningManagerId(assignedManager?.uid || assignedManager?.id || b.managerId || '');
                        }}
                        className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-bold transition flex items-center gap-1"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        {assignedManager ? 'Manager' : 'Assign Manager'}
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedBranchForStaff(b);
                          setSelectedStaffIds(staffMembers.map(s => s.uid || s.id));
                        }}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1"
                      >
                        <Users className="w-3.5 h-3.5" />
                        Manage Staff ({staffMembers.length})
                      </button>
                    </div>
                  </div>
                );
              })
            )}
            
            {((activeTab === 'districts' && filteredDistricts.length === 0) || (activeTab === 'branches' && filteredBranches.length === 0)) && !loading && (
              <div className="p-12 text-center text-slate-400">
                <p className="font-bold text-sm uppercase tracking-widest">No {activeTab} match your criteria</p>
                <p className="text-xs mt-1">Start by adding one from the right panel or clear filters</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Quick Add */}
        <div className="space-y-6">
          <div className="card-premium">
            <div className="flex items-center gap-2 mb-4">
              <Plus className="w-5 h-5 text-accent" />
              <h3 className="font-bold text-primary">Quick Add {activeTab === 'districts' ? 'District' : 'Branch'}</h3>
            </div>
            <form onSubmit={handleAddEntity} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Name</label>
                <input 
                  required 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full mt-1 px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-accent/50 outline-none transition text-sm font-bold" 
                  placeholder={`${activeTab === 'districts' ? 'District' : 'Branch'} Name`} 
                />
              </div>
              {activeTab === 'branches' && (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Assign District</label>
                  <select 
                    required 
                    value={selectedDistrictId}
                    onChange={(e) => setSelectedDistrictId(e.target.value)}
                    className="w-full mt-1 px-4 py-2 rounded-lg border border-slate-200 outline-none text-sm font-bold bg-slate-50"
                  >
                    <option value="">Select District</option>
                    {districts.map((d, idx) => <option key={`opt-dist-${d.id}-${idx}`} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}
              <button 
                type="submit" 
                disabled={submitting}
                className="w-full btn-accent py-2 text-sm disabled:opacity-50"
              >
                {submitting ? 'Saving...' : `Save ${activeTab === 'districts' ? 'District' : 'Branch'}`}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* --- Assign District Director Modal --- */}
      {selectedDistrictForAssignment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-primary/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-extrabold text-primary mb-2">Assign District Director</h2>
            <p className="text-xs text-slate-500 mb-4">
              Select the director to lead <span className="font-bold text-primary">{selectedDistrictForAssignment.name}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Select Director</label>
                <select 
                  value={assigningDirectorId}
                  onChange={(e) => setAssigningDirectorId(e.target.value)}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-200 outline-none text-sm font-bold bg-slate-50 text-primary"
                >
                  <option value="">-- No Director (Unassigned) --</option>
                  {users
                    .filter(u => u.role === 'District Director' || u.role === 'Super Admin' || !u.districtId || u.districtId === selectedDistrictForAssignment.id)
                    .map((u, idx) => (
                      <option key={`dir-opt-${u.uid || u.id}-${idx}`} value={u.uid || u.id}>
                        {u.fullName} ({u.email}) - {u.role}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setSelectedDistrictForAssignment(null)}
                  className="flex-1 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={handleAssignDistrictDirector}
                  disabled={savingAssignment}
                  className="flex-1 btn-primary py-2 text-sm disabled:opacity-50"
                >
                  {savingAssignment ? 'Saving...' : 'Save Director'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Assign Branch Manager Modal --- */}
      {selectedBranchForAssignment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-primary/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-extrabold text-primary mb-2">Assign Branch Manager</h2>
            <p className="text-xs text-slate-500 mb-4">
              Select the manager for <span className="font-bold text-primary">{selectedBranchForAssignment.name}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Select Branch Manager</label>
                <select 
                  value={assigningManagerId}
                  onChange={(e) => setAssigningManagerId(e.target.value)}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl border border-slate-200 outline-none text-sm font-bold bg-slate-50 text-primary"
                >
                  <option value="">-- No Manager (Unassigned) --</option>
                  {users
                    .filter(u => u.role === 'Branch Manager' || u.role === 'Branch Staff' || !u.branchId || u.branchId === selectedBranchForAssignment.id)
                    .map((u, idx) => (
                      <option key={`mgr-opt-${u.uid || u.id}-${idx}`} value={u.uid || u.id}>
                        {u.fullName} ({u.email}) - {u.role}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setSelectedBranchForAssignment(null)}
                  className="flex-1 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={handleAssignBranchManager}
                  disabled={savingAssignment}
                  className="flex-1 btn-primary py-2 text-sm disabled:opacity-50"
                >
                  {savingAssignment ? 'Saving...' : 'Save Manager'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Assign Branch Staff Members Modal --- */}
      {selectedBranchForStaff && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-primary/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[85vh] flex flex-col">
            <h2 className="text-xl font-extrabold text-primary mb-1">Assign Staff Members</h2>
            <p className="text-xs text-slate-500 mb-4">
              Manage staff members assigned to <span className="font-bold text-primary">{selectedBranchForStaff.name}</span>
            </p>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
              {users
                .filter(u => u.role === 'Branch Staff' || (!u.branchId || u.branchId === selectedBranchForStaff.id))
                .map((u, idx) => {
                  const uid = u.uid || u.id;
                  const isChecked = selectedStaffIds.includes(uid);
                  return (
                    <label 
                      key={`staff-assign-${uid}-${idx}`} 
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition ${isChecked ? 'bg-indigo-50/70 border border-indigo-200' : 'hover:bg-slate-50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStaffIds(prev => [...prev, uid]);
                            } else {
                              setSelectedStaffIds(prev => prev.filter(id => id !== uid));
                            }
                          }}
                          className="w-4 h-4 rounded text-accent focus:ring-accent/50"
                        />
                        <div>
                          <div className="font-bold text-primary text-sm">{u.fullName}</div>
                          <div className="text-xs text-slate-400">{u.email} • {u.role}</div>
                        </div>
                      </div>
                      {u.branchId && u.branchId !== selectedBranchForStaff.id && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">
                          Other branch
                        </span>
                      )}
                    </label>
                  );
                })}
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-100 mt-4">
              <button 
                type="button" 
                onClick={() => setSelectedBranchForStaff(null)}
                className="flex-1 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleSaveBranchStaff}
                disabled={savingAssignment}
                className="flex-1 btn-primary py-2 text-sm disabled:opacity-50"
              >
                {savingAssignment ? 'Saving...' : `Save Staff (${selectedStaffIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

