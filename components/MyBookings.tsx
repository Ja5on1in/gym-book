


import React, { useState, useEffect } from 'react';
import { User, Calendar, Clock, AlertTriangle, User as UserIcon, CheckCircle, Info, Timer } from 'lucide-react';
import { Appointment, Coach } from '../types';

interface MyBookingsProps {
  liffProfile: { userId: string; displayName: string } | null;
  appointments: Appointment[];
  coaches: Coach[];
  onCancel: (app: Appointment, reason: string) => void;
  onCheckIn: (app: Appointment) => void;
}

const MyBookings: React.FC<MyBookingsProps> = ({ liffProfile, appointments, coaches, onCancel, onCheckIn }) => {
  const [selectedApp, setSelectedApp] = useState<Appointment | null>(null);
  const [checkInConfirmApp, setCheckInConfirmApp] = useState<Appointment | null>(null);

  // Force re-render periodically to update check-in button state (legacy, kept for safety)
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

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

  const myApps = appointments.filter(a => a.lineUserId === liffProfile.userId).sort((a, b) => new Date(b.date + ' ' + b.time).getTime() - new Date(a.date + ' ' + a.time).getTime());

  return (
    <div className="max-w-2xl mx-auto animate-slideUp pb-24">
      <div className="flex items-center gap-4 mb-8">
        <img src={`https://ui-avatars.com/api/?name=${liffProfile.displayName}&background=0D8ABC&color=fff`} className="w-16 h-16 rounded-full border-4 border-white dark:border-gray-800 shadow-lg"/>
        <div>
          <h1 className="text-2xl font-bold dark:text-white">{liffProfile.displayName} 的預約</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">LINE ID 已連結</p>
        </div>
      </div>

      {myApps.length === 0 ? (
        <div className="glass-panel p-10 rounded-3xl text-center">
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-400">
                <Calendar size={32}/>
            </div>
            <h3 className="font-bold text-lg dark:text-white">目前沒有預約紀錄</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">快去預約您的第一堂課程吧！</p>
        </div>
      ) : (
        <div className="space-y-4">
          {myApps.map(app => {
            const coach = coaches.find(c => c.id === app.coachId);
            const isCancelled = app.status === 'cancelled';
            const isCompleted = app.status === 'completed';
            const isCheckedIn = app.status === 'checked_in';
            // Allow check-in if status is confirmed
            const canCheckIn = app.status === 'confirmed'; 
            const isUpcoming = new Date(app.date + ' ' + app.time) > new Date() && !isCancelled;

            return (
              <div key={app.id} className={`glass-card p-5 rounded-2xl border-l-4 ${isCancelled ? 'border-l-red-400 opacity-70' : isCompleted ? 'border-l-gray-400' : isCheckedIn ? 'border-l-orange-500' : 'border-l-green-500'}`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg font-bold dark:text-white">{app.date}</span>
                        <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-sm font-medium">{app.time}</span>
                    </div>
                    <div className="text-indigo-600 dark:text-indigo-400 font-bold">{app.service?.name || '課程'}</div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1
                      ${isCancelled ? 'bg-red-100 text-red-600' : isCompleted ? 'bg-gray-200 text-gray-600' : isCheckedIn ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                      {isCancelled ? '已取消' : isCompleted ? '已完課' : isCheckedIn ? <><Timer size={12}/> 等待確認</> : '預約成功'}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4 border-t border-gray-100 dark:border-gray-700 pt-3">
                    <User size={14}/> 教練：{coach?.name || app.coachName}
                </div>

                <div className="flex gap-2">
                  {canCheckIn && (
                     <button 
                         onClick={() => setCheckInConfirmApp(app)}
                         className="flex-1 mb-2 py-3 bg-[#06C755] hover:bg-[#05b34c] text-white rounded-xl text-lg font-bold shadow-lg shadow-green-500/30 flex items-center justify-center gap-2 animate-bounce-short"
                     >
                         <CheckCircle size={20}/> 立即簽到
                     </button>
                  )}

                  {isUpcoming && !isCompleted && !isCheckedIn && (
                      <button 
                          onClick={() => setSelectedApp(app)}
                          className={`flex-1 mb-2 py-3 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-900/50 text-red-500 rounded-xl text-lg font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ${!canCheckIn ? 'w-full' : ''}`}
                      >
                          取消預約
                      </button>
                  )}
                </div>
                
                {isCompleted && (
                    <div className="w-full py-2 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-xl text-sm font-bold text-center">
                        已完成簽到
                    </div>
                )}

                {isCheckedIn && (
                    <div className="w-full py-2 bg-orange-50 dark:bg-orange-900/20 text-orange-500 rounded-xl text-sm font-bold text-center border border-orange-100 dark:border-orange-800">
                        已簽到，請教練確認完課
                    </div>
                )}
                
                {isCancelled && <div className="text-xs text-red-400">取消原因：{app.cancelReason}</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {selectedApp && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
             <div className="glass-panel w-full max-w-sm rounded-3xl p-6 animate-slideUp">
                 <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                     <AlertTriangle size={24}/>
                 </div>
                 <h3 className="font-bold text-lg mb-2 text-center dark:text-white">取消預約確認</h3>
                 <p className="text-sm text-gray-500 text-center mb-6">您確定要取消 {selectedApp.date} {selectedApp.time} 的課程嗎？<br/>(將會退還 1 點課程點數)</p>
                 
                 <div className="flex gap-3">
                     <button onClick={() => { setSelectedApp(null); }} className="flex-1 py-2.5 bg-gray-200 dark:bg-gray-700 rounded-xl font-bold text-gray-600 dark:text-gray-300">保留</button>
                     <button onClick={() => { onCancel(selectedApp, '用戶自行取消'); setSelectedApp(null); }} 
                        className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-500/30">
                        確認取消
                     </button>
                 </div>
             </div>
        </div>
      )}

      {/* Check-in Confirmation Modal */}
      {checkInConfirmApp && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
             <div className="glass-panel w-full max-w-sm rounded-3xl p-6 animate-slideUp">
                 <div className="w-12 h-12 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                     <Info size={24}/>
                 </div>
                 <h3 className="font-bold text-lg mb-2 text-center dark:text-white">簽到確認</h3>
                 <p className="text-sm text-gray-500 text-center mb-6">簽到後請出示畫面給教練確認<br/><span className="text-xs text-orange-500 font-bold">(教練確認後才會扣除點數)</span></p>
                 
                 <div className="flex gap-3">
                     <button onClick={() => { setCheckInConfirmApp(null); }} className="flex-1 py-2.5 bg-gray-200 dark:bg-gray-700 rounded-xl font-bold text-gray-600 dark:text-gray-300">取消</button>
                     <button onClick={() => { onCheckIn(checkInConfirmApp); setCheckInConfirmApp(null); }} 
                        className="flex-1 py-2.5 bg-green-500 text-white rounded-xl font-bold shadow-lg shadow-green-500/30">
                        確認簽到
                     </button>
                 </div>
             </div>
        </div>
      )}
    </div>
  );
};

export default MyBookings;