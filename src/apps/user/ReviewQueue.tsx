import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, cleanForFirestore, handleFirestoreError, OperationType } from '../../packages/shared/firebase';
import { UserProfile } from '../../packages/shared/services';
import { CheckCircle, XCircle, MessageSquare, User, Calendar, ExternalLink } from 'lucide-react';
import { StatusChip, cn } from '../../packages/shared/components/UI';

export const ReviewQueue = ({ profile }: { profile: UserProfile }) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [reviewComment, setReviewComment] = useState('');

  useEffect(() => {
    const fetchQueue = async () => {
      let plansQ;
      let reportsQ;
      
      if (profile.role === 'Super Admin' || !profile.branchId) {
        plansQ = query(collection(db, "plans"), where("status", "==", "submitted"));
        reportsQ = query(collection(db, "reports"), where("status", "==", "submitted"));
      } else {
        plansQ = query(collection(db, "plans"), where("branchId", "==", profile.branchId), where("status", "==", "submitted"));
        reportsQ = query(collection(db, "reports"), where("branchId", "==", profile.branchId), where("status", "==", "submitted"));
      }
      
      const [pSnap, rSnap] = await Promise.all([getDocs(plansQ), getDocs(reportsQ)]);
      
      const dedupeList = <T extends { id?: string }>(list: T[]): T[] => {
        const seen = new Set<string>();
        return list.filter(item => {
          if (!item.id || seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
      };

      const allItems: any[] = dedupeList([
        ...pSnap.docs.map(d => ({ id: d.id, type: 'Plan', ...d.data() })),
        ...rSnap.docs.map(d => ({ id: d.id, type: 'Report', ...d.data() }))
      ]).sort((a: any, b: any) => (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0));
      
      setItems(allItems);
      setLoading(false);
    };
    fetchQueue();
  }, [profile.branchId, profile.role]);

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (!selectedItem) return;
    
    try {
      const collectionName = selectedItem.type.toLowerCase() + 's';
      const updateData = cleanForFirestore({
        status,
        reviewedBy: profile.uid,
        reviewedAt: serverTimestamp(),
        comment: reviewComment || ''
      });
      await updateDoc(doc(db, collectionName, selectedItem.id), updateData);

      // Audit Log
      const auditData = cleanForFirestore({
        action: `${status.toUpperCase()}_${selectedItem.type.toUpperCase()}`,
        actorId: profile.uid,
        targetId: selectedItem.id,
        timestamp: serverTimestamp()
      });
      await addDoc(collection(db, "auditLogs"), auditData).catch(() => null);
      
      setItems(items.filter(i => i.id !== selectedItem.id));
      setSelectedItem(null);
      setReviewComment('');
    } catch (err) {
      console.error("handleReview error:", err);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* List Panel */}
      <div className="lg:col-span-1 space-y-6">
        <div>
          <h1 className="text-2xl font-black text-primary tracking-tight">Review Queue</h1>
          <p className="text-slate-500 font-medium text-xs mt-0.5">Pending Activity Approvals</p>
        </div>

        <div className="space-y-3">
          {items.map((item, idx) => (
            <div 
              key={`review-${item.type}-${item.id || 'item'}-${idx}`} 
              onClick={() => setSelectedItem(item)}
              className={cn(
                "card-premium p-4 cursor-pointer transition-all border-l-4",
                selectedItem?.id === item.id ? "border-accent ring-2 ring-accent/10" : "border-slate-200 hover:border-accent/50"
              )}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.type}</span>
                <StatusChip status={item.status} />
              </div>
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-slate-400" />
                <span className="font-bold text-sm text-primary">{item.staffId}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Calendar className="w-3 h-3" />
                {item.createdAt?.toDate().toLocaleDateString()}
              </div>
            </div>
          ))}

          {items.length === 0 && !loading && (
            <div className="py-20 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-100" />
              <p className="font-bold text-sm uppercase tracking-widest text-slate-300">No pending reviews</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      <div className="lg:col-span-2">
        {selectedItem ? (
          <div className="card-premium space-y-8 animate-in fade-in slide-in-from-right-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-6">
              <div>
                <h2 className="text-2xl font-extrabold text-primary">{selectedItem.type} Details</h2>
                <p className="text-slate-500 text-sm">Submitted by {selectedItem.staffId}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleReview('rejected')} className="px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg transition-all flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
                <button onClick={() => handleReview('approved')} className="px-6 py-2 text-sm font-bold bg-green-600 text-white hover:bg-green-700 rounded-lg shadow-lg shadow-green-200 transition-all flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Approve
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">KPI / Activity</span>
                <p className="font-bold text-primary">{selectedItem.kpiId || selectedItem.type}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target Period</span>
                <p className="font-bold text-primary">{selectedItem.period || 'N/A'}</p>
              </div>
              {selectedItem.actualValue && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reported Value</span>
                  <p className="text-2xl font-black text-accent">{selectedItem.actualValue}</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Manager Comments</span>
              <textarea 
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Add feedback or reasons for rejection..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none focus:ring-2 focus:ring-accent/50 min-h-[100px]"
              />
            </div>
          </div>
        ) : (
          <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            <MessageSquare className="w-12 h-12 text-slate-200 mb-4" />
            <h3 className="text-slate-400 font-bold uppercase tracking-widest">Select an item to review</h3>
            <p className="text-slate-400 text-xs mt-2">Choose a plan or report from the left sidebar to begin inspection.</p>
          </div>
        )}
      </div>
    </div>
  );
};
