import React, { useRef, useState } from 'react';
import { LogOut, Trash2, FileSpreadsheet, Database, Clock, ChevronRight, FileWarning, BarChart3, List, Settings as SettingsIcon, History, User as UserIcon, Users, Plus, Edit2, X, Mail, Key, CalendarX, Layers, CreditCard, Search, BookOpen, Menu, LayoutDashboard, Dumbbell, Save, RotateCcw } from 'lucide-react';
import { User, Appointment, Coach, Log, UserInventory } from '../types';
import { ALL_TIME_SLOTS, COLOR_OPTIONS } from '../constants';

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
  workoutPlans: any[]; // Assuming workout logic handled in App or separate component
  onSaveWorkoutPlan: any;
  onDeleteWorkoutPlan: any;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser, onLogout, adminTab, setAdminTab, renderWeeklyCalendar,
  appointments, selectedBatch, toggleBatchSelect, handleBatchDelete,
  analysis, handleExportStatsCsv, handleExportJson, triggerImport, handleFileImport,
  coaches, updateCoachWorkDays, logs, onSaveCoach, onDeleteCoach, onOpenBatchBlock,
  inventories, onSaveInventory, onDeleteInventory
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

  // Inventory Editing
  const [searchQuery, setSearchQuery] = useState('');
  const [inventoryEditId, setInventoryEditId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{private: number, group: number}>({ private: 0, group: 0 });

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

  // Inventory Edit Handlers
  const startEditingInventory = (inv: UserInventory) => {
      setInventoryEditId(inv.id);
      setEditValues({ private: inv.credits.private, group: inv.credits.group });
  };

  const cancelEditingInventory = () => {
      setInventoryEditId(null);
  };

  const saveInventoryChanges = (inv: UserInventory) => {
      onSaveInventory({
          ...inv,
          credits: { private: Number(editValues.private), group: Number(editValues.group) },
          lastUpdated: new Date().toISOString()
      });
      setInventoryEditId(null);
  };

  // Navigation Config
  const NAV_ITEMS = [
      { category: '營運核心', items: [
          { id: 'calendar', icon: Clock, label: '行事曆' },
          { id: 'appointments', icon: List, label: '預約列表' },
      ]},
      { category: '客戶管理', items: [
          { id: 'inventory', icon: CreditCard, label: '庫存管理' },
          { id: 'workout', icon: Dumbbell, label: '課表' },
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
       <main className="flex-1 p-4 md:p-8 overflow-y-auto h-screen bg-slate-50/50 dark:bg-slate-900">
           {/* Mobile Sidebar Backdrop */}
           {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>}

           {/* Tab Content */}
           <div className="max-w-7xl mx-auto animate-fadeIn">
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
                              const isEditing = inventoryEditId === inv.id;
                              const canEdit = ['manager', 'receptionist'].includes(currentUser.role);

                              return (
                                  <div key={inv.id} className={`glass-card p-6 rounded-2xl border transition-all ${isEditing ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-100 dark:border-slate-700 hover:shadow-lg'}`}>
                                      <div className="flex justify-between items-start mb-4">
                                          <div>
                                              <div className="font-bold text-lg dark:text-white">{inv.name}</div>
                                              <div className="text-xs text-slate-500">{inv.phone || '無電話'}</div>
                                          </div>
                                          {canEdit && !isEditing && (
                                              <button onClick={() => startEditingInventory(inv)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                                  <Edit2 size={16}/>
                                              </button>
                                          )}
                                          {canEdit && isEditing && (
                                              <div className="flex gap-1">
                                                  <button onClick={() => saveInventoryChanges(inv)} className="p-2 text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"><Save size={16}/></button>
                                                  <button onClick={cancelEditingInventory} className="p-2 text-slate-400 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"><RotateCcw size={16}/></button>
                                              </div>
                                          )}
                                      </div>

                                      <div className="grid grid-cols-2 gap-4">
                                          <div className={`p-3 rounded-xl ${isEditing ? 'bg-white border-2 border-indigo-100' : 'bg-indigo-50 dark:bg-indigo-900/20'}`}>
                                              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">私人課 (Private)</div>
                                              {isEditing ? (
                                                  <input 
                                                      type="number" 
                                                      className="w-full bg-transparent font-bold text-xl text-indigo-600 outline-none border-b border-indigo-200"
                                                      value={editValues.private}
                                                      onChange={e => setEditValues({...editValues, private: Number(e.target.value)})}
                                                  />
                                              ) : (
                                                  <div className="font-bold text-2xl text-indigo-600 dark:text-indigo-400">{inv.credits.private}</div>
                                              )}
                                          </div>
                                          <div className={`p-3 rounded-xl ${isEditing ? 'bg-white border-2 border-orange-100' : 'bg-orange-50 dark:bg-orange-900/20'}`}>
                                              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">團體課 (Group)</div>
                                              {isEditing ? (
                                                  <input 
                                                      type="number" 
                                                      className="w-full bg-transparent font-bold text-xl text-orange-600 outline-none border-b border-orange-200"
                                                      value={editValues.group}
                                                      onChange={e => setEditValues({...editValues, group: Number(e.target.value)})}
                                                  />
                                              ) : (
                                                  <div className="font-bold text-2xl text-orange-600 dark:text-orange-400">{inv.credits.group}</div>
                                              )}
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

               {/* Coach Edit Modal */}
               {isCoachModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setIsCoachModalOpen(false)}>
                    <div className="glass-panel w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-slideUp border border-white/40 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="bg-white/50 dark:bg-slate-900/50 p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
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

                                {/* Off Dates Management */}
                                <div className="border-t border-slate-100 dark:border-slate-700 pt-4 mt-2">
                                   <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-2"><CalendarX size={14}/> 特定日期休假 (Off Dates)</label>
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
                                       {(!editingCoach.offDates || editingCoach.offDates.length === 0) && (
                                           <span className="text-xs text-slate-400 italic">無設定休假日</span>
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
       </main>
    </div>
  );
};

export default AdminDashboard;