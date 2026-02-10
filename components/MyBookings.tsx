

import React, { useState, useEffect, useMemo } from 'react';
import { User, Calendar, Clock, AlertTriangle, User as UserIcon, CheckCircle, Info, Timer, CreditCard, TrendingUp, Dumbbell, ChevronDown, Activity } from 'lucide-react';
import { Appointment, Coach, UserInventory, WorkoutPlan } from '../types';

interface MyBookingsProps {
  liffProfile: { userId: string; displayName: string } | null;
  appointments: Appointment[];
  coaches: Coach[];
  onCancel: (app: Appointment, reason: string, customerId?: string) => void;
  onCheckIn: (app: Appointment) => void;
  inventories: UserInventory[];
  workoutPlans: WorkoutPlan[];
  liffError: string | null;
}

const ProgressChart: React.FC<{ data: { date: string, weight: number }[] }> = ({ data }) => {
  if (data.length < 2) {
    return (
      <div className="h-48 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
        <Activity size={32} className="mb-2 opacity-30"/>
        <p className="text-xs font-medium">數據不足以產生趨勢圖 (至少需 2 次紀錄)</p>
      </div>
    );
  }

  const padding = 40;
  const width = 500;
  const height = 250;
  
  const maxWeight = Math.max(...data.map(d => d.weight)) * 1.2;
  const minWeight = Math.min(...data.map(d => d.weight)) * 0.8;
  const range = maxWeight - minWeight;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((d.weight - minWeight) / range) * (height - padding * 2);
    return { x, y, weight: d.weight, date: d.date };
  });

  const pathD = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
  const areaD = `${pathD} L ${points[points.length - 1].x},${height - padding} L ${points[0].x},${height - padding} Z`;

  return (
    <div className="relative w-full overflow-hidden animate-fadeIn">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto drop-shadow-xl">
        <defs>
          <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>
        
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
          <line 
            key={i} 
            x1={padding} y1={padding + v * (height - padding * 2)} 
            x2={width - padding} y2={padding + v * (height - padding * 2)} 
            className="stroke-slate-200 dark:stroke-slate-700/50" 
            strokeDasharray="4 4"
          />
        ))}

        <path d={areaD} fill="url(#gradient)" />
        <path d={pathD} fill="none" stroke="url(#lineGradient)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="animate-float" />
        
        {points.map((p, i) => (
          <g key={i} className="group cursor-pointer">
            <circle cx={p.x} cy={p.y} r="6" className="fill-indigo-600 shadow-lg" />
            <circle cx={p.x} cy={p.y} r="12" className="fill-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <text x={p.x} y={p.y - 15} textAnchor="middle" className="text-[10px] font-bold fill-slate-600 dark:fill-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
              {p.weight}kg
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

const MyBookings: React.FC<MyBookingsProps> = ({ liffProfile, appointments, coaches, onCancel, onCheckIn, inventories, workoutPlans, liffError }) => {
  const [activeTab, setActiveTab] = useState<'bookings' | 'progress'>('bookings');
  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const [selectedApp, setSelectedApp] = useState<Appointment | null>(null);
  const [checkInConfirmApp, setCheckInConfirmApp] = useState<Appointment | null>(null);

  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const myInventory = liffProfile ? inventories.find(i => i.lineUserId === liffProfile.userId) : null;
  const myPlans = useMemo(() => {
    if (!liffProfile || !myInventory) return [];
    return workoutPlans.filter(p => p.userId === myInventory.id).sort((a,b) => a.date.localeCompare(b.date));
  }, [liffProfile, myInventory, workoutPlans]);

  const exerciseOptions = useMemo(() => {
    const exercises = new Set<string>();
    myPlans.forEach(p => p.exercises.forEach(ex => exercises.add(ex.exerciseName)));
    return Array.from(exercises);
  }, [myPlans]);

  useEffect(() => {
    if (exerciseOptions.length > 0 && !selectedExercise) {
      setSelectedExercise(exerciseOptions[0]);
    }
  }, [exerciseOptions]);

  const progressData = useMemo(() => {
    if (!selectedExercise) return [];
    return myPlans.map(p => {
      const ex = p.exercises.find(e => e.exerciseName === selectedExercise);
      if (!ex) return null;
      const maxWeight = Math.max(...ex.sets.map(s => s.weight));
      return { date: p.date, weight: maxWeight };
    }).filter(Boolean) as { date: string, weight: number }[];
  }, [selectedExercise, myPlans]);

  const stats = useMemo(() => {
    if (progressData.length === 0) return null;
    const max = Math.max(...progressData.map(d => d.weight));
    const first = progressData[0].weight;
    const last = progressData[progressData.length - 1].weight;
    const improvement = last - first;
    return { max, last, improvement, count: progressData.length };
  }, [progressData]);

  if (liffError) {
    return (
        <div className="max-w-md mx-auto mt-12 animate-slideUp px-4">
             <div className="glass-panel p-10 rounded-3xl text-center shadow-xl border border-red-500/40">
                 <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600 dark:text-red-400">
                     <AlertTriangle size={36}/>
                 </div>
                 <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">LINE 功能無法使用</h2>
                 <p className="text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">無法初始化 LINE Front-end Framework (LIFF)。請嘗試重新整理頁面，或確認您是在 LINE App 中開啟此頁面。</p>
                 <div className="text-xs text-left bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-slate-500 dark:text-slate-400">
                    <p className="font-bold">錯誤訊息:</p>
                    <p className="break-all font-mono">{liffError}</p>
                 </div>
             </div>
        </div>
    );
  }

  if (!liffProfile) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <UserIcon size={32} className="text-gray-400"/>
        </div>
        <h2 className="text-xl font-bold dark:text-white">正在載入使用者資料...</h2>
        <p className="text-gray-500 mt-2 text-sm">請稍候，正在確認您的 LINE 身份</p>
      </div>
    );
  }

  const myApps = appointments
      .filter(a => {
        if (!liffProfile || !myInventory) return false;
        // Is it a private class for me?
        if (a.lineUserId === liffProfile.userId) return true;
        if (myInventory && myInventory.phone && a.customer?.phone === myInventory.phone && a.customer?.name === myInventory.name) return true;
        // Is it a group class I'm part of?
        if (a.type === 'group' && a.attendees?.some(att => att.customerId === myInventory.id && att.status === 'joined')) return true;
        return false;
      })
      .sort((a, b) => new Date(b.date + ' ' + b.time).getTime() - new Date(a.date + ' ' + a.time).getTime());

  return (
    <div className="max-w-2xl mx-auto animate-slideUp pb-24 px-4">
      {/* Profile Header */}
      <div className="flex items-start gap-4 mb-6">
        <img src={`https://ui-avatars.com/api/?name=${liffProfile.displayName}&background=6366f1&color=fff&size=128`} className="w-16 h-16 rounded-2xl border-4 border-white dark:border-gray-800 shadow-lg"/>
        <div className="flex-1">
          <h1 className="text-2xl font-bold dark:text-white">{liffProfile.displayName}</h1>
           {myInventory && (
                <div className="mt-2 text-[10px] font-bold flex flex-wrap gap-2 text-slate-500 dark:text-slate-400">
                    <div className="bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-md border border-indigo-100 dark:border-indigo-800 flex items-center gap-1">
                        <CreditCard size={12} className="text-indigo-500"/> 私人：<span className="text-indigo-600 dark:text-indigo-400">{myInventory.credits.private}</span> 堂
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/30 px-2 py-1 rounded-md border border-orange-100 dark:border-orange-800 flex items-center gap-1">
                        <CreditCard size={12} className="text-orange-500"/> 團課：<span className="text-orange-600 dark:text-orange-400">{myInventory.credits.group}</span> 堂
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl mb-8 shadow-inner border border-slate-200 dark:border-slate-700">
          <button 
            onClick={() => setActiveTab('bookings')} 
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'bookings' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
          >
              <Calendar size={18}/> 我的預約
          </button>
          <button 
            onClick={() => setActiveTab('progress')} 
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'progress' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
          >
              <TrendingUp size={18}/> 訓練進度
          </button>
      </div>

      {activeTab === 'bookings' ? (
        <div className="space-y-4">
          {myApps.length === 0 ? (
            <div className="glass-panel p-10 rounded-3xl text-center border border-white/40">
                <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-400">
                    <Calendar size={32}/>
                </div>
                <h3 className="font-bold text-lg dark:text-white">目前沒有預約紀錄</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">快去預約您的第一堂課程吧！</p>
            </div>
          ) : (
            myApps.map(app => {
              const coach = coaches.find(c => c.id === app.coachId);
              const isCancelled = app.status === 'cancelled';
              const isCompleted = app.status === 'completed';
              const isCheckedIn = app.status === 'checked_in';
              const isConfirmed = app.status === 'confirmed';
              
              const appointmentDateTime = new Date(`${app.date}T${app.time}`);
              const now = new Date();
              const hoursUntil = (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

              const isUpcoming = appointmentDateTime > now;
              const isCancellableTime = hoursUntil >= 24;

              const canCancel = isConfirmed && isUpcoming && isCancellableTime;
              const cannotCancelLocked = isConfirmed && isUpcoming && !isCancellableTime;
              const canCheckIn = isConfirmed && app.type !== 'group';

              return (
                <div key={app.id} className={`glass-card p-5 rounded-2xl border-l-4 ${isCancelled ? 'border-l-red-400 opacity-70' : isCompleted ? 'border-l-gray-400' : isCheckedIn ? 'border-l-orange-500' : 'border-l-green-500'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg font-bold dark:text-white">{app.date}</span>
                          <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-sm font-medium dark:text-slate-200">{app.time}</span>
                      </div>
                      <div className="text-indigo-600 dark:text-indigo-400 font-bold">{app.type === 'group' ? app.reason : (app.service?.name || '課程')}</div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1
                        ${isCancelled ? 'bg-red-100 text-red-600' : isCompleted ? 'bg-gray-200 text-gray-600' : isCheckedIn ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                        {isCancelled ? '已取消' : isCompleted ? '已完課' : isCheckedIn ? <><Timer size={12}/> 等待確認</> : '預約成功'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4 border-t border-gray-100 dark:border-gray-700 pt-3">
                      <UserIcon size={14}/> 教練：{coach?.name || app.coachName}
                  </div>

                  <div className="flex gap-2">
                    {canCheckIn && (
                       <button onClick={() => setCheckInConfirmApp(app)} className="flex-1 mb-2 py-3 bg-[#06C755] hover:bg-[#05b34c] text-white rounded-xl text-lg font-bold shadow-lg shadow-green-500/30 flex items-center justify-center gap-2 animate-bounce-short"><CheckCircle size={20}/> 立即簽到</button>
                    )}
                    {app.type !== 'group' && canCancel && (
                        <button onClick={() => setSelectedApp(app)} className={`flex-1 mb-2 py-3 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-900/50 text-red-500 rounded-xl text-lg font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ${!canCheckIn ? 'w-full' : ''}`}>取消預約</button>
                    )}
                  </div>
                  
                  {app.type !== 'group' && cannotCancelLocked && <div className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl text-sm font-bold text-center border border-slate-200 dark:border-slate-700">24小時內無法取消</div>}
                  {app.type === 'group' && isConfirmed && isUpcoming && <div className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl text-sm font-bold text-center border border-slate-200 dark:border-slate-700">團課請洽管理員取消</div>}
                  {isCompleted && <div className="w-full py-2 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-xl text-sm font-bold text-center">已完成</div>}
                  {isCheckedIn && <div className="w-full py-2 bg-orange-50 dark:bg-orange-900/20 text-orange-500 rounded-xl text-sm font-bold text-center border border-orange-100 dark:border-orange-800">已簽到，請教練確認完課</div>}
                  {isCancelled && <div className="text-xs text-red-400">取消原因：{app.cancelReason}</div>}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-6 animate-fadeIn">
          {/* Progress Selector */}
          <div className="glass-panel p-6 rounded-3xl border border-white/40">
            <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2 mb-3">
              <Dumbbell size={14} className="text-indigo-500"/> 選擇查看動作
            </label>
            <div className="relative">
              <select 
                value={selectedExercise}
                onChange={(e) => setSelectedExercise(e.target.value)}
                className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-bold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
              >
                {exerciseOptions.length > 0 ? exerciseOptions.map(ex => (
                  <option key={ex} value={ex}>{ex}</option>
                )) : <option value="">無歷史紀錄</option>}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20}/>
            </div>

            {stats && (
              <div className="mt-8">
                <ProgressChart data={progressData} />
                
                <div className="grid grid-cols-3 gap-4 mt-8">
                  <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50">
                    <div className="text-[10px] font-bold text-indigo-500 uppercase mb-1">歷史最高</div>
                    <div className="text-xl font-black text-slate-800 dark:text-white">{stats.max}<span className="text-xs ml-1 font-normal opacity-60">kg</span></div>
                  </div>
                  <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50">
                    <div className="text-[10px] font-bold text-emerald-500 uppercase mb-1">進步幅度</div>
                    <div className="text-xl font-black text-slate-800 dark:text-white">+{stats.improvement}<span className="text-xs ml-1 font-normal opacity-60">kg</span></div>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">總次數</div>
                    <div className="text-xl font-black text-slate-800 dark:text-white">{stats.count}<span className="text-xs ml-1 font-normal opacity-60">次</span></div>
                  </div>
                </div>
              </div>
            )}

            {exerciseOptions.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <Dumbbell size={48} className="mx-auto mb-4 opacity-10"/>
                <p>尚無訓練數據，請先開始您的第一堂課！</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals remain same */}
      {selectedApp && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
             <div className="glass-panel w-full max-w-sm rounded-3xl p-6 animate-slideUp border border-white/20">
                 <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle size={24}/></div>
                 <h3 className="font-bold text-lg mb-2 text-center dark:text-white">取消預約確認</h3>
                 <p className="text-sm text-gray-500 text-center mb-6">您確定要取消 {selectedApp.date} {selectedApp.time} 的課程嗎？</p>
                 <div className="flex gap-3">
                     <button onClick={() => { setSelectedApp(null); }} className="flex-1 py-2.5 bg-gray-200 dark:bg-gray-700 rounded-xl font-bold text-gray-600 dark:text-gray-300">保留</button>
                     <button onClick={() => { onCancel(selectedApp, '用戶自行取消', myInventory?.id); setSelectedApp(null); }} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-500/30">確認取消</button>
                 </div>
             </div>
        </div>
      )}
      {checkInConfirmApp && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
             <div className="glass-panel w-full max-w-sm rounded-3xl p-6 animate-slideUp border border-white/20">
                 <div className="w-12 h-12 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4"><Info size={24}/></div>
                 <h3 className="font-bold text-lg mb-2 text-center dark:text-white">簽到確認</h3>
                 <p className="text-sm text-gray-500 text-center mb-6">簽到後請出示畫面給教練確認<br/><span className="text-xs text-gray-400 font-bold">(確認完課後將扣除點數)</span></p>
                 <div className="flex gap-3">
                     <button onClick={() => { setCheckInConfirmApp(null); }} className="flex-1 py-2.5 bg-gray-200 dark:bg-gray-700 rounded-xl font-bold text-gray-600 dark:text-gray-300">取消</button>
                     <button onClick={() => { onCheckIn(checkInConfirmApp); setCheckInConfirmApp(null); }} className="flex-1 py-2.5 bg-green-500 text-white rounded-xl font-bold shadow-lg shadow-green-500/30">確認簽到</button>
                 </div>
             </div>
        </div>
      )}
    </div>
  );
};

export default MyBookings;
