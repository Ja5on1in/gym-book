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
  Key,
  Database,
  Mail,
  Lock as LockIcon
} from 'lucide-react';

import { 
    initAuth, 
    subscribeToCollection, 
    saveToFirestore, 
    deleteFromFirestore, 
    disableUserInFirestore,
    isFirebaseAvailable, 
    loginWithEmail, 
    logout,
    auth,
    getUserProfile,
    createAuthUser
} from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';

import { INITIAL_COACHES, ALL_TIME_SLOTS, BLOCK_REASONS, GOOGLE_SCRIPT_URL } from './constants';
import { User, Appointment, Coach, Log, Service, Customer, BlockFormState } from './types';
import { formatDateKey, getStartOfWeek, getSlotStatus, isCoachDayOff } from './utils';

import BookingWizard from './components/BookingWizard';
import AdminDashboard from './components/AdminDashboard';
import WeeklyCalendar from './components/WeeklyCalendar';

export default function App() {
  // --- STATE ---
  const [view, setView] = useState<'booking' | 'admin'>('booking');
  const [adminTab, setAdminTab] = useState('calendar');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error' | 'info'} | null>(null);

  const [dbStatus, setDbStatus] = useState('connecting');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  // Login State
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  
  // Data
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);

  // Dates
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek(new Date()));

  // Booking Flow
  const [bookingStep, setBookingStep] = useState(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [formData, setFormData] = useState<Customer>({ name: '', phone: '', email: '' });

  // Modals & Forms
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [blockForm, setBlockForm] = useState<BlockFormState>({
    id: null, type: 'block', coachId: '', date: formatDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()), time: '09:00', reason: '1v1教練課', customer: null, repeatWeeks: 1
  });
  const [selectedBatch, setSelectedBatch] = useState<Set<string>>(new Set());
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, message: string, onConfirm: ((reason?: string) => void) | null, isDanger: boolean, showInput: boolean}>({ isOpen: false, message: '', onConfirm: null, isDanger: false, showInput: false });
  const [cancelReason, setCancelReason] = useState('');

  // --- EFFECTS ---

  useEffect(() => {
    // Theme toggle
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  useEffect(() => {
    const start = async () => {
        await initAuth();
    };
    start();
  }, []);

  // Listen to Auth State
  useEffect(() => {
      if (!auth) {
          setIsAuthLoading(false);
          return;
      }
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          setIsAuthLoading(true);
          if (firebaseUser) {
              // Fetch user role from DB
              const userProfile = await getUserProfile(firebaseUser.uid);
              if (userProfile) {
                  // Check if account is disabled
                  if (userProfile.status === 'disabled') {
                      showNotification("此帳號已被停用，請聯繫管理員", "error");
                      await logout();
                      setCurrentUser(null);
                  } else {
                      setCurrentUser(userProfile);
                      addLog('系統登入', `${userProfile.name} (${userProfile.role}) 登入成功`);
                      // Only set coachId default if user is a coach
                      if (userProfile.role === 'coach') {
                        setBlockForm(prev => ({...prev, coachId: userProfile.id})); 
                      }
                  }
              } else {
                  console.warn("User has no profile in DB");
                  showNotification("您的帳號尚未設定權限，請聯繫管理員", "error");
                  await logout();
                  setCurrentUser(null);
              }
          } else {
              setCurrentUser(null);
          }
          setIsAuthLoading(false);
      });
      return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubApps = subscribeToCollection('appointments', (data) => {
        const apps = data as Appointment[];
        const validApps = apps.filter(a => a && a.date && a.time && a.coachId);
        setAppointments(validApps);
        setDbStatus(isFirebaseAvailable ? 'connected' : 'local');
        
        if (validApps.length > 0) localStorage.setItem('gym_backup_local', JSON.stringify(validApps));
    }, () => setDbStatus('error'));

    const unsubCoaches = subscribeToCollection('coaches', (data) => {
        if (data.length > 0) {
            setCoaches(data as Coach[]);
        } else {
             if (!isFirebaseAvailable && coaches.length === 0) setCoaches(INITIAL_COACHES);
        }
    }, () => {});

    const unsubLogs = subscribeToCollection('logs', (data) => {
        const loaded = data as Log[];
        setLogs(loaded.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()));
    }, () => {});

    return () => {
        unsubApps();
        unsubCoaches && unsubCoaches();
        unsubLogs && unsubLogs();
    };
  }, []);

  // --- ACTIONS ---

  const showNotification = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const addLog = (action: string, details: string) => {
    saveToFirestore('logs', Date.now().toString(), { 
        id: Date.now().toString(), 
        time: new Date().toISOString(), 
        user: currentUser ? currentUser.name : '系統/客戶', 
        action, details 
    });
  };

  const sendToGoogleScript = async (data: any) => {
    if (!GOOGLE_SCRIPT_URL) return;
    try {
        const fd = new FormData();
        fd.append('data', JSON.stringify(data));
        fd.append('timestamp', new Date().toISOString());
        await fetch(GOOGLE_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: fd });
    } catch (e) { console.error(e); }
  };

  // Auth Actions
  const handleEmailLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          await loginWithEmail(loginForm.email, loginForm.password);
      } catch (e: any) {
          if (e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
              showNotification("帳號或密碼錯誤", "error");
          } else {
              showNotification("登入失敗: " + e.message, "error");
          }
      }
  };

  const handleLogout = async () => {
      await logout();
      setView('booking');
      setAdminTab('calendar');
      setLoginForm({ email: '', password: '' });
      showNotification("已登出", "info");
  };

  // Booking
  const handleSubmitBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !selectedSlot || !selectedCoach || !selectedService) { 
        showNotification('請填寫完整資訊', 'error'); return; 
    }
    const dateKey = formatDateKey(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const status = getSlotStatus(dateKey, selectedSlot, selectedCoach, appointments);
    
    if (status.status === 'booked') { 
        showNotification('該時段已被預約', 'error'); setBookingStep(3); return; 
    }

    const id = Date.now().toString();
    const newApp: Appointment = { 
        id, type: 'client', date: dateKey, time: selectedSlot, 
        service: selectedService, coachId: selectedCoach.id, coachName: selectedCoach.name, 
        customer: { ...formData }, status: 'confirmed', createdAt: new Date().toISOString() 
    };
    
    saveToFirestore('appointments', id, newApp);
    addLog('前台預約', `客戶 ${formData.name} 預約 ${selectedCoach.name}`);
    sendToGoogleScript({ action: 'create_booking', ...newApp });
    setBookingStep(5);
    showNotification('預約成功！', 'success');
  };

  const resetBooking = () => {
    setBookingStep(1); setSelectedService(null); setSelectedCoach(null); setSelectedSlot(null); setFormData({ name: '', phone: '', email: '' });
  };

  // Admin Actions
  const handleSaveBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const coach = coaches.find(c => c.id === (currentUser.role === 'manager' ? blockForm.coachId : currentUser.id));
    if (!coach) return;
    
    const repeat = blockForm.repeatWeeks || 1;
    const batchOps: Appointment[] = [];
    const [y, m, d] = blockForm.date.split('-').map(Number);
    const startDate = new Date(y, m - 1, d); 

    for (let i = 0; i < repeat; i++) {
        const targetDate = new Date(startDate);
        targetDate.setDate(startDate.getDate() + (i * 7));
        
        const dKey = formatDateKey(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        const status = getSlotStatus(dKey, blockForm.time, coach, appointments, blockForm.id);
        
        if (status.status === 'available') {
            const id = (i === 0 && blockForm.id) ? blockForm.id : Date.now().toString() + i;
            batchOps.push({ 
                id, type: blockForm.type, date: dKey, time: blockForm.time, 
                coachId: coach.id, coachName: coach.name, reason: blockForm.reason, 
                status: 'confirmed', customer: blockForm.type === 'client' ? blockForm.customer : null, 
                createdAt: new Date().toISOString() 
            });
        }
    }

    if (batchOps.length === 0) { showNotification('時段已被占用或無法新增', 'error'); return; }
    
    await Promise.all(batchOps.map(op => saveToFirestore('appointments', op.id, op)));
    addLog(blockForm.id ? '修改事件' : '新增事件', `處理 ${batchOps.length} 筆`);
    showNotification('儲存成功', 'success');
    setIsBlockModalOpen(false);
  };

  const handleActualDelete = () => {
     if (!blockForm.id) return;
     const target = appointments.find(a => a.id === blockForm.id);
     if (!target) return;
     
     if (target.type === 'client') {
         setConfirmModal({
             isOpen: true, message: '請輸入取消預約的原因', isDanger: true, showInput: true,
             onConfirm: (reason) => {
                 const updated = { ...target, status: 'cancelled' as const, cancelReason: reason };
                 saveToFirestore('appointments', target.id, updated);
                 addLog('取消預約', `取消 ${target.customer?.name} - ${reason}`);
                 sendToGoogleScript({ action: 'cancel_booking', id: target.id, reason });
                 showNotification('已取消', 'info');
                 setIsBlockModalOpen(false);
             }
         });
     } else {
         deleteFromFirestore('appointments', target.id);
         addLog('刪除事件', `刪除 ${target.reason}`);
         showNotification('已刪除', 'info');
         setIsBlockModalOpen(false);
     }
  };

  const handleSlotClick = (date: string, time: string) => {
      if (!currentUser) return;
      const targetCoachId = currentUser.role === 'manager' ? (blockForm.coachId || coaches[0]?.id) : currentUser.id;
      if (!targetCoachId) { showNotification('無教練資料', 'error'); return; }

      const coach = coaches.find(c => c.id === targetCoachId);
      if (coach && isCoachDayOff(date, coach)) { showNotification('排休日無法新增', 'error'); return; }
      
      setBlockForm({ id: null, type: 'block', coachId: targetCoachId, date, time, reason: '1v1教練課', customer: null, repeatWeeks: 1 });
      setDeleteConfirm(false); 
      setIsBlockModalOpen(true);
  };

  const handleAppointmentClick = (app: Appointment) => {
      if (!currentUser) return;
      if (currentUser.role === 'coach' && app.coachId !== currentUser.id) { showNotification('權限不足', 'info'); return; }
      setBlockForm({ id: app.id, type: app.type, coachId: app.coachId, date: app.date, time: app.time, reason: app.reason || '', customer: app.customer || null });
      setDeleteConfirm(false); 
      setIsBlockModalOpen(true);
  };

  const handleToggleComplete = async (app: Appointment) => {
    const newVal = !app.isCompleted;
    await saveToFirestore('appointments', app.id, { ...app, isCompleted: newVal });
    addLog('課程狀態', `${app.customer?.name || app.reason} - ${newVal ? '已結課' : '未結課'}`);
  };

  // --- STAFF & COACH MANAGEMENT ---

  const handleSaveCoach = async (coachData: Coach, email?: string, password?: string) => {
    let uid = coachData.id;
    try {
        if (!uid && email && password) {
            // New Coach: Create in Auth first
            uid = await createAuthUser(email, password);
        }

        if (!uid) {
            showNotification("無法建立使用者 ID", "error");
            return;
        }

        const commonData = {
            name: coachData.name,
            role: coachData.role,
            email: email || coachData.email || '', // Keep existing if editing
            status: 'active'
        };

        // 1. Update/Create in 'users' collection (for Auth/Role check)
        await saveToFirestore('users', uid, {
            id: uid,
            ...commonData
        });

        // 2. Update/Create in 'coaches' collection (for Booking logic)
        // Ensure ID is set in the data
        await saveToFirestore('coaches', uid, {
            ...coachData,
            id: uid,
            status: 'active' // Ensure active status
        });

        addLog('員工管理', `更新/新增員工：${coachData.name}`);
        showNotification("員工資料已儲存", "success");
    } catch (error: any) {
        console.error(error);
        showNotification(`儲存失敗: ${error.message}`, "error");
    }
  };

  const handleDeleteCoach = async (id: string, name: string) => {
    if (!window.confirm(`確定要刪除 ${name} 嗎？\n\n注意：\n1. 該員工將無法登入\n2. 該員工將從預約選單中移除`)) return;

    try {
        // 1. Soft delete in 'users' (disable login)
        await disableUserInFirestore(id);

        // 2. Hard delete in 'coaches' (remove from booking list)
        // This ensures the coach disappears from the filtered lists immediately
        await deleteFromFirestore('coaches', id);

        addLog('員工管理', `刪除員工：${name}`);
        showNotification(`${name} 已刪除`, "success");
    } catch (error: any) {
        console.error(error);
        showNotification(`刪除失敗: ${error.message}`, "error");
    }
  };

  const updateCoachWorkDays = async (coach: Coach) => {
      await saveToFirestore('coaches', coach.id, coach);
      showNotification('班表設定已更新', 'success');
  };

  // --- STATS ---
  const getAnalysis = () => {
    const totalActive = appointments.filter(a => a.status === 'confirmed').length;
    const totalCancelled = appointments.filter(a => a.status === 'cancelled').length;
    
    // Top slots
    const slotCounts: Record<string, number> = {};
    appointments.filter(a => a.status === 'confirmed').forEach(a => {
        slotCounts[a.time] = (slotCounts[a.time] || 0) + 1;
    });
    const topTimeSlots = Object.entries(slotCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([time, count]) => ({ time, count }));

    // Coach Stats (Current Month)
    const now = new Date();
    const currentMonthPrefix = formatDateKey(now.getFullYear(), now.getMonth(), 1).substring(0, 7); // "YYYY-MM"
    
    const coachStats = coaches.map(c => {
        const apps = appointments.filter(a => 
            a.coachId === c.id && 
            a.status === 'confirmed' && 
            a.date.startsWith(currentMonthPrefix)
        );
        return {
            id: c.id,
            name: c.name,
            personal: apps.filter(a => a.type === 'client').length,
            group: apps.filter(a => a.type === 'block').length,
            total: apps.length
        };
    });

    return { totalActive, totalCancelled, topTimeSlots, coachStats };
  };

  const handleExportStatsCsv = () => {
      const stats = getAnalysis();
      const rows = [
          ["統計項目", "數值"],
          ["總預約數", stats.totalActive + stats.totalCancelled],
          ["有效預約", stats.totalActive],
          ["已取消", stats.totalCancelled],
          [],
          ["教練", "個人課", "團課/其他", "總計"],
          ...stats.coachStats.map(c => [c.name, c.personal, c.group, c.total])
      ];
      const csvContent = "\uFEFF" + rows.map(e => e.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `stats_${new Date().toISOString().slice(0,10)}.csv`;
      link.click();
  };
  
  const handleExportJson = () => {
      const data = { appointments, coaches, logs, users: [] };
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
              if (data.appointments) {
                  await Promise.all(data.appointments.map((a: any) => saveToFirestore('appointments', a.id, a)));
              }
              if (data.coaches) {
                  await Promise.all(data.coaches.map((c: any) => saveToFirestore('coaches', c.id, c)));
              }
              showNotification("資料匯入成功", "success");
          } catch (error) {
              showNotification("匯入失敗：格式錯誤", "error");
          }
      };
      reader.readAsText(file);
  };

  // --- RENDER ---
  return (
    <div className="min-h-screen text-gray-800 dark:text-gray-100 transition-colors duration-300 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Background Blobs */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-300/30 dark:bg-purple-900/20 rounded-full blur-3xl animate-float"></div>
          <div className="absolute top-1/2 -right-20 w-80 h-80 bg-blue-300/30 dark:bg-blue-900/20 rounded-full blur-3xl animate-float" style={{animationDelay: '1s'}}></div>
          <div className="absolute -bottom-20 left-1/3 w-96 h-96 bg-indigo-300/30 dark:bg-indigo-900/20 rounded-full blur-3xl animate-float" style={{animationDelay: '2s'}}></div>
      </div>

      {/* Navbar */}
      <nav className="fixed w-full z-50 glass-panel border-b border-white/20 dark:border-gray-800 shadow-sm backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setView('booking'); resetBooking(); }}>
              <div className="w-10 h-10 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                 <CalendarIcon size={22} className="stroke-[2.5px]"/>
              </div>
              <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-white dark:to-gray-300">
                GymBooker <span className="font-black">Pro</span>
              </span>
            </div>
            <div className="flex items-center gap-4">
               {dbStatus !== 'connected' && (
                   <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 rounded-full animate-pulse">
                      <AlertTriangle size={12}/> {dbStatus === 'connecting' ? '連線中...' : '離線模式'}
                   </span>
               )}
               <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500 dark:text-gray-300">
                  {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
               </button>
               {currentUser ? (
                  <button onClick={() => setView('admin')} className="hidden md:flex items-center gap-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 px-4 py-2 rounded-xl transition-all font-bold text-sm text-gray-700 dark:text-white">
                      <Settings size={16}/> 管理後台
                  </button>
               ) : (
                  <button onClick={() => setView('admin')} className="hidden md:flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-indigo-600 transition-colors">
                      <Lock size={16}/> 員工登入
                  </button>
               )}
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-24 px-4 pb-12">
        {notification && (
          <div className={`fixed top-20 right-4 z-[60] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slideUp backdrop-blur-md border 
            ${notification.type === 'success' ? 'bg-green-500/90 text-white border-green-400' : notification.type === 'error' ? 'bg-red-500/90 text-white border-red-400' : 'bg-blue-500/90 text-white border-blue-400'}`}>
            {notification.type === 'success' ? <RefreshCw className="animate-spin" size={20}/> : <Info size={20}/>}
            <span className="font-bold tracking-wide">{notification.msg}</span>
          </div>
        )}

        {view === 'booking' ? (
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
          />
        ) : (
          !currentUser ? (
             <div className="max-w-md mx-auto mt-10">
                <div className="glass-panel p-8 rounded-3xl shadow-2xl">
                   <div className="text-center mb-8">
                      <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-600 dark:text-indigo-400">
                          <LockIcon size={32}/>
                      </div>
                      <h2 className="text-2xl font-bold dark:text-white">員工登入</h2>
                      <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">請使用您的員工帳號密碼登入系統</p>
                   </div>
                   <form onSubmit={handleEmailLogin} className="space-y-4">
                      <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1">Email</label>
                          <input type="email" required className="w-full glass-input p-3.5 rounded-xl dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all" value={loginForm.email} onChange={e => setLoginForm({...loginForm, email: e.target.value})} placeholder="name@gym.com"/>
                      </div>
                      <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1">Password</label>
                          <input type="password" required className="w-full glass-input p-3.5 rounded-xl dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} placeholder="••••••••"/>
                      </div>
                      <button type="submit" disabled={isAuthLoading} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-all transform hover:scale-[1.02] mt-2">
                          {isAuthLoading ? '驗證中...' : '登入系統'}
                      </button>
                   </form>
                </div>
             </div>
          ) : (
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
                toggleBatchSelect={(id) => { const n = new Set(selectedBatch); if(n.has(id)) n.delete(id); else n.add(id); setSelectedBatch(n); }}
                handleBatchDelete={async () => {
                    if(!window.confirm(`刪除 ${selectedBatch.size} 筆?`)) return;
                    await Promise.all(Array.from(selectedBatch).map(id => deleteFromFirestore('appointments', id)));
                    setSelectedBatch(new Set());
                    showNotification('批量刪除成功', 'success');
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
                   />
                )}
             />
          )
        )}
      </main>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 w-full glass-panel border-t border-white/20 dark:border-gray-800 flex justify-around p-3 z-50 backdrop-blur-xl">
         <button onClick={() => setView('booking')} className={`flex flex-col items-center gap-1 ${view === 'booking' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}>
            <CalendarIcon size={24}/>
            <span className="text-[10px] font-bold">預約</span>
         </button>
         <button onClick={() => setView('admin')} className={`flex flex-col items-center gap-1 ${view === 'admin' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}>
            <Settings size={24}/>
            <span className="text-[10px] font-bold">後台</span>
         </button>
      </div>

      {/* Block/Event Modal */}
      {isBlockModalOpen && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4" onClick={() => setIsBlockModalOpen(false)}>
            <div className="glass-panel w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-slideUp border border-white/40" onClick={e => e.stopPropagation()}>
                <div className="bg-white/50 dark:bg-gray-900/50 p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    <h3 className="font-bold text-xl dark:text-white flex items-center gap-2">
                        {blockForm.id ? <Settings size={20}/> : <CalendarIcon size={20}/>}
                        {blockForm.id ? '管理行程' : '新增行程'}
                    </h3>
                    {blockForm.id && (
                        <button onClick={() => setDeleteConfirm(true)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"><Trash2 size={20}/></button>
                    )}
                </div>
                
                {deleteConfirm ? (
                    <div className="p-8 text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500"><AlertTriangle size={32}/></div>
                        <h4 className="font-bold text-lg mb-2 text-gray-800 dark:text-white">確定要刪除嗎？</h4>
                        <p className="text-gray-500 text-sm mb-6">此動作無法復原</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirm(false)} className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 rounded-xl font-bold text-gray-600 dark:text-gray-300">取消</button>
                            <button onClick={handleActualDelete} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-500/30">確認刪除</button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSaveBlock} className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                               <label className="text-xs font-bold text-gray-500 uppercase">類型</label>
                               <select className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white" value={blockForm.type} onChange={e => setBlockForm({...blockForm, type: e.target.value as any})}>
                                   <option value="block">內部事務</option>
                                   <option value="client">客戶預約</option>
                               </select>
                           </div>
                           {currentUser?.role === 'manager' && (
                               <div>
                                   <label className="text-xs font-bold text-gray-500 uppercase">指定教練</label>
                                   <select className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white" value={blockForm.coachId} onChange={e => setBlockForm({...blockForm, coachId: e.target.value})}>
                                       {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                   </select>
                               </div>
                           )}
                        </div>

                        {blockForm.type === 'block' ? (
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">事項</label>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {BLOCK_REASONS.map(r => (
                                        <button type="button" key={r} onClick={() => setBlockForm({...blockForm, reason: r})}
                                            className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${blockForm.reason === r ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl space-y-3 border border-indigo-100 dark:border-indigo-800">
                                <div>
                                    <label className="text-xs font-bold text-indigo-500 uppercase">客戶姓名</label>
                                    <input required type="text" className="w-full glass-input rounded-lg p-2 mt-1 dark:text-white" value={blockForm.customer?.name || ''} onChange={e => setBlockForm({...blockForm, customer: { ...blockForm.customer!, name: e.target.value }})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-indigo-500 uppercase">聯絡電話</label>
                                    <input required type="text" className="w-full glass-input rounded-lg p-2 mt-1 dark:text-white" value={blockForm.customer?.phone || ''} onChange={e => setBlockForm({...blockForm, customer: { ...blockForm.customer!, phone: e.target.value }})} />
                                </div>
                            </div>
                        )}
                        
                        {!blockForm.id && (
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2"><Repeat size={14}/> 重複週數 (可選)</label>
                                <select className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white" value={blockForm.repeatWeeks} onChange={e => setBlockForm({...blockForm, repeatWeeks: Number(e.target.value)})}>
                                    <option value={1}>單次事件</option>
                                    <option value={4}>重複 4 週</option>
                                    <option value={8}>重複 8 週</option>
                                    <option value={12}>重複 12 週</option>
                                </select>
                            </div>
                        )}

                        <div className="pt-2 flex gap-3">
                            {/* Restore Cancel/Delete Button in Footer */}
                            {blockForm.id && (
                                <button 
                                    type="button" 
                                    onClick={() => setDeleteConfirm(true)} 
                                    className="flex-1 py-3 bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 rounded-xl font-bold transition-colors"
                                >
                                    {blockForm.type === 'client' ? '取消預約' : '刪除'}
                                </button>
                            )}
                            <button type="submit" className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-colors">
                                {blockForm.id ? '儲存變更' : '確認新增'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
         </div>
      )}

      {/* Confirm Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
             <div className="glass-panel w-full max-w-sm rounded-3xl p-6 animate-slideUp">
                 <h3 className="font-bold text-lg mb-4 text-gray-800 dark:text-white">{confirmModal.message}</h3>
                 {confirmModal.showInput && (
                     <textarea className="w-full glass-input p-3 rounded-xl mb-4 h-24 dark:text-white" placeholder="請輸入原因..." value={cancelReason} onChange={e => setCancelReason(e.target.value)}></textarea>
                 )}
                 <div className="flex gap-3">
                     <button onClick={() => setConfirmModal({...confirmModal, isOpen: false})} className="flex-1 py-2.5 bg-gray-200 dark:bg-gray-700 rounded-xl font-bold text-gray-600 dark:text-gray-300">取消</button>
                     <button onClick={() => { if(confirmModal.onConfirm) confirmModal.onConfirm(confirmModal.showInput ? cancelReason : undefined); setConfirmModal({...confirmModal, isOpen: false}); setCancelReason(''); }} 
                        className={`flex-1 py-2.5 text-white rounded-xl font-bold shadow-lg ${confirmModal.isDanger ? 'bg-red-500 shadow-red-500/30' : 'bg-indigo-600 shadow-indigo-500/30'}`}>
                        確認
                     </button>
                 </div>
             </div>
        </div>
      )}
    </div>
  );
}