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
                // If firebase is not available, we are in local mode
            }
        } catch(e) {
            console.error(e);
        }
    };
    start();
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
            const loaded = data as Coach[];
            setCoaches(INITIAL_COACHES.map(ic => {
                const sc = loaded.find(c => c.id === ic.id);
                return sc ? { ...ic, ...sc, name: ic.name, color: ic.color, role: ic.role } : ic;
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
      const targetCoachId = currentUser.role === 'manager' ? (blockForm.coachId || coaches[0].id) : currentUser.id;
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

  const handleToggleComplete = (app: Appointment) => {
      if (app.isCompleted) {
        saveToFirestore('appointments', app.id, { ...app, isCompleted: false });
        showNotification('已取消完成狀態', 'info');
      } else {
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

  const getAnalysisData = () => {
    const valid = appointments.filter(a => a.status !== 'cancelled');
    const classApps = valid.filter(a => a.type === 'client' || a.reason === '1v1教練課' || a.reason === '團課');
    const timeCounts: Record<string, number> = {};
    classApps.forEach(a => { timeCounts[a.time] = (timeCounts[a.time] || 0) + 1; });
    const topTimeSlots = Object.entries(timeCounts).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([time,c])=>({time, count:c}));

    const coachStats = coaches.map(c => { 
        const myApps = valid.filter(a => a.coachId === c.id);
        const personal = myApps.filter(a => a.type === 'client' || a.reason === '1v1教練課' || a.reason === '評估').length;
        const group = myApps.filter(a => a.reason === '團課').length;
        return { id: c.id, name: c.name, personal, group, total: personal + group };
    }).sort((a,b)=>b.total-a.total);

    return { topTimeSlots, coachStats, totalActive: valid.length, totalCancelled: appointments.filter(a => a.status === 'cancelled').length };
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(appointments, null, 2)], { type: "application/json" });
    const link = document.createElement('a');
    link.download = `backup_${new Date().toISOString().slice(0,10)}.json`;
    link.href = URL.createObjectURL(blob); link.click();
  };
  
  const handleExportStatsCsv = () => {
      const analysis = getAnalysisData();
      const statsToExport = currentUser?.role === 'manager' ? analysis.coachStats : analysis.coachStats.filter(s => s.id === currentUser?.id);
      const csv = "\uFEFF" + ["教練,個人課,團課,總計", ...statsToExport.map(s => `${s.name},${s.personal},${s.group},${s.total}`)].join("\n");
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
      link.download = "report.csv";
      link.click();
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
        try {
            const result = reader.result;
            if (typeof result !== 'string') return;
            const data = JSON.parse(result);
            if (Array.isArray(data) && window.confirm(`匯入 ${data.length} 筆資料？`)) {
                await Promise.all(data.map((item: any) => saveToFirestore('appointments', item.id, item)));
                showNotification('匯入成功');
            }
        } catch(e) { showNotification('格式錯誤', 'error'); }
    };
    reader.readAsText(file);
  };

  return (
    <div className={`min-h-screen font-sans ${isDarkMode ? 'dark' : ''}`}>
      {/* Theme Toggle */}
      <button onClick={() => setIsDarkMode(!isDarkMode)} className="fixed top-5 right-5 z-50 p-3 rounded-full bg-white/50 dark:bg-gray-800/50 backdrop-blur-md shadow-lg border border-white/20 transition-all hover:scale-110">
        {isDarkMode ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-indigo-600" />}
      </button>

      {/* Notifications */}
      {notification && (
          <div className={`fixed top-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl z-[100] text-sm font-bold shadow-2xl animate-slideUp backdrop-blur-md border border-white/10
            ${notification.type === 'success' ? 'bg-emerald-500/90 text-white' : 
              notification.type === 'error' ? 'bg-red-500/90 text-white' : 'bg-gray-800/90 text-white'}`}>
             {notification.msg}
          </div>
      )}

      {/* Main Content */}
      <div className="md:pl-24 pt-6 px-4 md:px-8 max-w-7xl mx-auto h-full pb-20 md:pb-0">
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
           <div className="max-w-md mx-auto py-20 px-4 animate-fadeIn">
              <div className="text-center mb-10">
                  <div className="w-20 h-20 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-500/30 transform rotate-3">
                      <Key size={40} className="text-white" />
                  </div>
                  <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-600 dark:from-white dark:to-gray-400">後台登入</h2>
              </div>
              <div className="glass-panel p-8 rounded-3xl shadow-2xl">
                 <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 ml-1">帳號</label>
                        <input 
                            type="text" 
                            className="w-full glass-input rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all dark:text-white" 
                            value={loginForm.username} 
                            onChange={e=>setLoginForm({...loginForm, username: e.target.value})} 
                            placeholder="輸入帳號"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 ml-1">密碼</label>
                        <input 
                            type="password" 
                            className="w-full glass-input rounded-2xl px-5 py-4 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all dark:text-white" 
                            value={loginForm.password} 
                            onChange={e=>setLoginForm({...loginForm, password: e.target.value})} 
                            placeholder="輸入密碼"
                        />
                    </div>
                    {loginError && <div className="text-red-500 text-sm font-bold text-center bg-red-50 dark:bg-red-900/20 py-2 rounded-lg">{loginError}</div>}
                    
                    <button type="submit" className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-indigo-500/30 hover:scale-[1.02] transition-all">
                        進入系統
                    </button>

                    <div className="flex justify-center mt-4">
                       <div className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-gray-500">
                           System: {
                                dbStatus === 'connected' ? <span className="text-green-500 font-bold">Online</span> : 
                                dbStatus === 'local' ? <span className="text-orange-500 font-bold">Local</span> :
                                <span className="text-red-500 font-bold">Error</span>
                            }
                       </div>
                    </div>
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

      {/* Glass Navigation Sidebar */}
      <div className="hidden md:flex fixed left-4 top-1/2 -translate-y-1/2 h-[80vh] w-20 glass-panel rounded-full flex-col items-center py-10 z-40 justify-between border border-white/30 shadow-2xl">
        <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-500/40">G</div>
        <nav className="flex flex-col gap-8 w-full px-2 items-center">
          <button onClick={() => setView('booking')} className={`p-4 rounded-2xl transition-all duration-300 ${view === 'booking' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-white shadow-inner' : 'text-gray-400 hover:text-indigo-500'}`}>
              <CalendarIcon size={24} />
          </button>
          <button onClick={() => setView('admin')} className={`p-4 rounded-2xl transition-all duration-300 ${view === 'admin' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-white shadow-inner' : 'text-gray-400 hover:text-indigo-500'}`}>
              <Settings size={24} />
          </button>
        </nav>
        <div className="w-12 h-12"></div>
      </div>
      
      {/* Mobile Nav */}
      <div className="md:hidden fixed bottom-6 left-6 right-6 h-20 glass-panel rounded-3xl flex justify-around items-center px-6 z-40 shadow-2xl border border-white/40">
        <button onClick={() => setView('booking')} className={`flex items-center gap-2 px-6 py-3 rounded-2xl transition-all ${view === 'booking' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40' : 'text-gray-500'}`}>
            <CalendarIcon size={20} /><span className={view === 'booking' ? 'block font-bold' : 'hidden'}>預約</span>
        </button>
        <button onClick={() => setView('admin')} className={`flex items-center gap-2 px-6 py-3 rounded-2xl transition-all ${view === 'admin' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/40' : 'text-gray-500'}`}>
            <Settings size={20} /><span className={view === 'admin' ? 'block font-bold' : 'hidden'}>後台</span>
        </button>
      </div>

      {/* Recovery Modal */}
      {recoveryModal.isOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="glass-panel rounded-3xl shadow-2xl p-8 max-w-sm w-full m-4 animate-slideUp">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center mb-6 animate-pulse"><RefreshCw size={32}/></div>
              <h3 className="text-xl font-bold dark:text-white mb-2">發現歷史紀錄</h3>
              <p className="text-gray-500 dark:text-gray-300 mb-8">系統偵測到本地端有 {recoveryModal.count} 筆未同步的資料。</p>
              <div className="flex gap-4 w-full">
                <button onClick={() => setRecoveryModal({ isOpen: false, count: 0 })} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl font-bold text-gray-500">忽略</button>
                <button onClick={async () => {
                    const local = localStorage.getItem('gym_backup_local');
                    if(local) {
                        const parsed = JSON.parse(local);
                        await Promise.all(parsed.map((a: any) => saveToFirestore('appointments', a.id, a)));
                        setRecoveryModal({isOpen: false, count:0});
                        showNotification('已還原');
                    }
                }} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30">還原</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Block/Event Modal */}
      {isBlockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4" onClick={() => setIsBlockModalOpen(false)}>
          <div className="glass-panel w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-slideUp border border-white/40" onClick={e => e.stopPropagation()}>
            <div className="bg-white/50 dark:bg-gray-900/50 p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center backdrop-blur-md">
                <h3 className="font-bold text-xl dark:text-white flex items-center gap-2"><Lock size={20} className="text-indigo-500"/> {blockForm.id ? "編輯項目" : "新增項目"}</h3>
                <button onClick={() => setIsBlockModalOpen(false)} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500">✕</button>
            </div>
            <div className="p-6 md:p-8">
              <form onSubmit={handleSaveBlock} className="space-y-5">
                {!blockForm.id && (
                  <div className="mb-4 p-4 glass-card rounded-2xl border border-indigo-100 dark:border-indigo-900">
                    <label className="flex items-center gap-2 font-bold text-sm cursor-pointer dark:text-white text-indigo-900"><Repeat size={16}/> 重複預約設定</label>
                    <select className="mt-2 w-full p-3 rounded-xl border-none bg-white/60 dark:bg-gray-800/60 dark:text-white outline-none focus:ring-2 focus:ring-indigo-400" value={blockForm.repeatWeeks || 1} onChange={e => setBlockForm({...blockForm, repeatWeeks: parseInt(e.target.value)})}>
                      <option value="1">僅此一次</option><option value="4">重複 4 週</option><option value="8">重複 8 週</option><option value="12">重複 12 週</option>
                    </select>
                  </div>
                )}
                
                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block ml-1">教練</label>
                    <select value={currentUser?.role === 'coach' ? currentUser.id : blockForm.coachId} onChange={e => setBlockForm({...blockForm, coachId: e.target.value})} disabled={currentUser?.role === 'coach'} className="w-full glass-input rounded-xl p-3 dark:text-white outline-none">
                        {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block ml-1">日期</label>
                        <input type="date" value={blockForm.date} onChange={e => setBlockForm({...blockForm, date: e.target.value})} className="w-full glass-input rounded-xl p-3 dark:text-white outline-none"/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block ml-1">時段</label>
                        <select value={blockForm.time} onChange={e => setBlockForm({...blockForm, time: e.target.value})} className="w-full glass-input rounded-xl p-3 dark:text-white outline-none text-center">
                            {ALL_TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                </div>
                
                {blockForm.type === 'client' ? (
                    <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                        <label className="text-xs text-indigo-500 mb-1 block font-bold uppercase tracking-wider">客戶資料</label>
                        <div className="text-lg font-bold dark:text-white">{blockForm.customer?.name}</div>
                        <div className="text-sm text-gray-500">{blockForm.customer?.phone}</div>
                    </div>
                ) : (
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block ml-1">項目類別</label>
                        <select value={blockForm.reason} onChange={e => setBlockForm({...blockForm, reason: e.target.value})} className="w-full glass-input rounded-xl p-3 dark:text-white outline-none">
                            {BLOCK_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                )}
                
                <div className="flex gap-3 mt-8 pt-4 border-t border-gray-100 dark:border-gray-700">
                  {blockForm.id && (
                    deleteConfirm ? (
                      <button type="button" onClick={handleActualDelete} className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-red-600 transition-all"><AlertTriangle size={18}/> 確定執行</button>
                    ) : (
                      <button type="button" onClick={() => setDeleteConfirm(true)} className="flex-1 bg-red-50 text-red-500 border border-red-100 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-all"><Trash2 size={18}/> {blockForm.type === 'client' ? '取消預約' : '刪除'}</button>
                    )
                  )}
                  {!deleteConfirm && <button type="button" onClick={() => setIsBlockModalOpen(false)} className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-3 rounded-xl font-bold hover:bg-gray-200">取消</button>}
                  {!deleteConfirm && <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all">儲存變更</button>}
                  {deleteConfirm && <button type="button" onClick={() => setDeleteConfirm(false)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold">返回</button>}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* Universal Confirm Modal with Enhanced Input */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}>
          <div className="glass-panel w-full max-w-sm rounded-3xl shadow-2xl p-8 animate-slideUp border border-white/40" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 shadow-lg ${confirmModal.isDanger ? 'bg-red-100 text-red-500' : 'bg-indigo-100 text-indigo-600'}`}>
                {confirmModal.isDanger ? <AlertTriangle size={32}/> : <Info size={32}/>}
              </div>
              <h3 className="text-xl font-bold mb-3 dark:text-white">確認操作</h3>
              <p className="text-gray-500 dark:text-gray-300 mb-6">{confirmModal.message}</p>
              
              {confirmModal.showInput && (
                <div className="w-full mb-6">
                    <label className="text-left block text-xs font-bold text-gray-400 mb-2 ml-1">取消原因 (必填)</label>
                    <textarea 
                        autoFocus
                        className="w-full p-4 glass-input rounded-2xl text-gray-800 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-red-400 transition-all min-h-[100px] resize-none" 
                        placeholder="請輸入原因..." 
                        value={cancelReason} 
                        onChange={e => setCancelReason(e.target.value)}
                    />
                </div>
              )}
              
              <div className="flex gap-4 w-full">
                <button onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 transition-all">取消</button>
                <button 
                    disabled={confirmModal.showInput && !cancelReason.trim()}
                    onClick={() => { if(confirmModal.onConfirm) confirmModal.onConfirm(cancelReason); setConfirmModal({...confirmModal, isOpen: false}); setCancelReason(''); }} 
                    className={`flex-1 py-3 text-white rounded-xl font-bold shadow-lg transition-all ${confirmModal.isDanger ? 'bg-red-500 shadow-red-500/30 hover:bg-red-600' : 'bg-indigo-600 shadow-indigo-500/30 hover:bg-indigo-700'} ${confirmModal.showInput && !cancelReason.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    確定
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .bg-stripes-gray { background-image: linear-gradient(45deg, rgba(0,0,0,0.05) 25%, transparent 25%, transparent 50%, rgba(0,0,0,0.05) 50%, rgba(0,0,0,0.05) 75%, transparent 75%, transparent); background-size: 20px 20px; }
        .dark .bg-stripes-gray { background-image: linear-gradient(45deg, rgba(255,255,255,0.05) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.05) 75%, transparent 75%, transparent); }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </div>
  );
}