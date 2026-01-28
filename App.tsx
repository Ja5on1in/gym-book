
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
  Users,
  CheckCircle,
  Clock
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

const LIFF_ID = '2008923061-bPeQysat';

export default function App() {
  const [view, setView] = useState<'booking' | 'admin' | 'my-bookings'>('booking');
  const [adminTab, setAdminTab] = useState('calendar');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error' | 'info'} | null>(null);

  const [dbStatus, setDbStatus] = useState('connecting');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false); 
  
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

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const checkAndCreateUser = async (profile: { userId: string, displayName: string }) => {
      if (!db) return;
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
      } catch (e) { console.error(e); }
  };
  
  useEffect(() => {
    const start = async () => {
        await initAuth();
        const liff = (window as any).liff;
        if (liff) {
            try {
                await liff.init({ liffId: LIFF_ID });
                const params = new URLSearchParams(window.location.search);
                if (params.get('mode') === 'my-bookings') setView('my-bookings');
                if (liff.isLoggedIn()) {
                    const profile = await liff.getProfile();
                    setLiffProfile(profile);
                    await checkAndCreateUser(profile);
                }
            } catch (err) { console.error(err); }
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
              if (userProfile) {
                  if (userProfile.status === 'disabled') {
                      showNotification("此帳號已被停用", "error");
                      await logout();
                      setCurrentUser(null);
                  } else {
                      setCurrentUser(userProfile);
                  }
              }
          } else {
              setCurrentUser(null);
          }
          setIsAuthLoading(false);
      });
      return () => unsubscribe();
  }, []);

  useEffect(() => {
    const rangeStart = addDays(currentWeekStart, -14);
    const rangeEnd = addDays(currentWeekStart, 14);
    const startStr = formatDateKey(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate());
    const endStr = formatDateKey(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate());

    const unsubApps = subscribeToAppointmentsInRange(startStr, endStr, (data) => {
        setAppointments([...data] as Appointment[]);
        setDbStatus(isFirebaseAvailable ? 'connected' : 'local');
    }, () => setDbStatus('error'));

    const unsubLogs = subscribeToLogsInRange(rangeStart, rangeEnd, (data) => {
        setLogs((data as Log[]).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()));
    }, () => {});

    const unsubCoaches = subscribeToCollection('coaches', (data) => {
        if (data.length > 0) setCoaches([...data] as Coach[]);
        else if (!isFirebaseAvailable) setCoaches(INITIAL_COACHES);
    }, () => {});
    
    const unsubInventory = subscribeToCollection('user_inventory', (data) => {
        setInventories([...data] as UserInventory[]);
    }, () => {});

    const unsubWorkoutPlans = subscribeToCollection('workout_plans', (data) => {
        setWorkoutPlans([...data] as WorkoutPlan[]);
    }, () => {});

    return () => {
        unsubApps(); unsubCoaches(); unsubLogs(); unsubInventory(); unsubWorkoutPlans();
    };
  }, [currentWeekStart]);

  useEffect(() => {
      if (!memberSearchTerm) {
          setFilteredMembers([]); return;
      }
      const lowerTerm = memberSearchTerm.toLowerCase();
      setFilteredMembers(inventories.filter(inv => 
          inv.name.toLowerCase().includes(lowerTerm) || (inv.phone && inv.phone.includes(lowerTerm))
      ).slice(0, 6));
  }, [memberSearchTerm, inventories]);

  const showNotification = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const addLog = (action: string, details: string) => {
    const userName = currentUser ? (currentUser.name || currentUser.email || '未知員工') : '系統/客戶';
    saveToFirestore('logs', Date.now().toString(), { 
        id: Date.now().toString(), time: new Date().toISOString(), user: userName, action, details 
    });
  };

  const sendToGoogleScript = async (data: any) => {
    if (!GOOGLE_SCRIPT_URL) return;
    try {
        const fd = new FormData();
        fd.append('data', JSON.stringify(data));
        fd.append('timestamp', new Date().toISOString());
        fetch(GOOGLE_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: fd }).catch(() => {});
    } catch (e) { console.error(e); }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsAuthLoading(true);
      try { await loginWithEmail(loginForm.email, loginForm.password); } 
      catch (e: any) { showNotification("登入失敗: " + e.message, "error"); } 
      finally { setIsAuthLoading(false); }
  };

  const handleLogout = async () => {
      await logout(); setView('booking'); setAdminTab('calendar'); setLoginForm({ email: '', password: '' });
      showNotification("已登出", "info");
  };

  const handleLiffLogin = () => {
      const liff = (window as any).liff;
      if (liff && !liff.isLoggedIn()) liff.login({ redirectUri: window.location.href });
  };

  const handleSaveInventory = async (inventory: UserInventory) => {
      try {
          const id = inventory.id || (inventory.lineUserId || (inventory.phone ? `phone_${inventory.phone}` : `manual_${Date.now()}`));
          await saveToFirestore('user_inventory', id, { ...inventory, id, lastUpdated: new Date().toISOString() });
          showNotification('學員資料已更新', 'success');
      } catch (e) { showNotification('儲存失敗', 'error'); }
  };

  const handleDeleteInventory = async (inventory: UserInventory) => {
    setConfirmModal({
        isOpen: true, title: '刪除會員', message: `確定刪除 ${inventory.name}？`, isDanger: true, showInput: true, inputLabel: '密碼', inputType: 'password',
        onConfirm: async (password) => {
            const adminEmail = auth.currentUser?.email || currentUser?.email;
            if (!currentUser || !adminEmail || !auth.currentUser) return;
            try {
                const credential = EmailAuthProvider.credential(adminEmail, password || '');
                await reauthenticateWithCredential(auth.currentUser, credential);
                await deleteFromFirestore('user_inventory', inventory.id);
                showNotification('學員已刪除', 'success');
            } catch (error: any) { showNotification('密碼錯誤', 'error'); }
        }
    });
  };

  const handleSaveWorkoutPlan = async (plan: WorkoutPlan) => {
      try {
          const id = plan.id || `${Date.now()}`;
          await saveToFirestore('workout_plans', id, { ...plan, id, createdAt: plan.createdAt || new Date().toISOString() });
          showNotification('課表已儲存', 'success');
      } catch (e) { showNotification('儲存失敗', 'error'); }
  };

  const handleDeleteWorkoutPlan = async (id: string) => {
      try { await deleteFromFirestore('workout_plans', id); showNotification('課表已刪除', 'success'); } 
      catch (e) { showNotification('刪除失敗', 'error'); }
  };

  const handleSubmitBooking = async (e: React.FormEvent, lineProfile?: { userId: string, displayName: string }) => {
    if (e) e.preventDefault();
    if (!selectedSlot || !selectedCoach || !selectedService) { showNotification('請選擇服務與時段', 'error'); return; }
    
    const dateKey = formatDateKey(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const status = getSlotStatus(dateKey, selectedSlot, selectedCoach, appointments);
    
    if (status.status === 'booked') { 
        showNotification('該時段已滿', 'error'); return; 
    }

    try {
        const id = Date.now().toString();
        const newApp: Appointment = { 
            id, type: 'private', date: dateKey, time: selectedSlot, 
            service: selectedService, coachId: selectedCoach.id, coachName: selectedCoach.name, 
            customer: { name: formData.name, phone: formData.phone, email: formData.email }, 
            status: 'confirmed', createdAt: new Date().toISOString(),
            lineUserId: lineProfile?.userId || "", lineName: lineProfile?.displayName || "" 
        };
        await saveToFirestore('appointments', id, newApp);
        setBookingStep(5);
        showNotification('預約成功！', 'success');
    } catch (error: any) { showNotification('預約失敗: ' + error.message, 'error'); }
  };

  const handleCustomerCancel = async (app: Appointment, reason: string) => {
      if (isProcessing) return;
      setIsProcessing(true);
      try {
          const originalStatus = app.status;
          await saveToFirestore('appointments', app.id, { ...app, status: 'cancelled', cancelReason: reason });
          if (originalStatus === 'completed' && app.customer?.phone) {
              const inventory = inventories.find(i => i.phone === app.customer?.phone);
              if (inventory) {
                  const creditKey = (app.type === 'private' || (app.type as any) === 'client') ? 'credits.private' : 'credits.group';
                  await updateDoc(doc(db, 'user_inventory', inventory.id), { [creditKey]: increment(1) });
              }
          }
          showNotification('已取消預約', 'info');
      } catch (e) { showNotification('取消失敗', 'error'); } 
      finally { setIsProcessing(false); }
  };

  const resetBooking = () => {
    setBookingStep(1); setSelectedService(null); setSelectedCoach(null); setSelectedSlot(null);
  };

  const handleSaveBlock = async (e: React.FormEvent) => {
    if(e) e.preventDefault();
    if (!currentUser) return;
    const coachId = ['manager', 'receptionist'].includes(currentUser.role) ? blockForm.coachId : currentUser.id;
    const coach = coaches.find(c => c.id === coachId);
    if (!coach) return;
    
    const isGroup = blockForm.type === 'group';
    const isPrivate = blockForm.type === 'private';
    
    if ((isPrivate || isGroup) && !blockForm.customer?.name) {
        showNotification('請選擇學員', 'error'); return;
    }
    
    let targetSlots = [blockForm.time];
    if (isBatchMode && blockForm.endTime) {
        const startIndex = ALL_TIME_SLOTS.indexOf(blockForm.time);
        const endIndex = ALL_TIME_SLOTS.indexOf(blockForm.endTime);
        if (endIndex > startIndex) targetSlots = ALL_TIME_SLOTS.slice(startIndex, endIndex);
    }

    const repeat = blockForm.repeatWeeks || 1;
    const [y, m, d] = blockForm.date.split('-').map(Number);
    const startDate = new Date(y, m - 1, d); 

    try {
        for (let i = 0; i < repeat; i++) {
            const targetDate = new Date(startDate);
            targetDate.setDate(startDate.getDate() + (i * 7));
            const dKey = formatDateKey(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

            for (const slot of targetSlots) {
                const status = getSlotStatus(dKey, slot, coach, appointments, blockForm.id);
                
                // CRITICAL FIX: Group class check
                if (isGroup) {
                    const currentParticipants = appointments.filter(a => 
                        a.date === dKey && a.time === slot && a.coachId === coach.id && a.type === 'group' && a.status !== 'cancelled'
                    );
                    if (currentParticipants.length >= 8) {
                        showNotification(`${dKey} ${slot} 已達人數上限`, 'error');
                        continue;
                    }
                    // If slot has a different type already, skip
                    if (currentParticipants.length === 0 && status.status === 'booked' && status.type !== 'group') {
                        showNotification(`${dKey} ${slot} 時段衝突`, 'error');
                        continue;
                    }
                } else if (status.status === 'booked') {
                    showNotification(`${dKey} ${slot} 時段衝突`, 'error');
                    continue;
                }

                const id = (!isBatchMode && i === 0 && blockForm.id) ? blockForm.id : `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const newApp: Appointment = { 
                    id, type: blockForm.type as any, date: dKey, time: slot,
                    coachId: coach.id, coachName: coach.name, reason: blockForm.reason, status: 'confirmed', 
                    customer: blockForm.customer, createdAt: new Date().toISOString(), 
                    lineUserId: inventories.find(inv => inv.name === blockForm.customer?.name)?.lineUserId || "",
                    maxAttendees: isGroup ? 8 : 1
                };
                await saveToFirestore('appointments', id, newApp);
            }
        }
        showNotification(`操作成功`, 'success');
        setIsBlockModalOpen(false);
    } catch (e: any) { showNotification(`儲存失敗: ${e.message}`, 'error'); }
  };

  const handleActualDelete = async () => {
     if (!blockForm.id) return;
     const target = appointments.find(a => a.id === blockForm.id);
     if (!target) return;
     if (target.type !== 'block') { 
         setConfirmModal({
             isOpen: true, title: '取消預約', message: '請輸入原因', isDanger: true, showInput: true,
             onConfirm: async (reason) => {
                 await handleCustomerCancel(target, reason || '手動取消'); setIsBlockModalOpen(false);
             }
         });
     } else {
         await deleteFromFirestore('appointments', target.id); setIsBlockModalOpen(false);
     }
  };

  const handleSlotClick = (date: string, time: string) => {
    if (!currentUser) return;
    const coachId = (['manager', 'receptionist'].includes(currentUser.role)) ? (coaches.find(c => !isCoachDayOff(date, c))?.id || "") : currentUser.id;
    if (!coachId) return;
    setBlockForm({ 
        id: null, type: 'private', coachId, date, time, endTime: ALL_TIME_SLOTS[ALL_TIME_SLOTS.indexOf(time)+1] || time, 
        reason: '1v1教練課', customer: null, repeatWeeks: 1 
    });
    setMemberSearchTerm(''); setIsBatchMode(false); setIsBlockModalOpen(true);
  };

  const handleAppointmentClick = (app: Appointment) => {
      if (!currentUser) return;
      setBlockForm({ id: app.id, type: app.type as any, coachId: app.coachId, date: app.date, time: app.time, endTime: app.time, reason: app.reason || '', customer: app.customer || null });
      setMemberSearchTerm(''); setIsBatchMode(false); setIsBlockModalOpen(true);
  };

  const handleUserCheckIn = async (app: Appointment) => {
      await saveToFirestore('appointments', app.id, { ...app, status: 'checked_in' });
      showNotification('簽到成功！', 'success');
  };

  const handleCoachConfirmCompletion = async (app: Appointment, force = false) => {
      if (isProcessing) return;
      if (!force && !window.confirm('確認完課並扣點？')) return;
      setIsProcessing(true);
      try {
          const isPrivate = app.type === 'private' || (app.type as any) === 'client';
          const creditKey = isPrivate ? 'private' : 'group';
          const inventory = inventories.find(i => i.phone === app.customer?.phone || i.lineUserId === app.lineUserId);
          
          const batch = writeBatch(db);
          batch.update(doc(db, 'appointments', app.id), { status: 'completed' });
          if (inventory && inventory.credits[creditKey] > 0) {
              batch.update(doc(db, 'user_inventory', inventory.id), { [`credits.${creditKey}`]: increment(-1) });
          }
          await batch.commit();
          showNotification('完課成功', 'success');
      } catch (e) { showNotification('失敗', 'error'); } 
      finally { setIsProcessing(false); }
  };
  
  const handleRevertCompletion = async (app: Appointment) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
        const isPrivate = app.type === 'private' || (app.type as any) === 'client';
        const creditKey = isPrivate ? 'private' : 'group';
        const inventory = inventories.find(i => i.phone === app.customer?.phone || i.lineUserId === app.lineUserId);
        const batch = writeBatch(db);
        batch.update(doc(db, 'appointments', app.id), { status: 'confirmed' });
        if (inventory) batch.update(doc(db, 'user_inventory', inventory.id), { [`credits.${creditKey}`]: increment(1) });
        await batch.commit();
        showNotification('已撤銷', 'success');
    } catch(e) { console.error(e); } 
    finally { setIsProcessing(false); }
  };

  const handleToggleComplete = async (app: Appointment) => {
    if (app.status !== 'completed') handleCoachConfirmCompletion(app);
    else if (currentUser?.role === 'manager') handleRevertCompletion(app);
  };

  const handleBatchDelete = async () => {
      const selectedApps = Array.from(selectedBatch).map(id => appointments.find(a => a.id === id)).filter(Boolean) as Appointment[];
      await Promise.all(selectedApps.map(app => handleCustomerCancel(app, '批次取消')));
      setSelectedBatch(new Set());
  };

  const handleSaveCoach = async (coachData: Coach, email?: string, password?: string) => {
    let uid = coachData.id;
    if (!uid && email && password) uid = await createAuthUser(email, password);
    await saveToFirestore('users', uid, { id: uid, name: coachData.name, role: coachData.role, email: email || coachData.email, status: 'active' });
    await saveToFirestore('coaches', uid, { ...coachData, id: uid });
    showNotification("員工資料已儲存", "success");
  };

  // Fixed: Added missing updateCoachWorkDays function
  const updateCoachWorkDays = async (coach: Coach) => {
    try {
      await saveToFirestore('coaches', coach.id, coach);
      showNotification('班表已更新', 'success');
      addLog('班表更新', `更新教練 ${coach.name} 的班表`);
    } catch (e) {
      showNotification('更新班表失敗', 'error');
    }
  };

  // Fixed: Added missing handleDeleteCoach function
  const handleDeleteCoach = async (id: string, name: string) => {
    if (window.confirm(`確定要刪除教練 ${name} 嗎？`)) {
      try {
        await deleteFromFirestore('coaches', id);
        await disableUserInFirestore(id);
        showNotification('教練已刪除', 'success');
        addLog('刪除教練', `刪除教練: ${name} (ID: ${id})`);
      } catch (e) {
        showNotification('刪除失敗', 'error');
      }
    }
  };

  const getAnalysis = () => {
    const totalActive = appointments.filter(a => a.status === 'confirmed').length;
    return { totalActive, totalCancelled: 0, topTimeSlots: [], coachStats: [] };
  };

  const currentAppointmentForModal = blockForm.id ? appointments.find(a => a.id === blockForm.id) : null;
  const isLockedForEditing = !!currentAppointmentForModal && ['checked_in', 'completed'].includes(currentAppointmentForModal.status);
  const groupParticipants = (blockForm.type === 'group' && blockForm.coachId && blockForm.date && blockForm.time && blockForm.reason) 
    ? appointments.filter(a => a.date === blockForm.date && a.time === blockForm.time && a.coachId === blockForm.coachId && a.type === 'group' && a.status !== 'cancelled' && a.reason === blockForm.reason) : [];

  return (
    <div className="min-h-screen text-slate-800 dark:text-slate-100 transition-colors duration-300 font-sans selection:bg-indigo-500 selection:text-white">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-300/20 dark:bg-indigo-900/10 rounded-full blur-3xl animate-float"></div>
      </div>

      {view !== 'admin' && (
        <nav className="fixed w-full z-50 glass-panel border-b border-white/20 dark:border-slate-800 shadow-sm backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setView('booking'); resetBooking(); }}>
                <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                    <CalendarIcon size={22} className="stroke-[2.5px]"/>
                </div>
                <span className="font-bold text-xl tracking-tight dark:text-white">活力學苑預約系統</span>
                </div>
                <div className="flex items-center gap-4">
                <button onClick={() => setView('my-bookings')} className={`hidden md:flex items-center gap-2 px-3 py-2 rounded-lg transition-colors font-bold text-sm ${view === 'my-bookings' ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' : 'text-slate-500'}`}>
                    <UserIcon size={18}/> 我的預約
                </button>
                <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-500 dark:text-slate-300">
                    {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                </button>
                {currentUser && <button onClick={() => setView('admin')} className="hidden md:flex bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-xl transition-all font-bold text-sm">管理後台</button>}
                </div>
            </div>
            </div>
        </nav>
      )}

      <main className={`${view === 'admin' ? 'pt-0' : 'pt-24'} px-0 pb-12`}>
        {notification && (
          <div className={`fixed top-20 right-4 z-[60] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slideUp backdrop-blur-md border ${notification.type === 'success' ? 'bg-green-500/90' : 'bg-red-500/90'} text-white`}>
            <span className="font-bold">{notification.msg}</span>
          </div>
        )}
        {view === 'my-bookings' ? <MyBookings liffProfile={liffProfile} appointments={appointments} coaches={coaches} onCancel={handleCustomerCancel} onCheckIn={handleUserCheckIn} inventories={inventories} workoutPlans={workoutPlans}/> :
         view === 'booking' ? <BookingWizard step={bookingStep} setStep={setBookingStep} selectedService={selectedService} setSelectedService={setSelectedService} selectedCoach={selectedCoach} setSelectedCoach={setSelectedCoach} selectedDate={selectedDate} setSelectedDate={setSelectedDate} selectedSlot={selectedSlot} setSelectedSlot={setSelectedSlot} formData={formData} setFormData={setFormData} coaches={coaches} appointments={appointments} onSubmit={handleSubmitBooking} reset={resetBooking} currentDate={currentDate} handlePrevMonth={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} handleNextMonth={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} inventories={inventories} onRegisterUser={checkAndCreateUser} liffProfile={liffProfile} onLogin={handleLiffLogin}/> :
         !currentUser ? <div className="max-w-md mx-auto mt-10 p-8 glass-panel rounded-3xl"><h2 className="text-xl font-bold mb-4">員工登入</h2><form onSubmit={handleEmailLogin} className="space-y-4"><input type="email" required className="w-full glass-input p-3 rounded-xl" placeholder="Email" value={loginForm.email} onChange={e=>setLoginForm({...loginForm, email: e.target.value})}/><input type="password" required className="w-full glass-input p-3 rounded-xl" placeholder="密碼" value={loginForm.password} onChange={e=>setLoginForm({...loginForm, password: e.target.value})}/><button className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold">登入</button></form></div> :
         <AdminDashboard currentUser={currentUser} onLogout={handleLogout} adminTab={adminTab} setAdminTab={setAdminTab} appointments={appointments} coaches={coaches} updateCoachWorkDays={updateCoachWorkDays} logs={logs} onSaveCoach={handleSaveCoach} onDeleteCoach={handleDeleteCoach} analysis={getAnalysis()} handleExportStatsCsv={()=>{}} handleExportJson={()=>{}} triggerImport={()=>{}} handleFileImport={()=>{}} selectedBatch={selectedBatch} toggleBatchSelect={id=>{const n=new Set(selectedBatch); if(n.has(id)) n.delete(id); else n.add(id); setSelectedBatch(n);}} handleBatchDelete={handleBatchDelete} onOpenBatchBlock={()=>{setIsBatchMode(true); setIsBlockModalOpen(true);}} onGoToBooking={()=>setView('booking')} onToggleComplete={handleToggleComplete} onCancelAppointment={()=>{}} renderWeeklyCalendar={()=><WeeklyCalendar currentWeekStart={currentWeekStart} setCurrentWeekStart={setCurrentWeekStart} currentUser={currentUser} coaches={coaches} appointments={appointments} onSlotClick={handleSlotClick} onAppointmentClick={handleAppointmentClick} onToggleComplete={handleToggleComplete} isLoading={dbStatus==='connecting'}/>} inventories={inventories} onSaveInventory={handleSaveInventory} onDeleteInventory={handleDeleteInventory} workoutPlans={workoutPlans} onSavePlan={handleSaveWorkoutPlan} onDeletePlan={handleDeleteWorkoutPlan}/>}
      </main>

      {isBlockModalOpen && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setIsBlockModalOpen(false)}>
            <div className="glass-panel w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-slideUp border border-white/40 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <h3 className="font-bold text-xl dark:text-white flex items-center gap-2">
                        {blockForm.id ? (blockForm.type === 'group' ? <Users size={20}/> : <Settings size={20}/>) : <CalendarIcon size={20}/>}
                        {blockForm.id ? (blockForm.type === 'group' ? '團體課詳情' : '修改行程') : '新增行程'}
                    </h3>
                    <div className="flex gap-2">
                        {blockForm.id && !isLockedForEditing && <button onClick={() => setDeleteConfirm(true)} className="text-red-500 p-2"><Trash2 size={20}/></button>}
                        <button onClick={() => setIsBlockModalOpen(false)}><X size={20}/></button>
                    </div>
                </div>
                
                <div className="overflow-y-auto custom-scrollbar flex-1 p-6">
                {deleteConfirm ? <div className="text-center py-8"><h4 className="font-bold text-lg mb-4">確定刪除？</h4><div className="flex gap-3"><button onClick={()=>setDeleteConfirm(false)} className="flex-1 py-3 bg-slate-200 rounded-xl">取消</button><button onClick={handleActualDelete} className="flex-1 py-3 bg-red-500 text-white rounded-xl">刪除</button></div></div> :
                <form onSubmit={handleSaveBlock} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500">類型</label>
                            <select className="w-full glass-input rounded-xl p-3 mt-1" value={blockForm.type} onChange={e=>setBlockForm({...blockForm, type: e.target.value as any})} disabled={!!blockForm.id}>
                                <option value="block">內部事務</option>
                                <option value="private">私人課程</option>
                                <option value="group">團體課程</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500">教練</label>
                            <select className="w-full glass-input rounded-xl p-3 mt-1" value={blockForm.coachId} onChange={e=>setBlockForm({...blockForm, coachId: e.target.value})} disabled={isLockedForEditing}>
                                {coaches.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500">日期</label>
                        <input type="date" className="w-full glass-input rounded-xl p-3 mt-1" value={blockForm.date} onChange={e=>setBlockForm({...blockForm, date: e.target.value})} disabled={isLockedForEditing}/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500">時間</label>
                        <select className="w-full glass-input rounded-xl p-3 mt-1" value={blockForm.time} onChange={e=>setBlockForm({...blockForm, time: e.target.value})} disabled={isLockedForEditing}>
                            {ALL_TIME_SLOTS.map(t=><option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    {blockForm.type === 'group' && (
                         <div>
                             <label className="text-xs font-bold text-slate-500">課程名稱</label>
                             <input type="text" className="w-full glass-input rounded-xl p-3 mt-1" placeholder="課程名稱" value={blockForm.reason} onChange={e=>setBlockForm({...blockForm, reason: e.target.value})} disabled={isLockedForEditing && !blockForm.id}/>
                         </div>
                    )}

                    {blockForm.type === 'group' && blockForm.id && (
                        <div className="space-y-2 border-t pt-4">
                            <h4 className="text-sm font-bold flex items-center gap-2 text-indigo-600"><Users size={16}/> 學員名單 ({groupParticipants.length}/8)</h4>
                            {groupParticipants.map(p => (
                                <div key={p.id} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                    <div className="text-xs">
                                        <div className="font-bold">{p.customer?.name}</div>
                                        <div className="opacity-60">{p.customer?.phone}</div>
                                    </div>
                                    <button type="button" onClick={()=>{if(window.confirm('移除？')) handleCustomerCancel(p, '管理員移除');}} className="text-red-500 p-1"><X size={14}/></button>
                                </div>
                            ))}
                        </div>
                    )}

                    {(blockForm.type === 'private' || blockForm.type === 'group') && (
                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl space-y-2">
                            <label className="text-xs font-bold text-indigo-500">{blockForm.id && blockForm.type==='group' ? '新增學員' : '學員搜尋'}</label>
                            <input type="text" className="w-full glass-input rounded-xl p-3 mt-1" placeholder="輸入姓名/電話搜尋..." value={memberSearchTerm} onChange={e=>setMemberSearchTerm(e.target.value)}/>
                            {memberSearchTerm && filteredMembers.map(m=>(
                                <div key={m.id} onClick={()=>{setBlockForm({...blockForm, customer:{name:m.name, phone:m.phone||"", email:m.email||""}}); setMemberSearchTerm("");}} className="p-2 hover:bg-white dark:hover:bg-slate-700 cursor-pointer rounded-lg text-xs font-bold">
                                    {m.name} ({m.phone}) - 餘課: {blockForm.type==='group'?m.credits.group:m.credits.private}
                                </div>
                            ))}
                            {blockForm.customer?.name && <div className="mt-2 text-xs font-bold text-indigo-600">已選：{blockForm.customer.name}</div>}
                        </div>
                    )}
                    <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold">{blockForm.id ? (blockForm.type==='group'?'加入學員':'儲存') : '新增'}</button>
                </form>}
                </div>
            </div>
         </div>
      )}
    </div>
  );
}
