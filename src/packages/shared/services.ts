import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  Timestamp,
  serverTimestamp,
  runTransaction
} from "firebase/firestore";
import { db, cleanForFirestore } from "./firebase";

// --- Types ---
export type UserRole = 'Super Admin' | 'District Director' | 'Branch Manager' | 'Branch Staff';
export type EntityStatus = 'active' | 'disabled';
export type RequestStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface UserProfile {
  uid: string;
  fullName: string;
  username: string;
  role: UserRole;
  districtId?: string;
  branchId?: string;
  positionId?: string;
  phone?: string;
  email: string;
  photoUrl?: string;
  status: EntityStatus;
  mustChangePassword: boolean;
  profileCompleted: boolean;
  createdAt: any;
}

// --- Service Layer ---

export const UserService = {
  async getProfile(uid: string): Promise<UserProfile | null> {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() as UserProfile : null;
  },

  async createUser(profile: Partial<UserProfile>) {
    const docRef = doc(db, "users", profile.uid!);
    const userData = cleanForFirestore({
      ...profile,
      status: 'active',
      profileCompleted: false,
      mustChangePassword: true,
      createdAt: serverTimestamp(),
    });
    await setDoc(docRef, userData);
  },

  async updateProfile(uid: string, data: Partial<UserProfile>) {
    const docRef = doc(db, "users", uid);
    const cleanData = cleanForFirestore(data);
    await setDoc(docRef, cleanData, { merge: true });
  }
};

export const KPIService = {
  async getAll() {
    const colRef = collection(db, "kpis");
    const snap = await getDocs(colRef);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
};

export const TargetService = {
  async getByOwner(ownerId: string, period: string) {
    const q = query(
      collection(db, "targets"), 
      where("ownerId", "==", ownerId),
      where("period", "==", period)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async setTarget(target: any) {
    const docRef = doc(collection(db, "targets"));
    const cleanTarget = cleanForFirestore({
      ...target,
      createdAt: serverTimestamp()
    });
    await setDoc(docRef, cleanTarget);
  }
};

export const ReportService = {
  async submitReport(report: any) {
    const docRef = doc(collection(db, "reports"));
    const cleanReport = cleanForFirestore({
      ...report,
      status: 'submitted',
      createdAt: serverTimestamp()
    });
    await setDoc(docRef, cleanReport);
  },

  async getReviewQueue(branchId: string) {
    const q = query(
      collection(db, "reports"),
      where("branchId", "==", branchId),
      where("status", "==", "submitted")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
};

export const AuditService = {
  async logAction(action: string, targetId: string, before?: any, after?: any) {
    const logRef = doc(collection(db, "auditLogs"));
    const cleanLog = cleanForFirestore({
      action,
      targetId,
      before: before || null,
      after: after || null,
      timestamp: serverTimestamp()
    });
    await setDoc(logRef, cleanLog);
  }
};
