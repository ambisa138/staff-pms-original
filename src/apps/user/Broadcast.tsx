import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, cleanForFirestore, handleFirestoreError, OperationType } from '../../packages/shared/firebase';
import { UserProfile } from '../../packages/shared/services';
import { Bell, Send, Users, Building, Target, MessageSquare } from 'lucide-react';
import { StatusChip, cn } from '../../packages/shared/components/UI';

export const Broadcast = ({ profile }: { profile: UserProfile }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [audience, setAudience] = useState('All');
  const [messageBody, setMessageBody] = useState('');
  const [messageTitle, setMessageTitle] = useState('');

  const fetchMessages = async () => {
    try {
      const q = query(
        collection(db, "notifications"), 
        where("senderId", "==", profile.uid)
      );
      const snap = await getDocs(q);
      setMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err: any) {
      console.warn("fetchMessages error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [profile.uid]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageTitle || !messageBody) return;

    try {
      const notificationData = cleanForFirestore({
        senderId: profile.uid,
        audience: audience || 'All',
        title: messageTitle.trim(),
        body: messageBody.trim(),
        createdAt: serverTimestamp(),
      });
      await addDoc(collection(db, "notifications"), notificationData);
      setMessageTitle('');
      setMessageBody('');
      fetchMessages();
    } catch (err) {
      console.error("handleSend error:", err);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left: Composer */}
      <div className="lg:col-span-1 space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold text-primary tracking-tight">Broadcast</h1>
          <p className="text-slate-500 font-medium">Send announcements to your teams</p>
        </div>

        <form onSubmit={handleSend} className="card-premium space-y-5">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Target Audience</label>
            <div className="grid grid-cols-3 gap-2">
              {['All', 'Managers', 'Staff'].map(opt => (
                <button 
                  key={opt}
                  type="button"
                  onClick={() => setAudience(opt)}
                  className={cn(
                    "py-2 text-[10px] font-black uppercase rounded-lg border transition-all",
                    audience === opt ? "bg-accent text-white border-accent" : "bg-slate-50 text-slate-400 border-slate-100 hover:border-slate-200"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Subject</label>
            <input 
              value={messageTitle}
              onChange={(e) => setMessageTitle(e.target.value)}
              required 
              className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-accent/50 text-sm font-bold" 
              placeholder="e.g. End of Month Target Reminder"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Message Body</label>
            <textarea 
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              required 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none focus:ring-2 focus:ring-accent/50 min-h-[150px]"
              placeholder="Type your announcement here..."
            />
          </div>

          <button type="submit" className="w-full btn-primary py-3">
            <Send className="w-4 h-4" />
            Send Broadcast
          </button>
        </form>
      </div>

      {/* Right: History */}
      <div className="lg:col-span-2 space-y-6">
        <h2 className="text-xl font-extrabold text-primary flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-accent" />
          Sent Announcements
        </h2>

        <div className="space-y-4">
          {messages.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()).map((msg, idx) => (
            <div key={`msg-${msg.id || 'msg'}-${idx}`} className="card-premium relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-accent opacity-50" />
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-accent uppercase tracking-tighter bg-accent/10 px-2 py-0.5 rounded">
                    To: {msg.audience}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">
                    {msg.createdAt?.toDate().toLocaleString()}
                  </span>
                </div>
              </div>
              <h3 className="font-bold text-primary mb-1">{msg.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{msg.body}</p>
            </div>
          ))}

          {messages.length === 0 && !loading && (
            <div className="py-20 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
              <Bell className="w-12 h-12 mx-auto mb-4 text-slate-100" />
              <p className="font-bold text-sm uppercase tracking-widest text-slate-300">No sent messages</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
