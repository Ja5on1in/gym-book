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
  ChevronLeft,
  Trophy
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
import ProgressTracking from './components/ProgressTracking';

// Updated LIFF ID
const LIFF_ID = '2008923061-bPeQysat';

export default function App() {
  // --- STATE ---
  const [view, setView] = useState<'booking' | 'admin' | 'my-bookings' | 'progress-tracking'>('booking');
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
  
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [filteredMembers, setFilteredMembers] = useState<UserInventory[]>([]);

  const [blockForm, setBlockForm] = useState<BlockFormState>({
    id: null, type: 'block', coachId: '', date: formatDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()), time: '09:00', endTime: '10:00', reason: '內部訓練', customer: null, repeatWeeks: 1
  });
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Set<string>>(new Set());
  
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean, 
    title?: string,
    message?: string, 
    onConfirm: ((reasonOrPassword?: string) => void) | null, 
    isDanger?: boolean, 
    showInput?: boolean,
    inputLabel?: string,
    inputType?: 'text' | 'password',
    icon?: React.ReactNode
  }>({ isOpen: false, onConfirm: null });
  
  const [cancelReason, setCancelReason] = useState('');

  // --- EFFECTS ---

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

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

  // Set default admin tab based on user role
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'coach') {
        setAdminTab('coach_dashboard');
        setBlockForm(prev => ({...prev, coachId: currentUser.id}));
      } else {
        setAdminTab('calendar');
      }
    }
  }, [currentUser]);


  // PERFORMANCE: Optimized Subscription for Appointments
  useEffect(() => {
    const rangeStart = addDays(currentWeekStart, -14);
    const rangeEnd = addDays(currentWeekStart, 14);
    
    const startStr = formatDateKey(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate());
    const endStr = formatDateKey(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate());

    const unsubApps = subscribeToAppointmentsInRange(startStr, endStr, (data) => {
        setAppointments(data as Appointment[]);
        setDbStatus(isFirebaseAvailable ? 'connected' : 'local');
    }, () => setDbStatus('error'));

    const unsubLogs = subscribeToLogsInRange(rangeStart, rangeEnd, (data) => {
        setLogs((data as Log[]).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()));
    }, () => {});

    const unsubCoaches = subscribeToCollection('coaches', (data) => {
        if (data.length > 0) setCoaches(data as Coach[]);
        else if (!isFirebaseAvailable && coaches.length === 0) setCoaches(INITIAL_COACHES);
    }, () => {});
    
    const unsubInventory = subscribeToCollection('user_inventory', (data) => setInventories(data as UserInventory[]), () => {});
    const unsubWorkoutPlans = subscribeToCollection('workout_plans', (data) => setWorkoutPlans(data as WorkoutPlan[]), () => {});

    return () => {
        unsubApps();
        unsubCoaches();
        unsubLogs();
        unsubInventory();
        unsubWorkoutPlans();
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
      setLoginForm({ email: '', password: '' });
      showNotification("已登出", "info");
  };

  const handleLiffLogin = () => {
      const liff = (window as any).liff;
      if (liff && !liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
      }
  };

  const handleSaveInventory = async (inventory: UserInventory) => {
      try {
          const id = inventory.id || (inventory.lineUserId || (inventory.phone ? `phone_${inventory.phone}` : `manual_${Date.now()}`));
          const oldInv = inventories.find(i => i.id === id);
          await saveToFirestore('user_inventory', id, { ...inventory, id, lastUpdated: new Date().toISOString() });
          
          if (oldInv) {
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

  const handleDeleteInventory = (inventory: UserInventory) => {
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
            if (!trimmedPassword) { showNotification('請輸入密碼', 'error'); return; }
            
            const adminEmail = auth.currentUser?.email || currentUser?.email;
            if (!currentUser || !adminEmail || !auth.currentUser) { showNotification('無法驗證管理員身份', 'error'); return; }

            try {
                const credential = EmailAuthProvider.credential(adminEmail, trimmedPassword);
                await reauthenticateWithCredential(auth.currentUser, credential);
                
                await deleteFromFirestore('user_inventory', inventory.id);
                
                const plansToDelete = workoutPlans.filter(p => p.userId === inventory.id);
                if (plansToDelete.length > 0 && db) {
                  const batch = writeBatch(db);
                  plansToDelete.forEach(plan => batch.delete(doc(db, 'workout_plans', plan.id)));
                  await batch.commit();
                }
                addLog('學員管理', `管理員 ${currentUser.name || currentUser.email} 刪除了學員 ${inventory.name} (ID: ${inventory.id})`);
                showNotification('學員已成功刪除', 'success');

            } catch (error: any) {
                if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                    showNotification('密碼錯誤，操作已取消', 'error');
                } else {
                    showNotification(`刪除失敗：${error.message}`, 'error');
                }
            }
        }
    });
  };

  const handleSaveWorkoutPlan = async (plan: WorkoutPlan) => {
      try {
          const id = plan.id || `${Date.now()}`;
          await saveToFirestore('workout_plans', id, { ...plan, id, createdAt: plan.createdAt || new Date().toISOString() });
          addLog('課表管理', `儲存學員 ${plan.userName} 的課表 "${plan.name}"`);
          showNotification('課表已儲存', 'success');
      } catch (e) {
          showNotification('儲存課表失敗', 'error');
      }
  };

  const handleDeleteWorkoutPlan = async (id: string) => {
      if(!window.confirm('確定要刪除此課表嗎？')) return;
      try {
          await deleteFromFirestore('workout_plans', id);
          addLog('課表管理', `刪除課表 ID: ${id}`);
          showNotification('課表已刪除', 'success');
      } catch (e) {
          showNotification('刪除失敗', 'error');
      }
  };

  const handleSubmitBooking = async (e: React.FormEvent, lineProfile?: { userId: string, displayName: string }) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !selectedSlot || !selectedCoach || !selectedService) { 
        showNotification('請填寫完整資訊', 'error'); return; 
    }
    const dateKey = formatDateKey(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const status = getSlotStatus(dateKey, selectedSlot, selectedCoach, appointments);
    
    if (status.status === 'booked') { 
        showNotification('該時段已被預約', 'error'); setBookingStep(3); return; 
    }

    try {
        let inventory: UserInventory | null = inventories.find(i => (i.lineUserId && i.lineUserId === lineProfile?.userId) || (i.phone && i.phone === formData.phone)) || null;
        
        if (inventory && selectedService?.id === 'coaching' && inventory.credits.private <= 0) {
            showNotification('提醒：您的點數不足，仍可預約，請記得在上課前補足點數', 'info');
        }

        const id = Date.now().toString();
        const newApp: Appointment = { 
            id, type: 'private', date: dateKey, time: selectedSlot, 
            service: selectedService, coachId: selectedCoach.id, coachName: selectedCoach.name, 
            customer: { name: formData.name, phone: formData.phone, email: formData.email }, 
            status: 'confirmed', createdAt: new Date().toISOString(),
            lineUserId: lineProfile?.userId, lineName: lineProfile?.displayName 
        };
        
        await saveToFirestore('appointments', id, newApp);
        addLog('前台預約', `客戶 ${formData.name} 預約 ${selectedCoach.name}`);
        sendToGoogleScript({ action: 'create_booking', ...newApp, type: 'private' });
        
        setBookingStep(5);
        
    } catch (error: any) {
        showNotification('預約系統忙碌中: ' + error.message, 'error');
    }
  };

  const handleCustomerCancel = async (app: Appointment, reason: string) => {
      if (isProcessing) return;
      setIsProcessing(true);
      try {
          await saveToFirestore('appointments', app.id, { ...app, status: 'cancelled', cancelReason: reason });
          addLog('客戶取消', `取消 ${app.customer?.name} (${app.status}) - ${reason}`);
          showNotification('已取消預約', 'info');
      } catch (e) {
          showNotification('取消失敗', 'error');
      } finally {
          setIsProcessing(false);
      }
  };

  const resetBooking = () => {
    setBookingStep(1); setSelectedService(null); setSelectedCoach(null); setSelectedSlot(null); setView('booking');
    if (liffProfile) {
        const inv = inventories.find(i => i.lineUserId === liffProfile.userId);
        setFormData({ name: inv?.name || liffProfile.displayName, phone: inv?.phone || '', email: inv?.email || '' });
    } else {
        setFormData({ name: '', phone: '', email: '' });
    }
  };

  const handleSaveBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const coach = coaches.find(c => c.id === blockForm.coachId);
    if (!coach) return;
    
    const finalType = blockForm.type;
    const isPrivate = finalType === 'private';
    
    if (isPrivate && !blockForm.customer?.name) { showNotification('請先搜尋並選擇學員', 'error'); return; }
    
    let targetSlots = [blockForm.time];
    if (isBatchMode && blockForm.endTime) {
        const startIndex = ALL_TIME_SLOTS.indexOf(blockForm.time);
        const endIndex = ALL_TIME_SLOTS.indexOf(blockForm.endTime);
        if (endIndex > startIndex) targetSlots = ALL_TIME_SLOTS.slice(startIndex, endIndex);
    }

    const targetInventory = isPrivate ? inventories.find(i => i.name === blockForm.customer?.name) : undefined;
    const creditsNeeded = (blockForm.repeatWeeks || 1) * targetSlots.length;
    if (isPrivate && targetInventory && targetInventory.credits.private < creditsNeeded) {
        if(!window.confirm(`學員 ${targetInventory.name} 點數不足 (剩 ${targetInventory.credits.private} 點)，確定要預約嗎？`)) return;
    }
    
    const updates = [];
    const startDate = new Date(blockForm.date);
    for (let i = 0; i < (blockForm.repeatWeeks || 1); i++) {
        const dKey = formatDateKey(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + (i * 7));
        for (const slot of targetSlots) {
             const status = getSlotStatus(dKey, slot, coach, appointments, blockForm.id);
             if (status.status === 'available') {
                 const id = (!isBatchMode && i === 0 && blockForm.id) ? blockForm.id : `${Date.now()}_${Math.random()}`;
                 updates.push({ 
                     col: 'appointments', id, data: {
                         id, type: finalType, date: dKey, time: slot,
                         coachId: coach.id, coachName: coach.name, reason: blockForm.reason, status: 'confirmed', 
                         customer: isPrivate ? blockForm.customer : null,
                         createdAt: new Date().toISOString(), lineUserId: targetInventory?.lineUserId
                     }
                 });
             }
        }
    }

    if (updates.length === 0) { showNotification('選定時段已被占用或無效', 'error'); return; }
    
    try {
        await batchUpdateFirestore(updates);
        addLog(blockForm.id ? '修改事件' : '新增事件', `處理 ${updates.length} 筆紀錄`);
        showNotification(`成功建立 ${updates.length} 筆預約`, 'success');
        setIsBlockModalOpen(false);
    } catch (e: any) {
        showNotification(`儲存失敗: ${e.message}`, 'error');
    }
  };

  const handleActualDelete = async () => {
     if (!blockForm.id) return;
     const target = appointments.find(a => a.id === blockForm.id);
     if (!target) return;
     
     if (target.type === 'private') { 
         setConfirmModal({
             isOpen: true, title: '取消原因', message: '請輸入取消預約的原因', isDanger: true, showInput: true,
             onConfirm: async (reason) => {
                 await handleCustomerCancel(target, reason || '管理員手動取消');
                 setIsBlockModalOpen(false);
             }
         });
     } else {
         await deleteFromFirestore('appointments', target.id);
         addLog('刪除事件', `刪除 ${target.reason}`);
         setIsBlockModalOpen(false);
     }
  };

  const handleSlotClick = (date: string, time: string) => {
    if (!currentUser) return;
    const targetCoachId = ['manager', 'receptionist'].includes(currentUser.role) 
      ? (coaches.find(c => !isCoachDayOff(date, c))?.id || '') 
      : currentUser.id;
    if (!targetCoachId) { showNotification('該日無教練上班', 'error'); return; }

    setBlockForm({ 
        id: null, type: 'block', coachId: targetCoachId, 
        date, time, endTime: ALL_TIME_SLOTS[ALL_TIME_SLOTS.indexOf(time)+1] || time, 
        reason: '內部訓練', customer: null, repeatWeeks: 1 
    });
    setMemberSearchTerm('');
    setDeleteConfirm(false); 
    setIsBatchMode(false);
    setIsBlockModalOpen(true);
  };

  const handleOpenBatchBlock = () => {
      const todayStr = formatDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
      setBlockForm({ 
          id: null, type: 'block', coachId: coaches[0]?.id || '', date: todayStr, 
          time: '09:00', endTime: '12:00', reason: '內部訓練', customer: null, repeatWeeks: 1 
      });
      setIsBatchMode(true);
      setIsBlockModalOpen(true);
  };

  const handleAppointmentClick = (app: Appointment) => {
      if (!currentUser || (currentUser.role === 'coach' && app.coachId !== currentUser.id)) { return; }
      setBlockForm({ id: app.id, type: app.type, coachId: app.coachId, date: app.date, time: app.time, endTime: app.time, reason: app.reason || '', customer: app.customer || null });
      setIsBlockModalOpen(true);
  };

  const handleUserCheckIn = async (app: Appointment) => {
      if (liffProfile && app.lineUserId && app.lineUserId !== liffProfile.userId) { showNotification('此預約非您本人', 'error'); return; }
      await saveToFirestore('appointments', app.id, { ...app, status: 'checked_in' });
      addLog('學員簽到', `學員 ${app.customer?.name} 已簽到`);
      showNotification('簽到成功！請告知教練。', 'success');
  };

  const handleToggleComplete = async (app: Appointment) => {
      if (isProcessing) return;
      setIsProcessing(true);
      try {
          if (app.status === 'completed' && currentUser?.role === 'manager') { // Revert logic
              if (!window.confirm('確定要撤銷此完課紀錄並返還學員點數嗎？')) { setIsProcessing(false); return; }
              await batchUpdateFirestore([{ col: 'appointments', id: app.id, data: { status: 'confirmed' } }]);
              const inv = inventories.find(i => i.name === app.customer?.name);
              if (inv && (app.type === 'private')) {
                  await updateDoc(doc(db, 'user_inventory', inv.id), { 'credits.private': increment(1) });
                  addLog('庫存調整', `管理員 ${currentUser.name} 撤銷完課，返還 1 點`);
              }
              showNotification('已撤銷完課', 'success');
          } else if (['confirmed', 'checked_in'].includes(app.status)) { // Completion logic
              if (!window.confirm('確定要核實此課程並扣除學員點數嗎？')) { setIsProcessing(false); return; }
              const inv = inventories.find(i => i.name === app.customer?.name);
              if (app.type === 'private' && inv && inv.credits.private <= 0) {
                  if (!window.confirm('學員點數不足，仍要標示完課嗎？(不扣點)')) { setIsProcessing(false); return; }
              }
              
              const batch = writeBatch(db);
              batch.update(doc(db, 'appointments', app.id), { status: 'completed' });
              let logDetail = `確認 ${app.customer?.name} 完課`;
              if (app.type === 'private' && inv && inv.credits.private > 0) {
                  batch.update(doc(db, 'user_inventory', inv.id), { 'credits.private': increment(-1) });
                  logDetail += '，並扣除 1 點。';
              }
              await batch.commit();
              addLog('完課確認', logDetail);
              showNotification('完課確認成功！', 'success');
          }
      } catch(e) { showNotification('操作失敗', 'error'); } 
      finally { setIsProcessing(false); }
  };

  const handleBatchDelete = async () => {
      const toDelete = Array.from(selectedBatch).map(id => appointments.find(a => a.id === id)).filter(Boolean) as Appointment[];
      if (toDelete.some(a => ['completed', 'checked_in'].includes(a.status))) { showNotification('無法刪除已完課/簽到的項目', 'error'); return; }
      if(!window.confirm(`確定取消選取的 ${toDelete.length} 筆預約嗎？`)) return;
      await Promise.all(toDelete.map(app => handleCustomerCancel(app, '管理員批次取消')));
      addLog('批次取消', `取消 ${toDelete.length} 筆`);
      setSelectedBatch(new Set());
  };

  const handleSaveCoach = async (coachData: Coach, email?: string, password?: string) => {
    let uid = coachData.id;
    try {
        if (!uid && email && password) uid = await createAuthUser(email, password);
        if (!uid) { throw new Error("無法建立使用者 ID"); }

        await saveToFirestore('users', uid, { id: uid, name: coachData.name, role: coachData.role || 'coach', email: email || coachData.email || '', status: 'active', title: coachData.title || '教練' });
        await saveToFirestore('coaches', uid, { ...coachData, id: uid, role: coachData.role || 'coach', status: 'active' });

        addLog('員工管理', `更新/新增員工：${coachData.name}`);
        showNotification("員工資料已儲存", "success");
    } catch (error: any) { showNotification(`儲存失敗: ${error.message}`, "error"); }
  };

  const handleDeleteCoach = async (id: string, name: string) => {
    if (!window.confirm(`確定要停用 ${name} 嗎？此員工將無法再登入。`)) return;
    try {
        await disableUserInFirestore(id);
        // We keep the coach record for historical data, but you could delete it:
        // await deleteFromFirestore('coaches', id);
        addLog('員工管理', `停用員工：${name}`);
        showNotification(`${name} 已停用`, "success");
    } catch (error: any) { showNotification(`操作失敗: ${error.message}`, "error"); }
  };

  const handleExportJson = () => {
      const data = { appointments, coaches, logs, inventories, workoutPlans };
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
              const batch = writeBatch(db);
              if (data.appointments) data.appointments.forEach((d: any) => batch.set(doc(db, 'appointments', d.id), d));
              if (data.coaches) data.coaches.forEach((d: any) => batch.set(doc(db, 'coaches', d.id), d));
              if (data.inventories) data.inventories.forEach((d: any) => batch.set(doc(db, 'user_inventory', d.id), d));
              if (data.workoutPlans) data.workoutPlans.forEach((d: any) => batch.set(doc(db, 'workout_plans', d.id), d));
              await batch.commit();
              showNotification("資料匯入成功", "success");
          } catch (error) { showNotification("匯入失敗：格式錯誤", "error"); }
      };
      reader.readAsText(file);
  };
  
  const getAnalysis = () => ({}); // Simplified as custom range analysis is primary now

  const renderContent = () => {
      if (view === 'progress-tracking') {
        return (
            <ProgressTracking
                liffProfile={liffProfile}
                inventories={inventories}
                workoutPlans={workoutPlans}
                onBack={() => setView('my-bookings')}
            />
        );
      }
      
      if (view === 'my-bookings') {
          return (
              <MyBookings 
                  liffProfile={liffProfile}
                  appointments={appointments}
                  coaches={coaches}
                  onCancel={handleCustomerCancel}
                  onCheckIn={handleUserCheckIn}
                  inventories={inventories}
                  onNavigateToProgress={() => setView('progress-tracking')}
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
                handlePrevMonth={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                handleNextMonth={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
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
                      <input type="email" required className="w-full glass-input p-3.5 rounded-xl dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none" value={loginForm.email} onChange={e => setLoginForm({...loginForm, email: e.target.value})} placeholder="Email"/>
                      <input type="password" required className="w-full glass-input p-3.5 rounded-xl dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} placeholder="Password"/>
                      <button type="submit" disabled={isAuthLoading} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-all transform hover:scale-[1.02]">
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
            updateCoachWorkDays={(c) => saveToFirestore('coaches', c.id, c)}
            logs={logs}
            onSaveCoach={handleSaveCoach}
            onDeleteCoach={handleDeleteCoach}
            analysis={getAnalysis()}
            handleExportStatsCsv={() => {}}
            handleExportJson={handleExportJson}
            triggerImport={() => document.getElementById('file-importer')?.click()}
            handleFileImport={handleFileImport}
            selectedBatch={selectedBatch}
            toggleBatchSelect={(id: string) => setSelectedBatch(p => { const n = new Set(p); if(n.has(id)) n.delete(id); else n.add(id); return n; })}
            handleBatchDelete={handleBatchDelete}
            onOpenBatchBlock={handleOpenBatchBlock}
            onGoToBooking={() => setView('booking')}
            onToggleComplete={handleToggleComplete}
            onCancelAppointment={(app) => setConfirmModal({isOpen: true, title: '取消預約確認', message: `確定要取消 ${app.customer?.name} 的預約嗎？`, isDanger: true, showInput: true, onConfirm: (reason) => handleCustomerCancel(app, reason || '管理員後台取消')})}
            renderWeeklyCalendar={() => (<WeeklyCalendar currentWeekStart={currentWeekStart} setCurrentWeekStart={setCurrentWeekStart} currentUser={currentUser} coaches={coaches} appointments={appointments} onSlotClick={handleSlotClick} onAppointmentClick={handleAppointmentClick} onToggleComplete={handleToggleComplete} isLoading={dbStatus === 'connecting'} />)}
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
    <div className="min-h-screen text-slate-800 dark:text-slate-100 font-sans">
      <div className="fixed top-0 left-0 w-full h-full -z-10 bg-slate-50 dark:bg-slate-900"></div>

      {view !== 'admin' && (
        <nav className="fixed w-full z-50 glass-panel border-b border-white/20 dark:border-slate-800/50 shadow-sm backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => resetBooking()}>
                <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                    <CalendarIcon size={22}/>
                </div>
                <span className="font-bold text-xl tracking-tight text-slate-800 dark:text-white">
                    活力學苑
                </span>
                </div>
                <div className="flex items-center gap-2">
                <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 dark:text-slate-300">
                    {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                </button>
                {currentUser ? (
                    <button onClick={() => setView('admin')} className="hidden md:flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-xl font-bold text-sm">
                        <Settings size={16}/> 管理後台
                    </button>
                ) : (
                    <button onClick={() => setView('admin')} className="hidden md:flex items-center gap-2 text-sm font-bold text-slate-500">
                        <Lock size={16}/> 員工登入
                    </button>
                )}
                </div>
            </div>
            </div>
        </nav>
      )}

      <main className={`${view === 'admin' ? 'pt-0' : 'pt-24'} px-4 sm:px-6 lg:px-8 pb-12`}>
        {notification && (
          <div className={`fixed top-20 right-4 z-[70] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slideUp backdrop-blur-md border 
            ${notification.type === 'success' ? 'bg-green-500/90 text-white border-green-400' : 'bg-red-500/90 text-white border-red-400'}`}>
            <Info size={20}/>
            <span className="font-bold">{notification.msg}</span>
          </div>
        )}

        {renderContent()}
      </main>

      {view !== 'admin' && (
        <div className="md:hidden fixed bottom-0 w-full glass-panel border-t border-white/20 dark:border-slate-800/50 flex justify-around p-3 z-50 backdrop-blur-xl">
            <button onClick={() => resetBooking()} className={`flex flex-col items-center gap-1 ${view === 'booking' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
                <CalendarIcon size={24}/>
                <span className="text-[10px] font-bold">預約</span>
            </button>
             <button onClick={() => setView('progress-tracking')} className={`flex flex-col items-center gap-1 ${view === 'progress-tracking' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
                <Trophy size={24}/>
                <span className="text-[10px] font-bold">成就</span>
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

      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
             <div className="glass-panel w-full max-w-sm rounded-3xl p-8 animate-slideUp">
                 <div className="flex flex-col items-center text-center">
                     <div className="mb-6">{confirmModal.icon || <AlertTriangle size={48} className="text-orange-500"/>}</div>
                     <h3 className="font-bold text-xl mb-2 dark:text-white">{confirmModal.title || '確認'}</h3>
                     <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{confirmModal.message}</p>
                     {confirmModal.showInput && (
                         <input
                            type={confirmModal.inputType || 'text'} 
                            className="w-full glass-input p-3 rounded-xl mb-4 dark:text-white"
                            placeholder={confirmModal.inputLabel || '請輸入...'}
                            value={cancelReason} 
                            onChange={e => setCancelReason(e.target.value)}
                         />
                     )}
                     <div className="flex gap-3 w-full">
                         <button onClick={() => setConfirmModal({isOpen: false, onConfirm: null})} className="flex-1 py-3 bg-slate-200 dark:bg-slate-700 rounded-xl font-bold">取消</button>
                         <button onClick={() => { if(confirmModal.onConfirm) confirmModal.onConfirm(cancelReason); setConfirmModal({isOpen: false, onConfirm: null}); setCancelReason(''); }} className={`flex-1 py-3 text-white rounded-xl font-bold ${confirmModal.isDanger ? 'bg-red-500' : 'bg-indigo-600'}`}>確認</button>
                     </div>
                 </div>
             </div>
        </div>
      )}
      
      {isBlockModalOpen && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setIsBlockModalOpen(false)}>
            <div className="glass-panel w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-slideUp border border-white/40" onClick={e => e.stopPropagation()}>
                <div className="bg-white/50 dark:bg-slate-900/50 p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <h3 className="font-bold text-xl dark:text-white flex items-center gap-2">
                        {blockForm.id ? '管理行程' : (isBatchMode ? '批次封鎖時段' : '新增行程')}
                    </h3>
                    <div className="flex gap-2">
                        {blockForm.id && !isLockedForEditing && (
                            <button onClick={() => setDeleteConfirm(true)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg"><Trash2 size={20}/></button>
                        )}
                        {!blockForm.id && (
                           <button onClick={() => setIsBatchMode(!isBatchMode)} className={`p-2 rounded-lg ${isBatchMode ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}>
                              <Layers size={20}/>
                           </button>
                        )}
                    </div>
                </div>
                {deleteConfirm ? (
                    <div className="p-8 text-center"><h4 className="font-bold text-lg mb-2">確定要刪除嗎？</h4><p className="text-slate-500 text-sm mb-6">此動作無法復原</p><div className="flex gap-3"><button onClick={() => setDeleteConfirm(false)} className="flex-1 py-3 bg-slate-200 rounded-xl font-bold">取消</button><button onClick={handleActualDelete} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold">確認刪除</button></div></div>
                ) : (
                    <form onSubmit={handleSaveBlock} className="p-6 space-y-4">
                        {isLockedForEditing && (<div className="p-3 bg-yellow-50 rounded-xl text-xs text-yellow-700 border border-yellow-200 flex items-center gap-2"><AlertTriangle size={16}/>此預約已簽到/完課，無法修改。</div>)}
                        <div className="grid grid-cols-2 gap-4">
                           <select className="w-full glass-input rounded-xl p-3" value={blockForm.type} onChange={e => setBlockForm({...blockForm, type: e.target.value as any})} disabled={isLockedForEditing}>
                               <option value="block">內部事務</option><option value="private">私人課程</option><option value="group">團體課程</option>
                           </select>
                           {['manager', 'receptionist'].includes(currentUser.role) && (<select className="w-full glass-input rounded-xl p-3" value={blockForm.coachId} onChange={e => setBlockForm({...blockForm, coachId: e.target.value})} disabled={isLockedForEditing}>{coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>)}
                        </div>
                        <input type="date" required className="w-full glass-input rounded-xl p-3" value={blockForm.date} onChange={e => setBlockForm({...blockForm, date: e.target.value})} disabled={isLockedForEditing} />
                        <div className="grid grid-cols-2 gap-4 items-end">
                             <select className="w-full glass-input rounded-xl p-3" value={blockForm.time} onChange={e => setBlockForm({...blockForm, time: e.target.value})} disabled={isLockedForEditing}>{ALL_TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}</select>
                             {isBatchMode && (<select className="w-full glass-input rounded-xl p-3" value={blockForm.endTime} onChange={e => setBlockForm({...blockForm, endTime: e.target.value})} disabled={isLockedForEditing}>{ALL_TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}</select>)}
                        </div>
                        {blockForm.type === 'block' && (<div className="flex flex-wrap gap-2">{BLOCK_REASONS.map(r => (<button type="button" key={r} onClick={() => setBlockForm({...blockForm, reason: r})} className={`px-3 py-1.5 rounded-lg text-sm border ${blockForm.reason === r ? 'bg-indigo-600 text-white' : 'bg-white'}`}>{r}</button>))}</div>)}
                        {blockForm.type === 'group' && (<input type="text" required className="w-full glass-input rounded-xl p-3" placeholder="課程名稱..." value={blockForm.reason} onChange={e => setBlockForm({...blockForm, reason: e.target.value})} disabled={isLockedForEditing}/>)}
                        {blockForm.type === 'private' && (
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl space-y-2">{blockForm.customer?.name ? (<div className="flex justify-between items-center"><span className="font-bold">{blockForm.customer.name}</span><button type="button" onClick={() => setBlockForm({...blockForm, customer: null})} className="p-1 bg-slate-200 rounded-full"><X size={14}/></button></div>) : (<div className="relative"><input type="text" className="w-full glass-input rounded-xl p-3" placeholder="搜尋學員..." value={memberSearchTerm} onChange={(e) => setMemberSearchTerm(e.target.value)} autoFocus/>{memberSearchTerm && (<div className="absolute z-10 w-full mt-1 bg-white rounded-xl shadow-lg border max-h-48 overflow-y-auto">{filteredMembers.map(m => (<div key={m.id} onClick={() => { setBlockForm({...blockForm, customer: { name: m.name, phone: m.phone || '', email: m.email || '' } }); setMemberSearchTerm(''); }} className="p-2 hover:bg-indigo-50 cursor-pointer">{m.name} ({m.phone})</div>))}</div>)}</div>)}</div>
                        )}
                        {!blockForm.id && (<select className="w-full glass-input rounded-xl p-3" value={blockForm.repeatWeeks} onChange={e => setBlockForm({...blockForm, repeatWeeks: Number(e.target.value)})} disabled={isLockedForEditing}><option value={1}>單次</option><option value={4}>重複 4 週</option><option value={8}>重複 8 週</option></select>)}
                        <div className="pt-2 flex gap-3">
                            <button type="submit" disabled={isLockedForEditing} className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-bold disabled:bg-slate-400">{blockForm.id ? '儲存' : '新增'}</button>
                        </div>
                    </form>
                )}
            </div>
         </div>
      )}
    </div>
  );
}
