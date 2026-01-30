
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Users
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
    auth,
    getUserProfile,
    createAuthUser
} from './services/firebase';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

import { useAuth } from './hooks/useAuth';
import { useBookings } from './hooks/useBookings';

import { INITIAL_COACHES, ALL_TIME_SLOTS, BLOCK_REASONS, GOOGLE_SCRIPT_URL } from './constants';
import { User, Appointment, Coach, Log, Service, Customer, BlockFormState, UserInventory, WorkoutPlan } from './types';
import { formatDateKey, getStartOfWeek, addDays, isCoachDayOff } from './utils';

import BookingWizard from './components/BookingWizard';
import AdminDashboard from './components/AdminDashboard';
import WeeklyCalendar from './components/WeeklyCalendar';
import MyBookings from './components/MyBookings';

export default function App() {
  // --- STATE ---
  const [view, setView] = useState<'booking' | 'admin' | 'my-bookings'>('booking');
  const [adminTab, setAdminTab] = useState('calendar');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [dbStatus, setDbStatus] = useState('connecting');
  
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [inventories, setInventories] = useState<UserInventory[]>([]);
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek(new Date()));

  // Booking Wizard State
  const [bookingStep, setBookingStep] = useState(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [formData, setFormData] = useState<Customer>({ name: '', phone: '', email: '' });
  
  // Admin Modal & Form State
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [filteredMembers, setFilteredMembers] = useState<UserInventory[]>([]);
  const [groupMemberSearch, setGroupMemberSearch] = useState('');
  const [groupMemberResults, setGroupMemberResults] = useState<UserInventory[]>([]);
  const [blockForm, setBlockForm] = useState<BlockFormState>({
    id: null, type: 'block', coachId: '', date: formatDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()), time: '09:00', endTime: '10:00', reason: '內部訓練', customer: null, repeatWeeks: 1, attendees: [], maxAttendees: 8
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- HELPER FUNCTIONS ---
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
  
  // --- CUSTOM HOOKS ---
  const { 
    currentUser, 
    isAuthLoading, 
    liffProfile, 
    handleEmailLogin, 
    handleLogout: appLogout, 
    login: liffLogin,
  } = useAuth({ addLog, showNotification, inventories, onLiffReady: setView });
  
  const {
      isProcessing,
      handleSubmitBooking,
      handleCustomerCancel,
      handleSaveBlock,
      handleActualDelete,
      handleUserCheckIn,
      handleCoachConfirmCompletion,
      handleRevertCompletion,
      handleToggleComplete,
      handleBatchDelete: batchDeleteHandler,
  } = useBookings({ currentUser, appointments, coaches, inventories, addLog, showNotification, sendToGoogleScript });


  // --- EFFECTS ---
  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const setting = localStorage.getItem('darkMode');
    if (setting) {
      setIsDarkMode(setting === 'true');
    } else {
      setIsDarkMode(prefersDark);
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [isDarkMode]);

  useEffect(() => {
    initAuth();
  }, []);

  // Data Subscriptions
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
        unsubApps(); unsubLogs(); unsubCoaches(); unsubInventory(); unsubWorkoutPlans();
    };
  }, [currentWeekStart]);

  // Derived state for member search
  useEffect(() => {
    if (!memberSearchTerm) { setFilteredMembers([]); return; }
    const lowerTerm = memberSearchTerm.toLowerCase();
    setFilteredMembers(inventories.filter(inv => inv.name.toLowerCase().includes(lowerTerm) || (inv.phone && inv.phone.includes(lowerTerm))).slice(0, 6));
  }, [memberSearchTerm, inventories]);
  
  useEffect(() => {
    if (!groupMemberSearch) { setGroupMemberResults([]); return; }
    const lowerTerm = groupMemberSearch.toLowerCase();
    const currentAttendeeIds = new Set(blockForm.attendees?.map(a => a.customerId));
    setGroupMemberResults(inventories.filter(inv => !currentAttendeeIds.has(inv.id) && (inv.name.toLowerCase().includes(lowerTerm) || (inv.phone && inv.phone.includes(lowerTerm)))).slice(0, 5));
  }, [groupMemberSearch, inventories, blockForm.attendees]);

  // --- GENERAL HANDLERS ---
  const handleLogout = async () => {
    await appLogout();
    setView('booking');
    setAdminTab('calendar');
    setLoginForm({ email: '', password: '' });
  };
  
  const attemptEmailLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      await handleEmailLogin(loginForm.email, loginForm.password);
  };
  
  const resetBooking = () => {
    setBookingStep(1); setSelectedService(null); setSelectedCoach(null); setSelectedSlot(null); setFormData({ name: '', phone: '', email: '' });
  };

  const bookingSubmitWrapper = async (e: React.FormEvent, lineProfileData?: { userId: string, displayName: string }) => {
    const result = await handleSubmitBooking(
        selectedDate, selectedSlot, selectedCoach, selectedService, formData, lineProfileData
    );
    if (result.success) {
        setBookingStep(5);
    } else if (result.step) {
        setBookingStep(result.step);
    }
  };

  const saveBlockWrapper = (e: React.FormEvent, force: boolean = false) => {
      handleSaveBlock(e, blockForm, isBatchMode, force).then(success => {
          if (success) setIsBlockModalOpen(false);
      });
  };

  const deleteBlockWrapper = () => {
    const target = appointments.find(a => a.id === blockForm.id);
    if (!target) return;
    
    if (target.type === 'private' || (target.type as string) === 'client') { 
        setConfirmModal({
            isOpen: true, title: '取消原因', message: '請輸入取消預約的原因', isDanger: true, showInput: true, inputLabel: '取消原因 (必填)',
            onConfirm: async (reason) => {
                if (!reason) { showNotification('請填寫取消原因', 'error'); return; }
                await handleCustomerCancel(target, reason || '管理員手動取消');
                setIsBlockModalOpen(false);
            }
        });
    } else {
        handleActualDelete(target.id, target.reason || '').then(success => {
            if (success) setIsBlockModalOpen(false);
        });
    }
  };

  const handleSlotClick = (date: string, time: string) => {
    if (!currentUser) return;
    const canProceed = ['manager', 'receptionist'].includes(currentUser.role) || !isCoachDayOff(date, currentUser as Coach);
    if (!canProceed) {
        showNotification('排休日無法新增', 'error'); return;
    }
    const targetCoachId = ['manager', 'receptionist'].includes(currentUser.role) 
      ? (coaches.find(c => !isCoachDayOff(date, c))?.id || '') 
      : currentUser.id;
    
    if (!targetCoachId) {
        showNotification('該日無教練上班', 'error'); return;
    }

    setBlockForm({ 
        id: null, type: 'private', coachId: targetCoachId, 
        date, time, endTime: ALL_TIME_SLOTS[ALL_TIME_SLOTS.indexOf(time)+1] || time, 
        reason: '', customer: null, repeatWeeks: 1, attendees: [], maxAttendees: 8
    });
    setMemberSearchTerm(''); setGroupMemberSearch(''); setDeleteConfirm(false); setIsBatchMode(false);
    setIsBlockModalOpen(true);
  };

  const handleOpenBatchBlock = () => {
    if (!currentUser) return;
    const today = new Date();
    setBlockForm({ 
        id: null, type: 'block', coachId: currentUser.id, 
        date: formatDateKey(today.getFullYear(), today.getMonth(), today.getDate()), 
        time: '09:00', endTime: '12:00',
        reason: '內部訓練', customer: null, repeatWeeks: 1, attendees: [], maxAttendees: 8 
    });
    setIsBatchMode(true); setIsBlockModalOpen(true);
  };

  const handleAppointmentClick = (app: Appointment) => {
    if (!currentUser || (currentUser.role === 'coach' && app.coachId !== currentUser.id)) {
        showNotification('權限不足', 'info'); return;
    }
    setBlockForm({ id: app.id, type: (app.type as any) === 'client' ? 'private' : app.type, coachId: app.coachId, date: app.date, time: app.time, endTime: app.time, reason: app.reason || '', customer: app.customer || null, attendees: app.attendees || [] });
    setIsBlockModalOpen(true);
  };

  const handleBatchDelete = () => {
      batchDeleteHandler(selectedBatch).then(() => {
          setSelectedBatch(new Set());
      });
  };

  const checkAndCreateUser = async (profile: { userId: string, displayName: string }) => {
    // This logic is now handled by useAuth hook. The prop is passed for BookingWizard compatibility.
  };

  // --- Admin Data Handlers (Kept in App.tsx) ---
  const handleSaveCoach = async (coachData: Coach, email?: string, password?: string) => {
    if (currentUser?.role !== 'manager') { showNotification('權限不足', 'error'); return; }
    try {
        let uid = coachData.id;
        if (!uid && email && password) { // New coach
            uid = await createAuthUser(email, password);
            coachData.id = uid;
            coachData.email = email;
        } else if (!uid) {
            showNotification('新增員工必須提供 Email 和密碼', 'error'); return;
        }
        await saveToFirestore('coaches', uid, coachData);
        showNotification('員工資料已儲存', 'success');
        addLog('員工管理', `儲存了員工 ${coachData.name} 的資料`);
    } catch(e) {
        showNotification(`儲存失敗: ${(e as Error).message}`, 'error');
    }
  };

  const handleDeleteCoach = (id: string, name: string) => {
    if (currentUser?.role !== 'manager') { showNotification('權限不足', 'error'); return; }
    setConfirmModal({
        isOpen: true, title: '刪除員工確認',
        message: `確定要刪除員工「${name}」嗎？此操作會停用其登入權限，但不會刪除歷史預約紀錄。`,
        isDanger: true, showInput: true, inputType: 'password', inputLabel: '請輸入您的登入密碼以確認',
        onConfirm: async (password) => {
            if (!auth.currentUser || !password) return;
            try {
                const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
                await reauthenticateWithCredential(auth.currentUser, credential);
                await disableUserInFirestore(id);
                await deleteFromFirestore('coaches', id);
                showNotification('員工已刪除', 'success');
                addLog('員工管理', `刪除了員工 ${name} (${id})`);
            } catch (e) {
                showNotification(`刪除失敗: ${(e as Error).message}`, 'error');
            }
        }
    });
  };
  
  const handleSaveInventory = async (inv: UserInventory) => {
      try {
          const original = inventories.find(i => i.id === inv.id);
          let details = `更新 ${inv.name} 庫存。`;
          if (original) {
              if(original.credits.private !== inv.credits.private) details += ` 私人課: ${original.credits.private} -> ${inv.credits.private}。`;
              if(original.credits.group !== inv.credits.group) details += ` 團體課: ${original.credits.group} -> ${inv.credits.group}。`;
          }
          await saveToFirestore('user_inventory', inv.id || inv.lineUserId || Date.now().toString(), inv);
          showNotification('庫存已更新', 'success');
          addLog('庫存調整', details);
      } catch (e) {
          showNotification(`更新失敗: ${(e as Error).message}`, 'error');
      }
  };

  const onDeleteInventory = async (inv: UserInventory) => {
    if (window.confirm(`確定要刪除學員「${inv.name}」的所有資料嗎？此操作無法復原。`)) {
        try {
            await deleteFromFirestore('user_inventory', inv.id);
            showNotification('學員資料已刪除', 'success');
            addLog('刪除學員', `刪除了 ${inv.name} (${inv.id}) 的所有資料。`);
        } catch (e) {
            showNotification(`刪除失敗: ${(e as Error).message}`, 'error');
        }
    }
  };

  const handleSavePlan = async (plan: WorkoutPlan) => {
    const id = plan.id || Date.now().toString();
    try {
        await saveToFirestore('workout_plans', id, { ...plan, id });
        showNotification('課表已儲存', 'success');
        addLog('課表管理', `儲存了 ${plan.userName} 的課表 "${plan.name}"`);
    } catch(e) {
        showNotification(`儲存失敗: ${(e as Error).message}`, 'error');
    }
  };

  const onDeletePlan = async (id: string) => {
    try {
        await deleteFromFirestore('workout_plans', id);
        showNotification('課表已刪除', 'success');
        addLog('課表管理', `刪除了課表 ID: ${id}`);
    } catch(e) {
        showNotification(`刪除失敗: ${(e as Error).message}`, 'error');
    }
  };


  // --- RENDER ---
  const renderContent = () => {
    if (view === 'my-bookings') return <MyBookings liffProfile={liffProfile} appointments={appointments} coaches={coaches} onCancel={handleCustomerCancel} onCheckIn={handleUserCheckIn} inventories={inventories} workoutPlans={workoutPlans} />;
    if (view === 'booking') return <BookingWizard step={bookingStep} setStep={setBookingStep} selectedService={selectedService} setSelectedService={setSelectedService} selectedCoach={selectedCoach} setSelectedCoach={setSelectedCoach} selectedDate={selectedDate} setSelectedDate={setSelectedDate} selectedSlot={selectedSlot} setSelectedSlot={setSelectedSlot} formData={formData} setFormData={setFormData} coaches={coaches} appointments={appointments} onSubmit={bookingSubmitWrapper} reset={resetBooking} currentDate={currentDate} handlePrevMonth={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} handleNextMonth={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} inventories={inventories} onRegisterUser={checkAndCreateUser} liffProfile={liffProfile} onLogin={liffLogin} />;
    
    if (!currentUser) {
      return (
        <div className="max-w-md mx-auto mt-10 px-4">
          <div className="glass-panel p-8 rounded-3xl shadow-2xl border border-white/40">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-600 dark:text-indigo-400"><Lock size={32}/></div>
              <h2 className="text-2xl font-bold dark:text-white">員工登入</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">請使用您的員工帳號密碼登入系統</p>
            </div>
            <form onSubmit={attemptEmailLogin} className="space-y-4">
              <input type="email" required className="w-full glass-input p-3.5 rounded-xl dark:text-white" value={loginForm.email} onChange={e => setLoginForm({...loginForm, email: e.target.value})} placeholder="name@gym.com"/>
              <input type="password" required className="w-full glass-input p-3.5 rounded-xl dark:text-white" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} placeholder="••••••••"/>
              <button type="submit" disabled={isAuthLoading} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg">{isAuthLoading ? '驗證中...' : '登入系統'}</button>
            </form>
          </div>
        </div>
      );
    }

    return <AdminDashboard 
            currentUser={currentUser}
            onLogout={handleLogout}
            adminTab={adminTab}
            setAdminTab={setAdminTab}
            appointments={appointments}
            coaches={coaches}
            logs={logs}
            inventories={inventories}
            workoutPlans={workoutPlans}
            onToggleComplete={handleToggleComplete}
            onCancelAppointment={(app) => {
              setConfirmModal({
                   isOpen: true,
                   title: '取消預約確認',
                   message: `確定要取消 ${app.customer?.name} 的預約嗎？`,
                   isDanger: true,
                   showInput: true,
                   inputLabel: '取消原因 (必填)',
                   onConfirm: (reason) => {
                     if(!reason) { showNotification('請填寫取消原因', 'error'); return; }
                     handleCustomerCancel(app, reason)
                   }
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
            selectedBatch={selectedBatch}
            toggleBatchSelect={(id) => {
                const newBatch = new Set(selectedBatch);
                if (newBatch.has(id)) newBatch.delete(id);
                else newBatch.add(id);
                setSelectedBatch(newBatch);
            }}
            handleBatchDelete={handleBatchDelete}
            analysis={{}}
            handleExportStatsCsv={() => {}}
            handleExportJson={() => {}}
            triggerImport={() => fileInputRef.current?.click()}
            handleFileImport={(e) => {}}
            updateCoachWorkDays={(c) => {}}
            onSaveCoach={handleSaveCoach}
            onDeleteCoach={handleDeleteCoach}
            onOpenBatchBlock={handleOpenBatchBlock}
            onSaveInventory={handleSaveInventory}
            onDeleteInventory={onDeleteInventory}
            onSavePlan={handleSavePlan}
            onDeletePlan={onDeletePlan}
            onGoToBooking={() => setView('booking')}
           />;
  };

  if (isAuthLoading && dbStatus === 'connecting') {
    return <div className="fixed inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-900"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div></div>;
  }
  
  return (
    <div className={`flex flex-col min-h-screen font-sans ${isDarkMode ? 'dark' : ''}`}>
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 flex justify-between items-center shadow-sm sticky top-0 z-50 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg">
                活
            </div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-white hidden sm:block">活力學苑預約系統</h1>
        </div>
        <div className="flex items-center gap-3">
          {liffProfile && !currentUser && (
            <>
              <button onClick={() => setView('booking')} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${view==='booking'?'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300':'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>預約課程</button>
              <button onClick={() => setView('my-bookings')} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${view==='my-bookings'?'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300':'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>我的預約</button>
            </>
          )}
          {currentUser && (
            <button onClick={() => setView(view === 'admin' ? 'booking' : 'admin')} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors">
              {view === 'admin' ? <CalendarIcon size={20} /> : <Settings size={20}/>}
            </button>
          )}
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 hover:text-indigo-600 transition-colors">
            {isDarkMode ? <Sun size={20}/> : <Moon size={20}/>}
          </button>
        </div>
      </header>
      
      <main className="flex-1 p-4 md:p-6 bg-slate-50/50 dark:bg-slate-900/50 relative">
          {renderContent()}
      </main>

      {/* Notification */}
      {notification && (
        <div className={`fixed bottom-5 right-5 z-[100] p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-slideUp border
          ${notification.type === 'success' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800' :
           notification.type === 'error' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800' :
           'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800'}`}>
          {notification.type === 'success' && <CheckCircle2 />}
          {notification.type === 'error' && <AlertTriangle />}
          {notification.type === 'info' && <Info />}
          <span className="font-bold">{notification.msg}</span>
        </div>
      )}

      {/* Modals */}
      {isBlockModalOpen && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => setIsBlockModalOpen(false)}>
            {/* Modal Content */}
         </div>
      )}
      {confirmModal.isOpen && (
         <div className="fixed inset-0 z-[101] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            {/* Modal Content */}
         </div>
      )}
      
      <input type="file" ref={fileInputRef} className="hidden" onChange={() => {}} accept=".json"/>
    </div>
  );
}
