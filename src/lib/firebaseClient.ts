// Mock Auth and Firestore SDK Bridge
// Exposes the exact same interface as the Firebase SDK, but routes calls to our local file database server.

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

export const db = {
  type: 'mock-db'
};

const authListeners: ((user: any) => void)[] = [];

// Mock Auth SDK Functions
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

// Mock Firestore Builders
export function collection(dbInstance: any, collectionName: string) {
  return { type: 'collection', name: collectionName };
}

export function doc(dbOrRef: any, pathOrId?: string, docId?: string) {
  if (pathOrId === undefined && docId === undefined) {
    // doc(collectionRef) -> 1 argument
    return {
      type: 'doc',
      collection: dbOrRef.name || 'default',
      id: Math.random().toString(36).substring(2, 15)
    };
  }
  if (docId === undefined) {
    // doc(collectionRef, id) OR doc(db, collectionName) -> 2 arguments
    if (dbOrRef.type === 'collection') {
      return {
        type: 'doc',
        collection: dbOrRef.name,
        id: pathOrId
      };
    }
    return {
      type: 'doc',
      collection: pathOrId,
      id: Math.random().toString(36).substring(2, 15)
    };
  }
  // doc(db, collectionName, docId) -> 3 arguments
  return {
    type: 'doc',
    collection: pathOrId,
    id: docId
  };
}

export function query(ref: any, ...constraints: any[]) {
  return {
    type: 'query',
    collection: ref.name,
    where: constraints.filter(c => c.type === 'where'),
    orderBy: constraints.filter(c => c.type === 'orderBy')
  };
}

export function where(field: string, op: string, value: any) {
  return { type: 'where', field, op, value };
}

export function orderBy(field: string, dir: string = 'asc') {
  return { type: 'orderBy', field, dir };
}

export function serverTimestamp() {
  return new Date().toISOString();
}

// Mock Firestore Queries
export async function getDocs(queryObj: any) {
  const collectionName = queryObj.type === 'query' ? queryObj.collection : queryObj.name;
  const whereClauses = queryObj.type === 'query' ? queryObj.where : [];
  const orderByClauses = queryObj.type === 'query' ? queryObj.orderBy : [];

  const res = await fetch('/api/firestore/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collection: collectionName, where: whereClauses, orderBy: orderByClauses })
  });

  if (!res.ok) {
    throw new Error('Failed to retrieve database records.');
  }
  
  const data = await res.json();
  
  return {
    forEach: (callback: (doc: any) => void) => {
      data.forEach((item: any) => {
        callback({
          data: () => item,
          id: item.id
        });
      });
    },
    docs: data.map((item: any) => ({
      data: () => item,
      id: item.id
    }))
  };
}

export async function getDoc(docRef: any) {
  const res = await fetch(`/api/firestore/${docRef.collection}/${docRef.id}`);
  if (!res.ok) {
    return { exists: () => false, data: () => null };
  }
  const data = await res.json();
  return {
    exists: () => data !== null,
    data: () => data,
    id: docRef.id
  };
}

export async function runTransaction(dbInstance: any, callback: (transaction: any) => Promise<any>) {
  const operations: any[] = [];
  const transactionMock = {
    get: async (docRef: any) => {
      const snap = await getDoc(docRef);
      return snap;
    },
    set: (docRef: any, data: any, options?: any) => {
      operations.push({ type: 'set', docRef, data, options });
    },
    update: (docRef: any, data: any) => {
      operations.push({ type: 'update', docRef, data });
    },
    delete: (docRef: any) => {
      operations.push({ type: 'delete', docRef });
    }
  };

  await callback(transactionMock);

  const res = await fetch('/api/firestore/transaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operations })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Transaction execution failed.');
  }

  return await res.json();
}

const defaultApp = { name: 'mock-app' };
export default defaultApp;
