import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, getDocFromServer } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";
import firebaseConfig from "../../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function cleanForFirestore<T extends Record<string, any>>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanForFirestore(item)) as any;
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = (typeof value === 'object' && value !== null && !(value instanceof Date) && !('toMillis' in value))
        ? cleanForFirestore(value)
        : value;
    }
  }
  return clean as T;
}

export const getMessagingInstance = async () => {
  try {
    if (typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator) {
      const supported = await isSupported().catch(() => false);
      if (supported) {
        return getMessaging(app);
      }
    }
  } catch (err) {
    console.warn("FCM Messaging not supported in this environment", err);
  }
  return null;
};

export async function testFirebaseConnection() {
  try {
    // Testing connection as per skill instructions
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { success: true, message: "Firestore connected successfully" };
  } catch (error: any) {
    if (error?.message?.includes('the client is offline')) {
      return { success: false, message: "Firebase client is offline. Check configuration." };
    }
    // Permission denied is actually a good sign that we reached the server
    if (error?.code === 'permission-denied') {
      return { success: true, message: "Firestore reachable (Permission Denied as expected)" };
    }
    return { success: false, message: error?.message || "Unknown Firebase error" };
  }
}
