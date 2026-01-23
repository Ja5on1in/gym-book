
import { initializeApp, getApp, getApps, deleteApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  signInWithPopup, 
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { getFirestore, doc, setDoc, deleteDoc, collection, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';
import { User } from '../types';

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
let appId = 'gympohai-app';
let isFirebaseAvailable = false;
const googleProvider = new GoogleAuthProvider();

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
  // Main App Instance
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  isFirebaseAvailable = true;
  console.log("Firebase initialized successfully");
} catch (error) {
  console.warn("Firebase initialization failed. Running in offline/demo mode.", error);
  isFirebaseAvailable = false;
}

export { auth, db, appId, isFirebaseAvailable };

// --- Auth Functions ---

export const loginWithEmail = async (email: string, pass: string) => {
  if (!isFirebaseAvailable) return null;
  try {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    return result.user;
  } catch (error) {
    console.error("Email Login failed", error);
    throw error;
  }
};

export const loginWithGoogle = async () => {
  if (!isFirebaseAvailable) return null;
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Google Login failed", error);
    throw error;
  }
};

export const logout = async () => {
  if (!isFirebaseAvailable) return;
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout failed", error);
  }
};

/**
 * Creates a new user in Firebase Auth using a Secondary App instance.
 */
export const createAuthUser = async (email: string, pass: string) => {
    if (!isFirebaseAvailable) return `mock-uid-${Date.now()}`;
    
    const secondaryAppName = `secondaryAuthApp-${Date.now()}`;
    const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
        const uid = userCredential.user.uid;
        await signOut(secondaryAuth);
        await deleteApp(secondaryApp);
        return uid;
    } catch (error) {
        console.error("Failed to create auth user", error);
        try { await deleteApp(secondaryApp); } catch(e) {}
        throw error;
    }
};

// Fetch user profile from 'users' collection using UID
export const getUserProfile = async (uid: string): Promise<User | null> => {
  if (!isFirebaseAvailable || !db) return null;
  try {
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() } as User;
    }
    return null;
  } catch (error) {
    console.error("Error fetching user profile", error);
    return null;
  }
};

// --- wrappers ---
export const initAuth = async () => {
  if (!isFirebaseAvailable || !auth) return;
};

export const subscribeToCollection = (
    colName: string, 
    callback: (data: any[]) => void,
    errorCallback: (e: any) => void
) => {
    if (!isFirebaseAvailable || !db) {
        // Fallback to LocalStorage
        const key = `mock_db_${colName}`;
        setTimeout(() => {
            const current = JSON.parse(localStorage.getItem(key) || '[]');
            callback(current);
        }, 0);

        if (!mockListeners[colName]) mockListeners[colName] = [];
        mockListeners[colName].push(callback);

        return () => {
             if (mockListeners[colName]) {
                 mockListeners[colName] = mockListeners[colName].filter(cb => cb !== callback);
             }
        };
    }
    
    // Returns the unsubscribe function directly
    return onSnapshot(collection(db, colName), (s: any) => {
        const docs = s.docs.map((d: any) => d.data());
        callback(docs);
    }, (e: any) => {
        console.warn(`Firestore subscription to ${colName} failed`, e);
        errorCallback(e);
    });
};

// Upsert (Set with merge) - Safe for creating or overwriting
export const saveToFirestore = async (col: string, id: string, data: any) => {
    if (!isFirebaseAvailable || !db) {
        const key = `mock_db_${col}`;
        const current = JSON.parse(localStorage.getItem(key) || '[]');
        const idx = current.findIndex((item: any) => item.id === id);
        if (idx >= 0) current[idx] = { ...current[idx], ...data, id };
        else current.push({ ...data, id });
        localStorage.setItem(key, JSON.stringify(current));
        notifyMockListeners(col);
        return;
    }
    try {
        await setDoc(doc(db, col, id), data, { merge: true });
    } catch (e) {
        console.error(`Firestore save failed to ${col}/${id}`, e);
        throw e;
    }
};

// Partial Update (Fails if doc doesn't exist) - Use for status updates
export const updateDocument = async (col: string, id: string, data: any) => {
    if (!isFirebaseAvailable || !db) {
        return saveToFirestore(col, id, data); // Fallback to save for local
    }
    try {
        await updateDoc(doc(db, col, id), data);
    } catch (e) {
        console.error(`Firestore update failed for ${col}/${id}`, e);
        throw e;
    }
};

export const deleteFromFirestore = async (col: string, id: string) => {
    if (!isFirebaseAvailable || !db) {
        const key = `mock_db_${col}`;
        const current = JSON.parse(localStorage.getItem(key) || '[]');
        const filtered = current.filter((item: any) => item.id !== id);
        localStorage.setItem(key, JSON.stringify(filtered));
        notifyMockListeners(col);
        return;
    }
    try {
        await deleteDoc(doc(db, col, id));
    } catch (e) {
        console.error("Firestore delete failed", e);
        throw e;
    }
};

// Soft delete / Update status
export const disableUserInFirestore = async (uid: string) => {
    if (!isFirebaseAvailable || !db) return;
    try {
        await updateDoc(doc(db, 'users', uid), { status: 'disabled' });
    } catch (e) {
        console.error("Disable user failed", e);
        throw e;
    }
};
