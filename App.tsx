
import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  Settings, 
  Sun, 
  Moon, 
  RefreshCw,
  AlertTriangle,
  Info,
  Lock,
  Trash2,
  Repeat,
  Layers,
  User as UserIcon,
  Search,
  X,
  CreditCard,
  CheckCircle2,
  Edit3,
  ChevronLeft
} from 'lucide-react';

import { 
    initAuth, 
    subscribeToCollection, 
    subscribeToAppointmentsInRange,
    subscribeToLogsInRange,
    saveToFirestore, 
    deleteFromFirestore, 
    disableUserInFirestore, 
    isFirebaseAvailable, 
    loginWithEmail, 
    logout,
    auth,
    db,
    getUserProfile,
    createAuthUser,
    batchUpdateFirestore
} from './services/firebase';
import { onAuthStateChanged, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { writeBatch, doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';


import { INITIAL_COACHES, ALL_TIME_SLOTS, BLOCK_REASONS, GOOGLE_SCRIPT_URL } from './constants';
import { User, Appointment, Coach, Log, Service, Customer, BlockFormState, UserInventory, WorkoutPlan } from './types';
import { formatDateKey, getStartOfWeek, getSlotStatus, isCoachDayOff, addDays } from './utils';

import BookingWizard from './components/BookingWizard';
import AdminDashboard from './components/AdminDashboard';
import WeeklyCalendar from './components/WeeklyCalendar';
import MyBookings from './components/MyBookings';

// Updated LIFF ID
const LIFF_ID = '2008923061-bPeQysat';

export default function App() {
  // --- STATE ---
  const [view, setView] = useState<'booking' | 'admin' | 'my-bookings'>('booking');
  const [adminTab, setAdminTab] = useState('calendar');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error' | 'info'} | null>(null);

  const [dbStatus, setDbStatus] = useState('connecting');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false); // Bugfix: State to prevent double actions
  
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [inventories, setInventories] = useState<UserInventory[]>([]);
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek(new Date()));

  const [bookingStep, setBookingStep] = useState(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [formData, setFormData] = useState<Customer>({ name: '', phone: '', email: '' });

  const [liffProfile, setLiffProfile] = useState<{ userId: string; displayName: string } | null>(null);

  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [filteredMembers, setFilteredMembers] = useState<UserInventory[]>([]);

  const [blockForm, setBlockForm] = useState<BlockFormState>({
    id: null, type: 'block', coachId: '', date: formatDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()), time: '09:00', endTime: '10:00', reason: '內部訓練', customer: null, repeatWeeks: 1
  });
  const [selectedBatch, setSelectedBatch] = useState<Set<string>>(new Set());
  
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean, 
    title: string,
    message: string, 
    onConfirm: ((reasonOrPassword?: string) => void) | null, 
    isDanger: boolean, 
    showInput: boolean,
    inputLabel?: string,
    inputType?: 'text' | 'password',
    icon?: React.ReactNode
  }>({ isOpen: false, title: '', message: '', onConfirm: null, isDanger: false, showInput: false });
  
  const [cancelReason, setCancelReason] = useState('');

  // --- EFFECTS ---

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  // Renamed and updated function as per request
  const checkAndCreateUser = async (profile: { userId: string, displayName: string }) => {
      if (!db) {
        console.warn("Firestore is not available. Skipping user creation.");
        return;
      }
      try {
          const userDocRef = doc(db, 'user_inventory', profile.userId);
          const docSnap = await getDoc(userDocRef);

          if (!docSnap.exists()) {
              const newInventory: UserInventory = {
                  id: profile.userId,
                  lineUserId: profile.userId,
                  name: profile.displayName,
                  phone: '',
                  credits: { private: 0, group: 0 },
                  lastUpdated: new Date().toISOString(),
              };
              await setDoc(userDocRef, newInventory);
              addLog('新戶自動註冊', `LIFF 登入時自動建立學員資料: ${profile.displayName}`);
          }
      } catch (e) {
          console.error("Error during user auto-registration:", e);
          showNotification("自動註冊學員失敗", "error");
      }
  };
  
  useEffect(() => {
    const start = async () => {
        await initAuth();
        const liff = (window as any).liff;
        if (liff) {
            try {
                await liff.init({ liffId: LIFF_ID });
                
                const params = new URLSearchParams(window.location.search);
                if (params.get('mode') === 'my-bookings') {
                    setView('my-bookings');
                    if (!liff.isLoggedIn()) {
                        liff.login(); 
                    }
                }

                if (liff.isLoggedIn()) {
                    const profile = await liff.getProfile();
                    setLiffProfile(profile);
                    await checkAndCreateUser(profile);
                }
            } catch (err) {
                console.error('LIFF Init failed', err);
            }
        }
    };
    start();
  }, []);

  useEffect(() => {
      if (!auth) {
          setIsAuthLoading(false);
          return;
      }
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          setIsAuthLoading(true);
          if (firebaseUser) {
              let userProfile = await getUserProfile(firebaseUser.uid);
              let retries = 3;
              while (!userProfile && retries > 0) {
                  await new Promise(resolve => setTimeout(resolve, 500));
                  userProfile = await getUserProfile(firebaseUser.uid);
                  retries--;
              }

              if (userProfile) {
                  if (userProfile.status === 'disabled') {
                      showNotification("此帳號已被停用，請聯繫管理員", "error");
                      await logout();
                      setCurrentUser(null);
                  } else {
                      setCurrentUser(userProfile);
                      if (userProfile.role === 'coach') {
                        setBlockForm(prev => ({...prev, coachId: userProfile.id})); 
                      }
                  }
              } else {
                  showNotification("無法取得使用者權限，請確認帳號是否已建立", "error");
                  setCurrentUser(null);
              }
          } else {
              setCurrentUser(null);
          }
          setIsAuthLoading(false);
      });
      return () => unsubscribe();
  }, []);

  // PERFORMANCE: Optimized Subscription for Appointments
  useEffect(() => {
    // Calculate range: Week Start - 14 days to Week Start + 14 days
    const rangeStart = addDays(currentWeekStart, -14);
    const rangeEnd = addDays(currentWeekStart, 14);
    
    const startStr = formatDateKey(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate());
    const endStr = formatDateKey(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate());

    const unsubApps = subscribeToAppointmentsInRange(startStr, endStr, (data) => {
        const apps = data as Appointment[];
        setAppointments([...apps]);
        setDbStatus(isFirebaseAvailable ? 'connected' : 'local');
    }, () => setDbStatus('error'));

    const unsubLogs = subscribeToLogsInRange(rangeStart, rangeEnd, (data) => {
        const loaded = data as Log[];
        setLogs(loaded.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()));
    }, () => {});

    const unsubCoaches = subscribeToCollection('coaches', (data) => {
        if (data.length > 0) {
            setCoaches([...data] as Coach[]);
        } else {
             if (!isFirebaseAvailable && coaches.length === 0) setCoaches(INITIAL_COACHES);
        }
    }, () => {});
    
    const unsubInventory = subscribeToCollection('user_inventory', (data) => {
        setInventories([...data] as UserInventory[]);
    }, () => {});

    const unsubWorkoutPlans = subscribeToCollection('workout_plans', (data) => {
        setWorkoutPlans([...data] as WorkoutPlan[]);
    }, () => {});

    return () => {
        unsubApps();
        unsubCoaches && unsubCoaches();
        unsubLogs && unsubLogs();
        unsubInventory && unsubInventory();
        unsubWorkoutPlans && unsubWorkoutPlans();
    };
  }, [currentWeekStart]);

  useEffect(() => {
      if (!memberSearchTerm) {
          setFilteredMembers([]);
          return;
      }
      const lowerTerm = memberSearchTerm.toLowerCase();
      const results = inventories.filter(inv => 
          inv.name.toLowerCase().includes(lowerTerm) || 
          (inv.phone && inv.phone.includes(lowerTerm))
      ).slice(0, 6);
      setFilteredMembers(results);
  }, [memberSearchTerm, inventories]);

  const showNotification = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const addLog = (action: string, details: string) => {
    const userName = currentUser ? (currentUser.name || currentUser.email || '未知員工') : '系統/客戶';
    saveToFirestore('logs', Date.now().toString(), { 
        id: Date.now().toString(), 
        time: new Date().toISOString(), 
        user: userName, 
        action, details 
    });
  };

  const sendToGoogleScript = async (data: any) => {
    if (!GOOGLE_SCRIPT_URL) return;
    try {
        const fd = new FormData();
        fd.append('data', JSON.stringify(data));
        fd.append('timestamp', new Date().toISOString());
        fetch(GOOGLE_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: fd })
            .catch(e => console.warn("Webhook background error:", e));
    } catch (e) { 
        console.error("Webhook Error (Non-blocking):", e); 
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsAuthLoading(true);
      try {
          await loginWithEmail(loginForm.email, loginForm.password);
      } catch (e: any) {
          if (e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
              showNotification("帳號或密碼錯誤", "error");
          } else {
              showNotification("登入失敗: " + e.message, "error");
          }
      } finally {
          setIsAuthLoading(false);
      }
  };

  const handleLogout = async () => {
      await logout();
      setView('booking');
      setAdminTab('calendar');
      setLoginForm({ email: '', password: '' });
      showNotification("已登出", "info");
  };

  const handleLiffLogin = () => {
      const liff = (window as any).liff;
      if (liff && !liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
      }
  };

  // Inventory Management Actions
  const handleSaveInventory = async (inventory: UserInventory) => {
      try {
          const id = inventory.id || (inventory.lineUserId || (inventory.phone ? `phone_${inventory.phone}` : `manual_${Date.now()}`));
          
          const oldInv = inventories.find(i => i.id === id);
          const isUpdate = !!oldInv;

          await saveToFirestore('user_inventory', id, { ...inventory, id, lastUpdated: new Date().toISOString() });
          
          if (isUpdate && oldInv) {
              const oldPrivate = oldInv.credits.private;
              const newPrivate = Number(inventory.credits?.private || 0);
              const oldGroup = oldInv.credits.group;
              const newGroup = Number(inventory.credits?.group || 0);

              if (oldPrivate !== newPrivate || oldGroup !== newGroup) {
                   addLog('庫存調整', `調整學員 ${inventory.name} 點數 - 1v1: ${oldPrivate} -> ${newPrivate}, 團課: ${oldGroup} -> ${newGroup}`);
                   showNotification('學員點數已更新', 'success');
              } else {
                   addLog('學員管理', `更新學員資料: ${inventory.name}`);
                   showNotification('學員資料已更新', 'success');
              }
          } else {
              addLog('學員管理', `新增學員資料: ${inventory.name}`);
              showNotification('新學員已新增', 'success');
          }

      } catch (e) {
          console.error(e);
          showNotification('儲存失敗', 'error');
      }
  };

  const handleDeleteInventory = async (inventory: UserInventory) => {
    setConfirmModal({
        isOpen: true,
        title: '刪除會員確認',
        message: `此操作將永久刪除學員 ${inventory.name} 的所有資料 (包含點數庫存與訓練課表)，且無法復原。請輸入您的登入密碼以確認執行。`,
        isDanger: true,
        showInput: true,
        inputLabel: '管理員密碼',
        inputType: 'password',
        icon: <Trash2 size={48} className="text-red-500"/>,
        onConfirm: async (password) => {
            const trimmedPassword = (password || '').trim();
            if (!trimmedPassword) {
                showNotification('請輸入密碼', 'error');
                return;
            }
            
            const adminEmail = auth.currentUser?.email || currentUser?.email;
            if (!currentUser || !adminEmail || !auth.currentUser) {
                showNotification('無法驗證管理員身份，請重新登入再試一次', 'error');
                return;
            }

            try {
                const credential = EmailAuthProvider.credential(adminEmail, trimmedPassword);
                await reauthenticateWithCredential(auth.currentUser, credential);
                
                // Re-auth successful, proceed with deletion
                await deleteFromFirestore('user_inventory', inventory.id);
                
                const plansToDelete = workoutPlans.filter(p => p.userId === inventory.id);
                if (plansToDelete.length > 0 && db) {
                  const batch = writeBatch(db);
                  plansToDelete.forEach(plan => {
                    const planRef = doc(db, 'workout_plans', plan.id);
                    batch.delete(planRef);
                  });
                  await batch.commit();
                }
                const userNameForLog = currentUser.name || currentUser.email || '管理員';
                addLog('學員管理', `管理員 ${userNameForLog} 刪除了學員 ${inventory.name} (ID: ${inventory.id})`);
                showNotification('學員已成功刪除', 'success');

            } catch (error: any) {
                if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                    showNotification('密碼錯誤，操作已取消', 'error');
                } else {
                    console.error("Deletion error:", error);
                    showNotification(`刪除失敗：${error.message}`, 'error');
                }
            }
        }
    });
  };

  const handleSaveWorkoutPlan = async (plan: WorkoutPlan) => {
      try {
          const id = plan.id || `${Date.now()}`;
          const planToSave = { 
              ...plan, 
              id, 
              createdAt: plan.createdAt || new Date().toISOString() 
          };
          await saveToFirestore('workout_plans', id, planToSave);
          addLog('課表管理', `儲存學員 ${plan.userName} 的課表 "${plan.name}"`);
          showNotification('課表已儲存', 'success');
      } catch (e) {
          console.error(e);
          showNotification('儲存課表失敗', 'error');
      }
  };

  const handleDeleteWorkoutPlan = async (id: string) => {
      try {
          await deleteFromFirestore('workout_plans', id);
          addLog('課表管理', `刪除課表 ID: ${id}`);
          showNotification('課表已刪除', 'success');
      } catch (e) {
          showNotification('刪除失敗', 'error');
      }
  };

  // --- Booking & Admin Actions ---

  const handleSubmitBooking = async (e: React.FormEvent, lineProfile?: { userId: string, displayName: string }) => {
    if (e) e.preventDefault();
    if (!formData.name || !formData.phone || !selectedSlot || !selectedCoach || !selectedService) { 
        showNotification('請填寫完整資訊', 'error'); return; 
    }
    const dateKey = formatDateKey(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const status = getSlotStatus(dateKey, selectedSlot, selectedCoach, appointments);
    
    if (status.status === 'booked') { 
        showNotification('該時段已被預約', 'error'); setBookingStep(3); return; 
    }

    try {
        let inventory: UserInventory | null = null;
        if (lineProfile) {
            inventory = inventories.find(i => i.lineUserId === lineProfile.userId) || null;
            if (!inventory) {
                const invByPhone = inventories.find(i => i.phone === formData.phone);
                if (invByPhone && !invByPhone.lineUserId) {
                    await saveToFirestore('user_inventory', invByPhone.id, { ...invByPhone, lineUserId: lineProfile.userId, lastUpdated: new Date().toISOString() });
                    inventory = { ...invByPhone, lineUserId: lineProfile.userId };
                }
            }
        }
        
        if (inventory && selectedService?.id === 'coaching' && inventory.credits.private <= 0) {
            showNotification('提醒：您的點數不足，仍可預約，請記得在上課前補足點數', 'info');
        }

        const id = Date.now().toString();
        const newApp: Appointment = { 
            id, type: 'private', date: dateKey, time: selectedSlot, 
            service: selectedService, coachId: selectedCoach.id, coachName: selectedCoach.name, 
            customer: { name: formData.name, phone: formData.phone || "", email: formData.email || "" }, 
            status: 'confirmed', createdAt: new Date().toISOString(),
            lineUserId: lineProfile?.userId || "", lineName: lineProfile?.displayName || "" 
        };
        
        await saveToFirestore('appointments', id, newApp);
        addLog('前台預約', `客戶 ${formData.name} 預約 ${selectedCoach.name}`);
        
        sendToGoogleScript({ action: 'create_booking', ...newApp, lineUserId: lineProfile?.userId || '', coachName: selectedCoach.name, title: selectedCoach.title || '教練', type: 'private' }).catch(err => console.warn("Webhook failed silently", err));
        
        setBookingStep(5);
        showNotification('預約成功！', 'success');
        
    } catch (error: any) {
        console.error("Booking Error:", error);
        showNotification('預約系統忙碌中: ' + error.message, 'error');
    }
  };

  const handleCustomerCancel = async (app: Appointment, reason: string) => {
      if (isProcessing) return;
      setIsProcessing(true);
      try {
          const originalStatus = app.status;
          const updated = { ...app, status: 'cancelled' as const, cancelReason: reason };
          await saveToFirestore('appointments', app.id, updated);
          addLog('客戶取消', `取消 ${app.customer?.name} (${originalStatus}) - ${reason}`);
  
          // Bugfix: Only refund credit if the class was already completed (and point deducted)
          if ((app.type === 'private' || (app.type as string) === 'client') && originalStatus === 'completed') {
              // Bugfix: Improved lookup logic
              let inventory: UserInventory | undefined;
              if (app.lineUserId) {
                  inventory = inventories.find(i => i.lineUserId === app.lineUserId);
              }
              if (!inventory && app.customer?.phone) {
                  inventory = inventories.find(i => i.phone === app.customer.phone && i.name === app.customer.name);
              }
              if (!inventory && app.customer?.name) { // Fallback
                  inventory = inventories.find(i => i.name === app.customer.name);
              }
  
              if (inventory) {
                  const invRef = doc(db, 'user_inventory', inventory.id);
                  const newPrivateCredits = (inventory.credits.private || 0) + 1;
                  await updateDoc(invRef, { 'credits.private': increment(1) });
                  
                  setInventories(prev => prev.map(inv => inv.id === inventory!.id ? { ...inv, credits: { ...inv.credits, private: newPrivateCredits } } : inv));
                  addLog('庫存調整', `因取消已完課預約，返還 ${inventory.name} 1 點私人課。剩餘: ${newPrivateCredits}`);
              }
          }
  
          const coach = coaches.find(c => c.id === app.coachId);
          sendToGoogleScript({ action: 'cancel_booking', id: app.id, reason, lineUserId: app.lineUserId || "", coachName: app.coachName, title: coach?.title || '教練', date: app.date, time: app.time }).catch(e => console.warn("Cancel webhook failed", e));
          
          showNotification('已取消預約', 'info');
      } catch (e) {
          console.error("Cancellation Error", e);
          showNotification('取消失敗', 'error');
      } finally {
          setIsProcessing(false);
      }
  };

  const resetBooking = () => {
    setBookingStep(1); setSelectedService(null); setSelectedCoach(null); setSelectedSlot(null); setFormData({ name: '', phone: '', email: '' });
  };

  const handleSaveBlock = async (e: React.FormEvent, force: boolean = false) => {
    if(e) e.preventDefault();
    if (!currentUser) return;
    const coach = coaches.find(c => c.id === (['manager', 'receptionist'].includes(currentUser.role) ? blockForm.coachId : currentUser.id));
    if (!coach) return;
    
    const finalType = ((blockForm.type as string) === 'client' || blockForm.type === 'private') ? 'private' : blockForm.type;
    const isPrivate = finalType === 'private';
    
    if (isPrivate && !blockForm.customer?.name) {
        showNotification('請先搜尋並選擇學員', 'error');
        return;
    }
    
    let targetSlots = [blockForm.time];
    if (isBatchMode && blockForm.endTime) {
        const startIndex = ALL_TIME_SLOTS.indexOf(blockForm.time);
        const endIndex = ALL_TIME_SLOTS.indexOf(blockForm.endTime);
        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
            targetSlots = ALL_TIME_SLOTS.slice(startIndex, endIndex);
        }
    }

    let targetInventory: UserInventory | undefined;
    if (isPrivate && blockForm.customer?.name) {
        targetInventory = inventories.find(i => i.name === blockForm.customer?.name && (blockForm.customer?.phone ? i.phone === blockForm.customer.phone : true));
        const creditsNeeded = (blockForm.repeatWeeks || 1) * targetSlots.length;
        if (targetInventory && targetInventory.credits.private < creditsNeeded) {
             if(!window.confirm(`學員 ${targetInventory.name} 點數不足 (剩 ${targetInventory.credits.private} 點, 需 ${creditsNeeded} 點)，確定要預約嗎？`)) return;
        }
    }
    
    const repeat = blockForm.repeatWeeks || 1;
    const batchOps: Appointment[] = [];
    const [y, m, d] = blockForm.date.split('-').map(Number);
    const startDate = new Date(y, m - 1, d); 

    for (let i = 0; i < repeat; i++) {
        const targetDate = new Date(startDate);
        targetDate.setDate(startDate.getDate() + (i * 7));
        const dKey = formatDateKey(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

        for (const slot of targetSlots) {
             const status = getSlotStatus(dKey, slot, coach, appointments, blockForm.id);
             if (status.status === 'available') {
                 const id = (!isBatchMode && i === 0 && blockForm.id) ? blockForm.id! : `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                 batchOps.push({ 
                     id, type: finalType as any, date: dKey, time: slot,
                     coachId: coach.id, coachName: coach.name, reason: blockForm.reason, status: 'confirmed', 
                     customer: (isPrivate && blockForm.customer) ? { ...blockForm.customer } : null,
                     createdAt: new Date().toISOString(), lineUserId: targetInventory?.lineUserId || ""
                 });
             }
        }
    }

    if (batchOps.length === 0) { showNotification('選定時段已被占用或無效', 'error'); return; }
    
    try {
        await Promise.all(batchOps.map(op => saveToFirestore('appointments', op.id, op)));
        
        // Note: Point deduction is moved to completion logic.
        // const privateLessonsCount = isPrivate ? batchOps.length : 0;
        // if (privateLessonsCount > 0 && targetInventory) { ... }

        addLog(blockForm.id ? '修改事件' : '新增事件', `處理 ${batchOps.length} 筆紀錄`);
        showNotification(`成功建立 ${batchOps.length} 筆預約`, 'success');
        setIsBlockModalOpen(false);
    } catch (e: any) {
        console.error(e);
        showNotification(`儲存失敗: ${e.message}`, 'error');
    }
  };

  const handleActualDelete = async () => {
     if (!blockForm.id) return;
     const target = appointments.find(a => a.id === blockForm.id);
     if (!target) return;
     
     if (target.type === 'private' || (target.type as string) === 'client') { 
         setConfirmModal({
             isOpen: true, title: '取消原因', message: '請輸入取消預約的原因', isDanger: true, showInput: true,
             onConfirm: async (reason) => {
                 try {
                     await handleCustomerCancel(target, reason || '管理員手動取消');
                     setIsBlockModalOpen(false);
                 } catch(e: any) {
                     showNotification(`取消失敗: ${e.message}`, 'error');
                 }
             }
         });
     } else {
         try {
             await deleteFromFirestore('appointments', target.id);
             addLog('刪除事件', `刪除 ${target.reason}`);
             showNotification('已刪除', 'info');
             setIsBlockModalOpen(false);
         } catch(e:any) {
             showNotification(`刪除失敗: ${e.message}`, 'error');
         }
     }
  };

  const handleSlotClick = (date: string, time: string) => {
    if (!currentUser) return;

    if (['manager', 'receptionist'].includes(currentUser.role)) {
        // For managers, find the first available coach for that day to pre-fill the modal
        const firstAvailableCoach = coaches.find(c => !isCoachDayOff(date, c));
        
        if (!firstAvailableCoach) {
            showNotification('該日無教練上班，無法新增預約', 'error');
            return;
        }

        setBlockForm({ 
            id: null, type: 'block', coachId: firstAvailableCoach.id, 
            date, time, endTime: ALL_TIME_SLOTS[ALL_TIME_SLOTS.indexOf(time)+1] || time, 
            reason: '1v1教練課', customer: null, repeatWeeks: 1 
        });
        setMemberSearchTerm('');
        setDeleteConfirm(false); 
        setIsBatchMode(false);
        setIsBlockModalOpen(true);

    } else { // Coach logic remains the same
        const targetCoachId = currentUser.id;
        const coach = coaches.find(c => c.id === targetCoachId);
        if (coach && isCoachDayOff(date, coach)) { 
            showNotification('排休日無法新增', 'error'); 
            return; 
        }
        setBlockForm({ 
            id: null, type: 'block', coachId: targetCoachId, 
            date, time, endTime: ALL_TIME_SLOTS[ALL_TIME_SLOTS.indexOf(time)+1] || time, 
            reason: '1v1教練課', customer: null, repeatWeeks: 1 
        });
        setMemberSearchTerm('');
        setDeleteConfirm(false); 
        setIsBatchMode(false);
        setIsBlockModalOpen(true);
    }
  };

  const handleOpenBatchBlock = () => {
      if (!currentUser) return;
      const targetCoachId = (['manager', 'receptionist'].includes(currentUser.role)) ? (blockForm.coachId || coaches[0]?.id) : currentUser.id;
      const today = new Date();
      const dateStr = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());
      
      setBlockForm({ 
          id: null, type: 'block', coachId: targetCoachId, 
          date: dateStr, 
          time: '09:00', endTime: '12:00',
          reason: '內部訓練', customer: null, repeatWeeks: 1 
      });
      setMemberSearchTerm('');
      setDeleteConfirm(false); 
      setIsBatchMode(true);
      setIsBlockModalOpen(true);
  };

  const handleAppointmentClick = (app: Appointment) => {
      if (!currentUser) return;
      if (currentUser.role === 'coach' && app.coachId !== currentUser.id) { showNotification('權限不足', 'info'); return; }
      
      const formType = ((app.type as any) === 'client' ? 'private' : app.type) as any;
      setBlockForm({ id: app.id, type: formType, coachId: app.coachId, date: app.date, time: app.time, endTime: app.time, reason: app.reason || '', customer: app.customer || null });
      setMemberSearchTerm('');
      setDeleteConfirm(false); 
      setIsBatchMode(false);
      setIsBlockModalOpen(true);
  };

  const handleUserCheckIn = async (app: Appointment) => {
      try {
          if (liffProfile && app.lineUserId !== liffProfile.userId) {
              showNotification('身份驗證失敗：此預約不屬於您', 'error');
              return;
          }
          await saveToFirestore('appointments', app.id, { ...app, status: 'checked_in' });
          addLog('學員簽到', `學員 ${app.customer?.name} 已簽到，等待教練確認`);
          showNotification('簽到成功！請告知教練。', 'success');
      } catch (e) {
          showNotification('簽到失敗，請稍後再試', 'error');
      }
  };

  const handleCoachConfirmCompletion = async (app: Appointment, force = false) => {
      if (isProcessing) return;
      if (!currentUser || (!['manager', 'receptionist'].includes(currentUser.role) && currentUser.id !== app.coachId)) {
          showNotification('權限不足', 'error'); return;
      }
      
      if (!force && app.status !== 'checked_in' && app.status !== 'confirmed') {
          showNotification('只能確認已簽到或已預約的課程', 'error'); return;
      }
  
      const proceed = force ? true : window.confirm('確定要核實此課程並扣除學員點數嗎？');
      if (!proceed) return;
  
      setIsProcessing(true);
      try {
          const isPrivateLesson = app.type === 'private' || (app.type as string) === 'client';
          
          // Bugfix: Improved lookup logic
          let inventoryToUpdate: UserInventory | undefined;
          if (app.lineUserId) {
              inventoryToUpdate = inventories.find(i => i.lineUserId === app.lineUserId);
          }
          if (!inventoryToUpdate && app.customer?.phone) {
              inventoryToUpdate = inventories.find(i => i.phone === app.customer.phone && i.name === app.customer.name);
          }
          if (!inventoryToUpdate && app.customer?.name) { // Fallback
              inventoryToUpdate = inventories.find(i => i.name === app.customer.name);
          }
  
          if (isPrivateLesson && inventoryToUpdate && (inventoryToUpdate.credits.private || 0) <= 0) {
              if (!window.confirm(`學員 ${inventoryToUpdate.name} 點數不足 (剩餘 0)，仍要將課程標示為完課嗎？(此操作不會扣點)`)) {
                  setIsProcessing(false);
                  return;
              }
          }
  
          const batch = writeBatch(db);
          const appRef = doc(db, 'appointments', app.id);
          batch.update(appRef, { status: 'completed' });
  
          let pointDeducted = false;
          let newPrivateCredits = -1;
  
          if (isPrivateLesson && inventoryToUpdate && (inventoryToUpdate.credits.private || 0) > 0) {
              const invRef = doc(db, 'user_inventory', inventoryToUpdate.id);
              batch.update(invRef, { 'credits.private': increment(-1) });
              pointDeducted = true;
              newPrivateCredits = (inventoryToUpdate.credits.private || 0) - 1;
          }
  
          await batch.commit();
  
          setAppointments(prev => prev.map(a => a.id === app.id ? { ...a, status: 'completed' } : a));
          
          const userNameForLog = currentUser.name || currentUser.email || '未知員工';
          let logDetail = `教練 ${userNameForLog} 確認 ${app.customer?.name} 完課`;
          if (pointDeducted && inventoryToUpdate) {
              setInventories(prev => prev.map(inv => 
                  inv.id === inventoryToUpdate!.id 
                  ? { ...inv, credits: { ...inv.credits, private: newPrivateCredits } } 
                  : inv
              ));
              logDetail += `，並扣除 1 點。剩餘: ${newPrivateCredits}`;
          } else {
              logDetail += ` (未扣點)。`;
          }
          
          addLog('完課確認', logDetail);
          showNotification(`完課確認成功！`, 'success');
  
      } catch (e) {
          console.error(e);
          showNotification('更新失敗', 'error');
      } finally {
          setIsProcessing(false);
      }
  };
  
  const handleRevertCompletion = async (app: Appointment) => {
    if (isProcessing) return;
    if (!currentUser || currentUser.role !== 'manager') {
        showNotification('僅管理員可執行此操作', 'error');
        return;
    }

    if (!window.confirm('確定要撤銷此完課紀錄並返還學員點數嗎？')) return;

    setIsProcessing(true);
    try {
        const isPrivateLesson = app.type === 'private' || (app.type as string) === 'client';
        
        // Bugfix: Improved lookup logic
        let inventoryToUpdate: UserInventory | undefined;
        if (app.lineUserId) {
            inventoryToUpdate = inventories.find(i => i.lineUserId === app.lineUserId);
        }
        if (!inventoryToUpdate && app.customer?.phone) {
            inventoryToUpdate = inventories.find(i => i.phone === app.customer.phone && i.name === app.customer.name);
        }
        if (!inventoryToUpdate && app.customer?.name) { // Fallback
            inventoryToUpdate = inventories.find(i => i.name === app.customer.name);
        }
        
        const batch = writeBatch(db);
        const appRef = doc(db, 'appointments', app.id);
        batch.update(appRef, { status: 'confirmed' });

        let pointRefunded = false;
        let newPrivateCredits = -1;

        if (isPrivateLesson && inventoryToUpdate) {
            const invRef = doc(db, 'user_inventory', inventoryToUpdate.id);
            batch.update(invRef, { 'credits.private': increment(1) });
            pointRefunded = true;
            newPrivateCredits = (inventoryToUpdate.credits.private || 0) + 1;
        }

        await batch.commit();

        setAppointments(prev => prev.map(a => a.id === app.id ? { ...a, status: 'confirmed' } : a));
        const userNameForLog = currentUser.name || currentUser.email || '未知員工';
        let logDetail = `管理員 ${userNameForLog} 撤銷完課`;
        if (pointRefunded && inventoryToUpdate) {
            setInventories(prev => prev.map(inv => 
                inv.id === inventoryToUpdate!.id 
                ? { ...inv, credits: { ...inv.credits, private: newPrivateCredits } } 
                : inv
            ));
            logDetail += `，返還學員 ${inventoryToUpdate.name} 1 點私人課。剩餘: ${newPrivateCredits}`;
        } else {
            logDetail += ' (非私人課或找不到學員庫存，未返還點數)';
        }
        
        addLog('庫存調整', logDetail);
        showNotification('已撤銷完課並返還點數', 'success');

    } catch(e) {
        console.error("Revert completion error:", e);
        showNotification('操作失敗', 'error');
    } finally {
        setIsProcessing(false);
    }
  };

  const handleToggleComplete = async (app: Appointment) => {
    if (app.status === 'checked_in' || app.status === 'confirmed') {
        handleCoachConfirmCompletion(app);
    } else if (app.status === 'completed' && currentUser?.role === 'manager') {
        handleRevertCompletion(app);
    } else {
        showNotification('無法變更此狀態或權限不足', 'info');
    }
  };

  const handleBatchDelete = async () => {
      const selectedApps = Array.from(selectedBatch).map(id => appointments.find(a => a.id === id)).filter(Boolean) as Appointment[];
      
      const hasCompleted = selectedApps.some(a => a.status === 'completed' || a.status === 'checked_in');
      
      if (hasCompleted) {
          showNotification('無法刪除已完成或已簽到的課程', 'error');
          return;
      }
      
      if(!window.confirm(`確定取消選取的 ${selectedBatch.size} 筆預約嗎？`)) return;

      try {
          await Promise.all(selectedApps.map(async (app) => {
              await handleCustomerCancel(app, '管理員批次取消'); 
          }));
          addLog('批次取消', `取消 ${selectedBatch.size} 筆預約`);
          setSelectedBatch(new Set());
          showNotification(`成功取消 ${selectedBatch.size} 筆`, 'success');
      } catch (e: any) {
          showNotification(`批次取消失敗: ${e.message}`, 'error');
      }
  };

  const handleSaveCoach = async (coachData: Coach, email?: string, password?: string) => {
    let uid = coachData.id;
    try {
        if (!uid && email && password) {
            uid = await createAuthUser(email, password);
        }
        if (!uid) { showNotification("無法建立使用者 ID", "error"); return; }

        const commonData = {
            id: uid, name: coachData.name, role: coachData.role || 'coach', email: email || coachData.email || '', status: 'active' as const, title: coachData.title || '教練'
        };

        await saveToFirestore('users', uid, commonData);
        
        const fullCoachData: Coach = {
            ...coachData, id: uid, role: coachData.role || 'coach', status: 'active' as const,
            workStart: coachData.workStart || '09:00', workEnd: coachData.workEnd || '21:00', workDays: coachData.workDays || [0,1,2,3,4,5,6], color: coachData.color || INITIAL_COACHES[0].color
        };
        await saveToFirestore('coaches', uid, fullCoachData);

        addLog('員工管理', `更新/新增員工：${coachData.name}`);
        showNotification("員工資料已儲存", "success");
    } catch (error: any) {
        showNotification(`儲存失敗: ${error.message}`, "error");
    }
  };

  const handleDeleteCoach = async (id: string, name: string) => {
    if (!window.confirm(`確定要刪除 ${name} 嗎？`)) return;
    try {
        await disableUserInFirestore(id);
        await deleteFromFirestore('coaches', id);
        addLog('員工管理', `刪除員工：${name}`);
        showNotification(`${name} 已刪除`, "success");
    } catch (error: any) {
        showNotification(`刪除失敗: ${error.message}`, "error");
    }
  };

  const updateCoachWorkDays = async (coach: Coach) => {
      try {
          await saveToFirestore('coaches', coach.id, coach);
          showNotification('班表設定已更新', 'success');
      } catch (e) {
          showNotification('更新失敗', 'error');
      }
  };

  const getAnalysis = () => {
    const totalActive = appointments.filter(a => a.status === 'confirmed' || a.status === 'checked_in').length;
    const totalCancelled = appointments.filter(a => a.status === 'cancelled').length;
    
    const slotCounts: Record<string, number> = {};
    appointments.filter(a => a.status === 'confirmed' || a.status === 'completed' || a.status === 'checked_in').forEach(a => {
        slotCounts[a.time] = (slotCounts[a.time] || 0) + 1;
    });
    const topTimeSlots = Object.entries(slotCounts).sort(([,a], [,b]) => b - a).slice(0, 3).map(([time, count]) => ({ time, count }));

    const now = new Date();
    const currentMonthPrefix = formatDateKey(now.getFullYear(), now.getMonth(), 1).substring(0, 7);
    
    const coachStats = coaches.map(c => {
        const apps = appointments.filter(a => a.coachId === c.id && a.status !== 'cancelled' && a.date.startsWith(currentMonthPrefix));
        const personalCount = apps.filter(a => a.type === 'private' || (a.type as string) === 'client').length;
        const groupCount = apps.filter(a => a.type === 'group').length;
        return { id: c.id, name: c.name, personal: personalCount, group: groupCount, total: personalCount + groupCount };
    });

    return { totalActive, totalCancelled, topTimeSlots, coachStats };
  };

  const handleExportStatsCsv = () => {
      const stats = getAnalysis();
      const rows = [
          ["統計項目", "數值"], ["總預約數", stats.totalActive + stats.totalCancelled], ["有效預約", stats.totalActive], ["已取消", stats.totalCancelled], [], ["教練", "個人課", "團課/其他", "總計"], ...stats.coachStats.map(c => [c.name, c.personal, c.group, c.total])
      ];
      const csvContent = "\uFEFF" + rows.map(e => e.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `stats_${new Date().toISOString().slice(0,10)}.csv`;
      link.click();
  };
  
  const handleExportJson = () => {
      const data = { appointments, coaches, logs, users: [], inventories, workoutPlans };
      const blob = new Blob([JSON.stringify(data, null, 2)], {type : 'application/json'});
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `backup_${new Date().toISOString().slice(0,10)}.json`;
      link.click();
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (evt) => {
          try {
              const data = JSON.parse(evt.target?.result as string);
              if (data.appointments) await Promise.all(data.appointments.map((a: any) => saveToFirestore('appointments', a.id, a)));
              if (data.coaches) await Promise.all(data.coaches.map((c: any) => saveToFirestore('coaches', c.id, c)));
              if (data.inventories) await Promise.all(data.inventories.map((i: any) => saveToFirestore('user_inventory', i.id, i)));
              if (data.workoutPlans) await Promise.all(data.workoutPlans.map((p: any) => saveToFirestore('workout_plans', p.id, p)));
              showNotification("資料匯入成功", "success");
          } catch (error) { showNotification("匯入失敗：格式錯誤", "error"); }
      };
      reader.readAsText(file);
  };

  const renderContent = () => {
      if (view === 'my-bookings') {
          return (
              <MyBookings 
                  liffProfile={liffProfile}
                  appointments={appointments}
                  coaches={coaches}
                  onCancel={handleCustomerCancel}
                  onCheckIn={handleUserCheckIn}
                  inventories={inventories}
                  workoutPlans={workoutPlans}
              />
          );
      }

      if (view === 'booking') {
          return (
              <BookingWizard 
                step={bookingStep} setStep={setBookingStep}
                selectedService={selectedService} setSelectedService={setSelectedService}
                selectedCoach={selectedCoach} setSelectedCoach={setSelectedCoach}
                selectedDate={selectedDate} setSelectedDate={setSelectedDate}
                selectedSlot={selectedSlot} setSelectedSlot={setSelectedSlot}
                formData={formData} setFormData={setFormData}
                coaches={coaches} appointments={appointments}
                onSubmit={handleSubmitBooking} reset={resetBooking}
                currentDate={currentDate} 
                handlePrevMonth={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                handleNextMonth={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                inventories={inventories}
                onRegisterUser={checkAndCreateUser}
                liffProfile={liffProfile}
                onLogin={handleLiffLogin}
              />
          );
      }

      if (!currentUser) {
          return (
             <div className="max-w-md mx-auto mt-10 px-4">
                <div className="glass-panel p-8 rounded-3xl shadow-2xl border border-white/40">
                   <div className="text-center mb-8">
                      <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-600 dark:text-indigo-400">
                          <Lock size={32}/>
                      </div>
                      <h2 className="text-2xl font-bold dark:text-white">員工登入</h2>
                      <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">請使用您的員工帳號密碼登入系統</p>
                   </div>
                   <form onSubmit={handleEmailLogin} className="space-y-4">
                      <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase ml-1">Email</label>
                          <input type="email" required className="w-full glass-input p-3.5 rounded-xl dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all" value={loginForm.email} onChange={e => setLoginForm({...loginForm, email: e.target.value})} placeholder="name@gym.com"/>
                      </div>
                      <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase ml-1">Password</label>
                          <input type="password" required className="w-full glass-input p-3.5 rounded-xl dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} placeholder="••••••••"/>
                      </div>
                      <button type="submit" disabled={isAuthLoading} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-all transform hover:scale-[1.02] mt-2">
                          {isAuthLoading ? '驗證中...' : '登入系統'}
                      </button>
                   </form>
                </div>
             </div>
          );
      }

      return (
         <AdminDashboard 
            currentUser={currentUser}
            onLogout={handleLogout}
            adminTab={adminTab}
            setAdminTab={setAdminTab}
            appointments={appointments}
            coaches={coaches}
            updateCoachWorkDays={updateCoachWorkDays}
            logs={logs}
            onSaveCoach={handleSaveCoach}
            onDeleteCoach={handleDeleteCoach}
            analysis={getAnalysis()}
            handleExportStatsCsv={handleExportStatsCsv}
            handleExportJson={handleExportJson}
            triggerImport={() => {}}
            handleFileImport={handleFileImport}
            selectedBatch={selectedBatch}
            toggleBatchSelect={(id: string) => { const n = new Set(selectedBatch); if(n.has(id)) n.delete(id); else n.add(id); setSelectedBatch(n); }}
            handleBatchDelete={handleBatchDelete}
            onOpenBatchBlock={handleOpenBatchBlock}
            onGoToBooking={() => setView('booking')}
            onToggleComplete={handleToggleComplete}
            onCancelAppointment={(app) => {
                setConfirmModal({
                     isOpen: true,
                     title: '取消預約確認',
                     message: `確定要取消 ${app.customer?.name} 的預約嗎？`,
                     isDanger: true,
                     showInput: true,
                     onConfirm: (reason) => handleCustomerCancel(app, reason || '管理員後台取消')
                });
            }}
            renderWeeklyCalendar={() => (
               <WeeklyCalendar 
                  currentWeekStart={currentWeekStart}
                  setCurrentWeekStart={setCurrentWeekStart}
                  currentUser={currentUser}
                  coaches={coaches}
                  appointments={appointments}
                  onSlotClick={handleSlotClick}
                  onAppointmentClick={handleAppointmentClick}
                  onToggleComplete={handleToggleComplete}
                  isLoading={dbStatus === 'connecting' || isProcessing} 
               />
            )}
            inventories={inventories}
            onSaveInventory={handleSaveInventory}
            onDeleteInventory={handleDeleteInventory}
            workoutPlans={workoutPlans}
            onSavePlan={handleSaveWorkoutPlan}
            onDeletePlan={handleDeleteWorkoutPlan}
         />
      );
  };
  
  const currentAppointmentForModal = blockForm.id ? appointments.find(a => a.id === blockForm.id) : null;
  const isLockedForEditing = !!currentAppointmentForModal && ['checked_in', 'completed'].includes(currentAppointmentForModal.status);

  return (
    <div className="min-h-screen text-slate-800 dark:text-slate-100 transition-colors duration-300 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Dynamic Background */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-300/20 dark:bg-indigo-900/10 rounded-full blur-3xl animate-float"></div>
          <div className="absolute top-1/2 -right-20 w-80 h-80 bg-blue-300/20 dark:bg-blue-900/10 rounded-full blur-3xl animate-float" style={{animationDelay: '1s'}}></div>
          <div className="absolute -bottom-20 left-1/3 w-96 h-96 bg-purple-300/20 dark:bg-purple-900/10 rounded-full blur-3xl animate-float" style={{animationDelay: '2s'}}></div>
      </div>

      {view !== 'admin' && (
        <nav className="fixed w-full z-50 glass-panel border-b border-white/20 dark:border-slate-800 shadow-sm backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setView('booking'); resetBooking(); }}>
                <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                    <CalendarIcon size={22} className="stroke-[2.5px]"/>
                </div>
                <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-700 to-slate-900 dark:from-white dark:to-slate-300">
                    活力學苑預約系統
                </span>
                </div>
                <div className="flex items-center gap-4">
                <button onClick={() => setView('my-bookings')} className={`hidden md:flex items-center gap-2 px-3 py-2 rounded-lg transition-colors font-bold text-sm ${view === 'my-bookings' ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>
                    <UserIcon size={18}/> 我的預約
                </button>
                <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-500 dark:text-slate-300">
                    {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                </button>
                {currentUser ? (
                    <button onClick={() => setView('admin')} className="hidden md:flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-4 py-2 rounded-xl transition-all font-bold text-sm text-slate-700 dark:text-white">
                        <Settings size={16}/> 管理後台
                    </button>
                ) : (
                    <button onClick={() => setView('admin')} className="hidden md:flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">
                        <Lock size={16}/> 員工登入
                    </button>
                )}
                </div>
            </div>
            </div>
        </nav>
      )}

      <main className={`${view === 'admin' ? 'pt-0' : 'pt-24'} px-0 pb-12`}>
        {notification && (
          <div className={`fixed top-20 right-4 z-[60] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slideUp backdrop-blur-md border 
            ${notification.type === 'success' ? 'bg-green-500/90 text-white border-green-400' : notification.type === 'error' ? 'bg-red-500/90 text-white border-red-400' : 'bg-blue-500/90 text-white border-blue-400'}`}>
            {notification.type === 'success' ? <RefreshCw className="animate-spin" size={20}/> : <Info size={20}/>}
            <span className="font-bold tracking-wide">{notification.msg}</span>
          </div>
        )}

        {renderContent()}

      </main>

      {/* Confirmation Modal and others remain the same */}
      {view !== 'admin' && (
        <div className="md:hidden fixed bottom-0 w-full glass-panel border-t border-white/20 dark:border-slate-800 flex justify-around p-3 z-50 backdrop-blur-xl">
            <button onClick={() => setView('booking')} className={`flex flex-col items-center gap-1 ${view === 'booking' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
                <CalendarIcon size={24}/>
                <span className="text-[10px] font-bold">預約</span>
            </button>
            <button onClick={() => setView('my-bookings')} className={`flex flex-col items-center gap-1 ${view === 'my-bookings' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
                <UserIcon size={24}/>
                <span className="text-[10px] font-bold">我的</span>
            </button>
            <button onClick={() => setView('admin')} className="flex flex-col items-center gap-1 text-slate-400">
                <Settings size={24}/>
                <span className="text-[10px] font-bold">後台</span>
            </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
             <div className="glass-panel w-full max-w-sm rounded-3xl p-8 animate-slideUp shadow-2xl border border-white/60 dark:border-slate-700/60 relative overflow-hidden">
                 <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl"></div>
                 <div className="relative z-10 flex flex-col items-center text-center">
                     <div className="mb-6 scale-125">
                         {confirmModal.icon ? confirmModal.icon : <AlertTriangle size={48} className="text-orange-500 animate-bounce-short"/>}
                     </div>
                     <h3 className="font-bold text-xl mb-2 text-slate-800 dark:text-white">{confirmModal.title || '確認操作'}</h3>
                     <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed px-2">
                         {confirmModal.message}
                     </p>
                     {confirmModal.showInput && (
                         <div className='w-full mb-6'>
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center justify-start gap-1 mb-1">{confirmModal.inputLabel || '原因'}</label>
                            <input
                                type={confirmModal.inputType || 'text'} 
                                className="w-full glass-input p-4 rounded-2xl dark:text-white resize-none focus:ring-2 focus:ring-indigo-500/50 outline-none" 
                                placeholder={confirmModal.inputLabel || '請輸入原因...'}
                                value={cancelReason} 
                                onChange={e => setCancelReason(e.target.value)}
                            />
                         </div>
                     )}
                     <div className="flex flex-col gap-3 w-full">
                         <button 
                            onClick={() => { 
                                if(confirmModal.onConfirm) confirmModal.onConfirm(confirmModal.showInput ? cancelReason : undefined); 
                                setConfirmModal({...confirmModal, isOpen: false}); 
                                setCancelReason(''); 
                            }} 
                            className={`w-full py-3.5 text-white rounded-xl font-bold shadow-lg text-lg transition-transform transform hover:scale-[1.02] active:scale-95
                                ${confirmModal.isDanger 
                                    ? 'bg-gradient-to-r from-red-500 to-red-600 shadow-red-500/30' 
                                    : 'bg-gradient-to-r from-indigo-600 to-indigo-700 shadow-indigo-500/30'
                                }`}
                         >
                            確認
                         </button>
                         <button 
                            onClick={() => setConfirmModal({...confirmModal, isOpen: false})} 
                            className="w-full py-3 bg-white/50 dark:bg-slate-800/50 hover:bg-white/80 dark:hover:bg-slate-700/80 rounded-xl font-bold text-slate-500 dark:text-slate-400 transition-colors"
                         >
                            取消
                         </button>
                     </div>
                 </div>
             </div>
        </div>
      )}
      
      {/* Block/Event Modal */}
      {isBlockModalOpen && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setIsBlockModalOpen(false)}>
            <div className="glass-panel w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-slideUp border border-white/40" onClick={e => e.stopPropagation()}>
                <div className="bg-white/50 dark:bg-slate-900/50 p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <h3 className="font-bold text-xl dark:text-white flex items-center gap-2">
                        {blockForm.id ? <Settings size={20}/> : <CalendarIcon size={20}/>}
                        {blockForm.id ? '管理行程' : (isBatchMode ? '批次封鎖時段' : '新增行程')}
                    </h3>
                    <div className="flex gap-2">
                        {blockForm.id && !isLockedForEditing && (
                            <button onClick={() => setDeleteConfirm(true)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"><Trash2 size={20}/></button>
                        )}
                        {!blockForm.id && (
                           <button onClick={() => setIsBatchMode(!isBatchMode)} className={`p-2 rounded-lg transition-colors ${isBatchMode ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`} title="切換批次模式">
                              <Layers size={20}/>
                           </button>
                        )}
                    </div>
                </div>
                {deleteConfirm ? (
                    <div className="p-8 text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500"><AlertTriangle size={32}/></div>
                        <h4 className="font-bold text-lg mb-2 text-slate-800 dark:text-white">確定要刪除嗎？</h4>
                        <p className="text-slate-500 text-sm mb-6">此動作無法復原</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirm(false)} className="flex-1 py-3 bg-slate-200 dark:bg-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300">取消</button>
                            <button onClick={handleActualDelete} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-500/30">確認刪除</button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={(e) => handleSaveBlock(e, false)} className="p-6 space-y-4">
                        {isLockedForEditing && (
                            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl text-xs text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800 flex items-center gap-2">
                                <AlertTriangle size={16}/>
                                <span>此預約已簽到或完課，無法修改時間。</span>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                               <label className="text-xs font-bold text-slate-500 uppercase">類型</label>
                               <select className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed" value={blockForm.type} onChange={e => {
                                   const newType = e.target.value as any;
                                   setBlockForm({...blockForm, type: newType, reason: newType === 'group' ? '' : blockForm.reason});
                                   if(newType !== 'private') setMemberSearchTerm('');
                               }} disabled={isLockedForEditing}>
                                   <option value="block">內部事務</option>
                                   <option value="private">私人課程</option>
                                   <option value="group">團體課程</option>
                               </select>
                           </div>
                           {['manager', 'receptionist'].includes(currentUser?.role) && (
                               <div>
                                   <label className="text-xs font-bold text-slate-500 uppercase">指定教練</label>
                                   <select className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed" value={blockForm.coachId} onChange={e => setBlockForm({...blockForm, coachId: e.target.value})} disabled={isLockedForEditing}>
                                       {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                   </select>
                               </div>
                           )}
                        </div>
                        <div>
                             <label className="text-xs font-bold text-slate-500 uppercase">日期</label>
                             <input type="date" required className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed" value={blockForm.date} onChange={e => setBlockForm({...blockForm, date: e.target.value})} disabled={isLockedForEditing} />
                        </div>
                        <div className="grid grid-cols-2 gap-4 items-end">
                             <div className="w-full">
                                 <label className="text-xs font-bold text-slate-500 uppercase">開始時間</label>
                                 <select className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed" value={blockForm.time} onChange={e => setBlockForm({...blockForm, time: e.target.value})} disabled={isLockedForEditing}>
                                     {ALL_TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                                 </select>
                             </div>
                             {isBatchMode && (
                                 <div className="w-full">
                                     <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">結束時間 (不含)</label>
                                     <select className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed" value={blockForm.endTime} onChange={e => setBlockForm({...blockForm, endTime: e.target.value})} disabled={isLockedForEditing}>
                                         {ALL_TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                                     </select>
                                 </div>
                             )}
                        </div>
                        
                        {/* Type specific fields (Block Reason, Group Name, Private User Search) */}
                        {blockForm.type === 'block' && (
                            <fieldset disabled={isLockedForEditing}>
                                <label className="text-xs font-bold text-slate-500 uppercase">內部事項標籤</label>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {BLOCK_REASONS.map(r => (
                                        <button type="button" key={r} onClick={() => setBlockForm({...blockForm, reason: r})}
                                            className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${blockForm.reason === r ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </fieldset>
                        )}
                        {blockForm.type === 'group' && (
                             <div>
                                 <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Edit3 size={12}/> 課程名稱</label>
                                 <input 
                                     type="text" 
                                     required 
                                     className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed" 
                                     placeholder="例如：TRX 懸吊、瑜珈..." 
                                     value={blockForm.reason} 
                                     onChange={e => setBlockForm({...blockForm, reason: e.target.value})}
                                     disabled={isLockedForEditing}
                                 />
                             </div>
                        )}
                        {(blockForm.type === 'private' || (blockForm.type as string) === 'client') && (
                            <fieldset disabled={isLockedForEditing} className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl space-y-3 border border-indigo-100 dark:border-indigo-800 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                                <div className="text-xs font-bold text-indigo-500 uppercase mb-2">客戶/學員資料</div>
                                {blockForm.customer?.name ? (
                                    <div className="glass-card p-3 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-indigo-200 dark:border-indigo-800 flex justify-between items-center animate-fadeIn">
                                        <div>
                                            <div className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                                {blockForm.customer.name}
                                                {blockForm.customer.phone && <span className="text-xs text-slate-500 font-normal">({blockForm.customer.phone})</span>}
                                            </div>
                                            {(() => {
                                                const linkedInv = inventories.find(i => i.name === blockForm.customer?.name && (blockForm.customer?.phone ? i.phone === blockForm.customer.phone : true));
                                                if (linkedInv) {
                                                    return <div className="text-xs text-indigo-500 font-bold mt-1 flex items-center gap-1"><CreditCard size={10}/> 剩餘課時: {linkedInv.credits.private} 堂</div>
                                                }
                                                return null;
                                            })()}
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => setBlockForm({...blockForm, customer: null})}
                                            className="p-2 bg-slate-100 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors"
                                            title="重新選擇"
                                        >
                                            <X size={16}/>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <label className="text-xs text-slate-500 mb-1 block flex items-center gap-1"><Search size={10}/> 搜尋學員 (姓名/電話)</label>
                                        <input 
                                            type="text" 
                                            className="w-full glass-input rounded-xl p-3 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                            placeholder="輸入關鍵字..."
                                            value={memberSearchTerm}
                                            onChange={(e) => setMemberSearchTerm(e.target.value)}
                                            autoFocus
                                        />
                                        {memberSearchTerm && !blockForm.customer && (
                                            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 max-h-48 overflow-y-auto custom-scrollbar animate-fadeIn">
                                                {filteredMembers.length > 0 ? (
                                                    filteredMembers.map(m => (
                                                        <div 
                                                            key={m.id} 
                                                            onClick={() => {
                                                                setBlockForm({
                                                                    ...blockForm,
                                                                    customer: { 
                                                                        name: m.name, 
                                                                        phone: m.phone || '', 
                                                                        email: m.email || '' 
                                                                    }
                                                                });
                                                                setMemberSearchTerm('');
                                                            }}
                                                            className="p-3 hover:bg-indigo-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0"
                                                        >
                                                            <div className="font-bold text-slate-800 dark:text-white">{m.name}</div>
                                                            <div className="flex justify-between text-xs text-slate-500 mt-0.5">
                                                                <span>{m.phone || '無電話'}</span>
                                                                <span className="font-bold text-indigo-500">餘: {m.credits.private}</span>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="p-4 text-center text-xs text-slate-400">找不到相符學員</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </fieldset>
                        )}
                        {!blockForm.id && (
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Repeat size={14}/> 重複週數 (可選)</label>
                                <select className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed" value={blockForm.repeatWeeks} onChange={e => setBlockForm({...blockForm, repeatWeeks: Number(e.target.value)})} disabled={isLockedForEditing}>
                                    <option value={1}>單次事件</option>
                                    <option value={4}>重複 4 週</option>
                                    <option value={8}>重複 8 週</option>
                                    <option value={12}>重複 12 週</option>
                                </select>
                            </div>
                        )}

                        <div className="pt-2 flex gap-3">
                            {currentUser?.role === 'manager' && blockForm.id && currentAppointmentForModal && (currentAppointmentForModal.type === 'private' || (currentAppointmentForModal.type as any) === 'client') && currentAppointmentForModal.status !== 'completed' && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (window.confirm('確定要強制結課並扣除點數嗎？') && currentAppointmentForModal) {
                                            handleCoachConfirmCompletion(currentAppointmentForModal, true);
                                            setIsBlockModalOpen(false);
                                        }
                                    }}
                                    className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/30 transition-colors hover:bg-emerald-600"
                                >
                                    強制結課
                                </button>
                            )}
                            <button 
                                type="submit" 
                                disabled={(blockForm.type === 'private' && !blockForm.customer?.name) || isLockedForEditing}
                                className={`flex-[2] py-3 text-white rounded-xl font-bold shadow-lg transition-colors
                                    ${(blockForm.type === 'private' && !blockForm.customer?.name) || isLockedForEditing
                                        ? 'bg-slate-400 cursor-not-allowed' 
                                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/30'}`}
                            >
                                {blockForm.id ? '儲存變更' : '確認新增'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
         </div>
      )}
    </div>
  );
}
