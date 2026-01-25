import React, { useRef, useState, useEffect, useMemo } from 'react';
import { LogOut, Trash2, FileSpreadsheet, Database, Clock, ChevronRight, ChevronLeft, FileWarning, BarChart3, List, Settings as SettingsIcon, History, User as UserIcon, Users, Plus, Edit2, X, Mail, Key, CalendarX, Layers, CreditCard, Search, BookOpen, Menu, LayoutDashboard, Dumbbell, Save, Activity, CheckCircle, AlertTriangle, HelpCircle, Calendar as CalendarIcon, Filter, ChevronDown } from 'lucide-react';
import { User, Appointment, Coach, Log, UserInventory, WorkoutPlan } from '../types';
import { ALL_TIME_SLOTS, COLOR_OPTIONS } from '../constants';
import { formatDateKey, getDaysInMonth, getFirstDayOfMonth } from '../utils';
import WorkoutPlans from './WorkoutPlans';

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
  onDeleteInventory: (id: string) => void;
  workoutPlans: WorkoutPlan[];
  onSavePlan: (plan: WorkoutPlan) => void;
  onDeletePlan: (id: string) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser, onLogout, adminTab, setAdminTab, renderWeeklyCalendar,
  appointments, selectedBatch, toggleBatchSelect, handleBatchDelete,
  analysis: globalAnalysis, handleExportStatsCsv: globalExportCsv, handleExportJson, triggerImport, handleFileImport,
  coaches, updateCoachWorkDays, logs, onSaveCoach, onDeleteCoach, onOpenBatchBlock,
  inventories, onSaveInventory, onDeleteInventory,
  workoutPlans, onSavePlan, onDeletePlan
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Mobile Sidebar Toggle
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
  const [inventoryForm, setInventoryForm] = useState<{private: number, group: number, name: string, phone: string}>({ private: 0, group: 0, name: '', phone: '' });

  // Analysis Filter State
  const [statsStart, setStatsStart] = useState('');
  const [statsEnd, setStatsEnd] = useState('');

  // Appointment List State
  const [collapsedDates, setCollapsedDates] = useState(new Set<string>());

  // Initialize Dates
  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setStatsStart(formatDateKey(start.getFullYear(), start.getMonth(), start.getDate()));
    setStatsEnd(formatDateKey(end.getFullYear(), end.getMonth(), end.getDate()));
  }, []);

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
        .filter(a => currentUser.role === 'manager' || a.coachId === currentUser.id)
        .sort((a,b) => {
            // Sort by Date (Descending) then Time (Ascending)
            const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
            if (dateDiff !== 0) return dateDiff;
            return a.time.localeCompare(b.time);
        });
  }, [appointments, currentUser]);

  // Group appointments by Date for List View
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
          phone: inv.phone || ''
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

  const NAV_ITEMS = [
      { category: '營運核心', items: [
          { id: 'calendar', icon: Clock, label: '行事曆' },
          { id: 'appointments', icon: List, label: '預約列表' },
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
           fixed md:sticky top-0 left-0 h-screen w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 z-50 transform transition-transform duration-300 overflow-y-auto
           ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
       `}>
           <div className="p-6">
               <h1 className="text-2xl font-bold dark:text-white mb-1 flex items-center gap-2 text-indigo-600">
                   <LayoutDashboard className="fill-indigo-600 text-indigo-600"/> 活力學苑預約系統
               </h1>
               <div className="text-xs text-slate-500 font-medium px-1">管理後台</div>
           </div>

           <div className="px-4 py-2">
               <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-3 mb-6 flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-lg">
                       {currentUser.name[0]}
                   </div>
                   <div className="overflow-hidden">
                       <div className="font-bold text-sm text-slate-800 dark:text-white truncate">{currentUser.name}</div>
                       <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold">{currentUser.role}</div>
                   </div>
               </div>

               <nav className="space-y-6">
                   {NAV_ITEMS.map((group, idx) => (
                       <div key={idx}>
                           <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">{group.category}</div>
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
                                           `}
                                       >
                                           <item.icon size={18} className={isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}/>
                                           {item.label}
                                       </button>
                                   )
                               })}
                           </div>
                       </div>
                   ))}
               </nav>
           </div>
           
           <div className="p-4 mt-auto border-t border-slate-100 dark:border-slate-700">
               <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 p-3 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium text-sm">
                   <LogOut size={16}/> 登出系統
               </button>
           </div>
       </aside>
       
       {/* Main Content Area */}
       <main className="flex-1 p-4 md:p-8 overflow-y-auto h-screen bg-slate-50/50 dark:bg-slate-900 relative">
           {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>}

           <div className="max-w-7xl mx-auto animate-fadeIn pb-24">
               {adminTab === 'calendar' && (
                 <>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3"><Clock className="text-indigo-500"/> 行事曆總覽</h2>
                        <button onClick={onOpenBatchBlock} className="flex items-center gap-2 bg-slate-800 text-white dark:bg-white dark:text-slate-900 px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:opacity-90 transition-opacity">
                             <Layers size={16}/> 批次管理
                        </button>
                    </div>
                    {renderWeeklyCalendar()}
                 </>
               )}

               {adminTab === 'appointments' && (
                 <div className="glass-panel rounded-3xl shadow-lg p-6 border border-white/60">
                   <div className="flex justify-between mb-6">
                     <h3 className="font-bold text-xl dark:text-white flex items-center gap-2"><List className="text-indigo-500"/> 預約列表</h3>
                     {selectedBatch.size > 0 && (
                       <button onClick={handleBatchDelete} className="bg-red-500 text-white px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-lg hover:bg-red-600 transition-colors animate-fadeIn">
                         <Trash2 size={16}/> 刪除選取 ({selectedBatch.size})
                       </button>
                     )}
                   </div>
                   
                   <div className="space-y-6">
                     {Object.keys(appsByDate).sort((a,b) => new Date(b).getTime() - new Date(a).getTime()).map(date => {
                        const isCollapsed = collapsedDates.has(date);
                        return (
                        <div key={date} className="animate-slideUp">
                            <div 
                                onClick={() => toggleDateCollapse(date)}
                                className="sticky top-0 z-10 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm py-2 px-1 mb-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 cursor-pointer"
                            >
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                  <h4 className="font-bold text-slate-600 dark:text-slate-300">{date} <span className="text-xs font-normal text-slate-400">({new Date(date).toLocaleDateString('en-US', {weekday: 'short'})})</span></h4>
                                </div>
                                <ChevronDown size={20} className={`text-slate-400 transition-transform ${isCollapsed ? '-rotate-180' : ''}`} />
                            </div>
                            {!isCollapsed && (
                            <div className="space-y-3">
                                {appsByDate[date].map(app => (
                                    <div 
                                        key={app.id} 
                                        onClick={() => toggleBatchSelect(app.id)}
                                        className={`
                                            glass-card flex items-center gap-4 p-4 rounded-2xl group transition-all cursor-pointer select-none border
                                            ${selectedBatch.has(app.id) 
                                                ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/30 shadow-md transform scale-[1.01]' 
                                                : 'border-slate-100 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                                            }
                                        `}
                                    >
                                        <div className={`
                                                w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0
                                                ${selectedBatch.has(app.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white dark:bg-slate-800 dark:border-slate-600'}
                                        `}>
                                            {selectedBatch.has(app.id) && <X size={14} className="text-white rotate-45" strokeWidth={3} />}
                                        </div>
                                        
                                        <div className="flex-1 pointer-events-none">
                                            <div className="flex justify-between items-center mb-1">
                                                <div className="flex items-center gap-3">
                                                    <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-sm font-bold text-slate-700 dark:text-slate-200">{app.time}</span>
                                                    <span className="font-bold text-lg dark:text-white truncate">{(app.type as string) ==='client' ? app?.customer?.name : app.reason}</span>
                                                </div>
                                                <span className={`text-xs px-3 py-1 rounded-full font-bold whitespace-nowrap 
                                                    ${app.status==='cancelled'
                                                        ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                                        : app.status==='completed'
                                                            ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                                            : app.status==='checked_in'
                                                                ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                                                                : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                                                    }`}>
                                                    {app.status === 'cancelled' ? '已取消' : app.status === 'completed' ? '已完課' : app.status === 'checked_in' ? '已簽到' : '已確認'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
                                                <span>教練：{coaches.find(c => c.id === app.coachId)?.name || app.coachName || '(已移除)'}</span>
                                                {app.type === 'private' && app.customer?.phone && <span className="text-xs">{app.customer.phone}</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            )}
                        </div>
                     )})}
                   </div>
                 </div>
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
                      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3"><CreditCard className="text-indigo-500"/> 庫存管理</h2>
                          <div className="relative w-full md:w-auto">
                              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                              <input 
                                  type="text" 
                                  placeholder="搜尋學員姓名/電話..." 
                                  className="pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 w-full md:w-64 focus:ring-2 focus:ring-indigo-500 outline-none glass-input"
                                  value={searchQuery}
                                  onChange={e => setSearchQuery(e.target.value)}
                              />
                          </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {filteredInventories.map(inv => {
                              const canEdit = ['manager', 'receptionist'].includes(currentUser.role);
                              return (
                                  <div key={inv.id} onClick={() => canEdit && handleOpenInventoryModal(inv)} className={`glass-card p-6 rounded-2xl border border-slate-100 dark:border-slate-700 transition-all hover:shadow-lg hover:scale-[1.02] group ${canEdit ? 'cursor-pointer' : ''}`}>
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
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                            營運分析: <span className="text-indigo-600">{statsStart ? new Date(statsStart).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long'}) : ''}</span>
                        </h2>
                    </div>

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
                       <button onClick={handleCustomExportStats} className="bg-emerald-500 text-white flex items-center gap-2 px-4 py-2 rounded-xl text-sm shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 transition-all"><FileSpreadsheet size={16}/> 匯出報表</button>
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
                     <h3 className="font-bold text-xl mb-6 dark:text-white flex items-center gap-2"><History className="text-slate-500"/> 系統日誌</h3>
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
                       <h3 className="font-bold text-2xl mb-8 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-4">
                           <BookOpen className="text-indigo-500"/> 使用操作手冊
                       </h3>
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
                                  <li>點擊「匯出報表」可下載該區間的綜合營運數據 CSV 檔案。</li>
                                  <li>點擊「匯出取消明細」可下載該區間內所有取消的預約紀錄。</li>
                                </ol>
                            </div>
                       </div>
                   </div>
               )}

               {isCoachModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => setIsCoachModalOpen(false)}>
                    <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden animate-slideUp border border-white/20 dark:border-slate-700/30 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-slate-100/50 dark:border-slate-700/50 flex justify-between items-center shrink-0">
                            <h3 className="font-bold text-xl dark:text-white">{isNewCoach ? '新增員工資料' : '編輯員工與班表'}</h3>
                            <button onClick={() => setIsCoachModalOpen(false)}><X className="text-slate-500"/></button>
                        </div>
                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            <form onSubmit={handleSubmitCoach} className="space-y-6">
                                {/* Basic Info */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">姓名</label>
                                        <input type="text" required value={editingCoach.name || ''} onChange={e => setEditingCoach({...editingCoach, name: e.target.value})} className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white"/>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">職位/稱謂</label>
                                        <input type="text" value={editingCoach.title || ''} onChange={e => setEditingCoach({...editingCoach, title: e.target.value})} className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white" placeholder="例如: 教練, 物理治療師"/>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">角色權限</label>
                                        <select value={editingCoach.role || 'coach'} onChange={e => setEditingCoach({...editingCoach, role: e.target.value as any})} className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white">
                                            <option value="coach">教練 (Coach)</option>
                                            <option value="manager">主管 (Manager)</option>
                                            <option value="receptionist">櫃檯 (Receptionist)</option>
                                        </select>
                                    </div>
                                    <div>
                                       <label className="text-xs font-bold text-slate-500 uppercase">代表色</label>
                                       <div className="grid grid-cols-4 gap-2 mt-2 p-2 glass-card rounded-xl">
                                           {COLOR_OPTIONS.map(opt => (
                                               <button type="button" key={opt.label} onClick={() => setEditingCoach({...editingCoach, color: opt.value})}
                                                   className={`h-7 rounded-lg border-2 transition-all ${opt.value.split(' ')[0]} ${editingCoach.color === opt.value ? 'border-slate-600 dark:border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                                   title={opt.label}/>
                                           ))}
                                       </div>
                                   </div>
                                </div>
                                {isNewCoach && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Mail size={12}/> Email (登入用)</label>
                                            <input type="email" required value={newCoachEmail} onChange={e => setNewCoachEmail(e.target.value)} className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white"/>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Key size={12}/> 密碼</label>
                                            <input type="password" required value={newCoachPassword} onChange={e => setNewCoachPassword(e.target.value)} className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white"/>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Schedule Settings */}
                                <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                                  <h4 className="font-bold dark:text-white mb-4">每週固定班表</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {['日','一','二','三','四','五','六'].map((d, i) => {
                                        const isWorkDay = editingCoach.workDays?.includes(i);
                                        const hours = editingCoach.dailyWorkHours?.[i.toString()] || { start: editingCoach.workStart, end: editingCoach.workEnd };
                                        return (
                                            <div key={i} className={`p-3 rounded-xl border transition-all ${isWorkDay ? 'border-indigo-200 bg-indigo-50/50' : 'opacity-60'}`}>
                                                <div className="flex items-center justify-between">
                                                    <span className="font-bold">星期{d}</span>
                                                    <button type="button" onClick={() => handleModalDayConfig(i, !isWorkDay, hours.start, hours.end)}
                                                        className={`w-10 h-6 rounded-full transition-colors relative shadow-inner ${isWorkDay ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                                                        <div className={`absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full shadow transition-transform ${isWorkDay ? 'translate-x-4' : 'translate-x-0'}`}/>
                                                    </button>
                                                </div>
                                                {isWorkDay && (
                                                    <div className="mt-2 flex items-center gap-1 text-sm">
                                                        <select value={hours.start} onChange={e => handleModalDayConfig(i, true, e.target.value, hours.end)} className="glass-input rounded-md p-1 w-full text-center">
                                                            {ALL_TIME_SLOTS.map(t=><option key={t} value={t}>{t}</option>)}
                                                        </select>
                                                        <span>-</span>
                                                         <select value={hours.end} onChange={e => handleModalDayConfig(i, true, hours.start, e.target.value)} className="glass-input rounded-md p-1 w-full text-center">
                                                            {ALL_TIME_SLOTS.map(t=><option key={t} value={t}>{t}</option>)}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                  </div>
                                </div>

                                {/* Off Dates */}
                                <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                                   <label className="font-bold dark:text-white mb-2 block">特定日期休假</label>
                                   <div className="flex gap-2 mb-3">
                                       <input type="date" className="flex-1 glass-input rounded-xl p-2 text-sm" value={tempOffDate} onChange={e => setTempOffDate(e.target.value)} />
                                       <button type="button" onClick={handleAddOffDate} className="bg-slate-200 px-4 rounded-xl font-bold text-sm hover:bg-slate-300">新增</button>
                                   </div>
                                   <div className="flex flex-wrap gap-2">
                                       {editingCoach.offDates?.map(date => (
                                           <div key={date} className="flex items-center gap-1 bg-red-50 text-red-500 px-2 py-1 rounded-lg text-xs font-bold">
                                               {date}
                                               <button type="button" onClick={() => handleRemoveOffDate(date)} className="hover:text-red-700"><X size={12}/></button>
                                           </div>
                                       ))}
                                   </div>
                                </div>

                                <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg mt-4 hover:bg-indigo-700 transition-colors">儲存變更</button>
                            </form>
                        </div>
                    </div>
                </div>
               )}

               {isInventoryModalOpen && editingInventory && (
                   <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => setIsInventoryModalOpen(false)}>
                       <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-slideUp border border-white/20 dark:border-slate-700/30" onClick={e => e.stopPropagation()}>
                           <div className="p-5 border-b border-slate-100/50 dark:border-slate-700/50 flex justify-between items-center">
                               <h3 className="font-bold text-xl dark:text-white flex items-center gap-2"><CreditCard size={20} className="text-indigo-500"/> 修改庫存</h3>
                               <button onClick={() => setIsInventoryModalOpen(false)}><X className="text-slate-500"/></button>
                           </div>
                           <div className="p-6">
                               <div className="glass-card p-3 rounded-xl bg-white/50 dark:bg-slate-800/50 mb-4">
                                   <div className="text-xs text-slate-400 uppercase font-bold">學員資料</div>
                                   <div className="font-bold text-lg dark:text-white">{inventoryForm.name}</div>
                                   <div className="text-sm text-slate-500">{inventoryForm.phone}</div>
                               </div>

                               <div className="grid grid-cols-2 gap-4 mb-4">
                                   <div>
                                       <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">私人課</label>
                                       <input type="number" className="w-full text-2xl font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 border-b-2 border-indigo-200 focus:border-indigo-500 outline-none p-2 rounded-t-lg text-center glass-input" value={inventoryForm.private} onChange={e => setInventoryForm({...inventoryForm, private: Number(e.target.value)})}/>
                                   </div>
                                   <div>
                                       <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">團體課</label>
                                       <input type="number" className="w-full text-2xl font-bold text-orange-600 bg-orange-50 dark:bg-orange-900/20 border-b-2 border-orange-200 focus:border-orange-500 outline-none p-2 rounded-t-lg text-center glass-input" value={inventoryForm.group} onChange={e => setInventoryForm({...inventoryForm, group: Number(e.target.value)})}/>
                                   </div>
                               </div>

                               <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                   <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">點數變動紀錄</h4>
                                   <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar pr-2">
                                       {logs.filter(log => log.action === '庫存調整' && (log.details.includes(editingInventory.name) || log.details.includes(editingInventory.id)))
                                           .slice(0, 10)
                                           .map(log => (
                                               <div key={log.id} className="text-xs p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                                                   <p className="font-medium text-slate-600 dark:text-slate-300">{log.details}</p>
                                                   <p className="text-slate-400">{new Date(log.time).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</p>
                                               </div>
                                           ))
                                       }
                                        {logs.filter(log => log.action === '庫存調整' && (log.details.includes(editingInventory.name) || log.details.includes(editingInventory.id))).length === 0 && (
                                            <p className="text-xs text-center text-slate-400 py-4">無相關紀錄</p>
                                        )}
                                   </div>
                               </div>
                               
                               <div className="pt-4">
                                   <button onClick={handleSaveInventoryChanges} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                                       <Save size={18}/> 儲存修改
                                   </button>
                               </div>
                           </div>
                       </div>
                   </div>
               )}
           </div>
       </main>
    </div>
  );
};

export default AdminDashboard;