
import React, { useRef, useState, useMemo } from 'react';
import { LogOut, Trash2, FileSpreadsheet, Database, Clock, ChevronRight, FileWarning, BarChart3, List, Settings as SettingsIcon, History, User as UserIcon, Users, Plus, Edit2, X, Mail, Key, CalendarX, Layers, CreditCard, Search, Lock, Unlock, Save, AlertTriangle, CheckCircle, RotateCcw, ShieldCheck, Download, Timer, Filter, BookOpen, HelpCircle, Info, Calendar } from 'lucide-react';
import { User, Appointment, Coach, Log, UserInventory } from '../types';
import { ALL_TIME_SLOTS, COLOR_OPTIONS } from '../constants';
import { isPastTime, formatDateKey } from '../utils';
import { saveToFirestore } from '../services/firebase';

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
  analysis: any; // Legacy prop, replaced by local calculation
  handleExportStatsCsv: () => void; // Legacy prop, overridden
  handleExportJson: () => void;
  triggerImport: () => void;
  handleFileImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  coaches: Coach[];
  updateCoachWorkDays: (coach: Coach) => void;
  logs: Log[];
  onSaveCoach: (coach: Coach, email?: string, password?: string) => void;
  onDeleteCoach: (id: string, name: string) => void;
  onOpenBatchBlock: () => void;
  // Inventory Props
  inventories: UserInventory[];
  onUpdateInventory: (inv: UserInventory) => void;
  onDeleteInventory: (id: string) => void;
  onSaveInventory: (inv: UserInventory) => void;
  // New: Handlers for direct action
  onCancelAppointment: (app: Appointment, reason: string) => void;
  onConfirmCompletion: (app: Appointment) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser, onLogout, adminTab, setAdminTab, renderWeeklyCalendar,
  appointments, selectedBatch, toggleBatchSelect, handleBatchDelete,
  handleExportJson, handleFileImport,
  coaches, updateCoachWorkDays, logs, onSaveCoach, onDeleteCoach, onOpenBatchBlock,
  inventories, onDeleteInventory, onSaveInventory, onCancelAppointment, onConfirmCompletion
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Staff Management State
  const [isCoachModalOpen, setIsCoachModalOpen] = useState(false);
  const [editingCoach, setEditingCoach] = useState<Partial<Coach>>({});
  const [newCoachEmail, setNewCoachEmail] = useState('');
  const [newCoachPassword, setNewCoachPassword] = useState('');
  const [isNewCoach, setIsNewCoach] = useState(false);
  
  // Off Date Input State
  const [tempOffDate, setTempOffDate] = useState('');

  // Inventory State
  const [searchQuery, setSearchQuery] = useState('');
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [editingInventory, setEditingInventory] = useState<Partial<UserInventory>>({});
  const [isLineIdLocked, setIsLineIdLocked] = useState(true);

  // Appointment Filter State (New)
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'checked_in' | 'completed' | 'cancelled'>('all');
  const [appSearchTerm, setAppSearchTerm] = useState('');

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Analysis Date Range State (Hidden in UI unless exporting, defaults to current month for visual stats)
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
  const [statsStartDate, setStatsStartDate] = useState(formatDateKey(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate()));
  const [statsEndDate, setStatsEndDate] = useState(formatDateKey(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate()));

  const filteredApps = appointments.filter(a => currentUser.role==='manager' || currentUser.role==='receptionist' || a.coachId === currentUser.id);

  // --- Analysis Calculation (Local with Date Range) ---
  const statsData = useMemo(() => {
    // Filter by date range (inclusive)
    const rangeApps = appointments.filter(a => a.date >= statsStartDate && a.date <= statsEndDate);
    
    // Calculate stats based on rangeApps
    const totalActive = rangeApps.filter(a => a.status === 'confirmed').length;
    const totalCompleted = rangeApps.filter(a => a.status === 'completed').length;
    const totalCancelled = rangeApps.filter(a => a.status === 'cancelled').length;
    
    // Top Slots
    const slotCounts: Record<string, number> = {};
    rangeApps.filter(a => a.status !== 'cancelled').forEach(a => {
        slotCounts[a.time] = (slotCounts[a.time] || 0) + 1;
    });
    const topTimeSlots = Object.entries(slotCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([time, count]) => ({ time, count }));

    // Coach Stats
    const coachStats = coaches.map(c => {
        const cApps = rangeApps.filter(a => a.coachId === c.id && a.status !== 'cancelled');
        const personal = cApps.filter(a => a.type === 'private' || (a.type as string) === 'client').length;
        const group = cApps.filter(a => a.type === 'group').length;
        return {
            id: c.id,
            name: c.name,
            personal,
            group,
            total: personal + group
        };
    });

    return { totalActive, totalCompleted, totalCancelled, topTimeSlots, coachStats, rangeApps };
  }, [appointments, statsStartDate, statsEndDate, coaches]);

  // --- Handlers ---

  const handleRevertStatus = async (app: Appointment) => {
      if (currentUser.role !== 'manager') return;
      if (!window.confirm(`確定要將 ${app.customer?.name || '此課程'} 的狀態從「${app.status === 'checked_in' ? '已簽到' : '已完課'}」還原為「已確認」嗎？`)) return;
      
      try {
          await saveToFirestore('appointments', app.id, { ...app, status: 'confirmed' });
      } catch (e) {
          console.error(e);
          alert('更新失敗');
      }
  };

  const handleUpdateDayConfig = (coach: Coach, dayIndex: number, enabled: boolean, start?: string, end?: string) => {
     const newWorkDays = enabled 
        ? (coach.workDays.includes(dayIndex) ? coach.workDays : [...coach.workDays, dayIndex].sort())
        : coach.workDays.filter(d => d !== dayIndex);
     
     const currentDaily = coach.dailyWorkHours || {};
     let newDaily = { ...currentDaily };
     
     if (enabled && start && end) {
         newDaily[dayIndex.toString()] = { start, end };
     } else if (!enabled) {
         delete newDaily[dayIndex.toString()];
     }

     updateCoachWorkDays({ ...coach, workDays: newWorkDays, dailyWorkHours: newDaily });
  };

  const handleSetThisMonth = () => {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStatsStartDate(formatDateKey(first.getFullYear(), first.getMonth(), first.getDate()));
      setStatsEndDate(formatDateKey(last.getFullYear(), last.getMonth(), last.getDate()));
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
          ...statsData.rangeApps.map(a => [
              a.date, 
              a.time, 
              a.status === 'completed' ? '已完課' : a.status === 'cancelled' ? '已取消' : a.status === 'checked_in' ? '已簽到' : '已預約',
              a.type,
              a.coachName,
              a.customer?.name || '',
              a.cancelReason || a.reason || ''
          ])
      ];

      const csvContent = "\uFEFF" + rows.map(e => e.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `report_${statsStartDate}_to_${statsEndDate}.csv`;
      link.click();
      
      setIsExportModalOpen(false);
  };

  const handleExportCancelCsv = () => {
    const cancelledApps = appointments.filter(a => 
      a.status === 'cancelled' && 
      (currentUser.role === 'manager' || currentUser.role === 'receptionist' || a.coachId === currentUser.id)
    );
    const header = "預約日期,時間,教練,客戶名稱,取消原因,狀態";
    const rows = cancelledApps.map(a => 
      `${a.date},${a.time},${a.coachName},${a.customer?.name || ''},${a.cancelReason || ''},${a.status}`
    );
    const csvContent = "\uFEFF" + [header, ...rows].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cancellations_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  const handleOpenCoachModal = (coach?: Coach) => {
    if (coach) {
        setEditingCoach({ ...coach, offDates: coach.offDates || [] });
        setIsNewCoach(false);
    } else {
        setEditingCoach({
            name: '',
            role: 'coach',
            color: COLOR_OPTIONS[0].value,
            workStart: '09:00',
            workEnd: '21:00',
            workDays: [0, 1, 2, 3, 4, 5, 6],
            offDates: []
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

  // --- Inventory Handlers ---
  const handleOpenInventoryModal = (inv?: UserInventory) => {
      if (currentUser.role !== 'manager' && currentUser.role !== 'receptionist') return;

      if (inv) {
          setEditingInventory({ ...inv });
          setIsLineIdLocked(!!inv.lineUserId); // Lock if ID exists
      } else {
          setEditingInventory({
              name: '',
              phone: '',
              email: '',
              lineUserId: '',
              credits: { private: 0, group: 0 }
          });
          setIsLineIdLocked(false);
      }
      setIsInventoryModalOpen(true);
  };

  const handleSubmitInventory = (e: React.FormEvent) => {
      e.preventDefault();
      if (currentUser.role !== 'manager' && currentUser.role !== 'receptionist') return;
      if (!editingInventory.name) return;
      
      const inventoryToSave = {
          ...editingInventory,
          credits: {
              private: Number(editingInventory.credits?.private || 0),
              group: Number(editingInventory.credits?.group || 0)
          }
      } as UserInventory;

      onSaveInventory(inventoryToSave);
      setIsInventoryModalOpen(false);
  };

  // Filter Logic
  const filteredInventories = inventories.filter(i => 
      i.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (i.phone && i.phone.includes(searchQuery)) ||
      (i.lineUserId && i.lineUserId.includes(searchQuery))
  );

  // Appointment List Logic with Auditing
  const displayAppointments = filteredApps
    .filter(app => {
        // Status Filter
        if (statusFilter !== 'all') {
            if (statusFilter === 'confirmed') return app.status === 'confirmed';
            if (statusFilter === 'checked_in') return app.status === 'checked_in';
            if (statusFilter === 'completed') return app.status === 'completed';
            if (statusFilter === 'cancelled') return app.status === 'cancelled';
        }
        return true;
    })
    .filter(app => {
        // Search Filter
        if (!appSearchTerm) return true;
        const term = appSearchTerm.toLowerCase();
        return (
            (app.customer?.name && app.customer.name.toLowerCase().includes(term)) ||
            (app.customer?.phone && app.customer.phone.includes(term)) ||
            (app.reason && app.reason.toLowerCase().includes(term)) ||
            (app.coachName && app.coachName.toLowerCase().includes(term))
        );
    })
    .sort((a,b)=> { try { return new Date(`${b.date} ${b.time}`).getTime() - new Date(`${a.date} ${a.time}`).getTime() } catch(e){ return 0 } });

  const auditPendingCount = filteredApps.filter(a => a.status === 'checked_in').length;
  const auditCompletedCount = filteredApps.filter(a => a.status === 'completed').length;

  return (
    <div className="max-w-6xl mx-auto p-4 pb-24">
       <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold dark:text-white mb-1">管理後台</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">歡迎回來，{currentUser.name} <span className="bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs px-2 py-0.5 rounded-full ml-1 uppercase">{currentUser.role}</span></p>
          </div>
          <button onClick={onLogout} className="glass-card flex items-center gap-2 text-red-500 px-4 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shadow-sm"><LogOut size={16}/> 登出</button>
       </div>
       
       {/* Checked In Alert - UPDATED UI */}
       {auditPendingCount > 0 && (
           <div 
             className="mb-6 bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-4 text-white shadow-lg flex items-center justify-between animate-pulse"
           >
               <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                       <Timer size={20}/>
                   </div>
                   <div>
                       <div className="font-bold text-lg">等待確認完課</div>
                       <div className="text-sm opacity-90">有 {auditPendingCount} 筆學生已簽到，請核實</div>
                   </div>
               </div>
               <button 
                  onClick={() => { setAdminTab('appointments'); setStatusFilter('checked_in'); }}
                  className="px-4 py-2 bg-white text-orange-600 rounded-xl font-bold text-sm shadow-md hover:bg-orange-50 transition-colors"
               >
                  立即查看
               </button>
           </div>
       )}

       {/* Audit Alert */}
       {currentUser.role === 'manager' && auditCompletedCount > 0 && (
           <div 
             onClick={() => { setAdminTab('appointments'); setStatusFilter('completed'); }}
             className="mb-6 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-4 text-white shadow-lg cursor-pointer hover:scale-[1.01] transition-transform flex items-center justify-between"
           >
               <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                       <ShieldCheck size={20}/>
                   </div>
                   <div>
                       <div className="font-bold text-lg">待處理稽核</div>
                       <div className="text-sm opacity-90">有 {auditCompletedCount} 筆已完課紀錄</div>
                   </div>
               </div>
               <ChevronRight/>
           </div>
       )}

       <div className="glass-panel p-1 rounded-2xl flex gap-1 mb-8 overflow-x-auto mx-auto max-w-full md:max-w-fit shadow-lg custom-scrollbar">
          {['calendar','appointments','analysis','staff','inventory','settings','logs','help'].map(t => {
             if (t === 'staff' && currentUser.role !== 'manager') return null;
             return (
             <button key={t} onClick={()=>setAdminTab(t)} 
                className={`px-5 py-2.5 rounded-xl whitespace-nowrap text-sm font-medium transition-all flex items-center gap-2
                ${adminTab===t ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-white shadow-md transform scale-105' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 hover:bg-white/30'}`}>
               {{
                 calendar: <><Clock size={16}/> 行事曆</>, 
                 appointments: <><List size={16}/> 預約列表</>, 
                 analysis: <><BarChart3 size={16}/> 營運分析</>, 
                 staff: <><Users size={16}/> 員工管理</>,
                 inventory: <><CreditCard size={16}/> 庫存管理</>,
                 settings: <><SettingsIcon size={16}/> 班表設定</>, 
                 logs: <><History size={16}/> 操作紀錄</>,
                 help: <><BookOpen size={16}/> 使用手冊</>
               }[t]}
             </button>
          )})}
       </div>

       {adminTab === 'calendar' && (
         <>
            <div className="flex justify-end mb-4 animate-fadeIn">
                 <button onClick={onOpenBatchBlock} className="flex items-center gap-2 bg-gray-800 text-white dark:bg-white dark:text-gray-900 px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:opacity-90 transition-opacity">
                     <Layers size={16}/> 批次封鎖時段
                 </button>
            </div>
            {renderWeeklyCalendar()}
         </>
       )}
       
       {adminTab === 'appointments' && (
         <div className="glass-panel rounded-3xl shadow-lg p-6">
           <div className="flex flex-col md:flex-row justify-between mb-6 gap-4 items-start md:items-center">
             <h3 className="font-bold text-xl dark:text-white flex items-center gap-2"><List className="text-indigo-500"/> 預約列表</h3>
             
             <div className="flex flex-wrap gap-2 w-full md:w-auto">
                 {/* Search Input */}
                 <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                    <input 
                        type="text"
                        placeholder="搜尋姓名/電話..."
                        className="pl-9 pr-3 py-2 w-full md:w-48 rounded-xl bg-gray-100 dark:bg-gray-800 border-none text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                        value={appSearchTerm}
                        onChange={e => setAppSearchTerm(e.target.value)}
                    />
                 </div>

                 {/* Status Dropdown */}
                 <div className="relative">
                    <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                    <select
                        className="pl-9 pr-8 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 border-none text-sm focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer appearance-none dark:text-white font-bold"
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value as any)}
                    >
                        <option value="all">所有狀態</option>
                        <option value="confirmed">已確認 (未簽到)</option>
                        <option value="checked_in">已簽到 (待核實)</option>
                        <option value="completed">已完課</option>
                        <option value="cancelled">已取消</option>
                    </select>
                    <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 rotate-90"/>
                 </div>

                 {selectedBatch.size > 0 && (
                   <button onClick={handleBatchDelete} className="bg-red-500 text-white px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-lg hover:bg-red-600 transition-colors animate-fadeIn ml-2">
                     <Trash2 size={16}/> 刪除選取 ({selectedBatch.size})
                   </button>
                 )}
             </div>
           </div>

           <div className="space-y-3">
             {displayAppointments.length === 0 ? (
                 <div className="text-center py-12 text-gray-400">
                     <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                         <List size={32} className="opacity-50"/>
                     </div>
                     <p>沒有符合條件的預約</p>
                 </div>
             ) : (
                 displayAppointments.map(app => {
                   const isAnomaly = app.status === 'confirmed' && isPastTime(app.date, app.time);
                   const isAudit = app.status === 'completed';
                   const isCheckedIn = app.status === 'checked_in';
                   // Coach cannot edit/select audit items
                   const isLocked = isAudit && currentUser.role !== 'manager'; 

                   // Helper for status visual
                   const getStatusVisuals = () => {
                       switch(app.status) {
                           case 'checked_in': return { bg: 'bg-orange-50 dark:bg-orange-900/10', border: 'border-orange-200 dark:border-orange-800', badge: 'bg-orange-100 text-orange-600', label: '已簽到' };
                           case 'completed': return { bg: 'bg-emerald-50 dark:bg-emerald-900/10', border: 'border-emerald-200 dark:border-emerald-800', badge: 'bg-emerald-100 text-emerald-600', label: '已完課' };
                           case 'cancelled': return { bg: 'bg-red-50 dark:bg-red-900/10', border: 'border-red-200 dark:border-red-800', badge: 'bg-red-100 text-red-600', label: '已取消' };
                           default: return { bg: 'bg-white dark:bg-gray-800', border: 'border-transparent hover:border-indigo-300 dark:hover:border-indigo-700', badge: 'bg-indigo-100 text-indigo-600', label: '已預約' };
                       }
                   };
                   const visuals = getStatusVisuals();

                   return (
                   <div 
                        key={app.id} 
                        onClick={() => !isLocked && toggleBatchSelect(app.id)}
                        className={`
                            glass-card flex items-center gap-4 p-4 rounded-2xl group transition-all select-none border shadow-sm
                            ${selectedBatch.has(app.id) ? 'border-2 border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/30 shadow-md transform scale-[1.01]' : visuals.border}
                            ${visuals.bg}
                            ${isLocked ? 'cursor-default opacity-80' : 'cursor-pointer'}
                        `}
                    >
                      <div className={`
                            w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0
                            ${selectedBatch.has(app.id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600'}
                            ${isLocked ? 'opacity-30' : ''}
                      `}>
                          {selectedBatch.has(app.id) && <X size={14} className="text-white rotate-45" strokeWidth={3} />}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center gap-3">
                             <span className="font-bold text-lg dark:text-white">{app.date}</span>
                             <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-sm font-medium">{app.time}</span>
                             {isAnomaly && (
                                 <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
                                     <AlertTriangle size={10}/> 未簽到
                                 </span>
                             )}
                          </div>
                          <div className="flex items-center gap-2">
                              {/* ACTION BUTTONS FOR CHECKED IN */}
                              {isCheckedIn && (
                                  <div className="flex gap-2 mr-2">
                                      <button 
                                          onClick={(e) => { e.stopPropagation(); onConfirmCompletion(app); }}
                                          className="text-xs bg-emerald-500 text-white px-3 py-1 rounded-lg flex items-center gap-1 shadow-md hover:bg-emerald-600 transition-colors"
                                      >
                                          <CheckCircle size={12}/> 確認扣點
                                      </button>
                                      <button 
                                          onClick={(e) => { e.stopPropagation(); onCancelAppointment(app, '管理員核實取消(誤觸)'); }}
                                          className="text-xs bg-white border border-gray-200 text-gray-500 px-3 py-1 rounded-lg flex items-center gap-1 shadow-sm hover:bg-gray-100 transition-colors"
                                      >
                                          <X size={12}/> 誤觸取消
                                      </button>
                                  </div>
                              )}

                              {/* Allow reverting status for manager */}
                              {(isAudit || isCheckedIn) && currentUser.role === 'manager' && (
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleRevertStatus(app); }}
                                    className="text-xs bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm transition-colors"
                                  >
                                      <RotateCcw size={10}/> 還原
                                  </button>
                              )}
                              <span className={`text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1 ${visuals.badge}`}>
                                  {app.status === 'completed' && <CheckCircle size={10}/>}
                                  {app.status === 'checked_in' && <Timer size={10}/>}
                                  {visuals.label}
                              </span>
                          </div>
                        </div>
                        <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1"><UserIcon size={12}/> {coaches.find(c => c.id === app.coachId)?.name || app.coachName}</span>
                            <span className="font-bold text-gray-700 dark:text-gray-300">{(app.type as string) ==='client' ? app?.customer?.name : app.reason}</span>
                        </div>
                        {app.customer?.phone && (
                            <div className="text-xs text-gray-400 mt-1 pl-4 border-l-2 border-gray-200 ml-0.5">
                                {app.customer.phone}
                            </div>
                        )}
                      </div>
                   </div>
                 )})
             )}
           </div>
         </div>
       )}

       {/* Export Date Range Modal */}
       {isExportModalOpen && (
           <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
               <div className="glass-panel w-full max-w-sm rounded-3xl p-6 animate-slideUp">
                   <div className="flex justify-between items-start mb-4">
                       <h3 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2">
                           <FileSpreadsheet size={20} className="text-emerald-500"/> 匯出報表
                       </h3>
                       <button onClick={handleSetThisMonth} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg font-bold hover:bg-indigo-100 transition-colors flex items-center gap-1">
                           <Calendar size={12}/> 本月
                       </button>
                   </div>
                   
                   <div className="space-y-3 mb-6">
                       <div>
                           <label className="text-xs font-bold text-gray-500 uppercase block mb-1">開始日期</label>
                           <input 
                               type="date" 
                               value={statsStartDate} 
                               onChange={e => setStatsStartDate(e.target.value)}
                               className="w-full glass-input p-3 rounded-xl text-sm font-bold dark:text-white"
                           />
                       </div>
                       <div>
                           <label className="text-xs font-bold text-gray-500 uppercase block mb-1">結束日期</label>
                           <input 
                               type="date" 
                               value={statsEndDate} 
                               onChange={e => setStatsEndDate(e.target.value)}
                               className="w-full glass-input p-3 rounded-xl text-sm font-bold dark:text-white"
                           />
                       </div>
                   </div>

                   <div className="flex gap-3">
                       <button onClick={() => setIsExportModalOpen(false)} className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 rounded-xl font-bold text-gray-600 dark:text-gray-300">取消</button>
                       <button onClick={handleExportRangeCsv} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2">
                           <Download size={18}/> 下載 CSV
                       </button>
                   </div>
               </div>
           </div>
       )}

       {/* Coach Edit Modal */}
       {isCoachModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4" onClick={() => setIsCoachModalOpen(false)}>
            <div className="glass-panel w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-slideUp border border-white/40 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="bg-white/50 dark:bg-gray-900/50 p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    <h3 className="font-bold text-xl dark:text-white">{isNewCoach ? '新增員工資料' : '編輯員工資料'}</h3>
                    <button onClick={() => setIsCoachModalOpen(false)}><X className="text-gray-500"/></button>
                </div>
                <div className="p-6">
                    <form onSubmit={handleSubmitCoach} className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">姓名</label>
                            <input type="text" required value={editingCoach.name || ''} onChange={e => setEditingCoach({...editingCoach, name: e.target.value})} className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white"/>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">職位</label>
                            <select value={editingCoach.role || 'coach'} onChange={e => setEditingCoach({...editingCoach, role: e.target.value as any})} className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white">
                                <option value="coach">教練 (Coach)</option>
                                <option value="manager">主管 (Manager)</option>
                                <option value="receptionist">櫃檯 (Receptionist)</option>
                            </select>
                        </div>
                        
                        {isNewCoach && (
                            <>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><Mail size={12}/> Email (登入帳號)</label>
                                    <input type="email" required value={newCoachEmail} onChange={e => setNewCoachEmail(e.target.value)} className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white" placeholder="coach@gym.com"/>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><Key size={12}/> 初始密碼</label>
                                    <input type="password" required value={newCoachPassword} onChange={e => setNewCoachPassword(e.target.value)} className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white" placeholder="至少6位數"/>
                                </div>
                            </>
                        )}

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">代表色</label>
                            <div className="grid grid-cols-4 gap-2 mt-2">
                                {COLOR_OPTIONS.map(opt => (
                                    <button 
                                        type="button" 
                                        key={opt.label} 
                                        onClick={() => setEditingCoach({...editingCoach, color: opt.value})}
                                        className={`h-8 rounded-lg border-2 transition-all ${opt.value.split(' ')[0]} ${editingCoach.color === opt.value ? 'border-gray-600 dark:border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                        title={opt.label}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Off Dates Management */}
                        <div className="border-t border-gray-100 dark:border-gray-700 pt-4 mt-2">
                           <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2 mb-2"><CalendarX size={14}/> 特定日期休假 (Off Dates)</label>
                           <div className="flex gap-2 mb-2">
                               <input 
                                  type="date" 
                                  className="flex-1 glass-input rounded-xl p-2 text-sm dark:text-white" 
                                  value={tempOffDate} 
                                  onChange={e => setTempOffDate(e.target.value)}
                               />
                               <button 
                                  type="button" 
                                  onClick={handleAddOffDate}
                                  className="bg-gray-200 dark:bg-gray-700 px-3 rounded-xl font-bold text-sm hover:bg-gray-300 dark:hover:bg-gray-600"
                               >
                                  新增
                               </button>
                           </div>
                           <div className="flex flex-wrap gap-2">
                               {editingCoach.offDates?.map(date => (
                                   <div key={date} className="flex items-center gap-1 bg-red-50 dark:bg-red-900/20 text-red-500 px-2 py-1 rounded-lg text-xs font-bold">
                                       {date}
                                       <button type="button" onClick={() => handleRemoveOffDate(date)} className="hover:text-red-700"><X size={12}/></button>
                                   </div>
                               ))}
                               {(!editingCoach.offDates || editingCoach.offDates.length === 0) && (
                                   <span className="text-xs text-gray-400 italic">無設定休假日</span>
                               )}
                           </div>
                        </div>

                        <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg mt-4">儲存</button>
                    </form>
                </div>
            </div>
        </div>
       )}
    </div>
  );
};

export default AdminDashboard;
