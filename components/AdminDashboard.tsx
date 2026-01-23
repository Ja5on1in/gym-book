
import React, { useRef, useState, useMemo } from 'react';
import { LogOut, Trash2, FileSpreadsheet, Database, Clock, ChevronRight, FileWarning, BarChart3, List, Settings as SettingsIcon, History, User as UserIcon, Users, Plus, Edit2, X, Mail, Key, CalendarX, Layers, CreditCard, Search, Lock, Unlock, Save, AlertTriangle, CheckCircle, RotateCcw, ShieldCheck, Download, Timer } from 'lucide-react';
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
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser, onLogout, adminTab, setAdminTab, renderWeeklyCalendar,
  appointments, selectedBatch, toggleBatchSelect, handleBatchDelete,
  handleExportJson, handleFileImport,
  coaches, updateCoachWorkDays, logs, onSaveCoach, onDeleteCoach, onOpenBatchBlock,
  inventories, onDeleteInventory, onSaveInventory
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

  // Appointment Filter State
  const [appointmentFilter, setAppointmentFilter] = useState<'all' | 'anomaly' | 'audit' | 'checked_in'>('all');

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
    const header = "預約日期,時間,教練,客戶名稱,取消原因";
    const rows = cancelledApps.map(a => 
      `${a.date},${a.time},${a.coachName},${a.customer?.name || ''},${a.cancelReason || ''}`
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
        if (appointmentFilter === 'anomaly') {
            // Anomaly: Confirmed BUT Past time (Should be completed or cancelled)
            return app.status === 'confirmed' && isPastTime(app.date, app.time);
        }
        if (appointmentFilter === 'audit') {
            // Audit: Completed
            return app.status === 'completed';
        }
        if (appointmentFilter === 'checked_in') {
            // Pending: Checked In
            return app.status === 'checked_in';
        }
        return true;
    })
    .sort((a,b)=> { try { return new Date(`${b.date} ${b.time}`).getTime() - new Date(`${a.date} ${a.time}`).getTime() } catch(e){ return 0 } });

  const auditPendingCount = filteredApps.filter(a => a.status === 'completed').length;
  const checkedInCount = filteredApps.filter(a => a.status === 'checked_in').length;

  return (
    <div className="max-w-6xl mx-auto p-4 pb-24">
       <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold dark:text-white mb-1">管理後台</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">歡迎回來，{currentUser.name} <span className="bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs px-2 py-0.5 rounded-full ml-1 uppercase">{currentUser.role}</span></p>
          </div>
          <button onClick={onLogout} className="glass-card flex items-center gap-2 text-red-500 px-4 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shadow-sm"><LogOut size={16}/> 登出</button>
       </div>
       
       {/* Checked In Alert */}
       {checkedInCount > 0 && (
           <div 
             onClick={() => { setAdminTab('appointments'); setAppointmentFilter('checked_in'); }}
             className="mb-6 bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-4 text-white shadow-lg cursor-pointer hover:scale-[1.01] transition-transform flex items-center justify-between animate-pulse"
           >
               <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                       <Timer size={20}/>
                   </div>
                   <div>
                       <div className="font-bold text-lg">等待確認完課</div>
                       <div className="text-sm opacity-90">有 {checkedInCount} 筆學生已簽到，請核實</div>
                   </div>
               </div>
               <ChevronRight/>
           </div>
       )}

       {/* Audit Alert */}
       {currentUser.role === 'manager' && auditPendingCount > 0 && (
           <div 
             onClick={() => { setAdminTab('appointments'); setAppointmentFilter('audit'); }}
             className="mb-6 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-4 text-white shadow-lg cursor-pointer hover:scale-[1.01] transition-transform flex items-center justify-between"
           >
               <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                       <ShieldCheck size={20}/>
                   </div>
                   <div>
                       <div className="font-bold text-lg">待處理稽核</div>
                       <div className="text-sm opacity-90">有 {auditPendingCount} 筆已完課紀錄</div>
                   </div>
               </div>
               <ChevronRight/>
           </div>
       )}

       <div className="glass-panel p-1 rounded-2xl flex gap-1 mb-8 overflow-x-auto mx-auto max-w-full md:max-w-fit shadow-lg custom-scrollbar">
          {['calendar','appointments','analysis','staff','inventory','settings','logs'].map(t => {
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
                 logs: <><History size={16}/> 操作紀錄</>
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
             
             <div className="flex flex-wrap gap-2">
                 <button 
                    onClick={() => setAppointmentFilter('all')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${appointmentFilter === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200'}`}
                 >
                    全部
                 </button>
                 <button 
                    onClick={() => setAppointmentFilter('checked_in')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 ${appointmentFilter === 'checked_in' ? 'bg-orange-500 text-white shadow-md' : 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 hover:bg-orange-100'}`}
                 >
                    <Timer size={16}/> 已簽到
                 </button>
                 <button 
                    onClick={() => setAppointmentFilter('audit')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 ${appointmentFilter === 'audit' ? 'bg-emerald-500 text-white shadow-md' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 hover:bg-emerald-100'}`}
                 >
                    <ShieldCheck size={16}/> 已完課
                 </button>
                 <button 
                    onClick={() => setAppointmentFilter('anomaly')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 ${appointmentFilter === 'anomaly' ? 'bg-red-500 text-white shadow-md' : 'bg-red-50 text-red-500 dark:bg-red-900/20 hover:bg-red-100'}`}
                 >
                    <AlertTriangle size={16}/> 異常 (過期未簽)
                 </button>

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

                   return (
                   <div 
                        key={app.id} 
                        onClick={() => !isLocked && toggleBatchSelect(app.id)}
                        className={`
                            glass-card flex items-center gap-4 p-4 rounded-2xl group transition-all select-none border
                            ${selectedBatch.has(app.id) 
                                ? 'border-2 border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/30 shadow-md transform scale-[1.01]' 
                                : isAnomaly 
                                    ? 'border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-900/10'
                                    : isAudit
                                        ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-900/10'
                                        : isCheckedIn
                                            ? 'border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-900/20'
                                            : 'border-transparent hover:border-indigo-300 dark:hover:border-indigo-700'
                            }
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
                              {/* Allow reverting status for manager */}
                              {(isAudit || isCheckedIn) && currentUser.role === 'manager' && (
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleRevertStatus(app); }}
                                    className="text-xs bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm transition-colors"
                                  >
                                      <RotateCcw size={10}/> 還原狀態
                                  </button>
                              )}
                              <span className={`text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1 ${
                                  app.status === 'cancelled' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 
                                  app.status === 'completed' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                  app.status === 'checked_in' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' :
                                  'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                              }`}>
                                  {app.status === 'completed' && <CheckCircle size={10}/>}
                                  {app.status === 'cancelled' ? '已取消' : app.status === 'completed' ? '已完課' : app.status === 'checked_in' ? '已簽到' : '已確認'}
                              </span>
                          </div>
                        </div>
                        <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                            <span>{coaches.find(c => c.id === app.coachId)?.name || app.coachName || '(已移除教練)'}</span>
                            <span className="font-medium text-indigo-600 dark:text-indigo-400">{(app.type as string) ==='client' ? app?.customer?.name : app.reason}</span>
                        </div>
                      </div>
                   </div>
                 )})
             )}
           </div>
         </div>
       )}

       {adminTab === 'inventory' && (
          <div className="glass-panel rounded-3xl shadow-lg p-6">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                  <h3 className="font-bold text-xl dark:text-white flex items-center gap-2"><CreditCard className="text-indigo-500"/> 庫存管理 {currentUser.role !== 'manager' && currentUser.role !== 'receptionist' && <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full ml-2">檢視模式</span>}</h3>
                  <div className="flex gap-2 w-full md:w-auto">
                      <div className="relative flex-1 md:flex-initial">
                          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                          <input 
                              type="text" 
                              placeholder="搜尋姓名、電話或 ID..." 
                              className="pl-10 pr-4 py-2 bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl w-full md:w-64 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all dark:text-white"
                              value={searchQuery}
                              onChange={e => setSearchQuery(e.target.value)}
                          />
                      </div>
                      {/* Only Manager/Receptionist can Add */}
                      {['manager', 'receptionist'].includes(currentUser.role) && (
                          <button onClick={() => handleOpenInventoryModal()} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all flex items-center gap-2 whitespace-nowrap">
                              <Plus size={16}/> 新增學員
                          </button>
                      )}
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredInventories.length === 0 ? (
                      <div className="col-span-full py-12 text-center text-gray-400 bg-gray-50/50 dark:bg-gray-800/30 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                          <UserIcon size={48} className="mx-auto mb-4 opacity-50"/>
                          <p className="font-medium">找不到符合的學員資料</p>
                          {['manager', 'receptionist'].includes(currentUser.role) && (
                            <button onClick={() => handleOpenInventoryModal()} className="mt-4 text-indigo-500 font-bold hover:underline">新增一筆？</button>
                          )}
                      </div>
                  ) : (
                      filteredInventories.map(inv => (
                          <div key={inv.id} className="glass-card p-5 rounded-2xl border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-all group">
                              <div className="flex justify-between items-start mb-3">
                                  <div>
                                      <h4 className="font-bold text-lg dark:text-white flex items-center gap-2">
                                          {inv.name}
                                          {inv.lineUserId ? <span className="w-2 h-2 rounded-full bg-[#06C755]" title="已綁定 LINE"></span> : <span className="w-2 h-2 rounded-full bg-gray-300" title="未綁定 LINE"></span>}
                                      </h4>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">{inv.phone || '無電話'}</p>
                                  </div>
                                  {/* Only Manager/Receptionist can Edit/Delete */}
                                  {['manager', 'receptionist'].includes(currentUser.role) && (
                                      <div className="flex gap-1">
                                          <button onClick={() => handleOpenInventoryModal(inv)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"><Edit2 size={16}/></button>
                                          <button onClick={() => { if(window.confirm(`確定刪除 ${inv.name} 嗎？此動作無法復原。`)) onDeleteInventory(inv.id) }} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                      </div>
                                  )}
                              </div>
                              
                              <div className="grid grid-cols-2 gap-2 mb-3">
                                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-xl text-center">
                                      <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">私人課</div>
                                      <div className={`font-bold text-lg ${inv.credits.private > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}>{inv.credits.private}</div>
                                  </div>
                                  <div className="bg-orange-50 dark:bg-orange-900/20 p-2 rounded-xl text-center">
                                      <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">團課</div>
                                      <div className={`font-bold text-lg ${inv.credits.group > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400'}`}>{inv.credits.group}</div>
                                  </div>
                              </div>

                              <div className="text-[10px] text-gray-400 text-right">
                                  更新於: {new Date(inv.lastUpdated).toLocaleDateString()}
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </div>
       )}

       {adminTab === 'analysis' && (
          <div className="space-y-6 animate-slideUp">
            
            <div className="flex justify-end gap-3">
               <button onClick={handleExportCancelCsv} className="glass-card flex items-center gap-2 text-red-500 px-4 py-2 rounded-xl text-sm hover:bg-red-50 transition-colors shadow-sm"><FileWarning size={16}/> 匯出取消明細</button>
               <button onClick={() => setIsExportModalOpen(true)} className="bg-emerald-500 text-white flex items-center gap-2 px-4 py-2 rounded-xl text-sm shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 transition-all"><FileSpreadsheet size={16}/> 匯出區間報表</button>
            </div>
            
            {/* Visual stats default to current range or whatever is in state, but inputs are hidden */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="glass-panel p-6 rounded-3xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10"><BarChart3 size={100} className="text-orange-500"/></div>
                  <h4 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><Clock size={18} className="text-orange-500"/> 熱門時段 (目前顯示: {statsStartDate}~{statsEndDate})</h4>
                  <div className="space-y-3 relative z-10">
                    {statsData.topTimeSlots.length > 0 ? statsData.topTimeSlots.map((s: any, i: number) => (
                        <div key={s.time} className="flex justify-between items-center p-3 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-white/40 dark:border-gray-700">
                            <span className="font-bold text-orange-600 dark:text-orange-400">#{i+1} {s.time}</span>
                            <span className="text-sm font-medium">{s.count} 堂</span>
                        </div>
                    )) : <div className="text-center text-gray-400 text-sm py-4">無數據</div>}
                  </div>
               </div>
               
               <div className="glass-panel p-6 rounded-3xl flex flex-col justify-center">
                  <h4 className="font-bold text-gray-800 dark:text-white mb-4 text-center">狀態總覽</h4>
                  <div className="grid grid-cols-3 gap-2 text-center divide-x divide-gray-200 dark:divide-gray-700">
                     <div>
                         <div className="text-3xl lg:text-4xl font-bold text-indigo-500 mb-1">{statsData.totalActive}</div>
                         <div className="text-[10px] font-bold text-gray-400 uppercase">預約中</div>
                     </div>
                     <div>
                         <div className="text-3xl lg:text-4xl font-bold text-emerald-500 mb-1">{statsData.totalCompleted}</div>
                         <div className="text-[10px] font-bold text-gray-400 uppercase">已完課</div>
                     </div>
                     <div>
                         <div className="text-3xl lg:text-4xl font-bold text-red-500 mb-1">{statsData.totalCancelled}</div>
                         <div className="text-[10px] font-bold text-gray-400 uppercase">已取消</div>
                     </div>
                  </div>
               </div>

               <div className="glass-panel p-6 rounded-3xl md:col-span-1">
                  <h4 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><UserIcon size={18} className="text-purple-500"/> 課程統計</h4>
                  <div className="overflow-y-auto max-h-[200px] custom-scrollbar pr-2">
                      <div className="grid grid-cols-4 gap-2 text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">
                          <span>教練</span>
                          <span className="text-right">個人</span>
                          <span className="text-right">團課</span>
                          <span className="text-right">總計</span>
                      </div>
                      {(currentUser.role === 'manager' 
                          ? statsData.coachStats 
                          : statsData.coachStats.filter((s: any) => s.id === currentUser.id)
                       ).map((c: any) => (
                        <div key={c.id} className="grid grid-cols-4 gap-2 text-sm py-2 border-b border-gray-100 dark:border-gray-700 last:border-0 items-center">
                            <span className="truncate font-medium dark:text-gray-200">{c.name}</span>
                            <span className="text-right text-gray-500">{c.personal}</span>
                            <span className="text-right text-gray-500">{c.group}</span>
                            <span className="text-right font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 rounded px-1">{c.total}</span>
                        </div>
                      ))}
                  </div>
               </div>
            </div>
          </div>
       )}

       {adminTab === 'staff' && currentUser.role === 'manager' && (
          <div className="glass-panel rounded-3xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-xl dark:text-white flex items-center gap-2"><Users className="text-indigo-500"/> 員工管理</h3>
                <button onClick={() => handleOpenCoachModal()} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all">
                    <Plus size={16}/> 新增教練
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {coaches.map(coach => (
                    <div key={coach.id} className="glass-card p-4 rounded-2xl relative group hover:shadow-lg transition-all border border-gray-100 dark:border-gray-700">
                        <div className={`absolute top-0 left-0 w-2 h-full rounded-l-2xl ${coach.color.split(' ')[0]}`}></div>
                        <div className="pl-4 flex justify-between items-start">
                            <div>
                                <h4 className="font-bold text-lg dark:text-white mb-1">{coach.name}</h4>
                                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 mb-1">
                                    <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 uppercase">{coach.role}</span>
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
                                <button onClick={() => handleOpenCoachModal(coach)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"><Edit2 size={16}/></button>
                                <button onClick={() => onDeleteCoach(coach.id, coach.name)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
          </div>
       )}

       {adminTab === 'settings' && (
          <div className="space-y-6">
             {currentUser.role === 'manager' && (
               <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 rounded-3xl shadow-lg text-white flex justify-between items-center">
                  <span className="font-bold flex items-center gap-3 text-lg"><Database size={24}/> 資料庫管理</span>
                  <div className="flex gap-3">
                    <button onClick={handleExportJson} className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-4 py-2 rounded-xl text-sm border border-white/30 transition-all">匯出備份</button>
                    <button onClick={() => fileInputRef.current?.click()} className="bg-white text-indigo-600 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-gray-50 transition-all">匯入資料</button>
                    <input type="file" ref={fileInputRef} onChange={handleFileImport} className="hidden"/>
                  </div>
               </div>
             )}
             {coaches.map(c => {
               if (currentUser.role === 'coach' && currentUser.id !== c.id) return null;
               return (
               <div key={c.id} className="glass-panel p-6 rounded-3xl shadow-sm">
                  <div className="font-bold mb-6 dark:text-white flex items-center gap-3 text-xl border-b border-gray-100 dark:border-gray-700 pb-4">
                     <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600"><Clock size={20}/></div>
                     {c.name} 班表設定
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                     {['日','一','二','三','四','五','六'].map((d, i) => {
                       const isWorkDay = c.workDays?.includes(i);
                       const hours = c.dailyWorkHours?.[i.toString()] || { start: c.workStart, end: c.workEnd };
                       return (
                         <div key={i} className={`p-4 rounded-2xl border transition-all duration-300 ${isWorkDay ? 'border-indigo-200 bg-indigo-50/50 dark:bg-indigo-900/10 dark:border-indigo-800' : 'border-gray-100 bg-gray-50/50 dark:bg-gray-800/50 dark:border-gray-700 opacity-60'}`}>
                           <div className="flex items-center justify-between">
                             <div className="flex items-center gap-4">
                                <button 
                                  onClick={() => handleUpdateDayConfig(c, i, !isWorkDay, hours.start, hours.end)}
                                  className={`w-12 h-7 rounded-full transition-colors relative shadow-inner ${isWorkDay ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                                >
                                  <div className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-sm transition-transform duration-300 ${isWorkDay ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                </button>
                                <span className={`font-bold ${isWorkDay ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}`}>星期{d}</span>
                             </div>
                             {!isWorkDay && <span className="text-xs font-medium text-gray-400 bg-white dark:bg-gray-700 px-2 py-1 rounded">休假</span>}
                           </div>
                           
                           {isWorkDay && (
                             <div className="mt-4 flex items-center gap-2 bg-white/70 dark:bg-gray-700/50 p-2 rounded-xl border border-gray-100 dark:border-gray-600 shadow-sm">
                               <Clock size={14} className="text-gray-400 ml-1"/>
                               <select 
                                 value={hours.start} 
                                 onChange={(e) => handleUpdateDayConfig(c, i, true, e.target.value, hours.end)}
                                 className="flex-1 bg-transparent text-sm font-medium text-gray-700 dark:text-gray-200 outline-none cursor-pointer text-center"
                               >
                                 {ALL_TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                               </select>
                               <ChevronRight size={14} className="text-gray-300"/>
                               <select 
                                 value={hours.end} 
                                 onChange={(e) => handleUpdateDayConfig(c, i, true, hours.start, e.target.value)}
                                 className="flex-1 bg-transparent text-sm font-medium text-gray-700 dark:text-gray-200 outline-none cursor-pointer text-center"
                               >
                                 {ALL_TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                               </select>
                             </div>
                           )}
                         </div>
                       );
                     })}
                  </div>
               </div>
               );
             })}
          </div>
       )}
       
       {adminTab === 'logs' && (
          <div className="glass-panel rounded-3xl shadow-lg p-6 h-[600px] overflow-y-auto custom-scrollbar">
             <h3 className="font-bold text-xl mb-6 dark:text-white flex items-center gap-2"><History className="text-gray-500"/> 系統日誌</h3>
             <div className="space-y-4">
             {logs.filter(log => currentUser.role === 'manager' || log.user === currentUser.name).map(log => (
                <div key={log.id} className="relative pl-6 pb-2 border-l-2 border-gray-200 dark:border-gray-700 last:border-0">
                   <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white dark:bg-gray-800 border-2 border-indigo-400"></div>
                   <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mb-1">
                      <span>{new Date(log.time).toLocaleString()}</span>
                      <span>{log.user}</span>
                   </div>
                   <div className="glass-card p-3 rounded-xl">
                       <div className="font-bold text-gray-800 dark:text-gray-200 mb-1">{log.action}</div>
                       <div className="text-sm text-gray-600 dark:text-gray-400">{log.details}</div>
                   </div>
                </div>
             ))}
             </div>
          </div>
       )}

       {/* Export Date Range Modal */}
       {isExportModalOpen && (
           <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
               <div className="glass-panel w-full max-w-sm rounded-3xl p-6 animate-slideUp">
                   <h3 className="font-bold text-lg mb-4 text-gray-800 dark:text-white flex items-center gap-2"><FileSpreadsheet size={20} className="text-emerald-500"/> 匯出報表</h3>
                   
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

       {/* Inventory Edit Modal */}
       {isInventoryModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4" onClick={() => setIsInventoryModalOpen(false)}>
              <div className="glass-panel w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-slideUp border border-white/40" onClick={e => e.stopPropagation()}>
                  <div className="bg-white/50 dark:bg-gray-900/50 p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                      <h3 className="font-bold text-xl dark:text-white">{editingInventory.id ? '編輯學員資料' : '新增學員'}</h3>
                      <button onClick={() => setIsInventoryModalOpen(false)}><X className="text-gray-500"/></button>
                  </div>
                  <form onSubmit={handleSubmitInventory} className="p-6 space-y-4">
                      <div>
                          <label className="text-xs font-bold text-gray-500 uppercase">姓名</label>
                          <input 
                              type="text" 
                              required 
                              className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white"
                              value={editingInventory.name} 
                              onChange={e => setEditingInventory({...editingInventory, name: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-gray-500 uppercase">電話</label>
                          <input 
                              type="tel" 
                              className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white"
                              value={editingInventory.phone} 
                              onChange={e => setEditingInventory({...editingInventory, phone: e.target.value})}
                              placeholder="0912345678"
                          />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                              LINE User ID {isLineIdLocked && <Lock size={12} className="text-orange-500"/>}
                          </label>
                          <input 
                              type="text" 
                              className={`w-full glass-input rounded-xl p-3 mt-1 dark:text-white ${isLineIdLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                              value={editingInventory.lineUserId || ''} 
                              onChange={e => setEditingInventory({...editingInventory, lineUserId: e.target.value})}
                              disabled={isLineIdLocked}
                              placeholder="U12345678..."
                          />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100 dark:border-gray-700">
                          <div>
                              <label className="text-xs font-bold text-indigo-500 uppercase">私人課 (剩餘點數)</label>
                              <div className="flex items-center gap-2 mt-1">
                                  <button type="button" onClick={() => setEditingInventory({...editingInventory, credits: {...editingInventory.credits, private: Math.max(0, (editingInventory.credits?.private || 0) - 1)} as any})} className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold hover:bg-gray-300 dark:hover:bg-gray-600">-</button>
                                  <input 
                                      type="number" 
                                      className="w-full glass-input rounded-lg p-2 text-center font-bold dark:text-white"
                                      value={editingInventory.credits?.private || 0}
                                      onChange={e => setEditingInventory({...editingInventory, credits: {...editingInventory.credits, private: Number(e.target.value)} as any})}
                                  />
                                  <button type="button" onClick={() => setEditingInventory({...editingInventory, credits: {...editingInventory.credits, private: (editingInventory.credits?.private || 0) + 1} as any})} className="w-8 h-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center font-bold hover:bg-indigo-600">+</button>
                              </div>
                          </div>
                          <div>
                              <label className="text-xs font-bold text-orange-500 uppercase">團課 (剩餘點數)</label>
                              <div className="flex items-center gap-2 mt-1">
                                  <button type="button" onClick={() => setEditingInventory({...editingInventory, credits: {...editingInventory.credits, group: Math.max(0, (editingInventory.credits?.group || 0) - 1)} as any})} className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold hover:bg-gray-300 dark:hover:bg-gray-600">-</button>
                                  <input 
                                      type="number" 
                                      className="w-full glass-input rounded-lg p-2 text-center font-bold dark:text-white"
                                      value={editingInventory.credits?.group || 0}
                                      onChange={e => setEditingInventory({...editingInventory, credits: {...editingInventory.credits, group: Number(e.target.value)} as any})}
                                  />
                                  <button type="button" onClick={() => setEditingInventory({...editingInventory, credits: {...editingInventory.credits, group: (editingInventory.credits?.group || 0) + 1} as any})} className="w-8 h-8 rounded-lg bg-orange-500 text-white flex items-center justify-center font-bold hover:bg-orange-600">+</button>
                              </div>
                          </div>
                      </div>

                      <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg mt-4">儲存變更</button>
                  </form>
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
