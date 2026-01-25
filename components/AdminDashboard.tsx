import React, { useRef, useState, useMemo } from 'react';
import { LogOut, Trash2, FileSpreadsheet, Database, Clock, ChevronRight, ChevronLeft, FileWarning, BarChart3, List, Settings as SettingsIcon, History, User as UserIcon, Users, Plus, Edit2, X, Mail, Key, CalendarX, Layers, CreditCard, Search, Lock, Unlock, Save, AlertTriangle, CheckCircle, RotateCcw, ShieldCheck, Download, Timer, Filter, BookOpen, HelpCircle, Info, TrendingDown, TrendingUp, Dumbbell, LayoutGrid, Activity } from 'lucide-react';
import { User, Appointment, Coach, Log, UserInventory, WorkoutPlan } from '../types';
import { ALL_TIME_SLOTS, COLOR_OPTIONS } from '../constants';
import { isPastTime, formatDateKey } from '../utils';
import { saveToFirestore } from '../services/firebase';
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
  onToggleComplete: (app: Appointment) => void; // New Prop
  inventories: UserInventory[];
  onDeleteInventory: (id: string) => void;
  onSaveInventory: (inv: UserInventory) => void;
  workoutPlans: WorkoutPlan[];
  onSaveWorkoutPlan: (plan: WorkoutPlan) => void;
  onDeleteWorkoutPlan: (id: string) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser, onLogout, adminTab, setAdminTab, renderWeeklyCalendar,
  appointments, selectedBatch, toggleBatchSelect, handleBatchDelete,
  handleExportJson, handleFileImport,
  coaches, updateCoachWorkDays, logs, onSaveCoach, onDeleteCoach, onOpenBatchBlock, onToggleComplete,
  inventories, onDeleteInventory, onSaveInventory,
  workoutPlans, onSaveWorkoutPlan, onDeleteWorkoutPlan
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isCoachModalOpen, setIsCoachModalOpen] = useState(false);
  const [editingCoach, setEditingCoach] = useState<Partial<Coach>>({});
  const [newCoachEmail, setNewCoachEmail] = useState('');
  const [newCoachPassword, setNewCoachPassword] = useState('');
  const [isNewCoach, setIsNewCoach] = useState(false);
  const [tempOffDate, setTempOffDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [editingInventory, setEditingInventory] = useState<Partial<UserInventory>>({});
  const [isLineIdLocked, setIsLineIdLocked] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'not_checked_in' | 'checked_in' | 'completed' | 'cancelled'>('all');
  const [appSearchTerm, setAppSearchTerm] = useState('');
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [viewingHistoryFor, setViewingHistoryFor] = useState<UserInventory | null>(null);
  const [analysisMonth, setAnalysisMonth] = useState(new Date());

  const { statsStartDate, statsEndDate } = useMemo(() => {
    const year = analysisMonth.getFullYear();
    const month = analysisMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return {
        statsStartDate: formatDateKey(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate()),
        statsEndDate: formatDateKey(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate())
    };
  }, [analysisMonth]);

  const filteredApps = appointments.filter(a => currentUser.role==='manager' || currentUser.role==='receptionist' || a.coachId === currentUser.id);
  const checkedInCount = filteredApps.filter(a => a.status === 'checked_in').length;

  const statsData = useMemo(() => {
    const rangeApps = appointments.filter(a => a.date >= statsStartDate && a.date <= statsEndDate);
    const totalActive = rangeApps.filter(a => a.status === 'confirmed').length;
    const totalCompleted = rangeApps.filter(a => a.status === 'completed').length;
    const totalCancelled = rangeApps.filter(a => a.status === 'cancelled').length;
    
    const slotCounts: Record<string, number> = {};
    rangeApps.filter(a => a.status !== 'cancelled').forEach(a => {
        slotCounts[a.time] = (slotCounts[a.time] || 0) + 1;
    });
    const topTimeSlots = Object.entries(slotCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([time, count]) => ({ time, count }));

    const coachStats = coaches.map(c => {
        const cApps = rangeApps.filter(a => a.coachId === c.id && a.status !== 'cancelled');
        const personal = cApps.filter(a => a.type === 'private' || (a.type as string) === 'client').length;
        const group = cApps.filter(a => a.type === 'group').length;
        return { id: c.id, name: c.name, personal, group, total: personal + group };
    });

    return { totalActive, totalCompleted, totalCancelled, topTimeSlots, coachStats, rangeApps };
  }, [appointments, statsStartDate, statsEndDate, coaches]);

  const userHistory = useMemo(() => {
    if (!viewingHistoryFor) return [];
    const deductions = appointments
        .filter(app => app.status === 'completed' && (app.type === 'private' || (app.type as string) === 'client') && ((viewingHistoryFor.lineUserId && app.lineUserId === viewingHistoryFor.lineUserId) || (app.customer?.name === viewingHistoryFor.name && (!viewingHistoryFor.phone || app.customer?.phone === viewingHistoryFor.phone))))
        .map(app => ({ timestamp: new Date(`${app.date}T${app.time}`).getTime(), description: '私人課程完課', change: -1, details: `教練: ${app.coachName || 'N/A'}` }));

    const adjustments = logs
        .filter(log => log.action === '庫存調整' && log.details.includes(viewingHistoryFor.name))
        .map(log => {
            const match = log.details.match(/1v1: ([\d\?]+) -> (-?[\d]+)/);
            let change = 0;
            if (match) {
                const before = match[1] === '?' ? NaN : parseInt(match[1], 10);
                const after = parseInt(match[2], 10);
                if (!isNaN(after)) {
                    change = isNaN(before) ? after : after - before;
                }
            }
            return { timestamp: new Date(log.time).getTime(), description: '點數調整', change: change, details: `操作者: ${log.user}` }
        }).filter(adj => adj.change !== 0);

    return [...deductions, ...adjustments].sort((a, b) => b.timestamp - a.timestamp);
  }, [viewingHistoryFor, appointments, logs]);

  const handlePrevMonth = () => setAnalysisMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  
  const handleNextMonth = () => {
    const nextMonth = new Date(analysisMonth.getFullYear(), analysisMonth.getMonth() + 1, 1);
    if (nextMonth <= new Date()) setAnalysisMonth(nextMonth);
  };

  const handleRevertStatus = async (app: Appointment) => {
      if (currentUser.role === 'manager' && window.confirm(`確定要將 ${app.customer?.name || '此課程'} 的狀態還原為「已確認」嗎？`)) {
          try {
              await saveToFirestore('appointments', app.id, { ...app, status: 'confirmed' });
          } catch (e) { console.error(e); alert('更新失敗'); }
      }
  };

  const handleUpdateDayConfig = (coach: Coach, dayIndex: number, enabled: boolean, start?: string, end?: string) => {
     const newWorkDays = enabled ? [...new Set([...coach.workDays, dayIndex])].sort() : coach.workDays.filter(d => d !== dayIndex);
     const newDaily = { ...(coach.dailyWorkHours || {}) };
     if (enabled && start && end) newDaily[dayIndex.toString()] = { start, end };
     else delete newDaily[dayIndex.toString()];
     updateCoachWorkDays({ ...coach, workDays: newWorkDays, dailyWorkHours: newDaily });
  };

  const handleExportRangeCsv = () => {
      const rows = [
          ["統計區間", `${statsStartDate} ~ ${statsEndDate}`],
          ["統計項目", "數值"],
          ["總預約數 (含取消)", statsData.rangeApps.length],
          ["有效預約 (未簽到)", statsData.totalActive],
          ["已完課", statsData.totalCompleted],
          ["已取消", statsData.totalCancelled],
          [],
          ["教練", "個人課", "團課/其他", "總計"],
          ...statsData.coachStats.map(c => [c.name, c.personal, c.group, c.total]),
          [],
          ["預約明細"],
          ["日期", "時間", "狀態", "類型", "教練", "學員", "備註/原因"],
          ...statsData.rangeApps.map(a => [ a.date, a.time, a.status, a.type, a.coachName, a.customer?.name || '', a.cancelReason || a.reason || '' ])
      ];
      const csvContent = "\uFEFF" + rows.map(e => e.join(",")).join("\n");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([csvContent], { type: "text/csv;charset=utf-8;" }));
      link.download = `report_${statsStartDate}_to_${statsEndDate}.csv`;
      link.click();
  };

  const handleExportCancelCsv = () => {
    const cancelledApps = appointments.filter(a => a.status === 'cancelled' && (currentUser.role === 'manager' || currentUser.role === 'receptionist' || a.coachId === currentUser.id));
    const header = "預約日期,時間,教練,客戶名稱,取消原因";
    const rows = cancelledApps.map(a => `${a.date},${a.time},${a.coachName},${a.customer?.name || ''},${a.cancelReason || ''}`);
    const csvContent = "\uFEFF" + [header, ...rows].join("\n");
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csvContent], { type: "text/csv;charset=utf-8;" }));
    link.download = `cancellations_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  const handleOpenCoachModal = (coach?: Coach) => {
    setEditingCoach(coach ? { ...coach, offDates: coach.offDates || [] } : { name: '', role: 'coach', color: COLOR_OPTIONS[0].value, workStart: '09:00', workEnd: '21:00', workDays: [0, 1, 2, 3, 4, 5, 6], offDates: [] });
    setIsNewCoach(!coach);
    setNewCoachEmail('');
    setNewCoachPassword('');
    setTempOffDate('');
    setIsCoachModalOpen(true);
  };

  const handleAddOffDate = () => {
      if (tempOffDate && !(editingCoach.offDates || []).includes(tempOffDate)) {
          setEditingCoach({ ...editingCoach, offDates: [...(editingCoach.offDates || []), tempOffDate].sort() });
      }
      setTempOffDate('');
  };

  const handleRemoveOffDate = (dateToRemove: string) => setEditingCoach({ ...editingCoach, offDates: (editingCoach.offDates || []).filter(d => d !== dateToRemove) });

  const handleSubmitCoach = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isNewCoach && !editingCoach.id) return;
    onSaveCoach(editingCoach as Coach, isNewCoach ? newCoachEmail : undefined, isNewCoach ? newCoachPassword : undefined);
    setIsCoachModalOpen(false);
  };

  const handleOpenInventoryModal = (inv?: UserInventory) => {
      if (!['manager', 'receptionist'].includes(currentUser.role)) return;
      setEditingInventory(inv ? { ...inv } : { name: '', phone: '', email: '', lineUserId: '', credits: { private: 0, group: 0 } });
      setIsLineIdLocked(!!inv?.lineUserId);
      setIsInventoryModalOpen(true);
  };

  const handleSubmitInventory = (e: React.FormEvent) => {
      e.preventDefault();
      if (!['manager', 'receptionist'].includes(currentUser.role) || !editingInventory.name) return;
      onSaveInventory({ ...editingInventory, credits: { private: Number(editingInventory.credits?.private || 0), group: Number(editingInventory.credits?.group || 0) } } as UserInventory);
      setIsInventoryModalOpen(false);
  };
  
  const handleViewHistory = (inv: UserInventory) => {
    setViewingHistoryFor(inv);
    setIsHistoryModalOpen(true);
  };

  const filteredInventories = inventories.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()) || (i.phone && i.phone.includes(searchQuery)) || (i.lineUserId && i.lineUserId.includes(searchQuery)));

  const displayAppointments = filteredApps
    .filter(app => {
        if (statusFilter === 'all') return true;
        const isPast = isPastTime(app.date, app.time);
        if (statusFilter === 'not_checked_in') return app.status === 'confirmed' && isPast;
        if (statusFilter === 'confirmed') return app.status === 'confirmed' && !isPast;
        return app.status === statusFilter;
    })
    .filter(app => !appSearchTerm || (app.customer?.name && app.customer.name.toLowerCase().includes(appSearchTerm.toLowerCase())) || (app.customer?.phone && app.customer.phone.includes(appSearchTerm)) || (app.reason && app.reason.toLowerCase().includes(appSearchTerm.toLowerCase())) || (app.coachName && app.coachName.toLowerCase().includes(appSearchTerm.toLowerCase())))
    .sort((a,b) => new Date(`${b.date} ${b.time}`).getTime() - new Date(`${a.date} ${a.time}`).getTime());


  return (
    <div className="max-w-6xl mx-auto p-4 pb-24">
       <div className="flex justify-between items-center mb-8 relative">
          <div>
            <h1 className="text-2xl font-bold dark:text-white mb-1">管理後台</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">歡迎回來，{currentUser.name} <span className="bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs px-2 py-0.5 rounded-full ml-1 uppercase">{currentUser.role}</span></p>
          </div>
          <button onClick={onLogout} className="glass-card flex items-center gap-2 text-red-500 px-4 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shadow-sm"><LogOut size={16}/> 登出</button>
          
          {/* Audit Badge */}
          {checkedInCount > 0 && (
             <button 
                 onClick={() => { setAdminTab('appointments'); setStatusFilter('checked_in'); }}
                 className="absolute top-14 right-0 md:top-0 md:right-32 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-full shadow-lg shadow-orange-500/40 animate-pulse flex items-center gap-2 font-bold text-sm transition-all z-20"
             >
                 <Timer size={16} className="animate-spin-slow"/>
                 {checkedInCount} 筆待核實
             </button>
          )}
       </div>
       
       {checkedInCount > 0 && adminTab !== 'appointments' && (
           <div onClick={() => { setAdminTab('appointments'); setStatusFilter('checked_in'); }} className="mb-6 bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-4 text-white shadow-lg cursor-pointer hover:scale-[1.01] transition-transform flex items-center justify-between md:hidden">
               <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm"><Timer size={20}/></div>
                   <div>
                       <div className="font-bold text-lg">等待確認完課</div>
                       <div className="text-sm opacity-90">有 {checkedInCount} 筆學生已簽到，請核實</div>
                   </div>
               </div>
               <ChevronRight/>
           </div>
       )}

       {/* Redesigned Tab Navigation */}
       <div className="glass-panel p-2 rounded-2xl mb-8 overflow-x-auto shadow-sm">
           <div className="flex flex-col md:flex-row gap-2 md:gap-8 px-2">
               {/* Core Operations Group */}
               <div className="flex items-center gap-1">
                   <div className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2 hidden md:block">核心營運</div>
                   {[
                       { id: 'calendar', icon: Clock, label: '行事曆' },
                       { id: 'appointments', icon: List, label: '預約列表' },
                       { id: 'inventory', icon: CreditCard, label: '庫存管理' }
                   ].map(tab => (
                       <button 
                           key={tab.id} 
                           onClick={() => setAdminTab(tab.id)}
                           className={`px-4 py-2.5 rounded-xl whitespace-nowrap text-sm font-bold transition-all flex items-center gap-2 ${adminTab === tab.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                       >
                           <tab.icon size={16}/> {tab.label}
                       </button>
                   ))}
               </div>

               <div className="w-px bg-gray-200 dark:bg-gray-700 hidden md:block"></div>

               {/* System Data Group */}
               <div className="flex items-center gap-1">
                   <div className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2 hidden md:block">系統數據</div>
                    {[
                       { id: 'analysis', icon: BarChart3, label: '營運分析' },
                       { id: 'workout', icon: Dumbbell, label: '課表' },
                       { id: 'staff', icon: Users, label: '員工', role: 'manager' },
                       { id: 'settings', icon: SettingsIcon, label: '設定' },
                       { id: 'logs', icon: History, label: '紀錄' },
                       { id: 'help', icon: BookOpen, label: '說明' }
                   ].map(tab => {
                       if (tab.role && currentUser.role !== tab.role) return null;
                       return (
                           <button 
                               key={tab.id} 
                               onClick={() => setAdminTab(tab.id)}
                               className={`px-4 py-2.5 rounded-xl whitespace-nowrap text-sm font-bold transition-all flex items-center gap-2 ${adminTab === tab.id ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-white shadow-md' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                           >
                               <tab.icon size={16}/> {tab.label}
                           </button>
                       )
                   })}
               </div>
           </div>
       </div>

       {adminTab === 'calendar' && (<><div className="flex justify-end mb-4 animate-fadeIn"><button onClick={onOpenBatchBlock} className="flex items-center gap-2 bg-gray-800 text-white dark:bg-white dark:text-gray-900 px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:opacity-90 transition-opacity"><Layers size={16}/> 批次封鎖時段</button></div>{renderWeeklyCalendar()}</>)}
       {adminTab === 'workout' && (<WorkoutPlans currentUser={currentUser} inventories={inventories} workoutPlans={workoutPlans} onSavePlan={onSaveWorkoutPlan} onDeletePlan={onDeleteWorkoutPlan} onSaveInventory={onSaveInventory}/>)}
       {adminTab === 'appointments' && (
         <div className="glass-panel rounded-3xl shadow-lg p-6">
           <div className="flex flex-col md:flex-row justify-between mb-6 gap-4 items-start md:items-center">
             <h3 className="font-bold text-xl dark:text-white flex items-center gap-2"><List className="text-indigo-500"/> 預約列表</h3>
             <div className="flex flex-wrap gap-2 w-full md:w-auto">
                 <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input type="text" placeholder="搜尋姓名/電話..." className="pl-9 pr-3 py-2 w-full md:w-48 rounded-xl bg-gray-100 dark:bg-gray-800 border-none text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white" value={appSearchTerm} onChange={e => setAppSearchTerm(e.target.value)}/></div>
                 <div className="relative"><Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><select className="pl-9 pr-8 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 border-none text-sm focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer appearance-none dark:text-white font-bold" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}><option value="all">所有狀態</option><option value="confirmed">已預約 (未來)</option><option value="not_checked_in">未簽到 (過期)</option><option value="checked_in">已簽到 (待核實)</option><option value="completed">已完課</option><option value="cancelled">已取消</option></select><ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 rotate-90"/></div>
                 {selectedBatch.size > 0 && (<button onClick={handleBatchDelete} className="bg-red-500 text-white px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-lg hover:bg-red-600 transition-colors animate-fadeIn ml-2"><Trash2 size={16}/> 刪除選取 ({selectedBatch.size})</button>)}
             </div>
           </div>
           <div className="space-y-3">
             {displayAppointments.length === 0 ? (<div className="text-center py-12 text-gray-400"><div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3"><List size={32} className="opacity-50"/></div><p>沒有符合條件的預約</p></div>) : (displayAppointments.map(app => {
                   const visuals = (() => {
                       const isPast = isPastTime(app.date, app.time);
                       switch(app.status) {
                           case 'checked_in': return { bg: 'bg-orange-50 dark:bg-orange-900/10', border: 'border-orange-200 dark:border-orange-800', badge: 'bg-orange-100 text-orange-600', label: '已簽到' };
                           case 'completed': return { bg: 'bg-emerald-50 dark:bg-emerald-900/10', border: 'border-emerald-200 dark:border-emerald-800', badge: 'bg-emerald-100 text-emerald-600', label: '已完課' };
                           case 'cancelled': return { bg: 'bg-red-50 dark:bg-red-900/10', border: 'border-red-200 dark:border-red-800', badge: 'bg-red-100 text-red-600', label: '已取消' };
                           case 'confirmed': return isPast ? { bg: 'bg-yellow-50 dark:bg-yellow-900/10', border: 'border-yellow-200 dark:border-yellow-800', badge: 'bg-yellow-100 text-yellow-700', label: '未簽到' } : { bg: 'bg-white dark:bg-gray-800', border: 'border-transparent hover:border-indigo-300 dark:hover:border-indigo-700', badge: 'bg-indigo-100 text-indigo-600', label: '已預約' };
                           default: return { bg: 'bg-white dark:bg-gray-800', border: 'border-transparent hover:border-indigo-300 dark:hover:border-indigo-700', badge: 'bg-indigo-100 text-indigo-600', label: '已預約' };
                       }
                   })();
                   const isLocked = app.status === 'completed' && currentUser.role !== 'manager';
                   return (<div key={app.id} onClick={() => !isLocked && toggleBatchSelect(app.id)} className={`glass-card flex items-center gap-4 p-4 rounded-2xl group transition-all select-none border shadow-sm ${selectedBatch.has(app.id) ? 'border-2 border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/30 shadow-md transform scale-[1.01]' : visuals.border} ${visuals.bg} ${isLocked ? 'cursor-default opacity-80' : 'cursor-pointer'}`}>
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ${selectedBatch.has(app.id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600'} ${isLocked ? 'opacity-30' : ''}`}>{selectedBatch.has(app.id) && <X size={14} className="text-white rotate-45" strokeWidth={3} />}</div>
                      <div className="flex-1"><div className="flex justify-between items-center mb-1"><div className="flex items-center gap-3"><span className="font-bold text-lg dark:text-white">{app.date}</span><span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-sm font-medium">{app.time}</span></div>
                      
                      <div className="flex items-center gap-2">
                        {/* New Confirm Completion Button */}
                        {app.status === 'checked_in' && (['manager', 'receptionist'].includes(currentUser.role) || currentUser.id === app.coachId) && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm('確認核實完課？這將正式扣除 1 點點數且無法輕易撤銷。')) {
                                        onToggleComplete(app);
                                    }
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md transition-all flex items-center gap-1"
                            >
                                <CheckCircle size={14} /> 核實完課
                            </button>
                        )}

                        { (app.status === 'completed' || app.status === 'checked_in') && currentUser.role === 'manager' && (<button onClick={(e) => { e.stopPropagation(); handleRevertStatus(app); }} className="text-xs bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm transition-colors"><RotateCcw size={10}/> 還原</button>)}<span className={`text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1 ${visuals.badge}`}>{app.status === 'completed' && <CheckCircle size={10}/>}{app.status === 'checked_in' && <Timer size={10}/>}{visuals.label === '未簽到' && <AlertTriangle size={10}/>}{visuals.label}</span></div></div><div className="flex justify-between text-sm text-gray-500 dark:text-gray-400"><span className="flex items-center gap-1"><UserIcon size={12}/> {coaches.find(c => c.id === app.coachId)?.name || app.coachName}</span><span className="font-bold text-gray-700 dark:text-gray-300">{(app.type as string) ==='client' ? app?.customer?.name : app.reason}</span></div>{app.customer?.phone && (<div className="text-xs text-gray-400 mt-1 pl-4 border-l-2 border-gray-200 ml-0.5">{app.customer.phone}</div>)}</div>
                   </div>);
                 }))}
           </div>
         </div>
       )}
       {adminTab === 'inventory' && (
          <div className="glass-panel rounded-3xl shadow-lg p-6">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                  <h3 className="font-bold text-xl dark:text-white flex items-center gap-2"><CreditCard className="text-indigo-500"/> 庫存管理 {currentUser.role !== 'manager' && currentUser.role !== 'receptionist' && <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full ml-2">檢視模式</span>}</h3>
                  <div className="flex gap-2 w-full md:w-auto">
                      <div className="relative flex-1 md:flex-initial"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input type="text" placeholder="搜尋姓名、電話或 ID..." className="pl-10 pr-4 py-2 bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl w-full md:w-64 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all dark:text-white" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}/></div>
                      {['manager', 'receptionist'].includes(currentUser.role) && (<button onClick={() => handleOpenInventoryModal()} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all flex items-center gap-2 whitespace-nowrap"><Plus size={16}/> 新增學員</button>)}
                  </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredInventories.length === 0 ? (<div className="col-span-full py-12 text-center text-gray-400 bg-gray-50/50 dark:bg-gray-800/30 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700"><UserIcon size={48} className="mx-auto mb-4 opacity-50"/><p className="font-medium">找不到符合的學員資料</p>{['manager', 'receptionist'].includes(currentUser.role) && (<button onClick={() => handleOpenInventoryModal()} className="mt-4 text-indigo-500 font-bold hover:underline">新增一筆？</button>)}</div>) : (filteredInventories.map(inv => (<div key={inv.id} className="glass-card p-5 rounded-2xl border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-all group"><div className="flex justify-between items-start mb-3"><div><h4 onClick={() => handleViewHistory(inv)} className="font-bold text-lg dark:text-white flex items-center gap-2 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{inv.name}{inv.lineUserId ? <span className="w-2 h-2 rounded-full bg-[#06C755]" title="已綁定 LINE"></span> : <span className="w-2 h-2 rounded-full bg-gray-300" title="未綁定 LINE"></span>}</h4><p className="text-xs text-gray-500 dark:text-gray-400">{inv.phone || '無電話'}</p></div>{['manager', 'receptionist'].includes(currentUser.role) && (<div className="flex gap-1"><button onClick={() => handleOpenInventoryModal(inv)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"><Edit2 size={16}/></button><button onClick={() => { if(window.confirm(`確定刪除 ${inv.name} 嗎？此動作無法復原。`)) onDeleteInventory(inv.id) }} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 size={16}/></button></div>)}</div><div className="grid grid-cols-2 gap-2 mb-3"><div className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-xl text-center"><div className="text-xs text-gray-500 dark:text-gray-400 uppercase">私人課</div><div className={`font-bold text-lg ${inv.credits.private > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}>{inv.credits.private}</div></div><div className="bg-orange-50 dark:bg-orange-900/20 p-2 rounded-xl text-center"><div className="text-xs text-gray-500 dark:text-gray-400 uppercase">團課</div><div className={`font-bold text-lg ${inv.credits.group > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400'}`}>{inv.credits.group}</div></div></div><div className="text-[10px] text-gray-400 text-right">更新於: {new Date(inv.lastUpdated).toLocaleDateString()}</div></div>)))}
              </div>
          </div>
       )}
       {adminTab === 'analysis' && (<div className="space-y-6 animate-slideUp"><div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6"><div className="flex items-center gap-4 bg-white/50 dark:bg-gray-800/50 p-2 rounded-xl shadow-sm"><button onClick={handlePrevMonth} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><ChevronLeft size={20}/></button><span className="font-bold text-lg w-32 text-center text-gray-700 dark:text-gray-200">{analysisMonth.getFullYear()} 年 {analysisMonth.getMonth() + 1} 月</span><button onClick={handleNextMonth} disabled={new Date(analysisMonth.getFullYear(), analysisMonth.getMonth() + 1, 1) > new Date()} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"><ChevronRight size={20}/></button></div><div className="flex gap-3"><button onClick={handleExportCancelCsv} className="glass-card flex items-center gap-2 text-red-500 px-4 py-2 rounded-xl text-sm hover:bg-red-50 transition-colors shadow-sm"><FileWarning size={16}/> 匯出取消明細</button><button onClick={handleExportRangeCsv} className="bg-emerald-500 text-white flex items-center gap-2 px-4 py-2 rounded-xl text-sm shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 transition-all"><FileSpreadsheet size={16}/> 匯出本月報表</button></div></div><div className="grid grid-cols-1 md:grid-cols-3 gap-6"><div className="glass-panel p-6 rounded-3xl relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><BarChart3 size={100} className="text-orange-500"/></div><h4 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><Clock size={18} className="text-orange-500"/> 熱門時段</h4><div className="space-y-3 relative z-10">{statsData.topTimeSlots.length > 0 ? statsData.topTimeSlots.map((s: any, i: number) => (<div key={s.time} className="flex justify-between items-center p-3 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-white/40 dark:border-gray-700"><span className="font-bold text-orange-600 dark:text-orange-400">#{i+1} {s.time}</span><span className="text-sm font-medium">{s.count} 堂</span></div>)) : <div className="text-center text-gray-400 text-sm py-4">無數據</div>}</div></div><div className="glass-panel p-6 rounded-3xl flex flex-col justify-center"><h4 className="font-bold text-gray-800 dark:text-white mb-4 text-center">狀態總覽</h4><div className="grid grid-cols-3 gap-2 text-center divide-x divide-gray-200 dark:divide-gray-700"><div><div className="text-3xl lg:text-4xl font-bold text-indigo-500 mb-1">{statsData.totalActive}</div><div className="text-[10px] font-bold text-gray-400 uppercase">預約中</div></div><div><div className="text-3xl lg:text-4xl font-bold text-emerald-500 mb-1">{statsData.totalCompleted}</div><div className="text-[10px] font-bold text-gray-400 uppercase">已完課</div></div><div><div className="text-3xl lg:text-4xl font-bold text-red-500 mb-1">{statsData.totalCancelled}</div><div className="text-[10px] font-bold text-gray-400 uppercase">已取消</div></div></div></div><div className="glass-panel p-6 rounded-3xl md:col-span-1"><h4 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><UserIcon size={18} className="text-purple-500"/> 課程統計</h4><div className="overflow-y-auto max-h-[200px] custom-scrollbar pr-2"><div className="grid grid-cols-4 gap-2 text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider"><span>教練</span><span className="text-right">個人</span><span className="text-right">團課</span><span className="text-right">總計</span></div>{(currentUser.role === 'manager' ? statsData.coachStats : statsData.coachStats.filter((s: any) => s.id === currentUser.id)).map((c: any) => (<div key={c.id} className="grid grid-cols-4 gap-2 text-sm py-2 border-b border-gray-100 dark:border-gray-700 last:border-0 items-center"><span className="truncate font-medium dark:text-gray-200">{c.name}</span><span className="text-right text-gray-500">{c.personal}</span><span className="text-right text-gray-500">{c.group}</span><span className="text-right font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 rounded px-1">{c.total}</span></div>))}</div></div></div></div>)}
       {adminTab === 'staff' && currentUser.role === 'manager' && (<div className="glass-panel rounded-3xl shadow-lg p-6"><div className="flex justify-between items-center mb-6"><h3 className="font-bold text-xl dark:text-white flex items-center gap-2"><Users className="text-indigo-500"/> 員工管理</h3><button onClick={() => handleOpenCoachModal()} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all"><Plus size={16}/> 新增教練</button></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{coaches.map(coach => (<div key={coach.id} className="glass-card p-4 rounded-2xl relative group hover:shadow-lg transition-all border border-gray-100 dark:border-gray-700"><div className={`absolute top-0 left-0 w-2 h-full rounded-l-2xl ${coach.color.split(' ')[0]}`}></div><div className="pl-4 flex justify-between items-start"><div><h4 className="font-bold text-lg dark:text-white mb-1">{coach.name}</h4><div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 mb-1"><span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 uppercase">{coach.role}</span><span>{coach.workStart} - {coach.workEnd}</span></div>{coach.offDates && coach.offDates.length > 0 && (<div className="flex items-center gap-1 text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded w-fit"><CalendarX size={10}/>{coach.offDates.length} 個特定休假日</div>)}</div><div className="flex gap-2"><button onClick={() => handleOpenCoachModal(coach)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"><Edit2 size={16}/></button><button onClick={() => onDeleteCoach(coach.id, coach.name)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 size={16}/></button></div></div></div>))}</div></div>)}
       {adminTab === 'settings' && (<div className="space-y-6">{currentUser.role === 'manager' && (<div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 rounded-3xl shadow-lg text-white flex justify-between items-center"><span className="font-bold flex items-center gap-3 text-lg"><Database size={24}/> 資料庫管理</span><div className="flex gap-3"><button onClick={handleExportJson} className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-4 py-2 rounded-xl text-sm border border-white/30 transition-all">匯出備份</button><button onClick={() => fileInputRef.current?.click()} className="bg-white text-indigo-600 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-gray-50 transition-all">匯入資料</button><input type="file" ref={fileInputRef} onChange={handleFileImport} className="hidden"/></div></div>)}{coaches.map(c => {if (currentUser.role === 'coach' && currentUser.id !== c.id) return null; return (<div key={c.id} className="glass-panel p-6 rounded-3xl shadow-sm"><div className="font-bold mb-6 dark:text-white flex items-center gap-3 text-xl border-b border-gray-100 dark:border-gray-700 pb-4"><div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600"><Clock size={20}/></div>{c.name} 班表設定</div><div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{['日','一','二','三','四','五','六'].map((d, i) => { const isWorkDay = c.workDays?.includes(i); const hours = c.dailyWorkHours?.[i.toString()] || { start: c.workStart, end: c.workEnd }; return (<div key={i} className={`p-4 rounded-2xl border transition-all duration-300 ${isWorkDay ? 'border-indigo-200 bg-indigo-50/50 dark:bg-indigo-900/10 dark:border-indigo-800' : 'border-gray-100 bg-gray-50/50 dark:bg-gray-800/50 dark:border-gray-700 opacity-60'}`}><div className="flex items-center justify-between"><div className="flex items-center gap-4"><button onClick={() => handleUpdateDayConfig(c, i, !isWorkDay, hours.start, hours.end)} className={`w-12 h-7 rounded-full transition-colors relative shadow-inner ${isWorkDay ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'}`}><div className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-sm transition-transform duration-300 ${isWorkDay ? 'translate-x-5' : 'translate-x-0'}`}></div></button><span className={`font-bold ${isWorkDay ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}`}>星期{d}</span></div>{!isWorkDay && <span className="text-xs font-medium text-gray-400 bg-white dark:bg-gray-700 px-2 py-1 rounded">休假</span>}</div>{isWorkDay && (<div className="mt-4 flex items-center gap-2 bg-white/70 dark:bg-gray-700/50 p-2 rounded-xl border border-gray-100 dark:border-gray-600 shadow-sm"><Clock size={14} className="text-gray-400 ml-1"/><select value={hours.start} onChange={(e) => handleUpdateDayConfig(c, i, true, e.target.value, hours.end)} className="flex-1 bg-transparent text-sm font-medium text-gray-700 dark:text-gray-200 outline-none cursor-pointer text-center">{ALL_TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}</select><ChevronRight size={14} className="text-gray-300"/><select value={hours.end} onChange={(e) => handleUpdateDayConfig(c, i, true, hours.start, e.target.value)} className="flex-1 bg-transparent text-sm font-medium text-gray-700 dark:text-gray-200 outline-none cursor-pointer text-center">{ALL_TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>)}</div>); })}</div></div>); })}</div>)}
       
       {adminTab === 'help' && (
         <div className="glass-panel rounded-3xl shadow-lg p-8 animate-slideUp">
           <h3 className="font-bold text-2xl mb-6 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-4">
             <BookOpen className="text-indigo-500"/> 使用手冊與操作指南
           </h3>
           <div className="space-y-8">
             <section>
               <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                 <ShieldCheck size={20} className="text-indigo-500"/> 雙重核實扣點流程 (Double Verification)
               </h4>
               <div className="glass-card p-6 rounded-2xl border-l-4 border-indigo-500">
                 <div className="flex flex-col md:flex-row gap-6 relative">
                    <div className="flex-1 z-10">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold mb-3 shadow-sm">1</div>
                        <h5 className="font-bold text-gray-800 dark:text-white mb-2">預約與預扣說明</h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                            學生預約課程時，系統會檢查庫存但<span className="text-red-500 font-bold">不會立即扣除點數</span>。此為「預約佔位」狀態。
                        </p>
                    </div>
                    <div className="hidden md:block w-px bg-gray-200 dark:bg-gray-700"></div>
                    <div className="flex-1 z-10">
                        <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold mb-3 shadow-sm">2</div>
                        <h5 className="font-bold text-gray-800 dark:text-white mb-2">學生現場簽到</h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                            到達現場後，學生需在手機上點擊「立即簽到」。此時後台會顯示 <span className="text-orange-500 font-bold">等待確認</span> 標記。
                        </p>
                    </div>
                    <div className="hidden md:block w-px bg-gray-200 dark:bg-gray-700"></div>
                    <div className="flex-1 z-10">
                        <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold mb-3 shadow-sm">3</div>
                        <h5 className="font-bold text-gray-800 dark:text-white mb-2">教練確認完課 (扣點)</h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                            課程結束後，教練核實學生已出席，點擊「核實完課」。<span className="font-bold text-indigo-600">此時系統才會正式扣除 1 點庫存。</span>
                        </p>
                    </div>
                 </div>
               </div>
             </section>

             <section>
                 <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                     <AlertTriangle size={20} className="text-orange-500"/> 取消與返還
                 </h4>
                 <div className="p-4 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-900/30">
                     <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
                         <li>若學生在教練核實完課前取消預約，因尚未扣點，故無須返還點數，系統僅會更改預約狀態為「已取消」。</li>
                         <li>若教練誤按完課導致扣點，管理員需至「庫存管理」手動補回點數，並在紀錄中註明原因。</li>
                     </ul>
                 </div>
             </section>

             <section>
                 <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                     <CalendarX size={20} className="text-red-500"/> 教練休假設定
                 </h4>
                 <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                     若教練需要在特定日期排休（例如國定假日或臨時事假），請至「員工管理」設定：
                 </p>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="glass-card p-4 rounded-xl flex items-center gap-3">
                         <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg"><Edit2 size={16}/></div>
                         <div className="text-sm">點擊該教練卡片上的編輯按鈕</div>
                     </div>
                     <div className="glass-card p-4 rounded-xl flex items-center gap-3">
                         <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg"><CalendarX size={16}/></div>
                         <div className="text-sm">在底部「特定日期休假」欄位新增日期</div>
                     </div>
                 </div>
                 <p className="text-xs text-gray-400 mt-2 italic">* 設定休假後，該日期的行事曆時段將會顯示灰色斜線，且無法被預約。</p>
             </section>
           </div>
         </div>
       )}

       {/* Logs */}
       {adminTab === 'logs' && (<div className="glass-panel rounded-3xl shadow-lg p-6 h-[600px] overflow-y-auto custom-scrollbar"><h3 className="font-bold text-xl mb-6 dark:text-white flex items-center gap-2"><History className="text-gray-500"/> 系統日誌</h3><div className="space-y-4">{logs.filter(log => currentUser.role === 'manager' || log.user === currentUser.name).map(log => (<div key={log.id} className="relative pl-6 pb-2 border-l-2 border-gray-200 dark:border-gray-700 last:border-0"><div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white dark:bg-gray-800 border-2 border-indigo-400"></div><div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mb-1"><span>{new Date(log.time).toLocaleString()}</span><span>{log.user}</span></div><div className="glass-card p-3 rounded-xl"><div className="font-bold text-gray-800 dark:text-gray-200 mb-1">{log.action}</div><div className="text-sm text-gray-600 dark:text-gray-400">{log.details}</div></div></div>))}</div></div>)}
       
       {isCoachModalOpen && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4" onClick={() => setIsCoachModalOpen(false)}><div className="glass-panel w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-slideUp border border-white/40 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}><div className="bg-white/50 dark:bg-gray-900/50 p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center"><h3 className="font-bold text-xl dark:text-white">{isNewCoach ? '新增員工資料' : '編輯員工資料'}</h3><button onClick={() => setIsCoachModalOpen(false)}><X className="text-gray-500"/></button></div><div className="p-6"><form onSubmit={handleSubmitCoach} className="space-y-4"><div><label className="text-xs font-bold text-gray-500 uppercase">姓名</label><input type="text" required value={editingCoach.name || ''} onChange={e => setEditingCoach({...editingCoach, name: e.target.value})} className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white"/></div><div><label className="text-xs font-bold text-gray-500 uppercase">職位</label><select value={editingCoach.role || 'coach'} onChange={e => setEditingCoach({...editingCoach, role: e.target.value as any})} className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white"><option value="coach">教練 (Coach)</option><option value="manager">主管 (Manager)</option><option value="receptionist">櫃檯 (Receptionist)</option></select></div><div><label className="text-xs font-bold text-gray-500 uppercase">職稱 (顯示用)</label><input type="text" value={editingCoach.title || ''} onChange={e => setEditingCoach({...editingCoach, title: e.target.value})} className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white" placeholder="e.g. 物理治療師"/></div>{isNewCoach && (<><div><label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><Mail size={12}/> Email (登入帳號)</label><input type="email" required value={newCoachEmail} onChange={e => setNewCoachEmail(e.target.value)} className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white" placeholder="coach@gym.com"/></div><div><label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><Key size={12}/> 初始密碼</label><input type="password" required value={newCoachPassword} onChange={e => setNewCoachPassword(e.target.value)} className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white" placeholder="至少6位數"/></div></>)}<div><label className="text-xs font-bold text-gray-500 uppercase">代表色</label><div className="grid grid-cols-4 gap-2 mt-2">{COLOR_OPTIONS.map(opt => (<button type="button" key={opt.label} onClick={() => setEditingCoach({...editingCoach, color: opt.value})} className={`h-8 rounded-lg border-2 transition-all ${opt.value.split(' ')[0]} ${editingCoach.color === opt.value ? 'border-gray-600 dark:border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`} title={opt.label}/>))}</div></div><div className="border-t border-gray-100 dark:border-gray-700 pt-4 mt-2"><label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2 mb-2"><CalendarX size={14}/> 特定日期休假 (Off Dates)</label><div className="flex gap-2 mb-2"><input type="date" className="flex-1 glass-input rounded-xl p-2 text-sm dark:text-white" value={tempOffDate} onChange={e => setTempOffDate(e.target.value)}/><button type="button" onClick={handleAddOffDate} className="bg-gray-200 dark:bg-gray-700 px-3 rounded-xl font-bold text-sm hover:bg-gray-300 dark:hover:bg-gray-600">新增</button></div><div className="flex flex-wrap gap-2">{editingCoach.offDates?.map(date => (<div key={date} className="flex items-center gap-1 bg-red-50 dark:bg-red-900/20 text-red-500 px-2 py-1 rounded-lg text-xs font-bold">{date}<button type="button" onClick={() => handleRemoveOffDate(date)} className="hover:text-red-700"><X size={12}/></button></div>))}{(!editingCoach.offDates || editingCoach.offDates.length === 0) && (<span className="text-xs text-gray-400 italic">無設定休假日</span>)}</div></div><button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg mt-4">儲存</button></form></div></div></div>)}
    </div>
  );
};
export default AdminDashboard;