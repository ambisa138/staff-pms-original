import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db, cleanForFirestore } from '../../packages/shared/firebase';
import { UserProfile } from '../../packages/shared/services';
import { Bell, Check, CheckCheck, Clock, MessageSquare, AlertCircle, Sparkles, Filter } from 'lucide-react';
import { cn } from '../../packages/shared/components/UI';

export const NotificationCenter = ({ profile }: { profile: UserProfile }) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    fetchNotifications();
  }, [profile.uid, profile.role]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const [notifsSnap, receiptsSnap] = await Promise.all([
        getDocs(query(collection(db, "notifications"), orderBy("createdAt", "desc"))),
        getDocs(query(collection(db, "notificationReceipts"), where("userId", "==", profile.uid)))
      ]);

      const readNotifIds = receiptsSnap.docs.map(doc => (doc.data() as any).notificationId);
      setReceipts(readNotifIds);

      const allNotifs: any[] = notifsSnap.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any),
        isRead: readNotifIds.includes(doc.id)
      }));

      // Filter by audience
      const relevantNotifs = allNotifs.filter(n => {
        if (!n.audience || n.audience === 'All') return true;
        if (n.audience === 'Managers' && (profile.role === 'Branch Manager' || profile.role === 'District Director' || profile.role === 'Super Admin')) return true;
        if (n.audience === 'Staff' && profile.role === 'Branch Staff') return true;
        return false;
      });

      setNotifications(relevantNotifs);
    } catch (err) {
      console.warn("fetchNotifications error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    if (receipts.includes(notificationId)) return;
    try {
      const receiptData = cleanForFirestore({
        userId: profile.uid,
        notificationId,
        readAt: serverTimestamp()
      });
      await addDoc(collection(db, "notificationReceipts"), receiptData);
      setReceipts(prev => [...prev, notificationId]);
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error("handleMarkAsRead error:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadNotifs = notifications.filter(n => !n.isRead);
    for (const notif of unreadNotifs) {
      await handleMarkAsRead(notif.id);
    }
  };

  const filteredNotifications = notifications.filter(n => filter === 'all' || !n.isRead);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-primary tracking-tight flex items-center gap-3">
            <Bell className="w-8 h-8 text-accent" />
            Notification Center
          </h1>
          <p className="text-slate-500 font-medium">
            System announcements, targets updates, and operational broadcasts
          </p>
        </div>

        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button 
              onClick={handleMarkAllAsRead}
              className="btn-secondary text-xs py-2.5 px-4 flex items-center gap-2"
            >
              <CheckCheck className="w-4 h-4 text-accent" />
              Mark All as Read ({unreadCount})
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button 
          onClick={() => setFilter('all')}
          className={cn(
            "px-4 py-2 rounded-lg text-xs font-bold transition-all",
            filter === 'all' ? "bg-primary text-white" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
          )}
        >
          All Notifications ({notifications.length})
        </button>
        <button 
          onClick={() => setFilter('unread')}
          className={cn(
            "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
            filter === 'unread' ? "bg-accent text-white" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
          )}
        >
          Unread
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black ml-1">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Notification List */}
      <div className="space-y-4">
        {filteredNotifications.map((notif, idx) => (
          <div 
            key={`notif-${notif.id || 'notif'}-${idx}`} 
            className={cn(
              "card-premium relative overflow-hidden p-6 transition-all border-l-4",
              notif.isRead 
                ? "border-slate-200 bg-white" 
                : "border-accent bg-gradient-to-r from-accent/5 to-white shadow-md"
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                  notif.isRead ? "bg-slate-100 text-slate-400" : "bg-accent text-white"
                )}>
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      To: {notif.audience || 'All'}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      {notif.createdAt?.toDate ? notif.createdAt.toDate().toLocaleString() : 'Recent'}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-primary text-base mb-1.5">{notif.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">{notif.body}</p>
                </div>
              </div>

              {!notif.isRead ? (
                <button 
                  onClick={() => handleMarkAsRead(notif.id)}
                  className="shrink-0 text-xs font-bold text-accent hover:bg-accent/10 px-3 py-1.5 rounded-lg border border-accent/20 transition-all flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  Mark Read
                </button>
              ) : (
                <span className="shrink-0 text-[10px] font-bold text-slate-300 uppercase flex items-center gap-1">
                  <CheckCheck className="w-3.5 h-3.5 text-slate-300" />
                  Read
                </span>
              )}
            </div>
          </div>
        ))}

        {filteredNotifications.length === 0 && !loading && (
          <div className="py-20 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
            <Bell className="w-12 h-12 mx-auto mb-4 text-slate-200" />
            <p className="font-bold text-sm uppercase tracking-widest text-slate-400">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications found'}
            </p>
            <p className="text-slate-400 text-xs mt-1">
              You are all caught up with announcements and performance updates.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
