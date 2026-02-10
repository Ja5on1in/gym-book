import React, { useRef, useState, useEffect, useMemo } from 'react';
import { LogOut, Trash2, FileSpreadsheet, Database, Clock, ChevronRight, ChevronLeft, FileWarning, BarChart3, List, Settings as SettingsIcon, History, User as UserIcon, Users, Plus, Edit2, X, Mail, Key, CalendarX, Layers, CreditCard, Search, BookOpen, Menu, LayoutDashboard, Dumbbell, Save, Activity, CheckCircle, AlertTriangle, HelpCircle, Calendar as CalendarIcon, Filter, ChevronDown, RefreshCw, Home } from 'lucide-react';
import { User, Appointment, Coach, Log, UserInventory, WorkoutPlan } from '../types';
import { ALL_TIME_SLOTS, COLOR_OPTIONS } from '../constants';
import { formatDateKey, getDaysInMonth, getFirstDayOfMonth } from '../utils';
import WorkoutPlans from './WorkoutPlans';
import NotificationBell from './NotificationBell';

interface AdminDashboardProps {
  currentUser: User;
  onLogout: () => void;
  adminTab: string;
  setAdminTab: (t: string) => void;
  renderWeeklyCalendar: () => React.ReactNode;
  appointments: Appointment[];
  selectedBatch: Set<string>;
  toggleBatchSelect: (id: string) => void;
  handleBatchDelete: () => void;
  analysis: any;
  handleExportStatsCsv: () => void;
  handleExportJson: () => void;
  triggerImport: () => void;
  handleFileImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  coaches: Coach[];
  updateCoachWorkDays: (coach: Coach) => void;
  logs: Log[];
  onSaveCoach: (coach: Coach, email?: string, password?: string) => void;
  onDeleteCoach: (id: string, name: string) => void;
  onOpenBatchBlock: () => void;
  inventories: UserInventory[];
  onSaveInventory: (inv: UserInventory) => void;
  onDeleteInventory: (inv: UserInventory) => void;
  workoutPlans: WorkoutPlan[];
  onSavePlan: (plan: WorkoutPlan) => void;
  onDeletePlan: (id: string) => void;
  onGoToBooking: () => void;
  onToggleComplete: (app: Appointment) => void;
  onCancelAppointment: (app: Appointment) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser, onLogout, adminTab, setAdminTab, renderWeeklyCalendar,
  appointments, selectedBatch, toggleBatchSelect, handleBatchDelete,
  analysis: globalAnalysis, handleExportStatsCsv: globalExportCsv, handleExportJson, triggerImport, handleFileImport,
  coaches, updateCoachWorkDays, logs, onSaveCoach, onDeleteCoach, onOpenBatchBlock,
  inventories, onSaveInventory, onDeleteInventory,
  workoutPlans, onSavePlan, onDeletePlan, onGoToBooking, onToggleComplete, onCancelAppointment
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Mobile Sidebar Toggle
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Staff Management State
  const [isCoachModalOpen, setIsCoachModalOpen] = useState(false);
  const [editingCoach, setEditingCoach] = useState<Partial<Coach>>({});
  const [newCoachEmail, setNewCoachEmail] = useState('');
  const [newCoachPassword, setNewCoachPassword] = useState('');
  const [isNewCoach, setIsNewCoach] = useState(false);
  
  // Off Date Input State
  const [tempOffDate, setTempOffDate] = useState('');

  // Schedule View State
  const [scheduleDate, setScheduleDate] = useState(new Date());

  // Inventory Management State
  const [searchQuery, setSearchQuery] = useState('');
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [editingInventory, setEditingInventory] = useState<UserInventory | null>(null);
  const [inventoryForm, setInventoryForm] = useState<{private: number, group: number, name: string, phone: string, lineUserId?: string}>({ private: 0, group: 0, name: '', phone: '' });
  const [isNewInventoryModalOpen, setIsNewInventoryModalOpen] = useState(false);
  const [newInventoryForm, setNewInventoryForm] = useState<Partial<UserInventory>>({ name: '', phone: '', email: '', credits: { private: 0, group: 0 } });

  // Advanced Export State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportMode, setExportMode] = useState<'range' | 'user'>('range');
  const [exportYear, setExportYear] = useState(new Date().getFullYear());
  const [exportMonth, setExportMonth] = useState(new Date().getMonth() + 1);
  const [exportStart, setExportStart] = useState('');
  const [exportEnd, setExportEnd] = useState('');
  const [exportUser, setExportUser] = useState<UserInventory | null>(null);
  const [exportUserSearch, setExportUserSearch] = useState('');

  // Analysis Filter State
  const [statsStart, setStatsStart] = useState('');
  const [statsEnd, setStatsEnd] = useState('');

  // Appointment List State
  const [collapsedDates, setCollapsedDates] = useState(new Set<string>());
  const [showCancelled, setShowCancelled] = useState(false);

  const NAV_ITEMS = [
      { category: '營運核心', items: [
          { id: 'calendar', icon: Clock, label: '行事曆' },
      ]},
      { category: '客戶管理', items: [
          { id: 'inventory', icon: CreditCard, label: '庫存管理' },
          { id: 'workout', icon: Dumbbell, label: '訓練課表' },
      ]},
      { category: '系統設定', items: [
          { id: 'staff_schedule', icon: Users, label: '員工與班表', role: 'manager' }, 
          { id: 'analysis', icon: BarChart3, label: '營運分析' },
          { id: 'logs', icon: History, label: '操作紀錄' },
          { id: 'help', icon: BookOpen, label: '使用手冊' },
      ]}
  ];

  const currentNavItem = useMemo(() => 
      NAV_ITEMS.flatMap(g => g.items).find(item => item.id === adminTab)
  , [adminTab]);

  // Initialize Dates
  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startStr = formatDateKey(start.getFullYear(), start.getMonth(), start.getDate());
    const endStr = formatDateKey(end.getFullYear(), end.getMonth(), end.getDate());
    setStatsStart(startStr);
    setStatsEnd(endStr);
    setExportStart(startStr);
    setExportEnd(endStr);
  }, []);

  const handleAdvancedExport = () => {
    let filtered = appointments.filter(a => a.status === 'completed');
    let fileName = 'completed_report';

    if (exportMode === 'range') {
        if (!exportStart || !exportEnd) {
            alert('請選擇有效的日期區間');
            return;
        }
        filtered = filtered.filter(a => a.date >= exportStart && a.date <= exportEnd);
        fileName += `_${exportStart}_to_${exportEnd}`;
    } else { // user mode
        if (!exportUser || !exportStart || !exportEnd) {
            alert('請選擇學員與有效的日期區間');
            return;
        }
        filtered = filtered.filter(a => 
            a.customer?.name === exportUser.name && 
            a.date >= exportStart && a.date <= exportEnd
        );
        fileName += `_${exportUser.name}_${exportStart}_to_${exportEnd}`;
    }

    const header = ["日期", "時間", "學員姓名", "教練姓名", "課程類型", "扣除點數"];
    const rows = filtered.map(a => [
        a.date,
        a.time,
        a.customer?.name || 'N/A',
        a.coachName || 'N/A',
        a.service?.name || a.reason || '課程',
        (a.type === 'private' || (a.type as string) === 'client') ? 1 : 0
    ].join(','));
    
    const csvContent = "\uFEFF" + [header.join(','), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${fileName}.csv`;
    link.click();
    
    setIsExportModalOpen(false);
  };

  const filteredExportUsers = useMemo(() => {
    if (!exportUserSearch) return [];
    return inventories.filter(i => 
        i.name.toLowerCase().includes(exportUserSearch.toLowerCase()) || 
        (i.phone && i.phone.includes(exportUserSearch))
    ).slice(0, 5);
  }, [exportUserSearch, inventories]);


  // --- Filtered Analysis Logic ---
  const filteredAnalysisData = useMemo(() => {
      if (!statsStart || !statsEnd) return globalAnalysis;
      
      const start = new Date(statsStart).getTime();
      const end = new Date(statsEnd).getTime() + 86400000;

      const rangeApps = appointments.filter(a => {
          const appTime = new Date(a.date).getTime();
          return appTime >= start && appTime < end;
      });

      const totalActive = rangeApps.filter(a => a.status === 'confirmed' || a.status === 'checked_in').length;
      const totalCancelled = rangeApps.filter(a => a.status === 'cancelled').length;
      const totalCompleted = rangeApps.filter(a => a.status === 'completed').length;

      const slotCounts: Record<string, number> = {};
      rangeApps.filter(a => ['confirmed','completed','checked_in'].includes(a.status)).forEach(a => {
          slotCounts[a.time] = (slotCounts[a.time] || 0) + 1;
      });
      const topTimeSlots = Object.entries(slotCounts).sort(([,a], [,b]) => b - a).slice(0, 3).map(([time, count]) => ({ time, count }));

      const coachStats = coaches.map(c => {
          const cApps = rangeApps.filter(a => a.coachId === c.id && a.status !== 'cancelled');
          const personal = cApps.filter(a => a.type === 'private' || (a.type as string) === 'client').length;
          const group = cApps.filter(a => a.type === 'group').length;
          return { id: c.id, name: c.name, personal, group, total: personal + group };
      });

      return { totalActive, totalCancelled, totalCompleted, topTimeSlots, coachStats, rangeApps };
  }, [appointments, statsStart, statsEnd, coaches, globalAnalysis]);

  const setAnalysisRange = (mode: 'prev' | 'current' | 'next') => {
      const currentStart = new Date(statsStart);
      let newStart = new Date(currentStart);
      
      if (mode === 'prev') newStart.setMonth(newStart.getMonth() - 1);
      if (mode === 'next') newStart.setMonth(newStart.getMonth() + 1);
      if (mode === 'current') newStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

      newStart.setDate(1);
      
      const newEnd = new Date(newStart.getFullYear(), newStart.getMonth() + 1, 0);
      
      setStatsStart(formatDateKey(newStart.getFullYear(), newStart.getMonth(), newStart.getDate()));
      setStatsEnd(formatDateKey(newEnd.getFullYear(), newEnd.getMonth(), newEnd.getDate()));
  };

  const handleCustomExportStats = () => {
      const stats = filteredAnalysisData;
      const rows = [
          ["統計區間", `${statsStart} ~ ${statsEnd}`],
          ["統計項目", "數值"], 
          ["總預約數", stats.totalActive + stats.totalCancelled + stats.totalCompleted], 
          ["有效預約(含完課)", stats.totalActive + stats.totalCompleted], 
          ["已取消", stats.totalCancelled], 
          [], 
          ["教練", "個人課", "團課/其他", "總計"], 
          ...stats.coachStats.map((c: any) => [c.name, c.personal, c.group, c.total])
      ];
      const csvContent = "\uFEFF" + rows.map(e => e.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `stats_${statsStart}_to_${statsEnd}.csv`;
      link.click();
  };

  const handleCustomExportCancel = () => {
      const cancelledApps = filteredAnalysisData.rangeApps.filter((a: Appointment) => 
        a.status === 'cancelled' && 
        (currentUser.role === 'manager' || a.coachId === currentUser.id)
      );
      const header = "預約日期,時間,教練,客戶名稱,取消原因";
      const rows = cancelledApps.map((a: Appointment) => 
        `${a.date},${a.time},${a.coachName},${a.customer?.name || ''},${a.cancelReason || ''}`
      );
      const csvContent = "\uFEFF" + [header, ...rows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `cancellations_${statsStart}_to_${statsEnd}.csv`;
      link.click();
  };

  const filteredApps = useMemo(() => {
    return appointments
        .filter(a => 
            (currentUser.role === 'manager' || a.coachId === currentUser.id) &&
            (showCancelled || a.status !== 'cancelled')
        )
        .sort((a,b) => {
            const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
            if (dateDiff !== 0) return dateDiff;
            return a.time.localeCompare(b.time);
        });
  }, [appointments, currentUser, showCancelled]);

  const appsByDate = useMemo(() => {
      return filteredApps.reduce((acc, app) => {
          (acc[app.date] = acc[app.date] || []).push(app);
          return acc;
      }, {} as Record<string, Appointment[]>);
  }, [filteredApps]);

  const filteredInventories = inventories.filter(i => 
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (i.phone && i.phone.includes(searchQuery)) || 
    (i.lineUserId && i.lineUserId.includes(searchQuery))
  );

  const handleModalDayConfig = (dayIndex: number, enabled: boolean, start?: string, end?: string) => {
     const currentDays = editingCoach.workDays || [];
     const newWorkDays = enabled 
        ? (currentDays.includes(dayIndex) ? currentDays : [...currentDays, dayIndex].sort())
        : currentDays.filter(d => d !== dayIndex);
     
     const currentDaily = editingCoach.dailyWorkHours || {};
     let newDaily = { ...currentDaily };
     
     if (enabled && start && end) {
         newDaily[dayIndex.toString()] = { start, end };
     } else if (!enabled) {
         delete newDaily[dayIndex.toString()];
     }

     setEditingCoach({ ...editingCoach, workDays: newWorkDays, dailyWorkHours: newDaily });
  };

  const handleOpenCoachModal = (coach?: Coach) => {
    if (coach) {
        setEditingCoach({ ...coach, offDates: coach.offDates || [], dailyWorkHours: coach.dailyWorkHours || {} });
        setIsNewCoach(false);
    } else {
        setEditingCoach({
            name: '',
            role: 'coach',
            color: COLOR_OPTIONS[0].value,
            workStart: '09:00',
            workEnd: '21:00',
            workDays: [0, 1, 2, 3, 4, 5, 6],
            offDates: [],
            dailyWorkHours: {}
        });
        setNewCoachEmail('');
        setNewCoachPassword('');
        setIsNewCoach(true);
    }
    setTempOffDate('');
    setIsCoachModalOpen(true);
  };

  const handleAddOffDate = () => {
      if (!tempOffDate) return;
      const current = editingCoach.offDates || [];
      if (!current.includes(tempOffDate)) {
          setEditingCoach({ ...editingCoach, offDates: [...current, tempOffDate].sort() });
      }
      setTempOffDate('');
  };

  const handleRemoveOffDate = (dateToRemove: string) => {
      const current = editingCoach.offDates || [];
      setEditingCoach({ ...editingCoach, offDates: current.filter(d => d !== dateToRemove) });
  };

  const handleSubmitCoach = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isNewCoach && !editingCoach.id) return;
    onSaveCoach(editingCoach as Coach, isNewCoach ? newCoachEmail : undefined, isNewCoach ? newCoachPassword : undefined);
    setIsCoachModalOpen(false);
  };

  const handleOpenInventoryModal = (inv: UserInventory) => {
      setEditingInventory(inv);
      setInventoryForm({
          private: inv.credits.private,
          group: inv.credits.group,
          name: inv.name,
          phone: inv.phone || '',
          lineUserId: inv.lineUserId
      });
      setIsInventoryModalOpen(true);
  };

  const handleSaveInventoryChanges = () => {
      if (!editingInventory) return;
      onSaveInventory({
          ...editingInventory,
          credits: { private: Number(inventoryForm.private), group: Number(inventoryForm.group) },
          name: inventoryForm.name,
          phone: inventoryForm.phone,
          lastUpdated: new Date().toISOString()
      });
      setIsInventoryModalOpen(false);
  };
  
  const handleAddNewInventory = () => {
      if (!newInventoryForm.name || !newInventoryForm.phone) {
          alert('姓名與電話為必填');
          return;
      }
      
      const existingByPhone = inventories.find(inv => inv.phone === newInventoryForm.phone);
      if (existingByPhone) {
          if (window.confirm(`電話號碼 ${newInventoryForm.phone} 已存在於學員「${existingByPhone.name}」的資料中。要將此次輸入的資料合併更新至該學員嗎？`)) {
              onSaveInventory({
                  ...existingByPhone,
                  name: newInventoryForm.name, // Update name
                  email: newInventoryForm.email || existingByPhone.email,
                  credits: {
                      private: existingByPhone.credits.private + (newInventoryForm.credits?.private || 0),
                      group: existingByPhone.credits.group + (newInventoryForm.credits?.group || 0)
                  }
              });
          } else {
              return; // User cancelled
          }
      } else {
          onSaveInventory(newInventoryForm as UserInventory);
      }
      
      setIsNewInventoryModalOpen(false);
      setNewInventoryForm({ name: '', phone: '', email: '', credits: { private: 0, group: 0 } });
  };

  const toggleDateCollapse = (date: string) => {
    setCollapsedDates(prev => {
        const newSet = new Set(prev);
        if (newSet.has(date)) {
            newSet.delete(date);
        } else {
            newSet.add(date);
        }
        return newSet;
    });
  };

  const renderMonthlySchedule = () => {
      const year = scheduleDate.getFullYear();
      const month = scheduleDate.getMonth();
      const daysInMonth = getDaysInMonth(year, month);
      const firstDay = getFirstDayOfMonth(year, month);
      const days = [];

      for (let i = 0; i < firstDay; i++) {
        days.push(<div key={`empty-${i}`} className="h-24 bg-slate-50/30 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/50"></div>);
      }

      for (let day = 1; day <= daysInMonth; day++) {
          const dateKey = formatDateKey(year, month, day);
          const dayOfWeek = new Date(year, month, day).getDay();
          
          const offCoaches = coaches.filter(c => {
              if (c.offDates?.includes(dateKey)) return true;
              if (c.workDays && !c.workDays.includes(dayOfWeek)) return true;
              return false;
          });

          const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

          days.push(
              <div key={dateKey} className={`h-24 p-1 border border-slate-100 dark:border-slate-700/50 bg-white dark:bg-slate-800 overflow-y-auto custom-scrollbar relative ${isToday ? 'ring-2 ring-indigo-500 ring-inset' : ''}`}>
                  <div className={`text-xs font-bold mb-1 ${isToday ? 'text-indigo-600' : 'text-slate-400'}`}>
                      {day} <span className="text-[10px] font-normal">{['日','一','二','三','四','五','六'][dayOfWeek]}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                      {offCoaches.map(c => (
                          <div key={c.id} title={`${c.name} 休假`} className={`text-[10px] px-1.5 py-0.5 rounded-md border truncate max-w-full ${c.color}`}>
                              {c.name}
                          </div>
                      ))}
                  </div>
              </div>
          );
      }

      return (
          <div className="glass-panel p-4 rounded-3xl border border-white/60">
              <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold dark:text-white flex items-center gap-2">
                      <CalendarIcon size={18} className="text-indigo-500"/> 
                      {year}年 {month + 1}月 排班總覽
                  </h4>
                  <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                      <button onClick={() => setScheduleDate(new Date(year, month - 1, 1))} className="p-1 hover:bg-white dark:hover:bg-slate-600 rounded-md transition-all"><ChevronLeft size={16}/></button>
                      <button onClick={() => setScheduleDate(new Date())} className="px-3 text-xs font-bold hover:bg-white dark:hover:bg-slate-600 rounded-md transition-all">本月</button>
                      <button onClick={() => setScheduleDate(new Date(year, month + 1, 1))} className="p-1 hover:bg-white dark:hover:bg-slate-600 rounded-md transition-all"><ChevronRight size={16}/></button>
                  </div>
              </div>
              <div className="grid grid-cols-7 text-center mb-2">
                  {['日','一','二','三','四','五','六'].map(d => <div key={d} className="text-xs font-bold text-slate-400">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 bg-slate-200 dark:bg-slate-700 gap-px border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  {days}
              </div>
          </div>
      );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col md:flex-row">
       {/* Mobile Header */}
       <div className="md:hidden bg-white dark:bg-slate-800 p-4 flex justify-between items-center shadow-sm sticky top-0 z-40">
           <div className="font-bold text-lg dark:text-white flex items-center gap-2">
               <LayoutDashboard size={20} className="text-indigo-600"/> 管理後台
           </div>
           <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700">
               {isSidebarOpen ? <X size={20}/> : <Menu size={20}/>}
           </button>
       </div>

       {/* Sidebar */}
       <aside className={`
           fixed md:sticky top-0 left-0 h-screen bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 z-50 transform transition-width duration-300 flex flex-col
           ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
           ${isSidebarCollapsed ? 'w-20' : 'w-64'}
       `}>
           <div className={`p-4 flex items-center justify-center border-b border-slate-100 dark:border-slate-700 shrink-0 transition-all ${isSidebarCollapsed ? 'h-[73px]' : 'h-[89px]'}`}>
               {isSidebarCollapsed ? (
                   <LayoutDashboard size={28} className="text-indigo-600"/>
               ) : (
                   <h1 className="text-xl font-bold dark:text-white flex items-center gap-2 text-indigo-600 whitespace-nowrap">
                       <LayoutDashboard size={24} className="fill-indigo-600 text-indigo-600"/> 活力學苑管理
                   </h1>
               )}
           </div>

           <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                <div className="px-4 py-2">
                    <div className={`bg-slate-100 dark:bg-slate-700/50 rounded-xl my-6 flex items-center gap-3 transition-all ${isSidebarCollapsed ? 'p-2 justify-center' : 'p-3'}`}>
                        <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-lg shrink-0">
                            {currentUser.name ? currentUser.name[0] : (currentUser.email ? currentUser.email[0].toUpperCase() : 'U')}
                        </div>
                        {!isSidebarCollapsed && (
                            <div className="overflow-hidden transition-opacity duration-200">
                                <div className="font-bold text-sm text-slate-800 dark:text-white truncate">{currentUser.name || currentUser.email || '未命名'}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold">{currentUser.role}</div>
                            </div>
                        )}
                    </div>

                    <nav className="space-y-6">
                        <div>
                            <div className={`text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 transition-all ${isSidebarCollapsed ? 'text-center' : 'px-3'}`}>導覽</div>
                            <div className="space-y-1">
                                <button 
                                    onClick={onGoToBooking}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 ${isSidebarCollapsed ? 'justify-center' : ''}`}
                                >
                                    <Home size={18} className="text-slate-400"/>
                                    {!isSidebarCollapsed && <span className="transition-opacity duration-200">返回前台</span>}
                                </button>
                            </div>
                        </div>

                        {NAV_ITEMS.map((group, idx) => (
                            <div key={idx}>
                                {!isSidebarCollapsed && <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">{group.category}</div>}
                                <div className="space-y-1">
                                    {group.items.map(item => {
                                        if (item.role && currentUser.role !== item.role) return null;
                                        const isActive = adminTab === item.id;
                                        return (
                                            <button 
                                                key={item.id}
                                                onClick={() => { setAdminTab(item.id); setIsSidebarOpen(false); }}
                                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                                                    ${isActive 
                                                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                                    }
                                                    ${isSidebarCollapsed ? 'justify-center' : ''}
                                                `}
                                            >
                                                <item.icon size={18} className={isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}/>
                                                {!isSidebarCollapsed && <span className="transition-opacity duration-200">{item.label}</span>}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </nav>
                </div>
            </div>
           
           <div className="shrink-0">
                <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700">
                    <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                        {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                        {!isSidebarCollapsed && <span className="transition-opacity duration-200">收合</span>}
                    </button>
                </div>
               <div className={`p-4 border-t border-slate-100 dark:border-slate-700 ${isSidebarCollapsed ? 'text-center' : ''}`}>
                   <button onClick={onLogout} className={`w-full flex items-center gap-2 p-3 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium text-sm ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                       <LogOut size={16}/> {!isSidebarCollapsed && <span className="transition-opacity duration-200">登出系統</span>}
                   </button>
               </div>
           </div>
       </aside>
       
       {/* Main Content Area */}
       <main className="flex-1 p-4 md:p-8 overflow-y-auto h-screen bg-slate-50/50 dark:bg-slate-900 relative">
           {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>}
           
           <div className="max-w-7xl mx-auto">
                {/* NEW Persistent Header */}
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                        {currentNavItem && <currentNavItem.icon className="text-indigo-500"/>}
                        {currentNavItem?.label || '儀表板'}
                    </h2>
                    {currentUser.role === 'manager' && <NotificationBell currentUser={currentUser} />}
                </div>

               <div className="animate-fadeIn">
               {adminTab === 'calendar' && (
                 <>
                    <div className="flex justify-end items-center mb-6 -mt-16">
                        <button onClick={onOpenBatchBlock} className="flex items-center gap-2 bg-slate-800 text-white dark:bg-white dark:text-slate-900 px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:opacity-90 transition-opacity">
                             <Layers size={16}/> 批次管理
                        </button>
                    </div>
                    {renderWeeklyCalendar()}
                 </>
               )}

               {adminTab === 'workout' && (
                  <WorkoutPlans 
                    currentUser={currentUser}
                    inventories={inventories}
                    workoutPlans={workoutPlans}
                    onSavePlan={onSavePlan}
                    onDeletePlan={onDeletePlan}
                    onSaveInventory={onSaveInventory}
                  />
               )}

               {adminTab === 'inventory' && (
                  <div className="space-y-6">
                      <div className="flex flex-col md:flex-row justify-end items-center gap-4">
                          <div className="flex items-center gap-2 w-full md:w-auto">
                              <div className="relative flex-1">
                                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                  <input 
                                      type="text" 
                                      placeholder="搜尋學員姓名/電話..." 
                                      className="pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 w-full focus:ring-2 focus:ring-indigo-500 outline-none glass-input"
                                      value={searchQuery}
                                      onChange={e => setSearchQuery(e.target.value)}
                                  />
                              </div>
                              <button onClick={() => setIsNewInventoryModalOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all">
                                  <Plus size={16}/> 新增學員
                              </button>
                          </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {filteredInventories.map(inv => {
                              const canEdit = ['manager', 'receptionist', 'coach'].includes(currentUser.role);
                              return (
                                  <div key={inv.id} onClick={() => canEdit && handleOpenInventoryModal(inv)} className={`glass-card p-6 rounded-2xl border border-slate-100 dark:border-slate-700 transition-all hover:shadow-lg hover:scale-[1.02] group relative ${canEdit ? 'cursor-pointer' : ''}`}>
                                      {inv.lineUserId && <div className="absolute top-4 right-4 w-2.5 h-2.5 bg-green-500 rounded-full ring-2 ring-white dark:ring-slate-800" title="已綁定LINE"></div>}
                                      <div className="flex justify-between items-start mb-4">
                                          <div>
                                              <div className="font-bold text-lg dark:text-white group-hover:text-indigo-600 transition-colors flex items-center gap-2">
                                                  {inv.name}
                                                  {canEdit && <Edit2 size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400"/>}
                                              </div>
                                              <div className="text-xs text-slate-500">{inv.phone || '無電話'}</div>
                                          </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-4">
                                          <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20">
                                              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">私人課</div>
                                              <div className="font-bold text-2xl text-indigo-600 dark:text-indigo-400">{inv.credits.private}</div>
                                          </div>
                                          <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20">
                                              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">團體課</div>
                                              <div className="font-bold text-2xl text-orange-600 dark:text-orange-400">{inv.credits.group}</div>
                                          </div>
                                      </div>
                                  </div>
                              )
                          })}
                      </div>
                  </div>
               )}

               {adminTab === 'analysis' && (
                  <div className="space-y-6 animate-slideUp">
                    <div className="glass-panel p-4 rounded-3xl flex flex-col lg:flex-row justify-between items-center gap-4 border border-white/60">
                        <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto">
                            <span className="text-sm font-bold text-slate-500 whitespace-nowrap"><Filter size={16} className="inline mr-1"/> 統計區間</span>
                            <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                                <button onClick={() => setAnalysisRange('prev')} className="px-3 py-1 text-xs font-bold hover:bg-white dark:hover:bg-slate-600 rounded-md transition-all">上月</button>
                                <button onClick={() => setAnalysisRange('current')} className="px-3 py-1 text-xs font-bold hover:bg-white dark:hover:bg-slate-600 rounded-md transition-all">本月</button>
                                <button onClick={() => setAnalysisRange('next')} className="px-3 py-1 text-xs font-bold hover:bg-white dark:hover:bg-slate-600 rounded-md transition-all">下月</button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 w-full lg:w-auto">
                            <input type="date" value={statsStart} onChange={e => setStatsStart(e.target.value)} className="glass-input px-3 py-2 rounded-xl text-sm w-full lg:w-auto"/>
                            <span className="text-slate-400">~</span>
                            <input type="date" value={statsEnd} onChange={e => setStatsEnd(e.target.value)} className="glass-input px-3 py-2 rounded-xl text-sm w-full lg:w-auto"/>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                       <button onClick={handleCustomExportCancel} className="glass-card flex items-center gap-2 text-red-500 px-4 py-2 rounded-xl text-sm hover:bg-red-50 transition-colors shadow-sm"><FileWarning size={16}/> 匯出取消明細</button>
                       <button onClick={() => setIsExportModalOpen(true)} className="bg-emerald-500 text-white flex items-center gap-2 px-4 py-2 rounded-xl text-sm shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 transition-all"><FileSpreadsheet size={16}/> 匯出完課報表</button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       <div className="glass-panel p-6 rounded-3xl relative overflow-hidden border border-white/60 flex flex-col">
                          <div className="absolute top-0 right-0 p-4 opacity-10"><Clock size={100} className="text-orange-500"/></div>
                          <h4 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Clock size={18} className="text-orange-500"/> 熱門時段 Top 3</h4>
                          <div className="space-y-3 relative z-10 flex-1">
                            {filteredAnalysisData.topTimeSlots.length > 0 ? filteredAnalysisData.topTimeSlots.map((s: any, i: number) => (
                                <div key={s.time} className="flex justify-between items-center p-3 bg-white/50 dark:bg-slate-800/50 rounded-xl border border-white/40 dark:border-slate-700">
                                    <span className={`font-bold ${i===0?'text-yellow-500':i===1?'text-slate-400':'text-orange-600'}`}>#{i+1} {s.time}</span>
                                    <span className="text-sm font-medium dark:text-slate-200">{s.count} 堂</span>
                                </div>
                            )) : <div className="text-center text-slate-400 py-4">無數據</div>}
                          </div>
                       </div>
                       
                       <div className="glass-panel p-6 rounded-3xl border border-white/60 flex flex-col relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-4 opacity-10"><BarChart3 size={100} className="text-blue-500"/></div>
                          <h4 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Activity size={18} className="text-blue-500"/> 區間預約狀態</h4>
                          <div className="flex-1 flex flex-col justify-center gap-4 relative z-10">
                              <div className="flex justify-between items-center p-2 border-b border-slate-100 dark:border-slate-700">
                                  <span className="text-xs font-bold text-slate-400 uppercase">有效預約</span>
                                  <span className="text-2xl font-bold text-emerald-500">{filteredAnalysisData.totalActive}</span>
                              </div>
                              <div className="flex justify-between items-center p-2 border-b border-slate-100 dark:border-slate-700">
                                  <span className="text-xs font-bold text-slate-400 uppercase">已完成</span>
                                  <span className="text-2xl font-bold text-blue-500">{filteredAnalysisData.totalCompleted}</span>
                              </div>
                              <div className="flex justify-between items-center p-2">
                                  <span className="text-xs font-bold text-slate-400 uppercase">已取消</span>
                                  <span className="text-2xl font-bold text-red-500">{filteredAnalysisData.totalCancelled}</span>
                              </div>
                          </div>
                       </div>

                       <div className="glass-panel p-6 rounded-3xl border border-white/60 flex flex-col h-[300px]">
                          <h4 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><UserIcon size={18} className="text-purple-500"/> 區間課程統計</h4>
                          <div className="overflow-y-auto custom-scrollbar pr-2 flex-1">
                              <div className="grid grid-cols-4 gap-2 text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wider sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm py-1 z-10">
                                  <span>教練</span>
                                  <span className="text-right">個人</span>
                                  <span className="text-right">團課</span>
                                  <span className="text-right">總計</span>
                              </div>
                              {(currentUser.role === 'manager' 
                                  ? filteredAnalysisData.coachStats 
                                  : filteredAnalysisData.coachStats.filter((s: any) => s.id === currentUser.id)
                               ).map((c: any) => (
                                <div key={c.id} className="grid grid-cols-4 gap-2 text-sm py-2 border-b border-slate-100 dark:border-slate-700 last:border-0 items-center">
                                    <span className="truncate font-medium dark:text-slate-200">{c.name}</span>
                                    <span className="text-right text-slate-500">{c.personal}</span>
                                    <span className="text-right text-slate-500">{c.group}</span>
                                    <span className="text-right font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 rounded px-1">{c.total}</span>
                                </div>
                              ))}
                          </div>
                       </div>
                    </div>
                  </div>
               )}

               {adminTab === 'staff_schedule' && currentUser.role === 'manager' && (
                  <div className="space-y-6">
                      <div className="glass-panel rounded-3xl shadow-lg p-6 border border-white/60">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-xl dark:text-white flex items-center gap-2"><Users className="text-indigo-500"/> 員工與班表管理</h3>
                            <button onClick={() => handleOpenCoachModal()} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all">
                                <Plus size={16}/> 新增員工
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {coaches.map(coach => (
                                <div key={coach.id} className="glass-card p-4 rounded-2xl relative group hover:shadow-lg transition-all border border-slate-100 dark:border-slate-700">
                                    <div className={`absolute top-0 left-0 w-2 h-full rounded-l-2xl ${coach.color.split(' ')[0]}`}></div>
                                    <div className="pl-4 flex justify-between items-start">
                                        <div>
                                            <h4 className="font-bold text-lg dark:text-white mb-1">{coach.name}</h4>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mb-1">
                                                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 uppercase">{coach.role}</span>
                                                <span>{coach.workStart} - {coach.workEnd}</span>
                                            </div>
                                            {coach.offDates && coach.offDates.length > 0 && (
                                               <div className="flex items-center gap-1 text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded w-fit">
                                                  <CalendarX size={10}/>
                                                  {coach.offDates.length} 個特定休假日
                                               </div>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleOpenCoachModal(coach)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"><Edit2 size={16}/></button>
                                            <button onClick={() => onDeleteCoach(coach.id, coach.name)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                      </div>
                      {renderMonthlySchedule()}
                  </div>
               )}
               
               {adminTab === 'logs' && (
                  <div className="glass-panel rounded-3xl shadow-lg p-6 h-[600px] overflow-y-auto custom-scrollbar border border-white/60">
                     <div className="space-y-4">
                     {logs.filter(log => currentUser.role === 'manager' || log.user === currentUser.name).map(log => (
                        <div key={log.id} className="relative pl-6 pb-2 border-l-2 border-slate-200 dark:border-slate-700 last:border-0">
                           <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white dark:bg-slate-800 border-2 border-indigo-400"></div>
                           <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 mb-1">
                              <span>{new Date(log.time).toLocaleString()}</span>
                              <span>{log.user}</span>
                           </div>
                           <div className="glass-card p-3 rounded-xl border border-white/50">
                               <div className="font-bold text-slate-800 dark:text-slate-200 mb-1">{log.action}</div>
                               <div className="text-sm text-slate-600 dark:text-slate-400">{log.details}</div>
                           </div>
                        </div>
                     ))}
                     </div>
                  </div>
               )}

               {adminTab === 'help' && (
                   <div className="glass-panel rounded-3xl shadow-lg p-8 border border-white/60">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                            <div className="p-6 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                                <h4 className="font-bold text-lg dark:text-white mb-3 flex items-center gap-2"><CheckCircle size={20} className="text-indigo-600"/> 點數核實流程</h4>
                                <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                    <li><strong className="text-indigo-600">學員簽到</strong>：學員在「我的預約」中點擊「立即簽到」，狀態變為「等待確認」。</li>
                                    <li><strong className="text-indigo-600">教練確認</strong>：課程結束後，教練在行事曆中點擊該橘色閃爍課程。</li>
                                    <li><strong className="text-indigo-600">系統扣點</strong>：點擊「確認核實完課」按鈕，系統將自動扣除學員 1 點庫存，課程狀態變為「已完課」。</li>
                                </ol>
                            </div>
                            <div className="p-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800">
                               <h4 className="font-bold text-lg dark:text-white mb-3 flex items-center gap-2"><CalendarIcon size={20} className="text-blue-500"/> 月曆與班表操作</h4>
                                <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                  <li>在「員工與班表」頁面，點擊員工卡片上的「編輯」按鈕。</li>
                                  <li>在彈出視窗中，您可以設定每週的固定上班日與個別的上下班時間。</li>
                                  <li>若有特定日期需要休假，請在「特定日期休假」區塊新增日期。</li>
                                  <li>所有班表與休假設定會即時同步至預約行事曆與前台預約畫面。</li>
                                </ol>
                            </div>
                            <div className="p-6 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800 md:col-span-2">
                               <h4 className="font-bold text-lg dark:text-white mb-3 flex items-center gap-2"><BarChart3 size={20} className="text-emerald-500"/> 區間報表匯出</h4>
                                <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                  <li>在「營運分析」頁面，您可以使用頂部的日期選擇器或快捷按鈕（上月/本月）來設定您想分析的資料區間。</li>
                                  <li>所有圖表與數據將根據您選擇的區間即時更新。</li>
                                  <li>點擊「匯出完課報表」可開啟進階匯出視窗，選擇依區間或特定學員匯出完課紀錄。</li>
                                  <li>點擊「匯出取消明細」可下載該區間內所有取消的預約紀錄。</li>
                                </ol>
                            </div>
                       </div>
                   </div>
               )}
               </div>
           </div>
       </main>
    </div>
  );
};

export default AdminDashboard;