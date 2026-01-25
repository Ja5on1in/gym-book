
import React, { useRef, useState } from 'react';
import { LogOut, Trash2, FileSpreadsheet, Database, Clock, ChevronRight, FileWarning, BarChart3, List, Settings as SettingsIcon, History, User as UserIcon, Users, Plus, Edit2, X, Mail, Key, CalendarX, Layers, CreditCard, Search, BookOpen, Menu, LayoutDashboard, Dumbbell, Save, Activity, CheckCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import { User, Appointment, Coach, Log, UserInventory, WorkoutPlan } from '../types';
import { ALL_TIME_SLOTS, COLOR_OPTIONS } from '../constants';
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
  onSaveWorkoutPlan?: any; // Legacy prop support
  onDeleteWorkoutPlan?: any; // Legacy prop support
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser, onLogout, adminTab, setAdminTab, renderWeeklyCalendar,
  appointments, selectedBatch, toggleBatchSelect, handleBatchDelete,
  analysis, handleExportStatsCsv, handleExportJson, triggerImport, handleFileImport,
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

  // Inventory Management State
  const [searchQuery, setSearchQuery] = useState('');
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [editingInventory, setEditingInventory] = useState<UserInventory | null>(null);
  const [inventoryForm, setInventoryForm] = useState<{private: number, group: number, name: string, phone: string}>({ private: 0, group: 0, name: '', phone: '' });

  const filteredApps = appointments.filter(a => currentUser.role==='manager' || a.coachId === currentUser.id);

  const filteredInventories = inventories.filter(i => 
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (i.phone && i.phone.includes(searchQuery)) || 
    (i.lineUserId && i.lineUserId.includes(searchQuery))
  );

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

  const handleExportCancelCsv = () => {
    const cancelledApps = appointments.filter(a => 
      a.status === 'cancelled' && 
      (currentUser.role === 'manager' || a.coachId === currentUser.id)
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

  // Inventory Modal Handlers
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

  // Navigation Config
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
          { id: 'staff', icon: Users, label: '員工管理', role: 'manager' },
          { id: 'analysis', icon: BarChart3, label: '營運分析' },
          { id: 'logs', icon: History, label: '操作紀錄' },
          { id: 'settings', icon: SettingsIcon, label: '班表設定' },
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
                   <LayoutDashboard className="fill-indigo-600 text-indigo-600"/> GymBooker
               </h1>
               <div className="text-xs text-slate-500 font-medium px-1">Professional Admin</div>
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
           {/* Mobile Sidebar Backdrop */}
           {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>}

           {/* Tab Content */}
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
                   <div className="space-y-3">
                     {filteredApps.sort((a,b)=> { try { return new Date(`${a.date} ${a.time}`).getTime() - new Date(`${b.date} ${b.time}`).getTime() } catch(e){ return 0 } }).map(app => (
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
                                w-5 h-5 rounded border flex items-center justify-center transition-colors
                                ${selectedBatch.has(app.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white dark:bg-slate-800 dark:border-slate-600'}
                          `}>
                              {selectedBatch.has(app.id) && <X size={14} className="text-white rotate-45" strokeWidth={3} />}
                          </div>
                          
                          <div className="flex-1 pointer-events-none">
                            <div className="flex justify-between items-center mb-1">
                              <div className="flex items-center gap-3">
                                 <span className="font-bold text-lg dark:text-white">{app.date}</span>
                                 <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-sm font-medium">{app.time}</span>
                              </div>
                              <span className={`text-xs px-3 py-1 rounded-full font-bold ${app.status==='cancelled'?'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400':'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'}`}>
                                  {app.status === 'cancelled' ? '已取消' : '已確認'}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
                                <span>{coaches.find(c => c.id === app.coachId)?.name || app.coachName || '(已移除教練)'}</span>
                                <span className="font-medium text-indigo-600 dark:text-indigo-400">{(app.type as string) ==='client' ? app?.customer?.name : app.reason}</span>
                            </div>
                          </div>
                       </div>
                     ))}
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
                                  className="pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 w-full md:w-64 focus:ring-2 focus:ring-indigo-500 outline-none"
                                  value={searchQuery}
                                  onChange={e => setSearchQuery(e.target.value)}
                              />
                          </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {filteredInventories.map(inv => {
                              const canEdit = ['manager', 'receptionist'].includes(currentUser.role);
                              return (
                                  <div 
                                    key={inv.id} 
                                    onClick={() => canEdit && handleOpenInventoryModal(inv)}
                                    className={`glass-card p-6 rounded-2xl border border-slate-100 dark:border-slate-700 transition-all hover:shadow-lg hover:scale-[1.02] group ${canEdit ? 'cursor-pointer' : ''}`}
                                  >
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
                                              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">私人課 (Private)</div>
                                              <div className="font-bold text-2xl text-indigo-600 dark:text-indigo-400">{inv.credits.private}</div>
                                          </div>
                                          <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20">
                                              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">團體課 (Group)</div>
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
                    <div className="flex justify-end gap-3">
                       <button onClick={handleExportCancelCsv} className="glass-card flex items-center gap-2 text-red-500 px-4 py-2 rounded-xl text-sm hover:bg-red-50 transition-colors shadow-sm"><FileWarning size={16}/> 匯出取消明細</button>
                       <button onClick={handleExportStatsCsv} className="bg-emerald-500 text-white flex items-center gap-2 px-4 py-2 rounded-xl text-sm shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 transition-all"><FileSpreadsheet size={16}/> 匯出報表</button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       <div className="glass-panel p-6 rounded-3xl relative overflow-hidden border border-white/60">
                          <div className="absolute top-0 right-0 p-4 opacity-10"><BarChart3 size={100} className="text-orange-500"/></div>
                          <h4 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><Clock size={18} className="text-orange-500"/> 熱門時段 Top 3</h4>
                          <div className="space-y-3 relative z-10">
                            {analysis.topTimeSlots.map((s: any, i: number) => (
                                <div key={s.time} className="flex justify-between items-center p-3 bg-white/50 dark:bg-slate-800/50 rounded-xl border border-white/40 dark:border-slate-700">
                                    <span className="font-bold text-orange-600 dark:text-orange-400">#{i+1} {s.time}</span>
                                    <span className="text-sm font-medium">{s.count} 堂</span>
                                </div>
                            ))}
                          </div>
                       </div>
                       
                       <div className="glass-panel p-6 rounded-3xl flex flex-col justify-center border border-white/60">
                          <h4 className="font-bold text-slate-800 dark:text-white mb-4 text-center">預約狀態總覽</h4>
                          <div className="flex justify-around items-center">
                             <div className="text-center">
                                 <div className="text-5xl font-bold text-emerald-500 mb-2 drop-shadow-sm">{analysis.totalActive}</div>
                                 <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">有效預約</div>
                             </div>
                             <div className="h-16 w-px bg-slate-200 dark:bg-slate-700"></div>
                             <div className="text-center">
                                 <div className="text-5xl font-bold text-red-500 mb-2 drop-shadow-sm">{analysis.totalCancelled}</div>
                                 <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">已取消</div>
                             </div>
                          </div>
                       </div>

                       <div className="glass-panel p-6 rounded-3xl md:col-span-1 border border-white/60">
                          <h4 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><UserIcon size={18} className="text-purple-500"/> 課程統計 (本月)</h4>
                          <div className="overflow-y-auto max-h-[200px] custom-scrollbar pr-2">
                              <div className="grid grid-cols-4 gap-2 text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">
                                  <span>教練</span>
                                  <span className="text-right">個人</span>
                                  <span className="text-right">團課</span>
                                  <span className="text-right">總計</span>
                              </div>
                              {(currentUser.role === 'manager' 
                                  ? analysis.coachStats 
                                  : analysis.coachStats.filter((s: any) => s.id === currentUser.id)
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

               {adminTab === 'staff' && currentUser.role === 'manager' && (
                  <div className="glass-panel rounded-3xl shadow-lg p-6 border border-white/60">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-xl dark:text-white flex items-center gap-2"><Users className="text-indigo-500"/> 員工管理</h3>
                        <button onClick={() => handleOpenCoachModal()} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all">
                            <Plus size={16}/> 新增教練
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
               )}

               {adminTab === 'settings' && (
                  <div className="space-y-6">
                     {currentUser.role === 'manager' && (
                       <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 rounded-3xl shadow-lg text-white flex justify-between items-center">
                          <span className="font-bold flex items-center gap-3 text-lg"><Database size={24}/> 資料庫管理</span>
                          <div className="flex gap-3">
                            <button onClick={handleExportJson} className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-4 py-2 rounded-xl text-sm border border-white/30 transition-all">匯出備份</button>
                            <button onClick={() => fileInputRef.current?.click()} className="bg-white text-indigo-600 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-all">匯入資料</button>
                            <input type="file" ref={fileInputRef} onChange={handleFileImport} className="hidden"/>
                          </div>
                       </div>
                     )}
                     {coaches.map(c => {
                       if (currentUser.role === 'coach' && currentUser.id !== c.id) return null;
                       return (
                       <div key={c.id} className="glass-panel p-6 rounded-3xl shadow-sm border border-white/60">
                          <div className="font-bold mb-6 dark:text-white flex items-center gap-3 text-xl border-b border-slate-100 dark:border-slate-700 pb-4">
                             <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600"><Clock size={20}/></div>
                             {c.name} 班表設定
                          </div>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                             {['日','一','二','三','四','五','六'].map((d, i) => {
                               const isWorkDay = c.workDays?.includes(i);
                               const hours = c.dailyWorkHours?.[i.toString()] || { start: c.workStart, end: c.workEnd };
                               return (
                                 <div key={i} className={`p-4 rounded-2xl border transition-all duration-300 ${isWorkDay ? 'border-indigo-200 bg-indigo-50/50 dark:bg-indigo-900/10 dark:border-indigo-800' : 'border-slate-100 bg-slate-50/50 dark:bg-slate-800/50 dark:border-slate-700 opacity-60'}`}>
                                   <div className="flex items-center justify-between">
                                     <div className="flex items-center gap-4">
                                        <button 
                                          onClick={() => handleUpdateDayConfig(c, i, !isWorkDay, hours.start, hours.end)}
                                          className={`w-12 h-7 rounded-full transition-colors relative shadow-inner ${isWorkDay ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                                        >
                                          <div className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-sm transition-transform duration-300 ${isWorkDay ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                        </button>
                                        <span className={`font-bold ${isWorkDay ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'}`}>星期{d}</span>
                                     </div>
                                     {!isWorkDay && <span className="text-xs font-medium text-slate-400 bg-white dark:bg-slate-700 px-2 py-1 rounded">休假</span>}
                                   </div>
                                   
                                   {isWorkDay && (
                                     <div className="mt-4 flex items-center gap-2 bg-white/70 dark:bg-slate-700/50 p-2 rounded-xl border border-slate-100 dark:border-slate-600 shadow-sm">
                                       <Clock size={14} className="text-slate-400 ml-1"/>
                                       <select 
                                         value={hours.start} 
                                         onChange={(e) => handleUpdateDayConfig(c, i, true, e.target.value, hours.end)}
                                         className="flex-1 bg-transparent text-sm font-medium text-slate-700 dark:text-slate-200 outline-none cursor-pointer text-center"
                                       >
                                         {ALL_TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                                       </select>
                                       <ChevronRight size={14} className="text-slate-300"/>
                                       <select 
                                         value={hours.end} 
                                         onChange={(e) => handleUpdateDayConfig(c, i, true, hours.start, e.target.value)}
                                         className="flex-1 bg-transparent text-sm font-medium text-slate-700 dark:text-slate-200 outline-none cursor-pointer text-center"
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
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                           <div className="space-y-6">
                               <div className="p-6 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                                   <h4 className="font-bold text-lg dark:text-white mb-3 flex items-center gap-2"><CheckCircle size={20} className="text-indigo-600"/> 雙重核實扣點流程</h4>
                                   <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                       <li><strong className="text-indigo-600">學員簽到</strong>：學員在「我的預約」中點擊「立即簽到」。</li>
                                       <li><strong className="text-indigo-600">教練確認</strong>：課程結束後，教練在行事曆中點擊該課程（橘色閃爍狀態）。</li>
                                       <li><strong className="text-indigo-600">系統扣點</strong>：點擊「確認核實完課」按鈕，系統將自動扣除學員 1 點庫存。</li>
                                       <li><strong className="text-red-500">注意</strong>：若未經過此流程，點數將不會自動扣除。</li>
                                   </ol>
                               </div>

                               <div className="p-6 bg-pink-50/50 dark:bg-pink-900/10 rounded-2xl border border-pink-100 dark:border-pink-800">
                                   <h4 className="font-bold text-lg dark:text-white mb-3 flex items-center gap-2"><Activity size={20} className="text-pink-600"/> 傷病史與健康檔案</h4>
                                   <ul className="list-disc list-inside space-y-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                       <li>進入 <strong className="text-slate-800 dark:text-white">訓練課表</strong> 分頁。</li>
                                       <li>使用搜尋列輸入學員姓名或電話。</li>
                                       <li>在左側面板中填寫「傷病史與禁忌」、「訓練目標」等資訊。</li>
                                       <li>點擊 <span className="bg-indigo-600 text-white px-1.5 py-0.5 text-xs rounded">儲存</span> 按鈕以更新學員資料。</li>
                                   </ul>
                               </div>
                           </div>

                           <div className="space-y-6">
                               <div className="p-6 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800">
                                   <h4 className="font-bold text-lg dark:text-white mb-3 flex items-center gap-2"><FileSpreadsheet size={20} className="text-emerald-600"/> 報表輸出與分析</h4>
                                   <p className="text-sm text-slate-600 dark:text-slate-300 mb-3 leading-relaxed">
                                       在「營運分析」分頁中，您可以匯出兩種格式的報表：
                                   </p>
                                   <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                                       <li className="flex items-center gap-2"><FileSpreadsheet size={14} className="text-emerald-500"/> <strong>營運報表 (CSV)</strong>：包含教練課時統計、熱門時段數據。</li>
                                       <li className="flex items-center gap-2"><FileWarning size={14} className="text-red-500"/> <strong>取消明細 (CSV)</strong>：匯出所有被取消的課程及其原因。</li>
                                   </ul>
                               </div>

                               <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                                   <h4 className="font-bold text-lg dark:text-white mb-3 flex items-center gap-2"><HelpCircle size={20} className="text-slate-500"/> 常見問題</h4>
                                   <div className="space-y-3">
                                       <div>
                                           <div className="text-xs font-bold text-slate-500 uppercase mb-1">如何修改庫存？</div>
                                           <p className="text-sm text-slate-600 dark:text-slate-400">至「庫存管理」分頁，點擊該學員卡片即可手動調整點數。</p>
                                       </div>
                                       <div>
                                           <div className="text-xs font-bold text-slate-500 uppercase mb-1">如何排休？</div>
                                           <p className="text-sm text-slate-600 dark:text-slate-400">至「班表設定」調整每週固定休假，或在「員工管理」編輯特定日期休假。</p>
                                       </div>
                                   </div>
                               </div>
                           </div>
                       </div>
                   </div>
               )}

               {/* Global Glassmorphism Modals */}
               
               {/* Coach Modal */}
               {isCoachModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => setIsCoachModalOpen(false)}>
                    <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-slideUp border border-white/20 dark:border-slate-700/30 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-slate-100/50 dark:border-slate-700/50 flex justify-between items-center">
                            <h3 className="font-bold text-xl dark:text-white">{isNewCoach ? '新增員工資料' : '編輯員工資料'}</h3>
                            <button onClick={() => setIsCoachModalOpen(false)}><X className="text-slate-500"/></button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleSubmitCoach} className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">姓名</label>
                                    <input type="text" required value={editingCoach.name || ''} onChange={e => setEditingCoach({...editingCoach, name: e.target.value})} className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white"/>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">職位</label>
                                    <select value={editingCoach.role || 'coach'} onChange={e => setEditingCoach({...editingCoach, role: e.target.value as any})} className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white">
                                        <option value="coach">教練 (Coach)</option>
                                        <option value="manager">主管 (Manager)</option>
                                        <option value="receptionist">櫃檯 (Receptionist)</option>
                                    </select>
                                </div>
                                
                                {isNewCoach && (
                                    <>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Mail size={12}/> Email (登入帳號)</label>
                                            <input type="email" required value={newCoachEmail} onChange={e => setNewCoachEmail(e.target.value)} className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white" placeholder="coach@gym.com"/>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Key size={12}/> 初始密碼</label>
                                            <input type="password" required value={newCoachPassword} onChange={e => setNewCoachPassword(e.target.value)} className="w-full glass-input rounded-xl p-3 mt-1 dark:text-white" placeholder="至少6位數"/>
                                        </div>
                                    </>
                                )}

                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">代表色</label>
                                    <div className="grid grid-cols-4 gap-2 mt-2">
                                        {COLOR_OPTIONS.map(opt => (
                                            <button 
                                                type="button" 
                                                key={opt.label} 
                                                onClick={() => setEditingCoach({...editingCoach, color: opt.value})}
                                                className={`h-8 rounded-lg border-2 transition-all ${opt.value.split(' ')[0]} ${editingCoach.color === opt.value ? 'border-slate-600 dark:border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                                title={opt.label}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className="border-t border-slate-100/50 dark:border-slate-700/50 pt-4 mt-2">
                                   <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-2"><CalendarX size={14}/> 特定日期休假</label>
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
                                          className="bg-slate-200 dark:bg-slate-700 px-3 rounded-xl font-bold text-sm hover:bg-slate-300 dark:hover:bg-slate-600"
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
                                   </div>
                                </div>

                                <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg mt-4 hover:bg-indigo-700 transition-colors">儲存變更</button>
                            </form>
                        </div>
                    </div>
                </div>
               )}

               {/* Inventory Edit Modal */}
               {isInventoryModalOpen && editingInventory && (
                   <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => setIsInventoryModalOpen(false)}>
                       <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-slideUp border border-white/20 dark:border-slate-700/30" onClick={e => e.stopPropagation()}>
                           <div className="p-5 border-b border-slate-100/50 dark:border-slate-700/50 flex justify-between items-center">
                               <h3 className="font-bold text-xl dark:text-white flex items-center gap-2"><CreditCard size={20} className="text-indigo-500"/> 修改庫存</h3>
                               <button onClick={() => setIsInventoryModalOpen(false)}><X className="text-slate-500"/></button>
                           </div>
                           <div className="p-6 space-y-4">
                               <div className="glass-card p-3 rounded-xl bg-white/50 dark:bg-slate-800/50 mb-2">
                                   <div className="text-xs text-slate-400 uppercase font-bold">學員資料</div>
                                   <div className="font-bold text-lg dark:text-white">{inventoryForm.name}</div>
                                   <div className="text-sm text-slate-500">{inventoryForm.phone}</div>
                               </div>

                               <div className="grid grid-cols-2 gap-4">
                                   <div>
                                       <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">私人課 (Private)</label>
                                       <input 
                                           type="number" 
                                           className="w-full text-2xl font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 border-b-2 border-indigo-200 focus:border-indigo-500 outline-none p-2 rounded-t-lg text-center"
                                           value={inventoryForm.private}
                                           onChange={e => setInventoryForm({...inventoryForm, private: Number(e.target.value)})}
                                       />
                                   </div>
                                   <div>
                                       <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">團體課 (Group)</label>
                                       <input 
                                           type="number" 
                                           className="w-full text-2xl font-bold text-orange-600 bg-orange-50 dark:bg-orange-900/20 border-b-2 border-orange-200 focus:border-orange-500 outline-none p-2 rounded-t-lg text-center"
                                           value={inventoryForm.group}
                                           onChange={e => setInventoryForm({...inventoryForm, group: Number(e.target.value)})}
                                       />
                                   </div>
                               </div>

                               <div className="pt-2">
                                   <button 
                                       onClick={handleSaveInventoryChanges}
                                       className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                                   >
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
