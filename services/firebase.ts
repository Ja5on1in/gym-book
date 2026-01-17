import * as firebaseApp from 'firebase/app';
import * as firebaseAuth from 'firebase/auth';
import * as firebaseFirestore from 'firebase/firestore';

// Cast to any to avoid TypeScript errors if the environment has mismatched types (e.g. v8 vs v9)
const { initializeApp } = firebaseApp as any;
const { 
  getAuth, 
  signInWithCustomToken, 
  signInAnonymously, 
  onAuthStateChanged 
} = firebaseAuth as any;
const { 
  getFirestore, 
  doc, 
  setDoc, 
  deleteDoc, 
  collection, 
  onSnapshot 
} = firebaseFirestore as any;

// Define globals that might be injected
declare global {
  interface Window {
    __firebase_config?: string;
    __app_id?: string;
    __initial_auth_token?: string;
  }
}

let auth: any = null;
let db: any = null;
let appId = 'default-app-id';
let isFirebaseAvailable = false;

// Mock listener system for local storage events
const mockListeners: Record<string, ((data: any[]) => void)[]> = {};

const notifyMockListeners = (colName: string) => {
    if (mockListeners[colName]) {
        const key = `mock_db_${colName}`;
        const data = JSON.parse(localStorage.getItem(key) || '[]');
        mockListeners[colName].forEach(cb => cb(data));
    }
};

try {
  // Check for injected config, otherwise use a dummy config to prevent crash
  // In a real scenario, you would have your config in env vars
  const rawConfig = typeof window !== 'undefined' && window.__firebase_config 
    ? window.__firebase_config 
    : JSON.stringify({
        apiKey: "dummy",
        authDomain: "dummy.firebaseapp.com",
        projectId: "dummy",
        storageBucket: "dummy.appspot.com",
        messagingSenderId: "000000000",
        appId: "1:000000000:web:00000000"
      });

  const firebaseConfig = JSON.parse(rawConfig);
  
  // Only init if we have a somewhat valid config structure to avoid immediate throw
  // Also check if initializeApp is actually available
  if (firebaseConfig.apiKey !== 'dummy' && initializeApp) {
    const app = initializeApp(firebaseConfig);
    auth = getAuth ? getAuth(app) : null;
    db = getFirestore ? getFirestore(app) : null;
    isFirebaseAvailable = !!(auth && db);
  } else {
    isFirebaseAvailable = false;
  }
  
  if (typeof window !== 'undefined' && window.__app_id) {
    appId = window.__app_id;
  }
} catch (error) {
  console.warn("Firebase initialization failed. Running in offline/demo mode.", error);
  isFirebaseAvailable = false;
}

export { auth, db, appId, isFirebaseAvailable };

// --- Wrappers ---
export const initAuth = async () => {
  if (!isFirebaseAvailable || !auth) {
      console.log("Running in offline mode (Auth mocked)");
      return;
  }
  try { 
    if (typeof window !== 'undefined' && window.__initial_auth_token) {
        if (signInWithCustomToken) await signInWithCustomToken(auth, window.__initial_auth_token); 
    } else {
        if (signInAnonymously) await signInAnonymously(auth); 
    }
  } 
  catch (error) { 
    console.error("Auth Failed", error); 
    // Don't throw, just let it fail gracefully to offline mode if possible
    isFirebaseAvailable = false; 
  }
};

export const subscribeToCollection = (
    colName: string, 
    callback: (data: any[]) => void,
    errorCallback: (e: any) => void
) => {
    if (!isFirebaseAvailable || !db || !onSnapshot || !collection) {
        // Fallback to LocalStorage
        const key = `mock_db_${colName}`;
        
        // Initial fetch
        setTimeout(() => {
            const current = JSON.parse(localStorage.getItem(key) || '[]');
            callback(current);
        }, 0);

        // Register listener
        if (!mockListeners[colName]) mockListeners[colName] = [];
        mockListeners[colName].push(callback);

        // Unsubscribe function
        return () => {
             if (mockListeners[colName]) {
                 mockListeners[colName] = mockListeners[colName].filter(cb => cb !== callback);
             }
        };
    }
    
    // Using the path structure from the original code
    return onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', colName), (s: any) => {
        const docs = s.docs.map((d: any) => d.data());
        callback(docs);
    }, (e: any) => {
        console.warn("Firestore subscription failed, switching to offline mode", e);
        // Attempt to switch to offline mode dynamically if connection fails? 
        // For now, just trigger error callback
        errorCallback(e);
    });
};

export const saveToFirestore = async (col: string, id: string, data: any) => {
    if (!isFirebaseAvailable || !db || !setDoc || !doc) {
        // Mock Save
        const key = `mock_db_${col}`;
        const current = JSON.parse(localStorage.getItem(key) || '[]');
        const idx = current.findIndex((item: any) => item.id === id);
        
        if (idx >= 0) {
            current[idx] = data;
        } else {
            current.push(data);
        }
        
        localStorage.setItem(key, JSON.stringify(current));
        notifyMockListeners(col);
        return;
    }
    try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', col, id), data);
    } catch (e) {
        console.error("Firestore save failed", e);
        // Optional: fallback to local storage on error?
    }
};

export const deleteFromFirestore = async (col: string, id: string) => {
    if (!isFirebaseAvailable || !db || !deleteDoc || !doc) {
        // Mock Delete
        const key = `mock_db_${col}`;
        const current = JSON.parse(localStorage.getItem(key) || '[]');
        const filtered = current.filter((item: any) => item.id !== id);
        
        localStorage.setItem(key, JSON.stringify(filtered));
        notifyMockListeners(col);
        return;
    }
    try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', col, id));
    } catch (e) {
        console.error("Firestore delete failed", e);
    }
};