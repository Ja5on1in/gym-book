
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle, Loader2, Plus, AlertCircle, Check } from 'lucide-react';
import { Coach, User, Appointment } from '../types';
import { ALL_TIME_SLOTS } from '../constants';
import { addDays, formatDateKey, isCoachDayOff, isPastTime } from '../utils';

interface WeeklyCalendarProps {
  currentWeekStart: Date;
  setCurrentWeekStart: (d: Date) => void;
  currentUser: User;
  coaches: Coach[];
  appointments: Appointment[];
  onSlotClick: (date: string, time: string) => void;
  onAppointmentClick: (app: Appointment) => void;
  onToggleComplete: (app: Appointment) => void;
  isLoading: boolean; // New prop for loading state
}

const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({
  currentWeekStart, setCurrentWeekStart, currentUser, coaches, appointments, onSlotClick, onAppointmentClick, onToggleComplete, isLoading
}) => {
  const [expandedCell, setExpandedCell] = useState<string | null>(null);
  const weekDays = Array.from({length: 7}, (_, i) => addDays(currentWeekStart, i));

  return (
    <div className="glass-panel rounded-3xl overflow-hidden shadow-sm animate-fadeIn relative flex flex-col h-[750px]">
      
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm flex flex-col items-center justify-center">
            <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400 mb-2" size={48} />
            <p className="text-gray-600 dark:text-gray-300 font-bold">資料載入中...</p>
        </div>
      )}

      <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/50 dark:bg-gray-900/50 z-20 relative backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="flex bg-white dark:bg-gray-800 rounded-xl p-1 shadow-sm border border-gray-100 dark:border-gray-700">
              <button onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))} disabled={isLoading} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"><ChevronLeft size={20} className="text-gray-600 dark:text-gray-300"/></button>
              <button onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))} disabled={isLoading} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"><ChevronRight size={20} className="text-gray-600 dark:text-gray-300"/></button>
          </div>
          <span className="font-bold text-xl text-gray-800 dark:text-white tracking-tight">{currentWeekStart.getMonth()+1}月 {currentWeekStart.getDate()}日 <span className="text-sm font-normal text-gray-500">週</span></span>
        </div>
        <div className="flex gap-2 text-xs text-gray-500">
          <div className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-gray-800 rounded-full border border-gray-100 dark:border-gray-700"><div className="w-3 h-3 bg-gray-200 dark:bg-gray-700 pattern-diagonal rounded-full"></div><span>排休</span></div>
          <div className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-gray-800 rounded-full border border-gray-100 dark:border-gray-700"><div className="w-3 h-3 bg-orange-400 rounded-full animate-pulse"></div><span>待確認</span></div>
        </div>
      </div>
      
      {/* Calendar Grid Container */}
      <div className="flex-1 overflow-auto custom-scrollbar bg-white/30 dark:bg-gray-900/30 relative">
        <div className="min-w-[900px]">
          {/* Header Row (Sticky Top) */}
          <div className="grid grid-cols-8 border-b border-gray-200/50 dark:border-gray-700/50 bg-white/95 dark:bg-gray-900/95 sticky top-0 z-30 shadow-sm backdrop-blur-sm">
            <div className="p-4 text-center text-xs font-bold text-gray-400 uppercase tracking-widest border-r border-gray-100 dark:border-gray-700/50 sticky left-0 z-40 bg-white dark:bg-gray-900 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]">時間</div>
            {weekDays.map((d, i) => (
              <div key={i} className={`p-3 text-center border-r border-gray-100 dark:border-gray-700/50 ${d.toDateString()===new Date().toDateString()?'bg-indigo-50/50 dark:bg-indigo-900/20':''}`}>
                <div className="text-xs text-gray-500 font-medium mb-1">{['週日','週一','週二','週三','週四','週五','週六'][d.getDay()]}</div>
                <div className={`font-bold text-lg inline-block w-8 h-8 leading-8 rounded-full ${d.toDateString()===new Date().toDateString() ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-200'}`}>{d.getDate()}</div>
              </div>
            ))}
          </div>
          
          {/* Time Slots */}
          {ALL_TIME_SLOTS.map(time => (
            <div key={time} className="grid grid-cols-8 border-b border-gray-100/50 dark:border-gray-700/50 min-h-[90px]">
              {/* Time Label (Sticky Left) */}
              <div className="p-2 text-center text-xs font-medium text-gray-400 border-r border-gray-100/50 dark:border-gray-700/50 flex items-center justify-center bg-white dark:bg-gray-900 sticky left-0 z-20 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]">{time}</div>
              {weekDays.map((day) => {
                const dateKey = formatDateKey(day.getFullYear(), day.getMonth(), day.getDate());
                const myCoach = currentUser.role === 'manager' ? null : coaches.find(c => c.id === currentUser.id);
                const isOff = myCoach && isCoachDayOff(dateKey, myCoach);
                
                const slotApps = appointments.filter(a => a.date === dateKey && a.time === time && a.status !== 'cancelled');
                const visibleApps = slotApps;
                // isPastTime check removed from blocking logic for managers below

                return (
                  <div 
                    key={`${dateKey}-${time}`} 
                    className={`border-r border-gray-100/50 dark:border-gray-700/50 p-1.5 relative group transition-all duration-200
                      ${isOff ? 'bg-stripes-gray opacity-40' : 'hover:bg-white/40 dark:hover:bg-gray-800/40 cursor-pointer'}
                    `}
                    onClick={() => {
                        if (!isOff && !isLoading) onSlotClick(dateKey, time);
                    }}
                  >
                     <div className="flex flex-col gap-1.5 h-full">
                        {visibleApps.slice(0, expandedCell === `${dateKey}-${time}` ? undefined : 2).map(app => {
                            const coach = coaches.find(c => c.id === app.coachId);
                            const colorClass = coach?.color || 'bg-gray-100 text-gray-800 border-gray-200';
                            const isMine = currentUser.role === 'manager' || app.coachId === currentUser.id;
                            const isCompleted = app.status === 'completed';
                            const isCheckedIn = app.status === 'checked_in';
                            
                            // Determine display text: Prefer customer name for private/client bookings
                            const displayText = (app.type === 'private' || (app.type as string) === 'client') 
                              ? (app.customer?.name || app.reason || '私人課') 
                              : (app.reason || '預約');

                            return (
                              <div key={app.id} 
                                   onClick={(e) => { e.stopPropagation(); if(isMine && !isLoading) onAppointmentClick(app); }}
                                   className={`
                                      text-[11px] p-2 rounded-xl shadow-sm border border-black/5 hover:scale-[1.02] transition-transform
                                      ${colorClass} 
                                      ${isCompleted ? 'opacity-60 grayscale' : ''} 
                                      ${!isMine ? 'opacity-80' : ''}
                                      ${isCheckedIn ? 'ring-2 ring-orange-400 ring-offset-1 dark:ring-offset-gray-900 animate-pulse' : ''}
                                   `}
                              >
                                  <div className="flex justify-between items-center mb-0.5">
                                    <span className="font-bold truncate">{coach?.name || app.coachName}</span>
                                    
                                    {/* Action Button: Check In confirm for Coach - UPDATED STYLE */}
                                    {isMine && isCheckedIn && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); if(!isLoading) onToggleComplete(app); }}
                                            className="bg-indigo-600 text-white rounded-md px-1.5 py-0.5 shadow-sm hover:scale-105 transition-transform flex items-center gap-0.5 text-[9px] font-bold tracking-tight" 
                                            title="確認完課 (扣點)"
                                        >
                                            <Check size={10}/> 核實
                                        </button>
                                    )}

                                    {/* Only Manager can force complete manually from here (Legacy/Force) */}
                                    {isMine && !isCompleted && !isCheckedIn && currentUser.role === 'manager' && (
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); if(!isLoading) onToggleComplete(app); }}
                                        className="bg-white/60 hover:bg-white rounded-full p-0.5 text-green-700 transition-colors shadow-sm" title="強制結課"
                                      >
                                        <CheckCircle size={12}/>
                                      </button>
                                    )}
                                    {isMine && isCompleted && <CheckCircle size={12} className="text-green-800"/>}
                                  </div>
                                  <div className="truncate font-medium opacity-90">{displayText}</div>
                                  {isCheckedIn && <div className="text-[9px] font-bold text-orange-600 mt-0.5">等待確認</div>}
                              </div>
                            );
                        })}
                        {visibleApps.length > 2 && expandedCell !== `${dateKey}-${time}` && (
                          <div onClick={(e) => { e.stopPropagation(); setExpandedCell(`${dateKey}-${time}`); }} className="text-[10px] text-center text-indigo-500 font-bold bg-indigo-50 dark:bg-indigo-900/30 rounded-lg cursor-pointer hover:bg-indigo-100 py-1 transition-colors">
                            +{visibleApps.length - 2}
                          </div>
                        )}
                        {expandedCell === `${dateKey}-${time}` && visibleApps.length > 2 && (
                          <div onClick={(e) => { e.stopPropagation(); setExpandedCell(null); }} className="text-[10px] text-center text-gray-400 cursor-pointer py-1 hover:text-gray-600">
                            收起
                          </div>
                        )}
                        
                        {!isOff && visibleApps.length === 0 && (
                            <div className="hidden group-hover:flex w-full h-full items-center justify-center">
                                <div className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-gray-700 text-indigo-500 flex items-center justify-center">
                                    <Plus size={14} strokeWidth={3}/>
                                </div>
                            </div>
                        )}
                     </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WeeklyCalendar;
