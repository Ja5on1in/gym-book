import React, { useRef } from 'react';
import { LogOut, Trash2, FileSpreadsheet, Database, Clock, ChevronRight, FileWarning, BarChart3, List, Settings as SettingsIcon, History, User as UserIcon } from 'lucide-react';
import { User, Appointment, Coach, Log } from '../types';
import WeeklyCalendar from './WeeklyCalendar';
import { ALL_TIME_SLOTS } from '../constants';

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
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser, onLogout, adminTab, setAdminTab, renderWeeklyCalendar,
  appointments, selectedBatch, toggleBatchSelect, handleBatchDelete,
  analysis, handleExportStatsCsv, handleExportJson, triggerImport, handleFileImport,
  coaches, updateCoachWorkDays, logs
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredApps = appointments.filter(a => currentUser.role==='manager' || a.coachId === currentUser.id);

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

  return (
    <div className="max-w-6xl mx-auto p-4 pb-24">
       <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold dark:text-white mb-1">管理後台</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">歡迎回來，{currentUser.name}</p>
          </div>
          <button onClick={onLogout} className="glass-card flex items-center gap-2 text-red-500 px-4 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shadow-sm"><LogOut size={16}/> 登出</button>
       </div>
       
       <div className="glass-panel p-1 rounded-2xl flex gap-1 mb-8 overflow-x-auto mx-auto max-w-full md:max-w-fit shadow-lg">
          {['calendar','appointments','analysis','settings','logs'].map(t => (
             <button key={t} onClick={()=>setAdminTab(t)} 
                className={`px-5 py-2.5 rounded-xl whitespace-nowrap text-sm font-medium transition-all flex items-center gap-2
                ${adminTab===t ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-white shadow-md transform scale-105' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 hover:bg-white/30'}`}>
               {{calendar: <><Clock size={16}/> 行事曆</>, appointments: <><List size={16}/> 預約列表</>, analysis: <><BarChart3 size={16}/> 營運分析</>, settings: <><SettingsIcon size={16}/> 班表設定</>, logs: <><History size={16}/> 操作紀錄</>}[t]}
             </button>
          ))}
       </div>

       {adminTab === 'calendar' && renderWeeklyCalendar()}
       
       {adminTab === 'appointments' && (
         <div className="glass-panel rounded-3xl shadow-lg p-6">
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
               <div key={app.id} className="glass-card flex items-center gap-4 p-4 rounded-2xl group hover:border-indigo-200 dark:hover:border-indigo-800 transition-all">
                  <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" checked={selectedBatch.has(app.id)} onChange={() => toggleBatchSelect(app.id)} />
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-3">
                         <span className="font-bold text-lg dark:text-white">{app.date}</span>
                         <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-sm font-medium">{app.time}</span>
                      </div>
                      <span className={`text-xs px-3 py-1 rounded-full font-bold ${app.status==='cancelled'?'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400':'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'}`}>
                          {app.status === 'cancelled' ? '已取消' : '已確認'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
                        <span>{coaches.find(c => c.id === app.coachId)?.name || app.coachName}</span>
                        <span className="font-medium text-indigo-600 dark:text-indigo-400">{app.type==='client' ? app?.customer?.name : app.reason}</span>
                    </div>
                  </div>
               </div>
             ))}
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
               <div className="glass-panel p-6 rounded-3xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10"><BarChart3 size={100} className="text-orange-500"/></div>
                  <h4 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><Clock size={18} className="text-orange-500"/> 熱門時段 Top 3</h4>
                  <div className="space-y-3 relative z-10">
                    {analysis.topTimeSlots.map((s: any, i: number) => (
                        <div key={s.time} className="flex justify-between items-center p-3 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-white/40 dark:border-gray-700">
                            <span className="font-bold text-orange-600 dark:text-orange-400">#{i+1} {s.time}</span>
                            <span className="text-sm font-medium">{s.count} 堂</span>
                        </div>
                    ))}
                  </div>
               </div>
               
               <div className="glass-panel p-6 rounded-3xl flex flex-col justify-center">
                  <h4 className="font-bold text-gray-800 dark:text-white mb-4 text-center">預約狀態總覽</h4>
                  <div className="flex justify-around items-center">
                     <div className="text-center">
                         <div className="text-5xl font-bold text-emerald-500 mb-2 drop-shadow-sm">{analysis.totalActive}</div>
                         <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">有效預約</div>
                     </div>
                     <div className="h-16 w-px bg-gray-200 dark:bg-gray-700"></div>
                     <div className="text-center">
                         <div className="text-5xl font-bold text-red-500 mb-2 drop-shadow-sm">{analysis.totalCancelled}</div>
                         <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">已取消</div>
                     </div>
                  </div>
               </div>

               <div className="glass-panel p-6 rounded-3xl md:col-span-1">
                  <h4 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><UserIcon size={18} className="text-purple-500"/> 課程統計 (本月)</h4>
                  <div className="overflow-y-auto max-h-[200px] custom-scrollbar pr-2">
                      <div className="grid grid-cols-4 gap-2 text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">
                          <span>教練</span>
                          <span className="text-right">個人</span>
                          <span className="text-right">團課</span>
                          <span className="text-right">總計</span>
                      </div>
                      {(currentUser.role === 'manager' 
                          ? analysis.coachStats 
                          : analysis.coachStats.filter((s: any) => s.id === currentUser.id)
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
    </div>
  );
};

export default AdminDashboard;