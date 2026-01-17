import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
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
}

const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({
  currentWeekStart, setCurrentWeekStart, currentUser, coaches, appointments, onSlotClick, onAppointmentClick, onToggleComplete
}) => {
  const [expandedCell, setExpandedCell] = useState<string | null>(null);
  const weekDays = Array.from({length: 7}, (_, i) => addDays(currentWeekStart, i));

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden animate-fadeIn relative">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50 dark:bg-gray-900 z-20 relative">
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded"><ChevronLeft size={20}/></button>
          <span className="font-bold text-lg text-gray-800 dark:text-white ml-2">{currentWeekStart.getMonth()+1}月 {currentWeekStart.getDate()}日 週</span>
          <button onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded"><ChevronRight size={20}/></button>
        </div>
        <div className="flex gap-2 text-xs text-gray-500">
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-200 dark:bg-gray-700 pattern-diagonal"></div><span>排休</span></div>
        </div>
      </div>
      <div className="overflow-x-auto relative h-[600px] overflow-y-auto custom-scrollbar">
        <div className="min-w-[800px] relative">
          {/* Header Row */}
          <div className="grid grid-cols-8 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 sticky top-0 z-30">
            <div className="p-3 text-center text-xs font-bold text-gray-500 border-r dark:border-gray-700">時間</div>
            {weekDays.map((d, i) => (
              <div key={i} className={`p-3 text-center border-r dark:border-gray-700 ${d.toDateString()===new Date().toDateString()?'bg-blue-50 dark:bg-blue-900/20':''}`}>
                <div className="text-xs text-gray-500">{['日','一','二','三','四','五','六'][d.getDay()]}</div>
                <div className="font-bold text-gray-800 dark:text-gray-200">{d.getDate()}</div>
              </div>
            ))}
          </div>
          
          {/* Time Slots */}
          {ALL_TIME_SLOTS.map(time => (
            <div key={time} className="grid grid-cols-8 border-b border-gray-100 dark:border-gray-700 min-h-[80px]">
              <div className="p-2 text-center text-xs text-gray-400 border-r dark:border-gray-700 flex items-center justify-center">{time}</div>
              {weekDays.map((day) => {
                const dateKey = formatDateKey(day.getFullYear(), day.getMonth(), day.getDate());
                const myCoach = currentUser.role === 'manager' ? null : coaches.find(c => c.id === currentUser.id);
                // If I am a coach, check if I am off. If I am manager, I can see all slots but we use logic to determine if clicked
                // Manager logic usually defaults to "view all", but when adding, manager selects a coach. 
                // Here we disable clicking if the logged-in coach is off.
                const isOff = myCoach && isCoachDayOff(dateKey, myCoach);
                
                // Filter appointments for this cell
                const slotApps = appointments.filter(a => a.date === dateKey && a.time === time && a.status !== 'cancelled');
                
                // Filter visibility based on role: Managers see all, Coaches see theirs
                const visibleApps = currentUser.role === 'manager' 
                    ? slotApps 
                    : slotApps.filter(a => a.coachId === currentUser.id);

                const isPast = isPastTime(dateKey, time);

                return (
                  <div 
                    key={`${dateKey}-${time}`} 
                    className={`border-r border-gray-100 dark:border-gray-700 p-1 relative group hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
                      ${isOff ? 'bg-stripes-gray cursor-not-allowed opacity-50' : 'cursor-pointer'}
                    `}
                    onClick={() => {
                        // Allow clicking even if past, validation happens in handler if needed.
                        if (!isOff) onSlotClick(dateKey, time);
                    }}
                  >
                     <div className="flex flex-col gap-1">
                        {visibleApps.slice(0, expandedCell === `${dateKey}-${time}` ? undefined : 2).map(app => {
                            const coach = coaches.find(c => c.id === app.coachId);
                            const isMine = currentUser.role === 'manager' || app.coachId === currentUser.id;
                            return (
                              <div key={app.id} 
                                   onClick={(e) => { e.stopPropagation(); if(isMine) onAppointmentClick(app); }}
                                   className={`text-[10px] p-1 rounded border shadow-sm ${coach?.color} ${app.isCompleted ? 'opacity-60 grayscale' : ''} ${!isMine ? 'opacity-80' : ''}`}
                              >
                                  <div className="flex justify-between items-center">
                                    <span className="font-bold truncate">{coach?.name}</span>
                                    {isMine && isPast && !app.isCompleted && (
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); onToggleComplete(app); }}
                                        className="bg-white/50 hover:bg-white rounded-full p-0.5 text-green-700" title="確認結課"
                                      >
                                        <CheckCircle size={10}/>
                                      </button>
                                    )}
                                    {isMine && app.isCompleted && <CheckCircle size={10} className="text-green-800"/>}
                                  </div>
                                  <div className="truncate">{app.type === 'client' ? app?.customer?.name : app.reason}</div>
                              </div>
                            );
                        })}
                        {visibleApps.length > 2 && expandedCell !== `${dateKey}-${time}` && (
                          <div onClick={(e) => { e.stopPropagation(); setExpandedCell(`${dateKey}-${time}`); }} className="text-[10px] text-center text-blue-500 bg-blue-50 rounded cursor-pointer hover:bg-blue-100">
                            +{visibleApps.length - 2} 更多
                          </div>
                        )}
                        {expandedCell === `${dateKey}-${time}` && visibleApps.length > 2 && (
                          <div onClick={(e) => { e.stopPropagation(); setExpandedCell(null); }} className="text-[10px] text-center text-gray-400 cursor-pointer">
                            收起
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