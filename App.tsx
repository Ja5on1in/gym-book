

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
  ChevronDown
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


import { INITIAL_COACHES, ALL_TIME_SLOTS, BLOCK_REASONS, GOOGLE_SCRIPT_URL, SERVICES } from './constants';
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
  
    useEffect(() => {
        if (!groupMemberSearch) {
            setGroupMemberResults([]);
            return;
        }
        const lowerTerm = groupMemberSearch.toLowerCase();
        const currentAttendeeIds = new Set(blockForm.attendees?.map(a => a.customerId));
        const results = inventories.filter(inv => 
            !currentAttendeeIds.has(inv.id) &&
            (inv.name.toLowerCase().includes(lowerTerm) || 
            (inv.phone && inv.phone.includes(lowerTerm)))
        ).slice(0, 5);
        setGroupMemberResults(results);
    }, [groupMemberSearch, inventories, blockForm.attendees]);

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

  const handleCustomerCancel = async (app: Appointment, reason: string, customerId?: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
        if (app.type === 'group' && customerId) {
            const currentAttendees = app.attendees?.filter(a => a.status === 'joined') || [];
            if (currentAttendees.length <= 1) {
                // Last person, cancel the whole class
                const updated = { ...app, status: 'cancelled' as const, cancelReason: `最後一位學員 ${currentAttendees[0]?.name || ''} 取消` };
                await saveToFirestore('appointments', app.id, updated);
                addLog('團課取消', `課程 ${app.reason} 因最後一位學員取消而關閉`);
            } else {
                // Not the last person, just remove them
                const updatedAttendees = app.attendees?.map(a => a.customerId === customerId ? { ...a, status: 'cancelled' as const } : a);
                await updateDoc(doc(db, 'appointments', app.id), { attendees: updatedAttendees });
                addLog('團課取消', `學員 ${customerId} 取消團課 ${app.reason}`);
            }
        } else {
            // Private class cancellation
            const updated = { ...app, status: 'cancelled' as const, cancelReason: reason };
            await saveToFirestore('appointments', app.id, updated);
            addLog('客戶取消', `客戶 ${app.customer?.name} 取消了預約`);
        }
        showNotification('預約已取消', 'success');
    } catch(e: any) {
        showNotification('取消失敗: '+e.message, 'error');
    } finally {
        setIsProcessing(false);
    }
  };

  const handleAdminCancel = (app: Appointment) => {
    setConfirmModal({
        isOpen: true,
        title: '取消預約',
        message: '請輸入取消原因 (例如：學員請假、教練臨時有事)',
        isDanger: true,
        showInput: true,
        inputLabel: '取消原因',
        icon: <Trash2 size={48} className="text-red-500"/>,
        onConfirm: async (reason) => {
            if (!reason) {
                showNotification('請輸入取消原因', 'error');
                return;
            }
            try {
                await saveToFirestore('appointments', app.id, { status: 'cancelled', cancelReason: reason });
                addLog('管理員取消', `取消預約 - 學員: ${app.customer?.name || '團體課'}, 教練: ${app.coachName}. 原因: ${reason}`);
                showNotification('預約已取消', 'success');
                setIsBlockModalOpen(false);
            } catch (e: any) {
                showNotification('操作失敗: ' + e.message, 'error');
            }
        }
    });
  };

  const handleToggleComplete = async (app: Appointment) => {
    if (isProcessing) return;
    setIsProcessing(true);

    const isCompleting = app.status !== 'completed';
    const inventoryId = app.lineUserId || (inventories.find(inv => inv.phone === app.customer?.phone)?.id);
    
    // Safety check for user inventory
    if (isCompleting && inventoryId && app.type !== 'block') {
        const userInvRef = doc(db, 'user_inventory', inventoryId);
        const userInvSnap = await getDoc(userInvRef);
        if (!userInvSnap.exists()) {
            showNotification(`錯誤: 找不到學員 ${app.customer?.name} 的庫存資料`, 'error');
            setIsProcessing(false);
            return;
        }
        const userInvData = userInvSnap.data() as UserInventory;
        const creditType = (app.type === 'private' || (app.type as string) === 'client') ? 'private' : 'group';

        if (userInvData.credits[creditType] <= 0) {
            showNotification(`提醒: ${app.customer?.name} 的 ${creditType === 'private' ? '私人課' : '團體課'} 點數不足 (0點)`, 'error');
        }
    }

    try {
        if (isCompleting) {
            // Completing the appointment
            // FIX: Explicitly type `updates` to allow different data shapes for batch operations.
            const updates: { col: string; id: string; data: any }[] = [{ col: 'appointments', id: app.id, data: { status: 'completed' } }];
            let logDetails = `確認 ${app.customer?.name} 完課，教練: ${app.coachName}`;
            
            if (inventoryId && app.type !== 'block') {
                const creditType = (app.type === 'private' || (app.type as string) === 'client') ? 'private' : 'group';
                updates.push({ 
                    col: 'user_inventory', 
                    id: inventoryId, 
                    data: { [`credits.${creditType}`]: increment(-1), lastUpdated: new Date().toISOString() } 
                });
                logDetails += `, 扣除 ${creditType === 'private' ? '私人' : '團體'} 課點數 1 點。`;
            }
            
            await batchUpdateFirestore(updates);
            addLog('完課確認', logDetails);
            showNotification('課程已標示為完課', 'success');

        } else {
            // Reverting a completed appointment
            // FIX: Explicitly type `updates` to allow different data shapes for batch operations.
            const updates: { col: string; id: string; data: any }[] = [{ col: 'appointments', id: app.id, data: { status: 'confirmed' } }];
            let logDetails = `由管理員 ${currentUser?.name} 撤銷 ${app.customer?.name} 的完課紀錄`;

            if (inventoryId && app.type !== 'block') {
                 const creditType = (app.type === 'private' || (app.type as string) === 'client') ? 'private' : 'group';
                 updates.push({
                     col: 'user_inventory',
                     id: inventoryId,
                     data: { [`credits.${creditType}`]: increment(1), lastUpdated: new Date().toISOString() }
                 });
                 logDetails += `, 返還 ${creditType === 'private' ? '私人' : '團體'} 課點數 1 點。`;
            }
            await batchUpdateFirestore(updates);
            addLog('完課撤銷', logDetails);
            showNotification('完課狀態已撤銷，點數已返還', 'success');
        }
    } catch (e: any) {
        console.error("Toggle Complete Error:", e);
        showNotification('操作失敗: ' + e.message, 'error');
    } finally {
        setIsProcessing(false);
    }
  };

  const handleCheckIn = async (app: Appointment) => {
    try {
      await saveToFirestore('appointments', app.id, { status: 'checked_in' });
      addLog('學員簽到', `學員 ${app.customer?.name} 已簽到`);
      showNotification('簽到成功！請將畫面出示給教練', 'success');
    } catch (e) {
      showNotification('簽到失敗', 'error');
    }
  };

  const handleSaveCoach = async (coach: Coach, email?: string, password?: string) => {
    try {
      let coachId = coach.id;
      if (email && password) { // New user creation
          coachId = await createAuthUser(email, password);
      }
      if (!coachId) throw new Error("無法取得用戶ID");

      const dataToSave = { ...coach, id: coachId };
      delete (dataToSave as any).password;
      await saveToFirestore('coaches', coachId, dataToSave);
      
      addLog('員工管理', `更新/新增員工資料: ${coach.name}`);
      showNotification('員工資料儲存成功', 'success');
    } catch (e: any) {
      showNotification('儲存失敗: ' + e.message, 'error');
    }
  };

  const handleDeleteCoach = (id: string, name: string) => {
    setConfirmModal({
        isOpen: true,
        title: '停用員工帳號',
        message: `確定要停用 ${name} 的帳號嗎？此操作會使其無法再登入系統，但不會刪除歷史紀錄。`,
        isDanger: true,
        showInput: false,
        icon: <UserIcon size={48} className="text-red-500"/>,
        onConfirm: async () => {
             try {
                await disableUserInFirestore(id);
                addLog('員工管理', `停用員工 ${name}`);
                showNotification('員工已停用', 'success');
             } catch(e: any) {
                showNotification('停用失敗: '+e.message, 'error');
             }
        }
    });
  };

  const openSlotModal = (dateKey: string, time: string, coachId?: string) => {
    if (!currentUser) return;

    // First, find if there's an existing appointment in this slot
    const existingApp = appointments.find(a =>
        a.date === dateKey &&
        a.time === time &&
        (coachId ? a.coachId === coachId : true) &&
        a.status !== 'cancelled'
    );

    if (existingApp) {
        // Edit existing appointment
        if (currentUser.role === 'coach' && existingApp.coachId !== currentUser.id) {
            showNotification('您無法編輯其他教練的課程', 'error');
            return;
        }

        const attendees = (existingApp.attendees || []).map(a => ({
          customerId: a.customerId,
          name: a.name,
          status: a.status
        }));

        setBlockForm({
            id: existingApp.id,
            type: existingApp.type,
            coachId: existingApp.coachId,
            date: existingApp.date,
            time: existingApp.time,
            endTime: ALL_TIME_SLOTS[ALL_TIME_SLOTS.indexOf(existingApp.time) + 1] || existingApp.time,
            reason: existingApp.reason || (existingApp.service?.name ?? ''),
            customer: existingApp.customer,
            attendees: attendees,
            maxAttendees: existingApp.maxAttendees
        });
        setMemberSearchTerm(existingApp.customer?.name || '');
    } else {
        // Create new
        const defaultCoachId = currentUser.role === 'manager' 
            ? (coaches[0]?.id || '') 
            : currentUser.id;
        
        setBlockForm({
            id: null,
            type: 'block',
            coachId: defaultCoachId,
            date: dateKey,
            time: time,
            endTime: ALL_TIME_SLOTS[ALL_TIME_SLOTS.indexOf(time) + 1] || time,
            reason: BLOCK_REASONS[0],
            customer: null,
            attendees: [],
            maxAttendees: 8
        });
        setMemberSearchTerm('');
    }
    setDeleteConfirm(false);
    setIsBlockModalOpen(true);
  };
  
  const handleBlockFormChange = (field: keyof BlockFormState, value: any) => {
    const newForm = { ...blockForm, [field]: value };
    if (field === 'type') {
        if (value === 'private') newForm.reason = SERVICES.find(s=>s.id === 'coaching')?.name || '一對一教練課';
        else if (value === 'group') newForm.reason = '團體課';
        else newForm.reason = BLOCK_REASONS[0]; // 'block'
    }
    setBlockForm(newForm);
  };

  const handleSaveBlock = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    if (blockForm.type !== 'block' && !blockForm.customer) {
        showNotification('私人課與團體課必須指定學員', 'error');
        setIsProcessing(false);
        return;
    }

    try {
        const id = blockForm.id || Date.now().toString();
        
        let service = null;
        if(blockForm.type === 'private') {
            service = SERVICES.find(s => s.name === blockForm.reason) || SERVICES[0];
        }

        const data: Appointment = {
            id: id,
            type: blockForm.type,
            date: blockForm.date,
            time: blockForm.time,
            coachId: blockForm.coachId,
            coachName: coaches.find(c => c.id === blockForm.coachId)?.name || '未知',
            reason: blockForm.type !== 'private' ? blockForm.reason : undefined,
            service: blockForm.type === 'private' ? service : null,
            customer: blockForm.customer,
            status: 'confirmed',
            createdAt: new Date().toISOString(),
            attendees: blockForm.type === 'group' ? (blockForm.attendees || []) : undefined,
            maxAttendees: blockForm.type === 'group' ? (blockForm.maxAttendees || 8) : undefined
        };
        await saveToFirestore('appointments', id, data);
        
        addLog('後台排程', `新增/更新了 ${blockForm.coachId} 的 ${blockForm.type} 時段`);
        showNotification('時段儲存成功', 'success');
        setIsBlockModalOpen(false);
    } catch (e: any) {
        showNotification('儲存失敗: ' + e.message, 'error');
    } finally {
        setIsProcessing(false);
    }
  };
  
  const handleBatchBlock = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    const startIdx = ALL_TIME_SLOTS.indexOf(blockForm.time);
    const endIdx = ALL_TIME_SLOTS.indexOf(blockForm.endTime || blockForm.time);
    const repeat = blockForm.repeatWeeks || 1;

    if (startIdx >= endIdx) {
      showNotification('結束時間必須晚於開始時間', 'error');
      setIsProcessing(false);
      return;
    }
    
    try {
      const updates: { col: string; id: string; data: any }[] = [];
      const coachName = coaches.find(c => c.id === blockForm.coachId)?.name || '未知';

      for (let w = 0; w < repeat; w++) {
        const targetDate = addDays(new Date(blockForm.date), w * 7);
        const dateKey = formatDateKey(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        
        // Skip if it's a day off for the coach
        const coach = coaches.find(c => c.id === blockForm.coachId);
        if (coach && isCoachDayOff(dateKey, coach)) {
          continue;
        }
        
        for (let i = startIdx; i < endIdx; i++) {
          const time = ALL_TIME_SLOTS[i];
          const existingApp = appointments.find(a => 
            a.date === dateKey && 
            a.time === time && 
            a.coachId === blockForm.coachId &&
            a.status !== 'cancelled'
          );
          
          if (existingApp) continue; // Skip if already booked

          const id = `${Date.now()}-${w}-${i}`;
          const newBlock: Appointment = {
            id, type: 'block', date: dateKey, time, coachId: blockForm.coachId, coachName,
            reason: blockForm.reason, status: 'confirmed', createdAt: new Date().toISOString(),
            customer: null, service: null,
          };
          updates.push({ col: 'appointments', id, data: newBlock });
        }
      }

      if (updates.length > 0) {
        await batchUpdateFirestore(updates);
        addLog('批次管理', `為 ${coachName} 新增了 ${updates.length} 個鎖定時段`);
        showNotification(`成功新增 ${updates.length} 個鎖定時段`, 'success');
      } else {
        showNotification('沒有可新增的時段 (可能已預約或為休假日)', 'info');
      }

      setIsBlockModalOpen(false);
    } catch (e: any) {
      showNotification('批次操作失敗: ' + e.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteBlock = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    if (blockForm.id) {
        try {
            await deleteFromFirestore('appointments', blockForm.id);
            addLog('後台刪除', `刪除了ID為 ${blockForm.id} 的預約`);
            showNotification('時段已刪除', 'success');
            setIsBlockModalOpen(false);
        } catch (e: any) {
            showNotification('刪除失敗: ' + e.message, 'error');
        } finally {
            setIsProcessing(false);
        }
    }
  };

  const handleBatchDelete = () => {
    setConfirmModal({
        isOpen: true,
        title: '批次刪除確認',
        message: `確定要刪除選取的 ${selectedBatch.size} 筆預約/時段嗎？此操作無法復原。`,
        isDanger: true,
        showInput: false,
        icon: <Trash2 size={48} className="text-red-500"/>,
        onConfirm: async () => {
            try {
                if (isFirebaseAvailable && db) {
                    const batch = writeBatch(db);
                    selectedBatch.forEach(id => {
                        const docRef = doc(db, 'appointments', id);
                        batch.delete(docRef);
                    });
                    await batch.commit();
                } else { // Fallback for local storage
                    for (const id of selectedBatch) {
                        await deleteFromFirestore('appointments', id);
                    }
                }
                addLog('批次刪除', `刪除了 ${selectedBatch.size} 筆預約`);
                showNotification(`成功刪除 ${selectedBatch.size} 筆資料`, 'success');
                setSelectedBatch(new Set());
                setIsBatchMode(false);
            } catch (e: any) {
                showNotification('批次刪除失敗: ' + e.message, 'error');
            }
        }
    });
  };

  const addAttendee = (member: UserInventory) => {
      const currentAttendees = blockForm.attendees || [];
      if (!currentAttendees.some(a => a.customerId === member.id)) {
          handleBlockFormChange('attendees', [...currentAttendees, { customerId: member.id, name: member.name, status: 'joined' }]);
      }
      setGroupMemberSearch('');
  };
  
  const removeAttendee = (customerId: string) => {
      handleBlockFormChange('attendees', (blockForm.attendees || []).filter(a => a.customerId !== customerId));
  };


  // --- RENDER ---
  if (isAuthLoading) {
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center">
            <RefreshCw className="animate-spin text-indigo-500" size={48} />
            <p className="mt-4 text-slate-500 font-medium">驗證身份中...</p>
        </div>
    </div>;
  }
  
  const renderWeeklyCalendar = () => (
    <WeeklyCalendar 
      currentWeekStart={currentWeekStart}
      setCurrentWeekStart={setCurrentWeekStart}
      currentUser={currentUser!}
      coaches={coaches}
      appointments={appointments}
      onSlotClick={(date, time) => openSlotModal(date, time)}
      onAppointmentClick={(app) => openSlotModal(app.date, app.time, app.coachId)}
      onToggleComplete={handleToggleComplete}
      isLoading={dbStatus === 'connecting' || isProcessing}
    />
  );

  return (
    <>
      <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 antialiased font-sans transition-colors duration-300">
        
        {/* Main Content */}
        <div className="container mx-auto px-4 py-8">
            {!currentUser && view !== 'booking' && view !== 'my-bookings' && (
                <div className="max-w-sm mx-auto mt-20">
                   <div className="glass-panel p-8 rounded-3xl shadow-xl">
                      <h2 className="text-2xl font-bold mb-6 text-center dark:text-white">員工登入</h2>
                      <form onSubmit={handleEmailLogin} className="space-y-4">
                          <div>
                              <label className="text-sm font-bold text-slate-500">Email</label>
                              <input type="email" value={loginForm.email} onChange={e => setLoginForm({...loginForm, email: e.target.value})} className="w-full glass-input p-3 mt-1 rounded-xl" required />
                          </div>
                          <div>
                              <label className="text-sm font-bold text-slate-500">密碼</label>
                              <input type="password" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} className="w-full glass-input p-3 mt-1 rounded-xl" required />
                          </div>
                          <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-colors">登入</button>
                      </form>
                   </div>
                </div>
            )}
            
            {currentUser && view === 'admin' && (
               <AdminDashboard 
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  adminTab={adminTab}
                  setAdminTab={setAdminTab}
                  renderWeeklyCalendar={renderWeeklyCalendar}
                  appointments={appointments}
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
                  triggerImport={() => {}}
                  handleFileImport={(e) => {}}
                  coaches={coaches}
                  updateCoachWorkDays={(c) => {}}
                  logs={logs}
                  onSaveCoach={handleSaveCoach}
                  onDeleteCoach={handleDeleteCoach}
                  onOpenBatchBlock={() => {
                    setBlockForm({
                        id: null, type: 'block', coachId: currentUser?.id || '', date: formatDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()), 
                        time: '09:00', endTime: '10:00', reason: BLOCK_REASONS[0], customer: null, repeatWeeks: 1
                    });
                    setIsBatchMode(true);
                    setIsBlockModalOpen(true);
                  }}
                  inventories={inventories}
                  onSaveInventory={handleSaveInventory}
                  onDeleteInventory={handleDeleteInventory}
                  workoutPlans={workoutPlans}
                  onSavePlan={handleSaveWorkoutPlan}
                  onDeletePlan={handleDeleteWorkoutPlan}
                  onGoToBooking={() => setView('booking')}
                  onToggleComplete={handleToggleComplete}
                  onCancelAppointment={handleAdminCancel}
               />
            )}
            
            {(view === 'booking' || !currentUser) && view !== 'admin' && view !== 'my-bookings' && (
              <>
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <CalendarIcon className="text-indigo-500"/> 活力學苑預約系統
                    </h1>
                    <div className="flex items-center gap-2">
                        {currentUser && (
                            <button onClick={() => setView('admin')} className="p-2 bg-white/60 dark:bg-slate-800/60 rounded-full shadow-sm hover:bg-white transition-colors border border-transparent hover:border-slate-200">
                                <Settings className="text-slate-600 dark:text-slate-300"/>
                            </button>
                        )}
                        <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 bg-white/60 dark:bg-slate-800/60 rounded-full shadow-sm hover:bg-white transition-colors border border-transparent hover:border-slate-200">
                            {isDarkMode ? <Sun className="text-yellow-400"/> : <Moon className="text-indigo-500"/>}
                        </button>
                    </div>
                </div>
                <BookingWizard
                  step={bookingStep} setStep={setBookingStep}
                  selectedService={selectedService} setSelectedService={setSelectedService}
                  selectedCoach={selectedCoach} setSelectedCoach={setSelectedCoach}
                  selectedDate={selectedDate} setSelectedDate={setSelectedDate}
                  selectedSlot={selectedSlot} setSelectedSlot={setSelectedSlot}
                  formData={formData} setFormData={setFormData}
                  coaches={coaches.filter(c => c.status !== 'disabled')} appointments={appointments}
                  onSubmit={handleSubmitBooking}
                  reset={() => {
                    setBookingStep(1);
                    setSelectedService(null);
                    setSelectedCoach(null);
                    setSelectedSlot(null);
                    setSelectedDate(new Date());
                  }}
                  currentDate={currentDate}
                  handlePrevMonth={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                  handleNextMonth={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                  inventories={inventories}
                  onRegisterUser={checkAndCreateUser}
                  liffProfile={liffProfile}
                  onLogin={handleLiffLogin}
                />
              </>
            )}

            {view === 'my-bookings' && (
              <MyBookings 
                liffProfile={liffProfile}
                appointments={appointments}
                coaches={coaches}
                onCancel={handleCustomerCancel}
                onCheckIn={handleCheckIn}
                inventories={inventories}
                workoutPlans={workoutPlans}
              />
            )}
        </div>
      </div>

      {/* Block/Appointment Modal */}
      {isBlockModalOpen && currentUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => setIsBlockModalOpen(false)}>
          <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-slideUp border border-white/20 dark:border-slate-700/30 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100/50 dark:border-slate-700/50 flex justify-between items-center">
                <h3 className="font-bold text-xl dark:text-white flex items-center gap-2">
                    {isBatchMode ? <><Layers size={20} className="text-indigo-500"/> 批次管理</> : <><Edit3 size={20} className="text-indigo-500"/> {blockForm.id ? '編輯時段' : '新增時段'}</>}
                </h3>
                <button onClick={() => setIsBlockModalOpen(false)}><X className="text-slate-500"/></button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                {/* Type & Coach */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">類型</label>
                        <div className="relative mt-1">
                            <select value={blockForm.type} onChange={e => handleBlockFormChange('type', e.target.value)} disabled={isBatchMode}
                                className="w-full glass-input rounded-xl p-3 dark:text-white appearance-none pr-10 disabled:opacity-50 disabled:cursor-not-allowed">
                                <option value="block">內部鎖定</option>
                                <option value="private">私人課</option>
                                <option value="group">團體課</option>
                            </select>
                            <ChevronDown size={20} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">指定教練</label>
                         <div className="relative mt-1">
                            <select value={blockForm.coachId} onChange={e => handleBlockFormChange('coachId', e.target.value)}
                                disabled={currentUser.role === 'coach'}
                                className="w-full glass-input rounded-xl p-3 dark:text-white appearance-none pr-10 disabled:opacity-50 disabled:cursor-not-allowed">
                                {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                             <ChevronDown size={20} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                        </div>
                    </div>
                </div>

                {/* Date & Time */}
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">日期</label>
                        <input type="date" value={blockForm.date} onChange={e => handleBlockFormChange('date', e.target.value)}
                               className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white"/>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">開始時間</label>
                        <div className="relative mt-1">
                            <select value={blockForm.time} onChange={e => handleBlockFormChange('time', e.target.value)}
                                    className="w-full glass-input rounded-xl p-3 dark:text-white appearance-none pr-10">
                                {ALL_TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <ChevronDown size={20} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">結束時間</label>
                        <div className="relative mt-1">
                            <select value={blockForm.endTime} onChange={e => handleBlockFormChange('endTime', e.target.value)}
                                    className="w-full glass-input rounded-xl p-3 dark:text-white appearance-none pr-10">
                                {ALL_TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <ChevronDown size={20} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                        </div>
                    </div>
                </div>
                 
                {isBatchMode && (
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">重複週數</label>
                        <input type="number" min="1" max="8" value={blockForm.repeatWeeks || 1}
                               onChange={e => handleBlockFormChange('repeatWeeks', parseInt(e.target.value))}
                               className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white"/>
                    </div>
                )}
                
                {/* Reason / Customer */}
                {blockForm.type === 'block' ? (
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">事由</label>
                        <div className="relative mt-1">
                            <select value={blockForm.reason} onChange={e => handleBlockFormChange('reason', e.target.value)}
                                    className="w-full glass-input rounded-xl p-3 dark:text-white appearance-none pr-10">
                                {BLOCK_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                                <option value="custom">自訂</option>
                            </select>
                            <ChevronDown size={20} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                        </div>
                        {blockForm.reason === 'custom' && (
                            <input type="text" placeholder="請輸入自訂事由"
                                   onChange={e => handleBlockFormChange('reason', e.target.value)}
                                   className="w-full glass-input rounded-xl p-3 mt-2 dark:text-white"/>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="relative">
                            <label className="text-xs font-bold text-slate-500 uppercase">學員</label>
                            <div className="relative mt-1">
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                <input type="text" value={memberSearchTerm}
                                       onChange={e => {
                                           setMemberSearchTerm(e.target.value);
                                           handleBlockFormChange('customer', null);
                                       }}
                                       className="w-full glass-input rounded-xl p-3 pl-10 dark:text-white"
                                       placeholder="搜尋姓名/電話..." />
                            </div>
                            {filteredMembers.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-lg border dark:border-slate-700">
                                    {filteredMembers.map(m => (
                                        <button key={m.id} type="button" onClick={() => {
                                            setMemberSearchTerm(m.name);
                                            handleBlockFormChange('customer', { name: m.name, phone: m.phone || '', email: m.email || '' });
                                            if (blockForm.type === 'group' && m.id) {
                                                addAttendee(m);
                                            }
                                            setFilteredMembers([]);
                                        }} className="w-full text-left px-4 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30">
                                            {m.name} ({m.phone})
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {blockForm.type === 'private' && (
                             <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">課程項目</label>
                                <div className="relative mt-1">
                                    <select value={blockForm.reason} onChange={e => handleBlockFormChange('reason', e.target.value)}
                                        className="w-full glass-input rounded-xl p-3 dark:text-white appearance-none pr-10">
                                        {SERVICES.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                    </select>
                                    <ChevronDown size={20} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                                </div>
                            </div>
                        )}
                        {blockForm.type === 'group' && (
                            <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                <h4 className="font-bold text-sm flex items-center gap-2"><Users size={16}/> 團體課成員</h4>
                                <div className="relative">
                                     <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                    <input type="text" value={groupMemberSearch} onChange={e => setGroupMemberSearch(e.target.value)}
                                        className="w-full glass-input rounded-lg p-2 pl-9 dark:text-white text-sm" placeholder="搜尋並加入成員..." />
                                    {groupMemberResults.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border dark:border-slate-700 max-h-40 overflow-y-auto">
                                            {groupMemberResults.map(m => (
                                                <button key={m.id} type="button" onClick={() => addAttendee(m)} className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30">
                                                    {m.name} ({m.phone})
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {blockForm.attendees?.map(a => (
                                        <div key={a.customerId} className="flex items-center gap-1 bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 px-2 py-1 rounded-full text-xs font-bold">
                                            {a.name}
                                            <button type="button" onClick={() => removeAttendee(a.customerId)}><X size={12}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

             <div className="p-4 bg-white/50 dark:bg-slate-800/50 border-t border-slate-100/50 dark:border-slate-700/50 flex flex-col md:flex-row gap-3">
                {blockForm.id && !isBatchMode && (
                    <>
                        <button onClick={() => handleAdminCancel(appointments.find(a => a.id === blockForm.id)!)}
                                className="flex-1 py-3 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
                            <Trash2 size={18}/> 取消預約
                        </button>
                        <button onClick={() => setDeleteConfirm(true)}
                                className="flex-1 py-3 bg-red-500 text-white hover:bg-red-600 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
                           <Trash2 size={18}/> {deleteConfirm ? '再次確認刪除' : '永久刪除'}
                        </button>
                    </>
                )}
                <button onClick={isBatchMode ? handleBatchBlock : handleSaveBlock}
                        className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                    {isBatchMode ? <><Repeat size={18}/> 執行批次</> : <><CheckCircle2 size={18}/> 儲存</>}
                </button>
            </div>
          </div>
        </div>
      )}

       {confirmModal.isOpen && (
           <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
               <div className="glass-panel w-full max-w-sm rounded-3xl p-6 animate-slideUp border border-white/20">
                   {confirmModal.icon && <div className={`w-12 h-12 ${confirmModal.isDanger ? 'bg-red-100' : 'bg-indigo-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>{confirmModal.icon}</div>}
                   <h3 className="font-bold text-lg mb-2 text-center dark:text-white">{confirmModal.title}</h3>
                   <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6 whitespace-pre-line">{confirmModal.message}</p>
                   {confirmModal.showInput && (
                       <div className="mb-4">
                           <label className="text-xs font-bold text-slate-500">{confirmModal.inputLabel || '原因'}</label>
                           <input type={confirmModal.inputType || 'text'} value={cancelReason} onChange={e => setCancelReason(e.target.value)} 
                                  className="w-full glass-input p-3 mt-1 rounded-xl" autoFocus/>
                       </div>
                   )}
                   <div className="flex gap-3">
                       <button onClick={() => { setConfirmModal({ ...confirmModal, isOpen: false }); setCancelReason(''); }} className="flex-1 py-2.5 bg-slate-200 dark:bg-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300">關閉</button>
                       <button onClick={() => { confirmModal.onConfirm && confirmModal.onConfirm(cancelReason); setConfirmModal({ ...confirmModal, isOpen: false }); setCancelReason(''); }} 
                               className={`flex-1 py-2.5 text-white rounded-xl font-bold shadow-lg ${confirmModal.isDanger ? 'bg-red-500 shadow-red-500/30' : 'bg-indigo-600 shadow-indigo-500/30'}`}>
                           確認
                       </button>
                   </div>
               </div>
          </div>
       )}

      {notification && (
        <div className={`fixed bottom-5 right-5 z-[100] p-4 rounded-xl shadow-2xl text-white font-bold animate-slideUp flex items-center gap-3
          ${notification.type === 'success' ? 'bg-emerald-500' : notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}>
            {notification.type === 'success' ? <CheckCircle2 /> : notification.type === 'error' ? <AlertTriangle/> : <Info/>}
          {notification.msg}
        </div>
      )}
    </>
  );
}
