import React, { useRef } from 'react';
import { LogOut, Trash2, FileSpreadsheet, Database, Clock } from 'lucide-react';
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

  return (
    <div className="max-w-6xl mx-auto p-4">
       <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold dark:text-white">管理後台 ({currentUser.name})</h1>
          <button onClick={onLogout} className="flex items-center gap-2 text-red-500"><LogOut size={16}/> 登出</button>
       </div>
       
       <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['calendar','appointments','analysis','settings','logs'].map(t => (
             <button key={t} onClick={()=>setAdminTab(t)} className={`px-4 py-2 rounded-lg whitespace-nowrap ${adminTab===t ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
               {{calendar:'行事曆', appointments:'預約列表', analysis:'營運分析', settings:'班表設定', logs:'操作紀錄'}[t]}
             </button>
          ))}
       </div>

       {adminTab === 'calendar' && renderWeeklyCalendar()}
       
       {adminTab === 'appointments' && (
         <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
           <div className="flex justify-between mb-4">
             <h3 className="font-bold dark:text-white">預約列表</h3>
             {selectedBatch.size > 0 && (
               <button onClick={handleBatchDelete} className="bg-red-100 text-red-600 px-3 py-1 rounded-lg text-sm flex items-center gap-2">
                 <Trash2 size={14}/> 刪除選取 ({selectedBatch.size})
               </button>
             )}
           </div>
           <div className="space-y-2">
             {filteredApps.sort((a,b)=> { try { return new Date(`${a.date} ${a.time}`).getTime() - new Date(`${b.date} ${b.time}`).getTime() } catch(e){ return 0 } }).map(app => (
               <div key={app.id} className="flex items-center gap-3 p-3 border rounded-lg dark:border-gray-700">
                  <input type="checkbox" checked={selectedBatch.has(app.id)} onChange={() => toggleBatchSelect(app.id)} />
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="font-bold dark:text-white">{app.date} {app.time}</span>
                      <span className={`text-xs px-2 rounded ${app.status==='cancelled'?'bg-red-100 text-red-600':'bg-green-100 text-green-600'}`}>{app.status}</span>
                    </div>
                    <div className="text-sm text-gray-500">
                        {coaches.find(c => c.id === app.coachId)?.name || app.coachName} - {app.type==='client'?app?.customer?.name:app.reason}
                    </div>
                  </div>
               </div>
             ))}
           </div>
         </div>
       )}

       {adminTab === 'analysis' && (
          <div className="space-y-6">
            <div className="flex justify-end">
               <button onClick={handleExportStatsCsv} className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm"><FileSpreadsheet size={16}/> 匯出報表</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700">
                  <h4 className="font-bold text-orange-500 mb-3">熱門時段 Top 3</h4>
                  {analysis.topTimeSlots.map((s: any, i: number) => <div key={s.time} className="flex justify-between py-1 border-b dark:border-gray-700 last:border-0 dark:text-gray-300"><span>{i+1}. {s.time}</span><span>{s.count} 堂</span></div>)}
               </div>
               <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700">
                  <h4 className="font-bold text-blue-500 mb-3">預約狀態</h4>
                  <div className="flex justify-around text-center">
                     <div><div className="text-2xl font-bold text-green-500">{analysis.totalActive}</div><div className="text-xs text-gray-500">有效</div></div>
                     <div><div className="text-2xl font-bold text-red-500">{analysis.totalCancelled}</div><div className="text-xs text-gray-500">取消</div></div>
                  </div>
               </div>
               <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700">
                  <h4 className="font-bold text-purple-500 mb-3">課程統計 (本月)</h4>
                  <div className="grid grid-cols-4 gap-2 text-xs text-gray-400 border-b dark:border-gray-700 pb-2 mb-2">
                      <span>教練</span>
                      <span className="text-right">個人</span>
                      <span className="text-right">團課</span>
                      <span className="text-right">總計</span>
                  </div>
                  {(currentUser.role === 'manager' 
                      ? analysis.coachStats 
                      : analysis.coachStats.filter((s: any) => s.id === currentUser.id)
                   ).map((c: any) => (
                    <div key={c.id} className="grid grid-cols-4 gap-2 text-sm py-1 dark:text-gray-300 border-b dark:border-gray-800 last:border-0">
                        <span className="truncate">{c.name}</span>
                        <span className="text-right font-medium text-gray-500">{c.personal}</span>
                        <span className="text-right font-medium text-gray-500">{c.group}</span>
                        <span className="text-right font-bold text-purple-600 dark:text-purple-400">{c.total}</span>
                    </div>
                  ))}
               </div>
            </div>
          </div>
       )}

       {adminTab === 'settings' && (
          <div className="space-y-4">
             {currentUser.role === 'manager' && (
               <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl flex justify-between items-center">
                  <span className="text-blue-800 dark:text-blue-200 font-bold flex gap-2"><Database size={18}/> 資料保險箱</span>
                  <div className="flex gap-2">
                    <button onClick={handleExportJson} className="bg-white dark:bg-gray-700 px-3 py-1 rounded border shadow-sm text-sm dark:text-white">匯出</button>
                    <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 text-white px-3 py-1 rounded shadow-sm text-sm">匯入</button>
                    <input type="file" ref={fileInputRef} onChange={handleFileImport} className="hidden"/>
                  </div>
               </div>
             )}
             {coaches.map(c => {
               if (currentUser.role === 'coach' && currentUser.id !== c.id) return null;
               return (
               <div key={c.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700">
                  <div className="font-bold mb-4 dark:text-white flex items-center gap-2"><Clock size={16} className="text-gray-400"/> {c.name} 上班時間設定</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {['日','一','二','三','四','五','六'].map((d, i) => {
                       const isWorkDay = c.workDays?.includes(i);
                       const hours = c.dailyWorkHours?.[i.toString()] || { start: c.workStart, end: c.workEnd };
                       return (
                         <div key={i} className={`p-3 rounded-lg border ${isWorkDay ? 'border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-800' : 'border-gray-200 bg-gray-50 dark:bg-gray-700 dark:border-gray-600'}`}>
                           <div className="flex items-center justify-between mb-2">
                             <label className="flex items-center gap-2 font-bold cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={isWorkDay || false}
                                  onChange={(e) => handleUpdateDayConfig(c, i, e.target.checked, hours.start, hours.end)}
                                  className="w-4 h-4 rounded text-green-600 focus:ring-green-500"
                                />
                                <span className={isWorkDay ? 'text-green-800 dark:text-green-300' : 'text-gray-500 dark:text-gray-400'}>星期{d}</span>
                             </label>
                             {!isWorkDay && <span className="text-xs text-gray-400 bg-white dark:bg-gray-600 px-2 py-0.5 rounded">休假</span>}
                           </div>
                           {isWorkDay && (
                             <div className="flex items-center gap-1 text-sm">
                               <select 
                                 value={hours.start} 
                                 onChange={(e) => handleUpdateDayConfig(c, i, true, e.target.value, hours.end)}
                                 className="w-full p-1 rounded border dark:bg-gray-600 dark:text-white text-xs"
                               >
                                 {ALL_TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                               </select>
                               <span className="text-gray-400">-</span>
                               <select 
                                 value={hours.end} 
                                 onChange={(e) => handleUpdateDayConfig(c, i, true, hours.start, e.target.value)}
                                 className="w-full p-1 rounded border dark:bg-gray-600 dark:text-white text-xs"
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
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 h-[500px] overflow-y-auto">
             {logs.map(log => (
                <div key={log.id} className="border-b dark:border-gray-700 py-2 text-sm">
                   <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>{new Date(log.time).toLocaleString()}</span>
                      <span>{log.user}</span>
                   </div>
                   <div className="font-bold mt-1 dark:text-gray-200">{log.action}</div>
                   <div className="text-gray-600 dark:text-gray-400">{log.details}</div>
                </div>
             ))}
          </div>
       )}
    </div>
  );
};

export default AdminDashboard;