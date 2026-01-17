import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, setDoc, deleteDoc, collection, onSnapshot } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCsVDhrTe8KoDh8BM1tBkyztDpggJ1cROA",
  authDomain: "gympohai.firebaseapp.com",
  projectId: "gympohai",
  storageBucket: "gympohai.firebasestorage.app",
  messagingSenderId: "847545608993",
  appId: "1:847545608993:web:358cccf2857c9f2550ec60"
};

let auth: any = null;
let db: any = null;
let appId = 'gympohai-app'; // Default ID, no longer used for pathing but kept for compatibility
let isFirebaseAvailable = false;

// Mock listener system for local storage events (Fallback)
const mockListeners: Record<string, ((data: any[]) => void)[]> = {};

const notifyMockListeners = (colName: string) => {
    if (mockListeners[colName]) {
        const key = `mock_db_${colName}`;
        const data = JSON.parse(localStorage.getItem(key) || '[]');
        mockListeners[colName].forEach(cb => cb(data));
    }
};

try {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  isFirebaseAvailable = true;
  console.log("Firebase initialized successfully");
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
      // Simple anonymous auth to allow reading/writing if rules allow
      await signInAnonymously(auth); 
  } 
  catch (error) { 
    console.error("Auth Failed", error); 
    // Don't throw, just let it fail gracefully to offline mode if possible
    // isFirebaseAvailable = false; 
  }
};

export const subscribeToCollection = (
    colName: string, 
    callback: (data: any[]) => void,
    errorCallback: (e: any) => void
) => {
    if (!isFirebaseAvailable || !db) {
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
    
    // Subscribe to root collection
    return onSnapshot(collection(db, colName), (s: any) => {
        const docs = s.docs.map((d: any) => d.data());
        callback(docs);
    }, (e: any) => {
        console.warn("Firestore subscription failed, switching to offline mode", e);
        errorCallback(e);
    });
};

export const saveToFirestore = async (col: string, id: string, data: any) => {
    if (!isFirebaseAvailable || !db) {
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
        // Save to root collection
        await setDoc(doc(db, col, id), data);
    } catch (e) {
        console.error("Firestore save failed", e);
    }
};

export const deleteFromFirestore = async (col: string, id: string) => {
    if (!isFirebaseAvailable || !db) {
        // Mock Delete
        const key = `mock_db_${col}`;
        const current = JSON.parse(localStorage.getItem(key) || '[]');
        const filtered = current.filter((item: any) => item.id !== id);
        
        localStorage.setItem(key, JSON.stringify(filtered));
        notifyMockListeners(col);
        return;
    }
    try {
        // Delete from root collection
        await deleteDoc(doc(db, col, id));
    } catch (e) {
        console.error("Firestore delete failed", e);
    }
};