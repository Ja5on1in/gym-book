
import { useState, useEffect, useCallback } from 'react';
import { liff } from "@line/liff";
import { auth, getUserProfile, loginWithEmail, logout as firebaseLogout, saveToFirestore, isFirebaseAvailable } from '../services/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { User, UserInventory } from '../types';

const LIFF_ID = "2008923061-bPeQysat";

interface UseAuthProps {
  addLog: (action: string, details: string) => void;
  showNotification: (msg: string, type?: 'success' | 'error' | 'info') => void;
  inventories: UserInventory[];
  onLiffReady: (view: 'booking' | 'my-bookings') => void;
}

export const useAuth = ({ addLog, showNotification, inventories, onLiffReady }: UseAuthProps) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [liffProfile, setLiffProfile] = useState<{ userId: string; displayName: string } | null>(null);

  const checkAndCreateUser = useCallback(async (profile: { userId: string, displayName: string }) => {
    const existingUser = inventories.find(inv => inv.lineUserId === profile.userId);
    if (!existingUser) {
      const newUser: UserInventory = {
        id: profile.userId,
        lineUserId: profile.userId,
        name: profile.displayName,
        phone: '',
        email: '',
        credits: { private: 0, group: 0 },
        lastUpdated: new Date().toISOString()
      };
      await saveToFirestore('user_inventory', newUser.id, newUser);
      addLog('新用戶註冊', `LINE 用戶 ${profile.displayName} (${profile.userId}) 首次登入，自動建立庫存資料。`);
      showNotification(`歡迎 ${profile.displayName}！已為您建立帳戶`, 'success');
    }
  }, [inventories, addLog, showNotification]);

  useEffect(() => {
    const initializeLiff = async () => {
      try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) {
          setIsAuthLoading(false);
        } else {
          const profile = await liff.getProfile();
          setLiffProfile({ userId: profile.userId, displayName: profile.displayName });
          await checkAndCreateUser({ userId: profile.userId, displayName: profile.displayName });

          const urlParams = new URLSearchParams(window.location.search);
          const mode = urlParams.get('mode');
          if (mode === 'my-bookings') {
            onLiffReady('my-bookings');
          } else {
            onLiffReady('booking');
          }
        }
      } catch (e) {
        console.error('LIFF init failed.', e);
        showNotification('LINE 登入初始化失敗', 'error');
      } finally {
        setIsAuthLoading(false);
      }
    };

    if (isFirebaseAvailable) {
      const unsubscribe = onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
        if (user) {
          const profile = await getUserProfile(user.uid);
          if (profile && profile.status !== 'disabled') {
            setCurrentUser(profile);
          } else {
            if (profile?.status === 'disabled') showNotification('此帳號已被停用', 'error');
            await firebaseLogout();
            setCurrentUser(null);
          }
          setIsAuthLoading(false); 
        } else {
          setCurrentUser(null);
          initializeLiff(); 
        }
      });
      return () => unsubscribe();
    } else {
      setCurrentUser(null);
      initializeLiff();
    }
  }, [checkAndCreateUser, onLiffReady, showNotification]);

  const handleEmailLogin = async (email: string, pass: string) => {
    try {
      setIsAuthLoading(true);
      await loginWithEmail(email, pass);
      addLog('員工登入', `員工 ${email} 登入系統`);
    } catch (e) {
      showNotification('登入失敗，請檢查帳號密碼', 'error');
      console.error(e);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if(currentUser) {
        addLog('員工登出', `員工 ${currentUser.name || currentUser.email} 登出系統`);
    }
    await firebaseLogout();
    setCurrentUser(null);
  };
  
  const handleLiffLogin = () => {
      if (liff && !liff.isLoggedIn()) {
          liff.login();
      }
  };

  return {
    currentUser,
    isAuthLoading,
    liffProfile,
    handleEmailLogin,
    handleLogout,
    handleLiffLogin
  };
};
