
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
    id: null, type: 'block', coachId: '', date: formatDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()), time: '09:00', endTime: '10:00', reason: '內部訓練', customer: null, attendees: [], repeatWeeks: 1
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
    }, () => {});
    
    const unsubInventory = subscribeToCollection('user_inventory', (data) => setInventories(data as UserInventory[]), () => {});
    const unsubWorkoutPlans = subscribeToCollection('workout_plans', (data) => setWorkoutPlans(data as WorkoutPlan[]), () => {});

    return () => { unsubApps(); unsubCoaches(); unsubLogs(); unsubInventory(); unsubWorkoutPlans(); };
  }, [currentWeekStart]);

  useEffect(() => {
      const alreadyAddedIds = new Set(blockForm.attendees?.map(a => a.customerId));
      if (!memberSearchTerm) {
          setFilteredMembers([]);
          return;
      }
      const lowerTerm = memberSearchTerm.toLowerCase();
      const results = inventories.filter(inv => 
          !alreadyAddedIds.has(inv.id) &&
          (inv.name.toLowerCase().includes(lowerTerm) || (inv.phone && inv.phone.includes(lowerTerm)))
      ).slice(0, 6);
      setFilteredMembers(results);
  }, [memberSearchTerm, inventories, blockForm.attendees]);

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
        fetch(GOOGLE_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: fd })
            .catch(e => console.warn("Webhook background error:", e));
    } catch (e) { console.error("Webhook Error (Non-blocking):", e); }
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
      } finally { setIsAuthLoading(false); }
  };

  const handleLogout = async () => {
      await logout();
      setView('booking'); setAdminTab('calendar'); setLoginForm({ email: '', password: '' });
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
          const isUpdate = !!oldInv;
          await saveToFirestore('user_inventory', id, { ...inventory, id, lastUpdated: new Date().toISOString() });
          
          if (isUpdate && oldInv) {
              const [oldPrivate, newPrivate] = [oldInv.credits.private, Number(inventory.credits?.private || 0)];
              const [oldGroup, newGroup] = [oldInv.credits.group, Number(inventory.credits?.group || 0)];

              if (oldPrivate !== newPrivate || oldGroup !== newGroup) {
                   addLog('庫存調整', `調整學員 ${inventory.name} 點數 - 1v1: ${oldPrivate} -> ${newPrivate}, 團課: ${oldGroup} -> ${newGroup}`);
                   showNotification('學員點數已更新');
              } else {
                   addLog('學員管理', `更新學員資料: ${inventory.name}`);
                   showNotification('學員資料已更新');
              }
          } else {
              addLog('學員管理', `新增學員資料: ${inventory.name}`);
              showNotification('新學員已新增');
          }
      } catch (e) { console.error(e); showNotification('儲存失敗', 'error'); }
  };

  const handleDeleteInventory = async (inventory: UserInventory) => {
    setConfirmModal({
        isOpen: true, title: '刪除會員確認',
        message: `此操作將永久刪除學員 ${inventory.name} 的所有資料 (包含點數庫存與訓練課表)，且無法復原。請輸入您的登入密碼以確認執行。`,
        isDanger: true, showInput: true, inputLabel: '管理員密碼', inputType: 'password',
        icon: <Trash2 size={48} className="text-red-500"/>,
        onConfirm: async (password) => {
            const adminEmail = auth.currentUser?.email;
            if (!currentUser || !adminEmail || !auth.currentUser || !password) {
                showNotification('無法驗證管理員身份或密碼為空', 'error'); return;
            }
            try {
                await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(adminEmail, password));
                await deleteFromFirestore('user_inventory', inventory.id);
                const plansToDelete = workoutPlans.filter(p => p.userId === inventory.id);
                if (plansToDelete.length > 0 && db) {
                  const batch = writeBatch(db);
                  plansToDelete.forEach(p => batch.delete(doc(db, 'workout_plans', p.id)));
                  await batch.commit();
                }
                addLog('學員管理', `管理員 ${currentUser.name || currentUser.email} 刪除了學員 ${inventory.name}`);
                showNotification('學員已成功刪除');
            } catch (error: any) {
                if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') showNotification('密碼錯誤', 'error');
                else showNotification(`刪除失敗：${error.message}`, 'error');
            }
        }
    });
  };

  const handleSaveWorkoutPlan = async (plan: WorkoutPlan) => {
      try {
          const id = plan.id || `${Date.now()}`;
          await saveToFirestore('workout_plans', id, { ...plan, id, createdAt: plan.createdAt || new Date().toISOString() });
          addLog('課表管理', `儲存學員 ${plan.userName} 的課表 "${plan.name}"`);
          showNotification('課表已儲存');
      } catch (e) { showNotification('儲存課表失敗', 'error'); }
  };

  const handleDeleteWorkoutPlan = async (id: string) => {
      try {
          await deleteFromFirestore('workout_plans', id);
          addLog('課表管理', `刪除課表 ID: ${id}`);
          showNotification('課表已刪除');
      } catch (e) { showNotification('刪除失敗', 'error'); }
  };

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
        let inventory = inventories.find(i => i.lineUserId === lineProfile?.userId) || null;
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
        sendToGoogleScript({ action: 'create_booking', ...newApp }).catch(e => console.warn("Webhook failed", e));
        
        setBookingStep(5); showNotification('預約成功！');
    } catch (error: any) { showNotification('預約系統忙碌中: ' + error.message, 'error'); }
  };

  const handleCustomerCancel = async (app: Appointment, reason: string) => {
      if (isProcessing) return; setIsProcessing(true);
      try {
          if (app.type === 'group') {
              const inventory = liffProfile ? inventories.find(i => i.lineUserId === liffProfile.userId) : null;
              if (!inventory) throw new Error('無法驗證您的學員身份');
              
              const updatedAttendees = app.attendees?.filter(att => att.customerId !== inventory.id) || [];
              
              if (updatedAttendees.length > 0) {
                  await saveToFirestore('appointments', app.id, { ...app, attendees: updatedAttendees });
                  addLog('團課取消', `學員 ${inventory.name} 取消參加 ${app.reason}`);
                  showNotification('已取消您的團課預約', 'info');
              } else {
                  await deleteFromFirestore('appointments', app.id);
                  addLog('團課取消', `最後一位學員 ${inventory.name} 取消，課程 ${app.reason} 已刪除`);
                  showNotification('您是最後一位學員，此團課已取消', 'info');
              }
          } else {
              await saveToFirestore('appointments', app.id, { ...app, status: 'cancelled', cancelReason: reason });
              addLog('客戶取消', `取消 ${app.customer?.name} - ${reason}`);
              showNotification('已取消預約', 'info');
          }
      } catch (e: any) { showNotification(`取消失敗: ${e.message}`, 'error'); } 
      finally { setIsProcessing(false); }
  };
  
  const resetBooking = () => {
    setBookingStep(1); setSelectedService(null); setSelectedCoach(null); setSelectedSlot(null);
    setFormData({ name: '', phone: '', email: '' });
  };

  const handleSlotClick = (date: string, time: string) => {
    const coachId = currentUser?.role === 'coach' ? currentUser.id : coaches[0]?.id || '';
    setBlockForm({ 
        id: null, type: 'private', coachId, date, time, reason: '', customer: null, attendees: [], repeatWeeks: 1
    });
    setMemberSearchTerm(''); setFilteredMembers([]);
    setIsBlockModalOpen(true);
  };

  const handleAppointmentClick = (app: Appointment) => {
      setBlockForm({
          id: app.id, type: app.type, coachId: app.coachId, date: app.date, time: app.time,
          reason: app.reason || '', customer: app.customer || null,
          attendees: app.attendees || [],
          repeatWeeks: 1,
      });
      setMemberSearchTerm(''); setFilteredMembers([]);
      setIsBlockModalOpen(true);
      setDeleteConfirm(false);
  };
  
  const handleSaveBlock = async () => {
    const { id, type, coachId, date, time, reason, customer, attendees, repeatWeeks } = blockForm;
    if (!coachId || !date || !time) { showNotification('缺少必要資訊', 'error'); return; }

    if (type === 'group' && (!reason || (attendees || []).length === 0)) {
        showNotification('團課名稱與至少一位學員為必填', 'error'); return;
    }
    if (type === 'private' && !customer) {
        showNotification('請選擇一位客戶', 'error'); return;
    }
    
    try {
        const coach = coaches.find(c => c.id === coachId);
        const appointmentsToSave: Appointment[] = [];
        
        for (let i = 0; i < (repeatWeeks || 1); i++) {
            const loopDate = new Date(date);
            loopDate.setDate(loopDate.getDate() + (i * 7));
            const dateKey = formatDateKey(loopDate.getFullYear(), loopDate.getMonth(), loopDate.getDate());
            
            // Check for conflict only when creating new
            if (!id) {
                const status = getSlotStatus(dateKey, time, coach, appointments);
                if (status.status === 'booked') {
                    showNotification(`${dateKey} ${time} 已被預約`, 'error'); continue;
                }
            }
            
            const appointmentId = id && i === 0 ? id : `${Date.now()}_${i}`;
            const baseApp = {
                id: appointmentId, type, date: dateKey, time, coachId, coachName: coach?.name,
                status: 'confirmed' as const, createdAt: new Date().toISOString()
            };

            if (type === 'group') {
                appointmentsToSave.push({ ...baseApp, reason, attendees: attendees || [], customer: null, service: null });
            } else if (type === 'private') {
                appointmentsToSave.push({ ...baseApp, customer, service: null, reason: '私人課程' });
            } else { // block
                appointmentsToSave.push({ ...baseApp, reason, customer: null, service: null });
            }
        }
        
        const updates = appointmentsToSave.map(app => ({ col: 'appointments', id: app.id, data: app }));
        await batchUpdateFirestore(updates);
        
        const logAction = id ? '更新預約' : '建立預約';
        const logDetails = `${type} - ${reason || customer?.name} @ ${date} ${time} (${coach?.name})` + ((repeatWeeks || 1) > 1 ? ` 重複 ${repeatWeeks} 週` : '');
        addLog(logAction, logDetails);
        showNotification('行程已儲存');
        setIsBlockModalOpen(false);

    } catch (e: any) { showNotification(`儲存失敗: ${e.message}`, 'error'); }
  };

  const handleDeleteBlock = async () => {
    if (!blockForm.id) return;
    try {
      await deleteFromFirestore('appointments', blockForm.id);
      addLog('刪除預約', `刪除 ${blockForm.reason || blockForm.customer?.name}`);
      showNotification('預約已刪除');
      setIsBlockModalOpen(false);
    } catch (e: any) { showNotification(`刪除失敗: ${e.message}`, 'error'); }
  };

  const handleCheckIn = async (app: Appointment) => {
    try {
        await saveToFirestore('appointments', app.id, { ...app, status: 'checked_in' });
        addLog('客戶簽到', `${app.customer?.name || app.lineName} 已簽到`);
        showNotification('簽到成功，請告知教練核實');
    } catch (e) { showNotification('簽到失敗', 'error'); }
  };

  const handleToggleComplete = async (app: Appointment) => {
    if (isProcessing) return; setIsProcessing(true);
    const isReverting = app.status === 'completed';
    const newStatus = isReverting ? 'checked_in' : 'completed';
    
    try {
        const batch = writeBatch(db);
        const appRef = doc(db, 'appointments', app.id);
        batch.update(appRef, { status: newStatus });
        
        let logDetails = '';

        if (app.type === 'group') {
            const attendees = app.attendees || [];
            if (attendees.length > 0) {
                const inventoryUpdates = attendees.map(att => {
                    const inv = inventories.find(i => i.id === att.customerId);
                    if (inv) return { invRef: doc(db, 'user_inventory', inv.id), name: inv.name };
                    return null;
                }).filter(Boolean);

                inventoryUpdates.forEach(update => {
                    if(update) batch.update(update.invRef, { 'credits.group': increment(isReverting ? 1 : -1) });
                });
                
                const names = inventoryUpdates.map(u => u?.name).join(', ');
                logDetails = `為團課 "${app.reason}" 的學員 (${names}) ${isReverting ? '返還' : '扣除'} 1 點團課點數`;
            }
        } else { // Private
            let inventory: UserInventory | undefined;
            if (app.lineUserId) inventory = inventories.find(i => i.lineUserId === app.lineUserId);
            if (!inventory && app.customer?.phone) inventory = inventories.find(i => i.phone === app.customer.phone && i.name === app.customer.name);
            
            if (inventory) {
                const invRef = doc(db, 'user_inventory', inventory.id);
                batch.update(invRef, { 'credits.private': increment(isReverting ? 1 : -1) });
                logDetails = `${isReverting ? '返還' : '扣除'} ${inventory.name} 1 點私人課`;
            } else {
                logDetails = `學員 ${app.customer?.name} 未找到庫存資料，無法${isReverting ? '返還' : '扣除'}點數`;
            }
        }

        await batch.commit();
        addLog(isReverting ? '撤銷完課' : '完課確認', logDetails);
        showNotification(isReverting ? '已撤銷完課狀態' : '已確認完課並扣點');

    } catch (e: any) { showNotification(`操作失敗: ${e.message}`, 'error'); } 
    finally { setIsProcessing(false); }
  };

  const handleAdminCancel = (app: Appointment) => {
    setConfirmModal({
        isOpen: true, title: '取消預約確認', message: `您確定要取消 ${app.date} ${app.time} 的課程嗎？`,
        isDanger: true, showInput: true, inputLabel: '取消原因 (必填)', inputType: 'text',
        onConfirm: async (reason) => {
            if (!reason) { showNotification('請填寫取消原因', 'error'); return; }
            await saveToFirestore('appointments', app.id, { ...app, status: 'cancelled', cancelReason: `管理員取消: ${reason}` });
            addLog('管理員取消', `取消 ${app.reason || app.customer?.name} - ${reason}`);
            showNotification('預約已取消');
        }
    });
  };

  const handleSaveCoach = async (coach: Coach, email?: string, password?: string) => {
    try {
        let uid = coach.id;
        if (email && password) { // Is a new coach
            uid = await createAuthUser(email, password);
            const userProfile: User = { id: uid, name: coach.name, role: coach.role, email: email, status: 'active' };
            await saveToFirestore('users', uid, userProfile);
        }
        await saveToFirestore('coaches', uid, { ...coach, id: uid });
        addLog('員工管理', `儲存員工資料: ${coach.name}`);
        showNotification('員工資料已儲存');
    } catch (e: any) { showNotification(`儲存失敗: ${e.message}`, 'error'); }
  };
  
  const handleDeleteCoach = (id: string, name: string) => {
    setConfirmModal({
        isOpen: true, title: '刪除員工確認',
        message: `確定要刪除員工 "${name}" 嗎？此員工帳號將被停用，但不會刪除歷史預約紀錄。`,
        isDanger: true, showInput: false,
        onConfirm: async () => {
            try {
                await disableUserInFirestore(id);
                addLog('員工管理', `停用員工: ${name}`);
                showNotification(`員工 ${name} 已停用`);
            } catch (e: any) { showNotification(`操作失敗: ${e.message}`, 'error'); }
        }
    });
  };

  const handleBatchDelete = () => {
      setConfirmModal({
          isOpen: true, title: '批次刪除確認',
          message: `您確定要永久刪除選取的 ${selectedBatch.size} 筆紀錄嗎？此操作無法復原。`,
          isDanger: true, showInput: false,
          onConfirm: async () => {
              try {
                  const batch = writeBatch(db);
                  selectedBatch.forEach(id => batch.delete(doc(db, 'appointments', id)));
                  await batch.commit();
                  addLog('批次管理', `刪除了 ${selectedBatch.size} 筆紀錄`);
                  showNotification('已批次刪除');
                  setSelectedBatch(new Set());
                  setIsBatchMode(false);
              } catch (e: any) { showNotification(`刪除失敗: ${e.message}`, 'error'); }
          }
      });
  };

  const analysisData = { coachStats: [] }; // Placeholder for now

  // --- RENDER ---
  if (isAuthLoading) return <div className="w-screen h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900"><RefreshCw className="animate-spin text-indigo-500" size={48}/></div>;

  if (view === 'my-bookings' && liffProfile) {
      return (
          <div className={`font-sans ${isDarkMode ? 'dark' : ''} bg-slate-50 dark:bg-slate-900`}>
              <MyBookings 
                  liffProfile={liffProfile}
                  appointments={appointments}
                  coaches={coaches}
                  onCancel={handleCustomerCancel}
                  onCheckIn={handleCheckIn}
                  inventories={inventories}
                  workoutPlans={workoutPlans}
              />
          </div>
      );
  }

  return (
    <div className={`font-sans ${isDarkMode ? 'dark' : ''} bg-slate-50 dark:bg-slate-900`}>
      {/* Global Notification */}
      {notification && (
        <div className={`fixed top-5 right-5 z-[100] p-4 rounded-xl shadow-lg text-white font-bold animate-slideUp border
            ${notification.type === 'success' ? 'bg-green-500 border-green-600' : notification.type === 'error' ? 'bg-red-500 border-red-600' : 'bg-blue-500 border-blue-600'}`}>
            {notification.msg}
        </div>
      )}

      {/* Main View Logic */}
      {currentUser ? (
        <AdminDashboard
          currentUser={currentUser} onLogout={handleLogout}
          adminTab={adminTab} setAdminTab={setAdminTab}
          renderWeeklyCalendar={() => 
            <WeeklyCalendar 
              currentWeekStart={currentWeekStart} setCurrentWeekStart={setCurrentWeekStart} 
              currentUser={currentUser} coaches={coaches} appointments={appointments}
              onSlotClick={handleSlotClick} onAppointmentClick={handleAppointmentClick}
              onToggleComplete={handleToggleComplete} isLoading={dbStatus === 'connecting'}
            />}
          appointments={appointments} coaches={coaches} logs={logs} inventories={inventories} workoutPlans={workoutPlans}
          selectedBatch={selectedBatch} toggleBatchSelect={(id) => setSelectedBatch(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
          handleBatchDelete={handleBatchDelete}
          analysis={analysisData} handleExportStatsCsv={() => {}} handleExportJson={() => {}} triggerImport={() => {}} handleFileImport={() => {}}
          updateCoachWorkDays={() => {}} onSaveCoach={handleSaveCoach} onDeleteCoach={handleDeleteCoach}
          onOpenBatchBlock={() => { setIsBatchMode(true); setIsBlockModalOpen(true); }}
          onSaveInventory={handleSaveInventory} onDeleteInventory={handleDeleteInventory}
          onSavePlan={handleSaveWorkoutPlan} onDeletePlan={handleDeleteWorkoutPlan}
          onGoToBooking={() => setView('booking')}
          onToggleComplete={handleToggleComplete} onCancelAppointment={handleAdminCancel}
        />
      ) : view === 'booking' ? (
        <div className="min-h-screen p-4 md:p-8">
            <header className="flex justify-between items-center mb-8 max-w-7xl mx-auto">
                <h1 className="text-2xl font-bold dark:text-white flex items-center gap-2">
                    <CalendarIcon size={24} className="text-indigo-500"/>
                    活力學苑預約系統
                </h1>
                <div className="flex items-center gap-4">
                    <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                        {isDarkMode ? <Sun/> : <Moon/>}
                    </button>
                    <button onClick={() => setView('admin')} className="flex items-center gap-2 bg-slate-800 text-white dark:bg-white dark:text-slate-900 px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:opacity-90 transition-opacity">
                        <Settings size={16}/> 管理後台
                    </button>
                </div>
            </header>
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
        </div>
      ) : ( // Admin Login
        <div className="w-screen h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-800">
          <div className="w-full max-w-md p-8 glass-panel rounded-3xl m-4">
              <h2 className="text-2xl font-bold mb-6 text-center dark:text-white">管理員登入</h2>
              <form onSubmit={handleEmailLogin} className="space-y-4">
                  <input type="email" placeholder="Email" value={loginForm.email} onChange={e => setLoginForm({...loginForm, email: e.target.value})} className="w-full p-3 glass-input rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all dark:text-white" required/>
                  <input type="password" placeholder="Password" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} className="w-full p-3 glass-input rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all dark:text-white" required/>
                  <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-colors">登入</button>
                  <button type="button" onClick={() => setView('booking')} className="w-full py-2 text-center text-sm text-slate-500 hover:text-slate-700">返回預約頁面</button>
              </form>
          </div>
        </div>
      )}
      
      {/* Modals */}
      {isBlockModalOpen && currentUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setIsBlockModalOpen(false)}>
              <div className="glass-panel w-full max-w-2xl rounded-3xl shadow-lg animate-slideUp border border-white/40" onClick={e => e.stopPropagation()}>
                  <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                      <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                        <Edit3 size={18} className="text-indigo-500"/> {blockForm.id ? '編輯行程' : '新增行程'}
                      </h3>
                      <button onClick={() => setIsBlockModalOpen(false)}><X className="text-slate-500"/></button>
                  </div>
                  <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                      <div className="space-y-4">
                          <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl">
                              {['private', 'group', 'block'].map(type => (
                                <button key={type} onClick={() => setBlockForm(p => ({...p, type: type as any}))} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${blockForm.type === type ? 'bg-white dark:bg-slate-700 shadow' : 'text-slate-500'}`}>
                                  {type === 'private' ? '私人課' : type === 'group' ? '團體課' : '系統註記'}
                                </button>
                              ))}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                  <label className="text-xs font-bold text-slate-500">日期</label>
                                  <input type="date" value={blockForm.date} onChange={e => setBlockForm({...blockForm, date: e.target.value})} className="w-full glass-input p-2 rounded-xl mt-1 text-sm"/>
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-slate-500">時間</label>
                                  <select value={blockForm.time} onChange={e => setBlockForm({...blockForm, time: e.target.value})} className="w-full glass-input p-2 rounded-xl mt-1 text-sm">
                                      {ALL_TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                                  </select>
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-slate-500">教練</label>
                                  <select value={blockForm.coachId} disabled={currentUser.role === 'coach'} onChange={e => setBlockForm({...blockForm, coachId: e.target.value})} className="w-full glass-input p-2 rounded-xl mt-1 text-sm disabled:opacity-70">
                                      {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                  </select>
                              </div>
                          </div>
                          
                          {blockForm.type === 'private' && (
                            <div>
                                <label className="text-xs font-bold text-slate-500">客戶</label>
                                {blockForm.customer ? (
                                    <div className="flex items-center justify-between p-2 mt-1 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                                        <span className="font-bold text-indigo-700 dark:text-indigo-300">{blockForm.customer.name} - {blockForm.customer.phone}</span>
                                        <button onClick={() => setBlockForm({...blockForm, customer: null})}><X size={16}/></button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                      <input type="text" placeholder="搜尋姓名/電話" value={memberSearchTerm} onChange={e => setMemberSearchTerm(e.target.value)} className="w-full glass-input p-2 rounded-xl mt-1 text-sm"/>
                                      {filteredMembers.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-lg border dark:border-slate-700 max-h-40 overflow-y-auto">
                                          {filteredMembers.map(m => <div key={m.id} onClick={() => { setBlockForm({...blockForm, customer: {name: m.name, phone: m.phone || '', email: m.email || ''}}); setMemberSearchTerm(''); }} className="p-2 hover:bg-indigo-50 cursor-pointer">{m.name} ({m.phone})</div>)}
                                        </div>
                                      )}
                                    </div>
                                )}
                            </div>
                          )}

                          {blockForm.type === 'group' && (
                              <div className="space-y-4">
                                  <div>
                                      <label className="text-xs font-bold text-slate-500">團課名稱</label>
                                      <input type="text" placeholder="e.g. 燃脂團課" value={blockForm.reason} onChange={e => setBlockForm({...blockForm, reason: e.target.value})} className="w-full glass-input p-2 rounded-xl mt-1 text-sm"/>
                                  </div>
                                  <div>
                                      <label className="text-xs font-bold text-slate-500 flex justify-between">
                                        <span>學員管理</span> 
                                        <span className={`${(blockForm.attendees?.length || 0) >= 8 ? 'text-red-500' : ''}`}>({blockForm.attendees?.length || 0}/8 人)</span>
                                      </label>
                                      {(blockForm.attendees?.length || 0) < 8 && (
                                        <div className="relative">
                                          <input type="text" placeholder="搜尋姓名/電話新增" value={memberSearchTerm} onChange={e => setMemberSearchTerm(e.target.value)} className="w-full glass-input p-2 rounded-xl mt-1 text-sm"/>
                                          {filteredMembers.length > 0 && (
                                            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-lg border dark:border-slate-700 max-h-40 overflow-y-auto">
                                              {filteredMembers.map(m => (
                                                <div key={m.id} onClick={() => { setBlockForm(p => ({...p, attendees: [...(p.attendees || []), {customerId: m.id, name: m.name, status: 'joined'}]})); setMemberSearchTerm(''); }} className="p-2 hover:bg-indigo-50 cursor-pointer">{m.name} ({m.phone})</div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      <div className="flex flex-wrap gap-2 mt-2">
                                          {(blockForm.attendees || []).map(att => (
                                            <div key={att.customerId} className="flex items-center gap-1 bg-sky-100 text-sky-800 px-2 py-1 rounded-lg text-xs font-bold">
                                                {att.name}
                                                <button onClick={() => setBlockForm(p => ({...p, attendees: p.attendees?.filter(a => a.customerId !== att.customerId)}))}><X size={12}/></button>
                                            </div>
                                          ))}
                                      </div>
                                  </div>
                              </div>
                          )}

                          {blockForm.type === 'block' && (
                            <select value={blockForm.reason} onChange={e => setBlockForm({...blockForm, reason: e.target.value})} className="w-full glass-input p-2 rounded-xl text-sm">
                                {BLOCK_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          )}
                          
                          <div>
                              <label className="text-xs font-bold text-slate-500">重複週數 (1=不重複)</label>
                              <input type="number" min="1" max="8" value={blockForm.repeatWeeks} onChange={e => setBlockForm({...blockForm, repeatWeeks: Number(e.target.value)})} className="w-full glass-input p-2 rounded-xl mt-1 text-sm"/>
                          </div>
                      </div>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-b-3xl flex justify-between items-center">
                      <div>
                          {blockForm.id && <button onClick={() => setDeleteConfirm(true)} className={`text-red-500 text-sm font-bold flex items-center gap-1 ${deleteConfirm ? 'hidden' : ''}`}><Trash2 size={14}/> 刪除</button>}
                          {deleteConfirm && <button onClick={handleDeleteBlock} className="bg-red-500 text-white px-3 py-1 rounded-lg text-sm font-bold">確認刪除</button>}
                      </div>
                      <button onClick={handleSaveBlock} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-indigo-700">儲存</button>
                  </div>
              </div>
          </div>
      )}

      {confirmModal.isOpen && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
             <div className="glass-panel w-full max-w-sm rounded-3xl p-6 animate-slideUp border border-white/20">
                 {confirmModal.icon && <div className="w-16 h-16 bg-white/50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">{confirmModal.icon}</div>}
                 <h3 className="font-bold text-lg mb-2 text-center dark:text-white">{confirmModal.title}</h3>
                 <p className="text-sm text-gray-500 text-center mb-6" dangerouslySetInnerHTML={{ __html: confirmModal.message }}></p>
                 {confirmModal.showInput && (
                    <div className="mb-4">
                      <label className="text-xs font-bold text-slate-500">{confirmModal.inputLabel}</label>
                      <input type={confirmModal.inputType || 'text'} value={cancelReason} onChange={e => setCancelReason(e.target.value)} className="w-full glass-input p-2 rounded-xl mt-1 text-sm" autoFocus/>
                    </div>
                 )}
                 <div className="flex gap-3">
                     <button onClick={() => { setConfirmModal({isOpen: false, title:'', message:'', onConfirm:null, isDanger:false, showInput:false}); setCancelReason(''); }} className="flex-1 py-2.5 bg-gray-200 dark:bg-gray-700 rounded-xl font-bold text-gray-600 dark:text-gray-300">取消</button>
                     <button onClick={() => { confirmModal.onConfirm?.(cancelReason); setConfirmModal({isOpen: false, title:'', message:'', onConfirm:null, isDanger:false, showInput:false}); setCancelReason(''); }} className={`flex-1 py-2.5 text-white rounded-xl font-bold shadow-lg ${confirmModal.isDanger ? 'bg-red-500 shadow-red-500/30' : 'bg-indigo-600 shadow-indigo-500/30'}`}>確認</button>
                 </div>
             </div>
        </div>
      )}
    </div>
  );
}
