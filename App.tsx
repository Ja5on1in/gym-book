
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
  Lock as LockIcon,
  Layers,
  User as UserIcon,
  Search,
  X,
  CreditCard,
  Check,
  CheckCircle2
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
import { User, Appointment, Coach, Log, Service, Customer, BlockFormState, UserInventory } from './types';
import { formatDateKey, getStartOfWeek, getSlotStatus, isCoachDayOff } from './utils';

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
  
  // Login State
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  
  // Data
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [inventories, setInventories] = useState<UserInventory[]>([]);

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

  // LIFF State
  const [liffProfile, setLiffProfile] = useState<{ userId: string; displayName: string } | null>(null);

  // Modals & Forms
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  
  // Member Search State (New)
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [filteredMembers, setFilteredMembers] = useState<UserInventory[]>([]);

  // Cleaned up initial state
  const [blockForm, setBlockForm] = useState<BlockFormState>({
    id: null, type: 'block', coachId: '', date: formatDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()), time: '09:00', endTime: '10:00', reason: '內部訓練', customer: null, repeatWeeks: 1
  });
  const [selectedBatch, setSelectedBatch] = useState<Set<string>>(new Set());
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, message: string, onConfirm: ((reason?: string) => void) | null, isDanger: boolean, showInput: boolean}>({ isOpen: false, message: '', onConfirm: null, isDanger: false, showInput: false });
  const [cancelReason, setCancelReason] = useState('');

  // --- EFFECTS ---

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  useEffect(() => {
    const start = async () => {
        await initAuth();
        
        // Initialize LIFF
        const liff = (window as any).liff;
        if (liff) {
            try {
                await liff.init({ liffId: LIFF_ID });
                console.log('LIFF initialized');
                
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
                }
            } catch (err) {
                console.error('LIFF Init failed', err);
            }
        }
    };
    start();
  }, []);

  // Listen to Auth State with RETRY Logic
  useEffect(() => {
      if (!auth) {
          setIsAuthLoading(false);
          return;
      }
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          setIsAuthLoading(true);
          if (firebaseUser) {
              let userProfile = await getUserProfile(firebaseUser.uid);
              
              // Retry mechanism: Wait and try again if profile not found (handling race condition)
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
                      // Only set default coach ID if the loaded user is a coach
                      if (userProfile.role === 'coach') {
                        setBlockForm(prev => ({...prev, coachId: userProfile.id})); 
                      }
                  }
              } else {
                  console.warn("User has no profile in DB after retry");
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
    const unsubApps = subscribeToCollection('appointments', (data) => {
        const apps = data as Appointment[];
        const validApps = apps.filter(a => a && a.date && a.time && a.coachId);
        // FORCE NEW ARRAY REFERENCE to ensure UI updates, fixing bugs where UI shows old data
        setAppointments([...validApps]);
        setDbStatus(isFirebaseAvailable ? 'connected' : 'local');
        
        if (validApps.length > 0) localStorage.setItem('gym_backup_local', JSON.stringify(validApps));
    }, () => setDbStatus('error'));

    const unsubCoaches = subscribeToCollection('coaches', (data) => {
        if (data.length > 0) {
            setCoaches([...data] as Coach[]);
        } else {
             if (!isFirebaseAvailable && coaches.length === 0) setCoaches(INITIAL_COACHES);
        }
    }, () => {});

    const unsubLogs = subscribeToCollection('logs', (data) => {
        const loaded = data as Log[];
        setLogs(loaded.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()));
    }, () => {});
    
    const unsubInventory = subscribeToCollection('user_inventory', (data) => {
        setInventories([...data] as UserInventory[]);
    }, () => {});

    return () => {
        unsubApps();
        unsubCoaches && unsubCoaches();
        unsubLogs && unsubLogs();
        unsubInventory && unsubInventory();
    };
  }, []);

  // Filter Members Effect
  useEffect(() => {
      if (!memberSearchTerm) {
          setFilteredMembers([]);
          return;
      }
      const lowerTerm = memberSearchTerm.toLowerCase();
      const results = inventories.filter(inv => 
          inv.name.toLowerCase().includes(lowerTerm) || 
          (inv.phone && inv.phone.includes(lowerTerm))
      ).slice(0, 6); // Limit to 6 results
      setFilteredMembers(results);
  }, [memberSearchTerm, inventories]);

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
        // Non-blocking fetch
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
  const handleUpdateInventory = async (inventory: UserInventory) => {
      if (currentUser?.role !== 'manager') {
          showNotification('只有管理員可以修改點數', 'error');
          return;
      }
      // Find old inventory for logging
      const oldInv = inventories.find(i => i.id === inventory.id);
      const oldPrivate = oldInv ? oldInv.credits.private : '?';
      const oldGroup = oldInv ? oldInv.credits.group : '?';

      await saveToFirestore('user_inventory', inventory.id, {
          ...inventory,
          lastUpdated: new Date().toISOString()
      });

      addLog('庫存調整', `調整學員 ${inventory.name} 點數 - 1v1: ${oldPrivate} -> ${inventory.credits.private}, 團課: ${oldGroup} -> ${inventory.credits.group}`);
      showNotification('學員點數已更新', 'success');
  };

  const handleSaveInventory = async (inventory: UserInventory) => {
      try {
          // Check if ID exists, else create new ID
          const id = inventory.id || (inventory.lineUserId || (inventory.phone ? `phone_${inventory.phone}` : `manual_${Date.now()}`));
          
          // Auto-merge if phone exists but different ID
          const existingByPhone = inventories.find(i => i.phone && i.phone === inventory.phone && i.id !== id);
          if (existingByPhone) {
              if (window.confirm(`發現相同電話號碼的學員: ${existingByPhone.name}。是否更新該學員資料而非新增？`)) {
                 await saveToFirestore('user_inventory', existingByPhone.id, { ...existingByPhone, ...inventory, id: existingByPhone.id, lastUpdated: new Date().toISOString() });
                 showNotification('已更新現有學員資料', 'success');
                 return;
              }
          }

          await saveToFirestore('user_inventory', id, { ...inventory, id, lastUpdated: new Date().toISOString() });
          addLog('學員管理', `儲存學員資料: ${inventory.name}`);
          showNotification('學員資料已儲存', 'success');
      } catch (e) {
          console.error(e);
          showNotification('儲存失敗', 'error');
      }
  };

  const handleDeleteInventory = async (id: string) => {
      try {
          await deleteFromFirestore('user_inventory', id);
          addLog('學員管理', `刪除學員資料 ID: ${id}`);
          showNotification('學員資料已刪除', 'success');
      } catch (e) {
          showNotification('刪除失敗', 'error');
      }
  };

  const handleRegisterInventory = async (profile: { userId: string, displayName: string }) => {
      const newInventory: UserInventory = {
          id: profile.userId,
          lineUserId: profile.userId,
          name: profile.displayName,
          credits: { private: 0, group: 0 },
          lastUpdated: new Date().toISOString(),
      };
      await saveToFirestore('user_inventory', profile.userId, newInventory);
      addLog('新戶註冊', `自動建立學員資料: ${profile.displayName}`);
  };

  // --- SAFE BOOKING SUBMISSION (PRE-DEDUCT) ---
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
        let inventory = null;

        if (lineProfile) {
            inventory = inventories.find(i => i.lineUserId === lineProfile.userId);
            if (!inventory) {
                // Try finding by phone if LINE ID not match
                inventory = inventories.find(i => i.phone === formData.phone);
                
                // Enhancement: Automatic seamless linking
                if (inventory) {
                    if (!inventory.lineUserId) {
                        await saveToFirestore('user_inventory', inventory.id, {
                            ...inventory,
                            lineUserId: lineProfile.userId,
                            lastUpdated: new Date().toISOString()
                        });
                        addLog('帳號綁定', `自動綁定 LINE 用戶 ${lineProfile.displayName} 到學員 ${inventory.name}`);
                        inventory = { ...inventory, lineUserId: lineProfile.userId };
                    }
                }
            }

            // --- STRICT CREDIT CHECK & PRE-DEDUCT ---
            if (inventory) {
                 if (inventory.credits.private <= 0) {
                     showNotification('您的課程點數不足，請聯繫管理員續課', 'error');
                     return;
                 }
                 
                 // [Logic Update] Pre-deduct credits IMMEDIATELY upon booking
                 const newCredits = inventory.credits.private - 1;
                 await saveToFirestore('user_inventory', inventory.id, {
                     ...inventory,
                     credits: { ...inventory.credits, private: newCredits },
                     lastUpdated: new Date().toISOString()
                 });
                 // Update local reference just in case
                 inventory = { ...inventory, credits: { ...inventory.credits, private: newCredits } };

            } else {
                 if (lineProfile) {
                    showNotification('您的課程點數不足 (新用戶請聯繫管理員購課)', 'error');
                    return;
                 }
            }
            // ---------------------------
        }

        const id = Date.now().toString();
        const newApp: Appointment = { 
            id, 
            type: 'private', 
            date: dateKey, time: selectedSlot, 
            service: selectedService, coachId: selectedCoach.id, coachName: selectedCoach.name, 
            // Fix: ensure no undefined values in customer fields
            customer: { 
                name: formData.name, 
                phone: formData.phone || "", 
                email: formData.email || "" 
            }, 
            status: 'confirmed', createdAt: new Date().toISOString(),
            lineUserId: lineProfile?.userId || "", 
            lineName: lineProfile?.displayName || "" 
        };
        
        // 1. Save to Database
        await saveToFirestore('appointments', id, newApp);
        addLog('前台預約', `客戶 ${formData.name} 預約 ${selectedCoach.name} ${lineProfile ? '(已預扣 1 點)' : ''}`);
        
        // 2. Execute Webhook
        const webhookPayload = {
            action: 'create_booking',
            ...newApp,
            lineUserId: lineProfile?.userId || '',
            coachName: selectedCoach.name,
            title: selectedCoach.title || '教練', 
            type: 'private',
        };
        
        sendToGoogleScript(webhookPayload).catch(err => console.warn("Webhook failed silently", err));
        
        setBookingStep(5);
        showNotification('預約成功！(已扣除 1 點課程)', 'success');
        
    } catch (error: any) {
        console.error("Booking Error:", error);
        showNotification('預約系統忙碌中，請稍後再試: ' + error.message, 'error');
    }
  };

  const handleCustomerCancel = async (app: Appointment, reason: string) => {
      // Refund Logic: Check if app was confirmed/checked_in, implies credit was deducted.
      // Must refund.
      if (app.status === 'confirmed' || app.status === 'checked_in') {
          let inventory = null;
          if (app.lineUserId) inventory = inventories.find(i => i.lineUserId === app.lineUserId);
          if (!inventory && app.customer?.name) {
              inventory = inventories.find(i => i.name === app.customer?.name || (app.customer?.phone && i.phone === app.customer?.phone));
          }

          if (inventory) {
               const newCredits = inventory.credits.private + 1;
               await saveToFirestore('user_inventory', inventory.id, {
                   ...inventory,
                   credits: { ...inventory.credits, private: newCredits },
                   lastUpdated: new Date().toISOString()
               });
               addLog('取消返還', `取消課程，退還 ${app.customer?.name} 1 點 (目前: ${newCredits})`);
          }
      }

      const updated = { ...app, status: 'cancelled' as const, cancelReason: reason };
      await saveToFirestore('appointments', app.id, updated);
      
      addLog('客戶取消', `取消 ${app.customer?.name} - ${reason}`);
      const coach = coaches.find(c => c.id === app.coachId);
      
      // Async webhook - Fire and forget
      sendToGoogleScript({ 
          action: 'cancel_booking', 
          id: app.id, 
          reason, 
          lineUserId: app.lineUserId || "", // Ensure string
          coachName: app.coachName,
          title: coach?.title || '教練',
          date: app.date,
          time: app.time
      }).catch(e => console.warn("Cancel webhook failed", e));
      
      showNotification('已取消預約 (點數已退還)', 'info');
  };

  const resetBooking = () => {
    setBookingStep(1); setSelectedService(null); setSelectedCoach(null); setSelectedSlot(null); setFormData({ name: '', phone: '', email: '' });
  };

  // --- ADMIN BOOKING / BLOCKING ---
  const handleSaveBlock = async (e: React.FormEvent, force: boolean = false) => {
    if(e) e.preventDefault();
    if (!currentUser) return;
    const coach = coaches.find(c => c.id === (currentUser.role === 'manager' ? blockForm.coachId : currentUser.id));
    if (!coach) return;
    
    // Normalize Type
    const finalType = ((blockForm.type as string) === 'client' || blockForm.type === 'private') ? 'private' : blockForm.type;
    const isPrivate = finalType === 'private';
    
    // Strict Guard: Private bookings MUST have a customer from selection
    if (isPrivate && !blockForm.customer?.name) {
        showNotification('請先搜尋並選擇學員', 'error');
        return;
    }

    let targetInventory: UserInventory | undefined;

    // 1. Identification Phase
    if (isPrivate && blockForm.customer?.name) {
        targetInventory = inventories.find(i => 
            i.name === blockForm.customer?.name && 
            (blockForm.customer?.phone ? i.phone === blockForm.customer.phone : true)
        );
        
        // ADMIN DEDUCTION CHECK: If admin adds a private class manually, we should check/deduct points too?
        // Prompt implies "Any booking". Let's apply deduction if inventory exists.
        if (targetInventory) {
             if (targetInventory.credits.private <= 0) {
                 if (!window.confirm(`學員 ${targetInventory.name} 點數不足 (0)，確定要強制預約嗎？(將變成負數)`)) {
                     return;
                 }
             }
        }
    }

    const repeat = blockForm.repeatWeeks || 1;
    const batchOps: Appointment[] = [];
    
    // Standardize Date Parsing (Force YYYY-MM-DD input to be treated as local date part)
    const [y, m, d] = blockForm.date.split('-').map(Number);
    // Construct date using local time parts explicitly
    const startDate = new Date(y, m - 1, d); 

    let targetSlots = [blockForm.time];

    // Batch Slot Logic (Time Range)
    if (isBatchMode && blockForm.endTime) {
        const startIndex = ALL_TIME_SLOTS.indexOf(blockForm.time);
        const endIndex = ALL_TIME_SLOTS.indexOf(blockForm.endTime);
        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
            targetSlots = ALL_TIME_SLOTS.slice(startIndex, endIndex);
        }
    }

    let stopCreation = false;
    let deductedCount = 0;

    // Outer Loop: Weeks
    for (let i = 0; i < repeat; i++) {
        if (stopCreation) break;

        const targetDate = new Date(startDate);
        targetDate.setDate(startDate.getDate() + (i * 7));
        const dKey = formatDateKey(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

        // Inner Loop: Slots per day
        for (const slot of targetSlots) {
             const status = getSlotStatus(dKey, slot, coach, appointments, blockForm.id);
             
             if (status.status === 'available') {
                 const isEditSingle = (!isBatchMode && i === 0 && blockForm.id);
                 const id = isEditSingle ? blockForm.id! : `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                 
                 // Deduct logic for private booking in loop
                 if (targetInventory && isPrivate) {
                     deductedCount++;
                 }

                 batchOps.push({ 
                     id, 
                     type: finalType as any, 
                     date: dKey, 
                     time: slot, 
                     coachId: coach.id, 
                     coachName: coach.name, 
                     reason: blockForm.reason, 
                     status: 'confirmed', 
                     customer: (finalType === 'private' && blockForm.customer) ? {
                         name: blockForm.customer.name,
                         phone: blockForm.customer.phone || "",
                         email: blockForm.customer.email || ""
                     } : null,
                     createdAt: new Date().toISOString(),
                     lineUserId: targetInventory?.lineUserId || ""
                 });
             }
        }
    }

    if (batchOps.length === 0) { 
        if (!stopCreation) showNotification('選定時段已被占用或無效', 'error'); 
        return; 
    }
    
    // Batch Save
    try {
        // Apply deductions if any
        if (targetInventory && deductedCount > 0) {
             const newCredits = targetInventory.credits.private - deductedCount;
             await saveToFirestore('user_inventory', targetInventory.id, {
                 ...targetInventory,
                 credits: { ...targetInventory.credits, private: newCredits },
                 lastUpdated: new Date().toISOString()
             });
        }

        await Promise.all(batchOps.map(op => saveToFirestore('appointments', op.id, op)));
        addLog(blockForm.id ? '修改事件' : '新增事件', `處理 ${batchOps.length} 筆紀錄 (已扣除 ${deductedCount} 點)`);
        showNotification(`成功建立 ${batchOps.length} 筆預約`, 'success');
        setIsBlockModalOpen(false);
    } catch (e) {
        console.error(e);
        showNotification('儲存失敗', 'error');
    }
  };

  const handleActualDelete = () => {
     if (!blockForm.id) return;
     const target = appointments.find(a => a.id === blockForm.id);
     if (!target) return;
     
     const isPrivate = target.type === 'private' || (target.type as string) === 'client'; 

     if (isPrivate) { 
         setConfirmModal({
             isOpen: true, message: '請輸入取消預約的原因', isDanger: true, showInput: true,
             onConfirm: async (reason) => {
                 // REFUND LOGIC for Admin Cancel
                 if (target.status === 'confirmed' || target.status === 'checked_in') {
                      let inventory = null;
                      if (target.lineUserId) inventory = inventories.find(i => i.lineUserId === target.lineUserId);
                      if (!inventory && target.customer?.name) {
                          inventory = inventories.find(i => i.name === target.customer?.name);
                      }
                      if (inventory) {
                          const newCredits = inventory.credits.private + 1;
                          await saveToFirestore('user_inventory', inventory.id, {
                              ...inventory,
                              credits: { ...inventory.credits, private: newCredits },
                              lastUpdated: new Date().toISOString()
                          });
                      }
                 }

                 const updated = { ...target, status: 'cancelled' as const, cancelReason: reason };
                 await saveToFirestore('appointments', target.id, updated);
                 
                 addLog('取消預約', `取消 ${target.customer?.name} - ${reason} (已退還點數)`);
                 sendToGoogleScript({ action: 'cancel_booking', id: target.id, reason }).catch(e => console.warn(e));
                 
                 showNotification('已取消並退還點數', 'info');
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
      
      setBlockForm({ id: null, type: 'block', coachId: targetCoachId, date, time, endTime: ALL_TIME_SLOTS[ALL_TIME_SLOTS.indexOf(time)+1] || time, reason: '1v1教練課', customer: null, repeatWeeks: 1 });
      setMemberSearchTerm(''); // Reset search
      setDeleteConfirm(false); 
      setIsBatchMode(false);
      setIsBlockModalOpen(true);
  };

  const handleOpenBatchBlock = () => {
      if (!currentUser) return;
      const targetCoachId = currentUser.role === 'manager' ? (blockForm.coachId || coaches[0]?.id) : currentUser.id;
      const today = new Date();
      const dateStr = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());
      
      setBlockForm({ 
          id: null, type: 'block', coachId: targetCoachId, 
          date: dateStr, 
          time: '09:00', endTime: '12:00',
          reason: '內部訓練', customer: null, repeatWeeks: 1 
      });
      setMemberSearchTerm(''); // Reset search
      setDeleteConfirm(false); 
      setIsBatchMode(true);
      setIsBlockModalOpen(true);
  };

  const handleAppointmentClick = (app: Appointment) => {
      if (!currentUser) return;
      if (currentUser.role === 'coach' && app.coachId !== currentUser.id) { showNotification('權限不足', 'info'); return; }
      
      const formType = ((app.type as any) === 'client' ? 'private' : app.type) as any;
      setBlockForm({ id: app.id, type: formType, coachId: app.coachId, date: app.date, time: app.time, endTime: app.time, reason: app.reason || '', customer: app.customer || null });
      setMemberSearchTerm(''); // Existing customer is shown in card, no need to preset search term
      setDeleteConfirm(false); 
      setIsBatchMode(false);
      setIsBlockModalOpen(true);
  };

  // --- CONFIRMATION FLOW ---

  // 1. Student Checks In (Status Only, No Deduction)
  const handleUserCheckIn = async (app: Appointment) => {
      try {
          if (liffProfile && app.lineUserId !== liffProfile.userId) {
              showNotification('身份驗證失敗：此預約不屬於您', 'error');
              return;
          }
          
          await saveToFirestore('appointments', app.id, {
              ...app,
              status: 'checked_in'
          });

          addLog('學員簽到', `學員 ${app.customer?.name} 已簽到，等待教練確認`);
          showNotification('簽到成功！', 'success');
      } catch (e) {
          showNotification('簽到失敗，請稍後再試', 'error');
      }
  };

  // 2. Coach Confirms Completion (Status Only, No Deduction)
  const handleCoachConfirmCompletion = async (app: Appointment) => {
      if (!currentUser || (currentUser.role !== 'manager' && currentUser.id !== app.coachId)) {
          showNotification('權限不足', 'error');
          return;
      }

      if (app.status !== 'checked_in' && app.status !== 'confirmed') {
          showNotification('只能確認已簽到或已預約的課程', 'error');
          return;
      }

      try {
          // Update Appointment to Completed
          await saveToFirestore('appointments', app.id, { ...app, status: 'completed' });

          addLog('完課確認', `教練 ${currentUser.name} 確認 ${app.customer?.name} 完課 (已預扣)`);
          showNotification(`確認完課成功`, 'success');
      } catch (e) {
          console.error(e);
          showNotification('更新失敗', 'error');
      }
  };

  const handleToggleComplete = async (app: Appointment) => {
    // This is primarily for the WeeklyCalendar interaction
    if (app.status === 'checked_in') {
        // Use the proper confirmation flow
        await handleCoachConfirmCompletion(app);
    } else {
        // Legacy toggle or force toggle for Manager
        if (currentUser?.role !== 'manager') {
           showNotification('教練請點擊「確認完課」按鈕 (僅適用於已簽到課程)', 'info');
           return;
        }
        // Manager force toggle
        const newStatus = app.status === 'completed' ? 'confirmed' : 'completed';
        await saveToFirestore('appointments', app.id, { ...app, status: newStatus });
        addLog('課程狀態', `管理員強制變更 ${app.customer?.name} 狀態為 ${newStatus}`);
    }
  };

  const handleSaveCoach = async (coachData: Coach, email?: string, password?: string) => {
    let uid = coachData.id;
    try {
        if (!uid && email && password) {
            uid = await createAuthUser(email, password);
        }

        if (!uid) {
            showNotification("無法建立使用者 ID", "error");
            return;
        }

        const commonData = {
            id: uid,
            name: coachData.name,
            role: coachData.role || 'coach',
            email: email || coachData.email || '', 
            status: 'active' as const,
            title: coachData.title || '教練'
        };

        await saveToFirestore('users', uid, commonData);
        
        const fullCoachData: Coach = {
            ...coachData,
            id: uid,
            role: coachData.role || 'coach',
            status: 'active' as const,
            workStart: coachData.workStart || '09:00',
            workEnd: coachData.workEnd || '21:00',
            workDays: coachData.workDays || [0,1,2,3,4,5,6],
            color: coachData.color || INITIAL_COACHES[0].color
        };
        await saveToFirestore('coaches', uid, fullCoachData);

        addLog('員工管理', `更新/新增員工：${coachData.name}`);
        showNotification("員工資料已儲存", "success");
    } catch (error: any) {
        console.error("Save coach failed", error);
        showNotification(`儲存失敗: ${error.message}`, "error");
    }
  };

  const handleDeleteCoach = async (id: string, name: string) => {
    if (!window.confirm(`確定要刪除 ${name} 嗎？\n\n注意：\n1. 該員工將無法登入\n2. 該員工將從預約選單中移除`)) return;

    try {
        await disableUserInFirestore(id);
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

  const getAnalysis = () => {
    // Basic analysis logic for visual dashboard
    const totalActive = appointments.filter(a => a.status === 'confirmed' || a.status === 'checked_in').length;
    const totalCancelled = appointments.filter(a => a.status === 'cancelled').length;
    
    const slotCounts: Record<string, number> = {};
    appointments.filter(a => a.status === 'confirmed' || a.status === 'completed' || a.status === 'checked_in').forEach(a => {
        slotCounts[a.time] = (slotCounts[a.time] || 0) + 1;
    });
    const topTimeSlots = Object.entries(slotCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([time, count]) => ({ time, count }));

    const now = new Date();
    const currentMonthPrefix = formatDateKey(now.getFullYear(), now.getMonth(), 1).substring(0, 7);
    
    const coachStats = coaches.map(c => {
        const apps = appointments.filter(a => 
            a.coachId === c.id && 
            a.status !== 'cancelled' && 
            a.date.startsWith(currentMonthPrefix)
        );
        
        const personalCount = apps.filter(a => a.type === 'private' || (a.type as string) === 'client').length;
        const groupCount = apps.filter(a => a.type === 'group').length;

        return {
            id: c.id,
            name: c.name,
            personal: personalCount,
            group: groupCount,
            total: personalCount + groupCount
        };
    });

    return { totalActive, totalCancelled, topTimeSlots, coachStats };
  };

  const handleExportStatsCsv = () => {
      // Legacy simple export, can remain
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

  const renderContent = () => {
      if (view === 'my-bookings') {
          return (
              <MyBookings 
                  liffProfile={liffProfile}
                  appointments={appointments}
                  coaches={coaches}
                  onCancel={handleCustomerCancel}
                  onCheckIn={handleUserCheckIn}
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
                onRegisterUser={handleRegisterInventory}
                liffProfile={liffProfile}
                onLogin={handleLiffLogin}
              />
          );
      }

      if (!currentUser) {
          return (
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
            handleBatchDelete={async () => {
                if(!window.confirm(`確定取消選取的 ${selectedBatch.size} 筆預約嗎？`)) return;
                
                await Promise.all(Array.from(selectedBatch).map(async (id: string) => {
                    const app = appointments.find(a => a.id === id);
                    if (!app) return;
                    // Trigger cancel logic (refund) for each
                    await handleCustomerCancel(app, '管理員批次取消'); 
                }));
                
                addLog('批次取消', `取消 ${selectedBatch.size} 筆預約`);
                setSelectedBatch(new Set());
                showNotification(`成功取消 ${selectedBatch.size} 筆`, 'success');
            }}
            onOpenBatchBlock={handleOpenBatchBlock}
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
                  isLoading={dbStatus === 'connecting'} // Pass loading state
               />
            )}
            inventories={inventories}
            onUpdateInventory={handleUpdateInventory}
            onSaveInventory={handleSaveInventory}
            onDeleteInventory={handleDeleteInventory}
         />
      );
  };

  return (
    <div className="min-h-screen text-gray-800 dark:text-gray-100 transition-colors duration-300 font-sans selection:bg-indigo-500 selection:text-white">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-300/30 dark:bg-purple-900/20 rounded-full blur-3xl animate-float"></div>
          <div className="absolute top-1/2 -right-20 w-80 h-80 bg-blue-300/30 dark:bg-blue-900/20 rounded-full blur-3xl animate-float" style={{animationDelay: '1s'}}></div>
          <div className="absolute -bottom-20 left-1/3 w-96 h-96 bg-indigo-300/30 dark:bg-indigo-900/20 rounded-full blur-3xl animate-float" style={{animationDelay: '2s'}}></div>
      </div>

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
               <button onClick={() => setView('my-bookings')} className={`hidden md:flex items-center gap-2 px-3 py-2 rounded-lg transition-colors font-bold text-sm ${view === 'my-bookings' ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                  <UserIcon size={18}/> 我的預約
               </button>

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

        {renderContent()}

      </main>

      <div className="md:hidden fixed bottom-0 w-full glass-panel border-t border-white/20 dark:border-gray-800 flex justify-around p-3 z-50 backdrop-blur-xl">
         <button onClick={() => setView('booking')} className={`flex flex-col items-center gap-1 ${view === 'booking' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}>
            <CalendarIcon size={24}/>
            <span className="text-[10px] font-bold">預約</span>
         </button>
         <button onClick={() => setView('my-bookings')} className={`flex flex-col items-center gap-1 ${view === 'my-bookings' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}>
            <UserIcon size={24}/>
            <span className="text-[10px] font-bold">我的</span>
         </button>
         <button onClick={() => setView('admin')} className={`flex flex-col items-center gap-1 ${view === 'admin' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}>
            <Settings size={24}/>
            <span className="text-[10px] font-bold">後台</span>
         </button>
      </div>

      {isBlockModalOpen && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4" onClick={() => setIsBlockModalOpen(false)}>
            <div className="glass-panel w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-slideUp border border-white/40" onClick={e => e.stopPropagation()}>
                <div className="bg-white/50 dark:bg-gray-900/50 p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    <h3 className="font-bold text-xl dark:text-white flex items-center gap-2">
                        {blockForm.id ? <Settings size={20}/> : <CalendarIcon size={20}/>}
                        {blockForm.id ? '管理行程' : (isBatchMode ? '批次封鎖時段' : '新增行程')}
                    </h3>
                    <div className="flex gap-2">
                        {blockForm.id && (
                            <button onClick={() => setDeleteConfirm(true)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"><Trash2 size={20}/></button>
                        )}
                        {!blockForm.id && (
                           <button onClick={() => setIsBatchMode(!isBatchMode)} className={`p-2 rounded-lg transition-colors ${isBatchMode ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400'}`} title="切換批次模式">
                              <Layers size={20}/>
                           </button>
                        )}
                    </div>
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
                    <form onSubmit={(e) => handleSaveBlock(e, false)} className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                               <label className="text-xs font-bold text-gray-500 uppercase">類型</label>
                               <select className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white" value={blockForm.type} onChange={e => {
                                   const newType = e.target.value as any;
                                   setBlockForm({...blockForm, type: newType});
                                   // Reset customer if switching types to prevent bad state
                                   if(newType !== 'private') setMemberSearchTerm('');
                               }}>
                                   <option value="block">內部事務 (Block)</option>
                                   <option value="private">私人課程 (1v1)</option>
                                   <option value="group">團體課程 (Group)</option>
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

                        <div>
                             <label className="text-xs font-bold text-gray-500 uppercase">日期</label>
                             <input type="date" required className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white" value={blockForm.date} onChange={e => setBlockForm({...blockForm, date: e.target.value})} />
                        </div>

                        <div className="grid grid-cols-2 gap-4 items-end">
                             <div className="w-full">
                                 <label className="text-xs font-bold text-gray-500 uppercase">開始時間</label>
                                 <select className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white" value={blockForm.time} onChange={e => setBlockForm({...blockForm, time: e.target.value})}>
                                     {ALL_TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                                 </select>
                             </div>
                             {isBatchMode && (
                                 <div className="w-full">
                                     <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">結束時間 (不含)</label>
                                     <select className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white" value={blockForm.endTime} onChange={e => setBlockForm({...blockForm, endTime: e.target.value})}>
                                         {ALL_TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                                     </select>
                                 </div>
                             )}
                        </div>
                        {isBatchMode && (
                            <div className="text-xs text-indigo-500 flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-lg">
                                <Info size={12}/> 將批次建立 {blockForm.time} 至 {blockForm.endTime} 的所有時段
                            </div>
                        )}

                        {['block', 'group'].includes(blockForm.type) ? (
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">事項 / 課程名稱</label>
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
                            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl space-y-3 border border-indigo-100 dark:border-indigo-800 transition-all">
                                <div className="text-xs font-bold text-indigo-500 uppercase mb-2">客戶/學員資料</div>
                                {blockForm.type === 'private' ? (
                                    <>
                                        {blockForm.customer?.name ? (
                                            <div className="glass-card p-3 rounded-xl bg-white/80 dark:bg-gray-800/80 border border-indigo-200 dark:border-indigo-800 flex justify-between items-center animate-fadeIn">
                                                <div>
                                                    <div className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                                        {blockForm.customer.name}
                                                        {blockForm.customer.phone && <span className="text-xs text-gray-500 font-normal">({blockForm.customer.phone})</span>}
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
                                                    className="p-2 bg-gray-100 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors"
                                                    title="重新選擇"
                                                >
                                                    <X size={16}/>
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1"><Search size={10}/> 搜尋學員 (姓名/電話)</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full glass-input rounded-xl p-3 dark:text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                                    placeholder="輸入關鍵字..."
                                                    value={memberSearchTerm}
                                                    onChange={(e) => setMemberSearchTerm(e.target.value)}
                                                    autoFocus
                                                />
                                                {memberSearchTerm && !blockForm.customer && (
                                                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 max-h-48 overflow-y-auto custom-scrollbar animate-fadeIn">
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
                                                                    className="p-3 hover:bg-indigo-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0"
                                                                >
                                                                    <div className="font-bold text-gray-800 dark:text-white">{m.name}</div>
                                                                    <div className="flex justify-between text-xs text-gray-500 mt-0.5">
                                                                        <span>{m.phone || '無電話'}</span>
                                                                        <span className="font-bold text-indigo-500">餘: {m.credits.private}</span>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div className="p-4 text-center text-xs text-gray-400">找不到相符學員</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {!blockForm.customer?.name && <div className="text-[10px] text-red-400 mt-1">* 必須選擇現有學員</div>}
                                    </>
                                ) : null}
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
                            {blockForm.id && (
                                <button 
                                    type="button" 
                                    onClick={() => setDeleteConfirm(true)} 
                                    className="flex-1 py-3 bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 rounded-xl font-bold transition-colors"
                                >
                                    {blockForm.type === 'private' ? '取消預約' : '刪除'}
                                </button>
                            )}
                            <button 
                                type="submit" 
                                disabled={blockForm.type === 'private' && !blockForm.customer?.name}
                                className={`flex-[2] py-3 text-white rounded-xl font-bold shadow-lg transition-colors
                                    ${(blockForm.type === 'private' && !blockForm.customer?.name) 
                                        ? 'bg-gray-400 cursor-not-allowed' 
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

      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
             <div className="glass-panel w-full max-sm rounded-3xl p-6 animate-slideUp">
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
