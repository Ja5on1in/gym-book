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
  WifiOff,
  Database,
  Wifi
} from 'lucide-react';

import { initAuth, subscribeToCollection, saveToFirestore, deleteFromFirestore, isFirebaseAvailable, appId } from './services/firebase';
import { SYSTEM_USERS, INITIAL_COACHES, ALL_TIME_SLOTS, BLOCK_REASONS, GOOGLE_SCRIPT_URL, SERVICES } from './constants';
import { User, Appointment, Coach, Log, Service, Customer, BlockFormState } from './types';
import { formatDateKey, getStartOfWeek, addDays, getSlotStatus, isPastTime, isCoachDayOff } from './utils';

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
  
  // Data
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>(INITIAL_COACHES);
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
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [blockForm, setBlockForm] = useState<BlockFormState>({
    id: null, type: 'block', coachId: INITIAL_COACHES[0].id, date: formatDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()), time: '09:00', reason: '1v1教練課', customer: null, repeatWeeks: 1
  });
  const [selectedBatch, setSelectedBatch] = useState<Set<string>>(new Set());
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, message: string, onConfirm: ((reason?: string) => void) | null, isDanger: boolean, showInput: boolean}>({ isOpen: false, message: '', onConfirm: null, isDanger: false, showInput: false });
  const [recoveryModal, setRecoveryModal] = useState({ isOpen: false, count: 0 });
  const [cancelReason, setCancelReason] = useState('');

  // --- EFFECTS ---

  useEffect(() => {
    // Theme toggle
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  useEffect(() => {
    const start = async () => {
        try {
            await initAuth();
            if (!isFirebaseAvailable) {
                // If firebase is not available, we are in local mode, which is fine.
                // setDbStatus('local'); 
            }
        } catch(e) {
            console.error(e);
        }
    };
    start();
  }, []);

  useEffect(() => {
    // Even if firebase is unavailable, the subscribe function now returns local data
    const unsubApps = subscribeToCollection('appointments', (data) => {
        const apps = data as Appointment[];
        const validApps = apps.filter(a => a && a.date && a.time && a.coachId);
        setAppointments(validApps);
        setDbStatus(isFirebaseAvailable ? 'connected' : 'local');
        
        // Backup logic - only needed if we are actually connected to remote, 
        // but harmless to do in local mode too (essentially backing up local storage to local storage? redundant but okay)
        if (validApps.length > 0) localStorage.setItem('gym_backup_local', JSON.stringify(validApps));
    }, () => setDbStatus('error'));

    const unsubCoaches = subscribeToCollection('coaches', (data) => {
        if (data.length > 0) {
            const loaded = data as Coach[];
            setCoaches(INITIAL_COACHES.map(ic => {
                const sc = loaded.find(c => c.id === ic.id);
                return sc ? { ...ic, ...sc } : ic;
            }));
        } else {
            if (isFirebaseAvailable) {
                INITIAL_COACHES.forEach(c => saveToFirestore('coaches', c.id, c));
            }
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

  // Auth
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = SYSTEM_USERS.find(u => u.id === loginForm.username && u.password === loginForm.password);
    if (user) { 
        setCurrentUser(user); 
        setLoginError(''); 
        addLog('系統登入', `${user.name} 登入`); 
        if (user.role === 'coach') setBlockForm(p => ({...p, coachId: user.id})); 
    } else { 
        setLoginError('失敗'); 
    }
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
    
    // Parse date safely based on YYYY-MM-DD input to avoid timezone shifts
    const [y, m, d] = blockForm.date.split('-').map(Number);
    const startDate = new Date(y, m - 1, d); // Local midnight

    for (let i = 0; i < repeat; i++) {
        const targetDate = new Date(startDate);
        targetDate.setDate(startDate.getDate() + (i * 7));
        
        const dKey = formatDateKey(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        
        // Skip past validation for admin actions if desired, or keep it strict
        // if (isPastTime(dKey, blockForm.time)) continue; 

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
             isOpen: true, message: '請輸入取消原因', isDanger: true, showInput: true,
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

  // Helper for admin clicks
  const handleSlotClick = (date: string, time: string) => {
      if (!currentUser) return;
      const targetCoachId = currentUser.role === 'manager' ? (blockForm.coachId || coaches[0].id) : currentUser.id;
      const coach = coaches.find(c => c.id === targetCoachId);
      if (coach && isCoachDayOff(date, coach)) { showNotification('排休日無法新增', 'error'); return; }
      
      // Allow admins to book past time, but maybe show a warning? For now, we allow it to fix "cannot add" issues.
      // if (isPastTime(date, time)) { showNotification('無法預約過去時間', 'error'); return; }
      
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

  const handleToggleComplete = (app: Appointment) => {
      if (app.isCompleted) {
        // Direct undo
        saveToFirestore('appointments', app.id, { ...app, isCompleted: false });
        showNotification('已取消完成狀態', 'info');
      } else {
        // Confirmation before completing
        setConfirmModal({
            isOpen: true,
            message: `確認將 ${app.date} ${app.time} 的課程標記為完成？`,
            isDanger: false,
            showInput: false,
            onConfirm: () => {
                saveToFirestore('appointments', app.id, { ...app, isCompleted: true });
                addLog('課程完成', `結課: ${app.coachName} - ${app.date} ${app.time}`);
                showNotification('課程已完成', 'success');
            }
        });
      }
  };

  const handleBatchDelete = async () => {
    if (selectedBatch.size === 0) return;
    if (!window.confirm(`刪除 ${selectedBatch.size} 筆紀錄？`)) return;
    await Promise.all(Array.from(selectedBatch).map(id => deleteFromFirestore('appointments', id)));
    addLog('批次刪除', `刪除 ${selectedBatch.size} 筆`);
    setSelectedBatch(new Set());
  };

  const updateCoachWorkDays = (coach: Coach) => {
      saveToFirestore('coaches', coach.id, coach);
  };

  // Analysis Data
  const getAnalysisData = () => {
    const valid = appointments.filter(a => a.status !== 'cancelled');
    
    // Calculate top time slots
    const classApps = valid.filter(a => a.type === 'client' || a.reason === '1v1教練課' || a.reason === '團課');
    const timeCounts: Record<string, number> = {};
    classApps.forEach(a => { timeCounts[a.time] = (timeCounts[a.time] || 0) + 1; });
    const topTimeSlots = Object.entries(timeCounts).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([time,c])=>({time, count:c}));

    // Calculate coach stats (Personal vs Group)
    const coachStats = coaches.map(c => { 
        const myApps = valid.filter(a => a.coachId === c.id);
        const personal = myApps.filter(a => a.type === 'client' || a.reason === '1v1教練課' || a.reason === '評估').length;
        const group = myApps.filter(a => a.reason === '團課').length;
        
        return {
            id: c.id, 
            name: c.name, 
            personal,
            group,
            total: personal + group
        };
    }).sort((a,b)=>b.total-a.total);

    return { 
        topTimeSlots, 
        coachStats, 
        totalActive: valid.length, 
        totalCancelled: appointments.filter(a => a.status === 'cancelled').length 
    };
  };

  // Import/Export
  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(appointments, null, 2)], { type: "application/json" });
    const link = document.createElement('a');
    link.download = `backup_${new Date().toISOString().slice(0,10)}.json`;
    link.href = URL.createObjectURL(blob); link.click();
  };
  
  const handleExportStatsCsv = () => {
      const analysis = getAnalysisData();
      const csv = "\uFEFF" + ["教練,個人課,團課,總計", ...analysis.coachStats.map(s => `${s.name},${s.personal},${s.group},${s.total}`)].join("\n");
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
      link.download = "report.csv";
      link.click();
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const data = JSON.parse(ev.target?.result as string);
            if (Array.isArray(data) && window.confirm(`匯入 ${data.length} 筆資料？`)) {
                await Promise.all(data.map(item => saveToFirestore('appointments', item.id, item)));
                showNotification('匯入成功');
            }
        } catch(e) { showNotification('格式錯誤', 'error'); }
    };
    reader.readAsText(file);
  };

  // --- RENDER ---
  return (
    <div className={`min-h-screen font-sans ${isDarkMode ? 'dark bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Theme Toggle */}
      <button onClick={() => setIsDarkMode(!isDarkMode)} className="fixed top-4 right-20 z-50 p-2 rounded-full bg-white dark:bg-gray-800 shadow-md">
        {isDarkMode ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} className="text-gray-600" />}
      </button>

      {/* Notifications */}
      {notification && <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-full z-[100] text-sm animate-fadeIn">{notification.msg}</div>}

      {/* Main Content */}
      <div className="md:pl-20 pt-6 px-4 md:px-8 max-w-7xl mx-auto h-full pb-20 md:pb-0">
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
        ) : !currentUser ? (
           <div className="max-w-md mx-auto py-10 px-4 animate-fadeIn">
              <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-600 dark:text-blue-400"><Key size={32} /></div>
                  <h2 className="text-2xl font-bold">後台登入</h2>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
                 <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-300">帳號</label>
                        <input 
                            type="text" 
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-white text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600" 
                            value={loginForm.username} 
                            onChange={e=>setLoginForm({...loginForm, username: e.target.value})} 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-300">密碼</label>
                        <input 
                            type="password" 
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-white text-gray-900 dark:bg-gray-700 dark:text-white dark:border-gray-600" 
                            value={loginForm.password} 
                            onChange={e=>setLoginForm({...loginForm, password: e.target.value})} 
                        />
                    </div>
                    {loginError && <div className="text-red-500 text-sm">{loginError}</div>}
                    <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-2 rounded mt-2">
                       <div>
                           DB Status: {
                                dbStatus === 'connected' ? <span className="text-green-500"><Database size={10} className="inline"/> Connected</span> : 
                                dbStatus === 'local' ? <span className="text-orange-500"><Wifi size={10} className="inline"/> Local/Demo</span> :
                                <span className="text-red-500"><WifiOff size={10} className="inline"/> Error</span>
                            }
                       </div>
                    </div>
                    <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold mt-4">進入系統</button>
                 </form>
              </div>
           </div>
        ) : (
           <AdminDashboard 
             currentUser={currentUser} 
             onLogout={() => { setCurrentUser(null); setAdminTab('calendar'); }}
             adminTab={adminTab} setAdminTab={setAdminTab}
             appointments={appointments}
             selectedBatch={selectedBatch}
             toggleBatchSelect={(id) => { const s = new Set(selectedBatch); if(s.has(id)) s.delete(id); else s.add(id); setSelectedBatch(s); }}
             handleBatchDelete={handleBatchDelete}
             analysis={getAnalysisData()}
             handleExportStatsCsv={handleExportStatsCsv}
             handleExportJson={handleExportJson}
             triggerImport={() => {}}
             handleFileImport={handleFileImport}
             coaches={coaches}
             updateCoachWorkDays={updateCoachWorkDays}
             logs={logs}
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
        )}
      </div>

      {/* Nav */}
      <div className="hidden md:flex fixed left-0 top-0 h-full w-20 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col items-center py-8 z-40">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl mb-10 shadow-lg">A</div>
        <nav className="flex-1 flex flex-col gap-6 w-full px-2">
          <button onClick={() => setView('booking')} className={`flex flex-col items-center gap-1 p-3 rounded-xl ${view === 'booking' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}><CalendarIcon size={24} /><span className="text-[10px]">預約</span></button>
          <button onClick={() => setView('admin')} className={`flex flex-col items-center gap-1 p-3 rounded-xl ${view === 'admin' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}><Settings size={24} /><span className="text-[10px]">後台</span></button>
        </nav>
      </div>
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-around p-2 z-40 pb-safe">
        <button onClick={() => setView('booking')} className={`flex flex-col items-center gap-1 p-2 rounded-xl flex-1 ${view === 'booking' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}><CalendarIcon size={24} /><span className="text-xs">預約</span></button>
        <button onClick={() => setView('admin')} className={`flex flex-col items-center gap-1 p-2 rounded-xl flex-1 ${view === 'admin' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}><Settings size={24} /><span className="text-xs">後台</span></button>
      </div>

      {/* Modals */}
      {recoveryModal.isOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm w-full m-4">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-4"><RefreshCw size={24}/></div>
              <h3 className="text-lg font-bold dark:text-white mb-2">發現歷史紀錄</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm">系統偵測到本地端有 {recoveryModal.count} 筆紀錄。</p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setRecoveryModal({ isOpen: false, count: 0 })} className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">忽略</button>
                <button onClick={async () => {
                    const local = localStorage.getItem('gym_backup_local');
                    if(local) {
                        const parsed = JSON.parse(local);
                        await Promise.all(parsed.map((a: any) => saveToFirestore('appointments', a.id, a)));
                        setRecoveryModal({isOpen: false, count:0});
                        showNotification('已還原');
                    }
                }} className="flex-1 py-2 bg-blue-600 text-white rounded-lg">還原</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isBlockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setIsBlockModalOpen(false)}>
          <div className="bg-white dark:bg-gray-800 w-full max-w-2xl m-4 overflow-hidden border border-gray-100 dark:border-gray-700" onClick={e => e.stopPropagation()}>
            <div className="bg-gray-50 dark:bg-gray-900 p-4 border-b flex justify-between items-center"><h3 className="font-bold dark:text-white flex items-center gap-2"><Lock size={18}/> {blockForm.id ? "編輯項目" : "新增項目"}</h3></div>
            <div className="p-6">
              <form onSubmit={handleSaveBlock} className="space-y-4">
                {!blockForm.id && (
                  <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <label className="flex items-center gap-2 font-bold text-sm cursor-pointer dark:text-gray-200"><Repeat size={16}/> 重複預約</label>
                    <select className="mt-2 w-full p-2 rounded border dark:bg-gray-600 dark:text-white" value={blockForm.repeatWeeks || 1} onChange={e => setBlockForm({...blockForm, repeatWeeks: parseInt(e.target.value)})}>
                      <option value="1">單次</option><option value="4">重複 4 週</option><option value="8">重複 8 週</option><option value="12">重複 12 週</option>
                    </select>
                  </div>
                )}
                <div><label className="text-xs text-gray-500 mb-1 block">教練</label><select value={currentUser?.role === 'coach' ? currentUser.id : blockForm.coachId} onChange={e => setBlockForm({...blockForm, coachId: e.target.value})} disabled={currentUser?.role === 'coach'} className="w-full border rounded-lg p-2 dark:bg-gray-700 dark:text-white">{coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div className="grid grid-cols-2 gap-4"><div><label className="text-xs text-gray-500 mb-1 block">日期</label><input type="date" value={blockForm.date} onChange={e => setBlockForm({...blockForm, date: e.target.value})} className="w-full border rounded-lg p-2 dark:bg-gray-700 dark:text-white"/></div><div><label className="text-xs text-gray-500 mb-1 block">時段</label><select value={blockForm.time} onChange={e => setBlockForm({...blockForm, time: e.target.value})} className="w-full border rounded-lg p-2 dark:bg-gray-700 dark:text-white">{ALL_TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}</select></div></div>
                {blockForm.type === 'client' ? (<div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg"><label className="text-xs text-blue-500 mb-1 block font-bold">客戶資料</label><div className="text-sm font-bold dark:text-white">{blockForm.customer?.name}</div></div>) : (<div><label className="text-xs text-gray-500 mb-1 block">項目</label><select value={blockForm.reason} onChange={e => setBlockForm({...blockForm, reason: e.target.value})} className="w-full border rounded-lg p-2 dark:bg-gray-700 dark:text-white">{BLOCK_REASONS.map(r => <option key={r} value={r}>{r}</option>)}</select></div>)}
                <div className="flex gap-3 mt-6 pt-2 border-t">
                  {blockForm.id && (
                    deleteConfirm ? (
                      <button type="button" onClick={handleActualDelete} className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2"><AlertTriangle size={16}/> 確定刪除</button>
                    ) : (
                      <button type="button" onClick={() => setDeleteConfirm(true)} className="flex-1 bg-red-50 text-red-600 border border-red-200 py-3 rounded-lg font-bold flex items-center justify-center gap-2"><Trash2 size={16}/> {blockForm.type === 'client' ? '取消預約' : '刪除'}</button>
                    )
                  )}
                  {!deleteConfirm && <button type="button" onClick={() => setIsBlockModalOpen(false)} className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-3 rounded-lg font-bold">取消</button>}
                  {!deleteConfirm && <button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold">儲存</button>}
                  {deleteConfirm && <button type="button" onClick={() => setDeleteConfirm(false)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-lg font-bold">返回</button>}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* Confirm Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm w-full m-4" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${confirmModal.isDanger ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                {confirmModal.isDanger ? <AlertTriangle size={24}/> : <Info size={24}/>}
              </div>
              <h3 className="text-lg font-bold mb-2 dark:text-white">確認操作</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">{confirmModal.message}</p>
              {confirmModal.showInput && (
                <textarea className="w-full p-2 border rounded mb-4 dark:bg-gray-700 dark:text-white" placeholder="原因" value={cancelReason} onChange={e => setCancelReason(e.target.value)}/>
              )}
              <div className="flex gap-3 w-full">
                <button onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })} className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">取消</button>
                <button onClick={() => { if(confirmModal.onConfirm) confirmModal.onConfirm(cancelReason); setConfirmModal({...confirmModal, isOpen: false}); setCancelReason(''); }} className={`flex-1 py-2 text-white rounded-lg ${confirmModal.isDanger ? 'bg-red-600' : 'bg-blue-600'}`}>確定</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .bg-stripes-gray { background-image: linear-gradient(45deg, #f3f4f6 25%, transparent 25%, transparent 50%, #f3f4f6 50%, #f3f4f6 75%, transparent 75%, transparent); background-size: 10px 10px; }
        .dark .bg-stripes-gray { background-image: linear-gradient(45deg, #374151 25%, transparent 25%, transparent 50%, #374151 50%, #374151 75%, transparent 75%, transparent); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; } 
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      `}</style>
    </div>
  );
}