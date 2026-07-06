import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc as firestoreDoc, 
  getDoc as firestoreGetDoc, 
  collection as firestoreCollection, 
  query as firestoreQuery, 
  where as firestoreWhere, 
  orderBy as firestoreOrderBy, 
  getDocs as firestoreGetDocs, 
  runTransaction as firestoreRunTransaction, 
  serverTimestamp as firestoreServerTimestamp,
  setDoc as firestoreSetDoc,
  updateDoc as firestoreUpdateDoc
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Custom Auth Mock to bridge the existing session UI seamlessly
class AuthMock {
  private _user: any = null;

  get currentUser() {
    if (this._user && typeof this._user === 'object' && !this._user.getIdToken) {
      this._user.getIdToken = async () => 'mock-token-' + (this._user.uid || 'anon');
    }
    return this._user;
  }

  set currentUser(val: any) {
    if (val && typeof val === 'object' && !val.getIdToken) {
      val.getIdToken = async () => 'mock-token-' + (val.uid || 'anon');
    }
    this._user = val;
  }
}

export const auth = new AuthMock();

const authListeners: ((user: any) => void)[] = [];

// Mock Auth SDK Functions matching the expected interface
export function onAuthStateChanged(authInstance: any, callback: (user: any) => void) {
  authListeners.push(callback);
  
  const savedUserJson = localStorage.getItem('form_collect_user');
  if (savedUserJson) {
    try {
      const savedUser = JSON.parse(savedUserJson);
      auth.currentUser = savedUser;
      callback(savedUser);
    } catch {
      callback(null);
    }
  } else {
    callback(null);
  }

  return () => {
    const idx = authListeners.indexOf(callback);
    if (idx !== -1) authListeners.splice(idx, 1);
  };
}

export async function signOut(authInstance: any) {
  localStorage.removeItem('form_collect_user');
  auth.currentUser = null;
  authListeners.forEach(cb => cb(null));
}

export async function signInWithCustomToken(authInstance: any, customToken: string) {
  try {
    const profile = JSON.parse(customToken);
    localStorage.setItem('form_collect_user', JSON.stringify(profile));
    auth.currentUser = profile;
    authListeners.forEach(cb => cb(profile));
    return { user: profile };
  } catch (err) {
    throw new Error('Invalid login token session.');
  }
}

// Firestore Error Handler Wrapper matching the Skill specifications
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
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

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: true,
      isAnonymous: false,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Re-export original functions
export const doc = firestoreDoc;
export const collection = firestoreCollection;
export const query = firestoreQuery;
export const where = firestoreWhere;
export const orderBy = firestoreOrderBy;
export const serverTimestamp = firestoreServerTimestamp;

// Wrapped Firestore read/write operations to inject the mandatory error handlers
export async function getDoc(docRef: any) {
  try {
    return await firestoreGetDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, docRef?.path || null);
    throw err;
  }
}

export async function getDocs(queryObj: any) {
  try {
    return await firestoreGetDocs(queryObj);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, queryObj?.path || null);
    throw err;
  }
}

export async function setDoc(docRef: any, data: any, options?: any) {
  try {
    if (options) {
      return await firestoreSetDoc(docRef, data, options);
    }
    return await firestoreSetDoc(docRef, data);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, docRef?.path || null);
    throw err;
  }
}

export async function updateDoc(docRef: any, data: any) {
  try {
    return await firestoreUpdateDoc(docRef, data);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, docRef?.path || null);
    throw err;
  }
}

export async function runTransaction(dbInstance: any, callback: (transaction: any) => Promise<any>) {
  try {
    return await firestoreRunTransaction(dbInstance, callback);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'transaction');
    throw err;
  }
}

const defaultApp = { name: 'real-firebase' };
export default defaultApp;
